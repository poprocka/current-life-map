import "server-only";
import { PRIVACY_NOTICE_VERSION } from "@/content/privacy-version";
import { buildResultsPdf as buildClientPdf } from "@/server/pdf/render";
import type { Db } from "./db";
import { frozenResult, loadAnswers, resolveToken } from "./assessments";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { engineForTemplate, generateResultInsights } from "@/engine/insights";
import { audit } from "./audit";
import { hmacB64, safeEqual, sha256, signBookingToken } from "./crypto";
import { calendlyAdapter } from "./booking/calendly";

export interface OutgoingEmail {
  to: string; subject: string; text: string; html?: string;
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
        from, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}),
        reply_to: process.env.EMAIL_REPLY_TO || from, // replies always reach Jana's inbox
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

/** Email sent with the PDF (draft wording for Jana's approval). Plain text: reads well everywhere, no tracking. */
export const EMAIL_SUBJECT = "Your Current Life Map";
export const emailText = (bookUrl: string | null) => `Hello,

Thank you for taking the time to complete the Self-Interview. Your Current Life Map is attached as a PDF.

It reflects the life you described: what matters most to you right now, what gives and takes your energy, and how the different parts of your life influence one another. It isn't a verdict or a diagnosis. It's a starting point for seeing your life more clearly.

A few suggestions as you read it:
- Take your time. Notice what feels accurate, and what doesn't.
- Pay attention to anything that surprises you.
- Come back to the questions in your insights when you have a quiet moment.

${bookUrl ? `If you'd like to explore your Map together, you can book a Deep Dive session with me.
Book a session: ${bookUrl}
` : `If you'd like to explore your Map together, you can book a Deep Dive session from your results page.
`}
Questions or feedback? Simply reply to this email. It comes straight to me.

You're receiving this email only because you asked for your PDF. You haven't been added to any mailing list.

With warmth,
Jana
The Current Life Map`;
export const EMAIL_TEXT = emailText(null);

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** HTML version (what almost every mail app shows): the booking link reads "Book a session" instead of a bare URL.
 *  Built from the same text, so both versions always say the same thing. No images, no tracking pixels. */
export function emailHtml(bookUrl: string | null) {
  const paras = emailText(bookUrl).split(/\n\n+/).map((block) => {
    const lines = block.split("\n").map((line) => {
      if (bookUrl && line.startsWith("Book a session: "))
        return `<a href="${esc(bookUrl)}" style="color:#540F26;font-weight:500;text-decoration:underline;text-underline-offset:3px">Book a session</a>`;
      return esc(line);
    });
    return lines[0]?.startsWith("- ")
      ? `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li>${l.slice(2)}</li>`).join("")}</ul>`
      : `<p style="margin:0 0 16px">${lines.join("<br>")}</p>`;
  });
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F5EDE2"><div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1F1411">${paras.join("")}</div></body></html>`;
}

/**
 * Email the client PDF. Records the request against the assessment, links a client record created from
 * the email the person typed (never merged with other records), and tracks the provider's response.
 * "sent" means the provider accepted the message; delivery is confirmed only by the provider's webhook.
 */
/** Booking from the email: on only when booking is switched on and configured. The link carries a fresh one-time
 *  booking token in the URL fragment (#b=…), which browsers never send to servers or logs; /book exchanges it. */
const BOOK_LINK_TTL = 60 * 60 * 24 * 30; // 30 days
const bookingFromEmail = () => process.env.NEXT_PUBLIC_BOOKING_ENABLED === "1" && !!process.env.BOOKING_TOKEN_SECRET && !!calendlyAdapter();

export async function requestPdfEmail(db: Db, token: string, email: string, siteOrigin?: string): Promise<PdfEmailResult> {
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
    const insights = generateResultInsights(frozen.snapshot, stored, { engine: engineForTemplate(frozen.narrativeVersion) });
    let bookUrl: string | null = null;
    const origin = process.env.PUBLIC_SITE_URL || siteOrigin;
    if (origin && bookingFromEmail()) {
      const b = signBookingToken(process.env.BOOKING_TOKEN_SECRET!, BOOK_LINK_TTL);
      await sql.query(`insert into booking_link_tokens (token_hash, assessment_id, expires_at) values ($1,$2,$3)`, [sha256(b.token), a.id, b.expiresAt]);
      await audit(sql, null, "booking.link_created", "assessment", a.id, { via: "pdf_email" });
      bookUrl = `${origin.replace(/\/$/, "")}/book#b=${b.token}`;
    }
    return { assessmentId: a.id, requestId: req.rows[0].id, frozen, email: normalized, reflections, insights, bookUrl };
  });
  if ("error" in prep) return { ok: false, error: prep.error! };

  try {
    const pdf = await buildClientPdf(prep.frozen.snapshot, { generatedAt: prep.frozen.generatedAt, reflections: prep.reflections, insights: prep.insights });
    const sent = await provider.send({
      to: prep.email, subject: EMAIL_SUBJECT, text: emailText(prep.bookUrl), html: emailHtml(prep.bookUrl),
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

/**
 * "Download results" (Jana, 2026-10-13): the same PDF as the email, returned straight to the person's browser.
 * The token travels in the POST body only (never a URL). Nothing is stored about the download beyond an audit entry.
 */
export async function downloadPdf(db: Db, token: string): Promise<{ ok: true; pdf: Uint8Array } | { ok: false; error: "not_found" | "not_completed" }> {
  const prep = await db.tx(async (sql) => {
    const a = await resolveToken(sql, token);
    if (!a) return { error: "not_found" as const };
    const frozen = await frozenResult(sql, a.id);
    if (!frozen) return { error: "not_completed" as const };
    const stored = await loadAnswers(sql, a.id, { includeText: true });
    const reflections = POST_MAP_REFLECTIONS.questions
      .filter((q) => typeof stored[q.id] === "string" && (stored[q.id] as string).trim())
      .map((q) => ({ prompt: q.prompt, text: stored[q.id] as string }));
    await audit(sql, null, "pdf.downloaded", "assessment", a.id, {});
    return { frozen, reflections, insights: generateResultInsights(frozen.snapshot, stored, { engine: engineForTemplate(frozen.narrativeVersion) }) };
  });
  if ("error" in prep) return { ok: false, error: prep.error! };
  const pdf = await buildClientPdf(prep.frozen.snapshot, { generatedAt: prep.frozen.generatedAt, reflections: prep.reflections, insights: prep.insights });
  return { ok: true, pdf };
}
