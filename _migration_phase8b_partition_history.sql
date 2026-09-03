BEGIN;

DROP TABLE IF EXISTS workspace_school_proposal_data_history CASCADE;
DROP TABLE IF EXISTS workspace_school_equipment_data_history CASCADE;

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

COMMIT;
