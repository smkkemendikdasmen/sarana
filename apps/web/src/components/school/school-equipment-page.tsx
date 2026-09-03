"use client";

import { AlertTriangle, Blocks, Building2, CheckCircle2, Clock4, Download, FileSpreadsheet, Loader2, MessageSquareWarning, NotebookPen, Pencil, Plus, RefreshCw, Save, Trash2, Upload, Users, Wrench, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCachedVerifikasiReviews } from "@/lib/school-verifikasi-cache";
import { useSchoolDetailView } from "@/components/school/school-detail-view-context";
import {
  perdirjenEquipmentBidangRequest,
  saveSchoolEquipmentDataRequest,
  schoolEquipmentDataByNpsnRequest,
  schoolEquipmentDataRequest,
  schoolProfileByNpsnRequest,
  schoolProfileRequest,
  type PerdirjenEquipmentDetailBidang,
  type PerdirjenEquipmentDetailKonsentrasi,
  type SchoolProfileRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const kategoriOrder = [
  "Peralatan Praktik Utama Kriteria Minimal",
  "Peralatan Praktik Utama Kriteria Pengembangan",
  "Peralatan Praktik Pendukung",
] as const;

const kategoriTabs: Array<{ key: KategoriKey; label: string }> = [
  {
    key: "Peralatan Praktik Utama Kriteria Minimal",
    label: "Peralatan Praktik Utama Kriteria Minimal",
  },
  {
    key: "Peralatan Praktik Utama Kriteria Pengembangan",
    label: "Peralatan Praktik Utama Kriteria Pengembangan",
  },
  {
    key: "Peralatan Praktik Pendukung",
    label: "Peralatan Praktik Pendukung",
  },
];

type KategoriKey = (typeof kategoriOrder)[number];

type SchoolEquipmentReference = {
  bidangCode: string;
  bidangName: string;
  programCode: string;
  programName: string;
  concentrationCode: string;
  concentrationName: string;
  detail: PerdirjenEquipmentDetailKonsentrasi;
};

type EditableEquipmentRow = {
  name: string;
  functionText: string;
  specificationText: string;
  ratio: string;
  ownership: "" | "Ada" | "Tidak";
  quantity: string;
  goodCondition: string;
  badCondition: string;
  needed: string;
  notes: string;
  isCustom?: boolean;
};

type PersistedEquipmentTables = Record<string, EditableEquipmentRow[]>;

function compareConcentrationCode(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? -1;
    const rightValue = rightParts[index] ?? -1;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.localeCompare(right, "id-ID");
}

function findSchoolReference(
  concentrationCode: string,
  bidang: PerdirjenEquipmentDetailBidang | undefined,
): SchoolEquipmentReference | null {
  if (!bidang) {
    return null;
  }

  for (const program of bidang.program) {
    const konsentrasi = program.konsentrasi.find((item) => item.no === concentrationCode);
    if (konsentrasi) {
      return {
        bidangCode: bidang.no,
        bidangName: bidang.bidang,
        programCode: program.no,
        programName: program.nama,
        concentrationCode: konsentrasi.no,
        concentrationName: konsentrasi.nama,
        detail: konsentrasi,
      };
    }
  }

  return null;
}

function countKonsentrasiItems(konsentrasi: PerdirjenEquipmentDetailKonsentrasi) {
  return kategoriOrder.reduce((total, kategori) => total + konsentrasi[kategori].length, 0);
}

function getTableKey(schoolId: string, concentrationCode: string, kategori: KategoriKey) {
  return `${schoolId}::${concentrationCode}::${kategori}`;
}

function parseNonNegativeInteger(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeEditableRow(
  row: Partial<EditableEquipmentRow> & { condition?: "" | "Baik" | "Rusak" },
): EditableEquipmentRow {
  const quantity = typeof row.quantity === "string" ? row.quantity : row.quantity != null ? String(row.quantity) : "";
  const fallbackConditionValue = quantity || "0";

  return {
    name: row.name ?? "",
    functionText: row.functionText ?? "",
    specificationText: row.specificationText ?? "",
    ratio: row.ratio ?? "",
    ownership: row.ownership === "Ada" || row.ownership === "Tidak" ? row.ownership : "",
    quantity,
    goodCondition:
      typeof row.goodCondition === "string"
        ? row.goodCondition
        : row.condition === "Baik"
          ? fallbackConditionValue
          : "",
    badCondition:
      typeof row.badCondition === "string"
        ? row.badCondition
        : row.condition === "Rusak"
          ? fallbackConditionValue
          : "",
    needed: typeof row.needed === "string" ? row.needed : row.needed != null ? String(row.needed) : "",
    notes: row.notes ?? "",
    isCustom: Boolean(row.isCustom),
  };
}

function toEditableRows(konsentrasi: PerdirjenEquipmentDetailKonsentrasi, kategori: KategoriKey): EditableEquipmentRow[] {
  return konsentrasi[kategori].map((item) => ({
    name: item["Nama Alat"] ?? "",
    functionText: item["Fungsi Alat"] ?? "",
    specificationText: item["Spesifikasi Alat"] ?? "",
    ratio: item["Rasio Satuan"] ?? "",
    ownership: "",
    quantity: "",
    goodCondition: "",
    badCondition: "",
    needed: "",
    notes: "",
    isCustom: false,
  }));
}

function createEmptyRow(): EditableEquipmentRow {
  return {
    name: "",
    functionText: "",
    specificationText: "",
    ratio: "",
    ownership: "",
    quantity: "",
    goodCondition: "",
    badCondition: "",
    needed: "",
    notes: "",
    isCustom: true,
  };
}

function normalizePersistedTables(payload: Record<string, unknown> | undefined): PersistedEquipmentTables {
  return Object.fromEntries(
    Object.entries(payload ?? {}).map(([key, rows]) => [
      key,
      Array.isArray(rows)
        ? rows.map((row) =>
            normalizeEditableRow((row ?? {}) as Partial<EditableEquipmentRow> & { condition?: "" | "Baik" | "Rusak" }),
          )
        : [],
    ]),
  );
}

function summarizeRows(rows: EditableEquipmentRow[]) {
  return rows.reduce(
    (summary, row) => ({
      owned: summary.owned + (row.ownership === "Ada" ? 1 : 0),
      total: summary.total + 1,
      good: summary.good + parseNonNegativeInteger(row.goodCondition),
      bad: summary.bad + parseNonNegativeInteger(row.badCondition),
      needed: summary.needed + parseNonNegativeInteger(row.needed),
    }),
    { owned: 0, total: 0, good: 0, bad: 0, needed: 0 },
  );
}

type ParsedReviewEntry = { status?: string; note?: string };
type StructuredReviewNotes = {
  globalNote: string;
  concentrations: Record<string, ParsedReviewEntry>;
  documents: Record<string, ParsedReviewEntry>;
  conditions: Record<string, ParsedReviewEntry>;
  proposals: Record<string, ParsedReviewEntry>;
};

type ReviewItemStatus = "approved" | "pending" | "rejected" | null;
interface AlatPerKkV3Draft {
  konsentrasi: { status: ReviewItemStatus; note: string };
  sarana: { status: ReviewItemStatus; note: string };
  pengajuan: { status: ReviewItemStatus; note: string };
}
interface AlatReviewDetailStructV3 {
  version?: number;
  globalNote?: string;
  globalStatus?: ReviewItemStatus;
  konsentrasi?: { status: ReviewItemStatus; note: string };
  kondisi?: { status: ReviewItemStatus; note: string };
  ajuan?: { status: ReviewItemStatus; note: string };
  perKk?: Record<string, AlatPerKkV3Draft>;
}

function normalizeParseV3Status(status: ReviewItemStatus | undefined): string | undefined {
  if (!status) return undefined;
  return status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
}

function parseStructuredReviewNotes(raw: string | null | undefined): StructuredReviewNotes {
  const empty: StructuredReviewNotes = {
    globalNote: "",
    concentrations: {},
    documents: {},
    conditions: {},
    proposals: {},
  };
  if (!raw || !raw.trim()) return empty;
  const text = raw.trim();
  if (!text.startsWith("{")) {
    return { ...empty, globalNote: text };
  }
  try {
    const parsed = JSON.parse(text) as Partial<StructuredReviewNotes> & Partial<AlatReviewDetailStructV3>;

    const concentrations: Record<string, ParsedReviewEntry> =
      typeof parsed.concentrations === "object" && parsed.concentrations !== null
        ? { ...(parsed.concentrations as StructuredReviewNotes["concentrations"]) }
        : {};
    const documents: Record<string, ParsedReviewEntry> =
      typeof parsed.documents === "object" && parsed.documents !== null
        ? { ...(parsed.documents as StructuredReviewNotes["documents"]) }
        : {};
    const conditions: Record<string, ParsedReviewEntry> =
      typeof parsed.conditions === "object" && parsed.conditions !== null
        ? { ...(parsed.conditions as StructuredReviewNotes["conditions"]) }
        : {};
    const proposals: Record<string, ParsedReviewEntry> =
      typeof parsed.proposals === "object" && parsed.proposals !== null
        ? { ...(parsed.proposals as StructuredReviewNotes["proposals"]) }
        : {};

    if (typeof parsed.perKk === "object" && parsed.perKk !== null) {
      for (const [code, kk] of Object.entries(parsed.perKk as Record<string, AlatPerKkV3Draft>)) {
        if (!code) continue;
        if (kk.sarana && (kk.sarana.status || kk.sarana.note?.trim())) {
          conditions[code] = {
            status: normalizeParseV3Status(kk.sarana.status) ?? conditions[code]?.status,
            note: [conditions[code]?.note, kk.sarana.note].filter(Boolean).join("\n").trim() || undefined,
          };
        }
        if (kk.pengajuan && (kk.pengajuan.status || kk.pengajuan.note?.trim())) {
          proposals[code] = {
            status: normalizeParseV3Status(kk.pengajuan.status) ?? proposals[code]?.status,
            note: [proposals[code]?.note, kk.pengajuan.note].filter(Boolean).join("\n").trim() || undefined,
          };
        }
        if (kk.konsentrasi && (kk.konsentrasi.status || kk.konsentrasi.note?.trim())) {
          concentrations[code] = {
            status: normalizeParseV3Status(kk.konsentrasi.status) ?? concentrations[code]?.status,
            note: [concentrations[code]?.note, kk.konsentrasi.note].filter(Boolean).join("\n").trim() || undefined,
          };
        }
      }
      if (parsed.kondisi?.note?.trim()) {
        conditions["_global_sarana"] = {
          status: normalizeParseV3Status(parsed.kondisi.status) ?? conditions["_global_sarana"]?.status,
          note: [conditions["_global_sarana"]?.note, parsed.kondisi.note].filter(Boolean).join("\n").trim(),
        };
      }
      if (parsed.ajuan?.note?.trim()) {
        proposals["_global_pengajuan"] = {
          status: normalizeParseV3Status(parsed.ajuan.status) ?? proposals["_global_pengajuan"]?.status,
          note: [proposals["_global_pengajuan"]?.note, parsed.ajuan.note].filter(Boolean).join("\n").trim(),
        };
      }
      if (parsed.konsentrasi?.note?.trim()) {
        concentrations["_global_konsentrasi"] = {
          status: normalizeParseV3Status(parsed.konsentrasi.status) ?? concentrations["_global_konsentrasi"]?.status,
          note: [concentrations["_global_konsentrasi"]?.note, parsed.konsentrasi.note].filter(Boolean).join("\n").trim(),
        };
      }
    }

    return {
      globalNote: String(parsed.globalNote ?? "").trim(),
      concentrations,
      documents,
      conditions,
      proposals,
    };
  } catch {
    return { ...empty, globalNote: text };
  }
}

function formatVerifikasiDate(value: string) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function getReviewStatusStyle(approved: boolean | null | undefined, parsedNotes: StructuredReviewNotes) {
  const hasAnyNote =
    Boolean(parsedNotes.globalNote.trim()) ||
    Object.keys(parsedNotes.documents).length > 0 ||
    Object.keys(parsedNotes.concentrations).length > 0 ||
    Object.keys(parsedNotes.conditions).length > 0 ||
    Object.keys(parsedNotes.proposals).length > 0;
  if (approved === true) {
    return { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Disetujui" };
  }
  if (approved === false) {
    return { className: "border-rose-200 bg-rose-50 text-rose-700", label: "Ditolak" };
  }
  if (hasAnyNote) {
    return { className: "border-amber-200 bg-amber-50 text-amber-700", label: "Perlu Perhatian" };
  }
  return { className: "border-slate-200 bg-slate-100 text-slate-600", label: "Belum Di Proses" };
}

function getReviewStatusBadgeStyle(status?: string) {
  const s = status ? String(status).toLowerCase() : "";
  if (s === "approved" || s === "setuju" || s.startsWith("setuju") || s.includes("approve"))
    return { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Disetujui" };
  if (s === "rejected" || s.includes("tolak")) return { className: "border-rose-200 bg-rose-50 text-rose-700", label: "Ditolak" };
  if (s === "attention" || s === "need_attention" || s.includes("perlu"))
    return { className: "border-amber-200 bg-amber-50 text-amber-700", label: "Perlu Perhatian" };
  return { className: "border-slate-200 bg-slate-100 text-slate-600", label: "Belum Di Proses" };
}

export function SchoolEquipmentPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const detailView = useSchoolDetailView();
  const overrideNpsn = detailView?.npsn ?? null;
  const isViewMode = Boolean(overrideNpsn) && detailView?.role !== "SEKOLAH";
  const token = session?.token ?? "";
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [references, setReferences] = useState<SchoolEquipmentReference[]>([]);
  const [missingCodes, setMissingCodes] = useState<string[]>([]);
  const [persistedTables, setPersistedTables] = useState<PersistedEquipmentTables>({});
  const [editingTableKey, setEditingTableKey] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<EditableEquipmentRow[]>([]);
  const [activeKategori, setActiveKategori] = useState<KategoriKey>(kategoriOrder[0]);
  const [selectedConcentrationCode, setSelectedConcentrationCode] = useState("");
  const [tableMessages, setTableMessages] = useState<
    Record<string, { type: "success" | "error"; text: string } | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [excelLoading, setExcelLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [verifikasiReview, setVerifikasiReview] = useState<WorkspaceVerifikasiOnlineRecord | null | undefined>(
    undefined,
  );
  const [refreshingVerifikasi, setRefreshingVerifikasi] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalReference, setEditModalReference] = useState<SchoolEquipmentReference | null>(null);
  const [editModalKategori, setEditModalKategori] = useState<KategoriKey | null>(null);
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [uploadConfirmReference, setUploadConfirmReference] = useState<SchoolEquipmentReference | null>(null);
  const [uploadConfirmFile, setUploadConfirmFile] = useState<File | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) {
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const profilePromise = overrideNpsn
          ? schoolProfileByNpsnRequest(token, overrideNpsn)
          : schoolProfileRequest(token);
        const equipmentPromise = overrideNpsn
          ? schoolEquipmentDataByNpsnRequest(token, overrideNpsn)
          : schoolEquipmentDataRequest(token);
        const [schoolProfile, equipmentData] = await Promise.all([
          profilePromise,
          equipmentPromise,
        ]);
        if (cancelled) {
          return;
        }

        void (async () => {
          try {
            if (!schoolProfile.npsn) return;
            const rows = await fetchCachedVerifikasiReviews(token, { schoolNpsn: schoolProfile.npsn });
            if (!cancelled) setVerifikasiReview(rows[0] ?? null);
          } catch {
            if (!cancelled) setVerifikasiReview(null);
          } finally {
            if (!cancelled) setRefreshingVerifikasi(false);
          }
        })();

        const allConcentrations = [...schoolProfile.concentrations].filter((kk) => Boolean(kk && kk.code));
        const sortedConcentrations = [...allConcentrations].sort((left, right) =>
          compareConcentrationCode(left.code, right.code),
        );
        const bidangCodes = [...new Set(sortedConcentrations.map((item) => item.code.split(".")[0]).filter(Boolean))];
        const bidangSettled = await Promise.allSettled(
          bidangCodes.map(async (code) => [code, await perdirjenEquipmentBidangRequest(code)] as const),
        );
        const bidangDetails = bidangSettled
          .filter((result): result is PromiseFulfilledResult<readonly [string, PerdirjenEquipmentDetailBidang]> => result.status === "fulfilled")
          .map((result) => result.value);

        if (cancelled) {
          return;
        }

        const bidangMap = Object.fromEntries(bidangDetails);
        const nextReferences: SchoolEquipmentReference[] = [];
        const nextMissingCodes: string[] = [];

        for (const concentration of sortedConcentrations) {
          const bidangCode = concentration.code.split(".")[0] ?? "";
          const match = findSchoolReference(concentration.code, bidangMap[bidangCode]);

          if (match) {
            nextReferences.push(match);
          } else {
            nextMissingCodes.push(concentration.code);
          }
        }

        setProfile(schoolProfile);
        setReferences(nextReferences);
        setMissingCodes(nextMissingCodes);
        setPersistedTables(normalizePersistedTables(equipmentData.equipmentTables));
        setSelectedConcentrationCode((current) =>
          current && sortedConcentrations.some((item) => item.code === current)
            ? current
            : (sortedConcentrations[0]?.code ?? ""),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data alat sekolah.");
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
  }, [hydrated, token]);

  const totalReferenceItems = useMemo(
    () => references.reduce((sum, item) => sum + countKonsentrasiItems(item.detail), 0),
    [references],
  );

  const selectedReference = useMemo(
    () => references.find((item) => item.concentrationCode === selectedConcentrationCode) ?? null,
    [references, selectedConcentrationCode],
  );

  const concentrationSummaries = useMemo(() => {
    if (!profile) {
      return [];
    }

    const allProfileKk = profile.concentrations.filter((kk) => Boolean(kk && kk.code));
    return [...allProfileKk]
      .sort((left, right) => compareConcentrationCode(left.code, right.code))
      .map((concentration) => {
        const reference = references.find((item) => item.concentrationCode === concentration.code) ?? null;

        const categorySummaries = Object.fromEntries(
          kategoriOrder.map((kategori) => {
            const rows = reference ? getRows(reference, kategori) : [];
            return [kategori, summarizeRows(rows)];
          }),
        ) as Record<KategoriKey, ReturnType<typeof summarizeRows>>;

        return {
          ...concentration,
          hasReference: Boolean(reference),
          categorySummaries,
          totalGood: kategoriOrder.reduce((sum, kategori) => sum + categorySummaries[kategori].good, 0),
          totalBad: kategoriOrder.reduce((sum, kategori) => sum + categorySummaries[kategori].bad, 0),
          totalNeeded: kategoriOrder.reduce((sum, kategori) => sum + categorySummaries[kategori].needed, 0),
        };
      });
  }, [profile, references, persistedTables]);

  function getRows(reference: SchoolEquipmentReference, kategori: KategoriKey) {
    if (!profile) {
      return [];
    }

    const tableKey = getTableKey(profile.schoolId, reference.concentrationCode, kategori);
    return persistedTables[tableKey] ?? toEditableRows(reference.detail, kategori);
  }

  function openEditModal(reference: SchoolEquipmentReference, kategori: KategoriKey) {
    if (!profile) {
      return;
    }

    const tableKey = getTableKey(profile.schoolId, reference.concentrationCode, kategori);
    setEditingTableKey(tableKey);
    setDraftRows(getRows(reference, kategori).map((row) => ({ ...row })));
    setTableMessages((current) => ({ ...current, [tableKey]: undefined }));
    setEditModalReference(reference);
    setEditModalKategori(kategori);
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    if (editModalSaving) {
      return;
    }
    setIsEditModalOpen(false);
    setEditingTableKey(null);
    setDraftRows([]);
    setEditModalReference(null);
    setEditModalKategori(null);
  }

  function addDraftRow() {
    setDraftRows((current) => [...current, createEmptyRow()]);
  }

  function removeDraftRow(index: number) {
    setDraftRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function updateDraftRow(index: number, field: keyof EditableEquipmentRow, value: string | boolean) {
    setDraftRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        const nextRow = { ...row, [field]: value };

        if (field === "ownership" && value === "Tidak") {
          nextRow.quantity = "0";
          nextRow.goodCondition = "0";
          nextRow.badCondition = "0";
        }

        return nextRow;
      }),
    );
  }

  async function saveTableFromModal() {
    if (!profile || !token || !editModalReference || !editModalKategori) {
      return;
    }

    const reference = editModalReference;
    const kategori = editModalKategori;
    const tableKey = getTableKey(profile.schoolId, reference.concentrationCode, kategori);

    const sanitizedRows = draftRows.map((row) => ({
      ...row,
      name: row.name.trim(),
      functionText: row.functionText.trim(),
      specificationText: row.specificationText.trim(),
      ratio: row.ratio.trim(),
      quantity: row.ownership === "Tidak" ? "0" : row.quantity.trim(),
      goodCondition: row.ownership === "Tidak" ? "0" : row.goodCondition.trim(),
      badCondition: row.ownership === "Tidak" ? "0" : row.badCondition.trim(),
      needed: row.needed.trim(),
      notes: row.notes.trim(),
    }));

    const invalidRow = sanitizedRows.find((row) => !row.name);
    if (invalidRow) {
      setTableMessages((current) => ({
        ...current,
        [tableKey]: { type: "error", text: "Nama alat wajib diisi sebelum tabel disimpan." },
      }));
      return;
    }

    const invalidOwnershipRow = sanitizedRows.find((row) => {
      const quantity = parseNonNegativeInteger(row.quantity);
      const goodCondition = parseNonNegativeInteger(row.goodCondition);
      const badCondition = parseNonNegativeInteger(row.badCondition);

      if (row.ownership === "Tidak") {
        return quantity !== 0 || goodCondition !== 0 || badCondition !== 0;
      }

      if (row.ownership === "Ada" && !row.quantity) {
        return true;
      }

      return goodCondition + badCondition !== quantity;
    });

    if (invalidOwnershipRow) {
      setTableMessages((current) => ({
        ...current,
        [tableKey]: {
          type: "error",
          text: "Kondisi Baik + Kondisi Rusak harus sama dengan Jumlah yang dimiliki pada setiap baris alat.",
        },
      }));
      return;
    }

    const nextTables = {
      ...persistedTables,
      [tableKey]: sanitizedRows,
    };

    setEditModalSaving(true);
    try {
      if (isViewMode) throw new Error("Mode tampilan Fasilitator Alat — hanya bisa melihat data sekolah. Silakan minta sekolah login untuk mengubah data sendiri.");
      const saved = await saveSchoolEquipmentDataRequest(token, {
        equipmentTables: nextTables,
      });
      setPersistedTables(normalizePersistedTables(saved.equipmentTables));
      setEditingTableKey(null);
      setDraftRows([]);
      setTableMessages((current) => ({
        ...current,
        [tableKey]: { type: "success", text: "Perubahan tabel berhasil disimpan ke database." },
      }));
      setIsEditModalOpen(false);
      setEditModalReference(null);
      setEditModalKategori(null);
    } catch (saveError) {
      setTableMessages((current) => ({
        ...current,
        [tableKey]: {
          type: "error",
          text: saveError instanceof Error ? saveError.message : "Gagal menyimpan data aset alat.",
        },
      }));
    } finally {
      setEditModalSaving(false);
    }
  }

  const excelColumns = [
    { header: "Nama Alat", key: "name" as const, reference: true },
    { header: "Fungsi Alat", key: "functionText" as const, reference: true },
    { header: "Spesifikasi Alat", key: "specificationText" as const, reference: true },
    { header: "Rasio Satuan", key: "ratio" as const, reference: true },
    { header: "Kepemilikan", key: "ownership" as const, reference: false },
    { header: "Jumlah", key: "quantity" as const, reference: false },
    { header: "Kondisi Baik", key: "goodCondition" as const, reference: false },
    { header: "Kondisi Rusak", key: "badCondition" as const, reference: false },
    { header: "Kebutuhan", key: "needed" as const, reference: false },
    { header: "Keterangan", key: "notes" as const, reference: false },
  ];

  function referenceRowsForKategori(referenceDetail: PerdirjenEquipmentDetailKonsentrasi, kategori: KategoriKey): EditableEquipmentRow[] {
    const rawRows = (referenceDetail[kategori] ?? []) as unknown as Array<Record<string, string>>;
    return rawRows.map((item) => ({
      name: item["Nama Alat"] ?? "",
      functionText: item["Fungsi Alat"] ?? "",
      specificationText: item["Spesifikasi Alat"] ?? "",
      ratio: item["Rasio Satuan"] ?? "",
      ownership: "",
      quantity: "",
      goodCondition: "",
      badCondition: "",
      needed: "",
      notes: "",
    }));
  }

  function triggerFileDownload(workbook: XLSX.WorkBook, fileName: string) {
    const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadExcelTemplate(reference: SchoolEquipmentReference) {
    try {
      setExcelLoading(true);
      setFeedback(null);
      const workbook = XLSX.utils.book_new();
      for (const kategori of kategoriOrder) {
        const rows = referenceRowsForKategori(reference.detail, kategori);
        const ownershipColIndex = excelColumns.findIndex((col) => col.key === "ownership");
        const qtyColIndex = excelColumns.findIndex((col) => col.key === "quantity");
        const goodColIndex = excelColumns.findIndex((col) => col.key === "goodCondition");
        const badColIndex = excelColumns.findIndex((col) => col.key === "badCondition");
        const neededColIndex = excelColumns.findIndex((col) => col.key === "needed");
        const notesColIndex = excelColumns.findIndex((col) => col.key === "notes");

        const aoa: Array<Array<string | number>> = [];
        aoa.push(excelColumns.map((col) => col.header));
        const exampleRow = excelColumns.map((col) => {
          switch (col.key) {
            case "name":
              return "CONTOH ISIAN (contoh alat custom sekolah)";
            case "functionText":
              return "Contoh deskripsi fungsi alat";
            case "specificationText":
              return "Contoh spesifikasi alat";
            case "ratio":
              return "1 Set / Ruang Praktik";
            case "ownership":
              return "Ada";
            case "quantity":
              return 2;
            case "goodCondition":
              return 1;
            case "badCondition":
              return 1;
            case "needed":
              return 3;
            case "notes":
              return "siswanya kurang";
            default:
              return "";
          }
        });
        aoa.push(exampleRow);
        for (const row of rows) {
          aoa.push(excelColumns.map((col) => row[col.key] ?? ""));
        }
        const sheet = XLSX.utils.aoa_to_sheet(aoa);
        sheet["!cols"] = excelColumns.map((col) =>
          col.key === "name" || col.key === "functionText" || col.key === "specificationText" || col.key === "notes"
            ? { wch: 36 }
            : col.key === "ratio"
            ? { wch: 24 }
            : { wch: 16 },
        );
        sheet["!merges"] = [];
        if (ownershipColIndex >= 0) {
          const lastDataRow = rows.length + 1;
          const dataValidation: Record<string, { type: "list"; allowBlank: true; formulae: string[] }> = {};
          for (let r = 2; r <= lastDataRow; r++) {
            const cellAddr = XLSX.utils.encode_cell({ c: ownershipColIndex, r });
            dataValidation[cellAddr] = {
              type: "list",
              allowBlank: true,
              formulae: ['"Pilih,Ada,Tidak"'],
            };
          }
          sheet["!dataValidation"] = dataValidation;
        }
        if (notesColIndex >= 0) {
          const headerAddr = XLSX.utils.encode_cell({ c: notesColIndex, r: 0 });
          sheet[headerAddr].c = [
            {
              a: "SARANA SMK",
              t: "Keterangan: kolom Kepemilikan pakai dropdown Pilih / Ada / Tidak (baris 3 s.d. terakhir). Jumlah, Kondisi Baik, Kondisi Rusak, Kebutuhan diisi ANGKA bulat. Keterangan diisi teks deskripsi opsional (misal: alasan butuh, siswa kurang, rusak, dll). Baris 2 adalah CONTOH ISIAN, ganti/dihapus sebelum upload.",
              T: true,
              width: 320,
              height: 200,
            },
          ];
        }
        const safeSheetName = kategori.replace(/Peralatan Praktik /g, "").slice(0, 30) || kategori;
        XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName);
      }
      const fileName = `Format sarana - ${reference.concentrationCode} - ${reference.concentrationName}.xlsx`;
      triggerFileDownload(workbook, fileName);
      setFeedback({ type: "success", text: `Format Excel untuk ${reference.concentrationCode} - ${reference.concentrationName} berhasil di-download. Isi 6 kolom terakhir (Kepemilikan pakai dropdown, Jumlah dst angka bulat, Keterangan opsional teks). Baris ke-2 adalah CONTOH ISIAN, hapus/ganti sesuai data nyata sebelum Upload Excel.` });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal membuat format Excel.",
      });
    } finally {
      setExcelLoading(false);
    }
  }

  function openUploadConfirmModal(reference: SchoolEquipmentReference, file: File) {
    setUploadConfirmReference(reference);
    setUploadConfirmFile(file);
  }

  function closeUploadConfirmModal() {
    if (excelLoading) return;
    setUploadConfirmReference(null);
    setUploadConfirmFile(null);
  }

  async function proceedUploadConfirm() {
    if (!uploadConfirmFile || !uploadConfirmReference) return;
    try {
      setExcelLoading(true);
      const selectedBefore = selectedReference;
      const saved = await handleUploadExcelInternal(uploadConfirmFile, uploadConfirmReference);
      if (saved) {
        setFeedback({
          type: "success",
          text: `Berhasil upload Excel untuk ${uploadConfirmReference.concentrationCode} - ${uploadConfirmReference.concentrationName}. Data Peralatan Praktik (${kategoriOrder.length} kategori) tersimpan otomatis.`,
        });
      }
      void selectedBefore;
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memproses file Excel. Pastikan formatnya sesuai template.",
      });
    } finally {
      setExcelLoading(false);
      closeUploadConfirmModal();
    }
  }

  async function handleUploadExcel(file: File, reference: SchoolEquipmentReference) {
    openUploadConfirmModal(reference, file);
  }

  async function handleUploadExcelInternal(file: File, reference: SchoolEquipmentReference) {
    if (!profile?.schoolId) {
      setFeedback({ type: "error", text: "Profil sekolah belum dimuat sebelum upload Excel." });
      return false;
    }
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const kategoriMap = new Map<KategoriKey, EditableEquipmentRow[]>();
    for (const kategori of kategoriOrder) {
      const referenceRows = referenceRowsForKategori(reference.detail, kategori);
      const sheetNameCandidates = [
        kategori,
        kategori.replace(/Peralatan Praktik /g, ""),
        workbook.SheetNames.find((name) => kategori.includes(name) || name.includes(kategori.slice(0, 8))),
      ].filter((n): n is string => typeof n === "string" && !!workbook.Sheets[n]);
      const sheetName = sheetNameCandidates[0] ?? workbook.SheetNames[kategoriOrder.indexOf(kategori)] ?? "";
      const sheet = sheetName ? workbook.Sheets[sheetName] : null;
      const rawAoa = sheet
        ? (XLSX.utils.sheet_to_json<Array<unknown>>(sheet, { defval: "", header: 1 }) as Array<Array<string | number>>)
        : [];
      const headerRaw = rawAoa[0] ?? [];
      const header = headerRaw.map((h) => String(h ?? "").trim());
      const findCol = (alternatives: string[]) => {
        const idx = header.findIndex((h) =>
          alternatives.some((alt) => h.toLowerCase() === alt.toLowerCase() || h === alt),
        );
        return idx >= 0 ? idx : -1;
      };
      const colName = findCol(["Nama Alat", "name"]);
      const colFungsi = findCol(["Fungsi Alat", "Fungsi", "functionText"]);
      const colSpesifikasi = findCol(["Spesifikasi Alat", "Spesifikasi", "specificationText"]);
      const colRasio = findCol(["Rasio Satuan", "Rasio", "ratio"]);
      const colKepemilikan = findCol(["Kepemilikan", "ownership"]);
      const colJumlah = findCol(["Jumlah", "quantity"]);
      const colBaik = findCol(["Kondisi Baik", "Kondisi Bagus", "goodCondition"]);
      const colBuruk = findCol(["Kondisi Rusak", "Kondisi Buruk", "badCondition"]);
      const colButuh = findCol(["Kebutuhan", "needed"]);
      const colKet = findCol(["Keterangan", "notes"]);

      const toStringOrEmpty = (val: unknown) => {
        if (val == null || val === "") return "";
        const s = String(val).trim();
        if (s === "0") return "0";
        return Number.isFinite(Number(s)) ? String(Math.floor(Number(s))) : s;
      };
      const toStringOrEmptyLoose = (val: unknown) => {
        if (val == null || val === "") return "";
        const s = String(val).trim();
        if (s.toLowerCase() === "pilih") return "";
        return s;
      };
      const excelAoaRowToObj = (r: Array<string | number>): Record<string, string> => ({
        "Nama Alat": colName >= 0 ? String(r[colName] ?? "").trim() : "",
        "Fungsi Alat": colFungsi >= 0 ? String(r[colFungsi] ?? "").trim() : "",
        "Spesifikasi Alat": colSpesifikasi >= 0 ? String(r[colSpesifikasi] ?? "").trim() : "",
        "Rasio Satuan": colRasio >= 0 ? String(r[colRasio] ?? "").trim() : "",
        Kepemilikan: colKepemilikan >= 0 ? toStringOrEmptyLoose(r[colKepemilikan]) : "",
        Jumlah: colJumlah >= 0 ? toStringOrEmpty(r[colJumlah]) : "",
        "Kondisi Baik": colBaik >= 0 ? toStringOrEmpty(r[colBaik]) : "",
        "Kondisi Rusak": colBuruk >= 0 ? toStringOrEmpty(r[colBuruk]) : "",
        Kebutuhan: colButuh >= 0 ? toStringOrEmpty(r[colButuh]) : "",
        Keterangan: colKet >= 0 ? String(r[colKet] ?? "").trim() : "",
      });
      const dataAoaRows = rawAoa.slice(1).filter((r) => {
        const namaCell = colName >= 0 ? String(r[colName] ?? "").trim() : String(r[0] ?? "").trim();
        if (!namaCell) return false;
        if (namaCell === "CONTOH ISIAN (contoh alat custom sekolah)") return false;
        return !namaCell.startsWith("---") && !namaCell.startsWith("=") && namaCell.length > 0;
      });
      const rows = dataAoaRows.map(excelAoaRowToObj);
      const merged: EditableEquipmentRow[] = referenceRows.map((refRow) => {
        const excelRow = rows.find((r) => {
          const rName = String(r["Nama Alat"] ?? r["name"] ?? "").trim();
          return rName && rName === refRow.name.trim();
        });
        if (!excelRow) return refRow;
        const ownerRaw = String(excelRow["Kepemilikan"] ?? excelRow["ownership"] ?? "").trim();
        const ownership: "" | "Ada" | "Tidak" =
          ownerRaw === "Ada" || ownerRaw === "Tidak"
            ? ownerRaw
            : ownerRaw.toLowerCase() === "ada"
            ? "Ada"
            : ownerRaw.toLowerCase() === "tidak"
            ? "Tidak"
            : "";
        return {
          ...refRow,
          ownership,
          quantity: toStringOrEmpty(excelRow["Jumlah"] ?? excelRow["quantity"]),
          goodCondition: toStringOrEmpty(excelRow["Kondisi Baik"] ?? excelRow["goodCondition"]),
          badCondition: toStringOrEmpty(excelRow["Kondisi Rusak"] ?? excelRow["badCondition"]),
          needed: toStringOrEmpty(excelRow["Kebutuhan"] ?? excelRow["needed"]),
          notes: String(excelRow["Keterangan"] ?? excelRow["notes"] ?? refRow.notes).trim(),
        };
      });
      const extraRows = rows.filter((r) => {
        const rName = String(r["Nama Alat"] ?? r["name"] ?? "").trim();
        if (!rName) return false;
        return !referenceRows.some((ref) => ref.name.trim() === rName);
      });
      for (const extra of extraRows) {
        const ownerRaw = String(extra["Kepemilikan"] ?? extra["ownership"] ?? "").trim();
        const ownership: "" | "Ada" | "Tidak" = ownerRaw === "Ada" || ownerRaw === "Tidak" ? ownerRaw : "";
        merged.push({
          name: String(extra["Nama Alat"] ?? extra["name"] ?? "").trim(),
          functionText: String(extra["Fungsi Alat"] ?? extra["functionText"] ?? "").trim(),
          specificationText: String(extra["Spesifikasi Alat"] ?? extra["specificationText"] ?? "").trim(),
          ratio: String(extra["Rasio Satuan"] ?? extra["ratio"] ?? "").trim(),
          ownership,
          quantity: String(extra["Jumlah"] ?? extra["quantity"] ?? "").trim(),
          goodCondition: String(extra["Kondisi Baik"] ?? extra["goodCondition"] ?? "").trim(),
          badCondition: String(extra["Kondisi Rusak"] ?? extra["badCondition"] ?? "").trim(),
          needed: String(extra["Kebutuhan"] ?? extra["needed"] ?? "").trim(),
          notes: String(extra["Keterangan"] ?? extra["notes"] ?? "").trim(),
          isCustom: true,
        });
      }
      kategoriMap.set(kategori, merged);
    }
    const schoolId = profile.schoolId;
    const concentrationCode = reference.concentrationCode;
    const nextEquipmentTables: PersistedEquipmentTables = { ...persistedTables };
    for (const kategori of kategoriOrder) {
      const tableKey = getTableKey(schoolId, concentrationCode, kategori);
      const existingRows = persistedTables[tableKey] ?? [];
      const newRows = kategoriMap.get(kategori) ?? [];
      const mergedRows: EditableEquipmentRow[] = newRows.map((newRow) => {
        const existing = existingRows.find((row) => row.name && row.name === newRow.name);
        return { ...existing, ...newRow };
      });
      for (const extraExisting of existingRows.filter((r) => !newRows.some((n) => n.name && n.name === r.name))) {
        mergedRows.push(extraExisting);
      }
      nextEquipmentTables[tableKey] = mergedRows;
    }
    if (isViewMode) throw new Error("Mode tampilan Fasilitator Alat — hanya bisa melihat data sekolah. Silakan minta sekolah login untuk mengubah data sendiri.");
    const savedEquipment = await saveSchoolEquipmentDataRequest(token, { equipmentTables: nextEquipmentTables });
    const normalized = normalizePersistedTables(savedEquipment.equipmentTables);
    setPersistedTables(normalized);
    if (editingTableKey) {
      const activeTable = reference ? getTableKey(schoolId, reference.concentrationCode, activeKategori) : "";
      if (activeTable && editingTableKey === activeTable) {
        setDraftRows((normalized[editingTableKey] ?? []).map((row) => ({ ...row })));
      }
    }
    setEditingTableKey(null);
    return true;
  }

  const parsedEquipmentNotes = useMemo(
    () => parseStructuredReviewNotes(verifikasiReview?.reviewNoteEquipment),
    [verifikasiReview],
  );
  const parsedAdminNotes = useMemo(
    () => parseStructuredReviewNotes(verifikasiReview?.reviewNoteAdmin),
    [verifikasiReview],
  );

  function resolveConcentrationNameForReviewKey(key: string): string {
    if (!key) return key;
    if (profile && profile.concentrations.length) {
      const exact = profile.concentrations.find((kk) => kk.code === key);
      if (exact) return `${exact.code} - ${exact.name}`;
      const partial = profile.concentrations.find((kk) => key.includes(kk.code));
      if (partial) return `${partial.code} - ${partial.name}`;
    }
    const lastDashIdx = key.lastIndexOf("-");
    const codeSuffix = lastDashIdx > 0 ? key.slice(lastDashIdx + 1).trim() : key;
    return codeSuffix;
  }

  async function refreshVerifikasiReview() {
    if (!token || !profile?.npsn) return;
    setRefreshingVerifikasi(true);
    try {
      const rows = await fetchCachedVerifikasiReviews(
        token,
        { schoolNpsn: profile.npsn },
        { force: true },
      );
      const matched = rows[0] ?? null;
      setVerifikasiReview(matched);
    } finally {
      setRefreshingVerifikasi(false);
    }
  }

  type RenderReviewerArgs = {
    reviewerBadge: React.ReactNode;
    approvedFlag: boolean | null | undefined;
    reviewedName: string | null | undefined;
    reviewedAt: string | null | undefined;
    reviewerLabel: "alat" | "admin";
    parsedNotes: StructuredReviewNotes;
  };
  function renderReviewerStatusBlock({
    reviewerBadge,
    approvedFlag,
    reviewedName,
    reviewedAt,
    reviewerLabel,
    parsedNotes,
  }: RenderReviewerArgs) {
    const statusStyle = getReviewStatusStyle(approvedFlag, parsedNotes);
    const catatanJudul =
      reviewerLabel === "alat" ? "Catatan Umum Verifikasi Data Sarana Alat" : "Catatan Umum Verifikasi Data Sarana Administrasi";
    const placeholderText =
      reviewerLabel === "alat"
        ? "Belum ada catatan umum verifikasi data sarana alat dari Fasilitator Alat."
        : "Belum ada catatan umum verifikasi data sarana administrasi dari Fasilitator Administrasi.";
    const docCount = Object.keys(parsedNotes.documents).length;
    const kkCount = Object.keys(parsedNotes.concentrations).length;
    const conditionCount = Object.keys(parsedNotes.conditions).length;
    const hasAnyNote =
      (reviewerLabel !== "alat" ? Boolean(parsedNotes.globalNote.trim()) : false) ||
      docCount > 0 ||
      kkCount > 0 ||
      conditionCount > 0;

    return (
      <Card className="rounded-[24px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">{reviewerBadge}</div>
            <Badge className={`text-[11px] font-bold tracking-wide border ${statusStyle.className}`}>
              {approvedFlag === true ? (
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              ) : approvedFlag === false ? (
                <XCircle className="mr-1 h-3.5 w-3.5" />
              ) : hasAnyNote ? (
                <Clock4 className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Clock4 className="mr-1 h-3.5 w-3.5" />
              )}
              {statusStyle.label}
            </Badge>
          </div>
          {reviewedName ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Oleh {reviewedName}</span>
              {reviewedAt ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{formatVerifikasiDate(reviewedAt)}</span>
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-slate-400 italic">
              <Clock4 className="h-3.5 w-3.5" />
              Belum ada verifikasi dari reviewer ini.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] space-y-3">
            {reviewerLabel !== "alat" && (
              parsedNotes.globalNote ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquareWarning className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {catatanJudul}
                    </span>
                  </div>
                  <div className="block text-sm leading-6 whitespace-pre-wrap rounded-lg bg-white border border-slate-200 px-3.5 py-3 text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    {parsedNotes.globalNote}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 text-slate-300" />
                  <p className="text-xs text-slate-500 leading-6 italic">{placeholderText}</p>
                </div>
              )
            )}

            {(() => {
              const counters = [
                docCount > 0
                  ? {
                      label: `${docCount} Dokumen Memiliki Catatan`,
                      className: "border border-blue-200 bg-blue-50 text-blue-700",
                      icon: FileSpreadsheet,
                    }
                  : null,
                conditionCount > 0
                  ? {
                      label: `${conditionCount} Kondisi Ruang Punya Catatan`,
                      className: "border border-indigo-200 bg-indigo-50 text-indigo-700",
                      icon: Building2,
                    }
                  : null,
                kkCount > 0
                  ? {
                      label: `${kkCount} KK Memiliki Catatan Ruangan`,
                      className: "border border-violet-200 bg-violet-50 text-violet-700",
                      icon: CheckCircle2,
                    }
                  : null,
              ].filter((item): item is NonNullable<typeof item> => Boolean(item));
              if (counters.length === 0) return null;
              return (
                <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-2 text-[11px]">
                  {counters.map((c, idx) => (
                    <span
                      key={`${c.label}-${idx}`}
                      className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${c.className}`}
                    >
                      <c.icon className="mr-1 h-3 w-3" />
                      {c.label}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          {kkCount > 0 ? (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Blocks className="h-3.5 w-3.5 text-emerald-700" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900">
                    Catatan Review Data Sarana Per Konsentrasi (KK)
                  </p>
                </div>
                <Badge className="bg-white border-emerald-200 text-emerald-800 text-[11px]">
                  {kkCount} item
                </Badge>
              </div>
              <div className="space-y-2">
                {Object.entries(parsedNotes.concentrations).map(([key, entry], idx) => {
                  const statusStyleBadge = getReviewStatusBadgeStyle(entry.status);
                  return (
                    <div
                      key={`${key}-${idx}`}
                      className="rounded-[14px] border border-emerald-200/80 bg-white p-3 space-y-1.5 shadow-[0_1px_0_rgba(16,185,129,0.07)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {resolveConcentrationNameForReviewKey(key)}
                        </p>
                        <Badge className={`text-[10px] font-semibold tracking-wide ${statusStyleBadge.className}`}>
                          {statusStyleBadge.label}
                        </Badge>
                      </div>
                      {entry.note?.trim() ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
                          {entry.note.trim()}
                        </div>
                      ) : (
                        <p className="text-[11px] italic text-slate-400">
                          Hanya status {statusStyleBadge.label.toLowerCase()}, tanpa catatan tambahan.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!hydrated || !token) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
        Menyiapkan sesi sekolah...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="gap-3">
          <CardTitle className="text-2xl text-slate-950">Data Sarana Sekolah</CardTitle>
          <p className="text-sm leading-7 text-slate-600">
            Tabel dapat diedit per kategori. Gunakan tombol tambah untuk memasukkan alat baru bila belum ada di daftar
            referensi sekolah.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-2xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Memuat profil sekolah dan referensi alat...
            </div>
          ) : null}

          {(() => {
            const allKkCount =
              profile?.concentrations?.filter((kk) => Boolean(kk && kk.code)).length ?? 0;
            return (
              <>
                {!loading && missingCodes.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Referensi alat perdirjen belum ada untuk kode konsentrasi: {missingCodes.join(", ")}. Konsentrasi tanpa referensi tetap bisa diisi custom (klik Tambah Alat).
                  </div>
                ) : null}

                {!loading && profile && allKkCount === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Belum ada konsentrasi keahlian pada profil sekolah. Silakan isi dulu di tab Konsentrasi Keahlian.
                  </div>
                ) : null}

                {allKkCount > 0 ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          Data Konsentrasi Keahlian dari Profil Sekolah
                        </p>
                        <p className="text-xs text-slate-500">
                          Pilih baris konsentrasi untuk menampilkan tabel alat yang sesuai. SEMUA konsentrasi
                          (Rekomendasi Dinas & Tambahan Sekolah) ditampilkan.
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {allKkCount} Konsentrasi
                      </Badge>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[1480px] w-full text-sm">
                  <thead className="bg-slate-100/80 text-slate-600">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                      <th className="px-4 py-3 w-56">Aksi</th>
                      <th className="px-4 py-3">Konsentrasi Keahlian</th>
                      <th className="px-4 py-3">Jumlah Alat Dimiliki</th>
                      <th className="px-4 py-3">Kondisi Baik / Rusak</th>
                      <th className="px-4 py-3">Jumlah Kebutuhan</th>
                      <th className="px-4 py-3">Komentar Fasil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {concentrationSummaries.map((item, rowIdx) => {
                      const isActive = item.code === selectedConcentrationCode;
                      const ref = references.find((r) => r.concentrationCode === item.code) ?? null;
                      const equipNote = parsedEquipmentNotes.conditions[item.code];
                      const admNote = parsedAdminNotes.documents[item.code] ?? parsedAdminNotes.concentrations[item.code];
                      const statusEquip = equipNote?.status ? getReviewStatusBadgeStyle(equipNote.status) : null;
                      const statusAdm = admNote?.status ? getReviewStatusBadgeStyle(admNote.status) : null;
                      const hasAnyNote = Boolean(
                        (equipNote && (equipNote.status || equipNote.note?.trim())) ||
                          (admNote && (admNote.status || admNote.note?.trim())),
                      );
                      const inputId = `sarana-excel-upload-row-${rowIdx}`;
                      return (
                        <tr
                          key={`${item.code}-${item.name}`}
                          onClick={() => {
                            setSelectedConcentrationCode(item.code);
                            setEditingTableKey(null);
                            setDraftRows([]);
                          }}
                          className={`cursor-pointer align-top transition border-l-4 ${
                            isActive
                              ? "bg-primary/10 border-l-primary hover:bg-primary/10"
                              : rowIdx % 2 === 0
                                ? "bg-white border-l-transparent hover:bg-slate-50"
                                : "bg-slate-50/40 border-l-transparent hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={excelLoading || !ref}
                                onClick={() => ref && void handleDownloadExcelTemplate(ref)}
                                className="gap-1.5 h-8 px-2.5 text-[11.5px]"
                              >
                                {excelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                                <Download className="h-3.5 w-3.5" />
                                Format
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={excelLoading || !ref}
                                onClick={() => {
                                  const inputEl = document.getElementById(inputId) as HTMLInputElement | null;
                                  if (inputEl && ref) inputEl.click();
                                }}
                                className="gap-1.5 h-8 px-2.5 text-[11.5px]"
                              >
                                {excelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                Upload
                              </Button>
                              <input
                                id={inputId}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file && ref) void handleUploadExcel(file, ref);
                                  event.target.value = "";
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${isActive ? "text-primary-700" : "text-slate-500"}`}>
                                  {item.code}
                                </span>
                              </div>
                              <p className={`font-semibold ${isActive ? "text-primary-800" : "text-slate-950"}`}>{item.name}</p>
                              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">Rombel: {item.rombelCount}</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">Siswa: {item.studentCount}</span>
                                {!item.hasReference ? (
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                    Referensi belum tersedia
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1 text-sm text-slate-700">
                              <p>
                                Minimal {item.categorySummaries["Peralatan Praktik Utama Kriteria Minimal"].owned}/
                                {item.categorySummaries["Peralatan Praktik Utama Kriteria Minimal"].total}
                              </p>
                              <p>
                                Pengembangan {item.categorySummaries["Peralatan Praktik Utama Kriteria Pengembangan"].owned}/
                                {item.categorySummaries["Peralatan Praktik Utama Kriteria Pengembangan"].total}
                              </p>
                              <p>
                                Pendukung {item.categorySummaries["Peralatan Praktik Pendukung"].owned}/
                                {item.categorySummaries["Peralatan Praktik Pendukung"].total}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1 text-sm text-slate-700">
                              <p>Baik: {item.totalGood}</p>
                              <p>Rusak: {item.totalBad}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-medium text-slate-900">{item.totalNeeded}</td>
                          <td className="px-4 py-4">
                            {hasAnyNote ? (
                              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                {(admNote && (admNote.status || admNote.note?.trim())) ? (
                                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <Building2 className="h-3.5 w-3.5 text-sky-700" />
                                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sky-900">
                                          Administrasi
                                        </p>
                                      </div>
                                      {statusAdm ? (
                                        <Badge className={`border text-[10px] font-bold tracking-wide ${statusAdm.className.replace(/text-\S+/, "text-sky-900")} bg-white border-sky-200 text-sky-800`}>
                                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
                                            statusAdm.label === "Disetujui"
                                              ? "bg-emerald-500"
                                              : statusAdm.label === "Ditolak"
                                                ? "bg-rose-500"
                                                : statusAdm.label === "Perlu Perhatian"
                                                  ? "bg-amber-500"
                                                  : "bg-slate-400"
                                          }`} />
                                          {statusAdm.label}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {admNote.note?.trim() ? (
                                      <div className="rounded-md border border-sky-200/60 bg-white px-2 py-1.5 text-[11.5px] leading-5 text-slate-800 whitespace-pre-wrap">
                                        {admNote.note.trim()}
                                      </div>
                                    ) : (
                                      <p className="text-[10.5px] italic text-slate-500">
                                        Hanya status review, tanpa catatan tambahan.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                                {(equipNote && (equipNote.status || equipNote.note?.trim())) ? (
                                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <Wrench className="h-3.5 w-3.5 text-violet-700" />
                                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-violet-900">
                                          Alat
                                        </p>
                                      </div>
                                      {statusEquip ? (
                                        <Badge className={`border text-[10px] font-bold tracking-wide bg-white border-violet-200 text-violet-800`}>
                                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
                                            statusEquip.label === "Disetujui"
                                              ? "bg-emerald-500"
                                              : statusEquip.label === "Ditolak"
                                                ? "bg-rose-500"
                                                : statusEquip.label === "Perlu Perhatian"
                                                  ? "bg-amber-500"
                                                  : "bg-slate-400"
                                          }`} />
                                          {statusEquip.label}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {equipNote.note?.trim() ? (
                                      <div className="rounded-md border border-violet-200/60 bg-white px-2 py-1.5 text-[11.5px] leading-5 text-slate-800 whitespace-pre-wrap">
                                        {equipNote.note.trim()}
                                      </div>
                                    ) : (
                                      <p className="text-[10.5px] italic text-slate-500">
                                        Hanya status review, tanpa catatan tambahan.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-3 text-[11px] leading-5 text-slate-500 italic">
                                Belum ada komentar dari Fasilitator Administrasi &amp; Alat.
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
                ) : null}
              </>
            );
          })()}

          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}

          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">Kategori Alat</p>
              <p className="text-xs text-slate-500">Pilih kategori alat untuk menampilkan satu tabel yang aktif.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {kategoriTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveKategori(tab.key)}
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                    activeKategori === tab.key
                      ? "border-primary bg-primary text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {selectedReference ? (
            <section
              key={selectedReference.concentrationCode}
              className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {selectedReference.bidangCode}. Bidang Keahlian
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedReference.bidangName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {selectedReference.programCode}. Program Keahlian
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedReference.programName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {selectedReference.concentrationCode}. Konsentrasi Keahlian
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedReference.concentrationName}</p>
                </div>
              </div>

              {(() => {
                const saranaNote = parsedEquipmentNotes.conditions[selectedReference.concentrationCode];
                const konsentrasiNote = parsedEquipmentNotes.concentrations[selectedReference.concentrationCode];
                const globalSaranaNote = parsedEquipmentNotes.conditions["_global_sarana"];
                const entries = [
                  {
                    key: "konsentrasi-profile",
                    label: "Komentar Fasilitator Alat — Profil KK",
                    entry: konsentrasiNote,
                    accent: {
                      border: "border-violet-200",
                      bg: "bg-violet-50/60",
                      title: "text-violet-900",
                      badge: "border-violet-200 bg-white text-violet-800",
                    },
                  },
                  {
                    key: "sarana-inline",
                    label: "Komentar Fasilitator Alat — Sarana & Peralatan",
                    entry: saranaNote,
                    accent: {
                      border: "border-amber-200",
                      bg: "bg-amber-50/60",
                      title: "text-amber-900",
                      badge: "border-amber-200 bg-white text-amber-800",
                    },
                  },
                  {
                    key: "sarana-global-inline",
                    label: "Komentar Umum Fasilitator Alat — Sarana & Peralatan",
                    entry: globalSaranaNote,
                    accent: {
                      border: "border-indigo-200",
                      bg: "bg-indigo-50/60",
                      title: "text-indigo-900",
                      badge: "border-indigo-200 bg-white text-indigo-800",
                    },
                  },
                ].filter((item) => item.entry && (item.entry.status || item.entry.note?.trim()));
                if (!entries.length) return null;
                return (
                  <div className="space-y-2">
                    {entries.map(({ key, label, entry, accent }) => {
                      const styleBadge = getReviewStatusBadgeStyle(entry?.status);
                      return (
                        <div
                          key={key}
                          className={`rounded-[18px] border ${accent.border} ${accent.bg} p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] space-y-2`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <MessageSquareWarning className="h-3.5 w-3.5 text-amber-600" />
                              <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${accent.title}`}>
                                {label}
                              </p>
                            </div>
                            <Badge className={`text-[10px] font-semibold tracking-wide border ${accent.badge}`}>
                              {styleBadge.label}
                            </Badge>
                          </div>
                          {entry?.note?.trim() ? (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-6 text-slate-800 whitespace-pre-wrap shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                              {entry.note.trim()}
                            </div>
                          ) : (
                            <p className="text-[11px] italic text-slate-500">
                              Hanya status {styleBadge.label.toLowerCase()}, tanpa catatan tambahan.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {[activeKategori].map((kategori) => {
                if (!profile) {
                  return null;
                }

                const tableKey = getTableKey(profile.schoolId, selectedReference.concentrationCode, kategori);
                const rows = getRows(selectedReference, kategori);
                const currentMessage = tableMessages[tableKey];

                return (
                  <div
                    key={`${selectedReference.concentrationCode}-${kategori}`}
                    className="space-y-3 rounded-[20px] border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{kategori}</p>
                        <p className="text-xs text-slate-500">{rows.length} item alat</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                          <NotebookPen className="mr-1 h-3.5 w-3.5" />
                          Data konsentrasi profil
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(selectedReference, kategori)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Tabel
                        </Button>
                      </div>
                    </div>

                    {currentMessage ? (
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm ${
                          currentMessage.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-danger/15 bg-danger/[0.08] text-danger"
                        }`}
                      >
                        {currentMessage.text}
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <div className="min-w-[2320px]">
                          <div className="grid grid-cols-[84px_minmax(260px,1.05fr)_minmax(240px,0.9fr)_minmax(360px,1.35fr)_minmax(180px,0.7fr)_160px_140px_140px_140px_160px_260px_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <span>No</span>
                            <span>Nama Alat</span>
                            <span>Fungsi</span>
                            <span>Spesifikasi</span>
                            <span>Rasio</span>
                            <span>Kepemilikan</span>
                            <span>Jumlah</span>
                            <span>Kondisi Baik</span>
                            <span>Kondisi Rusak</span>
                            <span>Kebutuhan</span>
                            <span>Keterangan</span>
                            <span>Aksi</span>
                          </div>

                          <div className="divide-y divide-slate-200 bg-white">
                            {rows.length === 0 ? (
                              <div className="px-4 py-6 text-sm text-slate-600">
                                Belum ada data alat pada tabel ini. Gunakan tombol `Edit Tabel` untuk menambahkan baris baru.
                              </div>
                            ) : (
                              rows.map((row, index) => (
                                <div
                                  key={`${tableKey}-${index}`}
                                  className="grid grid-cols-[84px_minmax(260px,1.05fr)_minmax(240px,0.9fr)_minmax(360px,1.35fr)_minmax(180px,0.7fr)_160px_140px_140px_140px_160px_260px_88px] gap-3 px-4 py-3 align-top"
                                >
                                  <p className="pt-2 text-sm font-semibold text-slate-500">{index + 1}</p>
                                  <p className="text-sm font-semibold leading-6 text-slate-900">{row.name}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.functionText || "-"}</p>
                                  <pre className="font-sans whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                                    {row.specificationText || "-"}
                                  </pre>
                                  <p className="text-sm leading-6 text-slate-700">{row.ratio || "-"}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.ownership || "-"}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.quantity || "-"}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.goodCondition || "-"}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.badCondition || "-"}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.needed || "-"}</p>
                                  <p className="text-sm leading-6 text-slate-700">{row.notes || "-"}</p>
                                  <p className="text-center text-sm leading-6 text-slate-500">
                                    {row.isCustom ? "Custom" : "Referensi"}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : !loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Pilih konsentrasi dari profil sekolah untuk menampilkan data alat.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {uploadConfirmReference && uploadConfirmFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-[560px] overflow-hidden rounded-[24px] bg-white shadow-2xl flex flex-col">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.15em] text-amber-700">
                    Konfirmasi Upload Data Sarana
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {uploadConfirmReference.concentrationCode} — {uploadConfirmReference.concentrationName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUploadConfirmModal}
                disabled={excelLoading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-slate-600" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    File Yang Akan Diupload
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <p className="text-sm font-semibold text-slate-950 break-all">
                    {uploadConfirmFile.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
                    <span>
                      Ukuran:{" "}
                      <span className="font-semibold text-slate-700">
                        {uploadConfirmFile.size < 1024
                          ? `${uploadConfirmFile.size} B`
                          : uploadConfirmFile.size < 1024 * 1024
                            ? `${(uploadConfirmFile.size / 1024).toFixed(1)} KB`
                            : `${(uploadConfirmFile.size / (1024 * 1024)).toFixed(2)} MB`}
                      </span>
                    </span>
                    <span>
                      Tipe:{" "}
                      <span className="font-semibold text-slate-700">
                        {uploadConfirmFile.type || "Excel (.xlsx / .xls)"}
                      </span>
                    </span>
                    <span>
                      Modifikasi:{" "}
                      <span className="font-semibold text-slate-700">
                        {new Date(uploadConfirmFile.lastModified).toLocaleString("id-ID")}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-amber-900">
                    Keterangan Verifikasi Data
                  </p>
                </div>
                <div className="space-y-1.5 text-[12.5px] leading-6 text-amber-900/90">
                  <p>
                    File yang anda upload adalah <span className="font-semibold break-all">{uploadConfirmFile.name}</span>.
                  </p>
                  <p>
                    Pastikan <span className="font-semibold">file yang anda upload sudah benar</span> dan isi 6 kolom input sesuai aturan:
                  </p>
                  <ul className="ml-4 list-disc space-y-1 text-[12px] leading-6">
                    <li>Kepemilikan diisi dari dropdown (Pilih / Ada / Tidak)</li>
                    <li>Jumlah, Kondisi Baik, Kondisi Rusak, Kebutuhan diisi ANGKA bulat</li>
                    <li>Keterangan diisi teks deskripsi opsional (alasan kebutuhan, catatan, dll)</li>
                    <li>Baris ke-2 template adalah <span className="font-semibold">CONTOH ISIAN</span> — hapus atau ganti sebelum upload</li>
                  </ul>
                  <p className="font-semibold">
                    Setelah anda klik tombol <span className="underline">Masukan Ke Sistem</span>, data akan otomatis tersimpan ke database untuk semua 3 kategori alat.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/60 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeUploadConfirmModal}
                disabled={excelLoading}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void proceedUploadConfirm()}
                disabled={excelLoading}
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20"
              >
                {excelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {excelLoading ? "Memproses..." : "Masukan Ke Sistem"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditModalOpen && editModalReference && editModalKategori ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[1800px] overflow-hidden rounded-[28px] bg-white shadow-2xl flex flex-col">
            <div className="border-b border-slate-200 px-6 py-5 space-y-4 shrink-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">Edit Data Alat — {editModalKategori}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {editModalReference.concentrationCode} — {editModalReference.concentrationName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editModalSaving}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Tutup modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editingTableKey && tableMessages[editingTableKey] ? (
                <div
                  className={`rounded-[18px] border px-4 py-3 ${
                    tableMessages[editingTableKey]!.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  <p className="text-sm font-semibold">
                    {tableMessages[editingTableKey]!.type === "success" ? "Berhasil" : "Validasi gagal"}
                  </p>
                  <p className="mt-1 text-sm">{tableMessages[editingTableKey]!.text}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={addDraftRow} disabled={editModalSaving}>
                  <Plus className="h-4 w-4" />
                  Tambah Alat
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <div className="min-w-[2320px]">
                    <div className="grid grid-cols-[84px_minmax(260px,1.05fr)_minmax(240px,0.9fr)_minmax(360px,1.35fr)_minmax(180px,0.7fr)_160px_140px_140px_140px_160px_260px_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <span>No</span>
                      <span>Nama Alat</span>
                      <span>Fungsi</span>
                      <span>Spesifikasi</span>
                      <span>Rasio</span>
                      <span>Kepemilikan</span>
                      <span>Jumlah</span>
                      <span>Kondisi Baik</span>
                      <span>Kondisi Rusak</span>
                      <span>Kebutuhan</span>
                      <span>Keterangan</span>
                      <span>Aksi</span>
                    </div>

                    <div className="divide-y divide-slate-200 bg-white">
                      {draftRows.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-600">
                          Belum ada data alat. Gunakan tombol `Tambah Alat` untuk menambahkan baris baru.
                        </div>
                      ) : (
                        draftRows.map((row, index) => {
                          const isReferenceRow = !row.isCustom;

                          return (
                            <div
                              key={`edit-modal-row-${index}`}
                              className="grid grid-cols-[84px_minmax(260px,1.05fr)_minmax(240px,0.9fr)_minmax(360px,1.35fr)_minmax(180px,0.7fr)_160px_140px_140px_140px_160px_260px_88px] gap-3 px-4 py-3 align-top"
                            >
                              <p className="pt-2 text-sm font-semibold text-slate-500">{index + 1}</p>
                              <Input
                                value={row.name}
                                onChange={(event) => updateDraftRow(index, "name", event.target.value)}
                                placeholder="Nama alat"
                                readOnly={isReferenceRow}
                                className={isReferenceRow ? "bg-slate-50 text-slate-500" : undefined}
                              />
                              <textarea
                                value={row.functionText}
                                onChange={(event) => updateDraftRow(index, "functionText", event.target.value)}
                                placeholder="Fungsi alat"
                                readOnly={isReferenceRow}
                                className={`min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ${
                                  isReferenceRow
                                    ? "bg-slate-50 text-slate-500"
                                    : "text-slate-900 focus:border-primary"
                                }`}
                              />
                              <textarea
                                value={row.specificationText}
                                onChange={(event) => updateDraftRow(index, "specificationText", event.target.value)}
                                placeholder="Spesifikasi alat"
                                readOnly={isReferenceRow}
                                className={`min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ${
                                  isReferenceRow
                                    ? "bg-slate-50 text-slate-500"
                                    : "text-slate-900 focus:border-primary"
                                }`}
                              />
                              <Input
                                value={row.ratio}
                                onChange={(event) => updateDraftRow(index, "ratio", event.target.value)}
                                placeholder="Rasio"
                                readOnly={isReferenceRow}
                                className={isReferenceRow ? "bg-slate-50 text-slate-500" : undefined}
                              />
                              <select
                                value={row.ownership}
                                onChange={(event) => updateDraftRow(index, "ownership", event.target.value)}
                                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                              >
                                <option value="">Pilih</option>
                                <option value="Ada">Ada</option>
                                <option value="Tidak">Tidak</option>
                              </select>
                              <Input
                                type="number"
                                min="0"
                                value={row.quantity}
                                onChange={(event) => updateDraftRow(index, "quantity", event.target.value)}
                                placeholder="Jumlah"
                                disabled={row.ownership === "Tidak"}
                              />
                              <Input
                                type="number"
                                min="0"
                                value={row.goodCondition}
                                onChange={(event) => updateDraftRow(index, "goodCondition", event.target.value)}
                                placeholder="Jumlah kondisi baik"
                                disabled={row.ownership === "Tidak"}
                              />
                              <Input
                                type="number"
                                min="0"
                                value={row.badCondition}
                                onChange={(event) => updateDraftRow(index, "badCondition", event.target.value)}
                                placeholder="Jumlah kondisi rusak"
                                disabled={row.ownership === "Tidak"}
                              />
                              <Input
                                type="number"
                                min="0"
                                value={row.needed}
                                onChange={(event) => updateDraftRow(index, "needed", event.target.value)}
                                placeholder="Kebutuhan"
                              />
                              <textarea
                                value={row.notes}
                                onChange={(event) => updateDraftRow(index, "notes", event.target.value)}
                                placeholder="Keterangan"
                                className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                              />
                              <div className="flex justify-center pt-1">
                                {row.isCustom ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeDraftRow(index)}
                                    disabled={editModalSaving}
                                    className="text-slate-500 hover:text-danger"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-center text-xs leading-6 text-slate-400">-</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditModal}
                disabled={editModalSaving}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => void saveTableFromModal()}
                disabled={editModalSaving}
                className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20 gap-2"
              >
                {editModalSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editModalSaving ? "Menyimpan..." : "Update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
