/**
 * Private Coach Intelligence Report (Coach Report v2, per "Private Coach Intelligence Report" guidelines, 12 Oct 2026).
 *
 * Deterministic evidence → interpretation. Every insight stores the exact answers it rests on, qualifying
 * (counter) evidence, a confidence level, alternative explanations and questions that could confirm or
 * challenge it. Language is that of a thoughtful coach preparing to meet someone — "their answers suggest",
 * "worth exploring" — and never diagnostic. Nothing here is shown to the respondent.
 *
 * Interpretation hierarchy: reported fact → supported pattern → tentative hypothesis. Never presented the other way round.
 */
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { itemEvidence } from "@/engine/compute";
import { QUESTION_BANK, questionById } from "@/content/v10/question-bank";
import type { OrbitId } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { type Answers, answerLabel } from "./shared";
import { ORBIT_DEEPER_QUESTION, PHRASES } from "./phrases";

export const INTELLIGENCE_TEMPLATE_VERSION = "coach-intelligence-1";

export type Claim = "observation" | "pattern" | "hypothesis";
export type Confidence = "higher" | "moderate" | "tentative";
export interface Ev { questionId: string; answer: string }

/** One interpretation the coach can later mark as confirmed, clarified or challenged. */
export interface Insight {
  id: string;
  section: SectionKey;
  title: string;
  text: string;
  claim: Claim;
  confidence: Confidence;
  orbits: OrbitId[];
  evidence: Ev[];
  counterEvidence: Ev[];
  alternatives: string[];
  questions: string[];
  /** Whether it makes sense to ask the client about it (validation in the session). */
  validatable: boolean;
}

export type SectionKey =
  | "overview" | "self" | "values" | "orbits" | "patterns" | "strengths" | "friction" | "direction" | "readiness" | "opportunity";

export type ReadinessLevel = "established" | "partly established" | "not yet established";
export interface CoachIntelligence {
  templateVersion: string;
  versions: LifeMapResult["versions"];
  overview: { portrait: string; centralTheme: string; centralThemeInsightId: string | null };
  self: { dimensions: Insight[]; established: string[]; needsAttention: string[]; keyQuestion: string };
  values: { values: string; needs: string; alignment: Insight[] };
  orbits: (Insight & { working: string; difficult: string; relationship: string; deeperQuestion: string; connection: string })[];
  patterns: Insight[];
  strengths: { internal: Insight[]; external: Insight[] };
  friction: Insight[];
  direction: { summary: string; nextChapter: string; evidence: Ev[] };
  readiness: { dimensions: { key: string; label: string; level: ReadinessLevel; note: string; evidence: Ev[] }[]; conclusion: ReadinessConclusion; conclusionReason: string };
  opportunity: { goals: string[]; themes: string[]; methodology: string[]; outcomes: string[]; clarify: string[]; cautions: string[]; invitation: string };
  /** Jana's own observations added while editing. */
  coachObservations?: string[];
  /** Flat list of every validatable insight, in reading order (used for post-session marking). */
  validatable: { id: string; section: SectionKey; title: string }[];
}
export type ReadinessConclusion = "Explore 1:1 coaching fit" | "Clarify goals and readiness during the Deep Dive" | "Consider a different form of support";

// ── helpers ──────────────────────────────────────────────────────────────────
const ORBIT_NAMES: Record<OrbitId, string> = { mind: "Mind", body: "Body", restoration: "Restoration", growth: "Growth", love: "Love", social: "Social World", resources: "Resources", joy: "Joy" };
/** Joins phrases; uses semicolons when a phrase itself contains a comma, so lists stay readable. */
const list = (xs: string[]) => {
  if (xs.length <= 1) return xs.join("");
  const sep = xs.some((x) => x.includes(",")) ? "; " : ", ";
  return `${xs.slice(0, -1).join(sep)}${sep === "; " ? "; and " : " and "}${xs[xs.length - 1]}`;
};
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ctx(result: LifeMapResult, answers: Answers) {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o])) as Record<OrbitId, OrbitResult>;
  const keyed = (id: string) => itemEvidence(id, answers[id]).keyed;
  /** raw agreement 1..5 regardless of keying (5 = Completely true) */
  const raw = (id: string) => itemEvidence(id, answers[id]).ordinal;
  const ev = (id: string): Ev => ({ questionId: id, answer: answerLabel(id, answers[id]) });
  const answered = (id: string) => answers[id] !== undefined && answers[id] !== NOT_APPLICABLE;
  const high = (id: string) => (keyed(id) ?? -1) >= 0.75;
  const low = (id: string) => { const k = keyed(id); return k !== null && k <= 0.25; };
  const endorsed = (id: string) => (raw(id) ?? 0) >= 4; // Very or Completely true
  const capOf = (id: string) => PHRASES[id]?.cap ?? questionById(id)?.prompt ?? id;
  const isFriction = (id: string) => !!(questionById(id)?.reverseKeyed && PHRASES[id]?.friction);
  /** Single item, as a noun phrase usable in a list (friction phrase for reverse items). */
  const lowPhrase = (id: string) => (isFriction(id) ? PHRASES[id].friction! : `${capOf(id)} feeling less true for them`);
  /** Several low items as one clause: "A and B appear less true for them right now, and they describe C". */
  const lows = (ids: string[]) => {
    const caps = ids.filter((i) => !isFriction(i)).map(capOf), fr = ids.filter(isFriction).map((i) => PHRASES[i].friction!);
    const a = caps.length ? `${list(caps)} ${caps.length > 1 ? "appear" : "appears"} less true for them right now` : "";
    const b = fr.length ? `${a ? ", and they describe " : "they describe "}${list(fr)}` : "";
    return a + b;
  };
  const ic = result.interconnections;
  const imp = (o: OrbitId) => by[o].importanceDirect ?? 0;
  const support = (o: OrbitId) => by[o].responseSupportIndex;
  const drains = (o: OrbitId) => (by[o].energyRaw ?? 0) >= 4;
  const gives = (o: OrbitId) => (by[o].energyRaw ?? 6) <= 2;
  const emotions = (o: OrbitId) => by[o].emotions.map((e) => e.label);
  const statements = (o: OrbitId | "sun") => QUESTION_BANK.filter((q) => q.chapterId === o && q.responseType === "truth" && q.enabled && q.measure !== "congruence").map((q) => q.id);
  return { by, keyed, raw, ev, answered, high, low, endorsed, capOf, lowPhrase, lows, ic, imp, support, drains, gives, emotions, statements };
}
type Ctx = ReturnType<typeof ctx>;

