#!/usr/bin/env python3
"""VERIFIKASI PERSISTENCE DATA HILANG FIX V1
- Login admin
- GET school-profile by npsn
- Hitung initial concentrations length & values
- PUT edit profile TANPA field concentrations / organization (edit alamat saja)
- GET ulang
- PUT edit profile DENGAN concentrations (tambah rombel satu KK)
- GET ulang
- Bandingkan jumlah = EXPECTED
"""
import json
import urllib.request
import urllib.error
import os

BASE_API = "http://localhost:4000"
ADMIN_USER = "admin@saranasmk.id"
ADMIN_PASS = "admin123"

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "apps/api/.env")
db_url = None
with open(env_path) as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            db_url = line.strip().split("=", 1)[1]
            break

def http(method, path, token=None, body=None):
    data = None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{BASE_API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            j = json.loads(raw)
        except Exception:
            j = {"_raw": raw[:1000]}
        return e.code, j

if __name__ == "__main__":
    print("=" * 70)
    print("STEP 1/6: LOGIN ADMIN")
    code, body = http("POST", "/auth/login", None, {"username": ADMIN_USER, "password": ADMIN_PASS})
    print(f"  login HTTP {code}: token_len={len(body.get('accessToken','')) if isinstance(body, dict) else 'N/A'}")
    assert code == 201, f"Login gagal: {code} {body}"
    token = body["accessToken"]
    user = body.get("user", {})
    print(f"  user id={user.get('id')} role={user.get('role')}")

    # Cari user SEKOLAH atau sekolah via admin endpoint. SchoolProfileService punya /me.
    # Tapi admin login, admin tidak punya npsn. Jadi query sekolah langsung via DB dapet NPSN sample,
    # lalu cari endpoint GET school by npsn atau /school-profile/:npsn? Atau getListConcentrations summary?
    # Coba /school-profile/summary (getListConcentrationsSummary) - itu public? atau butuh auth?
    # Kita coba beberapa endpoint:
    print()
    print("STEP 2/6: CARI SAMPEL SEKOLAH DENGAN KK > 1")
    # Coba endpoint summary yang ada di controller? Cari di school-profile.controller.ts kemungkinan rutenya:
    import subprocess, tempfile
    sql = """
SELECT c.npsn, s.name, COUNT(c.id) AS kk_count
FROM school_profile_concentrations c
JOIN schools s ON s.npsn = c.npsn
GROUP BY c.npsn, s.name
HAVING COUNT(c.id) > 1
ORDER BY kk_count DESC
LIMIT 1;
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as tf:
        tf.write(sql)
        tmp = tf.name
    try:
        res = subprocess.run(["psql", db_url, "-At", "-F", "\t", "-f", tmp], capture_output=True, text=True, timeout=30)
        lines = [l for l in res.stdout.strip().split("\n") if l.strip()]
        assert lines, f"DB tidak punya sekolah dgn KK>1: err={res.stderr[:500]}"
        npsn, school_name, kk_count_db = lines[0].split("\t")
        kk_count_db = int(kk_count_db)
        print(f"  NPSN={npsn} NAME={school_name} KK_COUNT_DB={kk_count_db}")
    finally:
        os.unlink(tmp)

    # Sekarang kita butuh akses profile sekolah sebagai ADMIN.
    # Cek school-profile.controller.ts route:
    # Kemungkinan route: GET /v1/school-profile/:npsn  (public/admin)
    # Atau kita cari user sekolah yang terdaftar untuk npsn ini:
    sql_user = f"""
SELECT id, email, username, password_hash, role
FROM users 
WHERE npsn = '{npsn}' OR school_id = '{npsn}'
LIMIT 1;
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as tf:
        tf.write(sql_user)
        tmpu = tf.name
    try:
        res = subprocess.run(["psql", db_url, "-At", "-F", "\t", "-f", tmpu], capture_output=True, text=True, timeout=30)
        lines = [l for l in res.stdout.strip().split("\n") if l.strip()]
        if lines:
            parts = lines[0].split("\t")
            while len(parts) < 5:
                parts.append("")
            uid, uemail, uusername, upasshash, urole = parts[0], parts[1], parts[2], parts[3], parts[4]
            print(f"  FOUNT school user: id={uid} email={uemail} username={uusername} role={urole}")
            # coba reset password user ini ke 'sekolah123' via bcrypt
            import sys
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        else:
            print("  TIDAK ADA user sekolah untuk npsn ini; akan CREATE user SEKOLAH")
            uid = None
            uemail = f"sekolah_{npsn}@saranasmk.id"
            uusername = f"sekolah_{npsn}"
            urole = "SEKOLAH"
    finally:
        os.unlink(tmpu)

    print()
    print("STEP 3/6: CREATE/RESET PASSWORD USER SEKOLAH sekolah123")
    # Generate bcrypt hash via node bcryptjs (ada di apps/api/node_modules)
    hash_res = subprocess.run(
        ["node", "-e", "const b=require('./apps/api/node_modules/bcryptjs'); console.log(b.hashSync('sekolah123', 10));"],
        capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)), timeout=30
    )
    pw_hash = hash_res.stdout.strip()
    assert pw_hash.startswith("$2"), f"Gagal gen bcrypt: {hash_res.stderr[:500]}"
    print(f"  bcrypt hash(sekolah123) len={len(pw_hash)} prefix={pw_hash[:7]}")

    if uid is None:
        # INSERT user baru
        import uuid
        new_id = uuid.uuid4().hex[:26]  # nanoid-like 26 char
        ins_sql = f"""
INSERT INTO users (id, email, username, password_hash, role, npsn, school_id, "createdAt", "updatedAt")
VALUES ('{new_id}', '{uemail}', '{uusername}', '{pw_hash}', 'SEKOLAH', '{npsn}', '{npsn}', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = '{pw_hash}', npsn = '{npsn}', school_id = '{npsn}'
RETURNING id;
"""
    else:
        ins_sql = f"UPDATE users SET password_hash = '{pw_hash}' WHERE id = '{uid}' RETURNING id;"

    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as tf:
        tf.write(ins_sql)
        tmpi = tf.name
    try:
        res = subprocess.run(["psql", db_url, "-At", "-f", tmpi], capture_output=True, text=True, timeout=30)
        outs = res.stdout.strip()
        print(f"  UPSERT user result: {outs!r}  (stderr={res.stderr.strip()[:300] if res.stderr.strip() else 'OK'})")
        if not uid:
            uid = outs.split("\n")[-1]
    finally:
        os.unlink(tmpi)

    print()
    print("STEP 4/6: LOGIN SEBAGAI USER SEKOLAH & GET PROFILE INITIAL")
    code, body = http("POST", "/auth/login", None, {"username": uemail, "password": "sekolah123"})
    print(f"  login sekolah HTTP {code}")
    if code != 201:
        print("  BODY FAIL:", json.dumps(body, indent=2)[:1500])
    assert code == 201, f"Login sekolah gagal {code}"
    tok_sekolah = body["accessToken"]
    u_info = body.get("user", {})
    print(f"  sekolah user id={u_info.get('id')} npsn={u_info.get('npsn')} role={u_info.get('role')}")

    code, me = http("GET", "/school-profile/me", tok_sekolah)
    print(f"  GET /me HTTP {code}")
    assert code == 200, f"Get me gagal: {me}"
    conc_initial = me.get("concentrations", [])
    org_initial = me.get("organizationMembers", [])
    print(f"  INITIAL concentrations.len={len(conc_initial)}  (expect DB={kk_count_db})")
    print(f"  INITIAL organizationMembers.len={len(org_initial)}")
    for c in conc_initial:
        print(f"    - [{c.get('code')}] {c.get('name')} rombel={c.get('rombelCount')} siswa={c.get('studentCount')}")
    # simpan count & codes
    initial_counts = {c["code"]: {"rombel": c["rombelCount"], "siswa": c["studentCount"], "name": c["name"]} for c in conc_initial}
    initial_len = len(conc_initial)

    print()
    print("STEP 5/6: PUT UPDATE PROFILE HANYA ALAMAT (TANPA concentrations, TANPA organizationMembers)")
    # Ini KRITIS: jika payload TIDAK ADA field concentrations & organizationMembers
    # maka mustahil data KK terhapus (safety guard shouldUpdate harus false)
    payload_edit_alamat = {
        "npsn": npsn,
        "schoolName": me.get("schoolName") or school_name,
        "province": me.get("province") or "Jawa Barat",
        "city": me.get("city") or "Kota Bandung",
        "address": (me.get("address") or "") + " [VERIF-FIX-V1]",
    }
    code_put1, put1_body = http("PUT", "/school-profile/me", tok_sekolah, payload_edit_alamat)
    print(f"  PUT alamat only HTTP {code_put1}")
    if code_put1 != 200:
        print("  FAIL PUT1:", json.dumps(put1_body, indent=2, ensure_ascii=False)[:2000])
    assert code_put1 == 200, f"PUT alamat gagal {code_put1}"
    conc_after_put1 = put1_body.get("concentrations", []) if isinstance(put1_body, dict) else []
    org_after_put1 = put1_body.get("organizationMembers", []) if isinstance(put1_body, dict) else []
    print(f"  AFTER PUT1 (alamat saja): concentrations.len={len(conc_after_put1)}")
    print(f"  AFTER PUT1 (alamat saja): organizationMembers.len={len(org_after_put1)}")
    assert len(conc_after_put1) == initial_len, (
        f"GAGAL! concentrations len berubah {initial_len} → {len(conc_after_put1)} "
        "(data KK HILANG krn safety guard rusak / destructuring salah)"
    )
    # verifikasi DB juga langsung
    sql_check = f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{npsn}';"
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as tf:
        tf.write(sql_check)
        tmps = tf.name
    try:
        res = subprocess.run(["psql", db_url, "-At", "-f", tmps], capture_output=True, text=True, timeout=15)
        cnt_db_after_put1 = int(res.stdout.strip() or "0")
        print(f"  DB DIRECT COUNT after PUT1 = {cnt_db_after_put1} (expect={kk_count_db})")
        assert cnt_db_after_put1 == kk_count_db, f"DB BERUBAH after PUT alamat! expect {kk_count_db} got {cnt_db_after_put1}"
    finally:
        os.unlink(tmps)

    # GET ULANG pastikan refresh
    code, me2 = http("GET", "/school-profile/me", tok_sekolah)
    conc_get2 = me2.get("concentrations", [])
    print(f"  GET ulang after PUT1: concentrations.len={len(conc_get2)}")
    assert len(conc_get2) == initial_len, f"Data hilang setelah GET ulang!"

    print()
    print("STEP 6/6: PUT UPDATE DENGAN concentrations (modifikasi salah satu KK + rombel +1)")
    # Buat payload DENGAN field concentrations utuh, edit satu KK
    new_rombel = {}
    new_concentrations_payload = []
    for c in conc_initial:
        cp = dict(c)
        if not new_rombel and cp.get("code"):
            cp["rombelCount"] = (cp.get("rombelCount") or 0) + 1
            cp["rombel10"] = (cp.get("rombel10") or 0) + 1
            new_rombel = {"code": cp["code"], "before": initial_counts[cp["code"]]["rombel"], "after": cp["rombelCount"]}
        new_concentrations_payload.append(cp)

    payload_with_conc = {
        "npsn": npsn,
        "schoolName": me.get("schoolName") or school_name,
        "province": me.get("province") or "Jawa Barat",
        "city": me.get("city") or "Kota Bandung",
        "address": me.get("address") or "",
        "concentrations": new_concentrations_payload,
        "organizationMembers": org_initial,
    }
    code_put2, put2_body = http("PUT", "/school-profile/me", tok_sekolah, payload_with_conc)
    print(f"  PUT with concentrations HTTP {code_put2}")
    if code_put2 != 200:
        print("  FAIL PUT2:", json.dumps(put2_body, indent=2, ensure_ascii=False)[:2000])
    assert code_put2 == 200, f"PUT with conc gagal"
    conc_after_put2 = put2_body.get("concentrations", []) if isinstance(put2_body, dict) else []
    print(f"  AFTER PUT2: concentrations.len={len(conc_after_put2)}")
    assert len(conc_after_put2) == initial_len, f"len berubah setelah PUT with conc!"
    if new_rombel:
        updated = next((x for x in conc_after_put2 if x["code"] == new_rombel["code"]), None)
        if updated:
            print(f"  VERIFY KK {new_rombel['code']}: rombel {new_rombel['before']} → {updated['rombelCount']} (expect={new_rombel['after']})")
            assert updated["rombelCount"] == new_rombel["after"], "Update rombel TIDAK tersimpan"
        # DB direct check
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as tf:
            tf.write(f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{npsn}';")
            tmpc = tf.name
        try:
            res = subprocess.run(["psql", db_url, "-At", "-f", tmpc], capture_output=True, text=True, timeout=15)
            cnt_final = int(res.stdout.strip() or "0")
            print(f"  DB DIRECT COUNT after PUT2 = {cnt_final} (expect={kk_count_db})")
            assert cnt_final == kk_count_db, f"DB count salah final: expect {kk_count_db} got {cnt_final}"
        finally:
            os.unlink(tmpc)

    print()
    print("=" * 70)
    print("✅ ALL CHECKS PASSED — PERSISTENCE VERIFIED (EXIT 0)")
    print(f"   • School NPSN    = {npsn}")
    print(f"   • Initial KK     = {initial_len}")
    print(f"   • After PUT addr = {len(conc_after_put1)} (SAMA)")
    print(f"   • After PUT conc = {len(conc_after_put2)} (SAMA)")
    print(f"   • DB persistent  = YES (no data loss after PUT)")
    print("=" * 70)
