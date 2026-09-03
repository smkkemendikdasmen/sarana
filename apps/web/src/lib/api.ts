"use client";

import type { AuthSession } from "@/lib/roles";
import type { DashboardPayload } from "@/lib/dashboard-content";

export const API_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
const CLIENT_CACHE_TTL_MS = 15 * 60 * 1000;
const SHORT_TTL_MS = 90 * 1000;
const MASTER_DATA_TTL_MS = 12 * 60 * 60 * 1000;
const WILAYAH_TTL_MS = 24 * 60 * 60 * 1000;
const clientGetInFlight = new Map<string, Promise<unknown>>();

const AUTH_STORAGE_KEY = "prisma-session";

function getCurrentBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown as Partial<AuthSession>;
    return parsed?.token?.trim() || null;
  } catch {
    return null;
  }
}

export function buildGetInit(): RequestInit {
  const token = getCurrentBearerToken();
  if (!token) return {};
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export function buildJsonMutationInit(method: "POST" | "PUT" | "DELETE" | "PATCH", body?: unknown): RequestInit {
  const token = getCurrentBearerToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterSchoolPayload {
  schoolName: string;
  npsn: string;
  province: string;
  contactName: string;
  email: string;
  username: string;
  password: string;
}

interface ApiErrorBody {
  message?: string | string[];
}

export interface PerdirjenEquipmentSummaryKonsentrasi {
  no: string;
  nama: string;
}

export interface PerdirjenEquipmentSummaryProgram {
  no: string;
  nama: string;
  konsentrasi: PerdirjenEquipmentSummaryKonsentrasi[];
}

export interface PerdirjenEquipmentSummaryBidang {
  no: string;
  bidang: string;
  totalProgram: number;
  totalKonsentrasi: number;
  totalItem: number;
  program: PerdirjenEquipmentSummaryProgram[];
}

export type PerdirjenEquipmentSummary = PerdirjenEquipmentDetailBidang;

export interface PerdirjenEquipmentItem {
  "Nama Alat": string;
  "Fungsi Alat": string;
  "Spesifikasi Alat": string;
  "Rasio Satuan": string;
}

export interface PerdirjenEquipmentItemInput {
  name: string;
  functionText: string;
  specificationText: string;
  ratio: string;
}

export interface PerdirjenEquipmentDetailKonsentrasi {
  no: string;
  nama: string;
  "Peralatan Praktik Utama Kriteria Minimal": PerdirjenEquipmentItem[];
  "Peralatan Praktik Utama Kriteria Pengembangan": PerdirjenEquipmentItem[];
  "Peralatan Praktik Pendukung": PerdirjenEquipmentItem[];
}

export interface PerdirjenEquipmentDetailProgram {
  no: string;
  nama: string;
  konsentrasi: PerdirjenEquipmentDetailKonsentrasi[];
}

export interface PerdirjenEquipmentDetailBidang {
  no: string;
  bidang: string;
  totalProgram: number;
  totalKonsentrasi: number;
  totalItem: number;
  program: PerdirjenEquipmentDetailProgram[];
}

export interface CpFaseFSummaryKonsentrasi {
  no: string;
  nama: string;
}

export interface CpFaseFSummaryProgram {
  no: string;
  nama: string;
  konsentrasi: CpFaseFSummaryKonsentrasi[];
}

export interface CpFaseFSummaryBidang {
  no: string;
  bidang: string;
  totalProgram: number;
  totalKonsentrasi: number;
  totalItem: number;
  program: CpFaseFSummaryProgram[];
}

export interface CpFaseFItem {
  Elemen: string;
  Deskripsi: string;
}

export interface CpFaseFItemInput {
  elemen: string;
  deskripsi: string;
}

export interface CpFaseFDetailKonsentrasi {
  no: string;
  nama: string;
  "Capaian Pembelajaran Fase F": CpFaseFItem[];
}

export interface CpFaseFDetailProgram {
  no: string;
  nama: string;
  konsentrasi: CpFaseFDetailKonsentrasi[];
}

export interface CpFaseFDetailBidang {
  no: string;
  bidang: string;
  totalProgram: number;
  totalKonsentrasi: number;
  totalItem: number;
  program: CpFaseFDetailProgram[];
}

interface Envelope<T> {
  ok: boolean;
  data: T;
  traceId?: string;
  ts?: string;
}

function unwrapEnvelope<T>(raw: unknown): T {
  const anyRaw = raw as Envelope<T> | T;
  if (anyRaw && typeof anyRaw === "object" && "data" in anyRaw && Object.prototype.hasOwnProperty.call(anyRaw, "data") && Object.prototype.hasOwnProperty.call(anyRaw, "ok")) {
    return (anyRaw as Envelope<T>).data;
  }
  return anyRaw as T;
}

function isLikelyConnectionFailure(err: unknown): boolean {
  if (err instanceof TypeError) {
    const m = String(err.message || "").toLowerCase();
    if (m.includes("failed to fetch")) return true;
    if (m.includes("load failed")) return true;
    if (m.includes("networkerror")) return true;
    if (m.includes("connection refused")) return true;
  }
  return false;
}

function formatFetchFailureMessage(_url: string): string {
  return "Tidak dapat terhubung ke server. Pastikan server web lokal (port 3000) dan backend API (port 4000) sedang berjalan. Jika masih gagal, coba refresh halaman.";
}

async function parseError(response: Response) {
  const status = typeof response.status === "number" ? response.status : 0;
  const isUnauthorized = status === 401;

  if (isUnauthorized && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
    }
    clearClientGetCache();
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    const loginHref =
      currentPath && currentPath !== "/login"
        ? `/login?redirect=${encodeURIComponent(currentPath)}`
        : "/login";
    window.location.href = loginHref;
    throw new Error("Sesi Anda habis atau tidak valid. Silakan login ulang. (HTTP 401)");
  }

  let message = "Terjadi kesalahan pada server.";
  const statusHint = typeof response.status === "number" ? ` (HTTP ${response.status})` : "";
  const contentType =
    typeof response.headers?.get === "function" ? String(response.headers.get("content-type") || "") : "";

  try {
    const rawBody = (await response.json()) as ApiErrorBody | Envelope<ApiErrorBody>;
    const body: ApiErrorBody = (rawBody && typeof rawBody === "object" && "data" in rawBody && Object.prototype.hasOwnProperty.call(rawBody, "data")
      ? (rawBody as Envelope<ApiErrorBody>).data
      : rawBody) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      message = body.message[0] ?? message;
    } else if (body.message) {
      message = body.message;
    }
    if (statusHint && !/\bHTTP\s*\d{3}\b/.test(message)) message = `${message}${statusHint}`;
  } catch {
    if (!contentType.toLowerCase().includes("application/json")) {
      message = `Server merespons dengan format yang tidak dapat diproses${statusHint}. Pastikan layanan web dan backend API sedang berjalan normal, atau coba refresh halaman.`;
    } else {
      message = `Gagal memproses respons server${statusHint}.`;
    }
  }

  throw new Error(message);
}

function readClientGetCache<T>(_key: string) {
  return null as T | null;
}

function writeClientGetCache<T>(_key: string, _value: T, _ttlMs: number) {
  return;
}

export function clearClientGetCache(prefix?: string) {
  if (!prefix) {
    clientGetInFlight.clear();
  } else {
    for (const key of clientGetInFlight.keys()) {
      if (key.startsWith(prefix)) {
        clientGetInFlight.delete(key);
      }
    }
  }

  try {
    const qc: any = (typeof window !== "undefined" && (window as any).__queryClient) || (globalThis as any).__queryClient;
    if (qc && typeof qc.invalidateQueries === "function") {
      qc.invalidateQueries();
    }
  } catch {
  }
}

async function cachedGetJson<T>(url: string, _ttlMs = CLIENT_CACHE_TTL_MS): Promise<T> {
  const inFlight = clientGetInFlight.get(url);
  if (inFlight) {
    return (await inFlight) as T;
  }

  const request = fetch(url, buildGetInit())
    .then(async (response) => {
      if (!response.ok) {
        await parseError(response);
      }

      return unwrapEnvelope<T>(await response.json());
    })
    .finally(() => {
      clientGetInFlight.delete(url);
    });

  clientGetInFlight.set(url, request);
  return (await request) as T;
}

export async function loginRequest(payload: LoginPayload): Promise<AuthSession> {
  const url = `${API_URL}/auth/login`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (isLikelyConnectionFailure(err)) {
      throw new Error(formatFetchFailureMessage(url));
    }
    throw err;
  }

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<AuthSession>(await response.json());
}

export async function registerSchoolRequest(
  payload: RegisterSchoolPayload,
): Promise<AuthSession> {
  const url = `${API_URL}/auth/register-school`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (isLikelyConnectionFailure(err)) {
      throw new Error(formatFetchFailureMessage(url));
    }
    throw err;
  }

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<AuthSession>(await response.json());
}

export async function dashboardRequest(
  token: string,
  roleSlug: string,
): Promise<DashboardPayload> {
  const url = `${API_URL}/dashboards/${roleSlug}`;
  const cached = readClientGetCache<DashboardPayload>(url);
  if (cached !== null) return cached;

  const inFlight = clientGetInFlight.get(url) as Promise<DashboardPayload> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        await parseError(response);
      }
      const payload = unwrapEnvelope<DashboardPayload>(await response.json());
      writeClientGetCache(url, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => {
      clientGetInFlight.delete(url);
    });

  clientGetInFlight.set(url, request);
  return request;
}

