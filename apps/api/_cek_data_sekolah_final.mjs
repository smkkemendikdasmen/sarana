import pg from "pg";
const { Client } = pg;

const DB_URL = "postgresql://saranasmk_app:saranasmkApp123!Prod@127.0.0.1:5432/saranasmk_local_latest";
const c = new Client({ connectionString: DB_URL });
await c.connect();
console.log("=== LAPORAN KELENGKAPAN DATA SEKOLAH saranasmk_local_latest ===\n");

const q = (sql, label) => c.query(sql).then(r => {
  console.log(`--- ${label} ---`);
  if (r.rows.length <= 20) {
    for (const row of r.rows) console.log(JSON.stringify(row));
  } else {
    console.log(`Row count: ${r.rows.length}. Top 20:`);
    for (let i=0;i<20;i++) console.log(JSON.stringify(r.rows[i]));
  }
  console.log("");
  return r.rows;
});

const TOTAL = (await q(`SELECT COUNT(*)::int AS total_schools FROM schools`, "1. TOTAL schools"))[0].total_schools;
await q(`SELECT COUNT(DISTINCT p.npsn)::int AS schools_with_proposal,
  ${TOTAL} AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT p.npsn) / ${TOTAL}, 1) AS pct,
  COUNT(*)::int AS rows_total
  FROM workspace_school_proposal_data p`, "2. Schools dengan workspace_school_proposal_data (data-persiapan / pengajuan)");
await q(`SELECT COUNT(DISTINCT e.npsn)::int AS schools_with_equipment,
  ${TOTAL} AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT e.npsn) / ${TOTAL}, 1) AS pct,
  COUNT(*)::int AS rows_total
  FROM workspace_school_equipment_data e`, "3. Schools dengan workspace_school_equipment_data (alat / data-pelatihan)");
await q(`SELECT COUNT(DISTINCT d.npsn)::int AS schools_with_dokumen,
  ${TOTAL} AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT d.npsn) / ${TOTAL}, 1) AS pct,
  COUNT(*)::int AS total_dokumen_rows
  FROM school_profile_administrative_documents d`, "4. Schools dengan dokumen (school_profile_administrative_documents)");
await q(`SELECT COUNT(DISTINCT k.npsn)::int AS schools_with_konsentrasi,
  ${TOTAL} AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT k.npsn) / ${TOTAL}, 1) AS pct,
  COUNT(*)::int AS total_konsentrasi_rows
  FROM school_profile_concentrations k`, "5. Schools dengan konsentrasi (school_profile_concentrations)");
await q(`SELECT COUNT(DISTINCT o.npsn)::int AS schools_with_orgm,
  ${TOTAL} AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT o.npsn) / ${TOTAL}, 1) AS pct,
  COUNT(*)::int AS total_orgm_rows
  FROM school_profile_organization_members o`, "6. Schools dengan struktur organisasi (org members)");
await q(`SELECT COUNT(DISTINCT npsn)::int AS schools_with_records, ${TOTAL} AS total,
  COUNT(*)::int AS records_total FROM workspace_school_records`, "7. Schools dengan workspace_school_records");
await q(`SELECT COUNT(DISTINCT school_npsn)::int AS schools_with_rpd_pks, ${TOTAL} AS total,
  COUNT(*)::int AS rpd_pks_total FROM school_instance_rpd_pks`, "8. Schools dengan school_instance_rpd_pks (RPD/PKS)");

console.log(`\n=== CROSS CHECK NPSN 10102743 (USER TEST SEKOLAH) ===`);
const NPSN = "'10102743'";
await q(`SELECT npsn, nama_sekolah, status_negri_swasta, alamat, kecamatan FROM schools WHERE npsn=${NPSN}`, "✅ schools (profil utama)");
await q(`SELECT COUNT(*)::int AS proposal_rows, MIN(created_at) AS first_update, MAX(updated_at) AS last_update FROM workspace_school_proposal_data WHERE npsn=${NPSN}`, "✅ proposal_data (data-persiapan) count");
await q(`SELECT COUNT(*)::int AS equipment_rows, MIN(created_at) AS first_update, MAX(updated_at) AS last_update FROM workspace_school_equipment_data WHERE npsn=${NPSN}`, "✅ equipment_data (alat) count");
await q(`SELECT COUNT(*)::int AS dok_count FROM school_profile_administrative_documents WHERE npsn=${NPSN}`, "✅ dokumen count");
await q(`SELECT COUNT(*)::int AS kons_count FROM school_profile_concentrations WHERE npsn=${NPSN}`, "✅ konsentrasi count");
await q(`SELECT COUNT(*)::int AS org_count FROM school_profile_organization_members WHERE npsn=${NPSN}`, "✅ organisasi count");

console.log("\n=== GAP ANALISIS: SEKOLAH YANG TIDAK PUNYA DATA ===\n");
const gap = [
  ["Tidak punya proposal_data (pengajuan / data-persiapan)", "workspace_school_proposal_data", "npsn"],
  ["Tidak punya equipment_data (alat / data-pelatihan)", "workspace_school_equipment_data", "npsn"],
  ["Tidak punya dokumen administratif", "school_profile_administrative_documents", "npsn"],
  ["Tidak punya konsentrasi", "school_profile_concentrations", "npsn"],
  ["Tidak punya struktur organisasi", "school_profile_organization_members", "npsn"],
  ["Tidak punya records (workspace)", "workspace_school_records", "npsn"],
];
for (const [label, tbl, col] of gap) {
  const rows = (await c.query(`SELECT npsn, nama_sekolah FROM schools s WHERE NOT EXISTS (SELECT 1 FROM ${tbl} t WHERE t.${col}=s.npsn) ORDER BY npsn LIMIT 30`)).rows;
  console.log(`${label}: ${rows.length} dari ${TOTAL} sekolah`);
  if (rows.length === 0) console.log("  ✅ SEMUA PUNYA DATA");
  else {
    console.log(`  List (top 30):`);
    for (const r of rows) console.log(`    [${r.npsn}] ${r.nama_sekolah}`);
  }
  console.log("");
}

await c.end();
console.log("=== END LAPORAN ===");
