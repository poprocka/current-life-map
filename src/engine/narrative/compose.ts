/**
 * Selection and assembly: turns ranked observations into the results narrative.
 * The opening synthesises; the sections and cards deepen; the Orbit paragraphs give detail.
 * An observation's text is used verbatim in one place only.
 */
import { questionById } from "@/content/v10/question-bank";
import { CONGRUENCE_ITEMS } from "@/engine/congruence";
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { type Ctx, COEXIST_LINES, cap, list, pick } from "./context";
import { energyWords } from "./rules";
import type { CentralTheme, Destination, Evidence, InsightCard, InsightSection, MajorInsight, NarrativeSection, Observation, OrbitNarrative, Para } from "./types";

export const DEEP_DIVE_BRIDGE =
  "There's only so much a Self-Interview can reveal on its own. Some patterns become clearer when you have the space to talk them through, question your assumptions and explore what they mean for the life you want to create.";
export const MAP_INTRO_CONVERSATIONAL = "Here's how the different parts of your life look together, based on what you've shared.";

export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const para = (text: string, os: Observation[] = [], extra: Evidence[] = []): Para => ({
  text, observationIds: os.map((o) => o.id), evidence: dedupeEv([...os.flatMap((o) => o.evidence), ...extra]),
});
function dedupeEv(xs: Evidence[]) { const s = new Set<string>(); return xs.filter((e) => (s.has(e.questionId) ? false : (s.add(e.questionId), true))); }
const areasOverlap = (a: Observation, b: Observation) => a.areas.some((x) => b.areas.includes(x));

export class Allocation {
  /** Observations whose text has been used (once only). */
  used = new Map<string, Destination[]>();
  /** Observations whose facts were referenced in other words (text still available to deepen elsewhere). */
  mentioned = new Map<string, Destination[]>();
  constructor(public all: Observation[]) {}
  take(o: Observation, d: Destination) { this.used.set(o.id, [...(this.used.get(o.id) ?? []), d]); return o; }
  free(d: Destination, filter: (o: Observation) => boolean = () => true) {
    return this.all.filter((o) => o.destinations.includes(d) && !this.used.has(o.id) && filter(o));
  }
  ref(os: Observation[], d: Destination) { for (const o of os) this.mentioned.set(o.id, [...(this.mentioned.get(o.id) ?? []), d]); }
  usedIn(id: string): Destination[] { return [...new Set([...(this.used.get(id) ?? []), ...(this.mentioned.get(id) ?? [])])]; }
}

// ── A · Opening ─────────────────────────────────────────────────────────────
const INTRO: Record<string, string[]> = {
  self: ["Before looking at the eight areas of your life, something stands out in how you relate to yourself."],
  "well-supported": ["Your answers describe a life that, in many places, is working."],
  several: ["There's a lot happening in your life right now."],
  centre: ["One area runs through many of your answers."],
  default: ["Looking at your answers, something stands out.", "There's something interesting in the way your life is organised right now.", "One thing stands out across your answers."],
};
const CURIOSITY: Record<string, (o: Observation, c: Ctx) => string> = {
  "asks-gives": (o, c) => `The more useful question may not be whether ${c.name(o.areas[0] as OrbitId)} asks too much, but whether the exchange still feels like one you're choosing.`,
  "priority-gap": () => "It may be worth noticing whether that gap feels like a choice you've made for now, or something that has simply happened.",
  tradeoff: () => "It may be worth asking whether that trade-off is one you'd choose again for this season.",
  "ambition-restoration": () => "The more interesting question might be whether the way you're moving forward is also supporting the person you're becoming.",
  self: () => "How you treat yourself tends to shape every Orbit around you, so this may be a quiet thread worth following.",
  expectations: () => "It may be worth asking which parts of it feel truly yours.",
  permission: () => "It may be worth noticing when you give yourself permission, and when you don't.",
  standards: () => "It may be worth noticing what happens to your own care when the pressure rises.",
  "status-quo": () => "It may be worth asking what keeping things familiar is protecting, and what it might be costing.",
  several: () => "You don't need to address everything at once. The Map may simply help you see where your attention would matter most to you.",
  "well-supported": () => "That's worth acknowledging before looking for anything to change. It may be more useful to notice what's making this work, so you can protect it when life gets busier.",
  energy: () => "An area can be demanding and meaningful at the same time; the question is whether the cost still feels worth it.",
  leverage: () => "That instinct about where change would ripple outward is worth taking seriously.",
  mixed: () => "Mixed answers are often the most honest ones.",
  centre: (o, c) => `It may be worth noticing how much of your life is currently organised around ${c.name(o.areas[0] as OrbitId)}, and whether that still feels like your choice.`,
  neutral: () => "Sometimes the most interesting part of a Map isn't an extreme, but the places where things are quietly mixed.",
};

/** First sentence of an observation (the opening keeps only the core of the pattern). */
const firstSentence = (t: string) => (t.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t).trim();
/** The pattern in one sentence; when its first sentence doesn't reach the area the Map sentence reads, the short clause does. */
function patternSentence(o: Observation, area: string | undefined): string {
  const first = firstSentence(o.text);
  if (!area || area === "sun" || !o.clause || first.toLowerCase().includes(area.toLowerCase())) return first;
  return `${o.clause.charAt(0).toUpperCase()}${o.clause.slice(1)}.`;
}
/**
 * One sentence that reads the theme's Orbit on the Map: size, brightness, distance, energy (at most three).
 * Opening summary rule (Jana, 2026-10-15): 2–3 sentences only — the pattern, how it shows on the Map, one question.
 * The full picture follows in the sections below.
 */