const confidenceFrom = (n: number, counter: number): Confidence => (n >= 3 && counter === 0 ? "higher" : n >= 2 ? "moderate" : "tentative");

// ── B. Relationship with self ───────────────────────────────────────────────
const SELF_DIMENSIONS: { key: string; label: string; items: string[]; question: string }[] = [
  { key: "awareness", label: "Self-awareness", items: ["sun.01", "mind.06", "mind.03"], question: "When do they feel most clear about what they want, and when does that clarity fade?" },
  { key: "honesty", label: "Self-honesty", items: ["sun.02", "sun.03"], question: "What is it like for them to admit something isn't working — and how do they speak to themselves when they do?" },
  { key: "trust", label: "Self-trust", items: ["sun.04", "sun.05", "sun.06", "sun.08"], question: "Where do they trust their own judgment most, and where do they defer to others?" },
  { key: "acceptance", label: "Self-acceptance", items: ["sun.03", "sun.07", "sun.09"], question: "How do they treat themselves on a day when they fall short of their own standards?" },
  { key: "responsibility", label: "Personal responsibility", items: ["sun.07", "sun.08", "resources.04"], question: "Which parts of their current life feel within their influence, and which feel out of their hands?" },
  { key: "direction", label: "Identity and direction", items: ["sun.11", "sun.01", "growth.05"], question: "What kind of life are they trying to create in the next few years, in their own words?" },
];

function selfSection(c: Ctx) {
  const dims: Insight[] = [];
  for (const d of SELF_DIMENSIONS) {
    const items = d.items.filter(c.answered);
    if (items.length < 2) continue;
    const vals = items.map((i) => c.keyed(i)!);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const hi = items.filter(c.high), lo = items.filter(c.low);
    let text: string, title: string;
    if (mean >= 0.7 && !lo.length) {
      title = `${d.label}: appears established`;
      text = `Their answers describe ${list(hi.map(c.capOf))}. This looks like a resource they can lean on.`;
    } else if (mean <= 0.35) {
      title = `${d.label}: may need attention`;
      text = `${sentence(c.lows(items))}. Before drawing a conclusion, it would help to understand whether this is longstanding or tied to their current circumstances.`;
    } else if (hi.length && lo.length) {
      title = `${d.label}: mixed`;
      text = `There is an interesting contrast here: they describe ${list(hi.map(c.capOf))}, while ${c.lows(lo)}. Both can be true at once.`;
    } else {
      title = `${d.label}: partly in place`;
      text = `Their answers sit in the middle range here — some ${list(items.map(c.capOf))}, without it being consistently easy.`;
    }
    dims.push({
      id: `self.${d.key}`, section: "self", title, text, claim: lo.length && hi.length ? "pattern" : "observation",
      confidence: confidenceFrom(items.length, 0), orbits: [], evidence: items.map(c.ev), counterEvidence: [],
      alternatives: mean <= 0.35 ? ["A demanding season can make these answers lower than usual.", "They may hold themselves to a high standard when rating themselves."] : [],
      questions: [d.question], validatable: true,
    });
  }
  // Possible inconsistency in self-report (not a judgement of honesty)
  if (c.high("sun.08") && c.endorsed("growth.06"))
    dims.push({
      id: "self.consistency", section: "self", title: "A possible inconsistency in self-report", claim: "hypothesis", confidence: "tentative", orbits: ["growth"],
      text: "They describe following through on promises to themselves, and also knowing what would help them grow but putting it off. This may point to a difference between everyday commitments and bigger, riskier steps.",
      evidence: [c.ev("sun.08"), c.ev("growth.06")], counterEvidence: [],
      alternatives: ["They may keep small promises reliably while larger ones feel different in kind.", "The two questions may have brought different areas of life to mind."],
      questions: ["Which kinds of commitments to themselves do they keep easily, and which tend to slide?"], validatable: true,
    });
  const established = dims.filter((d) => d.title.endsWith("appears established")).map((d) => d.title.split(":")[0]);
  const needsAttention = dims.filter((d) => /needs attention|may need attention|mixed/.test(d.title)).map((d) => d.title.split(":")[0]);
  const keyQ = dims.find((d) => /may need attention/.test(d.title)) ?? dims.find((d) => /mixed/.test(d.title)) ?? dims[0];
  return { dimensions: dims, established, needsAttention, keyQuestion: keyQ?.questions[0] ?? SELF_DIMENSIONS[5].question };
}

