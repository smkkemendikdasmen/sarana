"use strict";

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ClsServiceManager } from "nestjs-cls";
import mysql, { type Pool as MySqlPool, type PoolConnection as MySqlConnection, type PoolOptions as MySqlPoolOptions } from "mysql2/promise";
import pg, { type Pool as PgPool, type PoolClient as PgClient, type QueryResult } from "pg";

export type DbDialect = "mysql" | "postgres";

export interface ClsTenantContext {
  current_npsn?: string;
  current_role?: string;
  current_user_id?: string;
  [key: string | symbol]: unknown;
}

/**
 * Ambil CLS context tenant secara SAFE (fallback empty object jika ClsService belum di-init)
 * Dipakai sebelum SET LOCAL app.current_* di Postgres agar RLS aktif per-query.
 */
function getClsTenantCtx(): ClsTenantContext {
  try {
    const svc = ClsServiceManager.getClsService<ClsTenantContext>();
    if (!svc || !svc.isActive()) return {} as ClsTenantContext;
    return {
      current_npsn: svc.get("current_npsn"),
      current_role: svc.get("current_role"),
      current_user_id: svc.get("current_user_id"),
    };
  } catch {
    return {} as ClsTenantContext;
  }
}

export interface DialectConnection {
  query: <T extends unknown[] = unknown[]>(
    sql: string,
    params?: unknown[],
  ) => Promise<[T, unknown]>;
  execute: <T extends unknown[] = unknown[]>(
    sql: string,
    params?: unknown[],
  ) => Promise<[T, unknown]>;
}

export interface UpsertOptions {
  table: string;
  columns: string[];
  values: unknown[];
  conflictKeys: string[];
  updates: string[];
  customUpdates?: Record<string, string>;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  public readonly dialect: DbDialect;
  private mysqlPool: MySqlPool | null = null;
  private pgPool: PgPool | null = null;
  private poolInitPromise: Promise<unknown> | null = null;
  private static _globalSingletonInstance: DatabaseService | null = null;

  constructor() {
    const envDialectRaw = String(process.env.DB_DIALECT ?? process.env.DB_ENGINE ?? "mysql")
      .trim()
      .toLowerCase();
    const asPostgres = envDialectRaw === "postgres" || envDialectRaw === "postgresql" || envDialectRaw === "pg";
    this.dialect = (asPostgres ? "postgres" : "mysql") as DbDialect;
    this.logger.log(`[DatabaseService] DB_DIALECT=${this.dialect} (pilih via env DB_DIALECT=mysql|postgres). Semua query melalui adapter kompatibel-tuple.`);
    DatabaseService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): DatabaseService | null {
    return DatabaseService._globalSingletonInstance;
  }

  static getGlobalSingletonInstance(): DatabaseService {
    const inst = DatabaseService._globalSingletonInstance;
    if (!inst) throw new Error("DatabaseService global singleton instance belum tersedia (pastikan AppModule Nest sudah di-bootstrap).");
    return inst;
  }

  // ========== PUBLIC HELPERS — dialek-aware ==========

  isPostgres(): boolean {
    return this.dialect === "postgres";
  }

  isMySql(): boolean {
    return this.dialect === "mysql";
  }

  /**
   * Generate klausul WHERE untuk INFORMATION_SCHEMA.COLUMNS / STATISTICS
   * sesuai dialek. Tinggal tempelkan ke string SQL.
   */
  infoSchemaTableScopeCondition(
    tableName?: string,
    opts: { includeTable?: boolean } = {},
  ): string {
    const t = tableName ? ` AND TABLE_NAME = '${tableName.replace(/'/g, "''")}'` : "";
    const extra = opts.includeTable ? t : "";
    if (this.isPostgres()) {
      return ` TABLE_CATALOG = current_database() AND TABLE_SCHEMA = 'public' ${extra}`;
    }
    return ` TABLE_SCHEMA = DATABASE() ${extra}`;
  }

