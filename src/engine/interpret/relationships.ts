/**
 * Layer 2 — conditional relationships (approved 15 Oct). Each relationship has a CORE (two or more signals across two
 * or more areas), MODIFIERS (answers that change what the core means), CONTRADICTIONS (answers that block or soften it)
 * and sufficiency rules. Output: candidate readings — never a respondent profile.
 *
 * Copy is DRAFT for Jana's editing. Rules: no causes unless an answer states one (Interconnections Q4 does); no history
 * or timeframes; no partner assumed; feelings are words, not scores; lenses inform the wording but are never named.
 */
import type { OrbitId } from "@/content/types";
import { cap, list } from "@/engine/narrative/context";
import { SUPPORT_COMPETE_READING } from "@/content/v10/scales";
import type { Evidence } from "@/engine/narrative/types";
import {
  accessKnowhow, chosenImposed, futurePresent, knowingLiving, restPermission, stabilityStagnation, willCapacity,
} from "./distinctions";
import { ORBITS, type E } from "./evidence";
import type { Reading } from "./types";

// ── small wording helpers ──────────────────────────────────────────────────
/** How an Orbit's congruence answer reads in a sentence (verb phrase, third person singular). */
export function congPhrase(e: E, o: OrbitId): string {
  const v = e.k(`${o}.congruence`);
  if (v === null) return "is lived in a way you didn't rate";
  if (v >= 0.75) return "reflects what genuinely matters to you";
  if (v >= 0.5) return "mostly reflects what genuinely matters to you";
  if (v >= 0.25) return "only partly reflects what genuinely matters to you";
  return "doesn't yet reflect what genuinely matters to you";
}
const NUM: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" };
const uniq = (xs: Evidence[]) => xs.filter((x, i) => xs.findIndex((y) => y.questionId === x.questionId) === i);
const suff = (ev: Evidence[]): Reading["sufficiency"] => (ev.length >= 3 ? "corroborated" : ev.length === 2 ? "corroborated" : "single");
const restLine = (e: E) => {
  const bits: string[] = [];
  if (e.endorsed("restoration.02")) bits.push("rest is among the first things to go when life gets busy");
  else if (e.roles.crowded === "restoration") bits.push("Restoration is the area you said receives less care because another part of your life demands so much");
  else if (e.no("restoration.03")) bits.push("recovering before exhaustion feels out of reach right now");
  if (e.no("restoration.06")) bits.push("stopping comes with a pull to be productive");
  return bits.join(", and ");
};

type Rel = (e: E) => Reading[];

// ── 1. A valued direction outpacing recovery ───────────────────────────────
const momentum: Rel = (e) => {
  const drivers = (["growth", "social"] as OrbitId[]).filter((o) => e.roles.demand === o || (o === "growth" && e.c.important(o) && (e.yes("growth.01") || e.yes("growth.04"))));
  const restStrain = e.endorsed("restoration.02") || e.roles.crowded === "restoration" || e.c.lessSupported("restoration");
  if (!drivers.length || !restStrain || e.yes("restoration.03")) return [];
  const D = drivers.find((o) => e.roles.source === o) ?? drivers.find((o) => e.roles.demand === o) ?? drivers[0];
  const borrowed = (["growth", "social"] as OrbitId[]).find((o) => e.roles.expect === o && e.cong(o) === "not");
  const chosen = !borrowed && e.cong(D) === "own" && (e.yes("sun.04") || e.yes("sun.01"));
  const base = e.ev(`${D}.importance`, "restoration.02", "restoration.03", "restoration.06", ...(e.roles.crowded === "restoration" ? ["interconnections.04"] : []), ...(e.roles.source === D ? ["interconnections.02"] : []));
  const givesD = e.c.gives(D);
  const rl = restLine(e);
  const out: Reading[] = [];
  if (borrowed) {
    const X = borrowed;
    const ci = chosenImposed(e, X);
    const ev = uniq([...base, ...ci.evidence, ...e.ev("sun.01", "sun.06")]);
    out.push({
      id: `momentum:borrowed:${X}`, relationship: "momentum-recovery", areas: [X, "restoration", "sun"], kind: "tension", discovery: "distinction",
      homes: ["overview", "tension"], score: 0.9, modifiers: ["interconnections.06", `${X}.congruence`, ...(e.no("sun.06") ? ["sun.06"] : []), ...(e.no("sun.01") ? ["sun.01"] : [])], module: "chosen-imposed",
      evidence: ev, contradictions: e.yes("sun.04") ? e.ev("sun.04") : [], sufficiency: suff(ev),
      distinctive: `${e.N(X)} is both energizing and the area most shaped by others' expectations, and it ${congPhrase(e, X)}.`,
      lens: { name: "identity and authenticity; autonomy (Self-Determination Theory)", type: "theory" },
      heading: "Energy and ownership aren't the same thing",
      lead: `${e.N(X)} ${givesD && X === D ? "gives you energy and " : ""}matters a great deal, and it's also where other people's standards press hardest.`,
      opening: `${e.N(X)} matters to you as much as anything${givesD && X === D ? ", and it gives you energy" : ""}. You also named it as the area most shaped by other people's expectations, and the way you live it ${congPhrase(e, X)}.${rl ? ` Meanwhile, ${rl}.` : ""}`,
      observation: `When rest is the first thing to give way, the obvious reading is a scheduling problem. Your answers point somewhere else: ${e.N(X)} is the area you named as most shaped by others' expectations, and the way you live it ${congPhrase(e, X)}.${e.no("sun.06") ? " Standing by your own needs when it might disappoint someone also feels hard right now." : ""}`,
      meaning: `Pursuing a direction you've chosen and meeting a standard you haven't fully examined can look identical from the outside. Both are demanding, and only one tends to feel like yours. The cost to your rest may belong less to the effort itself than to whose idea of progress it serves.`,
      alternative: "Some of those expectations may be ones you share and would keep. Influence and choice can sit side by side.",
      why: "Knowing which parts of your direction are yours makes it easier to decide what is worth its cost.",
      question: { text: `If ${e.N(X)} were shaped only by what matters to you, what would you keep, and what would you let go?`, intent: "values" },
      closing: `Whose idea of progress is ${e.N(X)} following right now, and how much of it is yours?`,
      orbitLines: { [X]: `It gives a lot and asks a lot, and it's also where outside standards are strongest for you, so its energy and its ownership may not be the same thing.` },
    });
  } else if (chosen) {
    const rp = restPermission(e);
    const ev = uniq([...base, ...e.ev(`${D}.congruence`, "sun.04", "sun.08"), ...rp.evidence]);
    const perm = rp.side === "permission" || rp.side === "both";
    out.push({
      id: `momentum:chosen:${D}`, relationship: "momentum-recovery", areas: [D, "restoration", "sun"], kind: "tension", discovery: perm ? "reframing" : "distinction",
      homes: ["overview", "tension"], score: 0.88, modifiers: [`${D}.congruence`, "sun.04", ...(e.yes("sun.08") ? ["sun.08"] : []), ...rp.evidence.map((x) => x.questionId)], module: "rest-permission",
      evidence: ev, contradictions: [], sufficiency: suff(ev),
      distinctive: `The direction is self-authored (${e.N(D)} ${congPhrase(e, D)}; you trust your own decisions), so the strain sits in recovery, not in the direction.`,
      lens: { name: "striving and contentment; self-compassion research", type: "theory" },
      heading: "A chosen pace, and the rest it leaves behind",
      lead: "You're building something you believe in, and recovery hasn't been given a say in the pace.",
      opening: `Much of your life is moving in a direction you've chosen: ${e.N(D)} matters to you as much as anything${givesD ? " and gives you energy back" : ""}, and the way you live it ${congPhrase(e, D)}. What lags behind is recovery${rl ? `: ${rl}` : ""}.`,
      observation: `${e.N(D)} is lived on your own terms, and you trust your own decisions${e.yes("sun.08") ? " and keep the promises you make to yourself" : ""}. Recovery is where that self-trust doesn't reach yet${rl ? `: ${rl}` : ""}.`,
      meaning: perm
        ? `That combination rarely points to a lack of discipline. It points more to how rest is classified: as something allowed once the work is done, rather than a commitment in its own right. Recovery isn't the opposite of ambition; it's part of what lets a chosen direction last.`
        : `Here the limit looks like time more than permission: rest keeps losing its place in the week, even though it doesn't come with guilt. A direction you've chosen deserves conditions that let you keep choosing it.`,
      alternative: "It could also be a trade-off you're making knowingly, and one you'd make again. How it feels from the inside is the best guide.",
      why: "A direction you care about is easier to sustain when the conditions that support it count as part of it.",
      question: { text: perm ? "What would change if rest were a promise you made to yourself rather than a reward you granted yourself?" : "Who decides the pace of your life right now, and does your recovery get a say?", intent: "trade-off" },
      closing: "What would it mean to treat your recovery as part of what you are building, rather than what comes after?",
      orbitLines: { restoration: perm ? "Rest seems to wait for permission more than for time, which makes it a question of how you value it rather than how you schedule it." : "Rest seems to lose out on time rather than on permission." },
    });
  } else {
    const fp = futurePresent(e);
    if (fp.side !== "future") return out;
    const ev = uniq([...base, ...fp.evidence]);
    out.push({
      id: `momentum:future:${D}`, relationship: "momentum-recovery", areas: [D, "restoration", "joy"], kind: "tension", discovery: "distinction",
      homes: ["overview", "tension"], score: 0.78, modifiers: fp.evidence.map((x) => x.questionId), module: "future-present",
      evidence: ev, contradictions: [], sufficiency: suff(ev),
      distinctive: `${e.N(D)} draws much of your attention while rest and enjoyment both sit low.`,
      lens: { name: "striving and present-moment awareness", type: "philosophy" },
      heading: "Building a future, and the present it uses",
      lead: `${e.N(D)} is carrying you forward; rest and enjoyment are waiting their turn.`,
      opening: `${e.N(D)} takes a large share of your attention and matters a great deal to you. Rest and enjoyment sit lower: ${rl || "they seem to wait their turn"}.`,
      observation: `${e.N(D)} draws much of your attention, while the things that would let you enjoy what you're building, like rest, play and doing things simply for their own sake, sit lower in your answers.`,
      meaning: "A life can be organized around moving forward rather than around experiencing what's already there. Neither is wrong, but the second is easy to postpone, and fulfillment that is always scheduled for later tends to stay there.",
      alternative: "This might be a deliberate focus that you enjoy, rather than something you're putting up with.",
      why: "Noticing whether enjoyment has become conditional on the next milestone gives you a choice about it.",
      question: { text: "Are you building a life you enjoy living now, or one you're hoping to enjoy later?", intent: "postpone" },
      closing: "What would it look like to enjoy part of what you're building before it's finished?",
    });
  }
  return out;
};

