import "server-only";
import type { Sql } from "./db";

/** Audit trail: ids and states only — never answer bodies, free text or notes. */
export async function audit(sql: Sql, actorId: string | null, action: string, targetType: string, targetId: string, metadata?: Record<string, string | number | boolean | null>) {
  await sql.query(`insert into audit_events (actor_id, action, target_type, target_id, metadata) values ($1,$2,$3,$4,$5)`,
    [actorId, action, targetType, targetId, metadata ? JSON.stringify(metadata) : null]);
}
