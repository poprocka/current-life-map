import "server-only";
import type { AnswerValue } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { ACTIVE_QUESTIONS, ASSESSMENT_VERSION, QUESTION_BANK_VERSION, questionById } from "@/content/v10/question-bank";
import { CHAPTERS } from "@/content/v10/chapters";
import { generateNarrative } from "@/engine/narrative";
import { attachInviteAssessment, clientForInvite } from "./clients";
import { computeLifeMap, type LifeMapResult } from "@/engine/compute";
import { isComplete, validate } from "@/engine/navigation";
import { generateCoachReport, COACH_REPORT_TEMPLATE_VERSION } from "@/engine/coach/report";
import { generateDeepDiveScript, type IntakeAnswer } from "@/engine/coach/script";
import { renderResultsHtml } from "@/server/pdf/document.generated.cjs";
import { snapshotFingerprint } from "@/lib/stable";
import type { Db, Sql } from "./db";
import { decrypt, encrypt, encryptionConfigured, randomToken, sha256 } from "./crypto";
import { audit } from "./audit";

export type Answers = Record<string, AnswerValue>;

/**
 * Start an assessment. With a valid private client link (`invite`), the new Map is attached to that client's
 * profile; an unknown or revoked invite is ignored silently (the person can still complete an anonymous Map).
 */
export async function createAssessment(db: Db, opts: { invite?: string | null } = {}): Promise<{ id: string; token: string; linkedToProfile: boolean }> {
  const token = randomToken();
  return db.tx(async (sql) => {
    const r = await sql.query<{ id: string }>(
      `insert into assessments (access_token_hash, assessment_version, question_bank_version) values ($1, $2, $3) returning id`,
      [sha256(token), ASSESSMENT_VERSION, QUESTION_BANK_VERSION],
    );
    const id = r.rows[0].id;
    const clientId = await clientForInvite(sql, opts.invite);
    if (clientId) await attachInviteAssessment(sql, clientId, id);
    return { id, token, linkedToProfile: !!clientId };
  });
}

export async function resolveToken(sql: Sql, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = await sql.query<{ id: string; status: string }>(`select id, status from assessments where access_token_hash = $1 and status <> 'deleted'`, [sha256(token)]);
  return r.rows[0] ?? null;
}

/** Convert one validated answer to its storage row (raw value kept for exact recomputation). */
export function answerRow(questionId: string, value: AnswerValue) {
  const q = questionById(questionId)!;
  const v = Array.isArray(value) ? value : [value];
  if (q.responseType === "text") return { response_status: "answered", text: String(value) };
  if (value === NOT_APPLICABLE) return { response_status: "not_applicable", raw_value: value };
  const base = { response_status: "answered", raw_value: value } as Record<string, unknown>;
  if (q.responseType === "truth" || q.responseType === "importance") base.raw_ordinal = Number(value) + 1;
  else if (q.responseType === "energy") base.raw_ordinal = 3 - Number(value);
  else if (q.responseType === "orbit_select") { base.selected_orbit = String(value); base.option_ids = v; }
  else base.option_ids = v;
  return base;
}

export function sectionsCompleted(answers: Answers) {
  return CHAPTERS.filter((c) => ACTIVE_QUESTIONS.filter((q) => q.chapterId === c.id && !q.optional).every((q) => answers[q.id] !== undefined)).length;
}

export type SaveResult = { ok: true; saved: number; complete: boolean } | { ok: false; error: "not_found" | "invalid_answer"; id?: string };

export async function saveAnswers(db: Db, token: string, answers: Answers): Promise<SaveResult> {
  for (const [id, value] of Object.entries(answers)) {
    const q = questionById(id);
    if (!q || !q.enabled || validate(q, value) !== null) return { ok: false, error: "invalid_answer", id };
  }
  return db.tx(async (sql) => {
    const a = await resolveToken(sql, token);
    if (!a) return { ok: false as const, error: "not_found" as const };
    if (a.status === "completed") return { ok: true as const, saved: 0, complete: true }; // frozen once completed
    let saved = 0;
    for (const [id, value] of Object.entries(answers)) {
      const row = answerRow(id, value) as Record<string, unknown>;
      if ("text" in row) {
        if (!encryptionConfigured()) continue; // never store free text unencrypted
        row.text_ciphertext = encrypt(String(row.text));
        delete row.text;
      }
      await sql.query(
        `insert into assessment_answers (assessment_id, question_id, question_version, response_status, option_ids, raw_ordinal, selected_orbit, raw_value, text_ciphertext, answered_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
         on conflict (assessment_id, question_id) do update set question_version = excluded.question_version, response_status = excluded.response_status,
           option_ids = excluded.option_ids, raw_ordinal = excluded.raw_ordinal, selected_orbit = excluded.selected_orbit, raw_value = excluded.raw_value,
           text_ciphertext = excluded.text_ciphertext, answered_at = now()`,
        [a.id, id, QUESTION_BANK_VERSION, row.response_status, row.option_ids ?? null, row.raw_ordinal ?? null, row.selected_orbit ?? null,
          row.raw_value === undefined ? null : JSON.stringify(row.raw_value), row.text_ciphertext ?? null],
      );
      saved++;
    }
    await sql.query(`delete from assessment_answers where assessment_id = $1 and question_id not like 'postmap.%' and not (question_id = any($2::text[]))`, [a.id, Object.keys(answers)]);
    await sql.query(`update assessments set sections_completed = $2, last_activity_at = now() where id = $1`, [a.id, sectionsCompleted(answers)]);
    return { ok: true as const, saved, complete: isComplete(answers) };
  });
}