// ── C. Values, needs and alignment ──────────────────────────────────────────
function valuesSection(c: Ctx, result: LifeMapResult) {
  const top = result.orbits.filter((o) => (o.importanceDirect ?? 0) >= 0.75).map((o) => o.name);
  const values = top.length
    ? `They rate ${list(top)} as highly important right now. Importance ratings alone don't capture values: a high rating can reflect genuine desire, current difficulty, others' expectations or practical necessity.${c.high("sun.11") ? " They also describe a sense of what gives their life meaning." : ""}`
    : "No area stands out as highly important in their ratings. That can reflect balance, uncertainty, or a season of holding things lightly — worth asking about rather than assuming.";
  const needItems = ["body.04", "restoration.03", "love.02", "social.02", "resources.03", "restoration.01"].filter(c.answered);
  const metNeeds = needItems.filter(c.high).map(c.capOf), unmet = needItems.filter(c.low).map(c.capOf);
  const needs = [
    metNeeds.length ? `Needs that appear met: ${list(metNeeds)}.` : "",
    unmet.length ? `Needs that may be less met: ${list(unmet)}.` : "",
    !metNeeds.length && !unmet.length ? "Their answers about everyday needs (rest, recovery, being understood, surroundings) sit in the middle range." : "",
  ].filter(Boolean).join(" ");

  const out: Insight[] = [];
  const push = (i: Omit<Insight, "section" | "validatable" | "claim"> & { claim?: Claim }) => out.push({ claim: "hypothesis", section: "values", validatable: true, ...i });
  // 1. Strong importance, limited support
  for (const o of result.orbits) {
    if ((o.importanceDirect ?? 0) >= 0.75 && o.responseSupportIndex !== null && o.responseSupportIndex <= 0.45 && o.supportConfidence !== "insufficient") {
      const lows = c.statements(o.orbit).filter(c.low);
      push({ id: `values.gap.${o.orbit}`, title: `${o.name} matters a lot and feels less supported`, orbits: [o.orbit], confidence: lows.length >= 2 ? "moderate" : "tentative",
        text: `They rate ${o.name} "${c.ev(`${o.orbit}.importance`).answer}", while ${lows.length ? c.lows(lows.slice(0, 2)) : "their answers describe limited support there"}.`,
        evidence: [c.ev(`${o.orbit}.importance`), ...lows.slice(0, 3).map(c.ev)], counterEvidence: c.statements(o.orbit).filter(c.high).slice(0, 2).map(c.ev),
        alternatives: ["The high importance may reflect how much attention the area is currently demanding, not only desire.", "A recent change may explain the gap."],
        questions: [`What would it look like for ${o.name} to feel more supported — and what is in the way right now?`] });
    }
  }
  // 2. High standards alongside difficulty holding boundaries
  if (c.low("restoration.05") && (c.low("sun.05") || c.low("sun.06")))
    push({ id: "values.standards_boundaries", title: "High standards, harder boundaries", orbits: ["restoration"], confidence: "moderate",
      text: "Self-care can feel like another thing to do perfectly, and holding boundaries around their own needs seems harder. There may be a tension between high personal standards and protecting their needs.",
      evidence: [c.ev("restoration.05"), ...["sun.05", "sun.06"].filter(c.low).map(c.ev)], counterEvidence: [],
      alternatives: ["Their current role or circumstances may leave little room for boundaries, whatever their standards."],
      questions: ["Where do they hold themselves to the highest standard — and who benefits when they do?"] });
  // 3. Desire for connection, limited intimacy (N/A never counts)
  if (c.imp("love") >= 0.75 && (c.low("love.03") || c.low("love.02")))
    push({ id: "values.connection", title: "Wanting closeness, limited room for it", orbits: ["love"], confidence: "tentative",
      text: `Love is highly important to them, while ${c.lows(["love.03", "love.02"].filter(c.low))}.`,
      evidence: [c.ev("love.importance"), ...["love.03", "love.02"].filter(c.low).map(c.ev)], counterEvidence: ["love.01", "love.05"].filter(c.high).map(c.ev),
      alternatives: ["Their current life may simply offer limited opportunity for this kind of connection, rather than any difficulty with it."],
      questions: ["Is expressing needs in intimate relationships something they find difficult, or does their life right now offer few chances for it?"] });
  // 5. Obligation competing with chosen priorities
  if (c.ic.externalInfluence) {
    const o = c.ic.externalInfluence;
    const cong = c.keyed(`${o}.congruence`);
    push({ id: `values.expectations.${o}`, title: `${ORBIT_NAMES[o]} and others' expectations`, orbits: [o], confidence: cong !== null && cong <= 0.5 ? "moderate" : "tentative",
      text: `They identified ${ORBIT_NAMES[o]} as most influenced by other people's expectations or social standards${cong !== null ? `. Asked whether they live it according to what genuinely matters to them, they answered "${c.ev(`${o}.congruence`).answer}"` : ""}. This is context, not proof that the area isn't theirs.`,
      evidence: [c.ev("interconnections.06"), ...(cong !== null ? [c.ev(`${o}.congruence`)] : [])], counterEvidence: [],
      alternatives: ["Expectations can be welcome and shared; this alone doesn't mean the area isn't theirs."],
      questions: [`Which expectations around ${ORBIT_NAMES[o]} feel like their own, and which feel borrowed?`] });
  }
  return { values, needs, alignment: out };
}

