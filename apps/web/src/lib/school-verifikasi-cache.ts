/**
 * Shared client cache untuk Record Verifikasi Online per NPSN.
 * TTL 45 detik — cukup untuk user berpindah-pindah tab / halaman sekolah tanpa refetch DB.
 *
 * Aturan:
 *  - Halaman SEKOLAH SELALU request dengan param {schoolNpsn: profile.npsn}  -> hanya 1 row, ringan
 *  - Menu ADMIN LAPORAN bisa request tanpa param -> global list semua sekolah
 *  - Setelah upsert sukses: write-through cache + invalidate (tidak perlu refetch untuk tampilan sekolah)
 *
 * 100% data dari Database via API /workspace-data/verifikasi-online/reviews
 * — TIDAK PERNAH scraping / membaca file JSON statis.
 *
 * ⚡ REALTIME SYNC (v4.3):
 *   - Cache Detail Pra-Bimtek TTL DIPERCEPAT dari 24 JAM → 30 DETIK
 *     Karena data SURVEY/RPKP/RAB sekolah sering di-update (auto-save 600ms debounce).
 *   - Tambah CROSS-TAB BROADCAST via `localStorage` event "storage"
 *     Saat UI SEKOLAH save sukses → broadcast token "pra-bimtek-saved:{npsn}:{ts}"
 *     → UI FASILITATOR di tab lain otomatis invalidasi cache DETAIL untuk NPSN itu SEGERA.
 *   - Polling fallback 45 detik di detail page (jika broadcast event tidak sampai — ex: same-tab).
 */
import {
  type PerdirjenEquipmentSummary,
  type WorkspaceAdminSelectionData,
  type WorkspaceVerifikasiOnlineRecord,
  perdirjenEquipmentBidangRequest,
  workspaceAdminSelectionRequest,
  workspaceVerifikasiOnlineReviewsRequest,
} from "./api";

const CACHE_TTL_MS = 45_000;
type CacheEntry = { ts: number; data: WorkspaceVerifikasiOnlineRecord[] };

const NPSN_CACHE = new Map<string, CacheEntry>();
let GLOBAL_CACHE: { ts: number; data: WorkspaceVerifikasiOnlineRecord[] } | null = null;

// ⚡ v4.3: TTL DIPERCEPAT untuk data REAL-TIME SYNC
// Data Proposal sekolah (survey/rpkp/rab) DIUBAH SERING → TTL 30 DETIK (bukan 24 jam!)
const DETAIL_CACHE_TTL_MS = 30_000;
// Master Data Perdirjen TETAP 7 hari (perubahan sangat lambat)
const PERDIRJEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type WorkspaceDetailFullBundle = WorkspaceAdminSelectionData & { _fetchedAt?: number };
const DETAIL_BY_NPSN_CACHE = new Map<string, { ts: number; data: WorkspaceDetailFullBundle }>();
const PERDIRJEN_BY_BIDANG_CACHE = new Map<string, { ts: number; data: PerdirjenEquipmentSummary }>();
let PERDIRJEN_ALL_CACHE: { ts: number; data: PerdirjenEquipmentSummary[] } | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 CROSS-TAB BROADCAST INVALIDATION (v4.3 Realtime Sync)
// ═══════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "pra-bimtek-cache-broadcast";
const BROADCAST_KIND_DETAIL = "detail-invalidate";
const BROADCAST_KIND_REVIEW = "review-invalidate";

let crossTabListenerInstalled = false;

function installCrossTabListener() {
  if (typeof window === "undefined") return;
  if (crossTabListenerInstalled) return;
  crossTabListenerInstalled = true;
  window.addEventListener("storage", (ev) => {
    if (ev.key !== STORAGE_KEY) return;
    const raw = ev.newValue;
    if (!raw) return;
    try {
      const parts = raw.split(":");
      if (parts.length < 3) return;
      const [kind, npsn, _ts] = [parts[0], parts[1], parts[2]];
      if (!npsn) return;
      if (kind === BROADCAST_KIND_DETAIL) {
        DETAIL_BY_NPSN_CACHE.delete(String(npsn).trim());
      } else if (kind === BROADCAST_KIND_REVIEW) {
        NPSN_CACHE.delete(String(npsn).trim());
        GLOBAL_CACHE = null;
      }
    } catch {
      /* ignore malformed broadcast */
    }
  });
}

export function broadcastPraBimtekSavedForNpsn(npsn: string) {
  const key = String(npsn || "").trim();
  if (!key) return;
  if (typeof window === "undefined") return;
  installCrossTabListener();
  const payload = `${BROADCAST_KIND_DETAIL}:${key}:${Date.now()}`;
  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
    // Also invalidate our own in-memory cache immediately (same-tab case)
    DETAIL_BY_NPSN_CACHE.delete(key);
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function broadcastVerifikasiReviewSavedForNpsn(npsn: string) {
  const key = String(npsn || "").trim();
  if (!key) return;
  if (typeof window === "undefined") return;
  installCrossTabListener();
  const payload = `${BROADCAST_KIND_REVIEW}:${key}:${Date.now()}`;
  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
    NPSN_CACHE.delete(key);
    GLOBAL_CACHE = null;
  } catch {
    /* ignore */
  }
}

export function invalidateVerifikasiReviewCache(npsn?: string) {
  installCrossTabListener();
  if (npsn) NPSN_CACHE.delete(String(npsn).trim());
  GLOBAL_CACHE = null;
}

