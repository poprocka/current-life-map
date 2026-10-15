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
    return generateInterpretation(result, answers);
  } catch (err) {
    if (process.env.NODE_ENV === "test") throw err;
    return { ...generateNarrative(result, answers), fallback: true };
  }
}
