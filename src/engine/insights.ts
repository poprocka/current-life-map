/**
 * Respondent-facing personal insights (Decision Guide §4–§6, 12 Oct 2026).
 * Five evidence-conditioned cards shown below the Map and Reality Snapshot, plus an eight-Orbit narrative library.
 *
 * Rules: every sentence rests on a direct answer, an approved calculation, or is worded as tentative; F6 relative
 * language only ("more/less supported in your responses", "similar" when differences < 0.10); fallbacks instead
 * of filler; one question to take with you, chosen from an approved library with a neutral fallback.
 * Copy is DRAFT pending Jana's approval (screenshots = tonal direction).
 */
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { itemEvidence } from "@/engine/compute";
import { QUESTION_BANK, questionById } from "@/content/v10/question-bank";
import type { AnswerValue, OrbitId } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { PHRASES } from "@/engine/coach/phrases";

export const INSIGHTS_TEMPLATE_VERSION = "result-insights-1";
export const F6_TOLERANCE = 0.1;
export const INSIGHT_DISCLAIMER = "These are provisional interpretations based on your self-reported answers. They are invitations to reflect, not diagnoses or psychological assessments.";

export interface InsightSection { id: string; heading: string; text: string; evidence: { questionId: string; answer: string }[]; claim: "direct" | "derived" | "tentative" }
export interface InsightCard { key: "overview" | "support" | "tension" | "energy" | "begin"; title: string; lead: string; sections: InsightSection[]; fallback: boolean }
export interface OrbitNarrative { orbit: OrbitId; name: string; paragraphs: string[]; question: string; evidence: { questionId: string; answer: string }[] }
export interface ResultInsights { templateVersion: string; cards: InsightCard[]; questionToTakeWithYou: { text: string; theme: string }; orbits: OrbitNarrative[] }

