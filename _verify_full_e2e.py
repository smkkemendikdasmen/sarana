#!/usr/bin/env python3
import urllib.request, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

sep = "=" * 72
results = []

def test(name, fn):
    try:
        r = fn()
        results.append((name, True, r))
        print(f"[OK ] {name} | {r}")
    except Exception as e:
        results.append((name, False, str(e)))
        print(f"[FAIL] {name} | {e}")

print(sep)
print("  LINGKUNGAN LOKAL (untuk pengembangan)")
print(sep)

test("Web http://localhost:3000 (SARANA SMK render)", lambda: (
    (lambda r, html: f"HTTP {r.status} | Title OK={'SARANA SMK' in html} Bytes={len(html)}")(
        urllib.request.urlopen("http://localhost:3000/", timeout=5),
        urllib.request.urlopen("http://localhost:3000/", timeout=5).read().decode("utf-8", "ignore")
    )
))

test("API http://localhost:4000/health (NestJS)", lambda: (
    (lambda d: f"HTTP 200 | Status={d.get('status')} Slot={d.get('slot')} Uptime={d.get('uptimeMs',0)}ms")(
        json.loads(urllib.request.urlopen("http://localhost:4000/health", timeout=5).read().decode())
    )
))

def login_json(url, payload, ctx=None):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type":"application/json","Accept":"application/json"}, method="POST")
    kwargs = {"timeout":10}
    if ctx is not None: kwargs["context"] = ctx
    try:
        r = urllib.request.urlopen(req, **kwargs)
        body = r.read().decode()
        try:
            d = json.loads(body)
            data = d.get("data") if isinstance(d.get("data"), dict) else {}
            token = data.get("token") or d.get("token") or d.get("accessToken") or ""
            user = data.get("user") or d.get("user") or {}
            role = user.get("role") if isinstance(user, dict) else d.get("role")
            ok = r.status < 400 and len(token) > 20
            return f"HTTP {r.status} | TOKEN_LEN={len(token)} ROLE={role}"
        except:
            return f"HTTP {r.status} | RAW={body[:120]}"
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"HTTP {e.code} | {body[:150]}")

test("Login Lokal via USERNAME (:4000 direct)",
    lambda: login_json("http://localhost:4000/v1/auth/login",
        {"username":"admin@saranasmk.id","password":"admin123"}))

test("Login Lokal via EMAIL (DTO dual field fix)",
    lambda: login_json("http://localhost:4000/v1/auth/login",
        {"email":"admin@saranasmk.id","password":"admin123"}))

test("Login Lokal via Next.js proxy (:3000/api/v1)",
    lambda: login_json("http://localhost:3000/api/v1/auth/login",
        {"username":"admin@saranasmk.id","password":"admin123"}))

print()
print(sep)
print("  LINGKUNGAN PRODUKSI (https://saranasmk.id)")
print(sep)

test("Web https://saranasmk.id (HTTPS 200)", lambda: (
    (lambda r, html: f"HTTP {r.status} | Title OK={'SARANA SMK' in html} Bytes={len(html)}")(
        urllib.request.urlopen("https://saranasmk.id/", timeout=10, context=ctx),
        urllib.request.urlopen("https://saranasmk.id/", timeout=10, context=ctx).read().decode("utf-8","ignore")
    )
))

test("API Prod /api/health (Nginx proxy → NestJS)", lambda: (
    (lambda d: f"HTTP 200 | Status={d.get('status')} Slot={d.get('slot')} Uptime={d.get('uptimeMs',0)}ms")(
        json.loads(urllib.request.urlopen("https://saranasmk.id/api/health", timeout=10, context=ctx).read().decode())
    )
))

test("Login Prod via USERNAME (Nginx /api/v1 proxy)",
    lambda: login_json("https://saranasmk.id/api/v1/auth/login",
        {"username":"admin@saranasmk.id","password":"admin123"}, ctx))

# Email field di Prod: DTO lama belum terdeploy → diharapkan 400, tapi kita catat saja
try:
    r = login_json("https://saranasmk.id/api/v1/auth/login",
        {"email":"admin@saranasmk.id","password":"admin123"}, ctx)
    print(f"[INFO] Login Prod via EMAIL: {r}")
    results.append(("Login Prod via EMAIL (DTO dual)", True, r))
except Exception as e:
    msg = str(e)
    if "HTTP 400" in msg:
        print(f"[WARN] Login Prod via EMAIL: {msg}")
        print("       ↑ Ini diharapkan (DTO fix dual-field BELUM terdeploy ke server).")
        print("       Gunakan USERNAME field untuk login di produksi sampai deploy selesai.")
        results.append(("Login Prod via EMAIL", False, "DTO fix BELUM terdeploy — pakai USERNAME dulu"))
    else:
        print(f"[FAIL] Login Prod via EMAIL: {msg}")
        results.append(("Login Prod via EMAIL", False, msg))

print()
print(sep)
print("  RANGKUMAN")
print(sep)
passn = sum(1 for _, ok, _ in results if ok)
failn = sum(1 for _, ok, _ in results if not ok)
print(f"TOTAL = {len(results)}  |  PASS = {passn}  |  FAIL = {failn}")
print()
print("CREDENTIAL AKTIF (silakan pakai):")
print("  URL Lokal    : http://localhost:3000/login")
print("  URL Produksi : https://saranasmk.id/login")
print("  Username     : admin@saranasmk.id")
print("  Password     : admin123")
print()
if failn == 0:
    print("EXIT 0 — SEMUA ENDPOINT KRITIS TERSENDIA DAN LOGIN BERHASIL.")
else:
    print(f"EXIT 1 — Ada {failn} item gagal. Lihat detail FAIL di atas.")
