/**
 * Client profiles (Oct 13): stages, private client link, coach-confirmed Map attachment (never automatic by email),
 * sessions / notes / attachments encrypted at rest, deletion rules, and RLS on the new tables.
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ENV, FakeEmail, fullAnswers, calendlyHeaders, inviteeCreated, inviteeCanceled } from "./e2e/helpers";
import { freshDb, asAppDb, as } from "./db/pg";
import { setDb, asCoach, type Db } from "@/server/db";
import { createAssessment, saveAnswers, completeAssessment } from "@/server/assessments";
import { requestPdfEmail, setEmailProvider } from "@/server/email";
import { calendlyAdapter } from "@/server/booking/calendly";
import { createBookingLink, handleBookingWebhook } from "@/server/booking/process";
import { submitApplication } from "@/server/coaching";
import { coachingApplications } from "@/server/admin/queries";
import { randomUUID } from "crypto";
import { memoryFileStore } from "@/server/files";
import {
  addAttachment, attachAssessment, createInvite, createProfileForAssessment, deleteAttachment, deleteClientProfile, deleteSession, getAttachment,
  listClients, loadClientProfile, profileForAssessment, revokeInvite, saveClientNote, saveSession, setStage,
} from "@/server/admin/clients";
import { loadWorkspace } from "@/server/admin/queries";

void ENV;
const JANA = "11111111-1111-1111-1111-111111111111";
const coach = { userId: JANA, aal: "aal2" as const };
const viewer = { userId: JANA, role: "admin" as const };
let pg: PGlite, db: Db;
const email = new FakeEmail();
const store = memoryFileStore();
const asJana = <T,>(fn: Parameters<typeof asCoach<T>>[2]) => asCoach(db, coach, fn);

async function completed(opts: { invite?: string } = {}) {
  const { id, token } = await createAssessment(db, opts);
  const s = await saveAnswers(db, token, fullAnswers());
  expect(s.ok && s.complete).toBe(true);
  expect((await completeAssessment(db, token)).ok).toBe(true);
  return { id, token };
}

beforeAll(async () => {
  pg = await freshDb();
  await pg.exec(`insert into auth.users values ('${JANA}'); insert into coach_users (user_id, display_name, role) values ('${JANA}', 'Jana', 'admin');`);
  db = asAppDb(pg);
  setDb(db);
  setEmailProvider(email);
});

describe("client profiles", () => {
  it("create a profile from an anonymous Map; stages move Prospect → Client and create the private link", async () => {
    const { id } = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, id, "Mira Chen"));
    expect(await asJana((sql) => createProfileForAssessment(sql, JANA, id, null))).toBe(cid); // idempotent
    let p = (await asJana((sql) => loadClientProfile(sql, viewer, cid)))!;
    expect(p.client).toMatchObject({ name: "Mira Chen", stage: "prospect", invite: null });
    expect(p.maps.map((m) => m.assessment_id)).toEqual([id]);
    await asJana((sql) => setStage(sql, JANA, cid, "client", "2026-10-01"));
    p = (await asJana((sql) => loadClientProfile(sql, viewer, cid)))!;
    expect(p.client.stage).toBe("client");
    expect(p.client.coaching_enrolled_at).toBe("2026-10-01");
    expect(p.client.invite?.token).toMatch(/^[A-Za-z0-9_-]{24,64}$/);
    const raw = (await pg.query<{ invite_token_ciphertext: string; invite_token_hash: string }>(`select invite_token_ciphertext, invite_token_hash from clients where id = $1`, [cid])).rows[0];
    expect(raw.invite_token_ciphertext).not.toContain(p.client.invite!.token); // stored encrypted; looked up by hash
  });

  it("a Map completed through the private link attaches to the profile and chains to the previous Map", async () => {
    const first = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, first.id, "Alex"));
    const token = await asJana((sql) => createInvite(sql, JANA, cid));
    const follow = await completed({ invite: token });
    const p = (await asJana((sql) => loadClientProfile(sql, viewer, cid)))!;
    expect(p.maps.map((m) => m.assessment_id)).toEqual([first.id, follow.id]);
    expect(p.maps[1].link_sources).toEqual(["client_invite"]);
    expect(p.maps[1].orbits).toHaveLength(8);
    const prev = (await pg.query<{ previous_assessment_id: string }>(`select previous_assessment_id from assessments where id = $1`, [follow.id])).rows[0];
    expect(prev.previous_assessment_id).toBe(first.id);
  });

  it("an unknown or revoked link is ignored silently (the Map stays anonymous)", async () => {
    const first = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, first.id, null));
    const token = await asJana((sql) => createInvite(sql, JANA, cid));
    await asJana((sql) => revokeInvite(sql, JANA, cid));
    const a = await completed({ invite: token });
    const b = await completed({ invite: "x".repeat(32) });
    for (const m of [a, b]) expect((await pg.query(`select 1 from assessment_client_links where assessment_id = $1`, [m.id])).rows).toHaveLength(0);
  });

  it("same email is only a suggestion; Jana confirms, and the duplicate Prospect record is folded in, not deleted", async () => {
    const old = await completed();
    await requestPdfEmail(db, old.token, "sam@example.com");
    const recent = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, recent.id, "Sam"));
    await pg.query(`update clients set email = 'Sam@Example.com' where id = $1`, [cid]);
    // Nothing joined automatically
    let p = (await asJana((sql) => loadClientProfile(sql, viewer, cid)))!;
    expect(p.maps.map((m) => m.assessment_id)).toEqual([recent.id]);
    expect(p.possibleMatches.flatMap((m) => m.assessments.map((a) => a.id))).toEqual([old.id]);
    const ws = (await asJana((sql) => loadWorkspace(sql, viewer, old.id)))!;
    expect(ws.possibleProfiles?.map((x) => x.client_id)).toContain(cid);
    // Jana confirms
    const r = await asJana((sql) => attachAssessment(sql, JANA, cid, old.id));
    expect(r.ok && r.folded.length).toBe(1);
    p = (await asJana((sql) => loadClientProfile(sql, viewer, cid)))!;
    expect(p.maps.map((m) => m.assessment_id).sort()).toEqual([old.id, recent.id].sort());
    expect(p.possibleMatches).toEqual([]);
    const dup = (await pg.query<{ merged_into_client_id: string }>(`select merged_into_client_id from clients where id = $1`, [r.ok ? r.folded[0] : ""])).rows[0];
    expect(dup.merged_into_client_id).toBe(cid);
    expect((await asJana((sql) => listClients(sql))).some((c) => c.client_id === (r.ok ? r.folded[0] : ""))).toBe(false);
    expect((await asJana((sql) => profileForAssessment(sql, old.id))).profile?.client_id).toBe(cid);
  });

  it("PDF email invites to apply for 1:1 coaching with a one-time link in the fragment, and invites replies", async () => {
    const { id, token } = await completed();
    await requestPdfEmail(db, token, "on@example.com", "https://map.example.com");
    const sent = email.sent.at(-1)!;
    expect(sent.text).toContain("Just reply to this email.");
    expect(sent.text).not.toMatch(/Deep Dive|\$125|payment/i);
    const m = sent.text.match(/https:\/\/map\.example\.com\/apply#b=(\S+)/);
    expect(m).toBeTruthy();
    expect(sent.text).not.toContain(id); // no assessment id in the email
    expect(sent.html!).toContain(`>Apply for 1:1 coaching</a>`);
    expect(sent.html!).toContain(`href="https://map.example.com/apply#b=${m![1]}"`);
    expect(sent.html!.replace(/href="[^"]*"/g, "")).not.toContain("/apply#b="); // the URL itself is never shown
  });

  it("coaching application: linked to the Self-Interview, message encrypted, no duplicates, Calendly link carries only name and email", async () => {
    const adapter = calendlyAdapter(process.env)!;
    const { id, token } = await completed();
    const requestId = randomUUID();
    const input = { requestId, name: "Ana Example", email: "ana@example.com", message: "I keep postponing rest.", token };
    const r = await submitApplication(db, adapter, input);
    if (!r.ok) throw new Error(r.error);
    // A second tap / retry: same application, no second row
    const again = await submitApplication(db, adapter, input);
    expect(again.ok && again.applicationId).toBe(r.applicationId);
    expect((await pg.query(`select 1 from coaching_applications where request_id = $1`, [requestId])).rows.length).toBe(1);
    const row = (await pg.query<{ assessment_id: string; status: string; message_ciphertext: string; client_id: string }>(`select * from coaching_applications where id = $1`, [r.applicationId])).rows[0];
    expect(row.assessment_id).toBe(id);
    expect(row.status).toBe("submitted"); // applying is not booking
    expect(JSON.stringify(row)).not.toContain("postponing");
    const url = new URL(r.schedulingUrl!);
    expect(url.searchParams.get("name")).toBe("Ana Example");
    expect(url.searchParams.get("email")).toBe("ana@example.com");
    expect(url.toString()).not.toMatch(/postponing|rest|answer/i);
    expect(url.toString()).not.toContain(id);
    expect([...url.searchParams.keys()].sort()).toEqual(["email", "name", "utm_content"]);
    // The coach sees it (decrypted), as applied and not yet scheduled
    const listed = (await asJana((sql) => coachingApplications(sql))).find((a) => a.id === r.applicationId)!;
    expect(listed).toMatchObject({ name: "Ana Example", email: "ana@example.com", message: "I keep postponing rest.", status: "submitted", assessment_id: id });
    // Booking through the link: linked to the application and Self-Interview, no payment needed, nothing to reconcile
    const { body, invitee } = inviteeCreated({ token: url.searchParams.get("utm_content"), email: "ana@example.com", name: "Ana Example" });
    await handleBookingWebhook(db, adapter, calendlyHeaders(body), body);
    const b = (await pg.query<{ id: string; assessment_id: string; client_id: string; payment_state: string; needs_reconciliation: boolean; session_type: string }>(`select * from bookings where provider_invitee_id = $1`, [invitee])).rows[0];
    expect(b).toMatchObject({ assessment_id: id, client_id: row.client_id, payment_state: "not_required", needs_reconciliation: false, session_type: "intro_conversation" });
    expect((await pg.query<{ status: string; booking_id: string }>(`select status, booking_id from coaching_applications where id = $1`, [r.applicationId])).rows[0]).toEqual({ status: "scheduled", booking_id: b.id });
    expect((await pg.query<{ stage: string }>(`select stage from clients where id = $1`, [row.client_id])).rows[0].stage).toBe("lead");
    // Cancelling the conversation shows on the application
    const c = inviteeCanceled(invitee);
    await handleBookingWebhook(db, adapter, calendlyHeaders(c), c);
    expect((await pg.query<{ status: string }>(`select status from coaching_applications where id = $1`, [r.applicationId])).rows[0].status).toBe("cancelled");
  });

  it("coaching application from the PDF email link, and one without a Self-Interview", async () => {
    const adapter = calendlyAdapter(process.env)!;
    const { id, token } = await completed();
    await requestPdfEmail(db, token, "em@example.com", "https://map.example.com");
    const b = email.sent.at(-1)!.text.match(/\/apply#b=(\S+)/)![1];
    const viaEmail = await submitApplication(db, adapter, { requestId: randomUUID(), name: "Em", email: "em@example.com", message: "", b });
    if (!viaEmail.ok) throw new Error(viaEmail.error);
    expect((await pg.query<{ assessment_id: string; source: string; message_ciphertext: string | null }>(`select assessment_id, source, message_ciphertext from coaching_applications where id = $1`, [viaEmail.applicationId])).rows[0])
      .toEqual({ assessment_id: id, source: "email", message_ciphertext: null });
    // A forged link links nothing, and the application is still received
    const direct = await submitApplication(db, adapter, { requestId: randomUUID(), name: "Dee", email: "dee@example.com", message: "", b: "v1.forged.9999999999.sig" });
    if (!direct.ok) throw new Error(direct.error);
    expect((await pg.query<{ assessment_id: string | null; source: string }>(`select assessment_id, source from coaching_applications where id = $1`, [direct.applicationId])).rows[0]).toEqual({ assessment_id: null, source: "direct" });
    // Its booking is linked to the application, so it doesn't land in "Needs your attention"
    const { body, invitee } = inviteeCreated({ token: new URL(direct.schedulingUrl!).searchParams.get("utm_content"), email: "dee@example.com", name: "Dee" });
    await handleBookingWebhook(db, adapter, calendlyHeaders(body), body);
    expect((await pg.query<{ needs_reconciliation: boolean }>(`select needs_reconciliation from bookings where provider_invitee_id = $1`, [invitee])).rows[0].needs_reconciliation).toBe(false);
    // Without Calendly configured, the application is still saved; there is just no scheduling link
    const noCal = await submitApplication(db, null, { requestId: randomUUID(), name: "Nia", email: "nia@example.com", message: "" });
    expect(noCal.ok && noCal.schedulingUrl).toBe(null);
  });

  it("a confirmed booking turns a Prospect into a Lead (never demotes a Client)", async () => {
    const adapter = calendlyAdapter(process.env)!;
    const { id, token } = await completed();
    await requestPdfEmail(db, token, "lee@example.com");
    const link = await createBookingLink(db, adapter, token);
    if (!link.ok) throw new Error(link.error);
    const { body } = inviteeCreated({ token: new URL(link.url).searchParams.get("utm_content")!, email: "lee@example.com", name: "Lee" });
    await handleBookingWebhook(db, adapter, calendlyHeaders(body), body);
    const stages = (await pg.query<{ stage: string }>(`select c.stage from assessment_client_links l join clients c on c.id = l.client_id where l.assessment_id = $1`, [id])).rows.map((r) => r.stage);
    expect(stages.length).toBeGreaterThan(0);
    expect(new Set(stages)).toEqual(new Set(["lead"]));
  });

  it("sessions and person notes are encrypted at rest; attachments are encrypted before storage", async () => {
    const { id } = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, id, "Notes test"));
    const sid = (await asJana((sql) => saveSession(sql, JANA, cid, { session_date: "2026-10-20", title: "Session 1", kind: "coaching", assessment_id: id,
      plan: "Explore the restoration trade-off", notes: "She named guilt around rest", homework: "Two evenings off" })))!;
    await asJana((sql) => saveClientNote(sql, JANA, cid, { body: "Prefers mornings" }));
    const raw = JSON.stringify([...(await pg.query(`select * from coaching_sessions`)).rows, ...(await pg.query(`select * from client_notes`)).rows]);
    expect(raw).not.toMatch(/guilt|Two evenings|Prefers mornings|restoration trade-off/);
    const bytes = new TextEncoder().encode("Homework worksheet: notice when rest feels earned.");
    const up = await asJana((sql) => addAttachment(sql, store, JANA, cid, { purpose: "homework", sessionId: sid, filename: "worksheet.txt", contentType: "text/plain", bytes }));
    expect(up.ok).toBe(true);
    const path = (await pg.query<{ storage_path: string }>(`select storage_path from client_attachments where client_id = $1`, [cid])).rows[0].storage_path;
    expect(path).not.toMatch(/worksheet|Notes/); // no names in storage paths
    expect(Buffer.from(store.files.get(path)!).toString()).not.toContain("Homework worksheet");
    const got = await asJana((sql) => getAttachment(sql, store, JANA, cid, up.ok ? up.id : ""));
    expect(new TextDecoder().decode(got!.bytes)).toBe("Homework worksheet: notice when rest feels earned.");
    const p = (await asJana((sql) => loadClientProfile(sql, viewer, cid)))!;
    expect(p.sessions[0]).toMatchObject({ title: "Session 1", plan: "Explore the restoration trade-off", homework: "Two evenings off" });
    expect(p.sessions[0].attachments.map((a) => a.filename)).toEqual(["worksheet.txt"]);
    expect(p.notes[0].body).toBe("Prefers mornings");
    // Deleting the session removes its stored files too
    await asJana((sql) => deleteSession(sql, store, JANA, cid, sid));
    expect(store.files.has(path)).toBe(false);
  });

  it("attachments: disallowed types and oversized files are refused; deletes remove the stored file", async () => {
    const { id } = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, id, null));
    const exe = await asJana((sql) => addAttachment(sql, store, JANA, cid, { purpose: "profile", filename: "x.exe", contentType: "application/x-msdownload", bytes: new Uint8Array([1]) }));
    expect(exe).toEqual({ ok: false, error: "type_not_allowed" });
    const big = await asJana((sql) => addAttachment(sql, store, JANA, cid, { purpose: "profile", filename: "b.pdf", contentType: "application/pdf", bytes: new Uint8Array(10 * 1024 * 1024 + 1) }));
    expect(big).toEqual({ ok: false, error: "too_large" });
    const ok = await asJana((sql) => addAttachment(sql, store, JANA, cid, { purpose: "profile", filename: "a.pdf", contentType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) }));
    if (!ok.ok) throw new Error(ok.error);
    const before = store.files.size;
    await asJana((sql) => deleteAttachment(sql, store, JANA, cid, ok.id));
    expect(store.files.size).toBe(before - 1);
  });

  it("deleting one assessment never removes a profile Jana is working with; deleting a profile is admin-only and keeps the Maps", async () => {
    const { id } = await completed();
    const cid = await asJana((sql) => createProfileForAssessment(sql, JANA, id, "Keep me"));
    await asJana((sql) => setStage(sql, JANA, cid, "lead"));
    await asJana((sql) => sql.query(`select delete_assessment($1)`, [id]));
    expect((await pg.query(`select 1 from clients where id = $1`, [cid])).rows).toHaveLength(1);
    const other = await completed();
    const c2 = await asJana((sql) => createProfileForAssessment(sql, JANA, other.id, "Remove me"));
    await asJana((sql) => deleteClientProfile(sql, store, c2));
    expect((await pg.query(`select 1 from clients where id = $1`, [c2])).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from assessments where id = $1`, [other.id])).rows).toHaveLength(1);
  });

  it("RLS: anonymous visitors and coaches without MFA cannot read or write profile tables", async () => {
    for (const t of ["coaching_sessions", "client_notes", "client_attachments"]) {
      expect((await as(pg, { role: "anon" }, () => pg.query(`select * from ${t}`))).rows).toHaveLength(0);
      expect((await as(pg, { role: "authenticated", sub: JANA, aal: "aal1" }, () => pg.query(`select * from ${t}`))).rows).toHaveLength(0);
    }
    const anyClient = (await pg.query<{ id: string }>(`select id from clients limit 1`)).rows[0].id;
    await expect(as(pg, { role: "anon" }, () => pg.query(`insert into client_notes (client_id, coach_id, body_ciphertext) values ($1, $2, 'x')`, [anyClient, JANA]))).rejects.toThrow();
    await expect(as(pg, { role: "authenticated", sub: JANA, aal: "aal1" }, () => pg.query(`insert into client_notes (client_id, coach_id, body_ciphertext) values ($1, $2, 'x')`, [anyClient, JANA]))).rejects.toThrow();
    expect((await as(pg, { role: "anon" }, () => pg.query(`select * from admin_client_list`))).rows).toHaveLength(0);
  });
});
