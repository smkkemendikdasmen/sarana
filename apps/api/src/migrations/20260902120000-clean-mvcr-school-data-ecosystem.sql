-- ============================================================
-- PRISMA FASE 13 · CLEAN MVCR SCHOOL DATA ECOSYSTEM (P1-P3)
-- SSOT: schools.npsn CHAR(8)
-- Target DB: saranasmk_local_latest / saranasmk_production
-- ============================================================
SET client_min_messages TO WARNING;

-- ============================================================
-- P1 · STANDARISASI FK npsn CHAR(8) KE 5 TABEL CHILD (SSOT)
-- Tabel: school_profile_concentrations
--       school_profile_organization_members
--       school_profile_administrative_documents
--       workspace_school_equipment_data
--       workspace_school_proposal_data
-- ============================================================

-- P1a) school_profile_concentrations
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_profile_concentrations' AND column_name='npsn') THEN
        ALTER TABLE school_profile_concentrations ADD COLUMN npsn CHAR(8) NULL;
    END IF;
END $$;
-- Isi kolom npsn dari parent schools via schools.id FK
UPDATE school_profile_concentrations c
SET    npsn = s.npsn
FROM   schools s
WHERE  c.school_id = s.id
  AND  c.npsn IS NULL;
-- Index + FK
CREATE INDEX IF NOT EXISTS idx_spc_npsn ON school_profile_concentrations(npsn);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_spc_npsn_schools' AND table_name='school_profile_concentrations') THEN
        ALTER TABLE school_profile_concentrations ADD CONSTRAINT fk_spc_npsn_schools
            FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE;
    END IF;
END $$;

-- P1b) school_profile_organization_members
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_profile_organization_members' AND column_name='npsn') THEN
        ALTER TABLE school_profile_organization_members ADD COLUMN npsn CHAR(8) NULL;
    END IF;
END $$;
UPDATE school_profile_organization_members o
SET    npsn = s.npsn
FROM   schools s
WHERE  o.school_id = s.id
  AND  o.npsn IS NULL;
CREATE INDEX IF NOT EXISTS idx_spom_npsn ON school_profile_organization_members(npsn);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_spom_npsn_schools' AND table_name='school_profile_organization_members') THEN
        ALTER TABLE school_profile_organization_members ADD CONSTRAINT fk_spom_npsn_schools
            FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE;
    END IF;
END $$;

-- P1c) school_profile_administrative_documents
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_profile_administrative_documents' AND column_name='npsn') THEN
        ALTER TABLE school_profile_administrative_documents ADD COLUMN npsn CHAR(8) NULL;
    END IF;
END $$;
UPDATE school_profile_administrative_documents d
SET    npsn = s.npsn
FROM   schools s
WHERE  d.school_id = s.id
  AND  d.npsn IS NULL;
CREATE INDEX IF NOT EXISTS idx_spad_npsn ON school_profile_administrative_documents(npsn);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_spad_npsn_schools' AND table_name='school_profile_administrative_documents') THEN
        ALTER TABLE school_profile_administrative_documents ADD CONSTRAINT fk_spad_npsn_schools
            FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE;
    END IF;
END $$;

-- P1d) workspace_school_equipment_data
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workspace_school_equipment_data' AND column_name='npsn') THEN
        ALTER TABLE workspace_school_equipment_data ADD COLUMN npsn CHAR(8) NULL;
    END IF;
END $$;
UPDATE workspace_school_equipment_data e
SET    npsn = s.npsn
FROM   schools s
WHERE  e.school_id = s.id
  AND  e.npsn IS NULL;
CREATE INDEX IF NOT EXISTS idx_wsed_npsn ON workspace_school_equipment_data(npsn);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_wsed_npsn_schools' AND table_name='workspace_school_equipment_data') THEN
        ALTER TABLE workspace_school_equipment_data ADD CONSTRAINT fk_wsed_npsn_schools
            FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE;
    END IF;
END $$;

-- P1e) workspace_school_proposal_data
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workspace_school_proposal_data' AND column_name='npsn') THEN
        ALTER TABLE workspace_school_proposal_data ADD COLUMN npsn CHAR(8) NULL;
    END IF;
