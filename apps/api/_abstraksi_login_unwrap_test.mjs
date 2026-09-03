// Simulasi abstraksi loginRequest seperti api.ts frontend (L263-L276)
// Tujuan: BUKTIKAN bahwa unwrapEnvelope() mengembalikan user.role di ROOT object
// BUKAN di dalam .data lagi (yang menyebabkan use-auth-session L50 role undefined)

const BASE = "http://localhost:3000/api/v1";

function unwrapEnvelope(raw) {
  if (raw && typeof raw === "object" && "data" in raw && Object.prototype.hasOwnProperty.call(raw, "data") && Object.prototype.hasOwnProperty.call(raw, "ok")) {
    return raw.data;
  }
  return raw;
}

async function doLogin(label, username, password) {
  console.log(`\n=== [${label}] Login via REWRITE PORT 3000 ===`);
  const rawResp = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const rawJson = await rawResp.json();
  console.log(`[${label}] RAW envelope keys   ->`, Object.keys(rawJson));
  console.log(`[${label}] RAW data.user.role   ->`, rawJson?.data?.user?.role ?? "TIDAK TERDEFINISI (DI DALAM .data)");

  const session = unwrapEnvelope(rawJson);
  console.log(`[${label}] AFTER unwrap keys    ->`, Object.keys(session));
  console.log(`[${label}] AFTER unwrap .user?.role ->`, session?.user?.role ?? "UNDEFINED ❌");
  console.log(`[${label}] AFTER unwrap token.length > 10 ->`, (session?.token?.length ?? 0) > 10);

  const envelopeStillThere = (session && typeof session === "object" && "ok" in session && "data" in session && typeof (session).data === "object");
  const PASS =
    rawResp.status === 200 &&
    session?.user?.role &&
    typeof session.user.role === "string" &&
    session.token?.length > 10 &&
    !envelopeStillThere;

  console.log(`[${label}] ASSERTION RESULT ===> ${PASS ? "✅ PASS EXIT 0" : "❌ FAIL"}`);
  return { PASS, session, label };
}

(async () => {
  let FAIL = 0;
  try {
    const r1 = await doLogin("ADMIN", "admin", "admin123");
    if (!r1.PASS) FAIL++;
    const r2 = await doLogin("SEKOLAH", "10102743", "Sekolah2026!");
    if (!r2.PASS) FAIL++;

    console.log("\n===============================");
    console.log(`TOTAL ASSERTION: ADMIN=${r1.PASS ? "✅" : "❌"} | SEKOLAH=${r2.PASS ? "✅" : "❌"}`);
    console.log(`FINAL EXIT ===> ${FAIL === 0 ? "EXIT 0" : `EXIT ${FAIL}`}`);
    process.exit(FAIL);
  } catch (e) {
    console.error("FATAL:", e.message);
    process.exit(99);
  }
})();
