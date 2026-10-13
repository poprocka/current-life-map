/**
 * Addendum §9 acceptance tests, end to end against the real schema + RLS (embedded Postgres),
 * with fake emails and signed fake Calendly / Stripe webhooks.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { inflateSync } from "zlib";
import type { PGlite } from "@electric-sql/pglite";
import { ENV, FakeEmail, fullAnswers, calendlyHeaders, inviteeCreated, inviteeCanceled, stripeHeaders } from "./helpers";
import { freshDb, asAppDb } from "../db/pg";
import { setDb, asCoach, type Db } from "@/server/db";
import { createAssessment, saveAnswers, completeAssessment, frozenResult, loadAnswers } from "@/server/assessments";
import { requestPdfEmail, setEmailProvider } from "@/server/email";
import { calendlyAdapter } from "@/server/booking/calendly";
import { createBookingLink, handleBookingWebhook, reconcileBooking } from "@/server/booking/process";
import { handleStripeEvent, verifyStripeSignature } from "@/server/booking/stripe";
import { listAssessments, loadWorkspace, reconciliationQueue } from "@/server/admin/queries";
import { saveScriptEdit, saveNote } from "@/server/admin/mutations";
import { computeLifeMap } from "@/engine/compute";
import { buildClientPdf } from "@/lib/pdf/clientReport";
import { reportModel } from "@/lib/pdf/model";
import { snapshotFingerprint } from "@/lib/stable";
import { winAnsi } from "@/lib/pdf/clientReport";
import { NOT_APPLICABLE } from "@/content/types";
import { CURRENT_SCORING, PROVISIONAL_1 } from "@/engine/config/scoring";

const JANA = "11111111-1111-1111-1111-111111111111";
const STRANGER = "33333333-3333-3333-3333-333333333333";
const coach = { userId: JANA, aal: "aal2" as const };
let pg: PGlite, db: Db;
const email = new FakeEmail();
const adapter = calendlyAdapter(process.env)!;

async function completedAssessment() {
  const { id, token } = await createAssessment(db);
  const s = await saveAnswers(db, token, fullAnswers());
  expect(s.ok && s.complete).toBe(true);
  const c = await completeAssessment(db, token);
  expect(c.ok).toBe(true);
  await saveReflections(db, token, { "postmap.01": "That I keep postponing rest." });
  return { id, token };
}
const webhook = (body: string, headers = calendlyHeaders(body)) => handleBookingWebhook(db, adapter, headers, body);
async function bookingToken(token: string) {
  const r = await createBookingLink(db, adapter, token);
  if (!r.ok) throw new Error(r.error);
  return new URL(r.url).searchParams.get("utm_content")!;
}
const asJana = <T,>(fn: Parameters<typeof asCoach<T>>[2]) => asCoach(db, coach, fn);

/** Text drawn by pdf-lib is hex-encoded inside Flate-compressed content streams. */
function pdfText(bytes: Uint8Array) {
  const buf = Buffer.from(bytes), raw = buf.toString("latin1");
  let out = "";
  for (const m of raw.matchAll(/stream\r?\n/g)) {
    const start = m.index! + m[0].length, end = raw.indexOf("endstream", start);
    try { out += inflateSync(buf.subarray(start, end)).toString("latin1"); } catch { /* not a content stream */ }
  }
  return [...out.matchAll(/<([0-9A-Fa-f]+)> Tj/g)].map((x) => Buffer.from(x[1], "hex").toString("latin1")).join("\n");
}

beforeAll(async () => {
  pg = await freshDb();
  await pg.exec(`insert into auth.users values ('${JANA}'), ('${STRANGER}'); insert into coach_users (user_id, display_name, role) values ('${JANA}', 'Jana', 'admin');`);
  db = asAppDb(pg);
  setDb(db);
  setEmailProvider(email);
});

