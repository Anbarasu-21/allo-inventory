// src/app/api/cron/expire-reservations/route.ts
/**
 * Vercel Cron job — runs every minute.
 * Configured in vercel.json.
 *
 * Releases all PENDING reservations that have passed their expiresAt.
 * Protected by CRON_SECRET env var to prevent unauthorized triggering.
 */
import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  // In production, Vercel automatically sends the cron secret.
  // Skip auth check in development.
  if (
    process.env.NODE_ENV === "production" &&
    secret &&
    authHeader !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({
      ok: true,
      released,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/expire-reservations]", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
