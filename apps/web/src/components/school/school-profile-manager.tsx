"use client";

import { AlertTriangle, ArrowDownRight, ArrowLeft, BadgeCheck, Building2, Calendar, Check, CheckCircle2, Clock4, Download, Eye, FileImage, FileText, Info, Layers, Loader2, MessageSquareWarning, Pencil, Plus, RefreshCw, Save, Search, Trash2, Upload, UserRound, Users, Wrench, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCachedVerifikasiReviews } from "@/lib/school-verifikasi-cache";
import { cn } from "@/lib/utils";
import {
  ADMINISTRATIVE_DOCUMENT_LABELS,
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
  ASSET_DOCUMENT_CODES,
  buildRpsDocumentCode,
  DOCUMENT_FORMAT_DOWNLOADS,
  FORMAT_FILES_BASE_PATH,
  isRpsDocumentCode,
  PENGAJUAN_DOCUMENT_CODES,
  perdirjenEquipmentSummaryRequest,
  schoolAdministrativeDocumentsRequest,
  schoolProfileByNpsnRequest,
  schoolProfileRequest,
  updateSchoolProfileRequest,
  schoolAdministrativeDocumentsByNpsnRequest,
  uploadSchoolAdministrativeDocumentRequest,
  deleteSchoolAdministrativeDocumentFileRequest,
  type AdministrativeDocumentReviewStatus,
  type DownloadableFormatFile,
  type FormatFileExtension,
  type PerdirjenEquipmentSummaryBidang,
  type PerdirjenEquipmentSummaryKonsentrasi,
  type PerdirjenEquipmentSummaryProgram,
  type PrincipalPosition,
  type SchoolAdministrativeDocumentFileRecord,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileConcentrationOption,
  type SchoolProfileInput,
  type SchoolProfileOrganizationMemberRecord,
  type SchoolProfileRecord,
  type WilayahRecord,
  type WorkspaceVerifikasiOnlineRecord,
  wilayahKabupatenRequest,
  wilayahProvinsiRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useSchoolDetailView } from "@/components/school/school-detail-view-context";

type ProfileFormState = {
  npsn: string;
  schoolName: string;
  province: string;
  provinceCode: string;
  city: string;
  cityCode: string;
  regionDisplay: string;
  address: string;
  postalCode: string;
  principalName: string;
  principalPosition: PrincipalPosition | string;
  principalNip: string;
  principalPhone: string;
  principalEmail: string;
  vicePrincipalFacilitiesName: string;
  vicePrincipalFacilitiesPhone: string;
  vicePrincipalFacilitiesEmail: string;
  organizationMembers: Array<{
    id?: string;
    roleName: string;
    memberName: string;
    contactPhone: string;
  }>;
  concentrations: Array<{
    id?: string;
    code: string;
    name: string;
    rombel10: string;
    student10: string;
    rombel11: string;
    student11: string;
    rombel12: string;
    student12: string;
    luasRuanganRps: string;
    searchText: string;
    showOptions: boolean;
    rowOrder?: number;
    isAdminRecommendation?: boolean;
    sourceType?: "ADMIN_RECOMMENDATION" | "SCHOOL_MANUAL";
    sourceLabel?: string;
  }>;
};

type TabKey = "data-sekolah" | "dokumen-administrasi" | "konsentrasi";

type ConcentrationHierarchyOption = {
  bidangCode: string;
  bidangName: string;
  programCode: string;
  programName: string;
  code: string;
  name: string;
};

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
  if (!raw?.trim()) return empty;
  try {
    const trimmed = raw.trim().replace(/^CATATAN\s+REVIEW\s+(ALAT|ADMIN(ISTRASI)?)\s*:?\s*/i, "");
    if (!trimmed.startsWith("{")) {
      return { ...empty, globalNote: raw.trim() };
    }
    const parsed = JSON.parse(trimmed) as Record<string, unknown> & Partial<AlatReviewDetailStructV3>;
    const concentrations: Record<string, ParsedReviewEntry> =
      parsed.concentrations && typeof parsed.concentrations === "object"
        ? { ...(parsed.concentrations as Record<string, ParsedReviewEntry>) }
        : {};
    const documents: Record<string, ParsedReviewEntry> =
      parsed.documents && typeof parsed.documents === "object"
        ? { ...(parsed.documents as Record<string, ParsedReviewEntry>) }
        : {};
    const conditions: Record<string, ParsedReviewEntry> =
      parsed.conditions && typeof parsed.conditions === "object"
        ? { ...(parsed.conditions as Record<string, ParsedReviewEntry>) }
        : {};
    const proposals: Record<string, ParsedReviewEntry> =
      parsed.proposals && typeof parsed.proposals === "object"
        ? { ...(parsed.proposals as Record<string, ParsedReviewEntry>) }
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
    return { globalNote: raw.trim(), concentrations: {}, documents: {}, conditions: {}, proposals: {} };
  }
}

function getReviewStatusBadgeStyle(status?: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "approved":
    case "disetujui":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "rejected":
    case "ditolak":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "pending":
    case "proses":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function formatReviewStatusLabel(status?: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "approved":
    case "disetujui":
      return "Disetujui";
    case "rejected":
    case "ditolak":
      return "Ditolak";
    case "pending":
    case "proses":
      return "Diproses";
    default:
      return "Belum Ada";
  }
}

function getDocumentLabel(code: string): string {
  return ADMINISTRATIVE_DOCUMENT_LABELS[code] ?? code;
}

