"use client";

import { BadgeCheck, Building2, CheckCircle2, CheckSquare, Clock4, Loader2, MessageSquareWarning, RefreshCw, Search, UserRound, Users, Wrench, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  adminUsersRequest,
  upsertWorkspaceAssignmentsRequest,
  workspaceAssignmentsRequest,
  workspaceAssignmentSourceRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type AdminUserRecord,
  type WorkspaceAssignmentRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import {
  assignmentModuleLabels,
  assignmentTabs,
  type AssignmentModuleKey,
  type AssignmentTabKey,
} from "@/lib/task-assignments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

type SchoolRow = {
  no: number;
  npsn: string;
  nama_sekolah: string;
  fasilitator_administrasi?: string;
  fasilitator_peralatan?: string;
  verifikasi?: WorkspaceVerifikasiOnlineRecord | null;
};

type SourceSchoolRow = {
  no?: number;
  npsn?: string;
  nama_sekolah?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

type ReviewItemStatus = "approved" | "approved_with_note" | "rejected" | "revisi" | "pending" | string;

interface ParsedCatatanReview {
  globalNote: string;
  items: Array<{ label: string; status: ReviewItemStatus; note: string }>;
}

function statusBadgeColor(status: ReviewItemStatus) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "approved_with_note") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "revisi" || status === "perbaiki") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "pending") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function statusLabel(status: ReviewItemStatus) {
  if (status === "approved") return "Disetujui";
  if (status === "approved_with_note") return "Setujui Catatan";
  if (status === "rejected") return "Ditolak";
  if (status === "revisi" || status === "perbaiki") return "Perbaiki";
  if (status === "pending") return "Pending";
  return status ? String(status) : "Belum Proses";
}

