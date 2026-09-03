import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import type { RowDataPacket } from "mysql2/promise";

import { DatabaseService, type DialectConnection } from "../database/database.service.js";

type PoolConnection = DialectConnection;

interface SchoolBaseRow extends RowDataPacket {
  id: string;
  npsn: string;
  name: string;
  province_code: string;
  city_code: string;
  district_code: string | null;
  village_code: string | null;
  address: string;
  postal_code: string | null;
  document_link: string | null;
  rpd_link: string | null;
  pks_link: string | null;
  principal_name: string | null;
  principal_position: string | null;
  principal_nip: string | null;
  principal_phone: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  vice_principal_facilities_name: string | null;
  vice_principal_facilities_phone: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  verification_status: string | null;
  verification_review_notes: string | null;
  prov_nama: string | null;
  kota_nama: string | null;
  kec_nama: string | null;
  kel_nama: string | null;
}

interface UserNpsnRow extends RowDataPacket {
  npsn: string | null;
}

interface ConcentrationRow extends RowDataPacket {
  id: string;
  concentration_code: string | null;
  concentration_name: string;
  rombel_count: number;
  student_count: number;
  rombel_10: number;
  student_10: number;
  rombel_11: number;
  student_11: number;
  rombel_12: number;
  student_12: number;
  luas_ruangan_rps: string | null;
  row_order: number;
}

interface OrganizationMemberRow extends RowDataPacket {
  id: string;
  role_name: string;
  member_name: string;
  contact_phone: string | null;
  row_order: number;
}

interface ColumnExistsRow extends RowDataPacket {
  total: number;
}

interface ConcentrationOptionRow extends RowDataPacket {
  code: string;
  name: string;
}

interface AdministrativeDocumentRow extends RowDataPacket {
  id: string;
  school_id: string;
  document_code: string;
  document_name: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  review_status: string | null;
  review_notes: string | null;
  uploaded_at: Date | string;
  updated_at: Date | string;
}

type AdministrativeDocumentDefinition = {
  code: string;
  name: string;
  required: boolean;
};

type UploadedDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsRootDirectory = path.resolve(currentDirectory, "../../uploads/school-profile-documents");

const administrativeDocumentDefinitions: AdministrativeDocumentDefinition[] = [
  {
    code: "sk-pengangkatan-kepala-sekolah",
    name: "SK Pengangkatan Kepala Sekolah",
    required: true,
  },
  { code: "scan-ktp-kepala-sekolah", name: "Scan KTP Kepala Sekolah Berwarna Asli", required: true },
  { code: "sertifikat-akreditasi", name: "Sertifikat Akreditasi Minimal C", required: true },
  {
    code: "npwp-sekolah-atau-dinas",
    name: "NPWP Sekolah (SMK Swasta) / NPWP Dinas Pendidikan Provinsi (SMK Negeri)",
    required: true,
  },
  { code: "akta-pendirian-yayasan", name: "Akta Pendirian Yayasan (khusus SMK Swasta)", required: true },
  {
    code: "pengesahan-yayasan-kemenkumham",
    name: "Surat Pengesahan Yayasan oleh Kemenkumham (khusus SMK Swasta)",
    required: true,
  },
  {
    code: "izin-operasional-sekolah",
    name: "Surat Izin Operasional Sekolah / Surat Keterangan Sekolah Masih Aktif",
    required: true,
  },
  {
    code: "surat-rekomendasi-dinas-pendidikan",
    name: "Surat Rekomendasi dari Dinas Pendidikan / SKPD yang membidangi Pendidikan Menengah",
    required: true,
  },
  {
    code: "surat-pernyataan-daya-listrik",
    name: "Surat Pernyataan Daya Listrik + Bukti Pembayaran Listrik",
    required: true,
  },
  {
    code: "surat-pernyataan-tidak-menunggak-bantuan",
    name: "Surat Pernyataan Tidak Memiliki Tunggakan Laporan Bantuan Pemerintah Tahun Sebelumnya",
    required: true,
  },
  {
    code: "dokumen-kondisi-sarana-dan-peralatan",
    name: "Dokumen Kondisi Sarana dan Peralatan Pembelajaran Saat Ini",
    required: true,
  },
  {
    code: "analisis-kebutuhan-sarana-dan-peralatan",
    name: "Analisis Kebutuhan Sarana dan Peralatan",
    required: true,
  },
  { code: "survei-harga-pasar", name: "Survei Harga Pasar", required: true },
  { code: "rab-peralatan", name: "RAB Peralatan", required: true },
  { code: "rpkp", name: "RPKP", required: true },
  {
    code: "sk-tim-pengadaan-pemeriksa-penerima",
    name: "SK Tim Pengadaan, Pemeriksa, dan Penerima Peralatan",
    required: true,
  },
  { code: "surat-pernyataan", name: "Surat Pernyataan", required: true },
];

const RPS_DOCUMENT_CODE_PREFIX = "dokumen-kondisi-rps";

function normalizeRows<T = unknown>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  const first = raw[0];
  if (first === undefined || first === null) return [] as unknown as T[];
  if (Array.isArray(first)) {
    return first as unknown as T[];
  }
  if (typeof first === "object" && !Buffer.isBuffer(first)) {
    return raw as unknown as T[];
  }
  return [] as unknown as T[];
}

function buildRpsDocumentCode(concentrationCode: string): string {
  const clean = (concentrationCode ?? "").trim().replace(/[^A-Za-z0-9._-]/g, "_");
  return `${RPS_DOCUMENT_CODE_PREFIX}__${clean}`;
}

function isRpsDocumentCode(code: string): boolean {
  return (code ?? "").startsWith(`${RPS_DOCUMENT_CODE_PREFIX}__`);
}

function concentrationCodeFromRpsDocumentCode(code: string): string {
  return (code ?? "").replace(new RegExp(`^${RPS_DOCUMENT_CODE_PREFIX}__`, "u"), "");
}

const MULTIPLE_FILE_ADMINISTRATIVE_DOCUMENT_CODES = new Set<string>([
  "surat-pernyataan-daya-listrik",
]);
const MAX_MULTIPLE_FILES_PER_DOCUMENT = 5;
const MAX_FILES_PER_DOCUMENT_DEFAULT = 10;
const MAX_RPS_FILES_PER_KONSENTRASI = 5;

export class SchoolConcentrationInputDto {
  @IsString()
  @IsOptional()
  id?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  rowOrder?: number;

  @IsBoolean()
  @IsOptional()
  isAdminRecommendation?: boolean;

  @IsIn(["ADMIN_RECOMMENDATION", "SCHOOL_MANUAL"])
  @IsOptional()
  @IsString()
  sourceType?: "ADMIN_RECOMMENDATION" | "SCHOOL_MANUAL";

  @IsString()
  @IsOptional()
  sourceLabel?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rombelCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rombel10!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  student10!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rombel11!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  student11!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rombel12!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  student12!: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  luasRuanganRps?: string;
}

export class SchoolOrganizationMemberInputDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  roleName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  memberName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  contactPhone?: string;
}

const PRINCIPAL_POSITIONS = ["KEPALA_SEKOLAH", "PLT_KEPALA_SEKOLAH"] as const;
type PrincipalPosition = (typeof PRINCIPAL_POSITIONS)[number];

export class UpdateSchoolProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  npsn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  provinceCode?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  cityCode?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  districtCode?: string;

  @IsString()
  @IsOptional()
  village?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  villageCode?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  documentLink?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  rpdLink?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  pksLink?: string;

  @Transform(({ value }) => (value === "" || value === null || value === undefined ? null : Number(value)))
  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @Transform(({ value }) => (value === "" || value === null || value === undefined ? null : Number(value)))
  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  principalName?: string;

  @IsString()
  @IsOptional()
  @IsIn(PRINCIPAL_POSITIONS)
  @MaxLength(30)
  principalPosition?: PrincipalPosition | "" | null;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  principalNip?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  principalPhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  vicePrincipalFacilitiesName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  vicePrincipalFacilitiesPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolOrganizationMemberInputDto)
  organizationMembers!: SchoolOrganizationMemberInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolConcentrationInputDto)
  concentrations!: SchoolConcentrationInputDto[];

  @IsString()
  @IsOptional()
  @MaxLength(40)
  verificationStatus?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  verificationReviewNotes?: string | null;
}

