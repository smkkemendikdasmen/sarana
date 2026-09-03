#!/usr/bin/env python3
"""FIX PRODUKSI Nginx: pastikan proxy_pass /api/ pakai TRAILING SLASH agar prefix /api terhapus."""
import paramiko, sys, os
HOST="103.160.202.73"
USER="alatprods"
PWD="saranasmkApp123!Prod"

def rc(client, cmd, timeout=20, sudo=False):
    if sudo:
        full = f"sudo -S -p '' bash -c {repr(cmd)}"
    else:
        full = cmd
    stdin, stdout, stderr = client.exec_command(full, timeout=timeout)
    if sudo:
        stdin.write(PWD + "\n"); stdin.flush()
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    exitcode = stdout.channel.recv_exit_status()
    return exitcode, out.strip(), err.strip()

def main():
    print(f"[*] SSH connect {USER}@{HOST} ...")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(HOST, username=USER, password=PWD, timeout=15, banner_timeout=15, auth_timeout=15)
    except Exception as e:
        print(f"[X] SSH CONNECT FAILED: {e}"); sys.exit(1)
    print("[√] SSH connected.\n")

    # STEP 1: PM2 & port status
    print("[1] PM2 status + listening ports:")
    code,out,err = rc(c, "export PATH=$PATH:/usr/local/bin:/home/alatprods/.nvm/versions/node/*/bin; which pm2; pm2 list 2>&1 | head -40; echo '---LISTEN---'; ss -ltnp 2>/dev/null | grep -E ':(3000|4000|80|443)' | head -10 || netstat -ltnp 2>/dev/null | head -10")
    print(f"    RC={code}")
    print(out[:3000])
    if err: print("    STDERR:", err[:400])
    print()

    # STEP 2: Read CURRENT nginx config for saranasmk
    print("[2] Current Nginx saranasmk config:")
    candidates = ["/etc/nginx/sites-available/saranasmk", "/etc/nginx/conf.d/saranasmk.conf", "/etc/nginx/conf.d/default.conf", "/etc/nginx/sites-enabled/default"]
    found_cfg = None
    for path in candidates:
        code, out, err = rc(c, f"cat {path} 2>/dev/null && echo FOUND || echo NONE")
        if "FOUND" in out:
            print(f"    === {path} ===")
            print(out.replace("FOUND","").strip()[:4000])
            found_cfg = path
            break
    if not found_cfg:
        print("    ! Dumping nginx -T ...")
        code, out, err = rc(c, "nginx -T 2>&1 | grep -v '^#' | grep -v '^\s*$' | head -200", sudo=True)
        print(out[:5000])
    print()

    # STEP 3: DIRECT TEST backend ports
    print("[3] Direct test API (port 4000) and WEB (port 3000) on server:")
    code,out,err = rc(c, "curl -s -o /dev/null -w 'API_4000_HEALTH_V1=%{http_code}\\n' --max-time 6 http://127.0.0.1:4000/v1/health; curl -s -o /dev/null -w 'WEB_3000_ROOT=%{http_code}\\n' --max-time 6 http://127.0.0.1:3000/; echo ---BODY_API---; curl -s --max-time 7 http://127.0.0.1:4000/v1/health | head -c 300; echo; echo ---BODY_WEB---; curl -s --max-time 7 http://127.0.0.1:3000/ | head -c 300")
    print(out)
    if err: print("   STDERR:", err[:300])
    print()

    # STEP 4: PATCH NGINX — enforce trailing slash on /api proxy_pass
    print("[4] APPLY Nginx FIX — /api/ -> http://127.0.0.1:4000/ (trailing slash is mandatory)")
    patch_script = r'''
python3 << 'PYINNER'
import re, os, glob

candidates = ["/etc/nginx/sites-available/saranasmk", "/etc/nginx/conf.d/saranasmk.conf", "/etc/nginx/sites-enabled/saranasmk"]
cfg = None
for p in candidates:
    if os.path.isfile(p):
        cfg = p; break
if cfg is None:
    for p in glob.glob("/etc/nginx/sites-enabled/*") + glob.glob("/etc/nginx/conf.d/*.conf"):
        with open(p) as f: data = f.read()
        if "saranasmk" in data or "4000" in data:
            cfg = p; break
if not cfg:
    print("NO_CONFIG_FOUND")
    raise SystemExit(1)
print("USING_CONFIG:", cfg)
with open(cfg) as f: data = f.read()
original = data

# Rule A: location ~ ^/api/  — pastikan proxy_pass BERAKHIR /
def fix_api_block(text):
    pattern = r'(location\s*(?:~\s*)?[\'"]?\^?/api(?:/\|[_/\w])*[\'"]?\s*\{[^{}]*proxy_pass\s+http://[^;\s]+)(/?)(\s*;)'
    def sub(m):
        prefix = m.group(1); slash = m.group(2); end = m.group(3)
        if not slash:
            return prefix + "/" + end
        return m.group(0)
    new_text, n = re.subn(pattern, sub, text)
    # Simpler fallback: any proxy_pass with /api path pointing to :4000 (no trailing)
    if n == 0:
        new_text2 = re.sub(r'(proxy_pass\s+http://(?:127\.0\.0\.1|localhost):4000)(\s*;)', r'\1/\2', new_text)
        if new_text2 != new_text:
            new_text = new_text2; n += 1
    return new_text, n

data, n_changes = fix_api_block(data)
# Simple check: setiap proxy_pass ke port upstream untuk /api akhiri /
if data == original:
    # Brute force: every proxy_pass to port 4000 without trailing slash
    data2 = re.sub(r'(proxy_pass\s+http://\S+:4000)(\s*;)', r'\1/\2', data)
    if data2 != data:
        data = data2; n_changes += 1

if data != original:
    import shutil
    shutil.copy2(cfg, cfg + ".bak." + str(int(__import__('time').time())))
    with open(cfg, "w") as f: f.write(data)
    print("PATCHED_changes:", n_changes, "-> written")
else:
    print("NO_CHANGES_NEEDED")
PYINNER
'''.strip()
    code, out, err = rc(c, patch_script, sudo=True)
    print(f"    RC={code}")
    print(out)
    if err: print("    STDERR:", err[:500])
    print()

    # STEP 5: nginx -t then reload
    print("[5] nginx -t && nginx -s reload:")
    code, out, err = rc(c, "nginx -t 2>&1 && nginx -s reload 2>&1 || (echo 'RELOAD_FAILED_\\nexit_nginx_t'; nginx -t)", sudo=True)
    print(f"    RC={code}\n    OUTPUT:")
    print((out + "\n" + err).strip()[:2500])
    print()

    # STEP 6: RE-TEST endpoints after fix
    print("[6] POST-FIX production endpoint test (from local machine):")
    import urllib.request, json, ssl
    ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
    tests = [
        ("PROD_ROOT",       "https://saranasmk.id"),
        ("PROD_API_V1HLT",  "https://saranasmk.id/api/v1/health"),
        ("PROD_API_ROOT",   "https://saranasmk.id/api/health"),
    ]
    for n,u in tests:
        try:
            req = urllib.request.Request(u, headers={"User-Agent":"fix-nginx/1"})
            with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
                print(f"    ✅ {n:18s} HTTP {r.status:>4d}  ({len(r.read())} bytes)")
        except Exception as e:
            print(f"    ❌ {n:18s} -> {type(e).__name__}: {e}")
    # Test login E2E production
    print("    --- PROD LOGIN E2E ---")
    try:
        data = json.dumps({"email":"admin@saranasmk.id","password":"admin123"}).encode()
        req = urllib.request.Request("https://saranasmk.id/api/v1/auth/login",
            data=data, headers={"User-Agent":"fix-nginx/1","Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
            print(f"    ✅ LOGIN_PROD HTTP {r.status} {r.read()[:200]}")
    except urllib.error.HTTPError as e:
        print(f"    ⚠️  LOGIN_PROD HTTP {e.code} body={e.read()[:200]}")
    except Exception as e:
        print(f"    ❌ LOGIN_PROD ERR {type(e).__name__}: {e}")

    c.close()
    print("\n[DONE] Production fix executed.")

if __name__ == "__main__":
    main()
