// QUARANTINED (spec §5.8): pre-spec engine kept for reference only. Not imported anywhere. Do not use.
// @ts-nocheck
/**
 * Current Life Map metric engine.
 * Pure and deterministic: same answers + same config → identical output.
 * Raw answers are never mutated; every derived number carries its evidence.
 */
import type { AnswerValue, OrbitId } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { QUESTION_BANK } from "@/content/v10/question-bank";
import { ORBIT_IDS, chapterById } from "@/content/v10/chapters";
import type { Construct, EngineConfig } from "./config/v10-provisional";
import { V10_PROVISIONAL } from "./config/v10-provisional";

export type Answers = Record<string, AnswerValue | undefined>;
export type Evidence = "full" | "partial" | "insufficient";

export interface Reason {
  basis: "reported" | "calculated";
  text: string;
}

export interface OrbitMetrics {
  orbit: OrbitId;
  name: string;
  /** 0–1, direct answer */
  statedImportance: number | null;
  /** -1..1, direct answer (+ gives energy, − takes energy) */
  energy: number | null;
  constructs: Record<Construct, { value: number | null; n: number }>;
  /** 0–1 calculated indicators; null when evidence is insufficient */
  importance: number | null;
  vitality: number | null;
  congruence: number | null;
  vitalityGap: number | null;
  evidence: Evidence;
  missing: string[];
  selections: {
    largestDemand: boolean;
    largestSource: boolean;
    leverage: boolean;
    crowdedOut: boolean;
    priorityMismatch: boolean;
    autopilot: boolean;
  };
  attentionScore: number | null;
  attentionRank: number;
  reasons: Reason[];
}

export interface SunMetrics {
  facets: { name: string; value: number | null; items: string[] }[];
  /** Internal only — never shown to respondents as a score */
  synthesis: number | null;
  answered: number;
}

export interface SnapshotItem {
  key: "energyOut" | "energyIn" | "largestPlace" | "mostSupported" | "needsSupport" | "leastConnected";
  label: string;
  orbit: OrbitId | null;
  basis: "reported" | "calculated" | "none";
  why: string;
}