function humanizeLabel(code: string) {
  return code
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function parseCatatanReview(raw: string | null | undefined): ParsedCatatanReview | string | null {
  const base = normalizeText(raw);
  if (!base) return null;
  if (!base.startsWith("{") && !base.startsWith("[")) return base;
  try {
    const parsed = JSON.parse(base) as Record<string, unknown>;
    const items: ParsedCatatanReview["items"] = [];
    const pushFromMap = (bag: unknown, prefix = "") => {
      if (!bag || typeof bag !== "object") return;
      for (const [key, val] of Object.entries(bag as Record<string, unknown>)) {
        if (!val || typeof val !== "object") continue;
        const v = val as Record<string, unknown>;
        const note = normalizeText(v.note);
        const statusRaw = normalizeText(v.status || v.reviewStatus || v.approval);
        if (!statusRaw && !note) continue;
        items.push({
          label: `${prefix ? `${prefix} · ` : ""}${humanizeLabel(key)}`,
          status: statusRaw || "pending",
          note,
        });
      }
    };
    pushFromMap(parsed.documents ?? parsed.dokumen ?? parsed.document, "Dokumen");
    pushFromMap(parsed.concentrations ?? parsed.konsentrasi ?? parsed.konsentrasiKeahlian, "Konsentrasi");
    pushFromMap(parsed.conditions ?? parsed.kondisi ?? parsed.kondisiAlat, "Kondisi");
    pushFromMap(parsed.proposals ?? parsed.ajuan ?? parsed.pengajuan, "Pengajuan");
    pushFromMap(parsed.equipments ?? parsed.alat ?? parsed.peralatan ?? parsed.sarana, "Alat");
    pushFromMap(parsed.perKk ?? parsed.perKonsentrasi, "Per Konsentrasi");
    if (parsed.dataSekolah && typeof parsed.dataSekolah === "object") {
      const d = parsed.dataSekolah as Record<string, unknown>;
      const note = normalizeText(d.note);
      const statusRaw = normalizeText(d.status || d.reviewStatus || d.approval);
      if (statusRaw || note) {
        items.unshift({ label: "Data Sekolah", status: statusRaw || "pending", note });
      }
    }
    if (parsed.dokumenAdministrasi && typeof parsed.dokumenAdministrasi === "object") {
      const d = parsed.dokumenAdministrasi as Record<string, unknown>;
      const note = normalizeText(d.note);
      const statusRaw = normalizeText(d.status || d.reviewStatus || d.approval);
      if (statusRaw || note) {
        items.unshift({ label: "Dokumen Administrasi", status: statusRaw || "pending", note });
      }
    }
    if (parsed.konsentrasi && typeof parsed.konsentrasi === "object" && !Array.isArray(parsed.konsentrasi)) {
      const d = parsed.konsentrasi as Record<string, unknown>;
      if (d && typeof d === "object" && ("status" in d || "note" in d) && !("status" in d && typeof d.status === "object")) {
        const note = normalizeText((d as Record<string, unknown>).note);
        const statusRaw = normalizeText((d as Record<string, unknown>).status || (d as Record<string, unknown>).reviewStatus || (d as Record<string, unknown>).approval);
        if (statusRaw || note) {
          items.unshift({ label: "Konsentrasi Keahlian", status: statusRaw || "pending", note });
        }
      }
    }
    if (parsed.kondisi && typeof parsed.kondisi === "object" && !Array.isArray(parsed.kondisi)) {
      const d = parsed.kondisi as Record<string, unknown>;
      if (d && typeof d === "object" && ("status" in d || "note" in d) && !("status" in d && typeof d.status === "object")) {
        const note = normalizeText((d as Record<string, unknown>).note);
        const statusRaw = normalizeText((d as Record<string, unknown>).status || (d as Record<string, unknown>).reviewStatus || (d as Record<string, unknown>).approval);
        if (statusRaw || note) {
          items.unshift({ label: "Kondisi Alat", status: statusRaw || "pending", note });
        }
      }
    }
    if (parsed.ajuan && typeof parsed.ajuan === "object" && !Array.isArray(parsed.ajuan)) {
      const d = parsed.ajuan as Record<string, unknown>;
      if (d && typeof d === "object" && ("status" in d || "note" in d) && !("status" in d && typeof d.status === "object")) {
        const note = normalizeText((d as Record<string, unknown>).note);
        const statusRaw = normalizeText((d as Record<string, unknown>).status || (d as Record<string, unknown>).reviewStatus || (d as Record<string, unknown>).approval);
        if (statusRaw || note) {
          items.unshift({ label: "Ajuan / Pengajuan", status: statusRaw || "pending", note });
        }
      }
    }
    const globalNote = normalizeText(parsed.globalNote);
    if (!globalNote && items.length === 0) return null;
    return { globalNote, items };
  } catch {
    return base;
  }
}

function renderCatatanReview(raw: string | null | undefined, emptyLabel = "Belum ada catatan review.") {
  const parsed = parseCatatanReview(raw);
  if (!parsed) {
    return <span className="italic text-slate-400">{emptyLabel}</span>;
  }
  if (typeof parsed === "string") {
    return (
      <div className="whitespace-pre-wrap text-slate-700">{parsed}</div>
    );
  }
  return (
    <div className="space-y-2">
      {parsed.globalNote ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Catatan Umum</p>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-slate-700">{parsed.globalNote}</p>
        </div>
      ) : null}
      {parsed.items.length > 0 ? (
        <ul className="space-y-1.5">
          {parsed.items.slice(0, 6).map((it, idx) => (
            <li key={idx} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
              <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-md border px-1.5 py-[1px] text-[10px] font-medium ${statusBadgeColor(it.status)}`}>
                {statusLabel(it.status)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-slate-700">{it.label}</p>
                {it.note ? (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-4 text-slate-500">{it.note}</p>
                ) : null}
              </div>
            </li>
          ))}
          {parsed.items.length > 6 ? (
            <li className="text-[10px] text-slate-500">+{parsed.items.length - 6} detail lainnya</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function createInitialRowsByTab(): Record<AssignmentTabKey, SchoolRow[]> {
  return { bantuan: [], abt: [] };
}

function mapRows(
  payload: SourceSchoolRow[],
  verifikasiByNpsn: Map<string, WorkspaceVerifikasiOnlineRecord> = new Map(),
): SchoolRow[] {
  return (Array.isArray(payload) ? payload : []).map<SchoolRow>((row, index) => ({
    no: row.no ?? index + 1,
    npsn: normalizeText(row.npsn),
    nama_sekolah: row.nama_sekolah ?? "",
    fasilitator_administrasi: "",
    fasilitator_peralatan: "",
    verifikasi: (row.npsn ? verifikasiByNpsn.get(normalizeText(row.npsn)) : undefined) ?? null,
  }));
}

const inputBase =
  "h-10 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50";

export function AdminPembagianTugasPage({
  title,
  subtitle,
  moduleKey,
  defaultActiveTab = "abt",
  visibleTabs = ["abt"],
}: {
  title: string;
  subtitle?: string;
  moduleKey: AssignmentModuleKey;
  defaultActiveTab?: AssignmentTabKey;
  visibleTabs?: AssignmentTabKey[];
}) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rowsByTab, setRowsByTab] = useState<Record<AssignmentTabKey, SchoolRow[]>>(
    createInitialRowsByTab,
  );
  const safeVisibleTabs = useMemo(
    () =>
      (visibleTabs && visibleTabs.length > 0
        ? assignmentTabs.filter((tab) => visibleTabs.includes(tab.key))
        : assignmentTabs
      ).filter(Boolean),
    [visibleTabs],
  );
  const initialActiveTab: AssignmentTabKey =
    safeVisibleTabs.some((tab) => tab.key === defaultActiveTab)
      ? defaultActiveTab
      : (safeVisibleTabs[0]?.key as AssignmentTabKey) ?? "abt";
  const [activeTab, setActiveTab] = useState<AssignmentTabKey>(initialActiveTab);
  const [selectedNpsns, setSelectedNpsns] = useState<string[]>([]);
  const [administrationFacilitators, setAdministrationFacilitators] = useState<
    AdminUserRecord[]
  >([]);
  const [equipmentFacilitators, setEquipmentFacilitators] = useState<AdminUserRecord[]>(
    [],
  );
  const [search, setSearch] = useState("");
  const [selectedAdministrationFacilitator, setSelectedAdministrationFacilitator] =
    useState("");
  const [selectedEquipmentFacilitator, setSelectedEquipmentFacilitator] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [refreshingVerifikasi, setRefreshingVerifikasi] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [verifikasiByNpsn, setVerifikasiByNpsn] = useState<Map<string, WorkspaceVerifikasiOnlineRecord>>(new Map());

  async function reloadVerifikasiReviews() {
    if (!session?.token) return;
    setRefreshingVerifikasi(true);
    try {
      const rows = await workspaceVerifikasiOnlineReviewsRequest(session.token);
      const mapped = new Map(rows.map((item) => [item.schoolNpsn, item]));
      setVerifikasiByNpsn(mapped);
      setRowsByTab((current) => {
        const next: Record<AssignmentTabKey, SchoolRow[]> = { ...current } as Record<AssignmentTabKey, SchoolRow[]>;
        for (const tab of Object.keys(next) as AssignmentTabKey[]) {
          next[tab] = (next[tab] ?? []).map((row) => ({ ...row, verifikasi: mapped.get(row.npsn) ?? null }));
        }
        return next;
      });
    } finally {
      setRefreshingVerifikasi(false);
    }
  }

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) return;
    let cancelled = false;
    async function load() {
      const token = session?.token;
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const [bantuanPayload, abtPayload, facilitatorResponse, existingAssignments, verifikasiRows] =
          await Promise.all([
            workspaceAssignmentSourceRequest(token, "bantuan"),
            workspaceAssignmentSourceRequest(token, "abt"),
            adminUsersRequest(),
            workspaceAssignmentsRequest(token, { moduleKey }),
            workspaceVerifikasiOnlineReviewsRequest(token),
          ]);
        if (cancelled) return;
        const verifikasiMap = new Map(verifikasiRows.map((item) => [item.schoolNpsn, item]));
        setVerifikasiByNpsn(verifikasiMap);
        const assignmentByTabAndNpsn = new Map(
          existingAssignments.map((assignment) => [
            `${assignment.sourceTab}:${assignment.schoolNpsn}`,
            assignment,
          ]),
        );
        const mergeRows = (
          payload: Array<Record<string, unknown>>,
          sourceTab: AssignmentTabKey,
        ) =>
          mapRows(payload as SourceSchoolRow[], verifikasiMap).map((row) => {
            const assignment = assignmentByTabAndNpsn.get(`${sourceTab}:${row.npsn}`);
            return assignment
              ? {
                  ...row,
                  fasilitator_administrasi: assignment.facilitatorAdministrationName,
                  fasilitator_peralatan: assignment.facilitatorEquipmentName,
                }
              : row;
          });
        setRowsByTab({
          bantuan: mergeRows(bantuanPayload, "bantuan"),
          abt: mergeRows(abtPayload, "abt"),
        });
        setAdministrationFacilitators(
          facilitatorResponse.users.filter(
            (user) => user.roleCode === "FASILITATOR_ADMINISTRASI" && user.isActive,
          ),
        );
        setEquipmentFacilitators(
          facilitatorResponse.users.filter(
            (user) => user.roleCode === "FASILITATOR_ALAT" && user.isActive,
          ),
        );
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Gagal memuat data verifikasi online.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, moduleKey, session?.token]);

  const currentTab =
    safeVisibleTabs.find((tab) => tab.key === activeTab) ??
    safeVisibleTabs[0] ??
    assignmentTabs[0];
  const rows = rowsByTab[activeTab] ?? [];
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return rows;
    return rows.filter((row) =>
      [row.npsn, row.nama_sekolah, row.fasilitator_administrasi ?? "", row.fasilitator_peralatan ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [rows, search]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedNpsns.includes(row.npsn)),
    [rows, selectedNpsns],
  );
  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedNpsns.includes(row.npsn));

  function verifikasiApprovalVariant(status: boolean | null) {
    if (status === true) return "success";
    if (status === false) return "danger";
    return "warning";
  }
  function verifikasiApprovalLabel(status: boolean | null) {
    if (status === true) return "Disetujui";
    if (status === false) return "Ditolak";
    return "Belum Proses";
  }

  function handleTabChange(nextTab: AssignmentTabKey) {
    setActiveTab(nextTab);
    setSelectedNpsns([]);
    setSearch("");
    setFeedback(null);
  }

  function toggleSchoolSelection(npsn: string) {
    setSelectedNpsns((current) =>
      current.includes(npsn) ? current.filter((item) => item !== npsn) : [...current, npsn],
    );
  }

  function toggleSelectAllVisible() {
    setSelectedNpsns((current) => {
      if (allVisibleSelected) {
        return current.filter((npsn) => !filteredRows.some((row) => row.npsn === npsn));
      }
      const merged = new Set(current);
      for (const row of filteredRows) merged.add(row.npsn);
      return Array.from(merged);
    });
  }

  function clearSelection() {
    setSelectedNpsns([]);
  }

  async function applyAssignment() {
    if (!selectedNpsns.length) {
      setFeedback({
        type: "error",
        text: "Pilih minimal satu sekolah terlebih dahulu.",
      });
      return;
    }
    if (!selectedAdministrationFacilitator || !selectedEquipmentFacilitator) {
      setFeedback({
        type: "error",
        text: "Pilih fasilitator administrasi dan fasilitator alat sebelum membagikan tugas.",
      });
      return;
    }
    const administrationUser =
      administrationFacilitators.find((item) => item.id === selectedAdministrationFacilitator) ??
      null;
    const equipmentUser =
      equipmentFacilitators.find((item) => item.id === selectedEquipmentFacilitator) ?? null;
    const administrationName = administrationUser?.fullName ?? "";
    const equipmentName = equipmentUser?.fullName ?? "";
    setAssigning(true);
    setFeedback(null);
    try {
      if (!session?.token) throw new Error("Sesi login admin tidak ditemukan.");
      const records: WorkspaceAssignmentRecord[] = rows
        .filter((row) => selectedNpsns.includes(row.npsn))
        .map((row) => ({
          key: `${moduleKey}:${activeTab}:${row.npsn}`,
          moduleKey,
          moduleLabel: assignmentModuleLabels[moduleKey],
          sourceTab: activeTab,
          sourceLabel: currentTab.label,
          schoolNo: row.no,
          schoolNpsn: row.npsn,
          schoolName: row.nama_sekolah,
          facilitatorAdministrationId: administrationUser?.id ?? "",
          facilitatorAdministrationName: administrationName,
          facilitatorEquipmentId: equipmentUser?.id ?? "",
          facilitatorEquipmentName: equipmentName,
          interviewScheduledDate: null,
          interviewScheduledTime: null,
          interviewMeetingLink: null,
          updatedAt: new Date().toISOString(),
        }));
      await upsertWorkspaceAssignmentsRequest(session.token, records);
      const nextRows = rows.map((row) =>
        selectedNpsns.includes(row.npsn)
          ? {
              ...row,
              fasilitator_administrasi: administrationName,
              fasilitator_peralatan: equipmentName,
            }
          : row,
      );
      setRowsByTab((current) => ({ ...current, [activeTab]: nextRows }));
      setFeedback({
        type: "success",
        text: `${selectedNpsns.length} sekolah berhasil diassign ke ${administrationName} dan ${equipmentName}.`,
      });
      setSelectedNpsns([]);
    } catch (assignError) {
      setFeedback({
        type: "error",
        text:
          assignError instanceof Error ? assignError.message : "Gagal menyimpan pembagian tugas.",
      });
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Admin • Pembagian Tugas
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              {subtitle ??
                "Tetapkan fasilitator administrasi dan fasilitator alat untuk sekolah penerima bantuan ABT. Status verifikasi online berasal dari review Fasilitator Alat & Administrasi (sumber data sama dengan halaman sekolah & fasilitator)."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <Users className="mr-1 inline h-3.5 w-3.5" />
              Total sekolah: {rows.length}
            </Badge>
            <Badge variant="secondary">Terpilih: {selectedRows.length}</Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void reloadVerifikasiReviews()}
              disabled={refreshingVerifikasi || loading || !session?.token}
              className="gap-2"
            >
              {refreshingVerifikasi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Status Verifikasi
            </Button>
          </div>
        </div>
      </section>

      {safeVisibleTabs.length > 1 ? (
        <section className="flex flex-wrap gap-3">
          {safeVisibleTabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </section>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <Card className="rounded-[28px]">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-3 md:gap-4">
              <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>Cari Sekolah</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="NPSN / nama / fasil..."
                    className="pl-9"
                  />
                </div>
              </label>
              <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>Fasilitator Administrasi</span>
                <select
                  value={selectedAdministrationFacilitator}
                  onChange={(event) => setSelectedAdministrationFacilitator(event.target.value)}
                  className={inputBase}
                >
                  <option value="">Pilih fasil admin...</option>
                  {administrationFacilitators.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>Fasilitator Alat</span>
                <select
                  value={selectedEquipmentFacilitator}
                  onChange={(event) => setSelectedEquipmentFacilitator(event.target.value)}
                  className={inputBase}
                >
                  <option value="">Pilih fasil alat...</option>
                  {equipmentFacilitators.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                onClick={applyAssignment}
                disabled={assigning || !selectedRows.length}
                size="lg"
                className="w-full md:w-auto"
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                Terapkan ke {selectedRows.length} Sekolah
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={toggleSelectAllVisible}
              disabled={loading || filteredRows.length === 0}
            >
              <CheckSquare className="h-4 w-4" />
              {allVisibleSelected ? "Batal Pilih Semua" : "Pilih Semua Terlihat"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearSelection}
              disabled={!selectedNpsns.length}
            >
              <X className="h-4 w-4" />
              Bersihkan Pilihan
            </Button>
            <div className="ml-auto text-xs text-slate-500">
              Sumber: <b>{currentTab.label}</b> • Menampilkan {filteredRows.length} dari {rows.length} sekolah
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[1420px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="w-16 px-4 py-3">No</th>
                  <th className="px-4 py-3 w-32">NPSN</th>
                  <th className="px-4 py-3 w-64">Nama Sekolah</th>
                  <th className="px-4 py-3 w-52">Fasilitator Administrasi</th>
                  <th className="px-4 py-3 w-52">Fasilitator Alat</th>
                  <th className="px-4 py-3 w-52">
                    <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Status Verifikasi Admin</div>
                  </th>
                  <th className="px-4 py-3 w-52">
                    <div className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Status Verifikasi Alat</div>
                  </th>
                  <th className="px-4 py-3">
                    <div className="flex items-center gap-1.5"><MessageSquareWarning className="h-3.5 w-3.5" /> Catatan Ringkasan Review</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Memuat data sekolah, fasilitator, dan status verifikasi...
                      </span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Tidak ada sekolah yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const checked = selectedNpsns.includes(row.npsn);
                    const zebra = idx % 2 === 0;
                    const verifikasi = row.verifikasi ?? null;
                    const approvedAdmin = verifikasi?.approvedAdmin ?? null;
                    const approvedEquipment = verifikasi?.approvedEquipment ?? null;
                    const noteAdmin = verifikasi?.reviewNoteAdmin?.trim() ?? "";
                    const noteEquipment = verifikasi?.reviewNoteEquipment?.trim() ?? "";
                    return (
                      <tr
                        key={`${activeTab}-${row.npsn || row.no}`}
                        className={`${
                          checked ? "bg-primary/[0.05]" : zebra ? "bg-white" : "bg-slate-50/40"
                        } hover:bg-slate-50`}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSchoolSelection(row.npsn)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{row.no}</td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-950">
                          {row.npsn}
                        </td>
                        <td className="px-4 py-3.5 text-slate-800">{row.nama_sekolah}</td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {row.fasilitator_administrasi ? (
                            <Badge variant="success" className="font-normal">
                              {row.fasilitator_administrasi}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Belum ditetapkan</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {row.fasilitator_peralatan ? (
                            <Badge variant="success" className="font-normal">
                              {row.fasilitator_peralatan}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Belum ditetapkan</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          <div className="space-y-2">
                            <Badge variant={verifikasiApprovalVariant(approvedAdmin)}>
                              {approvedAdmin === true ? (
                                <CheckCircle2 className="mr-1.5 h-3 w-3" />
                              ) : approvedAdmin === false ? (
                                <XCircle className="mr-1.5 h-3 w-3" />
                              ) : (
                                <Clock4 className="mr-1.5 h-3 w-3" />
                              )}
                              Admin: {verifikasiApprovalLabel(approvedAdmin)}
                            </Badge>
                            {verifikasi?.reviewedAdminName ? (
                              <p className="text-[11px] leading-5 text-slate-500">
                                <span className="inline-block h-3 w-3 mr-1 align-middle">
                                  <UserRound className="h-full w-full" />
                                </span>
                                {verifikasi.reviewedAdminName}
                                {verifikasi.reviewedAdminAt
                                  ? ` • ${new Date(verifikasi.reviewedAdminAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          <div className="space-y-2">
                            <Badge variant={verifikasiApprovalVariant(approvedEquipment)}>
                              {approvedEquipment === true ? (
                                <CheckCircle2 className="mr-1.5 h-3 w-3" />
                              ) : approvedEquipment === false ? (
                                <XCircle className="mr-1.5 h-3 w-3" />
                              ) : (
                                <Clock4 className="mr-1.5 h-3 w-3" />
                              )}
                              Alat: {verifikasiApprovalLabel(approvedEquipment)}
                            </Badge>
                            {verifikasi?.reviewedEquipmentName ? (
                              <p className="text-[11px] leading-5 text-slate-500">
                                <span className="inline-block h-3 w-3 mr-1 align-middle">
                                  <UserRound className="h-full w-full" />
                                </span>
                                {verifikasi.reviewedEquipmentName}
                                {verifikasi.reviewedEquipmentAt
                                  ? ` • ${new Date(verifikasi.reviewedEquipmentAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs leading-5 text-slate-700 max-w-[420px] align-top">
                          <div className="space-y-3">
                            <div>
                              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                <Wrench className="h-3 w-3" />
                                Alat
                              </p>
                              {renderCatatanReview(noteEquipment)}
                            </div>
                            <div>
                              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                <Building2 className="h-3 w-3" />
                                Admin
                              </p>
                              {renderCatatanReview(noteAdmin)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
