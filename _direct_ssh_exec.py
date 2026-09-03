#!/usr/bin/env python3
"""DIRECT SSH EXECUTION SCRIPT — sesuai instruksi user 2026-09-02
Pattern: sshpass + subprocess (sama dengan _deploy_helper_v6.py).
Output disimpan ke /tmp/subagent_ssh_result.txt dan backup ke project dir.
"""
import os, sys, subprocess, time
from datetime import datetime
from pathlib import Path

HOST = "103.160.202.73"
USER = "alatprods"
PASS = "Direktorat5mk123!@#"

OUTPUT_LOCAL = Path("/tmp/subagent_ssh_result.txt")
BACKUP_LOCAL = Path("/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_ssh_result_backup.txt")

BUF: list[str] = []
def log(s=""):
    print(s, flush=True)
    BUF.append(s)

def save():
    content = "\n".join(BUF) + "\n"
    try:
        OUTPUT_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SAVE] OK -> {OUTPUT_LOCAL} ({len(content)} chars, {content.count(chr(10))} lines)", file=sys.stderr)
    except Exception as e:
        print(f"[SAVE] FAIL /tmp: {e}", file=sys.stderr)
    try:
        BACKUP_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(BACKUP_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SAVE] OK -> {BACKUP_LOCAL}", file=sys.stderr)
    except Exception as e:
        print(f"[SAVE] FAIL backup: {e}", file=sys.stderr)