// ── D. Eight Orbits ─────────────────────────────────────────────────────────
function orbitSection(c: Ctx, result: LifeMapResult) {
  return result.orbits.map((o) => {
    const ids = c.statements(o.orbit);
    const hi = ids.filter(c.high), lo = ids.filter(c.low);
    const working = hi.length ? `${sentence(list(hi.slice(0, 3).map(c.capOf)))}.` : "No statement in this area stands out as clearly strong.";
    const difficult = lo.length ? `${sentence(c.lows(lo.slice(0, 3)))}.` : "No statement in this area stands out as clearly difficult.";
    const naNote = o.coverage.notApplicable ? ` ${o.coverage.notApplicable} question${o.coverage.notApplicable > 1 ? "s were" : " was"} marked not applicable and ${o.coverage.notApplicable > 1 ? "are" : "is"} treated as unavailable evidence, not a negative answer.` : "";
    const feel = o.emotions.length ? ` They chose ${list(o.emotions.map((e) => e.label))} to describe it.` : "";
    const energy = o.energyRaw === null ? "" : o.energyRaw <= 2 ? " It gives them energy." : o.energyRaw >= 4 ? " It takes more energy than it gives." : " Its effect on their energy is fairly neutral.";
    const cong = c.keyed(`${o.orbit}.congruence`);
    const congText = cong === null ? "" : cong >= 0.75 ? " They describe living it in line with what genuinely matters to them." : cong <= 0.25 ? " They describe living it less in line with what genuinely matters to them." : "";
    const relationship = `${o.importanceOrdinal ? `They rate it "${answerLabel(`${o.orbit}.importance`, String(o.importanceOrdinal - 1))}".` : ""}${energy}${feel}${congText}`.trim() || "Not enough information to describe their relationship with this area.";
    const sel = o.selections;
    const conn = [
      sel.largestDemand && "they named it as taking the most of their time, attention or emotional energy",
      sel.largestSource && "they named it as their greatest source of energy",
      sel.leverage && "they see it as a possible leverage point for the rest of their life",
      sel.crowdedOut && "they report it receiving less care because other demands take space",
      sel.priorityGap && "they notice it gets less time and energy than they would like",
      sel.externalInfluence && "they see it as most shaped by others' expectations",
    ].filter(Boolean) as string[];
    const connection = conn.length ? `${sentence(list(conn))}.` : "No direct interconnection answers point to this area.";
    let deeper = ORBIT_DEEPER_QUESTION[o.orbit];
    if (o.orbit === "growth" && c.endorsed("growth.06")) deeper = "What would need to be true for them to start on what they already know would help them grow?";
    if (o.orbit === "restoration" && c.endorsed("restoration.02")) deeper = "What happens inside them when they consider protecting rest during a busy week?";
    let social = "";
    if (o.orbit === "social" && o.subthemes) {
      const cr = o.subthemes.career, cm = o.subthemes.community;
      const d = (x: number | null) => (x === null ? "not enough information" : x >= 0.7 ? "well supported" : x <= 0.35 ? "less supported" : "mixed");
      social = ` Community and career read differently: community looks ${d(cm)}, career looks ${d(cr)}.`;
    }
    const text = `${working.startsWith("No ") ? "" : `What seems to be working: ${working.charAt(0).toLowerCase()}${working.slice(1)} `}${difficult.startsWith("No ") ? "" : `What may be difficult: ${difficult.charAt(0).toLowerCase()}${difficult.slice(1)}`}${social}${naNote}`.trim() || `${o.name}: answers sit in the middle range.${naNote}`;
    return {
      id: `orbit.${o.orbit}`, section: "orbits" as const, title: o.name, text, claim: "observation" as Claim,
      confidence: o.supportConfidence === "sufficient" ? ("moderate" as Confidence) : ("tentative" as Confidence), orbits: [o.orbit],
      evidence: [...hi.slice(0, 3), ...lo.slice(0, 3)].map(c.ev), counterEvidence: [], alternatives: [],
      questions: [deeper], validatable: true, working, difficult: difficult + social + naNote, relationship, deeperQuestion: deeper, connection,
    };
  });
}