// ── 2. Clear direction, limited capacity ───────────────────────────────────
const capacity: Rel = (e) => {
  const owned = ORBITS.filter((o) => e.cong(o) === "own");
  const clear = e.yes("sun.11") || e.yes("sun.01");
  const strain = [...(e.c.takes("resources") ? ["resources.energy"] : []), ...(e.no("resources.06") ? ["resources.06"] : []), ...(e.no("body.01") ? ["body.01"] : []), ...(e.endorsed("restoration.02") ? ["restoration.02"] : []), ...(e.no("restoration.01") ? ["restoration.01"] : [])];
  if (owned.length < 5 || !clear || strain.length < 3) return [];
  const ak = accessKnowhow(e), wc = willCapacity(e);
  const ev = uniq([...e.ev("sun.01", "sun.11", ...strain), ...ak.evidence, ...wc.evidence]);
  const maxE = Math.max(...ORBITS.map((o) => e.c.energy(o) ?? 3));
  const topDrain = ORBITS.filter((o) => (e.c.energy(o) ?? 3) === maxE && maxE >= 4);
  const strainWords = [
    topDrain.length === 1 ? `${e.N(topDrain[0])} takes more energy than anything else on your Map` : topDrain.length ? `${list(topDrain.map(e.N))} take more energy than they give` : "",
    e.endorsed("restoration.02") ? "rest is among the first things to go when life gets busy" : "",
    e.no("body.01") ? "your body doesn't fully have the energy your days ask for" : "",
  ].filter(Boolean);
  const know = ["restoration.05", "body.04", "body.06", "mind.04", "restoration.04"].filter(e.yes);
  const knowWords: Record<string, string> = { "restoration.05": "your self-care feels like genuine care", "body.04": "you notice what your body asks for", "body.06": "you treat your body with care rather than pressure", "mind.04": "you know what grounds you when your mind is overwhelmed", "restoration.04": "you have rituals that help you release stress" };
  return [{
    id: "capacity:clear-direction", relationship: "clear-direction-limited-capacity", areas: ["sun", ...topDrain, "restoration", "body"], kind: "mixed", discovery: "reframing",
    homes: ["overview", "tension"], score: 0.9, modifiers: [...know, ...(e.yes("sun.08") ? ["sun.08"] : []), ...(wc.side === "both" || wc.side === "hesitation" ? ["growth.06", "sun.08"] : [])], module: wc.side === "both" || wc.side === "hesitation" ? "will-capacity" : ak.side === "access" ? "access-knowhow" : "will-capacity",
    evidence: ev, contradictions: e.endorsed("growth.06") ? e.ev("growth.06") : [], sufficiency: "corroborated",
    distinctive: `High congruence in ${owned.length} Orbits and a clear sense of meaning, alongside strained energy, rest and room.`,
    lens: { name: "what is and isn't within your influence (Stoic); access vs know-how", type: "philosophy" },
    heading: "Clear direction, limited room",
    lead: "Aligned isn't the same as easy, and your answers show both at once.",
    opening: `Your answers hold an uncommon combination: a clear sense of what matters, and practical demands that leave little room to live it. ${cap(list(strainWords))}. Very little here sounds lost; the strain sits in capacity rather than clarity.`,
    observation: `Nearly every Orbit reflects what genuinely matters to you, and your sense of meaning holds even as things change. What's thin is supply: ${list(strainWords)}.`,
    meaning: wc.side === "both" || wc.side === "hesitation"
      ? `Your answers point two ways here. Part of the gap looks like limited supply: ${list(strainWords.slice(0, 2))}. Part looks like hesitation: ${list(["growth.06", "growth.03"].filter(e.endorsed).map((f) => (f === "growth.06" ? "you often know what would help you grow and put it off" : "fear of failure or judgment sometimes stops you trying")))}${e.no("sun.08") ? ", and following through on promises to yourself feels harder" : ""}. The two ask for different things: room for the first, safety for the second.`
      : know.length >= 2
      ? `When rest keeps slipping, it's tempting to treat it as a discipline problem. Your answers suggest otherwise: ${list(know.slice(0, 2).map((k) => knowWords[k]))}. The gap looks like access, not know-how, and the two call for different responses: one asks for more effort, the other for a look at what is using up the supply.`
      : "A limit of capacity is different from a limit of will. One asks for more effort; the other asks what is using up the supply, and which demands are truly fixed.",
    alternative: "Some of these limits may be fixed for now, and some more open than they feel.",
    why: "Seeing a limit as a matter of capacity rather than character changes what kind of support would actually help.",
    question: { text: "Which of your current limits are truly fixed for now, and which might be more open than they feel?", intent: "tolerate" },
    closing: "What would it mean to protect your capacity as carefully as you already protect your sense of direction?",
  }];
};

// ── 3. Support that hasn't yet become permission ───────────────────────────
const supportPermission: Rel = (e) => {
  const held = ["social.01", "social.02", "social.06"].filter(e.yes);
  const agency = ["sun.06", "sun.04", "sun.05", "social.03"].filter(e.no);
  const lovePart = !e.isNA("love.02") && e.no("love.02") ? ["love.02"] : [];
  if (held.length < 2 || agency.length + lovePart.length < 2) return [];
  const fear = ["growth.03", "growth.06"].filter(e.endorsed);
  const ev = uniq(e.ev(...held, ...agency, ...lovePart, ...fear, ...(e.roles.expect === "social" ? ["interconnections.06"] : [])));
  const agencyWords: Record<string, string> = { "sun.06": "standing by your needs when it might disappoint someone", "sun.04": "trusting your own important decisions", "sun.05": "setting boundaries that respect your needs", "social.03": "being your authentic self without seeking approval", "love.02": "voicing your needs and boundaries in your intimate life" };
  const aw = list([...agency, ...lovePart].slice(0, 3).map((a) => agencyWords[a]));
  return [{
    id: "support:not-yet-permission", relationship: "support-not-permission", areas: ["social", "sun", ...(lovePart.length ? ["love" as const] : [])], kind: "tension", discovery: "distinction",
    homes: ["overview", "tension"], score: 0.86 + (fear.length ? 0.03 : 0), modifiers: [...agency, ...lovePart, ...fear], module: undefined,
    evidence: ev, contradictions: [], sufficiency: "corroborated",
    distinctive: `Close support is strong (${held.length} of 3 statements), while acting on your own behalf is the thinner part.`,
    lens: { name: "closeness and autonomy; relatedness and autonomy (Self-Determination Theory)", type: "theory" },
    heading: "Support that hasn't yet become permission",
    lead: "The people around you back who you're becoming; backing yourself is the quieter part.",
    opening: `Your life is full of people who seem to see you, and they support who you are becoming. Where your answers grow more hesitant is in acting on your own behalf: ${aw} feel less available right now.`,
    observation: `The support around you is real and strong. Alongside it, ${aw} feel less true for you right now. Being held by others and backing yourself are different capacities, and your answers place them at different strengths.`,
    meaning: `Support from others can sit beside a quieter authority within without turning into it. If the judgment you hesitate before isn't coming from the people nearest to you, it may be coming from somewhere wider${e.roles.expect === "social" ? ": the expectations you named in Social World" : ""}${e.endorsed("mind.05") ? `${e.roles.expect === "social" ? ", or" : ":"} the comparison that takes up room in your Mind` : ""}.`,
    alternative: "Some of this hesitation may be care for the people around you rather than a lack of confidence.",
    why: "The places where you already feel safe can be the easiest places to practise standing by what you want.",
    question: { text: "If the people who already back you were the only ones watching, what would you try first?", intent: "create" },
    closing: "Where is the support around you already strong enough for you to stand a little more firmly by what you want?",
  }];
};

