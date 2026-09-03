import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";

import { RedisCacheService } from "../common/cache/redis-cache.service.js";
import { DatabaseService, type DialectConnection } from "../database/database.service.js";

type PoolConnection = DialectConnection;
import {
  createSharedCacheAdapter,
  type SharedCacheAdapter,
} from "../shared-cache/shared-cache-adapter.js";

const DEFAULT_RPD_TEMPLATE_HTML = String(
  '<h3 style="text-align:center;">RENCANA PENGGUNAAN DANA (RPD)</h3><p style="text-align:center;">Program Bantuan Sarana dan Peralatan SMK Tahun Anggaran {{tahun_anggaran}}</p><hr /><p><strong>1. Identitas Sekolah</strong></p><table style="width:100%;border-collapse:collapse;"><tbody><tr><td style="width:25%;padding:6px 8px;border:1px solid #ddd;">Nama Sekolah</td><td style="padding:6px 8px;border:1px solid #ddd;">{{nama_sekolah}}</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">NPSN</td><td style="padding:6px 8px;border:1px solid #ddd;">{{npsn}}</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">Alamat</td><td style="padding:6px 8px;border:1px solid #ddd;">{{alamat_jalan}}, {{kota}}, {{provinsi}} {{kode_pos}}</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">Kepala Sekolah</td><td style="padding:6px 8px;border:1px solid #ddd;">{{nama_kepala_sekolah}}, NIP. {{nip_kepala_sekolah}}</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">Kontak Kepala Sekolah</td><td style="padding:6px 8px;border:1px solid #ddd;">{{kontak_kepala_sekolah}}</td></tr></tbody></table><p style="margin-top:16px;"><strong>2. Sumber Dana</strong></p><p>{{sumber_dana}}</p><p><strong>3. Konsentrasi Keahlian</strong></p><p>{{konsentrasi_keahlian_rpd_uraian}}</p><p><strong>4. Ringkasan Anggaran</strong></p><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="width:60%;padding:8px;border:1px solid #ddd;text-align:left;">Uraian</th><th style="padding:8px;border:1px solid #ddd;text-align:right;">Nilai (Rp)</th></tr></thead><tbody><tr><td style="padding:6px 8px;border:1px solid #ddd;">Total Anggaran RAB</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">{{total_anggaran_rp}}</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">Total Anggaran Terbilang</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;"><em>{{total_anggaran_terbilang}}</em></td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">Tahap I (Pencairan 70%)</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">{{tahap1_70_rp}}</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">Tahap II (Pencairan 30%)</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">{{tahap2_30_rp}}</td></tr></tbody></table><p style="margin-top:18px;text-align:right;">{{tempat_tanggal_buat}}, {{hari_tanggal_terbilang}}</p><p style="text-align:right;">Mengetahui,<br />Kepala Sekolah<br /><br /><br /><strong>{{nama_kepala_sekolah}}</strong><br />NIP. {{nip_kepala_sekolah}}</p>',
);

const DEFAULT_PKS_TEMPLATE_HTML = String(
  '<h2 style="text-align:center;">PERJANJIAN KERJA SAMA (PKS)</h2><p style="text-align:center;">Program Bantuan Sarana dan Peralatan SMK Tahun Anggaran {{tahun_anggaran}}</p><p style="text-align:center;">Nomor: {{nomor_pks}}</p><hr /><h3>PASAL 1 — PIHAK-PIHAK YANG BEKERJA SAMA</h3><ol><li><strong>PIHAK PERTAMA (Pemerintah — PPK)</strong><br />Nama: {{nama_ppk}}<br />NIP: {{nip_ppk}}<br />Selaku Pengelola Kegiatan (PPK) SMK Tahun Anggaran {{tahun_anggaran}}.</li><li><strong>PIHAK KEDUA (Sekolah Penerima Manfaat)</strong><br />Nama Sekolah: {{nama_sekolah}} (NPSN {{npsn}})<br />Alamat: {{alamat_jalan}}, {{kota}}, {{provinsi}} {{kode_pos}}<br />Diwakili oleh Kepala Sekolah: {{nama_kepala_sekolah}}, NIP. {{nip_kepala_sekolah}}.</li><li><strong>PIHAK KETIGA (Fasilitator — Pendamping Sekolah)</strong><br />Nama: {{nama_fasilitator}}<br />NIP/NIK: {{nip_nik_fasilitator}}.</li></ol><h3>PASAL 2 — MAKSUD DAN TUJUAN</h3><p>Maksud Perjanjian Kerja Sama ini adalah untuk menjamin terlaksananya pengadaan sarana dan peralatan di {{nama_sekolah}} sesuai dengan RPD, RAB, dan spesifikasi teknis yang telah ditetapkan.</p><h3>PASAL 3 — RUANG LINGKUP KERJA SAMA</h3><p>Ruang lingkup meliputi: (a) penyediaan peralatan sarana praktik sesuai {{konsentrasi_keahlian_rpd_uraian}}; (b) pendistribusian dan instalasi peralatan di {{nama_sekolah}}; (c) bimbingan teknis penggunaan peralatan; (d) monitoring dan evaluasi; (e) pelaporan pertanggungjawaban 0%, 50%, dan 100%.</p><h3>PASAL 4 — PEMBIAYAAN DAN SUMBER DANA</h3><p>Anggaran kegiatan ini bersumber dari: <strong>{{sumber_dana}}</strong> dengan alokasi biaya sebesar <strong>{{total_anggaran_rp}}</strong> ({{total_anggaran_terbilang}}), dicairkan bertahap: (1) Tahap I 70% sebesar {{tahap1_70_rp}} dan (2) Tahap II 30% sebesar {{tahap2_30_rp}}.</p><h3>PASAL 5 — HAK DAN KEWAJIBAN PIHAK PERTAMA (PPK)</h3><ol><li>Menyediakan anggaran sesuai jadwal pencairan; (2) Menetapkan spesifikasi dan standar kelayakan peralatan; (3) Melakukan verifikasi dan validasi Laporan Pertanggungjawaban.</li></ol><h3>PASAL 6 — HAK DAN KEWAJIBAN PIHAK KEDUA (SEKOLAH)</h3><ol><li>Menyusun dan menandatangani RPD, RAB, dan Berita Acara Serah Terima (BAST Nomor: {{nomor_bast}}); (2) Menyiapkan ruangan praktik sesuai standar keamanan K3; (3) Menandatangani Berita Acara Penerimaan Barang (BAPB Nomor: {{nomor_bapb}}); (4) Menyusun laporan pertanggungjawaban; (5) Melakukan pemeliharaan peralatan selama minimal 2 (dua) tahun.</li></ol><h3>PASAL 7 — HAK DAN KEWAJIBAN PIHAK KETIGA (FASILITATOR)</h3><p>Pihak Ketiga wajib mendampingi {{nama_sekolah}} menyusun dokumen RPD/RAB, memverifikasi kelayakan ruangan dan peralatan, serta memfasilitasi proses Bimbingan Teknis (Bimtek).</p><h3>PASAL 8 — TIM SARPRAS SEKOLAH</h3><p>Struktur Tim Sarpras {{nama_sekolah}} ditetapkan berdasarkan Surat Keputusan Nomor: {{nomor_sk_tim}}, dengan susunan: (1) Ketua: {{ketua_tim_sarpras_nama}}; (2) Sekretaris: {{sekretaris_tim_nama}}; (3) Bendahara: {{bendahara_tim_nama}}; (4) Anggota Teknis: {{anggota_teknis_tim_nama}}.</p><h3>PASAL 9 — JADWAL DAN WAKTU PELAKSANAAN (TIMELINE)</h3><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="width:22%;padding:8px;border:1px solid #ddd;text-align:left;">Tahapan</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Uraian</th><th style="width:22%;padding:8px;border:1px solid #ddd;text-align:left;">Target Waktu</th></tr></thead><tbody><tr><td style="padding:6px 8px;border:1px solid #ddd;">1. Pra-Bimtek</td><td style="padding:6px 8px;border:1px solid #ddd;">Rapat koordinator penetapan RPD &amp; RAB per sekolah</td><td style="padding:6px 8px;border:1px solid #ddd;">Minggu I</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">2. Pengadaan</td><td style="padding:6px 8px;border:1px solid #ddd;">Pemilihan penyedia barang dan proses pemesanan sarana</td><td style="padding:6px 8px;border:1px solid #ddd;">Minggu II — III</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">3. Pengiriman &amp; Instalasi</td><td style="padding:6px 8px;border:1px solid #ddd;">Distribusi, instalasi, uji coba peralatan praktik</td><td style="padding:6px 8px;border:1px solid #ddd;">Minggu IV — V</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">4. Bimbingan Teknis</td><td style="padding:6px 8px;border:1px solid #ddd;">Bimtek penggunaan alat dan pelatihan guru produktif</td><td style="padding:6px 8px;border:1px solid #ddd;">Minggu VI — VII</td></tr><tr><td style="padding:6px 8px;border:1px solid #ddd;">5. Pemeliharaan</td><td style="padding:6px 8px;border:1px solid #ddd;">Pemeliharaan berkala dan pendampingan pasca-Bimtek</td><td style="padding:6px 8px;border:1px solid #ddd;">Bulan 2 s.d. 24</td></tr></tbody></table><h3>PASAL 10 — PEMELIHARAAN DAN PEMANFAATAN JANGKA PANJANG</h3><p>Sarana dan peralatan yang diterima {{nama_sekolah}} wajib dimanfaatkan secara berkelanjutan untuk kegiatan pembelajaran produktif dan/atau program Praktik Kerja Lapangan (PKL)/PRAKERIN siswa.</p><h3>PASAL 11 — LAPORAN PERTANGGUNGJAWABAN</h3><p>Format laporan: (a) LPJ 0% (Rencana Awal) — sebelum pencairan Tahap I; (b) LPJ 50% (Fisik + Keuangan) — setelah pencairan Tahap I; (c) LPJ 100% (Final + Audit) — sebelum pencairan Tahap II. Lampiran wajib: BAST, BAPB, foto dokumentasi, bukti transfer, kuitansi, dan checklist verifikasi.</p><h3>PASAL 12 — SANGSI DAN PEMBATALAN</h3><p>Pihak-pihak yang melanggar isi PKS ini dapat dikenakan sanksi administratif sesuai ketentuan peraturan perundang-undangan yang berlaku, termasuk pengembalian dana yang telah dicairkan.</p><hr /><h3>LAMPIRAN — TANDA TANGAN</h3><p style="text-align:center;">Dibuat di {{tempat_tanggal_buat}}, {{hari_tanggal_terbilang}}</p><p>Yang bertanda tangan di bawah ini menyatakan menyetujui seluruh isi Perjanjian Kerja Sama ini tanpa paksaan dari pihak manapun.</p><div style="display:flex;flex-wrap:wrap;gap:32px;margin-top:24px;"><div style="flex:1;min-width:240px;"><p style="font-weight:600;">PIHAK PERTAMA (PPK)</p><br /><br /><p>{{nama_ppk}}<br />NIP. {{nip_ppk}}</p></div><div style="flex:1;min-width:240px;"><p style="font-weight:600;">PIHAK KEDUA (KEPALA SEKOLAH)</p><br /><br /><p>{{nama_kepala_sekolah}}<br />NIP. {{nip_kepala_sekolah}}</p></div><div style="flex:1;min-width:240px;"><p style="font-weight:600;">PIHAK KETIGA (FASILITATOR)</p><br /><br /><p>{{nama_fasilitator}}<br />NIP/NIK. {{nip_nik_fasilitator}}</p></div></div><hr /><h3>LEMBAR SPTJM (SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK)</h3><p>Dengan ini saya yang bertanda tangan di bawah ini, <strong>{{nama_kepala_sekolah}}</strong> selaku Kepala Sekolah {{nama_sekolah}}, menyatakan dengan sesungguhnya bahwa seluruh data dan informasi yang disampaikan dalam dokumen RPD, RAB, BAST, BAPB, kuitansi, dan lampiran PKS ini adalah benar, akurat, dan dapat dipertanggungjawabkan.</p><p>Tempat, tanggal: {{tempat_tanggal_buat}}</p><p style="text-align:right;"><br /><strong>{{nama_kepala_sekolah}}</strong><br />Kepala Sekolah — NIP. {{nip_kepala_sekolah}}</p><h3>PAKTA INTEGRITAS</h3><p>Saya <strong>{{nama_kepala_sekolah}}</strong> bersama Tim Sarpras ({{ketua_tim_sarpras_nama}}, {{sekretaris_tim_nama}}, {{bendahara_tim_nama}}, {{anggota_teknis_tim_nama}}) berjanji akan melaksanakan seluruh kegiatan program Bantuan Sarana SMK Tahun {{tahun_anggaran}} dengan jujur, transparan, akuntabel, bebas dari Korupsi, Kolusi, dan Nepotisme (KKN).</p>',
);

type DatasetKey = "REGULER" | "ABT";
type SourceTabKey = "bantuan" | "abt";
type ModuleKey = "wawancara" | "bimbingan-teknis" | "verifikasi-online" | "pra-bimtek";

function normalizeRows<T = unknown>(raw: unknown): T[] {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as any).rows)) {
    raw = (raw as any).rows as unknown;
  }
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [] as unknown as T[];
  const first = raw[0];
  if (first === undefined || first === null) return [] as unknown as T[];
  if (Array.isArray(first)) return first as unknown as T[];
  if (typeof first === "object" && !Buffer.isBuffer(first)) return raw as unknown as T[];
  return [] as unknown as T[];
}

type BimtekStatus =
  | "NOT_SCHEDULED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type InterviewAnswerValue = 1 | 2 | 3 | 4 | 5;
type InterviewAssessmentComponentAnswer = {
  score: InterviewAnswerValue;
  comment?: string | null;
};
type InterviewAssessmentAnswers = Record<
  string,
  InterviewAnswerValue | InterviewAssessmentComponentAnswer
>;
type BimtekDocumentKey = "survey" | "rpkp" | "rab";
type BimtekDocumentReviewStatus = "pending" | "revisi" | "approved";

interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  organization: string;
  region: string;
}

interface WorkspaceSchoolRecordRow extends RowDataPacket {
  school_no: number;
  school_npsn: string;
  school_name: string;
  province: string | null;
  city: string | null;
  district: string | null;
  note: string | null;
  is_selected: number | null;
  raw_payload: unknown;
}

type PreparationsItemPayload = { uuid: string; description: string; quantity: number; unitPrice: number };
type PreparationsGroupPayload = { uuid: string; name: string; items: PreparationsItemPayload[] };
type PreparationsItemResult = PreparationsItemPayload;
type PreparationsGroupResult = PreparationsGroupPayload;

type TrainingCostPayload = {
  uuid: string;
  productName: string;
  unitPrice: number;
  requiresTraining: boolean;
  trainingCost: number;
};
type TrainingCostResult = TrainingCostPayload;

// ===== Clean MVCR Relational: PAGU & REVIEW COMMENTS types (module level, esbuild safe) =====
type PaguStatus = "DRAFT" | "DITETAPKAN" | "LOCKED" | "DIPERPBAHARUI";
type ReviewDomainScope =
  | "1_INFORMASI" | "2_DOKUMEN" | "3_KONSENTRASI" | "4_ALAT"
  | "5_AJUAN_PERSIAPAN" | "5_AJUAN_SURVEY" | "5_AJUAN_RPKP" | "5_AJUAN_PELATIHAN"
  | "PAGU" | "LAINNYA";
type ReviewCommenterRole =
  | "FASILITATOR_ALAT" | "FASILITATOR_ADMINISTRASI" | "ADMIN" | "SUPERADMIN" | "KOORDINATOR_ALAT";
type ReviewSeverity = "INFO" | "WARNING" | "WAJIB_PERBAIKI" | "APPROVE";

interface SchoolPaguRow {
  npsn: string;
  tahun_ajaran: string;
  pagu_persiapan: number;
  pagu_alat: number;
  pagu_pelatihan: number;
  pagu_total: number;
  realisasi_persiapan: number;
  realisasi_alat: number;
  realisasi_pelatihan: number;
  status: PaguStatus;
  set_by_admin_id: string | null;
  set_by_admin_name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}
interface SchoolReviewCommentRow {
  comment_id: string;
  npsn: string;
  domain_scope: ReviewDomainScope;
  record_ref: string | null;
  commenter_role: ReviewCommenterRole;
  commenter_user_id: string;
  commenter_name: string;
  comment_text: string;
  severity: ReviewSeverity;
  is_resolved: boolean;
  resolved_by_user_id: string | null;
  resolved_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface WorkspaceAssignmentRow extends RowDataPacket {
  module_key: ModuleKey;
  source_tab: SourceTabKey;
  school_no: number;
  school_npsn: string;
  school_name: string;
  facilitator_administration_id: string | null;
  facilitator_administration_name: string;
  facilitator_equipment_id: string | null;
  facilitator_equipment_name: string;
  interview_scheduled_date: string | null;
  interview_scheduled_time: string | null;
  interview_meeting_link: string | null;
  pra_bimtek_scheduled_date: string | null;
  pra_bimtek_scheduled_time: string | null;
  pra_bimtek_meeting_link: string | null;
  pra_bimtek_status: BimtekStatus | string | null;
  bimtek_scheduled_date: string | null;
  bimtek_location: string | null;
  bimtek_status: BimtekStatus | string | null;
  updated_at: Date | string;
}

type PrintTemplateKind =
  | "IDENTITAS"
  | "ADMINISTRASI"
  | "SURVEY_HARGA"
  | "RPKP"
  | "RAB"
  | "RPD"
  | "PKS";

const PRINT_TEMPLATE_KIND_VALUES: readonly PrintTemplateKind[] = [
  "IDENTITAS",
  "ADMINISTRASI",
  "SURVEY_HARGA",
  "RPKP",
  "RAB",
  "RPD",
  "PKS",
] as const;

interface WorkspaceInterviewRow extends RowDataPacket {
  assignment_key: string;
  school_npsn: string;
  school_name: string;
  facilitator_equipment_id: string;
  facilitator_equipment_name: string;
  answers_json: unknown;
  total_score: number;
  recommendation: string;
  note: string | null;
  assessment_updated_at: Date | string;
}

interface WorkspaceBimtekReviewRow extends RowDataPacket {
  school_npsn: string;
  school_name: string;
  facilitator_equipment_id: string;
  facilitator_equipment_name: string;
  statuses_json: unknown;
  notes_json: unknown;
  fasil_alat_comment: string | null;
  fasil_admin_comment: string | null;
  review_updated_at: Date | string;
}

interface MasterRpdPksTemplateRow extends RowDataPacket {
  id: string;
  kind: PrintTemplateKind;
  version_label: string;
  tahun_ajaran: string;
  is_active: number;
  title: string;
  body_html: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SchoolInstanceRpdPksRow extends RowDataPacket {
  id: string;
  school_npsn: string;
  school_name: string;
  module_context: "pra-bimtek" | "bimbingan-teknis";
  kind: PrintTemplateKind;
  template_id: string | null;
  body_html: string;
  review_notes: string | null;
  review_status: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";
  reviewed_by_user_id: string | null;
  reviewed_at: Date | string | null;
  approved_by_user_id: string | null;
  approved_at: Date | string | null;
  created_by_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface WorkspaceVerifikasiOnlineReviewRow extends RowDataPacket {
  school_npsn: string;
  school_name: string;
  review_note_admin: string | null;
  review_note_equipment: string | null;
  approved_admin: number | null;
  approved_equipment: number | null;
  reviewed_admin_id: string | null;
  reviewed_admin_name: string | null;
  reviewed_admin_at: Date | string | null;
  reviewed_equipment_id: string | null;
  reviewed_equipment_name: string | null;
  reviewed_equipment_at: Date | string | null;
  review_updated_at: Date | string;
}

interface SchoolLookupRow extends RowDataPacket {
  id: string;
  npsn: string;
  name: string;
}

interface ProposalDataRow extends RowDataPacket {
  npsn: string;
  proposal_tables_json: unknown;
  rpkp_selections_json: unknown;
  updated_at: Date | string;
  version?: number;
  data_sha256?: string | null;
}

interface EquipmentDataRow extends RowDataPacket {
  npsn: string;
  equipment_tables_json: unknown;
  updated_at: Date | string;
  version?: number;
  data_sha256?: string | null;
}

type WorkspaceDatasetPayload = Record<string, unknown> & {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
  kecamatan: string;
  catatan: unknown;
  status_penerima_abt: boolean | null;
  fasilitator_administrasi?: string;
  fasilitator_peralatan?: string;
};

type AssignmentPayload = {
  key: string;
  moduleKey: ModuleKey;
  moduleLabel: string;
  sourceTab: SourceTabKey;
  sourceLabel: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  facilitatorAdministrationId: string;
  facilitatorAdministrationName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  interviewScheduledDate?: string | null;
  interviewScheduledTime?: string | null;
  interviewMeetingLink?: string | null;
  praBimtekScheduledDate?: string | null;
  praBimtekScheduledTime?: string | null;
  praBimtekMeetingLink?: string | null;
  bimtekScheduledDate?: string | null;
  bimtekLocation?: string | null;
  bimtekStatus?: BimtekStatus | string | null;
  updatedAt: string;
};

type InterviewAssessmentPayload = {
  assignmentKey: string;
  schoolNpsn: string;
  schoolName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  answers: InterviewAssessmentAnswers;
  totalScore: number;
  recommendation: string;
  note: string;
  updatedAt: string;
};

type BimtekReviewPayload = {
  schoolNpsn: string;
  schoolName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  statuses: Record<BimtekDocumentKey, BimtekDocumentReviewStatus>;
  notes: Record<BimtekDocumentKey, string>;
  fasilAlatComment?: string | null;
  fasilAdminComment?: string | null;
  updatedAt: string;
};

type VerifikasiOnlineReviewerRole = "ADMINISTRASI" | "PERALATAN";
type VerifikasiOnlineApprovalStatus = null | boolean;

type VerifikasiOnlineReviewPayload = {
  schoolNpsn: string;
  schoolName: string;
  reviewerRole: VerifikasiOnlineReviewerRole;
  reviewerId: string;
  reviewerName: string;
  reviewNote?: string | null;
  approved?: VerifikasiOnlineApprovalStatus;
  updatedAt: string;
};

type VerifikasiOnlineReviewRecord = {
  schoolNpsn: string;
  schoolName: string;
  reviewNoteAdmin: string | null;
  reviewNoteEquipment: string | null;
  approvedAdmin: VerifikasiOnlineApprovalStatus;
  approvedEquipment: VerifikasiOnlineApprovalStatus;
  reviewedAdminId: string | null;
  reviewedAdminName: string | null;
  reviewedAdminAt: string | null;
  reviewedAdminEmail: string | null;
  reviewedAdminPhone: string | null;
  reviewedEquipmentId: string | null;
  reviewedEquipmentName: string | null;
  reviewedEquipmentAt: string | null;
  reviewedEquipmentEmail: string | null;
  reviewedEquipmentPhone: string | null;
  updatedAt: string;
};

type ProposalBundleEntry = {
  proposalTables: unknown;
  rpkpSelections: unknown;
  updatedAt: string | null;
};

type EquipmentBundleEntry = {
  equipmentTables: unknown;
  updatedAt: string | null;
};

type RuntimeCacheKey =
  | "interview_assessments"
  | "bimtek_reviews"
  | "verifikasi_online_reviews"
  | "school_lookup"
  | "proposal_bundles"
  | "equipment_bundles"
  | (string & {});

const SAVE_ERROR_LOG_PATH = "/tmp/saranasmk_save_error.log";
async function writeSaveErrorToTmpLog(context: string, err: unknown, extra: Record<string, unknown> = {}) {
  try {
    const ts = new Date().toISOString();
    const stack = err instanceof Error ? err.stack ?? String(err.message) : String(err);
    const msg = `\n========== ${ts} | ${context} ==========\n` +
      `MESSAGE: ${err instanceof Error ? err.message : String(err)}\n` +
      `EXTRA: ${JSON.stringify(extra, null, 2)}\n` +
      `STACK:\n${stack}\n` +
      `========================================\n`;
    await appendFile(SAVE_ERROR_LOG_PATH, msg, "utf8");
    // eslint-disable-next-line no-console
    console.error(`[SAVE_ERROR_CAPTURE] ${context} → ${err instanceof Error ? err.message : String(err)}. Log written to ${SAVE_ERROR_LOG_PATH}`);
  } catch {
    // ignore write log error
  }
}

@Injectable()
export class WorkspaceDataService implements OnModuleInit, OnApplicationBootstrap {
  private schemaEnsured = false;
  private datasetCache: Partial<Record<DatasetKey, { cachedAt: number; rows: WorkspaceDatasetPayload[] }>> = {};
  private readonly DATASET_CACHE_TTL_MS = 45_000;
  /**
   * T4 K20 — runtimeCache diganti ke SharedCacheAdapter Redis-ready,
   * BUKAN lagi private Map yang tidak cross-worker sync saat PM2 reload/cluster.
   * Instance namespace = `wsdata_${pid}`; RedisUrl opsional dari env REDIS_URL.
   */
  private readonly runtimeCache: SharedCacheAdapter<unknown> = createSharedCacheAdapter({
    namespace: `wsdata_${process.pid}`,
    ttlMs: 30_000,
    maxEntries: 600,
    redisUrl: process.env.REDIS_URL ?? undefined,
  });
  private readonly RUNTIME_CACHE_TTL_MS = 30_000;
  private readonly logger = new Logger(WorkspaceDataService.name);

  private async writeRuntimeCache<T>(key: RuntimeCacheKey, value: T, customTtlMs?: number) {
    const effectiveTtlMs = customTtlMs ?? this.RUNTIME_CACHE_TTL_MS;
    await this.runtimeCache.set(String(key), value as unknown, effectiveTtlMs);
  }

  private async readRuntimeCache<T>(key: RuntimeCacheKey): Promise<T | null> {
    return (await this.runtimeCache.get(String(key))) as T | null;
  }

  private async invalidateRuntimeCache(key: RuntimeCacheKey | RuntimeCacheKey[]) {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) await this.runtimeCache.delete(String(k));
  }

  private async deleteRuntimeCacheByPrefix(prefix: string) {
    if (!prefix) return;
    await this.runtimeCache.deleteByPrefix(prefix);
  }

  private async invalidateProposalAndEquipmentCaches() {
    await this.runtimeCache.delete("proposal_bundles");
    await this.runtimeCache.delete("equipment_bundles");
    await this.deleteRuntimeCacheByPrefix("proposal_bundles::");
    await this.deleteRuntimeCacheByPrefix("equipment_bundles::");
    await this.runtimeCache.delete("school_lookup");
  }

  private async invalidateAllWorkspaceSummaryCaches() {
    await this.invalidateProposalAndEquipmentCaches();
  }

  private async clearRuntimeCaches() {
    this.datasetCache = {};
    await this.runtimeCache.clearAll();
  }

  // ===== Clean MVC Relational: Proposal PREPARATION groups + items (per halaman)
  // TABEL BARU: proposal_preparation_groups 1 → N proposal_preparation_items
  async getPreparations(params: { schoolNpsn: string; role: string }) {
    const { schoolNpsn, role } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      return { groups: [] as PreparationsGroupResult[], updatedAt: null as Date | null };
    }
    const sqlGroups = `
      SELECT id, group_uuid, name, sort_order, updated_at, created_at
      FROM public.proposal_preparation_groups
      WHERE npsn = $1
      ORDER BY sort_order ASC, id ASC
    `;
    const sqlItems = `
      SELECT i.group_id, i.item_uuid, i.description, i.quantity, i.unit_price, i.sort_order, i.updated_at
      FROM public.proposal_preparation_items i
      JOIN public.proposal_preparation_groups g ON g.id = i.group_id
      WHERE g.npsn = $1
      ORDER BY g.sort_order ASC, g.id ASC, i.sort_order ASC, i.id ASC
    `;
    const groupsRaw = await this.databaseService.query<any[]>(sqlGroups, [npsn]);
    const itemsRaw = await this.databaseService.query<any[]>(sqlItems, [npsn]);
    const groupsRows = normalizeRows<any>(groupsRaw);
    const itemsRows = normalizeRows<any>(itemsRaw);
    const byGroup = new Map<number, PreparationsItemResult[]>();
    for (const it of itemsRows) {
      const gid = Number(it.group_id);
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push({
        uuid: String(it.item_uuid),
        description: String(it.description ?? ""),
        quantity: Math.max(0, Number(it.quantity) || 0),
        unitPrice: Math.max(0, Number(it.unit_price) || 0),
      });
    }
    let updatedAt: Date | null = null;
    const groupsList = groupsRows.map<PreparationsGroupResult>((g) => {
      const up = g.updated_at ? new Date(g.updated_at) : null;
      if (up && (!updatedAt || up > updatedAt)) updatedAt = up;
      return {
        uuid: String(g.group_uuid),
        name: String(g.name ?? ""),
        items: byGroup.get(Number(g.id)) ?? [],
      };
    });
    void role;
    return { groups: groupsList, updatedAt };
  }

