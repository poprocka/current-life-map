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
import { bookingUrlForLinkToken, createBookingLink, handleBookingWebhook } from "@/server/booking/process";
import { introConversations } from "@/server/admin/queries";
import { deleteCancelledBooking } from "@/server/admin/mutations";
import { memoryFileStore } from "@/server/files";
import {
  addAttachment, attachAssessment, createInvite, createProfileForAssessment, deleteAttachment, deleteClientProfile, deleteSession, getAttachment,
  duplicateClients, listClients, loadClientProfile, mergeClients, profileForAssessment, revokeInvite, saveClientNote, saveSession, setStage,
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

  it("PDF email invites to apply for 1:1 coaching with a one-time Calendly link in the fragment, and invites replies", async () => {
    const adapter = calendlyAdapter(process.env)!;
    const { id, token } = await completed();
    await requestPdfEmail(db, token, "on@example.com", "https://map.example.com");
    const sent = email.sent.at(-1)!;
    expect(sent.text).toContain("Just reply to this email.");
    expect(sent.text).not.toMatch(/Deep Dive|\$125|payment/i);
    const m = sent.text.match(/https:\/\/map\.example\.com\/book#b=(\S+)/);
    expect(m).toBeTruthy();
    expect(sent.text).not.toContain(id); // no assessment id in the email
    expect(sent.html!).toContain(`>Apply for 1:1 coaching</a>`);
    expect(sent.html!).toContain(`href="https://map.example.com/book#b=${m![1]}"`);
    expect(sent.html!.replace(/href="[^"]*"/g, "")).not.toContain("/book#b="); // the URL itself is never shown
    const r = await bookingUrlForLinkToken(db, adapter, m![1]);
    if (!r.ok) throw new Error(r.error);
    expect(new URL(r.url).searchParams.get("utm_content")).toBe(m![1]);
    // Booking the introductory conversation through it links the assessment (free: no payment expected), then the link is spent
    const { body, invitee } = inviteeCreated({ token: m![1], email: "on@example.com", name: "On" });
    await handleBookingWebhook(db, adapter, calendlyHeaders(body), body);
    const b = (await pg.query<{ assessment_id: string; payment_state: string; needs_reconciliation: boolean }>(`select assessment_id, payment_state, needs_reconciliation from bookings where provider_invitee_id = $1`, [invitee])).rows[0];
    expect(b).toEqual({ assessment_id: id, payment_state: "not_required", needs_reconciliation: false });
    expect((await bookingUrlForLinkToken(db, adapter, m![1])).ok).toBe(false);
    expect((await bookingUrlForLinkToken(db, adapter, "v1.forged.9999999999.sig")).ok).toBe(false);
    // The coach portal lists it with the answers from Calendly's booking form
    const listed = (await asJana((sql) => introConversations(sql))).find((x) => x.assessment_id === id)!;
    expect(listed).toMatchObject({ booked_name: "On", booked_email: "on@example.com", booking_state: "confirmed" });
    expect(listed.intake_answers?.[0].answer).toBe("Why I feel stretched");
  });

  it("an admin can delete a cancelled booking (with the times it was rescheduled from), never an active one", async () => {
    const adapter = calendlyAdapter(process.env)!;
    const { token } = await completed();
    const link = await createBookingLink(db, adapter, token);
    if (!link.ok) throw new Error(link.error);
    const t = new URL(link.url).searchParams.get("utm_content")!;
    const first = inviteeCreated({ token: t, email: "del@example.com", name: "Del" });
    await handleBookingWebhook(db, adapter, calendlyHeaders(first.body), first.body);
    const id1 = (await pg.query<{ id: string }>(`select id from bookings where provider_invitee_id = $1`, [first.invitee])).rows[0].id;
    expect(await deleteCancelledBooking(db, JANA, id1)).toBe(false); // still confirmed
    const r1 = inviteeCanceled(first.invitee, true); await handleBookingWebhook(db, adapter, calendlyHeaders(r1), r1);
    const second = inviteeCreated({ token: t, email: "del@example.com", name: "Del", oldInvitee: first.invitee });
    await handleBookingWebhook(db, adapter, calendlyHeaders(second.body), second.body);
    const c2 = inviteeCanceled(second.invitee); await handleBookingWebhook(db, adapter, calendlyHeaders(c2), c2);
    const id2 = (await pg.query<{ id: string }>(`select id from bookings where provider_invitee_id = $1`, [second.invitee])).rows[0].id;
    expect(await deleteCancelledBooking(db, JANA, id2)).toBe(true);
    expect((await pg.query(`select 1 from bookings where id = any($1::uuid[])`, [[id1, id2]])).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from booking_events where booking_id = any($1::uuid[])`, [[id1, id2]])).rows).toHaveLength(0);
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
  it("same email on two records is suggested on the overview; merging moves everything to the kept record and folds the other", async () => {
    const { id: mapId } = await completed();
    const ins = async (name: string | null, mail: string, stage: string) => (await pg.query<{ id: string }>(
      `insert into clients (name, email, stage) values ($1, $2, $3) returning id`, [name, mail, stage])).rows[0].id;
    const prospect = await ins(null, "Dup@Example.com", "prospect");          // from the PDF request
    const lead = await ins("Dee Dup", "dup@example.com", "lead");             // from the Calendly booking
    await pg.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis) values ($1,$2,'pdf_request','consent'), ($1,$3,'booking','consent')`, [mapId, prospect, lead]);
    await asJana((sql) => saveClientNote(sql, JANA, prospect, { body: "note on the PDF record" }));

    const groups = await asJana((sql) => duplicateClients(sql));
    const g = groups.find((x) => x.email.toLowerCase() === "dup@example.com")!;
    expect(g.clients.map((c) => c.client_id)).toEqual([lead, prospect]);     // the Lead with a name is suggested to keep

    expect((await mergeClients(db, JANA, lead, await ins("Other", "other@example.com", "prospect"))).ok).toBe(false); // different email
    expect((await mergeClients(db, JANA, lead, prospect)).ok).toBe(true);
    const p = (await asJana((sql) => loadClientProfile(sql, viewer, prospect)))!;
    expect(p.client.id).toBe(lead);                                            // old address opens the kept profile
    expect(p.client.name).toBe("Dee Dup");
    expect(p.maps.map((m) => m.assessment_id)).toEqual([mapId]);
    expect(p.notes.map((n) => n.body)).toEqual(["note on the PDF record"]);
    expect((await asJana((sql) => duplicateClients(sql))).some((x) => x.email.toLowerCase() === "dup@example.com")).toBe(false);
    expect((await asJana((sql) => listClients(sql, { q: "dup@example.com" }))).map((c) => c.client_id)).toEqual([lead]);
    expect((await pg.query(`select 1 from clients where id = $1`, [prospect])).rows).toHaveLength(1); // folded, not deleted
  });
});
