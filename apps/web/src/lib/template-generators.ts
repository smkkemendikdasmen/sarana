import type { RpdPksPlaceholderKey } from "./rpd-pks-default-templates";
import {
  DEFAULT_IDENTITAS_TEMPLATE_HTML,
  DEFAULT_ADMINISTRASI_TEMPLATE_HTML,
  DEFAULT_SURVEY_HARGA_TEMPLATE_HTML,
  DEFAULT_RPKP_TEMPLATE_HTML,
  DEFAULT_RAB_TEMPLATE_HTML,
  DEFAULT_RPD_TEMPLATE_HTML,
  DEFAULT_PKS_TEMPLATE_HTML,
} from "./rpd-pks-default-templates";
import {
  schoolProfileRequest,
  schoolProfileByNpsnRequest,
  type SchoolProfileRecord,
  type SchoolProfileOrganizationMemberRecord,
} from "./api";
import { resolvePlaceholdersHtml } from "../components/shared/rich-text-editor";

export type TemplateTabNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const TEMPLATE_PUBLIC_PATHS: Record<TemplateTabNumber, { folder: string; filename: string }> = {
  1: { folder: "1_Identitas", filename: "1_Identitas.html" },
  2: { folder: "2_Dokumen", filename: "2_Dokumen.html" },
  3: { folder: "3_Surveyharga", filename: "3_Surveyharga.html" },
  4: { folder: "4_RPKP", filename: "4_RPKP.html" },
  5: { folder: "5_RAB", filename: "5_RAB.html" },
  6: { folder: "6_RPD", filename: "6_RPD.html" },
  7: { folder: "7_PKS", filename: "7_PKS.html" },
};

const DEFAULT_IN_MEMORY_TEMPLATES: Record<TemplateTabNumber, string> = {
  1: DEFAULT_IDENTITAS_TEMPLATE_HTML,
  2: DEFAULT_ADMINISTRASI_TEMPLATE_HTML,
  3: DEFAULT_SURVEY_HARGA_TEMPLATE_HTML,
  4: DEFAULT_RPKP_TEMPLATE_HTML,
  5: DEFAULT_RAB_TEMPLATE_HTML,
  6: DEFAULT_RPD_TEMPLATE_HTML,
  7: DEFAULT_PKS_TEMPLATE_HTML,
};

function assertClientSideOnly(fnHint: string): void {
  if (typeof window === "undefined") {
    throw new Error(
      `[template-generators.${fnHint}] Client-only API dipanggil di SERVER (SSR). Fungsi ini membutuhkan window.* / DOMParser / fetch browser. Gunakan useEffect / onClick client-side atau wrap komponen dengan "use client".`,
    );
  }
}

const CSS_FILENAME_BY_TAB: Record<TemplateTabNumber, string> = {
  1: "1_Identitas.css",
  2: "2_Dokumen.css",
  3: "3_Surveyharga.css",
  4: "4_RPKP.css",
  5: "5_RAB.css",
  6: "6_RPD.css",
  7: "7_PKS.css",
};

function extractPageBodyFromFullHtml(fullHtml: string): string {
  if (!fullHtml) return "";
  assertClientSideOnly("extractPageBodyFromFullHtml");
  const doc = new DOMParser().parseFromString(fullHtml, "text/html");
  const page = doc.querySelector(".page");
  if (page) return page.innerHTML;
  const body = doc.querySelector("body");
  if (body) return body.innerHTML;
  return fullHtml;
}

async function fetchInlineStylesSameFolder(tab: TemplateTabNumber): Promise<string> {
  assertClientSideOnly("fetchInlineStylesSameFolder");
  const meta = TEMPLATE_PUBLIC_PATHS[tab];
  const cssUrl = `${window.location.origin}/templates/${meta.folder}/${CSS_FILENAME_BY_TAB[tab]}`;
  try {
    const resp = await fetch(cssUrl, { cache: "no-store" });
    if (!resp.ok) return "";
    const txt = (await resp.text()).trim();
    if (!txt) return "";
    return `<style data-template-css="tab-${tab}">${txt}</style>\n`;
  } catch {
    return "";
  }
}

function stripStylesheetLinks(html: string): string {
  if (!html) return html;
  return html
    .replace(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*\brel\s*=\s*stylesheet[^>]*>/gi, "")
    .trim();
}

