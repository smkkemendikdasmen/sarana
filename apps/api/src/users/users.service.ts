import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";

import type { UserRole } from "../common/constants/roles.js";
import { DatabaseService, type DialectConnection } from "../database/database.service.js";

type PoolConnection = DialectConnection;

function generateStrongPassword(length = 16) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%^&";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += charset[bytes[i] % charset.length]!;
  }
  return out;
}

interface InfoSchemaColumnRow extends RowDataPacket {
  column_name: string;
}

interface InfoSchemaIndexRow extends RowDataPacket {
  index_name: string;
}

interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  full_name: string;
  role_code: string;
  role_name: string;
  school_id: string | null;
  npsn: string | null;
  school_name: string | null;
  is_active: number;
  created_at: string;
  email: string | null;
  password_default_plaintext: string | null;
  password_current_plaintext: string | null;
  password_changed_at: string | null;
}

interface RoleRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
}

interface SchoolRow extends RowDataPacket {
  id: string;
  name: string;
  npsn: string;
  prov_nama: string | null;
  kota_nama: string | null;
}

interface ExistingUserRow extends RowDataPacket {
  id: string;
}

interface UserPayload {
  username: string;
  fullName: string;
  roleCode: string;
  schoolId: string | null;
  password?: string;
  isActive: boolean;
  email?: string | null;
  passwordDefaultPlaintext?: string | null;
  passwordCurrentPlaintext?: string | null;
  passwordChangedAt?: string | null;
  resetPasswordToDefault?: boolean;
}

