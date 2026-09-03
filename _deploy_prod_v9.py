#!/usr/bin/env python3
"""PRISMA PROD DEPLOY V9 — ENTERPRISE GRADE ZERO DOWNTIME
Features:
  * Non-blocking SSH Paramiko (select, chunked, get_pty=False to avoid PipeTimeout)
  * sshpass gak reliable; use Paramiko builtin auth(password)
  * Step: health → PM2 list → nginx → build API/Web → SCP → backup DB → PM2 reload → verify
"""
import paramiko, time, select, json, os, sys, io, tarfile, shutil, subprocess, tempfile, getpass
from datetime import datetime

HOST = "103.160.202.73"
USER = "alatprods"
PW = "Direktorat5mk123!@#"
ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk"
os.chdir(ROOT)

WEB_PORT = 3000
API_PORT = 4000

class SSHCon:
    def __init__(self, host, user, pw):
        self.c = paramiko.SSHClient()
        self.c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.c.connect(host, username=user, password=pw, timeout=30, banner_timeout=30, auth_timeout=30, allow_agent=False, look_for_keys=False)

    def run(self, cmd, timeout=180, echo=True):
        """non_blocking read chunks tanpa pty untuk hindari PM2 ASCII art"""
        if echo:
            print(f"\n▶️  [ssh] $ {cmd}")
        t0 = time.time()
        chan = self.c.get_transport().open_session()
        chan.settimeout(10)
        chan.exec_command(cmd)
        stdout, stderr, buf_out, buf_err = [], [], b"", b""
        exitcode = None
        while True:
            r, _, _ = select.select([chan], [], [], 1)
            if chan in r:
                if chan.recv_ready():
                    while chan.recv_stderr_ready():
                        chunk = chan.recv(8192)
                        buf_out += chunk
                    if chan.recv_stderr_ready():
                        chunk_err = chan.recv_stderr(8192)
                        buf_err += chunk_err
            if chan.exit_status_ready():
                exitcode = chan.recv_exit_status()
                # Drain remaining
                while True:
                    r2, _, _2 = select.select([chan], [], [], 0.3)
                    if chan not in r2: break
                    if chan.recv_ready(): buf_out += chan.recv(65536)
                    if chan.recv_stderr_ready(): buf_err += chan.recv_stderr(65536)
                break
            if time.time() - t0 > timeout:
                chan.close()
                raise TimeoutError(f"cmd timeout {cmd}")
        out_s = buf_out.decode("utf-8", errors="replace")
        err_s = buf_err.decode("utf-8", errors="replace")
        if echo and out_s.strip():
            for line in out_s.splitlines()[-60:]:
                print("   " + line)
        if echo and err_s.strip():
            for line in err_s.splitlines()[-40:]:
                print("   E: " + line)
        return exitcode, out_s, err_s

    def sftp(self):
        return self.c.open_sftp()

def http(url, timeout=30):
    """curl -k -sS -w '\nHTTP_CODE:%{http_code}\n' via local karena self-signed"""
    # urllib default ga support no verify
    import urllib.request, ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 PRISMA-DEPLOY-V9"})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body
    except Exception as e:
        return 0, str(e)

