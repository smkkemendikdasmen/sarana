#!/bin/bash
# SSH Deploy Script - Execute remote commands and save output locally

REMOTE_HOST="103.160.202.73"
REMOTE_USER="alatprods"
REMOTE_PASS='Direktorat5mk123!@#'
OUTPUT_FILE="/Users/ilahilah/Documents/Project/PRISMA/saranasmk/subagent_ssh_result.txt"

SSH_CMD="sshpass -p '$REMOTE_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=45 $REMOTE_USER@$REMOTE_HOST"

echo "Starting remote execution at $(date)" > "$OUTPUT_FILE"
echo "==============================================" >> "$OUTPUT_FILE"

{
  echo "===PORT==="
  ss -tlnp | grep -E ':(4000|3000|4001|3001) ' || echo NONE

  echo "===PM2==="
  pm2 list 2>&1 | head -20

  echo "===DEPLOY_LOG_200==="
  tail -200 /tmp/deploy_v6.log 2>&1

  PORT4000_EXISTS=$(ss -tlnp | grep -E ':4000 ')
  PM2_API_ONLINE=$(pm2 list 2>&1 | grep -i 'api.*online')

  if [ -z "$PORT4000_EXISTS" ] || [ -z "$PM2_API_ONLINE" ]; then
    echo "===RECOVERY TRIGGERED==="
    echo "PORT4000_EXISTS: ${PORT4000_EXISTS:-NOT_FOUND}"
    echo "PM2_API_ONLINE: ${PM2_API_ONLINE:-NOT_FOUND}"

    echo "===RECOVERY STEP A: pm2 delete all==="
    pm2 delete all 2>&1 | head -5

    echo "===RECOVERY STEP B: rm node_modules==="
    rm -rf /home/alatprods/saranasmk/node_modules /home/alatprods/saranasmk/apps/api/node_modules /home/alatprods/saranasmk/apps/web/node_modules
    echo "node_modules removed"

    echo "===RECOVERY STEP C: npm ci root==="
    cd /home/alatprods/saranasmk && npm ci --omit=dev --no-audit --no-fund --prefer-offline --loglevel=error
    echo "===RECOVERY STEP C: npm ci api==="
    cd apps/api && npm ci --omit=dev --loglevel=error
    echo "===RECOVERY STEP C: npm ci web==="
    cd ../web && npm ci --omit=dev --loglevel=error
    cd ../..
    echo "npm ci completed"

    echo "===RECOVERY STEP D: pm2 start==="
    cd /home/alatprods/saranasmk && PM2_BLUE_INST=4 PM2_GREEN_START=0 pm2 start ecosystem.config.js --only api-blue,web-blue --update-env 2>&1 | tail -20

    echo "===RECOVERY STEP E: healthcheck (sleep 25)==="
    sleep 25
    echo "API /health:"
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
      curl -s -o /dev/null -w "%{http_code} " --max-time 3 http://127.0.0.1:4000/health
      sleep 0.3
    done
    echo ""
    echo "WEB:"
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
      curl -s -o /dev/null -w "%{http_code} " --max-time 3 http://127.0.0.1:3000/
      sleep 0.3
    done
    echo ""
  else
    echo "===NO RECOVERY NEEDED==="
    echo "Port 4000 listener found and PM2 API is online."
  fi
} | $SSH_CMD 'bash -s' 2>&1 >> "$OUTPUT_FILE"

SSH_EXIT=$?

echo "" >> "$OUTPUT_FILE"
echo "==============================================" >> "$OUTPUT_FILE"
echo "Finished at $(date). SSH exit code: $SSH_EXIT" >> "$OUTPUT_FILE"

echo "OUTPUT_FILE=$OUTPUT_FILE"
echo "SSH_EXIT=$SSH_EXIT"
ls -la "$OUTPUT_FILE"
