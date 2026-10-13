/**
 * Shared reading of one answer set: labels, keyed values, F6 comparison groups and helpers.
 * Everything downstream reads answers through this, so every claim can name the question it rests on.
 */
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { itemEvidence } from "@/engine/compute";
import { QUESTION_BANK, questionById } from "@/content/v10/question-bank";
import type { AnswerValue, OrbitId } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { PHRASES } from "@/engine/coach/phrases";
import type { Area, Evidence } from "./types";

export type Answers = Record<string, AnswerValue | undefined>;

/** F6 (Decision Guide): differences smaller than this are described as similar. */
export const F6_TOLERANCE = 0.1;

export const NAMES: Record<OrbitId, string> = { mind: "Mind", body: "Body", restoration: "Restoration", growth: "Growth", love: "Love", social: "Social World", resources: "Resources", joy: "Joy" };

/**
 * PROPOSED (needs Jana's approval) — tone of each feeling, used ONLY to choose wording ("these states can
 * coexist" vs. "this area feels alive"). Never scored, never shown as a label, never changes the Map.
 */
export const EMOTION_TONE: Record<OrbitId, { expansive: string[]; ambivalent: string[]; strained: string[] }> = {
  mind: { expansive: ["clarity", "peace", "curiosity", "confidence", "openness"], ambivalent: ["neutrality"], strained: ["busyness", "unease", "rumination", "pressure", "distraction", "fatigue"] },
  body: { expansive: ["strength", "energy", "capability", "ease", "connection"], ambivalent: ["neutrality"], strained: ["self-consciousness", "frustration", "tension", "depletion", "criticism", "disconnection"] },
  restoration: { expansive: ["restfulness", "calm", "softness", "replenishment", "care", "spaciousness"], ambivalent: [], strained: ["restlessness", "rush", "overload", "depletion", "guilt", "exhaustion"] },
  growth: { expansive: ["curiosity", "inspiration", "excitement", "capability", "hope", "momentum"], ambivalent: ["stretch", "uncertainty"], strained: ["impatience", "stagnation", "intimidation", "overwhelm"] },
  love: { expansive: ["connection", "safety", "desire", "tenderness", "aliveness", "ease"], ambivalent: ["longing", "uncertainty"], strained: ["loneliness", "frustration", "guardedness", "resentment"] },
  social: { expansive: ["connection", "support", "belonging", "recognition", "energy", "ease"], ambivalent: ["stretch"], strained: ["self-consciousness", "loneliness", "drain", "pressure", "displacement"] },
  resources: { expansive: ["security", "clarity", "capability", "freedom", "groundedness", "stability"], ambivalent: ["uncertainty"], strained: ["constraint", "pressure", "avoidance", "overwhelm", "fear"] },
  joy: { expansive: ["aliveness", "playfulness", "inspiration", "peace", "delight", "freedom"], ambivalent: [], strained: ["restlessness", "boredom", "guilt", "disconnection", "deprivation", "numbness"] },
};

/**
 * Wording for each feeling (draft for Jana's review). Used to describe what the person chose in natural language.
 * Never scored, never labelled positive or negative on the page; the tone list above only decides whether to add a
 * line acknowledging that different feelings can be present at once.
 */
