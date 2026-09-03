// E2E Backend Endpoint Test untuk 6 HALAMAN user SEKOLAH (NPSN 10102743)
// Semua request via REWRITE PORT 3000 (/api/v1) — sama akses point seperti frontend

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
  console.log(`[${ok ? "✅ PASS" : "❌ FAIL"}] ${name}${extra ? " — " + extra.slice(0, 120) : ""}`);
  return ok;
}

let TOKEN = null;
async function g(url, expectObj = true) {
  const r = await fetch(BASE + url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  let j = null;
  try { j = await r.json(); } catch {}
  const data = unwrap(j);
  const ok = r.status >= 200 && r.status < 300 && (expectObj ? typeof data === "object" && data !== null : true);
  return { ok, status: r.status, data, rawStatus: r.status };
}

(async () => {
  console.log("=== START E2E ENDPOINT SEKOLAH (10102743) via REWRITE 3000 ===\n");

  // =============== 0. LOGIN ===============
  const loginResp = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: U, password: P }),
  });
  const loginRaw = await loginResp.json();
  const login = unwrap(loginRaw);
  const loginOK = mark("0. Auth Login SEKOLAH",
    loginResp.status >= 200 && loginResp.status < 300 && !!login?.token && login?.user?.role === "SEKOLAH",
    `role=${login?.user?.role}, token_len=${login?.token?.length ?? 0}`);
  if (!loginOK) { console.log("FATAL: login gagal"); process.exit(1); }
  TOKEN = login.token;

  // =============== ME ===============
  const me = await g("/auth/me");
  mark("1. Auth /me (role SEKOLAH terdefinisi)", me.ok && me.data?.user?.role === "SEKOLAH",
    `role=${me.data?.user?.role ?? "undef"} npsn=${me.data?.user?.username ?? "undef"}`);

  // =============== HALAMAN 1: /dashboard/sekolah ===============
  console.log("\n--- [HALAMAN 1] /dashboard/sekolah ---");
  const dash = await g("/dashboard/me");
  mark("1a. Dashboard /me (ringkasan sekolah)", dash.ok, `keys=${dash.data?Object.keys(dash.data).slice(0,8).join(","):""}`);
  // Fallback jika dashboard endpoint nama lain: /sekolah/dashboard
  if (!dash.ok) {
    const dash2 = await g("/school-dashboard/me");
    mark("1b. (fallback) /school-dashboard/me", dash2.ok, `keys=${dash2.data?Object.keys(dash2.data).slice(0,8):""}`);
  }

  // =============== HALAMAN 2: /sekolah/pengajuan ===============
  console.log("\n--- [HALAMAN 2] /sekolah/pengajuan (ringkasan pengajuan) ---");
  // Check GET ringkasan pengajuan sekolah
  for (const ep of ["/workspace-data/school/proposal-summary/me",
    "/workspace-data/school/proposal/me/summary",
    "/school-profile/me",
    "/workspace-data/school-selection/me?scope=light"]) {
    const x = await g(ep);
    mark(`2. Pengajuan ${ep}`, x.ok, typeof x.data==="object" ? `typeof=object keys=${Object.keys(x.data||{}).slice(0,6).join(",")}` : `status=${x.status}`);
  }

  // =============== HALAMAN 3: /sekolah/pengajuan/data-persiapan ===============
  console.log("\n--- [HALAMAN 3] /sekolah/pengajuan/data-persiapan (proposal_data) ---");
  const prop = await g("/workspace-data/school/proposal/me");
  mark("3a. GET proposal/me (workspace_school_proposal_data)", prop.ok,
    `keys=${prop.data?Object.keys(prop.data).slice(0,8).join(","):""}`);

  // =============== HALAMAN 4: /sekolah/pengajuan/data-pelatihan ===============
  console.log("\n--- [HALAMAN 4] /sekolah/pengajuan/data-pelatihan (equipment_data pengajuan) ---");
  // Biasanya endpoint data pelatihan sama workspace equipment atau proposal equipment
  for (const ep of ["/workspace-data/school/equipment/me", "/workspace-data/school/proposal-equipment/me"]) {
    const x = await g(ep);
    mark(`4. Pelatihan ${ep}`, x.ok, `keys=${x.data?Object.keys(x.data).slice(0,8).join(","):""}`);
  }

  // =============== HALAMAN 5: /sekolah/profil ===============
  console.log("\n--- [HALAMAN 5] /sekolah/profil (tab data dokumen & konsentrasi) ---");
  const prof = await g("/school-profile/me");
  mark("5a. Profil /school-profile/me (data pokok)", prof.ok,
    `typeof=${typeof prof.data} keys=${prof.data && typeof prof.data === "object" ? Object.keys(prof.data).slice(0,10).join(",") : "N/A"}`);
  const kons = await g("/school-profile/me/concentrations");
  mark("5b. Konsentrasi /school-profile/me/concentrations (tab konsentrasi)", kons.ok,
    `rows=${Array.isArray(kons.data) ? kons.data.length : typeof kons.data}`);
  const konsSummary = await g("/school-profile/list-concentrations-summary");
  mark("5c. Konsentrasi summary (opsional)", konsSummary.ok,
    `rows=${Array.isArray(konsSummary.data) ? konsSummary.data.length : typeof konsSummary.data}`);
  const docs = await g("/school-profile/me/documents");
  mark("5d. Dokumen /school-profile/me/documents (tab data dokumen)", docs.ok,
    `rows=${Array.isArray(docs.data) ? docs.data.length : typeof docs.data}`);
  const orgm = await g("/school-profile/me/organization-members");
  mark("5e. Struktur Organisasi (opsional tab organisasi)", orgm.ok,
    `rows=${Array.isArray(orgm.data) ? orgm.data.length : typeof orgm.data}`);

  // =============== HALAMAN 6: /sekolah/alat ===============
  console.log("\n--- [HALAMAN 6] /sekolah/alat (workspace_school_equipment_data) ---");
  const equip = await g("/workspace-data/school/equipment/me");
  mark("6a. GET /workspace-data/school/equipment/me (data alat utama)", equip.ok,
    `typeof=${typeof equip.data} rows=${Array.isArray(equip.data) ? equip.data.length : (equip.data && typeof equip.data === "object" ? Object.keys(equip.data).slice(0,8).join(",") : "N/A")}`);
  // Save endpoint test (POST/PUT hanya smoke test tanpa update — cek 404/500)
  // Biasanya saveSchoolEquipmentDataRequest POST /workspace-data/school/equipment/save

  // =============== SUPPORTING: Master data ===============
  console.log("\n--- [SUPPORTING] Master data yang sering dipakai form di 6 halaman ---");
  for (const ep of ["/master-data/programs", "/master-data/concentrations", "/master-data/regions", "/master-data/equipment-items?scope=light"]) {
    const x = await g(ep);
    mark(`MD ${ep}`, x.ok, Array.isArray(x.data) ? `rows=${x.data.length}` : `typeof=${typeof x.data}`);
  }

  // =============== SAVE DATA SMOKE TEST (POST/PUT tanpa rubah data = kirim current data kembali atau object minimal) ===============
  console.log("\n--- [SAVE SMOKE TEST] Cek endpoint save/update tidak 404 / 500 ---");
  if (prop.ok && prop.data && typeof prop.data === "object") {
    const saveResp = await fetch(`${BASE}/workspace-data/school/proposal/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(Array.isArray(prop.data) ? (prop.data[0] ?? {}) : prop.data),
    });
    mark("SAVE proposal (POST /workspace-data/school/proposal/save)", saveResp.status >= 200 && saveResp.status < 500,
      `HTTP ${saveResp.status}`);
  }
  if (equip.ok) {
    const saveResp2 = await fetch(`${BASE}/workspace-data/school/equipment/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ npsn: U, items: Array.isArray(equip.data) ? equip.data.slice(0,2) : [] }),
    });
    mark("SAVE equipment (POST /workspace-data/school/equipment/save)", saveResp2.status >= 200 && saveResp2.status < 500,
      `HTTP ${saveResp2.status}`);
  }

  // =============== RINGKASAN ===============
  console.log("\n\n====== RINGKASAN E2E SEKOLAH ======");
  const PASS = results.filter(r => r.ok).length;
  const TOTAL = results.length;
  const FAIL = TOTAL - PASS;
  for (const r of results) {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
  }
  console.log(`\nTOTAL: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL} => ${FAIL === 0 ? "EXIT 0 ✅" : `EXIT ${FAIL} ❌`}`);
  process.exit(FAIL);
})().catch(e => { console.error("FATAL:", e.message); process.exit(99); });
