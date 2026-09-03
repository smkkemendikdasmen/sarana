"use client";

import { ClipboardList, FileCheck2, Loader2, Search, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { workspaceAdminSelectionRequest } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

interface CakupanData {
  konsentrasi_keahlian?: string[];
  kk_diusulkan?: string[];
}

interface AlatRow {
  no_rab: number;
  nama_alat: string;
  harga_satuan: number;
  jumlah: number;
  total: number;
  kk_diusulkan?: string;
  konsentrasi_keahlian?: string;
  keterangan?: string | null;
}

export interface SekolahPenerimaRow {
  tahun: number;
  no: number;
  npsn: string;
  provinsi: string;
  kab_kota: string;
  nama_sekolah: string;
  cakupan?: CakupanData;
  path_sumber?: string;
  status_anggaran?: string;
  jumlah_item?: number;
  nilai_pagu?: number;
  total_rab_ringkasan?: number;
  total_rab_hitung?: number;
  catatan?: string | null;
  alat?: AlatRow[];
  fasilitator_administrasi?: string;
  fasilitator_peralatan?: string;
  status_pendampingan?: string;
  status_final?: string;
  status_pks?: string;
  lanjut_batal?: string;
  link_folder_sekolah?: string;
  link_folder_drive?: string | null;
  link_scan_pks?: string | null;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function displayText(value: unknown) {
  const text = normalizeText(value);
  if (!text || text.toLowerCase() === "null") {
    return "-";
  }

  return text;
}

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat("id-ID");

function getNumberOrZero(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isEmptyValue(value: unknown) {
  const text = normalizeText(value);
  return !text || text.toLowerCase() === "null";
}

function matchesOptionalFilter(filterValue: string, fieldValue: unknown) {
  if (!filterValue) {
    return true;
  }

  if (filterValue === "__EMPTY__") {
    return isEmptyValue(fieldValue);
  }

  return normalizeText(fieldValue) === filterValue;
}

export function SekolahPenerimaTable() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<SekolahPenerimaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [fasilitatorFilter, setFasilitatorFilter] = useState("");
  const [statusPksFilter, setStatusPksFilter] = useState("");
  const [lanjutBatalFilter, setLanjutBatalFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"alat" | null>(null);
  const [processModalRow, setProcessModalRow] = useState<SekolahPenerimaRow | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fasilitatorOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      const value = normalizeText(row.fasilitator_peralatan);
      if (!value || value.toLowerCase() === "null") continue;
      unique.add(value);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [rows]);

  const statusPksOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      const value = normalizeText(row.status_pks);
      if (!value || value.toLowerCase() === "null") continue;
      unique.add(value);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [rows]);

  const lanjutBatalOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      const value = normalizeText(row.lanjut_batal);
      if (!value || value.toLowerCase() === "null") continue;
      unique.add(value);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [rows]);

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

      setLoading(true);
      setError("");

      try {
        const payload = await workspaceAdminSelectionRequest(token);

        if (!cancelled) {
          setRows((Array.isArray(payload.regulerRows) ? payload.regulerRows : []) as unknown as SekolahPenerimaRow[]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data sekolah penerima 2026.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesOptionalFilter(fasilitatorFilter, row.fasilitator_peralatan)) {
        return false;
      }

      if (!matchesOptionalFilter(statusPksFilter, row.status_pks)) {
        return false;
      }

      if (!matchesOptionalFilter(lanjutBatalFilter, row.lanjut_batal)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const combined = [
        row.npsn,
        row.nama_sekolah,
        row.provinsi,
        row.kab_kota,
        row.status_anggaran ?? "",
        row.fasilitator_administrasi ?? "",
        row.fasilitator_peralatan ?? "",
        row.status_pks ?? "",
        row.lanjut_batal ?? "",
        ...(row.cakupan?.konsentrasi_keahlian ?? []),
        ...(row.cakupan?.kk_diusulkan ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return combined.includes(normalizedQuery);
    });
  }, [fasilitatorFilter, lanjutBatalFilter, query, rows, statusPksFilter]);

  const summary = useMemo(() => {
    const totalPagu = filteredRows.reduce((sum, row) => sum + getNumberOrZero(row.nilai_pagu), 0);
    const totalItem = filteredRows.reduce((sum, row) => sum + getNumberOrZero(row.jumlah_item), 0);
    const totalAjuan = filteredRows.reduce(
      (sum, row) => sum + getNumberOrZero(row.total_rab_hitung ?? row.total_rab_ringkasan),
      0,
    );

    return {
      totalPagu,
      totalItem,
      totalAjuan,
    };
  }, [filteredRows]);

  const hasActiveFilters = Boolean(fasilitatorFilter || statusPksFilter || lanjutBatalFilter || query.trim());
  const selectClassName =
    "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

  function togglePanel(key: string, panel: "alat") {
    if (expandedKey === key && expandedPanel === panel) {
      setExpandedKey(null);
      setExpandedPanel(null);
      return;
    }

    setExpandedKey(key);
    setExpandedPanel(panel);
  }

  function getLocalFolderPath(value: unknown) {
    const text = normalizeText(value);
    if (!text) return "";

    const dokumenIndex = text.indexOf("/Dokumen");
    if (dokumenIndex > 0) {
      return text.slice(0, dokumenIndex);
    }

    const lastSlash = text.lastIndexOf("/");
    if (lastSlash > 0) {
      return text.slice(0, lastSlash);
    }

    return text;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[24px]">
          <CardContent className="px-6 py-5">
            <p className="text-sm text-slate-500">Sekolah</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {filteredRows.length} / {rows.length}
            </p>
            <p className="mt-1 text-sm text-slate-600">Jumlah sekolah sesuai filter aktif.</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardContent className="px-6 py-5">
            <p className="text-sm text-slate-500">Total Pagu</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{currency.format(summary.totalPagu)}</p>
            <p className="mt-1 text-sm text-slate-600">Akumulasi nilai pagu dari data yang tampil.</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardContent className="px-6 py-5">
            <p className="text-sm text-slate-500">Total Item</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{numberFormat.format(summary.totalItem)}</p>
            <p className="mt-1 text-sm text-slate-600">Jumlah item alat yang tercatat.</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardContent className="px-6 py-5">
            <p className="text-sm text-slate-500">Total Ajuan</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{currency.format(summary.totalAjuan)}</p>
            <p className="mt-1 text-sm text-slate-600">Akumulasi total ajuan berdasarkan RAB.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <label className="grid gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Cari Sekolah</span>
                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari NPSN, nama sekolah, provinsi, kab/kota, konsentrasi..."
                    className="pl-9"
                  />
                </div>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!hasActiveFilters}
                  onClick={() => {
                    setQuery("");
                    setFasilitatorFilter("");
                    setStatusPksFilter("");
                    setLanjutBatalFilter("");
                  }}
                >
                  Reset Filter
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Fasilitator (Peralatan)</span>
                <select
                  value={fasilitatorFilter}
                  onChange={(event) => setFasilitatorFilter(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">Semua</option>
                  <option value="__EMPTY__">Kosong</option>
                  {fasilitatorOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Status PKS</span>
                <select
                  value={statusPksFilter}
                  onChange={(event) => setStatusPksFilter(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">Semua</option>
                  <option value="__EMPTY__">Kosong</option>
                  {statusPksOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Lanjut / Batal</span>
                <select
                  value={lanjutBatalFilter}
                  onChange={(event) => setLanjutBatalFilter(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">Semua</option>
                  <option value="__EMPTY__">Kosong</option>
                  {lanjutBatalOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data sekolah penerima...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              <div className="grid grid-cols-[80px_160px_minmax(320px,1fr)_220px_220px_260px_180px_160px] gap-3 border-b border-slate-200 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>No</span>
                <span>NPSN</span>
                <span>Nama Sekolah</span>
                <span>Provinsi</span>
                <span>Kab/Kota</span>
                <span>KK Usulan</span>
                <span>Nilai Pagu</span>
                <span>Aksi</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-slate-600">Data tidak ditemukan.</div>
                ) : (
                  filteredRows.map((row) => {
                    const key = row.npsn || String(row.no);
                    const isExpanded = expandedKey === key && expandedPanel !== null;
                    const konsentrasi = row.cakupan?.konsentrasi_keahlian ?? [];
                    const jumlahAlat = Array.isArray(row.alat) ? row.alat.length : 0;
                    const totalAjuanAlat = (row.alat ?? []).reduce((sum, alat) => sum + getNumberOrZero(alat.total), 0);
                    const kkUsulan = (row.cakupan?.kk_diusulkan ?? []).filter(Boolean).join(", ");
                    const isAlat = expandedKey === key && expandedPanel === "alat";

                    return (
                      <div key={key}>
                        <div className="grid grid-cols-[80px_160px_minmax(320px,1fr)_220px_220px_260px_180px_160px] gap-3 px-6 py-4 text-sm">
                          <div className="text-slate-600">{row.no}</div>
                          <div className="font-medium text-slate-900">{row.npsn}</div>
                          <div>
                            <p className="font-semibold text-slate-950">{row.nama_sekolah}</p>
                          </div>
                          <div className="text-slate-700">{row.provinsi}</div>
                          <div className="text-slate-700">{row.kab_kota}</div>
                          <div className="text-slate-700">{kkUsulan ? kkUsulan : "-"}</div>
                          <div className="font-medium text-slate-900">{currency.format(row.nilai_pagu ?? 0)}</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setProcessModalRow(row)}
                            >
                              <ClipboardList className="h-4 w-4" />
                            </Button>
                            {row.link_folder_drive ? (
                              <a href={row.link_folder_drive} target="_blank" rel="noreferrer">
                                <Button type="button" size="sm" variant="outline">
                                  <FileCheck2 className="h-4 w-4" />
                                </Button>
                              </a>
                            ) : (
                              <Button type="button" size="sm" variant="outline" disabled>
                                <FileCheck2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={isAlat ? "default" : "outline"}
                              onClick={() => togglePanel(key, "alat")}
                            >
                              <Wrench className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="bg-slate-50 px-6 pb-6">
                            <div className="space-y-4 pt-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <Card className="rounded-[18px]">
                                  <CardContent className="space-y-2 px-5 py-4 text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Cakupan
                                    </p>
                                    <div className="space-y-2 text-slate-700">
                                      <div>
                                        <p className="font-semibold text-slate-900">Konsentrasi Keahlian</p>
                                        <p className="mt-1 text-sm text-slate-600">{konsentrasi.join(", ") || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-900">KK Diusulkan</p>
                                        <p className="mt-1 text-sm text-slate-600">{kkUsulan || "-"}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="rounded-[18px]">
                                  <CardContent className="space-y-2 px-5 py-4 text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Ringkasan Alat
                                    </p>
                                    <div className="space-y-1 text-slate-600">
                                      <p>Jumlah Alat: {numberFormat.format(jumlahAlat)}</p>
                                      <p>Total Ajuan (Dari Alat): {currency.format(totalAjuanAlat)}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                                  <p className="text-sm font-semibold text-slate-950">Daftar Alat</p>
                                  <p className="text-sm text-slate-600">
                                    {numberFormat.format(jumlahAlat)} baris alat. Total ajuan {currency.format(totalAjuanAlat)}.
                                  </p>
                                </div>

                                <div className="overflow-x-auto">
                                  <div className="min-w-[1120px]">
                                    <div className="grid grid-cols-[90px_minmax(360px,1fr)_200px_140px_200px_240px_240px] gap-3 border-b border-slate-200 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      <span>No</span>
                                      <span>Nama Alat</span>
                                      <span>Harga Ajuan</span>
                                      <span>Jumlah</span>
                                      <span>Total Ajuan</span>
                                      <span>KK Diusulkan</span>
                                      <span>Konsentrasi</span>
                                    </div>

                                    <div className="divide-y divide-slate-200">
                                      {(row.alat ?? []).length === 0 ? (
                                        <div className="px-5 py-4 text-sm text-slate-600">Tidak ada daftar alat.</div>
                                      ) : (
                                        (row.alat ?? []).map((alat) => (
                                          <div
                                            key={`${key}-${alat.no_rab}-${alat.nama_alat}`}
                                            className="grid grid-cols-[90px_minmax(360px,1fr)_200px_140px_200px_240px_240px] gap-3 px-5 py-3 text-sm"
                                          >
                                            <div className="text-slate-600">{alat.no_rab}</div>
                                            <div className="font-medium text-slate-900">{alat.nama_alat}</div>
                                            <div className="text-slate-800">{currency.format(getNumberOrZero(alat.harga_satuan))}</div>
                                            <div className="text-slate-800">{numberFormat.format(alat.jumlah ?? 0)}</div>
                                            <div className="text-slate-900">{currency.format(getNumberOrZero(alat.total))}</div>
                                            <div className="text-slate-700">{displayText(alat.kk_diusulkan)}</div>
                                            <div className="text-slate-700">{displayText(alat.konsentrasi_keahlian)}</div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {processModalRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Proses Sekolah</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{processModalRow.nama_sekolah}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  NPSN {processModalRow.npsn} • {processModalRow.kab_kota}, {processModalRow.provinsi}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setProcessModalRow(null)}>
                Tutup
              </Button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <Card className="rounded-[20px]">
                <CardContent className="space-y-2 px-5 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pendampingan</p>
                  <div className="space-y-1 text-slate-600">
                    <p>Fasilitator Administrasi: {displayText(processModalRow.fasilitator_administrasi)}</p>
                    <p>Fasilitator Peralatan: {displayText(processModalRow.fasilitator_peralatan)}</p>
                    <p>Status Pendampingan: {displayText(processModalRow.status_pendampingan)}</p>
                    <p>Status Final: {displayText(processModalRow.status_final)}</p>
                    <p>Status PKS: {displayText(processModalRow.status_pks)}</p>
                    <p>Lanjut/Batal: {displayText(processModalRow.lanjut_batal)}</p>
                    <p>Nilai Pagu: {currency.format(processModalRow.nilai_pagu ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[20px]">
                <CardContent className="space-y-3 px-5 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dokumen & Link</p>
                  <p className="font-semibold text-slate-950">{displayText(processModalRow.link_folder_sekolah)}</p>
                  <div className="flex flex-wrap gap-3">
                    {processModalRow.link_folder_drive ? (
                      <a href={processModalRow.link_folder_drive} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm">Buka Folder Drive</Button>
                      </a>
                    ) : null}
                    {processModalRow.link_scan_pks ? (
                      <a href={processModalRow.link_scan_pks} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm" variant="outline">Buka Scan PKS</Button>
                      </a>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">Sumber lokal: {displayText(processModalRow.path_sumber)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
