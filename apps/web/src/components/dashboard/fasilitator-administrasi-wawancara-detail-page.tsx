"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  schoolProfileByNpsnRequest,
  workspaceAssignmentsRequest,
  workspaceInterviewAssessmentsRequest,
  type InterviewAnswersPayload,
  type SchoolProfileRecord,
  type WorkspaceAssignmentRecord,
  type WorkspaceInterviewAssessmentRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type WawancaraTabPrintId = "print-wawancara-detail";

function formatDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTimeID(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  if (/^\d{2}:\d{2}/.test(timeStr)) return `${timeStr.slice(0, 5)} WIB`;
  return String(timeStr);
}

function formatDateTimeID(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function normalizeAnswerValue(
  val: 1 | 2 | 3 | 4 | 5 | Record<string, unknown>,
): { score: number; subText?: string } {
  if (typeof val === "number") {
    return { score: val };
  }
  if (val && typeof val === "object") {
    const anyVal = val as Record<string, unknown>;
    const score =
      typeof anyVal.score === "number"
        ? anyVal.score
        : typeof anyVal.value === "number"
          ? anyVal.value
          : Number(anyVal.score ?? anyVal.value ?? 0);
    const subText =
      typeof anyVal.note === "string"
        ? anyVal.note
        : typeof anyVal.comment === "string"
          ? anyVal.comment
          : undefined;
    return { score: Number.isFinite(score) ? score : 0, subText };
  }
  return { score: 0 };
}

function scoreLabel(score: number): { label: string; cls: string; dot: string } {
  if (score >= 4.3) return { label: "Sangat Baik", cls: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  if (score >= 3.5) return { label: "Baik", cls: "text-sky-700 bg-sky-50 border-sky-200", dot: "bg-sky-500" };
  if (score >= 2.6) return { label: "Cukup", cls: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" };
  if (score >= 1.6) return { label: "Kurang", cls: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500" };
  return { label: "Sangat Kurang", cls: "text-rose-700 bg-rose-50 border-rose-200", dot: "bg-rose-500" };
}

const INTERVIEW_CRITERIA_HINT: Record<string, { label: string; bobot: number }> = {
  komitmen: { label: "Komitmen & Motivasi Kepala Sekolah", bobot: 15 },
  kepemimpinan: { label: "Kepemimpinan & Manajemen Sekolah", bobot: 15 },
  pemahaman_smk: { label: "Pemahaman Visi-Misi SMK & Link & Match", bobot: 12 },
  kesiswaan: { label: "Kesiswaan & Kedisiplinan", bobot: 10 },
  sarana_ketersediaan: { label: "Ketersediaan Sarana & Prasarana Saat Ini", bobot: 12 },
  rencana_penggunaan: { label: "Rencana Penggunaan & Perawatan Alat", bobot: 13 },
  partisipasi_industri: { label: "Partisipasi Industri / DU/DI", bobot: 12 },
  kesediaan_lahan: { label: "Kesediaan Lahan / Ruang Praktik", bobot: 11 },
};

function criteriaLabelOf(key: string): { label: string; bobot: number } {
  const normalized = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (INTERVIEW_CRITERIA_HINT[key]) return INTERVIEW_CRITERIA_HINT[key];
  for (const [k, v] of Object.entries(INTERVIEW_CRITERIA_HINT)) {
    if (k === normalized || normalized.includes(k) || k.includes(normalized)) {
      return v;
    }
  }
  const titleLabel = key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
  return { label: titleLabel || `Kriteria ${key}`, bobot: 10 };
}

function cloneElementToPrintPortal(printId: WawancaraTabPrintId): void {
  const el = document.getElementById(printId);
  if (!el) return;
  const printContainer = document.getElementById("print-portal-root");
  if (!printContainer) return;
  const clone = el.cloneNode(true) as HTMLElement;
  printContainer.innerHTML = "";
  printContainer.appendChild(clone);
}

function clearPrintPortal(): void {
  const printContainer = document.getElementById("print-portal-root");
  if (printContainer) printContainer.innerHTML = "";
}

function handleWindowPrint(printId: WawancaraTabPrintId): void {
  cloneElementToPrintPortal(printId);
  window.print();
  window.setTimeout(() => {
    clearPrintPortal();
  }, 300);
}

export function FacilitatorAdministrasiWawancaraDetailPage({ npsn }: { npsn: string }) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [assignment, setAssignment] = useState<WorkspaceAssignmentRecord | null>(null);
  const [assessments, setAssessments] = useState<WorkspaceInterviewAssessmentRecord[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (previewOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [previewOpen]);

  async function loadDetail(showRefresh = false) {
    if (!hydrated || !session?.token || !npsn) {
      setLoading(false);
      return;
    }
    if (showRefresh) setRefreshing(true);
    setLoading(true);
    setLoadError("");
    try {
      const token = session.token;
      const results = await Promise.allSettled([
        schoolProfileByNpsnRequest(token, npsn),
        workspaceAssignmentsRequest(token, {
          moduleKey: "wawancara",
          schoolNpsn: npsn,
        }),
        workspaceInterviewAssessmentsRequest(token),
      ]);
      const profileRes = results[0].status === "fulfilled" ? results[0].value : null;
      const assignments = results[1].status === "fulfilled" ? results[1].value : [];
      const allAssessments = results[2].status === "fulfilled" ? results[2].value : [];

      if (!profileRes) {
        const reason =
          results[0].status === "rejected"
            ? results[0].reason instanceof Error
              ? results[0].reason.message
              : String(results[0].reason)
            : null;
        throw new Error(reason ?? "Data sekolah tidak ditemukan / NPSN tidak terdaftar.");
      }
      setProfile(profileRes);
      const matched = assignments.find(
        (a) => a.schoolNpsn === npsn && a.moduleKey === "wawancara",
      );
      setAssignment(matched ?? null);
      const schoolAssessments = allAssessments.filter((a) => a.schoolNpsn === npsn);
      setAssessments(schoolAssessments);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat detail wawancara.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDetail(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, npsn]);

  const primaryAssessment = assessments[0] ?? null;

  const criteriaRows = useMemo(() => {
    if (!primaryAssessment) return [];
    const rows: Array<{
      key: string;
      label: string;
      bobot: number;
      score: number;
      subText?: string;
    }> = [];
    let totalBobot = 0;
    const entries = Object.entries(primaryAssessment.answers as InterviewAnswersPayload);
    for (const [k, v] of entries) {
      if (/^(total|rekom|catatan|_)/i.test(k)) continue;
      const meta = criteriaLabelOf(k);
      const normalized = normalizeAnswerValue(v as never);
      rows.push({
        key: k,
        label: meta.label,
        bobot: meta.bobot,
        score: normalized.score,
        subText: normalized.subText,
      });
      totalBobot += meta.bobot;
    }
    if (totalBobot > 0 && totalBobot !== 100) {
      const scale = 100 / totalBobot;
      for (const r of rows) r.bobot = Math.round(r.bobot * scale * 10) / 10;
    }
    return rows;
  }, [primaryAssessment]);

  const weightedScore = useMemo(() => {
    if (!criteriaRows.length) return { raw: 0, scaled: 0, totalBobot: 0 };
    let totalBobot = 0;
    let raw = 0;
    for (const r of criteriaRows) {
      totalBobot += r.bobot;
      raw += r.bobot * r.score;
    }
    const scaled = totalBobot > 0 ? raw / totalBobot : 0;
    return { raw, scaled, totalBobot };
  }, [criteriaRows]);

  const schoolName =
    profile?.schoolName || assignment?.schoolName || "Memuat data sekolah...";

  return (
    <div className="space-y-6 pb-12">
      <div id="print-portal-root" aria-hidden className="print-only" />

      {/* Breadcrumb & Header Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 border-slate-200 bg-white"
            >
              <Link href="/fasilitator-administrasi/wawancara">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar Wawancara
              </Link>
            </Button>
            <Badge
              className="border border-primary/20 bg-primary/[0.08] text-primary"
              variant="outline"
            >
              <Building2 className="mr-2 h-3.5 w-3.5" />
              {session?.user.fullName || "Fasilitator Administrasi"}
            </Badge>
            <Badge
              className="border-sky-300 bg-sky-50 text-sky-800"
              variant="outline"
            >
              <ClipboardList className="mr-1.5 h-3 w-3" />
              Modul Wawancara · Detail Sekolah
            </Badge>
            {loadError ? (
              <Badge className="border-rose-200 bg-rose-50 text-rose-800" variant="outline">
                {loadError}
              </Badge>
            ) : null}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{schoolName}</h1>
            <p className="mt-1 text-sm text-slate-600">
              NPSN <span className="font-mono font-bold text-slate-900">{npsn}</span>
              {primaryAssessment?.updatedAt ? (
                <span className="ml-3 text-slate-500">
                  Penilaian terakhir: {formatDateTimeID(primaryAssessment.updatedAt)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadDetail(true)}
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
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-14 text-center text-sm text-slate-500">
          Memuat jadwal &amp; hasil wawancara...
        </div>
      ) : loadError ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {loadError}
        </div>
      ) : !profile ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-sm text-slate-500">
          Data sekolah tidak ditemukan.
        </div>
      ) : (
        <div id="print-wawancara-detail" className="space-y-6">
          {/* ACTION BAR: Preview + Print */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Ringkasan Wawancara
              </p>
              <p className="text-lg font-semibold text-slate-950">
                Jadwal &amp; Hasil Wawancara Per Sekolah
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="border-primary/20 bg-primary/[0.05] text-primary hover:bg-primary/[0.1] hover:ring-2 hover:ring-primary/15"
              >
                <Eye className="mr-1.5 h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleWindowPrint("print-wawancara-detail")}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Cetak / Simpan PDF
              </Button>
            </div>
          </div>

          {/* CARD 1: Jadwal Wawancara */}
          <Card className="overflow-hidden rounded-[28px] border-slate-200">
            <CardHeader className="bg-white px-6 pt-6 pb-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-sky-200 bg-sky-50 text-sky-700">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-lg font-semibold text-slate-950">
                      Jadwal Wawancara
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">
                      Informasi jadwal pelaksanaan, waktu, dan tautan meeting untuk wawancara daring sekolah dampingan.
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "border shrink-0",
                    assignment?.interviewScheduledDate
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                  variant="outline"
                >
                  {assignment?.interviewScheduledDate ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Sudah Dijadwalkan
                    </>
                  ) : (
                    <>
                      <Clock className="mr-1 h-3.5 w-3.5" />
                      Belum Dijadwalkan
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Tanggal Pelaksanaan
                  </div>
                  <p className="text-base font-semibold text-slate-950">
                    {formatDateID(assignment?.interviewScheduledDate)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    Waktu
                  </div>
                  <p className="text-base font-semibold text-slate-950">
                    {formatTimeID(assignment?.interviewScheduledTime)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    Pewawancara
                  </div>
                  <p className="text-base font-semibold text-slate-950 truncate">
                    {assignment?.facilitatorEquipmentName || session?.user.fullName || "—"}
                  </p>
                </div>
              </div>

              {assignment?.interviewMeetingLink ? (
                <div className="rounded-[20px] border border-dashed border-sky-400/60 bg-sky-50 p-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Tautan Rapat / Meeting Daring
                    </p>
                    <p className="text-sm font-medium text-sky-900 break-all">
                      {assignment.interviewMeetingLink}
                    </p>
                  </div>
                  <a
                    href={assignment.interviewMeetingLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button
                      type="button"
                      size="sm"
                      className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm border border-sky-700/50"
                    >
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      Buka Link Meeting
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm text-slate-500">
                  Link meeting wawancara belum tersedia. Silakan hubungi Admin Workspace untuk penjadwalan lebih lanjut.
                </div>
              )}
            </CardContent>
          </Card>

          {/* CARD 2: Hasil Wawancara */}
          <Card className="overflow-hidden rounded-[28px] border-slate-200">
            <CardHeader className="bg-white px-6 pt-6 pb-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-primary/15 bg-primary/[0.06] text-primary">
                    <Award className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-lg font-semibold text-slate-950">
                      Hasil Penilaian Wawancara
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">
                      Rekapitulasi penilaian per kriteria, skor total, dan rekomendasi hasil wawancara sekolah.
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "border shrink-0",
                    primaryAssessment
                      ? "border-slate-200 bg-slate-50 text-slate-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                  variant="outline"
                >
                  {primaryAssessment ? (
                    <>
                      {assessments.length} Penilaian · Total Skor {primaryAssessment.totalScore ?? weightedScore.scaled.toFixed(2)}
                    </>
                  ) : (
                    "Belum Ada Hasil Penilaian"
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-6">
              {!primaryAssessment ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
                  Sekolah ini belum memiliki hasil penilaian wawancara yang tersimpan di database.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Jumlah Kriteria
                      </p>
                      <p className="text-2xl font-semibold text-slate-950">
                        {criteriaRows.length}
                      </p>
                      <p className="text-xs text-slate-500">
                        Kriteria yang dinilai pewawancara
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Skor DB (Raw)
                      </p>
                      <p className="text-2xl font-semibold text-slate-950">
                        {primaryAssessment.totalScore ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Total score tersimpan di database
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-white p-5 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Skor Tertimbang (5.00)
                      </p>
                      <p className="text-2xl font-semibold text-slate-950">
                        {weightedScore.scaled ? weightedScore.scaled.toFixed(2) : "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Skor rata-rata per kriteria × bobot (%)
                      </p>
                    </div>
                    <div
                      className={cn(
                        "rounded-[20px] border p-5 space-y-1.5",
                        scoreLabel(weightedScore.scaled || primaryAssessment.totalScore || 0).cls,
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                        Predikat
                      </p>
                      <p className="text-2xl font-semibold flex items-center gap-2">
                        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", scoreLabel(weightedScore.scaled || 0).dot)} />
                        {scoreLabel(weightedScore.scaled || primaryAssessment.totalScore || 0).label}
                      </p>
                      <p className="text-xs opacity-80">Kesimpulan kualifikasi wawancara</p>
                    </div>
                  </div>

                  {/* TABEL KRITERIA PENILAIAN */}
                  <div className="rounded-[22px] border border-slate-200 bg-white overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        Detail Penilaian Per Kriteria
                      </p>
                      <span className="text-[11px] text-slate-500">
                        Skala 1 (Sangat Kurang) — 5 (Sangat Baik)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3 w-16 font-semibold border-b border-slate-200">
                              No
                            </th>
                            <th className="px-4 py-3 min-w-[260px] font-semibold border-b border-slate-200">
                              Kriteria Penilaian
                            </th>
                            <th className="px-4 py-3 w-28 text-center font-semibold border-b border-slate-200">
                              Bobot
                            </th>
                            <th className="px-4 py-3 w-28 text-center font-semibold border-b border-slate-200">
                              Skor
                            </th>
                            <th className="px-4 py-3 w-40 text-center font-semibold border-b border-slate-200">
                              Kualifikasi
                            </th>
                            <th className="px-4 py-3 min-w-[260px] font-semibold border-b border-slate-200">
                              Catatan Pewawancara
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {criteriaRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-10 text-center text-sm text-slate-400 italic"
                              >
                                Data kriteria penilaian tidak tersedia.
                              </td>
                            </tr>
                          ) : (
                            criteriaRows.map((r, i) => {
                              const qual = scoreLabel(r.score);
                              return (
                                <tr
                                  key={r.key}
                                  className={cn(
                                    "border-b border-slate-100 last:border-0",
                                    i % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                                  )}
                                >
                                  <td className="px-4 py-3 text-slate-500 align-top font-mono text-xs font-semibold">
                                    {String(i + 1).padStart(2, "0")}
                                  </td>
                                  <td className="px-4 py-3 text-slate-900 align-top font-medium">
                                    {r.label}
                                  </td>
                                  <td className="px-4 py-3 align-top text-center font-semibold text-slate-800">
                                    {r.bobot}%
                                  </td>
                                  <td className="px-4 py-3 align-top text-center font-mono font-bold text-slate-900">
                                    {r.score.toFixed(1)}
                                  </td>
                                  <td className="px-4 py-3 align-top text-center">
                                    <Badge
                                      className={cn("border", qual.cls)}
                                      variant="outline"
                                    >
                                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5", qual.dot)} />
                                      {qual.label}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 align-top text-xs leading-6">
                                    {r.subText ? r.subText : "—"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {criteriaRows.length > 0 ? (
                          <tfoot className="bg-slate-900 text-white">
                            <tr>
                              <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                                TOTAL NILAI WAWWANCARA
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-sm">
                                {weightedScore.totalBobot.toFixed(0)}%
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-base">
                                {weightedScore.scaled ? weightedScore.scaled.toFixed(2) : "—"}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-sm">
                                {scoreLabel(weightedScore.scaled || 0).label}
                              </td>
                              <td className="px-4 py-3 text-xs opacity-80">
                                Skor Tertimbang = Σ (Skor × Bobot) / 100
                              </td>
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>
                  </div>

                  {/* REKOMENDASI + CATATAN */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] border border-primary/20 bg-gradient-to-b from-primary/[0.05] to-white p-5 space-y-2">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                        <Award className="h-3.5 w-3.5" />
                        Rekomendasi Hasil Wawancara
                      </p>
                      <p className="text-sm leading-7 text-slate-800 whitespace-pre-wrap">
                        {primaryAssessment.recommendation?.trim()
                          ? primaryAssessment.recommendation
                          : "— (Belum ada rekomendasi tertulis dari pewawancara)"}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white p-5 space-y-2">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Catatan Umum Pewawancara
                      </p>
                      <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                        {primaryAssessment.note?.trim()
                          ? primaryAssessment.note
                          : "— (Belum ada catatan umum)"}
                      </p>
                    </div>
                  </div>

                  {assessments.length > 1 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                      Terdapat {assessments.length} penilaian wawancara tersimpan untuk sekolah ini (yang ditampilkan = penilaian terbaru / paling atas).
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* PREVIEW MODAL (LIGHTBOX) */}
      {previewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-[1000px] max-h-[92vh] rounded-[22px] bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-semibold text-slate-900">
                  Preview · Jadwal &amp; Hasil Wawancara
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {schoolName} · NPSN {npsn} • Mode layout cetak A4
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleWindowPrint("print-wawancara-detail")}
                >
                  <Printer className="mr-1.5 h-4 w-4" />
                  Cetak
                </Button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Tutup preview"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              <div className="mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl rounded-[4px] p-8 sm:p-10 ring-1 ring-slate-200">
                {/* Print clone of detail body */}
                <div className="space-y-8">
                  <div className="space-y-2 border-b border-slate-300 pb-5">
                    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Laporan Resmi · Hasil Wawancara Administrasi
                    </p>
                    <h1 className="text-center text-2xl font-bold text-slate-950">
                      {schoolName}
                    </h1>
                    <p className="text-center text-sm text-slate-600">
                      NPSN <span className="font-mono font-semibold">{npsn}</span>
                      {primaryAssessment?.updatedAt ? (
                        <> · Penilaian: {formatDateTimeID(primaryAssessment.updatedAt)}</>
                      ) : null}
                    </p>
                  </div>

                  {/* Clone re-render Jadwal */}
                  <section className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">
                      A. Jadwal Wawancara
                    </h2>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Tanggal</p>
                        <p className="font-semibold text-slate-900">{formatDateID(assignment?.interviewScheduledDate)}</p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Waktu</p>
                        <p className="font-semibold text-slate-900">{formatTimeID(assignment?.interviewScheduledTime)}</p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Pewawancara</p>
                        <p className="font-semibold text-slate-900 truncate">
                          {assignment?.facilitatorEquipmentName || session?.user.fullName || "—"}
                        </p>
                      </div>
                    </div>
                    {assignment?.interviewMeetingLink ? (
                      <div className="text-[11px] border border-slate-200 rounded-lg p-3 bg-slate-50 break-all">
                        <span className="font-semibold text-slate-700">Link Meeting: </span>
                        <span className="text-slate-600">{assignment.interviewMeetingLink}</span>
                      </div>
                    ) : null}
                  </section>

                  {/* Clone re-render Hasil */}
                  <section className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">
                      B. Hasil Penilaian
                    </h2>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                          Kriteria
                        </p>
                        <p className="font-bold text-lg text-slate-900">{criteriaRows.length}</p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                          Skor DB
                        </p>
                        <p className="font-bold text-lg text-slate-900">
                          {primaryAssessment?.totalScore ?? "—"}
                        </p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                          Skor Tertimbang
                        </p>
                        <p className="font-bold text-lg text-slate-900">
                          {weightedScore.scaled ? weightedScore.scaled.toFixed(2) : "—"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "border rounded-lg p-3 space-y-1",
                          scoreLabel(weightedScore.scaled || 0).cls,
                        )}
                      >
                        <p className="text-[10px] uppercase tracking-[0.14em] opacity-70 font-semibold">
                          Predikat
                        </p>
                        <p className="font-bold text-lg">
                          {scoreLabel(weightedScore.scaled || primaryAssessment?.totalScore || 0).label}
                        </p>
                      </div>
                    </div>

                    {/* Tabel Kriteria (Compact Print) */}
                    <table className="w-full text-xs border border-slate-300 border-collapse">
                      <thead className="bg-slate-100 text-[10px] uppercase tracking-[0.1em] text-slate-700">
                        <tr>
                          <th className="border border-slate-300 px-2 py-2 w-10">No</th>
                          <th className="border border-slate-300 px-2 py-2 text-left">Kriteria</th>
                          <th className="border border-slate-300 px-2 py-2 w-16 text-center">Bobot</th>
                          <th className="border border-slate-300 px-2 py-2 w-16 text-center">Skor</th>
                          <th className="border border-slate-300 px-2 py-2 min-w-[140px]">Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {criteriaRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="border border-slate-300 px-2 py-4 text-center italic text-slate-500">
                              Tidak ada data.
                            </td>
                          </tr>
                        ) : (
                          criteriaRows.map((r, i) => (
                            <tr key={r.key}>
                              <td className="border border-slate-300 px-2 py-2 text-center font-mono">
                                {String(i + 1).padStart(2, "0")}
                              </td>
                              <td className="border border-slate-300 px-2 py-2 font-medium text-slate-900">
                                {r.label}
                              </td>
                              <td className="border border-slate-300 px-2 py-2 text-center font-semibold">
                                {r.bobot}%
                              </td>
                              <td className="border border-slate-300 px-2 py-2 text-center font-mono font-bold">
                                {r.score.toFixed(1)}
                              </td>
                              <td className="border border-slate-300 px-2 py-2 text-slate-700 leading-5">
                                {r.subText ? r.subText : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {primaryAssessment ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="border border-primary/30 bg-primary/[0.05] rounded-lg p-3 space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.14em] opacity-70 font-semibold text-primary">
                            Rekomendasi
                          </p>
                          <p className="leading-5 whitespace-pre-wrap text-slate-800">
                            {primaryAssessment.recommendation?.trim() || "—"}
                          </p>
                        </div>
                        <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                            Catatan Umum
                          </p>
                          <p className="leading-5 whitespace-pre-wrap text-slate-700">
                            {primaryAssessment.note?.trim() || "—"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </section>

                  <section className="pt-6 grid grid-cols-2 gap-10 text-xs text-slate-700 border-t border-slate-200">
                    <div className="space-y-14">
                      <p className="text-center">Mengetahui,</p>
                      <div className="space-y-1 text-center">
                        <p className="font-semibold text-slate-900 underline">
                          {session?.user.fullName || "Fasilitator Administrasi"}
                        </p>
                        <p className="text-[10px] text-slate-500">Fasilitator Administrasi</p>
                      </div>
                    </div>
                    <div className="space-y-14">
                      <p className="text-center">
                        {formatDateID(new Date().toISOString()).split(", ").pop()}, {formatDateID(new Date().toISOString()).split(", ")[0]}
                      </p>
                      <div className="space-y-1 text-center">
                        <p className="font-semibold text-slate-900 underline">
                          {assignment?.facilitatorEquipmentName || "Pewawancara"}
                        </p>
                        <p className="text-[10px] text-slate-500">Pewawancara / Fasilitator Alat</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
