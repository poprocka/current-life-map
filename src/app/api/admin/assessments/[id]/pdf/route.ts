import { NextResponse } from "next/server";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { frozenResult } from "@/server/assessments";
import { buildClientPdf } from "@/lib/pdf/clientReport";
import { audit } from "@/server/audit";

/** The client's PDF exactly as they receive it, regenerated from the frozen snapshot. Coach-only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req);
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const frozen = await asCoach(s.db, s.ctx, async (sql) => {
    const f = await frozenResult(sql, id);
    if (f) await audit(sql, s.ctx.userId, "client_pdf.viewed", "assessment", id);
    return f;
  });
  if (!frozen) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pdf = await buildClientPdf(frozen.snapshot, { generatedAt: frozen.generatedAt });
  return new NextResponse(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="current-life-map-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
}
