#!/usr/bin/env python3
"""
SARANASMK — PRODUKSI RECOVERY SUBAGENT v6
Sesuai request user 2026-09-02:
  1. SSH 103.160.202.73 (alatprods / Direktorat5mk123!@#)
  2. Catat log deploy terakhir 300 line /tmp/deploy_v6.log
     + pm2 logs api-blue (30 line)
     + cek port 4000 bind atau tidak
  3. JIKA API port 4000 TIDAK ADA yang listen:
     a. pm2 delete semua
     b. HAPUS node_modules: root + apps/api + apps/web
     c. npm ci --omit=dev di 3 folder
     d. PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env
     e. sleep 20, curl 20x :4000/health dan :3000/ → HTTP 200 >=18x
  4. Simpan SEMUA output + tail log hasil recovery ke /tmp/subagent_ssh_result.txt di MAC LOKAL

Pattern SSH mengikuti _deploy_helper_v6.py (subprocess + sshpass — konsisten dengan codebase).
"""
import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent
os.chdir(PROJECT_ROOT)

HOST = "103.160.202.73"
USER = "alatprods"
PASS = "Direktorat5mk123!@#"
REMOTE_ROOT = f"/home/{USER}/saranasmk"

OUTPUT_LOCAL = Path("/tmp/subagent_ssh_result.txt")

# Buffer semua output untuk disimpan ke file
LOG_BUFFER: list[str] = []


def log(s: str = "") -> None:
    """Print ke stdout (real-time terminal) + simpan ke buffer untuk file."""
    print(s, flush=True)
    LOG_BUFFER.append(s)


def save_output_to_file() -> None:
    """Flush buffer ke /tmp/subagent_ssh_result.txt di Mac lokal."""
    final = "\n".join(LOG_BUFFER) + "\n"
    try:
        OUTPUT_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_LOCAL, "w", encoding="utf-8") as f:
            f.write(final)
        n_chars = len(final)
        n_lines = final.count("\n")
        print(f"\n[LOCAL] ✅ Output disimpan ke: {OUTPUT_LOCAL}", file=sys.stderr)
        print(f"[LOCAL]    {n_chars} karakter, {n_lines} baris", file=sys.stderr)
    except Exception as e:
        print(f"[LOCAL] ❌ GAGAL simpan output ke {OUTPUT_LOCAL}: {e}", file=sys.stderr)
        # Fallback simpan ke project root bila /tmp tidak writable
        fallback = PROJECT_ROOT / "subagent_ssh_result_FALLBACK.txt"
        try:
            with open(fallback, "w", encoding="utf-8") as f:
                f.write(final)
            print(f"[LOCAL]    → Fallback disimpan ke: {fallback}", file=sys.stderr)
        except Exception as e2:
            print(f"[LOCAL]    → Fallback juga gagal: {e2}", file=sys.stderr)


