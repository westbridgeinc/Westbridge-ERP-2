import { Redis } from "ioredis";

let _redis: Redis | null = null;

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
