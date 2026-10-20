import "server-only";
import { hmacHex, safeEqual } from "../crypto";
import type { Db } from "../db";
import { audit } from "../audit";
import { PAID_CANCEL_REASON } from "./reasons";

/** Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>"> (possibly several v1 entries). */
export function verifyStripeSignature(secret: string, header: string | null, body: string, now = Date.now(), tolerance = 300) {
  if (!header) return false;
  const items = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = items.find(([k]) => k === "t")?.[1];
  if (!t || Math.abs(now / 1000 - Number(t)) > tolerance) return false;
  const expected = hmacHex(secret, `${t}.${body}`);
  return items.some(([k, v]) => k === "v1" && safeEqual(v, expected));
}

interface StripeEvent { id: string; type: string; data: { object: { id: string; payment_intent?: string | null; amount?: number; amount_refunded?: number; refunded?: boolean } } }

/**
 * Stripe is the source of truth for refunds and failures after Calendly's payment confirmation.
 * Matches by the payment reference Calendly reported (charge or payment intent id). Deduplicated by Stripe event id.
 */
export async function handleStripeEvent(db: Db, evt: StripeEvent) {
  return db.tx(async (sql) => {
    const ins = await sql.query<{ id: string }>(
      `insert into booking_events (webhook_event_id, event_type, idempotency_key, payload) values ($1,$2,$3,$4) on conflict (idempotency_key) do nothing returning id`,
      [evt.id, `stripe.${evt.type}`, `stripe:${evt.id}`, JSON.stringify({ type: evt.type, object_id: evt.data.object.id })]);
    if (!ins.rows.length) return { duplicate: true, updated: 0 };
    const o = evt.data.object;
    const refs = [o.id, o.payment_intent].filter(Boolean);
    let state: string | null = null, reason: string | null = null;
    if (evt.type === "charge.refunded") {
      if (o.refunded || (o.amount !== undefined && o.amount_refunded === o.amount)) state = "refunded";
      else reason = "Partial refund recorded in Stripe";
    } else if (evt.type === "payment_intent.payment_failed" || evt.type === "charge.failed") state = "failed";
    else if (evt.type === "charge.dispute.created") reason = "Payment disputed in Stripe";
    const r = await sql.query<{ id: string }>(
      `update bookings set payment_state = coalesce($2, payment_state),
         -- a full refund settles "Paid booking cancelled — check refund" on its own (Jana, 20 Oct)
         needs_reconciliation = case when $2 = 'refunded' and reconciliation_reason = $4 and assessment_id is not null then false
                                     else needs_reconciliation or $3::text is not null end,
         reconciliation_reason = case when $2 = 'refunded' and reconciliation_reason = $4 and assessment_id is not null then null else coalesce($3, reconciliation_reason) end,
         updated_at = now()
       where payment_reference = any($1::text[]) returning id`, [refs, state, reason, PAID_CANCEL_REASON]);
    await sql.query(`update booking_events set processed_at = now(), booking_id = $2, processing_error = $3 where id = $1`,
      [ins.rows[0].id, r.rows[0]?.id ?? null, r.rows.length ? null : "no_matching_booking"]);
    for (const b of r.rows) await audit(sql, null, `payment.${state ?? "flagged"}`, "booking", b.id);
    return { duplicate: false, updated: r.rows.length };
  });
}
