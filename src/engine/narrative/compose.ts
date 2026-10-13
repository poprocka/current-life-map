/**
 * Selection and assembly: turns ranked observations into the results narrative.
 * The opening synthesises; the sections and cards deepen; the Orbit paragraphs give detail.
 * An observation's text is used verbatim in one place only.
 */
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { type Ctx, COEXIST_LINES, cap, list, pick } from "./context";
import { energyWords } from "./rules";
import type { Destination, Evidence, InsightCard, InsightSection, NarrativeSection, Observation, OrbitNarrative, Para } from "./types";

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
  neutral: () => "Sometimes the most interesting part of a Map isn't an extreme, but the places where things are quietly mixed.",
};

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
      "Other areas sit somewhere in between.",
      CURIOSITY.neutral(null as never, c),
    ].filter(Boolean).join(" ");
    return { key: "opening", title: "Your reality, as it is right now", paragraphs: [para(text, [], [...c.mostImportant.map((o) => c.ev(`${o}.importance`)), ...(c.ic.largestSource ? [c.ev("interconnections.02")] : [])])], fallback: true, lead: null };
  }
  A.take(lead, "opening");
  const fam = lead.family;
  const intro = pick(INTRO[fam] ?? INTRO.default, `${c.seed}#intro`);
  const PREF = ["priority.strength", "alignment.lived-values-high", "link.ambition-restoration", "link.body-mind", "priority.quiet-supported", "self.strengths", "emotion.alive"];
  const strengths = A.all.filter((o) => o.valence === "strength" && o.id !== lead.id && !areasOverlap(o, lead) && !A.used.has(o.id))
    .sort((a, b) => (PREF.indexOf(a.rule) + 99) % 99 - (PREF.indexOf(b.rule) + 99) % 99 || b.relevance - a.relevance);
  const S = c.ic.largestSource;
  const sourceCounter = S && !lead.areas.includes(S) && c.ic.largestDemand !== S && !c.takes(S) ? `At the same time, ${c.name(S)} gives you the most energy.` : null;
  const counter = strengths.find((o) => o.rule === "priority.strength" || o.rule === "alignment.lived-values-high") ?? (sourceCounter ? null : strengths[0]) ?? null;
  const secondary = candidates.find((o) => o.id !== lead.id && !areasOverlap(o, lead) && o.valence !== "strength");
  const nuance = lead.alternatives[0] ?? "";
  const curiosity = (CURIOSITY[fam] ?? CURIOSITY.neutral)(lead, c);

  const p1 = `${intro} ${lead.text}`;
  let p2Parts = [nuance];
  const refs: Observation[] = [lead];
  if (fam !== "well-supported") {
    if (counter) { p2Parts.push(`At the same time, ${counter.clause}.`); refs.push(counter); }
    else if (sourceCounter) p2Parts.push(sourceCounter);
  }
  let paragraphs = [p1, p2Parts.filter(Boolean).join(" "), curiosity].filter(Boolean);
  let total = words(paragraphs.join(" "));
  if (total < 95 && fam === "several") {
    p2Parts = [...p2Parts, "A demanding season says more about what life is asking of you than about who you are."];
    paragraphs = [p1, p2Parts.filter(Boolean).join(" "), curiosity].filter(Boolean);
    total = words(paragraphs.join(" "));
  } else if (total < 95 && secondary) {
    p2Parts = [...p2Parts, `Alongside that, ${secondary.clause}.`];
    refs.push(secondary);
    paragraphs = [p1, p2Parts.filter(Boolean).join(" "), curiosity].filter(Boolean);
    total = words(paragraphs.join(" "));
  }
  if (total > 160 && p2Parts.some((x) => x.startsWith("At the same time"))) {
    p2Parts = p2Parts.filter((x) => !x.startsWith("At the same time"));
    if (counter) refs.splice(refs.indexOf(counter), 1);
    paragraphs = [p1, p2Parts.filter(Boolean).join(" "), curiosity].filter(Boolean);
  }
  A.ref(refs.filter((o) => o !== lead), "opening");
  return { key: "opening", title: "Your reality, as it is right now", paragraphs: paragraphs.map((t, i) => para(t, i === 0 ? [lead] : i === 1 ? refs.slice(1) : [])), fallback: false, lead };
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
  const giving = (ORBIT_IDS as OrbitId[]).filter(c.gives), taking = (ORBIT_IDS as OrbitId[]).filter(c.takes);
  if (giving.length || taking.length)
    P.push(para(`${giving.length ? `Energy flows in from ${list(giving.map(c.name))}` : "None of your Orbits is marked as giving more energy than it takes"}${taking.length ? `${giving.length ? ", and out toward" : "; energy flows out toward"} ${list(taking.map(c.name))}.` : `${giving.length ? ", and none is marked as taking more than it gives." : "."}`}`, [], [...giving, ...taking].map((o) => c.ev(`${o}.energy`))));
  return { key: "map", title: "What stands out on your Map", paragraphs: P.slice(0, 3), fallback: !P.length };
}