// ── 3b. Support and your own voice working together ────────────────────────
const supportAgency: Rel = (e) => {
  const held = ["social.01", "social.02", "social.06"].filter(e.yes);
  const voice = ["sun.05", "sun.06", "social.03", "sun.04"].filter(e.yes);
  const loveVoice = !e.isNA("love.02") && e.yes("love.02") ? ["love.02"] : [];
  if (held.length < 2 || voice.length + loveVoice.length < 3) return [];
  return [{
    id: "support:with-voice", relationship: "support-with-voice", areas: ["social", "sun", ...(loveVoice.length ? ["love" as const] : [])], kind: "strength", discovery: "recognition",
    homes: ["overview", "support"], score: 0.72, modifiers: [...voice, ...loveVoice], evidence: e.ev(...held, ...voice, ...loveVoice), contradictions: [], sufficiency: "corroborated",
    distinctive: "Close support and your own voice are both strong.",
    lens: { name: "closeness and autonomy", type: "theory" },
    heading: "Closeness and your own voice, together", lead: "You're well supported, and you speak up for yourself inside that support.",
    opening: "Your life is full of people who see you and support who you're becoming. What stands out is that the support hasn't cost you your voice: you set boundaries and stand by your needs, even when it might disappoint someone.",
    observation: `The people closest to you support who you're becoming, and you feel you belong. Alongside that, ${list(voice.slice(0, 3).map((v) => ({ "sun.05": "you set boundaries that respect your needs", "sun.06": "you stand by your needs even when it might disappoint someone", "social.03": "you can be yourself without seeking approval", "sun.04": "you trust your own important decisions" } as Record<string, string>)[v]))}.`,
    meaning: "Closeness and individuality are often treated as a trade: more of one, less of the other. Your answers suggest they're working together. Support that leaves room for your own voice is one of the steadier foundations a life can have.",
    alternative: "Holding both can still take effort in particular relationships, even when it works overall.",
    why: "Knowing that closeness and autonomy coexist for you makes both easier to protect.",
    question: { text: "Where is it easiest for you to be fully yourself with other people, and what makes it easier there?", intent: "preserve" },
    closing: "What would you want to protect in how you are with the people closest to you?",
  }];
};

// ── 3c. A demanding time, with direction also in question ──────────────────
const strainDirection: Rel = (e) => {
  const strain = [...(e.c.takes("resources") ? ["resources.energy"] : []), ...(e.no("resources.06") ? ["resources.06"] : []), ...(e.no("body.01") ? ["body.01"] : []), ...(e.endorsed("restoration.02") ? ["restoration.02"] : []), ...(e.no("restoration.01") ? ["restoration.01"] : [])];
  const dir = ["sun.11", "sun.01"].filter(e.no);
  const notOwned = ORBITS.filter((o) => e.c.important(o) && e.cong(o) === "not");
  if (strain.length < 3 || !dir.length || notOwned.length < 2) return [];
  return [{
    id: "strain:direction", relationship: "strain-and-direction", areas: ["sun", ...notOwned], kind: "tension", discovery: "distinction",
    homes: ["overview", "tension"], score: 0.86, modifiers: [...dir, ...notOwned.map((o) => `${o}.congruence`)], evidence: e.ev(...strain, ...dir, ...notOwned.map((o) => `${o}.congruence`)), contradictions: [], sufficiency: "corroborated",
    distinctive: "Practical strain and an unsettled sense of direction at the same time.",
    lens: { name: "what is and isn't within your influence (Stoic); meaning", type: "philosophy" },
    heading: "Two loads at once", lead: "Your life is carrying two different loads: practical strain, and a less settled sense of direction.",
    opening: `Your answers describe two different loads at once. One is practical: ${list(strain.slice(0, 2).map((x) => ({ "resources.energy": "Resources takes more energy than it gives", "resources.06": "your financial and living situation leaves little room to grow", "body.01": "your body doesn't fully have the energy your days ask for", "restoration.02": "rest is among the first things to go when life gets busy", "restoration.01": "sleep leaves you less rested than you need" } as Record<string, string>)[x]))}. The other is about direction: ${list(dir.map((d) => (d === "sun.11" ? "holding a sense of meaning while things change" : "knowing what you truly want when others expect something different")))} feels less certain right now.`,
    observation: `The practical strain is real, and so is the question of direction: in ${list(notOwned.map(e.N))}, the way you live ${notOwned.length > 1 ? "them" : "it"} doesn't fully feel like your own.`,
    meaning: "When both loads arrive together, they tend to blur into one feeling of being stuck. Pulling them apart can help: some of what weighs on you may be outside your influence for now, while the question of direction is one you can work on even before circumstances change.",
    alternative: "The direction question may also be a response to the strain, and could feel different once there is more room.",
    why: "Separating what you can influence from what you can't makes both easier to carry.",
    question: { text: "Which part of what weighs on you is about circumstances, and which part is about direction?", intent: "learn" },
    closing: "If you set the practical strain aside for a moment, what would you want your direction to be?",
  }];
};

// ── 4. A well-built life and an open question of direction ─────────────────
const searching: Rel = (e) => {
  const base = (["body", "restoration", "resources", "love"] as OrbitId[]).filter((o) => e.c.moreSupported(o));
  const dir = [...["sun.11", "sun.01", "growth.05"].filter(e.no), ...(e.c.tones("growth").ids.includes("stagnation") ? ["growth.emotion"] : [])];
  const holding = [...(e.cong("growth") === "not" ? ["growth.congruence"] : []), ...(e.endorsed("resources.05") ? ["resources.05"] : []), ...(e.endorsed("growth.06") ? ["growth.06"] : [])];
  if (base.length < 2 || dir.length < 2 || !holding.length) return [];
  const ss = stabilityStagnation(e);
  const hope = e.c.tones("growth").ids.includes("hope");
  const ev = uniq(e.ev(...dir, ...holding, ...base.map((o) => `${o}.importance`)).concat(ss.evidence));
  return [{
    id: "searching:direction", relationship: "comfortable-but-searching", areas: [...base, "growth", "sun"], kind: "mixed", discovery: "recognition",
    homes: ["overview", "tension"], score: 0.87, modifiers: [...dir, ...holding, ...(hope ? ["growth.emotion"] : [])], module: "stability-stagnation",
    evidence: ev, contradictions: [], sufficiency: "corroborated",
    distinctive: `A well-supported base (${list(base.map(e.N))}) beside a direction that isn't settled (${dir.length} answers).`,
    lens: { name: "meaning and direction; acceptance vs settling", type: "philosophy" },
    heading: "A well-built life, and the question of what it's for",
    lead: "Stability is real here; direction is the open question.",
    opening: `Your days rest on solid ground: ${list(base.map(e.N))} ${base.length > 1 ? "are" : "is"} well supported, and very little is draining you. What feels less settled is where all of this is heading, and Growth is where that shows most.`,
    observation: `${list(base.map(e.N))} ${base.length > 1 ? "are" : "is"} among the best-supported parts of your life. Growth, which matters to you, is where uncertainty sits${e.endorsed("growth.06") ? ": you often know what would help you grow and put it off" : ""}${e.no("sun.11") ? ", and holding a sense of meaning while your direction changes feels less certain" : ""}.`,
    meaning: ss.side === "stability"
      ? "Stability can be a base rather than a holding pattern, and parts of your answers suggest it's working that way. The open question is less whether to change than what you'd want to grow on such solid ground."
      : `There's a difference between acceptance, where you keep choosing what you have, and settling, where the choosing has paused. Your answers don't say which this is${hope ? ", but the hope you named beside it suggests the question is still alive for you" : ""}. A stable foundation can be exactly what makes a change survivable rather than reckless.`,
    alternative: "This might be a deliberate time of consolidation, chosen rather than drifted into.",
    why: "Seeing stability as a foundation rather than a destination opens a choice about what comes next.",
    question: { text: "Which parts of your current stability are you actively choosing, and which are you keeping mainly because changing them feels uncertain?", intent: "tolerate" },
    closing: "If your stability is the ground rather than the destination, what would you want to grow on it?",
  }];
};

