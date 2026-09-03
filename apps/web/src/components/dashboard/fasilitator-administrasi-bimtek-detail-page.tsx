"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ClipboardCheck,
  Download,
  Eye,
  FileBarChart,
  FileCheck2,
  FileDown,
  FileText,
  HandCoins,
  Printer,
  RefreshCw,
  ScrollText,
  DollarSign,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ADMINISTRATIVE_DOCUMENT_LABELS,
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
  DOCUMENT_FORMAT_DOWNLOADS,
  schoolAdministrativeDocumentsByNpsnRequest,
  schoolProfileByNpsnRequest,
  type PerdirjenEquipmentSummary,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileRecord,
  type WorkspaceAdminSelectionData,
  type WorkspaceSchoolEquipmentData,
  type WorkspaceSchoolProposalData,
} from "@/lib/api";
import {
  fetchCachedDetailPraBimtekByNpsn,
  fetchCachedPerdirjenBidangBatch,
  invalidateDetailPraBimtekCache,
} from "@/lib/school-verifikasi-cache";
import { DetailTabLazyWrap } from "@/components/dashboard/fasilitator-detail-tabs-lazy";
import { SchoolRpdPksDocumentEditor } from "@/components/school/school-rpd-pks-document-editor";
import { SchoolDetailViewProvider } from "@/components/school/school-detail-view-context";
import { SchoolProfileManager } from "@/components/school/school-profile-manager";
import { SchoolProposalPage } from "@/components/school/school-proposal-page";
import { useAuthStore } from "@/store/auth-store";
import { cn, compareConcentrationCode, concentrationNameOf, formatDateTime, formatFileSize, formatRupiah, isImage, isPdf } from "@/lib/utils";

function resolveAdministrativeDocLabel(code: string) {
  return ADMINISTRATIVE_DOCUMENT_LABELS[code] ?? code;
}

type MainTabKey =
  | "identitas"
  | "administrasi"
  | "survey-harga"
  | "rpkp"
  | "rab"
  | "rpd"
  | "pks";

const MAIN_TAB_META: readonly {
  key: MainTabKey;
  no: string;
  label: string;
  sub: string;
  icon: (className?: string) => React.ReactNode;
}[] = [
  {
    key: "identitas",
    no: "1",
    label: "Identitas Sekolah",
    sub: "Profil, konsentrasi, kepala sekolah",
    icon: (c) => <Building2 className={cn("h-4 w-4", c)} />,
  },
  {
    key: "administrasi",
    no: "2",
    label: "Berkas Administrasi",
    sub: "Ceklis dokumen upload sekolah",
    icon: (c) => <ClipboardCheck className={cn("h-4 w-4", c)} />,
  },
  {
    key: "survey-harga",
    no: "3",
    label: "Survey Harga Pasar",
    sub: "Perbandingan harga toko peralatan",
    icon: (c) => <DollarSign className={cn("h-4 w-4", c)} />,
  },
  {
    key: "rpkp",
    no: "4",
    label: "RPKP",
    sub: "Rencana Pengadaan Kerja Praktek",
    icon: (c) => <FileBarChart className={cn("h-4 w-4", c)} />,
  },
  {
    key: "rab",
    no: "5",
    label: "RAB",
    sub: "Rencana Anggaran Biaya",
    icon: (c) => <HandCoins className={cn("h-4 w-4", c)} />,
  },
  {
    key: "rpd",
    no: "6",
    label: "RPD",
    sub: "Rencana Penggunaan Dana (Google Docs)",
    icon: (c) => <ScrollText className={cn("h-4 w-4", c)} />,
  },
  {
    key: "pks",
    no: "7",
    label: "PKS",
    sub: "Perjanjian Kerja Sama (Google Docs)",
    icon: (c) => <ShieldCheck className={cn("h-4 w-4", c)} />,
  },
];

type TabPrintId =
  | "print-identitas"
  | "print-administrasi"
  | "print-survey"
  | "print-rpkp"
  | "print-rab"
  | "print-rpd"
  | "print-pks";