function mapSummary(c: Ctx, area: string | undefined): string {
  const orbits = ORBIT_IDS as OrbitId[];
  if (area && (orbits as string[]).includes(area)) {
    const o = area as OrbitId, d: string[] = [];
    if (c.mostImportant.length === 1 && c.mostImportant[0] === o) d.push("is your largest Orbit");
    else if (c.important(o)) d.push("is one of your largest Orbits");
    if (c.lessSupported(o)) d.push("appears dimmer");
    else if (c.moreSupported(o)) d.push("glows brightly");
    const band = c.by[o].distanceBand;
    const far = orbits.filter((x) => c.by[x].distanceBand === "far");
    if (band === "far") d.push(far.length === 1 ? "sits furthest from the Sun" : "sits further from the Sun");
    else if (band === "close") d.push("sits close to the Sun");
    if (d.length < 3 && c.takes(o)) d.push("takes more energy than it gives");
    else if (d.length < 3 && c.gives(o)) d.push("gives you energy back");
    if (d.length) return `On your Map, ${c.name(o)} ${list(d.slice(0, 3))}.`;
  }
  const giving = orbits.filter(c.gives), taking = orbits.filter(c.takes);
  if (giving.length && taking.length) return `On your Map, energy flows in from ${list(giving.map(c.name))} and out toward ${list(taking.map(c.name))}.`;
  const m = c.mostImportant.slice(0, 3);
  return m.length ? `On your Map, ${list(m.map(c.name))} ${m.length > 1 ? "are the largest Orbits" : "is the largest Orbit"}.` : "";
}

export function composeOpening(c: Ctx, A: Allocation): NarrativeSection & { lead: Observation | null } {
  const candidates = A.free("opening");
  const lead = candidates[0] ?? null;
  if (!lead) {
    // Fallback: a synthesis of what matters and what gives energy, never a list of numbers.
    const top = c.mostImportant.slice(0, 3).map(c.name);
    const src = c.ic.largestSource ? c.name(c.ic.largestSource) : null;
    const text = [
      "Your answers don't point to one simple story, and that is useful in itself.",
      top.length ? `${list(top)} ${top.length > 1 ? "are" : "is"} what matters most to you right now${src ? `, and ${src} is where your energy comes back` : ""}.` : src ? `${src} is where your energy comes back.` : "",
    ].filter(Boolean).join(" ");
    return { key: "opening", title: "Your reality, as it is right now", paragraphs: [para(text, [], [...c.mostImportant.map((o) => c.ev(`${o}.importance`)), ...(c.ic.largestSource ? [c.ev("interconnections.02")] : [])]), para(CURIOSITY.neutral(null as never, c))], fallback: true, lead: null };
  }
  A.ref([lead], "opening"); // summarised here; the full reading stays available to the sections below (15 Oct)
  const curiosity = (CURIOSITY[lead.family] ?? CURIOSITY.neutral)(lead, c);
  const summary = [patternSentence(lead, lead.areas[0]), mapSummary(c, lead.areas[0])].filter(Boolean).join(" ");
  return { key: "opening", title: "Your reality, as it is right now", paragraphs: [para(summary, [lead]), para(curiosity)], fallback: false, lead };
}


// ── Central theme (approved 13 Oct) ─────────────────────────────────────────
/** Descriptive observations: true but rarely the point. They step back when a central theme exists. */
export const DESCRIPTIVE = new Set(["priority.top", "support.similar", "support.contrast", "support.top", "energy.balance", "link.overall"]);
const LEAD_ORDER = ["centre.roles", "energy.same", "link.ambition-restoration", "link.demand-crowded", "priority.gap", "alignment.priority-gap", "alignment.expectations",
  "link.familiar", "link.permission", "link.standards-care", "self.contrast", "self.values-living", "energy.meaningful-demand", "contrast.feelings-statements"];

/** Supporting answers that add something new come first: the person's own choices and cross-area links. */
const SUPPORT_ORDER = ["link.leverage", "link.familiar", "link.permission", "link.standards-care", "link.demand-crowded", "link.body-mind", "alignment.lived-values-low",
  "priority.gap", "alignment.priority-gap", "alignment.expectations", "energy.meaningful-demand", "contrast.feelings-statements", "link.ambition-restoration"];
const supRank = (o: Observation) => { const i = SUPPORT_ORDER.indexOf(o.rule); return i < 0 ? (o.rule.startsWith("emotion.") ? 99 : 50) : i; };

export interface Theme { lead: Observation; support: Observation[]; cluster: Observation[]; anchor: Observation["areas"][number]; responses: Evidence[] }

/**
 * Group observations around each area (each Orbit and the Sun). Score = distinct responses behind its non-strength readings + 1.5 × the
 * Life Interconnections roles the person gave that area + 2 when the cluster holds a tension or mixed reading
 * + 3 × its strongest relevance. The best cluster with 3+ distinct responses becomes the central theme.
 * A well-supported Map with no tension keeps "well supported" as its theme; nothing is manufactured.
 */
export function buildTheme(c: Ctx, all: Observation[]): Theme | null {
  const ic = c.ic;
  const roleCount = (o: string) => [ic.largestDemand, ic.largestSource, ic.leverageSelection, ic.crowdedOut, ic.priorityGap, ic.externalInfluence].filter((x) => x === o).length;
  const candidates = [...(ORBIT_IDS as OrbitId[]), "sun" as const].map((anchor) => {
    const cluster = all.filter((o) => o.areas.includes(anchor) && !DESCRIPTIVE.has(o.rule) && !o.rule.startsWith("pattern."));
    // Strengths support a theme but don't make one: only non-strength readings count towards its weight.
    const ids = new Map<string, Evidence>();
    for (const o of cluster) if (o.valence !== "strength") for (const e of o.evidence) if (!ids.has(e.questionId)) ids.set(e.questionId, e);
    const tense = cluster.some((o) => o.valence === "tension" || o.valence === "mixed");
    const score = ids.size + 1.5 * (anchor === "sun" ? 0 : roleCount(anchor)) + (tense ? 2 : 0) + 3 * Math.max(0, ...cluster.map((o) => o.relevance));
    return { anchor, cluster, responses: [...ids.values()], tense, score };
  }).filter((x) => x.responses.length >= 3 && x.tense && x.cluster.length >= 2).sort((a, b) => b.score - a.score);
  const wellSupported = all.find((o) => o.rule === "pattern.well-supported");
  const best = candidates[0];
  if (!best || (wellSupported && !best.cluster.some((o) => o.valence === "tension") && best.score < 9)) {
    if (!wellSupported) return null;
    const strengths = all.filter((o) => o.valence === "strength" && o !== wellSupported).slice(0, 2);
    return { lead: wellSupported, support: strengths, cluster: [wellSupported, ...strengths], anchor: wellSupported.areas[0] ?? "sun", responses: dedupeEv([...wellSupported.evidence, ...strengths.flatMap((o) => o.evidence)]) };
  }
  const rank = (o: Observation) => { const i = LEAD_ORDER.indexOf(o.rule); return i < 0 ? 99 : i; };
  const lead = [...best.cluster].sort((a, b) => rank(a) - rank(b) || b.relevance - a.relevance)[0];
  // The theme is anchored on the lead's own area; its cluster and responses are gathered around that area.
  const anchor = lead.rule === "centre.roles" ? lead.areas[0] : lead.areas.includes(best.anchor) ? best.anchor : lead.areas[0] ?? best.anchor;
  const cluster = all.filter((o) => o.areas.includes(anchor) && !DESCRIPTIVE.has(o.rule) && !o.rule.startsWith("pattern."));
  const leadIds = new Set(lead.evidence.map((e) => e.questionId));
  const seen = new Set([lead.rule]);
  const fresh = (o: Observation) => o.evidence.filter((e) => !leadIds.has(e.questionId)).length / Math.max(1, o.evidence.length);
  const support = cluster.filter((o) => o !== lead && fresh(o) > 1 / 3 && !(o.rule === "priority.strength" && o.areas.length > 2))
    .sort((a, b) => supRank(a) - supRank(b) || b.relevance - a.relevance)
    .filter((o) => (seen.has(o.rule) ? false : (seen.add(o.rule), true))).slice(0, 2);
  return { lead, support, cluster, anchor, responses: dedupeEv(cluster.flatMap((o) => o.evidence)) };
}

