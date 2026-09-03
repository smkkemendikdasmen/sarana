import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  database: "saranasmk_local_latest",
  user: "ilahilah",
});

const schoolUsername = "10102743";
const newPwd = "Sekolah2026!";

const existing = await pool.query(
  "SELECT id, username, full_name, npsn FROM users WHERE username=$1 LIMIT 1",
  [schoolUsername],
);

if (existing.rows.length === 0) {
  console.log("❌ User sekolah npsn " + schoolUsername + " TIDAK DITEMUKAN");
  process.exit(1);
}

const userData = existing.rows[0];
const hash = await bcrypt.hash(newPwd, 10);
await pool.query(
  "UPDATE users SET password_hash=$1, password_default_plaintext=$2, password_changed_at=NOW() WHERE id=$3",
  [hash, newPwd, userData.id],
);

console.log("✅ Reset password sekolah sukses");
console.log("   Username :", userData.username);
console.log("   NPSN     :", userData.npsn);
console.log("   FullName :", userData.full_name);
console.log("   Password :", newPwd);

await pool.end();
