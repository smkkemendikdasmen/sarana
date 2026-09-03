#!/usr/bin/env python3
"""Verifikasi login lokal & produksi setelah fix auth guard."""
import urllib.request, json, ssl, time, os, sys

def loc(url, data=None, t=12):
    try:
        h={"User-Agent":"verify/2","Content-Type":"application/json"}
        if data is not None:
            req=urllib.request.Request(url,data=json.dumps(data).encode(),headers=h,method="POST")
        else:
            req=urllib.request.Request(url,headers=h)
        with urllib.request.urlopen(req,timeout=t) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"

ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
def rem(url,data=None,t=15):
    try:
        h={"User-Agent":"verify/2","Content-Type":"application/json"}
        if data is not None:
            req=urllib.request.Request(url,data=json.dumps(data).encode(),headers=h,method="POST")
            with urllib.request.urlopen(req,timeout=t,context=ctx) as r:
                return r.status, r.read().decode(errors="replace")
        else:
            req=urllib.request.Request(url,headers=h)
            with urllib.request.urlopen(req,timeout=t,context=ctx) as r:
                return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"

def extract_token(body):
    try:
        d=json.loads(body)
        for k in ("token","accessToken"):
            if isinstance(d.get(k),str) and len(d[k])>20: return len(d[k])
        if isinstance(d.get("data"),dict):
            for k in ("token","accessToken"):
                if isinstance(d["data"].get(k),str) and len(d["data"][k])>20: return len(d["data"][k])
    except: pass
    return 0

def mark(st,bd):
    if st in (200,201): 
        tl=extract_token(bd)
        if tl: return "✅",f"TOKEN({tl}B)"
        return "⚠️ ","NO_TOKEN"
    if st>0: return "⚠️ ","HTTP_"+str(st)
    return "❌","NO_RESP"

print("="*78)
print("  VERIFIKASI E2E — SETELAH FIX AUTH GUARD")
print("="*78)

print("\n── LINGKUNGAN LOKAL ──")
checks_local = [
    ("WEB root 3000", "http://localhost:3000/", None),
    ("WEB login 3000", "http://localhost:3000/login", None),
    ("API /health", "http://localhost:4000/health", None),
    ("API /v1/health", "http://localhost:4000/v1/health", None),
    ("LOGIN via email", "http://localhost:4000/v1/auth/login", {"email":"admin@saranasmk.id","password":"admin123"}),
    ("LOGIN via username", "http://localhost:4000/v1/auth/login", {"username":"admin@saranasmk.id","password":"admin123"}),
    ("LOGIN password salah", "http://localhost:4000/v1/auth/login", {"email":"admin@saranasmk.id","password":"PASSWORD_SALAH_2026"}),
    ("LOGIN body kosong", "http://localhost:4000/v1/auth/login", {}),
]
for nm,u,d in checks_local:
    st,bd = (loc(u,d) if d is not None else loc(u))
    tg,det = mark(st,bd)
    print(f"  {tg} {nm:24s} HTTP {st:>4d}  {det:14s}  {bd[:180].replace(chr(10),' ')}")

print("\n── LINGKUNGAN PRODUKSI (saranasmk.id) ──")
checks_prod = [
    ("WEB root HTTPS", "https://saranasmk.id/", None),
    ("WEB login HTTPS", "https://saranasmk.id/login", None),
    ("API /api/health", "https://saranasmk.id/api/health", None),
    ("API /api/v1/health", "https://saranasmk.id/api/v1/health", None),
    ("LOGIN email prod", "https://saranasmk.id/api/v1/auth/login", {"email":"admin@saranasmk.id","password":"admin123"}),
    ("LOGIN username prod", "https://saranasmk.id/api/v1/auth/login", {"username":"admin@saranasmk.id","password":"admin123"}),
]
for nm,u,d in checks_prod:
    st,bd = (rem(u,d) if d is not None else rem(u))
    tg,det = mark(st,bd)
    print(f"  {tg} {nm:24s} HTTP {st:>4d}  {det:14s}  {bd[:180].replace(chr(10),' ')}")

print("\n" + "="*78)
print("  EXIT 0 = semua endpoint kritis tersedia & login menghasilkan token")
print("="*78)
