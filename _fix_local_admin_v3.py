#!/usr/bin/env python3
"""UPDATE DB LOKAL: sync user admin dengan PRODUKSI (username + email + password_hash benar via _gen_hash.js)."""
import subprocess, os, tempfile, sys, json, urllib.request

WORKSPACE = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
DB_ENV = f"{WORKSPACE}/apps/api/.env"

creds = {}
with open(DB_ENV) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k == "DATABASE_URL":
            u_p, host_port = v.split("://")[1].split("@")
            PGUSER, PGPASSWORD = u_p.split(":")
            hh = host_port.split(":")
            PGHOST = hh[0]
            PGPORT = hh[1].split("/")[0]
            PGDATABASE = v.split("/")[-1].split("?")[0]

os.environ.update({
    "PGHOST": PGHOST, "PGPORT": PGPORT, "PGDATABASE": PGDATABASE,
    "PGUSER": PGUSER, "PGPASSWORD": PGPASSWORD,
    "PGOPTIONS": "--client-min-messages=warning"
})

print(f"Target DB: {PGUSER}@{PGHOST}:{PGPORT}/{PGDATABASE}")
print()

# 1. Hash bcrypt SUDAH di-generate via _gen_hash.js (verified OK):
PASSWORD_PLAIN = "admin123"
HASH_PWD = "$2b$10$Q9s2sGv3M0iMDkHa7qaXw.skPxFtS1V/FQLQXywKDKnT3yWbKmeIW"
print(f"[1] Password plain : {PASSWORD_PLAIN}")
print(f"[1] Hash bcrypt   : {HASH_PWD[:20]}... (len={len(HASH_PWD)}, prefix={HASH_PWD[:4]})")

USER_ID = "msmde0xz9af4d1b6fc5a3e955c"
NEW_USERNAME = "admin@saranasmk.id"
NEW_EMAIL = "admin@saranasmk.id"

# 2. Build SQL via NamedTemporaryFile (hindari $ di hash)
sql = f"""BEGIN;
UPDATE users
SET username      = '{NEW_USERNAME}',
    email         = '{NEW_EMAIL}',
    password_hash = '{HASH_PWD}',
    password_default_plaintext = '{PASSWORD_PLAIN}',
    is_active     = 1,
    updated_at    = NOW()
WHERE id = '{USER_ID}';
DO $$
DECLARE r RECORD;
BEGIN
  SELECT id, username, email, is_active INTO r FROM users WHERE id = '{USER_ID}';
  RAISE NOTICE 'USER_SYNCED id=% username=% email=% active=%', r.id, r.username, r.email, r.is_active;
END $$;
COMMIT;
"""
with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8') as tf:
    tf.write(sql)
    tmpsql = tf.name

# 3. Execute
print()
print("[2] Execute SQL update (temp file: anti shell expansion $)...")
r = subprocess.run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-f', tmpsql],
                   capture_output=True, text=True)
if r.returncode != 0:
    print("  FAIL STDOUT:", r.stdout); print("  FAIL STDERR:", r.stderr); sys.exit(1)
print("  STDOUT:", r.stdout.strip())
print("  STDERR:", r.stderr.strip())
os.unlink(tmpsql)

# 4. Verify curl login
print()
print("[3] Verify login via POST http://localhost:4000/v1/auth/login ...")
payload = json.dumps({"username": NEW_USERNAME, "password": PASSWORD_PLAIN}).encode()
req = urllib.request.Request("http://localhost:4000/v1/auth/login",
    data=payload,
    headers={"Content-Type":"application/json","Accept":"application/json"},
    method="POST")
try:
    r2 = urllib.request.urlopen(req, timeout=10)
    body = r2.read().decode()
    try:
        d = json.loads(body)
        data = d.get("data") if isinstance(d.get("data"), dict) else {}
        token = data.get("token") or ""
        user = data.get("user") or {}
        role = user.get("role") if isinstance(user, dict) else None
        print(f"  [BERHASIL] HTTP {r2.status} | TOKEN_LEN={len(token)} | ROLE={role}")
    except:
        print(f"  [BERHASIL] HTTP {r2.status} | body[:200]={body[:200]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"  [GAGAL] HTTP {e.code} | {body[:400]}")
except Exception as e:
    print(f"  [GAGAL EXC] {e}")

# 5. Verify juga via email field (DTO dual field fix)
print()
print("[4] Verify login via EMAIL field (DTO dual-field fix baru)...")
payload = json.dumps({"email": NEW_EMAIL, "password": PASSWORD_PLAIN}).encode()
req = urllib.request.Request("http://localhost:4000/v1/auth/login",
    data=payload,
    headers={"Content-Type":"application/json","Accept":"application/json"},
    method="POST")
try:
    r2 = urllib.request.urlopen(req, timeout=10)
    body = r2.read().decode()
    d = json.loads(body)
    data = d.get("data") if isinstance(d.get("data"), dict) else {}
    token = data.get("token") or ""
    print(f"  [BERHASIL] HTTP {r2.status} | TOKEN_LEN={len(token)}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"  [GAGAL] HTTP {e.code} | {body[:300]}")
