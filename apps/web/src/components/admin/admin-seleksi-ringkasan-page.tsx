"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSignature,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type BimtekReviewRecord,
  type InterviewAssessmentRecord,
} from "@/lib/facilitator-workspace";
import {
  type WorkspaceAdminSelectionData,
  type WorkspaceVerifikasiOnlineRecord,
  workspaceAdminSelectionRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type DatasetKey = "reguler" | "abt";

interface AdminSeleksiRingkasanPageProps {
  datasetKey: DatasetKey;
}

interface BaseRegulerRow {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
  link_folder_drive?: string | null;
  link_scan_pks?: string | null;
}

interface BaseAbtRow {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
  link_pks?: string | null;
  status_penerima_abt?: boolean;
}

interface SeleksiRingkasanRow {
  no: number;
  npsn: string;
  namaSekolah: string;
  provinsi: string;
  kabKota: string;
  administrasi: {
    status: "belum" | "diperiksa" | "lolos" | "tidak";
    label: string;
  };
  wawancara: {
    status: "belum" | "lolos" | "tidak";
    nilai: number | null;
    label: string;
  };
  kondisiAlat: {
    status: "belum" | "diperiksa" | "lolos" | "tidak";
    link: string | null;
    label: string;
  };
  ajuanAlat: {
    status: "belum" | "diperiksa" | "lolos" | "tidak";
    link: string | null;
    label: string;
  };
  pks: {
    pengajuan: "belum" | "proses" | "selesai";
    tandatanganPpk: boolean;
    link: string | null;
    label: string;
  };
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function StageBadge({
  status,
  label,
}: {
  status: "belum" | "diperiksa" | "lolos" | "tidak" | "proses" | "selesai";
  label: string;
}) {
  let variant: "default" | "success" | "danger" | "secondary" | "outline" | "warning" =
    "secondary";
  switch (status) {
    case "lolos":
    case "selesai":
      variant = "success";
      break;
    case "tidak":
      variant = "danger";
      break;
    case "diperiksa":
    case "proses":
      variant = "outline";
      break;
    case "belum":
    default:
      variant = "secondary";
  }
  return <Badge variant={variant}>{label}</Badge>;
}

function StageIcon({ status }: { status: string }) {
  if (status === "lolos" || status === "selesai") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (status === "tidak") {
    return <XCircle className="h-4 w-4 text-rose-600" />;
  }
  return <div className="h-4 w-4" />;
}

function LinkChip({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) {
    return <span className="text-xs text-slate-400">-</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 rounded-md border border-primary/15 bg-primary-soft/50 px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft transition"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}

const inputBase =
  "w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600";

export function AdminSeleksiRingkasanPage({ datasetKey }: AdminSeleksiRingkasanPageProps) {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WorkspaceAdminSelectionData | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session?.token) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const apiDatasetKey = datasetKey === "reguler" ? "REGULER" : "ABT";
    workspaceAdminSelectionRequest(session.token, {
      datasetKey: apiDatasetKey,
      scope: "full",
      signal: controller.signal,
    })
      .then((payload) => {
        if (!controller.signal.aborted) setData(payload);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          if ((err as Error).name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Gagal memuat data seleksi.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [hydrated, session?.token, datasetKey]);

  const rows = useMemo<SeleksiRingkasanRow[]>(() => {
    if (!data) return [];
    const regulerRows = (data.regulerRows as unknown as BaseRegulerRow[]) ?? [];
    const abtRows = (data.abtRows as unknown as BaseAbtRow[]) ?? [];
    const interviewMap = new Map(
      (data.interviewResults as InterviewAssessmentRecord[]).map((r) => [
        normalizeText(r.schoolNpsn),
        r,
      ]),
    );
    const bimtekMap = new Map(
      (data.bimtekReviews as BimtekReviewRecord[]).map((r) => [
        normalizeText(r.schoolNpsn),
        r,
      ]),
    );
    const verifikasiMap = new Map(
      (data.verifikasiOnlineReviews as WorkspaceVerifikasiOnlineRecord[]).map((r) => [
        normalizeText(r.schoolNpsn),
        r,
      ]),
    );

    const sourceRows = datasetKey === "reguler" ? regulerRows : abtRows;
    return sourceRows.map((raw) => {
      const npsn = normalizeText(raw.npsn);
      const namaSekolah = normalizeText(raw.nama_sekolah);
      const provinsi = normalizeText(raw.provinsi);
      const kabKota = normalizeText(raw.kab_kota);

      // Administrasi (dari verifikasi online sisi ADMINISTRASI)
      const verif = verifikasiMap.get(npsn);
      let admStatus: SeleksiRingkasanRow["administrasi"]["status"] = "belum";
      let admLabel = "Belum Diperiksa";
      if (verif) {
        if (verif.approvedAdmin === true) {
          admStatus = "lolos";
          admLabel = "Lolos Verifikasi";
        } else if (verif.approvedAdmin === false) {
          admStatus = "tidak";
          admLabel = "Perlu Revisi";
        } else if (verif.reviewedAdminId) {
          admStatus = "diperiksa";
          admLabel = "Diperiksa Fasil Adm";
        }
      } else if (datasetKey === "reguler") {
        const regulerRaw = raw as BaseRegulerRow;
        if (normalizeText(regulerRaw.link_folder_drive) || normalizeText(regulerRaw.link_scan_pks)) {
          admStatus = "diperiksa";
          admLabel = "Dokumen Tersedia";
        }
      } else {
        const abtRaw = raw as BaseAbtRow;
        if (normalizeText(abtRaw.link_pks)) {
          admStatus = "diperiksa";
          admLabel = "PKS Tersedia";
        }
      }

      // Wawancara
      const interview = interviewMap.get(npsn);
      const wawNilai = interview ? interview.totalScore : null;
      let wawStatus: SeleksiRingkasanRow["wawancara"]["status"] = "belum";
      let wawLabel = "Belum Wawancara";
      if (interview) {
        if (wawNilai != null && wawNilai >= 70) {
          wawStatus = "lolos";
          wawLabel = `Lolos • ${wawNilai}`;
        } else if (wawNilai != null) {
          wawStatus = "tidak";
          wawLabel = `Tidak Lolos • ${wawNilai}`;
        }
      }

      // Kondisi Alat (dari Bimtek review survey status)
      const bimtek = bimtekMap.get(npsn);
      const driveLink =
        datasetKey === "reguler"
          ? normalizeText((raw as BaseRegulerRow).link_folder_drive) || null
          : null;
      const kondisiLink = driveLink ?? null;
      let kondisiStatus: SeleksiRingkasanRow["kondisiAlat"]["status"] = "belum";
      let kondisiLabel = "Belum Dinilai";
      if (bimtek?.statuses?.survey) {
        const s = bimtek.statuses.survey;
        if (s === "approved") {
          kondisiStatus = "lolos";
          kondisiLabel = "Lolos";
        } else if (s === "revisi") {
          kondisiStatus = "tidak";
          kondisiLabel = "Perlu Revisi";
        } else if (s === "pending") {
          kondisiStatus = "diperiksa";
          kondisiLabel = "Proses Penilaian";
        }
      }
      if (verif && !bimtek) {
        if (verif.approvedEquipment === true) {
          kondisiStatus = "lolos";
          kondisiLabel = "Lolos Verif Alat";
        } else if (verif.approvedEquipment === false) {
          kondisiStatus = "tidak";
          kondisiLabel = "Perlu Revisi Alat";
        } else if (verif.reviewedEquipmentId) {
          kondisiStatus = "diperiksa";
          kondisiLabel = "Diperiksa Fasil Alat";
        }
      }

      // Ajuan Alat (dari RPKP + RAB)
      const ajuanLink = driveLink ?? null;
      let ajuanStatus: SeleksiRingkasanRow["ajuanAlat"]["status"] = "belum";
      let ajuanLabel = "Belum Dinilai";
      if (bimtek?.statuses) {
        const rpkp = bimtek.statuses.rpkp;
        const rab = bimtek.statuses.rab;
        const allApproved = rpkp === "approved" && rab === "approved";
        const anyRevision = rpkp === "revisi" || rab === "revisi";
        const anyPending = rpkp === "pending" || rab === "pending";
        if (allApproved) {
          ajuanStatus = "lolos";
          ajuanLabel = "RPKP & RAB Disetujui";
        } else if (anyRevision) {
          ajuanStatus = "tidak";
          const parts: string[] = [];
          if (rpkp && rpkp !== "approved") parts.push(`RPKP:${rpkp}`);
          if (rab && rab !== "approved") parts.push(`RAB:${rab}`);
          ajuanLabel = parts.join(", ") || "Perlu Revisi";
        } else if (anyPending) {
          ajuanStatus = "diperiksa";
          ajuanLabel = "Proses Peninjauan";
        }
      }

      // PKS
      const pksLink =
        datasetKey === "reguler"
          ? normalizeText((raw as BaseRegulerRow).link_scan_pks) || null
          : normalizeText((raw as BaseAbtRow).link_pks) || null;
      const isPenerima =
        datasetKey === "reguler"
          ? Boolean(normalizeText((raw as BaseRegulerRow).link_folder_drive) || pksLink)
          : Boolean((raw as BaseAbtRow).status_penerima_abt) || Boolean(pksLink);
      let pksPengajuan: SeleksiRingkasanRow["pks"]["pengajuan"] = "belum";
      let pksTtd = Boolean(pksLink);
      let pksLabel = "Belum Ada";
      if (pksLink) {
        pksPengajuan = "selesai";
        pksLabel = "PKS Ditandatangani";
      } else if (isPenerima) {
        pksPengajuan = "proses";
        pksLabel = "Pengajuan Proses";
      }

      return {
        no: raw.no,
        npsn,
        namaSekolah,
        provinsi,
        kabKota,
        administrasi: { status: admStatus, label: admLabel },
        wawancara: { status: wawStatus, nilai: wawNilai, label: wawLabel },
        kondisiAlat: { status: kondisiStatus, link: kondisiLink, label: kondisiLabel },
        ajuanAlat: { status: ajuanStatus, link: ajuanLink, label: ajuanLabel },
        pks: {
          pengajuan: pksPengajuan,
          tandatanganPpk: pksTtd,
          link: pksLink,
          label: pksLabel,
        },
      };
    });
  }, [data, datasetKey]);

  const filteredRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.npsn.toLowerCase().includes(q) ||
        r.namaSekolah.toLowerCase().includes(q) ||
        r.provinsi.toLowerCase().includes(q) ||
        r.kabKota.toLowerCase().includes(q),
    );
  }, [rows, deferredQuery]);

  const pageSize = 25;
  const totalPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginated = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const heroLabel =
    datasetKey === "reguler" ? "Data Banper Reguler 2026" : "Data Banper ABT 2026";
  const heroTitle =
    datasetKey === "reguler"
      ? "Proses Seleksi Bantuan Reguler"
      : "Proses Seleksi Bantuan ABT";

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              {heroLabel}
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Ringkasan tahapan seleksi per sekolah. Lihat status Administrasi, Wawancara,
              Kondisi Alat, Ajuan Alat, dan PKS dalam satu tabel.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <span>
              Total: <b className="text-slate-900">{filteredRows.length}</b> sekolah
            </span>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="space-y-5 px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari NPSN, nama sekolah, provinsi, kab/kota..."
                className="inputBase pl-11"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <StageBadge status="lolos" label="Lolos" />
              </span>
              <span className="inline-flex items-center gap-1">
                <StageBadge status="diperiksa" label="Diperiksa" />
              </span>
              <span className="inline-flex items-center gap-1">
                <StageBadge status="tidak" label="Tidak Lolos" />
              </span>
              <span className="inline-flex items-center gap-1">
                <StageBadge status="belum" label="Belum" />
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Memuat data seleksi...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1280px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-14 border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      No
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      NPSN
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      Nama Sekolah
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      Administrasi
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      Wawancara
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      Kondisi Alat
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      Ajuan Alat
                    </th>
                    <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                      PKS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-slate-500"
                      >
                        Belum ada data sekolah.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, idx) => {
                      const zebra = (page - 1) * pageSize + idx;
                      return (
                        <tr
                          key={row.npsn}
                          className={
                            zebra % 2 === 0
                              ? "bg-white hover:bg-slate-50"
                              : "bg-slate-50/50 hover:bg-slate-50"
                          }
                        >
                          <td className="border-b border-slate-100 px-4 py-4 align-top text-slate-500">
                            {row.no}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top font-mono text-xs font-semibold text-slate-900">
                            {row.npsn}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="font-semibold text-slate-900">
                              {row.namaSekolah}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {row.kabKota}
                              {row.kabKota && row.provinsi ? " • " : ""}
                              {row.provinsi}
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <StageIcon status={row.administrasi.status} />
                              <StageBadge
                                status={row.administrasi.status}
                                label={row.administrasi.label}
                              />
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <StageIcon status={row.wawancara.status} />
                              <StageBadge
                                status={row.wawancara.status}
                                label={row.wawancara.label}
                              />
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <StageIcon status={row.kondisiAlat.status} />
                                <StageBadge
                                  status={row.kondisiAlat.status}
                                  label={row.kondisiAlat.label}
                                />
                              </div>
                              <LinkChip href={row.kondisiAlat.link} label="Data Alat" />
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <StageIcon status={row.ajuanAlat.status} />
                                <StageBadge
                                  status={row.ajuanAlat.status}
                                  label={row.ajuanAlat.label}
                                />
                              </div>
                              <LinkChip href={row.ajuanAlat.link} label="Ajuan" />
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {row.pks.tandatanganPpk ? (
                                  <FileSignature className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <StageIcon status="belum" />
                                )}
                                <StageBadge
                                  status={row.pks.pengajuan}
                                  label={row.pks.label}
                                />
                              </div>
                              <LinkChip href={row.pks.link} label="PKS" />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && totalPage > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-xs text-slate-500">
                Halaman {page} dari {totalPage}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inputBase inline-flex items-center gap-1 px-4 py-2 text-xs font-medium disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPage, p + 1))}
                  disabled={page >= totalPage}
                  className="inputBase inline-flex items-center gap-1 px-4 py-2 text-xs font-medium disabled:opacity-40"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
