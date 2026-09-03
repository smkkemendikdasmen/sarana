import { randomBytes } from "node:crypto";

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";

import type { AuthUser, UserRole } from "../common/constants/roles.js";
import { DatabaseService, type DialectConnection } from "../database/database.service.js";

type PoolConnection = DialectConnection;

interface InfoSchemaColumnRow extends RowDataPacket {
  column_name: string;
}

interface TokenPayload {
  sub: string;
  username: string;
  role: AuthUser["role"];
  npsn?: string | null;
}

interface DbUserRow extends RowDataPacket {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  school_id: string | null;
  npsn: string | null;
  is_active: number;
  role_code: UserRole;
  role_name: string;
  school_name: string | null;
  province_code: string | null;
  city_code: string | null;
  email: string | null;
  password_default_plaintext: string | null;
  password_changed_at: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

const roleNames: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  FASILITATOR_ALAT: "Fasilitator Alat",
  FASILITATOR_ADMINISTRASI: "Fasilitator Administrasi",
  SEKOLAH: "Sekolah",
  KOORDINATOR_ALAT: "Koordinator Alat",
  PPK: "PPK",
};

function generateSecurePassword(length = 18) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%^&*";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private static _globalSingletonInstance: AuthService | null = null;

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) AuthService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): AuthService | null {
    const inst = AuthService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): AuthService {
    const existing = AuthService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new AuthService(db);
    AuthService._globalSingletonInstance = fresh;
    return fresh;
  }

  private readonly jwtSecret = process.env.JWT_SECRET ?? "prisma-dev-secret";
  private readonly tokenVerifyCache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();
  private readonly TOKEN_VERIFY_CACHE_TTL_MS =
    Number(process.env.JWT_VERIFY_CACHE_TTL_MS ?? 120_000);
  private readonly TOKEN_VERIFY_CACHE_MAX = 512;

  private async ensureDatabaseServiceReady(maxRetries = 3, delayMs = 500): Promise<DatabaseService> {
    let lastErr: unknown = null;
    for (let i = 0; i < maxRetries; i += 1) {
      const db = (this as any).databaseService as DatabaseService | undefined | null;
      if (db && typeof (db as any).query === "function" && typeof (db as any).ensurePoolReady === "function") {
        try {
          await (db as any).ensurePoolReady();
          return db as DatabaseService;
        } catch (err) {
          lastErr = err;
        }
      }
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "unknown");
    throw new Error(
      `DatabaseService belum siap di AuthService (this.databaseService?.query undefined? ${
        !((this as any).databaseService && typeof ((this as any).databaseService as any).query === "function")
      }. Pesan: ${msg})`,
    );
  }

  private readTokenVerifyCache<T>(key: string): T | null {
    const cached = this.tokenVerifyCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      this.tokenVerifyCache.delete(key);
      return null;
    }
    return cached.value as T;
  }

  private writeTokenVerifyCache(key: string, value: unknown) {
    if (this.tokenVerifyCache.size >= this.TOKEN_VERIFY_CACHE_MAX) {
      const firstKey = this.tokenVerifyCache.keys().next().value;
      if (firstKey) this.tokenVerifyCache.delete(firstKey);
    }
    this.tokenVerifyCache.set(key, {
      value,
      expiresAt: Date.now() + this.TOKEN_VERIFY_CACHE_TTL_MS,
    });
  }

  clearTokenVerifyCache() {
    this.tokenVerifyCache.clear();
  }

  async onModuleInit() {
    try {
      await this.ensureUsersColumnsSchemaReady();
    } catch (error) {
      const err = error as Error & { message?: string };
      this.logger.error("Gagal bootstrap schema tabel users di AuthModule (non-fatal): " + (err?.message ?? String(error)));
    }
    try {
      await this.ensureRoles();
    } catch (error) {
      const err = error as Error & { message?: string };
      this.logger.error("Gagal bootstrap roles di AuthModule (non-fatal, akan diulang manual setelah listen): " + (err?.message ?? String(error)));
    }
    try {
      await this.seedDemoUsersIfNeeded();
    } catch (error) {
      const err = error as Error & { message?: string };
      this.logger.error("Gagal seed demo users di AuthModule (non-fatal, akan diulang manual setelah listen): " + (err?.message ?? String(error)));
    }
  }

  private async ensureUsersColumnsSchemaReady() {
    const db = await this.ensureDatabaseServiceReady(3, 600);
    const existingColumns = new Set<string>();
    try {
      const cols = await db.query<InfoSchemaColumnRow[]>(
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
        await db.query(
          `ALTER TABLE users ADD COLUMN ${columnName} ${definition}`,
          [],
        );
        this.logger.log(`✅ Kolom users.${columnName} berhasil ditambahkan otomatis (AuthModule).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/Duplicate column name|already exists/i.test(msg)) {
          this.logger.verbose(`ℹ️ Kolom users.${columnName} sudah ada, skip (AuthModule).`);
        } else {
          this.logger.warn(`⚠️ Gagal tambah kolom users.${columnName} (AuthModule): ${msg}`);
        }
      }
    };

    await addColumnIfMissing("school_id", "CHAR(26) NULL");
    await addColumnIfMissing("email", "VARCHAR(255) NULL");
    await addColumnIfMissing("password_default_plaintext", "VARCHAR(255) NULL");
    await addColumnIfMissing("password_current_plaintext", "VARCHAR(255) NULL");
    await addColumnIfMissing("password_changed_at", "TIMESTAMP NULL");
  }

  async login(username: string, password: string) {
    const safeUser = typeof username === "string" ? username.trim() : "";
    const safePass = typeof password === "string" ? password.trim() : "";
    if (!safeUser || !safePass) {
      throw new UnauthorizedException("Username dan password wajib diisi.");
    }
    const user = await this.validateUser(safeUser, safePass);
    return this.issueSession(user);
  }

  async registerSchool(payload: {
    schoolName: string;
    npsn: string;
    province: string;
    contactName: string;
    email: string;
    username: string;
    password: string;
  }) {
    const normalizedUsername = payload.username.trim().toLowerCase();
    const normalizedNpsn = payload.npsn.trim();

    return this.databaseService.transaction(async (connection) => {
      const [existingUsers] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
        [normalizedUsername],
      );
      if (existingUsers.length > 0) {
        throw new ConflictException("Username sudah digunakan.");
      }

      const [existingSchools] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM schools WHERE npsn = ? LIMIT 1",
        [normalizedNpsn],
      );
      if (existingSchools.length > 0) {
        throw new ConflictException("NPSN sudah digunakan.");
      }

      const schoolId = createId();
      const userId = createId();
      const passwordHash = await bcrypt.hash(payload.password.trim(), 10);
      const schoolRoleId = await this.getRoleId(connection, "SEKOLAH");

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
          schoolId,
          normalizedNpsn,
          payload.schoolName.trim(),
          payload.province.trim().slice(0, 10),
          "-",
          "-",
          payload.contactName.trim(),
          payload.contactName.trim(),
          null,
        ],
      );

      await connection.execute(
        `
          INSERT INTO users (
            id,
            username,
            password_hash,
            full_name,
            school_id,
            is_active
          ) VALUES (?, ?, ?, ?, ?, 1)
        `,
        [userId, normalizedUsername, passwordHash, payload.contactName.trim(), schoolId],
      );

      await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, schoolRoleId]);

      const user = await this.findUserById(userId, connection);
      if (!user) {
        throw new InternalServerErrorException("Gagal memuat akun sekolah yang baru dibuat.");
      }

      return this.issueSession(user);
    });
  }

  async verifyToken(token: string) {
    const cacheKey = "v1:" + token.slice(-40);
    const cached = this.readTokenVerifyCache<ReturnType<AuthService["sanitizeUser"]>>(cacheKey);
    if (cached) return cached;

    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      const user = await this.findUserById(payload.sub);
      if (!user) {
        throw new UnauthorizedException("Sesi tidak ditemukan.");
      }

      const sanitized = this.sanitizeUser(user);
      this.writeTokenVerifyCache(cacheKey, sanitized);
      return sanitized;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Token tidak valid atau sudah kedaluwarsa.");
    }
  }

  private async validateUser(username: string, password: string) {
    const safeUsername = (username ?? "").trim();
    if (!safeUsername) {
      throw new UnauthorizedException("Username atau password tidak sesuai.");
    }
    const user = await this.findUserByUsername(safeUsername);

    if (!user) {
      throw new UnauthorizedException("Username atau password tidak sesuai.");
    }

    if (!user.is_active) {
      if (user.role_code === "SEKOLAH") {
        // ✅ Hotfix: Maintenance date 31/8 09.00 WIB SUDAH LEWAT → izinkan login SEKOLAH (tidak block).
        // (Logic is_active=0 TIDAK dipakai sebagai penutup website global; migration data nanti sinkron.)
      } else {
        throw new UnauthorizedException("Akun Anda tidak aktif. Silakan hubungi administrator.");
      }
    }

    const passwordMatches = await bcrypt.compare(password.trim(), user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Username atau password tidak sesuai.");
    }

    return user;
  }

  private issueSession(user: DbUserRow | AuthUser) {
    const sessionUser = this.sanitizeUser(user);
    const npsnClaim = "npsn" in user ? (user.npsn ?? null) : ((sessionUser as { npsn?: string | null })?.npsn ?? null);
    const token = jwt.sign(
      {
        sub: sessionUser.id,
        username: sessionUser.username,
        role: sessionUser.role,
        npsn: npsnClaim,
      } satisfies TokenPayload,
      this.jwtSecret,
      { expiresIn: "8h" },
    );

    let mustChangePassword = false;
    if (!("password" in user) && user.role_code === "SEKOLAH") {
      if (!user.password_changed_at || !user.email) {
        mustChangePassword = true;
      }
    }

    return {
      token,
      user: sessionUser,
      mustChangePassword,
    };
  }

  private sanitizeUser(user: DbUserRow | AuthUser) {
    if ("password" in user) {
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization,
        region: user.region,
        npsn: (user as { npsn?: string | null })?.npsn ?? null,
      };
    }

    const organization =
      user.school_name ?? (user.role_name ? `Pusat ${roleNames[user.role_code] ?? user.role_name}` : "SARANA SMK");
    const region = user.npsn
      ? formatRegion(user.province_code, user.city_code)
      : "Nasional";

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      organization,
      region,
      npsn: user.npsn ?? null,
    };
  }

  private async ensureRoles() {
    const db = await this.ensureDatabaseServiceReady(3, 600);
    await db.transaction(async (connection) => {
      for (const [code, name] of Object.entries(roleNames) as Array<[UserRole, string]>) {
        await db.executeUpsert(connection, {
          table: "roles",
          columns: ["code", "name"],
          values: [code, name],
          conflictKeys: ["code"],
          updates: ["name"],
        });
      }
    });
  }

  private async seedDemoUsersIfNeeded() {
    const db = await this.ensureDatabaseServiceReady(3, 800);
    const rows = await db.query<CountRow[]>("SELECT COUNT(*) AS total FROM users");
    if (rows[0]?.total > 0) {
      this.logger.verbose(
        `[seedDemoUsers] Skip (non-fatal): tabel users sudah berisi ${rows[0]?.total ?? 0} row user. SISTEM TIDAK AKAN MERUBAH / MENIMPA PENGGUNA YANG SUDAH ADA (termasuk user "admin"). Seed hanya dijalankan jika tabel users BENAR-BENAR KOSONG.`,
      );
      return;
    }

    const superadminUsername =
      String(process.env.INITIAL_SUPERADMIN_USERNAME ?? "").trim() || "superadmin";
    if (superadminUsername.toLowerCase() === "admin") {
      this.logger.warn(
        `[seedDemoUsers] Skip (keamanan): username "${superadminUsername}" terdeteksi. Seed demo users hanya membuat username "superadmin" default. User "admin" TIDAK PERNAH dibuat / diubah oleh AuthService seed. Gunakan user "admin" dan password anda sendiri.`,
      );
      return;
    }
    const superadminFullName =
      String(process.env.INITIAL_SUPERADMIN_FULL_NAME ?? "").trim() ||
      "Superadmin SARANA SMK";
    const envPassword = String(process.env.INITIAL_SUPERADMIN_PASSWORD ?? "").trim();
    const envHash = String(process.env.INITIAL_SUPERADMIN_PASSWORD_HASH ?? "").trim();
    const generatedPassword = envPassword || envHash ? "" : generateSecurePassword(20);
    const plainForStorage = envPassword || generatedPassword || "";

    await db.transaction(async (connection) => {
      const superadminRoleId = await this.getRoleId(connection, "SUPERADMIN");
      const userId = createId();
      let passwordHash = envHash;
      if (!passwordHash) {
        passwordHash = await bcrypt.hash(plainForStorage, 10);
      }

      await connection.execute(
        `
          INSERT INTO users (
            id,
            username,
            password_hash,
            full_name,
            school_id,
            is_active,
            password_default_plaintext,
            password_changed_at
          ) VALUES (?, ?, ?, ?, NULL, 1, ?, NULL)
        `,
        [userId, superadminUsername, passwordHash, superadminFullName, plainForStorage || null],
      );
      await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [
        userId,
        superadminRoleId,
      ]);
    });

    if (generatedPassword) {
      this.logger.warn(
        "[INITIAL_SUPERADMIN] ⚠️ Pengguna Superadmin AWAL dibuat otomatis karena tabel users KOSONG. " +
          `Username: ${superadminUsername}  |  Password SEMENTARA: ${generatedPassword}  |  ` +
          "SEGERA GANTI PASSWORD SETELAH LOGIN PERTAMA dan simpan password di tempat aman. " +
          "Untuk set password manual selanjutnya gunakan ENV INITIAL_SUPERADMIN_PASSWORD_HASH=<bcrypt_hash>",
      );
    } else {
      this.logger.log(
        `[INITIAL_SUPERADMIN] ✅ Superadmin awal dibuat dari ENV (username: ${superadminUsername}).`,
      );
    }
  }

  private async getRoleId(connection: PoolConnection, roleCode: UserRole) {
    const [rows] = await connection.query<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM roles WHERE code = ? LIMIT 1",
      [roleCode],
    );
    const roleId = rows[0]?.id;

    if (!roleId) {
      throw new InternalServerErrorException(`Role ${roleCode} tidak ditemukan.`);
    }

    return roleId;
  }

  private async findUserByUsername(username: string, connection?: PoolConnection) {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.school_id,
        u.npsn,
        u.is_active,
        u.email,
        u.password_default_plaintext,
        u.password_changed_at,
        r.code AS role_code,
        r.name AS role_name,
        s.name AS school_name,
        s.province_code,
        s.city_code
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN schools s ON s.npsn = u.npsn
      WHERE LOWER(u.username) = LOWER(?)
      ORDER BY ur.role_id ASC
      LIMIT 1
    `;

    if (connection) {
      const [rows] = await connection.query<DbUserRow[]>(sql, [username]);
      return rows[0] ?? null;
    }

    const rows = await this.databaseService.query<DbUserRow[]>(sql, [username]);
    return rows[0] ?? null;
  }

  private async findUserById(userId: string, connection?: PoolConnection) {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.school_id,
        u.npsn,
        u.is_active,
        u.email,
        u.password_default_plaintext,
        u.password_changed_at,
        r.code AS role_code,
        r.name AS role_name,
        s.name AS school_name,
        s.province_code,
        s.city_code
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN schools s ON s.npsn = u.npsn
      WHERE u.id = ?
      ORDER BY ur.role_id ASC
      LIMIT 1
    `;

    if (connection) {
      const [rows] = await connection.query<DbUserRow[]>(sql, [userId]);
      return rows[0] ?? null;
    }

    const rows = await this.databaseService.query<DbUserRow[]>(sql, [userId]);
    return rows[0] ?? null;
  }
}

function formatRegion(provinceCode: string | null, cityCode: string | null) {
  const region = [cityCode, provinceCode].filter((value) => value && value !== "-").join(", ");
  return region || "Nasional";
}

function createId() {
  return `${Date.now().toString(36)}${randomBytes(10).toString("hex")}`.slice(0, 26).padEnd(26, "0");
}
