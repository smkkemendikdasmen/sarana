# 🏗️ SARANASMK — ARCHITECTURE BLUEPRINT v5.0
**Tanggal Audit & Refactor**: 31 Agustus 2026  
**Sasaran**: 4 Halaman sekolah (`/dashboard/sekolah`, `/sekolah/profil`, `/sekolah/alat`, `/sekolah/pengajuan`)  
**Status Dokumen**: 🟢 APPROVED & APPLIED (Hotfix 1-4 + T1-T4)  
**PIC**: Infrastruktur & Rekayasa Data  

---

## 🎯 MANDATORY NON-NEGOTIABLE (DI-HARDCODE / JANGAN DIUBAH SEMBARANGAN)
Sebelum coding apa pun di workspace-data / school-profile, **WAJIB pertahankan**:

1. **Guard `preservePayloadObject`** di `workspace-data.service.ts` — jangan hapus logic ini, mencegah data hilang saat JSON corrupt / partial write.
2. **Guard `hasOwnProperty(payload, 'concentrations')`** di `school-profile.service.ts` method `updateMyProfile` — cegah field konsentrasi terhapus otomatis.
3. **Drastic Shrink Guard**:
   - Backend: `oldBytes > 50KB && newBytes < oldBytes * 0.25` → throw ConflictException.
   - Frontend DraftSizeGuard V2: `draft.size / server.size < 0.20` → TIDAK PERNAH auto-apply, wajib Dialog confirm user.
4. **Optimistic Lock `version` INT column** + `data_sha256 CHAR(64)` — SELALU dikembalikan di setiap response save; client harus simpan dan gunakan saat write berikutnya.
5. **Cache separator `CACHE_V5_SEP = "::"`** (BUKAN `|`), dan SELALU pakai `invalidateScopedCacheByPrefix()` BUKAN `clearClientGetCache(url|)`.

---

## 1. EKSEKUTIF SUMMARY — 20 CRITICAL ISSUES (K1-K20)
Audit 4 lapisan stack (Frontend State, API Backend, DB Schema, Deploy Pipeline) menemukan 20 root causes:

| ID | Kategori | Root Cause | Severity | Fix Method | Status |
|----|----------|------------|----------|------------|--------|
| **K1** | Frontend | localStorage draft blind-restore menimpa data server BESAR tanpa threshold | 🔴 P0 | DraftSizeGuard V2 (ratio < 0.20 → dialog) | ✅ |
| **K2** | Frontend | **Tidak ada Single Source of Truth** lintas 4 pages sekolah → tiap page punya state sendiri | 🔴 P0 | `SchoolWorkspaceProvider` React Context SSOT | ✅ |
| **K3** | Perf | Full payload write (ubah 1 row → kirim 30MB) | 🟠 P1 | Partial PATCH `/me/delta` + `computeTopLevelPatchDiff()` | ✅ |
| **K4** 🔴 | Frontend | Cache invalidation RUSAK: separator mismatch `scopedCacheKey` pakai suffix vs `clearClientGetCache` prefix diakhir `|` → STALE CACHE PERMANEN | 🔴 P0 | `CACHE_V5_SEP = "::"` + `invalidateScopedCacheByPrefix()` 100% match read/write/clear | ✅ |
| **K5** | Frontend | Tidak ada save mutex global → double save paralel → race | 🟠 P1 | `saveLocks` per-section + 409 Conflict re-save guard | ✅ |
| **K6** 🔴 | Backend | **TOCTOU Race**: SELECT existing DILUAR `transaction()` → 2 req paralel read state sama → last-write-wins | 🔴 P0 | Logic SEMUA dipindahkan ke DALAM `.transaction()` callback | ✅ |
| **K7** | Backend | Tidak ada `SELECT ... FOR UPDATE` pessimistic lock (cuma updateDatasetRow) | 🟠 P1 | Tambah FOR UPDATE di SELECT row proposal / equipment dalam txn | ✅ |
| **K8** | Backend | Tidak ada optimistic locking | 🟡 P2 | Tambah column `version INT` + WHERE check saat write | ✅ |
| **K9** 🔴 | Backend | **Random pool connection**: `databaseService.query()` (pool random) DI LUAR txn, lalu `transaction()` buat koneksi BARU → REPEATABLE READ TIDAK BERLAKU | 🔴 P0 | Semua dalam 1 txn; HANYA pakai object `connection` dari callback txn | ✅ |
| **K10** 🔴 | Backend | `parseJsonRecord` SILENT return `{}` saat JSON corrupt → oldTables dianggap KOSONG → data hilang permanen | 🔴 P0 | `strict=true` default, throw `JsonCorruptionError` | ✅ |
| **K11** | DB | Tidak ada pre-write snapshot ke _history tables (cuma backup harian = recovery point 24 jam) | 🟠 P1 | Tabel `workspace_school_proposal_data_history` + insert snapshot SEBELUM write | ✅ |
| **K12** | DB | Isolation default REPEATABLE READ (bisa write skew) | 🟡 P2 | `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` di txn write kritis | ✅ |
| **K13** | DB | MySQL `max_allowed_packet` < 35MB → silent truncate | 🟡 P2 | Covered K3 (partial patch); set global server-side env | 🔵 Part |
| **K14** | DB | ODku = full overwrite semua field (bukan partial COALESCE) | 🟠 P1 | `preservePayloadObject` + COALESCE pattern tetap | ✅ |
| **K15** | Frontend | `clientGetInFlight` dedup TIDAK cross-path dengan cache read → stale read setelah write | 🟡 P2 | Write-back FRESH ke cache SESUDAH save BERHASIL, tidak cuma invalidasi | ✅ |
| **K16** | Frontend | Cross-tab broadcast HANYA pra-bimtek (cuma proposal page) | 🟡 P2 | `BroadcastChannel("saranasmk-school-workspace-sync")` + storageEvent di Provider | ✅ |
| **K17** | Integrity | Tidak ada post-save hash content verification → half-write dianggap SUKSES | 🟡 P2 | `integritySha` SHA256 column + response | ✅ |
| **K18** 🔴 | Deploy | PM2 `stop`/`start` TANPA drain request → mid-write PUT 30MB DIPOTONG → half-write | 🔴 P0 | `pm2 reload --wait` + `kill_timeout:60s` drain in-flight | ✅ |
| **K19** | Deploy | Backup DB pre-deploy TIDAK otomatis (sering di-skip shortcut) | 🔴 P0 | `predeploy_backup_and_lock.sh` WAJIB + lock file → deploy BLOCK tanpa lock | ✅ |
| **K20** 🔴 | Backend | `runtimeCache` = in-memory `Map` → TIDAK cross-worker sync saat PM2 cluster reload | 🔴 P0 | `SharedCacheAdapter<V>` Redis-ready pattern (fallback memory) | ✅ |

