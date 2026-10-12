import { NextResponse } from "next/server";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { listAssessments } from "@/server/admin/queries";
import { audit } from "@/server/audit";
import type { ListFilters, ListRow } from "@/server/admin/types";

const COLS: (keyof ListRow)[] = ["assessment_id", "created_at", "completed_at", "status", "sections_completed", "assessment_version", "client_name", "client_email",
  "contact_source", "email_delivery_state", "booking_state", "scheduled_start", "timezone", "payment_state", "report_status", "coach_review_state", "follow_up_status", "last_activity_at"];
const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

/** CSV of the table (no answers, no notes). Admin only, audited. */
export async function GET(req: Request) {
  const s = await coachForApi(req, { admin: true });
  if (s instanceof NextResponse) return s;
  const sp = new URL(req.url).searchParams;
  const f: ListFilters = Object.fromEntries(sp.entries()) as ListFilters;
  const rows: ListRow[] = [];
  await asCoach(s.db, s.ctx, async (sql) => {
    for (let page = 1; ; page++) {
      const r = await listAssessments(sql, { ...f, page });
      rows.push(...r.rows);
      if (page >= r.pages || page >= 400) break;
    }
    await audit(sql, s.ctx.userId, "list.exported", "assessment_list", "csv", { rows: rows.length });
  });
  const csv = [COLS.join(","), ...rows.map((r) => COLS.map((c) => cell(r[c])).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="life-map-assessments.csv"`, "Cache-Control": "no-store" } });
}
