#!/usr/bin/env python3
"""
Reset password admin LOKAL menjadi admin123 dengan bcrypt hash BENAR
dihasilkan dari bcryptjs di apps/api. Hindari shell expansion $ via NamedTemporaryFile.
"""
import subprocess, os, tempfile, sys, json

WORKSPACE = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
API_DIR = f"{WORKSPACE}/apps/api"
DB_ENV = f"{API_DIR}/.env"

def sh(cmd, cwd=None, check=True):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"[CMD FAIL] {cmd}")
        print(f"  STDOUT: {r.stdout[:300]}")
        print(f"  STDERR: {r.stderr[:300]}")
        sys.exit(1)
    return r

# 1. Cek & generate bcrypt hash via apps/api node_modules/bcryptjs
print("1. Generate bcrypt hash for 'admin123' via apps/api/bcryptjs...")
node_script = """
const bcrypt = require('bcryptjs');
bcrypt.hash('admin123', 10).then(h => { console.log(JSON.stringify({hash})); process.exit(0); })
.catch(e => { console.error(e); process.exit(1); });
"""
r = subprocess.run(['node', '-e', node_script], cwd=API_DIR, capture_output=True, text=True)
if r.returncode != 0 or not r.stdout.strip():
    print("  bcryptjs via apps/api FAIL:", r.stderr[:300])
    print("  Pakai fallback precomputed hash (bcrypt $2a$10$ known admin123)...")
    hash_pwd = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
else:
    d = json.loads(r.stdout.strip().splitlines()[-1])
    hash_pwd = d["hash"]
    print(f"  OK. Hash length={len(hash_pwd)} prefix={hash_pwd[:7]}")

# 2. Baca DB credential dari apps/api/.env
print("2. Baca DB credential lokal dari apps/api/.env...")
creds = {}
with open(DB_ENV) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k in ("DB_HOST","DB_PORT","DB_NAME","DB_USER","DB_PASS","DATABASE_URL"):
            creds[k] = v
if creds.get("DATABASE_URL"):
    print(f"   Menggunakan DATABASE_URL")
    PGDATABASE = creds["DATABASE_URL"].split("/")[-1].split("?")[0]
    u_p, host_port = creds["DATABASE_URL"].split("://")[1].split("@")
    PGUSER, PGPASSWORD = u_p.split(":")
    hh = host_port.split(":")
    PGHOST = hh[0]
    PGPORT = hh[1].split("/")[0] if len(hh) > 1 else "5432"
else:
    PGHOST = creds.get("DB_HOST", "127.0.0.1")
    PGPORT = creds.get("DB_PORT", "5432")
    PGDATABASE = creds.get("DB_NAME", "saranasmk_local_latest")
    PGUSER = creds.get("DB_USER", "saranasmk_app")
    PGPASSWORD = creds.get("DB_PASS", "")
print(f"   host={PGHOST}:{PGPORT}  db={PGDATABASE}  user={PGUSER}")

os.environ["PGHOST"] = PGHOST
os.environ["PGPORT"] = PGPORT
os.environ["PGDATABASE"] = PGDATABASE
os.environ["PGUSER"] = PGUSER
os.environ["PGPASSWORD"] = PGPASSWORD
os.environ["PGOPTIONS"] = "--client-min-messages=warning"

# 3. Cek kolom table users
print("3. Query kolom table users...")
r = sh("psql -X -At -c \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position;\"")
cols = [tuple(l.split('|')) for l in r.stdout.strip().splitlines() if '|' in l]
print(f"   Jumlah kolom={len(cols)}")
col_names = [c[0] for c in cols]
for n, t in cols:
    print(f"   - {n:<25} {t}")

# Pilih kolom password & username yang tepat
pwd_col = None
usr_col = None
for c in col_names:
    cl = c.lower()
    if pwd_col is None and ('password' in cl or 'hash' in cl and pwd_col is None):
        if cl in ('password','password_hash','hashed_password','passhash'): pwd_col = c
    if usr_col is None:
        if cl in ('username','email','login'): usr_col = c
