"use client";

import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  API_URL,
  WilayahRecord,
  clearClientGetCache,
  wilayahKabupatenRequest,
  wilayahProvinsiRequest,
  workspaceAdminSelectionRequest,
  workspaceDeleteDatasetRowRequest,
  workspaceInsertDatasetRowRequest,
  workspaceUpdateDatasetRowRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export type SekolahPenerimaSimpleDatasetKey = "REGULER" | "TERDAMPAK";

interface SimpleRow {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
}

const DATASET_LABEL: Record<SekolahPenerimaSimpleDatasetKey, string> = {
  REGULER: "Reguler",
  TERDAMPAK: "Terdampak",
};

const DATASET_BACKEND_KEY: Record<SekolahPenerimaSimpleDatasetKey, "REGULER" | "ABT"> = {
  REGULER: "REGULER",
  TERDAMPAK: "ABT",
};

const DATASET_HINT: Record<SekolahPenerimaSimpleDatasetKey, string> = {
  REGULER:
    "Daftar sekolah penerima bantuan sarana prasarana dari skema Dana Alokasi Khusus Reguler tahun 2026.",
  TERDAMPAK:
    "Daftar sekolah terdampak yang merupakan sekolah penerima bantuan dari skema Dana Bagi Hasil (ABT) tahun 2026.",
};

type CrudMode = "create" | "update";

interface CrudForm {
  mode: CrudMode;
  no: string;
  npsn: string;
  nama_sekolah: string;
  provinsiCode: string;
  provinsi: string;
  kabupatenCode: string;
  kabupaten: string;
}

