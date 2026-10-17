/**
 * Layers 4–6 — prioritization, composition and validation (approved 15 Oct).
 * Chooses a central thread (or a portrait / harmony story), gives every reading exactly one home, writes each section
 * only from its own readings within the length budget, and checks every sentence before it is stored.
 */
import type { OrbitId } from "@/content/types";
import { DISTANCE_LINES, CARD_META } from "@/engine/narrative/compose";
import { orbitQuestion } from "./orbit-questions";
import { cap, list } from "@/engine/narrative/context";
import { energyWords } from "@/engine/narrative/rules";
import type { Evidence, InsightCard, OrbitNarrative, Para } from "@/engine/narrative/types";
import { BANNED } from "@/engine/narrative/validate";
import { ORBITS, type E } from "./evidence";
import type { Home, Reading, ValidationLog } from "./types";

// ── prioritization ─────────────────────────────────────────────────────────
const qids = (r: Reading) => new Set(r.evidence.map((x) => x.questionId));
function overlaps(a: Reading, b: Reading) {
  const A = qids(a), B = qids(b);
  if (Math.min(A.size, B.size) < 3) return false; // single-answer readings are kept apart by relationship, not overlap
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.min(A.size, B.size) >= 0.6;
}
const scoreOf = (r: Reading) => r.score + 0.02 * Math.min(4, r.modifiers.length) + (r.sufficiency === "corroborated" ? 0.02 : 0);

export interface Plan {
  mode: "thread" | "portrait" | "harmony";
  central: Reading | null;
  byHome: Partial<Record<Home, Reading>>;
  connections: Reading[];
  used: Reading[];
}

export function prioritize(readings: Reading[]): Plan {
  const sorted = [...readings].sort((a, b) => scoreOf(b) - scoreOf(a) || a.id.localeCompare(b.id));
  const used: Reading[] = [];
  const modulesUsed = new Set<string>();
  const take = (r: Reading) => { used.push(r); if (r.module) modulesUsed.add(r.module); return r; };
  const ok = (r: Reading) => !used.includes(r) && !(r.module && modulesUsed.has(r.module)) && !used.some((u) => u.relationship === r.relationship || (!r.facts && overlaps(u, r)));

  const overviewCands = sorted.filter((r) => r.homes.includes("overview"));
  const harmony = overviewCands.find((r) => r.relationship === "harmony-attention");
  const strongTension = overviewCands.find((r) => r.kind !== "strength" && scoreOf(r) >= 0.8);
  let central: Reading | null = null, mode: Plan["mode"] = "portrait";
  if (harmony && !strongTension) { central = take(harmony); mode = "harmony"; }
  else if (overviewCands[0] && scoreOf(overviewCands[0]) >= 0.75) { central = take(overviewCands[0]); mode = "thread"; }

  const byHome: Plan["byHome"] = {};
  if (central) byHome.overview = central;
  for (const h of ["sun", "support", "tension", "energy", "begin", "standsOut"] as Home[]) {
    const r = sorted.find((x) => x.homes.includes(h) && ok(x));
    if (r) byHome[h] = take(r);
  }
  if (!byHome.overview) { const r = sorted.find((x) => x.homes.includes("overview") && ok(x)) ?? sorted.find((x) => x.homes.includes("connections") && ok(x)); if (r) byHome.overview = take(r); }
  const connections: Reading[] = [];
  for (const r of sorted) { if (connections.length >= 2) break; if (r.homes.includes("connections") && ok(r)) connections.push(take(r)); }
  return { mode, central, byHome, connections, used };
}

// ── validation ─────────────────────────────────────────────────────────────
const CAUSAL = /\b(because|due to|caused by|leads? to|results? in)\b/i;
const ALLOWED_CAUSAL = /because (another part of (your|my) life demands so much|change feels uncertain|(you|I) fear failure)/i; // wording quoted from the questions themselves
const TIMEFRAME = /\b(season|lately|used to|you've built|for years|recently|these days|always been)\b/i;
const PARTNER = /\b(partner|spouse|husband|wife|boyfriend|girlfriend)\b/i;
const sentences = (t: string) => t.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];

