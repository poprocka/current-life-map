import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { retryPending } from "@/server/booking/process";
import { safeEqual } from "@/server/crypto";

/** Vercel Cron (see vercel.json): retries unprocessed booking events and prunes expired raw payloads. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  return NextResponse.json(await retryPending(db));
}
