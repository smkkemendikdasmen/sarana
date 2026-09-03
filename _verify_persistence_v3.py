#!/usr/bin/env python3
"""PRISMA-LOCAL — PERSISTENCE DATA HILANG FIX V3
- Login USER SEKOLAH ASLI (10105724 / sekolah123)
- GET initial profile, count concentrations via API + DB DIRECT
- PUT update alamat-only (TANPA field concentrations / organizationMembers)
  → ini BUG YANG LAMA: concentrations ?? [] → DELETE ALL existing → KK hilang
- GET ulang + DB DIRECT count → pastikan SAMA
- PUT with concentrations (modif rombel satu KK)
- DB DIRECT pastikan rombel tersimpan
"""
import json, urllib.request, urllib.error, os, subprocess, tempfile, sys

ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
os.chdir(ROOT)
BASE_API = "http://localhost:4000/v1"

# User SEKOLAH ASLI dari DB: username=10105724 email=smkn2langsa75@gmail.com pw=sekolah123
USER = "10105724"
PW = "sekolah123"
NPSN = "10105724"

# Dapatkan DB_URL
env_path = "apps/api/.env"
DB_URL = None
with open(env_path) as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            DB_URL = line.strip().split("=", 1)[1]
            break

def http(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
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
            j = {"_raw": raw[:2000]}
        return e.code, j

def unwrap(body):
    if isinstance(body, dict) and body.get("ok") is True and "data" in body:
        return body["data"]
    return body

def psql(sql):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tf:
        tf.write(sql)
        tmp = tf.name
    try:
        res = subprocess.run(["psql", DB_URL, "-At", "-F", "\x01", "-f", tmp],
                             capture_output=True, text=True, timeout=30)
        if res.returncode != 0:
            print(f"  [psql ERR] {res.stderr.strip()[:1000]}")
            raise RuntimeError(res.stderr.strip()[:1000])
        return res.stdout
    finally:
        os.unlink(tmp)

if __name__ == "__main__":
    print("=" * 74)
    print(" PRISMA LOCAL — VERIFIKASI PERSISTENCE DATA HILANG (FIX V3) ")
    print("=" * 74)

    # STEP 1 — Login user SEKOLAH ASLI via username
    print(f"\n[1/6] LOGIN user SEKOLAH username={USER!r} pw={PW!r}")
    code, raw = http("POST", "/auth/login", None, {"username": USER, "password": PW})
    assert code == 201, f"Login FAIL {code}: {json.dumps(raw, indent=2, ensure_ascii=False)[:2500]}"
    tok = unwrap(raw)["token"]
    u = unwrap(raw).get("user", {})
    print(f"  ✅ HTTP {code} token_len={len(tok)} role=SEKOLAH npsn={u.get('npsn')} id={str(u.get('id',''))[:12]}…")

    # STEP 2 — DB Direct pre-checks
    print(f"\n[2/6] DB DIRECT pre-checks for NPSN={NPSN}:")
    kk_db = int(psql(f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{NPSN}';").strip() or "0")
    org_db = int(psql(f"SELECT COUNT(*) FROM school_profile_organization_members WHERE npsn = '{NPSN}';").strip() or "0")
    doc_db = int(psql(f"SELECT COUNT(*) FROM school_profile_administrative_documents WHERE npsn = '{NPSN}';").strip() or "0")
    print(f"  • Konsentrasi (KK)         DB = {kk_db}")
    print(f"  • Anggota Organisasi       DB = {org_db}")
    print(f"  • Dokumen Administrasi     DB = {doc_db}")
    assert kk_db >= 2, f"Butuh sampel >= 2 KK; cuma ada {kk_db}"

    # STEP 3 — GET /school-profile/me INITIAL
    print(f"\n[3/6] GET /school-profile/me INITIAL")
    code, raw = http("GET", "/school-profile/me", tok)
    assert code == 200, f"GET me FAIL {code}: {raw}"
    me = unwrap(raw)
    conc_initial = me.get("concentrations", []) or []
    org_initial = me.get("organizationMembers", []) or []
    kk_api_0 = len(conc_initial)
    org_api_0 = len(org_initial)
    print(f"  • KK    API count = {kk_api_0}   (DB={kk_db})")
    print(f"  • ORG   API count = {org_api_0}   (DB={org_db})")
    print(f"  • School name     = {me.get('schoolName','')[:65]}")
    print(f"  • School npsn     = {me.get('npsn','')}")
    for c in conc_initial:
        print(f"    [{str(c.get('code','')).rjust(10)}] {str(c.get('name','')).ljust(36)[:36]} rombel={c.get('rombelCount'):>3} siswa={c.get('studentCount'):>4}")
    assert kk_api_0 == kk_db, (
        f"❌ DESTRUCTURING BUG MASIH ADA! API return {kk_api_0} KK, padahal DB ada {kk_db}. "
        f"Promise.all [0] cuma ambil 1 row pertama!"
    )
    print("  ✅ API SELECT konsentrasi SAMA DENGAN DB (normalizeRows di Promise.all WORK!)")

    # STEP 4 — PUT update alamat ONLY — TANPA concentrations, TANPA organizationMembers
    print(f"\n[4/6] PUT /school-profile/me HANYA UPDATE ALAMAT (safety guard test)")
    print("  ⚠️  ini TEST KRITIS: jika field concentrations TIDAK ADA di payload,")
    print("     maka KK existing TIDAK BOLEH dihapus sedikitpun!")
    addr_new = ((me.get("address") or "").rstrip() + "  [FIX-V3-ALAMAT]").strip()
    payload_safe = {
        "npsn": NPSN,
        "schoolName": me.get("schoolName") or "SMKN 2 LANGSA",
        "province": me.get("province") or "ACEH",
        "city": me.get("city") or "LANGSA",
        "address": addr_new,
    }
    code, raw_put = http("PUT", "/school-profile/me", tok, payload_safe)
    if code != 200:
        print(f"  PUT FAIL {code}: {json.dumps(raw_put, indent=2, ensure_ascii=False)[:3000]}")
    assert code == 200, f"PUT alamat-only FAIL {code}"
    me_put = unwrap(raw_put)
    kk_api_1 = len(me_put.get("concentrations", []) or [])
    org_api_1 = len(me_put.get("organizationMembers", []) or [])
    print(f"  • KK    after PUT API count = {kk_api_1}   (BEFORE={kk_api_0} | DB EXPECT={kk_db})")
    print(f"  • ORG   after PUT API count = {org_api_1}   (BEFORE={org_api_0} | DB EXPECT={org_db})")
    print(f"  • Address terupdate?        = {(me_put.get('address','').endswith('[FIX-V3-ALAMAT]'))}")

    # DB DIRECT AFTER PUT alamat
    kk_db_1 = int(psql(f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{NPSN}';").strip() or "0")
    org_db_1 = int(psql(f"SELECT COUNT(*) FROM school_profile_organization_members WHERE npsn = '{NPSN}';").strip() or "0")
    doc_db_1 = int(psql(f"SELECT COUNT(*) FROM school_profile_administrative_documents WHERE npsn = '{NPSN}';").strip() or "0")
    print(f"  • KK    DB DIRECT  after PUT = {kk_db_1}   (before={kk_db})")
    print(f"  • ORG   DB DIRECT  after PUT = {org_db_1}   (before={org_db})")
    print(f"  • DOC   DB DIRECT  after PUT = {doc_db_1}   (before={doc_db})")

    assert kk_db_1 == kk_db, (
        f"❌ ❌ ❌ DATA KK HILANG di DB! Sebelum PUT={kk_db}, SESUDAH PUT alamat={kk_db_1}. "
        f"Bug SAFETY GUARD shouldUpdateConcentrations=false TIDAK BEKERJA — concentrations selalu DELETE ALL."
    )
    assert org_db_1 == org_db, f"❌ DATA ORG HILANG! before={org_db} after={org_db_1}"
    assert doc_db_1 == doc_db, f"❌ DATA DOC HILANG! before={doc_db} after={doc_db_1}"
    assert kk_api_1 == kk_db == kk_db_1, f"❌ API return salah KK after PUT"
    print("  ✅ SAFETY GUARD ✅ & NORMALIZE ROWS ✅  — TIDAK ADA DATA KK/ORG/DOC YANG HILANG!")

    # STEP 5 — GET ULANG after PUT (refresh dari DB read path)
    print(f"\n[5/6] GET /school-profile/me LAGI (refresh)")
    code, raw = http("GET", "/school-profile/me", tok)
    assert code == 200
    me2 = unwrap(raw)
    kk_api_2 = len(me2.get("concentrations", []) or [])
    org_api_2 = len(me2.get("organizationMembers", []) or [])
    print(f"  • KK    GET REFRESH API count = {kk_api_2}   (DB={kk_db_1})")
    print(f"  • ORG   GET REFRESH API count = {org_api_2}   (DB={org_db_1})")
    assert kk_api_2 == kk_db_1, "❌ Setelah GET ulang, count KK berubah! SELECT destructuring salah."

    # STEP 6 — PUT WITH concentrations (update 1 KK rombel+1)
    print(f"\n[6/6] PUT DENGAN field concentrations + organizationMembers (WRITE test)")
    edited = {}
    new_conc = []
    for c in conc_initial:
        cp = dict(c)
        if not edited and cp.get("code"):
            cp["rombelCount"] = (cp.get("rombelCount") or 0) + 1
            cp["rombel10"] = (cp.get("rombel10") or 0) + 1
            edited = {
                "code": cp["code"],
                "name": cp.get("name", ""),
                "before": c.get("rombelCount") or 0,
                "after": cp["rombelCount"],
            }
        new_conc.append(cp)
    payload_with_conc = {
        "npsn": NPSN,
        "schoolName": me.get("schoolName") or "",
        "province": me.get("province") or "",
        "city": me.get("city") or "",
        "address": me2.get("address") or "",
        "concentrations": new_conc,
        "organizationMembers": org_initial or me2.get("organizationMembers") or [],
    }
    code, raw_put2 = http("PUT", "/school-profile/me", tok, payload_with_conc)
    if code != 200:
        print(f"  FAIL {code}: {json.dumps(raw_put2, indent=2, ensure_ascii=False)[:3000]}")
    assert code == 200, f"PUT with conc FAIL {code}"
    me_put2 = unwrap(raw_put2)
    kk_api_3 = len(me_put2.get("concentrations", []) or [])
    print(f"  • KK count after PUT with conc API = {kk_api_3}  (DB expect={kk_db})")
    assert kk_api_3 == kk_db, f"Jumlah KK BERUBAH padahal cuma update value! {kk_db} → {kk_api_3}"

    # Verify rombel update value tersimpan permanen via DB DIRECT
    if edited:
        out = psql(f"""
SELECT concentration_code, concentration_name, rombel_count
FROM school_profile_concentrations
WHERE npsn = '{NPSN}' AND concentration_code = '{edited["code"]}'
LIMIT 1;
""").strip()
        if out:
            _code, _name, _rombel_db = out.split("\x01")
            rombel_db_int = int(_rombel_db or 0)
            print(f"\n  🔍 VERIFY UPDATE VALUE KONSENTRASI:")
            print(f"     • kode KK         = {edited['code']}")
            print(f"     • nama KK         = {edited['name']}")
            print(f"     • rombel BEFORE   = {edited['before']}")
            print(f"     • rombel REQUEST  = {edited['after']}")
            print(f"     • rombel DB       = {rombel_db_int}")
            assert rombel_db_int == edited["after"], (
                f"❌ UPDATE ROMBEL TIDAK TERSIMPAN DI DB! Request {edited['after']} tapi DB {rombel_db_int}"
            )
            print("  ✅ NILAI UPDATE BENAR-BENAR TERSIMPAN PERMANEN di Postgres.")
    kk_db_final = int(psql(f"SELECT COUNT(*) FROM school_profile_concentrations WHERE npsn = '{NPSN}';").strip() or "0")
    assert kk_db_final == kk_db, f"Count KK DB berubah setelah PUT with conc! {kk_db} vs {kk_db_final}"

    # LOGOUT + LOGIN LAGI simulasikan = GET me lagi + check counts.
    print(f"\n[BONUS] SIMULASI LOGOUT → LOGIN LAGI → GET profile (refresh persistence)")
    code, raw = http("POST", "/auth/login", None, {"username": USER, "password": PW})
    assert code == 201
    tok2 = unwrap(raw)["token"]
    code, raw = http("GET", "/school-profile/me", tok2)
    assert code == 200
    me3 = unwrap(raw)
    kk_final = len(me3.get("concentrations", []) or [])
    org_final = len(me3.get("organizationMembers", []) or [])
    print(f"  • KK    after re-login API count = {kk_final}   (DB={kk_db_final})")
    print(f"  • ORG   after re-login API count = {org_final}   (DB={org_db_1})")
    assert kk_final == kk_db_final, "❌ Setelah re-login data KK BERUBAH!"
    print("  ✅ Re-login → KK & ORG KONSISTEN dengan DB. TIDAK PERNAH HILANG!")

    print()
    print("=" * 74)
    print("✅  EXIT 0 — SEMUA VERIFIKASI PERSISTENCE LULUS (6/6)")
    print("=" * 74)
    print(f"   SCHOOL: {NPSN} — {me.get('schoolName')}")
    print()
    print(f"   READ PATH (SELECT):")
    print(f"   ✅ GET /me → konsentrasi  {kk_api_0}/{kk_db}  ✔ COK (normalizeRows Promise.all destructuring tuple ok)")
    print()
    print(f"   WRITE PATH SAFETY GUARD (TIDAK kirim field concentrations/organization):")
    print(f"   ✅ PUT alamat-only → KK DB {kk_db} → {kk_db_1}  ✔ SAMA (shouldUpdateConcentrations=false  → TIDAK DELETE ALL)")
    print(f"   ✅ PUT alamat-only → ORG DB {org_db} → {org_db_1} ✔ SAMA")
    print(f"   ✅ PUT alamat-only → DOC DB {doc_db} → {doc_db_1} ✔ SAMA")
    print()
    print(f"   WRITE PATH WITH PAYLOAD COMPLETE (kirim field concentrations):")
    if edited:
        print(f"   ✅ PUT with conc → rombel {edited['code']} DB = {rombel_db_int} == REQUEST {edited['after']}  ✔ TERSIMPAN")
    print(f"   ✅ PUT with conc → KK count {kk_db} → {kk_db_final}  ✔ SAMA (tidak ada KK hilang)")
    print()
    print(f"   LOGOUT + LOGIN SIMULASI:")
    print(f"   ✅ re-login GET /me → KK {kk_final}/{kk_db_final} ORG {org_final}/{org_db_1}  ✔ PERSISTEN PERMANEN")
    print("=" * 74)
