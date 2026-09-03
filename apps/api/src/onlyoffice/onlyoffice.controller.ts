import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { OnlyOfficeService, OnlyOfficeTrackBody } from "./onlyoffice.service.js";

interface PrepareEditorQuery {
  npsn: string;
  kind: string;
  userId?: string;
  userName?: string;
  editable?: string;
  applyPlaceholders?: string;
}

type SchoolProfileLite = {
  schoolName?: string | null;
  npsn?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  principalName?: string | null;
  principalNip?: string | null;
};

type PlaceholderCtxLite = {
  totalAnggaranRpNumber?: number | null;
  ppkName?: string | null;
  ppkNip?: string | null;
  fasilitatorName?: string | null;
  fasilitatorNipNik?: string | null;
};

type PlaceholderKey =
  | "nama_sekolah"
  | "npsn"
  | "alamat_sekolah"
  | "kab_kota_sekolah"
  | "provinsi_sekolah"
  | "kode_pos_sekolah"
  | "kepala_sekolah_nama"
  | "kepala_sekolah_nip"
  | "tanggal_sekarang"
  | "tahun_anggaran"
  | "tahun_ajaran"
  | "kota_pembuatan_surat"
  | "kab_kota_ttd"
  | "konsentrasi_keahlian_list"
  | "sumber_dana"
  | "nama_ppk"
  | "nip_ppk"
  | "nama_fasilitator"
  | "nip_fasilitator"
  | "total_anggaran_rp"
  | "total_anggaran_terbilang"
  | "tahap1_70_rp"
  | "tahap2_30_rp"
  | "konsentrasi_keahlian_rpd_uraian"
  | "hari_tanggal_terbilang"
  | "kontak_kepala_sekolah"
  | "nomor_rpd"
  | "nomor_pks"
  | "nomor_sk_tim"
  | "nomor_bast"
  | "nomor_bapb"
  | "ketua_tim_sarpras_nama"
  | "sekretaris_tim_nama"
  | "bendahara_tim_nama"
  | "anggota_teknis_tim_nama"
  | "masa_berlaku_mulai"
  | "masa_berlaku_selesai"
  | "mitra_nama"
  | "mitra_alamat"
  | "mitra_kota"
  | "mitra_npwp"
  | "mitra_direktur_nama"
  | "mitra_direktur_nik"
  | "ruang_lingkup";

function buildPlaceholderMapFromProfileLocal(
  profile: SchoolProfileLite,
  extras: PlaceholderCtxLite = {},
): Partial<Record<PlaceholderKey, string>> {
  const today = new Date();
  const dateId = today.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const konsentrasiNamesPlain = "";
  const totalNum = extras.totalAnggaranRpNumber ?? 0;
  const fmtRp = (n: number) =>
    n <= 0 ? "" : "Rp" + Math.round(n).toLocaleString("id-ID");
  const tahap1 = totalNum ? Math.round(totalNum * 0.7) : 0;
  const tahap2 = totalNum ? Math.round(totalNum * 0.3) : 0;
  return {
    nama_sekolah: profile.schoolName ?? "",
    npsn: profile.npsn ?? "",
    alamat_sekolah: profile.address ?? "",
    kab_kota_sekolah: profile.city ?? "",
    provinsi_sekolah: profile.province ?? "",
    kode_pos_sekolah: profile.postalCode ?? "",
    kepala_sekolah_nama: profile.principalName ?? "",
    kepala_sekolah_nip: profile.principalNip ?? "",
    tanggal_sekarang: dateId,
    tahun_anggaran: String(today.getFullYear()),
    tahun_ajaran: `${today.getFullYear()}/${today.getFullYear() + 1}`,
    kota_pembuatan_surat: profile.city ?? "",
    kab_kota_ttd: profile.city ?? "",
    konsentrasi_keahlian_list: "",
    sumber_dana: "DAK Fisik Bidang SMK Tahun Anggaran {{tahun_anggaran}}",
    nama_ppk: extras.ppkName ?? "",
    nip_ppk: extras.ppkNip ?? "",
    nama_fasilitator: extras.fasilitatorName ?? "",
    nip_fasilitator: extras.fasilitatorNipNik ?? "",
    total_anggaran_rp: fmtRp(totalNum),
    total_anggaran_terbilang: "",
    tahap1_70_rp: fmtRp(tahap1),
    tahap2_30_rp: fmtRp(tahap2),
    konsentrasi_keahlian_rpd_uraian: konsentrasiNamesPlain
      ? `Kegiatan Pengadaan Sarana dan Peralatan Konsentrasi Keahlian ${konsentrasiNamesPlain}`
      : "",
    hari_tanggal_terbilang: "",
    kontak_kepala_sekolah: "",
    nomor_rpd: "",
    nomor_pks: "",
    nomor_sk_tim: "",
    nomor_bast: "",
    nomor_bapb: "",
    ketua_tim_sarpras_nama: "",
    sekretaris_tim_nama: "",
    bendahara_tim_nama: "",
    anggota_teknis_tim_nama: "",
    masa_berlaku_mulai: "",
    masa_berlaku_selesai: "",
    mitra_nama: "",
    mitra_alamat: "",
    mitra_kota: "",
    mitra_npwp: "",
    mitra_direktur_nama: "",
    mitra_direktur_nik: "",
    ruang_lingkup:
      "Pengadaan alat praktik untuk program keahlian, Bimbingan Teknis (Bimtek) guru, dan Praktik Kerja Lapangan (PKL) siswa.",
  };
}

