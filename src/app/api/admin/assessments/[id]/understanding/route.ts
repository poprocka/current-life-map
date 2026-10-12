import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { generateUnderstanding, saveUnderstandingEdit } from "@/server/admin/mutations";
import { encryptionConfigured } from "@/server/crypto";
import type { UnderstandingDocument } from "@/engine/coach/understanding";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate") }),
  z.object({ action: z.literal("save"), content: z.record(z.string(), z.unknown()) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  if (!encryptionConfigured()) return NextResponse.json({ error: "encryption_not_configured" }, { status: 503 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  const body = b.data;
  if (body.action === "generate") {
    const r = await asCoach(s.db, s.ctx, (sql) => generateUnderstanding(sql, s.ctx.userId, id));
    return r.ok ? NextResponse.json({ version: r.version, content: r.doc }) : NextResponse.json({ error: r.error }, { status: 409 });
  }
  const v = await asCoach(s.db, s.ctx, (sql) => saveUnderstandingEdit(sql, s.ctx.userId, id, body.content as unknown as UnderstandingDocument));
  return NextResponse.json({ version: v });
}
