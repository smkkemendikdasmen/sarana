"use client";

import {
  Building2,
  ShoppingCart,
  CheckCircle2,
  Clock4,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminRpkpReportRequest,
  type AdminRpkpItemRow,
  type AdminRpkpPerSchoolRow,
  type AdminRpkpReportResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type RpkpTabKey = "per-sekolah" | "items";

const rpkpTabs: Array<{ key: RpkpTabKey; label: string }> = [
  { key: "per-sekolah", label: "Rekap Per Sekolah" },
  { key: "items", label: "Detail Item Alat RPKP" },
];

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function todayFileStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

function shopBadgeTone(shop: string): string {
  if (shop === "shop1") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/25";
  if (shop === "shop2") return "bg-indigo-500/15 text-indigo-700 border-indigo-500/25";
  if (shop === "shop3") return "bg-amber-500/15 text-amber-700 border-amber-500/25";
  return "bg-slate-500/15 text-slate-700 border-slate-500/25";
}

export function AdminRpkpReportsPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<RpkpTabKey>("per-sekolah");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<AdminRpkpReportResponse | null>(null);
  const [exporting, setExporting] = useState<"" | "xlsx" | "json">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!token) {
          setReport(null);
          return;
        }
        const res = await adminRpkpReportRequest(token);
        if (!cancelled) setReport(res);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal memuat laporan RPKP");
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
    setError(null);
    try {
      const res = await adminRpkpReportRequest(token);
      setReport(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ulang laporan");
    } finally {
      setRefreshing(false);
    }
  }

  const summaryCards = useMemo(() => {
    const meta = report?.meta;
    return [
      {
        title: "Total Sekolah",
        value: meta?.sekolahTotal ?? 0,
        icon: Building2,
        tone: "bg-primary/10 text-primary-700",
        sub: `${meta?.sekolahDenganProposal ?? 0} sekolah sudah buat Proposal`,
      },
      {
        title: "RPKP Terisi",
        value: meta?.sekolahDenganRpkp ?? 0,
        icon: CheckCircle2,
        tone: "bg-emerald-100 text-emerald-700",
        sub: `${meta?.sekolahBelumAdaRpkp ?? 0} sekolah belum isi RPKP`,
      },
      {
        title: "Total Item Alat",
        value: meta?.totalItemRpkpPilihan ?? 0,
        icon: Wrench,
        tone: "bg-indigo-100 text-indigo-700",
        sub: "Item alat per RPKP yang sudah dipilih tokonya",
      },
      {
        title: "Total Anggaran RPKP",
        value: formatIdr(meta?.totalNilaiRpkpRp ?? 0),
        icon: ShoppingCart,
        tone: "bg-amber-100 text-amber-700",
        sub: "Akumulasi seluruh line total item terpilih",
      },
    ];
  }, [report]);

  const filteredPerSchool = useMemo((): AdminRpkpPerSchoolRow[] => {
    const rows = report?.perSchool ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.schoolNpsn.toLowerCase().includes(q) ||
        r.schoolName.toLowerCase().includes(q)
      );
    });
  }, [report, query]);

  const filteredItems = useMemo((): AdminRpkpItemRow[] => {
    const rows = report?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.schoolNpsn.toLowerCase().includes(q) ||
        r.schoolName.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q) ||
        r.concentrationCode.toLowerCase().includes(q) ||
        r.concentrationName.toLowerCase().includes(q) ||
        r.specification.toLowerCase().includes(q) ||
        r.selectedShopName.toLowerCase().includes(q)
      );
    });
  }, [report, query]);

  async function handleExportXlsx() {
    if (!report || exporting) return;
    setExporting("xlsx");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const perSchoolSheet = (report.perSchool ?? []).map((r, i) => ({
        No: i + 1,
        "NPSN Sekolah": r.schoolNpsn,
        "Nama Sekolah": r.schoolName,
        "Jumlah Konsentrasi": r.konsentrasiCount,
        "Total Item Alat": r.totalItems,
        "Total Nilai Anggaran (Rp)": r.totalNilai,
      }));
      const ws1 = XLSX.utils.json_to_sheet(perSchoolSheet);
      XLSX.utils.book_append_sheet(wb, ws1, "Rekap Per Sekolah");

      const itemsSheet = (report.items ?? []).map((r, i) => ({
        No: i + 1,
        "NPSN Sekolah": r.schoolNpsn,
        "Nama Sekolah": r.schoolName,
        "Kode Konsentrasi": r.concentrationCode,
        "Nama Konsentrasi": r.concentrationName,
        "Kode Item": r.itemRowId,
        "Nama Alat": r.itemName,
        Spesifikasi: r.specification,
        Konformitas: r.conformity,
        Qty: r.quantity,
        Satuan: r.unit,
        "Toko Dipilih": r.selectedShopLabel,
        "Nama Toko": r.selectedShopName,
        "Harga Satuan + Pajak (Rp)": r.selectedPriceWithTaxRp,
        "Biaya Pengiriman (Rp)": r.selectedShippingCostRp,
        "Biaya Pemasangan (Rp)": r.selectedInstallationCostRp,
        "Total Satuan (Rp)": r.selectedSatuanTotalRp,
        "Total Baris (Rp)": r.selectedLineTotalRp,
        "Link Toko": r.selectedShopLink,
        "Terakhir Diupdate": r.dataUpdatedAt ?? "",
      }));
      const ws2 = XLSX.utils.json_to_sheet(itemsSheet);
      XLSX.utils.book_append_sheet(wb, ws2, "Item RPKP Terpilih");

      XLSX.writeFile(wb, `Laporan-RPKP-SARANASMK-${todayFileStamp()}.xlsx`);
    } finally {
      setExporting("");
    }
  }

  async function handleExportJson() {
    if (!report || exporting) return;
    setExporting("json");
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-RPKP-SARANASMK-${todayFileStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <Card key={idx} className="overflow-hidden rounded-[24px] border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {c.title}
                </CardTitle>
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-2xl", c.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-950">{c.value}</div>
                <p className="mt-2 text-xs text-slate-500">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
            <div className="relative w-full sm:w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari NPSN, nama sekolah, nama alat, KK, toko..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-xl border-slate-200 pl-9 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing || loading || !token}
              className="h-10 rounded-xl"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportJson}
              disabled={!report || !!exporting || loading}
              className="h-10 rounded-xl"
            >
              {exporting === "json" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="mr-2 h-4 w-4" />
              )}
              Export JSON
            </Button>
            <Button
              type="button"
              onClick={handleExportXlsx}
              disabled={!report || !!exporting || loading}
              className="h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {exporting === "xlsx" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Excel
            </Button>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="w-full rounded-full bg-slate-100 p-1">
            <div className="flex gap-1 overflow-x-auto">
              {rpkpTabs.map((tab) => {
                const count =
                  tab.key === "per-sekolah" ? filteredPerSchool.length : filteredItems.length;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition",
                      activeTab === tab.key
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
                    )}
                  >
                    <span>{tab.label}</span>
                    <Badge variant="secondary" className="h-6">
                      {count.toLocaleString("id-ID")}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Memuat laporan RPKP seluruh sekolah...
          </div>
        ) : error ? (
          <div className="mx-6 mb-6 rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : activeTab === "per-sekolah" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-6 py-3 text-left w-16">No</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left">NPSN</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left">Nama Sekolah</th>
                  <th className="whitespace-nowrap px-6 py-3 text-right">Jumlah KK</th>
                  <th className="whitespace-nowrap px-6 py-3 text-right">Total Item</th>
                  <th className="whitespace-nowrap px-6 py-3 text-right">Total Nilai Anggaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredPerSchool.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">
                      Tidak ada data sekolah RPKP.
                    </td>
                  </tr>
                ) : (
                  filteredPerSchool.map((r, i) => (
                    <tr key={r.schoolId} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-6 py-3 text-slate-500">{i + 1}</td>
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-950">
                        {r.schoolNpsn}
                      </td>
                      <td className="px-6 py-3 text-slate-900">{r.schoolName}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-slate-950">
                        {r.konsentrasiCount}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-semibold text-primary-700">
                        {r.totalItems.toLocaleString("id-ID")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-semibold text-emerald-700">
                        {formatIdr(r.totalNilai)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1600px] text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left w-12">No</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">NPSN</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Sekolah</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">KK</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Nama Alat</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Spesifikasi</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Qty</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Sat</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Toko</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Satuan + Pajak</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Ongkir</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Pasang</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Total Satuan</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Total Line</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-6 py-16 text-center text-sm text-slate-500">
                      Tidak ada item RPKP yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((r, i) => (
                    <tr key={`${r.schoolId}-${r.itemRowId}`} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{i + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">
                        {r.schoolNpsn}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900 max-w-[220px] truncate">
                        {r.schoolName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 max-w-[160px] truncate">
                        <div className="text-[11px] uppercase text-slate-500">
                          {r.concentrationCode}
                        </div>
                        <div className="text-slate-800">{r.concentrationName || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950 max-w-[240px] truncate">
                        {r.itemName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 max-w-[260px] truncate">
                        {r.specification || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-primary-700">
                        {r.quantity}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.unit || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge className={cn("border", shopBadgeTone(r.selectedShop))}>
                          {r.selectedShopLabel}
                        </Badge>
                        <div className="mt-1 text-[12px] text-slate-600 max-w-[180px] truncate">
                          {r.selectedShopName || "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatIdr(r.selectedPriceWithTaxRp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {formatIdr(r.selectedShippingCostRp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {formatIdr(r.selectedInstallationCostRp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-indigo-700">
                        {formatIdr(r.selectedSatuanTotalRp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                        {formatIdr(r.selectedLineTotalRp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.selectedShopLink ? (
                          <a
                            href={r.selectedShopLink}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary-700 underline-offset-2 hover:underline"
                          >
                            Buka
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Clock4 className="h-3.5 w-3.5" />
            <span>
              Data dihasilkan pada{" "}
              <span className="font-medium text-slate-700">
                {report?.meta.generatedAt
                  ? new Date(report.meta.generatedAt).toLocaleString("id-ID")
                  : "-"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Download className="h-3.5 w-3.5" />
            <span>
              {activeTab === "per-sekolah"
                ? `${filteredPerSchool.length.toLocaleString("id-ID")} baris rekap per sekolah`
                : `${filteredItems.length.toLocaleString("id-ID")} item alat RPKP terpilih`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
