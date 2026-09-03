#!/usr/bin/env bash
# ========================================================================
# deploy_canary.sh — SARANASMK PM2 BLUE-GREEN CANARY DEPLOY ORCHESTRATOR
# Slot spec:
#   api-blue  :4000    (LIVE stable,  N instances default = CPU cores)
#   api-green :4001    (CANARY, mulai 1 instance → 10% → 50% → 100%)
#   web-blue  :3000    (LIVE stable)
#   web-green :3001    (CANARY, mulai 1 instance → 10% → 50% → 100%)
#
# Rules:
#   - HEALTH_THRESHOLD_PCT = 95% success rate HTTP 2xx/3xx dari sample 20 curl.
#   - Bila health gagal → stop green slot dalam 60s (ROLLBACK). Blue tetap jalan.
#   - Bila health OK, LANJUT SCALE persentase berikutnya.
#
# Usage (dari repo root):
#   chmod +x deploy_canary.sh && ./deploy_canary.sh
#   PM2_BLUE_INST=12 ./deploy_canary.sh   (untuk LIVE server CPU=12 → 12 blue inst)
# ========================================================================
set -o pipefail

LOGDIR="./logs"
mkdir -p "$LOGDIR"
RUNLOG="$LOGDIR/canary_deploy_$(date +%Y%m%d_%H%M%S).log"

log()  { printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$RUNLOG"; }
die()  { log "ERROR: $* — ROLLBACK inisialisasi."; rollback_green; exit 13; }

: "${PM2_BLUE_INST:=$(pm2 describe api-blue 2>/dev/null | awk '/instances/ {print $2; exit}' | grep -oE '[0-9]+' || echo 4)}"
export PM2_BLUE_INST
HEALTH_SAMPLE=20
HEALTH_THRESHOLD_PCT=95
WAIT_BETWEEN_STEPS=30
API_BLUE_PORT=4000  API_GREEN_PORT=4001
WEB_BLUE_PORT=3000  WEB_GREEN_PORT=3001

# --- helpers ----------------------------------------------------------------
health_curl_slot() {
  local name="$1" port="$2" sample="$3"
  local ok=0 fail=0 code=""
  log "HEALTH-CHECK $name (port $port, $sample samples, threshold=${HEALTH_THRESHOLD_PCT}%)"
  for i in $(seq 1 "$sample"); do
    code=$(curl -sfo /dev/null -w "%{http_code}" --max-time 8 "http://127.0.0.1:${port}/health" 2>/dev/null || echo "000")
    if [[ "$code" =~ ^[23] ]]; then ok=$((ok+1)); else fail=$((fail+1)); fi
    sleep 0.07
  done
  local pct=$(( (ok*100) / sample ))
  log "  $name OK=$ok FAIL=$fail PASS_RATE=${pct}%"
  if (( pct >= HEALTH_THRESHOLD_PCT )); then return 0; else return 1; fi
}

rollback_green() {
  log "ROLLBACK GREEN: menghentikan api-green + web-green. Blue ($API_BLUE_PORT/$WEB_BLUE_PORT) tetap serve."
  pm2 delete api-green  2>/dev/null || true
  pm2 delete web-green  2>/dev/null || true
  sleep 3
  pm2 save 2>/dev/null || true
  log "ROLLBACK GREEN selesai. Lihat logs/$RUNLOG untuk detail."
}

promote_green_to_blue() {
  local mode="$1"
  log "============================================="
  log "PROMOTE: GREEN → BLUE (mode=$mode)"
  log "============================================="
  pm2 stop   api-blue   2>/dev/null || true
  pm2 delete api-blue   2>/dev/null || true
  pm2 stop   web-blue   2>/dev/null || true
  pm2 delete web-blue   2>/dev/null || true
  sleep 2
  pm2 restart api-green --name api-blue   --update-env || pm2 restart api-green
  pm2 restart web-green --name web-blue   --update-env || pm2 restart web-green
  # Cleanup nama hijacked (restart --name tidak cukup hapus slot green); re-instantiate blank green later.
  pm2 save 2>/dev/null || true
  sleep 3
  log "Promote selesai. api-blue = $API_BLUE_PORT (was green), web-blue = $WEB_BLUE_PORT (was green). Final instances=$PM2_BLUE_INST."
  # final scale blue to full PM2_BLUE_INST
  pm2 scale api-blue "$PM2_BLUE_INST" 2>/dev/null || true
  pm2 scale web-blue "$PM2_BLUE_INST" 2>/dev/null || true
  pm2 save 2>/dev/null || true
}

scale_and_verify() {
  local pct_label="$1" pct_num="$2"
  local N=$(( (PM2_BLUE_INST * pct_num + 99) / 100 ))  # ceil(%)
  (( N < 1 )) && N=1
  log "CANARY STEP $pct_label → scale green api=$N web=$N instances"
  pm2 scale api-green "$N" || die "pm2 scale api-green $N gagal"
  pm2 scale web-green "$N" || die "pm2 scale web-green $N gagal"
  sleep "$WAIT_BETWEEN_STEPS"
  health_curl_slot "api-green-$pct_label"  "$API_GREEN_PORT"  "$HEALTH_SAMPLE" || die "api-green-$pct_label health di bawah $HEALTH_THRESHOLD_PCT%"
  health_curl_slot "web-green-$pct_label"  "$WEB_GREEN_PORT"  "$HEALTH_SAMPLE" || die "web-green-$pct_label health di bawah $HEALTH_THRESHOLD_PCT%"
}

# ========================================================================
# M A I N
# ========================================================================
log "START deploy_canary.sh | PM2_BLUE_INST=$PM2_BLUE_INST | logs -> $RUNLOG"
log "BLUE slots (stable) → :$API_BLUE_PORT/:$WEB_BLUE_PORT | GREEN canary → :$API_GREEN_PORT/:$WEB_GREEN_PORT"

# 0. Pastikan BLUE jalan terlebih dahulu (atau start bila belum).
if ! pm2 pid api-blue >/dev/null 2>&1; then
  log "api-blue belum ada. Start ecosystem blue slots pertama kali (N=$PM2_BLUE_INST)."
  pm2 start ecosystem.config.js --only api-blue,web-blue || die "Start BLUE pertama kali gagal"
  sleep 10
fi

# 1. Start GREEN canary dengan 1 instance (= ~1% atau minimum 1).
log "[STEP 1%] Start GREEN canary awal 1 instance"
pm2 delete api-green web-green 2>/dev/null || true
export PM2_GREEN_START=1
pm2 start ecosystem.config.js --only api-green,web-green --update-env || die "Start GREEN canary 1 inst gagal"
sleep "$WAIT_BETWEEN_STEPS"
health_curl_slot "api-green-1pct"  "$API_GREEN_PORT"  "$HEALTH_SAMPLE" || die "api-green tahap 1% gagal health"
health_curl_slot "web-green-1pct"  "$WEB_GREEN_PORT"  "$HEALTH_SAMPLE" || die "web-green tahap 1% gagal health"

# 2. Scale tahapan 10% → 50% → 100%
scale_and_verify "10pct" 10
scale_and_verify "50pct" 50
scale_and_verify "100pct" 100

# 3. Semua tahapan health PASS → PROMOTE green jadi blue baru
promote_green_to_blue "full_100pct"

log "CANARY DEPLOY FINISH ✅ Exit 0. Full log: $RUNLOG"
exit 0
