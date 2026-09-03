"use client";

import { ExternalLink, Loader2, PencilLine, Save, Search, X } from "lucide-react";
import { useEffect, useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  WorkspaceAdminSelectionData,
  WorkspaceBimtekReviewRecord,
  WorkspaceInterviewAssessmentRecord,
  WorkspaceSchoolEquipmentData,
  WorkspaceSchoolProposalData,
  WorkspaceUpdateDatasetRowRequest,
  workspaceAdminSelectionRequest,
  workspaceUpdateDatasetRowRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

interface ProfilSekolah {
  kecamatan?: string;
  status_sekolah?: number | string;
  akreditasi?: string;
  total_siswa?: number | string;
  total_rombel?: number | string;
  jumlah_guru?: number | string;
  nama_kepsek?: string;
  email?: string;
  nomor_telepon?: string | number;
  alamat_jalan?: string;
  desa_kelurahan?: string;
  kode_pos?: number | string;
  // Struktur Organisasi
  nip_kepsek?: string;
  telepon_kepsek?: string;
  jabatan_kepsek?: string;
  nama_wakasek_sarana?: string;
  telepon_wakasek_sarana?: string;
  jabatan_wakasek_sarana?: string;
}

interface CakupanKeahlian {
  bidang?: string[];
  program?: string[];
  kompetensi?: string[];
}

interface UsulanAlat680m {
  bidang_keahlian?: number | string;
  sebelum_pembulatan?: number | string;
  nilai_pembulatan?: number | string;
}

interface SekolahPenerimaAbtRow {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
  kecamatan?: string;
  catatan?: unknown;
  status_penerima_abt?: boolean;
  fasilitator_administrasi?: string;
  fasilitator_peralatan?: string;
  nilai_rpa?: number;
  jumlah_bidang_keahlian?: number;
  nilai_usulan_alat?: number;
  link_pks?: string | null;
  profil_sekolah?: ProfilSekolah;
  cakupan_keahlian?: CakupanKeahlian;
  usulan_alat_680m?: UsulanAlat680m;
  schoolId?: string | null;
}

type DetailSectionKey =
  | "data-sekolah"
  | "dokumen-administrasi"
  | "konsentrasi-keahlian"
  | "kondisi-alat"
  | "ajuan-alat"
  | "status-pks";

const DETAIL_SECTIONS: Array<{ key: DetailSectionKey; label: string }> = [
  { key: "data-sekolah", label: "Data Sekolah" },
  { key: "dokumen-administrasi", label: "Dokumen Administrasi" },
  { key: "konsentrasi-keahlian", label: "Konsentrasi Keahlian" },
  { key: "kondisi-alat", label: "Kondisi Alat" },
  { key: "ajuan-alat", label: "Ajuan Alat" },
  { key: "status-pks", label: "Status PKS" },
];

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

function displayFileSize(bytes: unknown) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) {
    return "-";
  }
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat("id-ID");
const abtBatalNpsnSet = new Set(["10100113", "69948792", "70042805", "70053078", "70050972", "69758279", "10206515"]);

function summarizeValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") {
    if (Number.isFinite(value)) return numberFormat.format(value);
    return "-";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "-";
    if (depth === 0 && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
      try {
        return summarizeValue(JSON.parse(trimmed), depth + 1);
      } catch {
        return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
      }
    }
    return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    const parts = value.slice(0, 3).map((v) => summarizeValue(v, depth + 1));
    const extra = value.length > 3 ? ` +${value.length - 3}` : "";
    return `${parts.join(", ")}${extra}`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return "-";
    const pick = entries.slice(0, 4);
    const label = (k: string) => k.replace(/[-_]/g, " ").slice(0, 16);
    const parts = pick
      .map(([k, v]) => {
        const sv = summarizeValue(v, depth + 1);
        if (sv === "-") return `${label(k)}: —`;
        return `${label(k)}: ${sv}`;
      });
    const extra = entries.length > 4 ? ` +${entries.length - 4} detail` : "";
    return `${parts.join(" · ")}${extra}`;
  }
  const asString = String(value).trim();
  return asString || "-";
}

function hasPksLink(row: SekolahPenerimaAbtRow) {
  const link = normalizeText(row.link_pks);
  return Boolean(link) && link.toLowerCase() !== "null";
}

function getAbtStatus(row: SekolahPenerimaAbtRow) {
  if (abtBatalNpsnSet.has(normalizeText(row.npsn))) {
    return "BATAL";
  }

  return hasPksLink(row) ? "LANJUT_PKS" : "LANJUT";
}

function toLookupByNpsn<T extends { schoolNpsn: string }>(records: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const npsn = normalizeText(record.schoolNpsn);
    if (!npsn) continue;
    const list = map.get(npsn) ?? [];
    list.push(record);
    map.set(npsn, list);
  }
  return map;
}

function renderLabelValueGrid(pairs: Array<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {pairs.map((pair, idx) => (
        <div key={idx} className="rounded-[14px] border border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{pair.label}</p>
          <p className="mt-1 text-sm text-slate-900">{pair.value ?? "-"}</p>
        </div>
      ))}
    </div>
  );
}

