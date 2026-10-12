export type ContentVersion = "v10";

export type OrbitId =
  | "mind"
  | "body"
  | "restoration"
  | "growth"
  | "love"
  | "social"
  | "resources"
  | "joy";

export type ChapterId = "sun" | OrbitId | "interconnections";

export type ChapterKind = "sun" | "orbit" | "interconnections";

export interface Chapter {
  id: ChapterId;
  kind: ChapterKind;
  /** Display name, e.g. "Mind" */
  name: string;
  /** e.g. "Awareness & Identity" */
  subtitle: string;
  description: string;
  reflectionCue: string;
  /** Explore categories exactly as listed in V10 */
  explores: string[];
}

export type ResponseType =
  | "truth"
  | "importance"
  | "energy"
  | "orbit_select"
  | "single_choice"
  | "emotional_state";

/** support: agreement = more of the capacity. friction: reverse-keyed. context: importance/energy/emotion. selection: interconnections. */
export type ResponseDirection = "support" | "friction" | "context" | "selection";

export interface ResponseOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  version: ContentVersion;
  chapterId: ChapterId;
  /** 1-based order within its chapter as in V10 (importance/energy follow statements) */
  order: number;
  prompt: string;
  /** Small helper line shown under the prompt, e.g. "Choose up to 3." */
  instruction?: string;
  responseType: ResponseType;
  options: ResponseOption[];
  /** Explore category this item investigates (derived from cue construct; see audit C10) */
  exploreCategory: string;
  cue: { construct: string; signal: string; text: string };
  direction: ResponseDirection;
  reverseKeyed: boolean;
  optional: boolean;
  /** Love items only (audit C4) */
  allowNotApplicable: boolean;
  /** For emotional_state: max selections */
  maxSelections?: number;
  /** False = defined in the model but not shown (blocked content dependency) */
  enabled: boolean;
  interpretationNotes?: string;
  /** Open questions about this item, surfaced in admin and tests */
  needsConfirmation?: string[];
}

export type AnswerValue = string | string[];
export const NOT_APPLICABLE = "__not_applicable__";
