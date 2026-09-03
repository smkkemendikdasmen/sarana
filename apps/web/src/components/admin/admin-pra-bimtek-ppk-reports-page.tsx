"use client";

import {
  BarChart3,
  Building2,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  schoolConcentrationsSummaryRequest,
  workspaceAdminSelectionRequest,
  workspaceSchoolProposalsBySchoolIdsRequest,
  type AdminSchoolOption,
  type SchoolConcentrationsSummaryRecord,
  type WorkspaceSchoolEquipmentData,
  type WorkspaceSchoolProposalData,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

interface PpkEquipmentDetailRow {
  namaAlat: string;
  jumlahAlat: number;
  hargaAlat: number;
  hargaTotal: number;
  tokoDipilih: "" | "shop1" | "shop2" | "shop3";
  tokoLabel: string;
}

interface PpkRow {
  no: number;
  schoolId: string;
  npsn: string;
  provinsi: string;
  kotaKabupaten: string;
  namaSekolah: string;
  kkAjuan: string;
  kkCode: string;
  jumlahSiswa: number;
  jumlahAlat: number;
  detailAlat: PpkEquipmentDetailRow[];
  rabKk: number;
  rabTotal: number;
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

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function todayFileStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitForReady(
  getReady: () => boolean,
  timeoutMs = 4000,
  intervalMs = 80,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getReady()) return true;
    await sleep(intervalMs);
  }
  return getReady();
}

function mergeProposalEntries(
  target: Record<string, WorkspaceSchoolProposalData>,
  source: Record<string, WorkspaceSchoolProposalData>,
  keyIdMap: Map<string, string>,
  keyNpsnMap: Map<string, string>,
): void {
  if (!source || typeof source !== "object") return;
  const idByKey = new Map<string, string>();
  for (const [k, v] of Object.entries(source)) {
    if (!v || typeof v !== "object") continue;
    const tables = (v as unknown as Record<string, unknown>).proposalTables ?? (v as unknown as Record<string, unknown>).proposal_tables;
    const tableMap = (tables && typeof tables === "object" ? (tables as Record<string, unknown>) : {});
    let resolvedId: string | null = null;
    let resolvedNpsn: string | null = null;
    if (keyIdMap.has(k)) resolvedId = keyIdMap.get(k) as string;
    if (keyNpsnMap.has(k)) resolvedNpsn = keyNpsnMap.get(k) as string;
    if (!resolvedId || !resolvedNpsn) {
      for (const tk of Object.keys(tableMap)) {
        const parts = String(tk ?? "").split("::");
        if (parts.length < 2) continue;
        const head = parts[0];
        if (!resolvedId && keyIdMap.has(head)) resolvedId = keyIdMap.get(head) as string;
        if (!resolvedNpsn && keyNpsnMap.has(head)) resolvedNpsn = keyNpsnMap.get(head) as string;
        if (resolvedId && resolvedNpsn) break;
      }
    }
    if (resolvedId && !target[resolvedId]) target[resolvedId] = v;
    if (resolvedNpsn && !target[resolvedNpsn]) target[resolvedNpsn] = v;
    if (resolvedId) idByKey.set(k, resolvedId);
  }
  for (const [k, v] of Object.entries(source)) {
    if (!v || typeof v !== "object") continue;
    if (!target[k]) target[k] = v;
    const rid = idByKey.get(k);
    if (rid && !target[rid]) target[rid] = v;
  }
}

function pickProposalForSchool(
  s: AdminSchoolOption,
  proposals: Record<string, WorkspaceSchoolProposalData>,
): WorkspaceSchoolProposalData | undefined {
  const direct: WorkspaceSchoolProposalData | undefined = proposals[s.id] ?? proposals[s.npsn];
  if (direct && (direct as unknown as { proposalTables?: unknown }).proposalTables) return direct;
  return Object.values(proposals).find((p) => {
    const tables = (p?.proposalTables ?? (p as unknown as Record<string, unknown>).proposal_tables ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(tables)) {
      const parts = String(key).split("::");
      if (parts[0] === s.id || parts[0] === s.npsn) return true;
    }
    return false;
  });
}

