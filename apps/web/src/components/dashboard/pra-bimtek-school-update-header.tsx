"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileBarChart2, Info, RefreshCw, Clock3, School2, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import {
  fetchCachedDetailPraBimtekByNpsn,
} from "@/lib/school-verifikasi-cache";
import {
  schoolProfileByNpsnRequest,
  type SchoolProfileRecord,
  type WorkspaceSchoolProposalData,
} from "@/lib/api";
import {
  buildSchoolProposalBundleFromWorkspaceData,
  computePraBimtekCompletion,
  type PraBimtekCompletionResult,
} from "@/lib/facilitator-workspace";

function formatWIBTimestamp(iso?: string | null): { date: string; time: string; relative: string; isEmpty: boolean } {
  if (!iso) return { date: "", time: "", relative: "Belum ada riwayat update sekolah", isEmpty: true };
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: "", time: "", relative: "Format tanggal tidak valid", isEmpty: true };
    const parts = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).formatToParts(d);
    const date = `${parts.find((p) => p.type === "day")?.value ?? ""} ${parts.find((p) => p.type === "month")?.value ?? ""} ${parts.find((p) => p.type === "year")?.value ?? ""}`;
    const time = `${parts.find((p) => p.type === "hour")?.value ?? ""}:${parts.find((p) => p.type === "minute")?.value ?? ""} WIB`;
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    let relative = "";
    if (mins < 1) relative = "Baru saja diperbarui";
    else if (mins < 60) relative = `${mins} menit lalu`;
    else {
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) relative = `${hrs} jam lalu`;
      else {
        const days = Math.floor(hrs / 24);
        relative = `${days} hari lalu`;
      }
    }
    return { date, time, relative, isEmpty: false };
  } catch {
    return { date: "", time: "", relative: "-", isEmpty: true };
  }
}