export async function fetchCachedVerifikasiReviews(
  token: string,
  params?: { schoolNpsn?: string },
  opts?: { force?: boolean },
): Promise<WorkspaceVerifikasiOnlineRecord[]> {
  const npsnKey = params?.schoolNpsn ? String(params.schoolNpsn).trim() : "";
  const force = opts?.force === true;

  if (npsnKey) {
    if (!force) {
      const cached = NPSN_CACHE.get(npsnKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.data;
      }
    }
    const fresh = await workspaceVerifikasiOnlineReviewsRequest(token, { schoolNpsn: npsnKey });
    NPSN_CACHE.set(npsnKey, { ts: Date.now(), data: fresh });
    return fresh;
  }

  if (!force) {
    if (GLOBAL_CACHE && Date.now() - GLOBAL_CACHE.ts < CACHE_TTL_MS) {
      for (const row of GLOBAL_CACHE.data) {
        if (row?.schoolNpsn && !NPSN_CACHE.has(String(row.schoolNpsn))) {
          NPSN_CACHE.set(String(row.schoolNpsn), { ts: Date.now(), data: [row] });
        }
      }
      return GLOBAL_CACHE.data;
    }
  }
  const fresh = await workspaceVerifikasiOnlineReviewsRequest(token);
  for (const row of fresh) {
    if (row?.schoolNpsn) NPSN_CACHE.set(String(row.schoolNpsn), { ts: Date.now(), data: [row] });
  }
  GLOBAL_CACHE = { ts: Date.now(), data: fresh };
  return fresh;
}

export function writeThroughVerifikasiReviewCache(row: WorkspaceVerifikasiOnlineRecord) {
  if (!row?.schoolNpsn) return;
  const npsnKey = String(row.schoolNpsn).trim();
  NPSN_CACHE.set(npsnKey, { ts: Date.now(), data: [row] });
  GLOBAL_CACHE = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ REALTIME SYNC: Pra-Bimtek / Verifikasi ONLINE DETAIL PER NPSN CACHE
//     - TTL 30 DETIK (v4.3, DAHULU 24 JAM) agar hampir realtime dengan sekolah.
//     - Cross-tab broadcast invalidate via localStorage storage event.
//     - Fallback: polling refresh setiap 45 detik di halaman detail.
// ═══════════════════════════════════════════════════════════════════════════
export function invalidateDetailPraBimtekCache(npsn?: string) {
  installCrossTabListener();
  if (npsn) DETAIL_BY_NPSN_CACHE.delete(String(npsn).trim());
  else DETAIL_BY_NPSN_CACHE.clear();
}

export async function fetchCachedDetailPraBimtekByNpsn(
  token: string,
  npsn: string,
  opts?: { force?: boolean },
): Promise<WorkspaceAdminSelectionData> {
  installCrossTabListener();
  const key = String(npsn).trim();
  const force = opts?.force === true;
  if (!force) {
    const cached = DETAIL_BY_NPSN_CACHE.get(key);
    if (cached && Date.now() - cached.ts < DETAIL_CACHE_TTL_MS) return cached.data;
  }
  const fresh = await workspaceAdminSelectionRequest(token, {
    datasetKey: "ALL",
    scope: "full",
    schoolNpsn: key,
  });
  DETAIL_BY_NPSN_CACHE.set(key, { ts: Date.now(), data: fresh });
  return fresh;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ EXTENSION: Cache MASTER DATA PERDIRJEN EQUIPMENT (bidang x kode) — TTL 7 HARI
//   Bukan N+1 Request = batalkan kode bidang jika sudah pernah di-fetch
// ═══════════════════════════════════════════════════════════════════════════
export async function fetchCachedPerdirjenBidang(
  _token: string,
  kodeBidang: string,
  opts?: { force?: boolean },
): Promise<PerdirjenEquipmentSummary> {
  const key = String(kodeBidang || "").trim();
  const empty: PerdirjenEquipmentSummary = {
    no: key,
    bidang: key,
    totalProgram: 0,
    totalKonsentrasi: 0,
    totalItem: 0,
    program: [],
  };
  if (!key) return empty;
  const force = opts?.force === true;
  if (!force) {
    const cached = PERDIRJEN_BY_BIDANG_CACHE.get(key);
    if (cached && Date.now() - cached.ts < PERDIRJEN_TTL_MS) return cached.data;
  }
  const fresh = await perdirjenEquipmentBidangRequest(kodeBidang);
  PERDIRJEN_BY_BIDANG_CACHE.set(key, { ts: Date.now(), data: fresh });
  if (PERDIRJEN_ALL_CACHE) {
    const idx = PERDIRJEN_ALL_CACHE.data.findIndex((x) => x.no === fresh.no);
    if (idx < 0) PERDIRJEN_ALL_CACHE.data.push(fresh);
    else PERDIRJEN_ALL_CACHE.data[idx] = fresh;
  }
  return fresh;
}

export async function fetchCachedPerdirjenBidangBatch(
  token: string,
  kodeBidangList: string[],
  opts?: { force?: boolean },
): Promise<Record<string, PerdirjenEquipmentSummary>> {
  const force = opts?.force === true;
  const out: Record<string, PerdirjenEquipmentSummary> = {};
  const needFetch: string[] = [];
  for (const k of kodeBidangList) {
    const key = String(k).trim();
    if (!key) continue;
    if (!force) {
      const c = PERDIRJEN_BY_BIDANG_CACHE.get(key);
      if (c && Date.now() - c.ts < PERDIRJEN_TTL_MS) { out[key] = c.data; continue; }
    }
    needFetch.push(key);
  }
  if (needFetch.length === 0) return out;
  // ✅ Batch Promise.all tapi hasil disimpan ke cache per-bidang
  const fetched = await Promise.all(needFetch.map((k) =>
    fetchCachedPerdirjenBidang(token, k, { force })
  ));
  for (const row of fetched) if (row?.no) out[row.no] = row;
  return out;
}

