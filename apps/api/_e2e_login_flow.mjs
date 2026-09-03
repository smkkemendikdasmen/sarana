const BASE = "http://127.0.0.1:4000/v1";

async function call(label, method, path, opts = {}) {
  const start = Date.now();
  const headers = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = "Bearer " + opts.token;
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  try {
    const r = await fetch(BASE + path, { method, headers, body });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { _raw: text.slice(0, 300) }; }
    const dur = Date.now() - start;
    const ok = data?.ok === true;
    console.log(`[${r.status}] ${dur}ms ${ok ? "✅" : "⚠️"} ${label}`);
    if (!ok) {
      console.log("   PATH   :", method, BASE + path);
      console.log("   CODE   :", data?.error?.code || r.status);
      console.log("   MSG    :", data?.error?.message || (data.error && JSON.stringify(data.error).slice(0,200)) || text.slice(0,200));
      if (data?.error?.stack) console.log("   STACK  :", String(data.error.stack).split("\n").slice(0,3).join("\n            "));
    }
    return { status: r.status, data, ok };
  } catch (e) {
    console.log(`[CONN_ERR] ⚠️ ${label}: ${e.message}`);
    return { status: 0, data: null, ok: false };
  }
}

async function flow(name, loginBody, expectedRole, protectedPaths) {
  console.log(`\n═════════════════════════════════════════════════════════════`);
  console.log(`🧪 FLOW E2E: ${name}`);
  console.log(`═════════════════════════════════════════════════════════════`);

  const login = await call("1. POST /auth/login", "POST", "/auth/login", { body: loginBody });
  if (!login.ok) { console.log("❌ FLOW GAGAL: login tidak berhasil, flow dihentikan"); return; }

  const token = login.data.data.token;
  const user = login.data.data.user;
  console.log(`   → user=${user.username} | role=${user.role} | npsn=${user.npsn || "-"}`);

  if (!user.role) {
    console.log(`   🔴 ASSERT FAIL: role user UNDEFINED di response login (akar error frontend "Cannot read properties of undefined reading role")`);
  } else if (expectedRole && user.role !== expectedRole) {
    console.log(`   🔴 ASSERT FAIL: role tidak sesuai. expect=${expectedRole} actual=${user.role}`);
  } else {
    console.log(`   🟢 ASSERT PASS: role user terdefinisi (${user.role})`);
  }

  const me = await call("2. GET /auth/me", "GET", "/auth/me", { token });
  if (me.ok) {
    const meUser = me.data.data?.user ?? me.data.data;
    if (!meUser?.role) {
      console.log(`   🔴 ASSERT FAIL: /auth/me return user.role UNDEFINED. Full keys: ${Object.keys(me.data.data || {})}`);
    } else if (expectedRole && meUser.role !== expectedRole) {
      console.log(`   🔴 ASSERT FAIL: /auth/me role tidak sesuai. expect=${expectedRole} actual=${meUser.role}`);
    } else {
      console.log(`   🟢 ASSERT PASS: /auth/me role terdefinisi (${meUser.role}) — frontend role undefined error TERATASI`);
    }
  }

  for (const p of protectedPaths) {
    await call(p.label, p.method || "GET", p.path, { token, body: p.body });
  }
}

// === FLOW 1: ADMIN ===
await flow("ROLE ADMIN (admin/admin123)",
  { username: "admin", password: "admin123" },
  "ADMIN",
  [
    { label: "3. GET /dashboards/admin", path: "/dashboards/admin" },
    { label: "4. GET /users (management)", path: "/users" },
    { label: "5. GET /master-data/wilayah/provinsi", path: "/master-data/wilayah/provinsi" },
    { label: "6. GET /master-data/perdirjen-equipment", path: "/master-data/perdirjen-equipment" },
    { label: "7. GET /workspace-data/admin/selection?scope=light", path: "/workspace-data/admin/selection?scope=light" },
    { label: "8. GET /school-profile/list-concentrations-summary", path: "/school-profile/list-concentrations-summary" },
  ]
);

// === FLOW 2: SEKOLAH ===
await flow("ROLE SEKOLAH (10102743/Sekolah2026!)",
  { username: "10102743", password: "Sekolah2026!" },
  "SEKOLAH",
  [
    { label: "3. GET /dashboards/sekolah", path: "/dashboards/sekolah" },
    { label: "4. GET /school-profile/me", path: "/school-profile/me" },
    { label: "5. GET /school-profile/me/administrative-documents", path: "/school-profile/me/administrative-documents" },
    { label: "6. GET /workspace-data/school-proposals/me", path: "/workspace-data/school-proposals/me" },
    { label: "7. GET /workspace-data/school-equipment/me", path: "/workspace-data/school-equipment/me" },
    { label: "8. GET /master-data/perdirjen-equipment", path: "/master-data/perdirjen-equipment" },
    { label: "9. GET /workspace-data/assignments?moduleKey=bimbingan-teknis", path: "/workspace-data/assignments?moduleKey=bimbingan-teknis" },
  ]
);

console.log("\n🧪 E2E SELESAI");
