/** Acceptance 7: admin sees the complete record; the public cannot read coach material. RLS requires coach + MFA. */
import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, as } from "./pg";

const COACH = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
let db: PGlite;
let assessmentId: string;

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`insert into auth.users values ('${COACH}'), ('${OTHER}');
    insert into coach_users (user_id, display_name, role) values ('${COACH}', 'Jana', 'admin');`);
  const r = await db.query<{ id: string }>(`insert into assessments (access_token_hash, assessment_version, question_bank_version, status)
    values ('h1', 'v10-with-approved-oct12-overrides', 'v10-oct12', 'completed') returning id`);
  assessmentId = r.rows[0].id;
  await db.exec(`insert into coach_reports (assessment_id, content, evidence_refs, template_version) values ('${assessmentId}', '{"x":1}', '[]', '1');
    insert into session_notes (assessment_id, coach_id, notes_ciphertext) values ('${assessmentId}', '${COACH}', 'enc');
    insert into coaching_applications (assessment_id, name, email, message_ciphertext, request_id) values ('${assessmentId}', 'Ana', 'ana@example.com', 'enc', gen_random_uuid());`);
}, 60000);

const count = (table: string) => db.query<{ n: number }>(`select count(*)::int as n from ${table}`).then((r) => r.rows[0].n);

describe("row level security", () => {
  it("anonymous public role sees nothing", async () => {
    await as(db, { role: "anon" }, async () => {
      for (const t of ["assessments", "coach_reports", "session_notes", "session_scripts", "clients", "bookings"]) expect(await count(t)).toBe(0);
    });
  });
  it("anonymous public role cannot write", async () => {
    await as(db, { role: "anon" }, async () => {
      await expect(db.exec(`insert into clients (email) values ('x@y.z')`)).rejects.toThrow();
    });
  });
  it("a signed-in non-coach sees nothing", async () => {
    await as(db, { role: "authenticated", sub: OTHER, aal: "aal2" }, async () => {
      expect(await count("coach_reports")).toBe(0);
      expect(await count("assessments")).toBe(0);
    });
  });
  it("a coach without MFA (aal1) sees nothing", async () => {
    await as(db, { role: "authenticated", sub: COACH, aal: "aal1" }, async () => {
      expect(await count("coach_reports")).toBe(0);
    });
  });
  it("a coach with MFA sees the complete record, including the list view", async () => {
    await as(db, { role: "authenticated", sub: COACH, aal: "aal2" }, async () => {
      expect(await count("assessments")).toBe(1);
      expect(await count("coach_reports")).toBe(1);
      expect(await count("session_notes")).toBe(1);
      const list = await db.query<{ assessment_id: string; client_email: string | null }>(`select assessment_id, client_email from admin_assessment_list`);
      expect(list.rows).toHaveLength(1);
      expect(list.rows[0].client_email).toBeNull(); // anonymous stays anonymous
    });
  });
  it("coaching applications: only a coach with MFA can read them; nobody can insert through the API", async () => {
    await as(db, { role: "anon" }, async () => {
      expect(await count("coaching_applications")).toBe(0);
      await expect(db.exec(`insert into coaching_applications (name, email, request_id) values ('x', 'x@y.z', gen_random_uuid())`)).rejects.toThrow();
    });
    await as(db, { role: "authenticated", sub: OTHER, aal: "aal2" }, async () => { expect(await count("coaching_applications")).toBe(0); });
    await as(db, { role: "authenticated", sub: COACH, aal: "aal1" }, async () => { expect(await count("coaching_applications")).toBe(0); });
    await as(db, { role: "authenticated", sub: COACH, aal: "aal2" }, async () => {
      expect(await count("coaching_applications")).toBe(1);
      await expect(db.exec(`insert into coaching_applications (name, email, request_id) values ('x', 'x@y.z', gen_random_uuid())`)).rejects.toThrow();
    });
  });
  it("booking link tokens are never readable by coaches through the API", async () => {
    await as(db, { role: "authenticated", sub: COACH, aal: "aal2" }, async () => {
      expect(await count("booking_link_tokens")).toBe(0);
    });
  });
  it("deletion cascades and is audited", async () => {
    const r = await db.query<{ id: string }>(`insert into assessments (access_token_hash, assessment_version, question_bank_version) values ('h2','v','q') returning id`);
    const id = r.rows[0].id;
    await db.exec(`insert into assessment_answers (assessment_id, question_id, question_version, response_status, raw_ordinal) values ('${id}', 'mind.01', 'v10-oct12', 'answered', 3)`);
    await db.exec("begin");
    await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [COACH, JSON.stringify({ sub: COACH, aal: "aal2" })]);
    await db.query(`select delete_assessment($1)`, [id]);
    await db.exec("commit");
    expect((await db.query(`select 1 from assessment_answers where assessment_id = $1`, [id])).rows).toHaveLength(0);
    expect((await db.query(`select 1 from audit_events where action = 'assessment.delete' and target_id = $1`, [id])).rows).toHaveLength(1);
  });
});
