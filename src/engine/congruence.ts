/**
 * F4 (congruence → distance) and F5 (attention tiers), per the F4/F5 Design Pack.
 * Option A (8 parallel congruence statements) approved by Jana, 12 Oct 2026.
 * Calculation, bands, Formula B and tiers are computed for the private Coach Report only, labelled provisional.
 * F4 rules approved 13 Oct 2026 (required congruence statement, 50/50 with supporting statements, three bands);
 * the question-level mapping below is still under review.
 * They reach the client's Map only when FEATURES flags are switched on after sign-off (see config/scoring.ts).
 */
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { computeLifeMap, itemEvidence, type Answers } from "@/engine/compute";

/**
 * Supporting statements per Orbit — PROPOSED, awaiting Jana's question-level review (doc "F4 Congruence — Question Mapping
 * for Review", 13 Oct). Each was checked word by word against the four approved criteria: living by personal values;
 * honoring one's own needs and priorities; authentic choices rather than outside expectations; agency.
 * Satisfaction, achievement, healthy habits, energy and wellbeing are never proxies. Mind has none: congruence statement only.
 * Nothing here reaches the client's Map while FEATURES.personalisedDistance is false.
 */
export const CONGRUENCE_ITEMS: Record<OrbitId, { id: string; strength: "direct" | "partial" }[]> = {
  mind: [],
  body: [{ id: "body.06", strength: "direct" }, { id: "body.04", strength: "partial" }],
  restoration: [{ id: "restoration.05", strength: "direct" }, { id: "restoration.06", strength: "partial" }],
  growth: [{ id: "growth.06", strength: "direct" }],
  love: [{ id: "love.01", strength: "direct" }, { id: "love.05", strength: "direct" }, { id: "love.02", strength: "partial" }],
  social: [{ id: "social.03", strength: "direct" }, { id: "social.04", strength: "partial" }],
  resources: [{ id: "resources.04", strength: "direct" }, { id: "resources.02", strength: "partial" }],
  joy: [{ id: "joy.05", strength: "direct" }, { id: "joy.02", strength: "partial" }],
};
export const CONGRUENCE_MAPPING_STATUS: "proposed" | "approved" = "proposed";
/** The parallel congruence statement per Orbit (Option A), in the question bank as `[orbit].congruence`. */
export const ANCHOR_ID = (o: OrbitId) => `${o}.congruence`;

export interface F4Config { anchorWeight: number; partialWeight: number; mixedGap: number; nearBoundary: number; close: number; far: number }
/** Approved 13 Oct: congruence statement 50% / supporting 50% (partial = half weight); three bands at 0.67 / 0.33. */
export const F4_DEFAULT: F4Config = { anchorWeight: 0.5, partialWeight: 0.5, mixedGap: 0.5, nearBoundary: 0.05, close: 0.67, far: 0.33 };

