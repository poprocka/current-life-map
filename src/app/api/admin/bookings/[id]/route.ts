import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { reconcileBooking } from "@/server/booking/process";
import { deleteCancelledBooking, resolveBooking, setBookingOutcome } from "@/server/admin/mutations";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reconcile"), assessmentId: z.string().uuid() }),
  z.object({ action: z.literal("outcome"), state: z.enum(["completed", "no_show"]) }),
  z.object({ action: z.literal("resolve") }),
  z.object({ action: z.literal("delete") }),   // admin only; cancelled bookings only
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = Body.safeParse(await req.json().catch(() => null));
  const s = await coachForApi(req, { mutation: true, admin: b.success && b.data.action === "delete" });
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!b.success || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const body = b.data;
  if (body.action === "delete") {
    const ok = await deleteCancelledBooking(s.db, s.ctx.userId, id);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }
  const ok = await asCoach(s.db, s.ctx, async (sql) =>
    body.action === "reconcile" ? (await reconcileBooking(sql, s.ctx.userId, id, body.assessmentId)).ok
    : body.action === "resolve" ? resolveBooking(sql, s.ctx.userId, id)
    : setBookingOutcome(sql, s.ctx.userId, id, (body as { state: "completed" | "no_show" }).state));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
