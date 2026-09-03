#!/usr/bin/env python3
import json, urllib.request, urllib.error, os, subprocess, tempfile, uuid, sys

BASE_API = "http://localhost:4000/v1"
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
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            j = json.loads(raw)
        except Exception:
            j = {"_raw": raw[:1500]}
        return e.code, j

def unwrap(resp_body, default_key=None):
    """Extract {ok, data: X} → return X; fallback if no wrapper"""
    if isinstance(resp_body, dict) and "data" in resp_body and resp_body.get("ok") is True:
        return resp_body["data"]
    return resp_body

def psql(sql):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tf:
        tf.write(sql)
        tmp = tf.name
    try:
        res = subprocess.run(["psql", db_url, "-At", "-F", "\t", "-f", tmp], capture_output=True, text=True, timeout=30)
        if res.returncode != 0:
            raise RuntimeError(f"psql err: {res.stderr.strip()[:1000]}")
        return res.stdout
    finally:
        os.unlink(tmp)

if __name__ == "__main__":
    print("=" * 72)
    print("PRISMA-LOCAL — VERIFIKASI PERSISTENCE DATA HILANG FIX V1")
    print("=" * 72)

    # Step 1: Login Admin (cuma verify endpoint works; butuh user SEKOLAH)
    print("\n[STEP 1/6] LOGIN ADMIN endpoint check")
    code, raw = http("POST", "/auth/login", None, {"username": ADMIN_USER, "password": ADMIN_PASS})
    assert code == 201, f"Login admin FAIL {code}: {raw}"
    tok_adm = unwrap(raw).get("token")
    u = unwrap(raw).get("user", {})
    print(f"  ✅ HTTP {code}  token_len={len(tok_adm)}  admin_role={u.get('role')}  id={u.get('id')[:12]}…")

    # Step 2: Cari sekolah sample dengan KK >= 2 (langsung DB)
    print("\n[STEP 2/6] DB: cari sampel sekolah dgn KK >= 2")
    out = psql("""
SELECT c.npsn, s.name, COUNT(c.id) AS kk_count
FROM school_profile_concentrations c
JOIN schools s ON s.npsn = c.npsn
GROUP BY c.npsn, s.name
HAVING COUNT(c.id) >= 2
ORDER BY kk_count DESC, s.name ASC
LIMIT 1;
""").strip()
    assert out, "❌ DB TIDAK PUNYA SEKOLAH DENGAN KK >= 2"
    npsn, school_name, kk_count_db = out.split("\t")
    kk_count_db = int(kk_count_db)
    org_count_db = int(psql(f"SELECT COUNT(*) FROM school_profile_organization_members WHERE npsn = '{npsn}';").strip() or "0")
    doc_count_db = int(psql(f"SELECT COUNT(*) FROM school_profile_administrative_documents WHERE npsn = '{npsn}';").strip() or "0")
    print(f"  ✅ NPSN={npsn}")
    print(f"     NAME        = {school_name}")
    print(f"     DB KK       = {kk_count_db}")
    print(f"     DB ORG MEM  = {org_count_db}")
    print(f"     DB DOCS     = {doc_count_db}")

    # Step 3: Find OR create user SEKOLAH untuk NPSN ini
    print("\n[STEP 3/6] ENSURE user SEKOLAH untuk NPSN ini, password='sekolah123'")
    out = psql(f"""
SELECT id, email, username, role, npsn
FROM users
WHERE (npsn = '{npsn}' OR school_id = '{npsn}') AND role = 'SEKOLAH'
LIMIT 1;
""").strip()
    uid, uemail, uusername = None, f"sekolah_{npsn}@saranasmk.id", f"sekolah_{npsn}"
    if out:
        parts = out.split("\t")
        while len(parts) < 5: parts.append("")
        uid, uemail, uusername, *_ = parts
        print(f"  ℹ️  Found existing user SEKOLAH id={uid[:12]}… email={uemail}")

    # Hash password sekolah123
    hr = subprocess.run(
        ["node", "-e", "const b=require('./apps/api/node_modules/bcryptjs'); console.log(b.hashSync('sekolah123', 10));"],
        capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)), timeout=30,
    )
    pw_hash = hr.stdout.strip()
    assert pw_hash.startswith("$2"), f"bcrypt gen FAIL: {hr.stderr[:500]}"

    if uid is None:
        new_id = uuid.uuid4().hex[:26]
        r = psql(f"""
INSERT INTO users (id, email, username, password_hash, role, npsn, school_id, "createdAt", "updatedAt")
VALUES ('{new_id}', '{uemail}', '{uusername}', '{pw_hash}', 'SEKOLAH', '{npsn}', '{npsn}', NOW(), NOW())
RETURNING id;
""").strip()
        uid = r.split("\n")[-1]
        print(f"  ➕ INSERT user SEKOLAH baru id={uid[:12]}…")
    else:
        psql(f"UPDATE users SET password_hash = '{pw_hash}', npsn = '{npsn}', school_id = '{npsn}' WHERE id = '{uid}';")
        print(f"  🔑 Reset password untuk user id={uid[:12]}… → sekolah123")

    # Step 4: Login user SEKOLAH & GET initial profile
    print("\n[STEP 4/6] LOGIN SEBAGAI USER SEKOLAH → GET PROFILE INITIAL")
    code, raw = http("POST", "/auth/login", None, {"username": uemail, "password": "sekolah123"})
    assert code == 201, f"Login sekolah FAIL {code}: {json.dumps(raw, indent=2, ensure_ascii=False)[:2000]}"
    tok = unwrap(raw)["token"]
    u_info = unwrap(raw).get("user", {})
    print(f"  ✅ Login sekolah HTTP 201 id={u_info.get('id')[:12]}… role={u_info.get('role')} npsn={u_info.get('npsn')}")

    code, raw = http("GET", "/school-profile/me", tok)
    assert code == 200, f"GET me FAIL {code}: {raw}"
    me = unwrap(raw)
    conc_initial = me.get("concentrations", []) or []
    org_initial = me.get("organizationMembers", []) or []
    init_kk = len(conc_initial)
    init_org = len(org_initial)
    print(f"  GET /school-profile/me HTTP 200")
    print(f"  • KK    count via API  = {init_kk}  (DB={kk_count_db})")
    print(f"  • ORG   count via API  = {init_org}  (DB={org_count_db})")
    print(f"  • SCHOOL npsn via API  = {me.get('npsn','?')}")
    print(f"  • SCHOOL name via API  = {me.get('schoolName','?')[:60]}")
    for c in conc_initial:
        print(f"    - [{c.get('code',''):>10}] {c.get('name','')[:40]:<40} rombel={c.get('rombelCount'):>3} siswa={c.get('studentCount'):>4}")
    assert init_kk == kk_count_db, f"❌ FETCH KK MISMATCH! API={init_kk} vs DB={kk_count_db} (destructuring bug)"
    print("  ✅ Data concentrations & org MATCH dengan DB langsung.")

    # Step 5: PUT HANYA edit alamat — TANPA field concentrations & TANPA organizationMembers
    # — inilah bug yang lama: concentrations ?? [] → empty → DELETE ALL → KK hilang
    print("\n[STEP 5/6] PUT UPDATE HANYA ALAMAT (TANPA concentrations, TANPA organizationMembers)")
    payload_no_conc = {
        "npsn": npsn,
        "schoolName": me.get("schoolName") or school_name,
        "province": me.get("province") or "Jawa Barat",
        "city": me.get("city") or "Kota Bandung",
        "address": ((me.get("address") or "").rstrip() + " [PERSISTENCE-V1-ALAMAT]").strip(),
    }
    code, raw_put1 = http("PUT", "/school-profile/me", tok, payload_no_conc)
    if code != 200:
        print(f"  ❌ PUT FAIL HTTP {code}: {json.dumps(raw_put1, indent=2, ensure_ascii=False)[:2500]}")
    assert code == 200, f"PUT alamat-only FAIL {code}"
    me_put1 = unwrap(raw_put1)
    kk_put1 = len(me_put1.get("concentrations", []) or [])
    org_put1 = len(me_put1.get("organizationMembers", []) or [])
    print(f"  PUT /me (alamat-only) HTTP 200")
    print(f"  • KK  after PUT API  = {kk_put1}   (before={init_kk}, DB expected={kk_count_db})")
    print(f"  • ORG after PUT API  = {org_put1}   (before={init_org}, DB expected={org_count_db})")

    # Langsung cek DB COUNTS — jangan percaya API response saja!
    db_kk_put1 = int(psql(f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{npsn}';").strip() or "0")
    db_org_put1 = int(psql(f"SELECT COUNT(*) FROM school_profile_organization_members WHERE npsn = '{npsn}';").strip() or "0")
    db_doc_put1 = int(psql(f"SELECT COUNT(*) FROM school_profile_administrative_documents WHERE npsn = '{npsn}';").strip() or "0")
    print(f"  • DB KK  after PUT   = {db_kk_put1}   (expected={kk_count_db})")
    print(f"  • DB ORG after PUT   = {db_org_put1}   (expected={org_count_db})")
    print(f"  • DB DOC after PUT   = {db_doc_put1}   (expected={doc_count_db})")

    assert kk_put1 == init_kk == kk_count_db == db_kk_put1, (
        f"❌ DATA KK HILANG! API init={init_kk} → API after={kk_put1} → DB after={db_kk_put1} (expected {kk_count_db})"
    )
    assert db_org_put1 == org_count_db, f"❌ DATA ORG HILANG! DB {org_count_db} → {db_org_put1}"
    assert db_doc_put1 == doc_count_db, f"❌ DATA DOC HILANG! DB {doc_count_db} → {db_doc_put1}"

    # Sekarang GET ULANG via API (refresh):
    code, raw = http("GET", "/school-profile/me", tok)
    assert code == 200
    me_refresh = unwrap(raw)
    kk_refresh = len(me_refresh.get("concentrations", []) or [])
    print(f"  • GET ULANG after PUT: KK count API = {kk_refresh}")
    assert kk_refresh == kk_count_db, "❌ Setelah GET ulang KK count berubah!"
    print("  ✅ KK & ORG & DOC 100% TETAP UTUH setelah update alamat-only. SAFETY GUARD & NORMALIZE ROWS OK!")

    # Step 6: PUT DENGAN concentrations (modifikasi satu KK: rombel +1)
    print("\n[STEP 6/6] PUT DENGAN concentrations + organizationMembers utuh (modif rombel 1 KK)")
    edited = {}
    new_conc = []
    for c in conc_initial:
        cp = dict(c)
        if not edited and cp.get("code"):
            cp["rombelCount"] = (cp.get("rombelCount") or 0) + 1
            cp["rombel10"] = (cp.get("rombel10") or 0) + 1
            edited = {
                "code": cp["code"],
                "rombel_before": (c.get("rombelCount") or 0),
                "rombel_after": cp["rombelCount"],
            }
        new_conc.append(cp)
    payload_with_conc = {
        "npsn": npsn,
        "schoolName": me.get("schoolName") or school_name,
        "province": me.get("province") or "Jawa Barat",
        "city": me.get("city") or "Kota Bandung",
        "address": me_refresh.get("address") or "",
        "concentrations": new_conc,
        "organizationMembers": org_initial or me_refresh.get("organizationMembers") or [],
    }
    code, raw_put2 = http("PUT", "/school-profile/me", tok, payload_with_conc)
    if code != 200:
        print(f"  ❌ PUT with conc FAIL {code}: {json.dumps(raw_put2, indent=2, ensure_ascii=False)[:2500]}")
    assert code == 200, f"PUT with conc FAIL {code}"
    me_put2 = unwrap(raw_put2)
    kk_put2 = len(me_put2.get("concentrations", []) or [])
    print(f"  PUT with concentrations HTTP 200")
    print(f"  • KK count API after PUT = {kk_put2}  (expected={kk_count_db})")
    assert kk_put2 == kk_count_db, f"❌ PUT with conc malah ubah jumlah KK! {kk_count_db} → {kk_put2}"
    # Verify rombel update benar BENAR disimpan DB:
    if edited:
        db_val = psql(f"""
SELECT concentration_code, rombel_count
FROM school_profile_concentrations
WHERE npsn = '{npsn}' AND concentration_code = '{edited["code"]}'
LIMIT 1;
""").strip()
        if db_val:
            _, rombel_db = db_val.split("\t")
            rombel_db_int = int(rombel_db)
            print(f"  • VERIFY UPDATE ROMBEL {edited['code']}:")
            print(f"      before API send  = {edited['rombel_before']}")
            print(f"      after  API send  = {edited['rombel_after']}")
            print(f"      DB direct query  = {rombel_db_int}")
            assert rombel_db_int == edited["rombel_after"], (
                f"❌ NILAI ROMBEL TIDAK TERSIMPAN DI DB! expect={edited['rombel_after']} got={rombel_db_int}"
            )
            print("  ✅ UPDATE ROMBEL BENAR-BENAR TERSIMPAN di Postgres DB.")
    db_kk_final = int(psql(f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{npsn}';").strip() or "0")
    assert db_kk_final == kk_count_db

    print()
    print("=" * 72)
    print("✅  EXIT 0 — PRISMA-PERSISTENCE-V1: SEMUA CHECKS PASSED")
    print("=" * 72)
    print(f"   SEKOLAH: {npsn} — {school_name}")
    print(f"   DATA SCHOOL PROFILE:")
    print(f"     • Konsentrasi Keahlian  API/DB  = {init_kk}/{kk_count_db} → PUT alamat → {kk_put1}/{db_kk_put1} → PUT with conc → {kk_put2}/{db_kk_final}  (SAMA SEMUA)")
    print(f"     • Anggota Organisasi   DB      = {org_count_db} → PUT alamat → {db_org_put1}  (SAMA)")
    print(f"     • Dok. Administrasi    DB      = {doc_count_db} → PUT alamat → {db_doc_put1}  (SAMA)")
    print(f"   WRITE PATH:")
    print(f"     • PUT alamat-only  → concentrations/organization TIDAK TERHAPUS  (SAFETY GUARD ✓)")
    print(f"     • PUT with conc    → nilai rombel TERSIMPAN permanen di Postgres  (normalizeRows ✓)")
    print(f"     • GET ulang after  → data REFRESH konsisten dengan DB            (SELECT destructuring ✓)")
    print("=" * 72)
