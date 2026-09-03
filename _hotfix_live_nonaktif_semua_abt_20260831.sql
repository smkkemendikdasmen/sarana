-- =========================================================
-- HOTFIX LIVE saranasmk.id: NONAKTIFKAN SEMUA AKUN SEKOLAH ABT
-- Target Server: 103.160.202.73  MySQL 8 (LIVE Production)
-- Tanggal: 31 Agustus 2026
-- Jadwal Buka Kembali: 1 September 2026 08:00 WIB
-- Eksekusi: HeidiSQL / DBeaver / mysql cli user root atau db_user
-- =========================================================

-- 0. Backup BEFORE (REQUIRED — SOP sebelum mass update)
--    Jalankan command ini TERLEBIH DAHULU sebelum update:
--    $ mysqldump -u root -p saranasmk users workspace_school_proposal_data > _BACKUP_ABT_NONAKTIF_BEFORE_20260831.sql
--    Atau via HeidiSQL: Tools → Export database rows.

-- 1. [DATA PENERIMA ABT] Set status_penerima_abt = FALSE (nonaktif) untuk semua sekolah.
--    Kolom status_penerima_abt ada di workspace_school_proposal_data.
START TRANSACTION;
UPDATE workspace_school_proposal_data
SET status_penerima_abt = 0
WHERE status_penerima_abt IS NULL OR status_penerima_abt <> 0;
-- Rows affected = total proposal (132 rows = match 132 sekolah).

-- 2. [AKUN LOGIN] Nonaktifkan SEMUA user dengan role = 'SEKOLAH'.
--    Login akan gagal (forbidden) atau muncul pesan nonaktif.
--    Kolom: users.is_active = TINYINT(1) / BOOLEAN.
UPDATE users
SET is_active = 0
WHERE role = 'SEKOLAH' AND (is_active IS NULL OR is_active <> 0);
-- Rows affected = total akun SEKOLAH (target 132 rows).

-- 3. Opsional: Buat log perubahan untuk audit.
INSERT INTO system_version_log (version_tag, description, applied_at, applied_by, rollback_sql)
VALUES (
  'HOTFIX-ABT-NONAKTIF-20260831',
  'Nonaktifkan SEMUA status penerima ABT + akun login SEKOLAH. Dibuka kembali 1 September 2026 08:00 WIB.',
  NOW(),
  'SYSTEM_OPERATOR',
  CONCAT(
    'UPDATE workspace_school_proposal_data SET status_penerima_abt=1; ',
    'UPDATE users SET is_active=1 WHERE role=''SEKOLAH'';'
  )
);

COMMIT;

-- ================ VERIFIKASI SETELAH UPDATE ================
-- Jalankan SELECT ini untuk memastikan nonaktif 100%:
--
--  A. Cek status penerima ABT: SEMUA FALSE / 0
--     SELECT COUNT(*) AS abt_aktif FROM workspace_school_proposal_data WHERE status_penerima_abt = 1 OR status_penerima_abt IS TRUE;
--     Expect: abt_aktif = 0
--
--  B. Cek akun SEKOLAH nonaktif: SEMUA is_active = 0
--     SELECT COUNT(*) AS sekolah_aktif FROM users WHERE role = 'SEKOLAH' AND is_active = 1;
--     Expect: sekolah_aktif = 0
--
--  C. Rollback jika diperlukan:
--     START TRANSACTION;
--     UPDATE workspace_school_proposal_data SET status_penerima_abt = NULL;
--     UPDATE users SET is_active = 1 WHERE role = 'SEKOLAH';
--     COMMIT;
