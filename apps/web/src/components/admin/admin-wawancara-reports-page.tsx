"use client";

import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  workspaceInterviewAssessmentsRequest,
  type AdminSchoolOption,
  type WorkspaceInterviewAssessmentRecord,
  type InterviewAnswersPayload,
  type InterviewPerComponentAnswer,
} from "@/lib/api";
import { interviewQuestionDefinitions } from "@/lib/facilitator-workspace";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

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

interface InterviewReportRow {
  no: number;
  npsn: string;
  provinsi: string;
  kotaKabupaten: string;
  nama: string;
  schoolId: string;
  sudahDinilai: boolean;
  nilai: number | null;
  rekomendasi: string | null;
  fasilitatorAlatNama: string | null;
  updateTerakhir: string | null;
}

function fmtDateTime(s: string | null): string {
  if (!s) return "-";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return s;
  }
}

function tsvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const clean = text.replace(/\t/g, " ").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
  return `"${clean.replaceAll('"', '""')}"`;
}

function todayFileStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function coerceAnswerCell(raw: unknown): { score: string; comment: string } {
  if (raw == null) return { score: "", comment: "" };
  if (typeof raw === "number") {
    const n = Number(raw);
    return { score: n >= 1 && n <= 5 ? String(n) : "", comment: "" };
  }
  if (typeof raw === "object") {
    const obj = raw as Partial<InterviewPerComponentAnswer>;
    const scoreNum = Number(obj.score ?? 0);
    const scoreStr = scoreNum >= 1 && scoreNum <= 5 ? String(scoreNum) : "";
    const commentStr = typeof obj.comment === "string" ? obj.comment : "";
    return { score: scoreStr, comment: commentStr };
  }
  return { score: "", comment: "" };
}

type DownloadableRow = InterviewReportRow & {
  answersRaw: InterviewAnswersPayload | Record<string, unknown> | null;
  noteFinal: string | null;
};

function sortRowsByWilayahThenName(rows: DownloadableRow[]): DownloadableRow[] {
  return [...rows].sort((a, b) => {
    const pa = (a.provinsi ?? "").trim();
    const pb = (b.provinsi ?? "").trim();
    const cmpP = pa.localeCompare(pb, "id");
    if (cmpP !== 0) return cmpP;
    const ka = (a.kotaKabupaten ?? "").trim();
    const kb = (b.kotaKabupaten ?? "").trim();
    const cmpK = ka.localeCompare(kb, "id");
    if (cmpK !== 0) return cmpK;
    return (a.nama ?? "").trim().localeCompare((b.nama ?? "").trim(), "id");
  });
}

