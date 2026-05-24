// src/lib/lock.ts
/**
 * Distributed lock using Redis SET NX EX.
 *
 * If Redis is unavailable we fall back to a no-op (lock always acquired),
 * relying on the Postgres FOR UPDATE SELECT to prevent double-spend.
 */
import { redis } from "./redis";

const LOCK_TTL_MS = 5_000; // 5 seconds max lock hold

export async function acquireLock(key: string): Promise<string | null> {
  if (!redis) return "no-redis"; // fallback — DB lock still protects us

  const token = `${Date.now()}-${Math.random()}`;
  const result = await redis.set(
    `lock:${key}`,
    token,
    "PX",
    LOCK_TTL_MS,
    "NX"
  );
  return result === "OK" ? token : null;
}

export async function releaseLock(key: string, token: string): Promise<void> {
  if (!redis || token === "no-redis") return;

  // Lua script ensures we only delete our own lock
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `lock:${key}`, token);
}
