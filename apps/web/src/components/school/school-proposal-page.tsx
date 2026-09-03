"use client";

import { Save, RotateCcw, Download, FileDown, Loader2, MessageSquareWarning, NotebookPen, Pencil, Plus, Trash2, CheckCircle2, Clock4, Wrench, Building2, XCircle, RefreshCw, Upload, FileSpreadsheet, Eye, ZoomIn, X, ImageIcon, FileImage, ChevronRight, ChevronDown, ArrowLeft, ClipboardList, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSchoolDetailView } from "@/components/school/school-detail-view-context";
import {
  broadcastPraBimtekSavedForNpsn,
  fetchCachedVerifikasiReviews,
} from "@/lib/school-verifikasi-cache";
import {
  perdirjenEquipmentBidangRequest,
  saveSchoolProposalDataRequest,
  saveSchoolProposalDataRequestRaw,
  schoolPaguDetailRequest,
  schoolProposalDataByNpsnRequest,
  schoolProposalDataRequest,
  schoolProfileByNpsnRequest,
  schoolProfileRequest,
  workspaceBimtekReviewsRequest,
  type PerdirjenEquipmentItem,
  type PerdirjenEquipmentDetailBidang,
  type PerdirjenEquipmentDetailKonsentrasi,
  type SchoolPaguDetail,
  type SchoolProfileRecord,
  type WorkspaceBimtekReviewRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

// #region debug-point global-cards-persist-bug A-D (instrumentasi only — NO BUSINESS LOGIC CHANGE)
function __dbg_report(evt: string, data: Record<string, unknown> = {}) {
  try {
    const payload = JSON.stringify({
      sessionId: "global-cards-persist-bug",
      event: evt,
      ts: Date.now(),
      href: typeof window !== "undefined" ? window.location.href : "",
      ...data,
    });
    if (typeof window !== "undefined" && typeof fetch === "function") {
      void fetch("http://127.0.0.1:7788/event", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(() => {});
    }
  } catch {}
}
// #endregion

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const kategoriOrder = [
  "Peralatan Praktik Utama Kriteria Minimal",
  "Peralatan Praktik Utama Kriteria Pengembangan",
  "Peralatan Praktik Pendukung",
] as const;

const shopConfigs = [
  { key: "shop1", label: "Anggaran Toko 1", headerClass: "bg-rose-100 text-rose-900", emoji: "🛒" },
  { key: "shop2", label: "Anggaran Toko 2", headerClass: "bg-blue-100 text-blue-900", emoji: "🏬" },
  { key: "shop3", label: "Anggaran Toko 3", headerClass: "bg-emerald-100 text-emerald-900", emoji: "🏪" },
] as const;

const proposalTabConfigs = [
  { key: "survey", label: "Survey Harga Pasar" },
  { key: "rpkp", label: "RPKP - Rencana Pemenuhan Kebutuhan Peralatan" },
  { key: "rab", label: "RAB - Rencana Anggaran Belanja" },
] as const;

type KategoriKey = (typeof kategoriOrder)[number];
type ShopKey = (typeof shopConfigs)[number]["key"];
type ProposalTabKey = (typeof proposalTabConfigs)[number]["key"];

type SchoolProposalReference = {
  bidangCode: string;
  bidangName: string;
  programCode: string;
  programName: string;
  concentrationCode: string;
  concentrationName: string;
  detail: PerdirjenEquipmentDetailKonsentrasi;
};

type ShopQuote = {
  name: string;
  priceWithTax: string;
  shippingCost: string;
  installationCost: string;
  totalPrice: string;
  link: string;
  siplahScreenshots: SiplahScreenshot[];
};

type SiplahScreenshot = {
  id: string;
  fileName: string;
  dataUrl: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

type ProposalRow = {
  id: string;
  name: string;
  specification: string;
  conformity: string;
  quantity: string;
  unit: string;
  shop1: ShopQuote;
  shop2: ShopQuote;
  shop3: ShopQuote;
  isEditing: boolean;
};

type PersistedProposalRow = Omit<ProposalRow, "isEditing">;
type PersistedProposalTables = Record<string, PersistedProposalRow[]>;
type PersistedRpkpSelections = Record<string, Partial<Record<string, ShopKey>>>;

const GLOBAL_KEY_BIAYA_PERSIAPAN = "__global_biaya_persiapan_pelaporan";
const GLOBAL_KEY_BIAYA_PELATIHAN = "__global_biaya_pendukung_pelatihan";

type BiayaPersiapanRow = {
  id: string;
  name: string;
  quantity: number;
  sbmSatuanRp: number;
};

type BiayaPelatihanRow = {
  id: string;
  productName: string;
  hargaSatuanRp: number;
  refQtySurvey?: number;
  butuhPelatihan: boolean;
  totalBiayaPelatihanRp: number;
};

const DEFAULT_BIAYA_PERSIAPAN: Omit<BiayaPersiapanRow, "id">[] = [
  { name: "Rapat Koordinasi & Sosialisasi Pengajuan Sarana", quantity: 1, sbmSatuanRp: 0 },
  { name: "Pendataan & Verifikasi Data Alat per Konsentrasi", quantity: 1, sbmSatuanRp: 0 },
  { name: "Penyusunan LPJ 0% & Kelengkapan Dokumen Pra-Bimtek", quantity: 1, sbmSatuanRp: 0 },
  { name: "Penyusunan LPJ 50% / 100% + Pertanggungjawaban Akhir", quantity: 1, sbmSatuanRp: 0 },
];

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

function normalizeParsedEntry(value: unknown): ParsedReviewEntry {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : undefined;
  const note = typeof record.note === "string" ? record.note : undefined;
  return { status, note };
}

function normalizeRecordOfEntries(value: unknown): Record<string, ParsedReviewEntry> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, ParsedReviewEntry> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim()) continue;
    const normalized = normalizeParsedEntry(inner);
    if (normalized.status || normalized.note) result[key] = normalized;
  }
  return result;
}

function parseStructuredReviewNotes(raw: string | null | undefined): StructuredReviewNotes {
  const empty: StructuredReviewNotes = {
    globalNote: "",
    concentrations: {},
    documents: {},
    conditions: {},
    proposals: {},
  };
  if (!raw?.trim()) return empty;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return { ...empty, globalNote: trimmed };
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> & Partial<AlatReviewDetailStructV3>;
    const globalNote =
      typeof parsed.globalNote === "string" && parsed.globalNote.trim() ? parsed.globalNote.trim() : "";
    const concentrations = normalizeRecordOfEntries(parsed.concentrations);
    const documents = normalizeRecordOfEntries(parsed.documents);
    const conditions = normalizeRecordOfEntries(parsed.conditions);
    const proposals = normalizeRecordOfEntries(parsed.proposals);

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

    return { globalNote, concentrations, documents, conditions, proposals };
  } catch {
    return {
      ...empty,
      globalNote: trimmed,
    };
  }
}