  async replacePreparations(params: {
    schoolNpsn: string;
    role: string;
    groups: PreparationsGroupPayload[];
  }) {
    const { schoolNpsn, groups: groupsIn } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      throw new Error("NPSN tidak valid untuk menyimpan data persiapan.");
    }
    const sanitizedGroups: PreparationsGroupPayload[] = Array.isArray(groupsIn)
      ? groupsIn.map<PreparationsGroupPayload>((g, gi) => {
          const safeUuid =
            typeof g.uuid === "string" && g.uuid.trim().length > 0
              ? g.uuid.trim().slice(0, 32)
              : `auto-${createId().slice(0, 18)}-${gi}`;
          const safeName = String(g.name ?? "").trim().slice(0, 255);
          const safeItems = Array.isArray(g.items)
            ? g.items.map<PreparationsItemPayload>((it, ii) => {
                const iu =
                  typeof it.uuid === "string" && it.uuid.trim().length > 0
                    ? it.uuid.trim().slice(0, 32)
                    : `${safeUuid}-it-${createId().slice(0, 8)}-${ii}`;
                return {
                  uuid: iu,
                  description: String(it.description ?? "").trim().slice(0, 500),
                  quantity: Math.max(0, Math.floor(Number(it.quantity) || 0)),
                  unitPrice: Math.max(0, Math.floor(Number(it.unitPrice) || 0)),
                };
              })
            : [];
          return { uuid: safeUuid, name: safeName, items: safeItems };
        })
      : [];