export function makeValidator() {
  const log: ValidationLog = { checked: 0, removed: [], warnings: [] };
  const reason = (s: string) => {
    if (BANNED.test(s)) return "banned language";
    if (CAUSAL.test(s) && !ALLOWED_CAUSAL.test(s)) return "states a cause the answers don't";
    if (TIMEFRAME.test(s)) return "implies a timeframe or history";
    if (PARTNER.test(s)) return "assumes a partner";
    return null;
  };
  const clean = (t: string) => {
    const kept: string[] = [];
    for (const s of sentences(t)) { log.checked++; const r = reason(s); if (r) log.removed.push({ text: s, reason: r }); else kept.push(s); }
    return kept.join(" ");
  };
  return { log, clean };
}

// ── composition ────────────────────────────────────────────────────────────
function composeMap(e: E): string {
  const m = e.map, N = e.N, s: string[] = [];
  if (m.largest.length >= 5) s.push("Many of your Orbits are drawn at a similar, generous size: you care about a lot at once.");
  else if (m.largest.length > 1) s.push(`Your largest Orbits are ${list(m.largest.map(N))}, the areas you rated as most important right now.`);
  else if (m.largest.length === 1) s.push(`Your largest Orbit is ${N(m.largest[0])}, the area you rated as most important right now.`);
  const bigDim = m.largest.filter((o) => m.dimmest.includes(o));
  if (bigDim.length) s.push(`${list(bigDim.map(N))}, ${bigDim.length > 1 ? "among the largest, are also the dimmest" : `${m.largest.length > 1 ? "one of the largest" : "the largest"}, is also ${m.dimmest.length > 1 ? "among the dimmest" : "the dimmest"}`}: ${bigDim.length > 1 ? "they matter" : "it matters"} a great deal and ${bigDim.length > 1 ? "feel" : "feels"} less supported.`);
  else if (m.brightest.length && m.dimmest.length) s.push(`${list(m.brightest.map(N))} ${m.brightest.length > 1 ? "glow" : "glows"} most brightly; ${list(m.dimmest.map(N))} ${m.dimmest.length > 1 ? "are" : "is"} the dimmest.`);
  if (!m.far.length && !m.middle.length && m.close.length) s.push("All of your Orbits sit close to the Sun: across your life, the way you're living appears to reflect what matters to you.");
  else if (m.far.length && m.far.length <= 3) s.push(`${list(m.far.map(N))} ${m.far.length > 1 ? "sit" : "sits"} furthest from the Sun: the way you're currently living in ${m.far.length > 1 ? "these areas" : "this area"} may not fully reflect what matters to you.`);
  else if (m.far.length > 3) s.push(`Several Orbits sit further from the Sun, among them ${list(m.far.slice(0, 3).map(N))}: in much of your life, the way you're living may not fully reflect what matters to you.`);
  else if (m.middle.length) s.push(`${list(m.middle.map(N))} ${m.middle.length > 1 ? "sit" : "sits"} at a middle distance, with the rest close to the Sun.`);
  if (m.givers.length || m.takers.length) s.push(`${m.givers.length ? `Energy flows in from ${list(m.givers.map(N))}` : "No Orbit gives more energy than it takes"}${m.takers.length ? `${m.givers.length ? ", and out toward" : "; energy flows out toward"} ${list(m.takers.map(N))}.` : `${m.givers.length ? ", and none takes more than it gives." : "."}`}`);
  return s.join(" ");
}