function calculatePpkRows(
  schools: AdminSchoolOption[],
  concentrations: SchoolConcentrationsSummaryRecord[],
  proposalBundles: Record<string, WorkspaceSchoolProposalData>,
  _equipmentBundles: Record<string, WorkspaceSchoolEquipmentData> = {},
): PpkRow[] {
  const konsentrasiByNpsn = new Map<string, SchoolConcentrationsSummaryRecord>();
  for (const k of concentrations) konsentrasiByNpsn.set(k.npsn, k);

  const result: PpkRow[] = [];
  const sorted = [...schools].sort((a, b) =>
    (a.provinsi ?? "").localeCompare(b.provinsi ?? "", "id") ||
    (a.kotaKabupaten ?? "").localeCompare(b.kotaKabupaten ?? "", "id") ||
    a.name.localeCompare(b.name, "id"),
  );

  for (const s of sorted) {
    const konsentrasi = konsentrasiByNpsn.get(s.npsn) ?? null;
    const konsentrasiList = Array.isArray(konsentrasi?.concentrations) ? konsentrasi.concentrations : [];
    const metaByKode = new Map<string, { name: string; studentCount: number }>();
    for (const kk of konsentrasiList) {
      metaByKode.set(String(kk.code ?? "").trim(), {
        name: String(kk.name ?? "").trim(),
        studentCount: Number(kk.studentCount ?? 0),
      });
    }
    const proposal = pickProposalForSchool(s, proposalBundles);
    const tables = (proposal?.proposalTables ?? {}) as Record<string, unknown>;
    const selections = (proposal?.rpkpSelections ?? {}) as Record<string, Record<string, unknown>>;

    const byKk = new Map<string, {
      kkCode: string;
      kkName: string;
      studentCount: number;
      jumlahAlat: number;
      rabKk: number;
      detailAlat: PpkEquipmentDetailRow[];
      totalRows: number;
    }>();

    for (const tableKey of Object.keys(tables)) {
      const parts = String(tableKey ?? "").split("::");
      if (parts.length < 3) continue;
      const tab = parts[parts.length - 1];
      if (tab !== "survey") continue;
      const concentrationCode = parts.slice(1, -1).join("::");
      if (!concentrationCode) continue;
      const rows = tables[tableKey];
      if (!Array.isArray(rows)) continue;
      const selKey = `${parts[0]}::${concentrationCode}::rpkp`;
      const rowSelections = (selections[selKey] ?? {}) as Record<string, unknown>;
      const meta = metaByKode.get(concentrationCode) ?? { name: "", studentCount: 0 };

      let kkAlat = 0;
      let kkRab = 0;
      const detailAll: PpkEquipmentDetailRow[] = [];
      let totalRows = 0;

      for (const r of rows) {
        if (!r || typeof r !== "object") continue;
        const row = r as Record<string, unknown>;
        const qty = parseQuantityRAB(row.quantity);
        if (qty <= 0) continue;
        let shopKey: "" | "shop1" | "shop2" | "shop3" = "";
        const rawSel = rowSelections[row.id as string];
        if (rawSel === "shop1" || rawSel === "shop2" || rawSel === "shop3") shopKey = rawSel;
        let unitPrice = 0;
        let tokoLabel = "";
        if (shopKey) {
          const quote = (row[shopKey] ?? {}) as Record<string, unknown>;
          const rawName = String(quote.name ?? "").trim();
          tokoLabel = rawName || { shop1: "Toko 1", shop2: "Toko 2", shop3: "Toko 3" }[shopKey];
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
              if (!tokoLabel) {
                const rawName = String(q.name ?? "").trim();
                tokoLabel = rawName || { shop1: "Toko 1", shop2: "Toko 2", shop3: "Toko 3" }[sKey];
              }
              if (!shopKey) shopKey = sKey;
              break;
            }
          }
        }
        if (unitPrice <= 0) continue;
        const unitRound = Math.round(unitPrice);
        const total = unitRound * qty;
        totalRows += 1;
        kkAlat += qty;
        kkRab += total;
        const nama = String(row.name ?? "Alat").slice(0, 80).trim() || "Alat";
        detailAll.push({
          namaAlat: nama,
          jumlahAlat: qty,
          hargaAlat: unitRound,
          hargaTotal: total,
          tokoDipilih: shopKey,
          tokoLabel,
        });
      }

      const existed = byKk.get(concentrationCode);
      const kkName = meta.name || concentrationCode;
      const studentCount = Number(meta.studentCount ?? 0);
      if (existed) {
        existed.jumlahAlat += kkAlat;
        existed.rabKk += kkRab;
        existed.totalRows += totalRows;
        existed.detailAlat.push(...detailAll);
      } else {
        byKk.set(concentrationCode, {
          kkCode: concentrationCode,
          kkName,
          studentCount,
          jumlahAlat: kkAlat,
          rabKk: kkRab,
          detailAlat: detailAll,
          totalRows,
        });
      }
    }

    for (const kk of konsentrasiList) {
      const kode = String(kk.code ?? "").trim();
      if (!kode || byKk.has(kode)) continue;
      byKk.set(kode, {
        kkCode: kode,
        kkName: String(kk.name ?? "").trim() || kode,
        studentCount: Number(kk.studentCount ?? 0),
        jumlahAlat: 0,
        rabKk: 0,
        detailAlat: [],
        totalRows: 0,
      });
    }

    const schoolTotal = Array.from(byKk.values()).reduce((sum, k) => sum + k.rabKk, 0);
    const totalSiswaSekolah = Number(konsentrasi?.totalStudents ?? 0);
    const entries = Array.from(byKk.values()).sort((a, b) => b.rabKk - a.rabKk || a.kkName.localeCompare(b.kkName, "id"));
    if (entries.length === 0) {
      result.push({
        no: result.length + 1,
        schoolId: s.id,
        npsn: s.npsn,
        provinsi: s.provinsi ?? "",
        kotaKabupaten: s.kotaKabupaten ?? "",
        namaSekolah: s.name,
        kkAjuan: "(Belum Input Proposal)",
        kkCode: "",
        jumlahSiswa: totalSiswaSekolah,
        jumlahAlat: 0,
        detailAlat: [],
        rabKk: 0,
        rabTotal: 0,
      });
      continue;
    }
    for (const kk of entries) {
      result.push({
        no: result.length + 1,
        schoolId: s.id,
        npsn: s.npsn,
        provinsi: s.provinsi ?? "",
        kotaKabupaten: s.kotaKabupaten ?? "",
        namaSekolah: s.name,
        kkAjuan: kk.kkName ? `${kk.kkName}${kk.kkCode ? ` (${kk.kkCode})` : ""}` : `Konsentrasi ${kk.kkCode}`,
        kkCode: kk.kkCode,
        jumlahSiswa: kk.studentCount || totalSiswaSekolah,
        jumlahAlat: kk.jumlahAlat,
        detailAlat: kk.detailAlat,
        rabKk: kk.rabKk,
        rabTotal: schoolTotal,
      });
    }
  }
  return result;
}

