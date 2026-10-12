/**
 * F4 (congruence → distance) and F5 (attention ranking) — PROPOSAL PROTOTYPE, NOT LIVE.
 * Nothing in the app imports this file. It exists so the design pack's numbers are computed, testable and reproducible.
 * See docs/08-f4-f5-design-pack.md.
 */
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { computeLifeMap, itemEvidence, type Answers } from "@/engine/compute";

/** Items whose wording directly references acting from one's own values/needs/self (vs. pressure, approval, fear, habit). */
export const CONGRUENCE_ITEMS: Record<OrbitId, { id: string; strength: "direct" | "partial" }[]> = {
  mind: [{ id: "mind.03", strength: "direct" }, { id: "mind.07", strength: "partial" }],
  body: [{ id: "body.06", strength: "direct" }],
  restoration: [{ id: "restoration.05", strength: "direct" }, { id: "restoration.06", strength: "partial" }],
  growth: [{ id: "growth.05", strength: "direct" }, { id: "growth.06", strength: "direct" }],
  love: [{ id: "love.01", strength: "direct" }, { id: "love.05", strength: "direct" }],
  social: [{ id: "social.03", strength: "direct" }, { id: "social.04", strength: "direct" }, { id: "social.05", strength: "direct" }],
  resources: [{ id: "resources.02", strength: "direct" }, { id: "resources.05", strength: "partial" }],
  joy: [{ id: "joy.05", strength: "direct" }, { id: "joy.02", strength: "partial" }],
};
/** Proposed new parallel item per Orbit (Option A). Ids reserved; not in the question bank. */
export const ANCHOR_ID = (o: OrbitId) => `${o}.congruence`;

export interface F4Config { anchorWeight: number; partialWeight: number; minDirectEvidence: number; tolerance: number }
export const F4_DEFAULT: F4Config = { anchorWeight: 0.5, partialWeight: 0.5, minDirectEvidence: 2, tolerance: 0.1 };

export interface F4Orbit { orbit: OrbitId; congruence: number | null; evidenceUnits: number; usedItems: string[]; status: "sufficient" | "insufficient"; band: "close" | "middle" | "far" | null }

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Congruence (0–1): weighted mean of keyed congruence items (partial items count half);
 * if an anchor answer exists it supplies `anchorWeight` of the score. Sufficient when evidence units ≥ minDirectEvidence
 * (anchor = 1 unit, direct item = 1, partial = 0.5). N/A items are excluded, never imputed.
 */
export function f4(answers: Answers, cfg: F4Config = F4_DEFAULT): F4Orbit[] {
  return ORBIT_IDS.map((orbit) => {
    let sum = 0, w = 0, units = 0;
    const used: string[] = [];
    for (const it of CONGRUENCE_ITEMS[orbit]) {
      const k = itemEvidence(it.id, answers[it.id]).keyed;
      if (k === null) continue;
      const wt = it.strength === "direct" ? 1 : cfg.partialWeight;
      sum += k * wt; w += wt; units += wt; used.push(it.id);
    }
    const itemsScore = w ? sum / w : null;
    const anchorRaw = answers[ANCHOR_ID(orbit)];
    const anchor = typeof anchorRaw === "string" && /^[0-4]$/.test(anchorRaw) ? Number(anchorRaw) / 4 : null;
    if (anchor !== null) { units += 1; used.push(ANCHOR_ID(orbit)); }
    const score = anchor !== null && itemsScore !== null ? cfg.anchorWeight * anchor + (1 - cfg.anchorWeight) * itemsScore : anchor ?? itemsScore;
    const ok = score !== null && units >= cfg.minDirectEvidence;
    const c = ok ? r4(score!) : null;
    return { orbit, congruence: c, evidenceUnits: units, usedItems: used, status: ok ? "sufficient" : "insufficient", band: c === null ? null : c >= 0.67 ? "close" : c > 0.33 ? "middle" : "far" };
  });
}

/** Distance: three bands (not a continuous scale) to avoid false precision. Insufficient → neutral ring. */
export function f4Distance(o: F4Orbit, rMin = 128, rMax = 300) {
  const rNeutral = (rMin + rMax) / 2;
  if (o.band === null) return rNeutral;
  return o.band === "close" ? rMin + 0.15 * (rMax - rMin) : o.band === "middle" ? rNeutral : rMax - 0.15 * (rMax - rMin);
}

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
