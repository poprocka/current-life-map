/** Generates the computed tables for docs/08-f4-f5-design-pack.md. Run: npx tsx scripts/f4f5-pack.ts */
import fs from "fs";
import { ACTIVE_QUESTIONS } from "../src/content/v10/question-bank";
import { NOT_APPLICABLE } from "../src/content/types";
import { ORBIT_IDS } from "../src/content/v10/chapters";
import { computeLifeMap } from "../src/engine/compute";
import { f4, f5, tiers, f4Distance, type F5Row } from "../src/engine/proposals/f4f5";

type A = Record<string, string | string[]>;
const base = (): A => {
  const a: A = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "truth") a[q.id] = q.reverseKeyed ? "2" : "2";
    else if (q.responseType === "importance") a[q.id] = "2";
    else if (q.responseType === "energy") a[q.id] = "0";
    else if (q.responseType === "emotional_state") a[q.id] = [q.options[5].value];
  }
  Object.assign(a, { "interconnections.01": "social", "interconnections.02": "body", "interconnections.07": "mix" });
  return a;
};
const set = (a: A, o: Record<string, string | string[]>) => Object.assign(a, o);
const orbitTruth = (a: A, orbit: string, pos: string, neg = pos) => {
  for (const q of ACTIVE_QUESTIONS) if (q.chapterId === orbit && q.responseType === "truth") a[q.id] = q.reverseKeyed ? neg : pos;
};

// P1 — highly aligned but low importance (Joy)
const p1 = base();
orbitTruth(p1, "joy", "4"); set(p1, { "joy.importance": "0", "joy.energy": "2", "interconnections.02": "joy",
  "interconnections.03": "body", "interconnections.04": "joy", "body.importance": "4" });
orbitTruth(p1, "body", "1", "3");

// P2 — high importance, mixed / draining energy (Growth) — the guide's worked example
const p2 = base();
set(p2, { "growth.importance": "4", "growth.energy": "-1", "interconnections.03": "growth", "interconnections.05": "growth", "interconnections.06": "growth",
  "growth.01": "3", "growth.02": "3", "growth.03": "3", "growth.04": "1", "growth.05": "1", "growth.06": "4",
  "growth.emotion": ["hope", "overwhelm"], "social.importance": "4", "social.energy": "-2", "social.04": "0", "social.05": "3" });

// P3 — multiple N/A (Love) and tied Orbits (uniform answers)
const p3 = base();
set(p3, { "love.02": NOT_APPLICABLE, "love.03": NOT_APPLICABLE, "interconnections.01": "resources", "interconnections.02": "resources" });

const withAnchors = (a: A, over: Record<string, string> = {}) => {
  const b: A = { ...a };
  for (const o of ORBIT_IDS) b[`${o}.congruence`] = over[o] ?? "2";
  return b;
};
const VARIANT = process.argv[2] === "anchors" ? "anchors" : "existing";
const P = VARIANT === "anchors"
  ? [withAnchors(p1, { joy: "4", body: "1" }), withAnchors(p2, { growth: "1", social: "1" }), withAnchors(p3)]
  : [p1, p2, p3];
const profiles = [["P1 · Aligned, low importance (Joy)", P[0]], ["P2 · High importance, draining (Growth)", P[1]], ["P3 · Love N/A + ties", P[2]]] as const;

