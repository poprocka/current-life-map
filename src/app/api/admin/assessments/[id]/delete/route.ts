import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";

const Body = z.object({ confirm: z.literal("DELETE") });

/** Hard delete (admin only). Cascades; orphaned contacts are removed; the deletion itself is audited. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { admin: true, mutation: true });
  if (s instanceof NextResponse) return s;
  if (!Body.safeParse(await req.json().catch(() => null)).success) return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  const { id } = await params;
  await asCoach(s.db, s.ctx, (sql) => sql.query(`select delete_assessment($1)`, [id]));
  return NextResponse.json({ deleted: true });
}