export const FEELING_PHRASES: Record<string, string> = {
  clarity: "a sense of clarity", peace: "a sense of peace", curiosity: "curiosity", confidence: "confidence", openness: "openness",
  neutrality: "a kind of neutrality", busyness: "a lot of busyness", unease: "some unease", rumination: "thoughts that keep circling",
  pressure: "pressure", distraction: "distraction", fatigue: "fatigue",
  strength: "strength", energy: "energy", capability: "a sense of capability", ease: "ease", connection: "connection",
  "self-consciousness": "self-consciousness", frustration: "frustration", tension: "tension", depletion: "depletion", criticism: "criticism", disconnection: "disconnection",
  restfulness: "restfulness", calm: "calm", softness: "softness", replenishment: "replenishment", care: "care", spaciousness: "spaciousness",
  restlessness: "restlessness", rush: "a sense of rush", overload: "overload", guilt: "guilt", exhaustion: "exhaustion",
  inspiration: "inspiration", excitement: "excitement", hope: "a sense of hope", momentum: "momentum", stretch: "a sense of stretch",
  uncertainty: "uncertainty", impatience: "impatience", stagnation: "a sense of stagnation", intimidation: "intimidation", overwhelm: "moments of overwhelm",
  safety: "safety", desire: "desire", tenderness: "tenderness", aliveness: "aliveness", longing: "longing", loneliness: "loneliness",
  guardedness: "guardedness", resentment: "resentment",
  support: "support", belonging: "belonging", recognition: "recognition", drain: "a sense of drain", displacement: "displacement",
  security: "security", freedom: "freedom", groundedness: "groundedness", stability: "stability", constraint: "constraint", avoidance: "avoidance", fear: "fear",
  playfulness: "playfulness", delight: "delight", boredom: "boredom", deprivation: "deprivation", numbness: "numbness",
};
export const COEXIST_LINES = ["Both can be present at once.", "Neither cancels the other out.", "That mix is common when something matters and also asks a lot."];

export const list = (xs: string[]) => {
  if (xs.length <= 1) return xs.join("");
  const sep = xs.some((x) => x.includes(",")) ? "; " : ", ";
  return `${xs.slice(0, -1).join(sep)}${sep === "; " ? "; and " : " and "}${xs[xs.length - 1]}`;
};
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const isAre = (n: number) => (n > 1 ? "are" : "is");

/** Third-person coach phrases → second person. */
export function toYou(s: string) {
  return s.replace(/\bthemselves\b/g, "yourself").replace(/\btheir\b/g, "your").replace(/\bthey\b/g, "you").replace(/\bthem\b/g, "you");
}

