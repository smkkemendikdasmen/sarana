"use client";

import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  schoolConcentrationsSummaryRequest,
  workspaceAdminSelectionRequest,
  workspaceAssignmentsRequest,
  workspaceBimtekReviewsRequest,
  type AdminSchoolOption,
  type SchoolConcentrationsSummaryRecord,
  type WorkspaceAssignmentRecord,
  type WorkspaceBimtekReviewRecord,
  type WorkspaceSchoolEquipmentData,
  type WorkspaceSchoolProposalData,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type ReviewStageKey = "survey" | "rpkp" | "rab";
type ReviewStageStatus = "pending" | "revisi" | "approved";

const STAGE_LABELS: Record<ReviewStageKey, string> = {
  survey: "Survey Harga Pasar",
  rpkp: "RPKP",
  rab: "RAB",
};

const STAGE_ORDER: ReviewStageKey[] = ["survey", "rpkp", "rab"];

function statusBadgeClass(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "revisi") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "pending") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-slate-50 text-slate-500 border-dashed border-slate-200";
}

function statusLabel(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved") return "Disetujui";
  if (s === "revisi") return "Perbaiki";
  if (s === "pending") return "Pending";
  return "Belum Ada";
}

function tsvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const clean = text.replace(/\t/g, " ").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
  return `"${clean.replaceAll('"', '""')}"`;
}

function todayFileStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "-";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return s;
  }
}

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function parseCurrencyRAB(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseQuantityRAB(value: unknown): number {
  if (typeof value === "number") {
    const n = Math.floor(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (typeof value !== "string") return 0;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function rabPerConcentrationFromBundle(
  konsentrasi: SchoolConcentrationsSummaryRecord | null,
  proposal: WorkspaceSchoolProposalData | null | undefined,
): {
  totalStudents: number;
  rabNonZero: Array<{
    code: string;
    name: string;
    studentCount: number;
    totalProposalValue: number;
  }>;
  rabTotal: number;
} {
  const totalStudents = Number(konsentrasi?.totalStudents ?? 0);
  const tables = (proposal?.proposalTables ?? {}) as Record<string, unknown>;
  const selections = (proposal?.rpkpSelections ?? {}) as Record<string, Record<string, unknown>>;
  const konsentrasiList = Array.isArray(konsentrasi?.concentrations) ? konsentrasi.concentrations : [];
  const byKode = new Map<string, { name: string; studentCount: number }>();
  for (const kk of konsentrasiList) {
    byKode.set(String(kk.code ?? "").trim(), {
      name: String(kk.name ?? "").trim(),
      studentCount: Number(kk.studentCount ?? 0),
    });
  }
  const perKk = new Map<string, {
    code: string;
    name: string;
    studentCount: number;
    totalProposalValue: number;
  }>();
  for (const tableKey of Object.keys(tables)) {
    const parts = String(tableKey ?? "").split("::");
    if (parts.length < 3) continue;
    const tab = parts[parts.length - 1];
    if (tab !== "survey") continue;
    const concentrationCode = parts.slice(1, -1).join("::");
    const kkMeta = byKode.get(concentrationCode) ?? { name: "", studentCount: 0 };
    const rows = tables[tableKey];
    if (!Array.isArray(rows)) continue;
    const selKey = `${parts[0]}::${concentrationCode}::rpkp`;
    const rowSelections = (selections[selKey] ?? {}) as Record<string, unknown>;
    let kkTotal = 0;
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      const row = r as Record<string, unknown>;
      const qty = parseQuantityRAB(row.quantity);
      let shopKey: "" | "shop1" | "shop2" | "shop3" = "";
      const rawSel = rowSelections[row.id as string];
      if (rawSel === "shop1" || rawSel === "shop2" || rawSel === "shop3") shopKey = rawSel;
      let unitPrice = 0;
      if (shopKey) {
        const quote = (row[shopKey] ?? {}) as Record<string, unknown>;
        unitPrice =
          parseCurrencyRAB(quote.priceWithTax) +
          parseCurrencyRAB(quote.shippingCost) +
          parseCurrencyRAB(quote.installationCost);
      }
      if (unitPrice <= 0) {
        for (const sKey of ["shop1", "shop2", "shop3"] as const) {
          const q = (row[sKey] ?? {}) as Record<string, unknown>;
          const explicit = parseCurrencyRAB(q.totalPrice);
          if (explicit > 0) {
            unitPrice = explicit / (qty > 0 ? qty : 1);
            break;
          }
        }
      }
      kkTotal += unitPrice * qty;
    }
    if (kkTotal <= 0) continue;
    const existed = perKk.get(concentrationCode);
    if (existed) {
      existed.totalProposalValue += kkTotal;
    } else {
      perKk.set(concentrationCode, {
        code: concentrationCode,
        name: kkMeta.name || concentrationCode,
        studentCount: kkMeta.studentCount,
        totalProposalValue: kkTotal,
      });
    }
  }
  const rabNonZero = Array.from(perKk.values()).sort((a, b) => b.totalProposalValue - a.totalProposalValue);
  const rabTotal = rabNonZero.reduce((s, x) => s + x.totalProposalValue, 0);
  return { totalStudents, rabNonZero, rabTotal };
}

function summarizeEquipmentTables(data: WorkspaceSchoolEquipmentData | null | undefined): {
  ada: boolean;
  totalPaket: number;
  totalItem: number;
  updateTerakhir: string | null;
} {
  if (!data) return { ada: false, totalPaket: 0, totalItem: 0, updateTerakhir: null };
  const tables = data.equipmentTables ?? {};
  const keys = Object.keys(tables);
  let item = 0;
  for (const k of keys) {
    const rows = (tables[k] as unknown) as unknown[];
    if (Array.isArray(rows)) item += rows.length;
    else if (rows && typeof rows === "object") item += 1;
  }
  return {
    ada: keys.length > 0,
    totalPaket: keys.length,
    totalItem: item,
    updateTerakhir: data.updatedAt ?? null,
  };
}

function summarizeProposalBundles(
  proposal: WorkspaceSchoolProposalData | null | undefined,
): {
  adaProposal: boolean;
  adaRpkp: boolean;
  totalTabelProposal: number;
  totalRpkpSelections: number;
} {
  if (!proposal) return { adaProposal: false, adaRpkp: false, totalTabelProposal: 0, totalRpkpSelections: 0 };
  const tables = Object.keys(proposal.proposalTables ?? {});
  const rpkp = Object.keys(proposal.rpkpSelections ?? {});
  return {
    adaProposal: tables.length > 0,
    adaRpkp: rpkp.length > 0,
    totalTabelProposal: tables.length,
    totalRpkpSelections: rpkp.length,
  };
}

interface PraBimtekReportRow {
  no: number;
  schoolId: string;
  npsn: string;
  provinsi: string;
  kotaKabupaten: string;
  nama: string;
  jurusan1: { name: string; studentCount: number } | null;
  jurusan2: { name: string; studentCount: number } | null;
  jurusan3: { name: string; studentCount: number } | null;
  totalJurusan: number;
  totalSiswa: number;
  kondisiAlat: ReturnType<typeof summarizeEquipmentTables>;
  ajuan: ReturnType<typeof summarizeProposalBundles>;
  review: WorkspaceBimtekReviewRecord | null;
  fasilitatorAlat: string | null;
  fasilitatorAdministrasi: string | null;
  updateTerakhir: string | null;
  rabTotal: number;
  rabPerKK: Array<{ code: string; name: string; studentCount: number; totalProposalValue: number }>;
}

function sortRowsByWilayah(rows: PraBimtekReportRow[]): PraBimtekReportRow[] {
  return [...rows].sort((a, b) => {
    const cmpP = (a.provinsi ?? "").localeCompare(b.provinsi ?? "", "id");
    if (cmpP !== 0) return cmpP;
    const cmpK = (a.kotaKabupaten ?? "").localeCompare(b.kotaKabupaten ?? "", "id");
    if (cmpK !== 0) return cmpK;
    return (a.nama ?? "").localeCompare(b.nama ?? "", "id");
  });
}

function triggerTsvDownloadRekap(rows: PraBimtekReportRow[]) {
  const headers = [
    "No", "NPSN", "Provinsi", "Kota/Kabupaten", "Nama Sekolah",
    "KK Prioritas 1", "Siswa KK 1",
    "KK Prioritas 2", "Siswa KK 2",
    "KK Prioritas 3", "Siswa KK 3",
    "Total KK Aktif", "Total Siswa",
    "Kondisi Alat (Paket)", "Kondisi Alat (Item)",
    "Ajuan Proposal (Tabel)", "Ajuan RPKP (Pilihan Toko)",
    "Status Survey", "Catatan Survey",
    "Status RPKP", "Catatan RPKP",
    "Status RAB", "Catatan RAB",
    "Fasilitator Alat", "Fasilitator Administrasi",
    "Update Terakhir",
  ];
  const lines = [headers.map(tsvEscape).join("\t")];
  const sorted = sortRowsByWilayah(rows);
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]!;
    const statuses = r.review?.statuses ?? ({} as Record<ReviewStageKey, ReviewStageStatus>);
    const notes = r.review?.notes ?? ({} as Record<ReviewStageKey, string>);
    lines.push([
      i + 1,
      r.npsn, r.provinsi, r.kotaKabupaten, r.nama,
      r.jurusan1?.name ?? "", r.jurusan1?.studentCount ?? "",
      r.jurusan2?.name ?? "", r.jurusan2?.studentCount ?? "",
      r.jurusan3?.name ?? "", r.jurusan3?.studentCount ?? "",
      r.totalJurusan, r.totalSiswa,
      r.kondisiAlat.totalPaket, r.kondisiAlat.totalItem,
      r.ajuan.totalTabelProposal, r.ajuan.totalRpkpSelections,
      statusLabel(statuses.survey), notes.survey ?? "",
      statusLabel(statuses.rpkp), notes.rpkp ?? "",
      statusLabel(statuses.rab), notes.rab ?? "",
      r.fasilitatorAlat ?? "", r.fasilitatorAdministrasi ?? "",
      fmtDateTime(r.updateTerakhir),
    ].map(tsvEscape).join("\t"));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-pra-bimtek-rekap-${todayFileStamp()}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function SummaryCard(props: {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <Card className="rounded-[24px] border-slate-200/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 tabular-nums">{props.value}</p>
            {props.helper ? <p className="mt-1 text-xs text-slate-500">{props.helper}</p> : null}
          </div>
          {props.icon ? (
            <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", props.tone ?? "bg-slate-100 text-slate-600")}>
              {props.icon}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPraBimtekReportsPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"detail" | "rab">("rab");
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [concentrations, setConcentrations] = useState<SchoolConcentrationsSummaryRecord[]>([]);
  const [equipmentBundles, setEquipmentBundles] = useState<Record<string, WorkspaceSchoolEquipmentData>>({});
  const [proposalBundles, setProposalBundles] = useState<Record<string, WorkspaceSchoolProposalData>>({});
  const [bimtekReviews, setBimtekReviews] = useState<WorkspaceBimtekReviewRecord[]>([]);
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);

  useEffect(() => { hydrate(); }, [hydrate]);

  async function load() {
    if (!hydrated) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        adminUsersRequest(),
        token ? schoolConcentrationsSummaryRequest(token) : Promise.resolve([] as SchoolConcentrationsSummaryRecord[]),
        token ? workspaceAdminSelectionRequest(token, { datasetKey: "ALL", scope: "full" }) : Promise.resolve({
          regulerRows: [],
          abtRows: [],
          interviewResults: [],
          bimtekReviews: [],
          verifikasiOnlineReviews: [],
          proposalBundles: {},
          equipmentBundles: {},
        }),
        token ? workspaceBimtekReviewsRequest(token) : Promise.resolve([] as WorkspaceBimtekReviewRecord[]),
        token ? workspaceAssignmentsRequest(token, { moduleKey: "pra-bimtek" }) : Promise.resolve([] as WorkspaceAssignmentRecord[]),
      ]);
      if (results[0].status === "fulfilled") setSchools(results[0].value.schools);
      if (results[1].status === "fulfilled") setConcentrations(results[1].value);
      if (results[2].status === "fulfilled") {
        setEquipmentBundles(results[2].value.equipmentBundles ?? {});
        setProposalBundles(results[2].value.proposalBundles ?? {});
      }
      if (results[3].status === "fulfilled") setBimtekReviews(results[3].value);
      if (results[4].status === "fulfilled") setAssignments(results[4].value);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hydrated, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    if (refreshing || !hydrated || !token) return;
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const rows = useMemo<PraBimtekReportRow[]>(() => {
    const byNpsnKonsentrasi = new Map<string, SchoolConcentrationsSummaryRecord>();
    for (const k of concentrations) byNpsnKonsentrasi.set(k.npsn, k);
    const byNpsnReview = new Map<string, WorkspaceBimtekReviewRecord>();
    for (const r of bimtekReviews) byNpsnReview.set(r.schoolNpsn, r);
    const byNpsnAssignment = new Map<string, WorkspaceAssignmentRecord>();
    for (const a of assignments) byNpsnAssignment.set(a.schoolNpsn, a);

    const sorted = [...schools].sort((a, b) => a.name.localeCompare(b.name, "id"));
    return sorted.map((s, i) => {
      const konsentrasi = byNpsnKonsentrasi.get(s.npsn) ?? null;
      const top3 = konsentrasi?.top3Concentrations ?? [];
      const j1 = top3[0] ? { name: top3[0].name, studentCount: Number(top3[0].studentCount ?? 0) } : null;
      const j2 = top3[1] ? { name: top3[1].name, studentCount: Number(top3[1].studentCount ?? 0) } : null;
      const j3 = top3[2] ? { name: top3[2].name, studentCount: Number(top3[2].studentCount ?? 0) } : null;
      const kondisiAlat = summarizeEquipmentTables(equipmentBundles[s.npsn]);
      const ajuan = summarizeProposalBundles(proposalBundles[s.npsn]);
      const review = byNpsnReview.get(s.npsn) ?? null;
      const assignment = byNpsnAssignment.get(s.npsn) ?? null;
      const rabInfo = rabPerConcentrationFromBundle(konsentrasi, proposalBundles[s.npsn]);

      const timestamps: string[] = [];
      if (kondisiAlat.updateTerakhir) timestamps.push(kondisiAlat.updateTerakhir);
      if (review?.updatedAt) timestamps.push(review.updatedAt);
      if (assignment?.updatedAt) timestamps.push(assignment.updatedAt);
      timestamps.sort();
      const updateTerakhir = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

      return {
        no: i + 1,
        schoolId: s.id,
        npsn: s.npsn,
        provinsi: s.provinsi ?? "",
        kotaKabupaten: s.kotaKabupaten ?? "",
        nama: s.name,
        jurusan1: j1,
        jurusan2: j2,
        jurusan3: j3,
        totalJurusan: konsentrasi?.concentrations?.length ?? 0,
        totalSiswa: Number(konsentrasi?.totalStudents ?? 0),
        kondisiAlat,
        ajuan,
        review,
        fasilitatorAlat: assignment?.facilitatorEquipmentName ?? null,
        fasilitatorAdministrasi: assignment?.facilitatorAdministrationName ?? null,
        updateTerakhir,
        rabTotal: rabInfo.rabTotal,
        rabPerKK: rabInfo.rabNonZero,
      };
    });
  }, [schools, concentrations, equipmentBundles, proposalBundles, bimtekReviews, assignments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.npsn, r.provinsi, r.kotaKabupaten, r.nama,
        r.jurusan1?.name ?? "", r.jurusan2?.name ?? "", r.jurusan3?.name ?? "",
        r.fasilitatorAlat ?? "", r.fasilitatorAdministrasi ?? "",
        ...r.rabPerKK.map((k) => k.name),
      ].join(" ").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    const total = rows.length;
    const adaKondisiAlat = rows.filter((r) => r.kondisiAlat.ada).length;
    const adaAjuan = rows.filter((r) => r.ajuan.adaProposal).length;
    const surveyApproved = rows.filter((r) => r.review?.statuses?.survey === "approved").length;
    const rpkpApproved = rows.filter((r) => r.review?.statuses?.rpkp === "approved").length;
    const rabApproved = rows.filter((r) => r.review?.statuses?.rab === "approved").length;
    const totalAlatItem = rows.reduce((sum, r) => sum + (r.kondisiAlat.totalItem ?? 0), 0);
    const totalRpkpSelections = rows.reduce((sum, r) => sum + (r.ajuan.totalRpkpSelections ?? 0), 0);
    const ditugaskan = rows.filter((r) => r.fasilitatorAlat || r.fasilitatorAdministrasi).length;
    const totalNilaiRAB = rows.reduce((s, r) => s + (r.rabTotal || 0), 0);
    const totalKKRAB = rows.reduce((s, r) => s + r.rabPerKK.length, 0);
    const sekolahAdaRAB = rows.filter((r) => r.rabTotal > 0).length;
    return {
      total,
      adaKondisiAlat,
      adaAjuan,
      surveyApproved,
      rpkpApproved,
      rabApproved,
      totalAlatItem,
      totalRpkpSelections,
      ditugaskan,
      totalNilaiRAB,
      totalKKRAB,
      sekolahAdaRAB,
    };
  }, [rows]);

  function triggerTsvDownloadRekapRAB(rowsInput: PraBimtekReportRow[]) {
    const headers = [
      "No", "Provinsi", "Kota/Kabupaten", "NPSN", "Nama Sekolah",
      "KK yang Diajukan (RAB > 0)", "Jumlah Siswa Sekolah",
      "Nilai RAB per KK", "Nilai RAB Total Sekolah",
    ];
    const lines: string[] = [headers.map(tsvEscape).join("\t")];
    const sorted = sortRowsByWilayah(rowsInput);
    for (let i = 0; i < sorted.length; i += 1) {
      const r = sorted[i]!;
      const kkJoined = r.rabPerKK.map((k) => k.name || k.code).join(", ");
      const rabPerKKJoined = r.rabPerKK
        .map((k) => `${k.name || k.code}: ${formatIdr(k.totalProposalValue)}`)
        .join(" | ");
      lines.push([
        i + 1,
        r.provinsi, r.kotaKabupaten, r.npsn, r.nama,
        kkJoined,
        r.totalSiswa,
        rabPerKKJoined,
        r.rabTotal || 0,
      ].map(tsvEscape).join("\t"));
    }
    const text = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-pra-bimtek-rekap-rab-${todayFileStamp()}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Sekolah"
          value={`${summary.total}`}
          helper={`${summary.ditugaskan} sekolah sudah ditugaskan ke fasilitator`}
          icon={<Building2 className="h-4 w-4" />}
          tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Sekolah Punya RAB Usulan"
          value={`${summary.sekolahAdaRAB}/${summary.total}`}
          helper={`${summary.totalKKRAB.toLocaleString("id-ID")} KK diajukan (RAB > 0)`}
          icon={<Wrench className="h-4 w-4" />}
          tone="bg-sky-100 text-sky-700"
        />
        <SummaryCard
          label="Ajuan Alat Terisi"
          value={`${summary.adaAjuan}/${summary.total}`}
          helper={`${summary.totalRpkpSelections.toLocaleString("id-ID")} pilihan toko RPKP`}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="bg-indigo-100 text-indigo-700"
        />
        <SummaryCard
          label="Total Nilai RAB (Semua Sekolah)"
          value={formatIdr(summary.totalNilaiRAB)}
          helper="Hanya dihitung dari KK yang RAB totalnya > 0"
          icon={<BarChart3 className="h-4 w-4" />}
          tone="bg-emerald-100 text-emerald-700"
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">
                {viewMode === "rab" ? "Laporan Pra Bimtek · Rekap RAB per Sekolah" : "Laporan Pra Bimtek Per Sekolah (Detail Lengkap)"}
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {viewMode === "rab" ? (
                  <>
                    Rekap RAB usulan per sekolah, <span className="font-semibold text-slate-900">hanya menampilkan Konsentrasi Keahlian (KK) yang total RAB &gt; 0</span>.
                    Nilai RAB per item dihitung dari pilihan toko (RPKP) yang dipilih sekolah di tab Pengajuan.
                  </>
                ) : (
                  <>
                    Rekapitulasi ruang lingkup Pra Bimtek untuk masing-masing sekolah penerima bantuan ABT.
                    Data bersumber langsung dari entri <span className="font-semibold text-slate-900">Sekolah</span> (Kondisi Alat, Ajuan Alat, RPKP)
                    dan review <span className="font-semibold text-slate-900">Fasilitator Alat</span> (status Survey/RPKP/RAB).
                  </>
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "rab" ? "default" : "ghost"}
                    onClick={() => setViewMode("rab")}
                    className={cn(viewMode !== "rab" ? "text-slate-600 hover:text-slate-900" : "")}
                  >
                    <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                    Rekap RAB
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "detail" ? "default" : "ghost"}
                    onClick={() => setViewMode("detail")}
                    className={cn(viewMode !== "detail" ? "text-slate-600 hover:text-slate-900" : "")}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                    Detail Lengkap
                  </Button>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-white">
                  <Users className="mr-1.5 h-3 w-3" /> {summary.ditugaskan} ditugaskan
                </Badge>
                {viewMode === "rab" ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    <BarChart3 className="mr-1.5 h-3 w-3" /> Total RAB: {formatIdr(summary.totalNilaiRAB)}
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className="border-slate-200 bg-white">
                      <Wrench className="mr-1.5 h-3 w-3" /> {summary.adaKondisiAlat} data alat
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white">
                      <ClipboardCheck className="mr-1.5 h-3 w-3" /> {summary.adaAjuan} data ajuan
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white">
                      <BarChart3 className="mr-1.5 h-3 w-3" /> RAB diapprove: {summary.rabApproved}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm text-slate-600 w-full lg:w-[360px]">
                <span className="font-medium text-slate-900">Cari Sekolah</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={viewMode === "rab"
                      ? "Cari NPSN, provinsi, kab/kota, nama sekolah, nama KK..."
                      : "Cari NPSN, provinsi, kab/kota, nama sekolah, KK, fasilitator..."}
                    className="pl-9"
                  />
                </div>
              </label>
              <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="inline-flex items-center gap-2">
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? "Memperbarui..." : "Perbarui Data"}
              </Button>
              <div className="flex flex-wrap gap-2">
                {viewMode === "rab" ? (
                  <Button
                    type="button"
                    disabled={loading || filtered.length === 0}
                    onClick={() => triggerTsvDownloadRekapRAB(filtered)}
                    className="inline-flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Download Rekap RAB (TSV)
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading || rows.length === 0}
                      onClick={() => triggerTsvDownloadRekap(filtered)}
                      className="inline-flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Rekap
                    </Button>
                    <Button
                      type="button"
                      disabled={loading || rows.length === 0}
                      onClick={() => triggerTsvDownloadRekap(filtered)}
                      className="inline-flex items-center gap-2"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export TSV Lengkap
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm font-medium">
                  {viewMode === "rab"
                    ? "Memuat rekap RAB per sekolah dan per KK (hitung RAB > 0)..."
                    : "Memuat data laporan Pra Bimtek (kondisi alat, KK, survey/RPKP/RAB)..."}
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-500">
              Tidak ada sekolah yang cocok dengan filter pencarian.
            </div>
          ) : viewMode === "rab" ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[1380px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-14 px-3 py-3">No</th>
                      <th className="min-w-[180px] px-3 py-3">Provinsi</th>
                      <th className="min-w-[180px] px-3 py-3">Kota / Kab</th>
                      <th className="w-40 px-3 py-3">NPSN</th>
                      <th className="min-w-[280px] px-3 py-3">Nama Sekolah</th>
                      <th className="min-w-[380px] px-3 py-3">
                        KK yang Diajukan
                        <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100 align-middle">
                          RAB &gt; 0 SAJA
                        </span>
                      </th>
                      <th className="w-36 px-3 py-3 text-right">Jumlah Siswa</th>
                      <th className="min-w-[360px] px-3 py-3">Nilai RAB Per KK</th>
                      <th className="w-56 px-3 py-3 text-right">Nilai RAB Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortRowsByWilayah(filtered).map((row, idx) => (
                      <tr key={row.schoolId} className="hover:bg-slate-50/60 align-top">
                        <td className="px-3 py-4 text-slate-700 tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-4 text-slate-700">{row.provinsi || <span className="text-xs text-slate-400">-</span>}</td>
                        <td className="px-3 py-4 text-slate-700">{row.kotaKabupaten || <span className="text-xs text-slate-400">-</span>}</td>
                        <td className="px-3 py-4 font-medium text-slate-950 tabular-nums">{row.npsn}</td>
                        <td className="px-3 py-4 text-slate-900 font-medium leading-snug">{row.nama}</td>
                        <td className="px-3 py-4">
                          {row.rabPerKK.length === 0 ? (
                            <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-500">
                              Belum ada KK dengan RAB &gt; 0
                            </span>
                          ) : (
                            <ul className="space-y-1.5">
                              {row.rabPerKK.map((kk) => (
                                <li
                                  key={`${row.schoolId}-${kk.code}`}
                                  className="flex items-start gap-2"
                                >
                                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                                    ✔
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 leading-snug break-words">
                                      {kk.name || kk.code}
                                    </p>
                                    {kk.studentCount > 0 ? (
                                      <p className="text-[11px] text-slate-500 tabular-nums">
                                        {kk.studentCount.toLocaleString("id-ID")} siswa · KK {kk.code}
                                      </p>
                                    ) : (
                                      <p className="text-[11px] text-slate-500 tabular-nums">
                                        KK {kk.code}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-4 text-right text-slate-800 font-semibold tabular-nums">
                          {row.totalSiswa > 0
                            ? row.totalSiswa.toLocaleString("id-ID")
                            : <span className="font-normal text-slate-400 text-xs">0</span>}
                        </td>
                        <td className="px-3 py-4">
                          {row.rabPerKK.length === 0 ? (
                            <span className="text-xs text-slate-400">
                              Tidak ada usulan RAB dari KK manapun
                            </span>
                          ) : (
                            <ul className="space-y-1.5">
                              {row.rabPerKK.map((kk) => (
                                <li
                                  key={`rab-${row.schoolId}-${kk.code}`}
                                  className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50/40 border border-emerald-100 px-2.5 py-1.5"
                                >
                                  <span className="text-[11px] font-medium text-slate-800 leading-snug min-w-0 truncate" title={kk.name || kk.code}>
                                    {kk.name || kk.code}
                                  </span>
                                  <span className="text-xs font-semibold text-emerald-800 tabular-nums shrink-0">
                                    {formatIdr(kk.totalProposalValue)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-4 text-right">
                          {row.rabTotal > 0 ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-base font-bold text-slate-950 tabular-nums">
                                {formatIdr(row.rabTotal)}
                              </span>
                              <span className="text-[11px] text-emerald-700 tabular-nums">
                                {row.rabPerKK.length} KK
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 tabular-nums">Rp 0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-950 text-white align-top">
                      <td colSpan={5} className="px-3 py-4 text-sm font-semibold uppercase tracking-wider">
                        TOTAL SELURUH SEKOLAH
                      </td>
                      <td className="px-3 py-4 text-sm font-semibold text-emerald-300 tabular-nums">
                        {summary.totalKKRAB.toLocaleString("id-ID")} KK
                      </td>
                      <td className="px-3 py-4 text-right text-sm font-semibold text-white tabular-nums">
                        {rows.reduce((s, r) => s + (r.totalSiswa || 0), 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-4 text-right text-xs font-medium text-slate-300">
                        Agregat per KK lihat kolom Total
                      </td>
                      <td className="px-3 py-4 text-right">
                        <span className="text-xl font-extrabold text-emerald-300 tabular-nums">
                          {formatIdr(summary.totalNilaiRAB)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 px-1">
                <strong className="font-semibold text-slate-700">Catatan perhitungan RAB per KK:</strong>
                RAB = Σ per item alat (harga satuan pilihan toko di RPKP × jumlah unit yang diinput sekolah). Toko pilihan disimpan sekolah di{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">/sekolah/pengajuan</code> tab RPKP. Harga satuan
                diambil dari penjumlahan <em>Harga Pajak + Ongkir + Instalasi</em>; jika kolom tersebut kosong namun{" "}
                <em>Total Harga</em> terisi, akan fallback ke nilai Total. KK yang nilainya Rp 0 TIDAK ditampilkan di kolom KK Diajukan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1800px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-14 px-3 py-3">No</th>
                    <th className="w-36 px-3 py-3">NPSN</th>
                    <th className="w-40 px-3 py-3">Provinsi</th>
                    <th className="w-44 px-3 py-3">Kota / Kabupaten</th>
                    <th className="min-w-[260px] px-3 py-3">Nama Sekolah</th>
                    <th className="min-w-[300px] px-3 py-3">Konsentrasi Keahlian Prioritas</th>
                    <th className="w-56 px-3 py-3">Kondisi Alat (diisi Sekolah)</th>
                    <th className="w-[460px] px-3 py-3">Ajuan Alat — Survey / RPKP / RAB</th>
                    <th className="w-44 px-3 py-3">Fasilitator Alat</th>
                    <th className="w-40 px-3 py-3">Update Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((row) => (
                    <tr key={row.schoolId} className="hover:bg-slate-50/60 align-top">
                      <td className="px-3 py-4 text-slate-700 tabular-nums">{row.no}</td>
                      <td className="px-3 py-4 font-medium text-slate-950 tabular-nums">{row.npsn}</td>
                      <td className="px-3 py-4 text-slate-700">{row.provinsi || <span className="text-xs text-slate-400">-</span>}</td>
                      <td className="px-3 py-4 text-slate-700">{row.kotaKabupaten || <span className="text-xs text-slate-400">-</span>}</td>
                      <td className="px-3 py-4 text-slate-900 font-medium leading-snug">{row.nama}</td>
                      <td className="px-3 py-4">
                        <div className="space-y-2">
                          {row.totalJurusan === 0 ? (
                            <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">Belum Ada Data KK</span>
                          ) : (
                            <>
                              {row.jurusan1 ? (
                                <div className="flex items-start gap-2">
                                  <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-800 border-amber-200">#1</Badge>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 leading-snug">{row.jurusan1.name}</p>
                                    <p className="text-xs text-slate-600 tabular-nums">{row.jurusan1.studentCount.toLocaleString("id-ID")} siswa</p>
                                  </div>
                                </div>
                              ) : null}
                              {row.jurusan2 ? (
                                <div className="flex items-start gap-2">
                                  <Badge variant="outline" className="shrink-0 bg-slate-100 text-slate-700 border-slate-200">#2</Badge>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 leading-snug">{row.jurusan2.name}</p>
                                    <p className="text-xs text-slate-600 tabular-nums">{row.jurusan2.studentCount.toLocaleString("id-ID")} siswa</p>
                                  </div>
                                </div>
                              ) : null}
                              {row.jurusan3 ? (
                                <div className="flex items-start gap-2">
                                  <Badge variant="outline" className="shrink-0 bg-sky-50 text-sky-800 border-sky-200">#3</Badge>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 leading-snug">{row.jurusan3.name}</p>
                                    <p className="text-xs text-slate-600 tabular-nums">{row.jurusan3.studentCount.toLocaleString("id-ID")} siswa</p>
                                  </div>
                                </div>
                              ) : null}
                              <p className="text-[11px] text-slate-500 pt-1">
                                Total {row.totalJurusan} KK aktif · {row.totalSiswa.toLocaleString("id-ID")} siswa
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {row.kondisiAlat.ada ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-sky-700 shrink-0" />
                              <span className="text-sm font-semibold text-slate-900">
                                {row.kondisiAlat.totalPaket} paket · {row.kondisiAlat.totalItem.toLocaleString("id-ID")} item
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-snug">
                              Kondisi alat tercatat per KK. Update: {fmtDateTime(row.kondisiAlat.updateTerakhir)}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">Belum Diisi Sekolah</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <div className="space-y-2.5">
                          {!row.ajuan.adaProposal && !row.review ? (
                            <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">Belum Ada Ajuan Alat</span>
                          ) : (
                            <>
                              {row.ajuan.adaProposal ? (
                                <div className="flex items-center gap-2 text-xs text-slate-700 pb-1 border-b border-dashed border-slate-200">
                                  <ClipboardCheck className="h-3.5 w-3.5 text-indigo-700 shrink-0" />
                                  <span className="font-medium">
                                    {row.ajuan.totalTabelProposal} tabel Proposal · {row.ajuan.totalRpkpSelections} pilihan RPKP
                                  </span>
                                </div>
                              ) : null}
                              {STAGE_ORDER.map((stage) => {
                                const st = row.review?.statuses?.[stage] ?? "pending";
                                const note = row.review?.notes?.[stage] ?? "";
                                return (
                                  <div key={stage} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-semibold text-slate-800">{STAGE_LABELS[stage]}</span>
                                      <Badge variant="outline" className={statusBadgeClass(st)}>
                                        {statusLabel(st)}
                                      </Badge>
                                    </div>
                                    {note ? (
                                      <p className="text-[11px] leading-snug text-slate-600 bg-slate-50 rounded-md px-2 py-1.5 border border-slate-100">
                                        {note}
                                      </p>
                                    ) : (
                                      <p className="text-[11px] text-slate-400 italic">Tanpa catatan review</p>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {row.fasilitatorAlat ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="text-sm font-medium text-slate-900 leading-snug">{row.fasilitatorAlat}</span>
                            </div>
                            {row.fasilitatorAdministrasi ? (
                              <p className="text-xs text-slate-600">Adm: {row.fasilitatorAdministrasi}</p>
                            ) : null}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="float-left text-xs">Belum Ditugaskan</Badge>
                        )}
                      </td>
                      <td className="px-3 py-4 text-slate-600 tabular-nums text-xs">
                        {fmtDateTime(row.updateTerakhir)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
