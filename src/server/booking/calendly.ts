import "server-only";
import { hmacHex, safeEqual } from "../crypto";
import type { NormalizedBookingEvent, SchedulingAdapter } from "./types";

const TOLERANCE_S = 180;

/** Calendly-Webhook-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>"> */
export function verifyCalendlySignature(key: string, header: string | null, body: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(now / 1000 - Number(parts.t)) > TOLERANCE_S) return false;
  return safeEqual(hmacHex(key, `${parts.t}.${body}`), parts.v1);
}

interface CalendlyInvitee {
  uri: string; name?: string; email?: string; status?: string; timezone?: string; event?: string;
  rescheduled?: boolean; old_invitee?: string | null; new_invitee?: string | null;
  questions_and_answers?: { question: string; answer: string; position?: number }[];
  tracking?: { utm_content?: string | null } | null;
  payment?: { external_id?: string; provider?: string; amount?: number; currency?: string; successful?: boolean } | null;
  scheduled_event?: { uri?: string; start_time?: string; end_time?: string; location?: { join_url?: string; location?: string } | null } | null;
}

export function normalizeCalendly(json: unknown): NormalizedBookingEvent | null {
  const j = json as { event?: string; created_at?: string; payload?: CalendlyInvitee };
  if (!j?.payload?.uri || (j.event !== "invitee.created" && j.event !== "invitee.canceled")) return null;
  const p = j.payload;
  const type = j.event === "invitee.created" ? "created" : "canceled";
  return {
    provider: "calendly",
    type,
    idempotencyKey: `calendly:${j.event}:${p.uri}`,
    webhookEventId: `${j.event}:${p.uri}:${j.created_at ?? ""}`,
    inviteeId: p.uri,
    eventId: p.scheduled_event?.uri ?? p.event ?? "",
    linkToken: p.tracking?.utm_content ?? null,
    name: p.name ?? null,
    email: p.email ?? null,
    timezone: p.timezone ?? null,
    start: p.scheduled_event?.start_time ?? null,
    end: p.scheduled_event?.end_time ?? null,
    meetingUrl: p.scheduled_event?.location?.join_url ?? null,
    active: p.status === "active",
    rescheduled: type === "canceled" && !!p.rescheduled,
    oldInviteeId: type === "created" ? p.old_invitee ?? null : null,
    intake: [...(p.questions_and_answers ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((q) => ({ question: q.question, answer: q.answer })),
    payment: p.payment ? { reference: p.payment.external_id ?? null, successful: p.payment.successful === true, amount: p.payment.amount ?? null, currency: p.payment.currency ?? null } : null,
  };
}

export function calendlyAdapter(env = process.env): SchedulingAdapter | null {
  const key = env.CALENDLY_WEBHOOK_SIGNING_KEY, url = env.CALENDLY_SCHEDULING_URL;
  if (!key || !url) return null;
  return {
    id: "calendly",
    verify: (h, body, now) => verifyCalendlySignature(key, h.get("calendly-webhook-signature"), body, now),
    normalize: normalizeCalendly,
    // utm_content is Calendly's supported pass-through field; it carries only the opaque signed token.
    schedulingUrl: (t) => { const u = new URL(url); u.searchParams.set("utm_content", t); return u.toString(); },
  };
}
