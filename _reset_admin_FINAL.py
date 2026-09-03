#!/usr/bin/env python3
import os, sys, subprocess, time
from datetime import datetime
from pathlib import Path

HOST = "103.160.202.73"
USER = "alatprods"
PASS = "Direktorat5mk123!@#"

OUTPUT_LOCAL = Path("/tmp/reset_admin_final.txt")
BACKUP_LOCAL = Path("/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_reset_admin_FINAL.txt")

BUF = []
def log(s=""):
    print(s, flush=True)
    BUF.append(s)

def save():
    content = "\n".join(BUF) + "\n"
    try:
        OUTPUT_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SAVE] OK -> {OUTPUT_LOCAL} ({len(content)} chars, {content.count(chr(10))} lines)", file=sys.stderr)
    except Exception as e:
        print(f"[SAVE] FAIL /tmp: {e}", file=sys.stderr)
    try:
        BACKUP_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(BACKUP_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SAVE] OK -> {BACKUP_LOCAL}", file=sys.stderr)
    except Exception as e:
        print(f"[SAVE] FAIL backup: {e}", file=sys.stderr)

def ssh(cmd, timeout=600):
    env = {**os.environ, "SSHPASS": PASS}
    proc = subprocess.Popen(
        ["sshpass", "-e", "ssh", "-o", "StrictHostKeyChecking=no",
         "-o", "UserKnownHostsFile=/dev/null", "-o", "ConnectTimeout=30",
         "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=10",
         "-o", "BatchMode=no", "-p", "22",
         f"{USER}@{HOST}", "bash", "-lc", cmd],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        try: out, err = proc.communicate(timeout=5)
        except: out, err = "", "KILLED_AFTER_TIMEOUT"
        return proc.returncode or -1, out, err + "\n***TIMEOUT***"
    return proc.returncode, out, err

log("=" * 78)
log(f"RESET ADMIN PASSWORD admin@saranasmk.id — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"Target: {USER}@{HOST}")
log("=" * 78)
log()
save()

log("=== T1: PASSWORD COLUMN ===")
rc, out, err = ssh(r"""export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'; psql -X -t -A -c "SELECT a.attname FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='users' AND n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND (a.attname ILIKE '%password%' OR a.attname ILIKE '%hash%' OR a.attname ILIKE '%encrypted%') ORDER BY CASE a.attname WHEN 'password_hash' THEN 0 WHEN 'password' THEN 1 ELSE 2 END LIMIT 1" """)
for line in (out + err).splitlines():
    log(line)
save()

log("")
log("=== T1b: CONFIRM ROW EXISTS ===")
rc, out, err = ssh(r"""export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'; psql -X -t -A -c "SELECT id||'|'||username||'|pw_prefix='||left(coalesce(password_hash,password,'NULL'),15) FROM users WHERE username='admin@saranasmk.id' LIMIT 1" """)
for line in (out + err).splitlines():
    log(line)
save()

log("")
log("=== T2: GENERATE HASH via apps/api bcryptjs ===")
rc, out, err = ssh(r"""cd /home/alatprods/saranasmk/apps/api && node -e "const b=require('bcryptjs');const s=b.genSaltSync(10);const h=b.hashSync('admin123',s);console.log('NEW_HASH='+h);console.log('VERIFY='+b.compareSync('admin123',h))" """)
for line in (out + err).splitlines():
    log(line)
save()

log("")
log("=== T2b: DAPATKAN HASH + UPDATE + VERIFY ===")
rc, out, err = ssh(r"""
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=saranasmk_production PGUSER=saranasmk_app PGPASSWORD='saranasmkApp123!Prod'
NEWHASH=$(cd /home/alatprods/saranasmk/apps/api && node -e "const b=require('bcryptjs');console.log(b.hashSync('admin123',b.genSaltSync(10)))")
echo "NEWHASH_LEN=${#NEWHASH} PREFIX=${NEWHASH:0:7}"
echo "=== T2b-UPDATE: ==="
psql -X -t -A -c "UPDATE users SET password_hash='$NEWHASH' WHERE username='admin@saranasmk.id' RETURNING 'UPDATED_ID='||id"
echo "=== T2c-VERIFY POST UPDATE: ==="
psql -X -t -A -c "SELECT id||'|'||username||'|pw_prefix='||left(password_hash,15) FROM users WHERE username='admin@saranasmk.id' LIMIT 1"
""")
for line in (out + err).splitlines():
    log(line)
save()

log("")
log("=== T3: CURL TEST USER=admin@saranasmk.id ===")
rc, out, err = ssh(r"""
PAYLOAD='{"username":"admin@saranasmk.id","password":"admin123"}'
echo "PAYLOAD_LEN=${#PAYLOAD}"
echo "--- DIRECT 4000 ---"
curl -s -o /tmp/_d.log -w "HTTP_DIRECT=%{http_code}\n" -X POST http://127.0.0.1:4000/v1/auth/login -H "Content-Type: application/json" -d "$PAYLOAD" --max-time 10
cat /tmp/_d.log | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const t=j.data?.accessToken||j.accessToken||'';console.log('DIRECT_OK='+((j.ok===true||t.length>100)?'YES':'NO')+' TOKEN_LEN='+t.length);if(j.error)console.log('ERR_MSG='+j.error.message)}catch(e){console.log('PARSE_ERR: '+d.slice(0,200))}})"
echo "--- NGINX HTTPS 443 Host=saranasmk.id ---"
curl -sk -o /tmp/_n.log -w "HTTP_NGINX=%{http_code}\n" -X POST https://127.0.0.1/api/v1/auth/login -H "Host: saranasmk.id" -H "Content-Type: application/json" -d "$PAYLOAD" --max-time 10
cat /tmp/_n.log | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const t=j.data?.accessToken||j.accessToken||'';console.log('NGINX_OK='+((j.ok===true||t.length>100)?'YES':'NO')+' TOKEN_LEN='+t.length);if(j.error)console.log('NGINX_ERR_MSG='+j.error.message)}catch(e){console.log('NGINX_PARSE_ERR: '+d.slice(0,200))}})"
""")
for line in (out + err).splitlines():
    log(line)
save()

log("")
log("=== FINAL PM2 SAVE ===")
rc, out, err = ssh("cd /home/alatprods/saranasmk && pm2 save 2>&1 | tail -3")
for line in (out + err).splitlines():
    log(line)
save()

log("")
log("=== DONE RETURN EXIT CODE ===")
log("SUBAGENT_FINISHED=1")
log("")
log("=" * 78)
log(f"SELESAI — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"Output file utama: {OUTPUT_LOCAL}")
log(f"Output file backup: {BACKUP_LOCAL}")
log("=" * 78)
save()

sys.stderr.write(f"\nOutput disimpan ke: {OUTPUT_LOCAL}\n")
sys.exit(0)
