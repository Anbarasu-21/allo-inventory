// src/lib/expiry.ts
/**
 * Releases all PENDING reservations whose expiresAt has passed.
 * Called by:
 *  1. GET /api/products (lazy cleanup before returning stock)
 *  2. GET /api/reservations/:id (lazy cleanup on read)
 *  3. Vercel Cron job at /api/cron/expire-reservations (every minute)
 *
 * Uses a Postgres transaction so the stock decrement and status update
 * are atomic.
 */
import { prisma } from "./prisma";

export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
  });

  if (expired.length === 0) return 0;

  let released = 0;

  for (const reservation of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        // Double-check status inside transaction (avoid race with confirm)
        const current = await tx.reservation.findUnique({
          where: { id: reservation.id },
        });
        if (!current || current.status !== "PENDING") return;

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        });

        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reserved: { decrement: reservation.quantity },
          },
        });
      });
      released++;
    } catch (err) {
      console.error(`[expiry] Failed to release reservation ${reservation.id}:`, err);
    }
  }

  return released;
}
