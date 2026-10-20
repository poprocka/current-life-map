import "server-only";
import { promoteToLead } from "../clients";
import { PRIVACY_NOTICE_VERSION } from "@/content/privacy-version";
import type { Db, Sql } from "../db";
import { audit } from "../audit";
import { PAID_CANCEL_REASON } from "./reasons";
import { loadAnswers, frozenResult, resolveToken, writeCoachMaterial } from "../assessments";
import { sha256, signBookingToken, verifyBookingToken } from "../crypto";
import type { NormalizedBookingEvent, SchedulingAdapter } from "./types";

const secret = () => process.env.BOOKING_TOKEN_SECRET ?? "";

/** Create the pending association server-side, then hand back the scheduler URL with the opaque token. */
export async function createBookingLink(db: Db, adapter: SchedulingAdapter, accessToken: string) {
  if (!secret()) return { ok: false as const, error: "not_configured" as const };
  return db.tx(async (sql) => {
    const a = await resolveToken(sql, accessToken);
    if (!a) return { ok: false as const, error: "not_found" as const };
    if (!(await frozenResult(sql, a.id))) return { ok: false as const, error: "not_completed" as const };
    const { token, expiresAt } = signBookingToken(secret());
    await sql.query(`insert into booking_link_tokens (token_hash, assessment_id, expires_at) values ($1,$2,$3)`, [sha256(token), a.id, expiresAt]);
    await sql.query(`insert into consents (subject_type, subject_id, consent_type, notice_version, status, source) values ('assessment',$1,'booking_link',$2,'granted','results_page')`, [a.id, PRIVACY_NOTICE_VERSION]);
    await audit(sql, null, "booking.link_created", "assessment", a.id);
    return { ok: true as const, url: adapter.schedulingUrl(token) };
  });
}

/** /book (from the PDF email): exchange a one-time booking token for the scheduler URL. Never creates an association;
 *  the token was already stored, hashed, when the email was sent. Unknown, expired or used tokens are refused. */
export async function bookingUrlForLinkToken(db: Db, adapter: SchedulingAdapter, linkToken: string) {
  if (!secret()) return { ok: false as const, error: "not_configured" as const };
  if (!verifyBookingToken(secret(), linkToken).ok) return { ok: false as const, error: "invalid" as const };
  const row = (await db.query<{ consumed_at: Date | null; expires_at: Date }>(
    `select consumed_at, expires_at from booking_link_tokens where token_hash = $1`, [sha256(linkToken)])).rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, error: "invalid" as const };
  return { ok: true as const, url: adapter.schedulingUrl(linkToken) };
}

type Outcome = { status: 200 | 400 | 401 | 500; outcome: string };

/** Verified webhook → idempotent processing. Returns 500 on transient failure so the provider retries. */
export async function handleBookingWebhook(db: Db, adapter: SchedulingAdapter, headers: Headers, rawBody: string, now = Date.now()): Promise<Outcome> {
  if (!adapter.verify(headers, rawBody, now)) return { status: 401, outcome: "bad_signature" };
  let json: unknown;
  try { json = JSON.parse(rawBody); } catch { return { status: 400, outcome: "bad_json" }; }
  const evt = adapter.normalize(json);
  if (!evt) return { status: 200, outcome: "ignored" };

  const ins = await db.query<{ id: string }>(
    `insert into booking_events (provider_event_id, webhook_event_id, event_type, idempotency_key, payload) values ($1,$2,$3,$4,$5)
     on conflict (idempotency_key) do nothing returning id`,
    [evt.eventId, evt.webhookEventId, `${evt.provider}.${evt.type}`, evt.idempotencyKey, JSON.stringify(evt)]);
  let eventRowId = ins.rows[0]?.id;
  if (!eventRowId) {
    const prev = await db.query<{ id: string; processed_at: Date | null }>(`select id, processed_at from booking_events where idempotency_key = $1`, [evt.idempotencyKey]);
    if (prev.rows[0]?.processed_at) return { status: 200, outcome: "duplicate" };
    eventRowId = prev.rows[0].id; // seen but not processed: retry now
  }
  return processEvent(db, eventRowId, evt);
}

export async function processEvent(db: Db, eventRowId: string, evt: NormalizedBookingEvent): Promise<Outcome> {
  try {
    const outcome = await db.tx(async (sql) => {
      const r = evt.type === "created" ? await onCreated(sql, evt) : await onCanceled(sql, evt);
      await sql.query(`update booking_events set processed_at = now(), processing_error = null, booking_id = $2 where id = $1`, [eventRowId, r.bookingId]);
      return r.outcome;
    });
    return { status: 200, outcome };
  } catch (e) {
    await db.query(`update booking_events set processing_error = $2 where id = $1`, [eventRowId, (e instanceof Error ? e.message : "error").slice(0, 120)]).catch(() => undefined);
    return { status: 500, outcome: "retry" };
  }
}