/** Rebuild the answer map from storage (decrypting free text when the key is available). */
export async function loadAnswers(sql: Sql, assessmentId: string, opts: { includeText?: boolean } = {}): Promise<Answers> {
  const r = await sql.query<{ question_id: string; raw_value: AnswerValue | null; text_ciphertext: string | null }>(
    `select question_id, raw_value, text_ciphertext from assessment_answers where assessment_id = $1`, [assessmentId]);
  const out: Answers = {};
  for (const row of r.rows) {
    if (row.raw_value !== null) out[row.question_id] = row.raw_value;
    else if (row.text_ciphertext && opts.includeText) {
      try { out[row.question_id] = decrypt(row.text_ciphertext); } catch { out[row.question_id] = "[could not decrypt]"; }
    }
  }
  return out;
}

export interface FrozenResult { id: string; assessmentId: string; snapshot: LifeMapResult; sha256: string; generatedAt: Date }

export async function frozenResult(sql: Sql, assessmentId: string): Promise<FrozenResult | null> {
  const r = await sql.query<{ id: string; snapshot: LifeMapResult; snapshot_sha256: string; generated_at: Date }>(
    `select id, snapshot, snapshot_sha256, generated_at from assessment_results where assessment_id = $1 order by generated_at desc limit 1`, [assessmentId]);
  const x = r.rows[0];
  return x ? { id: x.id, assessmentId, snapshot: x.snapshot, sha256: x.snapshot_sha256, generatedAt: new Date(x.generated_at) } : null;
}

/**
 * Complete: verify every required answer is stored, compute once, freeze the snapshot, and prepare
 * coach material (Coach Report + generated Deep Dive script v1). Idempotent.
 */
export async function completeAssessment(db: Db, token: string): Promise<{ ok: true; assessmentId: string; sha256: string } | { ok: false; error: "not_found" | "incomplete" }> {
  return db.tx(async (sql) => {
    const a = await resolveToken(sql, token);
    if (!a) return { ok: false as const, error: "not_found" as const };
    const existing = await frozenResult(sql, a.id);
    if (existing) return { ok: true as const, assessmentId: a.id, sha256: existing.sha256 };
    const answers = await loadAnswers(sql, a.id, { includeText: true });
    if (!isComplete(answers)) return { ok: false as const, error: "incomplete" as const };
    const scored = await loadAnswers(sql, a.id); // scoring never sees free text
    const result = computeLifeMap(scored);
    const sha = await snapshotFingerprint(result);
    const metrics = { sun: { responseIndex: result.sun.responseIndex, coverage: result.sun.coverage }, orbits: result.orbits.map(({ items: _i, ...o }) => o) };
    // Versioned public narrative with evidence provenance (brief §7 step 12): what the person read, and why.
    const narrative = generateNarrative(result, scored);
    const evidence = {
      insights: result.insights.map((i) => ({ id: i.id, evidence: i.evidence })), snapshot: result.snapshot.map((s) => ({ key: s.key, evidence: s.evidence })),
      narrative: {
        templateVersion: narrative.templateVersion, versions: narrative.versions,
        centralTheme: narrative.centralTheme,
        rendered: { opening: narrative.opening, mapReading: narrative.mapReading, standsOut: narrative.standsOut, self: narrative.self, connections: narrative.connections, cards: narrative.cards, orbits: narrative.orbits, closingQuestion: narrative.closingQuestion },
        observations: narrative.observations.map((o) => ({ id: o.id, rule: o.rule, areas: o.areas, evidence: o.evidence.map((e) => e.questionId), sufficiency: o.sufficiency, wording: o.wording, relevance: o.relevance, usedIn: o.usedIn, meaning: o.meaning, alternatives: o.alternatives })),
        validationIssues: narrative.validationIssues,
      },
    };
    const ins = await sql.query<{ generated_at: Date }>(
      `insert into assessment_results (assessment_id, scoring_version, metrics, evidence, snapshot, snapshot_sha256) values ($1,$2,$3,$4,$5,$6) returning generated_at`,
      [a.id, result.versions.scoring, JSON.stringify(metrics), JSON.stringify(evidence), JSON.stringify(result), sha]);
    await sql.query(`update assessments set status = 'completed', completed_at = now(), sections_completed = 10, last_activity_at = now() where id = $1`, [a.id]);

    // The PDF itself is printed by Chromium only when someone asks for it (email or coach download), never inside this
    // transaction. Recorded here: a checksum of the exact page content it will print, which is deterministic.
    const pdfHtml = renderResultsHtml({ result, insights: narrative, generatedAt: new Date(ins.rows[0].generated_at).toISOString() });
    await sql.query(`insert into report_artifacts (assessment_id, artifact_type, version, checksum, generation_status) values ($1, 'client_pdf', 2, $2, 'ready')`, [a.id, sha256(new TextEncoder().encode(pdfHtml))]);
    await writeCoachMaterial(sql, a.id, result, answers);
    await audit(sql, null, "assessment.completed", "assessment", a.id, { scoring: result.versions.scoring });
    return { ok: true as const, assessmentId: a.id, sha256: sha };
  });
}

