import { createHmac, randomBytes } from "crypto";
import type { EmailProvider, OutgoingEmail } from "@/server/email";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";

export const ENV = {
  FIELD_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  BOOKING_TOKEN_SECRET: "test-booking-secret",
  CALENDLY_WEBHOOK_SIGNING_KEY: "test-calendly-key",
  CALENDLY_SCHEDULING_URL: "https://calendly.com/jana/life-map-deep-dive",
  STRIPE_WEBHOOK_SECRET: "whsec_test_stripe",
};
Object.assign(process.env, ENV);

export class FakeEmail implements EmailProvider {
  name = "fake";
  sent: OutgoingEmail[] = [];
  fail = false;
  async send(m: OutgoingEmail) {
    if (this.fail) throw new Error("provider_down");
    this.sent.push(m);
    return { id: `msg_${this.sent.length}` };
  }
}

/** A complete set of answers, including N/A on both approved Love items and a free-text reflection. */
export function fullAnswers(): Record<string, string | string[]> {
  const a: Record<string, string | string[]> = {};
  const truth = ["3", "1", "4", "0", "2", "3", "1"];
  const imp: Record<string, string> = { mind: "3", body: "4", restoration: "4", growth: "2", love: "1", social: "4", resources: "2", joy: "1" };
  const en: Record<string, string> = { mind: "-1", body: "1", restoration: "-2", growth: "1", love: "0", social: "-1", resources: "0", joy: "2" };
  let i = 0;
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "truth") a[q.id] = q.allowNotApplicable ? NOT_APPLICABLE : truth[i++ % truth.length];
    else if (q.responseType === "importance") a[q.id] = imp[q.chapterId];
    else if (q.responseType === "energy") a[q.id] = en[q.chapterId];
    else if (q.responseType === "emotional_state") a[q.id] = [q.options[0].value, q.options[1].value];
  }
  Object.assign(a, {
    "interconnections.01": "social", "interconnections.02": "joy", "interconnections.03": "restoration", "interconnections.04": "restoration",
    "interconnections.05": "growth", "interconnections.06": "resources", "interconnections.07": "somewhat_compete",
    "interconnections.reflection": "That I keep postponing rest.",
  });
  return a;
}

export function calendlyHeaders(body: string, key = ENV.CALENDLY_WEBHOOK_SIGNING_KEY, t = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  return new Headers({ "calendly-webhook-signature": `t=${t},v1=${sig}`, "content-type": "application/json" });
}

let n = 0;
export function inviteeCreated(opts: { token?: string | null; email?: string; name?: string; paid?: boolean; oldInvitee?: string; invitee?: string }) {
  const invitee = opts.invitee ?? `https://api.calendly.com/scheduled_events/EV${++n}/invitees/INV${n}`;
  return {
    invitee,
    body: JSON.stringify({
      event: "invitee.created", created_at: new Date().toISOString(),
      payload: {
        uri: invitee, name: opts.name ?? "Alex Rivera", email: opts.email ?? "alex@example.com", status: "active", timezone: "Europe/Lisbon",
        rescheduled: false, old_invitee: opts.oldInvitee ?? null,
        questions_and_answers: [{ question: "What would you most like to understand?", answer: "Why I feel stretched", position: 0 }],
        tracking: { utm_content: opts.token ?? null },
        payment: opts.paid === false ? null : { external_id: `ch_${n}`, provider: "stripe", amount: 125, currency: "USD", successful: true },
        scheduled_event: { uri: invitee.split("/invitees")[0], start_time: "2026-10-20T10:00:00.000000Z", end_time: "2026-10-20T11:00:00.000000Z", location: { join_url: "https://zoom.us/j/123" } },
      },
    }),
  };
}

export function inviteeCanceled(invitee: string, rescheduled = false) {
  return JSON.stringify({
    event: "invitee.canceled", created_at: new Date().toISOString(),
    payload: { uri: invitee, name: "Alex Rivera", email: "alex@example.com", status: "canceled", rescheduled, timezone: "Europe/Lisbon",
      cancellation: { canceled_by: "Alex Rivera", reason: rescheduled ? null : "Something came up" } },
  });
}

export function stripeHeaders(body: string, secret = ENV.STRIPE_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}
