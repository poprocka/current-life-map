import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { saveNote } from "@/server/admin/mutations";
import { encryptionConfigured } from "@/server/crypto";

const Body = z.object({
  id: z.string().uuid().optional(), bookingId: z.string().uuid().nullable(), notes: z.string().max(20000),
  validatedFindings: z.record(z.string().max(160), z.enum(["not_discussed", "confirmed", "partly", "contradicted"])),
  agreedNextSteps: z.object({ steps: z.array(z.string().max(500)).max(10), coachingInquiry: z.boolean() }),
  followUpStatus: z.enum(["none", "planned", "sent", "done"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  if (!encryptionConfigured()) return NextResponse.json({ error: "encryption_not_configured" }, { status: 503 });
  const { id } = await params;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const noteId = await asCoach(s.db, s.ctx, (sql) => saveNote(sql, s.ctx.userId, id, b.data));
  return NextResponse.json({ id: noteId });
}
