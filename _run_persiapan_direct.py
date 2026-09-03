import json, urllib.request, tempfile, os, subprocess, sys, time
env = "apps/api/.env"
DB_URL=None
with open(env) as f:
    for ln in f:
        if ln.startswith("DATABASE_URL="):
            DB_URL = ln.strip().split("=",1)[1]
assert DB_URL

def psql(sql):
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as tf:
        tf.write(sql + "\n")
        tmp = tf.name
    try:
        r = subprocess.run(["psql", DB_URL, "-At", "-F", "|", "-f", tmp], capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            print("PSQL err", r.stderr[:1500])
        return r.stdout
    finally:
        try: os.unlink(tmp)
        except: pass

BASE="http://localhost:4000/v1"
NPSN="10105724"
# login
def login(u,pw):
    req = urllib.request.Request(f"{BASE}/auth/login",
        data=json.dumps({"username":u,"password":pw}).encode(),
        headers={"Content-Type":"application/json","Accept":"application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        o = json.loads(r.read().decode())
    return (o.get("data") or {}).get("token") or o.get("token")

tok = login("10105724","sekolah123")
print("Token len", len(tok))

# Step A. Initial DB global key count
rcA = psql(f"SELECT COALESCE(jsonb_array_length(proposal_tables_json::jsonb->'__global_biaya_persiapan_pelaporan'),0) AS cnt, count(*) FILTER (WHERE jsonb_exists(proposal_tables_json::jsonb, '__global_biaya_persiapan_pelaporan')) AS has_key FROM workspace_school_proposal_data WHERE npsn='{NPSN}' LIMIT 1")
print(f"[A] DB BEFORE  biaya-persiapan: {rcA.strip()}")

# Step B. GET me → ambil existing proposalTables + rpkpSelections
def get_me(tok):
    req = urllib.request.Request(f"{BASE}/workspace-data/school-proposals/me",
        headers={"Authorization":f"Bearer {tok}","Accept":"application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        o = json.loads(r.read().decode())
    me = o.get("data") if isinstance(o,dict) and o.get("ok") else o
    return (me.get("proposalTables") or {}, me.get("rpkpSelections") or {})

pt, rp = get_me(tok)
print(f"[B] API GET me: proposalTables {len(pt)} keys, __global_biaya_persiapan_pelaporan rows = {len(pt.get('__global_biaya_persiapan_pelaporan', []))}")

# Step C. PUT save: tambahkan / modify __global_biaya_persiapan_pelaporan
old_rows = pt.get("__global_biaya_persiapan_pelaporan") or []
if not isinstance(old_rows, list): old_rows = []
if len(old_rows) == 0:
    new_rows = [
        {"id":"persiapan-test-001","name":"Honor Narasumber","quantity":12,"unit":"Orang","price":"1500000","specification":"Narasumber 3 hari","conformity":"YA"},
        {"id":"persiapan-test-002","name":"ATK & Dokumentasi","quantity":35,"unit":"Paket","price":"75000","specification":"ATK + Buku Manual","conformity":"YA"},
    ]
else:
    # modify row 0 quantity +1
    new_rows = []
    for i, r in enumerate(old_rows):
        if not isinstance(r, dict): continue
        cp = dict(r)
        if i == 0:
            try: cp["quantity"] = int(cp.get("quantity") or 0) + 1
            except: cp["quantity"] = 2
        new_rows.append(cp)

print(f"[C] PUT target rows count = {len(new_rows)}, first quantity after PUT = {new_rows[0].get('quantity') if new_rows else 'N/A'}")

pt2 = dict(pt)
pt2["__global_biaya_persiapan_pelaporan"] = new_rows
body = {"proposalTables": pt2, "rpkpSelections": rp}
req = urllib.request.Request(f"{BASE}/workspace-data/school-proposals/me",
    data=json.dumps(body).encode(), method="PUT",
    headers={"Authorization":f"Bearer {tok}","Content-Type":"application/json","Accept":"application/json"})
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode()
        status = r.status
except urllib.error.HTTPError as e:
    status = e.code
    raw = e.read().decode()[:2500]
print(f"[C] PUT me status HTTP {status}")
try:
    j = json.loads(raw)
    if isinstance(j, dict):
        ok = j.get("ok")
        err = j.get("error")
        print(f"    ok={ok} err={json.dumps(err, ensure_ascii=False)[:1200] if err else None}")
        save_resp = j.get("data") if ok else None
        if isinstance(save_resp, dict):
            sp = save_resp.get("proposalTables") or {}
            print(f"    response persiapan rows = {len(sp.get('__global_biaya_persiapan_pelaporan', []))}")
except Exception as ex:
    print("  parse exc", ex, "head=", raw[:400])

time.sleep(0.8)
# Step D. DB DIRECT check AFTER PUT
rcD = psql(f"SELECT COALESCE(jsonb_array_length(proposal_tables_json::jsonb->'__global_biaya_persiapan_pelaporan'),0) AS cnt, (proposal_tables_json::jsonb->'__global_biaya_persiapan_pelaporan'->0->>'quantity')::text AS q0 FROM workspace_school_proposal_data WHERE npsn='{NPSN}' LIMIT 1")
print(f"[D] DB AFTER PUT   biaya-persiapan: {rcD.strip()}")
db_cnt = 0
db_q = None
if rcD.strip():
    parts = rcD.strip().split("|")
    if len(parts)>=1: db_cnt = int(parts[0] or "0")
    if len(parts)>=2: db_q = parts[1]

# Step E. Simulasi LOGOUT + LOGIN ulang → GET me
tok2 = login("10105724","sekolah123")
pt3, rp3 = get_me(tok2)
relogin_rows = pt3.get("__global_biaya_persiapan_pelaporan") or []
if not isinstance(relogin_rows, list): relogin_rows = []
re_q = relogin_rows[0].get("quantity") if len(relogin_rows) and isinstance(relogin_rows[0], dict) else None
print(f"[E] RELOGIN GET me: __global_biaya_persiapan_pelaporan rows = {len(relogin_rows)}, first qty = {re_q}")

# Assertions
print("\n" + "=" * 60)
all_ok = True
if len(new_rows) == db_cnt:
    print(f"✅ (1) ROW COUNT SAMA  new={len(new_rows)}  == DB {db_cnt}")
else:
    print(f"❌ (1) ROW COUNT MISMATCH  new={len(new_rows)} vs DB {db_cnt}")
    all_ok = False
try:
    exp_q = int(str(new_rows[0].get("quantity"))) if new_rows else 0
except: exp_q = 0
try:
    db_q_i = int(float(str(db_q))) if db_q else 0
except: db_q_i = 0
try:
    re_q_i = int(float(str(re_q))) if re_q is not None else 0
except: re_q_i = 0
if db_q_i == exp_q and db_q_i > 0:
    print(f"✅ (2) QUANTITY ROW-0 TULIS KE DB: DB={db_q_i}  expect={exp_q}")
else:
    print(f"❌ (2) QUANTITY MISMATCH DB={db_q_i} expect={exp_q}")
    all_ok = False
if re_q_i == db_q_i == exp_q and exp_q > 0:
    print(f"✅ (3) RELOGIN GET = DB = EXPECT  re-login GET={re_q_i} DB={db_q_i} expect={exp_q}")
    print("     => DATA BIAYA PERSIAPAN TIDAK HILANG KETIKA LOGOUT + LOGIN LAGI ✔")
else:
    print(f"❌ (3) RELOGIN GET={re_q_i} vs DB={db_q_i} vs expect={exp_q}")
    all_ok = False
print("=" * 60)
if all_ok:
    print("EXIT 0 ✅ PERSISTENCE DATA-PERSIAPAN FIX BERHASIL")
    sys.exit(0)
else:
    print("EXIT !=0 ❌ ADA YANG MASIH BERMASALAH")
    sys.exit(1)
