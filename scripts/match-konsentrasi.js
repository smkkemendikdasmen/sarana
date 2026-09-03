#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\r") { /* skip */ }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (rows.length && rows[rows.length - 1].every(x => x === "" || x === undefined)) rows.pop();
  if (!rows.length) return [];
  const headers = rows[0];
  const headerCount = {};
  headers.forEach((h, i) => {
    const key = String(h || "").trim();
    if (headerCount[key] === undefined) headerCount[key] = 0;
    headerCount[key]++;
    if (headerCount[key] > 1) headers[i] = key + "_" + headerCount[key];
    else headers[i] = key;
  });
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => String(v || "").trim() !== ""));
}

function normalize(str) {
  if (!str) return "";
  let s = String(str).toLowerCase().trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[()\-–—.,;:!?"'`]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const stopwords = ["dan", "atau", "serta", "dengan", "di", "ke", "dari", "pada", "untuk", "adalah", "yang", "dalam", "oleh", "sebagai", "menjadi", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "dkk", "dll", "dsb", "yaitu", "ialah", "atas", "bawah", "luar", "sebelah", "sekitar", "tentang", "melalui", "tanpa", "sampai", "menuju", "hingga", "kepada", "daripada", "antara", "sesudah", "sebelum", "ketika", "saat", "sejak", "selama", "sambil", "meskipun", "walaupun", "jika", "kalau", "apabila", "jikalau", "supaya", "agar", "sebab", "karena", "sehingga", "maka"];
  s = s.split(" ").filter((w) => w && !stopwords.includes(w)).join(" ");
  const singkatan = {
    dkv: "desain komunikasi visual",
    tkr: "teknik kendaraan ringan",
    tsm: "teknik sepeda motor",
    tkj: "teknik komputer jaringan",
    tjkt: "teknik komputer jaringan",
    rpl: "rekayasa perangkat lunak",
    tpl: "teknik pengelasan",
    tpm: "teknik permesinan",
    tei: "teknik elektronika industri",
    titl: "teknik instalasi tenaga listrik",
    tataboga: "kuliner",
    tatabusana: "desain produksi busana",
    atp: "agribisnis tanaman pangan hortikultura",
    apat: "agribisnis perikanan air tawar",
    tkpi: "teknika kapal penangkap ikan",
    tptu: "agribisnis ternak unggas",
    ttu: "agribisnis ternak unggas",
    otkp: "manajemen perkantoran",
    tato: "teknik audio video",
    tav: "teknik audio video",
    tg: "teknik grafika",
    farmasi: "layanan penunjang kefarmasian klinis komunitas",
    caregiver: "layanan penunjang keperawatan caregiving",
    caregiving: "layanan penunjang keperawatan caregiving",
    cargiving: "layanan penunjang keperawatan caregiving",
    keperawatan: "layanan penunjang keperawatan caregiving",
    nautika: "nautika kapal penangkap ikan",
    "neutika": "nautika kapal penangkap ikan",
    "pengelasan": "teknik pengelasan",
    "akuntansi": "akuntansi keuangan lembaga",
    "perbankan syariah": "layanan perbankan syariah",
    "manajemen": "manajemen perkantoran",
    "management": "manajemen perkantoran",
    "perkantoran": "manajemen perkantoran",
    "kefarmasian": "layanan penunjang kefarmasian klinis komunitas",
    "kuliner": "kuliner patiseri perhotelan",
    "tata busana": "desain produksi busana",
    "desain pemodelan informasi bangunan": "desain pemodelan informasi bangunan",
    "bangunan": "teknik perawatan gedung",
    "alat berat": "teknik alat berat",
    "bisnis sepeda motor": "teknik bisnis sepeda motor",
    "ternak unggas": "agribisnis ternak unggas",
    "ternak": "agribisnis ternak unggas",
    "tanaman pangan": "agribisnis tanaman pangan hortikultura",
    "tanaman hortikultura": "agribisnis tanaman pangan hortikultura",
    "perkebunan": "agribisnis tanaman perkebunan",
    "perikanan": "agribisnis perikanan air tawar",
    "perikanan payau": "agribisnis perikanan air payau laut",
    "perikanan laut": "agribisnis perikanan air payau laut",
    "pengolahan hasil pertanian": "agribisnis pengolahan hasil pertanian",
    "pengolahan hasil perikanan": "agribisnis pengolahan hasil perikanan",
    "pengolahan": "agribisnis pengolahan hasil pertanian",
    "energi surya": "teknik energi surya hidro angin",
    "energi": "teknik energi surya hidro angin",
    "mekatronika": "teknik mekatronika",
    "mekanik industri": "teknik mekanik industri",
    "elektronika industri": "teknik elektronika industri",
    "instalasi tenaga listrik": "teknik instalasi tenaga listrik",
    "tenaga listrik": "teknik instalasi tenaga listrik",
    "akses telekomunikasi": "teknik jaringan akses telekomunikasi",
    "telekomunikasi": "teknik jaringan akses telekomunikasi",
    "laboratorium medik": "layanan penunjang laboratorium medik",
    "laboratorium": "layanan penunjang laboratorium medik",
    "desain komunikasi visaual": "desain komunikasi visual",
    "teknika": "teknik",
    "managemen": "manajemen",
    "pemodelan informasi bangunan": "desain pemodelan informasi bangunan",
    "teknik audio": "teknik audio video",
    "audio visual": "teknik audio video",
    "agribisnis perikanan payau": "agribisnis perikanan air payau laut",
    "perikanan air payau": "agribisnis perikanan air payau laut",
    "perikanan payau laut": "agribisnis perikanan air payau laut",
    "bisnis digital": "bisnis digital",
    "desain komunikasi visual": "desain komunikasi visual",
    "desain dan produksi busana": "desain produksi busana",
    "produksi busana": "desain produksi busana",
    "desain busana": "desain produksi busana",
  };
  Object.keys(singkatan).sort((a,b)=>b.length-a.length).forEach((k) => {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g");
    if (re.test(s)) s = s.replace(re, singkatan[k]);
  });
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

function main() {
  const masterRaw = fs.readFileSync("/tmp/master_128_konsentrasi.tsv", "utf8");
  const master = masterRaw.split("\n").filter(l => l.trim()).map(l => {
    const idxTab = l.indexOf("\t");
    return { code: l.slice(0, idxTab).trim(), name: l.slice(idxTab + 1).trim() };
  }).filter(m => m.code && m.name);
  console.error(`✅ Master loaded: ${master.length} konsentrasi`);

  const csvRaw = fs.readFileSync(path.join(ROOT, "docs/resouce/Rekomendasi KK - Sheet1.csv"), "utf8");
  const records = parseCSV(csvRaw);
  console.error(`✅ CSV loaded: ${records.length} sekolah`);
  if (records.length > 0) console.error(`   Headers detected: ${Object.keys(records[0]).join(" | ")}`);

  const resultRows = [];
  const mapping = [];

  let stats = { matchedExact: 0, matchedFuzzy: 0, needCheck: 0, unmatched: 0, kosong: 0 };

  for (let r = 0; r < records.length; r++) {
    const rec = records[r];
    const npsn = String(rec["NPSN"] || "").trim().padStart(8, "0").slice(0, 8);
    const namaSekolah = rec["Nama Sekolah"] || "";
    const allKeys = Object.keys(rec);
    const jurusanCols = allKeys.filter(k => k.startsWith("JURUSAN AJUAN DINAS")).slice(0, 5);
    while (jurusanCols.length < 5) jurusanCols.push("");
    const jurusan = jurusanCols.map(k => k ? rec[k] : "").map(v => String(v ?? ""));
    const mappedCodes = [];
    const matchInfo = [];
    for (let s = 0; s < 5; s++) {
      const orig = jurusan[s];
      const trimmed = orig ? String(orig).trim() : "";
      if (!trimmed) {
        matchInfo.push({ slot: s + 1, csv: "", status: "KOSONG", master_code: "", master_name: "", score: 0 });
        stats.kosong++;
        continue;
      }
      const normCSV = normalize(trimmed);
      let best = null;
      let bestScore = 0;
      let exact = false;
      for (let m = 0; m < master.length; m++) {
        const mm = master[m];
        const normMasterName = normalize(mm.name);
        const normMasterCode = mm.code.toLowerCase().trim();
        if (normCSV === normMasterName) { best = mm; bestScore = 1; exact = true; break; }
        if (normCSV === normMasterCode) { best = mm; bestScore = 1; exact = true; break; }
      }
      if (!exact) {
        for (let m = 0; m < master.length; m++) {
          const mm = master[m];
          const normMasterName = normalize(mm.name);
          let score = 0;
          if (normMasterName.includes(normCSV) || normCSV.includes(normMasterName)) {
            score = 0.85 + Math.min(normCSV.length, normMasterName.length) / Math.max(normCSV.length, normMasterName.length) * 0.14;
          } else {
            const wordsCSV = normCSV.split(" ").filter(w => w.length >= 3);
            const wordsMaster = normMasterName.split(" ").filter(w => w.length >= 3);
            let hit = 0;
            wordsCSV.forEach(w => { if (wordsMaster.includes(w)) hit++; });
            if (hit > 0) {
              score = 0.5 + (hit / Math.max(wordsCSV.length, wordsMaster.length)) * 0.35;
            } else {
              const sim = similarity(trimmed, mm.name);
              if (sim >= 0.55) score = sim;
            }
          }
          if (score > bestScore) { best = mm; bestScore = score; }
        }
      }
      let status = "";
      if (exact) { status = "MATCHED EXACT"; stats.matchedExact++; }
      else if (best && bestScore >= 0.65) { status = "DIJADIKAN SESUAI"; stats.matchedFuzzy++; }
      else if (best && bestScore >= 0.45) { status = "PERLU DICEK"; stats.needCheck++; best = null; }
      else { status = "TIDAK DITEMUKAN"; stats.unmatched++; best = null; }
      const info = {
        slot: s + 1,
        csv: trimmed,
        status,
        master_code: best ? best.code : "",
        master_name: best ? best.name : "",
        score: best ? Math.round(bestScore * 100) : (bestScore ? Math.round(bestScore*100) : 0)
      };
      matchInfo.push(info);
      if (best) mappedCodes.push(best.code); else mappedCodes.push("");
    }
    const rowObj = {
      no: r + 1,
      provinsi: rec["Provinsi"] || "",
      kabupaten: rec["Kabupaten/Kota"] || "",
      npsn,
      nama_sekolah: namaSekolah,
    };
    for (let s = 0; s < 5; s++) {
      const info = matchInfo[s];
      rowObj[`slot_${s + 1}_csv`] = info.csv;
      rowObj[`slot_${s + 1}_status`] = info.status;
      rowObj[`slot_${s + 1}_kode_kk`] = info.master_code;
      rowObj[`slot_${s + 1}_nama_kk`] = info.master_name;
      rowObj[`slot_${s + 1}_score`] = info.score;
    }
    resultRows.push(rowObj);
    mapping.push({
      no: r + 1,
      npsn,
      nama_sekolah: namaSekolah,
      k1_code: mappedCodes[0] || null,
      k2_code: mappedCodes[1] || null,
      k3_code: mappedCodes[2] || null,
      k4_code: mappedCodes[3] || null,
      k5_code: mappedCodes[4] || null,
      match_info: matchInfo,
    });
  }

  const reportDir = path.join(ROOT, "docs/resouce");
  const reportCsvPath = path.join(reportDir, "LAPORAN_REKOMENDASI_KK_MATCHING.csv");
  const mapJsonPath = path.join(reportDir, "MAPPING_REKOMENDASI_KK_SIAP_IMPORT.json");

  const headers = Object.keys(resultRows[0]);
  const csvLines = [headers.join(",")];
  resultRows.forEach(rr => {
    csvLines.push(headers.map(h => {
      let v = String(rr[h] ?? "");
      if (v.includes(",") || v.includes('"') || v.includes("\n")) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(","));
  });
  fs.writeFileSync(reportCsvPath, csvLines.join("\n"), "utf8");
  fs.writeFileSync(mapJsonPath, JSON.stringify(mapping, null, 2), "utf8");

  const totalKolomJurusan = records.length * 5;
  const terisi = stats.matchedExact + stats.matchedFuzzy + stats.needCheck + stats.unmatched;
  console.log(`\n┌──────────────────────────────────────────────────────────────────────┐`);
  console.log(`│  📊 STATISTIK HASIL PEMCOCOKAN REKOMENDASI KK                          │`);
  console.log(`├──────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Total sekolah diproses         : ${String(records.length).padEnd(3)} / 132 ABT                        │`);
  console.log(`│  Total slot jurusan (5×132)     : ${totalKolomJurusan} slot                                       │`);
  console.log(`│    ├─ Slot KOSONG               : ${stats.kosong} (tidak ada input)                              │`);
  console.log(`│    ├─ Slot TERISI               : ${terisi}                                                       │`);
  console.log(`│       ├─ ✅ MATCHED EXACT       : ${stats.matchedExact}                                              │`);
  console.log(`│       ├─ 🔄 DIJADIKAN SESUAI    : ${stats.matchedFuzzy}                                              │`);
  console.log(`│       ├─ ⚠️  PERLU DICEK        : ${stats.needCheck}                                                 │`);
  console.log(`│       └─ ❌ TIDAK DITEMUKAN     : ${stats.unmatched}                                                 │`);
  console.log(`├──────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  📁 FILE OUTPUT:                                                         │`);
  console.log(`│  1. LAPORAN review + koreksi: docs/resouce/LAPORAN_REKOMENDASI_KK_MATCHING.csv  │`);
  console.log(`│  2. Mapping JSON siap import : docs/resouce/MAPPING_REKOMENDASI_KK_SIAP_IMPORT.json │`);
  console.log(`└──────────────────────────────────────────────────────────────────────┘`);

  console.log(`\n🔎 SAMPLE 5 BARIS PERLU DICEK (jika ada):`);
  let count = 0;
  for (const rr of resultRows) {
    for (let s = 1; s <= 5; s++) {
      const status = rr[`slot_${s}_status`];
      if (status === "PERLU DICEK" || status === "TIDAK DITEMUKAN") {
        count++;
        if (count <= 10) {
          console.log(`   [${rr.no}] ${rr.nama_sekolah} (${rr.npsn}) Slot ${s}:`);
          console.log(`     CSV    : "${rr[`slot_${s}_csv`]}" -> ${status} (score ${rr[`slot_${s}_score`]}%)`);
          console.log(`     Saran  : ${rr[`slot_${s}_kode_kk`] ? rr[`slot_${s}_kode_kk`] + " — " + rr[`slot_${s}_nama_kk`] : "(tidak ada saran)"}`);
        }
      }
    }
  }
  if (count === 0) console.log(`   (TIDAK ADA slot yang PERLU DICEK / TIDAK DITEMUKAN - SEMUA COCOK! ✨)`);
}

main();