END $$;
UPDATE workspace_school_proposal_data p
SET    npsn = s.npsn
FROM   schools s
WHERE  p.school_id = s.id
  AND  p.npsn IS NULL;
CREATE INDEX IF NOT EXISTS idx_wspd_npsn ON workspace_school_proposal_data(npsn);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_wspd_npsn_schools' AND table_name='workspace_school_proposal_data') THEN
        ALTER TABLE workspace_school_proposal_data ADD CONSTRAINT fk_wspd_npsn_schools
            FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- P2 · TABEL BARU: school_pagu_budgets
-- Composite PK = (npsn, tahun_ajaran).
-- Hanya ADMIN yang bisa SET pagu; realisasi DI-ENFORCE service calc.
-- ============================================================
CREATE TABLE IF NOT EXISTS school_pagu_budgets (
    npsn                    CHAR(8)         NOT NULL,
    tahun_ajaran            VARCHAR(16)     NOT NULL    DEFAULT '2026/2027',
    pagu_persiapan          BIGINT          NOT NULL    DEFAULT 0
        CONSTRAINT chk_pagu_persiapan_nonneg CHECK (pagu_persiapan >= 0),
    pagu_alat               BIGINT          NOT NULL    DEFAULT 0
        CONSTRAINT chk_pagu_alat_nonneg CHECK (pagu_alat >= 0),
    pagu_pelatihan          BIGINT          NOT NULL    DEFAULT 0
        CONSTRAINT chk_pagu_pelatihan_nonneg CHECK (pagu_pelatihan >= 0),
    pagu_total              BIGINT          NOT NULL    DEFAULT 0,
    realisasi_persiapan     BIGINT          NOT NULL    DEFAULT 0,
    realisasi_alat          BIGINT          NOT NULL    DEFAULT 0,
    realisasi_pelatihan     BIGINT          NOT NULL    DEFAULT 0,
    realisasi_total         BIGINT          NOT NULL    DEFAULT 0,
    status                  VARCHAR(24)     NOT NULL    DEFAULT 'DRAFT'
        CONSTRAINT chk_pagu_status CHECK (status IN ('DRAFT','DITETAPKAN','LOCKED','DIPERPBAHARUI')),
    set_by_admin_id         VARCHAR(64)     NULL,
    set_by_admin_name       VARCHAR(255)    NOT NULL    DEFAULT '',
    set_at                  TIMESTAMP       NULL,
    updated_at              TIMESTAMP       NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_school_pagu_budgets PRIMARY KEY (npsn, tahun_ajaran),
    CONSTRAINT fk_school_pagu_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE,
    CONSTRAINT chk_pagu_total_consistent CHECK (pagu_total = pagu_persiapan + pagu_alat + pagu_pelatihan),
    CONSTRAINT chk_realisasi_total_consistent CHECK (realisasi_total = realisasi_persiapan + realisasi_alat + realisasi_pelatihan)
);
CREATE INDEX IF NOT EXISTS idx_spb_status ON school_pagu_budgets(status);
CREATE INDEX IF NOT EXISTS idx_spb_tahunajaran ON school_pagu_budgets(tahun_ajaran);

