/**
 * Optional post-results reflections (§5).
 *
 * The first narrative is generated from the completed Self-Interview and is never rewritten. When the person
 * later writes reflections, this adds a separate, clearly labelled layer: their words, verbatim, and — only where
 * a reflection question shares its subject with one of their own earlier choices — a gentle pointer to read the
 * two side by side. Free text is never interpreted, scored, or treated as proof of a pattern, and it never
 * changes the Map, the Orbit order or any score.
 */
import type { LifeMapResult } from "@/engine/compute";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { NAMES } from "./context";
import type { ReflectionLayer } from "./types";

export const REFLECTION_LAYER_NOTE =
  "Added after your results. These are your own words. Your original Map and interpretation above are unchanged.";

export function generateReflectionLayer(result: LifeMapResult, reflections: Record<string, string | undefined>): ReflectionLayer | null {
  const ic = result.interconnections;
  const items = POST_MAP_REFLECTIONS.questions
    .map((q) => ({ q, text: (reflections[q.id] ?? "").trim() }))
    .filter((x) => x.text)
    .map(({ q, text }) => {
      let alongside: ReflectionLayer["items"][number]["alongside"];
      if (q.id === "postmap.02" && ic.externalInfluence)
        alongside = { text: `Earlier, you named ${NAMES[ic.externalInfluence]} as the area most influenced by other people's expectations. You may want to read what you wrote here alongside that.`, evidence: [{ questionId: "interconnections.06", answer: NAMES[ic.externalInfluence] }] };
      else if (q.id === "postmap.04" && ic.priorityGap)
        alongside = { text: `Earlier, you named ${NAMES[ic.priorityGap]} as something that matters to you but gets less of your time and energy than you would like. What you wrote here may add to that.`, evidence: [{ questionId: "interconnections.05", answer: NAMES[ic.priorityGap] }] };
      return { questionId: q.id, prompt: q.prompt, text, ...(alongside ? { alongside } : {}) };
    });
  return items.length ? { note: REFLECTION_LAYER_NOTE, items } : null;
}
