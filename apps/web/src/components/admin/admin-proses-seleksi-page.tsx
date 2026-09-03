 "use client";

import { ClipboardCheck, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import { useEffect, useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildSchoolProposalBundleFromWorkspaceData,
  interviewQuestionDefinitions,
  type BimtekReviewRecord,
  type InterviewAssessmentRecord,
} from "@/lib/facilitator-workspace";
import { type WorkspaceSchoolProposalData, workspaceAdminSelectionRequest } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type SeleksiStageKey = "mendaftar" | "administrasi" | "wawancara" | "bimtek" | "penerima";
type DatasetKey = "reguler" | "abt";

type RegulerRow = {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
  catatan?: string | null;
  fasilitator_peralatan?: string;
  link_folder_drive?: string | null;
  link_scan_pks?: string | null;
  status_pks?: string;
  schoolId?: string | null;
};

type AbtRow = {
  no: number;
  npsn: string;
  nama_sekolah: string;
  provinsi: string;
  kab_kota: string;
  link_pks?: string | null;
  status_penerima_abt?: boolean;
  profil_sekolah?: {
    kecamatan?: string;
    akreditasi?: string;
    alamat_jalan?: string;
    email?: string;
    nomor_telepon?: string | number;
  };
};

type PembagianFasilitatorSekolahPenerima = {
  data: Array<{
    fasilitator_peralatan: string;
    sekolah: Array<{
      npsn: string;
      link_folder_drive?: string | null;
      link_scan_pks?: string | null;
    }>;
  }>;
};

type RowWithRegion = {
  no: number;
  npsn: string;
  namaSekolah: string;
  provinsi: string;
  kota: string;
  kab: string;
  kec: string;
  catatan: string;
};

type RowWithStage = RowWithRegion & {
  statusLolos: boolean;
  keterangan: string;
};

type StatusFilterValue = "all" | "passed" | "failed";
type WawancaraViewKey = "lolos" | "hasil" | "proses";
type InterviewRecommendationBand = "Sangat Rekomendasi" | "Rekomendasi" | "Tidak Rekomendasi";

type InterviewStageRow = RowWithRegion & {
  interviewResult: InterviewAssessmentRecord;
  rank: number;
  recommendationBand: InterviewRecommendationBand;
  facilitatorEquipmentName: string;
  statusLolos: boolean;
  keterangan: string;
};

const stageTabs: Array<{ key: SeleksiStageKey; label: string }> = [
  { key: "mendaftar", label: "Sekolah Terdaftar" },
  { key: "administrasi", label: "Lolos Administrasi" },
  { key: "wawancara", label: "Lolos Wawancara" },
  { key: "bimtek", label: "Lolos Bimtek" },
];

const wawancaraTabs: Array<{ key: WawancaraViewKey; label: string }> = [
  { key: "lolos", label: "Sekolah Lolos Wawancara" },
  { key: "hasil", label: "Hasil Wawancara" },
  { key: "proses", label: "Proses Wawancara" },
];

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function splitKabKota(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kota: "", kab: "" };
  }

  if (/^kota/i.test(trimmed)) {
    return { kota: trimmed, kab: "" };
  }

  if (/^kab/i.test(trimmed)) {
    return { kota: "", kab: trimmed };
  }

  return { kota: "", kab: trimmed };
}

function isInterviewPassed(result: InterviewAssessmentRecord | undefined) {
  if (!result) {
    return false;
  }

  return result.totalScore >= 70;
}

function isBimtekPassed(review: BimtekReviewRecord | undefined) {
  if (!review) {
    return false;
  }

  return (
    review.statuses.survey === "approved" &&
    review.statuses.rpkp === "approved" &&
    review.statuses.rab === "approved"
  );
}

