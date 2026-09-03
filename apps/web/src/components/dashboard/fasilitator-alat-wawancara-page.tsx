"use client";

import {
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Loader2,
  Search,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  upsertWorkspaceInterviewAssessmentRequest,
  workspaceAssignmentsRequest,
  workspaceInterviewAssessmentsRequest,
} from "@/lib/api";
import {
  buildFacilitatorSchoolTaskRows,
  calculateInterviewAssessment,
  createEmptyInterviewAnswers,
  filterAssignmentsForEquipmentFacilitator,
  formatWorkspaceDateTime,
  interviewQuestionDefinitions,
  normalizeInterviewAnswers,
  type InterviewAssessmentRecord,
  type FacilitatorSchoolTaskRow,
  type InterviewAssessmentAnswers,
  type InterviewAnswerValue,
} from "@/lib/facilitator-workspace";
import { assignmentTabs, type TaskAssignmentRecord } from "@/lib/task-assignments";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const scorePillDescriptions: Record<InterviewAnswerValue, { short: string; tone: string }> = {
  1: { short: "Kurang / Tidak Memenuhi", tone: "text-rose-700 bg-rose-50 border-rose-200" },
  2: { short: "Cukup Kurang", tone: "text-amber-700 bg-amber-50 border-amber-200" },
  3: { short: "Cukup / Sesuai Dasar", tone: "text-slate-700 bg-slate-50 border-slate-200" },
  4: { short: "Baik / Hampir Optimal", tone: "text-sky-700 bg-sky-50 border-sky-200" },
  5: { short: "Sangat Baik / Optimal", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

const priorityCategoryStyles: Record<string, string> = {
  "Prioritas Sangat Tinggi": "bg-rose-50 text-rose-700 border-rose-200",
  "Prioritas Tinggi": "bg-amber-50 text-amber-700 border-amber-200",
  "Prioritas Sedang": "bg-sky-50 text-sky-700 border-sky-200",
  "Prioritas Rendah": "bg-slate-50 text-slate-700 border-slate-200",
};

function categoryBadgeClass(recommendation: string): string {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide";
  return cn(base, priorityCategoryStyles[recommendation] ?? priorityCategoryStyles["Prioritas Rendah"]);
}

export function FacilitatorAlatWawancaraPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [assignments, setAssignments] = useState<TaskAssignmentRecord[]>([]);
  const [assessments, setAssessments] = useState<InterviewAssessmentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activeRow, setActiveRow] = useState<FacilitatorSchoolTaskRow | null>(null);
  const [formAnswers, setFormAnswers] = useState<InterviewAssessmentAnswers>(() => createEmptyInterviewAnswers());
  const [formNote, setFormNote] = useState("");
  const [expandedGuideKey, setExpandedGuideKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingComponentKey, setIsSavingComponentKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [savedAnswersBaseline, setSavedAnswersBaseline] = useState<InterviewAssessmentAnswers | null>(null);
  const [savedNoteBaseline, setSavedNoteBaseline] = useState<string>("");
  const [componentSavedKey, setComponentSavedKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) {
      return;
    }

    let cancelled = false;

    async function load() {
      const token = session?.token;
      if (!token) {
        return;
      }

      try {
        const [assignmentPayload, assessmentPayload] = await Promise.all([
          workspaceAssignmentsRequest(token, { moduleKey: "wawancara" }),
          workspaceInterviewAssessmentsRequest(token),
        ]);

        if (!cancelled) {
          setAssignments(assignmentPayload);
          setAssessments(assessmentPayload as unknown as InterviewAssessmentRecord[]);
        }
      } catch {
        if (!cancelled) {
          setAssignments([]);
          setAssessments([]);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token]);

  const filteredAssignments = useMemo(() => {
    const facilitatorId = session?.user.id ?? "";
    const facilitatorName = session?.user.fullName ?? "";

    return filterAssignmentsForEquipmentFacilitator(assignments, facilitatorId, facilitatorName, "wawancara");
  }, [assignments, session?.user.fullName, session?.user.id]);

  const rows = useMemo(() => buildFacilitatorSchoolTaskRows(filteredAssignments), [filteredAssignments]);

  const assessmentByAssignmentKey = useMemo(
    () => new Map(assessments.map((item) => [item.assignmentKey, item])),
    [assessments],
  );

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

  const completedCount = rows.filter((row) => assessmentByAssignmentKey.has(row.assignmentKey)).length;
  const averageScore =
    completedCount > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + (assessmentByAssignmentKey.get(row.assignmentKey)?.totalScore ?? 0), 0) /
            completedCount,
        )
      : 0;

  function openAssessmentModal(row: FacilitatorSchoolTaskRow) {
    const existing = assessmentByAssignmentKey.get(row.assignmentKey);
    setActiveRow(row);
    let initialAnswers: InterviewAssessmentAnswers;
    let initialNote = existing?.note ?? "";
    if (existing?.answers && typeof existing.answers === "object") {
      initialAnswers = normalizeInterviewAnswers(existing.answers as unknown as Record<string, unknown>);
    } else {
      initialAnswers = createEmptyInterviewAnswers();
    }
    setFormAnswers(initialAnswers);
    setFormNote(initialNote);
    setSavedAnswersBaseline(initialAnswers);
    setSavedNoteBaseline(initialNote);
    setComponentSavedKey(Object.fromEntries(interviewQuestionDefinitions.map((q) => [q.key, !!existing])));
    setExpandedGuideKey(null);
  }

  function setScore(key: string, score: InterviewAnswerValue) {
    setFormAnswers((current) => ({
      ...current,
      [key]: { score, comment: current[key as keyof typeof current]?.comment ?? "" },
    }));
  }

  function setComment(key: string, comment: string) {
    setFormAnswers((current) => ({
      ...current,
      [key]: { score: (current[key as keyof typeof current]?.score ?? 3) as InterviewAnswerValue, comment },
    }));
  }

  function isComponentDirty(key: string): boolean {
    if (!savedAnswersBaseline) return true;
    const cur = formAnswers[key as keyof typeof formAnswers];
    const base = savedAnswersBaseline[key as keyof typeof savedAnswersBaseline];
    const curScore = (cur as { score?: InterviewAnswerValue })?.score ?? 3;
    const baseScore = typeof base === "number" ? base : (base as { score?: InterviewAnswerValue })?.score ?? 3;
    const curComment = typeof cur === "object" ? (cur as { comment?: string }).comment ?? "" : "";
    const baseComment = typeof base === "object" ? (base as { comment?: string }).comment ?? "" : "";
    return curScore !== baseScore || curComment !== baseComment;
  }

  const overallIsDirty = useMemo(() => {
    if (!savedAnswersBaseline) return true;
    if (formNote.trim() !== savedNoteBaseline.trim()) return true;
    for (const q of interviewQuestionDefinitions) {
      if (isComponentDirty(q.key)) return true;
    }
    return false;
  }, [formAnswers, formNote, savedAnswersBaseline, savedNoteBaseline]);

  async function handleSaveComponent(componentKey: string) {
    if (!activeRow || !session?.token || isSaving || isSavingComponentKey) return;
    setIsSavingComponentKey(componentKey);
    const result = calculateInterviewAssessment(formAnswers);
    const nextRecord = {
      assignmentKey: activeRow.assignmentKey,
      schoolNpsn: activeRow.schoolNpsn,
      schoolName: activeRow.schoolName,
      facilitatorEquipmentId: session.user.id,
      facilitatorEquipmentName: session.user.fullName,
      answers: formAnswers,
      totalScore: result.totalScore,
      recommendation: result.recommendation,
      note: formNote.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertWorkspaceInterviewAssessmentRequest(session.token, nextRecord);
      setAssessments((current) => {
        const next = new Map(current.map((item) => [item.assignmentKey, item]));
        next.set(nextRecord.assignmentKey, nextRecord);
        return Array.from(next.values());
      });
      setSavedAnswersBaseline({ ...formAnswers });
      setSavedNoteBaseline(formNote.trim());
      setComponentSavedKey((prev) => ({ ...prev, [componentKey]: true }));
      const componentLabel = interviewQuestionDefinitions.find((q) => q.key === componentKey)?.label ?? componentKey;
      setToast({
        kind: "success",
        message: `Komponen "${componentLabel}" berhasil di-simpan.`,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Cek koneksi atau hubungi admin jika error berlanjut.";
      setToast({
        kind: "error",
        message: `Gagal menyimpan komponen. ${msg}`,
      });
    } finally {
      setIsSavingComponentKey(null);
      setTimeout(() => {
        setToast((current) => (current && current.kind === "success" ? null : current));
      }, 4200);
    }
  }

  async function handleSaveAssessment(finalize?: boolean) {
    if (!activeRow || !session?.token || isSaving) {
      return;
    }

    setIsSaving(true);
    const result = calculateInterviewAssessment(formAnswers);
    const nextRecord = {
      assignmentKey: activeRow.assignmentKey,
      schoolNpsn: activeRow.schoolNpsn,
      schoolName: activeRow.schoolName,
      facilitatorEquipmentId: session.user.id,
      facilitatorEquipmentName: session.user.fullName,
      answers: formAnswers,
      totalScore: result.totalScore,
      recommendation: result.recommendation,
      note: formNote.trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await upsertWorkspaceInterviewAssessmentRequest(session.token, nextRecord);
      setAssessments((current) => {
        const next = new Map(current.map((item) => [item.assignmentKey, item]));
        next.set(nextRecord.assignmentKey, nextRecord);
        return Array.from(next.values());
      });
      setSavedAnswersBaseline({ ...formAnswers });
      setSavedNoteBaseline(formNote.trim());
      setComponentSavedKey(Object.fromEntries(interviewQuestionDefinitions.map((q) => [q.key, true])));
      setToast({
        kind: "success",
        message: finalize
          ? "Penilaian wawancara berhasil disimpan (Final) & di-upload ke server."
          : "Draft penilaian wawancara berhasil disimpan ke server.",
      });
      if (finalize) {
        setTimeout(() => {
          setActiveRow(null);
        }, 350);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Cek koneksi atau hubungi admin jika error berlanjut.";
      setToast({
        kind: "error",
        message: `Gagal menyimpan penilaian wawancara. ${msg}`,
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setToast((current) => (current && current.kind === "success" ? null : current));
      }, 4200);
    }
  }

  const liveResult = useMemo(() => calculateInterviewAssessment(formAnswers), [formAnswers]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Sekolah"
          value={`${rows.length}`}
          helper="Penugasan wawancara aktif"
          icon={<BookOpen className="h-4 w-4" />}
        />
        <SummaryCard
          label="Sudah Dinilai"
          value={`${completedCount}`}
          helper="Sekolah yang sudah diisi modal penilaian"
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <SummaryCard
          label="Belum Dinilai"
          value={`${Math.max(rows.length - completedCount, 0)}`}
          helper="Sekolah yang masih menunggu wawancara"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <SummaryCard
          label="Rata-rata Skor"
          value={completedCount > 0 ? `${averageScore}` : "-"}
          helper="Nilai rata-rata hasil wawancara (0–100)"
          icon={<Calculator className="h-4 w-4" />}
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">List Sekolah Wawancara</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Klik aksi <span className="font-semibold text-slate-900">Detail Penilaian</span> untuk
                membuka format penilaian wawancara tiap sekolah berdasarkan dokumen instrumen.
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
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-16 px-4 py-3">No</th>
                  <th className="px-4 py-3">NPSN</th>
                  <th className="px-4 py-3">Nama Sekolah</th>
                  <th className="px-4 py-3">Sumber</th>
                  <th className="px-4 py-3">Fasilitator Adm</th>
                  <th className="px-4 py-3">Status Penilaian</th>
                  <th className="px-4 py-3">Update</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada sekolah wawancara yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, index) => {
                    const assessment = assessmentByAssignmentKey.get(row.assignmentKey);

                    return (
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
                        <td className="px-4 py-4 text-slate-700">
                          {row.facilitatorAdministrationName || "-"}
                        </td>
                        <td className="px-4 py-4">
                          {assessment ? (
                            <div className="space-y-1">
                              <span className={categoryBadgeClass(assessment.recommendation)}>
                                {assessment.recommendation} · {assessment.totalScore}
                              </span>
                              <p className="text-xs text-slate-500">
                                {formatWorkspaceDateTime(assessment.updatedAt)}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="secondary">Belum Dinilai</Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700">{formatWorkspaceDateTime(row.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <Button type="button" size="sm" onClick={() => openAssessmentModal(row)}>
                            Detail Penilaian
                          </Button>
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

      {activeRow ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-6 w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-8 py-6 backdrop-blur lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">
                  Instrumen Wawancara · Fasilitator Alat
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{activeRow.schoolName}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  NPSN {activeRow.schoolNpsn} • Fasilitator Adm:{" "}
                  {activeRow.facilitatorAdministrationName || "-"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">
                    9 Komponen · Total Bobot 100%
                  </Badge>
                  <span className={categoryBadgeClass(liveResult.recommendation)}>
                    {liveResult.recommendation} · Nilai Akhir {liveResult.totalScore}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveRow(null)}
                disabled={isSaving}
              >
                Tutup
              </Button>
            </div>

            <div className="space-y-6 px-6 py-6 lg:px-8">
              <section className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                  label="Nilai Akhir Otomatis"
                  value={`${liveResult.totalScore}`}
                  helper="Rumus: Σ (Skor ÷ 5 × Bobot Komponen) — skala 0–100"
                  icon={<Calculator className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Kategori Prioritas"
                  value={liveResult.recommendation}
                  helper="≥85 Sangat Tinggi · 70–84 Tinggi · 55–69 Sedang · <55 Rendah"
                  icon={<ClipboardCheck className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Jumlah Butir"
                  value={`${interviewQuestionDefinitions.length}`}
                  helper="9 komponen instrumen sesuai dokumen ABT"
                  icon={<BookOpen className="h-4 w-4" />}
                />
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-primary/[0.03] p-5 lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Panduan Pengisian Instrumen Wawancara
                      </p>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        Untuk tiap komponen: (1) tanyakan pertanyaan panduan wawancara, (2) cek
                        kecocokan dengan Kriteria Skor 1–5, (3) pilih skor yang paling sesuai, (4)
                        tuliskan <span className="font-semibold text-slate-900">Komentar / Catatan</span>{" "}
                        yang menjelaskan bukti penilaian, lalu (5) klik tombol{" "}
                        <span className="font-semibold text-slate-900">Simpan / Update</span> di bawah
                        masing-masing komponen. Apabila ingin menyimpan keseluruhan sekaligus, gunakan
                        tombol <span className="font-semibold text-slate-900">Simpan Draft</span> atau{" "}
                        <span className="font-semibold text-slate-900">Simpan Final & Tutup</span> di
                        bagian paling bawah. Nilai akhir dihitung otomatis sesuai rumus bobot pada
                        dokumen Panduan & Instrumen Wawancara Bantuan Peralatan ABT.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="h-max border-slate-200 bg-white text-slate-700">
                      Skala Penilaian: 1 s.d 5
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-max inline-flex items-center gap-1.5 border",
                        overallIsDirty
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800",
                      )}
                    >
                      {overallIsDirty ? (
                        <Save className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {overallIsDirty
                        ? "Ada perubahan yang belum disimpan"
                        : "Semua perubahan telah tersimpan"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-5">
                  {(
                    [5, 4, 3, 2, 1] as const
                  ).map((s) => (
                    <div
                      key={s}
                      className={cn(
                        "rounded-[18px] border px-4 py-3 text-xs leading-5",
                        scorePillDescriptions[s].tone,
                      )}
                    >
                      <p className="text-sm font-bold">Skor {s}</p>
                      <p className="mt-1">{scorePillDescriptions[s].short}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-5">
                {interviewQuestionDefinitions.map((question) => {
                  const answer = formAnswers[question.key] ?? { score: 3 as const, comment: "" };
                  const perComponentRow = liveResult.perComponent.find((c) => c.key === question.key);
                  const guideOpen = expandedGuideKey === question.key;

                  return (
                    <Card
                      key={question.key}
                      className="overflow-hidden rounded-[28px] border-slate-200"
                    >
                      <CardHeader className="bg-white px-6 pt-6 pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                Komponen
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-primary/20 bg-primary/5 text-primary"
                              >
                                Bobot {question.weightPercent}%
                              </Badge>
                              {perComponentRow ? (
                                <Badge
                                  variant="outline"
                                  className="border-slate-200 bg-white text-slate-700"
                                >
                                  Kontribusi Nilai: {perComponentRow.componentValue}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-3 text-xl font-semibold text-slate-950">
                              {question.label}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-slate-600">{question.helper}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5 px-6 pb-6">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Kriteria Skor 1–5
                          </p>
                          <ul className="mt-4 space-y-3">
                            {question.criteria.map((c) => {
                              const active = answer.score === c.score;
                              return (
                                <li
                                  key={c.score}
                                  className={cn(
                                    "flex items-start gap-3 rounded-[16px] border px-4 py-3 text-sm leading-6 transition",
                                    active
                                      ? cn(
                                          "border-transparent shadow-sm",
                                          scorePillDescriptions[c.score].tone,
                                        )
                                      : "border-slate-200 bg-white text-slate-600",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                                      active
                                        ? "bg-white shadow-inner text-slate-900"
                                        : "bg-slate-100 text-slate-500",
                                    )}
                                  >
                                    {c.score}
                                  </span>
                                  <p className="min-w-0 flex-1">{c.label}</p>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGuideKey(guideOpen ? null : question.key)
                            }
                            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <BookOpen className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  Panduan Pertanyaan Wawancara
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Daftar pertanyaan yang dapat diajukan kepada narasumber sekolah
                                </p>
                              </div>
                            </div>
                            {guideOpen ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                          {guideOpen ? (
                            <div className="border-t border-dashed border-slate-200 px-5 pb-5 pt-4">
                              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600 marker:font-semibold marker:text-slate-400">
                                {question.interviewGuide.map((q, idx) => (
                                  <li key={idx}>{q}</li>
                                ))}
                              </ol>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[24px] border border-dashed border-primary/30 bg-primary/[0.03] p-5">
                          <div className="grid gap-5">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                Skor Penilaian · Pilih salah satu (1–5)
                              </p>
                              <div className="mt-3 grid grid-cols-5 gap-2 rounded-[18px] bg-white p-2 shadow-sm ring-1 ring-slate-200">
                                {([1, 2, 3, 4, 5] as const).map((s) => {
                                  const active = answer.score === s;
                                  return (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setScore(question.key, s)}
                                      className={cn(
                                        "inline-flex h-12 items-center justify-center rounded-[14px] text-sm font-bold transition",
                                        active
                                          ? "bg-primary text-white shadow-sm"
                                          : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                                      )}
                                    >
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                              <p
                                className={cn(
                                  "mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                                  scorePillDescriptions[answer.score].tone,
                                )}
                              >
                                Skor {answer.score} · {scorePillDescriptions[answer.score].short}
                              </p>
                            </div>

                            <div>
                              <div className="flex items-end justify-between gap-3">
                                <label
                                  htmlFor={`comment-${question.key}`}
                                  className="text-sm font-semibold text-slate-950"
                                >
                                  Komentar / Catatan Verifikasi
                                </label>
                                <p className="text-xs text-slate-400">
                                  {answer.comment.length.toLocaleString("id-ID")} karakter
                                </p>
                              </div>
                              <textarea
                                id={`comment-${question.key}`}
                                value={answer.comment}
                                onChange={(event) => setComment(question.key, event.target.value)}
                                rows={4}
                                placeholder="Tuliskan bukti, klarifikasi jawaban sekolah, hasil observasi, atau catatan yang mendasari pemberian skor..."
                                className="mt-2 min-h-[112px] w-full resize-y rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {(() => {
                                    const componentDirty = isComponentDirty(question.key);
                                    const everSaved = !!componentSavedKey[question.key];
                                    const componentSaving = isSavingComponentKey === question.key;
                                    const badgeClass = componentSaving
                                      ? "border-sky-200 bg-sky-50 text-sky-800"
                                      : componentDirty
                                        ? "border-amber-200 bg-amber-50 text-amber-800"
                                        : everSaved
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                          : "border-slate-200 bg-slate-50 text-slate-700";
                                    return (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "inline-flex items-center gap-1.5 border",
                                          badgeClass,
                                        )}
                                      >
                                        {componentSaving ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : componentDirty ? (
                                          <Save className="h-3.5 w-3.5" />
                                        ) : everSaved ? (
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                        ) : (
                                          <XCircle className="h-3.5 w-3.5" />
                                        )}
                                        {componentSaving
                                          ? "Menyimpan komponen..."
                                          : componentDirty
                                            ? everSaved
                                              ? "Komponen diubah, belum tersimpan"
                                              : "Komponen belum disimpan"
                                            : everSaved
                                              ? "Komponen tersimpan"
                                              : "Komponen kosong"}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                                {(() => {
                                  const componentDirty = isComponentDirty(question.key);
                                  const everSaved = !!componentSavedKey[question.key];
                                  const componentSaving = isSavingComponentKey === question.key;
                                  const disabled = !componentDirty || isSaving || !!isSavingComponentKey || !session?.token;
                                  const label = everSaved ? "Update" : "Simpan";
                                  return (
                                    <Button
                                      type="button"
                                      variant={everSaved ? "default" : "default"}
                                      disabled={disabled}
                                      onClick={() => handleSaveComponent(question.key)}
                                      className={cn(
                                        "inline-flex items-center gap-2 rounded-[16px]",
                                        everSaved
                                          ? "bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800"
                                          : "bg-primary text-white hover:bg-primary/90",
                                      )}
                                    >
                                      {componentSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : everSaved ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                      {componentSaving ? "Menyimpan..." : label}
                                    </Button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>

              <Card className="overflow-hidden rounded-[28px] border-2 border-primary/20 bg-gradient-to-b from-primary/[0.04] to-white">
                <CardHeader className="gap-3 px-6 pt-6 pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                        Ringkasan Hasil Penilaian
                      </p>
                      <CardTitle className="mt-2 text-xl text-slate-950">
                        Rekapitulasi Per Komponen
                      </CardTitle>
                    </div>
                    <span className={categoryBadgeClass(liveResult.recommendation)}>
                      {liveResult.recommendation} · Nilai Akhir {liveResult.totalScore}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 px-6 pb-6">
                  <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="w-12 px-4 py-3 text-left">No</th>
                          <th className="px-4 py-3 text-left">Komponen</th>
                          <th className="w-20 px-4 py-3 text-left">Bobot</th>
                          <th className="w-20 px-4 py-3 text-left">Skor</th>
                          <th className="w-28 px-4 py-3 text-left">Nilai Komponen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {liveResult.perComponent.map((row, idx) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-950">{row.label}</td>
                            <td className="px-4 py-3 text-slate-600">{row.weight}%</td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                                  scorePillDescriptions[row.score as InterviewAnswerValue].tone,
                                )}
                              >
                                {row.score}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-950">
                              {row.componentValue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-primary/[0.04]">
                          <td
                            colSpan={4}
                            className="px-4 py-3 text-right text-sm font-semibold text-slate-950"
                          >
                            Nilai Akhir
                          </td>
                          <td className="px-4 py-3 text-lg font-bold text-primary">
                            {liveResult.totalScore}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <label
                        htmlFor="global-note"
                        className="text-sm font-semibold text-slate-950"
                      >
                        Catatan Wawancara (Kesimpulan / Tindak Lanjut)
                      </label>
                      <p className="text-xs text-slate-400">
                        {formNote.length.toLocaleString("id-ID")} karakter
                      </p>
                    </div>
                    <textarea
                      id="global-note"
                      value={formNote}
                      onChange={(event) => setFormNote(event.target.value)}
                      rows={5}
                      placeholder="Tulis kesimpulan wawancara, catatan keputusan rekomendasi prioritas, atau rencana tindak lanjut pasca wawancara..."
                      className="mt-2 min-h-[128px] w-full resize-y rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-8 py-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className={categoryBadgeClass(liveResult.recommendation)}>
                  {liveResult.recommendation}
                </span>
                <p className="text-sm text-slate-600">
                  Nilai Akhir{" "}
                  <span className="font-bold text-slate-950">{liveResult.totalScore}</span>{" "}
                  <span className="text-slate-400">·</span> Tersimpan sebagai{" "}
                  <span className="font-semibold text-slate-800">Draft</span> atau{" "}
                  <span className="font-semibold text-slate-800">Final</span>.
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "inline-flex items-center gap-1.5 border",
                    overallIsDirty
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800",
                  )}
                >
                  {overallIsDirty ? (
                    <Save className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {overallIsDirty ? "Ada perubahan yang belum disimpan" : "Semua perubahan tersimpan"}
                </Badge>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setActiveRow(null)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => handleSaveAssessment(false)}
                  className="inline-flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Menyimpan..." : "Simpan Draft"}
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveAssessment(true)}
                  className="inline-flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4" />
                  )}
                  {isSaving ? "Menyimpan..." : "Simpan Final & Tutup"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-2xl",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <div className="flex items-center gap-2">
            {toast.kind === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}
