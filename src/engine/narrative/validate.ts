/**
 * Claim validation. Runs on every observation before selection and on the assembled narrative after it.
 * Observations that fail are removed (never "softened" silently); the reasons are kept for the backend record.
 */
import { questionById } from "@/content/v10/question-bank";
import type { Observation, ResultNarrative } from "./types";

/** Diagnostic labels, absolutes, imperatives and identity labels the results must never use. */
export const BANNED = /\b(diagnos\w*|disorder\w*|burn-?out|depress\w*|trauma\w*|anxiety disorder|self-sabotag\w*|people[- ]pleas\w*|low self-worth|narcissis\w*|codependen\w*|toxic|always|never|(?<!feel )you should|you must|(?<!feeling (?:that )?)you need to|obviously|clearly you)\b/i;
/** Causal verbs are only allowed when the person stated the influence themselves (Life Interconnections). */
export const CAUSAL = /\b(causes?|caused by|leads? to|results? in|is why|because of this)\b/i;
/** The model is the same for everyone and no gender data is collected (docs/07-inclusive-design.md). */
export const GENDERED = /\b(he|she|him|his|hers|husband|wife|boyfriend|girlfriend|woman|women|man|men|feminine|masculine|ladies|gentlemen)\b/i;

export interface ValidationIssue { observationId: string; reason: string }

export function validateObservation(o: Observation): string | null {
  if (!o.evidence.length) return "no supporting evidence";
  for (const e of o.evidence) {
    if (!questionById(e.questionId)) return `unknown question ${e.questionId}`;
    if (e.answer === "Not answered") return `evidence ${e.questionId} was not answered`;
  }
  const orbitsInvolved = new Set(o.areas);
  if (orbitsInvolved.size >= 2 && o.rule.startsWith("link.")) {
    const explicit = o.evidence.some((e) => e.questionId.startsWith("interconnections."));
    if (!explicit && new Set(o.evidence.map((e) => e.questionId)).size < 2) return "cross-Orbit claim with fewer than two responses";
  }
  if (o.link === "co-occurrence" && CAUSAL.test(o.text)) return "co-occurrence written as causation";
  if (o.sufficiency === "single" && o.wording === "suggest") return "single response worded as a pattern";
  if (BANNED.test(o.text) || (o.question && BANNED.test(o.question))) return "banned language";
  if (GENDERED.test(o.text) || (o.question && GENDERED.test(o.question))) return "gendered language";
  return null;
}

export function filterValid(os: Observation[]): { valid: Observation[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const valid = os.filter((o) => { const r = validateObservation(o); if (r) issues.push({ observationId: o.id, reason: r }); return !r; });
  return { valid, issues };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
export const sentences = (t: string) => t.split(/(?<=[.?!])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter(Boolean);

/** Every visible string in display order (used for repetition and language checks). */
export function visibleTexts(n: ResultNarrative): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const sec = (k: string, ps: { text: string }[]) => ps.forEach((p, i) => out.push({ where: `${k}.${i}`, text: p.text }));
  sec("opening", n.opening.paragraphs); sec("map", n.mapReading.paragraphs); sec("standsOut", n.standsOut.paragraphs);
  sec("self", n.self.paragraphs); sec("connections", n.connections.paragraphs);
  for (const c of n.cards) { out.push({ where: `${c.key}.lead`, text: c.lead }); c.sections.forEach((s, i) => out.push({ where: `${c.key}.${i}`, text: s.text })); }
  for (const o of n.orbits) o.paragraphs.forEach((p, i) => out.push({ where: `orbit.${o.orbit}.${i}`, text: p }));
  return out;
}

/** Removes a sentence that already appeared earlier on the page (exact, normalised). Returns what was removed. */
export function dedupeSentences(n: ResultNarrative): string[] {
  const seen = new Set<string>();
  const removed: string[] = [];
  const clean = (t: string) => sentences(t).filter((s) => {
    const k = norm(s);
    if (k.split(" ").length < 6) return true; // short connective sentences ("Both can be true.") may recur
    if (seen.has(k)) { removed.push(s); return false; }
    seen.add(k); return true;
  }).join(" ");
  for (const p of [...n.opening.paragraphs, ...n.mapReading.paragraphs, ...n.standsOut.paragraphs, ...n.self.paragraphs, ...n.connections.paragraphs]) p.text = clean(p.text);
  for (const c of n.cards) for (const s of c.sections) s.text = clean(s.text);
  // Orbit paragraphs share a deliberate structure (one per area), so they are not deduplicated against each other.
  return removed;
}
