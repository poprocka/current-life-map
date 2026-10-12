import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { calendlyAdapter } from "@/server/booking/calendly";
import { handleBookingWebhook } from "@/server/booking/process";

export async function POST(req: Request) {
  const db = getDb(), adapter = calendlyAdapter();
  if (!db || !adapter) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  const r = await handleBookingWebhook(db, adapter, req.headers, raw);
  return NextResponse.json({ outcome: r.outcome }, { status: r.status });
}
