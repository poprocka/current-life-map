import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { calendlyAdapter } from "@/server/booking/calendly";
import { bookingUrlForLinkToken } from "@/server/booking/process";

/** The booking link in the PDF email lands on /book#b=<token>; the page posts the token here (body only, never a URL). */
const Body = z.object({ b: z.string().min(20).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = getDb(), adapter = calendlyAdapter();
  if (!db || !adapter) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const r = await bookingUrlForLinkToken(db, adapter, parsed.data.b).catch(() => null);
  if (!r) return NextResponse.json({ error: "failed" }, { status: 500 });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_configured" ? 503 : 410 });
  return NextResponse.json({ url: r.url });
}
