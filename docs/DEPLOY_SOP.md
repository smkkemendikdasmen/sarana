# 🚀 DEPLOY STANDARD OPERATIONAL PROCEDURE (SOP) v5
**Versi**: v5.0 — Hotfix 4 PM2 Graceful Reload  
**Tanggal Berlaku**: 31 Agustus 2026  
**Target Server**: `103.160.202.73:22` · user: `alatprods`  
**Waktu Maintenance Window**: 🟢 Senin-Jumat 08.00-10.00 WIB / 14.00-16.00 WIB (Hindari Jam Kerja Sekolah 07.00-15.00 WIB)

---

## ⚠️ PRE-REQUISITE SEBELUM SETIAP DEPLOY
✅ Login user `alatprods` di server production (103.160.202.73) ✅  
✅ Pastikan SSH key terdaftar atau password benar  
✅ Pastikan `mysql` + `mysqldump` tersedia di PATH server  
✅ Pastikan folder `/home/alatprods/backups` tersedia (chmod 700 alatprods:alatprods)  
✅ JALANKAN DARI folder `~/saranasmk` di server (bukan di lokal!)  
✅ Ada backup manual terakhir (bila deploy > 1 minggu dari backup penuh)

---

## 🔴 ROLLOUT FLOW — 4 STEP WAJIB
```
  STEP 1 → STEP 2 → STEP 3 → STEP 4
  (PRE)   (BUILD) (RELOAD)  (POST)
```

---

### 🟡 STEP 1 — PREDEPLOY (MANDATORY, TIDAK BOLEH DI-SKIP!)
```bash
cd ~/saranasmk
# Pastikan script executable (first time saja)
chmod +x scripts/predeploy_backup_and_lock.sh scripts/deploy_v5_pm2_graceful.sh scripts/deploy_safety_check_v2.sh

bash scripts/predeploy_backup_and_lock.sh
```
**Output Expectation**:
- ✅ `mysqldump` → file `/home/alatprods/backups/predeploy_saranasmk_YYYYMMDD_HHMMSS.sql.gz`
- ✅ SHA256 checksum → `[same_path].sha256`
- ✅ Signature table → `[same_path]_signature.txt`
- ✅ LOCK FILE → `/tmp/saranasmk_deploy_locks/predeploy_done.LOCK`
- ✅ Exit code `0`

**BILA KELUAR EXIT CODE >0 → HENTIKAN DEPLOY! Jangan dilanjut. Perbaiki error backup terlebih dahulu.**

---

### 🟡 STEP 2 — DEPLOY (Build + Graceful Reload)
```bash
cd ~/saranasmk
bash scripts/deploy_v5_pm2_graceful.sh
```
**Flow Otomatis didalam script**:
1. ✅ **VERIFY LOCK** (predeploy lock ada & age <3600s) → GAGAL exit code 3 bila tidak ada lock
2. ✅ `npm ci --no-audit --no-fund` (install deps fresh dari lockfile)
3. ✅ `npx nx build api --configuration=production` → gagal deploy batal (EXIT 20)
4. ✅ `npx nx build web --configuration=production` → gagal deploy batal (EXIT 21)
5. ✅ `pm2 reload saranasmk-api --update-env --wait 8000` (GRACEFUL DRAIN in-flight request)
6. ✅ `pm2 reload saranasmk-web --update-env --wait 8000`
7. ✅ Healthcheck curl 127.0.0.1:4000 / 3000 (max 90s tunggu listen port)

---

### 🟡 STEP 3 — POST AUDIT (WAJIB JALANKAN!)
```bash
cd ~/saranasmk
bash scripts/deploy_safety_check_v2.sh POST
```
**Output Expectation**:
- ✅ Diff PRE vs POST rowcount / bytes JSON → **DEVIATION ≤ 3 field**
- ✅ `pm2 status` → api + web status `online`, restart count < 5
- ✅ Guard `preservePayloadObject` ditemukan di dist (`occurance di dist >0`)
- ✅ HTTP healthcheck api=2xx web=2xx
- ✅ 10 history snapshot TERAKHIR ADA (buktikan K11 berjalan)

**🔴 BILA DEVIATION > 3 field → LANGSUNG ROLLBACK!** (lihat step 5 dibawah)

---

### 🟡 STEP 4 — (OPSIONAL) Smoke Test User Manual
1. Buka 2 browser: Chrome normal + Incognito
2. Login 2 user sekolah berbeda
3. Save edit 1 baris di halaman `/sekolah/alat`
4. Cek tab sebelah (user sama) otomatis lihat perubahan dalam ≤ 2 detik
5. Check Network tab: save request **menggunakan PATCH /delta** bila cuma 1 row (tidak PUT full 30MB)
6. Lihat size payload Network → HARUS KECIL (< 50KB bila cuma 1 row)

---

