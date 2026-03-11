import { Redis } from "ioredis";

let _redis: Redis | null = null;

/**
 * Canonical Redis connection config derived from REDIS_URL (preferred) or
 * REDIS_HOST / REDIS_PORT fallback.  Used by the main ioredis client **and**
 * BullMQ queues / workers so every component connects to the same instance.
 */
export function getRedisConfig(): { host: string; port: number; password?: string } {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      ...(url.password ? { password: url.password } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  };
}

export function getRedis(): Redis | null {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 5000);
      },
    });
  }
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
