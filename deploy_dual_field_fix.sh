#!/usr/bin/env bash
# ===========================================================================
#  DEPLOY TERCEPAT KE PRODUKSI (10 detik + audit post-deploy)
#  Target: Terapkan DTO dual-field fix (email | username) ke server produksi
#          sehingga login via field EMAIL di produksi juga BERHASIL (HTTP 201)
#
#  EKSEKUSI: Copy seluruh blok di bawah ini, PASTE ke terminal LOKAL Anda
#            (bukan terminal agent), lalu tekan ENTER.
#
#  SERVER  : 103.160.202.73 | user=alatprods
# ===========================================================================
set -euo pipefail

echo "[DEPLOY] Langkah 1/3 — Backup DB PostgreSQL produksi sebelum deploy..."
# (Backup dijalankan DI SERVER via SSH - Enterprise SOP Backup-before-change)
ssh alatprods@103.160.202.73 'PGPASSWORD="saranasmkApp123!Prod" pg_dump -h 127.0.0.1 -U saranasmk_app -d saranasmk_production -Fc -Z 9 -f /tmp/saranasmk_production_predeploy_$(date +%Y%m%d_%H%M%S).sqlc && echo "OK backup berhasil ls /tmp/saranasmk_production_predeploy_*"'

echo
echo "[DEPLOY] Langkah 2/3 — Reload process api-blue (source code sudah terintegrasi jika git pull dilakukan)"
# OPSI-A: Jika server menggunakan GIT untuk source (recommended — jika ada repo di server):
ssh alatprods@103.160.202.73 'cd /home/alatprods/saranasmk 2>/dev/null && git status --short | head -5 && git pull --ff-only 2>&1 | tail -3 ; pm2 reload api-blue 2>&1 ; pm2 save ; pm2 list | grep -E "api-blue|web-blue" | head -10'

echo
echo "[DEPLOY] Langkah 3/3 — Audit post-deploy: health + login via EMAIL field (harus BERHASIL HTTP 201)"
sleep 3
curl -sk -o /tmp/_h.json -w "HEALTH  : HTTP %{http_code} bytes=%{size_download}\n" https://saranasmk.id/api/health
curl -sk -X POST https://saranasmk.id/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@saranasmk.id","password":"admin123"}' \
  -o /tmp/_l.json -w "LOGIN-E : HTTP %{http_code} bytes=%{size_download}\n"
python3 -c "
import json
h=json.load(open('/tmp/_h.json'))
print(f'HEALTH  : status={h.get(\"status\")} slot={h.get(\"slot\")} uptimeMs={h.get(\"uptimeMs\")}')
try:
  d=json.load(open('/tmp/_l.json'))
  if d.get('ok'):
    tok=d.get('data',{}).get('token','')
    print(f'LOGIN-E : OK (DUAL FIELD FIX TERDEPLOY!) | tokenLen={len(tok)}')
  else:
    print(f'LOGIN-E : GAGAL | {d.get(\"error\",{}).get(\"message\",\"unknown error\")}')
    print('         → Jalankan build:api secara EKSKLUSIF (lihat catatan OPSI-B di README deploy)')
except Exception as e:
  print(f'LOGIN-E parse fail: {e}')
"
echo
echo "[DEPLOY] SELESAI. Lihat output di atas."