## 🔴 ROLLBACK STEP BY STEP (BILA DEPLOY GAGAL / DEVIATION BESAR)
### Rollback cepat tanpa restore DB (cuma code):
```bash
cd ~/saranasmk

# 1. Balik ke PM2 reload lama (bila instance BIRU masih ada / baru reload cuma 1x)
pm2 reload saranasmk-api saranasmk-web --update-env --wait 8000

# 2. Bila rollback code perlu (git):
git log --oneline -n 10   # cari last commit stabil
git checkout <STABLE_COMMIT_SHA>
npm ci --no-audit --no-fund
npx nx build api --configuration=production
npx nx build web --configuration=production
pm2 reload ecosystem.config.js --update-env --wait

# 3. POST audit ulang
bash scripts/deploy_safety_check_v2.sh POST
```

### Rollback DB + code (Data Integrity DEVIATION PARAH):
```bash
# A. Restore SQL dari backup predeploy
BACKUP_FILE=$(ls -t /home/alatprods/backups/predeploy_saranasmk_*.sql.gz | head -1)
echo "Restore file: $BACKUP_FILE"
# VERIFY checksum dulu
cat "${BACKUP_FILE}.sha256"
(cd /home/alatprods/backups && sha256sum -c "$(basename ${BACKUP_FILE}).sha256")
# Restore
zcat "$BACKUP_FILE" | mysql -usaranasmk -p saranasmk  # password di deploy_safety_check line 9

# B. Rollback code seperti step di atas

# C. POST audit
bash scripts/deploy_safety_check_v2.sh POST
```

---

## 🗓️ 3-2-1 BACKUP STRATEGY (TARGET FASE 2)
| Jumlah Copy | Media | Lokasi | Frekuensi | Retensi |
|---|---|---|---|---|
| Copy 1 (PRIMARY) | HDD Server | `/var/lib/mysql` production DB | Real-time | - |
| Copy 2 (LOCAL) | HDD Server | `/home/alatprods/backups/predeploy_*.sql.gz` | Tiap deploy + 1x/hari cron | 30 hari |
| Copy 3 (OFFSITE) | S3-Compatible / Storj / Backblaze B2 | Cloud | 1x/malam cron via rclone | 90 hari |
| Media Independent | HDD + Cloud | 2 jenis berbeda | - | - |

Tambahkan cron backup harian (root user server):
```bash
# crontab -e
# Backup harian jam 02:15 WIB
15 2 * * * /home/alatprods/saranasmk/scripts/predeploy_backup_and_lock.sh > /var/log/saranasmk_backup_daily.log 2>&1
```

---

## 🚫 DILARANG KERAS DI PRODUKSI
❌ **JANGAN** pakai `pm2 stop saranasmk-api && pm2 start` — potong mid-write PUT 30MB! (fix K18 gunakan `pm2 reload --wait`)  
❌ **JANGAN** skip step PREDEPLOY backup (lock file ada mekanisme BLOCK)  
❌ **JANGAN** edit langsung file `.js` di `/dist/` tanpa rebuild → PM2 reload next akan overwrite  
❌ **JANGAN** deploy di jam 11.00-13.00 WIB (jam sibuk sekolah save data)  
❌ **JANGAN** hapus folder `/home/alatprods/backups` tanpa approval PIC  
❌ **JANGAN** ganti `CACHE_V5_SEP = "::"` menjadi "|" → stale cache permanen!  
❌ **JANGAN** hapus guard `preservePayloadObject` dan `hasOwnProperty(payload,'concentrations')`

---

## 📋 TROUBLESHOOTING UMUM
| Masalah | Solusi |
|---|---|
| Exit code 3 deploy_v5 = lock file tidak ada | Jalankan `predeploy_backup_and_lock.sh` duluan |
| Exit code 20/21 = build gagal | `tail -50 .deploy_logs/deploy_v5_*.log` → cek error TypeScript di build |
| curl healthcheck timeout lama (>90s) | `pm2 logs saranasmk-api --lines 100 --nostream | grep -iE error|exception` |
| Deviation >3 POST audit | Lihat `diff summary` — cek apakah ada row sekolah yang HILANG (bukan bertambah). Jika berkurang → ROLLBACK DB. |
| PM2 stuck restart loop (>20x) | `pm2 reset saranasmk-api` → lihat log → pastikan deps sudah `npm ci` fresh |
| Redis tidak connect / REDIS_URL salah | Tidak masalah — SharedCacheAdapter **auto fallback** ke MemoryMap. Tidak crash app. |

---

## 📎 REFERENSI
- [ARCHITECTURE_BLUEPRINT_v5.md](./ARCHITECTURE_BLUEPRINT_v5.md) Section 8 DEPLOY PIPELINE SPEC
- [CHANGELOG_HOTFIXES_20260831.md](./CHANGELOG_HOTFIXES_20260831.md) Detail perubahan setiap hotfix rollout