---

## 2. DECISION LOG: DATABASE
- **Fase 0 (sekarang - sekarang berjalan)**: **Tetap MySQL 8.0** — 85% masalah logic di kode, bukan di DB. Migrasi Postgres cost 5-7 hari tidak worth-it saat logic masih salah.
- **Fase 2 (nanti)**: Migrasi ke **PostgreSQL 16** bila:
  1. Logic sudah stabil (tidak ada patch backend seminggu sekali).
  2. Perlu fitur: JSONB indexing + GIN untuk query cepat, PITR (Point-In-Time Recovery) wal level=logical, partition table per tahun ajaran.
  3. Estimasi 5-7 hari kerja + downtime window 2 jam.

---

## 3. LAYER ARCHITECTURE
```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js App Router, /apps/web)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  pages: /sekolah/profil, /alat, /pengajuan, /dashboard  │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │ SSOT                               │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  SchoolWorkspaceProvider (React Context + useReducer)  │ │
│  │  dirtyFlags, saveLocks, DraftSizeGuard V2, Broadcast   │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  api.ts — scopedCacheKey (sep="::"), write-back cache, │ │
│  │  computeTopLevelPatchDiff(), PATCH /delta endpoint     │ │
│  └──────────────────────┬─────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────┐
│  BACKEND (NestJS Fastify, /apps/api)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Controllers: ReqMeta (ip, userAgent, x-request-id)    │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  Services: upsertProposal/Equipment dengan             │ │
│  │   SERIALIZABLE txn, FOR UPDATE lock, version optimistic │ │
│  │   strict parseJsonRecord, 25% shrink guard, history     │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  SharedCacheAdapter — Redis-ready pattern + fallback   │ │
│  │   MemoryMap (fix K20 cross-worker cache stale)         │ │
│  └──────────────────────┬─────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  DATABASE: MySQL 8.0 (Production: 103.160.202.73:3306)       │
│  - workspace_school_proposal_data        (PK school_id,      │
│    UNIQUE, version INT, data_sha256 CHAR(64))               │
│  - workspace_school_equipment_data        (sama)            │
│  - *_history tables (pre-write snapshot K11)                │
│  - system_audit_log (write trail K17 reqMeta)               │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  DEPLOY PIPELINE (103.160.202.73, user alatprods, PM2)       │
│  predeploy_backup_and_lock.sh (MANDATORY, lock file)        │
│    → deploy_v5_pm2_graceful.sh (pm2 reload BUKAN stop/start) │
│    → deploy_safety_check_v2.sh (POST diff PRE/POST rowcount) │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. ROADMAP EXECUTION FASES
### ✅ Fase 0 — Hotfix Critical (Sudah DONE hari ini, 31 Aug 2026)
| # | Nama | Target |
|---|---|---|
| HF1 | Backend Write Path | upsertProposal/upsertEquipment SERIALIZABLE, FOR UPDATE, strict JSON, optimistic lock, 25% shrink guard |
| HF2 | History Tables | ensureSchema bootstrap `version`, `data_sha256` + 3 tabel baru history + audit |
| HF3 | Frontend Cache | scopedCacheKey V5 sep `::`, invalidateScopedByPrefix, write-back cache, perbaiki 4 kategori write mutations |
| HF4 | Deploy Pipeline | predeploy lock, pm2 reload graceful, ecosystem.config.js kill_timeout 60s, safety audit PRE/POST diff |

### ✅ Fase 1 — SSOT & Partial Payload (T1-T4, Sudah DONE hari ini)
| # | Nama | Target |
|---|---|---|
| T1.1 | SchoolWorkspaceProvider | Context + useReducer SSOT 4 sections, dirtyFlags, saveLocks, DraftSizeGuard V2, BroadcastChannel |
| T1.2 | /sekolah/profil | Wrap ProviderWrapper di page |
| T1.3 | /sekolah/alat | Wrap ProviderWrapper + partial patch helper ready |
| T1.4 | /sekolah/pengajuan & /dashboard/sekolah | Wrap ProviderWrapper |
| T3.1 | Partial PATCH Endpoint | PATCH `/workspace-data/school-proposals/me/delta` & `/school-equipment/me/delta` + `computeTopLevelPatchDiff` |
| T4 | Shared Cache + Cross-tab Sync | SharedCacheAdapter Redis-ready pattern; BroadcastChannel + storageEvent listener di Provider |

### 🔵 Fase 2 — Migrasi PostgreSQL 16 (Estimasi Q4 2026, 5-7 hari)
- [ ] Setup pgloader MySQL → Postgres + konversi JSON → JSONB.
- [ ] Enable `wal_level=logical` untuk PITR recovery point 1 detik.
- [ ] Partition `workspace_school_proposal_data_history` per tahun ajaran.
- [ ] Tambah GIN index di `proposal_tables_json` untuk query LIKE cepat.

### 🔵 Fase 3 — Blue-Green PM2 & 3-2-1 Backup Strategy (Estimasi 2 hari)
- [ ] Deploy blue-green: instance hijau port 4001 / 3001 → healthcheck ok → swap upstream nginx → stop biru.
- [ ] 3 copy data (1 produksi, 1 disk lokal, 1 offsite S3-compatible / Storj), 2 media (HDD + S3), 1 offsite.
- [ ] Test restore monthly drill (wajib 1x sebulan).

---

## 5. DATA MODEL TAMBAHAN (HOTFIX 2)
### Table `workspace_school_proposal_data` (tambah kolom VIA ensureSchema idempotent):
```sql
ALTER TABLE workspace_school_proposal_data
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_sha256 CHAR(64) NULL;
```
(sama untuk equipment_data)

### Table BARU (HOTFIX 2):
- `workspace_school_proposal_data_history` — snapshot BEFORE update (K11 recovery point ≤ 1 detik)
- `workspace_school_equipment_data_history` — sama
- `system_audit_log` — trail setiap write dengan reqMeta (ip, userAgent, x-request-id, hash before/after)

---

## 6. FRONTEND CACHE SPEC V5 (FIX K4 K15)
```
FORMAT KEY:  ::${url}::${sha1(token).slice(0,8)}${token.slice(-6)}
SEPARATOR :  "::"  (BUKAN "|" — character pipe sering di-clear sebagai prefix salah)
INVALIDATE:
  ✅ BENAR : invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals`)
              → match scope + prefix base, scope-agnostic fallback double protection
  ❌ SALAH : clearClientGetCache(`${API_URL}/...|`)  → TIDAK match scope user → stale permanen
WRITE-BACK:
  Setiap PUT/PATCH BERHASIL → writeClientGetCache(scopedKey, freshResult, SHORT_TTL_MS)
  → next GET request langsung fresh, TIDAK perlu network round-trip.
```

