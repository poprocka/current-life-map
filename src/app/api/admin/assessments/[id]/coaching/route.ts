import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { setCoachingEnrollment } from "@/server/admin/mutations";

const Body = z.object({ enrolled: z.boolean(), since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  await asCoach(s.db, s.ctx, (sql) => setCoachingEnrollment(sql, s.ctx.userId, id, b.data.enrolled, b.data.since));
  return NextResponse.json({ ok: true });
}
