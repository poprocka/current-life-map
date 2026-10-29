/**
 * Respondent-facing interpretation — compatibility entry point.
 * The engine now lives in src/engine/narrative (evidence-led narrative, Oct 13 brief). This file keeps the
 * earlier import paths working for the results page, the PDF, the email and the coach workspace.
 */
import type { LifeMapResult } from "@/engine/compute";
import { generateNarrative } from "@/engine/narrative";
import type { Answers } from "@/engine/narrative/context";
import type { ResultNarrative } from "@/engine/narrative/types";
import { generateInterpretation, INTERPRET_VERSION, type Interpretation } from "@/engine/interpret";
import { SUPPORT_COMPETE_READING } from "@/content/v10/scales";

export { F6_TOLERANCE, toYou } from "@/engine/narrative/context";
export { INSIGHT_DISCLAIMER, NARRATIVE_TEMPLATE_VERSION as INSIGHTS_TEMPLATE_VERSION, generateReflectionLayer } from "@/engine/narrative";
export type { InsightCard, InsightSection, OrbitNarrative, ResultNarrative, ReflectionLayer } from "@/engine/narrative/types";
export type NarrativeEngine = typeof INTERPRET_VERSION | "legacy";
export type ResultInsights = ResultNarrative & Partial<Pick<Interpretation, "engine" | "records" | "validation" | "mode">> & { fallback?: boolean; validationIssues?: { observationId: string; reason: string }[] };

/** Which engine wrote a stored result: results stored before 15 Oct carry the legacy template versions. */
export const engineForTemplate = (templateVersion: string | null | undefined): NarrativeEngine =>
  !templateVersion || templateVersion.startsWith("interpret") ? INTERPRET_VERSION : "legacy";

/**
 * The public interpretation. Default: the deterministic interpretation engine "interpret-1" (approved 15 Oct). Historical
 * results are re-rendered with the engine that first wrote them (pass `engine`). If the new engine ever throws, the
 * previous engine writes the narrative instead and the result is marked as a fallback — a respondent never loses a result.
 */
export function generateResultInsights(result: LifeMapResult, answers: Answers, opts: { engine?: NarrativeEngine } = {}): ResultInsights {
  if (opts.engine === "legacy") return generateNarrative(result, answers);
  try {
    return fillEmptySections(generateInterpretation(result, answers), result, answers);
  } catch (err) {
    if (process.env.NODE_ENV === "test") throw err;
    return { ...generateNarrative(result, answers), fallback: true };
  }
}

/**
 * Never leave a section without text (Jana, 28 Oct: some respondents received an empty "The Sun" section). The
 * interpretation gives each reading exactly one home, so when the Sun's reading is used elsewhere (e.g. as the central
 * thread) "The Sun" could end up empty, and "Life Interconnections" likewise. Fallbacks:
 *  - The Sun: the previous engine's Sun reading and question (written from the Sun answers only).
 *  - Life Interconnections: the person's own answer on whether their areas help or compete (always answered).
 */
/** Sentences already on the page (opening, cards, connections, What stands out, Orbits). */
function pageSentences(ins: ResultInsights): Set<string> {
  const all = [
    ...ins.opening.paragraphs.map((p) => p.text), ...ins.standsOut.paragraphs.map((p) => p.text), ...ins.connections.paragraphs.map((p) => p.text),
    ...ins.mapReading.paragraphs.map((p) => p.text), ...ins.cards.flatMap((c) => [c.lead, ...c.sections.flatMap((x) => [x.text, x.meaning ?? ""])]),
    ...ins.orbits.flatMap((o) => o.paragraphs),
  ];
  return new Set(all.flatMap(sentences));
}
const sentences = (t: string) => t.split(/(?<=[.?!])\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
/** Drops sentences the page already says; a paragraph left with nothing is dropped. */
function withoutRepeats<P extends { text: string }>(paras: P[], ins: ResultInsights): P[] {
  const seen = pageSentences(ins);
  return paras.map((p) => ({ ...p, text: p.text.split(/(?<=[.?!])\s+/).filter((x) => !seen.has(x.trim().toLowerCase())).join(" ").trim() })).filter((p) => p.text);
}
const ORBIT_NAMES = /\b(Mind|Body|Restoration|Growth|Love|Social World|Resources|Joy)\b/;
function fillEmptySections(ins: ResultInsights, result: LifeMapResult, answers: Answers): ResultInsights {
  let out = ins;
  if (!ins.self.paragraphs.length) {
    const legacy = generateNarrative(result, answers).self;
    // Only what is about the relationship with yourself: links to other Orbits are already told under Life Interconnections
    const own = legacy.paragraphs.filter((p) => !ORBIT_NAMES.test(p.text));
    // …and never a sentence the page already says elsewhere (Jana, 28 Oct: summarise, don't repeat)
    const fresh = withoutRepeats(own.length ? own : legacy.paragraphs, ins);
    const paragraphs = fresh.length ? fresh : own.length ? own : legacy.paragraphs;
    if (paragraphs.length) out = { ...out, self: { ...legacy, paragraphs, title: ins.self.title, question: legacy.question ?? ins.self.question } };
  }
  if (!ins.connections.paragraphs.length) {
    const v = answers["interconnections.07"];
    const text = typeof v === "string" ? SUPPORT_COMPETE_READING[v] : undefined;
    if (text) out = { ...out, connections: { ...ins.connections, paragraphs: [{ text, observationIds: [], evidence: [] }], fallback: true } };
  }
  return out;
}
