# 📁 PROJECT STRUCTURE v5.0 — SARANASMK MONOREPO
**Pembaruan**: 31 Agustus 2026 — Hotfix v5.0 rollout  
**Dokumen Acuan**: [ARCHITECTURE_BLUEPRINT_v5.md](./ARCHITECTURE_BLUEPRINT_v5.md)

---

## 🗂️ FOLDER TREE STANDAR (setelah hotfix v5)
```
saranasmk/
├── 📁 apps/
│   ├── 📁 api/                             # NestJS Backend (port 4000 production)
│   │   ├── 📁 src/
│   │   │   ├── 📁 auth/
│   │   │   ├── 📁 common/constants,data
│   │   │   ├── 📁 cp-fase-f/
│   │   │   ├── 📁 dashboard/
│   │   │   ├── 📁 database/               # database.service.ts pool mysql2
│   │   │   ├── 📁 google-drive/
│   │   │   ├── 📁 master-data/
│   │   │   ├── 📁 onlyoffice/
│   │   │   ├── 📁 perdirjen-equipment/
│   │   │   ├── 📁 school-profile/         # SchoolProfileService (guard concentrations!)
│   │   │   ├── 📁 shared-cache/           # 🔴 BARU V5: SharedCacheAdapter pattern Redis-ready
│   │   │   ├── 📁 users/
│   │   │   ├── 📁 workspace-data/         # 🔴 PALING KRITIS: proposal + equipment upsert logic
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── 📁 scripts/
│   │   │   └── 📁 sql/                    # Schema migration DDLs (urutan nama tanggal)
│   │   ├── 📁 private-seeds/              # Seed awal (wilayah.sql, perdirjen json)
│   │   ├── 📁 uploads/                    # Dokumen user upload (school profile doc)
│   │   ├── .env / .env.example
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── 📁 web/                             # Next.js 15 App Router Frontend (port 3000)
│       ├── 📁 src/
│       │   ├── 📁 app/(workspace)/sekolah/ # 4 halaman target: profil, alat, pengajuan/*
│       │   ├── 📁 components/
│       │   │   ├── 📁 school/
│       │   │   │   ├── school-profile-manager.tsx       # (Legacy state lokal — SSOT sekarang Provider)
│       │   │   │   ├── school-equipment-page.tsx        # (Page /sekolah/alat)
│       │   │   │   ├── school-proposal-index-page.tsx   # (Page /sekolah/pengajuan)
│       │   │   │   ├── 🟢 school-workspace-provider.tsx          # 🔴 NEW V5: SSOT Context
│       │   │   │   └── 🟢 school-workspace-provider-wrapper.tsx  # 🔴 NEW V5: baca token auth
│       │   │   └── 📁 ui/                  # shadcn/ui components (Button, Card, Input, ...)
│       │   ├── 📁 lib/
│       │   │   └── api.ts                  # 🔴 KRITIS: cache v5 + partial patch helpers
│       │   ├── 📁 store/
│       │   │   └── auth-store.ts          # useAuthStore() session.token + user.id
│       │   └── 📁 lib/roles.ts, utils.ts
│       ├── e2e/                            # Playwright E2E test
│       ├── public/                         # Static assets
│       ├── next.config.ts
│       ├── eslint.config.mjs
│       └── package.json
│
├── 📁 docs/                                # 🔴 NEW V5: DOKUMENTASI RESMI
│   ├── 🟢 ARCHITECTURE_BLUEPRINT_v5.md    # INDUK DOKUMEN (semua keputusan desain K1-K20)
│   ├── 🟢 CHANGELOG_HOTFIXES_20260831.md  # Catatan perubahan kode hotfix v5
│   ├── 🟢 DEPLOY_SOP.md                   # SOP deploy + rollback (step by step)
│   ├── 🟢 SCHOOL_WORKSPACE_GUIDELINES.md  # Aturan coding 4 halaman sekolah
│   └── 🟢 PROJECT_STRUCTURE.md            # File ini (panduan organisasi folder)
│
├── 📁 scripts/                             # Script DEPLOY STANDAR (bukan ad-hoc!)
│   ├── 🟢 predeploy_backup_and_lock.sh    # 🔴 V5: WAJIB sebelum deploy
│   ├── 🟢 deploy_v5_pm2_graceful.sh       # 🔴 V5: Deploy utama (pm2 reload BUKAN stop/start)
│   ├── 🟢 deploy_safety_check_v2.sh       # 🔴 V5: POST audit PRE/POST diff rowcount
│   └── deploy_safety_check.sh             # (Legacy v1, referensi bila dibutuhkan)
│
├── 🟢 ecosystem.config.js                 # 🔴 V5: PM2 process file cluster, kill_timeout 60s
│
├── package.json                            # Root workspace (npm workspaces: apps/web, apps/api)
├── package-lock.json                       # LOCK FILE — JANGAN DIHAPUS / DI-EDIT MANUAL
├── .env                                    # Global env root
└── RUN
```