    const result = await this.databaseService.transaction(
      async (conn) => {
        const sumPersiapan = sanitizedGroups.reduce<number>(
          (s, g) =>
            s +
            (Array.isArray(g.items)
              ? g.items.reduce<number>(
                  (si, it) => si + Math.max(0, Number(it.quantity) || 0) * Math.max(0, Number(it.unitPrice) || 0),
                  0,
                )
              : 0),
          0,
        );
        await this.assertWithinPaguLimit(conn, npsn, "persiapan", sumPersiapan);
        // Delete dulu seluruh groups + items (ON DELETE CASCADE items ikut terhapus)
        await conn.execute(
          "DELETE FROM public.proposal_preparation_groups WHERE npsn = $1",
          [npsn],
        );
        let finalUpdatedAt: Date = new Date();
        for (let gi = 0; gi < sanitizedGroups.length; gi++) {
          const g = sanitizedGroups[gi];
          const insGroup = await conn.query<any[]>(
            `INSERT INTO public.proposal_preparation_groups
               (npsn, group_uuid, name, sort_order, updated_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$5)
             RETURNING id, updated_at`,
            [npsn, g.uuid, g.name, gi, finalUpdatedAt],
          );
          const insRows = normalizeRows<any>(insGroup);
          const insertedId = Number(insRows[0]?.id);
          if (insRows[0]?.updated_at) finalUpdatedAt = new Date(insRows[0].updated_at);
          if (!insertedId || !Number.isFinite(insertedId)) continue;
          for (let ii = 0; ii < g.items.length; ii++) {
            const it = g.items[ii];
            await conn.execute(
              `INSERT INTO public.proposal_preparation_items
                 (group_id, item_uuid, description, quantity, unit_price, sort_order, updated_at, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
              [insertedId, it.uuid, it.description, it.quantity, it.unitPrice, ii, finalUpdatedAt],
            );
          }
        }
        // Invalidate JSONB global key caches (jika masih ada yang baca dari workspace schema legacy)
        const cacheKey = `proposal:${npsn}`;
        try { await this.redisCacheService?.del(cacheKey); } catch { /* ignore */ }
        try { await this.runtimeCache.deleteByPrefix(`proposal:${npsn}`); } catch { /* ignore */ }
        return { ok: true, groupsCount: sanitizedGroups.length, updatedAt: finalUpdatedAt };
      },
      { isolationLevel: "SERIALIZABLE" },
    );
    return {
      ok: true,
      savedGroupsCount: result.groupsCount,
      savedItemsCount: sanitizedGroups.reduce<number>((s, g) => s + (Array.isArray(g.items) ? g.items.length : 0), 0),
      updatedAt: result.updatedAt,
    };
  }

  // ===== Clean MVC Relational: Proposal TRAINING COSTS (Biaya Pendukung Pelatihan 1,5%)
  // TABEL BARU: proposal_training_costs (flat 1-level, UUID per item)
  async getTrainingCosts(params: { schoolNpsn: string; role: string }) {
    const { schoolNpsn } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      return { costs: [] as TrainingCostResult[], totalCost: 0, updatedAt: null as Date | null };
    }
    const sql = `
      SELECT id, item_uuid, product_name, unit_price, requires_training, training_cost, sort_order, updated_at
      FROM public.proposal_training_costs
      WHERE npsn = $1
      ORDER BY sort_order ASC, id ASC
    `;
    const raw = await this.databaseService.query<any[]>(sql, [npsn]);
    const rows = normalizeRows<any>(raw);
    let updatedAt: Date | null = null;
    let total = 0;
    const costsList = rows.map<TrainingCostResult>((r) => {
      const up = r.updated_at ? new Date(r.updated_at) : null;
      if (up && (!updatedAt || up > updatedAt)) updatedAt = up;
      const unitP = Math.max(0, Number(r.unit_price) || 0);
      const reqT = Boolean(r.requires_training);
      let tCost = Math.max(0, Number(r.training_cost) || 0);
      if (reqT && tCost <= 0 && unitP > 0) tCost = Math.ceil((unitP * 15) / 1000);
      total += tCost;
      return {
        uuid: String(r.item_uuid),
        productName: String(r.product_name ?? ""),
        unitPrice: unitP,
        requiresTraining: reqT,
        trainingCost: tCost,
      };
    });
    void params.role;
    return { costs: costsList, totalCost: total, updatedAt };
  }

  async replaceTrainingCosts(params: {
    schoolNpsn: string;
    role: string;
    costs: TrainingCostPayload[];
  }) {
    const { schoolNpsn, costs: costsIn } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      throw new Error("NPSN tidak valid untuk menyimpan data biaya pelatihan.");
    }
    const sanitizedCosts: TrainingCostPayload[] = Array.isArray(costsIn)
      ? costsIn.map<TrainingCostPayload>((c, ci) => {
          const safeUuid =
            typeof c.uuid === "string" && c.uuid.trim().length > 0
              ? c.uuid.trim().slice(0, 32)
              : `auto-tr-${createId().slice(0, 16)}-${ci}`;
          const safeName = String(c.productName ?? "").trim().slice(0, 255);
          const unitP = Math.max(0, Math.floor(Number(c.unitPrice) || 0));
          const reqT = (c.requiresTraining as any) === true || (c.requiresTraining as any) === "true" || (c.requiresTraining as any) === 1 ? true : false;
          let tCost = Math.max(0, Math.floor(Number(c.trainingCost) || 0));
          if (reqT && tCost <= 0 && unitP > 0) tCost = Math.ceil((unitP * 15) / 1000);
          if (!reqT) tCost = 0;
          return { uuid: safeUuid, productName: safeName, unitPrice: unitP, requiresTraining: reqT, trainingCost: tCost };
        })
      : [];

    const result = await this.databaseService.transaction(
      async (conn) => {
        const sumTraining = sanitizedCosts.reduce<number>(
          (s, c) => s + Math.max(0, Number(c.trainingCost) || 0),
          0,
        );
        await this.assertWithinPaguLimit(conn, npsn, "pelatihan", sumTraining);
        await conn.execute(
          "DELETE FROM public.proposal_training_costs WHERE npsn = $1",
          [npsn],
        );
        let finalUpdatedAt: Date = new Date();
        for (let ci = 0; ci < sanitizedCosts.length; ci++) {
          const c = sanitizedCosts[ci];
          await conn.execute(
            `INSERT INTO public.proposal_training_costs
               (npsn, item_uuid, product_name, unit_price, requires_training, training_cost, sort_order, updated_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
            [npsn, c.uuid, c.productName, c.unitPrice, c.requiresTraining, c.trainingCost, ci, finalUpdatedAt],
          );
        }
        const cacheKey = `proposal:${npsn}`;
        try { await this.redisCacheService?.del(cacheKey); } catch { /* ignore */ }
        try { await this.runtimeCache.deleteByPrefix(`proposal:${npsn}`); } catch { /* ignore */ }
        return { ok: true, costsCount: sanitizedCosts.length, updatedAt: finalUpdatedAt };
      },
      { isolationLevel: "SERIALIZABLE" },
    );
    const total = sanitizedCosts.reduce<number>((s, c) => s + (c.trainingCost || 0), 0);
    return {
      ok: true,
      savedCostsCount: result.costsCount,
      totalTrainingCost: total,
      updatedAt: result.updatedAt,
    };
  }

  private async assertWithinPaguLimit(
    conn: DialectConnection,
    npsn: string,
    jenis: "persiapan" | "alat" | "pelatihan",
    nilaiTotalInput: number,
    tahunAjaran: string = "2026/2027",
  ): Promise<void> {
    const safeNpsn = String(npsn).trim();
    const safeNilai = Math.max(0, Math.floor(Number(nilaiTotalInput) || 0));
    const ta = String(tahunAjaran).trim() || "2026/2027";
    const rowsRaw = await conn.query<any[]>(
      `SELECT pagu_persiapan, pagu_alat, pagu_pelatihan, pagu_total
       FROM public.school_pagu_budgets
       WHERE npsn = $1 AND tahun_ajaran = $2
       LIMIT 1`,
      [safeNpsn, ta],
    );
    const rows = normalizeRows<any>(rowsRaw);
    const row = rows?.[0] ?? null;
    if (!row) return;
    const maxMap: Record<string, number> = {
      persiapan: Math.max(0, Number(row.pagu_persiapan) || 0),
      alat: Math.max(0, Number(row.pagu_alat) || 0),
      pelatihan: Math.max(0, Number(row.pagu_pelatihan) || 0),
    };
    const batasMax = maxMap[jenis];
    if (batasMax <= 0) return;
    if (safeNilai > batasMax) {
      const kelebihan = safeNilai - batasMax;
      const label =
        jenis === "persiapan"
          ? "Pagu Persiapan"
          : jenis === "alat"
            ? "Pagu Alat (RPKP)"
            : "Pagu Pelatihan";
      throw new BadRequestException(
        `${label} melebihi batas maksimum dari Dinas untuk NPSN ${safeNpsn}. ` +
          `Batas: Rp ${batasMax.toLocaleString("id-ID")}. ` +
          `Nilai diinput: Rp ${safeNilai.toLocaleString("id-ID")}. ` +
          `Kurangi Rp ${kelebihan.toLocaleString("id-ID")} agar bisa disimpan.`,
      );
    }
  }

  // ===== Clean MVCR Relational: PAGU SEKOLAH (PK composite NPSN + tahun_ajaran)
  // TABEL BARU: school_pagu_budgets — 3 pagu + 3 realisasi calc per NPSN per tahun ajaran

  public async getSchoolPagu(params: { schoolNpsn: string; tahunAjaran: string }) {
    const { schoolNpsn, tahunAjaran: taIn } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    const tahunAjaran = String(taIn ?? "").trim() || "2026/2027";
    if (!npsn || npsn.length < 8) {
      throw new ForbiddenException("NPSN tidak valid untuk membaca pagu sekolah.");
    }

    // Hitung ulang realisasi persiapan dari proposal_preparation_groups + items (Clean MVCR prep table)
    const realisasiPersiapanRaw = await this.databaseService.query<any[]>(
      `SELECT COALESCE(SUM(it.quantity * it.unit_price),0) AS total_p
       FROM public.proposal_preparation_groups g
       INNER JOIN public.proposal_preparation_items it ON it.group_id = g.id
       WHERE g.npsn = $1`,
      [npsn],
    );
    const realisasiPersiapanRows = normalizeRows<any>(realisasiPersiapanRaw);
    const realisasi_persiapan = Math.max(0, Number(realisasiPersiapanRows[0]?.total_p) || 0);

    // Hitung ulang realisasi pelatihan dari proposal_training_costs filter requires_training=TRUE
    const realisasiPelatihanRaw = await this.databaseService.query<any[]>(
      `SELECT COALESCE(SUM(training_cost),0) AS total_t
       FROM public.proposal_training_costs
       WHERE npsn = $1 AND requires_training IS TRUE`,
      [npsn],
    );
    const realisasiPelatihanRows = normalizeRows<any>(realisasiPelatihanRaw);
    const realisasi_pelatihan = Math.max(0, Number(realisasiPelatihanRows[0]?.total_t) || 0);

    // Realisasi alat: sementara COALESCE 0 (nanti P4 Clean MVCR alat selesai)
    const realisasi_alat = 0;

    // Baca row dari school_pagu_budgets composite PK (catatan: schema PAKAI set_at BUKAN created_at; realisasi_total juga ada kolomnya)
    const paguRaw = await this.databaseService.query<any[]>(
      `SELECT npsn, tahun_ajaran, pagu_persiapan, pagu_alat, pagu_pelatihan, pagu_total,
              realisasi_persiapan, realisasi_alat, realisasi_pelatihan, realisasi_total, status,
              set_by_admin_id, set_by_admin_name, set_at, updated_at
       FROM public.school_pagu_budgets
       WHERE npsn = $1 AND tahun_ajaran = $2
       LIMIT 1`,
      [npsn, tahunAjaran],
    );
    const paguRows = normalizeRows<SchoolPaguRow & { set_at: unknown; realisasi_total: unknown }>(paguRaw);
    const existing = paguRows[0] ?? null;

    let pagu_persiapan = 0, pagu_alat = 0, pagu_pelatihan = 0, pagu_total = 0;
    let status: PaguStatus = "DRAFT";
    let set_by_admin_id: string | null = null, set_by_admin_name: string | null = null;
    let createdAt: Date | null = null, updatedAt: Date | null = null;
    if (existing) {
      pagu_persiapan = Math.max(0, Number(existing.pagu_persiapan) || 0);
      pagu_alat = Math.max(0, Number(existing.pagu_alat) || 0);
      pagu_pelatihan = Math.max(0, Number(existing.pagu_pelatihan) || 0);
      pagu_total = Math.max(0, Number(existing.pagu_total) || 0);
      status = String(existing.status || "DRAFT") as PaguStatus;
      set_by_admin_id = existing.set_by_admin_id ?? null;
      set_by_admin_name = existing.set_by_admin_name ?? null;
      createdAt = (existing as any).set_at ? new Date((existing as any).set_at) : null;
      updatedAt = existing.updated_at ? new Date(existing.updated_at) : null;
    }

    // Enforce double-check: jika pagu_total DB tidak sinkron dengan a+b+c, overwrite dengan penjumlahan (DB CHECK constraint juga enforce)
    const expectedPaguTotal = pagu_persiapan + pagu_alat + pagu_pelatihan;
    if (pagu_total !== expectedPaguTotal) pagu_total = expectedPaguTotal;

    const realisasi_total = realisasi_persiapan + realisasi_alat + realisasi_pelatihan;
    return {
      ok: true,
      data: {
        npsn,
        tahunAjaran,
        pagu: {
          persiapan: pagu_persiapan,
          alat: pagu_alat,
          pelatihan: pagu_pelatihan,
          total: pagu_total,
        },
        realisasi: {
          persiapan: realisasi_persiapan,
          alat: realisasi_alat,
          pelatihan: realisasi_pelatihan,
          total: realisasi_total,
        },
        status,
        setByAdmin: {
          id: set_by_admin_id,
          name: set_by_admin_name,
        },
        createdAt,
        updatedAt,
      },
    };
  }

  public async replaceSchoolPagu(params: {
    schoolNpsn: string;
    tahunAjaran: string;
    paguPersiapan: number;
    paguAlat: number;
    paguPelatihan: number;
    status: PaguStatus;
    setByAdminId: string;
    setByAdminName: string;
  }) {
    const { schoolNpsn, tahunAjaran: taIn, paguPersiapan, paguAlat, paguPelatihan, status, setByAdminId, setByAdminName } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    const tahunAjaran = String(taIn ?? "").trim() || "2026/2027";
    if (!npsn || npsn.length < 8) {
      throw new ForbiddenException("NPSN tidak valid untuk menetapkan pagu sekolah.");
    }
    const pagu_p = Math.max(0, Math.floor(Number(paguPersiapan) || 0));
    const pagu_a = Math.max(0, Math.floor(Number(paguAlat) || 0));
    const pagu_t = Math.max(0, Math.floor(Number(paguPelatihan) || 0));
    const pagu_total = pagu_p + pagu_a + pagu_t;
    const statusSafe: PaguStatus = (["DRAFT","DITETAPKAN","LOCKED","DIPERPBAHARUI"] as readonly string[]).includes(String(status)) ? status : "DRAFT";
    const adminId = String(setByAdminId ?? "admin").slice(0, 64);
    const adminName = String(setByAdminName ?? "Admin Pusat").slice(0, 255);

    const result = await this.databaseService.transaction(
      async (conn) => {
        // SERIALIZABLE atomic DELETE→INSERT pola Clean MVCR (hindari race condition update in-place)
        await conn.execute(
          `DELETE FROM public.school_pagu_budgets WHERE npsn = $1 AND tahun_ajaran = $2`,
          [npsn, tahunAjaran],
        );

        // Hitung realisasi PERSIAPAN di dalam tx (snapshot SERIALIZABLE = konsisten)
        const prepRaw = await conn.query<any[]>(
          `SELECT COALESCE(SUM(it.quantity * it.unit_price),0) AS total_p
           FROM public.proposal_preparation_groups g
           INNER JOIN public.proposal_preparation_items it ON it.group_id = g.id
           WHERE g.npsn = $1`,
          [npsn],
        );
        const prepRows = normalizeRows<any>(prepRaw);
        const realisasi_p = Math.max(0, Number(prepRows[0]?.total_p) || 0);

        // Hitung realisasi PELATIHAN di dalam tx (filter requires_training TRUE)
        const trRaw = await conn.query<any[]>(
          `SELECT COALESCE(SUM(training_cost),0) AS total_t
           FROM public.proposal_training_costs
           WHERE npsn = $1 AND requires_training IS TRUE`,
          [npsn],
        );
        const trRows = normalizeRows<any>(trRaw);
        const realisasi_t = Math.max(0, Number(trRows[0]?.total_t) || 0);

        // Realisasi ALAT fallback 0 (sampai Modul 4 Alat Clean MVCR selesai — P4)
        const realisasi_a = 0;
        const finalUpdatedAt: Date = new Date();

        await conn.execute(
          `INSERT INTO public.school_pagu_budgets
             (npsn, tahun_ajaran, pagu_persiapan, pagu_alat, pagu_pelatihan, pagu_total,
              realisasi_persiapan, realisasi_alat, realisasi_pelatihan, realisasi_total, status,
              set_by_admin_id, set_by_admin_name, set_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [npsn, tahunAjaran, pagu_p, pagu_a, pagu_t, pagu_total,
           realisasi_p, realisasi_a, realisasi_t, realisasi_p + realisasi_a + realisasi_t, statusSafe,
           adminId, adminName, finalUpdatedAt, finalUpdatedAt],
        );

        // Triple Cache Invalidate: Redis → Runtime prefix → Proposal cache
        const paguCacheKey = `pagu:${npsn}`;
        try { await this.redisCacheService?.del(paguCacheKey); } catch { /* ignore */ }
        try { await this.runtimeCache.deleteByPrefix(`pagu:${npsn}`); } catch { /* ignore */ }
        const proposalCacheKey = `proposal:${npsn}`;
        try { await this.redisCacheService?.del(proposalCacheKey); } catch { /* ignore */ }
        try { await this.runtimeCache.deleteByPrefix(`proposal:${npsn}`); } catch { /* ignore */ }

        return { ok: true, savedAt: finalUpdatedAt, paguTotal: pagu_total, realisasiTotal: realisasi_p + realisasi_a + realisasi_t };
      },
      { isolationLevel: "SERIALIZABLE" },
    );
    return {
      ok: true,
      savedAt: result.savedAt,
      paguTotal: result.paguTotal,
      realisasiTotal: result.realisasiTotal,
      updatedAt: result.savedAt,
    };
  }

  public async getAdminPaguAnggaranList(params: { tahunAjaran: string }) {
    const tahunAjaran = String(params.tahunAjaran ?? "").trim() || "2026/2027";
    const raw = await this.databaseService.query<any[]>(
      `SELECT
         wsr.school_no AS no,
         wsr.province AS provinsi,
         wsr.school_npsn AS npsn,
         wsr.school_name AS nama_sekolah,
         COALESCE(spb.pagu_persiapan, 0) AS pagu_persiapan,
         COALESCE(spb.pagu_alat, 0) AS pagu_alat,
         COALESCE(spb.pagu_pelatihan, 0) AS pagu_pelatihan,
         (COALESCE(spb.pagu_persiapan, 0) + COALESCE(spb.pagu_alat, 0) + COALESCE(spb.pagu_pelatihan, 0)) AS pagu_total,
         COALESCE(spb.status, 'DRAFT') AS status,
         spb.tahun_ajaran AS tahun_ajaran
       FROM public.workspace_school_records wsr
       LEFT JOIN public.school_pagu_budgets spb
         ON spb.npsn = wsr.school_npsn
         AND spb.tahun_ajaran = $1
       WHERE wsr.dataset_key = 'ABT'
       ORDER BY wsr.school_no ASC`,
      [tahunAjaran],
    );
    const rows = normalizeRows<any>(raw);
    return {
      ok: true,
      tahunAjaran,
      count: rows.length,
      rows: rows.map((r) => ({
        no: Number(r.no) || 0,
        provinsi: String(r.provinsi ?? ""),
        npsn: String(r.npsn ?? ""),
        nama_sekolah: String(r.nama_sekolah ?? ""),
        pagu_persiapan: Math.max(0, Math.floor(Number(r.pagu_persiapan) || 0)),
        pagu_alat: Math.max(0, Math.floor(Number(r.pagu_alat) || 0)),
        pagu_pelatihan: Math.max(0, Math.floor(Number(r.pagu_pelatihan) || 0)),
        pagu_total: Math.max(0, Math.floor(Number(r.pagu_total) || 0)),
        status: String(r.status ?? "DRAFT"),
        tahun_ajaran: String(r.tahun_ajaran ?? tahunAjaran),
      })),
    };
  }

  public async isNpsnAbt(npsn: string): Promise<boolean> {
    const n = String(npsn ?? "").trim();
    if (!n || n.length < 8) return false;
    const raw = await this.databaseService.query<any[]>(
      `SELECT 1 AS exists_flag FROM public.workspace_school_records WHERE dataset_key = 'ABT' AND school_npsn = $1 LIMIT 1`,
      [n],
    );
    const rows = normalizeRows<any>(raw);
    return rows.length > 0;
  }

  // ===== ADMIN: KONSENTRASI REKOMENDASI ABT 132 (Top 5 row_order 1-5, Master 128 Options) =====
  public async getMaster128KonsentrasiOptions() {
    const raw = await this.databaseService.query<any[]>(
      `SELECT code, name FROM public.master_konsentrasi_keahlian ORDER BY code ASC, name ASC`,
      [],
    );
    const rows = normalizeRows<any>(raw);
    return {
      ok: true,
      count: rows.length,
      rows: rows.map((r) => ({
        code: String(r.code ?? "").trim(),
        name: String(r.name ?? "").trim(),
      })),
    };
  }

  public async getAdminKonsentrasiRekomendasiList() {
    const raw = await this.databaseService.query<any[]>(
      `WITH abt_schools AS (
         SELECT school_no AS no, province AS provinsi, school_npsn AS npsn, school_name AS nama_sekolah
         FROM public.workspace_school_records
         WHERE dataset_key = 'ABT'
       ),
       ranked_concentrations AS (
         SELECT
           spc.npsn,
           spc.concentration_code,
           spc.concentration_name,
           ROW_NUMBER() OVER (PARTITION BY spc.npsn ORDER BY spc.row_order ASC, spc.updated_at DESC) AS rn
         FROM public.school_profile_concentrations spc
         WHERE spc.row_order <= 5
       )
       SELECT
         abt.no,
         abt.provinsi,
         abt.npsn,
         abt.nama_sekolah,
         CASE WHEN k1.npsn IS NOT NULL THEN json_build_object('code', k1.concentration_code, 'name', k1.concentration_name) ELSE NULL END AS konsentrasi_1,
         CASE WHEN k2.npsn IS NOT NULL THEN json_build_object('code', k2.concentration_code, 'name', k2.concentration_name) ELSE NULL END AS konsentrasi_2,
         CASE WHEN k3.npsn IS NOT NULL THEN json_build_object('code', k3.concentration_code, 'name', k3.concentration_name) ELSE NULL END AS konsentrasi_3,
         CASE WHEN k4.npsn IS NOT NULL THEN json_build_object('code', k4.concentration_code, 'name', k4.concentration_name) ELSE NULL END AS konsentrasi_4,
         CASE WHEN k5.npsn IS NOT NULL THEN json_build_object('code', k5.concentration_code, 'name', k5.concentration_name) ELSE NULL END AS konsentrasi_5
       FROM abt_schools abt
       LEFT JOIN ranked_concentrations k1 ON k1.npsn = abt.npsn AND k1.rn = 1
       LEFT JOIN ranked_concentrations k2 ON k2.npsn = abt.npsn AND k2.rn = 2
       LEFT JOIN ranked_concentrations k3 ON k3.npsn = abt.npsn AND k3.rn = 3
       LEFT JOIN ranked_concentrations k4 ON k4.npsn = abt.npsn AND k4.rn = 4
       LEFT JOIN ranked_concentrations k5 ON k5.npsn = abt.npsn AND k5.rn = 5
       ORDER BY abt.no ASC`,
      [],
    );
    const rows = normalizeRows<any>(raw);
    const parseKonsentrasi = (val: any) => {
      if (!val) return null;
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { return null; }
      }
      if (val && typeof val === "object" && val.code && String(val.code).trim()) {
        return { code: String(val.code).trim(), name: String(val.name ?? "").trim() };
      }
      return null;
    };
    return {
      ok: true,
      count: rows.length,
      rows: rows.map((r) => ({
        no: Number(r.no) || 0,
        provinsi: String(r.provinsi ?? ""),
        npsn: String(r.npsn ?? ""),
        nama_sekolah: String(r.nama_sekolah ?? ""),
        konsentrasi_1: parseKonsentrasi(r.konsentrasi_1),
        konsentrasi_2: parseKonsentrasi(r.konsentrasi_2),
        konsentrasi_3: parseKonsentrasi(r.konsentrasi_3),
        konsentrasi_4: parseKonsentrasi(r.konsentrasi_4),
        konsentrasi_5: parseKonsentrasi(r.konsentrasi_5),
      })),
    };
  }

  public async replace5KonsentrasiRekomendasiPerSekolah(params: {
    schoolNpsn: string;
    codes5: string[];
    setById?: string;
    setByName?: string;
  }) {
    const npsn = String(params.schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      throw new Error("NPSN tidak valid.");
    }
    const codes5 = (params.codes5 ?? []).slice(0, 5);
    while (codes5.length < 5) codes5.push("");
    const sanitizedCodes = codes5.map((c) => String(c ?? "").trim());

    if (!(await this.isNpsnAbt(npsn))) {
      throw new Error("NPSN " + npsn + " bukan sekolah ABT (tidak terdaftar di dataset_key=ABT).");
    }

    const masterLookupRaw = await this.databaseService.query<any[]>(
      `SELECT code, name FROM public.master_konsentrasi_keahlian`,
      [],
    );
    const masterLookup = new Map<string, string>();
    for (const r of normalizeRows<any>(masterLookupRaw)) {
      masterLookup.set(String(r.code ?? "").trim(), String(r.name ?? "").trim());
    }

    const lookupResults: Array<{ code: string; name: string } | null> = sanitizedCodes.map((code) => {
      if (!code) return null;
      const name = masterLookup.get(code);
      if (!name) {
        throw new Error("Kode konsentrasi '" + code + "' tidak ditemukan di master (128 konsentrasi).");
      }
      return { code, name };
    });

    const nowIso = new Date();
    const savedRows: any[] = [];

    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `DELETE FROM public.school_profile_concentrations WHERE npsn = $1 AND row_order <= 5`,
        [npsn],
      );

      for (let i = 0; i < 5; i++) {
        const lookup = lookupResults[i];
        const rowOrder = i + 1;
        if (!lookup) continue;

        const id = createId();
        await connection.execute(
          `INSERT INTO public.school_profile_concentrations
             (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12,
              student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 0, 0, 0, 0, '', $5, $6, $6)`,
          [id, npsn, lookup.code, lookup.name, rowOrder, nowIso],
        );
        savedRows.push({ id, row_order: rowOrder, code: lookup.code, name: lookup.name });
      }
    });

    return { ok: true, npsn, savedAt: nowIso, savedRows };
  }

  // ===== Clean MVCR Relational: REVIEW COMMENTS (Domain scope per role UML SOP)
  // TABEL BARU: school_data_review_comments PK UUID, FK npsn → schools.npsn CASCADE
  public async listReviewCommentsForSchool(params: { schoolNpsn: string }) {
    const { schoolNpsn } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      return { byDomain: {} as Record<ReviewDomainScope, SchoolReviewCommentRow[]>, unresolvedCount: 0, totalCount: 0 };
    }
    const raw = await this.databaseService.query<any[]>(
      `SELECT comment_id, npsn, domain_scope, record_ref, commenter_role, commenter_user_id,
              commenter_name, comment_text, severity, is_resolved, resolved_by_user_id,
              resolved_at, created_at, updated_at
       FROM public.school_data_review_comments
       WHERE npsn = $1
       ORDER BY created_at DESC, comment_id DESC`,
      [npsn],
    );
    const rows = normalizeRows<SchoolReviewCommentRow>(raw);
    const byDomain = {} as Record<ReviewDomainScope, SchoolReviewCommentRow[]>;
    let unresolvedCount = 0;
    for (const r of rows) {
      const scope = String(r.domain_scope || "LAINNYA") as ReviewDomainScope;
      if (!byDomain[scope]) byDomain[scope] = [];
      byDomain[scope].push(r);
      if (!r.is_resolved) unresolvedCount++;
    }
    return { byDomain, unresolvedCount, totalCount: rows.length };
  }

  public async addReviewComment(params: {
    schoolNpsn: string;
    domainScope: ReviewDomainScope;
    recordRef?: string | null;
    commenterRole: ReviewCommenterRole;
    commenterUserId: string;
    commenterName: string;
    commentText: string;
    severity: ReviewSeverity;
  }) {
    const {
      schoolNpsn, domainScope, recordRef,
      commenterRole, commenterUserId, commenterName, commentText, severity,
    } = params;
    const npsn = String(schoolNpsn ?? "").trim();
    if (!npsn || npsn.length < 8) {
      throw new ForbiddenException("NPSN tidak valid untuk menambah review comment.");
    }
    // Pastikan NPSN benar-benar ada di schools sebelum insert comment
    const schoolRaw = await this.databaseService.query<any[]>(
      `SELECT npsn FROM schools WHERE npsn = $1 LIMIT 1`,
      [npsn],
    );
    const schoolRows = normalizeRows<any>(schoolRaw);
    if (!schoolRows[0]) {
      throw new NotFoundException("Sekolah dengan NPSN " + npsn + " tidak ditemukan.");
    }

    const scopeSafe = String(domainScope || "LAINNYA").slice(0, 32) as ReviewDomainScope;
    const recordRefSafe = typeof recordRef === "string" && recordRef.trim() ? recordRef.trim().slice(0, 128) : null;
    const cRoleSafe = String(commenterRole || "ADMIN").slice(0, 32) as ReviewCommenterRole;
    const cUserIdSafe = String(commenterUserId || ("anon-" + Date.now())).slice(0, 64);
    const cNameSafe = String(commenterName || "Anonim").slice(0, 255);
    const cTextSafe = String(commentText || "").trim().slice(0, 4000);
    if (!cTextSafe) {
      throw new ConflictException("Isi komentar tidak boleh kosong.");
    }
    const severitySafe = (["INFO","WARNING","WAJIB_PERBAIKI","APPROVE"] as readonly string[]).includes(String(severity))
      ? String(severity) as ReviewSeverity
      : "INFO";

    const result = await this.databaseService.transaction(
      async (conn) => {
        const createdAt: Date = new Date();
        // Explicit UUID via crypto.randomUUID() — SSOT di app-layer, tidak bergantung DB RETURNING extraction
        const newCommentId: string = randomUUID();
        await conn.execute(
          `INSERT INTO public.school_data_review_comments
             (comment_id, npsn, domain_scope, record_ref, commenter_role, commenter_user_id,
              commenter_name, comment_text, severity, is_resolved, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, FALSE, $10,$10)`,
          [newCommentId, npsn, scopeSafe, recordRefSafe, cRoleSafe, cUserIdSafe, cNameSafe, cTextSafe, severitySafe, createdAt],
        );
        // Invalidate cache review + proposal untuk sekolah ini
        const reviewCacheKey = `review:${npsn}`;
        try { await this.redisCacheService?.del(reviewCacheKey); } catch { /* ignore */ }
        try { await this.runtimeCache.deleteByPrefix(`review:${npsn}`); } catch { /* ignore */ }
        const proposalCacheKey = `proposal:${npsn}`;
        try { await this.redisCacheService?.del(proposalCacheKey); } catch { /* ignore */ }
        try { await this.runtimeCache.deleteByPrefix(`proposal:${npsn}`); } catch { /* ignore */ }
        return { ok: true, commentId: newCommentId, createdAt };
      },
      { isolationLevel: "SERIALIZABLE" },
    );
    return {
      ok: true,
      commentId: result.commentId,
      createdAt: result.createdAt,
    };
  }

  public async resolveReviewComment(params: {
    commentId: string;
    isResolved: boolean;
    actorRole: string;
    actorUserId: string;
    actorNpsn: string;
    isAdminActor: boolean;
  }) {
    const { commentId, isResolved, actorRole, actorUserId, actorNpsn, isAdminActor } = params;
    const cid = String(commentId ?? "").trim();
    if (!cid || cid.length < 4) {
      throw new NotFoundException("Comment ID tidak valid.");
    }
    // Baca comment dulu untuk cek ownership RULE
    const raw = await this.databaseService.query<any[]>(
      `SELECT comment_id, npsn, commenter_role, commenter_user_id, is_resolved
       FROM public.school_data_review_comments
       WHERE comment_id = $1
       LIMIT 1`,
      [cid],
    );
    const rows = normalizeRows<SchoolReviewCommentRow>(raw);
    const comment = rows[0];
    if (!comment) {
      throw new NotFoundException("Komentar dengan ID " + cid + " tidak ditemukan.");
    }
    const actorNpsnSafe = String(actorNpsn || "").trim();
    const actorRoleSafe = String(actorRole || "").toUpperCase();
    const actorUserIdSafe = String(actorUserId || "").slice(0, 64);
    const isResolvedSafe = typeof isResolved === "boolean" ? isResolved : true;

    // ============== OWNERSHIP RULE (UML SOP) — JANGAN DIUBAH SEMBARANGAN ==============
    // (a) ADMIN / SUPERADMIN / KOORDINATOR_ALAT → boleh resolve SEMUA comment
    const isAllPowerfulAdmin =
      actorRoleSafe === "ADMIN" ||
      actorRoleSafe === "SUPERADMIN" ||
      actorRoleSafe === "KOORDINATOR_ALAT";
    if (isAllPowerfulAdmin) {
      // lolos owner check
    } else if (actorRoleSafe === "SEKOLAH") {
      // (b) SEKOLAH — hanya boleh resolve comment milik sekolahnya sendiri (comment.npsn == actorNpsn)
      if (String(comment.npsn) !== actorNpsnSafe || !actorNpsnSafe) {
        throw new ForbiddenException("Akun SEKOLAH hanya bisa resolve komentar milik sekolah sendiri.");
      }
    } else if (actorRoleSafe === "FASILITATOR_ALAT" || actorRoleSafe === "FASILITATOR_ADMINISTRASI") {
      // (c) FASILITATOR (Alat/Admin) — hanya boleh resolve comment YANG DIBUAT OLEH DIRINYA SENDIRI
      if (String(comment.commenter_user_id) !== actorUserIdSafe || !actorUserIdSafe) {
        throw new ForbiddenException(
          "Fasilitator hanya bisa menandai resolve komentar yang Anda buat sendiri (commenter_user_id != actor).",
        );
      }
    } else if (!isAdminActor) {
      // (d) fallback unknown role → forbidded kecuali flag isAdminActor (emergency)
      throw new ForbiddenException("Role " + actorRoleSafe + " tidak memiliki izin resolve komentar.");
    }

    const result = await this.databaseService.transaction(
      async (conn) => {
        const resolvedAt: Date = new Date();
        const resolvedBySafe = actorUserIdSafe || ("system-" + Date.now());
        await conn.execute(
          `UPDATE public.school_data_review_comments
           SET is_resolved = $1, resolved_at = $2, resolved_by_user_id = $3, updated_at = $2
           WHERE comment_id = $4`,
          [isResolvedSafe, resolvedAt, resolvedBySafe, cid],
        );
        // Invalidate cache review + proposal sekolah pemilik comment
        const ownerNpsn = String(comment.npsn || "").trim();
        if (ownerNpsn) {
          const reviewCacheKey = `review:${ownerNpsn}`;
          try { await this.redisCacheService?.del(reviewCacheKey); } catch { /* ignore */ }
          try { await this.runtimeCache.deleteByPrefix(`review:${ownerNpsn}`); } catch { /* ignore */ }
          const proposalCacheKey = `proposal:${ownerNpsn}`;
          try { await this.redisCacheService?.del(proposalCacheKey); } catch { /* ignore */ }
          try { await this.runtimeCache.deleteByPrefix(`proposal:${ownerNpsn}`); } catch { /* ignore */ }
        }
        return { ok: true, isResolved: isResolvedSafe, updatedAt: resolvedAt };
      },
      { isolationLevel: "SERIALIZABLE" },
    );
    return {
      ok: true,
      isResolved: result.isResolved,
      updatedAt: result.updatedAt,
    };
  }

  private static _globalSingletonInstance: WorkspaceDataService | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService?: RedisCacheService,
  ) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) WorkspaceDataService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): WorkspaceDataService | null {
    const inst = WorkspaceDataService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): WorkspaceDataService {
    const existing = WorkspaceDataService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new WorkspaceDataService(db);
    WorkspaceDataService._globalSingletonInstance = fresh;
    return fresh;
  }

  private getNpsnForCacheKey(npsnRaw: string): string {
    return String(npsnRaw || "").trim();
  }

  private async findNpsnBySchoolId(schoolId: string): Promise<string | null> {
    const rows = await this.databaseService.query<(RowDataPacket & { npsn: string | null })[]>(
      "SELECT npsn FROM schools WHERE npsn = ? LIMIT 1",
      [schoolId],
    );
    return rows[0]?.npsn ?? null;
  }

  private async findSchoolIdByNpsnInternal(npsn: string): Promise<string | null> {
    const rows = await this.databaseService.query<(RowDataPacket & { id: string | null })[]>(
      "SELECT npsn AS id FROM schools WHERE npsn = ? LIMIT 1",
      [npsn],
    );
    return rows[0]?.id ?? null;
  }

  async getWorkspaceData(
    npsn: string,
    scope: "proposal" | "equipment",
  ): Promise<{ proposalTables: unknown; rpkpSelections: unknown; updatedAt: string | null } | { equipmentTables: unknown; updatedAt: string | null }> {
    const normNpsn = this.getNpsnForCacheKey(npsn);
    const cacheKey = `${scope}:${normNpsn}`;
    const fetcher = async () => {
      if (scope === "proposal") {
        return this.getSchoolProposalByNpsnInternal(normNpsn);
      }
      return this.getSchoolEquipmentByNpsnInternal(normNpsn);
    };
    if (this.redisCacheService) {
      return this.redisCacheService.tryGetOrFallback(cacheKey, fetcher, 60);
    }
    return fetcher();
  }

  private async getSchoolProposalByNpsnInternal(npsnRaw: string) {
    const normNpsn = String(npsnRaw || "").trim();
    if (!normNpsn) {
      throw new NotFoundException("NPSN harus diisi.");
    }
    return this.getSchoolProposalByNpsnDB(normNpsn);
  }

  private async getSchoolEquipmentByNpsnInternal(npsnRaw: string) {
    const normNpsn = String(npsnRaw || "").trim();
    if (!normNpsn) {
      throw new NotFoundException("NPSN harus diisi.");
    }
    return this.getSchoolEquipmentByNpsnDB(normNpsn);
  }

  private async invalidateWorkspaceCacheByNpsn(npsnRaw: string, scopes?: Array<"proposal" | "equipment">) {
    if (!this.redisCacheService) return;
    const normNpsn = this.getNpsnForCacheKey(npsnRaw);
    const targetScopes = scopes && scopes.length > 0 ? scopes : (["proposal", "equipment"] as const);
    for (const scope of targetScopes) {
      const cacheKey = `${scope}:${normNpsn}`;
      await this.redisCacheService.del(cacheKey);
    }
  }

  private async invalidateWorkspaceCacheBySchoolId(schoolId: string, scopes?: Array<"proposal" | "equipment">) {
    if (!this.redisCacheService) return;
    try {
      const npsn = await this.findNpsnBySchoolId(schoolId);
      if (npsn) {
        await this.invalidateWorkspaceCacheByNpsn(npsn, scopes);
      }
    } catch {
    }
  }

  async onModuleInit() {
    if (this.schemaEnsured) return;
    await this.ensureSchema();
    this.schemaEnsured = true;
  }

  async onApplicationBootstrap() {
    if (this.schemaEnsured) return;
    const tryOnce = async () => {
      try {
        const canQuery = typeof this.databaseService?.query === "function";
        if (!canQuery) return false;
        const [row] = await this.databaseService.query<RowDataPacket[]>(`SELECT 1 AS ok`);
        if (!row?.[0]?.ok) return false;
      } catch {
        return false;
      }
      await this.ensureSchema();
      this.schemaEnsured = true;
      return true;
    };
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (await tryOnce()) return;
      await new Promise((r) => setTimeout(r, attempt * 400));
    }
    this.logger.warn("[ensureSchema:onApplicationBootstrap] ⚠️ DB belum siap setelah 5 retry; skip ensure schema.");
  }

  async getAdminSelectionData(params?: {
    datasetKey?: "REGULER" | "ABT" | "ALL";
    scope?: "full" | "light";
    schoolNpsn?: string;
  }) {
    const wantDatasetKey: "ALL" | "REGULER" | "ABT" =
      params?.datasetKey === "REGULER" || params?.datasetKey === "ABT"
        ? params.datasetKey
        : "ALL";
    const isLight = params?.scope === "light";
    const specificNpsn = params?.schoolNpsn?.trim() || undefined;
    const normSpecificNpsn = specificNpsn ? normalizeText(specificNpsn) : undefined;

    const tasks: Array<Promise<unknown>> = [];
    const wantReguler = wantDatasetKey === "ALL" || wantDatasetKey === "REGULER";
    const wantAbt = wantDatasetKey === "ALL" || wantDatasetKey === "ABT";
    const wantDetails = !isLight;

    let regulerRowsPromise: Promise<WorkspaceDatasetPayload[]>;
    let abtRowsPromise: Promise<WorkspaceDatasetPayload[]>;
    if (normSpecificNpsn) {
      regulerRowsPromise = wantReguler
        ? this.readMergedDatasetRows("REGULER").then((rows) =>
            rows.filter((r) => normalizeText(r.npsn) === normSpecificNpsn),
          )
        : Promise.resolve<WorkspaceDatasetPayload[]>([]);
      abtRowsPromise = (
        wantAbt
          ? this.readDatasetRows("ABT").then((rows) =>
              rows.filter((r) => normalizeText(r.npsn) === normSpecificNpsn),
            )
          : Promise.resolve<WorkspaceDatasetPayload[]>([])
      ) as Promise<WorkspaceDatasetPayload[]>;
    } else {
      regulerRowsPromise = wantReguler
        ? this.readMergedDatasetRows("REGULER")
        : Promise.resolve<WorkspaceDatasetPayload[]>([]);
      abtRowsPromise = (
        wantAbt ? this.readDatasetRows("ABT") : Promise.resolve<WorkspaceDatasetPayload[]>([])
      ) as Promise<WorkspaceDatasetPayload[]>;
    }
    const interviewPromise: Promise<InterviewAssessmentPayload[]> = wantDetails
      ? this.readInterviewAssessments().then((rows) =>
          normSpecificNpsn ? rows.filter((r) => normalizeText(r.schoolNpsn) === normSpecificNpsn) : rows,
        )
      : Promise.resolve([]);
    const bimtekPromise: Promise<BimtekReviewPayload[]> = wantDetails
      ? this.readBimtekReviews().then((rows) =>
          normSpecificNpsn ? rows.filter((r) => normalizeText(r.schoolNpsn) === normSpecificNpsn) : rows,
        )
      : Promise.resolve([]);
    const verifikasiPromise: Promise<VerifikasiOnlineReviewRecord[]> = wantDetails
      ? this.readVerifikasiOnlineReviews().then((rows) =>
          normSpecificNpsn ? rows.filter((r) => normalizeText(r.schoolNpsn) === normSpecificNpsn) : rows,
        )
      : Promise.resolve([]);
    const schoolLookupPromise = normSpecificNpsn
      ? this.readSchoolLookup().then((rows) =>
          rows.filter((r) => normalizeText(r.npsn) === normSpecificNpsn),
        )
      : this.readSchoolLookup();

    tasks.push(
      regulerRowsPromise,
      abtRowsPromise,
      interviewPromise,
      bimtekPromise,
      verifikasiPromise,
      schoolLookupPromise,
    );

    const [regulerRows, abtRows, interviewResults, bimtekReviews, verifikasiOnlineReviews, schoolLookup] =
      (await Promise.all(tasks)) as [
        WorkspaceDatasetPayload[],
        WorkspaceDatasetPayload[],
        InterviewAssessmentPayload[],
        BimtekReviewPayload[],
        VerifikasiOnlineReviewRecord[],
        SchoolLookupRow[],
      ];

    const schoolIdByNpsn = new Map(
      schoolLookup.map((row: SchoolLookupRow) => [normalizeText(row.npsn), row.id]),
    );

    const schoolLookupNpsnSet = new Set<string>();
    if (normSpecificNpsn) {
      schoolLookupNpsnSet.add(normSpecificNpsn);
    } else if (wantDetails) {
      for (const npsn of regulerRows.map((r) => normalizeText(r.npsn))) if (npsn) schoolLookupNpsnSet.add(npsn);
      for (const npsn of abtRows.map((r) => normalizeText(r.npsn))) if (npsn) schoolLookupNpsnSet.add(npsn);
    }

    let proposalBundles: Record<string, ProposalBundleEntry> = {};
    let equipmentBundles: Record<string, EquipmentBundleEntry> = {};
    if (wantDetails) {
      const npsnCount = schoolLookupNpsnSet.size;
      const needFullBundles = npsnCount >= 80 && !normSpecificNpsn && wantDatasetKey === "ALL";
      if (needFullBundles) {
        // Hanya load 920MB full bundle jika NPSN > 80 (laporan halaman admin besar)
        const [proposalAll, equipmentAll] = await Promise.all([this.readProposalBundles(), this.readEquipmentBundles()]);
        const needAll = !normSpecificNpsn && wantDatasetKey === "ALL";
        if (needAll) {
          proposalBundles = proposalAll;
          equipmentBundles = equipmentAll;
        } else {
          for (const npsn of schoolLookupNpsnSet) {
            if (proposalAll[npsn]) proposalBundles[npsn] = proposalAll[npsn];
            if (equipmentAll[npsn]) equipmentBundles[npsn] = equipmentAll[npsn];
          }
        }
      } else {
        // ✅ OPTIMIZATION: Filter di DATABASE (WHERE npsn IN list) — pakai function FILTERED 11MB bukan 920MB!
        const [filteredProposal, filteredEquipment] = await Promise.all([
          this.readProposalBundlesFiltered(schoolLookupNpsnSet),
          this.readEquipmentBundlesFiltered(schoolLookupNpsnSet),
        ]);
        if (normSpecificNpsn || wantDatasetKey === "ALL") {
          proposalBundles = filteredProposal;
          equipmentBundles = filteredEquipment;
        } else {
          for (const npsn of schoolLookupNpsnSet) {
            if (filteredProposal[npsn]) proposalBundles[npsn] = filteredProposal[npsn];
            if (filteredEquipment[npsn]) equipmentBundles[npsn] = filteredEquipment[npsn];
          }
        }
      }
    }

    return {
      regulerRows: regulerRows.map((row) => ({
        ...row,
        schoolId: schoolIdByNpsn.get(normalizeText(row.npsn)) ?? null,
      })),
      abtRows: abtRows.map((row) => ({
        ...row,
        schoolId: schoolIdByNpsn.get(normalizeText(row.npsn)) ?? null,
      })),
      interviewResults,
      bimtekReviews,
      verifikasiOnlineReviews,
      proposalBundles,
      equipmentBundles,
    };
  }

  async getAssignmentSourceRows(sourceTab: SourceTabKey) {
    const datasetKey: DatasetKey = sourceTab === "abt" ? "ABT" : "REGULER";
    const rows = await this.readDatasetRows(datasetKey);
    return rows.map((row, index) => ({
      no: Number(row.no ?? index + 1),
      npsn: row.npsn,
      nama_sekolah: row.nama_sekolah,
      provinsi: row.provinsi ?? "",
      kab_kota: row.kab_kota ?? "",
      kecamatan: row.kecamatan ?? "",
      catatan: row.catatan ?? "",
      status_penerima_abt: row.status_penerima_abt ?? false,
      fasilitator_administrasi: row.fasilitator_administrasi ?? "",
      fasilitator_peralatan: row.fasilitator_peralatan ?? "",
    }));
  }

  async getRpkpReport(params?: { schoolNpsn?: string }) {
    const normNpsn = params?.schoolNpsn ? normalizeText(params.schoolNpsn) : undefined;
    const schoolLookup = await this.readSchoolLookup();
    const byId: Map<string, { npsn: string; name: string }> = new Map();
    const byNpsn: Map<string, { id: string; name: string }> = new Map();
    for (const s of schoolLookup) {
      const n = normalizeText(s.npsn);
      if (n) {
        byId.set(s.id, { npsn: s.npsn, name: s.name });
        byNpsn.set(n, { id: s.id, name: s.name });
      }
    }
    const proposalBundles = await this.readProposalBundles();
    type ShopQuote = {
      name?: unknown;
      priceWithTax?: unknown;
      shippingCost?: unknown;
      installationCost?: unknown;
      totalPrice?: unknown;
      link?: unknown;
    };
    type ProposalRowObj = {
      id?: unknown;
      name?: unknown;
      specification?: unknown;
      conformity?: unknown;
      quantity?: unknown;
      unit?: unknown;
      functionText?: unknown;
      shop1?: ShopQuote;
      shop2?: ShopQuote;
      shop3?: ShopQuote;
    };
    type ShopKey = "shop1" | "shop2" | "shop3";
    const toNumber = (v: unknown): number => {
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return Number.isFinite(v) ? v : 0;
      const s = String(v).replace(/[^\d]/g, "");
      if (!s) return 0;
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };
    const toStringOrDash = (v: unknown): string => {
      if (v === null || v === undefined) return "-";
      const s = String(v).trim();
      return s ? s : "-";
    };
    const toIntString = (v: unknown): string => {
      if (v === null || v === undefined) return "0";
      if (typeof v === "number") return String(Math.floor(Number.isFinite(v) ? v : 0));
      const s = String(v).replace(/[^\d]/g, "");
      return s || "0";
    };
    const shopLabel: Record<ShopKey, string> = {
      shop1: "Toko 1",
      shop2: "Toko 2",
      shop3: "Toko 3",
    };
    const items: Array<{
      schoolId: string;
      schoolNpsn: string;
      schoolName: string;
      concentrationCode: string;
      concentrationName: string;
      itemRowId: string;
      itemName: string;
      specification: string;
      conformity: string;
      quantity: string;
      unit: string;
      selectedShop: ShopKey | string;
      selectedShopLabel: string;
      selectedShopName: string;
      selectedPriceWithTaxRp: number;
      selectedShippingCostRp: number;
      selectedInstallationCostRp: number;
      selectedSatuanTotalRp: number;
      selectedLineTotalRp: number;
      selectedShopLink: string;
      dataUpdatedAt: string | null;
    }> = [];
    let sekolahDenganRpkpCount = 0;
    let sekolahDenganProposalCount = 0;
    for (const [npsn, bundle] of Object.entries(proposalBundles)) {
      if (normNpsn && npsn !== normNpsn) continue;
      const info = byNpsn.get(npsn);
      if (!info) continue;
      const tables = bundle.proposalTables;
      const selections = bundle.rpkpSelections;
      const isTablesObj = !!tables && typeof tables === "object" && !Array.isArray(tables);
      const isSelectionsObj = !!selections && typeof selections === "object" && !Array.isArray(selections);
      if (!isTablesObj) continue;
      sekolahDenganProposalCount += 1;
      const tablesMap = tables as Record<string, unknown>;
      const selectionsMap = isSelectionsObj ? (selections as Record<string, unknown>) : {};
      const rpkpPicks = Object.keys(selectionsMap).length > 0;
      if (rpkpPicks) sekolahDenganRpkpCount += 1;
      for (const [concentrationCode, rowsValue] of Object.entries(tablesMap)) {
        const rows = Array.isArray(rowsValue) ? (rowsValue as unknown[]) : [];
        const forThisTable = (selectionsMap[concentrationCode] ?? {}) as Record<string, unknown>;
        const konsentrasiName =
          typeof forThisTable["__meta_name"] === "string" && forThisTable["__meta_name"].trim()
            ? forThisTable["__meta_name"].trim()
            : concentrationCode;
        for (const rowRaw of rows) {
          if (!rowRaw || typeof rowRaw !== "object" || Array.isArray(rowRaw)) continue;
          const row = rowRaw as ProposalRowObj;
          const rowId = typeof row.id === "string" && row.id.trim() ? row.id : "";
          if (!rowId) continue;
          const pickedRaw =
            (forThisTable[rowId] as ShopKey | string | undefined) ?? undefined;
          const pickedShop: ShopKey | null =
            pickedRaw === "shop1" || pickedRaw === "shop2" || pickedRaw === "shop3" ? pickedRaw : null;
          if (!pickedShop) continue;
          const quote = (row[pickedShop] ?? {}) as ShopQuote;
          const qty = toNumber(row.quantity);
          const hargaSatuan =
            toNumber(quote.priceWithTax) +
            toNumber(quote.shippingCost) +
            toNumber(quote.installationCost);
          const lineTotal = toNumber(quote.totalPrice) || hargaSatuan * qty;
          items.push({
            schoolId: info.id,
            schoolNpsn: info.id ? (byId.get(info.id)?.npsn ?? info.id) : (byId.get(info.id)?.npsn ?? "-"),
            schoolName: info.name ?? "-",
            concentrationCode,
            concentrationName: konsentrasiName,
            itemRowId: rowId,
            itemName: toStringOrDash(row.name),
            specification: toStringOrDash(row.specification),
            conformity: toStringOrDash(row.conformity),
            quantity: toIntString(row.quantity),
            unit: toStringOrDash(row.unit),
            selectedShop: pickedShop,
            selectedShopLabel: shopLabel[pickedShop],
            selectedShopName: toStringOrDash(quote.name),
            selectedPriceWithTaxRp: toNumber(quote.priceWithTax),
            selectedShippingCostRp: toNumber(quote.shippingCost),
            selectedInstallationCostRp: toNumber(quote.installationCost),
            selectedSatuanTotalRp: hargaSatuan,
            selectedLineTotalRp: lineTotal,
            selectedShopLink: toStringOrDash(quote.link),
            dataUpdatedAt: bundle.updatedAt,
          });
        }
      }
    }
    let totalNilaiRpkp = 0;
    let totalItemRpkp = 0;
    const aggBySchoolNpsn: Record<string, {
      schoolId: string;
      schoolNpsn: string;
      schoolName: string;
      totalItems: number;
      totalNilai: number;
      konsentrasiCount: number;
    }> = {};
    const konsentrasiSetPerSchool: Record<string, Set<string>> = {};
    for (const it of items) {
      totalNilaiRpkp += it.selectedLineTotalRp;
      totalItemRpkp += 1;
      if (!aggBySchoolNpsn[it.schoolNpsn]) {
        aggBySchoolNpsn[it.schoolNpsn] = {
          schoolId: it.schoolId,
          schoolNpsn: it.schoolNpsn,
          schoolName: it.schoolName,
          totalItems: 0,
          totalNilai: 0,
          konsentrasiCount: 0,
        };
        konsentrasiSetPerSchool[it.schoolNpsn] = new Set();
      }
      aggBySchoolNpsn[it.schoolNpsn].totalItems += 1;
      aggBySchoolNpsn[it.schoolNpsn].totalNilai += it.selectedLineTotalRp;
      konsentrasiSetPerSchool[it.schoolNpsn].add(it.concentrationCode);
    }
    for (const npsn of Object.keys(aggBySchoolNpsn)) {
      aggBySchoolNpsn[npsn].konsentrasiCount = konsentrasiSetPerSchool[npsn].size;
    }
    const perSchool = Object.values(aggBySchoolNpsn).sort((a, b) =>
      a.schoolName.localeCompare(b.schoolName, "id-ID"),
    );
    const sekolahTotalCount = schoolLookup.length;
    return {
      meta: {
        generatedAt: new Date().toISOString(),
        sekolahTotal: sekolahTotalCount,
        sekolahDenganProposal: sekolahDenganProposalCount,
        sekolahDenganRpkp: sekolahDenganRpkpCount,
        sekolahBelumAdaRpkp: sekolahDenganProposalCount - sekolahDenganRpkpCount,
        totalItemRpkpPilihan: totalItemRpkp,
        totalNilaiRpkpRp: totalNilaiRpkp,
      },
      perSchool,
      items,
    };
  }

  async getAssignments(
    moduleKey?: ModuleKey,
    facilitatorEquipmentId?: string,
    facilitatorEquipmentName?: string,
    facilitatorAdministrationId?: string,
    facilitatorAdministrationName?: string,
    schoolNpsn?: string,
  ) {
    const rows = await this.readAssignments(moduleKey);
    const normalizedEquipmentName = normalizeUserName(facilitatorEquipmentName ?? "");
    const normalizedAdministrationName = normalizeUserName(facilitatorAdministrationName ?? "");
    const normSpecificNpsn = schoolNpsn ? normalizeText(String(schoolNpsn)) : undefined;

    return rows
      .filter((row) => {
        if (normSpecificNpsn && normalizeText(String(row.schoolNpsn ?? "")) !== normSpecificNpsn) {
          return false;
        }
        const equipmentMatch =
          !facilitatorEquipmentId && !normalizedEquipmentName
            ? true
            : Boolean(
                (facilitatorEquipmentId &&
                  normalizeText(row.facilitatorEquipmentId) === normalizeText(facilitatorEquipmentId)) ||
                  (normalizedEquipmentName &&
                    normalizeUserName(row.facilitatorEquipmentName) === normalizedEquipmentName),
              );
        const administrationMatch =
          !facilitatorAdministrationId && !normalizedAdministrationName
            ? true
            : Boolean(
                (facilitatorAdministrationId &&
                  normalizeText(row.facilitatorAdministrationId) === normalizeText(facilitatorAdministrationId)) ||
                  (normalizedAdministrationName &&
                    normalizeUserName(row.facilitatorAdministrationName) === normalizedAdministrationName),
              );
        return equipmentMatch && administrationMatch;
      })
      .sort((left, right) => left.schoolNo - right.schoolNo);
  }

  async upsertAssignments(records: AssignmentPayload[]) {
    await this.databaseService.transaction(async (connection) => {
      for (const record of records) {
        await connection.execute(
          `
            INSERT INTO workspace_school_assignments (
              id,
              module_key,
              source_tab,
              school_no,
              npsn,
              school_name,
              facilitator_administration_id,
              facilitator_administration_name,
              facilitator_equipment_id,
              facilitator_equipment_name,
              interview_scheduled_date,
              interview_scheduled_time,
              interview_meeting_link,
              pra_bimtek_scheduled_date,
              pra_bimtek_scheduled_time,
              pra_bimtek_meeting_link,
              bimtek_scheduled_date,
              bimtek_location,
              bimtek_status,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              school_no = VALUES(school_no),
              school_name = VALUES(school_name),
              facilitator_administration_id = VALUES(facilitator_administration_id),
              facilitator_administration_name = VALUES(facilitator_administration_name),
              facilitator_equipment_id = VALUES(facilitator_equipment_id),
              facilitator_equipment_name = VALUES(facilitator_equipment_name),
              interview_scheduled_date = COALESCE(VALUES(interview_scheduled_date), interview_scheduled_date),
              interview_scheduled_time = COALESCE(VALUES(interview_scheduled_time), interview_scheduled_time),
              interview_meeting_link = COALESCE(VALUES(interview_meeting_link), interview_meeting_link),
              pra_bimtek_scheduled_date = COALESCE(VALUES(pra_bimtek_scheduled_date), pra_bimtek_scheduled_date),
              pra_bimtek_scheduled_time = COALESCE(VALUES(pra_bimtek_scheduled_time), pra_bimtek_scheduled_time),
              pra_bimtek_meeting_link = COALESCE(VALUES(pra_bimtek_meeting_link), pra_bimtek_meeting_link),
              bimtek_scheduled_date = COALESCE(VALUES(bimtek_scheduled_date), bimtek_scheduled_date),
              bimtek_location = COALESCE(VALUES(bimtek_location), bimtek_location),
              bimtek_status = COALESCE(VALUES(bimtek_status), bimtek_status),
              updated_at = VALUES(updated_at)
          `,
          [
            createId(),
            record.moduleKey,
            record.sourceTab,
            record.schoolNo,
            record.schoolNpsn,
            record.schoolName,
            emptyToNull(record.facilitatorAdministrationId),
            record.facilitatorAdministrationName,
            emptyToNull(record.facilitatorEquipmentId),
            record.facilitatorEquipmentName,
            record.interviewScheduledDate ?? null,
            record.interviewScheduledTime ?? null,
            record.interviewMeetingLink ?? null,
            record.praBimtekScheduledDate ?? null,
            record.praBimtekScheduledTime ?? null,
            record.praBimtekMeetingLink ?? null,
            record.bimtekScheduledDate ?? null,
            record.bimtekLocation ?? null,
            (record.bimtekStatus ?? null) as BimtekStatus | null,
            toMysqlDateTime(record.updatedAt),
          ],
        );
      }
    });

    await this.deleteRuntimeCacheByPrefix("assignments::");
    await this.invalidateDatasetCache();
    await this.invalidateAllWorkspaceSummaryCaches();

    return { success: true };
  }

  async updateAssignmentInterviewSchedule(
    moduleKey: ModuleKey,
    sourceTab: SourceTabKey,
    schoolNpsn: string,
    payload: {
      interviewScheduledDate: string | null;
      interviewScheduledTime: string | null;
      interviewMeetingLink: string | null;
      updatedAt: string;
    },
  ) {
    const result = await this.databaseService.transaction(async (connection) => {
      const npsnNorm = String(schoolNpsn ?? "").trim();

      const allAssignmentsRaw = await connection.query<WorkspaceAssignmentRow[]>(
        `
          SELECT module_key, source_tab, npsn AS school_npsn, interview_scheduled_date, interview_scheduled_time, interview_meeting_link
          FROM workspace_school_assignments
          WHERE source_tab = ? AND npsn = ?
        `,
        [sourceTab, npsnNorm],
      );
      const allAssignments = normalizeRows<WorkspaceAssignmentRow>(allAssignmentsRaw);

      if (!allAssignments || allAssignments.length === 0) {
        throw new NotFoundException(
          `Tidak ada assignment sekolah untuk disinkronkan (sourceTab=${sourceTab}, schoolNpsn=${npsnNorm}). Pastikan sekolah tersebut sudah didaftarkan di modul apapun (Verifikasi Online, Wawancara, dsb).`,
        );
      }

      const [affectedRaw] = await connection.execute(
        `
          UPDATE workspace_school_assignments
          SET
            interview_scheduled_date = ?,
            interview_scheduled_time = ?,
            interview_meeting_link = ?,
            updated_at = ?
          WHERE source_tab = ? AND npsn = ?
        `,
        [
          payload.interviewScheduledDate ?? null,
          payload.interviewScheduledTime ?? null,
          payload.interviewMeetingLink ?? null,
          toMysqlDateTime(payload.updatedAt),
          sourceTab,
          npsnNorm,
        ],
      );
      const affected = affectedRaw as unknown as { affectedRows?: number };
      const rowsChanged = Number(affected.affectedRows ?? 0);
      void moduleKey;
      void rowsChanged;

      return { success: true, syncedModules: allAssignments.map((r) => r.moduleKey) };
    });

    await this.deleteRuntimeCacheByPrefix("assignments::");
    await this.invalidateDatasetCache();
    await this.invalidateAllWorkspaceSummaryCaches();

    return result;
  }

  async getInterviewAssessments() {
    return this.readInterviewAssessments();
  }

  async upsertInterviewAssessment(payload: InterviewAssessmentPayload) {
    const normalizedAnswers = Object.fromEntries(
      Object.entries(payload.answers ?? {}).map(([key, rawValue]) => {
        const value = (rawValue ?? {}) as { score?: unknown; comment?: unknown };
        const scoreNum = Number(value.score ?? 3);
        const scoreValid =
          scoreNum >= 1 && scoreNum <= 5 ? (scoreNum as 1 | 2 | 3 | 4 | 5) : (3 as const);
        const commentStr = typeof value.comment === "string" ? value.comment : "";
        return [key, { score: scoreValid, comment: commentStr }];
      }),
    );

    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO workspace_interview_assessments (
            id,
            assignment_key,
            npsn,
            school_name,
            facilitator_equipment_id,
            facilitator_equipment_name,
            answers_json,
            total_score,
            recommendation,
            note,
            source_kind,
            assessment_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?)
          ON DUPLICATE KEY UPDATE
            school_name = VALUES(school_name),
            facilitator_equipment_id = VALUES(facilitator_equipment_id),
            facilitator_equipment_name = VALUES(facilitator_equipment_name),
            answers_json = VALUES(answers_json),
            total_score = VALUES(total_score),
            recommendation = VALUES(recommendation),
            note = VALUES(note),
            source_kind = VALUES(source_kind),
            assessment_updated_at = VALUES(assessment_updated_at)
        `,
        [
          createId(),
          payload.assignmentKey,
          payload.schoolNpsn,
          payload.schoolName,
          payload.facilitatorEquipmentId,
          payload.facilitatorEquipmentName,
          JSON.stringify(normalizedAnswers),
          Number(payload.totalScore ?? 0),
          payload.recommendation ?? "",
          payload.note ?? "",
          toMysqlDateTime(payload.updatedAt),
        ],
      );
    });

    await this.invalidateRuntimeCache("interview_assessments");
    await this.invalidateAllWorkspaceSummaryCaches();
    return { success: true };
  }

  async getBimtekReviews() {
    return this.readBimtekReviews();
  }

  async upsertBimtekReview(payload: BimtekReviewPayload) {
    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO workspace_bimtek_reviews (
            id,
            npsn,
            school_name,
            facilitator_equipment_id,
            facilitator_equipment_name,
            statuses_json,
            notes_json,
            fasil_alat_comment,
            fasil_admin_comment,
            review_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            school_name = VALUES(school_name),
            facilitator_equipment_id = VALUES(facilitator_equipment_id),
            facilitator_equipment_name = VALUES(facilitator_equipment_name),
            statuses_json = VALUES(statuses_json),
            notes_json = VALUES(notes_json),
            fasil_alat_comment = COALESCE(VALUES(fasil_alat_comment), fasil_alat_comment),
            fasil_admin_comment = COALESCE(VALUES(fasil_admin_comment), fasil_admin_comment),
            review_updated_at = VALUES(review_updated_at)
        `,
        [
          createId(),
          payload.schoolNpsn,
          payload.schoolName,
          payload.facilitatorEquipmentId,
          payload.facilitatorEquipmentName,
          JSON.stringify(payload.statuses),
          JSON.stringify(payload.notes),
          payload.fasilAlatComment ?? null,
          payload.fasilAdminComment ?? null,
          toMysqlDateTime(payload.updatedAt),
        ],
      );
    });

    await this.invalidateRuntimeCache("bimtek_reviews");
    await this.invalidateAllWorkspaceSummaryCaches();
    return { success: true };
  }

  private async readOneVerifikasiOnlineReview(npsnNorm: string): Promise<VerifikasiOnlineReviewRecord | null> {
    const cacheKey = `verifikasi_online_reviews::${npsnNorm}` as RuntimeCacheKey;
    const cached = await this.readRuntimeCache<{ record: VerifikasiOnlineReviewRecord | null }>(cacheKey);
    if (cached) return cached.record;
    const rows = await this.databaseService.query<WorkspaceVerifikasiOnlineReviewRow[]>(
      `
        SELECT
          r.npsn AS school_npsn,
          r.school_name,
          r.review_note_admin,
          r.review_note_equipment,
          r.approved_admin,
          r.approved_equipment,
          r.reviewed_admin_id,
          r.reviewed_admin_name,
          r.reviewed_admin_at,
          r.reviewed_equipment_id,
          r.reviewed_equipment_name,
          r.reviewed_equipment_at,
          r.review_updated_at,
          u_admin.email AS admin_email,
          u_admin.phone_number AS admin_phone,
          u_equip.email AS equipment_email,
          u_equip.phone_number AS equipment_phone
        FROM workspace_verifikasi_online_reviews r
        LEFT JOIN users u_admin ON u_admin.id = r.reviewed_admin_id
        LEFT JOIN users u_equip ON u_equip.id = r.reviewed_equipment_id
        WHERE r.npsn = ?
        LIMIT 1
      `,
      [npsnNorm],
    );
    const row = rows[0];
    const record: VerifikasiOnlineReviewRecord | null = !row
      ? null
      : {
          schoolNpsn: row.school_npsn,
          schoolName: row.school_name,
          reviewNoteAdmin: row.review_note_admin ?? null,
          reviewNoteEquipment: row.review_note_equipment ?? null,
          approvedAdmin: row.approved_admin === null ? null : Boolean(row.approved_admin),
          approvedEquipment: row.approved_equipment === null ? null : Boolean(row.approved_equipment),
          reviewedAdminId: row.reviewed_admin_id ?? null,
          reviewedAdminName: row.reviewed_admin_name ?? null,
          reviewedAdminAt: row.reviewed_admin_at ? toIsoString(row.reviewed_admin_at) : null,
          reviewedAdminEmail: (row as WorkspaceVerifikasiOnlineReviewRow & { admin_email?: string | null }).admin_email ?? null,
          reviewedAdminPhone: (row as WorkspaceVerifikasiOnlineReviewRow & { admin_phone?: string | null }).admin_phone ?? null,
          reviewedEquipmentId: row.reviewed_equipment_id ?? null,
          reviewedEquipmentName: row.reviewed_equipment_name ?? null,
          reviewedEquipmentAt: row.reviewed_equipment_at ? toIsoString(row.reviewed_equipment_at) : null,
          reviewedEquipmentEmail: (row as WorkspaceVerifikasiOnlineReviewRow & { equipment_email?: string | null }).equipment_email ?? null,
          reviewedEquipmentPhone: (row as WorkspaceVerifikasiOnlineReviewRow & { equipment_phone?: string | null }).equipment_phone ?? null,
          updatedAt: row.review_updated_at ? toIsoString(row.review_updated_at) : new Date().toISOString(),
        };
    await this.writeRuntimeCache(cacheKey, { record });
    return record;
  }

  async getVerifikasiOnlineReviews(schoolNpsn?: string) {
    const normSpecificNpsn = schoolNpsn ? normalizeText(String(schoolNpsn)) : undefined;
    if (normSpecificNpsn) {
      const one = await this.readOneVerifikasiOnlineReview(normSpecificNpsn);
      return one ? [one] : [];
    }
    return this.readVerifikasiOnlineReviews();
  }

  async upsertVerifikasiOnlineReview(payload: VerifikasiOnlineReviewPayload) {
    const npsn = normalizeText(payload.schoolNpsn);
    if (!npsn) {
      throw new NotFoundException("NPSN sekolah harus diisi.");
    }

    await this.databaseService.transaction(async (connection) => {
      const existingRaw = await connection.query<WorkspaceVerifikasiOnlineReviewRow[]>(
        `
          SELECT
            npsn AS school_npsn,
            school_name,
            review_note_admin,
            review_note_equipment,
            approved_admin,
            approved_equipment,
            reviewed_admin_id,
            reviewed_admin_name,
            reviewed_admin_at,
            reviewed_equipment_id,
            reviewed_equipment_name,
            reviewed_equipment_at,
            review_updated_at
          FROM workspace_verifikasi_online_reviews
          WHERE npsn = ?
          LIMIT 1
        `,
        [npsn],
      );
      const existingRows = normalizeRows<WorkspaceVerifikasiOnlineReviewRow>(existingRaw);
      const existing = existingRows[0];

      const isAdmin = payload.reviewerRole === "ADMINISTRASI";
      const mysqlUpdatedAt = toMysqlDateTime(payload.updatedAt);

      const nextSchoolName = payload.schoolName || existing?.school_name || "";
      const nextNoteAdmin = isAdmin
        ? payload.reviewNote === undefined
          ? existing?.review_note_admin ?? null
          : String(payload.reviewNote ?? "")
        : existing?.review_note_admin ?? null;
      const nextNoteEquipment = !isAdmin
        ? payload.reviewNote === undefined
          ? existing?.review_note_equipment ?? null
          : String(payload.reviewNote ?? "")
        : existing?.review_note_equipment ?? null;
      const nextApprovedAdmin = isAdmin
        ? payload.approved === undefined
          ? existing?.approved_admin ?? null
          : payload.approved === null
            ? null
            : Number(payload.approved)
        : existing?.approved_admin ?? null;
      const nextApprovedEquipment = !isAdmin
        ? payload.approved === undefined
          ? existing?.approved_equipment ?? null
          : payload.approved === null
            ? null
            : Number(payload.approved)
        : existing?.approved_equipment ?? null;
      const nextAdminId = isAdmin ? payload.reviewerId : existing?.reviewed_admin_id ?? null;
      const nextAdminName = isAdmin ? payload.reviewerName : existing?.reviewed_admin_name ?? null;
      const nextAdminAt = isAdmin ? mysqlUpdatedAt : existing?.reviewed_admin_at ?? null;
      const nextEquipmentId = !isAdmin ? payload.reviewerId : existing?.reviewed_equipment_id ?? null;
      const nextEquipmentName = !isAdmin ? payload.reviewerName : existing?.reviewed_equipment_name ?? null;
      const nextEquipmentAt = !isAdmin ? mysqlUpdatedAt : existing?.reviewed_equipment_at ?? null;

      await connection.execute(
        `
          INSERT INTO workspace_verifikasi_online_reviews (
            id,
            npsn,
            school_name,
            review_note_admin,
            review_note_equipment,
            approved_admin,
            approved_equipment,
            reviewed_admin_id,
            reviewed_admin_name,
            reviewed_admin_at,
            reviewed_equipment_id,
            reviewed_equipment_name,
            reviewed_equipment_at,
            review_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            school_name = VALUES(school_name),
            review_note_admin = VALUES(review_note_admin),
            review_note_equipment = VALUES(review_note_equipment),
            approved_admin = VALUES(approved_admin),
            approved_equipment = VALUES(approved_equipment),
            reviewed_admin_id = VALUES(reviewed_admin_id),
            reviewed_admin_name = VALUES(reviewed_admin_name),
            reviewed_admin_at = VALUES(reviewed_admin_at),
            reviewed_equipment_id = VALUES(reviewed_equipment_id),
            reviewed_equipment_name = VALUES(reviewed_equipment_name),
            reviewed_equipment_at = VALUES(reviewed_equipment_at),
            review_updated_at = VALUES(review_updated_at)
        `,
        [
          createId(),
          npsn,
          nextSchoolName,
          nextNoteAdmin,
          nextNoteEquipment,
          nextApprovedAdmin,
          nextApprovedEquipment,
          nextAdminId,
          nextAdminName,
          nextAdminAt,
          nextEquipmentId,
          nextEquipmentName,
          nextEquipmentAt,
          mysqlUpdatedAt,
        ],
      );
    });

    await this.runtimeCache.delete("verifikasi_online_reviews");
    await this.runtimeCache.delete(`verifikasi_online_reviews::${npsn}` as RuntimeCacheKey);
    return await this.readOneVerifikasiOnlineReview(npsn);
  }

  async getSchoolProposalForUser(user: AuthenticatedUser) {
    const npsn = await this.findNpsnForUser(user.id);
    if (!npsn) {
      throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
    }
    return this.getWorkspaceData(npsn, "proposal") as Promise<{ proposalTables: unknown; rpkpSelections: unknown; updatedAt: string | null }>;
  }

  public async getSchoolPaguForUser(
    user: AuthenticatedUser,
    tahunAjaranParam?: string,
  ) {
    const npsn = await this.findNpsnForUser(user.id);
    if (!npsn) {
      throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
    }
    const ta = String(tahunAjaranParam ?? "").trim() || "2026/2027";
    return this.getSchoolPagu({ schoolNpsn: npsn, tahunAjaran: ta });
  }

  async getSchoolProposalBundlesByNpsns(npsns: string[]) {
    if (npsns.length === 0) {
      return {};
    }

    const placeholders = npsns.map(() => "?").join(", ");
    const rows = await this.databaseService.query<ProposalDataRow[]>(
      `
        SELECT s.npsn, p.proposal_tables_json, p.rpkp_selections_json, p.updated_at
        FROM workspace_school_proposal_data p
        LEFT JOIN schools s ON s.npsn = p.npsn
        WHERE s.npsn IN (${placeholders})
      `,
      npsns,
    );

    return Object.fromEntries(rows.map((row) => [row.npsn, this.mapProposalRow(row)]));
  }

  async saveSchoolProposalForUser(
    user: AuthenticatedUser,
    payload: { proposalTables: unknown; rpkpSelections: unknown; rpkpGrandTotalRp?: number | null },
    reqMeta?: {
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
  ) {
    const payloadSize = Buffer.byteLength(JSON.stringify({ pt: payload.proposalTables ?? {}, rp: payload.rpkpSelections ?? {} }), "utf8");
    try {
      const result = await this.databaseService.transaction(
        async (c) => {
          const npsn = await this.findNpsnForUser(user.id);
          if (!npsn) {
            throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
          }
          const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
          if (!schoolId) {
            throw new UnauthorizedException("Data sekolah (NPSN) tidak ditemukan di master schools.");
          }
          const rpkpTotalRaw = typeof payload.rpkpGrandTotalRp === "number" && Number.isFinite(payload.rpkpGrandTotalRp)
            ? Math.max(0, Math.floor(payload.rpkpGrandTotalRp))
            : 0;
          if (rpkpTotalRaw > 0) {
            await this.assertWithinPaguLimit(c, npsn, "alat", rpkpTotalRaw);
          }

          return this.upsertSchoolProposalData(
            npsn,
            schoolId,
            payload.proposalTables,
            payload.rpkpSelections,
            {
              userId: user.id,
              userRole: user.role ?? null,
              ipAddress: reqMeta?.ipAddress ?? null,
              userAgent: reqMeta?.userAgent ?? null,
              requestId: reqMeta?.requestId ?? null,
            },
            c,
          );
        },
        { isolationLevel: "SERIALIZABLE" },
      );
      const { preservedProposalTables, preservedRpkpSelections, version, dataSha256 } = result;
      await this.invalidateProposalAndEquipmentCaches();
      const npsn = await this.findNpsnForUser(user.id);
      if (npsn) {
        await this.invalidateWorkspaceCacheByNpsn(npsn, ["proposal"]);
      }
      const updatedAt = new Date().toISOString();
      return {
        proposalTables: preservedProposalTables ?? {},
        rpkpSelections: preservedRpkpSelections ?? {},
        updatedAt,
        version,
        integritySha: dataSha256,
      };
    } catch (err) {
      await writeSaveErrorToTmpLog("saveSchoolProposalForUser", err, {
        userId: user.id,
        userRole: user.role,
        username: user.username,
        payloadBytes: payloadSize,
        proposalTablesKeysCount: typeof payload.proposalTables === "object" && payload.proposalTables ? Object.keys(payload.proposalTables as Record<string, unknown>).length : -1,
        rpkpKeysCount: typeof payload.rpkpSelections === "object" && payload.rpkpSelections ? Object.keys(payload.rpkpSelections as Record<string, unknown>).length : -1,
      });
      throw err;
    }
  }

  async getSchoolEquipmentForUser(user: AuthenticatedUser) {
    const npsn = await this.findNpsnForUser(user.id);
    if (!npsn) {
      throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
    }

    return this.getWorkspaceData(npsn, "equipment") as Promise<{ equipmentTables: unknown; updatedAt: string | null }>;
  }

  async saveSchoolEquipmentForUser(
    user: AuthenticatedUser,
    payload: { equipmentTables: unknown },
    reqMeta?: {
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
  ) {
    try {
      const result = await this.databaseService.transaction(
        async (c) => {
          const npsn = await this.findNpsnForUser(user.id);
          if (!npsn) {
            throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
          }
          const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
          if (!schoolId) {
            throw new UnauthorizedException("Data sekolah (NPSN) tidak ditemukan di master schools.");
          }

          return this.upsertSchoolEquipmentData(
            npsn,
            schoolId,
            payload.equipmentTables,
            {
              userId: user.id,
              userRole: user.role ?? null,
              ipAddress: reqMeta?.ipAddress ?? null,
              userAgent: reqMeta?.userAgent ?? null,
              requestId: reqMeta?.requestId ?? null,
            },
            c,
          );
        },
        { isolationLevel: "SERIALIZABLE" },
      );
      const { preservedEquipmentTables, version, dataSha256 } = result;
      await this.invalidateProposalAndEquipmentCaches();
      const npsn = await this.findNpsnForUser(user.id);
      if (npsn) {
        await this.invalidateWorkspaceCacheByNpsn(npsn, ["equipment"]);
      }
      const updatedAt = new Date().toISOString();
      return {
        equipmentTables: preservedEquipmentTables ?? {},
        updatedAt,
        version,
        integritySha: dataSha256,
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * T3.1 Partial PATCH proposal delta — merge perubahan top-level key SAJA.
   * Payload HANYA changedProposalKeys + changedRpkpKeys + deleted keys.
   * Tidak pernah menulis full 30MB blob; ukuran 20-100x lebih kecil dari PUT.
   */
  async patchSchoolProposalDeltaForUser(
    user: AuthenticatedUser,
    patch: {
      changedProposalKeys: Record<string, unknown>;
      changedRpkpKeys: Record<string, unknown>;
      deletedProposalKeys: string[];
      deletedRpkpKeys: string[];
      expectedVersion?: number;
    },
    reqMeta?: {
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
  ) {
    const npsn = await this.findNpsnForUser(user.id);
    if (!npsn) throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    if (!schoolId) throw new UnauthorizedException("Data sekolah (NPSN) tidak ditemukan di master schools.");

    const ctx = {
      userId: user.id,
      userRole: user.role ?? null,
      ipAddress: reqMeta?.ipAddress ?? null,
      userAgent: reqMeta?.userAgent ?? null,
      requestId: reqMeta?.requestId ?? null,
    };

    const result = await this.databaseService.transaction(
      async (c) => {
        const [rows] = (await c.query(
          `SELECT proposal_tables_json, rpkp_selections_json, version FROM workspace_school_proposal_data WHERE npsn = ? FOR UPDATE`,
          [npsn],
        )) as unknown as [Array<{ proposal_tables_json: any; rpkp_selections_json: any; version: any }>];
      if (!rows || rows.length === 0) {
        throw new ConflictException(
          "Proposal sekolah belum ada — silakan save via PUT full terlebih dahulu sebelum patch delta.",
        );
      }
      const existing = rows[0];
      const currentVersion = Number(existing.version ?? 0);
      if (typeof patch.expectedVersion === "number" && patch.expectedVersion !== currentVersion) {
        throw new ConflictException(
          `Optimistic lock mismatch: expectedVersion=${patch.expectedVersion} serverVersion=${currentVersion}. Reload halaman, perubahan lain telah menulis data.`,
        );
      }
      const baseTables = parseJsonRecord(existing.proposal_tables_json, true) as Record<string, unknown>;
      const baseRpkp = parseJsonRecord(existing.rpkp_selections_json, true) as Record<string, unknown>;
      const mergedTables: Record<string, unknown> = {
        ...(baseTables && typeof baseTables === "object" ? baseTables : {}),
        ...(patch.changedProposalKeys ?? {}),
      };
      const mergedRpkp: Record<string, unknown> = {
        ...(baseRpkp && typeof baseRpkp === "object" ? baseRpkp : {}),
        ...(patch.changedRpkpKeys ?? {}),
      };
        for (const dk of patch.deletedProposalKeys ?? []) delete mergedTables[dk];
        for (const dk of patch.deletedRpkpKeys ?? []) delete mergedRpkp[dk];
        return this.upsertSchoolProposalData(
          npsn,
          schoolId,
          mergedTables,
          mergedRpkp,
          ctx,
          c,
        );
      },
      { isolationLevel: "SERIALIZABLE" },
    );

    const { preservedProposalTables, preservedRpkpSelections, version, dataSha256 } = result;
    await this.invalidateProposalAndEquipmentCaches();
    await this.invalidateWorkspaceCacheByNpsn(npsn, ["proposal"]);
    return {
      proposalTables: preservedProposalTables ?? {},
      rpkpSelections: preservedRpkpSelections ?? {},
      updatedAt: new Date().toISOString(),
      version,
      integritySha: dataSha256,
    };
  }

  /**
   * T3.1 Partial PATCH equipment delta — merge perubahan top-level key SAJA.
   */
  async patchSchoolEquipmentDeltaForUser(
    user: AuthenticatedUser,
    patch: {
      changedKeys: Record<string, unknown>;
      deletedKeys: string[];
      expectedVersion?: number;
    },
    reqMeta?: {
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
  ) {
    const npsn = await this.findNpsnForUser(user.id);
    if (!npsn) throw new UnauthorizedException("Akun ini tidak terhubung ke data sekolah.");
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    if (!schoolId) throw new UnauthorizedException("Data sekolah (NPSN) tidak ditemukan di master schools.");
    const ctx = {
      userId: user.id,
      userRole: user.role ?? null,
      ipAddress: reqMeta?.ipAddress ?? null,
      userAgent: reqMeta?.userAgent ?? null,
      requestId: reqMeta?.requestId ?? null,
    };
    const result = await this.databaseService.transaction(
      async (c) => {
        const [rows] = (await c.query(
          `SELECT equipment_tables_json, version FROM workspace_school_equipment_data WHERE npsn = ? FOR UPDATE`,
          [npsn],
        )) as unknown as [Array<{ equipment_tables_json: any; version: any }>];
        if (!rows || rows.length === 0) {
          throw new ConflictException(
            "Equipment sekolah belum ada — silakan save via PUT full terlebih dahulu sebelum patch delta.",
          );
        }
        const existing = rows[0];
        const currentVersion = Number(existing.version ?? 0);
        if (typeof patch.expectedVersion === "number" && patch.expectedVersion !== currentVersion) {
          throw new ConflictException(
            `Optimistic lock mismatch equipment: expectedVersion=${patch.expectedVersion} serverVersion=${currentVersion}.`,
          );
        }
        const baseTables = parseJsonRecord(existing.equipment_tables_json, true) as Record<string, unknown>;
        const merged: Record<string, unknown> = {
          ...(baseTables && typeof baseTables === "object" ? baseTables : {}),
          ...(patch.changedKeys ?? {}),
        };
        for (const dk of patch.deletedKeys ?? []) delete merged[dk];
        return this.upsertSchoolEquipmentData(
          npsn,
          schoolId,
          merged,
          ctx,
          c,
        );
      },
      { isolationLevel: "SERIALIZABLE" },
    );
    const { preservedEquipmentTables, version, dataSha256 } = result;
    await this.invalidateProposalAndEquipmentCaches();
    await this.invalidateWorkspaceCacheByNpsn(npsn, ["equipment"]);
    return {
      equipmentTables: preservedEquipmentTables ?? {},
      updatedAt: new Date().toISOString(),
      version,
      integritySha: dataSha256,
    };
  }

  async deleteDatasetRow(payload: { datasetKey: DatasetKey; schoolNpsn: string }) {
    const npsn = normalizeText(payload.schoolNpsn);
    if (!npsn) {
      throw new NotFoundException("NPSN sekolah harus diisi.");
    }

    await this.databaseService.transaction(async (connection) => {
      const existingRaw = await connection.query<Array<{ id: string }>>(
        `
          SELECT id FROM workspace_school_records
          WHERE dataset_key = ? AND school_npsn = ?
          LIMIT 1
        `,
        [payload.datasetKey, npsn],
      );
      const existingRows = normalizeRows<{ id: string }>(existingRaw);
      if (!existingRows || existingRows.length === 0) {
        throw new NotFoundException(
          `Data sekolah dengan NPSN ${npsn} tidak ditemukan di dataset ${payload.datasetKey}.`,
        );
      }

      await connection.execute(
        `DELETE FROM workspace_school_records WHERE dataset_key = ? AND school_npsn = ?`,
        [payload.datasetKey, npsn],
      );
    });

    await this.invalidateDatasetCache(payload.datasetKey);
    return true;
  }

  async insertDatasetRow(payload: {
    datasetKey: DatasetKey;
    schoolNpsn: string;
    schoolNo?: number;
    schoolName?: string;
    province?: string;
    city?: string;
    district?: string;
    note?: string | null;
    isSelected?: boolean | null;
    rawPayload?: Record<string, unknown>;
  }) {
    const npsn = normalizeText(payload.schoolNpsn);
    if (!npsn) {
      throw new NotFoundException("NPSN sekolah harus diisi.");
    }
    if (npsn.length < 6) {
      throw new NotFoundException("Format NPSN tidak valid (minimal 6 digit).");
    }
    const schoolName = String(payload.schoolName ?? "").trim();
    if (!schoolName) {
      throw new NotFoundException("Nama sekolah harus diisi.");
    }
    const province = String(payload.province ?? "").trim();
    const city = String(payload.city ?? "").trim();
    if (!province || !city) {
      throw new NotFoundException("Provinsi dan Kota / Kabupaten harus diisi.");
    }

    return this.databaseService.transaction(async (connection) => {
      const dupRaw = await connection.query<Array<{ id: string }>>(
        `SELECT id FROM workspace_school_records WHERE dataset_key = ? AND school_npsn = ? LIMIT 1`,
        [payload.datasetKey, npsn],
      );
      const dupRows = normalizeRows<{ id: string }>(dupRaw);
      if (dupRows && dupRows.length > 0) {
        throw new ConflictException(
          `NPSN ${npsn} sudah terdaftar di dataset ${payload.datasetKey}. Gunakan aksi Ubah jika ingin mengedit.`,
        );
      }

      let nextNo: number;
      if (typeof payload.schoolNo === "number" && Number.isFinite(payload.schoolNo) && payload.schoolNo > 0) {
        nextNo = payload.schoolNo;
        const collisionRaw = await connection.query<Array<RowDataPacket & { id: string }>>(
          `SELECT id FROM workspace_school_records WHERE dataset_key = ? AND school_no = ? LIMIT 1`,
          [payload.datasetKey, nextNo],
        );
        const collisionRows = normalizeRows<RowDataPacket & { id: string }>(collisionRaw);
        if (collisionRows && collisionRows.length > 0) {
          const maxNoRaw = await connection.query<Array<RowDataPacket & { max_no: number | null }>>(
            "SELECT MAX(school_no) AS max_no FROM workspace_school_records WHERE dataset_key = ?",
            [payload.datasetKey],
          );
          const maxNoRows = normalizeRows<RowDataPacket & { max_no: number | null }>(maxNoRaw);
          const maxNoRow = maxNoRows?.[0] ?? null;
          const rawMax = Number(maxNoRow?.max_no ?? 0);
          nextNo = Math.max(Number.isFinite(rawMax) ? rawMax : 0, 0) + 1;
        }
      } else {
        const maxNoRaw = await connection.query<Array<RowDataPacket & { max_no: number | null }>>(
          "SELECT MAX(school_no) AS max_no FROM workspace_school_records WHERE dataset_key = ?",
          [payload.datasetKey],
        );
        const maxNoRows = normalizeRows<RowDataPacket & { max_no: number | null }>(maxNoRaw);
        const maxNoRow = maxNoRows?.[0] ?? null;
        const rawMax = Number(maxNoRow?.max_no ?? 0);
        nextNo = Math.max(Number.isFinite(rawMax) ? rawMax : 0, 0) + 1;
      }
      if (!Number.isFinite(nextNo) || nextNo < 1) nextNo = 1;

      const district = String(payload.district ?? "").trim();
      const note = "note" in payload ? (payload.note === null ? null : String(payload.note)) : null;
      let isSelected: number | null;
      if ("isSelected" in payload) {
        if (payload.isSelected === null) {
          isSelected = null;
        } else {
          const n = Number(payload.isSelected);
          isSelected = Number.isFinite(n) ? (n > 0 ? 1 : 0) : 1;
        }
      } else {
        isSelected = 1;
      }
      const rawBase = payload.rawPayload && typeof payload.rawPayload === "object" && !Array.isArray(payload.rawPayload)
        ? { ...payload.rawPayload }
        : {};
      const nextRaw: Record<string, unknown> = {
        no: nextNo,
        npsn,
        nama_sekolah: schoolName,
        provinsi: province,
        kab_kota: city,
        kecamatan: district,
        catatan: note,
        status_penerima_abt: isSelected === null ? null : Boolean(isSelected),
        fasilitator_administrasi: "",
        fasilitator_peralatan: "",
        ...rawBase,
      };

      const id = createId();
      const sourceTab = "bantuan";

      await connection.execute(
        `
          INSERT INTO workspace_school_records (
            id,
            dataset_key,
            source_tab,
            school_no,
            school_npsn,
            school_name,
            province,
            city,
            district,
            note,
            is_selected,
            raw_payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          payload.datasetKey,
          sourceTab,
          nextNo,
          npsn,
          schoolName,
          province,
          city,
          district,
          note === null ? "" : note,
          isSelected === null ? null : isSelected,
          JSON.stringify(nextRaw),
        ],
      );

      await this.invalidateDatasetCache(payload.datasetKey);
      const refreshed = await this.readDatasetRows(payload.datasetKey);
      return refreshed.find((row) => normalizeText(String(row.npsn)) === npsn) ?? null;
    });
  }

  async updateDatasetRow(payload: {
    datasetKey: DatasetKey;
    schoolNpsn: string;
    schoolNo?: number;
    schoolName?: string;
    province?: string;
    city?: string;
    district?: string;
    note?: string | null;
    isSelected?: boolean | null;
    rawPayloadPatch?: Record<string, unknown>;
  }) {
    const npsn = normalizeText(payload.schoolNpsn);
    if (!npsn) {
      throw new NotFoundException("NPSN sekolah harus diisi.");
    }

    await this.databaseService.transaction(async (connection) => {
      const existingRaw = await connection.query<WorkspaceSchoolRecordRow[]>(
        `
          SELECT school_no, school_npsn, school_name, province, city, district, note, is_selected, raw_payload
          FROM workspace_school_records
          WHERE dataset_key = ? AND school_npsn = ?
          LIMIT 1
        `,
        [payload.datasetKey, npsn],
      );
      const existingRows = normalizeRows<WorkspaceSchoolRecordRow>(existingRaw);
      const existing = existingRows[0];

      if (!existing) {
        throw new NotFoundException(`Data sekolah dengan NPSN ${npsn} tidak ditemukan di dataset ${payload.datasetKey}.`);
      }

      const currentRaw = parseJsonRecord(existing.raw_payload);
      const nextRaw: Record<string, unknown> = {
        ...(currentRaw && typeof currentRaw === "object" && !Array.isArray(currentRaw) ? currentRaw : {}),
        ...(payload.rawPayloadPatch ?? {}),
      };

      const nextNote = "note" in payload ? String(payload.note ?? "") : existing.note;
      let nextSelected: number | null;
      if ("isSelected" in payload) {
        if (payload.isSelected === null) {
          nextSelected = null;
        } else {
          const n = Number(payload.isSelected);
          nextSelected = Number.isFinite(n) ? (n > 0 ? 1 : 0) : 1;
        }
      } else {
        const raw = Number(existing.is_selected);
        nextSelected = Number.isFinite(raw) ? raw : 1;
      }

      const rawSchoolNo = Number(payload.schoolNo ?? existing.school_no);
      const nextSchoolNo = Number.isFinite(rawSchoolNo) && rawSchoolNo > 0 ? rawSchoolNo : 1;
      const nextSchoolName = String(payload.schoolName ?? existing.school_name ?? "").trim() || String(existing.school_name ?? "");
      const nextProvince = String(payload.province ?? existing.province ?? "").trim() || String(existing.province ?? "");
      const nextCity = String(payload.city ?? existing.city ?? "").trim() || String(existing.city ?? "");
      const nextDistrict = String(payload.district ?? existing.district ?? "").trim() || String(existing.district ?? "");

      if (nextRaw.npsn === undefined) nextRaw.npsn = npsn;
      if (nextRaw.nama_sekolah === undefined) nextRaw.nama_sekolah = nextSchoolName;
      if (nextRaw.provinsi === undefined) nextRaw.provinsi = nextProvince;
      if (nextRaw.kab_kota === undefined) nextRaw.kab_kota = nextCity;
      if (nextRaw.kecamatan === undefined) nextRaw.kecamatan = nextDistrict;
      if ("note" in payload && payload.note !== undefined) {
        nextRaw.catatan = payload.note === null ? null : String(payload.note);
      }
      if ("isSelected" in payload) {
        nextRaw.status_penerima_abt = payload.isSelected === null ? null : Boolean(payload.isSelected);
      }

      await connection.execute(
        `
          UPDATE workspace_school_records
          SET
            school_no = ?,
            school_name = ?,
            province = ?,
            city = ?,
            district = ?,
            note = ?,
            is_selected = ?,
            raw_payload = ?
          WHERE dataset_key = ? AND school_npsn = ?
        `,
        [
          nextSchoolNo,
          nextSchoolName,
          nextProvince,
          nextCity,
          nextDistrict,
          nextNote,
          nextSelected,
          JSON.stringify(nextRaw),
          payload.datasetKey,
          npsn,
        ],
      );
    });

    await this.invalidateDatasetCache(payload.datasetKey);
    const refreshed = await this.readDatasetRows(payload.datasetKey);
    return refreshed.find((row) => normalizeText(String(row.npsn)) === npsn) ?? null;
  }

  private async readDatasetRows(datasetKey: DatasetKey): Promise<WorkspaceDatasetPayload[]> {
    const now = Date.now();
    const cached = this.datasetCache[datasetKey];
    if (cached && now - cached.cachedAt < this.DATASET_CACHE_TTL_MS) {
      return cached.rows;
    }

    const rows = await this.databaseService.query<WorkspaceSchoolRecordRow[]>(
      `
        SELECT school_no, school_npsn, school_name, province, city, district, note, is_selected, raw_payload
        FROM workspace_school_records
        WHERE dataset_key = ?
        ORDER BY school_no ASC, school_name ASC
      `,
      [datasetKey],
    );

    const mapped: WorkspaceDatasetPayload[] = rows.map((row) => {
      const payload = parseJsonRecord(row.raw_payload);
      const coerceStringOrEmpty = (v: unknown): string => {
        if (v === null || v === undefined) return "";
        if (typeof v === "string") return v;
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        return "";
      };
      return {
        ...payload,
        no: Number(payload.no ?? row.school_no ?? 0),
        npsn: String(payload.npsn ?? row.school_npsn ?? ""),
        nama_sekolah: String(payload.nama_sekolah ?? row.school_name ?? ""),
        provinsi: String(payload.provinsi ?? row.province ?? ""),
        kab_kota: String(payload.kab_kota ?? row.city ?? ""),
        kecamatan: String(payload.kecamatan ?? row.district ?? ""),
        catatan: payload.catatan ?? row.note ?? null,
        status_penerima_abt:
          typeof payload.status_penerima_abt === "boolean"
            ? payload.status_penerima_abt
            : row.is_selected === null
              ? null
              : Boolean(row.is_selected),
        fasilitator_administrasi: coerceStringOrEmpty(
          (payload as { fasilitator_administrasi?: unknown }).fasilitator_administrasi,
        ),
        fasilitator_peralatan: coerceStringOrEmpty(
          (payload as { fasilitator_peralatan?: unknown }).fasilitator_peralatan,
        ),
      } as WorkspaceDatasetPayload;
    });

    this.datasetCache[datasetKey] = { cachedAt: now, rows: mapped };
    return mapped;
  }

  private async invalidateDatasetCache(_datasetKey?: DatasetKey) {
    await this.clearRuntimeCaches();
  }

  private async readMergedDatasetRows(
    datasetKey: DatasetKey,
  ): Promise<WorkspaceDatasetPayload[]> {
    const [datasetRows, assignments] = await Promise.all([
      this.readDatasetRows(datasetKey),
      this.readAssignments(),
    ]);

    const assignmentByNpsn = new Map<string, ReturnType<WorkspaceDataService["mapAssignmentRow"]>>();
    for (const assignment of assignments) {
      if (!assignmentByNpsn.has(normalizeText(assignment.schoolNpsn))) {
        assignmentByNpsn.set(normalizeText(assignment.schoolNpsn), assignment);
      }
    }

    const coerceFasil = (cur: unknown, fallback: unknown): string => {
      if (typeof cur === "string" && cur.length > 0) return cur;
      if (typeof fallback === "string") return fallback;
      return "";
    };
    return datasetRows.map((row): WorkspaceDatasetPayload => {
      const assignment = assignmentByNpsn.get(normalizeText(String(row.npsn ?? "")));
      if (!assignment) {
        return row;
      }
      const currentRow = row as Record<string, unknown>;
      return {
        ...row,
        fasilitator_administrasi: coerceFasil(
          currentRow.fasilitator_administrasi,
          assignment.facilitatorAdministrationName,
        ),
        fasilitator_peralatan: coerceFasil(
          currentRow.fasilitator_peralatan,
          assignment.facilitatorEquipmentName,
        ),
      };
    });
  }

  private async readAssignments(moduleKey?: ModuleKey) {
    const cacheKey: RuntimeCacheKey = `assignments::${moduleKey ?? "ALL"}`;
    const cached = await this.readRuntimeCache<ReturnType<WorkspaceDataService["mapAssignmentRow"]>[]>(cacheKey);
    if (cached) return cached;

    const params: unknown[] = [];
    const where = moduleKey ? "WHERE module_key = ?" : "";
    if (moduleKey) {
      params.push(moduleKey);
    }

    const rows = await this.databaseService.query<WorkspaceAssignmentRow[]>(
      `
        SELECT
          module_key,
          source_tab,
          school_no,
          npsn AS school_npsn,
          school_name,
          facilitator_administration_id,
          facilitator_administration_name,
          facilitator_equipment_id,
          facilitator_equipment_name,
          interview_scheduled_date,
          interview_scheduled_time,
          interview_meeting_link,
          pra_bimtek_scheduled_date,
          pra_bimtek_scheduled_time,
          pra_bimtek_meeting_link,
          bimtek_scheduled_date,
          bimtek_location,
          bimtek_status,
          updated_at
        FROM workspace_school_assignments
        ${where}
        ORDER BY school_no ASC, school_name ASC
      `,
      params,
    );

    const mapped = rows.map((row) => this.mapAssignmentRow(row));
    await this.writeRuntimeCache(cacheKey, mapped, this.RUNTIME_CACHE_TTL_MS);
    return mapped;
  }

  private mapAssignmentRow(row: WorkspaceAssignmentRow) {
    const sourceLabel = row.source_tab === "abt" ? "data sekolah penerima bantuan ABT" : "data sekolah penerima bantuan";
    let moduleLabel = "Wawancara";
    if (row.module_key === "bimbingan-teknis") moduleLabel = "Bimbingan Teknis";
    if (row.module_key === "verifikasi-online") moduleLabel = "Verifikasi Administrasi";
    if (row.module_key === "pra-bimtek") moduleLabel = "Pra Bimtek / Administrasi";

    return {
      key: `${row.module_key}:${row.source_tab}:${row.school_npsn}`,
      moduleKey: row.module_key,
      moduleLabel,
      sourceTab: row.source_tab,
      sourceLabel,
      schoolNo: Number(row.school_no ?? 0),
      schoolNpsn: row.school_npsn,
      schoolName: row.school_name,
      facilitatorAdministrationId: row.facilitator_administration_id ?? "",
      facilitatorAdministrationName: row.facilitator_administration_name ?? "",
      facilitatorEquipmentId: row.facilitator_equipment_id ?? "",
      facilitatorEquipmentName: row.facilitator_equipment_name ?? "",
      interviewScheduledDate: row.interview_scheduled_date ?? null,
      interviewScheduledTime: row.interview_scheduled_time ?? null,
      interviewMeetingLink: row.interview_meeting_link ?? null,
      praBimtekScheduledDate: row.pra_bimtek_scheduled_date ?? null,
      praBimtekScheduledTime: row.pra_bimtek_scheduled_time ?? null,
      praBimtekMeetingLink: row.pra_bimtek_meeting_link ?? null,
      praBimtekStatus: (
        (row as { pra_bimtek_status?: BimtekStatus | string | null | undefined }).pra_bimtek_status ?? null
      ) as BimtekStatus | string | null,
      bimtekScheduledDate: row.bimtek_scheduled_date ?? null,
      bimtekLocation: row.bimtek_location ?? null,
      bimtekStatus: (row.bimtek_status ?? null) as BimtekStatus | null,
      updatedAt: toIsoString(row.updated_at),
    };
  }

  private async readInterviewAssessments(): Promise<InterviewAssessmentPayload[]> {
    const cached = await this.readRuntimeCache<InterviewAssessmentPayload[]>("interview_assessments");
    if (cached) return cached;
    const rows = await this.databaseService.query<WorkspaceInterviewRow[]>(
      `
        SELECT
          assignment_key,
          npsn AS school_npsn,
          school_name,
          facilitator_equipment_id,
          facilitator_equipment_name,
          answers_json,
          total_score,
          recommendation,
          note,
          assessment_updated_at
        FROM workspace_interview_assessments
        ORDER BY total_score DESC, assessment_updated_at DESC
      `,
    );

    const mapped = rows.map((row) => ({
      assignmentKey: row.assignment_key,
      schoolNpsn: row.school_npsn,
      schoolName: row.school_name,
      facilitatorEquipmentId: row.facilitator_equipment_id,
      facilitatorEquipmentName: row.facilitator_equipment_name,
      answers: parseJsonRecord(row.answers_json) as InterviewAssessmentAnswers,
      totalScore: Number(row.total_score ?? 0),
      recommendation: row.recommendation,
      note: row.note ?? "",
      updatedAt: toIsoString(row.assessment_updated_at),
    }));
    await this.writeRuntimeCache("interview_assessments", mapped);
    return mapped;
  }

  private async readBimtekReviews(): Promise<BimtekReviewPayload[]> {
    const cached = await this.readRuntimeCache<BimtekReviewPayload[]>("bimtek_reviews");
    if (cached) return cached;
    const rows = await this.databaseService.query<WorkspaceBimtekReviewRow[]>(
      `
        SELECT
          npsn AS school_npsn,
          school_name,
          facilitator_equipment_id,
          facilitator_equipment_name,
          statuses_json,
          notes_json,
          fasil_alat_comment,
          fasil_admin_comment,
          review_updated_at
        FROM workspace_bimtek_reviews
        ORDER BY review_updated_at DESC
      `,
    );

    const mapped = rows.map((row) => ({
      schoolNpsn: row.school_npsn,
      schoolName: row.school_name,
      facilitatorEquipmentId: row.facilitator_equipment_id,
      facilitatorEquipmentName: row.facilitator_equipment_name,
      statuses: parseJsonRecord(row.statuses_json) as Record<BimtekDocumentKey, BimtekDocumentReviewStatus>,
      notes: parseJsonRecord(row.notes_json) as Record<BimtekDocumentKey, string>,
      fasilAlatComment: row.fasil_alat_comment ?? null,
      fasilAdminComment: row.fasil_admin_comment ?? null,
      updatedAt: toIsoString(row.review_updated_at),
    }));
    await this.writeRuntimeCache("bimtek_reviews", mapped);
    return mapped;
  }

  private async readVerifikasiOnlineReviews(): Promise<VerifikasiOnlineReviewRecord[]> {
    const cached = await this.readRuntimeCache<VerifikasiOnlineReviewRecord[]>("verifikasi_online_reviews");
    if (cached) return cached;
    const rows = await this.databaseService.query<WorkspaceVerifikasiOnlineReviewRow[]>(
      `
        SELECT
          r.npsn AS school_npsn,
          r.school_name,
          r.review_note_admin,
          r.review_note_equipment,
          r.approved_admin,
          r.approved_equipment,
          r.reviewed_admin_id,
          r.reviewed_admin_name,
          r.reviewed_admin_at,
          r.reviewed_equipment_id,
          r.reviewed_equipment_name,
          r.reviewed_equipment_at,
          r.review_updated_at,
          u_admin.email AS admin_email,
          u_admin.phone_number AS admin_phone,
          u_equip.email AS equipment_email,
          u_equip.phone_number AS equipment_phone
        FROM workspace_verifikasi_online_reviews r
        LEFT JOIN users u_admin ON u_admin.id = r.reviewed_admin_id
        LEFT JOIN users u_equip ON u_equip.id = r.reviewed_equipment_id
        ORDER BY r.review_updated_at DESC
      `,
    );

    const mapped = rows.map((row) => ({
      schoolNpsn: row.school_npsn,
      schoolName: row.school_name,
      reviewNoteAdmin: row.review_note_admin ?? null,
      reviewNoteEquipment: row.review_note_equipment ?? null,
      approvedAdmin:
        row.approved_admin === null ? null : Boolean(row.approved_admin),
      approvedEquipment:
        row.approved_equipment === null ? null : Boolean(row.approved_equipment),
      reviewedAdminId: row.reviewed_admin_id ?? null,
      reviewedAdminName: row.reviewed_admin_name ?? null,
      reviewedAdminAt: row.reviewed_admin_at ? toIsoString(row.reviewed_admin_at) : null,
      reviewedAdminEmail: (row as WorkspaceVerifikasiOnlineReviewRow & { admin_email?: string | null }).admin_email ?? null,
      reviewedAdminPhone: (row as WorkspaceVerifikasiOnlineReviewRow & { admin_phone?: string | null }).admin_phone ?? null,
      reviewedEquipmentId: row.reviewed_equipment_id ?? null,
      reviewedEquipmentName: row.reviewed_equipment_name ?? null,
      reviewedEquipmentAt: row.reviewed_equipment_at ? toIsoString(row.reviewed_equipment_at) : null,
      reviewedEquipmentEmail: (row as WorkspaceVerifikasiOnlineReviewRow & { equipment_email?: string | null }).equipment_email ?? null,
      reviewedEquipmentPhone: (row as WorkspaceVerifikasiOnlineReviewRow & { equipment_phone?: string | null }).equipment_phone ?? null,
      updatedAt: toIsoString(row.review_updated_at),
    }));
    await this.writeRuntimeCache("verifikasi_online_reviews", mapped);
    return mapped;
  }

  private async readSchoolLookup(): Promise<SchoolLookupRow[]> {
    const cached = await this.readRuntimeCache<SchoolLookupRow[]>("school_lookup");
    if (cached) return cached;
    const rows = await this.databaseService.query<SchoolLookupRow[]>("SELECT npsn AS id, npsn, name FROM schools ORDER BY name ASC");
    await this.writeRuntimeCache("school_lookup", rows);
    return rows;
  }

  private async readProposalBundles(): Promise<Record<string, ProposalBundleEntry>> {
    const cached = await this.readRuntimeCache<Record<string, ProposalBundleEntry>>("proposal_bundles");
    if (cached) return cached;
    const rows = await this.databaseService.query<
      ProposalDataRow[] & { npsn: string | null }
    >(
      `
        SELECT
          p.npsn AS school_id,
          s.npsn,
          p.proposal_tables_json,
          p.rpkp_selections_json,
          p.updated_at
        FROM workspace_school_proposal_data p
        LEFT JOIN schools s ON s.npsn = p.npsn
      `,
    );

    const byNpsn: Record<string, { proposalTables: unknown; rpkpSelections: unknown; updatedAt: string | null }> = {};
    for (const row of rows) {
      const npsn = normalizeText(row.npsn);
      if (npsn) {
        byNpsn[npsn] = this.mapProposalRow(row);
      }
    }
    await this.writeRuntimeCache("proposal_bundles", byNpsn);
    return byNpsn;
  }

  private mapProposalRow(row: ProposalDataRow) {
    return {
      proposalTables: parseJsonRecord(row.proposal_tables_json),
      rpkpSelections: parseJsonRecord(row.rpkp_selections_json),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  private async readEquipmentBundles(): Promise<Record<string, EquipmentBundleEntry>> {
    const cached = await this.readRuntimeCache<Record<string, EquipmentBundleEntry>>("equipment_bundles");
    if (cached) return cached;
    const rows = await this.databaseService.query<
      EquipmentDataRow[] & { npsn: string | null }
    >(
      `
        SELECT
          e.npsn AS school_id,
          s.npsn,
          e.equipment_tables_json,
          e.updated_at
        FROM workspace_school_equipment_data e
        LEFT JOIN schools s ON s.npsn = e.npsn
      `,
    );

    const byNpsn: Record<string, { equipmentTables: unknown; updatedAt: string | null }> = {};
    for (const row of rows) {
      const npsn = normalizeText(row.npsn);
      if (npsn) {
        byNpsn[npsn] = {
          equipmentTables: parseJsonRecord(row.equipment_tables_json),
          updatedAt: toIsoString(row.updated_at),
        };
      }
    }
    await this.writeRuntimeCache("equipment_bundles", byNpsn);
    return byNpsn;
  }

  // ✅ OPTIMIZATION: Filter by NPSN LIST DI DATABASE (bukan select 920MB full dulu!)
  // Impact: 1 NPSN detail load → backend parsing 11MB bukan 920MB (99% lebih cepat!)
  private async readProposalBundlesFiltered(npsnSet: Set<string>): Promise<Record<string, ProposalBundleEntry>> {
    if (npsnSet.size === 0) return {};
    const cacheKeyBase = "proposal_bundles::";
    let allCached = true;
    const out: Record<string, ProposalBundleEntry> = {};
    const needFetchNpsn: string[] = [];
    for (const n of npsnSet) {
      const c = await this.readRuntimeCache<ProposalBundleEntry>(cacheKeyBase + n);
      if (c) out[n] = c;
      else { allCached = false; needFetchNpsn.push(n); }
    }
    if (allCached) return out;

    const placeholders = needFetchNpsn.map(() => "?").join(",");
    const rows = await this.databaseService.query<ProposalDataRow[] & { npsn: string | null }>(
      `SELECT p.npsn AS school_id, s.npsn, p.proposal_tables_json, p.rpkp_selections_json, p.updated_at
       FROM workspace_school_proposal_data p
       LEFT JOIN schools s ON s.npsn = p.npsn
       WHERE s.npsn IN (${placeholders})`,
      needFetchNpsn,
    );
    for (const row of rows) {
      const npsn = normalizeText(row.npsn);
      if (!npsn) continue;
      const mapped = this.mapProposalRow(row);
      out[npsn] = mapped;
      await this.writeRuntimeCache(cacheKeyBase + npsn, mapped, 1000 * 60 * 30); // cache per-NPSN 30 menit
    }
    return out;
  }

  private async readEquipmentBundlesFiltered(npsnSet: Set<string>): Promise<Record<string, EquipmentBundleEntry>> {
    if (npsnSet.size === 0) return {};
    const cacheKeyBase = "equipment_bundles::";
    let allCached = true;
    const out: Record<string, EquipmentBundleEntry> = {};
    const needFetchNpsn: string[] = [];
    for (const n of npsnSet) {
      const c = await this.readRuntimeCache<EquipmentBundleEntry>(cacheKeyBase + n);
      if (c) out[n] = c;
      else { allCached = false; needFetchNpsn.push(n); }
    }
    if (allCached) return out;

    const placeholders = needFetchNpsn.map(() => "?").join(",");
    const rows = await this.databaseService.query<EquipmentDataRow[] & { npsn: string | null }>(
      `SELECT e.npsn AS school_id, s.npsn, e.equipment_tables_json, e.updated_at
       FROM workspace_school_equipment_data e
       LEFT JOIN schools s ON s.npsn = e.npsn
       WHERE s.npsn IN (${placeholders})`,
      needFetchNpsn,
    );
    for (const row of rows) {
      const npsn = normalizeText(row.npsn);
      if (!npsn) continue;
      const mapped = {
        equipmentTables: parseJsonRecord(row.equipment_tables_json),
        updatedAt: toIsoString(row.updated_at),
      };
      out[npsn] = mapped;
      await this.writeRuntimeCache(cacheKeyBase + npsn, mapped, 1000 * 60 * 30);
    }
    return out;
  }

  private async getSchoolProposalByNpsnDB(npsn: string) {
    const rows = await this.databaseService.query<ProposalDataRow[]>(
      `
        SELECT s.npsn, p.proposal_tables_json, p.rpkp_selections_json, p.updated_at
        FROM workspace_school_proposal_data p
        LEFT JOIN schools s ON s.npsn = p.npsn
        WHERE s.npsn = ?
        LIMIT 1
      `,
      [npsn],
    );

    const row = rows[0];
    return row
      ? this.mapProposalRow(row)
      : { proposalTables: {}, rpkpSelections: {}, updatedAt: null };
  }

  private async upsertSchoolProposalData(
    npsn: string,
    schoolId: string,
    proposalTables: unknown,
    rpkpSelections: unknown,
    meta?: {
      userId?: string | null;
      userRole?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
    existingConnection?: DialectConnection | null,
  ) {
    const userId = meta?.userId ?? null;
    const userRole = meta?.userRole ?? null;
    const ipAddress = meta?.ipAddress ?? null;
    const userAgent = meta?.userAgent ?? null;
    const requestId = meta?.requestId ?? null;

    const exec = async (connection: DialectConnection) => {
        const rowsLockRaw = await connection.query<RowDataPacket[]>(
          `
          SELECT p.npsn, p.proposal_tables_json, p.rpkp_selections_json, p.version, p.data_sha256
          FROM workspace_school_proposal_data p
          WHERE p.npsn = ?
          LIMIT 1
          FOR UPDATE
        `,
          [npsn],
        );
        const rowsLock = normalizeRows<RowDataPacket>(rowsLockRaw);
        const existingRow = rowsLock?.[0] ?? null;

        let oldTables: Record<string, unknown> = {};
        let oldRpkp: Record<string, unknown> = {};
        let oldVersion: number = 0;
        let oldHash: string | null = null;
        let isInsert: boolean = true;

        if (existingRow) {
          isInsert = false;
          try {
            oldTables = parseJsonRecord(existingRow.proposal_tables_json ?? null, true) as Record<string, unknown>;
            oldRpkp = parseJsonRecord(existingRow.rpkp_selections_json ?? null, true) as Record<string, unknown>;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[upsertSchoolProposalData:strict-parse] npsn=${npsn} CORRUPT → reject write: ${msg}`);
            throw new ConflictException(
              `Data proposal sekolah (NPSN: ${npsn}) terdeteksi CORRUPT di database. ` +
                `Simpan ditolak untuk melindungi data. Silakan restore dari tabel history atau backup. Detail: ${msg}`,
            );
          }
          oldVersion = Number(existingRow.version ?? 0);
          oldHash = (existingRow.data_sha256 as string | null) ?? null;
        }

        const newTables =
          typeof proposalTables === "object" && proposalTables !== null
            ? (proposalTables as Record<string, unknown>)
            : ({} as Record<string, unknown>);
        const afterGlobalCardPreserve = preserveGlobalCardData(oldTables, newTables);
        const preservedProposalTables = preservePayloadObject(oldTables, afterGlobalCardPreserve, {});
        const preservedRpkpSelections = preservePayloadObject(oldRpkp, rpkpSelections, {});

        const finalObjForHash: Record<string, unknown> = {
          proposalTables: preservedProposalTables,
          rpkpSelections: preservedRpkpSelections,
        };
        const oldBytes = computeObjectBytes({ proposalTables: oldTables, rpkpSelections: oldRpkp });
        const newBytes = computeObjectBytes(finalObjForHash);
        const BIG_THRESHOLD = 50_000;
        if (oldBytes > BIG_THRESHOLD && newBytes > 0 && newBytes < oldBytes * 0.25) {
          this.logger.warn(
            `[upsertSchoolProposalData:DrasticShrinkTxn] npsn=${npsn} ` +
              `${oldBytes}B -> ${newBytes}B (${((newBytes / (oldBytes || 1)) * 100).toFixed(1)}%) — REJECT.`,
          );
          throw new ConflictException(
            `PENYUSUTAN_DATA_PROPOSAL_DRASTIS: ${oldBytes.toLocaleString("id-ID")}B → ` +
              `${newBytes.toLocaleString("id-ID")}B (${((newBytes / (oldBytes || 1)) * 100).toFixed(1)}%). ` +
              `Write diblokir untuk mencegah overwrite data survey besar dari draf kosong.`,
          );
        }

        const diffProposal = computeDiffSummary(oldTables, preservedProposalTables);
        const diffRpkp = computeDiffSummary(oldRpkp, preservedRpkpSelections);
        const diffSummaryAgg: Record<string, unknown> = {
          proposal: diffProposal,
          rpkp: diffRpkp,
          bytesTotalOld: oldBytes,
          bytesTotalNew: newBytes,
          bytesDelta: newBytes - oldBytes,
        };
        await insertProposalHistorySnapshot(connection, {
          schoolId,
          operationType: isInsert ? "I" : "U",
          oldProposalTables: oldTables,
          oldRpkpSelections: oldRpkp,
          oldVersion,
          changedByUserId: userId,
          changeIp: ipAddress,
          diffSummary: diffSummaryAgg,
        });

        const nextVersion = oldVersion + 1;
        const proposalStr = JSON.stringify(preservedProposalTables);
        const rpkpStr = JSON.stringify(preservedRpkpSelections);
        const nextHash = computeSha256(proposalStr + "||" + rpkpStr + "||v" + String(nextVersion));

        if (isInsert) {
          await this.databaseService.executeUpsert(connection, {
            table: "workspace_school_proposal_data",
            columns: ["npsn", "proposal_tables_json", "rpkp_selections_json", "version", "data_sha256"],
            values: [npsn, proposalStr, rpkpStr, nextVersion, nextHash],
            conflictKeys: ["npsn"],
            updates: ["proposal_tables_json", "rpkp_selections_json", "data_sha256"],
            customUpdates: { version: "version + 1" },
          });
        } else {
          await connection.execute(
            `
            UPDATE workspace_school_proposal_data
            SET proposal_tables_json = ?,
                rpkp_selections_json = ?,
                version = ?,
                data_sha256 = ?
            WHERE npsn = ? AND version = ?
          `,
            [proposalStr, rpkpStr, nextVersion, nextHash, npsn, oldVersion],
          );
        }

        await writeSystemAuditLog(connection, {
          actorUserId: userId,
          actorRole: userRole,
          module: "proposal",
          action: isInsert ? "CREATE" : "UPDATE",
          tableName: "workspace_school_proposal_data",
          recordId: npsn,
          oldHash,
          newHash: nextHash,
          rowcountDelta: isInsert ? 1 : 0,
          bytesDelta: BigInt(newBytes - oldBytes),
          ipAddress,
          userAgent,
          requestId,
        });

        return {
          preservedProposalTables,
          preservedRpkpSelections,
          nextVersion,
          nextHash,
        };
    };

    const result = existingConnection
      ? await exec(existingConnection)
      : await this.databaseService.transaction(exec, { isolationLevel: "SERIALIZABLE" });

    return {
      preservedProposalTables: result.preservedProposalTables,
      preservedRpkpSelections: result.preservedRpkpSelections,
      version: result.nextVersion,
      dataSha256: result.nextHash,
    };
  }

  private async getSchoolEquipmentByNpsnDB(npsn: string) {
    const rows = await this.databaseService.query<EquipmentDataRow[]>(
      `
        SELECT s.npsn, e.equipment_tables_json, e.updated_at
        FROM workspace_school_equipment_data e
        LEFT JOIN schools s ON s.npsn = e.npsn
        WHERE s.npsn = ?
        LIMIT 1
      `,
      [npsn],
    );

    const row = rows[0];
    return row
      ? {
          equipmentTables: parseJsonRecord(row.equipment_tables_json),
          updatedAt: toIsoString(row.updated_at),
        }
      : { equipmentTables: {}, updatedAt: null };
  }

  private async upsertSchoolEquipmentData(
    npsn: string,
    schoolId: string,
    equipmentTables: unknown,
    meta?: {
      userId?: string | null;
      userRole?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
    existingConnection?: DialectConnection | null,
  ) {
    const userId = meta?.userId ?? null;
    const userRole = meta?.userRole ?? null;
    const ipAddress = meta?.ipAddress ?? null;
    const userAgent = meta?.userAgent ?? null;
    const requestId = meta?.requestId ?? null;

    const exec = async (connection: DialectConnection) => {
        const rowsLockRaw = await connection.query<RowDataPacket[]>(
          `
          SELECT e.npsn, e.equipment_tables_json, e.version, e.data_sha256
          FROM workspace_school_equipment_data e
          WHERE e.npsn = ?
          LIMIT 1
          FOR UPDATE
        `,
          [npsn],
        );
        const rowsLock = normalizeRows<RowDataPacket>(rowsLockRaw);
        const existingRow = rowsLock?.[0] ?? null;

        let oldTables: Record<string, unknown> = {};
        let oldVersion: number = 0;
        let oldHash: string | null = null;
        let isInsert: boolean = true;

        if (existingRow) {
          isInsert = false;
          try {
            oldTables = parseJsonRecord(existingRow.equipment_tables_json ?? null, true) as Record<string, unknown>;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[upsertSchoolEquipmentData:strict-parse] npsn=${npsn} CORRUPT → reject: ${msg}`);
            throw new ConflictException(
              `Data equipment sekolah (NPSN: ${npsn}) terdeteksi CORRUPT di database. ` +
                `Simpan ditolak untuk melindungi data. Silakan restore history atau backup. Detail: ${msg}`,
            );
          }
          oldVersion = Number(existingRow.version ?? 0);
          oldHash = (existingRow.data_sha256 as string | null) ?? null;
        }

        const preservedEquipmentTables = preservePayloadObject(oldTables, equipmentTables, {});

        const oldBytes = computeObjectBytes(oldTables);
        const newBytes = computeObjectBytes(preservedEquipmentTables);
        const BIG_THRESHOLD = 50_000;
        if (oldBytes > BIG_THRESHOLD && newBytes > 0 && newBytes < oldBytes * 0.25) {
          this.logger.warn(
            `[upsertSchoolEquipmentData:DrasticShrinkTxn] npsn=${npsn} ` +
              `${oldBytes}B → ${newBytes}B (${((newBytes / (oldBytes || 1)) * 100).toFixed(1)}%) — REJECT.`,
          );
          throw new ConflictException(
            `PENYUSUTAN_DATA_ALAT_DRASTIS: ${oldBytes.toLocaleString("id-ID")}B → ` +
              `${newBytes.toLocaleString("id-ID")}B (${((newBytes / (oldBytes || 1)) * 100).toFixed(1)}%). ` +
              `Write diblokir (draf kosong terdeteksi).`,
          );
        }

        const diff = computeDiffSummary(oldTables, preservedEquipmentTables);
        await insertEquipmentHistorySnapshot(connection, {
          schoolId,
          operationType: isInsert ? "I" : "U",
          oldEquipmentTables: oldTables,
          oldVersion,
          changedByUserId: userId,
          changeIp: ipAddress,
          diffSummary: { ...diff, bytesTotalOld: oldBytes, bytesTotalNew: newBytes },
        });

        const nextVersion = oldVersion + 1;
        const eqStr = JSON.stringify(preservedEquipmentTables);
        const nextHash = computeSha256(eqStr + "||v" + String(nextVersion));

        if (isInsert) {
          await this.databaseService.executeUpsert(connection, {
            table: "workspace_school_equipment_data",
            columns: ["npsn", "equipment_tables_json", "version", "data_sha256"],
            values: [npsn, eqStr, nextVersion, nextHash],
            conflictKeys: ["npsn"],
            updates: ["equipment_tables_json", "data_sha256"],
            customUpdates: { version: "version + 1" },
          });
        } else {
          await connection.execute(
            `
            UPDATE workspace_school_equipment_data
            SET equipment_tables_json = ?, version = ?, data_sha256 = ?
            WHERE npsn = ? AND version = ?
          `,
            [eqStr, nextVersion, nextHash, npsn, oldVersion],
          );
        }

        await writeSystemAuditLog(connection, {
          actorUserId: userId,
          actorRole: userRole,
          module: "equipment",
          action: isInsert ? "CREATE" : "UPDATE",
          tableName: "workspace_school_equipment_data",
          recordId: npsn,
          oldHash,
          newHash: nextHash,
          rowcountDelta: isInsert ? 1 : 0,
          bytesDelta: BigInt(newBytes - oldBytes),
          ipAddress,
          userAgent,
          requestId,
        });

        return { preservedEquipmentTables, nextVersion, nextHash };
    };

    const result = existingConnection
      ? await exec(existingConnection)
      : await this.databaseService.transaction(exec, { isolationLevel: "SERIALIZABLE" });

    return {
      preservedEquipmentTables: result.preservedEquipmentTables,
      version: result.nextVersion,
      dataSha256: result.nextHash,
    };
  }

  private async ensureSchema() {
    try {
      if (!this.databaseService?.query || typeof this.databaseService.query !== "function") {
        this.logger.warn("[ensureSchema] ⚠️ databaseService.query belum siap; skip ensure schema workspace-data (non-fatal).");
        return;
      }
    } catch {
      return;
    }
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_school_records (
        id CHAR(26) NOT NULL,
        dataset_key VARCHAR(16) NOT NULL,
        school_no INT NOT NULL,
        school_npsn VARCHAR(32) NOT NULL,
        school_name VARCHAR(255) NOT NULL,
        province VARCHAR(128) NULL,
        city VARCHAR(128) NULL,
        district VARCHAR(128) NULL,
        note TEXT NULL,
        is_selected TINYINT(1) NULL,
        raw_payload JSON NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_ws_records_dataset_npsn (dataset_key, school_npsn),
        KEY idx_ws_records_npsn (school_npsn),
        KEY idx_ws_records_province (province),
        KEY idx_ws_records_selected (dataset_key, is_selected)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_school_assignments (
        id CHAR(26) NOT NULL,
        module_key ENUM('wawancara','bimbingan-teknis','verifikasi-online','pra-bimtek') NOT NULL,
        source_tab ENUM('bantuan','abt') NOT NULL,
        school_no INT NOT NULL DEFAULT 0,
        school_npsn VARCHAR(32) NOT NULL,
        school_name VARCHAR(255) NOT NULL,
        facilitator_administration_id VARCHAR(64) NULL,
        facilitator_administration_name VARCHAR(255) NOT NULL DEFAULT '',
        facilitator_equipment_id VARCHAR(64) NULL,
        facilitator_equipment_name VARCHAR(255) NOT NULL DEFAULT '',
        interview_scheduled_date DATE NULL,
        interview_scheduled_time VARCHAR(16) NULL,
        interview_meeting_link VARCHAR(500) NULL,
        pra_bimtek_scheduled_date DATE NULL,
        pra_bimtek_scheduled_time VARCHAR(16) NULL,
        pra_bimtek_meeting_link VARCHAR(500) NULL,
        bimtek_scheduled_date DATE NULL,
        bimtek_location VARCHAR(255) NULL,
        bimtek_status VARCHAR(32) NULL,
        raw_payload JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_workspace_assignment_module_tab_school (module_key, source_tab, school_npsn),
        KEY idx_ws_assign_source_tab (source_tab),
        KEY idx_ws_assign_fasilitator_adm (facilitator_administration_id),
        KEY idx_ws_assign_fasilitator_alat (facilitator_equipment_id),
        KEY idx_ws_assign_npsn (school_npsn)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Idempotent ALTER ADD COLUMN untuk existing table (MySQL 8 TIDAK support "ADD COLUMN IF NOT EXISTS" syntax)
    // Cek via information_schema.columns dulu — baru exec ALTER kalo count=0
    const colCheck = async (col: string) => {
      const row = await this.databaseService.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'workspace_school_assignments' AND column_name = ?`,
        [col],
      );
      return Number(row?.[0]?.cnt ?? 0) === 0;
    };
    if (await colCheck("interview_scheduled_date")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN interview_scheduled_date DATE NULL AFTER facilitator_equipment_name`);
    }
    if (await colCheck("interview_scheduled_time")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN interview_scheduled_time VARCHAR(16) NULL AFTER interview_scheduled_date`);
    }
    if (await colCheck("interview_meeting_link")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN interview_meeting_link VARCHAR(500) NULL AFTER interview_scheduled_time`);
    }
    if (await colCheck("pra_bimtek_scheduled_date")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN pra_bimtek_scheduled_date DATE NULL AFTER interview_meeting_link`);
    }
    if (await colCheck("pra_bimtek_scheduled_time")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN pra_bimtek_scheduled_time VARCHAR(16) NULL AFTER pra_bimtek_scheduled_date`);
    }
    if (await colCheck("pra_bimtek_meeting_link")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN pra_bimtek_meeting_link VARCHAR(500) NULL AFTER pra_bimtek_scheduled_time`);
    }
    if (await colCheck("bimtek_scheduled_date")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN bimtek_scheduled_date DATE NULL AFTER pra_bimtek_meeting_link`);
    }
    if (await colCheck("bimtek_location")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN bimtek_location VARCHAR(255) NULL AFTER bimtek_scheduled_date`);
    }
    if (await colCheck("bimtek_status")) {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments ADD COLUMN bimtek_status VARCHAR(32) NULL AFTER bimtek_location`);
    }
    // Idempotent MODIFY enum module_key agar include 'pra-bimtek' (jika sebelumnya cuma 3 opsi)
    try {
      await this.databaseService.query(`ALTER TABLE workspace_school_assignments MODIFY COLUMN module_key ENUM('wawancara','bimbingan-teknis','verifikasi-online','pra-bimtek') NOT NULL`);
    } catch {
      // ignore jika sudah OK
    }
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_interview_assessments (
        id CHAR(26) NOT NULL,
        assignment_key VARCHAR(64) NOT NULL,
        school_npsn VARCHAR(32) NOT NULL,
        school_name VARCHAR(255) NOT NULL,
        facilitator_equipment_id VARCHAR(64) NULL,
        facilitator_equipment_name VARCHAR(255) NULL,
        answers_json JSON NULL,
        total_score DECIMAL(10,2) NULL,
        recommendation VARCHAR(32) NULL,
        note TEXT NULL,
        source_kind VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
        assessment_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_ws_interview_school_npsn (school_npsn),
        KEY idx_ws_interview_fasilitator_alat (facilitator_equipment_id),
        KEY idx_ws_interview_assignment (assignment_key),
        KEY idx_ws_interview_recommendation (recommendation)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_bimtek_reviews (
        id CHAR(26) NOT NULL,
        school_npsn VARCHAR(32) NOT NULL,
        school_name VARCHAR(255) NOT NULL,
        facilitator_equipment_id VARCHAR(64) NULL,
        facilitator_equipment_name VARCHAR(255) NULL,
        statuses_json JSON NULL,
        notes_json JSON NULL,
        fasil_alat_comment TEXT NULL,
        fasil_admin_comment TEXT NULL,
        review_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_ws_bimtek_school_npsn (school_npsn),
        KEY idx_ws_bimtek_fasilitator_alat (facilitator_equipment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Idempotent ALTER ADD COLUMN untuk workspace_bimtek_reviews (pastikan existing table punya 2 kolom komentar per role)
    const colBimtekCheck = async (col: string) => {
      const row = await this.databaseService.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'workspace_bimtek_reviews' AND column_name = ?`,
        [col],
      );
      return Number(row?.[0]?.cnt ?? 0) === 0;
    };
    if (await colBimtekCheck("fasil_alat_comment")) {
      await this.databaseService.query(`ALTER TABLE workspace_bimtek_reviews ADD COLUMN fasil_alat_comment TEXT NULL AFTER notes_json`);
    }
    if (await colBimtekCheck("fasil_admin_comment")) {
      await this.databaseService.query(`ALTER TABLE workspace_bimtek_reviews ADD COLUMN fasil_admin_comment TEXT NULL AFTER fasil_alat_comment`);
    }
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS master_rpd_pks_templates (
        id CHAR(26) NOT NULL,
        kind ENUM('IDENTITAS','ADMINISTRASI','SURVEY_HARGA','RPKP','RAB','RPD','PKS') NOT NULL,
        version_label VARCHAR(64) NOT NULL DEFAULT 'v1',
        tahun_ajaran VARCHAR(16) NOT NULL DEFAULT '2026/2027',
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        title VARCHAR(500) NOT NULL DEFAULT '',
        body_html LONGTEXT NOT NULL,
        notes TEXT NULL,
        created_by_user_id VARCHAR(64) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_kind_version (kind, version_label),
        KEY idx_active_kind (kind, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS school_instance_rpd_pks (
        id CHAR(26) NOT NULL,
        school_npsn VARCHAR(32) NOT NULL,
        school_name VARCHAR(255) NOT NULL DEFAULT '',
        module_context ENUM('pra-bimtek','bimbingan-teknis') NOT NULL DEFAULT 'pra-bimtek',
        kind ENUM('IDENTITAS','ADMINISTRASI','SURVEY_HARGA','RPKP','RAB','RPD','PKS') NOT NULL,
        template_id CHAR(26) NULL,
        body_html LONGTEXT NOT NULL,
        review_notes TEXT NULL,
        review_status ENUM('DRAFT','REVIEWED','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
        reviewed_by_user_id VARCHAR(64) NULL,
        reviewed_at DATETIME NULL,
        approved_by_user_id VARCHAR(64) NULL,
        approved_at DATETIME NULL,
        created_by_user_id VARCHAR(64) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_school_mod_kind (school_npsn, module_context, kind),
        KEY idx_status (review_status),
        KEY idx_kind (kind)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_school_proposal_data (
        school_id CHAR(26) PRIMARY KEY,
        proposal_tables_json JSON NULL,
        rpkp_selections_json JSON NULL,
        version INT NOT NULL DEFAULT 1,
        data_sha256 CHAR(64) NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    {
      const colCheck = async (tbl: string, col: string) => {
        const row = await this.databaseService.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
          [tbl, col],
        );
        return Number(row?.[0]?.cnt ?? 0) === 0;
      };
      if (await colCheck("workspace_school_proposal_data", "version")) {
        await this.databaseService.query(`ALTER TABLE workspace_school_proposal_data ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER rpkp_selections_json`);
      }
      if (await colCheck("workspace_school_proposal_data", "data_sha256")) {
        await this.databaseService.query(`ALTER TABLE workspace_school_proposal_data ADD COLUMN data_sha256 CHAR(64) NULL AFTER version`);
      }
    }
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_school_equipment_data (
        school_id CHAR(26) PRIMARY KEY,
        equipment_tables_json JSON NULL,
        version INT NOT NULL DEFAULT 1,
        data_sha256 CHAR(64) NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    {
      const colCheck = async (tbl: string, col: string) => {
        const row = await this.databaseService.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
          [tbl, col],
        );
        return Number(row?.[0]?.cnt ?? 0) === 0;
      };
      if (await colCheck("workspace_school_equipment_data", "version")) {
        await this.databaseService.query(`ALTER TABLE workspace_school_equipment_data ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER equipment_tables_json`);
      }
      if (await colCheck("workspace_school_equipment_data", "data_sha256")) {
        await this.databaseService.query(`ALTER TABLE workspace_school_equipment_data ADD COLUMN data_sha256 CHAR(64) NULL AFTER version`);
      }
    }
    // ========== _history tables (PRE-WRITE SNAPSHOT, Fix K11) ==========
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_school_proposal_data_history (
        history_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        operation_type CHAR(1) NOT NULL COMMENT 'I=INSERT, U=UPDATE, D=DELETE',
        school_id CHAR(26) NOT NULL,
        old_proposal_tables_json JSON NULL,
        old_rpkp_selections_json JSON NULL,
        old_version INT NULL,
        changed_by_user_id VARCHAR(64) NULL,
        change_ip VARCHAR(64) NULL,
        diff_summary JSON NULL,
        changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_prop_hist_school (school_id),
        KEY idx_prop_hist_changed_at (changed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_school_equipment_data_history (
        history_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        operation_type CHAR(1) NOT NULL COMMENT 'I=INSERT, U=UPDATE, D=DELETE',
        school_id CHAR(26) NOT NULL,
        old_equipment_tables_json JSON NULL,
        old_version INT NULL,
        changed_by_user_id VARCHAR(64) NULL,
        change_ip VARCHAR(64) NULL,
        diff_summary JSON NULL,
        changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eq_hist_school (school_id),
        KEY idx_eq_hist_changed_at (changed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS system_audit_log (
        audit_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actor_user_id VARCHAR(64) NULL,
        actor_role VARCHAR(32) NULL,
        module VARCHAR(64) NOT NULL,
        action VARCHAR(16) NOT NULL COMMENT 'CREATE/UPDATE/DELETE/DEPLOY',
        table_name VARCHAR(64) NULL,
        record_id VARCHAR(128) NULL,
        old_hash CHAR(64) NULL,
        new_hash CHAR(64) NULL,
        rowcount_delta INT NULL,
        bytes_delta VARCHAR(32) NULL,
        ip_address VARCHAR(64) NULL,
        user_agent TEXT NULL,
        request_id VARCHAR(64) NULL,
        KEY idx_audit_event_ts (event_ts),
        KEY idx_audit_actor (actor_user_id),
        KEY idx_audit_module_action (module, action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS workspace_verifikasi_online_reviews (
        id CHAR(26) NOT NULL,
        school_npsn VARCHAR(32) NOT NULL,
        school_name VARCHAR(255) NOT NULL,
        review_note_admin TEXT NULL,
        review_note_equipment TEXT NULL,
        approved_admin TINYINT(1) NULL,
        approved_equipment TINYINT(1) NULL,
        reviewed_admin_id VARCHAR(64) NULL,
        reviewed_admin_name VARCHAR(255) NULL,
        reviewed_admin_at DATETIME NULL,
        reviewed_equipment_id VARCHAR(64) NULL,
        reviewed_equipment_name VARCHAR(255) NULL,
        reviewed_equipment_at DATETIME NULL,
        review_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_verifikasi_online_school_npsn (school_npsn),
        KEY idx_verifikasi_online_adm (reviewed_admin_id),
        KEY idx_verifikasi_online_alat (reviewed_equipment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try {
      await this.databaseService.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) NULL AFTER email",
      );
    } catch {
      /* ignore — kolom sudah ada atau engine tidak support IF NOT EXISTS untuk ADD COLUMN */
    }
    try {
      const columns = (await this.databaseService.query(
        `SELECT COLUMN_NAME AS column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_number' LIMIT 1`,
      )) as unknown as Array<{ column_name: string }>;
      if (columns.length === 0) {
        await this.databaseService.query(
          "ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL AFTER email",
        );
      }
    } catch {
      /* ignore — fallback kedua jika INFORMATION_SCHEMA check gagal */
    }

    await this.ensureMinimumAbtSchools();
    await this.ensureSchoolUsersFromAbtDataset();
    await this.ensureMinimumMasterRpdPksTemplates();
  }

  private async ensureMinimumMasterRpdPksTemplates() {
    try {
      if (!this.databaseService?.query || typeof this.databaseService.query !== "function") return;
      const existing = await this.databaseService.query(
        "SELECT COUNT(*) AS cnt FROM master_rpd_pks_templates",
      ) as unknown as Array<RowDataPacket & { cnt?: number | bigint }>;
      if (Number(existing?.[0]?.cnt ?? 0) > 0) return;
      const nowIso = new Date();
      const rpdId = createId();
      const pksId = createId();
      const rpdTitle = "Template RPD Standar — Bantuan Sarana SMK Tahun " + new Date().getFullYear();
      const pksTitle = "Template PKS Lengkap (21 halaman) — Standar Sarana SMK";
      await this.databaseService.query(
        `
          INSERT INTO master_rpd_pks_templates
            (id, kind, version_label, tahun_ajaran, is_active, title, body_html, notes, created_by_user_id, created_at, updated_at)
          VALUES
            (?, 'RPD', 'default-v1', ?, 1, ?, ?, 'Template standar default RPD — isi otomatis dari placeholder 44 keys', NULL, ?, ?),
            (?, 'PKS', 'default-v1', ?, 1, ?, ?, 'Template standar default PKS Pasal 1-12 + SPTJM + Pakta Integritas + RPD/RAB + BAST/BAPB', NULL, ?, ?)
        `,
        [
          rpdId,
          `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          rpdTitle,
          DEFAULT_RPD_TEMPLATE_HTML,
          nowIso,
          nowIso,
          pksId,
          `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          pksTitle,
          DEFAULT_PKS_TEMPLATE_HTML,
          nowIso,
          nowIso,
        ],
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? "");
      this.logger.warn(
        `[ensureMinimumMasterRpdPksTemplates] ⚠️ Gagal seed master template RPD/PKS (non-fatal): ${msg || "-"}`,
      );
    }
  }

  private async findNpsnForUser(userId: string): Promise<string | null> {
    const rows = await this.databaseService.query<(RowDataPacket & { npsn: string | null })[]>(
      "SELECT s.npsn FROM users u LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn) WHERE u.id = ? LIMIT 1",
      [userId],
    );
    const direct = rows[0]?.npsn ?? null;
    if (direct) return direct;
    const fallback = await this.databaseService.query<(RowDataPacket & { npsn: string | null })[]>(
      "SELECT s.npsn FROM users u LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn) WHERE u.username = ? LIMIT 1",
      [userId],
    );
    return fallback[0]?.npsn ?? null;
  }

  private async findNpsnByUsername(usernameRaw: string): Promise<string | null> {
    const rows = await this.databaseService.query<(RowDataPacket & { npsn: string | null })[]>(
      "SELECT s.npsn FROM users u LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn) WHERE u.username = ? LIMIT 1",
      [usernameRaw],
    );
    return rows[0]?.npsn ?? null;
  }

  async getSchoolProposalByNpsn(npsnRaw: string) {
    const normNpsn = String(npsnRaw || "").trim();
    if (!normNpsn) {
      throw new NotFoundException("NPSN harus diisi.");
    }
    if (this.redisCacheService) {
      return this.getWorkspaceData(normNpsn, "proposal") as Promise<{ proposalTables: unknown; rpkpSelections: unknown; updatedAt: string | null }>;
    }
    return this.getSchoolProposalByNpsnDB(normNpsn);
  }

  async getSchoolEquipmentByNpsn(npsnRaw: string) {
    const normNpsn = String(npsnRaw || "").trim();
    if (!normNpsn) {
      throw new NotFoundException("NPSN harus diisi.");
    }
    if (this.redisCacheService) {
      return this.getWorkspaceData(normNpsn, "equipment") as Promise<{ equipmentTables: unknown; updatedAt: string | null }>;
    }
    return this.getSchoolEquipmentByNpsnDB(normNpsn);
  }

  async getActiveTemplate(kind: PrintTemplateKind): Promise<MasterRpdPksTemplateRow | null> {
    const rows = await this.databaseService.query<MasterRpdPksTemplateRow[]>(
      `SELECT * FROM master_rpd_pks_templates WHERE kind = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
      [kind],
    );
    return rows[0] ?? null;
  }

  async listAllTemplates(kind?: PrintTemplateKind): Promise<MasterRpdPksTemplateRow[]> {
    const params: unknown[] = [];
    const where = kind ? "WHERE kind = ?" : "";
    if (kind) params.push(kind);
    return this.databaseService.query<MasterRpdPksTemplateRow[]>(
      `SELECT * FROM master_rpd_pks_templates ${where} ORDER BY updated_at DESC`,
      params,
    );
  }

  async upsertTemplate(payload: {
    id?: string;
    kind: PrintTemplateKind;
    version_label?: string;
    tahun_ajaran?: string;
    is_active?: number | boolean;
    title: string;
    body_html: string;
    notes?: string | null;
    created_by_user_id?: string | null;
  }): Promise<MasterRpdPksTemplateRow | null> {
    const id = payload.id?.trim() || createId();
    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO master_rpd_pks_templates (
            id, kind, version_label, tahun_ajaran, is_active, title, body_html, notes, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            version_label = VALUES(version_label),
            tahun_ajaran = VALUES(tahun_ajaran),
            is_active = VALUES(is_active),
            title = VALUES(title),
            body_html = VALUES(body_html),
            notes = VALUES(notes)
        `,
        [
          id,
          payload.kind,
          payload.version_label ?? "v1",
          payload.tahun_ajaran ?? "2026/2027",
          payload.is_active === undefined ? 0 : Number(payload.is_active),
          payload.title ?? "",
          payload.body_html ?? "",
          payload.notes ?? null,
          payload.created_by_user_id ?? null,
        ],
      );
    });
    const rows = await this.databaseService.query<MasterRpdPksTemplateRow[]>(
      `SELECT * FROM master_rpd_pks_templates WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    await this.databaseService.query(`DELETE FROM master_rpd_pks_templates WHERE id = ? LIMIT 1`, [id]);
    return { success: true };
  }

  async setTemplateActive(id: string, kind: PrintTemplateKind): Promise<{ success: boolean }> {
    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `UPDATE master_rpd_pks_templates SET is_active = 0 WHERE kind = ? AND is_active = 1`,
        [kind],
      );
      await connection.execute(
        `UPDATE master_rpd_pks_templates SET is_active = 1 WHERE id = ? LIMIT 1`,
        [id],
      );
    });
    return { success: true };
  }

  async getSchoolInstance(
    school_npsn: string,
    module_context: "pra-bimtek" | "bimbingan-teknis",
    kind: PrintTemplateKind,
  ): Promise<SchoolInstanceRpdPksRow | null> {
    const rows = await this.databaseService.query<SchoolInstanceRpdPksRow[]>(
      `SELECT * FROM school_instance_rpd_pks WHERE school_npsn = ? AND module_context = ? AND kind = ? LIMIT 1`,
      [school_npsn, module_context, kind],
    );
    return rows[0] ?? null;
  }

  async listInstancesBySchoolModule(
    school_npsn: string,
    module_context: "pra-bimtek" | "bimbingan-teknis",
  ): Promise<SchoolInstanceRpdPksRow[]> {
    return this.databaseService.query<SchoolInstanceRpdPksRow[]>(
      `SELECT * FROM school_instance_rpd_pks WHERE school_npsn = ? AND module_context = ? ORDER BY updated_at DESC`,
      [school_npsn, module_context],
    );
  }

  async upsertSchoolInstance(payload: {
    id?: string;
    school_npsn: string;
    school_name?: string;
    module_context: "pra-bimtek" | "bimbingan-teknis";
    kind: PrintTemplateKind;
    template_id?: string | null;
    body_html: string;
    review_notes?: string | null;
    review_status?: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";
    reviewed_by_user_id?: string | null;
    approved_by_user_id?: string | null;
    created_by_user_id?: string | null;
  }): Promise<SchoolInstanceRpdPksRow | null> {
    const nowMysql = toMysqlDateTime(new Date().toISOString());
    let finalId = payload.id?.trim() || "";

    await this.databaseService.transaction(async (connection) => {
      const existingRaw = await connection.query<SchoolInstanceRpdPksRow[]>(
        `SELECT id, review_status FROM school_instance_rpd_pks WHERE school_npsn = ? AND module_context = ? AND kind = ? LIMIT 1`,
        [payload.school_npsn, payload.module_context, payload.kind],
      );
      const existingRows = normalizeRows<SchoolInstanceRpdPksRow>(existingRaw);
      const existing = existingRows[0];
      finalId = existing?.id || finalId || createId();

      const nextReviewStatus: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED" =
        payload.review_status ?? existing?.review_status ?? "DRAFT";
      const wasDraft = !existing || existing.review_status === "DRAFT";
      const becameNonDraft = wasDraft && nextReviewStatus !== "DRAFT";
      const becameApproved = nextReviewStatus === "APPROVED";

      const nextReviewedAt = becameNonDraft
        ? nowMysql
        : existing?.reviewed_at ?? null;
      const nextApprovedAt = becameApproved
        ? nowMysql
        : existing?.approved_at ?? null;
      const nextReviewedBy = becameNonDraft && payload.reviewed_by_user_id
        ? payload.reviewed_by_user_id
        : existing?.reviewed_by_user_id ?? (payload.reviewed_by_user_id ?? null);
      const nextApprovedBy = becameApproved && payload.approved_by_user_id
        ? payload.approved_by_user_id
        : existing?.approved_by_user_id ?? (payload.approved_by_user_id ?? null);

      await connection.execute(
        `
          INSERT INTO school_instance_rpd_pks (
            id, school_npsn, school_name, module_context, kind, template_id, body_html,
            review_notes, review_status, reviewed_by_user_id, reviewed_at,
            approved_by_user_id, approved_at, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            school_name = VALUES(school_name),
            template_id = VALUES(template_id),
            body_html = VALUES(body_html),
            review_notes = VALUES(review_notes),
            review_status = VALUES(review_status),
            reviewed_by_user_id = VALUES(reviewed_by_user_id),
            reviewed_at = VALUES(reviewed_at),
            approved_by_user_id = VALUES(approved_by_user_id),
            approved_at = VALUES(approved_at)
        `,
        [
          finalId,
          payload.school_npsn,
          payload.school_name ?? existing?.school_name ?? "",
          payload.module_context,
          payload.kind,
          payload.template_id ?? existing?.template_id ?? null,
          payload.body_html ?? "",
          payload.review_notes ?? existing?.review_notes ?? null,
          nextReviewStatus,
          nextReviewedBy,
          nextReviewedAt,
          nextApprovedBy,
          nextApprovedAt,
          payload.created_by_user_id ?? existing?.created_by_user_id ?? null,
        ],
      );
    });

    const rows = await this.databaseService.query<SchoolInstanceRpdPksRow[]>(
      `SELECT * FROM school_instance_rpd_pks WHERE id = ? LIMIT 1`,
      [finalId],
    );
    return rows[0] ?? null;
  }

  private async ensureMinimumAbtSchools() {
    try {
      const TARGET_ABT_TOTAL = 132;
      const MANDATORY_ABT_SCHOOLS = [
        {
          npsn: "10100617",
          nama_sekolah: "SMKS MUTIARA",
          provinsi: "DKI Jakarta",
          kab_kota: "Kota Administrasi Jakarta Pusat",
          kecamatan: "Menteng",
          catatan: "Ditambahkan otomatis (dokumen ABT) - Wajib masuk daftar penerima ABT",
        },
        {
          npsn: "12345678",
          nama_sekolah: "SMK Bina Vokasi Nusantara",
          provinsi: "Jawa Barat",
          kab_kota: "Kota Bogor",
          kecamatan: "Bogor Tengah",
          catatan: "Sekolah dummy dari data pengguna tab Pengguna - wajib masuk penerima ABT",
        },
      ];

      const maxNoRaw = (await this.databaseService.query<Array<RowDataPacket & { max_no: number | null }>>(
        "SELECT MAX(school_no) AS max_no FROM workspace_school_records WHERE dataset_key = ?",
        ["ABT"],
      ))[0];
      let nextNo = Math.max(Number(maxNoRaw?.max_no ?? 0), 0);

      for (const school of MANDATORY_ABT_SCHOOLS) {
        nextNo += 1;
        const existing = (await this.databaseService.query<Array<RowDataPacket & { id: string }>>(
          "SELECT id FROM workspace_school_records WHERE dataset_key = ? AND school_npsn = ? LIMIT 1",
          ["ABT", school.npsn],
        ))[0];
        if (existing) continue;
        const rawPayload = {
          no: nextNo,
          npsn: school.npsn,
          nama_sekolah: school.nama_sekolah,
          provinsi: school.provinsi,
          kab_kota: school.kab_kota,
          kecamatan: school.kecamatan,
          catatan: school.catatan,
          status_penerima_abt: true,
          fasilitator_administrasi: "",
          fasilitator_peralatan: "",
        };
        await this.databaseService.query(
          `
            INSERT INTO workspace_school_records (
              id,
              dataset_key,
              source_tab,
              school_no,
              school_npsn,
              school_name,
              province,
              city,
              district,
              note,
              is_selected,
              raw_payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            createId(),
            "ABT",
            "bantuan",
            nextNo,
            school.npsn,
            school.nama_sekolah,
            school.provinsi,
            school.kab_kota,
            school.kecamatan,
            school.catatan,
            1,
            JSON.stringify(rawPayload),
          ],
        );
        this.logger.log(
          `[ensureMinimumAbtSchools] ✅ Injeksi sekolah ABT wajib NPSN ${school.npsn} (${school.nama_sekolah}) berhasil.`,
        );
      }

