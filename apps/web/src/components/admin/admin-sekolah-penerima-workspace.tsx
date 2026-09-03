"use client";

import { BookOpen, CheckCircle2, ClipboardList, FileCheck2, HardHat, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  workspaceAdminSelectionRequest,
  type WorkspaceBimtekReviewRecord,
  type WorkspaceInterviewAssessmentRecord,
  type WorkspaceSchoolProposalData,
} from "@/lib/api";
import {
  buildSchoolProposalBundleFromWorkspaceData,
  formatWorkspaceDateTime,
  interviewQuestionDefinitions,
  type BimtekReviewRecord,
  type InterviewAssessmentRecord,
  type SchoolProposalBundle,
} from "@/lib/facilitator-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface SekolahPenerimaRow {
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
  schoolId?: string | null;
}

type AdminSchoolRow = SekolahPenerimaRow & {
  interviewResult: InterviewAssessmentRecord | null;
  bimtekReview: BimtekReviewRecord | null;
  proposalBundle: SchoolProposalBundle | null;
};

type ActiveTabKey = "administrasi" | "wawancara" | "bimbingan-teknis";

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

function getDocumentStatus(row: SekolahPenerimaRow) {
  if (row.link_folder_drive && row.link_scan_pks) {
    return { label: "Lengkap", variant: "success" as const };
  }

  if (row.link_folder_drive || row.link_folder_sekolah || row.link_scan_pks) {
    return { label: "Parsial", variant: "warning" as const };
  }

  return { label: "Belum Lengkap", variant: "secondary" as const };
}

function getBimtekOverallStatus(review: BimtekReviewRecord | null) {
  if (!review) {
    return { label: "Belum Ada Hasil", variant: "secondary" as const };
  }

  const { survey, rpkp, rab } = review.statuses;
  if (survey === "approved" && rpkp === "approved" && rab === "approved") {
    return { label: "Selesai", variant: "success" as const };
  }

  if (survey === "revisi" || rpkp === "revisi" || rab === "revisi") {
    return { label: "Perlu Revisi", variant: "danger" as const };
  }

  return { label: "Proses Review", variant: "warning" as const };
}

