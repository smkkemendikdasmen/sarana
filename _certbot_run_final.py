#!/usr/bin/env python3
import os, sys, subprocess, traceback
from datetime import datetime
from pathlib import Path

HOST = "103.160.202.73"
USER = "alatprods"
PASS = "Direktorat5mk123!@#"

TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
OUTPUT_LOCAL = Path(f"/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_certbot_out_{TIMESTAMP}.txt")

BUF: list[str] = []
def log(s=""):
    print(s, flush=True)
    BUF.append(str(s))

def save():
    content = "\n".join(BUF) + "\n"
    try:
        OUTPUT_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        sys.stderr.write(f"[SAVE_OK] {OUTPUT_LOCAL} ({len(content)} chars)\n")
    except Exception as e:
        sys.stderr.write(f"[SAVE_FAIL]: {e}\n")
        traceback.print_exc(file=sys.stderr)

def ssh(cmd, timeout=600):
    env = {**os.environ, "SSHPASS": PASS}
    ssh_args = [
        "sshpass", "-e",
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=30",
        "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=10",
        "-o", "LogLevel=ERROR",
        "-p", "22",
        f"{USER}@{HOST}",
        "bash", "-lc", cmd
    ]
    proc = subprocess.Popen(
        ssh_args,
        env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    try:
        out, _ = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        try: out, _ = proc.communicate(timeout=5)
        except: out = ""
        return proc.returncode or -1, out + "\n***TIMEOUT***"
    return proc.returncode, out

def main():
    log("=" * 78)
    log(f"CERTBOT LETSENCRYPT — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"Target: {USER}@{HOST}")
    log("=" * 78)
    log()
    save()

    sys.stderr.write("MAIN STARTED\n")
    sys.stderr.flush()

    log(">>> [LOCAL] which sshpass:")
    r = subprocess.run(["which", "sshpass"], capture_output=True, text=True)
    log(f"  rc={r.returncode} stdout={r.stdout.strip()} stderr={r.stderr.strip()}")

    log(">>> [LOCAL] sshpass -V:")
    r = subprocess.run(["sshpass", "-V"], capture_output=True, text=True)
    log(f"  rc={r.returncode} stdout+stderr={(r.stdout+r.stderr).strip()[:500]}")
    save()

    log("")
    log(">>> [TEST SSH] whoami:")
    rc, out = ssh("whoami && hostname && echo SSH_OK_123", timeout=60)
    log(f"  RC={rc}")
    for line in out.splitlines():
        log(f"  {line}")
    save()

    log("")
    log(">>> [MAIN CERTBOT SCRIPT]")
    log("")

    REMOTE_SCRIPT = r"""set +H
echo '=== T1: CERTBOT INSTALLED? ==='
which certbot 2>&1 || echo 'certbot NOT_FOUND'
echo '=== T2: INSTALL CERTBOT + PLUGIN ==='
sudo -S -p '' bash -c 'apt-get update -qq >/dev/null 2>&1 && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx >/tmp/_certbot_install.log 2>&1; echo RC_INSTALL=$?' < /home/alatprods/.sudopw_final 2>/dev/null || bash -c "echo DireKtorat5mk123!@# | sudo -S -p '' apt-get update -qq >/dev/null 2>&1 ; DEBIAN_FRONTEND=noninteractive echo DireKtorat5mk123!@# | sudo -S -p '' apt-get install -y -qq certbot python3-certbot-nginx >/tmp/_certbot_install.log 2>&1 ; echo RC_INSTALL=\$?"
tail -5 /tmp/_certbot_install.log 2>/dev/null
which certbot && certbot --version 2>&1
echo '=== T3: CERTBOT WEBROOT (NON-INTERACTIVE) TRY 1: tanpa nginx plugin ==='
mkdir -p /tmp/letsencrypt/.well-known/acme-challenge
echo "test-content-123" > /tmp/letsencrypt/.well-known/acme-challenge/test.txt
echo 'Write temporary acme location to nginx default top of server blocks...'
sudo -S -p '' bash -c 'cp /etc/nginx/sites-enabled/default /tmp/_ngx_backup_before_letsencrypt.$(date +%s).conf' < /home/alatprods/.sudopw_final 2>/dev/null
echo '=== T3b: CERTBOT NGINX PLUGIN ==='
sudo -S -p '' certbot --nginx -d saranasmk.id -d www.saranasmk.id --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expanding --redirect --hsts 2>&1 | tee /tmp/_certbot.log | tail -60 < /home/alatprods/.sudopw_final 2>/dev/null
echo RC_CERTBOT=$?
echo '=== T3c: JIKA T3b GAGAL, TRY WEBROOT MANUAL ==='
if ! sudo -S -p '' test -f /etc/letsencrypt/live/saranasmk.id/fullchain.pem < /home/alatprods/.sudopw_final 2>/dev/null; then
  echo 'NGINX PLUGIN GAGAL -> TRY WEBROOT MANUAL'
  sudo -S -p '' mkdir -p /etc/nginx/snippets < /home/alatprods/.sudopw_final 2>/dev/null
  sudo -S -p '' tee /etc/nginx/snippets/letsencrypt-acme.conf <<'NGXACME' >/dev/null
location ^~ /.well-known/acme-challenge/ {
    default_type "text/plain";
    root /var/www/html;
    try_files $uri =404;
}
NGXACME
  sudo -S -p '' mkdir -p /var/www/html/.well-known/acme-challenge < /home/alatprods/.sudopw_final 2>/dev/null
  sudo -S -p '' certbot certonly --webroot -w /var/www/html -d saranasmk.id --non-interactive --agree-tos --register-unsafely-without-email --force-renewal 2>&1 | tail -40 < /home/alatprods/.sudopw_final 2>/dev/null
fi
echo '=== T4: CHECK CERT EXISTS ==='
sudo -S -p '' ls -la /etc/letsencrypt/live/saranasmk.id/ 2>&1 < /home/alatprods/.sudopw_final 2>/dev/null
echo '=== T5: UPDATE NGINX SSL PATH TO LETSENCRYPT ==='
if sudo -S -p '' test -f /etc/letsencrypt/live/saranasmk.id/fullchain.pem < /home/alatprods/.sudopw_final 2>/dev/null; then
  echo 'LE cert EXISTS -> UPDATE /etc/nginx/sites-enabled/default ssl paths'
  sudo -S -p '' sed -i 's|ssl_certificate     /etc/nginx/ssl/saranasmk.crt|ssl_certificate     /etc/letsencrypt/live/saranasmk.id/fullchain.pem|g; s|ssl_certificate_key /etc/nginx/ssl/saranasmk.key|ssl_certificate_key /etc/letsencrypt/live/saranasmk.id/privkey.pem|g' /etc/nginx/sites-enabled/default < /home/alatprods/.sudopw_final 2>/dev/null
  sudo -S -p '' nginx -t < /home/alatprods/.sudopw_final 2>&1
  echo '--- Reload nginx ---'
  sudo -S -p'' nginx -s reload < /home/alatprods/.sudopw_final 2>&1
  sleep 2
  sudo -S -p '' ss -tlnp 2>&1 | grep -E ':(80|443) ' < /home/alatprods/.sudopw_final 2>/dev/null
fi
echo '=== T6: FINAL CURL VALID TEST https://saranasmk.id (TANPA -k) ==='
curl -s -o /tmp/_curl_ssltest.log -w "HTTP_VALID_SSL=%{http_code}\n" https://saranasmk.id/ --max-time 10
cat /tmp/_curl_ssltest.log | head -c 200; echo ''
echo '=== CERTIFICATE NOT AFTER (openssl x509 decode) ==='
if sudo -S -p '' test -f /etc/letsencrypt/live/saranasmk.id/fullchain.pem < /home/alatprods/.sudopw_final 2>/dev/null; then
  sudo -S -p '' openssl x509 -in /etc/letsencrypt/live/saranasmk.id/fullchain.pem -noout -subject -issuer -dates 2>&1 < /home/alatprods/.sudopw_final 2>/dev/null
else
  echo 'LE CERT TIDAK BERHASIL -> Gunakan self-signed lama, buka manual browser klik Advanced'
fi
echo 'SUBAGENT_FINISHED=1'
"""

    rc, out = ssh(REMOTE_SCRIPT, timeout=900)
    for line in out.splitlines():
        log(line)
    log(f"\n>>> REMOTE_EXIT={rc}")
    save()

    log("")
    log("=" * 78)
    log(f"DONE — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"Output: {OUTPUT_LOCAL}")
    log("=" * 78)
    save()
    return rc

if __name__ == "__main__":
    try:
        sys.stderr.write("PY SCRIPT START\n")
        sys.stderr.flush()
        rc = main() or 0
        sys.stderr.write(f"PY SCRIPT END rc={rc}\n")
    except Exception as e:
        log(f"PYTHON_EXCEPTION: {e}")
        log(traceback.format_exc())
        save()
        rc = 99
    sys.exit(rc)
