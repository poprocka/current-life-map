import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { createProfileForAssessment } from "@/server/admin/clients";

const Body = z.object({ name: z.string().max(120).nullable().optional() });

/** "Create client profile" from a Map (reuses the record already linked to it). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const clientId = await asCoach(s.db, s.ctx, (sql) => createProfileForAssessment(sql, s.ctx.userId, id, b.data.name ?? null));
  return NextResponse.json({ clientId });
}
