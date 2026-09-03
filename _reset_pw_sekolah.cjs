const { Client } = require('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/node_modules/pg');
const bcrypt = require('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/node_modules/bcryptjs');
const fs = require('fs');
const envRaw = fs.readFileSync('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/.env', 'utf8');
let DATABASE_URL = null;
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
  if (m) { DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, ''); break; }
}
if (!DATABASE_URL) throw new Error('DATABASE_URL not found');

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const userId = process.argv[2] || '19fe939a5c3b4f13ce6cefbaaa';
  const pw = process.argv[3] || 'sekolah123';
  const pwHash = bcrypt.hashSync(pw, 10);
  console.log(`[reset-pw] user_id=${userId} pw=${pw} hash len=${pwHash.length} prefix=${pwHash.slice(0,12)}`);
  console.log(`[reset-pw] pre-verify compare → ${bcrypt.compareSync(pw, pwHash)}`);
  const up = await client.query(
    `UPDATE users SET password_hash = $1, password_current_plaintext = $2 WHERE id = $3 RETURNING id, username, email, password_hash`,
    [pwHash, pw, userId]
  );
  const row = up.rows[0];
  const ok = bcrypt.compareSync(pw, row.password_hash);
  console.log(`[reset-pw] POST-verify stored compare → ${ok}`);
  console.log(`[reset-pw] username_login="${row.username}"  email_login="${row.email}"  pw="${pw}"`);
  await client.end();
  process.exit(ok ? 0 : 77);
})().catch(e => { console.error('FATAL', e && e.message ? e.message : String(e)); process.exit(1); });
