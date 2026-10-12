import { NextResponse } from "next/server";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { createAssessment } from "@/server/assessments";

/** Start an anonymous assessment. Returns an opaque access token (only its hash is stored). */
export async function POST() {
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  try {
    const { token } = await createAssessment(db);
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
