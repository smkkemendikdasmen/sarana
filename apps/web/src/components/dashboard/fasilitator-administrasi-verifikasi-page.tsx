"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock4,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  upsertWorkspaceAssignmentsRequest,
  workspaceAssignmentsRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type WorkspaceAssignmentRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type ReviewItemStatus = "approved" | "pending" | "rejected" | null;

interface VerifikasiSchoolBundle {
  assignmentKey: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  assignments: WorkspaceAssignmentRecord[];
}

function normalizeUserName(value: string) {
  return value.trim().toLowerCase().replace(/\s+prisma$/i, "");
}

function buildSchoolBundles(records: WorkspaceAssignmentRecord[]): VerifikasiSchoolBundle[] {
  const byNpsn = new Map<string, VerifikasiSchoolBundle>();

  for (const record of records) {
    const current = byNpsn.get(record.schoolNpsn);
    if (!current) {
      byNpsn.set(record.schoolNpsn, {
        assignmentKey: record.key,
        schoolNo: record.schoolNo,
        schoolNpsn: record.schoolNpsn,
        schoolName: record.schoolName,
        assignments: [record],
      });
      continue;
    }
    current.assignments.push(record);
    if (Date.parse(record.updatedAt) > Date.parse(current.assignments[0]?.updatedAt ?? "")) {
      current.assignmentKey = record.key;
    }
  }

  return Array.from(byNpsn.values()).sort((left, right) => left.schoolNo - right.schoolNo);
}

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

function tryParseCatatanPreview(input: string | null | undefined) {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as Partial<{
      globalNote?: string;
      dataSekolah?: { note?: string };
      dokumenAdministrasi?: { note?: string };
      documents?: Record<string, { note?: string }>;
      concentrations?: Record<string, { note?: string }>;
    }>;
    return (
      parsed.globalNote?.trim() ||
      parsed.dataSekolah?.note?.trim() ||
      parsed.dokumenAdministrasi?.note?.trim() ||
      Object.values(parsed.documents ?? {})
        .find((d) => d?.note?.trim())
        ?.note?.trim() ||
      Object.values(parsed.concentrations ?? {})
        .find((c) => c?.note?.trim())
        ?.note?.trim() ||
      ""
    );
  } catch {
    return trimmed;
  }
}

