// src/lib/redis.ts
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient() {
  if (!process.env.REDIS_URL) {
    // If no Redis URL, return null — locking will fall back to DB-level lock
    return null;
  }
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: false,
  });
  client.on("error", (err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Redis] connection error:", err.message);
    }
  });
  return client;
}

export const redis =
  globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis ?? undefined;
}
