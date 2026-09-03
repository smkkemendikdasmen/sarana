"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock4,
  Eye,
  FileDown,
  FileText,
  Gauge,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ADMINISTRATIVE_DOCUMENT_LABELS,
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
  DOCUMENT_FORMAT_DOWNLOADS,
  FORMAT_FILES_BASE_PATH,
  schoolAdministrativeDocumentsByNpsnRequest,
  schoolProfileByNpsnRequest,
  upsertWorkspaceVerifikasiOnlineReviewRequest,
  workspaceAssignmentsRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileRecord,
  type WorkspaceAssignmentRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import { cn, compareConcentrationCode } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type ReviewItemStatus = "approved" | "pending" | "rejected" | null;

interface PerItemDraft {
  status: ReviewItemStatus;
  note: string;
  reviewNotes: Record<"approved" | "note_required" | "pending" | "rejected", string>;
}

interface DetailReviewDraftStruct {
  version: 2;
  globalNote: string;
  globalStatus: ReviewItemStatus;
  globalReviewNotes: Record<"approved" | "note_required" | "pending" | "rejected", string>;
  dataSekolah: PerItemDraft;
  dokumenAdministrasi: PerItemDraft;
  concentrations: Record<string, PerItemDraft>;
  documents: Record<string, PerItemDraft>;
  conditions: Record<string, PerItemDraft>;
  proposals: Record<string, PerItemDraft>;
}

const inputBase =
  "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

function formatFileSize(size: number) {
  const bytes = Number.isFinite(size) ? size : 0;
  const mega = bytes / (1024 * 1024);
  const kilo = bytes / 1024;
  if (mega >= 1) return `${mega.toFixed(1)} MB`;
  if (kilo >= 1) return `${kilo.toFixed(0)} KB`;
  return `${bytes} bytes`;
}

function formatDateTime(date: Date) {
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function reviewStatusVariant(status: ReviewItemStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function reviewStatusLabel(status: ReviewItemStatus) {
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  if (status === "pending") return "Perbaikan";
  return "Belum di Proses";
}

const emptyReviewNotes: PerItemDraft["reviewNotes"] = {
  approved: "",
  note_required: "",
  pending: "",
  rejected: "",
};
const fallbackDataSekolahNotes: PerItemDraft = { status: null, note: "", reviewNotes: { ...emptyReviewNotes } };
const fallbackDokumenNotes: PerItemDraft = { status: null, note: "", reviewNotes: { ...emptyReviewNotes } };
const fallbackGlobalNotes: DetailReviewDraftStruct["globalReviewNotes"] = { ...emptyReviewNotes };

function tryParseDetailStruct(input: string | null | undefined): DetailReviewDraftStruct {
  const fallback: DetailReviewDraftStruct = {
    version: 2,
    globalNote: "",
    globalStatus: null,
    globalReviewNotes: { ...fallbackGlobalNotes },
    dataSekolah: { ...fallbackDataSekolahNotes },
    dokumenAdministrasi: { ...fallbackDokumenNotes },
    concentrations: {},
    documents: {},
    conditions: {},
    proposals: {},
  };
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ...fallback, globalNote: input };
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<
      DetailReviewDraftStruct & {
        approvedAdminBackup?: boolean | null;
        cardNote?: Partial<Record<"dataSekolah" | "dokumenAdministrasi" | "global", string>>;
        cardStatus?: Partial<Record<"dataSekolah" | "dokumenAdministrasi" | "global", string>>;
      }
    >;
    const normalizeItem = (raw?: Partial<PerItemDraft>): PerItemDraft => ({
      status:
        raw?.status === "approved" || raw?.status === "pending" || raw?.status === "rejected"
          ? raw.status
          : null,
      note: typeof raw?.note === "string" ? raw.note : "",
      reviewNotes: {
        approved: typeof (raw?.reviewNotes as Record<string, string> | undefined)?.approved === "string" ? (raw!.reviewNotes!.approved as string) : "",
        note_required:
          typeof (raw?.reviewNotes as Record<string, string> | undefined)?.note_required === "string"
            ? (raw!.reviewNotes!.note_required as string)
            : "",
        pending: typeof (raw?.reviewNotes as Record<string, string> | undefined)?.pending === "string" ? (raw!.reviewNotes!.pending as string) : "",
        rejected:
          typeof (raw?.reviewNotes as Record<string, string> | undefined)?.rejected === "string" ? (raw!.reviewNotes!.rejected as string) : "",
      },
    });
    const normalizeGlobalReviewNotes = (raw?: Partial<DetailReviewDraftStruct["globalReviewNotes"]>): DetailReviewDraftStruct["globalReviewNotes"] => ({
      approved: typeof raw?.approved === "string" ? raw.approved : "",
      note_required: typeof raw?.note_required === "string" ? raw.note_required : "",
      pending: typeof raw?.pending === "string" ? raw.pending : "",
      rejected: typeof raw?.rejected === "string" ? raw.rejected : "",
    });
    if (parsed.version === 2) {
      return {
        version: 2,
        globalNote: parsed.globalNote ?? "",
        globalStatus: parsed.globalStatus ?? null,
        globalReviewNotes: normalizeGlobalReviewNotes(parsed.globalReviewNotes),
        dataSekolah: normalizeItem(parsed.dataSekolah),
        dokumenAdministrasi: normalizeItem(parsed.dokumenAdministrasi),
        concentrations: parsed.concentrations ?? {},
        documents: parsed.documents ?? {},
        conditions: parsed.conditions ?? {},
        proposals: parsed.proposals ?? {},
      };
    }
    const statusFrom = (v: unknown): ReviewItemStatus =>
      v === "approved" || v === "pending" || v === "rejected" ? (v as ReviewItemStatus) : null;
    return {
      version: 2,
      globalNote: parsed.cardNote?.global ?? parsed.globalNote ?? "",
      globalStatus: statusFrom(parsed.cardStatus?.global) ?? parsed.globalStatus ?? null,
      globalReviewNotes: { ...fallbackGlobalNotes },
      dataSekolah: {
        status: statusFrom(parsed.cardStatus?.dataSekolah) ?? parsed.dataSekolah?.status ?? null,
        note: parsed.cardNote?.dataSekolah ?? parsed.dataSekolah?.note ?? "",
        reviewNotes: { ...emptyReviewNotes },
      },
      dokumenAdministrasi: {
        status: statusFrom(parsed.cardStatus?.dokumenAdministrasi) ?? parsed.dokumenAdministrasi?.status ?? null,
        note: parsed.cardNote?.dokumenAdministrasi ?? parsed.dokumenAdministrasi?.note ?? "",
        reviewNotes: { ...emptyReviewNotes },
      },
      concentrations: parsed.concentrations ?? {},
      documents: parsed.documents ?? {},
      conditions: parsed.conditions ?? {},
      proposals: parsed.proposals ?? {},
    };
  } catch {
    return { ...fallback, globalNote: trimmed };
  }
}

