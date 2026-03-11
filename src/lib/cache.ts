/**
 * Multi-tier caching layer.
 * - L1: in-process LRUCache (sub-millisecond, process-scoped, bounded to 1000 entries)
 * - L2: Redis (shared across instances, configurable TTL)
 * - Cache keys are namespaced by accountId for multi-tenant isolation
 * - Supports stale-while-revalidate and tag-based invalidation
 */
import { LRUCache } from "lru-cache";
import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

export interface CacheOptions {
  /** TTL in seconds. Required. */
  ttl: number;
  /** If set, serve stale data for this many seconds while revalidating in the background. */
  staleWhileRevalidate?: number;
  /** Tags for bulk invalidation (e.g. ['invoices', 'account:acc_123']) */
  tags?: string[];
}

// ─── L1 in-process LRU cache ─────────────────────────────────────────────────
// Bounded to 1000 entries. LRU eviction prevents unbounded growth under sustained
// load with many unique keys. TTL is 60 s at the LRU layer; individual entries
// may have shorter TTLs enforced by the options.ttl passed to l1Set.

// LRUCache requires V extends {} (non-nullable). Use a JSON-serializable union.
type CacheValue = Record<string, unknown> | unknown[] | string | number | boolean;
const l1Cache = new LRUCache<string, CacheValue>({
  max: 1000,
  ttl: 60_000, // 1 min max — individual entries may be shorter
  allowStale: false,
});

function l1Get<T>(key: string): T | null {
  const value = l1Cache.get(key);
  if (value === undefined) return null;
  return value as unknown as T;
}

function l1Set<T>(key: string, value: T, ttlMs: number): void {
  l1Cache.set(key, value as CacheValue, { ttl: ttlMs });
}

// ─── Tag → key index ─────────────────────────────────────────────────────────

const TAG_PREFIX = "cache:tag:";

async function addKeyToTags(key: string, tags: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || tags.length === 0) return;
  const pipeline = redis.pipeline();
  for (const tag of tags) {
    pipeline.sadd(`${TAG_PREFIX}${tag}`, key);
  }
  await pipeline.exec();
}

// ─── Public interface ─────────────────────────────────────────────────────────

export const cache = {
  /** Get a cached value. Returns null on miss. */
  async get<T>(key: string): Promise<T | null> {
    const l1 = l1Get<T>(key);
    if (l1 !== null) return l1;

    const redis = getRedis();
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      const value = JSON.parse(raw) as T;
      l1Set(key, value, 5_000); // brief L1 cache for hot keys
      return value;
    } catch (e) {
      logger.warn("Cache.get error", { key, error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  /** Set a cached value. */
  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    l1Set(key, value, Math.min(options.ttl * 1000, 30_000));
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), "EX", options.ttl);
      if (options.tags?.length) await addKeyToTags(key, options.tags);
    } catch (e) {
      logger.warn("Cache.set error", { key, error: e instanceof Error ? e.message : String(e) });
    }
  },

  /** Invalidate all keys associated with the given tags. */
  async invalidate(tags: string[]): Promise<void> {
    const redis = getRedis();
    if (!redis || tags.length === 0) return;
    try {
      const tagKeys = tags.map((t) => `${TAG_PREFIX}${t}`);
      const keysets = await Promise.all(tagKeys.map((tk) => redis.smembers(tk)));
      const keys: string[] = [...new Set(keysets.flat())];
      if (keys.length === 0) return;
      const pipeline = redis.pipeline();
      pipeline.del(...(keys as string[]));
      for (const tk of tagKeys) pipeline.del(tk as string);
      await pipeline.exec();
      for (const k of keys) l1Cache.delete(k);
    } catch (e) {
      logger.warn("Cache.invalidate error", { tags, error: e instanceof Error ? e.message : String(e) });
    }
  },

  /**
   * Cache-aside: return cached value if present, otherwise call fn, cache, and return.
   * Supports stale-while-revalidate: if the main TTL has expired but the SWR window
   * hasn't, return stale data immediately and refresh in the background.
   */
  async wrap<T>(key: string, fn: () => Promise<T>, options: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // Check SWR: if staleWhileRevalidate is set, look for stale data in Redis
    // using a separate key with an extended TTL.
    if (options.staleWhileRevalidate) {
      const redis = getRedis();
      if (redis) {
        try {
          const staleRaw = await redis.get(`${key}:swr`);
          if (staleRaw) {
            const staleValue = JSON.parse(staleRaw) as T;
            // Return stale data immediately; refresh in background
            void (async () => {
              try {
                const fresh = await fn();
                await this.set(key, fresh, options);
                // Update the SWR key too
                await redis.set(
                  `${key}:swr`,
                  JSON.stringify(fresh),
                  "EX",
                  options.ttl + options.staleWhileRevalidate!
                );
              } catch (e) {
                logger.warn("Cache.wrap SWR revalidation failed", {
                  key,
                  error: e instanceof Error ? e.message : String(e),
                });
              }
            })();
            return staleValue;
          }
        } catch {
          // Fall through to fresh fetch
        }
      }
    }

    const value = await fn();
    await this.set(key, value, options);

    // Also set the SWR key with extended TTL
    if (options.staleWhileRevalidate) {
      const redis = getRedis();
      if (redis) {
        redis
          .set(
            `${key}:swr`,
            JSON.stringify(value),
            "EX",
            options.ttl + options.staleWhileRevalidate
          )
          .catch((e: unknown) =>
            logger.warn("Cache.wrap SWR key set failed", {
              key,
              error: e instanceof Error ? e.message : String(e),
            })
          );
      }
    }

    return value;
  },
};

// ─── Namespaced cache key helpers ─────────────────────────────────────────────

/** Create a tenant-scoped cache key. Always include accountId to prevent cross-tenant leakage. */
export function cacheKey(accountId: string, ...parts: string[]): string {
  return `tenant:${accountId}:${parts.join(":")}`;
}
