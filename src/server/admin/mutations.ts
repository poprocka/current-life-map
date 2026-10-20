import "server-only";
import type { Sql } from "../db";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import type { DeepDiveScript } from "@/engine/coach/script";

/** Save Jana's edit as a new version; the generated original and earlier edits are kept. */
export async function saveScriptEdit(sql: Sql, coachId: string, assessmentId: string, content: DeepDiveScript, bookingId: string | null) {
  const v = await sql.query<{ v: number }>(`select coalesce(max(version), 0) + 1 as v from session_scripts where assessment_id = $1`, [assessmentId]);
  await sql.query(`insert into session_scripts (assessment_id, booking_id, version, kind, content, created_by) values ($1,$2,$3,'coach_edited',$4,$5)`,
    [assessmentId, bookingId, v.rows[0].v, JSON.stringify(content), coachId]);
  await audit(sql, coachId, "script.edited", "assessment", assessmentId, { version: v.rows[0].v });
  return v.rows[0].v;
}

export interface NoteInput {
  id?: string; bookingId: string | null; notes: string; validatedFindings: Record<string, string>;
  agreedNextSteps: { steps: string[]; coachingInquiry: boolean }; followUpStatus: "none" | "planned" | "sent" | "done";
}

export async function saveNote(sql: Sql, coachId: string, assessmentId: string, n: NoteInput) {
  const args = [encrypt(n.notes), JSON.stringify(n.validatedFindings), JSON.stringify(n.agreedNextSteps), n.followUpStatus];
  let id = n.id;
  if (id) await sql.query(`update session_notes set notes_ciphertext = $2, validated_findings = $3, agreed_next_steps = $4, follow_up_status = $5, updated_at = now() where id = $1 and assessment_id = $6`, [id, ...args, assessmentId]);
  else id = (await sql.query<{ id: string }>(
    `insert into session_notes (assessment_id, booking_id, coach_id, notes_ciphertext, validated_findings, agreed_next_steps, follow_up_status) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [assessmentId, n.bookingId, coachId, ...args])).rows[0].id;
  await audit(sql, coachId, "notes.saved", "assessment", assessmentId);
  return id;
}

export async function setReviewState(sql: Sql, coachId: string, reportId: string, state: "unreviewed" | "in_review" | "reviewed") {
  const r = await sql.query<{ assessment_id: string }>(`update coach_reports set review_state = $2 where id = $1 returning assessment_id`, [reportId, state]);
  if (r.rows[0]) await audit(sql, coachId, "coach_report.review", "assessment", r.rows[0].assessment_id, { state });
  return r.rows.length > 0;
}

/** Coach closes a reconciliation item after dealing with it (e.g. refund done, test booking). The booking itself is
 *  unchanged; the reason is kept in the audit log. */
export async function resolveBooking(sql: Sql, coachId: string, bookingId: string) {
  const r = await sql.query<{ reason: string | null }>(
    `update bookings b set needs_reconciliation = false, reconciliation_reason = null, updated_at = now()
     from (select id, reconciliation_reason as reason from bookings where id = $1) old
     where b.id = old.id and b.needs_reconciliation returning old.reason`, [bookingId]);
  if (r.rows.length) await audit(sql, coachId, "booking.resolved", "booking", bookingId, { reason: r.rows[0].reason });
  return r.rows.length > 0;
}

export async function setBookingOutcome(sql: Sql, coachId: string, bookingId: string, state: "completed" | "no_show") {
  const r = await sql.query(`update bookings set booking_state = $2, updated_at = now() where id = $1 and booking_state in ('confirmed','completed','no_show') returning id`, [bookingId, state]);
  if (r.rows.length) await audit(sql, coachId, `booking.${state}`, "booking", bookingId);
  return r.rows.length > 0;
}

/**
 * Name shown for an assessment: updates the most recently linked client's name, or (anonymous assessment)
 * creates a client with only that name, linked as coach_manual. Email is never touched or merged.
 */
/** The client record behind an assessment, created (coach_manual, no details) when the assessment is anonymous. */
async function clientFor(sql: Sql, assessmentId: string): Promise<string> {
  const linked = await sql.query<{ client_id: string }>(
    `select client_id from assessment_client_links where assessment_id = $1 order by linked_at desc limit 1`, [assessmentId]);
  if (linked.rows[0]) return linked.rows[0].client_id;
  const id = (await sql.query<{ id: string }>(`insert into clients default values returning id`)).rows[0].id;
  await sql.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis, verified_at) values ($1,$2,'coach_manual','coach_entered', now())`, [assessmentId, id]);
  return id;
}

/** Enrolled on 1:1 coaching (set by the coach), with an optional start date. */
export async function setCoachingEnrollment(sql: Sql, coachId: string, assessmentId: string, enrolled: boolean, since: string | null) {
  const clientId = await clientFor(sql, assessmentId);
  await sql.query(`update clients set coaching_enrolled = $2, coaching_enrolled_at = $3, stage = case when $2 then 'client' when stage = 'client' then 'lead' else stage end, stage_changed_at = now() where id = $1`, [clientId, enrolled, enrolled ? since : null]);
  await audit(sql, coachId, enrolled ? "client.coaching_enrolled" : "client.coaching_unenrolled", "assessment", assessmentId);
}

export async function setDisplayName(sql: Sql, coachId: string, assessmentId: string, name: string | null) {
  const clean = name?.trim() ? name.trim().slice(0, 120) : null;
  const linked = await sql.query<{ client_id: string }>(
    `select client_id from assessment_client_links where assessment_id = $1 order by linked_at desc limit 1`, [assessmentId]);
  if (linked.rows[0]) await sql.query(`update clients set name = $2 where id = $1`, [linked.rows[0].client_id, clean]);
  else if (clean) {
    const id = (await sql.query<{ id: string }>(`insert into clients (name) values ($1) returning id`, [clean])).rows[0].id;
    await sql.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis, verified_at) values ($1,$2,'coach_manual','coach_entered', now())`, [assessmentId, id]);
  }
  await audit(sql, coachId, "client.name_set", "assessment", assessmentId);
}

// ── Post-session: validations, report versions, Client Understanding ────────
import type { CoachReport } from "@/engine/coach/report";
import { generateUnderstandingDocument, type UnderstandingDocument, type ValidationStatus } from "@/engine/coach/understanding";
import { decrypt } from "../crypto";

/** Mark one interpretation as confirmed / clarified / challenged / not discussed, with an optional encrypted note. */
export async function saveValidation(sql: Sql, coachId: string, assessmentId: string, v: { insightId: string; title: string; status: ValidationStatus; note: string | null }) {
  await sql.query(
    `insert into interpretation_validations (assessment_id, insight_id, insight_title, status, note_ciphertext, coach_id, updated_at) values ($1,$2,$3,$4,$5,$6, now())
     on conflict (assessment_id, insight_id) do update set status = excluded.status, insight_title = excluded.insight_title, note_ciphertext = excluded.note_ciphertext, coach_id = excluded.coach_id, updated_at = now()`,
    [assessmentId, v.insightId, v.title.slice(0, 200), v.status, v.note?.trim() ? encrypt(v.note.trim()) : null, coachId]);
  await audit(sql, coachId, "interpretation.marked", "assessment", assessmentId, { status: v.status });
}

/** Jana's edited Coach Report saved as a new version; the generated original stays. */
export async function saveReportVersion(sql: Sql, coachId: string, assessmentId: string, content: CoachReport) {
  const r = await sql.query<{ id: string }>(
    `insert into coach_reports (assessment_id, content, evidence_refs, template_version, kind, created_by) values ($1,$2,'[]',$3,'coach_edited',$4) returning id`,
    [assessmentId, JSON.stringify(content), content.templateVersion, coachId]);
  await audit(sql, coachId, "coach_report.edited", "assessment", assessmentId);
  return r.rows[0].id;
}

/** Build the Client Understanding & Coaching Direction from the latest report, validations and session notes. */
export async function generateUnderstanding(sql: Sql, coachId: string, assessmentId: string) {
  const rep = (await sql.query<{ content: CoachReport }>(`select content from coach_reports where assessment_id = $1 order by created_at desc limit 1`, [assessmentId])).rows[0];
  if (!rep?.content.intelligence) return { ok: false as const, error: "no_report" as const };
  const vals = (await sql.query<{ insight_id: string; insight_title: string; status: ValidationStatus; note_ciphertext: string | null }>(
    `select insight_id, insight_title, status, note_ciphertext from interpretation_validations where assessment_id = $1`, [assessmentId])).rows
    .map((r) => ({ insightId: r.insight_id, title: r.insight_title, status: r.status, note: r.note_ciphertext ? safeDecrypt(r.note_ciphertext) : null }));
  const note = (await sql.query<{ agreed_next_steps: { steps: string[]; coachingInquiry: boolean } | null }>(
    `select agreed_next_steps from session_notes where assessment_id = $1 order by updated_at desc limit 1`, [assessmentId])).rows[0];
  const enr = (await sql.query<{ coaching_enrolled: boolean; coaching_enrolled_at: string | null }>(
    `select c.coaching_enrolled, c.coaching_enrolled_at::text as coaching_enrolled_at from assessment_client_links l join clients c on c.id = l.client_id where l.assessment_id = $1 and c.coaching_enrolled limit 1`, [assessmentId])).rows[0];
  const doc = generateUnderstandingDocument({
    intelligence: rep.content.intelligence, validations: vals,
    agreedNextSteps: note?.agreed_next_steps?.steps ?? [], coachingInquiry: note?.agreed_next_steps?.coachingInquiry ?? false,
    enrolled: enr ? { since: enr.coaching_enrolled_at } : null,
  });
  const version = await insertUnderstanding(sql, coachId, assessmentId, doc, "generated");
  return { ok: true as const, version, doc };
}

export async function saveUnderstandingEdit(sql: Sql, coachId: string, assessmentId: string, doc: UnderstandingDocument) {
  return insertUnderstanding(sql, coachId, assessmentId, doc, "coach_edited");
}

async function insertUnderstanding(sql: Sql, coachId: string, assessmentId: string, doc: UnderstandingDocument, kind: "generated" | "coach_edited") {
  const v = (await sql.query<{ v: number }>(`select coalesce(max(version), 0) + 1 as v from understanding_documents where assessment_id = $1`, [assessmentId])).rows[0].v;
  await sql.query(`insert into understanding_documents (assessment_id, version, kind, content_ciphertext, created_by) values ($1,$2,$3,$4,$5)`,
    [assessmentId, v, kind, encrypt(JSON.stringify(doc)), coachId]);
  await sql.query(`insert into report_artifacts (assessment_id, artifact_type, version, generation_status) values ($1,'client_understanding',$2,'ready')`, [assessmentId, v]);
  await audit(sql, coachId, `understanding.${kind}`, "assessment", assessmentId, { version: v });
  return v;
}

function safeDecrypt(s: string) { try { return decrypt(s); } catch { return null; } }
