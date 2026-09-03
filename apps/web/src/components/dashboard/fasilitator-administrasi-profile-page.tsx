"use client";

import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock4,
  GraduationCap,
  Loader2,
  Save,
  UserCog,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  workspaceAssignmentsRequest,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type ToastState = { kind: "success" | "error"; message: string } | null;

type TahapKey = "verifikasi" | "wawancara" | "praBimtek" | "bimtek";

const BALAI_OPTIONS: string[] = [
  "BBPPMPV BOE Malang",
  "BBPPMPV BBL Medan",
  "BBPPMPV BMTI Bandung",
  "BBPPMPV Bisnis dan Pariwisata",
  "BBPPMPV Pertanian Cianjur",
  "BBPPMPV Seni dan Budaya Yogyakarta",
  "BPPMPV KPTK Gowa",
];

const TAHAPAN_CONFIG: Record<
  TahapKey,
  {
    label: string;
    subtitle: string;
    moduleKey: WorkspaceAssignmentRecord["moduleKey"];
    tone: "primary" | "sky" | "emerald" | "violet";
  }
> = {
  verifikasi: {
    label: "Verifikasi",
    subtitle: "Tahap 1",
    moduleKey: "verifikasi-online",
    tone: "primary",
  },
  wawancara: {
    label: "Wawancara",
    subtitle: "Tahap 2",
    moduleKey: "wawancara",
    tone: "sky",
  },
  praBimtek: {
    label: "Pra Bimtek",
    subtitle: "Tahap 3",
    moduleKey: "pra-bimtek",
    tone: "emerald",
  },
  bimtek: {
    label: "Bimtek",
    subtitle: "Tahap 4",
    moduleKey: "bimbingan-teknis",
    tone: "violet",
  },
};

const TONE_MAP = {
  primary: {
    border: "border-primary/20",
    bg: "bg-primary/[0.04]",
    headerBg: "bg-primary/10",
    headerText: "text-primary",
    badge:
      "border-primary/20 bg-primary/10 text-primary ring-1 ring-inset ring-primary/10",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
  },
  sky: {
    border: "border-sky-200",
    bg: "bg-sky-50/60",
    headerBg: "bg-sky-100/60",
    headerText: "text-sky-700",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/60",
    iconBg: "bg-sky-100",
    iconText: "text-sky-700",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/60",
    headerBg: "bg-emerald-100/60",
    headerText: "text-emerald-700",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/60",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
  },
  violet: {
    border: "border-violet-200",
    bg: "bg-violet-50/60",
    headerBg: "bg-violet-100/60",
    headerText: "text-violet-700",
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/60",
    iconBg: "bg-violet-100",
    iconText: "text-violet-700",
  },
} as const;

const TAHAPAN_ICON = {
  verifikasi: ClipboardCheck,
  wawancara: CalendarCheck,
  praBimtek: GraduationCap,
  bimtek: GraduationCap,
} as const;

