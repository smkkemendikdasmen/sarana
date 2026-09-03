"use client";

import { ChevronDown, Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  perdirjenEquipmentBidangRequest,
  perdirjenEquipmentSummaryRequest,
  replacePerdirjenEquipmentCategoryItemsRequest,
  type PerdirjenEquipmentDetailBidang,
  type PerdirjenEquipmentDetailKonsentrasi,
  type PerdirjenEquipmentItem,
  type PerdirjenEquipmentItemInput,
  type PerdirjenEquipmentSummaryBidang,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const kategoriOrder = [
  "Peralatan Praktik Utama Kriteria Minimal",
  "Peralatan Praktik Utama Kriteria Pengembangan",
  "Peralatan Praktik Pendukung",
] as const;

type KategoriKey = (typeof kategoriOrder)[number];
type CategorySlug = "minimal" | "pengembangan" | "pendukung";

type ConcentrationOption = {
  bidangCode: string;
  bidangName: string;
  programCode: string;
  programName: string;
  konsentrasiCode: string;
  konsentrasiName: string;
};

type EditableEquipmentRow = {
  name: string;
  functionText: string;
  specificationText: string;
  ratio: string;
};

const kategoriSlugMap: Record<KategoriKey, CategorySlug> = {
  "Peralatan Praktik Utama Kriteria Minimal": "minimal",
  "Peralatan Praktik Utama Kriteria Pengembangan": "pengembangan",
  "Peralatan Praktik Pendukung": "pendukung",
};

function toEditableRows(items: PerdirjenEquipmentItem[]): EditableEquipmentRow[] {
  return items.map((item) => ({
    name: item["Nama Alat"] ?? "",
    functionText: item["Fungsi Alat"] ?? "",
    specificationText: item["Spesifikasi Alat"] ?? "",
    ratio: item["Rasio Satuan"] ?? "",
  }));
}

function toEquipmentItems(items: EditableEquipmentRow[]): PerdirjenEquipmentItem[] {
  return items.map((item) => ({
    "Nama Alat": item.name,
    "Fungsi Alat": item.functionText,
    "Spesifikasi Alat": item.specificationText,
    "Rasio Satuan": item.ratio,
  }));
}

function countBidangItems(detail: PerdirjenEquipmentDetailBidang) {
  return detail.program.reduce(
    (totalProgram, program) =>
      totalProgram +
      program.konsentrasi.reduce(
        (totalKonsentrasi, konsentrasi) =>
          totalKonsentrasi +
          kategoriOrder.reduce((totalKategori, kategori) => totalKategori + konsentrasi[kategori].length, 0),
        0,
      ),
    0,
  );
}

function getKategoriKeys(konsentrasi: PerdirjenEquipmentDetailKonsentrasi) {
  return kategoriOrder.filter((key) => Array.isArray(konsentrasi[key]));
}

function getFirstProgram(detail: PerdirjenEquipmentDetailBidang | undefined) {
  return detail?.program[0] ?? null;
}

function getFirstKonsentrasi(detail: PerdirjenEquipmentDetailBidang | undefined) {
  return detail?.program[0]?.konsentrasi[0] ?? null;
}

function getFirstKategori(konsentrasi: PerdirjenEquipmentDetailKonsentrasi | null) {
  return konsentrasi ? getKategoriKeys(konsentrasi)[0] ?? null : null;
}

export function PeralatanBidangAccordion() {
  const [summaryData, setSummaryData] = useState<PerdirjenEquipmentSummaryBidang[]>([]);
  const [detailByBidang, setDetailByBidang] = useState<Record<string, PerdirjenEquipmentDetailBidang>>({});
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingBidang, setLoadingBidang] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [bidangErrors, setBidangErrors] = useState<Record<string, string>>({});
  const [openBidang, setOpenBidang] = useState<string | null>(null);
  const [openProgram, setOpenProgram] = useState<string | null>(null);
  const [openKonsentrasi, setOpenKonsentrasi] = useState<string | null>(null);
  const [activeKategori, setActiveKategori] = useState<KategoriKey | null>(null);
  const [search, setSearch] = useState("");
  const [editingTableKey, setEditingTableKey] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<EditableEquipmentRow[]>([]);
  const [savingTableKey, setSavingTableKey] = useState<string | null>(null);
  const [tableMessage, setTableMessage] = useState<
    Record<string, { type: "success" | "error"; text: string } | undefined>
  >({});

  async function loadBidangDetail(code: string) {
    setLoadingBidang(code);
    setBidangErrors((current) => ({ ...current, [code]: "" }));

    try {
      const detail = await perdirjenEquipmentBidangRequest(code);
      setDetailByBidang((current) => ({ ...current, [code]: detail }));
      return detail;
    } catch (loadError) {
      setBidangErrors((current) => ({
        ...current,
        [code]: loadError instanceof Error ? loadError.message : "Gagal memuat detail bidang.",
      }));
      return null;
    } finally {
      setLoadingBidang((current) => (current === code ? null : current));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingSummary(true);
      setError("");

      try {
        const payload = await perdirjenEquipmentSummaryRequest();
        if (cancelled) {
          return;
        }

        setSummaryData(payload);
        const firstBidang = payload[0];
        if (firstBidang) {
          setOpenBidang(firstBidang.no);
          const detail = await loadBidangDetail(firstBidang.no);
          if (!cancelled && detail) {
            applyDefaultState(detail);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan saat memuat data.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function applyDefaultState(detail: PerdirjenEquipmentDetailBidang) {
    const firstProgram = getFirstProgram(detail);
    const firstKonsentrasi = getFirstKonsentrasi(detail);

    setOpenProgram(firstProgram?.no ?? null);
    setOpenKonsentrasi(firstKonsentrasi?.no ?? null);
    setActiveKategori(getFirstKategori(firstKonsentrasi));
  }

  function getTableKey(konsentrasiCode: string, kategori: KategoriKey) {
    return `${konsentrasiCode}::${kategori}`;
  }

  function startEditing(konsentrasiCode: string, kategori: KategoriKey, items: PerdirjenEquipmentItem[]) {
    const tableKey = getTableKey(konsentrasiCode, kategori);
    setEditingTableKey(tableKey);
    setDraftItems(toEditableRows(items));
    setTableMessage((current) => ({ ...current, [tableKey]: undefined }));
  }

  function cancelEditing() {
    setEditingTableKey(null);
    setDraftItems([]);
  }

  function updateDraftRow(index: number, field: keyof EditableEquipmentRow, value: string) {
    setDraftItems((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function addDraftRow() {
    setDraftItems((current) => [...current, { name: "", functionText: "", specificationText: "", ratio: "" }]);
  }

  function removeDraftRow(index: number) {
    setDraftItems((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function saveCategoryTable(konsentrasiCode: string, kategori: KategoriKey) {
    const tableKey = getTableKey(konsentrasiCode, kategori);
    const payload: PerdirjenEquipmentItemInput[] = draftItems.map((item) => ({
      name: item.name,
      functionText: item.functionText,
      specificationText: item.specificationText,
      ratio: item.ratio,
    }));

    setSavingTableKey(tableKey);
    setTableMessage((current) => ({ ...current, [tableKey]: undefined }));

    try {
      const savedItems = await replacePerdirjenEquipmentCategoryItemsRequest(
        konsentrasiCode,
        kategoriSlugMap[kategori],
        payload,
      );

      setDetailByBidang((current) => {
        if (!openBidang || !current[openBidang]) {
          return current;
        }

        const nextBidang: PerdirjenEquipmentDetailBidang = {
          ...current[openBidang],
          program: current[openBidang].program.map((program) => ({
            ...program,
            konsentrasi: program.konsentrasi.map((konsentrasi) =>
              konsentrasi.no === konsentrasiCode
                ? {
                    ...konsentrasi,
                    [kategori]: savedItems,
                  }
                : konsentrasi,
            ),
          })),
        };
        nextBidang.totalItem = countBidangItems(nextBidang);

        setSummaryData((summaryCurrent) =>
          summaryCurrent.map((bidang) =>
            bidang.no === openBidang ? { ...bidang, totalItem: nextBidang.totalItem } : bidang,
          ),
        );

        return {
          ...current,
          [openBidang]: nextBidang,
        };
      });

      setEditingTableKey(null);
      setDraftItems([]);
      setTableMessage((current) => ({
        ...current,
        [tableKey]: { type: "success", text: "Perubahan tabel berhasil disimpan." },
      }));
    } catch (saveError) {
      setTableMessage((current) => ({
        ...current,
        [tableKey]: {
          type: "error",
          text: saveError instanceof Error ? saveError.message : "Gagal menyimpan perubahan.",
        },
      }));
    } finally {
      setSavingTableKey((current) => (current === tableKey ? null : current));
    }
  }

  async function handleBidangToggle(bidangCode: string) {
    if (openBidang === bidangCode) {
      setOpenBidang(null);
      setOpenProgram(null);
      setOpenKonsentrasi(null);
      setActiveKategori(null);
      return;
    }

    setOpenBidang(bidangCode);

    const existingDetail = detailByBidang[bidangCode];
    if (existingDetail) {
      applyDefaultState(existingDetail);
      return;
    }

    const detail = await loadBidangDetail(bidangCode);
    if (detail) {
      applyDefaultState(detail);
    }
  }

  const concentrationOptions = useMemo<ConcentrationOption[]>(
    () =>
      summaryData.flatMap((bidang) =>
        bidang.program.flatMap((program) =>
          program.konsentrasi.map((konsentrasi) => ({
            bidangCode: bidang.no,
            bidangName: bidang.bidang,
            programCode: program.no,
            programName: program.nama,
            konsentrasiCode: konsentrasi.no,
            konsentrasiName: konsentrasi.nama,
          })),
        ),
      ),
    [summaryData],
  );

  const selectedConcentrationOption = useMemo(
    () => concentrationOptions.find((item) => item.konsentrasiCode === openKonsentrasi) ?? null,
    [concentrationOptions, openKonsentrasi],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const matchedConcentration = useMemo(() => {
    if (!normalizedSearch) {
      return null;
    }

    return (
      concentrationOptions.find((option) => {
        const haystack = [
          option.konsentrasiCode,
          option.konsentrasiName,
          option.programCode,
          option.programName,
          option.bidangCode,
          option.bidangName,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      }) ?? null
    );
  }, [concentrationOptions, normalizedSearch]);

  async function selectConcentration(option: ConcentrationOption) {
    setOpenBidang(option.bidangCode);

    let detail: PerdirjenEquipmentDetailBidang | null | undefined = detailByBidang[option.bidangCode];
    if (!detail) {
      detail = await loadBidangDetail(option.bidangCode);
    }

    setOpenProgram(option.programCode);
    setOpenKonsentrasi(option.konsentrasiCode);

    const targetKonsentrasi =
      detail?.program
        .find((program) => program.no === option.programCode)
        ?.konsentrasi.find((konsentrasi) => konsentrasi.no === option.konsentrasiCode) ?? null;

    setActiveKategori(getFirstKategori(targetKonsentrasi));
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    const nextSearch = value.trim().toLowerCase();
    if (!nextSearch) {
      return;
    }

    const nextMatch = concentrationOptions.find((option) => {
      const haystack = [
        option.konsentrasiCode,
        option.konsentrasiName,
        option.programCode,
        option.programName,
        option.bidangCode,
        option.bidangName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(nextSearch);
    });

    if (nextMatch) {
      void selectConcentration(nextMatch);
    }
  }

  const selectedBidang = useMemo<{ no: string; bidang: string } | null>(() => {
    if (!openBidang) {
      return null;
    }

    return detailByBidang[openBidang] ?? summaryData.find((item) => item.no === openBidang) ?? null;
  }, [detailByBidang, openBidang, summaryData]);

  if (loadingSummary) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat data bidang keahlian dan peralatan...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/15 bg-danger/[0.08] px-5 py-4 text-sm text-danger">{error}</div>
    );
  }

  if (summaryData.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        Data bidang keahlian belum tersedia.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Konsentrasi Keahlian</span>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
              value={selectedConcentrationOption?.konsentrasiCode ?? ""}
              onChange={(event) => {
                const nextOption = concentrationOptions.find((option) => option.konsentrasiCode === event.target.value);
                if (nextOption) {
                  setSearch("");
                  void selectConcentration(nextOption);
                }
              }}
            >
              {concentrationOptions.map((option) => (
                <option key={option.konsentrasiCode} value={option.konsentrasiCode}>
                  {option.konsentrasiCode}. {option.konsentrasiName}
                </option>
              ))}
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

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {selectedConcentrationOption?.bidangCode ?? "-"}. Bidang Keahlian
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{selectedConcentrationOption?.bidangName ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {selectedConcentrationOption?.programCode ?? "-"}. Program Keahlian
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {selectedConcentrationOption?.programName ?? "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {selectedConcentrationOption?.konsentrasiCode ?? "-"}. Konsentrasi Keahlian
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {selectedConcentrationOption?.konsentrasiName ?? "-"}
            </p>
          </div>
        </div>

        {normalizedSearch ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {matchedConcentration ? (
              <span>
                Pencarian memilih konsentrasi{" "}
                <span className="font-semibold text-slate-950">
                  {matchedConcentration.konsentrasiCode}. {matchedConcentration.konsentrasiName}
                </span>
                .
              </span>
            ) : (
              <span>Tidak ada konsentrasi keahlian yang cocok dengan pencarian.</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span>No</span>
          <span>Bidang Keahlian</span>
        </div>

        <div className="divide-y divide-slate-200">
          {summaryData.map((bidang) => {
            const isOpen = bidang.no === openBidang;
            const detail = detailByBidang[bidang.no];
            const bidangError = bidangErrors[bidang.no];

            return (
              <div key={bidang.no}>
                <button
                  type="button"
                  onClick={() => void handleBidangToggle(bidang.no)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                  aria-expanded={isOpen}
                >
                  <div className="grid flex-1 gap-4 lg:grid-cols-[96px_minmax(0,1fr)_auto] lg:items-center">
                    <span className="text-sm font-semibold text-slate-700">{bidang.no}</span>
                    <span className="text-sm font-semibold text-slate-950">{bidang.bidang}</span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{bidang.totalProgram} Program</Badge>
                      <Badge variant="secondary">{bidang.totalKonsentrasi} Konsentrasi</Badge>
                      <Badge variant="secondary">{bidang.totalItem} Item</Badge>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-5 w-5 text-slate-400 transition", isOpen ? "rotate-180" : "")} />
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-200 bg-slate-50/40 px-5 py-4">
                    {loadingBidang === bidang.no && !detail ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat detail bidang {bidang.no}...
                      </div>
                    ) : bidangError ? (
                      <div className="rounded-2xl border border-danger/15 bg-danger/[0.08] px-4 py-4 text-sm text-danger">
                        {bidangError}
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        <span>No</span>
                        <span>Program Keahlian</span>
                      </div>

                      <div className="space-y-3">
                        {detail.program.map((program) => {
                          const programOpen = openProgram === program.no;

                          return (
                            <div key={program.no} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOpen = openProgram === program.no ? null : program.no;
                                  const firstKonsentrasi = nextOpen ? program.konsentrasi[0] ?? null : null;
                                  setOpenProgram(nextOpen);
                                  setOpenKonsentrasi(firstKonsentrasi?.no ?? null);
                                  setActiveKategori(getFirstKategori(firstKonsentrasi));
                                }}
                                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                                aria-expanded={programOpen}
                              >
                                <div className="grid flex-1 grid-cols-[96px_minmax(0,1fr)] gap-3">
                                  <span className="text-sm font-semibold text-slate-700">{program.no}</span>
                                  <span className="text-sm font-semibold text-slate-950">{program.nama}</span>
                                </div>
                                <ChevronDown
                                  className={cn("h-5 w-5 text-slate-400 transition", programOpen ? "rotate-180" : "")}
                                />
                              </button>

                              {programOpen ? (
                                <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                                  <div className="mb-3 grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                    <span>No</span>
                                    <span>Konsentrasi Keahlian</span>
                                  </div>

                                  <div className="space-y-3">
                                    {program.konsentrasi.map((konsentrasi) => {
                                      const konsOpen = openKonsentrasi === konsentrasi.no;
                                      const kategoriKeys = getKategoriKeys(konsentrasi);
                                      const selectedKategori = (kategoriKeys.includes(activeKategori as KategoriKey)
                                        ? activeKategori
                                        : kategoriKeys[0]) as KategoriKey | undefined;
                                      const items = selectedKategori ? konsentrasi[selectedKategori] : [];
                                      const tableKey = selectedKategori
                                        ? getTableKey(konsentrasi.no, selectedKategori)
                                        : null;
                                      const isEditing = tableKey !== null && editingTableKey === tableKey;
                                      const isSaving = tableKey !== null && savingTableKey === tableKey;
                                      const currentMessage = tableKey ? tableMessage[tableKey] : undefined;

                                      return (
                                        <div
                                          key={konsentrasi.no}
                                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const nextOpen = openKonsentrasi === konsentrasi.no ? null : konsentrasi.no;
                                              setOpenKonsentrasi(nextOpen);
                                              setActiveKategori(nextOpen ? getFirstKategori(konsentrasi) : null);
                                            }}
                                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                                            aria-expanded={konsOpen}
                                          >
                                            <div className="grid flex-1 grid-cols-[96px_minmax(0,1fr)] gap-3">
                                              <span className="text-sm font-semibold text-slate-600">{konsentrasi.no}</span>
                                              <span className="text-sm text-slate-900">{konsentrasi.nama}</span>
                                            </div>
                                            <ChevronDown
                                              className={cn(
                                                "h-5 w-5 text-slate-400 transition",
                                                konsOpen ? "rotate-180" : "",
                                              )}
                                            />
                                          </button>

                                          {konsOpen ? (
                                            <div className="space-y-4 border-t border-slate-200 bg-white px-4 py-4">
                                              <div className="flex flex-wrap gap-2">
                                                {kategoriKeys.map((kategori) => (
                                                  <button
                                                    key={kategori}
                                                    type="button"
                                                    onClick={() => setActiveKategori(kategori)}
                                                    className={cn(
                                                      "rounded-full border px-3 py-2 text-sm font-medium transition",
                                                      selectedKategori === kategori
                                                        ? "border-primary bg-primary text-white"
                                                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                                                    )}
                                                  >
                                                    {kategori}
                                                  </button>
                                                ))}
                                              </div>

                                              <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                  <p className="text-sm font-semibold text-slate-950">{selectedKategori}</p>
                                                  <p className="text-xs text-slate-500">{items.length} item</p>
                                                </div>
                                                {selectedKategori ? (
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    {isEditing ? (
                                                      <>
                                                        <Button
                                                          type="button"
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={addDraftRow}
                                                        >
                                                          <Plus className="h-4 w-4" />
                                                          Tambah Baris
                                                        </Button>
                                                        <Button
                                                          type="button"
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={cancelEditing}
                                                          disabled={isSaving}
                                                        >
                                                          <X className="h-4 w-4" />
                                                          Batal
                                                        </Button>
                                                        <Button
                                                          type="button"
                                                          size="sm"
                                                          onClick={() => void saveCategoryTable(konsentrasi.no, selectedKategori)}
                                                          disabled={isSaving}
                                                        >
                                                          {isSaving ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                          ) : (
                                                            <Save className="h-4 w-4" />
                                                          )}
                                                          Simpan Perubahan
                                                        </Button>
                                                      </>
                                                    ) : (
                                                      <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => startEditing(konsentrasi.no, selectedKategori, items)}
                                                      >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit Tabel
                                                      </Button>
                                                    )}
                                                  </div>
                                                ) : null}
                                              </div>

                                              {currentMessage ? (
                                                <div
                                                  className={cn(
                                                    "rounded-xl border px-4 py-3 text-sm",
                                                    currentMessage.type === "success"
                                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                      : "border-danger/15 bg-danger/[0.08] text-danger",
                                                  )}
                                                >
                                                  {currentMessage.text}
                                                </div>
                                              ) : null}

                                              {isEditing ? (
                                                <div className="rounded-xl border border-slate-200">
                                                  <div className="overflow-x-auto">
                                                    <div className="min-w-[1120px]">
                                                      <div className="grid grid-cols-[84px_minmax(220px,1.15fr)_minmax(220px,1fr)_minmax(320px,1.6fr)_minmax(180px,0.75fr)_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                        <span>No</span>
                                                        <span>Nama Alat</span>
                                                        <span>Fungsi</span>
                                                        <span>Spesifikasi</span>
                                                        <span>Rasio</span>
                                                        <span>Aksi</span>
                                                      </div>

                                                      <div className="divide-y divide-slate-200 bg-white">
                                                        {draftItems.length === 0 ? (
                                                          <div className="px-4 py-6 text-sm text-slate-600">
                                                            Belum ada baris pada tabel ini. Gunakan tombol
                                                            <span className="mx-1 font-semibold">Tambah Baris</span>
                                                            untuk menambahkan data baru.
                                                          </div>
                                                        ) : (
                                                          draftItems.map((item, index) => (
                                                            <div
                                                              key={`${tableKey}-draft-${index}`}
                                                              className="grid grid-cols-[84px_minmax(220px,1.15fr)_minmax(220px,1fr)_minmax(320px,1.6fr)_minmax(180px,0.75fr)_88px] gap-3 px-4 py-3 align-top"
                                                            >
                                                              <p className="pt-2 text-sm font-semibold text-slate-500">
                                                                {index + 1}
                                                              </p>
                                                              <Input
                                                                value={item.name}
                                                                onChange={(event) =>
                                                                  updateDraftRow(index, "name", event.target.value)
                                                                }
                                                                placeholder="Nama alat"
                                                              />
                                                              <textarea
                                                                value={item.functionText}
                                                                onChange={(event) =>
                                                                  updateDraftRow(index, "functionText", event.target.value)
                                                                }
                                                                placeholder="Fungsi alat"
                                                                className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                                                              />
                                                              <textarea
                                                                value={item.specificationText}
                                                                onChange={(event) =>
                                                                  updateDraftRow(index, "specificationText", event.target.value)
                                                                }
                                                                placeholder="Spesifikasi alat"
                                                                className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                                                              />
                                                              <Input
                                                                value={item.ratio}
                                                                onChange={(event) =>
                                                                  updateDraftRow(index, "ratio", event.target.value)
                                                                }
                                                                placeholder="Rasio"
                                                              />
                                                              <div className="flex justify-center pt-1">
                                                                <Button
                                                                  type="button"
                                                                  size="icon"
                                                                  variant="ghost"
                                                                  onClick={() => removeDraftRow(index)}
                                                                  className="text-slate-500 hover:text-danger"
                                                                >
                                                                  <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                              </div>
                                                            </div>
                                                          ))
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              ) : items.length === 0 ? (
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                                  Belum ada data peralatan untuk kategori ini.
                                                </div>
                                              ) : (
                                                <div className="rounded-xl border border-slate-200">
                                                  <div className="overflow-x-auto">
                                                    <div className="min-w-[1120px]">
                                                      <div className="grid grid-cols-[84px_minmax(260px,1.15fr)_minmax(260px,1fr)_minmax(380px,1.6fr)_minmax(180px,0.75fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                        <span>No</span>
                                                        <span>Nama Alat</span>
                                                        <span>Fungsi</span>
                                                        <span>Spesifikasi</span>
                                                        <span>Rasio</span>
                                                      </div>

                                                      <div className="divide-y divide-slate-200 bg-white">
                                                        {items.map((item, index) => (
                                                          <div
                                                            key={`${konsentrasi.no}-${selectedKategori}-${index}`}
                                                            className="grid grid-cols-[84px_minmax(260px,1.15fr)_minmax(260px,1fr)_minmax(380px,1.6fr)_minmax(180px,0.75fr)] gap-3 px-4 py-3 align-top"
                                                          >
                                                            <p className="text-sm font-semibold text-slate-500">
                                                              {index + 1}
                                                            </p>
                                                            <p className="text-sm font-semibold leading-6 text-slate-900">
                                                              {item["Nama Alat"]}
                                                            </p>
                                                            <p className="text-sm leading-6 text-slate-700">
                                                              {item["Fungsi Alat"]}
                                                            </p>
                                                            <pre className="font-sans whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                                                              {item["Spesifikasi Alat"]}
                                                            </pre>
                                                            <p className="text-sm leading-6 text-slate-700">
                                                              {item["Rasio Satuan"]}
                                                            </p>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {selectedBidang ? (
          <div className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
            Menampilkan: {selectedBidang.no} {selectedBidang.bidang}
          </div>
        ) : null}
      </div>
    </div>
  );
}