export function centralThemeOf(c: Ctx, t: Theme | null): CentralTheme | null {
  if (!t) return null;
  return { kind: t.lead.family, anchor: t.anchor, observationIds: t.cluster.map((o) => o.id), responses: t.responses, shared: t.responses.slice(0, 6).map(c.plain) };
}

export function majorOf(c: Ctx, o: Observation, question: string, extra: Evidence[] = []): MajorInsight {
  return { observationId: o.id, shared: dedupeEv([...o.evidence, ...extra]).slice(0, 4).map(c.plain), pattern: o.text, meaning: o.meaning, alternative: o.alternatives[0] ?? "", question };
}

/** Opening built from the central theme: the pattern with its supporting answers, what it might mean, an alternative, then curiosity. */
export function composeThemeOpening(c: Ctx, A: Allocation, t: Theme, closingQuestion: () => string): NarrativeSection & { lead: Observation; major: MajorInsight } {
  const { lead, support } = t;
  A.take(lead, "opening");
  // Opening summary (Jana, 2026-10-15): the pattern in one sentence, how it shows on the Map, then one question.
  const summary = [patternSentence(lead, t.anchor), mapSummary(c, t.anchor)].filter(Boolean).join(" ");
  const p3 = (CURIOSITY[lead.family] ?? CURIOSITY.neutral)(lead, c);
  const clauses = support.map((o) => o.clause.replace(/^[A-Z](?=[a-z])/, (m) => (/^(Mind|Body|Restoration|Growth|Love|Social|Resources|Joy)/.test(o.clause) ? m : m.toLowerCase())));
  const sameWay = support.every((o) => o.valence === lead.valence || (lead.valence !== "strength" && o.valence !== "strength"));
  const supportLine = !clauses.length ? "" : sameWay
    ? ` ${clauses.length > 1 ? "Other answers point the same way" : "Another answer points the same way"}: ${clauses.join(", and ")}.`
    : ` Alongside this, ${clauses.join(", and ")}.`;
  const major: MajorInsight = { observationId: lead.id, shared: t.responses.slice(0, 6).map(c.plain), pattern: [lead.text, supportLine.trim()].filter(Boolean).join(" "), meaning: lead.meaning, alternative: lead.alternatives[0] ?? "", question: closingQuestion() };
  return { key: "opening", title: "Your reality, as it is right now", fallback: false, lead, major,
    paragraphs: [para(summary, [lead]), para(p3)].filter((x) => x.text) };
}

// ── B · Map reading (visual relationships; distance is not interpreted while it is pending) ──
export function composeMapReading(c: Ctx, A: Allocation): NarrativeSection {
  const P: Para[] = [];
  const m = c.mostImportant;
  const maps = A.all.filter((o) => o.destinations.includes("map"));
  A.ref(maps, "map");
  const importantDim = (ORBIT_IDS as OrbitId[]).filter((o) => c.important(o) && c.lessSupported(o));
  const both = importantDim;
  const brightAndBig = m.filter((o) => c.top.includes(o) || c.moreSupported(o));
  if (m.length && m.length <= 4) {
    let s = m.length > 1
      ? `The largest Orbits on your Map are ${list(m.map(c.name))}, the areas you rated as most important right now.`
      : `The largest Orbit on your Map is ${c.name(m[0])}, the area you rated as most important right now.`;
    const dimLargest = m.filter((o) => both.includes(o)), dimOthers = both.filter((o) => !m.includes(o));
    if (brightAndBig.length) s += ` ${list(brightAndBig.map(c.name))} ${brightAndBig.length > 1 ? "glow" : "glows"} brightly too: what matters most to you appears well supported.`;
    if (dimLargest.length) s += ` ${dimLargest.length > 1 ? "They also appear" : `${c.name(dimLargest[0])} also appears`} dimmer: ${dimLargest.length > 1 ? "they matter" : "it matters"} a great deal, and your answers describe less support there.`;
    if (dimOthers.length) s += ` ${list(dimOthers.map(c.name))}, which you also rated as highly important, ${dimOthers.length > 1 ? "appear" : "appears"} dimmer${dimLargest.length ? " too" : ""}.`;
    if (both.length) s += " That combination of importance and lower support is often worth a closer look.";
    P.push(para(s, [], [...m, ...both].map((o) => c.ev(`${o}.importance`))));
  } else if (m.length >= 5) {
    P.push(para(`Many of your Orbits appear at a similar, generous size, because you rated many areas of your life as highly important.${both.length ? ` ${list(both.map(c.name))} ${both.length > 1 ? "appear" : "appears"} dimmer among them: important, and less supported in your answers.` : ""}`, [], m.map((o) => c.ev(`${o}.importance`))));
  }
  if (!both.length && !brightAndBig.length) {
    if (c.top.length && c.bottom.length)
      P.push(para(`${list(c.top.map(c.name))} ${c.top.length > 1 ? "glow" : "glows"} most brightly, because your answers describe more support there; ${list(c.bottom.map(c.name))} ${c.bottom.length > 1 ? "appear" : "appears"} dimmer by comparison.`, [], [...c.top, ...c.bottom].flatMap((o) => c.supportEv(o).slice(0, 1))));
    else if (c.sufficient.length >= 2)
      P.push(para("Brightness is fairly even across your Map: your answers describe a similar level of support in most areas.", [], c.sufficient.flatMap((o) => c.supportEv(o.orbit).slice(0, 1))));
  }
  const dist = composeDistance(c);
  if (dist) P.push(dist);
  const giving = (ORBIT_IDS as OrbitId[]).filter(c.gives), taking = (ORBIT_IDS as OrbitId[]).filter(c.takes);
  if (giving.length || taking.length)
    P.push(para(`${giving.length ? `Energy flows in from ${list(giving.map(c.name))}` : "None of your Orbits is marked as giving more energy than it takes"}${taking.length ? `${giving.length ? ", and out toward" : "; energy flows out toward"} ${list(taking.map(c.name))}.` : `${giving.length ? ", and none is marked as taking more than it gives." : "."}`}`, [], [...giving, ...taking].map((o) => c.ev(`${o}.energy`))));
  return { key: "map", title: "What stands out on your Map", paragraphs: P.slice(0, 4), fallback: !P.length };
}

