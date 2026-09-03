#!/usr/bin/env python3
import os, sys, subprocess, time
from datetime import datetime
from pathlib import Path

HOST = "103.160.202.73"
USER = "alatprods"
PASS = "Direktorat5mk123!@#"

OUTPUT_LOCAL = Path("/tmp/test_salinan_direct_exec.txt")
BACKUP_LOCAL = Path("/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_test_salinan_direct_exec.txt")

BUF = []
def log(s=""):
    print(s, flush=True)
    BUF.append(s)

def save():
    content = "\n".join(BUF) + "\n"
    try:
        OUTPUT_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SAVE] OK -> {OUTPUT_LOCAL} ({len(content)} chars)", file=sys.stderr)
    except Exception as e:
        print(f"[SAVE] FAIL /tmp: {e}", file=sys.stderr)
    try:
        BACKUP_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(BACKUP_LOCAL, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SAVE] OK -> {BACKUP_LOCAL}", file=sys.stderr)
    except Exception as e:
        print(f"[SAVE] FAIL backup: {e}", file=sys.stderr)

def ssh(cmd, timeout=60):
    env = {**os.environ, "SSHPASS": PASS}
    proc = subprocess.Popen(
        ["sshpass", "-e", "ssh", "-o", "StrictHostKeyChecking=no",
         "-o", "UserKnownHostsFile=/dev/null", "-o", "ConnectTimeout=15",
         f"{USER}@{HOST}", "bash", "-lc", cmd],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        try: out, err = proc.communicate(timeout=5)
        except: out, err = "", "KILLED"
        return proc.returncode or -1, out, err
    return proc.returncode, out, err

log("=" * 60)
log(f"SALINAN DIRECT EXEC — TEST — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 60)
log()
log("=== LANGKAH 1: echo hostname SSH ===")
save()

rc, out, err = ssh("hostname && whoami && echo SSH_OK_12345")
log(f"SSH RC={rc}")
for line in (out + err).splitlines():
    log(line)
save()

log()
log("=== LANGKAH 2: SELESAI ===")
log(f"Waktu selesai: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log("SUBAGENT_FINISHED=1")
save()

sys.stderr.write(f"\nDONE. Lihat {OUTPUT_LOCAL}\n")
sys.exit(0)
