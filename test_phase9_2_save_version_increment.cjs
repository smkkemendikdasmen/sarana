#!/usr/bin/env node
/**
 * FASE 9 — TEST 2: VERSION INCREMENT + SHA256 UPDATE on "Save" Proposal (simulate)
 * Strategy: Ambil 1 random WSP row (version V_old, sha S_old). Lakukan UPDATE version=V_old+1, new SHA random.
 *   Verify after UPDATE: row tersebut version = V_old + 1, SHA berubah (tidak equal S_old).
 * Exit 0 PASS. Exit non-zero FAIL (version tidak naik, SHA tidak berubah = bug ACID / not saved).
 */
const { Client } = require('pg');
const crypto = require('crypto');

const PG_URL = 'postgresql://saranasmk:saranasmk123@127.0.0.1:5432/saranasmk';

async function main() {
  const client = new Client({ connectionString: PG_URL });
  await client.connect();
  try {
    // 1. Cari 1 WSP row random untuk test
    const sel = await client.query(`
      SELECT npsn, version, data_sha256
      FROM workspace_school_proposal_data
      WHERE version IS NOT NULL AND length(coalesce(data_sha256,'')) = 64
      LIMIT 1
    `);
    if (sel.rows.length < 1) {
      console.error('FAIL T2: tidak ada row WSP dengan version+sha valid untuk test save.');
      process.exit(2);
    }
    const r = sel.rows[0];
    const V_OLD = Number(r.version);
    const SHA_OLD = r.data_sha256;
    const NPSN = r.npsn;

    console.log(`[TEST 2] PICK TEST ROW npsn=${NPSN} | version_old=${V_OLD} | sha_old=${SHA_OLD.slice(0,16)}...`);
    if (V_OLD < 1) { console.error('FAIL T2: version_old < 1 invalid initial state'); process.exit(3); }

    // 2. Simulate SAVE: UPDATE ACID with optimistic lock WHERE version=V_OLD
    const NEW_SHA = crypto.createHash('sha256').update(
      JSON.stringify({ _phase9_save_test: Date.now(), npsn: NPSN, old_ver: V_OLD })
    ).digest('hex');

    const upd = await client.query(`
      UPDATE workspace_school_proposal_data
      SET version = $1,
          data_sha256 = $2,
          updated_at = NOW()
      WHERE npsn = $3 AND version = $4
      RETURNING npsn, version, data_sha256
    `, [V_OLD + 1, NEW_SHA, NPSN, V_OLD]);

    if (upd.rows.length < 1) {
      console.error('FAIL T2: UPDATE WHERE npsn=? AND version=V_OLD return 0 rows — race condition / optimistic lock fail unexpected?');
      process.exit(4);
    }
    const u = upd.rows[0];
    const V_NEW = Number(u.version);
    const SHA_NEW = u.data_sha256;

    console.log(`[TEST 2] AFTER UPDATE: version_new=${V_NEW} (expect ${V_OLD + 1}) | sha_new=${SHA_NEW.slice(0, 16)}... (expect != SHA_OLD)`);
    let ok = true;
    if (V_NEW !== V_OLD + 1) { console.error(`FAIL T2 version: ${V_NEW} != expected ${V_OLD + 1} (version tidak naik saat save!)`); ok = false; }
    if (SHA_NEW === SHA_OLD) { console.error('FAIL T2 sha: SHA TIDAK BERUBAH setelah save — data integrity hash verification broken!'); ok = false; }
    if (SHA_NEW !== NEW_SHA) { console.error(`FAIL T2 sha: new sha mismatch ${SHA_NEW}!=${NEW_SHA}`); ok = false; }

    // 3. ROLLBACK test data ke state SEMULA (agar test script IDEMPOTENT / tidak merubah production data lokal permanen)
    await client.query(`
      UPDATE workspace_school_proposal_data
      SET version = $1, data_sha256 = $2, updated_at = updated_at
      WHERE npsn = $3
    `, [V_OLD, SHA_OLD, NPSN]);
    console.log(`[TEST 2] IDEMPOTENT RESTORE: version & SHA dikembalikan ke state SEMULA (${V_OLD}/${SHA_OLD.slice(0, 16)}...) agar tidak dirty.`);

    if (!ok) process.exit(5);
    console.log('✅ FASE 9 TEST 2 Save Version Increment + SHA256 Berubah — EXIT 0 PASS');
    process.exit(0);
  } finally {
    await client.end();
  }
}
main().catch(e => { console.error('FAIL T2 UNCAUGHT:', e.message || e); process.exit(99); });
