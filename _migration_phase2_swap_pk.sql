BEGIN;

-- =========================================================
-- STEP 1: DROP SEMUA OLD FOREIGN KEY yang mereferensikan schools.id via school_id
--         (sudah ada FK baru ke npsn dari Fase 1, jadi aman delete yang lama)
-- =========================================================
ALTER TABLE equipment_items DROP CONSTRAINT IF EXISTS fk_equipment_school;
ALTER TABLE equipment_proposals DROP CONSTRAINT IF EXISTS fk_proposals_school;
ALTER TABLE school_profile_administrative_documents DROP CONSTRAINT IF EXISTS fk_school_profile_administrative_documents_school;
ALTER TABLE school_profile_concentrations DROP CONSTRAINT IF EXISTS fk_school_profile_concentrations_school;
ALTER TABLE school_profile_organization_members DROP CONSTRAINT IF EXISTS fk_school_profile_organization_members_school;
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_school;
ALTER TABLE workspace_school_equipment_data DROP CONSTRAINT IF EXISTS fk_workspace_school_equipment_school;
ALTER TABLE workspace_school_proposal_data DROP CONSTRAINT IF EXISTS fk_workspace_school_proposal_school;

-- =========================================================
-- STEP 2: DROP KOLOM school_id (UUID/CHAR26) YANG SUDAH TIDAK DIPAKAI (kecuali tabel yang TIDAK PUNYA kolom npsn)
--         PERIKSA per tabel: mana saja yang masih punya school_id (karena Fase 1 hanya tambah npsn)
-- =========================================================
-- users: ada school_id, pindah ke npsn → drop
ALTER TABLE users DROP COLUMN IF EXISTS school_id;

-- proposal: ada school_id, pindah npsn (PK baru) → drop
ALTER TABLE workspace_school_proposal_data DROP COLUMN IF EXISTS school_id;

-- equipment: ada school_id → drop
ALTER TABLE workspace_school_equipment_data DROP COLUMN IF EXISTS school_id;

-- docadmin: ada school_id → drop
ALTER TABLE school_profile_administrative_documents DROP COLUMN IF EXISTS school_id;

-- concentrations: ada school_id → drop
ALTER TABLE school_profile_concentrations DROP COLUMN IF EXISTS school_id;

-- organization members: ada school_id → drop
ALTER TABLE school_profile_organization_members DROP COLUMN IF EXISTS school_id;

-- equipment_items + equipment_proposals: PUNYA school_id tapi FASE 1 TIDAK TAMBAH npsn → tambahkan + backfill dulu
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_items' AND column_name='school_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_items' AND column_name='npsn') THEN
      ALTER TABLE equipment_items ADD COLUMN npsn CHAR(8);
      UPDATE equipment_items e SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = e.school_id);
      ALTER TABLE equipment_items ALTER COLUMN npsn SET NOT NULL;
      ALTER TABLE equipment_items ADD CONSTRAINT fk_eqitems_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
      CREATE INDEX ix_eqitems_npsn ON equipment_items (npsn);
    END IF;
    ALTER TABLE equipment_items DROP COLUMN IF EXISTS school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_proposals' AND column_name='school_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_proposals' AND column_name='npsn') THEN
      ALTER TABLE equipment_proposals ADD COLUMN npsn CHAR(8);
      UPDATE equipment_proposals e SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = e.school_id);
      ALTER TABLE equipment_proposals ALTER COLUMN npsn SET NOT NULL;
      ALTER TABLE equipment_proposals ADD CONSTRAINT fk_eqproposals_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
      CREATE INDEX ix_eqproposals_npsn ON equipment_proposals (npsn);
    END IF;
    ALTER TABLE equipment_proposals DROP COLUMN IF EXISTS school_id;
  END IF;
END $$;

-- =========================================================
-- STEP 3: GANTI PRIMARY KEY schools: DROP PK lama (id CHAR26) → ADD PK baru (npsn CHAR8)
--         DROP KOLOM schools.id SETELAH PK diganti
-- =========================================================
ALTER TABLE schools DROP CONSTRAINT IF EXISTS idx_16871_primary CASCADE;  -- DROP PK schools.id
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_pkey CASCADE;       -- fallback nama lain
ALTER TABLE schools ADD PRIMARY KEY (npsn);
ALTER TABLE schools DROP COLUMN IF EXISTS id;  -- HAPUS kolom UUID/CHAR26 id schools

-- =========================================================
-- STEP 4: PK proposal_data dan equipment_data + interview
--         (Dulu PK = school_id CHAR26, sekarang ganti PK = npsn CHAR8)
-- =========================================================
-- WORKSPACE_SCHOOL_PROPOSAL_DATA
ALTER TABLE workspace_school_proposal_data DROP CONSTRAINT IF EXISTS workspace_school_proposal_data_pkey CASCADE;
ALTER TABLE workspace_school_proposal_data DROP CONSTRAINT IF EXISTS idx_17031_primary CASCADE;
ALTER TABLE workspace_school_proposal_data ADD PRIMARY KEY (npsn);

-- WORKSPACE_SCHOOL_EQUIPMENT_DATA
ALTER TABLE workspace_school_equipment_data DROP CONSTRAINT IF EXISTS workspace_school_equipment_data_pkey CASCADE;
ALTER TABLE workspace_school_equipment_data DROP CONSTRAINT IF EXISTS idx_16996_primary CASCADE;
ALTER TABLE workspace_school_equipment_data ADD PRIMARY KEY (npsn);

-- WORKSPACE_INTERVIEW_ASSESSMENTS (PK lama = id CHAR26, tapi UNIQUE npsn)
-- PK tetap = id (karena assignment_key + interview beberapa putaran?), atau ganti composite?
-- Kita TETAPKAN PK = id (as is), TAPI tambah UNIQUE (npsn) for consistency.
-- (Jika di FASE 13 butuh composite, nanti tinggal alter. Saat ini tetap id.)

-- =========================================================
-- STEP 5: RE-CREATE FOREIGN KEY yang DICASCADE TERHAPUS saat DROP idx_16871_primary (PK schools.id)
--         (karena CASCADE → FK fk_eqitems_npsn dll yang referensikan schools.id MUNGKIN hilang)
--         Kita ensure ulang FK ke schools.npsn
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_wsp_npsn_schools') THEN
    ALTER TABLE workspace_school_proposal_data ADD CONSTRAINT fk_wsp_npsn_schools FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_wse_npsn_schools') THEN
    ALTER TABLE workspace_school_equipment_data ADD CONSTRAINT fk_wse_npsn_schools FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_docadmin_npsn') THEN
    ALTER TABLE school_profile_administrative_documents ADD CONSTRAINT fk_docadmin_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_conc_npsn') THEN
    ALTER TABLE school_profile_concentrations ADD CONSTRAINT fk_conc_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_orgm_npsn') THEN
    ALTER TABLE school_profile_organization_members ADD CONSTRAINT fk_orgm_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_users_npsn_schools') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_npsn_schools FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_interview_npsn') THEN
    ALTER TABLE workspace_interview_assessments ADD CONSTRAINT fk_interview_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_verif_npsn') THEN
    ALTER TABLE workspace_verifikasi_online_reviews ADD CONSTRAINT fk_verif_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_assign_npsn') THEN
    ALTER TABLE workspace_school_assignments ADD CONSTRAINT fk_assign_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_eqitems_npsn') THEN
    ALTER TABLE equipment_items ADD CONSTRAINT fk_eqitems_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_eqproposals_npsn') THEN
    ALTER TABLE equipment_proposals ADD CONSTRAINT fk_eqproposals_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
  END IF;
END $$;

COMMIT;
