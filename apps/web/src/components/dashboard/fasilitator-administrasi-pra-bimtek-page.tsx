"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
  schoolAdministrativeDocumentsByNpsnRequest,
  schoolProfileByNpsnRequest,
  upsertWorkspaceAssignmentsRequest,
  workspaceAssignmentsRequest,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileRecord,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { cn, formatDateTime } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Clock4,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { fetchCachedVerifikasiReviews } from "@/lib/school-verifikasi-cache";

type ReviewItemStatus = "approved" | "pending" | "rejected" | null;

function reviewStatusVariant(status: ReviewItemStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function reviewStatusLabel(status: ReviewItemStatus) {
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  if (status === "pending") return "Pending";
  return "Belum di Proses";
}

function formatDateId(value: string | null) {
  if (!value) return null;
  try {
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

function formatTimeId(value: string | null) {
  if (!value) return null;
  try {
    const parts = value.split(":");
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return value;
  } catch {
    return value;
  }
}

function normalizeUserName(value: string) {
  return value.trim().toLowerCase().replace(/\s+prisma$/i, "");
}

function seedPraBimtekAssignmentForUserId(userId: string, fullName: string): WorkspaceAssignmentRecord {
  return {
    key: `seed-pra-bimtek-admin-${userId}-${Date.now()}`,
    moduleKey: "pra-bimtek",
    moduleLabel: "Pra-Bimtek",
    sourceTab: "abt",
    sourceLabel: "data sekolah penerima bantuan ABT",
    schoolNo: 1,
    schoolNpsn: "10110273",
    schoolName: "SMK NEGERI 1 ARONGAN LAMBALEK",
    facilitatorAdministrationId: userId,
    facilitatorAdministrationName: fullName,
    facilitatorEquipmentId: "",
    facilitatorEquipmentName: "Fasilitator Alat Pendamping",
    interviewScheduledDate: null,
    interviewScheduledTime: null,
    interviewMeetingLink: null,
    updatedAt: new Date().toISOString(),
  };
}

type PraBimtekRow = {
  assignment: WorkspaceAssignmentRecord;
  profile: SchoolProfileRecord | null;
  documents: SchoolAdministrativeDocumentRecord[];
  uploaded: number;
  docTotal: number;
  progressPct: number;
};

async function bulkN<T>(
  list: string[],
  worker: (npsn: string) => Promise<T>,
): Promise<T[]> {
  const out: T[] = new Array(list.length);
  if (list.length === 0) return out;
  const CONCURRENCY = Math.min(30, Math.max(6, list.length > 100 ? 20 : 12));
  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < list.length) {
      const idx = cursor++;
      const npsn = list[idx];
      try {
        out[idx] = await worker(npsn);
      } catch {
        // ignore
      }
    }
  });
  await Promise.all(workers);
  return out;
}

export function FacilitatorAdministrasiPraBimtekPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [enriched, setEnriched] = useState<PraBimtekRow[]>([]);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [verifikasiReviews, setVerifikasiReviews] = useState<Record<string, { approvedAdmin: boolean | null }>>({});
  const [interviewAssignments, setInterviewAssignments] = useState<Record<string, WorkspaceAssignmentRecord>>({});

  const facilitatorId = session?.user.id ?? "";
  const facilitatorName = session?.user.fullName ?? "";

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4000);
  }

  async function loadAll(showRefreshState = false) {
    if (!hydrated || !session?.token) {
      setLoading(false);
      return;
    }
    if (showRefreshState) setRefreshing(true);
    setLoading(true);
    setLoadError("");

    const token = session.token;
    const normalizedName = normalizeUserName(facilitatorName);

    try {
      const records = await workspaceAssignmentsRequest(token, {
        moduleKey: "pra-bimtek",
        facilitatorAdministrationId: facilitatorId || undefined,
      });

      let matched = records.filter((record) => {
        if (record.moduleKey !== "pra-bimtek") return false;
        if (facilitatorId && record.facilitatorAdministrationId === facilitatorId) return true;
        if (normalizedName && normalizeUserName(record.facilitatorAdministrationName) === normalizedName) return true;
        return false;
      });

      if (matched.length === 0) {
        const seed = seedPraBimtekAssignmentForUserId(session.user.id, session.user.fullName);
        try {
          await upsertWorkspaceAssignmentsRequest(token, [seed]);
        } catch {
          // ignore DB save error, fallback local
        }
        matched = [seed];
      }

      matched = [...matched].sort((a, b) => a.schoolNo - b.schoolNo);
      setAssignments(matched);

      // Enrich: load profile + documents per NPSN (dibutuhkan progress % adm + search)
      const npsnList = matched.map((m) => String(m.schoolNpsn).trim()).filter(Boolean);
      const profiles = await bulkN(npsnList, (npsn) => schoolProfileByNpsnRequest(token, npsn).catch(() => null as SchoolProfileRecord | null));
      const docsRaw = await bulkN(npsnList, (npsn) =>
        schoolAdministrativeDocumentsByNpsnRequest(token, npsn)
          .then((arr) => {
            const ff = arr.filter((d) => ADMINISTRATIVE_DOCUMENT_UMUM_CODES.includes(d.code));
            return ff.length ? ff : arr.slice(0, 13);
          })
          .catch(() => [] as SchoolAdministrativeDocumentRecord[]),
      );

      const enrichedRows: PraBimtekRow[] = matched.map((ass, i) => {
        const profile = profiles[i] ?? null;
        const documents = docsRaw[i] ?? [];
        const docTotal = Math.max(documents.length, ADMINISTRATIVE_DOCUMENT_UMUM_CODES.length);
        const uploaded = documents.filter((d) => d.uploaded).length;
        const progressPct = docTotal ? Math.round((uploaded / docTotal) * 100) : 0;
        return { assignment: ass, profile, documents, uploaded, docTotal, progressPct };
      });
      setEnriched(enrichedRows);

      try {
        const reviewsRaw = await fetchCachedVerifikasiReviews(token, {}, { force: showRefreshState });
        const outReviews: Record<string, { approvedAdmin: boolean | null }> = {};
        for (const r of reviewsRaw) {
          if (r?.schoolNpsn) outReviews[String(r.schoolNpsn).trim()] = { approvedAdmin: r.approvedAdmin ?? null };
        }
        setVerifikasiReviews(outReviews);
      } catch {
        setVerifikasiReviews({});
      }

      try {
        const interviewRecords = await workspaceAssignmentsRequest(token, {
          moduleKey: "wawancara",
          facilitatorAdministrationId: facilitatorId || undefined,
        }).catch(() => [] as WorkspaceAssignmentRecord[]);
        const outByNpsn: Record<string, WorkspaceAssignmentRecord> = {};
        for (const r of interviewRecords) {
          const key = String(r.schoolNpsn).trim();
          if (!key) continue;
          if (!outByNpsn[key] || Date.parse(r.updatedAt) > Date.parse(outByNpsn[key]?.updatedAt ?? "")) {
            outByNpsn[key] = r;
          }
        }
        setInterviewAssignments(outByNpsn);
      } catch {
        setInterviewAssignments({});
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal memuat daftar sekolah Pra-Bimtek.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, facilitatorId, facilitatorName]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return enriched;
    return enriched.filter((row) => {
      const profileHay = row.profile
        ? [
            row.profile.schoolName,
            row.profile.npsn,
            row.profile.province,
            row.profile.city,
            row.profile.principalName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
        : "";
      const assHay = `${row.assignment.schoolNpsn} ${row.assignment.schoolName}`.toLowerCase();
      return profileHay.includes(normalizedSearch) || assHay.includes(normalizedSearch);
    });
  }, [enriched, normalizedSearch]);

  const stats = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let totalDoc = 0;
    let totalUploaded = 0;
    for (const r of enriched) {
      if (r.progressPct >= 80) complete += 1;
      else incomplete += 1;
      totalDoc += r.docTotal;
      totalUploaded += r.uploaded;
    }
    const avgProgress = totalDoc ? Math.round((totalUploaded / totalDoc) * 100) : 0;
    return { total: enriched.length, complete, incomplete, avgProgress };
  }, [enriched]);

  return (
    <div className="space-y-6">
      {/* Header Persis Wawancara */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border border-primary/20 bg-primary/[0.08] text-primary"
              variant="outline"
            >
              <Building2 className="mr-2 h-3.5 w-3.5" />
              {facilitatorName || "Fasilitator Administrasi"}
            </Badge>
            <span className="text-xs text-slate-500">
              {session?.user.organization ?? "• Organisasi belum diatur"}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Pra-Bimtek</h1>
            <p className="mt-1 text-sm text-slate-600">
              Pastikan dokumen administrasi sekolah sudah lengkap, lalu verifikasi Survey Harga, RPKP, RAB, RPD, dan PKS siap cetak — klik Lihat Detail pada baris sekolah.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadAll(true)}
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

      {/* Stat Card Persis Wawancara (3 item) */}
      <section className="flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="text-slate-500">Total Sekolah</span>
          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
            {stats.total}
          </Badge>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Siap Cetak <span className="font-semibold">{stats.complete}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <XCircle className="h-4 w-4" />
          Kurang Lengkap <span className="font-semibold">{stats.incomplete}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-primary">
          Rata-rata <span className="font-semibold tabular-nums">{stats.avgProgress}%</span>
        </div>
      </section>

      {/* Table Section Persis Wawancara */}
      <section className="panel rounded-[28px] p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama sekolah / NPSN..."
              className="h-11 pl-9"
            />
          </div>
          <p className="text-xs text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{filteredRows.length}</span> dari{" "}
            <span className="font-semibold text-slate-800">{enriched.length}</span> sekolah
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Memuat daftar sekolah...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {loadError}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-sm text-slate-500">
            Tidak ada sekolah yang terdaftar dalam daftar Pra-Bimtek anda saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 w-16">No</th>
                  <th className="px-4 py-3 w-36">NPSN</th>
                  <th className="px-4 py-3">Sekolah</th>
                  <th className="px-4 py-3 w-44">Verifikasi</th>
                  <th className="px-4 py-3 w-44">Wawancara</th>
                  <th className="px-4 py-3 w-44">Pra Bimtek</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const npsn = String(row.assignment.schoolNpsn).trim();
                  const schoolName = row.profile?.schoolName || row.assignment.schoolName || "—";
                  const pct = row.progressPct;
                  const accent =
                    pct >= 80 ? "emerald" : pct >= 40 ? "primary" : pct > 0 ? "amber" : "rose";
                  const review = verifikasiReviews[npsn];
                  const vApproved = review?.approvedAdmin ?? null;
                  let vBadge: ReviewItemStatus = "pending";
                  if (vApproved === true) vBadge = "approved";
                  else if (vApproved === false) vBadge = "rejected";
                  const iv = interviewAssignments[npsn];
                  const ivDate = iv ? formatDateId(iv.interviewScheduledDate) : null;
                  const ivTime = iv ? formatTimeId(iv.interviewScheduledTime) : null;
                  const ivScheduled = Boolean(ivDate && ivTime);
                  const praDate = formatDateId(row.assignment.praBimtekScheduledDate ?? null);
                  const praTime = formatTimeId(row.assignment.praBimtekScheduledTime ?? null);
                  const praScheduled = Boolean(praDate && praTime);

                  return (
                    <tr
                      key={row.assignment.key}
                      className={cn(
                        "transition border-b border-slate-100 last:border-b-0",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                        "hover:bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-4 text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs font-bold text-slate-950">{npsn || "—"}</span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        <div className="flex flex-col gap-0.5">
                          <span className="leading-snug">{schoolName}</span>
                          {row.profile?.city || row.profile?.province ? (
                            <span className="text-xs font-normal text-slate-500">
                              {row.profile.city ? `Kota/Kab. ${row.profile.city}` : null}
                              {row.profile.city && row.profile.province ? " · " : null}
                              {row.profile.province || null}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          className={cn("border", reviewStatusVariant(vBadge))}
                          variant="outline"
                        >
                          {vBadge === "approved" && <CheckCircle2 className="mr-1.5 h-3 w-3" />}
                          {vBadge === "rejected" && <XCircle className="mr-1.5 h-3 w-3" />}
                          {vBadge === "pending" && <Clock4 className="mr-1.5 h-3 w-3" />}
                          {reviewStatusLabel(vBadge)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {ivScheduled ? (
                          <Badge
                            className="w-fit border border-indigo-200 bg-indigo-50 text-indigo-700"
                            variant="outline"
                          >
                            <CalendarDays className="mr-1.5 h-3 w-3" />
                            {ivDate} · {ivTime}
                          </Badge>
                        ) : (
                          <Badge
                            className="w-fit border border-dashed border-slate-300 bg-white text-slate-500"
                            variant="outline"
                          >
                            Belum dijadwalkan
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {praScheduled ? (
                          <Badge
                            className="w-fit border border-sky-200 bg-sky-50 text-sky-700"
                            variant="outline"
                          >
                            <CalendarDays className="mr-1.5 h-3 w-3" />
                            {praDate} · {praTime}
                          </Badge>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border font-semibold text-[11px]",
                                  accent === "emerald" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                                  accent === "primary" && "border-primary/20 bg-primary/[0.06] text-primary",
                                  accent === "amber" && "border-amber-200 bg-amber-50 text-amber-800",
                                  accent === "rose" && "border-rose-200 bg-rose-50 text-rose-800",
                                )}
                              >
                                {row.uploaded} / {row.docTotal} berkas
                              </Badge>
                              <span className="text-[11px] font-bold tabular-nums text-slate-700">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-100">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  accent === "emerald" && "bg-emerald-500",
                                  accent === "primary" && "bg-primary",
                                  accent === "amber" && "bg-amber-500",
                                  accent === "rose" && "bg-rose-500",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="pt-1">
                              <Button
                                type="button"
                                size="sm"
                                asChild
                                className="gap-1.5 bg-primary text-white hover:bg-primary/90"
                              >
                                <Link
                                  href={`/fasilitator-administrasi/pra-bimtek/${encodeURIComponent(npsn)}`}
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                  Detail
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
          <span>
            Data penugasan diambil dari <b className="text-slate-700">Assignment Pra-Bimtek</b> (sama sumber dengan menu Wawancara) — bisa diedit oleh Admin sesuai kebutuhan. · {formatDateTime(new Date())}
          </span>
          {loadError ? (
            <Badge className="border-rose-200 bg-rose-50 text-rose-700" variant="outline">{loadError}</Badge>
          ) : (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
              Sumber: Workspace Assignment DB
            </Badge>
          )}
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[80]">
          <div
            className={cn(
              "rounded-[16px] border px-4 py-3 shadow-xl text-sm font-semibold",
              toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
