"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import {
  fetchCachedDetailPraBimtekByNpsn,
  fetchCachedPerdirjenBidangBatch,
  fetchCachedVerifikasiReviews,
  invalidateDetailPraBimtekCache,
  writeThroughVerifikasiReviewCache,
} from "@/lib/school-verifikasi-cache";
import {
  BodyTabSkeleton,
  DetailTabLazyWrap,
} from "./fasilitator-detail-tabs-lazy";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Blocks,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock4,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Gauge,
  Home,
  Loader2,
  MessageSquareWarning,
  NotebookPen,
  Pencil,
  Printer,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Users,
  Wrench,
  XCircle,
  Image as ImageIcon,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  perdirjenEquipmentBidangRequest,
  buildRpsDocumentCode,
  isRpsDocumentCode,
  schoolAdministrativeDocumentsByNpsnRequest,
  schoolProfileByNpsnRequest,
  upsertWorkspaceVerifikasiOnlineReviewRequest,
  workspaceAdminSelectionRequest,
  workspaceAssignmentsRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type PerdirjenEquipmentDetailBidang,
  type PerdirjenEquipmentDetailKonsentrasi,
  type PerdirjenEquipmentItem,
  type PerdirjenEquipmentSummary,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileRecord,
  type WorkspaceAdminSelectionData,
  type WorkspaceAssignmentRecord,
  type WorkspaceBimtekReviewRecord,
  type WorkspaceSchoolEquipmentData,
  type WorkspaceSchoolProposalData,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import {
  buildSchoolProposalBundleFromWorkspaceData,
  computePraBimtekCompletion,
  type PraBimtekCompletionResult,
  type PraBimtekCompletionStatus,
} from "@/lib/facilitator-workspace";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { SchoolRpdPksDocumentEditor } from "@/components/school/school-rpd-pks-document-editor";

type SectionStatus = "approved" | "note_required" | "pending" | "rejected";
type ReviewItemStatus = "approved" | "pending" | "rejected" | null;

interface PerItemDraft {
  status: ReviewItemStatus;
  note: string;
}

interface PerKkDraft {
  konsentrasi: PerItemDraft;
  sarana: PerItemDraft;
  pengajuan: PerItemDraft;
}

interface AlatReviewDetailStruct {
  version: 3;
  globalNote: string;
  globalStatus: ReviewItemStatus;
  konsentrasi: PerItemDraft;
  kondisi: PerItemDraft;
  ajuan: PerItemDraft;
  perKk: Record<string, PerKkDraft>;
}

const fallbackPerKkDraft = (): PerKkDraft => ({
  konsentrasi: { status: null, note: "" },
  sarana: { status: null, note: "" },
  pengajuan: { status: null, note: "" },
});

const fallbackDraft: AlatReviewDetailStruct = {
  version: 3,
  globalNote: "",
  globalStatus: null,
  konsentrasi: { status: null, note: "" },
  kondisi: { status: null, note: "" },
  ajuan: { status: null, note: "" },
  perKk: {},
};

function aggregateFromPerKk(
  perKk: Record<string, PerKkDraft>,
  section: keyof PerKkDraft,
  fallback: PerItemDraft,
): PerItemDraft {
  const entries = Object.entries(perKk);
  if (!entries.length) return fallback;
  const items = entries.map(([, v]) => v[section]);
  const statuses = items.map((i) => i.status);
  let agg: ReviewItemStatus;
  if (statuses.every((s) => s === "approved")) agg = "approved";
  else if (statuses.some((s) => s === "rejected")) agg = "rejected";
  else if (statuses.some((s) => s === "pending")) agg = "pending";
  else if (statuses.some((s) => s === "approved")) agg = "approved";
  else return fallback;
  const notes = entries
    .filter(([, v]) => v[section].note.trim())
    .map(([code, v]) => `• ${code}: ${v[section].note.trim()}`)
    .join("\n");
  return { status: agg, note: notes || fallback.note };
}

const inputBase =
  "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

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

function tryParseAlatDetail(input: string | null | undefined): AlatReviewDetailStruct {
  const seed: AlatReviewDetailStruct = JSON.parse(JSON.stringify(fallbackDraft));
  if (!input) return seed;
  const trimmed = input.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ...seed, globalNote: trimmed };
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<AlatReviewDetailStruct> & {
      cardStatus?: { konsentrasi?: unknown; kondisi?: unknown; pengajuan?: unknown };
      cardNote?: { konsentrasi?: string; kondisi?: string; pengajuan?: string; global?: string };
      perKk?: Record<string, PerKkDraft>;
    };
    const statusFrom = (v: unknown) =>
      v === "approved" || v === "pending" || v === "rejected" ? (v as ReviewItemStatus) : null;

    if (parsed.version === 3 && typeof parsed.perKk === "object") {
      return {
        version: 3,
        globalNote: parsed.globalNote ?? "",
        globalStatus: statusFrom(parsed.globalStatus),
        konsentrasi: {
          status: statusFrom(parsed.konsentrasi?.status),
          note: (parsed.konsentrasi as PerItemDraft)?.note ?? "",
        },
        kondisi: {
          status: statusFrom(parsed.kondisi?.status),
          note: (parsed.kondisi as PerItemDraft)?.note ?? "",
        },
        ajuan: {
          status: statusFrom(parsed.ajuan?.status),
          note: (parsed.ajuan as PerItemDraft)?.note ?? "",
        },
        perKk: parsed.perKk ?? {},
      };
    }
    const v2global = parsed as Partial<AlatReviewDetailStruct>;
    const kStatus =
      (parsed as Partial<AlatReviewDetailStruct>)?.konsentrasi?.status ??
      statusFrom(parsed.cardStatus?.konsentrasi) ??
      null;
    const kNote =
      (parsed as Partial<AlatReviewDetailStruct>)?.konsentrasi?.note ??
      parsed.cardNote?.konsentrasi ??
      "";
    const oStatus =
      (parsed as Partial<AlatReviewDetailStruct>)?.kondisi?.status ??
      statusFrom(parsed.cardStatus?.kondisi) ??
      null;
    const oNote =
      (parsed as Partial<AlatReviewDetailStruct>)?.kondisi?.note ??
      parsed.cardNote?.kondisi ??
      "";
    const aStatus =
      (parsed as Partial<AlatReviewDetailStruct>)?.ajuan?.status ??
      statusFrom(parsed.cardStatus?.pengajuan) ??
      null;
    const aNote =
      (parsed as Partial<AlatReviewDetailStruct>)?.ajuan?.note ??
      parsed.cardNote?.pengajuan ??
      "";
    const out: AlatReviewDetailStruct = {
      version: 3,
      globalNote: v2global.globalNote ?? parsed.cardNote?.global ?? "",
      globalStatus: statusFrom(v2global.globalStatus ?? null),
      konsentrasi: { status: kStatus, note: kNote },
      kondisi: { status: oStatus, note: oNote },
      ajuan: { status: aStatus, note: aNote },
      perKk: parsed.perKk ?? {},
    };
    return out;
  } catch {
    return { ...seed, globalNote: trimmed };
  }
}
function serializeAlatDraft(d: AlatReviewDetailStruct) {
  return JSON.stringify(d);
}

// =========================== HELPER DARI SCHOOL-EQUIPMENT PAGE ===========================
type KategoriKey =
  | "Peralatan Praktik Utama Kriteria Minimal"
  | "Peralatan Praktik Utama Kriteria Pengembangan"
  | "Peralatan Praktik Pendukung";

const kategoriOrder: KategoriKey[] = [
  "Peralatan Praktik Utama Kriteria Minimal",
  "Peralatan Praktik Utama Kriteria Pengembangan",
  "Peralatan Praktik Pendukung",
];

const kategoriTabs: Array<{ key: KategoriKey; label: string }> = [
  { key: "Peralatan Praktik Utama Kriteria Minimal", label: "Kriteria Minimal" },
  { key: "Peralatan Praktik Utama Kriteria Pengembangan", label: "Kriteria Pengembangan" },
  { key: "Peralatan Praktik Pendukung", label: "Pendukung" },
];

type ProposalTabKey = "survey" | "rpkp" | "rab";
const proposalTabConfigs: Array<{ key: ProposalTabKey; label: string }> = [
  { key: "survey", label: "Survey Harga Pasar" },
  { key: "rpkp", label: "RPKP · Pilihan Toko" },
  { key: "rab", label: "RAB · Total Per KK" },
];

type ShopKey = "shop1" | "shop2" | "shop3";
const shopConfigs: Array<{
  key: ShopKey;
  label: string;
  emoji: string;
  headerClass: string;
}> = [
  {
    key: "shop1",
    label: "Anggaran SIPLAH 1",
    emoji: "🛒",
    headerClass: "bg-emerald-50 text-emerald-800",
  },
  {
    key: "shop2",
    label: "Anggaran SIPLAH 2",
    emoji: "🏪",
    headerClass: "bg-rose-50 text-rose-800",
  },
  {
    key: "shop3",
    label: "Anggaran SIPLAH 3",
    emoji: "📦",
    headerClass: "bg-indigo-50 text-indigo-800",
  },
];

type SchoolEquipmentReference = {
  bidangCode: string;
  bidangName: string;
  programCode: string;
  programName: string;
  concentrationCode: string;
  concentrationName: string;
  detail: PerdirjenEquipmentDetailKonsentrasi;
};

type EditableEquipmentRow = {
  name: string;
  functionText: string;
  specificationText: string;
  ratio: string;
  ownership: "" | "Ada" | "Tidak";
  quantity: string;
  goodCondition: string;
  badCondition: string;
  needed: string;
  notes: string;
  isCustom?: boolean;
};

type PersistedEquipmentTables = Record<string, EditableEquipmentRow[]>;

function compareConcentrationCode(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? -1;
    const rightValue = rightParts[index] ?? -1;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.localeCompare(right, "id-ID");
}

function findSchoolReference(
  concentrationCode: string,
  bidang: PerdirjenEquipmentDetailBidang | undefined,
): SchoolEquipmentReference | null {
  if (!bidang) {
    return null;
  }

  for (const program of bidang.program) {
    const konsentrasi = program.konsentrasi.find((item) => item.no === concentrationCode);
    if (konsentrasi) {
      return {
        bidangCode: bidang.no,
        bidangName: bidang.bidang,
        programCode: program.no,
        programName: program.nama,
        concentrationCode: konsentrasi.no,
        concentrationName: konsentrasi.nama,
        detail: konsentrasi,
      };
    }
  }

  return null;
}

function countKonsentrasiItems(konsentrasi: PerdirjenEquipmentDetailKonsentrasi) {
  return kategoriOrder.reduce((total, kategori) => total + konsentrasi[kategori].length, 0);
}

function getTableKey(schoolId: string, concentrationCode: string, kategori: KategoriKey) {
  return `${schoolId}::${concentrationCode}::${kategori}`;
}
function getProposalTableKey(schoolId: string, concentrationCode: string, category: string) {
  return `${schoolId}::${concentrationCode}::${category}`;
}

function parseNonNegativeInteger(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeEditableRow(
  row: Partial<EditableEquipmentRow> & { condition?: "" | "Baik" | "Rusak" },
): EditableEquipmentRow {
  const quantity = typeof row.quantity === "string" ? row.quantity : row.quantity != null ? String(row.quantity) : "";
  const fallbackConditionValue = quantity || "0";

  return {
    name: row.name ?? "",
    functionText: row.functionText ?? "",
    specificationText: row.specificationText ?? "",
    ratio: row.ratio ?? "",
    ownership: row.ownership === "Ada" || row.ownership === "Tidak" ? row.ownership : "",
    quantity,
    goodCondition:
      typeof row.goodCondition === "string"
        ? row.goodCondition
        : row.condition === "Baik"
          ? fallbackConditionValue
          : "",
    badCondition:
      typeof row.badCondition === "string"
        ? row.badCondition
        : row.condition === "Rusak"
          ? fallbackConditionValue
          : "",
    needed: typeof row.needed === "string" ? row.needed : row.needed != null ? String(row.needed) : "",
    notes: row.notes ?? "",
    isCustom: Boolean(row.isCustom),
  };
}

function toEditableRows(konsentrasi: PerdirjenEquipmentDetailKonsentrasi, kategori: KategoriKey): EditableEquipmentRow[] {
  return konsentrasi[kategori].map((item) => ({
    name: item["Nama Alat"] ?? "",
    functionText: item["Fungsi Alat"] ?? "",
    specificationText: item["Spesifikasi Alat"] ?? "",
    ratio: item["Rasio Satuan"] ?? "",
    ownership: "",
    quantity: "",
    goodCondition: "",
    badCondition: "",
    needed: "",
    notes: "",
    isCustom: false,
  }));
}

function createEmptyRow(): EditableEquipmentRow {
  return {
    name: "",
    functionText: "",
    specificationText: "",
    ratio: "",
    ownership: "",
    quantity: "",
    goodCondition: "",
    badCondition: "",
    needed: "",
    notes: "",
    isCustom: true,
  };
}

function normalizePersistedTables(payload: Record<string, unknown> | undefined): PersistedEquipmentTables {
  return Object.fromEntries(
    Object.entries(payload ?? {}).map(([key, rows]) => [
      key,
      Array.isArray(rows)
        ? rows.map((row) =>
            normalizeEditableRow((row ?? {}) as Partial<EditableEquipmentRow> & { condition?: "" | "Baik" | "Rusak" }),
          )
        : [],
    ]),
  );
}

function summarizeRows(rows: EditableEquipmentRow[]) {
  return rows.reduce(
    (summary, row) => ({
      owned: summary.owned + (row.ownership === "Ada" ? 1 : 0),
      total: summary.total + 1,
      good: summary.good + parseNonNegativeInteger(row.goodCondition),
      bad: summary.bad + parseNonNegativeInteger(row.badCondition),
      needed: summary.needed + parseNonNegativeInteger(row.needed),
    }),
    { owned: 0, total: 0, good: 0, bad: 0, needed: 0 },
  );
}

// =========================== HELPER DARI SCHOOL-PROPOSAL PAGE ===========================
function parseQuantityNumber(value: string): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function parseCurrencyNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function roundToNearestThousand(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 1000) * 1000;
}

