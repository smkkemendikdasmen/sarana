import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname);
const OUT_FILE = resolve(OUT_DIR, '_RESULT_RESET_ADMIN.txt');

console.log('[NODE] Script start at:', new Date().toISOString());
console.log('[NODE] __dirname =', __dirname);
console.log('[NODE] OUT_FILE =', OUT_FILE);
console.log('[NODE] process.execPath =', process.execPath);
console.log('[NODE] process.cwd() =', process.cwd());

mkdirSync(OUT_DIR, { recursive: true });

const marker = resolve(OUT_DIR, '_NODE_MARKER_STARTED.txt');
writeFileSync(marker, `STARTED_AT=${new Date().toISOString()}\nPID=${process.pid}\n`);
console.log('[NODE] Marker written:', marker);

function run(args, opts = {}) {
  console.log(`\n[RUN] ${args.join(' ')}`);
  const r = spawnSync(args[0], args.slice(1), {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: opts.timeout || 120000,
    env: { ...process.env, ...(opts.env || {}) },
  });
  console.log(`[RUN] status=${r.status} error=${r.error ? r.error.message : 'null'}`);
  if (r.stdout) console.log(`[RUN STDOUT]\n${r.stdout}`);
  if (r.stderr) console.log(`[RUN STDERR]\n${r.stderr}`);
  return r;
}

const HOST = '103.160.202.73';
const USER = 'alatprods';
const PASS = 'Direktorat5mk123!@#';

const test_ssh = run(['sshpass', '-V']);
const test_ssh2 = run(['which', 'sshpass']);
const test_node = run(['which', 'node']);
const test_bash = run(['which', 'bash']);

console.log('\n=== PRE-FLIGHT DONE ===\n');

const save_out = (label, content) => {
  try {
    writeFileSync(OUT_FILE, `\n========== ${label} ==========\n${content}\n`, { flag: 'a' });
    console.log(`[SAVE] Appended ${label} to ${OUT_FILE}`);
  } catch (e) {
    console.log('[SAVE ERROR]', e.message);
  }
};

writeFileSync(OUT_FILE, `NODE_RESET_ADMIN_START ${new Date().toISOString()}\nPID=${process.pid}\n`);

function remote(cmd, timeout = 120000) {
  const args = [
    '-e',
    'ssh',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'ConnectTimeout=20',
    '-o', 'ServerAliveInterval=20',
    '-o', 'ServerAliveCountMax=5',
    `${USER}@${HOST}`,
    'bash', '-lc', cmd
  ];
  const r = spawnSync('sshpass', args, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    timeout,
    env: { ...process.env, SSHPASS: PASS },
  });
  return {
    status: r.status,
    error: r.error ? r.error.message : null,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    combined: (r.stdout || '') + (r.stderr || ''),
  };
}

console.log('\n====== T1: PASSWORD COLUMN ======');
const t1 = remote(`export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'; psql -X -t -A -c "SELECT a.attname FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='users' AND n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND (a.attname ILIKE '%password%' OR a.attname ILIKE '%hash%' OR a.attname ILIKE '%encrypted%') ORDER BY CASE a.attname WHEN 'password_hash' THEN 0 WHEN 'password' THEN 1 ELSE 2 END LIMIT 1"`);
console.log(t1.combined);
save_out('T1_PASSWORD_COLUMN', t1.combined);

console.log('\n====== T1b: CONFIRM ROW EXISTS ======');
const t1b = remote(`export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'; psql -X -t -A -c "SELECT id||'|'||username||'|pw_prefix='||left(coalesce(password_hash,password,'NULL'),15) FROM users WHERE username='admin@saranasmk.id' LIMIT 1"`);
console.log(t1b.combined);
save_out('T1b_CONFIRM_ROW_EXISTS', t1b.combined);

