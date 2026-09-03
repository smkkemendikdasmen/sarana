BEGIN;

-- =========================================================
-- PostgreSQL RLS ENABLE on 9 core tenant tables
-- Role-based bypass:
--   A) ROLE_SCHOOL: SET app.current_npsn = 'XXXX' via CLS. Policy npsn strict.
--   B) ROLE_FASIL_ADM/ALAT: SET app.current_role & app.current_npsn_scope via assignment
--   C) ROLE_ADMIN/SUPERADMIN: BYPASSRLS di app layer (superuser saranasmk default bypass)
-- =========================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_school_proposal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_school_equipment_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_profile_administrative_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_profile_concentrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_profile_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_interview_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_verifikasi_online_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_school_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_proposals ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- HELPER: current_npsn_char8 function
-- =========================================================
CREATE OR REPLACE FUNCTION public.app_npsn() RETURNS CHAR(8) AS $$
  SELECT NULLIF(current_setting('app.current_npsn', true), '')::CHAR(8);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.app_has_role(want TEXT) RETURNS BOOLEAN AS $$
  SELECT coalesce(current_setting('app.current_role', true), '') = want
      OR coalesce(current_setting('app.current_role', true), '') IN ('SUPERADMIN','ADMIN');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.app_is_cross_role() RETURNS BOOLEAN AS $$
  SELECT coalesce(current_setting('app.current_role', true), '') IN ('FASILITATOR_ADMINISTRASI','FASILITATOR_ALAT','KOORDINATOR_ALAT','PPK','ADMIN','SUPERADMIN');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.app_npsn_in_assignment() RETURNS BOOLEAN AS $$
  -- true IF (SET app.current_npsn) = assignment.npsn for current_userid (set app.current_user_id)
  SELECT EXISTS (
    SELECT 1 FROM workspace_school_assignments a
    WHERE a.npsn = app_npsn()
      AND (
        a.facilitator_administration_id::text = current_setting('app.current_user_id', true)
        OR a.facilitator_equipment_id::text = current_setting('app.current_user_id', true)
      )
  ) OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =========================================================
-- POLICY: SCHOOLS (12 NPSN)
--   - Role SEKOLAH: HANYA schools.npsn = app.current_npsn
--   - Cross role: schools.npsn DALAM assignment user / ALL jika ADMIN
-- =========================================================
CREATE POLICY p_schools_self ON schools
  FOR ALL
  TO PUBLIC
  USING (
    (NOT app_is_cross_role() AND npsn = app_npsn())
    OR (app_is_cross_role() AND (app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment()))
  )
  WITH CHECK (
    (NOT app_is_cross_role() AND npsn = app_npsn())
    OR (app_is_cross_role() AND (app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment()))
  );

-- =========================================================
-- POLICY: USERS
--   - Sekolah: users.npsn = app.current_npsn (lihat dirinya & timnya sendiri)
--   - Fasil/Admin: jika punya assignment atau ADMIN
-- =========================================================
CREATE POLICY p_users_self ON users
  FOR ALL
  TO PUBLIC
  USING (
    (NOT app_is_cross_role() AND npsn = app_npsn())
    OR (app_is_cross_role() AND (app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR (npsn IS NOT NULL AND app_npsn_in_assignment() AND npsn = app_npsn())))
    OR id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    (NOT app_is_cross_role() AND npsn = app_npsn())
    OR (app_is_cross_role() AND (app_has_role('ADMIN') OR app_has_role('SUPERADMIN')))
  );

-- =========================================================
-- POLICY: PROPOSAL (SUPER KRITIS - mencegah cross-school edit/lihat 10MB JSONB)
-- =========================================================
CREATE POLICY p_wsp_tenant ON workspace_school_proposal_data
  FOR ALL
  TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_wse_tenant ON workspace_school_equipment_data
  FOR ALL
  TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_docadmin_tenant ON school_profile_administrative_documents
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_conc_tenant ON school_profile_concentrations
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_orgm_tenant ON school_profile_organization_members
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_interview_tenant ON workspace_interview_assessments
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_verif_tenant ON workspace_verifikasi_online_reviews
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_assign_tenant ON workspace_school_assignments
  FOR ALL TO PUBLIC
  USING (
    npsn = app_npsn()
    OR facilitator_administration_id::text = current_setting('app.current_user_id', true)
    OR facilitator_equipment_id::text = current_setting('app.current_user_id', true)
    OR app_has_role('ADMIN')
    OR app_has_role('SUPERADMIN')
  )
  WITH CHECK (
    npsn = app_npsn()
    OR facilitator_administration_id::text = current_setting('app.current_user_id', true)
    OR facilitator_equipment_id::text = current_setting('app.current_user_id', true)
    OR app_has_role('ADMIN')
    OR app_has_role('SUPERADMIN')
  );

CREATE POLICY p_eqitems_tenant ON equipment_items
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

CREATE POLICY p_eqproposals_tenant ON equipment_proposals
  FOR ALL TO PUBLIC
  USING (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment())
  WITH CHECK (npsn = app_npsn() OR app_has_role('ADMIN') OR app_has_role('SUPERADMIN') OR app_npsn_in_assignment());

COMMIT;
