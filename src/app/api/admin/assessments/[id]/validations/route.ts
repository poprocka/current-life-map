import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { saveValidation } from "@/server/admin/mutations";
import { encryptionConfigured } from "@/server/crypto";

const Body = z.object({ insightId: z.string().max(160), title: z.string().max(200), status: z.enum(["confirmed", "clarified", "challenged", "not_discussed"]), note: z.string().max(4000).nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (b.data.note && !encryptionConfigured()) return NextResponse.json({ error: "encryption_not_configured" }, { status: 503 });
  const { id } = await params;
  await asCoach(s.db, s.ctx, (sql) => saveValidation(sql, s.ctx.userId, id, b.data));
  return NextResponse.json({ ok: true });
}
