import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { handleResendEvent, verifySvix } from "@/server/email";

export async function POST(req: Request) {
  const db = getDb(), secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!db || !secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  const h = req.headers;
  if (!verifySvix(secret, { id: h.get("svix-id"), timestamp: h.get("svix-timestamp"), signature: h.get("svix-signature") }, raw))
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  try {
    return NextResponse.json(await handleResendEvent(db, JSON.parse(raw)));
  } catch {
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
