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

export async function setBookingOutcome(sql: Sql, coachId: string, bookingId: string, state: "completed" | "no_show") {
  const r = await sql.query(`update bookings set booking_state = $2, updated_at = now() where id = $1 and booking_state in ('confirmed','completed','no_show') returning id`, [bookingId, state]);
  if (r.rows.length) await audit(sql, coachId, `booking.${state}`, "booking", bookingId);
  return r.rows.length > 0;
}
