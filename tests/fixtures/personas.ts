/**
 * Fictional answer sets for the narrative engine: the three worked examples (deliverable 8) and the QA scenarios.
 * Truth answers default to "Mostly true" (neither high nor low); each persona overrides what makes it distinct.
 */
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import type { OrbitId } from "@/content/types";

export type Raw = Record<string, string | string[]>;
const O: OrbitId[] = ["mind", "body", "restoration", "growth", "love", "social", "resources", "joy"];

export interface PersonaSpec {
  importance?: Partial<Record<OrbitId, number>>;           // 0–4
  energy?: Partial<Record<OrbitId, number>>;               // +2 … −2
  orbitTruth?: Partial<Record<OrbitId | "sun", number>>;   // default value for an Orbit's statements (support-keyed)
  items?: Record<string, number | "na">;                   // raw truth answers by id (reverse-keyed items: raw agreement)
  feelings?: Partial<Record<OrbitId, string[]>>;           // option labels
  ic?: Partial<Record<"01" | "02" | "03" | "04" | "05" | "06", OrbitId>> & { "07"?: string };
}

export function persona(s: PersonaSpec): Raw {
  const a: Raw = {};
  for (const q of ACTIVE_QUESTIONS) {
    const ch = q.chapterId as OrbitId | "sun";
    if (q.responseType === "truth") {
      const base = q.measure === "congruence" ? 2 : s.orbitTruth?.[ch] ?? 2;
      a[q.id] = String(q.reverseKeyed ? 4 - base : base);
    } else if (q.responseType === "importance") a[q.id] = String(s.importance?.[ch as OrbitId] ?? 2);
    else if (q.responseType === "energy") a[q.id] = String(s.energy?.[ch as OrbitId] ?? 0);
    else if (q.responseType === "emotional_state") {
      const want = s.feelings?.[ch as OrbitId];
      const vals = want ? q.options.filter((o) => want.includes(o.label)).map((o) => o.value) : [q.options.find((o) => o.label === "Neutrality" || o.label === "Stability" || o.label === "Ease")?.value ?? q.options[5].value];
      a[q.id] = vals;
    }
  }
  for (const [id, v] of Object.entries(s.items ?? {})) a[id] = v === "na" ? NOT_APPLICABLE : String(v);
  const ic = s.ic ?? {};
  for (const k of ["01", "02", "03", "04", "05", "06"] as const) if (ic[k]) a[`interconnections.${k}`] = ic[k]!;
  a["interconnections.07"] = ic["07"] ?? "mix";
  for (const k of ["01", "02", "03", "04", "05", "06"] as const) if (!a[`interconnections.${k}`]) a[`interconnections.${k}`] = O[Number(k) - 1];
  return a;
}

/** Example 1 — ambitious season, restoration giving way; clarity without gentleness. */
export const EXAMPLE_AMBITION = persona({
  importance: { growth: 4, social: 4, restoration: 3, body: 3, mind: 3, joy: 2, love: 1, resources: 2 },
  energy: { social: -1, growth: 1, restoration: -1, joy: 2, mind: -1, body: 0 },
  orbitTruth: { growth: 3, social: 3, restoration: 1, joy: 2 },
  items: { "restoration.02": 4, "restoration.06": 1, "joy.02": 2, "sun.02": 4, "sun.03": 1, "sun.11": 3, "sun.04": 3, "growth.06": 1, "growth.congruence": 3, "social.congruence": 3, "body.01": 2 },
  feelings: { growth: ["Hope", "Overwhelm"], restoration: ["Guilt", "Exhaustion", "Rush"], social: ["Recognition", "Pressure"], joy: ["Aliveness", "Delight"], mind: ["Clarity", "Busyness"] },
  ic: { "01": "social", "02": "joy", "03": "restoration", "04": "restoration", "05": "body", "06": "social", "07": "somewhat_compete" },
});

/** Example 2 — a life largely working; one Orbit asks a lot and gives a lot; Love questions marked not applicable. */
export const EXAMPLE_WORKING = persona({
  importance: { growth: 4, mind: 3, body: 3, social: 3, restoration: 3, joy: 1, love: 1, resources: 2 },
  energy: { growth: 2, mind: 1, body: 1, joy: 1, social: 0, restoration: 1, resources: 0, love: 0 },
  orbitTruth: { mind: 3, body: 3, restoration: 3, growth: 3, social: 3, resources: 3, joy: 3, love: 3, sun: 3 },
  items: { "love.02": "na", "love.03": "na", "body.01": 4, "mind.04": 4, "growth.congruence": 4, "mind.congruence": 3, "sun.08": 1, "sun.04": 4 },
  feelings: { growth: ["Momentum", "Stretch"], joy: ["Peace", "Delight"], restoration: ["Calm", "Replenishment"] },
  ic: { "01": "growth", "02": "growth", "03": "mind", "04": "joy", "05": "joy", "06": "resources", "07": "mostly_support" },
});
// A well-supported Map has no named gap or trade-off: undo the defaulted selections.
delete EXAMPLE_WORKING["interconnections.04"]; delete EXAMPLE_WORKING["interconnections.05"];

/** Example 3 — several areas under strain at once; change feels uncertain; others' expectations. */
export const EXAMPLE_STRAIN = persona({
  importance: { resources: 4, social: 3, body: 3, mind: 3, restoration: 2, growth: 2, joy: 2, love: 2 },
  energy: { resources: -2, social: -1, body: -1, mind: -1, restoration: 0, growth: 0, joy: 1, love: 0 },
  orbitTruth: { resources: 1, social: 1, body: 1, mind: 1, restoration: 1, joy: 2, growth: 2, love: 2, sun: 2 },
  items: { "resources.05": 4, "growth.06": 4, "mind.05": 4, "body.01": 0, "restoration.06": 0, "joy.02": 0, "social.congruence": 0, "sun.01": 4, "sun.06": 0, "resources.congruence": 1 },
  feelings: { resources: ["Pressure", "Fear", "Constraint"], social: ["Drain", "Pressure"], mind: ["Rumination", "Fatigue"], joy: ["Peace"] },
  ic: { "01": "resources", "02": "joy", "03": "resources", "04": "body", "05": "joy", "06": "social", "07": "strongly_compete" },
});