// ── E. Patterns ─────────────────────────────────────────────────────────────
function patternsSection(c: Ctx): Insight[] {
  const cands: Insight[] = [];
  const add = (p: Omit<Insight, "section" | "claim" | "validatable" | "confidence"> & { confidence?: Confidence }) => {
    if (p.evidence.length < 2) return;
    cands.push({ section: "patterns", claim: "pattern", validatable: true, confidence: p.confidence ?? confidenceFrom(p.evidence.length, p.counterEvidence.length), ...p });
  };
  // Knowing versus doing
  {
    const know = ["body.04", "mind.04", "sun.01"].filter(c.high);
    const doLow = ["body.02", "body.03", "restoration.03", "growth.04", "sun.08"].filter(c.low);
    const g6 = c.endorsed("growth.06") ? ["growth.06"] : [];
    if ((know.length && doLow.length) || g6.length)
      add({ id: "pattern.knowing_doing", title: "Knowing versus doing", orbits: ["growth", "body"],
        text: `Their answers suggest they often understand what would help${know.length ? ` (${list(know.map(c.capOf))})` : ""}, while ${c.lows([...g6, ...doLow])}. The question may be less about clarity than about translating it into everyday choices.`,
        evidence: [...know, ...g6, ...doLow].map(c.ev), counterEvidence: ["growth.04", "sun.08"].filter(c.high).map(c.ev),
        alternatives: ["Time, energy or practical constraints may explain the gap more than motivation."],
        questions: ["Can they think of something they know would help that they haven't started? What happens when they think about starting?"] });
  }
  // Ambition versus restoration
  {
    const drive = (["growth", "social"] as OrbitId[]).filter((o) => c.imp(o) >= 0.75 || c.ic.largestDemand === o);
    const rest = ["restoration.02", "restoration.03", "restoration.06", "restoration.01"].filter(c.low);
    if (drive.length && (rest.length || c.drains("restoration")))
      add({ id: "pattern.ambition_restoration", title: "Ambition versus restoration", orbits: [...drive, "restoration"],
        text: `${list(drive.map((o) => ORBIT_NAMES[o]))} ${drive.length > 1 ? "appear" : "appears"} to receive substantial attention, while recovery receives less${rest.length ? `: ${c.lows(rest)}` : ""}.`,
        evidence: [...drive.map((o) => c.ev(`${o}.importance`)), ...rest.map(c.ev), ...(c.drains("restoration") ? [c.ev("restoration.energy")] : [])], counterEvidence: ["restoration.04"].filter(c.high).map(c.ev),
        alternatives: ["This may be a chosen, temporary season of intensity."],
        questions: ["What would they lose, and what would they gain, if recovery came first for a month?"] });
  }
  // Autonomy versus expectations
  {
    const ext = c.ic.externalInfluence;
    const approval = ["social.03", "joy.05", "mind.03", "sun.01"].filter(c.low);
    if (ext || approval.length >= 2)
      add({ id: "pattern.autonomy_expectations", title: "Autonomy versus expectations", orbits: ext ? [ext] : ["social"],
        text: `Some choices may be shaped by approval, social standards or obligation rather than personal preference${ext ? `, particularly around ${ORBIT_NAMES[ext]}` : ""}${approval.length ? `. ${sentence(c.lows(approval))}` : ""}.`,
        evidence: [...(ext ? [c.ev("interconnections.06")] : []), ...approval.map(c.ev)], counterEvidence: ["social.03", "joy.05"].filter(c.high).map(c.ev),
        alternatives: ["Shared expectations can be welcome; following them can itself be a chosen value."],
        questions: ["If no one else's opinion mattered for a year, what would they change first?"] });
  }
  // Care versus criticism
  {
    const care = ["sun.07", "sun.08", "body.03", "growth.04"].filter(c.high);
    const crit = ["sun.03", "restoration.06", "body.06", "restoration.05", "joy.02"].filter(c.low);
    if (care.length && crit.length)
      add({ id: "pattern.care_criticism", title: "Care versus criticism", orbits: ["restoration", "body"],
        text: `They show responsibility and discipline (${list(care.map(c.capOf))}), while ${c.lows(crit)}. There may be a tension between high standards and kindness towards themselves.`,
        evidence: [...care, ...crit].map(c.ev), counterEvidence: [], alternatives: ["Their current load may leave little room for gentleness, whatever their intentions."],
        questions: ["How do they speak to themselves when they rest, or when something goes wrong?"] });
  }
  // Connection versus self-protection
  {
    const want = (["love", "social"] as OrbitId[]).filter((o) => c.imp(o) >= 0.75 || c.emotions(o).some((e) => ["Longing", "Loneliness"].includes(e)));
    const guard = ["love.06", "love.02", "love.01", "social.02"].filter(c.low);
    const guardedFeel = c.emotions("love").includes("Guardedness") ? ["love.emotion"] : [];
    if (want.length && (guard.length || guardedFeel.length))
      add({ id: "pattern.connection_protection", title: "Connection versus self-protection", orbits: want,
        text: `A wish for closeness${want.length ? ` (${list(want.map((o) => ORBIT_NAMES[o]))})` : ""} may coexist with some self-protection: ${guard.length ? c.lows(guard) : ""}${guard.length && guardedFeel.length ? ", and " : ""}${guardedFeel.length ? "they chose Guardedness to describe Love" : ""}.`,
        evidence: [...want.map((o) => c.ev(`${o}.importance`)), ...guard.map(c.ev), ...guardedFeel.map(c.ev)], counterEvidence: [],
        alternatives: ["Limited opportunity for closeness right now may explain these answers better than guardedness."],
        questions: ["What makes it feel safe for them to let someone see more of them?"] });
  }
  // Stability versus change
  {
    const hold = ["resources.05", "growth.03"].filter(c.endorsed);
    const aspire = [...(c.imp("growth") >= 0.75 ? ["growth.importance"] : []), ...["growth.05", "resources.06"].filter(c.low)];
    if (hold.length && aspire.length)
      add({ id: "pattern.stability_change", title: "Stability versus change", orbits: ["resources", "growth"],
        text: `Familiar circumstances may provide security while also pulling against aspirations. They describe ${list(hold.map((i) => PHRASES[i].friction ?? c.capOf(i)))}${aspire.includes("growth.importance") ? ", while Growth matters a great deal to them" : ""}${aspire.filter((i) => i !== "growth.importance").length ? `; ${c.lows(aspire.filter((i) => i !== "growth.importance"))}` : ""}.`,
        evidence: [...hold, ...aspire].map(c.ev), counterEvidence: [], alternatives: ["Staying put may be a wise, deliberate choice in their current situation."],
        questions: ["What does their current stability make possible — and what does it cost?"] });
  }
  // Achievement versus enjoyment
  {
    const ach = (["growth", "social"] as OrbitId[]).filter((o) => c.imp(o) >= 0.75 || c.ic.largestDemand === o);
    const joyLow = [...["joy.01", "joy.02", "joy.04"].filter(c.low), ...(c.ic.crowdedOut === "joy" ? ["interconnections.04"] : [])];
    if (ach.length && joyLow.length)
      add({ id: "pattern.achievement_enjoyment", title: "Achievement versus enjoyment", orbits: [...ach, "joy"],
        text: `They invest heavily in ${list(ach.map((o) => ORBIT_NAMES[o]))}, while there seems to be less room for pleasure and play${joyLow.filter((i) => i !== "interconnections.04").length ? `: ${c.lows(joyLow.filter((i) => i !== "interconnections.04"))}` : ""}${joyLow.includes("interconnections.04") ? ". They also report Joy receiving less care because of other demands" : ""}.`,
        evidence: [...ach.map((o) => c.ev(`${o}.importance`)), ...joyLow.map(c.ev)], counterEvidence: [],
        alternatives: ["They may find enjoyment within their work or growth rather than separately."],
        questions: ["When did they last do something purely for enjoyment, with nothing to show for it?"] });
  }
  return cands.sort((a, b) => b.evidence.length - a.evidence.length).slice(0, 5);
}

