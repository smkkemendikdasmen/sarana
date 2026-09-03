#!/usr/bin/env python3
"""PRISMA PROD AUDIT P1 realtime server status"""
import paramiko, select, time, json, ssl, urllib.request, os

HOST = "103.160.202.73"
USER = "alatprods"
PW = "Direktorat5mk123!@#"
ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
os.chdir(ROOT)

def ssh_run(cmd, timeout=60):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PW, timeout=30, banner_timeout=30, auth_timeout=30, allow_agent=False, look_for_keys=False)
    chan = c.get_transport().open_session()
    chan.settimeout(10)
    chan.exec_command(cmd)
    t0 = time.time()
    buf_out, buf_err = b"", b""
    exitcode = None
    while True:
        r, _, _ = select.select([chan], [], [], 1)
        if chan in r:
            while chan.recv_ready(): buf_out += chan.recv(65536)
            while chan.recv_stderr_ready(): buf_err += chan.recv_stderr(65536)
        if chan.exit_status_ready():
            exitcode = chan.recv_exit_status()
            while True:
                r2, _, _2 = select.select([chan], [], [], 0.2)
                if chan not in r2: break
                while chan.recv_ready(): buf_out += chan.recv(65536)
                while chan.recv_stderr_ready(): buf_err += chan.recv_stderr(65536)
            break
        if time.time() - t0 > timeout:
            chan.close(); c.close(); raise TimeoutError(cmd)
    c.close()
    return exitcode, buf_out.decode("utf-8", errors="replace"), buf_err.decode("utf-8", errors="replace")

def https(url, method="GET", body=None):
    ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {"User-Agent":"PRISMA-AUDIT-P1","Accept":"application/json"}
    if body: headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)

if __name__ == "__main__":
    print("=" * 72)
    print("PRISMA PROD AUDIT P1 — REALTIME STATUS saranasmk.id")
    print("=" * 72)
    print()
    print("[1] HTTPS PROBE (self-signed cert bypass):")
    for label, url in [
        ("Root /", "https://saranasmk.id/"),
        ("/api/health", "https://saranasmk.id/api/health"),
        ("/api/v1/health", "https://saranasmk.id/api/v1/health"),
    ]:
        st, _ = https(url)
        prefix = "✅" if st and 200 <= st < 500 else "⚠️ "
        print(f"  {prefix} {label:<24} HTTP {st}")

    print()
    print("[2] LOGIN ENDPOINT via username vs email:")
    st1, j1 = https("https://saranasmk.id/api/v1/auth/login", "POST", {"username":"admin@saranasmk.id","password":"admin123"})
    st2, j2 = https("https://saranasmk.id/api/v1/auth/login", "POST", {"email":"admin@saranasmk.id","password":"admin123"})
    print(f"  • via username  HTTP {st1}")
    print(f"  • via EMAIL     HTTP {st2}")
    try:
        dj1 = json.loads(j1); tok1 = dj1.get("data",{}).get("token") or dj1.get("accessToken"); role1 = ((dj1.get("data") or {}).get("user") or {}).get("role")
        print(f"    username login -> token_len={len(tok1) if tok1 else 'NONE'} role={role1}")
    except Exception: pass
    try:
        dj2 = json.loads(j2); tok2 = dj2.get("data",{}).get("token") or dj2.get("accessToken"); role2 = ((dj2.get("data") or {}).get("user") or {}).get("role")
        if st2 == 201:
            print(f"    EMAIL login    -> token_len={len(tok2) if tok2 else 'NONE'} role={role2}  [DUAL FIELD FIX SUDAH TERDEPLOY]")
        else:
            print(f"    EMAIL login    -> BODY (FAIL): {j2[:400]}  [DUAL FIELD FIX BELUM TERDEPLOY]")
    except Exception as e:
        print(f"    EMAIL parse err {e} body={repr(j2[:400])}")

    print()
    print("[3] SSH CONNECT & SERVER SPECS:")
    rc, out, err = ssh_run("bash -lc 'set -eo pipefail; echo ===UPTIME===; uptime; echo ===MEMORY===; free -h | head -3; echo ===DISK===; df -h / | tail -1; echo ===NGINX===; systemctl is-active nginx 2>&1; echo ===POSTGRES===; pg_lsclusters 2>&1 | head -5; echo ===LISTEN===; ss -lntp 2>/dev/null | grep -E \":(443|80|4000|3000|5432|6379)\" | head -12'")
    print(out)
    if err.strip(): print("STDERR:", err[:1000])

    print("[4] PM2 PROCESS LIST JLIST:")
    rc, out, err = ssh_run("bash -lc 'pm2 jlist 2>&1'")
    try:
        arr = json.loads(out.strip())
        for p in arr:
            n = p.get("name"); s = p["pm2_env"].get("status"); rest = p["pm2_env"].get("restart_time")
            upt_ms = p["pm2_env"].get("pm_uptime") or 0
            up_s = int((time.time()*1000 - upt_ms)/1000) if upt_ms else 0
            up_str = f"{up_s//86400}d{(up_s%86400)//3600:02d}h{(up_s%3600)//60:02d}m" if up_s else "-"
            mem_mb = (p.get("monit") or {}).get("memory", 0) / 1024 / 1024
            cpu = (p.get("monit") or {}).get("cpu", 0)
            print(f"  • {n:<15} status={s:<10} cpu={cpu:>5}% mem={mem_mb:>7.1f}MB restarts={rest:<6} uptime={up_str:<12}")
    except Exception as e:
        print("  parse PM2 fail:", e, "OUTPUT raw:", repr(out[:1000]))

    print()
    print("[5] PM2 ecosystem.config path + /srv/saranasmk dir structure:")
    rc, out, err = ssh_run("bash -lc 'set -e; ls -la /srv 2>&1; echo ---apps---; ls -la /srv/saranasmk 2>&1 | head -20; echo ---api---; ls -la /srv/saranasmk/apps/api 2>&1 | head -15; echo ---env---; ls -la /srv/saranasmk/apps/api/.env* 2>&1; echo ---pm2dump---; ls -la ~/.pm2/dump.pm2 2>&1'")
    print(out)
    if err.strip(): print("STDERR:", err[:800])

    print()
    print("[6] POSTGRES SIZE saranasmk_production:")
    rc, out, err = ssh_run("bash -lc 'sudo -u postgres psql -c \"SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE datname = $$saranasmk_production$$;\" 2>&1'")
    print(out)

    print()
    print("[7] NGINX SITES CONF saranasmk UPSTREAM check:")
    rc, out, err = ssh_run("bash -lc 'sudo -n cat /etc/nginx/sites-enabled/*saranasmk* 2>/dev/null || sudo -n ls /etc/nginx/sites-enabled /etc/nginx/conf.d 2>&1 | head -20'")
    print(out[:3000])
    if err.strip(): print("STDERR:", err[:1500])

    print()
    print("[8] LOGIN DTO auth di API PRODUCTION source ada di server? (catat line DTO jika ada)")
    rc, out, err = ssh_run("bash -lc 'ls /srv/saranasmk/apps/api/dist 2>&1 | head -20; echo ---src_or_dist_auth_dto---; find /srv/saranasmk -maxdepth 6 \\( -name \"login.dto.*\" -o -name \"auth.service.*\" -o -name \"school-profile.service.*\" \\) 2>/dev/null | head -10'")
    print(out)