@Controller("onlyoffice")
export class OnlyOfficeController {
  private readonly svc: OnlyOfficeService;
  private static _sharedSvc: OnlyOfficeService | null = null;

  constructor() {
    if (!OnlyOfficeController._sharedSvc) {
      OnlyOfficeController._sharedSvc = new OnlyOfficeService();
    }
    this.svc = OnlyOfficeController._sharedSvc;
  }

  @Get("docserver-api-js-url")
  getApiJsUrl(): { url: string } {
    return { url: this.svc.getDocserverApiJsUrl() };
  }

  @Get("fetch/:storageKey")
  async fetchDoc(
    @Param("storageKey") storageKey: string,
    @Res() res: Response,
  ) {
    const safeKey = path.basename(decodeURIComponent(storageKey));
    let buf = this.svc.readStorage(safeKey);
    if (!buf) {
      this.svc.ensureBlankDocxIfAbsent(safeKey);
      buf = this.svc.readStorage(safeKey);
    }
    if (!buf) {
      res.status(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeKey)}"`,
    );
    res.send(buf);
  }

  @Post("callback/:storageKey")
  async callbackTrack(
    @Param("storageKey") storageKey: string,
    @Body() body: OnlyOfficeTrackBody,
    @Res() res: Response,
  ) {
    const safeKey = path.basename(decodeURIComponent(storageKey));
    const status = Number(body.status ?? 0);
    try {
      if (status === 2 || status === 3) {
        if (!body.url) throw new BadRequestException("Missing url");
        const dest = this.svc.storagePathForKey(safeKey);
        await this.svc.downloadFromOnlyOffice(body.url, dest);
      }
      res.json({ error: 0 });
    } catch (err) {
      console.error("[ONLYOFFICE callback] err", err);
      res.status(500).json({ error: 1, message: (err as any)?.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("prepare-editor")
  async prepareEditor(@Query() q: PrepareEditorQuery) {
    if (!q.npsn || !q.kind) throw new BadRequestException("npsn + kind required");
    try {
      const storageKey = this.svc.buildStorageKey(q.npsn, q.kind, "docx");
      const tplPath = this.svc.templatePathFor(q.kind, "docx");
      let wasCreated = this.svc.copyTemplateToInstanceIfAbsent(storageKey, tplPath);
      if (!wasCreated) wasCreated = this.svc.ensureBlankDocxIfAbsent(storageKey);
      if (!fs.existsSync(this.svc.storagePathForKey(storageKey))) {
        throw new Error(
          `Gagal membuat file DOCX default (adm-zip error / storage write access). MonorepoRoot=${this.svc.monorepoRoot} workdir=${this.svc.storagePathForKey(storageKey)}`,
        );
      }
      if (wasCreated && String(q.applyPlaceholders ?? "1") === "1") {
        try {
          const placeholders = await this.buildPlaceholdersFor(q.npsn, q.kind);
          this.svc.replacePlaceholderInStorage(storageKey, placeholders);
        } catch (err) {
          console.warn("[onlyoffice prepare-editor] replace placeholders warn:", err);
        }
      }
      const userId = q.userId ?? "user";
      const userName = q.userName ?? "User";
      const editable = String(q.editable ?? "1") === "1";
      const title = `${q.kind}_${q.npsn}.docx`;
      const cfg = this.svc.buildEditorConfig({
        storageKey,
        title,
        userId,
        userName,
        editable,
      });
      return {
        storageKey,
        docserverApiJsUrl: this.svc.getDocserverApiJsUrl(),
        config: cfg,
        debug: {
          monorepoRoot: this.svc.monorepoRoot,
          storagePath: this.svc.storagePathForKey(storageKey),
          templatePath: tplPath,
          fileExists: fs.existsSync(this.svc.storagePathForKey(storageKey)),
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[onlyoffice prepare-editor] error:", err);
      throw new BadRequestException(
        `ONLYOFFICE backend error (prepare-editor): ${msg}. Pastikan adm-zip terinstall dan storage bisa ditulis.`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("docx-to-html")
  async docxToHtml(@Query("storageKey") storageKey?: string) {
    if (!storageKey) throw new BadRequestException("storageKey required");
    const safeKey = path.basename(decodeURIComponent(storageKey));
    const html = await this.svc.convertStorageToHtml(safeKey);
    return { storageKey: safeKey, html };
  }

  @UseGuards(JwtAuthGuard)
  @Post("reapply-placeholders")
  async reapplyPlaceholders(@Body() body: { npsn: string; kind: string }) {
    if (!body.npsn || !body.kind) throw new BadRequestException("npsn + kind required");
    const storageKey = this.svc.buildStorageKey(body.npsn, body.kind, "docx");
    this.svc.ensureBlankDocxIfAbsent(storageKey);
    const placeholders = await this.buildPlaceholdersFor(body.npsn, body.kind);
    const replaced = this.svc.replacePlaceholderInStorage(storageKey, placeholders);
    return { storageKey, replaced, keys: Object.keys(placeholders).length };
  }

  private async buildPlaceholdersFor(
    npsn: string,
    kind: string,
  ): Promise<Record<string, string>> {
    const prof: SchoolProfileLite = {
      schoolName: `Sekolah ${npsn}`,
      npsn: npsn ?? "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      principalName: "",
      principalNip: "",
    };
    try {
      const { DatabaseService } = await import(
        "../database/database.service.js"
      );
      const svc: any = DatabaseService;
      if (svc && typeof (svc as any).query === "function") {
        try {
          const rows: any[] = await (svc as any).query(
            `SELECT school_name as schoolName, npsn, alamat as address, kab_kota as city, provinsi as province, kode_pos as postalCode, kepala_sekolah_nama as principalName, kepala_sekolah_nip as principalNip FROM school_profiles WHERE npsn = ? LIMIT 1`,
            [npsn],
          );
          if (rows && rows.length > 0) {
            const r: any = rows[0] ?? {};
            prof.schoolName = r.schoolName ?? r.school_name ?? prof.schoolName;
            prof.npsn = r.npsn ?? prof.npsn;
            prof.address = r.address ?? r.alamat ?? prof.address;
            prof.city = r.city ?? r.kab_kota ?? prof.city;
            prof.province = r.province ?? r.provinsi ?? prof.province;
            prof.postalCode = r.postalCode ?? r.kode_pos ?? prof.postalCode;
            prof.principalName =
              r.principalName ?? r.kepala_sekolah_nama ?? prof.principalName;
            prof.principalNip =
              r.principalNip ?? r.kepala_sekolah_nip ?? prof.principalNip;
          }
        } catch (err) {
          console.warn(
            "[onlyoffice] buildPlaceholdersFor db query fallback:",
            err,
          );
        }
      }
    } catch (err) {
      console.warn(
        "[onlyoffice] buildPlaceholdersFor import DatabaseService fallback:",
        err,
      );
    }
    const ctx: PlaceholderCtxLite = {
      totalAnggaranRpNumber: null,
      ppkName: null,
      ppkNip: null,
      fasilitatorName: null,
      fasilitatorNipNik: null,
    };
    const map = buildPlaceholderMapFromProfileLocal(prof, ctx);
    const out: Record<string, string> = {};
    for (const k of Object.keys(map)) {
      const v = (map as any)[k];
      if (v != null && String(v).trim() !== "") out[k] = String(v);
    }
    void kind;
    return out;
  }
}
