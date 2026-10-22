import { NextResponse } from "next/server";
import { z } from "zod";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { fileStoreForRequest } from "@/server/files";
import {
  attachAssessment, createInvite, deleteClientNote, deleteClientProfile, deleteSession, detachAssessment, mergeClients, revokeInvite,
  saveClientNote, saveSession, setClientDetails, setStage,
} from "@/server/admin/clients";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().regex(/^[0-9a-f-]{36}$/);
const text = z.string().max(20000);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stage"), stage: z.enum(["prospect", "lead", "client"]), since: date.nullable().optional() }),
  z.object({ action: z.literal("details"), name: z.string().max(120).nullable(), email: z.string().max(254).nullable(), phone: z.string().max(40).nullable() }),
  z.object({ action: z.literal("invite") }),
  z.object({ action: z.literal("revoke_invite") }),
  z.object({ action: z.literal("attach"), assessmentId: uuid }),
  z.object({ action: z.literal("detach"), assessmentId: uuid }),
  z.object({ action: z.literal("session"), session: z.object({
    id: uuid.optional(), session_date: date.nullable(), title: z.string().max(160).nullable(), kind: z.enum(["deep_dive", "coaching", "review", "other"]),
    assessment_id: uuid.nullable(), plan: text, notes: text, homework: text }) }),
  z.object({ action: z.literal("delete_session"), id: uuid }),
  z.object({ action: z.literal("note"), id: uuid.optional(), body: text }),
  z.object({ action: z.literal("delete_note"), id: uuid }),
  z.object({ action: z.literal("delete_profile"), confirm: z.literal("DELETE") }),
  z.object({ action: z.literal("merge"), mergeId: uuid }),
]);

/** Every client-profile action. Same-origin, verified coach with MFA; RLS applies underneath. Deleting a profile is admin-only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await req.json().catch(() => null);
  const b = Body.safeParse(raw);
  const s = await coachForApi(req, { mutation: true, admin: b.success && b.data.action === "delete_profile" });
  if (s instanceof NextResponse) return s;
  if (!b.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const me = s.ctx.userId, d = b.data;
  if (d.action === "merge") {
    const r = await mergeClients(s.db, me, id, d.mergeId);
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 400 });
  }
  const needsStore = d.action === "delete_session" || d.action === "delete_note" || d.action === "delete_profile";
  const store = needsStore ? await fileStoreForRequest() : null;
  if (needsStore && !store) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  const out = await asCoach(s.db, s.ctx, async (sql) => {
    switch (d.action) {
      case "stage": return setStage(sql, me, id, d.stage, d.since ?? null);
      case "details": await setClientDetails(sql, me, id, d); return { ok: true };
      case "invite": return { ok: true, token: await createInvite(sql, me, id) };
      case "revoke_invite": await revokeInvite(sql, me, id); return { ok: true };
      case "attach": return attachAssessment(sql, me, id, d.assessmentId);
      case "detach": await detachAssessment(sql, me, id, d.assessmentId); return { ok: true };
      case "session": { const sid = await saveSession(sql, me, id, d.session); return sid ? { ok: true, id: sid } : { ok: false, error: "not_found" }; }
      case "delete_session": await deleteSession(sql, store!, me, id, d.id); return { ok: true };
      case "note": { const nid = await saveClientNote(sql, me, id, d); return nid ? { ok: true, id: nid } : { ok: false, error: "empty" }; }
      case "delete_note": await deleteClientNote(sql, store!, me, id, d.id); return { ok: true };
      case "delete_profile": await deleteClientProfile(sql, store!, id); return { ok: true };
    }
  });
  return NextResponse.json(out, { status: (out as { ok?: boolean }).ok === false ? 400 : 200 });
}
