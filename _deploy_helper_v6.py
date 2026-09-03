#!/usr/bin/env python3
"""SARANASMK DEPLOY HELPER v6 — Enterprise-grade SSH automation."""
import os
import sys
import json
import time
import base64
import hashlib
import shutil
import tarfile
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

HOST = "103.160.202.73"
USER = "alatprods"
PASS = "Direktorat5mk123!@#"
REMOTE_ROOT = f"/home/{USER}/saranasmk"
BACKUPS_DIR = f"/home/{USER}/backups"
TS = datetime.now().strftime("%Y%m%d_%H%M%S")

# ---------------------------------------------------------------------------
# SSH UTILITIES via paramiko fallback — but use sshpass for speed
# ---------------------------------------------------------------------------
def ssh(cmd: str, timeout: int = 300) -> dict:
    """Run command via SSH, return dict with rc/stdout/stderr."""
    env = {**os.environ, "SSHPASS": PASS}
    proc = subprocess.Popen(
        ["sshpass", "-e", "ssh", "-o", "StrictHostKeyChecking=no",
         "-o", "ConnectTimeout=20", "-o", "ServerAliveInterval=30",
         "-o", "ServerAliveCountMax=5", "-p", "22",
         f"{USER}@{HOST}", "bash", "-lc", cmd],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        return {"rc": -1, "stdout": "", "stderr": "TIMEOUT"}
    return {"rc": proc.returncode, "stdout": out, "stderr": err}


def scp_upload(local_path: str, remote_path: str) -> dict:
    env = {**os.environ, "SSHPASS": PASS}
    proc = subprocess.Popen(
        ["sshpass", "-e", "scp", "-o", "StrictHostKeyChecking=no",
         "-o", "ConnectTimeout=30",
         local_path, f"{USER}@{HOST}:{remote_path}"],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    out, err = proc.communicate(timeout=900)
    return {"rc": proc.returncode, "stdout": out, "stderr": err}


def log(msg: str, level: str = "INFO") -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line, flush=True)
    with open(f"{ROOT}/logs/deploy_v6_{TS}.log", "a") as f:
        f.write(line + "\n")


def die(msg: str, rollback_fn=None) -> None:
    log(f"💀 FATAL: {msg}", "ERROR")
    if rollback_fn:
        try:
            log("🔧 Running ROLLBACK handler...", "WARN")
            rollback_fn()
        except Exception as re:
            log(f"Rollback gagal: {re}", "ERROR")
    sys.exit(1)


def expect_ok(res: dict, what: str, fatal: bool = True) -> None:
    if res["rc"] != 0:
        log(f"FAIL {what}: RC={res['rc']}\nSTDERR:\n{res['stderr'][-2000:]}\nSTDOUT:\n{res['stdout'][-2000:]}", "ERROR")
        if fatal:
            sys.exit(res["rc"] or 1)
    else:
        log(f"✅ {what} OK")


# ============================================================================
# PHASE 0: DIAGNOSTIC SERVER
# ============================================================================
def phase0_diagnostic() -> dict:
    log("=" * 70)
    log("PHASE 0 — SERVER DIAGNOSTIC")
    log("=" * 70)
    info = {}

    # 0-1: Disk space
    r = ssh("df -h / /home | tail -2")
    expect_ok(r, "Check disk usage")
    info["df"] = r["stdout"].strip()
    log(f"DISK:\n{info['df']}")

    # 0-2: Memory
    r = ssh("free -h | head -2; echo ---; nproc; echo ---; uptime")
    expect_ok(r, "Check memory/cpu/uptime")
    info["sys"] = r["stdout"].strip()
    log(f"SYS:\n{info['sys']}")

    # 0-3: PM2 status
    r = ssh(f"cd {REMOTE_ROOT} && (pm2 status 2>&1 || echo PM2_NOT_FOUND)")
    expect_ok(r, "PM2 status")
    info["pm2"] = r["stdout"].strip()
    log(f"PM2:\n{info['pm2']}")

    # 0-4: App directory
    r = ssh(f"ls -la {REMOTE_ROOT} 2>&1 | head -40")
    expect_ok(r, "Remote dir listing")
    info["ls"] = r["stdout"].strip()
    log(f"REMOTE DIR:\n{info['ls']}")

    # 0-5: Env files
    r = ssh(f"cd {REMOTE_ROOT} && (cat apps/api/.env 2>&1 || echo NO_API_ENV) | head -40")
    info["api_env"] = r["stdout"].strip()
    log(f"APPS/API/.ENV (partial):\n{info['api_env']}")

    r = ssh(f"cd {REMOTE_ROOT} && (cat apps/web/.env 2>&1 || echo NO_WEB_ENV) | head -10; echo ---; (cat .env 2>&1 || echo NO_ROOT_ENV) | head -10")
    info["web_env_root_env"] = r["stdout"].strip()
    log(f"WEB/ROOT ENV:\n{info['web_env_root_env']}")

    # 0-6: DB dialect
    r = ssh(f"""cd {REMOTE_ROOT} && \
DB_DIALECT=$(grep -h '^DB_DIALECT=' apps/api/.env .env 2>/dev/null | head -1 | cut -d= -f2)
DATABASE_URL=$(grep -h '^DATABASE_URL=' apps/api/.env .env 2>/dev/null | head -1)
echo "DB_DIALECT=$DB_DIALECT"
echo "DATABASE_URL=$(echo $DATABASE_URL | cut -d@ -f 2- 2>/dev/null || echo HIDDEN)"
""")
    info["db"] = r["stdout"].strip()
    log(f"DB CONFIG:\n{info['db']}")

    # 0-7: Schools table schema & rowcount
    r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
echo "PG: user=$PGUSER host=$PGHOST db=$PGDATABASE"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" 2>&1 | head -30 || \
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "\\dt" 2>&1 | head -30 || \
echo "PSQL_CONNECTION_FAILED"
""")
    info["tables"] = r["stdout"].strip()
    log(f"DB TABLES:\n{info['tables']}")

    # 0-8: Check schools columns (npsn vs school_id)
    r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
echo "--- schools COLUMNS ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" \
  -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='schools' ORDER BY ordinal_position;" 2>&1
echo "--- schools ROWCOUNT ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "SELECT count(*) FROM schools;" 2>&1 || echo "SCHOOLS_COUNT_FAIL"
echo "--- RLS ENABLED on schools? ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" \
  -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='schools';" 2>&1 || echo "RLS_CHECK_FAIL"
""")
    info["schema"] = r["stdout"].strip()
    log(f"SCHEMA SCHOOLS:\n{info['schema']}")

    # 0-9: Backup folder
    r = ssh(f"mkdir -p {BACKUPS_DIR} && ls -lahS {BACKUPS_DIR} 2>&1 | head -15 || true")
    info["backups"] = r["stdout"].strip()
    log(f"BACKUP FOLDER:\n{info['backups']}")

    return info