      const countRaw = (await this.databaseService.query<Array<RowDataPacket & { cnt: number }>>(
        "SELECT COUNT(*) AS cnt FROM workspace_school_records WHERE dataset_key = ?",
        ["ABT"],
      ))[0];
      const currentCount = Number(countRaw?.cnt ?? 0);
      if (currentCount < TARGET_ABT_TOTAL) {
        const needDummy = TARGET_ABT_TOTAL - currentCount;
        const dummyBaseNo = Math.max(
          nextNo,
          Number(maxNoRaw?.max_no ?? 0),
        );
        for (let i = 1; i <= needDummy; i += 1) {
          nextNo += 1;
          const seedNo = dummyBaseNo + i;
          const npsn = `000${seedNo}`.slice(-8);
          const nama = `SMK Pelengkap ABT ${String(i).padStart(3, "0")}`;
          const rawPayload = {
            no: nextNo,
            npsn,
            nama_sekolah: nama,
            provinsi: "Provinsi",
            kab_kota: "Kab/Kota",
            kecamatan: "Kecamatan",
            catatan: `Sekolah pelengkap agar total ABT = ${TARGET_ABT_TOTAL}`,
            status_penerima_abt: true,
            fasilitator_administrasi: "",
            fasilitator_peralatan: "",
          };
          await this.databaseService.query(
            `
              INSERT INTO workspace_school_records (
                id,
                dataset_key,
                source_tab,
                school_no,
                school_npsn,
                school_name,
                province,
                city,
                district,
                note,
                is_selected,
                raw_payload
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              createId(),
              "ABT",
              "bantuan",
              nextNo,
              npsn,
              nama,
              "Provinsi",
              "Kab/Kota",
              "Kecamatan",
              rawPayload.catatan,
              1,
              JSON.stringify(rawPayload),
            ],
          );
        }
        this.logger.log(
          `[ensureMinimumAbtSchools] ✅ Ditambahkan ${needDummy} sekolah ABT pelengkap agar total = ${TARGET_ABT_TOTAL}.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[ensureMinimumAbtSchools] ⚠️ Gagal ensure minimal ABT school (non-fatal): ${msg}.`,
      );
    }
  }

  private async ensureSchoolUsersFromAbtDataset() {
    try {
      const abtRows = await this.databaseService.query<Array<RowDataPacket & {
        school_npsn: string;
        school_name: string;
        province: string | null;
        city: string | null;
      }>>(
        "SELECT school_npsn, school_name, province, city FROM workspace_school_records WHERE dataset_key = ? ORDER BY school_no ASC",
        ["ABT"],
      );
      if (!Array.isArray(abtRows) || abtRows.length === 0) return;

      const bcryptAvailable = await import("bcryptjs")
        .then((mod) => mod.default ?? (mod as unknown as typeof import("bcryptjs")))
        .catch(() => null);
      if (!bcryptAvailable) {
        this.logger.warn(
          "[ensureSchoolUsersFromAbtDataset] ⚠️ bcryptjs tidak tersedia (non-fatal), skip ensure user sekolah ABT.",
        );
        return;
      }

      const schoolRoleRaw = (await this.databaseService.query<Array<RowDataPacket & { id: number; code: string }>>(
        "SELECT id, code FROM roles WHERE code = ? LIMIT 1",
        ["SEKOLAH"],
      ))[0];
      if (!schoolRoleRaw) return;

      let totalCreated = 0;
      for (const row of abtRows) {
        const npsn = String(row.school_npsn ?? "").trim();
        if (!npsn || npsn.length < 6) continue;

        const existingRaw = (await this.databaseService.query<Array<RowDataPacket & { id: string }>>(
          `
            SELECT u.id
            FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE r.code = 'SEKOLAH' AND LOWER(u.username) = LOWER(?)
            LIMIT 1
          `,
          [npsn],
        ))[0];
        if (existingRaw) continue;

        const schoolName = String(row.school_name ?? "").trim() || `SMK ${npsn}`;
        let schoolId: string | null = null;
        const existingSchool = (await this.databaseService.query<Array<RowDataPacket & { id: string }>>(
          "SELECT id FROM schools WHERE npsn = ? LIMIT 1",
          [npsn],
        ))[0];
        if (existingSchool) {
          schoolId = existingSchool.id;
        } else {
          schoolId = createId();
          await this.databaseService.query(
            `
              INSERT INTO schools (
                id, npsn, name, province_code, city_code, address, principal_name, contact_name, contact_phone, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `,
            [
              schoolId,
              npsn,
              schoolName,
              String(row.province ?? "-") || "-",
              String(row.city ?? "-") || "-",
              "-",
              "-",
              schoolName,
              null,
            ],
          );
        }

        const userId = createId();
        const perSchoolPassword = generatePerSchoolPassword(14);
        const perSchoolHash = await bcryptAvailable.hash(perSchoolPassword, 10);
        await this.databaseService.query(
          `
            INSERT INTO users (
              id,
              username,
              full_name,
              email,
              phone_number,
              school_id,
              password_hash,
              password_default_plaintext,
              password_changed_at,
              is_active,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NOW())
          `,
          [
            userId,
            npsn,
            schoolName,
            null,
            null,
            schoolId,
            perSchoolHash,
            perSchoolPassword,
          ],
        );

        const userRoleLinkId = createId();
        await this.databaseService.query(
          "INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)",
          [userRoleLinkId, userId, Number(schoolRoleRaw.id)],
        );
        totalCreated += 1;
      }

      const suffix =
        totalCreated > 0
          ? ` ${totalCreated} akun BARU di-generate dengan password UNIK per sekolah.`
          : " (semua akun sekolah sudah ada sebelumnya, tidak ada akun baru dibuat).";
      this.logger.log(
        `[ensureSchoolUsersFromAbtDataset] ✅ Sinkron user sekolah ABT selesai (dari ${abtRows.length} calon).` +
          suffix +
          " Setiap akun sekolah memakai username=NPSN dan password default disimpan di kolom users.password_default_plaintext; user AKAN DIPAKSA mengganti password pada login pertama.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[ensureSchoolUsersFromAbtDataset] ⚠️ Gagal ensure user sekolah ABT (non-fatal): ${msg}.`,
      );
    }
  }
}

function generatePerSchoolPassword(length = 14) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

class JsonCorruptionError extends Error {
  constructor(detail: string) {
    super(`JSON_RECORD_CORRUPT: ${detail}`);
    this.name = "JsonCorruptionError";
  }
}

function parseJsonRecord(value: unknown, strict = true): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      if (strict) {
        throw new JsonCorruptionError("JSON string kosong / whitespace saja");
      }
      return {};
    }
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch (err) {
      const snippet = trimmed.slice(0, 120);
      const msg = err instanceof Error ? err.message : String(err);
      if (strict) {
        throw new JsonCorruptionError(`Parse gagal: ${msg} · snippet="${snippet}"`);
      }
      return {};
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (strict && Array.isArray(value)) {
    throw new JsonCorruptionError(`Expected object, tapi bertipe array (len=${value.length})`);
  }
  return {};
}

function computeObjectBytes(v: unknown): number {
  if (v === null || v === undefined) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(v), "utf8");
  } catch {
    return 0;
  }
}