// ── F. Strengths, G. Friction ───────────────────────────────────────────────
const INTERNAL = [
  ["sun.01", "self-awareness"], ["sun.04", "self-trust"], ["mind.04", "self-regulation"], ["growth.02", "openness to change"], ["growth.01", "curiosity"],
  ["mind.02", "perspective on their own thoughts"], ["sun.07", "responsibility without shame"], ["sun.11", "a sense of meaning"],
] as const;
const EXTERNAL = [
  ["social.01", "supportive close relationships"], ["social.02", "people who understand them"], ["social.06", "community belonging"],
  ["resources.03", "supportive home and surroundings"], ["resources.06", "financial and practical room to grow"], ["body.03", "a movement routine"], ["restoration.04", "restorative rituals"],
] as const;

function strengthsSection(c: Ctx) {
  const mk = (pairs: readonly (readonly [string, string])[], kind: "internal" | "external"): Insight[] =>
    pairs.filter(([id]) => c.high(id)).map(([id, label]) => ({
      id: `strength.${kind}.${id}`, section: "strengths", title: sentence(label), text: `They describe ${c.capOf(id)}.`, claim: "observation", confidence: "moderate",
      orbits: [], evidence: [c.ev(id)], counterEvidence: [], alternatives: [], questions: [`How could ${label} support what they want to change?`], validatable: false,
    }));
  const internal = mk(INTERNAL, "internal");
  if (c.ic.largestSource) internal.unshift({ id: "strength.source", section: "strengths", title: `${ORBIT_NAMES[c.ic.largestSource]} as an energy source`, text: `They named ${ORBIT_NAMES[c.ic.largestSource]} as giving them the most energy or making them feel most alive.`, claim: "observation", confidence: "higher", orbits: [c.ic.largestSource], evidence: [c.ev("interconnections.02")], counterEvidence: [], alternatives: [], questions: ["What is it about this area that restores them?"], validatable: false });
  return { internal, external: mk(EXTERNAL, "external") };
}

const FRICTION_KINDS: { key: string; title: string; ids: string[]; note: string; question: string; extra?: (c: Ctx) => Ev[] }[] = [
  { key: "clarity", title: "Lack of clarity", ids: ["sun.01", "sun.11"], note: "This may be a question of clarity: knowing what they want or what gives life meaning.", question: "If they could describe the life they want in one sentence, what would it be?" },
  { key: "priorities", title: "Conflicting priorities", ids: [], note: "Areas of life seem to compete for time and energy.", question: "If they had to choose, which commitment would they protect first?", extra: (c) => [...(c.ic.crowdedOut ? [c.ev("interconnections.04")] : []), ...(c.ic.priorityGap ? [c.ev("interconnections.05")] : []), ...(c.ic.overallSupport?.value.endsWith("compete") ? [c.ev("interconnections.07")] : [])] },
  { key: "practical", title: "Practical limitations", ids: ["resources.06", "resources.03", "body.01"], note: "Practical conditions may be part of the picture; this may call for a practical change or additional resources rather than a mindset shift.", question: "Which practical constraint, if lifted, would change the most?" },
  { key: "habits", title: "Habits and routines", ids: ["body.02", "body.03", "restoration.03", "joy.01"], note: "Everyday routines may not yet support what they want.", question: "Which small routine would make the biggest difference if it became easy?" },
  { key: "agency", title: "Perceived agency", ids: ["resources.04", "sun.04"], note: "They may feel limited influence over some conditions of their life.", question: "Where do they feel they have more influence than they currently use?" },
  { key: "fear", title: "Fear or uncertainty", ids: ["growth.03", "growth.06", "resources.05"], note: "Fear or uncertainty is reflected directly in some answers.", question: "What feels most at risk if they try and it doesn't work?" },
  { key: "recovery", title: "Insufficient recovery", ids: ["restoration.01", "restoration.02", "restoration.03"], note: "Recovery may be insufficient for the load they carry; rest may matter before any other change.", question: "How much recovery would their current life actually need?" },
  { key: "relationships", title: "Relationship dynamics", ids: ["social.01", "social.07"], note: "Some relationships or environments may be draining.", question: "Which relationship or environment costs them most energy right now?" },
];

function frictionSection(c: Ctx): Insight[] {
  return FRICTION_KINDS.map((k) => {
    const lowIds = k.ids.filter((i) => c.low(i) || (questionById(i)?.reverseKeyed && c.endorsed(i)));
    const extra = k.extra?.(c) ?? [];
    const evidence = [...lowIds.map(c.ev), ...extra];
    return { id: `friction.${k.key}`, section: "friction" as const, title: k.title, claim: "hypothesis" as Claim,
      text: `${k.note}${lowIds.length ? ` ${sentence(c.lows(lowIds))}.` : ""}`,
      confidence: confidenceFrom(evidence.length, 0), orbits: [], evidence, counterEvidence: [], alternatives: ["Difficulty here may reflect circumstances rather than mindset."],
      questions: [k.question], validatable: true };
  }).filter((i) => i.evidence.length >= 1).sort((a, b) => b.evidence.length - a.evidence.length).slice(0, 3);
}