export async function writeCoachMaterial(sql: Sql, assessmentId: string, result: LifeMapResult, answers: Answers, opts: { bookingId?: string; intake?: IntakeAnswer[] } = {}) {
  const hasReport = await sql.query(`select 1 from coach_reports where assessment_id = $1 and template_version = $2`, [assessmentId, COACH_REPORT_TEMPLATE_VERSION]);
  if (!hasReport.rows.length) {
    const report = generateCoachReport(result, answers);
    const refs = [...new Set([...report.sections.flatMap((s) => s.items), ...report.hypotheses].flatMap((i) => i.evidence.map((e) => e.questionId)))];
    await sql.query(`insert into coach_reports (assessment_id, content, evidence_refs, template_version) values ($1,$2,$3,$4)`,
      [assessmentId, JSON.stringify(report), JSON.stringify(refs), COACH_REPORT_TEMPLATE_VERSION]);
    await nextArtifact(sql, assessmentId, "coach_report");
  }
  const script = generateDeepDiveScript(result, answers, opts.intake);
  const v = await sql.query<{ v: number }>(`select coalesce(max(version), 0) + 1 as v from session_scripts where assessment_id = $1`, [assessmentId]);
  await sql.query(`insert into session_scripts (assessment_id, booking_id, version, kind, content) values ($1,$2,$3,'generated',$4)`,
    [assessmentId, opts.bookingId ?? null, v.rows[0].v, JSON.stringify(script)]);
  await nextArtifact(sql, assessmentId, "deep_dive_script");
}

async function nextArtifact(sql: Sql, assessmentId: string, type: string) {
  await sql.query(
    `insert into report_artifacts (assessment_id, artifact_type, version, generation_status)
     select $1, $2, coalesce(max(version), 0) + 1, 'ready' from report_artifacts where assessment_id = $1 and artifact_type = $2`, [assessmentId, type]);
}

/**
 * Optional post-Map reflections. Allowed after completion because they never touch the frozen snapshot.
 * Stored encrypted; nothing is stored when encryption isn't configured.
 */
export async function saveReflections(db: Db, token: string, reflections: Record<string, string>): Promise<{ ok: true; saved: number } | { ok: false; error: "not_found" | "invalid" | "not_configured" }> {
  const { POST_MAP_IDS, POST_MAP_REFLECTIONS } = await import("@/content/v10/reflections");
  for (const [id, v] of Object.entries(reflections)) if (!POST_MAP_IDS.includes(id) || v.length > POST_MAP_REFLECTIONS.maxLength) return { ok: false, error: "invalid" };
  if (!encryptionConfigured()) return { ok: false, error: "not_configured" };
  return db.tx(async (sql) => {
    const a = await resolveToken(sql, token);
    if (!a) return { ok: false as const, error: "not_found" as const };
    let saved = 0;
    for (const [id, v] of Object.entries(reflections)) {
      if (!v.trim()) { await sql.query(`delete from assessment_answers where assessment_id = $1 and question_id = $2`, [a.id, id]); continue; }
      await sql.query(
        `insert into assessment_answers (assessment_id, question_id, question_version, response_status, text_ciphertext, answered_at)
         values ($1,$2,'postmap-1','answered',$3, now())
         on conflict (assessment_id, question_id) do update set text_ciphertext = excluded.text_ciphertext, answered_at = now()`,
        [a.id, id, encrypt(v)]);
      saved++;
    }
    await sql.query(`update assessments set last_activity_at = now() where id = $1`, [a.id]);
    return { ok: true as const, saved };
  });
}