export interface LifeMapResult {
  configId: string;
  configStatus: EngineConfig["status"];
  contentVersion: string;
  orbits: OrbitMetrics[];
  sun: SunMetrics;
  snapshot: SnapshotItem[];
  attentionOrder: OrbitId[];
  interdependence: string | null;
  warnings: string[];
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** Weighted mean renormalised over the components that exist. */
function weighted(parts: { value: number | null; weight: number }[]): { value: number | null; missing: number } {
  const present = parts.filter((p) => p.value !== null && p.weight > 0);
  const missing = parts.filter((p) => p.value === null && p.weight > 0).length;
  const total = present.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return { value: null, missing };
  return { value: round(present.reduce((s, p) => s + (p.value as number) * p.weight, 0) / total), missing };
}

const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function single(a: AnswerValue | undefined): string | undefined {
  return Array.isArray(a) ? a[0] : a;
}

/** Truth item → 0..1 support, reverse-keyed inverted. NA / missing → null. */
export function scoreTruth(questionId: string, answer: AnswerValue | undefined, cfg = V10_PROVISIONAL): number | null {
  const v = single(answer);
  if (v === undefined || v === NOT_APPLICABLE) return null;
  const q = QUESTION_BANK.find((x) => x.id === questionId);
  const n = Number(v);
  if (!q || Number.isNaN(n)) return null;
  const s = n / cfg.scale.truthMax;
  return round(q.reverseKeyed ? 1 - s : s);
}

export function computeLifeMap(answers: Answers, cfg: EngineConfig = V10_PROVISIONAL): LifeMapResult {
  const warnings: string[] = [];
  if (cfg.status !== "approved") warnings.push("Provisional methodology: weights and construct mapping await approval.");
  if (cfg.importance.revealedEnabled === false)
    warnings.push("Orbit size uses stated importance only; revealed-priority consistency is not defined in V10.");

  const sel = (id: string) => single(answers[id]);
  const picks = {
    largestDemand: sel("interconnections.01"),
    largestSource: sel("interconnections.02"),
    leverage: sel("interconnections.03"),
    crowdedOut: sel("interconnections.04"),
    priorityMismatch: sel("interconnections.05"),
    autopilot: sel("interconnections.06"),
  };

  const orbits: OrbitMetrics[] = ORBIT_IDS.map((orbit) => {
    const ch = chapterById(orbit);
    const statements = QUESTION_BANK.filter((q) => q.chapterId === orbit && q.responseType === "truth");
    const byConstruct: Record<Construct, number[]> = { reality: [], innerState: [], relationship: [], agency: [] };
    let answered = 0;
    for (const q of statements) {
      const s = scoreTruth(q.id, answers[q.id], cfg);
      if (s === null) continue;
      answered++;
      const c = cfg.constructMap[q.id];
      if (c) byConstruct[c].push(s);
    }
    const constructs = Object.fromEntries(
      (Object.keys(byConstruct) as Construct[]).map((k) => [k, { value: mean(byConstruct[k]), n: byConstruct[k].length }]),
    ) as OrbitMetrics["constructs"];

    const impRaw = sel(`${orbit}.importance`);
    const statedImportance = impRaw !== undefined ? round(Number(impRaw) / cfg.scale.importanceMax) : null;
    const enRaw = sel(`${orbit}.energy`);
    const energy = enRaw !== undefined ? round(Number(enRaw) / cfg.scale.energyMax) : null;

    const selections = {
      largestDemand: picks.largestDemand === orbit,
      largestSource: picks.largestSource === orbit,
      leverage: picks.leverage === orbit,
      crowdedOut: picks.crowdedOut === orbit,
      priorityMismatch: picks.priorityMismatch === orbit,
      autopilot: picks.autopilot === orbit,
    };

    const missing: string[] = [];
    const share = statements.length ? answered / statements.length : 0;
    const enough = share >= cfg.minEvidenceShare;
    if (!enough) missing.push("Fewer than half of this Orbit's statements apply or were answered.");

    // Size / importance
    const importance = weighted([
      { value: statedImportance, weight: cfg.importance.stated },
      { value: null, weight: cfg.importance.revealedEnabled ? cfg.importance.revealed : 0 },
    ]).value;

    // Vitality / brightness
    const vit = weighted([
      { value: constructs.reality.value, weight: cfg.vitality.reality },
      { value: constructs.relationship.value, weight: cfg.vitality.relationship },
    ]);
    if (vit.missing) missing.push("Vitality is missing a component (Reality or Relationship).");

    // Congruence / distance
    const scItems = cfg.selfCongruenceItems
      .filter((id) => id.startsWith(`${orbit}.`))
      .map((id) => scoreTruth(id, answers[id], cfg))
      .filter((x): x is number => x !== null);
    const scParts = [...scItems];
    if (picks.autopilot !== undefined) scParts.push(selections.autopilot ? 0 : 1);
    const selfCongruence = mean(scParts);
    const con = weighted([
      { value: constructs.agency.value, weight: cfg.congruence.agency },
      { value: constructs.relationship.value, weight: cfg.congruence.relationship },
      { value: selfCongruence, weight: cfg.congruence.selfCongruence },
    ]);
    if (con.missing) missing.push("Congruence is missing a component.");

    const vitality = enough ? vit.value : null;
    const congruence = enough ? con.value : null;
    const vitalityGap =
      importance !== null && vitality !== null ? round(Math.max(0, importance - vitality)) : null;

    return {
      orbit,
      name: ch.name,
      statedImportance,
      energy,
      constructs,
      importance,
      vitality,
      congruence,
      vitalityGap,
      evidence: !enough ? "insufficient" : missing.length ? "partial" : "full",
      missing,
      selections,
      attentionScore: null,
      attentionRank: 0,
      reasons: [],
    };
  });

  // Attention order
  for (const o of orbits) {
    const a = cfg.attention;
    const base = weighted([
      { value: o.importance, weight: a.importance },
      { value: o.vitalityGap, weight: a.vitalityGap },
      { value: o.congruence === null ? null : 1 - o.congruence, weight: a.disconnection },
      { value: picks.leverage === undefined ? null : o.selections.leverage ? 1 : 0, weight: a.leverage },
    ]).value;
    if (base === null) continue;
    let score = base;
    if (o.energy !== null && o.energy < 0) score += a.modifiers.energyDrain * -o.energy;
    if (o.selections.priorityMismatch) score += a.modifiers.priorityMismatch;
    if (o.selections.crowdedOut) score += a.modifiers.crowdedOut;
    o.attentionScore = round(score);
    o.reasons = buildReasons(o);
  }

  // Deterministic ranking: score desc, then stated importance desc, then canonical Orbit order.
  const ranked = [...orbits].sort((x, y) => {
    const sx = x.attentionScore ?? -1, sy = y.attentionScore ?? -1;
    if (sy !== sx) return sy - sx;
    const ix = x.statedImportance ?? -1, iy = y.statedImportance ?? -1;
    if (iy !== ix) return iy - ix;
    return ORBIT_IDS.indexOf(x.orbit) - ORBIT_IDS.indexOf(y.orbit);
  });
  ranked.forEach((o, i) => (o.attentionRank = i + 1));

  // Sun
  const facets = Object.entries(cfg.sunFacets).map(([name, items]) => ({
    name,
    items,
    value: mean(items.map((id) => scoreTruth(id, answers[id], cfg)).filter((x): x is number => x !== null)),
  }));
  const sunAnswered = QUESTION_BANK.filter((q) => q.chapterId === "sun" && answers[q.id] !== undefined).length;
  const sun: SunMetrics = {
    facets,
    synthesis: mean(facets.map((f) => f.value).filter((x): x is number => x !== null)),
    answered: sunAnswered,
  };

  return {
    configId: cfg.id,
    configStatus: cfg.status,
    contentVersion: cfg.contentVersion,
    orbits,
    sun,
    snapshot: buildSnapshot(orbits, picks),
    attentionOrder: ranked.map((o) => o.orbit),
    interdependence: sel("interconnections.07") ?? null,
    warnings,
  };
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function buildReasons(o: OrbitMetrics): Reason[] {
  const r: Reason[] = [];
  const impLabel = ["not important right now", "slightly important", "moderately important", "very important", "one of your highest priorities"];
  if (o.statedImportance !== null)
    r.push({ basis: "reported", text: `You rated ${o.name} as ${impLabel[Math.round(o.statedImportance * 4)]}.` });
  if (o.energy !== null) {
    const e = o.energy;
    r.push({
      basis: "reported",
      text: e < 0 ? `You said ${o.name} takes more energy than it gives.` : e > 0 ? `You said ${o.name} gives you energy.` : `You said ${o.name} keeps your energy fairly stable.`,
    });
  }
  if (o.selections.leverage) r.push({ basis: "reported", text: `You chose ${o.name} as the Orbit whose improvement could most influence the rest of your life.` });
  if (o.selections.crowdedOut) r.push({ basis: "reported", text: `You named ${o.name} as receiving less care because another area demands so much.` });
  if (o.selections.priorityMismatch) r.push({ basis: "reported", text: `You said ${o.name} matters but gets less time and energy than you'd like.` });
  if (o.selections.autopilot) r.push({ basis: "reported", text: `You said ${o.name} is most influenced by other people’s expectations or social standards.` });
  if (o.vitalityGap !== null && o.vitalityGap >= 0.25)
    r.push({ basis: "calculated", text: `Its importance to you is noticeably higher than the support your answers describe in it.` });
  if (o.congruence !== null && o.congruence < 0.5)
    r.push({ basis: "calculated", text: `Your answers suggest this area currently feels less connected to who you are.` });
  if (o.evidence !== "full") r.push({ basis: "calculated", text: `Evidence for this Orbit is ${o.evidence}; read this ranking lightly.` });
  return r;
}

function pickBy(orbits: OrbitMetrics[], f: (o: OrbitMetrics) => number | null, dir: "max" | "min"): OrbitMetrics | null {
  let best: OrbitMetrics | null = null;
  let bv = 0;
  for (const o of orbits) {
    const v = f(o);
    if (v === null) continue;
    if (best === null || (dir === "max" ? v > bv : v < bv)) {
      best = o;
      bv = v;
    }
  }
  return best;
}

function buildSnapshot(orbits: OrbitMetrics[], picks: Record<string, string | undefined>): SnapshotItem[] {
  const by = (id?: string) => orbits.find((o) => o.orbit === id) ?? null;
  const items: SnapshotItem[] = [];

  // Most energy out — lowest reported energy; tie → the Orbit named as largest demand
  const out = pickBy(orbits, (o) => (o.energy === null || o.energy >= 0 ? null : -o.energy + (o.selections.largestDemand ? 0.01 : 0)), "max");
  items.push({ key: "energyOut", label: "Most energy out", orbit: out?.orbit ?? null, basis: out ? "reported" : "none",
    why: out ? `You said ${out.name} ${out.energy! <= -1 ? "drains a lot of" : "takes more"} energy${out.energy! <= -1 ? "" : " than it gives"}.` : "No Orbit was described as taking more energy than it gives." });

  const inn = pickBy(orbits, (o) => (o.energy === null || o.energy <= 0 ? null : o.energy + (o.selections.largestSource ? 0.01 : 0)), "max");
  items.push({ key: "energyIn", label: "Most energy in", orbit: inn?.orbit ?? null, basis: inn ? "reported" : "none",
    why: inn ? `You said ${inn.name} gives you ${inn.energy! >= 1 ? "a lot of energy" : "more energy than it takes"}.` : "No Orbit was described as giving more energy than it takes." });

  const largest = by(picks.largestDemand);
  items.push({ key: "largestPlace", label: "Largest place now", orbit: largest?.orbit ?? null, basis: largest ? "reported" : "none",
    why: largest ? `You said ${largest.name} currently takes most of your time, attention or emotional energy.` : "Not answered." });

  const sup = pickBy(orbits, (o) => o.vitality, "max");
  items.push({ key: "mostSupported", label: "Most supported", orbit: sup?.orbit ?? null, basis: sup ? "calculated" : "none",
    why: sup ? `Your answers about ${sup.name} describe the most support in what's happening and how you relate to it.` : "Not enough evidence." });

  const need = pickBy(orbits, (o) => (o.vitalityGap && o.vitalityGap > 0 ? o.vitalityGap : null), "max");
  items.push({ key: "needsSupport", label: "Needs more attention", orbit: need?.orbit ?? null, basis: need ? "calculated" : "none",
    why: need ? `${need.name} matters to you more than your answers say it is currently supported.` : "No Orbit shows importance clearly above its current support." });

  const least = pickBy(orbits, (o) => o.congruence, "min");
  items.push({ key: "leastConnected", label: "Least connected with you", orbit: least?.orbit ?? null, basis: least ? "calculated" : "none",
    why: least ? `Your answers suggest ${least.name} currently feels least like your own${least.selections.autopilot ? ", and you named it as most influenced by other people’s expectations" : ""}.` : "Not enough evidence." });

  return items;
}

export { pct };