export function PraBimtekSchoolUpdateHeader({ npsn }: { npsn: string }) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [proposalBundle, setProposalBundle] = useState<WorkspaceSchoolProposalData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function loadData(force = false) {
    const token = session?.token;
    if (!hydrated || !token) return;
    if (force) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);
    try {
      // ⚡ v4.3 SINKRONISASI: Header & Detail pakai SUMBER DATA YANG SAMA
      // (fetchCachedDetailPraBimtekByNpsn → scope:full schoolNpsn=[npsn])
      // Dahulu: workspaceAdminSelectionRequest(scope:"light") = LOAD SEMUA 132 SEKOLAH (boros!)
      // Sekarang: hanya load NPSN ini → ringan + SELALU SINKRON dengan section detail di bawahnya.
      const [prof, sel] = await Promise.all([
        schoolProfileByNpsnRequest(token, npsn),
        fetchCachedDetailPraBimtekByNpsn(token, npsn, { force: force === true }),
      ]);
      setProfile(prof ?? null);
      setProposalBundle(sel?.proposalBundles?.[npsn] ?? null);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e ?? "");
        if (msg.includes("401") || msg.toLowerCase().includes("token")) {
          setErrorMsg("Sesi login habis. Silakan login ulang untuk melihat data sekolah.");
        } else if (msg.includes("403") || msg.toLowerCase().includes("akses")) {
          setErrorMsg("Role Anda tidak memiliki izin mengakses data sekolah ini. Pastikan login sebagai Fasilitator Alat.");
        } else {
            setErrorMsg("Gagal memuat data. Silakan klik Refresh atau coba lagi nanti.");
          }
        setProfile(null);
        setProposalBundle(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn]);

  // ═══════════════════════════════════════════════════════════════════════
  // ⚡ REALTIME SYNC v4.3: polling + visibility refresh untuk HEADER
  //   - SINKRON dengan section detail di bawahnya (sama sumber cache)
  //   - Refresh cepat: user balik fokus ke tab → data proposal terbaru
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated || !session?.token) return;
    let cancelled = false;
    let timerId: number | null = null;

    async function softRefresh() {
      if (!session?.token) return;
      try {
        const sel = await fetchCachedDetailPraBimtekByNpsn(session.token, npsn, { force: true });
        const next = sel?.proposalBundles?.[npsn] ?? null;
        setProposalBundle((prev) => {
          const a = prev ? JSON.stringify(prev) : "";
          const b = next ? JSON.stringify(next as object) : "";
          if (a === b) return prev;
          return next as WorkspaceSchoolProposalData | null;
        });
      } catch {
        /* ignore silent; user bisa klik manual RefreshCw */
      }
    }

    timerId = window.setInterval(() => {
      if (!cancelled) void softRefresh();
    }, 45_000);

    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled) {
        void softRefresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn]);

  const lastUpdateInfo = useMemo(() => {
    const candidates: string[] = [];
    if (proposalBundle) {
      const any = proposalBundle as unknown as Record<string, unknown>;
      ["updatedAt", "updated_at", "modifiedAt", "savedAt", "lastSavedAt"].forEach((k) => {
        const v = any[k];
        if (typeof v === "string" && v.trim()) candidates.push(v);
      });
      const tables = any.tables ?? any.persistedTables ?? any.draftTables;
      if (tables && typeof tables === "object") {
        Object.values(tables as Record<string, unknown>).forEach((rows) => {
          if (Array.isArray(rows)) {
            rows.forEach((r) => {
              if (r && typeof r === "object") {
                ["updatedAt", "updated_at", "modifiedAt", "createdAt", "created_at"].forEach((k) => {
                  const v = (r as Record<string, unknown>)[k];
                  if (typeof v === "string" && v.trim()) candidates.push(v);
                });
              }
            });
          }
        });
      }
    }
    if (profile) {
      const p = profile as unknown as Record<string, unknown>;
      ["updatedAt", "updated_at", "modifiedAt", "createdAt", "created_at"].forEach((k) => {
        const v = p[k];
        if (typeof v === "string" && v.trim()) candidates.push(v);
      });
    }
    const sorted = candidates
      .map((c) => {
        const t = new Date(c).getTime();
        return Number.isFinite(t) ? t : 0;
      })
      .filter((t) => t > 0)
      .sort((a, b) => b - a);
    if (sorted.length === 0) return formatWIBTimestamp(null);
    return formatWIBTimestamp(new Date(sorted[0]).toISOString());
  }, [profile, proposalBundle]);

  const stats = useMemo(() => {
    const equipments = profile?.concentrations?.length ?? 0;
    let proposalItems = 0;
    let proposalValue = 0;
    let completion: PraBimtekCompletionResult | null = null;
    if (profile?.schoolId && proposalBundle) {
      const bundle = buildSchoolProposalBundleFromWorkspaceData(profile.schoolId, proposalBundle);
      completion = computePraBimtekCompletion(
        bundle,
        profile.concentrations?.map((c) => c.code) ?? null,
      );
      proposalItems = completion.surveyItemCount;
      proposalValue = completion.rabTotal;
    }
    return {
      equipments,
      proposalItems,
      proposalValue,
      hasData: !!(profile || proposalBundle),
      completion,
    };
  }, [profile, proposalBundle]);

  return (
    <Card className="overflow-hidden rounded-[24px] border border-indigo-300/60 bg-gradient-to-br from-indigo-50/80 via-white to-white shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-indigo-200 bg-white shadow-sm">
            <ClipboardCheck className="h-7 w-7 text-indigo-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700/80">
              Update Terakhir per Sekolah · Pra Bimtek
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 break-words">
              Detail Pra Bimtek · NPSN{" "}
              <span className="font-mono tracking-tight">{npsn}</span>
            </h1>
            {loading ? (
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Memuat identitas sekolah &amp; riwayat update terakhir...
              </p>
            ) : errorMsg ? (
              <p className="mt-2 text-sm leading-6 font-medium text-rose-600">
                {errorMsg}
              </p>
            ) : !profile ? (
              <p className="mt-2 text-sm leading-6 text-amber-700/90">
                Data sekolah belum tersedia untuk NPSN <span className="font-mono">{npsn}</span>.
                Klik <strong>Refresh</strong> atau pastikan sekolah ini sudah didaftarkan.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <School2 className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-slate-800">{profile.schoolName ?? "-"}</span>
                </span>
                {profile.concentrations?.length ? (
                  <span className="inline-flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-indigo-600" />
                    {profile.concentrations.length} Konsentrasi Keahlian
                  </span>
                ) : null}
                {(profile.province || profile.city) && (
                  <span className="text-slate-500">
                    {[profile.city, profile.province].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 shrink-0">
          <Badge className="border border-indigo-200 bg-white text-indigo-700 text-xs">
            <FileBarChart2 className="mr-1 h-3.5 w-3.5" />
            1 · Survey Harga Pasar
          </Badge>
          <Badge className="border border-indigo-200 bg-white text-indigo-700 text-xs">
            <FileBarChart2 className="mr-1 h-3.5 w-3.5" />
            2 · RPKP
          </Badge>
          <Badge className="border border-indigo-200 bg-white text-indigo-700 text-xs">
            <FileBarChart2 className="mr-1 h-3.5 w-3.5" />
            3 · RAB
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="ml-1"
          >
            {refreshing ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-t border-indigo-100 bg-indigo-50/50 px-5 py-4 md:px-6 md:py-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-start gap-3 rounded-[18px] border border-emerald-200 bg-white px-4 py-3 shadow-sm">
            <div className="rounded-xl bg-emerald-50 p-2 mt-0.5">
              <Clock3 className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/80">
                Update Terakhir Data Sekolah
              </p>
              {loading ? (
                <p className="mt-1 text-sm text-slate-500">Menghitung timestamp...</p>
              ) : errorMsg ? (
                <p className="mt-1 text-sm font-medium text-rose-600">
                  Data tidak dapat dimuat
                </p>
              ) : lastUpdateInfo.isEmpty ? (
                <>
                  <p className="mt-1 text-base font-semibold text-slate-700">
                    Belum ada riwayat update
                  </p>
                  <p className="text-xs text-slate-500">
                    Sekolah ini belum menyimpan data usulan (RPKP/RAB) sama sekali.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {lastUpdateInfo.date} · {lastUpdateInfo.time}
                  </p>
                  <p className="text-xs text-slate-500">{lastUpdateInfo.relative}</p>
                </>
              )}
            </div>
          </div>
          {!loading && (
            <>
              <div className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="rounded-xl bg-sky-50 p-2 mt-0.5">
                  <School2 className="h-5 w-5 text-sky-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700/80">
                    Konsentrasi &amp; Item Usulan
                  </p>
                  {errorMsg ? (
                    <>
                      <p className="mt-1 text-base font-semibold text-rose-700/90">
                        Data tidak tersedia
                      </p>
                      <p className="text-xs text-rose-600/80">
                        Login ulang atau ganti role Fasilitator Alat.
                      </p>
                    </>
                  ) : stats.hasData ? (
                    <>
                      <p className="mt-1 text-base font-semibold text-slate-950">
                        {stats.equipments} KK · {stats.proposalItems.toLocaleString("id-ID")} item
                      </p>
                      <p className="text-xs text-slate-500">
                        Total nilai RAB:{" "}
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }).format(stats.proposalValue || 0)}
                      </p>
                      {stats.completion && (
                        <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-600">
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-0.5 mr-1.5",
                            stats.completion.survey === "selesai"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : stats.completion.survey === "proses"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-slate-50 text-slate-500",
                          )}>
                            Survey: {stats.completion.survey === "selesai" ? "OK" : stats.completion.survey === "proses" ? "Proses" : "Belum"}
                          </span>
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-0.5 mr-1.5",
                            stats.completion.rpkp === "selesai"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : stats.completion.rpkp === "proses"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-slate-50 text-slate-500",
                          )}>
                            RPKP: {stats.completion.rpkp === "selesai" ? "OK" : stats.completion.rpkp === "proses" ? "Proses" : "Belum"}
                          </span>
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-0.5",
                            stats.completion.rab === "selesai"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : stats.completion.rab === "proses"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-slate-50 text-slate-500",
                          )}>
                            RAB: {stats.completion.rab === "selesai" ? "OK" : stats.completion.rab === "proses" ? "Proses" : "Belum"}
                          </span>
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-base font-semibold text-slate-700">
                        Belum ada usulan
                      </p>
                      <p className="text-xs text-slate-500">
                        Sekolah ini belum menginput KK/item RPKP/RAB yang di-SAVE.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-start gap-3 min-h-[84px]">
          <Info className={cn("h-5 w-5 shrink-0 mt-0.5", profile ? "text-indigo-700" : "text-indigo-500")} />
          <p className="text-[13px] leading-relaxed break-words text-indigo-900/85">
            <strong className="font-semibold">Catatan Pra Bimtek:</strong> Angka RAB / RPKP di
            halaman ini diambil <strong>dari data yang sudah di-SAVE</strong> oleh pihak sekolah.
            Jika sekolah baru mengedit draft (belum klik Simpan), perubahan akan tampil setelah
            sekolah menekan tombol <em>Simpan</em> dan Anda menekan tombol Refresh di atas.
          </p>
        </div>
      </div>
    </Card>
  );
}
