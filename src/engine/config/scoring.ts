/**
 * Scoring configuration — version "provisional-1" (backend spec, 12 Oct 2026).
 *
 * Only metrics that are fully defined are ACTIVE. The appendix formulas are stored for reference
 * but stay INACTIVE until the open approval items are signed off (see docs/03-scoring-and-open-flags.md).
 * Any change to this file requires a new scoringVersion so old Maps stay reproducible.
 */
export const SCORING_VERSION = "provisional-2"; // 2 = F4 congruence distance on the Map (approved 13 Oct 2026)
export const TEMPLATE_VERSION = "1";
export const MAP_RENDER_VERSION = "1";

export interface ScoringConfig {
  scoringVersion: string;
  status: "provisional" | "approved";
  /** §5.1 interim aggregation choice */
  aggregation: "mean";
  /** §5.7 proposed engineering gate — NOT approved */
  coverage: { minValid: number; minShare: number; approved: boolean };
  /** §9 example thresholds — provisional, NOT calibrated */
  thresholds: { highImportance: number; lowSupport: number; highSupport: number; approved: boolean };
  active: {
    /** Orbit size: direct stated importance only (80/20 blend disabled) */
    importance: "direct_only" | "composite_80_20";
    /** Brightness: supportive-response proxy (vitality 55/45 disabled) */
    brightness: "response_support_proxy" | "vitality_55_45";
    /** Distance: neutral fixed placement (provisional-1) or three congruence bands (provisional-2, F4 approved 13 Oct) */
    distance: "neutral_fixed" | "congruence";
    /** Attention: qualitative candidates only (ranking disabled) */
    attention: "qualitative_pending_approval" | "ranked";
    /** Sun: transparent interim unweighted mean */
    sun: "unweighted_mean_interim";
  };
  /** Appendix formulas, stored for reference only. */
  inactiveFormulas: {
    importance: { direct: number; revealedPriorityConsistency: number };
    vitality: { reality: number; relationship: number };
    congruence: { agency: number; relationship: number; selfCongruence: number };
    attention: { importance: number; lowVitality: number; lowCongruence: number; systemLeverage: number };
  };
}

export const PROVISIONAL_1: ScoringConfig = {
  scoringVersion: "provisional-1",
  status: "provisional",
  aggregation: "mean",
  coverage: { minValid: 3, minShare: 0.6, approved: false },
  thresholds: { highImportance: 0.75, lowSupport: 0.4, highSupport: 0.75, approved: false },
  active: {
    importance: "direct_only",
    brightness: "response_support_proxy",
    distance: "neutral_fixed",
    attention: "qualitative_pending_approval",
    sun: "unweighted_mean_interim",
  },
  inactiveFormulas: {
    importance: { direct: 0.8, revealedPriorityConsistency: 0.2 },
    vitality: { reality: 0.55, relationship: 0.45 },
    congruence: { agency: 0.45, relationship: 0.4, selfCongruence: 0.15 },
    attention: { importance: 0.35, lowVitality: 0.25, lowCongruence: 0.2, systemLeverage: 0.2 },
  },
};

/** provisional-2: identical to provisional-1 except distance = congruence bands (F4, approved by Jana 13 Oct 2026). */
export const PROVISIONAL_2: ScoringConfig = {
  ...PROVISIONAL_1,
  scoringVersion: SCORING_VERSION,
  active: { ...PROVISIONAL_1.active, distance: "congruence" },
};
/** The configuration new Maps are scored with. Earlier Maps keep their frozen snapshot and version. */
export const CURRENT_SCORING = PROVISIONAL_2;

/** Open approval items (spec §12) surfaced in results payload, admin and docs. */
export const OPEN_FLAGS = [
  { id: "F1", item: "Question-by-question REALITY / RELATIONSHIP / AGENCY / SELF_CONGRUENCE mapping", blocks: ["vitality", "congruence"] },
  { id: "F2", item: "Sun composite weighting beyond the interim mean", blocks: ["sun_weighted"] },
  { id: "F3", item: "Revealed-priority consistency definition", blocks: ["importance_composite"] },
  { id: "F4", item: "Orbit-specific congruence measurement — approved for the prototype 13 Oct (provisional thresholds)", blocks: ["least_connected"] },
  { id: "F5", item: "System leverage numeric mapping and bounded modifiers", blocks: ["attention_ranking"] },
  { id: "F6", item: "Coverage gate (max(3, 60%)) and numeric thresholds (0.75 / 0.40)", blocks: ["support_status", "attention_candidates"] },
  { id: "F7", item: "Life Interconnections IDs/options vs newest frontend; 'None / unsure' option not approved", blocks: [] },
  { id: "F8", item: "Emotional-state option sets vs active frontend (verified identical 12 Oct)", blocks: [] },
  { id: "F9", item: "Production legal / data-flow verification", blocks: ["launch"] },
] as const;

/**
 * Release switches for F4/F5. Both stay false until every row of the Design Pack sign-off table is approved
 * and the pilot passes. While false: distance stays neutral and attention stays qualitative on the client's Map and PDF.
 */
export const FEATURES = { personalisedDistance: true, attentionTiers: false } as const; // F4 approved 13 Oct; F5 still off
