import { SUPPORT_COMPETE_READING } from "@/content/v10/scales";
/**
 * Library of evidence-backed interpretation rules.
 *
 * Each rule reads only direct answers, Life Interconnections selections, or approved calculations (stated
 * importance, the response-support proxy compared with the F6 tolerance, the energy rating). It produces a
 * candidate Observation with its supporting answers, alternative readings, wording strength and the places on
 * the page where it may appear. Rules quote the parallel congruence statement as the person's own answer; the approved
 * distance bands (F4) are described in compose.ts (Map interpretation and Orbits), never used to rank.
 *
 * Copy is DRAFT for Jana's approval. Tone: warm, observant, direct, never a verdict.
 */
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { type Ctx, COEXIST_LINES, cap, isAre, list, pick } from "./context";
import type { Area, Destination, Evidence, Observation, Sufficiency, Valence, Wording } from "./types";

export interface RuleDoc { id: string; family: string; evidence: string; reads: string; destinations: Destination[] }

/** Human-readable index of the rules (exported to the deliverables pack). */
export const RULES: RuleDoc[] = [
  { id: "priority.top", family: "priority", evidence: "[orbit].importance — highest rating (≥ Moderately important)", reads: "What matters most right now.", destinations: ["map", "card.overview"] },
  { id: "support.similar", family: "support", evidence: "Support proxy for ≥2 Orbits with sufficient answers; spread < 0.10 (F6)", reads: "Support is similar across areas — no winner is named.", destinations: ["map", "card.overview"] },
  { id: "support.contrast", family: "support", evidence: "Support proxy; spread ≥ 0.10; groups within 0.05 (F6)", reads: "Where support is fuller and thinner, relatively.", destinations: ["map", "card.overview"] },
  { id: "priority.gap", family: "priority-gap", evidence: "[orbit].importance ≥ Very important AND (lower F6 group or proxy ≤ 0.35) AND ≥1 low statement", reads: "High importance, lower reported support (scenario 1).", destinations: ["opening", "card.tension"] },
  { id: "priority.strength", family: "strength", evidence: "[orbit].importance ≥ Very important AND (higher F6 group or proxy ≥ 0.75) AND ≥1 high statement", reads: "Matters and feels supported.", destinations: ["card.support", "opening"] },
  { id: "priority.quiet-supported", family: "strength", evidence: "[orbit].importance ≤ Slightly important AND well supported", reads: "Low importance, high satisfaction (scenario 4) — never told to prioritise.", destinations: ["card.support"] },
  { id: "priority.quiet-choice", family: "allocation", evidence: "[orbit].importance ≤ Slightly important AND less supported", reads: "A possible conscious allocation — never a deficit.", destinations: ["card.overview"] },
  { id: "energy.same", family: "asks-gives", evidence: "interconnections.01 = interconnections.02", reads: "Same Orbit is the largest demand and largest source (scenario 5).", destinations: ["opening", "card.energy"] },
  { id: "energy.exchange", family: "energy", evidence: "interconnections.01 ≠ interconnections.02, both answered", reads: "One area asks, another restores.", destinations: ["card.energy"] },
  { id: "energy.meaningful-demand", family: "energy", evidence: "[orbit].importance ≥ Very important AND [orbit].energy takes more than it gives", reads: "Demanding and meaningful — not treated as a problem.", destinations: ["card.energy", "opening"] },
  { id: "energy.balance", family: "energy", evidence: "[orbit].energy for all Orbits", reads: "Which Orbits give and which take.", destinations: ["map", "card.energy"] },
  { id: "energy.source-takes", family: "mixed", evidence: "interconnections.02 = X AND X.energy takes more than it gives", reads: "Contradictory answers acknowledged (scenario 9).", destinations: ["card.energy"] },
  { id: "alignment.priority-gap", family: "priority-gap", evidence: "interconnections.05 (+ importance when they differ)", reads: "What matters but gets less time — in their words.", destinations: ["opening", "card.tension", "card.begin"] },
  { id: "alignment.expectations", family: "expectations", evidence: "interconnections.06 (+ that Orbit's congruence statement)", reads: "Where others' expectations come in.", destinations: ["card.tension", "opening"] },
  { id: "alignment.lived-values-low", family: "priority-gap", evidence: "Important Orbit AND its congruence statement ≤ Somewhat true", reads: "Their own answer that how they live it doesn't fully reflect what matters.", destinations: ["card.tension"] },
  { id: "alignment.lived-values-high", family: "strength", evidence: "Important Orbit(s) with congruence statement ≥ Very true", reads: "Lived in line with what matters — in their words.", destinations: ["card.support"] },
  { id: "self.contrast", family: "self", evidence: "Two Sun statements, one ≥ Very true and one ≤ Somewhat true, from an approved pair", reads: "A difference within the relationship with self (e.g. clarity vs gentleness).", destinations: ["self", "opening"] },
  { id: "self.strengths", family: "self", evidence: "≥2 Sun statements ≥ Very true", reads: "What they describe as established.", destinations: ["self"] },
  { id: "self.quieter", family: "self", evidence: "≥2 Sun statements ≤ Somewhat true", reads: "What feels less available right now — no labels.", destinations: ["self"] },
  { id: "self.values-living", family: "self", evidence: "sun.01 ≥ Very true AND an important Orbit's congruence statement ≤ Somewhat true", reads: "Knowing what they want vs how one area is lived (never 'self-deception').", destinations: ["self"] },
  { id: "self.even", family: "self", evidence: "Sun answers mostly in the middle", reads: "Fallback.", destinations: ["self"] },
  { id: "emotion.mixed", family: "emotion", evidence: "[orbit].emotion with expansive + strained/ambivalent selections (proposed tone list)", reads: "States that coexist (scenario 6).", destinations: ["orbit", "card.energy"] },
  { id: "emotion.strained", family: "emotion", evidence: "[orbit].emotion with ≥2 strained selections and none expansive", reads: "The area is asking something of them.", destinations: ["orbit", "card.energy"] },
  { id: "emotion.alive", family: "emotion", evidence: "[orbit].emotion with ≥2 expansive selections and none strained", reads: "The area feels alive.", destinations: ["orbit", "card.support"] },
  { id: "link.demand-crowded", family: "tradeoff", evidence: "interconnections.04 + interconnections.01 (different Orbits)", reads: "A trade-off they named.", destinations: ["opening", "connections", "card.tension"] },
  { id: "link.ambition-restoration", family: "ambition-restoration", evidence: "Growth/Social importance or interconnections.01 + restoration.02, Restoration support or interconnections.04", reads: "Ambition and restoration (scenarios 2 and 3).", destinations: ["opening", "connections", "card.support"] },
  { id: "link.body-mind", family: "body-mind", evidence: "body.01 + mind.04 / mind.05 / mind.emotion", reads: "Body and mental clarity — co-occurrence only.", destinations: ["connections"] },
  { id: "link.career-community", family: "career-belonging", evidence: "Social World career vs community statements (difference ≥ 0.35)", reads: "Career and belonging.", destinations: ["connections"] },
  { id: "link.permission", family: "permission", evidence: "restoration.06 + joy.02, both ≤ Somewhat true", reads: "Earning rest and pleasure.", destinations: ["opening", "connections"] },
  { id: "link.standards-care", family: "standards", evidence: "sun.10 + restoration.05 or restoration.02", reads: "Personal standards and self-care.", destinations: ["opening", "connections"] },
  { id: "link.voice", family: "self-expression", evidence: "love.01/love.02 (answered) + sun.06 or social.03", reads: "Intimacy and self-expression.", destinations: ["connections"] },
  { id: "link.room-to-grow", family: "resources-freedom", evidence: "resources.06 + growth.05 or Growth importance", reads: "Resources and freedom.", destinations: ["connections"] },
  { id: "link.familiar", family: "status-quo", evidence: "resources.05 + growth.06 (both endorsed)", reads: "How change feels right now.", destinations: ["opening", "connections", "card.begin"] },
  { id: "link.growth-joy", family: "growth-joy", evidence: "Growth importance or interconnections.01 + joy.02 / joy.04", reads: "Growth and joy.", destinations: ["connections"] },
  { id: "link.leverage", family: "leverage", evidence: "interconnections.03 (+ support / interconnections.05)", reads: "Where they believe change would ripple outward.", destinations: ["card.begin", "connections"] },
  { id: "link.overall", family: "system", evidence: "interconnections.07", reads: "Whether areas help or compete — in their words.", destinations: ["connections", "card.overview"] },
  { id: "centre.roles", family: "centre", evidence: "One Orbit named in 2+ Interconnections roles (largest demand, the lever, matters more than time, others' expectations) AND important or draining; crowding via interconnections.04", reads: "One area holding several roles at once.", destinations: ["opening", "card.tension"] },
  { id: "alignment.crowded-unimportant", family: "mixed", evidence: "interconnections.04 = X AND X.importance ≤ Slightly important", reads: "A crowded-out area rated unimportant.", destinations: ["card.tension"] },
  { id: "contrast.feelings-statements", family: "mixed", evidence: "[orbit].emotion vs its statements (expansive feelings with no high statements, or strained feelings with high support)", reads: "Feelings and statements that don't match.", destinations: ["card.energy", "orbit"] },
  { id: "link.lever-strong", family: "leverage", evidence: "interconnections.03 = an already well-supported Orbit", reads: "The lever is a strength.", destinations: ["card.begin"] },
  { id: "strength.reinforcing", family: "strength", evidence: "One of five approved Sun + Orbit pairs, both ≥ Very true", reads: "Strengths that reinforce each other.", destinations: ["card.support"] },
  { id: "pattern.several", family: "several", evidence: "≥4 Orbits less supported (sufficient answers)", reads: "Several areas at once — never a catalogue (scenario 8).", destinations: ["opening"] },
  { id: "pattern.well-supported", family: "well-supported", evidence: "All Orbits with sufficient answers ≥ 0.6, none lower, no trade-off named", reads: "Nothing manufactured (scenario 7).", destinations: ["opening", "card.overview"] },
];

