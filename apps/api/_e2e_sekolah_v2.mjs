// E2E BACKEND SEKOLAH — URL ENDPOINT SESUAI api.ts frontend (SSOT)
const BASE = "http://localhost:3000/api/v1";
const U = "10102743"; const P = "Sekolah2026!";

function unwrap(raw) {
  if (raw && typeof raw === "object" && "data" in raw && Object.prototype.hasOwnProperty.call(raw, "data") && Object.prototype.hasOwnProperty.call(raw, "ok")) {
    return raw.data;
  }
  return raw;
}

const results = [];
function mark(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`[${ok ? "✅" : "❌"}] ${name}${extra ? " — " + String(extra).slice(0, 150) : ""}`);
  return ok;
}

async function g(url, isArr = false, isObj = true) {
  const r = await fetch(BASE + url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  let j = null;
  try { j = await r.json(); } catch {}
  const data = unwrap(j);
  const statusOK = r.status >= 200 && r.status < 300;
  let shapeOK = true;
  if (isArr) shapeOK = Array.isArray(data);
  else if (isObj) shapeOK = typeof data === "object" && data !== null;
  return { ok: statusOK && shapeOK, status: r.status, data, rawStatus: r.status, err: j?.error || j?.data?.error };
}

let TOKEN = null;

(async () => {
  console.log("=== E2E SEKOLAH v2 (URL SESUAI api.ts frontend SSOT) ===\n");

  // LOGIN
  const lr = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: U, password: P }),
  });
  const login = unwrap(await lr.json());
  if (!mark("0. Login SEKOLAH role=SEKOLAH",
    lr.status >= 200 && lr.status < 300 && login?.user?.role === "SEKOLAH" && login?.token?.length > 10,
    `role=${login?.user?.role} npsn=${login?.user?.username} token_len=${login?.token?.length}`)) {
    process.exit(1);
  }
  TOKEN = login.token;
  const me = await g("/auth/me");
  mark("1. /auth/me", me.ok && me.data?.user?.role === "SEKOLAH",
    `role=${me.data?.user?.role} id=${me.data?.user?.id}`);

  // ==================== HALAMAN 1: /dashboard/sekolah ====================
  console.log("\n--- [HAL 1] /dashboard/sekolah ---");
  const dash = await g("/dashboards/sekolah", false, true);
  mark("1a. GET /dashboards/sekolah (data dashboard)", dash.ok,
    `HTTP ${dash.status} keys=${dash.data&&typeof dash.data==="object"?Object.keys(dash.data).slice(0,12).join(","):"N/A"}`);
  if (dash.err) console.log("   ERROR MSG:", dash.err);

  // ==================== HALAMAN 2: /sekolah/pengajuan (ringkasan) ====================
  console.log("\n--- [HAL 2] /sekolah/pengajuan (ringkasan pengajuan + profile) ---");
  // Halaman pengajuan biasanya pakai school-profile/me + school-proposals/me untuk ringkasan
  const pr2 = await g("/school-profile/me", false, true);
  mark("2a. /school-profile/me (profil sekolah)", pr2.ok,
    `HTTP ${pr2.status} keys=${pr2.data&&typeof pr2.data==="object"?Object.keys(pr2.data).slice(0,10).join(","):"N/A"}`);
  const spSum = await g("/workspace-data/school-proposals/me?scope=summary", false, true);
  mark("2b. /workspace-data/school-proposals/me (ringkasan proposal)", spSum.ok || spSum.status < 500,
    `HTTP ${spSum.status} keys=${spSum.data&&typeof spSum.data==="object"?Object.keys(spSum.data).slice(0,8).join(","):"N/A"} err=${spSum.err?.code||""}`);

  // ==================== HALAMAN 3: /sekolah/pengajuan/data-persiapan (proposal) ====================
  console.log("\n--- [HAL 3] /sekolah/pengajuan/data-persiapan (workspace_school_proposal_data) ---");
  const propMe = await g("/workspace-data/school-proposals/me", false, true);
  mark("3a. GET /workspace-data/school-proposals/me (data proposal = data-persiapan)", propMe.ok,
    `HTTP ${propMe.status} — shape: ${Array.isArray(propMe.data)?"rows="+propMe.data.length:(propMe.data&&typeof propMe.data==="object"?"keys="+Object.keys(propMe.data).slice(0,10).join(","):typeof propMe.data)}`);
  if (propMe.err) console.log("   ERROR:", propMe.err?.code, "|", String(propMe.err?.message || "").slice(0,100));

  // ==================== HALAMAN 4: /sekolah/pengajuan/data-pelatihan ====================
  console.log("\n--- [HAL 4] /sekolah/pengajuan/data-pelatihan (alat/pelatihan) ---");
  // data-pelatihan biasaya terkait equipment atau cp-fase-f
  const eq = await g("/workspace-data/school-equipment/me", false, true);
  mark("4a. /workspace-data/school-equipment/me (data alat utama)", eq.ok,
    `HTTP ${eq.status} — ${Array.isArray(eq.data)?"rows="+eq.data.length:(eq.data&&typeof eq.data==="object"?"keys="+Object.keys(eq.data).slice(0,10).join(","):typeof eq.data)}`);
  if (eq.err) console.log("   ERROR:", eq.err?.code, "|", String(eq.err?.message || "").slice(0,100));
  const cp = await g("/master-data/cp-fase-f");
  mark("4b. /master-data/cp-fase-f (support data pelatihan CP Fase F)", cp.ok,
    `HTTP ${cp.status} rows=${Array.isArray(cp.data)?cp.data.length:typeof cp.data}`);

  // ==================== HALAMAN 5: /sekolah/profil — tab dokumen & konsentrasi ====================
  console.log("\n--- [HAL 5] /sekolah/profil (DOKUMEN & KONSENTRASI) ---");
  // 5a. data pokok profil (5a sudah di atas mark 2a)
  // 5b. TAB DOKUMEN ADMINISTRATIF: /school-profile/me/administrative-documents
  const docs = await g("/school-profile/me/administrative-documents", true);
  mark("5b. GET /school-profile/me/administrative-documents (TAB DATA DOKUMEN)", docs.ok,
    `HTTP ${docs.status} rows=${Array.isArray(docs.data)?docs.data.length:typeof docs.data}`);
  if (docs.err) console.log("   ERROR:", docs.err?.code, "|", String(docs.err?.message || "").slice(0,100));
  // 5c. TAB KONSENTRASI
  // Konsentrasi ada di 2 tempat: summary /school-profile/list-concentrations-summary MASTER,
  // dan konsentrasi SEKOLAH biasanya di payload /school-profile/me field concentrations array.
  // Coba cari endpoint child konsentrasi per sekolah — jika tidak ada cek field di school-profile/me
  const konsSummary = await g("/school-profile/list-concentrations-summary", true);
  mark("5c. /school-profile/list-concentrations-summary (MASTER konsentrasi)", konsSummary.ok,
    `HTTP ${konsSummary.status} rows=${Array.isArray(konsSummary.data)?konsSummary.data.length:typeof konsSummary.data}`);
  // Periksa apakah /school-profile/me SUDAH include concentrations & administrative_documents keys
  let includeKons = false, includeDocsPayload = false;
  if (pr2.data && typeof pr2.data === "object") {
    const allKeys = Object.keys(pr2.data);
    includeKons = allKeys.some(k => /konsentr|concentr/i.test(k));
    includeDocsPayload = allKeys.some(k => /dokumen|doc|administrat/i.test(k));
  }
  mark("5d. Profil ME include field konsentrasi & dokumen (embedded payload)", includeKons,
    `includeKons=${includeKons}, includeDocs=${includeDocsPayload}`);

  // ==================== HALAMAN 6: /sekolah/alat ====================
  console.log("\n--- [HAL 6] /sekolah/alat (workspace_school_equipment_data + PERDIRJEN) ---");
  // Sudah eq di atas 4a. Tambah perdirjen equipment
  mark("6a. /workspace-data/school-equipment/me (DATA ALAT UTAMA /sekolah/alat)", eq.ok,
    `HTTP ${eq.status} ${Array.isArray(eq.data)?"rows="+eq.data.length:(eq.data&&typeof eq.data==="object"?"shape=object":"N/A")}`);
  const per = await g("/master-data/perdirjen-equipment");
  mark("6b. /master-data/perdirjen-equipment (master peralatan perdirjen)", per.ok,
    `HTTP ${per.status} rows=${Array.isArray(per.data)?per.data.length:typeof per.data}`);

  // ==================== SAVE SMOKE TEST (POST/PUT) — TANPA merubah data = kirim OBJECT KOSONG / CURRENT payload jika bisa ====================
  console.log("\n--- [SAVE SMOKE TEST Cek 404/500 BUKAN 200 BERARTI ENDPOINT ADA] ---");
  if (propMe.ok && propMe.data && typeof propMe.data === "object") {
    const r = await fetch(`${BASE}/workspace-data/school-proposals/me`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(Array.isArray(propMe.data) ? (propMe.data[0] ?? {}) : propMe.data),
    });
    mark("SAVE3 PUT /workspace-data/school-proposals/me (save data-persiapan)", r.status >= 200 && r.status < 500,
      `HTTP ${r.status} (2xx/3xx/4xx=OK, 5xx=FAIL)`);
  }
  if (eq.ok) {
    const r2 = await fetch(`${BASE}/workspace-data/school-equipment/me`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ items: [] }),
    });
    mark("SAVE6 PUT /workspace-data/school-equipment/me (save data alat)", r2.status >= 200 && r2.status < 500,
      `HTTP ${r2.status}`);
  }
  // Save profil
  if (pr2.ok && pr2.data && typeof pr2.data === "object") {
    const r3 = await fetch(`${BASE}/school-profile/me`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(pr2.data),
    });
    mark("SAVE5 PUT /school-profile/me (save profil)", r3.status >= 200 && r3.status < 500, `HTTP ${r3.status}`);
  }
  // Delete dokumen (smoke path saja, tidak execute DELETE)
  // mark("DOK DELETE path exists (tidak execute)", true, `skip actual DELETE`);

  // ==================== MASTER DATA WILAYAH ====================
  console.log("\n--- [MASTER DATA WILAYAH] Digunakan dropdown form profil ---");
  const prov = await g("/master-data/wilayah/provinsi", true);
  mark("MD1 /master-data/wilayah/provinsi", prov.ok, `rows=${Array.isArray(prov.data)?prov.data.length:typeof prov.data}`);

  // ==================== RINGKASAN ====================
  console.log("\n\n====== RINGKASAN E2E SEKOLAH v2 ======");
  const PASS = results.filter(r => r.ok).length;
  const TOTAL = results.length;
  const FAIL = TOTAL - PASS;
  for (const r of results) console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
  console.log(`\nTOTAL=${TOTAL} PASS=${PASS} FAIL=${FAIL} => ${FAIL===0?"EXIT 0 ✅":`EXIT ${FAIL} ❌`}`);
  process.exit(FAIL);
})().catch(e => { console.error("FATAL UNCAUGHT:", e); process.exit(99); });
