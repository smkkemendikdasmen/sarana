"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock4,
  Eye,
  FileDown,
  FileText,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ADMINISTRATIVE_DOCUMENT_LABELS,
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
  schoolAdministrativeDocumentsByNpsnRequest,
  schoolProfileByNpsnRequest,
  upsertWorkspaceAssignmentsRequest,
  upsertWorkspaceVerifikasiOnlineReviewRequest,
  workspaceAdminSelectionRequest,
  workspaceAssignmentsRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileRecord,
  type WorkspaceAdminSelectionData,
  type WorkspaceAssignmentRecord,
  type WorkspaceBimtekReviewRecord,
  type WorkspaceSchoolEquipmentData,
  type WorkspaceSchoolProposalData,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type ReviewItemStatus = "approved" | "pending" | "rejected" | null;
type DetailTabKey = "administrasi" | "kondisi-sarana" | "pengajuan-sarana";

interface PerItemDraft {
  status: ReviewItemStatus;
  note: string;
}

interface ReviewDraftStruct {
  globalNote: string;
  concentrations: Record<string, PerItemDraft>;
  documents: Record<string, PerItemDraft>;
  conditions: Record<string, PerItemDraft>;
  proposals: Record<string, PerItemDraft>;
}

interface VerifikasiSchoolBundle {
  assignmentKey: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  assignments: WorkspaceAssignmentRecord[];
}

interface DetailBundle {
  profile: SchoolProfileRecord;
  documents: SchoolAdministrativeDocumentRecord[];
  adminSelection: WorkspaceAdminSelectionData;
  bimtekReview: WorkspaceBimtekReviewRecord | null;
  equipmentBundle: WorkspaceSchoolEquipmentData | null;
  proposalBundle: WorkspaceSchoolProposalData | null;
}

const detailTabs: Array<{
  key: DetailTabKey;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    key: "administrasi",
    label: "Data Administrasi",
    description: "Identitas sekolah, dokumen administrasi, dan konsentrasi keahlian.",
    icon: Building2,
  },
  {
    key: "kondisi-sarana",
    label: "Data Kondisi Sarana",
    description: "Kondisi sarana dan peralatan sekolah hasil survey.",
    icon: Boxes,
  },
  {
    key: "pengajuan-sarana",
    label: "Data Pengajuan Sarana",
    description: "Usulan RPKP dan RAB untuk pengajuan bantuan peralatan.",
    icon: ClipboardList,
  },
];

function formatFileSize(size: number) {
  const bytes = Number.isFinite(size) ? size : 0;
  const mega = bytes / (1024 * 1024);
  const kilo = bytes / 1024;
  if (mega >= 1) return `${mega.toFixed(1)} MB`;
  if (kilo >= 1) return `${kilo.toFixed(0)} KB`;
  return `${bytes} bytes`;
}

function formatDateTime(date: Date) {
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
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

function documentReviewVariant(status: string | null | undefined) {
  if (!status) return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "revisi") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "DISETUJUI" || status === "Lolos") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DITOLAK" || status === "Gagal" || status === "Tidak") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "PROSES") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function tryParseReviewStruct(input: string | null | undefined): ReviewDraftStruct {
  const fallback: ReviewDraftStruct = {
    globalNote: "",
    concentrations: {},
    documents: {},
    conditions: {},
    proposals: {},
  };
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ...fallback, globalNote: input };
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<ReviewDraftStruct>;
    return {
      globalNote: parsed.globalNote ?? "",
      concentrations: parsed.concentrations ?? {},
      documents: parsed.documents ?? {},
      conditions: parsed.conditions ?? {},
      proposals: parsed.proposals ?? {},
    };
  } catch {
    return { ...fallback, globalNote: trimmed };
  }
}

function serializeReviewStruct(struct: ReviewDraftStruct): string {
  return JSON.stringify(struct);
}