/**
 * Distance from the Sun (F4, approved 13 Oct). Starts from Jana's approved band statements and personalises around them
 * with the person's own answers. Describes alignment without judgment: never "distant from yourself", never a problem by
 * default. A large Orbit placed far out keeps both signals. Mixed answers are named, not averaged away.
 */
export const DISTANCE_LINES = {
  close: "This area of your life appears to reflect what matters to you.",
  middle: "This area reflects some of what matters to you, while other parts may still be finding their place.",
  far: "The way you're currently living in this area may not fully reflect what matters to you.",
  insufficient: "We don't have enough information to understand how closely this area reflects what matters to you.",
} as const;
function composeDistance(c: Ctx): Para | null {
  const orbits = ORBIT_IDS as OrbitId[];
  if (orbits.every((o) => c.by[o].distanceBand == null) && !orbits.some((o) => c.answered(`${o}.congruence`))) return null;
  const band = (b: "close" | "middle" | "far") => orbits.filter((o) => c.by[o].distanceBand === b);
  const close = band("close"), middle = band("middle"), far = band("far");
  const none = orbits.filter((o) => c.by[o].distanceBand == null);
  const parts: string[] = [];
  const ev: Evidence[] = [];
  const are = (xs: OrbitId[]) => (xs.length > 1 ? "sit" : "sits");
  const N = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  const all = (xs: OrbitId[]) => xs.length === orbits.length;
  const one = (xs: OrbitId[], single: string, plural: string) => (xs.length > 1 ? plural : single);
  // Read the Map's shape first (Jana, 2026-10-15): when one or two Orbits stand apart from the rest, say so plainly
  // rather than listing every band. The band statements stay the approved ones.
  if (all(close)) {
    parts.push("All of your Orbits sit close to the Sun: across your life, the way you're living appears to reflect what matters to you.");
    ev.push(...close.map((o) => c.ev(`${o}.congruence`)));
  } else if (all(far)) {
    parts.push("All of your Orbits sit further out from the Sun: across much of your life, the way you're currently living may not fully reflect what matters to you.");
    ev.push(...far.map((o) => c.ev(`${o}.congruence`)));
  } else if (far.length >= 1 && far.length <= 2 && close.length >= 4) {
    const restAllClose = close.length + far.length === orbits.length;
    parts.push(`On your Map, ${list(far.map(c.name))} ${one(far, "stands", "stand")} apart: ${one(far, "it sits", "they sit")} furthest from the Sun, while ${restAllClose ? `the other ${N[close.length]} Orbits sit close together near it` : "most of the other Orbits sit close to it"}. Most areas of your life appear to reflect what matters to you. ${list(far.map(c.name))} ${one(far, "is", "are")} where the way you're currently living may not fully reflect it.`);
    if (middle.length) parts.push(`${list(middle.map(c.name))} ${are(middle)} at a middle distance: ${one(middle, "it reflects", "they reflect")} some of what matters to you, while other parts may still be finding their place.`);
    ev.push(...[...far, ...close, ...middle].map((o) => c.ev(`${o}.congruence`)));
  } else if (close.length >= 1 && close.length <= 2 && far.length >= 4) {
    const restAllFar = close.length + far.length === orbits.length;
    parts.push(`On your Map, ${list(close.map(c.name))} ${one(close, "stands", "stand")} apart: ${one(close, "it sits", "they sit")} closest to the Sun, while ${restAllFar ? `the other ${N[far.length]} Orbits sit further out` : "most of the other Orbits sit further out"}. ${list(close.map(c.name))} ${one(close, "appears", "appear")} to reflect what matters to you most clearly. In much of the rest of your life, the way you're currently living may not fully reflect it.`);
    if (middle.length) parts.push(`${list(middle.map(c.name))} ${are(middle)} at a middle distance: ${one(middle, "it reflects", "they reflect")} some of what matters to you, while other parts may still be finding their place.`);
    ev.push(...[...close, ...far, ...middle].map((o) => c.ev(`${o}.congruence`)));
  } else {
    if (close.length) { parts.push(`${list(close.map(c.name))} ${are(close)} close to the Sun: ${close.length > 1 ? "these areas of your life appear" : "this area of your life appears"} to reflect what matters to you.`); ev.push(...close.map((o) => c.ev(`${o}.congruence`))); }
    if (far.length) { parts.push(`${list(far.map(c.name))} ${are(far)} further out: the way you're currently living in ${far.length > 1 ? "these areas" : "this area"} may not fully reflect what matters to you.`); ev.push(...far.map((o) => c.ev(`${o}.congruence`))); }
    if (middle.length && (close.length || far.length)) { parts.push(`${list(middle.map(c.name))} ${are(middle)} at a middle distance: ${one(middle, "it reflects", "they reflect")} some of what matters to you, while other parts may still be finding their place.`); ev.push(...middle.map((o) => c.ev(`${o}.congruence`))); }
    if (!close.length && !far.length && middle.length) { parts.push(`${all(middle) ? "All of your Orbits sit" : `${list(middle.map(c.name))} ${are(middle)}`} at a middle distance: ${middle.length > 1 ? "they reflect" : "it reflects"} some of what matters to you, while other parts may still be finding their place.`); ev.push(...middle.map((o) => c.ev(`${o}.congruence`))); }
  }
  // A large, important Orbit far from the Sun: both signals kept, never framed as a problem.
  const bigFar = far.filter((o) => c.important(o));
  if (bigFar.length) parts.push(`${bigFar.length > 1 ? `${list(bigFar.map(c.name))} are also among your largest Orbits` : `${c.name(bigFar[0])} is also one of your largest Orbits`}: ${bigFar.length > 1 ? "they matter" : "it matters"} a great deal to you. That pairing can be worth noticing. It may reflect a conscious trade-off, practical circumstances or a time of change.`);
  // Mixed: the congruence statement and the supporting answers point in different directions.
  const mixed = orbits.filter((o) => c.by[o].congruenceMixed);
  for (const o of mixed.slice(0, 1)) {
    const sup = CONGRUENCE_ITEMS[o].map((it) => it.id).filter((id) => c.answered(id))
      .sort((a, b) => Math.abs((c.keyed(b) ?? 0.5) - (c.keyed(`${o}.congruence`) ?? 0.5)) - Math.abs((c.keyed(a) ?? 0.5) - (c.keyed(`${o}.congruence`) ?? 0.5)))[0];
    if (!sup) continue;
    parts.push(`In ${c.name(o)}, your answers point in different directions: asked whether the way you live it reflects what genuinely matters to you, you answered "${c.label(`${o}.congruence`)}", while to "${questionById(sup)?.prompt.replace(/\.$/, "")}" you answered "${c.label(sup)}".`);
    ev.push(c.ev(`${o}.congruence`), c.ev(sup));
  }
  if (none.length && none.length < orbits.length) parts.push(`We don't have enough information to understand how closely ${list(none.map(c.name))} ${none.length > 1 ? "reflect" : "reflects"} what matters to you, so ${none.length > 1 ? "they sit" : "it sits"} on the middle ring.`);
  return parts.length ? para(parts.join(" "), [], ev) : null;
}

