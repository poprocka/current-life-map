import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { handleStripeEvent, verifyStripeSignature } from "@/server/booking/stripe";

export async function POST(req: Request) {
  const db = getDb(), secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!db || !secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyStripeSignature(secret, req.headers.get("stripe-signature"), raw)) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  try {
    const r = await handleStripeEvent(db, JSON.parse(raw));
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