// ── 5. Harmony sustained by attention ──────────────────────────────────────
const harmony: Rel = (e) => {
  if (e.map.far.length || e.map.takers.length || e.map.close.length < 6 || e.sunStrong.length < 7) return [];
  const noticing = ["restoration.03", "body.04", "mind.04", "social.07", "sun.02"].filter(e.yes);
  if (noticing.length < 3) return [];
  const largestFeeds = e.map.largest.length > 0 && e.map.largest.length <= 3 && e.map.largest.every((o) => e.c.gives(o));
  const largestSteady = e.map.largest.length <= 3 ? e.map.largest.filter((o) => !e.c.gives(o)) : [];
  const words: Record<string, string> = { "restoration.03": "you recover before you reach exhaustion", "body.04": "you notice what your body asks for", "mind.04": "you know what grounds you when your mind is overwhelmed", "social.07": "you can tell when a relationship or environment drains you", "sun.02": "you admit it to yourself when something isn't right" };
  const ev = e.ev(...noticing, "interconnections.07");
  return [{
    id: "harmony:attention", relationship: "harmony-attention", areas: ["sun", "restoration", "body", "mind"], kind: "strength", discovery: "recognition",
    homes: ["overview", "support"], score: 0.86, modifiers: noticing, evidence: ev, contradictions: [], sufficiency: "corroborated",
    distinctive: "No Orbit far from the Sun, none draining, and several answers about noticing early.",
    lens: { name: "wellbeing research; awareness", type: "empirical" },
    heading: "Harmony built from attention",
    lead: "Your harmony seems built from attention, not from an absence of demands.",
    opening: "Across your answers, the parts of your life seem to work with each other rather than against each other. What stands out isn't an absence of demands; it's how early you seem to notice what's happening, and how you respond with care rather than pressure.",
    observation: `Several of your strengths are about timing: ${list(noticing.slice(0, 4).map((n) => words[n]))}. Each is a small act of noticing; together they work like an early-warning system.${largestFeeds ? ` And what matters most to you, ${list(e.map.largest.map(e.N))}, also gives you energy.` : largestSteady.length ? ` What matters most to you, ${list(largestSteady.map(e.N))}, holds your energy steady rather than lifting it; the lift comes from ${list(e.map.givers.slice(0, 2).map(e.N))}.` : ""}`,
    meaning: "That may explain why the demanding parts of your life haven't become depleting ones: small imbalances get named while they're still small. What you have looks less like a fixed state than a practice you're already living.",
    alternative: "Some of it may also be circumstance, which is worth knowing too: circumstances change.",
    why: "The conditions that make a life work are easy to overlook, and easier to keep once they're named.",
    question: { text: "Which of these early signals do you trust most, and what would change if you stopped listening to it?", intent: "preserve" },
    closing: "Of the conditions that make your life feel this connected right now, which would you most want to protect as things change?",
  }];
};

// ── 6. One area asks the most and gives the most ───────────────────────────
const asksGives: Rel = (e) => {
  const D = e.roles.demand;
  if (!D || D !== e.roles.source) return [];
  return [{
    id: `asks-gives:${D}`, relationship: "asks-and-gives", areas: [D], kind: "mixed", discovery: "connection", homes: ["energy", "overview"], score: 0.8,
    modifiers: e.cong(D) === "own" ? [`${D}.congruence`] : [], evidence: e.ev("interconnections.01", "interconnections.02", `${D}.energy`, `${D}.congruence`), contradictions: [], sufficiency: "explicit",
    distinctive: `${e.N(D)} is both the largest demand and the largest source of energy.`,
    heading: `${e.N(D)} asks the most and gives the most`, lead: `${e.N(D)} asks the most of you and gives the most back.`,
    opening: `You named ${e.N(D)} both as the area that takes the most of your time and energy and as the one that gives the most back. It asks a lot, and it gives a lot.`,
    observation: `You named ${e.N(D)} both as the area that takes the most of your time and energy and as the one that gives the most back. It asks a lot, and it gives a lot.`,
    meaning: "This is often where meaning lives: in what costs and gives back in equal measure. The risk isn't the effort; it's that when something feeds you this much, its cost becomes easy to overlook.",
    alternative: "It may simply be a time of full engagement that you're enjoying.",
    why: "When the engine and the fuel are the same, it helps to notice what else needs fuel too.",
    question: { text: `What does your ${e.N(D)} Orbit give you that makes its demands worthwhile, and does the exchange still feel chosen?`, intent: "energy" },
    closing: `The more useful question may not be whether ${e.N(D)} asks too much, but whether the exchange still feels like one you're choosing.`,
  }];
};

// ── 7. A trade-off the person named ────────────────────────────────────────
const tradeOff: Rel = (e) => {
  const D = e.roles.demand, C = e.roles.crowded;
  if (!D || !C || D === C) return [];
  const competes = !!e.roles.overall?.includes("compete");
  return [{
    id: `trade-off:${D}:${C}`, relationship: "named-trade-off", areas: [D, C], kind: "tension", discovery: "connection", homes: ["connections", "tension"], score: 0.62 + (competes ? 0.04 : 0),
    modifiers: competes ? ["interconnections.07"] : [], evidence: e.ev("interconnections.01", "interconnections.04", ...(competes ? ["interconnections.07"] : [])), contradictions: [], sufficiency: "explicit",
    distinctive: `${e.N(D)} takes the most; ${e.N(C)} receives less care.`,
    heading: `${e.N(C)} and ${e.N(D)}`, lead: `${e.N(D)} takes the most of your time and energy; ${e.N(C)} gets less care.`,
    observation: `You said ${e.N(C)} receives less care because another part of your life demands so much, and you named ${e.N(D)} as what takes the most of your time and energy. The two answers may describe one trade-off${competes ? ", and they fit what you said about your life overall: the areas compete for your time and energy" : ""}.`,
    meaning: "Every yes is also a no to something else. The useful question isn't whether the trade-off exists, but whether it still feels chosen.",
    alternative: "A trade-off can be deliberate and right for now.",
    why: "A trade-off you can see is one you can choose again, or change.",
    question: { text: `Is the space your ${e.N(C)} Orbit has right now a trade-off you'd choose again?`, intent: "trade-off" },
  }];
};

// ── 8. The lever ───────────────────────────────────────────────────────────
const lever: Rel = (e) => {
  const L = e.roles.lever;
  if (!L) return [];
  const weak = e.c.lessSupported(L) || e.cong(L) === "not" || e.map.dimmest.includes(L);
  const strong = e.c.moreSupported(L) && !weak;
  const alsoExpect = e.roles.expect === L;
  const alsoGap = e.roles.gap === L;
  const ev = e.ev("interconnections.03", ...(alsoExpect ? ["interconnections.06"] : []), ...(alsoGap ? ["interconnections.05"] : []), `${L}.congruence`);
  if (alsoExpect) return [{
    id: `lever:${L}:expect`, relationship: "lever", areas: [L], kind: "mixed", discovery: "possibility", homes: ["begin"], score: 0.7, modifiers: ["interconnections.06"], evidence: ev, contradictions: [], sufficiency: "explicit",
    distinctive: `The lever is also the Orbit most shaped by others' expectations.`,
    heading: `${e.N(L)}, on your own terms`, lead: `${e.N(L)} is the lever you chose; the question may be whose idea of "better" it carries.`,
    observation: `You named ${e.N(L)} as the area whose improvement could lift the rest of your life, and also as the area most shaped by other people's expectations.`,
    meaning: `Together those answers raise a possibility: the improvement you picture for ${e.N(L)} might carry some of those outside standards, while what it actually asks of you could be simpler. It might be worth exploring what "better" means for ${e.N(L)} on your own terms.`,
    alternative: "The standards you picture may also be ones you genuinely share.",
    why: "A lever moves most easily when the change is one you actually want.",
    question: { text: `When you picture your ${e.N(L)} Orbit improving, whose idea of "better" are you picturing?`, intent: "values" },
  }];
  if (strong) return [{
    id: `lever:${L}:strong`, relationship: "lever", areas: [L], kind: "strength", discovery: "possibility", homes: ["begin"], score: 0.62, modifiers: [], evidence: ev, contradictions: [], sufficiency: "explicit",
    distinctive: "The lever is already one of the stronger areas.",
    heading: `Building on ${e.N(L)}`, lead: `${e.N(L)} is the lever you chose, and it's already strong.`,
    observation: `You chose ${e.N(L)} as the area whose improvement could lift the rest of your life, and it's already one of the better-supported parts of your Map.`,
    meaning: `Growth doesn't only come from fixing what's weak. You may see ${e.N(L)} as a foundation the rest stands on, and the next step there could be about protecting or deepening what works rather than repairing anything.`,
    alternative: "It may also be the place where small changes feel most within reach.",
    why: "Strengthening what already works can carry further than fixing what doesn't.",
    question: { text: `What conditions make your ${e.N(L)} Orbit work right now, and which could you least afford to lose?`, intent: "preserve" },
  }];
  return [{
    id: `lever:${L}:weak`, relationship: "lever", areas: [L], kind: "tension", discovery: "possibility", homes: ["begin"], score: weak ? 0.72 : 0.6, modifiers: weak ? [`${L}.congruence`] : [], evidence: ev, contradictions: [], sufficiency: "explicit",
    distinctive: weak ? "The lever is also one of the least supported or least owned areas." : "A lever chosen by the person.",
    heading: `Where a small change could make the biggest difference: ${e.N(L)}`, lead: "", // no line under the card title: the heading says it (Jana, 28 Oct)
    observation: `You chose ${e.N(L)} as the area where improvement could lift the rest of your life${weak ? `, and it's also ${e.map.dimmest.includes(L) || e.c.lessSupported(L) ? "one of the least supported areas on your Map" : "an area you don't yet live on your own terms"}` : ""}${alsoGap ? `. It's also what you said gets less of your time than you'd like` : ""}.`,
    meaning: "People often sense where the lever is before they can say why. A small, steady change in one well-chosen area can reshape more of a life than a big push everywhere at once.",
    alternative: "Improving one area won't necessarily change the others, but the instinct is worth exploring.",
    why: "Knowing where to begin makes change smaller and more possible.",
    question: { text: `If your ${e.N(L)} Orbit improved even a little, what would you notice first in the rest of your life?`, intent: "create" },
  }];
};