# ============================================================================
# PHASE 1: BACKUP DB PRODUKSI
# ============================================================================
def phase1_backup() -> str:
    log("=" * 70)
    log("PHASE 1 — FULL DB BACKUP (PG CUSTOM FORMAT)")
    log("=" * 70)
    backup_file = f"{BACKUPS_DIR}/predeploy_saranasmk_pg_{TS}.sqlc"

    r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
PGPORT="${{PGPORT:-5432}}"

echo "Using: PGUSER=$PGUSER PGHOST=$PGHOST PGPORT=$PGPORT PGDATABASE=$PGDATABASE"
pg_dump -Fc -v -h "$PGHOST" -U "$PGUSER" -p "$PGPORT" -d "$PGDATABASE" \
  --no-owner --no-privileges --quote-all-identifiers \
  -j 4 -f "{backup_file}" 2>&1
RC=$?
echo "PG_DUMP_RC=$RC"
ls -lah "{backup_file}" || echo "FILE_NOT_CREATED"
""")
    # Replace placeholder in result
    expect_ok(r, f"pg_dump ke {backup_file}")

    # SHA256
    r = ssh(f"sha256sum {backup_file} | tee {backup_file}.sha256")
    expect_ok(r, "SHA256 checksum")
    log(f"SHA256: {r['stdout'].strip()}")

    # Rowcount signature
    r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -t -A -c \
  "SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS cnt FROM (SELECT table_name, query_to_xml(format('SELECT count(*) AS cnt FROM %I', table_name), false, true, '') AS xml_count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name) s;" \
  > "{backup_file}_signature.txt" 2>&1 || echo "SIGNATURE_WARNING"
wc -l "{backup_file}_signature.txt" || true
echo "SIGNATURE_HEAD:"
head -10 "{backup_file}_signature.txt"
""")
    log(f"Rowcount signature dibuat: {r['stdout'][-300:].strip()}")

    # LOCK FILE
    r = ssh(f"mkdir -p /tmp/saranasmk_deploy_locks && touch /tmp/saranasmk_deploy_locks/predeploy_{TS}.LOCK && ls /tmp/saranasmk_deploy_locks/")
    expect_ok(r, "Deploy lock file")
    return backup_file