function serializeDetailStruct(struct: DetailReviewDraftStruct): string {
  return JSON.stringify({ ...struct, version: 2 });
}

function isImage(mime = "") {
  return typeof mime === "string" && /^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml?)/i.test(mime);
}
function isPdf(mime = "") {
  return typeof mime === "string" && /application\/pdf/i.test(mime);
}

function resolveAdministrativeDocLabel(code: string) {
  return ADMINISTRATIVE_DOCUMENT_LABELS[code] ?? code;
}

const CONCENTRATION_NAME_FALLBACK: Record<string, string> = {
  TKJ: "Teknik Komputer dan Jaringan",
  TKR: "Teknik Kendaraan Ringan",
  TBSM: "Teknik Bisnis Sepeda Motor",
  TKRO: "Teknik Kendaraan Ringan Otomotif",
  RPL: "Rekayasa Perangkat Lunak",
  SIJA: "Sistem Informatika, Jaringan, dan Aplikasi",
  DPIB: "Desain Pemodelan dan Informasi Bangunan",
};

function concentrationNameOf(item: { code: string; name: string | null }) {
  return (
    (item.name ?? "").trim() ||
    CONCENTRATION_NAME_FALLBACK[item.code.toUpperCase()] ||
    `Konsentrasi ${item.code.toUpperCase()}`
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <div>{children}</div>
    </label>
  );
}

function ReadOnlyValue({
  value,
  placeholder = "Belum diisi",
  mono,
}: {
  value: string | number | null | undefined;
  placeholder?: string;
  mono?: boolean;
}) {
  const hasValue = typeof value === "number" ? true : !!String(value ?? "").trim();
  return (
    <div
      className={cn(
        "w-full rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm",
        hasValue ? "text-slate-900" : "text-slate-400 italic",
        mono && "font-mono text-xs font-semibold",
      )}
    >
      {hasValue ? String(value) : placeholder}
    </div>
  );
}

type SectionStatus = "approved" | "note_required" | "pending" | "rejected";

function FourApprovalButtons({
  value,
  onChange,
  onNoteRequire,
  disabled,
}: {
  value: ReviewItemStatus;
  onChange: (next: ReviewItemStatus) => void;
  onNoteRequire?: () => void;
  disabled?: boolean;
}) {
  function activate(next: SectionStatus) {
    if (disabled) return;
    if (next === "approved") onChange("approved");
    else if (next === "rejected") onChange("rejected");
    else if (next === "pending") onChange("pending");
    else if (next === "note_required") {
      onChange("approved");
      onNoteRequire?.();
    }
  }
  const btn =
    "inline-flex flex-1 items-center justify-center gap-1.5 shrink-0 rounded-[14px] h-10 px-3 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed border";
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => activate("approved")}
        className={cn(
          btn,
          value === "approved"
            ? "border-emerald-300 bg-emerald-500 text-white shadow-sm shadow-emerald-200"
            : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
        )}
      >
        <ThumbsUp className="h-4.5 w-4.5 shrink-0" />
        <span className="truncate">Setujui</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => activate("note_required")}
        title="Setujui dengan Catatan"
        className={cn(
          btn,
          value === "approved"
            ? "border-sky-300 bg-sky-500 text-white shadow-sm shadow-sky-200"
            : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
        )}
      >
        <BadgeCheck className="h-4.5 w-4.5 shrink-0" />
        <span className="truncate">Setujui dengan Catatan</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => activate("pending")}
        className={cn(
          btn,
          value === "pending"
            ? "border-amber-300 bg-amber-500 text-white shadow-sm shadow-amber-200"
            : "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
        )}
      >
        <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
        <span className="truncate">Perbaiki</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => activate("rejected")}
        className={cn(
          btn,
          value === "rejected"
            ? "border-rose-300 bg-rose-500 text-white shadow-sm shadow-rose-200"
            : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
        )}
      >
        <ThumbsDown className="h-4.5 w-4.5 shrink-0" />
        <span className="truncate">Tolak</span>
      </button>
    </div>
  );
}