// ── 9. Rest and pleasure both waiting for permission ───────────────────────
const permission: Rel = (e) => {
  if (!(e.no("restoration.06") && e.no("joy.02"))) return [];
  return [{
    id: "permission:rest-pleasure", relationship: "permission", areas: ["restoration", "joy"], kind: "tension", discovery: "connection", homes: ["connections", "energy"], score: 0.66,
    modifiers: e.c.tones("joy").ids.includes("guilt") ? ["joy.emotion"] : [], module: "rest-permission", evidence: e.ev("restoration.06", "joy.02", "joy.emotion"), contradictions: [], sufficiency: "corroborated",
    distinctive: "Both rest and pleasure seem to need earning first.",
    lens: { name: "self-compassion research", type: "empirical" },
    heading: "Rest and pleasure, both waiting for permission", lead: "Rest and pleasure both seem to need earning first.",
    observation: `Resting without guilt and enjoying pleasure without feeling you have to earn it both feel less true for you right now${e.c.tones("joy").ids.includes("guilt") ? ", and guilt is one of the feelings you named in Joy" : ""}.`,
    meaning: "When rest and pleasure both have to be earned, worth can start to feel tied to output. Learning to receive without first justifying it can be one of the harder, and more freeing, things a person does.",
    alternative: "It may also reflect what current demands allow, rather than a lasting rule.",
    why: "What you allow yourself shapes how much your life restores you.",
    question: { text: "What would rest or pleasure feel like if you didn't have to earn it first?", intent: "values" },
  }];
};

// ── 10. A busy mind ────────────────────────────────────────────────────────
const busyMind: Rel = (e) => {
  const strained = e.c.tones("mind").strained.length;
  if (!(e.endorsed("mind.05") || e.partly("mind.05")) || !(e.c.takes("mind") || strained >= 2)) return [];
  const skills = ["mind.02", "mind.04", "mind.06"].filter((i) => (e.k(i) ?? 0) >= 0.5);
  const ev = e.ev("mind.05", "mind.energy", "mind.emotion", ...skills, ...(e.roles.lever === "mind" ? ["interconnections.03"] : []));
  const only = e.map.soleTaker === "mind";
  return [{
    id: "busy-mind", relationship: "busy-mind", areas: ["mind"], kind: "tension", discovery: "reframing", homes: ["standsOut", "connections"], score: 0.6 + (only ? 0.08 : 0) + (e.roles.lever === "mind" ? 0.05 : 0),
    modifiers: [...skills, ...(only ? ["map.soleTaker"] : [])], evidence: ev, contradictions: [], sufficiency: "corroborated",
    distinctive: skills.length >= 2 ? "The skills to settle the mind are present; the load is high." : "A busy mind with fewer settling skills in place.",
    lens: { name: "awareness and psychological flexibility", type: "theory" },
    heading: "A busy mind", lead: only ? "Mind is the only Orbit costing you energy." : "Your mind is carrying a lot.",
    observation: `${only ? "Mind is the only Orbit on your Map that takes more energy than it gives. " : ""}Overthinking, comparison or worry takes more of your attention than you'd like${e.roles.lever === "mind" ? ", and Mind is the area you chose as the one whose improvement would carry furthest" : ""}.`,
    meaning: skills.length >= 2
      ? `What makes this interesting is that the skills aren't missing: ${list([e.yes("mind.02") || e.mid("mind.02") ? "you can notice a thought without believing it" : "", (e.k("mind.04") ?? 0) >= 0.5 ? "you mostly know what calms you" : "", e.yes("mind.06") ? "you take your feelings seriously" : ""].filter(Boolean))}. The difficulty may be less about method than about volume: how much room comparison and worry take up.`
      : "A mind that keeps circling is often a mind trying to keep everything safe. Making a little unscheduled space, rather than producing calm on demand, can change what it has room for.",
    alternative: "Some of it may be tied to specific circumstances rather than to how your mind works in general.",
    why: "Seeing the load as volume rather than failure changes what might help.",
    question: { text: "What occupies your mind most often right now, and how much of it feels chosen?", intent: "learn" },
  }];
};

// ── 11. A body that is managed more than listened to ───────────────────────
const bodySignals: Rel = (e) => {
  const habits = ["body.02", "body.03", "body.05"].filter((i) => (e.k(i) ?? 0) >= 0.5);
  const signals = ["body.01", "body.04"].filter(e.no);
  const t = e.c.tones("body").ids;
  if (habits.length < 2 || !signals.length || !(e.c.by.body.distanceBand === "far" || t.includes("depletion") || t.includes("tension"))) return [];
  return [{
    id: "body:managed-not-heard", relationship: "body-signals", areas: ["body"], kind: "tension", discovery: "distinction", homes: ["begin", "standsOut"], score: 0.6,
    modifiers: signals, evidence: e.ev(...habits, ...signals, "body.emotion"), contradictions: [], sufficiency: "corroborated",
    distinctive: "Routines are in place; energy and attention to signals are lower.",
    heading: "Well managed, less often listened to", lead: "Your body may be well managed and less often listened to.",
    observation: `Much of your Body Orbit is in decent shape: ${list(habits.map((h) => ({ "body.02": "eating", "body.03": "movement", "body.05": "comfort in your body" } as Record<string, string>)[h]))} ${habits.length > 1 ? "are" : "is"} mostly there. Yet ${list(signals.map((s) => (s === "body.01" ? "having enough energy for your everyday demands" : "noticing when your body asks for rest, food, movement or care")))} ${signals.length > 1 ? "feel" : "feels"} less true right now${t.includes("depletion") || t.includes("tension") ? `, and ${e.c.feelings("body")} are what you feel there` : ""}.`,
    meaning: "One possibility is that your body is being run well, on sound habits, while its signals reach you later than they could. A body can be looked after in its routines and still be where trade-offs made elsewhere accumulate.",
    alternative: "It could also reflect demands on your energy that no habit can fully offset.",
    why: "Signals heard early are easier to answer than signals heard late.",
    question: { text: "What has your body been telling you lately that you've noticed but not yet answered?", intent: "learn" },
  }];
};

// ── 12. Joy: room rather than permission ───────────────────────────────────
const joyRoom: Rel = (e) => {
  const thin = ["joy.03", "joy.04", "joy.06"].filter(e.no);
  if (!e.yes("joy.02") || thin.length < 2) return [];
  return [{
    id: "joy:room", relationship: "joy-room", areas: ["joy", ...(e.roles.crowded === "joy" && e.roles.demand ? [e.roles.demand] : [])], kind: "tension", discovery: "distinction", homes: ["standsOut", "connections"], score: 0.58 + (e.roles.crowded === "joy" ? 0.06 : 0),
    modifiers: e.roles.crowded === "joy" ? ["interconnections.04"] : [], evidence: e.ev("joy.02", ...thin, "joy.emotion", ...(e.roles.crowded === "joy" ? ["interconnections.04", "interconnections.01"] : [])), contradictions: [], sufficiency: "corroborated",
    distinctive: "Permission for pleasure is present; room for it is not.",
    heading: "Joy: room, not permission", lead: "Joy isn't troubled so much as under-used.",
    observation: `You can enjoy pleasure without feeling you have to earn it, so Joy's difficulty doesn't look like permission. What's thinner is room: ${list(thin.map((t) => ({ "joy.03": "space for creativity, beauty or play", "joy.04": "time for what makes you feel alive", "joy.06": "chances to use your talents" } as Record<string, string>)[t]))}${e.roles.crowded === "joy" && e.roles.demand ? `. Joy is also the area you said receives less care because another part of your life demands so much` : ""}.`,
    meaning: "A Joy Orbit that's allowed but under-fed often feels like boredom or restlessness beside contentment. The fix there is rarely more permission; it's more space.",
    alternative: "It may also be a choice to keep life simple for now.",
    why: "Knowing that the barrier is room rather than permission points to a different kind of change.",
    question: { text: "What would you do with a free afternoon if it didn't have to be restful or productive, only alive?", intent: "create" },
  }];
};

