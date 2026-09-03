-- ================================================================
-- SCRIPT IMPORT BULK REKOMENDASI KK (131 SEKOLAH) - SAFETY PATTERN
-- Delete scope  : WHERE npsn=$1 AND row_order <= 5 (DATA RIIL >5 TETAP AMAN)
-- Sumber data   : docs/resouce/MAPPING_REKOMENDASI_KK_SIAP_IMPORT.json
-- Generate waktu: 2026-09-02T16:12:04.946Z
-- ================================================================
BEGIN;
-- (Opsional) SAVEPOINT pre_import_bulk;

-- ─────────────────────────────────────────────
-- No.1  [10110535]  SMK Negeri 3 Aceh Barat Daya
-- Input K1-K5: [10.2.1 | 2.2.2 | 8.1.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110535' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhlcb6b565d866cb85f49', '10110535', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhlea94305c621e78ea56', '10110535', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhl937d9064f69b642cf1', '10110535', '8.1.1', 'Bisnis Digital', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.2  [10110536]  SMK NEGERI 2 ACEH BARAT DAYA
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110536' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm5f1f1af41b147aab1f', '10110536', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.3  [10110273]  SMKN 1 Arongan Lambalek
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110273' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmc0c6a4738867ec1f0b', '10110273', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.4  [10110537]  SMK NEGERI 5 ACEH BARAT DAYA
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110537' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm3d0791b920d605d066', '10110537', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.5  [10102743]  SMK NEGERI 1 TRUMON TIMUR
-- Input K1-K5: [6.1.1 | 6.1.2 | 10.2.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10102743' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmbc18f51c4da15fa285', '10102743', '6.1.1', 'Agribisnis Tanaman Perkebunan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmfcbd2d17af6ca644f9', '10102743', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm45428d86d686a2a890', '10102743', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.6  [10104057]  SMKN 1 SINGKIL UTARA
-- Input K1-K5: [10.2.1 | 6.1.1 | 3.5.2 | 6.2.2 | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10104057' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmc29be68d15f44b5718', '10104057', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm951c2c2b52c9eb02c2', '10104057', '6.1.1', 'Agribisnis Tanaman Perkebunan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm44baad066394b43e46', '10104057', '3.5.2', 'Teknik Pemboran Minyak dan Gas', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm85fdc18d0676ada63f', '10104057', '6.2.2', 'Agribisnis Ternak Unggas', 0, 0, 0, 0, 0, 0, 0, 0, '', 4, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.7  [60726644]  SMKN 1 KUALASIMPANG
-- Input K1-K5: [8.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '60726644' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm17c77d31704310d6b7', '60726644', '8.1.1', 'Bisnis Digital', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.8  [70003115]  SMK NEGERI 5 TAKENGON
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70003115' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm925640a39d050d32eb', '70003115', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.9  [10112892]  SMK SWASTA IT AL AMANAH
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10112892' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmb640a86519c76a88cd', '10112892', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.10  [10110357]  SMKS BADRUL ULUM
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110357' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm0931ffe03f1ab1ffd0', '10110357', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.11  [69726324]  SMKS Plus AMAL
-- Input K1-K5: [8.2.1 | 5.1.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69726324' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm0162d1378c5dc00c21', '69726324', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm2db47a7a2e903290c2', '69726324', '5.1.1', 'Layanan Penunjang Keperawatan dan Caregiving', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.12  [10106280]  SMK NEGERI 1 BAKTIYA BARAT
-- Input K1-K5: [10.7.1 | 10.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10106280' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm006cee43299f12b50a', '10106280', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm7e10b8da5987f03fb7', '10106280', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.13  [69909282]  SMKN 1 Cot Girek
-- Input K1-K5: [10.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69909282' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm66fe5eca660c8aa385', '69909282', '10.2.2', 'Teknik Grafika', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.14  [10113067]  SMK Negeri 1 Lapang
-- Input K1-K5: [6.3.2 | 8.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113067' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm0c901e062c6402fcd9', '10113067', '6.3.2', 'Agribisnis Perikanan Payau dan Laut', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmfa5d0c61551c52db41', '10113067', '8.2.2', 'Manajemen Logistik', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.15  [69787116]  SMKS TERPADU BABUSSALAM
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69787116' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm62570e861dbfe8f452', '69787116', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.16  [10113041]  SMK FARMASI CITRA BANGSA
-- Input K1-K5: [5.3.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113041' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm3e52279e323fe5a949', '10113041', '5.3.1', 'Layanan Penunjang Kefarmasian Klinis dan Komunitas', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.17  [69943314]  SMK Swasta Mubarrak Al-Waliyah
-- Input K1-K5: [10.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69943314' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmf9598d74001d8b9311', '69943314', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.18  [70049631]  SMK SWASTA TASTAFI
-- Input K1-K5: [4.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70049631' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmd195345798c8a9bae2', '70049631', '4.1.1', 'Rekayasa Perangkat Lunak', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.19  [10107108]  SMK Negeri 1 Peusangan
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10107108' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm0fd2dbaa4f321a300a', '10107108', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.20  [69727923]  SMK NEGERI 14 MEDAN
-- Input K1-K5: [2.5.3 | 3.1.1 | 2.2.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69727923' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmd1f20621475f71904b', '69727923', '2.5.3', 'Teknik Elektronika Industri', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm25e0c99a9be722fb6b', '69727923', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmdf8222fa26b805f027', '69727923', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.21  [69924677]  SMK SWASTA MUHAMMAD YAASIIN SEI LEPAN
-- Input K1-K5: [4.2.1 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69924677' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm457583f7e6717373c1', '69924677', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm20053a5a3e3dd65dbe', '69924677', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.22  [10104846]  SMK NEGERI 1 ACEH BARAT DAYA
-- Input K1-K5: [2.2.2 | 2.2.1 | 3.1.1 | 4.2.1 | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10104846' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm1603a1eb7a28884257', '10104846', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmdd99e02402d56048fe', '10104846', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm5a933274ef96d0baed', '10104846', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm7525811bc1d501a760', '10104846', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 4, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.23  [10110534]  SMK NEGERI 4 ACEH BARAT DAYA
-- Input K1-K5: [2.3.1 | 6.5.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110534' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmfedc082eeda6d52f3a', '10110534', '2.3.1', 'Teknik Pengelasan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm883a7380f160781942', '10110534', '6.5.1', 'Agribisnis Pengolahan Hasil Pertanian', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.24  [60729112]  SMKN 1  LHOKNGA
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '60729112' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm1bf1126570cd64faa8', '60729112', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.25  [10113369]  SMKS HIDAYATUL ANAM
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113369' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmc0c4eee841abed68b6', '10113369', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.26  [69947031]  SMK Swasta Muhammadiyah Singkil
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69947031' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm1c4069680dccaa75c4', '69947031', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.27  [10108048]  SMK NEGERI 2 KARANG BARU
-- Input K1-K5: [2.2.1 | 2.2.2 | 2.3.1 | 2.5.2 | 3.1.1]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10108048' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmbe940dd449a6d73efe', '10108048', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm0ebb741367d1f2d635', '10108048', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmc8a6d4db22fab39fa8', '10108048', '2.3.1', 'Teknik Pengelasan', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm937e8dbba1ae636636', '10108048', '2.5.2', 'Teknik Mekatronika', 0, 0, 0, 0, 0, 0, 0, 0, '', 4, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmd3782e76c84d4cec56', '10108048', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 5, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.28  [10110624]  SMK NEGERI 1 BENDAHARA
-- Input K1-K5: [2.2.1 | 7.4.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110624' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm75c65709e8094cdba8', '10110624', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmbd7cc5c0d39bea2ac5', '10110624', '7.4.1', 'Nautika Kapal Niaga', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.29  [69966741]  SMKS Sabilul Ulum
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69966741' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm21739562a074953089', '69966741', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.30  [10107161]  SMKS SYUKRONIYAH
-- Input K1-K5: [2.3.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10107161' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmf396732310f1edef33', '10107161', '2.3.1', 'Teknik Pengelasan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.31  [10107158]  SMKN 1 KARANG BARU
-- Input K1-K5: [4.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10107158' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm65f272f0ea66e6215a', '10107158', '4.1.1', 'Rekayasa Perangkat Lunak', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.32  [10104267]  SMK SWASTA MAIMUN HABSYAH KUALA SIMPANG
-- Input K1-K5: [2.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10104267' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm6b860bc66d0d3645b6', '10104267', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.33  [10108049]  SMK NEGERI 3 KARANG BARU
-- Input K1-K5: [10.7.1 | 9.3.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10108049' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmeacfd8d14019a4f548', '10108049', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmd2c91da5cb3d673193', '10108049', '9.3.1', 'Kuliner', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.34  [70005918]  SMK SWASTA MISRA
-- Input K1-K5: [10.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70005918' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmdc2b0c7b55dc9028d8', '70005918', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.35  [10111334]  SMK NEGERI 2 PEUREULAK
-- Input K1-K5: [2.2.2 | 2.3.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111334' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm64f78d25e810d9c379', '10111334', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm9414f7143b73e60a68', '10111334', '2.3.1', 'Teknik Pengelasan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.36  [10113344]  SMK NEGERI 1 PEUREULAK
-- Input K1-K5: [10.7.1 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113344' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm1e25a70c6da4652a9b', '10113344', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm24bf72f48c439dd9b3', '10113344', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.37  [69946304]  SMK NEGERI 1 INDRA MAKMU
-- Input K1-K5: [2.2.2 | 10.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69946304' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm682bf2b69b17483691', '69946304', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm2546dd14f7b67673a7', '69946304', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.38  [10110606]  SMK NEGERI 1 SIMPANG ULIM
-- Input K1-K5: [2.2.1 | 4.2.1 | 2.2.2 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110606' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm0ff0bf22f7fa9a4bf6', '10110606', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm9babe3a3b6d5f9449f', '10110606', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm64ddc3105d7fd48377', '10110606', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.39  [10113373]  SMK NEGERI 1 PANTE BIDARI
-- Input K1-K5: [10.7.1 | 2.5.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113373' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm34fdadbb1592a9ba05', '10113373', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm4c8cc44f0bde47d3b5', '10113373', '2.5.1', 'Teknik Audio Video', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.40  [10111584]  SMK NEGERI 1 LOKOP
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111584' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm8a3591ba1a56077b2e', '10111584', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.41  [69990050]  SMK NEGERI 1 NURUSSALAM
-- Input K1-K5: [10.7.1 | 3.1.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69990050' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm59b040d6a5fa4c7da5', '69990050', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmbd2ad74c1dac4c22d6', '69990050', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.42  [10112170]  SMK NEGERI 1 JULOK
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10112170' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm94e6d2057099a6195d', '10112170', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.43  [10108210]  SMK NEGERI 1 TANAH JAMBO AYE
-- Input K1-K5: [2.5.1 | 10.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10108210' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm14f7d4184193fb297e', '10108210', '2.5.1', 'Teknik Audio Video', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhma60d43b39af2269453', '10108210', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.44  [10108219]  SMK NEGERI 1 TANAH LUAS
-- Input K1-K5: [2.2.2 | 10.2.1 | 2.3.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10108219' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm4d4617917a5d54c748', '10108219', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhme351b656f7bd88d2fb', '10108219', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm88896d7566e4d64727', '10108219', '2.3.1', 'Teknik Pengelasan', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.45  [69759159]  SMK NEGERI 1 BAKTIYA
-- Input K1-K5: [2.2.2 | 4.1.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69759159' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmd8297fccd2398a4cbe', '69759159', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm9f3c1afac0a14c0347', '69759159', '4.1.1', 'Rekayasa Perangkat Lunak', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.46  [10106278]  SMK NEGERI 1 MUARA BATU
-- Input K1-K5: [2.2.2 | 7.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10106278' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm75916f657d4f1b60de', '10106278', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhme024580ef0062f83c4', '10106278', '7.2.1', 'Nautika Kapal Penangkap Ikan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.47  [10108220]  SMK NEGERI 1 SYAMTALIRA ARON
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10108220' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm12fd30a78ce658f249', '10108220', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.48  [69726919]  SMK SWASTA HUMANIORA
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69726919' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm370b478056f2b64abe', '69726919', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.49  [70035709]  SMK SWASTA ANEUK LAOT
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70035709' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhma467ae87e42463d669', '70035709', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.50  [70036211]  SMK Swasta IT Manahilul Irfan
-- Input K1-K5: [9.3.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70036211' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm1966811b80db557d1a', '70036211', '9.3.1', 'Kuliner', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.51  [70006104]  SMK SWASTA NURUL YAQIN
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70006104' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmc79ea4d09263264fdf', '70006104', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.52  [10108221]  SMKS TERPADU AL AZHAR
-- Input K1-K5: [2.5.1 | 5.1.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10108221' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm555dd0eef6ea7904aa', '10108221', '2.5.1', 'Teknik Audio Video', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm48f4d566586227233f', '10108221', '5.1.1', 'Layanan Penunjang Keperawatan dan Caregiving', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.53  [69988419]  SMK Al Fhattani
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69988419' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmffd074f0ee8c463f9e', '69988419', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.54  [69970964]  SMKS Kafilul Yatim
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69970964' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm7e5c6e696fe073d201', '69970964', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.55  [69972330]  SMKN 5 BENER MERIAH
-- Input K1-K5: [2.2.1 | 6.5.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69972330' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhma22fbda3cf31bbed73', '69972330', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm2fe633ea17a19daa3c', '69972330', '6.5.1', 'Agribisnis Pengolahan Hasil Pertanian', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.56  [10107107]  SMK NEGERI 1 JEUNIEB
-- Input K1-K5: [7.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10107107' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm58a66687b06b0d238f', '10107107', '7.1.1', 'Teknika Kapal Penangkap Ikan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.57  [69945354]  SMK SWASTA AL-HIDAYAH
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69945354' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm541f957e74e0eb1f8b', '69945354', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.58  [10107109]  SMK NEGERI 1 JEUMPA
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10107109' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm741a086545b02defba', '10107109', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.59  [10103755]  SMK Kesehatan Muhammadiyah Bireuen
-- Input K1-K5: [5.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10103755' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmd43b414533f9a529b5', '10103755', '5.1.1', 'Layanan Penunjang Keperawatan dan Caregiving', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.60  [10113428]  SMK-PP NEGERI BIREUEN
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113428' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm7ec8349a815807fb4e', '10113428', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.61  [10104541]  SMK NEGERI 1 GAYO LUES
-- Input K1-K5: [2.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10104541' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm9caf09e9a39d41f025', '10104541', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.62  [10100635]  SMK NEGERI 1 SIGLI
-- Input K1-K5: [10.7.1 | 9.3.1 | 10.2.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10100635' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm2ee06d0bfcfd76936f', '10100635', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmcbe39d3b6acb6c883f', '10100635', '9.3.1', 'Kuliner', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhmf17faa35546c9ba434', '10100635', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.63  [10100633]  SMKS LILAWANGSA SIGLI
-- Input K1-K5: [5.3.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10100633' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm08b5388b801906fe67', '10100633', '5.3.1', 'Layanan Penunjang Kefarmasian Klinis dan Komunitas', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.64  [69753602]  SMK NEGERI MANE
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69753602' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm8a598c61a89f9239c4', '69753602', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.65  [10110275]  SMK NEGERI 3 SIGLI
-- Input K1-K5: [4.2.1 | 10.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110275' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm1a946ee545aefa2f77', '10110275', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhm8671331731f1ca95c7', '10110275', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.66  [10111806]  SMK NEGERI 1 BANDAR DUA
-- Input K1-K5: [2.2.1 | 10.7.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111806' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb2b4469ed1a4d10e15', '10111806', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhndb435bc3457501deac', '10111806', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.67  [10112857]  SMK NEGERI ULIM
-- Input K1-K5: [2.2.2 | 2.2.2 | 6.2.2 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10112857' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn2fc02aec379f01631c', '10112857', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb9e91c0a3866c42070', '10112857', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn882867fc7e0c79f394', '10112857', '6.2.2', 'Agribisnis Ternak Unggas', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.68  [69972006]  SMK BUDI
-- Input K1-K5: [3.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69972006' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhncba1beae4f4086a60b', '69972006', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.69  [10112856]  SMKN TRIENGGADENG
-- Input K1-K5: [2.2.2 | 6.1.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10112856' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn8541fa0cf1d4ffffcf', '10112856', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn84178018c046b1910b', '10112856', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.70  [69950731]  SMK UMMUL AYMAN 2
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69950731' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn41f8c7106f09bf838c', '69950731', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.71  [10112509]  SMK NEGERI 1 SALANG
-- Input K1-K5: [6.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10112509' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn1710cf62a6dd122bfe', '10112509', '6.2.2', 'Agribisnis Ternak Unggas', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.72  [10103348]  SMK Negeri 2 Sinabang
-- Input K1-K5: [2.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10103348' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhncd915ca32982c32277', '10103348', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.73  [10111947]  SMK NEGERI 1 TEUPAH TENGAH
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111947' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn88efbfc1b4c8519d59', '10111947', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.74  [69896252]  SMK NEGERI 1 SIMEULUE CUT
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69896252' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn0480db9dfa17d62016', '69896252', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.75  [10105724]  SMK NEGERI 2 LANGSA
-- Input K1-K5: [2.2.1 | 2.5.3 | 6.2.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105724' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnaa75a0ac6607b57eca', '10105724', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn1ed83e131647fca201', '10105724', '2.5.3', 'Teknik Elektronika Industri', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn47ec03cc54565d3646', '10105724', '6.2.1', 'Agribisnis Ternak Ruminansia', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.76  [10113917]  SMK NEGERI 6 LANGSA
-- Input K1-K5: [5.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10113917' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn3a6b624cee4c7efd07', '10113917', '5.1.1', 'Layanan Penunjang Keperawatan dan Caregiving', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.77  [10107115]  SMK NEGERI 5 LANGSA
-- Input K1-K5: [4.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10107115' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn13559b42c8bde24bfc', '10107115', '4.2.2', 'Teknik Jaringan Akses Telekomunikasi', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.78  [10105628]  SMK NEGERI 4 LHOKSEUMAWE
-- Input K1-K5: [2.2.1 | 3.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105628' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn9c6cbb64471ba53edf', '10105628', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnd71e35ab12d1897f2c', '10105628', '3.2.1', 'Teknik Energi Surya, Hidro, dan Angin', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.79  [10105629]  SMKS KARYA BERINGIN
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105629' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhne3ac890f476a7f2003', '10105629', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.80  [10110714]  SMKN 5 LHOKSEUMAWE
-- Input K1-K5: [1.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110714' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn4c211eb37b18e5fda6', '10110714', '1.1.1', 'Teknik Perawatan Gedung', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.81  [10111838]  SMK NEGERI 7 LHOKSEUMAWE
-- Input K1-K5: [2.2.2 | 2.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111838' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn1a7960a33b3a93308d', '10111838', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn5fae2f738152b84bf3', '10111838', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.82  [10110650]  SMKS ULUMUDDIN
-- Input K1-K5: [10.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110650' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnf7107a8c7129f601e8', '10110650', '10.2.1', 'Desain Komunikasi Visual', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.83  [70003663]  SMK IT Pesantren Tabina Aceh
-- Input K1-K5: [2.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70003663' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn9cd54ed77310a90a38', '70003663', '2.1.2', 'Teknik Mekanik Industri', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.84  [10105704]  SMK N 1 LANGSA
-- Input K1-K5: [8.3.3 | 8.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105704' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn3e54221d6af03858a1', '10105704', '8.3.3', 'Akuntansi', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn059699f500c8b94f1e', '10105704', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.85  [10105625]  SMK NEGERI 1 LHOKSEUMAWE
-- Input K1-K5: [4.2.1 | 4.1.1 | 8.2.1 | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105625' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnce040a4d589ee26908', '10105625', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn831fd804e87e356119', '10105625', '4.1.1', 'Rekayasa Perangkat Lunak', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn098212fb20cd00f906', '10105625', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.86  [10105627]  SMK NEGERI 3 LHOKSEUMAWE
-- Input K1-K5: [8.1.1 | 8.3.3 | 8.2.1 | 8.3.2 | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105627' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn82a7dccd9413b696f1', '10105627', '8.1.1', 'Bisnis Digital', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnfa40dd21eb3ed79586', '10105627', '8.3.3', 'Akuntansi', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn8f64b4e8878291295e', '10105627', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 3, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn9e143058141864511c', '10105627', '8.3.2', 'Layanan Perbankan Syariah', 0, 0, 0, 0, 0, 0, 0, 0, '', 4, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.87  [10105626]  SMK NEGERI 2 LHOKSEUMAWE
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10105626' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn060371b74ab189f6a5', '10105626', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.88  [69758278]  SMKN 8 LHOKSEUMAWE
-- Input K1-K5: [5.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69758278' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhne209e425bb4254ce79', '69758278', '5.2.1', 'Layanan Penunjang Laboratorium Medik', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.89  [10110769]  SMKN 6 Lhokseumawe
-- Input K1-K5: [6.5.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10110769' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn9dce02229acaa11e0b', '10110769', '6.5.2', 'Agribisnis Pengolahan Hasil Perikanan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.90  [10111502]  SMK SWASTA MUHAMMADIYAH LHOKSUKON
-- Input K1-K5: [8.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111502' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnaa3005ce65ee8eea1d', '10111502', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.91  [10112855]  SMKN 1 BANDAR BARU
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10112855' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn9e34340bb2e1391185', '10112855', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.92  [10100617]  SMK SWASTA MUTIARA
-- Input K1-K5: [8.3.3 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10100617' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn5f0882e39e14a18c6e', '10100617', '8.3.3', 'Akuntansi', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.93  [10111935]  SMK NEGERI 1 TEUPAH SELATAN
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111935' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb4d55088ba1e45d2ee', '10111935', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.94  [10103347]  SMK NEGERI 1 SINABANG
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10103347' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb37d0f5c7c97acefae', '10103347', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.95  [69949251]  SMK NEGERI PERIKANAN SIMEULUE BARAT
-- Input K1-K5: [6.3.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69949251' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn6ae22351cedb3cf758', '69949251', '6.3.2', 'Agribisnis Perikanan Payau dan Laut', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.96  [10111684]  SMK Negeri 3 Sinabang
-- Input K1-K5: [6.3.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10111684' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn0d1c39b4f9ef68567a', '10111684', '6.3.2', 'Agribisnis Perikanan Payau dan Laut', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.97  [69754554]  SMKN 1 SIMPANG ALAHAN MATI
-- Input K1-K5: [2.2.2 | 4.2.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69754554' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnd09827d010345d7fe1', '69754554', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhndf6ef740b9517bf855', '69754554', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.98  [10310878]  SMK N 1 RANAH BATAHAN
-- Input K1-K5: [2.3.1 | 2.5.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10310878' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnac76e6b3bc161563a8', '10310878', '2.3.1', 'Teknik Pengelasan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn078aa0a9dcd646878e', '10310878', '2.5.1', 'Teknik Audio Video', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.99  [10306135]  SMK N 1 SASAK RANAH PASISIE
-- Input K1-K5: [6.3.3 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10306135' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn3c30d73d565b14cfcd', '10306135', '6.3.3', 'Agribisnis Perikanan Air Tawar', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn20a12cfcd6ccd12b1a', '10306135', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.100  [10301946]  SMKS TEKNOLOGI LENGAYANG
-- Input K1-K5: [2.2.2 | 3.1.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10301946' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn6d475640e62c7c694b', '10301946', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnfc1b240c083088b158', '10301946', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.101  [10220646]  SMKN 1 TANJUNG PURA
-- Input K1-K5: [2.2.1 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10220646' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb5b7f2e62b2dcb0d2d', '10220646', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn4282c239d7558f0280', '10220646', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.102  [10260493]  SMKN 1 LUMUT
-- Input K1-K5: [2.2.1 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10260493' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn5b1ba195ac2fe8b40d', '10260493', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhne759e9626606700e56', '10260493', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.103  [69953551]  SMK SWASTA TAMAN SISWA PADANG TUALANG
-- Input K1-K5: [2.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69953551' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnf571d8dbcf2370ddd1', '69953551', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.104  [10259372]  SMKS SRI LANGKAT
-- Input K1-K5: [2.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10259372' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhne81eeef0b6f338eede', '10259372', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.105  [10220747]  SMK SWASTA TAMAN SISWA SAWIT SEBERANG
-- Input K1-K5: [2.2.1 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10220747' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn4f570b987fe64c6b12', '10220747', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn6a637e73067975c555', '10220747', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.106  [69727256]  SMK Swasta Imelda Medan
-- Input K1-K5: [2.2.2 | 3.1.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69727256' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhna79a1b8f7c3a6b1883', '69727256', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhncc1897713d9df71fea', '69727256', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.107  [70044057]  SMK Negeri 1 Sukabangun
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '70044057' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn4e9145ea4fef65fcdc', '70044057', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.108  [10211209]  SMK TI SWASTA BUDI AGUNG MEDAN
-- Input K1-K5: [2.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10211209' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnc2315d9fa85b54f456', '10211209', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.109  [10208081]  SMKN 1 BATANG NATAL
-- Input K1-K5: [4.2.1 | 2.5.1 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10208081' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn6f0c2a1051b50afb7d', '10208081', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn551c20a95c863d52c8', '10208081', '2.5.1', 'Teknik Audio Video', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.110  [69956351]  SMK SWASTA TARUNA BANGSA
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69956351' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn7958e6d57a18add2b4', '69956351', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.111  [10220604]  SMKN 1 PAHAE JULU
-- Input K1-K5: [3.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10220604' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn7c0a6ed5822f7dcbaf', '10220604', '3.1.1', 'Teknik Instalasi Tenaga Listrik', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.112  [10201068]  SMK PERSIAPAN PADANG TUALANG
-- Input K1-K5: [2.2.1 | 2.2.2 | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10201068' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn7271be73c2562afa75', '10201068', '2.2.1', 'Teknik Kendaraan Ringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn339db601579e4f7067', '10201068', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 2, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.113  [10259283]  SMKS AL-MA'ARIF
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10259283' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn26171cbb1ba909622d', '10259283', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.114  [10260526]  SMKN 1 BADIRI
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10260526' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn556d31d9fce244a1f2', '10260526', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.115  [69725097]  SMK SWASTA AL HIKMAH
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69725097' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn2a8d8b361713682b40', '69725097', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.116  [10210765]  SMKN 8 MEDAN
-- Input K1-K5: [10.7.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10210765' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn2f7407495bb869e27a', '10210765', '10.7.1', 'Desain dan Produksi Busana', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.117  [10257578]  SMKS AL JAMIYATUL WASHLIYAH
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10257578' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn808860e0a8f4c2cacc', '10257578', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.118  [69956580]  SMK SWASTA AL-MAKSUM YAZID
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69956580' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn87273fe7788aeb4ef9', '69956580', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.119  [10259709]  SMKS MAJU
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10259709' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn053bd0fc8d119473c1', '10259709', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.120  [10206597]  SMKS TI MUHAMMADIYAH 11 SIBULUAN
-- Input K1-K5: [2.2.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10206597' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb7659f527cecc42634', '10206597', '2.2.2', 'Teknik Sepeda Motor', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.121  [10201331]  SMKS HARAPAN BABALAN
-- Input K1-K5: [8.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10201331' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn405d16658ca00979df', '10201331', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.122  [10260514]  SMKS MUHAMMADIYAH 18 P BERANDAN
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10260514' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnb9a1aecac159cbcda5', '10260514', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.123  [10211076]  SMKS YWKA Medan
-- Input K1-K5: [8.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10211076' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhncb911ceddd194c862d', '10211076', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.124  [10260540]  SMK NEGERI 1 TAPIAN NAULI
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10260540' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnf5184bb9f6674ec648', '10260540', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.125  [10208082]  SMKN 1 NATAL
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10208082' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnf52e94b95c678776b8', '10208082', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.126  [10220748]  SMKS YPII TANJUNG PURA
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10220748' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn129f59fb466bb6dd46', '10220748', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.127  [10220618]  SMKN 1 BATANGTORU
-- Input K1-K5: [6.1.2 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10220618' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnf1068e9027558bae10', '10220618', '6.1.2', 'Agribisnis Tanaman Pangan dan Hortikultura', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.128  [60725063]  SMKN 2 BATANG TORU
-- Input K1-K5: [2.2.3 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '60725063' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhne48dd0662fb28f3995', '60725063', '2.2.3', 'Teknik Alat Berat', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.129  [10220208]  SMKN LOSIDA SIATAS BARITA
-- Input K1-K5: [4.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10220208' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhnefc40983bf5aaeb7de', '10220208', '4.2.1', 'Teknik Komputer dan Jaringan', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.130  [10201070]  SMKS PEMBANGUNAN NASIONAL PANGKALAN SUSU
-- Input K1-K5: [8.2.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '10201070' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhncebd344b9372cec597', '10201070', '8.2.1', 'Manajemen Perkantoran', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');
-- ─────────────────────────────────────────────
-- No.131  [69937373]  SMK SWASTA KESEHATAN RACHMAD INSANI
-- Input K1-K5: [5.1.1 | - | - | - | -]
DELETE FROM public.school_profile_concentrations WHERE npsn = '69937373' AND row_order <= 5;
INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES ('mtkanqhn3a1d3cc70807157aa6', '69937373', '5.1.1', 'Layanan Penunjang Keperawatan dan Caregiving', 0, 0, 0, 0, 0, 0, 0, 0, '', 1, '2026-09-02 16:12:04', '2026-09-02 16:12:04');

-- ─────────────────────────────────────────────
-- VALIDASI AKHIR (bisa di-uncomment untuk cek sebelum COMMIT):
-- SELECT COUNT(*) AS total_rekomendasi_import FROM public.school_profile_concentrations WHERE row_order <= 5;
-- SELECT npsn, COUNT(*) FROM public.school_profile_concentrations WHERE row_order <= 5 GROUP BY npsn HAVING COUNT(*) > 5;  -- expect 0 rows
COMMIT;

-- ⚠️  JIKA TERDAPAT MASALAH SETELAH COMMIT, RESTORE DARI BACKUP DULU SEBELUM IMPORT