# ---------------------------------------------------------------------------
# SSH via sshpass + subprocess (sama pattern dengan _deploy_helper_v6.py)
# ---------------------------------------------------------------------------
def ssh_run(cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    """Run single remote command via sshpass + ssh. Return (rc, stdout, stderr)."""
    env = {**os.environ, "SSHPASS": PASS}
    proc = subprocess.Popen(
        [
            "sshpass", "-e",
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ConnectTimeout=20",
            "-o", "ServerAliveInterval=30",
            "-o", "ServerAliveCountMax=5",
            "-o", "PreferredAuthentications=password",
            "-o", "PubkeyAuthentication=no",
            "-p", "22",
            f"{USER}@{HOST}",
            "bash", "-lc", cmd,
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        return -1, "", f"TIMEOUT setelah {timeout}s"
    return proc.returncode, out, err


def ssh_upload_and_run(bash_script_body: str, timeout: int = 900, desc: str = "") -> tuple[int, str]:
    """
    Upload bash script ke /tmp server lalu jalankan.
    Return (rc, gabungan_stdout_stderr).
    Output script ditulis ke LOG_BUFFER juga secara real-time.
    """
    ts = datetime.now().strftime("%H%M%S")
    remote_script = f"/tmp/_subagent_recovery_{ts}_{int(time.time()) % 1000:03d}.sh"

    wrapped_script = (
        "#!/usr/bin/env bash\n"
        "set +e\n"
        "echo '============================================================'\n"
        f"echo '[SCRIPT START] {remote_script}'\n"
        "echo '============================================================'\n"
        + bash_script_body.rstrip()
        + "\necho '============================================================'\n"
        f"echo '[SCRIPT END] exit=$?'\n"
        "echo '============================================================'\n"
    )

    # -------- STEP A: Upload via scp
    env = {**os.environ, "SSHPASS": PASS}
    # Buat temp lokal untuk upload
    local_tmp = PROJECT_ROOT / f"_tmp_upload_{int(time.time()*1000)}.sh"
    try:
        with open(local_tmp, "w", encoding="utf-8") as f:
            f.write(wrapped_script)
        os.chmod(local_tmp, 0o755)
    except Exception as e:
        return -1, f"GAGAL buat temp lokal: {e}"

    scp_rc = -1
    try:
        scp = subprocess.Popen(
            [
                "sshpass", "-e",
                "scp",
                "-o", "StrictHostKeyChecking=no",
                "-o", "UserKnownHostsFile=/dev/null",
                "-o", "ConnectTimeout=30",
                "-P", "22",
                str(local_tmp),
                f"{USER}@{HOST}:{remote_script}",
            ],
            env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        scp_out, scp_err = scp.communicate(timeout=60)
        scp_rc = scp.returncode
    except Exception as e:
        scp_err = f"SCP exception: {e}"
    finally:
        try:
            local_tmp.unlink(missing_ok=True)
        except:
            pass

    if scp_rc != 0:
        return scp_rc or 99, f"GAGAL upload script via SCP: {scp_err}"

    # -------- STEP B: Chmod remote dan jalankan
    rc_chmod, _, _ = ssh_run(f"chmod +x {remote_script}", timeout=10)

    proc = subprocess.Popen(
        [
            "sshpass", "-e",
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ConnectTimeout=20",
            "-o", "ServerAliveInterval=30",
            "-o", "ServerAliveCountMax=5",
            "-p", "22",
            f"{USER}@{HOST}",
            "bash", "-lc", remote_script,
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,  # Gabung stderr ke stdout supaya urut
        text=True,
        bufsize=1,
        universal_newlines=True,
    )

    all_output: list[str] = []
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.rstrip("\n")
        # Print real-time ke terminal
        print("  " + line, flush=True)
        all_output.append(line)
        LOG_BUFFER.append("  " + line)

    try:
        rc = proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        rc = -1
        all_output.append(f"[TIMEOUT] remote script > {timeout}s — killed")

    combined = "\n".join(all_output)
    return rc, combined


# ============================================================================
# MAIN FLOW
# ============================================================================
def main() -> int:
    TS_START = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log(f"{'='*72}")
    log(f"  SUBAGENT SSH RECOVERY — SARANASMK PROD (103.160.202.73)")
    log(f"  WAKTU MULAI   : {TS_START}")
    log(f"  OUTPUT LOKAL  : {OUTPUT_LOCAL}")
    log(f"  NO DB / MIGRATION DIUBAH (HANYA PM2 + NPM REINSTALL)")
    log(f"{'='*72}")
    log()

    # ---------- CEK sshpass tersedia
    which_sshpass = subprocess.run(["which", "sshpass"], capture_output=True, text=True)
    if which_sshpass.returncode != 0:
        log("[LOCAL] ❌ sshpass tidak terinstall. Install dulu:")
        log("          brew install hudochenkov/sshpass/sshpass    # macOS Homebrew")
        log("          apt-get install sshpass                     # Debian/Ubuntu")
        save_output_to_file()
        return 5

    # ========================================================================
    # STEP 1: Cek port 4000, ambil deploy_v6.log 300L, pm2 logs api-blue 30L
    # ========================================================================
    log()
    log("╔══════════════════════════════════════════════════════════════════════╗")
    log("║ STEP 1 — CEK PORT 4000 + LOG deploy_v6.log 300L + PM2 LOGS api-blue ║")
    log("╚══════════════════════════════════════════════════════════════════════╝")

    STEP1_SCRIPT = r"""
echo ""
echo "[1.1] ======== CEK PORT 4000 (ss, lsof, netstat) ========"
echo ""
echo "--- ss -tlnp | grep :4000 ---"
ss -tlnp 2>/dev/null | grep :4000
PORT4000_SS=$(ss -tlnp 2>/dev/null | grep :4000 | wc -l)
echo "PORT4000_SS_COUNT=$PORT4000_SS"
echo ""
echo "--- lsof -i :4000 ---"
lsof -i :4000 2>/dev/null
PORT4000_LSOF=$(lsof -i :4000 2>/dev/null | grep -v "^COMMAND" | wc -l)
echo "PORT4000_LSOF_COUNT=$PORT4000_LSOF"
echo ""
echo "--- netstat -tlnp 2>/dev/null | grep :4000 ---"
netstat -tlnp 2>/dev/null | grep :4000 || echo "(netstat tidak tersedia / port tidak ditemukan)"
echo ""
echo "------------------------------------------------------------------------"
if [ "$PORT4000_SS" -gt 0 ] || [ "$PORT4000_LSOF" -gt 0 ]; then
  echo "STATUS_PORT4000=LISTEN"
else
  echo "STATUS_PORT4000=NOT_LISTEN"
fi
echo "------------------------------------------------------------------------"
echo ""
echo "[1.2] ======== TAIL 300 LINE /tmp/deploy_v6.log ========"
if [ -f /tmp/deploy_v6.log ]; then
  TOTAL_LINES=$(wc -l < /tmp/deploy_v6.log 2>/dev/null || echo 0)
  SIZE_H=$(ls -lh /tmp/deploy_v6.log 2>/dev/null | awk '{print $5}')
  echo "File DITEMUKAN — total=$TOTAL_LINES baris, size=$SIZE_H"
  echo "--- tail -n 300 ---"
  tail -n 300 /tmp/deploy_v6.log
else
  echo "❌ FILE /tmp/deploy_v6.log TIDAK DITEMUKAN"
  echo "ls /tmp (filter deploy*):"
  ls -la /tmp/ 2>/dev/null | grep -i deploy || echo "(tidak ada file deploy* di /tmp)"
fi
echo ""
echo "[1.3] ======== PM2 LIST + PM2 LOGS api-blue (30L) ========"
if command -v pm2 &> /dev/null; then
  echo "PM2 versi: $(pm2 --version 2>&1)"
  echo ""
  echo "--- pm2 list ---"
  pm2 jlist 2>&1 | head -200
  echo ""
  echo "--- pm2 logs api-blue --nostream --lines 30 --raw ---"
  pm2 logs api-blue --nostream --lines 30 --raw 2>&1
else
  echo "❌ PM2 TIDAK TERINSTAL / TIDAK ADA DI PATH"
fi
echo ""
echo "[1.4] ======== INFO RUNTIME SERVER ========"
echo "PWD remote saat ini: $(pwd)"
echo "HOME: $HOME"
echo "User: $(whoami)"
echo "Uname: $(uname -a)"
echo ""
echo "--- Node / npm versi ---"
node --version 2>&1
npm --version 2>&1
echo ""
echo "--- Struktur project $REMOTE_ROOT (head 30) ---"
ls -la "$REMOTE_ROOT" 2>&1 | head -30
echo ""
echo "--- Cek package.json & node_modules ---"
for f in "$REMOTE_ROOT/package.json" "$REMOTE_ROOT/apps/api/package.json" "$REMOTE_ROOT/apps/web/package.json"; do
  if [ -f "$f" ]; then
    echo "  ✅ $f"
  else
    echo "  ❌ $f MISSING"
  fi
done
for d in "$REMOTE_ROOT/node_modules" "$REMOTE_ROOT/apps/api/node_modules" "$REMOTE_ROOT/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    SZ=$(du -sh "$d" 2>/dev/null | cut -f1)
    CNT=$(ls "$d" 2>/dev/null | wc -l)
    echo "  📁 $d — $SZ, $CNT package"
  else
    echo "  🚫 $d — TIDAK ADA"
  fi
done
echo ""
echo "--- PORT lain yang listen (>1024) ---"
ss -tlnp 2>/dev/null | awk '$4 ~ /:[0-9]{4,}$/ {print}' | head -20
"""
    log()
    log("[STEP 1] Menjalankan diagnostic remote...")
    rc1, out1 = ssh_upload_and_run(STEP1_SCRIPT, timeout=180, desc="STEP 1 DIAGNOSTIC")
    save_output_to_file()

    # Parse: apakah perlu recovery?
    need_recovery = True
    if "STATUS_PORT4000=LISTEN" in out1:
        need_recovery = False

    log()
    log("┌──────────────────────────────────────────────────────────────────────┐")
    if need_recovery:
        log("│ 🔴 KESIMPULAN STEP 1: PORT 4000 TIDAK LISTEN → JALANKAN RECOVERY    │")
    else:
        log("│ 🟢 KESIMPULAN STEP 1: PORT 4000 SUDAH LISTEN → SKIP RECOVERY        │")
    log("└──────────────────────────────────────────────────────────────────────┘")
    log()

    # ========================================================================
    # STEP 2: FULL RECOVERY (jika dibutuhkan)
    # ========================================================================
    if need_recovery:
        log("╔══════════════════════════════════════════════════════════════════════╗")
        log("║ STEP 2 — FULL RECOVERY (a → e) SESUAI SOP USER                      ║")
        log("╚══════════════════════════════════════════════════════════════════════╝")

        STEP2_SCRIPT = f'''
echo ""
echo "[RECOVERY a] ======== PM2 DELETE SEMUA + PM2 KILL ========"
if command -v pm2 &> /dev/null; then
  echo "--- pm2 list SEBELUM ---"
  pm2 list 2>&1
  echo ""
  echo "--- pm2 delete all ---"
  pm2 delete all 2>&1
  echo "Exit delete all = $?"
  echo ""
  echo "--- pm2 kill ---"
  pm2 kill 2>&1
  echo "Exit kill = $?"
  sleep 3
  echo ""
  echo "--- pm2 list SETELAH ---"
  pm2 list 2>&1
else
  echo "PM2 tidak ditemukan di PATH — skip delete"
fi

echo ""
echo "[RECOVERY b] ======== HAPUS node_modules (force clean stale) ========"
RD="{REMOTE_ROOT}"
echo "Target:"
echo "  1) $RD/node_modules"
echo "  2) $RD/apps/api/node_modules"
echo "  3) $RD/apps/web/node_modules"
echo ""
echo "--- SEBELUM ---"
for d in "$RD/node_modules" "$RD/apps/api/node_modules" "$RD/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    echo "  SEBELUM: $d ADA — $(du -sh "$d" 2>/dev/null | cut -f1)"
  else
    echo "  SEBELUM: $d TIDAK ADA"
  fi
done
echo ""
echo "Menjalankan rm -rf (force)..."
rm -rf "$RD/node_modules" && echo "  ✅ root/node_modules dihapus" || echo "  root/node_modules: gagal/tidak ada"
rm -rf "$RD/apps/api/node_modules" && echo "  ✅ apps/api/node_modules dihapus" || echo "  apps/api/node_modules: gagal/tidak ada"
rm -rf "$RD/apps/web/node_modules" && echo "  ✅ apps/web/node_modules dihapus" || echo "  apps/web/node_modules: gagal/tidak ada"
echo ""
echo "--- SETELAH ---"
for d in "$RD/node_modules" "$RD/apps/api/node_modules" "$RD/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    echo "  ❌ SETELAH: $d MASIH ADA!"
  else
    echo "  ✅ SETELAH: $d SUDAH TERHAPUS"
  fi
done
echo ""
echo "--- find sisa node_modules maxdepth=3 ---"
find "$RD" -maxdepth 3 -name "node_modules" -type d 2>&1

echo ""
echo "[RECOVERY c] ======== NPM CI --omit=dev (FRESH INSTALL) ========"
echo ""
echo "  Runtime:"
node --version 2>&1 | sed 's/^/    node: /'
npm --version 2>&1 | sed 's/^/    npm : /'
echo ""
echo "[c.1] $RD → npm ci --omit=dev --no-audit --no-fund"
echo "------------------------------------------------------------------------"
cd "$RD" || {{ echo "CD GAGAL ke $RD"; exit 1; }}
pwd
npm ci --omit=dev --no-audit --no-fund 2>&1
EXIT_ROOT=$?
echo ""
echo "EXIT_CODE_ROOT_NPM_CI=$EXIT_ROOT"
echo ""
echo "[c.2] $RD/apps/api → npm ci --omit=dev --no-audit --no-fund"
echo "------------------------------------------------------------------------"
cd "$RD/apps/api" || {{ echo "CD GAGAL ke apps/api"; }}
pwd
npm ci --omit=dev --no-audit --no-fund 2>&1
EXIT_API=$?
echo ""
echo "EXIT_CODE_API_NPM_CI=$EXIT_API"
echo ""
echo "[c.3] $RD/apps/web → npm ci --omit=dev --no-audit --no-fund"
echo "------------------------------------------------------------------------"
cd "$RD/apps/web" || {{ echo "CD GAGAL ke apps/web"; }}
pwd
npm ci --omit=dev --no-audit --no-fund 2>&1
EXIT_WEB=$?
echo ""
echo "EXIT_CODE_WEB_NPM_CI=$EXIT_WEB"
echo ""
echo "--- VERIFIKASI node_modules SETELAH npm ci ---"
for d in "$RD/node_modules" "$RD/apps/api/node_modules" "$RD/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    SZ=$(du -sh "$d" 2>/dev/null | cut -f1)
    CNT=$(ls "$d" 2>/dev/null | wc -l)
    echo "  ✅ $d — $SZ, $CNT packages"
  else
    echo "  ❌ $d — TIDAK ADA (npm ci kemungkinan gagal!)"
  fi
done
echo ""
echo "--- cek bin krusial ---"
for b in "$RD/apps/web/node_modules/.bin/next" "$RD/apps/api/dist/main.js"; do
  if [ -e "$b" ]; then
    echo "  ✅ ada: $b"
  else
    echo "  ⚠️  tidak ada: $b"
  fi
done

echo ""
echo "[RECOVERY d] ======== PM2 START ecosystem.config.js (BLUE ONLY) ========"
cd "$RD" || {{ echo "CD GAGAL ke $RD"; exit 1; }}
echo "PWD: $(pwd)"
echo ""
echo "--- cat ecosystem.config.js (head 60) ---"
head -60 ecosystem.config.js 2>&1
echo ""
echo "Perintah PM2:"
echo "  PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env"
echo "------------------------------------------------------------------------"
PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env 2>&1
EXIT_PM2=$?
echo ""
echo "EXIT_CODE_PM2_START=$EXIT_PM2"
echo ""
echo "--- pm2 list SETELAH start (instan) ---"
pm2 list 2>&1

echo ""
echo "[RECOVERY e] ======== SLEEP 20 DETIK (bootstrap app) ========"
echo "  Mulai : $(date '+%H:%M:%S')"
sleep 20
echo "  Selesai: $(date '+%H:%M:%S')"
echo ""
echo "--- pm2 list SETELAH sleep 20s ---"
pm2 list 2>&1
'''

        log()
        log("[STEP 2] Menjalankan recovery a-e. Ini akan MEMAKAI WAKTU LAMA (npm ci ~10-20 menit)")
        rc2, out2 = ssh_upload_and_run(STEP2_SCRIPT, timeout=1800, desc="STEP 2 RECOVERY")
        save_output_to_file()
        log()
        log(f"[STEP 2] Recovery selesai (exit remote = {rc2})")
        log()

    # ========================================================================
    # STEP 3: VERIFIKASI — curl 20x :4000/health & :3000/
    # ========================================================================
    log("╔══════════════════════════════════════════════════════════════════════╗")
    log("║ STEP 3 — VERIFIKASI: CURL 20x :4000/health & :3000/ (min 18x HTTP200)║")
    log("╚══════════════════════════════════════════════════════════════════════╝")

    STEP3_SCRIPT = r'''
echo ""
echo "[VERIFIKASI] Mulai: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "--- Cek port 4000/3000 SEBELUM curl ---"
ss -tlnp 2>/dev/null | grep -E ":(4000|3000)" || echo "(tidak ada port 4000/3000 di ss)"
echo ""
echo "[VERIF 3A] ======== CURL 20x http://127.0.0.1:4000/health ========"
API_OK=0
API_TOTAL=20
API_DETAIL=""
for i in $(seq 1 $API_TOTAL); do
  START_NS=$(date +%s%N 2>/dev/null || echo 0)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:4000/health 2>&1)
  END_NS=$(date +%s%N 2>/dev/null || echo 0)
  if [ "$START_NS" -gt 0 ] && [ "$END_NS" -gt 0 ]; then
    ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))
    echo "  health #$i → HTTP $CODE (${ELAPSED_MS}ms)"
    API_DETAIL="${API_DETAIL}#$i:$CODE(${ELAPSED_MS}ms) "
  else
    echo "  health #$i → HTTP $CODE"
    API_DETAIL="${API_DETAIL}#$i:$CODE "
  fi
  if [ "$CODE" = "200" ]; then
    API_OK=$((API_OK + 1))
  fi
  sleep 0.3
done
echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "RINGKASAN :4000/health:"
echo "  HTTP 200         = $API_OK / $API_TOTAL"
echo "  Requirement      = >= 18x HTTP 200"
if [ "$API_OK" -ge 18 ]; then
  echo "  STATUS           = ✅ LULUS"
else
  echo "  STATUS           = ❌ BELUM LULUS"
fi
echo "  Detail percobaan = $API_DETAIL"
echo ""
API_SAMPLE=$(curl -s --max-time 5 http://127.0.0.1:4000/health 2>&1 | head -c 400)
echo "  Sample response body: $API_SAMPLE"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "[VERIF 3B] ======== CURL 20x http://127.0.0.1:3000/ ========"
WEB_OK=0
WEB_TOTAL=20
WEB_DETAIL=""
for i in $(seq 1 $WEB_TOTAL); do
  START_NS=$(date +%s%N 2>/dev/null || echo 0)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:3000/ 2>&1)
  END_NS=$(date +%s%N 2>/dev/null || echo 0)
  if [ "$START_NS" -gt 0 ] && [ "$END_NS" -gt 0 ]; then
    ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))
    echo "  web    #$i → HTTP $CODE (${ELAPSED_MS}ms)"
    WEB_DETAIL="${WEB_DETAIL}#$i:$CODE(${ELAPSED_MS}ms) "
  else
    echo "  web    #$i → HTTP $CODE"
    WEB_DETAIL="${WEB_DETAIL}#$i:$CODE "
  fi
  if [ "$CODE" = "200" ]; then
    WEB_OK=$((WEB_OK + 1))
  fi
  sleep 0.3
done
echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "RINGKASAN :3000/:"
echo "  HTTP 200         = $WEB_OK / $WEB_TOTAL"
echo "  Requirement      = >= 18x HTTP 200"
if [ "$WEB_OK" -ge 18 ]; then
  echo "  STATUS           = ✅ LULUS"
else
  echo "  STATUS           = ❌ BELUM LULUS"
fi
echo "  Detail percobaan = $WEB_DETAIL"
echo ""
WEB_SAMPLE=$(curl -s --max-time 5 http://127.0.0.1:3000/ 2>&1 | head -c 400)
echo "  Sample response body (400char):"
echo "    $WEB_SAMPLE"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "================================================================================"
echo "[VERIF FINAL] RINGKASAN KELULUSAN"
echo "================================================================================"
echo "API_200_COUNT=$API_OK"
echo "WEB_200_COUNT=$WEB_OK"
echo ""
if [ "$API_OK" -ge 18 ]; then
  echo "✅ API_STATUS=PASS ($API_OK >= 18)"
else
  echo "❌ API_STATUS=FAIL ($API_OK < 18)"
fi
if [ "$WEB_OK" -ge 18 ]; then
  echo "✅ WEB_STATUS=PASS ($WEB_OK >= 18)"
else
  echo "❌ WEB_STATUS=FAIL ($WEB_OK < 18)"
fi
echo ""
if [ "$API_OK" -ge 18 ] && [ "$WEB_OK" -ge 18 ]; then
  echo "🎉 OVERALL_STATUS=PASS — API + WEB KEDUANYA LULUS"
else
  echo "⚠️  OVERALL_STATUS=PARTIAL_OR_FAIL — periksa log di atas"
fi
echo ""
echo "[VERIF TAIL LOG] ======== pm2 logs api-blue (50L TERAKHIR) ========"
pm2 logs api-blue --nostream --lines 50 --raw 2>&1
echo ""
echo "[VERIF TAIL LOG] ======== pm2 logs web-blue (50L TERAKHIR) ========"
pm2 logs web-blue --nostream --lines 50 --raw 2>&1
echo ""
echo "[FINAL] ======== PM2 LIST + PORT CHECK AKHIR ========"
echo ""
echo "--- pm2 list ---"
pm2 list 2>&1
echo ""
echo "--- ss -tlnp | grep -E ':(4000|3000)' ---"
ss -tlnp 2>/dev/null | grep -E ":(4000|3000)" || echo "(tidak ada hasil / tool tidak tersedia)"
echo ""
echo "--- lsof -i :4000,:3000 ---"
lsof -i :4000 -i :3000 2>/dev/null || echo "(lsof tidak tersedia / tidak ada proses)"
echo ""
echo "=== SELESAI SEMUA TAHAP ==="
'''
    log()
    rc3, out3 = ssh_upload_and_run(STEP3_SCRIPT, timeout=600, desc="STEP 3 VERIFIKASI")
    save_output_to_file()

    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    TS_END = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log()
    log(f"{'='*72}")
    log(f"  FINAL SUMMARY")
    log(f"  Waktu selesai : {TS_END}")
    log(f"{'='*72}")

    # Parse hasil penting dari output
    def extract_kv(tag: str, text: str) -> str:
        for line in text.splitlines():
            if tag in line:
                return line.strip()
        return ""

    all_text = "\n".join(LOG_BUFFER)
    summary_tags = [
        "STATUS_PORT4000=",
        "API_200_COUNT=",
        "WEB_200_COUNT=",
        "API_STATUS=",
        "WEB_STATUS=",
        "OVERALL_STATUS=",
        "EXIT_CODE_ROOT_NPM_CI=",
        "EXIT_CODE_API_NPM_CI=",
        "EXIT_CODE_WEB_NPM_CI=",
        "EXIT_CODE_PM2_START=",
    ]
    for tag in summary_tags:
        line = extract_kv(tag, all_text)
        if line:
            clean = line.lstrip()
            # Hapus prefix indent 2
            if clean.startswith("  "):
                clean = clean[2:]
            log(f"  {clean}")
    log()
    log(f"  Output file lokal : {OUTPUT_LOCAL.resolve()}")
    log(f"{'='*72}")

    save_output_to_file()

    overall_pass = ("OVERALL_STATUS=PASS" in all_text) or \
                   ("✅ API_STATUS=PASS" in all_text and "✅ WEB_STATUS=PASS" in all_text)
    return 0 if overall_pass else 4


if __name__ == "__main__":
    try:
        rc = main()
    except KeyboardInterrupt:
        log("\n[LOCAL] ⚠️  Dibatasi user (Ctrl+C). Output parsial disimpan.")
        save_output_to_file()
        rc = 130
    except Exception as exc:
        log(f"\n[LOCAL] 💀 EXCEPTION TIDAK TERTAHANKAN: {type(exc).__name__}: {exc}")
        import traceback
        log("  " + "\n  ".join(traceback.format_exc().splitlines()[-10:]))
        save_output_to_file()
        rc = 99
    sys.exit(rc)