// ── 13. Energy architecture (always available, chooses its angle by evidence) ──
const energy: Rel = (e) => {
  const { givers, takers, soleGiver, soleTaker } = e.map;
  const restCosts = e.c.takes("restoration");
  const ev = e.ev(...ORBITS.map((o) => `${o}.energy`));
  if (soleGiver && takers.length >= 3) return [{
    id: `energy:sole-giver:${soleGiver}`, relationship: "energy-architecture", areas: [soleGiver, ...takers], kind: "mixed", discovery: "connection", homes: ["energy"], score: 0.64,
    modifiers: ["map.soleGiver", ...(restCosts ? ["restoration.energy"] : [])], evidence: ev, contradictions: [], sufficiency: "explicit",
    distinctive: `${e.N(soleGiver)} is the only Orbit that gives more energy than it takes.`,
    heading: `${e.N(soleGiver)}, doing more than its size suggests`, lead: `${cap(NUM[takers.length] ?? String(takers.length))} Orbits ask for energy and only ${e.N(soleGiver)} gives more back.`,
    observation: `${list(takers.map(e.N))} take more energy than they give. ${e.N(soleGiver)} alone returns more than it takes${restCosts ? ", and even rest is currently costing energy rather than returning it" : ""}.`,
    meaning: `When ${restCosts ? "rest itself has become a cost" : "most areas ask for energy"}, ${e.N(soleGiver)} may be doing some of the restoring. It's worth asking whether it gets the place in your week that its role deserves.`,
    alternative: "Energy can also shift from week to week; this is a snapshot.",
    why: "Knowing where energy comes back lets you protect it when demands rise.",
    question: { text: `What would change if you counted your ${e.N(soleGiver)} Orbit as part of how you recover, rather than as something extra?`, intent: "energy" },
  }];
  if (restCosts && givers.length) return [{
    id: "energy:rest-costs", relationship: "energy-architecture", areas: ["restoration", ...givers], kind: "mixed", discovery: "reframing", homes: ["energy"], score: 0.62,
    modifiers: ["restoration.energy", "restoration.emotion"], evidence: uniq([...ev, ...e.ev("restoration.emotion")]), contradictions: [], sufficiency: "explicit",
    distinctive: "Rest takes energy, while engagement gives it.",
    heading: "Energy that comes back through aliveness", lead: "Your energy seems to return through aliveness more than through stopping.",
    observation: `${list(givers.map(e.N))} ${givers.length > 1 ? "give" : "gives"} you energy, while Restoration currently takes more than it gives${e.c.tones("restoration").strained.length ? `, arriving with ${e.c.feelings("restoration")}` : ""}.`,
    meaning: "When rest comes with rush or guilt attached, it can cost energy rather than return it, which may be part of why stopping hasn't felt worth protecting. For you, replenishment might come as much from what makes you feel alive as from stopping.",
    alternative: "Rest may also simply need more time than it currently gets before it starts to restore.",
    why: "Knowing what actually refills you makes it easier to protect.",
    question: { text: "What restores you in a way that feels alive rather than merely still?", intent: "energy" },
  }];
  if (!takers.length && givers.length >= 4) return [{
    id: "energy:surplus", relationship: "energy-architecture", areas: givers, kind: "strength", discovery: "recognition", homes: ["energy"], score: 0.56,
    modifiers: [], evidence: ev, contradictions: [], sufficiency: "explicit",
    distinctive: "No Orbit takes more energy than it gives.",
    heading: "An energy surplus", lead: "Nothing on your Map drains you.",
    observation: `${cap(NUM[givers.length] ?? String(givers.length))} Orbits give you energy, the rest hold it steady, and none takes more than it gives.${e.roles.demand && !e.c.takes(e.roles.demand) ? ` Even ${e.N(e.roles.demand)}, which asks the most of your attention, keeps your energy stable.` : ""}`,
    meaning: "An energy system this balanced may have more room than it currently uses for something that both matters to you and replenishes you.",
    alternative: "A surplus can also be a sign of a lighter time, which is worth enjoying as it is.",
    why: "Knowing where spare energy goes lets you decide where it should go.",
    question: { text: "At the end of a good week, where does your spare energy actually go?", intent: "energy" },
  }];
  if (!takers.length && givers.length) {
    const flat = (["growth", "joy"] as OrbitId[]).filter((o) => !e.c.gives(o));
    const flatImp = flat.filter((o) => e.c.important(o));
    return [{
      id: "energy:steady", relationship: "energy-architecture", areas: [...givers, ...flat], kind: "mixed", discovery: "connection", homes: ["energy"], score: 0.58,
      modifiers: flat.map((o) => `${o}.energy`), evidence: ev, contradictions: [], sufficiency: "explicit",
      distinctive: "Nothing drains energy; only a few Orbits give it.",
      heading: "Nothing leaking, little lighting up", lead: `Nothing on your Map drains you, and ${list(givers.map(e.N))} ${givers.length > 1 ? "are" : "is"} where energy comes back.`,
      observation: `${list(givers.map(e.N))} ${givers.length > 1 ? "give" : "gives"} back more than ${givers.length > 1 ? "they take" : "it takes"}, and every other Orbit holds steady. That's a sustainable system: nothing is leaking.${flatImp.length ? ` ${list(flatImp.map(e.N))}, which you rated as important, ${flatImp.length > 1 ? "hold" : "holds"} steady rather than lifting you.` : ""}`,
      meaning: e.roles.source ? `You named ${e.N(e.roles.source)} as where you feel most alive. What makes it work there may be worth carrying into the areas that currently hold steady rather than rise.` : "A system with nothing leaking has room to add something that lifts you, not only something that keeps you steady.",
      alternative: "Steady can also be exactly what you need right now.",
      why: "Energy that holds steady is a base; energy that rises is a signal of what feeds you.",
      question: { text: "Outside the places that already lift you, when did you last feel your energy rise rather than simply hold steady?", intent: "energy" },
    }];
  }
  if (soleTaker) return [{
    id: `energy:sole-taker:${soleTaker}`, relationship: "energy-architecture", areas: [soleTaker], kind: "neutral", discovery: "connection", homes: ["energy"], score: 0.5,
    modifiers: [], evidence: ev, contradictions: [], sufficiency: "explicit",
    distinctive: `${e.N(soleTaker)} is the only Orbit that takes more than it gives.`,
    heading: "Energy concentrated, not scarce", lead: `Most of your energy system works for you; ${e.N(soleTaker)} is the one cost.`,
    observation: `${givers.length ? `${list(givers.map(e.N))} ${givers.length > 1 ? "give" : "gives"} you energy, and ` : ""}${e.N(soleTaker)} is the only Orbit that takes more than it gives.`,
    meaning: "The picture is less about scarcity than about routing: energy comes in, and some of it may be absorbed in one place before it reaches the areas you'd most like to feed.",
    alternative: "This can change with circumstances; it's a snapshot.",
    why: "A single, clear cost is easier to work with than a diffuse one.",
    question: { text: "Where does the energy your strongest Orbits give you actually go by the end of a week?", intent: "energy" },
  }];
  return [];
};

