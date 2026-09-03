BEGIN;

ALTER TABLE schools ALTER COLUMN npsn TYPE CHAR(8) USING lpad(trim(both from npsn)::char(8), 8, '0');
ALTER TABLE schools ALTER COLUMN npsn SET NOT NULL;

ALTER TABLE users ADD COLUMN npsn CHAR(8);
UPDATE users u SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = u.school_id);
ALTER TABLE users ADD CONSTRAINT fk_users_npsn_schools FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE INDEX ix_users_npsn ON users (npsn);

ALTER TABLE workspace_school_proposal_data ADD COLUMN npsn CHAR(8);
UPDATE workspace_school_proposal_data w SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = w.school_id);
ALTER TABLE workspace_school_proposal_data ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE workspace_school_proposal_data ADD CONSTRAINT fk_wsp_npsn_schools FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE UNIQUE INDEX ux_wsp_npsn ON workspace_school_proposal_data (npsn);

ALTER TABLE workspace_school_equipment_data ADD COLUMN npsn CHAR(8);
UPDATE workspace_school_equipment_data w SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = w.school_id);
ALTER TABLE workspace_school_equipment_data ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE workspace_school_equipment_data ADD CONSTRAINT fk_wse_npsn_schools FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE UNIQUE INDEX ux_wse_npsn ON workspace_school_equipment_data (npsn);

ALTER TABLE school_profile_administrative_documents ADD COLUMN npsn CHAR(8);
UPDATE school_profile_administrative_documents d SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = d.school_id);
ALTER TABLE school_profile_administrative_documents ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE school_profile_administrative_documents ADD CONSTRAINT fk_docadmin_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE INDEX ix_docadmin_npsn ON school_profile_administrative_documents (npsn);

ALTER TABLE school_profile_concentrations ADD COLUMN npsn CHAR(8);
UPDATE school_profile_concentrations c SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = c.school_id);
ALTER TABLE school_profile_concentrations ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE school_profile_concentrations ADD CONSTRAINT fk_conc_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE INDEX ix_conc_npsn ON school_profile_concentrations (npsn);

ALTER TABLE school_profile_organization_members ADD COLUMN npsn CHAR(8);
UPDATE school_profile_organization_members m SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = m.school_id);
ALTER TABLE school_profile_organization_members ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE school_profile_organization_members ADD CONSTRAINT fk_orgm_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE INDEX ix_orgm_npsn ON school_profile_organization_members (npsn);

ALTER TABLE workspace_interview_assessments RENAME COLUMN school_npsn TO npsn;
ALTER TABLE workspace_interview_assessments ALTER COLUMN npsn TYPE CHAR(8) USING lpad(trim(both from npsn)::char(8),8,'0');
ALTER TABLE workspace_interview_assessments ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE workspace_interview_assessments ADD CONSTRAINT fk_interview_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE UNIQUE INDEX ux_interview_npsn ON workspace_interview_assessments (npsn);

ALTER TABLE workspace_verifikasi_online_reviews RENAME COLUMN school_npsn TO npsn;
ALTER TABLE workspace_verifikasi_online_reviews ALTER COLUMN npsn TYPE CHAR(8) USING lpad(trim(both from coalesce(npsn,'0'))::char(8),8,'0');
ALTER TABLE workspace_verifikasi_online_reviews ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE workspace_verifikasi_online_reviews ADD CONSTRAINT fk_verif_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE INDEX ix_verif_npsn ON workspace_verifikasi_online_reviews (npsn);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='workspace_bimtek_reviews') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workspace_bimtek_reviews' AND column_name='school_id') THEN
      ALTER TABLE workspace_bimtek_reviews ADD COLUMN npsn CHAR(8);
      UPDATE workspace_bimtek_reviews b SET npsn = (SELECT s.npsn FROM schools s WHERE s.id = b.school_id);
      ALTER TABLE workspace_bimtek_reviews ALTER COLUMN npsn SET NOT NULL;
      ALTER TABLE workspace_bimtek_reviews ADD CONSTRAINT fk_bimtek_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
      CREATE INDEX ix_bimtek_npsn ON workspace_bimtek_reviews (npsn);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workspace_bimtek_reviews' AND column_name='school_npsn') THEN
      ALTER TABLE workspace_bimtek_reviews RENAME COLUMN school_npsn TO npsn;
      ALTER TABLE workspace_bimtek_reviews ALTER COLUMN npsn TYPE CHAR(8) USING lpad(trim(both from coalesce(npsn,'0'))::char(8),8,'0');
      ALTER TABLE workspace_bimtek_reviews ALTER COLUMN npsn SET NOT NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE workspace_school_assignments RENAME COLUMN school_npsn TO npsn;
ALTER TABLE workspace_school_assignments ALTER COLUMN npsn TYPE CHAR(8) USING lpad(trim(both from npsn)::char(8),8,'0');
ALTER TABLE workspace_school_assignments ALTER COLUMN npsn SET NOT NULL;
ALTER TABLE workspace_school_assignments ADD CONSTRAINT fk_assign_npsn FOREIGN KEY (npsn) REFERENCES schools(npsn);
CREATE INDEX ix_assign_npsn ON workspace_school_assignments (npsn);

COMMIT;
