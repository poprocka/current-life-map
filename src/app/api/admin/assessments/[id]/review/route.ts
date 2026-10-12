import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { setReviewState } from "@/server/admin/mutations";

const Body = z.object({ reportId: z.string().uuid(), state: z.enum(["unreviewed", "in_review", "reviewed"]) });

export async function POST(req: Request) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const ok = await asCoach(s.db, s.ctx, (sql) => setReviewState(sql, s.ctx.userId, b.data.reportId, b.data.state));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