function emptyCrudForm(mode: CrudMode): CrudForm {
  return {
    mode,
    no: "",
    npsn: "",
    nama_sekolah: "",
    provinsiCode: "",
    provinsi: "",
    kabupatenCode: "",
    kabupaten: "",
  };
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

interface Props {
  dataset: SekolahPenerimaSimpleDatasetKey;
}

export function SekolahPenerimaSimpleTable({ dataset }: Props) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<SimpleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [wilayahProvinsi, setWilayahProvinsi] = useState<WilayahRecord[]>([]);
  const [wilayahKabupaten, setWilayahKabupaten] = useState<WilayahRecord[]>([]);
  const [loadingWilayahProvinsi, setLoadingWilayahProvinsi] = useState(false);
  const [loadingWilayahKabupaten, setLoadingWilayahKabupaten] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CrudForm>(() => emptyCrudForm("create"));
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteConfirmNpsn, setDeleteConfirmNpsn] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function loadWilayahProvinsi() {
    if (wilayahProvinsi.length > 0) return wilayahProvinsi;
    setLoadingWilayahProvinsi(true);
    try {
      clearClientGetCache(`${API_URL}/master-data/wilayah/provinsi`);
      const list = await wilayahProvinsiRequest();
      const normalized = Array.isArray(list) ? list : [];
      setWilayahProvinsi(normalized);
      return normalized;
    } catch {
      return [] as WilayahRecord[];
    } finally {
      setLoadingWilayahProvinsi(false);
    }
  }

  async function loadWilayahKabupaten(provKode: string) {
    const safe = String(provKode || "").trim();
    if (!safe) {
      setWilayahKabupaten([]);
      return [] as WilayahRecord[];
    }
    setLoadingWilayahKabupaten(true);
    try {
      clearClientGetCache(`${API_URL}/master-data/wilayah/kabupaten?parent_kode=${encodeURIComponent(safe)}`);
      const list = await wilayahKabupatenRequest(safe);
      const normalized = Array.isArray(list) ? list : [];
      setWilayahKabupaten(normalized);
      return normalized;
    } catch {
      return [] as WilayahRecord[];
    } finally {
      setLoadingWilayahKabupaten(false);
    }
  }

  async function loadRows() {
    const token = session?.token;
    if (!token) return;
    setRefreshing(true);
    setError("");
    try {
      const backendKey = DATASET_BACKEND_KEY[dataset];
      const qs = new URLSearchParams();
      qs.set("datasetKey", backendKey);
      qs.set("scope", "light");
      clearClientGetCache(`${API_URL}/workspace-data/admin/selection?${qs.toString()}`);
      const payload = await workspaceAdminSelectionRequest(token, {
        datasetKey: backendKey,
        scope: "light",
      });
      const raw =
        dataset === "REGULER"
          ? (Array.isArray(payload.regulerRows) ? payload.regulerRows : [])
          : (Array.isArray(payload.abtRows) ? payload.abtRows : []);

      const normalized: SimpleRow[] = raw.map((r, idx) => {
        const row = r as Record<string, unknown>;
        return {
          no: Number.isFinite(Number(row.no)) ? Number(row.no) : idx + 1,
          npsn: normalizeText(row.npsn),
          nama_sekolah: normalizeText(row.nama_sekolah),
          provinsi: normalizeText(row.provinsi),
          kab_kota: normalizeText(row.kab_kota),
        };
      });
      setRows(normalized);
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : `Gagal memuat daftar sekolah ${DATASET_LABEL[dataset]}.`,
      );
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated || !session?.token) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await loadRows();
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : `Gagal memuat daftar sekolah ${DATASET_LABEL[dataset]}.`,
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [dataset, hydrated, session?.token]);

  const filteredRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.npsn, r.nama_sekolah, r.provinsi, r.kab_kota]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, deferredQuery]);

  async function openCreateModal() {
    setFormError("");
    setForm(emptyCrudForm("create"));
    setWilayahKabupaten([]);
    setFormOpen(true);
    try {
      await loadWilayahProvinsi();
    } catch {
    }
  }

  async function openUpdateModal(row: SimpleRow) {
    setFormError("");
    setFormOpen(true);
    let provList: WilayahRecord[] = [];
    try {
      provList = await loadWilayahProvinsi();
    } catch {
      provList = [];
    }
    const provMatch = provList.find((item) => item.nama === row.provinsi);
    const provCode = provMatch?.kode ?? "";
    let kabCode = "";
    if (provCode) {
      try {
        const kabList = await loadWilayahKabupaten(provCode);
        const kabMatch = kabList.find((item) => item.nama === row.kab_kota);
        kabCode = kabMatch?.kode ?? "";
      } catch {
        kabCode = "";
      }
    } else {
      setWilayahKabupaten([]);
    }
    setForm({
      mode: "update",
      no: String(row.no || ""),
      npsn: row.npsn,
      nama_sekolah: row.nama_sekolah,
      provinsiCode: provCode,
      provinsi: row.provinsi,
      kabupatenCode: kabCode,
      kabupaten: row.kab_kota,
    });
  }

  function closeFormModal() {
    if (formSubmitting) return;
    setFormOpen(false);
    setFormError("");
    setForm(emptyCrudForm("create"));
  }

  async function onSelectProvinsi(kode: string) {
    const record = wilayahProvinsi.find((item) => item.kode === kode);
    const nama = record?.nama ?? "";
    setForm((current) => ({
      ...current,
      provinsiCode: kode,
      provinsi: nama,
      kabupatenCode: "",
      kabupaten: "",
    }));
    await loadWilayahKabupaten(kode);
  }

  function onSelectKabupaten(kode: string) {
    const record = wilayahKabupaten.find((item) => item.kode === kode);
    const nama = record?.nama ?? "";
    setForm((current) => ({
      ...current,
      kabupatenCode: kode,
      kabupaten: nama,
    }));
  }

  function canSubmitForm() {
    if (formSubmitting) return false;
    if (!String(form.npsn).trim() || String(form.npsn).trim().length < 6) return false;
    if (!String(form.nama_sekolah).trim()) return false;
    if (!String(form.provinsi).trim()) return false;
    if (!String(form.kabupaten).trim()) return false;
    return true;
  }

  async function handleFormSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const token = session?.token;
    if (!token) {
      setFormError("Sesi Anda habis. Silakan login ulang.");
      return;
    }
    if (!canSubmitForm()) {
      setFormError("Lengkapi semua kolom wajib: NPSN (min 6 digit), Nama Sekolah, Provinsi, dan Kota/Kabupaten.");
      return;
    }
    const npsn = String(form.npsn).trim();
    const nama = String(form.nama_sekolah).trim();
    const province = String(form.provinsi).trim();
    const city = String(form.kabupaten).trim();
    const schoolNo = form.no.trim() ? Number(form.no.trim()) : undefined;

    setFormSubmitting(true);
    setFormError("");
    try {
      if (form.mode === "create") {
        await workspaceInsertDatasetRowRequest(token, {
          datasetKey: DATASET_BACKEND_KEY[dataset],
          schoolNpsn: npsn,
          schoolName: nama,
          province,
          city,
          schoolNo,
        });
      } else {
        await workspaceUpdateDatasetRowRequest(token, {
          datasetKey: DATASET_BACKEND_KEY[dataset],
          schoolNpsn: npsn,
          schoolName: nama,
          province,
          city,
          schoolNo,
        });
      }
      setFormOpen(false);
      setForm(emptyCrudForm("create"));
      await loadRows();
    } catch (saveErr) {
      setFormError(
        saveErr instanceof Error ? saveErr.message : "Gagal menyimpan data sekolah.",
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmNpsn || deleteSubmitting) return;
    const token = session?.token;
    if (!token) return;
    setDeleteSubmitting(true);
    try {
      await workspaceDeleteDatasetRowRequest(token, {
        datasetKey: DATASET_BACKEND_KEY[dataset],
        schoolNpsn: deleteConfirmNpsn,
      });
      setDeleteConfirmNpsn(null);
      await loadRows();
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : "Gagal menghapus data sekolah.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const selectedDeleteRow = deleteConfirmNpsn
    ? rows.find((r) => r.npsn === deleteConfirmNpsn) ?? null
    : null;

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Sekolah Penerima • {DATASET_LABEL[dataset]}
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
              Daftar Sekolah Penerima {DATASET_LABEL[dataset]}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              {DATASET_HINT[dataset]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rows.length} Sekolah</Badge>
            <Badge variant="success">{filteredRows.length} Terfilter</Badge>
            <Button type="button" onClick={() => void openCreateModal()} className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Sekolah
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Cari Sekolah</span>
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari NPSN, nama sekolah, provinsi, atau kab/kota..."
                className="pl-9"
              />
            </div>
          </label>
          {refreshing ? (
            <Badge variant="secondary" className="gap-2 whitespace-nowrap">
              <Loader2 className="h-3 w-3 animate-spin" />
              Refresh data...
            </Badge>
          ) : null}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <a
          href="/admin/sekolah-penerima/reguler"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            dataset === "REGULER"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          Reguler
        </a>
        <a
          href="/admin/sekolah-penerima/terdampak"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            dataset === "TERDAMPAK"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          Terdampak
        </a>
      </div>

      {loading ? (
        <Card className="rounded-[24px]">
          <CardContent className="flex items-center gap-3 px-6 py-5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat daftar sekolah {DATASET_LABEL[dataset]}...
          </CardContent>
        </Card>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[80px_180px_minmax(360px,1fr)_240px_280px_160px] gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>No</span>
                <span>Provinsi</span>
                <span>Kota / Kab</span>
                <span>NPSN</span>
                <span>Nama Sekolah</span>
                <span className="text-right">Aksi</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-slate-600">
                    {rows.length === 0
                      ? "Belum ada data sekolah. Klik Tambah Sekolah untuk menambahkan."
                      : "Data tidak ditemukan."}
                  </div>
                ) : (
                  filteredRows.map((row) => {
                    const key = row.npsn || String(row.no);
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[80px_180px_minmax(360px,1fr)_240px_280px_160px] items-center gap-3 px-6 py-4 text-sm"
                      >
                        <div className="text-slate-600">{row.no}</div>
                        <div className="text-slate-700">{row.provinsi || "-"}</div>
                        <div className="text-slate-700">{row.kab_kota || "-"}</div>
                        <div className="font-medium text-slate-900">{row.npsn || "-"}</div>
                        <div className="font-semibold text-slate-950">{row.nama_sekolah || "-"}</div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void openUpdateModal(row)}
                            className="gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Ubah
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirmNpsn(row.npsn)}
                            className="gap-1.5 text-danger hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {formOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm"
          onClick={closeFormModal}
        />
      ) : null}
      {formOpen ? (
        <form
          onSubmit={(event) => void handleFormSubmit(event)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="crud-dialog-title"
          className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 flex w-[94vw] max-w-[720px] max-h-[92vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.45)]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <p id="crud-dialog-title" className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/75">
                {form.mode === "create" ? "Tambah Sekolah Penerima" : "Ubah Sekolah Penerima"} •{" "}
                {DATASET_LABEL[dataset]}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {form.mode === "create"
                  ? `Tambah sekolah ke daftar ${DATASET_LABEL[dataset].toLowerCase()}`
                  : `Ubah data sekolah ${DATASET_LABEL[dataset].toLowerCase()}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeFormModal}
              disabled={formSubmitting}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  Nomor Urut <span className="text-slate-400">(opsional)</span>
                </span>
                <Input
                  type="number"
                  min={1}
                  value={form.no}
                  onChange={(e) => setForm((current) => ({ ...current, no: e.target.value }))}
                  placeholder="Otomatis urut terakhir jika kosong"
                  disabled={formSubmitting}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  NPSN <span className="text-danger">*</span>
                </span>
                <Input
                  value={form.npsn}
                  onChange={(e) => setForm((current) => ({ ...current, npsn: e.target.value }))}
                  placeholder="Contoh: 20510920"
                  disabled={formSubmitting || form.mode === "update"}
                  maxLength={16}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span className="font-medium text-slate-900">
                Nama Sekolah <span className="text-danger">*</span>
              </span>
              <Input
                value={form.nama_sekolah}
                onChange={(e) =>
                  setForm((current) => ({ ...current, nama_sekolah: e.target.value }))
                }
                placeholder="Contoh: SMK NEGERI 1 JAKARTA PUSAT"
                disabled={formSubmitting}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  Provinsi <span className="text-danger">*</span>
                </span>
                <select
                  value={form.provinsiCode}
                  onChange={(e) => void onSelectProvinsi(e.target.value)}
                  disabled={formSubmitting || loadingWilayahProvinsi}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
                >
                  <option value="">
                    {loadingWilayahProvinsi ? "Memuat provinsi..." : "— Pilih Provinsi —"}
                  </option>
                  {wilayahProvinsi.map((item) => (
                    <option key={item.kode} value={item.kode}>
                      {item.nama}
                    </option>
                  ))}
                  {!wilayahProvinsi.length && form.provinsi ? (
                    <option value={form.provinsiCode}>{form.provinsi}</option>
                  ) : null}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  Kota / Kabupaten <span className="text-danger">*</span>
                </span>
                <select
                  value={form.kabupatenCode}
                  onChange={(e) => onSelectKabupaten(e.target.value)}
                  disabled={formSubmitting || loadingWilayahKabupaten || !form.provinsiCode}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
                >
                  <option value="">
                    {!form.provinsiCode
                      ? "Pilih provinsi terlebih dahulu"
                      : loadingWilayahKabupaten
                        ? "Memuat kota / kabupaten..."
                        : "— Pilih Kota / Kabupaten —"}
                  </option>
                  {wilayahKabupaten.map((item) => (
                    <option key={item.kode} value={item.kode}>
                      {item.nama}
                    </option>
                  ))}
                  {!wilayahKabupaten.length && form.kabupaten ? (
                    <option value={form.kabupatenCode}>{form.kabupaten}</option>
                  ) : null}
                </select>
              </label>
            </div>

            {formError ? (
              <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
                {formError}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeFormModal}
              disabled={formSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!canSubmitForm() || formSubmitting}
              className="gap-2 min-w-[140px] justify-center"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : form.mode === "create" ? (
                "Simpan & Tambahkan"
              ) : (
                "Simpan Perubahan"
              )}
            </Button>
          </div>
        </form>
      ) : null}

      {deleteConfirmNpsn ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm"
          onClick={() => !deleteSubmitting && setDeleteConfirmNpsn(null)}
        />
      ) : null}
      {deleteConfirmNpsn ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 flex w-[94vw] max-w-[480px] flex-col overflow-hidden rounded-[24px] border border-danger/20 bg-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.45)]"
        >
          <div className="border-b border-slate-200 px-6 py-4">
            <p
              id="delete-dialog-title"
              className="text-sm font-semibold uppercase tracking-[0.22em] text-danger/80"
            >
              Konfirmasi Hapus
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Hapus sekolah dari daftar {DATASET_LABEL[dataset].toLowerCase()}?
            </h2>
          </div>
          <div className="space-y-3 px-6 py-5 text-sm text-slate-700">
            <p>
              Anda akan menghapus sekolah berikut dari daftar penerima{" "}
              <span className="font-semibold text-slate-900">{DATASET_LABEL[dataset]}</span>:
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 grid gap-2">
              <div className="flex items-baseline gap-3">
                <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">NPSN</span>
                <span className="font-medium text-slate-900">{selectedDeleteRow?.npsn ?? deleteConfirmNpsn}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">Sekolah</span>
                <span className="font-semibold text-slate-950">{selectedDeleteRow?.nama_sekolah ?? "-"}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">Wilayah</span>
                <span className="text-slate-800">
                  {selectedDeleteRow?.kab_kota ? `${selectedDeleteRow.kab_kota}, ` : ""}
                  {selectedDeleteRow?.provinsi ?? "-"}
                </span>
              </div>
            </div>
            <p className="text-xs text-danger">
              Tindakan ini menghapus data dari tabel daftar penerima. Relasi lain (proposal, user sekolah, dll) yang berbasis NPSN tidak ikut terhapus.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmNpsn(null)}
              disabled={deleteSubmitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleteSubmitting}
              className="gap-2 min-w-[140px] justify-center"
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Ya, Hapus
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