describe("§9 acceptance", () => {
  it("1. anonymous completion creates a CMS row with no fabricated identity", async () => {
    const { id } = await completedAssessment();
    const list = await asJana((sql) => listAssessments(sql, { q: id.slice(0, 8) }));
    const row = list.rows.find((r) => r.assessment_id === id)!;
    expect(row.status).toBe("completed");
    expect(row.sections_completed).toBe(10);
    expect(row.client_name).toBeNull();
    expect(row.client_email).toBeNull();
    expect(row.contact_source).toBeNull();
    expect(row.report_status).toBe("ready");
    const clients = await pg.query(`select 1 from assessment_client_links where assessment_id = $1`, [id]);
    expect(clients.rows).toHaveLength(0);
  });

  it("2. downloaded PDF matches the results exactly (same snapshot, same fingerprint, same text)", async () => {
    const { id } = await completedAssessment();
    const frozen = (await frozenResult(db, id))!;
    // What the respondent's browser computes from their own answers (free text never affects scoring)
    const local = computeLifeMap(fullAnswers());
    expect(await snapshotFingerprint(local)).toBe(frozen.sha256);
    const text = pdfText(await buildClientPdf(local));
    const m = reportModel(frozen.snapshot);
    for (const r of m.table) { expect(text).toContain(r.name); expect(text).toContain(r.energy); }
    for (const s of m.snapshot) expect(text.replace(/\n/g, " ")).toContain(winAnsi(s.body).split(" ").slice(0, 6).join(" "));
    expect(text).toContain(frozen.sha256.slice(0, 12));
    expect(text).not.toContain("That I keep postponing rest"); // optional reflections are not in the PDF
  });

  it("3. emailed PDF: email stored and tracked; marketing consent stays false", async () => {
    const { id, token } = await completedAssessment();
    const r = await requestPdfEmail(db, token, "sam@example.com");
    expect(r).toEqual({ ok: true, state: "sent" });
    const last = email.sent.at(-1)!;
    expect(last.to).toBe("sam@example.com");
    expect(last.attachments?.[0].filename).toBe("current-life-map.pdf");
    expect(last.text).not.toMatch(/https?:\/\//); // no download links at all, let alone public ones
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.pdfRequests[0]).toMatchObject({ email: "sam@example.com", delivery_state: "sent", provider_message_id: expect.stringMatching(/^msg_/), marketing_consent: false });
    expect(ws.clients).toEqual([expect.objectContaining({ email: "sam@example.com", link_source: "pdf_request" })]);
    expect(ws.consents.map((c) => c.consent_type)).toEqual(["pdf_delivery"]);

    email.fail = true;
    const f = await requestPdfEmail(db, token, "sam@example.com");
    email.fail = false;
    expect(f).toEqual({ ok: false, error: "send_failed" }); // never claims success
    const states = (await pg.query<{ delivery_state: string }>(`select delivery_state from pdf_requests where assessment_id = $1 order by requested_at`, [id])).rows;
    expect(states.map((s) => s.delivery_state)).toEqual(["sent", "failed"]);
    const sameClient = await pg.query(`select 1 from assessment_client_links where assessment_id = $1`, [id]);
    expect(sameClient.rows).toHaveLength(1); // repeat request did not duplicate the contact
  });

  it("4. booking via verified webhook links to the right assessment; workspace has everything", async () => {
    const { id, token } = await completedAssessment();
    const other = await completedAssessment();
    const linkToken = await bookingToken(token);
    expect(linkToken).not.toContain(id); // the URL carries no assessment id
    const { body } = inviteeCreated({ token: linkToken, email: "alex@example.com" });
    const r = await webhook(body);
    expect(r).toEqual({ status: 200, outcome: "linked" });

    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.answers.length).toBeGreaterThan(90);
    expect(ws.result?.snapshot.versions.scoring).toBe(CURRENT_SCORING.scoringVersion);
    expect(ws.coachReport?.content.sections.length).toBeGreaterThan(3);
    expect(ws.scripts.length).toBe(2); // generated at completion + regenerated with booking intake
    expect(ws.scripts[0].content.blocks.map((b) => [b.startMin, b.endMin])).toEqual([[0, 10], [10, 20], [20, 35], [35, 45], [45, 55], [55, 60]]);
    expect(ws.scripts[0].content.blocks[0].prompts.some((p) => p.text.includes("Why I feel stretched"))).toBe(true);
    expect(ws.bookings[0]).toMatchObject({ booking_state: "confirmed", payment_state: "paid", timezone: "Europe/Lisbon", meeting_url: "https://zoom.us/j/123", needs_reconciliation: false });
    expect(ws.clients.find((c) => c.link_source === "booking")?.email).toBe("alex@example.com");
    const otherWs = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, other.id)))!;
    expect(otherWs.bookings).toHaveLength(0);

    // forged signature is rejected; nothing is written
    const forged = inviteeCreated({ token: linkToken });
    expect((await webhook(forged.body, calendlyHeaders(forged.body, "wrong-key"))).status).toBe(401);
    expect((await webhook(forged.body, calendlyHeaders(forged.body, ENV.CALENDLY_WEBHOOK_SIGNING_KEY, Math.floor(Date.now() / 1000) - 3600))).status).toBe(401);
    expect((await pg.query(`select 1 from bookings where provider_invitee_id = $1`, [forged.invitee])).rows).toHaveLength(0);
  });

  it("5. duplicate, reschedule, cancel, refund — no duplicated client or assessment", async () => {
    const { id, token } = await completedAssessment();
    const t = await bookingToken(token);
    const first = inviteeCreated({ token: t, email: "lee@example.com" });
    await webhook(first.body);
    expect((await webhook(first.body)).outcome).toBe("duplicate"); // provider retry

    // reschedule = cancel (rescheduled) + new invitee referencing old_invitee
    expect((await webhook(inviteeCanceled(first.invitee, true))).outcome).toBe("rescheduled");
    const second = inviteeCreated({ token: t, email: "lee@example.com", oldInvitee: first.invitee, paid: false });
    expect((await webhook(second.body)).outcome).toBe("rescheduled");

    let bookings = (await pg.query<{ booking_state: string; payment_state: string; payment_reference: string; needs_reconciliation: boolean }>(
      `select booking_state, payment_state, payment_reference, needs_reconciliation from bookings where assessment_id = $1 order by created_at`, [id])).rows;
    expect(bookings.map((b) => b.booking_state)).toEqual(["rescheduled", "confirmed"]);
    expect(bookings[1].payment_state).toBe("paid"); // carried over from the original payment
    expect(bookings[1].needs_reconciliation).toBe(false);

    // genuine cancellation of a paid booking → flagged for refund decision
    await webhook(inviteeCanceled(second.invitee));
    // Stripe refund confirmation
    const evt = { id: "evt_1", type: "charge.refunded", data: { object: { id: bookings[1].payment_reference, amount: 12500, amount_refunded: 12500, refunded: true } } };
    const raw = JSON.stringify(evt);
    expect(verifyStripeSignature(ENV.STRIPE_WEBHOOK_SECRET, stripeHeaders(raw), raw)).toBe(true);
    expect(verifyStripeSignature(ENV.STRIPE_WEBHOOK_SECRET, stripeHeaders(raw, "whsec_wrong"), raw)).toBe(false);
    expect(await handleStripeEvent(db, evt)).toEqual({ duplicate: false, updated: 2 });
    expect((await handleStripeEvent(db, evt)).duplicate).toBe(true);

    bookings = (await pg.query<never>(`select booking_state, payment_state, needs_reconciliation from bookings where assessment_id = $1 order by created_at`, [id])).rows;
    expect(bookings.map((b: { booking_state: string }) => b.booking_state)).toEqual(["rescheduled", "cancelled"]);
    expect(bookings.map((b: { payment_state: string }) => b.payment_state)).toEqual(["refunded", "refunded"]);
    const links = await pg.query(`select 1 from assessment_client_links where assessment_id = $1`, [id]);
    expect(links.rows).toHaveLength(1);
    expect((await pg.query(`select 1 from assessments where id = $1`, [id])).rows).toHaveLength(1);
  });

  it("6. unmatched webhook is quarantined for manual review, then reconciled", async () => {
    const { id } = await completedAssessment();
    const noToken = inviteeCreated({ token: null, email: "pat@example.com" });
    expect((await webhook(noToken.body)).outcome).toBe("quarantined");
    const bogus = inviteeCreated({ token: "v1.abc.9999999999.forged", email: "kim@example.com" });
    expect((await webhook(bogus.body)).outcome).toBe("quarantined");
    expect((await webhook(inviteeCanceled("https://api.calendly.com/scheduled_events/X/invitees/UNKNOWN"))).outcome).toBe("quarantined");

    const queue = await asJana((sql) => reconciliationQueue(sql));
    const pat = queue.find((q) => q.booked_email === "pat@example.com")!;
    expect(pat.assessment_id).toBeNull();
    expect(pat.reconciliation_reason).toMatch(/No assessment link token/);
    // no client record was invented from an unmatched booking
    expect((await pg.query(`select 1 from clients where email = 'pat@example.com'`)).rows).toHaveLength(0);

    await asJana((sql) => reconcileBooking(sql, JANA, pat.id, id));
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.bookings[0].booked_email).toBe("pat@example.com");
    expect(ws.clients[0]).toMatchObject({ email: "pat@example.com", link_source: "coach_manual" });
    expect(ws.audit.some((a) => a.action === "booking.reconciled")).toBe(true);
  });

  it("6b. PDF email and booking email that differ are both kept, never merged", async () => {
    const { id, token } = await completedAssessment();
    await requestPdfEmail(db, token, "personal@example.com");
    await webhook(inviteeCreated({ token: await bookingToken(token), email: "work@example.com" }).body);
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.clients.map((c) => [c.link_source, c.email])).toEqual([["pdf_request", "personal@example.com"], ["booking", "work@example.com"]]);
  });

  it("7. admin sees the full record; public and non-MFA users cannot read coach material", async () => {
    const { id } = await completedAssessment();
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    await asJana((sql) => saveNote(sql, JANA, id, { bookingId: null, notes: "Private note", validatedFindings: {}, agreedNextSteps: { steps: [], coachingInquiry: false }, followUpStatus: "none" }));
    await asJana((sql) => saveScriptEdit(sql, JANA, id, ws.scripts[0].content, null));
    const stored = await pg.query<{ notes_ciphertext: string }>(`select notes_ciphertext from session_notes where assessment_id = $1`, [id]);
    expect(stored.rows[0].notes_ciphertext).not.toContain("Private note"); // encrypted at rest

    for (const who of [{ userId: STRANGER, aal: "aal2" as const }, { userId: JANA, aal: "aal1" as const }]) {
      await asCoach(db, who, async (sql) => {
        for (const t of ["coach_reports", "session_scripts", "session_notes", "assessment_answers", "clients"])
          expect((await sql.query(`select 1 from ${t}`)).rows).toHaveLength(0);
        expect(await loadWorkspace(sql, { userId: who.userId, role: "coach" }, id)).toBeNull();
      });
    }
    await pg.exec("begin; set local role anon;");
    for (const t of ["coach_reports", "session_scripts", "session_notes", "assessment_results"])
      expect((await pg.query(`select 1 from ${t}`)).rows).toHaveLength(0);
    await pg.exec("rollback");
  });

  it("8. stored reports stay reproducible when scoring changes later", async () => {
    const { id } = await completedAssessment();
    const before = (await frozenResult(db, id))!;
    // A future scoring config changes thresholds…
    const changed = computeLifeMap(await loadAnswers(db, id), { ...PROVISIONAL_1, scoringVersion: "provisional-2", thresholds: { ...PROVISIONAL_1.thresholds, lowSupport: 0.6 } });
    expect(changed.versions.scoring).toBe("provisional-2");
    // …but the frozen snapshot is untouched, hash-verified, and recomputable under its recorded version
    const after = (await frozenResult(db, id))!;
    expect(after.sha256).toBe(before.sha256);
    expect(await snapshotFingerprint(after.snapshot)).toBe(before.sha256);
    expect(await snapshotFingerprint(computeLifeMap(await loadAnswers(db, id)))).toBe(before.sha256);
  });

  it("9. N/A on the two approved Love questions is excluded from calculations but visible in answers", async () => {
    const { id } = await completedAssessment();
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    const na = ws.answers.filter((a) => a.response_status === "not_applicable");
    expect(na.map((a) => a.question_id).sort()).toEqual(["love.02", "love.03"]);
    expect(na.every((a) => a.value === NOT_APPLICABLE)).toBe(true);
    const love = ws.result!.snapshot.orbits.find((o) => o.orbit === "love")!;
    expect(love.coverage.notApplicable).toBe(2);
    expect(love.coverage.eligible).toBe(love.items.length - 2);
    expect(ws.coachReport!.content.sections.find((s) => s.key === "coverage")!.items.filter((i) => i.id.startsWith("coverage.na."))).toHaveLength(2);
  });

  it("10. deletion removes the assessment and its orphaned contacts; plain coaches cannot delete", async () => {
    const { id, token } = await completedAssessment();
    await requestPdfEmail(db, token, "delete-me@example.com");
    await pg.exec(`insert into auth.users values ('44444444-4444-4444-4444-444444444444'); insert into coach_users (user_id, display_name) values ('44444444-4444-4444-4444-444444444444', 'Assistant');`);
    await expect(asCoach(db, { userId: "44444444-4444-4444-4444-444444444444", aal: "aal2" }, (sql) => sql.query(`select delete_assessment($1)`, [id]))).rejects.toThrow(/not authorised/);
    await asJana((sql) => sql.query(`select delete_assessment($1)`, [id]));
    for (const t of ["assessment_answers", "assessment_results", "coach_reports", "session_scripts", "pdf_requests", "assessment_client_links"])
      expect((await pg.query(`select 1 from ${t} where assessment_id = $1`, [id])).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from clients where email = 'delete-me@example.com'`)).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from audit_events where action = 'assessment.delete' and target_id = $1`, [id])).rows).toHaveLength(1);
  });

  it("audit trail never contains answer bodies or free text", async () => {
    const rows = (await pg.query<{ metadata: unknown }>(`select metadata from audit_events`)).rows;
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain("postponing rest");
    expect(blob).not.toContain("Private note");
  });
});