console.log('\n====== T2: GENERATE HASH via apps/api bcryptjs ======');
const t2 = remote(`cd /home/alatprods/saranasmk/apps/api && node -e "const b=require('bcryptjs');const s=b.genSaltSync(10);const h=b.hashSync('admin123',s);console.log('NEW_HASH='+h);console.log('VERIFY='+b.compareSync('admin123',h))"`);
console.log(t2.combined);
save_out('T2_GENERATE_HASH', t2.combined);

console.log('\n====== T2b + T2c: GET HASH + UPDATE + VERIFY ======');
const t2bc = remote(`
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'
NEWHASH=$(cd /home/alatprods/saranasmk/apps/api && node -e "const b=require('bcryptjs');console.log(b.hashSync('admin123',b.genSaltSync(10)))")
echo "NEWHASH_LEN=\${#NEWHASH} PREFIX=\${NEWHASH:0:7}"
echo "--- T2b UPDATE ROW ---"
psql -X -t -A -c "UPDATE users SET password_hash='\$NEWHASH' WHERE username='admin@saranasmk.id' RETURNING 'UPDATED_ID='||id"
echo "--- T2c VERIFY POST ---"
psql -X -t -A -c "SELECT id||'|'||username||'|pw_prefix='||left(password_hash,15) FROM users WHERE username='admin@saranasmk.id' LIMIT 1"
`, 180000);
console.log(t2bc.combined);
save_out('T2bc_UPDATE_VERIFY', t2bc.combined);

console.log('\n====== T3: CURL TEST LOGIN ======');
const t3 = remote(`
PAYLOAD='{"username":"admin@saranasmk.id","password":"admin123"}'
echo "PAYLOAD_LEN=\${#PAYLOAD}"
echo "--- DIRECT 4000 ---"
curl -s -o /tmp/_d.log -w "HTTP_DIRECT=%{http_code}\n" -X POST http://127.0.0.1:4000/v1/auth/login -H "Content-Type: application/json" -d "\$PAYLOAD" --max-time 10
cat /tmp/_d.log | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const t=j.data?.accessToken||j.accessToken||'';console.log('DIRECT_OK='+((j.ok===true||t.length>100)?'YES':'NO')+' TOKEN_LEN='+t.length);if(j.error)console.log('ERR_MSG='+j.error.message)}catch(e){console.log('PARSE_ERR: '+d.slice(0,200))}})"
echo "--- NGINX HTTPS 443 ---"
curl -sk -o /tmp/_n.log -w "HTTP_NGINX=%{http_code}\n" -X POST https://127.0.0.1/api/v1/auth/login -H "Host: saranasmk.id" -H "Content-Type: application/json" -d "\$PAYLOAD" --max-time 10
cat /tmp/_n.log | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const t=j.data?.accessToken||j.accessToken||'';console.log('NGINX_OK='+((j.ok===true||t.length>100)?'YES':'NO')+' TOKEN_LEN='+t.length);if(j.error)console.log('NGINX_ERR_MSG='+j.error.message)}catch(e){console.log('NGINX_PARSE_ERR: '+d.slice(0,200))}})"
`, 120000);
console.log(t3.combined);
save_out('T3_CURL_TEST', t3.combined);

console.log('\n====== FINAL PM2 SAVE ======');
const tf = remote('cd /home/alatprods/saranasmk && pm2 save 2>&1 | tail -3');
console.log(tf.combined);
save_out('FINAL_PM2_SAVE', tf.combined);

console.log('\n====== DONE ======');
const end_line = `SUBAGENT_FINISHED=1\nFINISHED_AT=${new Date().toISOString()}\n`;
console.log(end_line);
save_out('FINAL_DONE', end_line);

writeFileSync(resolve(OUT_DIR, '_NODE_MARKER_FINISHED.txt'), end_line);
console.log('\n[NODE] All done. Output files:');
console.log('  -', OUT_FILE);
console.log('  -', resolve(OUT_DIR, '_NODE_MARKER_FINISHED.txt'));
process.exit(0);