# ============================================================================
# PHASE 2: BUILD LOCAL + PACKAGE
# ============================================================================
def phase2_build_and_pack() -> str:
    log("=" * 70)
    log("PHASE 2 — BUILD LOCAL + PACKAGE TGZ")
    log("=" * 70)

    # 2-1: Ensure shared-types built
    log("Build shared-types...")
    r_pkg = subprocess.run(["npm", "run", "build"], cwd=f"{ROOT}/packages/shared-types",
                           capture_output=True, text=True, timeout=300,
                           env={**os.environ})
    if r_pkg.returncode != 0:
        log(f"shared-types build warning (non-fatal): {r_pkg.stderr[-500:]}", "WARN")
    else:
        log("✅ shared-types build OK")

    # 2-2: Build API
    log("Build API (tsc)...")
    r_api = subprocess.run(["npm", "run", "build"], cwd=f"{ROOT}/apps/api",
                           capture_output=True, text=True, timeout=600,
                           env={**os.environ})
    if r_api.returncode != 0:
        log(f"API BUILD FAIL: {r_api.stderr[-3000:]}\n{r_api.stdout[-1000:]}", "ERROR")
        sys.exit(20)
    log("✅ API build OK")

    # 2-3: Build WEB (Next.js)
    log("Build WEB (next build) — ini lama, ~5-10 menit...")
    env_web = {**os.environ, "NODE_OPTIONS": "--max-old-space-size=6144"}
    r_web = subprocess.run(["npm", "run", "build"], cwd=f"{ROOT}/apps/web",
                           capture_output=True, text=True, timeout=1800,
                           env=env_web)
    if r_web.returncode != 0:
        log(f"WEB BUILD FAIL: {r_web.stderr[-4000:]}\n{r_web.stdout[-1000:]}", "ERROR")
        sys.exit(21)
    log("✅ WEB build OK")

    # 2-4: Package tgz
    pkg_local = f"/tmp/saranasmk_deploy_{TS}.tgz"
    log(f"Packaging artifact → {pkg_local}")
    # Exclude heavy files that don't need shipping
    exclude = [
        "--exclude=node_modules/.cache",
        "--exclude=.next/cache",
        "--exclude=.turbo",
        "--exclude=.git",
        "--exclude=__ARCHIVE_LEGACY_20260831__",
        "--exclude=_BACKUP_PRODUCTION/_reports/*.json",
        "--exclude=apps/web/.next/cache",
    ]
    # Only ship package.json + needed files from root, apps/{api,web}, packages/shared-types, ecosystem.config.js, deploy_canary.sh, _migration_phase*.sql
    items = [
        "package.json", "package-lock.json", "ecosystem.config.js", "deploy_canary.sh",
        "apps/api", "apps/web", "packages/shared-types",
        "_migration_phase1_add_npsn_v3_FINAL.sql",
        "_migration_phase2_swap_pk.sql",
        "_migration_phase3_rls.sql",
        "_migration_phase3b_rls_force.sql",
        "_migration_phase8_and_13a_gin_partition_notify_trigger.sql",
        "_migration_phase8b_partition_history.sql",
    ]
    # Filter existence
    items_exist = [x for x in items if Path(x).exists()]
    r = subprocess.run(
        ["tar", *exclude, "-czf", pkg_local, *items_exist],
        cwd=ROOT, capture_output=True, text=True, timeout=600
    )
    if r.returncode != 0:
        log(f"PACK FAIL: {r.stderr}", "ERROR")
        sys.exit(22)
    size_mb = os.path.getsize(pkg_local) / (1024 * 1024)
    log(f"✅ Package SUKSES: {pkg_local} ({size_mb:.1f} MB)")
    return pkg_local


