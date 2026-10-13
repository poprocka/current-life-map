import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { downloadPdf } from "@/server/email";
import { saveReflections } from "@/server/assessments";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  token: z.string().min(20).max(64),
  reflections: z.record(z.string().max(20), z.string().max(2000)).optional(),
});

/** The results PDF, streamed to the person's browser. Token in the body, never in the URL; no caching. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  if (parsed.data.reflections && Object.keys(parsed.data.reflections).length)
    await saveReflections(db, parsed.data.token, parsed.data.reflections).catch(() => null);
  const r = await downloadPdf(db, parsed.data.token).catch(() => null);
  if (!r) return NextResponse.json({ error: "pdf_failed" }, { status: 502 });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 409 });
  return new NextResponse(Buffer.from(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="current-life-map.pdf"', "Cache-Control": "no-store" },
  });
}
