// src/app/api/reservations/[id]/release/route.ts
/**
 * POST /api/reservations/:id/release
 *
 * Releases a PENDING reservation early (payment failed / user cancelled).
 * Idempotent: releasing an already-released reservation is a 200.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReservationDetail } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<
        {
          id: string;
          status: string;
          productId: string;
          warehouseId: string;
          quantity: number;
          expiresAt: Date;
        }[]
      >`
        SELECT id, status, "productId", "warehouseId", quantity, "expiresAt"
        FROM "Reservation"
        WHERE id = ${params.id}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        throw new ReservationError("Reservation not found", 404);
      }

      const r = reservations[0];

      if (r.status === "RELEASED") {
        // Already released — idempotent, fetch full record and return
        return tx.reservation.findUnique({
          where: { id: r.id },
          include: { product: true, warehouse: true },
        });
      }

      if (r.status === "CONFIRMED") {
        throw new ReservationError("Cannot release a confirmed reservation", 409);
      }

      // Release: return reserved units to available pool
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: { reserved: { decrement: r.quantity } },
      });

      return tx.reservation.update({
        where: { id: r.id },
        data: { status: "RELEASED" },
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

    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    console.error("[POST /api/reservations/:id/release]", err);
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
