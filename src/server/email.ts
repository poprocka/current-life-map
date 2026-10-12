import "server-only";
import { PRIVACY_NOTICE_VERSION } from "@/content/privacy-version";
import { buildClientPdf } from "@/lib/pdf/clientReport";
import type { Db } from "./db";
import { frozenResult, loadAnswers, resolveToken } from "./assessments";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { audit } from "./audit";
import { hmacB64, safeEqual } from "./crypto";

export interface OutgoingEmail {
  to: string; subject: string; text: string;
  attachments?: { filename: string; content: Uint8Array }[];
  idempotencyKey: string;
}
export interface EmailProvider { name: string; send(m: OutgoingEmail): Promise<{ id: string }> }

/** Resend (https://resend.com). The PDF travels as an attachment: no public file URL exists. */
export const resend = (apiKey: string, from: string): EmailProvider => ({
  name: "resend",
  async send(m) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": m.idempotencyKey },
      body: JSON.stringify({
        from, to: [m.to], subject: m.subject, text: m.text,
        attachments: m.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
      }),
    });
    if (!r.ok) throw new Error(`resend_${r.status}`);
    return { id: (await r.json()).id as string };
  },
});

let override: EmailProvider | null = null;
export const setEmailProvider = (p: EmailProvider | null) => { override = p; };
export function emailProvider(): EmailProvider | null {
  if (override) return override;
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  return key && from ? resend(key, from) : null;
}

export type PdfEmailResult =
  | { ok: true; state: "sent" }
  | { ok: false; error: "not_configured" | "not_found" | "not_completed" | "send_failed" };

const EMAIL_TEXT = `Hello,

Your Current Life Map is attached as a PDF. It reflects the answers you gave in the self-interview.

You asked for this report, so we've sent it once. Providing your email for report delivery does not subscribe you to marketing.

The Current Life Map`;

/**
 * Email the client PDF. Records the request against the assessment, links a client record created from
 * the email the person typed (never merged with other records), and tracks the provider's response.
 * "sent" means the provider accepted the message; delivery is confirmed only by the provider's webhook.
 */
export async function requestPdfEmail(db: Db, token: string, email: string): Promise<PdfEmailResult> {
  const provider = emailProvider();
  if (!provider) return { ok: false, error: "not_configured" };
  const prep = await db.tx(async (sql) => {
    const a = await resolveToken(sql, token);
    if (!a) return { error: "not_found" as const };
    const frozen = await frozenResult(sql, a.id);
    if (!frozen) return { error: "not_completed" as const };
    const normalized = email.trim();
    // Reuse a client only if this same assessment already has one with this exact email from a PDF request.
    const existing = await sql.query<{ client_id: string }>(
      `select l.client_id from assessment_client_links l join clients c on c.id = l.client_id
       where l.assessment_id = $1 and l.link_source = 'pdf_request' and lower(c.email) = lower($2) limit 1`, [a.id, normalized]);
    let clientId = existing.rows[0]?.client_id;
    if (!clientId) {
      clientId = (await sql.query<{ id: string }>(`insert into clients (email) values ($1) returning id`, [normalized])).rows[0].id;
      await sql.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis) values ($1,$2,'pdf_request','report_delivery_request')`, [a.id, clientId]);
    }
    await sql.query(`insert into consents (subject_type, subject_id, consent_type, notice_version, status, source) values ('assessment', $1, 'pdf_delivery', $2, 'granted', 'results_page')`, [a.id, PRIVACY_NOTICE_VERSION]);
    const req = await sql.query<{ id: string }>(`insert into pdf_requests (assessment_id, email, provider) values ($1,$2,$3) returning id`, [a.id, normalized, provider.name]);
    await audit(sql, null, "pdf.requested", "assessment", a.id, { pdf_request: req.rows[0].id });
    const stored = await loadAnswers(sql, a.id, { includeText: true });
    const reflections = POST_MAP_REFLECTIONS.questions
      .filter((q) => typeof stored[q.id] === "string" && (stored[q.id] as string).trim())
      .map((q) => ({ prompt: q.prompt, text: stored[q.id] as string }));
    return { assessmentId: a.id, requestId: req.rows[0].id, frozen, email: normalized, reflections };
  });
  if ("error" in prep) return { ok: false, error: prep.error! };

  try {
    const pdf = await buildClientPdf(prep.frozen.snapshot, { generatedAt: prep.frozen.generatedAt, reflections: prep.reflections });
    const sent = await provider.send({
      to: prep.email, subject: "Your Current Life Map", text: EMAIL_TEXT,
      attachments: [{ filename: "current-life-map.pdf", content: pdf }], idempotencyKey: `pdf-${prep.requestId}`,
    });
    await db.query(`update pdf_requests set delivery_state = 'sent', provider_message_id = $2 where id = $1`, [prep.requestId, sent.id]);
    return { ok: true, state: "sent" };
  } catch (e) {
    const code = e instanceof Error ? e.message.slice(0, 60) : "unknown";
    await db.query(`update pdf_requests set delivery_state = 'failed', retry_count = retry_count + 1, last_error = $2 where id = $1`, [prep.requestId, code]);
    return { ok: false, error: "send_failed" };
  }
}

/** Resend delivery webhooks (Svix-signed). Updates delivered / bounced states only from verified events. */
export function verifySvix(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, body: string, now = Date.now()) {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  if (Math.abs(now / 1000 - Number(headers.timestamp)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = hmacB64(key, `${headers.id}.${headers.timestamp}.${body}`);
  return headers.signature.split(" ").some((s) => { const [v, sig] = s.split(","); return v === "v1" && !!sig && safeEqual(sig, expected); });
}

const RESEND_STATES: Record<string, string> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "delivered", "email.failed": "failed" };

export async function handleResendEvent(db: Db, evt: { type: string; data?: { email_id?: string } }) {
  const state = RESEND_STATES[evt.type];
  if (!state || !evt.data?.email_id) return { updated: 0 };
  const r = await db.query(`update pdf_requests set delivery_state = $2 where provider_message_id = $1 and delivery_state <> 'bounced' returning id`, [evt.data.email_id, state]);
  return { updated: r.rows.length };
}
