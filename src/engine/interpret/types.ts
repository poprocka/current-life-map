/**
 * Interpretation records, schema v1 (approved 15 Oct). The same schema a future AI synthesis layer would fill, so both
 * pass the same validation and the page, PDF and Coach Report read one stored structure.
 */
import type { Area, Evidence } from "@/engine/narrative/types";
import type { ModuleId } from "./distinctions";

export const RECORD_SCHEMA_VERSION = "interpretation-record-1";

/** Where a reading may live. Each reading gets exactly one home. */
export type Home = "overview" | "support" | "tension" | "energy" | "begin" | "sun" | "connections" | "standsOut";
export type Discovery = "recognition" | "connection" | "reframing" | "distinction" | "possibility";
export type Kind = "strength" | "tension" | "mixed" | "neutral";
export type QuestionIntent = "values" | "preserve" | "tolerate" | "postpone" | "energy" | "trade-off" | "learn" | "create" | "self";

export interface Reading {
  id: string;                    // `${relationship}:${reading}` (+ area) — stable for identical answers
  relationship: string;
  areas: Area[];
  kind: Kind;
  discovery: Discovery;
  homes: Home[];                 // preference order
  score: number;                 // prioritization (0..1+)
  modifiers: string[];           // modifiers that shaped this reading (specificity)
  module?: ModuleId;             // distinction module used, if any
  evidence: Evidence[];
  contradictions: Evidence[];
  sufficiency: "explicit" | "corroborated" | "single";
  distinctive: string;           // the answers that make this person's meaning differ from the broad pattern
  lens?: { name: string; type: "philosophy" | "theory" | "empirical" };
  /** Copy (second person). */
  heading: string;
  lead: string;                  // one-line card lead
  opening?: string;              // 1–2 sentences of lived reality, used only if this reading becomes the central thread
  observation: string;           // what is happening and connected (no restating answers as a list)
  meaning: string;               // what it might mean (a possibility)
  alternative: string;           // another reading
  why: string;                   // why it may matter
  question: { text: string; intent: QuestionIntent };
  closing?: string;              // closing question, if central
  /** Optional per-Orbit interpretation lines this reading can lend to the Orbit section. */
  orbitLines?: Partial<Record<string, string>>;
  /** For readings composed from a list (What Supports You): facts the composer can choose from, avoiding repeats. */
  facts?: { id: string[]; text: string }[];
}

export interface InterpretationRecord {
  schema: typeof RECORD_SCHEMA_VERSION;
  id: string;
  observation: string;
  evidence: Evidence[];
  areas: Area[];
  reasoning: string;
  distinctive: string;
  meaning: string;
  alternatives: string[];
  contradictions: Evidence[];
  sufficiency: Reading["sufficiency"];
  lens: Reading["lens"] | null;
  question: Reading["question"];
  section: Home | "orbit" | "central";
  audience: "public" | "coach";
  module: ModuleId | null;
}

export interface ValidationLog { checked: number; removed: { text: string; reason: string }[]; warnings: string[] }