// ── H. Direction ────────────────────────────────────────────────────────────
function directionSection(c: Ctx, patterns: Insight[]) {
  const ev = ["sun.11", "growth.05", "growth.02"].filter(c.answered).map(c.ev);
  const meaning = c.high("sun.11") ? "They report a sense of what gives their life meaning." : c.low("sun.11") ? "A sense of what gives their life meaning seems less clear at present." : "Their sense of meaning sits in the middle range.";
  const becoming = c.high("growth.05") ? " They feel they are growing into the person they want to become." : c.low("growth.05") ? " Growing into the person they want to become feels less true for them right now." : " They feel partly on their way to becoming who they want to be.";
  const evolve = c.high("growth.02") ? " They seem to allow themselves to change." : c.low("growth.02") ? " Letting go of an old identity or direction seems harder." : "";
  const gap = c.ic.priorityGap ? ` They notice ${ORBIT_NAMES[c.ic.priorityGap]} getting less of their time than they'd like.` : "";
  const summary = `${meaning}${becoming}${evolve}${gap} This describes reported alignment only; it doesn't tell us whether they are on "their path" — that is theirs to define.`;
  const focus = c.ic.leverageSelection ? ORBIT_NAMES[c.ic.leverageSelection] : c.ic.priorityGap ? ORBIT_NAMES[c.ic.priorityGap] : null;
  const nextChapter = focus
    ? `Tentatively: they may be ready to explore ${focus}${patterns[0] ? `, perhaps through the lens of ${patterns[0].title.toLowerCase()}` : ""}. This is an invitation to explore, not a prediction.`
    : patterns[0] ? `Tentatively: ${patterns[0].title.toLowerCase()} may be the theme they're most ready to explore. This is an invitation, not a prediction.` : "Their answers don't point to one obvious next chapter; that question is best asked in conversation.";
  return { summary, nextChapter, evidence: [...ev, ...(c.ic.priorityGap ? [c.ev("interconnections.05")] : []), ...(c.ic.leverageSelection ? [c.ev("interconnections.03")] : [])] };
}

// ── Readiness & opportunity ─────────────────────────────────────────────────
function readinessSection(c: Ctx, answers: Answers, intake: { question: string; answer: string }[]) {
  const lvl = (ids: string[]): ReadinessLevel => {
    const a = ids.filter(c.answered); if (!a.length) return "not yet established";
    const hi = a.filter(c.high).length;
    return hi >= 2 ? "established" : hi === 1 ? "partly established" : "not yet established";
  };
  const reflections = ["postmap.01", "postmap.02", "postmap.03", "postmap.04", "postmap.05"].filter((id) => typeof answers[id] === "string" && (answers[id] as string).trim());
  const selfRef = lvl(["mind.01", "mind.06", "sun.02"]);
  const dims = [
    { key: "reflection", label: "Self-reflection", level: reflections.length && selfRef === "not yet established" ? ("partly established" as ReadinessLevel) : selfRef,
      note: reflections.length ? `They chose to write ${reflections.length} optional reflection${reflections.length > 1 ? "s" : ""} after seeing their Map.` : "Based on their answers about inner attention and honesty with themselves.",
      evidence: [...["mind.01", "mind.06", "sun.02"].filter(c.answered).map(c.ev), ...reflections.map((id) => ({ questionId: id, answer: "(written)" }))] },
    { key: "agency", label: "Ownership and agency", level: lvl(["sun.04", "resources.04", "sun.07"]), note: "Based on self-trust, practical choice and responsibility.", evidence: ["sun.04", "resources.04", "sun.07"].filter(c.answered).map(c.ev) },
    { key: "motivation", label: "Motivation", level: (c.ic.leverageSelection || c.ic.priorityGap || intake.length ? "partly established" : "not yet established") as ReadinessLevel,
      note: "The Self-Interview can show where they see room for change; what they genuinely want to work on needs a conversation.", evidence: [...(c.ic.leverageSelection ? [c.ev("interconnections.03")] : []), ...(c.ic.priorityGap ? [c.ev("interconnections.05")] : []), ...intake.map((x, i) => ({ questionId: `booking.intake.${i}`, answer: x.answer }))] },
    { key: "openness", label: "Openness", level: lvl(["growth.02", "mind.02", "mind.03"]), note: "Based on openness to change and perspective on their own thinking.", evidence: ["growth.02", "mind.02", "mind.03"].filter(c.answered).map(c.ev) },
    { key: "capacity", label: "Capacity for action", level: (c.drains("restoration") || c.ic.overallSupport?.value === "strongly_compete" || (c.support("restoration") ?? 1) <= 0.3 ? "not yet established" : lvl(["sun.08", "restoration.03"])) as ReadinessLevel,
      note: c.drains("restoration") || (c.support("restoration") ?? 1) <= 0.3 ? "Their capacity may be stretched right now; space for reflection and follow-through needs checking in conversation." : "Based on follow-through and recovery.", evidence: ["sun.08", "restoration.03", "restoration.energy"].filter(c.answered).map(c.ev) },
  ];
  const established = dims.filter((d) => d.level === "established").length;
  const motivated = dims[2].level !== "not yet established";
  const conclusion: ReadinessConclusion = motivated && established >= 2 && dims[4].level !== "not yet established" ? "Explore 1:1 coaching fit" : "Clarify goals and readiness during the Deep Dive";
  const conclusionReason = conclusion === "Explore 1:1 coaching fit"
    ? "Several readiness signals are present and they point to areas where they see room for change. Fit still needs to be confirmed in conversation."
    : "Some readiness signals are present, but their goals, expectations or current capacity aren't yet clear from the Self-Interview alone.";
  return { dimensions: dims, conclusion, conclusionReason };
}