@Injectable()
export class SchoolProfileService implements OnModuleInit {
  private static _globalSingletonInstance: SchoolProfileService | null = null;

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) SchoolProfileService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): SchoolProfileService | null {
    const inst = SchoolProfileService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): SchoolProfileService {
    const existing = SchoolProfileService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new SchoolProfileService(db);
    SchoolProfileService._globalSingletonInstance = fresh;
    return fresh;
  }

  async onModuleInit() {
    await this.ensureSchema();
  }

  async getMyProfile(userId: string) {
    const npsn = await this.findNpsnForUser(userId);
    return this.getProfileByNpsn(npsn);
  }

  async getProfileByNpsn(npsn: string) {
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    return this.getProfileBySchoolId(schoolId);
  }

  async getMyAdministrativeDocuments(userId: string) {
    const npsn = await this.findNpsnForUser(userId);
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    return this.getAdministrativeDocumentsBySchoolId(schoolId);
  }

  async getAdministrativeDocumentsByNpsn(npsn: string) {
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    return this.getAdministrativeDocumentsBySchoolId(schoolId);
  }

  async getListConcentrationsSummary(): Promise<
    Array<{
      id: string;
      npsn: string;
      name: string;
      totalStudents: number;
      totalRombel: number;
      concentrations: Array<{
        code: string;
        name: string;
        studentCount: number;
        rombelCount: number;
      }>;
      top3Concentrations: Array<{
        code: string;
        name: string;
        studentCount: number;
        rombelCount: number;
      }>;
    }>
  > {
    const schools = await this.databaseService.query<
      Array<{ id: string; npsn: string; name: string } & RowDataPacket>
    >("SELECT npsn AS id, npsn, name FROM schools ORDER BY name ASC");

    if (schools.length === 0) return [];
    const schoolIds = schools.map((s) => s.id);
    const placeholders = schoolIds.map(() => "?").join(",");
    const concentrations = await this.databaseService.query<ConcentrationRow[]>(
      `SELECT npsn AS school_id, concentration_code, concentration_name, rombel_count, student_count, row_order
       FROM school_profile_concentrations
       WHERE npsn IN (${placeholders})
       ORDER BY npsn ASC, student_count DESC, row_order ASC, concentration_name ASC`,
      schoolIds,
    );

    const bySchool = new Map<string, ConcentrationRow[]>();
    for (const c of concentrations) {
      const sid = (c as unknown as { school_id?: string }).school_id ?? "";
      const prev = bySchool.get(sid) ?? [];
      prev.push(c);
      bySchool.set(sid, prev);
    }

    return schools.map((school) => {
      const rows = bySchool.get(school.id) ?? [];
      const mapped = rows.map((r) => ({
        code: r.concentration_code ?? "",
        name: r.concentration_name ?? "",
        studentCount: Number(r.student_count ?? 0) | 0,
        rombelCount: Number(r.rombel_count ?? 0) | 0,
      }));
      const sorted = [...mapped].sort((a, b) => b.studentCount - a.studentCount);
      let totalStudents = 0;
      let totalRombel = 0;
      for (const c of sorted) {
        totalStudents += c.studentCount;
        totalRombel += c.rombelCount;
      }
      return {
        id: school.id,
        npsn: school.npsn,
        name: school.name,
        totalStudents,
        totalRombel,
        concentrations: sorted,
        top3Concentrations: sorted.slice(0, 3),
      };
    });
  }

  async uploadMyAdministrativeDocument(userId: string, documentCode: string, file: UploadedDocumentFile) {
    if (!file?.buffer?.length) {
      throw new NotFoundException("File dokumen belum dipilih.");
    }

    const npsn = await this.findNpsnForUser(userId);
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    const isRps = isRpsDocumentCode(documentCode);
    const concentrationCode = isRps ? concentrationCodeFromRpsDocumentCode(documentCode) : "";

    let definition = administrativeDocumentDefinitions.find((item) => item.code === documentCode);
    let isDynamicRps = false;

    if (!definition && isRps && concentrationCode) {
      const concentrationRows = await this.databaseService.query<
        Array<{ concentration_code: string | null; concentration_name: string } & RowDataPacket>
      >(
        `
          SELECT concentration_code, concentration_name
          FROM school_profile_concentrations
          WHERE npsn = ? AND concentration_code = ?
          LIMIT 1
        `,
        [schoolId, concentrationCode],
      );
      const matchRow = concentrationRows[0];
      if (matchRow) {
        isDynamicRps = true;
        definition = {
          code: documentCode,
          name: `Dokumen Kondisi RPS — ${matchRow.concentration_name ?? matchRow.concentration_code ?? "Konsentrasi"}`,
          required: true,
        };
      }
    }

    if (!definition) {
      throw new NotFoundException("Jenis dokumen administrasi tidak ditemukan.");
    }

    const isMultipleDocumentStatic = MULTIPLE_FILE_ADMINISTRATIVE_DOCUMENT_CODES.has(documentCode);
    const maxFilesPerDocument =
      isDynamicRps || isRps
        ? MAX_RPS_FILES_PER_KONSENTRASI
        : isMultipleDocumentStatic
          ? MAX_MULTIPLE_FILES_PER_DOCUMENT
          : MAX_FILES_PER_DOCUMENT_DEFAULT;

    const countRaw = await this.databaseService.query<Array<{ total: number } & RowDataPacket>>(
      `
        SELECT COUNT(1) AS total
        FROM school_profile_administrative_documents
        WHERE npsn = ? AND document_code = ?
      `,
      [schoolId, documentCode],
    );
    const countRows = normalizeRows<{ total: number } & RowDataPacket>(countRaw);
    const currentCount = Number(countRows?.[0]?.total ?? 0);
    if (currentCount >= maxFilesPerDocument) {
      throw new BadRequestException(
        `Dokumen "${definition.name}" maksimal ${maxFilesPerDocument} file. Hapus file lama terlebih dahulu sebelum mengunggah file baru.`,
      );
    }

    const extension = getSafeFileExtension(file.originalname);
    const schoolDirectory = path.join(uploadsRootDirectory, schoolId);
    mkdirSync(schoolDirectory, { recursive: true });

    const fileName = `${documentCode}-${Date.now()}${extension}`;
    const absoluteFilePath = path.join(schoolDirectory, fileName);
    await writeFile(absoluteFilePath, file.buffer);
    const relativeFilePath = path.posix.join(schoolId, fileName);

    await this.databaseService.query(
      `
        INSERT INTO school_profile_administrative_documents (
          id,
          npsn,
          document_code,
          document_name,
          file_name,
          file_path,
          mime_type,
          file_size,
          review_status,
          review_notes,
          uploaded_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        createId(),
        schoolId,
        definition.code,
        definition.name,
        file.originalname,
        relativeFilePath,
        file.mimetype || null,
        file.size || 0,
        "PROSES",
        "-",
      ],
    );

    const documents = await this.getAdministrativeDocumentsBySchoolId(schoolId);
    return documents.find((item) => item.code === documentCode) ?? null;
  }

  async deleteMyAdministrativeDocumentFile(userId: string, fileId: string) {
    if (!fileId?.trim()) {
      throw new NotFoundException("ID file dokumen belum dipilih.");
    }
    const npsn = await this.findNpsnForUser(userId);
    const schoolId = await this.findSchoolIdByNpsnInternal(npsn);
    const rows = await this.databaseService.query<AdministrativeDocumentRow[]>(
      `
        SELECT id, npsn AS school_id, document_code, file_path
        FROM school_profile_administrative_documents
        WHERE id = ? AND npsn = ?
        LIMIT 1
      `,
      [fileId.trim(), schoolId],
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("File dokumen tidak ditemukan atau bukan milik sekolah Anda.");
    }
    if (row.file_path) {
      const absolutePath = path.join(uploadsRootDirectory, row.file_path);
      if (existsSync(absolutePath)) {
        try {
          await unlink(absolutePath);
        } catch {
          /* ignore unlink error */
        }
      }
    }
    await this.databaseService.query(
      `DELETE FROM school_profile_administrative_documents WHERE id = ? AND npsn = ? LIMIT 1`,
      [fileId.trim(), schoolId],
    );
    return this.getAdministrativeDocumentsBySchoolId(schoolId);
  }

  async updateMyProfile(userId: string, payload: UpdateSchoolProfileDto) {
    return this.databaseService.transaction(async (connection) => {
      const npsn = await this.findNpsnForUser(userId, connection);
      const schoolId = await this.findSchoolIdByNpsnInternal(npsn);

      // ============== SAFETY GUARD FIX DATA HILANG ==============
      // RULE: HANYA ubah / overwrite tabel concentrations & organization
      // JIKA user MENGIRIM field tersebut di request payload (artinya
      // user memang sedang edit bagian itu).
      // JIKA field TIDAK ADA (undefined) = user edit field lain (kepsek,
      // alamat, dll), JANGAN SENTUH tabel concentrations/members AGAR
      // DATA YANG SUDAH ADA TIDAK PERNAH TERHAPUS OTOMATIS.
      // Bug sebelumnya: concentrations ?? [] → array kosong → DELETE ALL
      // existing → INSERT 0 baris → KK HILANG di setiap update profile.
      const shouldUpdateConcentrations = Object.prototype.hasOwnProperty.call(payload, "concentrations");
      const shouldUpdateOrganizationMembers = Object.prototype.hasOwnProperty.call(payload, "organizationMembers");

      type ConcExistingRow = {
        id: string; school_id: string; concentration_code: string | null; concentration_name: string;
        rombel_count: number; student_count: number;
        rombel_10: number; student_10: number; rombel_11: number; student_11: number;
        rombel_12: number; student_12: number; luas_ruangan_rps: string | null; row_order: number;
      } & RowDataPacket;

      let normalizedConcentrations: Array<{
        id?: string;
        rowOrder?: number;
        isAdminRecommendation?: boolean;
        sourceType?: "ADMIN_RECOMMENDATION" | "SCHOOL_MANUAL";
        sourceLabel?: string;
        code: string;
        name: string;
        rombelCount: number;
        studentCount: number;
        rombel10: number;
        student10: number;
        rombel11: number;
        student11: number;
        rombel12: number;
        student12: number;
        luasRuanganRps: string;
      }> = [];
      let existingConcentrationsRows: ConcExistingRow[] = [];
      const existingById = new Map<string, ConcExistingRow>();
      if (shouldUpdateConcentrations) {
        const existingConcentrationsRaw = await connection.query<Array<ConcExistingRow>>(
          `SELECT id, npsn AS school_id, concentration_code, concentration_name, rombel_count, student_count,
                  rombel_10, student_10, rombel_11, student_11, rombel_12, student_12,
                  luas_ruangan_rps, row_order
             FROM school_profile_concentrations
            WHERE npsn = ?`,
          [schoolId],
        );
        existingConcentrationsRows = normalizeRows<ConcExistingRow>(existingConcentrationsRaw);
        for (const row of existingConcentrationsRows) {
          if (row.id) existingById.set(String(row.id).trim(), row);
        }
        const existingByCode = new Map<string, ConcExistingRow>();
        const existingByName = new Map<string, ConcExistingRow>();
        for (const row of existingConcentrationsRows) {
          if (row.concentration_code) existingByCode.set(String(row.concentration_code).trim(), row);
          if (row.concentration_name) existingByName.set(String(row.concentration_name).trim().toLowerCase(), row);
        }
        const findExisting = (idHint: string | undefined, code: string, name: string): ConcExistingRow | null => {
          if (idHint && existingById.has(idHint)) return existingById.get(idHint)!;
          if (code && existingByCode.has(code)) return existingByCode.get(code)!;
          if (name && existingByName.has(name.trim().toLowerCase())) return existingByName.get(name.trim().toLowerCase())!;
          return null;
        };
        const numOr = (payloadVal: unknown, oldVal: unknown): number => {
          if (payloadVal !== undefined && payloadVal !== null && payloadVal !== "") {
            return Number(payloadVal) || 0;
          }
          if (typeof oldVal === "number") return oldVal;
          if (typeof oldVal === "string") {
            const trimmed = oldVal.trim();
            if (trimmed !== "") return Number(trimmed) || 0;
          }
          return 0;
        };
        const strOr = (payloadVal: unknown, oldVal: unknown): string => {
          if (typeof payloadVal === "string") return payloadVal.trim();
          if (typeof oldVal === "string") return oldVal.trim();
          if (oldVal === null || oldVal === undefined) return "";
          return String(oldVal ?? "").trim();
        };
        normalizedConcentrations = (payload.concentrations ?? [])
          .map((item) => {
            const idHint = typeof item.id === "string" ? item.id.trim() : undefined;
            const code = (item.code ?? "").trim();
            const name = (item.name ?? "").trim();
            const old = findExisting(idHint, code, name);
            const has = (k: string) => Object.prototype.hasOwnProperty.call(item, k);
            const rombelCount = has("rombelCount") ? numOr(item.rombelCount, old?.rombel_count) : numOr(undefined, old?.rombel_count);
            const studentCount = has("studentCount") ? numOr(item.studentCount, old?.student_count) : numOr(undefined, old?.student_count);
            const rombel10 = has("rombel10") ? numOr(item.rombel10, old?.rombel_10) : numOr(undefined, old?.rombel_10);
            const student10 = has("student10") ? numOr(item.student10, old?.student_10) : numOr(undefined, old?.student_10);
            const rombel11 = has("rombel11") ? numOr(item.rombel11, old?.rombel_11) : numOr(undefined, old?.rombel_11);
            const student11 = has("student11") ? numOr(item.student11, old?.student_11) : numOr(undefined, old?.student_11);
            const rombel12 = has("rombel12") ? numOr(item.rombel12, old?.rombel_12) : numOr(undefined, old?.rombel_12);
            const student12 = has("student12") ? numOr(item.student12, old?.student_12) : numOr(undefined, old?.student_12);
            const luasRuanganRps = has("luasRuanganRps")
              ? typeof item.luasRuanganRps === "string"
                ? item.luasRuanganRps.trim()
                : item.luasRuanganRps == null
                  ? ""
                  : String(item.luasRuanganRps).trim()
              : strOr(undefined, old?.luas_ruangan_rps);

            const payloadRowOrder = Number(item.rowOrder) || 0;
            const existingRowOrder = Number(old?.row_order) || 0;
            const rowOrder = payloadRowOrder > 0 ? payloadRowOrder : existingRowOrder;
            const isAdminRecommendation = has("isAdminRecommendation")
              ? Boolean(item.isAdminRecommendation)
              : rowOrder > 0 && rowOrder <= 5;
            const sourceType: "ADMIN_RECOMMENDATION" | "SCHOOL_MANUAL" =
              (item.sourceType === "ADMIN_RECOMMENDATION" || item.sourceType === "SCHOOL_MANUAL")
                ? item.sourceType
                : isAdminRecommendation
                  ? "ADMIN_RECOMMENDATION"
                  : "SCHOOL_MANUAL";

            return {
              id: old?.id ?? idHint,
              rowOrder,
              isAdminRecommendation,
              sourceType,
              sourceLabel: typeof item.sourceLabel === "string" ? item.sourceLabel : undefined,
              code,
              name,
              rombelCount,
              studentCount,
              rombel10,
              student10,
              rombel11,
              student11,
              rombel12,
              student12,
              luasRuanganRps,
            };
          })
          .filter((item) => item.code && item.name);
      }

      let normalizedOrganizationMembers: Array<{
        id: string;
        roleName: string;
        memberName: string;
        contactPhone: string;
      }> = [];
      if (shouldUpdateOrganizationMembers) {
        normalizedOrganizationMembers = (payload.organizationMembers ?? [])
          .map((item) => ({
            id: (item.id ?? "").trim() || "",
            roleName: (item.roleName ?? "").trim(),
            memberName: (item.memberName ?? "").trim(),
            contactPhone: (item.contactPhone ?? "").trim() || "",
          }))
          .filter((item) => item.roleName && item.memberName);
      }
      // ============== AKHIR SAFETY GUARD ==============

      const principalMember =
        normalizedOrganizationMembers.find((item) => item.roleName.toLowerCase() === "kepala sekolah") ??
        normalizedOrganizationMembers[0];
      const viceFacilitiesMember =
        normalizedOrganizationMembers.find((item) => item.roleName.toLowerCase().includes("wakasek sarana")) ??
        normalizedOrganizationMembers[1];

      const payloadPrincipalName =
        typeof payload.principalName === "string" ? payload.principalName.trim() : null;
      const payloadPrincipalPhone =
        typeof payload.principalPhone === "string" ? payload.principalPhone.trim() : null;
      const payloadViceName =
        typeof payload.vicePrincipalFacilitiesName === "string"
          ? payload.vicePrincipalFacilitiesName.trim()
          : null;
      const payloadVicePhone =
        typeof payload.vicePrincipalFacilitiesPhone === "string"
          ? payload.vicePrincipalFacilitiesPhone.trim()
          : null;

      const principalNameToSave =
        payloadPrincipalName !== null
          ? payloadPrincipalName || null
          : (principalMember?.memberName ?? "")?.trim() || null;
      const principalPhoneToSave =
        payloadPrincipalPhone !== null
          ? payloadPrincipalPhone || null
          : (principalMember?.contactPhone ?? "")?.trim() || null;
      const viceFacilitiesNameToSave =
        payloadViceName !== null
          ? payloadViceName || null
          : (viceFacilitiesMember?.memberName ?? "")?.trim() || null;
      const viceFacilitiesPhoneToSave =
        payloadVicePhone !== null
          ? payloadVicePhone || null
          : (viceFacilitiesMember?.contactPhone ?? "")?.trim() || null;

      for (const member of normalizedOrganizationMembers) {
        const roleLower = member.roleName.toLowerCase();
        if (roleLower === "kepala sekolah") {
          if (principalNameToSave) member.memberName = principalNameToSave;
          if (principalPhoneToSave) member.contactPhone = principalPhoneToSave;
        } else if (roleLower.includes("wakasek sarana")) {
          if (viceFacilitiesNameToSave) member.memberName = viceFacilitiesNameToSave;
          if (viceFacilitiesPhoneToSave) member.contactPhone = viceFacilitiesPhoneToSave;
        }
      }
      if (principalNameToSave && !normalizedOrganizationMembers.some((m) => m.roleName.toLowerCase() === "kepala sekolah")) {
        normalizedOrganizationMembers.unshift({
          id: "",
          roleName: "Kepala Sekolah",
          memberName: principalNameToSave,
          contactPhone: principalPhoneToSave ?? "",
        });
      }
      if (
        viceFacilitiesNameToSave &&
        !normalizedOrganizationMembers.some((m) => m.roleName.toLowerCase().includes("wakasek sarana"))
      ) {
        const principalIdx = normalizedOrganizationMembers.findIndex(
          (m) => m.roleName.toLowerCase() === "kepala sekolah",
        );
        const insertAt = principalIdx >= 0 ? principalIdx + 1 : normalizedOrganizationMembers.length;
        normalizedOrganizationMembers.splice(insertAt, 0, {
          id: "",
          roleName: "Wakasek Sarana",
          memberName: viceFacilitiesNameToSave,
          contactPhone: viceFacilitiesPhoneToSave ?? "",
        });
      }

      const principalPosition = (payload.principalPosition as PrincipalPosition | null | undefined) || "KEPALA_SEKOLAH";
      const verificationStatus = payload.verificationStatus?.trim() || null;
      const verificationReviewNotes = payload.verificationReviewNotes?.trim() || null;
      const provinceCodeToStore =
        payload.provinceCode?.trim() && /^[0-9]{2}$/.test(payload.provinceCode.trim())
          ? payload.provinceCode.trim()
          : (payload.province ?? "").trim();
      const cityCodeToStore =
        payload.cityCode?.trim() && /^[0-9]{2}\.[0-9]{2}$/.test(payload.cityCode.trim())
          ? payload.cityCode.trim()
          : (payload.city ?? "").trim();
      const districtCodeToStore =
        payload.districtCode?.trim() && /^[0-9]{2}\.[0-9]{2}\.[0-9]{2}$/.test(payload.districtCode.trim())
          ? payload.districtCode.trim()
          : null;
      const villageCodeToStore =
        payload.villageCode?.trim() && /^[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/.test(payload.villageCode.trim())
          ? payload.villageCode.trim()
          : null;

      await connection.execute(
        `
          UPDATE schools
          SET
            npsn = ?,
            name = ?,
            province_code = ?,
            city_code = ?,
            district_code = ?,
            village_code = ?,
            address = ?,
            postal_code = ?,
            document_link = ?,
            rpd_link = ?,
            pks_link = ?,
            latitude = ?,
            longitude = ?,
            principal_name = ?,
            principal_position = ?,
            principal_nip = ?,
            principal_phone = ?,
            contact_name = ?,
            contact_phone = ?,
            vice_principal_facilities_name = ?,
            vice_principal_facilities_phone = ?,
            verification_status = COALESCE(?, verification_status),
            verification_review_notes = COALESCE(?, verification_review_notes)
          WHERE npsn = ?
        `,
        [
          (payload.npsn ?? "").trim(),
          (payload.schoolName ?? "").trim(),
          provinceCodeToStore,
          cityCodeToStore,
          districtCodeToStore,
          villageCodeToStore,
          (payload.address ?? "").trim(),
          payload.postalCode?.trim() || null,
          payload.documentLink?.trim() || null,
          payload.rpdLink?.trim() || null,
          payload.pksLink?.trim() || null,
          payload.latitude ?? null,
          payload.longitude ?? null,
          principalNameToSave,
          principalPosition,
          payload.principalNip?.trim() || null,
          principalPhoneToSave,
          null,
          null,
          viceFacilitiesNameToSave,
          viceFacilitiesPhoneToSave,
          verificationStatus,
          verificationReviewNotes,
          schoolId,
        ],
      );

      // ============== SAFETY WRAP: ORGANIZATION MEMBERS ==============
      // HANYA jalankan DELETE+INSERT JIKA user BENAR-BENAR mengirim
      // field organizationMembers di request payload (shouldUpdate = true).
      // Jika tidak → skip total, data existing TIDAK PERNAH terhapus.
      if (shouldUpdateOrganizationMembers) {
        await connection.execute("DELETE FROM school_profile_organization_members WHERE npsn = ?", [schoolId]);

        for (const [index, member] of normalizedOrganizationMembers.entries()) {
          await connection.execute(
            `
              INSERT INTO school_profile_organization_members (
                id,
                npsn,
                role_name,
                member_name,
                contact_phone,
                row_order
              ) VALUES (?, ?, ?, ?, ?, ?)
            `,
            [member.id || createId(), schoolId, member.roleName, member.memberName, member.contactPhone || null, index + 1],
          );
        }
      }

      // ============== SAFETY WRAP: CONCENTRATIONS (KK) ==============
      // Rule: Pisahkan menjadi 2 kategori:
      // (A) ADMIN_RECOMMENDATION: row_order 1-5 ATAU id ada di existing AND existing.row_order<=5
      //     -> TIDAK BOLEH dihapus, hanya UPDATE by-ID (hanya kolom rombel/siswa/luas/name/code yang dikirim sekolah saja)
      //     -> Source of Truth: kolom code/name dari row_order<=5 existing (jika user ganti code tapi ADMIN_RECOMMENDATION,
      //        biaya admin yang menentukan via endpoint khusus), TAPI input SEKOLAH (rombel/siswa) TETAP DITAMPUNG.
      // (B) SCHOOL_MANUAL: row_order > 5 ATAU id baru tidak ada di existing
      //     -> Delete semua row_order>5 lama yang TIDAK ADA di payload; Insert ulang dari payload.
      // Note: Ini adalah perbaikan untuk requirement:
      //       "KK yang ditetapkan dinas, biasanya sekolah juga sudah isi sebelumnya,
      //        TETEP HARUS BISA EDIT dan data asli inputan sekolahnya JANGAN DIHILANGKAN."
      if (shouldUpdateConcentrations) {
        const existingRecRows = existingConcentrationsRows.filter((r) => Number(r.row_order) > 0 && Number(r.row_order) <= 5);
        const existingManualRows = existingConcentrationsRows.filter((r) => Number(r.row_order) > 5 || Number(r.row_order) === 0);
        const preservedCount = existingRecRows.length;
        const minRowOrderManualVal = preservedCount > 0 ? 6 : 1;

        const usedManualIds = new Set<string>();

        // ---- (A) Loop UPDATE untuk KK ADMIN_RECOMMENDATION yang ada di payload ----
        const adminRecPayloadItems = normalizedConcentrations.filter(
          (c) =>
            (c.isAdminRecommendation === true) ||
            c.sourceType === "ADMIN_RECOMMENDATION" ||
            (c.id && existingById.has(c.id) && Number(existingById.get(c.id)!.row_order) <= 5) ||
            (Number(c.rowOrder) > 0 && Number(c.rowOrder) <= 5),
        );
        for (const concentration of adminRecPayloadItems) {
          // Tentukan target row yang akan diupdate: priority by existing id, fallback by existing row_order
          let targetRow: ConcExistingRow | undefined;
          if (concentration.id && existingById.has(concentration.id)) {
            targetRow = existingById.get(concentration.id)!;
          } else if (concentration.rowOrder && Number(concentration.rowOrder) <= 5) {
            targetRow = existingRecRows.find((r) => Number(r.row_order) === Number(concentration.rowOrder));
          }
          if (!targetRow) continue; // Jangan insert baru ADMIN_RECOMMENDATION dari endpoint sekolah; lewati saja.

          const aggregateRombel =
            concentration.rombelCount ||
            concentration.rombel10 + concentration.rombel11 + concentration.rombel12;
          const aggregateStudent =
            concentration.studentCount ||
            concentration.student10 + concentration.student11 + concentration.student12;

          // Merge: JANGAN timpa code/name dari existing jika tidak di-update oleh user (existing sudah ditetapkan dinas).
          // Namun: numOr/strOr di normalize sudah memakai nilai payload jika memang ada has() terkirim.
          // Disini kita pakai hasil normalizedConcentrations yang sudah "payload preferred, fallback ke existing".
          const finalCode = concentration.code || targetRow.concentration_code || "";
          const finalName = concentration.name || targetRow.concentration_name || "";

          await connection.execute(
            `
              UPDATE school_profile_concentrations
                 SET concentration_code = ?,
                     concentration_name = ?,
                     rombel_count = ?,
                     student_count = ?,
                     rombel_10 = ?,
                     student_10 = ?,
                     rombel_11 = ?,
                     student_11 = ?,
                     rombel_12 = ?,
                     student_12 = ?,
                     luas_ruangan_rps = ?
               WHERE id = ?
                 AND npsn = ?
            `,
            [
              finalCode,
              finalName,
              aggregateRombel,
              aggregateStudent,
              concentration.rombel10,
              concentration.student10,
              concentration.rombel11,
              concentration.student11,
              concentration.rombel12,
              concentration.student12,
              concentration.luasRuanganRps || null,
              targetRow.id,
              schoolId,
            ],
          );
        }

        // ---- (B) Loop DELETE+INSERT untuk KK SCHOOL_MANUAL ----
        // HANYA hapus row_order > 5 (tambahan sekolah) yang ada id-nya TIDAK sesuai payload SCHOOL_MANUAL
        const keptManualIdsFromPayload = new Set<string>();
        const manualPayloadItems = normalizedConcentrations.filter(
          (c) => !adminRecPayloadItems.includes(c),
        );
        for (const c of manualPayloadItems) {
          if (c.id && existingById.has(c.id) && Number(existingById.get(c.id)!.row_order) > 5) {
            keptManualIdsFromPayload.add(c.id);
          }
        }
        const manualRowsToDelete = existingManualRows.filter((r) => r.id && !keptManualIdsFromPayload.has(r.id));
        if (manualRowsToDelete.length > 0) {
          const deleteSql = `DELETE FROM school_profile_concentrations WHERE npsn = ? AND id IN (${manualRowsToDelete
            .map(() => "?")
            .join(", ")})`;
          await connection.execute(deleteSql, [schoolId, ...manualRowsToDelete.map((r) => r.id)]);
        }

        let manualInsertOrder = 0;
        for (const concentration of manualPayloadItems) {
          const aggregateRombel =
            concentration.rombelCount ||
            concentration.rombel10 + concentration.rombel11 + concentration.rombel12;
          const aggregateStudent =
            concentration.studentCount ||
            concentration.student10 + concentration.student11 + concentration.student12;

          // Kalau item ini punya id existing (row_order>5) dan masih retained: UPDATE saja agar riwayat/relasi tetep.
          const existingManual =
            concentration.id && existingById.has(concentration.id)
              ? existingById.get(concentration.id)!
              : null;
          if (existingManual && Number(existingManual.row_order) > 5) {
            usedManualIds.add(existingManual.id);
            await connection.execute(
              `
                UPDATE school_profile_concentrations
                   SET concentration_code = ?,
                       concentration_name = ?,
                       rombel_count = ?,
                       student_count = ?,
                       rombel_10 = ?,
                       student_10 = ?,
                       rombel_11 = ?,
                       student_11 = ?,
                       rombel_12 = ?,
                       student_12 = ?,
                       luas_ruangan_rps = ?,
                       row_order = ?
                 WHERE id = ?
                   AND npsn = ?
              `,
              [
                concentration.code,
                concentration.name,
                aggregateRombel,
                aggregateStudent,
                concentration.rombel10,
                concentration.student10,
                concentration.rombel11,
                concentration.student11,
                concentration.rombel12,
                concentration.student12,
                concentration.luasRuanganRps || null,
                Number(concentration.rowOrder) > 5 ? Number(concentration.rowOrder) : minRowOrderManualVal + manualInsertOrder,
                existingManual.id,
                schoolId,
              ],
            );
          } else {
            // INSERT KK BARU dari sekolah (tidak punya id existing)
            const insertRowOrder =
              Number(concentration.rowOrder) > 5
                ? Number(concentration.rowOrder)
                : minRowOrderManualVal + manualInsertOrder;
            await connection.execute(
              `
                INSERT INTO school_profile_concentrations (
                  id,
                  npsn,
                  concentration_code,
                  concentration_name,
                  rombel_count,
                  student_count,
                  rombel_10,
                  student_10,
                  rombel_11,
                  student_11,
                  rombel_12,
                  student_12,
                  luas_ruangan_rps,
                  row_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                createId(),
                schoolId,
                concentration.code,
                concentration.name,
                aggregateRombel,
                aggregateStudent,
                concentration.rombel10,
                concentration.student10,
                concentration.rombel11,
                concentration.student11,
                concentration.rombel12,
                concentration.student12,
                concentration.luasRuanganRps || null,
                insertRowOrder,
              ],
            );
          }
          manualInsertOrder += 1;
        }
      }

      return this.getProfileBySchoolId(schoolId, connection);
    });
  }

  private async getProfileBySchoolId(schoolId: string, connection?: PoolConnection) {
    const schoolSql = `
      SELECT
        s.npsn AS id,
        s.npsn,
        s.name,
        s.province_code,
        s.city_code,
        s.district_code,
        s.village_code,
        s.address,
        s.postal_code,
        s.document_link,
        s.rpd_link,
        s.pks_link,
        s.principal_name,
        s.principal_position,
        s.principal_nip,
        s.principal_phone,
        s.contact_name,
        s.contact_phone,
        s.vice_principal_facilities_name,
        s.vice_principal_facilities_phone,
        s.latitude,
        s.longitude,
        s.verification_status,
        s.verification_review_notes,
        prov_w.nama AS prov_nama,
        kota_w.nama AS kota_nama,
        kec_w.nama AS kec_nama,
        kel_w.nama AS kel_nama
      FROM schools s
      LEFT JOIN wilayah prov_w ON CHAR_LENGTH(s.province_code) = 2 AND prov_w.kode = s.province_code
      LEFT JOIN wilayah kota_w ON CHAR_LENGTH(s.city_code) = 5 AND kota_w.kode = s.city_code
      LEFT JOIN wilayah kec_w  ON CHAR_LENGTH(s.district_code) = 8 AND kec_w.kode = s.district_code
      LEFT JOIN wilayah kel_w  ON CHAR_LENGTH(s.village_code) = 13 AND kel_w.kode = s.village_code
      WHERE s.npsn = ?
      LIMIT 1
    `;

    const concentrationSql = `
      SELECT id, npsn AS school_id, concentration_code, concentration_name, rombel_count, student_count, rombel_10, student_10, rombel_11, student_11, rombel_12, student_12, luas_ruangan_rps, row_order
      FROM school_profile_concentrations
      WHERE npsn = ?
      ORDER BY row_order ASC, created_at ASC
    `;
    const organizationSql = `
      SELECT id, npsn AS school_id, role_name, member_name, contact_phone, row_order
      FROM school_profile_organization_members
      WHERE npsn = ?
      ORDER BY row_order ASC, created_at ASC
    `;
    const concentrationOptionsSql = `
      SELECT code, name
      FROM perdirjen_equipment_concentration
      ORDER BY code ASC, name ASC
    `;

    const [schoolRaw, concentrationRaw, organizationRaw, concentrationOptionRaw] = await Promise.all([
      connection
        ? connection.query<SchoolBaseRow[]>(schoolSql, [schoolId])
        : this.databaseService.query<SchoolBaseRow[]>(schoolSql, [schoolId]),
      connection
        ? connection.query<ConcentrationRow[]>(concentrationSql, [schoolId])
        : this.databaseService.query<ConcentrationRow[]>(concentrationSql, [schoolId]),
      connection
        ? connection.query<OrganizationMemberRow[]>(organizationSql, [schoolId])
        : this.databaseService.query<OrganizationMemberRow[]>(organizationSql, [schoolId]),
      connection
        ? connection.query<ConcentrationOptionRow[]>(concentrationOptionsSql)
        : this.databaseService.query<ConcentrationOptionRow[]>(concentrationOptionsSql),
    ]);
    const schoolRows = normalizeRows<SchoolBaseRow>(schoolRaw);
    const concentrationRows = normalizeRows<ConcentrationRow>(concentrationRaw);
    const organizationRows = normalizeRows<OrganizationMemberRow>(organizationRaw);
    const concentrationOptionRows = normalizeRows<ConcentrationOptionRow>(concentrationOptionRaw);
    const school = schoolRows[0];
    if (!school) {
      throw new NotFoundException("Profil sekolah tidak ditemukan.");
    }

    const organizationMembers =
      organizationRows.length > 0
        ? organizationRows.map((row) => ({
            id: row.id,
            roleName: row.role_name,
            memberName: row.member_name,
            contactPhone: row.contact_phone ?? "",
          }))
        : [
            {
              roleName: "Kepala Sekolah",
              memberName: school.principal_name ?? "",
              contactPhone: school.principal_phone ?? "",
            },
            {
              roleName: "Wakasek Sarana",
              memberName: school.vice_principal_facilities_name ?? school.contact_name ?? "",
              contactPhone: school.vice_principal_facilities_phone ?? school.contact_phone ?? "",
            },
          ].filter((item) => item.roleName && item.memberName);
    const concentrations = concentrationRows.map((row) => {
      const rombel10 = Number(row.rombel_10) || 0;
      const student10 = Number(row.student_10) || 0;
      const rombel11 = Number(row.rombel_11) || 0;
      const student11 = Number(row.student_11) || 0;
      const rombel12 = Number(row.rombel_12) || 0;
      const student12 = Number(row.student_12) || 0;
      const rombelCount =
        Number(row.rombel_count) || rombel10 + rombel11 + rombel12;
      const studentCount =
        Number(row.student_count) || student10 + student11 + student12;
      const rowOrderNum = Number(row.row_order) || 0;
      const isAdminRecommendation = rowOrderNum > 0 && rowOrderNum <= 5;
      const sourceType: "ADMIN_RECOMMENDATION" | "SCHOOL_MANUAL" = isAdminRecommendation
        ? "ADMIN_RECOMMENDATION"
        : "SCHOOL_MANUAL";
      const sourceLabel = isAdminRecommendation
        ? "Rekomendasi Dinas"
        : "Ditambahkan Sekolah";
      return {
        id: row.id,
        code: row.concentration_code ?? "",
        name: row.concentration_name,
        rombelCount,
        studentCount,
        rombel10,
        student10,
        rombel11,
        student11,
        rombel12,
        student12,
        luasRuanganRps: row.luas_ruangan_rps ?? "",
        rowOrder: rowOrderNum,
        isAdminRecommendation,
        sourceType,
        sourceLabel,
      };
    });
    const concentrationOptions = concentrationOptionRows.map((row) => ({
      code: row.code,
      name: row.name,
    }));

    const provinceValue = ((school.prov_nama || school.province_code) ?? "").trim();
    const cityValue = ((school.kota_nama || school.city_code) ?? "").trim();
    const districtValue = (school.kec_nama ?? "").trim();
    const villageValue = (school.kel_nama ?? "").trim();
    const regionParts: string[] = [villageValue, districtValue, cityValue, provinceValue].filter(Boolean);
    const regionDisplay = regionParts.length ? regionParts.join(", ") : "";

    return {
      schoolId: school.id,
      npsn: school.npsn,
      schoolName: school.name,
      province: provinceValue,
      provinceCode: /^[0-9]{2}$/.test(school.province_code ?? "") ? school.province_code : "",
      city: cityValue,
      cityCode: /^[0-9]{2}\.[0-9]{2}$/.test(school.city_code ?? "") ? school.city_code : "",
      district: districtValue,
      districtCode: (school.district_code ?? "").trim(),
      village: villageValue,
      villageCode: (school.village_code ?? "").trim(),
      regionDisplay,
      address: school.address ?? "",
      postalCode: school.postal_code ?? "",
      documentLink: school.document_link ?? "",
      rpdLink: school.rpd_link ?? "",
      pksLink: school.pks_link ?? "",
      latitude: toNullableNumber(school.latitude),
      longitude: toNullableNumber(school.longitude),
      principalName: school.principal_name ?? "",
      principalPosition: (school.principal_position as PrincipalPosition | null) ?? "KEPALA_SEKOLAH",
      principalNip: school.principal_nip ?? "",
      principalPhone: school.principal_phone ?? "",
      vicePrincipalFacilitiesName: school.vice_principal_facilities_name ?? school.contact_name ?? "",
      vicePrincipalFacilitiesPhone: school.vice_principal_facilities_phone ?? school.contact_phone ?? "",
      verificationStatus: school.verification_status ?? "MENUNGGU_REVIEW",
      verificationReviewNotes: school.verification_review_notes ?? "-",
      organizationMembers,
      concentrations,
      concentrationOptions,
      totalRombel: concentrations.reduce((sum, item) => sum + item.rombelCount, 0),
      totalStudents: concentrations.reduce((sum, item) => sum + item.studentCount, 0),
    };
  }

  private async getAdministrativeDocumentsBySchoolId(schoolId: string) {
    const rows = await this.databaseService.query<AdministrativeDocumentRow[]>(
      `
        SELECT id, npsn AS school_id, document_code, document_name, file_name, file_path, mime_type, file_size, review_status, review_notes, uploaded_at, updated_at
        FROM school_profile_administrative_documents
        WHERE npsn = ?
        ORDER BY uploaded_at ASC, id ASC
      `,
      [schoolId],
    );

    const rowsByCode = new Map<string, AdministrativeDocumentRow[]>();
    for (const row of rows) {
      const bucket = rowsByCode.get(row.document_code) ?? [];
      bucket.push(row);
      rowsByCode.set(row.document_code, bucket);
    }

    const concentrationsSql = `
      SELECT concentration_code, concentration_name
      FROM school_profile_concentrations
      WHERE npsn = ?
      ORDER BY row_order ASC, created_at ASC
    `;
    const concentrationRows =
      await this.databaseService.query<Array<{ concentration_code: string | null; concentration_name: string } & RowDataPacket>>(
        concentrationsSql,
        [schoolId],
      );

    const concentrationDefs: AdministrativeDocumentDefinition[] = concentrationRows
      .filter((row) => row.concentration_code)
      .map((row) => ({
        code: buildRpsDocumentCode(row.concentration_code ?? ""),
        name: `Dokumen Kondisi RPS — ${row.concentration_name ?? row.concentration_code ?? "Konsentrasi"}`,
        required: true,
        concentrationCode: row.concentration_code ?? "",
        concentrationName: row.concentration_name ?? "",
        isRpsPerConcentration: true,
      }));

    const staticEntries = administrativeDocumentDefinitions.map((definition, index) => {
      const group = rowsByCode.get(definition.code) ?? [];
      const latestRow = group[group.length - 1];
      const isRpsLike = false;

      return {
        no: index + 1,
        code: definition.code,
        name: definition.name,
        required: definition.required,
        allowMultiple: true,
        maxFiles: MULTIPLE_FILE_ADMINISTRATIVE_DOCUMENT_CODES.has(definition.code)
          ? MAX_MULTIPLE_FILES_PER_DOCUMENT
          : MAX_FILES_PER_DOCUMENT_DEFAULT,
        uploaded: group.length > 0,
        fileName: latestRow?.file_name ?? "",
        filePath: latestRow?.file_path ? `/uploads/school-profile-documents/${latestRow.file_path}` : "",
        mimeType: latestRow?.mime_type ?? "",
        fileSize: Number(latestRow?.file_size ?? 0),
        uploadedAt: latestRow?.uploaded_at ? new Date(latestRow.uploaded_at).toISOString() : null,
        reviewStatus: latestRow?.review_status ?? "PROSES",
        reviewNotes: latestRow?.review_notes ?? "-",
        files: group.map((row) => ({
          id: row.id,
          fileName: row.file_name ?? "",
          filePath: row.file_path ? `/uploads/school-profile-documents/${row.file_path}` : "",
          mimeType: row.mime_type ?? "",
          fileSize: Number(row.file_size ?? 0),
          uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : null,
          reviewStatus: row.review_status ?? "PROSES",
          reviewNotes: row.review_notes ?? "-",
        })),
        isRpsPerConcentration: isRpsLike,
        concentrationCode: "",
        concentrationName: "",
      };
    });

    const rpsStartNo = staticEntries.length + 1;
    const rpsEntries = concentrationDefs.map((definition, idx) => {
      const group = rowsByCode.get(definition.code) ?? [];
      const latestRow = group[group.length - 1];

      return {
        no: rpsStartNo + idx,
        code: definition.code,
        name: definition.name,
        required: definition.required,
        allowMultiple: true,
        maxFiles: MAX_RPS_FILES_PER_KONSENTRASI,
        uploaded: group.length > 0,
        fileName: latestRow?.file_name ?? "",
        filePath: latestRow?.file_path ? `/uploads/school-profile-documents/${latestRow.file_path}` : "",
        mimeType: latestRow?.mime_type ?? "",
        fileSize: Number(latestRow?.file_size ?? 0),
        uploadedAt: latestRow?.uploaded_at ? new Date(latestRow.uploaded_at).toISOString() : null,
        reviewStatus: latestRow?.review_status ?? "PROSES",
        reviewNotes: latestRow?.review_notes ?? "-",
        files: group.map((row) => ({
          id: row.id,
          fileName: row.file_name ?? "",
          filePath: row.file_path ? `/uploads/school-profile-documents/${row.file_path}` : "",
          mimeType: row.mime_type ?? "",
          fileSize: Number(row.file_size ?? 0),
          uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : null,
          reviewStatus: row.review_status ?? "PROSES",
          reviewNotes: row.review_notes ?? "-",
        })),
        isRpsPerConcentration: true,
        concentrationCode: (definition as AdministrativeDocumentDefinition & { concentrationCode?: string }).concentrationCode ?? "",
        concentrationName: (definition as AdministrativeDocumentDefinition & { concentrationName?: string }).concentrationName ?? "",
      };
    });

    return [...staticEntries, ...rpsEntries];
  }

  private async findNpsnForUser(userId: string, connection?: PoolConnection): Promise<string> {
    const sql = "SELECT COALESCE(u.npsn, s.npsn) AS npsn FROM users u LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn) WHERE u.id = ? LIMIT 1";
    const raw = connection
      ? await connection.query<UserNpsnRow[]>(sql, [userId])
      : await this.databaseService.query<UserNpsnRow[]>(sql, [userId]);
    const rows = normalizeRows<UserNpsnRow>(raw);
    const npsn = rows[0]?.npsn;

    if (!npsn) {
      throw new NotFoundException("Akun ini belum terhubung dengan sekolah.");
    }

    return npsn;
  }

  private async findSchoolIdByNpsnInternal(npsn: string): Promise<string> {
    const sql = "SELECT npsn AS id FROM schools WHERE npsn = ? LIMIT 1";
    const rows = await this.databaseService.query<Array<{ id: string } & RowDataPacket>>(sql, [npsn]);
    const schoolId = rows[0]?.id;
    if (!schoolId) {
      throw new NotFoundException("Sekolah dengan NPSN tersebut tidak ditemukan.");
    }
    return schoolId;
  }

  private async ensureSchema() {
    try {
      if (!this.databaseService?.query || typeof this.databaseService.query !== "function") return;
    } catch {
      return;
    }
    await this.addColumnIfMissing("schools", "postal_code", "ALTER TABLE schools ADD COLUMN postal_code VARCHAR(20) NULL AFTER address");
    await this.addColumnIfMissing(
      "schools",
      "document_link",
      "ALTER TABLE schools ADD COLUMN document_link VARCHAR(500) NULL AFTER postal_code",
    );
    await this.addColumnIfMissing(
      "schools",
      "rpd_link",
      "ALTER TABLE schools ADD COLUMN rpd_link VARCHAR(500) NULL AFTER document_link",
    );
    await this.addColumnIfMissing(
      "schools",
      "pks_link",
      "ALTER TABLE schools ADD COLUMN pks_link VARCHAR(500) NULL AFTER rpd_link",
    );
    await this.addColumnIfMissing(
      "schools",
      "principal_phone",
      "ALTER TABLE schools ADD COLUMN principal_phone VARCHAR(30) NULL AFTER principal_name",
    );
    await this.addColumnIfMissing(
      "schools",
      "principal_position",
      "ALTER TABLE schools ADD COLUMN principal_position VARCHAR(30) NULL AFTER principal_name",
    );
    await this.addColumnIfMissing(
      "schools",
      "principal_nip",
      "ALTER TABLE schools ADD COLUMN principal_nip VARCHAR(30) NULL AFTER principal_position",
    );
    await this.addColumnIfMissing(
      "schools",
      "latitude",
      "ALTER TABLE schools ADD COLUMN latitude DECIMAL(10,7) NULL AFTER postal_code",
    );
    await this.addColumnIfMissing(
      "schools",
      "longitude",
      "ALTER TABLE schools ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude",
    );
    await this.addColumnIfMissing(
      "schools",
      "verification_status",
      "ALTER TABLE schools ADD COLUMN verification_status VARCHAR(40) NULL DEFAULT 'MENUNGGU_REVIEW' AFTER longitude",
    );
    await this.addColumnIfMissing(
      "schools",
      "verification_review_notes",
      "ALTER TABLE schools ADD COLUMN verification_review_notes VARCHAR(500) NULL DEFAULT '-' AFTER verification_status",
    );

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS school_profile_concentrations (
        id CHAR(26) PRIMARY KEY,
        school_id CHAR(26) NOT NULL,
        concentration_code VARCHAR(20) NULL,
        concentration_name VARCHAR(255) NOT NULL,
        rombel_count INT NOT NULL DEFAULT 0,
        student_count INT NOT NULL DEFAULT 0,
        rombel_10 INT NOT NULL DEFAULT 0,
        student_10 INT NOT NULL DEFAULT 0,
        rombel_11 INT NOT NULL DEFAULT 0,
        student_11 INT NOT NULL DEFAULT 0,
        rombel_12 INT NOT NULL DEFAULT 0,
        student_12 INT NOT NULL DEFAULT 0,
        row_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_school_profile_concentrations_school
          FOREIGN KEY (school_id) REFERENCES schools(id)
          ON DELETE CASCADE
      )
    `);
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "concentration_code",
      "ALTER TABLE school_profile_concentrations ADD COLUMN concentration_code VARCHAR(20) NULL AFTER school_id",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "rombel_count",
      "ALTER TABLE school_profile_concentrations ADD COLUMN rombel_count INT NOT NULL DEFAULT 0 AFTER concentration_name",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "rombel_10",
      "ALTER TABLE school_profile_concentrations ADD COLUMN rombel_10 INT NOT NULL DEFAULT 0 AFTER student_count",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "student_10",
      "ALTER TABLE school_profile_concentrations ADD COLUMN student_10 INT NOT NULL DEFAULT 0 AFTER rombel_10",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "rombel_11",
      "ALTER TABLE school_profile_concentrations ADD COLUMN rombel_11 INT NOT NULL DEFAULT 0 AFTER student_10",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "student_11",
      "ALTER TABLE school_profile_concentrations ADD COLUMN student_11 INT NOT NULL DEFAULT 0 AFTER rombel_11",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "rombel_12",
      "ALTER TABLE school_profile_concentrations ADD COLUMN rombel_12 INT NOT NULL DEFAULT 0 AFTER student_11",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "student_12",
      "ALTER TABLE school_profile_concentrations ADD COLUMN student_12 INT NOT NULL DEFAULT 0 AFTER rombel_12",
    );
    await this.addColumnIfMissing(
      "school_profile_concentrations",
      "luas_ruangan_rps",
      "ALTER TABLE school_profile_concentrations ADD COLUMN luas_ruangan_rps VARCHAR(50) NULL AFTER student_12",
    );

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS school_profile_organization_members (
        id CHAR(26) PRIMARY KEY,
        school_id CHAR(26) NOT NULL,
        role_name VARCHAR(150) NOT NULL,
        member_name VARCHAR(150) NOT NULL,
        contact_phone VARCHAR(30) NULL,
        row_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_school_profile_organization_members_school
          FOREIGN KEY (school_id) REFERENCES schools(id)
          ON DELETE CASCADE
      )
    `);
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS school_profile_administrative_documents (
        id CHAR(26) PRIMARY KEY,
        school_id CHAR(26) NOT NULL,
        document_code VARCHAR(80) NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(150) NULL,
        file_size BIGINT NOT NULL DEFAULT 0,
        review_status VARCHAR(20) NOT NULL DEFAULT 'PROSES',
        review_notes VARCHAR(500) NOT NULL DEFAULT '-',
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_school_profile_administrative_document (school_id, document_code),
        CONSTRAINT fk_school_profile_administrative_documents_school
          FOREIGN KEY (school_id) REFERENCES schools(id)
          ON DELETE CASCADE
      )
    `);
    await this.addColumnIfMissing(
      "school_profile_administrative_documents",
      "review_status",
      "ALTER TABLE school_profile_administrative_documents ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'PROSES' AFTER file_size",
    );
    await this.addColumnIfMissing(
      "school_profile_administrative_documents",
      "review_notes",
      "ALTER TABLE school_profile_administrative_documents ADD COLUMN review_notes VARCHAR(500) NOT NULL DEFAULT '-' AFTER review_status",
    );
    await this.addColumnIfMissing(
      "schools",
      "vice_principal_facilities_name",
      "ALTER TABLE schools ADD COLUMN vice_principal_facilities_name VARCHAR(150) NULL AFTER contact_phone",
    );
    await this.addColumnIfMissing(
      "schools",
      "vice_principal_facilities_phone",
      "ALTER TABLE schools ADD COLUMN vice_principal_facilities_phone VARCHAR(30) NULL AFTER vice_principal_facilities_name",
    );
    await this.ensureIndexesReady();
  }

  private async ensureIndexesReady() {
    const logger = new Logger("SchoolProfileIndexes");
    try {
      const addIndex = async (tableName: string, idxName: string, createSql: string) => {
        const rows = await this.databaseService.query<ColumnExistsRow[]>(
          `
            SELECT COUNT(*) AS total
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND INDEX_NAME = ?
          `,
          [tableName, idxName],
        );
        if (Number(rows[0]?.total ?? 0) === 0) {
          try {
            await this.databaseService.query(createSql);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/Duplicate key name|already exists/i.test(msg)) {
              throw err;
            }
          }
        }
      };
      await addIndex(
        "school_profile_organization_members",
        "idx_sp_org_school_id_order",
        "CREATE INDEX idx_sp_org_school_id_order ON school_profile_organization_members (school_id, row_order)",
      );
      await addIndex(
        "school_profile_administrative_documents",
        "idx_spadm_school_id_code_uploaded",
        "CREATE INDEX idx_spadm_school_id_code_uploaded ON school_profile_administrative_documents (school_id, document_code, uploaded_at)",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Ensure indexes (non-fatal): ${msg}`);
    }
  }

  private async addColumnIfMissing(tableName: string, columnName: string, alterSql: string) {
    const rows = await this.databaseService.query<ColumnExistsRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
      `,
      [tableName, columnName],
    );

    if (Number(rows[0]?.total ?? 0) === 0) {
      await this.databaseService.query(alterSql);
    }
  }
}

function createId() {
  return `${Date.now().toString(36)}${randomBytes(10).toString("hex")}`.slice(0, 26).padEnd(26, "0");
}

function toNullableNumber(value: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSafeFileExtension(fileName: string) {
  const extension = path.extname(fileName).trim().toLowerCase();
  if (!extension || extension.length > 10) {
    return "";
  }

  return extension.replace(/[^.a-z0-9]/g, "");
}
