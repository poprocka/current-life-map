import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { searchAssessments } from "@/server/admin/queries";

const Body = z.object({ q: z.string().max(120) });

/** Search by name, email or assessment ID. POST so search terms (emails) never appear in URLs or logs. */
export async function POST(req: Request) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const hits = await asCoach(s.db, s.ctx, (sql) => searchAssessments(sql, b.data.q));
  return NextResponse.json({ hits });
}