export async function perdirjenEquipmentSummaryRequest(): Promise<PerdirjenEquipmentSummaryBidang[]> {
  return cachedGetJson<PerdirjenEquipmentSummaryBidang[]>(`${API_URL}/master-data/perdirjen-equipment`, MASTER_DATA_TTL_MS);
}

export async function perdirjenEquipmentBidangRequest(code: string): Promise<PerdirjenEquipmentDetailBidang> {
  return cachedGetJson<PerdirjenEquipmentDetailBidang>(`${API_URL}/master-data/perdirjen-equipment/bidang/${code}`, MASTER_DATA_TTL_MS);
}

export async function perdirjenEquipmentPdfPageMapRequest(): Promise<PerdirjenEquipmentPdfPageMap> {
  return cachedGetJson<PerdirjenEquipmentPdfPageMap>(`${API_URL}/master-data/perdirjen-equipment/pdf-page-map`, MASTER_DATA_TTL_MS);
}

export type WilayahRecord = {
  kode: string;
  nama: string;
  level: "PROVINSI" | "KABUPATEN_KOTA" | "KECAMATAN" | "KELURAHAN_DESA";
  length: number;
  parentKode: string | null;
};

export async function wilayahProvinsiRequest(): Promise<WilayahRecord[]> {
  return cachedGetJson<WilayahRecord[]>(`${API_URL}/master-data/wilayah/provinsi`, WILAYAH_TTL_MS);
}

export async function wilayahKabupatenRequest(parentKode: string): Promise<WilayahRecord[]> {
  const safe = encodeURIComponent(String(parentKode || "").trim());
  return cachedGetJson<WilayahRecord[]>(`${API_URL}/master-data/wilayah/kabupaten?parent_kode=${safe}`, WILAYAH_TTL_MS);
}

export async function wilayahKecamatanRequest(parentKode: string): Promise<WilayahRecord[]> {
  const safe = encodeURIComponent(String(parentKode || "").trim());
  return cachedGetJson<WilayahRecord[]>(`${API_URL}/master-data/wilayah/kecamatan?parent_kode=${safe}`, WILAYAH_TTL_MS);
}

export async function wilayahKelurahanRequest(parentKode: string): Promise<WilayahRecord[]> {
  const safe = encodeURIComponent(String(parentKode || "").trim());
  return cachedGetJson<WilayahRecord[]>(`${API_URL}/master-data/wilayah/kelurahan?parent_kode=${safe}`, WILAYAH_TTL_MS);
}

export async function replacePerdirjenEquipmentCategoryItemsRequest(
  concentrationCode: string,
  category: "minimal" | "pengembangan" | "pendukung",
  items: PerdirjenEquipmentItemInput[],
): Promise<PerdirjenEquipmentItem[]> {
  const response = await fetch(`${API_URL}/master-data/perdirjen-equipment/concentrations/${concentrationCode}/categories/${category}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/master-data/perdirjen-equipment`);
  const payload = unwrapEnvelope<{ items: PerdirjenEquipmentItem[] }>(await response.json());
  return payload.items;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  passwordDefault: string | null;
  passwordCurrent?: string | null;
  passwordChangedAt: string | null;
  mustChangePassword: boolean;
  roleCode: string;
  roleName: string;
  schoolId: string | null;
  schoolName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminRoleOption {
  id: number;
  code: string;
  name: string;
}

export interface AdminSchoolOption {
  id: string;
  name: string;
  npsn: string;
  provinsi: string;
  kotaKabupaten: string;
}

export interface AdminUsersPayload {
  users: AdminUserRecord[];
  roles: AdminRoleOption[];
  schools: AdminSchoolOption[];
}

export interface AdminUserInput {
  username: string;
  fullName: string;
  roleCode: string;
  schoolId: string | null;
  password?: string;
  isActive: boolean;
  email?: string | null;
}

export interface SchoolProfileConcentrationRecord {
  id?: string;
  code: string;
  name: string;
  rombelCount: number;
  studentCount: number;
  rombel10: number;
  student10: number;
  rombel11: number;
  student11: number;
  rombel12: number;
  student12: number;
  luasRuanganRps?: string;
  rowOrder?: number;
  isAdminRecommendation?: boolean;
  sourceType?: "ADMIN_RECOMMENDATION" | "SCHOOL_MANUAL";
  sourceLabel?: string;
}

export const ADMINISTRATIVE_DOCUMENT_LABELS: Readonly<Record<string, string>> = {
  "sk-pengangkatan-kepala-sekolah": "SK Pengangkatan Kepala Sekolah",
  "scan-ktp-kepala-sekolah": "Scan KTP Kepala Sekolah",
  "sertifikat-akreditasi": "Sertifikat Akreditasi",
  "npwp-sekolah-atau-dinas": "NPWP Sekolah / NPWP Dinas Pendidikan",
  "akta-pendirian-yayasan": "Akta Pendirian Yayasan (SMK Swasta)",
  "pengesahan-yayasan-kemenkumham": "Surat Pengesahan Yayasan Kemenkumham",
  "izin-operasional-sekolah": "Izin Operasional Sekolah",
  "surat-rekomendasi-dinas-pendidikan": "Surat Rekomendasi Dinas Pendidikan",
  "surat-pernyataan-daya-listrik": "Surat Pernyataan + Bukti Daya Listrik",
  "surat-pernyataan-tidak-menunggak-bantuan": "Surat Pernyataan Tidak Menunggak Bantuan",
  "sk-tim-pengadaan-pemeriksa-penerima": "SK Tim Pengadaan/Pemeriksa/Penerima",
  "surat-pernyataan": "Surat Pernyataan",
  "dokumen-kondisi-sarana-dan-peralatan": "Dokumen Kondisi Sarana & Peralatan",
  "analisis-kebutuhan-sarana-dan-peralatan": "Analisis Kebutuhan Sarana & Peralatan",
  "survei-harga-pasar": "Survei Harga Pasar",
  "rab-peralatan": "RAB Peralatan",
  "rpkp": "RPKP",
};

export interface SchoolProfileOrganizationMemberRecord {
  id?: string;
  roleName: string;
  memberName: string;
  contactPhone: string;
}

export interface SchoolProfileConcentrationOption {
  code: string;
  name: string;
}

export type AdministrativeDocumentReviewStatus = "PENDING" | "PROSES" | "DISETUJUI" | "DITOLAK";

export interface SchoolAdministrativeDocumentFileRecord {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string | null;
  reviewStatus: AdministrativeDocumentReviewStatus | string;
  reviewNotes: string;
}

export interface SchoolAdministrativeDocumentRecord {
  no: number;
  code: string;
  name: string;
  required: boolean;
  allowMultiple: boolean;
  maxFiles: number;
  uploaded: boolean;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string | null;
  reviewStatus: AdministrativeDocumentReviewStatus | string;
  reviewNotes: string;
  files: SchoolAdministrativeDocumentFileRecord[];
  isRpsPerConcentration?: boolean;
  concentrationCode?: string;
  concentrationName?: string;
}

export const RPS_DOCUMENT_CODE_PREFIX = "dokumen-kondisi-rps";

export function buildRpsDocumentCode(concentrationCode: string): string {
  const clean = String(concentrationCode ?? "").trim();
  return `${RPS_DOCUMENT_CODE_PREFIX}__${clean}`;
}

export function isRpsDocumentCode(code: string): boolean {
  return (code ?? "").startsWith(`${RPS_DOCUMENT_CODE_PREFIX}__`);
}

export const ADMINISTRATIVE_DOCUMENT_UMUM_CODES: readonly string[] = [
  "sk-pengangkatan-kepala-sekolah",
  "scan-ktp-kepala-sekolah",
  "sertifikat-akreditasi",
  "npwp-sekolah-atau-dinas",
  "akta-pendirian-yayasan",
  "pengesahan-yayasan-kemenkumham",
  "izin-operasional-sekolah",
  "surat-rekomendasi-dinas-pendidikan",
  "surat-pernyataan-daya-listrik",
  "surat-pernyataan-tidak-menunggak-bantuan",
  "sk-tim-pengadaan-pemeriksa-penerima",
  "surat-pernyataan",
];

export const ASSET_DOCUMENT_CODES: readonly string[] = [
  "dokumen-kondisi-sarana-dan-peralatan",
];

export const PENGAJUAN_DOCUMENT_CODES: readonly string[] = [
  "analisis-kebutuhan-sarana-dan-peralatan",
  "survei-harga-pasar",
  "rab-peralatan",
  "rpkp",
];

export type FormatFileExtension = "docx" | "xlsx" | "pdf";
export type DownloadableFormatFile = {
  fileName: string;
  label: string;
  extension: FormatFileExtension;
};

export type DocumentFormatMap = Readonly<Record<string, readonly DownloadableFormatFile[]>>;

export const DOCUMENT_FORMAT_DOWNLOADS: DocumentFormatMap = {
  "surat-pernyataan": [
    { fileName: "Surat Pernyataan.docx", label: "Format Surat Pernyataan", extension: "docx" },
  ],
  "sk-tim-pengadaan-pemeriksa-penerima": [
    { fileName: "Format SK Tim Pengadaan SMK.docx", label: "Format SK Tim Pengadaan, Pemeriksa & Penerima", extension: "docx" },
  ],
};

export const FORMAT_FILES_BASE_PATH = "/data/Format";

export type PrincipalPosition = "KEPALA_SEKOLAH" | "PLT_KEPALA_SEKOLAH";

export interface SchoolProfileRecord {
  schoolId: string;
  npsn: string;
  schoolName: string;
  province: string;
  provinceCode: string;
  city: string;
  cityCode: string;
  district: string;
  districtCode: string;
  village: string;
  villageCode: string;
  regionDisplay: string;
  address: string;
  postalCode: string;
  documentLink?: string;
  rpdLink?: string;
  pksLink?: string;
  latitude: number | null;
  longitude: number | null;
  principalName: string;
  principalPosition: PrincipalPosition | string;
  principalNip: string;
  principalPhone: string;
  principalEmail?: string;
  vicePrincipalFacilitiesName: string;
  vicePrincipalFacilitiesPhone: string;
  vicePrincipalFacilitiesEmail?: string;
  verificationStatus: string;
  verificationReviewNotes: string;
  organizationMembers: SchoolProfileOrganizationMemberRecord[];
  concentrations: SchoolProfileConcentrationRecord[];
  concentrationOptions: SchoolProfileConcentrationOption[];
  totalRombel: number;
  totalStudents: number;
}

export interface SchoolProfileInput {
  npsn: string;
  schoolName: string;
  province: string;
  provinceCode?: string;
  city: string;
  cityCode?: string;
  district?: string;
  districtCode?: string;
  village?: string;
  villageCode?: string;
  address: string;
  postalCode: string;
  documentLink?: string;
  rpdLink?: string;
  pksLink?: string;
  latitude: number | null;
  longitude: number | null;
  principalName: string;
  principalPosition?: PrincipalPosition | string | null;
  principalNip?: string;
  principalPhone: string;
  principalEmail?: string;
  vicePrincipalFacilitiesName: string;
  vicePrincipalFacilitiesPhone: string;
  vicePrincipalFacilitiesEmail?: string;
  verificationStatus?: string | null;
  verificationReviewNotes?: string | null;
  organizationMembers: SchoolProfileOrganizationMemberRecord[];
  concentrations: SchoolProfileConcentrationRecord[];
}

export async function adminUsersRequest(): Promise<AdminUsersPayload> {
  return cachedGetJson<AdminUsersPayload>(`${API_URL}/users`, 60 * 1000);
}

export async function createAdminUserRequest(payload: AdminUserInput): Promise<AdminUserRecord> {
  const response = await fetch(`${API_URL}/users`, buildJsonMutationInit("POST", payload));

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
  return unwrapEnvelope<AdminUserRecord>(await response.json());
}

export async function updateAdminUserRequest(id: string, payload: AdminUserInput): Promise<AdminUserRecord> {
  const response = await fetch(`${API_URL}/users/${id}`, buildJsonMutationInit("PUT", payload));

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
  return unwrapEnvelope<AdminUserRecord>(await response.json());
}

export async function deleteAdminUserRequest(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/users/${id}`, buildJsonMutationInit("DELETE"));

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
}

export async function bulkSekolahSetActiveRequest(
  token: string,
  roleCode: string,
  isActive: boolean,
): Promise<{
  ok: boolean;
  roleCode: string;
  toIsActive: boolean;
  totalFound: number;
  totalAffected: number;
  totalChanged: number;
}> {
  const response = await fetch(`${API_URL}/users/bulk-set-active-by-role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roleCode, isActive }),
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
  return unwrapEnvelope<{
    ok: boolean;
    roleCode: string;
    toIsActive: boolean;
    totalFound: number;
    totalAffected: number;
    totalChanged: number;
  }>(await response.json());
}