type Answers = Record<string, AnswerValue | undefined>;
const NAMES: Record<OrbitId, string> = { mind: "Mind", body: "Body", restoration: "Restoration", growth: "Growth", love: "Love", social: "Social World", resources: "Resources", joy: "Joy" };
const list = (xs: string[]) => {
  if (xs.length <= 1) return xs.join("");
  const sep = xs.some((x) => x.includes(",")) ? "; " : ", ";
  return `${xs.slice(0, -1).join(sep)}${sep === "; " ? "; and " : " and "}${xs[xs.length - 1]}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Third-person coach phrases → second person for the respondent. */
export function toYou(s: string) {
  return s.replace(/\bthemselves\b/g, "yourself").replace(/\btheir\b/g, "your").replace(/\bthey\b/g, "you").replace(/\bthem\b/g, "you");
}

/** Question to take with you — approved library (draft) keyed by theme; one shown. */
export const QUESTION_LIBRARY: Record<string, (x: string) => string> = {
  leverage: (o) => `If ${o} improved even a little, what would you notice first in the rest of your life?`,
  gap: (o) => `What would it take for ${o} to receive the time and energy you say it deserves?`,
  expectations: () => "Is the life you are living an expression of who you are, or have you simply become very good at performing it?",
  important_draining: (o) => `What would make ${o} feel less costly to sustain, while keeping what it means to you?`,
  crowded: (o) => `Is the space ${o} currently has a choice you would make again for this season?`,
  neutral: () => "Which part of your Map felt most true, and what would you like to do with that?",
};

export function generateResultInsights(result: LifeMapResult, answers: Answers): ResultInsights {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o])) as Record<OrbitId, OrbitResult>;
  const ic = result.interconnections;
  const label = (id: string) => {
    const a = answers[id]; if (a === undefined) return "Not answered";
    const q = questionById(id); const v = Array.isArray(a) ? a[0] : a;
    return v === NOT_APPLICABLE ? "Not applicable" : q?.options.find((o) => o.value === v)?.label ?? String(v);
  };
  const ev = (id: string) => ({ questionId: id, answer: label(id) });
  const keyed = (id: string) => itemEvidence(id, answers[id]).keyed;
  const high = (id: string) => (keyed(id) ?? -1) >= 0.75;
  const low = (id: string) => { const k = keyed(id); return k !== null && k <= 0.25; };
  const youCap = (id: string) => toYou(PHRASES[id]?.cap ?? questionById(id)?.prompt ?? id);
  const statements = (o: OrbitId | "sun") => QUESTION_BANK.filter((q) => q.chapterId === o && q.responseType === "truth" && q.enabled && q.measure !== "congruence").map((q) => q.id);
  const sufficient = result.orbits.filter((o) => o.supportConfidence === "sufficient" && o.responseSupportIndex !== null);

  // ── F6 comparison: groups within tolerance; "similar" when the spread is small ──
  const spread = sufficient.length >= 2 ? Math.max(...sufficient.map((o) => o.responseSupportIndex!)) - Math.min(...sufficient.map((o) => o.responseSupportIndex!)) : 0;
  const top = spread >= F6_TOLERANCE ? sufficient.filter((o) => Math.max(...sufficient.map((x) => x.responseSupportIndex!)) - o.responseSupportIndex! < F6_TOLERANCE / 2) : [];
  const bottom = spread >= F6_TOLERANCE ? sufficient.filter((o) => o.responseSupportIndex! - Math.min(...sufficient.map((x) => x.responseSupportIndex!)) < F6_TOLERANCE / 2) : [];
  const isLower = (o: OrbitResult) => bottom.includes(o);

  // ── Card A: the wider picture ─────────────────────────────────────────────
  const A: InsightSection[] = [];
  const maxImp = Math.max(...result.orbits.map((o) => o.importanceDirect ?? -1));
  const weighty = maxImp >= 0.5 ? result.orbits.filter((o) => o.importanceDirect === maxImp) : [];
  if (weighty.length)
    A.push({ id: "overview.weight", heading: "The areas carrying the most weight", claim: "direct", evidence: weighty.map((o) => ev(`${o.orbit}.importance`)),
      text: `You placed particular importance on ${list(weighty.map((o) => o.name))}. Importance does not mean an area must dominate your time. It tells us what matters to you in this season.` });
  if (sufficient.length >= 2) {
    if (spread < F6_TOLERANCE)
      A.push({ id: "overview.similar", heading: "How support is spread", claim: "derived", evidence: sufficient.map((o) => ({ questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex) })),
        text: "Your answers describe a similar level of support across the areas of your life, so no single area stands apart. The individual statements may say more than any comparison." });
    else
      A.push({ id: "overview.picture", heading: "Where the picture is fuller, and where it is thinner", claim: "derived", evidence: [...top, ...bottom].map((o) => ({ questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex) })),
        text: `${list(top.map((o) => o.name))} ${top.length > 1 ? "are" : "is"} more supported in your responses; ${list(bottom.map((o) => o.name))} ${bottom.length > 1 ? "are" : "is"} less supported by comparison. These are starting points for reflection, not fixed labels.` });
  }
  const contrast = weighty.find((o) => isLower(o)) ?? result.orbits.find((o) => (o.importanceDirect ?? 0) >= 0.75 && isLower(o));
  const quietChoice = result.orbits.find((o) => (o.importanceDirect ?? 1) <= 0.25 && isLower(o));
  if (contrast)
    A.push({ id: "overview.contrast", heading: "A contrast worth noticing", claim: "tentative", evidence: [ev(`${contrast.orbit}.importance`), { questionId: `${contrast.orbit}.*`, answer: String(contrast.responseSupportIndex) }],
      text: `You place high importance on ${contrast.name}, while several answers suggest it feels less supported in daily life. That gap may be worth understanding before deciding what, if anything, to change.` });
  else if (quietChoice)
    A.push({ id: "overview.quiet", heading: "A conscious allocation?", claim: "tentative", evidence: [ev(`${quietChoice.orbit}.importance`)],
      text: `You currently place less importance on ${quietChoice.name}, and your responses suggest it feels less supported. This may be a conscious allocation of your attention in this season.` });
  const adequate = sufficient.length >= 5;

  // ── Card B: what supports you ─────────────────────────────────────────────
  const B: InsightSection[] = [];
  const supported = top.length ? top : [];
  if (supported.length > 2)
    B.push({ id: "support.group", heading: "Where your answers describe more support", claim: "derived", evidence: supported.map((o) => ({ questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex) })),
      text: `Your answers describe more support in ${list(supported.map((o) => o.name))} than elsewhere in your life right now. What are you already doing there that helps?` });
  else for (const o of supported) {
    const strong = statements(o.orbit).filter(high).slice(0, 2);
    B.push({ id: `support.${o.orbit}`, heading: `The support you described in ${o.name}`, claim: "derived", evidence: strong.length ? strong.map(ev) : [{ questionId: `${o.orbit}.*`, answer: String(o.responseSupportIndex) }],
      text: `Your answers suggest ${o.name} is one of the more supported parts of your present life${strong.length ? `, especially ${list(strong.map(youCap))}` : ""}. What are you already doing there that helps?` });
  }
  if (ic.largestSource) {
    const differs = supported.length && !supported.some((o) => o.orbit === ic.largestSource);
    B.push({ id: "support.source", heading: "What restores your energy", claim: "direct", evidence: [ev("interconnections.02")],
      text: `You identified ${NAMES[ic.largestSource]} as giving you the most energy or making you feel most alive.${differs ? " An area can give you energy without being the most supported one; both can be true." : ""} Notice what is different about the way you experience it.` });
  }
  const sunStrong = statements("sun").filter(high).slice(0, 2);
  if (sunStrong.length)
    B.push({ id: "support.self", heading: "The relationship with yourself", claim: "direct", evidence: sunStrong.map(ev),
      text: `At the centre of your Map, you describe ${list(sunStrong.map(youCap))}. Strength in one part of your relationship with yourself does not automatically mean strength in all.` });

  // ── Card C: where tension appears ─────────────────────────────────────────
  const C: InsightSection[] = [];
  if (ic.priorityGap)
    C.push({ id: "tension.gap", heading: "Where what matters and how you live may diverge", claim: "direct", evidence: [ev("interconnections.05")],
      text: `You identified ${NAMES[ic.priorityGap]} as something that matters to you but gets less of your time and energy than you would like. The reason matters more than the label.` });
  if (ic.crowdedOut)
    C.push({ id: "tension.crowded", heading: "The cost of competing priorities", claim: "direct", evidence: [ev("interconnections.04"), ...(ic.largestDemand ? [ev("interconnections.01")] : [])],
      text: `You described ${NAMES[ic.crowdedOut]} as receiving less care because another part of your life demands so much${ic.largestDemand && ic.largestDemand !== ic.crowdedOut ? `, while ${NAMES[ic.largestDemand]} takes the most of your time and attention` : ""}. Is this trade-off intentional and right for this season?` });
  if (ic.externalInfluence)
    C.push({ id: "tension.expectations", heading: "Where others' expectations come in", claim: "direct", evidence: [ev("interconnections.06")],
      text: `You identified ${NAMES[ic.externalInfluence]} as most influenced by other people's expectations or social standards. That is useful to notice, not evidence that your choices are wrong.` });
  if (!C.length && contrast)
    C.push({ id: "tension.contrast", heading: "Importance and support", claim: "tentative", evidence: [ev(`${contrast.orbit}.importance`)],
      text: `You place high importance on ${contrast.name}, while several answers suggest it feels less supported in daily life.` });

  // ── Card D: energy architecture ───────────────────────────────────────────
  const D: InsightSection[] = [];
  const giving = result.orbits.filter((o) => (o.energyRaw ?? 3) <= 2), taking = result.orbits.filter((o) => (o.energyRaw ?? 3) >= 4);
  if (ic.largestDemand && ic.largestSource && ic.largestDemand === ic.largestSource)
    D.push({ id: "energy.same", heading: "Asks a lot, gives a lot", claim: "direct", evidence: [ev("interconnections.01"), ev("interconnections.02")],
      text: `You identified ${NAMES[ic.largestDemand]} as both a major demand and a source of energy. It may ask a lot of you while also giving something back. Whether that exchange feels sustainable is worth exploring.` });
  else {
    if (ic.largestDemand) {
      const e = by[ic.largestDemand].energyRaw;
      D.push({ id: "energy.out", heading: "Energy moving out", claim: "direct", evidence: [ev("interconnections.01"), ev(`${ic.largestDemand}.energy`)],
        text: `You identified ${NAMES[ic.largestDemand]} as taking the most of your time, attention or emotional energy.${e !== null && e <= 2 ? " You also described it as giving more energy than it takes: demand and drain are not the same thing." : ""} What exactly is it asking of you: time, effort, emotion, attention or something else?` });
    }
    if (ic.largestSource)
      D.push({ id: "energy.in", heading: "Energy coming in", claim: "direct", evidence: [ev("interconnections.02")],
        text: `You identified ${NAMES[ic.largestSource]} as a source of energy. What about this experience makes you feel more alive, steady or resourced?` });
    if (ic.largestDemand && ic.largestSource)
      D.push({ id: "energy.exchange", heading: "A possible exchange", claim: "tentative", evidence: [ev("interconnections.01"), ev("interconnections.02")],
        text: `${NAMES[ic.largestDemand]} and ${NAMES[ic.largestSource]} play different roles in your current energy. Neither is inherently good or bad; look at whether the exchange feels sustainable and chosen.` });
  }
  if (giving.length || taking.length)
    D.push({ id: "energy.overall", heading: "Across your Orbits", claim: "direct", evidence: [...giving, ...taking].map((o) => ev(`${o.orbit}.energy`)),
      text: `${giving.length ? `${list(giving.map((o) => o.name))} ${giving.length > 1 ? "give" : "gives"} you energy. ` : ""}${taking.length ? `${list(taking.map((o) => o.name))} ${taking.length > 1 ? "take" : "takes"} more than ${taking.length > 1 ? "they give" : "it gives"}. ` : ""}${ic.overallSupport ? `Asked how the areas of your life relate, you answered: "${ic.overallSupport.label}."` : ""}`.trim() });

  // ── Card E: a possible place to begin ─────────────────────────────────────
  const E: InsightSection[] = [];
  let theme = "neutral", themeOrbit = "";
  if (ic.leverageSelection) {
    E.push({ id: "begin.leverage", heading: "Where attention could have wider effects", claim: "direct", evidence: [ev("interconnections.03")],
      text: `You selected ${NAMES[ic.leverageSelection]} as the area where improvement could positively affect the rest of your life. What makes you believe that?` });
    theme = "leverage"; themeOrbit = NAMES[ic.leverageSelection];
  } else if (ic.priorityGap) {
    E.push({ id: "begin.gap", heading: "A gap you named", claim: "direct", evidence: [ev("interconnections.05")],
      text: `You named ${NAMES[ic.priorityGap]} as mattering more than the time it currently receives. That may be a natural place to look first.` });
    theme = "gap"; themeOrbit = NAMES[ic.priorityGap];
  } else if (contrast) {
    E.push({ id: "begin.contrast", heading: `A closer look at ${contrast.name}`, claim: "tentative", evidence: [ev(`${contrast.orbit}.importance`)],
      text: `${contrast.name} appears less supported in your answers while mattering a great deal to you. Does this matter to you now, or is it an appropriate choice for this season?` });
    theme = "gap"; themeOrbit = contrast.name;
  }
  const drainImportant = result.orbits.find((o) => (o.importanceDirect ?? 0) >= 0.75 && (o.energyRaw ?? 0) >= 4);
  if (theme === "neutral" && ic.externalInfluence) theme = "expectations";
  else if (theme === "neutral" && drainImportant) { theme = "important_draining"; themeOrbit = drainImportant.name; }
  else if (theme === "neutral" && ic.crowdedOut) { theme = "crowded"; themeOrbit = NAMES[ic.crowdedOut]; }
  const question = { text: QUESTION_LIBRARY[theme](themeOrbit), theme };
  E.push({ id: "begin.question", heading: "A question to take with you", claim: "direct", evidence: [], text: question.text });

  const cards: InsightCard[] = [
    { key: "overview", title: "Your Life in Perspective", lead: "A portrait of the life you described, not a verdict about who you are.",
      sections: adequate && A.length ? A : [{ id: "overview.fallback", heading: "Several parts of life that matter", claim: "direct", evidence: [], text: "Your answers describe several parts of life that matter to you, without pointing to one simple pattern. The individual Orbits may be more useful to explore than a single overall conclusion." }],
      fallback: !(adequate && A.length) },
    { key: "support", title: "What Supports You", lead: "Notice what is already working before deciding what needs to change.",
      sections: B.length ? B : [{ id: "support.fallback", heading: "Support", claim: "direct", evidence: [], text: "Your answers don't identify one clear source of support above the others. That doesn't mean support is absent." }], fallback: !B.length },
    { key: "tension", title: "Patterns Worth Noticing", lead: "Some patterns are easier to recognize when different parts of life are viewed together.",
      sections: C.length ? C.slice(0, 3) : [{ id: "tension.fallback", heading: "No single tension", claim: "direct", evidence: [], text: "No single tension stands out clearly in these responses. That can be a useful observation in itself." }], fallback: !C.length },
    { key: "energy", title: "Your Energy Architecture", lead: "Energy is not a grade. It is information about what your current life asks of you and gives back.",
      sections: D.length ? D : [{ id: "energy.fallback", heading: "Your energy", claim: "direct", evidence: [], text: "Your answers don't identify a clear energy pattern yet. Consider which areas restore you and which require more from you in an ordinary week." }], fallback: !D.length },
    { key: "begin", title: "What Deserves a Closer Look", lead: "Not a to-do list. A few places where a better question may reveal something important.",
      sections: E.length > 1 ? E : [{ id: "begin.fallback", heading: "Where to begin", claim: "direct", evidence: [], text: "Your answers don't establish one obvious starting point. The most useful place to begin may be the area you feel most ready to understand more deeply." }, ...E],
      fallback: E.length <= 1 },
  ];

  return { templateVersion: INSIGHTS_TEMPLATE_VERSION, cards, questionToTakeWithYou: question, orbits: result.orbits.map((o) => orbitNarrative(o)) };

  // ── Orbit narrative library (§5): same conditional structure for all eight ──
  function orbitNarrative(o: OrbitResult): OrbitNarrative {
    const ids = statements(o.orbit);
    const hi = ids.filter(high), lo = ids.filter(low);
    const p: string[] = [];
    const imp = o.importanceOrdinal ? label(`${o.orbit}.importance`) : null;
    if (imp) p.push(`You described ${o.name} as "${imp.toLowerCase()}"${o.energyRaw !== null ? `, and said it ${o.energyRaw <= 2 ? "gives you more energy than it takes" : o.energyRaw >= 4 ? "requires more energy than it gives" : "keeps your energy fairly stable"}` : ""}.`);
    const isFr = (id: string) => !!(questionById(id)?.reverseKeyed && PHRASES[id]?.friction);
    const loText = (xs: string[]) => {
      const caps = xs.filter((i) => !isFr(i)).map(youCap), fr = xs.filter(isFr).map((i) => toYou(PHRASES[i].friction!));
      return [caps.length ? `${list(caps)} ${caps.length > 1 ? "feel" : "feels"} less true right now` : "", fr.length ? `you describe ${list(fr)}` : ""].filter(Boolean).join(", and ");
    };
    if (o.supportConfidence === "insufficient") p.push("There isn't enough information to interpret how supported this area feels from this assessment.");
    else if (hi.length && lo.length) p.push(`You reported ${list(hi.slice(0, 2).map(youCap))}, alongside some friction: ${loText(lo.slice(0, 2))}. Both can be true.`);
    else if (hi.length >= 2 && !lo.length) p.push(`Your responses suggest real strengths here, especially ${list(hi.slice(0, 2).map(youCap))}.`);
    else if (lo.length >= 2 && !hi.length) p.push(`Several answers point to this area feeling less supported at present: ${loText(lo.slice(0, 2))}. This does not tell us why.`);
    else p.push("Your answers here sit in the middle range, without one clear strength or strain.");
    if (o.coverage.notApplicable) p.push("Questions you marked as not applicable are left out, not counted against this area.");
    if (o.orbit === "social" && o.subthemes) {
      const d = (x: number | null) => (x === null ? null : x >= 0.7 ? "more supported" : x <= 0.35 ? "less supported" : "mixed");
      const cm = d(o.subthemes.community), cr = d(o.subthemes.career);
      if (cm && cr && cm !== cr) p.push(`Community and career read differently in your answers: community looks ${cm}, career looks ${cr}.`);
    }
    if (o.emotions.length >= 2) p.push(`You selected ${list(o.emotions.map((e) => e.label))} to describe it. These states can coexist.`);
    const q = o.orbit === "growth" && keyed("growth.06") !== null && keyed("growth.06")! <= 0.25 ? "What would need to be true for you to start on what you already know would help you grow?" : toYou(ORBIT_Q[o.orbit]);
    return { orbit: o.orbit, name: o.name, paragraphs: p, question: q, evidence: [...hi.slice(0, 2), ...lo.slice(0, 2)].map(ev) };
  }
}

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
void cap;
