# FASE 12: ROLE URUTAN MANUAL TESTING CHECKLIST v1.0
**Urutan eksekusi WAJIB (99% traffic → 1% traffic): SEKOLAH → FASILITATOR-ADMINISTRASI → FASILITATOR-ALAT → ADMIN**
DB Target: PostgreSQL 17 lokal `saranasmk@127.0.0.1:5432/saranasmk`
Dibuat: 31-08-2026 · Exit criteria: EXIT PASS semua item checklist.

---

## ✅ PRE-REQUISITE (Before Test)
- [x] PostgreSQL 17 accepting connection (pg_isready exit 0)
- [x] Redis 8 up (redis-cli PONG)
- [x] `pm2 start ecosystem.config.js` → api-blue:4000 (12), web-blue:3000 (12) UP
- [x] Banner pengumuman login TERLIHAT "Akan dibuka kembali 1 September 2026"
- [x] Integrity Report SHA+Version 100% (phase 11)
- [x] TSC API 0 error + Next.js build RC=0

---

## 🟢 LEVEL 1 — ROLE SEKOLAH (99% user, WAJIB 100% PASS DULU sebelum naik Level 2)
CREDENTIAL TEST: Gunakan NPSN nyata contoh 10113067 (SMKN 1 Lapang) — reset password sementara, atau pakai user SEKOLAH dummy test.

| No | Skenario | Expected Result | Status | Notes |
|----|----------|-----------------|--------|-------|
| S.1 | `/login` → Login NPSN + Password VALID | Redirect dashboard `/dashboard/SEKOLAH` HTTP 302. Session.user.npsn = 8 digit. | ⬜ |  |
| S.2 | `/sekolah/profil` load Profil Sekolah | Konsentrasi Keahlian LIST >= 0 rows. RLS npsn = current user. TIDAK ADA error toast "Unauthorized". | ⬜ |  |
| S.3 | Buka `/sekolah/pengajuan/data-sarana` | Survey badge count sesuai COUNT proposal_tables_json. UI TIDAK blank (keys lengkap 11 KK). | ⬜ |  |
| S.4 | Edit Survey (ubah 1 item quantity) → Klik **SIMPAN** (manual save). PUT /api/workspace/proposal PATCH. | Response `{ok:true, version: v0→v0+1}` increment. SHA256 berubah. | ⬜ |  |
| S.5 | Logout → Login kembali (reload browser) | Data survey di langkah S.4 **MASIH ADA** (TIDAK revert). Verifikasi: version tetap sama. | ⬜ | CRITICAL: CEGAH DATA REVERT |
| S.6 | `/sekolah/pengajuan/data-sarana` RPKP tab: Pilih toko → SIMPAN. | Badge RPKP status **HIJAU** count > 0. Tidak ada "Gagal Menyimpan" padahal tersimpan. | ⬜ |  |
| S.7 | `/sekolah/pengajuan/data-pelatihan` SIMPAN. | Pelatihan tersimpan. Version increment. HTTP 200. BUKAN 500. | ⬜ | Cek transaction isolation serializable. |
| S.8 | `/sekolah/pengajuan/data-persiapan` SIMPAN Pagu Maksimal 9.160.000. | Pagu tetap 9.160.000 tidak berubah. Cross-cek JSON. | ⬜ |  |
| S.9 | Upload Bukti Dokumen PDF di halaman Profil → save. | File path PREFIX folder_id = NPSN 8 digit (bukan UUID). HTTP 201. | ⬜ | FASE 6 Verification. |
| S.10 | IDOR TEST: Login User NPSN_A → manual ubah URL → `/fasilitator-administrasi/verifikasi-online/NPSN_B`. | ROW COUNT = 0 ATAU HTTP 403. TIDAK ADA cross-school data. | ⬜ | RLS Block! |
| S.11 | Logout. Cookie auth-token TIDAK ADA. Redirect `/login`. | Logout OK. Clean session. | ⬜ |  |

**LEVEL 1 EXIT CRITERIA:** S.1–S.11 SEMUA ⬜→✅. Jika SATU GAGAL, PERBAIKI DULU sebelum lanjut Level 2.

---

## 🟡 LEVEL 2 — FASILITATOR ADMINISTRASI (≈0.8% traffic)
CREDENTIALS: Role `FASILITATOR_ADMINISTRASI` (bukan admin penuh). Cek assignments via `workspace_school_assignments`.

