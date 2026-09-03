"use client";

import { Loader2, RefreshCw, Search, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  assignmentModuleLabels,
  type AssignmentModuleKey,
  type TaskAssignmentRecord,
} from "@/lib/task-assignments";
import {
  type BimtekReviewRecord,
  type InterviewAssessmentRecord,
} from "@/lib/facilitator-workspace";
import {
  type WorkspaceBimtekReviewRecord,
  type WorkspaceInterviewAssessmentRecord,
  type WorkspaceVerifikasiOnlineRecord,
  workspaceAdminSelectionRequest,
  workspaceAssignmentsRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type ModuleStatus = "belum" | "selesai" | "gagal";

interface DampinganRow {
  no: number;
  npsn: string;
  namaSekolah: string;
  verifikasi: ModuleStatus;
  verifikasiLabel: string;
  wawancara: ModuleStatus;
  wawancaraLabel: string;
  praBimtek: ModuleStatus;
  praBimtekLabel: string;
  bimtek: ModuleStatus;
  bimtekLabel: string;
  rpdPks: ModuleStatus;
  rpdPksLabel: string;
  fasilitatorAdmin: string;
  updatedAt: string;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUserName(fullName: string) {
  return normalizeText(fullName.replace(/\s+(PRISMA|SARANA\s*SMK)$/i, ""));
}

function formatDateTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value || "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function latestDate(a: string, b: string) {
  const at = Date.parse(a);
  const bt = Date.parse(b);
  if (Number.isNaN(at)) return b;
  if (Number.isNaN(bt)) return a;
  return at >= bt ? a : b;
}

function statusBadgeVariant(status: ModuleStatus): "success" | "danger" | "secondary" {
  if (status === "selesai") return "success";
  if (status === "gagal") return "danger";
  return "secondary";
}

function useDebouncedValue<T>(value: T, delayMs = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function FacilitatorAlatDataDampingan() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 220);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignments, setAssignments] = useState<TaskAssignmentRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewAssessmentRecord[]>([]);
  const [bimteks, setBimteks] = useState<BimtekReviewRecord[]>([]);
  const [verifikasi, setVerifikasi] = useState<WorkspaceVerifikasiOnlineRecord[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function load(showRefreshState = false) {
    if (!session?.token) return;
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);
    setLoadingStatuses(true);
    try {
      const userId = session.user.id;
      const userName = session.user.fullName;
      const normalizedName = userName ? normalizeUserName(userName) : "";

      const assignmentPayload = await workspaceAssignmentsRequest(session.token, {
        moduleKey: undefined,
        facilitatorEquipmentId: userId,
        facilitatorEquipmentName: normalizedName || undefined,
      });
      setAssignments(assignmentPayload as unknown as TaskAssignmentRecord[]);

      setLoading(false);
      setRefreshing(false);

      void (async () => {
        try {
          const selectionPayload = await workspaceAdminSelectionRequest(session.token, {
            scope: "light",
          });
          setInterviews(
            (selectionPayload.interviewResults as WorkspaceInterviewAssessmentRecord[]) as InterviewAssessmentRecord[],
          );
          setBimteks(
            (selectionPayload.bimtekReviews as WorkspaceBimtekReviewRecord[]) as BimtekReviewRecord[],
          );
          setVerifikasi(selectionPayload.verifikasiOnlineReviews ?? []);
        } catch {
          setInterviews([]);
          setBimteks([]);
          setVerifikasi([]);
        } finally {
          setLoadingStatuses(false);
        }
      })();
    } catch {
      setAssignments([]);
      setInterviews([]);
      setBimteks([]);
      setVerifikasi([]);
      setLoading(false);
      setRefreshing(false);
      setLoadingStatuses(false);
    }
  }

  useEffect(() => {
    if (!hydrated || !session?.token) return;
    void load(false);
  }, [hydrated, session?.token]);

  const facilitatorId = session?.user.id ?? "";
  const facilitatorName = session?.user.fullName ?? "";

  const rows = useMemo<DampinganRow[]>(() => {
    const normalizedName = normalizeUserName(facilitatorName);
    const role = session?.user.role;
    const isFasilitatorAdministrasi = role === "FASILITATOR_ADMINISTRASI";

    const scoped = assignments.filter((rec) => {
      if (isFasilitatorAdministrasi) {
        if (facilitatorId && rec.facilitatorAdministrationId === facilitatorId) return true;
        if (normalizedName && normalizeUserName(rec.facilitatorAdministrationName) === normalizedName)
          return true;
        return false;
      }
      if (facilitatorId && rec.facilitatorEquipmentId === facilitatorId) return true;
      if (normalizedName && normalizeUserName(rec.facilitatorEquipmentName) === normalizedName)
        return true;
      return false;
    });

    const bySchool = new Map<
      string,
      {
        no: number;
        npsn: string;
        nama: string;
        fasilitatorAdmin: string;
        modules: Set<AssignmentModuleKey>;
        updatedAt: string;
      }
    >();

    for (const rec of scoped) {
      const npsn = rec.schoolNpsn;
      const existing = bySchool.get(npsn);
      if (!existing) {
        bySchool.set(npsn, {
          no: rec.schoolNo,
          npsn,
          nama: rec.schoolName,
          fasilitatorAdmin: rec.facilitatorAdministrationName,
          modules: new Set([rec.moduleKey]),
          updatedAt: rec.updatedAt,
        });
      } else {
        existing.no = Math.min(existing.no, rec.schoolNo);
        existing.modules.add(rec.moduleKey);
        if (!existing.fasilitatorAdmin && rec.facilitatorAdministrationName) {
          existing.fasilitatorAdmin = rec.facilitatorAdministrationName;
        }
        existing.updatedAt = latestDate(existing.updatedAt, rec.updatedAt);
      }
    }

    const interviewMap = new Map(
      interviews.map((rec) => [normalizeText(rec.schoolNpsn), rec]),
    );
    const bimtekMap = new Map(bimteks.map((rec) => [normalizeText(rec.schoolNpsn), rec]));
    const verifMap = new Map(verifikasi.map((rec) => [normalizeText(rec.schoolNpsn), rec]));

    const result: DampinganRow[] = [];
    for (const agg of bySchool.values()) {
      const key = normalizeText(agg.npsn);

      let verifikasiStatus: ModuleStatus = "belum";
      let verifikasiLabel = loadingStatuses ? "Memuat…" : "Belum di Proses";
      if (agg.modules.has("verifikasi-online")) {
        const v = verifMap.get(key);
        if (v) {
          if (v.approvedEquipment === true) {
            verifikasiStatus = "selesai";
            verifikasiLabel = "Selesai";
          } else if (v.approvedEquipment === false) {
            verifikasiStatus = "gagal";
            verifikasiLabel = "Perlu Revisi";
          } else if (v.reviewedEquipmentId) {
            verifikasiStatus = "selesai";
            verifikasiLabel = "Diperiksa";
          }
        }
      }

      let wawancaraStatus: ModuleStatus = "belum";
      let wawancaraLabel = loadingStatuses ? "Memuat…" : "Belum di Proses";
      if (agg.modules.has("wawancara")) {
        const w = interviewMap.get(key);
        if (w) {
          const skor = Number(w.totalScore ?? 0);
          if (skor >= 70) {
            wawancaraStatus = "selesai";
            wawancaraLabel = `Lolos • ${skor}`;
          } else {
            wawancaraStatus = "gagal";
            wawancaraLabel = `Gagal • ${skor}`;
          }
        }
      }

      let praBimtekStatus: ModuleStatus = "belum";
      let praBimtekLabel = loadingStatuses ? "Memuat…" : "Belum di Proses";
      if (agg.modules.has("bimbingan-teknis")) {
        const b = bimtekMap.get(key);
        if (b?.statuses) {
          const survey = b.statuses.survey;
          const rpkp = b.statuses.rpkp;
          const rab = b.statuses.rab;
          const allApproved =
            survey === "approved" && rpkp === "approved" && rab === "approved";
          const anyRevisi = survey === "revisi" || rpkp === "revisi" || rab === "revisi";
          const anyPending = survey === "pending" || rpkp === "pending" || rab === "pending";
          if (allApproved) {
            praBimtekStatus = "selesai";
            praBimtekLabel = "Selesai";
          } else if (anyRevisi) {
            praBimtekStatus = "gagal";
            praBimtekLabel = "Perlu Revisi";
          } else if (anyPending) {
            praBimtekStatus = "belum";
            praBimtekLabel = "Di Proses";
          }
        }
      }

      let bimtekStatus: ModuleStatus = "belum";
      let bimtekLabel = loadingStatuses ? "Memuat…" : "Belum di Proses";
      if (agg.modules.has("bimbingan-teknis")) {
        const b = bimtekMap.get(key);
        if (b?.statuses) {
          const survey = b.statuses.survey;
          const rpkp = b.statuses.rpkp;
          const rab = b.statuses.rab;
          const praSelesai = survey === "approved" && rpkp === "approved" && rab === "approved";
          if (praSelesai && b.updatedAt) {
            bimtekStatus = "selesai";
            bimtekLabel = "Terjadwal";
          } else {
            bimtekStatus = "belum";
            bimtekLabel = praSelesai ? "Menunggu" : "Pra Bimtek";
          }
        }
      }

      let rpdPksStatus: ModuleStatus = "belum";
      let rpdPksLabel = loadingStatuses ? "Memuat…" : "Belum di Proses";
      if (verifMap.size || loadingStatuses) {
        const v = verifMap.get(key);
        if (v?.approvedEquipment === true) {
          rpdPksStatus = "selesai";
          rpdPksLabel = "Siap Review";
        } else if (agg.modules.has("verifikasi-online")) {
          rpdPksStatus = "belum";
          rpdPksLabel = "Menunggu";
        }
      }

      result.push({
        no: agg.no,
        npsn: agg.npsn,
        namaSekolah: agg.nama,
        verifikasi: verifikasiStatus,
        verifikasiLabel,
        wawancara: wawancaraStatus,
        wawancaraLabel,
        praBimtek: praBimtekStatus,
        praBimtekLabel,
        bimtek: bimtekStatus,
        bimtekLabel,
        rpdPks: rpdPksStatus,
        rpdPksLabel,
        fasilitatorAdmin: agg.fasilitatorAdmin || "-",
        updatedAt: agg.updatedAt,
      });
    }

    return result.sort((a, b) => a.no - b.no);
  }, [assignments, interviews, bimteks, verifikasi, facilitatorId, facilitatorName, loadingStatuses]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(debouncedSearch);
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.npsn.toLowerCase().includes(q) ||
        r.namaSekolah.toLowerCase().includes(q) ||
        r.fasilitatorAdmin.toLowerCase().includes(q),
    );
  }, [rows, debouncedSearch]);

  const stats = useMemo(() => {
    let vSelesai = 0;
    let wSelesai = 0;
    let pSelesai = 0;
    let rSelesai = 0;
    for (const r of rows) {
      if (r.verifikasi === "selesai") vSelesai++;
      if (r.wawancara === "selesai") wSelesai++;
      if (r.praBimtek === "selesai") pSelesai++;
      if (r.rpdPks === "selesai") rSelesai++;
    }
    return { total: rows.length, vSelesai, wSelesai, pSelesai, rSelesai };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Fasilitator Alat
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
              Data Dampingan Sekolah
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Daftar sekolah pendampingan Anda. Cek status realtime 5 tahapan alur: Verifikasi Online,
              {assignmentModuleLabels.wawancara}, Pra Bimtek (Survey · RPKP · RAB),
              {assignmentModuleLabels["bimbingan-teknis"]}, dan Review RPD + PKS.
            </p>
            {loadingStatuses && !loading ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.05] px-3 py-1 text-[11px] font-medium text-primary/90">
                <Loader2 className="h-3 w-3 animate-spin" />
                Status tahapan sedang dimuat di background…
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <Wrench className="mr-1 inline h-3.5 w-3.5" />
              {session?.user.fullName ?? "-"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <StatChip label="Total Sekolah" value={`${stats.total}`} tone="primary" />
          <StatChip
            label="Verifikasi Selesai"
            value={`${stats.vSelesai}/${rows.length}`}
            tone="emerald"
          />
          <StatChip
            label={`${assignmentModuleLabels.wawancara} Selesai`}
            value={`${stats.wSelesai}/${rows.length}`}
            tone="emerald"
          />
          <StatChip
            label="Pra Bimtek Selesai"
            value={`${stats.pSelesai}/${rows.length}`}
            tone="emerald"
          />
          <StatChip
            label="RPD · PKS Siap Review"
            value={`${stats.rSelesai}/${rows.length}`}
            tone="emerald"
          />
        </div>
      </section>

      <Card className="rounded-[28px]">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NPSN / nama sekolah / fasil adm..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <Badge variant="success">Selesai</Badge>
              <Badge variant="danger">Gagal / Revisi</Badge>
              <Badge variant="secondary">Belum di Proses</Badge>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[1480px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-4 py-3">No</th>
                  <th className="px-4 py-3">NPSN</th>
                  <th className="px-4 py-3">Nama Sekolah</th>
                  <th className="px-4 py-3">Verifikasi</th>
                  <th className="px-4 py-3">Wawancara</th>
                  <th className="px-4 py-3">Pra Bimtek</th>
                  <th className="px-4 py-3">Bimtek</th>
                  <th className="px-4 py-3">RPD · PKS</th>
                  <th className="px-4 py-3">Fasil Adm</th>
                  <th className="px-4 py-3">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Memuat daftar sekolah dampingan...
                      </span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Belum ada sekolah dampingannya untuk akun ini.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const zebra = idx % 2 === 0;
                    return (
                      <tr
                        key={row.npsn}
                        className={`${zebra ? "bg-white" : "bg-slate-50/40"} hover:bg-slate-50`}
                      >
                        <td className="px-4 py-3.5 text-slate-600">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-950">
                          {row.npsn}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {row.namaSekolah}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={statusBadgeVariant(row.verifikasi)}>
                            {row.verifikasiLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={statusBadgeVariant(row.wawancara)}>
                            {row.wawancaraLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={statusBadgeVariant(row.praBimtek)}>
                            {row.praBimtekLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={statusBadgeVariant(row.bimtek)}>
                            {row.bimtekLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={statusBadgeVariant(row.rpdPks)}>
                            {row.rpdPksLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {row.fasilitatorAdmin}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {formatDateTime(row.updatedAt)}
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

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "emerald";
}) {
  const toneMap = {
    primary: "border-primary/15 bg-primary/[0.06] text-primary",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  } as const;
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