function getReviewStatusBadgeStyle(status: string | undefined | null): {
  className: string;
  label: string;
} {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (!normalized) {
    return { className: "border-slate-200 bg-slate-50 text-slate-500", label: "Belum Di Proses" };
  }
  if (["DISETUJUI", "APPROVED", "APPROVE", "PASS", "DITERIMA", "SETUJU", "DAPAT"].includes(normalized)) {
    return { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Disetujui" };
  }
  if (["DITOLAK", "REJECTED", "REJECT", "FAIL", "TIDAK"].includes(normalized)) {
    return { className: "border-rose-200 bg-rose-50 text-rose-700", label: "Ditolak" };
  }
  return { className: "border-amber-200 bg-amber-50 text-amber-700", label: "Setuju dengan Catatan" };
}

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
): SchoolProposalReference | null {
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

function getTableKey(schoolId: string, concentrationCode: string, tabKey: ProposalTabKey) {
  return `${schoolId}::${concentrationCode}::${tabKey}`;
}

function resolveTableKey(
  preferredSchoolId: string,
  concentrationCode: string | undefined,
  tabKey: ProposalTabKey,
  lookupTables: Record<string, unknown> | undefined | null,
): string {
  if (!concentrationCode) return "";
  const preferred = preferredSchoolId ? getTableKey(preferredSchoolId, concentrationCode, tabKey) : "";
  if (preferred && lookupTables && Object.prototype.hasOwnProperty.call(lookupTables, preferred)) {
    return preferred;
  }
  const suffix = `::${concentrationCode}::${tabKey}`;
  if (lookupTables) {
    const existing = Object.keys(lookupTables).find((k) => k.endsWith(suffix));
    if (existing) return existing;
  }
  return preferred;
}

function createRowId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseCurrencyNumber(value: string) {
  const s = String(value ?? "");
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseQuantityNumber(value: string) {
  const s = String(value ?? "");
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function roundToNearestThousand(value: number) {
  return Math.round(value / 1000) * 1000;
}

function formatCurrencyInput(value: string) {
  const amount = parseCurrencyNumber(value);
  return amount > 0 ? amount.toLocaleString("id-ID") : "";
}

function formatQuantityInput(value: string) {
  const amount = parseQuantityNumber(value);
  return amount > 0 ? String(amount) : "";
}

function formatUnitInput(value: string) {
  const s = String(value ?? "");
  return s.replace(/[^A-Za-z\s]/g, "").replace(/\s+/g, " ").trimStart();
}

function findReferenceItemFromConformity(
  selectedReference: SchoolProposalReference | null,
  conformity: string,
): PerdirjenEquipmentItem | null {
  if (!selectedReference || !conformity || conformity === "Alat Tidak Sesuai PERKA") {
    return null;
  }

  for (const kategori of kategoriOrder) {
    const prefix = `${kategori} - `;
    if (conformity.startsWith(prefix)) {
      const name = conformity.slice(prefix.length).trim();
      return selectedReference.detail[kategori].find((item) => item["Nama Alat"] === name) ?? null;
    }
  }

  return null;
}

function createEmptyQuote(): ShopQuote {
  return {
    name: "",
    priceWithTax: "",
    shippingCost: "",
    installationCost: "",
    totalPrice: "",
    link: "",
    siplahScreenshots: [],
  };
}

function recalculateQuote(quote: ShopQuote, quantity: string): ShopQuote {
  const quantityAmount = parseQuantityNumber(quantity);
  const unitPrice =
    parseCurrencyNumber(quote.priceWithTax) +
    parseCurrencyNumber(quote.shippingCost) +
    parseCurrencyNumber(quote.installationCost);
  const totalAmount = unitPrice * quantityAmount;

  return {
    ...quote,
    totalPrice: totalAmount > 0 ? totalAmount.toLocaleString("id-ID") : "",
  };
}

function normalizeQuote(quote: Partial<ShopQuote> | undefined, quantity = "") {
  const rawScreens = (quote as Partial<ShopQuote> | undefined)?.siplahScreenshots;
  return recalculateQuote(
    {
      name: typeof quote?.name === "string" ? quote.name.trim() : "",
      priceWithTax: typeof quote?.priceWithTax === "string" ? formatCurrencyInput(quote.priceWithTax) : "",
      shippingCost: typeof quote?.shippingCost === "string" ? formatCurrencyInput(quote.shippingCost) : "",
      installationCost: typeof quote?.installationCost === "string" ? formatCurrencyInput(quote.installationCost) : "",
      totalPrice: "",
      link: quote?.link?.trim() ?? "",
      siplahScreenshots: normalizeSiplahScreenshots(rawScreens),
    },
    quantity,
  );
}

function createEmptyProposalRow(): ProposalRow {
  return {
    id: createRowId(),
    name: "",
    specification: "",
    conformity: "",
    quantity: "",
    unit: "",
    shop1: createEmptyQuote(),
    shop2: createEmptyQuote(),
    shop3: createEmptyQuote(),
    isEditing: true,
  };
}

function biayaPersiapanRowToPersisted(row: BiayaPersiapanRow): PersistedProposalRow {
  const subtotal = row.quantity * row.sbmSatuanRp;
  return {
    id: row.id,
    name: row.name.trim(),
    specification: `SBM @ Rp ${row.sbmSatuanRp.toLocaleString("id-ID")}`,
    conformity: "BIAYA_PERSIAPAN",
    quantity: String(row.quantity),
    unit: "kali",
    shop1: {
      name: "Biaya SBM",
      priceWithTax: String(row.sbmSatuanRp),
      shippingCost: "0",
      installationCost: "0",
      totalPrice: String(subtotal),
      link: "",
      siplahScreenshots: [],
    },
    shop2: { ...createEmptyQuote() },
    shop3: { ...createEmptyQuote() },
  };
}

function persistedToBiayaPersiapanRow(row: PersistedProposalRow): BiayaPersiapanRow | null {
  if (!row.id || !row.name) return null;
  const qty = parseQuantityNumber(row.quantity);
  const sbm = parseCurrencyNumber(row.shop1?.priceWithTax ?? "0");
  return { id: row.id, name: row.name, quantity: qty > 0 ? qty : 1, sbmSatuanRp: sbm };
}

function biayaPelatihanRowToPersisted(row: BiayaPelatihanRow): PersistedProposalRow {
  const subtotal = row.butuhPelatihan ? Math.round((row.hargaSatuanRp || 0) * 0.015) : 0;
  return {
    id: row.id,
    name: row.productName.trim(),
    specification: row.butuhPelatihan ? "Butuh Pelatihan: YA" : "Butuh Pelatihan: TIDAK",
    conformity: "BIAYA_PELATIHAN",
    quantity: String(row.hargaSatuanRp || 0),
    unit: "rupiah",
    shop1: {
      name: row.butuhPelatihan ? "Butuh Pelatihan: Ya" : "Butuh Pelatihan: Tidak",
      priceWithTax: String(row.hargaSatuanRp || 0),
      shippingCost: "0",
      installationCost: "0",
      totalPrice: String(subtotal),
      link: "",
      siplahScreenshots: [],
    },
    shop2: {
      ...createEmptyQuote(),
      name: "1.5% x Harga Satuan",
      totalPrice: "1.5",
    },
    shop3: {
      ...createEmptyQuote(),
      name: "Total Biaya Pelatihan",
      totalPrice: String(subtotal),
    },
  };
}

function persistedToBiayaPelatihanRow(row: PersistedProposalRow): BiayaPelatihanRow | null {
  if (!row.id || !row.name) return null;
  const hargaSatuan = Math.max(
    0,
    parseCurrencyNumber(row.shop1?.priceWithTax ?? row.quantity ?? "0"),
  );
  const butuh = String(row.shop1?.name ?? "").toLowerCase().includes("ya") || Boolean(row.shop1?.priceWithTax && parseQuantityNumber(row.shop1.priceWithTax) > 0);
  const totalFromPersist = parseCurrencyNumber(row.shop3?.totalPrice ?? row.shop1?.totalPrice ?? "0");
  const qty = parseQuantityNumber(row.quantity);
  const calcTotal = butuh ? Math.round(hargaSatuan * 0.015) : 0;
  return {
    id: row.id,
    productName: row.name,
    hargaSatuanRp: hargaSatuan,
    refQtySurvey: qty > 0 ? qty : 1,
    butuhPelatihan: butuh,
    totalBiayaPelatihanRp: calcTotal > 0 ? calcTotal : totalFromPersist,
  };
}

function normalizeSiplahScreenshots(input: unknown): SiplahScreenshot[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const record = (item ?? {}) as Partial<SiplahScreenshot>;
      if (
        typeof record.dataUrl !== "string" ||
        !record.dataUrl.startsWith("data:image/") ||
        typeof record.fileName !== "string"
      ) {
        return null;
      }
      return {
        id: typeof record.id === "string" && record.id ? record.id : createRowId(),
        fileName: record.fileName,
        dataUrl: record.dataUrl,
        size: typeof record.size === "number" ? record.size : 0,
        mimeType:
          typeof record.mimeType === "string" && record.mimeType.startsWith("image/")
            ? record.mimeType
            : "image/png",
        uploadedAt:
          typeof record.uploadedAt === "string" && record.uploadedAt
            ? record.uploadedAt
            : new Date().toISOString(),
      };
    })
    .filter((x): x is SiplahScreenshot => Boolean(x));
}

function normalizeProposalRow(row: Partial<PersistedProposalRow>): ProposalRow {
  const legacyAny = row as Partial<PersistedProposalRow> & Record<string, unknown>;

  const rowLevelPhotos =
    Array.isArray(legacyAny.photos) && legacyAny.photos.length > 0
      ? legacyAny.photos
      : Array.isArray(legacyAny.siplahScreenshots) && legacyAny.siplahScreenshots.length > 0
        ? legacyAny.siplahScreenshots
        : undefined;
  const rowLevelPrice = legacyAny.price !== undefined && legacyAny.price !== null && String(legacyAny.price).trim() !== ""
    ? String(legacyAny.price)
    : legacyAny.hargaSatuanRp !== undefined && legacyAny.hargaSatuanRp !== null
      ? String(legacyAny.hargaSatuanRp)
      : undefined;
  const rowLevelLink =
    typeof legacyAny.link === "string" && legacyAny.link.trim() ? legacyAny.link.trim() : undefined;
  const rowLevelShopName =
    typeof legacyAny.shopName === "string" && legacyAny.shopName.trim()
      ? legacyAny.shopName.trim()
      : undefined;

  const injectLegacy = (rawQuote: Partial<ShopQuote> | undefined): Partial<ShopQuote> => {
    const out: Partial<ShopQuote> = { ...(rawQuote ?? {}) };
    if (!out.priceWithTax && rowLevelPrice) out.priceWithTax = rowLevelPrice;
    if (!out.link && rowLevelLink) out.link = rowLevelLink;
    if (!out.name && rowLevelShopName) out.name = rowLevelShopName;
    if ((!out.siplahScreenshots || out.siplahScreenshots.length === 0) && rowLevelPhotos) {
      out.siplahScreenshots = rowLevelPhotos as unknown as SiplahScreenshot[];
    }
    return out;
  };

  const quantity = formatQuantityInput(row.quantity ?? String(legacyAny.quantity ?? ""));

  const legacyGlobalScreens = normalizeSiplahScreenshots(rowLevelPhotos);
  const spreadLegacyIfEmpty = (shopQuote: ShopQuote): ShopQuote => {
    if (shopQuote.siplahScreenshots.length > 0 || legacyGlobalScreens.length === 0) return shopQuote;
    return { ...shopQuote, siplahScreenshots: legacyGlobalScreens };
  };
  const s1 = spreadLegacyIfEmpty(normalizeQuote(injectLegacy(row.shop1), quantity));
  const s2 = spreadLegacyIfEmpty(normalizeQuote(injectLegacy(row.shop2), quantity));
  const s3 = spreadLegacyIfEmpty(normalizeQuote(injectLegacy(row.shop3), quantity));

  const finalShop1 = (s1.priceWithTax || s1.siplahScreenshots.length > 0) ? s1 :
    (s2.priceWithTax || s2.siplahScreenshots.length > 0) ? s2 :
    (s3.priceWithTax || s3.siplahScreenshots.length > 0) ? s3 : s1;

  return {
    id: row.id ?? String(legacyAny.id ?? createRowId()),
    name: row.name ?? String(legacyAny.name ?? ""),
    specification: row.specification ?? String(legacyAny.specification ?? ""),
    conformity: row.conformity ?? String(legacyAny.conformity ?? ""),
    quantity,
    unit: formatUnitInput(row.unit ?? String(legacyAny.unit ?? "")),
    shop1: finalShop1,
    shop2: s2,
    shop3: s3,
    isEditing: false,
  };
}

function normalizePersistedTables(payload: Record<string, unknown> | undefined): PersistedProposalTables {
  return Object.fromEntries(
    Object.entries(payload ?? {}).map(([key, rows]) => [
      key,
      Array.isArray(rows)
        ? rows.map((row) => {
            const record = (row ?? {}) as Partial<PersistedProposalRow>;
            return normalizeProposalRow(record);
          })
        : [],
    ]),
  );
}

function normalizePersistedRpkpSelections(payload: Record<string, unknown> | undefined): PersistedRpkpSelections {
  return Object.fromEntries(
    Object.entries(payload ?? {}).map(([tableKey, rowSelections]) => [
      tableKey,
      Object.fromEntries(
        Object.entries((rowSelections ?? {}) as Record<string, string>)
          .filter(([, shopKey]) => shopConfigs.some((item) => item.key === shopKey))
          .map(([rowId, shopKey]) => [rowId, shopKey as ShopKey]),
      ),
    ]),
  ) as PersistedRpkpSelections;
}

type AddModalErrors = {
  banner?: string;
  conformity?: string;
  name?: string;
  specification?: string;
  quantity?: string;
  unit?: string;
  shops?: Partial<
    Record<
      ShopKey,
      {
        name?: string;
        priceWithTax?: string;
        shippingCost?: string;
        installationCost?: string;
        link?: string;
      }
    >
  >;
};

function isValidUrl(value: string): boolean {
  if (!value || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateAddProposalDraft(draft: ProposalRow): AddModalErrors {
  const errors: AddModalErrors = { shops: {} };
  if (!draft.conformity.trim()) {
    errors.conformity = "Pilih salah satu alat kesesuaian (Kesesuaian wajib diisi).";
  }
  if (!draft.name.trim()) {
    errors.name = "Nama alat wajib diisi.";
  }
  if (!draft.specification.trim()) {
    errors.specification = "Spesifikasi alat wajib diisi.";
  }
  const quantityAmount = parseQuantityNumber(draft.quantity);
  if (!quantityAmount || quantityAmount <= 0) {
    errors.quantity = "Jumlah wajib diisi dengan angka (lebih besar dari 0).";
  }
  if (!draft.unit.trim()) {
    errors.unit = "Satuan wajib diisi (contoh: Unit, Paket, Buah).";
  }

  for (const shop of shopConfigs) {
    const quote = draft[shop.key];
    const shopErrors: NonNullable<AddModalErrors["shops"]>[ShopKey] = {};
    if (!quote.name.trim()) {
      shopErrors.name = `Nama ${shop.label} wajib diisi.`;
    }
    const priceAmount = parseCurrencyNumber(quote.priceWithTax);
    if (!priceAmount || priceAmount <= 0) {
      shopErrors.priceWithTax = "Harga wajib diisi dengan angka (lebih besar dari 0).";
    } else if (!Number.isFinite(priceAmount)) {
      shopErrors.priceWithTax = "Harga harus angka yang valid.";
    }
    const shippingAmount = parseCurrencyNumber(quote.shippingCost);
    if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
      shopErrors.shippingCost = "Biaya kirim wajib diisi dengan angka (boleh 0).";
    }
    const installAmount = parseCurrencyNumber(quote.installationCost);
    if (!Number.isFinite(installAmount) || installAmount < 0) {
      shopErrors.installationCost = "Biaya instalasi wajib diisi dengan angka (boleh 0).";
    }
    if (!isValidUrl(quote.link)) {
      shopErrors.link = "Link wajib diisi dengan URL valid (mulai dengan http:// atau https://).";
    }
    if (Object.keys(shopErrors).length > 0) {
      errors.shops![shop.key] = shopErrors;
    }
  }

  const countShopErrors = Object.values(errors.shops ?? {}).reduce(
    (sum, shop) => sum + Object.keys(shop ?? {}).length,
    0,
  );
  const countFieldErrors =
    (errors.conformity ? 1 : 0) +
    (errors.name ? 1 : 0) +
    (errors.specification ? 1 : 0) +
    (errors.quantity ? 1 : 0) +
    (errors.unit ? 1 : 0);
  const total = countFieldErrors + countShopErrors;
  if (total > 0) {
    errors.banner = `Verifikasi GAGAL: Pastikan Nama Alat dan Jumlah benar, serta Toko 1, Toko 2, dan Toko 3 sudah SEMUA terisi (Nama Toko, Harga + Pajak > 0, Link toko URL valid). Total ${total} kesalahan.`;
  }
  return errors;
}

export function SchoolProposalPage({
  forceActiveTab,
  hideTopTabBar = false,
  exclusiveMode,
}: {
  forceActiveTab?: ProposalTabKey;
  hideTopTabBar?: boolean;
  exclusiveMode?: "survey" | "rpkp";
}) {
  const { hydrate, hydrated, session } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailView = useSchoolDetailView();
  const overrideNpsn = detailView?.npsn ?? null;
  const isViewMode = Boolean(overrideNpsn) && detailView?.role !== "SEKOLAH";
  const token = session?.token ?? "";
  const hasToken = Boolean(token.trim());
  const baseProposalRoute = overrideNpsn
    ? `/sekolah/pengajuan/${encodeURIComponent(String(overrideNpsn))}`
    : "/sekolah/pengajuan";

  const pagu = useQuery<SchoolPaguDetail | null>({
    queryKey: ["paguDetailProposal", overrideNpsn || "me"],
    queryFn: async (): Promise<SchoolPaguDetail | null> => {
      if (!hasToken) return null;
      try {
        if (overrideNpsn) {
          return await schoolPaguDetailRequest(token, String(overrideNpsn).trim());
        }
        return await schoolPaguDetailRequest(token);
      } catch {
        return null;
      }
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [references, setReferences] = useState<SchoolProposalReference[]>([]);
  const [missingCodes, setMissingCodes] = useState<string[]>([]);
  const [persistedTables, setPersistedTables] = useState<PersistedProposalTables>({});
  const [draftTables, setDraftTables] = useState<Record<string, ProposalRow[]>>({});
  const draftTablesRef = useRef<Record<string, ProposalRow[]>>({});
  const [persistedRpkpSelections, setPersistedRpkpSelections] = useState<PersistedRpkpSelections>({});
  const [draftRpkpSelections, setDraftRpkpSelections] = useState<PersistedRpkpSelections>({});
  const draftRpkpSelectionsRef = useRef<PersistedRpkpSelections>({});
  const [dirtyRpkpRows, setDirtyRpkpRows] = useState<Set<string>>(new Set());
  const dirtyRpkpRowsRef = useRef<Set<string>>(new Set());
  const [rpkpRowSaving, setRpkpRowSaving] = useState<string | null>(null);
  const [card2DirtyRowIds, setCard2DirtyRowIds] = useState<Set<string>>(new Set());
  const card2DirtyRowIdsRef = useRef<Set<string>>(new Set());
  const [selectedConcentrationCode, setSelectedConcentrationCode] = useState("");
  const [hydratedGlobalCards, setHydratedGlobalCards] = useState(false);
  const [card1BiayaPersiapan, setCard1BiayaPersiapan] = useState<BiayaPersiapanRow[]>(() =>
    DEFAULT_BIAYA_PERSIAPAN.map((r) => ({ ...r, id: createRowId() })),
  );
  const [card2BiayaPelatihan, setCard2BiayaPelatihan] = useState<BiayaPelatihanRow[]>([]);
  type ProposalViewMode = "list" | "survey" | "rpkp" | "rab-kk" | "rab-global";
  const [viewMode, setViewMode] = useState<ProposalViewMode>(
    forceActiveTab ? (forceActiveTab === "rpkp" ? "rpkp" : forceActiveTab === "rab" ? "rab-global" : "survey") : "list",
  );
  const [activeProposalTab, setActiveProposalTab] = useState<ProposalTabKey>(forceActiveTab ?? "survey");

  useEffect(() => {
    const effectiveTab = exclusiveMode === "survey" ? "survey" : exclusiveMode === "rpkp" ? "rpkp" : forceActiveTab;
    if (effectiveTab) {
      setActiveProposalTab(effectiveTab);
      if (effectiveTab === "rpkp") setViewMode("rpkp");
      else if (effectiveTab === "rab") setViewMode("rab-global");
      else setViewMode("survey");
    }
    const allKkWithCode = profile?.concentrations?.filter((kk) => Boolean(kk && kk.code)) ?? [];
    const kkFromUrl = searchParams?.get("kk") ?? "";
    if (allKkWithCode.length > 0) {
      const fromUrl = kkFromUrl && allKkWithCode.some((c) => c.code === kkFromUrl) ? kkFromUrl : "";
      const fallback = allKkWithCode.some((c) => c.code === selectedConcentrationCode) ? selectedConcentrationCode : allKkWithCode[0].code;
      const next = fromUrl || fallback;
      if (next !== selectedConcentrationCode) {
        setSelectedConcentrationCode(next);
      }
    }
  }, [exclusiveMode, forceActiveTab, profile?.concentrations, searchParams, selectedConcentrationCode]);

  const totalCardBiayaPersiapan = useMemo(
    () => card1BiayaPersiapan.reduce((sum, r) => sum + r.quantity * r.sbmSatuanRp, 0),
    [card1BiayaPersiapan],
  );
  const totalCardBiayaPelatihan = useMemo(
    () =>
      card2BiayaPelatihan.reduce(
        (sum, r) => sum + (r.butuhPelatihan ? r.totalBiayaPelatihanRp : 0),
        0,
      ),
    [card2BiayaPelatihan],
  );

  useEffect(() => {
    if (hydratedGlobalCards) return;
    if (!profile) return;
    const hasAnyPersistedKeys = typeof persistedTables === "object" && persistedTables !== null && Object.keys(persistedTables).length > 0;
    const hasPersisted =
      Array.isArray(persistedTables[GLOBAL_KEY_BIAYA_PERSIAPAN]) ||
      Array.isArray(persistedTables[GLOBAL_KEY_BIAYA_PELATIHAN]);
    // #region debug-point global-cards-persist-bug POINT-A: hydrate guard check
    __dbg_report("HYDRATE_GUARD_CHECK", {
      schoolNpsn: profile.npsn || null,
      schoolName: profile.schoolName || "",
      hasProfile: Boolean(profile),
      hasAnyPersistedKeys: Boolean(hasAnyPersistedKeys),
      hasGlobalPersisted: Boolean(hasPersisted),
      persistedKeys: typeof persistedTables === "object" && persistedTables !== null ? Object.keys(persistedTables).slice(0, 30) : [],
      card1InitialLen: Number(card1BiayaPersiapan.length),
      card2InitialLen: Number(card2BiayaPelatihan.length),
    });
    // #endregion
    if (!hasAnyPersistedKeys && !hasPersisted) return;
    const persisted1 = persistedTables[GLOBAL_KEY_BIAYA_PERSIAPAN] ?? [];
    if (persisted1.length) {
      const parsed = persisted1
        .map(persistedToBiayaPersiapanRow)
        .filter((r): r is BiayaPersiapanRow => r !== null);
      if (parsed.length) setCard1BiayaPersiapan(parsed);
    }
    const persisted2 = persistedTables[GLOBAL_KEY_BIAYA_PELATIHAN] ?? [];
    if (persisted2.length) {
      const parsed = persisted2
        .map(persistedToBiayaPelatihanRow)
        .filter((r): r is BiayaPelatihanRow => r !== null);
      if (parsed.length) setCard2BiayaPelatihan(parsed);
    }
    // #region debug-point global-cards-persist-bug POINT-A2: hydrate applied summary
    __dbg_report("HYDRATE_APPLIED", {
      schoolNpsn: profile.npsn || null,
      persisted1Len: Number(persisted1?.length ?? 0),
      persisted2Len: Number(persisted2?.length ?? 0),
      card1AfterLen: Number(card1BiayaPersiapan.length),
      card2AfterLen: Number(card2BiayaPelatihan.length),
    });
    // #endregion
    setHydratedGlobalCards(true);
  }, [hydratedGlobalCards, persistedTables, profile]);

  useEffect(() => {
    if (!hydratedGlobalCards) return;
    if (card2BiayaPelatihan.length > 0) return;
    if (!profile) return;
    type ProductAgg = { name: string; qty: number; rpkpSelectedPriceRp: number };
    const uniqueProducts = new Map<string, ProductAgg>();
    const rekomendasiKk = profile.concentrations.filter((kk) => kk.isAdminRecommendation === true);
    const kkSchoolId =
      isViewMode ? profile.schoolId : (session?.user?.id as string | undefined)?.trim() ?? profile.schoolId;
    for (const kk of rekomendasiKk) {
      const surveyKey = resolveTableKey(kkSchoolId, kk.code, "survey", { ...draftTables, ...persistedTables });
      const rpkpKey = resolveTableKey(kkSchoolId, kk.code, "rpkp", { ...draftRpkpSelections, ...persistedRpkpSelections });
      const rows = draftTables[surveyKey] ?? persistedTables[surveyKey] ?? [];
      const selMap =
        (draftRpkpSelections && draftRpkpSelections[rpkpKey]) ||
        (persistedRpkpSelections && persistedRpkpSelections[rpkpKey]) ||
        ({} as Record<string, ShopKey>);
      for (const row of rows) {
        const qty = parseQuantityNumber(row.quantity);
        if (qty <= 0) continue;
        const name = row.name?.trim();
        if (!name) continue;
        let unitPrice = 0;
        const rawSel = selMap ? selMap[row.id] : undefined;
        const shopSel: ShopKey | "" =
          rawSel === "shop1" || rawSel === "shop2" || rawSel === "shop3" ? rawSel : "";
        if (shopSel) {
          const quote = row[shopSel];
          if (quote) {
            unitPrice =
              parseCurrencyNumber(quote.priceWithTax) +
              parseCurrencyNumber(quote.shippingCost) +
              parseCurrencyNumber(quote.installationCost);
          }
        }
        const key = name.toLowerCase();
        const existing = uniqueProducts.get(key);
        if (existing) {
          existing.qty += qty;
          if (unitPrice > 0 && (existing.rpkpSelectedPriceRp === 0 || unitPrice < existing.rpkpSelectedPriceRp)) {
            existing.rpkpSelectedPriceRp = unitPrice;
          }
        } else {
          uniqueProducts.set(key, { name, qty, rpkpSelectedPriceRp: unitPrice });
        }
      }
    }
    if (uniqueProducts.size === 0) return;
    const initialRows: BiayaPelatihanRow[] = Array.from(uniqueProducts.values()).map((p) => {
      const hargaSatuan = p.rpkpSelectedPriceRp || 0;
      const total = Math.round(hargaSatuan * 0.015);
      return {
        id: createRowId(),
        productName: p.name,
        hargaSatuanRp: hargaSatuan,
        refQtySurvey: p.qty > 0 ? p.qty : 1,
        butuhPelatihan: true,
        totalBiayaPelatihanRp: total,
      };
    });
    setCard2BiayaPelatihan(initialRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratedGlobalCards, profile, draftTables, persistedTables, draftRpkpSelections, persistedRpkpSelections]);

  useEffect(() => {
    if (!hydratedGlobalCards) return;
    setDraftTables((current) => {
      const next: Record<string, ProposalRow[]> = { ...current };
      const adaptP = card1BiayaPersiapan.map<ProposalRow>((r) => {
        const p = biayaPersiapanRowToPersisted(r);
        return { ...p, isEditing: false };
      });
      next[GLOBAL_KEY_BIAYA_PERSIAPAN] = adaptP;
      const adaptL = card2BiayaPelatihan.map<ProposalRow>((r) => {
        const p = biayaPelatihanRowToPersisted(r);
        return { ...p, isEditing: false };
      });
      next[GLOBAL_KEY_BIAYA_PELATIHAN] = adaptL;
      draftTablesRef.current = next;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card1BiayaPersiapan, card2BiayaPelatihan, hydratedGlobalCards]);

  function findKkMeta(code: string) {
    const found = profile?.concentrations.find((c) => c.code === code);
    return found ? { code: found.code, name: found.name } : null;
  }
  function openSurveyForKk(code: string) {
    setSelectedConcentrationCode(code);
    void router.push(`${baseProposalRoute}/surveyharga`);
  }
  function openRpkpForKk(code: string) {
    setSelectedConcentrationCode(code);
    void router.push(`${baseProposalRoute}/rpkp`);
  }
  function openRabForKk(code: string) {
    setSelectedConcentrationCode(code);
    setExpandedRabCodes(new Set([code]));
    setViewMode("rab-kk");
  }
  function openRabGlobal() {
    setExpandedRabCodes(new Set(concentrationRows.slice(0, 2).map((c) => c.code)));
    setViewMode("rab-global");
  }
  function backToList() {
    setViewMode("list");
  }

  function handleCard1RowUpdate(id: string, patch: Partial<BiayaPersiapanRow>) {
    if (isViewMode) return;
    setCard1BiayaPersiapan((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setCard1Dirty(true);
  }
  function handleCard1RowDelete(id: string) {
    if (isViewMode) return;
    if (!window.confirm("Hapus baris kegiatan ini dari Biaya Persiapan & Pelaporan?")) return;
    setCard1BiayaPersiapan((prev) => prev.filter((r) => r.id !== id));
    setCard1Dirty(true);
  }
  function handleCard1AddRow() {
    if (isViewMode) return;
    setCard1BiayaPersiapan((prev) => [
      ...prev,
      { id: createRowId(), name: "Kegiatan tambahan", quantity: 1, sbmSatuanRp: 0 },
    ]);
    setCard1Dirty(true);
  }
  function markCard2RowDirty(id: string) {
    setCard2DirtyRowIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      card2DirtyRowIdsRef.current = next;
      return next;
    });
  }
  function clearCard2AllDirty() {
    setCard2DirtyRowIds(new Set());
    card2DirtyRowIdsRef.current = new Set();
  }
  function handleCard2RowUpdate(id: string, patch: Partial<BiayaPelatihanRow>) {
    if (isViewMode) return;
    setCard2BiayaPelatihan((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const merged: BiayaPelatihanRow = { ...r, ...patch };
        const autoTotal = merged.butuhPelatihan
          ? Math.round((merged.hargaSatuanRp || 0) * 0.015)
          : 0;
        merged.totalBiayaPelatihanRp = autoTotal;
        return merged;
      }),
    );
    markCard2RowDirty(id);
    setCard2Dirty(true);
  }
  function handleCard2RowDelete(id: string) {
    if (isViewMode) return;
    if (!window.confirm("Hapus baris item pelatihan ini?")) return;
    setCard2BiayaPelatihan((prev) => prev.filter((r) => r.id !== id));
    markCard2RowDirty(id);
    setCard2Dirty(true);
  }
  function handleCard2AddRow() {
    if (isViewMode) return;
    const newId = createRowId();
    setCard2BiayaPelatihan((prev) => [
      ...prev,
      { id: newId, productName: "", hargaSatuanRp: 0, butuhPelatihan: false, totalBiayaPelatihanRp: 0 },
    ]);
    markCard2RowDirty(newId);
    setCard2Dirty(true);
  }

  async function handleFlushSaveCards(which: "card1" | "card2" | "both") {
    if (isViewMode) return;
    if (!token) return;
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const c1 = which === "card1" || which === "both";
    const c2 = which === "card2" || which === "both";
    if (c1) setCard1Saving(true);
    if (c2) setCard2Saving(true);
    try {
      await saveCurrentTable();
      setTableMessages((prev) => {
        const next = { ...prev };
        if (c1) {
          next[GLOBAL_KEY_BIAYA_PERSIAPAN] = {
            type: "success",
            text: "✓ Biaya Persiapan & Pelaporan berhasil tersimpan ke database.",
          };
          setCard1Dirty(false);
        }
        if (c2) {
          next[GLOBAL_KEY_BIAYA_PELATIHAN] = {
            type: "success",
            text: "✓ Biaya Pendukung Uji Fungsi & Pelatihan berhasil tersimpan ke database.",
          };
          setCard2Dirty(false);
          clearCard2AllDirty();
        }
        return next;
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan ke database.";
      setTableMessages((prev) => {
        const next = { ...prev };
        if (c1) {
          next[GLOBAL_KEY_BIAYA_PERSIAPAN] = {
            type: "error",
            text: `✗ Gagal tersimpan ke database: ${message}`,
          };
        }
        if (c2) {
          next[GLOBAL_KEY_BIAYA_PELATIHAN] = {
            type: "error",
            text: `✗ Gagal tersimpan ke database: ${message}`,
          };
        }
        return next;
      });
    } finally {
      if (c1) setCard1Saving(false);
      if (c2) setCard2Saving(false);
    }
  }
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProposalDraft, setNewProposalDraft] = useState<ProposalRow>(() => createEmptyProposalRow());
  const [addModalErrors, setAddModalErrors] = useState<AddModalErrors>({});
  const [autoFillFromConformity, setAutoFillFromConformity] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDraftRow, setEditDraftRow] = useState<ProposalRow | null>(null);
  const [editModalErrors, setEditModalErrors] = useState<AddModalErrors>({});
  const [editAutoFillFromConformity, setEditAutoFillFromConformity] = useState(false);
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [addModalSaving, setAddModalSaving] = useState(false);
  const [addModalActiveShop, setAddModalActiveShop] = useState<ShopKey>("shop1");
  const [editModalActiveShop, setEditModalActiveShop] = useState<ShopKey>("shop1");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveLockRef = useRef<string>("");
  const [tableMessages, setTableMessages] = useState<
    Record<string, { type: "success" | "error"; text: string } | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifikasiReview, setVerifikasiReview] = useState<WorkspaceVerifikasiOnlineRecord | null | undefined>(
    undefined,
  );
  const [bimtekReview, setBimtekReview] = useState<WorkspaceBimtekReviewRecord | null | undefined>(undefined);
  const [refreshingVerifikasi, setRefreshingVerifikasi] = useState(true);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [siplahPreviewState, setSiplahPreviewState] = useState<{ url: string; title: string } | null>(null);
  const [specPreviewState, setSpecPreviewState] = useState<{ title: string; text: string; conformity?: string; quantity?: string; unit?: string; functionText?: string } | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ rowId: string; rowName: string } | null>(null);
  const [surveyActiveShopByRow, setSurveyActiveShopByRow] = useState<Record<string, ShopKey>>({});
  const [card1Saving, setCard1Saving] = useState(false);
  const [card2Saving, setCard2Saving] = useState(false);
  const [card1Dirty, setCard1Dirty] = useState(false);
  const [card2Dirty, setCard2Dirty] = useState(false);
  const surveyScrollSyncRef = useRef<{ top: HTMLDivElement | null; bottom: HTMLDivElement | null }>({ top: null, bottom: null });
  useEffect(() => {
    let cancelRaf = 0;
    const doSync = () => {
      const { top, bottom } = surveyScrollSyncRef.current;
      if (!top || !bottom) return;
      try {
        if (top.scrollWidth > 0 && top.scrollWidth !== bottom.scrollWidth) {
          const inner = top.firstElementChild as HTMLElement | null;
          if (inner) inner.style.width = `${bottom.scrollWidth}px`;
        }
      } catch (_) {}
      const syncTop = () => {
        const t = surveyScrollSyncRef.current.top;
        const b = surveyScrollSyncRef.current.bottom;
        if (!t || !b) return;
        if (Math.abs(t.scrollLeft - b.scrollLeft) > 1) t.scrollLeft = b.scrollLeft;
      };
      const syncBot = () => {
        const t = surveyScrollSyncRef.current.top;
        const b = surveyScrollSyncRef.current.bottom;
        if (!t || !b) return;
        if (Math.abs(b.scrollLeft - t.scrollLeft) > 1) b.scrollLeft = t.scrollLeft;
      };
      (top as any)._syncTop = syncTop;
      (top as any)._syncBot = syncBot;
      (bottom as any)._syncTop = syncTop;
      (bottom as any)._syncBot = syncBot;
      top.addEventListener("scroll", syncBot);
      bottom.addEventListener("scroll", syncTop);
      cancelRaf = window.requestAnimationFrame(() => {
        const t = surveyScrollSyncRef.current.top;
        const b = surveyScrollSyncRef.current.bottom;
        if (!t || !b) return;
        const inner = t.firstElementChild as HTMLElement | null;
        if (inner && b.scrollWidth > 0) inner.style.width = `${b.scrollWidth}px`;
        syncTop();
      });
    };
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(doSync, 10);
    let timer2: ReturnType<typeof setTimeout> | null = setTimeout(doSync, 120);
    return () => {
      if (timer) clearTimeout(timer);
      if (timer2) clearTimeout(timer2);
      if (cancelRaf) cancelAnimationFrame(cancelRaf);
      const { top, bottom } = surveyScrollSyncRef.current;
      if (top) {
        top.removeEventListener("scroll", (top as any)._syncBot);
        top.removeEventListener("scroll", (top as any)._syncBotB);
      }
      if (bottom) {
        bottom.removeEventListener("scroll", (bottom as any)._syncTop);
        bottom.removeEventListener("scroll", (bottom as any)._syncTopB);
      }
    };
  }, [viewMode, selectedConcentrationCode]);
  const [expandedRabCodes, setExpandedRabCodes] = useState<Set<string>>(new Set());
  const MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024;
  const MAX_PHOTOS_PER_SHOP = 1;
  const MAX_PAYLOAD_BYTES_HARD = 190 * 1024 * 1024;
  const MAX_PAYLOAD_BYTES_SOFT = 160 * 1024 * 1024;
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file gambar."));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });

  async function compressImageToDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string; size: number; fileName: string }> {
    const rawDataUrl = await fileToDataUrl(file);
    if (!file.type.startsWith("image/")) {
      return {
        dataUrl: rawDataUrl,
        mimeType: file.type || "image/png",
        size: file.size,
        fileName: file.name,
      };
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onerror = () =>
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png", size: file.size, fileName: file.name });
      img.onload = () => {
        const maxWidth = 1280;
        const maxHeight = 960;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png", size: file.size, fileName: file.name });
          return;
        }
        const outMime = "image/jpeg";
        const quality = 0.72;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let outDataUrl = canvas.toDataURL(outMime, quality);
        const base64Len = outDataUrl.length - (outDataUrl.indexOf(",") + 1);
        const approxBytes = Math.round((base64Len * 3) / 4);
        if (approxBytes > file.size && file.type === "image/jpeg") {
          outDataUrl = rawDataUrl;
          resolve({
            dataUrl: rawDataUrl,
            mimeType: file.type || "image/png",
            size: file.size,
            fileName: file.name,
          });
          return;
        }
        const finalName = /\.(jpe?g)$/i.test(file.name) ? file.name : `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
        resolve({
          dataUrl: outDataUrl,
          mimeType: outMime,
          size: approxBytes,
          fileName: finalName,
        });
      };
      img.src = rawDataUrl;
    });
  }

  function currentDraftTotalPayloadBytes(): number {
    const tables = draftTablesRef.current ?? {};
    const rpkp = draftRpkpSelectionsRef.current ?? {};
    return new Blob([JSON.stringify({ proposalTables: tables, rpkpSelections: rpkp })]).size;
  }

  async function handlePickSiplahScreenshots(
    files: FileList | File[] | null,
    target: { kind: "proposalModal" | "editModal" | "table"; shopKey: ShopKey; rowId?: string },
  ) {
    const fileList = Array.from(files ?? []);
    if (!fileList.length) return;
    const maxMb = 5;
    const imageOnly = fileList.filter((f) => f.type.startsWith("image/"));
    if (imageOnly.length !== fileList.length) {
      const skipped = fileList.length - imageOnly.length;
      window.alert(
        skipped > 1
          ? `${skipped} file non-gambar dilewati. Hanya format gambar JPG/JPEG/PNG/WebP/GIF yang bisa dipilih.`
          : "File yang dipilih bukan gambar. Hanya format gambar JPG/JPEG/PNG/WebP/GIF yang bisa dipilih.",
      );
    }
    if (!imageOnly.length) return;
    const oversized = imageOnly.some((f) => f.size > MAX_BYTES_PER_IMAGE);
    if (oversized) {
      window.alert(`Maksimal ukuran file screenshot adalah ${maxMb} MB per gambar.`);
      return;
    }
    const currentExisting =
      target.kind === "proposalModal"
        ? newProposalDraft[target.shopKey].siplahScreenshots.length
        : target.kind === "editModal"
          ? editDraftRow?.[target.shopKey].siplahScreenshots.length ?? 0
          : target.rowId
            ? draftTablesRef.current[getTabTableKey("survey")]?.find((r) => r.id === target.rowId)?.[target.shopKey]
                .siplahScreenshots.length ?? 0
            : 0;
    if (currentExisting + imageOnly.length > MAX_PHOTOS_PER_SHOP) {
      window.alert(
        MAX_PHOTOS_PER_SHOP === 1
          ? `Hanya diizinkan 1 (satu) foto screenshot SIPLAH per toko per alat. Hapus foto lama terlebih dahulu sebelum menambahkan foto baru.`
          : `Maksimal ${MAX_PHOTOS_PER_SHOP} foto screenshot SIPLAH per toko per alat. Saat ini sudah ${currentExisting} foto.`,
      );
      return;
    }
    const added: SiplahScreenshot[] = [];
    for (const f of imageOnly) {
      try {
        const compressed = await compressImageToDataUrl(f);
        added.push({
          id: createRowId(),
          fileName: compressed.fileName,
          dataUrl: compressed.dataUrl,
          size: compressed.size,
          mimeType: compressed.mimeType,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        /* skip */
      }
    }
    if (!added.length) return;
    const softBytesBefore = currentDraftTotalPayloadBytes();
    if (target.kind === "proposalModal") {
      const shopKey = target.shopKey;
      setNewProposalDraft((prev) => {
        const shopDraft = prev[shopKey];
        return {
          ...prev,
          [shopKey]: {
            ...shopDraft,
            siplahScreenshots: [...shopDraft.siplahScreenshots, ...added],
          },
        } as unknown as ProposalRow;
      });
    } else if (target.kind === "editModal") {
      const shopKey = target.shopKey;
      setEditDraftRow((prev) => {
        if (!prev) return prev;
        const shopDraft = prev[shopKey];
        return {
          ...prev,
          [shopKey]: {
            ...shopDraft,
            siplahScreenshots: [...shopDraft.siplahScreenshots, ...added],
          },
        } as unknown as ProposalRow;
      });
    } else if (target.kind === "table" && target.rowId) {
      const rowId = target.rowId;
      const shopKey = target.shopKey;
      updateProposalRow(rowId, (row) => {
        const nextShop = row[shopKey];
        return {
          ...row,
          [shopKey]: {
            ...nextShop,
            siplahScreenshots: [...nextShop.siplahScreenshots, ...added],
          },
        } as unknown as ProposalRow;
      });
    }
  }

  function removeSiplahScreenshot(
    ssId: string,
    target: { kind: "proposalModal" | "editModal" | "table"; shopKey: ShopKey; rowId?: string },
  ) {
    if (target.kind === "table" && target.rowId) {
      const rowId = target.rowId;
      const shopKey = target.shopKey;
      updateProposalRow(rowId, (row) => {
        const nextShop = row[shopKey];
        return {
          ...row,
          [shopKey]: {
            ...nextShop,
            siplahScreenshots: nextShop.siplahScreenshots.filter((s) => s.id !== ssId),
          },
        } as unknown as ProposalRow;
      });
    } else if (target.kind === "editModal") {
      const shopKey = target.shopKey;
      setEditDraftRow((prev) => {
        if (!prev) return prev;
        const shopDraft = prev[shopKey];
        return {
          ...prev,
          [shopKey]: {
            ...shopDraft,
            siplahScreenshots: shopDraft.siplahScreenshots.filter((s) => s.id !== ssId),
          },
        } as unknown as ProposalRow;
      });
    } else if (target.kind === "proposalModal") {
      const shopKey = target.shopKey;
      setNewProposalDraft((prev) => {
        const shopDraft = prev[shopKey];
        return {
          ...prev,
          [shopKey]: {
            ...shopDraft,
            siplahScreenshots: shopDraft.siplahScreenshots.filter((s) => s.id !== ssId),
          },
        } as unknown as ProposalRow;
      });
    }
  }

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
        const proposalPromise = overrideNpsn
          ? schoolProposalDataByNpsnRequest(token, overrideNpsn)
          : schoolProposalDataRequest(token);
        const [schoolProfile, proposalData] = await Promise.all([
          profilePromise,
          proposalPromise,
        ]);
        if (cancelled) {
          return;
        }

        void (async () => {
          try {
            if (!schoolProfile.npsn) return;
            const rows = await fetchCachedVerifikasiReviews(token, { schoolNpsn: schoolProfile.npsn });
            if (!cancelled) setVerifikasiReview(rows[0] ?? null);
            const bimtekRows = await workspaceBimtekReviewsRequest(token);
            const matchedBimtek = bimtekRows.find(r => r.schoolNpsn === schoolProfile.npsn) ?? null;
            if (!cancelled) setBimtekReview(matchedBimtek);
          } catch {
            if (!cancelled) {
              setVerifikasiReview(null);
              setBimtekReview(null);
            }
          } finally {
            if (!cancelled) setRefreshingVerifikasi(false);
          }
        })();

        const allKkWithCode = [...schoolProfile.concentrations].filter((kk) => Boolean(kk && kk.code));
        const sortedConcentrations = [...allKkWithCode].sort((left, right) =>
          compareConcentrationCode(left.code, right.code),
        );
        const bidangCodes = [...new Set(sortedConcentrations.map((item) => item.code.split(".")[0]).filter(Boolean))];
        const bidangDetails = await Promise.all(
          bidangCodes.map(async (code) => [code, await perdirjenEquipmentBidangRequest(code)] as const),
        );

        if (cancelled) {
          return;
        }

        const bidangMap = Object.fromEntries(bidangDetails);
        const nextReferences: SchoolProposalReference[] = [];
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
        const nextPersisted = normalizePersistedTables(proposalData.proposalTables);
        const nextRpkpSelections = normalizePersistedRpkpSelections(proposalData.rpkpSelections);
        setPersistedTables(nextPersisted);
        setDraftTables((current) => {
          const updated = Object.fromEntries(
            Object.entries(nextPersisted).map(([key, rows]) => [key, rows.map((row) => normalizeProposalRow(row))]),
          );
          draftTablesRef.current = updated;
          return updated;
        });
        setPersistedRpkpSelections(nextRpkpSelections);
        setDraftRpkpSelections((current) => {
          draftRpkpSelectionsRef.current = nextRpkpSelections;
          return nextRpkpSelections;
        });
        setSelectedConcentrationCode((current) =>
          current && sortedConcentrations.some((item) => item.code === current)
            ? current
            : (sortedConcentrations[0]?.code ?? ""),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data pengajuan sekolah.");
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

  const selectedReference = useMemo(
    () => references.find((item) => item.concentrationCode === selectedConcentrationCode) ?? null,
    [references, selectedConcentrationCode],
  );

  const activeProposalTabConfig = proposalTabConfigs.find((item) => item.key === activeProposalTab) ?? proposalTabConfigs[0];
  const keySchoolId =
    isViewMode
      ? profile?.schoolId ?? ""
      : (session?.user?.id as string | undefined)?.trim() ?? profile?.schoolId ?? "";
  const surveyTableKey = resolveTableKey(keySchoolId, selectedConcentrationCode, "survey", draftTables);
  const rpkpTableKey = resolveTableKey(keySchoolId, selectedConcentrationCode, "rpkp", draftTables);
  const rabTableKey = resolveTableKey(keySchoolId, selectedConcentrationCode, "rab", draftTables);
  const currentTableKey =
    viewMode.startsWith("rab")
      ? rabTableKey
      : viewMode === "rpkp"
        ? rpkpTableKey
        : surveyTableKey;
  const activeMessageKey = viewMode === "rpkp" ? rpkpTableKey : currentTableKey;
  const currentRows = currentTableKey ? draftTables[currentTableKey] ?? [] : [];
  const surveyRows = surveyTableKey ? draftTables[surveyTableKey] ?? [] : [];
  const currentRpkpSelections = rpkpTableKey ? draftRpkpSelections[rpkpTableKey] ?? {} : {};
  const currentMessage = activeMessageKey ? tableMessages[activeMessageKey] : undefined;

  const conformityGroups = useMemo(() => {
    if (!selectedReference) {
      return [];
    }

    return kategoriOrder
      .map((kategori) => ({
        label: kategori,
        options: selectedReference.detail[kategori]
          .map((item) => item["Nama Alat"] ?? "")
          .filter((item) => Boolean(item)),
      }))
      .filter((group) => group.options.length > 0);
  }, [selectedReference]);

  const concentrationRows = useMemo(() => {
    if (!profile) {
      return [];
    }

    // ⚡ RULE 2: HANYA KONSENTRASI YANG DIREKOMENDASIKAN DINAS
    // (isAdminRecommendation === true) yang BOLEH tampil di alur Survey Harga,
    // RPKP, list summary proposal & tab selector. KK usulan sekolah
    // (isAdminRecommendation === false) hanya tampil di halaman profil saja.
    const eligibleKk = profile.concentrations.filter(
      (kk) => Boolean(kk && kk.code) && kk.isAdminRecommendation === true,
    );
    const rowsSchoolId =
      isViewMode ? profile.schoolId : (session?.user?.id as string | undefined)?.trim() ?? profile.schoolId;
    return [...eligibleKk]
      .sort((left, right) => compareConcentrationCode(left.code, right.code))
      .map((item) => {
        const surveyKey = resolveTableKey(rowsSchoolId, item.code, "survey", draftTables);
        const rpkpKey = resolveTableKey(rowsSchoolId, item.code, "rpkp", draftRpkpSelections);
        const proposalRows = draftTables[surveyKey] ?? [];
        const rpkpSelections = draftRpkpSelections[rpkpKey] ?? {};

        let totalProposalValue = 0;
        let totalUnits = 0;
        let totalRpkpPicks = 0;
        const equipmentDetails: Array<{
          id: string;
          name: string;
          quantity: number;
          unitPrice: number;
          subtotal: number;
        }> = [];

        for (const row of proposalRows) {
          const savedSelection = rpkpSelections[row.id];
          const selectedShop: ShopKey | "" =
            savedSelection === "shop1" || savedSelection === "shop2" || savedSelection === "shop3"
              ? savedSelection
              : "";
          if (selectedShop) totalRpkpPicks += 1;
          let unitPrice = 0;
          if (selectedShop) {
            const selectedQuote = row[selectedShop];
            unitPrice =
              parseCurrencyNumber(selectedQuote.priceWithTax) +
              parseCurrencyNumber(selectedQuote.shippingCost) +
              parseCurrencyNumber(selectedQuote.installationCost);
          }
          const qty = parseQuantityNumber(row.quantity);
          const subtotal = unitPrice * qty;

          totalProposalValue += subtotal;
          totalUnits += qty;
          equipmentDetails.push({
            id: row.id,
            name: row.name,
            quantity: qty,
            unitPrice,
            subtotal,
          });
        }

        const surveyTotal = proposalRows.length;
        const surveyFilled = proposalRows.filter((r) => Boolean(r.name?.trim())).length;
        const isSurveyFilled = surveyTotal > 0 && surveyFilled === surveyTotal;
        const isRpkpFilled = surveyTotal > 0 && totalRpkpPicks === surveyTotal;

        return {
          ...item,
          totalProposalItems: proposalRows.length,
          totalProposalValue,
          totalUnits,
          equipmentDetails,
          surveyTotal,
          surveyFilled,
          rpkpTotal: surveyTotal,
          rpkpFilled: totalRpkpPicks,
          isSurveyFilled,
          isRpkpFilled,
        };
      });
  }, [draftRpkpSelections, draftTables, isViewMode, profile, session?.user?.id]);

  const parsedEquipmentNotes = useMemo(
    () => parseStructuredReviewNotes(verifikasiReview?.reviewNoteEquipment),
    [verifikasiReview],
  );
  const parsedAdminNotes = useMemo(
    () => parseStructuredReviewNotes(verifikasiReview?.reviewNoteAdmin),
    [verifikasiReview],
  );

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
      return { className: "border-amber-200 bg-amber-50 text-amber-700", label: "Setuju dengan Catatan" };
    }
    return { className: "border-slate-200 bg-slate-100 text-slate-600", label: "Belum Di Proses" };
  }

  const totalAllConcentrationsProposalItems = useMemo(
    () => concentrationRows.reduce((sum, item) => sum + item.totalProposalItems, 0),
    [concentrationRows],
  );

  const totalAllConcentrationsUnits = useMemo(
    () => concentrationRows.reduce((sum, item) => sum + (item.totalUnits ?? 0), 0),
    [concentrationRows],
  );

  const totalAllConcentrationsProposalValue = useMemo(
    () =>
      concentrationRows.reduce((sum, item) => sum + item.totalProposalValue, 0) +
      totalCardBiayaPersiapan +
      totalCardBiayaPelatihan,
    [concentrationRows, totalCardBiayaPersiapan, totalCardBiayaPelatihan],
  );

  const totalAllConcentrationsProposalValueOnlyTools = useMemo(
    () => concentrationRows.reduce((sum, item) => sum + item.totalProposalValue, 0),
    [concentrationRows],
  );

  const rpkpRows = useMemo(
    () =>
      surveyRows.map((row) => {
        const matchedReference = findReferenceItemFromConformity(selectedReference, row.conformity);
        const savedSelection = currentRpkpSelections[row.id];
        const selectedShop: ShopKey | "" =
          savedSelection === "shop1" || savedSelection === "shop2" || savedSelection === "shop3"
            ? savedSelection
            : "";
        const selectedQuote =
          selectedShop && (selectedShop === "shop1" || selectedShop === "shop2" || selectedShop === "shop3")
            ? row[selectedShop]
            : { name: "", priceWithTax: "", shippingCost: "", installationCost: "", totalPrice: "", link: "", siplahScreenshots: [] as SiplahScreenshot[] };

        return {
          id: row.id,
          name: row.name,
          functionText: matchedReference?.["Fungsi Alat"] ?? "",
          specification: row.specification,
          selectedShop,
          selectedQuote,
        };
      }),
    [currentRpkpSelections, selectedReference, surveyRows],
  );

  const rpkpGrandTotal = useMemo(
    () =>
      rpkpRows.reduce((sum, row) => {
        const unitPrice =
          parseCurrencyNumber(row.selectedQuote.priceWithTax) +
          parseCurrencyNumber(row.selectedQuote.shippingCost) +
          parseCurrencyNumber(row.selectedQuote.installationCost);
        const qty = parseQuantityNumber(
          surveyRows.find((s) => s.id === row.id)?.quantity ?? "0",
        );
        return sum + unitPrice * qty;
      }, 0),
    [rpkpRows, surveyRows],
  );

  const paguAlatMax = pagu.data?.data?.pagu?.alat ?? 0;
  const paguAlatOver = paguAlatMax > 0 && rpkpGrandTotal > paguAlatMax;
  const paguAlatKelebihan = Math.max(0, rpkpGrandTotal - paguAlatMax);
  const paguAlatSisa = Math.max(0, paguAlatMax - rpkpGrandTotal);

  const rabRows = useMemo(
    () =>
      surveyRows.map((row) => {
        const raw = currentRpkpSelections[row.id];
        const selectedShop: ShopKey | "" =
          raw === "shop1" || raw === "shop2" || raw === "shop3" ? raw : "";
        let unitPrice = 0;
        if (selectedShop) {
          const quote = row[selectedShop];
          unitPrice =
            parseCurrencyNumber(quote.priceWithTax) +
            parseCurrencyNumber(quote.shippingCost) +
            parseCurrencyNumber(quote.installationCost);
        }
        const quantity = parseQuantityNumber(row.quantity);

        return {
          id: row.id,
          name: row.name,
          unitPrice,
          quantity,
          totalPrice: unitPrice * quantity,
        };
      }),
    [currentRpkpSelections, surveyRows],
  );

  const rabGrandTotal = useMemo(
    () =>
      rabRows.reduce((sum, row) => sum + row.totalPrice, 0) +
      totalCardBiayaPersiapan +
      totalCardBiayaPelatihan,
    [rabRows, totalCardBiayaPersiapan, totalCardBiayaPelatihan],
  );
  const rabRoundedGrandTotal = useMemo(
    () => roundToNearestThousand(totalAllConcentrationsProposalValue),
    [totalAllConcentrationsProposalValue],
  );

  function setCurrentRows(updater: (rows: ProposalRow[]) => ProposalRow[]) {
    if (!currentTableKey) {
      return;
    }

    setDraftTables((current) => {
      const updated = {
        ...current,
        [currentTableKey]: updater(current[currentTableKey] ?? []),
      };
      draftTablesRef.current = updated;

      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      autoSaveTimerRef.current = window.setTimeout(() => {
        autoSaveTimerRef.current = null;
        void saveCurrentTable();
      }, 600);

      return updated;
    });
  }

  function addProposalRow() {
    setCurrentRows((rows) => [...rows, createEmptyProposalRow()]);
  }

  function openAddProposalModal() {
    setNewProposalDraft(createEmptyProposalRow());
    setAutoFillFromConformity(false);
    setAddModalActiveShop("shop1");
    setIsAddModalOpen(true);
  }

  function closeAddProposalModal() {
    setIsAddModalOpen(false);
    setNewProposalDraft(createEmptyProposalRow());
    setAutoFillFromConformity(false);
    setAddModalErrors({});
    setAddModalActiveShop("shop1");
  }

  async function submitAddProposalModal() {
    if (!currentTableKey) {
      return;
    }
    if (addModalSaving) return;

    const errors = validateAddProposalDraft(newProposalDraft);
    if (errors.banner) {
      setAddModalErrors(errors);
      if (typeof window !== "undefined") {
        try {
          window.scrollTo?.({ top: 0, behavior: "smooth" });
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const sanitizedRow = {
      ...newProposalDraft,
      name: newProposalDraft.name.trim(),
      specification: newProposalDraft.specification.trim(),
      conformity: newProposalDraft.conformity.trim(),
      quantity: formatQuantityInput(newProposalDraft.quantity),
      unit: formatUnitInput(newProposalDraft.unit),
      shop1: normalizeQuote({ ...newProposalDraft.shop1, link: newProposalDraft.shop1.link.trim(), name: newProposalDraft.shop1.name.trim() }, newProposalDraft.quantity),
      shop2: normalizeQuote({ ...newProposalDraft.shop2, link: newProposalDraft.shop2.link.trim(), name: newProposalDraft.shop2.name.trim() }, newProposalDraft.quantity),
      shop3: normalizeQuote({ ...newProposalDraft.shop3, link: newProposalDraft.shop3.link.trim(), name: newProposalDraft.shop3.name.trim() }, newProposalDraft.quantity),
      isEditing: false,
    };

    setAddModalErrors({});
    setCurrentRows((rows) => [...rows, sanitizedRow]);
    setAddModalSaving(true);

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      await saveCurrentTable();
      setTableMessages((current) => ({
        ...current,
        [currentTableKey]: {
          type: "success",
          text: `✓ Data berhasil tersimpan ke database — ${sanitizedRow.quantity} ${sanitizedRow.unit} × ${sanitizedRow.name} berhasil ditambahkan.`,
        },
      }));
      closeAddProposalModal();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan ke database.";
      setTableMessages((current) => ({
        ...current,
        [currentTableKey]: { type: "error", text: `✗ Gagal tersimpan ke database: ${message}` },
      }));
    } finally {
      setAddModalSaving(false);
    }
  }

  function openEditProposalModal(row: ProposalRow) {
    setEditDraftRow(structuredClone(row));
    setEditAutoFillFromConformity(false);
    setEditModalErrors({});
    setEditModalActiveShop("shop1");
    setIsEditModalOpen(true);
  }

  function closeEditProposalModal() {
    if (editModalSaving) return;
    setIsEditModalOpen(false);
    setEditDraftRow(null);
    setEditAutoFillFromConformity(false);
    setEditModalErrors({});
    setEditModalActiveShop("shop1");
  }

  async function submitEditProposalModal() {
    if (!currentTableKey || !editDraftRow) return;
    if (editModalSaving) return;

    const errors = validateAddProposalDraft(editDraftRow);
    if (errors.banner) {
      setEditModalErrors(errors);
      return;
    }

    const sanitizedRow: ProposalRow = {
      ...editDraftRow,
      name: editDraftRow.name.trim(),
      specification: editDraftRow.specification.trim(),
      conformity: editDraftRow.conformity.trim(),
      quantity: formatQuantityInput(editDraftRow.quantity),
      unit: formatUnitInput(editDraftRow.unit),
      shop1: normalizeQuote(
        { ...editDraftRow.shop1, link: editDraftRow.shop1.link.trim(), name: editDraftRow.shop1.name.trim() },
        editDraftRow.quantity,
      ),
      shop2: normalizeQuote(
        { ...editDraftRow.shop2, link: editDraftRow.shop2.link.trim(), name: editDraftRow.shop2.name.trim() },
        editDraftRow.quantity,
      ),
      shop3: normalizeQuote(
        { ...editDraftRow.shop3, link: editDraftRow.shop3.link.trim(), name: editDraftRow.shop3.name.trim() },
        editDraftRow.quantity,
      ),
      isEditing: false,
    };

    setEditModalErrors({});
    setEditModalSaving(true);
    setCurrentRows((rows) => rows.map((row) => (row.id === sanitizedRow.id ? sanitizedRow : row)));
    setIsEditModalOpen(false);
    setEditDraftRow(null);
    setEditAutoFillFromConformity(false);

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      await saveCurrentTable();
      setTableMessages((current) => ({
        ...current,
        [currentTableKey]: {
          type: "success",
          text: `✓ Data berhasil tersimpan ke database — ${sanitizedRow.quantity} ${sanitizedRow.unit} × ${sanitizedRow.name} berhasil di-update.`,
        },
      }));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan ke database.";
      setTableMessages((current) => ({
        ...current,
        [currentTableKey]: { type: "error", text: `✗ Gagal tersimpan ke database: ${message}` },
      }));
    } finally {
      setEditModalSaving(false);
    }
  }

  function updateProposalRow(rowId: string, updater: (row: ProposalRow) => ProposalRow) {
    setCurrentRows((rows) => rows.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function updateShopQuote(rowId: string, shopKey: ShopKey, field: keyof ShopQuote, value: string | SiplahScreenshot[]) {
    if (field === "siplahScreenshots") {
      const nextScreens = Array.isArray(value) ? value : [];
      updateProposalRow(rowId, (row) => {
        const prevShop = row[shopKey];
        return {
          ...row,
          [shopKey]: { ...prevShop, siplahScreenshots: nextScreens },
        } as unknown as ProposalRow;
      });
      return;
    }
    const strValue = String(value ?? "");
    updateProposalRow(rowId, (row) => ({
      ...row,
      [shopKey]: recalculateQuote({
        ...row[shopKey],
        [field]: field === "link" ? strValue : field === "name" ? strValue.trim() : formatCurrencyInput(strValue),
      }, row.quantity),
    } as unknown as ProposalRow));
  }

  function toggleRowEditing(rowId: string, isEditing: boolean) {
    if (!isEditing) {
      if (!currentTableKey) return;
      setCurrentRows((rows) =>
        rows.map((row) =>
          row.id === rowId
            ? {
                ...row,
                name: row.name.trim(),
                specification: row.specification.trim(),
                conformity: row.conformity.trim(),
                quantity: formatQuantityInput(row.quantity),
                unit: formatUnitInput(row.unit),
                shop1: normalizeQuote(
                  { ...row.shop1, link: row.shop1.link.trim(), name: row.shop1.name.trim() },
                  row.quantity,
                ),
                shop2: normalizeQuote(
                  { ...row.shop2, link: row.shop2.link.trim(), name: row.shop2.name.trim() },
                  row.quantity,
                ),
                shop3: normalizeQuote(
                  { ...row.shop3, link: row.shop3.link.trim(), name: row.shop3.name.trim() },
                  row.quantity,
                ),
                isEditing: false,
              }
            : row,
        ),
      );
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      void saveCurrentTable();
    } else {
      updateProposalRow(rowId, (row) => ({ ...row, isEditing: true }));
    }
  }

  function removeProposalRow(rowId: string) {
    if (!currentTableKey) return;
    setCurrentRows((rows) => rows.filter((row) => row.id !== rowId));
    setTableMessages((current) => ({
      ...current,
      [currentTableKey]: { type: "success", text: "Item ajuan dihapus dari tabel dan tersimpan." },
    }));
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    void saveCurrentTable();
  }

  function updateRpkpSelection(rowId: string, shopKey: ShopKey | "") {
    if (!rpkpTableKey) {
      return;
    }

    setDraftRpkpSelections((current) => {
      const existing = { ...(current[rpkpTableKey] ?? {}) };
      if (shopKey) {
        existing[rowId] = shopKey;
      } else {
        delete existing[rowId];
      }
      const updated = {
        ...current,
        [rpkpTableKey]: existing,
      };
      draftRpkpSelectionsRef.current = updated;
      return updated;
    });

    const persisted = persistedRpkpSelections[rpkpTableKey] ?? {};
    const persistedValue = persisted[rowId];
    const isSameAsPersisted = persistedValue === shopKey || (!persistedValue && !shopKey);
    setDirtyRpkpRows((prev) => {
      const next = new Set(prev);
      if (isSameAsPersisted) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      dirtyRpkpRowsRef.current = next;
      return next;
    });
  }

  async function saveOneRpkpRow(rowId: string) {
    if (!rpkpTableKey || rpkpRowSaving) return;
    setRpkpRowSaving(rowId);
    try {
      await saveCurrentTable();
      setDirtyRpkpRows((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        dirtyRpkpRowsRef.current = next;
        return next;
      });
    } finally {
      setRpkpRowSaving(null);
    }
  }

  function resetOneRpkpRow(rowId: string) {
    if (!rpkpTableKey) return;
    const persisted = persistedRpkpSelections[rpkpTableKey] ?? {};
    const persistedShop = (persisted[rowId] as ShopKey | "") ?? "";
    setDraftRpkpSelections((current) => {
      const existing = { ...(current[rpkpTableKey] ?? {}) };
      if (persistedShop) {
        existing[rowId] = persistedShop;
      } else {
        delete existing[rowId];
      }
      const updated = { ...current, [rpkpTableKey]: existing };
      draftRpkpSelectionsRef.current = updated;
      return updated;
    });
    setDirtyRpkpRows((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      dirtyRpkpRowsRef.current = next;
      return next;
    });
  }

  function getTabTableKey(tabKey: ProposalTabKey): string {
    if (!profile || !selectedConcentrationCode) return "";
    const tabSchoolId =
      isViewMode ? profile.schoolId : (session?.user?.id as string | undefined)?.trim() ?? profile.schoolId;
    const mergedForLookup = tabKey === "rpkp" ? { ...draftRpkpSelections, ...persistedRpkpSelections } : { ...draftTables, ...persistedTables };
    return resolveTableKey(tabSchoolId, selectedConcentrationCode, tabKey, mergedForLookup);
  }

  async function saveCurrentTable() {
    const effectiveTab = activeProposalTab;
    if (!token) return;

    const latestDraftTables = draftTablesRef.current;
    const latestDraftRpkp = draftRpkpSelectionsRef.current;
    const sanitizedProposalTables: Record<string, unknown> = {};
    Object.entries(latestDraftTables).forEach(([key, rows]) => {
      if (!rows.length) return;
      sanitizedProposalTables[key] = rows.map((row) => ({
        id: row.id,
        name: row.name.trim(),
        specification: row.specification.trim(),
        conformity: row.conformity.trim(),
        quantity: formatQuantityInput(row.quantity),
        unit: formatUnitInput(row.unit),
        shop1: normalizeQuote({ ...row.shop1, name: row.shop1.name.trim(), link: row.shop1.link.trim() }, row.quantity),
        shop2: normalizeQuote({ ...row.shop2, name: row.shop2.name.trim(), link: row.shop2.link.trim() }, row.quantity),
        shop3: normalizeQuote({ ...row.shop3, name: row.shop3.name.trim(), link: row.shop3.link.trim() }, row.quantity),
      }));
    });
    const sanitizedRpkp: PersistedRpkpSelections = {};
    Object.entries(latestDraftRpkp).forEach(([key, rowSelections]) => {
      if (!rowSelections) return;
      sanitizedRpkp[key] = { ...rowSelections };
    });

    const serializedPayload = JSON.stringify({
      proposalTables: sanitizedProposalTables,
      rpkpSelections: sanitizedRpkp,
      rpkpGrandTotalRp: Math.max(0, Math.floor(Number(rpkpGrandTotal) || 0)),
    });
    const payloadBytes = serializedPayload.length;
    const payloadMb = (payloadBytes / 1024 / 1024).toFixed(1);

    const effectiveTableKey = getTabTableKey(effectiveTab);

    // #region debug-point global-cards-persist-bug POINT-B: payload before PUT — verify global keys included
    const hasKeyPersiapan = typeof sanitizedProposalTables[GLOBAL_KEY_BIAYA_PERSIAPAN] !== "undefined";
    const hasKeyPelatihan = typeof sanitizedProposalTables[GLOBAL_KEY_BIAYA_PELATIHAN] !== "undefined";
    __dbg_report("SAVE_PAYLOAD_BEFORE_PUT", {
      schoolNpsn: profile?.npsn || null,
      schoolName: profile?.schoolName || "",
      effectiveTab: String(effectiveTab),
      effectiveTableKey: String(effectiveTableKey),
      payloadSizeBytes: Number(payloadBytes),
      payloadKeys: Object.keys(sanitizedProposalTables),
      totalPayloadKeys: Object.keys(sanitizedProposalTables).length,
      hasGlobalPersiapanKey: Boolean(hasKeyPersiapan),
      hasGlobalPelatihanKey: Boolean(hasKeyPelatihan),
      globalPersiapanRowsLen: hasKeyPersiapan ? Number((sanitizedProposalTables[GLOBAL_KEY_BIAYA_PERSIAPAN] as unknown[])?.length ?? 0) : -1,
      globalPelatihanRowsLen: hasKeyPelatihan ? Number((sanitizedProposalTables[GLOBAL_KEY_BIAYA_PELATIHAN] as unknown[])?.length ?? 0) : -1,
      card1RowsLen: Number(card1BiayaPersiapan.length),
      card2RowsLen: Number(card2BiayaPelatihan.length),
      payloadHash: Math.abs(serializedPayload.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)),
    });
    // #endregion

    const hardErrorKey = effectiveTab === "rpkp" ? rpkpTableKey : effectiveTableKey;

    if (payloadBytes > MAX_PAYLOAD_BYTES_HARD) {
      setAutoSaveStatus("error");
      const hardMb = `${Math.round(MAX_PAYLOAD_BYTES_HARD / 1024 / 1024)} MB`;
      const errorText = `Data pengajuan terlalu besar (${payloadMb} MB > ${hardMb}). Kurangi jumlah screenshot SIPLAH — hapus beberapa foto yang kurang penting lalu simpan ulang.`;
      if (hardErrorKey) {
        setTableMessages((prev) => ({ ...prev, [hardErrorKey]: { type: "error", text: errorText } }));
      }
      window.alert(errorText);
      return;
    }

    let skipDueToValidation = false;
    if (paguAlatOver) {
      skipDueToValidation = true;
      const errLabel = rpkpTableKey ?? effectiveTableKey ?? effectiveTab === "rpkp" ? rpkpTableKey : hardErrorKey;
      if (errLabel) {
        setTableMessages((prev) => ({
          ...prev,
          [errLabel]: {
            type: "error",
            text: `Total RPKP melebihi batas Pagu Alat Dinas. Batas: Rp ${paguAlatMax.toLocaleString("id-ID")}. Total sekarang: Rp ${rpkpGrandTotal.toLocaleString("id-ID")}. Kurangi Rp ${paguAlatKelebihan.toLocaleString("id-ID")} agar bisa disimpan.`,
          },
        }));
      }
    }
    if (!skipDueToValidation && effectiveTab !== "rpkp" && effectiveTableKey) {
      const rows = latestDraftTables[effectiveTableKey] ?? [];
      const invalidRow = rows.find((row) => !row.name.trim());
      if (invalidRow) {
        skipDueToValidation = true;
        setTableMessages((prev) => ({
          ...prev,
          [effectiveTableKey]: { type: "error", text: "Nama alat wajib diisi sebelum data ajuan disimpan." },
        }));
      }
    }
    if (payloadBytes > MAX_PAYLOAD_BYTES_SOFT) {
      const softMb = `${Math.round(MAX_PAYLOAD_BYTES_SOFT / 1024 / 1024)} MB`;
      const warnKey = effectiveTab === "rpkp" ? rpkpTableKey : effectiveTableKey;
      if (warnKey) {
        setTableMessages((prev) => ({
          ...prev,
          [warnKey]: {
            type: "error",
            text: `Ukuran data ${payloadMb} MB > ${softMb}. Simpan diizinkan, tapi disarankan mengurangi screenshot SIPLAH agar proses verifikasi lebih cepat dan upload tidak timeout.`,
          },
        }));
      }
    }
    if (skipDueToValidation) return;

    const lockId = `${effectiveTab}-${Date.now()}-${Math.random()}`;
    autoSaveLockRef.current = lockId;
    setAutoSaveStatus("saving");
    try {
      if (isViewMode) throw new Error("Mode tampilan Fasilitator Alat — hanya bisa melihat data sekolah. Silakan minta sekolah login untuk mengubah data sendiri.");
      const saved = await saveSchoolProposalDataRequestRaw(token, serializedPayload);
      if (autoSaveLockRef.current !== lockId) return;

      // #region debug-point global-cards-persist-bug POINT-C: response after PUT success
      __dbg_report("SAVE_RESPONSE_AFTER_PUT_SUCCESS", {
        schoolNpsn: profile?.npsn || null,
        responseHasProposalTables: typeof saved?.proposalTables === "object" && saved?.proposalTables !== null,
        responseKeysCount: typeof saved?.proposalTables === "object" && saved?.proposalTables !== null ? Object.keys(saved.proposalTables).length : 0,
        responseHasKeyPersiapan: typeof saved?.proposalTables === "object" && saved?.proposalTables !== null && typeof saved.proposalTables[GLOBAL_KEY_BIAYA_PERSIAPAN] !== "undefined",
        responseHasKeyPelatihan: typeof saved?.proposalTables === "object" && saved?.proposalTables !== null && typeof saved.proposalTables[GLOBAL_KEY_BIAYA_PELATIHAN] !== "undefined",
        responsePersiapanRowsLen: typeof saved?.proposalTables === "object" && saved?.proposalTables !== null ? Number((saved.proposalTables[GLOBAL_KEY_BIAYA_PERSIAPAN] as unknown[])?.length ?? 0) : -1,
        responsePelatihanRowsLen: typeof saved?.proposalTables === "object" && saved?.proposalTables !== null ? Number((saved.proposalTables[GLOBAL_KEY_BIAYA_PELATIHAN] as unknown[])?.length ?? 0) : -1,
        lockMatched: autoSaveLockRef.current === lockId,
      });
      // #endregion

      // ⚡ V4.4: Promise resolve = BACKEND DB SUDAH TERSIMPAN (HTTP 200 OK).
      // Segera set "saved" & broadcast cross-tab SEBELUM parsing lokal state parsing.
      // Jika parsing body response gagal (FALSE POSITIVE "Gagal memproses respons server")
      // — tidak masalah: data sudah benar persist di DB, tinggal UI lokal state refresh.

      // ⚡ V4.5: INVALIDATE TANSTACK QUERY CACHE AGAR HALAMAN INDEX /pengajuan
      // (RAB Summary & Rincian RAB per KK) RE-FETCH DATA TERBARU DARI BACKEND
      // — ROOT CAUSE user report "RPKP disimpan tapi RAB tidak berubah" = stale cache.
      try {
        const invalidateTargets: Array<unknown[]> = [
          ["proposalIndexSummary", overrideNpsn || "me"],
          ["proposalIndexSummary", "me"],
        ];
        if (overrideNpsn) invalidateTargets.push(["proposalIndexSummary", String(overrideNpsn).trim()]);
        const npsnLocal = profile?.npsn || overrideNpsn || null;
        if (npsnLocal) {
          invalidateTargets.push(["proposalIndexSummary", String(npsnLocal).trim()]);
          invalidateTargets.push(["workspaceProposalData", String(npsnLocal).trim()]);
        }
        invalidateTargets.push(["workspaceProposalData", "me"]);
        invalidateTargets.push(["paguDetailProposal", overrideNpsn || "me"]);
        invalidateTargets.push(["paguDetailProposal", "me"]);
        if (npsnLocal) invalidateTargets.push(["paguDetailProposal", String(npsnLocal).trim()]);
        // Invalidate all prefixes (safe):
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["proposalIndexSummary"], refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: ["workspaceProposalData"], refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: ["paguDetailProposal"], refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: ["schoolSummary"], refetchType: "all" }),
        ]).catch(() => null);
        // Cross-tab sync via storage event — page /pengajuan (SchoolProposalIndexPage)
        // bisa listen event storage untuk reload data jika ada di tab lain.
        try {
          const crossKey = `__prisma_rpkp_saved__:${npsnLocal || "me"}`;
          localStorage.setItem(crossKey, String(Date.now()));
          setTimeout(() => localStorage.removeItem(crossKey), 5000);
        } catch { /* ignore quota errors */ }
        void invalidateTargets; // avoid ts unused when all above are done via prefix invalidation
      } catch (_cacheErr) {
        // cache invalidation gagal (rare) tidak block save success flow
        // data sudah persist di DB; user refresh halaman manual akan sync.
      }

      setAutoSaveStatus("saved");
      if (profile?.npsn) broadcastPraBimtekSavedForNpsn(profile.npsn);

      try {
        const savedTables = normalizePersistedTables(saved.proposalTables);
        const savedSelections = normalizePersistedRpkpSelections(saved.rpkpSelections);
        setPersistedTables(savedTables);
        setPersistedRpkpSelections(savedSelections);
        setDraftRpkpSelections((current) => {
          const next: PersistedRpkpSelections = { ...current };
          for (const [key, value] of Object.entries(savedSelections)) {
            if (value && typeof value === "object") {
              next[key] = { ...value };
            } else {
              next[key] = {};
            }
          }
          for (const key of Object.keys(savedSelections)) {
            const v = savedSelections[key];
            if (!v || (typeof v === "object" && Object.keys(v).length === 0)) {
              if (next[key] && Object.keys(next[key]).length > 0) {
                next[key] = {};
              }
            }
          }
          draftRpkpSelectionsRef.current = next;
          return next;
        });
      } catch (_parseErr) {
        // ignore parse gagal = FALSE POSITIVE: data persist di DB sudah benar, cukup refresh halaman nanti sinkron otomatis.
      }

      const successKey =
        effectiveTab === "rpkp" ? rpkpTableKey : effectiveTableKey;
      const successText =
        effectiveTab === "rpkp"
          ? "Pilihan toko RPKP tersimpan."
          : effectiveTab === "survey"
            ? "Ajuan alat Survey Pasar tersimpan."
            : "Data pengajuan tersimpan.";
      if (successKey) {
        setTableMessages((current) => ({
          ...current,
          [successKey]: { type: "success", text: successText },
        }));
      }
    } catch (saveError) {
      if (autoSaveLockRef.current !== lockId) return;
      setAutoSaveStatus("error");
      const errorKey =
        effectiveTab === "rpkp" ? rpkpTableKey : effectiveTableKey;
      const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan data.";
      if (errorKey) {
        setTableMessages((current) => ({
          ...current,
          [errorKey]: { type: "error", text: message },
        }));
      }
    }
  }

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  function formatDateFilename(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
    XLSX.writeFile(workbook, filename, { compression: true });
  }

  function formatIdr(value: number): string {
    if (!Number.isFinite(value)) return "Rp 0";
    return `Rp ${value.toLocaleString("id-ID")}`;
  }

  async function exportSurveyPdf() {
    if (!profile || !selectedReference) return;
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Survey Harga Pasar", 40, 36);
    doc.setFontSize(10);
    doc.text(
      `${profile.schoolName} (NPSN ${profile.npsn}) - Konsentrasi ${selectedReference.concentrationCode} ${selectedReference.concentrationName}`,
      40,
      54,
    );

    const head = [
      [
        "No",
        "Kesesuaian",
        "Nama Alat",
        "Spesifikasi",
        "Jml",
        "Sat",
        "Toko 1 (Total)",
        "Toko 2 (Total)",
        "Toko 3 (Total)",
      ],
    ];
    const body = surveyRows.length
      ? surveyRows.map((row, index) => [
          String(index + 1),
          row.conformity || "-",
          row.name || "-",
          row.specification || "-",
          String(parseQuantityNumber(row.quantity)),
          row.unit || "-",
          formatIdr(parseCurrencyNumber(row.shop1.totalPrice)),
          formatIdr(parseCurrencyNumber(row.shop2.totalPrice)),
          formatIdr(parseCurrencyNumber(row.shop3.totalPrice)),
        ])
      : [["-", "-", "Belum ada data", "-", "-", "-", "-", "-", "-"]];

    autoTable(doc, {
      startY: 68,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 70 },
        2: { cellWidth: 160 },
        3: { cellWidth: 190 },
        4: { cellWidth: 45, halign: "right" },
        5: { cellWidth: 45 },
        6: { cellWidth: 90, halign: "right" },
        7: { cellWidth: 90, halign: "right" },
        8: { cellWidth: 90, halign: "right" },
      },
    });

    doc.save(`${profile.npsn}_${selectedReference.concentrationCode}_SURVEY_HARGA_${formatDateFilename()}.pdf`);
  }

  async function exportRpkpPdf() {
    if (!profile || !selectedReference) return;
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Rencana Paket Kebutuhan Peralatan (RPKP)", 40, 36);
    doc.setFontSize(10);
    doc.text(
      `${profile.schoolName} (NPSN ${profile.npsn}) - Konsentrasi ${selectedReference.concentrationCode} ${selectedReference.concentrationName}`,
      40,
      54,
    );

    const head = [["No", "Nama Alat", "Fungsi", "Spesifikasi", "Toko Dipilih", "Harga Satuan", "Total Estimasi"]];
    const rows = rpkpRows.map((row, index) => {
      const labelToko =
        row.selectedQuote?.name ||
        shopConfigs.find((item) => item.key === row.selectedShop)?.label ||
        row.selectedShop;
      const satuan =
        parseCurrencyNumber(row.selectedQuote.priceWithTax) +
        parseCurrencyNumber(row.selectedQuote.shippingCost) +
        parseCurrencyNumber(row.selectedQuote.installationCost);
      return [
        String(index + 1),
        row.name || "-",
        row.functionText || "-",
        row.specification || "-",
        labelToko,
        formatIdr(satuan),
        formatIdr(parseCurrencyNumber(row.selectedQuote.totalPrice)),
      ];
    });
    const body = rows.length
      ? [
          ...rows,
          [
            "",
            "TOTAL RPKP",
            "",
            "",
            "",
            "",
            formatIdr(rpkpGrandTotal),
          ],
        ]
      : [["-", "Belum ada data", "-", "-", "-", "-", "-"]];

    autoTable(doc, {
      startY: 68,
      head,
      body,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [15, 23, 42] },
      didParseCell: (data) => {
        if (data.section === "body") {
          const last = data.row.index === rows.length;
          if (last) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [241, 245, 249];
          }
        }
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 170 },
        2: { cellWidth: 180 },
        3: { cellWidth: 200 },
        4: { cellWidth: 80 },
        5: { cellWidth: 110, halign: "right" },
        6: { cellWidth: 130, halign: "right" },
      },
    });

    doc.save(`${profile.npsn}_${selectedReference.concentrationCode}_RPKP_${formatDateFilename()}.pdf`);
  }

  async function exportRabPdf() {
    if (!profile) return;
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Rencana Anggaran Biaya (RAB)", 40, 36);
    doc.setFontSize(10);
    doc.text(
      `${profile.schoolName} (NPSN ${profile.npsn}) - Total Agregasi dari Seluruh RPKP per Konsentrasi Keahlian`,
      40,
      54,
    );

    const head = [["No", "Kode KK", "Konsentrasi Keahlian", "Jumlah Item", "Total Nilai RAB (Rp)"]];
    const rows = concentrationRows.map((kk, index) => [
      String(index + 1),
      kk.code,
      kk.name,
      kk.totalProposalItems.toLocaleString("id-ID"),
      formatIdr(Number.isFinite(kk.totalProposalValue) ? kk.totalProposalValue : 0),
    ]);
    const grandTotal = totalAllConcentrationsProposalValue;
    const grandRounded = roundToNearestThousand(grandTotal);
    const body = rows.length
      ? [
          ...rows,
          ["", "", "TOTAL RAB SELURUH KONSENTRASI", String(totalAllConcentrationsProposalItems.toLocaleString("id-ID")), formatIdr(grandTotal)],
          ["", "", "TOTAL RAB (DIBULATKAN KE RIBAWAN)", "", formatIdr(grandRounded)],
        ]
      : [["-", "-", "Belum ada data RAB (isi Survey & RPKP per KK terlebih dahulu)", "-", "-"]];

    autoTable(doc, {
      startY: 68,
      head,
      body,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [15, 23, 42] },
      didParseCell: (data) => {
        if (data.section === "body" && rows.length > 0) {
          const isSummary = data.row.index >= rows.length;
          if (isSummary) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = data.row.index === rows.length ? [241, 245, 249] : [236, 253, 245];
          }
        }
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 90 },
        2: { cellWidth: 230 },
        3: { cellWidth: 90, halign: "right" },
        4: { cellWidth: 140, halign: "right" },
      },
    });

    doc.save(`${profile.npsn}_RAB_TOTAL_SEKOLAH_${formatDateFilename()}.pdf`);
  }

  function exportSurveyExcel() {
    if (!profile || !selectedReference) return;
    const rows = surveyRows.map((row, index) => ({
      No: index + 1,
      Kesesuaian: row.conformity || "-",
      "Nama Alat": row.name || "-",
      Spesifikasi: row.specification || "-",
      Jumlah: parseQuantityNumber(row.quantity),
      Satuan: row.unit || "-",
      "Nama Toko 1": row.shop1.name || "-",
      "Jml Screenshot SIPLAH Toko 1": row.shop1.siplahScreenshots.length,
      "Harga Toko 1 (Rp)": parseCurrencyNumber(row.shop1.priceWithTax) || 0,
      "Ongkir Toko 1 (Rp)": parseCurrencyNumber(row.shop1.shippingCost) || 0,
      "Instalasi Toko 1 (Rp)": parseCurrencyNumber(row.shop1.installationCost) || 0,
      "Total Toko 1 (Rp)": parseCurrencyNumber(row.shop1.totalPrice) || 0,
      "Link Toko 1": row.shop1.link || "-",
      "Nama Toko 2": row.shop2.name || "-",
      "Jml Screenshot SIPLAH Toko 2": row.shop2.siplahScreenshots.length,
      "Harga Toko 2 (Rp)": parseCurrencyNumber(row.shop2.priceWithTax) || 0,
      "Ongkir Toko 2 (Rp)": parseCurrencyNumber(row.shop2.shippingCost) || 0,
      "Instalasi Toko 2 (Rp)": parseCurrencyNumber(row.shop2.installationCost) || 0,
      "Total Toko 2 (Rp)": parseCurrencyNumber(row.shop2.totalPrice) || 0,
      "Link Toko 2": row.shop2.link || "-",
      "Nama Toko 3": row.shop3.name || "-",
      "Jml Screenshot SIPLAH Toko 3": row.shop3.siplahScreenshots.length,
      "Harga Toko 3 (Rp)": parseCurrencyNumber(row.shop3.priceWithTax) || 0,
      "Ongkir Toko 3 (Rp)": parseCurrencyNumber(row.shop3.shippingCost) || 0,
      "Instalasi Toko 3 (Rp)": parseCurrencyNumber(row.shop3.installationCost) || 0,
      "Total Toko 3 (Rp)": parseCurrencyNumber(row.shop3.totalPrice) || 0,
      "Link Toko 3": row.shop3.link || "-",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ No: "-", "Nama Alat": "Belum ada data" }]);
    ws["!cols"] = Array.from({ length: 28 }, () => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "Survey Harga Pasar");
    const filename = `${profile.npsn}_${selectedReference.concentrationCode}_SURVEY_HARGA_${formatDateFilename()}.xlsx`;
    downloadWorkbook(wb, filename);
  }

  function exportRpkpExcel() {
    if (!profile || !selectedReference) return;
    const rows = rpkpRows.map((row, index) => ({
      No: index + 1,
      "Nama Alat": row.name || "-",
      Fungsi: row.functionText || "-",
      Spesifikasi: row.specification || "-",
      "Toko Dipilih":
        row.selectedQuote?.name ||
        shopConfigs.find((item) => item.key === row.selectedShop)?.label ||
        row.selectedShop,
      "Harga Satuan + Pajak (Rp)":
        parseCurrencyNumber(row.selectedQuote.priceWithTax) +
          parseCurrencyNumber(row.selectedQuote.shippingCost) +
          parseCurrencyNumber(row.selectedQuote.installationCost) || 0,
      "Total Estimasi Harga (Rp)": parseCurrencyNumber(row.selectedQuote.totalPrice) || 0,
      "Link Toko": row.selectedQuote.link || "-",
    }));
    const summary = [
      {
        No: "",
        "Nama Alat": "TOTAL RPKP",
        Fungsi: "",
        Spesifikasi: "",
        "Toko Dipilih": "",
        "Harga Satuan + Pajak (Rp)": "",
        "Total Estimasi Harga (Rp)": rpkpGrandTotal,
        "Link Toko": "",
      },
    ];
    const combined = rows.length
      ? [...rows, ...summary]
      : [{ No: "-", "Nama Alat": "Belum ada data" } as unknown as (typeof rows)[number]];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(combined);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 40 },
      { wch: 32 },
      { wch: 18 },
      { wch: 24 },
      { wch: 26 },
      { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "RPKP");
    const filename = `${profile.npsn}_${selectedReference.concentrationCode}_RPKP_${formatDateFilename()}.xlsx`;
    downloadWorkbook(wb, filename);
  }

  function exportRabExcel() {
    if (!profile) return;
    const rows = concentrationRows.map((kk, index) => ({
      No: index + 1,
      "Kode KK": kk.code,
      "Konsentrasi Keahlian": kk.name,
      "Jumlah Item Alat": kk.totalProposalItems,
      "Total Nilai RPKP Menjadi RAB (Rp)": Number.isFinite(kk.totalProposalValue) ? kk.totalProposalValue : 0,
    }));
    const grandTotal = totalAllConcentrationsProposalValue;
    const grandRounded = roundToNearestThousand(grandTotal);
    const summary = [
      {
        No: "",
        "Kode KK": "",
        "Konsentrasi Keahlian": "TOTAL RAB SELURUH KONSENTRASI",
        "Jumlah Item Alat": totalAllConcentrationsProposalItems,
        "Total Nilai RPKP Menjadi RAB (Rp)": grandTotal,
      },
      {
        No: "",
        "Kode KK": "",
        "Konsentrasi Keahlian": "TOTAL RAB (DIBULATKAN KE RIBAWAN)",
        "Jumlah Item Alat": "",
        "Total Nilai RPKP Menjadi RAB (Rp)": grandRounded,
      },
    ];
    type RabRow = (typeof rows)[number];
    const combined = rows.length
      ? [...rows, ...(summary as unknown as RabRow[])]
      : [{ No: "-", "Konsentrasi Keahlian": "Belum ada data RAB (isi Survey & RPKP per KK terlebih dahulu)" } as unknown as RabRow];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(combined);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 50 },
      { wch: 18 },
      { wch: 38 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "RAB-Total-KK");
    const filename = `${profile.npsn}_RAB_TOTAL_SEKOLAH_${formatDateFilename()}.xlsx`;
    downloadWorkbook(wb, filename);
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

  type SurveyExcelHeader = {
    header: string;
    keys?: string[];
  };

  const surveyExcelHeaders: SurveyExcelHeader[] = [
    { header: "No" },
    { header: "Kesesuaian", keys: ["Kesesuaian", "conformity"] },
    { header: "Nama Alat", keys: ["Nama Alat", "name"] },
    { header: "Spesifikasi", keys: ["Spesifikasi", "specification"] },
    { header: "Kuantitas", keys: ["Kuantitas", "Jumlah", "quantity"] },
    { header: "Satuan", keys: ["Satuan", "unit"] },
    { header: "Toko 1 - Nama Toko", keys: ["Toko 1 - Nama Toko", "Nama Toko 1", "T1 Nama", "Toko 1 Nama"] },
    { header: "Toko 1 - Harga + PPN (Rp)", keys: ["Toko 1 - Harga + PPN (Rp)", "Harga Toko 1 (Rp)", "T1 Harga"] },
    { header: "Toko 1 - Biaya Kirim (Rp)", keys: ["Toko 1 - Biaya Kirim (Rp)", "Ongkir Toko 1 (Rp)", "T1 Ongkir"] },
    { header: "Toko 1 - Biaya Pasang (Rp)", keys: ["Toko 1 - Biaya Pasang (Rp)", "Instalasi Toko 1 (Rp)", "T1 Pasang"] },
    { header: "Toko 1 - Total (Rp)", keys: ["Toko 1 - Total (Rp)", "Total Toko 1 (Rp)", "T1 Total"] },
    { header: "Toko 1 - Link Produk", keys: ["Toko 1 - Link Produk", "Link Toko 1", "T1 Link"] },
    { header: "Toko 2 - Nama Toko", keys: ["Toko 2 - Nama Toko", "Nama Toko 2", "T2 Nama", "Toko 2 Nama"] },
    { header: "Toko 2 - Harga + PPN (Rp)", keys: ["Toko 2 - Harga + PPN (Rp)", "Harga Toko 2 (Rp)", "T2 Harga"] },
    { header: "Toko 2 - Biaya Kirim (Rp)", keys: ["Toko 2 - Biaya Kirim (Rp)", "Ongkir Toko 2 (Rp)", "T2 Ongkir"] },
    { header: "Toko 2 - Biaya Pasang (Rp)", keys: ["Toko 2 - Biaya Pasang (Rp)", "Instalasi Toko 2 (Rp)", "T2 Pasang"] },
    { header: "Toko 2 - Total (Rp)", keys: ["Toko 2 - Total (Rp)", "Total Toko 2 (Rp)", "T2 Total"] },
    { header: "Toko 2 - Link Produk", keys: ["Toko 2 - Link Produk", "Link Toko 2", "T2 Link"] },
    { header: "Toko 3 - Nama Toko", keys: ["Toko 3 - Nama Toko", "Nama Toko 3", "T3 Nama", "Toko 3 Nama"] },
    { header: "Toko 3 - Harga + PPN (Rp)", keys: ["Toko 3 - Harga + PPN (Rp)", "Harga Toko 3 (Rp)", "T3 Harga"] },
    { header: "Toko 3 - Biaya Kirim (Rp)", keys: ["Toko 3 - Biaya Kirim (Rp)", "Ongkir Toko 3 (Rp)", "T3 Ongkir"] },
    { header: "Toko 3 - Biaya Pasang (Rp)", keys: ["Toko 3 - Biaya Pasang (Rp)", "Instalasi Toko 3 (Rp)", "T3 Pasang"] },
    { header: "Toko 3 - Total (Rp)", keys: ["Toko 3 - Total (Rp)", "Total Toko 3 (Rp)", "T3 Total"] },
    { header: "Toko 3 - Link Produk", keys: ["Toko 3 - Link Produk", "Link Toko 3", "T3 Link"] },
  ];

  async function handleDownloadSurveyExcelTemplate() {
    if (!selectedReference) {
      setExcelFeedback({ type: "error", text: "Pilih dulu Konsentrasi Keahlian sebelum download format Excel." });
      return;
    }
    try {
      setExcelLoading(true);
      setExcelFeedback(null);
      const workbook = XLSX.utils.book_new();
      const colIndexKesesuaian = 1;
      const colIndexTotalT1 = 10;
      const colIndexTotalT2 = 16;
      const colIndexTotalT3 = 22;
      const aoa: Array<Array<string | number>> = [];
      aoa.push(surveyExcelHeaders.map((col) => col.header));
      aoa.push([
        1,
        "Peralatan Praktik Utama Kriteria Minimal - Meja Komputer USB",
        "Meja Komputer USB",
        "Meja komputer kayu 120x60x75 cm + USB Charger Port per siswa",
        30,
        "Unit",
        "SIPLAH Toko Alat Utama",
        1850000,
        0,
        150000,
        57000000,
        "https://www.tokopedia.com/contoh/meja-komputer-1",
        "Tokopedia Alat SMK Center",
        1920000,
        25000,
        100000,
        58850000,
        "https://www.bukalapak.com/contoh/meja-komputer-2",
        "Shopee Sarana Praktik Store",
        1780000,
        35000,
        80000,
        54550000,
        "https://shopee.co.id/contoh/meja-komputer-3",
      ]);
      const referenceOptions: string[] = ["Alat Tidak Sesuai PERKA"];
      for (const group of conformityGroups) {
        for (const opt of group.options) {
          referenceOptions.push(`${group.label} - ${opt}`);
        }
      }
      const conformityDropdownList = referenceOptions.length > 200
        ? '"Alat Tidak Sesuai PERKA,Pilih dari dropdown master PERKA"'
        : `"${referenceOptions.join(",").replace(/"/g, '""')}"`;
      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet["!cols"] = [
        { wch: 6 },
        { wch: 40 },
        { wch: 36 },
        { wch: 44 },
        { wch: 12 },
        { wch: 12 },
        { wch: 34 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 40 },
        { wch: 34 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 40 },
        { wch: 34 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 40 },
      ];
      sheet["!merges"] = [];
      const lastDataRow = 1000;
      const dataValidation: Record<string, { type: "list"; allowBlank: true; formulae: string[] }> = {};
      for (let r = 2; r <= lastDataRow; r++) {
        const cellAddr = XLSX.utils.encode_cell({ c: colIndexKesesuaian, r });
        dataValidation[cellAddr] = {
          type: "list",
          allowBlank: true,
          formulae: [conformityDropdownList],
        };
        const t1TotalAddr = XLSX.utils.encode_cell({ c: colIndexTotalT1, r });
        const t2TotalAddr = XLSX.utils.encode_cell({ c: colIndexTotalT2, r });
        const t3TotalAddr = XLSX.utils.encode_cell({ c: colIndexTotalT3, r });
        if (sheet[t1TotalAddr]) sheet[t1TotalAddr].c = [{ a: "SARANA SMK", t: "Total otomatis = kuantitas × (Harga+PPN) + Ongkir + Pasang. JANGAN di-edit manual.", T: true, width: 320, height: 120 }];
        if (sheet[t2TotalAddr]) sheet[t2TotalAddr].c = [{ a: "SARANA SMK", t: "Total otomatis = kuantitas × (Harga+PPN) + Ongkir + Pasang. JANGAN di-edit manual.", T: true, width: 320, height: 120 }];
        if (sheet[t3TotalAddr]) sheet[t3TotalAddr].c = [{ a: "SARANA SMK", t: "Total otomatis = kuantitas × (Harga+PPN) + Ongkir + Pasang. JANGAN di-edit manual.", T: true, width: 320, height: 120 }];
      }
      sheet["!dataValidation"] = dataValidation;
      const headerKuantitasAddr = XLSX.utils.encode_cell({ c: 4, r: 0 });
      sheet[headerKuantitasAddr].c = [{
        a: "SARANA SMK",
        t: "Kuantitas diisi ANGKA bulat. Satuan diisi teks (Unit, Paket, Buah, dll). Toko 1/2/3: Harga+PPN, Ongkir, Pasang diisi ANGKA bulat Rupiah (tanpa Rp dan tanpa titik koma pemisah ribuan). Link diisi http:// atau https://. BARIS 2 adalah CONTOH ISIAN, hapus/ganti sesuai data nyata SEBELUM upload. Kolom Total (T1-T3) JANGAN di-edit, otomatis dihitung sistem setelah upload.",
        T: true,
        width: 420,
        height: 240,
      }];
      XLSX.utils.book_append_sheet(workbook, sheet, "Survey Harga Pasar");
      const fileName = `Format_Survey_Harga_${selectedReference.concentrationCode.replace(/[^\w]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      triggerFileDownload(workbook, fileName);
      setExcelFeedback({ type: "success", text: `Format Excel Survey Harga Pasar untuk ${selectedReference.concentrationName} berhasil di-download. Isi sesuai kolom: Kuantitas angka bulat, harga+ongkir+pasang angka bulat Rp, link mulai http/https. Baris 2 = CONTOH ISIAN, hapus/ganti sebelum Upload Excel. Kolom Total (Toko 1-3) JANGAN diedit manual, otomatis dihitung sistem.` });
    } catch (err) {
      setExcelFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal membuat format Excel.",
      });
    } finally {
      setExcelLoading(false);
    }
  }

  async function handleUploadSurveyExcel(file: File) {
    if (!selectedReference || !profile?.schoolId || !surveyTableKey) {
      setExcelFeedback({ type: "error", text: "Pilih dulu Konsentrasi Keahlian sebelum upload Excel." });
      return;
    }
    try {
      setExcelLoading(true);
      setExcelFeedback(null);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetNameCandidates = [
        "Survey Harga Pasar",
        "Survey Harga",
        "survey",
        workbook.SheetNames.find((name) => /survey/i.test(name) || /harga/i.test(name)),
      ].filter((n): n is string => typeof n === "string" && !!workbook.Sheets[n]);
      const sheetName = sheetNameCandidates[0] ?? workbook.SheetNames[0] ?? "";
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
      const colKesesuaian = findCol(["Kesesuaian", "conformity"]);
      const colNama = findCol(["Nama Alat", "name"]);
      const colSpesifikasi = findCol(["Spesifikasi", "specification"]);
      const colKuantitas = findCol(["Kuantitas", "Jumlah", "quantity"]);
      const colSatuan = findCol(["Satuan", "unit"]);
      const colT1Nama = findCol(["Toko 1 - Nama Toko", "Nama Toko 1", "T1 Nama", "Toko 1 Nama"]);
      const colT1Harga = findCol(["Toko 1 - Harga + PPN (Rp)", "Harga Toko 1 (Rp)", "T1 Harga"]);
      const colT1Ongkir = findCol(["Toko 1 - Biaya Kirim (Rp)", "Ongkir Toko 1 (Rp)", "T1 Ongkir"]);
      const colT1Pasang = findCol(["Toko 1 - Biaya Pasang (Rp)", "Instalasi Toko 1 (Rp)", "T1 Pasang"]);
      const colT1Link = findCol(["Toko 1 - Link Produk", "Link Toko 1", "T1 Link"]);
      const colT2Nama = findCol(["Toko 2 - Nama Toko", "Nama Toko 2", "T2 Nama", "Toko 2 Nama"]);
      const colT2Harga = findCol(["Toko 2 - Harga + PPN (Rp)", "Harga Toko 2 (Rp)", "T2 Harga"]);
      const colT2Ongkir = findCol(["Toko 2 - Biaya Kirim (Rp)", "Ongkir Toko 2 (Rp)", "T2 Ongkir"]);
      const colT2Pasang = findCol(["Toko 2 - Biaya Pasang (Rp)", "Instalasi Toko 2 (Rp)", "T2 Pasang"]);
      const colT2Link = findCol(["Toko 2 - Link Produk", "Link Toko 2", "T2 Link"]);
      const colT3Nama = findCol(["Toko 3 - Nama Toko", "Nama Toko 3", "T3 Nama", "Toko 3 Nama"]);
      const colT3Harga = findCol(["Toko 3 - Harga + PPN (Rp)", "Harga Toko 3 (Rp)", "T3 Harga"]);
      const colT3Ongkir = findCol(["Toko 3 - Biaya Kirim (Rp)", "Ongkir Toko 3 (Rp)", "T3 Ongkir"]);
      const colT3Pasang = findCol(["Toko 3 - Biaya Pasang (Rp)", "Instalasi Toko 3 (Rp)", "T3 Pasang"]);
      const colT3Link = findCol(["Toko 3 - Link Produk", "Link Toko 3", "T3 Link"]);
      const toStringOrEmpty = (val: unknown) => {
        if (val == null || val === "") return "";
        const s = String(val).trim();
        if (s === "0") return "0";
        if (Number.isFinite(Number(s)) && !isNaN(Date.parse(s)) && !/\D/.test(s.replace(/[.,]/g, ""))) {
          const n = Number(s);
          return n >= 0 ? String(Math.round(n)) : s;
        }
        return s;
      };
      const toNumberRoundOrZero = (val: unknown) => {
        if (val == null || val === "") return 0;
        const s = String(val).trim().replace(/[^\d]/g, "");
        if (!s) return 0;
        const n = Number(s);
        return Number.isFinite(n) ? Math.round(n) : 0;
      };
      const dataAoaRows = rawAoa.slice(1).filter((r) => {
        const namaCell = colNama >= 0 ? String(r[colNama] ?? "").trim() : String(r[0] ?? "").trim();
        if (!namaCell) return false;
        if (namaCell.includes("CONTOH ISIAN") || namaCell.includes("contoh alat custom")) return false;
        return !namaCell.startsWith("---") && !namaCell.startsWith("=") && namaCell.length > 0;
      });
      const uploadedRows: ProposalRow[] = dataAoaRows.map((r, idx) => {
        const quantity = toStringOrEmpty(colKuantitas >= 0 ? r[colKuantitas] : "");
        return normalizeProposalRow({
          id: createRowId(),
          conformity: colKesesuaian >= 0 ? String(r[colKesesuaian] ?? "").trim() : "",
          name: colNama >= 0 ? String(r[colNama] ?? "").trim() : `Baris ${idx + 2}`,
          specification: colSpesifikasi >= 0 ? String(r[colSpesifikasi] ?? "").trim() : "",
          quantity,
          unit: colSatuan >= 0 ? String(r[colSatuan] ?? "").trim() : "",
          shop1: {
            name: colT1Nama >= 0 ? String(r[colT1Nama] ?? "").trim() : "",
            priceWithTax: colT1Harga >= 0 ? String(toNumberRoundOrZero(r[colT1Harga])) : "",
            shippingCost: colT1Ongkir >= 0 ? String(toNumberRoundOrZero(r[colT1Ongkir])) : "",
            installationCost: colT1Pasang >= 0 ? String(toNumberRoundOrZero(r[colT1Pasang])) : "",
            totalPrice: "",
            link: colT1Link >= 0 ? String(r[colT1Link] ?? "").trim() : "",
            siplahScreenshots: [],
          },
          shop2: {
            name: colT2Nama >= 0 ? String(r[colT2Nama] ?? "").trim() : "",
            priceWithTax: colT2Harga >= 0 ? String(toNumberRoundOrZero(r[colT2Harga])) : "",
            shippingCost: colT2Ongkir >= 0 ? String(toNumberRoundOrZero(r[colT2Ongkir])) : "",
            installationCost: colT2Pasang >= 0 ? String(toNumberRoundOrZero(r[colT2Pasang])) : "",
            totalPrice: "",
            link: colT2Link >= 0 ? String(r[colT2Link] ?? "").trim() : "",
            siplahScreenshots: [],
          },
          shop3: {
            name: colT3Nama >= 0 ? String(r[colT3Nama] ?? "").trim() : "",
            priceWithTax: colT3Harga >= 0 ? String(toNumberRoundOrZero(r[colT3Harga])) : "",
            shippingCost: colT3Ongkir >= 0 ? String(toNumberRoundOrZero(r[colT3Ongkir])) : "",
            installationCost: colT3Pasang >= 0 ? String(toNumberRoundOrZero(r[colT3Pasang])) : "",
            totalPrice: "",
            link: colT3Link >= 0 ? String(r[colT3Link] ?? "").trim() : "",
            siplahScreenshots: [],
          },
        });
      });
      setDraftTables((current) => {
        const existing = { ...current };
        existing[surveyTableKey] = uploadedRows;
        draftTablesRef.current = existing;
        return existing;
      });
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      await saveCurrentTable();
      setExcelFeedback({
        type: "success",
        text: `Berhasil upload Excel: ${uploadedRows.length} baris Survey Harga Pasar untuk ${selectedReference.concentrationName} tersimpan otomatis ke database.`,
      });
    } catch (err) {
      setExcelFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memproses file Excel. Pastikan formatnya sesuai template.",
      });
    } finally {
      setExcelLoading(false);
    }
  }

  if (!hydrated || !token) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
        Menyiapkan sesi sekolah...
      </div>
    );
  }

  function verifikasiApprovalVariant(status: boolean | null) {
    if (status === true) return "success";
    if (status === false) return "danger";
    return "warning";
  }
  function verifikasiApprovalLabel(status: boolean | null) {
    if (status === true) return "Disetujui";
    if (status === false) return "Ditolak";
    return "Belum Di Proses";
  }
  function formatVerifikasiDate(value: string | null | undefined) {
    if (!value) return "-";
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(d);
  }

  function resolveConcentrationNameForReviewKey(key: string) {
    if (!key) return "-";
    const cleaned = key.replace(/^pengajuan-kk-/, "").replace(/^kk-/, "").replace(/^pengajuan-/, "").trim();
    const direct = profile?.concentrations.find((item) => item.code === cleaned);
    if (direct) return `Pengajuan ${direct.code} - ${direct.name}`;
    if (profile?.concentrations?.length && /^\d/.test(cleaned)) {
      const matches = profile.concentrations.filter((item) =>
        cleaned.includes(item.code) || item.code.includes(cleaned.split("-")[0] ?? cleaned),
      );
      if (matches.length) return `Pengajuan ${matches.map((m) => `${m.code} - ${m.name}`).join(", ")}`;
    }
    return `Pengajuan ${key}`;
  }

  function renderReviewerStatusBlock(props: {
    reviewerBadge: React.ReactNode;
    approvedFlag: boolean | null | undefined;
    reviewedName: string | null | undefined;
    reviewedAt: string | null | undefined;
    reviewerLabel: "alat" | "admin";
    parsedNotes: StructuredReviewNotes;
  }) {
    const { reviewerBadge, approvedFlag, reviewedName, reviewedAt, reviewerLabel, parsedNotes } = props;
    const statusInfo = getReviewStatusStyle(approvedFlag, parsedNotes);
    const statusIcon =
      approvedFlag === true ? (
        <CheckCircle2 className="mr-1.5 h-3 w-3" />
      ) : approvedFlag === false ? (
        <XCircle className="mr-1.5 h-3 w-3" />
      ) : (
        <Clock4 className="mr-1.5 h-3 w-3" />
      );
    const reviewedNameText = reviewedName
      ? `Oleh ${reviewedName}`
      : reviewerLabel === "alat"
        ? "Belum ada review dari Fasilitator Alat"
        : "Belum ada review dari Fasilitator Administrasi";
    const reviewedDateText = reviewedAt ? ` • ${formatVerifikasiDate(reviewedAt)}` : "";
    const proposalCount = Object.keys(parsedNotes.proposals).length;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {reviewerBadge}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={`border rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
          >
            {statusIcon}
            {statusInfo.label}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          {reviewedNameText}
          {reviewedDateText}
        </p>

        {proposalCount > 0 ? (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-emerald-700" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900">
                  Catatan Review Pengajuan Alat Per Konsentrasi
                </p>
              </div>
              <Badge className="bg-white border-emerald-200 text-emerald-800 text-[11px]">
                {proposalCount} item
              </Badge>
            </div>
            <div className="space-y-2">
              {Object.entries(parsedNotes.proposals).map(([key, entry], idx) => {
                const statusStyle = getReviewStatusBadgeStyle(entry.status);
                return (
                  <div
                    key={`${key}-${idx}`}
                    className="rounded-[14px] border border-emerald-200/80 bg-white p-3 space-y-1.5 shadow-[0_1px_0_rgba(16,185,129,0.07)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {resolveConcentrationNameForReviewKey(key)}
                      </p>
                      <Badge className={`text-[10px] font-semibold tracking-wide ${statusStyle.className}`}>
                        {statusStyle.label}
                      </Badge>
                    </div>
                    {entry.note?.trim() ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
                        {entry.note.trim()}
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-slate-400">
                        Hanya status {statusStyle.label.toLowerCase()}, tanpa catatan tambahan.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
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

  const exclusiveHeader = exclusiveMode ? (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push(baseProposalRoute)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {exclusiveMode === "survey" ? "Survey Harga Pasar" : "RPKP — Rencana Pemenuhan Kebutuhan Peralatan"}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {exclusiveMode === "survey"
                ? "Data harga pasar peralatan yang sudah di-input sekolah sesuai konsentrasi keahlian."
                : "Pemenuhan kebutuhan peralatan (RPKP) sesuai jurusan rekomendasi Dinas beserta pilihan toko/sumber barang."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={
              autoSaveStatus === "saved"
                ? "success"
                : autoSaveStatus === "error"
                  ? "danger"
                  : autoSaveStatus === "saving"
                    ? "outline"
                    : "secondary"
            }
            className="rounded-full px-3 py-1"
          >
            {autoSaveStatus === "saving" ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Menyimpan...
              </>
            ) : autoSaveStatus === "saved" ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-700" />
                Tersimpan
              </>
            ) : autoSaveStatus === "error" ? (
              <>Gagal Menyimpan</>
            ) : (
              <>Belum Ada Perubahan</>
            )}
          </Badge>
        </div>
      </div>
      {profile && profile.concentrations && profile.concentrations.length > 1 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2.5">
            {profile.concentrations
              .filter((kk) => Boolean(kk.code) && kk.isAdminRecommendation === true)
              .sort((a, b) => compareConcentrationCode(a.code || "", b.code || ""))
              .map((kk) => {
                const isActive = kk.code === selectedConcentrationCode;
                return (
                  <Button
                    key={`kk-tab-${kk.code}`}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    size="default"
                    onClick={() => {
                      if (kk.code && kk.code !== selectedConcentrationCode) {
                        setSelectedConcentrationCode(kk.code);
                        try {
                          const nextUrl = new URL(window.location.href);
                          nextUrl.searchParams.set("kk", kk.code);
                          void router.replace(nextUrl.pathname + nextUrl.search, { scroll: false });
                        } catch {
                          const param = new URLSearchParams();
                          param.set("kk", kk.code);
                          void router.replace(`${window.location.pathname}?${param.toString()}`, { scroll: false });
                        }
                      }
                    }}
                    className={`gap-3 rounded-2xl px-5 py-3 text-sm font-bold transition min-h-[3rem] ${
                      isActive
                        ? "bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/30 border-2 border-primary"
                        : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[13px] font-extrabold tracking-tight ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-800"
                    }`}>
                      {kk.code}
                    </span>
                    <span className="truncate text-[14.5px] leading-tight">{kk.name || kk.code}</span>
                    <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-black ${
                      isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      {(() => {
                      try {
                        const sk = resolveTableKey(
                          isViewMode ? profile?.schoolId ?? "" : (session?.user?.id as string | undefined)?.trim() ?? profile?.schoolId ?? "",
                          kk.code,
                          exclusiveMode === "rpkp" ? "rpkp" : "survey",
                          draftTables,
                        );
                        const arr = (draftTables as Record<string, unknown[]>)?.[sk] ?? [];
                        return `${arr.length} item`;
                      } catch {
                        return "";
                      }
                    })()}
                    </span>
                  </Button>
                );
              })}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const bodyJsx = (
    <>
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

          {!loading && profile && profile.concentrations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Belum ada konsentrasi keahlian pada profil sekolah. Lengkapi dulu profil sekolah agar tabel ajuan alat bisa
              digunakan di halaman ini.
            </div>
          ) : null}

          {!loading && missingCodes.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Referensi alat belum ditemukan untuk kode konsentrasi: {missingCodes.join(", ")}.
            </div>
          ) : null}

          {!pagu.isLoading && paguAlatOver ? (
            <div className="rounded-2xl border border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100/50 px-4 py-3.5 text-sm text-rose-800 shadow-sm ring-1 ring-rose-200">
              <div className="flex flex-wrap items-center gap-2">
                <MessageSquareWarning className="h-4 w-4 shrink-0 text-rose-600" />
                <p className="font-semibold">
                  ⚠ Total RPKP melebihi batas Pagu Alat (RPKP) dari Dinas
                </p>
              </div>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-rose-600/70">Batas Pagu Alat:</span>{" "}
                  <span className="font-semibold">{IDR.format(paguAlatMax)}</span>
                </div>
                <div>
                  <span className="text-rose-600/70">Total RPKP sekarang:</span>{" "}
                  <span className="font-semibold">{IDR.format(rpkpGrandTotal)}</span>
                </div>
                <div>
                  <span className="text-rose-600/70">Kelebihan:</span>{" "}
                  <span className="font-bold text-rose-700">{IDR.format(paguAlatKelebihan)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-rose-700/90">
                Simpan data TIDAK DAPAT dilanjutkan sebelum total RPKP dikurangi. Kurangi pilihan toko
                yang lebih mahal atau kurangi quantity alat yang tidak urgent.
              </p>
            </div>
          ) : !pagu.isLoading && paguAlatMax > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-100">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold">
                  Batas Pagu Alat (RPKP): {IDR.format(paguAlatMax)}
                </span>
                <span className="text-emerald-700/80">
                  Terpakai: {rpkpGrandTotal > 0 ? IDR.format(rpkpGrandTotal) : "Rp 0"}
                </span>
                <span className="font-semibold text-emerald-700">
                  Sisa Kuota: {IDR.format(paguAlatSisa)}
                </span>
              </div>
            </div>
          ) : null}

          {viewMode !== "list" && findKkMeta(selectedConcentrationCode) ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
              {!forceActiveTab ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={backToList}
                  className="border-slate-700 bg-slate-700 text-white hover:bg-slate-800"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali ke Daftar Konsentrasi
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {findKkMeta(selectedConcentrationCode)!.code}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <span className="font-semibold text-slate-950">
                  {findKkMeta(selectedConcentrationCode)!.name}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <Badge
                  variant="outline"
                  className={
                    viewMode === "survey"
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : viewMode === "rpkp"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }
                >
                  {viewMode === "survey"
                    ? "Survey Harga Pasar"
                    : viewMode === "rpkp"
                      ? "RPKP"
                      : "RAB"}
                </Badge>
              </div>
            </div>
          ) : viewMode === "rab-global" ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-slate-200 bg-emerald-50 px-4 py-3">
              {!forceActiveTab ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={backToList}
                  className="border-slate-700 bg-slate-700 text-white hover:bg-slate-800"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali ke Daftar Konsentrasi
                </Button>
              ) : null}
              <Badge
                variant="secondary"
                className="border-emerald-300 bg-white text-emerald-800"
              >
                <Wrench className="mr-1.5 h-3 w-3" />
                RAB Seluruh Konsentrasi Keahlian ({concentrationRows.length} KK) — Seluruh Sekolah
              </Badge>
            </div>
          ) : null}

          {viewMode === "survey" && selectedReference && currentTableKey ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              {(() => {
                const globalNote = parsedEquipmentNotes.proposals["_global_pengajuan"];
                const bimtekGlobal = bimtekReview?.notes?.survey?.trim();
                const surveyStatus = bimtekReview?.statuses?.survey;
                const statusBadge = getReviewStatusBadgeStyle(surveyStatus ?? null);
                const textValue = bimtekGlobal || globalNote?.note?.trim() || "";
                const matchColor = (className: string) => {
                  if (className.includes("emerald")) return "emerald";
                  if (className.includes("rose")) return "rose";
                  if (className.includes("amber")) return "amber";
                  return "amber";
                };
                const c = matchColor(statusBadge.className);
                return (
                  <div>
                    <div className={`rounded-[18px] border p-4 shadow-sm ${
                      c === "emerald" ? "border-emerald-200 bg-emerald-50/40" :
                      c === "rose" ? "border-rose-200 bg-rose-50/40" :
                      "border-amber-200 bg-amber-50/40"
                    }`}>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <MessageSquareWarning className={`h-4 w-4 ${
                          c === "emerald" ? "text-emerald-700" :
                          c === "rose" ? "text-rose-700" :
                          "text-amber-700"
                        }`} />
                        <p className="text-[13px] font-bold text-slate-900 leading-none">
                          Catatan :
                        </p>
                        <Badge className={`rounded-full text-[10.5px] border ${statusBadge.className}`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                          Isi catatan Survey Harga
                        </p>
                        <textarea
                          value={textValue || ""}
                          rows={4}
                          disabled
                          readOnly
                          className="w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[12.5px] leading-6 text-slate-800 placeholder:text-slate-400 disabled:opacity-100 resize-none"
                          placeholder="Belum ada catatan Survey Harga dari Fasilitator."
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : viewMode === "rpkp" && selectedReference && currentTableKey ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              {(() => {
                const bimtekGlobal = bimtekReview?.notes?.rpkp?.trim();
                const rpkpStatus = bimtekReview?.statuses?.rpkp;
                const statusBadge = getReviewStatusBadgeStyle(rpkpStatus ?? null);
                const textValue = bimtekGlobal || "";
                const matchColor = (className: string) => {
                  if (className.includes("emerald")) return "emerald";
                  if (className.includes("rose")) return "rose";
                  if (className.includes("amber")) return "amber";
                  return "amber";
                };
                const c = matchColor(statusBadge.className);
                return (
                  <div>
                    <div className={`rounded-[18px] border p-4 shadow-sm ${
                      c === "emerald" ? "border-emerald-200 bg-emerald-50/40" :
                      c === "rose" ? "border-rose-200 bg-rose-50/40" :
                      "border-amber-200 bg-amber-50/40"
                    }`}>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <MessageSquareWarning className={`h-4 w-4 ${
                          c === "emerald" ? "text-emerald-700" :
                          c === "rose" ? "text-rose-700" :
                          "text-amber-700"
                        }`} />
                        <p className="text-[13px] font-bold text-slate-900 leading-none">
                          Catatan :
                        </p>
                        <Badge className={`rounded-full text-[10.5px] border ${statusBadge.className}`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                          Isi catatan RPKP
                        </p>
                        <textarea
                          value={textValue || ""}
                          rows={4}
                          disabled
                          readOnly
                          className="w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[12.5px] leading-6 text-slate-800 placeholder:text-slate-400 disabled:opacity-100 resize-none"
                          placeholder="Belum ada catatan RPKP dari Fasilitator."
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}

          {viewMode === "list" && !exclusiveMode && concentrationRows.length ? (
            <>
              <div className="rounded-[28px] border border-emerald-300/70 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50/60 px-6 py-5 shadow-[0_10px_30px_-15px_rgba(16,185,129,0.35)] ring-1 ring-emerald-200/60">
                <div className="grid gap-5 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-7 xl:col-span-8">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] ring-4 ring-white">
                        <Wrench className="h-7 w-7" />
                      </div>
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-[18.5px] font-extrabold text-emerald-950 leading-tight tracking-tight">
                            RAB — Rencana Anggaran Belanja Sekolah
                          </CardTitle>
                          <Badge variant="secondary" className="rounded-full border border-emerald-300/70 bg-white/90 text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-700 shadow-xs px-3 py-0.5">
                            Agregasi Real-Time
                          </Badge>
                        </div>
                        <p className="text-[12.5px] leading-6 text-emerald-900/80">
                          Total seluruh RAB = <strong className="tabular-nums text-emerald-900 font-bold">Rp {totalAllConcentrationsProposalValue.toLocaleString("id-ID")}</strong>
                          <span className="mx-1.5 text-emerald-700/60">·</span>
                          Dibulatkan ke Ribuan <strong className="tabular-nums text-emerald-900 font-bold">Rp {rabRoundedGrandTotal.toLocaleString("id-ID")}</strong>
                          <br className="hidden sm:block" />
                          <span className="text-emerald-800/70">Ringkasan agregasi Biaya Persiapan, Belanja Alat seluruh Konsentrasi Keahlian, dan Biaya Pendukung Pelatihan.</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-emerald-200/80 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 shadow-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            {concentrationRows.length} Konsentrasi Keahlian
                          </div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-emerald-200/80 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 shadow-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                            {concentrationRows.reduce((s, i) => s + i.studentCount, 0).toLocaleString("id-ID")} Siswa
                          </div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-emerald-200/80 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 shadow-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
                            {concentrationRows.reduce((s, i) => s + i.totalProposalItems, 0).toLocaleString("id-ID")} Item Alat
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 xl:col-span-4">
                    <div className="flex flex-col gap-3 w-full">
                      <div className="rounded-2xl border border-emerald-300/80 bg-white p-3.5 shadow-[0_6px_16px_-10px_rgba(16,185,129,0.5)] ring-1 ring-emerald-100">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-600/90">Grand Total RAB</div>
                            <div className="text-[22px] font-black tabular-nums leading-none text-emerald-950 tracking-tight">
                              Rp {rabRoundedGrandTotal.toLocaleString("id-ID")}
                            </div>
                          </div>
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200">
                            <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <path d="M3 7L12 11L21 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <path d="M12 11V21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 h-1 w-full rounded-full bg-emerald-100 overflow-hidden">
                          <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-full" />
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="lg"
                        variant="default"
                        onClick={openRabGlobal}
                        className="group w-full rounded-2xl border border-emerald-800/80 bg-gradient-to-br from-emerald-700 via-emerald-700 to-emerald-800 text-white hover:from-emerald-800 hover:via-emerald-800 hover:to-emerald-900 h-14 px-5 text-[14px] font-bold shadow-[0_14px_30px_-12px_rgba(4,120,87,0.8)] transition-all duration-200 hover:shadow-[0_18px_36px_-14px_rgba(4,120,87,0.9)] hover:-translate-y-0.5"
                      >
                        <Eye className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                        <span className="flex-1 text-left">Lihat RAB Lengkap Sekolah</span>
                        <span className="ml-1 inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider">
                          Detail
                          <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none">
                            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[980px] w-full text-[13.5px]">
                  <thead className="bg-slate-100/80 text-slate-600">
                    <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">
                      <th className="w-12 px-3 py-2.5 text-center">No</th>
                      <th className="px-3 py-2.5">Konsentrasi Keahlian</th>
                      <th className="w-36 px-3 py-2.5 text-right">Jumlah Siswa</th>
                      <th className="w-40 px-2.5 py-2.5 text-center">Survey Harga</th>
                      <th className="w-24 px-2.5 py-2.5 text-center">Alat</th>
                      <th className="w-32 px-2.5 py-2.5 text-center">RPKP</th>
                      <th className="w-44 px-3 py-2.5 text-right">Anggaran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {concentrationRows.map((item, idx) => {
                      const rowHasRpkpAndRab = (item.rpkpFilled ?? 0) > 0 && item.totalProposalValue > 0;
                      return (
                        <tr
                          key={item.code}
                          className={`transition border-l-4 ${
                            rowHasRpkpAndRab
                              ? "bg-emerald-50 hover:bg-emerald-100/80 border-l-emerald-400"
                              : "bg-white hover:bg-slate-50 border-l-transparent"
                          }`}
                        >
                          <td className="px-3 py-3 text-center align-middle font-semibold text-slate-500 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  {item.code}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-950 leading-snug">{item.name}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums align-middle">
                            {item.studentCount.toLocaleString("id-ID")}
                            <span className="ml-1.5 text-[11px] font-normal text-slate-500">siswa</span>
                          </td>
                          <td className="px-2 py-3 text-center align-middle">
                            {item.isSurveyFilled ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => openSurveyForKk(item.code)}
                                className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 h-8 px-2.5 text-xs"
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Survey
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => openSurveyForKk(item.code)}
                                className="border-rose-600 bg-rose-600 text-white hover:bg-rose-700 h-8 px-2.5 text-xs"
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Survey
                              </Button>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center align-middle">
                            <Badge variant="secondary" className="rounded-full border-slate-200 bg-slate-100 text-slate-700 tabular-nums px-2.5 py-0.5 text-[11px]">
                              {item.totalProposalItems} item
                            </Badge>
                          </td>
                          <td className="px-2 py-3 text-center align-middle">
                            {(item.rpkpFilled ?? 0) > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => openRpkpForKk(item.code)}
                                className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 h-8 px-2.5 text-xs"
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                RPKP
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => openRpkpForKk(item.code)}
                                className="border-rose-600 bg-rose-600 text-white hover:bg-rose-700 h-8 px-2.5 text-xs"
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                RPKP
                              </Button>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right align-middle tabular-nums">
                            <div className="flex flex-col items-end gap-1.5">
                              {item.totalProposalValue > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRabForKk(item.code);
                                  }}
                                  className="inline-flex cursor-pointer items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                                >
                                  Rp {item.totalProposalValue.toLocaleString("id-ID")}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                              {item.rpkpTotal > 0 ? (
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 tabular-nums">
                                  {item.rpkpFilled ?? 0} Dipilih
                                </span>
                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 tabular-nums">
                                  {(item.rpkpTotal ?? 0) - (item.rpkpFilled ?? 0)} Tidak Dipilih
                                </span>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr className="border-t border-slate-200 text-[13px] font-semibold text-slate-950">
                      <td colSpan={2} className="px-3 py-2.5 text-right uppercase tracking-[0.16em] text-slate-600 text-[11px]">
                        Total {concentrationRows.length} Konsentrasi Keahlian
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {concentrationRows.reduce((s, i) => s + i.studentCount, 0).toLocaleString("id-ID")} siswa
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-500 text-[10.5px] uppercase tracking-[0.16em]" colSpan={2}>
                        Total Alat
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums" colSpan={2}>
                        <Badge variant="secondary" className="rounded-full border-slate-300 bg-white text-slate-700 tabular-nums px-2.5 py-0.5 text-[11px]">
                          {totalAllConcentrationsProposalItems} item
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>


              {/* [CARD DIPINDAH] Biaya Persiapan & Pelaporan dipindah ke halaman sendiri /sekolah/pengajuan/data-persiapan */}
              {/* [CARD DIPINDAH] Biaya Pendukung Uji Fungsi & Pelatihan dipindah ke /sekolah/pengajuan/data-pelatihan */}

              <Card className="rounded-[24px] border border-slate-200 shadow-sm">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="border border-primary/15 bg-white text-primary">
                        <NotebookPen className="mr-1.5 h-3.5 w-3.5" />
                        Catatan Umum Fasilitator Alat
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void refreshVerifikasiReview()}
                      disabled={refreshingVerifikasi || loading || !profile?.npsn}
                      className="gap-2"
                    >
                      {refreshingVerifikasi ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refresh Catatan
                    </Button>
                  </div>
                  <CardTitle className="text-lg text-slate-950">Catatan Umum dari Fasilitator Alat</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="border border-emerald-300 bg-white text-emerald-800">
                        <Wrench className="mr-1.5 h-3.5 w-3.5" />
                        Pra Bimtek
                      </Badge>
                      {verifikasiReview?.reviewedEquipmentName ? (
                        <Badge className="rounded-full border-emerald-200 bg-white text-emerald-700 text-[11px]">
                          Oleh {verifikasiReview.reviewedEquipmentName}
                        </Badge>
                      ) : null}
                    </div>
                    <textarea
                      value={parsedEquipmentNotes.globalNote || ""}
                      rows={6}
                      disabled
                      readOnly
                      className="w-full rounded-2xl border border-emerald-200/80 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-[0_1px_0_rgba(16,185,129,0.08)] placeholder:text-slate-400 disabled:opacity-100 resize-none"
                      placeholder="Belum ada catatan Pra Bimtek dari Fasilitator Alat."
                    />
                  </div>

                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/45 p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary" className="border border-indigo-300 bg-white text-indigo-800">
                        <Wrench className="mr-1.5 h-3.5 w-3.5" />
                        Bimtek
                      </Badge>
                      <div className="flex flex-wrap gap-1.5">
                        {(["survey", "rpkp", "rab"] as const).map((key) => {
                          const raw = bimtekReview?.statuses?.[key];
                          const statusBadge = getReviewStatusBadgeStyle(raw);
                          const label = key === "survey" ? "Survey" : key === "rpkp" ? "RPKP" : "RAB";
                          return (
                            <Badge key={`bimtek-status-${key}`} className={`rounded-full text-[10.5px] ${statusBadge.className}`}>
                              {label} {statusBadge.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    {bimtekReview?.facilitatorEquipmentName ? (
                      <p className="text-xs text-slate-500">
                        Oleh {bimtekReview.facilitatorEquipmentName}
                        {bimtekReview.updatedAt ? ` • ${formatVerifikasiDate(bimtekReview.updatedAt)}` : ""}
                      </p>
                    ) : null}
                    <textarea
                      value={
                        (bimtekReview?.notes?.survey || "") +
                        (bimtekReview?.notes?.rpkp ? `\n--- [RPKP] ---\n${bimtekReview.notes.rpkp}` : "") +
                        (bimtekReview?.notes?.rab ? `\n--- [RAB] ---\n${bimtekReview.notes.rab}` : "")
                      }
                      rows={6}
                      disabled
                      readOnly
                      className="w-full rounded-2xl border border-indigo-200/80 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-[0_1px_0_rgba(79,70,229,0.08)] placeholder:text-slate-400 disabled:opacity-100 resize-none"
                      placeholder="Belum ada catatan Bimtek dari Fasilitator Alat."
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {(viewMode === "survey" || viewMode === "rpkp" || viewMode === "rab-kk" || viewMode === "rab-global") && selectedReference && currentTableKey ? (
            <section className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4">
              {!exclusiveMode && (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="inline-flex flex-wrap rounded-2xl bg-slate-100 p-1">
                    <Link
                      href={`${baseProposalRoute}/surveyharga`}
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                        activeProposalTab === "survey" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Survey Harga Pasar
                    </Link>
                    <Link
                      href={`${baseProposalRoute}/rpkp`}
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                        activeProposalTab === "rpkp" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                      }`}
                    >
                      RPKP
                    </Link>
                    <Link
                      href={`${baseProposalRoute}/rab`}
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                        activeProposalTab === "rab" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveProposalTab("rab");
                        openRabGlobal();
                      }}
                    >
                      RAB
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-950">
                    {viewMode === "survey"
                      ? "Survey Harga Pasar"
                      : viewMode === "rpkp"
                        ? "RPKP - Rencana Pemenuhan Kebutuhan Peralatan"
                        : viewMode === "rab-kk"
                          ? "RAB Per Konsentrasi Keahlian"
                          : "RAB - Rencana Anggaran Belanja Seluruh Konsentrasi"}
                  </p>
                  <p className="text-xs text-slate-500 leading-6">
                    {viewMode === "survey"
                      ? ""
                      : viewMode === "rpkp"
                        ? ""
                        : viewMode === "rab-kk"
                          ? "Rincian anggaran belanja HANYA untuk 1 konsentrasi keahlian yang dipilih. Jumlah otomatis berubah REAL-TIME mengikuti pilihan toko di RPKP (bahkan sebelum di-save). Hanya footer Total RAB Keseluruhan Sekolah yang dibulatkan ke ribuan rupiah."
                          : "RAB (Rencana Anggaran Belanja) dihitung OTOMATIS sebagai RINGKASAN TOTAL dari SELURUH RPKP per Konsentrasi Keahlian. Setiap total RPKP per Konsentrasi (KK) dijumlahkan menjadi 1 total keseluruhan sekolah. Klik nama KK untuk expand rincian alat per KK."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {viewMode === "rab-global" ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1 border-emerald-200 bg-emerald-50 text-emerald-800">
                      <CheckCircle2 className="mr-1.5 h-3 w-3" />
                      {concentrationRows.length} Konsentrasi Keahlian
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedReference.concentrationCode} - {selectedReference.concentrationName}
                    </Badge>
                  )}
                  {viewMode.startsWith("rab") ? (
                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1 border-emerald-300 bg-emerald-50 text-emerald-800"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-700" />
                      Tersinkron Otomatis dari RPKP
                    </Badge>
                  ) : (
                    <Badge
                      variant={
                        autoSaveStatus === "saved"
                          ? "success"
                          : autoSaveStatus === "error"
                            ? "danger"
                            : autoSaveStatus === "saving"
                              ? "outline"
                              : "secondary"
                      }
                      className="rounded-full px-3 py-1"
                    >
                      {autoSaveStatus === "saving" ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Menyimpan...
                        </>
                      ) : autoSaveStatus === "saved" ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-700" />
                          Tersimpan
                        </>
                      ) : autoSaveStatus === "error" ? (
                        <>Gagal Menyimpan</>
                      ) : (
                        <>Belum Ada Perubahan</>
                      )}
                    </Badge>
                  )}
                  {(viewMode === "survey" || viewMode === "rpkp") ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={openAddProposalModal}
                      className="bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/20"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Ajuan Alat
                    </Button>
                  ) : null}
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

              {viewMode === "rpkp" ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1200px] w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="w-16 px-3 py-3">No</th>
                        <th className="min-w-[240px] px-3 py-3">Nama Alat</th>
                        <th className="min-w-[360px] px-3 py-3">Fungsi & Spesifikasi</th>
                        <th className="min-w-[280px] px-3 py-3">Total Estimasi Harga</th>
                        <th className="w-60 px-3 py-3 text-right">Aksi Simpan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {rpkpRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-sm text-slate-600">
                            Belum ada data ajuan alat pada tab Survey Harga Pasar untuk konsentrasi ini.
                          </td>
                        </tr>
                      ) : (
                        rpkpRows.map((row, index) => {
                          const isDirty = dirtyRpkpRows.has(row.id);
                          const isSaving = rpkpRowSaving === row.id;
                          return (
                            <tr
                              key={row.id}
                              className={`align-top transition ${isDirty ? "bg-amber-50 border-l-4 border-l-amber-400" : "border-l-4 border-l-transparent"}`}
                            >
                              <td className="px-3 py-3 text-sm font-semibold text-slate-500">{index + 1}</td>
                              <td className="px-3 py-3 font-semibold text-slate-900">{row.name || "-"}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="text-[12.5px] leading-5 text-slate-700 line-clamp-2">
                                      <span className="font-semibold text-slate-900">Fungsi: </span>
                                      <span>{row.functionText || "-"}</span>
                                    </div>
                                    <div className="text-[12.5px] leading-5 text-slate-600 line-clamp-3">
                                      <span className="font-semibold text-slate-800">Spesifikasi: </span>
                                      <span>{row.specification || "-"}</span>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSpecPreviewState({
                                        title: row.name || "Detail Spesifikasi Alat",
                                        text: row.specification || "-",
                                        functionText: row.functionText || "",
                                      });
                                    }}
                                    title="Lihat detail fungsi & spesifikasi"
                                    className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shrink-0"
                                  >
                                    <ZoomIn className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="space-y-2">
                                  <select
                                    value={row.selectedShop}
                                    onChange={(event) => updateRpkpSelection(row.id, event.target.value as ShopKey | "")}
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                                  >
                                    <option value="">Tidak Dipilih</option>
                                    {shopConfigs.map((shop) => (
                                      <option key={shop.key} value={shop.key}>
                                        {shop.label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className={`rounded-lg border px-3 py-2 ${isDirty ? "border-amber-300 bg-amber-100/60" : "border-slate-200 bg-slate-50"}`}>
                                    <p className={`text-xs uppercase tracking-[0.16em] ${isDirty ? "text-amber-700" : "text-slate-500"}`}>Nilai Estimasi {isDirty ? "· Belum Disimpan" : ""}</p>
                                    <p className="mt-1 font-semibold text-slate-950">
                                      {row.selectedQuote.totalPrice ? `Rp ${row.selectedQuote.totalPrice}` : "-"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right align-top">
                                <div className="flex flex-col items-end gap-2">
                                  {isDirty ? (
                                    <>
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="default"
                                          onClick={() => void saveOneRpkpRow(row.id)}
                                          disabled={isSaving}
                                          className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white shadow-sm disabled:opacity-60"
                                        >
                                          {isSaving ? (
                                            <>
                                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                              Menyimpan
                                            </>
                                          ) : (
                                            <>
                                              <Save className="mr-1.5 h-3.5 w-3.5" />
                                              Simpan Baris
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => resetOneRpkpRow(row.id)}
                                          disabled={isSaving}
                                          className="text-slate-600"
                                        >
                                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                          Reset
                                        </Button>
                                      </div>
                                      <span className="rounded-full bg-amber-200/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                                        Perubahan belum tersimpan
                                      </span>
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-end gap-1">
                                      <Badge
                                        variant="success"
                                        className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800"
                                      >
                                        <CheckCircle2 className="mr-1.5 h-3 w-3" />
                                        Tersimpan
                                      </Badge>
                                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                                        Tidak ada perubahan
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {rpkpRows.length > 0 ? (
                      <tfoot className="bg-slate-50">
                        <tr className="border-t border-slate-200">
                          <td colSpan={5} className="px-3 py-3 text-right text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
                            Total
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-slate-950">
                            Rp {rpkpGrandTotal.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              ) : viewMode === "rab-kk" || viewMode === "rab-global" ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
                    <Badge variant="secondary" className="border-emerald-300 bg-white text-emerald-800">
                      <Wrench className="mr-1.5 h-3 w-3" />
                      Catatan Perhitungan RAB
                    </Badge>
                    <p className="leading-6">
                      {viewMode === "rab-kk"
                        ? <>RAB ini <strong>hanya menampilkan 1 Konsentrasi Keahlian (KK) terpilih</strong> + <strong>Biaya Persiapan & Pelatihan</strong> (bersifat global). Total otomatis real-time recalc jika Anda ubah pilihan toko RPKP / tambah/kurangi barang Survey / ubah nominal Persiapan atau Pelatihan.</>
                        : <>RAB ini merupakan <strong>total agregasi dari seluruh RPKP per Konsentrasi Keahlian (KK)</strong> + <strong>Biaya Persiapan & Pelatihan</strong> (bersifat global). Setiap baris mewakili 1 KK = total semua barang di Survey + pilihan toko RPKP. Jumlah otomatis berubah REAL-TIME.</>}
                    </p>
                  </div>

                  <Card className="overflow-hidden border-indigo-200 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border-b border-indigo-200 py-3 px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                          <NotebookPen className="h-4 w-4 text-indigo-700" />
                          1. Biaya Persiapan &amp; Pelaporan
                        </CardTitle>
                        <Badge variant="secondary" className="border-indigo-200 bg-white text-indigo-800 text-[11px] font-bold tabular-nums">
                          {card1BiayaPersiapan.length} kegiatan · Subtotal: Rp {totalCardBiayaPersiapan.toLocaleString("id-ID")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full text-sm">
                          <thead className="bg-indigo-50/40 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                            <tr className="border-b border-indigo-100">
                              <th className="w-14 px-4 py-3">No</th>
                              <th className="min-w-[260px] px-4 py-3">Kegiatan Persiapan / Pelaporan</th>
                              <th className="min-w-[120px] px-4 py-3 text-right">Jumlah Kegiatan</th>
                              <th className="min-w-[220px] px-4 py-3 text-right">Standar Biaya SBM (Rp)</th>
                              <th className="min-w-[240px] px-4 py-3 text-right">Subtotal (Rp)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50 bg-white">
                            {card1BiayaPersiapan.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400 italic">
                                  Belum ada data Biaya Persiapan &amp; Pelaporan.
                                </td>
                              </tr>
                            ) : (
                              card1BiayaPersiapan.map((row, i) => {
                                const subtotal = row.quantity * row.sbmSatuanRp;
                                return (
                                  <tr key={row.id} className="hover:bg-indigo-50/30">
                                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{i + 1}</td>
                                    <td className="px-4 py-3 text-slate-900 font-medium leading-5">
                                      {row.name || <span className="text-slate-400 italic">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                                      {row.quantity.toLocaleString("id-ID")}
                                      <span className="ml-1.5 text-[11px] text-slate-400 font-normal">x</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                                      Rp {row.sbmSatuanRp.toLocaleString("id-ID")}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-indigo-900 tabular-nums">
                                      Rp {subtotal.toLocaleString("id-ID")}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          {card1BiayaPersiapan.length > 0 && (
                            <tfoot className="bg-indigo-50/70">
                              <tr className="border-t border-indigo-200">
                                <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-indigo-800">
                                  TOTAL BIAYA PERSIAPAN &amp; PELAPORAN
                                </td>
                                <td className="px-4 py-3 text-right font-extrabold text-indigo-950 tabular-nums text-sm">
                                  Rp {totalCardBiayaPersiapan.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 m-0">
                        <Wrench className="h-4 w-4 text-slate-700" />
                        2. Belanja Alat — {viewMode === "rab-kk" ? "Per Konsentrasi Keahlian" : "Seluruh Konsentrasi Keahlian"}
                      </CardTitle>
                      <Badge variant="secondary" className="border-slate-200 bg-white text-slate-800 text-[11px] font-bold tabular-nums">
                        {totalAllConcentrationsProposalItems.toLocaleString("id-ID")} item · {totalAllConcentrationsUnits.toLocaleString("id-ID")} unit · Subtotal: Rp {totalAllConcentrationsProposalValueOnlyTools.toLocaleString("id-ID")}
                      </Badge>
                    </div>
                    <table className="min-w-[1180px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <tr className="border-b border-slate-200">
                          <th className="w-12 px-2 py-3"></th>
                          <th className="w-16 px-4 py-3">No</th>
                          <th className="min-w-[180px] px-4 py-3">Kode KK</th>
                          <th className="min-w-[340px] px-4 py-3">Konsentrasi Keahlian</th>
                          <th className="min-w-[160px] px-4 py-3 text-right">Jumlah Item Alat</th>
                          <th className="min-w-[160px] px-4 py-3 text-right">Total Unit Dibeli</th>
                          <th className="min-w-[260px] px-4 py-3 text-right">Total Nilai RPKP (Menjadi RAB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {(() => {
                          const rabAllRows = concentrationRows;
                          const rabViewRows = viewMode === "rab-kk" && selectedConcentrationCode
                            ? rabAllRows.filter((k) => k.code === selectedConcentrationCode)
                            : rabAllRows;
                          const emptyMsg = viewMode === "rab-kk"
                            ? "Konsentrasi keahlian ini belum punya isi Survey Harga Pasar / RPKP. Silakan buka tab Survey Harga Pasar & RPKP untuk KK ini."
                            : "Belum ada isi Survey Harga Pasar / RPKP di semua Konsentrasi Keahlian. Silakan buka Survey Harga Pasar & RPKP per KK untuk menampilkan RAB total.";
                          const noDataMsg = viewMode === "rab-kk"
                            ? "Belum bisa menampilkan RAB detail untuk KK ini."
                            : "Belum ada data Konsentrasi Keahlian.";
                          return rabViewRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-6 text-sm text-slate-600">
                                {noDataMsg}
                              </td>
                            </tr>
                          ) : rabViewRows.every((kk) => kk.totalProposalItems === 0) ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-6 text-sm text-slate-600">
                                {emptyMsg}
                              </td>
                            </tr>
                          ) : (
                            rabViewRows.flatMap((kk, index) => {
                            const isExpanded = viewMode === "rab-kk" ? true : expandedRabCodes.has(kk.code);
                            const toggleExpand = () => {
                              setExpandedRabCodes((prev) => {
                                const next = new Set(prev);
                                if (next.has(kk.code)) {
                                  next.delete(kk.code);
                                } else {
                                  next.add(kk.code);
                                }
                                return next;
                              });
                            };
                            return [
                              <tr key={kk.code} className={kk.totalProposalItems === 0 ? "opacity-60" : ""}>
                                <td className="px-2 py-3.5 align-top">
                                  {kk.totalProposalItems > 0 ? (
                                    <button
                                      type="button"
                                      onClick={toggleExpand}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                      aria-label={isExpanded ? "Sembunyikan rincian alat" : "Tampilkan rincian alat"}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3.5 text-sm font-semibold text-slate-500">{index + 1}</td>
                                <td className="px-4 py-3.5">
                                  <Badge className="bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold tracking-wide">
                                    {kk.code}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3.5 font-semibold text-slate-900 leading-6">{kk.name}</td>
                                <td className="px-4 py-3.5 text-right text-slate-700 font-semibold tabular-nums">
                                  {kk.totalProposalItems.toLocaleString("id-ID")}
                                  <span className="ml-1.5 text-[11px] text-slate-400 font-normal">item</span>
                                </td>
                                <td className="px-4 py-3.5 text-right text-slate-700 font-semibold tabular-nums">
                                  {(kk.totalUnits ?? 0).toLocaleString("id-ID")}
                                  <span className="ml-1.5 text-[11px] text-slate-400 font-normal">unit</span>
                                </td>
                                <td className="px-4 py-3.5 text-right text-slate-950 font-bold tabular-nums text-base">
                                  {kk.totalProposalValue > 0
                                    ? `Rp ${kk.totalProposalValue.toLocaleString("id-ID")}`
                                    : <span className="text-slate-400 italic font-normal text-xs">Belum ada RPKP</span>}
                                </td>
                              </tr>,
                              isExpanded && kk.equipmentDetails?.length ? (
                                <tr key={`${kk.code}__detail`} className="bg-indigo-50/40">
                                  <td colSpan={7} className="px-4 py-4">
                                    <div className="pl-8">
                                      <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary" className="border-indigo-200 bg-white text-indigo-700 text-[11px] font-bold tracking-wide">
                                          <Wrench className="mr-1.5 h-3 w-3" />
                                          Rincian Alat Dibeli — {kk.name}
                                        </Badge>
                                      </div>
                                      <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white">
                                        <table className="min-w-full w-full text-sm">
                                          <thead className="bg-indigo-50/60 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                                            <tr className="border-b border-indigo-100">
                                              <th className="w-12 px-3 py-2.5">No</th>
                                              <th className="min-w-[320px] px-3 py-2.5">Nama Alat</th>
                                              <th className="min-w-[120px] px-3 py-2.5 text-right">Jumlah</th>
                                              <th className="min-w-[220px] px-3 py-2.5 text-right">Harga Satuan (Rp)</th>
                                              <th className="min-w-[240px] px-3 py-2.5 text-right">Total (Rp)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-indigo-50 bg-white">
                                            {kk.equipmentDetails.map((eq, eqIndex) => (
                                              <tr key={eq.id} className="hover:bg-indigo-50/30">
                                                <td className="px-3 py-2.5 text-xs font-semibold text-slate-500">{eqIndex + 1}</td>
                                                <td className="px-3 py-2.5 text-slate-900 font-medium leading-5">{eq.name || <span className="text-slate-400 italic">—</span>}</td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-slate-800 tabular-nums">{eq.quantity.toLocaleString("id-ID")}</td>
                                                <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                                                  {eq.unitPrice > 0 ? `Rp ${eq.unitPrice.toLocaleString("id-ID")}` : <span className="text-slate-400 italic">—</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-slate-950 tabular-nums">
                                                  {eq.subtotal > 0 ? `Rp ${eq.subtotal.toLocaleString("id-ID")}` : <span className="text-slate-400 italic">—</span>}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          {kk.totalProposalValue > 0 ? (
                                            <tfoot className="bg-indigo-50/70">
                                              <tr className="border-t border-indigo-100">
                                                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.16em] text-indigo-800">
                                                  Subtotal {kk.code}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-indigo-900 tabular-nums text-sm">
                                                  Rp {kk.totalProposalValue.toLocaleString("id-ID")}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          ) : null}
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null,
                            ];
                          })
                        );
                        })()}
                      </tbody>
                      {(() => {
                        if (viewMode === "rab-kk" && selectedConcentrationCode) {
                          const kk = concentrationRows.find((k) => k.code === selectedConcentrationCode);
                          if (!kk || kk.totalProposalValue <= 0) return null;
                          return (
                            <tfoot className="bg-slate-50">
                              <tr className="border-t border-slate-200">
                                <td colSpan={4} className="px-4 py-3.5 text-right text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
                                  Subtotal Belanja Alat — {kk.code}
                                </td>
                                <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums">
                                  {kk.totalProposalItems.toLocaleString("id-ID")}
                                  <span className="ml-1.5 text-[11px] text-slate-500 font-normal">item</span>
                                </td>
                                <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums">
                                  {(kk.totalUnits ?? 0).toLocaleString("id-ID")}
                                  <span className="ml-1.5 text-[11px] text-slate-500 font-normal">unit</span>
                                </td>
                                <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums text-base">
                                  Rp {kk.totalProposalValue.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            </tfoot>
                          );
                        }
                        if (totalAllConcentrationsProposalValueOnlyTools <= 0) return null;
                        return (
                          <tfoot className="bg-slate-50">
                            <tr className="border-t border-slate-200">
                              <td colSpan={4} className="px-4 py-3.5 text-right text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
                                Subtotal Belanja Alat Seluruh Konsentrasi
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums">
                                {totalAllConcentrationsProposalItems.toLocaleString("id-ID")}
                                <span className="ml-1.5 text-[11px] text-slate-500 font-normal">item</span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums">
                                {totalAllConcentrationsUnits.toLocaleString("id-ID")}
                                <span className="ml-1.5 text-[11px] text-slate-500 font-normal">unit</span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-950 tabular-nums text-base">
                                Rp {totalAllConcentrationsProposalValueOnlyTools.toLocaleString("id-ID")}
                              </td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  </div>

                  <Card className="overflow-hidden border-violet-200 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-violet-50 to-violet-100/50 border-b border-violet-200 py-3 px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-violet-900 flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-violet-700" />
                          3. Biaya Pendukung Uji Fungsi &amp; Pelatihan
                        </CardTitle>
                        <Badge variant="secondary" className="border-violet-200 bg-white text-violet-800 text-[11px] font-bold tabular-nums">
                          {card2BiayaPelatihan.length} produk · Subtotal: Rp {totalCardBiayaPelatihan.toLocaleString("id-ID")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1180px] w-full text-sm">
                          <thead className="bg-violet-50/40 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                            <tr className="border-b border-violet-100">
                              <th className="w-14 px-4 py-3">No</th>
                              <th className="min-w-[320px] px-4 py-3">Nama Alat / Produk Pelatihan</th>
                              <th className="min-w-[140px] px-4 py-3 text-right">Jumlah Unit</th>
                              <th className="min-w-[200px] px-4 py-3 text-center">Butuh Pelatihan</th>
                              <th className="min-w-[240px] px-4 py-3 text-right">Total Biaya Pelatihan (Rp)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-violet-50 bg-white">
                            {card2BiayaPelatihan.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400 italic">
                                  Belum ada data Biaya Pendukung Uji Fungsi &amp; Pelatihan.
                                </td>
                              </tr>
                            ) : (
                              card2BiayaPelatihan.map((row, i) => {
                                const subtotalRow = row.butuhPelatihan ? row.totalBiayaPelatihanRp : 0;
                                return (
                                  <tr key={row.id} className={`${row.butuhPelatihan ? "hover:bg-violet-50/30" : "bg-slate-50/60"}`}>
                                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{i + 1}</td>
                                    <td className="px-4 py-3 text-slate-900 font-medium leading-5">
                                      {row.productName || <span className="text-slate-400 italic">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                                      {Number(row.refQtySurvey ?? 1) > 0 ? (
                                        <>
                                          <span className="inline-flex flex-col items-end leading-tight">
                                            <span className="text-[11.5px] font-extrabold text-slate-900">{Number(row.refQtySurvey ?? 1).toLocaleString("id-ID")}</span>
                                            <span className="text-[9.5px] font-normal text-slate-400">unit</span>
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-slate-400 italic font-normal text-xs">Belum diisi</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {row.butuhPelatihan ? (
                                        <Badge className="bg-violet-100 border-violet-200 text-violet-900 text-[11px] font-bold">
                                          ✅ Ya, butuh pelatihan
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-slate-100 border-slate-200 text-slate-600 text-[11px] font-bold">
                                          ❌ Tidak perlu
                                        </Badge>
                                      )}
                                    </td>
                                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${row.butuhPelatihan ? "text-violet-900" : "text-slate-400"}`}>
                                      {row.butuhPelatihan
                                        ? subtotalRow > 0 ? `Rp ${subtotalRow.toLocaleString("id-ID")}` : <span className="text-slate-400 italic font-normal text-xs">Belum diisi</span>
                                        : <span className="italic font-normal">— (tidak butuh)</span>}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          {card2BiayaPelatihan.some((r: BiayaPelatihanRow) => r.butuhPelatihan) && totalCardBiayaPelatihan > 0 && (
                            <tfoot className="bg-violet-50/70">
                              <tr className="border-t border-violet-200">
                                <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-violet-800">
                                  TOTAL BIAYA PELATIHAN (yang butuh saja)
                                </td>
                                <td className="px-4 py-3 text-right font-extrabold text-violet-950 tabular-nums text-sm">
                                  Rp {totalCardBiayaPelatihan.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-emerald-300 shadow-md ring-1 ring-emerald-100">
                    <CardHeader className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 py-4 px-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-white flex items-center gap-2.5">
                          <ClipboardList className="h-5 w-5 text-emerald-100" />
                          <span className="text-base font-extrabold tracking-wide">RINGKASAN TOTAL RAB KESELURUHAN</span>
                        </CardTitle>
                        <Badge variant="secondary" className="border-emerald-200/30 bg-white/95 text-emerald-900 text-xs font-extrabold tabular-nums px-3 py-1.5">
                          Dibulatkan ke Ribuan: Rp {rabRoundedGrandTotal.toLocaleString("id-ID")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-[720px] w-full text-sm">
                          <tbody className="divide-y divide-emerald-50 bg-white">
                            <tr>
                              <td className="w-12 bg-emerald-50/50 px-5 py-3.5 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-700">A</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                                  Biaya Persiapan &amp; Pelaporan
                                </span>
                              </td>
                              <td className="w-64 px-5 py-3.5 text-right font-bold text-indigo-900 tabular-nums text-sm">
                                Rp {totalCardBiayaPersiapan.toLocaleString("id-ID")}
                              </td>
                            </tr>
                            <tr>
                              <td className="w-12 bg-emerald-50/50 px-5 py-3.5 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-slate-700">B</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full bg-slate-600"></span>
                                  Belanja Alat {viewMode === "rab-kk" ? "(1 Konsentrasi Keahlian)" : "(Seluruh Konsentrasi Keahlian)"}
                                </span>
                              </td>
                              <td className="w-64 px-5 py-3.5 text-right font-bold text-slate-950 tabular-nums text-sm">
                                Rp {totalAllConcentrationsProposalValueOnlyTools.toLocaleString("id-ID")}
                              </td>
                            </tr>
                            <tr>
                              <td className="w-12 bg-emerald-50/50 px-5 py-3.5 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-violet-700">C</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500"></span>
                                  Biaya Pendukung Uji Fungsi &amp; Pelatihan
                                </span>
                              </td>
                              <td className="w-64 px-5 py-3.5 text-right font-bold text-violet-900 tabular-nums text-sm">
                                Rp {totalCardBiayaPelatihan.toLocaleString("id-ID")}
                              </td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr className="bg-emerald-50/60">
                              <td colSpan={2} className="px-5 py-4 text-right text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">
                                TOTAL RAB (A + B + C)
                              </td>
                              <td className="w-64 px-5 py-4 text-right font-extrabold text-emerald-950 tabular-nums text-lg">
                                Rp {totalAllConcentrationsProposalValue.toLocaleString("id-ID")}
                              </td>
                            </tr>
                            <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 border-t-2 border-emerald-200">
                              <td colSpan={2} className="px-5 py-4 text-right text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-900">
                                TOTAL RAB (Dibulatkan ke Ribuan)
                              </td>
                              <td className="w-64 px-5 py-4 text-right font-black text-emerald-700 tabular-nums text-xl">
                                Rp {rabRoundedGrandTotal.toLocaleString("id-ID")}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : viewMode === "survey" ? (
                <div className="space-y-1 rounded-[14px] border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div
                    ref={(el) => { surveyScrollSyncRef.current.top = el; }}
                    className="overflow-x-auto border-b border-slate-200 bg-slate-50 [scrollbar-width:thin]"
                    style={{ maxHeight: "18px" }}
                  >
                    <div style={{ width: "1900px", height: "1px", paddingTop: "1px" }}></div>
                  </div>
                  <div
                    ref={(el) => { surveyScrollSyncRef.current.bottom = el; }}
                    className="overflow-x-auto [scrollbar-width:thin]"
                  >
                    <table className="min-w-[1900px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <th className="min-w-[190px] px-3 py-3 align-middle sticky left-0 bg-slate-50 z-10">Aksi</th>
                          <th className="w-16 px-3 py-3 align-middle">No</th>
                          <th className="min-w-[220px] px-3 py-3 align-middle">Nama Alat</th>
                          <th className="min-w-[100px] px-3 py-3 align-middle text-center">Spesifikasi</th>
                          <th className="min-w-[150px] px-3 py-3 align-middle text-center">Kesesuaian</th>
                          <th className="min-w-[120px] px-3 py-3 align-middle">Jumlah</th>
                          <th className="min-w-[120px] px-3 py-3 align-middle">Satuan</th>
                          <th className="min-w-[280px] px-3 py-3 align-middle border-l border-slate-200">Bukti Screenshot SIPLAH</th>
                          <th colSpan={3} className="min-w-[520px] border-l border-slate-200 px-3 py-3 align-middle text-center">
                            Detail Anggaran Toko
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {currentRows.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="px-4 py-6 text-sm text-slate-600">
                              Belum ada item ajuan alat. Gunakan tombol `Tambah Ajuan` untuk membuat item baru.
                            </td>
                          </tr>
                        ) : (
                          currentRows.map((row, index) => {
                            const conformityText = (row.conformity || "").trim().toLowerCase();
                            const isConform =
                              conformityText.length > 0 &&
                              !conformityText.includes("tidak") &&
                              !conformityText.includes("belum") &&
                              !conformityText.includes("kurang") &&
                              !conformityText.includes("tdk") &&
                              conformityText !== "-";
                            return (
                              <tr key={row.id} className="align-top">
                                <td className="px-3 py-3 sticky left-0 bg-white z-10 border-r border-slate-200">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditProposalModal(row);
                                      }}
                                      className="border-slate-300 bg-white hover:bg-slate-100 text-slate-800 rounded-lg"
                                    >
                                      <Pencil className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs font-semibold">Edit</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmState({
                                          rowId: row.id,
                                          rowName: row.name || "alat ajuan ini",
                                        });
                                      }}
                                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 rounded-lg"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs font-semibold">Del</span>
                                    </Button>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm font-semibold text-slate-500 tabular-nums">{index + 1}</td>
                                <td className="px-3 py-3 font-semibold text-slate-900 leading-snug">{row.name || "-"}</td>
                                <td className="px-3 py-3 text-center">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSpecPreviewState({
                                        title: row.name || "Detail Spesifikasi Alat",
                                        text: row.specification || "-",
                                        conformity: row.conformity,
                                        quantity: row.quantity,
                                        unit: row.unit,
                                      });
                                    }}
                                    title="Lihat detail spesifikasi & kesesuaian"
                                    className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg"
                                  >
                                    <ZoomIn className="h-4 w-4" />
                                  </Button>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {isConform ? (
                                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-[11px] px-2.5 py-1 rounded-full">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Sesuai Perka
                                    </Badge>
                                  ) : conformityText.length === 0 || conformityText === "-" ? (
                                    <Badge className="border border-slate-200 bg-slate-50 text-slate-600 font-medium text-[11px] px-2.5 py-1 rounded-full">
                                      <Clock4 className="h-3 w-3 mr-1" />
                                      Belum Diisi
                                    </Badge>
                                  ) : (
                                    <Badge className="border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-[11px] px-2.5 py-1 rounded-full">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Tidak Sesuai Perka
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-slate-700 tabular-nums">{row.quantity || "-"}</td>
                                <td className="px-3 py-3 text-slate-700">{row.unit || "-"}</td>
                                <td className="border-l border-slate-200 px-3 py-3 align-top">
                                  <div className="space-y-2 min-w-[260px]">
                                    {shopConfigs.map((shop) => {
                                      const shopDraft = row[shop.key as ShopKey];
                                      const screens = shopDraft.siplahScreenshots;
                                      return (
                                        <div key={`${row.id}-${shop.key}-screens-view`} className="space-y-1.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide`}
                                              style={{
                                                borderColor: "transparent",
                                                backgroundColor: shop.key === "shop1" ? "#ecfdf5" : shop.key === "shop2" ? "#fef2f2" : "#eef2ff",
                                                color: shop.key === "shop1" ? "#065f46" : shop.key === "shop2" ? "#991b1b" : "#3730a3",
                                              }}
                                            >
                                              <span className="text-[10px]">{shop.emoji}</span>
                                              {shop.label.replace("Anggaran ", "")}
                                            </span>
                                            <span className="text-[10px] font-medium text-slate-600 truncate max-w-[120px]" title={shopDraft.name}>
                                              {shopDraft.name || "-"}
                                            </span>
                                          </div>
                                          {screens.length === 0 ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] italic text-slate-400 pl-0.5">
                                              <ImageIcon className="h-3 w-3" />
                                              Belum ada screenshot
                                            </span>
                                          ) : (
                                            <div className="flex items-center gap-1.5">
                                              <div className="flex -space-x-1.5">
                                                {screens.slice(0, 3).map((s) => (
                                                  <button
                                                    type="button"
                                                    key={s.id}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSiplahPreviewState({
                                                        url: s.dataUrl,
                                                        title: `${shop.label} - ${s.fileName}`,
                                                      });
                                                    }}
                                                    className="inline-block h-8 w-8 overflow-hidden rounded-md border border-slate-200 bg-slate-50 ring-2 ring-white shadow-sm transition hover:scale-105 hover:ring-emerald-200"
                                                    title={`${s.fileName} (klik preview)`}
                                                  >
                                                    <img
                                                      src={s.dataUrl}
                                                      alt={s.fileName}
                                                      loading="lazy"
                                                      className="h-full w-full object-cover"
                                                    />
                                                  </button>
                                                ))}
                                                {screens.length > 3 ? (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSiplahPreviewState({
                                                        url: screens[0].dataUrl,
                                                        title: `${shop.label} - ${screens[0].fileName}`,
                                                      });
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[9px] font-bold text-slate-600 ring-2 ring-white shadow-sm hover:bg-slate-50"
                                                    title={`${screens.length - 3} foto lainnya`}
                                                  >
                                                    +{screens.length - 3}
                                                  </button>
                                                ) : null}
                                              </div>
                                              <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] px-1.5 py-0">
                                                {screens.length}
                                              </Badge>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td colSpan={3} className="px-3 py-3 border-l border-slate-200 align-top">
                                  <div className="space-y-3 min-w-[460px]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {shopConfigs.map((shop) => {
                                        const isActive = (surveyActiveShopByRow[row.id] ?? "shop1") === shop.key;
                                        const baseActive =
                                          shop.key === "shop1"
                                            ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                            : shop.key === "shop2"
                                            ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                                            : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700";
                                        const baseInactive =
                                          shop.key === "shop1"
                                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            : shop.key === "shop2"
                                            ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                            : "border-indigo-200 text-indigo-700 hover:bg-indigo-50";
                                        return (
                                          <Button
                                            key={shop.key}
                                            type="button"
                                            size="sm"
                                            variant={isActive ? "default" : "outline"}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSurveyActiveShopByRow((cur) => ({
                                                ...cur,
                                                [row.id]: cur[row.id] === shop.key ? (shopConfigs[0]?.key ?? "shop1") : shop.key,
                                              }));
                                            }}
                                            className={isActive ? baseActive : baseInactive}
                                          >
                                            <span className="mr-1 text-[12px] leading-none">{shop.emoji}</span>
                                            {shop.label.replace("Anggaran ", "")}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                    {(() => {
                                      const activeKey: ShopKey = surveyActiveShopByRow[row.id] ?? "shop1";
                                      const cfg = shopConfigs.find((c) => c.key === activeKey) ?? shopConfigs[0];
                                      if (!cfg) return null;
                                      const sd = row[activeKey];
                                      const bannerBg =
                                        cfg.key === "shop1"
                                          ? "bg-emerald-50 border-emerald-200"
                                          : cfg.key === "shop2"
                                          ? "bg-rose-50 border-rose-200"
                                          : "bg-indigo-50 border-indigo-200";
                                      const headerText =
                                        cfg.key === "shop1"
                                          ? "text-emerald-800"
                                          : cfg.key === "shop2"
                                          ? "text-rose-800"
                                          : "text-indigo-800";
                                      return (
                                        <div className={`rounded-xl border ${bannerBg} p-3 shadow-sm`}>
                                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dashed border-black/10">
                                            <span className="text-[14px] leading-none">{cfg.emoji}</span>
                                            <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${headerText}`}>
                                              Detail {cfg.label}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="space-y-1">
                                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nama Toko</div>
                                              <div className="text-sm font-semibold text-slate-900 leading-snug break-words">
                                                {sd.name || <span className="text-slate-400 italic">-</span>}
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Harga + Pajak</div>
                                              <div className="text-sm font-semibold text-slate-900 tabular-nums">
                                                {sd.priceWithTax ? `Rp ${sd.priceWithTax}` : <span className="text-slate-400 italic">-</span>}
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Biaya Kirim</div>
                                              <div className="text-sm font-semibold text-slate-900 tabular-nums">
                                                {sd.shippingCost ? `Rp ${sd.shippingCost}` : <span className="text-slate-400 italic">-</span>}
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Biaya Instalasi</div>
                                              <div className="text-sm font-semibold text-slate-900 tabular-nums">
                                                {sd.installationCost ? `Rp ${sd.installationCost}` : <span className="text-slate-400 italic">-</span>}
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Harga</div>
                                              <div className={`text-sm font-bold tabular-nums ${headerText}`}>
                                                {sd.totalPrice ? `Rp ${sd.totalPrice}` : <span className="text-slate-400 italic">-</span>}
                                              </div>
                                            </div>
                                            <div className="space-y-1 col-span-1">
                                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Link Toko</div>
                                              <div className="text-sm leading-snug break-all">
                                                {sd.link ? (
                                                  <a
                                                    href={sd.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`font-medium underline underline-offset-2 hover:opacity-80 ${headerText}`}
                                                  >
                                                    Buka Link ↗
                                                  </a>
                                                ) : (
                                                  <span className="text-slate-400 italic">-</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
    </>
  );

  const modalsJsx = (
    <>
      {isAddModalOpen && activeProposalTab !== "rpkp" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5 space-y-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">Tambah Ajuan Alat</p>
                <p className="mt-1 text-sm text-slate-600">
                  Isi data alat, spesifikasi, kesesuaian, dan referensi 3 toko secara ringkas.
                  Semua field wajib diisi: harga menggunakan angka, link mulai dari <span className="font-mono text-slate-800">http://</span> atau <span className="font-mono text-slate-800">https://</span>.
                </p>
              </div>
              {addModalErrors.banner ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-900">Validasi gagal</p>
                  <p className="mt-1 text-sm text-rose-800">{addModalErrors.banner}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-5 xl:grid-cols-4 md:grid-cols-1">
                <div className="xl:col-span-1 space-y-4 rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-dashed border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <NotebookPen className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900 leading-none">Data Alat</p>
                        <p className="text-[11px] text-slate-500 mt-1">Kesesuaian, Nama, Spesifikasi, Jumlah</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Kesesuaian <span className="text-rose-600">*</span></p>
                        {addModalErrors.conformity ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{addModalErrors.conformity}</p> : null}
                      </div>
                      <div className="relative">
                        <select
                          value={newProposalDraft.conformity}
                          onChange={(event) =>
                            setNewProposalDraft((current) => ({ ...current, conformity: event.target.value }))
                          }
                          className={`w-full h-[46px] rounded-xl border bg-white px-3.5 text-[13.5px] text-slate-900 outline-none focus:border-primary shadow-inner cursor-pointer ${
                            newProposalDraft.conformity.includes("Tidak Sesuai") ? "text-rose-700 bg-rose-50/80 border-rose-200 ring-1 ring-rose-100" : ""
                          } ${
                            addModalErrors.conformity ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "border-slate-200 focus:ring-1 focus:ring-primary/20"
                          }`}
                        >
                          <option value="">-- Pilih Status Kesesuaian --</option>
                          <option value="⛔ Alat Tidak Sesuai PERKA" className="bg-rose-50 text-rose-700 font-semibold">⛔ Alat Tidak Sesuai PERKA</option>
                          {conformityGroups.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((option) => (
                                <option key={`add-${group.label}-${option}`} value={`${group.label} - ${option}`}>
                                  {option}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Nama Alat <span className="text-rose-600">*</span></p>
                        {addModalErrors.name ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{addModalErrors.name}</p> : null}
                      </div>
                      <Input
                        value={newProposalDraft.name}
                        onChange={(event) =>
                          setNewProposalDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Contoh: Laptop Core i5 Gen 13"
                        className={`h-[46px] rounded-xl px-3.5 text-[13.5px] ${addModalErrors.name ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "focus:ring-1 focus:ring-primary/20"}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Spesifikasi <span className="text-rose-600">*</span></p>
                        {addModalErrors.specification ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{addModalErrors.specification}</p> : null}
                      </div>
                      <textarea
                        rows={7}
                        value={newProposalDraft.specification}
                        onChange={(event) =>
                          setNewProposalDraft((current) => ({ ...current, specification: event.target.value }))
                        }
                        placeholder="Rincian spesifikasi alat (prosesor, RAM, storage, resolusi, daya, merk, tahun, garansi, dsb.)"
                        className={`w-full rounded-xl border bg-white px-3.5 py-3 text-[13.5px] leading-7 text-slate-900 outline-none focus:border-primary resize-y min-h-[170px] shadow-inner ${
                          addModalErrors.specification ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "border-slate-200 focus:ring-1 focus:ring-primary/20"
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Jumlah <span className="text-rose-600">*</span></p>
                          {addModalErrors.quantity ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{addModalErrors.quantity}</p> : null}
                        </div>
                        <Input
                          value={newProposalDraft.quantity}
                          onChange={(event) =>
                            setNewProposalDraft((current) => {
                              const nextQuantity = formatQuantityInput(event.target.value);
                              return {
                                ...current,
                                quantity: nextQuantity,
                                shop1: recalculateQuote(current.shop1, nextQuantity),
                                shop2: recalculateQuote(current.shop2, nextQuantity),
                                shop3: recalculateQuote(current.shop3, nextQuantity),
                              };
                            })
                          }
                          placeholder="0"
                          inputMode="numeric"
                          className={`h-[46px] rounded-xl px-3.5 text-[13.5px] tabular-nums ${addModalErrors.quantity ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "focus:ring-1 focus:ring-primary/20"}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Satuan <span className="text-rose-600">*</span></p>
                          {addModalErrors.unit ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{addModalErrors.unit}</p> : null}
                        </div>
                        <Input
                          value={newProposalDraft.unit}
                          onChange={(event) =>
                            setNewProposalDraft((current) => ({
                              ...current,
                              unit: formatUnitInput(event.target.value),
                            }))
                          }
                          placeholder="Unit / Buah / Paket"
                          className={`h-[46px] rounded-xl px-3.5 text-[13.5px] ${addModalErrors.unit ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "focus:ring-1 focus:ring-primary/20"}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-3 col-span-1 space-y-4 rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-5 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-dashed border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 leading-none">Data Toko (TABS)</p>
                        <p className="text-[11px] text-slate-500 mt-1">Pilih tab toko, isi data, klik Simpan untuk setiap toko.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                      {shopConfigs.map((tab) => {
                        const isActive = addModalActiveShop === tab.key;
                        const color =
                          tab.key === "shop1"
                            ? "emerald"
                            : tab.key === "shop2"
                            ? "rose"
                            : "indigo";
                        const activeCls =
                          color === "emerald"
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                            : color === "rose"
                            ? "bg-rose-500 text-white border-rose-600 shadow-md"
                            : "bg-indigo-500 text-white border-indigo-600 shadow-md";
                        const idleCls =
                          color === "emerald"
                            ? "bg-white/70 text-emerald-700 border-transparent hover:bg-white"
                            : color === "rose"
                            ? "bg-white/70 text-rose-700 border-transparent hover:bg-white"
                            : "bg-white/70 text-indigo-700 border-transparent hover:bg-white";
                        return (
                          <button
                            type="button"
                            key={`tab-add-${tab.key}`}
                            onClick={() => setAddModalActiveShop(tab.key)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                              isActive ? activeCls : idleCls
                            }`}
                          >
                            <span>{tab.emoji}</span>
                            <span>Toko {tab.key === "shop1" ? 1 : tab.key === "shop2" ? 2 : 3}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {shopConfigs
                    .filter((shop) => shop.key === addModalActiveShop)
                    .map((shop) => {
                      const idx = shop.key === "shop1" ? 0 : shop.key === "shop2" ? 1 : 2;
                      const shopErrors = addModalErrors.shops?.[shop.key];
                      const shopDraft = newProposalDraft[shop.key];
                      const screens = shopDraft.siplahScreenshots;
                      const pickerId = `siplah-picker-modal-${shop.key}-${newProposalDraft.id}`;
                      const colBanner =
                        shop.key === "shop1"
                          ? "from-emerald-50/70 to-white border-emerald-200"
                          : shop.key === "shop2"
                          ? "from-rose-50/70 to-white border-rose-200"
                          : "from-indigo-50/70 to-white border-indigo-200";
                      const headerBg =
                        shop.key === "shop1"
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                          : shop.key === "shop2"
                          ? "bg-rose-50 border border-rose-200 text-rose-800"
                          : "bg-indigo-50 border border-indigo-200 text-indigo-800";
                      const badgeCol =
                        shop.key === "shop1"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : shop.key === "shop2"
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : "bg-indigo-50 border-indigo-200 text-indigo-700";
                      return (
                        <div key={`add-card-${shop.key}`} className={`rounded-[22px] border p-5 shadow-sm bg-gradient-to-br ${colBanner}`}>
                          <div className={`rounded-xl px-3.5 py-2.5 mb-4 flex items-center justify-between gap-2 ${headerBg}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[16px] leading-none">{shop.emoji}</span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold leading-none truncate">{shop.label}</p>
                                <p className="text-[10.5px] opacity-80 mt-0.5">Isi data lalu simpan per toko</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const price = parseCurrencyNumber(shopDraft.priceWithTax);
                                if (!shopDraft.name.trim() || !Number.isFinite(price) || price <= 0) {
                                  setAddModalErrors((prev) => ({
                                    ...prev,
                                    shops: {
                                      ...(prev.shops ?? {}),
                                      [shop.key]: {
                                        name: !shopDraft.name.trim() ? "Nama toko wajib diisi" : undefined,
                                        priceWithTax: !(Number.isFinite(price) && price > 0) ? "Harga + Pajak wajib diisi angka > 0" : undefined,
                                      },
                                    },
                                  }));
                                  return;
                                }
                                setAddModalErrors((prev) => ({
                                  ...prev,
                                  shops: { ...(prev.shops ?? {}), [shop.key]: undefined },
                                  banner: undefined,
                                }));
                                const msgKey = `add-modal-save-${shop.key}`;
                                setTableMessages((prev) => ({
                                  ...prev,
                                  [msgKey]: { type: "success", text: `Toko ${idx + 1} tersimpan.` },
                                }));
                                window.setTimeout(() => {
                                  setTableMessages((prev) => {
                                    const n = { ...prev };
                                    delete n[msgKey];
                                    return n;
                                  });
                                }, 2600);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-[11.5px] font-bold shadow-sm transition ${
                                shop.key === "shop1"
                                  ? "border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-600"
                                  : shop.key === "shop2"
                                  ? "border-rose-300 bg-rose-500 text-white hover:bg-rose-600"
                                  : "border-indigo-300 bg-indigo-500 text-white hover:bg-indigo-600"
                              }`}
                            >
                              <Save className="h-3.5 w-3.5" />
                              Simpan Toko {idx + 1}
                            </button>
                          </div>

                          <div>
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Nama Toko</p>
                                  {shopErrors?.name ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.name}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.name}
                                  onChange={(event) =>
                                    setNewProposalDraft((current) => ({
                                      ...current,
                                      [shop.key]: {
                                        ...current[shop.key],
                                        name: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Contoh: Toko Alat SIPLAH Utama"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] ${shopErrors?.name ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Link Toko</p>
                                {shopErrors?.link ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.link}</p> : null}
                                <Input
                                  value={shopDraft.link}
                                  onChange={(event) =>
                                    setNewProposalDraft((current) => ({
                                      ...current,
                                      [shop.key]: {
                                        ...current[shop.key],
                                        link: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="https://..."
                                  className={`h-[44px] rounded-xl px-3 text-[13px] ${shopErrors?.link ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Harga + Pajak</p>
                                  {shopErrors?.priceWithTax ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.priceWithTax}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.priceWithTax}
                                  onChange={(event) =>
                                    setNewProposalDraft((current) => ({
                                      ...current,
                                      [shop.key]: recalculateQuote(
                                        {
                                          ...current[shop.key],
                                          priceWithTax: formatCurrencyInput(event.target.value),
                                        },
                                        current.quantity,
                                      ),
                                    }))
                                  }
                                  placeholder="Harga + Pajak (angka)"
                                  inputMode="numeric"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] tabular-nums ${shopErrors?.priceWithTax ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Biaya Kirim</p>
                                  {shopErrors?.shippingCost ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.shippingCost}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.shippingCost}
                                  onChange={(event) =>
                                    setNewProposalDraft((current) => ({
                                      ...current,
                                      [shop.key]: recalculateQuote(
                                        {
                                          ...current[shop.key],
                                          shippingCost: formatCurrencyInput(event.target.value),
                                        },
                                        current.quantity,
                                      ),
                                    }))
                                  }
                                  placeholder="Kosongkan Jika Tidak Ada"
                                  inputMode="numeric"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] tabular-nums ${shopErrors?.shippingCost ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Instalasi / Pelatihan</p>
                                  {shopErrors?.installationCost ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.installationCost}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.installationCost}
                                  onChange={(event) =>
                                    setNewProposalDraft((current) => ({
                                      ...current,
                                      [shop.key]: recalculateQuote(
                                        {
                                          ...current[shop.key],
                                          installationCost: formatCurrencyInput(event.target.value),
                                        },
                                        current.quantity,
                                      ),
                                    }))
                                  }
                                  placeholder="Kosongkan Jika Tidak Ada"
                                  inputMode="numeric"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] tabular-nums ${shopErrors?.installationCost ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Total Harga Satuan Barang</p>
                                <Input
                                  value={(() => {
                                    const s = parseCurrencyNumber(shopDraft.priceWithTax) + parseCurrencyNumber(shopDraft.shippingCost) + parseCurrencyNumber(shopDraft.installationCost);
                                    return s > 0 ? `Rp ${s.toLocaleString("id-ID")}` : "";
                                  })()}
                                  readOnly
                                  placeholder="Rp 0"
                                  className="h-[44px] rounded-xl bg-white/70 text-slate-600 tabular-nums border-slate-200 font-semibold"
                                />
                              </div>
                            </div>

                            <div className="pt-3 mt-1 border-t border-dashed border-slate-300/70 rounded-[18px] space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                                      <ImageIcon className="h-3.5 w-3.5" />
                                    </span>
                                    <p className="text-[12.5px] font-bold text-slate-900">
                                      Bukti Screenshot SIPLAH
                                    </p>
                                  </div>
                                  <p className="text-[10.5px] leading-5 text-slate-500">
                                    Upload screenshot SIPLAH.
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge className="bg-white/80 border-emerald-200 text-emerald-800 backdrop-blur text-[10px]">
                                    <FileImage className="mr-1 h-3 w-3" />
                                    Maks 5 MB
                                  </Badge>
                                  <Badge className={`text-[10px] ${badgeCol}`}>
                                    {screens.length} foto
                                  </Badge>
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                <label
                                  htmlFor={pickerId}
                                  className="group flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50/60 px-3 py-2.5 text-center transition hover:border-slate-400 hover:from-slate-50 hover:to-white hover:shadow-sm"
                                >
                                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition group-hover:bg-slate-200 group-hover:text-slate-900">
                                    <Upload className="h-4 w-4" />
                                  </span>
                                  <span className="text-[12px] font-semibold text-slate-800">
                                    Upload Screenshot {idx + 1}
                                  </span>
                                  <input
                                    id={pickerId}
                                    type="file"
                                    multiple
                                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                    className="hidden"
                                    onChange={(event) =>
                                      void handlePickSiplahScreenshots(event.target.files, {
                                        kind: "proposalModal",
                                        shopKey: shop.key,
                                      })
                                    }
                                  />
                                </label>

                                <div className="rounded-[14px] border border-slate-200 bg-white/85 p-2.5 space-y-2">
                                  {screens.length === 0 ? (
                                    <div className="flex min-h-[58px] flex-col items-center justify-center rounded-[12px] border border-dashed border-slate-200 bg-slate-50/80 text-center px-3 py-2.5">
                                      <FileImage className="h-5.5 w-5.5 text-slate-300" />
                                      <p className="mt-1 text-[10.5px] text-slate-500 leading-4">
                                        Belum ada screenshot.
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="grid grid-cols-4 gap-2">
                                        {screens.map((screenshot) => (
                                          <div
                                            key={screenshot.id}
                                            className="relative aspect-square rounded-[12px] border border-slate-200 bg-slate-100 overflow-hidden shadow-sm ring-1 ring-slate-100 hover:ring-2 hover:ring-emerald-300 transition"
                                          >
                                            <button
                                              type="button"
                                              className="absolute inset-0 group/img"
                                              onClick={() =>
                                                setSiplahPreviewState({ url: screenshot.dataUrl, title: screenshot.fileName })
                                              }
                                              title={`Preview ${screenshot.fileName}`}
                                            >
                                              <img
                                                src={screenshot.dataUrl}
                                                alt={screenshot.fileName}
                                                loading="lazy"
                                                className="h-full w-full object-cover transition group-hover/img:scale-[1.03] group-hover/img:opacity-95"
                                              />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeSiplahScreenshot(screenshot.id, {
                                                  kind: "proposalModal",
                                                  shopKey: shop.key,
                                                })
                                              }
                                              title={`Hapus ${screenshot.fileName}`}
                                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-700"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      {screens.length > 0 ? (
                                        <div className="flex items-center justify-between pt-0.5">
                                          <p className="text-[10px] text-slate-500 leading-4">Klik thumbnail → preview besar.</p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setNewProposalDraft((prev) => ({
                                                ...prev,
                                                [shop.key]: { ...prev[shop.key], siplahScreenshots: [] },
                                              }))
                                            }
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                          >
                                            <Trash2 className="mr-0.5 inline h-3 w-3" />
                                            Hapus Semua
                                          </button>
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={closeAddProposalModal} disabled={addModalSaving}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={submitAddProposalModal}
                disabled={addModalSaving}
                className="bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {addModalSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {addModalSaving ? "Menyimpan ke Database..." : "Tambahkan ke Tabel"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

      {isEditModalOpen && editDraftRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">Edit Ajuan Alat</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Ubah data alat, spesifikasi, kesesuaian, dan referensi 3 toko secara ringkas.
                    Semua field wajib diisi: harga menggunakan angka, link mulai dari <span className="font-mono text-slate-800">http://</span> atau <span className="font-mono text-slate-800">https://</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditProposalModal}
                  disabled={editModalSaving}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Tutup modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {editModalErrors.banner ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-900">Validasi gagal</p>
                  <p className="mt-1 text-sm text-rose-800">{editModalErrors.banner}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-5 xl:grid-cols-4 md:grid-cols-1">
                <div className="xl:col-span-1 space-y-4 rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-dashed border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <NotebookPen className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900 leading-none">Data Alat</p>
                        <p className="text-[11px] text-slate-500 mt-1">Kesesuaian, Nama, Spesifikasi, Jumlah</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Kesesuaian <span className="text-rose-600">*</span></p>
                        {editModalErrors.conformity ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{editModalErrors.conformity}</p> : null}
                      </div>
                      <div className="relative">
                        <select
                          value={editDraftRow.conformity}
                          onChange={(event) =>
                            setEditDraftRow((current) =>
                              current ? { ...current, conformity: event.target.value } : current
                            )
                          }
                          className={`w-full h-[46px] rounded-xl border bg-white px-3.5 text-[13.5px] text-slate-900 outline-none focus:border-primary shadow-inner cursor-pointer ${
                            editDraftRow.conformity.includes("Tidak Sesuai") ? "text-rose-700 bg-rose-50/80 border-rose-200 ring-1 ring-rose-100" : ""
                          } ${
                            editModalErrors.conformity ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "border-slate-200 focus:ring-1 focus:ring-primary/20"
                          }`}
                        >
                          <option value="">Pilih alat kesesuaian</option>
                          <option value="Alat Tidak Sesuai PERKA" className="bg-rose-50 text-rose-700 font-semibold">⛔ Alat Tidak Sesuai PERKA</option>
                          {conformityGroups.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((option) => (
                                <option key={`edit-${group.label}-${option}`} value={`${group.label} - ${option}`}>
                                  {option}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Nama Alat <span className="text-rose-600">*</span></p>
                        {editModalErrors.name ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{editModalErrors.name}</p> : null}
                      </div>
                      <Input
                        value={editDraftRow.name}
                        onChange={(event) =>
                          setEditDraftRow((current) => (current ? { ...current, name: event.target.value } : current))
                        }
                        placeholder="Contoh: Laptop Core i5 Gen 13"
                        className={`h-[46px] rounded-xl px-3.5 text-[13.5px] ${editModalErrors.name ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "focus:ring-1 focus:ring-primary/20"}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Spesifikasi <span className="text-rose-600">*</span></p>
                        {editModalErrors.specification ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{editModalErrors.specification}</p> : null}
                      </div>
                      <textarea
                        rows={7}
                        value={editDraftRow.specification}
                        onChange={(event) =>
                          setEditDraftRow((current) =>
                            current ? { ...current, specification: event.target.value } : current
                          )
                        }
                        placeholder="Rincian spesifikasi alat (prosesor, RAM, storage, resolusi, daya, merk, tahun, garansi, dsb.)"
                        className={`w-full rounded-xl border bg-white px-3.5 py-3 text-[13.5px] leading-7 text-slate-900 outline-none focus:border-primary resize-y min-h-[170px] shadow-inner ${
                          editModalErrors.specification ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "border-slate-200 focus:ring-1 focus:ring-primary/20"
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Jumlah <span className="text-rose-600">*</span></p>
                          {editModalErrors.quantity ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{editModalErrors.quantity}</p> : null}
                        </div>
                        <Input
                          value={editDraftRow.quantity}
                          onChange={(event) => {
                            const nextQty = formatQuantityInput(event.target.value);
                            setEditDraftRow((current) =>
                              current
                                ? ({
                                    ...current,
                                    quantity: nextQty,
                                    shop1: recalculateQuote(current.shop1, nextQty),
                                    shop2: recalculateQuote(current.shop2, nextQty),
                                    shop3: recalculateQuote(current.shop3, nextQty),
                                  })
                                : current
                            );
                          }}
                          placeholder="0"
                          inputMode="numeric"
                          className={`h-[46px] rounded-xl px-3.5 text-[13.5px] tabular-nums ${editModalErrors.quantity ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "focus:ring-1 focus:ring-primary/20"}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Satuan <span className="text-rose-600">*</span></p>
                          {editModalErrors.unit ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{editModalErrors.unit}</p> : null}
                        </div>
                        <Input
                          value={editDraftRow.unit}
                          onChange={(event) =>
                            setEditDraftRow((current) =>
                              current ? { ...current, unit: formatUnitInput(event.target.value) } : current
                            )
                          }
                          placeholder="Unit / Buah / Paket"
                          className={`h-[46px] rounded-xl px-3.5 text-[13.5px] ${editModalErrors.unit ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : "focus:ring-1 focus:ring-primary/20"}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-3 col-span-1 space-y-4 rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-5 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-dashed border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 leading-none">Data Toko (TABS)</p>
                        <p className="text-[11px] text-slate-500 mt-1">Pilih tab toko, edit data, klik Update untuk setiap toko.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                      {shopConfigs.map((tab) => {
                        const isActive = editModalActiveShop === tab.key;
                        const color =
                          tab.key === "shop1"
                            ? "emerald"
                            : tab.key === "shop2"
                            ? "rose"
                            : "indigo";
                        const activeCls =
                          color === "emerald"
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                            : color === "rose"
                            ? "bg-rose-500 text-white border-rose-600 shadow-md"
                            : "bg-indigo-500 text-white border-indigo-600 shadow-md";
                        const idleCls =
                          color === "emerald"
                            ? "bg-white/70 text-emerald-700 border-transparent hover:bg-white"
                            : color === "rose"
                            ? "bg-white/70 text-rose-700 border-transparent hover:bg-white"
                            : "bg-white/70 text-indigo-700 border-transparent hover:bg-white";
                        return (
                          <button
                            type="button"
                            key={`tab-edit-${tab.key}`}
                            onClick={() => setEditModalActiveShop(tab.key)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                              isActive ? activeCls : idleCls
                            }`}
                          >
                            <span>{tab.emoji}</span>
                            <span>Toko {tab.key === "shop1" ? 1 : tab.key === "shop2" ? 2 : 3}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {shopConfigs
                    .filter((shop) => shop.key === editModalActiveShop)
                    .map((shop) => {
                      const idx = shop.key === "shop1" ? 0 : shop.key === "shop2" ? 1 : 2;
                      const shopErrors = editModalErrors.shops?.[shop.key];
                      const shopDraft = editDraftRow[shop.key];
                      const screens = shopDraft.siplahScreenshots;
                      const pickerId = `siplah-edit-picker-${shop.key}-${editDraftRow.id}`;
                  const colBanner =
                    shop.key === "shop1"
                      ? "from-emerald-50/70 to-white border-emerald-200"
                      : shop.key === "shop2"
                      ? "from-rose-50/70 to-white border-rose-200"
                      : "from-indigo-50/70 to-white border-indigo-200";
                  const headerBg =
                    shop.key === "shop1"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : shop.key === "shop2"
                      ? "bg-rose-50 border border-rose-200 text-rose-800"
                      : "bg-indigo-50 border border-indigo-200 text-indigo-800";
                  const badgeCol =
                    shop.key === "shop1"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : shop.key === "shop2"
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-indigo-50 border-indigo-200 text-indigo-700";
                  return (
                    <div key={`edit-${shop.key}`} className={`xl:col-span-1 rounded-[22px] border p-5 shadow-sm bg-gradient-to-br ${colBanner}`}>
                          <div className={`rounded-xl px-3.5 py-2.5 mb-4 flex items-center justify-between gap-2 ${headerBg}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[16px] leading-none">{shop.emoji}</span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold leading-none truncate">{shop.label}</p>
                                <p className="text-[10.5px] opacity-80 mt-0.5">Edit data lalu update per toko</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const price = parseCurrencyNumber(shopDraft.priceWithTax);
                                if (!shopDraft.name.trim() || !Number.isFinite(price) || price <= 0) {
                                  setEditModalErrors((prev) => ({
                                    ...prev,
                                    shops: {
                                      ...(prev.shops ?? {}),
                                      [shop.key]: {
                                        name: !shopDraft.name.trim() ? "Nama toko wajib diisi" : undefined,
                                        priceWithTax: !(Number.isFinite(price) && price > 0) ? "Harga + Pajak wajib diisi angka > 0" : undefined,
                                      },
                                    },
                                  }));
                                  return;
                                }
                                setEditModalErrors((prev) => ({
                                  ...prev,
                                  shops: { ...(prev.shops ?? {}), [shop.key]: undefined },
                                  banner: undefined,
                                }));
                                const msgKey = `edit-modal-save-${shop.key}`;
                                setTableMessages((prev) => ({
                                  ...prev,
                                  [msgKey]: { type: "success", text: `Toko ${idx + 1} tersimpan.` },
                                }));
                                window.setTimeout(() => {
                                  setTableMessages((prev) => {
                                    const n = { ...prev };
                                    delete n[msgKey];
                                    return n;
                                  });
                                }, 2600);
                              }}
                              disabled={editModalSaving}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-[11.5px] font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                shop.key === "shop1"
                                  ? "border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-600"
                                  : shop.key === "shop2"
                                  ? "border-rose-300 bg-rose-500 text-white hover:bg-rose-600"
                                  : "border-indigo-300 bg-indigo-500 text-white hover:bg-indigo-600"
                              }`}
                            >
                              <Save className="h-3.5 w-3.5" />
                              Update Toko {idx + 1}
                            </button>
                          </div>

                          <div>
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Nama Toko</p>
                                  {shopErrors?.name ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.name}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.name}
                                  onChange={(event) =>
                                    setEditDraftRow((current) =>
                                      current ? { ...current, [shop.key]: { ...current[shop.key], name: event.target.value } } : current
                                    )
                                  }
                                  placeholder="Contoh: Toko Alat SIPLAH Utama"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] ${shopErrors?.name ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Link Toko</p>
                                  {shopErrors?.link ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.link}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.link}
                                  onChange={(event) =>
                                    setEditDraftRow((current) =>
                                      current ? { ...current, [shop.key]: { ...current[shop.key], link: event.target.value } } : current
                                    )
                                  }
                                  placeholder="https://..."
                                  className={`h-[44px] rounded-xl px-3 text-[13px] ${shopErrors?.link ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Harga + Pajak</p>
                                  {shopErrors?.priceWithTax ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.priceWithTax}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.priceWithTax}
                                  onChange={(event) =>
                                    setEditDraftRow((current) =>
                                      current
                                        ? ({
                                            ...current,
                                            [shop.key]: recalculateQuote(
                                              { ...current[shop.key], priceWithTax: formatCurrencyInput(event.target.value) },
                                              current.quantity,
                                            ),
                                          })
                                        : current
                                    )
                                  }
                                  placeholder="Harga + Pajak (angka)"
                                  inputMode="numeric"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] tabular-nums ${shopErrors?.priceWithTax ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Biaya Kirim</p>
                                  {shopErrors?.shippingCost ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.shippingCost}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.shippingCost}
                                  onChange={(event) =>
                                    setEditDraftRow((current) =>
                                      current
                                        ? ({
                                            ...current,
                                            [shop.key]: recalculateQuote(
                                              { ...current[shop.key], shippingCost: formatCurrencyInput(event.target.value) },
                                              current.quantity,
                                            ),
                                          })
                                        : current
                                    )
                                  }
                                  placeholder="Kosongkan Jika Tidak Ada"
                                  inputMode="numeric"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] tabular-nums ${shopErrors?.shippingCost ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Instalasi / Pelatihan</p>
                                  {shopErrors?.installationCost ? <p className="text-[11px] font-medium text-rose-600 leading-tight">{shopErrors.installationCost}</p> : null}
                                </div>
                                <Input
                                  value={shopDraft.installationCost}
                                  onChange={(event) =>
                                    setEditDraftRow((current) =>
                                      current
                                        ? ({
                                            ...current,
                                            [shop.key]: recalculateQuote(
                                              { ...current[shop.key], installationCost: formatCurrencyInput(event.target.value) },
                                              current.quantity,
                                            ),
                                          })
                                        : current
                                    )
                                  }
                                  placeholder="Kosongkan Jika Tidak Ada"
                                  inputMode="numeric"
                                  className={`h-[44px] rounded-xl px-3 text-[13px] tabular-nums ${shopErrors?.installationCost ? "border-rose-300 focus:border-rose-500 ring-1 ring-rose-100" : ""}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Total Harga Satuan Barang</p>
                                <Input
                                  value={(() => {
                                    const s = parseCurrencyNumber(shopDraft.priceWithTax) + parseCurrencyNumber(shopDraft.shippingCost) + parseCurrencyNumber(shopDraft.installationCost);
                                    return s > 0 ? `Rp ${s.toLocaleString("id-ID")}` : "";
                                  })()}
                                  readOnly
                                  placeholder="Rp 0"
                                  className="h-[44px] rounded-xl bg-white/70 text-slate-600 tabular-nums border-slate-200 font-semibold"
                                />
                              </div>
                            </div>

                            <div className="pt-3 mt-1 border-t border-dashed border-slate-300/70 rounded-[18px] space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                                      <ImageIcon className="h-3.5 w-3.5" />
                                    </span>
                                    <p className="text-[12.5px] font-bold text-slate-900">Bukti Screenshot SIPLAH</p>
                                  </div>
                                  <p className="text-[10.5px] leading-5 text-slate-500">Maks {MAX_PHOTOS_PER_SHOP} foto • ≤ 5 MB</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge className="text-[10px] bg-white/80 border-slate-200 text-slate-700 backdrop-blur">
                                    {screens.length}/{MAX_PHOTOS_PER_SHOP}
                                  </Badge>
                                  <label
                                    htmlFor={pickerId}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                                  >
                                    <Upload className="h-3 w-3" />
                                    Upload
                                    <input
                                      id={pickerId}
                                      type="file"
                                      multiple
                                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                      className="hidden"
                                      onChange={(event) => {
                                        void handlePickSiplahScreenshots(event.target.files, {
                                          kind: "editModal",
                                          shopKey: shop.key,
                                        });
                                        event.target.value = "";
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                <div className="grid grid-cols-5 gap-2">
                                  {Array.from({ length: MAX_PHOTOS_PER_SHOP }).map((_, slotIdx) => {
                                    const s = screens[slotIdx];
                                    return (
                                      <div
                                        key={`edit-${shop.key}-slot-${slotIdx}`}
                                        className="relative aspect-square rounded-[10px] border border-slate-200 bg-white shadow-sm overflow-hidden"
                                      >
                                        {s ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setSiplahPreviewState({
                                                  url: s.dataUrl,
                                                  title: s.fileName,
                                                })
                                              }
                                              className="absolute inset-0 group/ssprev"
                                            >
                                              <img
                                                src={s.dataUrl}
                                                alt={s.fileName}
                                                className="h-full w-full object-cover transition group-hover/ssprev:scale-[1.04]"
                                              />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => removeSiplahScreenshot(s.id, { kind: "editModal", shopKey: shop.key })}
                                              className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-rose-600 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-700"
                                              title={`Hapus ${s.fileName}`}
                                            >
                                              <X className="h-2.5 w-2.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <div className="flex h-full items-center justify-center">
                                            <FileImage className="h-5 w-5 text-slate-300" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {screens.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditDraftRow((prev) =>
                                        prev
                                          ? ({
                                              ...prev,
                                              [shop.key]: { ...prev[shop.key], siplahScreenshots: [] },
                                            })
                                          : prev
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                  >
                                    <Trash2 className="mr-0.5 inline h-3 w-3" />
                                    Hapus Semua
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditProposalModal}
                disabled={editModalSaving}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => void submitEditProposalModal()}
                disabled={editModalSaving}
                className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20 gap-2"
              >
                {editModalSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
                {editModalSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

      {siplahPreviewState ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-6xl rounded-[26px] bg-slate-900 text-white shadow-2xl ring-1 ring-white/10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold truncate">{siplahPreviewState.title || "Preview Screenshot SIPLAH"}</p>
                <p className="text-[11px] text-white/60">
                  Preview Screenshot Alat — SIPLAH Bukti Referensi
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={siplahPreviewState.url}
                  download={siplahPreviewState.title || "screenshot-siplah.png"}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 text-[11px] font-medium text-white/80 hover:bg-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </a>
                <button
                  type="button"
                  onClick={() => setSiplahPreviewState(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                  title="Tutup preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(92vh-64px)] overflow-auto bg-slate-950/40">
              <div className="flex min-h-[60vh] items-center justify-center p-4 sm:p-6 md:p-8">
                <img
                  src={siplahPreviewState.url}
                  alt={siplahPreviewState.title || "Preview Screenshot"}
                  className="max-h-[78vh] w-auto max-w-full rounded-[18px] border border-white/10 bg-black shadow-2xl object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {specPreviewState ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl rounded-[26px] bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                    <ZoomIn className="h-4 w-4" />
                  </div>
                  <p className="text-base font-bold text-slate-900 truncate pr-2">{specPreviewState.title || "Detail Spesifikasi Alat"}</p>
                </div>
                <p className="text-xs text-slate-500 pl-10">
                  Detail Fungsi & Spesifikasi — {specPreviewState.functionText ? "RPKP" : "Survey Harga Pasar"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSpecPreviewState(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-sm"
                title="Tutup detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-110px)] overflow-auto">
              <div className="space-y-5 p-6">
                {specPreviewState.quantity || specPreviewState.unit || specPreviewState.conformity || specPreviewState.functionText ? (
                  <div className={`grid gap-3 ${specPreviewState.functionText ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
                    {specPreviewState.quantity ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1.5">Jumlah</div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums leading-none">{specPreviewState.quantity}</div>
                      </div>
                    ) : null}
                    {specPreviewState.unit ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1.5">Satuan</div>
                        <div className="text-lg font-bold text-slate-900 leading-none">{specPreviewState.unit}</div>
                      </div>
                    ) : null}
                    {specPreviewState.conformity ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600 mb-1.5">Kesesuaian</div>
                        <div className="text-sm font-semibold text-emerald-800 leading-snug">{specPreviewState.conformity}</div>
                      </div>
                    ) : null}
                    {specPreviewState.functionText ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-600 mb-1.5">Fungsi</div>
                        <div className="text-[12.5px] font-semibold text-sky-900 leading-snug line-clamp-3">{specPreviewState.functionText}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {specPreviewState.functionText ? (
                  <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
                      <Wrench className="h-4 w-4 text-slate-500" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">
                        Rincian Fungsi Alat
                      </span>
                    </div>
                    <div className="px-5 py-5 bg-white">
                      <div className="text-[15px] leading-8 text-slate-800 whitespace-pre-wrap break-words font-medium">
                        {specPreviewState.functionText || <span className="text-slate-400 italic">Tidak ada deskripsi fungsi yang diinputkan.</span>}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
                    <NotebookPen className="h-4 w-4 text-slate-500" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">
                      Rincian Spesifikasi Lengkap
                    </span>
                  </div>
                  <div className="px-5 py-5 bg-white">
                    <div className="text-[15px] leading-8 text-slate-800 whitespace-pre-wrap break-words font-medium">
                      {specPreviewState.text || <span className="text-slate-400 italic">Tidak ada spesifikasi yang diinputkan.</span>}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setSpecPreviewState(null)}
                    className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-xl px-5"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmState ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-[26px] bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            <div className="border-b border-rose-100 bg-gradient-to-r from-rose-50 to-white px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-inner ring-1 ring-rose-200">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-1 space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    Yakin Mau Menghapus Alat?
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tindakan ini tidak bisa dibatalkan dan data akan langsung terhapus dari server beserta semua lampiran screenshot SIPLAH-nya.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 bg-white">
              <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50/60 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 mb-1.5">
                  Alat Yang Akan Dihapus
                </div>
                <div className="text-base font-bold text-rose-800 leading-snug break-words">
                  {deleteConfirmState.rowName}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmState(null)}
                className="rounded-xl px-5"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  removeProposalRow(deleteConfirmState.rowId);
                  setDeleteConfirmState(null);
                }}
                className="rounded-xl px-5 bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-rose-600"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Ya, Hapus Sekarang
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (exclusiveMode) {
    return (
      <div className="space-y-6 p-4 sm:p-6 md:p-8">
        {exclusiveHeader}
        {bodyJsx}
        {modalsJsx}
      </div>
    );
  }
  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <Card className="rounded-[28px]">
        <CardHeader className="gap-3">
          <CardTitle className="text-2xl text-slate-950">Data Pengajuan Sarana Sesuai Konsentrasi Keahlian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {bodyJsx}
        </CardContent>
      </Card>
      {modalsJsx}
    </div>
  );
}
