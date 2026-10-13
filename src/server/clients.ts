import "server-only";
import type { Sql } from "./db";
import { sha256 } from "./crypto";
import { audit } from "./audit";

/**
 * Client profiles — the parts the public flow touches.
 *
 * Private client link: Jana gives a Client a personal self-interview link (…/#invite=<token>). The token travels in
 * the URL fragment, which browsers never send to servers or logs, and then in the request body. A Map started with
 * a valid token is attached to that profile (link source "client_invite") and chained to the person's previous Map.
 * Nothing else is ever matched automatically — in particular, never by email.
 */
export const INVITE_RE = /^[A-Za-z0-9_-]{24,64}$/;

export async function clientForInvite(sql: Sql, token: string | null | undefined): Promise<string | null> {
  if (!token || !INVITE_RE.test(token)) return null;
  const r = await sql.query<{ id: string }>(
    `select id from clients where invite_token_hash = $1 and merged_into_client_id is null and privacy_status = 'active'`, [sha256(token)]);
  return r.rows[0]?.id ?? null;
}

export async function attachInviteAssessment(sql: Sql, clientId: string, assessmentId: string) {
  const prev = await sql.query<{ id: string }>(
    `select a.id from assessment_client_links l join assessments a on a.id = l.assessment_id
     where l.client_id = $1 and a.id <> $2 and a.status <> 'deleted' order by a.created_at desc limit 1`, [clientId, assessmentId]);
  await sql.query(
    `insert into assessment_client_links (assessment_id, client_id, link_source, legal_basis, verified_at) values ($1,$2,'client_invite','coaching_relationship', now())
     on conflict do nothing`, [assessmentId, clientId]);
  if (prev.rows[0]) await sql.query(`update assessments set previous_assessment_id = $2 where id = $1 and previous_assessment_id is null`, [assessmentId, prev.rows[0].id]);
  await audit(sql, null, "client.map_attached_by_invite", "client", clientId, { assessment: assessmentId });
}

/** A confirmed Deep Dive booking turns a Prospect into a Lead. Leads and Clients are never moved back. */
export async function promoteToLead(sql: Sql, assessmentId: string, actorId: string | null = null) {
  const r = await sql.query<{ id: string }>(
    `update clients set stage = 'lead', stage_changed_at = now()
     where stage = 'prospect' and merged_into_client_id is null
       and id in (select client_id from assessment_client_links where assessment_id = $1) returning id`, [assessmentId]);
  for (const c of r.rows) await audit(sql, actorId, "client.stage_lead", "client", c.id, { reason: "booking_confirmed" });
}