const inputBase =
  "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function FacilitatorAlatVerifikasiOnlinePage() {
  const router = useRouter();
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [schoolBundles, setSchoolBundles] = useState<VerifikasiSchoolBundle[]>([]);
  const [verifikasiReviews, setVerifikasiReviews] = useState<Record<string, WorkspaceVerifikasiOnlineRecord>>({});

  const [modalNpsn, setModalNpsn] = useState<string>("");
  const [activeTab, setActiveTab] = useState<DetailTabKey>("administrasi");
  const [detailBundle, setDetailBundle] = useState<DetailBundle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailBundleCache, setDetailBundleCache] = useState<Record<string, DetailBundle>>({});

  const [reviewDraft, setReviewDraft] = useState<ReviewDraftStruct>({
    globalNote: "",
    concentrations: {},
    documents: {},
    conditions: {},
    proposals: {},
  });
  const [savingReview, setSavingReview] = useState(false);
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
    setDetailBundleCache({});

    const token = session.token;
    const normalizedName = normalizeUserName(facilitatorName);

    try {
      const [records, reviewRecords] = await Promise.all([
        workspaceAssignmentsRequest(token, {
          moduleKey: "verifikasi-online",
          facilitatorEquipmentId: facilitatorId || undefined,
        }),
        workspaceVerifikasiOnlineReviewsRequest(token),
      ]);
      const matchedRecords = records.filter((record) => {
        if (record.moduleKey !== "verifikasi-online") return false;
        if (facilitatorId && record.facilitatorEquipmentId === facilitatorId) return true;
        if (normalizedName && normalizeUserName(record.facilitatorEquipmentName) === normalizedName) return true;
        return false;
      });

      const reviewMap: Record<string, WorkspaceVerifikasiOnlineRecord> = {};
      for (const review of reviewRecords) {
        reviewMap[review.schoolNpsn] = review;
      }
      setVerifikasiReviews(reviewMap);

      if (matchedRecords.length === 0) {
        const seededRecord: WorkspaceAssignmentRecord = {
          key: `seed-verifikasi-online-alat-${session.user.id}-${Date.now()}`,
          moduleKey: "verifikasi-online",
          moduleLabel: "Verifikasi Online Peralatan",
          sourceTab: "abt",
          sourceLabel: "data sekolah penerima bantuan ABT",
          schoolNo: 1,
          schoolNpsn: "10110273",
          schoolName: "SMK NEGERI 1 ARONGAN LAMBALEK",
          facilitatorAdministrationId: "",
          facilitatorAdministrationName: "Fasilitator Admin Pendamping",
          facilitatorEquipmentId: session.user.id,
          facilitatorEquipmentName: session.user.fullName,
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

  useEffect(() => {
    let cancelled = false;

    async function loadSchoolDetail() {
      if (!modalNpsn || !session?.token) {
        setDetailBundle(null);
        setLoadingDetail(false);
        setDetailError("");
        return;
      }

      if (detailBundleCache[modalNpsn]) {
        setDetailBundle(detailBundleCache[modalNpsn]);
        setLoadingDetail(false);
        setDetailError("");
        return;
      }

      setLoadingDetail(true);
      setDetailError("");

      try {
        const token = session.token;
        const [profile, documents, adminSelection] = await Promise.all([
          schoolProfileByNpsnRequest(token, modalNpsn),
          schoolAdministrativeDocumentsByNpsnRequest(token, modalNpsn),
          workspaceAdminSelectionRequest(token, { schoolNpsn: modalNpsn }),
        ]);
        if (cancelled) return;

        const filteredDocuments = documents.filter((document) =>
          ADMINISTRATIVE_DOCUMENT_UMUM_CODES.includes(document.code),
        );

        const bimtekReview =
          adminSelection.bimtekReviews.find((item) => item.schoolNpsn === modalNpsn) ?? null;
        const equipmentBundle =
          (adminSelection.equipmentBundles?.[modalNpsn] as WorkspaceSchoolEquipmentData | undefined) ?? null;
        const proposalBundle =
          (adminSelection.proposalBundles?.[modalNpsn] as WorkspaceSchoolProposalData | undefined) ?? null;

        const nextBundle: DetailBundle = {
          profile,
          documents: filteredDocuments.length ? filteredDocuments : documents.slice(0, 13),
          adminSelection,
          bimtekReview,
          equipmentBundle,
          proposalBundle,
        };

        setDetailBundle(nextBundle);
        setDetailBundleCache((prev) => ({ ...prev, [modalNpsn]: nextBundle }));
      } catch (error) {
        if (!cancelled) {
          setDetailError(error instanceof Error ? error.message : "Gagal memuat detail data sekolah.");
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    void loadSchoolDetail();

    return () => {
      cancelled = true;
    };
  }, [modalNpsn, session?.token, detailBundleCache]);

  useEffect(() => {
    setActiveTab("administrasi");
  }, [modalNpsn]);

  useEffect(() => {
    if (!modalNpsn) return;
    const review = verifikasiReviews[modalNpsn] ?? null;
    setReviewDraft(tryParseReviewStruct(review?.reviewNoteEquipment));
  }, [modalNpsn, verifikasiReviews]);

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
      if (review?.approvedEquipment === true) approved += 1;
      else if (review?.approvedEquipment === false) rejected += 1;
      else pending += 1;
    }
    return { total: schoolBundles.length, approved, rejected, pending };
  }, [schoolBundles, verifikasiReviews]);

  const selectedBundle = useMemo(
    () => schoolBundles.find((row) => row.schoolNpsn === modalNpsn) ?? null,
    [schoolBundles, modalNpsn],
  );
  const selectedReview = selectedBundle ? verifikasiReviews[selectedBundle.schoolNpsn] ?? null : null;

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4500);
  }

  async function saveGlobalApproval(globalApproval: boolean | null) {
    if (!selectedBundle || !session?.token) return;
    setSavingReview(true);
    try {
      const token = session.token;
      const result = await upsertWorkspaceVerifikasiOnlineReviewRequest(token, {
        schoolNpsn: selectedBundle.schoolNpsn,
        schoolName: selectedBundle.schoolName,
        reviewerRole: "PERALATAN",
        reviewerId: session.user.id,
        reviewerName: session.user.fullName,
        reviewNote: serializeReviewStruct(reviewDraft),
        approved: globalApproval,
        updatedAt: new Date().toISOString(),
      });
      if (result) {
        setVerifikasiReviews((prev) => ({ ...prev, [result.schoolNpsn]: result }));
      }
      const labelApproval =
        globalApproval === true
          ? "Disetujui"
          : globalApproval === false
            ? "Ditolak"
            : "Pending";
      showToast(
        "success",
        `Verifikasi ${labelApproval} untuk ${selectedBundle.schoolName} tersimpan.`,
      );
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Gagal menyimpan verifikasi.",
      );
    } finally {
      setSavingReview(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border border-primary/20 bg-primary/[0.08] text-primary"
              variant="outline"
            >
              <Wrench className="mr-2 h-3.5 w-3.5" />
              {facilitatorName || "Fasilitator Alat"}
            </Badge>
            <span className="text-xs text-slate-500">
              {session?.user.organization ?? "• Organisasi belum diatur"}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Verifikasi Online</h1>
            <p className="mt-1 text-sm text-slate-600">
              Daftar sekolah dampingan &amp; status verifikasi peralatan anda.
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
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-3 py-3 w-16">No</th>
                  <th className="px-3 py-3 w-36">NPSN</th>
                  <th className="px-3 py-3">Nama Sekolah</th>
                  <th className="px-3 py-3 w-44">Status Verifikasi</th>
                  <th className="px-3 py-3">Catatan</th>
                  <th className="px-3 py-3 w-28 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredBundles.map((row, idx) => {
                  const review = verifikasiReviews[row.schoolNpsn];
                  const globalApproval: boolean | null = review?.approvedEquipment ?? null;
                  let statusBadge: ReviewItemStatus = "pending";
                  if (globalApproval === true) statusBadge = "approved";
                  else if (globalApproval === false) statusBadge = "rejected";

                  const parsed = tryParseReviewStruct(review?.reviewNoteEquipment);
                  const catatanPreview =
                    parsed.globalNote?.trim() ||
                    Object.values(parsed.documents).find((d) => d.note.trim())?.note?.trim() ||
                    Object.values(parsed.concentrations).find((c) => c.note.trim())?.note?.trim() ||
                    "";

                  return (
                    <tr
                      key={row.schoolNpsn}
                      onClick={() => router.push(`/fasilitator-alat/verifikasi-online/${row.schoolNpsn}`)}
                      className={cn(
                        "cursor-pointer transition border-b border-slate-100 last:border-b-0",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                        "hover:bg-primary/5",
                      )}
                    >
                      <td className="px-3 py-4 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-3 py-4">
                        <span className="font-mono text-xs font-bold text-slate-950">
                          {row.schoolNpsn}
                        </span>
                      </td>
                      <td className="px-3 py-4 font-medium text-slate-900">{row.schoolName}</td>
                      <td className="px-3 py-4">
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
                      <td className="px-3 py-4 max-w-md truncate text-slate-600 text-xs">
                        {catatanPreview || (
                          <span className="text-slate-400 italic">Belum ada catatan</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/fasilitator-alat/verifikasi-online/${row.schoolNpsn}`);
                          }}
                          className="gap-1.5 bg-primary text-white hover:bg-primary/90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Proses
                        </Button>
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

      {modalNpsn ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto"
          onClick={() => !savingReview && setModalNpsn("")}
        >
          <div
            className="relative w-full max-w-6xl rounded-[28px] bg-white shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-[28px] border-b border-slate-100 bg-white/95 px-8 py-5 backdrop-blur">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Verifikasi Detail Sekolah
                </p>
                <h2 className="truncate text-xl font-semibold text-slate-950">
                  {selectedBundle?.schoolName ?? "Memuat..."}
                </h2>
                <p className="text-sm text-slate-600">
                  NPSN{" "}
                  <span className="font-mono font-bold text-slate-900">
                    {selectedBundle?.schoolNpsn ?? "-"}
                  </span>
                  {selectedReview?.reviewedEquipmentAt ? (
                    <span className="ml-3 text-slate-500">
                      Terakhir review: {formatDateTime(new Date(selectedReview.reviewedEquipmentAt))}
                    </span>
                  ) : null}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => !savingReview && setModalNpsn("")}
                disabled={savingReview}
                className="shrink-0 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="border-b border-slate-100 px-8 pt-5">
              <div className="flex flex-wrap gap-2">
                {detailTabs.map((tab) => {
                  const active = tab.key === activeTab;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "group inline-flex items-center gap-2 rounded-t-[18px] border-b-4 px-5 py-3 text-sm font-semibold transition",
                        active
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-800",
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      <div className="text-left">
                        <p>{tab.label}</p>
                        <p
                          className={cn(
                            "text-[11px] font-medium text-left",
                            active ? "text-primary/80" : "text-slate-400",
                          )}
                        >
                          {tab.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6 p-8">
              {!selectedBundle || loadingDetail ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  Memuat detail data sekolah...
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {detailError}
                </div>
              ) : !detailBundle ? (
                <EmptyState message="Data detail tidak bisa dimuat." />
              ) : (
                <>
                  {activeTab === "administrasi" ? (
                    <AdministrasiTabContent
                      profile={detailBundle.profile}
                      documents={detailBundle.documents}
                      reviewDraft={reviewDraft}
                      setReviewDraft={setReviewDraft}
                      proposalBundle={detailBundle.proposalBundle}
                    />
                  ) : null}

                  {activeTab === "kondisi-sarana" ? (
                    <KondisiSaranaTabContent
                      profile={detailBundle.profile}
                      bimtekReview={detailBundle.bimtekReview}
                      equipmentBundle={detailBundle.equipmentBundle}
                      reviewDraft={reviewDraft}
                      setReviewDraft={setReviewDraft}
                    />
                  ) : null}

                  {activeTab === "pengajuan-sarana" ? (
                    <PengajuanSaranaTabContent
                      profile={detailBundle.profile}
                      bimtekReview={detailBundle.bimtekReview}
                      proposalBundle={detailBundle.proposalBundle}
                      reviewDraft={reviewDraft}
                      setReviewDraft={setReviewDraft}
                    />
                  ) : null}

                  <PerItemSectionCard
                    title="Ringkasan Verifikasi &amp; Catatan Umum"
                    description="Berikan status akhir untuk verifikasi keseluruhan sekolah ini (global) dan catatan umum bila perlu."
                    icon={<BadgeCheck className="h-5 w-5 text-primary" />}
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                        <p className="text-sm font-semibold text-slate-800">
                          Status Approve Fasil Administrasi
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge
                            className={cn(
                              "border",
                              reviewStatusVariant(
                                selectedReview?.approvedAdmin === true
                                  ? "approved"
                                  : selectedReview?.approvedAdmin === false
                                    ? "rejected"
                                    : "pending",
                              ),
                            )}
                            variant="outline"
                          >
                            {selectedReview?.approvedAdmin === true
                              ? "Disetujui"
                              : selectedReview?.approvedAdmin === false
                                ? "Ditolak"
                                : "Belum di Proses"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {selectedReview?.reviewedAdminName
                            ? `Oleh ${selectedReview.reviewedAdminName}`
                            : "Belum ada review admin"}
                          {selectedReview?.reviewedAdminAt
                            ? ` • ${formatDateTime(new Date(selectedReview.reviewedAdminAt))}`
                            : ""}
                        </p>
                        {selectedReview?.reviewNoteAdmin?.trim() ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">
                            {selectedReview.reviewNoteAdmin.trim()}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-slate-400 italic">
                            Belum ada catatan dari fasilitator administrasi.
                          </p>
                        )}
                      </div>

                      <label className="grid gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <MessageSquareWarning className="h-4 w-4 text-primary" />
                          Catatan Umum (Fasil Alat)
                        </span>
                        <textarea
                          rows={4}
                          className={cn(inputBase, "resize-y bg-white")}
                          placeholder="Catatan umum untuk verifikasi sekolah ini..."
                          value={reviewDraft.globalNote}
                          onChange={(event) =>
                            setReviewDraft((prev) => ({ ...prev, globalNote: event.target.value }))
                          }
                        />
                        <p className="text-xs text-slate-500">
                          {reviewDraft.globalNote.trim().length} karakter
                        </p>
                      </label>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => !savingReview && setModalNpsn("")}
                        disabled={savingReview}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Tutup
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void saveGlobalApproval(null)}
                        disabled={savingReview}
                        className="gap-2 border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                      >
                        <Clock4 className="h-4 w-4" />
                        Simpan sebagai Pending
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void saveGlobalApproval(false)}
                        disabled={savingReview}
                        className="gap-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Simpan sebagai Ditolak
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void saveGlobalApproval(true)}
                        disabled={savingReview}
                        className="gap-2"
                      >
                        {savingReview ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {savingReview ? "Menyimpan..." : "Simpan &amp; Setujui"}
                      </Button>
                    </div>
                  </PerItemSectionCard>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdministrasiTabContent({
  profile,
  documents,
  reviewDraft,
  setReviewDraft,
  proposalBundle,
}: {
  profile: SchoolProfileRecord;
  documents: SchoolAdministrativeDocumentRecord[];
  reviewDraft: ReviewDraftStruct;
  setReviewDraft: (fn: (prev: ReviewDraftStruct) => ReviewDraftStruct) => void;
  proposalBundle: WorkspaceSchoolProposalData | null;
}) {
  const [docPreview, setDocPreview] = useState<
    | null
    | {
        docName: string;
        docCode: string;
        files: Array<{ url: string; name: string; mimeType: string; size: number; uploadedAt: string | null }>;
        index: number;
      }
  >(null);

  useEffect(() => {
    if (!docPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDocPreview(null);
      if (e.key === "ArrowRight") setDocPreview((p) => (p && p.files.length > 1 ? { ...p, index: (p.index + 1) % p.files.length } : p));
      if (e.key === "ArrowLeft") setDocPreview((p) => (p && p.files.length > 1 ? { ...p, index: (p.index - 1 + p.files.length) % p.files.length } : p));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [docPreview]);

  function openDocPreview(doc: SchoolAdministrativeDocumentRecord, startIndex = 0) {
    const list: Array<{ url: string; name: string; mimeType: string; size: number; uploadedAt: string | null }> =
      doc.files && doc.files.length > 0
        ? doc.files.map((f) => ({
            url: f.filePath,
            name: f.fileName,
            mimeType: f.mimeType || doc.mimeType || "",
            size: f.fileSize || doc.fileSize || 0,
            uploadedAt: f.uploadedAt || doc.uploadedAt || null,
          }))
        : doc.filePath
          ? [
              {
                url: doc.filePath,
                name: doc.fileName || doc.name,
                mimeType: doc.mimeType || "",
                size: doc.fileSize || 0,
                uploadedAt: doc.uploadedAt || null,
              },
            ]
          : [];
    if (list.length === 0) return;
    setDocPreview({
      docName: doc.name,
      docCode: doc.code,
      files: list,
      index: Math.max(0, Math.min(startIndex, list.length - 1)),
    });
  }

  function currentPreviewFile() {
    if (!docPreview) return null;
    return docPreview.files[docPreview.index] ?? null;
  }

  function isImage(mime = "") {
    return typeof mime === "string" && /^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml?)/i.test(mime);
  }
  function isPdf(mime = "") {
    return typeof mime === "string" && /application\/pdf/i.test(mime);
  }

  return (
    <div className="space-y-6">
      <VerifikasiDetailStatCards
        profile={profile}
        documents={documents}
        proposalBundle={proposalBundle}
      />
      <DataSekolahSummaryCard profile={profile} />

      <PerItemSectionCard
        title="Konsentrasi Keahlian &amp; Jumlah Siswa per KK"
        description="Setiap konsentrasi keahlian (KK) dapat diverifikasi secara terpisah berdasarkan jumlah rombongan belajar dan siswa per kelas."
        icon={<Users className="h-5 w-5 text-primary" />}
      >
        {profile.concentrations.length === 0 ? (
          <EmptyState message="Belum ada data konsentrasi keahlian." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {profile.concentrations.map((kk) => {
              const totalRombel =
                (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
              const totalSiswa =
                (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
              const current = reviewDraft.concentrations[kk.code] ?? { status: null, note: "" };
              return (
                <div
                  key={kk.code}
                  className={cn(
                    "rounded-2xl border bg-white p-5 transition",
                    reviewStatusVariant(current.status),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600 mb-2"
                      >
                        {kk.code}
                      </Badge>
                      <p className="text-base font-semibold text-slate-950">{kk.name}</p>
                    </div>
                    <Badge
                      className={cn("border", reviewStatusVariant(current.status))}
                      variant="outline"
                    >
                      {reviewStatusLabel(current.status)}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Total Rombel
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {totalRombel} rombongan belajar
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Total Siswa
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {totalSiswa.toLocaleString("id-ID")} siswa
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Luas Ruang Praktik
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {kk.luasRuanganRps?.trim() ? (
                          kk.luasRuanganRps
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">Belum diisi</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {(["10", "11", "12"] as const).map((grade) => {
                      const rk = `rombel${grade}` as const;
                      const sk = `student${grade}` as const;
                      return (
                        <div
                          key={grade}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs"
                        >
                          <span className="text-slate-600">Kelas {grade}</span>
                          <span className="text-slate-900 font-semibold">
                            {kk[rk] ?? 0} rombel • {(kk[sk] ?? 0).toLocaleString("id-ID")} siswa
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusButtonGroup
                      status={current.status}
                      onChange={(next) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          concentrations: {
                            ...prev.concentrations,
                            [kk.code]: {
                              status: next,
                              note: prev.concentrations[kk.code]?.note ?? "",
                            },
                          },
                        }))
                      }
                    />
                  </div>

                  <label className="mt-4 block grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                      Catatan Konsentrasi Keahlian
                    </span>
                    <textarea
                      rows={2}
                      className={cn(inputBase, "resize-y text-xs leading-5")}
                      placeholder="Catatan untuk KK ini (misal: jumlah siswa tidak sesuai, data rombel kurang lengkap)..."
                      value={current.note}
                      onChange={(event) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          concentrations: {
                            ...prev.concentrations,
                            [kk.code]: {
                              status: prev.concentrations[kk.code]?.status ?? null,
                              note: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </PerItemSectionCard>

      <PerItemSectionCard
        title="Dokumen Administrasi"
        description="Verifikasi kelengkapan dokumen administrasi sekolah satu per satu. Setiap dokumen dapat diberi status Approve / Pending / Reject dan catatan tersendiri."
        icon={<FileText className="h-5 w-5 text-primary" />}
      >
        {documents.length === 0 ? (
          <EmptyState message="Belum ada dokumen administrasi yang diunggah sekolah." />
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const current = reviewDraft.documents[doc.code] ?? { status: null, note: "" };
              return (
                <div
                  key={doc.code}
                  className={cn(
                    "rounded-2xl border bg-white p-5 transition",
                    reviewStatusVariant(current.status),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 border border-slate-200">
                          {String(doc.no).padStart(2, "0")}
                        </span>
                        <p className="text-sm font-semibold text-slate-950">{doc.name}</p>
                        {doc.required ? (
                          <Badge
                            className="border-rose-200 bg-rose-50 text-rose-700"
                            variant="outline"
                          >
                            WAJIB
                          </Badge>
                        ) : null}
                        <Badge
                          className={cn(
                            "border",
                            doc.uploaded
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-800",
                          )}
                          variant="outline"
                        >
                          {doc.uploaded ? "Sudah Diupload" : "Belum Diupload"}
                        </Badge>
                        {doc.allowMultiple ? (
                          <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">
                            {doc.files?.length ?? 0} / {doc.maxFiles ?? 1} file
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doc.fileName || "Belum ada berkas"} •{" "}
                        {doc.fileSize ? formatFileSize(doc.fileSize) : "0 bytes"}
                        {doc.uploadedAt ? (
                          <>
                            {" • Diupload: "}
                            {formatDateTime(new Date(doc.uploadedAt))}
                          </>
                        ) : null}
                      </div>

                      {doc.uploaded && doc.files && doc.files.length > 1 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                          {doc.files.map((f, idx) => {
                            const mime = f.mimeType || doc.mimeType || "";
                            const img = isImage(mime);
                            const pdf = isPdf(mime);
                            return (
                              <button
                                key={f.id || idx}
                                type="button"
                                onClick={() => openDocPreview(doc, idx)}
                                className="group relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-primary/50 hover:ring-2 hover:ring-primary/20"
                                title={`Preview: ${f.fileName}`}
                              >
                                {img ? (
                                  <img
                                    src={f.filePath}
                                    alt={f.fileName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : pdf ? (
                                  <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                                    <FileText className="h-7 w-7 text-rose-500" />
                                    <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
                                      PDF
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                                    <FileDown className="h-7 w-7 text-slate-500" />
                                    <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
                                      {f.fileName.split(".").pop()?.toUpperCase() || "FILE"}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] font-semibold text-white/95 opacity-90">
                                  <span className="truncate">{String(idx + 1).padStart(2, "0")}</span>
                                  <Eye className="h-3 w-3" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
                      <Badge
                        className={cn(
                          "border",
                          reviewStatusVariant(current.status) || documentReviewVariant(doc.reviewStatus),
                        )}
                        variant="outline"
                      >
                        {reviewStatusLabel(current.status) || doc.reviewStatus || "PENDING"}
                      </Badge>
                      {doc.uploaded && (doc.filePath || (doc.files && doc.files.length > 0)) ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-slate-200 bg-white text-slate-700"
                            onClick={() => openDocPreview(doc, 0)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </Button>
                          <a
                            href={(doc.files && doc.files[0]?.filePath) || doc.filePath || "#"}
                            target="_blank"
                            rel="noreferrer"
                            download
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-slate-200 bg-white text-slate-700"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              Unduh
                            </Button>
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusButtonGroup
                      status={current.status}
                      onChange={(next) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          documents: {
                            ...prev.documents,
                            [doc.code]: {
                              status: next,
                              note: prev.documents[doc.code]?.note ?? "",
                            },
                          },
                        }))
                      }
                    />
                  </div>

                  <label className="mt-4 block grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                      Catatan Dokumen
                    </span>
                    <textarea
                      rows={2}
                      className={cn(inputBase, "resize-y text-xs leading-5")}
                      placeholder="Catatan untuk dokumen ini (misal: scan kurang jelas, tanggal tidak sesuai)..."
                      value={current.note}
                      onChange={(event) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          documents: {
                            ...prev.documents,
                            [doc.code]: {
                              status: prev.documents[doc.code]?.status ?? null,
                              note: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </PerItemSectionCard>

      {docPreview && currentPreviewFile() ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setDocPreview(null)}
        >
          <div
            className="relative w-full max-w-[98vw] rounded-[22px] bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {docPreview.docName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentPreviewFile()!.name} • {formatFileSize(currentPreviewFile()!.size || 0)}
                  {currentPreviewFile()!.uploadedAt ? (
                    <> • Diupload: {formatDateTime(new Date(currentPreviewFile()!.uploadedAt!))}</>
                  ) : null}
                  {" • File "}
                  <span className="font-semibold text-slate-700">
                    {docPreview.index + 1} / {docPreview.files.length}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={currentPreviewFile()!.url}
                  download={currentPreviewFile()!.name}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Unduh
                </a>
                <button
                  type="button"
                  onClick={() => setDocPreview(null)}
                  aria-label="Tutup preview"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              {docPreview.files.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDocPreview((p) =>
                      p && p.files.length > 1
                        ? { ...p, index: (p.index - 1 + p.files.length) % p.files.length }
                        : p,
                    )
                  }
                  aria-label="File sebelumnya"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:h-11 sm:w-11"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              ) : null}

              <div className="max-h-[82vh] overflow-auto bg-slate-100">
                <div className="flex min-h-[60vh] items-center justify-center p-3 sm:p-5">
                  {(() => {
                    const f = currentPreviewFile()!;
                    const mime = f.mimeType;
                    if (isImage(mime)) {
                      return (
                        <img
                          src={f.url}
                          alt={f.name}
                          className="max-h-[78vh] w-auto max-w-[94vw] rounded-xl border border-slate-200 bg-white shadow-xl object-contain"
                        />
                      );
                    }
                    if (isPdf(mime)) {
                      return (
                        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          <iframe
                            src={f.url}
                            title={f.name}
                            className="h-[78vh] w-full"
                          />
                        </div>
                      );
                    }
                    const ext = f.name.split(".").pop()?.toLowerCase();
                    const canInlineIframe = ext && /^html?$/i.test(ext);
                    if (canInlineIframe) {
                      return (
                        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          <iframe
                            src={f.url}
                            title={f.name}
                            className="h-[78vh] w-full"
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                          <FileText className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{f.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Format file tidak dapat dipreview langsung di browser. Silakan unduh untuk membuka.
                        </p>
                        <a
                          href={f.url}
                          download={f.name}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <FileDown className="h-4 w-4" />
                          Unduh File
                        </a>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {docPreview.files.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDocPreview((p) =>
                      p && p.files.length > 1 ? { ...p, index: (p.index + 1) % p.files.length } : p,
                    )
                  }
                  aria-label="File selanjutnya"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:h-11 sm:w-11"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              ) : null}
            </div>

            {docPreview.files.length > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Gunakan tombol ← → atau Arrow Left / Right Keyboard • Escape tutup
                </p>
                <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[70%] overflow-x-auto">
                  {docPreview.files.map((f, idx) => {
                    const active = idx === docPreview.index;
                    const mime = f.mimeType;
                    const img = isImage(mime);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDocPreview((p) => (p ? { ...p, index: idx } : p))}
                        className={cn(
                          "relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border transition",
                          active
                            ? "ring-2 ring-primary border-primary/60"
                            : "border-slate-200 hover:border-slate-400",
                        )}
                        title={`${idx + 1}. ${f.name}`}
                      >
                        {img ? (
                          <img src={f.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-50 text-[9px] font-bold text-slate-600">
                            {idx + 1}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KondisiSaranaTabContent({
  profile,
  bimtekReview,
  equipmentBundle,
  reviewDraft,
  setReviewDraft,
}: {
  profile: SchoolProfileRecord;
  bimtekReview: WorkspaceBimtekReviewRecord | null;
  equipmentBundle: WorkspaceSchoolEquipmentData | null;
  reviewDraft: ReviewDraftStruct;
  setReviewDraft: (fn: (prev: ReviewDraftStruct) => ReviewDraftStruct) => void;
}) {
  const surveyStatus = bimtekReview?.statuses?.survey ?? null;

  const tables: Array<{ key: string; label: string; rows: Record<string, unknown>[] }> = [];
  if (equipmentBundle?.equipmentTables) {
    for (const [key, value] of Object.entries(equipmentBundle.equipmentTables)) {
      if (Array.isArray(value)) {
        tables.push({ key, label: humanizeTableName(key), rows: value as Record<string, unknown>[] });
      }
    }
  }

  return (
    <div className="space-y-6">
      <PerItemSectionCard
        title="Survey Kondisi Sarana &amp; Peralatan"
        description="Ringkasan status survey keseluruhan dari Bimbingan Teknis (Kondisi Alat) dan detail per KK."
        icon={<Boxes className="h-5 w-5 text-primary" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Total KK Disurvey
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{profile.concentrations.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">konsentrasi keahlian sekolah</p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              Status Survey Bimtek
            </p>
            <div className="mt-2">
              <Badge className={cn("border", documentReviewVariant(surveyStatus))} variant="outline">
                {surveyStatus === "approved"
                  ? "Survey Disetujui"
                  : surveyStatus === "revisi"
                    ? "Perlu Revisi"
                    : surveyStatus === "pending"
                      ? "Survey Di Proses"
                      : "Belum Ada Survey"}
              </Badge>
            </div>
            {bimtekReview?.updatedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Update: {formatDateTime(new Date(bimtekReview.updatedAt))}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Daftar Item Kondisi
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{tables.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">kategori kondisi alat tersedia</p>
          </div>
        </div>

        {profile.concentrations.length === 0 ? null : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {profile.concentrations.map((kk) => {
              const key = `kondisi-kk-${kk.code}`;
              const current = reviewDraft.conditions[key] ?? { status: null, note: "" };
              const totalRombel =
                (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0);
              const totalSiswa =
                (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0);
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-2xl border bg-white p-5 transition",
                    reviewStatusVariant(current.status),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600 mb-2"
                      >
                        {kk.code}
                      </Badge>
                      <p className="text-base font-semibold text-slate-950">{kk.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {totalRombel} rombel • {totalSiswa.toLocaleString("id-ID")} siswa
                      </p>
                    </div>
                    <Badge
                      className={cn("border", reviewStatusVariant(current.status))}
                      variant="outline"
                    >
                      {reviewStatusLabel(current.status)}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusButtonGroup
                      status={current.status}
                      onChange={(next) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          conditions: {
                            ...prev.conditions,
                            [key]: { status: next, note: prev.conditions[key]?.note ?? "" },
                          },
                        }))
                      }
                    />
                  </div>

                  <label className="mt-4 block grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                      Catatan Kondisi Sarana KK
                    </span>
                    <textarea
                      rows={2}
                      className={cn(inputBase, "resize-y text-xs leading-5")}
                      placeholder="Catatan kondisi alat untuk KK ini (misal: alat kurang, perlu perbaikan, stok tidak sesuai)..."
                      value={current.note}
                      onChange={(event) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          conditions: {
                            ...prev.conditions,
                            [key]: {
                              status: prev.conditions[key]?.status ?? null,
                              note: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </PerItemSectionCard>

      {tables.length === 0 ? (
        <PerItemSectionCard
          title="Detail Data Kondisi Peralatan"
          description="Daftar rinci peralatan sekolah menurut master data Kondisi Sarana."
          icon={<AlertCircle className="h-5 w-5 text-primary" />}
        >
          <EmptyState message="Belum ada rincian data kondisi sarana & peralatan untuk sekolah ini." />
        </PerItemSectionCard>
      ) : (
        tables.map((table) => {
          const current = reviewDraft.conditions[`table-${table.key}`] ?? {
            status: null,
            note: "",
          };
          return (
            <PerItemSectionCard
              key={table.key}
              title={table.label}
              description={`Terdapat ${table.rows.length} item kondisi ${table.label.toLowerCase()}.`}
              icon={<Boxes className="h-5 w-5 text-primary" />}
            >
              <div
                className={cn(
                  "rounded-2xl border p-5 transition",
                  reviewStatusVariant(current.status),
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">
                      Status Tabel {table.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {table.rows.length} baris data
                    </p>
                  </div>
                  <Badge
                    className={cn("border", reviewStatusVariant(current.status))}
                    variant="outline"
                  >
                    {reviewStatusLabel(current.status)}
                  </Badge>
                </div>

                <GenericRowsTable rows={table.rows} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusButtonGroup
                    status={current.status}
                    onChange={(next) =>
                      setReviewDraft((prev) => ({
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          [`table-${table.key}`]: {
                            status: next,
                            note: prev.conditions[`table-${table.key}`]?.note ?? "",
                          },
                        },
                      }))
                    }
                  />
                </div>

                <label className="mt-4 block grid gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                    Catatan Tabel {table.label}
                  </span>
                  <textarea
                    rows={2}
                    className={cn(inputBase, "resize-y text-xs leading-5")}
                    placeholder="Catatan untuk tabel kondisi ini..."
                    value={current.note}
                    onChange={(event) =>
                      setReviewDraft((prev) => ({
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          [`table-${table.key}`]: {
                            status: prev.conditions[`table-${table.key}`]?.status ?? null,
                            note: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </label>
              </div>
            </PerItemSectionCard>
          );
        })
      )}
    </div>
  );
}

function PengajuanSaranaTabContent({
  profile,
  bimtekReview,
  proposalBundle,
  reviewDraft,
  setReviewDraft,
}: {
  profile: SchoolProfileRecord;
  bimtekReview: WorkspaceBimtekReviewRecord | null;
  proposalBundle: WorkspaceSchoolProposalData | null;
  reviewDraft: ReviewDraftStruct;
  setReviewDraft: (fn: (prev: ReviewDraftStruct) => ReviewDraftStruct) => void;
}) {
  const rpkpStatus = bimtekReview?.statuses?.rpkp ?? null;
  const rabStatus = bimtekReview?.statuses?.rab ?? null;

  const tables: Array<{ key: string; label: string; rows: Record<string, unknown>[] }> = [];
  if (proposalBundle?.proposalTables) {
    for (const [key, value] of Object.entries(proposalBundle.proposalTables)) {
      if (Array.isArray(value)) {
        tables.push({ key, label: humanizeTableName(key), rows: value as Record<string, unknown>[] });
      }
    }
  }
  const selectionTables: Array<{ key: string; label: string; rows: Record<string, unknown>[] }> = [];
  if (proposalBundle?.rpkpSelections) {
    for (const [key, value] of Object.entries(proposalBundle.rpkpSelections)) {
      if (Array.isArray(value)) {
        selectionTables.push({
          key,
          label: `Pilihan RPKP - ${humanizeTableName(key)}`,
          rows: value as Record<string, unknown>[],
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <PerItemSectionCard
        title="Ringkasan Pengajuan Sarana (RPKP &amp; RAB)"
        description="Status RPKP dan RAB dari review Bimbingan Teknis, beserta rincian usulan alat per KK."
        icon={<ClipboardList className="h-5 w-5 text-primary" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div
            className={cn(
              "rounded-2xl border p-5",
              documentReviewVariant(rpkpStatus) || "border-slate-200 bg-slate-50/70",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Status RPKP
            </p>
            <div className="mt-2">
              <Badge className={cn("border", documentReviewVariant(rpkpStatus))} variant="outline">
                {rpkpStatus === "approved"
                  ? "RPKP Disetujui"
                  : rpkpStatus === "revisi"
                    ? "RPKP Perlu Revisi"
                    : rpkpStatus === "pending"
                      ? "RPKP Di Proses"
                      : "RPKP Belum Di Proses"}
              </Badge>
            </div>
          </div>
          <div
            className={cn(
              "rounded-2xl border p-5",
              documentReviewVariant(rabStatus) || "border-slate-200 bg-slate-50/70",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Status RAB
            </p>
            <div className="mt-2">
              <Badge className={cn("border", documentReviewVariant(rabStatus))} variant="outline">
                {rabStatus === "approved"
                  ? "RAB Disetujui"
                  : rabStatus === "revisi"
                    ? "RAB Perlu Revisi"
                    : rabStatus === "pending"
                      ? "RAB Di Proses"
                      : "RAB Belum Di Proses"}
              </Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Kategori Data Usulan
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {tables.length + selectionTables.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              tabel usulan &amp; pilihan RPKP tersedia
            </p>
          </div>
        </div>

        {proposalBundle?.updatedAt || bimtekReview?.updatedAt ? (
          <p className="mt-4 text-xs text-slate-500">
            Update terakhir data pengajuan:{" "}
            {formatDateTime(
              new Date(proposalBundle?.updatedAt ?? bimtekReview?.updatedAt ?? new Date(0)),
            )}
          </p>
        ) : null}

        {profile.concentrations.length === 0 ? null : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {profile.concentrations.map((kk) => {
              const key = `pengajuan-kk-${kk.code}`;
              const current = reviewDraft.proposals[key] ?? { status: null, note: "" };
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-2xl border bg-white p-5 transition",
                    reviewStatusVariant(current.status),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600 mb-2"
                      >
                        {kk.code}
                      </Badge>
                      <p className="text-base font-semibold text-slate-950">{kk.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Usulan alat bantu untuk KK ini</p>
                    </div>
                    <Badge
                      className={cn("border", reviewStatusVariant(current.status))}
                      variant="outline"
                    >
                      {reviewStatusLabel(current.status)}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusButtonGroup
                      status={current.status}
                      onChange={(next) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          proposals: {
                            ...prev.proposals,
                            [key]: { status: next, note: prev.proposals[key]?.note ?? "" },
                          },
                        }))
                      }
                    />
                  </div>
                  <label className="mt-4 block grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                      Catatan Pengajuan KK
                    </span>
                    <textarea
                      rows={2}
                      className={cn(inputBase, "resize-y text-xs leading-5")}
                      placeholder="Catatan pengajuan alat untuk KK ini (misal: prioritas, spesifikasi tidak sesuai, usulan berlebih)..."
                      value={current.note}
                      onChange={(event) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          proposals: {
                            ...prev.proposals,
                            [key]: {
                              status: prev.proposals[key]?.status ?? null,
                              note: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </PerItemSectionCard>

      {[...tables, ...selectionTables].length === 0 ? (
        <PerItemSectionCard
          title="Rincian Data Pengajuan Sarana"
          description="Daftar rinci usulan barang (RPKP) dan Rencana Anggaran Biaya (RAB)."
          icon={<AlertCircle className="h-5 w-5 text-primary" />}
        >
          <EmptyState message="Belum ada rincian data pengajuan sarana untuk sekolah ini." />
        </PerItemSectionCard>
      ) : (
        [...tables, ...selectionTables].map((table) => {
          const key = `proposal-${table.key}`;
          const current = reviewDraft.proposals[key] ?? { status: null, note: "" };
          return (
            <PerItemSectionCard
              key={key}
              title={table.label}
              description={`Terdapat ${table.rows.length} item pada ${table.label.toLowerCase()}.`}
              icon={<ClipboardList className="h-5 w-5 text-primary" />}
            >
              <div
                className={cn(
                  "rounded-2xl border p-5 transition",
                  reviewStatusVariant(current.status),
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">
                      Status {table.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{table.rows.length} baris data</p>
                  </div>
                  <Badge
                    className={cn("border", reviewStatusVariant(current.status))}
                    variant="outline"
                  >
                    {reviewStatusLabel(current.status)}
                  </Badge>
                </div>

                <GenericRowsTable rows={table.rows} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusButtonGroup
                    status={current.status}
                    onChange={(next) =>
                      setReviewDraft((prev) => ({
                        ...prev,
                        proposals: {
                          ...prev.proposals,
                          [key]: {
                            status: next,
                            note: prev.proposals[key]?.note ?? "",
                          },
                        },
                      }))
                    }
                  />
                </div>

                <label className="mt-4 block grid gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                    Catatan {table.label}
                  </span>
                  <textarea
                    rows={2}
                    className={cn(inputBase, "resize-y text-xs leading-5")}
                    placeholder="Catatan untuk tabel pengajuan ini..."
                    value={current.note}
                    onChange={(event) =>
                      setReviewDraft((prev) => ({
                        ...prev,
                        proposals: {
                          ...prev.proposals,
                          [key]: {
                            status: prev.proposals[key]?.status ?? null,
                            note: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </label>
              </div>
            </PerItemSectionCard>
          );
        })
      )}
    </div>
  );
}

function VerifikasiDetailStatCards({
  profile,
  documents,
  proposalBundle,
}: {
  profile: SchoolProfileRecord;
  documents: SchoolAdministrativeDocumentRecord[];
  proposalBundle: WorkspaceSchoolProposalData | null;
}) {
  const totalKk = profile.concentrations.length;
  const totalRombel = profile.concentrations.reduce(
    (sum, kk) => sum + (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0),
    0,
  );
  const totalSiswa = profile.concentrations.reduce(
    (sum, kk) => sum + (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0),
    0,
  );

  const totalDocuments =
    documents.length || Object.keys(ADMINISTRATIVE_DOCUMENT_LABELS ?? {}).length || 20;
  const uploadedDocuments = documents.filter(
    (doc) => (doc.files?.length ?? 0) > 0 || Boolean(doc.filePath || doc.fileName),
  ).length;
  const documentsProgress = totalDocuments > 0 ? Math.round((uploadedDocuments / totalDocuments) * 100) : 0;

  let grandTotalRpkp = 0;
  let proposalRowCount = 0;
  if (proposalBundle?.proposalTables && proposalBundle?.rpkpSelections) {
    const concentrations = profile.concentrations ?? [];
    for (const kk of concentrations) {
      const surveyKey = `${profile.schoolId ?? profile.npsn}::${kk.code}::survey`;
      const rpkpKey = `${profile.schoolId ?? profile.npsn}::${kk.code}::rpkp`;
      const surveyRows = (proposalBundle.proposalTables as Record<string, unknown>)[surveyKey] as
        | Array<Record<string, unknown>>
        | undefined;
      const rowToShop = (proposalBundle.rpkpSelections as Record<string, unknown>)[rpkpKey] as
        | Record<string, string>
        | undefined;
      if (!surveyRows || !rowToShop) continue;
      for (const row of surveyRows) {
        const shopKey = rowToShop[String(row.id)];
        if (!shopKey) continue;
        const shop = (row as Record<string, unknown>)[shopKey] as Record<string, unknown> | undefined;
        if (!shop) continue;
        const price = Number(shop.priceWithTax ?? 0) || 0;
        const ship = Number(shop.shippingCost ?? 0) || 0;
        const install = Number(shop.installationCost ?? 0) || 0;
        const qty = Number(row.quantity ?? 0) || 0;
        grandTotalRpkp += (price + ship + install) * qty;
        proposalRowCount += 1;
      }
    }
  }
  const proposalValue = grandTotalRpkp > 0 ? Math.round(grandTotalRpkp / 1000) * 1000 : 0;

  const cardBase =
    "rounded-2xl border p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition flex flex-col gap-2";

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className={`${cardBase} border-primary/15 bg-gradient-to-br from-primary/[0.04] to-white`}>
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-primary/15">
            <ShieldCheck className="h-4.5 w-4.5 text-primary" />
          </div>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-500 rounded-full px-2 py-0 text-[10px] font-semibold tracking-wide">
            ID
          </Badge>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">NPSN</p>
        <p className="text-lg font-semibold font-mono leading-tight text-slate-950">
          {profile.npsn || "-"}
        </p>
        <p className="text-[11px] text-slate-500 truncate">{profile.schoolName || "-"}</p>
      </div>

      <div className={`${cardBase} border-indigo-150 bg-gradient-to-br from-indigo-50 to-white`}>
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-indigo-150">
            <BadgeCheck className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <Badge variant="outline" className="border-indigo-150 bg-indigo-50 text-indigo-700 rounded-full px-2 py-0 text-[10px] font-semibold tracking-wide">
            KK
          </Badge>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Konsentrasi Keahlian
        </p>
        <p className="text-lg font-semibold leading-tight text-slate-950">{totalKk}</p>
        <p className="text-[11px] text-slate-500">
          {totalRombel} rombel · {totalSiswa.toLocaleString("id-ID")} siswa
        </p>
      </div>

      <div className={`${cardBase} border-sky-150 bg-gradient-to-br from-sky-50 to-white`}>
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-sky-150">
            <FileText className="h-4.5 w-4.5 text-sky-600" />
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-2 py-0 text-[10px] font-semibold tracking-wide",
              documentsProgress >= 100
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : documentsProgress > 0
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-500",
            )}
          >
            {documentsProgress}%
          </Badge>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Dokumen Administrasi
        </p>
        <p className="text-lg font-semibold leading-tight text-slate-950">
          {uploadedDocuments}/{totalDocuments}
        </p>
        <p className="text-[11px] text-slate-500">
          {documentsProgress >= 100
            ? "Sudah lengkap"
            : `${Math.max(0, totalDocuments - uploadedDocuments)} belum diunggah`}
        </p>
      </div>

      <div className={`${cardBase} border-emerald-150 bg-gradient-to-br from-emerald-50 to-white`}>
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-150">
            <ClipboardList className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full px-2 py-0 text-[10px] font-semibold tracking-wide"
          >
            RAB
          </Badge>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Pengajuan RAB
        </p>
        <p className="text-lg font-semibold leading-tight text-slate-950">
          {proposalValue > 0 ? `Rp ${proposalValue.toLocaleString("id-ID")}` : "-"}
        </p>
        <p className="text-[11px] text-slate-500">{proposalRowCount} item RPKP terpilih</p>
      </div>
    </section>
  );
}

function DataSekolahSummaryCard({ profile }: { profile: SchoolProfileRecord }) {
  const infoCard = "rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3";
  const totalKk = profile.concentrations.length;
  const totalRombelAll = profile.concentrations.reduce(
    (sum, kk) => sum + (kk.rombel10 ?? 0) + (kk.rombel11 ?? 0) + (kk.rombel12 ?? 0),
    0,
  );
  const totalSiswaAll = profile.concentrations.reduce(
    (sum, kk) => sum + (kk.student10 ?? 0) + (kk.student11 ?? 0) + (kk.student12 ?? 0),
    0,
  );

  return (
    <PerItemSectionCard
      title="Data Sekolah"
      description="Identitas utama sekolah beserta ringkasan jumlah konsentrasi keahlian, rombongan belajar, dan total siswa."
      icon={<AlertCircle className="h-5 w-5 text-primary" />}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-950">Identitas Sekolah</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className={infoCard}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">NPSN</p>
              <p className="mt-1 text-sm font-semibold font-mono text-slate-950">{profile.npsn}</p>
            </div>
            <div className={infoCard}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Nama Sekolah</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{profile.schoolName}</p>
            </div>
            <div className={infoCard}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Provinsi</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{profile.province}</p>
            </div>
            <div className={infoCard}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kabupaten / Kota</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{profile.city}</p>
            </div>
            <div className={infoCard + " md:col-span-2"}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Alamat</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">{profile.address}</p>
            </div>
            <div className={infoCard}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kepala Sekolah</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{profile.principalName}</p>
              <p className="mt-0.5 text-xs text-slate-500">{profile.principalPhone || "-"}</p>
            </div>
            <div className={infoCard}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Wakasek Sarpras</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {profile.vicePrincipalFacilitiesName || "-"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {profile.vicePrincipalFacilitiesPhone || "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              Total KK
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{totalKk}</p>
            <p className="mt-0.5 text-xs text-slate-500">konsentrasi keahlian aktif</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              Total Rombongan Belajar
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{totalRombelAll}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              dari data profil {profile.totalRombel} rombel
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Total Siswa
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totalSiswaAll.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              dari data profil {profile.totalStudents.toLocaleString("id-ID")} siswa
            </p>
          </div>
        </div>
      </div>
    </PerItemSectionCard>
  );
}

function GenericRowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">
        Data kosong.
      </div>
    );
  }
  const cols = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      for (const k of Object.keys(row)) set.add(k);
      return set;
    }, new Set()),
  ).slice(0, 12);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-left">
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600 border-b border-slate-200"
              >
                {humanizeColumnName(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, idx) => (
            <tr key={idx} className="border-b border-slate-100 last:border-b-0">
              {cols.map((c) => (
                <td
                  key={c}
                  className="px-3 py-2 align-top text-slate-700 border-r border-slate-50 last:border-r-0"
                >
                  {renderScalar(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 ? (
        <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50/60 border-t border-slate-200">
          Menampilkan 50 baris pertama dari total {rows.length}.
        </div>
      ) : null}
    </div>
  );
}

function renderScalar(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-400">-</span>;
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString("id-ID");
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          <FileDown className="h-3 w-3" />
          Lihat
        </a>
      );
    }
    return <span className="whitespace-pre-wrap leading-5">{value}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-4 space-y-0.5">
        {value.slice(0, 5).map((v, i) => (
          <li key={i}>{renderScalar(v)}</li>
        ))}
        {value.length > 5 ? <li className="text-slate-400">+{value.length - 5} item lagi</li> : null}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-700">
        {JSON.stringify(value, null, 1)}
      </pre>
    );
  }
  return String(value);
}

function humanizeTableName(input: string) {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function humanizeColumnName(input: string) {
  if (!input) return "-";
  return input
    .replace(/[_\s]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function PerItemSectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6">
      <header className="mb-5 flex items-start gap-3">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-600 leading-6">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function StatusButtonGroup({
  status,
  onChange,
}: {
  status: ReviewItemStatus;
  onChange: (next: ReviewItemStatus) => void;
}) {
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange("approved")}
        className={cn(
          "gap-1.5 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
          status === "approved" ? "ring-2 ring-emerald-300 border-emerald-400" : "",
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange("pending")}
        className={cn(
          "gap-1.5 border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
          status === "pending" ? "ring-2 ring-sky-300 border-sky-400" : "",
        )}
      >
        <Clock4 className="h-3.5 w-3.5" />
        Pending
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange("rejected")}
        className={cn(
          "gap-1.5 border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
          status === "rejected" ? "ring-2 ring-rose-300 border-rose-400" : "",
        )}
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </Button>
    </>
  );
}
