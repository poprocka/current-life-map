/** The text content of the client PDF, derived only from the frozen result (mirrors the results page). */
import type { LifeMapResult } from "@/engine/compute";
import type { OrbitId } from "@/content/types";

export const IMPORTANCE_SHORT = ["Not important right now", "Slight", "Moderate", "Very important", "Highest priority"];
export const ENERGY_SHORT: Record<number, string> = { 1: "Gives a lot", 2: "Gives more than it takes", 3: "Stable", 4: "Takes more than it gives", 5: "Drains a lot" };
export const MAP_INTRO =
  "This Map represents the reality you described: what matters most in this season, what feels supported and alive, what is taking or giving energy, how connected each area feels to you, and where the parts of your life appear to influence one another.";

export function energyInsightsOf(result: LifeMapResult) {
  const inStory = new Set([
    ...result.insights.filter((i) => i.templateId !== "feelings_selected").flatMap((i) => i.orbits),
    ...[result.interconnections.largestDemand, result.interconnections.largestSource].filter(Boolean),
  ]);
  return result.insights.filter(
    (i) => i.templateId !== "system_support" && (i.templateId !== "feelings_selected" || i.orbits.some((o) => inStory.has(o))),
  );
}

export function reportModel(result: LifeMapResult) {
  const name = (id: OrbitId) => result.orbits.find((o) => o.orbit === id)!.name;
  const giving = result.orbits.filter((o) => (o.energySigned ?? 0) > 0).map((o) => o.name);
  const taking = result.orbits.filter((o) => (o.energySigned ?? 0) < 0).map((o) => o.name);
  return {
    intro: MAP_INTRO,
    legend: [
      "Size - How important this Orbit is to you at this stage of your life.",
      "Brightness - How supported and fulfilling this Orbit feels in your current life, based on your answers.",
      `Distance from the Sun - How closely the way you live in this Orbit reflects what genuinely matters to you.${result.orbits.every((o) => o.distanceBand == null) ? " Not shown on this Map: every Orbit sits at the same distance." : ""}`,
    ],
    table: result.orbits.map((o) => ({
      orbit: o.orbit, name: o.name,
      importance: o.importanceOrdinal === null ? "-" : IMPORTANCE_SHORT[o.importanceOrdinal - 1],
      energy: o.energyRaw === null ? "-" : ENERGY_SHORT[o.energyRaw],
      feelings: o.emotions.length ? o.emotions.map((e) => e.label).join(", ") : "-",
    })),
    snapshot: result.snapshot.filter((s) => s.available).map((s) => ({ label: s.label, orbits: s.orbits.map(name).join(", "), body: s.body })),
    reported: [
      `Gives you energy: ${giving.length ? giving.join(", ") : "none of the eight areas"}`,
      `Takes energy: ${taking.length ? taking.join(", ") : "none of the eight areas"}`,
      ...(result.interconnections.overallSupport ? [`How the areas relate: ${result.interconnections.overallSupport.label}`] : []),
    ],
    suggests: energyInsightsOf(result).map((i) => i.body),
    attention: result.attention.candidates.map((c) => ({ name: c.name, reasons: c.reasons.map((r) => r.body) })),
    caveats: [
      "This Map reflects your own answers at the time you completed the self-interview. It is a reflection to explore, not a diagnosis or an assessment of you as a person.",
      ...(result.scoringStatus !== "approved" ? ["The scoring method is under review (preview). Brightness uses your answers to each area's statements; distance is not personalised yet."] : []),
      "Questions answered 'Not applicable to my current life' are left out of the calculations.",
    ],
  };
}
