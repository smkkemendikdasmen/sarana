import test from "node:test";
import assert from "node:assert/strict";

import { AuthService } from "./auth.service.js";
import { DatabaseService } from "../database/database.service.js";

async function createService() {
  const databaseService = new DatabaseService();
  await databaseService.onModuleInit();

  const authService = new AuthService(databaseService);
  await authService.onModuleInit();

  return { authService, databaseService };
}

test("login berhasil untuk superadmin", async () => {
  const { authService, databaseService } = await createService();
  const result = await authService.login("superadmin", "superadmin");

  assert.equal(result.user.role, "SUPERADMIN");
  assert.ok(result.token.length > 20);

  await databaseService.onModuleDestroy();
});

test("login gagal jika kredensial salah", async () => {
  const { authService, databaseService } = await createService();

  await assert.rejects(() => authService.login("superadmin", "salah"));

  await databaseService.onModuleDestroy();
});

test("register sekolah berhasil dan menghasilkan role sekolah", async () => {
  const { authService, databaseService } = await createService();
  const uniqueKey = Date.now().toString();
  const result = await authService.registerSchool({
    schoolName: "SMK Negeri Integrasi",
    npsn: uniqueKey.slice(-8),
    province: "Jawa Barat",
    contactName: "Operator Sekolah",
    email: "operator@smk.id",
    username: `smk.integrasi.${uniqueKey}`,
    password: "password123",
  });

  assert.equal(result.user.role, "SEKOLAH");
  assert.equal(result.user.organization, "SMK Negeri Integrasi");

  await databaseService.onModuleDestroy();
});

test("register sekolah gagal bila username sudah dipakai", async () => {
  const { authService, databaseService } = await createService();

  await assert.rejects(() =>
    authService.registerSchool({
      schoolName: "SMK Duplikat",
      npsn: "87654321",
      province: "Jawa Timur",
      contactName: "PIC Sekolah",
      email: "baru@smk.id",
      username: "superadmin",
      password: "password123",
    }),
  );

  await databaseService.onModuleDestroy();
});
