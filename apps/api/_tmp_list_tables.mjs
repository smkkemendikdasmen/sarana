import pg from "pg";
const { Client } = pg;

const DB_URL = "postgresql://saranasmk_app:saranasmkApp123!Prod@127.0.0.1:5432/saranasmk_local_latest";
const c = new Client({ connectionString: DB_URL });
await c.connect();

console.log("=== DAFTAR TABEL DI SCHEMA PUBLIC (pattern relevan):");
const rows = (await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (
  table_name LIKE '%school%' OR table_name LIKE '%profile%' OR table_name LIKE '%workspace%' OR table_name LIKE '%document%' OR table_name LIKE '%concentration%' OR table_name LIKE '%equipment%' OR table_name LIKE '%proposal%' OR table_name LIKE '%schools' OR table_name LIKE '%rpd%' OR table_name LIKE '%records%' OR table_name LIKE '%organization%'
) ORDER BY table_name`)).rows;
for (const r of rows) console.log(`  ${r.table_name}`);

await c.end();