// ── C · What stands out (connected Reality Snapshot) ─────────────────────────
export function composeStandsOut(c: Ctx, A: Allocation): NarrativeSection {
  const D = c.ic.largestDemand, S = c.ic.largestSource, E = c.ic.externalInfluence;
  const P: Para[] = [];
  if (D && S && D === S) {
    P.push(para(`${c.name(D)} plays two roles at once: it takes the most of your time and energy, and it gives you the most back.`, [], [c.ev("interconnections.01"), c.ev("interconnections.02")]));
  } else if (D || S) {
    const heavyD = D ? c.takes(D) || c.tones(D).strained.length >= 2 : false;
    const dPart = D ? `${c.name(D)} is where most of your time, attention and emotional energy goes${c.important(D) ? (heavyD ? ", and it's also among what matters most to you, which can make its cost harder to step back from" : ", and it's also among what matters most to you, so this may be a demand you've chosen") : c.takes(D) ? ", even though it isn't among what you rated as most important" : ""}${c.gives(D) ? `. You also said it ${energyWords(c.energy(D))}: demanding and draining aren't the same thing` : ""}` : "";
    const sPart = S ? `${c.name(S)} is where your energy comes back${c.moreSupported(S) ? ", and it's also one of the better supported areas in your answers" : c.lessSupported(S) ? ", even though your answers describe it as less supported: something can be life-giving and still under-resourced" : ""}` : "";
    const text = D && S ? `${dPart}. ${sPart}.` : `${dPart || sPart}.`;
    P.push(para(text.replace(/\.\./g, "."), [], [...(D ? [c.ev("interconnections.01"), c.ev(`${D}.importance`)] : []), ...(S ? [c.ev("interconnections.02")] : [])]));
  }
  const gapO = (ORBIT_IDS as OrbitId[]).filter((o) => c.important(o) && c.lessSupported(o)).sort((a, b) => (c.by[a].responseSupportIndex ?? 1) - (c.by[b].responseSupportIndex ?? 1))[0];
  const goodO = c.mostImportant.filter((o) => c.moreSupported(o));
  if (gapO) P.push(para(`${goodO.length ? `What matters most to you is often well supported, especially ${list(goodO.map(c.name))}. ` : ""}Of the areas you rated as highly important, though, ${c.name(gapO)} is where your answers describe the least support. It's the clearest place where what you value and what you're living seem to diverge.`, [], [c.ev(`${gapO}.importance`), ...c.supportEv(gapO).slice(0, 2)]));
  else if (goodO.length) P.push(para(`What matters most to you also tends to be well supported in your answers, especially ${list(goodO.map(c.name))}.`, [], goodO.map((o) => c.ev(`${o}.importance`))));
  if (E) P.push(para(`You named ${c.name(E)} as the area most shaped by other people's expectations${E === D ? ", and it's also where most of your energy goes" : c.important(E) ? ", and it's also one you rated as highly important" : ""}.`, [], [c.ev("interconnections.06")]));
  A.ref(A.all.filter((o) => ["energy.same", "priority.top"].includes(o.rule)), "standsOut");
  return { key: "standsOut", title: "What stands out in your life right now", paragraphs: P.length ? [para(P.map((p) => p.text).join(" "), [], P.flatMap((p) => p.evidence))] : [para("Your answers paint a fairly even picture, without one area pulling sharply in a different direction from the rest.")], fallback: !P.length };
}

// ── D · Relationship with yourself ──────────────────────────────────────────
export function composeSelf(c: Ctx, A: Allocation): NarrativeSection & { question: string | null } {
  const os = ["self.contrast", "self.strengths", "self.quieter", "self.values-living", "self.even"]
    .map((r) => A.all.find((o) => o.rule === r && !A.used.has(o.id))).filter((o): o is Observation => !!o);
  const opened = A.all.find((o) => o.rule === "self.contrast" && A.used.get(o.id)?.includes("opening"));
  for (const o of os) A.take(o, "self");
  const P = os.map((o) => para(o.text, [o]));
  if (opened && P.length) P.unshift(para("The difference noticed at the top of this page is part of a wider picture.", [opened]));
  const q = os.find((o) => o.question)?.question ?? opened?.question ?? (P.length ? "What kind of relationship are you building with yourself at this point in your life?" : null);
  if (!P.length) P.push(para("There aren't enough answers about your relationship with yourself to say more here."));
  return { key: "self", title: "Your relationship with yourself", paragraphs: P, fallback: !os.length, question: q };
}

