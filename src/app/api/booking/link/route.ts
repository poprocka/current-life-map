import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { calendlyAdapter } from "@/server/booking/calendly";
import { createBookingLink } from "@/server/booking/process";

const Body = z.object({ token: z.string().min(20).max(64) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const db = getDb(), adapter = calendlyAdapter();
  if (!db || !adapter) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const r = await createBookingLink(db, adapter, parsed.data.token).catch(() => null);
  if (!r) return NextResponse.json({ error: "link_failed" }, { status: 500 });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_configured" ? 503 : r.error === "not_found" ? 404 : 409 });
  return NextResponse.json({ url: r.url });
}
