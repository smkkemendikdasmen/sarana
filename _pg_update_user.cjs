const { Client } = require('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/node_modules/pg');
const bcrypt = require('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/node_modules/bcryptjs');
const fs = require('fs');
const envRaw = fs.readFileSync('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/.env', 'utf8');
let DATABASE_URL = null;
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
  if (m) { DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, ''); break; }
}
if (!DATABASE_URL) throw new Error('DATABASE_URL not found in apps/api/.env');

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const NPSN = process.argv[2] || '10105724';
  const email = process.argv[3] || `sekolah_${NPSN}@saranasmk.id`;
  const pw = process.argv[4] || 'sekolah123';
  const pwHash = bcrypt.hashSync(pw, 10);
  console.log(`[update-user] npsn=${NPSN} email=${email} pw=${pw} hash_len=${pwHash.length} prefix=${pwHash.slice(0,12)}`);
  const cmp = bcrypt.compareSync(pw, pwHash);
  console.log(`[update-user] pre-verify bcrypt.compareSync → ${cmp}`);

  let row = null;
  const up = await client.query(
    `UPDATE users SET password_hash = $1, npsn = $2, school_id = $2 WHERE email = $3 RETURNING id, email, password_hash, npsn`,
    [pwHash, NPSN, email]
  );
  if (up.rows.length === 0) {
    const crypto = require('crypto');
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 26);
    const ins = await client.query(
      `INSERT INTO users (id, email, username, password_hash, role, npsn, school_id, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id, email, password_hash, npsn`,
      [id, email, email, pwHash, 'SEKOLAH', NPSN, NPSN]
    );
    row = ins.rows[0];
    console.log(`[update-user] INSERTED id=${row.id} npsn=${row.npsn}`);
  } else {
    row = up.rows[0];
    console.log(`[update-user] UPDATED id=${row.id} npsn=${row.npsn}`);
  }
  const postOk = bcrypt.compareSync(pw, row.password_hash);
  console.log(`[update-user] post-verify stored_hash compare → ${postOk}`);
  await client.end();
  process.exit(postOk ? 0 : 77);
})().catch(e => { console.error('[update-user] FATAL:', e && e.message ? e.message : String(e)); process.exit(1); });
