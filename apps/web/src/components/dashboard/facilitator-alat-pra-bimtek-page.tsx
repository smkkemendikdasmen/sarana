"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock4,
  Eye,
  FileBarChart2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  schoolProfileByNpsnRequest,
  workspaceAdminSelectionRequest,
  workspaceAssignmentsRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type SchoolProfileRecord,
  type WorkspaceAssignmentRecord,
  type WorkspaceSchoolProposalData,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import {
  buildSchoolProposalBundleFromWorkspaceData,
  computePraBimtekCompletion,
  type PraBimtekCompletionResult,
} from "@/lib/facilitator-workspace";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type PraBimtekStatus = "belum" | "proses" | "selesai" | "gagal";

interface PraBimtekRow {
  assignmentKey: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  provinsi?: string;
  kabKota?: string;
  updatedAt: string;
  surveyStatus: PraBimtekStatus;
  surveyLabel: string;
  rpkpStatus: PraBimtekStatus;
  rpkpLabel: string;
  rabStatus: PraBimtekStatus;
  rabLabel: string;
  globalStatus: PraBimtekStatus;
  globalLabel: string;
}

const PRA_BIMTEK_SECTION = [
  { key: "survey", label: "Survey Harga Pasar" },
  { key: "rpkp", label: "RPKP · Pilihan Toko" },
  { key: "rab", label: "RAB · Total Per KK" },
];

function normalizeUserName(value: string) {
  return value.trim().toLowerCase().replace(/\s+prisma$/i, "");
}

function pickSchoolNpsn(raw: object | null | undefined): string {
  if (!raw) return "";
  const r = raw as Record<string, unknown>;
  const candidates = [r.npsn, r.NPSN, r["NPSN"], r.nisn, r["Kode NPSN"]];
  for (const v of candidates) {
    if (v === null || v === undefined) continue;
    const s = typeof v === "number" ? v.toFixed(0) : String(v).trim();
    const digits = s.replace(/[^0-9]/g, "");
    if (digits.length >= 6) return digits;
  }
  return "";
}

function normalizeText(v: unknown): string {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  return s || "-";
}

