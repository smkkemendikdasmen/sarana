import pg from "pg";
const { Client } = pg;

const DB_URL = "postgresql://saranasmk_app:saranasmkApp123!Prod@127.0.0.1:5432/saranasmk_local_latest";
const c = new Client({ connectionString: DB_URL });

await c.connect();
console.log("=== LAPORAN KELENGKAPAN DATA SEKOLAH saranasmk_local_latest ===\n");

const q = (sql, label) => c.query(sql).then(r => {
  console.log(`--- ${label} ---`);
  if (r.rows.length <= 15) {
    for (const row of r.rows) console.log(JSON.stringify(row));
  } else {
    console.log(`Row count: ${r.rows.length}. Top 15:`);
    for (let i=0;i<15;i++) console.log(JSON.stringify(r.rows[i]));
  }
  console.log("");
  return r.rows;
});

const TOTAL_SCHOOLS = (await q(`SELECT COUNT(*)::int AS total_schools FROM schools`, "1. TOTAL schools"))[0].total_schools;
await q(`SELECT COUNT(DISTINCT sp.npsn)::int AS schools_with_profile,
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT sp.npsn) / (SELECT COUNT(*) FROM schools), 1) AS pct
  FROM school_profile sp`, "2. Schools dengan school_profile");
await q(`SELECT COUNT(DISTINCT p.npsn)::int AS schools_with_proposal,
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT p.npsn) / (SELECT COUNT(*) FROM schools), 1) AS pct
  FROM workspace_school_proposal_data p`, "3. Schools dengan workspace_school_proposal_data (data-persiapan)");
await q(`SELECT COUNT(DISTINCT e.npsn)::int AS schools_with_equipment,
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT e.npsn) / (SELECT COUNT(*) FROM schools), 1) AS pct
  FROM workspace_school_equipment_data e`, "4. Schools dengan workspace_school_equipment_data (alat / data-pelatihan)");
await q(`SELECT COUNT(DISTINCT d.npsn)::int AS schools_with_documents,
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT d.npsn) / (SELECT COUNT(*) FROM schools), 1) AS pct,
  COUNT(*)::int AS total_documents_rows
  FROM school_profile_documents d`, "5. Schools dengan dokumen (school_profile_documents)");
await q(`SELECT COUNT(DISTINCT k.npsn)::int AS schools_with_concentrations,
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT k.npsn) / (SELECT COUNT(*) FROM schools), 1) AS pct,
  COUNT(*)::int AS total_konsentrasi_rows
  FROM school_profile_concentrations k`, "6. Schools dengan konsentrasi (school_profile_concentrations)");
await q(`SELECT COUNT(DISTINCT org.npsn)::int AS schools_with_orgm,
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  ROUND(100.0 * COUNT(DISTINCT org.npsn) / (SELECT COUNT(*) FROM schools), 1) AS pct,
  COUNT(*)::int AS total_orgm_rows
  FROM school_profile_organization_structures org`, "7. Schools dengan struktur organisasi");
await q(`SELECT COUNT(DISTINCT npsn)::int AS schools_with_records, (SELECT COUNT(*) FROM schools) AS total,
  COUNT(*)::int AS records_total FROM workspace_school_records`, "8. Schools dengan workspace_school_records");
await q(`SELECT COUNT(DISTINCT school_npsn)::int AS schools_with_rpd_pks, (SELECT COUNT(*) FROM schools) AS total,
  COUNT(*)::int AS rpd_pks_total FROM school_instance_rpd_pks`, "9. Schools dengan school_instance_rpd_pks (RPD/PKS)");

console.log(`\n=== CROSS CHECK 10102743 (user SEKOLAH test) di semua tabel ===`);
const NPSN = "'10102743'";
await q(`SELECT npsn, nama_sekolah FROM schools WHERE npsn=${NPSN}`, "✅ schools");
await q(`SELECT npsn, kepsek_nama FROM school_profile WHERE npsn=${NPSN}`, "✅ school_profile");
await q(`SELECT npsn, created_at FROM workspace_school_proposal_data WHERE npsn=${NPSN} LIMIT 2`, "✅ proposal_data (persiapan)");
await q(`SELECT npsn, created_at FROM workspace_school_equipment_data WHERE npsn=${NPSN} LIMIT 2`, "✅ equipment_data (alat)");
await q(`SELECT COUNT(*)::int AS dok_count FROM school_profile_documents WHERE npsn=${NPSN}`, "✅ dokumen count");
await q(`SELECT COUNT(*)::int AS kons_count FROM school_profile_concentrations WHERE npsn=${NPSN}`, "✅ konsentrasi count");
await q(`SELECT COUNT(*)::int AS org_count FROM school_profile_organization_structures WHERE npsn=${NPSN}`, "✅ struktur organisasi count");

console.log("\n=== RINGKASAN SEKOLAH YANG TIDAK PUNYA DATA (gap analysis) ===");
const gap_tests = [
  ["Tanpa school_profile", "school_profile", "npsn"],
  ["Tanpa proposal_data (data-persiapan)", "workspace_school_proposal_data", "npsn"],
  ["Tanpa equipment_data (alat)", "workspace_school_equipment_data", "npsn"],
  ["Tanpa dokumen", "school_profile_documents", "npsn"],
  ["Tanpa konsentrasi", "school_profile_concentrations", "npsn"],
  ["Tanpa organisasi", "school_profile_organization_structures", "npsn"],
];
for (const [label, tbl, col] of gap_tests) {
  const rows = (await c.query(`SELECT npsn, nama_sekolah FROM schools s WHERE NOT EXISTS (SELECT 1 FROM ${tbl} t WHERE t.${col}=s.npsn) ORDER BY npsn LIMIT 10`)).rows;
  console.log(`${label}: ${rows.length} sekolah. Top 10:`);
  if (rows.length === 0) console.log("  (SEMUA SEKOLAH PUNYA DATA ✅)");
  else for (const r of rows) console.log(`  ${r.npsn} - ${r.nama_sekolah}`);
  console.log("");
}

await c.end();
console.log("=== END OF REPORT ===");
