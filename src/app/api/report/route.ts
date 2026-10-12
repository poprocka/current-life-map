import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { requestPdfEmail } from "@/server/email";

const Body = z.object({ email: z.string().email().max(254), token: z.string().min(20).max(64).optional() });

/** Email the client PDF. Never reports success unless the email provider accepted the message. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  if (!parsed.data.token) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const r = await requestPdfEmail(db, parsed.data.token, parsed.data.email).catch(() => ({ ok: false as const, error: "send_failed" as const }));
  if (r.ok) return NextResponse.json({ state: r.state });
  const status = { not_configured: 503, not_found: 404, not_completed: 409, send_failed: 502 }[r.error];
  return NextResponse.json({ error: r.error }, { status });
}
