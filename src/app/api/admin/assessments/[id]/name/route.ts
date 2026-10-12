import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { setDisplayName } from "@/server/admin/mutations";

const Body = z.object({ name: z.string().max(120).nullable() });

/** Coach adds or corrects the name shown for an assessment. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  await asCoach(s.db, s.ctx, (sql) => setDisplayName(sql, s.ctx.userId, id, b.data.name));
  return NextResponse.json({ ok: true });
}
