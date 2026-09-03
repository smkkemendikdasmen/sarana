#!/bin/bash
cd /Users/ilahilah/Documents/Project/PRISMA/saranasmk
RUN_LOG="/tmp/_runner_v6_$(date +%Y%m%d_%H%M%S).log"
echo "[$(date)] ====== START RUNNER v6 ======" > "$RUN_LOG"
echo "[$(date)] PWD=$(pwd)" >> "$RUN_LOG"
echo "[$(date)] which python3=$(which python3)" >> "$RUN_LOG"
python3 --version >> "$RUN_LOG" 2>&1
echo "" >> "$RUN_LOG"
echo "[$(date)] Running _run_ssh_recovery_v6.py..." >> "$RUN_LOG"
echo "" >> "$RUN_LOG"
python3 /Users/ilahilah/Documents/Project/PRISMA/saranasmk/_run_ssh_recovery_v6.py >> "$RUN_LOG" 2>&1
PY_RC=$?
echo "" >> "$RUN_LOG"
echo "[$(date)] python exit code = $PY_RC" >> "$RUN_LOG"
echo "" >> "$RUN_LOG"
echo "[$(date)] ls /tmp/subagent_ssh_result.txt :" >> "$RUN_LOG"
ls -la /tmp/subagent_ssh_result.txt >> "$RUN_LOG" 2>&1
echo "" >> "$RUN_LOG"
echo "[$(date)] ====== RUNNER DONE ======" >> "$RUN_LOG"
echo "RUN_LOG=$RUN_LOG"
echo "PY_EXIT=$PY_RC"
exit $PY_RC
