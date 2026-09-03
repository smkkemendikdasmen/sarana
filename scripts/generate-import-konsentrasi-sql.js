#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk";

function createId() {
  return `${Date.now().toString(36)}${crypto.randomBytes(10).toString("hex")}`.slice(0, 26).padEnd(26, "0");
}

function pgEscapeStr(s) {
  if (s === null || s === undefined) return "NULL";
  const str = String(s).replace(/'/g, "''");
  return "'" + str + "'";
}

function main() {
  const masterRaw = fs.readFileSync("/tmp/master_128_konsentrasi.tsv", "utf8");
  const master = new Map();
  masterRaw.split("\n").filter(l => l.trim()).forEach(l => {
    const idxTab = l.indexOf("\t");
    const code = l.slice(0, idxTab).trim();
    const name = l.slice(idxTab + 1).trim();
    if (code) master.set(code, name);
  });
  console.error(`✅ Master lookup loaded: ${master.size} kode KK`);

  const mapPath = path.join(ROOT, "docs/resouce/MAPPING_REKOMENDASI_KK_SIAP_IMPORT.json");
  const mapping = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  console.error(`✅ Mapping JSON loaded: ${mapping.length} sekolah`);

  const abtNpsnCheckFile = "/tmp/abt_npsn_list.tsv";
  const lines = [];
  lines.push(`-- ================================================================`);
  lines.push(`-- SCRIPT IMPORT BULK REKOMENDASI KK (131 SEKOLAH) - SAFETY PATTERN`);
  lines.push(`-- Delete scope  : WHERE npsn=$1 AND row_order <= 5 (DATA RIIL >5 TETAP AMAN)`);
  lines.push(`-- Sumber data   : docs/resouce/MAPPING_REKOMENDASI_KK_SIAP_IMPORT.json`);
  lines.push(`-- Generate waktu: ${new Date().toISOString()}`);
  lines.push(`-- ================================================================`);
  lines.push(`BEGIN;`);
  lines.push(`-- (Opsional) SAVEPOINT pre_import_bulk;`);
  lines.push(``);

  let totalDelete = 0;
  let totalInsert = 0;
  let totalProcessed = 0;
  let totalWithData = 0;
  let totalSkipped = 0;
  const errors = [];

  for (const item of mapping) {
    const npsn = String(item.npsn || "").trim().padStart(8, "0").slice(0, 8);
    if (!/^\d{8}$/.test(npsn)) {
      errors.push(`Skip no=${item.no} npsn invalid: ${item.npsn}`);
      totalSkipped++;
      continue;
    }
    const codes5 = [item.k1_code, item.k2_code, item.k3_code, item.k4_code, item.k5_code].map(c => c ? String(c).trim() : "");
    const hasAny = codes5.some(c => c);
    if (!hasAny) { totalProcessed++; totalSkipped++; continue; }
    totalWithData++;

    const lookups = [];
    for (let i = 0; i < 5; i++) {
      const code = codes5[i];
      if (!code) { lookups.push(null); continue; }
      const name = master.get(code);
      if (!name) {
        errors.push(`[no=${item.no} NPSN=${npsn}] Slot ${i+1}: Kode ${code} TIDAK ADA di MASTER 128 KK (skip insert slot ini)`);
        lookups.push(null);
      } else {
        lookups.push({ code, name });
      }
    }

    lines.push(`-- ─────────────────────────────────────────────`);
    lines.push(`-- No.${item.no}  [${npsn}]  ${item.nama_sekolah}`);
    lines.push(`-- Input K1-K5: [${codes5.map(c=>c||'-').join(' | ')}]`);
    lines.push(`DELETE FROM public.school_profile_concentrations WHERE npsn = ${pgEscapeStr(npsn)} AND row_order <= 5;`);
    totalDelete++;

    const nowIso = new Date().toISOString().replace("T", " ").replace(/\..*$/, "");
    for (let i = 0; i < 5; i++) {
      const lu = lookups[i];
      if (!lu) continue;
      const rowOrder = i + 1;
      const id = createId();
      lines.push(`INSERT INTO public.school_profile_concentrations (id, npsn, concentration_code, concentration_name, rombel_count, rombel_10, rombel_11, rombel_12, student_count, student_10, student_11, student_12, luas_ruangan_rps, row_order, created_at, updated_at) VALUES (${pgEscapeStr(id)}, ${pgEscapeStr(npsn)}, ${pgEscapeStr(lu.code)}, ${pgEscapeStr(lu.name)}, 0, 0, 0, 0, 0, 0, 0, 0, '', ${rowOrder}, ${pgEscapeStr(nowIso)}, ${pgEscapeStr(nowIso)});`);
      totalInsert++;
    }
    totalProcessed++;
  }

  lines.push(``);
  lines.push(`-- ─────────────────────────────────────────────`);
  lines.push(`-- VALIDASI AKHIR (bisa di-uncomment untuk cek sebelum COMMIT):`);
  lines.push(`-- SELECT COUNT(*) AS total_rekomendasi_import FROM public.school_profile_concentrations WHERE row_order <= 5;`);
  lines.push(`-- SELECT npsn, COUNT(*) FROM public.school_profile_concentrations WHERE row_order <= 5 GROUP BY npsn HAVING COUNT(*) > 5;  -- expect 0 rows`);
  lines.push(`COMMIT;`);
  lines.push(``);
  lines.push(`-- ⚠️  JIKA TERDAPAT MASALAH SETELAH COMMIT, RESTORE DARI BACKUP DULU SEBELUM IMPORT`);

  const outPath = path.join(ROOT, "docs/resouce/IMPORT_REKOMENDASI_KK_SAFE.sql");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(`\n┌──────────────────────────────────────────────────────────────────────┐`);
  console.log(`│  📦 GENERATE SCRIPT IMPORT SQL SELESAI                                  │`);
  console.log(`├──────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Total mapping sekolah diproses: ${String(mapping.length).padEnd(3)} sekolah                           │`);
  console.log(`│  Sekolah dengan data rekomendasi: ${String(totalWithData).padEnd(3)} (skip ${totalSkipped} kosong)          │`);
  console.log(`│  Total DELETE SAFE row_order<=5   : ${String(totalDelete).padEnd(3)} statement                      │`);
  console.log(`│  Total INSERT row baru            : ${String(totalInsert).padEnd(3)} baris data                    │`);
  console.log(`│  Total skip error/empty           : ${String(totalSkipped + errors.length - (mapping.length-totalProcessed)).padEnd(3)} (lihat bawah)        │`);
  console.log(`├──────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  📄 File SQL yang dihasilkan:                                           │`);
  console.log(`│     docs/resouce/IMPORT_REKOMENDASI_KK_SAFE.sql                         │`);
  console.log(`└──────────────────────────────────────────────────────────────────────┘`);
  if (errors.length > 0) {
    console.log(`\n⚠️  DAFTAR WARNING (${errors.length} item, TIDAK STOP eksekusi):`);
    errors.slice(0, 10).forEach(e => console.log(`   • ${e}`));
    if (errors.length > 10) console.log(`   ... (${errors.length - 10} warning lainya, lihat log detail)`);
  } else {
    console.log(`\n✅ 0 ERROR VALIDASI — Semua kode konsentrasi K1..K5 TERDAFTAR di master 128 KK ✨`);
  }
}

main();