const FEEL_CAP = (e: E, o: OrbitId) => cap(e.c.feelings(o));
function composeOrbit(e: E, o: OrbitId, plan: Plan, coexistUsed: { done: boolean }): OrbitNarrative {
  const c = e.c, r = c.by[o];
  const ids = c.statements(o).filter((i) => !e.isNA(i));
  const hi = ids.filter(e.yes), lo = ids.filter(e.no);
  const ev: Evidence[] = [];
  const parts: string[] = [];
  // 1. Reported reality: feelings and energy first (never the rating)
  const en = r.energyRaw !== null ? energyWords(r.energyRaw) : null;
  if (r.emotions.length) { parts.push(`${FEEL_CAP(e, o)} ${r.emotions.length > 1 ? "are" : "is"} what you notice most here${en ? `, and it ${en}` : ""}.`); ev.push(c.ev(`${o}.emotion`)); }
  else if (en) parts.push(`It ${en}.`);
  if (en) ev.push(c.ev(`${o}.energy`));
  const covered = plan.used.some((x) => x.areas[0] === o && x.relationship !== "lever" && x.relationship !== "named-trade-off");
  if (!covered) {
    if (hi.length && lo.length) parts.push(`What's working here: ${c.capOf(hi[0])}. What's thinner: ${c.lowPhrase(lo.slice(0, 1))}.`);
    else if (hi.length) parts.push(`What's working here: ${list(hi.slice(0, 2).map(c.capOf))}.`);
    else if (lo.length) parts.push(`${cap(c.lowPhrase(lo.slice(0, 2)))}.`);
  }
  ev.push(...[...hi.slice(0, 2), ...lo.slice(0, 2)].map(c.ev));
  if (o === "love" && (e.isNA("love.01") || e.isNA("love.02"))) parts.push("With the romantic-relationship questions marked not applicable, this reads Love as desire, closeness and how you hold intimacy, in whatever form it takes.");
  // 2. Distance (approved band wording)
  if (r.distanceBand) { parts.push(DISTANCE_LINES[r.distanceBand]); ev.push(c.ev(`${o}.congruence`)); }
  // 3. One interpretation specific to this Orbit: lent by a reading in use, else by its state
  const lent = plan.used.map((x) => x.orbitLines?.[o]).find(Boolean);
  if (lent) parts.push(lent);
  else {
    const imp = c.important(o), dim = e.map.dimmest.includes(o) || c.lessSupported(o), bright = e.map.brightest.includes(o) || c.moreSupported(o);
    const t = c.tones(o);
    if (imp && dim) parts.push("It matters a great deal and feels thinly supported, which makes it one of the places where what you value and how you live sit furthest apart.");
    else if (imp && bright) parts.push("What matters here is also well supported, which makes it worth protecting when other areas ask more of you.");
    else if (c.unimportant(o) && bright) parts.push("It asks little of your attention and works anyway, which is its own kind of strength.");
    else if (c.unimportant(o) && dim) parts.push("It isn't a priority right now, and that may be a choice rather than a gap.");
    else if (t.expansive.length && t.strained.length && !coexistUsed.done) { coexistUsed.done = true; parts.push("Different feelings sit side by side here, which is common when something matters and also asks a lot."); }
    else if (e.roles.source === o) parts.push("It's where your energy comes back most, which makes it worth protecting when life gets full.");
    else if (imp && r.distanceBand === "far") parts.push("It matters to you, and the way it's lived hasn't caught up with that yet.");
    else if (bright && !imp) parts.push("It works well without needing to be a top priority.");
    else if (lo.length && !hi.length) parts.push("It seems to be asking for more than it currently gets.");
  }
  return { orbit: o, name: e.N(o), paragraphs: [parts.join(" ")], question: "", evidence: ev };
}

const para = (text: string, r?: Reading | null): Para => ({ text, observationIds: r ? [r.id] : [], evidence: r ? r.evidence : [] });

