import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient, NOT_CONFIGURED } from "@/lib/supabase-server";
import { CONTENT_VERSION, questionById } from "@/content/v10/question-bank";
import { validate, isComplete } from "@/engine/navigation";

const Body = z.object({
  answers: z.record(z.string().max(64), z.union([z.string().max(4000), z.array(z.string().max(64)).max(8)])),
});

export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.json({ error: "bad_token" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Only accept known, enabled questions with valid option values.
  const rows = [];
  for (const [id, value] of Object.entries(parsed.data.answers)) {
    const q = questionById(id);
    if (!q || !q.enabled || validate(q, value) !== null) return NextResponse.json({ error: "invalid_answer", id }, { status: 422 });
    // Free-text reflections belong in the encrypted reflections table (Phase 5), never in scored responses.
    if (q.responseType === "text") continue;
    rows.push({ question_id: id, value, content_version: CONTENT_VERSION });
  }

  const db = serviceClient();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const { data: map } = await db.from("maps").select("id,status").eq("token", token).single();
  if (!map) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.from("responses").upsert(rows.map((r) => ({ ...r, map_id: map.id })));
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  const complete = isComplete(parsed.data.answers);
  await db.from("maps").update({
    updated_at: new Date().toISOString(),
    ...(complete && map.status !== "completed" ? { status: "completed", completed_at: new Date().toISOString() } : {}),
  }).eq("id", map.id);

  return NextResponse.json({ saved: rows.length, complete });
}
