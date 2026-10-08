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
