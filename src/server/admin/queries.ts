import "server-only";
import type { Sql } from "../db";
import { decrypt } from "../crypto";
import { audit } from "../audit";
import { profileForAssessment } from "./clients";
import type { ListFilters, ListRow, ReconRow, WorkspaceData } from "./types";

const PAGE = 25;
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));
const isoRow = <T,>(r: T): T =>
  Object.fromEntries(Object.entries(r as object).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as T;

/** Primary table. Reads the RLS-protected list view: ids, states and contact fields only — no answers, no notes. */
export async function listAssessments(sql: Sql, f: ListFilters): Promise<{ rows: ListRow[]; total: number; page: number; pages: number }> {
  const where: string[] = [], p: unknown[] = [];
  const add = (cond: string, v: unknown) => { p.push(v); where.push(cond.replaceAll("?", `$${p.length}`)); };
  if (f.q?.trim()) add(`(assessment_id::text ilike ? || '%' or client_email ilike '%' || ? || '%' or client_name ilike '%' || ? || '%')`, f.q.trim());
  if (f.booking === "none") where.push("booking_state is null");
  else if (f.booking) add("booking_state = ?", f.booking);
  if (f.completion) add("status = ?", f.completion);
  if (f.report === "ready") where.push("report_status = 'ready'");
  if (f.report === "none") where.push("report_status is null");
  if (f.from) add("created_at >= ?::date", f.from);
  if (f.to) add("created_at < (?::date + 1)", f.to);
  const sort = ["created_at", "completed_at", "last_activity_at", "scheduled_start"].includes(f.sort ?? "") ? f.sort : "created_at";
  const dir = f.dir === "asc" ? "asc" : "desc";
  const w = where.length ? `where ${where.join(" and ")}` : "";
  const total = Number((await sql.query<{ n: number }>(`select count(*)::int as n from admin_assessment_list ${w}`, p)).rows[0].n);
  const page = Math.max(1, Math.min(f.page ?? 1, Math.max(1, Math.ceil(total / PAGE))));
  const rows = (await sql.query<ListRow>(`select * from admin_assessment_list ${w} order by ${sort} ${dir} nulls last limit ${PAGE} offset ${(page - 1) * PAGE}`, p)).rows.map(isoRow);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** Name, email or assessment-ID prefix search for reconciliation (max 8). Reads the RLS-protected list view. */
export async function searchAssessments(sql: Sql, q: string): Promise<import("./types").SearchHit[]> {
  const term = q.trim().slice(0, 120);
  if (term.length < 2) return [];
  return (await sql.query<import("./types").SearchHit>(
    `select assessment_id, created_at, status, client_name, client_email, booking_state from admin_assessment_list
     where assessment_id::text ilike $1 || '%' or client_email ilike '%' || $1 || '%' or client_name ilike '%' || $1 || '%'
        or exists (select 1 from assessment_client_links l join clients c on c.id = l.client_id
                   where l.assessment_id = admin_assessment_list.assessment_id and (c.email ilike '%' || $1 || '%' or c.name ilike '%' || $1 || '%'))
     order by created_at desc limit 8`, [term])).rows.map(isoRow);
}

export async function reconciliationQueue(sql: Sql): Promise<ReconRow[]> {
  return (await sql.query<ReconRow>(
    `select id, booked_name, booked_email, scheduled_start, booking_state, payment_state, reconciliation_reason, assessment_id, created_at
     from bookings where needs_reconciliation order by created_at desc limit 100`)).rows.map(isoRow);
}

const decryptOr = (blob: string | null) => { if (!blob) return null; try { return decrypt(blob); } catch { return "[encrypted — key unavailable]"; } };

/** Everything for one assessment workspace. Viewing is audited. */
export async function loadWorkspace(sql: Sql, viewer: WorkspaceData["viewer"], id: string): Promise<WorkspaceData | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const a = (await sql.query<WorkspaceData["assessment"]>(
    `select id, status, created_at, completed_at, sections_completed, assessment_version, question_bank_version, last_activity_at from assessments where id = $1 and status <> 'deleted'`, [id])).rows[0];
  if (!a) return null;
  const q = async <T,>(text: string) => (await sql.query<T>(text, [id])).rows.map(isoRow);

  const answers = (await q<{ question_id: string; question_version: string; response_status: string; raw_ordinal: number | null; raw_value: unknown; text_ciphertext: string | null; answered_at: string }>(
    `select question_id, question_version, response_status, raw_ordinal, raw_value, text_ciphertext, answered_at from assessment_answers where assessment_id = $1`))
    .map(({ raw_value, text_ciphertext, ...r }) => ({ ...r, value: (raw_value as string | string[] | null) ?? decryptOr(text_ciphertext) }));
  const result = (await q<{ snapshot: never; snapshot_sha256: string; generated_at: string; scoring_version: string }>(
    `select snapshot, snapshot_sha256, generated_at, scoring_version from assessment_results where assessment_id = $1 order by generated_at desc limit 1`))
    .map((r) => ({ snapshot: r.snapshot, sha256: r.snapshot_sha256, generated_at: r.generated_at, scoring_version: r.scoring_version }))[0] ?? null;
  const coachReport = (await q<WorkspaceData["coachReport"] & Record<string, unknown>>(
    `select id, content, review_state, template_version, created_at from coach_reports where assessment_id = $1 order by created_at desc limit 1`))[0] ?? null;
  const coachReports = await q<never>(`select id, content, kind, created_at from coach_reports where assessment_id = $1 order by created_at desc`);
  const validations = (await q<{ insight_id: string; insight_title: string; status: string; note_ciphertext: string | null; updated_at: string }>(
    `select insight_id, insight_title, status, note_ciphertext, updated_at from interpretation_validations where assessment_id = $1`))
    .map(({ note_ciphertext, ...v }) => ({ ...v, note: decryptOr(note_ciphertext) }));
  const understandingDocs = (await q<{ version: number; kind: string; content_ciphertext: string; created_at: string }>(
    `select version, kind, content_ciphertext, created_at from understanding_documents where assessment_id = $1 order by version desc`))
    .map(({ content_ciphertext, ...d }) => { let content = null; try { content = JSON.parse(decrypt(content_ciphertext)); } catch { /* key unavailable */ } return { ...d, content }; })
    .filter((d) => d.content);
  const scripts = await q<never>(`select id, version, kind, booking_id, content, created_at from session_scripts where assessment_id = $1 order by version desc`);
  const clients = await q<never>(
    `select c.id, c.name, c.email, c.phone, l.link_source, l.linked_at, l.verified_at, c.coaching_enrolled, c.coaching_enrolled_at::text as coaching_enrolled_at from assessment_client_links l join clients c on c.id = l.client_id
     where l.assessment_id = $1 order by l.linked_at`);
  const bookings = await q<WorkspaceData["bookings"][number] & Record<string, unknown>>(
    `select id, provider, provider_event_id, provider_invitee_id, booking_state, scheduled_start, scheduled_end, timezone, meeting_url, booked_name, booked_email,
       intake_answers, payment_reference, payment_state, rescheduled_from, needs_reconciliation, reconciliation_reason, created_at
     from bookings where assessment_id = $1 order by created_at`);
  for (const b of bookings)
    b.events = (await sql.query<never>(`select event_type, received_at, processed_at, processing_error from booking_events where booking_id = $1 order by received_at`, [b.id])).rows.map(isoRow);
  const pdfRequests = await q<never>(
    `select id, email, requested_at, delivery_state, provider_message_id, retry_count, marketing_consent, last_error from pdf_requests where assessment_id = $1 order by requested_at`);
  const consents = await q<never>(
    `select consent_type, notice_version, status, source, created_at from consents
     where (subject_type = 'assessment' and subject_id = $1)
        or (subject_type = 'client' and subject_id in (select client_id from assessment_client_links where assessment_id = $1)) order by created_at`);
  const notes = (await q<{ id: string; booking_id: string | null; notes_ciphertext: string; validated_findings: never; agreed_next_steps: never; follow_up_status: string; updated_at: string }>(
    `select id, booking_id, notes_ciphertext, validated_findings, agreed_next_steps, follow_up_status, updated_at from session_notes where assessment_id = $1 order by updated_at desc`))
    .map(({ notes_ciphertext, ...n }) => ({ ...n, notes: decryptOr(notes_ciphertext) ?? "" }));
  const artifacts = await q<never>(`select artifact_type, version, generation_status, checksum, created_at from report_artifacts where assessment_id = $1 order by created_at`);
  const auditRows = await q<never>(
    `select action, actor_id, target_type, created_at, metadata from audit_events
     where target_id = $1::text or target_id in (select id::text from bookings where assessment_id = $1::text::uuid) order by created_at desc limit 200`);
  const relatedAssessments = await q<never>(
    `select distinct a2.id, a2.created_at, a2.status from assessment_client_links l1
     join assessment_client_links l2 on l2.client_id = l1.client_id and l2.assessment_id <> l1.assessment_id
     join assessments a2 on a2.id = l2.assessment_id where l1.assessment_id = $1 and a2.status <> 'deleted' order by a2.created_at`);

  const { profile, possibleProfiles } = await profileForAssessment(sql, id);
  await audit(sql, viewer.userId, "assessment.viewed", "assessment", id);
  return {
    assessment: isoRow(a as never), answers: answers as never, result, coachReport: coachReport as never, coachReports, validations: validations as never, understandingDocs: understandingDocs as never, scripts, clients, bookings: bookings as never,
    pdfRequests, consents, notes: notes as never, artifacts, audit: auditRows, relatedAssessments, profile, possibleProfiles, viewer,
  };
}

export async function coachRole(sql: Sql): Promise<"coach" | "admin" | null> {
  const r = await sql.query<{ role: "coach" | "admin" }>(`select role from coach_users where user_id = auth.uid()`);
  return r.rows[0]?.role ?? null;
}

export { iso };