if pwd_col is None:
    # fallback: cari kolom teks panjang
    for n, t in cols:
        if t in ('text','character varying','varchar') and (len(n)>6 and ('pass' in n.lower() or 'hash' in n.lower())):
            pwd_col = n; break
print(f"   -> Kolom credentials: username_col={usr_col}  password_col={pwd_col}")

# 4. Cari user admin (berdasarkan email admin@saranasmk.id atau username)
print("4. Cari user admin@saranasmk.id...")
lookup_cols = [c for c in col_names if c.lower() in ('username','email','id','full_name','is_active')]
r = sh(f"psql -X -At -F $'\\t' -c \"SELECT {','.join(lookup_cols)} FROM users WHERE lower(username)=lower('admin@saranasmk.id') OR lower(email)=lower('admin@saranasmk.id') OR lower(username) LIKE 'admin%' LIMIT 5;\"")
rows = [l.split('\t') for l in r.stdout.strip().splitlines() if l.strip()]
print(f"   Ditemukan {len(rows)} user mirip admin:")
admin_id = None
target_identity = None
for i, row in enumerate(rows):
    print(f"   [{i}] " + " | ".join(f"{k}={v}" for k,v in zip(lookup_cols, row)))
    if 'admin@saranasmk.id' in str(row).lower():
        admin_id = row[lookup_cols.index('id')] if 'id' in lookup_cols else None
        target_identity = row[lookup_cols.index('username')] if 'username' in lookup_cols else row[0]
if admin_id is None and rows:
    admin_id = rows[0][lookup_cols.index('id')] if 'id' in lookup_cols else None
    target_identity = rows[0][lookup_cols.index('username')] if 'username' in lookup_cols else rows[0][0]
print(f"   -> Target update: id={admin_id} identity={target_identity}")

if admin_id is None or not pwd_col or not usr_col:
    print("[ERROR] Tidak bisa mendeteksi id/pwd_col/usr_col. Exit 1.")
    sys.exit(2)

# 5. Build SQL file via NamedTemporaryFile (hindari shell expansion $ di bcrypt hash)
print("5. Update password via temp SQL file (anti-shell-expansion)...")
sql_content = f"""-- AUTO GENERATED RESET PASSWORD LOKAL
BEGIN;
UPDATE users SET {pwd_col} = '{hash_pwd}', updated_at = NOW() WHERE id = '{admin_id}';
DO $$
DECLARE cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM users WHERE id = '{admin_id}';
  RAISE NOTICE 'USER_UPDATED id={admin_id}; count=%', cnt;
END $$;
COMMIT;
"""
with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8') as tf:
    tf.write(sql_content)
    tmpsql = tf.name
print(f"   Temp SQL: {tmpsql}")
r = sh(f"psql -X -v ON_ERROR_STOP=1 -f {tmpsql}")
print(f"   psql output: {r.stdout.strip()}")
print(f"   psql stderr: {r.stderr.strip()}")
os.unlink(tmpsql)

# 6. Verifikasi via curl LANGSUNG ke :4000 login
print()
print("6. Verifikasi login via curl :4000/v1/auth/login...")
import urllib.request
payload = __import__('json').dumps({"username": "admin@saranasmk.id", "password": "admin123"}).encode()
req = urllib.request.Request("http://localhost:4000/v1/auth/login", data=payload,
    headers={"Content-Type":"application/json","Accept":"application/json"}, method="POST")
try:
    r2 = urllib.request.urlopen(req, timeout=10)
    body = r2.read().decode()
    try:
        d = json.loads(body)
        data = d.get("data") if isinstance(d.get("data"), dict) else {}
        token = data.get("token") or ""
        user = data.get("user") or {}
        role = user.get("role") if isinstance(user, dict) else None
        print(f"   [BERHASIL] HTTP {r2.status} | Token={len(token)}B | Role={role}")
    except:
        print(f"   [BERHASIL] HTTP {r2.status} | body[:200]={body[:200]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"   [GAGAL] HTTP {e.code} | {body[:300]}")
except Exception as e:
    print(f"   [GAGAL EXC] {e}")
