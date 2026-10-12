/**
 * Private Coach Report (addendum §3C). Deterministic, evidence-linked, versioned.
 * Restates what the respondent said, names derived values with their formulas, and keeps every
 * interpretation explicitly marked as a hypothesis to validate. No clinical language, no invented background.
 */
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { PROVISIONAL_1 } from "@/engine/config/scoring";
import { QUESTION_BANK } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { type Answers, type CoachItem, answerLabel, direct, pct, quote } from "./shared";
import { f4, f5 } from "@/engine/congruence";
import { generateCoachIntelligence, type CoachIntelligence } from "./intelligence";

export const COACH_REPORT_TEMPLATE_VERSION = "coach-report-1";

export interface CoachReport {
  templateVersion: string;
  versions: LifeMapResult["versions"];
  scoringStatus: LifeMapResult["scoringStatus"];
  sections: { key: string; title: string; note?: string; items: CoachItem[] }[];
  hypotheses: (CoachItem & { questionToValidate: string })[];
  provenance: {
    orbit: string; name: string; importanceDirect: number | null; energyRaw: number | null; energySigned: number | null;
    responseSupportIndex: number | null; coverage: string; confidence: string; statuses: OrbitResult["metricStatuses"];
  }[];
  formulas: string[];
  openFlags: { id: string; item: string }[];
  /** Human-first Coach Intelligence Report (sections A–H, readiness, opportunity). */
  intelligence?: CoachIntelligence;
  /** F4/F5 per the Design Pack — coach-only, awaiting sign-off, never shown to the client while FEATURES are off. */
  provisional?: {
    congruence: { orbit: string; name: string; value: number | null; band: string | null; items: string[]; evidenceUnits: number }[];
    tiers: { orbit: string; name: string; tier: number | null; importance: number | null; supportGap: number | null; congruenceGap: number | null; leverage: number; modifiers: string[]; score: number | null }[];
  };
}

const T = PROVISIONAL_1.thresholds;
const derivedRef = (o: OrbitResult) => ({ questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex), kind: "derived" as const });
const TENSION = "A possible tension, not a conclusion. Context the questions didn’t capture may explain it.";

