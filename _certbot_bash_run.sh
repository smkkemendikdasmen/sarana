#!/bin/bash
cd /Users/ilahilah/Documents/Project/PRISMA/saranasmk
TS=$(date +%Y%m%d_%H%M%S)
LOG="/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_certbot_bash_run_${TS}.log"
{
  echo "=== BASH RUNNER START $(date) ==="
  echo "PWD=$(pwd)"
  echo "which python3=$(which python3)"
  python3 --version
  echo ""
  echo "=== RUNNING PYTHON SCRIPT ==="
} > "$LOG" 2>&1

python3 /Users/ilahilah/Documents/Project/PRISMA/saranasmk/_certbot_run_final.py >> "$LOG" 2>&1
PY_RC=$?

{
  echo ""
  echo "=== PYTHON EXIT CODE = $PY_RC ==="
  echo "=== BASH RUNNER END $(date) ==="
} >> "$LOG" 2>&1

echo "LOG_FILE=$LOG"
echo "PY_EXIT=$PY_RC"
exit $PY_RC