function ApprovalSectionHeader({
  title,
  description,
  icon,
  status,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: ReviewItemStatus;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-primary/15 bg-primary/[0.06] text-primary">
          {icon}
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <Badge className={cn("border shrink-0", reviewStatusVariant(status))} variant="outline">
        {status === "approved" && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
        {status === "rejected" && <XCircle className="mr-1 h-3.5 w-3.5" />}
        {status === "pending" && <Clock4 className="mr-1 h-3.5 w-3.5" />}
        {reviewStatusLabel(status)}
      </Badge>
    </div>
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
  sub?: string;
  accent?: "slate" | "emerald" | "sky" | "primary";
}) {
  const palette = {
    slate: "border-slate-200 bg-slate-50/80 text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    primary: "border-primary/20 bg-primary/[0.06] text-primary",
  } as const;
  return (
    <div className={cn("rounded-[20px] border p-4 md:p-5", palette[accent ?? "slate"])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 md:text-2xl">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function VerifikasiDetailStatCards({
  profile,
  documents,
  proposalBundle,
}: {
  profile: SchoolProfileRecord;
  documents: SchoolAdministrativeDocumentRecord[];
  proposalBundle: { tables?: Record<string, unknown> } | null;
}) {
  const uploaded = documents.filter((d) => d.uploaded).length;
  const total = documents.length || ADMINISTRATIVE_DOCUMENT_UMUM_CODES.length;
  const progressPct = total ? Math.round((uploaded / total) * 100) : 0;

  function grandTotalRpkp() {
    let grand = 0;
    const tables = proposalBundle?.tables ?? {};
    for (const table of Object.values(tables)) {
      if (!Array.isArray(table)) continue;
      for (const row of table as Array<Record<string, unknown>>) {
        for (const [k, v] of Object.entries(row)) {
          if (typeof v !== "string") continue;
          const key = k.toLowerCase();
          if (!key.includes("subtotal") && !key.includes("total") && !key.includes("jumlah")) continue;
          const cleaned = v.replace(/[^\d,.]/g, "");
          const number = Number(cleaned.replaceAll(".", "").replace(",", "."));
          if (Number.isFinite(number) && number > 0) grand += number;
        }
      }
    }
    return grand;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatTile
        eyebrow="NPSN"
        value={<span className="font-mono tracking-tight">{profile.npsn || "—"}</span>}
        sub={profile.schoolName || "Identitas Sekolah"}
        accent="slate"
      />
      <StatTile
        eyebrow="Kompetensi Keahlian"
        value={`${profile.concentrations.length} KK`}
        sub={
          profile.concentrations.length
            ? profile.concentrations
                .slice(0, 3)
                .map((c) => c.code)
                .join(" · ")
            : "Belum ada KK"
        }
        accent="sky"
      />
      <StatTile
        eyebrow="Progress Dokumen Administrasi"
        value={`${uploaded}/${total} dokumen`}
        sub={`${progressPct}% kelengkapan berkas`}
        accent={progressPct >= 80 ? "emerald" : progressPct >= 40 ? "primary" : "slate"}
      />
      <StatTile
        eyebrow="Total RAB (RPKP)"
        value={new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(grandTotalRpkp())}
        sub="Rekap semua subtotal/tabel pengajuan"
        accent="primary"
      />
    </div>
  );
}

function DataSekolahSummaryBody({ profile }: { profile: SchoolProfileRecord }) {
  const members = Array.isArray(profile.organizationMembers) ? profile.organizationMembers : [];
  let principalName = profile.principalName || members[0]?.memberName || "";
  const principalNip = profile.principalNip || "";
  const principalPhone = profile.principalPhone || members[0]?.contactPhone || "";
  let viceName =
    profile.vicePrincipalFacilitiesName || members[1]?.memberName || "";
  const vicePhone =
    profile.vicePrincipalFacilitiesPhone || members[1]?.contactPhone || "";
  if (principalName && profile.schoolName && principalName.trim() === profile.schoolName.trim()) {
    principalName = "";
  }
  if (viceName && profile.schoolName && viceName.trim() === profile.schoolName.trim()) {
    viceName = "";
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nama Sekolah">
          <ReadOnlyValue value={profile.schoolName} />
        </Field>
        <Field label="NPSN">
          <ReadOnlyValue value={profile.npsn} mono />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Provinsi">
          <ReadOnlyValue value={profile.province} />
        </Field>
        <Field label="Kabupaten / Kota">
          <ReadOnlyValue value={profile.city} />
        </Field>
        <Field label="Kode Pos">
          <ReadOnlyValue value={profile.postalCode} />
        </Field>
      </div>
      <Field label="Alamat Jalan Lengkap">
        <ReadOnlyValue value={profile.address} />
      </Field>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-800">
            <Building2 className="h-3.5 w-3.5" />
            Kepala Sekolah
          </p>
          <div className="space-y-3">
            <Field label="Nama">
              <ReadOnlyValue value={principalName} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="NIP">
                <ReadOnlyValue value={principalNip} mono />
              </Field>
              <Field label="Nomor HP">
                <ReadOnlyValue value={principalPhone} />
              </Field>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-800">
            <Wrench className="h-3.5 w-3.5" />
            Wakil Kepala Sekolah Sarana
          </p>
          <div className="space-y-3">
            <Field label="Nama">
              <ReadOnlyValue value={viceName} />
            </Field>
            <Field label="Nomor HP">
              <ReadOnlyValue value={vicePhone} />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-3 py-1 text-xs font-semibold text-primary">
            <Users className="h-3.5 w-3.5" />
            Konsentrasi Keahlian
          </p>
          <span className="text-xs text-slate-500">
            Total {profile.concentrations.length} program keahlian
          </span>
        </div>
        {profile.concentrations.length === 0 ? (
          <p className="text-sm italic text-slate-400">Belum ada data konsentrasi keahlian sekolah.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profile.concentrations.map((kk) => {
              const totalRombel =
                (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
              const totalSiswa =
                (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
              return (
                <div
                  key={kk.code}
                  className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                >
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
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                        Rombel
                      </p>
                      <p className="mt-0.5 font-semibold text-slate-900">{totalRombel}</p>
                    </div>
                    <div className="rounded-xl border border-white bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                        Siswa
                      </p>
                      <p className="mt-0.5 font-semibold text-slate-900">
                        {totalSiswa.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentCard({
  doc,
  onPreview,
}: {
  doc: SchoolAdministrativeDocumentRecord;
  onPreview: (doc: SchoolAdministrativeDocumentRecord, idx?: number) => void;
}) {
  const listFiles: Array<{
    url: string;
    name: string;
    mimeType: string;
    size: number;
    uploadedAt: string | null;
    id: string | number;
  }> =
    doc.files && doc.files.length > 0
      ? doc.files.map((f, idx) => ({
          url: f.filePath,
          name: f.fileName,
          mimeType: f.mimeType || doc.mimeType || "",
          size: f.fileSize || doc.fileSize || 0,
          uploadedAt: f.uploadedAt || doc.uploadedAt || null,
          id: f.id || idx,
        }))
      : doc.filePath
        ? [
            {
              url: doc.filePath,
              name: doc.fileName || doc.name,
              mimeType: doc.mimeType || "",
              size: doc.fileSize || 0,
              uploadedAt: doc.uploadedAt || null,
              id: "single",
            },
          ]
        : [];

  const formatDownloadArr = DOCUMENT_FORMAT_DOWNLOADS[doc.code];
  const formatDownload = Array.isArray(formatDownloadArr) && formatDownloadArr.length > 0 ? formatDownloadArr[0] : undefined;
  const labelName = resolveAdministrativeDocLabel(doc.code);

  return (
    <div
      className={cn(
        "rounded-[20px] border p-5 transition",
        doc.uploaded
          ? "border-emerald-200 bg-white"
          : "border-dashed border-slate-300 bg-slate-50/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-xs font-bold text-slate-600">
            {String(doc.no).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{labelName}</p>
            <p className="mt-1 text-xs text-slate-500">
              {listFiles[0]?.name
                ? `${listFiles[0].name} • ${formatFileSize(listFiles[0]?.size || 0)}`
                : doc.fileName
                  ? `${doc.fileName} • ${formatFileSize(doc.fileSize || 0)}`
                  : "Belum ada berkas yang diunggah"}
              {listFiles[0]?.uploadedAt ? ` • Diupload: ${formatDateTime(new Date(listFiles[0].uploadedAt))}` : doc.uploadedAt ? ` • Diupload: ${formatDateTime(new Date(doc.uploadedAt))}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {doc.required ? (
            <Badge className="border-rose-200 bg-rose-50 text-rose-700" variant="outline">
              WAJIB
            </Badge>
          ) : null}
          <Badge
            className={cn(
              "border",
              doc.uploaded
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
            variant="outline"
          >
            {doc.uploaded ? "Sudah Diupload" : "Belum Diupload"}
          </Badge>
          {doc.allowMultiple ? (
            <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">
              {doc.files?.length ?? 0} / {doc.maxFiles ?? 1} file
            </Badge>
          ) : null}
        </div>
      </div>

      {doc.uploaded && listFiles.length > 1 ? (
        <div className="grid gap-2 grid-cols-5 mb-4">
          {listFiles.map((f, idx) => {
            const mime = f.mimeType;
            const img = isImage(mime);
            const pdf = isPdf(mime);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onPreview(doc, idx)}
                className="group relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-primary/50 hover:ring-2 hover:ring-primary/20"
                title={`Preview: ${f.name}`}
              >
                {img ? (
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                ) : pdf ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                    <FileText className="h-7 w-7 text-rose-500" />
                    <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
                      PDF
                    </span>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                    <FileDown className="h-7 w-7 text-slate-500" />
                    <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
                      {f.name.split(".").pop()?.toUpperCase() || "FILE"}
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] font-semibold text-white/95 opacity-90">
                  <span className="truncate">{String(idx + 1).padStart(2, "0")}</span>
                  <Eye className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {formatDownload ? (
            <a
              href={`${FORMAT_FILES_BASE_PATH}/${formatDownload.fileName}`}
              download={formatDownload.fileName}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-indigo-200 bg-white text-indigo-700"
              >
                <FileDown className="h-3.5 w-3.5 shrink-0" />
                <span>Format</span>
              </Button>
            </a>
          ) : null}
          {doc.uploaded && listFiles.length > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-slate-200 bg-white text-slate-700"
                onClick={() => onPreview(doc, 0)}
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>Preview</span>
              </Button>
              <a
                href={listFiles[0].url}
                target="_blank"
                rel="noreferrer"
                download={listFiles[0].name}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-slate-200 bg-white text-slate-700"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0" />
                  <span>Unduh</span>
                </Button>
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function FacilitatorAdministrasiVerifikasiDetailPage({ npsn }: { npsn: string }) {
  const { hydrate, hydrated, session } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [documents, setDocuments] = useState<SchoolAdministrativeDocumentRecord[]>([]);
  const [assignment, setAssignment] = useState<WorkspaceAssignmentRecord | null>(null);
  const [existingReview, setExistingReview] = useState<WorkspaceVerifikasiOnlineRecord | null>(null);

  const [reviewDraft, setReviewDraft] = useState<DetailReviewDraftStruct>({
    version: 2,
    globalNote: "",
    globalStatus: null,
    globalReviewNotes: { ...fallbackGlobalNotes },
    dataSekolah: { ...fallbackDataSekolahNotes },
    dokumenAdministrasi: { ...fallbackDokumenNotes },
    concentrations: {},
    documents: {},
    conditions: {},
    proposals: {},
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [docPreview, setDocPreview] = useState<{
    docName: string;
    docCode: string;
    files: Array<{
      url: string;
      name: string;
      mimeType: string;
      size: number;
      uploadedAt: string | null;
    }>;
    index: number;
  } | null>(null);

  const dataSekolahNoteRef = useRef<HTMLTextAreaElement>(null);
  const dokumenAdminNoteRef = useRef<HTMLTextAreaElement>(null);
  const konsentrasiNoteRef = useRef<HTMLTextAreaElement>(null);
  const globalNoteRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<"data" | "dokumen" | "konsentrasi">("data");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (docPreview) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setDocPreview(null);
        if (e.key === "ArrowRight")
          setDocPreview((p) =>
            p && p.files.length > 1 ? { ...p, index: (p.index + 1) % p.files.length } : p,
          );
        if (e.key === "ArrowLeft")
          setDocPreview((p) =>
            p && p.files.length > 1
              ? { ...p, index: (p.index - 1 + p.files.length) % p.files.length }
              : p,
          );
      };
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [docPreview]);

  async function loadDetail(showRefresh = false) {
    if (!hydrated || !session?.token || !npsn) {
      setLoading(false);
      return;
    }
    if (showRefresh) setRefreshing(true);
    setLoading(true);
    setLoadError("");

    const token = session.token;
    try {
      const results = await Promise.allSettled([
        schoolProfileByNpsnRequest(token, npsn),
        schoolAdministrativeDocumentsByNpsnRequest(token, npsn),
        workspaceAssignmentsRequest(token, {
          moduleKey: "verifikasi-online",
          facilitatorAdministrationId: session.user.id || undefined,
          schoolNpsn: npsn,
        }),
        workspaceVerifikasiOnlineReviewsRequest(token, { schoolNpsn: npsn }),
      ]);

      const profileRes = results[0].status === "fulfilled" ? results[0].value : null;
      const docRes = results[1].status === "fulfilled" ? results[1].value : [];
      const assignments = results[2].status === "fulfilled" ? results[2].value : [];
      const reviews = results[3].status === "fulfilled" ? results[3].value : [];

      if (!profileRes) {
        const firstError =
          results[0].status === "rejected"
            ? results[0].reason instanceof Error
              ? results[0].reason.message
              : String(results[0].reason)
            : null;
        throw new Error(firstError ?? "Data sekolah tidak ditemukan / NPSN tidak terdaftar.");
      }

      const filteredDocs = docRes.filter((d) =>
        ADMINISTRATIVE_DOCUMENT_UMUM_CODES.includes(d.code),
      );
      setDocuments(filteredDocs.length ? filteredDocs : docRes.slice(0, 13));
      setProfile(profileRes);

      const matchedAssignment = assignments.find(
        (r) => r.schoolNpsn === npsn && r.moduleKey === "verifikasi-online",
      );
      setAssignment(matchedAssignment ?? null);

      const review = reviews.find((r) => r.schoolNpsn === npsn) ?? null;
      setExistingReview(review);
      setReviewDraft(tryParseDetailStruct(review?.reviewNoteAdmin));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal memuat detail sekolah.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDetail(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn]);

  const proposalBundle = useMemo(
    () => (null as unknown as { tables?: Record<string, unknown> } | null),
    [],
  );

  const schoolName = profile?.schoolName || assignment?.schoolName || "Memuat...";

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4500);
  }

  async function persistApproval(options?: {
    dataSekolahStatus?: ReviewItemStatus;
    dataSekolahReviewSource?: "approved" | "note_required" | "pending" | "rejected";
    dokumenAdministrasiStatus?: ReviewItemStatus;
    dokumenAdministrasiReviewSource?: "approved" | "note_required" | "pending" | "rejected";
    konsentrasiStatus?: ReviewItemStatus;
    konsentrasiReviewSource?: "approved" | "note_required" | "pending" | "rejected";
    globalStatus?: ReviewItemStatus;
    globalReviewSource?: "approved" | "note_required" | "pending" | "rejected";
    requireNoteRef?: React.RefObject<HTMLTextAreaElement | null>;
  }) {
    if (!session?.token) return;
    const targetNpsn = profile?.npsn || npsn;
    const targetSchoolName = profile?.schoolName || assignment?.schoolName || "";
    if (!targetNpsn) return;

    if (options?.requireNoteRef?.current) {
      options.requireNoteRef.current.focus();
      options.requireNoteRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const nextDraft: DetailReviewDraftStruct = JSON.parse(JSON.stringify(reviewDraft));
    if (typeof options?.dataSekolahStatus !== "undefined") {
      const chosenSourceKey = options?.dataSekolahReviewSource;
      const sourceNote = chosenSourceKey
        ? nextDraft.dataSekolah.reviewNotes[chosenSourceKey]
        : nextDraft.dataSekolah.note;
      nextDraft.dataSekolah = {
        ...nextDraft.dataSekolah,
        status: options.dataSekolahStatus,
        note: sourceNote && sourceNote.trim().length > 0 ? sourceNote : nextDraft.dataSekolah.note,
      };
    }
    if (typeof options?.dokumenAdministrasiStatus !== "undefined") {
      const chosenSourceKey = options?.dokumenAdministrasiReviewSource;
      const sourceNote = chosenSourceKey
        ? nextDraft.dokumenAdministrasi.reviewNotes[chosenSourceKey]
        : nextDraft.dokumenAdministrasi.note;
      nextDraft.dokumenAdministrasi = {
        ...nextDraft.dokumenAdministrasi,
        status: options.dokumenAdministrasiStatus,
        note: sourceNote && sourceNote.trim().length > 0 ? sourceNote : nextDraft.dokumenAdministrasi.note,
      };
    }
    if (typeof options?.konsentrasiStatus !== "undefined") {
      const chosenSourceKey = options?.konsentrasiReviewSource;
      const existingKkGlobal = nextDraft.concentrations["_global"] ?? {
        status: null,
        note: "",
        reviewNotes: { ...emptyReviewNotes },
      };
      const sourceNote = chosenSourceKey
        ? existingKkGlobal.reviewNotes[chosenSourceKey]
        : existingKkGlobal.note;
      nextDraft.concentrations = {
        ...nextDraft.concentrations,
        _global: {
          ...existingKkGlobal,
          status: options.konsentrasiStatus,
          note: sourceNote && sourceNote.trim().length > 0 ? sourceNote : existingKkGlobal.note,
        },
      };
    }
    if (typeof options?.globalStatus !== "undefined") {
      const chosenSourceKey = options?.globalReviewSource;
      nextDraft.globalStatus = options.globalStatus;
      if (chosenSourceKey) {
        const sourceNote = nextDraft.globalReviewNotes[chosenSourceKey];
        if (sourceNote && sourceNote.trim().length > 0) {
          const base = nextDraft.globalNote && nextDraft.globalNote.trim().length > 0 ? `${nextDraft.globalNote} · ` : "";
          nextDraft.globalNote = `${base}${sourceNote}`;
        } else {
          const picks: string[] = [];
          for (const item of [nextDraft.dataSekolah, nextDraft.dokumenAdministrasi]) {
            const v = item.reviewNotes[chosenSourceKey];
            if (v && v.trim().length > 0) picks.push(v);
          }
          if (picks.length > 0) {
            const base = nextDraft.globalNote && nextDraft.globalNote.trim().length > 0 ? `${nextDraft.globalNote} · ` : "";
            nextDraft.globalNote = `${base}${picks.join(" · ")}`;
          }
        }
      }
    }

    setReviewDraft(nextDraft);
    setSaving(true);

    try {
      const token = session.token;
      let approvedAdmin: boolean | null = existingReview?.approvedAdmin ?? null;
      if (typeof options?.globalStatus !== "undefined") {
        approvedAdmin =
          options.globalStatus === "approved"
            ? true
            : options.globalStatus === "rejected"
              ? false
              : null;
      }
      const result = await upsertWorkspaceVerifikasiOnlineReviewRequest(token, {
        schoolNpsn: targetNpsn,
        schoolName: targetSchoolName,
        reviewerRole: "ADMINISTRASI",
        reviewerId: session.user.id,
        reviewerName: session.user.fullName,
        reviewNote: serializeDetailStruct(nextDraft),
        approved: approvedAdmin,
        updatedAt: new Date().toISOString(),
      });
      if (result) {
        setExistingReview(result);
      }
      showToast("success", "Status verifikasi administrasi berhasil disimpan.");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Gagal menyimpan verifikasi administrasi.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openDocPreview(doc: SchoolAdministrativeDocumentRecord, startIndex = 0) {
    const list =
      doc.files && doc.files.length > 0
        ? doc.files.map((f) => ({
            url: f.filePath,
            name: f.fileName,
            mimeType: f.mimeType || doc.mimeType || "",
            size: f.fileSize || doc.fileSize || 0,
            uploadedAt: f.uploadedAt || doc.uploadedAt || null,
          }))
        : doc.filePath
          ? [
              {
                url: doc.filePath,
                name: doc.fileName || doc.name,
                mimeType: doc.mimeType || "",
                size: doc.fileSize || 0,
                uploadedAt: doc.uploadedAt || null,
              },
            ]
          : [];
    if (!list.length) return;
    setDocPreview({
      docName: resolveAdministrativeDocLabel(doc.code),
      docCode: doc.code,
      files: list,
      index: Math.max(0, Math.min(startIndex, list.length - 1)),
    });
  }

  function currentPreviewFile() {
    if (!docPreview) return null;
    return docPreview.files[docPreview.index] ?? null;
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 border-slate-200 bg-white"
            >
              <Link href="/fasilitator-administrasi/verifikasi-online">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar
              </Link>
            </Button>
            <Badge
              className="border border-primary/20 bg-primary/[0.08] text-primary"
              variant="outline"
            >
              <Building2 className="mr-2 h-3.5 w-3.5" />
              {session?.user.fullName || "Fasilitator Administrasi"}
            </Badge>
            <Badge
              className={cn(
                "border",
                reviewStatusVariant(
                  existingReview?.approvedAdmin === true
                    ? "approved"
                    : existingReview?.approvedAdmin === false
                      ? "rejected"
                      : reviewDraft.globalStatus,
                ),
              )}
              variant="outline"
            >
              <Gauge className="mr-1.5 h-3 w-3" />
              Status Global:{" "}
              {reviewStatusLabel(
                existingReview?.approvedAdmin === true
                  ? "approved"
                  : existingReview?.approvedAdmin === false
                    ? "rejected"
                    : reviewDraft.globalStatus,
              )}
            </Badge>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{schoolName}</h1>
            <p className="mt-1 text-sm text-slate-600">
              NPSN <span className="font-mono font-bold text-slate-900">{npsn}</span>
              {existingReview?.reviewedAdminAt ? (
                <span className="ml-3 text-slate-500">
                  Terakhir review: {formatDateTime(new Date(existingReview.reviewedAdminAt))}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadDetail(true)}
          disabled={refreshing || loading}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-14 text-center text-sm text-slate-500">
          Memuat detail sekolah & dokumen administrasi...
        </div>
      ) : loadError ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {loadError}
        </div>
      ) : !profile ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-sm text-slate-500">
          Data sekolah tidak ditemukan.
        </div>
      ) : (
        <>
          <Card className="rounded-[28px] border-slate-200">
            <CardContent className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap rounded-2xl bg-slate-100 p-1">
                {([
                  { key: "data", label: "Data Sekolah", icon: <Building2 className="h-3.5 w-3.5" /> },
                  { key: "dokumen", label: "Dokumen Administrasi", icon: <FileText className="h-3.5 w-3.5" /> },
                  { key: "konsentrasi", label: "Konsentrasi Keahlian", icon: <Users className="h-3.5 w-3.5" /> },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                      activeTab === tab.key ? "bg-white text-primary shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn("border shrink-0", reviewStatusVariant(reviewDraft.dataSekolah.status))}
                  variant="outline"
                >
                  Data Sekolah · {reviewStatusLabel(reviewDraft.dataSekolah.status)}
                </Badge>
                <Badge
                  className={cn("border shrink-0", reviewStatusVariant(reviewDraft.dokumenAdministrasi.status))}
                  variant="outline"
                >
                  Dok. Adm · {reviewStatusLabel(reviewDraft.dokumenAdministrasi.status)}
                </Badge>
                <Badge
                  className={cn(
                    "border shrink-0",
                    reviewStatusVariant(reviewDraft.concentrations["_global"]?.status ?? null),
                  )}
                  variant="outline"
                >
                  KK · {reviewStatusLabel(reviewDraft.concentrations["_global"]?.status ?? null)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {activeTab === "data" ? (
            <Card className="overflow-hidden rounded-[28px] border-slate-200">
              <CardHeader className="bg-white px-6 pt-6 pb-0">
                <ApprovalSectionHeader
                  title="Verifikasi · Data Sekolah"
                  description="Verifikasi identitas sekolah, wilayah, struktur organisasi, Kepsek/Wakasek dan detail profil sekolah."
                  icon={<Building2 className="h-5 w-5" />}
                  status={reviewDraft.dataSekolah.status}
                />
              </CardHeader>
              <CardContent className="space-y-6 px-6 pb-6">
                <VerifikasiDetailStatCards
                  profile={profile}
                  documents={documents}
                  proposalBundle={proposalBundle}
                />
                <DataSekolahSummaryBody profile={profile} />

                <div className="rounded-[22px] border border-dashed border-primary/30 bg-primary/[0.03] p-5 space-y-4">
                  <label className="grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <MessageSquareWarning className="h-4 w-4 text-primary" />
                      Beri Komentar
                    </span>
                    <textarea
                      ref={dataSekolahNoteRef}
                      rows={3}
                      className={cn(inputBase, "resize-y bg-white")}
                      placeholder="Tulis catatan / komentar untuk verifikasi Data Sekolah ini. Wajib diisi ketika memilih 'Setujui dengan Catatan', 'Perbaiki', atau 'Tolak'."
                      value={reviewDraft.dataSekolah.note}
                      onChange={(e) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          dataSekolah: { ...prev.dataSekolah, note: e.target.value },
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">
                      {reviewDraft.dataSekolah.note.trim().length} karakter
                    </p>
                  </label>
                  <FourApprovalButtons
                    value={reviewDraft.dataSekolah.status}
                    onChange={(s) =>
                      void persistApproval({
                        dataSekolahStatus: s,
                      })
                    }
                    onNoteRequire={() => {
                      dataSekolahNoteRef.current?.focus();
                    }}
                    disabled={saving}
                  />
                  {saving ? (
                    <p className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan status verifikasi Data Sekolah...
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "dokumen" ? (
            <Card className="overflow-hidden rounded-[28px] border-slate-200">
              <CardHeader className="bg-white px-6 pt-6 pb-0">
                <ApprovalSectionHeader
                  title="Verifikasi · Dokumen Administrasi"
                  description="Verifikasi kelengkapan berkas administrasi sekolah. Setiap dokumen dapat di-preview / di-unduh langsung."
                  icon={<FileText className="h-5 w-5" />}
                  status={reviewDraft.dokumenAdministrasi.status}
                />
              </CardHeader>
              <CardContent className="space-y-6 px-6 pb-6">
                {documents.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    Belum ada data dokumen administrasi untuk sekolah ini.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <DocumentCard key={doc.code} doc={doc} onPreview={openDocPreview} />
                    ))}
                  </div>
                )}

                <div className="rounded-[22px] border border-dashed border-primary/30 bg-primary/[0.03] p-5 space-y-4">
                  <label className="grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <MessageSquareWarning className="h-4 w-4 text-primary" />
                      Beri Komentar
                    </span>
                    <textarea
                      ref={dokumenAdminNoteRef}
                      rows={3}
                      className={cn(inputBase, "resize-y bg-white")}
                      placeholder="Tulis catatan / komentar untuk verifikasi Dokumen Administrasi ini. Wajib diisi ketika memilih 'Setujui dengan Catatan', 'Perbaiki', atau 'Tolak'."
                      value={reviewDraft.dokumenAdministrasi.note}
                      onChange={(e) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          dokumenAdministrasi: {
                            ...prev.dokumenAdministrasi,
                            note: e.target.value,
                          },
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">
                      {reviewDraft.dokumenAdministrasi.note.trim().length} karakter
                    </p>
                  </label>
                  <FourApprovalButtons
                    value={reviewDraft.dokumenAdministrasi.status}
                    onChange={(s) =>
                      void persistApproval({
                        dokumenAdministrasiStatus: s,
                      })
                    }
                    onNoteRequire={() => {
                      dokumenAdminNoteRef.current?.focus();
                    }}
                    disabled={saving}
                  />
                  {saving ? (
                    <p className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan status verifikasi Dokumen Administrasi...
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "konsentrasi" ? (
            <Card className="overflow-hidden rounded-[28px] border-slate-200">
              <CardHeader className="bg-white px-6 pt-6 pb-0">
                <ApprovalSectionHeader
                  title="Verifikasi · Konsentrasi Keahlian"
                  description="Verifikasi kelengkapan data konsentrasi keahlian: rombongan belajar, jumlah siswa per kelas, serta luas ruang praktik."
                  icon={<Users className="h-5 w-5" />}
                  status={reviewDraft.concentrations["_global"]?.status ?? null}
                />
              </CardHeader>
              <CardContent className="space-y-6 px-6 pb-6">
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-3 py-1 text-xs font-semibold text-primary">
                      <Users className="h-3.5 w-3.5" /> Konsentrasi Keahlian
                    </p>
                    <span className="text-xs text-slate-500">
                      Total {profile.concentrations.length} program keahlian
                    </span>
                  </div>
                  {profile.concentrations.length === 0 ? (
                    <p className="text-sm italic text-slate-400">
                      Belum ada data konsentrasi keahlian sekolah.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {profile.concentrations
                        .slice()
                        .sort((a, b) => compareConcentrationCode(a.code, b.code))
                        .map((kk) => {
                          const totalRombel =
                            (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
                          const totalSiswa =
                            (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
                          return (
                            <div
                              key={kk.code}
                              className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                            >
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
                              <p className="text-sm font-semibold text-slate-950">
                                {concentrationNameOf(kk)}
                              </p>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded-xl border border-white bg-white px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                                    X (R/S)
                                  </p>
                                  <p className="mt-0.5 font-semibold text-slate-900">
                                    {kk.rombel10 ?? 0} / {kk.student10 ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-white bg-white px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                                    XI (R/S)
                                  </p>
                                  <p className="mt-0.5 font-semibold text-slate-900">
                                    {kk.rombel11 ?? 0} / {kk.student11 ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-white bg-white px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                                    XII (R/S)
                                  </p>
                                  <p className="mt-0.5 font-semibold text-slate-900">
                                    {kk.rombel12 ?? 0} / {kk.student12 ?? 0}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl border border-white bg-white px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                                    Total Rombel
                                  </p>
                                  <p className="mt-0.5 font-semibold text-slate-900">{totalRombel}</p>
                                </div>
                                <div className="rounded-xl border border-white bg-white px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                                    Total Siswa
                                  </p>
                                  <p className="mt-0.5 font-semibold text-slate-900">
                                    {totalSiswa.toLocaleString("id-ID")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="rounded-[22px] border border-dashed border-primary/30 bg-primary/[0.03] p-5 space-y-4">
                  <label className="grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <MessageSquareWarning className="h-4 w-4 text-primary" />
                      Beri Komentar
                    </span>
                    <textarea
                      ref={konsentrasiNoteRef}
                      rows={3}
                      className={cn(inputBase, "resize-y bg-white")}
                      placeholder="Tulis catatan / komentar untuk verifikasi Konsentrasi Keahlian ini. Wajib diisi ketika memilih 'Setujui dengan Catatan', 'Perbaiki', atau 'Tolak'."
                      value={reviewDraft.concentrations["_global"]?.note ?? ""}
                      onChange={(e) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          concentrations: {
                            ...prev.concentrations,
                            _global: {
                              status: prev.concentrations["_global"]?.status ?? null,
                              note: e.target.value,
                              reviewNotes:
                                prev.concentrations["_global"]?.reviewNotes ?? { ...emptyReviewNotes },
                            },
                          },
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">
                      {(reviewDraft.concentrations["_global"]?.note ?? "").trim().length} karakter
                    </p>
                  </label>
                  <FourApprovalButtons
                    value={reviewDraft.concentrations["_global"]?.status ?? null}
                    onChange={(s) =>
                      void persistApproval({
                        konsentrasiStatus: s,
                      })
                    }
                    onNoteRequire={() => {
                      konsentrasiNoteRef.current?.focus();
                    }}
                    disabled={saving}
                  />
                  {saving ? (
                    <p className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan status verifikasi Konsentrasi Keahlian...
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden rounded-[28px] border-2 border-primary/20 bg-gradient-to-b from-primary/[0.04] to-white">
            <CardHeader className="px-6 pt-6 pb-0">
              <ApprovalSectionHeader
                title="Catatan &amp; Status Akhir Verifikasi Administrasi"
                description="Keputusan akhir untuk proses verifikasi administrasi secara keseluruhan pada sekolah ini."
                icon={<BadgeCheck className="h-5 w-5" />}
                status={
                  existingReview?.approvedAdmin === true
                    ? "approved"
                    : existingReview?.approvedAdmin === false
                      ? "rejected"
                      : reviewDraft.globalStatus
                }
              />
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Ringkasan Per-Tab
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge
                      className={cn("border", reviewStatusVariant(reviewDraft.dataSekolah.status))}
                      variant="outline"
                    >
                      Data Sekolah: {reviewStatusLabel(reviewDraft.dataSekolah.status)}
                    </Badge>
                    <Badge
                      className={cn(
                        "border",
                        reviewStatusVariant(reviewDraft.dokumenAdministrasi.status),
                      )}
                      variant="outline"
                    >
                      Dok Adm: {reviewStatusLabel(reviewDraft.dokumenAdministrasi.status)}
                    </Badge>
                    <Badge
                      className={cn(
                        "border",
                        reviewStatusVariant(reviewDraft.concentrations["_global"]?.status ?? null),
                      )}
                      variant="outline"
                    >
                      KK: {reviewStatusLabel(reviewDraft.concentrations["_global"]?.status ?? null)}
                    </Badge>
                  </div>
                  {existingReview?.reviewedEquipmentName ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Fasil Alat: {existingReview.reviewedEquipmentName} •{" "}
                      {existingReview.reviewedEquipmentAt
                        ? formatDateTime(new Date(existingReview.reviewedEquipmentAt))
                        : ""}
                    </p>
                  ) : null}
                </div>
                <label className="grid gap-1.5 rounded-[20px] border border-primary/15 bg-white p-5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <MessageSquareWarning className="h-4 w-4 text-primary" />
                    Catatan Akhir Verifikasi Administrasi
                  </span>
                  <textarea
                    ref={globalNoteRef}
                    rows={3}
                    className={cn(inputBase, "resize-y bg-slate-50")}
                    placeholder="Catatan akhir keseluruhan untuk verifikasi administrasi sekolah ini..."
                    value={reviewDraft.globalNote}
                    onChange={(e) =>
                      setReviewDraft((prev) => ({ ...prev, globalNote: e.target.value }))
                    }
                  />
                  <p className="text-xs text-slate-500">
                    {reviewDraft.globalNote.trim().length} karakter
                  </p>
                </label>
              </div>

              <FourApprovalButtons
                value={
                  existingReview?.approvedAdmin === true
                    ? "approved"
                    : existingReview?.approvedAdmin === false
                      ? "rejected"
                      : reviewDraft.globalStatus
                }
                onChange={(s) =>
                  void persistApproval({
                    globalStatus: s,
                  })
                }
                onNoteRequire={() => {
                  globalNoteRef.current?.focus();
                }}
                disabled={saving}
              />
              {saving ? (
                <p className="text-sm font-semibold text-primary inline-flex items-center gap-2 pt-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan keputusan akhir verifikasi administrasi...
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      {docPreview && currentPreviewFile() ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setDocPreview(null)}
        >
          <div
            className="relative w-full max-w-[98vw] rounded-[22px] bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {docPreview.docName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentPreviewFile()!.name} • {formatFileSize(currentPreviewFile()!.size || 0)}
                  {currentPreviewFile()!.uploadedAt ? (
                    <>
                      {" • Diupload: "}
                      {formatDateTime(new Date(currentPreviewFile()!.uploadedAt!))}
                    </>
                  ) : null}
                  {" • File "}
                  <span className="font-semibold text-slate-700">
                    {docPreview.index + 1} / {docPreview.files.length}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={currentPreviewFile()!.url}
                  download={currentPreviewFile()!.name}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0" />
                  <span>Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDocPreview(null)}
                  aria-label="Tutup preview"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              {docPreview.files.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDocPreview((p) =>
                      p && p.files.length > 1
                        ? { ...p, index: (p.index - 1 + p.files.length) % p.files.length }
                        : p,
                    )
                  }
                  aria-label="File sebelumnya"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:h-11 sm:w-11"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
              ) : null}

              <div className="max-h-[82vh] overflow-auto bg-slate-100">
                <div className="flex min-h-[60vh] items-center justify-center p-3 sm:p-5">
                  {(() => {
                    const f = currentPreviewFile()!;
                    const mime = f.mimeType;
                    if (isImage(mime)) {
                      return (
                        <img
                          src={f.url}
                          alt={f.name}
                          className="max-h-[78vh] w-auto max-w-[94vw] rounded-xl border border-slate-200 bg-white shadow-xl object-contain"
                        />
                      );
                    }
                    if (isPdf(mime)) {
                      return (
                        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          <iframe src={f.url} title={f.name} className="h-[78vh] w-full" />
                        </div>
                      );
                    }
                    const ext = f.name.split(".").pop()?.toLowerCase();
                    const canInlineIframe = ext && /^html?$/i.test(ext);
                    if (canInlineIframe) {
                      return (
                        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          <iframe src={f.url} title={f.name} className="h-[78vh] w-full" />
                        </div>
                      );
                    }
                    return (
                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                          <FileText className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{f.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Format file tidak dapat dipreview langsung. Silakan unduh untuk membuka.
                        </p>
                        <a
                          href={f.url}
                          download={f.name}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <FileDown className="h-4 w-4 shrink-0" />
                          <span>Unduh File</span>
                        </a>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {docPreview.files.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDocPreview((p) =>
                      p && p.files.length > 1
                        ? { ...p, index: (p.index + 1) % p.files.length }
                        : p,
                    )
                  }
                  aria-label="File selanjutnya"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:h-11 sm:w-11"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                </button>
              ) : null}
            </div>

            {docPreview.files.length > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Gunakan tombol ← → atau Arrow Left / Right Keyboard • Escape tutup
                </p>
                <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[70%] overflow-x-auto">
                  {docPreview.files.map((f, idx) => {
                    const active = idx === docPreview.index;
                    const mime = f.mimeType;
                    const img = isImage(mime);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setDocPreview((p) => (p ? { ...p, index: idx } : p))
                        }
                        className={cn(
                          "relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border transition",
                          active
                            ? "ring-2 ring-primary border-primary/60"
                            : "border-slate-200 hover:border-slate-400",
                        )}
                        title={`${idx + 1}. ${f.name}`}
                      >
                        {img ? (
                          <img src={f.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-50 text-[9px] font-bold text-slate-600">
                            {idx + 1}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-xl",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ) : null}
    </div>
  );
}