async function bookingByInvitee(sql: Sql, inviteeId: string) {
  return (await sql.query<{ id: string; assessment_id: string | null; client_id: string | null; payment_state: string; payment_reference: string | null; booking_state: string }>(
    `select id, assessment_id, client_id, payment_state, payment_reference, booking_state from bookings where provider_invitee_id = $1`, [inviteeId])).rows[0] ?? null;
}

async function onCreated(sql: Sql, e: NormalizedBookingEvent): Promise<{ bookingId: string; outcome: string }> {
  const dup = await bookingByInvitee(sql, e.inviteeId);
  if (dup) return { bookingId: dup.id, outcome: "already_recorded" };

  let assessmentId: string | null = null, clientId: string | null = null, rescheduledFrom: string | null = null;
  let carriedPayment: { state: string; ref: string | null } | null = null;
  const flags: string[] = [];

  // Rescheduling: the new invitee inherits the original booking's association
  if (e.oldInviteeId) {
    const old = await bookingByInvitee(sql, e.oldInviteeId);
    if (old) {
      assessmentId = old.assessment_id; clientId = old.client_id; rescheduledFrom = old.id;
      carriedPayment = { state: old.payment_state, ref: old.payment_reference };
      await sql.query(`update bookings set booking_state = 'rescheduled', updated_at = now() where id = $1`, [old.id]);
      if (!old.assessment_id) flags.push("Rescheduled from a booking that is itself unmatched");
    } else flags.push("Reschedule of a booking we have no record of");
  }

  // Otherwise: the opaque signed token created server-side before redirect
  if (!assessmentId && !rescheduledFrom) {
    if (!e.linkToken) flags.push("No assessment link token on the booking");
    else {
      const v = verifyBookingToken(secret(), e.linkToken);
      const row = (await sql.query<{ assessment_id: string; consumed_at: Date | null }>(
        `select assessment_id, consumed_at from booking_link_tokens where token_hash = $1`, [sha256(e.linkToken)])).rows[0];
      if (!v.ok && v.reason !== "expired") flags.push("Assessment link token failed verification");
      else if (!row) flags.push("Assessment link token not recognised");
      else {
        assessmentId = row.assessment_id;
        if (!v.ok) flags.push("Booked with an expired link — please confirm the association");
        if (row.consumed_at) flags.push("Link already used for another booking — possible duplicate");
        await sql.query(`update booking_link_tokens set consumed_at = coalesce(consumed_at, now()) where token_hash = $1`, [sha256(e.linkToken)]);
      }
    }
  }
  if (assessmentId) {
    const active = await sql.query(`select 1 from bookings where assessment_id = $1 and booking_state in ('confirmed') and ($2::uuid is null or id <> $2)`, [assessmentId, rescheduledFrom]);
    if (active.rows.length) flags.push("This assessment already has a confirmed booking — possible duplicate");
  }

  // Client: created only from the details the person typed; never merged by email across records
  if (assessmentId && !clientId && e.email) {
    const same = await sql.query<{ client_id: string }>(
      `select l.client_id from assessment_client_links l join clients c on c.id = l.client_id
       where l.assessment_id = $1 and l.link_source = 'booking' and lower(c.email) = lower($2) limit 1`, [assessmentId, e.email]);
    clientId = same.rows[0]?.client_id ?? null;
    if (!clientId) {
      clientId = (await sql.query<{ id: string }>(`insert into clients (name, email) values ($1,$2) returning id`, [e.name, e.email])).rows[0].id;
      await sql.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis) values ($1,$2,'booking','booking_request')`, [assessmentId, clientId]);
    }
  }

  // Payment: paid only on the provider's confirmation in a verified event
  const required = process.env.CALENDLY_PAYMENT_REQUIRED !== "false";
  let paymentState: string, paymentRef: string | null = e.payment?.reference ?? null;
  if (e.payment) paymentState = e.payment.successful ? "paid" : "pending";
  else if (carriedPayment) { paymentState = carriedPayment.state; paymentRef = carriedPayment.ref; }
  else paymentState = required ? "unknown" : "not_required";
  if (required && paymentState === "unknown") flags.push("No payment confirmation received for a paid session");

  const b = await sql.query<{ id: string }>(
    `insert into bookings (assessment_id, client_id, provider, provider_event_id, provider_invitee_id, scheduled_start, scheduled_end, timezone, meeting_url,
       booking_state, booked_name, booked_email, intake_answers, payment_reference, payment_state, rescheduled_from, needs_reconciliation, reconciliation_reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
    [assessmentId, clientId, e.provider, e.eventId, e.inviteeId, e.start, e.end, e.timezone, e.meetingUrl, e.active ? "confirmed" : "pending",
      e.name, e.email, JSON.stringify(e.intake), paymentRef, paymentState, rescheduledFrom, !assessmentId || flags.length > 0, flags.join("; ") || null]);
  const bookingId = b.rows[0].id;
  await audit(sql, null, "booking.created", "booking", bookingId, { matched: !!assessmentId, rescheduled: !!rescheduledFrom });
  if (assessmentId && e.active) await promoteToLead(sql, assessmentId);

  // Regenerate the personalised script with the booking intake; earlier and coach-edited versions are kept
  if (assessmentId && e.active) {
    const frozen = await frozenResult(sql, assessmentId);
    if (frozen) await writeCoachMaterial(sql, assessmentId, frozen.snapshot, await loadAnswers(sql, assessmentId, { includeText: true }), { bookingId, intake: e.intake });
  }
  return { bookingId, outcome: assessmentId ? (rescheduledFrom ? "rescheduled" : "linked") : "quarantined" };
}

async function onCanceled(sql: Sql, e: NormalizedBookingEvent): Promise<{ bookingId: string; outcome: string }> {
  const b = await bookingByInvitee(sql, e.inviteeId);
  if (!b) {
    const q = await sql.query<{ id: string }>(
      `insert into bookings (provider, provider_event_id, provider_invitee_id, booking_state, booked_name, booked_email, needs_reconciliation, reconciliation_reason, scheduled_start, timezone)
       values ($1,$2,$3,'cancelled',$4,$5,true,'Cancellation for a booking we have no record of',$6,$7) returning id`,
      [e.provider, e.eventId, e.inviteeId, e.name, e.email, e.start, e.timezone]);
    return { bookingId: q.rows[0].id, outcome: "quarantined" };
  }
  const state = e.rescheduled ? "rescheduled" : "cancelled";
  const paidCancelled = !e.rescheduled && b.payment_state === "paid";
  await sql.query(
    `update bookings set booking_state = $2, updated_at = now(),
       needs_reconciliation = needs_reconciliation or $3, reconciliation_reason = case when $3 then concat_ws('; ', reconciliation_reason, $4::text) else reconciliation_reason end
     where id = $1`, [b.id, state, paidCancelled, PAID_CANCEL_REASON]);
  await audit(sql, null, `booking.${state}`, "booking", b.id);
  return { bookingId: b.id, outcome: state };
}

/** Cron: reprocess events that failed transiently, then prune expired raw payloads. */
export async function retryPending(db: Db) {
  const r = await db.query<{ id: string; payload: NormalizedBookingEvent }>(
    `select id, payload from booking_events where processed_at is null and payload is not null and event_type not like 'stripe.%' and received_at < now() - interval '1 minute' limit 50`);
  let ok = 0;
  for (const row of r.rows) if ((await processEvent(db, row.id, row.payload)).status === 200) ok++;
  await db.query(`select prune_booking_payloads()`);
  // Retention: unfinished, unlinked Self-Interviews with no activity for 90 days are removed (Jana, 19 Oct).
  const purged = Number((await db.query<{ n: number }>(`select purge_abandoned_assessments(90) as n`)).rows[0]?.n ?? 0);
  return { attempted: r.rows.length, processed: ok, purged };
}

/** Manual reconciliation by a coach (runs under the coach's RLS context). */
export async function reconcileBooking(sql: Sql, coachId: string, bookingId: string, assessmentId: string) {
  const b = (await sql.query<{ booked_name: string | null; booked_email: string | null; client_id: string | null }>(
    `select booked_name, booked_email, client_id from bookings where id = $1`, [bookingId])).rows[0];
  if (!b) return { ok: false as const, error: "not_found" as const };
  let clientId = b.client_id;
  if (!clientId && b.booked_email) {
    clientId = (await sql.query<{ id: string }>(`insert into clients (name, email) values ($1,$2) returning id`, [b.booked_name, b.booked_email])).rows[0].id;
    await sql.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis, verified_at) values ($1,$2,'coach_manual','booking_request', now())`, [assessmentId, clientId]);
  }
  await sql.query(`update bookings set assessment_id = $2, client_id = $3, needs_reconciliation = false, reconciliation_reason = null, updated_at = now() where id = $1`, [bookingId, assessmentId, clientId]);
  await audit(sql, coachId, "booking.reconciled", "booking", bookingId, { assessment: assessmentId });
  await promoteToLead(sql, assessmentId, coachId);
  return { ok: true as const };
}