function triggerTsvDownloadNilaiSaja(rows: DownloadableRow[]) {
  const headers = [
    "No", "NPSN", "Provinsi", "Kota/Kabupaten", "Nama Sekolah", "Status Penilaian", "Nilai (0-100)", "Rekomendasi",
    "Fasilitator Alat", "Catatan Kesimpulan (Note)", "Update Terakhir",
  ];
  const lines = [headers.map(tsvEscape).join("\t")];
  const sorted = sortRowsByWilayahThenName(rows);
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]!;
    lines.push([
      i + 1, r.npsn, r.provinsi, r.kotaKabupaten, r.nama,
      r.sudahDinilai ? "Sudah Dinilai" : "Belum Dinilai",
      r.nilai ?? "", r.rekomendasi ?? "",
      r.fasilitatorAlatNama ?? "", r.noteFinal ?? "",
      fmtDateTime(r.updateTerakhir),
    ].map(tsvEscape).join("\t"));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-wawancara-nilai-${todayFileStamp()}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function triggerTsvDownloadLengkapDenganKomentar(rows: DownloadableRow[]) {
  const headerBase = [
    "No", "NPSN", "Provinsi", "Kota/Kabupaten", "Nama Sekolah", "Status Penilaian", "Nilai (0-100)", "Rekomendasi",
    "Fasilitator Alat",
  ];
  const perKomponen: string[] = [];
  for (const q of interviewQuestionDefinitions) {
    perKomponen.push(`${q.label} — Skor (1-5)`);
    perKomponen.push(`${q.label} — Komentar Fasilitator Alat`);
  }
  const headerTail = ["Catatan Kesimpulan (Note Final)", "Update Terakhir"];
  const headers = [...headerBase, ...perKomponen, ...headerTail];
  const lines = [headers.map(tsvEscape).join("\t")];
  const sorted = sortRowsByWilayahThenName(rows);

  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]!;
    const base: (string | number)[] = [
      i + 1, r.npsn, r.provinsi, r.kotaKabupaten, r.nama,
      r.sudahDinilai ? "Sudah Dinilai" : "Belum Dinilai",
      r.nilai ?? "", r.rekomendasi ?? "", r.fasilitatorAlatNama ?? "",
    ];
    const komponen: (string | number)[] = [];
    const ans = (r.answersRaw ?? {}) as Record<string, unknown>;
    for (const q of interviewQuestionDefinitions) {
      const cell = coerceAnswerCell(ans[q.key]);
      komponen.push(cell.score, cell.comment);
    }
    const tail = [r.noteFinal ?? "", fmtDateTime(r.updateTerakhir)];
    lines.push([...base, ...komponen, ...tail].map(tsvEscape).join("\t"));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-wawancara-lengkap-skor-komentar-${todayFileStamp()}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function AdminWawancaraReportsPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [assessments, setAssessments] = useState<WorkspaceInterviewAssessmentRecord[]>([]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          adminUsersRequest(),
          token ? workspaceInterviewAssessmentsRequest(token) : Promise.resolve([] as WorkspaceInterviewAssessmentRecord[]),
        ]);
        if (cancelled) return;
        if (results[0].status === "fulfilled") {
          setSchools(results[0].value.schools);
        }
        if (results[1].status === "fulfilled") {
          setAssessments(results[1].value);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  async function handleRefresh() {
    if (refreshing || !hydrated || !token) return;
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        adminUsersRequest(),
        workspaceInterviewAssessmentsRequest(token),
      ]);
      if (results[0].status === "fulfilled") setSchools(results[0].value.schools);
      if (results[1].status === "fulfilled") setAssessments(results[1].value);
    } finally {
      setRefreshing(false);
    }
  }

  const rows = useMemo<DownloadableRow[]>(() => {
    const byNpsn = new Map<string, WorkspaceInterviewAssessmentRecord>();
    for (const a of assessments) {
      byNpsn.set(a.schoolNpsn, a);
    }
    const sorted = [...schools].sort((a, b) => a.name.localeCompare(b.name, "id"));
    return sorted.map((school, i) => {
      const assessment = byNpsn.get(school.npsn) ?? null;
      return {
        no: i + 1,
        npsn: school.npsn,
        provinsi: school.provinsi ?? "",
        kotaKabupaten: school.kotaKabupaten ?? "",
        nama: school.name,
        schoolId: school.id,
        sudahDinilai: !!assessment,
        nilai: assessment ? Number(assessment.totalScore ?? 0) : null,
        rekomendasi: assessment ? assessment.recommendation ?? null : null,
        fasilitatorAlatNama: assessment ? assessment.facilitatorEquipmentName ?? null : null,
        updateTerakhir: assessment ? assessment.updatedAt ?? null : null,
        answersRaw: assessment ? ((assessment.answers ?? {}) as InterviewAnswersPayload) : null,
        noteFinal: assessment ? assessment.note ?? null : null,
      };
    });
  }, [schools, assessments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.npsn, r.provinsi, r.kotaKabupaten, r.nama, r.fasilitatorAlatNama ?? "", r.rekomendasi ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    const total = rows.length;
    const sudah = rows.filter((r) => r.sudahDinilai).length;
    const belum = Math.max(total - sudah, 0);
    const avg =
      sudah > 0
        ? Math.round(
            rows.reduce((sum, r) => sum + (r.nilai ?? 0), 0) / sudah,
          )
        : 0;
    return { total, sudah, belum, avg };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Sekolah"
          value={`${summary.total}`}
          helper="Daftar sekolah yang menerima penugasan wawancara"
          icon={<Building2 className="h-4 w-4" />}
          tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Sudah Dinilai"
          value={`${summary.sudah}`}
          helper="Sekolah yang penilaian wawancara-nya tersimpan"
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          label="Belum Dinilai"
          value={`${summary.belum}`}
          helper="Sekolah yang menunggu penilaian wawancara"
          icon={<Sparkles className="h-4 w-4" />}
          tone="bg-amber-100 text-amber-700"
        />
        <SummaryCard
          label="Rata-rata Nilai"
          value={summary.sudah > 0 ? `${summary.avg}` : "-"}
          helper="Rata-rata skor penilaian (skala 0–100)"
          icon={<BarChart3 className="h-4 w-4" />}
          tone="bg-sky-100 text-sky-700"
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">Laporan Nilai Wawancara Per Sekolah</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Rekapitulasi hasil penilaian wawancara dari Fasilitator Alat untuk masing-masing
                sekolah. Total <span className="font-semibold text-slate-900">{summary.total}</span>{" "}
                sekolah,{" "}
                <span className="font-semibold text-emerald-700">{summary.sudah}</span> sudah
                dinilai,{" "}
                <span className="font-semibold text-amber-700">{summary.belum}</span> belum dinilai.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm text-slate-600 w-full lg:w-[340px]">
                <span className="font-medium text-slate-900">Cari Sekolah</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari NPSN, provinsi, kab/kota, nama sekolah, fasilitator..."
                    className="pl-9"
                  />
                </div>
              </label>
              <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="inline-flex items-center gap-2">
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? "Memperbarui..." : "Perbarui Data"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || rows.length === 0}
                  onClick={() => triggerTsvDownloadNilaiSaja(filtered)}
                  className="inline-flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Nilai Saja
                </Button>
                <Button
                  type="button"
                  disabled={loading || rows.length === 0}
                  onClick={() => triggerTsvDownloadLengkapDenganKomentar(filtered)}
                  className="inline-flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Skor &amp; Komentar Lengkap
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm font-medium">Memuat data laporan wawancara...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-500">
              Tidak ada sekolah yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1260px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-16 px-4 py-3">No</th>
                    <th className="w-40 px-4 py-3">NPSN</th>
                    <th className="w-44 px-4 py-3">Provinsi</th>
                    <th className="w-48 px-4 py-3">Kota / Kabupaten</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="w-32 px-4 py-3 text-right">Nilai</th>
                    <th className="w-56 px-4 py-3">Rekomendasi</th>
                    <th className="w-52 px-4 py-3">Fasilitator Alat</th>
                    <th className="w-44 px-4 py-3">Update Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((row) => {
                    const nilaiPct = row.nilai ?? 0;
                    const nilaiWarna =
                      nilaiPct >= 85
                        ? "text-emerald-700"
                        : nilaiPct >= 70
                          ? "text-sky-700"
                          : nilaiPct >= 55
                            ? "text-amber-700"
                            : row.sudahDinilai
                              ? "text-rose-700"
                              : "text-slate-400";
                    return (
                      <tr key={row.schoolId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-4 text-slate-700">{row.no}</td>
                        <td className="px-4 py-4 font-medium text-slate-950 tabular-nums">{row.npsn}</td>
                        <td className="px-4 py-4 text-slate-700">
                          {row.provinsi || <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {row.kotaKabupaten || <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-4 text-slate-700">{row.nama}</td>
                        <td className={`px-4 py-4 text-right font-bold tabular-nums ${nilaiWarna}`}>
                          {row.sudahDinilai ? (
                            <>
                              {row.nilai}
                              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">/100</span>
                            </>
                          ) : (
                            <Badge variant="secondary" className="float-right">Belum Dinilai</Badge>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {row.sudahDinilai && row.rekomendasi ? (
                            <span className={categoryBadgeClass(row.rekomendasi)}>
                              {row.rekomendasi}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div className="flex items-center gap-2">
                            {row.sudahDinilai && row.fasilitatorAlatNama ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="text-sm font-medium">{row.fasilitatorAlatNama}</span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600 tabular-nums text-xs">
                          {fmtDateTime(row.updateTerakhir)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card className="rounded-[24px]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950 tabular-nums">{props.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{props.helper}</p>
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", props.tone)}>
            {props.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
