const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CSV_PATH = path.join(__dirname, '..', 'docs', 'resouce', 'Data Pagu - Sheet1.csv');
const SQL_OUT_PATH = path.join(__dirname, '..', 'docs', 'resouce', 'IMPORT_PAGU_SAFE.sql');
const REPORT_OUT_PATH = path.join(__dirname, '..', 'docs', 'resouce', 'LAPORAN_PAGU_IMPORT.json');

const TAHUN_AJARAN = '2026/2027';
const SET_BY_ADMIN_ID = 'msmde0xz9af4d1b6fc5a3e955c';
const SET_BY_ADMIN_NAME = 'Admin Operasional SARANA SMK';

function parseCurrency(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[",\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n').filter(Boolean);

  if (lines.length < 2) throw new Error('CSV kosong atau header saja');

  const header = parseCsvLine(lines[0]);
  console.log('HEADER:', header);

  const idx = {
    npsn: header.findIndex(h => h.trim() === 'NPSN'),
    nama: header.findIndex(h => h.trim() === 'Nama Sekolah'),
    persiapan: header.findIndex(h => h.trim() === 'Pagu Persiapan'),
    alat: header.findIndex(h => h.trim() === 'Pagu Alat'),
    pelatihan: header.findIndex(h => h.trim() === 'Pagu Pelatihan'),
    final: header.findIndex(h => h.trim() === 'Pagu Final'),
  };
  Object.values(idx).forEach(v => { if (v < 0) throw new Error('Kolom CSV tidak lengkap: ' + JSON.stringify(idx)); });

  const parsed = [];
  const npsnSet = new Set();
  let dupeCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const npsn = (cols[idx.npsn] || '').trim();
    if (!npsn || npsn.length < 3) continue;

    if (npsnSet.has(npsn)) { dupeCount++; console.log(`DUPLICATE NPSN row ${i+1}: ${npsn}`); continue; }
    npsnSet.add(npsn);

    const persiapan = parseCurrency(cols[idx.persiapan]);
    const alat = parseCurrency(cols[idx.alat]);
    const pelatihan = parseCurrency(cols[idx.pelatihan]);
    const finalCsv = parseCurrency(cols[idx.final]);
    const computedTotal = persiapan + alat + pelatihan;
    const mismatch = (finalCsv > 0 && finalCsv !== computedTotal);
    if (mismatch) {
      console.log(`WARNING total mismatch NPSN ${npsn}: CSV Final=${finalCsv} Computed=${computedTotal} (pakai computed)`);
    }
    parsed.push({
      npsn,
      namaSekolah: (cols[idx.nama] || '').trim(),
      persiapan, alat, pelatihan,
      paguTotal: computedTotal,
      csvFinal: finalCsv,
      mismatchTotal: mismatch,
    });
  }

  console.log(`\nPARSED CSV: ${parsed.length} baris (dupe NPSN di-skip=${dupeCount})`);

  // === VALIDASI NPSN EXIST DI TABEL schools ===
  const client = new Client({
    host: '127.0.0.1', port: 5432, user: 'saranasmk_app',
    password: 'saranasmkApp123!Prod', database: 'saranasmk_local_latest',
  });
  await client.connect();

  const npsnCsvList = parsed.map(p => p.npsn);
  const qExist = `SELECT npsn, name FROM schools WHERE npsn = ANY($1::text[])`;
  const resExist = await client.query(qExist, [npsnCsvList]);
  const existMap = new Map(resExist.rows.map(r => [r.npsn.trim(), r.name]));

  const matched = [];
  const unmatched = [];
  parsed.forEach(p => {
    if (existMap.has(p.npsn)) matched.push({ ...p, dbNama: existMap.get(p.npsn) });
    else unmatched.push(p);
  });
  console.log(`VALIDASI NPSN schools: MATCHED=${matched.length} | TIDAK DITEMUKAN=${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('LIST NPSN TIDAK ADA DI schools:', unmatched.map(u => `${u.npsn} (${u.namaSekolah})`).join(', '));
  }

  // === VALIDASI: school_pagu_budgets SUDAH ADA BERAPA BARIS dari NPSN CSV INI? ===
  const qPaguExist = `SELECT npsn FROM school_pagu_budgets WHERE tahun_ajaran = $1 AND npsn = ANY($2::text[])`;
  const resPagu = await client.query(qPaguExist, [TAHUN_AJARAN, npsnCsvList]);
  const paguExistSet = new Set(resPagu.rows.map(r => r.npsn.trim()));

  let updateCount = 0;
  let insertCount = 0;
  const sqlLines = [];
  sqlLines.push(`-- ============================================================`);
  sqlLines.push(`-- SAFE IMPORT PAGU ANGGARAN ${TAHUN_AJARAN} — GENERATED ${new Date().toISOString()}`);
  sqlLines.push(`-- SOURCE: docs/resouce/Data Pagu - Sheet1.csv`);
  sqlLines.push(`-- TOTAL INPUT CSV: ${parsed.length} NPSN`);
  sqlLines.push(`-- MATCH schools: ${matched.length} | UNMATCH schools: ${unmatched.length}`);
  sqlLines.push(`-- ROW EXIST di school_pagu_budgets: ${paguExistSet.size} | NEW INSERT: ${matched.length - paguExistSet.size}`);
  sqlLines.push(`-- ============================================================`);
  sqlLines.push(`BEGIN;`);
  sqlLines.push(``);

  matched.forEach(p => {
    const npsnPad = String(p.npsn).padEnd(8, ' ').slice(0, 8);
    if (paguExistSet.has(p.npsn)) {
      updateCount++;
      sqlLines.push(`-- UPDATE NPSN ${p.npsn} — ${p.dbNama || p.namaSekolah}`);
      sqlLines.push(`UPDATE school_pagu_budgets SET`);
      sqlLines.push(`  pagu_persiapan = ${p.persiapan},`);
      sqlLines.push(`  pagu_alat      = ${p.alat},`);
      sqlLines.push(`  pagu_pelatihan = ${p.pelatihan},`);
      sqlLines.push(`  pagu_total     = ${p.paguTotal},`);
      sqlLines.push(`  set_by_admin_id   = CASE WHEN set_by_admin_id IS NULL OR set_by_admin_id = '' THEN '${SET_BY_ADMIN_ID}' ELSE set_by_admin_id END,`);
      sqlLines.push(`  set_by_admin_name = CASE WHEN set_by_admin_name IS NULL OR set_by_admin_name = '' THEN '${SET_BY_ADMIN_NAME.replace(/'/g, "''")}' ELSE set_by_admin_name END,`);
      sqlLines.push(`  set_at         = CASE WHEN set_at IS NULL THEN NOW() ELSE set_at END,`);
      sqlLines.push(`  status         = CASE WHEN status = 'DRAFT' THEN 'DITETAPKAN' WHEN status = 'DITETAPKAN' THEN 'DIPERPBAHARUI' ELSE status END,`);
      sqlLines.push(`  updated_at     = NOW()`);
      sqlLines.push(`  WHERE npsn = '${npsnPad}' AND tahun_ajaran = '${TAHUN_AJARAN}';`);
    } else {
      insertCount++;
      sqlLines.push(`-- INSERT NPSN ${p.npsn} — ${p.dbNama || p.namaSekolah}`);
      sqlLines.push(`INSERT INTO school_pagu_budgets (npsn, tahun_ajaran, pagu_persiapan, pagu_alat, pagu_pelatihan, pagu_total, status, set_by_admin_id, set_by_admin_name, set_at, updated_at) VALUES (`);
      sqlLines.push(`  '${npsnPad}', '${TAHUN_AJARAN}', ${p.persiapan}, ${p.alat}, ${p.pelatihan}, ${p.paguTotal},`);
      sqlLines.push(`  'DITETAPKAN', '${SET_BY_ADMIN_ID}', '${SET_BY_ADMIN_NAME.replace(/'/g, "''")}', NOW(), NOW()`);
      sqlLines.push(`);`);
    }
    sqlLines.push(``);
  });

  sqlLines.push(`COMMIT;`);
  sqlLines.push(``);
  sqlLines.push(`-- ============================================================`);
  sqlLines.push(`-- SUMMARY IMPORT: UPDATE ${updateCount} + INSERT ${insertCount} = TOTAL ${updateCount + insertCount}`);
  sqlLines.push(`-- ============================================================`);

  fs.writeFileSync(SQL_OUT_PATH, sqlLines.join('\n'), 'utf8');
  console.log(`\n✅ SQL di-generate di ${SQL_OUT_PATH} — ${sqlLines.length} baris`);
  console.log(`   UPDATE: ${updateCount} | INSERT: ${insertCount} | TOTAL: ${updateCount + insertCount}`);

  const report = {
    generatedAt: new Date().toISOString(),
    sourceCsv: CSV_PATH,
    tahunAjaran: TAHUN_AJARAN,
    csvParsed: parsed.length,
    duplicateNpsnSkipped: dupeCount,
    npsnUnmatched: unmatched,
    npsnMatchedSchools: matched.length,
    paguUpdateCount: updateCount,
    paguInsertCount: insertCount,
    paguTotalProcessed: updateCount + insertCount,
    sample: matched.slice(0, 5).map(m => ({ npsn: m.npsn, nama: m.dbNama, persiapan: m.persiapan, alat: m.alat, pelatihan: m.pelatihan, total: m.paguTotal })),
  };
  fs.writeFileSync(REPORT_OUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`✅ Laporan JSON di ${REPORT_OUT_PATH}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