  /**
   * Abstract INSERT ... ON DUPLICATE KEY UPDATE (MySQL)
   *       = INSERT ... ON CONFLICT (keys) DO UPDATE SET ... = EXCLUDED... (Postgres)
   * Dijalankan via connection dalam transaction (opsional).
   * @param connection DialectConnection dari callback transaction
   * @param opts.columns daftar kolom INSERT
   * @param opts.values nilai-nilai dalam urutan columns
   * @param opts.conflictKeys unique keys (untuk PG ON CONFLICT clause); untuk MySQL diabaikan (sufficient UNIQUE index existing).
   * @param opts.updates kolom-kolom yang di-update jika conflict; setara `col = VALUES(col)` di MySQL
   */
  async executeUpsert<T = unknown>(
    connection: DialectConnection,
    opts: UpsertOptions,
  ): Promise<[T, unknown]> {
    const { table, columns, values, conflictKeys, updates, customUpdates } = opts;
    const placeholders = columns.map(() => "?").join(", ");
    const colList = columns.map((c) => this.quoteIdent(c)).join(", ");

    const buildSetClauses = (mode: "mysql" | "postgres"): string => {
      const parts: string[] = [];
      for (const c of updates) {
        const qc = this.quoteIdent(c);
        if (mode === "mysql") {
          parts.push(`${qc} = VALUES(${qc})`);
        } else {
          parts.push(`${qc} = EXCLUDED.${qc}`);
        }
      }
      if (customUpdates) {
        for (const [col, expr] of Object.entries(customUpdates)) {
          const qc = this.quoteIdent(col);
          parts.push(`${qc} = ${expr}`);
        }
      }
      return parts.join(", ");
    };

    if (this.isMySql()) {
      const setList = buildSetClauses("mysql");
      const sql = `INSERT INTO ${this.quoteIdent(table)} (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${setList}`;
      return connection.execute(sql, values) as Promise<[T, unknown]>;
    }

    const setList = buildSetClauses("postgres");
    const conflictList = conflictKeys.map((c) => this.quoteIdent(c)).join(", ");
    const sql = `INSERT INTO ${this.quoteIdent(table)} (${colList}) VALUES (${placeholders}) ON CONFLICT (${conflictList}) DO UPDATE SET ${setList}`;
    return connection.execute(sql, values) as Promise<[T, unknown]>;
  }