function getStageStatusForRow(params: {
  stage: SeleksiStageKey;
  dataset: DatasetKey;
  npsn: string;
  regulerByNpsn: Map<string, RegulerRow>;
  abtByNpsn: Map<string, AbtRow>;
  interviewByNpsn: Map<string, InterviewAssessmentRecord>;
  bimtekByNpsn: Map<string, BimtekReviewRecord>;
}): { statusLolos: boolean; keterangan: string } {
  const { stage, dataset, npsn, regulerByNpsn, abtByNpsn, interviewByNpsn, bimtekByNpsn } = params;

  if (stage === "mendaftar") {
    return { statusLolos: true, keterangan: "-" };
  }

  if (stage === "administrasi") {
    if (dataset === "abt") {
      const row = abtByNpsn.get(npsn);
      const ok = Boolean(normalizeText(row?.link_pks));
      return { statusLolos: ok, keterangan: ok ? "PKS tersedia" : "PKS belum tersedia" };
    }

    const row = regulerByNpsn.get(npsn);
    const hasDrive = Boolean(normalizeText(row?.link_folder_drive));
    const hasScan = Boolean(normalizeText(row?.link_scan_pks));
    const ok = hasDrive || hasScan;
    return { statusLolos: ok, keterangan: ok ? "Dokumen tersedia" : "Belum ada dokumen (Drive/Scan PKS)" };
  }

  if (stage === "wawancara") {
    const result = interviewByNpsn.get(npsn);
    if (!result) {
      return { statusLolos: false, keterangan: "Belum dinilai" };
    }

    const ok = isInterviewPassed(result);
    return { statusLolos: ok, keterangan: ok ? `Skor ${result.totalScore}` : `Skor ${result.totalScore} (< 70)` };
  }

  if (stage === "bimtek") {
    const review = bimtekByNpsn.get(npsn);
    if (!review) {
      return { statusLolos: false, keterangan: "Belum direview" };
    }

    const ok = isBimtekPassed(review);
    if (ok) {
      return { statusLolos: true, keterangan: "Survey, RPKP, RAB approved" };
    }

    const pending = Object.entries(review.statuses)
      .filter(([, status]) => status !== "approved")
      .map(([key, status]) => `${key.toUpperCase()}: ${status}`)
      .join(", ");
    return { statusLolos: false, keterangan: pending || "Belum lengkap" };
  }

  if (dataset === "abt") {
    const row = abtByNpsn.get(npsn);
    const ok = Boolean(row?.status_penerima_abt);
    return { statusLolos: ok, keterangan: ok ? "Penerima ABT" : "Bukan penerima ABT" };
  }

  const row = regulerByNpsn.get(npsn);
  const ok = Boolean(normalizeText(row?.fasilitator_peralatan));
  return { statusLolos: ok, keterangan: ok ? "Sudah ditetapkan fasilitator" : "Belum ditetapkan fasilitator" };
}

function StatusBadge({ statusLolos }: { statusLolos: boolean }) {
  return <Badge variant={statusLolos ? "success" : "danger"}>{statusLolos ? "Lolos" : "Tidak Lolos"}</Badge>;
}

function RecommendationBadge({ band }: { band: InterviewRecommendationBand }) {
  if (band === "Sangat Rekomendasi") {
    return <Badge variant="success">{band}</Badge>;
  }

  if (band === "Rekomendasi") {
    return <Badge variant="outline">{band}</Badge>;
  }

  return <Badge variant="danger">{band}</Badge>;
}

function getAvailabilityBadge(isAvailable: boolean, availableLabel = "Tersedia") {
  return {
    label: isAvailable ? availableLabel : "Belum Ada",
    variant: isAvailable ? ("success" as const) : ("secondary" as const),
  };
}

function getRpdBadge(params: {
  rpkpItemCount: number;
  review?: BimtekReviewRecord;
}) {
  const { rpkpItemCount, review } = params;
  const status = review?.statuses.rpkp;

  if (rpkpItemCount > 0) {
    if (status === "approved") {
      return { label: `${rpkpItemCount} item • Approved`, variant: "success" as const };
    }

    if (status === "revisi") {
      return { label: `${rpkpItemCount} item • Revisi`, variant: "warning" as const };
    }

    if (status === "pending") {
      return { label: `${rpkpItemCount} item • Proses`, variant: "warning" as const };
    }

    return { label: `${rpkpItemCount} item`, variant: "success" as const };
  }

  if (status === "approved") {
    return { label: "Approved", variant: "success" as const };
  }

  if (status === "revisi") {
    return { label: "Perlu Revisi", variant: "warning" as const };
  }

  if (status === "pending") {
    return { label: "Proses", variant: "warning" as const };
  }

  return { label: "Belum Ada", variant: "secondary" as const };
}