---

## 🚨 FILE FOLDER KRITIS — JANGAN PINDAHKAN / HAPUS SEMBARANGAN!
| Lokasi | Nama | Alasan |
|---|---|---|
| `apps/api/src/workspace-data/` | `workspace-data.service.ts` | **PALING KRITIS**. 10+ root cause ada disini (K4-K14). Ubah hanya bila paham txn SERIALIZABLE, FOR UPDATE, optimistic lock version, drastic shrink guard, snapshot history. |
| `apps/api/src/school-profile/` | `school-profile.service.ts` | Mengandung guard `hasOwnProperty(payload,'concentrations')` — JANGAN hapus! Cegah data konsentrasi hilang saat update. |
| `apps/web/src/lib/` | `api.ts` | Cache V5 + PATCH helpers. Jangan ubah `CACHE_V5_SEP = "::"` menjadi "|". Jangan ubah `scopedCacheKey` algorithm. |
| `apps/web/src/components/school/` | `school-workspace-provider.tsx` | SSOT 4 halaman sekolah. Semua state data sekolah disini. |
| `scripts/` | `deploy_v5_pm2_graceful.sh` | Deploy pipeline. Jangan ganti `pm2 reload` ke `pm2 stop && pm2 start` → mid-write terpotong K18! |
| `scripts/` | `predeploy_backup_and_lock.sh` | Backup DB + LOCK_FILE mechanism. JANGAN DI-HAPUS / DI-SKIP dalam workflow deploy. |
| `root/` | `ecosystem.config.js` | PM2 template config (instances cluster, kill_timeout 60s, wait_ready). Bila server pindah, WAJIB sesuaikan paths. |

---

## 🔴 LEGACY FILE & FOLDER (TIDAK DIHAPUS HARI INI, KEDOKAN NANTI)
> Folder / file dibawah ini ADALAH file ad-hoc lama (berawalan `_` di root). **JANGAN dihapus sekarang** karena masih jadi shortcut / referensi rollback darurat. Tunggu stabil 2 minggu, pindahkan ke `scripts/_legacy/` atau `_backups_production_*`:

| Lokasi | Keterangan | Tanggal Rencana Archive |
|---|---|---|
| `_cleanup_free_and_deploy_v43.py` | Deploy script LAMA (pm2 stop/start → bahaya mid-write). Digantikan deploy_v5 + predeploy lock | 14 Sept 2026 (2 minggu) |
| `_deploy_*.py` (70+ file di root) | Semua script deploy Python shortcut lama | 14 Sept 2026 |
| `_q_*.cjs`, `_probe_*.cjs` | Query ad-hoc SQL debugging lama | 30 Sept 2026 |
| `_verify_*`, `_e2e_*` | Script test / verify sekali pakai | 30 Sept 2026 |
| `132sch_full_profile_prod_20260829.json` | Data export produksi snapshot | 30 Sept 2026 |
| `LAPORAN_131_SEKOLAH_KK_*` (4 file .csv/.json) | Laporan patch KK 131 sekolah | 31 Des 2026 |

> KEBIJAKAN ARSIP: File `_*.py/cjs/mjs` yang TIDAK diakses 30 hari → dipindahkan ke `/scripts/_legacy/` dengan nama yang sama, TIDAK dihapus permanent.

---

## 📝 KEBIJAKAN PENEMPATAN FILE BARU (KONSISTEN KEDAPAN)
Hal baru MAU DITAMBAHKAN? TAROH DITEMPAT INI:

