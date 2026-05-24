// src/app/api/reservations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import type { ReservationDetail } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Lazy expiry on read
    await releaseExpiredReservations();

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
      include: { product: true, warehouse: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

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

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[GET /api/reservations/:id]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