import { saveReflections } from "@/server/assessments";
describe("optional reflections after the Map", () => {
  it("save encrypted after completion, show in the workspace, and never change the frozen snapshot", async () => {
    const { id, token } = await completedAssessment();
    const before = (await frozenResult(db, id))!.sha256;
    expect(await saveReflections(db, token, { "postmap.02": "My job looks right but isn't mine." })).toEqual({ ok: true, saved: 1 });
    expect(await saveReflections(db, token, { "bogus.01": "x" })).toEqual({ ok: false, error: "invalid" });
    const raw = await pg.query<{ text_ciphertext: string }>(`select text_ciphertext from assessment_answers where assessment_id = $1 and question_id = 'postmap.02'`, [id]);
    expect(raw.rows[0].text_ciphertext).not.toContain("job");
    expect((await frozenResult(db, id))!.sha256).toBe(before);
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.answers.find((a) => a.question_id === "postmap.02")?.value).toBe("My job looks right but isn't mine.");
  });
});

describe("optional reflections in the emailed PDF", () => {
  it("includes the person's own reflections verbatim; the snapshot is unchanged", async () => {
    const { id, token } = await completedAssessment();
    await saveReflections(db, token, { "postmap.04": "Sleeping before midnight." });
    const before = (await frozenResult(db, id))!.sha256;
    expect(await requestPdfEmail(db, token, "r@example.com")).toEqual({ ok: true, state: "sent" });
    const text = pdfText(email.sent.at(-1)!.attachments![0].content);
    expect(text).toContain("Your reflections".toUpperCase());
    expect(text).toContain("Sleeping before midnight.");
    expect(text).toContain("That I keep postponing rest.");
    expect((await frozenResult(db, id))!.sha256).toBe(before);
  });
});

