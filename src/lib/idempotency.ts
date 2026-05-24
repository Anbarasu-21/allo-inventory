// src/lib/idempotency.ts
/**
 * Idempotency key store backed by Postgres (IdempotencyRecord table).
 * TTL: 24 hours — enough for any reasonable payment retry window.
 */
import { prisma } from "./prisma";

const TTL_HOURS = 24;

export async function getIdempotentResponse(key: string): Promise<{
  statusCode: number;
  body: unknown;
} | null> {
  try {
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key },
    });
    if (!record) return null;
    if (record.expiresAt < new Date()) {
      // Expired — treat as not found (don't clean up inline, lazy GC)
      return null;
    }
    return { statusCode: record.statusCode, body: record.responseBody };
  } catch {
    return null; // Non-fatal: if we can't read, just proceed normally
  }
}

export async function storeIdempotentResponse(
  key: string,
  statusCode: number,
  body: unknown
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
  try {
    await prisma.idempotencyRecord.upsert({
      where: { key },
      create: { key, statusCode, responseBody: body as any, expiresAt },
      update: { statusCode, responseBody: body as any, expiresAt },
    });
  } catch {
    // Non-fatal: if we can't store, the client just won't get idempotency
    // but the operation itself already succeeded.
  }
}
