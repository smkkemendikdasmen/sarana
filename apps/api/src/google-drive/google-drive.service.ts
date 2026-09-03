import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { google, drive_v3, docs_v1 } from "googleapis";
import type { AuthClient } from "google-auth-library";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import type { RowDataPacket } from "mysql2/promise";
import { WorkspaceDataService } from "../workspace-data/workspace-data.service.js";
import { SchoolProfileService } from "../school-profile/school-profile.service.js";
import type { Readable } from "node:stream";

export type RpdPksKind = "RPD" | "PKS";
export type PlaceholderMap = Record<string, string>;

type SchoolProfileConcentrationMini = {
  id: string;
  code?: string | null;
  name?: string | null;
  rombelCount?: number;
  studentCount?: number;
};

type SchoolProfileOrgMember = {
  id: string;
  roleName?: string | null;
  memberName?: string | null;
  contactPhone?: string | null;
};

type ResolvedSchoolProfilePayload = {
  schoolId: string;
  npsn: string | null;
  schoolName: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  village?: string | null;
  regionDisplay?: string | null;
  address?: string | null;
  postalCode?: string | null;
  principalName?: string | null;
  principalNip?: string | null;
  principalPhone?: string | null;
  vicePrincipalFacilitiesName?: string | null;
  vicePrincipalFacilitiesPhone?: string | null;
  organizationMembers: SchoolProfileOrgMember[];
  concentrations: SchoolProfileConcentrationMini[];
  ppk?: {
    nama?: string | null;
    nip?: string | null;
    jabatan?: string | null;
    unitKerja?: string | null;
  } | null;
  identity?: {
    nama?: string | null;
    npsn?: string | null;
    alamat?: string | null;
    desaKelurahan?: string | null;
    kecamatan?: string | null;
    kabupatenKota?: string | null;
    provinsi?: string | null;
    kodePos?: string | null;
    telepon?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  headmaster?: {
    nama?: string | null;
    nip?: string | null;
  } | null;
};

export interface SchoolRpdPksDocumentRow {
  id: string;
  npsn: string;
  kind: RpdPksKind;
  google_doc_id: string | null;
  template_doc_id: string | null;
  title: string;
  doc_url: string | null;
  embed_url: string | null;
  status: "CREATING" | "READY" | "FAILED" | "EXPORTING";
  last_synced_at: string | null;
  exported_pdf_url: string | null;
  exported_docx_url: string | null;
  created_at: string;
  updated_at: string;
  last_error_message: string | null;
}

export interface ResolvedPlaceholderBundle {
  profile: ResolvedSchoolProfilePayload | null;
  proposalTotalRupiahFormatted: string;
  proposalTotalRupiah: number;
  surveyItemCount: number;
  konsentrasiJoined: string;
  map: PlaceholderMap;
}

type UpsertPatch = Partial<{
  template_doc_id: string | null;
  google_doc_id: string | null;
  title: string | null;
  doc_url: string | null;
  embed_url: string | null;
  status: "CREATING" | "READY" | "FAILED" | "EXPORTING";
  last_synced_at: string | null;
  exported_pdf_url: string | null;
  exported_docx_url: string | null;
  last_error_message: string | null;
}>;

@Injectable()
export class GoogleDriveService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GoogleDriveService.name);
  private static instanceRef: GoogleDriveService | null = null;
  private jwtAuth: AuthClient | null = null;
  private driveClient: drive_v3.Drive | null = null;
  private docsClient: docs_v1.Docs | null = null;
  private configReady = false;
  private schemaEnsured = false;
  private readonly defaultScopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
  ];
  private readonly injectedDb: DatabaseService | null;

  constructor(databaseService: DatabaseService) {
    this.injectedDb = databaseService ?? null;
    try {
      if (!GoogleDriveService.instanceRef) GoogleDriveService.instanceRef = this;
    } catch (_) { /* ignore */ }
    const _ = WorkspaceDataService.getGlobalSingletonInstanceOrNull?.();
    const __ = SchoolProfileService.getGlobalSingletonInstanceOrNull?.();
  }

  private db(): DatabaseService {
    type AnyWithDb = { databaseService?: DatabaseService };
    const hasQueryFn = (x: unknown): x is DatabaseService => {
      if (!x || typeof x !== "object") return false;
      const o = x as { query?: unknown; transaction?: unknown };
      return typeof o.query === "function" && typeof o.transaction === "function";
    };
    if (hasQueryFn(this.injectedDb)) return this.injectedDb;
    try {
      const direct = (DatabaseService as unknown as {
        getGlobalSingletonInstance?: () => DatabaseService;
        getGlobalSingletonInstanceOrNull?: () => DatabaseService | null;
      });
      const a = direct.getGlobalSingletonInstanceOrNull?.();
      if (hasQueryFn(a)) return a;
      const b = direct.getGlobalSingletonInstance?.();
      if (hasQueryFn(b)) return b;
    } catch { /* ignore */ }
    try {
      const wds = (WorkspaceDataService as unknown as {
        getGlobalSingletonInstance?: () => unknown;
        getGlobalSingletonInstanceOrNull?: () => unknown | null;
      });
      const wInst = wds.getGlobalSingletonInstanceOrNull?.() ?? wds.getGlobalSingletonInstance?.();
      const wDb = (wInst as AnyWithDb | undefined)?.databaseService;
      if (hasQueryFn(wDb)) return wDb;
    } catch { /* ignore */ }
    try {
      const sps = (SchoolProfileService as unknown as {
        getGlobalSingletonInstance?: () => unknown;
        getGlobalSingletonInstanceOrNull?: () => unknown | null;
      });
      const sInst = sps.getGlobalSingletonInstanceOrNull?.() ?? sps.getGlobalSingletonInstance?.();
      const sDb = (sInst as AnyWithDb | undefined)?.databaseService;
      if (hasQueryFn(sDb)) return sDb;
    } catch { /* ignore */ }
    throw new InternalServerErrorException(
      "Database Service belum siap (lazy connect). Silakan refresh halaman 1-2 detik lagi.",
    );
  }

  static getGlobalSingletonInstanceOrNull(): GoogleDriveService | null {
    const inst = GoogleDriveService.instanceRef;
    if (inst) return inst;
    try {
      const db = DatabaseService.getGlobalSingletonInstanceOrNull?.();
      if (!db) return null;
      const fresh = new GoogleDriveService(db);
      GoogleDriveService.instanceRef = fresh;
      return fresh;
    } catch (_) { return null; }
  }

  static getGlobalSingletonInstance(): GoogleDriveService {
    const existing = GoogleDriveService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new GoogleDriveService(db);
    GoogleDriveService.instanceRef = fresh;
    return fresh;
  }

  async onApplicationBootstrap() {
    try {
      this.loadOrRefreshAuthClientFromEnv();
      if (this.schemaEnsured) return;
      const tryOnce = async () => {
        try {
          const db = this.db();
          const canQuery = typeof db?.query === "function";
          if (!canQuery) return false;
          const [row] = await db.query<RowDataPacket[]>(`SELECT 1 AS ok`);
          if (!row?.[0]?.ok) return false;
        } catch {
          return false;
        }
        await this.ensureSchema();
        this.schemaEnsured = true;
        return true;
      };
      for (let attempt = 1; attempt <= 6; attempt++) {
        if (await tryOnce()) {
          if (this.configReady) {
            this.logger.log("[GDrive] Service initialized with Service Account + scopes OK");
          } else {
            this.logger.warn(
              "[GDrive] GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 / template env not set — controller endpoints will return graceful 503 notice user fill env.",
            );
          }
          return;
        }
        await new Promise((r) => setTimeout(r, attempt * 400));
      }
      this.logger.warn(
        "[ensureSchema:onApplicationBootstrap] ⚠️ DB belum siap setelah 6 retry; skip ensure schema (lazy apply di request pertama).",
      );
    } catch (err) {
      this.logger.error("Failed bootstrap GDrive (non-fatal):", err);
    }
  }

  private async ensureSchemaIfNeeded() {
    if (this.schemaEnsured) return;
    const tryPingOnce = async () => {
      try {
        const db = this.db();
        const [row] = await db.query<RowDataPacket[]>(`SELECT 1 AS ok`);
        if (!row?.[0]?.ok) return false;
      } catch { return false; }
      return true;
    };
    for (let attempt = 1; attempt <= 6; attempt++) {
      if (await tryPingOnce()) {
        await this.ensureSchema();
        this.schemaEnsured = true;
        return;
      }
      await new Promise((r) => setTimeout(r, attempt * 400));
    }
    throw new InternalServerErrorException(
      "Database Service belum siap (pool connect in progress). Silakan refresh halaman 1-2 detik lagi.",
    );
  }

  private async ensureSchema() {
    try {
      const db = this.db();
      if (!db?.query || typeof db.query !== "function") return;
    } catch {
      return;
    }
    await this.ensureTableExists();
  }

  private loadOrRefreshAuthClientFromEnv(): { ok: boolean; reason?: string } {
    try {
      const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ?? "";
      if (!base64Key.trim()) {
        this.configReady = false;
        return { ok: false, reason: "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 env is empty" };
      }
      const jsonBuf = Buffer.from(base64Key, "base64").toString("utf-8");
      const credentials = JSON.parse(jsonBuf);
      const jwt = new google.auth.JWT({
        email: credentials.client_email,
        key: String(credentials.private_key ?? "").replace(/\\n/g, "\n"),
        scopes: this.defaultScopes,
        subject: process.env.GOOGLE_DRIVE_IMPERSONATE_USER_EMAIL ?? undefined,
      });
      this.jwtAuth = jwt as unknown as AuthClient;
      this.driveClient = google.drive({ version: "v3", auth: jwt as any });
      this.docsClient = google.docs({ version: "v1", auth: jwt as any });
      this.configReady = true;
      return { ok: true };
    } catch (e) {
      this.configReady = false;
      return { ok: false, reason: (e as Error).message };
    }
  }

  isConfigured(): boolean {
    return this.configReady;
  }

  private async ensureTableExists() {
    await this.db().query(`
      CREATE TABLE IF NOT EXISTS school_rpd_pks_documents (
        id CHAR(26) PRIMARY KEY,
        npsn VARCHAR(32) NOT NULL,
        kind ENUM('RPD','PKS') NOT NULL,
        template_doc_id VARCHAR(128) NULL,
        google_doc_id VARCHAR(128) NULL,
        title VARCHAR(512) NOT NULL,
        doc_url VARCHAR(1024) NULL,
        embed_url VARCHAR(1024) NULL,
        status ENUM('CREATING','READY','FAILED','EXPORTING') NOT NULL DEFAULT 'CREATING',
        last_synced_at DATETIME NULL,
        exported_pdf_url VARCHAR(1024) NULL,
        exported_docx_url VARCHAR(1024) NULL,
        last_error_message TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_npsn_kind (npsn, kind),
        INDEX idx_google_doc_id (google_doc_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private newNanoId(prefix = "gd"): string {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    const t = Date.now().toString(36);
    const targetLength = 26;
    let r = "";
    const padLen = Math.max(0, targetLength - prefix.length - 1 - t.length);
    for (let i = 0; i < padLen; i++) {
      r += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}_${t}${r}`;
  }

  async getEnvTemplateIdOrThrow(kind: RpdPksKind): Promise<string> {
    this.loadOrRefreshAuthClientFromEnv();
    if (!this.configReady)
      throw new BadRequestException(
        "Google Service Account belum di konfigurasi di file env (GOOGLE_SERVICE_ACCOUNT_JSON_BASE64).",
      );
    const idEnv =
      kind === "RPD" ? process.env.GOOGLE_DRIVE_RPD_TEMPLATE_ID : process.env.GOOGLE_DRIVE_PKS_TEMPLATE_ID;
    if (!idEnv) {
      throw new BadRequestException(
        `Template ID untuk ${kind} belum di-set di env (${
          kind === "RPD" ? "GOOGLE_DRIVE_RPD_TEMPLATE_ID" : "GOOGLE_DRIVE_PKS_TEMPLATE_ID"
        }). Dapatkan dari URL Google Doc template: https://docs.google.com/document/d/[[ID-INI]]/edit`,
      );
    }
    return idEnv;
  }

  async resolvePlaceholdersForSchoolNpsn(npsn: string): Promise<ResolvedPlaceholderBundle> {
    const ws = WorkspaceDataService.getGlobalSingletonInstance();
    const schoolProfileSvc = SchoolProfileService.getGlobalSingletonInstance();
    const resolvedAny: ResolvedSchoolProfilePayload | null = null as unknown as ResolvedSchoolProfilePayload | null;
    let profile: ResolvedSchoolProfilePayload | null = resolvedAny;
    let proposalTotalRupiah = 0;
    let surveyItemCount = 0;
    const konsentrasiList: string[] = [];
    try {
      const raw = (await schoolProfileSvc.getProfileByNpsn(npsn)) as unknown as ResolvedSchoolProfilePayload;
      profile = raw;
      const kons = profile.concentrations ?? [];
      for (const k of kons) if (k?.name) konsentrasiList.push(String(k.name));
    } catch (_) {
      profile = null;
    }
    try {
      const proposal = await ws.getSchoolProposalByNpsn(npsn);
      const rpkpSel = (proposal?.rpkpSelections ?? {}) as Record<string, unknown>;
      surveyItemCount = Number(
        (typeof (rpkpSel.__metaSurveyItemCount as unknown) === "number"
          ? rpkpSel.__metaSurveyItemCount
          : rpkpSel.__metaSurveyItemCount) ?? 0,
      ) || 0;
      proposalTotalRupiah =
        Number(
          (typeof (rpkpSel.__metaRabGrandTotalRupiah as unknown) === "number"
            ? rpkpSel.__metaRabGrandTotalRupiah
            : rpkpSel.__metaRabGrandTotalRupiah) ?? 0,
        ) || 0;
    } catch (_) {
      proposalTotalRupiah = 0;
    }
    const numberFormatter = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
    const proposalTotalRupiahFormatted = numberFormatter.format(proposalTotalRupiah || 0);
    const now = new Date();
    const tanggalBulanTahunId = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const bulanTahunId = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const tanggalId = now.toLocaleDateString("id-ID", { day: "numeric" });
    const bulanId = now.toLocaleDateString("id-ID", { month: "long" });
    const tahunId = now.toLocaleDateString("id-ID", { year: "numeric" });

    const identity = profile?.identity ?? null;
    const head = profile?.headmaster ?? null;
    const ppk = profile?.ppk ?? null;
    const prov = identity?.provinsi ?? profile?.province ?? "";
    const kab = identity?.kabupatenKota ?? profile?.city ?? "";
    const kec = identity?.kecamatan ?? profile?.district ?? "";
    const kel = identity?.desaKelurahan ?? profile?.village ?? "";

    const map: PlaceholderMap = {
      "{{nama_sekolah}}": identity?.nama ?? profile?.schoolName ?? "",
      "{{npsn_sekolah}}": identity?.npsn ?? profile?.npsn ?? npsn,
      "{{npsn}}": identity?.npsn ?? profile?.npsn ?? npsn,
      "{{alamat_sekolah}}": identity?.alamat ?? profile?.address ?? "",
      "{{desa_kelurahan_sekolah}}": kel,
      "{{kecamatan_sekolah}}": kec,
      "{{kabupaten_kota_sekolah}}": kab,
      "{{provinsi_sekolah}}": prov,
      "{{kode_pos_sekolah}}": identity?.kodePos ?? profile?.postalCode ?? "",
      "{{nomor_telepon_sekolah}}": identity?.telepon ?? profile?.principalPhone ?? "",
      "{{email_sekolah}}": identity?.email ?? "",
      "{{website_sekolah}}": identity?.website ?? "",
      "{{nama_kepala_sekolah}}": head?.nama ?? profile?.principalName ?? "",
      "{{nip_kepala_sekolah}}": head?.nip ?? profile?.principalNip ?? "",
      "{{nama_ppk}}": ppk?.nama ?? "",
      "{{nip_ppk}}": ppk?.nip ?? "",
      "{{jabatan_ppk}}": ppk?.jabatan ?? "",
      "{{unit_kerja_ppk}}": ppk?.unitKerja ?? "",
      "{{konsentrasi_keahlian}}": konsentrasiList.join(", "),
      "{{jumlah_konsentrasi}}": String(konsentrasiList.length || 0),
      "{{tanggal_hari_ini}}": tanggalBulanTahunId,
      "{{bulan_tahun}}": bulanTahunId,
      "{{tanggal}}": tanggalId,
      "{{bulan}}": bulanId,
      "{{tahun}}": tahunId,
      "{{total_bantuan_rp}}": proposalTotalRupiahFormatted,
      "{{total_bantuan_rp_angka}}": String(proposalTotalRupiah || 0),
      "{{total_item_survey}}": String(surveyItemCount || 0),
    };
    return {
      profile,
      proposalTotalRupiahFormatted,
      proposalTotalRupiah,
      surveyItemCount,
      konsentrasiJoined: konsentrasiList.join(", "),
      map,
    };
  }

  async findDocumentByNpsnAndKind(
    npsn: string,
    kind: RpdPksKind,
  ): Promise<SchoolRpdPksDocumentRow | null> {
    try {
      await this.ensureSchemaIfNeeded();
      const rows = await this.db().query<(SchoolRpdPksDocumentRow & RowDataPacket)[]>(
        "SELECT * FROM school_rpd_pks_documents WHERE npsn = ? AND kind = ? LIMIT 1",
        [npsn, kind],
      );
      return rows[0] ?? null;
    } catch (e) {
      this.logger.warn(
        `findDocumentByNpsnAndKind graceful fallback null (db not ready for ${npsn}/${kind}): ${(e as Error).message}`,
      );
      return null;
    }
  }

  async findDocumentById(docId: string): Promise<SchoolRpdPksDocumentRow | null> {
    try {
      await this.ensureSchemaIfNeeded();
      const rows = await this.db().query<(SchoolRpdPksDocumentRow & RowDataPacket)[]>(
        "SELECT * FROM school_rpd_pks_documents WHERE id = ? OR google_doc_id = ? LIMIT 1",
        [docId, docId],
      );
      return rows[0] ?? null;
    } catch (e) {
      this.logger.warn(
        `findDocumentById graceful fallback null (db not ready): ${(e as Error).message}`,
      );
      return null;
    }
  }

  async listAllByNpsn(npsn: string): Promise<SchoolRpdPksDocumentRow[]> {
    try {
      await this.ensureSchemaIfNeeded();
      return await this.db().query<(SchoolRpdPksDocumentRow & RowDataPacket)[]>(
        "SELECT * FROM school_rpd_pks_documents WHERE npsn = ? ORDER BY kind, created_at DESC",
        [npsn],
      );
    } catch (e) {
      this.logger.warn(
        `listAllByNpsn graceful fallback empty array (db not ready for ${npsn}): ${(e as Error).message}`,
      );
      return [];
    }
  }

  async updateDocumentError(id: string, message: string) {
    try {
      await this.ensureSchemaIfNeeded();
      await this.db().query(
        "UPDATE school_rpd_pks_documents SET status = 'FAILED', last_error_message = ? WHERE id = ? LIMIT 1",
        [message, id],
      );
    } catch (e) {
      this.logger.warn(`updateDocumentError skip (db not ready for ${id}): ${(e as Error).message}`);
    }
  }

  private async upsertDocumentRow(
    npsn: string,
    kind: RpdPksKind,
    patch: UpsertPatch,
  ): Promise<string> {
    await this.ensureSchemaIfNeeded();
    return this.db().transaction(async (conn) => {
      const existing = (
        await conn.query<(SchoolRpdPksDocumentRow & RowDataPacket)[]>(
          "SELECT id FROM school_rpd_pks_documents WHERE npsn = ? AND kind = ? LIMIT 1",
          [npsn, kind],
        )
      )[0]?.[0];
      if (!existing) {
        const id = this.newNanoId("rp");
        const columns: string[] = ["id", "npsn", "kind"];
        const placeholders: string[] = ["?", "?", "?"];
        const values: unknown[] = [id, npsn, kind];
        for (const key of Object.keys(patch)) {
          const kSnake = key;
          columns.push(kSnake);
          placeholders.push("?");
          values.push((patch as Record<string, unknown>)[key] ?? null);
        }
        await conn.query(
          `INSERT INTO school_rpd_pks_documents (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
          values,
        );
        return id;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of Object.keys(patch)) {
        sets.push(`${key} = ?`);
        values.push((patch as Record<string, unknown>)[key] ?? null);
      }
      values.push(existing.id);
      if (sets.length)
        await conn.query(`UPDATE school_rpd_pks_documents SET ${sets.join(", ")} WHERE id = ? LIMIT 1`, values);
      return existing.id;
    });
  }

  async createOrRefreshDocumentForSchool(
    npsn: string,
    kind: RpdPksKind,
  ): Promise<SchoolRpdPksDocumentRow> {
    const existing = await this.findDocumentByNpsnAndKind(npsn, kind);
    const templateDocId = await this.getEnvTemplateIdOrThrow(kind);
    const { map, profile } = await this.resolvePlaceholdersForSchoolNpsn(npsn);
    const namaSekolah =
      (profile?.identity?.nama as string | undefined) ??
      (profile?.schoolName as string | undefined) ??
      `Sekolah ${npsn}`;
    const title = `${kind} Sarana ${new Date().getFullYear()} — ${namaSekolah}`;
    if (
      existing?.status === "READY" &&
      existing.google_doc_id &&
      existing.template_doc_id === templateDocId
    ) {
      try {
        this.logger.log(`[GDrive] Refresh placeholder for ${existing.google_doc_id}`);
        await this.batchReplaceTextPlaceholders(existing.google_doc_id, map);
        const lastSyncedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        await this.upsertDocumentRow(npsn, kind, { last_synced_at: lastSyncedAt });
        return (await this.findDocumentByNpsnAndKind(npsn, kind))!;
      } catch (err) {
        this.logger.error(`[GDrive] Refresh placeholder failed`, err);
        return existing;
      }
    }
    const rowId = await this.upsertDocumentRow(npsn, kind, {
      template_doc_id: templateDocId,
      title,
      status: "CREATING",
      last_error_message: null,
    });
    try {
      if (!this.driveClient || !this.docsClient) {
        const refreshResult = this.loadOrRefreshAuthClientFromEnv();
        if (!refreshResult.ok || !this.driveClient || !this.docsClient) {
          throw new BadRequestException(
            `Auth Google Drive gagal disiapkan: ${refreshResult.reason ?? "unknown"}`,
          );
        }
      }
      const outputFolderId = process.env.GOOGLE_DRIVE_SHARED_OUTPUT_FOLDER_ID?.trim() ?? "";
      const copyBody: drive_v3.Schema$File = {
        name: title,
        mimeType: "application/vnd.google-apps.document",
      };
      if (outputFolderId) copyBody.parents = [outputFolderId];
      const copyRes = await this.driveClient.files.copy({
        fileId: templateDocId,
        requestBody: copyBody,
        supportsAllDrives: true,
      });
      const newDocId = (copyRes.data as { id: string }).id!;
      try {
        await this.batchReplaceTextPlaceholders(newDocId, map);
      } catch (e) {
        this.logger.warn(
          `[GDrive] Replace placeholder warning (${kind} doc ${newDocId}): ${(e as Error).message}`,
        );
      }
      const docUrl = `https://docs.google.com/document/d/${newDocId}/edit?usp=sharing`;
      const embedUrl = `https://docs.google.com/document/d/${newDocId}/preview`;
      const lastSyncedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
      await this.upsertDocumentRow(npsn, kind, {
        google_doc_id: newDocId,
        template_doc_id: templateDocId,
        title,
        doc_url: docUrl,
        embed_url: embedUrl,
        status: "READY",
        last_synced_at: lastSyncedAt,
        last_error_message: null,
      });
      return (await this.findDocumentByNpsnAndKind(npsn, kind))!;
    } catch (err) {
      const msg = (err as Error).message || String(err);
      this.logger.error("[GDrive] create doc error", err);
      await this.updateDocumentError(rowId, msg);
      throw new InternalServerErrorException(`Gagal membuat Google Doc ${kind}: ${msg}`);
    }
  }

  private async batchReplaceTextPlaceholders(
    documentId: string,
    replacements: PlaceholderMap,
  ): Promise<void> {
    if (!this.docsClient) throw new InternalServerErrorException("Docs client not ready");
    const keys = Object.keys(replacements);
    const requests: docs_v1.Schema$Request[] = [];
    for (const key of keys) {
      const replaceWith = replacements[key] ?? "";
      requests.push({
        replaceAllText: {
          containsText: { text: key, matchCase: true },
          replaceText: replaceWith,
        },
      });
    }
    if (!requests.length) return;
    await this.docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }

  async setDocumentPubliclyViewableOrShare(
    docId: string,
    role: "reader" | "writer" = "writer",
  ): Promise<string> {
    if (!this.driveClient) throw new InternalServerErrorException("Drive client not ready");
    await this.driveClient.permissions.create({
      fileId: docId,
      supportsAllDrives: true,
      requestBody: {
        type: "anyone",
        role,
      },
    });
    return `https://docs.google.com/document/d/${docId}/edit?usp=sharing`;
  }

  async exportDocumentStream(docId: string, format: "pdf" | "docx"): Promise<Readable> {
    if (!this.driveClient) throw new InternalServerErrorException("Drive client not ready");
    const mimeType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const res = await this.driveClient.files.export(
      { fileId: docId, mimeType },
      { responseType: "stream" },
    );
    return res.data as unknown as Readable;
  }

  static extractDocIdFromUrlOrId(raw: string): string {
    const trimmed = String(raw || "").trim();
    if (!trimmed) throw new BadRequestException("Link Google Doc tidak boleh kosong.");
    if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) return trimmed;
    const patterns = [
      /document\/d\/([a-zA-Z0-9_-]+)/,
      /spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
      /presentation\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
    ];
    for (const re of patterns) {
      const m = trimmed.match(re);
      if (m && m[1]) return m[1];
    }
    throw new BadRequestException(
      "Link Google Doc tidak valid. Gunakan URL seperti https://docs.google.com/document/d/ID/edit atau paste ID doc saja.",
    );
  }

  async linkExistingDocumentForSchool(
    npsn: string,
    kind: RpdPksKind,
    docIdOrUrl: string,
  ): Promise<SchoolRpdPksDocumentRow> {
    if (!this.isConfigured()) throw new BadRequestException("Google service account belum di-setup.");
    if (!this.driveClient || !this.docsClient) {
      const refreshResult = this.loadOrRefreshAuthClientFromEnv();
      if (!refreshResult.ok || !this.driveClient || !this.docsClient) {
        throw new BadRequestException(
          `Auth Google Drive gagal disiapkan: ${refreshResult.reason ?? "unknown"}`,
        );
      }
    }
    const docId = GoogleDriveService.extractDocIdFromUrlOrId(docIdOrUrl);
    let fileMeta: drive_v3.Schema$File;
    try {
      fileMeta = (await this.driveClient.files.get({
        fileId: docId,
        supportsAllDrives: true,
        fields: "id,name,mimeType,permissions",
      })).data;
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      if (/404|notFound/i.test(msg)) {
        throw new BadRequestException(
          "Google Doc ID tidak ditemukan. Pastikan kamu sudah share doc: General Access = Anyone with the link → Editor.",
        );
      }
      if (/403|forbidden/i.test(msg)) {
        throw new BadRequestException(
          "Akses Google Doc ditolak. Buka doc → Share → General Access: Ubah Restricted jadi 'Anyone with the link' → Role: Editor → Save. Atau share ke email Service Account: sarana@sarana-506716.iam.gserviceaccount.com sebagai Editor.",
        );
      }
      throw new InternalServerErrorException("Gagal membaca Google Doc: " + msg);
    }
    if (fileMeta.mimeType && fileMeta.mimeType !== "application/vnd.google-apps.document") {
      throw new BadRequestException(
        "Hanya Google Docs (bukan Spreadsheet / PDF / Gambar) yang dapat digunakan untuk template RPD/PKS.",
      );
    }
    const bundle = await this.resolvePlaceholdersForSchoolNpsn(npsn);
    try {
      await this.batchReplaceTextPlaceholders(docId, bundle.map);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      throw new InternalServerErrorException("Gagal replace placeholder di dokumen: " + msg);
    }
    const namaSekolah =
      (bundle.profile?.identity?.nama as string | undefined) ??
      (bundle.profile?.schoolName as string | undefined) ??
      `Sekolah ${npsn}`;
    const title = `${kind} Sarana ${new Date().getFullYear()} — ${namaSekolah}`;
    const lastSyncedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      await this.driveClient.files.update({
        fileId: docId,
        requestBody: { name: title },
        supportsAllDrives: true,
      });
    } catch (_) {}
    const patch: UpsertPatch = {
      google_doc_id: docId,
      title,
      doc_url: `https://docs.google.com/document/d/${docId}/edit`,
      embed_url: `https://docs.google.com/document/d/${docId}/preview?rm=minimal`,
      status: "READY",
      last_synced_at: lastSyncedAt,
      last_error_message: null,
    };
    await this.upsertDocumentRow(npsn, kind, patch);
    return (await this.findDocumentByNpsnAndKind(npsn, kind))!;
  }
}