---

## 7. BACKEND WRITE PATH SPEC V5 (FIX K6 K7 K8 K9 K10 K12)
Setiap upsertProposal / upsertEquipment Wajib urutan:
1. `databaseService.transaction(async (connection) => { ... })` — **SEMUA di dalam callback**
2. `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
3. `SELECT proposal_tables_json, rpkp_selections_json, version FROM ... WHERE school_id=? FOR UPDATE` — **LOCK row**
4. `parseJsonRecord(..., strict=true)` — THROW bila corrupt (JANGAN silent `{}`)
5. Compute oldBytes/newBytes → jika new < old * 0.25 → throw ConflictException 409
6. `INSERT INTO ..._history` snapshot BEFORE
7. Upsert dengan `WHERE version = expectedVersion` → optimistic lock
8. Compute sha256, return `{ ..., version, integritySha }`
9. Invalidate scope cache BASE (bukan suffix `|`), write audit log system_audit_log

---

## 8. DEPLOY PIPELINE SPEC V5 (FIX K18 K19)
URUTAN DEPLOY YANG WAJIB:
```
  bash scripts/predeploy_backup_and_lock.sh   ← MANDATORY, bila gagal EXIT >0
  ├─ mysqldump full + sha256 checksum
  ├─ signature rowcount + json bytes PRE
  └─ write /tmp/saranasmk_deploy_locks/predeploy_done.LOCK
         │
         ▼
  bash scripts/deploy_v5_pm2_graceful.sh
  ├─ VERIF lock_file ADA & age < 3600s (1 jam) → bila tidak → EXIT 3 (BATAL)
  ├─ npm ci
  ├─ npx nx build api production
  ├─ npx nx build web production
  ├─ pm2 reload saranasmk-api --wait --update-env
  ├─ pm2 reload saranasmk-web --wait --update-env
  ├─ healthcheck :4000 / :3000 (max 90s)
  └─ pm2 status | tail
         │
         ▼
  bash scripts/deploy_safety_check_v2.sh POST
  └─ DIFF PRE vs POST rowcount + json bytes
     → deviation > 3 field ? REKOMENDASI ROLLBACK : ✅ OK
