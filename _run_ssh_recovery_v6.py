#!/usr/bin/env python3
"""Script SSH Recovery untuk server 103.160.202.73
   Sesuai SOP user: cek port -> recovery (jika perlu) -> verifikasi curl 20x
   Output disimpan ke /tmp/subagent_ssh_result.txt (lokal Mac)
"""
import datetime, sys, os, time
OUTPUT_LOCAL = "/tmp/subagent_ssh_result.txt"
all_log_lines = []
def log(s=""):
    print(s, flush=True)
    all_log_lines.append(s)
def save_output():
    with open(OUTPUT_LOCAL, "w", encoding="utf-8") as f:
        f.write("\n".join(all_log_lines) + "\n")
TS = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
log(f"{'='*72}")
log(f"SUBAGENT SSH RECOVERY TASK — Server 103.160.202.73")
log(f"Waktu mulai: {TS}")
log(f"{'='*72}")
log()

# Cek paramiko
try:
    import paramiko
except ImportError:
    log("[LOCAL] paramiko tidak tersedia. Install via pip...")
    import subprocess
    r = subprocess.run([sys.executable, "-m", "pip", "install", "paramiko", "--quiet"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        log(f"[LOCAL] GAGAL install paramiko: {r.stderr[-500:]}")
        log(f"[LOCAL] Mencoba dengan sshpass/subprocess fallback...")
        # Fallback
        save_output()
        sys.exit(3)
    import paramiko

HOST = "103.160.202.73"
USER = "alatprods"
PASSWORD = "Direktorat5mk123!@#"
BASE_REMOTE = f"/home/{USER}/saranasmk"

log(f"[CONNECT] SSH ke {USER}@{HOST} menggunakan paramiko...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30, port=22,
                auth_timeout=30, banner_timeout=30)
    log("  [CONNECT] OK.")
except Exception as e:
    log(f"  [CONNECT] GAGAL: {type(e).__name__}: {e}")
    save_output()
    sys.exit(2)

def run(cmd, timeout=600, show_last_n=0):
    """Run remote command, capture output, log"""
    log(f"\n▸ [REMOTE] $ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    try:
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        rc = stdout.channel.recv_exit_status()
        combined = out + ("\n" if (out and err) else "") + err
        # Cetak ke log
        printed = 0
        for line in combined.splitlines():
            log("  " + line)
            printed += 1
            if show_last_n and printed > show_last_n and (printed - show_last_n) > 0:
                # skip showing some middle
                pass
        log(f"  [exit={rc}]")
        return rc, out, err
    except Exception as e:
        log(f"  [EXCEPTION] {type(e).__name__}: {e}")
        return -1, "", str(e)

_script_seq = 0
def run_script(script_body, timeout=900, desc=""):
    """Upload bash script ke server lalu jalankan"""
    global _script_seq
    _script_seq += 1
    ts_tag = datetime.datetime.now().strftime("%H%M%S")
    remote_path = f"/tmp/_subagent_{ts_tag}_{_script_seq:02d}.sh"
    sftp = ssh.open_sftp()
    with sftp.file(remote_path, "w") as f:
        f.write("#!/usr/bin/env bash\nset +e\n")
        f.write(script_body.rstrip() + "\n")
    sftp.chmod(remote_path, 0o755)
    sftp.close()
    if desc:
        log(f"\n{'='*60}")
        log(f"  {desc}")
        log(f"  [script uploaded: {remote_path}]")
        log(f"{'='*60}")
    return run(f"bash {remote_path} 2>&1", timeout=timeout)

# ================================================================
# STEP 1 : Cek port 4000, ambil deploy_v6.log 300 line, pm2 logs api-blue 30 line
# ================================================================
STEP1 = r"""
echo ""
echo "[1.1] ======== CEK PORT 4000 (ss / lsof / netstat) ========"
echo ""
echo "--- ss -tlnp | grep :4000 ---"
ss -tlnp 2>/dev/null | grep :4000
PORT4000_SS=$(ss -tlnp 2>/dev/null | grep :4000 | wc -l)
echo "PORT4000_SS_COUNT=$PORT4000_SS"
echo ""
echo "--- lsof -i :4000 ---"
lsof -i :4000 2>/dev/null
PORT4000_LSOF=$(lsof -i :4000 2>/dev/null | wc -l)
echo "PORT4000_LSOF_COUNT=$PORT4000_LSOF"
echo ""
echo "--- netstat -tlnp 2>/dev/null | grep :4000 ---"
netstat -tlnp 2>/dev/null | grep :4000 || echo "(netstat tidak tersedia)"
echo ""
# Kesimpulan
if [ "$PORT4000_SS" -gt 0 ] || [ "$PORT4000_LSOF" -gt 1 ]; then
  echo "STATUS_PORT4000=LISTEN"
else
  echo "STATUS_PORT4000=NOT_LISTEN"
fi
echo ""
echo "[1.2] ======== TAIL 300 LINE /tmp/deploy_v6.log ========"
if [ -f /tmp/deploy_v6.log ]; then
  TOTAL=$(wc -l < /tmp/deploy_v6.log)
  SIZE=$(ls -lh /tmp/deploy_v6.log | awk '{print $5}')
  echo "File ADA — total lines=$TOTAL, size=$SIZE"
  echo "--- tail -n 300 ---"
  tail -n 300 /tmp/deploy_v6.log
else
  echo "FILE /tmp/deploy_v6.log TIDAK DITEMUKAN"
  echo "ls /tmp | grep -i deploy :"
  ls -la /tmp/ 2>/dev/null | grep -i deploy || echo "(tidak ada file deploy* di /tmp)"
fi
echo ""
echo "[1.3] ======== PM2 LIST + PM2 LOGS api-blue 30 line ========"
if command -v pm2 &> /dev/null; then
  echo "PM2 versi: $(pm2 --version 2>&1)"
  echo ""
  echo "--- pm2 list ---"
  pm2 list 2>&1
  echo ""
  echo "--- pm2 logs api-blue --nostream --lines 30 --raw ---"
  pm2 logs api-blue --nostream --lines 30 --raw 2>&1
else
  echo "PM2 TIDAK TERINSTAL / TIDAK ADA DI PATH"
fi
echo ""
echo "[1.4] ======== CEK FOLDER PROJECT & node_modules ========"
PROJECT_DIR="/home/alatprods/saranasmk"
echo "PROJECT_DIR=$PROJECT_DIR"
echo ""
ls -la "$PROJECT_DIR" 2>&1 | head -25
echo ""
echo "--- package.json ---"
for f in "$PROJECT_DIR/package.json" "$PROJECT_DIR/apps/api/package.json" "$PROJECT_DIR/apps/web/package.json"; do
  if [ -f "$f" ]; then
    echo "  OK: $f"
  else
    echo "  MISSING: $f"
  fi
done
echo ""
echo "--- node_modules ---"
for d in "$PROJECT_DIR/node_modules" "$PROJECT_DIR/apps/api/node_modules" "$PROJECT_DIR/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    SZ=$(du -sh "$d" 2>/dev/null | cut -f1)
    CNT=$(ls "$d" 2>/dev/null | wc -l)
    echo "  ADA: $d — $SZ, $CNT entries"
  else
    echo "  TIDAK ADA: $d"
  fi
done
echo ""
echo "--- Node & npm versi ---"
node --version 2>&1
npm --version 2>&1
echo ""
echo "--- OS info ---"
uname -a 2>&1
cat /etc/os-release 2>/dev/null | head -4
"""
rc, step1_out, step1_err = run_script(STEP1, timeout=120, desc="STEP 1 — CEK PORT 4000 + LOG deploy_v6.log 300L + PM2 LOGS api-blue 30L")
step1_full = step1_out + step1_err
need_recovery = True
if "STATUS_PORT4000=LISTEN" in step1_full:
    need_recovery = False

log()
log("="*72)
if need_recovery:
    log("[KESIMPULAN STEP 1] PORT 4000 TIDAK LISTEN → AKAN MENJALANKAN RECOVERY")
else:
    log("[KESIMPULAN STEP 1] PORT 4000 SUDAH LISTEN → SKIP RECOVERY, HANYA VERIFIKASI")
log("="*72)
save_output()

# ================================================================
# STEP 2 : RECOVERY (jika port 4000 tidak listen)
# ================================================================
if need_recovery:
    RECOVERY = r'''
echo ""
echo "[RECOVERY a] ======== PM2 DELETE SEMUA + PM2 KILL ========"
if command -v pm2 &> /dev/null; then
  echo "--- pm2 list SEBELUM delete ---"
  pm2 list 2>&1
  echo ""
  echo "--- pm2 delete all ---"
  pm2 delete all 2>&1
  echo "Exit: $?"
  echo ""
  echo "--- pm2 kill ---"
  pm2 kill 2>&1
  echo "Exit: $?"
  sleep 2
  echo ""
  echo "--- pm2 list SETELAH delete ---"
  pm2 list 2>&1
else
  echo "PM2 tidak ada di PATH — skip delete"
fi

echo ""
echo "[RECOVERY b] ======== HAPUS node_modules (force clean stale) ========"
PROJECT_DIR="/home/alatprods/saranasmk"
echo "Target hapus:"
echo "  1. $PROJECT_DIR/node_modules"
echo "  2. $PROJECT_DIR/apps/api/node_modules"
echo "  3. $PROJECT_DIR/apps/web/node_modules"
echo ""
echo "--- SEBELUM hapus ---"
for d in "$PROJECT_DIR/node_modules" "$PROJECT_DIR/apps/api/node_modules" "$PROJECT_DIR/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    SZ=$(du -sh "$d" 2>/dev/null | cut -f1)
    echo "  SEBELUM: $d ADA — $SZ"
  else
    echo "  SEBELUM: $d TIDAK ADA"
  fi
done
echo ""
echo "Menghapus dengan rm -rf ..."
rm -rf "$PROJECT_DIR/node_modules" && echo "  OK hapus root/node_modules" || echo "  root/node_modules: GAGAL/tidak ada"
rm -rf "$PROJECT_DIR/apps/api/node_modules" && echo "  OK hapus apps/api/node_modules" || echo "  apps/api/node_modules: GAGAL/tidak ada"
rm -rf "$PROJECT_DIR/apps/web/node_modules" && echo "  OK hapus apps/web/node_modules" || echo "  apps/web/node_modules: GAGAL/tidak ada"
echo ""
echo "--- SETELAH hapus ---"
for d in "$PROJECT_DIR/node_modules" "$PROJECT_DIR/apps/api/node_modules" "$PROJECT_DIR/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    echo "  SETELAH: $d MASIH ADA ❌"
  else
    echo "  SETELAH: $d SUDAH TERHAPUS ✅"
  fi
done
echo ""
echo "--- find node_modules (maxdepth 3) ---"
find "$PROJECT_DIR" -maxdepth 3 -name "node_modules" -type d 2>&1

echo ""
echo "[RECOVERY c] ======== NPM CI --omit=dev (FRESH INSTALL) ========"
echo ""
echo "  Runtime:"
echo "    node: $(node --version 2>&1)"
echo "    npm : $(npm --version 2>&1)"
echo ""
echo "[c.1] cd $PROJECT_DIR → npm ci --omit=dev --no-audit --no-fund"
echo "------------------------------------------------------------------------"
cd "$PROJECT_DIR" || { echo "CD GAGAL ke $PROJECT_DIR"; exit 1; }
echo "  PWD = $(pwd)"
npm ci --omit=dev --no-audit --no-fund 2>&1
EXIT_ROOT=$?
echo ""
echo "EXIT_CODE_ROOT_NPM_CI=$EXIT_ROOT"
echo ""
echo "[c.2] cd $PROJECT_DIR/apps/api → npm ci --omit=dev --no-audit --no-fund"
echo "------------------------------------------------------------------------"
cd "$PROJECT_DIR/apps/api" || { echo "CD GAGAL ke apps/api"; }
echo "  PWD = $(pwd)"
npm ci --omit=dev --no-audit --no-fund 2>&1
EXIT_API=$?
echo ""
echo "EXIT_CODE_API_NPM_CI=$EXIT_API"
echo ""
echo "[c.3] cd $PROJECT_DIR/apps/web → npm ci --omit=dev --no-audit --no-fund"
echo "------------------------------------------------------------------------"
cd "$PROJECT_DIR/apps/web" || { echo "CD GAGAL ke apps/web"; }
echo "  PWD = $(pwd)"
npm ci --omit=dev --no-audit --no-fund 2>&1
EXIT_WEB=$?
echo ""
echo "EXIT_CODE_WEB_NPM_CI=$EXIT_WEB"
echo ""
echo "--- VERIFIKASI SETELAH npm ci ---"
for d in "$PROJECT_DIR/node_modules" "$PROJECT_DIR/apps/api/node_modules" "$PROJECT_DIR/apps/web/node_modules"; do
  if [ -d "$d" ]; then
    SZ=$(du -sh "$d" 2>/dev/null | cut -f1)
    CNT=$(ls "$d" 2>/dev/null | wc -l)
    echo "  ✅ $d ADA — $SZ, $CNT packages"
  else
    echo "  ❌ $d TIDAK ADA (npm ci GAGAL?)"
  fi
done
echo ""
echo "--- cek bin penting ---"
for b in "$PROJECT_DIR/node_modules/.bin/ts-node" "$PROJECT_DIR/node_modules/.bin/nest" "$PROJECT_DIR/node_modules/.bin/nx" \
         "$PROJECT_DIR/apps/web/node_modules/.bin/next" "$PROJECT_DIR/apps/api/node_modules/.bin/nest"; do
  if [ -x "$b" ]; then
    echo "  ✅ bin: $b"
  else
    echo "  ⚠️  bin tidak ada: $b"
  fi
done

echo ""
echo "[RECOVERY d] ======== PM2 START ecosystem.config.js ========"
PROJECT_DIR="/home/alatprods/saranasmk"
cd "$PROJECT_DIR" || { echo "CD GAGAL ke $PROJECT_DIR"; exit 1; }
echo "  PWD = $(pwd)"
echo ""
echo "--- Isi ecosystem.config.js (head 80 baris) ---"
head -80 ecosystem.config.js 2>&1
echo ""
echo "Perintah: PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env"
echo "------------------------------------------------------------------------"
PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env 2>&1
EXIT_PM2=$?
echo ""
echo "EXIT_CODE_PM2_START=$EXIT_PM2"
echo ""
echo "--- pm2 list SETELAH start (1) ---"
pm2 list 2>&1

echo ""
echo "[RECOVERY e] ======== SLEEP 20 DETIK (app bootstrap) ========"
echo "  Mulai  sleep: $(date '+%H:%M:%S')"
sleep 20
echo "  Selesai sleep: $(date '+%H:%M:%S')"
echo ""
echo "--- pm2 list SETELAH sleep 20s ---"
pm2 list 2>&1
'''
    log()
    run_script(RECOVERY, timeout=1200, desc="STEP 2 — FULL RECOVERY (a-e)")
    save_output()

# ================================================================
# STEP 3 : VERIFIKASI CURL 20x :4000/health dan :3000/
# ================================================================
VERIFY = r'''
echo ""
echo "[VERIFIKASI] ======== CURL 20x :4000/health DAN :3000/ ========"
echo "Waktu: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "--- Cek port SEBELUM curl ---"
ss -tlnp 2>/dev/null | grep -E ":(4000|3000)" || echo "(belum ada port 4000/3000 di ss)"
echo ""
echo "[VERIF 3a] ======== CURL 20x http://127.0.0.1:4000/health ========"
API_OK=0
API_TOTAL=20
API_DETAIL=""
for i in $(seq 1 $API_TOTAL); do
  START_NS=$(date +%s%N)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:4000/health 2>&1)
  END_NS=$(date +%s%N)
  ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))
  echo "  health #$i → HTTP $CODE (${ELAPSED_MS}ms)"
  API_DETAIL="${API_DETAIL}#$i:$CODE(${ELAPSED_MS}ms) "
  if [ "$CODE" = "200" ]; then
    API_OK=$((API_OK + 1))
  fi
  sleep 0.3
done
echo ""
echo "RINGKASAN API_HEALTH:"
echo "  HTTP 200 = $API_OK / $API_TOTAL"
echo "  Detail   = $API_DETAIL"
echo ""
API_BODY=$(curl -s --max-time 5 http://127.0.0.1:4000/health 2>&1 | head -c 400)
echo "  Sample response body: $API_BODY"
echo ""
echo "[VERIF 3b] ======== CURL 20x http://127.0.0.1:3000/ ========"
WEB_OK=0
WEB_TOTAL=20
WEB_DETAIL=""
for i in $(seq 1 $WEB_TOTAL); do
  START_NS=$(date +%s%N)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:3000/ 2>&1)
  END_NS=$(date +%s%N)
  ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))
  echo "  web    #$i → HTTP $CODE (${ELAPSED_MS}ms)"
  WEB_DETAIL="${WEB_DETAIL}#$i:$CODE(${ELAPSED_MS}ms) "
  if [ "$CODE" = "200" ]; then
    WEB_OK=$((WEB_OK + 1))
  fi
  sleep 0.3
done
echo ""
echo "RINGKASAN WEB_ROOT:"
echo "  HTTP 200 = $WEB_OK / $WEB_TOTAL"
echo "  Detail   = $WEB_DETAIL"
echo ""
WEB_BODY=$(curl -s --max-time 5 http://127.0.0.1:3000/ 2>&1 | head -c 400)
echo "  Sample response body (400char):"
echo "  $WEB_BODY"
echo ""
echo "================================================================================"
echo "[VERIF FINAL] CHECKLIST KELULUSAN (API HTTP 200 >=18x DAN WEB HTTP 200 >=18x)"
echo "================================================================================"
echo "API_200_COUNT=$API_OK"
echo "WEB_200_COUNT=$WEB_OK"
echo ""
if [ "$API_OK" -ge 18 ]; then
  echo "✅ API_STATUS=PASS — $API_OK/20 HTTP 200 (>= 18)"
else
  echo "❌ API_STATUS=FAIL — $API_OK/20 HTTP 200 (< 18)"
fi
if [ "$WEB_OK" -ge 18 ]; then
  echo "✅ WEB_STATUS=PASS — $WEB_OK/20 HTTP 200 (>= 18)"
else
  echo "❌ WEB_STATUS=FAIL — $WEB_OK/20 HTTP 200 (< 18)"
fi
echo ""
if [ "$API_OK" -ge 18 ] && [ "$WEB_OK" -ge 18 ]; then
  echo "🎉 OVERALL_STATUS=PASS — KEDUA SERVICE LULUS VERIFIKASI"
else
  echo "⚠️  OVERALL_STATUS=PARTIAL_OR_FAIL — setidaknya 1 service belum lulus"
fi
echo ""
echo "[VERIF TAIL LOG] ======== pm2 logs api-blue 50 line SETELAH recovery ========"
pm2 logs api-blue --nostream --lines 50 --raw 2>&1
echo ""
echo "[VERIF TAIL LOG] ======== pm2 logs web-blue 50 line SETELAH recovery ========"
pm2 logs web-blue --nostream --lines 50 --raw 2>&1
echo ""
echo "[FINAL] ======== PM2 LIST + PORT CHECK AKHIR ========"
echo ""
echo "--- pm2 list ---"
pm2 list 2>&1
echo ""
echo "--- ss -tlnp | grep -E ':(4000|3000)' ---"
ss -tlnp 2>/dev/null | grep -E ":(4000|3000)" || echo "(tidak ada output)"
echo ""
echo "--- lsof -i :4000,:3000 ---"
lsof -i :4000 -i :3000 2>/dev/null || echo "(tidak ada / lsof tidak tersedia)"
echo ""
echo "=== SELESAI SEMUA TAHAP ==="
'''
log()
run_script(VERIFY, timeout=600, desc="STEP 3 — VERIFIKASI CURL 20x + TAIL LOG AKHIR")

log()
log("="*72)
log(f"SELESAI SEMUA PROSES. Waktu selesai: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"Output lokal disimpan di: {OUTPUT_LOCAL}")
log("="*72)

# Simpan akhir
save_output()

# Close SSH
try:
    ssh.close()
except:
    pass

# Print summary ke stderr
summary_lines = []
for line in all_log_lines:
    if any(kw in line for kw in ["STATUS_PORT4000=", "API_200_COUNT=", "WEB_200_COUNT=",
                                  "API_STATUS=", "WEB_STATUS=", "OVERALL_STATUS=",
                                  "SELESAI SEMUA", "KESIMPULAN STEP 1"]):
        summary_lines.append(line)

sys.stderr.write("\n===== RINGKASAN =====\n")
for l in summary_lines:
    sys.stderr.write(l + "\n")
sys.stderr.write(f"Output file: {OUTPUT_LOCAL}\n")
sys.stderr.write(f"Total lines: {len(all_log_lines)}\n")
sys.exit(0)