type Draft = {
  rule: string; family: string; areas: Area[]; evidence: Evidence[]; counterEvidence?: Evidence[]; meaning?: string;
  sufficiency: Sufficiency; wording: Wording; valence: Valence; alternatives?: string[]; relevance: number;
  destinations: Destination[]; text: string; clause: string; question?: string; link?: Observation["link"];
};

const ENERGY_WORDS: Record<number, string> = { 1: "gives you a lot of energy", 2: "gives you more energy than it takes", 3: "keeps your energy fairly stable", 4: "takes more energy than it gives", 5: "drains a lot of your energy" };
export const energyWords = (n: number | null) => (n === null ? null : ENERGY_WORDS[n]);

/**
 * "What it might mean" for each rule (approved 13 Oct): tentative, about lived experience, limited to what the
 * rule's evidence supports. No causes, diagnoses or personal history.
 */
const MEANING: Record<string, (d: Draft, n: (a: Area) => string, k: number) => string> = {
  // Deeper, conversational readings (Jana, 2026-10-15). They draw on ideas from depth psychology, values work, relationship
  // psychology and coaching (the public persona, values as lived priorities, action before motivation, self-compassion),
  // without naming anyone or diagnosing. DRAFT for Jana's review.
  "priority.top": () => "What we rate as important is a quiet statement of who we are trying to be right now. It shows where your care is going in this season.",
  "support.similar": () => "No single area seems to be carrying, or draining, the rest. That kind of evenness can be a strength in itself.",
  "support.contrast": () => "The fuller areas may be part of what is holding everything else together right now, often without much credit.",
  "support.top": () => "Strengths tend to become invisible to the people who have them. What we don't notice, we rarely protect.",
  // k = how many times this rule has already appeared for this person, so two Orbits never get the same reading
  "priority.gap": (d, n, k) => [
    `What we call important and what our weeks are built around can be two different things. A value only becomes real when it gets time, attention and a place in your days; until then it stays a wish. ${n(d.areas[0])} may be asking to move from something you care about to something you live.`,
    `It's possible to value something deeply and still give it the leftovers of your week, not because you don't care, but because caring alone doesn't build a routine. ${n(d.areas[0])} may be asking for a little structure, rather than more wanting.`,
    `When something important keeps getting less than it needs, a quiet tension builds: a sense that life is slightly out of order. ${n(d.areas[0])} may be one of the places where that tension lives for you right now.`,
  ][k % 3],
  "priority.strength": () => "Strengths tend to become invisible to the people who have them. Naming what's working matters, because these are the places you can lean on when other parts of life ask more of you.",
  "priority.quiet-supported": (d, n) => `Not everything needs your attention to thrive. Something about how ${n(d.areas[0])} is set up may already be working on its own, and that's worth knowing.`,
  "priority.quiet-choice": (d, n) => `A full life is built on choices about what to care about, and what to let rest. Letting ${n(d.areas[0])} sit in the background may be part of how you're making room for what matters more.`,
  "energy.same": (d, n) => `This is often where meaning lives: in what costs us and gives back in equal measure. ${n(d.areas[0])} may be both your engine and your fuel. The risk isn't the effort; it's that when something feeds us this much, we stop noticing what it takes, until our body or the people close to us notice first.`,
  "energy.exchange": (d, n) => `Energy works less like a fixed budget and more like a current: some places draw it out, others bring it back. Your energy may depend on ${n(d.areas[1])} more than you notice, especially when ${n(d.areas[0])} asks a lot.`,
  "energy.source": (d, n) => `The places that make us feel most alive are often where we are most ourselves, with nothing to prove. They also tend to be the first thing we cut when life gets busy, which is exactly when we need them most. ${n(d.areas[0])} may be one of yours.`,
  "energy.meaningful-demand": (d) => `We tend to read tiredness as a sign that something is wrong. But what matters is often demanding; the effort is part of why it matters. The more useful question may be whether you're recovering from ${d.areas.length > 1 ? "these areas" : "this area"} as deliberately as you're giving to ${d.areas.length > 1 ? "them" : "it"}.`,
  "energy.balance": () => "Knowing where your energy comes from, and where it goes, is one of the most practical forms of self-knowledge. It lets you protect your energy before demands rise, not after.",
  "energy.source-takes": (d, n) => `Feeling alive and feeling at ease aren't the same thing. ${n(d.areas[0])} may light you up and wear you out, sometimes in the same week. The things we care about most are rarely the easiest.`,
  "alignment.priority-gap": () => "We rarely drift from what matters through one big decision. It usually happens through many small, reasonable ones: next month, once things calm down. Something that still matters to you may be waiting for space you haven't yet been able to give it, and life rarely makes that space on its own.",
  "alignment.expectations": (d, n) => d.valence === "tension"
    ? `We all carry a version of ourselves shaped to meet other people's expectations: the face we show the world. It's useful, and often kind. But when it starts making the decisions, life can begin to feel slightly borrowed. Some of how you live ${n(d.areas[0])} may be shaped more by others than by you.`
    : `We all carry a version of ourselves shaped to meet other people's expectations. The question isn't whether others influence you in ${n(d.areas[0])}, but whether you've chosen which influences to keep.`,
  "alignment.lived-values-low": (d, n) => `When the way we live drifts from what we value, it rarely feels dramatic. It shows up as a low hum: going through the motions, doing what makes sense rather than what feels true. That hum is information. It may point to the part of ${n(d.areas[0])} that is running on "should", and wants to be more yours.`,
  "alignment.lived-values-high": () => "Living by your own values doesn't make life easier, but it does make it feel like yours. That sense of authorship is one of the steadiest foundations a person can have.",
  "alignment.crowded-unimportant": (d, n) => `Sometimes we rate something as unimportant because it hasn't had room in a while, not because it doesn't matter. ${n(d.areas[0])} may matter more to you than the rating suggests, or the trade-off may genuinely sit well with you.`,
  "self.strengths": () => "The relationship with yourself is the one you live in every day; every other relationship is lived through it. These may be the parts of yourself you can rely on when things get harder.",
  "self.quieter": () => "How we treat ourselves when no one is watching shapes everything else. These may be the places where being on your own side is still being learned, and that learning is possible at any point in life.",
  "self.values-living": (d, n) => `Insight is the beginning, not the end. Knowing what you want and arranging a life around it are two different acts, and the second usually asks for courage more than clarity. In ${n(d.areas[1])}, what you know may be ahead of what your circumstances currently allow.`,
  "self.even": () => "Some of these questions may still be open for you, and an open question can be a more honest place to stand than a quick answer.",
  "emotion.mixed": (d, n) => `Feelings are signals, not verdicts. ${n(d.areas[0])} may be meaningful and demanding at once, and holding both without rushing to resolve them is a sign of emotional maturity, not confusion.`,
  "emotion.strained": (d, n) => `Feelings are signals, not verdicts. ${n(d.areas[0])} may be costing you more than it gives right now, and the feeling may be pointing to a need that isn't being met yet.`,
  "emotion.alive": (d, n) => `Feelings are signals, and this one points somewhere good. ${n(d.areas[0])} may be one of the places where you come back to yourself.`,
  "contrast.feelings-statements": (d, n) => d.valence === "strength"
    ? `What we feel and what we've built may not match. ${n(d.areas[0])} may feel better in the moment than the routines around it suggest: present in moments, rather than built into your life.`
    : `What looks fine from the outside can still ask a lot on the inside. ${n(d.areas[0])} may look steady while quietly costing you, and that cost deserves to be taken seriously, even if no one else sees it.`,
  "link.demand-crowded": (d, n) => `Every yes is also a no to something else. ${n(d.areas[1])} may be what quietly pays for the demands of ${n(d.areas[0])}. That trade-off may be the right one for now; it's worth making sure it's one you're choosing, not one that's choosing you.`,
  "link.ambition-restoration": (d) => d.valence === "strength"
    ? "Recovery isn't the opposite of ambition; it's what makes ambition last. You may have found a rhythm where the two support each other, and that's rarer than it sounds."
    : "Many driven people treat rest as a reward for finishing, but the list doesn't end. Rest may feel like something earned once the important things are done, rather than part of how you do them. Recovery isn't the opposite of ambition; it's what makes it sustainable.",
  "link.body-mind": (d) => d.valence === "strength"
    ? "Body and mind are less separate than we treat them. Yours may be giving each other a steady base, which makes everything else a little easier."
    : "Body and mind are less separate than we treat them. Low physical energy and a busy mind may be feeding each other, and a small change in one can sometimes ease the other.",
  "link.career-community": () => "Achievement and belonging meet different needs. One part of your social world may be carrying the other, but neither can fully stand in for the other for long.",
  "link.permission": () => "Needing to earn rest or pleasure often grows from a quiet belief that our worth lies in what we produce. Learning to receive, without first justifying it, can be one of the hardest and most freeing things a person does.",
  "link.standards-care": () => "High standards can be a gift, until they turn inward and make even self-care one more thing to get right. Self-compassion isn't lowering the bar; it's what lets you keep reaching for it without breaking.",
  "link.voice": () => "Not saying what we need often protects closeness in the short term and wears it down in the long term. Being close to someone asks us to be known, needs included.",
  "link.room-to-grow": () => "Inner change often runs ahead of outer circumstances. That gap can feel frustrating, but it's also evidence that you've already started moving.",
  "link.familiar": () => "The mind tends to prefer a known discomfort to an unknown possibility. Courage isn't the absence of that fear; it's taking a small step while you still feel it. Clarity and motivation usually follow action, rather than the other way round.",
  "link.growth-joy": () => "Growth can quietly become another form of striving. Joy is a reminder that you are not only a project to improve, but a person to enjoy being.",
  "link.leverage": () => "People often sense where the lever is before they can explain why. A small, steady change in one area can reshape a whole life more than a big push everywhere at once.",
  "link.lever-strong": (d, n) => `Growth doesn't only come from fixing what's weak; it often comes from building on what's already strong. The next step in ${n(d.areas[0])} may be about going further rather than repairing something.`,
  "link.overall": (d) => d.valence === "tension"
    ? "When areas compete, every choice can feel like it costs something. Seeing the whole picture is what lets you choose the trade-offs, rather than simply absorb them."
    : "When the parts of a life support each other, effort in one tends to carry into the rest. That's a quiet form of design, whether or not you planned it.",
  "strength.reinforcing": () => "Strengths rarely work alone. These two may be making each other easier, which is a resource worth knowing you have.",
  "centre.roles": (d, n) => `When one area becomes the centre of gravity, everything else starts to orbit it, sometimes without us choosing it. Much of your energy may be going into holding ${n(d.areas[0])} steady. That can be exactly what a season requires; it can also quietly become an identity, the role you play. Noticing it is the first step to deciding whether it's still yours to carry this way.`,
  "pattern.several": () => "When many things ask for care at once, it's natural to feel scattered, or to feel you should tend to everything. You don't have to. Awareness comes first; then you can choose one place to begin.",
  "pattern.well-supported": () => "When life is working, it's easy to take it for granted. What you've built may deserve as much care and attention as anything you'd want to change.",
};
const ALT_DEFAULT = "This may reflect this season rather than a lasting pattern.";
const ALT: Record<string, string> = {
  "priority.strength": "Support can shift quickly when circumstances change.",
  "support.top": "Areas that look well supported can still have moments of strain.",
  "energy.source": "What restores you now may change as your season changes.",
  "energy.exchange": "The exchange may feel very different from week to week.",
  "alignment.lived-values-high": "Living by your values can still be tiring.",
  "self.strengths": "Strengths can feel less available on harder days.",
  "emotion.alive": "Feelings can change from week to week.",
  "emotion.strained": "These feelings may belong to a passing phase rather than the area itself.",
  "link.leverage": "Improving one area won't necessarily change the others, but your instinct is worth exploring.",
  "strength.reinforcing": "Two strengths can also sit side by side without affecting each other.",
  "centre.roles": "Staying steady may be the wise choice right now, and some circumstances may be outside your control.",
};