-- ============================================================
-- P3 · TABEL BARU: school_data_review_comments
-- SSOT komentar FASILITATOR_ALAT / FASILITATOR_ADMINISTRASI / ADMIN
-- per domain data per record granular.
-- ============================================================
CREATE TABLE IF NOT EXISTS school_data_review_comments (
    comment_id              UUID            NOT NULL    DEFAULT gen_random_uuid(),
    npsn                    CHAR(8)         NOT NULL,
    domain_scope            VARCHAR(32)     NOT NULL
        CONSTRAINT chk_domain_scope CHECK (domain_scope IN (
            '1_INFORMASI','2_DOKUMEN','3_KONSENTRASI','4_ALAT',
            '5_AJUAN_PERSIAPAN','5_AJUAN_SURVEY','5_AJUAN_RPKP',
            '5_AJUAN_PELATIHAN','PAGU','LAINNYA'
        )),
    record_ref              VARCHAR(128)    NULL,
    commenter_role          VARCHAR(32)     NOT NULL
        CONSTRAINT chk_commenter_role CHECK (commenter_role IN (
            'FASILITATOR_ALAT','FASILITATOR_ADMINISTRASI','ADMIN','SUPERADMIN','KOORDINATOR_ALAT'
        )),
    commenter_user_id       VARCHAR(64)     NOT NULL,
    commenter_name          VARCHAR(255)    NOT NULL    DEFAULT '',
    comment_text            TEXT            NOT NULL,
    severity                VARCHAR(20)     NOT NULL    DEFAULT 'INFO'
        CONSTRAINT chk_severity CHECK (severity IN ('INFO','WARNING','WAJIB_PERBAIKI','APPROVE')),
    is_resolved             BOOLEAN         NOT NULL    DEFAULT FALSE,
    resolved_at             TIMESTAMP       NULL,
    resolved_by_user_id     VARCHAR(64)     NULL,
    created_at              TIMESTAMP       NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_school_data_review_comments PRIMARY KEY (comment_id),
    CONSTRAINT fk_sdrc_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sdrc_npsn_domain ON school_data_review_comments(npsn, domain_scope);
CREATE INDEX IF NOT EXISTS idx_sdrc_resolved ON school_data_review_comments(npsn, is_resolved);
CREATE INDEX IF NOT EXISTS idx_sdrc_record_ref ON school_data_review_comments(record_ref) WHERE record_ref IS NOT NULL;

-- ============================================================
-- P3A · MIGRASI: Data comment existing ke tabel terpusat dari:
--   (a) schools.verification_review_notes
--   (b) school_profile_administrative_documents: review_notes
--   (c) workspace_bimtek_reviews: fasil_alat_comment + fasil_admin_comment
-- ============================================================

-- (a) Dari schools → domain 'LAINNYA' severity INFO
INSERT INTO school_data_review_comments
    (npsn, domain_scope, commenter_role, commenter_user_id, commenter_name, comment_text, severity, is_resolved)
SELECT  s.npsn,
        'LAINNYA'::VARCHAR(32),
        'ADMIN'::VARCHAR(32),
        'system-migration',
        'System Migration',
        COALESCE(NULLIF(s.verification_review_notes,''),'Catatan verifikasi umum sebelum migrasi.')::TEXT,
        'INFO'::VARCHAR(20),
        CASE WHEN UPPER(COALESCE(s.verification_status,'')) IN ('TERVERIFIKASI','APPROVED','LULUS','SELESAI') THEN TRUE ELSE FALSE END
FROM    schools s
WHERE   NULLIF(s.verification_review_notes,'') IS NOT NULL
  AND   s.npsn IS NOT NULL
ON CONFLICT DO NOTHING;

-- (b) Dari admin_docs review_notes → domain '2_DOKUMEN' record_ref = document_code
INSERT INTO school_data_review_comments
    (npsn, domain_scope, record_ref, commenter_role, commenter_user_id, commenter_name, comment_text, severity, is_resolved)
SELECT  d.npsn,
        '2_DOKUMEN'::VARCHAR(32),
        d.document_code,
        'ADMIN'::VARCHAR(32),
        'system-migration',
        'System Migration',
        COALESCE(NULLIF(d.review_notes,''),'Review dokumen sebelum migrasi.')::TEXT,
        CASE WHEN UPPER(d.review_status) IN ('DISETUJUI','APPROVED','VALID') THEN 'APPROVE'::VARCHAR(20)
             WHEN UPPER(d.review_status) IN ('PERBAIKI','DITOLAK','REJECTED') THEN 'WAJIB_PERBAIKI'::VARCHAR(20)
             ELSE 'INFO'::VARCHAR(20) END,
        CASE WHEN UPPER(d.review_status) IN ('DISETUJUI','APPROVED','VALID') THEN TRUE ELSE FALSE END
FROM    school_profile_administrative_documents d
WHERE   NULLIF(d.review_notes,'') IS NOT NULL
  AND   d.npsn IS NOT NULL
ON CONFLICT DO NOTHING;

-- (c) Dari workspace_bimtek_reviews fasil_alat_comment
INSERT INTO school_data_review_comments
    (npsn, domain_scope, commenter_role, commenter_user_id, commenter_name, comment_text, severity, is_resolved)
SELECT  b.school_npsn::CHAR(8),
        '4_ALAT'::VARCHAR(32),
        'FASILITATOR_ALAT'::VARCHAR(32),
        COALESCE(b.facilitator_equipment_id, 'system-migration-fa'),
        COALESCE(NULLIF(b.facilitator_equipment_name,''),'Fasilitator Alat (migrasi)'),
        COALESCE(NULLIF(b.fasil_alat_comment,''),'Catatan review fasilitator alat sebelum migrasi.')::TEXT,
        'INFO'::VARCHAR(20),
        FALSE
FROM    workspace_bimtek_reviews b
WHERE   NULLIF(b.fasil_alat_comment,'') IS NOT NULL
  AND   b.school_npsn IS NOT NULL
ON CONFLICT DO NOTHING;

-- (c2) Dari workspace_bimtek_reviews fasil_admin_comment
INSERT INTO school_data_review_comments
    (npsn, domain_scope, commenter_role, commenter_user_id, commenter_name, comment_text, severity, is_resolved)
SELECT  b.school_npsn::CHAR(8),
        '1_INFORMASI'::VARCHAR(32),
        'FASILITATOR_ADMINISTRASI'::VARCHAR(32),
        'system-migration-fadm',
        'Fasilitator Administrasi (migrasi)',
        COALESCE(NULLIF(b.fasil_admin_comment,''),'Catatan review fasilitator administrasi sebelum migrasi.')::TEXT,
        'INFO'::VARCHAR(20),
        FALSE
FROM    workspace_bimtek_reviews b
WHERE   NULLIF(b.fasil_admin_comment,'') IS NOT NULL
  AND   b.school_npsn IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- P2A · SEED: Isi default pagu DRAFT untuk 132 sekolah existing
-- pagu_total = 0 dulu (nanti di SET melalui endpoint ADMIN,
-- service juga akan mengisikan realisasi 3 komponen via query
-- SUM Clean MVCR tables prep / RPKP / training).
-- ============================================================
INSERT INTO school_pagu_budgets
    (npsn, tahun_ajaran, pagu_persiapan, pagu_alat, pagu_pelatihan, pagu_total, status)
SELECT  s.npsn,
        '2026/2027',
        0, 0, 0, 0,
        'DRAFT'::VARCHAR(24)
FROM    schools s
WHERE   s.npsn IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- P2B · CALC REALTIME: Isikan realisasi dari tabel Clean MVCR
-- Realisasi persiapan = SUM(quantity * unit_price) proposal_prep_items
-- Realisasi pelatihan  = SUM(training_cost) WHERE requires_training=TRUE
-- Realisasi alat      = COALESCE(JSONB calc dari rpkp_selections, 0)
--                      (pending RPKP Clean MVCR — seed 0 sementara)
-- ============================================================
WITH prep_realisasi AS (
    SELECT g.npsn,
           COALESCE(SUM(i.quantity * i.unit_price),0) AS rp
    FROM   proposal_preparation_groups g
    LEFT JOIN proposal_preparation_items i ON i.group_id = g.id
    GROUP  BY g.npsn
),
pelatihan_realisasi AS (
    SELECT t.npsn,
           COALESCE(SUM(CASE WHEN t.requires_training=TRUE THEN t.training_cost ELSE 0 END),0) AS rt
    FROM   proposal_training_costs t
    GROUP  BY t.npsn
)
UPDATE school_pagu_budgets p
SET    realisasi_persiapan = COALESCE(pr.rp,0),
       realisasi_pelatihan  = COALESCE(prt.rt,0),
       realisasi_alat       = 0,
       realisasi_total      = COALESCE(pr.rp,0) + COALESCE(prt.rt,0) + 0,
       updated_at           = CURRENT_TIMESTAMP
FROM   schools s
LEFT   JOIN prep_realisasi pr    ON pr.npsn = s.npsn
LEFT   JOIN pelatihan_realisasi prt ON prt.npsn = s.npsn
WHERE  p.npsn = s.npsn
  AND  p.tahun_ajaran = '2026/2027';