// ── E · Your life is interconnected ─────────────────────────────────────────
export function composeConnections(c: Ctx, A: Allocation): NarrativeSection {
  const links = A.free("connections", (o) => o.rule.startsWith("link.") && o.rule !== "link.overall" && o.rule !== "link.leverage").slice(0, 3);
  for (const o of links) A.take(o, "connections");
  const P = links.map((o) => para(o.text, [o]));
  const overall = A.free("connections", (o) => o.rule === "link.overall")[0];
  if (overall) { A.take(overall, "connections"); P.push(para(overall.text, [overall])); }
  if (!links.length)
    P.unshift(para("Your answers don't show a strong link between particular areas of your life. That doesn't mean they're separate; the connections may simply be quieter, or show up in ways a questionnaire can't capture."));
  return { key: "connections", title: "Your life is interconnected", paragraphs: P, fallback: !links.length };
}

// ── F · Five cards ───────────────────────────────────────────────────────────
const CARD_META: Record<InsightCard["key"], { title: string; purpose: string; why: string; fallbackLead: string; fallbackText: string; fallbackQuestion: string }> = {
  overview: { title: "Your Life in Perspective", purpose: "The Bigger Picture",
    why: "Seeing the season as a whole can help you separate what you've chosen from what has simply accumulated.",
    fallbackLead: "A portrait of the life you described, not a verdict about who you are.",
    fallbackText: "Your answers describe several parts of life that matter to you, without pointing to one simple pattern. The individual Orbits may say more than a single overall conclusion.",
    fallbackQuestion: "If this season of your life had a name, what would you call it?" },
  support: { title: "What Supports You", purpose: "What Is Working for You",
    why: "Noticing what already works gives you something to build from, not only things to fix.",
    fallbackLead: "Notice what is already working before deciding what needs to change.",
    fallbackText: "Your answers don't single out one clear source of support. That doesn't mean support is absent; it may be spread across your life rather than concentrated in one place.",
    fallbackQuestion: "What is quietly working in your life that you rarely give yourself credit for?" },
  tension: { title: "Patterns Worth Noticing", purpose: "Where Something May Be Out of Alignment",
    why: "A gap between what matters and how you live isn't a failure. It's often the most useful information a Map can offer.",
    fallbackLead: "Nothing stands out as clearly out of alignment.",
    fallbackText: "Your answers don't point clearly to a gap between what matters to you and how you're living. That can be a useful observation in itself.",
    fallbackQuestion: "Where does the way you live feel most like your own choice?" },
  energy: { title: "Your Energy Architecture", purpose: "What Your Energy Is Telling You",
    why: "Energy isn't a grade. It's information about what your current life asks of you and what it gives back.",
    fallbackLead: "Energy is information, not a grade.",
    fallbackText: "Your answers don't show a clear energy pattern. Consider which areas restore you and which require more from you in an ordinary week.",
    fallbackQuestion: "What restores you in an ordinary week, and how often does it actually happen?" },
  begin: { title: "What Deserves a Closer Look", purpose: "Where Your Attention Could Make a Difference",
    why: "Attention is limited. Choosing where to look first can matter more than trying to change everything at once.",
    fallbackLead: "Not a to-do list. A place where a better question may reveal something.",
    fallbackText: "Your answers don't establish one obvious starting point. The most useful place to begin may be the area you feel most ready to understand more deeply.",
    fallbackQuestion: "Which part of your Map would you most like to understand more deeply?" },
};
const HEADINGS: Record<string, (o: Observation, c: Ctx) => string> = {
  "priority.top": () => "What carries the most weight",
  "support.similar": () => "How support is spread",
  "support.contrast": () => "Where the picture is fuller, and where it is thinner",
  "priority.quiet-choice": (o, c) => `${c.name(o.areas[0] as OrbitId)}, for now`,
  "pattern.well-supported": () => "A life that is largely working",
  "link.overall": () => "How the areas relate",
  "priority.strength": (o, c) => o.areas.length > 1 ? "What matters, and is holding" : `${c.name(o.areas[0] as OrbitId)} is holding`,
  "priority.quiet-supported": (o, c) => `${c.name(o.areas[0] as OrbitId)}, quietly working`,
  "alignment.lived-values-high": () => "Living what matters",
  "emotion.alive": (o, c) => `What feels alive in ${c.name(o.areas[0] as OrbitId)}`,
  "link.ambition-restoration": () => "Ambition and recovery, side by side",
  "priority.gap": (o, c) => `${c.name(o.areas[0] as OrbitId)}: important, less supported`,
  "alignment.priority-gap": () => "A gap you named",
  "alignment.expectations": () => "Where others' expectations come in",
  "alignment.lived-values-low": (o, c) => `How you live ${c.name(o.areas[0] as OrbitId)}`,
  "link.demand-crowded": () => "A trade-off in your own words",
  "energy.same": () => "Asks a lot, gives a lot",
  "energy.exchange": () => "One area asks, another restores",
  "energy.meaningful-demand": (o, c) => o.areas.length > 1 ? "Meaningful and demanding" : `${c.name(o.areas[0] as OrbitId)}: meaningful and demanding`,
  "energy.source": () => "Where your energy comes back",
  "support.top": () => "Better supported areas",
  "energy.balance": () => "Across your Orbits",
  "energy.source-takes": () => "Two answers that pull in different directions",
  "emotion.mixed": (o, c) => `Mixed feelings about ${c.name(o.areas[0] as OrbitId)}`,
  "emotion.strained": (o, c) => `What ${c.name(o.areas[0] as OrbitId)} is asking of you`,
  "link.leverage": () => "Where attention could ripple outward",
  "link.familiar": () => "How change feels right now",
  "strength.reinforcing": () => "Strengths that support each other",
  "centre.roles": (o, c) => `${c.name(o.areas[0] as OrbitId)} at the centre`,
  "contrast.feelings-statements": (o, c) => `How ${c.name(o.areas[0] as OrbitId)} feels, and how it's set up`,
  "link.lever-strong": () => "Building on a strength",
  "alignment.crowded-unimportant": () => "A trade-off and a rating",
  "link.permission": () => "Permission to rest and enjoy",
  "link.standards-care": () => "Standards and self-care",
  "link.body-mind": () => "Body and mind",
};
const claimOf = (o: Observation): InsightSection["claim"] => (o.wording === "state" ? "direct" : o.wording === "suggest" ? "derived" : "tentative");