| Apa yang ditambahkan? | Folder Tujuan |
|---|---|
| Dokumentasi blueprint / SOP / changelog | `/docs/` |
| Script deploy / backup / audit / production | `/scripts/` (bash `.sh` lebih dipilih dari Python, kecuali perlu SSH SCP paramiko) |
| Script SQL migration DDL / ALTER TABLE baru | `/apps/api/scripts/sql/` (nama file: `YYYYMMDD-deskripsi-singkat.sql`) |
| Script debugging / ad-hoc query satu kali pakai | `/apps/api/scripts/_adhoc/` (boleh .mjs .ts) |
| Seed data awal (template master, wilayah, dll) | `/apps/api/private-seeds/` |
| Backend module baru (fitur CRUD besar) | `/apps/api/src/<nama-module>-lowercase/` → `<nama>.controller.ts` + `<nama>.service.ts` |
| Shared abstraction (caching, crypto, helpers) backend | `/apps/api/src/shared-<nama>/` |
| Komponen UI REUSABLE (Button, Input, Badge, Card, ...) | `/apps/web/src/components/ui/` (shadcn/ui pattern) |
| Komponen halaman SEKOLAH spesifik | `/apps/web/src/components/school/` → **WAJIB** bungkus dengan `SchoolWorkspaceProviderWrapper` di page level |
| Komponen dashboard / layout / navigasi | `/apps/web/src/components/dashboard/`, `/components/layout/` |
| Hook / util / helper function client side | `/apps/web/src/lib/<nama>.ts` → **WAJIB export function; JANGAN menaruh state React di file ini kecuali hook custom** |
| Store state (Zustand) client side | `/apps/web/src/store/` (contoh: auth-store.ts) |
| Static assets (gambar, PDF, template DOCX user DOWNLOAD) | `/apps/web/public/<kategori>/` |
| Upload file USER (dokumen upload ke server backend) | `/apps/api/uploads/<kategori>/<userid_or_schoolid>/` |

---

## ✅ NAMING CONVENTION
| Tipe | Aturan | Contoh BENAR | Contoh SALAH |
|---|---|---|---|
| File TypeScript Backend | `kebab-case.module.ts` | `school-profile.service.ts` | `SchoolProfileService.ts` |
| File TypeScript Frontend component | `PascalCase.tsx` export default named sama dengan nama file | `SchoolWorkspaceProvider.tsx` | `school-workspace-provider.tsx` (TIDAK — kecuali helper) |
| File TypeScript Frontend helper / lib | `camelCase.ts` | `computeDiffPatch.ts` | `ComputeDiffPatch.ts` |
| Bash Script .sh | `snake_case_vN.sh` | `deploy_safety_check_v2.sh` | `SafetyCheckDeploy.sh` |
| SQL migration | `YYYYMMDD-short-desc.sql` | `20260831-add-version-sha256.sql` | `tambah_kolom_version.sql` |
| API endpoint route path | `kebab-case-singular-or-plural` | `/workspace-data/school-proposals/me/delta` | `/WorkspaceData/schoolProposals/Me/Delta` |

---

## 🧪 FILE YANG BOLEH DI-DELETE TANPA RAGU (Tidak Berefek Apa-apa)
- Semua file `.DS_Store` macOS finder artifact
- Semua `._*` macOS resource fork (ada banyak di `/apps/web/public/data/...`)
- File `.log` lama di root folder (bisa taruh ke `/tmp/`)
- Isi `/tmp/` server production setiap reboot

---

## 🔒 IZIN AKSES FILE (CHMOD)
File apa pun yang DIPRODUKSI di server → perintah untuk apply:
```bash
# Script bash deploy: HARUS executable oleh user alatprods
chmod 755 scripts/*.sh
chmod 755 /home/alatprods/saranasmk/scripts/*.sh

# Folder backups: HANYA user alatprods bisa baca/tulis
chown -R alatprods:alatprods /home/alatprods/backups
chmod 700 /home/alatprods/backups

# Folder uploads user: bisa ditulis NestJS (user alatprods)
chown -R alatprods:alatprods /home/alatprods/saranasmk/apps/api/uploads
chmod 775 /home/alatprods/saranasmk/apps/api/uploads/school-profile-documents
```

---

## 📚 REFERENCES
- Semua aturan arsitektur, write path spec, cache spec, pipeline spec → **[ARCHITECTURE_BLUEPRINT_v5.md](./ARCHITECTURE_BLUEPRINT_v5.md)**
- Step by step deploy & rollback → **[DEPLOY_SOP.md](./DEPLOY_SOP.md)**
- Panduan coding 4 halaman sekolah (Provider, cache invalidation, partial patch) → **[SCHOOL_WORKSPACE_GUIDELINES.md](./SCHOOL_WORKSPACE_GUIDELINES.md)**
- Catatan perubahan kode setiap rollout → **[CHANGELOG_HOTFIXES_20260831.md](./CHANGELOG_HOTFIXES_20260831.md)**
