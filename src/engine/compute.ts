/**
 * Current Life Map — scoring & interpretation engine, scoring version "provisional-1".
 * Implements the 12 Oct 2026 backend spec. Pure and deterministic.
 *
 *  raw answers ──► normalized (keyed) evidence ──► coverage ──► ACTIVE metrics only
 *                                                         └──► evidence-backed insights
 *
 * Never imputes: missing / N/A / insufficient → null, never a disguised 0.5.
 * Inactive (unapproved) metrics are returned as null with status "pending_mapping".
 */
import type { AnswerValue, OrbitId } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { QUESTION_BANK, QUESTION_BANK_VERSION, ASSESSMENT_VERSION, questionById } from "@/content/v10/question-bank";
import { ORBIT_IDS, chapterById } from "@/content/v10/chapters";
import { SUPPORT_COMPETE_OPTIONS } from "@/content/v10/scales";
import { MAP_RENDER_VERSION, OPEN_FLAGS, PROVISIONAL_1, TEMPLATE_VERSION, type ScoringConfig } from "./config/scoring";

export type Answers = Record<string, AnswerValue | undefined>;
export type Confidence = "sufficient" | "limited" | "insufficient";
export type MetricStatus = "active" | "proxy" | "pending_mapping" | "unavailable";

export interface Coverage {
  valid: number;
  /** eligible = statements minus N/A answers */
  eligible: number;
  notApplicable: number;
  missing: number;
}

export interface ItemEvidence {
  questionId: string;
  /** raw scale value as stored (truth 0–4) or NOT_APPLICABLE */
  raw: string | null;
  /** 1–5 ordinal as in the spec, or null */
  ordinal: number | null;
  /** keyed 0..1 (reverse-keyed items inverted), or null */
  keyed: number | null;
  reverseKeyed: boolean;
  status: "answered" | "not_applicable" | "skipped";
}

export type EvidenceRef = { questionId: string; answer: string; kind: "direct" | "derived" };

export interface Insight {
  id: string;
  templateId: string;
  title: string;
  body: string;
  evidence: EvidenceRef[];
  evidenceType: "direct" | "derived" | "hypothesis";
  hypothesis: boolean;
  caveat?: string;
  strength: "strong" | "moderate" | "tentative";
  orbits: OrbitId[];
}

export interface OrbitResult {
  orbit: OrbitId;
  name: string;
  /** direct stated importance 0..1 (spec §3), or null */
  importanceDirect: number | null;
  importanceOrdinal: number | null;
  /** spec §3: energyRaw 1..5 (1 = gives a lot), energySigned +1..−1, energySupport 1..0 */
  energyRaw: number | null;
  energySigned: number | null;
  energySupport: number | null;
  /** mean of eligible keyed truth responses — interim brightness proxy, not "vitality" */
  responseSupportIndex: number | null;
  supportConfidence: Confidence;
  /** INACTIVE until mappings are approved */
  vitality: null;
  congruence: null;
  emotions: { id: string; label: string }[];
  coverage: Coverage;
  items: ItemEvidence[];
  metricStatuses: { size: MetricStatus; brightness: MetricStatus; vitality: MetricStatus; congruence: MetricStatus; distance: MetricStatus };
  /** respondent's own selections in Life Interconnections */
  selections: {
    largestDemand: boolean;
    largestSource: boolean;
    leverage: boolean;
    crowdedOut: boolean;
    priorityGap: boolean;
    externalInfluence: boolean;
  };
  /** Social World only: separate subtheme indices (spec §1) */
  subthemes?: { career: number | null; community: number | null };
}

export interface SnapshotItem {
  key: "energyOut" | "energyIn" | "largestPlace" | "mostSupported" | "needsAttention" | "externalInfluence";
  label: string;
  orbits: OrbitId[];
  available: boolean;
  evidenceType: "direct" | "derived";
  body: string;
  evidence: EvidenceRef[];
}

export interface AttentionCandidate {
  orbit: OrbitId;
  name: string;
  reasons: Insight[];
}