// ── 14. Relationship with yourself ─────────────────────────────────────────
const sun: Rel = (e) => {
  const out: Reading[] = [];
  const mk = (id: string, ev: string[], heading: string, observation: string, meaning: string, question: string, score: number, kind: Reading["kind"] = "mixed"): Reading => ({
    id: `sun:${id}`, relationship: `sun-${id}`, areas: ["sun"], kind, discovery: "distinction", homes: ["sun"], score, modifiers: ev, evidence: e.ev(...ev), contradictions: [], sufficiency: "corroborated",
    distinctive: "A specific pairing of answers about your relationship with yourself.", lens: { name: "self-compassion research; identity", type: "theory" },
    heading, lead: heading, observation, meaning, alternative: "Neither answer is a flaw; the parts of a relationship with yourself don't all develop at the same pace.",
    why: "How you treat yourself shapes how every other area is lived.", question: { text: question, intent: "self" },
  });
  if (e.yes("sun.04") && e.yes("sun.08") && (e.no("sun.03") || e.no("sun.10")))
    out.push(mk("lead-care", ["sun.04", "sun.08", "sun.03", "sun.10"], "Leading yourself, looking after yourself",
      `Your relationship with yourself has real authority in it: you trust your decisions and keep the promises you make to yourself. What seems less settled is its tone: ${list([e.no("sun.03") ? "being honest with yourself without being hard on yourself" : "", e.no("sun.10") ? "keeping your own wellbeing a priority when life gets difficult" : ""].filter(Boolean))} ${e.no("sun.03") && e.no("sun.10") ? "feel" : "feels"} less available.`,
      "You may lead yourself well and look after yourself less: two roles one person can hold, though they ask for different kinds of attention.",
      "When you're honest with yourself about something difficult, does it sound more like encouragement or like a verdict?", 0.72));
  if (e.yes("sun.02") && e.no("sun.03") && !out.length)
    out.push(mk("clear-gentle", ["sun.02", "sun.03"], "Seeing clearly, being gentle",
      "You can admit to yourself when something isn't right. Being honest about difficult things without being cruel to yourself feels less available, though.",
      "Seeing clearly and being gentle with what you see are two different skills. You may be holding yourself to account without the kindness you'd offer someone else.",
      "How do you speak to yourself when you notice something isn't right?", 0.7));
  if ((e.yes("sun.02") || e.yes("sun.11")) && e.no("sun.06") && (e.no("sun.04") || e.no("sun.01")))
    out.push(mk("private-public", ["sun.02", "sun.11", "sun.06", "sun.04", "sun.01"], "Strongest where it's private",
      `Your relationship with yourself is strongest where it's private: ${list([e.yes("sun.02") ? "you admit when something isn't right" : "", e.yes("sun.11") ? "you hold a sense of meaning through change" : "", e.yes("sun.08") ? "you keep promises to yourself" : ""].filter(Boolean))}. It thins at the point of contact with others: standing by a need that might disappoint someone doesn't feel true right now${e.no("sun.04") ? ", and trusting your own important decisions is only partly there" : ""}.`,
      "Self-honesty seems well established. Backing yourself in front of others may be the part still being built.",
      "Is there a decision you've been waiting for someone else to confirm before you let yourself trust it?", 0.74));
  if (e.yes("sun.11") && e.no("sun.10") && !out.some((r) => r.id === "sun:lead-care"))
    out.push(mk("meaning-care", ["sun.11", "sun.10"], "Meaning that carries you, sometimes at your own expense",
      "You have a sense of what gives your life meaning. Keeping your own wellbeing a priority when life gets difficult feels less true, though.",
      "Meaning can keep you going; it doesn't always look after you. Your sense of purpose may be carrying you through, sometimes at your own expense.",
      "When life gets difficult, what's usually the first thing you let go of?", 0.66));
  if ((e.yes("sun.03") || e.yes("sun.10")) && (e.no("sun.01") || e.no("sun.11")))
    out.push(mk("care-direction", ["sun.03", "sun.10", "sun.01", "sun.11"], "Caring for who you are, unsure of who you're becoming",
      `Your relationship with yourself looks well practised in one direction: ${list([e.yes("sun.02") ? "you admit when something isn't right" : "", e.yes("sun.03") ? "you're honest without being harsh" : "", e.yes("sun.10") ? "you keep your wellbeing a priority under pressure" : "", e.yes("sun.07") ? "you own mistakes without being defined by them" : ""].filter(Boolean))}. Two things land more softly: ${list([e.no("sun.01") ? "knowing what you truly want when others expect something different" : "", e.no("sun.11") ? "holding a sense of meaning while your direction changes" : ""].filter(Boolean))}.`,
      "You may know very well how to care for who you are, and be less sure yet of who you're becoming. The second often takes shape through experience more than reflection.",
      "When you imagine wanting something no one around you expects of you, what comes to mind first?", 0.72));
  if (e.yes("sun.01") && e.no("sun.06") && !out.some((r) => r.id === "sun:private-public"))
    out.push(mk("knowing-standing", ["sun.01", "sun.06"], "Knowing what you want, and standing by it",
      "You know what you truly want, even when others expect something different. Standing by your needs when it might disappoint someone feels less true right now.",
      "Knowing and acting on what you know don't always move together. Other people's disappointment may weigh more than what you know you need.",
      "Where does knowing what you want stop, and acting on it begin to feel costly?", 0.68));
  if (e.sunStrong.length >= 8)
    out.push(mk("integrated", ["sun.04", "sun.07", "sun.09", "sun.11", "sun.03"].filter(e.yes), "A steady and kind relationship with yourself",
      `Your relationship with yourself reads as steady and kind: ${list([e.yes("sun.04") ? "you trust yourself with important decisions" : "", e.yes("sun.07") ? "you own mistakes without letting them become your identity" : "", e.yes("sun.09") ? "you accept the different sides of yourself, strengths, flaws and contradictions included" : ""].filter(Boolean))}.`,
      "When you don't have to choose between parts of yourself, the parts of your life may not have to compete either. Your footing seems to come from who you are rather than where you're heading.",
      "When you're at your steadiest, what are you doing differently from your harder days?", 0.64, "strength"));
  if (!out.length) {
    const strong = e.sunStrong;
    out.push(mk("even", strong.slice(0, 3).length ? strong.slice(0, 3) : ["sun.02"], "Your relationship with yourself",
      strong.length ? `Some parts of this relationship appear well established: ${list(strong.slice(0, 3).map((id) => e.c.capOf(id)))}.` : "Your answers about your relationship with yourself sit mostly in the middle, not strongly one way or the other.",
      "That can mean things feel steady, or that some of these questions are still open for you. An open question can be a more honest place to stand than a quick answer.",
      "What would you most like to be able to count on from yourself?", 0.4, "neutral"));
  }
  return out;
};

// ── 15. What supports you (composed from the strengths present) ────────────
const supports: Rel = (e) => {
  const facts: { id: string[]; text: string }[] = [];
  if (["resources.01", "resources.02", "resources.04", "resources.06"].filter(e.yes).length >= 3) facts.push({ id: ["resources.01", "resources.04", "resources.06"], text: "your financial and living situation is one you understand, can make decisions about and feel free within" });
  if (e.yes("social.01") && e.yes("social.02")) facts.push({ id: ["social.01", "social.02"], text: "the people closest to you support who you are and who you're becoming, and with some of them you feel genuinely seen" });
  if (e.yes("restoration.05") && e.yes("restoration.06")) facts.push({ id: ["restoration.05", "restoration.06"], text: "your self-care feels like genuine care, and you can rest without guilt" });
  if (e.yes("body.06") && e.yes("body.04")) facts.push({ id: ["body.06", "body.04"], text: "you treat your body with care rather than pressure, and notice what it asks for" });
  if (!e.isNA("love.05") && e.yes("love.05") && e.yes("love.06")) facts.push({ id: ["love.05", "love.06"], text: "you can care deeply for someone without losing yourself, and be vulnerable without feeling weak" });
  if (e.yes("social.07")) facts.push({ id: ["social.07"], text: "you can recognize when a relationship or environment drains you" });
  if (e.yes("sun.07")) facts.push({ id: ["sun.07"], text: "you take responsibility for mistakes without letting them define you" });
  if (e.yes("joy.05")) facts.push({ id: ["joy.05"], text: "what you enjoy reflects your own interests rather than what looks impressive" });
  if (e.yes("mind.03")) facts.push({ id: ["mind.03"], text: "you can tell inherited beliefs from ones you've chosen" });
  if (e.yes("social.06") && !(e.yes("social.01") && e.yes("social.02"))) facts.push({ id: ["social.06"], text: "you belong to a community where you can be yourself" });
  if (e.yes("social.05")) facts.push({ id: ["social.05"], text: "you make room to contribute to people or communities beyond your work" });
  if (e.yes("resources.03")) facts.push({ id: ["resources.03"], text: "your home supports your wellbeing and everyday routines" });
  if (e.yes("mind.06")) facts.push({ id: ["mind.06"], text: "you take your feelings seriously before deciding how to respond" });
  if (e.yes("sun.09")) facts.push({ id: ["sun.09"], text: "you recognize and accept the different sides of yourself, including your strengths, flaws and contradictions" });
  if (e.yes("sun.11")) facts.push({ id: ["sun.11"], text: "you have a sense of what gives your life meaning, even as your direction changes" });
  if (e.yes("growth.01") && e.yes("growth.04")) facts.push({ id: ["growth.01", "growth.04"], text: "you're actively learning and deliberately trying new things" });
  if (facts.length < 2) return [];
  const top = facts.slice(0, 3);
  const ev = e.ev(...facts.flatMap((f) => f.id));
  const strained = e.map.takers.length >= 2 || e.map.far.length >= 2;
  return [{
    id: "supports:foundation", relationship: "what-supports", areas: [], kind: "strength", discovery: "recognition", homes: ["support"], score: 0.55,
    modifiers: [], evidence: ev, contradictions: [], sufficiency: "corroborated",
    distinctive: `${top.length} strengths present in the answers.`,
    heading: "What's already holding", lead: strained ? "Underneath what's demanding, there's solid ground." : "Several foundations are working well here.",
    observation: `Several foundations are in place: ${list(top.map((f) => f.text))}.`,
    meaning: strained
      ? "These aren't small things to have during a demanding time. They suggest that whatever you might choose to shift, you'd be doing it from strength rather than scarcity."
      : "Strengths like these become easy to overlook for the person who has them. Naming them matters: what we don't notice, we rarely protect.",
    alternative: "Support can shift when circumstances change, which is part of why it's worth naming now.",
    why: "Noticing what already works gives you something to build from, not only things to fix.",
    question: { text: "Which of these would you most want to protect if life became more demanding?", intent: "preserve" },
    facts,
  }];
};

// ── 16. Private follow-through, visible hesitation (Growth) ────────────────
const exposure: Rel = (e) => {
  const fear = ["growth.03", "growth.06"].filter(e.endorsed);
  const priv = ["body.03", "restoration.03", "sun.08"].filter(e.yes);
  if (!fear.length || !e.c.important("growth") || priv.length < 2) return [];
  return [{
    id: "growth:exposure", relationship: "private-vs-visible", areas: ["growth", "sun"], kind: "tension", discovery: "distinction", homes: ["tension", "standsOut"], score: 0.7,
    modifiers: priv, module: "will-capacity", evidence: e.ev(...fear, ...priv, "growth.importance"), contradictions: [], sufficiency: "corroborated",
    distinctive: "Follow-through is strong where it's private; hesitation appears where it could be seen.",
    lens: { name: "the knowing-doing gap; self-efficacy", type: "theory" },
    heading: "Private follow-through, visible hesitation", lead: "You follow through readily where the outcome is private; hesitation appears where it could be seen.",
    observation: `${list(priv.map((p) => ({ "body.03": "Movement is a regular part of your life", "restoration.03": "you recover before exhaustion", "sun.08": "you keep promises to yourself" } as Record<string, string>)[p]))}, and none of that needs an audience. Growth works differently: ${list(fear.map((f) => (f === "growth.06" ? "you often know what would help you grow and put it off" : "fear of failure or judgment sometimes stops you trying")))}.`,
    meaning: "This doesn't look like a gap in knowledge or discipline. The difference may be exposure: caring for yourself can falter quietly, while trying something new can falter in view. What helps with feeling observed is rarely what helps with low discipline.",
    alternative: "It may also be that the growth you have in mind is genuinely bigger and riskier than your private routines.",
    why: "Naming the real barrier points to the kind of first step that would actually feel possible.",
    question: { text: "Of the growth steps you've put off, is it the step itself that feels hard, or being seen attempting it?", intent: "postpone" },
  }];
};