function SummaryCard(props: {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <Card className="rounded-[24px] border-slate-200/80 print:hidden">
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

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function triggerCsvDownload(rowsInput: PpkRow[]) {
  const headers = [
    "No", "Provinsi", "Kota/Kabupaten", "Nama Sekolah", "NPSN",
    "KK Ajuan", "Kode KK", "Jumlah Siswa", "Jumlah Alat Agregat",
    "Nama Alat", "Jumlah Alat (per item)", "Harga Alat (satuan)", "Harga Total (per item)",
    "Toko Dipilih", "Nama Toko",
    "RAB KK", "RAB Total Sekolah",
  ];
  const lines: string[] = [headers.map(csvEscape).join(",")];
  for (let i = 0; i < rowsInput.length; i += 1) {
    const r = rowsInput[i]!;
    const alatRows = Array.isArray(r.detailAlat) && r.detailAlat.length > 0 ? r.detailAlat : [];
    if (alatRows.length === 0) {
      lines.push([
        i + 1, r.provinsi, r.kotaKabupaten, r.namaSekolah, r.npsn,
        r.kkAjuan, r.kkCode, r.jumlahSiswa, r.jumlahAlat,
        "", "", "", "",
        "", "",
        Number.isFinite(r.rabKk) ? r.rabKk : 0,
        Number.isFinite(r.rabTotal) ? r.rabTotal : 0,
      ].map(csvEscape).join(","));
      continue;
    }
    for (let j = 0; j < alatRows.length; j += 1) {
      const alat = alatRows[j]!;
      lines.push([
        j === 0 ? i + 1 : "",
        j === 0 ? r.provinsi : "",
        j === 0 ? r.kotaKabupaten : "",
        j === 0 ? r.namaSekolah : "",
        j === 0 ? r.npsn : "",
        j === 0 ? r.kkAjuan : "",
        j === 0 ? r.kkCode : "",
        j === 0 ? r.jumlahSiswa : "",
        j === 0 ? r.jumlahAlat : "",
        alat.namaAlat,
        alat.jumlahAlat,
        alat.hargaAlat,
        alat.hargaTotal,
        alat.tokoDipilih,
        alat.tokoLabel,
        j === 0 ? (Number.isFinite(r.rabKk) ? r.rabKk : 0) : "",
        j === 0 ? (Number.isFinite(r.rabTotal) ? r.rabTotal : 0) : "",
      ].map(csvEscape).join(","));
    }
  }
  const bom = "\uFEFF";
  const text = bom + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-pra-bimtek-ppk-${todayFileStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function triggerXlsxDownload(rowsInput: PpkRow[]) {
  const flatRows: Record<string, string | number | null>[] = [];
  for (let i = 0; i < rowsInput.length; i += 1) {
    const r = rowsInput[i]!;
    const alatRows = Array.isArray(r.detailAlat) && r.detailAlat.length > 0 ? r.detailAlat : [];
    if (alatRows.length === 0) {
      flatRows.push({
        No: i + 1, Provinsi: r.provinsi, "Kota/Kabupaten": r.kotaKabupaten,
        "Nama Sekolah": r.namaSekolah, NPSN: r.npsn, "KK Ajuan": r.kkAjuan, "Kode KK": r.kkCode,
        "Jumlah Siswa": r.jumlahSiswa, "Jumlah Alat Agregat": r.jumlahAlat,
        "Nama Alat": "", "Jumlah Alat (per item)": "", "Harga Alat (satuan)": "", "Harga Total (per item)": "",
        "Toko Dipilih": "", "Nama Toko": "",
        "RAB KK": Number.isFinite(r.rabKk) ? r.rabKk : 0,
        "RAB Total Sekolah": Number.isFinite(r.rabTotal) ? r.rabTotal : 0,
      });
      continue;
    }
    for (let j = 0; j < alatRows.length; j += 1) {
      const alat = alatRows[j]!;
      flatRows.push({
        No: j === 0 ? i + 1 : "",
        Provinsi: j === 0 ? r.provinsi : "",
        "Kota/Kabupaten": j === 0 ? r.kotaKabupaten : "",
        "Nama Sekolah": j === 0 ? r.namaSekolah : "",
        NPSN: j === 0 ? r.npsn : "",
        "KK Ajuan": j === 0 ? r.kkAjuan : "",
        "Kode KK": j === 0 ? r.kkCode : "",
        "Jumlah Siswa": j === 0 ? r.jumlahSiswa : "",
        "Jumlah Alat Agregat": j === 0 ? r.jumlahAlat : "",
        "Nama Alat": alat.namaAlat,
        "Jumlah Alat (per item)": alat.jumlahAlat,
        "Harga Alat (satuan)": alat.hargaAlat,
        "Harga Total (per item)": alat.hargaTotal,
        "Toko Dipilih": alat.tokoDipilih,
        "Nama Toko": alat.tokoLabel,
        "RAB KK": j === 0 ? (Number.isFinite(r.rabKk) ? r.rabKk : 0) : "",
        "RAB Total Sekolah": j === 0 ? (Number.isFinite(r.rabTotal) ? r.rabTotal : 0) : "",
      });
    }
  }
  const xlsx = await import("xlsx");
  const worksheet = xlsx.utils.json_to_sheet(flatRows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Pra Bimtek PPK");
  const fileName = `laporan-pra-bimtek-ppk-${todayFileStamp()}.xlsx`;
  xlsx.writeFile(workbook, fileName);
}

function handlePrint() {
  if (typeof window !== "undefined") window.print();
}

export function AdminPraBimtekPpkReportsPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [concentrations, setConcentrations] = useState<SchoolConcentrationsSummaryRecord[]>([]);
  const [proposalBundles, setProposalBundles] = useState<Record<string, WorkspaceSchoolProposalData>>({});
  const [equipmentBundles, setEquipmentBundles] = useState<Record<string, WorkspaceSchoolEquipmentData>>({});
  const loadLockRef = useRef<boolean>(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  async function load() {
    if (loadLockRef.current) return;
    loadLockRef.current = true;
    setLoading(true);
    try {
      const ready = await waitForReady(() => hydrated && Boolean(session?.token), 4000, 80);
      if (!ready) return;
      const bearer = session?.token ?? "";
      if (!bearer) return;

      const baseResults = await Promise.allSettled([
        adminUsersRequest(),
        schoolConcentrationsSummaryRequest(bearer),
      ]);
      let schools: AdminSchoolOption[] = [];
      let concentrations: SchoolConcentrationsSummaryRecord[] = [];
      if (baseResults[0].status === "fulfilled") schools = (baseResults[0].value?.schools ?? []) as AdminSchoolOption[];
      if (baseResults[1].status === "fulfilled") concentrations = (baseResults[1].value ?? []) as SchoolConcentrationsSummaryRecord[];

      let mergedProposals: Record<string, WorkspaceSchoolProposalData> = {};
      let mergedEquipments: Record<string, WorkspaceSchoolEquipmentData> = {};

      if (bearer && schools.length > 0) {
        const keyIdMap = new Map<string, string>();
        const keyNpsnMap = new Map<string, string>();
        for (const s of schools) {
          if (s.id) keyIdMap.set(s.id, s.id);
          if (s.npsn) keyNpsnMap.set(s.npsn, s.npsn);
          if (s.id && s.npsn) {
            keyIdMap.set(s.npsn, s.id);
            keyNpsnMap.set(s.id, s.npsn);
          }
        }

        const trySelection = await Promise.allSettled([
          workspaceAdminSelectionRequest(bearer, { datasetKey: "REGULER", scope: "full" }),
          workspaceAdminSelectionRequest(bearer, { datasetKey: "ABT", scope: "full" }),
        ]);
        for (const r of trySelection) {
          if (r.status !== "fulfilled") continue;
          const pb = ((r.value as unknown as Record<string, unknown>)?.proposalBundles ?? {}) as Record<string, WorkspaceSchoolProposalData>;
          const eb = ((r.value as unknown as Record<string, unknown>)?.equipmentBundles ?? {}) as Record<string, WorkspaceSchoolEquipmentData>;
          mergeProposalEntries(mergedProposals, pb, keyIdMap, keyNpsnMap);
          for (const [k, v] of Object.entries(eb)) {
            if (!v) continue;
            if (!mergedEquipments[k]) mergedEquipments[k] = v;
            const rid = keyIdMap.get(k);
            const rnpsn = keyNpsnMap.get(k);
            if (rid && !mergedEquipments[rid]) mergedEquipments[rid] = v;
            if (rnpsn && !mergedEquipments[rnpsn]) mergedEquipments[rnpsn] = v;
          }
        }

        const sortedIds = [...schools].map((s) => s.id).filter(Boolean);
        const npsnDone = new Set<string>(
          Object.keys(mergedProposals).flatMap((k) => {
            const out: string[] = [];
            if (keyIdMap.has(k)) out.push(keyIdMap.get(k) as string);
            if (keyNpsnMap.has(k)) out.push(keyNpsnMap.get(k) as string);
            const idMatch = schools.find((s) => s.id === k || s.npsn === k);
            if (idMatch) { out.push(idMatch.id); out.push(idMatch.npsn); }
            return out;
          }),
        );
        const missingIds = sortedIds.filter((sid) => !npsnDone.has(sid));
        if (missingIds.length > 0) {
          const batchSize = 20;
          const chunks: string[][] = [];
          for (let i = 0; i < missingIds.length; i += batchSize) chunks.push(missingIds.slice(i, i + batchSize));
          const proposalBatches = await Promise.allSettled(
            chunks.map((idsChunk) => workspaceSchoolProposalsBySchoolIdsRequest(bearer, idsChunk)),
          );
          for (const r of proposalBatches) {
            if (r.status !== "fulfilled") continue;
            const payload = r.value as unknown as Record<string, unknown>;
            const direct = r.value as unknown as Record<string, WorkspaceSchoolProposalData>;
            const wrappedProposals = (payload.proposals ?? {}) as Record<string, WorkspaceSchoolProposalData>;
            const toMerge = Object.keys(wrappedProposals).length > 0 ? wrappedProposals : (Object.keys(direct).length > 0 ? direct : {});
            mergeProposalEntries(mergedProposals, toMerge, keyIdMap, keyNpsnMap);
          }
        }
      }

      setSchools(schools);
      setConcentrations(concentrations);
      setEquipmentBundles(mergedEquipments);
      setProposalBundles(mergedProposals);
    } finally {
      setLoading(false);
      loadLockRef.current = false;
    }
  }

  useEffect(() => {
    if (hydrated && session?.token) load(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token]);

  async function handleRefresh() {
    if (refreshing || !hydrated || !session?.token) return;
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const rows = useMemo<PpkRow[]>(() => calculatePpkRows(schools, concentrations, proposalBundles, equipmentBundles), [schools, concentrations, proposalBundles, equipmentBundles]);
  const renumbered = useMemo<PpkRow[]>(() => rows.map((r, i) => ({ ...r, no: i + 1 })), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return renumbered;
    return renumbered.filter((r) => {
      const detailText = Array.isArray(r.detailAlat)
        ? r.detailAlat.map((d) => `${d.namaAlat} ${d.jumlahAlat} ${d.hargaAlat} ${d.hargaTotal}`).join(" ")
        : String(r.detailAlat ?? "");
      return [r.npsn, r.provinsi, r.kotaKabupaten, r.namaSekolah, r.kkAjuan, r.kkCode, detailText]
        .join(" ")
        .toLowerCase()
        .includes(q);
    }).map((r, i) => ({ ...r, no: i + 1 }));
  }, [renumbered, query]);

  const summary = useMemo(() => {
    const totalRows = filtered.length;
    const totalSekolah = new Set(filtered.map((r) => r.schoolId)).size;
    const totalRAB = filtered.reduce((s, r) => s + (r.rabKk || 0), 0);
    const totalAlat = filtered.reduce((s, r) => s + (r.jumlahAlat || 0), 0);
    const totalSiswa = new Map(filtered.map(r => [r.schoolId, r.jumlahSiswa]));
    const siswaAggregate = Array.from(totalSiswa.values()).reduce((s, v) => s + (Number(v) || 0), 0);
    return { totalRows, totalSekolah, totalRAB, totalAlat, siswaAggregate };
  }, [filtered]);

  const totalSummary = useMemo(() => {
    const totalRAB = renumbered.reduce((s, r) => s + (r.rabKk || 0), 0);
    const sekolahAdaRAB = new Set(renumbered.filter(r => r.rabKk > 0).map(r => r.schoolId)).size;
    const totalSekolahAll = new Set(renumbered.map(r => r.schoolId)).size;
    return { totalRAB, sekolahAdaRAB, totalSekolahAll };
  }, [renumbered]);

  return (
    <div className="space-y-6">
      <style>{`@media print {
        .print\\:hidden { display: none !important; }
        body { background: #fff !important; }
        main { max-width: 100% !important; }
        table { font-size: 11px !important; }
        thead th { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-total-row td { background: #0f172a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`}</style>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:hidden">
        <SummaryCard
          label="Total Sekolah (Snapshot)"
          value={`${summary.totalSekolah}`}
          helper={`${renumbered.length} baris data (1 KK = 1 baris). Filter pencarian aktif.`}
          icon={<Building2 className="h-4 w-4" />}
          tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Total Siswa (Agregat)"
          value={summary.siswaAggregate.toLocaleString("id-ID")}
          helper={`${totalSummary.sekolahAdaRAB}/${totalSummary.totalSekolahAll} sekolah punya RAB usulan`}
          icon={<Users className="h-4 w-4" />}
          tone="bg-amber-100 text-amber-800"
        />
        <SummaryCard
          label="Total Kuantitas Alat (Unit)"
          value={summary.totalAlat.toLocaleString("id-ID")}
          helper="Jumlah qty unit per semua KK dalam filter"
          icon={<Wrench className="h-4 w-4" />}
          tone="bg-indigo-100 text-indigo-700"
        />
        <SummaryCard
          label="Total RAB Nasional (Semua)"
          value={formatIdr(totalSummary.totalRAB)}
          helper={`Hasil filter = ${formatIdr(summary.totalRAB)}`}
          icon={<BarChart3 className="h-4 w-4" />}
          tone="bg-emerald-100 text-emerald-700"
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4 print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">
                Laporan Pra Bimtek PPK · Rekap per Konsentrasi Keahlian
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Format 10 kolom standar PPK (1 baris = 1 KK / 1 konsentrasi keahlian sekolah).
                RAB KK perhitungan <span className="font-semibold text-slate-900">100% sesuai UI sekolah</span>:
                unit price = Harga Pajak + Ongkir + Instalasi pilihan toko RPKP, fallback ke <em>Total Harga</em>.
                Jika pilihan toko kosong → fallback toko pertama yang ada nominalnya.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-200 bg-white">
                  <Users className="mr-1.5 h-3 w-3" />
                  {summary.totalSekolah} sekolah · {summary.totalRows} baris KK
                </Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <BarChart3 className="mr-1.5 h-3 w-3" />
                  Total RAB Nasional: {formatIdr(totalSummary.totalRAB)}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm text-slate-600 w-full lg:w-[360px]">
                <span className="font-medium text-slate-900">Cari Data</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari NPSN, provinsi, kab/kota, nama sekolah, nama KK, detail alat..."
                    className="pl-9"
                  />
                </div>
              </label>
              <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="inline-flex items-center gap-2">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {refreshing ? "Memperbarui..." : "Perbarui Data"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || filtered.length === 0}
                  onClick={() => triggerCsvDownload(filtered)}
                  className="inline-flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
                <Button
                  type="button"
                  disabled={loading || isExportingXlsx || filtered.length === 0}
                  onClick={async () => { try { setIsExportingXlsx(true); await triggerXlsxDownload(filtered); } finally { setIsExportingXlsx(false); } }}
                  className="inline-flex items-center gap-2"
                >
                  {isExportingXlsx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  {isExportingXlsx ? "Mengekspor..." : "Export Spreadsheet"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || filtered.length === 0}
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Cetak / Print PDF
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <div className="hidden print:block pb-4 border-b border-slate-200 mb-4">
          <h1 className="text-xl font-bold text-slate-950">LAPORAN PRA BIMTEK PPK</h1>
          <p className="text-sm text-slate-700">Direktorat SMK · Periode Pra Bimtek 2026 · Dicetak {new Date().toLocaleString("id-ID")}</p>
        </div>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 print:hidden">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm font-medium">Menghitung RAB per KK dari data proposal sekolah...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-500">
              Tidak ada data yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1620px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-14 px-3 py-3">No</th>
                    <th className="min-w-[180px] px-3 py-3">Provinsi</th>
                    <th className="min-w-[200px] px-3 py-3">Kota / Kabupaten</th>
                    <th className="min-w-[300px] px-3 py-3">Nama Sekolah</th>
                    <th className="min-w-[320px] px-3 py-3">KK Ajuan</th>
                    <th className="w-32 px-3 py-3 text-right">Jumlah Siswa</th>
                    <th className="w-28 px-3 py-3 text-right">Jumlah Alat</th>
                    <th className="min-w-[540px] px-3 py-3">Detail Alat (Nama · Jumlah · Harga · Total)</th>
                    <th className="w-52 px-3 py-3 text-right">RAB KK</th>
                    <th className="w-52 px-3 py-3 text-right">RAB Total Sekolah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((row) => (
                    <tr key={`${row.schoolId}-${row.kkCode || "empty"}`} className="hover:bg-slate-50/60 align-top">
                      <td className="px-3 py-3 text-slate-700 tabular-nums">{row.no}</td>
                      <td className="px-3 py-3 text-slate-700">{row.provinsi || <span className="text-xs text-slate-400">-</span>}</td>
                      <td className="px-3 py-3 text-slate-700">{row.kotaKabupaten || <span className="text-xs text-slate-400">-</span>}</td>
                      <td className="px-3 py-3 text-slate-900 font-medium leading-snug">
                        <div>{row.namaSekolah}</div>
                        <div className="text-[11px] font-normal text-slate-500 tabular-nums mt-0.5">NPSN {row.npsn}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          "inline-flex items-start gap-2 rounded-lg px-2.5 py-1.5",
                          row.rabKk > 0
                            ? "bg-emerald-50/60 border border-emerald-100 text-emerald-900"
                            : "bg-slate-50 border border-dashed border-slate-200 text-slate-600",
                        )}>
                          <span className="text-sm font-semibold leading-snug break-words">{row.kkAjuan}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-800 font-semibold tabular-nums">
                        {row.jumlahSiswa > 0 ? row.jumlahSiswa.toLocaleString("id-ID") : <span className="text-slate-400 text-xs font-normal">0</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-800 tabular-nums">
                        {row.jumlahAlat > 0 ? row.jumlahAlat.toLocaleString("id-ID") : <span className="text-slate-400 text-xs">0</span>}
                      </td>
                      <td className="px-3 py-3 leading-snug">
                        {Array.isArray(row.detailAlat) && row.detailAlat.length > 0 ? (
                          <div className="space-y-2">
                            <table className="w-full border-collapse rounded-lg overflow-hidden border border-slate-200 text-[12px]">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-[10px]">Nama Alat</th>
                                  <th className="w-24 px-2 py-1.5 text-right font-semibold uppercase tracking-wide text-[10px]">Jumlah Alat</th>
                                  <th className="w-32 px-2 py-1.5 text-right font-semibold uppercase tracking-wide text-[10px]">Harga Alat</th>
                                  <th className="w-40 px-2 py-1.5 text-right font-semibold uppercase tracking-wide text-[10px]">Harga Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {row.detailAlat.map((alat, idx) => (
                                  <tr key={idx} className="even:bg-slate-50/50">
                                    <td className="px-2 py-1.5 text-slate-800">{alat.namaAlat}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{alat.jumlahAlat.toLocaleString("id-ID")}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{formatIdr(alat.hargaAlat)}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-900 font-medium tabular-nums">{formatIdr(alat.hargaTotal)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-emerald-50 border-t border-emerald-200 text-emerald-900">
                                  <td className="px-2 py-2 text-xs font-bold uppercase tracking-wide">TOTAL RAB (KK)</td>
                                  <td className="px-2 py-2 text-right text-xs font-bold tabular-nums">{row.detailAlat.reduce((s, a) => s + a.jumlahAlat, 0).toLocaleString("id-ID")}</td>
                                  <td className="px-2 py-2 text-right text-xs text-emerald-700 tabular-nums">—</td>
                                  <td className="px-2 py-2 text-right text-sm font-extrabold tabular-nums">{formatIdr(row.detailAlat.reduce((s, a) => s + a.hargaTotal, 0))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Belum ada usulan alat</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-emerald-800 font-semibold tabular-nums">
                        {row.rabKk > 0 ? formatIdr(row.rabKk) : <span className="text-slate-400 font-normal text-xs">Rp 0</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-950 font-bold tabular-nums">
                        {row.rabTotal > 0 ? formatIdr(row.rabTotal) : <span className="text-slate-500 font-normal text-xs">Rp 0</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="print-total-row bg-slate-950 text-white align-top">
                    <td colSpan={5} className="px-3 py-4 text-sm font-semibold uppercase tracking-wider">
                      TOTAL SELURUH USULAN (FILTER SAAT INI)
                    </td>
                    <td className="px-3 py-4 text-right text-sm font-semibold text-amber-200 tabular-nums">
                      {summary.siswaAggregate.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-4 text-right text-sm font-semibold text-indigo-200 tabular-nums">
                      {summary.totalAlat.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-4 text-right text-xs font-medium text-slate-300">
                      {filtered.length} baris KK · {summary.totalSekolah} sekolah
                    </td>
                    <td className="px-3 py-4 text-right text-sm font-semibold text-emerald-300 tabular-nums">
                      {formatIdr(summary.totalRAB)}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <span className="text-xl font-extrabold text-emerald-300 tabular-nums">
                        {formatIdr(summary.totalRAB)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500 px-1 print:hidden">
            <strong className="font-semibold text-slate-700">Catatan Cetak &amp; Export:</strong>
            tombol <strong>Cetak / Print PDF</strong> otomatis menyembunyikan tombol/sidebar dan hanya menampilkan tabel + header laporan.
            Tombol <strong>Download CSV</strong> mengekspor baris yang sedang difilter (urutan tabel sesuai nomor).
            Klik <strong>Perbarui Data</strong> untuk sinkronisasi terbaru dari server.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