function opportunitySection(c: Ctx, patterns: Insight[], friction: Insight[], intake: { question: string; answer: string }[], readiness: CoachIntelligence["readiness"]) {
  const goals = [
    ...(c.ic.leverageSelection ? [`Understand how improving ${ORBIT_NAMES[c.ic.leverageSelection]} could influence the rest of their life (their own choice of leverage point)`] : []),
    ...(c.ic.priorityGap ? [`Give ${ORBIT_NAMES[c.ic.priorityGap]} the time and energy they say it deserves`] : []),
    ...intake.map((x) => `In their words: "${x.answer}"`),
  ];
  const themes = patterns.slice(0, 3).map((p) => p.title);
  const methodology = [
    "SEE: deepen what the Map surfaced, with their corrections",
    ...(patterns.length ? ["DESIGN: translate the confirmed patterns into chosen priorities"] : []),
    ...(friction.some((f) => ["habits", "recovery", "practical"].includes(f.id.split(".")[1])) ? ["BUILD: small, sustainable changes in routines and practical conditions"] : []),
    "BECOME: review alignment over time with a later Life Map",
  ];
  const outcomes = [
    ...(themes.length ? [`Greater clarity on ${themes[0].toLowerCase()} and what they want to do about it`] : []),
    ...(c.ic.leverageSelection ? [`A first set of changes in ${ORBIT_NAMES[c.ic.leverageSelection]}, chosen by them`] : []),
    "A clearer sense of what matters to them and how their choices reflect it",
  ];
  const clarify = ["What they want to work on, in their own words", "What they've already tried", "What support they're looking for, and what success would look like", "Their practical capacity for regular sessions right now"];
  const cautions = [
    ...(friction.some((f) => f.id === "friction.practical") ? ["Practical constraints may matter more than coaching right now; a practical change or other resources may help first."] : []),
    ...(readiness.dimensions[4].level === "not yet established" ? ["Their capacity may be stretched; coaching should not add pressure."] : []),
    "If anything in the conversation points to needs beyond coaching, a different form of support or an appropriately qualified professional may serve them better.",
  ];
  const goalPhrase = c.ic.leverageSelection ? ORBIT_NAMES[c.ic.leverageSelection] : c.ic.priorityGap ? ORBIT_NAMES[c.ic.priorityGap] : themes[0]?.toLowerCase();
  const invitation = goalPhrase
    ? `You mentioned wanting to look more closely at ${goalPhrase}. If it would be useful, Life Architecture Coaching is a structured way to work on exactly that over a series of sessions, at your pace. There's no pressure at all — it's completely fine to take what you found today and leave it there.`
    : "If any of what we looked at today feels worth working on, Life Architecture Coaching is a structured way to do that over a series of sessions. There's no pressure — it's completely fine to take what you found today and leave it there.";
  return { goals, themes, methodology, outcomes, clarify, cautions, invitation };
}

// ── A. Overview ─────────────────────────────────────────────────────────────
function overviewSection(c: Ctx, result: LifeMapResult, patterns: Insight[], values: Insight[]) {
  const s: string[] = [];
  const top = result.orbits.filter((o) => (o.importanceDirect ?? 0) >= 0.75).map((o) => o.name);
  if (top.length) s.push(`What matters most to them right now: ${list(top)}.`);
  if (c.ic.largestDemand) s.push(`${ORBIT_NAMES[c.ic.largestDemand]} currently takes most of their time, attention or emotional energy${c.ic.largestSource === c.ic.largestDemand ? ", and it is also what gives them the most energy — it may ask a lot while giving something back" : ""}.`);
  if (c.ic.largestSource && c.ic.largestSource !== c.ic.largestDemand) s.push(`${ORBIT_NAMES[c.ic.largestSource]} is where they find the most energy.`);
  const supported = result.orbits.filter((o) => o.supportConfidence === "sufficient" && (o.responseSupportIndex ?? 0) >= 0.7).map((o) => o.name);
  if (supported.length) s.push(`They appear most grounded in ${list(supported)}.`);
  const tension = values[0] ?? patterns[0];
  if (tension) s.push(`One place where aspiration and everyday reality may pull in different directions: ${tension.title.toLowerCase()}.`);
  if (c.ic.crowdedOut) s.push(`They report ${ORBIT_NAMES[c.ic.crowdedOut]} receiving less care because other demands take space.`);
  const self = ["sun.04", "sun.03", "sun.01"].filter(c.answered);
  const selfHi = self.filter(c.high), selfLo = self.filter(c.low);
  if (selfHi.length || selfLo.length) s.push(`In their relationship with themselves, ${selfHi.length ? `they describe ${list(selfHi.map(c.capOf))}` : ""}${selfHi.length && selfLo.length ? ", while " : ""}${selfLo.length ? c.lows(selfLo) : ""}.`);
  const centralQ = patterns[0]?.questions[0] ?? values[0]?.questions[0] ?? "What do they most want to understand about their life right now?";
  s.push(`The central question worth exploring: ${centralQ}`);
  const theme = patterns[0];
  return {
    portrait: s.join(" "),
    centralTheme: theme ? `${theme.title}. ${theme.text}` : "The assessment presents several distinct themes rather than one central pattern; the conversation will show which matters most to them.",
    centralThemeInsightId: theme?.id ?? null,
  };
}

/** Script questions for the Deep Dive come from here too, so the session tests exactly these interpretations. */
export function generateCoachIntelligence(result: LifeMapResult, answers: Answers, intake: { question: string; answer: string }[] = []): CoachIntelligence {
  const c = ctx(result, answers);
  const self = selfSection(c);
  const values = valuesSection(c, result);
  const orbits = orbitSection(c, result);
  const patterns = patternsSection(c);
  const strengths = strengthsSection(c);
  const friction = frictionSection(c);
  const direction = directionSection(c, patterns);
  const readiness = readinessSection(c, answers, intake);
  const opportunity = opportunitySection(c, patterns, friction, intake, readiness);
  const overview = overviewSection(c, result, patterns, values.alignment);
  const all = [...self.dimensions, ...values.alignment, ...orbits, ...patterns, ...strengths.internal, ...strengths.external, ...friction];
  return {
    templateVersion: INTELLIGENCE_TEMPLATE_VERSION, versions: result.versions,
    overview, self, values, orbits, patterns, strengths, friction, direction, readiness, opportunity,
    validatable: all.filter((i) => i.validatable).map((i) => ({ id: i.id, section: i.section, title: i.title })),
  };
}
