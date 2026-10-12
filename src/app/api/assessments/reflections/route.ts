import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { saveReflections } from "@/server/assessments";

const Body = z.object({ token: z.string().min(20).max(64), reflections: z.record(z.string().max(20), z.string().max(2000)) });

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const r = await saveReflections(db, parsed.data.token, parsed.data.reflections).catch(() => null);
  if (!r) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : r.error === "not_configured" ? 503 : 422 });
  return NextResponse.json({ saved: r.saved });
}
