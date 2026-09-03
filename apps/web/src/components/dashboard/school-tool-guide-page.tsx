"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpenCheck, Download, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  perdirjenEquipmentBidangRequest,
  perdirjenEquipmentPdfPageMapRequest,
  perdirjenEquipmentSummaryRequest,
  type PerdirjenEquipmentDetailBidang,
  type PerdirjenEquipmentDetailKonsentrasi,
  type PerdirjenEquipmentItem,
  type PerdirjenEquipmentPdfPageMap,
  type PerdirjenEquipmentSummaryBidang,
} from "@/lib/api";
import {
  toolGuideCategoryMeta,
  toolGuidePdfPath,
  type ToolGuideCategoryKey,
} from "@/lib/tool-guide-data";
import { cn } from "@/lib/utils";

const initialCategory: ToolGuideCategoryKey = "minimal";

interface ToolGuideConcentrationOption {
  bidangCode: string;
  bidangKeahlian: string;
  programCode: string;
  programKeahlian: string;
  totalKonsentrasiBidang: number;
  konsentrasi: ToolGuideConcentrationData;
}

interface ToolGuideDisplayItem {
  no: string;
  nama_alat: string;
  fungsi_alat: string;
  spesifikasi_alat: string;
  rasio: string;
}

interface ToolGuideConcentrationData {
  kode: string;
  konsentrasi_keahlian: string;
  b2_1_peralatan_praktik_utama_kriteria_minimal: ToolGuideDisplayItem[];
  b2_2_peralatan_praktik_utama_kriteria_pengembangan: ToolGuideDisplayItem[];
  b2_3_peralatan_praktik_pendukung: ToolGuideDisplayItem[];
}

function mapEquipmentItems(items: PerdirjenEquipmentItem[]): ToolGuideDisplayItem[] {
  return items.map((item, index) => ({
    no: String(index + 1),
    nama_alat: item["Nama Alat"] ?? "",
    fungsi_alat: item["Fungsi Alat"] ?? "",
    spesifikasi_alat: item["Spesifikasi Alat"] ?? "",
    rasio: item["Rasio Satuan"] ?? "",
  }));
}

function mapConcentrationDetail(konsentrasi: PerdirjenEquipmentDetailKonsentrasi): ToolGuideConcentrationData {
  return {
    kode: konsentrasi.no,
    konsentrasi_keahlian: konsentrasi.nama,
    b2_1_peralatan_praktik_utama_kriteria_minimal: mapEquipmentItems(
      konsentrasi["Peralatan Praktik Utama Kriteria Minimal"],
    ),
    b2_2_peralatan_praktik_utama_kriteria_pengembangan: mapEquipmentItems(
      konsentrasi["Peralatan Praktik Utama Kriteria Pengembangan"],
    ),
    b2_3_peralatan_praktik_pendukung: mapEquipmentItems(konsentrasi["Peralatan Praktik Pendukung"]),
  };
}

