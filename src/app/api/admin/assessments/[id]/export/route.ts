import { NextResponse } from "next/server";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { loadWorkspace } from "@/server/admin/queries";
import { audit } from "@/server/audit";

/** Subject-access export of one assessment (admin only, audited). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { admin: true });
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const data = await asCoach(s.db, s.ctx, async (sql) => {
    const w = await loadWorkspace(sql, { userId: s.ctx.userId, role: s.role }, id);
    if (w) await audit(sql, s.ctx.userId, "assessment.exported", "assessment", id);
    return w;
  });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { viewer: _v, audit: _a, ...exported } = data;
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...exported }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="assessment-${id}.json"`, "Cache-Control": "no-store" },
  });
}
