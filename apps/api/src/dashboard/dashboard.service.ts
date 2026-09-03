import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";

import { roleSlugMap, slugRoleMap, type UserRole } from "../common/constants/roles.js";
import { DatabaseService } from "../database/database.service.js";

interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  tone: "primary" | "success" | "warning" | "danger";
}

interface DashboardPanel {
  title: string;
  description: string;
  items: string[];
}

interface SchoolProfileSummary {
  schoolName: string;
  npsn: string;
  principalName: string;
  operatorName: string;
  region: string;
  lastUpdate: string;
  profileStatus: string;
}

interface DashboardPayload {
  headline: string;
  summary: string;
  metrics: DashboardMetric[];
  focus: DashboardPanel[];
  schoolProfile?: SchoolProfileSummary | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

const FORBIDDEN_CODES = new Set([
  "403_forbidden_access",
]);

void FORBIDDEN_CODES;

function formatNumber(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("id-ID").format(Math.floor(n));
}

function mapVerificationTone(status: string | null): "success" | "warning" | "danger" | "primary" {
  const s = String(status ?? "").toUpperCase();
  if (s.includes("TERVERIFIKASI") || s.includes("SELESAI") || s.includes("APPROVED")) return "success";
  if (s.includes("MENUNGGU") || s.includes("PENDING") || s.includes("REVIEW")) return "warning";
  if (s.includes("DITOLAK") || s.includes("REVISI") || s.includes("GAGAL")) return "danger";
  return "primary";
}

@Injectable()
export class DashboardService {
  private static _globalSingletonInstance: DashboardService | null = null;
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) DashboardService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): DashboardService | null {
    const inst = DashboardService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): DashboardService {
    const existing = DashboardService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new DashboardService(db);
    DashboardService._globalSingletonInstance = fresh;
    return fresh;
  }

  async getDashboard(roleSlug: string, activeRole: UserRole) {
    const role = slugRoleMap[roleSlug];

    if (!role) {
      throw new NotFoundException("Dashboard tidak ditemukan.");
    }

    if (activeRole !== "SUPERADMIN" && role !== activeRole) {
      throw new ForbiddenException("Anda tidak memiliki akses ke dashboard ini.");
    }

    const stats = await this.getGlobalStats();

    switch (role) {
      case "SUPERADMIN":
        return this.buildSuperadminDashboard(stats);
      case "ADMIN":
        return this.buildAdminDashboard(stats);
      case "FASILITATOR_ALAT":
        return this.buildFasilitatorAlatDashboard(stats);
      case "FASILITATOR_ADMINISTRASI":
        return this.buildFasilitatorAdministrasiDashboard(stats);
      case "SEKOLAH":
        return this.buildSekolahDashboard(stats);
      case "KOORDINATOR_ALAT":
        return this.buildKoordinatorAlatDashboard(stats);
      case "PPK":
        return this.buildPpkDashboard(stats);
      default: {
        const _exhaustive: never = role;
        void _exhaustive;
        throw new NotFoundException("Dashboard tidak ditemukan.");
      }
    }
  }

  getDashboardPath(role: UserRole) {
    return roleSlugMap[role];
  }

  private async queryCount(sql: string, params: unknown[] = []): Promise<number> {
    try {
      const rows = await this.databaseService.query<CountRow[]>(sql, params);
      return Number(rows[0]?.total ?? 0);
    } catch (err) {
      console.warn(`[DashboardService] queryCount failed fallback 0: ${(err as Error).message}. SQL=${sql.slice(0, 120)}`);
      return 0;
    }
  }

  private async queryOne<T extends object>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.databaseService.query<RowDataPacket[]>(sql, params);
    return ((rows[0] as T | undefined) ?? null);
  }

  private async getGlobalStats() {
    const batchCountSql = `
      SELECT
        (SELECT COUNT(*) FROM schools) AS total_schools,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) AS total_active_users,
        (SELECT COUNT(DISTINCT u.id) FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'SEKOLAH') AS total_sekolah_users,
        (SELECT COUNT(DISTINCT u.id) FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'FASILITATOR_ALAT') AS total_fasilitator_alat,
        (SELECT COUNT(DISTINCT u.id) FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'FASILITATOR_ADMINISTRASI') AS total_fasilitator_adm,
        (SELECT COUNT(DISTINCT u.id) FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'KOORDINATOR_ALAT') AS total_koordinator,
        (SELECT COUNT(DISTINCT u.id) FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'PPK') AS total_ppk,
        (SELECT COUNT(DISTINCT u.id) FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'ADMIN') AS total_admin,
        (SELECT COUNT(*) FROM schools
         WHERE UPPER(verification_status) IN ('TERVERIFIKASI', 'VERIFIED', 'APPROVED', 'LULUS', 'SELESAI')) AS total_school_verified,
        (SELECT COUNT(*) FROM schools
         WHERE (verification_status IS NULL)
            OR (UPPER(verification_status) IN ('MENUNGGU_REVIEW', 'PENDING', 'MENUNGGU', 'IN_REVIEW', 'DALAM_REVIEW'))) AS total_school_pending,
        (SELECT COUNT(*) FROM schools
         WHERE UPPER(verification_status) IN ('DITOLAK', 'REJECTED', 'REVISI', 'GAGAL', 'PERLU_REVISI')) AS total_school_rejected,
        (SELECT COUNT(*) FROM workspace_school_assignments) AS total_assignments,
        (SELECT COUNT(*) FROM workspace_school_assignments WHERE module_key = 'wawancara') AS total_assignment_wawancara,
        (SELECT COUNT(*) FROM workspace_school_assignments WHERE module_key = 'verifikasi-online') AS total_assignment_verifikasi,
        (SELECT COUNT(*) FROM workspace_school_assignments WHERE module_key = 'bimbingan-teknis') AS total_assignment_bimbingan,
        (SELECT COUNT(*) FROM school_profile_concentrations) AS total_concentrations,
        (SELECT COUNT(DISTINCT province_code) FROM schools WHERE province_code IS NOT NULL AND province_code <> '') AS total_provinces,
        (SELECT COUNT(DISTINCT city_code) FROM schools WHERE city_code IS NOT NULL AND city_code <> '') AS total_cities,
        (SELECT COUNT(*) FROM perdirjen_equipment_item) AS total_equipment_catalog,
        (SELECT COUNT(*) FROM cp_fase_f_item) AS total_cp_fase_f
    `;
    let batchRow: Record<string, number> = {};
    try {
      const rows = await this.databaseService.query<RowDataPacket[]>(batchCountSql, []);
      const first = Array.isArray(rows) ? rows[0] : undefined;
      if (first) {
        for (const key of Object.keys(first as object)) {
          batchRow[key] = Number((first as Record<string, unknown>)[key] ?? 0) || 0;
        }
      }
    } catch (err) {
      this.logger.warn(`[DashboardService] batch globalStats fallback ke query serial: ${(err as Error).message}`);
    }

    const fallback = (key: string, serialFn: () => Promise<number>): Promise<number> => {
      if (batchRow[key] !== undefined && Number.isFinite(batchRow[key])) return Promise.resolve(batchRow[key]);
      return serialFn();
    };

    const settled = await Promise.allSettled([
      fallback("total_schools", () => this.queryCount("SELECT COUNT(*) AS total FROM schools")),
      fallback("total_users", () => this.queryCount("SELECT COUNT(*) AS total FROM users")),
      fallback("total_active_users", () => this.queryCount("SELECT COUNT(*) AS total FROM users WHERE is_active = 1")),
      fallback("total_sekolah_users", () => this.queryCount(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'SEKOLAH'`,
      )),
      fallback("total_fasilitator_alat", () => this.queryCount(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'FASILITATOR_ALAT'`,
      )),
      fallback("total_fasilitator_adm", () => this.queryCount(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'FASILITATOR_ADMINISTRASI'`,
      )),
      fallback("total_koordinator", () => this.queryCount(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'KOORDINATOR_ALAT'`,
      )),
      fallback("total_ppk", () => this.queryCount(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'PPK'`,
      )),
      fallback("total_admin", () => this.queryCount(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'ADMIN'`,
      )),
      fallback("total_school_verified", () => this.queryCount(
        `SELECT COUNT(*) AS total FROM schools
         WHERE UPPER(verification_status) IN ('TERVERIFIKASI', 'VERIFIED', 'APPROVED', 'LULUS', 'SELESAI')`,
      )),
      fallback("total_school_pending", () => this.queryCount(
        `SELECT COUNT(*) AS total FROM schools
         WHERE (verification_status IS NULL)
            OR (UPPER(verification_status) IN ('MENUNGGU_REVIEW', 'PENDING', 'MENUNGGU', 'IN_REVIEW', 'DALAM_REVIEW'))`,
      )),
      fallback("total_school_rejected", () => this.queryCount(
        `SELECT COUNT(*) AS total FROM schools
         WHERE UPPER(verification_status) IN ('DITOLAK', 'REJECTED', 'REVISI', 'GAGAL', 'PERLU_REVISI')`,
      )),
      fallback("total_assignments", () => this.queryCount("SELECT COUNT(*) AS total FROM workspace_school_assignments")),
      fallback("total_assignment_wawancara", () => this.queryCount(
        "SELECT COUNT(*) AS total FROM workspace_school_assignments WHERE module_key = 'wawancara'",
      )),
      fallback("total_assignment_verifikasi", () => this.queryCount(
        "SELECT COUNT(*) AS total FROM workspace_school_assignments WHERE module_key = 'verifikasi-online'",
      )),
      fallback("total_assignment_bimbingan", () => this.queryCount(
        "SELECT COUNT(*) AS total FROM workspace_school_assignments WHERE module_key = 'bimbingan-teknis'",
      )),
      fallback("total_concentrations", () => this.queryCount("SELECT COUNT(*) AS total FROM school_profile_concentrations")),
      fallback("total_provinces", () => this.queryCount(
        "SELECT COUNT(DISTINCT province_code) AS total FROM schools WHERE province_code IS NOT NULL AND province_code <> ''",
      )),
      fallback("total_cities", () => this.queryCount(
        "SELECT COUNT(DISTINCT city_code) AS total FROM schools WHERE city_code IS NOT NULL AND city_code <> ''",
      )),
      fallback("total_equipment_catalog", () => this.queryCount("SELECT COUNT(*) AS total FROM perdirjen_equipment_item")),
      fallback("total_cp_fase_f", () => this.queryCount("SELECT COUNT(*) AS total FROM cp_fase_f_item")),
    ]);

    const extractCount = (result: PromiseSettledResult<number>): number => {
      if (result.status === "fulfilled") return Number(result.value ?? 0);
      console.warn(`[DashboardService] getGlobalStats query rejected fallback 0: ${(result.reason as Error)?.message}`);
      return 0;
    };

    const [
      totalSchools,
      totalUsers,
      totalActiveUsers,
      totalSekolahUsers,
      totalFasilitatorAlat,
      totalFasilitatorAdm,
      totalKoordinator,
      totalPpk,
      totalAdmin,
      totalSchoolVerified,
      totalSchoolPending,
      totalSchoolRejected,
      totalAssignment,
      totalAssignmentWawancara,
      totalAssignmentVerifikasiOnline,
      totalAssignmentBimbinganTeknis,
      totalConcentrations,
      totalProvinces,
      totalCities,
      totalEquipmentCatalog,
      totalCpFaseF,
    ] = settled.map(extractCount);

    return {
      totalSchools,
      totalUsers,
      totalActiveUsers,
      totalSekolahUsers,
      totalFasilitatorAlat,
      totalFasilitatorAdm,
      totalKoordinator,
      totalPpk,
      totalAdmin,
      totalSchoolVerified,
      totalSchoolPending,
      totalSchoolRejected,
      totalAssignment,
      totalAssignmentWawancara,
      totalAssignmentVerifikasiOnline,
      totalAssignmentBimbinganTeknis,
      totalConcentrations,
      totalProvinces,
      totalCities,
      totalEquipmentCatalog,
      totalCpFaseF,
    };
  }

  private buildSuperadminDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    return {
      headline: "Konsol nasional SARANA SMK untuk memantau kesiapan sarana dan pelaksanaan Bantuan Sarana lintas wilayah.",
      summary: "KPI diambil langsung dari database MySQL: sekolah, akun pengguna, workspace assignments, konsentrasi keahlian, dan data master peralatan + CP Fase F.",
      metrics: [
        { label: "Sekolah terdaftar", value: formatNumber(stats.totalSchools), change: `${formatNumber(stats.totalProvinces)} provinsi`, tone: "primary" },
        { label: "Akun pengguna aktif", value: formatNumber(stats.totalActiveUsers), change: `dari ${formatNumber(stats.totalUsers)} akun`, tone: "success" },
        { label: "Workspace assignment", value: formatNumber(stats.totalAssignment), change: `${formatNumber(stats.totalAssignmentWawancara)} wawancara · ${formatNumber(stats.totalAssignmentVerifikasiOnline)} verifikasi · ${formatNumber(stats.totalAssignmentBimbinganTeknis)} bimtek`, tone: "warning" },
        { label: "Sekolah pending verifikasi", value: formatNumber(stats.totalSchoolPending), change: `${formatNumber(stats.totalSchoolRejected)} ditolak/revisi`, tone: "danger" },
      ],
      focus: [
        {
          title: "Prioritas nasional",
          description: "Sorotan Bantuan Sarana dari data real database.",
          items: [
            `Total akun SEKOLAH: ${formatNumber(stats.totalSekolahUsers)}`,
            `Total FASILITATOR ALAT: ${formatNumber(stats.totalFasilitatorAlat)} · ADMINISTRASI: ${formatNumber(stats.totalFasilitatorAdm)}`,
            `Total KOORDINATOR: ${formatNumber(stats.totalKoordinator)} · PPK: ${formatNumber(stats.totalPpk)} · ADMIN: ${formatNumber(stats.totalAdmin)}`,
          ],
        },
        {
          title: "Kualitas data",
          description: "Indikator kesiapan data SARANA SMK.",
          items: [
            `Konsentrasi keahlian sekolah: ${formatNumber(stats.totalConcentrations)} baris (school_profile_concentrations).`,
            `Sekolah terverifikasi: ${formatNumber(stats.totalSchoolVerified)} · ${stats.totalSchools > 0 ? Math.round((stats.totalSchoolVerified / stats.totalSchools) * 100) : 0}% dari total sekolah.`,
            `Kab/kota cakupan sekolah: ${formatNumber(stats.totalCities)} kota/kab.`,
          ],
        },
        {
          title: "Master data pendukung",
          description: "Referensi katalog peralatan & target CP Fase F (dari tabel database).",
          items: [
            `Katalog peralatan perdirjen: ${formatNumber(stats.totalEquipmentCatalog)} baris.`,
            `Target capaian CP Fase F: ${formatNumber(stats.totalCpFaseF)} baris.`,
            `Cakupan wilayah: ${formatNumber(stats.totalProvinces)} provinsi · ${formatNumber(stats.totalCities)} kab/kota.`,
          ],
        },
      ],
      schoolProfile: null,
    };
  }

  private buildAdminDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    return {
      headline: "Panel operasional SARANA SMK untuk validasi data harian dan kendali akun pengguna.",
      summary: "Admin memantau verifikasi sekolah, kelengkapan akun, dan alur assignment fasilitator per modul Bantuan Sarana.",
      metrics: [
        { label: "Verifikasi pending", value: formatNumber(stats.totalSchoolPending), change: `${formatNumber(stats.totalSchoolRejected)} revisi/ditolak`, tone: "warning" },
        { label: "Sekolah baru (akun SEKOLAH)", value: formatNumber(stats.totalSekolahUsers), change: `${formatNumber(stats.totalSchools)} data school`, tone: "primary" },
        { label: "Akun aktif", value: formatNumber(stats.totalActiveUsers), change: `dari ${formatNumber(stats.totalUsers)} akun`, tone: "success" },
        { label: "Role support aktif", value: formatNumber(stats.totalAdmin + stats.totalFasilitatorAlat + stats.totalFasilitatorAdm + stats.totalKoordinator + stats.totalPpk), change: `FasAlat=${formatNumber(stats.totalFasilitatorAlat)} · FasAdm=${formatNumber(stats.totalFasilitatorAdm)} · Kor=${formatNumber(stats.totalKoordinator)} · PPK=${formatNumber(stats.totalPpk)}`, tone: "danger" },
      ],
      focus: [
        {
          title: "Pekerjaan utama (dari DB)",
          description: "Antrean operasional dari tabel schools, users, dan workspace_school_assignments.",
          items: [
            `Review sekolah dengan status MENUNGGU_REVIEW: ${formatNumber(stats.totalSchoolPending)} sekolah.`,
            `Validasi pembagian assignment modul WAWANCARA: ${formatNumber(stats.totalAssignmentWawancara)} tugas.`,
            `Cek kelengkapan akun FASILITATOR yang belum terasosiasi ke assignment.`,
          ],
        },
        {
          title: "Master data sekolah",
          description: "Ringkasan kelengkapan profil sekolah + konsentrasi keahlian.",
          items: [
            `Total konsentrasi keahlian yang tercatat: ${formatNumber(stats.totalConcentrations)} baris.`,
            `Cakupan wilayah sekolah: ${formatNumber(stats.totalProvinces)} provinsi · ${formatNumber(stats.totalCities)} kab/kota.`,
            `Sekolah TEREPORT verifikasi: ${formatNumber(stats.totalSchoolVerified)} sekolah.`,
          ],
        },
        {
          title: "Akses cepat modul Bantuan Sarana",
          description: "Modul workspace assignment sesuai workflow SARANA SMK.",
          items: [
            `Modul Verifikasi Administrasi (online): ${formatNumber(stats.totalAssignmentVerifikasiOnline)} assignment.`,
            `Modul Wawancara: ${formatNumber(stats.totalAssignmentWawancara)} assignment.`,
            `Modul Bimbingan Teknis: ${formatNumber(stats.totalAssignmentBimbinganTeknis)} assignment.`,
          ],
        },
      ],
      schoolProfile: null,
    };
  }

  private buildFasilitatorAlatDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    return {
      headline: "Monitoring lapangan SARANA SMK untuk verifikasi kondisi alat dan prioritas sekolah binaan Bantuan Sarana.",
      summary: "Fasilitator alat fokus ke data assignment modul Wawancara + Bimbingan Teknis beserta sekolah pending verifikasi.",
      metrics: [
        { label: "Total sekolah terdata", value: formatNumber(stats.totalSchools), change: `${formatNumber(stats.totalSekolahUsers)} akun sekolah`, tone: "primary" },
        { label: "Assignment wawancara", value: formatNumber(stats.totalAssignmentWawancara), change: "modul wawancara", tone: "warning" },
        { label: "Assignment bimbingan teknis", value: formatNumber(stats.totalAssignmentBimbinganTeknis), change: "modul bimtek", tone: "success" },
        { label: "Sekolah pending verifikasi", value: formatNumber(stats.totalSchoolPending), change: `${formatNumber(stats.totalSchoolRejected)} ditolak/revisi`, tone: "danger" },
      ],
      focus: [
        {
          title: "Daftar tindak lanjut (real DB)",
          description: "Tugas sesuai assignment modul dan status verifikasi.",
          items: [
            `Cek modul WAWANCARA: ${formatNumber(stats.totalAssignmentWawancara)} assignment perlu diselesaikan.`,
            `Cek modul BIMTEK: ${formatNumber(stats.totalAssignmentBimbinganTeknis)} assignment untuk pendampingan alat.`,
            `Prioritaskan sekolah dengan status MENUNGGU_REVIEW (${formatNumber(stats.totalSchoolPending)}).`,
          ],
        },
        {
          title: "Koordinasi lapangan",
          description: "Sinkronisasi data alat dan rekomendasi dari database.",
          items: [
            `Total konsentrasi keahlian yang bisa dipasangkan alat: ${formatNumber(stats.totalConcentrations)}.`,
            `Katalog peralatan perdirjen yang tersedia: ${formatNumber(stats.totalEquipmentCatalog)} item.`,
            `Target CP Fase F yang perlu dicapai: ${formatNumber(stats.totalCpFaseF)} baris capaian.`,
          ],
        },
        {
          title: "Ringkasan wilayah",
          description: "Cakupan sekolah yang perlu didatangi / didampingi.",
          items: [
            `Cakupan provinsi: ${formatNumber(stats.totalProvinces)} provinsi.`,
            `Cakupan kab/kota: ${formatNumber(stats.totalCities)} kab/kota.`,
            `Total akun FASILITATOR ALAT aktif: ${formatNumber(stats.totalFasilitatorAlat)} orang.`,
          ],
        },
      ],
      schoolProfile: null,
    };
  }

  private buildFasilitatorAdministrasiDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    return {
      headline: "Dashboard pendampingan administratif SARANA SMK untuk mempercepat kelengkapan dokumen sekolah penerima Bantuan Sarana.",
      summary: "Fasilitator administrasi memantau assignment Verifikasi Administrasi dan kesiapan profil sekolah sebelum wawancara.",
      metrics: [
        { label: "Assignment verifikasi adm", value: formatNumber(stats.totalAssignmentVerifikasiOnline), change: "modul verifikasi-online", tone: "warning" },
        { label: "Sekolah binaan (akun SEKOLAH)", value: formatNumber(stats.totalSekolahUsers), change: `${formatNumber(stats.totalSchools)} data profil sekolah`, tone: "primary" },
        { label: "Sekolah pending verifikasi", value: formatNumber(stats.totalSchoolPending), change: `${formatNumber(stats.totalSchoolRejected)} perlu revisi`, tone: "danger" },
        { label: "Sekolah terverifikasi", value: formatNumber(stats.totalSchoolVerified), change: `${stats.totalSchools > 0 ? Math.round((stats.totalSchoolVerified / stats.totalSchools) * 100) : 0}% persentase`, tone: "success" },
      ],
      focus: [
        {
          title: "Kelengkapan berkas (DB real)",
          description: "Indikator kelengkapan administrasi dari tabel schools dan assignments modul Verifikasi Administrasi.",
          items: [
            `Assignment modul Verifikasi Online: ${formatNumber(stats.totalAssignmentVerifikasiOnline)} baris.`,
            `Profil sekolah MENUNGGU_REVIEW: ${formatNumber(stats.totalSchoolPending)} baris.`,
            `Akun SEKOLAH yang belum ganti password/login pertama: lihat Users Management → kolom "Sudah Diganti".`,
          ],
        },
        {
          title: "Pendampingan sekolah",
          description: "Target kerja pendampingan administratif per wilayah.",
          items: [
            `Cakupan provinsi sekolah: ${formatNumber(stats.totalProvinces)} provinsi.`,
            `Cakupan kab/kota sekolah: ${formatNumber(stats.totalCities)} kab/kota.`,
            `Konsentrasi keahlian yang perlu dicek kelengkapan: ${formatNumber(stats.totalConcentrations)} baris.`,
          ],
        },
        {
          title: "Koordinasi internal",
          description: "Titik serah tugas dengan admin, PPK, dan fasilitator alat.",
          items: [
            `Siap lanjut ke WAWANCARA: ${formatNumber(stats.totalAssignmentWawancara)} assignment.`,
            `Siap lanjut ke BIMTEK: ${formatNumber(stats.totalAssignmentBimbinganTeknis)} assignment.`,
            `Total akun PPK yang memberi persetujuan: ${formatNumber(stats.totalPpk)} akun.`,
          ],
        },
      ],
      schoolProfile: null,
    };
  }

  private buildSekolahDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    const verificationPct = stats.totalSchools > 0 ? Math.round((stats.totalSchoolVerified / stats.totalSchools) * 100) : 0;
    void verificationPct;

    return {
      headline: "Beranda kerja SARANA SMK sekolah untuk mengelola profil, alat, dan pengajuan kebutuhan Bantuan Sarana.",
      summary: "Ringkasan sekolah di dashboard ini menampilkan statistik global SARANA SMK (untuk konteks) + panel fokus aksi sekolah. Gunakan menu Profil Sekolah & Alat untuk data sekolah Anda sendiri.",
      metrics: [
        { label: "Akun SEKOLAH terdaftar", value: formatNumber(stats.totalSekolahUsers), change: `sekolah penerima Bantuan Sarana`, tone: "primary" },
        { label: "Sekolah pending verifikasi", value: formatNumber(stats.totalSchoolPending), change: `${formatNumber(stats.totalSchoolRejected)} revisi/ditolak`, tone: "danger" },
        { label: "Sekolah terverifikasi", value: formatNumber(stats.totalSchoolVerified), change: `${stats.totalSchools > 0 ? Math.round((stats.totalSchoolVerified / stats.totalSchools) * 100) : 0}% dari total`, tone: "success" },
        { label: "Workspace assignment aktif", value: formatNumber(stats.totalAssignment), change: `Wawancara=${formatNumber(stats.totalAssignmentWawancara)} · Verifikasi=${formatNumber(stats.totalAssignmentVerifikasiOnline)} · Bimtek=${formatNumber(stats.totalAssignmentBimbinganTeknis)}`, tone: "warning" },
      ],
      focus: [
        {
          title: "Ringkasan kebutuhan prioritas (dari DB master)",
          description: "Data katalog peralatan & target CP Fase F yang menjadi acuan Bantuan Sarana.",
          items: [
            `Katalog peralatan perdirjen: ${formatNumber(stats.totalEquipmentCatalog)} item.`,
            `Target capaian CP Fase F: ${formatNumber(stats.totalCpFaseF)} baris.`,
            `Konsentrasi keahlian sekolah nasional: ${formatNumber(stats.totalConcentrations)} baris.`,
          ],
        },
        {
          title: "Status Bantuan Sarana (konteks nasional)",
          description: "Perbandingan status verifikasi sekolah penerima di seluruh Indonesia.",
          items: [
            `Sekolah TERVERIFIKASI: ${formatNumber(stats.totalSchoolVerified)} sekolah.`,
            `Sekolah MENUNGGU_REVIEW: ${formatNumber(stats.totalSchoolPending)} sekolah.`,
            `Sekolah DITOLAK/PERLU_REVISI: ${formatNumber(stats.totalSchoolRejected)} sekolah.`,
          ],
        },
        {
          title: "Aksi operator sekolah",
          description: "Langkah kerja wajib untuk kelancaran Bantuan Sarana.",
          items: [
            "Lengkapi Profil Sekolah (data kepala sekolah, operator, alamat, wilayah, dll).",
            "Isi Konsentrasi Keahlian dan daftar rombel + siswa per jurusan.",
            "Isi kondisi alat rusak/baik dan kebutuhan alat prioritas, lalu pantau progress assignment.",
          ],
        },
      ],
      schoolProfile: null,
    };
  }

  private buildKoordinatorAlatDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    return {
      headline: "Rekap wilayah SARANA SMK untuk pemerataan kebutuhan alat dan monitoring distribusi prioritas Bantuan Sarana.",
      summary: "Koordinator alat memantau agregat workspace assignments Wawancara & Bimtek, plus distribusi sekolah per wilayah.",
      metrics: [
        { label: "Wilayah cakupan", value: formatNumber(stats.totalProvinces), change: `${formatNumber(stats.totalCities)} kab/kota`, tone: "primary" },
        { label: "Sekolah terdata", value: formatNumber(stats.totalSchools), change: `${formatNumber(stats.totalSekolahUsers)} akun sekolah`, tone: "warning" },
        { label: "Assignment Wawancara + Bimtek", value: formatNumber(stats.totalAssignmentWawancara + stats.totalAssignmentBimbinganTeknis), change: `Wawancara=${formatNumber(stats.totalAssignmentWawancara)} · Bimtek=${formatNumber(stats.totalAssignmentBimbinganTeknis)}`, tone: "success" },
        { label: "Kebutuhan revisi/ditolak", value: formatNumber(stats.totalSchoolRejected), change: `${formatNumber(stats.totalSchoolPending)} masih menunggu`, tone: "danger" },
      ],
      focus: [
        {
          title: "Pemerataan kebutuhan (data DB)",
          description: "Agregat wilayah untuk distribusi alat dan jadwal pendampingan.",
          items: [
            `Cakupan provinsi: ${formatNumber(stats.totalProvinces)} provinsi · ${formatNumber(stats.totalCities)} kab/kota.`,
            `Total konsentrasi keahlian: ${formatNumber(stats.totalConcentrations)} baris (mapping jurusan → alat).`,
            `Total katalog peralatan yang bisa dialokasikan: ${formatNumber(stats.totalEquipmentCatalog)} item.`,
          ],
        },
        {
          title: "Koordinasi tindak lanjut",
          description: "Alur kerja lintas fasilitator alat dan admin SARANA SMK.",
          items: [
            `Jumlah FASILITATOR ALAT yang bisa ditugaskan: ${formatNumber(stats.totalFasilitatorAlat)} orang.`,
            `Assignment modul Wawancara yang perlu di-review: ${formatNumber(stats.totalAssignmentWawancara)}.`,
            `Assignment modul Bimbingan Teknis yang perlu di-review: ${formatNumber(stats.totalAssignmentBimbinganTeknis)}.`,
          ],
        },
        {
          title: "Ringkasan progres",
          description: "Status tahapan Bantuan Sarana dari perspektif alur modul workspace.",
          items: [
            `Verifikasi Administrasi: ${formatNumber(stats.totalAssignmentVerifikasiOnline)} baris.`,
            `Wawancara: ${formatNumber(stats.totalAssignmentWawancara)} baris.`,
            `Bimbingan Teknis (finalisasi kebutuhan alat): ${formatNumber(stats.totalAssignmentBimbinganTeknis)} baris.`,
          ],
        },
      ],
      schoolProfile: null,
    };
  }

  private buildPpkDashboard(stats: ReturnType<typeof this.getGlobalStats> extends Promise<infer T> ? T : never): DashboardPayload {
    return {
      headline: "Konsol SARANA SMK pemantauan pengajuan Bantuan Sarana menuju persetujuan dan pelaksanaan pengadaan.",
      summary: "PPK memantau kesiapan administrasi sekolah dan jumlah assignment yang sudah lanjut ke tahap yang bisa diproses pengadaan.",
      metrics: [
        { label: "Sekolah terverifikasi (siap proses)", value: formatNumber(stats.totalSchoolVerified), change: `dari ${formatNumber(stats.totalSchools)} sekolah`, tone: "success" },
        { label: "Menunggu verifikasi", value: formatNumber(stats.totalSchoolPending), change: `${formatNumber(stats.totalSchoolRejected)} revisi/ditolak`, tone: "warning" },
        { label: "Assignment Wawancara selesai → bisa lanjut", value: formatNumber(stats.totalAssignmentWawancara), change: `+ ${formatNumber(stats.totalAssignmentBimbinganTeknis)} bimtek`, tone: "primary" },
        { label: "Resiko keterlambatan (revisi)", value: formatNumber(stats.totalSchoolRejected), change: "perlu ditindak lanjuti", tone: "danger" },
      ],
      focus: [
        {
          title: "Pengajuan siap tindak lanjut",
          description: "Sekolah yang sudah cukup matang dokumen + profile untuk tahap pengadaan.",
          items: [
            `Sekolah TERVERIFIKASI: ${formatNumber(stats.totalSchoolVerified)} sekolah.`,
            `Assignment Wawancara yang bisa diproses: ${formatNumber(stats.totalAssignmentWawancara)} baris.`,
            `Assignment Bimbingan Teknis (finalisasi spesifikasi): ${formatNumber(stats.totalAssignmentBimbinganTeknis)} baris.`,
          ],
        },
        {
          title: "Persetujuan administratif",
          description: "Indikasi jumlah yang perlu persetujuan / review PPK.",
          items: [
            `Total assignment Verifikasi Administrasi: ${formatNumber(stats.totalAssignmentVerifikasiOnline)} baris.`,
            `Total konsentrasi keahlian yang dipetakan: ${formatNumber(stats.totalConcentrations)} baris.`,
            `Target CP Fase F acuan pengadaan: ${formatNumber(stats.totalCpFaseF)} baris.`,
          ],
        },
        {
          title: "Monitoring pelaksanaan",
          description: "Cakupan wilayah & kapasitas tim pendukung.",
          items: [
            `Cakupan wilayah: ${formatNumber(stats.totalProvinces)} provinsi · ${formatNumber(stats.totalCities)} kab/kota.`,
            `Tim ADMIN pendukung: ${formatNumber(stats.totalAdmin)} orang.`,
            `Tim FASILITATOR (Alat + Administrasi): ${formatNumber(stats.totalFasilitatorAlat + stats.totalFasilitatorAdm)} orang.`,
          ],
        },
      ],
      schoolProfile: null,
    };
  }
}

void mapVerificationTone;