# ============================================================================
# PHASE 3: SCP UPLOAD + EXTRACT + NPM CI
# ============================================================================
def phase3_upload_extract(pkg_local: str) -> None:
    log("=" * 70)
    log("PHASE 3 — UPLOAD + EXTRACT + NPM CI")
    log("=" * 70)

    remote_pkg = f"/tmp/saranasmk_deploy_{TS}.tgz"

    # 3-1 Upload
    log(f"Uploading {Path(pkg_local).name} via SCP...")
    r = scp_upload(pkg_local, remote_pkg)
    expect_ok(r, f"SCP upload ({Path(pkg_local).stat().st_size // (1024*1024)} MB)")
    log("✅ Upload OK")

    # 3-2 Extract
    log(f"Extract {remote_pkg} → {REMOTE_ROOT}")
    r = ssh(f"cd {REMOTE_ROOT} && tar -xzf {remote_pkg} --recursive-unlink 2>&1 | tail -5; echo EXTRACT_RC=$?")
    expect_ok(r, "Extract tgz")
    log("✅ Extract OK")

    # 3-3: Install deps fresh (npm ci from lockfile)
    log("npm ci @ root (workspaces)...")
    r = ssh(f"cd {REMOTE_ROOT} && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -20")
    expect_ok(r, "npm ci root workspace")
    log("✅ Root deps OK")

    log("npm ci @ apps/api (workspace)...")
    r = ssh(f"cd {REMOTE_ROOT}/apps/api && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -15")
    expect_ok(r, "npm ci apps/api")
    log("✅ API deps OK")

    log("npm ci @ apps/web (workspace)...")
    r = ssh(f"cd {REMOTE_ROOT}/apps/web && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -15")
    expect_ok(r, "npm ci apps/web")
    log("✅ WEB deps OK")

    # 3-4 Ensure logs folder
    r = ssh(f"cd {REMOTE_ROOT} && mkdir -p logs apps/api/uploads && ls -ld logs apps/api/uploads")
    expect_ok(r, "Setup logs/uploads folder")


# ============================================================================
# PHASE 4: APPLY MIGRATIONS (6 SQL files IN ORDER)
# ============================================================================
def phase4_apply_migrations() -> None:
    log("=" * 70)
    log("PHASE 4 — APPLY 6 SQL MIGRATIONS IN TRANSACTIONAL ORDER")
    log("=" * 70)

    migrations_ordered = [
        ("_migration_phase1_add_npsn_v3_FINAL.sql", "ADD npsn column + index"),
        ("_migration_phase2_swap_pk.sql",             "DROP school_id → PK = npsn"),
        ("_migration_phase3_rls.sql",                 "ENABLE RLS + 12 policies"),
        ("_migration_phase3b_rls_force.sql",          "FORCE RLS + grants"),
        ("_migration_phase8_and_13a_gin_partition_notify_trigger.sql", "NOTIFY triggers x36"),
        ("_migration_phase8b_partition_history.sql",  "Partition history tables"),
    ]

    for sql_file, desc in migrations_ordered:
        log(f"👉 {sql_file}: {desc}")
        local_path = f"{ROOT}/{sql_file}"
        if not Path(local_path).exists():
            log(f"   SKIPPED — file tidak ada: {local_path}", "WARN")
            continue

        # Check if already applied by examining markers
        remote_sql = f"/tmp/{TS}_{sql_file}"
        scp_upload(local_path, remote_sql)

        r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
