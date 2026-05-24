import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (
    process.env.NODE_ENV === "production" &&
    secret &&
    authHeader !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { releaseExpiredReservations } = await import("@/lib/expiry");
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