export interface LifeMapResult {
  versions: { assessment: string; questionBank: string; scoring: string; templates: string; mapRender: string };
  scoringStatus: ScoringConfig["status"];
  completionStatus: "complete" | "partial";
  sun: { responseIndex: number | null; coverage: Coverage; confidence: Confidence; items: ItemEvidence[] };
  orbits: OrbitResult[];
  interconnections: {
    largestDemand: OrbitId | null;
    largestSource: OrbitId | null;
    leverageSelection: OrbitId | null;
    crowdedOut: OrbitId | null;
    priorityGap: OrbitId | null;
    externalInfluence: OrbitId | null;
    overallSupport: { value: string; label: string } | null;
  };
  snapshot: SnapshotItem[];
  insights: Insight[];
  attention: { mode: ScoringConfig["active"]["attention"]; candidates: AttentionCandidate[]; rankedOrbits: OrbitId[] };
  warnings: string[];
  openFlags: typeof OPEN_FLAGS;
}

const round = (n: number) => Math.round(n * 10000) / 10000;
const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const single = (a: AnswerValue | undefined) => (Array.isArray(a) ? a[0] : a);
const nameOf = (id: OrbitId) => chapterById(id).name;
const listWords = (words: string[]) =>
  words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
const listNames = (ids: OrbitId[]) => listWords(ids.map(nameOf));

/** Truth item → evidence (spec §3: x = (ordinal−1)/4; reverse: 1 − that). */
export function itemEvidence(questionId: string, answer: AnswerValue | undefined): ItemEvidence {
  const q = questionById(questionId);
  const reverseKeyed = !!q?.reverseKeyed;
  const v = single(answer);
  if (v === undefined) return { questionId, raw: null, ordinal: null, keyed: null, reverseKeyed, status: "skipped" };
  if (v === NOT_APPLICABLE) return { questionId, raw: NOT_APPLICABLE, ordinal: null, keyed: null, reverseKeyed, status: "not_applicable" };
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || n > 4 || !Number.isInteger(n))
    return { questionId, raw: v, ordinal: null, keyed: null, reverseKeyed, status: "skipped" };
  const ordinal = n + 1;
  const x = (ordinal - 1) / 4;
  return { questionId, raw: v, ordinal, keyed: round(reverseKeyed ? 1 - x : x), reverseKeyed, status: "answered" };
}

/** Keyed truth value or null. */
export function scoreTruth(questionId: string, answer: AnswerValue | undefined): number | null {
  return itemEvidence(questionId, answer).keyed;
}

function coverageOf(items: ItemEvidence[]): Coverage {
  const notApplicable = items.filter((i) => i.status === "not_applicable").length;
  const valid = items.filter((i) => i.status === "answered").length;
  const eligible = items.length - notApplicable;
  return { valid, eligible, notApplicable, missing: eligible - valid };
}

/** Spec §5.7 proposed gate (unapproved, flag F6): max(3, ceil(60% of eligible)). */
export function confidenceOf(c: Coverage, cfg: ScoringConfig = PROVISIONAL_1): Confidence {
  if (c.valid === 0) return "insufficient";
  const need = Math.max(cfg.coverage.minValid, Math.ceil(cfg.coverage.minShare * c.eligible));
  if (c.valid >= need) return "sufficient";
  return c.valid >= 2 ? "limited" : "insufficient";
}

/** Energy as stored (+2..−2) → spec ordinal 1..5 (1 = gives a lot). */
export function energyFields(a: AnswerValue | undefined) {
  const v = single(a);
  const stored = v === undefined ? NaN : Number(v);
  if (Number.isNaN(stored) || stored < -2 || stored > 2) return { energyRaw: null, energySigned: null, energySupport: null };
  const ordinal = 3 - stored;
  return { energyRaw: ordinal, energySigned: round((3 - ordinal) / 2), energySupport: round((5 - ordinal) / 4) };
}

const ENERGY_PHRASE: Record<number, string> = {
  1: "gives you a lot of energy",
  2: "gives you more energy than it takes",
  3: "keeps your energy fairly stable",
  4: "takes more energy than it gives",
  5: "drains a lot of your energy",
};
const IMPORTANCE_PHRASE = ["not important right now", "slightly important", "moderately important", "very important", "one of your highest priorities"];