// ── C · What stands out (connected Reality Snapshot) ─────────────────────────
export function composeStandsOut(c: Ctx, A: Allocation): NarrativeSection {
  const D = c.ic.largestDemand, S = c.ic.largestSource, E = c.ic.externalInfluence;
  const P: Para[] = [];
  if (D && S && D === S) {
    P.push(para(`${c.name(D)} plays two roles at once: it takes the most of your time and energy, and it gives you the most back.`, [], [c.ev("interconnections.01"), c.ev("interconnections.02")]));
  } else if (D || S) {
    const dPart = D ? `${c.name(D)} is where most of your time, attention and emotional energy goes${c.important(D) ? ", and it's also among what matters most to you, so this may be a demand you've chosen" : c.takes(D) ? ", even though it isn't among what you rated as most important" : ""}${c.gives(D) ? `. You also said it ${energyWords(c.energy(D))}: demanding and draining aren't the same thing` : ""}` : "";
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
};
const claimOf = (o: Observation): InsightSection["claim"] => (o.wording === "state" ? "direct" : o.wording === "suggest" ? "derived" : "tentative");

export function composeCards(c: Ctx, A: Allocation, closingText: () => string): InsightCard[] {
  const order: { key: InsightCard["key"]; dest: Destination; extra?: (o: Observation) => boolean }[] = [
    { key: "tension", dest: "card.tension" },
    { key: "energy", dest: "card.energy" },
    { key: "support", dest: "card.support", extra: (o) => o.valence === "strength" },
    { key: "begin", dest: "card.begin" },
    { key: "overview", dest: "card.overview" },
  ];
  const built: Record<string, InsightCard> = {};
  for (const { key, dest, extra } of order) {
    const meta = CARD_META[key];
    // Cards draw from their own destination; a deeper card may fall back to an unused opening candidate of the same kind.
    let picks = A.free(dest, extra);
    if (key === "begin" && !picks.length) picks = A.free("card.tension", (o) => !!o.question);
    // Fewer, stronger observations (Jana, 13 Oct): up to three, and a third only when it is as strong as the rest.
    picks = picks.filter((o, i) => i === 0 || o.relevance >= 0.4).slice(0, 3);
    if (picks.length === 3 && picks[2].relevance < 0.5) picks = picks.slice(0, 2);
    for (const o of picks) A.take(o, dest);
    const sections: InsightSection[] = picks.map((o) => ({ id: o.id, observationId: o.id, heading: (HEADINGS[o.rule] ?? (() => cap(o.clause)))(o, c), text: o.text, evidence: o.evidence, claim: claimOf(o) }));
    const fallback = !picks.length;
    const lead = fallback ? meta.fallbackLead : leadFor(key, picks, c);
    built[key] = {
      key, title: meta.title, purpose: meta.purpose, lead,
      sections: fallback ? [{ id: `${key}.fallback`, heading: meta.title, text: meta.fallbackText, evidence: [], claim: "direct" }] : sections,
      why: meta.why,
      question: picks.find((o) => o.question)?.question ?? meta.fallbackQuestion,
      fallback,
    };
  }
  // One question per card, never the same as another card's or as the closing question.
  const seen = new Set<string>([closingText()]);
  for (const k of ["overview", "support", "tension", "energy", "begin"] as const) {
    const card = built[k];
    if (seen.has(card.question)) card.question = CARD_META[k].fallbackQuestion;
    if (seen.has(card.question)) card.question = k === "support" ? "What would you want to keep, whatever else changes?" : "What would you like to understand better about this?";
    seen.add(card.question);
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
    case "energy": return names.length ? `Where your energy goes, and where it comes back: ${list(names)}.` : "Where your energy goes, and where it comes back.";
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

export function composeOrbit(c: Ctx, o: OrbitId, A: Allocation): OrbitNarrative {
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