export function composeCards(c: Ctx, A: Allocation, closingText: () => string, theme: Theme | null = null): InsightCard[] {
  const hasTheme = !!theme;
  const order: { key: InsightCard["key"]; dest: Destination; extra?: (o: Observation) => boolean }[] = [
    ...(theme ? [{ key: "overview" as const, dest: "card.overview" as Destination }] : []),
    { key: "tension", dest: "card.tension" },
    { key: "energy", dest: "card.energy" },
    { key: "support", dest: "card.support", extra: (o) => o.valence === "strength" },
    { key: "begin", dest: "card.begin" },
    ...(theme ? [] : [{ key: "overview" as const, dest: "card.overview" as Destination }]),
  ];
  const built: Record<string, InsightCard> = {};
  for (const { key, dest, extra } of order) {
    const meta = CARD_META[key];
    // Cards draw from their own destination; a deeper card may fall back to an unused opening candidate of the same kind.
    let picks = A.free(dest, extra);
    if (key === "begin" && !picks.length) picks = A.free("card.tension", (o) => !!o.question);
    // The bigger picture deepens the central theme: its supporting readings, each in full.
    // The opening only summarises the theme (15 Oct), so its full reading opens the bigger picture.
    if (key === "overview" && theme) picks = [theme.lead, ...theme.support.filter((o) => !A.used.has(o.id)), ...picks.filter((o) => o !== theme.lead)];
    // Less, but more meaningful: with a central theme, descriptive lines step back unless the card would be empty.
    if (hasTheme && picks.some((o) => !DESCRIPTIVE.has(o.rule))) picks = picks.filter((o) => !DESCRIPTIVE.has(o.rule));
    // Fewer, stronger observations (Jana, 13 Oct): up to three, and a third only when it is as strong as the rest.
    picks = picks.filter((o, i) => i === 0 || o.relevance >= 0.4).slice(0, 3);
    if (picks.length === 3 && picks[2].relevance < 0.5) picks = picks.slice(0, 2);
    for (const o of picks) A.take(o, dest);
    const sections: InsightSection[] = picks.map((o) => ({ id: o.id, observationId: o.id, heading: (HEADINGS[o.rule] ?? (() => cap(o.clause)))(o, c), text: o.text, evidence: o.evidence, claim: claimOf(o) }));
    const fallback = !picks.length;
    const lead = fallback ? meta.fallbackLead : key === "overview" && theme ? `The thread running through your answers: ${theme.lead.clause}.` : leadFor(key, picks, c);
    built[key] = {
      key, title: meta.title, purpose: meta.purpose, lead,
      sections: fallback ? [{ id: `${key}.fallback`, heading: meta.title, text: meta.fallbackText, evidence: [], claim: "direct" }] : sections,
      why: meta.why,
      question: picks.find((o) => o.question)?.question ?? meta.fallbackQuestion,
      fallback,
      ...(fallback ? {} : { major: majorOf(c, picks[0], "") }),
    };
  }
  // One question per card, never the same as another card's or as the closing question.
  const seen = new Set<string>([closingText()]);
  for (const k of ["overview", "support", "tension", "energy", "begin"] as const) {
    const card = built[k];
    if (seen.has(card.question)) card.question = CARD_META[k].fallbackQuestion;
    if (seen.has(card.question)) card.question = k === "support" ? "What would you want to keep, whatever else changes?" : "What would you like to understand better about this?";
    seen.add(card.question);
    if (card.major) card.major.question = card.question;
  }
  return (["overview", "support", "tension", "energy", "begin"] as const).map((k) => built[k]);
}
function leadFor(key: InsightCard["key"], picks: Observation[], c: Ctx) {
  const names = [...new Set(picks.flatMap((o) => o.areas).filter((a): a is OrbitId => a !== "sun"))].slice(0, 3).map(c.name);
  const m = c.mostImportant;
  switch (key) {
    case "overview": return m.length && m.length <= 3 ? `A season shaped most by ${list(m.map(c.name))}.` : "A season in which a lot of your life matters at once.";
    case "support": return names.length ? `Some of your firmest ground right now: ${list(names)}.` : "Some of what is quietly holding your life together.";
    case "tension": return names.length ? `Where what matters and how you live may not quite meet: ${list(names)}.` : "Where what matters and how you live may not quite meet.";
    case "energy": {
      const D = c.ic.largestDemand, S = c.ic.largestSource;
      if (D && S && D === S) return `${c.name(D)} asks the most of you, and gives the most back.`;
      if (D && S) return `${c.name(D)} asks the most of you; ${c.name(S)} gives the most back.`;
      const taking = (ORBIT_IDS as OrbitId[]).filter(c.takes);
      return taking.length ? `Where your energy goes: ${list(taking.map(c.name))}.` : `Where your energy comes from: ${list(names)}.`;
    }
    case "begin": return names.length ? `A place to look first: ${names[0]}.` : "A place where a better question may reveal something.";
  }
}

// ── G · Eight Orbits ────────────────────────────────────────────────────────
const ORBIT_Q: Record<OrbitId, string> = {
  mind: "What occupies your mind most often right now, and how much of it feels chosen?",
  body: "What does caring for your body look like in an ordinary week, and what gets in the way?",
  restoration: "What would recovery look like if you didn't have to earn it first?",
  growth: "What kind of growth feels truly yours at this point?",
  love: "What would feeling more fully yourself in intimacy look like, in whatever form intimacy takes in your life now?",
  social: "Where do you feel most like yourself among other people, and where least?",
  resources: "How much influence do you feel you have over your financial and living conditions?",
  joy: "What do you enjoy simply for its own sake, and how often does it happen?",
};

