"use client";

import {
  BarChart3,
  Building2,
  Download,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  schoolConcentrationsSummaryRequest,
  workspaceInterviewAssessmentsRequest,
  type AdminSchoolOption,
  type SchoolConcentrationsSummaryRecord,
  type WorkspaceInterviewAssessmentRecord,
} from "@/lib/api";
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

function rankBadgeClass(rank: 1 | 2 | 3): string {
  if (rank === 1) return "bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-inset ring-amber-100";
  if (rank === 2) return "bg-slate-100 text-slate-700 border-slate-200 ring-1 ring-inset ring-slate-200";
  return "bg-sky-50 text-sky-800 border-sky-200 ring-1 ring-inset ring-sky-100";
}

interface GabunganRow {
  no: number;
  schoolId: string;
  npsn: string;
  provinsi: string;
  kotaKabupaten: string;
  nama: string;
  sudahDinilai: boolean;
  nilai: number | null;
  rekomendasi: string | null;
  note: string | null;
  jurusan1: { name: string; studentCount: number } | null;
  jurusan2: { name: string; studentCount: number } | null;
  jurusan3: { name: string; studentCount: number } | null;
  totalJurusan: number;
  totalStudents: number;
  totalRombel: number;
}

function todayFileStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
function tsvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const clean = text.replace(/\t/g, " ").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
  return `"${clean.replaceAll('"', '""')}"`;
}

