import { NextResponse } from "next/server";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { frozenResult, loadAnswers } from "@/server/assessments";
import { generateResultInsights } from "@/engine/insights";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { buildResultsPdf as buildClientPdf } from "@/server/pdf/render";
import { audit } from "@/server/audit";

/** The client's PDF exactly as they receive it, regenerated from the frozen snapshot. Coach-only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req);
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const got = await asCoach(s.db, s.ctx, async (sql) => {
    const f = await frozenResult(sql, id);
    if (!f) return null;
    await audit(sql, s.ctx.userId, "client_pdf.viewed", "assessment", id);
    return { f, answers: await loadAnswers(sql, id, { includeText: true }) };
  });
  if (!got) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { f: frozen, answers } = got;
  const reflections = POST_MAP_REFLECTIONS.questions.filter((q) => typeof answers[q.id] === "string" && (answers[q.id] as string).trim()).map((q) => ({ prompt: q.prompt, text: answers[q.id] as string }));
  const pdf = await buildClientPdf(frozen.snapshot, { generatedAt: frozen.generatedAt, insights: generateResultInsights(frozen.snapshot, answers), reflections });
  return new NextResponse(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="current-life-map-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
}
