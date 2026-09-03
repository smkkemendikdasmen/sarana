const { spawn } = require('child_process');
const fs = require('fs');

const bashScript = `#!/bin/bash
set +H
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'
echo '=== T1: PASSWORD COLUMN ==='
psql -X -t -A -c "SELECT a.attname FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='users' AND n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND (a.attname ILIKE '%password%' OR a.attname ILIKE '%hash%' OR a.attname ILIKE '%encrypted%') ORDER BY CASE a.attname WHEN 'password_hash' THEN 0 WHEN 'password' THEN 1 ELSE 2 END LIMIT 1"
echo '=== T1b: CONFIRM ROW EXISTS ==='
psql -X -t -A -c "SELECT id||'|'||username||'|pw_prefix='||left(coalesce(password_hash,password,'NULL'),15) FROM users WHERE username='admin@saranasmk.id' LIMIT 1"
echo '=== T2: GENERATE HASH via apps/api bcryptjs ==='
cd /home/alatprods/saranasmk/apps/api && node -e "const b=require('bcryptjs');const s=b.genSaltSync(10);const h=b.hashSync('admin123',s);console.log('NEW_HASH='+h);console.log('VERIFY='+b.compareSync('admin123',h))"
NEWHASH=$(cd /home/alatprods/saranasmk/apps/api && node -e "const b=require('bcryptjs');console.log(b.hashSync('admin123',b.genSaltSync(10)))")
echo "NEWHASH_LEN=\${#NEWHASH} PREFIX=\${NEWHASH:0:7}"
echo '=== T2b: UPDATE 1 ROW ==='
psql -X -t -A -c "UPDATE users SET password_hash='\$NEWHASH' WHERE username='admin@saranasmk.id' RETURNING 'UPDATED_ID='||id"
echo '=== T2c: VERIFY POST UPDATE ==='
psql -X -t -A -c "SELECT id||'|'||username||'|pw_prefix='||left(password_hash,15) FROM users WHERE username='admin@saranasmk.id' LIMIT 1"
echo '=== T3: CURL TEST USER=admin@saranasmk.id ==='
PAYLOAD='{"username":"admin@saranasmk.id","password":"admin123"}'
echo "PAYLOAD_LEN=\${#PAYLOAD}"
echo '--- DIRECT 4000 ---'
curl -s -o /tmp/_d.log -w "HTTP_DIRECT=%{http_code}\\n" -X POST http://127.0.0.1:4000/v1/auth/login -H "Content-Type: application/json" -d "\$PAYLOAD" --max-time 10
cat /tmp/_d.log | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const t=j.data?.accessToken||j.accessToken||'';console.log('DIRECT_OK='+((j.ok===true||t.length>100)?'YES':'NO')+' TOKEN_LEN='+t.length);if(j.error)console.log('ERR_MSG='+j.error.message)}catch(e){console.log('PARSE_ERR: '+d.slice(0,200))}})"
echo '--- NGINX HTTPS 443 Host=saranasmk.id ---'
curl -sk -o /tmp/_n.log -w "HTTP_NGINX=%{http_code}\\n" -X POST https://127.0.0.1/api/v1/auth/login -H "Host: saranasmk.id" -H "Content-Type: application/json" -d "\$PAYLOAD" --max-time 10
cat /tmp/_n.log | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const t=j.data?.accessToken||j.accessToken||'';console.log('NGINX_OK='+((j.ok===true||t.length>100)?'YES':'NO')+' TOKEN_LEN='+t.length);if(j.error)console.log('NGINX_ERR_MSG='+j.error.message)}catch(e){console.log('NGINX_PARSE_ERR: '+d.slice(0,200))}})"
echo '=== FINAL PM2 SAVE ==='
cd /home/alatprods/saranasmk && pm2 save 2>&1 | tail -3
echo '=== DONE RETURN EXIT CODE ==='
echo 'SUBAGENT_FINISHED=1'
`;

const env = { ...process.env, SSHPASS: 'Direktorat5mk123!@#' };

const args = [
  '-e',
  'ssh',
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'ConnectTimeout=30',
  'alatprods@103.160.202.73',
  'bash -s'
];

console.log('=== Starting SSH via sshpass with spawn ===');
console.log('Script length:', bashScript.length, 'chars');

const child = spawn('sshpass', args, {
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 180000
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const s = data.toString();
  stdout += s;
  process.stdout.write('[STDOUT] ' + s);
});

child.stderr.on('data', (data) => {
  const s = data.toString();
  stderr += s;
  process.stderr.write('[STDERR] ' + s);
});

child.on('close', (code) => {
  console.log('\n\n=== CHILD PROCESS CLOSED ===');
  console.log('Exit code:', code);
  
  const result = 
    'EXIT_CODE: ' + code + '\n\n' +
    '===== FULL STDOUT =====\n' + stdout + '\n\n' +
    '===== FULL STDERR =====\n' + stderr;
  
  try {
    fs.writeFileSync('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/ssh_result.log', result);
    console.log('\nResult saved to: ssh_result.log');
  } catch (e) {
    console.log('Failed to save file:', e.message);
    try {
      fs.writeFileSync('/tmp/ssh_result.log', result);
      console.log('Result saved to /tmp/ssh_result.log instead');
    } catch (e2) {
      console.log('Also failed:', e2.message);
    }
  }
  
  console.log('\n===== FINAL STDOUT SUMMARY =====');
  console.log(stdout);
});

child.on('error', (err) => {
  console.error('SPAWN ERROR:', err.message);
});

child.stdin.write(bashScript);
child.stdin.end();
console.log('Script sent via stdin, waiting for result...');
