"use client";

import {
  Building2,
  Download,
  FileSpreadsheet,
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
  schoolConcentrationsSummaryRequest,
  type SchoolConcentrationsSummaryRecord,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

interface KonsentrasiRow {
  no: number;
  id: string;
  npsn: string;
  nama: string;
  totalStudents: number;
  totalRombel: number;
  jurusan1: { name: string; studentCount: number } | null;
  jurusan2: { name: string; studentCount: number } | null;
  jurusan3: { name: string; studentCount: number } | null;
  totalJurusan: number;
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

function triggerTsvDownload(rows: KonsentrasiRow[]) {
  const headers = [
    "No",
    "NPSN",
    "Nama Sekolah",
    "Jurusan 1 (Siswa Terbanyak)",
    "Jml Siswa Jurusan 1",
    "Jurusan 2",
    "Jml Siswa Jurusan 2",
    "Jurusan 3",
    "Jml Siswa Jurusan 3",
    "Total Jurusan Aktif",
    "Total Seluruh Siswa",
    "Total Rombongan Belajar",
  ];
  const lines = [headers.map(tsvEscape).join("\t")];
  for (const r of rows) {
    lines.push([
      r.no,
      r.npsn,
      r.nama,
      r.jurusan1?.name ?? "",
      r.jurusan1?.studentCount ?? "",
      r.jurusan2?.name ?? "",
      r.jurusan2?.studentCount ?? "",
      r.jurusan3?.name ?? "",
      r.jurusan3?.studentCount ?? "",
      r.totalJurusan,
      r.totalStudents,
      r.totalRombel,
    ].map(tsvEscape).join("\t"));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-konsentrasi-keahlian-prioritas-${todayFileStamp()}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function AdminKonsentrasiKeahlianPrioritasPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<SchoolConcentrationsSummaryRecord[]>([]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await schoolConcentrationsSummaryRequest(token);
        if (!cancelled) setRecords(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  async function handleRefresh() {
    if (refreshing || loading || !token) return;
    setRefreshing(true);
    try {
      const data = await schoolConcentrationsSummaryRequest(token);
      setRecords(data);
    } finally {
      setRefreshing(false);
    }
  }

  const rows = useMemo<KonsentrasiRow[]>(() => {
    const sorted = [...records].sort((a, b) => a.name.localeCompare(b.name, "id"));
    return sorted.map((r, i) => {
      const top3 = r.top3Concentrations ?? r.concentrations?.slice(0, 3) ?? [];
      return {
        no: i + 1,
        id: r.id,
        npsn: r.npsn,
        nama: r.name,
        totalStudents: Number(r.totalStudents ?? 0) | 0,
        totalRombel: Number(r.totalRombel ?? 0) | 0,
        totalJurusan: r.concentrations?.length ?? top3.length,
        jurusan1: top3[0] ? { name: top3[0].name, studentCount: top3[0].studentCount } : null,
        jurusan2: top3[1] ? { name: top3[1].name, studentCount: top3[1].studentCount } : null,
        jurusan3: top3[2] ? { name: top3[2].name, studentCount: top3[2].studentCount } : null,
      };
    });
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.npsn,
        r.nama,
        r.jurusan1?.name ?? "",
        r.jurusan2?.name ?? "",
        r.jurusan3?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    const totalSekolah = rows.length;
    let totalSiswa = 0;
    let totalRombel = 0;
    let totalJurusanAktif = 0;
    const unikJurusan = new Set<string>();
    for (const r of rows) {
      totalSiswa += r.totalStudents;
      totalRombel += r.totalRombel;
      totalJurusanAktif += r.totalJurusan;
      if (r.jurusan1?.name) unikJurusan.add(r.jurusan1.name);
      if (r.jurusan2?.name) unikJurusan.add(r.jurusan2.name);
      if (r.jurusan3?.name) unikJurusan.add(r.jurusan3.name);
    }
    const avgJurusanPerSekolah = totalSekolah > 0 ? Math.round((totalJurusanAktif / totalSekolah) * 10) / 10 : 0;
    return { totalSekolah, totalSiswa, totalRombel, totalJurusanAktif, avgJurusanPerSekolah, totalJenisJurusanUnik: unikJurusan.size };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Sekolah"
          value={`${summary.totalSekolah}`}
          helper="Sekolah penerima program yang memiliki data profil & konsentrasi keahlian"
          icon={<Building2 className="h-4 w-4" />}
          tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Total Seluruh Siswa"
          value={`${summary.totalSiswa.toLocaleString("id-ID")}`}
          helper="Jumlah seluruh peserta didik di semua konsentrasi keahlian"
          icon={<Users className="h-4 w-4" />}
          tone="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          label="Jenis Jurusan Unik (Top 3)"
          value={`${summary.totalJenisJurusanUnik}`}
          helper="Jumlah nama konsentrasi keahlian yang muncul dalam 3 besar prioritas sekolah"
          icon={<GraduationCap className="h-4 w-4" />}
          tone="bg-sky-100 text-sky-700"
        />
        <SummaryCard
          label="Rata-rata Jurusan / Sekolah"
          value={summary.totalSekolah > 0 ? `${summary.avgJurusanPerSekolah.toFixed(1)}` : "-"}
          helper={`Total ${summary.totalJurusanAktif.toLocaleString("id-ID")} jurusan aktif di ${summary.totalSekolah} sekolah`}
          icon={<FileSpreadsheet className="h-4 w-4" />}
          tone="bg-amber-100 text-amber-700"
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl text-slate-950">Laporan Konsentrasi Keahlian Prioritas</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Rekap 3 konsentrasi keahlian (jurusan) dengan jumlah peserta didik terbanyak untuk masing-masing sekolah. Total {summary.totalSekolah} sekolah, {summary.totalSiswa.toLocaleString("id-ID")} siswa, {summary.totalRombel.toLocaleString("id-ID")} rombongan belajar.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm text-slate-600 w-full lg:w-[340px]">
                <span className="font-medium text-slate-900">Cari Sekolah / Jurusan</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari NPSN, nama sekolah, atau nama jurusan..."
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
                onClick={() => triggerTsvDownload(filtered)}
                className="inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download TSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm font-medium">Memuat data konsentrasi keahlian per sekolah...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-500">
              Tidak ada data yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-16 px-4 py-3">No</th>
                    <th className="w-40 px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="w-56 px-4 py-3">Jurusan 1 (Terbanyak)</th>
                    <th className="w-56 px-4 py-3">Jurusan 2</th>
                    <th className="w-56 px-4 py-3">Jurusan 3</th>
                    <th className="w-32 px-4 py-3 text-right">Total Siswa</th>
                    <th className="w-28 px-4 py-3 text-right">Total Rombel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-4 text-slate-700">{r.no}</td>
                      <td className="px-4 py-4 font-medium text-slate-950 tabular-nums">{r.npsn}</td>
                      <td className="px-4 py-4 text-slate-800">{r.nama}</td>
                      <td className="px-4 py-4">
                        <TopJurusanCell data={r.jurusan1} rank={1} />
                      </td>
                      <td className="px-4 py-4">
                        <TopJurusanCell data={r.jurusan2} rank={2} />
                      </td>
                      <td className="px-4 py-4">
                        <TopJurusanCell data={r.jurusan3} rank={3} />
                      </td>
                      <td className="px-4 py-4 text-right font-bold tabular-nums text-slate-950">
                        {r.totalStudents > 0 ? (
                          <>
                            {r.totalStudents.toLocaleString("id-ID")}
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">siswa</span>
                          </>
                        ) : (
                          <Badge variant="secondary" className="float-right">Belum Ada Data</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-700">
                        {r.totalRombel > 0 ? r.totalRombel.toLocaleString("id-ID") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TopJurusanCell(props: { data: { name: string; studentCount: number } | null; rank: 1 | 2 | 3 }) {
  const { data, rank } = props;
  if (!data || !data.name) {
    return <span className="text-xs text-slate-400">-</span>;
  }
  const tone =
    rank === 1
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : rank === 2
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : "bg-sky-100 text-sky-800 border-sky-200";
  const rankPill =
    rank === 1
      ? "bg-amber-600 text-white"
      : rank === 2
        ? "bg-slate-500 text-white"
        : "bg-sky-600 text-white";
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 min-w-0">
        <span className={`inline-flex shrink-0 h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tracking-wide ${rankPill}`}>
          #{rank}
        </span>
        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${tone}`}>
          <span className="truncate max-w-[160px]">{data.name}</span>
        </span>
      </div>
      <p className="pl-7 text-[11px] text-slate-500 font-medium tabular-nums">
        {data.studentCount.toLocaleString("id-ID")} siswa
      </p>
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
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${props.tone}`}>
            {props.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
