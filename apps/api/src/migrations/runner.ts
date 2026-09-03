import { Umzug } from 'umzug';
import { Client } from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPgClient(): Promise<Client> {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://saranasmk:saranasmk123@127.0.0.1:5432/saranasmk';
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

interface MigrationContext {
  pgClient: Client;
}

export async function createUmzug() {
  const pgClient = await getPgClient();
  // Storage placeholder (simple memory storage — custom PG storage bisa ditambahkan nanti via PgUmzugStorage)
  const memStore: { [k: string]: boolean } = {};
  const storage = {
    logMigration: async (params: { name: string }) => {
      memStore[params.name] = true;
      try { await pgClient.query(`INSERT INTO system_migrations (name, migrated_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING`, [params.name]); } catch { /* ignore */ }
    },
    unlogMigration: async (params: { name: string }) => {
      delete memStore[params.name];
      try { await pgClient.query(`DELETE FROM system_migrations WHERE name = $1`, [params.name]); } catch { /* ignore */ }
    },
    executed: async () => {
      try {
        const r = await pgClient.query(`SELECT name FROM system_migrations ORDER BY migrated_at`);
        return r.rows.map((x: any) => x.name);
      } catch {
        return Object.keys(memStore).sort();
      }
    },
  };

  return {
    umzug: new Umzug<MigrationContext>({
      context: { pgClient },
      storage,
      migrations: {
        glob: path.join(__dirname, '*.sql').replace(/\\/g, '/'),
        resolve: (params) => {
          const sqlPath = params.path;
          return {
            name: params.name,
            up: async ({ context }) => {
              if (!sqlPath) return;
              const sql = fs.readFileSync(sqlPath, { encoding: 'utf-8' });
              await context.pgClient.query(sql);
            },
            down: async () => {
              // No-op untuk SQL-only migrations (manual rollback via file down.sql terpisah)
            },
          };
        },
      },
      logger: console,
    }),
    pgClient,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'up';
  const { umzug, pgClient } = await createUmzug();

  // Ensure minimal schema untuk PG storage placeholder jika belum ada (tolerant)
  try {
    await pgClient.query(`CREATE TABLE IF NOT EXISTS system_migrations (
      name VARCHAR(255) PRIMARY KEY,
      migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  } catch { /* ignore */ }

  try {
    switch (command) {
      case 'up':
        await umzug.up();
        break;
      case 'down':
        await umzug.down();
        break;
      case 'pending': {
        const pending = await umzug.pending();
        console.log('Pending migrations:', pending.map((m) => m.name));
        break;
      }
      case 'executed': {
        const executed = await umzug.executed();
        console.log('Executed migrations:', executed.map((m) => m.name));
        break;
      }
      case 'create': {
        const nameRaw = args[1] ?? 'migration';
        const safeName = nameRaw.replace(/[^a-zA-Z0-9_-]/g, '_');
        const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
        const filename = `${ts}-${safeName}.sql`;
        const fullPath = path.join(__dirname, filename);
        fs.writeFileSync(fullPath, `-- Migration: ${safeName}\n-- Generated: ${new Date().toISOString()}\nBEGIN;\n\n-- TODO: write migration SQL here\n\nCOMMIT;\n`);
        console.log('Created migration:', fullPath);
        break;
      }
      default:
        console.error(`Unknown command: ${command}. Use up|down|pending|executed|create [name]`);
        process.exit(1);
    }
  } finally {
    try { await pgClient.end(); } catch { /* ignore */ }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
