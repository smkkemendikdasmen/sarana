-- Placeholder initial migration: table creation already handled by PgUmzugStorage#ensureTables
-- Future migrations should use idempotent SQL blocks (CREATE TABLE IF NOT EXISTS, etc.)

DO $$ BEGIN
  RAISE NOTICE 'Migration 20260831000100-init-system-version-log ran successfully';
END $$;