export function computeLifeMap(answers: Answers, cfg: ScoringConfig = PROVISIONAL_1): LifeMapResult {
  const pick = (id: string) => {
    const v = single(answers[id]);
    return v && (ORBIT_IDS as string[]).includes(v) ? (v as OrbitId) : null;
  };
  const inter = {
    largestDemand: pick("interconnections.01"),
    largestSource: pick("interconnections.02"),
    leverageSelection: pick("interconnections.03"),
    crowdedOut: pick("interconnections.04"),
    priorityGap: pick("interconnections.05"),
    externalInfluence: pick("interconnections.06"),
    overallSupport: (() => {
      const v = single(answers["interconnections.07"]);
      const o = SUPPORT_COMPETE_OPTIONS.find((x) => x.value === v);
      return o ? { value: o.value, label: o.label } : null;
    })(),
  };

  // ── Orbits ──────────────────────────────────────────────────────────────
  const orbits: OrbitResult[] = ORBIT_IDS.map((orbit) => {
    const statements = QUESTION_BANK.filter((q) => q.chapterId === orbit && q.responseType === "truth" && q.enabled && q.measure !== "congruence");
    const items = statements.map((q) => itemEvidence(q.id, answers[q.id]));
    const coverage = coverageOf(items);
    const confidence = confidenceOf(coverage, cfg);
    const keyed = items.map((i) => i.keyed).filter((x): x is number => x !== null);
    const responseSupportIndex = confidence === "insufficient" ? null : mean(keyed);

    const impRaw = single(answers[`${orbit}.importance`]);
    const impN = impRaw === undefined ? NaN : Number(impRaw);
    const importanceOrdinal = Number.isInteger(impN) && impN >= 0 && impN <= 4 ? impN + 1 : null;
    const importanceDirect = importanceOrdinal === null ? null : round((importanceOrdinal - 1) / 4);

    const emotionQ = questionById(`${orbit}.emotion`);
    const emoRaw = answers[`${orbit}.emotion`];
    const emotions = [...new Set(Array.isArray(emoRaw) ? emoRaw : [])]
      .map((v) => emotionQ?.options.find((o) => o.value === v))
      .filter((o): o is { value: string; label: string } => !!o)
      .slice(0, 3)
      .map((o) => ({ id: o.value, label: o.label }));

    const subthemes =
      orbit === "social"
        ? (() => {
            const byTheme = (t: "career" | "community") =>
              mean(
                statements
                  .filter((q) => q.subtheme === t || q.subtheme === "both")
                  .map((q) => itemEvidence(q.id, answers[q.id]).keyed)
                  .filter((x): x is number => x !== null),
              );
            return { career: byTheme("career"), community: byTheme("community") };
          })()
        : undefined;

    return {
      orbit,
      name: nameOf(orbit),
      importanceDirect,
      importanceOrdinal,
      ...energyFields(answers[`${orbit}.energy`]),
      responseSupportIndex,
      supportConfidence: confidence,
      vitality: null,
      congruence: null,
      emotions,
      coverage,
      items,
      metricStatuses: {
        size: importanceDirect === null ? "unavailable" : "active",
        brightness: responseSupportIndex === null ? "unavailable" : "proxy",
        vitality: "pending_mapping",
        congruence: "pending_mapping",
        distance: "pending_mapping",
      },
      selections: {
        largestDemand: inter.largestDemand === orbit,
        largestSource: inter.largestSource === orbit,
        leverage: inter.leverageSelection === orbit,
        crowdedOut: inter.crowdedOut === orbit,
        priorityGap: inter.priorityGap === orbit,
        externalInfluence: inter.externalInfluence === orbit,
      },
      subthemes,
    };
  });

  // ── Sun (interim unweighted mean of supportive-keyed statements) ────────
  const sunItems = QUESTION_BANK.filter((q) => q.chapterId === "sun" && q.responseType === "truth").map((q) => itemEvidence(q.id, answers[q.id]));
  const sunCoverage = coverageOf(sunItems);
  const sunConfidence = confidenceOf(sunCoverage, cfg);
  const sun = {
    responseIndex: sunConfidence === "insufficient" ? null : mean(sunItems.map((i) => i.keyed).filter((x): x is number => x !== null)),
    coverage: sunCoverage,
    confidence: sunConfidence,
    items: sunItems,
  };

  const by = Object.fromEntries(orbits.map((o) => [o.orbit, o])) as Record<OrbitId, OrbitResult>;
  const T = cfg.thresholds;
  const sufficient = (o: OrbitResult) => o.supportConfidence === "sufficient" && o.responseSupportIndex !== null;

  // ── Snapshot (spec §7.2) ────────────────────────────────────────────────
  const snapshot: SnapshotItem[] = [];
  const demand = inter.largestDemand, source = inter.largestSource;
  snapshot.push({
    key: "energyOut", label: "Most energy out", orbits: demand ? [demand] : [], available: !!demand, evidenceType: "direct",
    body: demand ? `You identified ${nameOf(demand)} as taking the most of your time, attention or emotional energy.` : "",
    evidence: demand ? [{ questionId: "interconnections.01", answer: demand, kind: "direct" }] : [],
  });
  snapshot.push({
    key: "energyIn", label: "Most energy in", orbits: source ? [source] : [], available: !!source, evidenceType: "direct",
    body: source ? `You identified ${nameOf(source)} as giving you the most energy or making you feel most alive.` : "",
    evidence: source ? [{ questionId: "interconnections.02", answer: source, kind: "direct" }] : [],
  });
  const maxImp = Math.max(...orbits.map((o) => o.importanceDirect ?? -1));
  const largest = maxImp >= 0 ? orbits.filter((o) => o.importanceDirect === maxImp).map((o) => o.orbit) : [];
  snapshot.push({
    key: "largestPlace", label: "Largest place now", orbits: largest, available: largest.length > 0, evidenceType: "direct",
    body: largest.length
      ? `You rated ${listNames(largest)} as ${IMPORTANCE_PHRASE[Math.round(maxImp * 4)]}${largest.length > 1 ? ", the highest importance you gave any area" : ""}.`
      : "",
    evidence: largest.map((id) => ({ questionId: `${id}.importance`, answer: String(by[id].importanceOrdinal), kind: "direct" as const })),
  });
  const supported = orbits.filter(sufficient);
  if (supported.length >= 2) {
    const hi = Math.max(...supported.map((o) => o.responseSupportIndex!));
    const lo = Math.min(...supported.map((o) => o.responseSupportIndex!));
    const top = supported.filter((o) => o.responseSupportIndex === hi).map((o) => o.orbit);
    const bottom = supported.filter((o) => o.responseSupportIndex === lo).map((o) => o.orbit);
    const differs = hi !== lo;
    snapshot.push({
      key: "mostSupported", label: "Most supported", orbits: differs ? top : [], available: differs, evidenceType: "derived",
      body: differs ? `Your answers about ${listNames(top)} describe the most support across the statements in ${top.length > 1 ? "those areas" : "that area"}.` : "",
      evidence: top.map((id) => ({ questionId: `${id}.*`, answer: String(by[id].responseSupportIndex), kind: "derived" as const })),
    });
    snapshot.push({
      key: "needsAttention", label: "Needs more attention", orbits: differs ? bottom : [], available: differs, evidenceType: "derived",
      body: differs ? `Your answers about ${listNames(bottom)} describe the least support right now. This is a place to look, not a verdict.` : "",
      evidence: bottom.map((id) => ({ questionId: `${id}.*`, answer: String(by[id].responseSupportIndex), kind: "derived" as const })),
    });
  }
  const ext = inter.externalInfluence;
  snapshot.push({
    key: "externalInfluence", label: "Most shaped by expectations", orbits: ext ? [ext] : [], available: !!ext, evidenceType: "direct",
    body: ext ? `You identified ${nameOf(ext)} as most influenced by other people’s expectations or social standards.` : "",
    evidence: ext ? [{ questionId: "interconnections.06", answer: ext, kind: "direct" }] : [],
  });

  // ── Insights (evidence → rule → template) ───────────────────────────────
  const insights: Insight[] = [];
  const add = (i: Omit<Insight, "id">) => insights.push({ ...i, id: `${i.templateId}:${i.orbits.join("+") || "system"}` });

  if (demand && source && demand === source) {
    add({ templateId: "demand_and_source", title: `${nameOf(demand)} asks a lot and gives a lot`, orbits: [demand], evidenceType: "direct", hypothesis: false, strength: "strong",
      body: `You named ${nameOf(demand)} as both what takes the most of you and what gives you the most energy. It may be taking substantial effort while also giving something back. Whether that exchange feels sustainable is worth exploring.`,
      evidence: [{ questionId: "interconnections.01", answer: demand, kind: "direct" }, { questionId: "interconnections.02", answer: source, kind: "direct" }] });
  }
  if (demand && inter.crowdedOut && demand !== inter.crowdedOut) {
    add({ templateId: "reported_tradeoff", title: "A reported trade-off", orbits: [demand, inter.crowdedOut], evidenceType: "direct", hypothesis: false, strength: "strong",
      body: `${nameOf(demand)} takes most of your time and attention, and you reported ${nameOf(inter.crowdedOut)} receiving less care because other demands take space.`,
      caveat: "Reported trade-off, not proven causation.",
      evidence: [{ questionId: "interconnections.01", answer: demand, kind: "direct" }, { questionId: "interconnections.04", answer: inter.crowdedOut, kind: "direct" }] });
  }
  const importantDrains = orbits.filter((o) => (o.importanceDirect ?? 0) >= T.highImportance && (o.energyRaw ?? 0) >= 4).map((o) => o.orbit);
  if (importantDrains.length) {
    const many = importantDrains.length > 1;
    add({ templateId: "important_and_draining", title: "What matters is also costing energy", orbits: importantDrains, evidenceType: "direct", hypothesis: false, strength: "moderate",
      body: `${listNames(importantDrains)} ${many ? "matter" : "matters"} a great deal to you and currently ${many ? "take" : "takes"} more energy than ${many ? "they give" : "it gives"}.`,
      evidence: importantDrains.flatMap((id) => [
        { questionId: `${id}.importance`, answer: String(by[id].importanceOrdinal), kind: "direct" as const },
        { questionId: `${id}.energy`, answer: String(by[id].energyRaw), kind: "direct" as const },
      ]) });
  }
  for (const o of orbits) {
    if (o.importanceDirect !== null && o.importanceDirect <= 0.25 && o.energyRaw !== null && o.energyRaw <= 2) {
      add({ templateId: "quiet_source", title: `${o.name} as a quiet source`, orbits: [o.orbit], evidenceType: "direct", hypothesis: false, strength: "moderate",
        body: `${o.name} isn’t a priority right now, yet you said it ${ENERGY_PHRASE[o.energyRaw]}.`,
        evidence: [{ questionId: `${o.orbit}.importance`, answer: String(o.importanceOrdinal), kind: "direct" }, { questionId: `${o.orbit}.energy`, answer: String(o.energyRaw), kind: "direct" }] });
    }
  }
  for (const o of orbits) {
    if (o.emotions.length >= 2) {
      add({ templateId: "feelings_selected", title: `How ${o.name} feels`, orbits: [o.orbit], evidenceType: "direct", hypothesis: false, strength: "moderate",
        body: `When describing ${o.name}, you chose ${listWords(o.emotions.map((e) => e.label))}.`,
        evidence: [{ questionId: `${o.orbit}.emotion`, answer: o.emotions.map((e) => e.id).join(","), kind: "direct" }] });
    }
  }
  if (inter.overallSupport) {
    add({ templateId: "system_support", title: "How your areas relate", orbits: [], evidenceType: "direct", hypothesis: false, strength: "moderate",
      body: `Asked whether the areas of your life mostly help each other or compete, you answered: “${inter.overallSupport.label}.”`,
      caveat: "Whole-system perception, not a measured network.",
      evidence: [{ questionId: "interconnections.07", answer: inter.overallSupport.value, kind: "direct" }] });
  }

  // ── Attention: qualitative candidates only (spec §5.6, §7.4) ────────────
  const cand = new Map<OrbitId, Insight[]>();
  const push = (id: OrbitId, r: Omit<Insight, "id" | "orbits">) => {
    const list = cand.get(id) ?? [];
    list.push({ ...r, id: `${r.templateId}:${id}`, orbits: [id] });
    cand.set(id, list);
  };
  if (inter.leverageSelection) push(inter.leverageSelection, { templateId: "leverage", title: "Possible leverage point", evidenceType: "direct", hypothesis: false, strength: "strong",
    body: `You see ${nameOf(inter.leverageSelection)} as a possible leverage point: improving it could positively influence the rest of your life.`,
    evidence: [{ questionId: "interconnections.03", answer: inter.leverageSelection, kind: "direct" }] });
  for (const o of orbits) {
    if (sufficient(o) && (o.importanceDirect ?? 0) >= T.highImportance && o.responseSupportIndex! <= T.lowSupport)
      push(o.orbit, { templateId: "high_importance_low_support", title: "Matters a lot, feels less supported", evidenceType: "hypothesis", hypothesis: true, strength: "tentative",
        body: `You place high importance on ${o.name}, while several of your answers suggest it currently feels less supported.`,
        caveat: "Provisional thresholds (importance ≥ 0.75, support ≤ 0.40), not calibrated bands.",
        evidence: [{ questionId: `${o.orbit}.importance`, answer: String(o.importanceOrdinal), kind: "direct" }, { questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex), kind: "derived" }] });
  }
  if (inter.crowdedOut) push(inter.crowdedOut, { templateId: "crowded_out", title: "Receiving less care", evidenceType: "direct", hypothesis: false, strength: "strong",
    body: `You report ${nameOf(inter.crowdedOut)} receiving less care because other demands take space.`,
    evidence: [{ questionId: "interconnections.04", answer: inter.crowdedOut, kind: "direct" }] });
  if (inter.priorityGap) push(inter.priorityGap, { templateId: "priority_gap", title: "A gap you noticed", evidenceType: "direct", hypothesis: false, strength: "strong",
    body: `You notice a gap around ${nameOf(inter.priorityGap)}: it matters to you but gets less of your time and energy than you would like.`,
    evidence: [{ questionId: "interconnections.05", answer: inter.priorityGap, kind: "direct" }] });
  for (const id of importantDrains) push(id, { templateId: "important_drain", title: "Important and draining", evidenceType: "direct", hypothesis: false, strength: "moderate",
    body: `${nameOf(id)} matters a great deal to you and you said it ${ENERGY_PHRASE[by[id].energyRaw!]}.`,
    evidence: [{ questionId: `${id}.importance`, answer: String(by[id].importanceOrdinal), kind: "direct" }, { questionId: `${id}.energy`, answer: String(by[id].energyRaw), kind: "direct" }] });
  for (const o of orbits) {
    if (sufficient(o) && o.responseSupportIndex! >= T.highSupport && o.energyRaw !== null && o.energyRaw <= 2)
      push(o.orbit, { templateId: "supportive_orbit", title: "A supportive area", evidenceType: "hypothesis", hypothesis: true, strength: "tentative",
        body: `${o.name} looks well supported in your answers and gives you energy. What works here may offer something transferable.`,
        caveat: "Provisional threshold (support ≥ 0.75).",
        evidence: [{ questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex), kind: "derived" }, { questionId: `${o.orbit}.energy`, answer: String(o.energyRaw), kind: "direct" }] });
  }
  // Stable, documented display order (not a score): number of distinct reasons, then canonical Orbit order.
  const candidates: AttentionCandidate[] = [...cand.entries()]
    .sort((a, b) => b[1].length - a[1].length || ORBIT_IDS.indexOf(a[0]) - ORBIT_IDS.indexOf(b[0]))
    .map(([orbit, reasons]) => ({ orbit, name: nameOf(orbit), reasons }));

  const requiredMissing = QUESTION_BANK.some((q) => q.enabled && !q.optional && answers[q.id] === undefined);
  const warnings = [
    "Provisional scoring (provisional-1): brightness is a supportive-response proxy, distance is not personalised, attention is qualitative.",
    ...orbits.filter((o) => o.supportConfidence !== "sufficient").map((o) => `${o.name}: ${o.supportConfidence} evidence (${o.coverage.valid}/${o.coverage.eligible}).`),
  ];

  return {
    versions: { assessment: ASSESSMENT_VERSION, questionBank: QUESTION_BANK_VERSION, scoring: cfg.scoringVersion, templates: TEMPLATE_VERSION, mapRender: MAP_RENDER_VERSION },
    scoringStatus: cfg.status,
    completionStatus: requiredMissing ? "partial" : "complete",
    sun,
    orbits,
    interconnections: inter,
    snapshot,
    insights,
    attention: { mode: cfg.active.attention, candidates, rankedOrbits: [] },
    warnings,
    openFlags: OPEN_FLAGS,
  };
}
