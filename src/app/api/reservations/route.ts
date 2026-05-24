// src/app/api/reservations/route.ts
/**
 * POST /api/reservations
 *
 * Concurrency strategy (two-layer):
 *
 * Layer 1 – Redis distributed lock on `${productId}:${warehouseId}`.
 *   Prevents the thundering herd from all hitting the DB simultaneously.
 *   If Redis is down we skip this layer and rely on layer 2.
 *
 * Layer 2 – Postgres serializable transaction with a SELECT ... FOR UPDATE
 *   on the StockLevel row. Even if multiple requests slip through (Redis
 *   unavailable, lock expired), only one will hold the row lock at a time.
 *   The available-stock check inside the transaction is therefore atomic.
 *
 * Result: exactly one request succeeds for the last unit; the other gets 409.
 *
 * Idempotency: if an Idempotency-Key header is present, identical retries
 * return the stored response without re-running the reservation logic.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/lock";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { CreateReservationSchema } from "@/lib/schemas";
import type { ReservationDetail } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const RESERVATION_MINUTES = parseInt(
  process.env.RESERVATION_MINUTES ?? "10",
  10
);

export async function GET() {
  // List all reservations (useful for debugging / admin)
  try {
    const reservations = await prisma.reservation.findMany({
      include: { product: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(reservations);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // --- Idempotency check ---
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  // --- Parse & validate body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const lockKey = `${productId}:${warehouseId}`;

  // --- Layer 1: Redis distributed lock ---
  const lockToken = await acquireLock(lockKey);
  if (lockToken === null) {
    // Another request holds the lock; tell client to retry shortly
    return NextResponse.json(
      { error: "Too many concurrent requests for this SKU. Please retry." },
      { status: 429 }
    );
  }

  try {
    // --- Layer 2: Postgres transaction with row-level lock ---
    const reservation = await prisma.$transaction(
      async (tx) => {
        // SELECT ... FOR UPDATE — exclusive row lock on the stock level
        const stockLevels = await tx.$queryRaw<
          { id: string; totalUnits: number; reserved: number }[]
        >`
          SELECT id, "totalUnits", reserved
          FROM "StockLevel"
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `;

        if (stockLevels.length === 0) {
          throw new StockError("Product not stocked at this warehouse", 404);
        }

        const stock = stockLevels[0];
        const available = stock.totalUnits - stock.reserved;

        if (available < quantity) {
          throw new StockError(
            `Not enough stock. Available: ${available}, requested: ${quantity}`,
            409
          );
        }

        // Increment reserved count
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: { productId, warehouseId },
          },
          data: { reserved: { increment: quantity } },
        });

        // Create reservation
        const expiresAt = new Date(
          Date.now() + RESERVATION_MINUTES * 60 * 1000
        );
        return tx.reservation.create({
          data: { productId, warehouseId, quantity, expiresAt },
          include: { product: true, warehouse: true },
        });
      },
      {
        isolationLevel: "Serializable",
        timeout: 5000,
      }
    );

    const detail: ReservationDetail = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      productSku: reservation.product.sku,
      productPrice: reservation.product.price,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    };

    const responseBody = detail;
    if (idempotencyKey) {
      await storeIdempotentResponse(idempotencyKey, 201, responseBody);
    }
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    if (err instanceof StockError) {
      const body = { error: err.message };
      if (idempotencyKey) {
        await storeIdempotentResponse(idempotencyKey, err.statusCode, body);
      }
      return NextResponse.json(body, { status: err.statusCode });
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

class StockError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "StockError";
  }
}