// =========================== UI PRIMITIVE ===========================
function StatTile({
  eyebrow,
  value,
  sub,
  accent,
}: {
  eyebrow: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "slate" | "emerald" | "sky" | "primary" | "amber" | "rose";
}) {
  const palette: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50/80 text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    primary: "border-primary/20 bg-primary/[0.06] text-primary",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <div className={cn("rounded-[20px] border p-4 md:p-5", palette[accent ?? "slate"])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500/90">{eyebrow}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 md:text-2xl">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
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
        title="Setujui dengan Syarat"
        className={cn(
          btn,
          value === "approved"
            ? "border-sky-300 bg-sky-500 text-white shadow-sm shadow-sky-200"
            : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
        )}
      >
        <BadgeCheck className="h-4.5 w-4.5 shrink-0" />
        <span className="truncate">Setj.Syarat</span>
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
        <span className="truncate">Perbaikan</span>
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

// =========================== KOMPONEN UTAMA ===========================
export function FacilitatorAlatVerifikasiOnlineDetailPage({ npsn }: { npsn: string }) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [equipmentBundle, setEquipmentBundle] = useState<WorkspaceSchoolEquipmentData | null>(null);
  const [proposalBundle, setProposalBundle] = useState<WorkspaceSchoolProposalData | null>(null);
  const [bimtekReview, setBimtekReview] = useState<WorkspaceBimtekReviewRecord | null>(null);
  const [existingReview, setExistingReview] = useState<WorkspaceVerifikasiOnlineRecord | null>(null);
  const [assignment, setAssignment] = useState<{ schoolName: string; assignmentKey: string } | null>(null);
  const [references, setReferences] = useState<SchoolEquipmentReference[]>([]);
  const [missingCodes, setMissingCodes] = useState<string[]>([]);
  const [reviewDraft, setReviewDraft] = useState<AlatReviewDetailStruct>(
    JSON.parse(JSON.stringify(fallbackDraft)),
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  type MainTabKey = "konsentrasi" | "sarana" | "pengajuan" | "rpd" | "pks";
  const [mainTab, setMainTab] = useState<MainTabKey>("konsentrasi");
  const [selectedConcentrationCode, setSelectedConcentrationCode] = useState<string | null>(null);

  // State untuk TAB SARANA (mirip school-equipment-page)
  const [activeKategori, setActiveKategori] = useState<KategoriKey>(
    "Peralatan Praktik Utama Kriteria Minimal",
  );
  const [persistedTablesEquip, setPersistedTablesEquip] = useState<Record<string, EditableEquipmentRow[]>>({});

  // State untuk TAB PENGAJUAN (mirip school-proposal-page)
  const [activeProposalTab, setActiveProposalTab] = useState<ProposalTabKey>("survey");
  const [expandedRabCodes, setExpandedRabCodes] = useState<Set<string>>(new Set());
  const [administrativeDocuments, setAdministrativeDocuments] = useState<SchoolAdministrativeDocumentRecord[]>([]);
  const [imgPreview, setImgPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (!imgPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImgPreview(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [imgPreview]);

  const facilitatorId = session?.user.id ?? "";
  const facilitatorName = session?.user.fullName ?? "";

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function normalizeUserName(value: string) {
    return value.trim().toLowerCase().replace(/\s+prisma$/i, "");
  }
  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4500);
  }
  function formatFileSize(num: number): string {
    if (!num) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let v = num;
    let u = 0;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u += 1;
    }
    return `${v.toFixed(v < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
  }
  function isImage(mime?: string): boolean {
    return Boolean(mime && mime.startsWith("image/"));
  }
  function isPdf(mime?: string): boolean {
    return mime === "application/pdf";
  }

  function getPerKk(code: string | null | undefined): PerKkDraft {
    if (!code) return fallbackPerKkDraft();
    const stored = reviewDraft.perKk[code];
    if (stored) return stored;
    return fallbackPerKkDraft();
  }

  function patchPerKk(code: string, patch: Partial<PerKkDraft>) {
    setReviewDraft((prev) => {
      const current = prev.perKk[code] ?? fallbackPerKkDraft();
      const next: PerKkDraft = { ...current, ...patch };
      return { ...prev, perKk: { ...prev.perKk, [code]: next } };
    });
  }

  function patchPerKkSection(
    code: string,
    section: keyof PerKkDraft,
    patch: Partial<PerItemDraft>,
  ) {
    patchPerKk(code, { [section]: { ...getPerKk(code)[section], ...patch } } as Partial<PerKkDraft>);
  }

  function ensureSelectedKkExists() {
    const first = profile?.concentrations?.[0];
    if (!first) return;
    if (!selectedConcentrationCode) setSelectedConcentrationCode(first.code);
    else {
      const ok = profile.concentrations.find((c) => c.code === selectedConcentrationCode);
      if (!ok) setSelectedConcentrationCode(first.code);
    }
  }

  // ============= FETCH DATA =============
  async function loadDetail(showRefresh = false) {
    if (!hydrated || !session?.token) {
      setLoading(false);
      return;
    }
    if (showRefresh) {
      setRefreshing(true);
      invalidateDetailPraBimtekCache(npsn);
    }
    setLoading(true);
    setLoadError("");
    const token = session.token;
    const normalizedName = normalizeUserName(facilitatorName);

    let cancelled = false;
    try {
      // ✅ Cache Detail Pra-Bimtek by NPSN (24 jam TTL = second load < 200ms!)
      // ✅ Cache Verifikasi Review by NPSN (45 detik)
      const [prof, adminSelection, reviewRecords, assignments, admDocs]: [
        SchoolProfileRecord,
        WorkspaceAdminSelectionData,
        WorkspaceVerifikasiOnlineRecord[],
        WorkspaceAssignmentRecord[],
        SchoolAdministrativeDocumentRecord[],
      ] = await Promise.all([
        schoolProfileByNpsnRequest(token, npsn),
        fetchCachedDetailPraBimtekByNpsn(token, npsn, { force: showRefresh === true }),
        fetchCachedVerifikasiReviews(token, { schoolNpsn: npsn }, { force: showRefresh === true }),
        workspaceAssignmentsRequest(token, {
          moduleKey: "verifikasi-online",
          facilitatorEquipmentId: facilitatorId || undefined,
          schoolNpsn: npsn,
        }),
        schoolAdministrativeDocumentsByNpsnRequest(token, npsn),
      ]);
      if (cancelled) return;

      const sortedConcentrations = [...prof.concentrations].sort((left, right) =>
        compareConcentrationCode(left.code, right.code),
      );
      const bidangCodes = [
        ...new Set(sortedConcentrations.map((item) => item.code.split(".")[0]).filter(Boolean)),
      ];
      // ✅ BATCH Cached perdirjen bidang! (7 hari TTL, NO N+1 HTTP request)
      const bidangCached = await fetchCachedPerdirjenBidangBatch(token, bidangCodes, { force: showRefresh === true });
      const bidangDetails: readonly (readonly [string, PerdirjenEquipmentSummary])[] =
        bidangCodes.map((c) => [c, bidangCached[c] ?? { no: c, bidang: c, totalProgram: 0, totalKonsentrasi: 0, totalItem: 0, program: [] }] as const);
      if (cancelled) return;
      const bidangMap = Object.fromEntries(bidangDetails);
      const nextReferences: SchoolEquipmentReference[] = [];
      const nextMissingCodes: string[] = [];
      for (const concentration of sortedConcentrations) {
        const bidangCode = concentration.code.split(".")[0] ?? "";
        const match = findSchoolReference(concentration.code, bidangMap[bidangCode]);
        if (match) nextReferences.push(match);
        else nextMissingCodes.push(concentration.code);
      }

      const matchedAssignment =
        assignments.find((a) => a.schoolNpsn === npsn && a.moduleKey === "verifikasi-online") ??
        assignments.find((a) => {
          if (a.moduleKey !== "verifikasi-online") return false;
          if (facilitatorId && a.facilitatorEquipmentId === facilitatorId) return a.schoolNpsn === npsn;
          return (
            normalizedName &&
            normalizeUserName(a.facilitatorEquipmentName) === normalizedName &&
            a.schoolNpsn === npsn
          );
        }) ??
        null;

      const myReview =
        reviewRecords.find(
          (r) => r.schoolNpsn === npsn && r.reviewedEquipmentId && r.reviewedEquipmentId === session.user.id,
        ) ??
        reviewRecords.find(
          (r) =>
            r.schoolNpsn === npsn &&
            r.reviewedEquipmentName &&
            normalizeUserName(r.reviewedEquipmentName) === normalizedName,
        ) ??
        reviewRecords.find((r) => r.schoolNpsn === npsn) ??
        null;

      setProfile(prof);
      setAdministrativeDocuments(Array.isArray(admDocs) ? admDocs : []);
      setEquipmentBundle(
        (adminSelection.equipmentBundles?.[npsn] as WorkspaceSchoolEquipmentData | undefined) ?? null,
      );
      setProposalBundle(
        (adminSelection.proposalBundles?.[npsn] as WorkspaceSchoolProposalData | undefined) ?? null,
      );
      setPersistedTablesEquip(
        normalizePersistedTables(
          (adminSelection.equipmentBundles?.[npsn] as WorkspaceSchoolEquipmentData | undefined)?.equipmentTables,
        ),
      );
      setBimtekReview(adminSelection.bimtekReviews.find((item) => item.schoolNpsn === npsn) ?? null);
      setExistingReview(myReview);
      setReferences(nextReferences);
      setMissingCodes(nextMissingCodes);
      setAssignment(
        matchedAssignment
          ? { schoolName: matchedAssignment.schoolName, assignmentKey: matchedAssignment.key }
          : { schoolName: prof.schoolName || "Sekolah", assignmentKey: `fallback-${npsn}` },
      );
      setReviewDraft(tryParseAlatDetail(myReview?.reviewNoteEquipment));
    } catch (error) {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : "Gagal memuat detail verifikasi sekolah.");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
        setRefreshing(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    void loadDetail(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn, facilitatorId, facilitatorName]);

  // ═══════════════════════════════════════════════════════════════════════
  // ⚡ REALTIME SYNC v4.3 — Sinkronisasi otomatis dengan UI sekolah
  // 1. Polling 45 DETIK: refresh data proposal (TAPI TIDAK reload review/perdirjen)
  //    (cache TTL 30s → polling 45s = fresh load 90% request, tanpa flood server)
  // 2. Visibility Focus Refresh: user balik ke tab → reload segara
  // 3. Cross-Tab Broadcast: listen localStorage event dari UI sekolah save
  //    (auto-invalidate cache via storage listener di school-verifikasi-cache)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated || !session?.token) return;

    let cancelled = false;
    let timerId: number | null = null;

    async function softRefreshProposalOnly() {
      if (!session?.token) return;
      try {
        const freshAdmin = await fetchCachedDetailPraBimtekByNpsn(session.token, npsn, { force: true });
        const nextProposal = (freshAdmin.proposalBundles?.[npsn] as WorkspaceSchoolProposalData | undefined) ?? null;
        setProposalBundle((prev) => {
          const prevJson = prev ? JSON.stringify(prev) : "";
          const nextJson = nextProposal ? JSON.stringify(nextProposal) : "";
          if (prevJson === nextJson) return prev;
          return nextProposal;
        });
      } catch {
        /* ignore poll errors — silent, user tetap bisa klik manual refresh */
      }
    }

    // Polling 45 detik (cache TTL proposal = 30 detik, jadi tiap poll = fresh data)
    timerId = window.setInterval(() => {
      if (!cancelled) void softRefreshProposalOnly();
    }, 45_000);

    // Visibility focus refresh
    function onVisibility() {
      if (document.visibilityState === "visible" && !cancelled) {
        void softRefreshProposalOnly();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn]);

  useEffect(() => {
    ensureSelectedKkExists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.concentrations.length, selectedConcentrationCode]);

  // ============= PERSISTENSI REVIEW =============
  async function persistApproval(options?: {
    konsentrasiStatus?: ReviewItemStatus;
    kondisiStatus?: ReviewItemStatus;
    ajuanStatus?: ReviewItemStatus;
    globalStatus?: ReviewItemStatus;
  }) {
    if (!session?.token) return;
    const targetNpsn = profile?.npsn || npsn;
    const targetSchoolName = profile?.schoolName || assignment?.schoolName || "";
    if (!targetNpsn) return;

    const nextDraft: AlatReviewDetailStruct = JSON.parse(JSON.stringify(reviewDraft));
    if (typeof options?.konsentrasiStatus !== "undefined")
      nextDraft.konsentrasi = { ...nextDraft.konsentrasi, status: options.konsentrasiStatus };
    if (typeof options?.kondisiStatus !== "undefined")
      nextDraft.kondisi = { ...nextDraft.kondisi, status: options.kondisiStatus };
    if (typeof options?.ajuanStatus !== "undefined")
      nextDraft.ajuan = { ...nextDraft.ajuan, status: options.ajuanStatus };
    if (typeof options?.globalStatus !== "undefined") nextDraft.globalStatus = options.globalStatus;

    setReviewDraft(nextDraft);
    setSaving(true);

    try {
      const token = session.token;
      let approvedEquipment: boolean | null = existingReview?.approvedEquipment ?? null;
      if (typeof options?.globalStatus !== "undefined") {
        approvedEquipment =
          options.globalStatus === "approved"
            ? true
            : options.globalStatus === "rejected"
              ? false
              : null;
      }
      const result = await upsertWorkspaceVerifikasiOnlineReviewRequest(token, {
        schoolNpsn: targetNpsn,
        schoolName: targetSchoolName,
        reviewerRole: "PERALATAN",
        reviewerId: session.user.id,
        reviewerName: session.user.fullName,
        reviewNote: serializeAlatDraft(nextDraft),
        approved: approvedEquipment,
        updatedAt: new Date().toISOString(),
      });
      if (result) {
        setExistingReview(result);
        writeThroughVerifikasiReviewCache(result);
      }
      showToast("success", "Status verifikasi peralatan berhasil disimpan.");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Gagal menyimpan verifikasi peralatan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function savePerKkStatus(
    code: string,
    section: keyof PerKkDraft,
    next: ReviewItemStatus,
  ) {
    if (!session?.token) return;
    const targetNpsn = profile?.npsn || npsn;
    const targetSchoolName = profile?.schoolName || assignment?.schoolName || "";
    if (!targetNpsn) return;
    const nextDraft: AlatReviewDetailStruct = JSON.parse(JSON.stringify(reviewDraft));
    const before = nextDraft.perKk[code] ?? fallbackPerKkDraft();
    nextDraft.perKk[code] = { ...before, [section]: { ...before[section], status: next } };
    if (section === "konsentrasi") {
      nextDraft.konsentrasi = aggregateFromPerKk(nextDraft.perKk, "konsentrasi", nextDraft.konsentrasi);
    } else if (section === "sarana") {
      nextDraft.kondisi = aggregateFromPerKk(nextDraft.perKk, "sarana", nextDraft.kondisi);
    } else if (section === "pengajuan") {
      nextDraft.ajuan = aggregateFromPerKk(nextDraft.perKk, "pengajuan", nextDraft.ajuan);
    }
    setReviewDraft(nextDraft);
    setSaving(true);
    let approvedEquipment: boolean | null = existingReview?.approvedEquipment ?? null;
    if (nextDraft.globalStatus) {
      approvedEquipment =
        nextDraft.globalStatus === "approved"
          ? true
          : nextDraft.globalStatus === "rejected"
            ? false
            : null;
    }
    const token = session.token;
    void upsertWorkspaceVerifikasiOnlineReviewRequest(token, {
      schoolNpsn: targetNpsn,
      schoolName: targetSchoolName,
      reviewerRole: "PERALATAN",
      reviewerId: session.user.id,
      reviewerName: session.user.fullName,
      reviewNote: serializeAlatDraft(nextDraft),
      approved: approvedEquipment,
      updatedAt: new Date().toISOString(),
    })
      .then((result) => {
        if (result) {
          setExistingReview(result);
          writeThroughVerifikasiReviewCache(result);
        }
        showToast("success", "Status verifikasi per KK berhasil disimpan.");
      })
      .catch((err) => {
        showToast("error", err instanceof Error ? err.message : "Gagal menyimpan verifikasi per KK.");
      })
      .finally(() => {
        setSaving(false);
      });
  }

  function saveNoteBlurPersist(code: string, section: keyof PerKkDraft) {
    if (!session?.token) return;
    const targetNpsn = profile?.npsn || npsn;
    const targetSchoolName = profile?.schoolName || assignment?.schoolName || "";
    if (!targetNpsn) return;
    const nextDraft: AlatReviewDetailStruct = JSON.parse(JSON.stringify(reviewDraft));
    if (section === "konsentrasi") {
      nextDraft.konsentrasi = aggregateFromPerKk(nextDraft.perKk, "konsentrasi", nextDraft.konsentrasi);
    } else if (section === "sarana") {
      nextDraft.kondisi = aggregateFromPerKk(nextDraft.perKk, "sarana", nextDraft.kondisi);
    } else if (section === "pengajuan") {
      nextDraft.ajuan = aggregateFromPerKk(nextDraft.perKk, "pengajuan", nextDraft.ajuan);
    }
    setReviewDraft(nextDraft);
    setSaving(true);
    let approvedEquipment: boolean | null = existingReview?.approvedEquipment ?? null;
    if (nextDraft.globalStatus) {
      approvedEquipment =
        nextDraft.globalStatus === "approved"
          ? true
          : nextDraft.globalStatus === "rejected"
            ? false
            : null;
    }
    const token = session.token;
    void upsertWorkspaceVerifikasiOnlineReviewRequest(token, {
      schoolNpsn: targetNpsn,
      schoolName: targetSchoolName,
      reviewerRole: "PERALATAN",
      reviewerId: session.user.id,
      reviewerName: session.user.fullName,
      reviewNote: serializeAlatDraft(nextDraft),
      approved: approvedEquipment,
      updatedAt: new Date().toISOString(),
    })
      .then((result) => {
        if (result) {
          setExistingReview(result);
          writeThroughVerifikasiReviewCache(result);
        }
        showToast("success", "Catatan verifikasi per KK berhasil disimpan.");
      })
      .catch((err) => {
        showToast("error", err instanceof Error ? err.message : "Gagal menyimpan catatan verifikasi.");
      })
      .finally(() => {
        setSaving(false);
      });
  }

  // ============= DATA DERIVASI: TAB SARANA (mirip school-equipment) =============
  type ConcentSummary = {
    code: string;
    name: string;
    rombelCount: number;
    studentCount: number;
    hasReference: boolean;
    totalGood: number;
    totalBad: number;
    totalNeeded: number;
    categorySummaries: Record<KategoriKey, ReturnType<typeof summarizeRows>>;
  };

  const concentrationSummaries: ConcentSummary[] = useMemo(() => {
    if (!profile) return [];
    return [...profile.concentrations]
      .sort((left, right) => compareConcentrationCode(left.code, right.code))
      .map((kk) => {
        const ref = references.find((r) => r.concentrationCode === kk.code) ?? null;
        const rombelCount = (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
        const studentCount = (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
        const categorySummaries = Object.fromEntries(
          kategoriOrder.map((kat) => {
            const rows = ref ? getEquipmentRows(ref, kat) : [];
            return [kat, summarizeRows(rows)];
          }),
        ) as Record<KategoriKey, ReturnType<typeof summarizeRows>>;
        return {
          code: kk.code,
          name: kk.name,
          rombelCount,
          studentCount,
          hasReference: Boolean(ref),
          totalGood: kategoriOrder.reduce((sum, kat) => sum + categorySummaries[kat].good, 0),
          totalBad: kategoriOrder.reduce((sum, kat) => sum + categorySummaries[kat].bad, 0),
          totalNeeded: kategoriOrder.reduce((sum, kat) => sum + categorySummaries[kat].needed, 0),
          categorySummaries,
        };
      });
  }, [profile, references, persistedTablesEquip]);

  const selectedReference = useMemo(
    () => references.find((r) => r.concentrationCode === selectedConcentrationCode) ?? null,
    [references, selectedConcentrationCode],
  );

  function getEquipmentRows(ref: SchoolEquipmentReference, kategori: KategoriKey): EditableEquipmentRow[] {
    if (!profile) return [];
    const key = getTableKey(profile.schoolId, ref.concentrationCode, kategori);
    return persistedTablesEquip[key] ?? toEditableRows(ref.detail, kategori);
  }

  // ============= DATA DERIVASI: TAB PENGAJUAN (mirip school-proposal) =============
  type SiplahQuote = {
    name: string;
    priceWithTax: string;
    shippingCost: string;
    installationCost: string;
    totalPrice: string;
    link: string;
    siplahScreenshots: Array<{ id: string; fileName: string; dataUrl: string }>;
  };
  type ProposalRow = {
    id: string;
    name: string;
    specification: string;
    conformity: string;
    quantity: string;
    unit: string;
    shop1: SiplahQuote;
    shop2: SiplahQuote;
    shop3: SiplahQuote;
  };
  type PersistedRpkpSelections = Record<string, Record<string, ShopKey>>;

  function normalizeProposalTables(
    input: Record<string, unknown> | null | undefined,
  ): Record<string, ProposalRow[]> {
    const out: Record<string, ProposalRow[]> = {};
    if (!input || typeof input !== "object") return out;
    const emptyQuote = (): SiplahQuote => ({
      name: "",
      priceWithTax: "",
      shippingCost: "",
      installationCost: "",
      totalPrice: "",
      link: "",
      siplahScreenshots: [],
    });
    for (const [key, value] of Object.entries(input)) {
      if (!Array.isArray(value)) continue;
      out[key] = value.map((raw) => {
        const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const parseShop = (s: unknown): SiplahQuote => {
          if (!s || typeof s !== "object") return emptyQuote();
          const so = s as Record<string, unknown>;
          const screensRaw = so.siplahScreenshots;
          const screens =
            Array.isArray(screensRaw)
              ? (screensRaw as unknown[])
                  .filter((x) => x && typeof x === "object")
                  .map((x) => {
                    const xo = x as Record<string, unknown>;
                    return {
                      id: String(xo.id ?? `s-${Date.now()}-${Math.random()}`),
                      fileName: String(xo.fileName ?? "screenshot.jpg"),
                      dataUrl: String(xo.dataUrl ?? ""),
                    };
                  })
                  .filter((x) => x.dataUrl)
              : [];
          return {
            name: String(so.name ?? "").trim(),
            priceWithTax: String(so.priceWithTax ?? "").trim(),
            shippingCost: String(so.shippingCost ?? "").trim(),
            installationCost: String(so.installationCost ?? "").trim(),
            totalPrice: String(so.totalPrice ?? "").trim(),
            link: String(so.link ?? "").trim(),
            siplahScreenshots: screens,
          };
        };
        return {
          id: String(r.id ?? `row-${Math.random()}`),
          name: String(r.name ?? "").trim(),
          specification: String(r.specification ?? "").trim(),
          conformity: String(r.conformity ?? "").trim(),
          quantity: String(r.quantity ?? "").trim(),
          unit: String(r.unit ?? "").trim(),
          shop1: parseShop(r.shop1),
          shop2: parseShop(r.shop2),
          shop3: parseShop(r.shop3),
        };
      });
    }
    return out;
  }

  function normalizePersistedRpkpSelections(
    input: Record<string, unknown> | null | undefined,
  ): PersistedRpkpSelections {
    const out: PersistedRpkpSelections = {};
    if (!input || typeof input !== "object") return out;
    for (const [key, value] of Object.entries(input)) {
      if (!value || typeof value !== "object") continue;
      const vobj = value as Record<string, unknown>;
      const rowSelections: Record<string, ShopKey> = {};
      for (const [rid, sel] of Object.entries(vobj)) {
        if (sel === "shop1" || sel === "shop2" || sel === "shop3") rowSelections[rid] = sel;
      }
      if (Object.keys(rowSelections).length) out[key] = rowSelections;
    }
    return out;
  }

  const persistedTablesProposal = useMemo(
    () => normalizeProposalTables(proposalBundle?.proposalTables ?? null),
    [proposalBundle],
  );
  const persistedRpkpSelections = useMemo(
    () => normalizePersistedRpkpSelections(proposalBundle?.rpkpSelections ?? null),
    [proposalBundle],
  );

  const { rabGrand: rabGrandRpd, rpkpGrand: rpkpGrandRpd } = useMemo(() => {
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
    return { rabGrand: rab, rpkpGrand: rpkp };
  }, [proposalBundle]);

  type TabPrintId = "print-rpd" | "print-pks";
  const [printPreviewId, setPrintPreviewId] = useState<TabPrintId | null>(null);

  const surveyTabKey = useMemo(
    () => (profile && selectedConcentrationCode ? getProposalTableKey(profile.schoolId, selectedConcentrationCode, "survey") : ""),
    [profile, selectedConcentrationCode],
  );
  const rpkpTableKey = useMemo(
    () => (profile && selectedConcentrationCode ? getProposalTableKey(profile.schoolId, selectedConcentrationCode, "rpkp") : ""),
    [profile, selectedConcentrationCode],
  );
  const surveyRows: ProposalRow[] = useMemo(() => persistedTablesProposal[surveyTabKey] ?? [], [persistedTablesProposal, surveyTabKey]);

  function findReferenceItemFromConformity(
    ref: SchoolEquipmentReference | null,
    conformity: string,
  ): PerdirjenEquipmentItem | null {
    if (!ref || !conformity || conformity === "Alat Tidak Sesuai PERKA") {
      return null;
    }
    for (const kategori of kategoriOrder) {
      const prefix = `${kategori} - `;
      if (conformity.startsWith(prefix)) {
        const name = conformity.slice(prefix.length).trim();
        return ref.detail[kategori].find((item) => item["Nama Alat"] === name) ?? null;
      }
    }
    return null;
  }

  type RpkpRow = {
    id: string;
    name: string;
    functionText: string;
    specification: string;
    selectedShop: ShopKey | "";
    selectedQuote: SiplahQuote;
  };
  const rpkpRows: RpkpRow[] = useMemo(() => {
    if (!surveyRows.length) return [];
    const selections = rpkpTableKey ? persistedRpkpSelections[rpkpTableKey] ?? {} : {};
    return surveyRows
      .map((row) => {
        const matchedReference = findReferenceItemFromConformity(selectedReference, row.conformity);
        const savedSelection = selections[row.id];
        const selectedShop: ShopKey | "" =
          savedSelection === "shop1" || savedSelection === "shop2" || savedSelection === "shop3"
            ? savedSelection
            : "";
        const selectedQuote: SiplahQuote =
          selectedShop &&
          (selectedShop === "shop1" || selectedShop === "shop2" || selectedShop === "shop3")
            ? row[selectedShop]
            : {
                name: "",
                priceWithTax: "",
                shippingCost: "",
                installationCost: "",
                totalPrice: "",
                link: "",
                siplahScreenshots: [] as SiplahQuote["siplahScreenshots"],
              };
        return {
          id: row.id,
          name: row.name,
          functionText: matchedReference?.["Fungsi Alat"] ?? "",
          specification: row.specification,
          selectedShop,
          selectedQuote,
        };
      });
  }, [surveyRows, rpkpTableKey, persistedRpkpSelections, selectedReference]);

  const rpkpGrandTotal = useMemo(
    () =>
      rpkpRows.reduce((sum, row) => {
        const unitPrice =
          parseCurrencyNumber(row.selectedQuote.priceWithTax) +
          parseCurrencyNumber(row.selectedQuote.shippingCost) +
          parseCurrencyNumber(row.selectedQuote.installationCost);
        const qty = parseQuantityNumber(
          surveyRows.find((s) => s.id === row.id)?.quantity ?? "0",
        );
        return sum + unitPrice * qty;
      }, 0),
    [rpkpRows, surveyRows],
  );

  type RabRow = {
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  };
  const rabRows: RabRow[] = useMemo(() => {
    if (!surveyRows.length) return [];
    const selections = rpkpTableKey ? persistedRpkpSelections[rpkpTableKey] ?? {} : {};
    return surveyRows.map((row) => {
      const raw = selections[row.id];
      const selectedShop: ShopKey | "" =
        raw === "shop1" || raw === "shop2" || raw === "shop3" ? raw : "";
      let unitPrice = 0;
      if (selectedShop) {
        const quote = row[selectedShop];
        unitPrice =
          parseCurrencyNumber(quote.priceWithTax) +
          parseCurrencyNumber(quote.shippingCost) +
          parseCurrencyNumber(quote.installationCost);
      }
      const quantity = parseQuantityNumber(row.quantity);
      return {
        id: row.id,
        name: row.name,
        unitPrice,
        quantity,
        totalPrice: unitPrice * quantity,
      };
    });
  }, [surveyRows, rpkpTableKey, persistedRpkpSelections]);

  const rabGrandTotal = useMemo(() => rabRows.reduce((sum, row) => sum + row.totalPrice, 0), [rabRows]);
  const rabRoundedGrandTotal = useMemo(() => roundToNearestThousand(rabGrandTotal), [rabGrandTotal]);

  type ProposalConcentSummary = {
    code: string;
    name: string;
    rombelCount: number;
    studentCount: number;
    totalProposalItems: number;
    totalProposalValue: number;
    totalUnits: number;
    equipmentDetails?: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
  };

  const concentrationRows: ProposalConcentSummary[] = useMemo(() => {
    if (!profile) return [];
    return profile.concentrations.map((kk) => {
      const rombelCount = (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
      const studentCount = (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
      const survKey = getProposalTableKey(profile.schoolId, kk.code, "survey");
      const rpkpKey = getProposalTableKey(profile.schoolId, kk.code, "rpkp");
      const survRows = persistedTablesProposal[survKey] ?? [];
      const rpkpSel = persistedRpkpSelections[rpkpKey] ?? {};
      const equipDetails: Array<{
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];
      let totalValue = 0;
      let totalItems = 0;
      let totalUnits = 0;
      for (const s of survRows) {
        const qty = parseQuantityNumber(s.quantity);
        const savedShop = rpkpSel[s.id];
        const selectedShop: "shop1" | "shop2" | "shop3" | "" =
          savedShop === "shop1" || savedShop === "shop2" || savedShop === "shop3"
            ? savedShop
            : "";
        let unitPrice = 0;
        if (selectedShop) {
          const q = s[selectedShop];
          unitPrice =
            parseCurrencyNumber(q.priceWithTax) +
            parseCurrencyNumber(q.shippingCost) +
            parseCurrencyNumber(q.installationCost);
        }
        const subtotal = unitPrice * qty;
        equipDetails.push({
          id: s.id,
          name: s.name,
          quantity: qty,
          unitPrice,
          subtotal,
        });
        totalItems += 1;
        totalUnits += qty;
        totalValue += subtotal;
      }
      return {
        code: kk.code,
        name: kk.name,
        rombelCount,
        studentCount,
        totalProposalItems: totalItems,
        totalProposalValue: totalValue,
        totalUnits,
        equipmentDetails: equipDetails,
      };
    });
  }, [profile, persistedTablesProposal, persistedRpkpSelections]);

  const totalAllConcentrationsProposalItems = useMemo(
    () => concentrationRows.reduce((acc, c) => acc + c.totalProposalItems, 0),
    [concentrationRows],
  );
  const totalAllConcentrationsUnits = useMemo(
    () => concentrationRows.reduce((acc, c) => acc + (c.totalUnits ?? 0), 0),
    [concentrationRows],
  );
  const totalAllConcentrationsProposalValue = useMemo(
    () => concentrationRows.reduce((acc, c) => acc + c.totalProposalValue, 0),
    [concentrationRows],
  );

  // ============= META =============
  const reviewSurveyStatus = bimtekReview?.statuses?.survey ?? null;
  const reviewRpkpStatus = bimtekReview?.statuses?.rpkp ?? null;
  const reviewRabStatus = bimtekReview?.statuses?.rab ?? null;

  const dataCompletion: PraBimtekCompletionResult = useMemo(() => {
    const bundle = buildSchoolProposalBundleFromWorkspaceData(profile?.schoolId, proposalBundle);
    return computePraBimtekCompletion(
      bundle,
      profile?.concentrations?.map((c) => c.code) ?? null,
    );
  }, [profile, proposalBundle]);

  const surveyStatus: PraBimtekCompletionStatus = dataCompletion.survey;
  const rpkpStatus: PraBimtekCompletionStatus = dataCompletion.rpkp;
  const rabStatus: PraBimtekCompletionStatus = dataCompletion.rab;
  const schoolName = profile?.schoolName || assignment?.schoolName || "Memuat...";

  const tabMeta: Record<MainTabKey, { label: string; icon: React.ReactNode; section: keyof PerKkDraft | "_docs"; desc: string }> = {
    konsentrasi: {
      label: "1 · Konsentrasi Keahlian",
      icon: <Users className="h-4 w-4" />,
      section: "konsentrasi",
      desc: "Data KK: rombongan belajar, siswa, luas ruang praktik per konsentrasi",
    },
    sarana: {
      label: "2 · Data Sarana",
      icon: <Boxes className="h-4 w-4" />,
      section: "sarana",
      desc: "Tabel kondisi alat & sarana per konsentrasi keahlian",
    },
    pengajuan: {
      label: "3 · Data Pengajuan",
      icon: <ClipboardList className="h-4 w-4" />,
      section: "pengajuan",
      desc: "Survey Harga Pasar, RPKP & RAB usulan pengadaan per KK",
    },
    rpd: {
      label: "4 · RPD",
      icon: <FileText className="h-4 w-4" />,
      section: "_docs",
      desc: "Rencana Penggunaan Dana (Rich Text Editor sesuai profile sekolah)",
    },
    pks: {
      label: "5 · PKS",
      icon: <ShieldCheck className="h-4 w-4" />,
      section: "_docs",
      desc: "Perjanjian Kerja Sama (PKS) template resmi + auto isi placeholder",
    },
  };

  const activeTabSection = tabMeta[mainTab].section;
  const activeTabIsDocs = activeTabSection === "_docs";
  const selectedKk = profile?.concentrations.find((c) => c.code === selectedConcentrationCode) ?? null;
  const activeKkReview = !activeTabIsDocs && selectedConcentrationCode ? getPerKk(selectedConcentrationCode)[activeTabSection as keyof PerKkDraft] : null;

  const activeProposalTabConfig = proposalTabConfigs.find((t) => t.key === activeProposalTab) ?? proposalTabConfigs[0];

  // ============= RENDER PANEL REVIEW (REUSABLE) =============
  function renderReviewPanel(code: string, section: keyof PerKkDraft, icon: React.ReactNode, label: string) {
    const review = getPerKk(code)[section];
    const kk = profile?.concentrations.find((c) => c.code === code);
    return (
      <div className="rounded-[22px] border-2 border-dashed border-primary/30 bg-primary/[0.02] p-5 space-y-4">
        <ApprovalSectionHeader
          title={`Review · ${label}`}
          description={`Berikan catatan verifikasi dan status untuk ${code} · ${kk?.name ?? "Konsentrasi"}.`}
          icon={icon}
          status={review.status}
        />

        <label className="grid gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <MessageSquareWarning className="h-4 w-4 text-primary" />
            Kolom Komentar · {label}
          </span>
          <textarea
            rows={4}
            className={cn(inputBase, "resize-y bg-white")}
            placeholder={`Tuliskan catatan verifikasi untuk KK ini (misal: rombongan tidak sesuai data Dapodik, alat kurang, harga tidak wajar, dll) — akan tersimpan otomatis saat blur.`}
            value={review.note}
            onChange={(e) => {
              patchPerKkSection(code, section, { note: e.target.value });
            }}
            onBlur={() => saveNoteBlurPersist(code, section)}
          />
          <p className="text-xs text-slate-500">{review.note.trim().length} karakter · tersimpan otomatis saat blur</p>
        </label>

        <FourApprovalButtons
          value={review.status}
          onChange={(s) => savePerKkStatus(code, section, s)}
          onNoteRequire={() => {
            // noop - fokus di handle oleh textarea placeholder saja
          }}
          disabled={saving}
        />

        {saving ? (
          <p className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Menyimpan perubahan verifikasi per KK...
          </p>
        ) : null}
      </div>
    );
  }

  // ============= RENDER =============
  return (
    <div className="space-y-6 pb-12">
      {toast ? (
        <div
          className={cn(
            "fixed top-6 right-6 z-[9999] rounded-[18px] border px-4 py-3 text-sm font-medium shadow-lg shadow-slate-900/10",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          {toast.message}
        </div>
      ) : null}

      {imgPreview ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setImgPreview(null)}
        >
          <div
            className="relative max-w-7xl w-full max-h-[92vh] flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{imgPreview.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">Klik area luar gambar atau tekan tombol ESC untuk menutup preview.</p>
              </div>
              <button
                type="button"
                aria-label="Tutup preview"
                onClick={() => setImgPreview(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative flex-1 overflow-auto rounded-3xl bg-white/95 p-3 shadow-2xl">
              <img
                src={imgPreview.url}
                alt={imgPreview.name}
                className="mx-auto max-h-[82vh] w-auto max-w-full object-contain rounded-2xl border border-slate-200"
              />
            </div>
          </div>
        </div>
      ) : null}

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/fasilitator-alat/verifikasi-online">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/dashboard/fasilitator-alat">
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
          <div className="space-y-2">
            <Badge className="border border-primary/20 bg-primary/[0.08] text-primary" variant="outline">
              <Wrench className="mr-2 h-3.5 w-3.5" />
              {facilitatorName || "Fasilitator Alat"}
            </Badge>
            {existingReview?.reviewedEquipmentAt ? (
              <p className="text-xs text-slate-500">
                Terakhir review: {formatDateTime(new Date(existingReview.reviewedEquipmentAt))}
              </p>
            ) : null}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-950">
              {loading && !profile ? "Memuat detail sekolah..." : schoolName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              NPSN <span className="font-mono font-bold text-slate-900">{npsn}</span>
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadDetail(true)}
          disabled={refreshing || loading || saving}
          className="gap-2"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-14 text-center text-sm text-slate-500">
          Memuat detail sekolah &amp; data peralatan...
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
          {/* ===== RINGKASAN STAT ===== */}
          <Card className="overflow-hidden rounded-[28px] border-slate-200">
            <CardContent className="px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  eyebrow="NPSN"
                  value={<span className="font-mono tracking-tight">{profile.npsn || "—"}</span>}
                  sub={profile.schoolName || "Identitas Sekolah"}
                  accent="slate"
                />
                <StatTile
                  eyebrow="Konsentrasi Keahlian"
                  value={`${profile.concentrations.length} KK`}
                  sub={
                    profile.concentrations.length
                      ? profile.concentrations.slice(0, 3).map((c) => c.code).join(" · ")
                      : "Belum ada KK"
                  }
                  accent="sky"
                />
                <StatTile
                  eyebrow="Kategori Kondisi Sarana"
                  value={`${Object.keys(persistedTablesEquip).length} tabel`}
                  sub={
                    surveyStatus === "selesai"
                      ? "Survey Harga: LENGKAP (semua KK)"
                      : surveyStatus === "proses"
                        ? `Survey Harga: DI PROSES (${dataCompletion.kkWithSurveyCount}/${dataCompletion.kkTotalCount} KK)`
                        : "Survey Harga: BELUM diisi"
                  }
                  accent={surveyStatus === "selesai" ? "emerald" : surveyStatus === "proses" ? "primary" : "slate"}
                />
                <StatTile
                  eyebrow="Total RAB Pengajuan"
                  value={new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
                    totalAllConcentrationsProposalValue,
                  )}
                  sub={
                    rabStatus === "selesai"
                      ? "RAB & RPKP: LENGKAP (semua item terpilih toko)"
                      : rpkpStatus === "proses"
                        ? `RPKP: DI PROSES (${dataCompletion.rpkpItemCount}/${dataCompletion.surveyItemCount} item)`
                        : "RPKP/RAB: BELUM ada pilihan toko"
                  }
                  accent={rabStatus === "selesai" ? "emerald" : rpkpStatus === "proses" ? "primary" : "slate"}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mr-2">
                  Ringkasan Global Review:
                </p>
                <Badge className={cn("border", reviewStatusVariant(reviewDraft.konsentrasi.status))} variant="outline">
                  KK: {reviewStatusLabel(reviewDraft.konsentrasi.status)}
                </Badge>
                <Badge className={cn("border", reviewStatusVariant(reviewDraft.kondisi.status))} variant="outline">
                  Sarana: {reviewStatusLabel(reviewDraft.kondisi.status)}
                </Badge>
                <Badge className={cn("border", reviewStatusVariant(reviewDraft.ajuan.status))} variant="outline">
                  Pengajuan: {reviewStatusLabel(reviewDraft.ajuan.status)}
                </Badge>
                <Badge
                  className={cn(
                    "border",
                    reviewStatusVariant(
                      existingReview?.approvedEquipment === true
                        ? "approved"
                        : existingReview?.approvedEquipment === false
                          ? "rejected"
                          : "pending",
                    ),
                  )}
                  variant="outline"
                >
                  Final Alat:{" "}
                  {existingReview?.approvedEquipment === true
                    ? "Disetujui"
                    : existingReview?.approvedEquipment === false
                      ? "Ditolak"
                      : "Belum Ditetapkan"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ===== UTAMA: PEMILIH 3 HALAMAN (TAB NAV PILLS) ===== */}
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">Pilih Kategori Data untuk Diverifikasi</p>
              <p className="text-xs text-slate-500">
                Setiap kategori memiliki tampilan PERSIS seperti halaman input sekolah, ditambah panel komentar &amp; status persetujuan per Konsentrasi Keahlian.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(tabMeta) as MainTabKey[]).map((key) => {
                const meta = tabMeta[key];
                const active = mainTab === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setMainTab(key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                      active
                        ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                        : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    <span className={cn(active ? "text-white" : "text-slate-500")}>{meta.icon}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ==================================================== */}
          {/* ===== HALAMAN 1: KONSENTRASI KEHAHLIAN ============== */}
          {/* ===== STRUKTUR CARD SENDIRI, TIDAK DIGABUNG ======== */}
          {/* ==================================================== */}
          {mainTab === "konsentrasi" ? (
            <Card className="rounded-[28px]">
              <CardHeader className="gap-3">
                <CardTitle className="text-2xl text-slate-950">Data Konsentrasi Keahlian</CardTitle>
                <p className="text-sm leading-7 text-slate-600">
                  Data di bawah ini diambil dari profil sekolah. Klik satu baris konsentrasi untuk melihat detail &amp; memberikan komentar serta status persetujuan.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {profile.concentrations.length ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          Data Konsentrasi dari Profil Sekolah
                        </p>
                        <p className="text-xs text-slate-500">
                          Pilih baris konsentrasi untuk menampilkan detail KK &amp; panel review.
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {profile.concentrations.length} Konsentrasi
                      </Badge>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-[980px] w-full text-sm">
                          <thead className="bg-slate-100/80 text-slate-600">
                            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                              <th className="px-4 py-3">Konsentrasi Keahlian</th>
                              <th className="px-4 py-3">Rombongan Belajar</th>
                              <th className="px-4 py-3">Total Siswa</th>
                              <th className="px-4 py-3">Luas Ruang Praktik</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {profile.concentrations.map((kk) => {
                              const isActive = kk.code === selectedConcentrationCode;
                              const rombelTotal = (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
                              const siswaTotal = (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
                              const review = getPerKk(kk.code).konsentrasi;
                              return (
                                <tr
                                  key={kk.code}
                                  onClick={() => setSelectedConcentrationCode(kk.code)}
                                  className={cn(
                                    "cursor-pointer align-top transition border-l-4",
                                    isActive
                                      ? "bg-primary/10 border-l-primary hover:bg-primary/10"
                                      : "bg-white border-l-transparent hover:bg-slate-50",
                                  )}
                                >
                                  <td className="px-4 py-4">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={cn(
                                            "text-xs font-semibold uppercase tracking-[0.16em]",
                                            isActive ? "text-primary-700" : "text-slate-500",
                                          )}
                                        >
                                          {kk.code}
                                        </span>
                                      </div>
                                      <p
                                        className={cn(
                                          "font-semibold leading-5",
                                          isActive ? "text-primary-800" : "text-slate-950",
                                        )}
                                      >
                                        {kk.name}
                                      </p>
                                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        <Badge className={cn("border", reviewStatusVariant(review.status))} variant="outline">
                                          {reviewStatusLabel(review.status)}
                                        </Badge>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 align-top">
                                    <p className="font-semibold text-slate-900">{rombelTotal} rombongan</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      10:{kk.rombel10 ?? 0} · 11:{kk.rombel11 ?? 0} · 12:{kk.rombel12 ?? 0}
                                    </p>
                                  </td>
                                  <td className="px-4 py-4 align-top">
                                    <p className="font-semibold text-slate-900">
                                      {siswaTotal.toLocaleString("id-ID")} orang
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      10:{(kk.student10 ?? 0).toLocaleString("id-ID")} · 11:
                                      {(kk.student11 ?? 0).toLocaleString("id-ID")} · 12:
                                      {(kk.student12 ?? 0).toLocaleString("id-ID")}
                                    </p>
                                  </td>
                                  <td className="px-4 py-4 align-top font-medium text-slate-900">
                                    {kk.luasRuanganRps?.trim() || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {/* DETAIL KK DIPILIH */}
                  {selectedKk ? (
                    <section className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Total Rombongan Belajar
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            {(selectedKk.rombel10 ?? 0) + (selectedKk.rombel11 ?? 0) + (selectedKk.rombel12 ?? 0)}{" "}
                            rombongan
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Total Siswa
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            {(
                              (selectedKk.student10 ?? 0) +
                              (selectedKk.student11 ?? 0) +
                              (selectedKk.student12 ?? 0)
                            ).toLocaleString("id-ID")}{" "}
                            orang
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Luas Ruang Praktik
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            {selectedKk.luasRuanganRps?.trim() || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {(["10", "11", "12"] as const).map((grade) => {
                          const rk = `rombel${grade}` as const;
                          const sk = `student${grade}` as const;
                          return (
                            <div
                              key={grade}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 text-sm"
                            >
                              <span className="text-slate-600">Kelas {grade}</span>
                              <span className="font-semibold text-slate-900">
                                {selectedKk[rk] ?? 0} rombel • {(selectedKk[sk] ?? 0).toLocaleString("id-ID")} siswa
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {(() => {
                        const docCode = buildRpsDocumentCode(selectedKk.code);
                        const rpsDoc =
                          administrativeDocuments.find((d) => d.code === docCode) ??
                          administrativeDocuments.find(
                            (d) =>
                              (isRpsDocumentCode(d.code) || Boolean(d.isRpsPerConcentration)) &&
                              String(d.code || "").toLowerCase().endsWith(
                                String(selectedKk.code || "").trim().toLowerCase(),
                              ),
                          ) ??
                          null;
                        const filesArr: Array<{
                          id: string | number;
                          url: string;
                          name: string;
                          mime: string;
                          size: number;
                        }> = [];
                        if (rpsDoc) {
                          if (Array.isArray(rpsDoc.files) && rpsDoc.files.length) {
                            rpsDoc.files.forEach((f, idx) => {
                              filesArr.push({
                                id: f.id || idx,
                                url: f.filePath,
                                name: f.fileName,
                                mime: f.mimeType || rpsDoc.mimeType || "",
                                size: f.fileSize || rpsDoc.fileSize || 0,
                              });
                            });
                          } else if (rpsDoc.filePath) {
                            filesArr.push({
                              id: "single",
                              url: rpsDoc.filePath,
                              name: rpsDoc.fileName || rpsDoc.name || "Dokumen RPS",
                              mime: rpsDoc.mimeType || "",
                              size: rpsDoc.fileSize || 0,
                            });
                          }
                        }
                        return (
                          <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-start gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white">
                                  <ImageIcon className="h-4 w-4 text-slate-500" />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    Dokumen Bukti RPS • {selectedKk.code || "—"}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    Foto / dokumen upload sekolah untuk bukti Rencana Pelaksanaan Praktik (RPS) ruang praktik KK.
                                  </p>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border",
                                  rpsDoc && filesArr.length > 0
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700",
                                )}
                              >
                                {rpsDoc && filesArr.length > 0
                                  ? `${filesArr.length} file diunggah`
                                  : "Belum ada bukti RPS"}
                              </Badge>
                            </div>
                            {filesArr.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs italic text-slate-400">
                                <p>Sekolah belum mengunggah foto bukti RPS untuk Konsentrasi {selectedKk.code || "-"}.</p>
                                <p className="mt-1">
                                  Silakan hubungi pihak sekolah untuk melengkapi upload di menu sekolah{" "}
                                  <span className="font-medium">Profil → Tab Konsentrasi Keahlian → Dokumen RPS.</span>
                                </p>
                              </div>
                            ) : (
                              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {filesArr.map((f) => {
                                  const isImg = isImage(f.mime);
                                  const pdf = isPdf(f.mime);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => isImg && setImgPreview({ url: f.url, name: f.name })}
                                      className={cn(
                                        "group w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-primary/50 hover:ring-2 hover:ring-primary/15",
                                        isImg ? "cursor-pointer" : "cursor-default",
                                      )}
                                      title={isImg ? `Klik untuk preview besar: ${f.name}` : f.name}
                                    >
                                      <div className="aspect-square w-full bg-slate-100 overflow-hidden">
                                        {isImg ? (
                                          <img
                                            src={f.url}
                                            alt={f.name}
                                            loading="lazy"
                                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                                          />
                                        ) : pdf ? (
                                          <div className="flex h-full w-full items-center justify-center flex-col gap-2 p-3">
                                            <FileSpreadsheet className="h-8 w-8 text-rose-500" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">PDF</span>
                                          </div>
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center flex-col gap-2 p-3">
                                            <FileDown className="h-8 w-8 text-slate-400" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">FILE</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="px-2 py-2 space-y-0.5 border-t border-slate-100">
                                        <p className="truncate text-[11px] font-medium text-slate-900" title={f.name}>
                                          {f.name}
                                        </p>
                                        <p className="truncate text-[10px] text-slate-500">{formatFileSize(f.size || 0)}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        );
                      })()}

                      {renderReviewPanel(selectedKk.code, "konsentrasi", <Users className="h-5 w-5" />, "Konsentrasi Keahlian")}
                    </section>
                  ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* ==================================================== */}
          {/* ===== HALAMAN 2: DATA SARANA ======================= */}
          {/* ===== LAZY RENDER — HANYA MOUNT JIKA TAB DIBUKA ====== */}
          {/* ==================================================== */}
          <DetailTabLazyWrap active={mainTab === "sarana"} skeletonRows={24}>
            {mainTab === "sarana" ? (
              <Card className="rounded-[28px]">
                <CardHeader className="gap-3">
                  <CardTitle className="text-2xl text-slate-950">Data Sarana Sekolah</CardTitle>
                <p className="text-sm leading-7 text-slate-600">
                  Tabel di bawah menampilkan data alat yang sama dengan halaman sekolah/alat. Pilih satu konsentrasi keahlian untuk melihat detail peralatan, lalu gunakan panel review di bawah untuk memberikan komentar &amp; status persetujuan.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {missingCodes.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Referensi alat belum ditemukan untuk kode konsentrasi: {missingCodes.join(", ")}.
                  </div>
                ) : null}

                {/* ===== TABLE LIST KK (PERSIS school-equipment L1187-L1278) ===== */}
                {profile.concentrations.length ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Data Konsentrasi dari Profil Sekolah</p>
                        <p className="text-xs text-slate-500">
                          Pilih baris konsentrasi untuk menampilkan tabel alat yang sesuai.
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {profile.concentrations.length} Konsentrasi
                      </Badge>
                    </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-[1080px] w-full text-sm">
                          <thead className="bg-slate-100/80 text-slate-600">
                            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                              <th className="px-4 py-3">Konsentrasi Keahlian</th>
                              <th className="px-4 py-3">Jumlah Alat Dimiliki</th>
                              <th className="px-4 py-3">Kondisi Baik / Rusak</th>
                              <th className="px-4 py-3">Jumlah Kebutuhan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {concentrationSummaries.map((item) => {
                              const isActive = item.code === selectedConcentrationCode;
                              const review = getPerKk(item.code).sarana;
                              return (
                                <tr
                                  key={`${item.code}-${item.name}`}
                                  onClick={() => setSelectedConcentrationCode(item.code)}
                                  className={`cursor-pointer align-top transition border-l-4 ${
                                    isActive
                                      ? "bg-primary/10 border-l-primary hover:bg-primary/10"
                                      : "bg-white border-l-transparent hover:bg-slate-50"
                                  }`}
                                >
                                  <td className="px-4 py-4">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${isActive ? "text-primary-700" : "text-slate-500"}`}>
                                          {item.code}
                                        </span>
                                        <Badge className={cn("border", reviewStatusVariant(review.status))} variant="outline">
                                          {reviewStatusLabel(review.status)}
                                        </Badge>
                                      </div>
                                      <p className={`font-semibold ${isActive ? "text-primary-800" : "text-slate-950"}`}>{item.name}</p>
                                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1">Rombel: {item.rombelCount}</span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1">Siswa: {item.studentCount.toLocaleString("id-ID")}</span>
                                        {!item.hasReference ? (
                                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                            Referensi belum tersedia
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="space-y-1 text-sm text-slate-700">
                                      <p>
                                        Minimal {item.categorySummaries["Peralatan Praktik Utama Kriteria Minimal"].owned}/
                                        {item.categorySummaries["Peralatan Praktik Utama Kriteria Minimal"].total}
                                      </p>
                                      <p>
                                        Pengembangan {item.categorySummaries["Peralatan Praktik Utama Kriteria Pengembangan"].owned}/
                                        {item.categorySummaries["Peralatan Praktik Utama Kriteria Pengembangan"].total}
                                      </p>
                                      <p>
                                        Pendukung {item.categorySummaries["Peralatan Praktik Pendukung"].owned}/
                                        {item.categorySummaries["Peralatan Praktik Pendukung"].total}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="space-y-1 text-sm text-slate-700">
                                      <p>Baik: {item.totalGood}</p>
                                      <p>Rusak: {item.totalBad}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 font-medium text-slate-900">{item.totalNeeded}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {/* ===== KATEGORI PILLS BUTTON ===== */}
                  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Kategori Alat</p>
                      <p className="text-xs text-slate-500">Pilih kategori alat untuk menampilkan satu tabel yang aktif.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {kategoriTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveKategori(tab.key)}
                          className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                            activeKategori === tab.key
                              ? "border-primary bg-primary text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ===== SECTION BIDANG / PROGRAM / KK + GRID 12 KOLOM ===== */}
                  {selectedReference ? (
                    <section
                      key={selectedReference.concentrationCode}
                      className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {selectedReference.bidangCode}. Bidang Keahlian
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">{selectedReference.bidangName}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {selectedReference.programCode}. Program Keahlian
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">{selectedReference.programName}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {selectedReference.concentrationCode}. Konsentrasi Keahlian
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">{selectedReference.concentrationName}</p>
                        </div>
                      </div>

                      {[activeKategori].map((kategori) => {
                        if (!profile) return null;
                        const tableKey = getTableKey(profile.schoolId, selectedReference.concentrationCode, kategori);
                        const rows = getEquipmentRows(selectedReference, kategori);

                        return (
                          <div
                            key={`${selectedReference.concentrationCode}-${kategori}`}
                            className="space-y-3 rounded-[20px] border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">{kategori}</p>
                                <p className="text-xs text-slate-500">{rows.length} item alat</p>
                              </div>
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                <NotebookPen className="mr-1 h-3.5 w-3.5" />
                                View-only · Verifikasi
                              </Badge>
                            </div>

                            <div className="rounded-xl border border-slate-200">
                              <div className="overflow-x-auto">
                                <div className="min-w-[2320px]">
                                  <div className="grid grid-cols-[84px_minmax(260px,1.05fr)_minmax(240px,0.9fr)_minmax(360px,1.35fr)_minmax(180px,0.7fr)_160px_140px_140px_140px_160px_260px_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                    <span>No</span>
                                    <span>Nama Alat</span>
                                    <span>Fungsi</span>
                                    <span>Spesifikasi</span>
                                    <span>Rasio</span>
                                    <span>Kepemilikan</span>
                                    <span>Jumlah</span>
                                    <span>Kondisi Baik</span>
                                    <span>Kondisi Rusak</span>
                                    <span>Kebutuhan</span>
                                    <span>Keterangan</span>
                                    <span>Asal</span>
                                  </div>

                                  <div className="divide-y divide-slate-200 bg-white">
                                    {rows.length === 0 ? (
                                      <div className="px-4 py-6 text-sm text-slate-600">
                                        Belum ada data alat pada tabel ini untuk kategori {kategori}.
                                      </div>
                                    ) : (
                                      rows.map((row, index) => (
                                        <div
                                          key={`${tableKey}-${index}`}
                                          className="grid grid-cols-[84px_minmax(260px,1.05fr)_minmax(240px,0.9fr)_minmax(360px,1.35fr)_minmax(180px,0.7fr)_160px_140px_140px_140px_160px_260px_88px] gap-3 px-4 py-3 align-top"
                                        >
                                          <p className="pt-2 text-sm font-semibold text-slate-500">{index + 1}</p>
                                          <p className="text-sm font-semibold leading-6 text-slate-900">{row.name}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.functionText || "-"}</p>
                                          <pre className="font-sans whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                                            {row.specificationText || "-"}
                                          </pre>
                                          <p className="text-sm leading-6 text-slate-700">{row.ratio || "-"}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.ownership || "-"}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.quantity || "-"}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.goodCondition || "-"}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.badCondition || "-"}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.needed || "-"}</p>
                                          <p className="text-sm leading-6 text-slate-700">{row.notes || "-"}</p>
                                          <p className="text-center text-sm leading-6 text-slate-500">
                                            {row.isCustom ? "Custom" : "Referensi"}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* PANEL REVIEW DATA SARANA DI BAWAH */}
                      {selectedConcentrationCode
                        ? renderReviewPanel(selectedConcentrationCode, "sarana", <Boxes className="h-5 w-5" />, "Data Sarana & Alat")
                        : null}
                    </section>
                  ) : !loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                      Pilih konsentrasi dari profil sekolah untuk menampilkan data alat.
                    </div>
                  ) : null}
              </CardContent>
            </Card>
            ) : null}
          </DetailTabLazyWrap>

          {/* ==================================================== */}
          {/* ===== HALAMAN 3: DATA PENGAJUAN ===================== */}
          {/* ===== LAZY RENDER — HANYA MOUNT JIKA TAB DIBUKA ====== */}
          {/* ==================================================== */}
          <DetailTabLazyWrap active={mainTab === "pengajuan"} skeletonRows={32}>
            {mainTab === "pengajuan" ? (
              <Card className="rounded-[28px]">
                <CardHeader className="gap-3">
                  <CardTitle className="text-2xl text-slate-950">Data Pengajuan Sarana Sesuai Konsentrasi Keahlian</CardTitle>
                  <p className="text-sm leading-7 text-slate-600">
                    Pilih satu konsentrasi keahlian dari profil sekolah. Tabel ajuan alat di bawah akan mengikuti konsentrasi yang sedang dipilih (sama persis dengan tampilan sekolah/pengajuan). Gunakan panel review di bawah untuk memberikan komentar &amp; status persetujuan per KK.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                {/* ===== TABEL LIST KK PICKER ATAS (PERSIS school-proposal L2317-L2377) ===== */}
                {concentrationRows.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-[920px] w-full text-sm">
                      <thead className="bg-slate-100/80 text-slate-600">
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                          <th className="px-4 py-3">Konsentrasi Keahlian</th>
                          <th className="px-4 py-3">Rombel</th>
                          <th className="px-4 py-3">Siswa</th>
                          <th className="px-4 py-3">Total Ajuan Alat</th>
                          <th className="px-4 py-3">Ajuan Sesuai RAB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {concentrationRows.map((item) => {
                          const isActive = item.code === selectedConcentrationCode;
                          const review = getPerKk(item.code).pengajuan;
                          return (
                            <tr
                              key={item.code}
                              onClick={() => setSelectedConcentrationCode(item.code)}
                              className={`cursor-pointer transition border-l-4 ${
                                isActive
                                  ? "bg-primary/10 border-l-primary hover:bg-primary/10"
                                  : "bg-white border-l-transparent hover:bg-slate-50"
                              }`}
                            >
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${isActive ? "text-primary-700" : "text-slate-500"}`}>
                                      {item.code}
                                    </span>
                                    <Badge className={cn("border", reviewStatusVariant(review.status))} variant="outline">
                                        {reviewStatusLabel(review.status)}
                                      </Badge>
                                    </div>
                                    <p className={`font-semibold ${isActive ? "text-primary-800" : "text-slate-950"}`}>{item.name}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-slate-700">{item.rombelCount}</td>
                                <td className="px-4 py-4 text-slate-700">{item.studentCount.toLocaleString("id-ID")}</td>
                                <td className="px-4 py-4 text-slate-700">{item.totalProposalItems}</td>
                                <td className="px-4 py-4 font-medium text-slate-700">
                                  Rp {item.totalProposalValue.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50">
                          <tr className="border-t border-slate-200 text-sm font-semibold text-slate-950">
                            <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-[0.16em] text-slate-600">
                              Total Semua Konsentrasi
                            </td>
                            <td className="px-4 py-3">{totalAllConcentrationsProposalItems}</td>
                            <td className="px-4 py-3">Rp {totalAllConcentrationsProposalValue.toLocaleString("id-ID")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : null}

                  {/* ===== SECTION 3 TAB PILLS: SURVEY / RPKP / RAB ===== */}
                  {selectedReference || activeProposalTab === "rab" ? (
                    <section className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap gap-2">
                        {proposalTabConfigs.map((tab) => {
                          const isActive = tab.key === activeProposalTab;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setActiveProposalTab(tab.key)}
                              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                isActive
                                  ? "border-primary bg-primary text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-950">
                            {activeProposalTabConfig.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {activeProposalTab === "rpkp"
                              ? "Nama alat diambil dari ajuan survey, fungsi mengikuti alat yang dipilih pada kolom kesesuaian, lalu total estimasi harga bisa dipilih dari toko 1, 2, atau 3."
                              : activeProposalTab === "rab"
                                ? "RAB (Rencana Anggaran Belanja) dihitung OTOMATIS sebagai RINGKASAN TOTAL dari SELURUH RPKP per Konsentrasi Keahlian. Setiap total RPKP per Konsentrasi (KK) dijumlahkan menjadi 1 total keseluruhan sekolah."
                                : "Kesesuaian menampilkan daftar alat dari kategori minimal, pengembangan, dan pendukung untuk konsentrasi yang sedang dipilih."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {activeProposalTab === "rab" ? (
                            <Badge variant="secondary" className="rounded-full px-3 py-1 border-emerald-200 bg-emerald-50 text-emerald-800">
                              <CheckCircle2 className="mr-1.5 h-3 w-3" />
                              Seluruh Konsentrasi Keahlian ({concentrationRows.length} KK)
                            </Badge>
                          ) : selectedReference ? (
                            <Badge variant="secondary" className="rounded-full px-3 py-1">
                              {selectedReference.concentrationCode} - {selectedReference.concentrationName}
                            </Badge>
                          ) : null}
                          {activeProposalTab === "rab" ? (
                            <Badge
                              variant="success"
                              className="rounded-full px-3 py-1 border-emerald-300 bg-emerald-50 text-emerald-800"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-700" />
                              Tersinkron Otomatis dari RPKP
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {/* ====== RENDER TAB RPKP ====== */}
                      {activeProposalTab === "rpkp" ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="min-w-[1100px] w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              <tr className="border-b border-slate-200">
                                <th className="w-16 px-3 py-3">No</th>
                                <th className="min-w-[260px] px-3 py-3">Nama Alat</th>
                                <th className="min-w-[260px] px-3 py-3">Fungsi</th>
                                <th className="min-w-[260px] px-3 py-3">Spesifikasi</th>
                                <th className="min-w-[280px] px-3 py-3">Total Estimasi Harga</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {rpkpRows.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-600">
                                    Belum ada data ajuan alat pada tab Survey Harga Pasar untuk konsentrasi ini.
                                  </td>
                                </tr>
                              ) : (
                                rpkpRows.map((row, index) => (
                                  <tr key={row.id} className="align-top">
                                    <td className="px-3 py-3 text-sm font-semibold text-slate-500">{index + 1}</td>
                                    <td className="px-3 py-3 font-semibold text-slate-900">{row.name || "-"}</td>
                                    <td className="px-3 py-3 text-slate-700">{row.functionText || "-"}</td>
                                    <td className="px-3 py-3 text-slate-700">{row.specification || "-"}</td>
                                    <td className="px-3 py-3">
                                      <div className="space-y-2">
                                        <div
                                          className={cn(
                                            "h-10 w-full rounded-md border border-slate-200 px-3 text-sm flex items-center",
                                            row.selectedShop ? "text-slate-900" : "text-slate-400 italic",
                                          )}
                                        >
                                          {row.selectedShop
                                            ? shopConfigs.find((s) => s.key === row.selectedShop)?.label
                                            : "Belum ada pilihan toko (di Survey/RPKP)"}
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Nilai Estimasi</p>
                                          <p className="mt-1 font-semibold text-slate-950">
                                            {parseCurrencyNumber(row.selectedQuote.totalPrice) > 0
                                              ? `Rp ${parseCurrencyNumber(row.selectedQuote.totalPrice).toLocaleString("id-ID")}`
                                              : "-"}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            {rpkpRows.length > 0 ? (
                              <tfoot className="bg-slate-50">
                                <tr className="border-t border-slate-200">
                                  <td
                                    colSpan={4}
                                    className="px-3 py-3 text-right text-sm font-semibold uppercase tracking-[0.16em] text-slate-600"
                                  >
                                    Total
                                  </td>
                                  <td className="px-3 py-3 text-sm font-semibold text-slate-950">
                                    Rp {rpkpGrandTotal.toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              </tfoot>
                            ) : null}
                          </table>
                        </div>
                      ) : activeProposalTab === "rab" ? (
                        // ===== RENDER TAB RAB =====
                        <div className="space-y-5">
                          <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
                            <Badge variant="secondary" className="border-emerald-300 bg-white text-emerald-800">
                              <Wrench className="mr-1.5 h-3 w-3" />
                              Catatan Perhitungan RAB
                            </Badge>
                            <p className="leading-6">
                              RAB ini merupakan <strong>total agregasi dari seluruh RPKP per Konsentrasi Keahlian (KK)</strong>.
                              Setiap baris mewakili 1 KK = total semua barang di Survey + pilihan toko RPKP.
                            </p>
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="min-w-[1180px] w-full text-sm">
                              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                <tr className="border-b border-slate-200">
                                  <th className="w-12 px-2 py-3"></th>
                                  <th className="w-16 px-4 py-3">No</th>
                                  <th className="min-w-[180px] px-4 py-3">Kode KK</th>
                                  <th className="min-w-[340px] px-4 py-3">Konsentrasi Keahlian</th>
                                  <th className="min-w-[160px] px-4 py-3 text-right">Jumlah Item Alat</th>
                                  <th className="min-w-[160px] px-4 py-3 text-right">Total Unit Dibeli</th>
                                  <th className="min-w-[260px] px-4 py-3 text-right">Total Nilai RPKP (Menjadi RAB)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {concentrationRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-6 text-sm text-slate-600">
                                      Belum ada data Konsentrasi Keahlian.
                                    </td>
                                  </tr>
                                ) : concentrationRows.every((kk) => kk.totalProposalItems === 0) ? (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-6 text-sm text-slate-600">
                                      Belum ada isi Survey Harga Pasar / RPKP di semua Konsentrasi Keahlian.
                                    </td>
                                  </tr>
                                ) : (
                                  concentrationRows.flatMap((kk, index) => {
                                    const isExpanded = expandedRabCodes.has(kk.code);
                                    const toggleExpand = () => {
                                      setExpandedRabCodes((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(kk.code)) {
                                          next.delete(kk.code);
                                        } else {
                                          next.add(kk.code);
                                        }
                                        return next;
                                      });
                                    };
                                    return [
                                      <tr key={kk.code} className={kk.totalProposalItems === 0 ? "opacity-60" : ""}>
                                        <td className="px-2 py-3.5 align-top">
                                          {kk.totalProposalItems > 0 ? (
                                            <button
                                              type="button"
                                              onClick={toggleExpand}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                              aria-label={isExpanded ? "Sembunyikan rincian alat" : "Tampilkan rincian alat"}
                                            >
                                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
                                          ) : null}
                                        </td>
                                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-500">{index + 1}</td>
                                        <td className="px-4 py-3.5">
                                          <Badge className="bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold tracking-wide">
                                            {kk.code}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 font-semibold text-slate-900 leading-6">{kk.name}</td>
                                        <td className="px-4 py-3.5 text-right text-slate-700 font-semibold tabular-nums">
                                          {kk.totalProposalItems.toLocaleString("id-ID")}
                                          <span className="ml-1.5 text-[11px] text-slate-400 font-normal">item</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-slate-700 font-semibold tabular-nums">
                                          {(kk.totalUnits ?? 0).toLocaleString("id-ID")}
                                          <span className="ml-1.5 text-[11px] text-slate-400 font-normal">unit</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-slate-950 font-bold tabular-nums text-base">
                                          {kk.totalProposalValue > 0
                                            ? `Rp ${kk.totalProposalValue.toLocaleString("id-ID")}`
                                            : <span className="text-slate-400 italic font-normal text-xs">Belum ada RPKP</span>}
                                        </td>
                                      </tr>,
                                      isExpanded && kk.equipmentDetails?.length ? (
                                        <tr key={`${kk.code}__detail`} className="bg-indigo-50/40">
                                          <td colSpan={7} className="px-4 py-4">
                                            <div className="pl-8">
                                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="border-indigo-200 bg-white text-indigo-700 text-[11px] font-bold tracking-wide">
                                                  <Wrench className="mr-1.5 h-3 w-3" />
                                                  Rincian Alat Dibeli — {kk.name}
                                                </Badge>
                                              </div>
                                              <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white">
                                                <table className="min-w-full w-full text-sm">
                                                  <thead className="bg-indigo-50/60 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                                                    <tr className="border-b border-indigo-100">
                                                      <th className="w-12 px-3 py-2.5">No</th>
                                                      <th className="min-w-[320px] px-3 py-2.5">Nama Alat</th>
                                                      <th className="min-w-[120px] px-3 py-2.5 text-right">Jumlah</th>
                                                      <th className="min-w-[220px] px-3 py-2.5 text-right">Harga Satuan (Rp)</th>
                                                      <th className="min-w-[240px] px-3 py-2.5 text-right">Total (Rp)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-indigo-50 bg-white">
                                                    {kk.equipmentDetails.map((eq, eqIndex) => (
                                                      <tr key={eq.id} className="hover:bg-indigo-50/30">
                                                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-500">{eqIndex + 1}</td>
                                                        <td className="px-3 py-2.5 text-slate-900 font-medium leading-5">{eq.name || <span className="text-slate-400 italic">—</span>}</td>
                                                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800 tabular-nums">{eq.quantity.toLocaleString("id-ID")}</td>
                                                        <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                                                          {eq.unitPrice > 0 ? `Rp ${eq.unitPrice.toLocaleString("id-ID")}` : <span className="text-slate-400 italic">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-semibold text-slate-950 tabular-nums">
                                                          {eq.subtotal > 0 ? `Rp ${eq.subtotal.toLocaleString("id-ID")}` : <span className="text-slate-400 italic">—</span>}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                  {kk.totalProposalValue > 0 ? (
                                                    <tfoot className="bg-indigo-50/70">
                                                      <tr className="border-t border-indigo-100">
                                                        <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.16em] text-indigo-800">
                                                          Subtotal {kk.code}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-bold text-indigo-900 tabular-nums text-sm">
                                                          Rp {kk.totalProposalValue.toLocaleString("id-ID")}
                                                        </td>
                                                      </tr>
                                                    </tfoot>
                                                  ) : null}
                                                </table>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      ) : null,
                                    ];
                                  })
                                )}
                              </tbody>
                              {totalAllConcentrationsProposalValue > 0 ? (
                                <tfoot className="bg-slate-50">
                                  <tr className="border-t border-slate-200">
                                    <td colSpan={4} className="px-4 py-3.5 text-right text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
                                      Total RAB Seluruh Konsentrasi
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums">
                                      {totalAllConcentrationsProposalItems.toLocaleString("id-ID")}
                                      <span className="ml-1.5 text-[11px] text-slate-500 font-normal">item</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums">
                                      {totalAllConcentrationsUnits.toLocaleString("id-ID")}
                                      <span className="ml-1.5 text-[11px] text-slate-500 font-normal">unit</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums text-base">
                                      Rp {totalAllConcentrationsProposalValue.toLocaleString("id-ID")}
                                    </td>
                                  </tr>
                                  <tr className="border-t border-slate-200 bg-emerald-50/60">
                                    <td colSpan={4} className="px-4 py-3.5 text-right text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
                                      Total RAB (Dibulatkan ke Ribuan)
                                    </td>
                                    <td colSpan={2} className="px-4 py-3.5"></td>
                                    <td className="px-4 py-3.5 text-right font-extrabold text-emerald-900 tabular-nums text-lg">
                                      Rp {roundToNearestThousand(totalAllConcentrationsProposalValue).toLocaleString("id-ID")}
                                    </td>
                                  </tr>
                                </tfoot>
                              ) : null}
                            </table>
                          </div>
                        </div>
                      ) : (
                        // ===== RENDER TAB SURVEY =====
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="min-w-[3200px] w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                <th rowSpan={2} className="w-16 px-3 py-3 align-middle">
                                  No
                                </th>
                                <th rowSpan={2} className="min-w-[240px] px-3 py-3 align-middle">
                                  Nama Alat
                                </th>
                                <th rowSpan={2} className="min-w-[240px] px-3 py-3 align-middle">
                                  Spesifikasi
                                </th>
                                <th rowSpan={2} className="min-w-[260px] px-3 py-3 align-middle">
                                  Kesesuaian
                                </th>
                                <th rowSpan={2} className="min-w-[120px] px-3 py-3 align-middle">
                                  Jumlah
                                </th>
                                <th rowSpan={2} className="min-w-[120px] px-3 py-3 align-middle">
                                  Satuan
                                </th>
                                <th rowSpan={2} className="min-w-[260px] px-3 py-3 align-middle border-l border-slate-200">
                                  Bukti Screenshot SIPLAH
                                </th>
                                {shopConfigs.map((shop) => (
                                  <th
                                    key={shop.key}
                                    colSpan={6}
                                    className={`border-l border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] ${shop.headerClass}`}
                                  >
                                    {shop.label}
                                  </th>
                                ))}
                              </tr>
                              <tr className="border-b border-slate-200 bg-white text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {shopConfigs.flatMap((shop) => [
                                  <th key={`${shop.key}-name`} className="min-w-[190px] border-l border-slate-200 px-3 py-3">
                                    Nama Toko
                                  </th>,
                                  <th key={`${shop.key}-price`} className="min-w-[170px] px-3 py-3">
                                    Harga + Pajak
                                  </th>,
                                  <th key={`${shop.key}-shipping`} className="min-w-[170px] px-3 py-3">
                                    Biaya Kirim
                                  </th>,
                                  <th key={`${shop.key}-install`} className="min-w-[190px] px-3 py-3">
                                    Biaya Instalasi
                                  </th>,
                                  <th key={`${shop.key}-total`} className="min-w-[170px] px-3 py-3">
                                    Total Harga
                                  </th>,
                                  <th key={`${shop.key}-link`} className="min-w-[220px] px-3 py-3">
                                    Link
                                  </th>,
                                ])}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {surveyRows.length === 0 ? (
                                <tr>
                                  <td colSpan={26} className="px-4 py-6 text-sm text-slate-600">
                                    Belum ada item ajuan alat untuk konsentrasi ini.
                                  </td>
                                </tr>
                              ) : (
                                surveyRows.map((row, index) => (
                                  <tr key={row.id} className="align-top">
                                    <td className="px-3 py-3 text-sm font-semibold text-slate-500">{index + 1}</td>
                                    <td className="px-3 py-3 font-semibold text-slate-900">{row.name || "-"}</td>
                                    <td className="px-3 py-3 text-slate-700 leading-6 whitespace-pre-wrap">{row.specification || "-"}</td>
                                    <td className="px-3 py-3 text-slate-700">{row.conformity || "-"}</td>
                                    <td className="px-3 py-3 text-slate-700">{row.quantity || "-"}</td>
                                    <td className="px-3 py-3 text-slate-700">{row.unit || "-"}</td>
                                    <td className="border-l border-slate-200 px-3 py-3 align-top">
                                      <div className="space-y-2 min-w-[240px]">
                                        {shopConfigs.map((shop) => {
                                          const shopDraft = row[shop.key as ShopKey];
                                          const screens = shopDraft.siplahScreenshots;
                                          return (
                                            <div key={`${row.id}-${shop.key}-screens-view`} className="space-y-1.5">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide`}
                                                  style={{
                                                    backgroundColor:
                                                      shop.key === "shop1" ? "#ecfdf5" : shop.key === "shop2" ? "#fef2f2" : "#eef2ff",
                                                    color:
                                                      shop.key === "shop1" ? "#065f46" : shop.key === "shop2" ? "#991b1b" : "#3730a3",
                                                  }}
                                                >
                                                  <span className="text-[10px]">{shop.emoji}</span>
                                                  {shop.label.replace("Anggaran ", "")}
                                                </span>
                                                <span
                                                  className="text-[10px] font-medium text-slate-600 truncate max-w-[110px]"
                                                  title={shopDraft.name}
                                                >
                                                  {shopDraft.name || "-"}
                                                </span>
                                              </div>
                                              {screens.length === 0 ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] italic text-slate-400 pl-0.5">
                                                  <ImageIcon className="h-3 w-3" />
                                                  Belum ada screenshot
                                                </span>
                                              ) : (
                                                <div className="flex items-center gap-1.5">
                                                  <div className="flex -space-x-1.5">
                                                    {screens.slice(0, 3).map((s) => (
                                                      <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() =>
                                                          setImgPreview({ url: s.dataUrl, name: s.fileName })
                                                        }
                                                        className="group inline-block h-8 w-8 overflow-hidden rounded-md border border-slate-200 bg-slate-50 ring-2 ring-white shadow-sm cursor-pointer transition hover:border-primary/70 hover:ring-primary/30 hover:scale-[1.05] z-10"
                                                        title={`Klik preview: ${s.fileName}`}
                                                      >
                                                        <img
                                                          src={s.dataUrl}
                                                          alt={s.fileName}
                                                          loading="lazy"
                                                          className="h-full w-full object-cover"
                                                        />
                                                      </button>
                                                    ))}
                                                    {screens.length > 3 ? (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setImgPreview({
                                                            url: screens[3].dataUrl,
                                                            name: screens[3].fileName,
                                                          })
                                                        }
                                                        className="group inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[9px] font-bold text-slate-600 ring-2 ring-white shadow-sm cursor-pointer transition hover:border-primary/70 hover:ring-primary/30 hover:text-primary"
                                                        title={`${screens.length - 3} screenshot lainnya (klik untuk preview)`}
                                                      >
                                                        +{screens.length - 3}
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] px-1.5 py-0">
                                                    {screens.length}
                                                  </Badge>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>
                                    {shopConfigs.flatMap((shop) => [
                                      <td
                                        key={`${row.id}-${shop.key}-name-view`}
                                        className={`px-3 py-3 text-slate-700 font-medium ${shop.key === "shop1" ? "border-l border-slate-200" : ""}`}
                                      >
                                        {row[shop.key].name || <span className="text-slate-400 italic">-</span>}
                                      </td>,
                                      <td key={`${row.id}-${shop.key}-price-view`} className="px-3 py-3 text-slate-700 tabular-nums">
                                        {parseCurrencyNumber(row[shop.key].priceWithTax) > 0
                                          ? `Rp ${parseCurrencyNumber(row[shop.key].priceWithTax).toLocaleString("id-ID")}`
                                          : <span className="text-slate-400 italic">-</span>}
                                      </td>,
                                      <td key={`${row.id}-${shop.key}-shipping-view`} className="px-3 py-3 text-slate-700 tabular-nums">
                                        {parseCurrencyNumber(row[shop.key].shippingCost) > 0
                                          ? `Rp ${parseCurrencyNumber(row[shop.key].shippingCost).toLocaleString("id-ID")}`
                                          : <span className="text-slate-400 italic">-</span>}
                                      </td>,
                                      <td key={`${row.id}-${shop.key}-install-view`} className="px-3 py-3 text-slate-700 tabular-nums">
                                        {parseCurrencyNumber(row[shop.key].installationCost) > 0
                                          ? `Rp ${parseCurrencyNumber(row[shop.key].installationCost).toLocaleString("id-ID")}`
                                          : <span className="text-slate-400 italic">-</span>}
                                      </td>,
                                      <td key={`${row.id}-${shop.key}-total-view`} className="px-3 py-3 font-semibold text-slate-900 tabular-nums">
                                        {parseCurrencyNumber(row[shop.key].totalPrice) > 0
                                          ? `Rp ${parseCurrencyNumber(row[shop.key].totalPrice).toLocaleString("id-ID")}`
                                          : <span className="text-slate-400 italic">-</span>}
                                      </td>,
                                      <td key={`${row.id}-${shop.key}-link-view`} className="px-3 py-3">
                                        {row[shop.key].link?.trim() ? (
                                          <Link
                                            href={row[shop.key].link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline truncate max-w-[220px]"
                                          >
                                            <FileDown className="h-3 w-3 shrink-0" />
                                            <span className="truncate">Lihat Produk</span>
                                          </Link>
                                        ) : (
                                          <span className="text-slate-400 italic">-</span>
                                        )}
                                      </td>,
                                    ])}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* PANEL REVIEW DATA PENGAJUAN DI BAWAH */}
                      {selectedConcentrationCode && activeProposalTab !== "rab"
                        ? renderReviewPanel(
                            selectedConcentrationCode,
                            "pengajuan",
                            <ClipboardList className="h-5 w-5" />,
                            "Data Pengajuan (Survey/RPKP)",
                          )
                        : null}
                    </section>
                  ) : !loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                      Pilih konsentrasi dari profil sekolah untuk menampilkan data pengajuan (tab RAB bisa tanpa pilih KK).
                    </div>
                  ) : null}
              </CardContent>
            </Card>
            ) : null}
          </DetailTabLazyWrap>

          <DetailTabLazyWrap active={mainTab === "rpd"} skeletonRows={18}>
            {mainTab === "rpd" ? (
              <SchoolRpdPksDocumentEditor
                npsn={npsn}
                profile={profile ?? undefined}
                moduleContext="pra-bimtek"
                activeTabKind="RPD"
                onSwitchKind={(next) => setMainTab(next.toLowerCase() as MainTabKey)}
                tabPrintIdMap={{ RPD: "print-rpd", PKS: "print-pks" }}
                allowedKinds={["RPD", "PKS"]}
                onPreviewPrint={(id) => setPrintPreviewId(id as TabPrintId)}
                totalAnggaranRpNumber={Math.round(rabGrandRpd || rpkpGrandRpd || 0)}
                fasilitatorName={facilitatorName || session?.user?.fullName || null}
              />
            ) : null}
          </DetailTabLazyWrap>

          <DetailTabLazyWrap active={mainTab === "pks"} skeletonRows={22}>
            {mainTab === "pks" ? (
              <SchoolRpdPksDocumentEditor
                npsn={npsn}
                profile={profile ?? undefined}
                moduleContext="pra-bimtek"
                activeTabKind="PKS"
                onSwitchKind={(next) => setMainTab(next.toLowerCase() as MainTabKey)}
                tabPrintIdMap={{ RPD: "print-rpd", PKS: "print-pks" }}
                allowedKinds={["RPD", "PKS"]}
                onPreviewPrint={(id) => setPrintPreviewId(id as TabPrintId)}
                totalAnggaranRpNumber={Math.round(rabGrandRpd || rpkpGrandRpd || 0)}
                fasilitatorName={facilitatorName || session?.user?.fullName || null}
              />
            ) : null}
          </DetailTabLazyWrap>

          {/* ===== CARD FINAL APPROVAL GLOBAL ===== */}
          <Card className="rounded-[28px] border-primary/15 bg-primary/[0.03]">
            <CardHeader className="gap-3">
              <ApprovalSectionHeader
                title="Finalisasi · Verifikasi Online Peralatan"
                description="Setelah seluruh Konsentrasi Keahlian (KK) direview per bagian (KK / Sarana / Pengajuan), tetapkan status FINAL untuk sekolah ini."
                icon={<Gauge className="h-5 w-5" />}
                status={reviewDraft.globalStatus}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Badge className={cn("border", reviewStatusVariant(reviewDraft.konsentrasi.status))} variant="outline">
                  <Users className="mr-1.5 h-3 w-3" /> KK: {reviewStatusLabel(reviewDraft.konsentrasi.status)}
                </Badge>
                <Badge className={cn("border", reviewStatusVariant(reviewDraft.kondisi.status))} variant="outline">
                  <Boxes className="mr-1.5 h-3 w-3" /> Sarana: {reviewStatusLabel(reviewDraft.kondisi.status)}
                </Badge>
                <Badge className={cn("border", reviewStatusVariant(reviewDraft.ajuan.status))} variant="outline">
                  <ClipboardList className="mr-1.5 h-3 w-3" /> Pengajuan: {reviewStatusLabel(reviewDraft.ajuan.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="grid gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MessageSquareWarning className="h-4 w-4 text-primary" />
                  Catatan Global untuk Sekolah Ini
                </span>
                <textarea
                  rows={3}
                  className={cn(inputBase, "resize-y bg-white")}
                  placeholder="Tuliskan catatan global (opsional). Contoh: Secara umum data sudah baik namun ada 2 KK yang perlu diperbaiki rombel dan 1 KK alatnya belum lengkap."
                  value={reviewDraft.globalNote}
                  onChange={(e) => {
                    setReviewDraft((prev) => ({ ...prev, globalNote: e.target.value }));
                  }}
                  onBlur={() => {
                    // simpan global note via persistApproval tanpa ubah status
                    void persistApproval({});
                  }}
                />
              </label>
              <FourApprovalButtons
                value={reviewDraft.globalStatus}
                onChange={(s) => {
                  if (s === "pending") void persistApproval({ globalStatus: "pending" });
                  else if (s === "approved") void persistApproval({ globalStatus: "approved" });
                  else if (s === "rejected") void persistApproval({ globalStatus: "rejected" });
                }}
                disabled={saving}
              />
              {saving ? (
                <p className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan finalisasi verifikasi...
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