function computeSha256(data: string | Buffer | object): string {
  const input = typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data ?? {});
  return createHash("sha256").update(input).digest("hex");
}

function countTopLevelKeysAndValues(obj: unknown): { keys: number; totalNested: number } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { keys: 0, totalNested: 0 };
  }
  const keys = Object.keys(obj as Record<string, unknown>).length;
  let nested = 0;
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[k];
    if (v && typeof v === "object") nested += Array.isArray(v) ? v.length : Object.keys(v as Record<string, unknown>).length;
  }
  return { keys, totalNested: nested };
}

function computeDiffSummary(
  oldObj: unknown,
  newObj: unknown,
): { keysBefore: number; keysAfter: number; bytesBefore: number; bytesAfter: number; bytesDelta: number } {
  const before = countTopLevelKeysAndValues(oldObj);
  const after = countTopLevelKeysAndValues(newObj);
  const bytesBefore = computeObjectBytes(oldObj);
  const bytesAfter = computeObjectBytes(newObj);
  return {
    keysBefore: before.keys,
    keysAfter: after.keys,
    bytesBefore,
    bytesAfter,
    bytesDelta: bytesAfter - bytesBefore,
  };
}

async function insertProposalHistorySnapshot(
  connection: PoolConnection,
  payload: {
    schoolId: string;
    operationType: "I" | "U" | "D";
    oldProposalTables: Record<string, unknown> | null;
    oldRpkpSelections: Record<string, unknown> | null;
    oldVersion: number | null;
    changedByUserId: string | null;
    changeIp: string | null;
    diffSummary: Record<string, unknown> | null;
  },
) {
  try {
    await connection.execute(
      `
        INSERT INTO workspace_school_proposal_data_history
          (operation_type, school_id, old_proposal_tables_json, old_rpkp_selections_json,
           old_version, changed_by_user_id, change_ip, diff_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.operationType,
        payload.schoolId,
        payload.oldProposalTables !== null ? JSON.stringify(payload.oldProposalTables) : null,
        payload.oldRpkpSelections !== null ? JSON.stringify(payload.oldRpkpSelections) : null,
        payload.oldVersion,
        payload.changedByUserId,
        payload.changeIp ?? null,
        payload.diffSummary !== null ? JSON.stringify(payload.diffSummary) : null,
      ],
    );
  } catch (err) {
    // History insert JANGAN sampai menyebabkan main transaction gagal — tapi LOG warning biar ketahuan
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`[insertProposalHistorySnapshot] non-fatal: ${msg}`, "WorkspaceDataService");
  }
}

async function insertEquipmentHistorySnapshot(
  connection: PoolConnection,
  payload: {
    schoolId: string;
    operationType: "I" | "U" | "D";
    oldEquipmentTables: Record<string, unknown> | null;
    oldVersion: number | null;
    changedByUserId: string | null;
    changeIp: string | null;
    diffSummary: Record<string, unknown> | null;
  },
) {
  try {
    await connection.execute(
      `
        INSERT INTO workspace_school_equipment_data_history
          (operation_type, school_id, old_equipment_tables_json, old_version,
           changed_by_user_id, change_ip, diff_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.operationType,
        payload.schoolId,
        payload.oldEquipmentTables !== null ? JSON.stringify(payload.oldEquipmentTables) : null,
        payload.oldVersion,
        payload.changedByUserId,
        payload.changeIp ?? null,
        payload.diffSummary !== null ? JSON.stringify(payload.diffSummary) : null,
      ],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`[insertEquipmentHistorySnapshot] non-fatal: ${msg}`, "WorkspaceDataService");
  }
}

