import "server-only";
import { randomUUID } from "crypto";
import type { Sql } from "../db";
import { audit } from "../audit";
import { decrypt, decryptBytes, encrypt, encryptBytes, randomToken, sha256 } from "../crypto";
import type { FileStore } from "../files";
import type { LifeMapResult } from "@/engine/compute";
import type {
  AttachmentView, ClientListRow, ClientMap, ClientNoteView, ClientProfileData, PossibleMatch, SessionInput, SessionView, Stage,
} from "./types";

/**
 * Client profiles (Oct 13): Prospect → Lead → Client, every Map under one profile, sessions with planning, notes
 * and homework, person-level notes, and attachments. All free text and files are encrypted at the application
 * layer. Records are joined only when the coach confirms — never automatically by email.
 */

const isoRow = <T,>(r: T): T => Object.fromEntries(Object.entries(r as object).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as T;
const dec = (blob: string | null) => { if (!blob) return ""; try { return decrypt(blob); } catch { return "[encrypted — key unavailable]"; } };
const enc = (s: string | null | undefined) => (s && s.trim() ? encrypt(s.trim()) : null);
const UUID = /^[0-9a-f-]{36}$/;

export async function listClients(sql: Sql, f: { q?: string; stage?: Stage } = {}): Promise<ClientListRow[]> {
  const where: string[] = [], p: unknown[] = [];
  if (f.q?.trim()) { p.push(f.q.trim().slice(0, 120)); where.push(`(name ilike '%' || $${p.length} || '%' or email ilike '%' || $${p.length} || '%' or client_id::text ilike $${p.length} || '%')`); }
  if (f.stage) { p.push(f.stage); where.push(`stage = $${p.length}`); }
  const w = where.length ? `where ${where.join(" and ")}` : "";
  return (await sql.query<ClientListRow>(
    `select client_id, name, email, stage, stage_changed_at, created_at, maps, last_map_at, sessions, next_session::text, last_session::text
     from admin_client_list ${w} order by (stage = 'client') desc, (stage = 'lead') desc, coalesce(last_map_at, created_at) desc limit 300`, p)).rows.map(isoRow);
}

// ── Profile ───────────────────────────────────────────────────────────────
export async function loadClientProfile(sql: Sql, viewer: ClientProfileData["viewer"], id: string): Promise<ClientProfileData | null> {
  if (!UUID.test(id)) return null;
  const c = (await sql.query<{ id: string; name: string | null; email: string | null; phone: string | null; stage: Stage; stage_changed_at: string | null; created_at: string; coaching_enrolled_at: string | null; invite_token_ciphertext: string | null; invite_created_at: string | null; merged_into_client_id: string | null }>(
    `select id, name, email, phone, stage, stage_changed_at, created_at, coaching_enrolled_at::text, invite_token_ciphertext, invite_created_at, merged_into_client_id
     from clients where id = $1 and privacy_status <> 'deleted'`, [id])).rows[0];
  if (!c) return null;
  if (c.merged_into_client_id) return loadClientProfile(sql, viewer, c.merged_into_client_id);

  const maps = (await sql.query<{ assessment_id: string; created_at: string; completed_at: string | null; status: string; link_sources: string[]; snapshot: LifeMapResult | null }>(
    `select a.id as assessment_id, a.created_at, a.completed_at, a.status, array_agg(distinct l.link_source) as link_sources,
       (select r.snapshot from assessment_results r where r.assessment_id = a.id order by r.generated_at desc limit 1) as snapshot
     from assessment_client_links l join assessments a on a.id = l.assessment_id
     where l.client_id = $1 and a.status <> 'deleted' group by a.id order by a.created_at`, [id])).rows.map(isoRow)
    .map(({ snapshot, ...m }): ClientMap => ({
      ...m,
      orbits: snapshot ? snapshot.orbits.map((o) => ({ orbit: o.orbit, name: o.name, importanceOrdinal: o.importanceOrdinal, energyRaw: o.energyRaw, responseSupportIndex: o.responseSupportIndex })) : null,
      sunIndex: snapshot?.sun.responseIndex ?? null,
    }));

  const files = (await sql.query<AttachmentView>(
    `select id, filename, content_type, size_bytes, purpose, session_id, note_id, created_at from client_attachments where client_id = $1 order by created_at desc`, [id])).rows.map(isoRow);
  const sessions = (await sql.query<{ id: string; session_date: string | null; title: string | null; kind: SessionView["kind"]; assessment_id: string | null; plan_ciphertext: string | null; notes_ciphertext: string | null; homework_ciphertext: string | null; created_at: string; updated_at: string }>(
    `select id, session_date::text, title, kind, assessment_id, plan_ciphertext, notes_ciphertext, homework_ciphertext, created_at, updated_at
     from coaching_sessions where client_id = $1 order by session_date desc nulls first, created_at desc`, [id])).rows.map(isoRow)
    .map(({ plan_ciphertext, notes_ciphertext, homework_ciphertext, ...s }): SessionView => ({
      ...s, plan: dec(plan_ciphertext), notes: dec(notes_ciphertext), homework: dec(homework_ciphertext), attachments: files.filter((f) => f.session_id === s.id),
    }));
  const notes = (await sql.query<{ id: string; body_ciphertext: string; created_at: string; updated_at: string }>(
    `select id, body_ciphertext, created_at, updated_at from client_notes where client_id = $1 order by created_at desc`, [id])).rows.map(isoRow)
    .map(({ body_ciphertext, ...n }): ClientNoteView => ({ ...n, body: dec(body_ciphertext), attachments: files.filter((f) => f.note_id === n.id) }));

  const possibleMatches = await matchesFor(sql, id, c.email);
  let token: string | null = null;
  if (c.invite_token_ciphertext) { try { token = decrypt(c.invite_token_ciphertext); } catch { token = null; } }

  await audit(sql, viewer.userId, "client.viewed", "client", id);
  return {
    client: { id: c.id, name: c.name, email: c.email, phone: c.phone, stage: c.stage, stage_changed_at: c.stage_changed_at, created_at: c.created_at, coaching_enrolled_at: c.coaching_enrolled_at,
      invite: c.invite_created_at ? { token, created_at: c.invite_created_at } : null } as ClientProfileData["client"],
    maps, sessions, notes, attachments: files.filter((f) => !f.session_id && !f.note_id), possibleMatches, viewer,
  };
}

/** Other records with the same email whose Maps aren't on this profile yet. Shown as suggestions only. */
async function matchesFor(sql: Sql, clientId: string, email: string | null): Promise<PossibleMatch[]> {
  if (!email?.trim()) return [];
  const rows = (await sql.query<{ client_id: string; name: string | null; email: string | null; stage: Stage; id: string; created_at: string; status: string }>(
    `select c.id as client_id, c.name, c.email, c.stage, a.id, a.created_at, a.status
     from clients c join assessment_client_links l on l.client_id = c.id join assessments a on a.id = l.assessment_id
     where lower(c.email) = lower($2) and c.id <> $1 and c.merged_into_client_id is null and c.privacy_status = 'active' and a.status <> 'deleted'
       and not exists (select 1 from assessment_client_links mine where mine.client_id = $1 and mine.assessment_id = a.id)
     order by a.created_at`, [clientId, email])).rows.map(isoRow);
  const by = new Map<string, PossibleMatch>();
  for (const r of rows) {
    const m = by.get(r.client_id) ?? { client_id: r.client_id, name: r.name, email: r.email, stage: r.stage, assessments: [] };
    if (!m.assessments.some((a) => a.id === r.id)) m.assessments.push({ id: r.id, created_at: r.created_at, status: r.status });
    by.set(r.client_id, m);
  }
  return [...by.values()];
}

/** For the assessment workspace: its profile, and profiles that share an email with it (suggestions). */
export async function profileForAssessment(sql: Sql, assessmentId: string) {
  const profile = (await sql.query<{ client_id: string; name: string | null; stage: Stage }>(
    `select c.id as client_id, c.name, c.stage from assessment_client_links l join clients c on c.id = l.client_id
     where l.assessment_id = $1 and c.merged_into_client_id is null order by (l.link_source in ('coach_manual','client_invite')) desc, l.linked_at desc limit 1`, [assessmentId])).rows[0] ?? null;
  const possibleProfiles = (await sql.query<{ client_id: string; name: string | null; email: string | null; stage: Stage }>(
    `select distinct c2.id as client_id, c2.name, c2.email, c2.stage
     from assessment_client_links l join clients c on c.id = l.client_id
     join clients c2 on lower(c2.email) = lower(c.email) and c2.id <> c.id and c2.merged_into_client_id is null and c2.privacy_status = 'active'
     where l.assessment_id = $1 and c.email is not null
       and not exists (select 1 from assessment_client_links x where x.assessment_id = $1 and x.client_id = c2.id)`, [assessmentId])).rows;
  return { profile, possibleProfiles };
}

// ── Create / stage / details / link ─────────────────────────────────────────
/** "Create client profile" from a Map: reuses the record already linked to it, otherwise creates one (coach_manual). */
export async function createProfileForAssessment(sql: Sql, coachId: string, assessmentId: string, name: string | null) {
  const { profile } = await profileForAssessment(sql, assessmentId);
  if (profile) return profile.client_id;
  const id = (await sql.query<{ id: string }>(`insert into clients (name) values ($1) returning id`, [name?.trim() ? name.trim().slice(0, 120) : null])).rows[0].id;
  await sql.query(`insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis, verified_at) values ($1,$2,'coach_manual','coach_entered', now())`, [assessmentId, id]);
  await audit(sql, coachId, "client.profile_created", "client", id, { assessment: assessmentId });
  return id;
}

/** Prospect / Lead / Client. Becoming a Client also creates the private self-interview link (if none yet). */
export async function setStage(sql: Sql, coachId: string, clientId: string, stage: Stage, since: string | null = null) {
  const r = await sql.query<{ invite_token_hash: string | null }>(
    `update clients set stage = $2, stage_changed_at = now(), coaching_enrolled = ($2 = 'client'),
       coaching_enrolled_at = case when $2 = 'client' then coalesce($3::date, coaching_enrolled_at, current_date) else null end
     where id = $1 returning invite_token_hash`, [clientId, stage, since]);
  if (!r.rows[0]) return { ok: false as const };
  await audit(sql, coachId, `client.stage_${stage}`, "client", clientId);
  if (stage === "client" && !r.rows[0].invite_token_hash) await createInvite(sql, coachId, clientId);
  return { ok: true as const };
}

export async function setClientDetails(sql: Sql, coachId: string, clientId: string, d: { name: string | null; email: string | null; phone: string | null }) {
  const clean = (s: string | null, n: number) => (s?.trim() ? s.trim().slice(0, n) : null);
  await sql.query(`update clients set name = $2, email = $3, phone = $4 where id = $1`, [clientId, clean(d.name, 120), clean(d.email, 254), clean(d.phone, 40)]);
  await audit(sql, coachId, "client.details_updated", "client", clientId);
}

/** New private link (any earlier link stops working). */
export async function createInvite(sql: Sql, coachId: string, clientId: string) {
  const token = randomToken(24);
  await sql.query(`update clients set invite_token_hash = $2, invite_token_ciphertext = $3, invite_created_at = now() where id = $1`, [clientId, sha256(token), encrypt(token)]);
  await audit(sql, coachId, "client.invite_created", "client", clientId);
  return token;
}
export async function revokeInvite(sql: Sql, coachId: string, clientId: string) {
  await sql.query(`update clients set invite_token_hash = null, invite_token_ciphertext = null, invite_created_at = null where id = $1`, [clientId]);
  await audit(sql, coachId, "client.invite_revoked", "client", clientId);
}

/**
 * Jana confirms a Map belongs to this profile. The Map is linked (coach_manual). A duplicate Prospect record that
 * only existed because of that Map (e.g. created by a PDF request) is folded into the profile — never deleted.
 */
export async function attachAssessment(sql: Sql, coachId: string, clientId: string, assessmentId: string) {
  if (!UUID.test(assessmentId)) return { ok: false as const, error: "invalid" as const };
  const a = await sql.query(`select 1 from assessments where id = $1 and status <> 'deleted'`, [assessmentId]);
  if (!a.rows.length) return { ok: false as const, error: "not_found" as const };
  await sql.query(
    `insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis, verified_at) values ($1,$2,'coach_manual','coach_confirmed', now()) on conflict do nothing`,
    [assessmentId, clientId]);
  const folded = await sql.query<{ id: string }>(
    `update clients c set merged_into_client_id = $2
     where c.id in (select client_id from assessment_client_links where assessment_id = $1) and c.id <> $2
       and c.merged_into_client_id is null and c.stage = 'prospect'
       and not exists (select 1 from assessment_client_links o where o.client_id = c.id
                       and not exists (select 1 from assessment_client_links t where t.client_id = $2 and t.assessment_id = o.assessment_id))
       and not exists (select 1 from coaching_sessions s where s.client_id = c.id)
       and not exists (select 1 from client_notes n where n.client_id = c.id)
     returning c.id`, [assessmentId, clientId]);
  await audit(sql, coachId, "client.map_attached", "client", clientId, { assessment: assessmentId, folded: folded.rows.length });
  return { ok: true as const, folded: folded.rows.map((r) => r.id) };
}

/** Remove a Map from a profile (only links made by the coach or the private link; provider-made links stay). */
export async function detachAssessment(sql: Sql, coachId: string, clientId: string, assessmentId: string) {
  await sql.query(`delete from assessment_client_links where client_id = $1 and assessment_id = $2 and link_source in ('coach_manual','client_invite')`, [clientId, assessmentId]);
  await audit(sql, coachId, "client.map_detached", "client", clientId, { assessment: assessmentId });
}

// ── Sessions and notes ───────────────────────────────────────────────────────
export async function saveSession(sql: Sql, coachId: string, clientId: string, s: SessionInput) {
  const args = [s.session_date, s.title?.trim().slice(0, 160) || null, s.kind, s.assessment_id, enc(s.plan), enc(s.notes), enc(s.homework)];
  let id = s.id;
  if (id) {
    const r = await sql.query(`update coaching_sessions set session_date = $3, title = $4, kind = $5, assessment_id = $6, plan_ciphertext = $7, notes_ciphertext = $8, homework_ciphertext = $9, updated_at = now()
      where id = $1 and client_id = $2 returning id`, [id, clientId, ...args]);
    if (!r.rows.length) return null;
  } else id = (await sql.query<{ id: string }>(
    `insert into coaching_sessions (client_id, coach_id, session_date, title, kind, assessment_id, plan_ciphertext, notes_ciphertext, homework_ciphertext)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [clientId, coachId, ...args])).rows[0].id;
  await audit(sql, coachId, s.id ? "session.updated" : "session.created", "client", clientId, { session: id });
  return id;
}

export async function deleteSession(sql: Sql, store: FileStore, coachId: string, clientId: string, sessionId: string) {
  await removeFiles(sql, store, `select storage_path from client_attachments where client_id = $1 and session_id = $2`, [clientId, sessionId]);
  await sql.query(`delete from coaching_sessions where id = $1 and client_id = $2`, [sessionId, clientId]);
  await audit(sql, coachId, "session.deleted", "client", clientId, { session: sessionId });
}

export async function saveClientNote(sql: Sql, coachId: string, clientId: string, n: { id?: string; body: string }) {
  if (!n.body.trim()) return null;
  let id = n.id;
  if (id) {
    const r = await sql.query(`update client_notes set body_ciphertext = $3, updated_at = now() where id = $1 and client_id = $2 returning id`, [id, clientId, encrypt(n.body.trim())]);
    if (!r.rows.length) return null;
  } else id = (await sql.query<{ id: string }>(`insert into client_notes (client_id, coach_id, body_ciphertext) values ($1,$2,$3) returning id`, [clientId, coachId, encrypt(n.body.trim())])).rows[0].id;
  await audit(sql, coachId, n.id ? "client_note.updated" : "client_note.created", "client", clientId);
  return id;
}

export async function deleteClientNote(sql: Sql, store: FileStore, coachId: string, clientId: string, noteId: string) {
  await removeFiles(sql, store, `select storage_path from client_attachments where client_id = $1 and note_id = $2`, [clientId, noteId]);
  await sql.query(`delete from client_notes where id = $1 and client_id = $2`, [noteId, clientId]);
  await audit(sql, coachId, "client_note.deleted", "client", clientId);
}

// ── Attachments ──────────────────────────────────────────────────────────────
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/heic": "heic", "text/plain": "txt", "text/csv": "csv", "text/markdown": "md",
  "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
};
export type AttachmentPurpose = "profile" | "note" | "session_plan" | "session_notes" | "homework";

export async function addAttachment(sql: Sql, store: FileStore, coachId: string, clientId: string,
  f: { purpose: AttachmentPurpose; sessionId?: string | null; noteId?: string | null; filename: string; contentType: string; bytes: Uint8Array }) {
  if (!ALLOWED_TYPES[f.contentType]) return { ok: false as const, error: "type_not_allowed" as const };
  if (f.bytes.length < 1 || f.bytes.length > MAX_ATTACHMENT_BYTES) return { ok: false as const, error: "too_large" as const };
  if (f.sessionId && !(await sql.query(`select 1 from coaching_sessions where id = $1 and client_id = $2`, [f.sessionId, clientId])).rows.length) return { ok: false as const, error: "not_found" as const };
  if (f.noteId && !(await sql.query(`select 1 from client_notes where id = $1 and client_id = $2`, [f.noteId, clientId])).rows.length) return { ok: false as const, error: "not_found" as const };
  const filename = f.filename.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160) || "file";
  const path = `${clientId}/${randomUUID()}`; // no names in storage paths
  await store.put(path, encryptBytes(f.bytes));
  const id = (await sql.query<{ id: string }>(
    `insert into client_attachments (client_id, session_id, note_id, purpose, filename, content_type, size_bytes, storage_path, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [clientId, f.sessionId ?? null, f.noteId ?? null, f.purpose, filename, f.contentType, f.bytes.length, path, coachId])).rows[0].id;
  await audit(sql, coachId, "attachment.added", "client", clientId, { attachment: id, purpose: f.purpose });
  return { ok: true as const, id };
}

export async function getAttachment(sql: Sql, store: FileStore, coachId: string, clientId: string, attachmentId: string) {
  const a = (await sql.query<{ filename: string; content_type: string; storage_path: string }>(
    `select filename, content_type, storage_path from client_attachments where id = $1 and client_id = $2`, [attachmentId, clientId])).rows[0];
  if (!a) return null;
  const blob = await store.get(a.storage_path);
  if (!blob) return null;
  await audit(sql, coachId, "attachment.downloaded", "client", clientId, { attachment: attachmentId });
  return { filename: a.filename, contentType: a.content_type, bytes: decryptBytes(blob) };
}

export async function deleteAttachment(sql: Sql, store: FileStore, coachId: string, clientId: string, attachmentId: string) {
  await removeFiles(sql, store, `select storage_path from client_attachments where id = $2 and client_id = $1`, [clientId, attachmentId]);
  await sql.query(`delete from client_attachments where id = $1 and client_id = $2`, [attachmentId, clientId]);
  await audit(sql, coachId, "attachment.deleted", "client", clientId, { attachment: attachmentId });
}

async function removeFiles(sql: Sql, store: FileStore, query: string, params: unknown[]) {
  const paths = (await sql.query<{ storage_path: string }>(query, params)).rows.map((r) => r.storage_path);
  await store.remove(paths);
}

/** Admin only: delete a whole profile (files first, then the record via delete_client). Assessments are kept. */
export async function deleteClientProfile(sql: Sql, store: FileStore, clientId: string) {
  await removeFiles(sql, store, `select storage_path from client_attachments where client_id = $1`, [clientId]);
  await sql.query(`select delete_client($1)`, [clientId]);
}