export function generateCoachReport(result: LifeMapResult, answers: Answers): CoachReport {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o])) as Record<string, OrbitResult>;
  const sufficient = (o: OrbitResult) => o.supportConfidence === "sufficient" && o.responseSupportIndex !== null;
  const ic = result.interconnections;

  // Strengths
  const strengths: CoachItem[] = [];
  for (const o of result.orbits) {
    if (sufficient(o) && o.responseSupportIndex! >= T.highSupport)
      strengths.push({ id: `strength.support.${o.orbit}`, basis: "derived", evidence: [derivedRef(o)],
        text: `${o.name}: statements describe strong support (index ${pct(o.responseSupportIndex)}, ${o.coverage.valid}/${o.coverage.eligible} answered).`,
        uncertainty: "Proxy index from unweighted statements; thresholds provisional (F6)." });
    if (o.energyRaw !== null && o.energyRaw <= 2)
      strengths.push({ id: `strength.energy.${o.orbit}`, basis: "direct", evidence: [direct(`${o.orbit}.energy`, answers)],
        text: `${o.name} gives energy: ${answerLabel(`${o.orbit}.energy`, answers[`${o.orbit}.energy`])}.` });
  }
  for (const i of result.sun.items)
    if (i.keyed !== null && i.keyed >= 0.75)
      strengths.push({ id: `strength.sun.${i.questionId}`, basis: "direct", evidence: [direct(i.questionId, answers)], text: `Sun: ${quote(i.questionId, answers)}` });
  if (ic.largestSource)
    strengths.push({ id: "strength.source", basis: "direct", evidence: [direct("interconnections.02", answers)], text: `Named ${by[ic.largestSource].name} as the greatest source of energy.` });

  // Friction
  const friction: CoachItem[] = [];
  for (const o of result.orbits) {
    if ((o.importanceDirect ?? 0) >= T.highImportance && (o.energyRaw ?? 0) >= 4)
      friction.push({ id: `friction.important_drain.${o.orbit}`, basis: "direct", evidence: [direct(`${o.orbit}.importance`, answers), direct(`${o.orbit}.energy`, answers)],
        text: `${o.name}: ${answerLabel(`${o.orbit}.importance`, answers[`${o.orbit}.importance`])}, and ${answerLabel(`${o.orbit}.energy`, answers[`${o.orbit}.energy`]).toLowerCase()}.` });
    if (sufficient(o) && o.responseSupportIndex! <= T.lowSupport)
      friction.push({ id: `friction.low_support.${o.orbit}`, basis: "derived", evidence: [derivedRef(o)],
        text: `${o.name}: statements describe little support (index ${pct(o.responseSupportIndex)}).`, uncertainty: "Proxy index; thresholds provisional (F6)." });
    for (const i of o.items)
      if (i.reverseKeyed && i.keyed !== null && i.keyed <= 0.25)
        friction.push({ id: `friction.reverse.${i.questionId}`, basis: "direct", evidence: [direct(i.questionId, answers)], text: `${o.name}: ${quote(i.questionId, answers)}` });
  }
  for (const i of result.sun.items)
    if (i.keyed !== null && i.keyed <= 0.25)
      friction.push({ id: `friction.sun.${i.questionId}`, basis: "direct", evidence: [direct(i.questionId, answers)], text: `Sun: ${quote(i.questionId, answers)}` });
  if (ic.crowdedOut) friction.push({ id: "friction.crowded", basis: "direct", evidence: [direct("interconnections.04", answers)], text: `Reports ${by[ic.crowdedOut].name} receiving less care because other demands take space.` });
  if (ic.priorityGap) friction.push({ id: "friction.gap", basis: "direct", evidence: [direct("interconnections.05", answers)], text: `Notices a gap: ${by[ic.priorityGap].name} matters but gets less time and energy than wished.` });
  if (ic.externalInfluence) friction.push({ id: "friction.external", basis: "direct", evidence: [direct("interconnections.06", answers)], text: `${by[ic.externalInfluence].name} is most shaped by other people’s expectations.` });

  // Contradictions (possible tensions)
  const tensions: CoachItem[] = [];
  if (ic.largestSource && (by[ic.largestSource].energyRaw ?? 0) >= 4)
    tensions.push({ id: "tension.source_drains", basis: "hypothesis", uncertainty: TENSION,
      evidence: [direct("interconnections.02", answers), direct(`${ic.largestSource}.energy`, answers)],
      text: `${by[ic.largestSource].name} was named the greatest energy source, yet rated “${answerLabel(`${ic.largestSource}.energy`, answers[`${ic.largestSource}.energy`])}”.` });
  if (ic.priorityGap && (by[ic.priorityGap].importanceDirect ?? 1) <= 0.25)
    tensions.push({ id: "tension.gap_low_importance", basis: "hypothesis", uncertainty: TENSION,
      evidence: [direct("interconnections.05", answers), direct(`${ic.priorityGap}.importance`, answers)],
      text: `${by[ic.priorityGap].name} was named as a priority gap, while its importance was rated “${answerLabel(`${ic.priorityGap}.importance`, answers[`${ic.priorityGap}.importance`])}”.` });
  if (ic.leverageSelection && (by[ic.leverageSelection].importanceDirect ?? 1) <= 0.25)
    tensions.push({ id: "tension.leverage_low_importance", basis: "hypothesis", uncertainty: TENSION,
      evidence: [direct("interconnections.03", answers), direct(`${ic.leverageSelection}.importance`, answers)],
      text: `${by[ic.leverageSelection].name} was chosen as a leverage point but rated “${answerLabel(`${ic.leverageSelection}.importance`, answers[`${ic.leverageSelection}.importance`])}”.` });
  for (const o of result.orbits)
    if (sufficient(o) && o.responseSupportIndex! >= T.highSupport && (o.energyRaw ?? 0) >= 4)
      tensions.push({ id: `tension.supported_draining.${o.orbit}`, basis: "hypothesis", uncertainty: TENSION,
        evidence: [derivedRef(o), direct(`${o.orbit}.energy`, answers)],
        text: `${o.name}: statements describe strong support, yet it takes more energy than it gives.` });
  if (ic.crowdedOut && ic.overallSupport && ic.overallSupport.value.endsWith("support"))
    tensions.push({ id: "tension.support_vs_crowding", basis: "hypothesis", uncertainty: TENSION,
      evidence: [direct("interconnections.07", answers), direct("interconnections.04", answers)],
      text: `Sees the areas as “${ic.overallSupport.label}”, while also reporting ${by[ic.crowdedOut].name} being crowded out.` });

  // Coverage
  const coverage: CoachItem[] = [];
  for (const q of QUESTION_BANK.filter((x) => x.enabled)) {
    const a = answers[q.id];
    if (a === NOT_APPLICABLE)
      coverage.push({ id: `coverage.na.${q.id}`, basis: "direct", evidence: [direct(q.id, answers)], text: `Not applicable: “${q.prompt}” (excluded from calculations).` });
    else if (a === undefined && q.responseType !== "text")
      coverage.push({ id: `coverage.missing.${q.id}`, basis: "direct", evidence: [], text: `Not answered: “${q.prompt}”.` });
  }
  for (const o of result.orbits)
    if (o.supportConfidence !== "sufficient")
      coverage.push({ id: `coverage.conf.${o.orbit}`, basis: "derived", evidence: [], text: `${o.name}: ${o.supportConfidence} evidence (${o.coverage.valid}/${o.coverage.eligible}).` });

  // Assumptions vs evidence
  const assumptions: CoachItem[] = [
    { id: "assume.brightness", basis: "derived", evidence: [], text: "Brightness uses a supportive-response proxy (unweighted mean of keyed statements), not vitality. Vitality waits for the construct mapping (F1)." },
    { id: "assume.distance", basis: "derived", evidence: [], text: "Congruence is now measured (8 parallel statements, approved 12 Oct 2026) and shown below for coaches only. The client's Map keeps a neutral distance until the remaining F4 sign-offs and the pilot." },
    { id: "assume.attention", basis: "derived", evidence: [], text: "The client sees unranked attention candidates. Provisional attention tiers (Formula B) are shown below for coaches only, pending F5 sign-off." },
    { id: "assume.feelings", basis: "direct", evidence: [], text: "Feelings are quoted, never scored." },
  ];

  // Hypotheses to validate
  const hypotheses: CoachReport["hypotheses"] = [];
  for (const c of result.attention.candidates)
    for (const r of c.reasons.filter((x) => x.hypothesis))
      hypotheses.push({ id: `hyp.${r.id}`, basis: "hypothesis", text: r.body, evidence: r.evidence, uncertainty: r.caveat ?? TENSION,
        questionToValidate: r.templateId === "supportive_orbit"
          ? `What makes ${c.name} work right now, and could any of it carry over elsewhere?`
          : `Does it feel true that ${c.name} matters a lot and feels less supported right now? What would “supported” look like?` });
  for (const t of tensions)
    hypotheses.push({ ...t, id: `hyp.${t.id}`, questionToValidate: "How do these two answers sit together for you?" });

  return {
    templateVersion: COACH_REPORT_TEMPLATE_VERSION,
    versions: result.versions,
    scoringStatus: result.scoringStatus,
    sections: [
      { key: "strengths", title: "Strengths and resources", items: strengths },
      { key: "friction", title: "Friction", items: friction },
      { key: "tensions", title: "Possible contradictions", note: "Each is a question to explore, not a finding.", items: tensions },
      { key: "coverage", title: "Coverage, N/A and gaps", items: coverage },
      { key: "assumptions", title: "Assumptions vs evidence", items: assumptions },
    ],
    hypotheses,
    provenance: result.orbits.map((o) => ({
      orbit: o.orbit, name: o.name, importanceDirect: o.importanceDirect, energyRaw: o.energyRaw, energySigned: o.energySigned,
      responseSupportIndex: o.responseSupportIndex, coverage: `${o.coverage.valid}/${o.coverage.eligible}${o.coverage.notApplicable ? ` (${o.coverage.notApplicable} N/A)` : ""}`,
      confidence: o.supportConfidence, statuses: o.metricStatuses,
    })),
    formulas: [
      "Truth: (ordinal − 1) / 4; reverse-keyed items inverted.",
      "Importance (size): (ordinal − 1) / 4, direct only.",
      "Energy: ordinal 1–5 (1 = gives a lot); signed (3 − o) / 2; support (5 − o) / 4.",
      `Coverage gate: max(${PROVISIONAL_1.coverage.minValid}, ${PROVISIONAL_1.coverage.minShare * 100}% of eligible) — provisional.`,
      `Thresholds: high importance ≥ ${T.highImportance}, low support ≤ ${T.lowSupport}, high support ≥ ${T.highSupport} — provisional.`,
      "N/A and missing answers are excluded; denominators adjust; never imputed.",
    ],
    openFlags: result.openFlags.map((f) => ({ id: f.id, item: f.item })),
    intelligence: generateCoachIntelligence(result, answers),
    provisional: (() => {
      const name = (id: string) => result.orbits.find((o) => o.orbit === id)?.name ?? id;
      const c = f4(answers), p = f5(answers);
      const tierOf = (id: string) => { const i = p.tiersB.findIndex((t) => t.includes(id as never)); return i < 0 ? null : i + 1; };
      return {
        congruence: c.map((x) => ({ orbit: x.orbit, name: name(x.orbit), value: x.congruence, band: x.band, items: x.usedItems, evidenceUnits: x.evidenceUnits })),
        tiers: p.rows.map((r) => ({ orbit: r.orbit, name: name(r.orbit), tier: tierOf(r.orbit), importance: r.importance, supportGap: r.supportGap, congruenceGap: r.congruenceGap, leverage: r.leverage, modifiers: r.modifiers, score: r.scoreB })),
      };
    })(),
  };
}
