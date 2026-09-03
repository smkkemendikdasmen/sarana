"use client";

import { Loader2, Pencil, Search, Upload, X } from "lucide-react";
import { useEffect, useDeferredValue, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PaguAnggaranRow,
  paguAnggaranListRequest,
  paguAnggaranPatchRowRequest,
  paguAnggaranUploadExcelRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatRupiah = (n: number): string => IDR.format(Math.max(0, Math.floor(Number(n) || 0)));

function toPlainNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Math.max(0, Math.floor(v));
  const s = String(v).replace(/[^\d-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

interface EditForm {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  paguPersiapan: number;
  paguAlat: number;
  paguPelatihan: number;
}

function emptyEditForm(): EditForm {
  return {
    no: 0,
    npsn: "",
    nama_sekolah: "",
    provinsi: "",
    paguPersiapan: 0,
    paguAlat: 0,
    paguPelatihan: 0,
  };
}

export function PaguAnggaranTable() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<PaguAnggaranRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(() => emptyEditForm());
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function loadRows() {
    const token = session?.token;
    if (!token) return;
    setRefreshing(true);
    setError("");
    try {
      const payload = await paguAnggaranListRequest(token);
      const list = Array.isArray(payload.rows) ? payload.rows : [];
      setRows(list);
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat daftar pagu anggaran sekolah ABT.",
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
              : "Gagal memuat daftar pagu anggaran sekolah ABT.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [hydrated, session?.token]);

  const filteredRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.npsn, r.nama_sekolah, r.provinsi]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, deferredQuery]);

  const totalPaguPersiapan = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.pagu_persiapan) || 0), 0),
    [rows],
  );
  const totalPaguAlat = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.pagu_alat) || 0), 0),
    [rows],
  );
  const totalPaguPelatihan = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.pagu_pelatihan) || 0), 0),
    [rows],
  );
  const totalPaguKeseluruhan = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.pagu_total) || 0), 0),
    [rows],
  );

  function openEditModal(row: PaguAnggaranRow) {
    setFormError("");
    setForm({
      no: Number(row.no) || 0,
      npsn: row.npsn,
      nama_sekolah: row.nama_sekolah,
      provinsi: row.provinsi,
      paguPersiapan: Math.max(0, Math.floor(Number(row.pagu_persiapan) || 0)),
      paguAlat: Math.max(0, Math.floor(Number(row.pagu_alat) || 0)),
      paguPelatihan: Math.max(0, Math.floor(Number(row.pagu_pelatihan) || 0)),
    });
    setFormOpen(true);
  }

  function closeEditModal() {
    if (formSubmitting) return;
    setFormOpen(false);
    setFormError("");
    setForm(emptyEditForm());
  }

  function canSubmitForm(): boolean {
    if (formSubmitting) return false;
    if (!String(form.npsn).trim()) return false;
    const p = Number(form.paguPersiapan);
    const a = Number(form.paguAlat);
    const t = Number(form.paguPelatihan);
    if (!Number.isFinite(p) || p < 0) return false;
    if (!Number.isFinite(a) || a < 0) return false;
    if (!Number.isFinite(t) || t < 0) return false;
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
      setFormError("Lengkapi NPSN dan semua nilai pagu (min 0).");
      return;
    }
    setFormSubmitting(true);
    setFormError("");
    try {
      await paguAnggaranPatchRowRequest(token, {
        schoolNpsn: String(form.npsn).trim(),
        paguPersiapan: Math.max(0, Math.floor(Number(form.paguPersiapan) || 0)),
        paguAlat: Math.max(0, Math.floor(Number(form.paguAlat) || 0)),
        paguPelatihan: Math.max(0, Math.floor(Number(form.paguPelatihan) || 0)),
        status: "DRAFT",
      });
      setFormOpen(false);
      setForm(emptyEditForm());
      await loadRows();
    } catch (saveErr) {
      setFormError(
        saveErr instanceof Error ? saveErr.message : "Gagal menyimpan pagu anggaran.",
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    const file = files?.[0];
    if (!file) return;
    const token = session?.token;
    if (!token) {
      setUploadResult("Sesi Anda habis. Silakan login ulang.");
      return;
    }
    setUploading(true);
    setUploadResult("");
    setError("");
    try {
      const res = await paguAnggaranUploadExcelRequest(token, file);
      const s = res.summary;
      const errorsText = s.errors?.length
        ? `\nError (${s.errors.length} baris):\n${s.errors.slice(0, 10).map((e) => `• Baris ${e.row}${e.npsn ? ` (NPSN ${e.npsn})` : ""}: ${e.message}`).join("\n")}${s.errors.length > 10 ? `\n…dan ${s.errors.length - 10} error lainnya` : ""}`
        : "";
      setUploadResult(
        `Upload selesai. Total baris excel: ${res.totalRows} • Inserted: ${s.inserted} • Updated: ${s.updated} • Skipped: ${s.skipped}${errorsText}`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadRows();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal upload excel.";
      setError(msg);
      setUploadResult(`Gagal upload: ${msg}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const calcTotal = toPlainNumber(form.paguPersiapan) + toPlainNumber(form.paguAlat) + toPlainNumber(form.paguPelatihan);

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Data Utama • Pagu Anggaran
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
              Pagu Anggaran Sekolah ABT
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              Daftar pagu anggaran untuk {rows.length} sekolah penerima bantuan ABT (Dana Bagi Hasil) tahun ajaran 2026/2027. Tetapkan pagu persiapan, pagu alat, dan pagu pelatihan per sekolah secara manual melalui tombol Ubah, atau upload file excel sekaligus untuk seluruh 131 sekolah.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rows.length} Sekolah ABT</Badge>
            <Badge variant="success">{filteredRows.length} Terfilter</Badge>
            <Button
              type="button"
              onClick={() => void handleUploadClick()}
              disabled={uploading || !session?.token}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Mengupload..." : "Upload Excel"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pagu Persiapan
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {formatRupiah(totalPaguPersiapan)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pagu Alat
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {formatRupiah(totalPaguAlat)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pagu Pelatihan
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {formatRupiah(totalPaguPelatihan)}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
              Pagu Total
            </p>
            <p className="mt-2 text-lg font-semibold text-primary-900">
              {formatRupiah(totalPaguKeseluruhan)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Cari Pagu Sekolah</span>
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari NPSN, nama sekolah, atau provinsi..."
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

        {uploadResult ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
            {uploadResult}
          </div>
        ) : null}
      </section>

      {loading ? (
        <Card className="rounded-[24px]">
          <CardContent className="flex items-center gap-3 px-6 py-5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat daftar pagu anggaran sekolah ABT...
          </CardContent>
        </Card>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              <div className="grid grid-cols-[60px_160px_120px_minmax(360px,1fr)_180px_180px_180px_200px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>No</span>
                <span>Prov</span>
                <span>NPSN</span>
                <span>Nama Sekolah</span>
                <span className="text-right">Pagu Persiapan</span>
                <span className="text-right">Pagu Alat</span>
                <span className="text-right">Pagu Pelatihan</span>
                <span className="text-right">Pagu Total</span>
                <span className="text-right">Aksi</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-slate-600">
                    {rows.length === 0
                      ? "Belum ada data pagu anggaran."
                      : "Data tidak ditemukan."}
                  </div>
                ) : (
                  filteredRows.map((row) => {
                    const key = row.npsn || String(row.no);
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[60px_160px_120px_minmax(360px,1fr)_180px_180px_180px_200px_140px] items-center gap-3 px-5 py-3.5 text-[12.5px]"
                      >
                        <div className="text-slate-600 tabular-nums">{row.no}</div>
                        <div className="text-slate-700 truncate" title={row.provinsi}>
                          {row.provinsi || "-"}
                        </div>
                        <div className="font-medium text-slate-900 tabular-nums">
                          {row.npsn || "-"}
                        </div>
                        <div className="font-semibold text-slate-950 truncate" title={row.nama_sekolah}>
                          {row.nama_sekolah || "-"}
                        </div>
                        <div className="text-right tabular-nums text-slate-700">
                          {formatRupiah(row.pagu_persiapan)}
                        </div>
                        <div className="text-right tabular-nums text-slate-700">
                          {formatRupiah(row.pagu_alat)}
                        </div>
                        <div className="text-right tabular-nums text-slate-700">
                          {formatRupiah(row.pagu_pelatihan)}
                        </div>
                        <div className="text-right tabular-nums font-semibold text-slate-950">
                          {formatRupiah(row.pagu_total)}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(row)}
                            className="gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Ubah
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
          onClick={closeEditModal}
        />
      ) : null}
      {formOpen ? (
        <form
          onSubmit={(event) => void handleFormSubmit(event)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pagu-edit-title"
          className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 flex w-[94vw] max-w-[640px] max-h-[92vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.45)]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <p id="pagu-edit-title" className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/75">
                Ubah Pagu Anggaran
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {form.nama_sekolah || "Sekolah ABT"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                NPSN {form.npsn || "-"} • {form.provinsi || "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditModal}
              disabled={formSubmitting}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-6">
                <div className="grid md:grid-cols-3 gap-x-6 gap-y-1">
                  <div><span className="font-semibold text-slate-700">No:</span> {form.no || "-"}</div>
                  <div><span className="font-semibold text-slate-700">NPSN:</span> {form.npsn || "-"}</div>
                  <div><span className="font-semibold text-slate-700">Provinsi:</span> {form.provinsi || "-"}</div>
                  <div className="md:col-span-3"><span className="font-semibold text-slate-700">Sekolah:</span> {form.nama_sekolah || "-"}</div>
                </div>
              </div>

              <div className="md:col-span-1">
                <span className="text-sm font-medium text-slate-900">
                  Pagu Persiapan <span className="text-danger">*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.paguPersiapan}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, paguPersiapan: toPlainNumber(e.target.value) }))
                  }
                  placeholder="Contoh: 25000000"
                  disabled={formSubmitting}
                  className="mt-2 tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                  {formatRupiah(form.paguPersiapan)}
                </p>
              </div>

              <div className="md:col-span-1">
                <span className="text-sm font-medium text-slate-900">
                  Pagu Alat <span className="text-danger">*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.paguAlat}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, paguAlat: toPlainNumber(e.target.value) }))
                  }
                  placeholder="Contoh: 100000000"
                  disabled={formSubmitting}
                  className="mt-2 tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                  {formatRupiah(form.paguAlat)}
                </p>
              </div>

              <div className="md:col-span-1">
                <span className="text-sm font-medium text-slate-900">
                  Pagu Pelatihan <span className="text-danger">*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.paguPelatihan}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, paguPelatihan: toPlainNumber(e.target.value) }))
                  }
                  placeholder="Contoh: 50000"
                  disabled={formSubmitting}
                  className="mt-2 tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                  {formatRupiah(form.paguPelatihan)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                    Pagu Total (auto calculate)
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-primary-900">
                    {formatRupiah(calcTotal)}
                  </p>
                </div>
                <div className="text-right text-[11px] leading-5 text-primary/80">
                  Persiapan + Alat + Pelatihan<br />
                  Tidak dapat diedit langsung
                </div>
              </div>
            </div>

            {formError ? (
              <div className="rounded-xl border border-danger/20 bg-danger/[0.08] px-4 py-3 text-xs leading-6 text-danger">
                {formError}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditModal}
              disabled={formSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={formSubmitting || !canSubmitForm()}
              className="gap-2"
            >
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {formSubmitting ? "Menyimpan..." : "Simpan Pagu"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
