#!/usr/bin/env python3
"""PERSISTENCE VERIFY DATA-PERSIAPAN V1 — localhost:3000/sekolah/pengajuan/data-persiapan"""
import json, os, urllib.request, urllib.error, ssl, subprocess, tempfile, time, sys

ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
os.chdir(ROOT)

BASE_API = "http://localhost:3000/api/v1"

USERNAME = "10105724"
PW = "sekolah123"
NPSN = "10105724"

env_path = "apps/api/.env"
DB_URL = None
with open(env_path) as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            DB_URL = line.strip().split("=", 1)[1]
            break
assert DB_URL, "DATABASE_URL not found"

def psql(sql):
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as tf:
        tf.write(sql + "\n")
        tmp = tf.name
    try:
        r = subprocess.run(["psql", DB_URL, "-At", "-F", "\x01", "-f", tmp],
                           capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            raise RuntimeError(r.stderr[:1500])
        return r.stdout
    finally:
        try: os.unlink(tmp)
        except Exception: pass

def http(method, path, token=None, body=None, timeout=30):
    h = {"Content-Type":"application/json","Accept":"application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{BASE_API}{path}", data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", errors="replace")
            try: j = json.loads(raw)
            except Exception: j = {"_raw": raw[:2000]}
            return r.status, j
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try: j = json.loads(raw)
        except Exception: j = {"_raw": raw[:2000]}
        return e.code, j

def post(url, body=None, token=None):
    return http("POST", url, token=token, body=body)

if __name__ == "__main__":
    print("=" * 72)
    print(f"PERSISTENCE DATA-PERSIAPAN V1 — NPSN {NPSN}")
    print("=" * 72)

    # Step 0. DB cek existing row
    rc = psql(f"SELECT npsn, proposal_tables_json IS NOT NULL AS has_proposal FROM workspace_school_proposal_data WHERE npsn = '{NPSN}' LIMIT 1")
    print(f"  DB workspace_school_proposal_data for NPSN={NPSN} exists={bool(rc.strip())}  detail: {rc.strip()}")

    # Step 1. Login via username
    print("\n[STEP 1 LOGIN user SEKOLAH via username]")
    st, j = post("/auth/login", {"username": USERNAME, "password": PW})
    print(f"  HTTP {st}")
    assert 200 <= st < 300, f"Login gagal {st} {json.dumps(j, indent=2, ensure_ascii=False)[:1000]}"
    tok = None
    if isinstance(j, dict) and j.get("ok"):
        tok = (j.get("data") or {}).get("token")
    if not tok:
        tok = j.get("accessToken") or (j.get("data") or {}).get("accessToken") or (j.get("result") or {}).get("token") or (j.get("auth") or {}).get("token")
    if not tok and isinstance(j, dict):
        for k1 in ("data", "result", "auth", "jwt"):
            if isinstance(j.get(k1), dict):
                for k2 in ("token", "accessToken", "jwt", "access_token"):
                    if isinstance(j[k1].get(k2), str) and len(j[k1][k2]) > 50:
                        tok = j[k1][k2]
    if not tok and isinstance(j, dict):
        for k2 in ("token", "accessToken", "jwt", "access_token"):
            if isinstance(j.get(k2), str) and len(j[k2]) > 50:
                tok = j[k2]
    assert tok, f"No token found in response keys={list(j.keys()) if isinstance(j, dict) else type(j)}  value sample={json.dumps(j, ensure_ascii=False)[:800]}"
    print(f"  token len={len(tok)}")

    # Step 2. GET proposal me sebelum modif
    print("\n[STEP 2 GET /workspace-data/school-proposals/me INITIAL]")
    st2, j2 = http("GET", "/workspace-data/school-proposals/me", tok)
    me = j2.get("data") if isinstance(j2, dict) and j2.get("ok") else j2
    print(f"  HTTP {st2}")
    assert 200 <= st2 < 300, f"GET me gagal {st2} {json.dumps(j2, ensure_ascii=False)[:1500]}"
    pt = me.get("proposalTables") or {}
    rp = me.get("rpkpSelections") or {}
    if not isinstance(rp, dict): rp = {}
    keys = list(pt.keys())
    print(f"  proposalTables top keys={len(keys)} keys={keys[:15]}")
    global1 = pt.get("__global_biaya_persiapan_pelaporan", [])
    global2 = pt.get("__global_biaya_pendukung_pelatihan", [])
    if not isinstance(global1, list): global1 = []
    if not isinstance(global2, list): global2 = []
    print(f"  biaya-persiapan rows (INITIAL API) = {len(global1)}")
    print(f"  biaya-pelatihan rows (INITIAL API) = {len(global2)}")
    if len(global1):
        print("  sample first row:", json.dumps(global1[0], ensure_ascii=False)[:300])

    # Step 2b DB DIRECT CHECK BEFORE FIX
    print("\n[STEP 2b DB DIRECT BEFORE PUT]")
    rc1 = psql(f"SELECT jsonb_object_keys(proposal_tables_json::jsonb) AS k FROM workspace_school_proposal_data WHERE npsn='{NPSN}' LIMIT 30")
    if rc1.strip():
        keys_db = rc1.strip().split("\n")
    else:
        keys_db = ["(empty/no row)"]
    print(f"  DB proposal_tables_json keys count={len(keys_db)}  sample={keys_db[:12]}")
    rc_count1 = psql(f"SELECT COALESCE(jsonb_array_length(proposal_tables_json::jsonb->'__global_biaya_persiapan_pelaporan'), 0) AS cnt FROM workspace_school_proposal_data WHERE npsn='{NPSN}'")
    db_initial_cnt = int(rc_count1.strip() or "0")
    print(f"  DB array length biaya-persiapan (INITIAL DB)= {db_initial_cnt}")

    # Step 3. PUT simpan data persiapan dengan 2 rows (atau modify +1 quantity jika ada)
    print("\n[STEP 3 PUT SIMPAN modify /workspace-data/school-proposals/me]")
    new_rows_1 = []
    expected_qty_after = None
    if len(global1) == 0:
        new_rows_1 = [
            {"id": "persiapan-test-001", "name": "Honor Narasumber Bimtek Penggunaan Alat", "quantity": 12, "unit": "Orang", "price": "1500000", "specification": "Narasumber 3 hari", "conformity": "YA"},
            {"id": "persiapan-test-002", "name": "ATK & Dokumentasi Pelatihan", "quantity": 35, "unit": "Paket", "price": "75000", "specification": "ATK + Buku Manual + Flashdisk", "conformity": "YA"},
        ]
        expected_qty_after = new_rows_1[0]["quantity"]
    else:
        # Edit quantity row pertama +1
        first_id = global1[0].get("id") if isinstance(global1[0], dict) else None
        for i, r in enumerate(global1):
            if not isinstance(r, dict):
                continue
            cp = dict(r)
            if i == 0:
                try:
                    cp["quantity"] = int(cp.get("quantity") or 0) + 1
                except Exception:
                    cp["quantity"] = 2
            new_rows_1.append(cp)
        expected_qty_after = new_rows_1[0].get("quantity")
        if len(new_rows_1) < 2:
            new_rows_1.append({"id": "persiapan-test-002", "name": "ATK & Dokumentasi Pelatihan (ditambahan)", "quantity": 35, "unit": "Paket", "price": "75000", "specification": "ATK + Buku", "conformity": "YA"})

    new_pt = dict(pt)
    new_pt["__global_biaya_persiapan_pelaporan"] = new_rows_1
    print(f"  target new rows count = {len(new_rows_1)}  row0 id={new_rows_1[0].get('id')} new qty={expected_qty_after}")

    payload_save = {"proposalTables": new_pt, "rpkpSelections": rp}
    st3, j3 = http("PUT", "/workspace-data/school-proposals/me", tok, payload_save)
    print(f"  HTTP PUT {st3}")
    assert 200 <= st3 < 300, f"PUT gagal {st3} {json.dumps(j3, indent=2, ensure_ascii=False)[:2000]}"
    save_resp = j3.get("data") if isinstance(j3, dict) and j3.get("ok") else j3
    saved_pt = save_resp.get("proposalTables") or {} if isinstance(save_resp, dict) else {}
    saved_persiapan = saved_pt.get("__global_biaya_persiapan_pelaporan", []) if isinstance(saved_pt, dict) else []
    if not isinstance(saved_persiapan, list): saved_persiapan = []
    print(f"  API response persiapan len={len(saved_persiapan)}  row0 qty={saved_persiapan[0].get('quantity') if len(saved_persiapan) else 'N/A'} (expect qty={expected_qty_after})")

    # Step 4 DB DIRECT AFTER PUT — sleep sejenak untuk transaction commit
    print("\n[STEP 4 DB DIRECT AFTER PUT commit]")
    time.sleep(0.5)
    rc_count2 = psql(f"SELECT COALESCE(jsonb_array_length(proposal_tables_json::jsonb->'__global_biaya_persiapan_pelaporan'), 0) AS cnt FROM workspace_school_proposal_data WHERE npsn='{NPSN}'")
    db_cnt = int(rc_count2.strip() or "0")
    qty_row0_db_raw = psql(f"SELECT COALESCE((proposal_tables_json::jsonb->'__global_biaya_persiapan_pelaporan'->0->>'quantity')::text, 'NULL') AS q FROM workspace_school_proposal_data WHERE npsn='{NPSN}' LIMIT 1")
    qty_db = qty_row0_db_raw.strip()
    print(f"  DB biaya-persiapan rows count = {db_cnt}")
    print(f"  DB row0 quantity              = {qty_db}")

    # Step 5. Simulasi LOGOUT (clear token) → LOGIN ulang → GET proposal me
    print("\n[STEP 5 SIMULASI LOGOUT → LOGIN LAGI → GET /workspace-data/school-proposals/me]")
    st5, j5 = post("/auth/login", {"username": USERNAME, "password": PW})
    assert 200 <= st5 < 300, f"Re-login FAIL {st5}"
    tok2 = None
    if isinstance(j5, dict) and j5.get("ok"):
        tok2 = (j5.get("data") or {}).get("token")
    if not tok2 and isinstance(j5, dict):
        for k1 in ("data", "result", "auth"):
            if isinstance(j5.get(k1), dict):
                for k2 in ("token", "accessToken", "jwt", "access_token"):
                    if isinstance(j5[k1].get(k2), str) and len(j5[k1][k2]) > 50:
                        tok2 = j5[k1][k2]
    if not tok2 and isinstance(j5, dict):
        for k2 in ("token", "accessToken", "jwt"):
            if isinstance(j5.get(k2), str) and len(j5[k2]) > 50:
                tok2 = j5[k2]
    assert tok2, "Re-login no token"
    print(f"  re-login token len={len(tok2)}")

    st6, j6 = http("GET", "/workspace-data/school-proposals/me", tok2)
    assert 200 <= st6 < 300, f"Re-GET me FAIL {st6} {json.dumps(j6, ensure_ascii=False)[:1000]}"
    me2 = j6.get("data") if isinstance(j6, dict) and j6.get("ok") else j6
    pt2 = me2.get("proposalTables") or {} if isinstance(me2, dict) else {}
    persiapan_reget = pt2.get("__global_biaya_persiapan_pelaporan", []) if isinstance(pt2, dict) else []
    if not isinstance(persiapan_reget, list): persiapan_reget = []
    print(f"  re-login GET persiapan len   = {len(persiapan_reget)}")
    qty_reget = persiapan_reget[0].get("quantity") if len(persiapan_reget) and isinstance(persiapan_reget[0], dict) else None
    print(f"  re-login GET row0 quantity   = {qty_reget}")

    print("\n" + "=" * 72)
    print("✅ FINAL ASSERTIONS:")
    all_ok = True

    exp_cnt = len(new_rows_1)
    if exp_cnt == db_cnt:
        print(f"  ✅ (P1) ROW COUNT biaya-persiapan SAMA  API new={exp_cnt}  == DB count={db_cnt}")
    else:
        print(f"  ❌ (P1) ROW COUNT MISMATCH  API new={exp_cnt}  DB={db_cnt}")
        all_ok = False

    try:
        db_q = int(float(str(qty_db).strip('"').strip("'"))) if qty_db and qty_db != "NULL" else 0
    except Exception:
        db_q = 0
    try:
        e_q = int(float(str(expected_qty_after)))
    except Exception:
        e_q = 0
    if db_q == e_q and db_q > 0:
        print(f"  ✅ (P2) QUANTITY ROW-0 TULIS KE DB SAMA: DB={db_q}  expect={e_q}")
    else:
        print(f"  ❌ (P2) QUANTITY MISMATCH DB={db_q}  expect={e_q}")
        all_ok = False

    try:
        rg_q = int(float(str(qty_reget))) if qty_reget is not None else 0
    except Exception:
        rg_q = 0
    if rg_q == e_q == db_q and db_q > 0:
        print(f"  ✅ (P3) RELOGIN GET DATA SAMA DENGAN DB:  API relogin={rg_q}  DB={db_q}  expect={e_q}")
        print(f"       => DATA TIDAK HILANG KETIKA KELUAR DAN MASUK LAGI (sesuai requirement user data-persiapan ✔)")
    else:
        print(f"  ❌ (P3) RELOGIN MISMATCH relogin API={rg_q} vs DB={db_q} vs expect={e_q}")
        all_ok = False

    print()
    print("=" * 72)
    if all_ok:
        print("✅ EXIT 0  PERSISTENCE DATA-PERSIAPAN V1 LULUS 3/3 ASSERTIONS")
        print(f"   -> {db_cnt} rows biaya persiapan TERSIMPAN PERMANEN di Postgres (DB DIRECT jsonb)")
        print(f"   -> Setelah login ulang, re-GET endpoint menampilkan DATA SAMA PERSIS dengan DB")
        print(f"   -> FIX BERHASIL: data-persiapan TIDAK HILANG ketika keluar-masuk login lagi")
        sys.exit(0)
    else:
        print("❌ EXIT !=0 — ADA YANG MASIH BERMASALAH")
        sys.exit(1)
    print("=" * 72)
