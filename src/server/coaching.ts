import "server-only";
import { z } from "zod";
import type { Db } from "./db";
import { audit } from "./audit";
import { resolveToken } from "./assessments";
import { encrypt, encryptionConfigured, sha256, signBookingToken, verifyBookingToken } from "./crypto";
import { PRIVACY_NOTICE_VERSION } from "@/content/privacy-version";
import type { SchedulingAdapter } from "./booking/types";

/**
 * 1:1 coaching application (Jana, 21 Oct): replaces the paid Life Map Deep Dive.
 *
 * Results page or PDF email → application (name, email, optional message) → Calendly for a complimentary
 * 30-minute introductory conversation.
 * - Linked to the person's Self-Interview when the request carries their private results token (from this device)
 *   or the one-time link from their PDF email. Both travel in the request body, never in a URL.
 * - A client record is created from what they typed and linked to that Self-Interview; never merged by email.
 * - The optional message is encrypted before storage; it never goes to Calendly or into a URL.
 * - Submitting is not a booking. The application stays "submitted" until Calendly reports a booking made through the
 *   signed link returned here; then it becomes "scheduled".
 * - One application per form submission: the browser sends a request id, and a repeat returns the same application.
 */
export const ApplicationBody = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254).email(),
  message: z.string().max(4000).optional().default(""),
  token: z.string().max(200).optional(),   // private results token from this device
  b: z.string().max(200).optional(),       // one-time link from the PDF email
});
export type ApplicationInput = z.infer<typeof ApplicationBody>;

const LINK_TTL = 60 * 60 * 24 * 30; // the scheduling link stays valid for 30 days, so someone can come back to it
const secret = () => process.env.BOOKING_TOKEN_SECRET ?? "";

export type ApplyResult =
  | { ok: true; applicationId: string; schedulingUrl: string | null }
  | { ok: false; error: "not_configured" };

export async function submitApplication(db: Db, adapter: SchedulingAdapter | null, input: ApplicationInput): Promise<ApplyResult> {
  if (!encryptionConfigured()) return { ok: false, error: "not_configured" };
  return db.tx(async (sql) => {
    // Repeat of the same submission (double tap, retry after a lost response): same application, fresh link
    const prev = (await sql.query<{ id: string; assessment_id: string | null }>(
      `select id, assessment_id from coaching_applications where request_id = $1`, [input.requestId])).rows[0];

    let applicationId: string, assessmentId: string | null;
    if (prev) { applicationId = prev.id; assessmentId = prev.assessment_id; }
    else {
      assessmentId = null;
      let source: "results" | "email" | "direct" = "direct";
      if (input.token) {
        const a = await resolveToken(sql, input.token);
        if (a) { assessmentId = a.id; source = "results"; }
      }
      if (!assessmentId && input.b && secret() && verifyBookingToken(secret(), input.b).ok) {
        const row = (await sql.query<{ assessment_id: string | null; expires_at: Date }>(
          `select assessment_id, expires_at from booking_link_tokens where token_hash = $1`, [sha256(input.b)])).rows[0];
        if (row?.assessment_id && new Date(row.expires_at).getTime() > Date.now()) { assessmentId = row.assessment_id; source = "email"; }
      }
      const email = input.email.trim(), name = input.name.trim(), message = input.message.trim();
      const clientId = (await sql.query<{ id: string }>(`insert into clients (name, email) values ($1,$2) returning id`, [name, email])).rows[0].id;
      applicationId = (await sql.query<{ id: string }>(
        `insert into coaching_applications (assessment_id, client_id, name, email, message_ciphertext, request_id, source)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [assessmentId, clientId, name, email, message ? encrypt(message) : null, input.requestId, source])).rows[0].id;
      if (assessmentId) {
        await sql.query(
          `insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis) values ($1,$2,'coaching_application','coaching_application')
           on conflict do nothing`, [assessmentId, clientId]);
        await sql.query(`insert into consents (subject_type, subject_id, consent_type, notice_version, status, source) values ('assessment',$1,'coaching_application',$2,'granted',$3)`,
          [assessmentId, PRIVACY_NOTICE_VERSION, source === "email" ? "pdf_email" : "results_page"]);
      }
      // Applying makes them a Lead (Prospect → Lead only; never moved back)
      await sql.query(`update clients set stage = 'lead', stage_changed_at = now() where id = $1 and stage = 'prospect'`, [clientId]);
      await audit(sql, null, "coaching.applied", "coaching_application", applicationId, { matched: !!assessmentId, source });
    }

    // Scheduling link: signed, one-time, tied to this application (and Self-Interview when known)
    if (!adapter || !secret()) return { ok: true as const, applicationId, schedulingUrl: null };
    const { token, expiresAt } = signBookingToken(secret(), LINK_TTL);
    await sql.query(`insert into booking_link_tokens (token_hash, assessment_id, application_id, expires_at) values ($1,$2,$3,$4)`,
      [sha256(token), assessmentId, applicationId, expiresAt]);
    return { ok: true as const, applicationId, schedulingUrl: adapter.schedulingUrl(token, { name: input.name.trim(), email: input.email.trim() }) };
  });
}
