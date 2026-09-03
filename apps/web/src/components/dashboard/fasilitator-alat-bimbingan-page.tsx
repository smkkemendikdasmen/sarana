"use client";

import { CalendarDays, CheckCircle2, ChevronRight, Clock4, ClipboardCheck, FileSearch, HardHat, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  upsertWorkspaceBimtekReviewRequest,
  workspaceAssignmentsRequest,
  workspaceBimtekReviewsRequest,
  workspaceSchoolProposalsBySchoolIdsRequest,
  type WorkspaceAssignmentRecord,
  type WorkspaceSchoolProposalData,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import {
  buildFacilitatorSchoolTaskRows,
  buildSchoolProposalBundleFromWorkspaceData,
  createEmptyBimtekReviewRecord,
  filterAssignmentsForEquipmentFacilitator,
  formatWorkspaceDateTime,
  normalizeUserName,
  type BimtekDocumentKey,
  type BimtekDocumentReviewStatus,
  type BimtekReviewRecord,
  type FacilitatorSchoolTaskRow,
} from "@/lib/facilitator-workspace";
import { assignmentTabs, type TaskAssignmentRecord } from "@/lib/task-assignments";
import { fetchCachedVerifikasiReviews } from "@/lib/school-verifikasi-cache";
import { useAuthStore } from "@/store/auth-store";

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

type SchoolDirectoryEntry = {
  id: string;
  npsn: string;
  name: string;
};

type BimtekSchoolRow = FacilitatorSchoolTaskRow & {
  schoolId: string | null;
  bundle: ReturnType<typeof buildSchoolProposalBundleFromWorkspaceData>;
  review: BimtekReviewRecord;
};

const documentTabOptions: Array<{ key: BimtekDocumentKey; label: string }> = [
  { key: "survey", label: "Survey Harga" },
  { key: "rpkp", label: "RPKP" },
  { key: "rab", label: "RAB" },
];

const reviewStatusOptions: Array<{ value: BimtekDocumentReviewStatus; label: string }> = [
  { value: "pending", label: "Menunggu Review" },
  { value: "revisi", label: "Perlu Revisi" },
  { value: "approved", label: "Approved" },
];

export function FacilitatorAlatBimbinganPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [assignments, setAssignments] = useState<TaskAssignmentRecord[]>([]);
  const [reviews, setReviews] = useState<BimtekReviewRecord[]>([]);
  const [schools, setSchools] = useState<SchoolDirectoryEntry[]>([]);
  const [proposalBundles, setProposalBundles] = useState<Record<string, WorkspaceSchoolProposalData>>({});
  const [search, setSearch] = useState("");
  const [activeRow, setActiveRow] = useState<BimtekSchoolRow | null>(null);
  const [activeDocument, setActiveDocument] = useState<BimtekDocumentKey>("survey");
  const [reviewDraft, setReviewDraft] = useState<BimtekReviewRecord | null>(null);
  const [verifikasiReviews, setVerifikasiReviews] = useState<Record<string, WorkspaceVerifikasiOnlineRecord>>({});
  const [wawancaraByNpsn, setWawancaraByNpsn] = useState<Record<string, WorkspaceAssignmentRecord>>({});
  const [praBimtekByNpsn, setPraBimtekByNpsn] = useState<Record<string, WorkspaceAssignmentRecord>>({});
  const [commentDraft, setCommentDraft] = useState<
    Record<string, { alat: string; admin: string; saving: boolean; saveStatus: "idle" | "success" | "error" }>
  >({});

  const isFA = useMemo(() => session?.user.role === "FASILITATOR_ADMINISTRASI", [session?.user.role]);

  const updateCommentDraft = (npsn: string, field: "alat" | "admin", value: string) => {
    setCommentDraft((prev) => ({
      ...prev,
      [npsn]: {
        alat: field === "alat" ? value : (prev[npsn]?.alat ?? ""),
        admin: field === "admin" ? value : (prev[npsn]?.admin ?? ""),
        saving: prev[npsn]?.saving ?? false,
        saveStatus: prev[npsn]?.saveStatus ?? "idle",
      },
    }));
  };

  const saveComment = async (row: BimtekSchoolRow) => {
    const token = session?.token;
    if (!token) return;

    const npsn = row.schoolNpsn;
    const draft = commentDraft[npsn];

    const commentValue = isFA
      ? (draft?.admin ?? row.review.fasilAdminComment ?? "")
      : (draft?.alat ?? row.review.fasilAlatComment ?? "");

    setCommentDraft((prev) => ({
      ...prev,
      [npsn]: {
        alat: prev[npsn]?.alat ?? row.review.fasilAlatComment ?? "",
        admin: prev[npsn]?.admin ?? row.review.fasilAdminComment ?? "",
        saving: true,
        saveStatus: "idle",
      },
    }));

    try {
      const payload: BimtekReviewRecord = {
        ...row.review,
        ...(isFA
          ? { fasilAdminComment: commentValue, fasilAlatComment: null }
          : { fasilAlatComment: commentValue, fasilAdminComment: null }),
        updatedAt: new Date().toISOString(),
      };

      await upsertWorkspaceBimtekReviewRequest(token, payload);

      setReviews((prev) =>
        prev.map((r) =>
          r.schoolNpsn === npsn
            ? {
                ...r,
                ...(isFA
                  ? { fasilAdminComment: commentValue }
                  : { fasilAlatComment: commentValue }),
                updatedAt: payload.updatedAt,
              }
            : r,
        ),
      );

      setCommentDraft((prev) => ({
        ...prev,
        [npsn]: {
          alat: isFA ? (prev[npsn]?.alat ?? "") : commentValue,
          admin: isFA ? commentValue : (prev[npsn]?.admin ?? ""),
          saving: false,
          saveStatus: "success",
        },
      }));

      setTimeout(() => {
        setCommentDraft((prev2) => {
          if (!prev2[npsn]) return prev2;
          return { ...prev2, [npsn]: { ...prev2[npsn], saveStatus: "idle" } };
        });
      }, 2500);
    } catch (err) {
      console.error(err);
      setCommentDraft((prev) => ({
        ...prev,
        [npsn]: {
          alat: prev[npsn]?.alat ?? "",
          admin: prev[npsn]?.admin ?? "",
          saving: false,
          saveStatus: "error",
        },
      }));
    }
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) {
      return;
    }

    let cancelled = false;
    async function loadData() {
      const token = session?.token;
      if (!token) {
        return;
      }

      try {
        const basePromises: Promise<unknown>[] = [
          workspaceAssignmentsRequest(token, {
            moduleKey: "bimbingan-teknis",
            ...(isFA
              ? {
                  facilitatorAdministrationId: session?.user?.id || undefined,
                  facilitatorAdministrationName: session?.user?.fullName || undefined,
                }
              : {
                  facilitatorEquipmentId: session?.user?.id || undefined,
                  facilitatorEquipmentName: session?.user?.fullName || undefined,
                }),
          }),
          workspaceBimtekReviewsRequest(token),
          adminUsersRequest(),
        ];
        if (isFA) {
          basePromises.push(fetchCachedVerifikasiReviews(token));
          basePromises.push(workspaceAssignmentsRequest(token, { moduleKey: "wawancara" }));
          basePromises.push(workspaceAssignmentsRequest(token, { moduleKey: "pra-bimtek" }));
        }
        const [assignmentPayload, reviewPayload, schoolResponse, verifikasiPayload, wawancaraPayload, praBimtekPayload] =
          await Promise.all(basePromises);

        const schoolsPayload = (schoolResponse as { schools: Array<{ id: string; npsn: string; name: string }> }).schools.map(
          (school) => ({
            id: school.id,
            npsn: school.npsn,
            name: school.name,
          }),
        );
        const schoolIdByNpsn = new Map(schoolsPayload.map((school) => [school.npsn, school.id]));
        const assignmentTyped = assignmentPayload as TaskAssignmentRecord[];
        const schoolIds = assignmentTyped
          .map((assignment) => schoolIdByNpsn.get(assignment.schoolNpsn) ?? "")
          .filter(Boolean);
        const proposalPayload = await workspaceSchoolProposalsBySchoolIdsRequest(token, schoolIds);

        if (!cancelled) {
          setAssignments(assignmentTyped);
          setReviews(reviewPayload as BimtekReviewRecord[]);
          setSchools(schoolsPayload);
          setProposalBundles(proposalPayload);
          if (isFA) {
            const verifikasiMap: Record<string, WorkspaceVerifikasiOnlineRecord> = {};
            for (const row of (verifikasiPayload as WorkspaceVerifikasiOnlineRecord[]) ?? []) {
              if (row?.schoolNpsn) verifikasiMap[row.schoolNpsn] = row;
            }
            setVerifikasiReviews(verifikasiMap);
            const wMap: Record<string, WorkspaceAssignmentRecord> = {};
            for (const row of (wawancaraPayload as WorkspaceAssignmentRecord[]) ?? []) {
              if (row?.schoolNpsn) wMap[row.schoolNpsn] = row;
            }
            setWawancaraByNpsn(wMap);
            const pMap: Record<string, WorkspaceAssignmentRecord> = {};
            for (const row of (praBimtekPayload as WorkspaceAssignmentRecord[]) ?? []) {
              if (row?.schoolNpsn) pMap[row.schoolNpsn] = row;
            }
            setPraBimtekByNpsn(pMap);
          }
        }
      } catch {
        if (!cancelled) {
          setAssignments([]);
          setReviews([]);
          setSchools([]);
          setProposalBundles({});
          if (isFA) {
            setVerifikasiReviews({});
            setWawancaraByNpsn({});
            setPraBimtekByNpsn({});
          }
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token, isFA]);

  const schoolIdByNpsn = useMemo(
    () => new Map(schools.map((school) => [school.npsn, school.id])),
    [schools],
  );

  const filteredAssignments = useMemo(() => {
    const facilitatorId = session?.user.id ?? "";
    const facilitatorName = session?.user.fullName ?? "";
    const normalizedName = normalizeUserName(facilitatorName);

    if (isFA) {
      return assignments.filter((record) => {
        if (record.moduleKey !== "bimbingan-teknis") return false;
        if (facilitatorId && record.facilitatorAdministrationId === facilitatorId) return true;
        if (normalizedName && normalizeUserName(record.facilitatorAdministrationName) === normalizedName)
          return true;
        return false;
      });
    }

    return filterAssignmentsForEquipmentFacilitator(assignments, facilitatorId, facilitatorName, "bimbingan-teknis");
  }, [assignments, isFA, session?.user.fullName, session?.user.id]);

  const reviewBySchoolNpsn = useMemo(
    () => new Map(reviews.map((item) => [item.schoolNpsn, item])),
    [reviews],
  );

  const rows = useMemo(() => {
    const facilitatorId = session?.user.id ?? "";
    const facilitatorName = session?.user.fullName ?? "";

    return buildFacilitatorSchoolTaskRows(filteredAssignments).map((row) => {
      const schoolId = schoolIdByNpsn.get(row.schoolNpsn) ?? null;
      const npsn = row.schoolNpsn;
      const bundle = buildSchoolProposalBundleFromWorkspaceData(schoolId, npsn ? proposalBundles[npsn] : undefined);
      const review =
        reviewBySchoolNpsn.get(row.schoolNpsn) ??
        createEmptyBimtekReviewRecord(row.schoolNpsn, row.schoolName, facilitatorId, facilitatorName);

      return {
        ...row,
        schoolId,
        bundle,
        review,
      };
    });
  }, [filteredAssignments, proposalBundles, reviewBySchoolNpsn, schoolIdByNpsn, session?.user.fullName, session?.user.id]);

  const visibleRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      [row.schoolNpsn, row.schoolName, row.facilitatorAdministrationName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [rows, search]);

  useEffect(() => {
    setCommentDraft((prev) => {
      const next: typeof prev = { ...prev };
      for (const row of rows) {
        const existing = next[row.schoolNpsn];
        next[row.schoolNpsn] = {
          alat: existing?.alat ?? row.review.fasilAlatComment ?? "",
          admin: existing?.admin ?? row.review.fasilAdminComment ?? "",
          saving: existing?.saving ?? false,
          saveStatus: existing?.saveStatus ?? "idle",
        };
      }
      return next;
    });
  }, [rows]);

  const approvedSchoolsCount = rows.filter((row) => isAllDocumentsApproved(row.review)).length;
  const readyDocumentCount = rows.filter((row) => (row.bundle?.surveyItemCount ?? 0) > 0).length;

  function openReviewModal(row: BimtekSchoolRow) {
    setActiveRow(row);
    setActiveDocument("survey");
    setReviewDraft(row.review);
  }

  async function saveReviewDraft() {
    if (!reviewDraft || !session?.token) {
      return;
    }

    const nextRecord = {
      ...reviewDraft,
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertWorkspaceBimtekReviewRequest(session.token, nextRecord);
      setReviews((current) => {
        const next = new Map(current.map((item) => [item.schoolNpsn, item]));
        next.set(nextRecord.schoolNpsn, nextRecord);
        return Array.from(next.values());
      });
      setReviewDraft(nextRecord);
    } catch {
      return;
    }
  }

  async function approveActiveDocument() {
    if (!reviewDraft || !session?.token) {
      return;
    }

    const nextRecord = {
      ...reviewDraft,
      statuses: {
        ...reviewDraft.statuses,
        [activeDocument]: "approved" as BimtekDocumentReviewStatus,
      },
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertWorkspaceBimtekReviewRequest(session.token, nextRecord);
      setReviews((current) => {
        const next = new Map(current.map((item) => [item.schoolNpsn, item]));
        next.set(nextRecord.schoolNpsn, nextRecord);
        return Array.from(next.values());
      });
      setReviewDraft(nextRecord);
    } catch {
      return;
    }
  }

  const activeBundle = activeRow?.bundle ?? null;
  const activeSurveyRows =
    activeBundle?.concentrations.flatMap((item) =>
      item.surveyRows.map((row) => ({ concentrationCode: item.concentrationCode, ...row })),
    ) ?? [];
  const activeRpkpRows =
    activeBundle?.concentrations.flatMap((item) =>
      item.rpkpRows.map((row) => ({ concentrationCode: item.concentrationCode, ...row })),
    ) ?? [];
  const activeRabRows =
    activeBundle?.concentrations.flatMap((item) =>
      item.rabRows.map((row) => ({ concentrationCode: item.concentrationCode, ...row })),
    ) ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Sekolah" value={`${rows.length}`} helper="Penugasan bimtek aktif" icon={<HardHat className="h-4 w-4" />} />
        <SummaryCard label="Dokumen Siap Review" value={`${readyDocumentCount}`} helper="Minimal ada data survey sekolah" icon={<FileSearch className="h-4 w-4" />} />
        <SummaryCard label="Selesai Approve" value={`${approvedSchoolsCount}`} helper="Semua dokumen sudah approved" icon={<CheckCircle2 className="h-4 w-4" />} />
        <SummaryCard label="Butuh Tindak Lanjut" value={`${Math.max(rows.length - approvedSchoolsCount, 0)}`} helper="Masih pending atau revisi" icon={<ClipboardCheck className="h-4 w-4" />} />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">
                {isFA ? "List Sekolah Bimtek" : "List Sekolah Bimbingan Teknis"}
              </CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {isFA ? (
                  <>Status kumulatif per tahapan untuk sekolah dampingan.</>
                ) : (
                  <>
                    Aksi <span className="font-semibold text-slate-900">Review & Approve</span> membuka modal untuk cek
                    dokumen <span className="font-semibold text-slate-900">Survey Harga</span>,{" "}
                    <span className="font-semibold text-slate-900">RPKP</span>, dan{" "}
                    <span className="font-semibold text-slate-900">RAB</span>.
                  </>
                )}
              </p>
            </div>
            <label className="grid gap-2 text-sm text-slate-600 lg:w-[340px]">
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
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className={`w-full text-sm ${isFA ? "min-w-[1160px]" : "min-w-[1120px]"}`}>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {isFA ? (
                  <tr className="border-b border-slate-200">
                    <th className="w-16 px-4 py-3">No</th>
                    <th className="px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Sekolah</th>
                    <th className="px-4 py-3">Verifikasi</th>
                    <th className="px-4 py-3">Wawancara</th>
                    <th className="px-4 py-3">Pra Bimtek</th>
                    <th className="px-4 py-3">Bimtek</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                ) : (
                  <tr className="border-b border-slate-200">
                    <th className="w-16 px-4 py-3">No</th>
                    <th className="px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="px-4 py-3">Sumber</th>
                    <th className="px-4 py-3">Survey</th>
                    <th className="px-4 py-3">RPKP</th>
                    <th className="px-4 py-3">RAB</th>
                    <th className="px-4 py-3">Status Review</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={isFA ? 8 : 9} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada sekolah {isFA ? "bimtek" : "bimbingan teknis"} yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, index) =>
                    isFA ? (
                      <tr
                        key={row.assignmentKey}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 text-slate-700">{index + 1}</td>
                        <td className="px-4 py-4 font-mono font-bold text-slate-950 tabular-nums">{row.schoolNpsn}</td>
                        <td className="px-4 py-4 text-slate-700">{row.schoolName}</td>
                        <td className="px-4 py-4">
                          {renderVerifikasiBadge(verifikasiReviews[row.schoolNpsn])}
                        </td>
                        <td className="px-4 py-4">
                          {renderScheduledBadge(
                            wawancaraByNpsn[row.schoolNpsn]?.interviewScheduledDate ?? null,
                            wawancaraByNpsn[row.schoolNpsn]?.interviewScheduledTime ?? null,
                            false,
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {renderPraBimtekStatusBadge(
                            praBimtekByNpsn[row.schoolNpsn]?.praBimtekScheduledDate ?? null,
                            praBimtekByNpsn[row.schoolNpsn]?.praBimtekScheduledTime ?? null,
                            praBimtekByNpsn[row.schoolNpsn]?.praBimtekStatus ?? null,
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {renderBimtekStatusBadge(
                            (row.records[0] as unknown as WorkspaceAssignmentRecord) ??
                              ({} as WorkspaceAssignmentRecord),
                            row.review,
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            asChild
                            className="gap-1.5 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 h-8 px-3 text-xs font-semibold"
                          >
                            <Link
                              href={`/fasilitator-administrasi/bimbingan-teknis/${encodeURIComponent(row.schoolNpsn)}`}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              Detail
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.assignmentKey}>
                        <td className="px-4 py-4 text-slate-700">{index + 1}</td>
                        <td className="px-4 py-4 font-medium text-slate-950">{row.schoolNpsn}</td>
                        <td className="px-4 py-4 text-slate-700">{row.schoolName}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {row.sourceTabs.map((tabKey) => (
                              <Badge key={tabKey} variant="outline">
                                {assignmentTabs.find((tab) => tab.key === tabKey)?.label ?? tabKey}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {renderDocumentCell(row.bundle?.surveyItemCount ?? 0, row.review.statuses.survey)}
                        </td>
                        <td className="px-4 py-4">
                          {renderDocumentCell(row.bundle?.rpkpItemCount ?? 0, row.review.statuses.rpkp)}
                        </td>
                        <td className="px-4 py-4">
                          {renderDocumentCell(row.bundle?.rabItemCount ?? 0, row.review.statuses.rab)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={isAllDocumentsApproved(row.review) ? "success" : "warning"}>
                            {isAllDocumentsApproved(row.review) ? "Selesai" : "Tindak Lanjut"}
                          </Badge>
                          <p className="mt-1 text-xs text-slate-500">{formatWorkspaceDateTime(row.review.updatedAt)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            type="button"
                            size="sm"
                            asChild
                            className="gap-1.5 h-8 px-3 text-xs font-semibold"
                          >
                            <Link
                              href={`/fasilitator-alat/bimbingan-teknis/${encodeURIComponent(row.schoolNpsn)}`}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              Detail
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {activeRow && reviewDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Review Dokumen Bimtek</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{activeRow.schoolName}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  NPSN {activeRow.schoolNpsn} • Fasilitator Adm: {activeRow.facilitatorAdministrationName || "-"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveRow(null)}>
                Tutup
              </Button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Survey Harga" value={`${activeBundle?.surveyItemCount ?? 0}`} helper="Total item dokumen survey" icon={<FileSearch className="h-4 w-4" />} />
                <SummaryCard label="RPKP" value={`${activeBundle?.rpkpItemCount ?? 0}`} helper="Total item dokumen RPKP" icon={<ClipboardCheck className="h-4 w-4" />} />
                <SummaryCard label="RAB" value={`${activeBundle?.rabItemCount ?? 0}`} helper="Total item dokumen RAB" icon={<HardHat className="h-4 w-4" />} />
                <SummaryCard label="Status Overall" value={isAllDocumentsApproved(reviewDraft) ? "Selesai" : "Proses"} helper="Status review seluruh dokumen" icon={<CheckCircle2 className="h-4 w-4" />} />
              </section>

              <section className="flex flex-wrap gap-3">
                {documentTabOptions.map((tab) => {
                  const active = activeDocument === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveDocument(tab.key)}
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

              <Card className="rounded-[24px]">
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="grid gap-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">Status Dokumen</span>
                    <select
                      value={reviewDraft.statuses[activeDocument]}
                      onChange={(event) =>
                        setReviewDraft((current) =>
                          current
                            ? {
                                ...current,
                                statuses: {
                                  ...current.statuses,
                                  [activeDocument]: event.target.value as BimtekDocumentReviewStatus,
                                },
                              }
                            : current,
                        )
                      }
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                    >
                      {reviewStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">Catatan Review</span>
                    <textarea
                      value={reviewDraft.notes[activeDocument]}
                      onChange={(event) =>
                        setReviewDraft((current) =>
                          current
                            ? {
                                ...current,
                                notes: {
                                  ...current.notes,
                                  [activeDocument]: event.target.value,
                                },
                              }
                            : current,
                        )
                      }
                      rows={3}
                      placeholder="Tulis catatan hasil review, koreksi, atau catatan approval..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary"
                    />
                  </label>
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    Dokumen {documentTabOptions.find((item) => item.key === activeDocument)?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(activeDocument === "survey" && activeSurveyRows.length === 0) ||
                  (activeDocument === "rpkp" && activeRpkpRows.length === 0) ||
                  (activeDocument === "rab" && activeRabRows.length === 0) ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      Dokumen untuk tab ini belum tersedia di database sekolah tersebut.
                    </div>
                  ) : activeDocument === "survey" ? (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-[1200px] w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-3">Konsentrasi</th>
                            <th className="px-4 py-3">Nama Alat</th>
                            <th className="px-4 py-3">Spesifikasi</th>
                            <th className="px-4 py-3">Jumlah</th>
                            <th className="px-4 py-3">Toko 1</th>
                            <th className="px-4 py-3">Toko 2</th>
                            <th className="px-4 py-3">Toko 3</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {activeSurveyRows.map((row) => (
                            <tr key={`survey-${row.concentrationCode}-${row.id}`}>
                              <td className="px-4 py-4 text-slate-700">{row.concentrationCode}</td>
                              <td className="px-4 py-4 font-medium text-slate-950">{row.name || "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.specification || "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.quantity || "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.shop1.totalPrice ? `Rp ${row.shop1.totalPrice}` : "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.shop2.totalPrice ? `Rp ${row.shop2.totalPrice}` : "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.shop3.totalPrice ? `Rp ${row.shop3.totalPrice}` : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : activeDocument === "rpkp" ? (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-[1100px] w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-3">Konsentrasi</th>
                            <th className="px-4 py-3">Nama Alat</th>
                            <th className="px-4 py-3">Spesifikasi</th>
                            <th className="px-4 py-3">Toko Dipilih</th>
                            <th className="px-4 py-3">Estimasi</th>
                            <th className="px-4 py-3">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {activeRpkpRows.map((row) => (
                            <tr key={`rpkp-${row.concentrationCode}-${row.id}`}>
                              <td className="px-4 py-4 text-slate-700">{row.concentrationCode}</td>
                              <td className="px-4 py-4 font-medium text-slate-950">{row.name || "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.specification || "-"}</td>
                              <td className="px-4 py-4 text-slate-700">{row.selectedShop.toUpperCase()}</td>
                              <td className="px-4 py-4 text-slate-700">
                                {row.selectedQuote.totalPrice ? `Rp ${row.selectedQuote.totalPrice}` : "-"}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {row.selectedQuote.link ? (
                                  <a
                                    href={row.selectedQuote.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-primary underline-offset-2 hover:underline"
                                  >
                                    Buka Link
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-[960px] w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-3">Konsentrasi</th>
                            <th className="px-4 py-3">Nama Alat</th>
                            <th className="px-4 py-3">Harga Satuan</th>
                            <th className="px-4 py-3">Kuantitas</th>
                            <th className="px-4 py-3">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {activeRabRows.map((row) => (
                            <tr key={`rab-${row.concentrationCode}-${row.id}`}>
                              <td className="px-4 py-4 text-slate-700">{row.concentrationCode}</td>
                              <td className="px-4 py-4 font-medium text-slate-950">{row.name || "-"}</td>
                              <td className="px-4 py-4 text-slate-700">
                                {row.unitPrice > 0 ? `Rp ${row.unitPrice.toLocaleString("id-ID")}` : "-"}
                              </td>
                              <td className="px-4 py-4 text-slate-700">{row.quantity > 0 ? row.quantity : "-"}</td>
                              <td className="px-4 py-4 text-slate-700">
                                {row.totalPrice > 0 ? `Rp ${row.totalPrice.toLocaleString("id-ID")}` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={saveReviewDraft}>
                  Simpan Review
                </Button>
                <Button type="button" onClick={approveActiveDocument}>
                  Approve Dokumen
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isAllDocumentsApproved(review: BimtekReviewRecord) {
  return review.statuses.survey === "approved" && review.statuses.rpkp === "approved" && review.statuses.rab === "approved";
}

function renderVerifikasiBadge(record: WorkspaceVerifikasiOnlineRecord | undefined) {
  let status: ReviewItemStatus = null;
  if (record?.approvedAdmin === true) status = "approved";
  else if (record?.approvedAdmin === false) status = "rejected";
  else if (record?.reviewedAdminAt) status = "pending";
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock4;
  return (
    <Badge className={reviewStatusVariant(status)} variant="outline">
      <span className="mr-1.5 inline-flex">
        <Icon className="h-3 w-3" />
      </span>
      {reviewStatusLabel(status)}
    </Badge>
  );
}

function renderScheduledBadge(date: string | null, time: string | null, defaultApprovedIfEmpty = false) {
  const formattedDate = formatDateId(date);
  const formattedTime = formatTimeId(time);
  if (!formattedDate) {
    if (defaultApprovedIfEmpty) {
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <span className="mr-1.5 inline-flex">
            <CheckCircle2 className="h-3 w-3" />
          </span>
          Disetujui
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-dashed border-slate-300 bg-slate-50 text-slate-600">
        <span className="mr-1.5 inline-flex">
          <Clock4 className="h-3 w-3" />
        </span>
        Belum dijadwalkan
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
      <span className="mr-1.5 inline-flex">
        <CalendarDays className="h-3 w-3" />
      </span>
      {formattedDate}
      {formattedTime ? <> · {formattedTime}</> : null}
    </Badge>
  );
}

function renderPraBimtekStatusBadge(date: string | null, time: string | null, status: string | null) {
  const formattedDate = formatDateId(date);
  const formattedTime = formatTimeId(time);
  if (status === "COMPLETED" || status === "APPROVED") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        <span className="mr-1.5 inline-flex">
          <CheckCircle2 className="h-3 w-3" />
        </span>
        Selesai {formattedDate ? `· ${formattedDate}` : ""}
      </Badge>
    );
  }
  if (formattedDate) {
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        <span className="mr-1.5 inline-flex">
          <CalendarDays className="h-3 w-3" />
        </span>
        {formattedDate}
        {formattedTime ? <> · {formattedTime}</> : null}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
      <span className="mr-1.5 inline-flex">
        <CheckCircle2 className="h-3 w-3" />
      </span>
      Disetujui
    </Badge>
  );
}

function renderBimtekStatusBadge(assignment: WorkspaceAssignmentRecord, review: BimtekReviewRecord) {
  const date = formatDateId(assignment?.bimtekScheduledDate ?? null);
  const location = assignment?.bimtekLocation;
  const status = assignment?.bimtekStatus;
  if (isAllDocumentsApproved(review)) {
    return (
      <Badge variant="success">
        <span className="mr-1.5 inline-flex">
          <CheckCircle2 className="h-3 w-3" />
        </span>
        Selesai
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge variant="success">
        <span className="mr-1.5 inline-flex">
          <CheckCircle2 className="h-3 w-3" />
        </span>
        Selesai {date ? `· ${date}` : ""}
      </Badge>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <Badge variant="warning">
        <span className="mr-1.5 inline-flex">
          <Clock4 className="h-3 w-3" />
        </span>
        Dalam Proses {date ? `· ${date}` : ""}
      </Badge>
    );
  }
  if (status === "SCHEDULED" || date) {
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        <span className="mr-1.5 inline-flex">
          <CalendarDays className="h-3 w-3" />
        </span>
        {date}
        {location ? ` · ${location}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-dashed border-slate-300 bg-slate-50 text-slate-600">
      <span className="mr-1.5 inline-flex">
        <Clock4 className="h-3 w-3" />
      </span>
      Tindak Lanjut
    </Badge>
  );
}

function renderDocumentCell(itemCount: number, status: BimtekDocumentReviewStatus) {
  if (itemCount === 0) {
    return <Badge variant="secondary">Belum Ada Data</Badge>;
  }

  if (status === "approved") {
    return <Badge variant="success">{itemCount} item • Approved</Badge>;
  }

  if (status === "revisi") {
    return <Badge variant="danger">{itemCount} item • Revisi</Badge>;
  }

  return <Badge variant="warning">{itemCount} item • Menunggu</Badge>;
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