  quoteIdent(name: string): string {
    if (this.isPostgres()) {
      return `"${name.replace(/"/g, '""')}"`;
    }
    return `\`${name.replace(/`/g, "``")}\``;
  }

  /** Alias untuk dialect dari instance apapun (untuk info-schema query lama) */
  databaseScopeSql(): string {
    return this.infoSchemaTableScopeCondition();
  }

  // ========== POOL INITIALIZATION ==========

  async onModuleInit() {
    try {
      await this.ensurePoolReady();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`onModuleInit inisialisasi pool ${this.dialect} ditunda (non-fatal, retry otomatis query pertama): ${msg}`);
    }
  }

  async onModuleDestroy() {
    if (this.mysqlPool) {
      try { await this.mysqlPool.end(); } catch { /* ignore */ }
      this.mysqlPool = null;
    }
    if (this.pgPool) {
      try { await this.pgPool.end(); } catch { /* ignore */ }
      this.pgPool = null;
    }
    this.poolInitPromise = null;
  }

  private async ensurePoolReady(): Promise<MySqlPool | PgPool> {
    if (this.isMySql()) {
      if (this.mysqlPool) return this.mysqlPool;
      if (this.poolInitPromise) return this.poolInitPromise as Promise<MySqlPool>;
      this.poolInitPromise = (async () => {
        const pool = mysql.createPool(this.buildMySqlPoolOptions());
        const conn = await pool.getConnection();
        try {
          await conn.ping();
          this.logger.log("Koneksi MySQL berhasil diinisialisasi (lazy-ready).");
        } finally {
          conn.release();
        }
        this.mysqlPool = pool;
        this.poolInitPromise = null;
        return pool;
      })();
      return this.poolInitPromise as Promise<MySqlPool>;
    }
    if (this.pgPool) return this.pgPool;
    if (this.poolInitPromise) return this.poolInitPromise as Promise<PgPool>;
    this.poolInitPromise = (async () => {
      const pool = new pg.Pool(this.buildPgPoolOptions());
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        this.logger.log("Koneksi PostgreSQL berhasil diinisialisasi (lazy-ready).");
      } finally {
        client.release();
      }
      this.pgPool = pool;
      this.poolInitPromise = null;
      return pool;
    })();
    return this.poolInitPromise as Promise<PgPool>;
  }

  // ========== PUBLIC QUERY API ==========

  /**
   * SET LOCAL app.current_npsn/app.current_role/app.current_user_id di Postgres
   * AGAR RLS policies AKTIF untuk query berikutnya.
   * Dipanggil SETELAH BEGIN (transaction) atau SETELAH connection acquire (pool).
   * MySQL: NO-OP (hanya skip).
   */
  private async applyClsRlsContextPg(client: PgClient): Promise<void> {
    if (!this.isPostgres()) return;
    const ctx = getClsTenantCtx();
    const npsn = ctx.current_npsn ?? "";
    const role = ctx.current_role ?? "";
    const userId = ctx.current_user_id ?? "";
    if (!npsn && !role && !userId) return;
    try {
      await client.query(
        "SELECT set_config('app.current_npsn', $1::text, false) AS _n, set_config('app.current_role', $2::text, false) AS _r, set_config('app.current_user_id', $3::text, false) AS _u",
        [npsn, role, userId],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`[RLS SET LOCAL] non-fatal skip: ${msg}`);
    }
  }

  async query<T = unknown[]>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T> {
    const pool = await this.ensurePoolReady();
    if (this.isMySql()) {
      const poolAny = pool as unknown as { query: (s: string, p: unknown[]) => Promise<[unknown[], unknown]> };
      const [rows] = await poolAny.query(sql, params);
      return rows as T;
    }
    // Postgres: untuk ad-hoc query luar transaction, kita pakai client sementara
    // dari pool + SET LOCAL agar RLS aktif (walaupun auto-commit — SET LOCAL cuma 1 query).
    const client = await (pool as PgPool).connect();
    try {
      await this.applyClsRlsContextPg(client);
      const pgSql = this.toPgText(sql);
      try {
        const result = await client.query(pgSql, this.normalizeParams(params));
        return result.rows as T;
      } catch (err: any) {
        // [DEBUG-SYNTAX-42601] Log full SQL saat Postgres syntax error
        if (err && (err.code === '42601' || /syntax error/i.test(err.message ?? ''))) {
          const orig1k = (sql ?? '').slice(0, 1200).replace(/\s+/g, ' ');
          const trans1k5 = (pgSql ?? '').slice(0, 2200);
          this.logger.error(`[PG-SYNTAX-DEBUG code=${err.code ?? '?'} pos=${err.position ?? '?'}] ORIGINAL=${orig1k}`);
          this.logger.error(`[PG-SYNTAX-DEBUG TRANSLATED]: ${trans1k5}`);
        }
        throw err;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Compat alias: `execute` = same as `query` for PG since pg natively parameterizes.
   * Return tuple [rows, meta] for backward compat with mysql2 connection.execute.
   */
  async execute<T = unknown[]>(
    sql: string,
    params: unknown[] = [],
  ): Promise<[T, unknown]> {
    const pool = await this.ensurePoolReady();
    if (this.isMySql()) {
      const poolAny = pool as unknown as { execute: (s: string, p: unknown[]) => Promise<[unknown[], unknown]> };
      return poolAny.execute(sql, params) as Promise<[T, unknown]>;
    }
    const client = await (pool as PgPool).connect();
    try {
      await this.applyClsRlsContextPg(client);
      const pgSql = this.toPgText(sql);
      try {
        const result = await client.query(pgSql, this.normalizeParams(params));
        return [result.rows as T, this.pgResultToMeta(result)];
      } catch (err: any) {
        if (err && (err.code === '42601' || /syntax error/i.test(err.message ?? ''))) {
          const orig1k = (sql ?? '').slice(0, 1200).replace(/\s+/g, ' ');
          const trans1k5 = (pgSql ?? '').slice(0, 2200);
          this.logger.error(`[PG-SYNTAX-EXEC-DEBUG code=${err.code ?? '?'} pos=${err.position ?? '?'}] ORIGINAL=${orig1k}`);
          this.logger.error(`[PG-SYNTAX-EXEC-DEBUG TRANSLATED]: ${trans1k5}`);
        }
        throw err;
      }
    } finally {
      client.release();
    }
  }

  // ========== TRANSACTION API ==========

  async transaction<T>(
    callback: (connection: DialectConnection) => Promise<T>,
    opts?: {
      isolationLevel?:
        | "SERIALIZABLE"
        | "REPEATABLE READ"
        | "READ COMMITTED"
        | "READ UNCOMMITTED";
    },
  ): Promise<T> {
    const pool = await this.ensurePoolReady();

    if (this.isMySql()) {
      const connection = await (pool as MySqlPool).getConnection();
      try {
        if (opts?.isolationLevel) {
          await connection.query(`SET TRANSACTION ISOLATION LEVEL ${opts.isolationLevel}`);
        }
        await connection.beginTransaction();
        const dialectConn: DialectConnection = this.wrapMySqlConnection(connection);
        const result = await callback(dialectConn);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    const client = await (pool as PgPool).connect();
    try {
      if (opts?.isolationLevel) {
        const pgIso = this.mapPgIsolation(opts.isolationLevel);
        await client.query(`BEGIN ISOLATION LEVEL ${pgIso}`);
      } else {
        await client.query("BEGIN");
      }
      await this.applyClsRlsContextPg(client);
      const dialectConn: DialectConnection = this.wrapPgClient(client);
      const result = await callback(dialectConn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* ignore nested rollback err */ }
      throw error;
    } finally {
      client.release();
    }
  }

  // ========== INTERNAL HELPERS ==========

  private wrapMySqlConnection(conn: MySqlConnection): DialectConnection {
    const connAny = conn as unknown as {
      query: (s: string, p: unknown[]) => Promise<[unknown[], unknown]>;
      execute: (s: string, p: unknown[]) => Promise<[unknown[], unknown]>;
    };
    return {
      query: async <T = unknown[]>(sql: string, params: unknown[] = []): Promise<[T, unknown]> => {
        return connAny.query(sql, params) as Promise<[T, unknown]>;
      },
      execute: async <T = unknown[]>(sql: string, params: unknown[] = []): Promise<[T, unknown]> => {
        return connAny.execute(sql, params) as Promise<[T, unknown]>;
      },
    };
  }

  private wrapPgClient(client: PgClient): DialectConnection {
    return {
      query: async <T extends unknown[]>(sql: string, params: unknown[] = []): Promise<[T, unknown]> => {
        const result = await client.query(this.toPgText(sql), this.normalizeParams(params));
        return [result.rows as T, this.pgResultToMeta(result)];
      },
      execute: async <T extends unknown[]>(sql: string, params: unknown[] = []): Promise<[T, unknown]> => {
        const result = await client.query(this.toPgText(sql), this.normalizeParams(params));
        return [result.rows as T, this.pgResultToMeta(result)];
      },
    };
  }

  private pgResultToMeta(result: QueryResult): Record<string, unknown> {
    const rc = Number(result.rowCount ?? 0);
    return {
      affectedRows: rc,
      changedRows: rc,
      insertId: 0,
      rowCount: rc,
      fields: result.fields ?? [],
      command: result.command ?? "",
    };
  }

  private mapPgIsolation(level: string): string {
    switch (level.toUpperCase()) {
      case "SERIALIZABLE": return "SERIALIZABLE";
      case "REPEATABLE READ": return "REPEATABLE READ";
      case "READ COMMITTED": return "READ COMMITTED";
      case "READ UNCOMMITTED": return "READ UNCOMMITTED";
      default: return "READ COMMITTED";
    }
  }

  /**
   * Ubah MySQL-style SQL menjadi PostgreSQL-style:
   * 1. Placeholder ? → $1,$2,... (jika belum $n)
   * 2. Identifier backtick → double-quote
   * 3. Fungsi MySQL spesifik: DATABASE()→current_database(), dst.
   * 4. Strip clause MySQL-only (ALTER TABLE ... ADD COLUMN ... AFTER xxx)
   * 5. Rewrite scope INFORMATION_SCHEMA: WHERE TABLE_SCHEMA = DATABASE() → PG style
   * 6. DDL CREATE TABLE MySQL-only: TINYINT, DATETIME ON UPDATE, ENGINE=InnoDB, KEY inline, UNIQUE KEY inline
   * 7. Upsert: ON DUPLICATE KEY UPDATE col=VALUES(col) → ON CONFLICT DO UPDATE SET col=EXCLUDED.col
   * Jika SQL sudah mengandung $1,$2 maka placeholder dilewatkan (passthrough).
   */
  toPgText(sql: string): string {
    let out = sql;
    // ---------- 1. INFORMATION_SCHEMA scope rewrite ----------
    out = out.replace(
      /\b(TABLE_SCHEMA)\s*=\s*DATABASE\(\)/gi,
      "TABLE_CATALOG = current_database() AND TABLE_SCHEMA = 'public'",
    );
    out = out.replace(
      /\b(TABLE_SCHEMA)\s*=\s*database\(\)/g,
      "TABLE_CATALOG = current_database() AND TABLE_SCHEMA = 'public'",
    );

    // ---------- 2. Function translations (case-insensitive whole-word) ----------
    out = out.replace(/\bDATABASE\(\)/gi, "current_database()");
    out = out.replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP");
    out = out.replace(/\bCURDATE\(\)/gi, "(CURRENT_DATE)::text");
    for (let guard = 0; guard < 8; guard += 1) {
      const before = out;
      out = out.replace(/\bIF\s*\(\s*([^,()]+),\s*([^,()]+),\s*([^,()]+)\s*\)/gi, "CASE WHEN $1 THEN $2 ELSE $3 END");
      if (before === out) break;
    }

    // ---------- 3. Strip MySQL-only positional clause: ALTER TABLE ADD COLUMN ... AFTER xxx ----------
    out = out.replace(/\s+AFTER\s+`?[A-Za-z_][A-Za-z0-9_]*`?/gi, "");
    out = out.replace(/\s+AFTER\s+"?[A-Za-z_][A-Za-z0-9_]*"?/gi, "");
    out = out.replace(/\s+FIRST\b/gi, "");

    // ---------- 3B. DDL MySQL-only -> PG (ensureSchema bootstrap crash) ----------
    // 3B-1. Strip tail: ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ... ;
    //       Allow variations: ENGINE=MyISAM, CHARSET=latin1, COLLATE=..., ROW_FORMAT=..., COMMENT= (SINGLE or DOUBLE quote)
    const tailEngineReSingle = /\)\s*ENGINE\s*=\s*\w+(\s+DEFAULT\s+CHARSET\s*=\s*\w+)?(\s+COLLATE\s*=\s*\S+)?(\s+ROW_FORMAT\s*=\s*\w+)?(\s+COMMENT\s*=\s*'[^']*')?\s*;?\s*$/gim;
    const tailEngineReDouble = /\)\s*ENGINE\s*=\s*\w+(\s+DEFAULT\s+CHARSET\s*=\s*\w+)?(\s+COLLATE\s*=\s*\S+)?(\s+ROW_FORMAT\s*=\s*\w+)?(\s+COMMENT\s*=\s*"[^"]*")?\s*;?\s*$/gim;
    out = out.replace(tailEngineReSingle, ");\n");
    out = out.replace(tailEngineReDouble, ");\n");
    // Also strip mid-query engine= (case inline subquery rare)
    out = out.replace(/\s+ENGINE\s*=\s*\w+/gi, "");
    // 3B-2. Strip charset/collate per-column (e.g. VARCHAR(255) CHARACTER SET utf8mb4 ...)
    out = out.replace(/\s+CHARACTER\s+SET\s+\w+/gi, "");
    out = out.replace(/\s+COLLATE\s+\w+/gi, "");
    // 3B-2B. Strip INLINE COLUMN COMMENT '...' atau "..." per-definisi kolom (MySQL-only, PG tidak support inline COMMENT pada column list CREATE TABLE)
    //        Contoh: `nama VARCHAR(100) NOT NULL COMMENT 'Nama sekolah'` atau COMMENT "Nama" → hapus bagian COMMENT
    //        Gunakan loop guard (hingga 10x) untuk case comment dengan escaped quote '' atau "" di dalamnya
    for (let gC = 0; gC < 10; gC += 1) {
      const before = out;
      // Single-quote comment: COMMENT '...' (with escaped '')
      out = out.replace(/\s+COMMENT(\s*=)?\s+'(?:[^']|'')*'/gi, "");
      // Double-quote comment: COMMENT "..." (with escaped "")
      out = out.replace(/\s+COMMENT(\s*=)?\s+"(?:[^"]|"")*"/gi, "");
      if (before === out) break;
    }
    // 3B-3. TINYINT(1) / TINYINT(n) -> SMALLINT  (MySQL boolean/short int; PG tidak punya TINYINT)
    out = out.replace(/\bTINYINT\s*\(\s*\d+\s*\)/gi, "SMALLINT");
    out = out.replace(/\bTINYINT\b/gi, "SMALLINT");
    // 3B-4. DATETIME with ON UPDATE CURRENT_TIMESTAMP -> TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP (drop ON UPDATE, use DEFAULT only)
    //       Pattern: DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    out = out.replace(
      /\bDATETIME(\(\d+\))?\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\b/gi,
      "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );
    out = out.replace(
      /\bDATETIME(\(\d+\))?\s+DEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\b/gi,
      "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
    );
    // Standalone DATETIME(n) → TIMESTAMP
    out = out.replace(/\bDATETIME(\(\d+\))?\b/gi, "TIMESTAMP");
    // 3B-5. Inline UNIQUE KEY idx_name (...) → CONSTRAINT idx_name UNIQUE (...)
    out = out.replace(/\bUNIQUE\s+KEY\s+`?(\w+)`?\s*\(/gi, 'CONSTRAINT "$1" UNIQUE (');
    // 3B-6. Strip inline KEY idx_name (...) from CREATE TABLE column list (PG tidak mendukung inline regular index)
    //       Pattern: , KEY idx_name (...)  or  ,  KEY `idx` (col1,col2)
    //       Use loop to handle multiple consecutive KEY lines safely (comma leading/trailing)
    for (let g = 0; g < 20; g += 1) {
      const before = out;
      // Remove leading-comma KEY clause: , KEY `name` (col1, col2(10), col3)
      out = out.replace(/,\s*KEY\s+`?[\w$]+`?\s*\((?:[^()]|\([^()]*\))*\)\s*/gi, "");
      // Remove KEY clause at start of list (after opening paren): KEY `name` (...) ,
      out = out.replace(/(\(\s*)KEY\s+`?[\w$]+`?\s*\((?:[^()]|\([^()]*\))*\)\s*,/gi, "$1");
      if (before === out) break;
    }
    // 3B-7. AUTO_INCREMENT (MySQL serial) -> GENERATED BY DEFAULT AS IDENTITY / BIGSERIAL
    out = out.replace(/\bAUTO_INCREMENT\b/gi, "GENERATED BY DEFAULT AS IDENTITY");
    // 3B-8. ENUM literals: column ENUM('a','b','c') → VARCHAR(32) CHECK (column IN ('a','b','c')) [safe fallback without creating native ENUM type]
    //       Shallow: match ENUM('...','...') simple up to 20 values
    out = out.replace(
      /\b(\w+)\s+ENUM\s*\((\s*'[^']*'\s*(?:,\s*'[^']*'\s*){0,40})\)\s*/gi,
      (_m, col, vals) => `${col} VARCHAR(128) CHECK (${col} IN (${vals})) `,
    );
    // Ensure no dangling comma before closing paren from stripped KEYs
    out = out.replace(/,(\s*\))/g, "$1");

    // ---------- 4. Replace backtick identifiers BEFORE placeholder numbering ----------
    out = out.replace(/`([^`]+)`/g, '"$1"');

    // ---------- 5. UPSERT REWRITE (MySQL -> PG): ON DUPLICATE KEY UPDATE col=VALUES(col) -> ON CONFLICT DO UPDATE SET col=EXCLUDED.col ----------
    // Run twice for edge cases with different spacing
    for (let guard = 0; guard < 3; guard += 1) {
      const before = out;
      // Pattern: ON DUPLICATE KEY UPDATE a = VALUES(a), b.updated_at = VALUES(updated_at), ...
      // Capture: assignments list until end of statement (comma+whitespace+identifier+space+=+VALUES+...)
      // Use function replacer to rewrite each assignment col=VALUES(col) → col=EXCLUDED.col
      const upsertRe = /\bON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]*?)(?=\s*;?\s*$|\sON\s+DUPLICATE|\sLIMIT|\sRETURNING)/i;
      const match = out.match(upsertRe);
      if (!match) break;
      const fullClause = match[0];
      const assignments = match[1];
      // Rewrite each assignment: `ident = VALUES(ident)` → `ident = EXCLUDED.ident`
      // Also support schema.table col: `tbl.col = VALUES(col)` → `tbl.col = EXCLUDED.col`
      const rewrittenAssigns = assignments.replace(
        /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\s*=\s*VALUES\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/gi,
        (_m, lhs, col) => {
          // If lhs is qualified (table.col), keep table prefix but use column part
          const colName = lhs.includes(".") ? lhs.split(".").pop() as string : lhs;
          if (colName.toLowerCase() !== col.toLowerCase()) {
            // Non-symmetric: left column != VALUES column, leave as-is (rare)
            return `${lhs} = EXCLUDED.${col}`;
          }
          return `${lhs} = EXCLUDED.${col}`;
        },
      );
      out =
        out.slice(0, match.index) +
        "ON CONFLICT DO UPDATE SET " +
        rewrittenAssigns +
        out.slice((match.index ?? 0) + fullClause.length);
      if (before === out) break;
    }

    // ---------- 6. Placeholder ? → $1,$2,... (skip jika sudah $n) ----------
    if (/\$[0-9]+/.test(out)) {
      return out;
    }
    let idx = 0;
    out = out.replace(/\?/g, () => {
      idx += 1;
      return `$${idx}`;
    });
    return out;
  }

  /**
   * Normalisasi parameter untuk kompatibilitas:
   * - MySQL menerima boolean / number bigint / object / JSON-string apa adanya.
   * - PG: BOOLEAN harus true/false (bukan 1/0), DATE string ISO diterima.
   * - TINYINT 1/0 di MySQL biasanya boolean — tapi karena kita simpan number, leave as-is.
   */
  normalizeParams(params: unknown[]): unknown[] {
    if (!Array.isArray(params)) return [];
    return params.map((v) => {
      if (v === undefined) return null;
      return v;
    });
  }

  private buildMySqlPoolOptions(): MySqlPoolOptions {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const socketPath = process.env.DB_SOCKET_PATH?.trim();
    const envConnectionLimit = Number(process.env.DB_POOL_LIMIT ?? 0);
    const connectionLimit = envConnectionLimit >= 5 ? envConnectionLimit : 50;
    const enableCompression = String(process.env.DB_COMPRESS ?? "").toLowerCase() !== "false";
    const connectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 0) || 10_000;
    const idleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 0) || 60_000;

    if (databaseUrl) {
      const parsed = new URL(databaseUrl);
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, "") || "saranasmk",
        waitForConnections: true,
        connectionLimit,
        maxIdle: Math.max(2, Math.floor(connectionLimit * 0.4)),
        idleTimeout: Math.max(1_000, idleTimeoutMs),
        queueLimit: 0,
        connectTimeout: connectTimeoutMs,
        compress: enableCompression,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        dateStrings: true,
      };
    }

    return {
      socketPath: socketPath || "/tmp/mysql.sock",
      user: process.env.DB_USER?.trim() || "root",
      password: process.env.DB_PASSWORD?.trim() || undefined,
      database: process.env.DB_NAME?.trim() || "saranasmk",
      waitForConnections: true,
      connectionLimit,
      maxIdle: Math.max(2, Math.floor(connectionLimit * 0.4)),
      idleTimeout: Math.max(1_000, idleTimeoutMs),
      queueLimit: 0,
      connectTimeout: connectTimeoutMs,
      compress: enableCompression,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      dateStrings: true,
    };
  }

  private buildPgPoolOptions(): {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    statement_timeout?: number;
  } {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const envConnectionLimit = Number(process.env.DB_POOL_LIMIT ?? 0);
    const max = envConnectionLimit >= 5 ? envConnectionLimit : 50;
    const idleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 0) || 60_000;
    const connectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 0) || 10_000;

    if (databaseUrl && /^postgres(ql)?:\/\//i.test(databaseUrl)) {
      const parsed = new URL(databaseUrl);
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, "") || "saranasmk",
        max,
        idleTimeoutMillis: Math.max(1_000, idleTimeoutMs),
        connectionTimeoutMillis: connectTimeoutMs,
        statement_timeout: 300_000,
      };
    }

    return {
      host: process.env.DB_HOST?.trim() || process.env.PGHOST?.trim() || "127.0.0.1",
      port: Number(process.env.DB_PORT ?? process.env.PGPORT ?? 5432),
      user: process.env.DB_USER?.trim() || process.env.PGUSER?.trim() || "saranasmk",
      password: process.env.DB_PASSWORD?.trim() || process.env.PGPASSWORD?.trim() || "saranasmk123",
      database: process.env.DB_NAME?.trim() || process.env.PGDATABASE?.trim() || "saranasmk",
      max,
      idleTimeoutMillis: Math.max(1_000, idleTimeoutMs),
      connectionTimeoutMillis: connectTimeoutMs,
      statement_timeout: 300_000,
    };
  }
}
