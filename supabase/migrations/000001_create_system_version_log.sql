CREATE TABLE IF NOT EXISTS system_version_log (
  id BIGSERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  tag_name VARCHAR(100),
  commit_hash VARCHAR(100),
  changelog TEXT,
  release_notes TEXT,
  environment VARCHAR(50) DEFAULT 'production',
  deployed_by VARCHAR(100) DEFAULT 'system',
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'success',
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_version_log_version ON system_version_log(version);
CREATE INDEX IF NOT EXISTS idx_system_version_log_deployed_at ON system_version_log(deployed_at);
CREATE INDEX IF NOT EXISTS idx_system_version_log_environment ON system_version_log(environment);
