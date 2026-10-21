import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { calendlyAdapter } from "@/server/booking/calendly";
import { createBookingLink } from "@/server/booking/process";

/**
 * "Apply for 1:1 coaching" → the Calendly page for the complimentary introductory conversation.
 * With this device's private results token, the link carries a one-time code so the booking attaches to that Map.
 * Without one (e.g. someone reading "Meet Jana" before taking the Self-Interview), it's the plain Calendly page.
 */
const Body = z.object({ token: z.string().min(20).max(64).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const adapter = calendlyAdapter(), plain = process.env.CALENDLY_SCHEDULING_URL;
  if (!adapter || !plain) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  if (!parsed.data.token) return NextResponse.json({ url: plain, linked: false });
  const db = getDb();
  if (!db) return NextResponse.json({ url: plain, linked: false });
  const r = await createBookingLink(db, adapter, parsed.data.token).catch(() => null);
  // A Map that can't be linked (not finished on this device, or not found) still gets the scheduling page
  if (!r || !r.ok) return r && !r.ok && r.error === "not_configured" ? NextResponse.json(NOT_CONFIGURED, { status: 503 }) : NextResponse.json({ url: plain, linked: false });
  return NextResponse.json({ url: r.url, linked: true });
}