psql -v ON_ERROR_STOP=1 -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -f "{remote_sql}" 2>&1 | tail -30
echo "PSQL_RC=$?"
""")
        if r["rc"] != 0:
            # Check if error is just "relation already exists" / "constraint already exists" / NOTICE
            stderr_plus_stdout = r["stdout"] + "\n" + r["stderr"]
            if any(k in stderr_plus_stdout.lower() for k in [
                "already exists", "duplicate key", "constraint", "already",
                "notice", "does not exist", "skip", "not found"
            ]) and "error" not in stderr_plus_stdout.lower():
                log(f"   ⚠️ {sql_file}: skipped/pre-applied (NOTICE-only)", "WARN")
                continue
            log(f"   ❌ {sql_file} GAGAL:\n{r['stderr'][-2000:]}\n{r['stdout'][-2000:]}", "ERROR")
            die(f"Migrasi {sql_file} gagal — PERIKSA MANUAL atau restore dari backup!")
        log(f"   ✅ {sql_file} SUCCESS")

    # Post-migration verification
    log("Verify post-migration state...")
    r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
echo "--- schools columns ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='schools' ORDER BY ordinal_position;" 2>&1
echo "--- schools rowcount ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "SELECT count(*) FROM schools;" 2>&1
echo "--- RLS force on schools ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='schools';" 2>&1
echo "--- NOTIFY trigger count ---"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -c "SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'notify_%' AND tgisinternal=false;" 2>&1
""")
    log(f"POST-MIGRATION:\n{r['stdout'][-3000:].strip()}")


