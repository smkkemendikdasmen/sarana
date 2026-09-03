#!/usr/bin/env python3
import subprocess, tempfile, os, json

ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
os.chdir(ROOT)
env_path = "apps/api/.env"
db_url = None
with open(env_path) as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            db_url = line.strip().split("=", 1)[1]
            break

email = "sekolah_10105724@saranasmk.id"

# 1. Cek hash stored
with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tf:
    tf.write(f"SELECT id, email, password_hash FROM users WHERE email = '{email}';\n")
    tmp = tf.name
try:
    res = subprocess.run(["psql", db_url, "-At", "-F", "\x01", "-f", tmp], capture_output=True, text=True, timeout=20)
    line = res.stdout.strip()
    print(f"STDOUT: {repr(line[:1000])}")
    print(f"STDERR: {res.stderr.strip()[:500]}")
    if line:
        parts = line.split("\x01")
        uid = parts[0] if len(parts) > 0 else ""
        em = parts[1] if len(parts) > 1 else ""
        phash = parts[2] if len(parts) > 2 else ""
        print(f"uid={uid} email={em} hash_len={len(phash)}")
        if phash:
            print(f"hash sample: {repr(phash[:40])}")
            hash_for_node = json.dumps(phash)
            cmp = subprocess.run(
                ["node", "-e", f"const b=require('./apps/api/node_modules/bcryptjs'); console.log(b.compareSync('sekolah123', {hash_for_node}));"],
                capture_output=True, text=True, timeout=15
            )
            print(f"bcrypt.compare('sekolah123', stored_hash) = {cmp.stdout.strip()}")
finally:
    os.unlink(tmp)

# 2. Update via psql variable
hr = subprocess.run(
    ["node", "-e", "const b=require('./apps/api/node_modules/bcryptjs'); process.stdout.write(b.hashSync('sekolah123', 10));"],
    capture_output=True, timeout=15
)
new_hash = hr.stdout.decode("utf-8")
print(f"\nNEW hash: len={len(new_hash)} prefix={new_hash[:12]!r}...")

with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tf:
    tf.write("UPDATE users SET password_hash = :v_hash WHERE email = :v_email RETURNING id;\n")
    tmp2 = tf.name
try:
    res2 = subprocess.run(
        ["psql", db_url, "-v", f"v_hash={new_hash}", "-v", f"v_email={email}", "-At", "-f", tmp2],
        capture_output=True, text=True, timeout=20
    )
    print(f"UPDATE id returned: {res2.stdout.strip()}  | err={res2.stderr.strip()[:300]}")
finally:
    os.unlink(tmp2)

# 3. Verify ulang compare
with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tf:
    tf.write(f"SELECT password_hash FROM users WHERE email = '{email}';\n")
    tmp3 = tf.name
try:
    res3 = subprocess.run(["psql", db_url, "-At", "-f", tmp3], capture_output=True, text=True, timeout=15)
    new_stored = res3.stdout.strip()
    print(f"new stored hash len={len(new_stored)} prefix={new_stored[:12]!r}")
    if new_stored:
        hash_for_node2 = json.dumps(new_stored)
        cmp2 = subprocess.run(
            ["node", "-e", f"const b=require('./apps/api/node_modules/bcryptjs'); console.log(b.compareSync('sekolah123', {hash_for_node2}));"],
            capture_output=True, text=True, timeout=15
        )
        print(f"FINAL bcrypt compare = {cmp2.stdout.strip()} (stderr={cmp2.stderr[:200] if cmp2.stderr else 'OK'})")
finally:
    os.unlink(tmp3)
