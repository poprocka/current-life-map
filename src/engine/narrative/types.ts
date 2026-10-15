/**
 * Results narrative — structured output schema with evidence provenance.
 *
 * Public Current Life Map: "Here's what your answers reveal about the life you're living."
 * (The private Coach Report is a separate, deeper document: "Here's what Jana may want to explore with this
 * person, what the evidence supports, and what still needs to be understood." It never reads from this file.)
 */
import type { OrbitId } from "@/content/types";

export type Area = OrbitId | "sun";

/** One answer that supports (or counts against) an observation. Always a real question id + the answer label. */
export interface Evidence { questionId: string; answer: string }

/** Where an observation may appear on the results page. */
export type Destination =
  | "opening" | "map" | "standsOut" | "self" | "connections"
  | "card.overview" | "card.support" | "card.tension" | "card.energy" | "card.begin"
  | "orbit" | "closing";

/**
 * How much the evidence can carry:
 *  - explicit: the person said it directly (a Life Interconnections choice or a single direct answer restated)
 *  - corroborated: two or more answers point the same way
 *  - comparative: an approved relative comparison (F6: differences < 0.10 are "similar")
 *  - single: one supportive answer only — worded tentatively and never used for a cross-Orbit claim
 */
export type Sufficiency = "explicit" | "corroborated" | "comparative" | "single";

/** Wording strength: restate what they said · suggest a pattern · wonder aloud (hypothesis). */
export type Wording = "state" | "suggest" | "wonder";

export type Valence = "strength" | "tension" | "mixed" | "neutral";

/** Intermediate object: one candidate observation, before selection and copy assembly. */
export interface Observation {
  id: string;                 // `${rule}:${areas}` — unique and stable for identical answers
  rule: string;               // rule id from the library (see rules.ts → RULES)
  family: string;             // theme family, used for opening/closing selection
  areas: Area[];
  evidence: Evidence[];
  counterEvidence: Evidence[];
  sufficiency: Sufficiency;
  wording: Wording;
  valence: Valence;
  /** Plausible alternative readings, shown or used as the "that doesn't necessarily mean…" line. */
  alternatives: string[];
  /** What this might mean for their lived experience — tentative, limited to what the evidence supports. */
  meaning: string;
  relevance: number;          // 0..1 — relevance × specificity × evidence quality × usefulness
  destinations: Destination[];
  /** Copy, second person. `text` is a full observation; `clause` a short form for synthesis (no full stop). */
  text: string;
  clause: string;
  /** Optional reflection question tied to this observation. */
  question?: string;
  /** Cross-Orbit only: observed together vs. described by them as influencing each other. */
  link?: "co-occurrence" | "stated-influence";
}

/** A rendered paragraph with the observations and answers it rests on. */
export interface Para { text: string; observationIds: string[]; evidence: Evidence[] }

export interface NarrativeSection { key: string; title: string; paragraphs: Para[]; fallback: boolean }

export interface InsightSection { id: string; heading: string; text: string; meaning?: string; evidence: Evidence[]; claim: "direct" | "derived" | "tentative"; observationId?: string }
/** The five steps of a major insight (approved 13 Oct). */
export interface MajorInsight { shared: string[]; pattern: string; meaning: string; alternative: string; question: string; observationId: string }

/** The central theme: the strongest cluster of observations, built from several responses. */
export interface CentralTheme { kind: string; anchor: Area | null; observationIds: string[]; responses: Evidence[]; shared: string[] }

export interface InsightCard {
  key: "overview" | "support" | "tension" | "energy" | "begin";
  title: string;           // approved UI heading (kept)
  purpose: string;         // working content category from the brief
  lead: string;            // personalised opening line
  sections: InsightSection[]; // 1–3 observations
  why: string;             // why the pattern may matter
  question: string;        // one reflection question
  fallback: boolean;
  /** The card's first observation, in five steps. */
  major?: MajorInsight;
}

export interface OrbitNarrative { orbit: OrbitId; name: string; paragraphs: string[]; question: string; evidence: Evidence[] }

export interface ReflectionLayerItem { questionId: string; prompt: string; text: string; alongside?: { text: string; evidence: Evidence[] } }
export interface ReflectionLayer { note: string; items: ReflectionLayerItem[] }

export interface ResultNarrative {
  templateVersion: string;
  versions: { scoring: string; questionBank: string };
  opening: NarrativeSection & { major: MajorInsight | null };        // A · Your reality, as it is right now
  centralTheme: CentralTheme | null;
  mapIntro: string;                 // B · conversational introduction
  mapReading: NarrativeSection;     // B · what is distinctive about this Map
  standsOut: NarrativeSection;      // C · connected Reality Snapshot narrative
  self: NarrativeSection & { question: string | null };   // D · relationship with yourself
  connections: NarrativeSection;    // E · your life is interconnected
  cards: InsightCard[];             // F · five cards
  orbits: OrbitNarrative[];         // G · eight Orbits
  closingQuestion: { text: string; theme: string; observationId: string | null; evidence: Evidence[] }; // H
  deepDiveBridge: string;           // §9 — the line that introduces the optional Deep Dive
  /** Every candidate with where it was used. Saved in the backend; never shown as such. */
  observations: (Observation & { usedIn: Destination[] })[];
  /** Back-compat alias for the earlier field name. */
  questionToTakeWithYou: { text: string; theme: string };
}