export type F4Band = "close" | "middle" | "far";
export interface F4Orbit {
  orbit: OrbitId;
  /** Score used for position (rounded to 2 decimals), or null when the congruence statement is missing. */
  congruence: number | null;
  /** The congruence statement alone, and the supporting statements' weighted mean (null when none answered). */
  direct: number | null;
  supporting: number | null;
  usedItems: string[];
  status: "sufficient" | "insufficient";
  band: F4Band | null;
  /** Direct and supporting answers differ by ≥ mixedGap — kept for interpretation, never hidden in the average. */
  mixed: boolean;
  /** Within `nearBoundary` of a threshold — Coach Report only, so nobody reads meaning into the difference. */
  nearBoundary: boolean;
  /** Back-compat for the Coach Report table. */
  evidenceUnits: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
export const bandOf = (c: number, cfg: F4Config = F4_DEFAULT): F4Band => (c >= cfg.close ? "close" : c <= cfg.far ? "far" : "middle");

/**
 * Approved rules (Jana, 13 Oct):
 *  - The congruence statement is required; a valid answer positions the Orbit provisionally on its own.
 *  - Supporting statements share the other 50% (partial = half weight). None answered or none approved → the
 *    congruence statement decides alone; no evidence is invented.
 *  - Missing answers are never imputed. N/A supporting answers are excluded and their share redistributed.
 *  - Strong disagreement between direct and supporting answers is flagged `mixed`.
 */
export function f4(answers: Answers, cfg: F4Config = F4_DEFAULT): F4Orbit[] {
  return ORBIT_IDS.map((orbit) => {
    const anchorRaw = answers[ANCHOR_ID(orbit)];
    const direct = typeof anchorRaw === "string" && /^[0-4]$/.test(anchorRaw) ? Number(anchorRaw) / 4 : null;
    let sum = 0, w = 0;
    const used: string[] = [];
    for (const it of CONGRUENCE_ITEMS[orbit]) {
      const k = itemEvidence(it.id, answers[it.id]).keyed;
      if (k === null) continue;
      const wt = it.strength === "direct" ? 1 : cfg.partialWeight;
      sum += k * wt; w += wt; used.push(it.id);
    }
    const supporting = w ? sum / w : null;
    if (direct === null) {
      return { orbit, congruence: null, direct: null, supporting: supporting === null ? null : r2(supporting), usedItems: used, status: "insufficient", band: null, mixed: false, nearBoundary: false, evidenceUnits: w };
    }
    const score = r2(supporting === null ? direct : cfg.anchorWeight * direct + (1 - cfg.anchorWeight) * supporting);
    const mixed = supporting !== null && Math.abs(direct - supporting) >= cfg.mixedGap - 1e-9;
    const nearBoundary = Math.abs(score - cfg.close) < cfg.nearBoundary || Math.abs(score - cfg.far) < cfg.nearBoundary;
    return { orbit, congruence: score, direct, supporting: supporting === null ? null : r2(supporting), usedItems: [ANCHOR_ID(orbit), ...used], status: "sufficient", band: bandOf(score, cfg), mixed, nearBoundary, evidenceUnits: 1 + w };
  });
}

/** Distance: three bands (not a continuous scale) to avoid false precision. Insufficient → neutral ring. */
export function f4Distance(o: Pick<F4Orbit, "band">, rMin = 128, rMax = 300) {
  const rNeutral = (rMin + rMax) / 2;
  if (o.band === null) return rNeutral;
  return o.band === "close" ? rMin + 0.15 * (rMax - rMin) : o.band === "middle" ? rNeutral : rMax - 0.15 * (rMax - rMin);
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

// ── F5 ──────────────────────────────────────────────────────────────────────
export interface F5Row {
  orbit: OrbitId; importance: number | null; supportGap: number | null; congruenceGap: number | null; leverage: number;
  modifiers: string[]; scoreA: number | null; scoreB: number | null; complete: boolean;
}

/**
 * Support gap uses only statements NOT used for congruence, so no answer is counted twice.
 * Leverage: 1 if chosen as positive-spillover Orbit (interconnections.03), else 0.
 * Modifiers (B only): +0.05 each for crowded out (04) and priority gap (05), capped so the score stays ≤ 1.
 * A = 0.35 I + 0.25 G + 0.20 K + 0.20 L (candidate from the Decision Guide).
 * B = I × (0.55 G + 0.45 K) × 0.8 + 0.2 L + modifiers   — importance gates the gaps (low-importance Orbits can't rank high on gaps alone).
 */
export function f5(answers: Answers) {
  const res = computeLifeMap(answers);
  const cong = Object.fromEntries(f4(answers).map((x) => [x.orbit, x]));
  const congIds = new Set(Object.values(CONGRUENCE_ITEMS).flat().map((x) => x.id));
  const pick = (id: string) => (typeof answers[id] === "string" ? (answers[id] as string) : null);
  const rows: F5Row[] = res.orbits.map((o) => {
    const support = o.items.filter((i) => !congIds.has(i.questionId) && i.keyed !== null).map((i) => i.keyed!);
    const enough = support.length >= 2; // 2, not 3: Love with both N/A keeps 2 eligible support items and must stay rankable
    const G = enough ? r4(1 - support.reduce((a, b) => a + b, 0) / support.length) : null;
    const K = cong[o.orbit].congruence === null ? null : r4(1 - cong[o.orbit].congruence!);
    const I = o.importanceDirect;
    const L = pick("interconnections.03") === o.orbit ? 1 : 0;
    const mods: string[] = [];
    if (pick("interconnections.04") === o.orbit) mods.push("crowded_out");
    if (pick("interconnections.05") === o.orbit) mods.push("priority_gap");
    const complete = I !== null && G !== null && K !== null;
    const scoreA = complete ? r4(0.35 * I! + 0.25 * G! + 0.2 * K! + 0.2 * L) : null;
    const scoreB = complete ? r4(Math.min(1, I! * (0.55 * G! + 0.45 * K!) * 0.8 + 0.2 * L + 0.05 * mods.length)) : null;
    return { orbit: o.orbit, importance: I, supportGap: G, congruenceGap: K, leverage: L, modifiers: mods, scoreA, scoreB, complete };
  });
  return { rows, tiersA: tiers(rows, "scoreA"), tiersB: tiers(rows, "scoreB") };
}

/** Tiering: Orbits within `tol` of the tier's top score share a tier — no false precision. Incomplete Orbits are not ranked. */
export function tiers(rows: F5Row[], key: "scoreA" | "scoreB", tol = 0.1): OrbitId[][] {
  const ranked = rows.filter((r) => r[key] !== null).sort((a, b) => b[key]! - a[key]! || ORBIT_IDS.indexOf(a.orbit) - ORBIT_IDS.indexOf(b.orbit));
  const out: OrbitId[][] = [];
  let top: number | null = null;
  for (const r of ranked) {
    if (top === null || top - r[key]! >= tol) { out.push([r.orbit]); top = r[key]!; } else out[out.length - 1].push(r.orbit);
  }
  return out;
}
