#!/usr/bin/env python3
"""
AUDIT SKEMA DB LOKAL POSTGRESQL: schools, concentrations, org_members, admin_docs
Temukan mismatch kolom antara SCHEMA TABLE ASLI vs QUERY di SchoolProfileService.
"""
import subprocess, os, tempfile, sys, json

API_ENV = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/.env"
creds={}
with open(API_ENV) as f:
  for ln in f:
    ln=ln.strip()
    if not ln or ln.startswith('#') or '=' not in ln: continue
    k,v = ln.split('=',1); k=k.strip(); v=v.strip().strip('"').strip("'")
    if k in ("DATABASE_URL","DB_HOST","DB_PORT","DB_NAME","DB_USER","DB_PASS"): creds[k]=v

u=creds["DATABASE_URL"].split("://")[1].split("@")
user_pass=u[0].split(":")
hp=u[1].split("/")
host_port=hp[0].split(":")
os.environ.update({
  "PGHOST": host_port[0],
  "PGPORT": host_port[1] if len(host_port)>1 else "5432",
  "PGDATABASE": hp[1].split("?")[0],
  "PGUSER": user_pass[0],
  "PGPASSWORD": user_pass[1],
  "PGOPTIONS": "--client-min-messages=warning",
})
print("="*80)
print("AUDIT SKEMA DB LOKAL")
print(f"DB: {os.environ['PGUSER']}@{os.environ['PGHOST']}:{os.environ['PGPORT']}/{os.environ['PGDATABASE']}")
print("="*80)

def psql(sql, one=False):
  with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8') as tf:
    tf.write(sql); tmpsql=tf.name
  try:
    r = subprocess.run(['psql','-X','-F\x01','-At','-f',tmpsql], capture_output=True, text=True)
    out = r.stdout.strip()
    if r.returncode != 0:
      return None, r.stderr.strip()
    lines = [ln for ln in out.splitlines() if ln.strip()]
    if one:
      return (lines[0].split('\x01') if lines else []), None
    return [ln.split('\x01') for ln in lines], None
  finally:
    os.unlink(tmpsql)

# 1. schools
rows, err = psql(r"""
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('schools','users','school_profile_concentrations','school_profile_organization_members','school_profile_administrative_documents','workspace_school_assignments','school_proposals','school_equipment','perdirjen_equipment_concentration')
 ORDER BY table_name;
""")
print("\n[TABEL TERSEDIA]")
for r in rows or []: print("  ·", r[0])

for tbl in ['schools','school_profile_concentrations','school_profile_organization_members','school_profile_administrative_documents']:
  rows, err = psql(f"""
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_name='{tbl}'
ORDER BY ordinal_position;
""")
  print(f"\n[KOLOM {tbl.upper()}]")
  pk_cols, _ = psql(f"""
SELECT kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.table_name='{tbl}' AND tc.constraint_type='PRIMARY KEY'
ORDER BY kcu.ordinal_position;
""")
  fk_cols, _ = psql(f"""
SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name='{tbl}' AND tc.constraint_type='FOREIGN KEY';
""")
  for c in rows or []: print(f"    {c[0]:<32} {c[1]:<18} {'len='+str(c[2]) if c[2] else '':<8} NULL={c[3]:<3} DEFAULT={c[4] or ''}")
  if pk_cols: print(f"    PRIMARY KEY: {', '.join(x[0] for x in pk_cols)}")
  if fk_cols:
    for f in fk_cols: print(f"    FOREIGN KEY {f[0]} → {f[1]}.{f[2]}")
  nrows,_ = psql(f"SELECT COUNT(1) FROM {tbl};")
  print(f"    ROWS: {nrows[0][0] if nrows else '?'}")

# 2. Audit: apakah concentrations table PUNYA kolom npsn?
print()
print("="*80)
print("ANALISA KRITIS: Service SchoolProfile menggunakan WHERE npsn=? & INSERT npsn=?")
print("  pada ketiga tabel profile. APAKAH KOLOM npsn ADA di ketiga table?")
print("="*80)
for tbl in ['school_profile_concentrations','school_profile_organization_members','school_profile_administrative_documents']:
  col,_ = psql(f"SELECT column_name FROM information_schema.columns WHERE table_name='{tbl}' AND (column_name='npsn' OR column_name='school_id');")
  print(f"  {tbl}: punya kolom -> {', '.join(x[0] for x in col) if col else '(TIDAK ADA)'}")

# 3. Cek hubungan users.role SEKOLAH untuk login uji
print()
rows,_ = psql(r"""
SELECT id, username, email, role, npsn, is_active, full_name
FROM users
WHERE lower(role)='SEKOLAH' OR username LIKE '%sekolah%' OR email LIKE '%sekolah%'
ORDER BY created_at ASC LIMIT 5;
""")
print("\n[USER ROLE=SEKOLAH (untuk test persistence login)]")
for r in rows or []: print(f"  id={r[0]} usr={r[1]} eml={r[2]} role={r[3]} npsn={r[4]} act={r[5]} name={r[6]}")
print("(Jika KOSONG = belum ada user SEKOLAH. Perlu dibuat / reset password user SEKOLAH untuk E2E.)")
