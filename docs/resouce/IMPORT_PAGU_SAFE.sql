-- ============================================================
-- SAFE IMPORT PAGU ANGGARAN 2026/2027 — GENERATED 2026-09-02T16:55:57.004Z
-- SOURCE: docs/resouce/Data Pagu - Sheet1.csv
-- TOTAL INPUT CSV: 131 NPSN
-- MATCH schools: 131 | UNMATCH schools: 0
-- ROW EXIST di school_pagu_budgets: 131 | NEW INSERT: 0
-- ============================================================
BEGIN;

-- UPDATE NPSN 10110535 — SMK Negeri 3 Aceh Barat Daya
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110535' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110536 — SMK NEGERI 2 ACEH BARAT DAYA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110536' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110273 — SMKN 1 Arongan Lambalek
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1970000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110273' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110537 — SMK NEGERI 5 ACEH BARAT DAYA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1580000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110537' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10102743 — SMK NEGERI 1 TRUMON TIMUR
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1970000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10102743' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10104057 — SMKN 1 SINGKIL UTARA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10104057' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 60726644 — SMKN 1 KUALASIMPANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '60726644' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70003115 — SMK NEGERI 5 TAKENGON
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1180000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70003115' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10112892 — SMK SWASTA IT AL AMANAH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10112892' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110357 — SMKS BADRUL ULUM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1180000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110357' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69726324 — SMKS Plus AMAL
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2170000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69726324' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10106280 — SMK NEGERI 1 BAKTIYA BARAT
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5520000000,
  pagu_pelatihan = 80000000,
  pagu_total     = 5609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10106280' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69909282 — SMK NEGERI 1 COT GIREK
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69909282' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113067 — SMK NEGERI 1 LAPANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3160000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113067' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69787116 — SMKS TERPADU BABUSSALAM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1970000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69787116' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113041 — SMK FARMASI CITRA BANGSA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1580000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113041' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69943314 — SMK Swasta Mubarrak Al-Waliyah
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 980000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69943314' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70049631 — SMK SWASTA TASTAFI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 980000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70049631' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10107108 — SMK Negeri 1 Peusangan
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10107108' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69727923 — SMK NEGERI 14 MEDAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 8500000000,
  pagu_pelatihan = 100000000,
  pagu_total     = 8609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69727923' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69924677 — SMK SWASTA MUHAMMAD YAASIIN SEI LEPAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2930000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69924677' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10104846 — SMK NEGERI 1 ACEH BARAT DAYA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 8300000000,
  pagu_pelatihan = 100000000,
  pagu_total     = 8409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10104846' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110534 — SMK NEGERI 4 ACEH  BARAT DAYA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110534' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 60729112 — SMK Negeri 1 Lhoknga
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '60729112' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113369 — SMKS HIDAYATUL ANAM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1780000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113369' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69947031 — SMK SWASTA MUHAMMADIYAH SINGKIL
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 680000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 709160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69947031' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10108048 — SMKN 2 KARANG BARU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 13500000000,
  pagu_pelatihan = 100000000,
  pagu_total     = 13609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10108048' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110624 — SMKN 1 BENDAHARA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4950000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 5009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110624' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69966741 — SMKS SABILUL ULUM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69966741' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10107161 — SMKS SYUKRONIYAH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10107161' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10107158 — SMKN 1 KARANG BARU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2370000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10107158' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10104267 — SMK SWASTA MAIMUN HABSYAH KUALA SIMPANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2170000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10104267' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10108049 — SMKN 3 KARANG BARU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2170000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10108049' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70005918 — SMK SWASTA MISRA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1580000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70005918' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111334 — SMKN 2 PEUREULAK
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5320000000,
  pagu_pelatihan = 80000000,
  pagu_total     = 5409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111334' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113344 — SMK NEGERI 1 PEUREULAK
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4730000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 4809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113344' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69946304 — SMKN 1 INDRA MAKMU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4340000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69946304' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110606 — SMK NEGERI 1 SIMPANG ULIM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4140000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110606' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113373 — SMKN 1 PANTE BIDARI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4140000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113373' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111584 — SMK NEGERI 1 LOKOP
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111584' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69990050 — SMKN 1 NURUSSALAM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69990050' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10112170 — SMKN 1 JULOK
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10112170' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10108210 — SMK N 1 TANAH JAMBO AYE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 6510000000,
  pagu_pelatihan = 90000000,
  pagu_total     = 6609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10108210' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10108219 — SMK NEGERI 1 TANAH LUAS
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5720000000,
  pagu_pelatihan = 80000000,
  pagu_total     = 5809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10108219' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69759159 — SMK NEGERI 1 BAKTIYA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5130000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 5209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69759159' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10106278 — SMKN 1 Muara Batu
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4340000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10106278' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10108220 — SMK NEGERI 1 SYAMTALIRA ARON
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10108220' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69726919 — SMK SWASTA HUMANIORA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69726919' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70035709 — SMK SWASTA ANEUK LAOT
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70035709' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70036211 — SMK SWASTA IT MANAHILUL IRFAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1780000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70036211' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70006104 — SMK SWASTA NURUL YAQIN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1780000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70006104' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10108221 — SMKS TERPADU AL AZHAR
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1580000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10108221' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69988419 — SMK AL FHATTANI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69988419' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69970964 — SMKS KAFILUL YATIM
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69970964' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69972330 — SMK Negeri 5 Bener Meriah
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69972330' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10107107 — SMK NEGERI 1 JEUNIEB
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5520000000,
  pagu_pelatihan = 80000000,
  pagu_total     = 5609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10107107' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69945354 — SMK SWASTA AL-HIDAYAH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4730000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 4809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69945354' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10107109 — SMK NEGERI 1 JEUMPA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10107109' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10103755 — SMK Kesehatan Muhammadiyah Bireuen
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10103755' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113428 — SMK-PP NEGERI BIREUEN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2370000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113428' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10104541 — SMK NEGERI 1 GAYO LUES
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4730000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 4809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10104541' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10100635 — SMK Negeri 1 Sigli
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4830000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 4909160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10100635' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10100633 — SMKS LILAWANGSA SIGLI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10100633' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69753602 — SMK NEGERI MANE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3550000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69753602' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110275 — SMKN 3 SIGLI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110275' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111806 — SMKN 1 BANDAR DUA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5530000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 5609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111806' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10112857 — SMK Negeri Ulim
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4540000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10112857' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69972006 — SMK BUDI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3750000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69972006' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10112856 — SMK Negeri Trienggadeng
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10112856' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69950731 — SMK UMMUL AYMAN 2
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69950731' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10112509 — SMKN 1 SALANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3550000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10112509' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10103348 — SMK Negeri 2 Sinabang
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3160000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10103348' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111947 — SMK NEGERI 1 TEUPAH TENGAH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111947' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69896252 — SMK NEGERI 1 SIMEULUE CUT
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69896252' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105724 — SMK NEGERI 2 LANGSA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 9900000000,
  pagu_pelatihan = 100000000,
  pagu_total     = 10009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105724' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10113917 — SMK NEGERI 6 LANGSA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10113917' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10107115 — SMK N 5 LANGSA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3160000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10107115' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105628 — SMKN 4 Lhokseumawe
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105628' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105629 — SMKS KARYA BERINGIN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3160000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105629' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110714 — SMKN 5 LHOKSEUMAWE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110714' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111838 — SMK NEGERI 7 LHOKSEUMAWE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111838' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110650 — SMKS ULUMUDDIN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110650' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70003663 — SMK IT PESANTREN TABINA ACEH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2170000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70003663' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105704 — SMK N 1 LANGSA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2170000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105704' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105625 — SMK NEGERI 1 LHOKSEUMAWE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5130000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 5209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105625' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105627 — SMK NEGERI 3 LHOKSEUMAWE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105627' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10105626 — SMK NEGERI 2 LHOKSEUMAWE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10105626' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69758278 — SMKN 8 LHOKSEUMAWE
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2570000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69758278' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10110769 — SMKN 6 Lhokseumawe
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2170000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10110769' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111502 — SMK SWASTA MUHAMMADIYAH LHOKSUKON
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 680000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 709160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111502' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10112855 — SMKN 1 BANDAR BARU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1780000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10112855' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10100617 — SMK SWASTA MUTIARA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9200000,
  pagu_alat      = 380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 409200000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10100617' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111935 — SMK NEGERI 1 TEUPAH SELATAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1780000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111935' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10103347 — SMK NEGERI 1 SINABANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10103347' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69949251 — SMK NEGERI PERIKANAN SIMEULUE BARAT
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1970000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69949251' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10111684 — SMK Negeri 3 Sinabang
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 980000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10111684' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69754554 — SMKN 1 Simpang Alahan Mati
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4297000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 4346160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69754554' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10310878 — SMKN 1 RANAH BATAHAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 931000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 1000160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10310878' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10306135 — SMKN 1 Sasak Ranah Pasisie
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5077000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 5146160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10306135' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10301946 — SMKS Teknologi Lengayang
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 5475000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 5544160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10301946' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10220646 — SMKN 1 TANJUNG PURA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4730000000,
  pagu_pelatihan = 70000000,
  pagu_total     = 4809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10220646' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10260493 — SMKN 1 LUMUT
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4540000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10260493' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69953551 — SMK SWASTA TAMAN SISWA PADANG TUALANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 4340000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69953551' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10259372 — SMKS SRI LANGKAT
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10259372' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10220747 — SMK SWASTA TAMAN SISWA SAWIT SEBERANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10220747' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69727256 — SMK Swasta Imelda Medan
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3940000000,
  pagu_pelatihan = 60000000,
  pagu_total     = 4009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69727256' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 70044057 — SMK Negeri 1 Sukabangun
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3750000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '70044057' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10211209 — SMK TI SWASTA BUDI AGUNG MEDAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3750000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10211209' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10208081 — SMKN 1 BATANG NATAL
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3550000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10208081' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69956351 — SMK SWASTA TARUNA BANGSA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69956351' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10220604 — SMKN 1 PAHAE JULU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3350000000,
  pagu_pelatihan = 50000000,
  pagu_total     = 3409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10220604' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10201068 — SMK PERSIAPAN PADANG TUALANG
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 3160000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10201068' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10259283 — SMKS AL-MA'ARIF
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10259283' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10260526 — SMKN 1 BADIRI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 3009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10260526' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69725097 — SMK SWASTA AL HIKMAH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69725097' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10210765 — SMKN 8 MEDAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2760000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 2809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10210765' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10257578 — SMKS AL JAMIYATUL WASHLIYAH
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1970000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10257578' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69956580 — SMK SWASTA AL-MAKSUM YAZID
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1970000000,
  pagu_pelatihan = 30000000,
  pagu_total     = 2009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69956580' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10259709 — SMKS MAJU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1480000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1509160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10259709' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10206597 — SMKS TI MUHAMMADIYAH 11 SIBULUAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 2409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10206597' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10201331 — SMKS HARAPAN BABALAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10201331' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10260514 — SMKS MUHAMMADIYAH 18 P BERANDAN
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10260514' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10211076 — SMKS YWKA Medan
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1380000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1409160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10211076' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10260540 — SMK NEGERI 1 TAPIAN NAULI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 2180000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 2209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10260540' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10208082 — SMKN 1 NATAL
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1180000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10208082' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10220748 — SMKS YPII TANJUNG PURA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 1180000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1209160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10220748' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10220618 — SMKN 1 BATANGTORU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 1009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10220618' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 60725063 — SMKN 2 BATANG TORU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 960000000,
  pagu_pelatihan = 40000000,
  pagu_total     = 1009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '60725063' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10220208 — SMKN LOSIDA SIATAS BARITA
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 980000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 1009160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10220208' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 10201070 — SMKS PEMBANGUNAN NASIONAL PANGKALAN SUSU
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 780000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 809160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '10201070' AND tahun_ajaran = '2026/2027';

-- UPDATE NPSN 69937373 — SMK SWASTA KESEHATAN RACHMAD INSANI
UPDATE school_pagu_budgets SET
  pagu_persiapan = 9160000,
  pagu_alat      = 580000000,
  pagu_pelatihan = 20000000,
  pagu_total     = 609160000,
  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN 'msmde0xz9af4d1b6fc5a3e955c' ELSE set_by_admin_id END,
  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN 'Admin Operasional SARANA SMK' ELSE set_by_admin_name END,
  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,
  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,
  updated_at     = NOW()
  WHERE npsn = '69937373' AND tahun_ajaran = '2026/2027';

COMMIT;

-- ============================================================
-- SUMMARY IMPORT: UPDATE 131 + INSERT 0 = TOTAL 131
-- ============================================================