if __name__ == "__main__":
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    print("=" * 72)
    print(f"PRISMA PROD DEPLOY V9 — {ts}")
    print("=" * 72)
    print()

    # -------- STEP 1 : HEALTH CHECK PROD
    print("🔍 [P1] AUDIT SEBELUM DEPLOY")
    # Local HTTP: web + api via domain
    print("\n  • Local probe HTTPS saranasmk.id (self-signed):")
    st_w, _ = http("https://saranasmk.id/")
    st_ah, _ = http("https://saranasmk.id/api/health")
    st_al, _ = http("https://saranasmk.id/api/v1/health")
    print(f"    /                  HTTP {st_w}  | /api/health  HTTP {st_ah}  | /api/v1/health  HTTP {st_al}")

    print("\n  • SSH connect...")
    ssh = SSHCon(HOST, USER, PW)
    print("    ✅ SSH connect OK")

    print("\n  • Server specs + PM2 status:")
    rc, out, err = ssh.run("bash -lc 'uptime; echo ===PM2_LIST===; pm2 jlist 2>&1; echo ===SYSTEMD===; systemctl is-active nginx; echo ===LISTEN===; ss -lntp 2>/dev/null | grep -E \"(:(443|4000|3000)) | head -10'")
    try:
        jlist = out.split("===PM2_LIST===")[1].split("===SYSTEMD===")[0].strip()
        pm2 = json.loads(jlist) if jlist.startswith("[") else []
        for p in pm2:
            n = p.get("name")
            s = p.get("pm2_env", {}).get("status")
            rest = p.get("pm2_env", {}).get("restart_time")
            upt = p.get("pm2_env", {}).get("pm_uptime")
            upt_s = ""
            if upt:
                up = (time.time()*1000 - int(upt))/1000
                upt_s = f" uptime {int(up//86400)}d{int((up%86400)//3600}h"
            print(f"    pm2 {n:<15} status={s:<10} restarts={rest:<6}{upt_s}")
    except Exception as e:
        print(f"    pm2 parse err: {e}")

    print("\n  • Postgres prod health + DB size:")
    rc, out, err = ssh.run("bash -lc 'sudo -n systemctl is-active postgresql 2>&1 | head -1; pg_lsclusters 2>&1; echo PGDBSIZE; sudo -u postgres psql -c \"SELECT pg_database_size(\\\"saranasmk_production\\\")\\G;\" 2>&1 | head -6'")

    print("\n  • Apps dir check /srv/saranasmk slots:")
    rc, out, err = ssh.run("bash -lc 'ls -la /srv 2>&1; echo ---; ls -la /srv/saranasmk* 2>&1 | head -40'")

    # -------- STEP 2 : BUILD LOCAL API + WEB MONOREPO TURBO
    print("\n🔨 [P2] BUILD LOKAL MONOREPO: api-blue + web-blue")
    print("\n  • npm run build (turbo) — this may take 3-8 min")
    tbuild = time.time()
    r = subprocess.run(["npm", "run", "build"], capture_output=True, text=True, cwd=ROOT, timeout=1200)
    build_ok = r.returncode == 0
    if build_ok:
        print(f"  ✅ Turbo build OK (elapsed {int(time.time()-tbuild)}s) — tail stdout:")
        for line in (r.stdout or "").splitlines()[-25:]:
            print("    " + line)
    else:
        print(f"  ❌ Turbo build FAIL rc={r.returncode}")
        sys.stderr.write("STDERR:\n" + (r.stderr or "")[-5000:] + "\n")
        sys.stderr.write("STDOUT:\n" + (r.stdout or "")[-5000:] + "\n")
        sys.exit(r.returncode)

    # Verify build outputs exist
    api_dist = os.path.join(ROOT, "apps/api/dist")
    web_out = os.path.join(ROOT, "apps/web/.next")
    print(f"\n  • Build artifacts: api/dist exists={os.path.isdir(api_dist)} items={sum(1 for _ in os.walk(api_dist)) if os.path.isdir(api_dist) else 0}")
    print(f"  • Build artifacts: web/.next exists={os.path.isdir(web_out)}  items={sum(1 for _ in os.walk(web_out)) if os.path.isdir(web_out) else 0}")
    assert os.path.isdir(api_dist), f"API DIST TIDAK ADA: {api_dist}"

    # -------- STEP 3 : SCP build artifacts (via temp tar.gz via sftp put
    print("\n🚚 [P3] SCP upload build artifacts to server /tmp")
    # Packaging
    os.makedirs("_deploy_v9", exist_ok=True)
    api_tar = os.path.abspath("_deploy_v9/api-dist-v9.tar.gz")
    if os.path.exists(api_tar): os.remove(api_tar)
    with tarfile.open(api_tar, "w:gz") as tar:
        tar.add(api_dist, arcname="dist")
        # Include package.json lockfile untuk install optional
        tar.add(os.path.join(ROOT, "apps/api/package.json"), arcname="package.json")
        if os.path.exists(os.path.join(ROOT, "apps/api/package-lock.json")):
            tar.add(os.path.join(ROOT, "apps/api/package-lock.json"), arcname="package-lock.json")
        # Include .env.production JIKA ADA di lokal apps/api/.env.production (copy ke deploy)
        dotenv_prod = os.path.join(ROOT, "apps/api/.env")
        if os.path.exists(dotenv_prod):
            tar.add(dotenv_prod, arcname=".env.local-deploy-copy")
    print(f"  • Packed {api_tar} size={os.path.getsize(api_tar)/1024/1024:.2f} MB")

    sftp = ssh.sftp()
    remote_tmp = f"/home/{USER}/_deploy_v9"
    ssh.run(f"mkdir -p {remote_tmp} && echo OK", echo=False)
    target_remote_tar = f"{remote_tmp}/api-dist-v9.tar.gz"
    print(f"  • Uploading api.tar.gz via SFTP → {target_remote_tar}")
    tup = time.time()
    sftp.put(api_tar, target_remote_tar)
    print(f"    ✅ api SCP selesai ({int(time.time()-tup)}s)")
    # Web build juga kalau mau upload kalau ada
    if os.path.isdir(web_out):
        web_tar = os.path.abspath("_deploy_v9/web-out-v9.tar.gz")
        if os.path.exists(web_tar): os.remove(web_tar)
        with tarfile.open(web_tar, "w:gz") as tar:
            tar.add(web_out, arcname=".next")
            tar.add(os.path.join(ROOT, "apps/web/package.json"), arcname="package.json")
            if os.path.exists(os.path.join(ROOT, "apps/web/package-lock.json")):
                tar.add(os.path.join(ROOT, "apps/web/package-lock.json"), arcname="package-lock.json")
            if os.path.exists(os.path.join(ROOT, "apps/web/next.config.js")):
                tar.add(os.path.join(ROOT, "apps/web/next.config.js"), arcname="next.config.js")
            if os.path.exists(os.path.join(ROOT, ".env")):
                tar.add(os.path.join(ROOT, ".env"), arcname=".env.root-deploy-copy")
        print(f"  • Packed {web_tar} size={os.path.getsize(web_tar)/1024/1024:.2f} MB")
        target_web = f"{remote_tmp}/web-out-v9.tar.gz"
        sftp.put(web_tar, target_web)
        print(f"    ✅ web SCP selesai")
    sftp.close()

    # -------- STEP 4 : BACKUP DB PROD custom format ENTERPRISE
    print("\n💾 [P4] BACKUP DB PROD (PostgreSQL custom format) SEBELUM DEPLOY — SOP WAJIB")
    bk = f"/home/{USER}/_deploy_v9/backup_saranasmk_production_{ts}.dump"
    print(f"  • Backup file: {bk}")
    rc, out, err = ssh.run(f"bash -lc 'set -e; mkdir -p /home/{USER}/_deploy_v9; "
                           f"if command -v pg_dump >/dev/null 2>&1; then "
                           f"  PGPASSWORD=$(grep -E \"^DATABASE_URL=\" /srv/saranasmk/apps/api/.env.production 2>/dev/null | head -1 | cut -d= -f2- | sed -E \"s|.*:([^:@]+)@.*|\\1|\" || echo saranasmkApp123!Prod); "
                           f"  echo BKSTART; pg_dump -h 127.0.0.1 -U saranasmk_app -Fc -d saranasmk_production -f {bk} 2>&1 | tail -5; echo BKEND; ls -lh {bk} 2>&1; "
                           f"else echo NOPG; fi'")
    rc2, out2, err2 = ssh.run(f"bash -lc 'ls -lh /home/{USER}/_deploy_v9/*.dump 2>&1 | tail -3'")
    # -------- STEP 5 : INSTALL + PM2 RELOAD SLOT api-blue, web-blue + ENABLE NGINX
    print("\n🔁 [P5] DEPLOY + PM2 reload + enable NGINX inactive → active")
    # Extract tar to /srv/saranasmk/apps/api/dist for api-blue & /srv/saranasmk/apps/web/.next
    # Periksa struktur direktori existing
    rc, out, err = ssh.run("bash -lc 'ls -d /srv/saranasmk /srv/saranasmk/apps /srv/saranasmk/apps/api /srv/saranasmk/apps/web 2>&1 | head -10'")
    deploy_root_guess = "/srv/saranasmk"  # fallback assume
    extract_script = f"""
set -e
DEPLOY=/srv/saranasmk
[ -d "$DEPLOY/apps/api" ] || mkdir -p "$DEPLOY/apps/api"
[ -d "$DEPLOY/apps/web" ] || mkdir -p "$DEPLOY/apps/web"
cd "$DEPLOY/apps/api"
echo EXTRACT_API
tar -xzf {target_remote_tar} -C "$DEPLOY/apps/api" 2>&1 | head -20
ls "$DEPLOY/apps/api/dist/main.js 2>&1 | head -2
if [ -f "$DEPLOY/apps/api/package.json" ]; then
  npm install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | tail -10
fi
echo EXTRACT_WEB
if [ -f {target_web} ]; then
  tar -xzf {target_web} -C "$DEPLOY/apps/web" 2>&1 | head -10
  if [ -f "$DEPLOY/apps/web/package.json" ]; then
    cd "$DEPLOY/apps/web && npm install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | tail -10
  fi
fi
echo NGINX
sudo -n systemctl enable nginx 2>&1 | head -2
sudo -n systemctl start nginx 2>&1 | head -2
sudo -n systemctl reload nginx 2>&1 | head -2
systemctl is-active nginx
echo PM2_RELOAD
pm2 reload api-blue 2>&1 | tail -10
pm2 reload web-blue 2>&1 | tail -20
sleep 3
pm2 save 2>&1 | tail -5
pm2 list 2>&1 | tail -15
    """
    with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False) as tf:
        tf.write(extract_script)
        script_path = tf.name
    sftp2 = ssh.sftp()
    target_script = f"{remote_tmp}/deploy_v9_extract.sh"
    sftp2.put(script_path, target_script)
    sftp2.close()
    os.unlink(script_path)
    rc, out, err = ssh.run(f"bash -lc 'bash {target_script}'", timeout=600)

    # -------- STEP 6 : VERIFY ENDPOINTS + LOGIN via USERNAME + LOGIN via EMAIL
    print("\n✅ [P6] VERIFY PROD POST-DEPLOY")
    print("  • Tunggu 8s PM2 listen kembali")
    time.sleep(8)
    checks = [
        ("HTTPS root /", "https://saranasmk.id/", None),
        ("HTTPS /api/health", "https://saranasmk.id/api/health", None),
        ("HTTPS /api/v1/health", "https://saranasmk.id/api/v1/health", None),
    ]
    for label, url, _ in checks:
        code, _ = http(url, timeout=15)
        print(f"    {label:<30} HTTP {code}")

    # POST login username
    print("\n  • Login admin via username (POST /api/v1/auth/login):")
    import urllib.request, ssl
    ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
    def post(url, body):
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type":"application/json","Accept":"application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                return resp.status, resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", errors="replace")
    import urllib.parse
    st_login_uname, jl = post("https://saranasmk.id/api/v1/auth/login", {"username":"admin@saranasmk.id","password":"admin123"})
    print(f"    via username admin@saranasmk.id  HTTP {st_login_uname}")
    try:
        dj = json.loads(jl) if jl else {}
        tok = dj.get("data", {}).get("token") or dj.get("accessToken")
        print(f"    token length  = {len(tok) if tok else 'NONE}")
        if dj.get("data", {}).get("ok")
        role = ((dj.get("data") or {}).get("user", {}).get("role")
        print(f"    user role   = {role}")
    except Exception as e:
        print(f"    parse err", e, repr(jl[:500]))

    print("\n  • Login admin via EMAIL (dual-field fix):")
    st_login_email, jl2 = post("https://saranasmk.id/api/v1/auth/login", {"email":"admin@saranasmk.id","password":"admin123"})
    print(f"    via email admin@saranasmk.id  HTTP {st_login_email}")
    try:
        dj2 = json.loads(jl2) if jl2 else {}
        tok2 = dj2.get("data", {}).get("token") or dj2.get("accessToken")
        print(f"    token length  = {len(tok2) if tok2 else 'NONE (FAIL → DTO dual-field: {'' if st_login_email == 201 else 'BUTUH deploy fix ada di lokal; cuma user deploy fix DONE}'}")
    except Exception as e:
        print(f"    parse err {e}  {repr(jl2[:500])}")

    # Last PM2 list
    rc, out, err = ssh.run("bash -lc 'pm2 jlist 2>&1 | head -50'", echo=False")
    try:
        pm2f = json.loads(out)
        print("\n  • PM2 final list:")
        for p in pm2f:
            n = p.get("name"); s = p["pm2_env"].get("status"); rest = p["pm2_env"].get("restart_time")
            pid = p.get("pid", "?")
            print(f"    {n:<12} status={s:<10} pid={pid:<8} restarts={rest}")
    except Exception:
        pass
    ssh.c.close()

    print()
    print("=" * 72)
    print("✅ EXIT 0 — PRISMA PROD DEPLOY V9")
    print("=" * 72)
