"use client";

import { Download, Eye, Loader2, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { workspaceAdminSelectionRequest } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type StageKey = "IDENTITAS" | "ADMINISTRASI" | "SURVEY_HARGA" | "RPKP" | "RAB" | "RPD";

const STAGE_LABELS: Record<StageKey, string> = {
  IDENTITAS: "Identitas",
  ADMINISTRASI: "Administrasi",
  SURVEY_HARGA: "Survey Harga",
  RPKP: "RPKP",
  RAB: "RAB",
  RPD: "RPD",
};

interface SchoolRow {
  no: number;
  npsn: string;
  namaSekolah: string;
  kabKota: string;
  provinsi: string;
}

function displayText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "-";
  return text;
}

const buildPreviewUrl = (npsn: string, stage: StageKey) =>
  `/api/v1/workspace-data/print/preview/${encodeURIComponent(stage)}/${encodeURIComponent(npsn)}`;
const buildDownloadUrl = (npsn: string, stage: StageKey) =>
  `/api/v1/workspace-data/print/download/${encodeURIComponent(stage)}/${encodeURIComponent(npsn)}`;

function StageActionCell({ npsn, stage }: { npsn: string; stage: StageKey }) {
  const previewHref = buildPreviewUrl(npsn, stage);
  const downloadHref = buildDownloadUrl(npsn, stage);
  return (
    <div className="flex flex-col items-start gap-2 whitespace-nowrap">
      <a href={previewHref} target="_blank" rel="noreferrer noopener" className="w-full">
        <Button type="button" variant="outline" size="sm" className="w-full gap-1 text-xs">
          <Eye className="h-3.5 w-3.5" />
          <span>Preview</span>
        </Button>
      </a>
      <a href={downloadHref} target="_self" className="w-full">
        <Button type="button" variant="default" size="sm" className="w-full gap-1 text-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Download</span>
        </Button>
      </a>
    </div>
  );
}

export function AdminDataSiapPrintPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await workspaceAdminSelectionRequest(session.token, {
          datasetKey: "ALL",
          scope: "light",
        });
        const regulerRows = Array.isArray(payload?.regulerRows) ? payload.regulerRows : [];
        const abtRows = Array.isArray(payload?.abtRows) ? payload.abtRows : [];
        const seenNpsn = new Set<string>();
        const combined: any[] = [];
        for (const row of [...regulerRows, ...abtRows]) {
          const npsn = String(row?.npsn ?? "").trim();
          if (!npsn || seenNpsn.has(npsn)) continue;
          seenNpsn.add(npsn);
          combined.push(row);
        }
        const normalized: SchoolRow[] = combined
          .map((r: any, i: number) => ({
            no: i + 1,
            npsn: String(r?.npsn ?? "").trim(),
            namaSekolah: String(r?.nama_sekolah ?? r?.namaSekolah ?? "").trim(),
            kabKota: String(r?.kab_kota ?? r?.kabKota ?? "").trim(),
            provinsi: String(r?.provinsi ?? "").trim(),
          }))
          .filter((r) => r.npsn);
        if (!cancelled) setRows(normalized);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Gagal memuat data sekolah.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.npsn, r.namaSekolah, r.kabKota, r.provinsi]
        .map((s) => String(s).toLowerCase())
        .some((s) => s.includes(q)),
    );
  }, [rows, query]);

  const stages: StageKey[] = ["IDENTITAS", "ADMINISTRASI", "SURVEY_HARGA", "RPKP", "RAB", "RPD"];

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pusat Dokumen Sekolah
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="display-font text-3xl font-semibold text-slate-950">
              Data Sekolah Siap Print
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Unduh dan preview seluruh dokumen administrasi sekolah mulai dari Identitas, Administrasi,
              Survey Harga, RPKP, RAB, sampai RPD dalam format standar Ditjen Pendidikan Vokasi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Printer className="h-3.5 w-3.5" />
              <span>Total {rows.length} sekolah</span>
            </Badge>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Cari NPSN, nama sekolah, kab/kota, provinsi..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-slate-500">
              Menampilkan {filteredRows.length} dari {rows.length} sekolah
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="w-[60px] px-4 py-4">No</th>
                  <th className="w-[120px] px-4 py-4">NPSN</th>
                  {stages.map((s) => (
                    <th key={s} className="px-4 py-4 text-center">
                      {STAGE_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top text-slate-700">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Memuat daftar sekolah...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-rose-600">
                      {displayText(error)}
                    </td>
                  </tr>
                )}
                {!loading && !error && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada data sekolah yang sesuai pencarian.
                    </td>
                  </tr>
                )}
                {!loading && !error && filteredRows.length > 0 &&
                  filteredRows.map((r) => (
                    <tr key={r.npsn} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-4 tabular-nums text-slate-500">{r.no}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {displayText(r.npsn)}
                          </span>
                          <span className="text-xs text-slate-600">{displayText(r.namaSekolah)}</span>
                          <span className="text-[11px] text-slate-400">
                            {displayText(r.kabKota)} · {displayText(r.provinsi)}
                          </span>
                        </div>
                      </td>
                      {stages.map((s) => (
                        <td key={s} className="px-2 py-4">
                          <div className="flex justify-center">
                            <StageActionCell npsn={r.npsn} stage={s} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
