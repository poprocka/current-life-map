import { NextResponse } from "next/server";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { createAssessment } from "@/server/assessments";

/**
 * Start an assessment. Returns an opaque access token (only its hash is stored).
 * Optional body { invite }: a private client link token (from the URL fragment, never the query string).
 */
export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const body = (await req.json().catch(() => null)) as { invite?: unknown; source?: unknown; campaign?: unknown } | null;
  const invite = typeof body?.invite === "string" ? body.invite : null;
  try {
    // source / campaign: the channel slug (e.g. "instagram"), validated again on the server; anything else is dropped.
    const { token } = await createAssessment(db, { invite, source: body?.source, campaign: body?.campaign });
    // Whether the invite matched is not revealed to the browser.
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
