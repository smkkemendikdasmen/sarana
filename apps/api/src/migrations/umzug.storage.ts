import type { UmzugStorage } from 'umzug';
import { Client } from 'pg';

const MIGRATIONS_TABLE = 'system_migrations';
const META_TABLE = 'system_version_log';

export class PgUmzugStorage implements UmzugStorage {
  constructor(private readonly pgClient: Client) {}

  async logMigration({ name: migrationName }: { name: string }): Promise<void> {
    await this.ensureTables();
    await this.pgClient.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES ($1, NOW()) ON CONFLICT (name) DO NOTHING`,
      [migrationName],
    );
  }

  async unlogMigration({ name: migrationName }: { name: string }): Promise<void> {
    await this.ensureTables();
    await this.pgClient.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [migrationName]);
  }

  async executed(): Promise<string[]> {
    await this.ensureTables();
    const result = await this.pgClient.query<{ name: string }>(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`,
    );
    return result.rows.map((r) => r.name);
  }

  private async ensureTables(): Promise<void> {
    await this.pgClient.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pgClient.query(`
      CREATE TABLE IF NOT EXISTS ${META_TABLE} (
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
    `);
    await this.pgClient.query(`CREATE INDEX IF NOT EXISTS idx_${META_TABLE}_version ON ${META_TABLE}(version)`);
    await this.pgClient.query(`CREATE INDEX IF NOT EXISTS idx_${META_TABLE}_deployed_at ON ${META_TABLE}(deployed_at)`);
    await this.pgClient.query(`CREATE INDEX IF NOT EXISTS idx_${META_TABLE}_environment ON ${META_TABLE}(environment)`);
  }
}
