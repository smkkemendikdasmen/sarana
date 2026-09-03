#!/usr/bin/env bash
# =====================================================================
# FASE 9 — TEST 1: POSTGRESQL RLS IDOR PROOF
# PG 17 requires BEGIN/COMMIT set_config is_local=true to avoid GUC registration errors.
# Role saranasmk_app NOSUPERUSER NOBYPASSRLS + FORCE RLS enabled.
# Exit 0 PASS. Exit non-zero = IDOR BOCOR.
# =====================================================================
set -euo pipefail

SQL_FILE="/tmp/phase9_1_rls_idor.sql"
RESULT_FILE="/tmp/phase9_1_rls_result.txt"
NPSN_A="10100617"
NPSN_B="10113067"

cat > $SQL_FILE <<ENDSQL
\pset tuples_only on
\pset format unaligned
\o $RESULT_FILE
BEGIN;
SELECT set_config('app.current_npsn', '$NPSN_A', true) s1, set_config('app.current_role', 'SEKOLAH', true) s2 \g /dev/null
SELECT 'COUNT_SCOPE_SENDIRI_A=' || COUNT(*)::bigint FROM workspace_school_proposal_data WHERE npsn = '$NPSN_A';
SELECT 'COUNT_IDOR_TARGET_B=' || COUNT(*)::bigint FROM workspace_school_proposal_data WHERE npsn = '$NPSN_B';
COMMIT;

BEGIN;
SELECT set_config('app.current_npsn', '', true) s1, set_config('app.current_role', 'ADMIN', true) s2 \g /dev/null
SELECT 'COUNT_ADMIN_GLOBAL=' || COUNT(*)::bigint FROM workspace_school_proposal_data;
COMMIT;

BEGIN;
SELECT set_config('app.current_npsn', '', true) s1, set_config('app.current_role', 'FASILITATOR_ADMINISTRASI', true) s2, set_config('app.current_user_id', '__phase9_test_fasil__', true) s3 \g /dev/null
SELECT 'COUNT_FASIL_NOASSIGN_B=' || COUNT(*)::bigint FROM workspace_school_proposal_data WHERE npsn = '$NPSN_B';
COMMIT;
\o
ENDSQL

PGPASSWORD='saranasmkApp123!Prod' psql -h 127.0.0.1 -p 5432 -U saranasmk_app -d saranasmk -f "$SQL_FILE" > /dev/null 2>&1

rm -f "$RESULT_FILE.tmp" 2>/dev/null || true
PGPASSWORD='saranasmkApp123!Prod' psql -h 127.0.0.1 -p 5432 -U saranasmk_app -d saranasmk -At -f "$SQL_FILE" > "$RESULT_FILE" 2>&1

echo "=== RESULTS FROM $RESULT_FILE ==="
cat "$RESULT_FILE"
echo ""

COUNT_A=$(grep 'COUNT_SCOPE_SENDIRI_A=' "$RESULT_FILE" | head -1 | sed 's/.*COUNT_SCOPE_SENDIRI_A=//')
COUNT_IDOR=$(grep 'COUNT_IDOR_TARGET_B=' "$RESULT_FILE" | head -1 | sed 's/.*COUNT_IDOR_TARGET_B=//')
COUNT_ADMIN=$(grep 'COUNT_ADMIN_GLOBAL=' "$RESULT_FILE" | head -1 | sed 's/.*COUNT_ADMIN_GLOBAL=//')
COUNT_FASIL=$(grep 'COUNT_FASIL_NOASSIGN_B=' "$RESULT_FILE" | head -1 | sed 's/.*COUNT_FASIL_NOASSIGN_B=//')

echo "--- ASSERTIONS ---"
echo "T1a scope sendiri A: COUNT=$COUNT_A (expect >=1)"
[ "$COUNT_A" -ge 1 ] || { echo "FAIL T1a scope sendiri = 0 (RLS overblock / broken)"; exit 3; }

echo "T1b IDOR target B: COUNT=$COUNT_IDOR (expect 0)"
[ "$COUNT_IDOR" -eq 0 ] || { echo "🔥 FAIL T1b IDOR LEAK: $COUNT_IDOR rows cross sekolah TIDAK DIBLOKIR RLS!"; exit 2; }
echo "✅ T1b IDOR BLOCK 100% (0 rows cross scope)"

echo "T1c ADMIN global: COUNT=$COUNT_ADMIN (expect >=100)"
[ "$COUNT_ADMIN" -ge 100 ] || { echo "FAIL T1c ADMIN tidak bisa akses semua (role bypass RLS broken)"; exit 4; }

echo "T1d FASIL tanpa assignment B: COUNT=$COUNT_FASIL (expect 0)"
[ "$COUNT_FASIL" -eq 0 ] || { echo "FAIL T1d FASIL TANPA assignment bisa akses sekolah B"; exit 5; }

echo ""
echo "✅ FASE 9 TEST 1 RLS IDOR PROOF — EXIT 0 PASS"
exit 0
