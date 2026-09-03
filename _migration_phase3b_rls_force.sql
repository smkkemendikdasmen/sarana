BEGIN;

-- KARENA user saranasmk adalah SUPERUSER (BYPASSRLS default), kita FORCE RLS diterapkan WALAU SUPERUSER
-- Ini PENTING: Developer sering salah mengira RLS bekerja — padahal SUPERUSER = BYPASS.

ALTER TABLE schools FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_school_proposal_data FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_school_equipment_data FORCE ROW LEVEL SECURITY;
ALTER TABLE school_profile_administrative_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE school_profile_concentrations FORCE ROW LEVEL SECURITY;
ALTER TABLE school_profile_organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_interview_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_verifikasi_online_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_school_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE equipment_items FORCE ROW LEVEL SECURITY;
ALTER TABLE equipment_proposals FORCE ROW LEVEL SECURITY;

-- Opsional: Buat user BARU saranasmk_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
-- (Untuk koneksi production NestJS, pakai user ini BUKAN saranasmk superuser)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_user WHERE usename = 'saranasmk_app') THEN
    CREATE ROLE saranasmk_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'saranasmkApp123!Prod';
  END IF;
END $$;
GRANT CONNECT ON DATABASE saranasmk TO saranasmk_app;
GRANT USAGE ON SCHEMA public TO saranasmk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO saranasmk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO saranasmk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO saranasmk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO saranasmk_app;

COMMIT;
