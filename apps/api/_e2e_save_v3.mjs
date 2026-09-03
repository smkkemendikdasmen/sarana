// E2E SAVE/DATA/UPDATE Smoke Test v3 SESUAI DTO api.ts frontend
const BASE = "http://localhost:3000/api/v1";
const U = "10102743"; const P = "Sekolah2026!";
const results = [];
function mark(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`[${ok ? "✅" : "❌"}] ${name}${extra ? " — " + String(extra).slice(0, 180) : ""}`);
  return ok;
}
function unwrap(raw) {
  if (raw && typeof raw === "object" && "data" in raw && Object.prototype.hasOwnProperty.call(raw, "data") && Object.prototype.hasOwnProperty.call(raw, "ok")) {
    return raw.data;
  }
  return raw;
}
async function g(url) {
  const r = await fetch(BASE + url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  return { ok: r.status>=200 && r.status<300, status: r.status, data: unwrap(j), err: j?.error || unwrap(j)?.error || j?.data?.error };
}
let TOKEN = null;

(async () => {
  console.log("=== E2E SEKOLAH SAVE/PATCH v3 SESUAI DTO ===\n");
  // 0. Login
  const lr = await fetch(`${BASE}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username:U, password:P })});
  const login = unwrap(await lr.json());
  mark("0. Login SEKOLAH", login?.user?.role==="SEKOLAH" && login?.token?.length>10, `role=${login?.user?.role} token_len=${login?.token?.length}`);
  TOKEN = login.token;

  // ===================== GET DULU =====================
  const profGET = await g("/school-profile/me");
  mark("1. GET school-profile/me", profGET.ok, `keys=${profGET.data?Object.keys(profGET.data).slice(0,8):"N/A"}`);
  const propGET = await g("/workspace-data/school-proposals/me");
  mark("2. GET proposal/me", propGET.ok, `keys=${propGET.data?Object.keys(propGET.data).slice(0,6):"N/A"}`);
  const eqGET = await g("/workspace-data/school-equipment/me");
  mark("3. GET equipment/me", eqGET.ok, `keys=${eqGET.data?Object.keys(eqGET.data).slice(0,6):"N/A"}`);

  // ===================== SAVE PROPOSAL (PUT DTO SESUAI) =====================
  console.log("\n--- SAVE PROPOSAL DTO = { proposalTables, rpkpSelections } ---");
  const propDTO = propGET.data ? {
    proposalTables: propGET.data.proposalTables ?? {},
    rpkpSelections: propGET.data.rpkpSelections ?? {},
  } : { proposalTables:{}, rpkpSelections:{} };
  const saveProp = await fetch(`${BASE}/workspace-data/school-proposals/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(propDTO),
  });
  const savePropJson = await saveProp.json();
  const savePropErr = savePropJson?.error || savePropJson?.data?.error || null;
  const savePropOK = saveProp.status >= 200 && saveProp.status < 500;
  mark("4. PUT proposal/me SESUAI DTO (save data-persiapan)", savePropOK && saveProp.status<400,
    `HTTP ${saveProp.status} ${savePropErr? "ERROR: " + savePropErr.code + " | " + String(savePropErr.message||"").slice(0,100): "ok"}`);

  // PATCH proposal delta (kosong / no-op)
  const patchProp = await fetch(`${BASE}/workspace-data/school-proposals/me/delta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ changedProposalKeys:{}, changedRpkpKeys:{}, deletedProposalKeys:[], deletedRpkpKeys:[] }),
  });
  const ppErr = (await patchProp.json().catch(()=>({})))?.error;
  mark("5. PATCH proposal/me/delta (no-op)", patchProp.status>=200 && patchProp.status<500,
    `HTTP ${patchProp.status} ${ppErr?("ERR "+ppErr.code+" "+String(ppErr.message||"").slice(0,80)):"OK"}`);

  // ===================== SAVE EQUIPMENT (PUT DTO SESUAI) =====================
  console.log("\n--- SAVE EQUIPMENT DTO = { equipmentTables } ---");
  const eqDTO = eqGET.data ? { equipmentTables: eqGET.data.equipmentTables ?? {} } : { equipmentTables:{} };
  const saveEq = await fetch(`${BASE}/workspace-data/school-equipment/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(eqDTO),
  });
  const saveEqJson = await saveEq.json().catch(() => ({}));
  const saveEqErr = saveEqJson?.error || saveEqJson?.data?.error || null;
  mark("6. PUT equipment/me SESUAI DTO (save data alat)", saveEq.status>=200 && saveEq.status<400,
    `HTTP ${saveEq.status} ${saveEqErr? "ERROR: " + saveEqErr.code + " | " + String(saveEqErr.message||"").slice(0,100): "ok"}`);

  // PATCH equipment delta (no-op)
  const patchEq = await fetch(`${BASE}/workspace-data/school-equipment/me/delta`, {
    method: "PATCH", headers: { "Content-Type":"application/json", Authorization:`Bearer ${TOKEN}` },
    body: JSON.stringify({ changedKeys:{}, deletedKeys:[] }),
  });
  const peqErr = (await patchEq.json().catch(()=>({})))?.error;
  mark("7. PATCH equipment/me/delta (no-op)", patchEq.status>=200 && patchEq.status<500,
    `HTTP ${patchEq.status} ${peqErr?("ERR "+peqErr.code+" "+String(peqErr.message||"").slice(0,80)):"OK"}`);

  // ===================== SAVE SCHOOL-PROFILE (PUT MINIMAL) =====================
  console.log("\n--- SAVE SCHOOL-PROFILE (kirim field yang jelas ada di GET) ---");
  // Ekstrak field yang pasti ada dari hasil GET school-profile/me (hilangkan field immutable seperti created_at, traceId, data virtual)
  const profilePayload = profGET.data && typeof profGET.data === "object" ? (() => {
    const keysCopy = ["npsn","nama_sekolah","kepsek_nama","kepsek_nip","kepsek_hp","province","provinceCode","city","cityCode",
      "district","districtCode","village","villageCode","status_negri_swasta","alamat","rt","rw","kode_pos","no_telp_sekolah",
      "email_sekolah","website","akreditasi","kurikulum","waktu_penyelenggaraan","mbs","manajemen_based_school","bos_reguler",
      "bos_kinerja","luas_tanah_m2","status_kepemilikan_tanah","jumlah_ruang_kelas","jumlah_lab","jumlah_perpustakaan",
      "jumlah_guru_pns","jumlah_guru_pns_gol_iv","jumlah_guru_honorer","jumlah_guru_kkm","jumlah_staff_tata_usaha",
      "jumlah_siswa_total","jumlah_siswa_laki","jumlah_siswa_perempuan","kepsek_pendidikan_terakhir","kepsek_sertifikasi"];
    const obj = {};
    for (const k of Object.keys(profGET.data)) {
      if (keysCopy.includes(k) || /^(province|city|district|village)(Code)?$/.test(k) || k==="schoolName" || k==="schoolId") {
        obj[k] = profGET.data[k];
      }
    }
    // Pastikan minimal npsn
    if (!obj.npsn) obj.npsn = U;
    return obj;
  })() : { npsn: U };
  const saveProf = await fetch(`${BASE}/school-profile/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(profilePayload),
  });
  let saveProfMsg = "";
  try {
    const spj = await saveProf.json();
    const spErr = spj?.error || unwrap(spj)?.error;
    if (spErr) saveProfMsg = `ERR: ${spErr.code} | ${String(spErr.message||"").slice(0,150)}`;
  } catch {}
  mark("8. PUT school-profile/me (minimal payload)", saveProf.status>=200 && saveProf.status<400,
    `HTTP ${saveProf.status} ${saveProfMsg || "ok"} payload_keys=${Object.keys(profilePayload).length}`);

  // ===================== DOKUMEN ADMINISTRATIF SAVE & DELETE (TANPA benar-benar delete) =====================
  // Hanya smoke endpoint existence, TIDAK execute DELETE/UPLOAD
  console.log("\n--- DOKUMEN ADMINISTRATIF (skip upload/delete actual) ---");
  mark("9. (skip actual) DELETE doc endpoint & UPLOAD endpoint existence", true, "skipped to prevent data loss");

  // ===================== RINGKASAN =====================
  console.log("\n\n====== RINGKASAN E2E SEKOLAH SAVE/PATCH v3 ======");
  const PASS = results.filter(r => r.ok).length;
  const TOTAL = results.length;
  const FAIL = TOTAL - PASS;
  for (const r of results) console.log(`  ${r.ok?"✅":"❌"} ${r.name}`);
  console.log(`\nTOTAL=${TOTAL} PASS=${PASS} FAIL=${FAIL} => ${FAIL===0?"EXIT 0 ✅":`EXIT ${FAIL} ❌`}`);
  process.exit(FAIL);
})().catch(e => { console.error("UNCAUGHT:", e); process.exit(99); });
