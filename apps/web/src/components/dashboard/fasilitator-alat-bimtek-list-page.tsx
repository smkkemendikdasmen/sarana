"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  workspaceAssignmentsRequest,
  workspaceBimtekReviewsRequest,
  type WorkspaceAssignmentRecord,
  type WorkspaceBimtekReviewRecord,
} from "@/lib/api";
import {
  buildFacilitatorSchoolTaskRows,
  filterAssignmentsForEquipmentFacilitator,
  type BimtekDocumentReviewStatus,
  type FacilitatorSchoolTaskRow,
} from "@/lib/facilitator-workspace";
import { useAuthStore } from "@/store/auth-store";

type ModuleKey = "wawancara" | "pra-bimtek" | "bimbingan-teknis";
type ReviewStatus = "approved" | "rejected" | "revisi" | "pending" | "in-progress";

function reviewBadgeVariant(status: ReviewStatus | null | undefined): string {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected" || status === "revisi") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "pending" || status === "in-progress") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

function reviewBadgeLabel(status: ReviewStatus | null | undefined, hasAny: boolean): string {
  if (!hasAny) return "Belum ada";
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  if (status === "revisi") return "Perlu Revisi";
  if (status === "pending") return "Pending";
  if (status === "in-progress") return "Sedang diproses";
  return "Belum dinilai";
}

function pickBestStatus(values: Array<ReviewStatus | null | undefined>): ReviewStatus | null {
  const orderAsc: Array<ReviewStatus> = ["approved", "rejected", "revisi", "in-progress", "pending"];
  let best: ReviewStatus | null = null;
  for (const v of values) {
    if (!v) continue;
    if (best === null) {
      best = v;
      continue;
    }
    if (orderAsc.indexOf(v) < orderAsc.indexOf(best)) best = v;
  }
  return best;
}

function moduleStatusFromAssignments(
  schoolNpsn: string,
  assignments: WorkspaceAssignmentRecord[],
  moduleKey: ModuleKey,
): { status: ReviewStatus | null; hasAssignment: boolean; hasAnyProgress: boolean } {
  const matches = assignments.filter((a) => a.schoolNpsn === schoolNpsn && a.moduleKey === moduleKey);
  const hasAssignment = matches.length > 0;
  if (!hasAssignment) return { status: null, hasAssignment: false, hasAnyProgress: false };
  let hasProgress = false;
  for (const m of matches) {
    if (
      m.interviewScheduledDate ||
      m.interviewScheduledTime ||
      m.interviewMeetingLink ||
      m.praBimtekScheduledDate ||
      m.praBimtekScheduledTime ||
      m.praBimtekMeetingLink ||
      m.bimtekScheduledDate ||
      m.bimtekLocation ||
      (typeof (m as unknown as Record<string, unknown>).reviewStatus === "string" && (m as unknown as { reviewStatus: string }).reviewStatus.length > 0)
    ) {
      hasProgress = true;
      break;
    }
  }
  const reviewStatuses = matches
    .map((m) => (m as unknown as { reviewStatus?: ReviewStatus }).reviewStatus ?? null)
    .filter(Boolean) as ReviewStatus[];
  const best = pickBestStatus(reviewStatuses);
  return { status: best, hasAssignment: true, hasAnyProgress: hasProgress || best !== null };
}

export function FacilitatorAlatBimtekListPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<FacilitatorSchoolTaskRow[]>([]);
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [bimtekReviews, setBimtekReviews] = useState<WorkspaceBimtekReviewRecord[]>([]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) return;
    let cancelled = false;
    async function loadData() {
      try {
        const token = session!.token!;
        const [wawancara, praBimtek, bimtek, bimtekReviewList, schoolResp] = await Promise.all([
          workspaceAssignmentsRequest(token, { moduleKey: "wawancara" }),
          workspaceAssignmentsRequest(token, { moduleKey: "pra-bimtek" }),
          workspaceAssignmentsRequest(token, { moduleKey: "bimbingan-teknis" }),
          workspaceBimtekReviewsRequest(token),
          adminUsersRequest(),
        ]);
        if (cancelled) return;
        void schoolResp;
        const facilitatorId = session!.user.id ?? "";
        const facilitatorName = session!.user.fullName ?? "";
        const filteredBimtek = filterAssignmentsForEquipmentFacilitator(
          bimtek,
          facilitatorId,
          facilitatorName,
          "bimbingan-teknis",
        );
        setBimtekReviews(bimtekReviewList);
        setAssignments([
          ...(wawancara || []),
          ...(praBimtek || []),
          ...(bimtek || []),
        ]);
        setRows(buildFacilitatorSchoolTaskRows(filteredBimtek));
      } catch (e) {
        if (!cancelled) {
          console.error("[bimtek-list] loadData failed", e);
          setRows([]);
          setAssignments([]);
        }
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token, session?.user.id, session?.user.fullName]);

  const bimtekReviewByNpsn = useMemo(
    () => new Map(bimtekReviews.map((r) => [r.schoolNpsn, r])),
    [bimtekReviews],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.schoolName.toLowerCase().includes(q) ||
        r.schoolNpsn.includes(q),
    );
  }, [rows, search]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">
            Daftar Sekolah Bimtek — Fasilitator Alat
          </CardTitle>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama sekolah / NPSN..."
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="border-b px-4 py-3 text-left font-semibold w-12">No</th>
                  <th className="border-b px-4 py-3 text-left font-semibold">NPSN</th>
                  <th className="border-b px-4 py-3 text-left font-semibold">Nama Sekolah</th>
                  <th className="border-b px-4 py-3 text-center font-semibold">Wawancara</th>
                  <th className="border-b px-4 py-3 text-center font-semibold">Pra Bimtek</th>
                  <th className="border-b px-4 py-3 text-center font-semibold">Bimtek</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">
                      Belum ada sekolah yang ditugaskan Bimtek untuk Anda.
                    </td>
                  </tr>
                )}
                {filtered.map((row, idx) => {
                  const waw = moduleStatusFromAssignments(row.schoolNpsn, assignments, "wawancara");
                  const pra = moduleStatusFromAssignments(row.schoolNpsn, assignments, "pra-bimtek");
                  const bim = moduleStatusFromAssignments(row.schoolNpsn, assignments, "bimbingan-teknis");
                  const bReview = bimtekReviewByNpsn.get(row.schoolNpsn);
                  let bimStatus: ReviewStatus | null = bim.status;
                  let bimProgress = bim.hasAnyProgress;
                  if (bReview && bReview.statuses) {
                    const docs: Array<BimtekDocumentReviewStatus> = [
                      bReview.statuses.survey,
                      bReview.statuses.rpkp,
                      bReview.statuses.rab,
                    ];
                    const mapDoc: Record<BimtekDocumentReviewStatus, ReviewStatus> = {
                      approved: "approved",
                      revisi: "revisi",
                      pending: "pending",
                    };
                    const mapped = docs.map((d) => mapDoc[d] ?? null);
                    const appr = mapped.filter((d) => d === "approved").length;
                    if (appr === 3) {
                      bimStatus = "approved";
                      bimProgress = true;
                    } else if (mapped.some((d) => d === "revisi")) {
                      bimStatus = "revisi";
                      bimProgress = true;
                    } else if (mapped.some((d) => d === "pending" || d === "in-progress")) {
                      bimStatus = "pending";
                      bimProgress = true;
                    } else {
                      const bestFromDocs = pickBestStatus(mapped);
                      if (bestFromDocs) bimStatus = bestFromDocs;
                    }
                  }
                  const anyBim = bim.hasAssignment || Boolean(bReview);
                  return (
                    <tr
                      key={row.assignmentKey}
                      className="group cursor-pointer transition hover:bg-sky-50"
                      onClick={() => {
                        window.location.assign(`/fasilitator-alat/bimbingan-teknis/${row.schoolNpsn}`);
                      }}
                    >
                      <td className="border-b px-4 py-3 text-slate-500 align-top">{idx + 1}</td>
                      <td className="border-b px-4 py-3 font-mono text-slate-600 align-top">{row.schoolNpsn}</td>
                      <td className="border-b px-4 py-3 align-top">
                        <Link
                          href={`/fasilitator-alat/bimbingan-teknis/${row.schoolNpsn}`}
                          className="text-slate-900 underline-offset-2 hover:underline hover:text-sky-700 font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.schoolName}
                        </Link>
                      </td>
                      <td className="border-b px-4 py-3 align-top text-center">
                        <Badge
                          variant="outline"
                          className={reviewBadgeVariant(waw.status)}
                        >
                          {reviewBadgeLabel(waw.status, waw.hasAssignment)}
                        </Badge>
                      </td>
                      <td className="border-b px-4 py-3 align-top text-center">
                        <Badge
                          variant="outline"
                          className={reviewBadgeVariant(pra.status)}
                        >
                          {reviewBadgeLabel(pra.status, pra.hasAssignment)}
                        </Badge>
                      </td>
                      <td className="border-b px-4 py-3 align-top text-center">
                        <Badge
                          variant="outline"
                          className={reviewBadgeVariant(bimStatus)}
                        >
                          {reviewBadgeLabel(bimStatus, anyBim || bimProgress)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Total sekolah: {filtered.length} · Klik baris / nama sekolah → lihat detail
            Profil · Alat · Pengajuan
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