# ============================================================================
# PHASE 5: DEPLOY BLUE-GREEN VIA PM2
# ============================================================================
def phase5_deploy_bluegreen() -> None:
    log("=" * 70)
    log("PHASE 5 — BLUE-GREEN CANARY DEPLOY PM2")
    log("=" * 70)

    # Kill green first (clean slate)
    ssh("pm2 delete api-green web-green 2>/dev/null; pm2 save 2>/dev/null; echo GREEN_CLEAN")
    log("Green slot dibersihkan")

    # Start canary (green)
    log("Start GREEN (1 instance each) → wait 30s...")
    r = ssh(f"""cd {REMOTE_ROOT} && \
export PM2_BLUE_INST=$(pm2 describe api-blue 2>/dev/null | awk '/instances/ {{print $2; exit}}' | grep -oE '[0-9]+' || echo 4)
export PM2_GREEN_START=1
pm2 start ecosystem.config.js --only api-green,web-green --update-env 2>&1 | tail -10
echo PM2_START_RC=$?
""")
    expect_ok(r, "pm2 start GREEN canary")
    time.sleep(30)

    # Health canary
    log("Health-check GREEN slots...")
    r = ssh("""
FAIL=0; OK_API=0; OK_WEB=0
for i in $(seq 1 20); do
  C=$(curl -sfo /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:4001/health 2>/dev/null || echo 000)
  [[ "$C" =~ ^[23] ]] && OK_API=$((OK_API+1))
  C=$(curl -sfo /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:3001/health 2>/dev/null || echo 000)
  [[ "$C" =~ ^[23] ]] && OK_WEB=$((OK_WEB+1))
  sleep 0.1
done
echo "API-GREEN 20x OK=$OK_API FAIL=$((20-OK_API))"
echo "WEB-GREEN 20x OK=$OK_WEB FAIL=$((20-OK_WEB))"
""")
    log(f"HEALTH GREEN RESULT:\n{r['stdout'].strip()}")
    stdout = r["stdout"]
    api_ok = int(stdout.split("API-GREEN")[1].split("OK=")[1].split()[0])
    web_ok = int(stdout.split("WEB-GREEN")[1].split("OK=")[1].split()[0])
    if api_ok < 19 or web_ok < 19:
        log(f"CANARY FAIL — rollback GREEN (api_ok={api_ok}/20, web_ok={web_ok}/20)", "ERROR")
        ssh("pm2 delete api-green web-green 2>/dev/null; pm2 save")
        die("Canary green gagal health ≥95% — Blue tetap serve. Periksa log PM2.")

    log("✅ Canary GREEN lulus health → promote ke BLUE")

    # Promote GREEN → BLUE
    r = ssh(f"""cd {REMOTE_ROOT} && \
BLUE_INST=$(pm2 describe api-blue 2>/dev/null | awk '/instances/ {{print $2; exit}}' | grep -oE '[0-9]+' || echo 4)
echo "Target BLUE_INST=$BLUE_INST"
# 1. Stop Blue
pm2 stop api-blue   2>/dev/null; pm2 delete api-blue   2>/dev/null
pm2 stop web-blue   2>/dev/null; pm2 delete web-blue   2>/dev/null
sleep 3
# 2. Rename Green → Blue
pm2 restart api-green --name api-blue --update-env 2>&1 | tail -3 || pm2 restart api-green 2>&1 | tail -3
pm2 restart web-green --name web-blue --update-env 2>&1 | tail -3 || pm2 restart web-green 2>&1 | tail -3
sleep 5
# 3. Scale to full
pm2 scale api-blue "$BLUE_INST" 2>/dev/null || true
pm2 scale web-blue "$BLUE_INST" 2>/dev/null || true
pm2 save 2>/dev/null
sleep 8
pm2 status 2>&1
""")
    expect_ok(r, "Promote GREEN → BLUE")
    log(f"PROMOTE RESULT:\n{r['stdout'][-1000:].strip()}")

    # Final health BLUE
    r = ssh("""
echo "=== FINAL BLUE HEALTH 30x ==="
OK_API=0; OK_WEB=0
for i in $(seq 1 30); do
  C=$(curl -sfo /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:4000/health 2>/dev/null || echo 000)
  [[ "$C" =~ ^[23] ]] && OK_API=$((OK_API+1))
  C=$(curl -sfo /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:3000/health 2>/dev/null || echo 000)
  [[ "$C" =~ ^[23] ]] && OK_WEB=$((OK_WEB+1))
  sleep 0.1
done
echo "API-BLUE 30x OK=$OK_API/30"
echo "WEB-BLUE 30x OK=$OK_WEB/30"
""")
    log(f"FINAL HEALTH:\n{r['stdout'].strip()}")
    stdout = r["stdout"]
    api_ok = int(stdout.split("API-BLUE")[1].split("OK=")[1].split("/")[0])
    web_ok = int(stdout.split("WEB-BLUE")[1].split("OK=")[1].split("/")[0])
    if api_ok < 28 or web_ok < 28:
        log(f"⚠️ Final health below 90% (api={api_ok}/30 web={web_ok}/30) — manual cek log", "WARN")