/** Small deterministic hash → variant choice. Identical answers always choose the same wording. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const pick = <T,>(xs: T[], seed: string): T => xs[hash(seed) % xs.length];

export function makeContext(result: LifeMapResult, answers: Answers) {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o])) as Record<OrbitId, OrbitResult>;
  const ic = result.interconnections;
  const label = (id: string) => {
    const a = answers[id]; if (a === undefined) return "Not answered";
    const q = questionById(id);
    if (Array.isArray(a)) return a.map((v) => q?.options.find((o) => o.value === v)?.label ?? v).join(", ");
    return a === NOT_APPLICABLE ? "Not applicable" : q?.options.find((o) => o.value === a)?.label ?? String(a);
  };
  const ev = (id: string): Evidence => ({ questionId: id, answer: label(id) });
  const keyed = (id: string) => itemEvidence(id, answers[id]).keyed;
  const answered = (id: string) => itemEvidence(id, answers[id]).status === "answered";
  const high = (id: string) => (keyed(id) ?? -1) >= 0.75;
  const low = (id: string) => { const k = keyed(id); return k !== null && k <= 0.25; };
  const statements = (o: Area) => QUESTION_BANK.filter((q) => q.chapterId === o && q.responseType === "truth" && q.enabled && q.measure !== "congruence").map((q) => q.id);
  const reverse = (id: string) => !!questionById(id)?.reverseKeyed;
  /** Strength phrasing of an item, second person. */
  const capOf = (id: string) => toYou(PHRASES[id]?.cap ?? questionById(id)?.prompt ?? id);
  /** Low-item phrasing: friction items name the difficulty; others say the capacity "feels less true". */
  const lowPhrase = (ids: string[]) => {
    const caps = ids.filter((i) => !(reverse(i) && PHRASES[i]?.friction)).map(capOf);
    const fr = ids.filter((i) => reverse(i) && PHRASES[i]?.friction).map((i) => toYou(PHRASES[i].friction!));
    return [caps.length ? `${list(caps)} ${caps.length > 1 ? "feel" : "feels"} less true for you right now` : "", fr.length ? `you describe ${list(fr)}` : ""].filter(Boolean).join(", and ");
  };
  /** "What you shared": one answer in plain words, quoting the question. */
  const plain = (e: Evidence) => {
    const q = questionById(e.questionId);
    if (!q) return e.answer;
    const area = q.chapterId === "sun" ? "your relationship with yourself" : NAMES[q.chapterId as OrbitId];
    if (q.responseType === "importance") return `How important ${area} is to you: ${e.answer}`;
    if (q.responseType === "energy") return `What ${area} does to your energy: ${e.answer}`;
    if (q.responseType === "emotional_state") return `Feelings you chose for ${area}: ${e.answer.toLowerCase()}`;
    if (q.responseType === "orbit_select" || q.responseType === "single_choice") return `${q.prompt} ${e.answer}`;
    return `“${q.prompt}”${q.measure === "congruence" ? ` (${area})` : ""} — ${e.answer}`;
  };
  const imp = (o: OrbitId) => by[o].importanceDirect;
  const impLabel = (o: OrbitId) => label(`${o}.importance`).toLowerCase();
  const energy = (o: OrbitId) => by[o].energyRaw; // 1 gives a lot … 5 drains a lot
  const gives = (o: OrbitId) => (energy(o) ?? 3) <= 2;
  const takes = (o: OrbitId) => (energy(o) ?? 3) >= 4;
  const important = (o: OrbitId) => (imp(o) ?? 0) >= 0.75;
  const unimportant = (o: OrbitId) => imp(o) !== null && imp(o)! <= 0.25;

  const sufficient = result.orbits.filter((o) => o.supportConfidence === "sufficient" && o.responseSupportIndex !== null);
  const idx = sufficient.map((o) => o.responseSupportIndex!);
  const spread = sufficient.length >= 2 ? Math.max(...idx) - Math.min(...idx) : 0;
  const top = spread >= F6_TOLERANCE ? sufficient.filter((o) => Math.max(...idx) - o.responseSupportIndex! < F6_TOLERANCE / 2).map((o) => o.orbit) : [];
  const bottom = spread >= F6_TOLERANCE ? sufficient.filter((o) => o.responseSupportIndex! - Math.min(...idx) < F6_TOLERANCE / 2).map((o) => o.orbit) : [];
  const lessSupported = (o: OrbitId) => bottom.includes(o) || (by[o].supportConfidence === "sufficient" && (by[o].responseSupportIndex ?? 1) <= 0.35);
  const moreSupported = (o: OrbitId) => top.includes(o) || (by[o].supportConfidence === "sufficient" && (by[o].responseSupportIndex ?? 0) >= 0.75);
  const supportEv = (o: OrbitId): Evidence[] => statements(o).filter((i) => answered(i)).map(ev);

  const feelings = (o: OrbitId) => list(by[o].emotions.map((e) => FEELING_PHRASES[e.id] ?? e.label.toLowerCase()));
  const tones = (o: OrbitId) => {
    const t = EMOTION_TONE[o];
    const ids = by[o].emotions.map((e) => e.id);
    return {
      expansive: by[o].emotions.filter((e) => t.expansive.includes(e.id)),
      ambivalent: by[o].emotions.filter((e) => t.ambivalent.includes(e.id)),
      strained: by[o].emotions.filter((e) => t.strained.includes(e.id)),
      ids,
    };
  };

  const maxImp = Math.max(...result.orbits.map((o) => o.importanceDirect ?? -1));
  const mostImportant = maxImp >= 0.5 ? result.orbits.filter((o) => o.importanceDirect === maxImp).map((o) => o.orbit) : [];
  /** A short, stable seed of this answer set for wording variation. */
  // Only approved question ids count, so anything else attached to a record (e.g. a future, separate demographics
  // form) can never change the wording. Identical answers → identical interpretation.
  const seed = Object.keys(answers).filter((k) => questionById(k)?.enabled).sort().map((k) => `${k}=${String(answers[k])}`).join("|");

  return {
    result, answers, by, ic, label, ev, keyed, answered, high, low, statements, reverse, capOf, lowPhrase,
    imp, impLabel, energy, gives, takes, important, unimportant, sufficient, spread, top, bottom,
    lessSupported, moreSupported, supportEv, tones, feelings, mostImportant, seed, plain,
    name: (o: OrbitId) => NAMES[o],
  };
}
export type Ctx = ReturnType<typeof makeContext>;
