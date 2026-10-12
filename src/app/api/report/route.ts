import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({ email: z.string().email().max(254), mapToken: z.string().min(20).max(64).optional() });

/**
 * PDF delivery (Phase 5). Until Resend and PDF rendering are connected this route
 * returns 503 so the UI says "nothing was sent" — it never simulates success.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "delivery_not_configured" }, { status: 503 });
  // Phase 5: render PDF from the stored result snapshot, send via Resend, record report_deliveries row.
  return NextResponse.json({ error: "delivery_not_implemented" }, { status: 503 });
}