export function buildObservations(c: Ctx): Observation[] {
  const out: Observation[] = [];
  const seenRule: Record<string, number> = {};
  const add = (d: Draft) => {
    const k = (seenRule[d.rule] = (seenRule[d.rule] ?? -1) + 1);
    const weight = Math.max(0, ...d.areas.filter((a): a is OrbitId => a !== "sun").map((a) => c.imp(a) ?? 0));
    const meaning = d.meaning ?? MEANING[d.rule]?.(d, (a) => (a === "sun" ? "your relationship with yourself" : c.name(a)), k) ?? "";
    const alternatives = d.alternatives?.length ? d.alternatives : [ALT[d.rule] ?? ALT_DEFAULT];
    out.push({
      id: `${d.rule}:${d.areas.join("+") || "system"}`, counterEvidence: [], ...d, alternatives, meaning,
      relevance: Math.round(Math.min(1, d.relevance + 0.08 * weight + (d.evidence.length >= 3 ? 0.03 : 0)) * 1000) / 1000,
    });
  };
  const v = (rule: string, xs: string[]) => pick(xs, `${c.seed}#${rule}`);
  const N = c.name;
  const ic = c.ic;
  const D = ic.largestDemand, S = ic.largestSource, L = ic.leverageSelection, C = ic.crowdedOut, P = ic.priorityGap, E = ic.externalInfluence;
  const orbits = ORBIT_IDS as OrbitId[];
  const his = (o: Area) => c.statements(o).filter(c.high);
  const los = (o: Area) => c.statements(o).filter(c.low);

  // ── Priorities and support ────────────────────────────────────────────────
  if (c.mostImportant.length) {
    const m = c.mostImportant;
    add({ rule: "priority.top", family: "priority", areas: m, evidence: m.map((o) => c.ev(`${o}.importance`)), sufficiency: "explicit", wording: "state", valence: "neutral", relevance: 0.4,
      destinations: ["map", "card.overview"],
      text: m.length >= 5
        ? `You rated ${m.length} of your eight Orbits as "${c.impLabel(m[0])}". A lot of your life matters to you at once, which can be a source of richness and of strain.`
        : `You placed the most importance on ${list(m.map(N))}. Importance doesn't mean an area must take up most of your time; it tells you what matters in this season.`,
      clause: `${list(m.map(N))} ${isAre(m.length)} what matters most to you right now` });
  }
  if (c.sufficient.length >= 2 && c.spread < 0.1)
    add({ rule: "support.similar", family: "support", areas: [], evidence: c.sufficient.flatMap((o) => c.supportEv(o.orbit).slice(0, 1)), sufficiency: "comparative", wording: "suggest", valence: "neutral", relevance: 0.3,
      destinations: ["map", "card.overview"],
      text: "Your answers describe a similar level of support across most areas of your life. No single area stands far apart from the rest, so the individual statements may say more than any comparison.",
      clause: "support looks similar across most areas" });
  else if (c.top.length && c.bottom.length)
    add({ rule: "support.contrast", family: "support", areas: [...c.top, ...c.bottom], evidence: [...c.top, ...c.bottom].flatMap((o) => c.supportEv(o)), sufficiency: "comparative", wording: "suggest", valence: "neutral", relevance: 0.35,
      destinations: ["map", "card.overview"],
      text: `${list(c.top.map(N))} ${isAre(c.top.length)} more supported in your answers; ${list(c.bottom.map(N))} ${isAre(c.bottom.length)} less supported by comparison. These are starting points for reflection, not fixed labels.`,
      clause: `${list(c.top.map(N))} ${isAre(c.top.length)} more supported than ${list(c.bottom.map(N))}` });

  const gapOrbits = orbits.filter((o) => c.important(o) && c.lessSupported(o) && los(o).length)
    .sort((a, b) => (c.imp(b) ?? 0) - (c.imp(a) ?? 0) || (c.by[a].responseSupportIndex ?? 1) - (c.by[b].responseSupportIndex ?? 1)).slice(0, 2);
  const strongOrbits = orbits.filter((o) => c.important(o) && c.moreSupported(o) && his(o).length);
  if (strongOrbits.length) {
    const [a1, a2] = strongOrbits;
    const one = strongOrbits.length === 1;
    add({ rule: "priority.strength", family: "strength", areas: strongOrbits, evidence: strongOrbits.flatMap((o) => [c.ev(`${o}.importance`), ...his(o).slice(0, 2).map(c.ev)]), sufficiency: "corroborated", wording: "suggest", valence: "strength", relevance: 0.5,
      destinations: ["card.support", "opening"],
      text: one
        ? `${N(a1)} matters to you and feels well supported. You describe ${list(his(a1).slice(0, 2).map(c.capOf))}.`
        : `${list(strongOrbits.map(N))} matter to you and feel well supported. In ${N(a1)}, you describe ${list(his(a1).slice(0, 2).map(c.capOf))}; in ${N(a2)}, ${list(his(a2).slice(0, 2).map(c.capOf))}.`,
      clause: `${list(strongOrbits.map(N))} ${one ? "matters" : "matter"} to you and ${one ? "feels" : "feel"} well supported`,
      question: `What are you already doing in your ${N(a1)} Orbit that you'd want to protect?` });
  }
  {
    const covered = new Set([...strongOrbits]);
    const others = c.top.filter((o) => !covered.has(o) && !c.unimportant(o));
    if (others.length && others.length <= 3)
      add({ rule: "support.top", family: "strength", areas: others, evidence: others.flatMap((o) => his(o).slice(0, 2).map(c.ev)).concat(others.flatMap((o) => c.supportEv(o).slice(0, 1))), sufficiency: "comparative", wording: "suggest", valence: "strength", relevance: 0.38,
        destinations: ["card.support"],
        text: `${list(others.map(N))} ${isAre(others.length)} among the better supported areas in your answers right now. Whatever is helping there may be worth knowing about.`,
        clause: `${list(others.map(N))} ${isAre(others.length)} among the better supported areas` });
  }
  if (S && D !== S && !c.takes(S))
    add({ rule: "energy.source", family: "strength", areas: [S], evidence: [c.ev("interconnections.02"), c.ev(`${S}.energy`)], sufficiency: "explicit", wording: "state", valence: "strength", relevance: 0.4,
      destinations: ["card.support"],
      text: `${N(S)} is where your energy comes back. It's worth noticing what is different there: how you feel, who you are with, and what you stop worrying about.`,
      clause: `${N(S)} gives you the most energy`,
      question: `What about your ${N(S)} Orbit makes you feel more alive, steady or resourced?` });

  for (const o of orbits) {
    const hi = his(o), lo = los(o);
    if (gapOrbits.includes(o)) {
      const l2 = lo.slice(0, 2);
      add({ rule: "priority.gap", family: "priority-gap", areas: [o], evidence: [c.ev(`${o}.importance`), ...l2.map(c.ev)], counterEvidence: hi.slice(0, 2).map(c.ev),
        sufficiency: lo.length >= 2 ? "corroborated" : "comparative", wording: "suggest", valence: "tension", relevance: 0.66 + (lo.length >= 2 ? 0.06 : 0),
        destinations: ["opening", "card.tension"],
        alternatives: ["That gap doesn't automatically mean something is wrong. It may reflect a demanding season, or a choice you've made for now.", "You may already know this, and be working on it in your own way."],
        text: v(`gap.${o}`, [
          `There's a gap in ${N(o)} between how much it matters and how it's going. It's one of the things you care about most, and yet ${c.lowPhrase(l2)}.`,
          `${N(o)} sits close to your heart, but the everyday support around it feels thinner: ${c.lowPhrase(l2)}.`,
        ]),
        clause: `${N(o)} matters a great deal to you and feels less supported right now`,
        question: `What would it take for your ${N(o)} Orbit to feel as supported as it is important to you?` });
    }
    if (c.unimportant(o) && c.moreSupported(o))
      add({ rule: "priority.quiet-supported", family: "strength", areas: [o], evidence: [c.ev(`${o}.importance`), ...hi.slice(0, 2).map(c.ev)], sufficiency: "comparative", wording: "suggest", valence: "strength", relevance: 0.42,
        destinations: ["card.support"],
        text: `You don't rate ${N(o)} as a priority right now, yet it's one of the places your answers describe as well supported. Some things work quietly, without needing much of your attention.`,
        clause: `${N(o)} works quietly in the background` });
    if (c.unimportant(o) && c.lessSupported(o))
      add({ rule: "priority.quiet-choice", family: "allocation", areas: [o], evidence: [c.ev(`${o}.importance`), ...lo.slice(0, 2).map(c.ev)], sufficiency: "comparative", wording: "wonder", valence: "neutral", relevance: 0.28,
        destinations: ["card.overview"],
        text: `${N(o)} isn't a priority for you right now, and your answers suggest it feels less supported. That may be a conscious allocation of your attention in this season. Low importance doesn't mean it needs fixing.`,
        clause: `${N(o)} is, for now, a conscious allocation` });
  }

  // ── Energy ────────────────────────────────────────────────────────────────
  if (D && S && D === S)
    add({ rule: "energy.same", family: "asks-gives", areas: [D], evidence: [c.ev("interconnections.01"), c.ev("interconnections.02"), c.ev(`${D}.energy`)], sufficiency: "explicit", wording: "state", valence: "mixed", relevance: 0.74,
      destinations: ["opening", "card.energy"],
      alternatives: ["It may also simply be a season of full engagement that you're enjoying."],
      text: `You named ${N(D)} both as the area that takes the most of your time and energy and as the one that gives you the most energy back. It asks a lot, and it gives a lot.`,
      clause: `${N(D)} asks the most of you and gives the most back`,
      question: `What does your ${N(D)} Orbit give you that makes its demands worthwhile, and does the exchange still feel like one you're choosing?` });
  if (D && S && D !== S)
    add({ rule: "energy.exchange", family: "energy", areas: [D, S], evidence: [c.ev("interconnections.01"), c.ev("interconnections.02")], sufficiency: "explicit", wording: "suggest", valence: "neutral", relevance: 0.42,
      destinations: ["card.energy"],
      text: `Between ${N(D)} and ${N(S)}, your energy seems to move in two directions: one asks, the other restores. Neither is good or bad in itself. What matters is whether the exchange feels sustainable and chosen.`,
      clause: `${N(D)} asks and ${N(S)} restores`,
      question: `What exactly is your ${N(D)} Orbit asking of you right now: time, effort, emotion or attention?` });
  {
    const md = orbits.filter((o) => c.important(o) && c.takes(o) && o !== D);
    if (md.length) {
      const one = md.length === 1;
      add({ rule: "energy.meaningful-demand", family: "energy", areas: md, evidence: md.flatMap((o) => [c.ev(`${o}.importance`), c.ev(`${o}.energy`)]), sufficiency: "corroborated", wording: "suggest", valence: "mixed", relevance: 0.5,
        destinations: ["card.energy", "opening"],
        alternatives: ["An area can be demanding and deeply meaningful at the same time."],
        text: one
          ? `${N(md[0])} matters to you, and you also said it ${energyWords(c.energy(md[0]))}. An area can be demanding and deeply meaningful at the same time.`
          : `${list(md.map(N))} matter to you, and you also said each takes more energy than it gives. An area can be demanding and deeply meaningful at the same time.`,
        clause: `${list(md.map(N))} ${one ? "matters" : "matter"} to you and also ${one ? "asks" : "ask"} a lot of your energy`,
        question: `What would make your ${N(md[0])} Orbit feel less costly to sustain, while keeping what it means to you?` });
    }
  }
  {
    const giving = orbits.filter(c.gives), taking = orbits.filter(c.takes);
    if (giving.length || taking.length)
      add({ rule: "energy.balance", family: "energy", areas: [...giving, ...taking], evidence: [...giving, ...taking].map((o) => c.ev(`${o}.energy`)), sufficiency: "explicit", wording: "state", valence: "neutral", relevance: 0.3,
        destinations: ["map", "card.energy"],
        text: [
          giving.length ? `${list(giving.map(N))} ${giving.length > 1 ? "give" : "gives"} you energy.` : "",
          taking.length ? `${list(taking.map(N))} ${taking.length > 1 ? "take" : "takes"} more than ${taking.length > 1 ? "they give" : "it gives"}.` : "None of your Orbits is marked as taking more energy than it gives.",
        ].filter(Boolean).join(" "),
        clause: giving.length ? `${list(giving.map(N))} ${giving.length > 1 ? "give" : "gives"} you energy` : `${list(taking.map(N))} ${taking.length > 1 ? "take" : "takes"} more energy than ${taking.length > 1 ? "they give" : "it gives"}` });
  }
  if (S && c.takes(S))
    add({ rule: "energy.source-takes", family: "mixed", areas: [S], evidence: [c.ev("interconnections.02"), c.ev(`${S}.energy`)], sufficiency: "explicit", wording: "wonder", valence: "mixed", relevance: 0.56,
      destinations: ["card.energy"],
      text: `You chose ${N(S)} as the area that gives you the most energy, and also said it ${energyWords(c.energy(S))}. Both can be true at different moments. It may be worth noticing which feels closer to an ordinary week.`,
      clause: `${N(S)} both energises and costs you` });

  // ── Alignment ─────────────────────────────────────────────────────────────
  if (P) {
    const quiet = c.unimportant(P);
    add({ rule: "alignment.priority-gap", family: "priority-gap", areas: [P], evidence: [c.ev("interconnections.05"), ...(quiet ? [c.ev(`${P}.importance`)] : [])], sufficiency: "explicit", wording: "state", valence: quiet ? "mixed" : "tension", relevance: 0.72,
      destinations: ["opening", "card.tension", "card.begin"],
      alternatives: ["The reason matters more than the label: it may be time, energy, circumstance or something you're still deciding."],
      text: `${N(P)} is the area you'd give more of yourself to, if you could. It matters, and it isn't getting the time or energy you'd like to give it.${quiet ? ` You also rated it "${c.impLabel(P)}", so it may matter in a way the importance question didn't capture.` : ""}`,
      clause: `${N(P)} matters more to you than the time it currently gets`,
      question: `What gets in the way of giving your ${N(P)} Orbit the time and energy it deserves, and is that something you'd want to change or accept for now?` });
  }
  if (E) {
    const k = c.keyed(`${E}.congruence`);
    const lowC = k !== null && k <= 0.25, highC = k !== null && k >= 0.75;
    add({ rule: "alignment.expectations", family: "expectations", areas: [E], evidence: [c.ev("interconnections.06"), ...(k !== null ? [c.ev(`${E}.congruence`)] : [])], sufficiency: lowC || highC ? "corroborated" : "explicit", wording: "state", valence: lowC ? "tension" : highC ? "mixed" : "neutral", relevance: 0.55 + (lowC ? 0.17 : 0),
      destinations: ["card.tension", "opening"],
      alternatives: ["Being influenced by others isn't the same as living someone else's life. Some expectations are ones you share."],
      text: `${N(E)} is where other people's voices are loudest for you: their expectations, and the standards around you.${lowC ? " It's also an area where the way you live doesn't fully feel like your own. Those two things may be connected." : highC ? " Even so, the way you live it still feels like yours. Influence and choice can sit side by side." : " Noticing that is useful in itself; it isn't a sign that your choices are wrong."}`,
      clause: `${N(E)} is the area most shaped by others' expectations`,
      question: `Which parts of your ${N(E)} Orbit feel like choices you've made, and which feel like choices you've inherited?` });
  }
  {
    const lowLived = orbits.filter((o) => c.important(o) && o !== E && c.low(`${o}.congruence`));
    for (const o of lowLived.slice(0, 2))
      add({ rule: "alignment.lived-values-low", family: "priority-gap", areas: [o], evidence: [c.ev(`${o}.importance`), c.ev(`${o}.congruence`)], sufficiency: "explicit", wording: "state", valence: "tension", relevance: 0.54,
        destinations: ["card.tension"],
        text: `${N(o)} matters to you, and yet the way it runs day to day doesn't fully feel like yours. It's one answer, so hold it lightly, but it may point to a quiet distance between what you value and how this area currently works.`,
        clause: `how you live ${N(o)} doesn't fully reflect what matters to you`,
        question: `If your ${N(o)} Orbit reflected what genuinely matters to you, what would be different in an ordinary week?` });
    const highLived = orbits.filter((o) => c.important(o) && c.high(`${o}.congruence`));
    if (highLived.length)
      add({ rule: "alignment.lived-values-high", family: "strength", areas: highLived, evidence: highLived.flatMap((o) => [c.ev(`${o}.importance`), c.ev(`${o}.congruence`)]), sufficiency: "explicit", wording: "state", valence: "strength", relevance: 0.44,
        destinations: ["card.support"],
        text: `You said the way you live ${list(highLived.map(N))} reflects what genuinely matters to you, not what you feel you should do. That's not a small thing.`,
        clause: `${list(highLived.map(N))} ${highLived.length > 1 ? "are" : "is"} lived in line with what matters to you` });
  }

  // ── Relationship with yourself ────────────────────────────────────────────
  const PAIRS: { a: string; b: string; text: string; clause: string; question: string; meaning?: string }[] = [
    { a: "sun.02", b: "sun.03", text: "You can admit to yourself when something isn't right. Being honest with yourself without being cruel to yourself feels less available, though. Seeing clearly and being gentle with what you see are two different skills.", clause: "you see clearly what isn't right, while being gentle with yourself about it feels harder", question: "How do you speak to yourself when you notice something isn't right?", meaning: "You may be holding yourself to account without the kindness you'd offer someone else." },
    { a: "sun.01", b: "sun.06", text: "You know what you truly want, even when others expect something different. Standing by your needs when it might disappoint someone feels less true right now. Knowing and acting on what you know don't necessarily move together.", clause: "you know what you want, while standing by it when it might disappoint someone feels harder", question: "Where does knowing what you want stop, and acting on it begin to feel costly?", meaning: "Other people's disappointment may weigh more than what you know you need." },
    { a: "sun.04", b: "sun.08", text: "You trust yourself with important decisions, while following through on the promises you make to yourself feels less true. Confidence in your judgment and consistency with yourself may be asking for different kinds of support.", clause: "you trust your judgment, while keeping promises to yourself feels harder", question: "Which promises to yourself are hardest to keep, and what tends to come first instead?", meaning: "You may give big decisions more care than the smaller promises you make to yourself." },
    { a: "sun.11", b: "sun.10", text: "You have a sense of what gives your life meaning. Keeping your own wellbeing a priority when life gets difficult feels less true, though. Meaning can keep you going; it doesn't always look after you.", clause: "you have a sense of meaning, while your own wellbeing slips under pressure", question: "When life gets difficult, what is usually the first thing you let go of?", meaning: "Your sense of purpose may be carrying you through, sometimes at your own expense." },
    { a: "sun.05", b: "sun.06", text: "You set boundaries that respect your needs, though holding them when it might disappoint someone feels harder. A boundary that's clear on paper can still be costly in the moment.", clause: "you set boundaries, while holding them under disappointment feels harder", question: "Whose disappointment is hardest for you to sit with?", meaning: "Keeping a boundary may get harder exactly when someone pushes against it." },
  ];
  const pair = PAIRS.find((p) => c.high(p.a) && c.low(p.b));
  if (pair)
    add({ rule: "self.contrast", family: "self", areas: ["sun"], evidence: [c.ev(pair.a), c.ev(pair.b)], sufficiency: "corroborated", wording: "suggest", valence: "mixed", relevance: 0.66,
      destinations: ["self", "opening"],
      alternatives: ["Neither answer is a flaw. The relationship with yourself is built in parts, and the parts don't all develop at the same pace."],
      text: pair.text, clause: pair.clause, question: pair.question, meaning: pair.meaning });
  {
    const used = pair ? [pair.a, pair.b] : [];
    const hi = his("sun").filter((i) => !used.includes(i)), lo = los("sun").filter((i) => !used.includes(i));
    if (hi.length >= 2)
      add({ rule: "self.strengths", family: "self", areas: ["sun"], evidence: hi.slice(0, 3).map(c.ev), sufficiency: "corroborated", wording: "suggest", valence: "strength", relevance: 0.48,
        destinations: ["self"],
        text: `${v("self.str", ["Some parts of this relationship appear well established. You describe", "There's something steady here. You describe"])} ${list(hi.slice(0, 3).map(c.capOf))}.`,
        clause: `you describe ${list(hi.slice(0, 2).map(c.capOf))}` });
    if (lo.length >= 2)
      add({ rule: "self.quieter", family: "self", areas: ["sun"], evidence: lo.slice(0, 2).map(c.ev), sufficiency: "corroborated", wording: "suggest", valence: "tension", relevance: 0.46,
        destinations: ["self"],
        alternatives: ["These may be parts of the relationship that are still being built, rather than something missing."],
        text: `${cap(c.lowPhrase(lo.slice(0, 2)))}. These may be parts of the relationship that are still being built, rather than something missing.`,
        clause: c.lowPhrase(lo.slice(0, 2)) });
    if (!pair && hi.length < 2 && lo.length < 2 && c.result.sun.confidence !== "insufficient")
      add({ rule: "self.even", family: "self", areas: ["sun"], evidence: c.statements("sun").filter(c.answered).slice(0, 3).map(c.ev), sufficiency: "single", wording: "wonder", valence: "neutral", relevance: 0.15,
        destinations: ["self"],
        text: "Your answers about your relationship with yourself sit mostly in the middle, not strongly one way or the other. That can mean things feel steady, or that some of these questions are still open for you.",
        clause: "your relationship with yourself sits mostly in the middle" });
  }
  {
    const o = orbits.find((x) => c.important(x) && c.low(`${x}.congruence`));
    if (o && c.high("sun.01"))
      add({ rule: "self.values-living", family: "self", areas: ["sun", o], evidence: [c.ev("sun.01"), c.ev(`${o}.importance`), c.ev(`${o}.congruence`)], sufficiency: "corroborated", wording: "wonder", valence: "mixed", relevance: 0.58,
        destinations: ["self"],
        text: `You describe knowing what you truly want. In ${N(o)}, though, you said the way you live it doesn't fully reflect what genuinely matters to you. That isn't a contradiction so much as a place where knowing and living may not yet line up.`,
        clause: `knowing what you want and how you live ${N(o)} may not yet line up`,
        question: "Where does what you already know about yourself show up in how you live, and where doesn't it yet?" });
  }

  // ── Feelings and statements that don't match (approved 13 Oct) ───────────
  const contrasted = new Set<OrbitId>();
  for (const o of orbits) {
    const t = c.tones(o);
    if (!c.by[o].emotions.length || c.by[o].supportConfidence !== "sufficient") continue;
    const desc = c.feelings(o);
    const items = c.supportEv(o).slice(0, 2);
    if (t.expansive.length >= 2 && !t.strained.length && !his(o).length) {
      contrasted.add(o);
      add({ rule: "contrast.feelings-statements", family: "mixed", areas: [o], evidence: [c.ev(`${o}.emotion`), ...(c.gives(o) ? [c.ev(`${o}.energy`)] : []), ...items], sufficiency: "corroborated", wording: "wonder", valence: "strength", relevance: 0.52,
        destinations: ["card.energy", "orbit"],
        text: `You described ${N(o)} with ${desc}${c.gives(o) ? ` and said it ${energyWords(c.energy(o))}` : ""}, while your answers about how it's set up sit ${c.lessSupported(o) ? "lower" : "in the middle"}. How it feels and how it's built into your life may not quite match.`,
        clause: `${N(o)} feels better than the statements about it suggest`,
        question: `What would it take for your ${N(o)} Orbit to be built into your weeks, not only felt in moments?` });
    } else if (t.strained.length >= 2 && !t.expansive.length && c.moreSupported(o)) {
      contrasted.add(o);
      add({ rule: "contrast.feelings-statements", family: "mixed", areas: [o], evidence: [c.ev(`${o}.emotion`), ...his(o).slice(0, 2).map(c.ev)], sufficiency: "corroborated", wording: "wonder", valence: "tension", relevance: 0.55,
        destinations: ["card.energy", "orbit"],
        text: `You described ${N(o)} with ${desc}, even though your answers describe it as well supported. How it looks and how it feels may not quite match.`,
        clause: `${N(o)} looks supported but feels heavy`,
        question: `What does your ${N(o)} Orbit cost you that doesn't show from the outside?` });
    }
  }

  // ── Feelings (wording only; never scored) ─────────────────────────────────
  for (const o of orbits) {
    if (contrasted.has(o)) continue;
    const t = c.tones(o);
    const names = c.by[o].emotions.map((e) => e.label);
    if (!names.length) continue;
    const evE = [c.ev(`${o}.emotion`)];
    const desc = c.feelings(o);
    if (t.expansive.length && (t.strained.length || t.ambivalent.length))
      add({ rule: "emotion.mixed", family: "emotion", areas: [o], evidence: evE, sufficiency: "explicit", wording: "state", valence: "mixed", relevance: 0.36,
        destinations: ["orbit", "card.energy"],
        text: `You described ${N(o)} with ${desc}. ${v(`coexist.${o}`, COEXIST_LINES)}`,
        clause: `${N(o)} brings ${desc}` });
    else if (t.strained.length >= 2 && !t.expansive.length)
      add({ rule: "emotion.strained", family: "emotion", areas: [o], evidence: evE, sufficiency: "explicit", wording: "suggest", valence: "tension", relevance: 0.4,
        destinations: ["orbit", "card.energy"],
        text: `You described ${N(o)} with ${desc}. It seems to be asking something of you right now.`,
        clause: `${N(o)} brings ${desc}` });
    else if (t.expansive.length >= 2 && !t.strained.length)
      add({ rule: "emotion.alive", family: "emotion", areas: [o], evidence: evE, sufficiency: "explicit", wording: "suggest", valence: "strength", relevance: 0.36,
        destinations: ["orbit", "card.support"],
        text: `You described ${N(o)} with ${desc}. Something there seems to be feeding you.`,
        clause: `${N(o)} brings ${desc}` });
  }

  // ── Life interconnections (≥2 responses or an explicit Interconnections answer) ──
  const competes = !!ic.overallSupport?.value.includes("compete");
  if (C && D && C !== D)
    add({ rule: "link.demand-crowded", family: "tradeoff", areas: [D, C], evidence: [c.ev("interconnections.04"), c.ev("interconnections.01"), ...(competes ? [c.ev("interconnections.07")] : [])], sufficiency: "explicit", wording: "wonder", valence: "tension", relevance: 0.74, link: "stated-influence",
      destinations: ["opening", "connections", "card.tension"],
      alternatives: ["A trade-off can be temporary, deliberate and right for this season."],
      text: `You said ${N(C)} receives less care because another part of your life demands so much, and you named ${N(D)} as what takes the most of your time and energy. These two answers may be describing the same trade-off.${competes ? " It also fits what you said about your life overall: the areas compete for your time and energy." : ""}`,
      clause: `${N(C)} seems to be making room for ${N(D)}`,
      question: `Is the space your ${N(C)} Orbit has right now a trade-off you'd choose again for this season?` });
  {
    const amb = (["growth", "social"] as OrbitId[]).filter((o) => (c.important(o) && !c.lessSupported(o)) || D === o);
    const restFriction = c.low("restoration.02"); // reverse-keyed: endorsing "rest is sacrificed" → low keyed
    const restLow = restFriction || c.lessSupported("restoration") || C === "restoration";
    const restHigh = c.moreSupported("restoration") && !restFriction && C !== "restoration";
    if (amb.length) {
      const ambEv = amb.map((o) => (D === o ? c.ev("interconnections.01") : c.ev(`${o}.importance`)));
      const restEv = restFriction ? [c.ev("restoration.02")] : C === "restoration" ? [c.ev("interconnections.04")] : c.supportEv("restoration").slice(0, 3);
      const what = list(amb.map(N));
      if (restLow)
        add({ rule: "link.ambition-restoration", family: "ambition-restoration", areas: [...amb, "restoration"], evidence: [...ambEv, ...restEv], sufficiency: "corroborated", wording: "suggest", valence: "tension", relevance: 0.76, link: "co-occurrence",
          destinations: ["opening", "connections"],
          alternatives: ["That doesn't automatically mean you're doing too much. You may genuinely enjoy the pace you're moving at."],
          text: `${what} ${amb.length > 1 ? "seem" : "seems"} to matter a great deal to you${amb.some((o) => o === D) ? ", and to receive a lot of your attention" : ""}. Your answers also suggest that ${restFriction ? "rest and personal care tend to be the first things you sacrifice when life gets busy" : C === "restoration" ? "Restoration is the area receiving less care because of other demands" : "Restoration hasn't been receiving the same space"}.`,
          clause: `${what} ${amb.length > 1 ? "are" : "is"} getting a lot of your energy while restoration gets less`,
          question: "What would change if you gave the same attention to your recovery that you give to your ambitions?" });
      else if (restHigh)
        add({ rule: "link.ambition-restoration", family: "strength", areas: [...amb, "restoration"], evidence: [...ambEv, ...c.supportEv("restoration").slice(0, 2)], sufficiency: "corroborated", wording: "suggest", valence: "strength", relevance: 0.52, link: "co-occurrence",
          destinations: ["connections", "card.support"],
          text: `${what} ${amb.length > 1 ? "matter" : "matters"} a lot to you, and Restoration also appears well supported in your answers. Ambition and recovery don't easily sit together; in your answers they seem to be making room for each other.`,
          clause: "ambition and recovery seem to be making room for each other" });
    }
  }
  {
    const tired = c.low("body.01");
    const mindStrain = c.low("mind.04") || c.low("mind.05") || c.tones("mind").ids.includes("fatigue");
    if (tired && mindStrain) {
      const mEv = c.low("mind.04") ? "mind.04" : c.low("mind.05") ? "mind.05" : "mind.emotion";
      const mText = mEv === "mind.04" ? "knowing what helps you feel calm and grounded when overwhelmed feels less available" : mEv === "mind.05" ? "overthinking, comparison or worry take more of your attention than you want" : "fatigue is one of the feelings you chose for Mind";
      add({ rule: "link.body-mind", family: "body-mind", areas: ["body", "mind"], evidence: [c.ev("body.01"), c.ev(mEv)], sufficiency: "corroborated", wording: "wonder", valence: "tension", relevance: 0.58, link: "co-occurrence",
        destinations: ["connections"],
        text: `Two answers sit side by side: having enough physical energy for everyday demands feels less true right now, and ${mText}. Body and mind often affect each other, though your answers alone can't say which way it runs.`,
        clause: "low physical energy and mental strain appear together",
        question: "When your body has more energy, what changes in your mind, and the other way round?" });
    } else if (c.high("body.01") && c.high("mind.04"))
      add({ rule: "link.body-mind", family: "strength", areas: ["body", "mind"], evidence: [c.ev("body.01"), c.ev("mind.04")], sufficiency: "corroborated", wording: "suggest", valence: "strength", relevance: 0.38, link: "co-occurrence",
        destinations: ["connections"],
        text: "You describe having enough physical energy for everyday demands, and knowing what helps you feel calm and grounded when things get overwhelming. Body and mind seem to be supporting each other.",
        clause: "body and mind seem to support each other" });
  }
  {
    const st = c.by.social.subthemes;
    if (st && st.career !== null && st.community !== null && Math.abs(st.career - st.community) >= 0.35) {
      const workUp = st.career > st.community;
      add({ rule: "link.career-community", family: "career-belonging", areas: ["social"], evidence: ["social.04", "social.02", "social.06"].filter(c.answered).map(c.ev), sufficiency: "corroborated", wording: "suggest", valence: "mixed", relevance: 0.52, link: "co-occurrence",
        destinations: ["connections"],
        text: workUp
          ? "Within Social World, work and community read differently: your answers about work are more positive than your answers about belonging and being seen. One part of this Orbit may be carrying the other."
          : "Within Social World, community and work read differently: you describe more belonging and connection than ease with the time and energy you give to work.",
        clause: workUp ? "work feels steadier than belonging" : "belonging feels steadier than work",
        question: workUp ? "Where, outside work, do you feel most like yourself among other people?" : "What would make the time and energy you give to work feel right for the life you want?" });
    }
  }
  if (c.low("restoration.06") && c.low("joy.02"))
    add({ rule: "link.permission", family: "permission", areas: ["restoration", "joy"], evidence: [c.ev("restoration.06"), c.ev("joy.02")], sufficiency: "corroborated", wording: "suggest", valence: "tension", relevance: 0.64, link: "co-occurrence",
      destinations: ["opening", "connections"],
      alternatives: ["It may be a pattern, or simply what this season allows."],
      text: "Resting without guilt and enjoying pleasure without feeling you need to earn it both feel less true for you right now. Together, they raise a question about how much permission you give yourself simply to receive.",
      clause: "rest and pleasure both seem to need earning first",
      question: "What would rest or pleasure feel like if you didn't have to earn it first?" });
  if (c.low("sun.10") && (c.low("restoration.05") || c.low("restoration.02"))) {
    const perfect = c.low("restoration.05");
    add({ rule: "link.standards-care", family: "standards", areas: ["sun", "restoration"], evidence: [c.ev("sun.10"), c.ev(perfect ? "restoration.05" : "restoration.02")], sufficiency: "corroborated", wording: "wonder", valence: "tension", relevance: 0.6, link: "co-occurrence",
      destinations: ["opening", "connections"],
      text: perfect
        ? "Keeping your wellbeing a priority when life gets difficult feels less true for you, and self-care can feel like another thing to do perfectly. Together, these answers may describe a high bar, where caring for yourself becomes one more thing to get right."
        : "Keeping your wellbeing a priority when life gets difficult feels less true for you, and rest tends to be the first thing to go when life gets busy. Under pressure, your own care may be what gives way first.",
      clause: "your own care gives way first under pressure",
      question: "What happens to your own care when the pressure rises, and what would you want to keep, no matter what?" });
  }
  {
    const loveLow = ["love.01", "love.02"].find((i) => c.answered(i) && c.low(i));
    const voiceLow = ["sun.06", "social.03"].find(c.low);
    if (loveLow && voiceLow)
      add({ rule: "link.voice", family: "self-expression", areas: ["love", voiceLow.startsWith("sun") ? "sun" : "social"], evidence: [c.ev(loveLow), c.ev(voiceLow)], sufficiency: "corroborated", wording: "wonder", valence: "tension", relevance: 0.55, link: "co-occurrence",
        destinations: ["connections"],
        text: `${cap(c.capOf(loveLow))} feels less true right now, and so does ${c.capOf(voiceLow)}. Expressing what you need may be a thread running through more than one part of your life.`,
        clause: "expressing what you need feels harder in more than one place",
        question: "Where is it easiest for you to say what you need, and what makes it easier there?" });
  }
  if (c.low("resources.06") && (c.high("growth.05") || c.important("growth")))
    add({ rule: "link.room-to-grow", family: "resources-freedom", areas: ["resources", "growth"], evidence: [c.ev("resources.06"), c.high("growth.05") ? c.ev("growth.05") : c.ev("growth.importance")], sufficiency: "corroborated", wording: "wonder", valence: "mixed", relevance: 0.5, link: "co-occurrence",
      destinations: ["connections"],
      text: `${c.high("growth.05") ? "You describe growing into the person you want to become" : "Growth matters a great deal to you"}, while having enough freedom and room to grow in your financial and living situation feels less true. Your inner direction and your practical circumstances may be moving at different speeds.`,
      clause: "your inner direction and practical room to grow are moving at different speeds",
      question: "What would a little more room, practically, make possible for you?" });
  if (c.low("resources.05") && c.low("growth.06"))
    add({ rule: "link.familiar", family: "status-quo", areas: ["resources", "growth"], evidence: [c.ev("resources.05"), c.ev("growth.06")], sufficiency: "corroborated", wording: "wonder", valence: "tension", relevance: 0.62, link: "co-occurrence",
      destinations: ["opening", "connections", "card.begin"],
      alternatives: ["Staying with what's familiar can also be wise. Not every change is the right one, or the right one now."],
      text: "You describe staying in familiar financial or living circumstances because change feels uncertain, and knowing what would help you grow but putting it off. Both answers touch on how change feels to you right now.",
      clause: "change, in more than one area, feels uncertain right now",
      question: "What are you protecting by keeping things as they are, and what might you be ready to explore?" });
  if ((c.important("growth") || D === "growth") && (c.low("joy.02") || c.low("joy.04")) && !(c.low("restoration.06") && c.low("joy.02"))) {
    const j = c.low("joy.04") ? "joy.04" : "joy.02";
    add({ rule: "link.growth-joy", family: "growth-joy", areas: ["growth", "joy"], evidence: [D === "growth" ? c.ev("interconnections.01") : c.ev("growth.importance"), c.ev(j)], sufficiency: "corroborated", wording: "wonder", valence: "tension", relevance: 0.5, link: "co-occurrence",
      destinations: ["connections"],
      text: `Growth matters a lot to you, while ${j === "joy.04" ? "making time for what makes you feel alive" : "enjoying pleasure or rest without needing to earn it"} feels less true right now. Growth and joy can feed each other, or one can quietly take the other's place.`,
      clause: "growth may be taking some of joy's space",
      question: "Which parts of your growth feel joyful, and which feel like obligation?" });
  }
  if (L && c.moreSupported(L) && !c.lessSupported(L))
    add({ rule: "link.lever-strong", family: "leverage", areas: [L], evidence: [c.ev("interconnections.03"), ...c.statements(L).filter(c.high).slice(0, 2).map(c.ev)], sufficiency: "corroborated", wording: "wonder", valence: "mixed", relevance: 0.55,
      destinations: ["card.begin"],
      text: `You chose ${N(L)} as the area where improvement could positively influence the rest of your life, and it's already one of the better supported areas in your answers.`,
      clause: `you see ${N(L)}, already a strength, as the area that could lift the rest`,
      question: `What would "even better" look like in your ${N(L)} Orbit, and what would it change elsewhere?` });
  else if (L) {
    const less = c.lessSupported(L), same = L === P;
    add({ rule: "link.leverage", family: "leverage", areas: [L], evidence: [c.ev("interconnections.03"), ...(same ? [c.ev("interconnections.05")] : [])], sufficiency: "explicit", wording: "state", valence: "neutral", relevance: 0.58 + (less || same ? 0.08 : 0),
      destinations: ["card.begin", "connections"],
      text: `You chose ${N(L)} as the area where improvement could positively influence the rest of your life.${less ? " It's also one of the less supported areas in your answers, which may be part of why it feels like a lever." : ""}${same ? " It's also what you said gets less of your time than you'd like." : ""}`,
      clause: `you see ${N(L)} as the area that could lift the rest`,
      question: `If your ${N(L)} Orbit improved even a little, what would you notice first in the rest of your life?` });
  }
  if (ic.overallSupport && !(competes && C && D && C !== D)) {
    const v7 = ic.overallSupport.value;
    add({ rule: "link.overall", family: "system", areas: [], evidence: [c.ev("interconnections.07")], sufficiency: "explicit", wording: "state", valence: v7.includes("compete") ? "tension" : v7.includes("support") ? "strength" : "mixed", relevance: 0.34,
      destinations: ["connections", "card.overview"],
      text: SUPPORT_COMPETE_READING[v7] ?? `You described the parts of your life this way: ${ic.overallSupport.label.toLowerCase()}.`,
      clause: v7 === "mix" ? "your areas of life both help and compete" : `the areas of your life ${ic.overallSupport.label.replace(/^They /, "").toLowerCase()}` });
  }

  // ── One Orbit holding several roles (approved 13 Oct) ─────────────────────
  for (const o of orbits) {
    if (D === o && S === o) continue; // "asks a lot, gives a lot" covers it
    const roles: { text: string; ev: string }[] = [];
    if (D === o) roles.push({ text: "the area taking most of your time and energy", ev: "interconnections.01" });
    if (L === o) roles.push({ text: "the area you believe could lift the rest of your life", ev: "interconnections.03" });
    if (P === o) roles.push({ text: "something that matters more than the time you can give it", ev: "interconnections.05" });
    // Others' expectations count as a role only when they don't also say they live it by their own values.
    if (E === o && !c.high(`${o}.congruence`)) roles.push({ text: "the area most shaped by other people's expectations", ev: "interconnections.06" });
    const heavy = c.takes(o) || c.tones(o).strained.length >= 2;
    if (roles.length < 2 || !(c.important(o) || heavy)) continue;
    const crowd = D === o && C && C !== o ? C : null;
    const t = c.tones(o);
    add({ rule: "centre.roles", family: "centre", areas: crowd ? [o, crowd] : [o],
      evidence: [...(c.important(o) ? [c.ev(`${o}.importance`)] : []), ...roles.map((r) => c.ev(r.ev)), ...(crowd ? [c.ev("interconnections.04")] : []), ...(c.takes(o) ? [c.ev(`${o}.energy`)] : []), ...(t.strained.length ? [c.ev(`${o}.emotion`)] : [])],
      sufficiency: "explicit", wording: "suggest", valence: "tension", relevance: 0.9,
      destinations: ["opening", "card.tension"],
      text: `${N(o)} seems to sit at the centre of your life right now. It's ${list([...(c.important(o) ? [`what you rated "${c.impLabel(o)}"`] : []), ...roles.map((r) => r.text)])}${crowd ? `, and ${N(crowd)} is receiving less care in the meantime` : ""}.${c.takes(o) ? ` You said it ${energyWords(c.energy(o))}${t.strained.length ? `, and described it with ${c.feelings(o)}` : ""}.` : ""}`,
      clause: `${N(o)} sits at the centre of your life right now`,
      question: `If your ${N(o)} Orbit asked a little less of you, where would that energy go first?` });
  }

  // ── A crowded-out area rated unimportant (approved 13 Oct) ────────────────
  if (C && c.unimportant(C))
    add({ rule: "alignment.crowded-unimportant", family: "mixed", areas: [C], evidence: [c.ev("interconnections.04"), c.ev(`${C}.importance`)], sufficiency: "explicit", wording: "wonder", valence: "mixed", relevance: 0.5,
      destinations: ["card.tension"],
      text: `You said ${N(C)} receives less care because of other demands, and you also rated it "${c.impLabel(C)}".`,
      clause: `${N(C)} gets less care, and you rated it "${c.impLabel(C)}"`,
      question: `Is the space your ${N(C)} Orbit has right now one you're at peace with?` });

  // ── Strengths that reinforce each other (approved 13 Oct) ─────────────────
  {
    const REINFORCE: [string, string][] = [["sun.04", "growth.02"], ["sun.05", "restoration.03"], ["sun.03", "body.06"], ["sun.06", "social.03"], ["sun.11", "growth.05"]];
    const pr = REINFORCE.find(([a, b]) => c.high(a) && c.high(b));
    if (pr) {
      const orb = pr[1].split(".")[0] as OrbitId;
      add({ rule: "strength.reinforcing", family: "strength", areas: ["sun", orb], evidence: [c.ev(pr[0]), c.ev(pr[1])], sufficiency: "corroborated", wording: "suggest", valence: "strength", relevance: 0.5, link: "co-occurrence",
        destinations: ["card.support"],
        text: `Two strengths appear side by side in your answers: ${c.capOf(pr[0])}, and ${c.capOf(pr[1])}.`,
        clause: `${c.capOf(pr[0])} sits alongside ${c.capOf(pr[1])}`,
        question: "When things get harder, which of your strengths do you reach for first?" });
    }
  }

  // ── Whole-Map patterns ────────────────────────────────────────────────────
  const lower = orbits.filter((o) => c.by[o].supportConfidence === "sufficient" && (c.by[o].responseSupportIndex ?? 1) <= 0.4);
  if (lower.length >= 4) {
    const byImp = [...lower].sort((a, b) => (c.imp(b) ?? 0) - (c.imp(a) ?? 0)).slice(0, 3);
    add({ rule: "pattern.several", family: "several", areas: byImp, evidence: byImp.flatMap((o) => c.supportEv(o).slice(0, 2)), sufficiency: "corroborated", wording: "suggest", valence: "tension", relevance: 0.85,
      destinations: ["opening"],
      alternatives: ["That's a lot to carry, and it may help to look at it one piece at a time rather than all at once."],
      text: `Your answers describe a season in which several parts of life are asking for care at the same time, among them ${list(byImp.map(N))}.`,
      clause: "several parts of life are asking for care at once" });
  }
  const allGood = c.sufficient.length >= 6 && c.sufficient.every((o) => o.responseSupportIndex! >= 0.6) && !P && !C;
  if (allGood) {
    const best = c.top.length ? c.top : c.mostImportant;
    add({ rule: "pattern.well-supported", family: "well-supported", areas: best, evidence: c.sufficient.flatMap((o) => c.supportEv(o.orbit).slice(0, 1)), sufficiency: "corroborated", wording: "suggest", valence: "strength", relevance: 0.68,
      destinations: ["opening", "card.overview"],
      alternatives: ["A Map like this isn't a reason to look for a problem."],
      text: `Across your answers, most areas of your life appear well supported${best.length ? `, with ${list(best.map(N))} standing out` : ""}.`,
      clause: "most areas of your life appear well supported",
      question: "What is making your life work right now, and how would you protect it if things became busier?" });
  }

  return out.sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id));
}