// ── 17. Familiar circumstances and change ──────────────────────────────────
const familiar: Rel = (e) => {
  if (!(e.endorsed("resources.05") && e.endorsed("growth.06"))) return [];
  const goodBase = e.yes("resources.03");
  return [{
    id: "familiar:change", relationship: "familiar-and-change", areas: ["resources", "growth"], kind: "tension", discovery: "connection", homes: ["connections"], score: 0.6,
    modifiers: goodBase ? ["resources.03"] : [], module: "acceptance-resignation", evidence: e.ev("resources.05", "growth.06", "resources.03"), contradictions: goodBase ? e.ev("resources.03") : [], sufficiency: "corroborated",
    distinctive: "The same pull toward the known appears in two different Orbits.",
    lens: { name: "uncertainty and action (knowing-doing gap)", type: "theory" },
    heading: "The pull of the familiar", lead: "Across two different Orbits, the pull toward the known looks alike.",
    observation: `You tend to stay in familiar financial or living circumstances because change feels uncertain, and you often know what would help you grow but put it off.${goodBase ? " Your home supports you well, so the familiar isn't a bad place to be." : ""}`,
    meaning: "Across two very different Orbits the pull toward what's known looks alike, which suggests it may be one pattern rather than two. Clarity tends to follow a small step more often than it precedes it.",
    alternative: "Staying with the familiar can also be wise; not every change is the right one, or the right one now.",
    why: "Seeing one pattern instead of two makes it easier to choose where to test it.",
    question: { text: "What are you protecting by keeping things as they are, and what might you be ready to explore?", intent: "tolerate" },
  }];
};

// ── 18. Others' expectations and ownership (when not already central) ───────
const expectations: Rel = (e) => {
  const X = e.roles.expect;
  if (!X) return [];
  const cg = e.cong(X);
  if (cg === "own") return [{
    id: `expect:${X}:owned`, relationship: "expectations", areas: [X], kind: "strength", discovery: "reframing", homes: ["connections", "standsOut"], score: 0.45,
    modifiers: [`${X}.congruence`], evidence: e.ev("interconnections.06", `${X}.congruence`), contradictions: [], sufficiency: "corroborated",
    distinctive: "Most shaped by expectations, yet lived on your own terms.",
    heading: `${e.N(X)}: influence and choice`, lead: `${e.N(X)} is shaped by others and still feels like yours.`,
    observation: `${e.N(X)} is the area you named as most shaped by other people's expectations, and yet the way you live it ${congPhrase(e, X)}.`,
    meaning: "Being influenced isn't the same as living someone else's life. Some expectations are ones you share, and you seem to have made them your own.",
    alternative: "It may still be worth checking, now and then, which expectations you'd keep if no one were watching.",
    why: "Knowing which influences you've chosen protects the ones that matter.",
    question: { text: `Which expectations in your ${e.N(X)} Orbit have you genuinely made your own?`, intent: "values" },
  }];
  if (cg === "not" && !e.c.important(X)) return [];
  return [{
    id: `expect:${X}:shaped`, relationship: "expectations", areas: [X], kind: "tension", discovery: "recognition", homes: ["connections", "tension"], score: cg === "not" ? 0.62 : 0.48,
    modifiers: [`${X}.congruence`], module: "chosen-imposed", evidence: e.ev("interconnections.06", `${X}.congruence`), contradictions: [], sufficiency: "corroborated",
    distinctive: `Most shaped by expectations, and lived ${cg === "not" ? "not yet on your own terms" : "partly on your own terms"}.`,
    lens: { name: "the public persona", type: "philosophy" },
    heading: `Where others' expectations come in`, lead: `${e.N(X)} is where other people's voices are loudest for you.`,
    observation: `${e.N(X)} is the area you named as most shaped by other people's expectations, and the way you live it ${congPhrase(e, X)}.`,
    meaning: "Everyone carries a version of themselves shaped to meet others' expectations. It's useful and often kind, but when it starts making the decisions, life can begin to feel slightly borrowed.",
    alternative: "Some of those expectations may be ones you share and would keep.",
    why: "Sorting chosen from inherited expectations gives you back a choice.",
    question: { text: `Which parts of your ${e.N(X)} Orbit feel like choices you've made, and which feel like choices you've inherited?`, intent: "values" },
  }];
};

// ── 19. Knowing what you want, and how one area is lived ───────────────────
const knowLive: Rel = (e) => {
  const kl = knowingLiving(e);
  if (kl.side !== "gap" || !kl.orbit) return [];
  const o = kl.orbit;
  return [{
    id: `knowing-living:${o}`, relationship: "knowing-vs-living", areas: ["sun", o], kind: "mixed", discovery: "distinction", homes: ["connections", "tension"], score: 0.6,
    modifiers: [`${o}.congruence`], module: "knowing-living", evidence: kl.evidence, contradictions: [], sufficiency: "corroborated",
    distinctive: `Clarity about what you want, alongside ${e.N(o)} not yet lived on your own terms.`,
    lens: { name: "identity and authenticity", type: "philosophy" },
    heading: "Knowing and living", lead: `What you know about yourself hasn't fully reached ${e.N(o)} yet.`,
    observation: `You describe knowing what you want and trusting your own judgment. In ${e.N(o)}, though, the way you live it ${congPhrase(e, o)}.`,
    meaning: "That isn't a contradiction so much as a place where knowing and living haven't lined up yet. Insight is the beginning; arranging a life around it usually asks for courage more than clarity.",
    alternative: "Circumstances in that area may allow less than you'd choose.",
    why: "Seeing where knowing and living part ways shows where a small change would mean the most.",
    question: { text: "Where does what you already know about yourself show up in how you live, and where doesn't it yet?", intent: "values" },
  }];
};

// ── 20. A crowded-out area rated unimportant ───────────────────────────────
const crowdedQuiet: Rel = (e) => {
  const C = e.roles.crowded;
  if (!C || !e.c.unimportant(C)) return [];
  return [{
    id: `crowded-quiet:${C}`, relationship: "crowded-but-unimportant", areas: [C], kind: "mixed", discovery: "recognition", homes: ["connections"], score: 0.5,
    modifiers: [`${C}.importance`], evidence: e.ev("interconnections.04", `${C}.importance`), contradictions: [], sufficiency: "explicit",
    distinctive: "Named as getting less care, and rated as not very important.",
    heading: `${e.N(C)}, quietly set aside`, lead: `${e.N(C)} gets less care, and you don't rate it as a priority.`,
    observation: `You said ${e.N(C)} receives less care because another part of your life demands so much, and you also rated it "${e.said(`${C}.importance`)}".`,
    meaning: "Sometimes we rate something as unimportant because it hasn't had room in a while, not because it doesn't matter. Or the trade-off may genuinely sit well with you.",
    alternative: "It may simply be a sensible allocation for now.",
    why: "Knowing whether a quiet area is resting or waiting tells you whether to leave it be.",
    question: { text: `Is the space your ${e.N(C)} Orbit has right now one you're at peace with?`, intent: "tolerate" },
  }];
};

// ── 21. How the parts of life fit together (Interconnections Q7) ─────────────
const system: Rel = (e) => {
  const v = e.roles.overall;
  if (!v) return [];
  const competes = v.includes("compete"), supportsEach = v.includes("support");
  return [{
    id: `system:${v}`, relationship: "overall-system", areas: [], kind: competes ? "tension" : supportsEach ? "strength" : "mixed", discovery: "connection", homes: ["connections"], score: 0.4,
    modifiers: [], evidence: e.ev("interconnections.07"), contradictions: [], sufficiency: "explicit",
    distinctive: "How the person sees their Orbits working together.",
    heading: "How the parts fit together", lead: SUPPORT_COMPETE_READING[v] ?? "",
    observation: SUPPORT_COMPETE_READING[v] ?? `You described the parts of your life this way: ${e.said("interconnections.07")}.`,
    meaning: competes ? "When areas compete, every choice can feel like it costs something. Seeing the whole picture is what lets you choose the trade-offs, rather than simply absorb them." : supportsEach ? "When the parts of a life support each other, effort in one tends to carry into the rest. That's a kind of design, whether or not you planned it." : "Knowing which areas lift each other and which compete is most of what makes a trade-off something you choose rather than something that happens.",
    alternative: "This can shift as demands change.",
    why: "How your areas interact shapes where a change would travel.",
    question: { text: "Which two areas of your life help each other most, and which two pull hardest against each other?", intent: "learn" },
  }];
};

export const RELATIONSHIPS: Rel[] = [system, supportAgency, strainDirection, momentum, capacity, supportPermission, searching, harmony, asksGives, tradeOff, lever, permission, busyMind, bodySignals, joyRoom, energy, sun, supports, exposure, familiar, expectations, knowLive, crowdedQuiet];
export const LIBRARY_VERSION = "relationships-1";

export function candidateReadings(e: E): Reading[] {
  return RELATIONSHIPS.flatMap((r) => r(e));
}