export async function loadPublicTemplateHtml(
  tab: TemplateTabNumber,
  opts: { includeWrapperPage?: boolean } = {},
): Promise<string> {
  assertClientSideOnly("loadPublicTemplateHtml");
  const { includeWrapperPage = false } = opts;
  const meta = TEMPLATE_PUBLIC_PATHS[tab];
  const publicUrl = `${window.location.origin}/templates/${meta.folder}/${meta.filename}`;
  try {
    const response = await fetch(publicUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const full = await response.text();
    let result: string;
    if (includeWrapperPage) {
      result = full;
    } else {
      result = extractPageBodyFromFullHtml(full);
    }
    if (!result.trim()) {
      throw new Error("Empty body extracted");
    }
    const inlineCss = await fetchInlineStylesSameFolder(tab);
    result = stripStylesheetLinks(result);
    return inlineCss + result;
  } catch (err) {
    console.warn(
      `[template-generators] loadPublicTemplateHtml(${tab}) gagal (${(err as Error).message}), fallback ke in-memory DEFAULT.`,
    );
    const fallback = DEFAULT_IN_MEMORY_TEMPLATES[tab] ?? "";
    if (includeWrapperPage) {
      const inlineCss = await fetchInlineStylesSameFolder(tab).catch(() => "");
      return stripStylesheetLinks(inlineCss + fallback);
    }
    return fallback;
  }
}

function getOrgMemberByRole(
  members: SchoolProfileOrganizationMemberRecord[] | undefined | null,
  roleKeyword: string,
): SchoolProfileOrganizationMemberRecord | null {
  if (!Array.isArray(members) || members.length === 0) return null;
  const keyword = roleKeyword.toLowerCase();
  const exact = members.find((m) => String(m.roleName ?? "").toLowerCase() === keyword);
  if (exact) return exact;
  return (
    members.find((m) => {
      const r = String(m.roleName ?? "").toLowerCase();
      return r.includes(keyword);
    }) ?? null
  );
}

export async function fetchSchoolPlaceholderMap(params: {
  useMe?: boolean;
  npsn?: string;
  token: string;
  extras?: {
    nama_fasilitator_adm?: string | null;
    nip_fasilitator_adm?: string | null;
    nama_fasilitator_alat?: string | null;
    nip_fasilitator_alat?: string | null;
    nama_ppk?: string | null;
    nip_ppk?: string | null;
    totalAnggaranRpNumber?: number | null;
  };
}): Promise<Partial<Record<RpdPksPlaceholderKey, string>>> {
  const { useMe = false, npsn, token, extras = {} } = params;
  let profile: SchoolProfileRecord;
  if (useMe) {
    profile = await schoolProfileRequest(token);
  } else if (npsn && npsn.trim()) {
    profile = await schoolProfileByNpsnRequest(token, npsn.trim());
  } else {
    throw new Error(
      "fetchSchoolPlaceholderMap: salah satu parameter useMe:true atau npsn='XXXX' harus diberikan.",
    );
  }

  const today = new Date();
  const tanggalSekarang = today.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const tahunAnggaran = String(today.getFullYear());
  const konsentrasiHtmlListRaw =
    Array.isArray(profile.concentrations) && profile.concentrations.length > 0
      ? profile.concentrations
          .map((c) => `<li>${String(c.name ?? c.code ?? "").trim()}</li>`)
          .filter((v) => v !== "<li></li>")
          .join("\n")
      : "";
  const konsentrasiPlainUraian =
    Array.isArray(profile.concentrations) && profile.concentrations.length > 0
      ? profile.concentrations
          .map((c) => String(c.name ?? c.code ?? "").trim())
          .filter((v) => v.length > 0)
          .join(", ")
      : "";

  const fasilitatorAdmOrg =
    getOrgMemberByRole(profile.organizationMembers, "Fasilitator Administrasi") ??
    getOrgMemberByRole(profile.organizationMembers, "Fasilitator Adm");
  const fasilitatorAlatOrg =
    getOrgMemberByRole(profile.organizationMembers, "Fasilitator Peralatan") ??
    getOrgMemberByRole(profile.organizationMembers, "Fasilitator Alat");
  const ppkOrg = getOrgMemberByRole(profile.organizationMembers, "PPK") ??
    getOrgMemberByRole(profile.organizationMembers, "Pejabat Pembuat Komitmen");

  const fasilitatorAdmNama =
    extras.nama_fasilitator_adm ?? fasilitatorAdmOrg?.memberName ?? "";
  const fasilitatorAdmNip =
    extras.nip_fasilitator_adm ?? fasilitatorAdmOrg?.contactPhone ?? "";
  const fasilitatorAlatNama =
    extras.nama_fasilitator_alat ?? fasilitatorAlatOrg?.memberName ?? "";
  const fasilitatorAlatNip =
    extras.nip_fasilitator_alat ?? fasilitatorAlatOrg?.contactPhone ?? "";
  const ppkNama = extras.nama_ppk ?? ppkOrg?.memberName ?? "";
  const ppkNip = extras.nip_ppk ?? ppkOrg?.contactPhone ?? "";

  const totalNum = extras.totalAnggaranRpNumber ?? 0;
  const fmtRp = (n: number) =>
    n <= 0 ? "" : "Rp" + Math.round(n).toLocaleString("id-ID");
  const tahap1 = totalNum ? Math.round(totalNum * 0.7) : 0;
  const tahap2 = totalNum ? Math.round(totalNum * 0.3) : 0;

  return {
    nama_sekolah: profile.schoolName ?? "",
    npsn: profile.npsn ?? "",
    alamat_jalan: profile.address ?? "",
    alamat_sekolah: profile.address ?? "",
    kecamatan: profile.district ?? "",
    kab_kota: profile.city ?? "",
    kab_kota_sekolah: profile.city ?? "",
    provinsi: profile.province ?? "",
    provinsi_sekolah: profile.province ?? "",
    kode_pos: profile.postalCode ?? "",
    kode_pos_sekolah: profile.postalCode ?? "",
    kepala_sekolah_nama: profile.principalName ?? "",
    kepala_sekolah_nip: profile.principalNip ?? "",
    kepala_sekolah_hp: profile.principalPhone ?? "",
    kontak_kepala_sekolah: profile.principalPhone ?? "",
    wakasek_sarana_nama: profile.vicePrincipalFacilitiesName ?? "",
    wakasek_sarana_hp: profile.vicePrincipalFacilitiesPhone ?? "",
    tahun_anggaran: tahunAnggaran,
    tahun_ajaran: `${tahunAnggaran}/${Number(tahunAnggaran) + 1}`,
    tanggal_sekarang: tanggalSekarang,
    tempat_tanggal_buat: profile.city ?? "",
    kota_pembuatan_surat: profile.city ?? "",
    kab_kota_ttd: profile.city ?? "",
    konsentrasi_keahlian_list: konsentrasiHtmlListRaw,
    konsentrasi_keahlian_uraian: konsentrasiPlainUraian,
    konsentrasi_keahlian_rpd_uraian: konsentrasiPlainUraian
      ? `Kegiatan Pengadaan Sarana dan Peralatan Konsentrasi Keahlian ${konsentrasiPlainUraian}`
      : "",
    nama_fasilitator: fasilitatorAdmNama,
    nip_fasilitator: fasilitatorAdmNip,
    nama_fasilitator_adm: fasilitatorAdmNama,
    nip_fasilitator_adm: fasilitatorAdmNip,
    nama_fasilitator_alat: fasilitatorAlatNama,
    nip_fasilitator_alat: fasilitatorAlatNip,
    nama_ppk: ppkNama,
    nip_ppk: ppkNip,
    total_anggaran_rp: fmtRp(totalNum),
    tahap1_70_rp: fmtRp(tahap1),
    tahap2_30_rp: fmtRp(tahap2),
    sumber_dana: `DAK Fisik Bidang SMK Tahun Anggaran ${tahunAnggaran}`,
    ruang_lingkup:
      "Pengadaan alat praktik untuk program keahlian, Bimbingan Teknis (Bimtek) guru, dan Praktik Kerja Lapangan (PKL) siswa.",
  };
}

export interface GenerateTemplateNo1Result {
  htmlInjected: string;
  placeholders: Partial<Record<RpdPksPlaceholderKey, string>>;
  templateSource: "public" | "in-memory-fallback";
  tab: TemplateTabNumber;
}

export async function generateTemplateNo1Html(params: {
  useMe?: boolean;
  npsn?: string;
  token: string;
  fallbackTemplateHtml?: string;
  extras?: Parameters<typeof fetchSchoolPlaceholderMap>[0]["extras"];
}): Promise<GenerateTemplateNo1Result> {
  const tab: TemplateTabNumber = 1;
  let templateHtml = "";
  let templateSource: GenerateTemplateNo1Result["templateSource"] = "public";
  try {
    templateHtml = await loadPublicTemplateHtml(tab);
  } catch {
    templateHtml = "";
  }
  if (!templateHtml.trim()) {
    templateHtml = params.fallbackTemplateHtml ?? DEFAULT_IN_MEMORY_TEMPLATES[tab];
    templateSource = "in-memory-fallback";
  }

  const placeholders = await fetchSchoolPlaceholderMap({
    useMe: params.useMe,
    npsn: params.npsn,
    token: params.token,
    extras: params.extras,
  });
  const htmlInjected = resolvePlaceholdersHtml(templateHtml, placeholders);
  return {
    htmlInjected,
    placeholders,
    templateSource,
    tab,
  };
}
