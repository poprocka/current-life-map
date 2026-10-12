import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { saveReportVersion } from "@/server/admin/mutations";
import type { CoachReport } from "@/engine/coach/report";

const Body = z.object({ content: z.record(z.string(), z.unknown()) });

/** Save Jana's edits to the Coach Report as a new version (original kept). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const raw = await req.text();
  if (raw.length > 400_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const b = Body.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  const rid = await asCoach(s.db, s.ctx, (sql) => saveReportVersion(sql, s.ctx.userId, id, b.data.content as unknown as CoachReport));
  return NextResponse.json({ id: rid });
}