export function composeAll(e: E, plan: Plan, clean: (t: string) => string) {
  const c = e.c;
  const { central, byHome } = plan;
  // Opening (2–3 sentences)
  let openingText = central?.opening ?? "";
  if (!openingText) {
    const leads = plan.used.filter((r) => r.homes.some((h) => h === "overview" || h === "tension" || h === "standsOut")).slice(0, 2).map((r) => r.lead);
    openingText = leads.length ? `Your answers don't point to one simple story. ${leads.join(" ")}` : "Your answers describe several parts of life that matter to you, without pointing to one simple story.";
  }
  const opening = [para(clean(openingText), central)];

  const withFacts = (r: Reading | undefined): Reading | undefined => {
    if (!r?.facts) return r;
    const usedIds = new Set(plan.used.filter((u) => u !== r).flatMap((u) => u.evidence.map((x) => x.questionId)));
    const fresh = r.facts.filter((f) => !f.id.every((id) => usedIds.has(id))).slice(0, 3);
    if (fresh.length < 2) return r;
    const ev = fresh.flatMap((f) => r.evidence.filter((x) => f.id.includes(x.questionId)));
    return { ...r, evidence: ev, observation: `Several foundations are in place: ${list(fresh.map((f) => f.text))}.` };
  };
  const card = (key: InsightCard["key"], r0: Reading | undefined): InsightCard => {
    const r = withFacts(r0);
    const meta = CARD_META[key];
    if (!r) return { key, title: meta.title, purpose: meta.purpose, lead: meta.fallbackLead, sections: [{ id: `${key}.fallback`, heading: meta.title, text: meta.fallbackText, evidence: [], claim: "direct" }], why: key === "overview" ? "Seeing the whole picture can help you separate what you've chosen from what has simply accumulated." : meta.why, question: meta.fallbackQuestion.replace("this season of your life", "this time in your life"), fallback: true };
    const shared = r.evidence.slice(0, 4).map(c.plain);
    return {
      key, title: meta.title, purpose: meta.purpose, lead: clean(r.lead),
      sections: [{ id: r.id, observationId: r.id, heading: r.heading, text: clean(r.observation), meaning: clean(r.meaning), evidence: r.evidence, claim: r.sufficiency === "single" ? "tentative" : "derived" }],
      why: clean(r.why), question: r.question.text, fallback: false,
      major: { observationId: r.id, shared, pattern: clean(r.observation), meaning: clean(r.meaning), alternative: clean(r.alternative), question: r.question.text },
    };
  };
  const cards = [card("overview", byHome.overview), card("support", byHome.support), card("tension", byHome.tension), card("energy", byHome.energy), card("begin", byHome.begin)];

  // Closing question: from the central thread; never a repeat of a card question
  const cardQs = new Set(cards.map((x) => x.question));
  let closing = central?.closing ?? central?.question.text ?? byHome.overview?.question.text ?? "What would you most like to understand better about your life right now?";
  if (cardQs.has(closing)) closing = "What would you most like to understand better about your life right now?";
  // Deduplicate card questions (keep the first)
  const seenQ = new Set<string>([closing]);
  for (const k of cards) { if (seenQ.has(k.question)) { k.question = CARD_META[k.key].fallbackQuestion.replace("this season of your life", "this time in your life"); if (k.major) k.major.question = k.question; } seenQ.add(k.question); }

  // Orbits: every Orbit carries one question, chosen by its state (Jana, 17 Oct)
  const coexist = { done: false };
  const takenQ = new Set<string>([...seenQ, ...(byHome.sun ? [byHome.sun.question.text] : [])]);
  const orbits = ORBITS.map((o) => {
    const n = composeOrbit(e, o, plan, coexist);
    return { ...n, paragraphs: n.paragraphs.map(clean), question: orbitQuestion(e, o, takenQ).text };
  });

  const sunR = byHome.sun;
  const self = { key: "self", title: "Your relationship with yourself", paragraphs: sunR ? [para(clean(`${sunR.observation} ${sunR.meaning}`), sunR)] : [], fallback: !sunR, question: sunR?.question.text ?? null };
  const so = byHome.standsOut;
  const standsOut = { key: "standsOut", title: "What stands out in your life right now", paragraphs: so ? [para(clean(so.observation), so), para(clean(so.meaning), so)] : [], fallback: !so };
  const connections = { key: "connections", title: "Your life is interconnected", paragraphs: plan.connections.map((r) => para(clean(`${r.observation} ${r.meaning}`), r)), fallback: !plan.connections.length };
  const mapReading = { key: "map", title: "What stands out on your Map", paragraphs: [para(clean(composeMap(e)))], fallback: false };
  return { opening, cards, closing, orbits, self, standsOut, connections, mapReading };
}

/** Phrase-frequency check over the whole public text (warnings, logged with the result). */
export function phraseWarnings(texts: string[]): string[] {
  const all = texts.join(" ").toLowerCase();
  const caps: [RegExp, number, string][] = [[/\bmay be\b/g, 8, "may be"], [/only you can/g, 1, "only you can"], [/\bquietly\b/g, 1, "quietly"], [/one possibility/g, 1, "one possibility"], [/\byou describe\b/g, 2, "you describe"]];
  return caps.flatMap(([re, max, name]) => { const n = (all.match(re) ?? []).length; return n > max ? [`"${name}" appears ${n} times (cap ${max})`] : []; });
}