export function SchoolToolGuidePage() {
  const [search, setSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ToolGuideCategoryKey>(initialCategory);
  const [summaryBidang, setSummaryBidang] = useState<PerdirjenEquipmentSummaryBidang[]>([]);
  const [selectedKonsentrasiCode, setSelectedKonsentrasiCode] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [concentrationOptions, setConcentrationOptions] = useState<ToolGuideConcentrationOption[]>([]);
  const [pdfPageMap, setPdfPageMap] = useState<PerdirjenEquipmentPdfPageMap>({});

  const normalizedSearch = search.trim().toLowerCase();
  const normalizedTableSearch = tableSearch.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;

    async function loadSummaryAndPageMap() {
      setLoadingSummary(true);
      setLoadError("");

      try {
        const [summaryData, pageMap] = await Promise.all([
          perdirjenEquipmentSummaryRequest(),
          perdirjenEquipmentPdfPageMapRequest(),
        ]);
        if (cancelled) {
          return;
        }

        setSummaryBidang(summaryData);
        setPdfPageMap(pageMap);
        setSelectedKonsentrasiCode("");
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    }

    void loadSummaryAndPageMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAllConcentrations() {
      if (summaryBidang.length === 0) {
        setConcentrationOptions([]);
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      setLoadError("");

      try {
        const bidangDetails = await Promise.all(
          summaryBidang.map(async (item) => [item.no, await perdirjenEquipmentBidangRequest(item.no)] as const),
        );

        if (cancelled) {
          return;
        }

        const bidangDetailMap = new Map<string, PerdirjenEquipmentDetailBidang>(bidangDetails);
        const nextOptions = summaryBidang.flatMap((bidang) => {
          const detail = bidangDetailMap.get(bidang.no);
          if (!detail) {
            return [];
          }

          return detail.program.flatMap((program) =>
            program.konsentrasi.map((konsentrasi) => ({
              bidangCode: bidang.no,
              bidangKeahlian: bidang.bidang,
              programCode: program.no,
              programKeahlian: program.nama,
              totalKonsentrasiBidang: bidang.totalKonsentrasi,
              konsentrasi: mapConcentrationDetail(konsentrasi),
            })),
          );
        });

        setConcentrationOptions(nextOptions);
        setSelectedKonsentrasiCode((currentCode) => currentCode || nextOptions[0]?.konsentrasi.kode || "");
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data panduan.");
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    void loadAllConcentrations();

    return () => {
      cancelled = true;
    };
  }, [summaryBidang]);

  const selectedOption = useMemo(() => {
    return concentrationOptions.find((option) => option.konsentrasi.kode === selectedKonsentrasiCode) ?? null;
  }, [concentrationOptions, selectedKonsentrasiCode]);

  const selectedKonsentrasi = selectedOption?.konsentrasi ?? null;
  const matchedConcentration = useMemo(() => {
    if (!normalizedSearch) {
      return null;
    }

    return (
      concentrationOptions.find((option) =>
        `${option.konsentrasi.kode} ${option.konsentrasi.konsentrasi_keahlian}`.toLowerCase().includes(normalizedSearch),
      ) ?? null
    );
  }, [concentrationOptions, normalizedSearch]);

  const matchCounts = useMemo<Record<ToolGuideCategoryKey, number>>(() => {
    if (!selectedKonsentrasi) {
      return { minimal: 0, pengembangan: 0, pendukung: 0 };
    }

    return toolGuideCategoryMeta.reduce<Record<ToolGuideCategoryKey, number>>((accumulator, category) => {
      const items = selectedKonsentrasi[category.dataKey];
      accumulator[category.key] = items.length;
      return accumulator;
    }, { minimal: 0, pengembangan: 0, pendukung: 0 });
  }, [selectedKonsentrasi]);

  const activeCategoryMeta = toolGuideCategoryMeta.find((category) => category.key === activeCategory) ?? toolGuideCategoryMeta[0];

  const filteredItems = useMemo(() => {
    if (!selectedKonsentrasi) {
      return [];
    }

    const items = selectedKonsentrasi[activeCategoryMeta.dataKey];
    return normalizedTableSearch
      ? items.filter((item) => item.nama_alat.toLowerCase().includes(normalizedTableSearch))
      : items;
  }, [activeCategoryMeta.dataKey, normalizedTableSearch, selectedKonsentrasi]);

  const totalItems = useMemo(() => {
    if (!selectedKonsentrasi) {
      return 0;
    }

    return toolGuideCategoryMeta.reduce((sum, category) => sum + selectedKonsentrasi[category.dataKey].length, 0);
  }, [selectedKonsentrasi]);

  const totalMatches = useMemo(() => {
    return toolGuideCategoryMeta.reduce((sum, category) => sum + matchCounts[category.key], 0);
  }, [matchCounts]);

  const selectedPdfPage = selectedKonsentrasiCode ? pdfPageMap[selectedKonsentrasiCode] : undefined;
  const selectedPdfHref = selectedPdfPage ? `${toolGuidePdfPath}#page=${selectedPdfPage.startPage}` : toolGuidePdfPath;

  function handleSearchChange(value: string) {
    setSearch(value);

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      return;
    }

    const concentrationMatch = concentrationOptions.find((option) =>
      `${option.konsentrasi.kode} ${option.konsentrasi.konsentrasi_keahlian}`.toLowerCase().includes(normalizedValue),
    );

    if (concentrationMatch) {
      setSelectedKonsentrasiCode(concentrationMatch.konsentrasi.kode);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit">
                Panduan Alat Sekolah
              </Badge>
              <CardTitle className="text-2xl text-slate-950">Panduan Alat Perdirjen 33 Tahun 2025</CardTitle>
              <CardDescription>
                Pilih konsentrasi keahlian secara langsung. Pencarian hanya dipakai untuk membantu memilih konsentrasi
                keahlian yang sesuai.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                Sumber: Perdirjen 33 Tahun 2025
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Konsentrasi Keahlian</span>
              <select
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                value={selectedKonsentrasiCode}
                onChange={(event) => {
                  setSelectedKonsentrasiCode(event.target.value);
                  setSearch("");
                  setTableSearch("");
                }}
              >
                {concentrationOptions.map((option) => {
                  const pageInfo = pdfPageMap[option.konsentrasi.kode];
                  const pageLabel = pageInfo
                    ? ` | h. ${pageInfo.startPage}${pageInfo.endPage > pageInfo.startPage ? `-${pageInfo.endPage}` : ""}`
                    : "";

                  return (
                    <option key={option.konsentrasi.kode} value={option.konsentrasi.kode}>
                      {option.konsentrasi.kode}. {option.konsentrasi.konsentrasi_keahlian}
                      {pageLabel}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="grid min-w-0 gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Cari Konsentrasi</span>
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Cari kode atau nama konsentrasi keahlian..."
                  className="h-11 w-full pl-9"
                />
              </div>
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          ) : null}

          {loadingSummary || loadingData ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Memuat dataset panduan alat...
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {selectedOption?.bidangCode}. Bidang Keahlian
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {selectedOption?.bidangKeahlian ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {selectedOption?.programCode}. Program Keahlian
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{selectedOption?.programKeahlian ?? "-"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {selectedKonsentrasi?.kode}. Konsentrasi Keahlian
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {selectedKonsentrasi?.konsentrasi_keahlian ?? "-"}
              </p>
              {selectedPdfPage ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    Halaman PDF: {selectedPdfPage.startPage}
                    {selectedPdfPage.endPage > selectedPdfPage.startPage ? `-${selectedPdfPage.endPage}` : ""}
                  </span>
                  <Link
                    href={selectedPdfHref}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Buka PDF
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          {normalizedSearch ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {matchedConcentration ? (
                <span>
                  Pencarian memilih konsentrasi{" "}
                  <span className="font-semibold text-slate-950">
                    {matchedConcentration.konsentrasi.kode}. {matchedConcentration.konsentrasi.konsentrasi_keahlian}
                  </span>
                  .
                </span>
              ) : (
                <span>Tidak ada konsentrasi keahlian yang cocok dengan pencarian.</span>
              )}
            </div>
          ) : null}

          <div className="sticky top-4 z-20 rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {toolGuideCategoryMeta.map((category) => {
                const active = category.key === activeCategory;

                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category.key);
                      setTableSearch("");
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-primary bg-primary/[0.08] text-primary shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <p className="text-sm font-semibold">{category.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{category.subtitle}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {matchCounts[category.key]} item
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{activeCategoryMeta.subtitle}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Menampilkan {filteredItems.length} dari {selectedKonsentrasi?.[activeCategoryMeta.dataKey].length ?? 0}{" "}
                  alat pada bagian {activeCategoryMeta.sourceSection}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={toolGuidePdfPath} target="_blank">
                    <Download className="mr-1.5 h-4 w-4" />
                    Download Perdirjen
                  </Link>
                </Button>
                <div className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Cari nama alat..."
                    className="h-9 pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {filteredItems.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">No</th>
                      <th className="px-4 py-3 font-semibold">Nama Alat</th>
                      <th className="px-4 py-3 font-semibold">Fungsi Alat</th>
                      <th className="px-4 py-3 font-semibold">Spesifikasi Alat</th>
                      <th className="px-4 py-3 font-semibold">Rasio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 align-top">
                    {filteredItems.map((item) => (
                      <tr key={`${activeCategoryMeta.key}-${item.no}-${item.nama_alat}`}>
                        <td className="px-4 py-4 font-medium text-slate-950">{item.no}</td>
                        <td className="px-4 py-4 min-w-[220px] font-medium text-slate-950">{item.nama_alat}</td>
                        <td className="px-4 py-4 min-w-[260px] whitespace-pre-line leading-6">{item.fungsi_alat}</td>
                        <td className="px-4 py-4 min-w-[340px] whitespace-pre-line leading-6">{item.spesifikasi_alat}</td>
                        <td className="px-4 py-4 min-w-[160px] whitespace-pre-line leading-6">{item.rasio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada alat yang cocok dengan pencarian pada kategori ini.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
