import type { ResponseOption } from "../types";

// Exact V10 wording — "Response scales"
export const TRUTH_SCALE: ResponseOption[] = [
  { value: "0", label: "Not true for me" },
  { value: "1", label: "Somewhat true" },
  { value: "2", label: "Mostly true" },
  { value: "3", label: "Very true" },
  { value: "4", label: "Completely true" },
];

export const IMPORTANCE_SCALE: ResponseOption[] = [
  { value: "0", label: "Not important right now" },
  { value: "1", label: "Slightly important" },
  { value: "2", label: "Moderately important" },
  { value: "3", label: "Very important" },
  { value: "4", label: "One of my highest priorities" },
];

// V10 order preserved (energy-giving first). Values are signed: +2 gives most, -2 drains most.
export const ENERGY_SCALE: ResponseOption[] = [
  { value: "2", label: "Gives me a lot of energy and makes me feel alive" },
  { value: "1", label: "Gives me more energy than it takes" },
  { value: "0", label: "Keeps my energy fairly stable" },
  { value: "-1", label: "Takes more energy than it gives" },
  { value: "-2", label: "Drains a lot of my energy" },
];

// Life Interconnections Q7 — V10 "proposed answer options"
export const SUPPORT_COMPETE_OPTIONS: ResponseOption[] = [
  { value: "strongly_compete", label: "They strongly compete" },
  { value: "somewhat_compete", label: "They somewhat compete" },
  { value: "mix", label: "A mix of both" },
  { value: "mostly_support", label: "They mostly support each other" },
  { value: "strongly_support", label: "They strongly support each other" },
];

export const NOT_APPLICABLE_LABEL = "Not applicable to my current life";

/** Plain reading of Life Interconnections Q7 for the results (Jana, 2026-10-15: simpler, still insightful). */
export const SUPPORT_COMPETE_READING: Record<string, string> = {
  strongly_support: "You see the parts of your life as strongly supporting each other: when one area does well, the others tend to benefit too.",
  mostly_support: "You see the parts of your life as mostly supporting each other: progress in one area tends to carry into the others.",
  mix: "You see the parts of your life as both helping and competing: some areas lift each other, while others pull on the same time and energy.",
  somewhat_compete: "You see the parts of your life as somewhat competing: some areas pull on the same time and energy.",
  strongly_compete: "You see the parts of your life as strongly competing: giving more to one area often means giving less to another.",
};