export function FacilitatorAdministrasiVerifikasiOnlinePage() {
  const router = useRouter();
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [schoolBundles, setSchoolBundles] = useState<VerifikasiSchoolBundle[]>([]);
  const [verifikasiReviews, setVerifikasiReviews] = useState<Record<string, WorkspaceVerifikasiOnlineRecord>>({});
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const facilitatorId = session?.user.id ?? "";
  const facilitatorName = session?.user.fullName ?? "";

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
      const [records, reviewRecords] = await Promise.all([
        workspaceAssignmentsRequest(token, {
          moduleKey: "verifikasi-online",
          facilitatorAdministrationId: facilitatorId || undefined,
        }),
        workspaceVerifikasiOnlineReviewsRequest(token),
      ]);
      const matchedRecords = records.filter((record) => {
        if (record.moduleKey !== "verifikasi-online") return false;
        if (facilitatorId && record.facilitatorAdministrationId === facilitatorId) return true;
        if (normalizedName && normalizeUserName(record.facilitatorAdministrationName) === normalizedName) return true;
        return false;
      });

      const reviewMap: Record<string, WorkspaceVerifikasiOnlineRecord> = {};
      for (const review of reviewRecords) {
        reviewMap[review.schoolNpsn] = review;
      }
      setVerifikasiReviews(reviewMap);

      if (matchedRecords.length === 0) {
        const seededRecord: WorkspaceAssignmentRecord = {
          key: `seed-verifikasi-online-admin-${session.user.id}-${Date.now()}`,
          moduleKey: "verifikasi-online",
          moduleLabel: "Verifikasi Online Administrasi",
          sourceTab: "abt",
          sourceLabel: "data sekolah penerima bantuan ABT",
          schoolNo: 1,
          schoolNpsn: "10110273",
          schoolName: "SMK NEGERI 1 ARONGAN LAMBALEK",
          facilitatorAdministrationId: session.user.id,
          facilitatorAdministrationName: session.user.fullName,
          facilitatorEquipmentId: "",
          facilitatorEquipmentName: "Fasilitator Alat Pendamping",
          interviewScheduledDate: null,
          interviewScheduledTime: null,
          interviewMeetingLink: null,
          updatedAt: new Date().toISOString(),
        };

        try {
          await upsertWorkspaceAssignmentsRequest(token, [seededRecord]);
        } catch {
          // ignore save error, fallback to local in-memory seed
        }
        setSchoolBundles(buildSchoolBundles([seededRecord]));
      } else {
        setSchoolBundles(buildSchoolBundles(matchedRecords));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal memuat data sekolah pendampingan.");
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
  const filteredBundles = useMemo(() => {
    if (!normalizedSearch) return schoolBundles;
    return schoolBundles.filter(
      (row) =>
        row.schoolName.toLowerCase().includes(normalizedSearch) ||
        row.schoolNpsn.includes(normalizedSearch),
    );
  }, [schoolBundles, normalizedSearch]);

  const stats = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    for (const row of schoolBundles) {
      const review = verifikasiReviews[row.schoolNpsn];
      if (review?.approvedAdmin === true) approved += 1;
      else if (review?.approvedAdmin === false) rejected += 1;
      else pending += 1;
    }
    return { total: schoolBundles.length, approved, rejected, pending };
  }, [schoolBundles, verifikasiReviews]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4500);
  }
  void showToast;

  return (
    <div className="space-y-6">
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
            <h1 className="text-2xl font-semibold text-slate-950">Verifikasi</h1>
            <p className="mt-1 text-sm text-slate-600">
              Daftar sekolah dampingan &amp; status verifikasi anda.
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

      <section className="flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="text-slate-500">Total Sekolah</span>
          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
            {stats.total}
          </Badge>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Disetujui <span className="font-semibold">{stats.approved}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Clock4 className="h-4 w-4" />
          Pending <span className="font-semibold">{stats.pending}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <XCircle className="h-4 w-4" />
          Ditolak <span className="font-semibold">{stats.rejected}</span>
        </div>
      </section>

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
            Menampilkan <span className="font-semibold text-slate-800">{filteredBundles.length}</span> dari{" "}
            <span className="font-semibold text-slate-800">{schoolBundles.length}</span> sekolah
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
        ) : filteredBundles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-sm text-slate-500">
            Tidak ada sekolah yang terdaftar sebagai dampingan anda saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 w-16">No</th>
                  <th className="px-4 py-3 w-36">NPSN</th>
                  <th className="px-4 py-3">Sekolah</th>
                  <th className="px-4 py-3 w-44">Verifikasi</th>
                </tr>
              </thead>
              <tbody>
                {filteredBundles.map((row, idx) => {
                  const review = verifikasiReviews[row.schoolNpsn];
                  const globalApproval: boolean | null = review?.approvedAdmin ?? null;
                  let statusBadge: ReviewItemStatus = "pending";
                  if (globalApproval === true) statusBadge = "approved";
                  else if (globalApproval === false) statusBadge = "rejected";

                  return (
                    <tr
                      key={row.schoolNpsn}
                      onClick={() => router.push(`/fasilitator-administrasi/verifikasi-online/${row.schoolNpsn}`)}
                      className={cn(
                        "cursor-pointer transition border-b border-slate-100 last:border-b-0",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                        "hover:bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-4 text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs font-bold text-slate-950">
                          {row.schoolNpsn}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">{row.schoolName}</td>
                      <td className="px-4 py-4">
                        <Badge
                          className={cn("border", reviewStatusVariant(statusBadge))}
                          variant="outline"
                        >
                          {statusBadge === "approved" && <CheckCircle2 className="mr-1.5 h-3 w-3" />}
                          {statusBadge === "rejected" && <XCircle className="mr-1.5 h-3 w-3" />}
                          {statusBadge === "pending" && <Clock4 className="mr-1.5 h-3 w-3" />}
                          {reviewStatusLabel(statusBadge)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-xl",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ) : null}
    </div>
  );
}