```

---

## 9. ACCEPTANCE CRITERIA (TRACKING GO-LIVE PRODUKSI)
Sebelum hotfix ini di-deploy ke produksi (103.160.202.73), **WAJIB lulus**:
| # | Test Case | Target | Cara Verif |
|---|---|---|---|
| AC1 | 50x double save paralel (JMeter) | 0 row corrupt, 0 data hilang, last-write = latest version | Load Test JMeter + SELECT COUNT(*) + sha256 check |
| AC2 | Cross-tab 2 window edit → save 1 → tab 2 lihat perubahan ≤ 2 detik | Changestamp naik → invalidasi cache + reload otomatis | Manual 2 tab browser |
| AC3 | Cache invalidation 100% match | Save di tab A → GET di tab B dapat data TERBARU, bukan stale | Clear browser storage, save → GET → compare JSON.stringify |
| AC4 | Edit 1 baris alat (1 row kecil) | Payload size ≤ 25KB (bukan 30MB). PATCH /delta time ≤ 800ms P95 | Chrome DevTools Network tab |
| AC5 | Tiap write → ada row di _history table | `SELECT COUNT(*) FROM ..._history` bertambah 1 setiap save | Query SQL POST save |
| AC6 | Deploy selama 100x parallel PUT 30MB | 0 mid-write truncated, pm2 logs TIDAK ada ECONNRESET | PM2 + nginx access log |

---

## 📎 LAMPIRAN DOKUMEN TERKAIT
Semua file ini ADA di folder `/docs/`:
1. [CHANGELOG_HOTFIXES_20260831.md](./CHANGELOG_HOTFIXES_20260831.md) — line-by-line perubahan kode rollout ini.
2. [DEPLOY_SOP.md](./DEPLOY_SOP.md) — step-by-step deploy + rollback + restore backup.
3. [SCHOOL_WORKSPACE_GUIDELINES.md](./SCHOOL_WORKSPACE_GUIDELINES.md) — tata cara menambahkan section baru / edit halaman sekolah KONSISTEN.
4. [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — organisasi folder dan file mana yang TIDAK boleh dihapus / dipindah.