import { setDisplayName } from "@/server/admin/mutations";
describe("display name", () => {
  it("coach can add a name to an anonymous assessment without inventing other details", async () => {
    const { id } = await completedAssessment();
    await asJana((sql) => setDisplayName(sql, JANA, id, "Robin K."));
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.clients).toEqual([expect.objectContaining({ name: "Robin K.", email: null, link_source: "coach_manual" })]);
    const list = await asJana((sql) => listAssessments(sql, { q: id.slice(0, 8) }));
    expect(list.rows[0].client_name).toBe("Robin K.");
  });
});

import { searchAssessments } from "@/server/admin/queries";
describe("reconciliation search", () => {
  it("finds assessments by name, email or assessment ID prefix", async () => {
    const { id, token } = await completedAssessment();
    await requestPdfEmail(db, token, "searchme@example.com");
    await asJana((sql) => setDisplayName(sql, JANA, id, "Quinn Search"));
    for (const q of ["searchme@", "Quinn", id.slice(0, 8)])
      expect((await asJana((sql) => searchAssessments(sql, q))).map((h) => h.assessment_id)).toContain(id);
    expect(await asJana((sql) => searchAssessments(sql, "x"))).toEqual([]);
  });
});

import { setCoachingEnrollment } from "@/server/admin/mutations";
describe("client profile: 1:1 coaching", () => {
  it("coach marks enrollment; shown in workspace and list; works for anonymous assessments", async () => {
    const { id } = await completedAssessment();
    await asJana((sql) => setCoachingEnrollment(sql, JANA, id, true, "2026-10-01"));
    const ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.clients[0]).toMatchObject({ coaching_enrolled: true, coaching_enrolled_at: "2026-10-01", email: null, name: null });
    expect((await asJana((sql) => listAssessments(sql, { q: id.slice(0, 8) }))).rows[0].coaching_enrolled).toBe(true);
    await asJana((sql) => setCoachingEnrollment(sql, JANA, id, false, null));
    expect((await asJana((sql) => listAssessments(sql, { q: id.slice(0, 8) }))).rows[0].coaching_enrolled).toBe(false);
    expect((await pg.query(`select 1 from assessment_client_links where assessment_id = $1`, [id])).rows).toHaveLength(1);
  });
});

