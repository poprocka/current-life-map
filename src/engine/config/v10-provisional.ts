/**
 * Provisional measurement configuration for V10.
 *
 * STATUS: proposed. These are developmental methodology rules, NOT validated psychometrics.
 * Weights marked "spec" come from the V10 Implementation Appendix.
 * Everything marked "proposed" fills a gap the Appendix leaves open (audit §4) and needs Jana's approval.
 * Changing any value requires a new `id` so stored results stay reproducible.
 */
export type Construct = "reality" | "innerState" | "relationship" | "agency";

export interface EngineConfig {
  id: string;
  contentVersion: "v10";
  status: "proposed" | "approved";
  scale: { truthMax: number; importanceMax: number; energyMin: number; energyMax: number };
  importance: { stated: number; revealed: number; revealedEnabled: boolean };
  vitality: { reality: number; relationship: number };
  congruence: { agency: number; relationship: number; selfCongruence: number };
  attention: {
    importance: number;
    vitalityGap: number;
    disconnection: number;
    leverage: number;
    modifiers: { energyDrain: number; priorityMismatch: number; crowdedOut: number };
  };
  /** M1: question id → construct (proposed) */
  constructMap: Record<string, Construct>;
  /** M3: items treated as self-congruence evidence (proposed) */
  selfCongruenceItems: string[];
  /** M4: Sun facets → items, equal weights (proposed) */
  sunFacets: Record<string, string[]>;
  /** Minimum share of an Orbit's statements needed before a metric is reported */
  minEvidenceShare: number;
}

export const V10_PROVISIONAL: EngineConfig = {
  id: "v10-provisional-2026-10-12",
  contentVersion: "v10",
  status: "proposed",
  scale: { truthMax: 4, importanceMax: 4, energyMin: -2, energyMax: 2 },
  // spec: 80 / 20 — revealed component undefined in V10 (M2), so disabled.
  importance: { stated: 0.8, revealed: 0.2, revealedEnabled: false },
  // spec
  vitality: { reality: 0.55, relationship: 0.45 },
  // spec
  congruence: { agency: 0.45, relationship: 0.4, selfCongruence: 0.15 },
  attention: {
    importance: 0.35, // spec
    vitalityGap: 0.25, // spec
    disconnection: 0.2, // spec
    leverage: 0.2, // spec
    modifiers: { energyDrain: 0.05, priorityMismatch: 0.05, crowdedOut: 0.05 }, // proposed (M5)
  },
  // proposed (M1)
  constructMap: {
    "mind.01": "agency", "mind.02": "relationship", "mind.03": "relationship", "mind.04": "agency",
    "mind.05": "reality", "mind.06": "relationship", "mind.07": "innerState",
    "body.01": "reality", "body.02": "reality", "body.03": "reality", "body.04": "relationship",
    "body.05": "innerState", "body.06": "relationship", "body.07": "innerState",
    "restoration.01": "reality", "restoration.02": "reality", "restoration.03": "agency",
    "restoration.04": "reality", "restoration.05": "relationship", "restoration.06": "innerState",
    "growth.01": "reality", "growth.02": "relationship", "growth.03": "innerState",
    "growth.04": "agency", "growth.05": "relationship", "growth.06": "agency",
    "love.01": "relationship", "love.02": "agency", "love.03": "reality",
    "love.04": "relationship", "love.05": "relationship", "love.06": "innerState",
    "social.01": "reality", "social.02": "reality", "social.03": "relationship", "social.04": "reality",
    "social.05": "agency", "social.06": "innerState", "social.07": "relationship",
    "resources.01": "relationship", "resources.02": "reality", "resources.03": "reality",
    "resources.04": "agency", "resources.05": "agency", "resources.06": "reality",
    "joy.01": "reality", "joy.02": "innerState", "joy.03": "reality",
    "joy.04": "agency", "joy.05": "relationship", "joy.06": "agency",
  },
  // proposed (M3): authenticity / authorship items
  selfCongruenceItems: ["mind.03", "growth.05", "love.01", "love.05", "social.03", "joy.05"],
  // proposed (M4): the nine facets named in the Appendix
  sunFacets: {
    "Self-knowledge": ["sun.01"],
    Honesty: ["sun.02"],
    "Inner communication": ["sun.03"],
    "Self-trust": ["sun.04"],
    "Self-respect": ["sun.05", "sun.09"],
    "Self-loyalty": ["sun.06"],
    Responsibility: ["sun.07", "sun.08"],
    Care: ["sun.10"],
    Meaning: ["sun.11"],
  },
  minEvidenceShare: 0.5,
};