interface DocPreviewItem {
  url: string;
  name: string;
  mimeType: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="min-h-[24px]">{children}</div>
    </div>
  );
}
function ReadOnlyValue({ value, mono }: { value?: string | number | null; mono?: boolean }) {
  const v = value ?? "—";
  return (
    <p className={cn("text-sm leading-6 text-slate-900", mono && "font-mono tracking-tight text-slate-800")}>{String(v)}</p>
  );
}
function StatTile({
  eyebrow,
  value,
  sub,
  accent,
}: {
  eyebrow: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "slate" | "emerald" | "sky" | "primary" | "rose" | "amber";
}) {
  const palette = {
    slate: "border-slate-200 bg-slate-50/80 text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    primary: "border-primary/20 bg-primary/[0.06] text-primary",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  } as const;
  return (
    <div className={cn("rounded-[20px] border p-4 md:p-5", palette[accent ?? "slate"])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 opacity-90">{eyebrow}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 md:text-2xl">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function AdminDocBadge({ status, required }: { status: "UPLOADED" | "EMPTY"; required?: boolean }) {
  if (status === "UPLOADED") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
        <BadgeCheck className="-ml-0.5 mr-1 h-3 w-3" />
        Sudah Diupload
      </Badge>
    );
  }
  return (
    <Badge className={cn(required ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800")} variant="outline">
      {required ? "Belum Diupload (Wajib)" : "Belum Diupload"}
    </Badge>
  );
}

// ============== HEADER SUMMARY ==============
function PageHeaderSummary({
  profile,
  documents,
  proposalBundle,
  precomputedTotals,
}: {
  profile: SchoolProfileRecord;
  documents: SchoolAdministrativeDocumentRecord[];
  proposalBundle: WorkspaceSchoolProposalData | null;
  precomputedTotals?: { rpkpGrand: number; rabGrand: number };
}) {
  const uploaded = documents.filter((d) => d.uploaded).length;
  const total = documents.length || ADMINISTRATIVE_DOCUMENT_UMUM_CODES.length;
  const progressPct = total ? Math.round((uploaded / total) * 100) : 0;

  const { rpkpGrand, rabGrand } = useMemo(() => {
    if (precomputedTotals) {
      return {
        rpkpGrand: precomputedTotals.rpkpGrand,
        rabGrand: precomputedTotals.rabGrand,
      };
    }
    let rpkp = 0;
    let rab = 0;
    const tables = (proposalBundle as WorkspaceSchoolProposalData | null)?.proposalTables ?? {};
    for (const [k, tbl] of Object.entries(tables)) {
      if (!Array.isArray(tbl)) continue;
      const key = String(k).toLowerCase();
      const isRpkp = key.includes("rpkp") || key.includes("pengajuan");
      const isRab = key.includes("rab") || key.includes("anggaran");
      for (const row of tbl as Array<Record<string, unknown>>) {
        for (const [kk, vv] of Object.entries(row)) {
          if (typeof vv !== "string") continue;
          const kkLow = kk.toLowerCase();
          if (!kkLow.includes("subtotal") && !kkLow.includes("total") && !kkLow.includes("jumlah") && !kkLow.includes("grand")) continue;
          const cleaned = vv.replace(/[^\d,.]/g, "");
          if (!cleaned) continue;
          const num = Number(cleaned.replaceAll(".", "").replace(",", "."));
          if (!Number.isFinite(num) || num <= 0) continue;
          if (isRpkp) rpkp += num;
          if (isRab || (!isRpkp && key.includes("ringkasan"))) rab += num;
        }
      }
    }
    const gKeys = ["__global_biaya_persiapan_pelaporan", "__global_biaya_pendukung_pelatihan"];
    for (const gKey of gKeys) {
      const gTbl = tables[gKey];
      if (!Array.isArray(gTbl)) continue;
      for (const gRow of gTbl as Array<Record<string, unknown>>) {
        for (const sk of ["shop1", "shop2", "shop3"]) {
          const shop = gRow[sk] as Record<string, unknown> | undefined | null;
          if (!shop || typeof shop !== "object") continue;
          const tp = typeof shop.totalPrice === "string" ? shop.totalPrice : "";
          const cleaned = tp.replace(/[^\d,.]/g, "");
          if (!cleaned) continue;
          const num = Number(cleaned.replaceAll(".", "").replace(",", "."));
          if (Number.isFinite(num) && num > 0) rab += num;
        }
      }
    }
    return { rpkpGrand: rpkp, rabGrand: rab };
  }, [proposalBundle, precomputedTotals]);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatTile
        eyebrow="NPSN"
        value={<span className="font-mono tracking-tight">{profile.npsn || "—"}</span>}
        sub={profile.schoolName || "Identitas Sekolah"}
        accent="slate"
      />
      <StatTile
        eyebrow="Progress Dok. Administrasi"
        value={`${uploaded}/${total} berkas`}
        sub={`${progressPct}% kelengkapan`}
        accent={progressPct >= 80 ? "emerald" : progressPct >= 40 ? "primary" : progressPct > 0 ? "amber" : "rose"}
      />
      <StatTile
        eyebrow="Total RPKP (Pengadaan)"
        value={formatRupiah(rpkpGrand || 0, { full: true })}
        sub={rpkpGrand ? "Siap cetak Tab ③ RPKP" : "Belum ada data pengajuan RPKP"}
        accent="primary"
      />
      <StatTile
        eyebrow="Total RAB (Anggaran)"
        value={formatRupiah(rabGrand || 0, { full: true })}
        sub={rabGrand ? "Siap cetak Tab ④ RAB" : "Belum ada ringkasan anggaran"}
        accent={rabGrand ? "emerald" : "slate"}
      />
    </div>
  );
}

// ============== SCHOOL IDENTITY (HEADER CARD) ==============
function SchoolIdentityHeader({ profile }: { profile: SchoolProfileRecord }) {
  const members = Array.isArray(profile.organizationMembers) ? profile.organizationMembers : [];
  let principalName = profile.principalName || members[0]?.memberName || "";
  const principalNip = profile.principalNip || "";
  const principalPhone = profile.principalPhone || members[0]?.contactPhone || "";
  let viceName = profile.vicePrincipalFacilitiesName || members[1]?.memberName || "";
  const vicePhone = profile.vicePrincipalFacilitiesPhone || members[1]?.contactPhone || "";
  if (principalName && profile.schoolName && principalName.trim() === profile.schoolName.trim()) principalName = "";
  if (viceName && profile.schoolName && viceName.trim() === profile.schoolName.trim()) viceName = "";

  return (
    <Card className="rounded-[28px] border-slate-200">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">Identitas Sekolah</p>
            <h2 className="mt-1.5 text-xl font-semibold text-slate-950 md:text-2xl">{profile.schoolName || "—"}</h2>
          </div>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700 font-mono" variant="outline">
            {profile.npsn || "NPSN —"}
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provinsi"><ReadOnlyValue value={profile.province} /></Field>
          <Field label="Kabupaten / Kota"><ReadOnlyValue value={profile.city} /></Field>
          <Field label="Kode Pos"><ReadOnlyValue value={profile.postalCode} /></Field>
          <Field label="Kecamatan"><ReadOnlyValue value={profile.district} /></Field>
        </div>
        <Field label="Alamat Jalan Lengkap"><ReadOnlyValue value={profile.address} /></Field>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-800">
              <Building2 className="h-3.5 w-3.5" /> Kepala Sekolah
            </p>
            <Field label="Nama"><ReadOnlyValue value={principalName} /></Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="NIP"><ReadOnlyValue value={principalNip} mono /></Field>
              <Field label="Nomor HP"><ReadOnlyValue value={principalPhone} /></Field>
            </div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-800">
              <Wrench className="h-3.5 w-3.5" /> Wakil Kepala Sekolah Sarana
            </p>
            <Field label="Nama"><ReadOnlyValue value={viceName} /></Field>
            <Field label="Nomor HP"><ReadOnlyValue value={vicePhone} /></Field>
          </div>
        </div>
        <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-3 py-1 text-xs font-semibold text-primary">
              <Users className="h-3.5 w-3.5" /> Konsentrasi Keahlian
            </p>
            <span className="text-xs text-slate-500">Total {profile.concentrations.length} program</span>
          </div>
          {profile.concentrations.length === 0 ? (
            <p className="text-sm italic text-slate-400">Belum ada data konsentrasi keahlian.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {profile.concentrations
                .slice()
                .sort((a, b) => compareConcentrationCode(a.code, b.code))
                .map((kk) => {
                  const totalRombel = (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
                  const totalSiswa = (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
                  return (
                    <div key={kk.code} className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                          {kk.code}
                        </Badge>
                        {kk.luasRuanganRps?.trim() ? (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Ruang: {kk.luasRuanganRps}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-slate-950">{concentrationNameOf(kk)}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-white bg-white px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Rombel</p>
                          <p className="mt-0.5 font-semibold text-slate-900">{totalRombel}</p>
                        </div>
                        <div className="rounded-xl border border-white bg-white px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Siswa</p>
                          <p className="mt-0.5 font-semibold text-slate-900">{totalSiswa.toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== ACTION BAR (di atas setiap TAB) ==============
function cloneElementToPrintPortal(printId: TabPrintId): void {
  const el = document.getElementById(printId);
  if (!el) return;
  const printContainer = document.getElementById("print-portal-root");
  if (!printContainer) return;
  // Safety: pastikan source element MEMILIKI konten cetak (bukan wrapper kosong blm fetch API)
  const contentText = (el.innerText || "").trim();
  if (contentText.length < 80) {
    // Src content KOSONG — tampilkan pesan ke user (print akan blank jika dipaksa)
    // Jangan throw error, tapi coba inject pesan ke portal agar user tahu kenapa blank
    const warn = document.createElement("div");
    warn.style.padding = "40px 36px";
    warn.style.fontFamily = "system-ui, sans-serif";
    warn.style.color = "#991b1b";
    warn.style.border = "2px dashed #ef4444";
    warn.style.borderRadius = "8px";
    warn.style.background = "#fef2f2";
    warn.innerHTML =
      "<h3 style=\"margin:0 0 12px 0;font-size:18px;\">⚠️ Data cetak BELUM SIAP dimuat.</h3>" +
      "<p style=\"margin:0 0 8px 0;font-size:14px;line-height:1.6;\">Penyebab: Template master dokumen untuk tab ini <b>belum selesai diambil dari server</b> atau session login kedaluwarsa.</p>" +
      "<ol style=\"margin:0 0 8px 20px;font-size:14px;line-height:1.8;\">" +
      "<li><b>Coba klik tombol PREVIEW terlebih dahulu</b> (tunggu modal preview tampil berisi data) — lalu klik <b>Print Sekarang</b> dari dalam modal.</li>" +
      "<li>Jika preview modal juga kosong: <b>Refresh halaman</b> atau <b>Logout → Login ulang</b> untuk memperbarui token session.</li>" +
      "<li>Pastikan koneksi internet stabil saat menunggu data dimuat dari server lokal.</li>" +
      "</ol>";
    printContainer.innerHTML = "";
    printContainer.appendChild(warn);
    return;
  }
  const clone = el.cloneNode(true) as HTMLElement;
  // Post-process cloned content — sembunyikan UI edit (print:hidden) dan tampilkan print-only
  clone.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((n) => { n.style.display = "none"; });
  clone.querySelectorAll<HTMLElement>(".hidden").forEach((n) => {
    const cls = Array.from(n.classList);
    if (cls.some((c) => c.startsWith("print:"))) {
      n.style.setProperty("display", "block", "important");
    }
  });
  printContainer.innerHTML = "";
  printContainer.appendChild(clone);
}

function clearPrintPortal(): void {
  const printContainer = document.getElementById("print-portal-root");
  if (printContainer) printContainer.innerHTML = "";
}

/**
 * SAFE PRINT TRIGGER — memastikan browser selesai repaint content di #print-portal-root
 * SEBELUM membuka dialog print native (mencegah hasil blank karena timing paint).
 */
function triggerSafePrint(afterPrintMs = 700, afterPrintCb?: () => void): void {
  if (typeof window === "undefined") return;
  // Modern Chrome/Edge/Safari: window.print() adalah async modal;
  // beri jeda + gunakan onafterprint fallback untuk cleanup
  let cleaned = false;
  const doClean = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("afterprint", doClean);
    window.setTimeout(() => { afterPrintCb?.(); }, 30);
  };
  window.addEventListener("afterprint", doClean, { once: true });
  // Fallback timeout jika afterprint tidak fire (beberapa browser headless / iframe)
  window.setTimeout(() => {
    window.print();
    window.setTimeout(doClean, afterPrintMs + 500);
  }, 60);
}

/**
 * Clone ke print portal DARI MODAL PREVIEW (lebih aman, karena user SUDAH lihat contentnya
 * di modal preview berarti data sudah load). Fallback ke source printId jika ref kosong.
 */
function cloneFromModalPreviewOrSource(previewEl: HTMLDivElement | null, fallbackPrintId: TabPrintId): void {
  const printContainer = document.getElementById("print-portal-root");
  if (!printContainer) return;
  // Priority 1: dari modal preview (yang user lihat sudah benar)
  if (previewEl && previewEl.children.length > 0 && (previewEl.innerText || "").trim().length > 80) {
    printContainer.innerHTML = "";
    const clone = previewEl.cloneNode(true) as HTMLElement;
    // Hapus style overlay modal (max width center shadow padding dari preview inject)
    clone.style.removeProperty("max-width");
    clone.style.removeProperty("margin");
    clone.style.removeProperty("background");
    clone.style.removeProperty("padding");
    clone.style.removeProperty("border-radius");
    clone.style.removeProperty("box-shadow");
    // Sembunyikan tombol/UI print:hidden
    clone.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((n) => { n.style.display = "none"; });
    printContainer.appendChild(clone);
    return;
  }
  // Priority 2: fallback clone dari source asli hidden / tab editor
  cloneElementToPrintPortal(fallbackPrintId);
}

function TabActionBar({
  title,
  description,
  printId,
  onPreview,
  onRefresh,
  refreshLabel,
}: {
  title: string;
  description: string;
  printId?: TabPrintId;
  onPreview?: (printId: TabPrintId) => void;
  onRefresh?: () => void;
  refreshLabel?: string;
}) {
  function handlePrint() {
    if (!printId) {
      triggerSafePrint(800);
      return;
    }
    cloneElementToPrintPortal(printId);
    triggerSafePrint(900, () => clearPrintPortal());
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <p className="text-lg font-semibold text-slate-950">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {refreshLabel || "Refresh Data"}
          </Button>
        ) : null}
        {onPreview && printId ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onPreview(printId)}
            className="border-primary/20 bg-primary/[0.05] text-primary hover:bg-primary/[0.1] hover:ring-2 hover:ring-primary/15"
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={handlePrint}
          disabled={!printId}
          className="bg-primary text-white hover:bg-primary/90 hover:ring-2 hover:ring-primary/25 shadow-sm shadow-primary/10"
        >
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>
    </div>
  );
}

// ============== TAB 1: BERKAS ADMINISTRASI (CHECKLIST ADM) ==============
type HasilPeriksa = "BELUM" | "SESUAI" | "TIDAK_SESUAI";

const CEKLIS_ADM_18_ITEMS: readonly { no: number; label: string }[] = [
  { no: 1, label: "SK Pengangkatan Kepala Sekolah, bagi SMK Swasta harus dilengkapi dengan Surat Keterangan Izin Memimpin dari Dinas Pendidikan (jika ada)" },
  { no: 2, label: "Scan Kartu Tanda Penduduk (KTP) Kepala Sekolah Asli" },
  { no: 3, label: "Akreditasi Minimal C" },
  { no: 4, label: "Nomor Pokok Wajib Pajak (NPWP) Sekolah bagi SMK Swasta. Bagi SMK Negeri NPWP Dinas Pendidikan Provinsi." },
  { no: 5, label: "Akta Pendirian Yayasan bagi SMK Swasta." },
  { no: 6, label: "Surat Pengesahan Yayasan oleh Kemenkum dan HAM bagi SMK Swasta." },
  { no: 7, label: "Surat Izin Operasional Sekolah / Surat Keterangan Sekolah masih aktif beroperasi dari Dinas Pendidikan yang berwenang" },
  { no: 8, label: "Surat rekomendasi dari Dinas Pendidikan/ Satuan Kerja Pemerintah Daerah yang membidangi urusan Pendidikan Menengah yang berwenang" },
  { no: 9, label: "Surat Pernyataan Daya Listrik + Bukti Pembayaran Listrik (Bukti bahwa sekolah memiliki kapasitas daya yang memadai untuk menunjang operasional peralatan praktik)" },
  { no: 10, label: "Foto Ruang Praktik (Dokumentasi visual kondisi ruang praktik yang ada saat ini foto dari 4 sisi.)" },
  { no: 11, label: "Surat pernyataan tidak memiliki tunggakan laporan bantuan pemerintah dari Direktorat SMK tahun anggaran sebelumnya" },
  { no: 12, label: "Dokumen kondisi sarana dan peralatan pembelajaran saat ini" },
  { no: 13, label: "Analisis kebutuhan sarana dan peralatan pendaftaran" },
  { no: 14, label: "Survey Harga Pasar" },
  { no: 15, label: "RAB Peralatan" },
  { no: 16, label: "RPKP" },
  { no: 17, label: "SK Tim Pengadaan, Pemeriksa, dan Penerima Peralatan" },
  { no: 18, label: "Surat Pernyataan" },
] as const;

function TabAdministrasiDokumen({
  documents,
  profile,
  onOpenPreview,
  onPreview,
}: {
  documents: SchoolAdministrativeDocumentRecord[];
  profile: SchoolProfileRecord;
  onOpenPreview: (doc: SchoolAdministrativeDocumentRecord, idx?: number) => void;
  onPreview?: (printId: TabPrintId) => void;
}) {
  const session = useAuthStore((s) => s.session);
  const [hasilPeriksa, setHasilPeriksa] = React.useState<Record<string, HasilPeriksa>>(() => {
    const init: Record<string, HasilPeriksa> = {};
    for (const d of documents) {
      if (!d.code) continue;
      if (d.reviewStatus === "DISETUJUI") init[d.code] = "SESUAI";
      else if (d.reviewStatus === "DITOLAK") init[d.code] = "TIDAK_SESUAI";
      else init[d.code] = "BELUM";
    }
    return init;
  });

  // Map DOCS database -> 18 ITEM referensi CEKLIS ADM 18 ITEMS
  // Strategy: priority 1. exact code match (ADM_SK_KEPSEK, ADM_KTP, etc) via resolveAdministrativeDocLabel label match. 2. fallback: urut index 0..17.
  const ceklisRows = React.useMemo(() => {
    const out = CEKLIS_ADM_18_ITEMS.map((refItem) => {
      const refLabelLower = refItem.label.toLowerCase();
      let bestMatch: SchoolAdministrativeDocumentRecord | null = null;
      let bestScore = 0;
      for (const d of documents) {
        if (!d.code) continue;
        const dLabel = resolveAdministrativeDocLabel(d.code);
        const dLabelLower = dLabel.toLowerCase();
        let score = 0;
        if (dLabelLower === refLabelLower) score = 1000;
        else if (dLabelLower.replace(/\s+/g, "").includes(refLabelLower.replace(/\s+/g, "").slice(0, 24))) score = 500;
        else if (refLabelLower.includes(dLabelLower.slice(0, 18))) score = 200;
        // Kata kunci match
        const keywordMap: Record<string, string[]> = {
          "1": ["kepala sekolah", "sk pengangkatan", "izin memimpin"],
          "2": ["ktp", "kepala sekolah", "scan"],
          "3": ["akreditasi", "minimal c"],
          "4": ["npwp", "swasta", "dinas pendidikan provinsi"],
          "5": ["akta pendirian", "yayasan"],
          "6": ["pengesahan", "kemenkum", "ham", "yayasan"],
          "7": ["izin operasional", "masih aktif beroperasi", "dinas pendidikan"],
          "8": ["rekomendasi", "dinas pendidikan", "satuan kerja"],
          "9": ["daya listrik", "bukti pembayaran listrik", "tagihan listrik"],
          "10": ["foto ruang", "ruang praktik", "4 sisi", "dokumentasi visual"],
          "11": ["pernyataan tidak memiliki tunggakan", "laporan bantuan pemerintah", "direktorat smk"],
          "12": ["kondisi sarana", "sarana dan peralatan", "saat ini"],
          "13": ["analisis kebutuhan", "kebutuhan sarana"],
          "14": ["survey harga", "harga pasar"],
          "15": ["rab", "rencana anggaran"],
          "16": ["rpkp", "pengadaan kerja praktek"],
          "17": ["tim pengadaan", "sk tim", "pemeriksa", "penerima peralatan"],
          "18": ["surat pernyataan"],
        };
        const kws = keywordMap[String(refItem.no)] ?? [];
        for (const kw of kws) if (dLabelLower.includes(kw)) score += 50;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = d;
        }
      }
      return { ref: refItem, doc: bestMatch, score: bestScore };
    });

    // Fallback: untuk dokumen yang tidak match keyword, sisa append di urutan 1-18 (berdasarkan no urut dokumen array)
    const usedKeys = new Set<string>(out.filter((x) => x.doc).map((x) => (x.doc as SchoolAdministrativeDocumentRecord).code!));
    let cursor = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i].doc) continue;
      while (cursor < documents.length && (documents[cursor].code && usedKeys.has(documents[cursor].code!))) cursor++;
      if (cursor < documents.length) {
        out[i] = { ...out[i], doc: documents[cursor], score: 1 };
        if (documents[cursor].code) usedKeys.add(documents[cursor].code!);
        cursor++;
      }
    }
    return out;
  }, [documents]);

  const rows: Array<{
    no: number;
    code: string;
    nama: string;
    uploaded: boolean;
    required?: boolean;
    keterangan: string;
    files: DocPreviewItem[];
    formatUrl?: string;
    doc: SchoolAdministrativeDocumentRecord;
  }> = documents.map((d, i) => {
    const nama = resolveAdministrativeDocLabel(d.code);
    const listFiles: DocPreviewItem[] =
      d.files && d.files.length > 0
        ? d.files.map((f) => ({
            url: f.filePath,
            name: f.fileName,
            mimeType: f.mimeType || d.mimeType || "",
          }))
        : d.filePath
          ? [{ url: d.filePath, name: d.fileName || d.name, mimeType: d.mimeType || "" }]
          : [];
    let keterangan = "";
    if (d.reviewNotes) keterangan = d.reviewNotes;
    if (!keterangan) {
      keterangan = d.uploaded
        ? `Diupload ${d.uploadedAt ? formatDateTime(new Date(d.uploadedAt)) : ""}`
        : "Belum di-upload oleh sekolah";
    }

    const formatArr = DOCUMENT_FORMAT_DOWNLOADS[d.code];
    const formatUrl =
      Array.isArray(formatArr) && formatArr[0]?.url ? formatArr[0].url : undefined;

    return {
      no: d.no || i + 1,
      code: d.code || `ADM_${i + 1}`,
      nama,
      uploaded: !!d.uploaded,
      required: d.required,
      keterangan,
      files: listFiles,
      formatUrl,
      doc: d,
    };
  });

  function setHasil(code: string, val: HasilPeriksa) {
    setHasilPeriksa((prev) => ({ ...prev, [code]: val }));
  }

  // Helpers DOCX print version (18 items CEKLIS_ADM_18_ITEMS)
  function hasilDocxOf(item: (typeof ceklisRows)[number]): "ADA" | "TIDAK" | "BELUM" {
    if (!item.doc) return "BELUM";
    const code = item.doc.code || "";
    const hasil = code ? hasilPeriksa[code] ?? "BELUM" : "BELUM";
    if (item.doc.uploaded && hasil === "SESUAI") return "ADA";
    if (!item.doc.uploaded) return "TIDAK";
    if (hasil === "TIDAK_SESUAI") return "TIDAK";
    return item.doc.uploaded ? "ADA" : "BELUM";
  }

  const principalName = profile.principalName || "[Nama Kepala Sekolah]";
  const principalNip = profile.principalNip || "";
  const principalPhone = profile.principalPhone || "[No HP Kepala Sekolah]";
  const konsentrasi = profile.concentrations.slice().sort((a, b) => compareConcentrationCode(a.code, b.code));
  const kkList = konsentrasi.map((c) => concentrationNameOf(c)).join(", ") || "[Konsentrasi Keahlian]";
  const bidangCodes = [...new Set(konsentrasi.map((c) => c.code.split(".")[0]).filter(Boolean))];
  const bidangList =
    bidangCodes
      .map((code) => {
        const known: Record<string, string> = {
          TK: "Teknologi dan Rekayasa",
          BK: "Bisnis dan Manajemen",
          PH: "Pariwisata",
          KP: "Kemaritiman",
          TKJ: "Teknologi Informasi dan Komunikasi",
          KUL: "Kuliner",
          KES: "Kesehatan",
        };
        return known[code] || `Bidang ${code}`;
      })
      .join(", ") || "[Bidang Keahlian]";

  const now = new Date();
  const monthId = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ][now.getMonth()];
  const tanggalCetak = `${profile.city ? profile.city + ", " : ""}${now.getDate()} ${monthId} ${now.getFullYear()}`;
  const fasilitatorNama = session?.user?.fullName || "[Nama Fasilitator Administrasi]";

  return (
    <div className="space-y-4">
      <TabActionBar
        title="Tab ① Berkas Administrasi"
        description="Ceklis dokumen administrasi yang di-upload oleh sekolah (format cetak 18 item sesuai DOCX referensi)"
        printId="print-administrasi"
        onPreview={onPreview}
      />

      <div id="print-administrasi" className="space-y-3 print-a4-portrait">
        {/* ===========================================
            VERSI SCREEN / HALAMAN UTAMA (INTERAKTIF)
            =========================================== */}
        <div className="print:hidden rounded-[24px] border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <div className="col-span-1">No</div>
            <div className="col-span-4">Dokumen</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Hasil Periksa</div>
            <div className="col-span-2">Keterangan</div>
            <div className="col-span-1 text-right">Link</div>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((r) => {
              const hasil = hasilPeriksa[r.code] ?? "BELUM";
              const hasilBg =
                hasil === "SESUAI"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-100 focus:ring-emerald-200"
                  : hasil === "TIDAK_SESUAI"
                    ? "bg-rose-50 text-rose-800 border-rose-200 ring-rose-100 focus:ring-rose-200"
                    : "bg-white text-slate-700 border-slate-200 ring-slate-100 focus:ring-slate-200";
              return (
                <div
                  key={r.code}
                  className={cn(
                    "grid grid-cols-12 gap-2 items-start px-4 py-4 text-sm",
                    r.uploaded ? "bg-white" : "bg-amber-50/30",
                  )}
                >
                  <div className="col-span-1 font-semibold text-slate-700 pt-1.5 tabular-nums">
                    {String(r.no).padStart(2, "0")}
                  </div>
                  <div className="col-span-4 space-y-1.5">
                    <p className="font-semibold text-slate-900 leading-snug">{r.nama}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{r.code}</p>
                  </div>
                  <div className="col-span-2 pt-1.5">
                    <AdminDocBadge status={r.uploaded ? "UPLOADED" : "EMPTY"} required={r.required} />
                  </div>
                  <div className="col-span-2 pt-0.5">
                    <select
                      value={hasil}
                      onChange={(e) => setHasil(r.code, e.target.value as HasilPeriksa)}
                      className={cn(
                        "h-9 w-full rounded-[10px] border px-2.5 text-xs font-semibold outline-none transition",
                        "ring-1 focus:ring-2",
                        hasilBg,
                      )}
                      disabled={!r.uploaded}
                      title={r.uploaded ? "Pilih hasil pemeriksaan dokumen" : "Tunggu upload sekolah"}
                    >
                      <option value="BELUM">— Belum Diperiksa —</option>
                      <option value="SESUAI">✓ Sesuai</option>
                      <option value="TIDAK_SESUAI">✗ Tidak Sesuai</option>
                    </select>
                    {hasil === "TIDAK_SESUAI" && (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-500">
                        Perlu Review Ulang
                      </p>
                    )}
                    {hasil === "SESUAI" && (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600">
                        OK
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 pt-1.5">
                    <p className="text-xs leading-6 text-slate-600 whitespace-pre-wrap">{r.keterangan}</p>
                  </div>
                  <div className="col-span-1 pt-1 flex flex-col items-end gap-1.5">
                    {r.uploaded && r.files.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {r.files.map((f, i) => (
                          <Button
                            key={i}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenPreview(r.doc, i)}
                            className="h-8 px-2 gap-1"
                            title={`Preview ${f.name}`}
                          >
                            {isImage(f.mimeType) ? (
                              <FileDown className="h-3.5 w-3.5 text-sky-600" />
                            ) : isPdf(f.mimeType) ? (
                              <FileText className="h-3.5 w-3.5 text-rose-600" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span className="text-[10px] font-bold tabular-nums text-slate-600">{i + 1}</span>
                          </Button>
                        ))}
                      </div>
                    ) : r.formatUrl ? (
                      <a
                        href={r.formatUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        title="Download format referensi"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                      </a>
                    ) : (
                      <span className="text-[11px] italic text-slate-400 pt-1.5">—</span>
                    )}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Belum ada dokumen administrasi untuk ditampilkan.
              </div>
            ) : null}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 print:hidden">
          Sekolah: <span className="font-semibold text-slate-600">{profile.schoolName}</span> · NPSN{" "}
          <span className="font-mono">{profile.npsn}</span> · Diperbarui: {formatDateTime(new Date())} · Cetak/Preview untuk melihat format persis sesuai DOCX Ceklis Adm 2026.
        </p>

        {/* ===========================================
            VERSI CETAK / PREVIEW (PERSIS DOCX REFERENSI)
            =========================================== */}
        <div className="hidden print:block page-break-before-always" style={{ pageBreakBefore: "auto" }}>
          {/* KOP JUDUL 2 BARIS BESAR */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center space-y-1">
            <p className="text-[16px] font-bold text-slate-950 leading-snug uppercase tracking-wide">
              KELENGKAPAN DOKUMEN ADMINISTRASI BANTUAN PEMERINTAH
            </p>
            <p className="text-[15px] font-bold text-slate-950 leading-snug uppercase tracking-wide">
              SARANA DAN PERALATAN PEMBELAJARAN SMK TAHUN 2026
            </p>
          </div>

          {/* TABLE IDENTITAS SEKOLAH 2 KOLOM (PERSIS DOCX: 4 row kiri + 4 row kanan) */}
          <table className="w-full border-separate border-spacing-y-1 mb-4 text-[12.5px]">
            <tbody>
              <tr>
                <td className="w-[28%] font-semibold text-slate-800 align-top py-1">Nama SMK</td>
                <td className="w-[2%] align-top py-1">:</td>
                <td className="w-[34%] font-semibold text-slate-950 align-top py-1">{profile.schoolName || "[Nama SMK]"}</td>
                <td className="w-[22%] font-semibold text-slate-800 align-top py-1 pl-4">Konsentrasi Keahlian</td>
                <td className="w-[1%] align-top py-1">:</td>
                <td className="w-[13%] text-slate-900 align-top py-1">{kkList}</td>
              </tr>
              <tr>
                <td className="font-semibold text-slate-800 align-top py-1">NPSN</td>
                <td className="align-top py-1">:</td>
                <td className="font-mono font-semibold text-slate-950 align-top py-1">{profile.npsn}</td>
                <td className="font-semibold text-slate-800 align-top py-1 pl-4">Bidang Keahlian</td>
                <td className="align-top py-1">:</td>
                <td className="text-slate-900 align-top py-1">{bidangList}</td>
              </tr>
              <tr>
                <td className="font-semibold text-slate-800 align-top py-1">Kab./Kota</td>
                <td className="align-top py-1">:</td>
                <td className="text-slate-900 align-top py-1">{profile.city || "[Kabupaten / Kota]"}</td>
                <td className="font-semibold text-slate-800 align-top py-1 pl-4">Provinsi</td>
                <td className="align-top py-1">:</td>
                <td className="text-slate-900 align-top py-1">{profile.province || "[Provinsi]"}</td>
              </tr>
              <tr>
                <td className="font-semibold text-slate-800 align-top py-1">Nama Kepala Sekolah</td>
                <td className="align-top py-1">:</td>
                <td className="text-slate-900 align-top py-1">{principalName}</td>
                <td className="font-semibold text-slate-800 align-top py-1 pl-4">No. HP Kepala Sekolah</td>
                <td className="align-top py-1">:</td>
                <td className="text-slate-900 align-top py-1">{principalPhone}</td>
              </tr>
            </tbody>
          </table>

          {/* TABEL UTAMA CEKLIS 4 KOLOM (PERSIS STRUKTUR DOCX: No | Dokumen | Hasil Pemeriksaan (Ada/Tidak) | Keterangan) */}
          <div className="mb-5">
            <p className="text-[12.5px] font-bold text-slate-950 mb-2 uppercase">DOKUMEN ADMINISTRASI</p>
            <table className="w-full border-collapse text-[11.5px] leading-snug">
              <thead>
                <tr className="bg-slate-100 border border-slate-900">
                  <th className="w-[4.5%] border border-slate-900 px-2 py-2 text-center font-bold text-slate-950">No</th>
                  <th className="w-[58%] border border-slate-900 px-2 py-2 text-left font-bold text-slate-950">Dokumen</th>
                  <th className="w-[13%] border border-slate-900 px-2 py-2 text-center font-bold text-slate-950" colSpan={2}>Hasil Pemeriksaan</th>
                  <th className="w-[24.5%] border border-slate-900 px-2 py-2 text-left font-bold text-slate-950">Keterangan</th>
                </tr>
                <tr className="bg-slate-50 border border-slate-900">
                  <th className="border border-slate-900" colSpan={2}></th>
                  <th className="w-[6.5%] border border-slate-900 px-1 py-1.5 text-center text-[11px] font-bold text-slate-900">Ada</th>
                  <th className="w-[6.5%] border border-slate-900 px-1 py-1.5 text-center text-[11px] font-bold text-slate-900">Tidak</th>
                  <th className="border border-slate-900"></th>
                </tr>
              </thead>
              <tbody>
                {ceklisRows.map((item) => {
                  const status = hasilDocxOf(item);
                  const uploaded = !!item.doc?.uploaded;
                  const docFiles = item.doc?.files && item.doc.files.length > 0
                    ? item.doc.files
                    : item.doc?.filePath
                      ? [{ filePath: item.doc.filePath, fileName: item.doc.fileName || item.doc.name, mimeType: item.doc.mimeType }]
                      : [];
                  const keterangan =
                    item.doc?.reviewNotes && item.doc.reviewNotes.trim()
                      ? item.doc.reviewNotes
                      : uploaded
                        ? `${docFiles.length} file · Diupload ${item.doc?.uploadedAt ? formatDateTime(new Date(item.doc.uploadedAt)) : ""}`
                        : "Belum di-upload sekolah";
                  return (
                    <tr key={String(item.ref.no)} className="border border-slate-900">
                      <td className="border border-slate-900 px-2 py-2 text-center text-slate-900 align-top tabular-nums">
                        {item.ref.no}
                      </td>
                      <td className="border border-slate-900 px-2 py-2 text-slate-900 align-top">{item.ref.label}</td>
                      <td className="border border-slate-900 px-1 py-2 text-center align-top text-[13px]">
                        {status === "ADA" ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-emerald-500 text-white font-bold">✓</span>
                        ) : (
                          <span className="text-slate-400">&nbsp;</span>
                        )}
                      </td>
                      <td className="border border-slate-900 px-1 py-2 text-center align-top text-[13px]">
                        {status === "TIDAK" || status === "BELUM" ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-rose-500 text-white font-bold">✗</span>
                        ) : (
                          <span className="text-slate-400">&nbsp;</span>
                        )}
                      </td>
                      <td className="border border-slate-900 px-2 py-2 text-slate-700 align-top">{keterangan}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CATATAN */}
          <p className="text-[12px] text-slate-800 italic mb-5 leading-relaxed">
            <span className="font-bold not-italic">Catatan:</span> Tanda <span className="font-bold text-emerald-700">✓ (Ada)</span> diberikan jika
            dokumen di-upload sekolah dan dinyatakan <i>Sesuai</i> oleh Fasilitator. Tanda{" "}
            <span className="font-bold text-rose-700">✗ (Tidak)</span> diberikan jika dokumen tidak di-upload atau dinyatakan <i>Tidak Sesuai</i>.
          </p>

          {/* TANGGAL + TTD 2 KOLOM (Kiri: KEPALA SEKOLAH, Kanan: FASILITATOR ADMINISTRASI) — PERSIS DOCX FOOTER */}
          <table className="w-full text-[12.5px] mt-3">
            <tbody>
              <tr>
                <td className="w-[12%]"></td>
                <td className="w-[38%] text-slate-900" colSpan={2}></td>
                <td className="w-[10%]"></td>
                <td className="w-[40%] text-slate-900" colSpan={2}></td>
              </tr>
              <tr>
                <td colSpan={3} className="text-center font-semibold text-slate-900 pb-10 pt-3" style={{ verticalAlign: "top" }}></td>
                <td colSpan={3} className="text-center text-slate-900 pb-2 pt-3" style={{ verticalAlign: "top" }}>
                  {tanggalCetak}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="text-center font-semibold text-slate-950 pb-1" style={{ verticalAlign: "top" }}>
                  Kepala
                </td>
                <td colSpan={3} className="text-center font-semibold text-slate-950 pb-1" style={{ verticalAlign: "top" }}>
                  Fasilitator,
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="text-center font-semibold text-slate-950 pb-[84px]" style={{ verticalAlign: "top" }}>
                  {profile.schoolName || "[Nama SMK]"}
                </td>
                <td colSpan={3} className="text-center font-semibold text-slate-900 pb-[84px]" style={{ verticalAlign: "top" }}></td>
              </tr>
              <tr>
                <td colSpan={3} className="text-center border-t border-slate-400 pt-2" style={{ verticalAlign: "top" }}>
                  <p className="text-[13px] font-bold text-slate-950 underline decoration-2">{principalName}</p>
                  <p className="text-[11.5px] text-slate-700 mt-0.5">
                    {principalNip ? `NIP. ${principalNip}` : "NIP. ................................."}
                  </p>
                </td>
                <td colSpan={3} className="text-center border-t border-slate-400 pt-2" style={{ verticalAlign: "top" }}>
                  <p className="text-[13px] font-bold text-slate-950 underline decoration-2">{fasilitatorNama}</p>
                  <p className="text-[11.5px] text-slate-600 mt-0.5">Fasilitator Administrasi Pra-Bimtek</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Akhir wrap print-only DOCX */}
      </div>
      {/* END id print-administrasi */}
    </div>
  );
}

// ============== TAB 2: SURVEY HARGA PASAR ==============
interface SurveyRowItem {
  no: number;
  kkCode: string;
  kkName: string;
  namaAlat: string;
  fungsi: string;
  qty: number;
  satuan: string;
  shops: Array<{ key: string; name: string; url?: string; price: number | null }>;
  avgPrice: number;
  subtotal: number;
}
function TabSurveyHargaPasar({
  profile,
  proposalBundle,
  onPreview,
}: {
  profile: SchoolProfileRecord;
  proposalBundle: WorkspaceSchoolProposalData | null;
  onPreview?: (printId: TabPrintId) => void;
}) {
  const rows = useMemo<SurveyRowItem[]>(() => {
    const out: SurveyRowItem[] = [];
    const tables = proposalBundle?.proposalTables ?? {};
    // Iterate konsentrasi dari profile, cari tabel survey yang cocok
    const konsentrasi = profile.concentrations
      .slice()
      .sort((a, b) => compareConcentrationCode(a.code, b.code));
    let globalNo = 0;
    for (const kk of konsentrasi) {
      const prefix = kk.code.replaceAll(".", "-");
      const tableKeys = Object.keys(tables).filter((k) => {
        const low = k.toLowerCase();
        return (
          low.includes(prefix.toLowerCase()) ||
          low.includes(kk.code.split(".")[0] || "")
        ) && (low.includes("survey") || low.includes("harga"));
      });
      if (tableKeys.length === 0) continue;
      for (const tk of tableKeys) {
        const tbl = tables[tk];
        if (!Array.isArray(tbl)) continue;
        for (const row of tbl as Array<Record<string, unknown>>) {
          const namaAlat =
            (typeof row.namaAlat === "string" ? row.namaAlat : "") ||
            (typeof row.alat === "string" ? row.alat : "") ||
            (typeof row.name === "string" ? row.name : "") ||
            "";
          if (!namaAlat.trim()) continue;
          globalNo += 1;
          const fungsi =
            (typeof row.fungsi === "string" ? row.fungsi : "") ||
            (typeof row.keterangan === "string" ? row.keterangan : "") ||
            concentrationNameOf(kk);
          const qtyRaw = row.qty ?? row.jumlah ?? row.quantity;
          const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw ?? 0) || 0;
          const satuan =
            (typeof row.satuan === "string" ? row.satuan : "") || "Unit";
          const shops: SurveyRowItem["shops"] = [];
          for (const sk of ["shop1", "shop2", "shop3", "shop4", "shop5"] as const) {
            const pRaw =
              (row as Record<string, unknown>)[`${sk}Price`] ??
              (row as Record<string, unknown>)[`${sk}Harga`] ??
              (row as Record<string, unknown>)[`${sk}Total`];
            const nRaw =
              (row as Record<string, unknown>)[`${sk}Name`] ??
              (row as Record<string, unknown>)[`${sk}Toko`] ??
              (row as Record<string, unknown>)[`${sk}Nama`];
            const uRaw =
              (row as Record<string, unknown>)[`${sk}Url`] ??
              (row as Record<string, unknown>)[`${sk}Link`];
            let price: number | null = null;
            if (typeof pRaw === "number") price = pRaw;
            else if (typeof pRaw === "string") {
              const c = pRaw.replace(/[^\d,.]/g, "");
              if (c) price = Number(c.replaceAll(".", "").replace(",", ".")) || 0;
            }
            if (price === 0) price = null;
            const name = typeof nRaw === "string" ? nRaw : sk;
            const url = typeof uRaw === "string" ? uRaw : undefined;
            shops.push({ key: sk, name: name || sk, url, price });
          }
          const prices = shops.map((s) => s.price).filter((p): p is number => p != null && p > 0);
          const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
          const subtotal = avgPrice * qty;
          out.push({
            no: globalNo,
            kkCode: kk.code,
            kkName: concentrationNameOf(kk),
            namaAlat,
            fungsi,
            qty,
            satuan,
            shops,
            avgPrice,
            subtotal,
          });
        }
      }
    }
    return out;
  }, [proposalBundle, profile.concentrations]);

  const grandTotal = rows.reduce((sum, r) => sum + r.subtotal, 0);
  const shopKeys = ["shop1", "shop2", "shop3"] as const;
  const shopColumns = shopKeys.map((k) => {
    const all = rows.flatMap((r) => r.shops.filter((s) => s.key === k).map((s) => s.name)).filter(Boolean);
    const topName = all[0] || `Toko ${k.replace("shop", "")}`;
    return { key: k, label: topName };
  });

  return (
    <div className="space-y-4">
      <TabActionBar
        title="Tab ② Survey Harga Pasar"
        description="Tabel perbandingan harga toko 1 / toko 2 / toko 3 — format cetak A4 landscape full width"
        printId="print-survey"
        onPreview={onPreview}
      />
      <div id="print-survey" className="space-y-2 print-a4-landscape">
        <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-700">
              SURVEY HARGA PASAR · {profile.schoolName || "—"} · NPSN {profile.npsn || "—"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-[11px] md:text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left w-12">No</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Konsentrasi</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Nama Alat</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Fungsi</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-16">Qty</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left w-20">Satuan</th>
                  {shopColumns.map((c) => (
                    <th key={c.key} className="border-b border-slate-200 px-3 py-2 text-right w-36">
                      {c.label} (Rp)
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-36 bg-primary/[0.06]">Rata-rata (Rp)</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-40 bg-primary/[0.08]">Subtotal (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada data Survey Harga Pasar yang diinput sekolah.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className={cn(i % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                      <td className="border-b border-slate-100 px-3 py-2 align-top font-semibold text-slate-700">
                        {r.no}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-600 whitespace-nowrap">
                        <span className="font-mono text-[10px]">{r.kkCode}</span> {r.kkName}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top font-semibold text-slate-900">
                        {r.namaAlat}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-600">{r.fungsi}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums">
                        {r.qty || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">{r.satuan}</td>
                      {shopKeys.map((sk) => {
                        const match = r.shops.find((s) => s.key === sk);
                        return (
                          <td key={sk} className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums text-slate-700">
                            {match?.price && match.price > 0 ? (
                              <div className="space-y-0.5">
                                <div>{formatRupiah(match.price, { symbol: false, full: false })}</div>
                                {match.url ? (
                                  <a
                                    href={match.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-[10px] text-primary underline hover:text-primary/80 break-all"
                                  >
                                    link
                                  </a>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums font-semibold text-slate-800 bg-primary/[0.04]">
                        {r.avgPrice > 0 ? formatRupiah(r.avgPrice, { symbol: false, full: false }) : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums font-bold text-slate-950 bg-primary/[0.07]">
                        {r.subtotal > 0 ? formatRupiah(r.subtotal, { symbol: false, full: false }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 ? (
                <tfoot className="bg-slate-900 text-white text-xs">
                  <tr>
                    <td colSpan={9} className="px-3 py-2 font-semibold text-right">
                      TOTAL SURVEY HARGA (Rata-rata × Qty)
                    </td>
                    <td className="px-4 py-2 font-bold text-right tabular-nums whitespace-nowrap">
                      {formatRupiah(grandTotal, { symbol: true, full: false })}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 print:hidden">
          Total {rows.length} item alat · Sekolah: <span className="font-semibold text-slate-600">{profile.schoolName}</span> · Dicetak: {formatDateTime(new Date())}
        </p>
      </div>
    </div>
  );
}

// ============== TAB 3: RPKP (8 kolom spec user) ==============
interface RpkpRowItem {
  no: number;
  namaAlat: string;
  fungsi: string;
  namaToko: string;
  linkToko: string;
  qty: number;
  hargaSatuan: number;
  hargaTotal: number;
}
function TabRPKP({
  profile,
  proposalBundle,
  onPreview,
}: {
  profile: SchoolProfileRecord;
  proposalBundle: WorkspaceSchoolProposalData | null;
  onPreview?: (printId: TabPrintId) => void;
}) {
  const rows = useMemo<RpkpRowItem[]>(() => {
    const out: RpkpRowItem[] = [];
    const tables = proposalBundle?.proposalTables ?? {};
    const konsentrasi = profile.concentrations
      .slice()
      .sort((a, b) => compareConcentrationCode(a.code, b.code));
    let globalNo = 0;
    for (const kk of konsentrasi) {
      const prefix = kk.code.replaceAll(".", "-");
      const tableKeys = Object.keys(tables).filter((k) => {
        const low = k.toLowerCase();
        const matchPrefix = low.includes(prefix.toLowerCase()) || low.includes(kk.code.split(".")[0] || "");
        return matchPrefix && (low.includes("rpkp") || low.includes("pengajuan") || low.includes("rencana")) && !low.includes("rab") && !low.includes("anggaran") && !low.includes("survey") && !low.includes("harga");
      });
      if (tableKeys.length === 0) continue;
      for (const tk of tableKeys) {
        const tbl = tables[tk];
        if (!Array.isArray(tbl)) continue;
        for (const row of tbl as Array<Record<string, unknown>>) {
          const namaAlat =
            (typeof row.namaAlat === "string" ? row.namaAlat : "") ||
            (typeof row.alat === "string" ? row.alat : "") ||
            (typeof row.name === "string" ? row.name : "") ||
            "";
          if (!namaAlat.trim()) continue;
          const rawSelected =
            (typeof (row as Record<string, unknown>).rpkpSelectedShop === "string"
              ? (row as Record<string, unknown>).rpkpSelectedShop
              : undefined) ??
            (typeof (row as Record<string, unknown>).rpkpShopKey === "string"
              ? (row as Record<string, unknown>).rpkpShopKey
              : undefined);
          const chosenKey: "shop1" | "shop2" | "shop3" | "" =
            rawSelected === "shop1" || rawSelected === "shop2" || rawSelected === "shop3"
              ? rawSelected
              : "";
          function shopField(suffix: string) {
            return chosenKey ? (row as Record<string, unknown>)[`${chosenKey}${suffix}`] : undefined;
          }
          const namaToko = chosenKey
            ? (typeof shopField("Name") === "string" ? shopField("Name") : "") ||
              (typeof shopField("Toko") === "string" ? shopField("Toko") : "") ||
              (typeof shopField("Nama") === "string" ? shopField("Nama") : "") ||
              chosenKey
            : "Belum Memilih";
          const linkToko = chosenKey
            ? (typeof shopField("Url") === "string" ? shopField("Url") : "") ||
              (typeof shopField("Link") === "string" ? shopField("Link") : "") ||
              ""
            : "";
          const qtyRaw =
            (row as Record<string, unknown>).qty ??
            (row as Record<string, unknown>).jumlah ??
            (row as Record<string, unknown>).quantity;
          const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw ?? 0) || 0;
          // Harga satuan: priceWithTax = price + tax. fallback ke price.
          const priceWithTaxRaw =
            shopField("PriceWithTax") ??
            shopField("TotalPrice") ??
            shopField("HargaDenganPajak") ??
            shopField("Price");
          const shippingRaw = shopField("Shipping") ?? shopField("Ongkir");
          const installRaw = shopField("Installation") ?? shopField("Instalasi");
          function toNum(v: unknown): number {
            if (typeof v === "number") return v;
            if (typeof v === "string") {
              const c = v.replace(/[^\d,.]/g, "");
              return c ? Number(c.replaceAll(".", "").replace(",", ".")) || 0 : 0;
            }
            return 0;
          }
          const pricePerUnit = chosenKey
            ? toNum(priceWithTaxRaw) || toNum(shopField("Harga")) || 0
            : 0;
          const shippingPerUnit = chosenKey ? toNum(shippingRaw) : 0;
          const installPerUnit = chosenKey ? toNum(installRaw) : 0;
          const hargaSatuan = pricePerUnit + shippingPerUnit + installPerUnit;
          const hargaTotal = hargaSatuan * qty;
          if (qty <= 0 && hargaSatuan <= 0) continue;
          globalNo += 1;
          const fungsi = String(
            (typeof (row as Record<string, unknown>).fungsi === "string" ? (row as Record<string, unknown>).fungsi : "") ||
            (typeof (row as Record<string, unknown>).keterangan === "string" ? (row as Record<string, unknown>).keterangan : "") ||
            concentrationNameOf(kk) || ""
          );
          out.push({
            no: globalNo,
            namaAlat,
            fungsi,
            namaToko: String(namaToko || chosenKey),
            linkToko: String(linkToko || ""),
            qty,
            hargaSatuan,
            hargaTotal,
          });
        }
      }
    }
    return out;
  }, [proposalBundle, profile.concentrations]);

  const grandTotal = rows.reduce((s, r) => s + r.hargaTotal, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-4">
      <TabActionBar
        title="Tab ③ RPKP — Rencana Pengadaan Kerja Praktek"
        description="Format cetak 8 kolom sesuai spesifikasi: No | Nama Alat | Fungsi | Nama Toko | Link Toko | Jumlah | Harga Satuan | Harga Total"
        printId="print-rpkp"
        onPreview={onPreview}
      />
      <div id="print-rpkp" className="space-y-2 print-a4-portrait">
        <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-primary/[0.05] space-y-1">
            <p className="text-xs font-semibold text-primary">
              RENCANA PENGADAAN KERJA PRAKTEK (RPKP)
            </p>
            <p className="text-[11px] text-slate-600">
              Sekolah: <span className="font-semibold text-slate-800">{profile.schoolName || "—"}</span> · NPSN <span className="font-mono">{profile.npsn || "—"}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-[11px] md:text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left w-12">No</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Nama Alat</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Fungsi</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Nama Toko</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Link Toko</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-20">Jumlah</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-40">Harga Satuan</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-44 bg-primary/[0.06]">Harga Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada data RPKP yang diisi sekolah.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className={cn(i % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                      <td className="border-b border-slate-100 px-3 py-2 align-top font-semibold text-slate-700">{r.no}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top font-semibold text-slate-900">{r.namaAlat}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-600">{r.fungsi}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">{r.namaToko}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        {r.linkToko ? (
                          <a
                            href={r.linkToko}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary underline break-all hover:text-primary/80 text-[11px]"
                          >
                            {r.linkToko}
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums">{r.qty || "—"}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums text-slate-700">
                        {r.hargaSatuan > 0 ? formatRupiah(r.hargaSatuan, { symbol: false, full: false }) : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top text-right tabular-nums font-bold text-slate-950 bg-primary/[0.06]">
                        {r.hargaTotal > 0 ? formatRupiah(r.hargaTotal, { symbol: false, full: false }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 ? (
                <tfoot className="bg-slate-900 text-white text-xs">
                  <tr>
                    <td colSpan={5} className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{totalQty.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right font-semibold">TOTAL</td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums whitespace-nowrap">
                      {formatRupiah(grandTotal, { symbol: true, full: false })}
                    </td>
                  </tr>
                  <tr className="bg-black text-white">
                    <td colSpan={7} className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      Terbilang
                    </td>
                    <td className="px-4 py-2 text-right italic">
                      {formatRupiah(grandTotal, { symbol: false, full: true })}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 print:hidden">
          {rows.length} item · Total qty {totalQty.toLocaleString("id-ID")} · Dicetak: {formatDateTime(new Date())}
        </p>
      </div>
    </div>
  );
}

// ============== TAB 4: RAB (Rencana Anggaran Biaya) ==============
function TabRAB({
  profile,
  proposalBundle,
  onPreview,
}: {
  profile: SchoolProfileRecord;
  proposalBundle: WorkspaceSchoolProposalData | null;
  onPreview?: (printId: TabPrintId) => void;
}) {
  const groups = useMemo(() => {
    const tables = proposalBundle?.proposalTables ?? {};
    const konsentrasi = profile.concentrations
      .slice()
      .sort((a, b) => compareConcentrationCode(a.code, b.code));
    const out: Array<{
      kkCode: string;
      kkName: string;
      rows: Array<Record<string, unknown>>;
      subtotal: number;
      ppn: number;
      total: number;
    }> = [];
    for (const kk of konsentrasi) {
      const prefix = kk.code.replaceAll(".", "-");
      const tableKeys = Object.keys(tables).filter((k) => {
        const low = k.toLowerCase();
        const matchPrefix = low.includes(prefix.toLowerCase()) || low.includes(kk.code.split(".")[0] || "");
        return matchPrefix && (low.includes("rab") || low.includes("anggaran") || (low.includes("ringkasan") && low.includes("biaya"))) && !low.includes("survey") && !low.includes("harga") && !low.includes("rpkp");
      });
      if (tableKeys.length === 0) continue;
      const rows: Array<Record<string, unknown>> = [];
      for (const tk of tableKeys) {
        const tbl = tables[tk];
        if (!Array.isArray(tbl)) continue;
        for (const row of tbl as Array<Record<string, unknown>>) rows.push(row);
      }
      function toNum(v: unknown): number {
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          const c = v.replace(/[^\d,.]/g, "");
          return c ? Number(c.replaceAll(".", "").replace(",", ".")) || 0 : 0;
        }
        return 0;
      }
      let subtotal = 0;
      for (const r of rows) {
        for (const [k, v] of Object.entries(r)) {
          const kLow = k.toLowerCase();
          if (!kLow.includes("subtotal") && !kLow.includes("total") && !kLow.includes("jumlah") && !kLow.includes("biaya") && !kLow.includes("harga")) continue;
          const n = toNum(v);
          if (n > 100_000) subtotal = Math.max(subtotal, n);
        }
      }
      // Fallback subtotal = sum of rows "total" if subtotal not found
      if (subtotal === 0) {
        for (const r of rows) {
          const t = (r as Record<string, unknown>).total ?? (r as Record<string, unknown>).jumlahTotal ?? (r as Record<string, unknown>).grandTotal;
          subtotal += toNum(t);
        }
      }
      const ppn = Math.round(subtotal * 0.11);
      const total = subtotal + ppn;
      out.push({
        kkCode: kk.code,
        kkName: concentrationNameOf(kk),
        rows,
        subtotal,
        ppn,
        total,
      });
    }
    return out;
  }, [proposalBundle, profile.concentrations]);

  const grandSubtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const grandPpn = groups.reduce((s, g) => s + g.ppn, 0);
  const grandTotal = grandSubtotal + grandPpn;

  return (
    <div className="space-y-4">
      <TabActionBar
        title="Tab ④ RAB — Rencana Anggaran Biaya"
        description="Ringkasan anggaran per Konsentrasi Keahlian + PPN 11% — format sesuai aslinya"
        printId="print-rab"
        onPreview={onPreview}
      />
      <div id="print-rab" className="space-y-3 print-a4-portrait">
        <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-emerald-50/60 space-y-1">
            <p className="text-xs font-semibold text-emerald-800">
              RENCANA ANGGARAN BIAYA (RAB)
            </p>
            <p className="text-[11px] text-slate-600">
              Sekolah: <span className="font-semibold text-slate-800">{profile.schoolName || "—"}</span> · NPSN <span className="font-mono">{profile.npsn || "—"}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-[11px] md:text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left w-12">No</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left">Konsentrasi Keahlian</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-44">Subtotal (Rp)</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-44">PPN 11% (Rp)</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right w-48 bg-emerald-50/60">Total (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada ringkasan RAB yang tersimpan dari sekolah.
                    </td>
                  </tr>
                ) : (
                  groups.map((g, i) => (
                    <tr key={g.kkCode} className={cn(i % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                      <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-700">{i + 1}</td>
                      <td className="border-b border-slate-100 px-3 py-3 space-y-0.5">
                        <div className="font-semibold text-slate-900">{g.kkName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{g.kkCode}</div>
                        {g.rows.length > 0 ? (
                          <div className="text-[11px] text-slate-500">{g.rows.length} rincian baris data</div>
                        ) : null}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {g.subtotal > 0 ? formatRupiah(g.subtotal, { symbol: false, full: false }) : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {g.ppn > 0 ? formatRupiah(g.ppn, { symbol: false, full: false }) : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums font-bold text-emerald-900 bg-emerald-50/50">
                        {g.total > 0 ? formatRupiah(g.total, { symbol: false, full: false }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {groups.length > 0 ? (
                <tfoot className="bg-slate-900 text-white text-xs">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-semibold text-right">
                      GRAND TOTAL RAB
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap font-semibold">
                      {formatRupiah(grandSubtotal, { symbol: false, full: false })}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap font-semibold">
                      {formatRupiah(grandPpn, { symbol: false, full: false })}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap font-bold">
                      {formatRupiah(grandTotal, { symbol: true, full: false })}
                    </td>
                  </tr>
                  <tr className="bg-black text-white">
                    <td colSpan={4} className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      Terbilang
                    </td>
                    <td className="px-4 py-2 text-right italic">
                      {formatRupiah(grandTotal, { symbol: false, full: true })}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detail per KK (asli dari proposal sekolah)</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {groups.map((g) => (
                <div key={g.kkCode} className="rounded-[18px] border border-slate-200 bg-slate-50/40 p-4 space-y-2 max-h-[340px] overflow-auto">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="border-slate-200 bg-white text-slate-700 font-mono" variant="outline">
                      {g.kkCode}
                    </Badge>
                    <span className="text-[11px] font-semibold text-emerald-800 tabular-nums">
                      {formatRupiah(g.total, { symbol: true, full: false })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">{g.kkName}</p>
                  {g.rows.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">— Tidak ada rincian baris —</p>
                  ) : (
                    <div className="space-y-1.5 text-[11px]">
                      {g.rows.slice(0, 20).map((r, i) => {
                        const firstColKey = Object.keys(r)[0] || "item";
                        const firstVal = (r as Record<string, unknown>)[firstColKey];
                        const totalKey = Object.keys(r).find((k) => /(total|jumlah|subtotal|grand)/i.test(k));
                        const totalVal = totalKey ? (r as Record<string, unknown>)[totalKey] : undefined;
                        return (
                          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="text-slate-700 min-w-0 truncate">
                              {typeof firstVal === "string" || typeof firstVal === "number"
                                ? String(firstVal)
                                : `Rincian ${i + 1}`}
                            </div>
                            {totalVal !== undefined && (typeof totalVal === "string" || typeof totalVal === "number") ? (
                              <div className="text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                                {String(totalVal)}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {g.rows.length > 20 ? (
                        <p className="text-[11px] text-slate-400 italic">+ {g.rows.length - 20} rincian lainnya (lihat tab cetak)</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-[11px] text-slate-400 print:hidden">
          Dicetak: {formatDateTime(new Date())}
        </p>
      </div>
    </div>
  );
}

// ============== TAB 5: RPD + TAB 6: PKS (PLACEHOLDER SIAP FORMAT FIX) ==============
function PlaceholderDokumenFiks({
  kode,
  nama,
  icon,
  profile,
  description,
  printId,
  onPreview,
  className,
}: {
  kode: string;
  nama: string;
  icon: React.ReactNode;
  profile: SchoolProfileRecord;
  description: string;
  printId: TabPrintId;
  onPreview?: (printId: TabPrintId) => void;
  className?: string;
}) {
  const members = Array.isArray(profile.organizationMembers) ? profile.organizationMembers : [];
  const principalName = profile.principalName || members[0]?.memberName || "[Nama Kepala Sekolah]";
  const principalNip = profile.principalNip || "[NIP Kepala Sekolah]";

  return (
    <div className={cn("space-y-4", className)}>
      <TabActionBar
        title={`Tab ${kode} ${nama}`}
        description={description}
        printId={printId}
        onPreview={onPreview}
      />
      <div id={printId} className="space-y-3 print-a4-portrait">
        <Card className="rounded-[24px] border-slate-200">
          <CardContent className="p-6 md:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/[0.06] text-primary">
                  {icon}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">FORMAT DOKUMEN</p>
                  <h3 className="text-xl font-semibold text-slate-950 md:text-2xl">{nama}</h3>
                </div>
              </div>
              <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                Format Fix Menyusul
              </Badge>
            </div>
            <div className="rounded-[20px] border border-dashed border-slate-300 bg-amber-50/30 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-amber-900">
                ⓘ Kerangka template ini SUDAH SIAP diisi dengan format fix.
              </p>
              <p className="text-xs text-amber-800/90">
                Setelah format fix RPD/PKS dikirimkan, placeholder di bawah ini akan diganti dengan struktur pasal, tabel, dan variable placeholder sesuai dokumen resmi — tanpa merubah desain halaman / tombol ini.
              </p>
            </div>

            {/* ===== KOMPONEN DOKUMEN RESMI (SIAP DI ISI FORMAT FIX) ===== */}
            <div className="rounded-[20px] border border-slate-200 bg-white p-5 md:p-8 space-y-5 print:shadow-none">
              {/* KOP SURAT */}
              <div className="border-b-2 border-slate-900 pb-4 grid grid-cols-[90px_1fr] gap-4 items-center">
                <div className="h-[90px] w-[90px] rounded-lg border-2 border-slate-900 bg-white flex items-center justify-center text-[10px] text-slate-500 font-semibold uppercase tracking-wide text-center leading-tight">
                  Logo<br />Kemendikbud
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-base md:text-lg font-bold uppercase tracking-wide text-slate-950">
                    KEMENTRIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI
                  </p>
                  <p className="text-sm md:text-base font-semibold uppercase text-slate-900">
                    {profile.schoolName || "[NAMA SEKOLAH]"}
                  </p>
                  <p className="text-[11px] md:text-xs text-slate-600 leading-5">
                    {profile.address || "[ALAMAT SEKOLAH]"} — {profile.city ? `${profile.city}, ` : ""}
                    Prov. {profile.province || "[PROVINSI]"} · Pos {profile.postalCode || "[KODE POS]"}<br />
                    NPSN: <span className="font-mono font-semibold">{profile.npsn || "[NPSN]"}</span>
                  </p>
                </div>
              </div>

              {/* JUDUL DOKUMEN */}
              <div className="text-center py-3 space-y-1">
                <p className="text-lg md:text-xl font-bold uppercase text-slate-950 underline underline-offset-4 decoration-2 decoration-slate-900">
                  {nama}
                </p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                  Nomor: ……………… / {kode} / {profile.city || "KOTA"} / {new Date().getFullYear()}
                </p>
              </div>

              {/* IDENTITAS / PEMBUKA */}
              <div className="space-y-2 text-sm md:text-[15px] leading-7 text-slate-900">
                <p className="text-justify indent-10">
                  Pada hari ini <u>{new Date().toLocaleDateString("id-ID", { weekday: "long" })}</u>, tanggal{" "}
                  <u>{new Date().toLocaleDateString("id-ID", { day: "numeric" })}</u> bulan{" "}
                  <u>{new Date().toLocaleDateString("id-ID", { month: "long" })}</u> tahun{" "}
                  <u>{new Date().toLocaleDateString("id-ID", { year: "numeric" })}</u>, bertempat di{" "}
                  <b>{profile.city || "[KOTA / KABUPATEN]"}</b>, yang bertanda tangan di bawah ini:
                </p>
                <div className="grid md:grid-cols-[160px_1fr] gap-x-4 gap-y-1.5 ml-6 mt-2 text-[13px] md:text-sm">
                  <div className="text-slate-600">Nama</div>
                  <div className="text-slate-950 font-semibold">{principalName}</div>
                  <div className="text-slate-600">NIP</div>
                  <div className="text-slate-950 font-mono">{principalNip}</div>
                  <div className="text-slate-600">Jabatan</div>
                  <div className="text-slate-950">Kepala Sekolah {profile.schoolName || "[NAMA SEKOLAH]"}</div>
                  <div className="text-slate-600">NPSN Sekolah</div>
                  <div className="text-slate-950 font-mono">{profile.npsn || "[NPSN]"}</div>
                </div>
                <p className="text-justify indent-10 mt-3">
                  Dengan ini {kode === "⑤" ? "menyampaikan Rencana Penggunaan Dana (RPD)" : kode === "⑥" ? "menandatangani Perjanjian Kerja Sama (PKS)" : `menerbitkan dokumen ${nama}`}
                  {" "}sebagaimana diatur dalam ketentuan yang berlaku.
                  Rincian isi dan pasal-pasal selengkapnya AKAN DILENGKAPI sesuai format fix yang akan dikirimkan.
                </p>
              </div>

              {/* TABEL RINGKASAN RPD (TEMPAT DANA) */}
              {kode === "⑤" ? (
                <div className="rounded-[18px] border border-slate-200 bg-slate-50/40 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rincian Rencana Penggunaan Dana (isi sesuai format fix)
                  </p>
                  <table className="w-full text-xs md:text-sm border-collapse">
                    <tbody className="border border-slate-300">
                      <tr>
                        <td className="border-r border-b border-slate-300 px-3 py-2 w-1/3 font-semibold text-slate-700 bg-slate-50">1. Sumber Dana</td>
                        <td className="border-b border-slate-300 px-3 py-2">Dana Alokasi Khusus (DAK) Fisik — Bidang SMK Tahun Anggaran {new Date().getFullYear()}</td>
                      </tr>
                      <tr>
                        <td className="border-r border-b border-slate-300 px-3 py-2 w-1/3 font-semibold text-slate-700 bg-slate-50">2. PPK (Pengguna Anggaran)</td>
                        <td className="border-b border-slate-300 px-3 py-2 font-mono">
                          {principalName} — NIP {principalNip}
                        </td>
                      </tr>
                      <tr>
                        <td className="border-r border-b border-slate-300 px-3 py-2 w-1/3 font-semibold text-slate-700 bg-slate-50">3. Total Nilai Anggaran</td>
                        <td className="border-b border-slate-300 px-3 py-2 font-bold text-emerald-900 tabular-nums whitespace-nowrap">
                          Rp [………………………………] (Isi sesuai total RAB + PPN)
                        </td>
                      </tr>
                      <tr>
                        <td className="border-r px-3 py-2 w-1/3 font-semibold text-slate-700 bg-slate-50 align-top">4. Peruntukan Utama</td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <div>▸ Pengadaan alat praktik untuk {profile.concentrations.length} Konsentrasi Keahlian (RPKP)</div>
                            <div>▸ Biaya pendukung pelaksanaan Pra-Bimtek / Bimtek</div>
                            <div>▸ Biaya operasional dan administrasi kegiatan</div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}

              {/* TABEL PKS PIHAK 1 & PIHAK 2 */}
              {kode === "⑥" ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Pihak Pertama (Sekolah)</p>
                    <p className="text-sm font-bold text-slate-950">{profile.schoolName || "[NAMA SEKOLAH]"}</p>
                    <div className="text-xs text-slate-600 space-y-1 leading-6">
                      <div>Alamat: {profile.address || "[ALAMAT]"}</div>
                      <div>{profile.city ? `${profile.city}, ` : ""} Prov. {profile.province || "[PROVINSI]"}</div>
                      <div>NPSN: <span className="font-mono">{profile.npsn || "[NPSN]"}</span></div>
                      <div>Yang bertanda tangan: <b>{principalName}</b></div>
                      <div>NIP: <span className="font-mono">{principalNip}</span> — Jabatan: Kepala Sekolah</div>
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-amber-50/30 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">Pihak Kedua (Mitra / DUDI) — ISI FORMAT FIX</p>
                    <p className="text-sm font-bold text-amber-950">[NAMA MITRA / PERUSAHAAN / LEMBAGA]</p>
                    <div className="text-xs text-amber-900/80 space-y-1 leading-6">
                      <div>Alamat: [ALAMAT MITRA]</div>
                      <div>Kota: [KOTA MITRA]</div>
                      <div>NPWP: [NPWP MITRA]</div>
                      <div>Yang bertanda tangan: [NAMA DIREKTUR / Pimpinan]</div>
                      <div>NIK / NIP.: [… … … …] — Jabatan: [JABATAN MITRA]</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* TTD */}
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="space-y-1">
                  <p className="text-center text-sm text-slate-700">
                    Mengetahui,<br />
                    {kode === "⑤" ? "Pejabat Pembuat Komitmen (PPK)" : kode === "⑥" ? "Pihak Pertama" : "Kepala Sekolah"}
                  </p>
                  <p className="text-center text-sm text-slate-700">{profile.city || "[KOTA]"}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <div className="h-20" />
                  <p className="text-center text-sm font-semibold text-slate-900 underline underline-offset-4 decoration-slate-900">
                    {principalName}
                  </p>
                  <p className="text-center text-xs text-slate-500 font-mono">NIP. {principalNip}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-center text-sm text-slate-700">
                    {kode === "⑤" ? "Kepala Sekolah" : kode === "⑥" ? "Pihak Kedua" : "Saksi / Mengetahui"}
                  </p>
                  <p className="text-center text-sm text-slate-700">{profile.city || "[KOTA]"}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <div className="h-20" />
                  <p className="text-center text-sm font-semibold text-slate-900 underline underline-offset-4 decoration-slate-900">
                    [… TTD / FORMAT FIX …]
                  </p>
                  <p className="text-center text-xs text-slate-500 font-mono">NIK / NIP. ………………………………</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-slate-400 print:hidden">
          Sekolah: <span className="font-semibold text-slate-600">{profile.schoolName}</span> · Dicetak: {formatDateTime(new Date())}
        </p>
      </div>
    </div>
  );
}
// ============== MAIN PAGE COMPONENT ==============
export function FacilitatorAdministrasiBimtekDetailPage({ npsn }: { npsn: string }) {
  const session = useAuthStore((s) => s.session);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [documents, setDocuments] = useState<SchoolAdministrativeDocumentRecord[]>([]);
  const [proposalBundle, setProposalBundle] = useState<WorkspaceSchoolProposalData | null>(null);
  const [equipmentBundle, setEquipmentBundle] = useState<WorkspaceSchoolEquipmentData | null>(null);
  const [_bidangMap, setBidangMap] = useState<Record<string, PerdirjenEquipmentSummary>>({});
  const [mainTab, setMainTab] = useState<MainTabKey>("identitas");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  // Modal Preview PDF / Gambar (reuse pattern dari verifikasi detail)
  const [previewDoc, setPreviewDoc] = useState<{ doc: SchoolAdministrativeDocumentRecord; idx: number } | null>(null);
  const previewPortalRef = useRef<HTMLDivElement | null>(null);

  // Modal Preview Tab Content (Preview sebelum Print/Save PDF)
  const [printPreviewId, setPrintPreviewId] = useState<TabPrintId | null>(null);
  const printPreviewRef = useRef<HTMLDivElement | null>(null);

  // Clone content print ke modal preview setiap printPreviewId berubah (jangan pakai ref callback dataset, sering blank karena mount timing)
  useEffect(() => {
    if (!printPreviewId || !printPreviewRef.current) return;
    const node = printPreviewRef.current;
    const id = printPreviewId;
    const timer = window.setTimeout(() => {
      const src = document.getElementById(id);
      if (!src || !printPreviewRef.current) return;
      printPreviewRef.current.innerHTML = "";
      const clone = src.cloneNode(true) as HTMLElement;
      clone.style.maxWidth = id === "print-survey" ? "1050px" : "820px";
      clone.style.margin = "0 auto";
      clone.style.background = "white";
      clone.style.padding = "18px 22px";
      clone.style.borderRadius = "6px";
      clone.style.boxShadow = "0 6px 24px rgba(15,23,42,0.08)";
      clone.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((el) => { el.style.display = "none"; });
      clone.querySelectorAll<HTMLElement>(".hidden").forEach((el) => {
        // Yang class "hidden print:block" (cetak-only) — di preview TAMPILKAN
        if (el.classList.contains("print:block") || /print\\:block/.test(el.className) || Array.from(el.classList).some(c => c.startsWith("print:"))) {
          el.style.setProperty("display", "block", "important");
        }
      });
      printPreviewRef.current.appendChild(clone);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [printPreviewId]);

  async function loadDetail(force = false) {
    if (!hydrated || !session?.token) {
      setLoading(false);
      return;
    }
    if (force) {
      setRefreshing(true);
      invalidateDetailPraBimtekCache(npsn);
    }
    setLoading(true);
    setLoadError("");
    let cancelled = false;
    try {
      const token = session.token;
      const [prof, adminSelection, admDocs]: [
        SchoolProfileRecord,
        WorkspaceAdminSelectionData,
        SchoolAdministrativeDocumentRecord[],
      ] = await Promise.all([
        schoolProfileByNpsnRequest(token, npsn),
        fetchCachedDetailPraBimtekByNpsn(token, npsn, { force }),
        schoolAdministrativeDocumentsByNpsnRequest(token, npsn),
      ]);
      if (cancelled) return;
      const konsentrasi = [...prof.concentrations].sort((a, b) => compareConcentrationCode(a.code, b.code));
      const bidangCodes = [
        ...new Set(konsentrasi.map((c) => c.code.split(".")[0]).filter(Boolean)),
      ];
      const bidangCached = await fetchCachedPerdirjenBidangBatch(token, bidangCodes, { force });
      const bidangEntries: readonly (readonly [string, PerdirjenEquipmentSummary])[] =
        bidangCodes.map((c) => [c, bidangCached[c] ?? { no: c, bidang: c, totalProgram: 0, totalKonsentrasi: 0, totalItem: 0, program: [] }] as const);
      if (cancelled) return;

      const filteredDocs = admDocs.filter((d) => ADMINISTRATIVE_DOCUMENT_UMUM_CODES.includes(d.code));
      setDocuments(filteredDocs.length ? filteredDocs : admDocs.slice(0, 13));
      setProfile(prof);
      setProposalBundle(
        (adminSelection.proposalBundles?.[npsn] as WorkspaceSchoolProposalData | undefined) ?? null,
      );
      setEquipmentBundle(
        (adminSelection.equipmentBundles?.[npsn] as WorkspaceSchoolEquipmentData | undefined) ?? null,
      );
      setBidangMap(Object.fromEntries(bidangEntries));
    } catch (err) {
      if (!cancelled) setLoadError(err instanceof Error ? err.message : "Gagal memuat detail Bimbingan Teknis sekolah.");
    } finally {
      if (!cancelled) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    return () => { cancelled = true; };
  }

  useEffect(() => {
    void loadDetail(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn]);

  const { rpkpGrand, rabGrand } = useMemo(() => {
    let rpkp = 0;
    let rab = 0;
    const tables = (proposalBundle as WorkspaceSchoolProposalData | null)?.proposalTables ?? {};
    for (const [k, tbl] of Object.entries(tables)) {
      if (!Array.isArray(tbl)) continue;
      const key = String(k).toLowerCase();
      const isRpkp = key.includes("rpkp") || key.includes("pengajuan");
      const isRab = key.includes("rab") || key.includes("anggaran");
      for (const row of tbl as Array<Record<string, unknown>>) {
        for (const [kk, vv] of Object.entries(row)) {
          if (typeof vv !== "string") continue;
          const kkLow = kk.toLowerCase();
          if (!kkLow.includes("subtotal") && !kkLow.includes("total") && !kkLow.includes("jumlah") && !kkLow.includes("grand")) continue;
          const cleaned = vv.replace(/[^\d,.]/g, "");
          if (!cleaned) continue;
          const num = Number(cleaned.replaceAll(".", "").replace(",", "."));
          if (!Number.isFinite(num) || num <= 0) continue;
          if (isRpkp) rpkp += num;
          if (isRab || (!isRpkp && key.includes("ringkasan"))) rab += num;
        }
      }
    }
    // Global Biaya Persiapan & Pelatihan (Card 1 & Card 2 di halaman /sekolah/pengajuan)
    const gKeys = ["__global_biaya_persiapan_pelaporan", "__global_biaya_pendukung_pelatihan"];
    for (const gKey of gKeys) {
      const gTbl = tables[gKey];
      if (!Array.isArray(gTbl)) continue;
      for (const gRow of gTbl as Array<Record<string, unknown>>) {
        for (const sk of ["shop1", "shop2", "shop3"]) {
          const shop = gRow[sk] as Record<string, unknown> | undefined | null;
          if (!shop || typeof shop !== "object") continue;
          const tp = typeof shop.totalPrice === "string" ? shop.totalPrice : "";
          const cleaned = tp.replace(/[^\d,.]/g, "");
          if (!cleaned) continue;
          const num = Number(cleaned.replaceAll(".", "").replace(",", "."));
          if (Number.isFinite(num) && num > 0) rab += num;
        }
      }
    }
    return { rpkpGrand: rpkp, rabGrand: rab };
  }, [proposalBundle]);

  function openDocPreview(doc: SchoolAdministrativeDocumentRecord, startIndex = 0) {
    setPreviewDoc({ doc, idx: startIndex });
  }

  // ============== LOADING STATE ==============
  if (loading && !profile) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-8 w-2/3 rounded bg-slate-100 animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-[20px] bg-slate-50 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="h-96 rounded-[28px] border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  const _equipment = equipmentBundle;
  const displayProfile: SchoolProfileRecord = profile ?? ({
    npsn,
    schoolName: "Memuat identitas sekolah…",
    concentrations: [],
    organizationMembers: [],
  } as unknown as SchoolProfileRecord);

  return (
    <div className="space-y-6">
      {/* Print Portal Root (hanya untuk clone saat window.print) — hidden = display:none di LAYAR; print:block = display:block di PRINT. HAPUS aria-hidden! */}
      <div id="print-portal-root" className="hidden print:block" />

      {/* Tab Nav */}
      <nav className="sticky top-[68px] z-20 -mx-2 px-2 pb-2 bg-slate-50/80 backdrop-blur">
        <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white p-2">
          <div className="flex gap-2 min-w-max">
            {MAIN_TAB_META.map((t) => (
              <button
                type="button"
                key={t.key}
                onClick={() => setMainTab(t.key)}
                className={cn(
                  "group flex items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition shrink-0 min-w-[200px]",
                  mainTab === t.key
                    ? "border-primary/30 bg-primary/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border text-xs font-bold",
                    mainTab === t.key
                      ? "border-primary/30 bg-white text-primary"
                      : "border-slate-200 bg-slate-50 text-slate-500 group-hover:text-slate-700",
                  )}
                >
                  {t.no}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold",
                      mainTab === t.key ? "text-slate-950" : "text-slate-700",
                    )}
                  >
                    {t.icon("")}
                    <span className="truncate">{t.label}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{t.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Content: Lazy Wrap — HANYA RENDER TAB YANG DIPILIH! = first paint CEPAT */}
      <section className="space-y-0">
        <DetailTabLazyWrap active={mainTab === "identitas"} skeletonRows={20}>
          {mainTab === "identitas" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ① Identitas Sekolah"
                description="Profil lengkap sekolah, alamat, data kepala sekolah, wakasek sarana & daftar konsentrasi keahlian (cetak format A4)"
                printId="print-identitas"
                onPreview={(id) => setPrintPreviewId(id)}
                onRefresh={() => void loadDetail(true)}
                refreshLabel="Refresh Sekolah"
              />
              <SchoolDetailViewProvider npsn={String(displayProfile.npsn || npsn)} role={session?.user?.role as any}>
                <SchoolProfileManager forceActiveTab="data-sekolah" hideTopTabBar />
              </SchoolDetailViewProvider>
            </div>
          ) : null}
        </DetailTabLazyWrap>

        <DetailTabLazyWrap active={mainTab === "administrasi"} skeletonRows={24}>
          {mainTab === "administrasi" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ② Berkas Administrasi"
                description="Ceklis dokumen administrasi sekolah (18 item wajib + pendukung sesuai referensi DOCX Ceklis Adm)"
                printId="print-administrasi"
                onPreview={(id) => setPrintPreviewId(id)}
                onRefresh={() => void loadDetail(true)}
                refreshLabel="Refresh Berkas"
              />
              <SchoolDetailViewProvider npsn={String(displayProfile.npsn || npsn)} role={session?.user?.role as any}>
                <SchoolProfileManager forceActiveTab="dokumen-administrasi" hideTopTabBar />
              </SchoolDetailViewProvider>
            </div>
          ) : null}
        </DetailTabLazyWrap>

        <DetailTabLazyWrap active={mainTab === "survey-harga"} skeletonRows={32}>
          {mainTab === "survey-harga" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ③ Survey Harga Pasar"
                description="Tabel perbandingan harga 3 toko peralatan praktik untuk setiap item di konsentrasi keahlian (landscape A4)"
                printId="print-survey"
                onPreview={(id) => setPrintPreviewId(id)}
              />
              <SchoolDetailViewProvider npsn={String(displayProfile.npsn || npsn)} role={session?.user?.role as any}>
                <SchoolProposalPage forceActiveTab="survey" hideTopTabBar />
              </SchoolDetailViewProvider>
            </div>
          ) : null}
        </DetailTabLazyWrap>

        <DetailTabLazyWrap active={mainTab === "rpkp"} skeletonRows={32}>
          {mainTab === "rpkp" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ④ RPKP — Rencana Pengadaan Kerja Praktek"
                description="Daftar 8 kolom rencana pengadaan alat praktik, harga terpilih dan subtotal per KK"
                printId="print-rpkp"
                onPreview={(id) => setPrintPreviewId(id)}
              />
              <SchoolDetailViewProvider npsn={String(displayProfile.npsn || npsn)} role={session?.user?.role as any}>
                <SchoolProposalPage forceActiveTab="rpkp" hideTopTabBar />
              </SchoolDetailViewProvider>
            </div>
          ) : null}
        </DetailTabLazyWrap>

        <DetailTabLazyWrap active={mainTab === "rab"} skeletonRows={24}>
          {mainTab === "rab" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ⑤ RAB — Rencana Anggaran Biaya"
                description="Agregasi Persiapan + Belanja Alat + Pelatihan, rincian per KK dan ringkasan grand total pembulatan"
                printId="print-rab"
                onPreview={(id) => setPrintPreviewId(id)}
              />
              <SchoolDetailViewProvider npsn={String(displayProfile.npsn || npsn)} role={session?.user?.role as any}>
                <SchoolProposalPage forceActiveTab="rab" hideTopTabBar />
              </SchoolDetailViewProvider>
            </div>
          ) : null}
        </DetailTabLazyWrap>

        <DetailTabLazyWrap active={mainTab === "rpd"} skeletonRows={16}>
          {mainTab === "rpd" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ⑥ RPD — Rencana Penggunaan Dana"
                description="Dokumen RPD diisi otomatis placeholder profil sekolah + anggaran (bisa diedit inline, upload gambar & A4 page setup)"
                printId="print-rpd"
                onPreview={(id) => setPrintPreviewId(id)}
              />
              <div>
                <SchoolRpdPksDocumentEditor
                  useTipTap={true}
                  npsn={String(displayProfile.npsn || npsn)}
                  profile={displayProfile}
                  moduleContext="bimbingan-teknis"
                  activeTabKind="RPD"
                  onSwitchKind={(next) => setMainTab(next.toLowerCase() as MainTabKey)}
                  tabPrintIdMap={{ RPD: "print-rpd", PKS: "print-pks" }}
                  allowedKinds={["RPD", "PKS"]}
                  onPreviewPrint={(id) => setPrintPreviewId(id as TabPrintId)}
                  totalAnggaranRpNumber={Math.round(rabGrand || rpkpGrand || 0)}
                />
              </div>
            </div>
          ) : null}
        </DetailTabLazyWrap>

        <DetailTabLazyWrap active={mainTab === "pks"} skeletonRows={16}>
          {mainTab === "pks" ? (
            <div className="space-y-4">
              <TabActionBar
                title="Tab ⑦ PKS — Perjanjian Kerja Sama"
                description="Dokumen PKS sekolah dengan mitra / lembaga DUDI, isi placeholder otomatis, bisa diedit inline editor."
                printId="print-pks"
                onPreview={(id) => setPrintPreviewId(id)}
              />
              <div>
                <SchoolRpdPksDocumentEditor
                  useTipTap={true}
                  npsn={String(displayProfile.npsn || npsn)}
                  profile={displayProfile}
                  moduleContext="bimbingan-teknis"
                  activeTabKind="PKS"
                  onSwitchKind={(next) => setMainTab(next.toLowerCase() as MainTabKey)}
                  tabPrintIdMap={{ RPD: "print-rpd", PKS: "print-pks" }}
                  allowedKinds={["RPD", "PKS"]}
                  onPreviewPrint={(id) => setPrintPreviewId(id as TabPrintId)}
                  totalAnggaranRpNumber={Math.round(rabGrand || rpkpGrand || 0)}
                />
              </div>
            </div>
          ) : null}
        </DetailTabLazyWrap>
      </section>

      {/* ========================================================
          HIDDEN SHARED PRINT TEMPLATES ① - ⑤
          (TIDAK ditampilkan inline di screen!)
          Tab ① - ⑤ tidak punya editor dokumen di layar utama, jadi
          ketika klik tombol Preview, kita clone isi template master
          admin + isi placeholder data sekolah dari hidden section ini.
          Tab ⑥ & ⑦ (RPD / PKS) TIDAK ADA di sini karena id wrapper
          print-rpd / print-pks sudah unique di visible editor tab.
          ======================================================== */}
      <section
        aria-hidden="true"
        className="pointer-events-none invisible opacity-0 absolute -z-[100] left-0 top-0 h-0 w-0 overflow-hidden"
        tabIndex={-1}
      >
        <div id="hidden-print-templates-tab1-5">
          <div>
            <SchoolRpdPksDocumentEditor
              npsn={String(displayProfile.npsn || npsn)}
              profile={displayProfile}
              moduleContext="bimbingan-teknis"
              activeTabKind="IDENTITAS"
              tabPrintIdMap={{ IDENTITAS: "print-identitas" }}
              allowedKinds={["IDENTITAS"]}
              initialPreviewMode={true}
              compactHeader={true}
            />
          </div>
          <div>
            <SchoolRpdPksDocumentEditor
              npsn={String(displayProfile.npsn || npsn)}
              profile={displayProfile}
              moduleContext="bimbingan-teknis"
              activeTabKind="ADMINISTRASI"
              tabPrintIdMap={{ ADMINISTRASI: "print-administrasi" }}
              allowedKinds={["ADMINISTRASI"]}
              initialPreviewMode={true}
              compactHeader={true}
            />
          </div>
          <div>
            <SchoolRpdPksDocumentEditor
              npsn={String(displayProfile.npsn || npsn)}
              profile={displayProfile}
              moduleContext="bimbingan-teknis"
              activeTabKind="SURVEY_HARGA"
              tabPrintIdMap={{ SURVEY_HARGA: "print-survey" }}
              allowedKinds={["SURVEY_HARGA"]}
              initialPreviewMode={true}
              compactHeader={true}
            />
          </div>
          <div>
            <SchoolRpdPksDocumentEditor
              npsn={String(displayProfile.npsn || npsn)}
              profile={displayProfile}
              moduleContext="bimbingan-teknis"
              activeTabKind="RPKP"
              tabPrintIdMap={{ RPKP: "print-rpkp" }}
              allowedKinds={["RPKP"]}
              initialPreviewMode={true}
              compactHeader={true}
              totalAnggaranRpNumber={Math.round(rpkpGrand || 0)}
            />
          </div>
          <div>
            <SchoolRpdPksDocumentEditor
              npsn={String(displayProfile.npsn || npsn)}
              profile={displayProfile}
              moduleContext="bimbingan-teknis"
              activeTabKind="RAB"
              tabPrintIdMap={{ RAB: "print-rab" }}
              allowedKinds={["RAB"]}
              initialPreviewMode={true}
              compactHeader={true}
              totalAnggaranRpNumber={Math.round(rabGrand || 0)}
            />
          </div>
        </div>
      </section>

      {/* Modal Preview Dokumen */}
      {previewDoc?.doc ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-2 md:p-6"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] rounded-[28px] border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 bg-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview Dokumen</p>
                <p className="text-sm font-semibold text-slate-900">
                  {String(previewDoc.doc.no ?? "—").padStart(2, "0")} · {resolveAdministrativeDocLabel(previewDoc.doc.code)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={(() => {
                    const f = previewDoc.doc.files?.[previewDoc.idx];
                    return f?.filePath || previewDoc.doc.filePath || "#";
                  })()}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 hover:bg-slate-50"
                  aria-label="Tutup"
                >
                  ✕
                </button>
              </div>
            </div>
            <div ref={previewPortalRef} className="flex-1 overflow-auto bg-slate-100 min-h-[60vh]">
              {(() => {
                const f = previewDoc.doc.files?.[previewDoc.idx];
                const url = f?.filePath || previewDoc.doc.filePath || "";
                const mime = f?.mimeType || previewDoc.doc.mimeType || "";
                if (!url) {
                  return (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Berkas tidak ditemukan.
                    </div>
                  );
                }
                if (isPdf(mime) || url.toLowerCase().endsWith(".pdf")) {
                  return (
                    <iframe
                      src={url}
                      title={f?.fileName || previewDoc.doc.fileName || "Dokumen"}
                      className="w-full h-[80vh] bg-white"
                    />
                  );
                }
                if (isImage(mime) || /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(url)) {
                  return (
                    <div className="flex items-center justify-center p-4">
                      <img
                        src={url}
                        alt={f?.fileName || previewDoc.doc.fileName || "Preview gambar"}
                        className="max-w-full max-h-[80vh] object-contain rounded-lg shadow"
                      />
                    </div>
                  );
                }
                return (
                  <div className="p-10 text-center space-y-3">
                    <FileText className="mx-auto h-10 w-10 text-slate-400" />
                    <p className="text-sm text-slate-600">
                      Tidak dapat preview inline. Silakan download atau buka tautan:
                    </p>
                    <a href={url} target="_blank" rel="noreferrer noopener" className="text-primary underline text-sm break-all font-semibold">
                      {url}
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal PRINT PREVIEW (A4 size preview sebelum Save PDF / Print langsung) */}
      {printPreviewId ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-2 md:p-6"
          onClick={() => {
            setPrintPreviewId(null);
            clearPrintPortal();
          }}
        >
          <div
            className="relative w-full max-w-[1100px] max-h-[94vh] rounded-[28px] border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER MODAL */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50/80">
              <div className="space-y-0.5 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Preview Cetak · A4
                  {printPreviewId === "print-survey" ? " (Landscape)" : " (Portrait)"}
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {printPreviewId === "print-identitas" && "① Identitas Sekolah — Profil, Kepsek & Konsentrasi Keahlian"}
                  {printPreviewId === "print-administrasi" && "② Daftar Ceklis Berkas Administrasi Sekolah"}
                  {printPreviewId === "print-survey" && "③ Survey Harga Pasar — Perbandingan 3 Toko"}
                  {printPreviewId === "print-rpkp" && "④ RPKP — Rencana Pengadaan Kerja Praktek (8 Kolom)"}
                  {printPreviewId === "print-rab" && "⑤ RAB — Rencana Anggaran Biaya per Konsentrasi Keahlian"}
                  {printPreviewId === "print-rpd" && "⑥ RPD — Rencana Penggunaan Dana"}
                  {printPreviewId === "print-pks" && "⑦ PKS — Perjanjian Kerja Sama Sekolah x Mitra DUDI"}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {displayProfile.schoolName} · NPSN {displayProfile.npsn}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!printPreviewId) return;
                    // Priority clone dari modal preview yang user SUDAH lihat (lebih fresh)
                    const previewNode = printPreviewRef.current;
                    const printContainer = document.getElementById("print-portal-root");
                    if (printContainer) {
                      if (previewNode && previewNode.children.length > 0 && (previewNode.innerText || "").trim().length > 80) {
                        printContainer.innerHTML = "";
                        const cl = previewNode.cloneNode(true) as HTMLElement;
                        cl.style.removeProperty("max-width");
                        cl.style.removeProperty("margin");
                        cl.style.removeProperty("background");
                        cl.style.removeProperty("padding");
                        cl.style.removeProperty("border-radius");
                        cl.style.removeProperty("box-shadow");
                        cl.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((n) => { n.style.display = "none"; });
                        printContainer.appendChild(cl);
                      } else {
                        cloneElementToPrintPortal(printPreviewId);
                      }
                    }
                    triggerSafePrint(900, () => clearPrintPortal());
                  }}
                  className="border-primary/20 bg-primary/[0.05] text-primary hover:bg-primary/[0.1]"
                >
                  <Printer className="mr-1.5 h-4 w-4" />
                  Print / Save PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!printPreviewId) return;
                    const previewNode = printPreviewRef.current;
                    const printContainer = document.getElementById("print-portal-root");
                    if (printContainer) {
                      if (previewNode && previewNode.children.length > 0 && (previewNode.innerText || "").trim().length > 80) {
                        printContainer.innerHTML = "";
                        const cl = previewNode.cloneNode(true) as HTMLElement;
                        cl.style.removeProperty("max-width");
                        cl.style.removeProperty("margin");
                        cl.style.removeProperty("background");
                        cl.style.removeProperty("padding");
                        cl.style.removeProperty("border-radius");
                        cl.style.removeProperty("box-shadow");
                        cl.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((n) => { n.style.display = "none"; });
                        printContainer.appendChild(cl);
                      } else {
                        cloneElementToPrintPortal(printPreviewId);
                      }
                    }
                    triggerSafePrint(1200, () => {
                      clearPrintPortal();
                      setPrintPreviewId(null);
                    });
                  }}
                  className="bg-primary text-white hover:bg-primary/90 hover:ring-2 hover:ring-primary/25 shadow-sm shadow-primary/10"
                >
                  <Printer className="mr-1.5 h-4 w-4" />
                  Print Sekarang
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintPreviewId(null);
                    clearPrintPortal();
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                  aria-label="Tutup"
                >
                  Tutup
                </button>
              </div>
            </div>
            {/* BODY MODAL */}
            <div className="flex-1 overflow-auto bg-slate-100/60 px-4 py-5 md:px-8 md:py-6">
              <div ref={printPreviewRef} className="mx-auto" />
            </div>
            {/* FOOTER NOTE */}
            <div className="border-t border-slate-200 bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                Tampilan preview adalah simulasi cetak A4 — klik{" "}
                <b className="text-primary">Print Sekarang</b> untuk membuka dialog cetak browser native (bisa Save PDF).
              </span>
              <span>Last preview: {formatDateTime(new Date())}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* GLOBAL PRINT STYLESHEET sudah di-pindahkan ke /app/globals.css permanent */}
    </div>
  );
}
