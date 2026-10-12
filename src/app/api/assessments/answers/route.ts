import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { saveAnswers } from "@/server/assessments";

const Body = z.object({
  token: z.string().min(20).max(64),
  answers: z.record(z.string().max(64), z.union([z.string().max(4000), z.array(z.string().max(64)).max(8)])),
});

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const r = await saveAnswers(db, parsed.data.token, parsed.data.answers).catch(() => null);
  if (!r) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  if (!r.ok) return NextResponse.json({ error: r.error, id: r.id }, { status: r.error === "not_found" ? 404 : 422 });
  return NextResponse.json({ saved: r.saved, complete: r.complete });
}
