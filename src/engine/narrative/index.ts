/**
 * Results interpretation engine — "Here's what your answers reveal about the life you're living."
 *
 * Pipeline (brief §7):
 *  1. read versioned raw responses            → makeContext (approved question ids only)
 *  2. priorities, feelings, energy, links     → makeContext / rules
 *  3. approved metrics only                   → computeLifeMap (importance, support proxy, energy); F6 comparison
 *  4–6. patterns + supporting/counter evidence → buildObservations (rule library, each with source question ids)
 *  7. rank                                    → relevance (rule base × importance × evidence)
 *  8. select a coherent set                   → Allocation: opening synthesises, sections/cards deepen, Orbits detail
 *  9. conversational copy                     → templates with deterministic variation (same answers → same words)
 * 10–11. validate, remove unsupported/repeated → validate.ts
 * 12. save                                    → returned object is stored with the frozen result (server/assessments.ts)
 *
 * Deterministic: no network, no model calls, no randomness. Copy is DRAFT for Jana's approval.
 */
import type { LifeMapResult } from "@/engine/compute";
import { ORBIT_IDS } from "@/content/v10/chapters";
import type { OrbitId } from "@/content/types";
import { type Answers, makeContext } from "./context";
import { buildObservations } from "./rules";
import { Allocation, DEEP_DIVE_BRIDGE, MAP_INTRO_CONVERSATIONAL, buildTheme, centralThemeOf, composeCards, composeClosing, composeConnections, composeMapReading, composeOpening, composeOrbit, composeSelf, composeStandsOut, composeThemeOpening } from "./compose";
import { dedupeSentences, filterValid } from "./validate";
import type { ResultNarrative } from "./types";

export const NARRATIVE_TEMPLATE_VERSION = "result-narrative-7"; // 7 = "What you shared" uses question — answer (15 Oct); 6 = 2–3 sentence opening summary, theme in full in the overview card (15 Oct); 5 = distance reading leads with the Map's shape (15 Oct); 4 = distance from the Sun in the Map interpretation and Orbits (F4, 13 Oct)
export const INSIGHT_DISCLAIMER = "These are provisional interpretations based on your self-reported answers. They are invitations to reflect, not diagnoses or psychological assessments.";

export function generateNarrative(result: LifeMapResult, answers: Answers): ResultNarrative & { validationIssues: { observationId: string; reason: string }[]; removedRepeats: string[] } {
  const c = makeContext(result, answers);
  const { valid, issues } = filterValid(buildObservations(c));
  const A = new Allocation(valid);

  const theme = buildTheme(c, valid);
  let closingText = "";
  const opening = theme ? composeThemeOpening(c, A, theme, () => closingText) : { ...composeOpening(c, A), major: null };
  const closing = composeClosing(c, opening.lead, A);
  closingText = closing.text;
  if (opening.major) opening.major.question = closing.text;
  const mapReading = composeMapReading(c, A);
  const standsOut = composeStandsOut(c, A);
  const self = composeSelf(c, A);
  const connections = composeConnections(c, A);
  const cards = composeCards(c, A, () => closing.text, theme);
  const themeAreas = theme ? [theme.anchor, ...theme.lead.areas.filter((a) => a !== theme.anchor)].filter((a) => a !== "sun") as string[] : [];
  const orbits = (ORBIT_IDS as OrbitId[]).map((o) => composeOrbit(c, o, A, themeAreas));
  if (closing.observationId) A.ref(valid.filter((o) => o.id === closing.observationId), "closing");

  const { lead: _lead, ...openingSection } = opening;
  const n: ResultNarrative = {
    templateVersion: NARRATIVE_TEMPLATE_VERSION,
    versions: { scoring: result.versions.scoring, questionBank: result.versions.questionBank },
    opening: openingSection as ResultNarrative["opening"],
    centralTheme: centralThemeOf(c, theme),
    mapIntro: MAP_INTRO_CONVERSATIONAL,
    mapReading, standsOut, self, connections, cards, orbits,
    closingQuestion: closing,
    deepDiveBridge: DEEP_DIVE_BRIDGE,
    observations: valid.map((o) => ({ ...o, usedIn: A.usedIn(o.id) })),
    questionToTakeWithYou: { text: closing.text, theme: closing.theme },
  };
  const removedRepeats = dedupeSentences(n);
  return { ...n, validationIssues: issues, removedRepeats };
}

export { generateReflectionLayer, REFLECTION_LAYER_NOTE } from "./reflections";
export type * from "./types";
