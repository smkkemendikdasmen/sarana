BEGIN;

-- ============================================================
-- FASE 8A: EXTENSION btree_gin + GIN INDEX JSONB PATH OPS
-- (Untuk 10MB proposal_tables_json query path CEPAT 14rb sekolah)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- GIN index untuk path operations (jsonb_path_ops = 3x lebih kecil & cepat dari jsonb_ops default)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='workspace_school_proposal_data' AND indexname='idx_wsp_prop_jsonb_path'
  ) THEN
    CREATE INDEX idx_wsp_prop_jsonb_path ON workspace_school_proposal_data USING GIN (proposal_tables_json jsonb_path_ops);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='workspace_school_proposal_data' AND indexname='idx_wsp_rpkp_jsonb_path'
  ) THEN
    CREATE INDEX idx_wsp_rpkp_jsonb_path ON workspace_school_proposal_data USING GIN (rpkp_selections_json jsonb_path_ops);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='workspace_school_equipment_data' AND indexname='idx_wse_equip_jsonb_path'
  ) THEN
    CREATE INDEX idx_wse_equip_jsonb_path ON workspace_school_equipment_data USING GIN (equipment_tables_json jsonb_path_ops);
  END IF;
END $$;

-- ============================================================
-- FASE 8B: HISTORY TABLES AS PARTITION BY RANGE (created_at)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='workspace_school_proposal_data_history') THEN
    EXECUTE $sql$
      CREATE TABLE workspace_school_proposal_data_history (
        id BIGSERIAL,
        operation_type CHAR(1) NOT NULL,
        npsn CHAR(8) NOT NULL,
        old_proposal_tables_json JSONB,
        old_rpkp_selections_json JSONB,
        old_version INT,
        old_data_sha256 VARCHAR(64),
        changed_by_user_id VARCHAR(26),
        changed_by_role VARCHAR(32),
        changed_from_ip VARCHAR(45),
        changed_from_ua TEXT,
        request_id VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, created_at),
        FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE
      ) PARTITION BY RANGE (created_at);

      CREATE TABLE wsp_hist_2025 PARTITION OF workspace_school_proposal_data_history
        FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
      CREATE TABLE wsp_hist_2026 PARTITION OF workspace_school_proposal_data_history
        FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
      CREATE TABLE wsp_hist_2027 PARTITION OF workspace_school_proposal_data_history
        FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
      CREATE TABLE wsp_hist_2028_future PARTITION OF workspace_school_proposal_data_history DEFAULT;

      CREATE INDEX idx_wsp_hist_npsn_created ON workspace_school_proposal_data_history (npsn, created_at DESC);
      CREATE INDEX idx_wsp_hist_user_created ON workspace_school_proposal_data_history (changed_by_user_id, created_at DESC);
    $sql$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='workspace_school_equipment_data_history') THEN
    EXECUTE $sql$
      CREATE TABLE workspace_school_equipment_data_history (
        id BIGSERIAL,
        operation_type CHAR(1) NOT NULL,
        npsn CHAR(8) NOT NULL,
        old_equipment_tables_json JSONB,
        old_version INT,
        old_data_sha256 VARCHAR(64),
        changed_by_user_id VARCHAR(26),
        changed_by_role VARCHAR(32),
        changed_from_ip VARCHAR(45),
        changed_from_ua TEXT,
        request_id VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, created_at),
        FOREIGN KEY (npsn) REFERENCES schools(npsn) ON DELETE CASCADE
      ) PARTITION BY RANGE (created_at);

      CREATE TABLE wse_hist_2025 PARTITION OF workspace_school_equipment_data_history
        FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
      CREATE TABLE wse_hist_2026 PARTITION OF workspace_school_equipment_data_history
        FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
      CREATE TABLE wse_hist_2027 PARTITION OF workspace_school_equipment_data_history
        FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
      CREATE TABLE wse_hist_2028_future PARTITION OF workspace_school_equipment_data_history DEFAULT;

      CREATE INDEX idx_wse_hist_npsn_created ON workspace_school_equipment_data_history (npsn, created_at DESC);
      CREATE INDEX idx_wse_hist_user_created ON workspace_school_equipment_data_history (changed_by_user_id, created_at DESC);
    $sql$;
  END IF;
END $$;

-- ============================================================
-- FASE 13A: PG NOTIFY TRIGGER FUNCTION (RealTime PILLAR 1/3)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_table_change() RETURNS TRIGGER AS $$
DECLARE
  channel TEXT;
  npsn_val TEXT;
  payload JSONB;
BEGIN
  channel := 'tbl_' || TG_TABLE_NAME;
  IF TG_OP = 'DELETE' THEN
    npsn_val := COALESCE(OLD.npsn::TEXT, '');
    payload := jsonb_build_object(
      'op', 'D',
      'npsn', npsn_val,
      'old', to_jsonb(OLD),
      'ts', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
    );
  ELSE
    npsn_val := COALESCE(NEW.npsn::TEXT, '');
    payload := jsonb_build_object(
      'op', CASE TG_OP WHEN 'INSERT' THEN 'I' ELSE 'U' END,
      'npsn', npsn_val,
      'new', to_jsonb(NEW),
      'old', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      'ts', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
    );
  END IF;
  IF pg_column_size(payload) > 7500 THEN
    payload := (payload - 'new' - 'old') || jsonb_build_object('truncated', true);
  END IF;
  PERFORM pg_notify(channel, payload::TEXT);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ============================================================
-- FASE 13B: 12 TRIGGERS AFTER INSERT/UPDATE/DELETE 12 tables
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_schools ON schools;
CREATE TRIGGER trg_notify_schools AFTER INSERT OR UPDATE OR DELETE ON schools
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_users ON users;
CREATE TRIGGER trg_notify_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_wsp ON workspace_school_proposal_data;
CREATE TRIGGER trg_notify_wsp AFTER INSERT OR UPDATE OR DELETE ON workspace_school_proposal_data
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_wse ON workspace_school_equipment_data;
CREATE TRIGGER trg_notify_wse AFTER INSERT OR UPDATE OR DELETE ON workspace_school_equipment_data
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_docadmin ON school_profile_administrative_documents;
CREATE TRIGGER trg_notify_docadmin AFTER INSERT OR UPDATE OR DELETE ON school_profile_administrative_documents
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_conc ON school_profile_concentrations;
CREATE TRIGGER trg_notify_conc AFTER INSERT OR UPDATE OR DELETE ON school_profile_concentrations
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_orgm ON school_profile_organization_members;
CREATE TRIGGER trg_notify_orgm AFTER INSERT OR UPDATE OR DELETE ON school_profile_organization_members
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_interv ON workspace_interview_assessments;
CREATE TRIGGER trg_notify_interv AFTER INSERT OR UPDATE OR DELETE ON workspace_interview_assessments
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_verif ON workspace_verifikasi_online_reviews;
CREATE TRIGGER trg_notify_verif AFTER INSERT OR UPDATE OR DELETE ON workspace_verifikasi_online_reviews
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_assign ON workspace_school_assignments;
CREATE TRIGGER trg_notify_assign AFTER INSERT OR UPDATE OR DELETE ON workspace_school_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_eqitems ON equipment_items;
CREATE TRIGGER trg_notify_eqitems AFTER INSERT OR UPDATE OR DELETE ON equipment_items
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

DROP TRIGGER IF EXISTS trg_notify_eqprop ON equipment_proposals;
CREATE TRIGGER trg_notify_eqprop AFTER INSERT OR UPDATE OR DELETE ON equipment_proposals
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();

COMMIT;
