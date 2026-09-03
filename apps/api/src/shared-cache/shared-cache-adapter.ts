/**
 * shared-cache-adapter.ts
 * ---------------------------------------------------------------------------
 * Cache Adapter pattern Redis REAL implementation (bukan stub).
 * Fix K20: runtimeCache Map dalam-memory TIDAK tersinkron antar worker PM2.
 *
 * Interface ASYNC (Promise-based) semua method — agar set/get lewat Redis
 * native async I/O tidak blocking event loop Node. Memory adapter tetap
 * di-wrap Promise.resolve agar signature 100% SAMA antara 2 adapter.
 *
 * 2 Adapter:
 *   1. MemoryCacheAdapter  — DEFAULT fallback (REDIS_URL kosong / connect error)
 *   2. RedisCacheAdapter   — PRODUCTION (Redis URL tersedia; ioredis lazy init)
 *
 * Fallback otomatis: jika Redis connect failed / unreachable selama 2 detik →
 * adapter switch transparan ke Memory mode, raise warning 1x ke console.warn.
 *
 * Pemakaian (SAMA SEBELUMNYA, TAMBAH await):
 *   const cache = createSharedCacheAdapter<{ proposalBundles: ... }>({
 *     namespace: "wsdata", ttlMs: 90_000, maxEntries: 500,
 *   });
 *   await cache.set("key", val);
 *   const val = await cache.get("key");
 *   await cache.deleteByPrefix("scope::");
 */

import crypto from "node:crypto";
import { Redis } from "ioredis";
import type { RedisOptions } from "ioredis";

export interface SharedCacheAdapterOptions {
  namespace: string;
  ttlMs?: number;
  maxEntries?: number;
  /** Optional Redis URL; jika kosong fallback ke in-memory Map */
  redisUrl?: string;
}

export interface SharedCacheEntry<V> {
  cachedAt: number;
  value: V;
  expiresAt: number;
}