export async function resetPasswordDefaultAdminRequest(
  token: string,
  id: string,
): Promise<{ user: AdminUserRecord; newPassword: string }> {
  const response = await fetch(`${API_URL}/users/${id}/reset-password-default`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
  return unwrapEnvelope<{ user: AdminUserRecord; newPassword: string }>(await response.json());
}

export async function resetAllSekolahPasswordDefaultAdminRequest(
  token: string,
): Promise<{
  totalFound: number;
  totalReset: number;
  totalFailed: number;
  newPassword: string;
  message: string;
  gagalIds: Array<{ id: string; username: string; error: string }>;
}> {
  const response = await fetch(`${API_URL}/users/bulk-reset-sekolah-password-default`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
  return unwrapEnvelope<{
    totalFound: number;
    totalReset: number;
    totalFailed: number;
    newPassword: string;
    message: string;
    gagalIds: Array<{ id: string; username: string; error: string }>;
  }>(await response.json());
}

export async function changePasswordFirstTimeRequest(
  token: string,
  userId: string,
  payload: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
    email: string;
  },
): Promise<{ success: boolean; user: AdminUserRecord | null }> {
  const response = await fetch(`${API_URL}/users/${userId}/change-password-first-time`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/users`);
  return unwrapEnvelope<{ success: boolean; user: AdminUserRecord | null }>(await response.json());
}

/**
 * SCOPE PREFIX V5 (FIX K4: cache invalidation prefix mismatch SEBELUMNYA)
 * Aturan PENTING: Format SAMA untuk WRITE, READ, dan CLEAR agar 100% MATCH.
 * - SCOPE KEY per URL penuh:   `${SEP}${url}${SEP}${scope}`
 * - SCOPE PREFIX untuk CLEAR: `${SEP}${urlPrefix}`  (match semua cache yang base-nya urlPrefix, tanpa peduli suffix path)
 * SEPARATOR diganti dari "|" menjadi "::" untuk menghindari pipe conflict
 * dengan clearClientGetCache prefix matching biasa.
 */
const CACHE_V5_SEP = "::";
export function _debugGetCacheSep() {
  return CACHE_V5_SEP;
}
function tokenToScope(token: string | null | undefined): string {
  const safe = String(token || "").trim();
  if (!safe) return "anonymous";
  // Gunakan hash singkat (bukan slice last-24) — agar tidak perlu khawatir format token.
  let hash = 0;
  for (let i = 0; i < safe.length; i++) hash = (hash * 31 + safe.charCodeAt(i)) | 0;
  const u = hash >>> 0;
  return u.toString(36).padStart(8, "0") + safe.slice(-6).padEnd(6, "0");
}
function scopedCacheKey(token: string, url: string): string {
  return `${CACHE_V5_SEP}${url}${CACHE_V5_SEP}${tokenToScope(token)}`;
}
/**
 * Invalidate SEMUA cache entry yang URL-nya DIAWALI dengan urlBasePrefix (untuk TOKEN tertentu).
 * Contoh: invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals`)
 *   → akan hapus: /school-proposals/me, /school-proposals/by-npsn/1234, dst.
 */
export function invalidateScopedCacheByPrefix(token: string | null | undefined, urlBasePrefix: string) {
  const scopePrefix = `${CACHE_V5_SEP}${urlBasePrefix}`;
  let killedInflight = 0;
  for (const k of Array.from(clientGetInFlight.keys())) {
    if (k.startsWith(scopePrefix)) {
      clientGetInFlight.delete(k);
      killedInflight++;
    }
  }
  const killedCache = 0;
  return { killedCache, killedInflight };
}
/**
 * Alias LEGACY compatibility: untuk kode lama yang masih pakai clearClientGetCache(`${url}|`)
 * kita tetap biarkan berjalan, TAPI selalu DITAMBAH dengan invalidateScopedCacheByPrefix.
 * Tidak ada salah double-invalidate, yang penting TIDAK ADA cache tersisa stale.
 */

export async function schoolProfileRequest(token: string): Promise<SchoolProfileRecord> {
  const url = `${API_URL}/school-profile/me`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<SchoolProfileRecord>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<SchoolProfileRecord> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<SchoolProfileRecord>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function schoolProfileByNpsnRequest(
  token: string,
  npsn: string,
): Promise<SchoolProfileRecord> {
  const url = `${API_URL}/school-profile/by-npsn/${encodeURIComponent(npsn)}`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<SchoolProfileRecord>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<SchoolProfileRecord> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<SchoolProfileRecord>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export interface SchoolConcentrationsSummaryRecord {
  id: string;
  npsn: string;
  name: string;
  totalStudents: number;
  totalRombel: number;
  concentrations: Array<{
    code: string;
    name: string;
    studentCount: number;
    rombelCount: number;
  }>;
  top3Concentrations: Array<{
    code: string;
    name: string;
    studentCount: number;
    rombelCount: number;
  }>;
}

export async function schoolConcentrationsSummaryRequest(
  token: string,
): Promise<SchoolConcentrationsSummaryRecord[]> {
  const url = `${API_URL}/school-profile/list-concentrations-summary`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<SchoolConcentrationsSummaryRecord[]>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<SchoolConcentrationsSummaryRecord[]> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<SchoolConcentrationsSummaryRecord[]>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function updateSchoolProfileRequest(token: string, payload: SchoolProfileInput): Promise<SchoolProfileRecord> {
  const response = await fetch(`${API_URL}/school-profile/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  // Invalidate V5 scope (ALL /school-profile/... URL cache, TIDAK peduli suffix/by-npsn)
  invalidateScopedCacheByPrefix(token, `${API_URL}/school-profile`);
  // Legacy fallback (tetap jalankan agar format V4 tidak tersisa stale)
  clearClientGetCache(`${API_URL}/school-profile/me|`);
  clearClientGetCache(`${API_URL}/school-profile/by-npsn/|`);
  const updated = unwrapEnvelope<SchoolProfileRecord>(await response.json());
  // WRITE BACK ke cache agar next GET langsung fresh, TIDAK perlu request lagi
  const keyFresh = scopedCacheKey(token, `${API_URL}/school-profile/me`);
  writeClientGetCache(keyFresh, updated, SHORT_TTL_MS);
  if (updated?.npsn) {
    const keyNpsnFresh = scopedCacheKey(
      token,
      `${API_URL}/school-profile/by-npsn/${encodeURIComponent(String(updated.npsn))}`,
    );
    writeClientGetCache(keyNpsnFresh, updated, SHORT_TTL_MS);
  }
  return updated;
}

export async function schoolAdministrativeDocumentsRequest(
  token: string,
): Promise<SchoolAdministrativeDocumentRecord[]> {
  const url = `${API_URL}/school-profile/me/administrative-documents`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<SchoolAdministrativeDocumentRecord[]>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<SchoolAdministrativeDocumentRecord[]> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<SchoolAdministrativeDocumentRecord[]>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function schoolAdministrativeDocumentsByNpsnRequest(
  token: string,
  npsn: string,
): Promise<SchoolAdministrativeDocumentRecord[]> {
  const url = `${API_URL}/school-profile/by-npsn/${encodeURIComponent(npsn)}/administrative-documents`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<SchoolAdministrativeDocumentRecord[]>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<SchoolAdministrativeDocumentRecord[]> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<SchoolAdministrativeDocumentRecord[]>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function uploadSchoolAdministrativeDocumentRequest(
  token: string,
  documentCode: string,
  file: File,
): Promise<SchoolAdministrativeDocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/school-profile/me/administrative-documents/${documentCode}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/school-profile/me/administrative-documents|`);
  clearClientGetCache(`${API_URL}/school-profile/by-npsn/`);
  return unwrapEnvelope<SchoolAdministrativeDocumentRecord>(await response.json());
}

export async function deleteSchoolAdministrativeDocumentFileRequest(
  token: string,
  fileId: string,
): Promise<SchoolAdministrativeDocumentRecord[]> {
  const response = await fetch(`${API_URL}/school-profile/me/administrative-documents/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/school-profile/me/administrative-documents|`);
  clearClientGetCache(`${API_URL}/school-profile/by-npsn/`);
  return unwrapEnvelope<SchoolAdministrativeDocumentRecord[]>(await response.json());
}

export async function cpFaseFSummaryRequest(): Promise<CpFaseFSummaryBidang[]> {
  return cachedGetJson<CpFaseFSummaryBidang[]>(`${API_URL}/master-data/cp-fase-f`, MASTER_DATA_TTL_MS);
}

export async function cpFaseFBidangRequest(code: string): Promise<CpFaseFDetailBidang> {
  return cachedGetJson<CpFaseFDetailBidang>(`${API_URL}/master-data/cp-fase-f/bidang/${code}`, MASTER_DATA_TTL_MS);
}

export async function replaceCpFaseFConcentrationItemsRequest(
  concentrationCode: string,
  items: CpFaseFItemInput[],
): Promise<CpFaseFItem[]> {
  const response = await fetch(`${API_URL}/master-data/cp-fase-f/concentrations/${concentrationCode}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    await parseError(response);
  }

  clearClientGetCache(`${API_URL}/master-data/cp-fase-f`);
  const payload = unwrapEnvelope<{ items: CpFaseFItem[] }>(await response.json());
  return payload.items;
}

export interface InterviewPerComponentAnswer {
  score: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

export type InterviewAnswersPayload = Record<string, 1 | 2 | 3 | 4 | 5 | InterviewPerComponentAnswer>;

export interface WorkspaceInterviewAssessmentRecord {
  assignmentKey: string;
  schoolNpsn: string;
  schoolName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  answers: InterviewAnswersPayload;
  totalScore: number;
  recommendation: string;
  note: string;
  updatedAt: string;
}

export interface WorkspaceBimtekReviewRecord {
  schoolNpsn: string;
  schoolName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  statuses: Record<"survey" | "rpkp" | "rab", "pending" | "revisi" | "approved">;
  notes: Record<"survey" | "rpkp" | "rab", string>;
  fasilAlatComment?: string | null;
  fasilAdminComment?: string | null;
  updatedAt: string;
}

export type PrintTemplateKind =
  | "IDENTITAS"
  | "ADMINISTRASI"
  | "SURVEY_HARGA"
  | "RPKP"
  | "RAB"
  | "RPD"
  | "PKS";

export interface MasterTemplateRow {
  id: string;
  kind: PrintTemplateKind;
  version_label: string;
  tahun_ajaran: string;
  is_active: number;
  title: string;
  body_html: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolInstanceRow {
  id: string;
  school_npsn: string;
  school_name: string;
  module_context: "pra-bimtek" | "bimbingan-teknis";
  kind: PrintTemplateKind;
  template_id: string | null;
  body_html: string;
  review_notes: string | null;
  review_status: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertMasterTemplateRequest {
  id?: string;
  kind: PrintTemplateKind;
  version_label?: string;
  tahun_ajaran?: string;
  is_active?: boolean | number;
  title: string;
  body_html: string;
  notes?: string | null;
}

export interface UpsertSchoolInstanceRequest {
  id?: string;
  school_npsn: string;
  school_name?: string;
  module_context: "pra-bimtek" | "bimbingan-teknis";
  kind: PrintTemplateKind;
  template_id?: string | null;
  body_html: string;
  review_notes?: string | null;
  review_status?: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";
}

export interface WorkspaceVerifikasiOnlineRecord {
  schoolNpsn: string;
  schoolName: string;
  reviewNoteAdmin: string | null;
  reviewNoteEquipment: string | null;
  approvedAdmin: boolean | null;
  approvedEquipment: boolean | null;
  reviewedAdminId: string | null;
  reviewedAdminName: string | null;
  reviewedAdminAt: string | null;
  reviewedAdminEmail: string | null;
  reviewedAdminPhone: string | null;
  reviewedAdminBalai?: string | null;
  reviewedEquipmentId: string | null;
  reviewedEquipmentName: string | null;
  reviewedEquipmentAt: string | null;
  reviewedEquipmentEmail: string | null;
  reviewedEquipmentPhone: string | null;
  reviewedEquipmentBalai?: string | null;
  updatedAt: string;
}

export interface UpsertWorkspaceVerifikasiOnlineRequest {
  schoolNpsn: string;
  schoolName: string;
  reviewerRole: "ADMINISTRASI" | "PERALATAN";
  reviewerId: string;
  reviewerName: string;
  reviewNote?: string | null;
  approved?: boolean | null;
  updatedAt: string;
}

export interface WorkspaceAssignmentRecord {
  key: string;
  moduleKey: "wawancara" | "bimbingan-teknis" | "verifikasi-online" | "pra-bimtek";
  moduleLabel: string;
  sourceTab: "bantuan" | "abt";
  sourceLabel: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  facilitatorAdministrationId: string;
  facilitatorAdministrationName: string;
  facilitatorAdministrationBalai?: string | null;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  facilitatorEquipmentBalai?: string | null;
  interviewScheduledDate: string | null;
  interviewScheduledTime: string | null;
  interviewMeetingLink: string | null;
  praBimtekScheduledDate?: string | null;
  praBimtekScheduledTime?: string | null;
  praBimtekMeetingLink?: string | null;
  praBimtekStatus?: "NOT_SCHEDULED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "CANCELLED" | string | null;
  bimtekScheduledDate?: string | null;
  bimtekLocation?: string | null;
  bimtekStatus?: "NOT_SCHEDULED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | string | null;
  updatedAt: string;
}

export interface WorkspaceSchoolProposalData {
  proposalTables: Record<string, unknown>;
  rpkpSelections: Record<string, unknown>;
  updatedAt: string | null;
  /** Optimistic lock version (dinaikkan setiap write BERHASIL) */
  version?: number;
  /** SHA256 integrity checksum dari backend untuk verifikasi K17 client-side */
  integritySha?: string;
}

export interface WorkspaceSchoolEquipmentData {
  equipmentTables: Record<string, unknown>;
  updatedAt: string | null;
  /** Optimistic lock version (dinaikkan setiap write BERHASIL) */
  version?: number;
  /** SHA256 integrity checksum dari backend untuk verifikasi K17 client-side */
  integritySha?: string;
}

export interface PerdirjenEquipmentPdfPageMapItem {
  kode: string;
  bidangCode: string;
  bidangKeahlian: string;
  programCode: string;
  programKeahlian: string;
  konsentrasiKeahlian: string;
  startPage: number;
  endPage: number;
}

export type PerdirjenEquipmentPdfPageMap = Record<string, PerdirjenEquipmentPdfPageMapItem>;

export interface WorkspaceAdminSelectionData {
  regulerRows: Array<Record<string, unknown>>;
  abtRows: Array<Record<string, unknown>>;
  interviewResults: WorkspaceInterviewAssessmentRecord[];
  bimtekReviews: WorkspaceBimtekReviewRecord[];
  verifikasiOnlineReviews: WorkspaceVerifikasiOnlineRecord[];
  proposalBundles: Record<string, WorkspaceSchoolProposalData>;
  equipmentBundles: Record<string, WorkspaceSchoolEquipmentData>;
}

function buildAuthHeaders(token: string, contentType = false) {
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

export async function workspaceAdminSelectionRequest(
  token: string,
  params?: {
    datasetKey?: "REGULER" | "ABT" | "ALL";
    scope?: "full" | "light";
    schoolNpsn?: string;
    signal?: AbortSignal;
  },
): Promise<WorkspaceAdminSelectionData> {
  const qs = new URLSearchParams();
  if (params?.datasetKey === "REGULER" || params?.datasetKey === "ABT") {
    qs.set("datasetKey", params.datasetKey);
  }
  if (params?.scope === "light") {
    qs.set("scope", "light");
  }
  if (params?.schoolNpsn?.trim()) {
    qs.set("schoolNpsn", params.schoolNpsn.trim());
  }
  const url = `${API_URL}/workspace-data/admin/selection${qs.size ? `?${qs.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
    signal: params?.signal,
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<WorkspaceAdminSelectionData>(await response.json());
}

export interface PaguAnggaranRow {
  no: number;
  provinsi: string;
  npsn: string;
  nama_sekolah: string;
  pagu_persiapan: number;
  pagu_alat: number;
  pagu_pelatihan: number;
  pagu_total: number;
  status: string;
  tahun_ajaran: string;
}

export interface PaguAnggaranListResponse {
  ok: boolean;
  tahunAjaran: string;
  count: number;
  rows: PaguAnggaranRow[];
}

export async function paguAnggaranListRequest(
  token: string,
  params?: { tahunAjaran?: string; signal?: AbortSignal },
): Promise<PaguAnggaranListResponse> {
  const qs = new URLSearchParams();
  if (params?.tahunAjaran?.trim()) {
    qs.set("tahunAjaran", params.tahunAjaran.trim());
  }
  const url = `${API_URL}/workspace-data/admin/pagu-anggaran/list${qs.size ? `?${qs.toString()}` : ""}`;
  clearClientGetCache(url);
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
    signal: params?.signal,
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<PaguAnggaranListResponse>(await response.json());
}

export interface PaguAnggaranPatchRowRequest {
  schoolNpsn: string;
  tahunAjaran?: string;
  paguPersiapan: number;
  paguAlat: number;
  paguPelatihan: number;
  status?: "DRAFT" | "DITETAPKAN" | "LOCKED" | "DIPERPBAHARUI";
}

export async function paguAnggaranPatchRowRequest(
  token: string,
  body: PaguAnggaranPatchRowRequest,
): Promise<{ ok: boolean; savedAt: string; paguTotal: number }> {
  const response = await fetch(`${API_URL}/workspace-data/admin/pagu-anggaran/row`, {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<{ ok: boolean; savedAt: string; paguTotal: number }>(await response.json());
}

export interface PaguAnggaranUploadExcelResponse {
  ok: boolean;
  tahunAjaran: string;
  totalRows: number;
  summary: {
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; npsn?: string; message: string }>;
  };
}

export async function paguAnggaranUploadExcelRequest(
  token: string,
  file: File,
  params?: { tahunAjaran?: string },
): Promise<PaguAnggaranUploadExcelResponse> {
  const qs = new URLSearchParams();
  if (params?.tahunAjaran?.trim()) {
    qs.set("tahunAjaran", params.tahunAjaran.trim());
  }
  const url = `${API_URL}/workspace-data/admin/pagu-anggaran/upload-excel${qs.size ? `?${qs.toString()}` : ""}`;
  const fd = new FormData();
  fd.append("file", file);
  const response = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders(token, false),
    body: fd,
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<PaguAnggaranUploadExcelResponse>(await response.json());
}

// ===== ADMIN: KONSENTRASI REKOMENDASI (Top 5 row_order 1-5, Master 128 Options) =====
export interface KonsentrasiOption {
  code: string;
  name: string;
}

export interface KonsentrasiRekomendasiRow {
  no: number;
  provinsi: string;
  npsn: string;
  nama_sekolah: string;
  konsentrasi_1: KonsentrasiOption | null;
  konsentrasi_2: KonsentrasiOption | null;
  konsentrasi_3: KonsentrasiOption | null;
  konsentrasi_4: KonsentrasiOption | null;
  konsentrasi_5: KonsentrasiOption | null;
}

interface KonsentrasiMasterOptionsResponse {
  ok: boolean;
  count: number;
  rows: KonsentrasiOption[];
}

interface KonsentrasiRekomendasiListResponse {
  ok: boolean;
  count: number;
  rows: KonsentrasiRekomendasiRow[];
}

interface KonsentrasiRekomendasiPatchRowResponse {
  ok: boolean;
  npsn: string;
  savedAt: string;
  savedRows: Array<{ id: string; row_order: number; code: string; name: string }>;
}

interface KonsentrasiRekomendasiUploadExcelResponse {
  ok: boolean;
  summary: { inserted: number; updated: number; skipped: number; errors: Array<{ row: number; npsn?: string; message: string }> };
  totalRows: number;
}

export async function konsentrasiMasterOptionsRequest(token: string): Promise<KonsentrasiMasterOptionsResponse> {
  const url = `${API_URL}/workspace-data/admin/konsentrasi-rekomendasi/master-options`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<KonsentrasiMasterOptionsResponse>(await response.json());
}

export async function konsentrasiRekomendasiListRequest(token: string): Promise<KonsentrasiRekomendasiListResponse> {
  const url = `${API_URL}/workspace-data/admin/konsentrasi-rekomendasi/list`;
  clearClientGetCache(url);
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<KonsentrasiRekomendasiListResponse>(await response.json());
}

export async function konsentrasiRekomendasiPatchRowRequest(
  token: string,
  payload: {
    schoolNpsn: string;
    konsentrasi1Code: string;
    konsentrasi2Code: string;
    konsentrasi3Code: string;
    konsentrasi4Code: string;
    konsentrasi5Code: string;
  },
): Promise<KonsentrasiRekomendasiPatchRowResponse> {
  const url = `${API_URL}/workspace-data/admin/konsentrasi-rekomendasi/row`;
  clearClientGetCache(`${API_URL}/workspace-data/admin/konsentrasi-rekomendasi/list`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<KonsentrasiRekomendasiPatchRowResponse>(await response.json());
}

export async function konsentrasiRekomendasiUploadExcelRequest(
  token: string,
  file: File,
): Promise<KonsentrasiRekomendasiUploadExcelResponse> {
  const url = `${API_URL}/workspace-data/admin/konsentrasi-rekomendasi/upload-excel`;
  clearClientGetCache(`${API_URL}/workspace-data/admin/konsentrasi-rekomendasi/list`);
  const fd = new FormData();
  fd.append("file", file);
  const response = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders(token, false),
    body: fd,
  });
  if (!response.ok) {
    await parseError(response);
  }
  return unwrapEnvelope<KonsentrasiRekomendasiUploadExcelResponse>(await response.json());
}

export interface WorkspaceUpdateDatasetRowRequest {
  datasetKey: "REGULER" | "ABT";
  schoolNpsn: string;
  schoolNo?: number;
  schoolName?: string;
  province?: string;
  city?: string;
  district?: string;
  note?: string | null;
  isSelected?: boolean | null;
  rawPayloadPatch?: Record<string, unknown>;
}

export async function workspaceUpdateDatasetRowRequest(
  token: string,
  body: WorkspaceUpdateDatasetRowRequest,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${API_URL}/workspace-data/admin/dataset-row`, {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await parseError(response);
  }

  const result = unwrapEnvelope<unknown>(await response.json());
  return (result ?? null) as Record<string, unknown> | null;
}

export interface WorkspaceInsertDatasetRowRequest {
  datasetKey: "REGULER" | "ABT";
  schoolNpsn: string;
  schoolNo?: number;
  schoolName: string;
  province: string;
  city: string;
  district?: string;
  note?: string | null;
  isSelected?: boolean | null;
  rawPayload?: Record<string, unknown>;
}

export async function workspaceInsertDatasetRowRequest(
  token: string,
  body: WorkspaceInsertDatasetRowRequest,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${API_URL}/workspace-data/admin/dataset-row`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await parseError(response);
  }

  const result = unwrapEnvelope<unknown>(await response.json());
  return (result ?? null) as Record<string, unknown> | null;
}

export async function workspaceDeleteDatasetRowRequest(
  token: string,
  params: { datasetKey: "REGULER" | "ABT"; schoolNpsn: string },
): Promise<boolean> {
  const qs = new URLSearchParams();
  qs.set("datasetKey", params.datasetKey);
  qs.set("schoolNpsn", String(params.schoolNpsn ?? "").trim());
  const response = await fetch(`${API_URL}/workspace-data/admin/dataset-row?${qs.toString()}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    await parseError(response);
  }

  const result = unwrapEnvelope<unknown>(await response.json());
  return Boolean(result);
}

export async function workspaceAssignmentSourceRequest(
  token: string,
  sourceTab: "bantuan" | "abt",
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${API_URL}/workspace-data/admin/source-schools?sourceTab=${sourceTab}`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<Array<Record<string, unknown>>>(await response.json());
}

export async function workspaceAssignmentsRequest(
  token: string,
  params?: {
    moduleKey?: "wawancara" | "bimbingan-teknis" | "verifikasi-online" | "pra-bimtek";
    facilitatorEquipmentId?: string;
    facilitatorEquipmentName?: string;
    facilitatorAdministrationId?: string;
    facilitatorAdministrationName?: string;
    schoolNpsn?: string;
  },
): Promise<WorkspaceAssignmentRecord[]> {
  const search = new URLSearchParams();
  if (params?.moduleKey) search.set("moduleKey", params.moduleKey);
  if (params?.facilitatorEquipmentId) search.set("facilitatorEquipmentId", params.facilitatorEquipmentId);
  if (params?.facilitatorEquipmentName) search.set("facilitatorEquipmentName", params.facilitatorEquipmentName);
  if (params?.facilitatorAdministrationId) search.set("facilitatorAdministrationId", params.facilitatorAdministrationId);
  if (params?.facilitatorAdministrationName) search.set("facilitatorAdministrationName", params.facilitatorAdministrationName);
  if (params?.schoolNpsn) search.set("schoolNpsn", params.schoolNpsn);

  const response = await fetch(`${API_URL}/workspace-data/assignments${search.size ? `?${search.toString()}` : ""}`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<WorkspaceAssignmentRecord[]>(await response.json());
}

export async function upsertWorkspaceAssignmentsRequest(token: string, records: WorkspaceAssignmentRecord[]) {
  const response = await fetch(`${API_URL}/workspace-data/assignments/bulk`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ records }),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<{ success: boolean }>(await response.json());
}

export async function updateAssignmentInterviewScheduleRequest(
  token: string,
  payload: {
    moduleKey: "wawancara" | "bimbingan-teknis" | "verifikasi-online" | "pra-bimtek";
    sourceTab: "bantuan" | "abt";
    schoolNpsn: string;
    interviewScheduledDate: string | null;
    interviewScheduledTime: string | null;
    interviewMeetingLink: string | null;
    updatedAt: string;
  },
) {
  const response = await fetch(`${API_URL}/workspace-data/assignments/interview-schedule`, {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<{ success: boolean }>(await response.json());
}

export async function workspaceInterviewAssessmentsRequest(token: string): Promise<WorkspaceInterviewAssessmentRecord[]> {
  const response = await fetch(`${API_URL}/workspace-data/interviews`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<WorkspaceInterviewAssessmentRecord[]>(await response.json());
}

export async function upsertWorkspaceInterviewAssessmentRequest(
  token: string,
  payload: WorkspaceInterviewAssessmentRecord,
) {
  const response = await fetch(`${API_URL}/workspace-data/interviews`, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<{ success: boolean }>(await response.json());
}

export async function workspaceBimtekReviewsRequest(token: string): Promise<WorkspaceBimtekReviewRecord[]> {
  const response = await fetch(`${API_URL}/workspace-data/bimtek-reviews`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<WorkspaceBimtekReviewRecord[]>(await response.json());
}

export async function workspaceSchoolProposalsBySchoolIdsRequest(
  token: string,
  schoolIds: string[],
): Promise<Record<string, WorkspaceSchoolProposalData>> {
  const normalizedIds = Array.from(new Set(schoolIds.map((value) => value.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return {};
  }

  const search = new URLSearchParams();
  search.set("ids", normalizedIds.join(","));

  const response = await fetch(`${API_URL}/workspace-data/school-proposals/by-school-ids?${search.toString()}`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<Record<string, WorkspaceSchoolProposalData>>(await response.json());
}

export async function upsertWorkspaceBimtekReviewRequest(token: string, payload: WorkspaceBimtekReviewRecord) {
  const response = await fetch(`${API_URL}/workspace-data/bimtek-reviews`, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<{ success: boolean }>(await response.json());
}

export async function workspaceVerifikasiOnlineReviewsRequest(
  token: string,
  params?: { schoolNpsn?: string },
): Promise<WorkspaceVerifikasiOnlineRecord[]> {
  const search = new URLSearchParams();
  if (params?.schoolNpsn) search.set("schoolNpsn", params.schoolNpsn);
  const response = await fetch(
    `${API_URL}/workspace-data/verifikasi-online/reviews${search.size ? `?${search.toString()}` : ""}`,
    {
      headers: buildAuthHeaders(token),
    },
  );

  if (!response.ok) {
    await parseError(response);
  }

  return unwrapEnvelope<WorkspaceVerifikasiOnlineRecord[]>(await response.json());
}

export async function upsertWorkspaceVerifikasiOnlineReviewRequest(
  token: string,
  payload: UpsertWorkspaceVerifikasiOnlineRequest,
): Promise<WorkspaceVerifikasiOnlineRecord | null> {
  const response = await fetch(`${API_URL}/workspace-data/verifikasi-online/reviews`, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  const result = unwrapEnvelope<unknown>(await response.json());
  return (result ?? null) as WorkspaceVerifikasiOnlineRecord | null;
}

// ====== GOOGLE DRIVE INTEGRATION - RPD / PKS Editor ======

export type GoogleDriveRpdPksKind = "RPD" | "PKS";

export interface GoogleDriveRpdPksDocumentRow {
  id: string;
  npsn: string;
  kind: GoogleDriveRpdPksKind;
  google_doc_id: string | null;
  template_doc_id: string | null;
  title: string;
  doc_url: string | null;
  embed_url: string | null;
  status: "CREATING" | "READY" | "FAILED" | "EXPORTING";
  last_synced_at: string | null;
  exported_pdf_url: string | null;
  exported_docx_url: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function googleDriveConfigStatusRequest(
  token: string,
): Promise<{
  configured: boolean;
  message: string;
  templates: { rpdTemplateId: string | null; pksTemplateId: string | null };
}> {
  const response = await fetch(`${API_URL}/google-drive/config-status`, {
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{
    configured: boolean;
    message: string;
    templates: { rpdTemplateId: string | null; pksTemplateId: string | null };
  }>(await response.json());
}

export async function googleDriveRpdPksBySchoolRequest(
  token: string,
  npsn: string,
): Promise<{ npsn: string; rows: GoogleDriveRpdPksDocumentRow[] }> {
  const safe = encodeURIComponent(String(npsn || "").trim());
  const response = await fetch(`${API_URL}/google-drive/rpd-pks/by-school/${safe}`, {
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ npsn: string; rows: GoogleDriveRpdPksDocumentRow[] }>(await response.json());
}

export async function googleDriveCreateRpdPksRequest(
  token: string,
  npsn: string,
  kind: GoogleDriveRpdPksKind | "BOTH" = "BOTH",
): Promise<{
  npsn: string;
  result: Record<string, GoogleDriveRpdPksDocumentRow | { error: string }>;
}> {
  const safe = encodeURIComponent(String(npsn || "").trim());
  const response = await fetch(`${API_URL}/google-drive/rpd-pks/create-for-school/${safe}`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ kind }),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{
    npsn: string;
    result: Record<string, GoogleDriveRpdPksDocumentRow | { error: string }>;
  }>(await response.json());
}

export async function googleDriveSharePublicRequest(
  token: string,
  docId: string,
  role: "reader" | "writer" = "writer",
): Promise<{ docId: string; shareUrl: string }> {
  const safe = encodeURIComponent(String(docId || "").trim());
  const response = await fetch(
    `${API_URL}/google-drive/rpd-pks/share-public/${safe}?role=${encodeURIComponent(role)}`,
    { headers: buildAuthHeaders(token) },
  );
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ docId: string; shareUrl: string }>(await response.json());
}

export async function googleDriveLinkExistingDocRequest(
  token: string,
  npsn: string,
  kind: GoogleDriveRpdPksKind,
  docIdOrUrl: string,
): Promise<{
  ok: boolean;
  row: GoogleDriveRpdPksDocumentRow;
  kind: GoogleDriveRpdPksKind;
}> {
  const safe = encodeURIComponent(String(npsn || "").trim());
  const response = await fetch(`${API_URL}/google-drive/rpd-pks/link-existing-for-school/${safe}`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ kind, doc_id_or_url: docIdOrUrl }),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{
    ok: boolean;
    row: GoogleDriveRpdPksDocumentRow;
    kind: GoogleDriveRpdPksKind;
  }>(await response.json());
}

export function googleDriveRpdPksExportUrl(
  token: string,
  docId: string,
  format: "pdf" | "docx" = "pdf",
): string {
  const safeId = encodeURIComponent(String(docId || "").trim());
  const tokenQs = encodeURIComponent(token || "");
  const safeFmt = format === "docx" ? "docx" : "pdf";
  return `${API_URL}/google-drive/rpd-pks/export/${safeId}?format=${safeFmt}&authorization_bearer=${tokenQs}`;
}

// ====== AKHIR GOOGLE DRIVE INTEGRATION ======

// ===== Clean MVC Relational: Proposal Preparation Groups + Items (per halaman data-persiapan)
export type PreparationItemView = { uuid: string; description: string; quantity: number; unitPrice: number };
export type PreparationGroupView = { uuid: string; name: string; items: PreparationItemView[] };
export type PreparationsBundle = { groups: PreparationGroupView[]; updatedAt: string | null };

export async function preparationsRequest(
  token: string,
  schoolNpsn?: string,
): Promise<PreparationsBundle> {
  const qp = new URLSearchParams();
  if (schoolNpsn) qp.set("schoolNpsn", String(schoolNpsn).trim());
  const qs = qp.toString();
  const url = `${API_URL}/workspace-data/school-proposals/preparations${qs ? `?${qs}` : ""}`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<PreparationsBundle>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<PreparationsBundle> | undefined;
  if (inFlight) return inFlight;
  const req = (async () => {
    try {
      const response = await fetch(url, { method: "GET", headers: buildAuthHeaders(token, false) });
      if (!response.ok) await parseError(response);
      const raw = unwrapEnvelope<any>(await response.json());
      const bundle: PreparationsBundle = {
        groups: Array.isArray((raw as any).groups) ? (raw as any).groups : [],
        updatedAt: (raw as any).updatedAt ?? null,
      };
      writeClientGetCache(key, bundle, SHORT_TTL_MS);
      return bundle;
    } finally {
      clientGetInFlight.delete(key);
    }
  })();
  clientGetInFlight.set(key, req);
  return req;
}

export async function savePreparationsRequest(
  token: string,
  payload: { groups: PreparationGroupView[]; schoolNpsn?: string },
): Promise<{
  ok: boolean;
  savedGroupsCount: number;
  savedItemsCount: number;
  updatedAt: string | null;
}> {
  const url = `${API_URL}/workspace-data/school-proposals/preparations`;
  const response = await fetch(url, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({
      groups: Array.isArray(payload.groups) ? payload.groups : [],
      schoolNpsn: payload.schoolNpsn ? String(payload.schoolNpsn).trim() : undefined,
    }),
  });
  if (!response.ok) await parseError(response);
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals/preparations`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals/me`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/preparations|`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/me|`);
  const raw = unwrapEnvelope<any>(await response.json());
  const out = {
    ok: true,
    savedGroupsCount: Number((raw as any)?.savedGroupsCount ?? 0),
    savedItemsCount: Number((raw as any)?.savedItemsCount ?? 0),
    updatedAt: (raw as any)?.updatedAt ?? null,
  };
  if (payload.schoolNpsn) {
    // invalidate admin by school query cache
    clearClientGetCache(
      `${API_URL}/workspace-data/school-proposals/preparations?schoolNpsn=${encodeURIComponent(
        String(payload.schoolNpsn).trim(),
      )}|`,
    );
  }
  return out;
}

// ===== Clean MVC Relational: Proposal Training Costs 1,5% Flat per Alat (per halaman data-pelatihan)
export type TrainingCostView = {
  uuid: string;
  productName: string;
  unitPrice: number;
  requiresTraining: boolean;
  trainingCost: number;
};
export type TrainingCostsBundle = {
  costs: TrainingCostView[];
  totalCost: number;
  updatedAt: string | null;
};

export async function trainingCostsRequest(
  token: string,
  schoolNpsn?: string,
): Promise<TrainingCostsBundle> {
  const qp = new URLSearchParams();
  if (schoolNpsn) qp.set("schoolNpsn", String(schoolNpsn).trim());
  const qs = qp.toString();
  const url = `${API_URL}/workspace-data/school-proposals/training-costs${qs ? `?${qs}` : ""}`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<TrainingCostsBundle>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<TrainingCostsBundle> | undefined;
  if (inFlight) return inFlight;
  const req = (async () => {
    try {
      const response = await fetch(url, { method: "GET", headers: buildAuthHeaders(token, false) });
      if (!response.ok) await parseError(response);
      const raw = unwrapEnvelope<any>(await response.json());
      const bundle: TrainingCostsBundle = {
        costs: Array.isArray((raw as any).costs) ? (raw as any).costs : [],
        totalCost: Number((raw as any).totalCost ?? 0),
        updatedAt: (raw as any).updatedAt ?? null,
      };
      writeClientGetCache(key, bundle, SHORT_TTL_MS);
      return bundle;
    } finally {
      clientGetInFlight.delete(key);
    }
  })();
  clientGetInFlight.set(key, req);
  return req;
}

export async function saveTrainingCostsRequest(
  token: string,
  payload: { costs: TrainingCostView[]; schoolNpsn?: string },
): Promise<{
  ok: boolean;
  savedCostsCount: number;
  totalTrainingCost: number;
  updatedAt: string | null;
}> {
  const url = `${API_URL}/workspace-data/school-proposals/training-costs`;
  const response = await fetch(url, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({
      costs: Array.isArray(payload.costs) ? payload.costs : [],
      schoolNpsn: payload.schoolNpsn ? String(payload.schoolNpsn).trim() : undefined,
    }),
  });
  if (!response.ok) await parseError(response);
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals/training-costs`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals/me`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/training-costs|`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/me|`);
  const raw = unwrapEnvelope<any>(await response.json());
  const out = {
    ok: true,
    savedCostsCount: Number((raw as any)?.savedCostsCount ?? 0),
    totalTrainingCost: Number((raw as any)?.totalTrainingCost ?? 0),
    updatedAt: (raw as any)?.updatedAt ?? null,
  };
  if (payload.schoolNpsn) {
    clearClientGetCache(
      `${API_URL}/workspace-data/school-proposals/training-costs?schoolNpsn=${encodeURIComponent(
        String(payload.schoolNpsn).trim(),
      )}|`,
    );
  }
  return out;
}

export type SchoolPaguDetail = {
  ok: boolean;
  data: {
    npsn: string;
    tahunAjaran: string;
    pagu: { persiapan: number; alat: number; pelatihan: number; total: number };
    realisasi: { persiapan: number; alat: number; pelatihan: number; total: number };
    status: "DRAFT" | "DITETAPKAN" | "LOCKED" | "DIPERPBAHARUI" | string;
    setByAdmin: { id: string | null; name: string | null };
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export async function schoolPaguDetailRequest(
  token: string,
  schoolNpsn?: string,
): Promise<SchoolPaguDetail> {
  const targetNpsnRaw = String(schoolNpsn ?? "").trim();
  const url = targetNpsnRaw
    ? `${API_URL}/workspace-data/school-pagu/${encodeURIComponent(targetNpsnRaw)}`
    : `${API_URL}/workspace-data/school-pagu/me`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<SchoolPaguDetail>(key);
  if (cached !== null) return cached;
  try {
    const response = await fetch(url, { method: "GET", headers: buildAuthHeaders(token, false) });
    if (!response.ok) await parseError(response);
    const payload = unwrapEnvelope<SchoolPaguDetail>(await response.json());
    writeClientGetCache(key, payload, SHORT_TTL_MS);
    return payload;
  } catch (err: any) {
    if (err && err.name === "AbortError") {
      try {
        const response2 = await fetch(url, { method: "GET", headers: buildAuthHeaders(token, false) });
        if (!response2.ok) await parseError(response2);
        const payload2 = unwrapEnvelope<SchoolPaguDetail>(await response2.json());
        writeClientGetCache(key, payload2, SHORT_TTL_MS);
        return payload2;
      } catch (err2) {
        throw err2;
      }
    }
    throw err;
  }
}

export async function schoolProposalDataRequest(token: string): Promise<WorkspaceSchoolProposalData> {
  const url = `${API_URL}/workspace-data/school-proposals/me`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<WorkspaceSchoolProposalData>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<WorkspaceSchoolProposalData> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, { headers: buildAuthHeaders(token) })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<WorkspaceSchoolProposalData>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function schoolProposalDataByNpsnRequest(
  token: string,
  npsn: string,
): Promise<WorkspaceSchoolProposalData> {
  const safeNpsn = encodeURIComponent(String(npsn || "").trim());
  const url = `${API_URL}/workspace-data/school-proposals/by-npsn/${safeNpsn}`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<WorkspaceSchoolProposalData>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<WorkspaceSchoolProposalData> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, { headers: buildAuthHeaders(token) })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<WorkspaceSchoolProposalData>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function saveSchoolProposalDataRequest(
  token: string,
  payload: { proposalTables: Record<string, unknown>; rpkpSelections: Record<string, unknown>; rpkpGrandTotalRp?: number | null },
): Promise<WorkspaceSchoolProposalData> {
  const safeRpkpTotal =
    typeof payload.rpkpGrandTotalRp === "number" && Number.isFinite(payload.rpkpGrandTotalRp)
      ? Math.max(0, Math.floor(payload.rpkpGrandTotalRp))
      : null;
  const bodyObj: Record<string, unknown> = {
    proposalTables: payload.proposalTables,
    rpkpSelections: payload.rpkpSelections,
  };
  if (safeRpkpTotal !== null) bodyObj.rpkpGrandTotalRp = safeRpkpTotal;
  const response = await fetch(`${API_URL}/workspace-data/school-proposals/me`, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(bodyObj),
  });

  if (!response.ok) {
    await parseError(response);
  }

  // V5: invalidate SELURUH cache base school-proposals (ALL by-npsn + me) + legacy fallback
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`); // summary dashboard juga harus fresh
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/me|`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/by-npsn/|`);
  const result = unwrapEnvelope<WorkspaceSchoolProposalData>(await response.json());
  // WRITE BACK agar GET berikutnya IMMEDIATE tanpa request network
  const key = scopedCacheKey(token, `${API_URL}/workspace-data/school-proposals/me`);
  writeClientGetCache(key, result, SHORT_TTL_MS);
  return result;
}

export async function saveSchoolProposalDataRequestRaw(
  token: string,
  serializedBody: string,
): Promise<WorkspaceSchoolProposalData> {
  const response = await fetch(`${API_URL}/workspace-data/school-proposals/me`, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: serializedBody,
  });

  if (!response.ok) {
    await parseError(response);
  }

  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/me|`);
  clearClientGetCache(`${API_URL}/workspace-data/school-proposals/by-npsn/|`);
  const result = unwrapEnvelope<WorkspaceSchoolProposalData>(await response.json());
  const key = scopedCacheKey(token, `${API_URL}/workspace-data/school-proposals/me`);
  writeClientGetCache(key, result, SHORT_TTL_MS);
  return result;
}

export async function schoolEquipmentDataRequest(token: string): Promise<WorkspaceSchoolEquipmentData> {
  const url = `${API_URL}/workspace-data/school-equipment/me`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<WorkspaceSchoolEquipmentData>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<WorkspaceSchoolEquipmentData> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, { headers: buildAuthHeaders(token) })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<WorkspaceSchoolEquipmentData>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function schoolEquipmentDataByNpsnRequest(
  token: string,
  npsn: string,
): Promise<WorkspaceSchoolEquipmentData> {
  const safeNpsn = encodeURIComponent(String(npsn || "").trim());
  const url = `${API_URL}/workspace-data/school-equipment/by-npsn/${safeNpsn}`;
  const key = scopedCacheKey(token, url);
  const cached = readClientGetCache<WorkspaceSchoolEquipmentData>(key);
  if (cached !== null) return cached;
  const inFlight = clientGetInFlight.get(key) as Promise<WorkspaceSchoolEquipmentData> | undefined;
  if (inFlight) return inFlight;

  const request = fetch(url, { headers: buildAuthHeaders(token) })
    .then(async (response) => {
      if (!response.ok) await parseError(response);
      const payload = unwrapEnvelope<WorkspaceSchoolEquipmentData>(await response.json());
      writeClientGetCache(key, payload, SHORT_TTL_MS);
      return payload;
    })
    .finally(() => clientGetInFlight.delete(key));

  clientGetInFlight.set(key, request);
  return request;
}

export async function saveSchoolEquipmentDataRequest(
  token: string,
  payload: { equipmentTables: Record<string, unknown> },
): Promise<WorkspaceSchoolEquipmentData> {
  const response = await fetch(`${API_URL}/workspace-data/school-equipment/me`, {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  // V5: invalidate SELURUH base school-equipment + dashboard summary
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-equipment`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
  clearClientGetCache(`${API_URL}/workspace-data/school-equipment/me|`);
  clearClientGetCache(`${API_URL}/workspace-data/school-equipment/by-npsn/|`);
  const result = unwrapEnvelope<WorkspaceSchoolEquipmentData>(await response.json());
  const key = scopedCacheKey(token, `${API_URL}/workspace-data/school-equipment/me`);
  writeClientGetCache(key, result, SHORT_TTL_MS);
  return result;
}

// ============================================================================
// PARTIAL PATCH (T3.1 — fix K3: Ubah 1 baris, kirim HANYA key berubah, BUKAN 30MB)
// ============================================================================
/** Kembalikan: keys yang BERUBAH (top-level comparison) — untuk payload kecil */
export interface TopLevelPatchDiff<T extends Record<string, unknown>> {
  changedKeys: Partial<T>;
  deletedKeys: string[];
  /** byte size sebelum */
  beforeBytes: number;
  /** byte size patch yang akan dikirim (hanya changed + deleted) */
  patchBytes: number;
  /** ratio patch / original; < 0.15 → worth it pakai PATCH */
  patchRatio: number;
}

function jsonBytes(v: unknown): number {
  try {
    return typeof Blob !== "undefined" ? new Blob([JSON.stringify(v)]).size : JSON.stringify(v).length;
  } catch {
    return 0;
  }
}

export function computeTopLevelPatchDiff<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): TopLevelPatchDiff<T> {
  const safeBefore: Record<string, unknown> = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const safeAfter: Record<string, unknown> = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const changed: Record<string, unknown> = {};
  const deleted: string[] = [];
  const keysBefore = Object.keys(safeBefore);
  const keysAfter = Object.keys(safeAfter);
  for (const k of keysAfter) {
    const a = safeAfter[k];
    const b = safeBefore[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed[k] = a;
    }
  }
  for (const k of keysBefore) {
    if (!(k in safeAfter)) deleted.push(k);
  }
  const beforeBytes = jsonBytes(safeBefore);
  const patchBytes = jsonBytes({ changed, deleted });
  return {
    changedKeys: changed as Partial<T>,
    deletedKeys: deleted,
    beforeBytes,
    patchBytes,
    patchRatio: beforeBytes > 0 ? patchBytes / beforeBytes : 1,
  };
}

export interface SchoolProposalPatchRequest {
  changedProposalKeys?: Record<string, unknown>;
  changedRpkpKeys?: Record<string, unknown>;
  deletedProposalKeys?: string[];
  deletedRpkpKeys?: string[];
  /** optimistic lock: di-reject jika version tidak match */
  expectedVersion?: number;
}

export interface SchoolEquipmentPatchRequest {
  changedKeys?: Record<string, unknown>;
  deletedKeys?: string[];
  expectedVersion?: number;
}

/** PATCH proposal: kirim HANYA top-level key berubah. Lebih kecil 20-95% bytes. */
export async function patchSchoolProposalDataRequest(
  token: string,
  payload: SchoolProposalPatchRequest,
): Promise<WorkspaceSchoolProposalData> {
  const response = await fetch(`${API_URL}/workspace-data/school-proposals/me/delta`, {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) await parseError(response);
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
  const result = (await response.json()) as WorkspaceSchoolProposalData;
  const key = scopedCacheKey(token, `${API_URL}/workspace-data/school-proposals/me`);
  writeClientGetCache(key, result, SHORT_TTL_MS);
  return result;
}

/** PATCH equipment: kirim HANYA top-level key berubah. Lebih kecil 20-95% bytes. */
export async function patchSchoolEquipmentDataRequest(
  token: string,
  payload: SchoolEquipmentPatchRequest,
): Promise<WorkspaceSchoolEquipmentData> {
  const response = await fetch(`${API_URL}/workspace-data/school-equipment/me/delta`, {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) await parseError(response);
  invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-equipment`);
  invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
  const result = (await response.json()) as WorkspaceSchoolEquipmentData;
  const key = scopedCacheKey(token, `${API_URL}/workspace-data/school-equipment/me`);
  writeClientGetCache(key, result, SHORT_TTL_MS);
  return result;
}

export async function templateListRequest(
  token: string,
  kind?: PrintTemplateKind,
): Promise<{ ok: boolean; rows: MasterTemplateRow[] }> {
  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  const url = `${API_URL}/workspace-data/master-templates${qs.size ? `?${qs.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; rows: MasterTemplateRow[] }>(await response.json());
}

export async function templateActiveRequest(
  token: string,
  kind: PrintTemplateKind,
): Promise<{ ok: boolean; row: MasterTemplateRow | null }> {
  const url = `${API_URL}/workspace-data/master-templates/active?kind=${encodeURIComponent(kind)}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; row: MasterTemplateRow | null }>(await response.json());
}

export async function templateUpsertRequest(
  token: string,
  body: UpsertMasterTemplateRequest,
): Promise<{ ok: boolean; row: MasterTemplateRow | null }> {
  const response = await fetch(`${API_URL}/workspace-data/master-templates`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(body),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; row: MasterTemplateRow | null }>(await response.json());
}

export async function templateSetActiveRequest(
  token: string,
  id: string,
  kind: PrintTemplateKind,
): Promise<{ ok: boolean; success: boolean }> {
  const safeId = encodeURIComponent(String(id || "").trim());
  const response = await fetch(`${API_URL}/workspace-data/master-templates/${safeId}/set-active`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ kind }),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; success: boolean }>(await response.json());
}

export async function templateDeleteRequest(
  token: string,
  id: string,
): Promise<{ ok: boolean; success: boolean }> {
  const safeId = encodeURIComponent(String(id || "").trim());
  const response = await fetch(`${API_URL}/workspace-data/master-templates/${safeId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; success: boolean }>(await response.json());
}

export async function schoolInstanceGetRequest(
  token: string,
  params: { schoolNpsn: string; moduleContext: "pra-bimtek" | "bimbingan-teknis"; kind: PrintTemplateKind },
): Promise<{ ok: boolean; row: SchoolInstanceRow | null }> {
  const qs = new URLSearchParams();
  qs.set("schoolNpsn", String(params.schoolNpsn || "").trim());
  qs.set("moduleContext", params.moduleContext);
  qs.set("kind", params.kind);
  const url = `${API_URL}/workspace-data/school-instance?${qs.toString()}`;
  const response = await fetch(url, {
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; row: SchoolInstanceRow | null }>(await response.json());
}

export async function schoolInstanceUpsertRequest(
  token: string,
  body: UpsertSchoolInstanceRequest,
): Promise<{ ok: boolean; row: SchoolInstanceRow | null }> {
  const response = await fetch(`${API_URL}/workspace-data/school-instance/upsert`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(body),
  });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<{ ok: boolean; row: SchoolInstanceRow | null }>(await response.json());
}

export interface AdminRpkpReportMeta {
  generatedAt: string;
  sekolahTotal: number;
  sekolahDenganProposal: number;
  sekolahDenganRpkp: number;
  sekolahBelumAdaRpkp: number;
  totalItemRpkpPilihan: number;
  totalNilaiRpkpRp: number;
}

export interface AdminRpkpPerSchoolRow {
  schoolId: string;
  schoolNpsn: string;
  schoolName: string;
  totalItems: number;
  totalNilai: number;
  konsentrasiCount: number;
}

export interface AdminRpkpItemRow {
  schoolId: string;
  schoolNpsn: string;
  schoolName: string;
  concentrationCode: string;
  concentrationName: string;
  itemRowId: string;
  itemName: string;
  specification: string;
  conformity: string;
  quantity: string;
  unit: string;
  selectedShop: "shop1" | "shop2" | "shop3" | string;
  selectedShopLabel: string;
  selectedShopName: string;
  selectedPriceWithTaxRp: number;
  selectedShippingCostRp: number;
  selectedInstallationCostRp: number;
  selectedSatuanTotalRp: number;
  selectedLineTotalRp: number;
  selectedShopLink: string;
  dataUpdatedAt: string | null;
}

export interface AdminRpkpReportResponse {
  meta: AdminRpkpReportMeta;
  perSchool: AdminRpkpPerSchoolRow[];
  items: AdminRpkpItemRow[];
}

export async function adminRpkpReportRequest(
  token: string,
  params?: { schoolNpsn?: string },
): Promise<AdminRpkpReportResponse> {
  const qs = new URLSearchParams();
  if (params?.schoolNpsn) qs.set("schoolNpsn", String(params.schoolNpsn).trim());
  const url = `${API_URL}/workspace-data/admin/report/rpkp${qs.size ? `?${qs.toString()}` : ""}`;
  const response = await fetch(url, { headers: buildAuthHeaders(token) });
  if (!response.ok) await parseError(response);
  return unwrapEnvelope<AdminRpkpReportResponse>(await response.json());
}