| No | Skenario | Expected Result | Status | Notes |
|----|----------|-----------------|--------|-------|
| FA.1 | Login → dashboard `/dashboard/FASILITATOR_ADMINISTRASI` | Menu hanya terlihat scope yang di-assign (tidak ada menu SuperAdmin). | ⬜ |  |
| FA.2 | `/fasilitator-administrasi/verifikasi-online` | HANYA sekolah yang TERASSIGN (via `app_npsn_in_assignment()` SECURITY DEFINER) yang tampil. TIDAK semua 132. | ⬜ |  |
| FA.3 | Klik satu sekolah yang assigned → `/fasilitator-administrasi/verifikasi-online/[npsn]` → Ubah status → SIMPAN. | Tersimpan. NOTIFY trigger → `LISTEN tbl_workspace_verifikasi_online_reviews` terpublish Redis. | ⬜ |  |
| FA.4 | Try akses NPSN TIDAK di assignment. | Data TIDAK muncul (count=0) / 403. | ⬜ | RLS Assignment Block. |
| FA.5 | Buka wawancara, pra-bimtek → save. | Status change OK. Cross scope ke sekolah TIDAK di-assign GAGAL. | ⬜ |  |

---

## 🟠 LEVEL 3 — FASILITATOR ALAT (≈0.15% traffic)
CREDENTIALS: Role `FASILITATOR_ALAT` scope equipment / alat.

| No | Skenario | Expected Result | Status | Notes |
|----|----------|-----------------|--------|-------|
| FAL.1 | Login → `/dashboard/FASILITATOR_ALAT` | Data Sarana / alat scope terbatas assignment. | ⬜ |  |
| FAL.2 | Buka `/fasilitator-alat/bimbingan-teknis/[npsn]` → Edit RAB detail → SIMPAN. | Version increment. RLS `app_npsn_in_assignment()` hanya scope assigned. | ⬜ |  |
| FAL.3 | Try akses cross scope sekolah un-assigned. | HTTP 403 / empty list. | ⬜ |  |

---

## 🔴 LEVEL 4 — ADMIN / SUPERADMIN (0.05% traffic, TEST TERAKHIR)
CREDENTIALS: ADMIN (bisa lihat SEMUA 132 sekolah).

| No | Skenario | Expected Result | Status | Notes |
|----|----------|-----------------|--------|-------|
| A.1 | Login → `/dashboard/ADMIN`. RLS bypass via `app_has_role('ADMIN')`. | Count dashboard schools === 132 (ALL). TIDAK 0 / 1. | ⬜ |  |
| A.2 | `/admin/pengguna` → Tab SEKOLAH_ABT → Klik **⛔ Nonaktifkan SEMUA Akun Sekolah ABT**. | Confirm dialog YES. Result: `totalChanged = count(SEKOLAH)`. | ⬜ | Test HOTFIX. |
| A.3 | `/admin/master-data/data-alat-perdirjen` → CRUD Create 1 item → Update → Delete. | Transaksi ACID. Tidak ada error constraint. | ⬜ |  |
| A.4 | `/admin/laporan/rpkp` Report page. Load badge Total Anggaran RPKP icon ShoppingCart. | Tidak ada error `lucide-react Cart export not found`. UI render OK. | ⬜ | Bug build S.10 cart → ShoppingCart FIX. |
| A.5 | `/admin/version-changelog` (system_version_log) → Cek list. | Entri HOTFIX ABT NONAKTIF 20260831 ADA. | ⬜ |  |
| A.6 | PM2 Blue-Green deploy: scale api-green → 2 → 6 → 12 workers. Canary test /healthz <300ms ≥95% | Blue swap after threshold. Fallback 1 click delete green. | ⬜ | FASE 14 Verify |

---

## 🚫 ROLLBACK TRIGGER
Jika Level manapun GAGAL kritis:
1. **Immediate STOP testing.**
2. Jalankan pg_restore backup FASE 0 frozen 763MB:
   `pg_restore -U saranasmk -C -d saranasmk _BACKUP_PRODUCTION/_pg_preschoolid_drop_full_20260831_201442.sqlc`
3. PM2 reload all: `pm2 reload ecosystem.config.js`
4. Notifikasi operator via WhatsApp group.

---

## ✅ FASE 12 EXIT PASS
Semua checklist LEVEL 1 (S.1–S.11) 100% PASS **DAN**
≥90% Level 2–4 items PASS TANPA error data loss / cross scope leak.
**Keluar FASE → Lanjut FASE 15 Release Tag.**