export function SekolahPenerimaAbtTable() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<SekolahPenerimaAbtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [proposalBundles, setProposalBundles] = useState<Record<string, WorkspaceSchoolProposalData>>({});
  const [equipmentBundles, setEquipmentBundles] = useState<Record<string, WorkspaceSchoolEquipmentData>>({});
  const [interviewByNpsn, setInterviewByNpsn] = useState<Map<string, WorkspaceInterviewAssessmentRecord[]>>(new Map());
  const [bimtekByNpsn, setBimtekByNpsn] = useState<Map<string, WorkspaceBimtekReviewRecord[]>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Map<string, boolean>>(new Map());

  const [selectedRow, setSelectedRow] = useState<SekolahPenerimaAbtRow | null>(null);
  const [activeSection, setActiveSection] = useState<DetailSectionKey>("data-sekolah");
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [adminDraft, setAdminDraft] = useState<{
    no: number;
    npsn: string;
    nama_sekolah: string;
    provinsi: string;
    kab_kota: string;
    kecamatan: string;
    status_penerima_abt: boolean | null;
    fasilitator_administrasi: string;
    fasilitator_peralatan: string;
    catatan_admin: string;
  } | null>(null);
  const [adminFeedback, setAdminFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) {
      return;
    }

    const controller = new AbortController();

    async function load() {
      const token = session?.token;
      if (!token) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const payload: WorkspaceAdminSelectionData = await workspaceAdminSelectionRequest(token, {
          datasetKey: "ABT",
          scope: "light",
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          const abtRows = (Array.isArray(payload.abtRows) ? payload.abtRows : []) as unknown as SekolahPenerimaAbtRow[];
          setRows(abtRows);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          if ((loadError as Error).name === "AbortError") return;
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data sekolah penerima ABT.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [hydrated, session?.token]);

  async function ensureDetailLoaded(row: SekolahPenerimaAbtRow) {
    const npsn = normalizeText(row.npsn);
    if (!npsn) return;
    if (proposalBundles[npsn] || equipmentBundles[npsn] || loadingDetails.get(npsn)) {
      return;
    }
    const token = session?.token;
    if (!token) return;
    setLoadingDetails((prev) => {
      const next = new Map(prev);
      next.set(npsn, true);
      return next;
    });
    try {
      const payload = await workspaceAdminSelectionRequest(token, { datasetKey: "ABT", scope: "full" });
      setProposalBundles((prev) => ({ ...prev, ...(payload.proposalBundles ?? {}) }));
      setEquipmentBundles((prev) => ({ ...prev, ...(payload.equipmentBundles ?? {}) }));
      const interviews = payload.interviewResults ?? [];
      const bimteks = payload.bimtekReviews ?? [];
      setInterviewByNpsn(toLookupByNpsn(interviews));
      setBimtekByNpsn(toLookupByNpsn(bimteks));
    } catch {
      // ignore
    } finally {
      setLoadingDetails((prev) => {
        const next = new Map(prev);
        next.delete(npsn);
        return next;
      });
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      const combined = [
        row.npsn,
        row.nama_sekolah,
        row.provinsi,
        row.kab_kota,
        row.kecamatan ?? "",
        row.profil_sekolah?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return combined.includes(normalizedQuery);
    });
  }, [deferredQuery, rows]);

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);
  const pageRows = useMemo(() => {
    const start = (Math.min(page, totalPages) - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, totalPages]);

  const summary = useMemo(() => {
    const totalRpa = rows.reduce((sum, row) => sum + (Number.isFinite(row.nilai_rpa) ? (row.nilai_rpa as number) : 0), 0);
    const totalUsulan = rows.reduce(
      (sum, row) => sum + (Number.isFinite(row.nilai_usulan_alat) ? (row.nilai_usulan_alat as number) : 0),
      0,
    );
    const totalPenerima = rows.filter((row) => row.status_penerima_abt).length;
    const totalBatal = rows.filter((row) => getAbtStatus(row) === "BATAL").length;
    const totalLanjutPks = rows.filter((row) => getAbtStatus(row) === "LANJUT_PKS").length;
    const totalLanjut = rows.filter((row) => getAbtStatus(row) === "LANJUT").length;

    return {
      totalRpa,
      totalUsulan,
      totalPenerima,
      totalBatal,
      totalLanjutPks,
      totalLanjut,
    };
  }, [rows]);

  useEffect(() => {
    if (!selectedRow) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRow(null);
      }
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [selectedRow]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <label className="grid gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Cari Sekolah</span>
                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari NPSN, nama sekolah, provinsi, kab/kota, email..."
                    className="pl-9"
                  />
                </div>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{rows.length} Sekolah</Badge>
              <Badge variant="success">{summary.totalLanjutPks} Lanjut dan PKS</Badge>
              <Badge variant="success">{summary.totalLanjut} Lanjut</Badge>
              <Badge variant="danger">{summary.totalBatal} Batal</Badge>
              <Badge variant="secondary">{summary.totalPenerima} Penerima ABT</Badge>
              <Badge variant="secondary">{currency.format(summary.totalRpa)} Total RPA</Badge>
              <Badge variant="secondary">{currency.format(summary.totalUsulan)} Total Usulan</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data sekolah penerima ABT...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1020px]">
              <div className="grid grid-cols-[80px_160px_minmax(320px,1fr)_minmax(240px,1fr)_220px_220px] gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>No</span>
                <span>NPSN</span>
                <span>Nama Sekolah</span>
                <span>Email</span>
                <span>Provinsi</span>
                <span>Kota / Kab</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredRows.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-slate-600">Data tidak ditemukan.</div>
                ) : (
                  pageRows.map((row) => {
                    const key = row.npsn || String(row.no);
                    const status = getAbtStatus(row);
                    const statusLabel =
                      status === "BATAL" ? "Batal" : status === "LANJUT_PKS" ? "Lanjut dan PKS" : "Lanjut";

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          void ensureDetailLoaded(row).finally(() => {
                            setSelectedRow(row);
                            setActiveSection("data-sekolah");
                            setIsEditingAdmin(false);
                            setAdminDraft(null);
                            setAdminFeedback(null);
                          });
                        }}
                        className="group block w-full text-left"
                      >
                        <div className="grid grid-cols-[80px_160px_minmax(320px,1fr)_minmax(240px,1fr)_220px_220px] gap-3 px-6 py-4 text-sm transition-colors group-hover:bg-primary/5">
                          <div className="text-slate-600">{row.no}</div>
                          <div className="font-medium text-slate-900">{row.npsn}</div>
                          <div>
                            <p className="font-semibold text-slate-950">{row.nama_sekolah}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant={status === "BATAL" ? "danger" : "success"}>{statusLabel}</Badge>
                              {row.profil_sekolah?.akreditasi ? (
                                <Badge variant="secondary">Akreditasi {row.profil_sekolah.akreditasi}</Badge>
                              ) : null}
                              {Number.isFinite(row.jumlah_bidang_keahlian) ? (
                                <Badge variant="secondary">
                                  {numberFormat.format(Number(row.jumlah_bidang_keahlian))} Bidang Keahlian
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-slate-700">
                            {displayText(row.profil_sekolah?.email)}
                          </div>
                          <div className="text-slate-700">{row.provinsi}</div>
                          <div className="text-slate-700">{row.kab_kota}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {filteredRows.length > pageSize ? (
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3 text-sm text-slate-600">
                  <div>
                    Halaman {Math.min(page, totalPages)} dari {totalPages} • Total {filteredRows.length} sekolah
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {selectedRow ? (
        <DetailModal
          row={selectedRow}
          activeSection={activeSection}
          onActiveSectionChange={setActiveSection}
          onClose={() => setSelectedRow(null)}
          isEditingAdmin={isEditingAdmin}
          onToggleEditAdmin={() => {
            if (isEditingAdmin) {
              setIsEditingAdmin(false);
              setAdminDraft(null);
              setAdminFeedback(null);
              return;
            }
            const token = session?.token;
            if (!token) return;
            setIsEditingAdmin(true);
            setAdminDraft({
              no: Number(selectedRow.no ?? 0),
              npsn: String(selectedRow.npsn ?? ""),
              nama_sekolah: String(selectedRow.nama_sekolah ?? ""),
              provinsi: String(selectedRow.provinsi ?? ""),
              kab_kota: String(selectedRow.kab_kota ?? ""),
              kecamatan: String(selectedRow.kecamatan ?? ""),
              status_penerima_abt:
                selectedRow.status_penerima_abt === true
                  ? true
                  : selectedRow.status_penerima_abt === false
                    ? false
                    : null,
              fasilitator_administrasi: String(selectedRow.fasilitator_administrasi ?? ""),
              fasilitator_peralatan: String(selectedRow.fasilitator_peralatan ?? ""),
              catatan_admin: selectedRow.catatan === null || selectedRow.catatan === undefined
                ? ""
                : String(selectedRow.catatan),
            });
            setAdminFeedback(null);
          }}
          adminDraft={adminDraft}
          onAdminDraftChange={(patch) =>
            setAdminDraft((prev) => (prev ? { ...prev, ...patch } : prev))
          }
          adminFeedback={adminFeedback}
          savingAdmin={savingAdmin}
          onSaveAdmin={async () => {
            const token = session?.token;
            if (!token || !adminDraft || !selectedRow) return;
            setSavingAdmin(true);
            setAdminFeedback(null);
            try {
              const patchBody: WorkspaceUpdateDatasetRowRequest = {
                datasetKey: "ABT",
                schoolNpsn: selectedRow.npsn,
                schoolNo: Number.isFinite(adminDraft.no) ? Number(adminDraft.no) : undefined,
                schoolName: adminDraft.nama_sekolah || undefined,
                province: adminDraft.provinsi || undefined,
                city: adminDraft.kab_kota || undefined,
                district: adminDraft.kecamatan || undefined,
                note: adminDraft.catatan_admin.trim() === "" ? null : adminDraft.catatan_admin,
                isSelected: adminDraft.status_penerima_abt,
                rawPayloadPatch: {
                  fasilitator_administrasi: adminDraft.fasilitator_administrasi || null,
                  fasilitator_peralatan: adminDraft.fasilitator_peralatan || null,
                },
              };
              const refreshed = await workspaceUpdateDatasetRowRequest(token, patchBody);
              if (refreshed) {
                setRows((prev) => {
                  const updated = refreshed as unknown as SekolahPenerimaAbtRow;
                  const list = prev.map((r) => (normalizeText(r.npsn) === normalizeText(updated.npsn) ? updated : r));
                  const current = list.find((r) => normalizeText(r.npsn) === normalizeText(updated.npsn));
                  if (current) setSelectedRow(current);
                  return list;
                });
              }
              setIsEditingAdmin(false);
              setAdminDraft(null);
              setAdminFeedback({ type: "success", message: "Perubahan data sekolah berhasil disimpan." });
            } catch (saveError) {
              setAdminFeedback({
                type: "error",
                message:
                  saveError instanceof Error
                    ? `Gagal menyimpan: ${saveError.message}`
                    : "Gagal menyimpan perubahan data sekolah.",
              });
            } finally {
              setSavingAdmin(false);
            }
          }}
          proposalBundle={normalizeText(selectedRow.npsn) ? proposalBundles[normalizeText(selectedRow.npsn)] ?? null : null}
          equipmentBundle={normalizeText(selectedRow.npsn) ? equipmentBundles[normalizeText(selectedRow.npsn)] ?? null : null}
          interviewResults={interviewByNpsn.get(normalizeText(selectedRow.npsn)) ?? []}
          bimtekReviews={bimtekByNpsn.get(normalizeText(selectedRow.npsn)) ?? []}
        />
      ) : null}
    </div>
  );
}

interface DetailModalProps {
  row: SekolahPenerimaAbtRow;
  activeSection: DetailSectionKey;
  onActiveSectionChange: (key: DetailSectionKey) => void;
  onClose: () => void;
  isEditingAdmin: boolean;
  onToggleEditAdmin: () => void;
  adminDraft: {
    no: number;
    npsn: string;
    nama_sekolah: string;
    provinsi: string;
    kab_kota: string;
    kecamatan: string;
    status_penerima_abt: boolean | null;
    fasilitator_administrasi: string;
    fasilitator_peralatan: string;
    catatan_admin: string;
  } | null;
  onAdminDraftChange: (patch: Partial<NonNullable<DetailModalProps["adminDraft"]>>) => void;
  adminFeedback: { type: "success" | "error"; message: string } | null;
  savingAdmin: boolean;
  onSaveAdmin: () => Promise<void>;
  proposalBundle: WorkspaceSchoolProposalData | null;
  equipmentBundle: WorkspaceSchoolEquipmentData | null;
  interviewResults: WorkspaceInterviewAssessmentRecord[];
  bimtekReviews: WorkspaceBimtekReviewRecord[];
}

function DetailModal(props: DetailModalProps) {
  const {
    row,
    activeSection,
    onActiveSectionChange,
    onClose,
    isEditingAdmin,
    onToggleEditAdmin,
    adminDraft,
    onAdminDraftChange,
    adminFeedback,
    savingAdmin,
    onSaveAdmin,
    proposalBundle,
    equipmentBundle,
    interviewResults,
    bimtekReviews,
  } = props;
  const status = getAbtStatus(row);
  const statusLabel = status === "BATAL" ? "Batal" : status === "LANJUT_PKS" ? "Lanjut dan PKS" : "Lanjut";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/50 backdrop-blur-sm">
      <div className="flex w-full max-w-7xl flex-col overflow-hidden bg-white md:my-8 md:rounded-[32px] md:shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status === "BATAL" ? "danger" : "success"}>{statusLabel}</Badge>
                {hasPksLink(row) ? (
                  <a
                    href={normalizeText(row.link_pks)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex"
                  >
                    <Badge variant="outline">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Buka PKS
                    </Badge>
                  </a>
                ) : null}
                <Badge variant="secondary">NPSN {row.npsn}</Badge>
                {isEditingAdmin ? (
                  <Badge variant="outline">Mode Edit Admin Aktif</Badge>
                ) : null}
              </div>
              <h2 className="mt-2 break-words text-2xl font-semibold text-slate-950 md:text-3xl">{row.nama_sekolah}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {displayText(row.provinsi)}
                {row.provinsi || row.kab_kota ? " • " : ""}
                {displayText(row.kab_kota)}
                {row.kecamatan ? ` • ${displayText(row.kecamatan)}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
              {!isEditingAdmin ? (
                <Button type="button" variant="outline" onClick={onToggleEditAdmin} disabled={savingAdmin}>
                  <PencilLine className="mr-1.5 h-4 w-4" />
                  Edit Data
                </Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" onClick={onToggleEditAdmin} disabled={savingAdmin}>
                    <X className="h-4 w-4" />
                    Batal Edit
                  </Button>
                  <Button type="button" variant="default" onClick={() => void onSaveAdmin()} disabled={savingAdmin}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {savingAdmin ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Semua Perubahan"
                    )}
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" onClick={onClose} className="shrink-0">
                Tutup
              </Button>
            </div>
          </div>

          {adminFeedback ? (
            <div
              className={`rounded-[18px] border px-4 py-3 text-sm ${
                adminFeedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-danger/25 bg-danger/[0.08] text-danger"
              }`}
            >
              {adminFeedback.message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {DETAIL_SECTIONS.map((section) => {
              const isActive = activeSection === section.key;
              return (
                <Button
                  key={section.key}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onActiveSectionChange(section.key)}
                >
                  {section.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
          {activeSection === "data-sekolah" ? (
            <SectionDataSekolah
              row={row}
              isEditingAdmin={isEditingAdmin}
              adminDraft={adminDraft}
              onAdminDraftChange={onAdminDraftChange}
            />
          ) : null}
          {activeSection === "dokumen-administrasi" ? <SectionDokumenAdministrasi /> : null}
          {activeSection === "konsentrasi-keahlian" ? <SectionKonsentrasiKeahlian row={row} /> : null}
          {activeSection === "kondisi-alat" ? <SectionKondisiAlat bundle={equipmentBundle} /> : null}
          {activeSection === "ajuan-alat" ? <SectionAjuanAlat row={row} bundle={proposalBundle} /> : null}
          {activeSection === "status-pks" ? (
            <SectionStatusPks
              row={row}
              interviewResults={interviewResults}
              bimtekReviews={bimtekReviews}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface SectionDataSekolahProps {
  row: SekolahPenerimaAbtRow;
  isEditingAdmin: boolean;
  adminDraft: NonNullable<DetailModalProps["adminDraft"]> | null;
  onAdminDraftChange: DetailModalProps["onAdminDraftChange"];
}

function SectionDataSekolah({ row, isEditingAdmin, adminDraft, onAdminDraftChange }: SectionDataSekolahProps) {
  const profil = row.profil_sekolah ?? {};
  const status = getAbtStatus(row);
  const statusLabel = status === "BATAL" ? "Batal" : status === "LANJUT_PKS" ? "Lanjut dan PKS" : "Lanjut";

  const draftNo = adminDraft?.no ?? Number(row.no ?? 0);
  const draftNpsn = adminDraft?.npsn ?? String(row.npsn ?? "");
  const draftNama = adminDraft?.nama_sekolah ?? String(row.nama_sekolah ?? "");
  const draftProv = adminDraft?.provinsi ?? String(row.provinsi ?? "");
  const draftKab = adminDraft?.kab_kota ?? String(row.kab_kota ?? "");
  const draftKec = adminDraft?.kecamatan ?? String(row.kecamatan ?? "");
  const draftStatus =
    adminDraft?.status_penerima_abt === true
      ? true
      : adminDraft?.status_penerima_abt === false
        ? false
        : (row.status_penerima_abt ?? null);
  const draftFasAdm = adminDraft?.fasilitator_administrasi ?? String(row.fasilitator_administrasi ?? "");
  const draftFasAlat = adminDraft?.fasilitator_peralatan ?? String(row.fasilitator_peralatan ?? "");
  const draftCatatanAdmin = adminDraft?.catatan_admin ?? (row.catatan == null ? "" : String(row.catatan));

  const inputBase =
    "w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600";

  const jabatanKepsekLocked =
    displayText(profil.jabatan_kepsek).trim() === "-"
      ? "Kepala Sekolah"
      : displayText(profil.jabatan_kepsek);
  const jabatanWakasekLocked =
    displayText(profil.jabatan_wakasek_sarana).trim() === "-"
      ? "Wakil Kepala Sekolah Bidang Sarana dan Prasarana"
      : displayText(profil.jabatan_wakasek_sarana);

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-6 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Data Identitas Sekolah
          </p>

          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Identitas Dasar
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                    NPSN
                  </label>
                  {!isEditingAdmin ? (
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {displayText(row.npsn)}
                    </p>
                  ) : (
                    <input
                      type="text"
                      value={draftNpsn}
                      onChange={(event) => onAdminDraftChange({ npsn: event.target.value })}
                      className={`${inputBase} mt-1`}
                      placeholder="Contoh: 10100113"
                    />
                  )}
                </div>
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                    Nama Sekolah
                  </label>
                  {!isEditingAdmin ? (
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {displayText(row.nama_sekolah)}
                    </p>
                  ) : (
                    <input
                      type="text"
                      value={draftNama}
                      onChange={(event) =>
                        onAdminDraftChange({ nama_sekolah: event.target.value })
                      }
                      className={`${inputBase} mt-1`}
                      placeholder="Contoh: SMK Negeri 1 Jakarta"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                    No
                  </label>
                  {!isEditingAdmin ? (
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {displayText(row.no)}
                    </p>
                  ) : (
                    <input
                      type="number"
                      value={Number.isFinite(draftNo) ? draftNo : 0}
                      onChange={(event) =>
                        onAdminDraftChange({ no: Number(event.target.value) })
                      }
                      className={`${inputBase} mt-1`}
                      min={0}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                    Status Penerima ABT
                  </label>
                  {!isEditingAdmin ? (
                    <p className="mt-1">
                      <Badge variant={status === "BATAL" ? "danger" : "success"}>
                        {statusLabel}
                      </Badge>
                    </p>
                  ) : (
                    <select
                      value={draftStatus === true ? "1" : draftStatus === false ? "0" : ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const next =
                          raw === "1" ? true : raw === "0" ? false : null;
                        onAdminDraftChange({ status_penerima_abt: next });
                      }}
                      className={`${inputBase} mt-1`}
                    >
                      <option value="">— Belum ditentukan —</option>
                      <option value="1">Diterima (Lanjut)</option>
                      <option value="0">Tidak Diterima</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                    Akreditasi
                  </label>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {displayText(profil.akreditasi)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-200" />

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Alamat Lengkap
              </p>
              {!isEditingAdmin ? (
                renderLabelValueGrid([
                  { label: "Provinsi", value: displayText(row.provinsi) },
                  { label: "Kota / Kabupaten", value: displayText(row.kab_kota) },
                  {
                    label: "Kecamatan",
                    value: displayText(row.kecamatan ?? profil.kecamatan),
                  },
                  { label: "Desa / Kelurahan", value: displayText(profil.desa_kelurahan) },
                  { label: "Alamat Jalan", value: displayText(profil.alamat_jalan) },
                  { label: "Kode Pos", value: displayText(profil.kode_pos) },
                  { label: "Email", value: displayText(profil.email) },
                  { label: "Nomor Telepon", value: displayText(profil.nomor_telepon) },
                  { label: "Status Sekolah", value: displayText(profil.status_sekolah) },
                ])
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      label: "Provinsi",
                      value: draftProv,
                      key: "provinsi" as const,
                      placeholder: "Contoh: DKI Jakarta",
                    },
                    {
                      label: "Kota / Kabupaten",
                      value: draftKab,
                      key: "kab_kota" as const,
                      placeholder: "Contoh: Kota Administrasi Jakarta Pusat",
                    },
                    {
                      label: "Kecamatan",
                      value: draftKec,
                      key: "kecamatan" as const,
                      placeholder: "Contoh: Gambir",
                    },
                    {
                      label: "Desa / Kelurahan",
                      value: displayText(profil.desa_kelurahan),
                      key: null,
                      disabled: true,
                      placeholder: "Data dari profil sekolah",
                    },
                    {
                      label: "Alamat Jalan",
                      value: displayText(profil.alamat_jalan),
                      key: null,
                      disabled: true,
                      placeholder: "Data dari profil sekolah",
                    },
                    {
                      label: "Kode Pos",
                      value: displayText(profil.kode_pos),
                      key: null,
                      disabled: true,
                      placeholder: "Data dari profil sekolah",
                    },
                    {
                      label: "Email",
                      value: displayText(profil.email),
                      key: null,
                      disabled: true,
                      placeholder: "Data dari profil sekolah",
                    },
                    {
                      label: "Nomor Telepon",
                      value: displayText(profil.nomor_telepon),
                      key: null,
                      disabled: true,
                      placeholder: "Data dari profil sekolah",
                    },
                    {
                      label: "Status Sekolah",
                      value: displayText(profil.status_sekolah),
                      key: null,
                      disabled: true,
                      placeholder: "Data dari profil sekolah",
                    },
                  ].map((field) => (
                    <div
                      key={`${field.label}-${field.key ?? "static"}`}
                      className="rounded-[14px] border border-slate-200 bg-slate-50/60 px-4 py-3"
                    >
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        {field.label}
                      </label>
                      {field.key ? (
                        <input
                          type="text"
                          value={field.value}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            onAdminDraftChange({
                              [field.key]: event.target.value,
                            } as Partial<NonNullable<typeof adminDraft>>)
                          }
                          className={`${inputBase} mt-1`}
                        />
                      ) : (
                        <input
                          type="text"
                          disabled
                          value={field.value}
                          placeholder={field.placeholder}
                          className={`${inputBase} mt-1`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-200" />

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Struktur Organisasi
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Kepala Sekolah</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Jabatan
                      </label>
                      <input
                        type="text"
                        disabled
                        value={jabatanKepsekLocked}
                        className={`${inputBase} mt-1`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Nama
                      </label>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {displayText(profil.nama_kepsek)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        NIP
                      </label>
                      <p className="mt-1 text-sm text-slate-800">
                        {displayText(profil.nip_kepsek)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Nomor HP
                      </label>
                      <p className="mt-1 text-sm text-slate-800">
                        {displayText(profil.telepon_kepsek)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Wakasek Sarana</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Jabatan
                      </label>
                      <input
                        type="text"
                        disabled
                        value={jabatanWakasekLocked}
                        className={`${inputBase} mt-1`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Nama
                      </label>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {displayText(profil.nama_wakasek_sarana)}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Nomor HP
                      </label>
                      <p className="mt-1 text-sm text-slate-800">
                        {displayText(profil.telepon_wakasek_sarana)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Data Rombel & SDM</p>
          {!isEditingAdmin ? (
            renderLabelValueGrid([
              { label: "Total Siswa", value: displayText(profil.total_siswa) },
              { label: "Total Rombel", value: displayText(profil.total_rombel) },
              { label: "Jumlah Guru", value: displayText(profil.jumlah_guru) },
              { label: "Jumlah Bidang Keahlian", value: displayText(row.jumlah_bidang_keahlian) },
              { label: "Fasilitator Administrasi", value: displayText(row.fasilitator_administrasi) },
              { label: "Fasilitator Peralatan", value: displayText(row.fasilitator_peralatan) },
              { label: "Catatan Seleksi", value: displayText(row.catatan) },
              { label: "Nilai RPA", value: Number.isFinite(row.nilai_rpa) ? currency.format(Number(row.nilai_rpa)) : "-" },
              {
                label: "Nilai Usulan Alat",
                value: Number.isFinite(row.nilai_usulan_alat) ? currency.format(Number(row.nilai_usulan_alat)) : "-",
              },
            ])
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { label: "Total Siswa", value: displayText(profil.total_siswa), disabled: true, placeholder: "Data dari profil sekolah" },
                { label: "Total Rombel", value: displayText(profil.total_rombel), disabled: true, placeholder: "Data dari profil sekolah" },
                { label: "Jumlah Guru", value: displayText(profil.jumlah_guru), disabled: true, placeholder: "Data dari profil sekolah" },
                { label: "Jumlah Bidang Keahlian", value: displayText(row.jumlah_bidang_keahlian), disabled: true, placeholder: "Data dari profil sekolah" },
                {
                  label: "Fasilitator Administrasi",
                  value: draftFasAdm,
                  disabled: false,
                  placeholder: "Nama fasilitator administrasi",
                  key: "fasilitator_administrasi" as const,
                },
                {
                  label: "Fasilitator Peralatan",
                  value: draftFasAlat,
                  disabled: false,
                  placeholder: "Nama fasilitator peralatan",
                  key: "fasilitator_peralatan" as const,
                },
                {
                  label: "Nilai RPA",
                  value: Number.isFinite(row.nilai_rpa) ? currency.format(Number(row.nilai_rpa)) : "-",
                  disabled: true,
                  placeholder: "Data dari profil sekolah",
                },
                {
                  label: "Nilai Usulan Alat",
                  value: Number.isFinite(row.nilai_usulan_alat) ? currency.format(Number(row.nilai_usulan_alat)) : "-",
                  disabled: true,
                  placeholder: "Data dari profil sekolah",
                },
              ].map((field) => (
                <div key={field.label} className="rounded-[14px] border border-slate-200 bg-slate-50/60 px-4 py-3">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">{field.label}</label>
                  {field.disabled ? (
                    <input type="text" disabled value={field.value} placeholder={field.placeholder} className={`${inputBase} mt-1`} />
                  ) : (
                    <input
                      type="text"
                      value={field.value}
                      placeholder={field.placeholder}
                      onChange={(event) => {
                        const patch: Partial<NonNullable<typeof adminDraft>> = {};
                        if (field.key === "fasilitator_administrasi") patch.fasilitator_administrasi = event.target.value;
                        if (field.key === "fasilitator_peralatan") patch.fasilitator_peralatan = event.target.value;
                        onAdminDraftChange(patch);
                      }}
                      className={`${inputBase} mt-1`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardContent className="space-y-3 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Catatan Admin</p>
            {!isEditingAdmin ? (
              <Badge variant={draftCatatanAdmin ? "secondary" : "outline"}>
                {draftCatatanAdmin ? `${draftCatatanAdmin.length} karakter` : "Belum ada catatan"}
              </Badge>
            ) : (
              <Badge variant="secondary">{draftCatatanAdmin.length} karakter</Badge>
            )}
          </div>
          {!isEditingAdmin ? (
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 whitespace-pre-wrap break-words min-h-[100px]">
              {draftCatatanAdmin ? draftCatatanAdmin : <span className="text-slate-400 italic">Belum ada catatan admin. Klik Edit Data untuk menambahkan catatan.</span>}
            </div>
          ) : (
            <textarea
              value={draftCatatanAdmin}
              onChange={(event) => onAdminDraftChange({ catatan_admin: event.target.value })}
              placeholder="Tambahkan catatan untuk data sekolah ini (misal: catatan seleksi, koreksi nama sekolah, status penerima, dsb)"
              rows={6}
              className={`${inputBase} leading-relaxed resize-y`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionDokumenAdministrasi() {
  return (
    <Card className="rounded-[24px]">
      <CardContent className="space-y-3 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Dokumen Administrasi Sekolah</p>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Data dokumen administrasi per sekolah dapat diakses melalui:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Login sebagai akun Sekolah (SEKOLAH) dan buka menu Profil Sekolah → tab Dokumen Administrasi.</li>
            <li>
              Atau gunakan modul Verifikasi Administrasi untuk role Fasilitator Administrasi (jika sekolah sudah ditugaskan
              pada tahap verifikasi).
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            *Data dokumen administrasi terpisah dari dataset rekap seleksi ini untuk menjaga keaslian bukti upload per
            satuan pendidikan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionKonsentrasiKeahlian({ row }: { row: SekolahPenerimaAbtRow }) {
  const cakupan = row.cakupan_keahlian ?? {};
  const bidang = Array.isArray(cakupan.bidang) ? cakupan.bidang : [];
  const program = Array.isArray(cakupan.program) ? cakupan.program : [];
  const kompetensi = Array.isArray(cakupan.kompetensi) ? cakupan.kompetensi : [];

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-3 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bidang Keahlian</p>
          {bidang.length === 0 ? (
            <p className="text-sm text-slate-600">-</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bidang.map((item, idx) => (
                <Badge key={`${item}-${idx}`} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardContent className="space-y-3 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Program Keahlian</p>
          {program.length === 0 ? (
            <p className="text-sm text-slate-600">-</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {program.map((item, idx) => (
                <Badge key={`${item}-${idx}`} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardContent className="space-y-3 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Paket Keahlian / Kompetensi Keahlian
          </p>
          {kompetensi.length === 0 ? (
            <p className="text-sm text-slate-600">-</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {kompetensi.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionKondisiAlat({ bundle }: { bundle: WorkspaceSchoolEquipmentData | null }) {
  if (!bundle) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="space-y-2 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Data Kondisi Alat</p>
          <EmptyState hint="Belum ada data Kondisi Alat yang di-input oleh sekolah ini." />
        </CardContent>
      </Card>
    );
  }
  const tables = bundle.equipmentTables ?? {};
  const keys = Object.keys(tables);

  return (
    <div className="space-y-5">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-2 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Data Kondisi Alat</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{keys.length} Tabel Data</Badge>
            {bundle.updatedAt ? (
              <Badge variant="outline">Terakhir diperbarui: {bundle.updatedAt}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {keys.length === 0 ? (
        <Card className="rounded-[24px]">
          <CardContent className="px-6 py-5">
            <EmptyState hint="Tabel kondisi alat kosong." />
          </CardContent>
        </Card>
      ) : (
        keys.map((key) => <EquipmentTableBlock key={key} tableKey={key} value={tables[key]} />)
      )}
    </div>
  );
}

function EquipmentTableBlock({ tableKey, value }: { tableKey: string; value: unknown }) {
  return <GenericRecordTableBlock title={tableKey} value={value} tone="alat" />;
}

function SectionAjuanAlat({
  row,
  bundle,
}: {
  row: SekolahPenerimaAbtRow;
  bundle: WorkspaceSchoolProposalData | null;
}) {
  const usulan680m = row.usulan_alat_680m ?? {};
  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-3 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ringkasan Usulan Alat 680 Miliar</p>
          {renderLabelValueGrid([
            {
              label: "Bidang Keahlian",
              value: displayText(usulan680m.bidang_keahlian),
            },
            {
              label: "Nilai Sebelum Pembulatan",
              value:
                typeof usulan680m.sebelum_pembulatan === "number"
                  ? currency.format(usulan680m.sebelum_pembulatan)
                  : displayText(usulan680m.sebelum_pembulatan),
            },
            {
              label: "Nilai Setelah Pembulatan",
              value:
                typeof usulan680m.nilai_pembulatan === "number"
                  ? currency.format(usulan680m.nilai_pembulatan)
                  : displayText(usulan680m.nilai_pembulatan),
            },
            {
              label: "Nilai RPA",
              value: Number.isFinite(row.nilai_rpa) ? currency.format(Number(row.nilai_rpa)) : "-",
            },
          ])}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Proposal Alat (Detail)</p>
          {!bundle ? (
            <EmptyState hint="Belum ada data Proposal / Ajuan Alat yang di-input oleh sekolah ini." />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{Object.keys(bundle.proposalTables ?? {}).length} Tabel Proposal</Badge>
                <Badge variant="outline">{Object.keys(bundle.rpkpSelections ?? {}).length} RPKP Selection</Badge>
                {bundle.updatedAt ? <Badge variant="outline">Update: {bundle.updatedAt}</Badge> : null}
              </div>
              <div className="space-y-4">
                {Object.keys(bundle.proposalTables ?? {}).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(bundle.proposalTables ?? {}).map(([k, v]) => (
                      <GenericRecordTableBlock key={`proposal-${k}`} title={`Proposal • ${k}`} value={v} tone="ajuan" />
                    ))}
                  </div>
                ) : null}
                {Object.keys(bundle.rpkpSelections ?? {}).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(bundle.rpkpSelections ?? {}).map(([k, v]) => (
                      <GenericRecordTableBlock
                        key={`rpkp-${k}`}
                        title={`RPKP Selection • ${k}`}
                        value={v}
                        tone="ajuan"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionStatusPks({
  row,
  interviewResults,
  bimtekReviews,
}: {
  row: SekolahPenerimaAbtRow;
  interviewResults: WorkspaceInterviewAssessmentRecord[];
  bimtekReviews: WorkspaceBimtekReviewRecord[];
}) {
  const status = getAbtStatus(row);
  const statusLabel = status === "BATAL" ? "Batal" : status === "LANJUT_PKS" ? "Lanjut dan PKS" : "Lanjut";

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status Alur PKS & Usulan</p>
          {renderLabelValueGrid([
            {
              label: "Status Penerima",
              value: <Badge variant={status === "BATAL" ? "danger" : "success"}>{statusLabel}</Badge>,
            },
            {
              label: "Link PKS",
              value: hasPksLink(row) ? (
                <a
                  href={normalizeText(row.link_pks)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Buka Dokumen PKS
                </a>
              ) : (
                "-"
              ),
            },
            { label: "Nilai RPA", value: Number.isFinite(row.nilai_rpa) ? currency.format(Number(row.nilai_rpa)) : "-" },
            {
              label: "Nilai Usulan Alat",
              value: Number.isFinite(row.nilai_usulan_alat) ? currency.format(Number(row.nilai_usulan_alat)) : "-",
            },
            { label: "Wawancara (Hasil)", value: `${interviewResults.length} penilaian` },
            { label: "Bimtek Review", value: `${bimtekReviews.length} data review` },
            {
              label: "Fasilitator Administrasi",
              value: displayText(row.fasilitator_administrasi),
            },
            {
              label: "Fasilitator Peralatan",
              value: displayText(row.fasilitator_peralatan),
            },
          ])}
        </CardContent>
      </Card>

      {interviewResults.length > 0 ? (
        <Card className="rounded-[24px]">
          <CardContent className="space-y-4 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Riwayat Wawancara</p>
            <div className="space-y-3">
              {interviewResults.map((item, idx) => (
                <div key={`${item.assignmentKey}-${idx}`} className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Fasilitator: {displayText(item.facilitatorEquipmentName)}</Badge>
                    <Badge variant="outline">Skor: {displayText(item.totalScore)}</Badge>
                    {item.updatedAt ? <Badge variant="outline">{item.updatedAt}</Badge> : null}
                  </div>
                  {Object.keys(item.answers ?? {}).length > 0 ? (
                    <GenericRecordTableBlock title="Detail Jawaban" value={item.answers} tone="pks" />
                  ) : null}
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-950">Rekomendasi: </span>
                      {displayText(item.recommendation)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">Catatan: </span>
                      {displayText(item.note)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {bimtekReviews.length > 0 ? (
        <Card className="rounded-[24px]">
          <CardContent className="space-y-4 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Review Bimbingan Teknis</p>
            <div className="space-y-3">
              {bimtekReviews.map((item, idx) => (
                <div key={`${item.schoolNpsn}-${item.facilitatorEquipmentId}-${idx}`} className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Fasilitator: {displayText(item.facilitatorEquipmentName)}</Badge>
                    {item.updatedAt ? <Badge variant="outline">{item.updatedAt}</Badge> : null}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {(["survey", "rpkp", "rab"] as const).map((docKey) => {
                      const docLabel = docKey.toUpperCase();
                      const stat = String(item.statuses?.[docKey] ?? "pending").toLowerCase();
                      const note = displayText(item.notes?.[docKey]);
                      const tone =
                        stat === "approved"
                          ? "success"
                          : stat === "revisi" || stat === "rejected"
                            ? "danger"
                            : "secondary";
                      return (
                        <div key={docKey} className="rounded-[14px] border border-white bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-950">{docLabel}</p>
                            <Badge variant={tone as "success" | "danger" | "secondary"}>
                              {stat === "approved" ? "Disetujui" : stat === "revisi" ? "Revisi" : stat === "rejected" ? "Ditolak" : "Pending"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{note}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EmptyState({ hint }: { hint: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-600">
      {hint}
    </div>
  );
}

function GenericRecordTableBlock({
  title,
  value,
  tone,
}: {
  title: string;
  value: unknown;
  tone: "alat" | "ajuan" | "pks";
}) {
  if (value === null || value === undefined) {
    return (
      <div className="rounded-[20px] border border-slate-200 bg-white">
        <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
        </div>
        <div className="px-5 py-4">
          <EmptyState hint="Tidak ada data pada tabel ini." />
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="rounded-[20px] border border-slate-200 bg-white">
          <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">{title}</p>
              <Badge variant="outline">0 baris</Badge>
            </div>
          </div>
          <div className="px-5 py-4">
            <EmptyState hint="Tabel kosong." />
          </div>
        </div>
      );
    }

    const columns = Array.from(
      value.reduce<string[]>((acc, row) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          Object.keys(row as Record<string, unknown>).forEach((k) => {
            if (!acc.includes(k)) acc.push(k);
          });
        }
        return acc;
      }, []),
    );

    const headerTone =
      tone === "alat" ? "bg-sky-50 text-sky-900" : tone === "ajuan" ? "bg-emerald-50 text-emerald-900" : "bg-indigo-50 text-indigo-900";

    if (columns.length === 0) {
      return (
        <div className="rounded-[20px] border border-slate-200 bg-white">
          <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
            <p className="text-sm font-semibold text-slate-950">{title}</p>
          </div>
          <ul className="divide-y divide-slate-100 px-5 py-2 text-sm">
            {value.map((item, idx) => (
              <li key={idx} className="py-2">
                {typeof item === "object" ? summarizeValue(item) : displayText(item as unknown)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
        <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${tone === "alat" ? "text-sky-950" : tone === "ajuan" ? "text-emerald-950" : "text-indigo-950"}`}>
              {title}
            </p>
            <Badge variant="outline">{value.length} baris</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className={`sticky left-0 z-10 w-16 border-b border-slate-200 px-3 py-2 text-left font-semibold ${headerTone}`}>#</th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className={`border-b border-slate-200 px-3 py-2 text-left font-semibold whitespace-nowrap ${headerTone}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((row, rowIdx) => {
                const cell =
                  row != null && typeof row === "object" && !Array.isArray(row)
                    ? (row as Record<string, unknown>)
                    : ({});
                return (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-inherit px-3 py-2 text-slate-500">{rowIdx + 1}</td>
                    {columns.map((col) => {
                      const raw = cell[col];
                      let text = "";
                      if (raw === null || raw === undefined) {
                        text = "-";
                      } else if (typeof raw === "number") {
                        text =
                          /size|bytes|harga|biaya|nilai|total|amount|nominal/i.test(col)
                            ? displayFileSize(raw)
                            : /file_size|filesize/i.test(col)
                              ? displayFileSize(raw)
                              : numberFormat.format(raw);
                      } else if (typeof raw === "boolean") {
                        text = raw ? "Ya" : "Tidak";
                      } else if (Array.isArray(raw)) {
                        text = raw.length > 0 ? raw.join(", ") : "-";
                      } else if (typeof raw === "object") {
                        text = summarizeValue(raw);
                      } else {
                        text = String(raw);
                      }
                      return (
                        <td key={col} className="border-b border-slate-100 px-3 py-2 align-top text-slate-700 whitespace-nowrap">
                          {text || "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return (
        <div className="rounded-[20px] border border-slate-200 bg-white">
          <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
            <p className="text-sm font-semibold text-slate-950">{title}</p>
          </div>
          <div className="px-5 py-4">
            <EmptyState hint="Tidak ada data pada tabel ini." />
          </div>
        </div>
      );
    }

    // Check if it's a record of records (e.g., per konsentrasi breakdown) — render recursively
    const hasNestedRecord = keys.every(
      (k) =>
        obj[k] != null &&
        typeof obj[k] === "object" &&
        !Array.isArray(obj[k]) &&
        Object.keys(obj[k] as Record<string, unknown>).length > 0,
    );
    if (hasNestedRecord) {
      return (
        <div className="space-y-3">
          <div className={`rounded-[20px] px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
            <p className={`text-sm font-semibold ${tone === "alat" ? "text-sky-950" : tone === "ajuan" ? "text-emerald-950" : "text-indigo-950"}`}>
              {title}
            </p>
          </div>
          <div className="space-y-3">
            {keys.map((k) => (
              <GenericRecordTableBlock key={k} title={k} value={obj[k]} tone={tone} />
            ))}
          </div>
        </div>
      );
    }

    const rows = keys.map((k) => {
      const raw = obj[k];
      let text = "";
      if (raw === null || raw === undefined) {
        text = "-";
      } else if (typeof raw === "number") {
        text = numberFormat.format(raw);
      } else if (typeof raw === "boolean") {
        text = raw ? "Ya" : "Tidak";
      } else if (Array.isArray(raw)) {
        text = raw.length > 0 ? raw.join(", ") : "-";
      } else if (typeof raw === "object") {
        text = summarizeValue(raw);
      } else {
        text = String(raw);
      }
      return { key: k, value: text };
    });

    return (
      <div className="rounded-[20px] border border-slate-200 bg-white">
        <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
          <p className={`text-sm font-semibold ${tone === "alat" ? "text-sky-950" : tone === "ajuan" ? "text-emerald-950" : "text-indigo-950"}`}>
            {title}
          </p>
        </div>
        <div className="grid gap-2 px-5 py-4 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-[14px] border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{r.key}</p>
              <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-all">{r.value || "-"}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white">
      <div className={`border-b px-5 py-3 ${tone === "alat" ? "bg-sky-50" : tone === "ajuan" ? "bg-emerald-50" : "bg-indigo-50"}`}>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
      </div>
      <div className="px-5 py-4 text-sm text-slate-700 break-all">{String(value)}</div>
    </div>
  );
}

// Ensure displayFileSize & currency used for later expansions of table rendering; keep referenced to avoid unused warnings.
void displayFileSize;
