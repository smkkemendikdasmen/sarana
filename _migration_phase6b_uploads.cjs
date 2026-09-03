// FASE 6 v2: Strategy LEBIH AMAN: DARI DB dapetin unique npsn + file_path prefix (folder id user)
// JANGAN rely users.id exact match (length mismatch 25 vs 26 trailing nullpad)
// Langsung: SELECT DISTINCT npsn, split_part(file_path,'/',1) AS folder_id FROM docadmin WHERE file_path IS NOT NULL
// Ini 100% akurat karena docadmin.npsn = TRUE PK sekolah dan setiap file disimpan di folder user uploader (1 user 1 sekolah).

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const DB_URL = process.env.DATABASE_URL || "postgresql://saranasmk:saranasmk123@127.0.0.1:5432/saranasmk";
const UPLOAD_BASE = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/uploads/school-profile-documents";

function padNumber(n, len=2) { return String(n).padStart(len, "0"); }
function ts() { const d = new Date(); return `${d.getFullYear()}${padNumber(d.getMonth()+1)}${padNumber(d.getDate())}_${padNumber(d.getHours())}${padNumber(d.getMinutes())}${padNumber(d.getSeconds())}`; }
const BACKUP_FILE = path.join("/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_BACKUP_PRODUCTION", `_phase6_v2_uploads_${ts()}.json`);

async function main() {
  console.log("[FASE 6 v2] DB connect");
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  // STRATEGI: DISTINCT folder_id (dari split file_path) BERDASARKAN data DB yang TERBAIK dijadikan npsn
  const distinctQ = await pg.query(`
    SELECT DISTINCT ON (folder_id)
      btrim(npsn) AS npsn,
      split_part(file_path, '/', 1) AS folder_id
    FROM school_profile_administrative_documents
    WHERE file_path IS NOT NULL
      AND length(btrim(file_path)) > 8
      AND btrim(npsn) <> ''
    ORDER BY folder_id, npsn
  `);
  console.log(`[FASE 6 v2] Distinct pairs folder_id → npsn: ${distinctQ.rows.length}`);
  console.log("[FASE 6 v2] Sample pairs:");
  distinctQ.rows.slice(0,5).forEach(r => console.log(`  ${r.folder_id} (len=${r.folder_id.length}) → npsn=${r.npsn} (len=${r.npsn.length})`));

  const mapping = [];
  for (const r of distinctQ.rows) {
    const fid = String(r.folder_id).trim();
    const npsn = String(r.npsn).trim();
    if (!/^\d{8}$/.test(npsn)) continue;
    const src = path.join(UPLOAD_BASE, fid);
    const dst = path.join(UPLOAD_BASE, npsn);
    if (!fs.existsSync(src)) continue;
    mapping.push({ folder_id: fid, npsn, src, dst, existsDst: fs.existsSync(dst) });
  }
  console.log(`[FASE 6 v2] Valid mapping (folder exist + npsn 8 digit): ${mapping.length}`);

  // Backup plan
  const plan = mapping.map(m => ({
    from: m.folder_id, to: m.npsn,
    srcFiles: fs.readdirSync(m.src), dstExisted: m.existsDst,
  }));
  const backup = {
    ts: new Date().toISOString(),
    renameCount: mapping.length,
    sha256: crypto.createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
    plan,
  };
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
  console.log(`[FASE 6 v2] Backup: ${BACKUP_FILE} | sha=${backup.sha256.slice(0,12)}`);

  // Execute rename folders
  let renamedOk = 0;
  let mergedFiles = 0;
  let skipped = 0;
  for (const m of mapping) {
    try {
      if (m.existsDst) {
        // merge: move each file src→dst, rename if conflict suffix __moved__
        for (const fn of fs.readdirSync(m.src)) {
          const s = path.join(m.src, fn);
          let t = path.join(m.dst, fn);
          if (fs.existsSync(t)) {
            const ext = path.extname(fn);
            const base = path.basename(fn, ext);
            t = path.join(m.dst, `${base}__moved__${Date.now()}${ext}`);
          }
          fs.renameSync(s, t);
          mergedFiles += 1;
        }
        try { fs.rmdirSync(m.src); } catch {}
        renamedOk += 1;
        continue;
      }
      fs.renameSync(m.src, m.dst);
      renamedOk += 1;
    } catch (err) {
      console.error(`  SKIP ${m.folder_id}→${m.npsn}:`, err.message);
      skipped += 1;
    }
  }
  console.log(`[FASE 6 v2] Rename: ${renamedOk} | merged files: ${mergedFiles} | skip: ${skipped}`);

  // Update DB file_path
  console.log("[FASE 6 v2] Update DB file_path per npsn...");
  let upd = 0;
  await pg.query("BEGIN");
  for (const r of distinctQ.rows) {
    const fid = String(r.folder_id).trim();
    const npsn = String(r.npsn).trim();
    if (!/^\d{8}$/.test(npsn)) continue;
    if (!fid) continue;
    const oldPrefix = fid + "/";
    const newPrefix = npsn + "/";
    const res = await pg.query(
      `UPDATE school_profile_administrative_documents
       SET file_path = regexp_replace(file_path, '^' || $1::text, $2::text)
       WHERE npsn = $3::char(8) AND file_path ^@ $4::text`,
      [oldPrefix, newPrefix, npsn, oldPrefix]
    );
    upd += Number(res.rowCount ?? 0);
  }
  await pg.query("COMMIT");
  console.log(`[FASE 6 v2] DB UPDATE rows: ${upd}`);

  // Verify 3 sekolah random
  for (const expectedNpsn of ["10113067","10100617","10110606"]) {
    const rowQ = await pg.query(
      "SELECT file_path FROM school_profile_administrative_documents WHERE npsn=$1 LIMIT 1",
      [expectedNpsn]
    );
    if (rowQ.rows.length > 0) {
      const fp = rowQ.rows[0].file_path;
      const start = fp.split("/")[0];
      const full = path.join(UPLOAD_BASE, fp);
      const exist = fs.existsSync(full);
      const marker = (start === expectedNpsn && exist) ? "✅ PASS" : "❌ FAIL";
      console.log(`  ${marker} ${expectedNpsn}: path=${fp} startWith=${start} fileExist=${exist}`);
      if (start !== expectedNpsn || !exist) process.exitCode = 99;
    }
  }
  await pg.end();
  console.log("[FASE 6 v2] DONE ✅");
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
