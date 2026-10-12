import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { saveScriptEdit } from "@/server/admin/mutations";
import type { DeepDiveScript } from "@/engine/coach/script";

const Item = z.object({ id: z.string().max(120), text: z.string().max(4000), evidence: z.array(z.object({ questionId: z.string().max(80), answer: z.string().max(400), kind: z.enum(["direct", "derived"]) })).max(20), basis: z.enum(["direct", "derived", "hypothesis", "coach"]), uncertainty: z.string().max(400).optional() });
const Body = z.object({
  bookingId: z.string().uuid().nullable(),
  content: z.object({
    templateVersion: z.string().max(40), versions: z.record(z.string(), z.string()), focusOrbits: z.array(z.string()).max(8), gaps: z.array(Item).max(200),
    blocks: z.array(z.object({ key: z.string().max(20), title: z.string().max(200), startMin: z.number().int().min(0).max(240), endMin: z.number().int().min(0).max(240), purpose: z.string().max(400), prompts: z.array(Item).max(60) })).max(12),
  }),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const version = await asCoach(s.db, s.ctx, (sql) => saveScriptEdit(sql, s.ctx.userId, id, b.data.content as unknown as DeepDiveScript, b.data.bookingId));
  return NextResponse.json({ version });
}
