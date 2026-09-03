#!/usr/bin/env python3
"""RESET password admin@saranasmk.id di PostgreSQL lokal menjadi admin123 (bcrypt)."""
import subprocess, os, tempfile

PG = dict(
  PGHOST="127.0.0.1", PGPORT="5432",
  PGUSER="saranasmk_app", PGPASSWORD="saranasmkApp123!Prod",
  PGDATABASE="saranasmk_local_latest",
)
env = os.environ.copy()
env.update(PG)

def psql_file(path):
    return subprocess.run(
        ["psql", "-h", PG["PGHOST"], "-p", PG["PGPORT"], "-U", PG["PGUSER"],
         "-d", PG["PGDATABASE"], "-v", "ON_ERROR_STOP=1", "-f", path],
        capture_output=True, env=env,
    )

# 1. Buat bcrypt hash admin123 via local node_modules bcryptjs
print("[1] Generate bcrypt hash for 'admin123' via node_modules/bcryptjs ...")
hash_path = os.path.join(os.path.dirname(__file__), "_tmp_hash.txt")
node_script = f"""
const b = require('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/node_modules/bcryptjs');
const h = b.hashSync('admin123', 10);
require('fs').writeFileSync({repr(hash_path)}, h);
console.log('HASH_LEN=' + h.length);
"""
r = subprocess.run(["node", "-e", node_script], capture_output=True,
    cwd="/Users/ilahilah/Documents/Project/PRISMA/saranasmk")
if r.returncode != 0:
    print("  Node bcryptjs FAILED (fallback ke precomputed hash admin123 rounds=10)")
    print("  STDERR:", r.stderr.decode(errors="replace")[:300])
    HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
else:
    print("  STDOUT:", r.stdout.decode().strip())
    try:
        with open(hash_path) as f: HASH = f.read().strip()
        print(f"  HASH loaded (len={len(HASH)}): {HASH[:20]}...")
    except Exception as e:
        print("  Read hash failed:", e)
        HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    finally:
        try: os.unlink(hash_path)
        except: pass

# 2. Tulis SQL ke temp file (hindari shell expansion $)
print("[2] Menulis SQL + eksekusi via psql -f ...")
sql = f"""
DO $$
DECLARE
    target_uid CHAR(26);
    tgt VARCHAR(255) := 'admin@saranasmk.id';
BEGIN
    SELECT id INTO target_uid FROM users WHERE LOWER(username) = LOWER(tgt) LIMIT 1;
    IF target_uid IS NULL THEN
        SELECT id INTO target_uid FROM users WHERE LOWER(COALESCE(email,'')) = LOWER(tgt) LIMIT 1;
    END IF;
    IF target_uid IS NULL THEN
        SELECT u.id INTO target_uid
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
         WHERE r.code IN ('ADMIN','SUPERADMIN')
         LIMIT 1;
    END IF;
    IF target_uid IS NOT NULL THEN
        UPDATE users SET
          password_hash = '{HASH}',
          password_default_plaintext = 'admin123',
          is_active = COALESCE(is_active, 1)
        WHERE id = target_uid;
        RAISE NOTICE 'USER_UPDATED id=%  (new password=admin123)', target_uid;
    ELSE
        RAISE WARNING 'NO_USER_FOUND — skip update.';
    END IF;
END $$;

SELECT u.id, u.username, u.email, r.code AS role,
       LEFT(u.password_hash, 20) || '...' AS hash_prefix, u.is_active
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE LOWER(username) = LOWER('admin@saranasmk.id')
   OR LOWER(COALESCE(email,'')) = LOWER('admin@saranasmk.id')
LIMIT 3;
"""
tf = tempfile.NamedTemporaryFile("w", delete=False, suffix="_reset_pwd.sql")
tf.write(sql); tf.close()
try:
    r2 = psql_file(tf.name)
    print("  RC=", r2.returncode)
    out = r2.stdout.decode(errors="replace")
    err = r2.stderr.decode(errors="replace")
    if out.strip(): print("  STDOUT:\n   ", out.strip().replace("\n","\n    "))
    if err.strip(): print("  STDERR:\n   ", err.strip().replace("\n","\n    "))
finally:
    try: os.unlink(tf.name)
    except: pass

print("[DONE] Lokal password admin siap diuji (admin@saranasmk.id / admin123).")
