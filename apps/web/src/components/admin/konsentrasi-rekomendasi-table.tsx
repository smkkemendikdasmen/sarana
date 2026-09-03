"use client";

import { Loader2, Pencil, Search, Upload, X } from "lucide-react";
import { useEffect, useDeferredValue, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  KonsentrasiOption,
  KonsentrasiRekomendasiRow,
  konsentrasiMasterOptionsRequest,
  konsentrasiRekomendasiListRequest,
  konsentrasiRekomendasiPatchRowRequest,
  konsentrasiRekomendasiUploadExcelRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

interface EditForm {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  konsentrasi1Code: string;
  konsentrasi2Code: string;
  konsentrasi3Code: string;
  konsentrasi4Code: string;
  konsentrasi5Code: string;
}

function emptyEditForm(): EditForm {
  return {
    no: 0,
    npsn: "",
    nama_sekolah: "",
    provinsi: "",
    konsentrasi1Code: "",
    konsentrasi2Code: "",
    konsentrasi3Code: "",
    konsentrasi4Code: "",
    konsentrasi5Code: "",
  };
}

export function KonsentrasiRekomendasiTable() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<KonsentrasiRekomendasiRow[]>([]);
  const [masterOptions, setMasterOptions] = useState<KonsentrasiOption[]>([]);
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
  const [uploadResult, setUploadResult] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function loadMasterOptions() {
    const token = session?.token;
    if (!token) return;
    try {
      const payload = await konsentrasiMasterOptionsRequest(token);
      const list = Array.isArray(payload.rows) ? payload.rows : [];
      setMasterOptions(list);
    } catch (_err) {
      // ignore master load error gracefully, retry via loadRows
    }
  }

  async function loadRows() {
    const token = session?.token;
    if (!token) return;
    setRefreshing(true);
    setError("");
    try {
      if (masterOptions.length === 0) {
        await loadMasterOptions();
      }
      const payload = await konsentrasiRekomendasiListRequest(token);
      const list = Array.isArray(payload.rows) ? payload.rows : [];
      setRows(list);
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat daftar konsentrasi rekomendasi sekolah ABT.",
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
        if (masterOptions.length === 0) {
          await loadMasterOptions();
        }
        await loadRows();
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Gagal memuat daftar konsentrasi rekomendasi sekolah ABT.",
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
      [r.npsn, r.nama_sekolah, r.provinsi, r.konsentrasi_1?.name ?? "", r.konsentrasi_2?.name ?? "", r.konsentrasi_3?.name ?? "", r.konsentrasi_4?.name ?? "", r.konsentrasi_5?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, deferredQuery]);

  function openEditModal(row: KonsentrasiRekomendasiRow) {
    setFormError("");
    setForm({
      no: Number(row.no) || 0,
      npsn: row.npsn,
      nama_sekolah: row.nama_sekolah,
      provinsi: row.provinsi,
      konsentrasi1Code: row.konsentrasi_1?.code ?? "",
      konsentrasi2Code: row.konsentrasi_2?.code ?? "",
      konsentrasi3Code: row.konsentrasi_3?.code ?? "",
      konsentrasi4Code: row.konsentrasi_4?.code ?? "",
      konsentrasi5Code: row.konsentrasi_5?.code ?? "",
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
      setFormError("Lengkapi data sekolah terlebih dahulu.");
      return;
    }
    const codes = [
      form.konsentrasi1Code,
      form.konsentrasi2Code,
      form.konsentrasi3Code,
      form.konsentrasi4Code,
      form.konsentrasi5Code,
    ].map((c) => String(c ?? "").trim());
    const nonEmptyCodes = codes.filter((c) => c.length > 0);
    const uniqueCodes = new Set(nonEmptyCodes);
    if (nonEmptyCodes.length > 0 && uniqueCodes.size !== nonEmptyCodes.length) {
      setFormError("Terdapat duplikasi kode konsentrasi di 5 slot rekomendasi. Pastikan setiap konsentrasi memiliki kode yang unik.");
      return;
    }
    setFormSubmitting(true);
    setFormError("");
    try {
      await konsentrasiRekomendasiPatchRowRequest(token, {
        schoolNpsn: String(form.npsn).trim(),
        konsentrasi1Code: codes[0],
        konsentrasi2Code: codes[1],
        konsentrasi3Code: codes[2],
        konsentrasi4Code: codes[3],
        konsentrasi5Code: codes[4],
      });
      setFormOpen(false);
      setForm(emptyEditForm());
      await loadRows();
    } catch (saveErr) {
      setFormError(
        saveErr instanceof Error ? saveErr.message : "Gagal menyimpan konsentrasi rekomendasi.",
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
      const res = await konsentrasiRekomendasiUploadExcelRequest(token, file);
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

  const renderKonsentrasiCell = (k: KonsentrasiOption | null) => {
    if (!k) return <span className="text-slate-400 italic">-</span>;
    return (
      <div className="leading-[1.45]">
        <span className="font-bold text-slate-900 whitespace-nowrap">{k.code}</span>
        <span className="text-slate-500 mx-1">•</span>
        <span className="text-slate-700 text-[12px]">{k.name}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Data Utama • Konsentrasi Rekomendasi
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
              Konsentrasi Rekomendasi Sekolah ABT
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              Daftar Top 5 konsentrasi keahlian rekomendasi untuk {rows.length} sekolah penerima bantuan ABT (Dana Bagi Hasil). Pilih 5 konsentrasi rekomendasi per sekolah dari 128 master konsentrasi keahlian, atau upload file excel sekaligus untuk seluruh 132 sekolah.
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

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Cari Konsentrasi Sekolah</span>
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari NPSN, nama sekolah, provinsi, atau nama konsentrasi..."
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
            Memuat daftar konsentrasi rekomendasi sekolah ABT...
          </CardContent>
        </Card>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[2200px]">
              <div className="grid grid-cols-[60px_160px_120px_minmax(360px,1fr)_repeat(5,minmax(260px,1fr))_140px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>No</span>
                <span>Prov</span>
                <span>NPSN</span>
                <span>Nama Sekolah</span>
                <span>Konsentrasi 1</span>
                <span>Konsentrasi 2</span>
                <span>Konsentrasi 3</span>
                <span>Konsentrasi 4</span>
                <span>Konsentrasi 5</span>
                <span className="text-right">Aksi</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-slate-600">
                    {rows.length === 0
                      ? "Belum ada data konsentrasi rekomendasi."
                      : "Data tidak ditemukan."}
                  </div>
                ) : (
                  filteredRows.map((row) => {
                    const key = row.npsn || String(row.no);
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[60px_160px_120px_minmax(360px,1fr)_repeat(5,minmax(260px,1fr))_140px] items-start gap-3 px-5 py-3.5 text-[12.5px]"
                      >
                        <div className="text-slate-600 tabular-nums pt-1">{row.no}</div>
                        <div className="text-slate-700 truncate pt-1" title={row.provinsi}>
                          {row.provinsi || "-"}
                        </div>
                        <div className="font-medium text-slate-900 tabular-nums pt-1">
                          {row.npsn || "-"}
                        </div>
                        <div className="font-semibold text-slate-950 truncate pt-1" title={row.nama_sekolah}>
                          {row.nama_sekolah || "-"}
                        </div>
                        <div className="py-0.5">{renderKonsentrasiCell(row.konsentrasi_1)}</div>
                        <div className="py-0.5">{renderKonsentrasiCell(row.konsentrasi_2)}</div>
                        <div className="py-0.5">{renderKonsentrasiCell(row.konsentrasi_3)}</div>
                        <div className="py-0.5">{renderKonsentrasiCell(row.konsentrasi_4)}</div>
                        <div className="py-0.5">{renderKonsentrasiCell(row.konsentrasi_5)}</div>
                        <div className="flex items-center justify-end gap-2 pt-1">
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
          aria-labelledby="konsentrasi-edit-title"
          className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 flex w-[94vw] max-w-[720px] max-h-[92vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.45)]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <p id="konsentrasi-edit-title" className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/75">
                Ubah Konsentrasi Rekomendasi
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-6">
              <div className="grid md:grid-cols-3 gap-x-6 gap-y-1">
                <div><span className="font-semibold text-slate-700">No:</span> {form.no || "-"}</div>
                <div><span className="font-semibold text-slate-700">NPSN:</span> {form.npsn || "-"}</div>
                <div><span className="font-semibold text-slate-700">Provinsi:</span> {form.provinsi || "-"}</div>
                <div className="md:col-span-3"><span className="font-semibold text-slate-700">Sekolah:</span> {form.nama_sekolah || "-"}</div>
              </div>
            </div>

            {[1, 2, 3, 4, 5].map((slot) => {
              const codeKey = `konsentrasi${slot}Code` as keyof EditForm;
              const currentValue = String((form[codeKey] as string) ?? "");
              return (
                <div key={`konsentrasi-slot-${slot}`}>
                  <span className="text-sm font-medium text-slate-900">
                    Konsentrasi {slot}
                  </span>
                  <select
                    value={currentValue}
                    onChange={(e) =>
                      setForm((cur) => ({ ...cur, [codeKey]: String(e.target.value ?? "").trim() } as EditForm))
                    }
                    disabled={formSubmitting}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">— Tidak direkomendasikan (kosong) —</option>
                    {masterOptions.map((opt) => (
                      <option key={`${slot}-${opt.code}`} value={opt.code}>
                        {opt.code} — {opt.name}
                      </option>
                    ))}
                  </select>
                  {currentValue && masterOptions.find((o) => o.code === currentValue) ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Terpilih: <span className="font-semibold text-slate-700">{currentValue}</span>
                      <span className="mx-1 text-slate-400">•</span>
                      {masterOptions.find((o) => o.code === currentValue)?.name}
                    </p>
                  ) : null}
                </div>
              );
            })}

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
              {formSubmitting ? "Menyimpan..." : "Simpan Rekomendasi"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