function isImageFile(fileName: string, mimeType?: string): boolean {
  if (mimeType) return mimeType.toLowerCase().startsWith("image/");
  const ext = String(fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif"].includes(ext);
}

function buildFormatFileUrl(fileName: string): string {
  const base = FORMAT_FILES_BASE_PATH.replace(/\/$/, "");
  const name = String(fileName ?? "").replace(/^\//, "");
  return encodeURI(`${base}/${name}`);
}

function getFormatExtensionBadgeStyle(extension: FormatFileExtension): string {
  switch (extension) {
    case "docx":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "xlsx":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "pdf":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getFormatExtensionLabel(extension: FormatFileExtension): string {
  switch (extension) {
    case "docx":
      return "Word";
    case "xlsx":
      return "Excel";
    case "pdf":
      return "PDF";
    default: {
      const _exhaustive: never = extension;
      return String(_exhaustive as unknown as string).toUpperCase();
    }
  }
}

const emptyForm: ProfileFormState = {
  npsn: "",
  schoolName: "",
  province: "",
  provinceCode: "",
  city: "",
  cityCode: "",
  regionDisplay: "",
  address: "",
  postalCode: "",
  principalName: "",
  principalPosition: "KEPALA_SEKOLAH",
  principalNip: "",
  principalPhone: "",
  principalEmail: "",
  vicePrincipalFacilitiesName: "",
  vicePrincipalFacilitiesPhone: "",
  vicePrincipalFacilitiesEmail: "",
  organizationMembers: [],
  concentrations: [],
};

const tabs: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "data-sekolah", label: "Data Sekolah", href: "/sekolah/profil/datasekolah" },
  { key: "dokumen-administrasi", label: "Dokumen Administrasi", href: "/sekolah/profil/dokumenadministrasi" },
  { key: "konsentrasi", label: "Konsentrasi Keahlian", href: "/sekolah/profil/konsentrasikeahlian" },
];

function localStorageKeyForUser(userId: string | undefined) {
  return `prisma:school-profile:draft:${userId ?? "guest"}`;
}

function getDefaultOrganizationMembers(
  profile?: Pick<SchoolProfileRecord, "principalName" | "principalPhone" | "vicePrincipalFacilitiesName" | "vicePrincipalFacilitiesPhone">,
): SchoolProfileOrganizationMemberRecord[] {
  return [
    {
      roleName: "Kepala Sekolah",
      memberName: profile?.principalName ?? "",
      contactPhone: profile?.principalPhone ?? "",
    },
    {
      roleName: "Wakasek Sarana",
      memberName: profile?.vicePrincipalFacilitiesName ?? "",
      contactPhone: profile?.vicePrincipalFacilitiesPhone ?? "",
    },
  ];
}

function toFormState(profile: SchoolProfileRecord): ProfileFormState {
  const organizationMembers =
    profile.organizationMembers && profile.organizationMembers.length > 0
      ? profile.organizationMembers
      : getDefaultOrganizationMembers(profile);

  return {
    npsn: profile.npsn ?? "",
    schoolName: profile.schoolName ?? "",
    province: profile.province ?? "",
    provinceCode: profile.provinceCode ?? "",
    city: profile.city ?? "",
    cityCode: profile.cityCode ?? "",
    regionDisplay: profile.regionDisplay ?? "",
    address: profile.address ?? "",
    postalCode: profile.postalCode ?? "",
    principalName: profile.principalName ?? "",
    principalPosition: profile.principalPosition ?? "KEPALA_SEKOLAH",
    principalNip: profile.principalNip ?? "",
    principalPhone: profile.principalPhone ?? "",
    principalEmail: (profile as SchoolProfileRecord & { principalEmail?: string }).principalEmail ?? "",
    vicePrincipalFacilitiesName: profile.vicePrincipalFacilitiesName ?? "",
    vicePrincipalFacilitiesPhone: profile.vicePrincipalFacilitiesPhone ?? "",
    vicePrincipalFacilitiesEmail: (profile as SchoolProfileRecord & { vicePrincipalFacilitiesEmail?: string }).vicePrincipalFacilitiesEmail ?? "",
    organizationMembers: organizationMembers.map((item) => ({
      id: item.id,
      roleName: item.roleName ?? "",
      memberName: item.memberName ?? "",
      contactPhone: item.contactPhone ?? "",
    })),
    concentrations: (profile.concentrations ?? []).map((item) => {
      const rombel10 = String(item.rombel10 ?? 0);
      const student10 = String(item.student10 ?? 0);
      const rombel11 = String(item.rombel11 ?? 0);
      const student11 = String(item.student11 ?? 0);
      const rombel12 = String(item.rombel12 ?? 0);
      const student12 = String(item.student12 ?? 0);

      const hasPerClass = Number(rombel10) || Number(student10) || Number(rombel11) || Number(student11) || Number(rombel12) || Number(student12);

      if (hasPerClass) {
        return {
          id: item.id,
          code: item.code,
          name: item.name,
          rombel10,
          student10,
          rombel11,
          student11,
          rombel12,
          student12,
          luasRuanganRps: item.luasRuanganRps ?? "",
          searchText: formatConcentrationOptionLabel(item.code, item.name),
          showOptions: false,
          rowOrder: item.rowOrder,
          isAdminRecommendation: item.isAdminRecommendation,
          sourceType: item.sourceType,
          sourceLabel: item.sourceLabel,
        };
      }

      const legacyRombel = Number(item.rombelCount) || 0;
      const legacyStudent = Number(item.studentCount) || 0;
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        rombel10: String(Math.floor(legacyRombel / 3) || 0),
        student10: String(Math.floor(legacyStudent / 3) || 0),
        rombel11: String(Math.floor(legacyRombel / 3) || 0),
        student11: String(Math.floor(legacyStudent / 3) || 0),
        rombel12: String(legacyRombel - 2 * Math.floor(legacyRombel / 3) || 0),
        student12: String(legacyStudent - 2 * Math.floor(legacyStudent / 3) || 0),
        luasRuanganRps: item.luasRuanganRps ?? "",
        searchText: formatConcentrationOptionLabel(item.code, item.name),
        showOptions: false,
        rowOrder: item.rowOrder,
        isAdminRecommendation: item.isAdminRecommendation,
        sourceType: item.sourceType,
        sourceLabel: item.sourceLabel,
      };
    }),
  };
}

function toPayload(form: ProfileFormState): SchoolProfileInput {
  const safeMembers = Array.isArray(form.organizationMembers) ? form.organizationMembers : [];
  const principalMember =
    safeMembers.find((item) => item.roleName.trim().toLowerCase() === "kepala sekolah") ?? safeMembers[0];
  const viceFacilitiesMember =
    safeMembers.find((item) => item.roleName.trim().toLowerCase().includes("wakasek sarana")) ?? safeMembers[1];

  const finalPrincipalName = form.principalName.trim() || (principalMember?.memberName ?? "").trim();
  const finalPrincipalPhone = form.principalPhone.trim() || (principalMember?.contactPhone ?? "").trim();
  const finalPrincipalEmail = form.principalEmail.trim();
  const finalViceName = form.vicePrincipalFacilitiesName.trim() || (viceFacilitiesMember?.memberName ?? "").trim();
  const finalVicePhone = form.vicePrincipalFacilitiesPhone.trim() || (viceFacilitiesMember?.contactPhone ?? "").trim();
  const finalViceEmail = form.vicePrincipalFacilitiesEmail.trim();

  const syncedOrganizationMembers = form.organizationMembers
    .map((item, index) => {
      let roleName = item.roleName.trim();
      let memberName = item.memberName.trim();
      let contactPhone = item.contactPhone.trim();
      const isPrincipalSlot =
        index === 0 || (roleName && roleName.toLowerCase() === "kepala sekolah");
      const isViceSlot =
        index === 1 || (roleName && roleName.toLowerCase().includes("wakasek sarana"));
      if (isPrincipalSlot) {
        if (!roleName) roleName = "Kepala Sekolah";
        if (finalPrincipalName) memberName = finalPrincipalName;
        if (finalPrincipalPhone) contactPhone = finalPrincipalPhone;
      }
      if (isViceSlot) {
        if (!roleName) roleName = "Wakasek Sarana";
        if (finalViceName) memberName = finalViceName;
        if (finalVicePhone) contactPhone = finalVicePhone;
      }
      return { roleName, memberName, contactPhone };
    })
    .filter((item) => item.roleName && item.memberName);

  if (!syncedOrganizationMembers.some((m) => m.roleName.toLowerCase() === "kepala sekolah") && finalPrincipalName) {
    syncedOrganizationMembers.unshift({
      roleName: "Kepala Sekolah",
      memberName: finalPrincipalName,
      contactPhone: finalPrincipalPhone,
    });
  }
  if (!syncedOrganizationMembers.some((m) => m.roleName.toLowerCase().includes("wakasek sarana")) && finalViceName) {
    const principalIdx = syncedOrganizationMembers.findIndex(
      (m) => m.roleName.toLowerCase() === "kepala sekolah",
    );
    const insertAt = principalIdx >= 0 ? principalIdx + 1 : syncedOrganizationMembers.length;
    syncedOrganizationMembers.splice(insertAt, 0, {
      roleName: "Wakasek Sarana",
      memberName: finalViceName,
      contactPhone: finalVicePhone,
    });
  }

  return {
    npsn: form.npsn.trim(),
    schoolName: form.schoolName.trim(),
    province: form.province.trim(),
    provinceCode: form.provinceCode.trim() || undefined,
    city: form.city.trim(),
    cityCode: form.cityCode.trim() || undefined,
    address: form.address.trim(),
    postalCode: form.postalCode.trim(),
    latitude: null,
    longitude: null,
    principalName: finalPrincipalName,
    principalPosition: form.principalPosition || "KEPALA_SEKOLAH",
    principalNip: form.principalNip.trim(),
    principalPhone: finalPrincipalPhone,
    principalEmail: finalPrincipalEmail || undefined,
    vicePrincipalFacilitiesName: finalViceName,
    vicePrincipalFacilitiesPhone: finalVicePhone,
    vicePrincipalFacilitiesEmail: finalViceEmail || undefined,
    organizationMembers: syncedOrganizationMembers,
    concentrations: form.concentrations
      .map((item) => {
        const rombel10 = Number(item.rombel10) || 0;
        const student10 = Number(item.student10) || 0;
        const rombel11 = Number(item.rombel11) || 0;
        const student11 = Number(item.student11) || 0;
        const rombel12 = Number(item.rombel12) || 0;
        const student12 = Number(item.student12) || 0;

        return {
          id: item.id,
          rowOrder: item.rowOrder,
          isAdminRecommendation: item.isAdminRecommendation,
          sourceType: item.sourceType,
          sourceLabel: item.sourceLabel,
          code: item.code.trim(),
          name: item.name.trim(),
          rombelCount: rombel10 + rombel11 + rombel12,
          studentCount: student10 + student11 + student12,
          rombel10,
          student10,
          rombel11,
          student11,
          rombel12,
          student12,
          luasRuanganRps: (item.luasRuanganRps ?? "").trim(),
        };
      })
      .filter((item) => item.code && item.name),
  };
}

function getPayloadSignature(payload: SchoolProfileInput) {
  return JSON.stringify(payload);
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "-";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

function buildAdministrativeDocumentUrl(filePath: string) {
  const normalizedPath = filePath.trim();
  if (!normalizedPath) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const leadingSlash = normalizedPath.startsWith("/");
  let relative = leadingSlash ? normalizedPath : `/${normalizedPath}`;

  if (relative.startsWith("/uploads/")) {
    relative = `/api/v1${relative}`;
  }

  const configuredApiUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
  const origin =
    configuredApiUrl && /^https?:\/\//i.test(configuredApiUrl)
      ? configuredApiUrl.replace(/\/api\/v1$/, "").replace(/\/$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";

  if (origin) {
    try {
      return new URL(relative, origin).toString();
    } catch {
      return relative;
    }
  }

  return relative;
}

function formatConcentrationOptionLabel(code: string, name: string) {
  return code ? `${code} - ${name}` : name;
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

function buildConcentrationHierarchy(summary: PerdirjenEquipmentSummaryBidang[]): ConcentrationHierarchyOption[] {
  return summary.flatMap((bidang) =>
    bidang.program.flatMap((program: PerdirjenEquipmentSummaryProgram) =>
      program.konsentrasi.map((konsentrasi: PerdirjenEquipmentSummaryKonsentrasi) => ({
        bidangCode: bidang.no,
        bidangName: bidang.bidang,
        programCode: program.no,
        programName: program.nama,
        code: konsentrasi.no,
        name: konsentrasi.nama,
      })),
    ),
  );
}

function getReviewStatusStyle(status: AdministrativeDocumentReviewStatus | string): { className: string; label: string } {
  switch (status) {
    case "DISETUJUI":
      return { className: "bg-emerald-100 text-emerald-700", label: "Disetujui" };
    case "DITOLAK":
      return { className: "bg-rose-100 text-rose-700", label: "Ditolak" };
    case "PROSES":
    default:
      return { className: "bg-amber-100 text-amber-700", label: "Proses Review" };
  }
}

function parseInteger(value: string | undefined) {
  const numeric = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeInputPhone(value: string): string {
  return String(value ?? "")
    .replace(/[^\d]/g, "")
    .trim();
}

function validatePhoneFormat(value: string): { valid: boolean; message: string } {
  const raw = normalizeInputPhone(value);
  if (!raw) return { valid: true, message: "" };
  if (raw.length < 9) return { valid: false, message: "Nomor HP minimal 9 digit." };
  if (raw.length > 15) return { valid: false, message: "Nomor HP maksimal 15 digit." };
  if (!/^0[1-9]\d{7,13}$/.test(raw)) return { valid: false, message: "Format nomor HP tidak valid. Gunakan format: 081234567890." };
  return { valid: true, message: "" };
}

function isOrgMemberPhoneInvalid(member: { contactPhone: string }) {
  return !validatePhoneFormat(member.contactPhone).valid && String(member.contactPhone ?? "").trim() !== "";
}

export function SchoolProfileManager({
  forceActiveTab,
  hideTopTabBar = false,
}: {
  forceActiveTab?: TabKey;
  hideTopTabBar?: boolean;
}) {
  const { session } = useAuthStore();
  const router = useRouter();
  const detailView = useSchoolDetailView();
  const overrideNpsn = detailView?.npsn ?? null;
  const isViewMode = Boolean(overrideNpsn) && detailView?.role !== "SEKOLAH";
  const userId = session?.user?.id;
  const [activeTab, setActiveTab] = useState<TabKey>(forceActiveTab ?? "data-sekolah");

  useEffect(() => {
    if (forceActiveTab) {
      setActiveTab(forceActiveTab);
    }
  }, [forceActiveTab]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [concentrationOptions, setConcentrationOptions] = useState<SchoolProfileConcentrationOption[]>([]);
  const [concentrationHierarchy, setConcentrationHierarchy] = useState<ConcentrationHierarchyOption[]>([]);
  const [deletingConcentrationIndex, setDeletingConcentrationIndex] = useState<number | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    items: Array<{ url: string; title: string; isImage: boolean }>;
    index: number;
  } | null>(null);
  const [administrativeDocuments, setAdministrativeDocuments] = useState<SchoolAdministrativeDocumentRecord[]>([]);
  const [administrativeRpsDocuments, setAdministrativeRpsDocuments] = useState<SchoolAdministrativeDocumentRecord[]>([]);
  const [selectedAdministrativeFiles, setSelectedAdministrativeFiles] = useState<Record<string, File[]>>({});
  const [uploadingDocumentCode, setUploadingDocumentCode] = useState<string | null>(null);
  const [deletingDocumentFileId, setDeletingDocumentFileId] = useState<string | null>(null);
  const [lastSavedSignature, setLastSavedSignature] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("MENUNGGU_REVIEW");
  const [verificationReviewNotes, setVerificationReviewNotes] = useState("-");
  const [verifikasiReview, setVerifikasiReview] = useState<WorkspaceVerifikasiOnlineRecord | null | undefined>(
    undefined,
  );
  const [refreshingVerifikasi, setRefreshingVerifikasi] = useState(true);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [wilayahProvinsi, setWilayahProvinsi] = useState<WilayahRecord[]>([]);
  const [wilayahKabupaten, setWilayahKabupaten] = useState<WilayahRecord[]>([]);
  const [loadingWilayahProvinsi, setLoadingWilayahProvinsi] = useState(false);
  const [loadingWilayahKabupaten, setLoadingWilayahKabupaten] = useState(false);
  const [addConcentrationModalOpen, setAddConcentrationModalOpen] = useState(false);
  const [addConcentrationConfirmBox, setAddConcentrationConfirmBox] = useState(false);
  const [addConcentrationDraft, setAddConcentrationDraft] = useState<ProfileFormState["concentrations"][number]>({
    id: undefined,
    code: "",
    name: "",
    rombel10: "0",
    student10: "0",
    rombel11: "0",
    student11: "0",
    rombel12: "0",
    student12: "0",
    luasRuanganRps: "",
    searchText: "",
    showOptions: false,
  });
  const [editingDataSekolahRow, setEditingDataSekolahRow] = useState<string | null>(null);
  const [savingDataSekolahRow, setSavingDataSekolahRow] = useState<string | null>(null);
  const [editingOrgMemberIndex, setEditingOrgMemberIndex] = useState<number | null>(null);
  const [savingOrgMemberIndex, setSavingOrgMemberIndex] = useState<number | null>(null);
  const [editingDokRowIndex, setEditingDokRowIndex] = useState<number | null>(null);
  const [savingDokRowIndex, setSavingDokRowIndex] = useState<number | null>(null);
  const [editingKKIndex, setEditingKKIndex] = useState<number | null>(null);
  const [savingKKIndex, setSavingKKIndex] = useState<number | null>(null);

  const token = session?.token ?? "";
  const saveDraftTimer = useRef<number | null>(null);

  const totals = useMemo(() => {
    let rombel10 = 0;
    let student10 = 0;
    let rombel11 = 0;
    let student11 = 0;
    let rombel12 = 0;
    let student12 = 0;

    for (const item of form.concentrations) {
      rombel10 += parseInteger(item.rombel10);
      student10 += parseInteger(item.student10);
      rombel11 += parseInteger(item.rombel11);
      student11 += parseInteger(item.student11);
      rombel12 += parseInteger(item.rombel12);
      student12 += parseInteger(item.student12);
    }

    const totalRombel = rombel10 + rombel11 + rombel12;
    const totalStudent = student10 + student11 + student12;

    return { rombel10, student10, rombel11, student11, rombel12, student12, totalRombel, totalStudent };
  }, [form.concentrations]);

  const sortedConcentrationOptions = useMemo(
    () => [...concentrationOptions].sort((left, right) => compareConcentrationCode(left.code, right.code)),
    [concentrationOptions],
  );

  const parsedEquipmentNotes = useMemo(
    () => parseStructuredReviewNotes(verifikasiReview?.reviewNoteEquipment),
    [verifikasiReview],
  );
  const parsedAdminNotes = useMemo(
    () => parseStructuredReviewNotes(verifikasiReview?.reviewNoteAdmin),
    [verifikasiReview],
  );

  const currentSignature = useMemo(() => getPayloadSignature(toPayload(form)), [form]);
  const hasUnsavedChanges = currentSignature !== lastSavedSignature;

  async function loadWilayahProvinsi() {
    if (!token) return [];
    setLoadingWilayahProvinsi(true);
    try {
      const list = await wilayahProvinsiRequest();
      setWilayahProvinsi(list || []);
      return list || [];
    } catch {
      return [];
    } finally {
      setLoadingWilayahProvinsi(false);
    }
  }

  async function loadWilayahKabupaten(provKode: string) {
    setWilayahKabupaten([]);
    setForm((cur) =>
      updateRegionDisplay({
        ...cur,
        city: "",
        cityCode: "",
      }),
    );
    if (!token || !provKode) return [];
    setLoadingWilayahKabupaten(true);
    try {
      const list = await wilayahKabupatenRequest(provKode);
      setWilayahKabupaten(list || []);
      return list || [];
    } catch {
      return [];
    } finally {
      setLoadingWilayahKabupaten(false);
    }
  }

  function updateRegionDisplay(nextForm: ProfileFormState): ProfileFormState {
    const parts = [nextForm.city, nextForm.province].filter(Boolean);
    return { ...nextForm, regionDisplay: parts.join(", ") };
  }

  function scheduleDraftSave(nextForm: ProfileFormState) {
    if (!userId) return;
    if (saveDraftTimer.current) {
      window.clearTimeout(saveDraftTimer.current);
    }
    saveDraftTimer.current = window.setTimeout(() => {
      try {
        const key = localStorageKeyForUser(userId);
        const draft = {
          savedAt: Date.now(),
          form: nextForm,
        };
        window.localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        /* ignore quota errors */
      }
    }, 250);
  }

  function clearDraft() {
    if (!userId) return;
    try {
      window.localStorage.removeItem(localStorageKeyForUser(userId));
    } catch {
      /* ignore */
    }
  }

  function loadDraft(): ProfileFormState | null {
    if (!userId) return null;
    try {
      const raw = window.localStorage.getItem(localStorageKeyForUser(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt?: number; form?: ProfileFormState };
      if (!parsed?.form) return null;
      if (parsed.savedAt && Date.now() - parsed.savedAt > 1000 * 60 * 60 * 24 * 7) {
        clearDraft();
        return null;
      }
      return parsed.form;
    } catch {
      return null;
    }
  }

  async function loadProfile() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const profilePromise = overrideNpsn
        ? schoolProfileByNpsnRequest(token, overrideNpsn)
        : schoolProfileRequest(token);
      const documentsPromise = overrideNpsn
        ? schoolAdministrativeDocumentsByNpsnRequest(token, overrideNpsn)
        : schoolAdministrativeDocumentsRequest(token);
      const [profile, summary, documents, provListRaw] = await Promise.all([
        profilePromise,
        perdirjenEquipmentSummaryRequest(),
        documentsPromise,
        loadWilayahProvinsi(),
      ]);

      void (async () => {
        try {
          if (!profile.npsn) return;
          const rows = await fetchCachedVerifikasiReviews(token, { schoolNpsn: profile.npsn });
          const matched = rows[0] ?? null;
          setVerifikasiReview(matched);
          if (matched) {
            const statuses: string[] = [];
            if (matched.approvedEquipment === true) statuses.push("Alat: Disetujui");
            else if (matched.approvedEquipment === false) statuses.push("Alat: Ditolak");
            else statuses.push("Alat: Belum diproses");
            if (matched.approvedAdmin === true) statuses.push("Administrasi: Disetujui");
            else if (matched.approvedAdmin === false) statuses.push("Administrasi: Ditolak");
            else statuses.push("Administrasi: Belum diproses");
            setVerificationStatus(statuses.join(" · "));
            if (matched.reviewNoteEquipment || matched.reviewNoteAdmin) {
              setVerificationReviewNotes("Catatan tersedia, lihat bagian Status Verifikasi.");
            }
          }
        } catch {
          setVerifikasiReview(null);
        } finally {
          setRefreshingVerifikasi(false);
        }
      })();
      const serverForm = toFormState(profile);
      const provList = provListRaw;
      const namaProvFromCode = serverForm.provinceCode
        ? provList.find((item) => item.kode === serverForm.provinceCode)?.nama ?? serverForm.province
        : serverForm.province;
      if (namaProvFromCode && serverForm.province !== namaProvFromCode) {
        serverForm.province = namaProvFromCode;
      }
      let kabList: WilayahRecord[] = [];
      if (serverForm.provinceCode) {
        kabList = await loadWilayahKabupaten(serverForm.provinceCode);
        const namaKabFromCode = serverForm.cityCode
          ? kabList.find((item) => item.kode === serverForm.cityCode)?.nama ?? serverForm.city
          : serverForm.city;
        if (namaKabFromCode && serverForm.city !== namaKabFromCode) {
          serverForm.city = namaKabFromCode;
        }
      }
      const draft = loadDraft();

      if (draft) {
        const serverSig = getPayloadSignature(toPayload(serverForm));
        const draftSig = getPayloadSignature(toPayload(draft));
        if (draftSig !== serverSig) {
          setForm(draft);
          setRestoredFromDraft(true);
          setFeedback({
            type: "success",
            text: "Draf pengisian sebelumnya dipulihkan otomatis. Klik Simpan pada masing-masing baris data untuk menyimpan perubahan.",
          });
        } else {
          setForm(serverForm);
          setRestoredFromDraft(false);
        }
      } else {
        setForm(serverForm);
        setRestoredFromDraft(false);
      }

      setConcentrationOptions(profile.concentrationOptions ?? []);
      setConcentrationHierarchy(buildConcentrationHierarchy(summary));
      const filteredAdminDocs = documents
        .filter((document: SchoolAdministrativeDocumentRecord) => ADMINISTRATIVE_DOCUMENT_UMUM_CODES.includes(document.code))
        .sort((left: SchoolAdministrativeDocumentRecord, right: SchoolAdministrativeDocumentRecord) => left.no - right.no)
        .map((document: SchoolAdministrativeDocumentRecord, index: number) => ({ ...document, no: index + 1 }));
      const filteredRpsDocs = documents
        .filter((document: SchoolAdministrativeDocumentRecord) => Boolean(document.isRpsPerConcentration) || isRpsDocumentCode(document.code))
        .sort((left, right) => String(left.concentrationCode ?? left.code).localeCompare(String(right.concentrationCode ?? right.code)))
        .map((document: SchoolAdministrativeDocumentRecord, idx: number) => ({ ...document, no: idx + 1 }));
      setAdministrativeDocuments(filteredAdminDocs);
      setAdministrativeRpsDocuments(filteredRpsDocs);
      setVerificationStatus(profile.verificationStatus ?? "MENUNGGU_REVIEW");
      setVerificationReviewNotes(profile.verificationReviewNotes ?? "-");
      setLastSavedSignature(getPayloadSignature(toPayload(serverForm)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat profil sekolah.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadProfile();
  }, [token]);

  useEffect(() => {
    return () => {
      if (saveDraftTimer.current) {
        window.clearTimeout(saveDraftTimer.current);
        saveDraftTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!userId || loading) return;
      try {
        const key = localStorageKeyForUser(userId);
        const draft = { savedAt: Date.now(), form };
        window.localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [form, userId, loading]);

  async function onSelectProvinsi(kode: string) {
    const record = wilayahProvinsi.find((item) => item.kode === kode);
    const nama = record?.nama ?? "";
    setForm((current) =>
      updateRegionDisplay({
        ...current,
        province: nama,
        provinceCode: kode,
        city: "",
        cityCode: "",
      }),
    );
    if (!isEditing) setIsEditing(true);
    await loadWilayahKabupaten(kode);
  }

  function onSelectKabupaten(kode: string) {
    const record = wilayahKabupaten.find((item) => item.kode === kode);
    const nama = record?.nama ?? "";
    setForm((current) =>
      updateRegionDisplay({
        ...current,
        city: nama,
        cityCode: kode,
      }),
    );
    if (!isEditing) setIsEditing(true);
  }

  async function handleDeleteAdministrativeFile(fileId: string) {
    if (!token) return;
    if (!window.confirm("Hapus file dokumen ini dari server? File yang sudah dihapus tidak bisa dipulihkan kembali.")) return;
    setDeletingDocumentFileId(fileId);
    try {
      const updatedDocuments = await deleteSchoolAdministrativeDocumentFileRequest(token, fileId);
      setAdministrativeDocuments(
        updatedDocuments
          .filter((document: SchoolAdministrativeDocumentRecord) => ADMINISTRATIVE_DOCUMENT_UMUM_CODES.includes(document.code))
          .sort((left: SchoolAdministrativeDocumentRecord, right: SchoolAdministrativeDocumentRecord) => left.no - right.no)
          .map((document: SchoolAdministrativeDocumentRecord, index: number) => ({ ...document, no: index + 1 })),
      );
      setAdministrativeRpsDocuments(
        updatedDocuments
          .filter((document: SchoolAdministrativeDocumentRecord) => Boolean(document.isRpsPerConcentration) || isRpsDocumentCode(document.code))
          .sort((left, right) => String(left.concentrationCode ?? left.code).localeCompare(String(right.concentrationCode ?? right.code)))
          .map((document: SchoolAdministrativeDocumentRecord, idx: number) => ({ ...document, no: idx + 1 })),
      );
      setSelectedAdministrativeFiles((current) => ({ ...current }));
    } catch (err) {
      setFeedback({
        type: "error",
        text: "Gagal menghapus file dokumen: " + (err instanceof Error ? err.message : "unknown error"),
      });
    } finally {
      setDeletingDocumentFileId(null);
    }
  }

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => {
      let nextValue = value;
      if (key === ("principalPhone" as K) || key === ("vicePrincipalFacilitiesPhone" as K)) {
        nextValue = normalizeInputPhone(String(value ?? "")) as ProfileFormState[K];
      }
      const next = updateRegionDisplay({ ...current, [key]: nextValue });
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function updateConcentration<K extends keyof ProfileFormState["concentrations"][number]>(
    index: number,
    key: K,
    value: ProfileFormState["concentrations"][number][K],
  ) {
    setForm((current) => {
      const next = {
        ...current,
        concentrations: current.concentrations.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
        ),
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function selectConcentrationOption(index: number, option: SchoolProfileConcentrationOption) {
    setForm((current) => {
      const next = {
        ...current,
        concentrations: current.concentrations.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                code: option.code,
                name: option.name,
                searchText: formatConcentrationOptionLabel(option.code, option.name),
                showOptions: false,
              }
            : item,
        ),
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function updateOrganizationMember<K extends keyof ProfileFormState["organizationMembers"][number]>(
    index: number,
    key: K,
    value: ProfileFormState["organizationMembers"][number][K],
  ) {
    setForm((current) => {
      let nextValue = value;
      if (key === ("contactPhone" as K)) {
        nextValue = normalizeInputPhone(String(value ?? "")) as ProfileFormState["organizationMembers"][number][K];
      }
      const next = {
        ...current,
        organizationMembers: current.organizationMembers.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: nextValue } : item,
        ),
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function addOrganizationMember() {
    setForm((current) => {
      const next = {
        ...current,
        organizationMembers: [
          ...current.organizationMembers,
          { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, roleName: "", memberName: "", contactPhone: "" },
        ],
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function removeOrganizationMember(index: number) {
    const member = form.organizationMembers[index];
    const display = member?.memberName || member?.roleName || "anggota tim bantuan";
    if (!window.confirm(`Hapus ${display} dari daftar Tim Bantuan? Data yang sudah tersimpan di server akan ikut terhapus saat simpan perubahan.`)) return;
    setForm((current) => {
      const next = {
        ...current,
        organizationMembers: current.organizationMembers.filter((_, itemIndex) => itemIndex !== index),
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function addConcentration() {
    setForm((current) => {
      const next = {
        ...current,
        concentrations: [
          ...current.concentrations,
          {
            code: "",
            name: "",
            rombel10: "0",
            student10: "0",
            rombel11: "0",
            student11: "0",
            rombel12: "0",
            student12: "0",
            luasRuanganRps: "",
            searchText: "",
            showOptions: false,
            id: undefined,
          },
        ],
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  function removeConcentration(index: number) {
    const item = form.concentrations[index];
    const display = (item && formatConcentrationOptionLabel(item.code, item.name)) || `Konsentrasi keahlian ${index + 1}`;
    if (!window.confirm(`Hapus ${display} beserta data siswa, rombel dan file RPS terkait? Data yang tersimpan di server akan ikut terhapus saat simpan perubahan.`)) return;
    setForm((current) => {
      const next = {
        ...current,
        concentrations: current.concentrations.filter((_, itemIndex) => itemIndex !== index),
      };
      scheduleDraftSave(next);
      return next;
    });
    if (!isEditing) setIsEditing(true);
  }

  async function handleSaveAll(opts: { mode?: "all" | "row"; successToastText?: string | null } = {}) {
    const mode = opts.mode ?? "row";
    const customSuccessText = opts.successToastText ?? null;
    if (!token) {
      setFeedback({ type: "error", text: "Sesi login tidak ditemukan." });
      return false;
    }
    if (isViewMode) {
      setFeedback({ type: "error", text: "Mode tampilan Fasilitator Alat — hanya bisa melihat data sekolah. Silakan minta sekolah login untuk mengubah data sendiri." });
      return false;
    }

    const invalidOrgPhone = form.organizationMembers.find((m) => isOrgMemberPhoneInvalid(m));
    if (invalidOrgPhone) {
      const phoneCheck = validatePhoneFormat(invalidOrgPhone.contactPhone);
      setFeedback({
        type: "error",
        text: `Perbaiki Nomor HP "${invalidOrgPhone.memberName || invalidOrgPhone.roleName || "Jabatan"}": ${
          phoneCheck.message || "Format nomor HP tidak valid."
        }`,
      });
      return false;
    }

    const principalPhoneCheck = validatePhoneFormat(form.principalPhone);
    if (!principalPhoneCheck.valid && form.principalPhone.trim()) {
      setFeedback({ type: "error", text: `Perbaiki Nomor HP Kepala Sekolah: ${principalPhoneCheck.message}` });
      return false;
    }
    const wakasekPhoneCheck = validatePhoneFormat(form.vicePrincipalFacilitiesPhone);
    if (!wakasekPhoneCheck.valid && form.vicePrincipalFacilitiesPhone.trim()) {
      setFeedback({ type: "error", text: `Perbaiki Nomor HP Wakasek Sarana: ${wakasekPhoneCheck.message}` });
      return false;
    }

    const invalidConcentration = form.concentrations.find(
      (item) => !item.code.trim() || !item.name.trim(),
    );
    if (invalidConcentration) {
      const idx = form.concentrations.indexOf(invalidConcentration) + 1;
      setFeedback({
        type: "error",
        text: `Konsentrasi Keahlian #${idx} belum lengkap: pilih salah satu opsi Kompetensi Keahlian terlebih dahulu sebelum disimpan.`,
      });
      return false;
    }
    const duplicateConcentration = form.concentrations.find((item, index) =>
      form.concentrations.some(
        (other, otherIndex) => otherIndex !== index && other.code && other.code === item.code,
      ),
    );
    if (duplicateConcentration) {
      const idx = form.concentrations.indexOf(duplicateConcentration) + 1;
      setFeedback({
        type: "error",
        text: `Konsentrasi Keahlian #${idx} (${duplicateConcentration.code}) duplikat: setiap Kompetensi Keahlian hanya boleh dipilih 1 kali.`,
      });
      return false;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const profilePayload = toPayload(form);
      if (typeof window !== "undefined") {
        try {
          console.info("[saveProfile] Simpan konsentrasi ke server:", {
            mode,
            jumlahKonsentrasiDikirim: profilePayload.concentrations.length,
          });
        } catch { /* ignore */ }
      }
      const saved = await updateSchoolProfileRequest(token, profilePayload);
      const savedForm = toFormState(saved);
      setForm(savedForm);
      setConcentrationOptions(saved.concentrationOptions ?? []);
      setVerificationStatus(saved.verificationStatus ?? "MENUNGGU_REVIEW");
      setVerificationReviewNotes(saved.verificationReviewNotes ?? "-");
      const savedSig = getPayloadSignature(toPayload(savedForm));
      setLastSavedSignature(savedSig);

      const pendingUploads = Object.entries(selectedAdministrativeFiles).filter(
        ([, files]) => Array.isArray(files) && files.length > 0,
      );
      for (const [documentCode, files] of pendingUploads) {
        if (!Array.isArray(files) || files.length === 0) continue;
        setUploadingDocumentCode(documentCode);
        try {
          let latestDoc: SchoolAdministrativeDocumentRecord | null = null;
          for (const file of files) {
            latestDoc = await uploadSchoolAdministrativeDocumentRequest(token, documentCode, file);
          }
          if (latestDoc) {
            setAdministrativeDocuments((current) =>
              current.map((item) => (item.code === documentCode ? latestDoc! : item)),
            );
            setAdministrativeRpsDocuments((current) => {
              if (isRpsDocumentCode(documentCode) || Boolean(latestDoc!.isRpsPerConcentration)) {
                const exists = current.some((d) => d.code === documentCode);
                const next = exists
                  ? current.map((d) => (d.code === documentCode ? latestDoc! : d))
                  : [...current, latestDoc!];
                return next
                  .sort((left, right) =>
                    String(left.concentrationCode ?? left.code).localeCompare(
                      String(right.concentrationCode ?? right.code),
                    ),
                  )
                  .map((document, idx) => ({ ...document, no: idx + 1 }));
              }
              return current;
            });
          }
          setSelectedAdministrativeFiles((current) => ({ ...current, [documentCode]: [] }));
        } catch (uploadErr) {
          setFeedback({
            type: "error",
            text:
              "Sebagian data dokumen gagal diunggah: " +
              (uploadErr instanceof Error ? uploadErr.message : "unknown error"),
          });
        }
      }
      setUploadingDocumentCode(null);
      if (mode === "all") {
        setIsEditing(false);
      } else {
        setIsEditing(true);
      }
      setRestoredFromDraft(false);
      clearDraft();
      if (!feedback || feedback.type !== "error") {
        const finalSuccessText = customSuccessText ??
          (mode === "all"
            ? "Simpan Semua Data berhasil: Data Sekolah, Dokumen Administrasi (pending), dan Konsentrasi Keahlian tersimpan ke server. Draf lokal dihapus."
            : "✓ Data berhasil tersimpan ke database.");
        setFeedback({ type: "success", text: finalSuccessText });
      }
      return true;
    } catch (saveErr) {
      setFeedback({
        type: "error",
        text: saveErr instanceof Error ? saveErr.message : "Gagal menyimpan data ke database.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardDraft() {
    if (!window.confirm("Buang semua perubahan yang belum tersimpan dan kembalikan ke data terakhir dari server?")) {
      return;
    }
    clearDraft();
    setRestoredFromDraft(false);
    void loadProfile();
  }

  if (!token) {
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

  async function refreshVerifikasiReview() {
    const targetNpsn = (verifikasiReview?.schoolNpsn ?? form.npsn ?? "").trim();
    if (!token || !targetNpsn) {
      setFeedback({
        type: "error",
        text: !targetNpsn
          ? "NPSN sekolah belum diisi. Silakan isi NPSN di tab Identitas Sekolah terlebih dahulu."
          : "Sesi login tidak ditemukan. Silakan login ulang.",
      });
      return;
    }
    setFeedback(null);
    setRefreshingVerifikasi(true);
    try {
      const rows = await fetchCachedVerifikasiReviews(
        token,
        { schoolNpsn: targetNpsn },
        { force: true },
      );
      const matched = rows[0] ?? null;
      setVerifikasiReview(matched);
      if (matched) {
        const statuses: string[] = [];
        if (matched.approvedEquipment === true) statuses.push("Alat: Disetujui");
        else if (matched.approvedEquipment === false) statuses.push("Alat: Ditolak");
        else statuses.push("Alat: Belum diproses");
        if (matched.approvedAdmin === true) statuses.push("Administrasi: Disetujui");
        else if (matched.approvedAdmin === false) statuses.push("Administrasi: Ditolak");
        else statuses.push("Administrasi: Belum diproses");
        setFeedback({
          type: "success",
          text: `Status verifikasi berhasil diperbarui (${statuses.join(" • ")}).`,
        });
      } else {
        setFeedback({
          type: "error",
          text: `Belum ada data review verifikasi untuk NPSN ${targetNpsn}.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Koneksi gagal";
      setFeedback({
        type: "error",
        text: `Gagal memuat status verifikasi: ${message}. Silakan coba lagi.`,
      });
    } finally {
      setRefreshingVerifikasi(false);
    }
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-danger/15 bg-danger/[0.08] text-danger"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat profil sekolah...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">{error}</div>
      ) : (
        <>
          <Card className={cn("rounded-[24px]", hideTopTabBar && "hidden")}>
            <CardContent className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap rounded-2xl bg-slate-100 p-1">
                {tabs.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                      activeTab === tab.key ? "bg-white text-primary shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {restoredFromDraft || hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {restoredFromDraft ? "● Draf Dipulihkan" : "● Ada Perubahan Belum Disimpan"}
                    <span className="text-amber-700/80 font-normal">(otomatis disimpan sementara di browser)</span>
                  </span>
                ) : null}
                {restoredFromDraft ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDiscardDraft}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                    Buang Draf
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {activeTab === "data-sekolah" ? (
            <div className="space-y-6">
              <Card className="rounded-[24px]">
                <CardContent className="space-y-6 px-6 py-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/70">Data Identitas Sekolah</p>
                      <p className="mt-1 text-sm text-slate-600">Klik tombol <strong className="text-primary">Edit</strong> pada baris untuk mengubah data, lalu klik <strong className="text-emerald-600">Simpan</strong> untuk menyimpan perubahan per baris.</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/80 text-left">
                          <th className="w-[20%] border-b border-slate-200 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">
                            Aksi
                          </th>
                          <th className="w-[24%] border-b border-slate-200 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Data
                          </th>
                          <th className="w-[56%] border-b border-slate-200 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Isian
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rows: Array<{
                            rowKey: string;
                            label: ReactNode;
                            zebra: boolean;
                          }> = [
                            { rowKey: "npsn", label: "NPSN", zebra: true },
                            { rowKey: "schoolName", label: "Nama Sekolah", zebra: false },
                            { rowKey: "province", label: "Provinsi", zebra: true },
                            { rowKey: "city", label: "Kota / Kabupaten", zebra: false },
                            {
                              rowKey: "address-postal",
                              label: (
                                <>
                                  Alamat Lengkap
                                  <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                                    (Plus Kode Pos)
                                  </span>
                                </>
                              ),
                              zebra: true,
                            },
                            { rowKey: "principalName", label: "Nama Kepala Sekolah", zebra: false },
                            { rowKey: "principalNip", label: "NIP", zebra: true },
                            { rowKey: "principalPhone", label: "No Kontak", zebra: false },
                            { rowKey: "principalEmail", label: "Email", zebra: true },
                            { rowKey: "vicePrincipalFacilitiesName", label: "Nama Wakasek Sarana", zebra: false },
                            { rowKey: "vicePrincipalFacilitiesPhone", label: "No Kontak", zebra: true },
                            { rowKey: "vicePrincipalFacilitiesEmail", label: "Email", zebra: false },
                          ];

                          function readOnlyDisplay(value: ReactNode, placeholder = "Belum diisi") {
                            const content = typeof value === "string" && value.trim() ? value : placeholder;
                            const isEmpty = typeof value === "string" && !value.trim();
                            return (
                              <div className={`min-h-[40px] flex items-center px-3 py-2 rounded-md border border-slate-200 bg-slate-50/50 text-sm ${isEmpty ? "text-slate-400 italic" : "text-slate-900"}`}>
                                {content}
                              </div>
                            );
                          }

                          return rows.map(({ rowKey, label, zebra }) => {
                            const isEditingThis = editingDataSekolahRow === rowKey;
                            const isSavingThis = savingDataSekolahRow === rowKey;

                            let isianCell: ReactNode = null;
                            switch (rowKey) {
                              case "npsn":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.npsn}
                                    onChange={(event) => updateField("npsn", event.target.value)}
                                    placeholder="Contoh: 20102345"
                                    inputMode="numeric"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.npsn);
                                break;
                              case "schoolName":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.schoolName}
                                    onChange={(event) => updateField("schoolName", event.target.value)}
                                    placeholder="Contoh: SMKN 1 Contoh Kota"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.schoolName);
                                break;
                              case "province":
                                isianCell = isEditingThis ? (
                                  <select
                                    value={form.provinceCode}
                                    onChange={(event) => void onSelectProvinsi(event.target.value)}
                                    disabled={loadingWilayahProvinsi}
                                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                                  >
                                    <option value="">— Pilih Provinsi —</option>
                                    {wilayahProvinsi.map((item) => (
                                      <option key={item.kode} value={item.kode}>
                                        {item.nama}
                                      </option>
                                    ))}
                                    {!wilayahProvinsi.length && form.province ? (
                                      <option value={form.provinceCode}>{form.province}</option>
                                    ) : null}
                                  </select>
                                ) : readOnlyDisplay(form.province);
                                break;
                              case "city":
                                isianCell = isEditingThis ? (
                                  <select
                                    value={form.cityCode}
                                    onChange={(event) => void onSelectKabupaten(event.target.value)}
                                    disabled={loadingWilayahKabupaten}
                                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                                  >
                                    <option value="">— Pilih Kota / Kabupaten —</option>
                                    {wilayahKabupaten.map((item) => (
                                      <option key={item.kode} value={item.kode}>
                                        {item.nama}
                                      </option>
                                    ))}
                                    {!wilayahKabupaten.length && form.city ? (
                                      <option value={form.cityCode}>{form.city}</option>
                                    ) : null}
                                  </select>
                                ) : readOnlyDisplay(form.city);
                                break;
                              case "address-postal":
                                isianCell = isEditingThis ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={form.address}
                                      onChange={(event) => updateField("address", event.target.value)}
                                      rows={3}
                                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-primary"
                                      placeholder="Nama jalan, nomor, RT/RW, detail lain (blok/kompleks)"
                                    />
                                    <div className="max-w-[200px]">
                                      <Input
                                        value={form.postalCode}
                                        onChange={(event) => updateField("postalCode", event.target.value)}
                                        placeholder="Kode Pos, contoh: 40123"
                                        inputMode="numeric"
                                        className="bg-white"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {readOnlyDisplay(form.address, "Alamat belum diisi")}
                                    <div className="max-w-[200px]">
                                      {readOnlyDisplay(form.postalCode, "Kode Pos belum diisi")}
                                    </div>
                                  </div>
                                );
                                break;
                              case "principalName":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.principalName}
                                    onChange={(event) => updateField("principalName", event.target.value)}
                                    placeholder="Nama lengkap Kepala Sekolah"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.principalName);
                                break;
                              case "principalNip":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.principalNip}
                                    onChange={(event) => updateField("principalNip", event.target.value)}
                                    placeholder="NIP (18 digit angka)"
                                    inputMode="numeric"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.principalNip);
                                break;
                              case "principalPhone":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.principalPhone}
                                    onChange={(event) => updateField("principalPhone", event.target.value)}
                                    placeholder="081234567890"
                                    inputMode="numeric"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.principalPhone);
                                break;
                              case "principalEmail":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.principalEmail}
                                    onChange={(event) => updateField("principalEmail", event.target.value)}
                                    placeholder="kepsek.smk@email.com"
                                    type="email"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.principalEmail);
                                break;
                              case "vicePrincipalFacilitiesName":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.vicePrincipalFacilitiesName}
                                    onChange={(event) => updateField("vicePrincipalFacilitiesName", event.target.value)}
                                    placeholder="Nama lengkap Wakasek Sarana Prasarana"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.vicePrincipalFacilitiesName);
                                break;
                              case "vicePrincipalFacilitiesPhone":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.vicePrincipalFacilitiesPhone}
                                    onChange={(event) => updateField("vicePrincipalFacilitiesPhone", event.target.value)}
                                    placeholder="081234567890"
                                    inputMode="numeric"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.vicePrincipalFacilitiesPhone);
                                break;
                              case "vicePrincipalFacilitiesEmail":
                                isianCell = isEditingThis ? (
                                  <Input
                                    value={form.vicePrincipalFacilitiesEmail}
                                    onChange={(event) => updateField("vicePrincipalFacilitiesEmail", event.target.value)}
                                    placeholder="wakasek.sarana@email.com"
                                    type="email"
                                    className="bg-white"
                                  />
                                ) : readOnlyDisplay(form.vicePrincipalFacilitiesEmail);
                                break;
                            }

                            return (
                              <tr
                                key={rowKey}
                                className={`border-b border-slate-100 align-top last:border-b-0 ${zebra ? "bg-white" : "bg-slate-50/40"}`}
                              >
                                <td className="px-5 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {isEditingThis ? (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingDataSekolahRow(null);
                                          }}
                                          disabled={isSavingThis}
                                          className="border-slate-300"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                          Batal
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={async () => {
                                            setSavingDataSekolahRow(rowKey);
                                            const labelText = typeof label === "string" ? label : rowKey;
                                            const ok = await handleSaveAll({
                                              mode: "row",
                                              successToastText: `✓ Data ${labelText} berhasil tersimpan ke database.`,
                                            });
                                            if (ok) {
                                              setEditingDataSekolahRow(null);
                                            }
                                            setSavingDataSekolahRow(null);
                                          }}
                                          disabled={isSavingThis || saving || uploadingDocumentCode !== null}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                          {isSavingThis || saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                          {isSavingThis || saving ? "Menyimpan..." : "Simpan"}
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingDataSekolahRow(rowKey)}
                                        disabled={savingDataSekolahRow !== null}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-700 leading-6">
                                  {label}
                                </td>
                                <td className="px-5 py-3">{isianCell}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardContent className="space-y-4 px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Jabatan Lainnya (Tim Bantuan)</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Data anggota tim tambahan selain Kepala Sekolah &amp; Wakasek Sarana. Opsional, hanya diisi jika diperlukan. Klik <strong className="text-primary">Edit</strong> pada baris untuk mengubah data.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        addOrganizationMember();
                        const lastIdx = (form.organizationMembers.length + 1) - 1;
                        setEditingOrgMemberIndex(lastIdx);
                      }}
                      disabled={editingOrgMemberIndex !== null}
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Jabatan
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const visibleMembers = form.organizationMembers
                        .map((member, globalIdx) => ({ member, globalIdx }))
                        .filter(({ globalIdx }) => globalIdx !== 0 && globalIdx !== 1);

                      if (visibleMembers.length === 0) {
                        return (
                          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500 italic">
                            Belum ada anggota tim tambahan. Klik <strong>Tambah Jabatan</strong> di kanan atas untuk menambahkan.
                          </div>
                        );
                      }

                      function orgMemberReadOnlyDisplay(value: string | undefined, placeholder = "Belum diisi") {
                        const v = typeof value === "string" && value.trim() ? value : placeholder;
                        const isEmpty = typeof value === "string" && !value.trim();
                        return (
                          <div className={`min-h-[40px] flex items-center px-3 py-2 rounded-md border border-slate-200 bg-slate-50/50 text-sm ${isEmpty ? "text-slate-400 italic" : "text-slate-900"}`}>
                            {v}
                          </div>
                        );
                      }

                      return visibleMembers.map(({ member, globalIdx }) => {
                        const invalid = isOrgMemberPhoneInvalid(member);
                        const isEditingThis = editingOrgMemberIndex === globalIdx;
                        const isSavingThis = savingOrgMemberIndex === globalIdx;
                        return (
                          <div
                            key={`${member.id ?? `org-idx-${globalIdx}`}`}
                            className={`rounded-[18px] border p-4 space-y-3 ${
                              invalid
                                ? "border-rose-200 bg-rose-50/40"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="grid gap-4 md:grid-cols-[auto_1fr_1.2fr_1fr] md:items-end">
                              <div className="flex items-center justify-center md:justify-start gap-2">
                                {isEditingThis ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingOrgMemberIndex(null)}
                                      disabled={isSavingThis}
                                      className="border-slate-300"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Batal
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={async () => {
                                        setSavingOrgMemberIndex(globalIdx);
                                        const nama = member.memberName || member.roleName || "tim bantuan";
                                        const ok = await handleSaveAll({
                                          mode: "row",
                                          successToastText: `✓ Data anggota ${nama} berhasil tersimpan ke database.`,
                                        });
                                        if (ok) {
                                          setEditingOrgMemberIndex(null);
                                        }
                                        setSavingOrgMemberIndex(null);
                                      }}
                                      disabled={isSavingThis || saving || uploadingDocumentCode !== null}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                      {isSavingThis || saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                      {isSavingThis || saving ? "Menyimpan..." : "Simpan"}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingOrgMemberIndex(globalIdx)}
                                    disabled={editingOrgMemberIndex !== null}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="justify-start text-danger border-danger/20 hover:bg-danger/5 hover:text-danger"
                                  disabled={editingOrgMemberIndex !== null && !isEditingThis}
                                  onClick={() => removeOrganizationMember(globalIdx)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Hapus
                                </Button>
                              </div>
                              <div>
                                {isEditingThis ? (
                                  <Field label="Jabatan">
                                    <Input
                                      value={member.roleName}
                                      onChange={(event) => updateOrganizationMember(globalIdx, "roleName", event.target.value)}
                                      placeholder="Contoh: Kepala Program TKJ"
                                    />
                                  </Field>
                                ) : (
                                  <>
                                    <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1.5">Jabatan</span>
                                    {orgMemberReadOnlyDisplay(member.roleName)}
                                  </>
                                )}
                              </div>
                              <div>
                                {isEditingThis ? (
                                  <Field label="Nama">
                                    <Input
                                      value={member.memberName}
                                      onChange={(event) => updateOrganizationMember(globalIdx, "memberName", event.target.value)}
                                      placeholder="Nama lengkap"
                                    />
                                  </Field>
                                ) : (
                                  <>
                                    <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1.5">Nama</span>
                                    {orgMemberReadOnlyDisplay(member.memberName)}
                                  </>
                                )}
                              </div>
                              <div>
                                <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1.5">
                                  Nomor HP {invalid ? <span className="text-rose-600">• {validatePhoneFormat(member.contactPhone).message}</span> : null}
                                </span>
                                {isEditingThis ? (
                                  <Input
                                    value={member.contactPhone}
                                    onChange={(event) => updateOrganizationMember(globalIdx, "contactPhone", event.target.value)}
                                    placeholder="081234567890"
                                    inputMode="numeric"
                                    className={invalid ? "border-rose-300 focus:border-rose-500" : ""}
                                  />
                                ) : (
                                  orgMemberReadOnlyDisplay(member.contactPhone)
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border border-primary/15 bg-primary/[0.03]">
                <CardContent className="space-y-4 px-6 py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-primary/15 bg-white px-4 py-1 text-sm font-semibold text-primary">
                        <Building2 className="mr-1.5 h-4 w-4" />
                        Catatan Fasilitator Administrasi
                      </span>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-slate-600">
                    Catatan review, saran, dan status persetujuan dari <strong>Fasilitator Administrasi</strong> untuk data profil sekolah, dokumen administrasi, dan data konsentrasi keahlian sekolah Anda.
                  </p>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-xs font-semibold text-primary">
                        <Building2 className="mr-1.5 h-3.5 w-3.5" />
                        Status Approval Administrasi
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={verifikasiApprovalVariant(verifikasiReview?.approvedAdmin ?? null)}>
                        {verifikasiReview?.approvedAdmin === true ? (
                          <CheckCircle2 className="mr-1.5 h-3 w-3" />
                        ) : verifikasiReview?.approvedAdmin === false ? (
                          <XCircle className="mr-1.5 h-3 w-3" />
                        ) : (
                          <Clock4 className="mr-1.5 h-3 w-3" />
                        )}
                        {verifikasiApprovalLabel(verifikasiReview?.approvedAdmin ?? null)}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {verifikasiReview?.reviewedAdminName
                        ? `Oleh ${verifikasiReview.reviewedAdminName}`
                        : "Belum ada review dari Fasilitator Administrasi"}
                      {verifikasiReview?.reviewedAdminAt
                        ? ` • ${formatVerifikasiDate(verifikasiReview.reviewedAdminAt)}`
                        : ""}
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[100px] space-y-3">
                      {parsedAdminNotes.globalNote ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Catatan Umum Review Administrasi
                            </span>
                          </div>
                          <div className="block text-sm leading-6 text-slate-800 rounded-lg bg-white border border-slate-200 px-3.5 py-3">
                            {parsedAdminNotes.globalNote}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <MessageSquareWarning className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-1" />
                          <span className="text-slate-400 italic text-sm leading-6">Belum ada catatan dari Fasilitator Administrasi untuk data sekolah ini.</span>
                        </div>
                      )}
                      {(() => {
                        const docCount = Object.keys(parsedAdminNotes.documents).length;
                        const kkCount = Object.keys(parsedAdminNotes.concentrations).length;
                        if (docCount === 0 && kkCount === 0) return null;
                        return (
                          <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-2 text-[11px]">
                            {docCount > 0 && (
                              <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                                <FileText className="mr-1 h-3 w-3" />
                                {docCount} Dokumen Administrasi Memiliki Catatan
                              </span>
                            )}
                            {kkCount > 0 && (
                              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                                <Layers className="mr-1 h-3 w-3" />
                                {kkCount} Konsentrasi Memiliki Catatan
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                              <ArrowDownRight className="h-3 w-3" />
                              Lihat detail: tab Dokumen Administrasi &amp; Konsentrasi Keahlian
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : null}

          {activeTab === "dokumen-administrasi" ? (
            <div className="space-y-4">
              <Card className="rounded-[24px]">
                <CardContent className="space-y-2 px-6 py-5">
                  <p className="text-lg font-semibold text-slate-950">Dokumen Administrasi</p>
                  <p className="text-sm text-slate-600">
                    Unggah 12 dokumen administrasi umum &amp; legal sekolah. Format yang diterima: <strong>PDF, DOC/DOCX, JPG/JPEG, PNG</strong> (maks 10 MB per file).<br />
                    Untuk No. 9 (Daya Listrik): <strong>bisa upload hingga 5 file per dokumen</strong>.
                  </p>
                  <p className="text-xs text-slate-500">
                    💡 Upload file langsung pada setiap baris dokumen. File yang dipilih disimpan otomatis di draf lokal dan siap dikirim saat simpan.
                  </p>
                </CardContent>
              </Card>

              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1260px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/80 text-left">
                        <th className="w-[8%] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">
                          Aksi
                        </th>
                        <th className="w-[5%] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">
                          No
                        </th>
                        <th className="w-[20%] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Data Administrasi
                        </th>
                        <th className="w-[35%] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Dokumen (Upload &amp; Preview)
                        </th>
                        <th className="w-[13%] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Status
                        </th>
                        <th className="w-[19%] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Catatan Fasil
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {administrativeDocuments
                        .filter((document) => !isRpsDocumentCode(document.code) && !document.isRpsPerConcentration)
                        .map((document, rowIdx) => {
                          const selectedFiles = selectedAdministrativeFiles[document.code] ?? [];
                          const uploadedFiles = Array.isArray(document.files) && document.files.length > 0 ? document.files : [];
                          const totalFiles = uploadedFiles.length + selectedFiles.length;
                          const allowMultiple = Boolean(document.allowMultiple);
                          const maxFiles = Number(document.maxFiles) || 1;
                          const isUploading = uploadingDocumentCode === document.code;
                          const reviewStyle = getReviewStatusStyle(document.reviewStatus);
                          const adminEntry = parsedAdminNotes.documents[document.code];
                          const alatEntry = parsedEquipmentNotes.documents[document.code];
                          const isZebraEven = rowIdx % 2 === 0;
                          const isEditingThis = editingDokRowIndex === rowIdx;
                          const isSavingThis = savingDokRowIndex === rowIdx;
                          const statusUploadBadge =
                            uploadedFiles.length > 0
                              ? { label: "Sudah Diupload", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
                              : selectedFiles.length > 0
                                ? { label: "Menunggu Diupload", className: "bg-sky-100 text-sky-700 border-sky-200" }
                                : { label: "Belum Diupload", className: "bg-slate-100 text-slate-600 border-slate-200" };

                          return (
                            <tr key={document.code} className={`border-b border-slate-100 align-top ${isZebraEven ? "bg-white" : "bg-slate-50/40"}`}>
                              <td className="px-4 py-4">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  {isEditingThis ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingDokRowIndex(null)}
                                        disabled={isSavingThis || saving || uploadingDocumentCode !== null}
                                        className="border-slate-300"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Batal
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={async () => {
                                          setSavingDokRowIndex(rowIdx);
                                          const ok = await handleSaveAll({
                                            mode: "row",
                                            successToastText: `✓ Dokumen ${document.name} berhasil tersimpan ke database.`,
                                          });
                                          if (ok) {
                                            setEditingDokRowIndex(null);
                                          }
                                          setSavingDokRowIndex(null);
                                        }}
                                        disabled={isSavingThis || saving || uploadingDocumentCode !== null}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      >
                                        {isSavingThis || saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                        {isSavingThis || saving ? "Menyimpan..." : "Simpan"}
                                      </Button>
                                    </div>
                                    {selectedFiles.length > 0 ? (
                                      <p className="text-[10.5px] text-slate-500 text-center">
                                      {selectedFiles.length} file menunggu upload
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingDokRowIndex(rowIdx)}
                                    disabled={editingDokRowIndex !== null || saving || uploadingDocumentCode !== null}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                )}
                                </div>
                              </td>

                              <td className="px-4 py-4 text-center">
                                <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shadow-sm">
                                  {document.no}
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <div className="space-y-1.5">
                                  <p className="text-[13.5px] font-semibold leading-snug text-slate-950">
                                    {document.name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {document.required ? (
                                      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                                        Wajib
                                      </span>
                                    ) : null}
                                    {allowMultiple ? (
                                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                                        Multi • Maks {maxFiles}
                                      </span>
                                    ) : null}
                                    {DOCUMENT_FORMAT_DOWNLOADS[document.code] && DOCUMENT_FORMAT_DOWNLOADS[document.code].length > 0 ? (
                                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                        <Download className="mr-1 h-3 w-3" />
                                        Ada {DOCUMENT_FORMAT_DOWNLOADS[document.code].length} Format
                                      </span>
                                    ) : null}
                                  </div>
                                  {(() => {
                                    const formatList = DOCUMENT_FORMAT_DOWNLOADS[document.code];
                                    if (!formatList || formatList.length === 0) return null;
                                    return (
                                      <div className="mt-2.5 grid gap-1.5">
                                        {formatList.slice(0, 2).map((formatFile: DownloadableFormatFile) => {
                                          const url = buildFormatFileUrl(formatFile.fileName);
                                          return (
                                            <a
                                              key={formatFile.fileName}
                                              href={url}
                                              download
                                              target="_blank"
                                              rel="noreferrer"
                                              className="group inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] text-left transition hover:border-amber-400 hover:bg-amber-50"
                                            >
                                              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${getFormatExtensionBadgeStyle(formatFile.extension)}`}>
                                                <FileText className="h-2.5 w-2.5" />
                                              </span>
                                              <span className="inline-flex items-center rounded border px-1 py-0.5 text-[8.5px] font-bold tracking-wider uppercase">
                                                {getFormatExtensionLabel(formatFile.extension)}
                                              </span>
                                              <span className="truncate font-semibold text-slate-700 max-w-[180px]">
                                                {formatFile.label}
                                              </span>
                                              <Download className="h-3 w-3 shrink-0 text-amber-700" />
                                            </a>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <div className="space-y-3">
                                  {uploadedFiles.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
                                        ✓ File Tersimpan ({uploadedFiles.length})
                                      </p>
                                      <div className="space-y-1.5 max-h-[220px] overflow-auto pr-1">
                                        {uploadedFiles.map((file, idx) => {
                                          const fileUrl = buildAdministrativeDocumentUrl(file.filePath);
                                          const version = idx + 1;
                                          const isLatest = idx === uploadedFiles.length - 1;
                                          const isDeleting = deletingDocumentFileId === file.id;
                                          const isImg = isImageFile(file.fileName, file.mimeType);
                                          return (
                                            <div
                                              key={file.id}
                                              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${isLatest ? "border-primary/30 bg-primary/[0.04]" : "border-slate-200 bg-white"}`}
                                            >
                                              <div className="min-w-0 flex items-center gap-2 flex-1">
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-200">
                                                  {isImg && fileUrl ? (
                                                    <button
                                                      type="button"
                                                      className="h-5 w-5 rounded overflow-hidden"
                                                      onClick={() => {
                                                        const items: Array<{ url: string; title: string; isImage: boolean }> = [];
                                                        for (let u = 0; u < uploadedFiles.length; u++) {
                                                          const f = uploadedFiles[u];
                                                          const uUrl = buildAdministrativeDocumentUrl(f.filePath);
                                                          if (isImageFile(f.fileName, f.mimeType)) {
                                                            items.push({ url: uUrl, title: f.fileName || `File ${u + 1}`, isImage: true });
                                                          }
                                                        }
                                                        const curIdx = Math.max(0, items.findIndex(i => i.url === fileUrl));
                                                        if (items.length > 0) setLightboxState({ items, index: curIdx });
                                                      }}
                                                    >
                                                      <FileImage className="h-3.5 w-3.5 text-sky-600" />
                                                    </button>
                                                  ) : (
                                                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                                                  )}
                                                </div>
                                                <div className="min-w-0 space-y-0.5 flex-1">
                                                  <div className="flex flex-wrap items-center gap-1">
                                                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.04em] ${isLatest ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                                                      V{version}
                                                    </span>
                                                    {isLatest ? (
                                                      <span className="inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                                        Terbaru
                                                      </span>
                                                    ) : null}
                                                    {file.reviewStatus ? (
                                                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${getReviewStatusStyle(file.reviewStatus).className}`}>
                                                        {getReviewStatusStyle(file.reviewStatus).label}
                                                      </span>
                                                    ) : null}
                                                    <p className="truncate text-[11.5px] font-medium text-slate-800 max-w-[220px]">
                                                      {file.fileName || "File"}
                                                    </p>
                                                  </div>
                                                  <p className="text-[10.5px] text-slate-500 truncate">
                                                    {formatFileSize(file.fileSize)}
                                                    {file.uploadedAt
                                                      ? ` • ${new Date(file.uploadedAt).toLocaleDateString("id-ID")}`
                                                      : ""}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex shrink-0 items-center gap-1.5">
                                                {fileUrl ? (
                                                  <a href={fileUrl} target="_blank" rel="noreferrer">
                                                    <Button type="button" size="sm" variant="outline" className="px-2 py-1 h-7 text-[10.5px]">
                                                      <Eye className="mr-1 h-3 w-3" />
                                                      Buka
                                                    </Button>
                                                  </a>
                                                ) : null}
                                                {isEditingThis ? (
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="px-2 py-1 h-7 text-[10.5px] text-danger border-danger/20 hover:bg-danger/5 hover:text-danger"
                                                    disabled={isDeleting || editingDokRowIndex !== null && !isEditingThis}
                                                    onClick={() => file.id ? void handleDeleteAdministrativeFile(file.id) : undefined}
                                                  >
                                                    {isDeleting ? (
                                                      <>
                                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                        ...
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Trash2 className="mr-1 h-3 w-3" />
                                                        Hapus
                                                      </>
                                                    )}
                                                  </Button>
                                                ) : null}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  {selectedFiles.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                                        ● Baru ({selectedFiles.length}) • Klik Simpan di baris ini
                                      </p>
                                      <div className="space-y-1.5 max-h-[140px] overflow-auto pr-1">
                                        {selectedFiles.map((file, idx) => (
                                          <div
                                            key={`${file.name}-${idx}-${file.size}`}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2"
                                          >
                                            <div className="min-w-0 flex items-center gap-2 flex-1">
                                              <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
                                              <div className="min-w-0">
                                                <p className="truncate text-[11.5px] font-medium text-slate-800 max-w-[220px]">
                                                  {file.name}
                                                </p>
                                                <p className="text-[10.5px] text-slate-500">{formatFileSize(file.size)}</p>
                                              </div>
                                            </div>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="px-2 py-1 h-7 text-[10.5px] text-danger border-danger/20 hover:bg-danger/5 hover:text-danger"
                                              onClick={() =>
                                                setSelectedAdministrativeFiles((current) => {
                                                  const next = [...(current[document.code] ?? [])];
                                                  next.splice(idx, 1);
                                                  return { ...current, [document.code]: next };
                                                })
                                              }
                                            >
                                              <X className="mr-1 h-3 w-3" />
                                              Batal
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  <div>
                                    <label className={`group block ${isEditingThis ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}>
                                      <div className={`flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center transition ${isEditingThis ? "group-hover:border-primary group-hover:bg-accent-soft/40" : ""}`}>
                                        <div className="space-y-0.5">
                                          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                                            <Upload className="h-3.5 w-3.5 text-primary" />
                                          </div>
                                          <p className="text-[11.5px] font-medium text-slate-800">
                                            {isEditingThis ? (allowMultiple ? `Tambah file (maks ${maxFiles})` : "Pilih file") : "Klik Edit di baris ini dulu"}
                                          </p>
                                          <p className="text-[10px] text-slate-500">
                                            {totalFiles}/{maxFiles} • PDF/DOC/JPG/PNG • ≤10MB
                                          </p>
                                        </div>
                                        <input
                                          type="file"
                                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                          multiple={allowMultiple}
                                          className="hidden"
                                          disabled={!isEditingThis}
                                          onChange={(event) => {
                                            const incoming = Array.from(event.target.files ?? []);
                                            setSelectedAdministrativeFiles((current) => {
                                              const existing = Array.isArray(current[document.code]) ? [...current[document.code]] : [];
                                              const serverCount = uploadedFiles.length;
                                              const availableSlots = Math.max(0, maxFiles - serverCount - existing.length);
                                              if (incoming.length > 0 && availableSlots <= 0) {
                                                window.alert(
                                                  allowMultiple
                                                    ? `Maksimal ${maxFiles} file (sudah ${totalFiles}). Hapus dulu file lain.`
                                                    : `Dokumen ini hanya bisa 1 file.`,
                                                );
                                                return current;
                                              }
                                              const toAppend = incoming.slice(0, availableSlots || 0);
                                              return {
                                                ...current,
                                                [document.code]: allowMultiple
                                                  ? [...existing, ...toAppend]
                                                  : toAppend.slice(0, 1),
                                              };
                                            });
                                            event.target.value = "";
                                            if (!isEditing) setIsEditing(true);
                                          }}
                                        />
                                      </div>
                                    </label>
                                    {selectedFiles.length > 0 ? (
                                      <div className="mt-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setSelectedAdministrativeFiles((current) => ({
                                              ...current,
                                              [document.code]: [],
                                            }))
                                          }
                                          className="h-7 text-[10.5px] px-2.5 py-1"
                                        >
                                          <X className="mr-1 h-3 w-3" />
                                          Batalkan ({selectedFiles.length})
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>

                                  {isUploading ? (
                                    <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-[10.5px] font-semibold text-sky-700">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Mengunggah...
                                    </div>
                                  ) : null}
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <div className="space-y-2">
                                  <div>
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusUploadBadge.className}`}>
                                      {statusUploadBadge.label}
                                    </span>
                                    <p className="mt-1 text-[10.5px] text-slate-500">
                                      {totalFiles}/{maxFiles} file
                                      {allowMultiple ? " (multi)" : ""}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
                                      Review Dokumen
                                    </p>
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${reviewStyle.className}`}>
                                      {reviewStyle.label}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <div className="space-y-2 min-h-[100px]">
                                  {adminEntry?.note || alatEntry?.note ? (
                                    <div className="space-y-2">
                                      {adminEntry?.note ? (
                                        <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 px-3 py-2.5 space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center text-[10.5px] font-semibold text-blue-700">
                                              <Building2 className="mr-1 h-3 w-3" />
                                              Admin
                                            </span>
                                            {adminEntry.status ? (
                                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${getReviewStatusBadgeStyle(adminEntry.status)}`}>
                                                {formatReviewStatusLabel(adminEntry.status)}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="text-[11.5px] leading-5 text-slate-700 whitespace-pre-wrap">
                                            {adminEntry.note}
                                          </div>
                                        </div>
                                      ) : null}
                                      {alatEntry?.note ? (
                                        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5 space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center text-[10.5px] font-semibold text-primary/90">
                                              <Wrench className="mr-1 h-3 w-3" />
                                              Alat
                                            </span>
                                            {alatEntry.status ? (
                                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${getReviewStatusBadgeStyle(alatEntry.status)}`}>
                                                {formatReviewStatusLabel(alatEntry.status)}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="text-[11.5px] leading-5 text-slate-700 whitespace-pre-wrap">
                                            {alatEntry.note}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-h-[60px]">
                                      <MessageSquareWarning className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                                      <span className="text-[11.5px] leading-5 text-slate-400 italic">
                                        Belum ada catatan dari Fasilitator Administrasi untuk dokumen ini.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "konsentrasi" ? (
            <div className="space-y-4">
              <Card className="rounded-[24px]">
                <CardContent className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">Konsentrasi Keahlian</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Atur jumlah siswa dan rombel per kelas (10, 11, 12) untuk masing-masing konsentrasi keahlian. Data ini dipakai sebagai dasar pengelompokan inventaris alat dan pengajuan kebutuhan sarana.
                    </p>
                  </div>
                  <Button type="button" onClick={() => {
                    setAddConcentrationDraft({
                      id: undefined,
                      code: "",
                      name: "",
                      rombel10: "0",
                      student10: "0",
                      rombel11: "0",
                      student11: "0",
                      rombel12: "0",
                      student12: "0",
                      luasRuanganRps: "",
                      searchText: "",
                      showOptions: false,
                    });
                    setAddConcentrationConfirmBox(false);
                    setAddConcentrationModalOpen(true);
                  }} disabled={loading || deletingConcentrationIndex !== null}>
                    <Plus className="h-4 w-4" />
                    Tambah Konsentrasi
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {form.concentrations.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
                    Belum ada data konsentrasi keahlian. Klik <strong>Tambah Konsentrasi</strong> di atas.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1380px] border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100/80 text-left">
                            <th className="w-[3%] border-b border-slate-200 px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center whitespace-nowrap">Aksi</th>
                            <th className="w-[5%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">No</th>
                            <th className="w-[16%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Konsentrasi Keahlian</th>
                            <th className="w-[10%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">Kelas 10</th>
                            <th className="w-[10%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">Kelas 11</th>
                            <th className="w-[10%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">Kelas 12</th>
                            <th className="w-[8%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">Total Siswa</th>
                            <th className="w-[8%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 text-center">Luas RPS (m²)</th>
                            <th className="w-[13%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">RPS (N file + status)</th>
                            <th className="w-[17%] border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Catatan Fasil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.concentrations.map((item, index) => {
                            const subtotalRombel =
                              parseInteger(item.rombel10) + parseInteger(item.rombel11) + parseInteger(item.rombel12);
                            const subtotalStudent =
                              parseInteger(item.student10) + parseInteger(item.student11) + parseInteger(item.student12);
                            const isZebraEven = index % 2 === 0;
                            const duplicateCodeSet = new Set(
                              form.concentrations
                                .map((other, otherIndex) => (otherIndex !== index ? other.code : ""))
                                .filter(Boolean),
                            );
                            const availableOptions = sortedConcentrationOptions.filter(
                              (option) => option.code === item.code || !duplicateCodeSet.has(option.code),
                            );
                            const rpsDocCode = buildRpsDocumentCode(item.code);
                            const rpsDoc = administrativeRpsDocuments.find((d) => d.code === rpsDocCode) ??
                              administrativeDocuments.find((d) => d.code === rpsDocCode);
                            const selectedRawFiles = selectedAdministrativeFiles[rpsDocCode] ?? [];
                            const uploadedRawFiles: SchoolAdministrativeDocumentFileRecord[] =
                              Array.isArray(rpsDoc?.files) && rpsDoc.files.length > 0 ? rpsDoc.files : [];
                            const MAX_RPS_PER_KK = 5;
                            const uploadedFiles = uploadedRawFiles.slice(0, MAX_RPS_PER_KK);
                            const remainingSlots = Math.max(0, MAX_RPS_PER_KK - uploadedFiles.length);
                            const selectedFiles = selectedRawFiles.slice(0, remainingSlots);
                            const totalFiles = uploadedFiles.length + selectedFiles.length;
                            const isRpsReady = !!item.code.trim();
                            const isEditingThis = editingKKIndex === index;
                            const isSavingThis = savingKKIndex === index;

                            const openLightboxRps = (startFromUploaded: boolean, localIndex: number) => {
                              const items: Array<{ url: string; title: string; isImage: boolean }> = [];
                              for (const f of uploadedFiles) {
                                const url = buildAdministrativeDocumentUrl(f.filePath);
                                items.push({
                                  url,
                                  title: f.fileName,
                                  isImage: isImageFile(f.fileName, f.mimeType),
                                });
                              }
                              for (const f of selectedFiles) {
                                const url = URL.createObjectURL(f);
                                items.push({
                                  url,
                                  title: f.name,
                                  isImage: isImageFile(f.name, f.type),
                                });
                              }
                              const imageItems = items.filter((x) => x.isImage);
                              if (imageItems.length === 0) return;
                              const originalIndex = startFromUploaded ? localIndex : uploadedFiles.length + localIndex;
                              const imageToOriginal = new Map<number, number>();
                              const filtered: typeof items = [];
                              for (let i = 0; i < items.length; i++) {
                                if (items[i].isImage) {
                                  imageToOriginal.set(filtered.length, i);
                                  filtered.push(items[i]);
                                }
                              }
                              let startIdx = 0;
                              for (let j = 0; j < filtered.length; j++) {
                                const orig = imageToOriginal.get(j) ?? -1;
                                if (orig === originalIndex || orig >= originalIndex) {
                                  startIdx = j;
                                  break;
                                }
                                startIdx = j;
                              }
                              if (filtered.length === 0) return;
                              setLightboxState({ items: filtered, index: startIdx });
                            };

                            return (
                              <tr key={item.id ?? `new-${index}`} className={`border-b border-slate-100 align-top ${isZebraEven ? "bg-white" : "bg-slate-50/40"}`}>
                                <td className="px-2 py-4 text-center whitespace-nowrap">
                                  <div className="flex flex-col items-center gap-2">
                                    {isEditingThis ? (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setEditingKKIndex(null)}
                                          disabled={isSavingThis || saving || uploadingDocumentCode !== null || deletingConcentrationIndex === index}
                                          className="border-slate-300"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                          Batal
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={async () => {
                                            setSavingKKIndex(index);
                                            const labelKK = formatConcentrationOptionLabel(item.code, item.name) || `Konsentrasi ${index + 1}`;
                                            const ok = await handleSaveAll({
                                              mode: "row",
                                              successToastText: `✓ ${labelKK} berhasil tersimpan ke database.`,
                                            });
                                            if (ok) {
                                              setEditingKKIndex(null);
                                            }
                                            setSavingKKIndex(null);
                                          }}
                                          disabled={isSavingThis || saving || uploadingDocumentCode !== null || deletingConcentrationIndex === index}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                          {isSavingThis || saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                          {isSavingThis || saving ? "Menyimpan..." : "Simpan"}
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingKKIndex(index)}
                                        disabled={editingKKIndex !== null || saving || uploadingDocumentCode !== null || deletingConcentrationIndex === index}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </Button>
                                    )}
                                    {!item.isAdminRecommendation ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => removeConcentration(index)}
                                        disabled={
                                          (editingKKIndex !== null && !isEditingThis) ||
                                          deletingConcentrationIndex === index ||
                                          saving ||
                                          uploadingDocumentCode !== null
                                        }
                                        aria-label={`Hapus konsentrasi ${index + 1}`}
                                        title="Hapus konsentrasi ini"
                                      >
                                        {deletingConcentrationIndex === index ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4 text-danger" />
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10.5px] font-semibold text-blue-700" title="Konsentrasi Rekomendasi Dinas — hanya bisa diedit, tidak bisa dihapus.">
                                        <BadgeCheck className="h-3.5 w-3.5" />
                                        Ditetapkan Dinas
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-3 py-4 text-center">
                                  <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shadow-sm">
                                    {index + 1}
                                  </div>
                                </td>

                                <td className="px-3 py-4">
                                  <div className="space-y-1.5">
                                    <div className="relative">
                                      <Input
                                        value={item.searchText}
                                        onChange={(event) => {
                                          updateConcentration(index, "searchText", event.target.value);
                                          updateConcentration(index, "showOptions", true);
                                        }}
                                        onFocus={() => updateConcentration(index, "showOptions", true)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        placeholder="Cari / pilih konsentrasi keahlian"
                                      />
                                      {item.showOptions && isEditing ? (
                                        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                          {availableOptions.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-500">Tidak ada opsi tersedia.</div>
                                          ) : (
                                            availableOptions.map((option) => (
                                              <button
                                                key={option.code}
                                                type="button"
                                                onClick={() => selectConcentrationOption(index, option)}
                                                className="block w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-accent-soft/40"
                                              >
                                                {formatConcentrationOptionLabel(option.code, option.name)}
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {item.code ? (
                                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-primary">
                                          {item.code}
                                        </span>
                                      ) : (
                                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
                                          Belum Dipilih
                                        </span>
                                      )}
                                      {item.sourceLabel ? (
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] tracking-wide uppercase border",
                                            item.isAdminRecommendation
                                              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50"
                                              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
                                          )}
                                        >
                                          {item.sourceLabel}
                                        </Badge>
                                      ) : null}
                                      {(() => {
                                        const alatEntry = item.code ? parsedEquipmentNotes.concentrations[item.code] : undefined;
                                        const adminEntry = item.code ? parsedAdminNotes.concentrations[item.code] : undefined;
                                        if (!alatEntry?.status && !adminEntry?.status) return null;
                                        return (
                                          <>
                                            {alatEntry?.status ? (
                                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getReviewStatusBadgeStyle(alatEntry.status)}`}>
                                                <Wrench className="mr-1 h-3 w-3" />
                                                {formatReviewStatusLabel(alatEntry.status).slice(0, 12)}
                                              </span>
                                            ) : null}
                                            {adminEntry?.status ? (
                                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getReviewStatusBadgeStyle(adminEntry.status)}`}>
                                                <Building2 className="mr-1 h-3 w-3" />
                                                {formatReviewStatusLabel(adminEntry.status).slice(0, 12)}
                                              </span>
                                            ) : null}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-4 text-center">
                                  <div className="space-y-1.5">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Rombel</p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.rombel10}
                                        onChange={(event) => updateConcentration(index, "rombel10", event.target.value)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        className="text-center h-9 px-2 py-1"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Siswa</p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.student10}
                                        onChange={(event) => updateConcentration(index, "student10", event.target.value)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        className="text-center h-9 px-2 py-1 font-semibold text-primary"
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-4 text-center">
                                  <div className="space-y-1.5">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Rombel</p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.rombel11}
                                        onChange={(event) => updateConcentration(index, "rombel11", event.target.value)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        className="text-center h-9 px-2 py-1"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Siswa</p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.student11}
                                        onChange={(event) => updateConcentration(index, "student11", event.target.value)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        className="text-center h-9 px-2 py-1 font-semibold text-primary"
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-4 text-center">
                                  <div className="space-y-1.5">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Rombel</p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.rombel12}
                                        onChange={(event) => updateConcentration(index, "rombel12", event.target.value)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        className="text-center h-9 px-2 py-1"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Siswa</p>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.student12}
                                        onChange={(event) => updateConcentration(index, "student12", event.target.value)}
                                        disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                        className="text-center h-9 px-2 py-1 font-semibold text-primary"
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-4 text-center">
                                  <div className="rounded-xl bg-primary/[0.06] border border-primary/15 px-3 py-3 space-y-1">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Rombel</p>
                                      <p className="text-base font-semibold text-slate-900">{subtotalRombel}</p>
                                    </div>
                                    <div className="pt-1 border-t border-primary/10 mt-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">Siswa TOTAL</p>
                                      <p className="text-lg font-bold text-primary">{subtotalStudent}</p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-4 text-center">
                                  <div className="relative max-w-[120px] mx-auto">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="96"
                                      value={item.luasRuanganRps}
                                      disabled={!isEditingThis || editingKKIndex !== null && !isEditingThis}
                                      onChange={(e) => updateConcentration(index, "luasRuanganRps", e.target.value)}
                                      className="text-center h-9 px-2 pr-7 py-1 font-semibold text-emerald-700"
                                    />
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                      m²
                                    </span>
                                  </div>
                                </td>

                                <td className="px-3 py-4">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Badge variant={totalFiles > 0 ? "default" : "outline"} className={totalFiles > 0 ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-slate-50 text-slate-500 border-slate-200"}>
                                        <Layers className="mr-1 h-3 w-3" />
                                        {totalFiles}/{MAX_RPS_PER_KK} file
                                      </Badge>
                                      {rpsDoc?.reviewStatus && rpsDoc.reviewStatus !== "PENDING" ? (
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getReviewStatusBadgeStyle(rpsDoc.reviewStatus)}`}>
                                          {getReviewStatusStyle(rpsDoc.reviewStatus).label}
                                        </span>
                                      ) : null}
                                    </div>
                                    {!isRpsReady ? (
                                      <p className="text-[10.5px] leading-4 text-slate-400 italic">
                                        Pilih konsentrasi dulu untuk upload RPS.
                                      </p>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-4 gap-1.5">
                                          {uploadedFiles.slice(0, 4).map((file, idx) => {
                                            const fileUrl = buildAdministrativeDocumentUrl(file.filePath);
                                            const img = isImageFile(file.fileName, file.mimeType);
                                            const isDeleting = deletingDocumentFileId === file.id;
                                            return (
                                              <div key={file.id} className="relative group aspect-square">
                                                <button
                                                  type="button"
                                                  onClick={() => img ? openLightboxRps(true, idx) : window.open(fileUrl, "_blank", "noreferrer")}
                                                  className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-slate-100 transition ${img ? "cursor-zoom-in hover:opacity-90 hover:ring-2 hover:ring-primary/30" : "cursor-pointer hover:bg-slate-200"}`}
                                                  title={file.fileName}
                                                >
                                                  {img ? (
                                                    <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" loading="lazy" />
                                                  ) : (
                                                    <FileText className="h-5 w-5 text-slate-500" />
                                                  )}
                                                </button>
                                                {isEditingThis ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => file.id ? void handleDeleteAdministrativeFile(file.id) : undefined}
                                                    disabled={isDeleting || (editingKKIndex !== null && !isEditingThis)}
                                                    title="Hapus foto"
                                                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-danger shadow ring-1 ring-rose-200 hover:bg-rose-50 z-10 disabled:opacity-60"
                                                  >
                                                    {isDeleting ? (
                                                      <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                      <X className="h-3 w-3" />
                                                    )}
                                                  </button>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                          {selectedFiles.slice(0, Math.max(0, 4 - uploadedFiles.length)).map((file, idx) => {
                                            const isImage = isImageFile(file.name, file.type);
                                            const previewUrl = isImage ? URL.createObjectURL(file) : "";
                                            return (
                                              <div key={`rps-add-${index}-${idx}`} className="relative aspect-square ring-2 ring-primary/40 rounded-lg">
                                                <div
                                                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-primary/40 bg-primary/[0.06]"
                                                  title={file.name}
                                                >
                                                  {isImage ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => openLightboxRps(false, idx)}
                                                      className="h-full w-full cursor-zoom-in hover:opacity-90"
                                                    >
                                                      <img src={previewUrl} alt={file.name} className="h-full w-full object-cover rounded-md" />
                                                    </button>
                                                  ) : (
                                                    <FileText className="h-5 w-5 text-primary/60" />
                                                  )}
                                                </div>
                                                <span className="absolute left-0.5 top-0.5 inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide text-white shadow-sm">
                                                  BARU
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setSelectedAdministrativeFiles((current) => {
                                                      const next = [...(current[rpsDocCode] ?? [])];
                                                      next.splice(idx, 1);
                                                      return { ...current, [rpsDocCode]: next };
                                                    })
                                                  }
                                                  title="Batalkan foto"
                                                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-danger shadow ring-1 ring-rose-200 hover:bg-rose-50 z-10"
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              </div>
                                            );
                                          })}
                                          {isEditingThis && isRpsReady && totalFiles < MAX_RPS_PER_KK ? (
                                            <label className="aspect-square cursor-pointer">
                                              <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-primary hover:bg-accent-soft/40">
                                                <div className="space-y-0.5">
                                                  <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
                                                    <Upload className="h-3 w-3 text-primary" />
                                                  </div>
                                                  <p className="text-[9px] font-medium text-slate-700 leading-tight">
                                                    Tambah
                                                  </p>
                                                </div>
                                                <input
                                                  type="file"
                                                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                                  multiple
                                                  className="hidden"
                                                  onChange={(event) => {
                                                    const allIncoming = Array.from(event.target.files ?? []);
                                                    const incoming = allIncoming.filter((f) =>
                                                      isImageFile(f.name, f.type),
                                                    );
                                                    if (incoming.length === 0 && allIncoming.length > 0) {
                                                      window.alert("Hanya format gambar JPG/JPEG/PNG/WebP/GIF yang diterima.");
                                                      event.target.value = "";
                                                      return;
                                                    }
                                                    setSelectedAdministrativeFiles((current) => {
                                                      const existing = Array.isArray(current[rpsDocCode]) ? [...current[rpsDocCode]] : [];
                                                      const serverCount = uploadedFiles.length;
                                                      const availableSlots = Math.max(0, MAX_RPS_PER_KK - serverCount - existing.length);
                                                      if (incoming.length > 0 && availableSlots <= 0) {
                                                        window.alert(`Maksimal ${MAX_RPS_PER_KK} foto (sudah ${totalFiles}).`);
                                                        return current;
                                                      }
                                                      const toAppend = incoming.slice(0, availableSlots || 0);
                                                      return {
                                                        ...current,
                                                        [rpsDocCode]: [...existing, ...toAppend],
                                                      };
                                                    });
                                                    event.target.value = "";
                                                    if (!isEditing) setIsEditing(true);
                                                  }}
                                                />
                                              </div>
                                            </label>
                                          ) : null}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>

                                <td className="px-3 py-4">
                                  {(() => {
                                    const alatEntry = item.code ? parsedEquipmentNotes.concentrations[item.code] : undefined;
                                    const adminEntry = item.code ? parsedAdminNotes.concentrations[item.code] : undefined;
                                    return (
                                      <div className="space-y-2 min-h-[100px]">
                                        {adminEntry?.note || alatEntry?.note ? (
                                          <div className="space-y-2">
                                            {adminEntry?.note ? (
                                              <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 px-3 py-2.5 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="inline-flex items-center text-[10.5px] font-semibold text-blue-700">
                                                    <Building2 className="mr-1 h-3 w-3" />
                                                    Admin
                                                  </span>
                                                  {adminEntry.status ? (
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${getReviewStatusBadgeStyle(adminEntry.status)}`}>
                                                      {formatReviewStatusLabel(adminEntry.status)}
                                                    </span>
                                                  ) : null}
                                                </div>
                                                <div className="text-[11.5px] leading-5 text-slate-700 whitespace-pre-wrap">
                                                  {adminEntry.note}
                                                </div>
                                              </div>
                                            ) : null}
                                            {alatEntry?.note ? (
                                              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="inline-flex items-center text-[10.5px] font-semibold text-primary/90">
                                                    <Wrench className="mr-1 h-3 w-3" />
                                                    Alat
                                                  </span>
                                                  {alatEntry.status ? (
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${getReviewStatusBadgeStyle(alatEntry.status)}`}>
                                                      {formatReviewStatusLabel(alatEntry.status)}
                                                    </span>
                                                  ) : null}
                                                </div>
                                                <div className="text-[11.5px] leading-5 text-slate-700 whitespace-pre-wrap">
                                                  {alatEntry.note}
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-h-[60px]">
                                            <MessageSquareWarning className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                                            <span className="text-[11.5px] leading-5 text-slate-400 italic">
                                              Belum ada catatan dari Fasilitator Administrasi &amp; Sarana Prasarana untuk Konsentrasi Keahlian ini.
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {form.concentrations.length > 0 ? (
                <Card className="rounded-[24px]">
                  <CardContent className="space-y-4 px-6 py-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rekap Total per Kelas</p>
                    <div className="grid gap-4 md:grid-cols-4">
                      <SummaryTotalsCard
                        label="Kelas 10"
                        rombel={totals.rombel10}
                        siswa={totals.student10}
                        variant="neutral"
                      />
                      <SummaryTotalsCard
                        label="Kelas 11"
                        rombel={totals.rombel11}
                        siswa={totals.student11}
                        variant="neutral"
                      />
                      <SummaryTotalsCard
                        label="Kelas 12"
                        rombel={totals.rombel12}
                        siswa={totals.student12}
                        variant="neutral"
                      />
                      <SummaryTotalsCard
                        label="TOTAL KESELURUHAN"
                        rombel={totals.totalRombel}
                        siswa={totals.totalStudent}
                        variant="highlight"
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

        </>
      )}

      {addConcentrationModalOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setAddConcentrationModalOpen(false);
            setAddConcentrationConfirmBox(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-2xl rounded-[24px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {addConcentrationConfirmBox ? (
              <div className="absolute inset-0 z-110 flex items-center justify-center rounded-[24px] bg-white/98 p-8">
                <div className="w-full max-w-md space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                    <AlertTriangle className="h-8 w-8 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Yakin data yang Anda masukan sudah benar?</h3>
                    <p className="mt-2 text-sm text-slate-500">Periksa kembali ringkasan data di bawah sebelum menyimpan ke tabel.</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 text-left text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5 w-24">Konsentrasi</span>
                      <span className="font-semibold text-slate-900">
                        {addConcentrationDraft.searchText || <span className="italic text-rose-500">Belum dipilih</span>}
                      </span>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="space-y-0.5">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Kelas 10</p>
                        <p className="font-semibold text-slate-900">{addConcentrationDraft.rombel10} Rombel</p>
                        <p className="text-xs text-slate-600">{addConcentrationDraft.student10} Siswa</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Kelas 11</p>
                        <p className="font-semibold text-slate-900">{addConcentrationDraft.rombel11} Rombel</p>
                        <p className="text-xs text-slate-600">{addConcentrationDraft.student11} Siswa</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Kelas 12</p>
                        <p className="font-semibold text-slate-900">{addConcentrationDraft.rombel12} Rombel</p>
                        <p className="text-xs text-slate-600">{addConcentrationDraft.student12} Siswa</p>
                      </div>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Siswa</span>
                      <span className="rounded-full bg-sky-500 px-3 py-1 text-xs font-bold text-white">
                        {(Number(addConcentrationDraft.student10) || 0) + (Number(addConcentrationDraft.student11) || 0) + (Number(addConcentrationDraft.student12) || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Luas RPS</span>
                      <span className="font-semibold text-emerald-700">
                        {addConcentrationDraft.luasRuanganRps || "—"} {addConcentrationDraft.luasRuanganRps ? "m²" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Foto RPS</span>
                      {(() => {
                        const code = addConcentrationDraft.code;
                        const count = code
                          ? (selectedAdministrativeFiles[buildRpsDocumentCode(code)] ?? []).length
                          : 0;
                        return count > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            <FileImage className="h-3 w-3" />
                            {count} file siap diupload
                          </span>
                        ) : (
                          <span className="text-xs italic text-slate-400">Tidak ada</span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddConcentrationConfirmBox(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Batal, Kembali Isi
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!addConcentrationDraft.code || !addConcentrationDraft.name) {
                          setFeedback({ type: "error", text: "Pilih Konsentrasi Keahlian terlebih dahulu." });
                          setAddConcentrationConfirmBox(false);
                          return;
                        }
                        const existingCodes = new Set(form.concentrations.map((c) => c.code).filter(Boolean));
                        if (existingCodes.has(addConcentrationDraft.code)) {
                          setFeedback({ type: "error", text: `Konsentrasi ${addConcentrationDraft.code} sudah ada di tabel.` });
                          setAddConcentrationConfirmBox(false);
                          return;
                        }
                        const newItem: ProfileFormState["concentrations"][number] = {
                          ...addConcentrationDraft,
                          id: addConcentrationDraft.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        };
                        setForm((current) => {
                          const next = {
                            ...current,
                            concentrations: [...current.concentrations, newItem],
                          };
                          scheduleDraftSave(next);
                          return next;
                        });
                        if (!isEditing) setIsEditing(true);
                        setFeedback({
                          type: "success",
                          text: `✓ Konsentrasi Keahlian ${formatConcentrationOptionLabel(addConcentrationDraft.code, addConcentrationDraft.name)} berhasil ditambahkan.`,
                        });
                        setAddConcentrationModalOpen(false);
                        setAddConcentrationConfirmBox(false);
                        setAddConcentrationDraft({
                          id: undefined,
                          code: "",
                          name: "",
                          rombel10: "0",
                          student10: "0",
                          rombel11: "0",
                          student11: "0",
                          rombel12: "0",
                          student12: "0",
                          luasRuanganRps: "",
                          searchText: "",
                          showOptions: false,
                        });
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Ya, Simpan Konsentrasi Ini
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-7 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100">
                  <Layers className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">Tambah Konsentrasi Keahlian Baru</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Isi data di bawah, kemudian klik Simpan. Anda akan diminta konfirmasi sebelum data masuk ke tabel.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 rounded-full hover:bg-slate-100"
                onClick={() => {
                  setAddConcentrationModalOpen(false);
                  setAddConcentrationConfirmBox(false);
                }}
              >
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-5 px-7 py-6">
              <div className="space-y-2">
                <label className="block text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Pilih Konsentrasi Keahlian <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    className="pl-9"
                    placeholder="Cari kode atau nama kompetensi keahlian..."
                    value={addConcentrationDraft.searchText}
                    onChange={(e) =>
                      setAddConcentrationDraft((prev) => ({
                        ...prev,
                        searchText: e.target.value,
                        showOptions: true,
                      }))
                    }
                    onFocus={() =>
                      setAddConcentrationDraft((prev) => ({ ...prev, showOptions: true }))
                    }
                  />
                  {addConcentrationDraft.showOptions ? (
                    <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-[14px] border border-slate-200 bg-white shadow-xl">
                      {(() => {
                        const existingCodes = new Set(form.concentrations.map((c) => c.code).filter(Boolean));
                        const keyword = addConcentrationDraft.searchText.toLowerCase().trim();
                        const filtered = sortedConcentrationOptions
                          .filter((opt) => !existingCodes.has(opt.code))
                          .filter(
                            (opt) =>
                              !keyword ||
                              opt.code.toLowerCase().includes(keyword) ||
                              opt.name.toLowerCase().includes(keyword),
                          );
                        if (filtered.length === 0) {
                          return (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                              {existingCodes.size === 0 ? "Tidak ada data konsentrasi." : "Tidak ditemukan atau semua sudah dipilih."}
                            </div>
                          );
                        }
                        return filtered.map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-2.5 text-left hover:bg-sky-50 last:border-b-0"
                            onClick={() =>
                              setAddConcentrationDraft((prev) => ({
                                ...prev,
                                code: opt.code,
                                name: opt.name,
                                searchText: formatConcentrationOptionLabel(opt.code, opt.name),
                                showOptions: false,
                              }))
                            }
                          >
                            <span className="text-sm font-semibold text-slate-900">
                              {formatConcentrationOptionLabel(opt.code, opt.name)}
                            </span>
                          </button>
                        ));
                      })()}
                    </div>
                  ) : null}
                </div>
                {addConcentrationDraft.code ? (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Terpilih: {formatConcentrationOptionLabel(addConcentrationDraft.code, addConcentrationDraft.name)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {(["10", "11", "12"] as const).map((grade) => {
                  const rombelKey = `rombel${grade}` as "rombel10" | "rombel11" | "rombel12";
                  const siswaKey = `student${grade}` as "student10" | "student11" | "student12";
                  return (
                    <div key={grade} className="space-y-2 rounded-[18px] border border-slate-200 bg-slate-50/50 p-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 text-center">
                        Kelas {grade}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Jumlah Rombel</label>
                          <Input
                            type="number"
                            min={0}
                            value={addConcentrationDraft[rombelKey]}
                            onChange={(e) =>
                              setAddConcentrationDraft((prev) => ({ ...prev, [rombelKey]: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Jumlah Siswa</label>
                          <Input
                            type="number"
                            min={0}
                            value={addConcentrationDraft[siswaKey]}
                            onChange={(e) =>
                              setAddConcentrationDraft((prev) => ({ ...prev, [siswaKey]: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="block text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Luas Ruangan RPS (m²)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Contoh: 96"
                    value={addConcentrationDraft.luasRuanganRps}
                    onChange={(e) =>
                      setAddConcentrationDraft((prev) => ({ ...prev, luasRuanganRps: e.target.value }))
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    m²
                  </span>
                </div>
              </div>

              {(() => {
                const MAX_RPS_MODAL = 5;
                const tempRpsDocCode = buildRpsDocumentCode(addConcentrationDraft.code);
                const rpsSelectedFiles = addConcentrationDraft.code ? (selectedAdministrativeFiles[tempRpsDocCode] ?? []) : [];
                const remainingSlots = Math.max(0, MAX_RPS_MODAL - rpsSelectedFiles.length);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Upload Foto RPS <span className="text-emerald-600">(Maks {MAX_RPS_MODAL} File Gambar)</span>
                      </label>
                      {rpsSelectedFiles.length > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-sky-700">
                          {rpsSelectedFiles.length} foto dipilih
                        </span>
                      ) : null}
                    </div>
                    {!addConcentrationDraft.code ? (
                      <div className="rounded-[14px] border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs italic text-slate-400 text-center">
                        Pilih Konsentrasi Keahlian terlebih dahulu untuk bisa upload foto RPS.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {rpsSelectedFiles.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {rpsSelectedFiles.map((file, idx) => {
                              const isImage = isImageFile(file.name, file.type);
                              const previewUrl = isImage ? URL.createObjectURL(file) : "";
                              return (
                                <div key={`rps-modal-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-primary/40 bg-primary/[0.06]">
                                  <div className="flex h-full w-full items-center justify-center">
                                    {isImage ? (
                                      <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <FileText className="h-5 w-5 text-primary/60" />
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAdministrativeFiles((current) => {
                                        const next = [...(current[tempRpsDocCode] ?? [])];
                                        next.splice(idx, 1);
                                        return { ...current, [tempRpsDocCode]: next };
                                      });
                                    }}
                                    title="Batalkan foto ini"
                                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-danger shadow ring-1 ring-rose-200 hover:bg-rose-50 z-10"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        {remainingSlots > 0 ? (
                          <label className="block cursor-pointer">
                            <div className="flex items-center justify-center rounded-[14px] border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center transition hover:border-primary hover:bg-accent-soft/40">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                                  <Upload className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="text-left">
                                  <p className="text-[12px] font-semibold text-slate-800 leading-tight">
                                    Tambah Foto RPS (Tersisa {remainingSlots} Slot)
                                  </p>
                                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                                    Format JPG / PNG / WebP / GIF • Maks 10 MB per file
                                  </p>
                                </div>
                              </div>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                  const allIncoming = Array.from(event.target.files ?? []);
                                  const incoming = allIncoming.filter((f) => isImageFile(f.name, f.type));
                                  if (incoming.length === 0 && allIncoming.length > 0) {
                                    window.alert("Hanya format gambar JPG/JPEG/PNG/WebP/GIF yang diterima.");
                                    event.target.value = "";
                                    return;
                                  }
                                  setSelectedAdministrativeFiles((current) => {
                                    const existing = Array.isArray(current[tempRpsDocCode]) ? [...current[tempRpsDocCode]] : [];
                                    const available = Math.max(0, MAX_RPS_MODAL - existing.length);
                                    if (incoming.length > 0 && available <= 0) {
                                      window.alert(`Maksimal ${MAX_RPS_MODAL} foto per konsentrasi.`);
                                      return current;
                                    }
                                    const toAppend = incoming.slice(0, available || 0);
                                    return {
                                      ...current,
                                      [tempRpsDocCode]: [...existing, ...toAppend],
                                    };
                                  });
                                  event.target.value = "";
                                }}
                              />
                            </div>
                          </label>
                        ) : (
                          <div className="rounded-[14px] border border-sky-200 bg-sky-50/60 px-4 py-2.5 text-xs font-medium text-sky-700 text-center">
                            ✓ Kuota upload foto RPS terpenuhi ({rpsSelectedFiles.length}/{MAX_RPS_MODAL})
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center gap-2 rounded-[14px] border border-sky-200 bg-sky-50/60 px-3.5 py-2.5 text-xs text-sky-800">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Total Siswa otomatis: <strong className="font-bold">{(Number(addConcentrationDraft.student10) || 0) + (Number(addConcentrationDraft.student11) || 0) + (Number(addConcentrationDraft.student12) || 0)}</strong> siswa
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-7 py-4 rounded-b-[24px] bg-slate-50/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddConcentrationModalOpen(false);
                  setAddConcentrationConfirmBox(false);
                }}
              >
                <X className="h-4 w-4" />
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!addConcentrationDraft.code || !addConcentrationDraft.name) {
                    setFeedback({ type: "error", text: "Pilih Konsentrasi Keahlian terlebih dahulu." });
                    return;
                  }
                  const existingCodes = new Set(form.concentrations.map((c) => c.code).filter(Boolean));
                  if (existingCodes.has(addConcentrationDraft.code)) {
                    setFeedback({ type: "error", text: `Konsentrasi ${addConcentrationDraft.code} sudah ada di tabel.` });
                    return;
                  }
                  setAddConcentrationConfirmBox(true);
                }}
              >
                <Save className="h-4 w-4" />
                Simpan Data
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxState ? (
        <LightboxViewer
          items={lightboxState.items}
          index={lightboxState.index}
          onClose={() => setLightboxState(null)}
          onNavigate={(nextIndex) => setLightboxState((prev) => (prev ? { ...prev, index: nextIndex } : prev))}
        />
      ) : null}
    </div>
  );
}

function LightboxViewer({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: Array<{ url: string; title: string; isImage: boolean }>;
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const total = items.length;
  const current = items[index] ?? items[0];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") {
        if (total > 1) onNavigate((index - 1 + total) % total);
      } else if (e.key === "ArrowRight") {
        if (total > 1) onNavigate((index + 1) % total);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, total, onClose, onNavigate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="relative w-full max-w-[98vw]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4 px-2 text-white">
          <p className="truncate text-sm font-medium opacity-90 max-w-[75%]" title={current.title}>
            {current.title || "Preview"}
          </p>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider ring-1 ring-white/15">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup preview"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          {total > 1 ? (
            <button
              type="button"
              onClick={() => onNavigate((index - 1 + total) % total)}
              aria-label="Gambar sebelumnya"
              className="absolute left-0 z-10 -translate-x-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 sm:-translate-x-6"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          ) : null}

          <div className="flex max-h-[84vh] w-full items-center justify-center">
            <img
              src={current.url}
              alt={current.title || "Preview gambar"}
              className="max-h-[84vh] w-auto max-w-[94vw] rounded-xl object-contain shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
            />
          </div>

          {total > 1 ? (
            <button
              type="button"
              onClick={() => onNavigate((index + 1) % total)}
              aria-label="Gambar selanjutnya"
              className="absolute right-0 z-10 translate-x-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 sm:translate-x-6"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function KelasInputs({
  label,
  rombel,
  siswa,
  disabled,
  onChangeRombel,
  onChangeSiswa,
}: {
  label: string;
  rombel: string;
  siswa: string;
  disabled?: boolean;
  onChangeRombel: (value: string) => void;
  onChangeSiswa: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <div className="space-y-2">
        <Field label="Rombel">
          <Input type="number" min="0" value={rombel} onChange={(event) => onChangeRombel(event.target.value)} disabled={disabled} />
        </Field>
        <Field label="Siswa">
          <Input type="number" min="0" value={siswa} onChange={(event) => onChangeSiswa(event.target.value)} disabled={disabled} />
        </Field>
      </div>
    </div>
  );
}

function SummaryTotalsCard({
  label,
  rombel,
  siswa,
  variant,
}: {
  label: string;
  rombel: number;
  siswa: number;
  variant: "neutral" | "highlight";
}) {
  if (variant === "highlight") {
    return (
      <div className="rounded-2xl bg-primary px-4 py-4 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">{label}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-white/80">Rombel</p>
            <p className="mt-1 text-xl font-semibold">{rombel}</p>
          </div>
          <div>
            <p className="text-xs text-white/80">Siswa</p>
            <p className="mt-1 text-xl font-semibold">{siswa}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Rombel</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{rombel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Siswa</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{siswa}</p>
        </div>
      </div>
    </div>
  );
}