import { saveValidation, generateUnderstanding, saveUnderstandingEdit, saveReportVersion } from "@/server/admin/mutations";
describe("after the session: validations → Client Understanding & Coaching Direction", () => {
  it("marks interpretations, keeps notes encrypted, and builds direction only from what the person confirmed or clarified", async () => {
    const { id } = await completedAssessment();
    let ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    const intel = ws.coachReport!.content.intelligence!;
    const pats = intel.patterns;
    expect(pats.length).toBeGreaterThanOrEqual(2);
    await asJana(async (sql) => {
      await saveValidation(sql, JANA, id, { insightId: pats[0].id, title: pats[0].title, status: "confirmed", note: "Yes — exactly how evenings go." });
      await saveValidation(sql, JANA, id, { insightId: pats[1].id, title: pats[1].title, status: "challenged", note: "Says it's a temporary push until March." });
      await saveNote(sql, JANA, id, { bookingId: null, notes: "n", validatedFindings: {}, agreedNextSteps: { steps: ["Protect two evenings a week"], coachingInquiry: true }, followUpStatus: "planned" });
    });
    const raw = await pg.query<{ note_ciphertext: string }>(`select note_ciphertext from interpretation_validations where assessment_id = $1`, [id]);
    expect(raw.rows.every((r) => !r.note_ciphertext.includes("evenings"))).toBe(true);

    const g = await asJana((sql) => generateUnderstanding(sql, JANA, id));
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const sec = (k: string) => g.doc.sections.find((s) => s.key === k)!;
    expect(sec("confirmed").items[0].text).toContain("exactly how evenings go");
    expect(sec("challenged").items[0].text).toContain("temporary push");
    expect(JSON.stringify(sec("direction"))).toContain(pats[0].title);
    expect(JSON.stringify(sec("direction"))).not.toContain(pats[1].title); // challenged never drives direction
    expect(sec("goals").items.map((i) => i.text)).toContain("Protect two evenings a week");
    expect(g.doc.principle).toMatch(/conversation revealed the person/);
    const enc = await pg.query<{ content_ciphertext: string }>(`select content_ciphertext from understanding_documents where assessment_id = $1`, [id]);
    expect(enc.rows[0].content_ciphertext).not.toContain("evenings");

    // edited versions preserve the generated original; report edits also versioned
    await asJana((sql) => saveUnderstandingEdit(sql, JANA, id, { ...g.doc, sections: g.doc.sections.slice(0, 2) }));
    await asJana((sql) => saveReportVersion(sql, JANA, id, ws.coachReport!.content));
    ws = (await asJana((sql) => loadWorkspace(sql, { userId: JANA, role: "admin" }, id)))!;
    expect(ws.understandingDocs!.map((d) => [d.version, d.kind])).toEqual([[2, "coach_edited"], [1, "generated"]]);
    expect(ws.coachReports!.map((r) => r.kind)).toEqual(["coach_edited", "generated"]);
    expect(ws.validations!.find((v) => v.status === "confirmed")!.note).toContain("evenings");
  });
});
