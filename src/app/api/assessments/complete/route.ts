import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { completeAssessment } from "@/server/assessments";

const Body = z.object({ token: z.string().min(20).max(64) });

/** Freeze the versioned result snapshot and prepare coach material. Idempotent. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const r = await completeAssessment(db, parsed.data.token).catch(() => null);
  if (!r) return NextResponse.json({ error: "complete_failed" }, { status: 500 });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 409 });
  return NextResponse.json({ snapshot: r.sha256 });
}
