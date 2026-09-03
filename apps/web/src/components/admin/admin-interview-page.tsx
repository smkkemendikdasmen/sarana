"use client";

import { Building2, CheckSquare, Loader2, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  adminUsersRequest,
  upsertWorkspaceAssignmentsRequest,
  workspaceAssignmentsRequest,
  workspaceAssignmentSourceRequest,
  type AdminUserRecord,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
import {
  assignmentModuleLabels,
  assignmentTabs,
  type AssignmentModuleKey,
  type AssignmentTabKey,
} from "@/lib/task-assignments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

type SchoolRow = {
  no: number;
  npsn: string;
  nama_sekolah: string;
  fasilitator_administrasi?: string;
  fasilitator_peralatan?: string;
};

type SourceSchoolRow = {
  no?: number;
  npsn?: string;
  nama_sekolah?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function createInitialRowsByTab(): Record<AssignmentTabKey, SchoolRow[]> {
  return {
    bantuan: [],
    abt: [],
  };
}

function mapRows(payload: SourceSchoolRow[]) {
  return (Array.isArray(payload) ? payload : []).map((row, index) => ({
    no: row.no ?? index + 1,
    npsn: normalizeText(row.npsn),
    nama_sekolah: row.nama_sekolah ?? "",
    fasilitator_administrasi: "",
    fasilitator_peralatan: "",
  }));
}

export function AdminInterviewPage({
  title = "Wawancara",
  moduleKey = "wawancara",
  defaultActiveTab = "bantuan",
  visibleTabs = ["bantuan", "abt"],
}: {
  title?: string;
  moduleKey?: AssignmentModuleKey;
  defaultActiveTab?: AssignmentTabKey;
  visibleTabs?: AssignmentTabKey[];
}) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rowsByTab, setRowsByTab] = useState<Record<AssignmentTabKey, SchoolRow[]>>(createInitialRowsByTab);
  const safeVisibleTabs = useMemo(
    () =>
      (visibleTabs && visibleTabs.length > 0
        ? assignmentTabs.filter((tab) => visibleTabs.includes(tab.key))
        : assignmentTabs
      ).filter(Boolean),
    [visibleTabs],
  );
  const initialActiveTab: AssignmentTabKey =
    safeVisibleTabs.some((tab) => tab.key === defaultActiveTab) ? defaultActiveTab : safeVisibleTabs[0]?.key ?? "bantuan";
  const [activeTab, setActiveTab] = useState<AssignmentTabKey>(initialActiveTab);
  const [selectedNpsns, setSelectedNpsns] = useState<string[]>([]);
  const [administrationFacilitators, setAdministrationFacilitators] = useState<AdminUserRecord[]>([]);
  const [equipmentFacilitators, setEquipmentFacilitators] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAdministrationFacilitator, setSelectedAdministrationFacilitator] = useState("");
  const [selectedEquipmentFacilitator, setSelectedEquipmentFacilitator] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) {
      return;
    }

    let cancelled = false;

    async function load() {
      const token = session?.token;
      if (!token) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [bantuanPayload, abtPayload, facilitatorResponse, existingAssignments] = await Promise.all([
          workspaceAssignmentSourceRequest(token, "bantuan"),
          workspaceAssignmentSourceRequest(token, "abt"),
          adminUsersRequest(),
          workspaceAssignmentsRequest(token, { moduleKey }),
        ]);

        if (cancelled) {
          return;
        }

        const assignmentByTabAndNpsn = new Map(
          existingAssignments.map((assignment) => [`${assignment.sourceTab}:${assignment.schoolNpsn}`, assignment]),
        );

        const mergeRows = (payload: Array<Record<string, unknown>>, sourceTab: AssignmentTabKey) =>
          mapRows(payload as SourceSchoolRow[]).map((row) => {
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
          facilitatorResponse.users.filter((user) => user.roleCode === "FASILITATOR_ADMINISTRASI" && user.isActive),
        );
        setEquipmentFacilitators(
          facilitatorResponse.users.filter((user) => user.roleCode === "FASILITATOR_ALAT" && user.isActive),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : `Gagal memuat data ${title.toLowerCase()}.`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [hydrated, moduleKey, session?.token, title]);

  const currentTab = safeVisibleTabs.find((tab) => tab.key === activeTab) ?? safeVisibleTabs[0] ?? assignmentTabs[0];
  const rows = rowsByTab[activeTab] ?? [];

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return rows;
    }

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
    filteredRows.length > 0 && filteredRows.every((row) => selectedNpsns.includes(row.npsn));

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
      for (const row of filteredRows) {
        merged.add(row.npsn);
      }
      return Array.from(merged);
    });
  }

  function clearSelection() {
    setSelectedNpsns([]);
  }

  async function applyAssignment() {
    if (!selectedNpsns.length) {
      setFeedback({ type: "error", text: "Pilih minimal satu sekolah terlebih dahulu." });
      return;
    }

    if (!selectedAdministrationFacilitator || !selectedEquipmentFacilitator) {
      setFeedback({
        type: "error",
        text: "Pilih fasilitator administrasi dan fasilitator alat sebelum membagikan tugas.",
      });
      return;
    }

    const administrationName =
      administrationFacilitators.find((item) => item.id === selectedAdministrationFacilitator)?.fullName ?? "";
    const administrationUser =
      administrationFacilitators.find((item) => item.id === selectedAdministrationFacilitator) ?? null;
    const equipmentUser = equipmentFacilitators.find((item) => item.id === selectedEquipmentFacilitator) ?? null;
    const equipmentName = equipmentUser?.fullName ?? "";

    setAssigning(true);
    setFeedback(null);

    try {
      if (!session?.token) {
        throw new Error("Sesi login admin tidak ditemukan.");
      }

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
      setRowsByTab((current) => ({
        ...current,
        [activeTab]: nextRows,
      }));
      setFeedback({
        type: "success",
        text: `${selectedNpsns.length} sekolah berhasil dibagikan untuk ${title.toLowerCase()} ke ${administrationName} dan ${equipmentName}.`,
      });
      setSelectedNpsns([]);
    } catch (assignError) {
      setFeedback({
        type: "error",
        text: assignError instanceof Error ? assignError.message : "Gagal menyimpan pembagian tugas.",
      });
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">Pembagian Tugas</p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              Admin dapat membagi tugas untuk banyak sekolah sekaligus. Pilih tab sumber sekolah, centang beberapa
              sekolah, lalu tetapkan 1 fasilitator administrasi dan 1 fasilitator alat dalam satu aksi.
            </p>
          </div>
          <div className="rounded-[28px] border border-primary/10 bg-primary/[0.06] p-6">
            <p className="text-sm font-semibold text-primary">Alur Pembagian</p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {safeVisibleTabs.length > 1 ? (
                <li>1. Pilih tab sekolah penerima sesuai kebutuhan.</li>
              ) : (
                <li>1. Sumber sekolah: {safeVisibleTabs[0]?.label ?? "Sekolah Penerima"}.</li>
              )}
              <li>{safeVisibleTabs.length > 1 ? "2" : "2"}. Cari dan centang banyak sekolah pada tabel kiri.</li>
              <li>{safeVisibleTabs.length > 1 ? "3" : "3"}. Pilih pasangan fasilitator pada panel kanan.</li>
              <li>{safeVisibleTabs.length > 1 ? "4" : "4"}. Klik tombol tetapkan untuk assign serentak.</li>
            </ol>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Sekolah" value={`${rows.length}`} helper={`Sumber dari ${currentTab.sourceLabel}`} icon={<Building2 className="h-4 w-4" />} />
        <SummaryCard label="Sekolah Terpilih" value={`${selectedRows.length}`} helper="Siap untuk bulk assignment" icon={<CheckSquare className="h-4 w-4" />} />
        <SummaryCard label="Fasilitator Adm" value={`${administrationFacilitators.length}`} helper="User aktif role fasilitator administrasi" icon={<Users className="h-4 w-4" />} />
        <SummaryCard label="Fasilitator Alat" value={`${equipmentFacilitators.length}`} helper="User aktif role fasilitator alat" icon={<Users className="h-4 w-4" />} />
      </section>

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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <Card className="rounded-[28px]">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-2xl text-slate-950">{title} Sekolah</CardTitle>
                <p className="mt-2 text-sm text-slate-600">
                  Tabel menampilkan `No`, `NPSN`, `Nama Sekolah`, dan dua kolom fasilitator aktif untuk kontrol cepat
                  pada tab {currentTab.label.toLowerCase()}.
                </p>
              </div>
              <label className="grid gap-2 text-sm text-slate-600 lg:w-[320px]">
                <span className="font-medium text-slate-900">Cari Sekolah</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari NPSN atau nama sekolah..."
                    className="pl-9"
                  />
                </div>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={toggleSelectAllVisible} disabled={loading || filteredRows.length === 0}>
                <CheckSquare className="h-4 w-4" />
                {allVisibleSelected ? "Batal Pilih Semua" : "Pilih Semua Terlihat"}
              </Button>
              <Button type="button" variant="outline" onClick={clearSelection} disabled={!selectedNpsns.length}>
                <X className="h-4 w-4" />
                Bersihkan Pilihan
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-16 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="px-4 py-3">Fasilitator Administrasi</th>
                    <th className="px-4 py-3">Fasilitator Alat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Memuat data sekolah dan fasilitator...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Tidak ada sekolah yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const checked = selectedNpsns.includes(row.npsn);

                      return (
                        <tr key={`${activeTab}-${row.npsn || row.no}`} className={checked ? "bg-primary/[0.05]" : ""}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSchoolSelection(row.npsn)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-4 text-slate-700">{row.no}</td>
                          <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                          <td className="px-4 py-4 text-slate-700">{row.nama_sekolah}</td>
                          <td className="px-4 py-4 text-slate-700">{row.fasilitator_administrasi || "-"}</td>
                          <td className="px-4 py-4 text-slate-700">{row.fasilitator_peralatan || "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] xl:sticky xl:top-4 xl:self-start">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Panel Penugasan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sekolah Terpilih</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedRows.length}</p>
              <p className="mt-1 text-sm text-slate-500">
                Bulk assignment bekerja untuk semua sekolah yang dicentang pada tab aktif.
              </p>
            </div>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Pilih Fasilitator Administrasi</span>
              <select
                value={selectedAdministrationFacilitator}
                onChange={(event) => setSelectedAdministrationFacilitator(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
              >
                <option value="">Pilih fasilitator administrasi</option>
                {administrationFacilitators.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Pilih Fasilitator Alat</span>
              <select
                value={selectedEquipmentFacilitator}
                onChange={(event) => setSelectedEquipmentFacilitator(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
              >
                <option value="">Pilih fasilitator alat</option>
                {equipmentFacilitators.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Catatan Tampilan</p>
              <ul className="mt-2 space-y-2 leading-6">
                <li>1. Modul pembagian tugas memakai pola kerja yang sama di dua halaman.</li>
                <li>2. Tab memisahkan sekolah penerima bantuan reguler dan ABT.</li>
                <li>3. Panel kanan tetap fokus untuk aksi pembagian tugas massal.</li>
              </ul>
            </div>

            <Button type="button" onClick={applyAssignment} disabled={assigning || !selectedRows.length} className="w-full">
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Tetapkan ke Sekolah Terpilih
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-[24px]">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-primary">{icon}</div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}
