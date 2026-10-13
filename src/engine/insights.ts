/**
 * Respondent-facing interpretation — compatibility entry point.
 * The engine now lives in src/engine/narrative (evidence-led narrative, Oct 13 brief). This file keeps the
 * earlier import paths working for the results page, the PDF, the email and the coach workspace.
 */
import type { LifeMapResult } from "@/engine/compute";
import { generateNarrative } from "@/engine/narrative";
import type { Answers } from "@/engine/narrative/context";

export { F6_TOLERANCE, toYou } from "@/engine/narrative/context";
export { INSIGHT_DISCLAIMER, NARRATIVE_TEMPLATE_VERSION as INSIGHTS_TEMPLATE_VERSION, generateReflectionLayer } from "@/engine/narrative";
export type { InsightCard, InsightSection, OrbitNarrative, ResultNarrative, ReflectionLayer } from "@/engine/narrative/types";
export type ResultInsights = ReturnType<typeof generateNarrative>;

export function generateResultInsights(result: LifeMapResult, answers: Answers): ResultInsights {
  return generateNarrative(result, answers);
}