function last6(value: string | null | undefined) {
  if (!value) return "-";
  const clean = value.replace(/\D/g, "");
  return clean.length >= 6 ? clean.slice(-6) : value.slice(-Math.min(6, value.length));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function jadwalFor(row: WorkspaceAssignmentRecord): string | null {
  switch (row.moduleKey) {
    case "wawancara":
      return row.interviewScheduledDate ?? null;
    case "pra-bimtek":
      return row.praBimtekScheduledDate ?? null;
    case "bimbingan-teknis":
      return row.bimtekScheduledDate ?? null;
    default:
      return null;
  }
}

function TahapIcon({ tahap, className }: { tahap: TahapKey; className?: string }) {
  const Icon = TAHAPAN_ICON[tahap];
  return <Icon className={className} />;
}

function TahapanSection({
  tahap,
  rows,
}: {
  tahap: TahapKey;
  rows: WorkspaceAssignmentRecord[];
}) {
  const cfg = TAHAPAN_CONFIG[tahap];
  const tone = TONE_MAP[cfg.tone];
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.schoolNo - b.schoolNo),
    [rows],
  );

  return (
    <Card
      className={cn(
        "rounded-[24px] border-2 border-dashed",
        tone.border,
        tone.bg,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 p-4 pb-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              tone.iconBg,
            )}
          >
            <TahapIcon tahap={tahap} className={cn("h-5 w-5", tone.iconText)} />
          </div>
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.14em]",
                tone.headerText,
              )}
            >
              {cfg.subtitle}
            </p>
            <CardTitle className="mt-0.5 text-lg text-slate-950">
              {cfg.label}
            </CardTitle>
          </div>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px]", tone.badge)}>
          {sorted.length} sekolah
        </Badge>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {sorted.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            <Clock4 className="h-4 w-4" />
            Belum ada sekolah yang ditugaskan pada tahap ini.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-3 py-2 text-left font-medium">No</th>
                    <th className="w-32 px-3 py-2 text-left font-medium">NPSN</th>
                    <th className="px-3 py-2 text-left font-medium">Sekolah</th>
                    <th className="w-36 px-3 py-2 text-left font-medium">Jadwal</th>
                    <th className="w-36 px-3 py-2 text-left font-medium">Terakhir Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((row, idx) => (
                    <tr key={row.key} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono font-medium text-slate-700">
                        {row.schoolNpsn}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 flex-none text-slate-400" />
                          <span className="truncate">{row.schoolName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {jadwalFor(row) ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                            <CalendarCheck className="h-3 w-3" />
                            {formatDate(jadwalFor(row))}
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum dijadwalkan</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                        {formatDate(row.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FacilitatorAdministrasiProfilePage() {
  const { hydrate, hydrated, session, setSession } = useAuthStore();
  const [toast, setToast] = useState<ToastState>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [balai, setBalai] = useState<string>("");
  const [savingBalai, setSavingBalai] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (session?.user) {
      setBalai((session.user as { balai?: string | null }).balai ?? "");
    }
  }, [session?.user]);

  const grouped = useMemo(() => {
    const buckets: Record<TahapKey, WorkspaceAssignmentRecord[]> = {
      verifikasi: [],
      wawancara: [],
      praBimtek: [],
      bimtek: [],
    };
    for (const row of assignments) {
      if (row.moduleKey === TAHAPAN_CONFIG.verifikasi.moduleKey) {
        buckets.verifikasi.push(row);
      } else if (row.moduleKey === TAHAPAN_CONFIG.wawancara.moduleKey) {
        buckets.wawancara.push(row);
      } else if (row.moduleKey === TAHAPAN_CONFIG.praBimtek.moduleKey) {
        buckets.praBimtek.push(row);
      } else if (row.moduleKey === TAHAPAN_CONFIG.bimtek.moduleKey) {
        buckets.bimtek.push(row);
      }
    }
    return buckets;
  }, [assignments]);

  const summary = useMemo(() => {
    const uniqueSchools = new Set(assignments.map((a) => a.schoolNpsn));
    return {
      totalAssignments: assignments.length,
      uniqueSchools: uniqueSchools.size,
      byTahap: {
        verifikasi: grouped.verifikasi.length,
        wawancara: grouped.wawancara.length,
        praBimtek: grouped.praBimtek.length,
        bimtek: grouped.bimtek.length,
      },
    };
  }, [assignments, grouped]);

  async function handleSaveBalai() {
    if (!session) return;
    setSavingBalai(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      const nextSession = {
        ...session,
        user: {
          ...session.user,
          balai: balai.trim() || null,
        },
      };
      setSession(nextSession);
      pushToast("success", "✓ Asal Balai berhasil disimpan");
    } catch {
      pushToast("error", "Gagal menyimpan Asal Balai");
    } finally {
      setSavingBalai(false);
    }
  }

  function pushToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    if (!hydrated || !session?.user) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    async function load() {
      try {
        const rows = await workspaceAssignmentsRequest(session!.token, {
          facilitatorAdministrationId: session!.user.id,
        });
        if (cancelled) return;
        setAssignments(rows);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data penugasan");
        setToast({
          kind: "error",
          message: "Gagal memuat daftar sekolah dampingan",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token, session?.user]);

  if (!hydrated || !session) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl text-slate-950">Fasilitator Administrasi</CardTitle>
                <p className="mt-2 text-sm text-slate-600">
                  Log sekolah dampingan dan seluruh penugasan pada tahapan Verifikasi, Wawancara, Pra Bimtek, dan Bimtek.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset ring-primary/10 border-primary/20 bg-primary/5 text-primary">
                {summary.uniqueSchools} sekolah dampingan
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset ring-slate-200 border-slate-200 bg-white text-slate-600">
                {summary.totalAssignments} total penugasan
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 rounded-[20px] border border-dashed border-slate-200 bg-slate-50/50 p-4 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                <UserCog className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Nama</p>
                <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">No Fasilitator</p>
                <p className="font-mono text-sm font-semibold text-slate-900">{last6(user.id)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Instansi</p>
                <p className="truncate text-sm font-semibold text-slate-900">{user.organization ?? "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Wilayah</p>
                <p className="truncate text-sm font-semibold text-slate-900">{user.region ?? "-"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-dashed border-primary/20 bg-primary/[0.04] p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[260px] flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                  Asal Balai
                </p>
                <label className="sr-only" htmlFor="asal-balai">
                  Asal Balai
                </label>
                <select
                  id="asal-balai"
                  value={balai}
                  onChange={(e) => setBalai(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Pilih Asal Balai</option>
                  {BALAI_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={handleSaveBalai}
                disabled={savingBalai}
                className="h-10 px-5"
              >
                {savingBalai ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Simpan Balai
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex h-44 items-center justify-center gap-2 rounded-[20px] border border-dashed border-slate-200 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat daftar sekolah dampingan...
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
              <XCircle className="h-5 w-5 flex-none" />
              <div>
                <p className="font-semibold">Gagal memuat data sekolah dampingan</p>
                <p className="mt-0.5 text-[12px] text-rose-600">{loadError}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <TahapanSection tahap="verifikasi" rows={grouped.verifikasi} />
              <TahapanSection tahap="wawancara" rows={grouped.wawancara} />
              <TahapanSection tahap="praBimtek" rows={grouped.praBimtek} />
              <TahapanSection tahap="bimtek" rows={grouped.bimtek} />
            </div>
          )}
        </CardContent>
      </Card>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${
              toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5" />
            )}
            <div className="text-sm font-medium">{toast.message}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
