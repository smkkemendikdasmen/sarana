const BASE3K = "http://127.0.0.1:3000/api/v1";
(async () => {
  console.log("=== FLOW VIA REWRITE PORT 3000 (frontend) ===");
  // Login admin dulu via rewrite 3000
  const loginAdmin = await fetch(BASE3K + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const la = await loginAdmin.json();
  console.log("[3000] ADMIN login status:", loginAdmin.status, "ok:", la.ok);
  console.log("[3000] ADMIN role di login response:", JSON.stringify(la?.data?.user?.role));
  const tokA = la?.data?.token;
  // Login sekolah via rewrite 3000
  const loginSek = await fetch(BASE3K + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "10102743", password: "Sekolah2026!" }),
  });
  const ls = await loginSek.json();
  console.log("[3000] SEKOLAH login status:", loginSek.status, "ok:", ls.ok);
  console.log("[3000] SEKOLAH role di login response:", JSON.stringify(ls?.data?.user?.role));
  const tokS = ls?.data?.token;

  // GET /auth/me via rewrite port 3000 admin
  const meA = await fetch(BASE3K + "/auth/me", {
    headers: { Authorization: "Bearer " + tokA },
  });
  const ma = await meA.json();
  console.log("[3000] ADMIN /auth/me status:", meA.status, "ok:", ma.ok);
  console.log("[3000] ADMIN /auth/me data FULL:", JSON.stringify(ma.data, null, 2));
  console.log("[3000] ADMIN /auth/me data.user?.role:", JSON.stringify(ma?.data?.user?.role));

  // GET /auth/me via rewrite port 3000 sekolah
  const meS = await fetch(BASE3K + "/auth/me", {
    headers: { Authorization: "Bearer " + tokS },
  });
  const ms = await meS.json();
  console.log("[3000] SEKOLAH /auth/me status:", meS.status, "ok:", ms.ok);
  console.log("[3000] SEKOLAH /auth/me data FULL:", JSON.stringify(ms.data, null, 2));
  console.log("[3000] SEKOLAH /auth/me data.user?.role:", JSON.stringify(ms?.data?.user?.role));
})();
