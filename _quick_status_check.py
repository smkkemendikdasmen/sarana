#!/usr/bin/env python3
import urllib.request, json, ssl, subprocess, sys, os

def http(url, data=None, timeout=8, extra_headers=None):
    try:
        headers={"User-Agent":"status-check/1","Content-Type":"application/json"}
        if extra_headers: headers.update(extra_headers)
        if data is not None:
            req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method="POST")
        else:
            req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            try: s = body.decode('utf-8', errors='replace')[:400]
            except: s = f"BINARY_{len(body)}B"
            return (r.status, s)
    except Exception as e:
        return (-1, f"{type(e).__name__}: {e}")

def main():
    print("=" * 70)
    print("  QUICK STATUS CHECK — SARANASMK")
    print("=" * 70)

    print("\n--- 1. LOCAL SERVICES (Port Listen) ---")
    try:
        out = subprocess.check_output(["lsof", "-i", ":3000,4000,5432,6379", "-P", "-n"], stderr=subprocess.DEVNULL).decode()
        lines = [l for l in out.splitlines() if "LISTEN" in l or "IPv" in l and "(" not in l]
        for l in lines[:15]: print("  ", l[:120])
    except Exception as e:
        print(f"  lsof err: {e}")

    print("\n--- 2. LOCAL ENDPOINTS ---")
    checks = [
        ("WEB_ROOT_3000",   "http://localhost:3000"),
        ("WEB_LOGIN_3000",  "http://localhost:3000/login"),
        ("API_ROOT_4000",   "http://localhost:4000/"),
        ("API_HEALTH_V1",   "http://localhost:4000/v1/health"),
        ("API_HEALTH_ROOT", "http://localhost:4000/health"),
    ]
    for name, url in checks:
        st, body = http(url)
        tag = "✅" if 200 <= st < 400 else ("⚠️" if st > 0 else "❌")
        print(f"  {tag} {name:18s} HTTP {st:>4d}  {body[:120]}")

    print("\n--- 3. LOGIN E2E LOCAL ---")
    st, body = http("http://localhost:4000/v1/auth/login", {"email":"admin@saranasmk.id","password":"admin123"})
    token = None
    if st == 201 or st == 200:
        try:
            d = json.loads(body)
            token = d.get("data", {}).get("accessToken") or d.get("accessToken") or d.get("token")
        except: pass
    tag = "✅" if (st==200 or st==201) and token else ("⚠️" if st>0 else "❌")
    print(f"  {tag} LOGIN_LOCAL   HTTP {st:>4d}  TOKEN={'OK ('+str(len(token))+')' if token else 'NONE'}")
    print(f"         body[:200]: {body[:200]}")

    print("\n--- 4. PRODUCTION ENDPOINTS (saranasmk.id) ---")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    def https_call(url, data=None):
        try:
            headers={"User-Agent":"status-check/1","Content-Type":"application/json"}
            if data is not None:
                req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method="POST")
            else:
                req = urllib.request.Request(url, headers=headers)
                opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
            with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
                body = r.read()
                try: s = body.decode('utf-8', errors='replace')[:400]
                except: s = f"BINARY_{len(body)}B"
                return (r.status, s)
        except Exception as e:
            return (-1, f"{type(e).__name__}: {e}")

    for name, url, data in [
        ("PROD_WEB_ROOT",  "https://saranasmk.id", None),
        ("PROD_WEB_LOGIN", "https://saranasmk.id/login", None),
        ("PROD_API_HLTH",  "https://saranasmk.id/api/v1/health", None),
        ("PROD_API_HLTH2", "https://saranasmk.id/api/health", None),
    ]:
        st, body = https_call(url, data)
        tag = "✅" if 200 <= st < 400 else ("⚠️" if st > 0 else "❌")
        print(f"  {tag} {name:18s} HTTP {st:>4d}  {body[:120]}")

    print("\n--- 5. LOGIN E2E PRODUCTION ---")
    st, body = https_call("https://saranasmk.id/api/v1/auth/login", {"email":"admin@saranasmk.id","password":"admin123"})
    tag = "✅" if (st==200 or st==201) else ("⚠️" if st>0 else "❌")
    print(f"  {tag} LOGIN_PROD    HTTP {st:>4d}  body[:200]: {body[:200]}")

    print("\n" + "="*70)
    print("  END OF REPORT")
    print("="*70)

if __name__ == "__main__":
    main()