function mapInterviewRecord(record: WorkspaceInterviewAssessmentRecord): InterviewAssessmentRecord {
  return record as unknown as InterviewAssessmentRecord;
}

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function AdminSekolahPenerimaWorkspace() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [rows, setRows] = useState<SekolahPenerimaRow[]>([]);
  const [interviewResults, setInterviewResults] = useState<InterviewAssessmentRecord[]>([]);
  const [bimtekReviews, setBimtekReviews] = useState<BimtekReviewRecord[]>([]);
  const [proposalBundles, setProposalBundles] = useState<Record<string, WorkspaceSchoolProposalData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTabKey>("administrasi");
  const [selectedRow, setSelectedRow] = useState<AdminSchoolRow | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
          setInterviewResults((payload.interviewResults ?? []).map(mapInterviewRecord));
          setBimtekReviews(payload.bimtekReviews as WorkspaceBimtekReviewRecord[]);
          setProposalBundles(payload.proposalBundles ?? {});
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat workspace sekolah penerima.");
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

  const interviewByNpsn = useMemo(
    () => new Map(interviewResults.map((item) => [item.schoolNpsn, item])),
    [interviewResults],
  );
  const bimtekByNpsn = useMemo(
    () => new Map(bimtekReviews.map((item) => [item.schoolNpsn, item])),
    [bimtekReviews],
  );

  const enrichedRows = useMemo<AdminSchoolRow[]>(
    () =>
      rows.map((row) => {
        const npsn = normalizeText(row.npsn);
        return {
          ...row,
          interviewResult: interviewByNpsn.get(npsn) ?? null,
          bimtekReview: bimtekByNpsn.get(npsn) ?? null,
          proposalBundle: buildSchoolProposalBundleFromWorkspaceData(
            row.schoolId ?? null,
            npsn ? proposalBundles[npsn] : undefined,
          ),
        };
      }),
    [bimtekByNpsn, interviewByNpsn, proposalBundles, rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return enrichedRows;
    }

    return enrichedRows.filter((row) =>
      [
        row.npsn,
        row.nama_sekolah,
        row.provinsi,
        row.kab_kota,
        row.fasilitator_administrasi ?? "",
        row.fasilitator_peralatan ?? "",
        ...(row.cakupan?.konsentrasi_keahlian ?? []),
        ...(row.cakupan?.kk_diusulkan ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [enrichedRows, query]);

  const administrasiSummary = useMemo(() => {
    const withDrive = filteredRows.filter((row) => Boolean(row.link_folder_drive)).length;
    const withScan = filteredRows.filter((row) => Boolean(row.link_scan_pks)).length;
    const withDoc = filteredRows.filter((row) => getDocumentStatus(row).label !== "Belum Lengkap").length;
    return { withDrive, withScan, withDoc };
  }, [filteredRows]);

  const wawancaraSummary = useMemo(() => {
    const completed = filteredRows.filter((row) => Boolean(row.interviewResult)).length;
    const totalScore = filteredRows.reduce((sum, row) => sum + (row.interviewResult?.totalScore ?? 0), 0);
    const averageScore = completed > 0 ? Math.round(totalScore / completed) : 0;
    const needFollowUp = filteredRows.filter((row) => {
      const recommendation = row.interviewResult?.recommendation ?? "";
      return !row.interviewResult || (recommendation !== "Siap" && recommendation !== "Sangat Siap");
    }).length;
    return { completed, averageScore, needFollowUp };
  }, [filteredRows]);

  const bimtekSummary = useMemo(() => {
    const completed = filteredRows.filter((row) => getBimtekOverallStatus(row.bimtekReview).label === "Selesai").length;
    const rabTotal = filteredRows.reduce((sum, row) => sum + (row.proposalBundle?.rabTotal ?? 0), 0);
    const withDocuments = filteredRows.filter((row) => (row.proposalBundle?.surveyItemCount ?? 0) > 0).length;
    return { completed, rabTotal, withDocuments };
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-3">
                <TabButton
                  active={activeTab === "administrasi"}
                  label="Administrasi"
                  onClick={() => setActiveTab("administrasi")}
                />
                <TabButton
                  active={activeTab === "wawancara"}
                  label="Wawancara"
                  onClick={() => setActiveTab("wawancara")}
                />
                <TabButton
                  active={activeTab === "bimbingan-teknis"}
                  label="Bimbingan Teknis"
                  onClick={() => setActiveTab("bimbingan-teknis")}
                />
              </div>
            </div>

            <label className="grid gap-2 text-sm text-slate-600 lg:w-[360px]">
              <span className="font-medium text-slate-900">Cari Sekolah</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari NPSN, nama sekolah, fasilitator, wilayah..."
                  className="pl-9"
                />
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data sekolah penerima dan hasil pendampingan...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">{error}</div>
      ) : activeTab === "administrasi" ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Sekolah" value={`${filteredRows.length}`} helper="Sekolah penerima bantuan" icon={<ClipboardList className="h-4 w-4" />} />
            <SummaryCard label="Folder Drive" value={`${administrasiSummary.withDrive}`} helper="Sekolah dengan folder dokumen" icon={<FileCheck2 className="h-4 w-4" />} />
            <SummaryCard label="Scan PKS" value={`${administrasiSummary.withScan}`} helper="Sekolah dengan scan PKS" icon={<CheckCircle2 className="h-4 w-4" />} />
            <SummaryCard label="Dokumen Tersedia" value={`${administrasiSummary.withDoc}`} helper="Minimal ada dokumen administrasi" icon={<BookOpen className="h-4 w-4" />} />
          </section>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[1220px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="px-4 py-3">Wilayah</th>
                    <th className="px-4 py-3">Fasilitator</th>
                    <th className="px-4 py-3">Data Sekolah</th>
                    <th className="px-4 py-3">Dok. Administrasi</th>
                    <th className="px-4 py-3">PKS</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        Data sekolah tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const docStatus = getDocumentStatus(row);
                      return (
                        <tr key={`administrasi-${row.npsn}`}>
                          <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                          <td className="px-4 py-4 text-slate-700">{row.nama_sekolah}</td>
                          <td className="px-4 py-4 text-slate-700">
                            {row.kab_kota}
                            <br />
                            <span className="text-xs text-slate-500">{row.provinsi}</span>
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            <div>{displayText(row.fasilitator_administrasi)}</div>
                            <div className="text-xs text-slate-500">{displayText(row.fasilitator_peralatan)}</div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="success">Tersedia</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={docStatus.variant}>{docStatus.label}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={row.link_scan_pks ? "success" : "secondary"}>
                              {row.link_scan_pks ? "Ada Scan" : "Belum Ada"}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Button type="button" size="sm" onClick={() => setSelectedRow(row)}>
                              Detail
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === "wawancara" ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Sekolah" value={`${filteredRows.length}`} helper="Sekolah pada modul wawancara" icon={<BookOpen className="h-4 w-4" />} />
            <SummaryCard label="Sudah Dinilai" value={`${wawancaraSummary.completed}`} helper="Sudah ada hasil wawancara" icon={<CheckCircle2 className="h-4 w-4" />} />
            <SummaryCard label="Rata-rata Skor" value={wawancaraSummary.completed ? `${wawancaraSummary.averageScore}` : "-"} helper="Rata-rata penilaian wawancara" icon={<ClipboardList className="h-4 w-4" />} />
            <SummaryCard label="Butuh Follow Up" value={`${wawancaraSummary.needFollowUp}`} helper="Belum ada hasil atau belum siap" icon={<FileCheck2 className="h-4 w-4" />} />
          </section>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[1260px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="px-4 py-3">Fasilitator Adm</th>
                    <th className="px-4 py-3">Fasilitator Alat</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Skor</th>
                    <th className="px-4 py-3">Rekomendasi</th>
                    <th className="px-4 py-3">Update</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                        Data hasil wawancara tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={`wawancara-${row.npsn}`}>
                        <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                        <td className="px-4 py-4 text-slate-700">{row.nama_sekolah}</td>
                        <td className="px-4 py-4 text-slate-700">{displayText(row.fasilitator_administrasi)}</td>
                        <td className="px-4 py-4 text-slate-700">{displayText(row.fasilitator_peralatan)}</td>
                        <td className="px-4 py-4">
                          <Badge variant={row.interviewResult ? "success" : "secondary"}>
                            {row.interviewResult ? "Sudah Dinilai" : "Belum Ada Hasil"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{row.interviewResult?.totalScore ?? "-"}</td>
                        <td className="px-4 py-4">
                          {row.interviewResult ? (
                            <Badge variant={row.interviewResult.totalScore >= 70 ? "success" : "warning"}>
                              {row.interviewResult.recommendation}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {row.interviewResult ? formatWorkspaceDateTime(row.interviewResult.updatedAt) : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <Button type="button" size="sm" onClick={() => setSelectedRow(row)}>
                            Detail Hasil
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Sekolah" value={`${filteredRows.length}`} helper="Sekolah pada bimtek" icon={<HardHat className="h-4 w-4" />} />
            <SummaryCard label="Dokumen Masuk" value={`${bimtekSummary.withDocuments}`} helper="Sekolah dengan data Survey Harga" icon={<ClipboardList className="h-4 w-4" />} />
            <SummaryCard label="Selesai Review" value={`${bimtekSummary.completed}`} helper="Survey, RPKP, dan RAB approved" icon={<CheckCircle2 className="h-4 w-4" />} />
            <SummaryCard label="Total RAB" value={currency.format(bimtekSummary.rabTotal)} helper="Akumulasi RAB sekolah yang tampil" icon={<FileCheck2 className="h-4 w-4" />} />
          </section>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[1320px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3">NPSN</th>
                    <th className="px-4 py-3">Nama Sekolah</th>
                    <th className="px-4 py-3">Survey Harga</th>
                    <th className="px-4 py-3">RPKP</th>
                    <th className="px-4 py-3">RAB</th>
                    <th className="px-4 py-3">Status Overall</th>
                    <th className="px-4 py-3">Nilai RAB</th>
                    <th className="px-4 py-3">Update</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                        Data hasil bimbingan teknis tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const overall = getBimtekOverallStatus(row.bimtekReview);
                      return (
                        <tr key={`bimtek-${row.npsn}`}>
                          <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                          <td className="px-4 py-4 text-slate-700">{row.nama_sekolah}</td>
                          <td className="px-4 py-4">
                            <DocBadge count={row.proposalBundle?.surveyItemCount ?? 0} status={row.bimtekReview?.statuses.survey} />
                          </td>
                          <td className="px-4 py-4">
                            <DocBadge count={row.proposalBundle?.rpkpItemCount ?? 0} status={row.bimtekReview?.statuses.rpkp} />
                          </td>
                          <td className="px-4 py-4">
                            <DocBadge count={row.proposalBundle?.rabItemCount ?? 0} status={row.bimtekReview?.statuses.rab} />
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={overall.variant}>{overall.label}</Badge>
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {row.proposalBundle ? currency.format(row.proposalBundle.rabTotal) : "-"}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {row.bimtekReview ? formatWorkspaceDateTime(row.bimtekReview.updatedAt) : "-"}
                          </td>
                          <td className="px-4 py-4">
                            <Button type="button" size="sm" onClick={() => setSelectedRow(row)}>
                              Detail Bimtek
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">
                  {activeTab === "administrasi"
                    ? "Administrasi"
                    : activeTab === "wawancara"
                      ? "Hasil Wawancara"
                      : "Hasil Bimbingan Teknis"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{selectedRow.nama_sekolah}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  NPSN {selectedRow.npsn} • {selectedRow.kab_kota}, {selectedRow.provinsi}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRow(null)}>
                Tutup
              </Button>
            </div>

            <div className="space-y-4 px-6 py-6">
              {activeTab === "administrasi" ? (
                <>
                  <Card className="rounded-[20px]">
                    <CardContent className="space-y-2 px-5 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Sekolah</p>
                      <div className="space-y-1 text-slate-600">
                        <p>Nama Sekolah: {selectedRow.nama_sekolah}</p>
                        <p>NPSN: {selectedRow.npsn}</p>
                        <p>Provinsi: {selectedRow.provinsi}</p>
                        <p>Kab/Kota: {selectedRow.kab_kota}</p>
                        <p>KK Diusulkan: {(selectedRow.cakupan?.kk_diusulkan ?? []).join(", ") || "-"}</p>
                        <p>Nilai Pagu: {currency.format(selectedRow.nilai_pagu ?? 0)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[20px]">
                    <CardContent className="space-y-2 px-5 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dokumen Administrasi</p>
                      <div className="space-y-1 text-slate-600">
                        <p>Folder Sekolah: {displayText(selectedRow.link_folder_sekolah)}</p>
                        <p>Status PKS: {displayText(selectedRow.status_pks)}</p>
                        <p>Lanjut / Batal: {displayText(selectedRow.lanjut_batal)}</p>
                        <p>Akreditasi: Belum terhubung ke sumber data</p>
                        <p>Dokumen Administrasi Lain: Belum terhubung ke sumber data</p>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-2">
                        {selectedRow.link_folder_drive ? (
                          <a href={selectedRow.link_folder_drive} target="_blank" rel="noreferrer">
                            <Button type="button" size="sm">Buka Folder Drive</Button>
                          </a>
                        ) : null}
                        {selectedRow.link_scan_pks ? (
                          <a href={selectedRow.link_scan_pks} target="_blank" rel="noreferrer">
                            <Button type="button" size="sm" variant="outline">Buka Scan PKS</Button>
                          </a>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : activeTab === "wawancara" ? (
                selectedRow.interviewResult ? (
                  <>
                    <section className="grid gap-4 md:grid-cols-3">
                      <SummaryCard label="Skor" value={`${selectedRow.interviewResult.totalScore}`} helper="Skor otomatis hasil wawancara" icon={<ClipboardList className="h-4 w-4" />} />
                      <SummaryCard label="Rekomendasi" value={selectedRow.interviewResult.recommendation} helper="Status kesiapan sekolah" icon={<CheckCircle2 className="h-4 w-4" />} />
                      <SummaryCard label="Update" value={formatWorkspaceDateTime(selectedRow.interviewResult.updatedAt)} helper="Waktu input terakhir" icon={<BookOpen className="h-4 w-4" />} />
                    </section>

                    <Card className="rounded-[20px]">
                      <CardContent className="space-y-3 px-5 py-4 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Detail Penilaian</p>
                        <div className="space-y-3">
                          {interviewQuestionDefinitions.map((question, index) => {
                            const rawAnswer = (selectedRow.interviewResult?.answers?.[question.key] ??
                              null) as unknown;
                            const score =
                              typeof rawAnswer === "number"
                                ? rawAnswer
                                : typeof rawAnswer === "object" && rawAnswer !== null && "score" in rawAnswer
                                  ? (rawAnswer as { score: number | string }).score
                                  : null;
                            const comment =
                              typeof rawAnswer === "object" && rawAnswer !== null && "comment" in rawAnswer
                                ? String((rawAnswer as { comment: unknown }).comment ?? "")
                                : "";
                            return (
                              <div key={question.key} className="rounded-xl border border-slate-200 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Poin {index + 1}
                                </p>
                                <p className="mt-1 font-semibold text-slate-950">{question.label}</p>
                                <p className="mt-1 text-slate-600">
                                  Nilai: {score ?? "-"}
                                </p>
                                {comment.trim() ? (
                                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                                    Catatan: {comment}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[20px]">
                      <CardContent className="space-y-2 px-5 py-4 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Catatan</p>
                        <p className="text-slate-700">{selectedRow.interviewResult.note || "Tidak ada catatan tambahan."}</p>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="rounded-[20px]">
                    <CardContent className="px-5 py-6 text-sm text-slate-600">
                      Belum ada hasil penilaian wawancara yang tersimpan untuk sekolah ini.
                    </CardContent>
                  </Card>
                )
              ) : (
                <>
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Survey Harga" value={`${selectedRow.proposalBundle?.surveyItemCount ?? 0}`} helper="Total item survey harga" icon={<ClipboardList className="h-4 w-4" />} />
                    <SummaryCard label="RPKP" value={`${selectedRow.proposalBundle?.rpkpItemCount ?? 0}`} helper="Total item RPKP" icon={<BookOpen className="h-4 w-4" />} />
                    <SummaryCard label="RAB" value={`${selectedRow.proposalBundle?.rabItemCount ?? 0}`} helper="Total item RAB" icon={<HardHat className="h-4 w-4" />} />
                    <SummaryCard label="Nilai RAB" value={currency.format(selectedRow.proposalBundle?.rabTotal ?? 0)} helper="Akumulasi total RAB" icon={<CheckCircle2 className="h-4 w-4" />} />
                  </section>

                  <Card className="rounded-[20px]">
                    <CardContent className="space-y-3 px-5 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status Review Dokumen</p>
                      {selectedRow.bimtekReview ? (
                        <div className="space-y-3">
                          <ReviewDocRow label="Survey Harga Pasar" status={selectedRow.bimtekReview.statuses.survey} note={selectedRow.bimtekReview.notes.survey} />
                          <ReviewDocRow label="RPKP" status={selectedRow.bimtekReview.statuses.rpkp} note={selectedRow.bimtekReview.notes.rpkp} />
                          <ReviewDocRow label="RAB" status={selectedRow.bimtekReview.statuses.rab} note={selectedRow.bimtekReview.notes.rab} />
                        </div>
                      ) : (
                        <p className="text-slate-600">Belum ada hasil review bimbingan teknis yang tersimpan untuk sekolah ini.</p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DocBadge({
  count,
  status,
}: {
  count: number;
  status: BimtekReviewRecord["statuses"][keyof BimtekReviewRecord["statuses"]] | undefined;
}) {
  if (count === 0) {
    return <Badge variant="secondary">Belum Ada</Badge>;
  }

  if (status === "approved") {
    return <Badge variant="success">{count} item</Badge>;
  }

  if (status === "revisi") {
    return <Badge variant="danger">{count} item</Badge>;
  }

  return <Badge variant="warning">{count} item</Badge>;
}

function ReviewDocRow({
  label,
  status,
  note,
}: {
  label: string;
  status: "pending" | "revisi" | "approved";
  note: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-slate-950">{label}</p>
        <Badge variant={status === "approved" ? "success" : status === "revisi" ? "danger" : "warning"}>
          {status === "approved" ? "Approved" : status === "revisi" ? "Perlu Revisi" : "Menunggu"}
        </Badge>
      </div>
      <p className="mt-2 text-slate-600">{note || "Belum ada catatan review."}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-[24px]">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-primary">{icon}</div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}