export function composeOrbit(c: Ctx, o: OrbitId, A: Allocation, themeAreas: string[] = []): OrbitNarrative {
  const r = c.by[o];
  const ids = c.statements(o);
  const hi = ids.filter(c.high), lo = ids.filter(c.low);
  const p: string[] = [];
  const ev: Evidence[] = [];
  // 1. How it feels
  const feel: string[] = [];
  if (r.importanceOrdinal) { feel.push(`You rated ${r.name} as "${c.impLabel(o)}"${r.energyRaw !== null ? `, and said it ${energyWords(r.energyRaw)}` : ""}.`); ev.push(c.ev(`${o}.importance`)); if (r.energyRaw !== null) ev.push(c.ev(`${o}.energy`)); }
  const emo = A.all.find((x) => x.areas[0] === o && x.rule.startsWith("emotion."));
  if (r.emotions.length) {
    // The card may already carry this Orbit's feelings in full; here they are named plainly.
    feel.push(`You described it with ${c.feelings(o)}.${emo?.rule === "emotion.mixed" && !A.used.has(emo.id) ? ` ${pick(COEXIST_LINES, `${c.seed}#coexist.${o}`)}` : ""}`);
    ev.push(c.ev(`${o}.emotion`)); if (emo) A.ref([emo], "orbit");
  }
  // Distance from the Sun, in Jana's approved words (F4, 13 Oct)
  const band = r.distanceBand;
  if (band) { feel.push(`On your Map it sits ${band === "close" ? "close to the Sun" : band === "far" ? "further from the Sun" : "at a middle distance from the Sun"}. ${DISTANCE_LINES[band]}${r.congruenceMixed ? " Some of your other answers here point in a different direction, so this is worth holding lightly." : ""}`); ev.push(c.ev(`${o}.congruence`)); }
  else if (c.by[o].metricStatuses?.distance === "unavailable") feel.push(DISTANCE_LINES.insufficient);
  if (feel.length) p.push(feel.join(" "));
  // 2. What's working / what may deserve attention
  if (r.supportConfidence === "insufficient") p.push("There aren't enough answers here to say more about how supported it feels.");
  else {
    const parts: string[] = [];
    if (hi.length) parts.push(`${pick(["What seems to be working", "There's real strength here"], `${c.seed}#w.${o}`)}: ${list(hi.slice(0, 2).map(c.capOf))}.`);
    if (lo.length) parts.push(`${hi.length ? "What may deserve attention" : "What may deserve some attention"}: ${c.lowPhrase(lo.slice(0, 2))}.`);
    if (!hi.length && !lo.length) parts.push(pick([
      "Your answers here sit mostly in the middle, without one clear strength or strain.",
      "Nothing here stands out strongly in either direction.",
      "Your answers describe this area as neither especially strong nor especially strained right now.",
    ], `${c.seed}#mid.${o}`));
    if (hi.length && lo.length) parts.push("Both can be true.");
    p.push(parts.join(" "));
    ev.push(...[...hi.slice(0, 2), ...lo.slice(0, 2)].map(c.ev));
  }
  if (o === "social" && r.subthemes && r.subthemes.career !== null && r.subthemes.community !== null && Math.abs(r.subthemes.career - r.subthemes.community) >= 0.35)
    p[p.length - 1] += ` Work and community read differently in your answers: ${r.subthemes.career > r.subthemes.community ? "work looks steadier than belonging" : "belonging looks steadier than work"}.`;
  if (r.coverage.notApplicable) p[p.length - 1] += " Questions you marked as not applicable are left out, not counted against this area.";
  // 3. How it fits the wider life
  const ic = c.ic;
  const roles = [
    ic.largestDemand === o && "the area taking the most of your time and energy",
    ic.largestSource === o && "your biggest source of energy",
    ic.leverageSelection === o && "where you believe change would ripple outward",
    ic.crowdedOut === o && "the area receiving less care because of other demands",
    ic.priorityGap === o && "something that matters more than the time it gets",
    ic.externalInfluence === o && "the area most shaped by others' expectations",
  ].filter((x): x is string => !!x);
  const roleIds = ["interconnections.01", "interconnections.02", "interconnections.03", "interconnections.04", "interconnections.05", "interconnections.06"]
    .filter((id, i) => [ic.largestDemand, ic.largestSource, ic.leverageSelection, ic.crowdedOut, ic.priorityGap, ic.externalInfluence][i] === o);
  if (roles.length) { p.push(`In the wider picture, you named it ${list(roles)}.`); ev.push(...roleIds.map(c.ev)); }
  if (themeAreas.includes(o)) p.push(themeAreas[0] === o ? "It's at the heart of what stands out most across your answers, described at the top of this page." : "It's part of what stands out most across your answers, described at the top of this page.");
  else if (c.unimportant(o) && c.lessSupported(o)) p.push("As it isn't a priority right now, this may simply be where you've chosen not to put your attention.");
  // Question
  let q = ORBIT_Q[o];
  if (o === "growth" && c.low("growth.06")) q = "What would need to be true for you to start on what you already know would help you grow?";
  else if (o === "restoration" && c.low("restoration.06")) q = "What would rest look like if you didn't have to earn it first?";
  else if (o === "social" && ic.externalInfluence === "social") q = "Where among other people do you feel most free to be yourself?";
  else if (o === "resources" && c.low("resources.05")) q = "What feels uncertain about change in your financial or living situation, and what would make it feel safer to consider?";
  return { orbit: o, name: r.name, paragraphs: p, question: q, evidence: dedupeEv(ev) };
}

// ── H · A question worth taking with you ────────────────────────────────────
const CLOSING_BY_FAMILY: Record<string, (o: Observation, c: Ctx) => string | undefined> = {
  "ambition-restoration": (o) => o.question,
  "asks-gives": (o) => o.question,
  tradeoff: (o) => o.question,
  "priority-gap": (o) => o.question,
  expectations: (o) => o.question,
  "status-quo": (o) => o.question,
  permission: (o) => o.question,
  standards: (o) => o.question,
  self: (o) => o.question,
  leverage: (o) => o.question,
  "well-supported": (o) => o.question,
  centre: (o) => o.question,
  several: () => "If you could give your full attention to just one area for a while, which would make the most difference to how you feel?",
};
export function composeClosing(c: Ctx, lead: Observation | null, A: Allocation) {
  if (lead) {
    const q = (CLOSING_BY_FAMILY[lead.family] ?? ((o: Observation) => o.question))(lead, c);
    if (q) return { text: q, theme: lead.family, observationId: lead.id, evidence: lead.evidence };
  }
  const alt = A.all.find((o) => o.question && o.valence !== "neutral");
  if (alt) return { text: alt.question!, theme: alt.family, observationId: alt.id, evidence: alt.evidence };
  return { text: "Which part of your Map felt most true, and what would you like to do with that?", theme: "neutral", observationId: null, evidence: [] };
}