let md = "";
const f = (n: number | null) => (n === null ? "—" : n.toFixed(2));
for (const [name, a] of profiles) {
  const r = computeLifeMap(a), c = f4(a), p = f5(a);
  md += `\n### ${name}\n\n| Orbit | Importance | Energy | Support idx (current) | Congruence (F4) | Evidence units | Band | Distance | Support gap G | Congruence gap K | Leverage | Modifiers | Score A | Score B |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const o of r.orbits) {
    const ci = c.find((x) => x.orbit === o.orbit)!, pr = p.rows.find((x) => x.orbit === o.orbit)!;
    md += `| ${o.name} | ${f(o.importanceDirect)} | ${o.energyRaw ?? "—"} | ${f(o.responseSupportIndex)} | ${f(ci.congruence)} | ${ci.evidenceUnits} | ${ci.band ?? "neutral"} | ${Math.round(f4Distance(ci))} | ${f(pr.supportGap)} | ${f(pr.congruenceGap)} | ${pr.leverage} | ${pr.modifiers.join(", ") || "—"} | ${f(pr.scoreA)} | ${f(pr.scoreB)} |\n`;
  }
  const nm = (ids: string[]) => ids.map((id) => r.orbits.find((o) => o.orbit === id)!.name).join(" = ");
  md += `\nTiers A: ${p.tiersA.map(nm).join("  ›  ")}\n\nTiers B: ${p.tiersB.map(nm).join("  ›  ")}\n`;
}

// Sensitivity: change one answer by one step, measure tier movement of each Orbit (B and A)
const tierIndex = (t: string[][], o: string) => t.findIndex((x) => x.includes(o));
md += `\n### Sensitivity — one answer moved by one step\n\n| Profile | Formula | Single-answer changes tested | Max tier move for any Orbit | Changes that move the top tier |\n|---|---|---|---|---|\n`;
for (const [name, a] of profiles) for (const key of ["scoreA", "scoreB"] as const) {
  const t0 = tiers(f5(a).rows, key); let n = 0, maxMove = 0, topMoves = 0;
  for (const q of ACTIVE_QUESTIONS) {
    if (!["truth", "importance", "energy"].includes(q.responseType)) continue;
    const v = a[q.id]; if (typeof v !== "string" || v === NOT_APPLICABLE) continue;
    const vals = q.options.map((o) => o.value); const i = vals.indexOf(v);
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= vals.length) continue; n++;
      const b = { ...a, [q.id]: vals[j] }; const t1 = tiers(f5(b).rows, key);
      for (const o of ORBIT_IDS) { const d = Math.abs(tierIndex(t1, o) - tierIndex(t0, o)); if (tierIndex(t0, o) >= 0 && tierIndex(t1, o) >= 0) maxMove = Math.max(maxMove, d); }
      if (JSON.stringify(t1[0]?.slice().sort()) !== JSON.stringify(t0[0]?.slice().sort())) topMoves++;
    }
  }
  md += `| ${name.split(" ·")[0]} | ${key === "scoreA" ? "A" : "B"} | ${n} | ${maxMove} | ${topMoves} (${((topMoves / n) * 100).toFixed(0)}%) |\n`;
}

// Love N/A penalty check: same answers on the 4 other items; N/A vs answered at the person's own average
const la = VARIANT === "anchors" ? withAnchors(base()) : base(), ln = VARIANT === "anchors" ? withAnchors(base()) : base(); set(ln, { "love.02": NOT_APPLICABLE, "love.03": NOT_APPLICABLE });
const L = (a: A) => { const r = computeLifeMap(a).orbits.find((o) => o.orbit === "love")!; const c = f4(a).find((x) => x.orbit === "love")!; const p = f5(a).rows.find((x) => x.orbit === "love")!; return [r.responseSupportIndex, c.congruence, p.supportGap, p.scoreA, p.scoreB]; };
md += `\n### Love N/A check\n\n| | Support idx | Congruence | Support gap | Score A | Score B |\n|---|---|---|---|---|---|\n| Love answered (all "Mostly true") | ${L(la).map(f).join(" | ")} |\n| Love with both N/A | ${L(ln).map(f).join(" | ")} |\n`;

// Low-importance Joy deficient? Joy importance 0, everything low
const j = VARIANT === "anchors" ? withAnchors(base(), { joy: "0" }) : base(); orbitTruth(j, "joy", "0", "4"); set(j, { "joy.importance": "0", "joy.energy": "-2" });
const jr = f5(j); const jrow = jr.rows.find((x) => x.orbit === "joy")!;
md += `\n### Low-importance Joy with low answers\n\nJoy: importance 0, G ${f(jrow.supportGap)}, K ${f(jrow.congruenceGap)} → Score A ${f(jrow.scoreA)} (tier ${tierIndex(jr.tiersA, "joy") + 1} of ${jr.tiersA.length}), Score B ${f(jrow.scoreB)} (tier ${tierIndex(jr.tiersB, "joy") + 1} of ${jr.tiersB.length}).\n`;

// Social World: career vs community evidence
md += `\n### Social World evidence balance\n\nCongruence items: social.03 (both), social.04 (career), social.05 (community). Support-gap items after removing those: social.01, social.02, social.06, social.07 — all community. Career currently enters only through congruence.\n`;
fs.writeFileSync(`docs/f4f5-computed-${VARIANT}.md`, md);
console.log(md);