async function writeSystemAuditLog(
  connection: PoolConnection,
  entry: {
    actorUserId: string | null;
    actorRole: string | null;
    module: string;
    action: "CREATE" | "UPDATE" | "DELETE" | "DEPLOY";
    tableName: string;
    recordId: string;
    oldHash: string | null;
    newHash: string | null;
    rowcountDelta: number | null;
    bytesDelta: bigint | number | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
  },
) {
  try {
    await connection.execute(
      `
        INSERT INTO system_audit_log
          (actor_user_id, actor_role, module, action, table_name, record_id,
           old_hash, new_hash, rowcount_delta, bytes_delta,
           ip_address, user_agent, request_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        entry.actorUserId,
        entry.actorRole,
        entry.module,
        entry.action,
        entry.tableName,
        entry.recordId,
        entry.oldHash,
        entry.newHash,
        entry.rowcountDelta,
        entry.bytesDelta !== null && typeof entry.bytesDelta === "bigint" ? String(entry.bytesDelta) : entry.bytesDelta,
        entry.ipAddress,
        entry.userAgent,
        entry.requestId,
      ],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`[writeSystemAuditLog] non-fatal: ${msg}`, "WorkspaceDataService");
  }
}

function isGlobalCardMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>);
    if (keys.length === 0) return false;
    for (const k of keys) {
      if (isGlobalCardMeaningful((v as Record<string, unknown>)[k])) return true;
    }
    return false;
  }
  return false;
}

function preservePayloadObject(
  oldPayload: unknown,
  newPayload: unknown,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  const oldSafe =
    typeof oldPayload === "object" && oldPayload !== null ? (oldPayload as Record<string, unknown>) : null;
  const newSafe =
    typeof newPayload === "object" && newPayload !== null ? (newPayload as Record<string, unknown>) : null;
  if (!oldSafe) return newSafe ?? fallback;
  if (!newSafe) return oldSafe ?? fallback;
  // --- SIZE-BASED DRASTIC SHRINK GUARD (CEGAH overwrite 13.9MB → 29KB bug TKL) ---
  // Jika payload lama besar (>50KB = data survey user sudah isi), baru drastis mengecil (<50KB)
  // DAN ukuran baru < 50% ukuran lama (shrink ratio > 2x) → ANOMALI = draft localStorage kosong.
  // Tolak newPayload, gunakan oldPayload yang valid.
  try {
    const oldBytes = Buffer.byteLength(JSON.stringify(oldSafe), "utf8");
    const newBytes = Buffer.byteLength(JSON.stringify(newSafe), "utf8");
    const SIZE_THRESHOLD_BIG = 50_000; // 50 KB
    const SHRINK_RATIO = 2; // new harus minimal 50% dari old
    if (oldBytes > SIZE_THRESHOLD_BIG && newBytes < SIZE_THRESHOLD_BIG && oldBytes > newBytes * SHRINK_RATIO) {
      return oldSafe;
    }
  } catch {
    /* jika JSON.stringify gagal → lanjut (fallback ke logika berikutnya) */
  }
  const newIsMeaningful = Object.keys(newSafe).length > 0 && isGlobalCardMeaningful(newSafe);
  if (!newIsMeaningful) return oldSafe;
  return newSafe;
}

function preserveGlobalCardData(
  oldTables: Record<string, unknown>,
  newTables: Record<string, unknown>,
): Record<string, unknown> {
  if (!oldTables || typeof oldTables !== "object") return newTables ?? {};
  if (!newTables || typeof newTables !== "object") return oldTables ?? {};
  const result = { ...newTables } as Record<string, unknown>;
  const globalKeys = Object.keys(oldTables).filter((k) => k.startsWith("__global_"));
  for (const k of globalKeys) {
    const oldVal = oldTables[k];
    if (!isGlobalCardMeaningful(oldVal)) continue;
    const newVal = (newTables as Record<string, unknown>)[k];
    if (!isGlobalCardMeaningful(newVal)) {
      result[k] = oldVal;
    }
  }
  return result;
}

function toMysqlDateTime(value: string) {
  const parsed = new Date(value);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return safeDate.toISOString().slice(0, 19).replace("T", " ");
}

function toIsoString(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUserName(value: string) {
  return normalizeText(value.replace(/\s+(PRISMA|SARANA\s*SMK)$/i, ""));
}

function emptyToNull(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function createId() {
  return `${Date.now().toString(36)}${randomBytes(10).toString("hex")}`.slice(0, 26).padEnd(26, "0");
}
