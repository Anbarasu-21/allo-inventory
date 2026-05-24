// src/app/api/reservations/[id]/confirm/route.ts
/**
 * POST /api/reservations/:id/confirm
 *
 * Confirms a PENDING reservation (payment succeeded).
 * Returns 410 Gone if the reservation has expired.
 * Returns 409 Conflict if already confirmed or released.
 *
 * Idempotency: supports Idempotency-Key header.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getIdempotentResponse,
  storeIdempotentResponse,
} from "@/lib/idempotency";
import type { ReservationDetail } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the row
      const reservations = await tx.$queryRaw<
        {
          id: string;
          status: string;
          expiresAt: Date;
          productId: string;
          warehouseId: string;
          quantity: number;
        }[]
      >`
        SELECT id, status, "expiresAt", "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${params.id}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        throw new ReservationError("Reservation not found", 404);
      }

      const r = reservations[0];

      if (r.status === "CONFIRMED") {
        // Already confirmed — idempotent success
        return tx.reservation.findUnique({
          where: { id: r.id },
          include: { product: true, warehouse: true },
        });
      }

      if (r.status === "RELEASED") {
        throw new ReservationError(
          "Reservation has already been released",
          409
        );
      }

      // Check expiry
      if (new Date(r.expiresAt) < new Date()) {
        // Release the stock back
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: r.productId,
              warehouseId: r.warehouseId,
            },
          },
          data: { reserved: { decrement: r.quantity } },
        });
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: "RELEASED" },
        });
        throw new ReservationError(
          "Reservation has expired and has been released",
          410
        );
      }

      // Confirm: decrement totalUnits (permanent sale) and release reserved hold
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: {
          totalUnits: { decrement: r.quantity },
          reserved: { decrement: r.quantity },
        },
      });

      return tx.reservation.update({
        where: { id: r.id },
        data: { status: "CONFIRMED" },
        include: { product: true, warehouse: true },
      });
    });

    if (!result) throw new Error("Transaction returned null");

    const detail: ReservationDetail = {
      id: result.id,
      productId: result.productId,
      productName: result.product.name,
      productSku: result.product.sku,
      productPrice: result.product.price,
      warehouseId: result.warehouseId,
      warehouseName: result.warehouse.name,
      quantity: result.quantity,
      status: result.status,
      expiresAt: result.expiresAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
    };

    if (idempotencyKey) {
      await storeIdempotentResponse(idempotencyKey, 200, detail);
    }
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof ReservationError) {
      const body = { error: err.message };
      if (idempotencyKey) {
        await storeIdempotentResponse(idempotencyKey, err.statusCode, body);
      }
      return NextResponse.json(body, { status: err.statusCode });
    }
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

class ReservationError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
  }
}
