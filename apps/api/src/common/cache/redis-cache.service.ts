import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: false,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      reconnectOnError: () => true,
    });

    this.redis.on("error", (err: Error) => {
      this.logger.warn(`[Redis] Connection error: ${err.message}`);
    });

    this.redis.on("connect", () => {
      this.logger.log("[Redis] Connected to 127.0.0.1:6379");
    });
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect(false);
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`[Redis:getJSON] key=${key} error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttlSec: number = 60): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSec > 0) {
        await this.redis.set(key, serialized, "EX", ttlSec);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (err) {
      this.logger.warn(`[Redis:setJSON] key=${key} error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`[Redis:del] key=${key} error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.redis.exists(key);
      return count > 0;
    } catch (err) {
      this.logger.warn(`[Redis:exists] key=${key} error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async tryGetOrFallback<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSec: number = 60,
  ): Promise<T> {
    try {
      const cached = await this.getJSON<T>(key);
      if (cached !== null) {
        return cached;
      }
    } catch (err) {
      this.logger.warn(
        `[Redis:tryGetOrFallback:CACHE_MISS_ERR] key=${key} — fallback to fetcher. error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let value: T;
    try {
      value = await fetcher();
    } catch (fetcherErr) {
      throw fetcherErr;
    }

    try {
      await this.setJSON<T>(key, value, ttlSec);
    } catch (cacheWriteErr) {
      this.logger.warn(
        `[Redis:tryGetOrFallback:CACHE_WRITE_ERR] key=${key} — failed to write cache. error: ${cacheWriteErr instanceof Error ? cacheWriteErr.message : String(cacheWriteErr)}`,
      );
    }

    return value;
  }
}