function buildRegionRows(params: {
  dataset: DatasetKey;
  regulerRows: RegulerRow[];
  abtRows: AbtRow[];
}): RowWithRegion[] {
  const { dataset, regulerRows, abtRows } = params;

  if (dataset === "abt") {
    return abtRows.map((row) => {
      const { kota, kab } = splitKabKota(normalizeText(row.kab_kota));
      const kec = normalizeText(row.profil_sekolah?.kecamatan) || "-";
      const akreditasi = normalizeText(row.profil_sekolah?.akreditasi);
      const catatan = akreditasi ? `Akreditasi ${akreditasi}` : "-";

      return {
        no: row.no,
        npsn: normalizeText(row.npsn),
        namaSekolah: normalizeText(row.nama_sekolah),
        provinsi: normalizeText(row.provinsi),
        kota,
        kab,
        kec,
        catatan,
      };
    });
  }

  return regulerRows.map((row) => {
    const { kota, kab } = splitKabKota(normalizeText(row.kab_kota));
    return {
      no: row.no,
      npsn: normalizeText(row.npsn),
      namaSekolah: normalizeText(row.nama_sekolah),
      provinsi: normalizeText(row.provinsi),
      kota,
      kab,
      kec: "-",
      catatan: normalizeText(row.catatan) || "-",
    };
  });
}

function getInterviewRecommendationBand(rank: number, total: number): InterviewRecommendationBand {
  const firstBucketLimit = Math.ceil(total / 3);
  const secondBucketLimit = Math.ceil((total * 2) / 3);

  if (rank <= firstBucketLimit) {
    return "Sangat Rekomendasi";
  }

  if (rank <= secondBucketLimit) {
    return "Rekomendasi";
  }

  return "Tidak Rekomendasi";
}

