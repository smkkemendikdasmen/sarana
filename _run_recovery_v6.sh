#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# SARANASMK — PRODUKSI RECOVERY SUBAGENT v6 RUNNER WRAPPER
# -----------------------------------------------------------------------------
# Gampang dijalankan:
#   chmod +x _run_recovery_v6.sh && ./_run_recovery_v6.sh
#
# Atau dengan python explicit:
#   python3 _prod_recovery_subagent_v6.py
#
# Output AKHIR disimpan ke:
#   /tmp/subagent_ssh_result.txt        (Mac LOKAL — sesuai request user)
#   ./logs/subagent_recovery_*.log      (backup di project root)
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TS=$(date +%Y%m%d_%H%M%S)
LOG_DIR="$SCRIPT_DIR/logs"
RUN_LOG="$LOG_DIR/subagent_recovery_${TS}.log"

mkdir -p "$LOG_DIR"

echo "========================================================================"
echo " SARANASMK — PRODUKSI RECOVERY SUBAGENT v6"
echo " Server : 103.160.202.73 (alatprods)"
echo " Run log: $RUN_LOG"
echo " Output : /tmp/subagent_ssh_result.txt"
echo "========================================================================"
echo ""
echo "[0/3] Pre-flight check..."

# --- sshpass
if ! command -v sshpass &> /dev/null; then
  echo "❌ sshpass tidak terinstall."
  echo "   macOS:  brew install hudochenkov/sshpass/sshpass"
  echo "   Ubuntu: sudo apt-get install sshpass"
  exit 5
fi
echo "    ✅ sshpass OK"

# --- python3
if ! command -v python3 &> /dev/null; then
  echo "❌ python3 tidak terinstall"
  exit 6
fi
PY_VER=$(python3 --version 2>&1)
echo "    ✅ $PY_VER OK"

echo ""
echo "[1/3] Jalankan _prod_recovery_subagent_v6.py (total ~5-25 menit)"
echo "      - Step 1: Diagnostic + log ambil ~1-3 menit"
echo "      - Step 2: Recovery *jika dibutuhkan* ~10-20 menit (npm ci)"
echo "      - Step 3: Verifikasi curl 20x ~1-3 menit"
echo ""

# Jalankan Python script, TEE ke run log + stderr/stdout
set +e
python3 "$SCRIPT_DIR/_prod_recovery_subagent_v6.py" 2>&1 | tee "$RUN_LOG"
PY_RC=${PIPESTATUS[0]}
set -e

echo ""
echo "========================================================================"
echo "[2/3] Python script exit code = $PY_RC"
echo "========================================================================"

echo ""
echo "[3/3] Verifikasi output file..."
if [ -f /tmp/subagent_ssh_result.txt ]; then
  SIZE=$(wc -c < /tmp/subagent_ssh_result.txt 2>/dev/null || echo 0)
  LINES=$(wc -l < /tmp/subagent_ssh_result.txt 2>/dev/null || echo 0)
  echo "    ✅ /tmp/subagent_ssh_result.txt ADA — $SIZE bytes, $LINES baris"
else
  echo "    ❌ /tmp/subagent_ssh_result.txt TIDAK DITEMUKAN"
  echo "       Cek fallback: $SCRIPT_DIR/subagent_ssh_result_FALLBACK.txt"
fi

echo ""
echo "Run log (backup): $RUN_LOG"
echo ""

case $PY_RC in
  0)   echo "🎉 SUKSES — Overall lulus (API + Web keduanya >=18 HTTP 200)" ;;
  4)   echo "⚠️  SELESAI — Salah satu / keduanya BELUM lulus. Cek file output!" ;;
  5)   echo "❌ sshpass tidak ada" ;;
  6)   echo "❌ python3 tidak ada" ;;
  130) echo "⚠️  DIBATALKAN user (Ctrl+C)" ;;
  99)   echo "💀 EXCEPTION — cek traceback di atas / run log" ;;
  *)    echo "Exit code $PY_RC — cek run log: $RUN_LOG" ;;
esac

echo ""
echo "=== CARA LIHAT RINGKASAN CEPAT ==="
echo "  grep -E 'STATUS_PORT4000=|API_200_COUNT=|WEB_200_COUNT=|API_STATUS=|WEB_STATUS=|OVERALL_STATUS=' /tmp/subagent_ssh_result.txt"
echo ""

exit $PY_RC