function sortRowsByProvinsi(rows: GabunganRow[]): GabunganRow[] {
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

function triggerTsvDownloadGabungan(rows: GabunganRow[]) {
  const headers = [
    "No", "NPSN", "Provinsi", "Kota/Kabupaten", "Nama Sekolah",
    "Status Penilaian", "Nilai (0-100)", "Rekomendasi", "Catatan Kesimpulan (Note)",
    "KK Prioritas 1", "Jumlah siswa",
    "KK Prioritas 2", "Jumlah siswa",
    "KK Prioritas 3", "Jumlah siswa",
    "Total Jurusan Aktif", "Total Siswa", "Total Rombel",
  ];
  const lines = [headers.map(tsvEscape).join("\t")];
  const sorted = sortRowsByProvinsi(rows);
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]!;
    lines.push([
      i + 1,
      r.npsn, r.provinsi, r.kotaKabupaten, r.nama,
      r.sudahDinilai ? "Sudah Dinilai" : "Belum Dinilai",
      r.nilai ?? "", r.rekomendasi ?? "", r.note ?? "",
      r.jurusan1?.name ?? "", r.jurusan1?.studentCount ?? "",
      r.jurusan2?.name ?? "", r.jurusan2?.studentCount ?? "",
      r.jurusan3?.name ?? "", r.jurusan3?.studentCount ?? "",
      r.totalJurusan, r.totalStudents, r.totalRombel,
    ].map(tsvEscape).join("\t"));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-gabungan-${todayFileStamp()}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface SummaryCardProps {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
  tone?: string;
}
function SummaryCard({ label, value, helper, icon, tone }: SummaryCardProps) {
  return (
    <Card className="rounded-[24px] border-slate-200/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 tabular-nums">{value}</p>
            {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
          </div>
          {icon ? (
            <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", tone ?? "bg-slate-100 text-slate-600")}>
              {icon}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function JurusanBadge(props: { rank: 1 | 2 | 3; jurusan: { name: string; studentCount: number } | null }) {
  if (!props.jurusan || !props.jurusan.name) {
    return <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">Belum Ada Data</span>;
  }
  return (
    <div className="space-y-1.5">
      <Badge variant="outline" className={rankBadgeClass(props.rank)}>
        #{props.rank}
      </Badge>
      <p className="text-sm font-medium leading-snug text-slate-900">{props.jurusan.name}</p>
      <p className="text-xs font-semibold text-slate-600 tabular-nums">
        {props.jurusan.studentCount.toLocaleString("id-ID")} siswa
      </p>
    </div>
  );
}

export function AdminLaporanGabunganPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [assessments, setAssessments] = useState<WorkspaceInterviewAssessmentRecord[]>([]);
  const [concentrations, setConcentrations] = useState<SchoolConcentrationsSummaryRecord[]>([]);

  useEffect(() => { hydrate(); }, [hydrate]);

  async function load() {
    if (!hydrated) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        adminUsersRequest(),
        token ? workspaceInterviewAssessmentsRequest(token) : Promise.resolve([] as WorkspaceInterviewAssessmentRecord[]),
        token ? schoolConcentrationsSummaryRequest(token) : Promise.resolve([] as SchoolConcentrationsSummaryRecord[]),
      ]);
      if (results[0].status === "fulfilled") setSchools(results[0].value.schools);
      if (results[1].status === "fulfilled") setAssessments(results[1].value);
      if (results[2].status === "fulfilled") setConcentrations(results[2].value);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hydrated, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    if (refreshing || !hydrated || !token) return;
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const rows = useMemo<GabunganRow[]>(() => {
    const byNpsnWaw = new Map<string, WorkspaceInterviewAssessmentRecord>();
    for (const a of assessments) byNpsnWaw.set(a.schoolNpsn, a);
    const byNpsnKons = new Map<string, SchoolConcentrationsSummaryRecord>();
    for (const k of concentrations) byNpsnKons.set(k.npsn, k);

    const sorted = [...schools].sort((a, b) => a.name.localeCompare(b.name, "id"));
    return sorted.map((s, i) => {
      const w = byNpsnWaw.get(s.npsn) ?? null;
      const k = byNpsnKons.get(s.npsn) ?? null;
      const top3 = k?.top3Concentrations ?? [];
      const j1 = top3[0] ? { name: top3[0].name, studentCount: Number(top3[0].studentCount ?? 0) } : null;
      const j2 = top3[1] ? { name: top3[1].name, studentCount: Number(top3[1].studentCount ?? 0) } : null;
      const j3 = top3[2] ? { name: top3[2].name, studentCount: Number(top3[2].studentCount ?? 0) } : null;
      return {
        no: i + 1,
        schoolId: s.id,
        npsn: s.npsn,
        provinsi: s.provinsi ?? "",
        kotaKabupaten: s.kotaKabupaten ?? "",
        nama: s.name,
        sudahDinilai: !!w,
        nilai: w ? Number(w.totalScore ?? 0) : null,
        rekomendasi: w ? w.recommendation ?? null : null,
        note: w ? w.note ?? null : null,
        jurusan1: j1,
        jurusan2: j2,
        jurusan3: j3,
        totalJurusan: k?.concentrations?.length ?? 0,
        totalStudents: Number(k?.totalStudents ?? 0),
        totalRombel: Number(k?.totalRombel ?? 0),
      };
    });
  }, [schools, assessments, concentrations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.npsn, r.provinsi, r.kotaKabupaten, r.nama, r.rekomendasi ?? "",
       r.jurusan1?.name ?? "", r.jurusan2?.name ?? "", r.jurusan3?.name ?? ""].join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    const total = rows.length;
    const sudah = rows.filter((r) => r.sudahDinilai).length;
    const belum = Math.max(total - sudah, 0);
    const totalSeluruhSiswa = rows.reduce((s, r) => s + (r.totalStudents ?? 0), 0);
    const totalJurusanUnikTop3 = (() => {
      const set = new Set<string>();
      for (const r of rows) {
        if (r.jurusan1?.name) set.add(r.jurusan1.name.trim());
        if (r.jurusan2?.name) set.add(r.jurusan2.name.trim());
        if (r.jurusan3?.name) set.add(r.jurusan3.name.trim());
      }
      return set.size;
    })();
    const avg = sudah > 0 ? Math.round(rows.reduce((s, r) => s + (r.nilai ?? 0), 0) / sudah) : 0;
    return { total, sudah, belum, avg, totalSeluruhSiswa, totalJurusanUnikTop3 };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Sekolah" value={`${summary.total}`}
          helper="131 sekolah sasaran gabungan wawancara + konsentrasi"
          icon={<Building2 className="h-4 w-4" />} tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Sudah Dinilai Wawancara" value={`${summary.sudah}`}
          helper={`Belum dinilai: ${summary.belum} sekolah`}
          icon={<Badge variant="secondary">Nilai</Badge> as unknown as React.ReactNode}
          tone="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          label="Rata-rata Nilai Wawancara" value={summary.sudah > 0 ? `${summary.avg}` : "-"}
          helper="Skala 0–100 dari seluruh sekolah yang sudah dinilai"
          icon={<BarChart3 className="h-4 w-4" />} tone="bg-sky-100 text-sky-700"
        />
        <SummaryCard
          label="Total Seluruh Siswa" value={summary.totalSeluruhSiswa.toLocaleString("id-ID")}
          helper={`${summary.totalJurusanUnikTop3} jenis KK unik di top 3 prioritas`}
          icon={<Users className="h-4 w-4" />} tone="bg-amber-100 text-amber-700"
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">Laporan Gabungan Wawancara &amp; Konsentrasi Keahlian Prioritas</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Rekap gabungan 17 kolom: data profil wilayah sekolah + hasil penilaian wawancara fasilitator alat + 3 KK prioritas
                dengan jumlah siswa terbanyak (profil sekolah). <span className="font-semibold text-slate-900">File download diurut per Provinsi → Kab/Kota → Nama sekolah.</span>
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm text-slate-600 w-full lg:w-[360px]">
                <span className="font-medium text-slate-900">Cari Sekolah / Jurusan</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari NPSN, provinsi, kab/kota, nama sekolah, rekomendasi, nama jurusan..."
                    className="pl-9"
                  />
                </div>
              </label>
              <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="inline-flex items-center gap-2">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {refreshing ? "Memperbarui..." : "Perbarui Data"}
              </Button>
              <Button
                type="button"
                disabled={loading || rows.length === 0}
                onClick={() => triggerTsvDownloadGabungan(filtered)}
                className="inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Laporan Gabungan (TSV)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm font-medium">Memuat data laporan gabungan (wawancara + konsentrasi)...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-500">
              Tidak ada sekolah yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1780px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-14 px-3 py-3">No</th>
                    <th className="w-36 px-3 py-3">NPSN</th>
                    <th className="w-40 px-3 py-3">Provinsi</th>
                    <th className="w-44 px-3 py-3">Kota / Kabupaten</th>
                    <th className="px-3 py-3">Nama Sekolah</th>
                    <th className="w-36 px-3 py-3">Status Penilaian</th>
                    <th className="w-28 px-3 py-3 text-right">Nilai</th>
                    <th className="w-52 px-3 py-3">Rekomendasi</th>
                    <th className="w-64 px-3 py-3">Catatan Kesimpulan (Note)</th>
                    <th className="w-52 px-3 py-3"><span className="inline-flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-amber-600"/> KK Prioritas 1</span></th>
                    <th className="w-28 px-3 py-3 text-right">Jumlah Siswa</th>
                    <th className="w-52 px-3 py-3"><span className="inline-flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-slate-500"/> KK Prioritas 2</span></th>
                    <th className="w-28 px-3 py-3 text-right">Jumlah Siswa</th>
                    <th className="w-52 px-3 py-3"><span className="inline-flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-sky-700"/> KK Prioritas 3</span></th>
                    <th className="w-28 px-3 py-3 text-right">Jumlah Siswa</th>
                    <th className="w-36 px-3 py-3 text-right">Total Jurusan Aktif</th>
                    <th className="w-32 px-3 py-3 text-right">Total Siswa</th>
                    <th className="w-32 px-3 py-3 text-right">Total Rombel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 align-top">
                  {filtered.map((r) => {
                    const nilaiPct = r.nilai ?? 0;
                    const nilaiWarna =
                      nilaiPct >= 85 ? "text-emerald-700" :
                      nilaiPct >= 70 ? "text-sky-700" :
                      nilaiPct >= 55 ? "text-amber-700" :
                      r.sudahDinilai ? "text-rose-700" : "text-slate-400";
                    return (
                      <tr key={r.schoolId} className="hover:bg-slate-50/60">
                        <td className="px-3 py-4 text-slate-700">{r.no}</td>
                        <td className="px-3 py-4 font-medium text-slate-950 tabular-nums">{r.npsn}</td>
                        <td className="px-3 py-4 text-slate-700">{r.provinsi || <span className="text-xs text-slate-400">-</span>}</td>
                        <td className="px-3 py-4 text-slate-700">{r.kotaKabupaten || <span className="text-xs text-slate-400">-</span>}</td>
                        <td className="px-3 py-4 text-slate-700 font-medium">{r.nama}</td>
                        <td className="px-3 py-4">
                          {r.sudahDinilai
                            ? <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Sudah Dinilai</Badge>
                            : <Badge variant="secondary" className="bg-slate-50 text-slate-500 border-slate-200">Belum Dinilai</Badge>}
                        </td>
                        <td className={`px-3 py-4 text-right font-bold tabular-nums ${nilaiWarna}`}>
                          {r.sudahDinilai ? (
                            <>{r.nilai}<span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">/100</span></>
                          ) : <span className="text-xs font-medium text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-4">
                          {r.sudahDinilai && r.rekomendasi ? (
                            <span className={categoryBadgeClass(r.rekomendasi)}>{r.rekomendasi}</span>
                          ) : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {r.note ? <p className="text-xs leading-5 whitespace-pre-wrap line-clamp-4">{r.note}</p> : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-4"><JurusanBadge rank={1} jurusan={r.jurusan1}/></td>
                        <td className="px-3 py-4 text-right tabular-nums font-semibold text-slate-800">
                          {r.jurusan1 ? r.jurusan1.studentCount.toLocaleString("id-ID") : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-4"><JurusanBadge rank={2} jurusan={r.jurusan2}/></td>
                        <td className="px-3 py-4 text-right tabular-nums font-semibold text-slate-800">
                          {r.jurusan2 ? r.jurusan2.studentCount.toLocaleString("id-ID") : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-4"><JurusanBadge rank={3} jurusan={r.jurusan3}/></td>
                        <td className="px-3 py-4 text-right tabular-nums font-semibold text-slate-800">
                          {r.jurusan3 ? r.jurusan3.studentCount.toLocaleString("id-ID") : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums font-semibold text-slate-800">{r.totalJurusan}</td>
                        <td className="px-3 py-4 text-right tabular-nums font-semibold text-slate-950">{r.totalStudents.toLocaleString("id-ID")}</td>
                        <td className="px-3 py-4 text-right tabular-nums font-semibold text-slate-800">{r.totalRombel.toLocaleString("id-ID")}</td>
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