export function AdminProsesSeleksiPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [activeDataset, setActiveDataset] = useState<DatasetKey>("reguler");
  const [activeStage, setActiveStage] = useState<SeleksiStageKey>("mendaftar");
  const [activeWawancaraTab, setActiveWawancaraTab] = useState<WawancaraViewKey>("lolos");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regulerRows, setRegulerRows] = useState<RegulerRow[]>([]);
  const [abtRows, setAbtRows] = useState<AbtRow[]>([]);
  const [interviewResults, setInterviewResults] = useState<InterviewAssessmentRecord[]>([]);
  const [bimtekReviews, setBimtekReviews] = useState<BimtekReviewRecord[]>([]);
  const [proposalBundles, setProposalBundles] = useState<Record<string, WorkspaceSchoolProposalData>>({});
  const [dataSekolahModal, setDataSekolahModal] = useState<RowWithRegion | null>(null);

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
        const datasetParam = activeDataset === "abt" ? "ABT" : activeDataset === "reguler" ? "REGULER" : "ALL";
        const payload = await workspaceAdminSelectionRequest(token, {
          datasetKey: datasetParam,
          scope: "full",
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setRegulerRows((Array.isArray(payload.regulerRows) ? payload.regulerRows : []) as RegulerRow[]);
          setAbtRows((Array.isArray(payload.abtRows) ? payload.abtRows : []) as AbtRow[]);
          setInterviewResults(payload.interviewResults as InterviewAssessmentRecord[]);
          setBimtekReviews(payload.bimtekReviews as BimtekReviewRecord[]);
          setProposalBundles(payload.proposalBundles ?? {});
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          if ((loadError as Error).name === "AbortError") return;
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data proses seleksi.");
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
  }, [hydrated, session?.token, activeDataset]);

  const regulerByNpsn = useMemo(() => new Map(regulerRows.map((row) => [normalizeText(row.npsn), row])), [regulerRows]);
  const abtByNpsn = useMemo(() => new Map(abtRows.map((row) => [normalizeText(row.npsn), row])), [abtRows]);
  const interviewByNpsn = useMemo(
    () => new Map(interviewResults.map((item) => [normalizeText(item.schoolNpsn), item])),
    [interviewResults],
  );
  const bimtekByNpsn = useMemo(
    () => new Map(bimtekReviews.map((item) => [normalizeText(item.schoolNpsn), item])),
    [bimtekReviews],
  );
  const selectedRegulerRow = useMemo(
    () => (dataSekolahModal ? regulerByNpsn.get(dataSekolahModal.npsn) ?? null : null),
    [dataSekolahModal, regulerByNpsn],
  );
  const selectedAbtRow = useMemo(
    () => (dataSekolahModal ? abtByNpsn.get(dataSekolahModal.npsn) ?? null : null),
    [abtByNpsn, dataSekolahModal],
  );
  const selectedBimtekReview = useMemo(
    () => (dataSekolahModal ? bimtekByNpsn.get(dataSekolahModal.npsn) ?? undefined : undefined),
    [bimtekByNpsn, dataSekolahModal],
  );
  const selectedProposalBundle = useMemo(() => {
    if (!selectedRegulerRow?.schoolId) {
      return null;
    }
    const npsn = normalizeText(selectedRegulerRow.npsn);
    return buildSchoolProposalBundleFromWorkspaceData(
      selectedRegulerRow.schoolId,
      npsn ? proposalBundles[npsn] : undefined,
    );
  }, [proposalBundles, selectedRegulerRow]);

  const baseRows = useMemo(
    () => buildRegionRows({ dataset: activeDataset, regulerRows, abtRows }),
    [abtRows, activeDataset, regulerRows],
  );

  const interviewStageRows = useMemo<InterviewStageRow[]>(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const rowsWithResults = baseRows
      .map((row) => {
        const interviewResult = interviewByNpsn.get(row.npsn);
        if (!interviewResult) {
          return null;
        }

        return {
          ...row,
          interviewResult,
          facilitatorEquipmentName: interviewResult.facilitatorEquipmentName,
        };
      })
      .filter((row): row is RowWithRegion & { interviewResult: InterviewAssessmentRecord; facilitatorEquipmentName: string } => Boolean(row))
      .filter((row) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          row.npsn,
          row.namaSekolah,
          row.provinsi,
          row.kota,
          row.kab,
          row.kec,
          row.catatan,
          row.facilitatorEquipmentName,
          row.interviewResult.totalScore,
          row.interviewResult.recommendation,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (b.interviewResult.totalScore !== a.interviewResult.totalScore) {
          return b.interviewResult.totalScore - a.interviewResult.totalScore;
        }

        const dateDiff =
          new Date(b.interviewResult.updatedAt).getTime() - new Date(a.interviewResult.updatedAt).getTime();
        if (dateDiff !== 0) {
          return dateDiff;
        }

        return a.namaSekolah.localeCompare(b.namaSekolah, "id-ID");
      });

    const rankedRows = rowsWithResults.map((row, index) => ({
      ...row,
      rank: index + 1,
      recommendationBand: getInterviewRecommendationBand(index + 1, rowsWithResults.length),
    }));

    const selectedPassedNpsns = new Set(
      rankedRows
        .filter((row) => row.recommendationBand !== "Tidak Rekomendasi")
        .slice(0, 85)
        .map((row) => row.npsn),
    );

    return rankedRows.map((row) => ({
      ...row,
      statusLolos: selectedPassedNpsns.has(row.npsn),
      keterangan: `${row.recommendationBand} • Nilai ${row.interviewResult.totalScore} • Peringkat ${row.rank}`,
    }));
  }, [baseRows, interviewByNpsn, deferredQuery]);

  const rowsByStage = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const build = (stage: SeleksiStageKey) => {
      if (stage === "wawancara") {
        return interviewStageRows;
      }

      const withStage = baseRows.map<RowWithStage>((row) => ({
        ...row,
        ...getStageStatusForRow({
          stage,
          dataset: activeDataset,
          npsn: row.npsn,
          regulerByNpsn,
          abtByNpsn,
          interviewByNpsn,
          bimtekByNpsn,
        }),
      }));

      const filtered = normalizedQuery
        ? withStage.filter((row) =>
            [
              row.npsn,
              row.namaSekolah,
              row.provinsi,
              row.kota,
              row.kab,
              row.kec,
              row.catatan,
              row.keterangan,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery),
          )
        : withStage;

      return filtered.sort((a, b) => Number(b.statusLolos) - Number(a.statusLolos) || a.no - b.no);
    };

    return Object.fromEntries(stageTabs.map((tab) => [tab.key, build(tab.key)])) as Record<SeleksiStageKey, RowWithStage[]>;
  }, [abtByNpsn, activeDataset, baseRows, bimtekByNpsn, interviewByNpsn, interviewStageRows, deferredQuery, regulerByNpsn]);

  const stageCounts = useMemo(
    () =>
      Object.fromEntries(
        stageTabs.map((tab) => [tab.key, rowsByStage[tab.key].filter((row) => row.statusLolos).length]),
      ) as Record<SeleksiStageKey, number>,
    [rowsByStage],
  );

  useEffect(() => {
    setPage(1);
  }, [activeDataset, activeStage, activeWawancaraTab, deferredQuery, regionFilter, statusFilter]);

  const stageRows = rowsByStage[activeStage] ?? [];
  const regionOptions = useMemo(() => {
    return Array.from(
      new Set(
        stageRows
          .map((row) => row.kab || row.kota || row.provinsi)
          .filter((value): value is string => Boolean(value && value.trim())),
      ),
    ).sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [stageRows]);

  const filteredStageRows = useMemo(() => {
    return stageRows.filter((row) => {
      if (activeStage !== "wawancara") {
        if (statusFilter === "passed" && !row.statusLolos) {
          return false;
        }

        if (statusFilter === "failed" && row.statusLolos) {
          return false;
        }
      }

      if (regionFilter !== "all") {
        const rowRegion = row.kab || row.kota || row.provinsi || "";
        if (rowRegion !== regionFilter) {
          return false;
        }
      }

      return true;
    });
  }, [activeStage, regionFilter, stageRows, statusFilter]);

  const displayedRows = useMemo(() => {
    if (activeStage !== "wawancara") {
      return filteredStageRows;
    }

    const wawancaraRows = filteredStageRows as InterviewStageRow[];
    if (activeWawancaraTab === "lolos") {
      return wawancaraRows.filter((row) => row.statusLolos);
    }

    return wawancaraRows;
  }, [activeStage, activeWawancaraTab, filteredStageRows]);

  const wawancaraTabCounts = useMemo(() => {
    const wawancaraRows = filteredStageRows as InterviewStageRow[];
    return {
      lolos: wawancaraRows.filter((row) => row.statusLolos).length,
      hasil: wawancaraRows.length,
      proses: wawancaraRows.length,
    } satisfies Record<WawancaraViewKey, number>;
  }, [filteredStageRows]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(displayedRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = displayedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const exportRows = useMemo<Array<Record<string, string | number>>>(() => {
    if (activeStage === "wawancara") {
      const rows = displayedRows as InterviewStageRow[];

      if (activeWawancaraTab === "proses") {
        return rows.map((row, index) => {
          const questionColumns = Object.fromEntries(
            interviewQuestionDefinitions.map((question) => [question.label, row.interviewResult.answers[question.key]]),
          );

          return {
            No: index + 1,
            NPSN: row.npsn,
            "Nama Sekolah": row.namaSekolah,
            ...questionColumns,
            Nilai: row.interviewResult.totalScore,
            Kategori: row.recommendationBand,
            Fasilitator: row.facilitatorEquipmentName || "-",
          };
        });
      }

      return rows.map((row, index) => ({
        No: index + 1,
        NPSN: row.npsn,
        "Nama Sekolah": row.namaSekolah,
        Nilai: row.interviewResult.totalScore,
        Peringkat: row.rank,
        Kategori: row.recommendationBand,
        Status: row.statusLolos ? "Lolos" : "Tidak Lolos",
        Fasilitator: row.facilitatorEquipmentName || "-",
        Keterangan: row.keterangan || "-",
      }));
    }

    return displayedRows.map((row, index) => ({
      No: index + 1,
      NPSN: row.npsn,
      "Nama Sekolah": row.namaSekolah,
      Status: row.statusLolos ? "Lolos" : "Tidak Lolos",
      Keterangan: row.keterangan || "-",
      Provinsi: row.provinsi || "-",
      Kabupaten: row.kab || "-",
      Kota: row.kota || "-",
      Kecamatan: row.kec || "-",
      Catatan: row.catatan || "-",
    }));
  }, [activeStage, activeWawancaraTab, displayedRows]);

  async function exportToXlsx() {
    try {
      setIsExportingXlsx(true);
      const xlsx = await import("xlsx");
      const worksheet = xlsx.utils.json_to_sheet(exportRows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Proses Seleksi");
      const fileName =
        activeStage === "wawancara"
          ? `proses-seleksi-${activeDataset}-${activeStage}-${activeWawancaraTab}.xlsx`
          : `proses-seleksi-${activeDataset}-${activeStage}.xlsx`;
      xlsx.writeFile(workbook, fileName);
    } finally {
      setIsExportingXlsx(false);
    }
  }

  async function exportToPdf() {
    try {
      setIsExportingPdf(true);
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text("Proses Seleksi", 40, 36);
      doc.setFontSize(10);
      doc.text(
        `${activeDataset === "abt" ? "Anggaran Bantuan Tambahan (ABT)" : "Anggaran Reguler"} - ${
          stageTabs.find((tab) => tab.key === activeStage)?.label ?? activeStage
        }${activeStage === "wawancara" ? ` - ${wawancaraTabs.find((tab) => tab.key === activeWawancaraTab)?.label ?? activeWawancaraTab}` : ""}`,
        40,
        54,
      );

      const headers = Object.keys(exportRows[0] ?? {});

      autoTable(doc, {
        startY: 68,
        head: [headers],
        body: exportRows.map((row) => headers.map((header) => String(row[header] ?? "-"))),
        styles: {
          fontSize: 9,
          cellPadding: 6,
        },
        headStyles: {
          fillColor: [15, 23, 42],
        },
      });

      doc.save(
        activeStage === "wawancara"
          ? `proses-seleksi-${activeDataset}-${activeStage}-${activeWawancaraTab}.pdf`
          : `proses-seleksi-${activeDataset}-${activeStage}.pdf`,
      );
    } finally {
      setIsExportingPdf(false);
    }
  }

  const dokumenBadge = dataSekolahModal
    ? getAvailabilityBadge(
        activeDataset === "abt"
          ? Boolean(normalizeText(selectedAbtRow?.link_pks))
          : Boolean(normalizeText(selectedRegulerRow?.link_folder_drive)) ||
              Boolean(normalizeText(selectedRegulerRow?.link_scan_pks)),
      )
    : null;
  const rpdBadge = dataSekolahModal
    ? getRpdBadge({
        rpkpItemCount: selectedProposalBundle?.rpkpItemCount ?? 0,
        review: selectedBimtekReview,
      })
    : null;
  const pksBadge = dataSekolahModal
    ? getAvailabilityBadge(
        activeDataset === "abt"
          ? Boolean(normalizeText(selectedAbtRow?.link_pks))
          : Boolean(normalizeText(selectedRegulerRow?.link_scan_pks)) || Boolean(normalizeText(selectedRegulerRow?.status_pks)),
        activeDataset === "abt" ? "Tersedia" : normalizeText(selectedRegulerRow?.status_pks) || "Tersedia",
      )
    : null;
  const dokumenLink =
    activeDataset === "abt" ? null : normalizeText(selectedRegulerRow?.link_folder_drive) || null;
  const pksLink =
    activeDataset === "abt"
      ? normalizeText(selectedAbtRow?.link_pks) || null
      : normalizeText(selectedRegulerRow?.link_scan_pks) || null;

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardContent className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-primary">
                  <ClipboardCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="display-font text-2xl font-semibold text-slate-950">Proses Seleksi</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Pilih jenis anggaran, lalu cek status tiap tahapan seleksi pada daftar di bawah.
                  </p>
                </div>
              </div>

              <div className="w-full max-w-[560px] rounded-full bg-slate-100 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveDataset("reguler")}
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      activeDataset === "reguler"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                    }`}
                  >
                    Anggaran Reguler
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDataset("abt")}
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      activeDataset === "abt"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                    }`}
                  >
                    Anggaran Bantuan Tambahan (ABT)
                  </button>
                </div>
              </div>
            </div>

            <label className="grid gap-2 text-sm text-slate-600 lg:w-[360px]">
              <span className="font-medium text-slate-900">Cari</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari NPSN / nama sekolah / wilayah..."
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
          Memuat data proses seleksi...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">Tahapan Proses</p>
                <p className="mt-1 text-sm text-slate-600">
                  {activeDataset === "abt" ? "Anggaran Bantuan Tambahan (ABT)" : "Anggaran Reguler"} • Lolos:{" "}
                  {stageCounts[activeStage]} • Total: {stageRows.length}
                </p>
              </div>

              <div className="w-full rounded-full bg-slate-100 p-1">
                <div className="flex gap-1 overflow-x-auto">
                  {stageTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveStage(tab.key)}
                      className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                        activeStage === tab.key
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <Badge variant="secondary" className="h-6">
                        {stageCounts[tab.key]}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {activeStage === "wawancara" ? (
                <div className="w-full rounded-full bg-slate-100 p-1">
                  <div className="flex gap-1 overflow-x-auto">
                    {wawancaraTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveWawancaraTab(tab.key)}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                          activeWawancaraTab === tab.key
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <Badge variant="secondary" className="h-6">
                          {wawancaraTabCounts[tab.key]}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 lg:flex-row lg:items-end lg:justify-between">
              <div className={`grid gap-3 ${activeStage === "wawancara" ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
                {activeStage !== "wawancara" ? (
                  <label className="grid gap-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">Filter Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as StatusFilterValue)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                    >
                      <option value="all">Semua Status</option>
                      <option value="passed">Lolos</option>
                      <option value="failed">Tidak Lolos</option>
                    </select>
                  </label>
                ) : null}

                <label className="grid gap-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Filter Wilayah</span>
                  <select
                    value={regionFilter}
                    onChange={(event) => setRegionFilter(event.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                  >
                    <option value="all">Semua Wilayah</option>
                    {regionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={exportToXlsx} disabled={isExportingXlsx || exportRows.length === 0}>
                  {isExportingXlsx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Export .xlsx
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportToPdf} disabled={isExportingPdf || exportRows.length === 0}>
                  {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Export .pdf
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {activeStage === "wawancara" && activeWawancaraTab === "proses" ? (
                <table className="min-w-[2200px] w-full text-sm">
                  <thead className="bg-white text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-20 px-4 py-3">No</th>
                      <th className="w-44 px-4 py-3">NPSN</th>
                      <th className="min-w-[280px] px-4 py-3">Nama Sekolah</th>
                      {interviewQuestionDefinitions.map((question) => (
                        <th key={question.key} className="min-w-[180px] px-4 py-3">
                          {question.label}
                        </th>
                      ))}
                      <th className="w-32 px-4 py-3">Nilai</th>
                      <th className="min-w-[220px] px-4 py-3">Kategori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={interviewQuestionDefinitions.length + 5} className="px-4 py-10 text-center text-sm text-slate-500">
                          Tidak ada data untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      (pageRows as InterviewStageRow[]).map((row, index) => (
                        <tr key={`${activeDataset}-${activeStage}-${activeWawancaraTab}-${row.npsn}`}>
                          <td className="px-4 py-4 text-slate-700">{(clampedPage - 1) * pageSize + index + 1}</td>
                          <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                          <td className="px-4 py-4 text-slate-700">{row.namaSekolah}</td>
                          {interviewQuestionDefinitions.map((question) => (
                            <td key={question.key} className="px-4 py-4 text-center text-slate-700">
                              {(() => {
                                const raw = row.interviewResult.answers[question.key] as unknown;
                                if (typeof raw === "number") {
                                  return raw;
                                }
                                if (typeof raw === "object" && raw !== null && "score" in raw) {
                                  return String((raw as { score: number }).score);
                                }
                                return "-";
                              })()}
                            </td>
                          ))}
                          <td className="px-4 py-4 font-semibold text-slate-950">{row.interviewResult.totalScore}</td>
                          <td className="px-4 py-4">
                            <RecommendationBadge band={row.recommendationBand} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : activeStage === "wawancara" ? (
                <table className="min-w-[1300px] w-full text-sm">
                  <thead className="bg-white text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-20 px-4 py-3">No</th>
                      <th className="w-44 px-4 py-3">NPSN</th>
                      <th className="min-w-[300px] px-4 py-3">Nama Sekolah</th>
                      <th className="w-32 px-4 py-3">Nilai</th>
                      <th className="w-32 px-4 py-3">Rank</th>
                      <th className="min-w-[220px] px-4 py-3">Kategori</th>
                      <th className="min-w-[200px] px-4 py-3">Fasilitator</th>
                      <th className="w-44 px-4 py-3">Data Sekolah</th>
                      <th className="w-44 px-4 py-3">Status</th>
                      <th className="min-w-[260px] px-4 py-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                          Tidak ada data untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      (pageRows as InterviewStageRow[]).map((row, index) => (
                        <tr key={`${activeDataset}-${activeStage}-${activeWawancaraTab}-${row.npsn}`}>
                          <td className="px-4 py-4 text-slate-700">{(clampedPage - 1) * pageSize + index + 1}</td>
                          <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                          <td className="px-4 py-4 text-slate-700">{row.namaSekolah}</td>
                          <td className="px-4 py-4 font-semibold text-slate-950">{row.interviewResult.totalScore}</td>
                          <td className="px-4 py-4 text-slate-700">{row.rank}</td>
                          <td className="px-4 py-4">
                            <RecommendationBadge band={row.recommendationBand} />
                          </td>
                          <td className="px-4 py-4 text-slate-700">{row.facilitatorEquipmentName || "-"}</td>
                          <td className="px-4 py-4">
                            <Button type="button" size="sm" variant="outline" onClick={() => setDataSekolahModal(row)}>
                              Lihat
                            </Button>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge statusLolos={row.statusLolos} />
                          </td>
                          <td className="px-4 py-4 text-slate-700">{row.keterangan || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-white text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-20 px-4 py-3">No</th>
                      <th className="w-44 px-4 py-3">NPSN</th>
                      <th className="min-w-[360px] px-4 py-3">Nama Sekolah</th>
                      <th className="w-44 px-4 py-3">Data Sekolah</th>
                      <th className="w-44 px-4 py-3">Status</th>
                      <th className="min-w-[340px] px-4 py-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                          Tidak ada data untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, index) => (
                        <tr key={`${activeDataset}-${activeStage}-${row.npsn}`}>
                          <td className="px-4 py-4 text-slate-700">{(clampedPage - 1) * pageSize + index + 1}</td>
                          <td className="px-4 py-4 font-medium text-slate-950">{row.npsn}</td>
                          <td className="px-4 py-4 text-slate-700">{row.namaSekolah}</td>
                          <td className="px-4 py-4">
                            <Button type="button" size="sm" variant="outline" onClick={() => setDataSekolahModal(row)}>
                              Lihat
                            </Button>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge statusLolos={row.statusLolos} />
                          </td>
                          <td className="px-4 py-4 text-slate-700">{row.keterangan || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
              <div>
                {displayedRows.length === 0
                  ? "0 data"
                  : `Menampilkan ${(clampedPage - 1) * pageSize + 1}-${Math.min(clampedPage * pageSize, displayedRows.length)} dari ${
                      displayedRows.length
                    } data`}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Sebelumnya
                </Button>
                <span className="px-3 text-sm font-semibold text-slate-900">
                  Halaman {clampedPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dataSekolahModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Data Sekolah</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{dataSekolahModal.namaSekolah}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  NPSN {dataSekolahModal.npsn} • {dataSekolahModal.kab || dataSekolahModal.kota || "-"},{" "}
                  {dataSekolahModal.provinsi || "-"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDataSekolahModal(null)}>
                Tutup
              </Button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <Card className="rounded-[20px]">
                <CardContent className="space-y-2 px-5 py-4 text-sm text-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ringkasan</p>
                  <p>Nama Sekolah: <span className="font-semibold text-slate-950">{dataSekolahModal.namaSekolah}</span></p>
                  <p>NPSN: <span className="font-semibold text-slate-950">{dataSekolahModal.npsn}</span></p>
                  <p>Provinsi: {dataSekolahModal.provinsi || "-"}</p>
                  <p>Kab: {dataSekolahModal.kab || "-"}</p>
                  <p>Kota: {dataSekolahModal.kota || "-"}</p>
                  <p>Kecamatan: {dataSekolahModal.kec || "-"}</p>
                  <p>Catatan: {dataSekolahModal.catatan || "-"}</p>
                </CardContent>
              </Card>

              <Card className="rounded-[20px]">
                <CardContent className="space-y-3 px-5 py-4 text-sm text-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dokumen Seleksi</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-slate-900">Dokumen</span>
                    {dokumenBadge ? <Badge variant={dokumenBadge.variant}>{dokumenBadge.label}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-slate-900">RPD</span>
                    {rpdBadge ? <Badge variant={rpdBadge.variant}>{rpdBadge.label}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-slate-900">PKS</span>
                    {pksBadge ? <Badge variant={pksBadge.variant}>{pksBadge.label}</Badge> : null}
                  </div>

                  {selectedProposalBundle ? (
                    <p className="text-xs text-slate-500">
                      RPD terhubung ke data RPKP dengan {selectedProposalBundle.rpkpItemCount} item.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-3 pt-1">
                    {dokumenLink ? (
                      <a href={dokumenLink} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm">Buka Dokumen</Button>
                      </a>
                    ) : null}
                    {pksLink ? (
                      <a href={pksLink} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm" variant="outline">Buka PKS</Button>
                      </a>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
