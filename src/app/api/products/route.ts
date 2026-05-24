// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import type { ProductWithStock } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lazy expiry cleanup before reporting stock
    await releaseExpiredReservations();

    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          include: { warehouse: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const response: ProductWithStock[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sku: p.sku,
      price: p.price,
      imageUrl: p.imageUrl,
      stockLevels: p.stockLevels.map((sl) => ({
        warehouseId: sl.warehouseId,
        warehouseName: sl.warehouse.name,
        warehouseLocation: sl.warehouse.location,
        totalUnits: sl.totalUnits,
        reserved: sl.reserved,
        available: Math.max(0, sl.totalUnits - sl.reserved),
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/products]", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