export interface SharedCacheAdapter<V> {
  readonly namespace: string;
  get(key: string): Promise<V | null>;
  set(key: string, value: V, ttlMsOverride?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Hapus SEMUA key yang prefix-nya cocok (scope per user / per section). */
  deleteByPrefix(prefix: string): Promise<number>;
  /** Hapus SEMUA entri dalam namespace ini. */
  clearAll(): Promise<number>;
  /** Return list key (tanpa namespace prefix) untuk debugging. */
  listKeys(): Promise<string[]>;
  /** Optional: close koneksi Redis saat app shutdown. */
  close?(): Promise<void>;
}

const GLOBAL_MEMORY_STORE: Map<string, SharedCacheEntry<unknown>> = new Map();
const ADAPTERS_REGISTRY: Map<string, SharedCacheAdapter<unknown>> = new Map();
let REDIS_CLIENT_SINGLETON: Redis | null = null;
let REDIS_CLIENT_ERROR_FIRED = false;

function entryOf<V>(value: V, ttlMs: number): SharedCacheEntry<V> {
  const now = Date.now();
  return { cachedAt: now, value, expiresAt: now + ttlMs };
}

function hashShort(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function serializeEntry<V>(entry: SharedCacheEntry<V>): string {
  return JSON.stringify(entry);
}
function deserializeEntry<V>(raw: string | null): SharedCacheEntry<V> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as SharedCacheEntry<V>;
    if (!obj || typeof obj !== "object") return null;
    if (!("cachedAt" in obj && "value" in obj && "expiresAt" in obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Singleton Redis client — REUSE antar adapter (1 koneksi per proses = 12 PM2
 * worker = 12 koneksi ke Redis, tetap di bawah maxclients 10000 default).
 * Connect error di-return null agar caller fallback otomatis ke Memory.
 */
function getOrCreateRedisSingleton(redisUrl: string): Redis | null {
  if (REDIS_CLIENT_SINGLETON) return REDIS_CLIENT_SINGLETON;
  try {
    const client = new Redis(redisUrl, {
      lazyConnect: false,
      connectTimeout: 2000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      autoResendUnfulfilledCommands: false,
      showFriendlyErrorStack: false,
      retryStrategy(times: number) {
        if (times > 3) {
          if (!REDIS_CLIENT_ERROR_FIRED) {
            // eslint-disable-next-line no-console
            console.warn("[SharedCache] Redis retryStrategy exceeded 3x → subsequent requests fallback ke MemoryCacheAdapter.");
            REDIS_CLIENT_ERROR_FIRED = true;
          }
          return null;
        }
        return Math.min(times * 200, 800);
      },
    } as RedisOptions);
    client.on("error", (err: Error) => {
      if (!REDIS_CLIENT_ERROR_FIRED) {
        REDIS_CLIENT_ERROR_FIRED = true;
        // eslint-disable-next-line no-console
        console.warn(`[SharedCache] Redis client error (fallback to Memory transparan): ${err && err.message ? err.message : err}`);
      }
    });
    REDIS_CLIENT_SINGLETON = client;
    return client;
  } catch (err) {
    if (!REDIS_CLIENT_ERROR_FIRED) {
      REDIS_CLIENT_ERROR_FIRED = true;
      // eslint-disable-next-line no-console
      console.warn(`[SharedCache] Redis init FAIL (fallback Memory): ${err && (err as Error).message ? (err as Error).message : err}`);
    }
    return null;
  }
}

// ============================================================================
// Adapter 1: In-Memory (DEFAULT / Redis unavailable fallback)
// Promise WRAPPER — interface async 100% agar sama dengan Redis.
// ============================================================================
class MemoryCacheAdapter<V> implements SharedCacheAdapter<V> {
  readonly namespace: string;
  readonly defaultTtlMs: number;
  readonly maxEntries: number;
  constructor(opts: SharedCacheAdapterOptions) {
    this.namespace = opts.namespace;
    this.defaultTtlMs = opts.ttlMs ?? 120_000;
    this.maxEntries = opts.maxEntries ?? 500;
  }
  private fullKey(k: string) {
    return `${this.namespace}::${k}`;
  }
  private evictIfNeeded() {
    const prefix = `${this.namespace}::`;
    const entries: string[] = [];
    for (const full of GLOBAL_MEMORY_STORE.keys()) {
      if (full.startsWith(prefix)) entries.push(full);
    }
    if (entries.length <= this.maxEntries) return;
    const toRemove = Math.ceil(this.maxEntries * 0.25) + (entries.length - this.maxEntries);
    for (let i = 0; i < toRemove && i < entries.length; i += 1) {
      GLOBAL_MEMORY_STORE.delete(entries[i]);
    }
  }
  async get(key: string): Promise<V | null> {
    const e = GLOBAL_MEMORY_STORE.get(this.fullKey(key)) as SharedCacheEntry<V> | undefined;
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      GLOBAL_MEMORY_STORE.delete(this.fullKey(key));
      return null;
    }
    return e.value;
  }
  async set(key: string, value: V, ttlMsOverride?: number): Promise<void> {
    const ttl = ttlMsOverride ?? this.defaultTtlMs;
    GLOBAL_MEMORY_STORE.set(this.fullKey(key), entryOf<V>(value, ttl));
    this.evictIfNeeded();
  }
  async delete(key: string): Promise<void> {
    GLOBAL_MEMORY_STORE.delete(this.fullKey(key));
  }
  async deleteByPrefix(prefix: string): Promise<number> {
    const fullPrefix = this.fullKey(prefix);
    let n = 0;
    for (const k of Array.from(GLOBAL_MEMORY_STORE.keys())) {
      if (k.startsWith(fullPrefix)) {
        GLOBAL_MEMORY_STORE.delete(k);
        n += 1;
      }
    }
    return n;
  }
  async clearAll(): Promise<number> {
    return this.deleteByPrefix("");
  }
  async listKeys(): Promise<string[]> {
    const prefix = this.fullKey("");
    const out: string[] = [];
    for (const full of GLOBAL_MEMORY_STORE.keys()) {
      if (full.startsWith(prefix)) out.push(full.slice(prefix.length));
    }
    return out;
  }
}

// ============================================================================
// Adapter 2: Redis REAL (ioredis based) — PRODUCTION.
// Key format = "sc::<sha1ns>::<key>" (prefix global agar tidak tabrakan app lain)
// Prefix namespace sha agar panjang key Redis tetap pendek.
// TTL Redis native EXPIRE PX (millisecond) — tidak perlu cek expiresAt client
// side; client-side TTL check hanya safety redundancy jika Redis clock skew.
// ============================================================================
const REDIS_GLOBAL_PREFIX = "sc::";

class RedisCacheAdapter<V> implements SharedCacheAdapter<V> {
  readonly namespace: string;
  readonly defaultTtlMs: number;
  readonly namespaceHash: string;
  private readonly fallback: MemoryCacheAdapter<V> | null;
  private redis: Redis | null;
  private readonly redisUrl: string;

  constructor(opts: SharedCacheAdapterOptions, redisUrl: string) {
    this.namespace = opts.namespace;
    this.defaultTtlMs = opts.ttlMs ?? 120_000;
    this.redisUrl = redisUrl;
    this.namespaceHash = hashShort(this.namespace);
    // Fallback standby (jika Redis unavailable → pakai memory per worker)
    this.fallback = new MemoryCacheAdapter<V>(opts);
    this.redis = getOrCreateRedisSingleton(redisUrl);
  }

  private fullKey(k: string): string {
    return `${REDIS_GLOBAL_PREFIX}${this.namespaceHash}::${k}`;
  }

  private isRedisUsable(): boolean {
    if (!this.redis) return false;
    // ioredis status: wait -> connecting -> connect -> ready -> close/reconnecting
    // allow ready/connect saja
    const status = (this.redis as unknown as { status?: string }).status;
    return status === "ready" || status === "connect";
  }

  async get(key: string): Promise<V | null> {
    const fk = this.fullKey(key);
    if (this.isRedisUsable()) {
      try {
        const raw = await this.redis!.get(fk);
        const entry = deserializeEntry<V>(raw);
        if (!entry) return null;
        // TTL double check client-side (safety Redis clock skew)
        if (entry.expiresAt < Date.now()) {
          await this.redis!.unlink(fk).catch(() => {});
          return null;
        }
        return entry.value;
      } catch (err) {
        if (!REDIS_CLIENT_ERROR_FIRED) {
          REDIS_CLIENT_ERROR_FIRED = true;
          // eslint-disable-next-line no-console
          console.warn(`[SharedCache] Redis.GET failed → fallback Memory: ${(err as Error).message}`);
        }
      }
    }
    return this.fallback!.get(key);
  }

  async set(key: string, value: V, ttlMsOverride?: number): Promise<void> {
    const ttl = ttlMsOverride ?? this.defaultTtlMs;
    const fk = this.fullKey(key);
    const entry = entryOf<V>(value, ttl);
    if (this.isRedisUsable()) {
      try {
        // PX millisecond expire
        await this.redis!.set(fk, serializeEntry(entry), "PX", ttl as any);
        return;
      } catch (err) {
        if (!REDIS_CLIENT_ERROR_FIRED) {
          REDIS_CLIENT_ERROR_FIRED = true;
          // eslint-disable-next-line no-console
          console.warn(`[SharedCache] Redis.SET failed → fallback Memory: ${(err as Error).message}`);
        }
      }
    }
    return this.fallback!.set(key, value, ttlMsOverride);
  }

  async delete(key: string): Promise<void> {
    const fk = this.fullKey(key);
    if (this.isRedisUsable()) {
      try {
        await this.redis!.unlink(fk).catch(() => this.redis!.del(fk));
        return;
      } catch (_) { /* fallback below */ }
    }
    return this.fallback!.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const fullPrefix = this.fullKey(prefix);
    let n = 0;
    if (this.isRedisUsable()) {
      try {
        // SCAN cursor-based (TIDAK GUNAKAN KEYS → block production)
        let cursor = "0";
        const pipeline = this.redis!.pipeline();
        do {
          const [nextCursor, batch]: [string, string[]] = await this.redis!.scan(
            cursor,
            "MATCH", `${fullPrefix}*`,
            "COUNT", 200,
          ) as any;
          cursor = nextCursor;
          if (batch.length > 0) {
            pipeline.unlink(...batch);
            n += batch.length;
          }
        } while (cursor !== "0");
        await pipeline.exec();
        return n;
      } catch (err) {
        if (!REDIS_CLIENT_ERROR_FIRED) {
          REDIS_CLIENT_ERROR_FIRED = true;
          // eslint-disable-next-line no-console
          console.warn(`[SharedCache] Redis.SCAN deleteByPrefix failed → fallback Memory: ${(err as Error).message}`);
        }
      }
    }
    return this.fallback!.deleteByPrefix(prefix);
  }

  async clearAll(): Promise<number> {
    return this.deleteByPrefix("");
  }

  async listKeys(): Promise<string[]> {
    const fullPrefix = this.fullKey("");
    const out: string[] = [];
    if (this.isRedisUsable()) {
      try {
        let cursor = "0";
        do {
          const [nextCursor, batch]: [string, string[]] = await this.redis!.scan(
            cursor,
            "MATCH", `${fullPrefix}*`,
            "COUNT", 200,
          ) as any;
          cursor = nextCursor;
          for (const k of batch) out.push(k.slice(fullPrefix.length));
        } while (cursor !== "0");
        return out;
      } catch (_) { /* fallback below */ }
    }
    return this.fallback!.listKeys();
  }

  async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (_) { /* ignore */ }
      this.redis = null;
    }
  }
}

// ============================================================================
// Factory
// ============================================================================
export function createSharedCacheAdapter<V = unknown>(
  opts: SharedCacheAdapterOptions,
): SharedCacheAdapter<V> {
  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL ?? null;
  const cacheId = `${opts.namespace}::${redisUrl ? hashShort(redisUrl) : "mem"}`;
  if (ADAPTERS_REGISTRY.has(cacheId)) return ADAPTERS_REGISTRY.get(cacheId) as SharedCacheAdapter<V>;
  let adapter: SharedCacheAdapter<V>;
  if (redisUrl) {
    try {
      adapter = new RedisCacheAdapter<V>(opts, redisUrl) as SharedCacheAdapter<V>;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[SharedCache] create RedisCacheAdapter FAIL → fallback Memory: ${(err as Error).message}`);
      adapter = new MemoryCacheAdapter<V>(opts);
    }
  } else {
    adapter = new MemoryCacheAdapter<V>(opts);
  }
  ADAPTERS_REGISTRY.set(cacheId, adapter as SharedCacheAdapter<unknown>);
  return adapter;
}

export async function destroyAllSharedCacheAdapters(): Promise<number> {
  let n = 0;
  for (const a of ADAPTERS_REGISTRY.values()) {
    await a.clearAll();
    if (a.close) await a.close().catch(() => {});
    n += 1;
  }
  ADAPTERS_REGISTRY.clear();
  GLOBAL_MEMORY_STORE.clear();
  if (REDIS_CLIENT_SINGLETON) {
    try { await REDIS_CLIENT_SINGLETON.quit().catch(() => {}); } catch (_) {}
    REDIS_CLIENT_SINGLETON = null;
  }
  REDIS_CLIENT_ERROR_FIRED = false;
  return n;
}

/** Hitung size memory store (jumlah entri total, untuk logging / PM2 dash) */
export function globalMemoryCacheSize(): number {
  return GLOBAL_MEMORY_STORE.size;
}