function statusVariant(status: PraBimtekStatus) {
  if (status === "selesai") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "gagal") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "proses") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function FacilitatorAlatPraBimtekPage() {
  const router = useRouter();
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [proposalMap, setProposalMap] = useState<Map<string, WorkspaceSchoolProposalData>>(new Map());
  const [verifikasiMap, setVerifikasiMap] = useState<Map<string, WorkspaceVerifikasiOnlineRecord>>(new Map());
  const [profileMap, setProfileMap] = useState<Map<string, SchoolProfileRecord>>(new Map());
  const debouncedSearch = useDebouncedValue(search, 220);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const token = session?.token;
    const userId = session?.user?.id;
    const userName = session?.user?.fullName;
    if (!hydrated || !token || !userId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadingStatus(true);
      setError("");
      try {
        const normalizedName = normalizeUserName(userName ?? "");
        const raw = await workspaceAssignmentsRequest(token, {
          moduleKey: "verifikasi-online",
          facilitatorEquipmentId: userId,
          facilitatorEquipmentName: normalizedName ? undefined : userName ?? undefined,
        });
        const matched = raw.filter((rec) => {
          if (rec.moduleKey !== "verifikasi-online") return false;
          if (rec.facilitatorEquipmentId === userId) return true;
          if (normalizedName && normalizeUserName(rec.facilitatorEquipmentName ?? "") === normalizedName) return true;
          return false;
        });
        const deduped = Array.from(new Map(matched.map((r) => [r.schoolNpsn, r])).values());
        if (!cancelled) {
          setAssignments(deduped);
          setLoading(false);
        }
        if (deduped.length === 0) {
          if (!cancelled) setLoadingStatus(false);
          return;
        }
        const npsnList = deduped.map((r) => r.schoolNpsn).filter(Boolean);

        void (async () => {
          try {
            const sel = await workspaceAdminSelectionRequest(token, {
              scope: "light",
            });
            const bundles = sel.proposalBundles ?? {};
            const m = new Map<string, WorkspaceSchoolProposalData>();
            for (const [npsn, bundle] of Object.entries(bundles)) {
              if (npsn && bundle) m.set(npsn, bundle);
            }
            if (!cancelled) setProposalMap(m);
          } catch {
            // ignore status preload failure
          }
          try {
            const reviews = await workspaceVerifikasiOnlineReviewsRequest(token);
            const vm = new Map<string, WorkspaceVerifikasiOnlineRecord>();
            for (const rv of reviews) {
              if (rv.schoolNpsn) vm.set(String(rv.schoolNpsn), rv);
            }
            if (!cancelled) setVerifikasiMap(vm);
          } catch {
            // ignore review preload failure
          }
          try {
            const pm = new Map<string, SchoolProfileRecord>();
            const profileChunkSize = 5;
            for (let i = 0; i < npsnList.length; i += profileChunkSize) {
              const chunk = npsnList.slice(i, i + profileChunkSize);
              await Promise.all(
                chunk.map(async (npsn) => {
                  try {
                    const p = await schoolProfileByNpsnRequest(token, npsn);
                    if (p?.npsn) pm.set(p.npsn, p);
                  } catch {
                    // ignore individual profile load
                  }
                }),
              );
              if (cancelled) break;
            }
            if (!cancelled) setProfileMap(pm);
          } catch {
            // ignore profile batch preload failure
          }
          if (!cancelled) setLoadingStatus(false);
        })();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat daftar sekolah binaan.");
        if (!cancelled) {
          setLoading(false);
          setLoadingStatus(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token, session?.user?.id, session?.user?.fullName]);

  const rows = useMemo<PraBimtekRow[]>(() => {
    return assignments.map((rec, idx) => {
      const npsn = rec.schoolNpsn || pickSchoolNpsn(rec as unknown as object);
      const proposalBundle = npsn ? proposalMap.get(npsn) : undefined;
      const rv = npsn ? verifikasiMap.get(npsn) : undefined;
      const prof = npsn ? profileMap.get(npsn) : undefined;

      let surveyStatus: PraBimtekStatus = "belum";
      let rpkpStatus: PraBimtekStatus = "belum";
      let rabStatus: PraBimtekStatus = "belum";

      if (loadingStatus) {
        surveyStatus = "proses";
        rpkpStatus = "proses";
        rabStatus = "proses";
      } else if (proposalBundle) {
        const baselineCodes: string[] | null = prof?.concentrations?.map((c) => c.code) ?? null;
        const bundle = buildSchoolProposalBundleFromWorkspaceData(prof?.schoolId ?? null, proposalBundle);
        const completion: PraBimtekCompletionResult = computePraBimtekCompletion(bundle, baselineCodes);
        surveyStatus = completion.survey;
        rpkpStatus = completion.rpkp;
        rabStatus = completion.rab;
      }

      const order: PraBimtekStatus[] = ["belum", "proses", "gagal", "selesai"];
      const globalIndex = Math.min(order.indexOf(surveyStatus), order.indexOf(rpkpStatus), order.indexOf(rabStatus));
      const globalStatus: PraBimtekStatus = globalIndex >= 0 ? order[globalIndex] : "belum";

      const statusLabel = (st: PraBimtekStatus, section: string) => {
        if (loadingStatus) return "Memuat…";
        if (st === "selesai") return `${section} Selesai`;
        if (st === "proses") return `${section} Di Proses`;
        if (st === "gagal") return `${section} Perlu Revisi`;
        return `Belum Input ${section}`;
      };

      return {
        assignmentKey: rec.key ?? `pb-${idx}`,
        schoolNo: rec.schoolNo ?? idx + 1,
        schoolNpsn: npsn,
        schoolName: normalizeText(rec.schoolName || prof?.schoolName),
        provinsi: prof?.province || undefined,
        kabKota: prof?.city || undefined,
        updatedAt: rec.updatedAt ?? rv?.updatedAt ?? new Date().toISOString(),
        surveyStatus,
        surveyLabel: statusLabel(surveyStatus, "Survey"),
        rpkpStatus,
        rpkpLabel: statusLabel(rpkpStatus, "RPKP"),
        rabStatus,
        rabLabel: statusLabel(rabStatus, "RAB"),
        globalStatus,
        globalLabel:
          globalStatus === "selesai"
            ? "Siap Bimtek"
            : globalStatus === "proses"
              ? "Pra Bimtek Di Proses"
              : globalStatus === "gagal"
                ? "Perlu Revisi Pra Bimtek"
                : "Belum Di Proses",
      };
    });
  }, [assignments, proposalMap, verifikasiMap, profileMap, loadingStatus]);

  const stats = useMemo(() => {
    const total = rows.length;
    const survey = rows.filter((r) => r.surveyStatus === "selesai").length;
    const rpkp = rows.filter((r) => r.rpkpStatus === "selesai").length;
    const rab = rows.filter((r) => r.rabStatus === "selesai").length;
    const selesai = rows.filter((r) => r.globalStatus === "selesai").length;
    return { total, survey, rpkp, rab, selesai };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(debouncedSearch).toLowerCase();
    if (q === "-") return rows;
    return rows.filter((r) => {
      return (
        r.schoolNpsn.includes(q) ||
        normalizeText(r.schoolName).toLowerCase().includes(q) ||
        normalizeText(r.kabKota).toLowerCase().includes(q) ||
        normalizeText(r.provinsi).toLowerCase().includes(q)
      );
    });
  }, [rows, debouncedSearch]);

  if (!hydrated || !session) {
    return (
      <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat session...
      </div>
    );
  }

  if (session.user.role !== "FASILITATOR_ALAT" && session.user.role !== "ADMIN") {
    return (
      <div className="rounded-[24px] border border-danger/15 bg-danger/[0.08] p-6 text-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-danger" />
          <div>
            <p className="font-semibold text-danger">Akses Ditolak</p>
            <p className="mt-1 text-slate-600">
              Halaman Pra Bimtek hanya dapat diakses oleh Fasilitator Alat.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-[28px] border border-indigo-600/15 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-indigo-200 bg-white shadow-sm">
                <ClipboardCheck className="h-7 w-7 text-indigo-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700/80">
                  Alur Tahapan · Setelah Wawancara
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  Pra Bimtek — Survey Harga, RPKP &amp; RAB
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Modul Pra Bimtek untuk memverifikasi 3 tahapan usulan pengadaan per sekolah:
                  <span className="font-semibold text-slate-800"> (1) Survey Harga Pasar, (2) RPKP Pilihan Toko, dan (3) RAB Total Per KK. </span>
                  Data diambil 100% dari input sekolah via API. Pilih sekolah untuk membuka detail.
                </p>
              </div>
            </div>
          </div>

          {loadingStatus ? (
            <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-indigo-200/60 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-800">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Status Pra Bimtek per sekolah sedang dimuat di background. Daftar sekolah sudah dapat dilihat.</span>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total Sekolah</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Survey Selesai</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.survey}<span className="text-sm font-medium text-slate-400 ml-1">/{stats.total}</span></p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">RPKP Selesai</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.rpkp}<span className="text-sm font-medium text-slate-400 ml-1">/{stats.total}</span></p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">RAB Selesai</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.rab}<span className="text-sm font-medium text-slate-400 ml-1">/{stats.total}</span></p>
            </div>
            <div className="rounded-[18px] border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Siap Bimtek</p>
              <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.selesai}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1 md:max-w-xl">
              <label className="text-sm font-semibold text-slate-800">
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4 text-indigo-700" />
                  Cari Sekolah Didampingi
                </span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Cari berdasarkan NPSN, nama sekolah, kab/kota, atau provinsi.
              </p>
              <div className="mt-3 relative">
                <Input
                  type="text"
                  placeholder="Cari NPSN / nama sekolah..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-[14px] border-slate-300 pl-10 pr-4 text-sm shadow-sm focus:ring-indigo-200 focus:border-indigo-500"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PRA_BIMTEK_SECTION.map((s) => (
                <Badge key={s.key} variant="outline" className="border-indigo-200/70 bg-white text-indigo-700 text-[11px]">
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <UsersRound className="h-4 w-4 text-slate-500 shrink-0" />
            <p className="text-sm font-semibold text-slate-800 truncate">
              Daftar Sekolah Didampingi — {filteredRows.length} dari {rows.length}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="shrink-0"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat Ulang
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-[60px]">No</th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-[130px]">NPSN</th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Sekolah</th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-[150px]">Survey Harga</th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-[150px]">RPKP</th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-[150px]">RAB</th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-[170px]">Status Pra Bimtek</th>
                <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider w-[120px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-3" />
                    <p>Memuat daftar sekolah didampingi...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    <AlertCircle className="mx-auto h-6 w-6 text-slate-400 mb-3" />
                    <p className="font-semibold text-slate-700">
                      {rows.length === 0 ? "Belum ada sekolah didampingi" : "Tidak ada sekolah yang cocok dengan pencarian"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={row.assignmentKey}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500 font-medium tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-slate-800 font-semibold">{row.schoolNpsn || "-"}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 leading-5">{row.schoolName}</p>
                      {(row.kabKota || row.provinsi) && (
                        <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[row.kabKota, row.provinsi].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusVariant(row.surveyStatus)}>
                        {row.surveyStatus === "selesai" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {row.surveyStatus === "gagal" && <XCircle className="mr-1 h-3 w-3" />}
                        {row.surveyStatus === "proses" && <Clock4 className="mr-1 h-3 w-3" />}
                        {row.surveyLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusVariant(row.rpkpStatus)}>
                        {row.rpkpStatus === "selesai" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {row.rpkpStatus === "gagal" && <XCircle className="mr-1 h-3 w-3" />}
                        {row.rpkpStatus === "proses" && <Clock4 className="mr-1 h-3 w-3" />}
                        {row.rpkpLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusVariant(row.rabStatus)}>
                        {row.rabStatus === "selesai" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {row.rabStatus === "gagal" && <XCircle className="mr-1 h-3 w-3" />}
                        {row.rabStatus === "proses" && <Clock4 className="mr-1 h-3 w-3" />}
                        {row.rabLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          row.globalStatus === "selesai" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                          row.globalStatus === "proses" && "border-sky-200 bg-sky-50 text-sky-700",
                          row.globalStatus === "gagal" && "border-rose-200 bg-rose-50 text-rose-700",
                          row.globalStatus === "belum" && "border-slate-200 bg-slate-50 text-slate-600",
                        )}
                      >
                        <BadgeCheck className="mr-1 h-3 w-3" />
                        {row.globalLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => router.push(`/fasilitator-alat/pra-bimtek/${row.schoolNpsn}`)}
                        disabled={!row.schoolNpsn}
                        className="inline-flex items-center gap-1 bg-indigo-700 hover:bg-indigo-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Buka
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