const PASSWORD_CURRENT_EXPOSE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "SUPERADMIN",
  "ADMIN",
]);

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private static _globalSingletonInstance: UsersService | null = null;

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) UsersService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): UsersService | null {
    const inst = UsersService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): UsersService {
    const existing = UsersService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new UsersService(db);
    UsersService._globalSingletonInstance = fresh;
    return fresh;
  }

  async onModuleInit() {
    try {
      await this.ensureUsersSchemaReady();
    } catch (error) {
      const err = error as Error & { message?: string };
      this.logger.error("Gagal bootstrap schema tabel users (non-fatal): " + (err?.message ?? String(error)));
    }
  }

  private async ensureUsersSchemaReady() {
    const existingColumns = new Set<string>();
    try {
      const cols = await this.databaseService.query<InfoSchemaColumnRow[]>(
        `SELECT COLUMN_NAME AS column_name
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
      );
      for (const c of cols) existingColumns.add(String(c.column_name ?? "").toLowerCase());
    } catch {
      existingColumns.clear();
    }

    const addColumnIfMissing = async (columnName: string, definition: string) => {
      if (existingColumns.size > 0 && existingColumns.has(columnName.toLowerCase())) return;
      try {
        await this.databaseService.query(
          `ALTER TABLE users ADD COLUMN ${columnName} ${definition}`,
          [],
        );
        this.logger.log(`✅ Kolom users.${columnName} berhasil ditambahkan otomatis.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/Duplicate column name|already exists/i.test(msg)) {
          this.logger.verbose(`ℹ️ Kolom users.${columnName} sudah ada, skip.`);
        } else {
          this.logger.warn(`⚠️ Gagal tambah kolom users.${columnName}: ${msg}`);
          throw err;
        }
      }
    };

    await addColumnIfMissing("school_id", "CHAR(26) NULL");
    await addColumnIfMissing("email", "VARCHAR(255) NULL");
    await addColumnIfMissing("password_default_plaintext", "VARCHAR(255) NULL");
    await addColumnIfMissing("password_current_plaintext", "VARCHAR(255) NULL");
    await addColumnIfMissing("password_changed_at", "TIMESTAMP NULL");

    const addIndexIfMissing = async (indexName: string, definition: string) => {
      if (existingColumns.size > 0) {
        try {
          const idx = await this.databaseService.query<InfoSchemaIndexRow[]>(
            `SELECT INDEX_NAME AS index_name
             FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = ?
             LIMIT 1`,
            [indexName],
          );
          if (idx.length > 0) return;
        } catch {
          /* fallback try create dan catch duplicate */
        }
      }
      try {
        await this.databaseService.query(`CREATE INDEX ${indexName} ON users ${definition}`, []);
        this.logger.log(`✅ Index ${indexName} pada tabel users berhasil dibuat otomatis.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/Duplicate key name|already exists|Duplicate entry/i.test(msg)) {
          this.logger.verbose(`ℹ️ Index ${indexName} sudah ada, skip.`);
        } else {
          this.logger.warn(`⚠️ Gagal buat index ${indexName}: ${msg}`);
        }
      }
    };

    await addIndexIfMissing("idx_users_username", "(username)");
    await addIndexIfMissing("idx_users_school_id", "(school_id)");
    await addIndexIfMissing("idx_users_email", "(email)");
    await addIndexIfMissing("idx_users_password_changed_at", "(password_changed_at)");
    await addIndexIfMissing("idx_users_is_active", "(is_active)");

    const ensureGenericIndexIfMissing = async (
      tableName: string,
      indexName: string,
      createSql: string,
    ) => {
      try {
        const idx = await this.databaseService.query<InfoSchemaIndexRow[]>(
          `SELECT INDEX_NAME AS index_name
           FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
           LIMIT 1`,
          [tableName, indexName],
        );
        if (idx.length > 0) return;
      } catch {
        /* fallback jalankan dan catch */
      }
      try {
        await this.databaseService.query(createSql, []);
        this.logger.log(`✅ Index ${tableName}.${indexName} dibuat otomatis.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/Duplicate key name|already exists|Duplicate entry/i.test(msg)) {
          this.logger.verbose(`ℹ️ Index ${tableName}.${indexName} gagal (non-fatal): ${msg}`);
        }
      }
    };

    await ensureGenericIndexIfMissing(
      "schools",
      "idx_schools_npsn_unique",
      "CREATE UNIQUE INDEX idx_schools_npsn_unique ON schools (npsn)",
    );
    await ensureGenericIndexIfMissing(
      "schools",
      "idx_schools_name",
      "CREATE INDEX idx_schools_name ON schools (name)",
    );
    await ensureGenericIndexIfMissing(
      "schools",
      "idx_schools_verification_status",
      "CREATE INDEX idx_schools_verification_status ON schools (verification_status)",
    );
    await ensureGenericIndexIfMissing(
      "user_roles",
      "idx_user_roles_role_id",
      "CREATE INDEX idx_user_roles_role_id ON user_roles (role_id)",
    );
    await ensureGenericIndexIfMissing(
      "user_roles",
      "idx_user_roles_user_id_role_id",
      "CREATE UNIQUE INDEX idx_user_roles_user_id_role_id ON user_roles (user_id, role_id)",
    );
    await ensureGenericIndexIfMissing(
      "roles",
      "idx_roles_code_unique",
      "CREATE UNIQUE INDEX idx_roles_code_unique ON roles (code)",
    );
    await ensureGenericIndexIfMissing(
      "school_profile_concentrations",
      "idx_spc_school_id_concentration_code",
      "CREATE UNIQUE INDEX idx_spc_school_id_concentration_code ON school_profile_concentrations (school_id, concentration_code)",
    );
    await ensureGenericIndexIfMissing(
      "workspace_school_assignments",
      "idx_ws_assign_fasilitator_admin",
      "CREATE INDEX idx_ws_assign_fasilitator_admin ON workspace_school_assignments (facilitator_administration_id)",
    );
    await ensureGenericIndexIfMissing(
      "workspace_school_assignments",
      "idx_ws_assign_fasilitator_equipment",
      "CREATE INDEX idx_ws_assign_fasilitator_equipment ON workspace_school_assignments (facilitator_equipment_id)",
    );
    await ensureGenericIndexIfMissing(
      "workspace_school_assignments",
      "idx_ws_assign_module_source_school",
      "CREATE INDEX idx_ws_assign_module_source_school ON workspace_school_assignments (module_key, source_tab, school_npsn)",
    );
    await ensureGenericIndexIfMissing(
      "workspace_school_assignments",
      "idx_ws_assign_school_npsn",
      "CREATE INDEX idx_ws_assign_school_npsn ON workspace_school_assignments (school_npsn)",
    );
  }

  async getManagementData(requestorRole?: UserRole) {
    const [users, roles, schools] = await Promise.all([
      this.getUsers(requestorRole),
      this.getRoles(),
      this.getSchools(),
    ]);

    return { users, roles, schools };
  }

  async createUser(payload: UserPayload) {
    return this.databaseService.transaction(async (connection) => {
      await this.ensureUsernameAvailable(connection, payload.username);
      const role = await this.getRoleByCode(connection, payload.roleCode);
      const normalizedSchoolId = await this.normalizeOrCreateSchoolId(
        connection,
        payload.roleCode,
        payload.schoolId,
        payload.username.trim(),
        payload.fullName.trim(),
      );

      const userId = createId();
      const defaultOverride = String(payload.passwordDefaultPlaintext ?? "").trim();
      const plainPassword =
        payload.roleCode === "SEKOLAH"
          ? (defaultOverride || generateStrongPassword(16))
          : (payload.password ?? "").trim() || generateStrongPassword(16);
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      await connection.execute(
        `
          INSERT INTO users (
            id,
            username,
            password_hash,
            full_name,
            email,
            password_default_plaintext,
            password_current_plaintext,
            password_changed_at,
            school_id,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          payload.username.trim().toLowerCase(),
          passwordHash,
          payload.fullName.trim(),
          payload.email && payload.email.trim() ? payload.email.trim().toLowerCase() : null,
          plainPassword || null,
          null,
          null,
          normalizedSchoolId,
          payload.isActive ? 1 : 0,
        ],
      );

      await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, role.id]);

      return this.getUserById(userId, connection);
    });
  }

  async updateUser(userId: string, payload: UserPayload) {
    return this.databaseService.transaction(async (connection) => {
      const existing = await this.getUserById(userId, connection);
      if (!existing) {
        throw new NotFoundException("Pengguna tidak ditemukan.");
      }

      await this.ensureUsernameAvailable(connection, payload.username, userId);
      const role = await this.getRoleByCode(connection, payload.roleCode);
      const normalizedSchoolId = await this.normalizeOrCreateSchoolId(
        connection,
        payload.roleCode,
        payload.schoolId,
        payload.username.trim(),
        payload.fullName.trim(),
      );

      const normalizedEmail =
        payload.email && payload.email.trim() ? payload.email.trim().toLowerCase() : payload.email === null ? null : undefined;

      if (payload.password?.trim()) {
        const plainPassword = payload.password.trim();
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        if (payload.resetPasswordToDefault) {
          await connection.execute(
            `
              UPDATE users
              SET username = ?, full_name = ?, email = COALESCE(?, email), school_id = ?, is_active = ?, password_hash = ?,
                  password_default_plaintext = COALESCE(?, password_default_plaintext),
                  password_current_plaintext = NULL,
                  password_changed_at = NULL
              WHERE id = ?
            `,
            [
              payload.username.trim().toLowerCase(),
              payload.fullName.trim(),
              normalizedEmail ?? null,
              normalizedSchoolId,
              payload.isActive ? 1 : 0,
              passwordHash,
              plainPassword,
              userId,
            ],
          );
        } else {
          await connection.execute(
            `
              UPDATE users
              SET username = ?, full_name = ?, email = COALESCE(?, email), school_id = ?, is_active = ?, password_hash = ?,
                  password_current_plaintext = ?,
                  password_changed_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [
              payload.username.trim().toLowerCase(),
              payload.fullName.trim(),
              normalizedEmail ?? null,
              normalizedSchoolId,
              payload.isActive ? 1 : 0,
              passwordHash,
              plainPassword,
              userId,
            ],
          );
        }
      } else {
        await connection.execute(
          `
            UPDATE users
            SET username = ?, full_name = ?, email = COALESCE(?, email), school_id = ?, is_active = ?
            WHERE id = ?
          `,
          [
            payload.username.trim().toLowerCase(),
            payload.fullName.trim(),
            normalizedEmail ?? null,
            normalizedSchoolId,
            payload.isActive ? 1 : 0,
            userId,
          ],
        );
      }

      await connection.execute("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, role.id]);

      return this.getUserById(userId, connection);
    });
  }

  async deleteUser(userId: string) {
    return this.databaseService.transaction(async (connection) => {
      const existing = await this.getUserById(userId, connection);
      if (!existing) {
        throw new NotFoundException("Pengguna tidak ditemukan.");
      }

      await connection.execute("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await connection.execute("DELETE FROM users WHERE id = ?", [userId]);

      return { success: true };
    });
  }

  async resetPasswordToDefault(userId: string) {
    return this.databaseService.transaction(async (connection) => {
      const existing = await this.getUserById(userId, connection);
      if (!existing) {
        throw new NotFoundException("Pengguna tidak ditemukan.");
      }
      const newPassword = generateStrongPassword(16);
      return this.updateUser(userId, {
        username: existing.username,
        fullName: existing.fullName,
        roleCode: existing.roleCode,
        schoolId: existing.schoolId ?? null,
        isActive: existing.isActive,
        password: newPassword,
        resetPasswordToDefault: true,
      }).then((user) => ({ user, newPassword }));
    });
  }

  async resetAllSekolahPasswordToDefault() {
    return this.databaseService.transaction(async (connection) => {
      const [sekolahUsersRaw] = await connection.query(
        `
          SELECT DISTINCT u.id, u.username
          FROM users u
          INNER JOIN user_roles ur ON ur.user_id = u.id
          INNER JOIN roles r ON r.id = ur.role_id
          WHERE r.code = 'SEKOLAH'
          ORDER BY u.username ASC
        `,
        [],
      );
      const sekolahUsers: Array<{ id: string; username: string | null }> = (
        Array.isArray(sekolahUsersRaw) ? sekolahUsersRaw : []
      ) as unknown as Array<{ id: string; username: string | null }>;
      const totalFound = sekolahUsers.length;
      let totalReset = 0;
      let totalFailed = 0;
      const gagalIds: Array<{ id: string; username: string; error: string }> = [];
      this.logger.verbose(
        `[ResetAllSekolah] Ditemukan ${totalFound} akun role SEKOLAH. Akan di-update per-id dengan password RANDOM unik per sekolah (TIDAK ada password umum).`,
      );
      if (totalFound > 0) {
        for (const sekolahUser of sekolahUsers) {
          try {
            const id = String(sekolahUser.id ?? "").trim();
            if (!id) continue;
            const newPassword = generateStrongPassword(16);
            const passwordHash = await bcrypt.hash(newPassword, 10);
            const [updateResultAny] = await connection.query(
              `
                UPDATE users
                SET
                  password_hash = ?,
                  password_default_plaintext = ?,
                  password_current_plaintext = NULL,
                  password_changed_at = NULL
                WHERE id = ?
              `,
              [passwordHash, newPassword, id],
            );
            const updateResult = (updateResultAny ?? []) as unknown as Array<{ affectedRows?: number }>;
            const affected = Number(updateResult[0]?.affectedRows ?? 0);
            if (affected > 0) {
              totalReset += 1;
            } else {
              totalFailed += 1;
              gagalIds.push({ id, username: String(sekolahUser.username ?? "-"), error: "0 rows affected (id tidak ditemukan)." });
            }
          } catch (err) {
            totalFailed += 1;
            const msg = err instanceof Error ? err.message : String(err);
            gagalIds.push({
              id: String(sekolahUser.id ?? "-"),
              username: String(sekolahUser.username ?? "-"),
              error: msg,
            });
          }
        }
      }
      this.logger.log(
        `[ResetAllSekolah] ✅ SELESAI. Ditemukan=${totalFound}, Berhasil di-reset=${totalReset} (PASSWORD UNIK per sekolah), Gagal=${totalFailed}.`,
      );
      return {
        totalFound,
        totalReset,
        totalFailed,
        gagalIds,
        resetAllSekolahSharedPassword: null,
      };
    });
  }

  async bulkSetActiveByRoleCode(roleCode: string, isActive: boolean) {
    const roleCodeClean = String(roleCode ?? "").trim().toUpperCase();
    if (!roleCodeClean) {
      throw new BadRequestException("Role code wajib diisi untuk bulk set active.");
    }
    return this.databaseService.transaction(async (connection) => {
      const [foundRaw] = await connection.query(
        `
          SELECT COUNT(DISTINCT u.id) AS cnt
          FROM users u
          INNER JOIN user_roles ur ON ur.user_id = u.id
          INNER JOIN roles r ON r.id = ur.role_id
          WHERE r.code = ?
        `,
        [roleCodeClean],
      );
      const foundRow = ((Array.isArray(foundRaw) ? foundRaw[0] : undefined) ?? {}) as { cnt?: number };
      const totalFound = Number(foundRow?.cnt ?? 0);
      const [updateResultAny] = await connection.query(
        `
          UPDATE users u
          INNER JOIN user_roles ur ON ur.user_id = u.id
          INNER JOIN roles r ON r.id = ur.role_id
          SET u.is_active = ?
          WHERE r.code = ?
        `,
        [isActive ? 1 : 0, roleCodeClean],
      );
      const updateResult = (Array.isArray(updateResultAny) ? updateResultAny[0] : undefined) as {
        affectedRows?: number;
        changedRows?: number;
      };
      const affected = Number(updateResult?.affectedRows ?? 0);
      const changed = Number(updateResult?.changedRows ?? 0);
      this.logger.log(
        `[BulkSetActive role=${roleCodeClean} to=${isActive ? 1 : 0}] Found=${totalFound}, Affected=${affected}, Changed=${changed}.`,
      );
      return {
        ok: true,
        roleCode: roleCodeClean,
        toIsActive: isActive,
        totalFound,
        totalAffected: affected,
        totalChanged: changed,
      };
    });
  }

  async changePasswordFirstTime(
    userId: string,
    payload: {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
      email: string;
    },
  ) {
    return this.databaseService.transaction(async (connection) => {
      const existingRow = await this.findUserRowByIdForAuth(connection, userId);
      if (!existingRow) {
        throw new NotFoundException("Pengguna tidak ditemukan.");
      }

      if (existingRow.role_code !== "SEKOLAH") {
        throw new BadRequestException("Endpoint ini hanya untuk akun SEKOLAH pada login pertama.");
      }

      const passwordMatches = await bcrypt.compare(
        payload.oldPassword?.trim() ?? "",
        existingRow.password_hash,
      );
      if (!passwordMatches) {
        throw new BadRequestException("Password lama (default) yang Anda masukkan tidak sesuai.");
      }

      const errors = validateStrongPassword(payload.newPassword ?? "");
      if (errors.length > 0) {
        throw new BadRequestException(errors[0]);
      }

      if ((payload.newPassword ?? "").trim() !== (payload.confirmPassword ?? "").trim()) {
        throw new BadRequestException("Password baru dan Konfirmasi Password Baru tidak sama. Silakan coba kembali.");
      }

      const email = payload.email?.trim() ?? "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException("Format email tidak valid. Silakan periksa kembali alamat email Anda.");
      }

      const finalPassword = payload.newPassword.trim();
      const passwordHash = await bcrypt.hash(finalPassword, 10);
      await connection.execute(
        `
          UPDATE users
          SET password_hash = ?,
              password_current_plaintext = ?,
              password_changed_at = CURRENT_TIMESTAMP,
              email = ?
          WHERE id = ?
        `,
        [passwordHash, finalPassword, email.toLowerCase(), userId],
      );

      const updated = await this.getUserById(userId, connection);
      return { success: true, user: updated };
    });
  }

  private async findUserRowByIdForAuth(connection: PoolConnection, userId: string) {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        s.npsn AS npsn,
        u.is_active,
        u.email,
        u.password_changed_at,
        r.code AS role_code,
        r.name AS role_name,
        s.name AS school_name,
        s.province_code,
        s.city_code
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn)
      WHERE u.id = ?
      ORDER BY ur.role_id ASC
      LIMIT 1
    `;
    const [rows] = await connection.query<
      Array<
        RowDataPacket & {
          id: string;
          username: string;
          password_hash: string;
          full_name: string;
          npsn: string | null;
          is_active: number;
          email: string | null;
          password_changed_at: string | null;
          role_code: string;
          role_name: string;
          school_name: string | null;
          province_code: string | null;
          city_code: string | null;
        }
      >
    >(sql, [userId]);
    return rows[0] ?? null;
  }

  private sanitizeUserRow(row: UserRow, requestorRole?: UserRole) {
    const exposePasswordCurrent =
      requestorRole !== undefined && PASSWORD_CURRENT_EXPOSE_ROLES.has(requestorRole);

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      passwordDefault: row.password_default_plaintext,
      passwordCurrent: exposePasswordCurrent ? (row.password_current_plaintext ?? null) : undefined,
      passwordChangedAt: row.password_changed_at,
      mustChangePassword: row.role_code === "SEKOLAH" && row.password_changed_at === null,
      roleCode: row.role_code,
      roleName: row.role_name,
      npsn: row.npsn,
      schoolId: row.school_id,
      schoolName: row.school_name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    };
  }

  private async getUsers(requestorRole?: UserRole) {
    const rows = await this.databaseService.query<UserRow[]>(`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.password_default_plaintext,
        u.password_current_plaintext,
        u.password_changed_at,
        r.code AS role_code,
        r.name AS role_name,
        s.npsn AS npsn,
        s.name AS school_name,
        u.is_active,
        u.created_at
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn)
      ORDER BY u.created_at DESC, u.username ASC
    `);

    return rows.map((row) => this.sanitizeUserRow(row, requestorRole));
  }

  private async getRoles() {
    const rows = await this.databaseService.query<RoleRow[]>("SELECT id, code, name FROM roles ORDER BY id ASC");
    return rows.map((row) => ({ id: row.id, code: row.code, name: row.name }));
  }

  private async getSchools() {
    const rows = await this.databaseService.query<SchoolRow[]>(
      `
      SELECT
        s.npsn AS id,
        s.name,
        s.npsn,
        prov_w.nama AS prov_nama,
        kota_w.nama AS kota_nama
      FROM schools s
      LEFT JOIN wilayah prov_w ON CHAR_LENGTH(s.province_code) = 2 AND prov_w.kode = s.province_code
      LEFT JOIN wilayah kota_w ON CHAR_LENGTH(s.city_code) = 5 AND kota_w.kode = s.city_code
      ORDER BY s.name ASC
      `,
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      npsn: row.npsn,
      provinsi: row.prov_nama ?? "",
      kotaKabupaten: row.kota_nama ?? "",
    }));
  }

  private async getUserById(userId: string, connection?: PoolConnection, requestorRole?: UserRole) {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.password_default_plaintext,
        u.password_current_plaintext,
        u.password_changed_at,
        r.code AS role_code,
        r.name AS role_name,
        s.npsn AS npsn,
        s.name AS school_name,
        u.is_active,
        u.created_at
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN schools s ON s.npsn = COALESCE(u.school_id, u.npsn)
      WHERE u.id = ?
      LIMIT 1
    `;

    const rows = connection
      ? (await connection.query<UserRow[]>(sql, [userId]))[0]
      : await this.databaseService.query<UserRow[]>(sql, [userId]);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.sanitizeUserRow(row, requestorRole);
  }

  private async ensureUsernameAvailable(connection: PoolConnection, username: string, exceptUserId?: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const [rows] = await connection.query<ExistingUserRow[]>(
      "SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [normalizedUsername],
    );

    const existing = rows[0];
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException("Username sudah digunakan.");
    }
  }

  private async getRoleByCode(connection: PoolConnection, roleCode: string) {
    const [rows] = await connection.query<RoleRow[]>("SELECT id, code, name FROM roles WHERE code = ? LIMIT 1", [roleCode]);
    const role = rows[0];
    if (!role) {
      throw new NotFoundException("Role pengguna tidak ditemukan.");
    }

    return role;
  }

  private async normalizeOrCreateSchoolId(
    connection: PoolConnection,
    roleCode: string,
    schoolId: string | null,
    username: string,
    fullName: string,
  ) {
    if (roleCode !== "SEKOLAH") {
      return null;
    }

    if (schoolId) {
      const [rows] = await connection.query<SchoolRow[]>("SELECT npsn AS id, name, npsn FROM schools WHERE npsn = ? LIMIT 1", [schoolId]);
      if (!rows[0]) {
        throw new NotFoundException("Sekolah tidak ditemukan.");
      }
      return schoolId;
    }

    // Fallback create sekolah dari username-as-NPSN & fullName-as-school-name
    const npsnCandidate = username.replace(/[^0-9]/g, "");
    if (npsnCandidate.length < 6) {
      throw new NotFoundException("Sekolah wajib dipilih (atau username harus berupa NPSN yang valid).");
    }

    const [existingRows] = await connection.query<SchoolRow[]>(
      "SELECT id, name, npsn FROM schools WHERE npsn = ? LIMIT 1",
      [npsnCandidate],
    );
    if (existingRows[0]) {
      return existingRows[0].id;
    }

    const newSchoolId = createId();
    const schoolName = fullName.trim() || `SMK ${npsnCandidate}`;
    await connection.execute(
      `
        INSERT INTO schools (
          id,
          npsn,
          name,
          province_code,
          city_code,
          address,
          principal_name,
          contact_name,
          contact_phone,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        newSchoolId,
        npsnCandidate,
        schoolName,
        "-",
        "-",
        "-",
        "-",
        schoolName,
        null,
      ],
    );
    return newSchoolId;
  }
}

export function validateStrongPassword(password: string): string[] {
  const errors: string[] = [];
  const p = String(password ?? "");
  if (p.length < 8) {
    errors.push("Password baru minimal harus 8 (delapan) karakter.");
  }
  if (!/[A-Z]/.test(p)) {
    errors.push("Password baru harus mengandung setidaknya 1 (satu) huruf BESAR (A – Z).");
  }
  if (!/[a-z]/.test(p)) {
    errors.push("Password baru harus mengandung setidaknya 1 (satu) huruf KECIL (a – z).");
  }
  if (!/[0-9]/.test(p)) {
    errors.push("Password baru harus mengandung setidaknya 1 (satu) ANGKA (0 – 9).");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p)) {
    errors.push("Password baru harus mengandung setidaknya 1 (satu) SIMBOL (misalnya !@#$%^&*).");
  }
  return errors;
}

export function generateSecurePassword(length = 16): string {
  const lowercase = "abcdefghijkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lowercase + uppercase + digits + symbols;

  const result: string[] = [
    pickFrom(lowercase, 3),
    pickFrom(uppercase, 3),
    pickFrom(digits, 3),
    pickFrom(symbols, 2),
    pickFrom(all, Math.max(0, length - 11)),
  ]
    .join("")
    .split("");

  const random = new Uint32Array(result.length);
  crypto.getRandomValues?.(random);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Number((random[i] ?? Math.floor(Math.random() * (i + 1))) % (i + 1));
    const temp = result[i];
    result[i] = result[j]!;
    result[j] = temp!;
  }
  return result.join("").slice(0, length).padEnd(length, pickFrom(all, 1));
}

function pickFrom(pool: string, n: number): string {
  if (n <= 0) return "";
  let out = "";
  for (let i = 0; i < n; i++) {
    const r = randomBytes(1)[0]!;
    out += pool[r % pool.length]!;
  }
  return out;
}

function createId() {
  return `${Date.now().toString(36)}${randomBytes(10).toString("hex")}`.slice(0, 26).padEnd(26, "0");
}