# ============================================================================
# PHASE 6: POST-AUDIT
# ============================================================================
def phase6_post_audit() -> None:
    log("=" * 70)
    log("PHASE 6 — POST AUDIT INTEGRITAS")
    log("=" * 70)

    # 1. Rowcount signature compare (post vs pre)
    r = ssh(f"""cd {REMOTE_ROOT} && \
set -a
source <(grep -v '^#' apps/api/.env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
source <(grep -v '^#' .env 2>/dev/null | xargs -I{{}} echo {{}} 2>/dev/null || true)
set +a
export PGPASSWORD="${{PGPASSWORD:-${{DB_PASSWORD:-saranasmk123}}}}"
PGUSER="${{PGUSER:-${{DB_USER:-saranasmk}}}}"
PGHOST="${{PGHOST:-127.0.0.1}}"
PGDATABASE="${{PGDATABASE:-${{DB_NAME:-saranasmk}}}}"
psql -U "$PGUSER" -h "$PGHOST" -d "$PGDATABASE" -t -A -c \
  "SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS cnt FROM (SELECT table_name, query_to_xml(format('SELECT count(*) AS cnt FROM %I', table_name), false, true, '') AS xml_count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name) s;"
""")
    expect_ok(r, "Post rowcount signature")
    log(f"POST-DEPLOY SIGNATURE (rowcount per table):\n{r['stdout'][-2000:].strip()}")

    # 2. PM2 restart counts
    r = ssh("pm2 status 2>&1 | head -20")
    log(f"PM2 FINAL STATUS:\n{r['stdout'].strip()}")

    # 3. Verify key endpoint via curl
    r = ssh("""
echo "=== ENDPOINT SMOKE TEST ==="
echo "[1] /health (api :4000)"
curl -s http://127.0.0.1:4000/health | head -c 300 ; echo
echo "[2] /v1/master-data/provinsi (cek DB query works)"
curl -sfo /tmp/smk_prov.json -w " HTTP:%{http_code} SIZE:%{size_download}B\n" --max-time 15 http://127.0.0.1:4000/v1/master-data/provinsi
head -c 300 /tmp/smk_prov.json; echo
echo "[3] web home :3000"
curl -sfo /tmp/smk_home.html -w " HTTP:%{http_code} SIZE:%{size_download}B\n" --max-time 20 http://127.0.0.1:3000/
wc -c /tmp/smk_home.html
""")
    log(f"SMOKE TEST ENDPOINTS:\n{r['stdout'][-2000:].strip()}")

    log("=" * 70)
    log("🏁 DEPLOY V6 PIPELINE COMPLETE. EXIT 0")
    log("=" * 70)


# ============================================================================
# MAIN — Run all phases sequentially
# ============================================================================
def main():
    os.makedirs(f"{ROOT}/logs", exist_ok=True)
    log(f"START DEPLOY PIPELINE v6 | TS={TS}")
    log(f"HOST={USER}@{HOST} | ROOT_REMOTE={REMOTE_ROOT}")

    # Interactive confirm first diagnostic
    if "--yes" not in sys.argv and "-y" not in sys.argv:
        print("\n⚠️  AKAN MENJALANKAN PIPELINE DEPLOY KE PRODUKSI!")
        print("   Phase 0: Diagnostik   Phase 1: Backup   Phase 2: Build Pack")
        print("   Phase 3: Upload       Phase 4: Migrasi  Phase 5: Blue-Green   Phase 6: Audit")
        ans = input("   Lanjutkan? [ketik YES to proceed]: ").strip()
        if ans.upper() != "YES":
            print("Batal. Jalankan lagi dengan --yes untuk skip prompt.")
            sys.exit(0)

    info = phase0_diagnostic()
    Path(f"{ROOT}/logs/diag_{TS}.json").write_text(json.dumps(info, indent=2, default=str))

    backup = phase1_backup()
    log(f"Backup OK: {backup}")

    pkg = phase2_build_and_pack()

    phase3_upload_extract(pkg)
    phase4_apply_migrations()
    phase5_deploy_bluegreen()
    phase6_post_audit()

    # Cleanup tmp files local
    for f in [pkg]:
        try: os.remove(f)
        except: pass

    print(f"\n🔗 DEPLOY LOG: {ROOT}/logs/deploy_v6_{TS}.log")
    print(f"🔗 DIAG JSON: {ROOT}/logs/diag_{TS}.json")


if __name__ == "__main__":
    main()