def ssh(cmd, timeout=1800):
    """Run single remote command via sshpass + ssh. Return (rc, stdout, stderr)."""
    env = {**os.environ, "SSHPASS": PASS}
    proc = subprocess.Popen(
        ["sshpass", "-e", "ssh", "-o", "StrictHostKeyChecking=no",
         "-o", "UserKnownHostsFile=/dev/null", "-o", "ConnectTimeout=30",
         "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=10",
         "-o", "BatchMode=no", "-p", "22",
         f"{USER}@{HOST}", "bash", "-lc", cmd],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        try: out, err = proc.communicate(timeout=5)
        except: out, err = "", "KILLED_AFTER_TIMEOUT"
        return proc.returncode or -1, out, err + "\n***TIMEOUT***"
    return proc.returncode, out, err

# =========================================================================
# HEADER
# =========================================================================
log("=" * 78)
log(f"SUBAGENT SSH DIRECT EXECUTION — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"Target: {USER}@{HOST}")
log("=" * 78)
log()

# =========================================================================
# STEP 2 — DIAGNOSTIC (sesuai instruksi user point 2)
# =========================================================================
log("")
log("==== STEP 2: DIAGNOSTIC ====")
log()

# 2a. PORT CHECK
log("===PORT===")
rc, out, err = ssh("ss -tlnp 2>/dev/null | grep -E ':(4000|3000|4001|3001) ' || echo NONE")
for line in (out + err).splitlines():
    log(line)
port_check_output = out + err
PORT_4000_OK = ":4000" in port_check_output and "NONE" not in port_check_output
log(f"  [PORT_4000_LISTEN] = {PORT_4000_OK}")
save()

# 2b. PM2 LIST
log("")
log("===PM2===")
rc, out, err = ssh("pm2 list 2>&1 | head -20")
for line in (out + err).splitlines():
    log(line)
pm2_check_output = out + err
PM2_API_ONLINE = "api-blue" in pm2_check_output and "online" in pm2_check_output.lower()
log(f"  [PM2_API_ONLINE] = {PM2_API_ONLINE}")
save()

# 2c. DEPLOY LOG
log("")
log("===DEPLOY_LOG_200===")
rc, out, err = ssh("tail -200 /tmp/deploy_v6.log 2>&1")
for line in (out + err).splitlines():
    log(line)
save()

# =========================================================================
# STEP 3 — RECOVERY (jika perlu)
# =========================================================================
NEED_RECOVERY = (not PORT_4000_OK) or (not PM2_API_ONLINE)
log("")
log("=" * 78)
if NEED_RECOVERY:
    log("KESIMPULAN: PORT 4000 TIDAK LISTEN ATAU PM2 API TIDAK ONLINE → MENJALANKAN RECOVERY")
else:
    log("KESIMPULAN: SEMUA OK — SKIP RECOVERY")
log("=" * 78)
save()

if NEED_RECOVERY:
    # 3a. pm2 delete all
    log("")
    log("===RECOVERY 3a: pm2 delete all===")
    rc, out, err = ssh("pm2 delete all 2>&1 | head -5")
    for line in (out + err).splitlines():
        log(line)
    save()

    # 3b. rm -rf node_modules
    log("")
    log("===RECOVERY 3b: rm -rf node_modules===")
    rc, out, err = ssh("rm -rf /home/alatprods/saranasmk/node_modules /home/alatprods/saranasmk/apps/api/node_modules /home/alatprods/saranasmk/apps/web/node_modules; echo RM_DONE")
    for line in (out + err).splitlines():
        log(line)
    save()

    # 3c. npm ci
    log("")
    log("===RECOVERY 3c: npm ci (3 folder) — ini bisa memakan waktu 10-20 menit===")
    NPM_CMD = (
        "cd /home/alatprods/saranasmk && "
        "echo [NPM_CI_ROOT] && npm ci --omit=dev --no-audit --no-fund --prefer-offline --loglevel=error 2>&1 | tail -5 && echo ROOT_DONE && "
        "cd apps/api && echo [NPM_CI_API] && npm ci --omit=dev --loglevel=error 2>&1 | tail -5 && echo API_DONE && "
        "cd ../web && echo [NPM_CI_WEB] && npm ci --omit=dev --loglevel=error 2>&1 | tail -5 && echo WEB_DONE && "
        "cd ../.. && echo ALL_NPM_DONE"
    )
    rc, out, err = ssh(NPM_CMD, timeout=2400)
    for line in (out + err).splitlines():
        log(line)
    save()

    # 3d. pm2 start
    log("")
    log("===RECOVERY 3d: PM2 START===")
    START_CMD = (
        "cd /home/alatprods/saranasmk && "
        "PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env 2>&1 | tail -20"
    )
    rc, out, err = ssh(START_CMD, timeout=300)
    for line in (out + err).splitlines():
        log(line)
    save()

    # 3e. sleep 25 + curl 20x
    log("")
    log("===RECOVERY 3e: SLEEP 25s + CURL 20x===")
    CURL_CMD = (
        "sleep 25 && "
        "echo 'API /health:' && "
        "for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do "
        "  curl -s -o /dev/null -w '%{http_code} ' --max-time 3 http://127.0.0.1:4000/health; "
        "  sleep 0.3; "
        "done; "
        "echo -e '\nWEB:'; "
        "for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do "
        "  curl -s -o /dev/null -w '%{http_code} ' --max-time 3 http://127.0.0.1:3000/; "
        "  sleep 0.3; "
        "done; "
        "echo ''"
    )
    rc, out, err = ssh(CURL_CMD, timeout=300)
    for line in (out + err).splitlines():
        log(line)
    save()

# =========================================================================
# FINAL
# =========================================================================
log("")
log("=" * 78)
log(f"SELESAI — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"Output file utama: {OUTPUT_LOCAL}")
log(f"Output file backup: {BACKUP_LOCAL}")
log("=" * 78)
save()

# Summary ke stderr
sys.stderr.write("\n===== RINGKASAN =====\n")
sys.stderr.write(f"PORT_4000_LISTEN  = {PORT_4000_OK}\n")
sys.stderr.write(f"PM2_API_ONLINE    = {PM2_API_ONLINE}\n")
sys.stderr.write(f"NEED_RECOVERY     = {NEED_RECOVERY}\n")
sys.stderr.write(f"Output file       = {OUTPUT_LOCAL}\n")
sys.stderr.write(f"Total lines       = {len(BUF)}\n")
sys.exit(0)
