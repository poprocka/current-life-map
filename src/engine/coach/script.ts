/**
 * Personalised 60-minute Life Map Deep Dive script (addendum §7).
 * Built only from this assessment's answers, the frozen result and (optionally) booking intake answers.
 * Facilitation prompts in the opening and closing blocks are generic by design; every personalised prompt
 * quotes the respondent's answer and lists the question IDs it rests on.
 */
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { type Answers, type CoachItem, answerLabel, direct, promptOf } from "./shared";
import { generateCoachReport } from "./report";

export const SCRIPT_TEMPLATE_VERSION = "deep-dive-script-1";

export interface ScriptBlock {
  key: "welcome" | "sun" | "orbits" | "energy" | "hypotheses" | "close";
  title: string;
  startMin: number;
  endMin: number;
  purpose: string;
  prompts: CoachItem[];
}
export interface DeepDiveScript {
  templateVersion: string;
  versions: LifeMapResult["versions"];
  focusOrbits: string[];
  blocks: ScriptBlock[];
  gaps: CoachItem[];
}

export interface IntakeAnswer { question: string; answer: string }

const g = (id: string, text: string): CoachItem => ({ id, text, evidence: [], basis: "direct" });
/** Quote that closes a sentence without doubling punctuation: “…life.” rather than “…life.”. */
const endq = (s: string) => (/[.?!…]$/.test(s.trim()) ? `“${s.trim()}”` : `“${s.trim()}”.`);

/** Choose 2–3 Orbits with the most evidence: attention candidates first (by number of reasons), sufficient coverage only. */
export function focusOrbits(result: LifeMapResult): OrbitResult[] {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o])) as Record<string, OrbitResult>;
  const ok = (o: OrbitResult) => o.supportConfidence !== "insufficient";
  const picked: OrbitResult[] = [];
  for (const c of result.attention.candidates) if (ok(by[c.orbit]) && picked.length < 3) picked.push(by[c.orbit]);
  if (picked.length < 2) {
    const rest = result.orbits.filter((o) => ok(o) && !picked.includes(o)).sort((a, b) => (b.importanceDirect ?? -1) - (a.importanceDirect ?? -1));
    for (const o of rest) if (picked.length < 2) picked.push(o);
  }
  return picked;
}

export function generateDeepDiveScript(result: LifeMapResult, answers: Answers, intake: IntakeAnswer[] = []): DeepDiveScript {
  const report = generateCoachReport(result, answers);
  const ic = result.interconnections;
  const name = (id: string) => result.orbits.find((o) => o.orbit === id)?.name ?? id;

  // 0–5 Welcome
  const welcome: CoachItem[] = [
    g("welcome.frame", "Welcome. Explain that the Map reflects what they described, and that today is for checking what feels accurate."),
    g("welcome.hope", "Ask what they hope to understand by the end of the hour."),
  ];
  if (typeof answers["interconnections.reflection"] === "string" && answers["interconnections.reflection"].trim())
    welcome.push({ id: "welcome.reflection", basis: "direct", evidence: [{ questionId: "interconnections.reflection", answer: "(free text)", kind: "direct" }],
      text: "They answered the closing reflection (“What truth about your current life became harder to ignore…”). Invite them to say more about it, in their own words." });
  intake.forEach((x, i) => welcome.push({ id: `welcome.intake.${i}`, basis: "direct", evidence: [{ questionId: `booking.intake.${i}`, answer: x.answer, kind: "direct" }],
    text: `Booking form — “${x.question}” ${endq(x.answer)} Check whether this is still what matters most today.` }));

  // 5–15 Sun
  const sunAnswered = result.sun.items.filter((i) => i.keyed !== null);
  const low = [...sunAnswered].sort((a, b) => a.keyed! - b.keyed!).slice(0, 2).filter((i) => i.keyed! <= 0.5);
  const high = [...sunAnswered].sort((a, b) => b.keyed! - a.keyed!).slice(0, 1).filter((i) => i.keyed! >= 0.75);
  const sun: CoachItem[] = [
    ...low.map((i) => ({ id: `sun.low.${i.questionId}`, basis: "direct" as const, evidence: [direct(i.questionId, answers)],
      text: `They answered “${answerLabel(i.questionId, answers[i.questionId])}” to ${endq(promptOf(i.questionId))} Ask what this looks like in an ordinary week.` })),
    ...high.map((i) => ({ id: `sun.high.${i.questionId}`, basis: "direct" as const, evidence: [direct(i.questionId, answers)],
      text: `They answered “${answerLabel(i.questionId, answers[i.questionId])}” to ${endq(promptOf(i.questionId))} Ask what helps this stay true.` })),
  ];
  if (low.length && high.length)
    sun.push({ id: "sun.contrast", basis: "hypothesis", evidence: [...low, ...high].map((i) => direct(i.questionId, answers)),
      text: "Hold both together: where their relationship with themselves feels steady, and where it feels less so. Ask how they make sense of the difference.",
      uncertainty: "Contrast between answers; meaning to be given by the client." });
  if (!sun.length) sun.push(g("sun.open", "Their Sun answers sit in the middle range. Ask how they would describe their relationship with themselves at the moment."));

  // 15–30 Orbits
  const focus = focusOrbits(result);
  const orbitPrompts: CoachItem[] = [];
  for (const o of focus) {
    const ev = [direct(`${o.orbit}.importance`, answers), direct(`${o.orbit}.energy`, answers)];
    const feelings = o.emotions.length ? ` They chose: ${o.emotions.map((e) => e.label).join(", ")}.` : "";
    orbitPrompts.push({ id: `orbit.${o.orbit}.frame`, basis: "direct", evidence: o.emotions.length ? [...ev, direct(`${o.orbit}.emotion`, answers)] : ev,
      text: `${o.name} — importance “${answerLabel(`${o.orbit}.importance`, answers[`${o.orbit}.importance`])}”, energy “${answerLabel(`${o.orbit}.energy`, answers[`${o.orbit}.energy`])}”.${feelings} Ask what is happening in this area right now.` });
    const lowest = o.items.filter((i) => i.keyed !== null).sort((a, b) => a.keyed! - b.keyed!).slice(0, 2).filter((i) => i.keyed! <= 0.5);
    for (const i of lowest)
      orbitPrompts.push({ id: `orbit.${o.orbit}.${i.questionId}`, basis: "direct", evidence: [direct(i.questionId, answers)],
        text: `${endq(promptOf(i.questionId)).replace(/\.$/, "")} — they answered “${answerLabel(i.questionId, answers[i.questionId])}”. Ask for a recent example.` });
    const reasons = result.attention.candidates.find((c) => c.orbit === o.orbit)?.reasons ?? [];
    for (const r of reasons)
      orbitPrompts.push({ id: `orbit.${o.orbit}.reason.${r.templateId}`, basis: r.hypothesis ? "hypothesis" : "direct", evidence: r.evidence,
        text: `Map: ${r.body}`, uncertainty: r.hypothesis ? r.caveat ?? "Hypothesis to validate." : undefined });
  }
  if (!focus.length) orbitPrompts.push(g("orbit.open", "No Orbit has enough answers to focus on with confidence. Ask which area they most want to look at."));

  // 30–40 Energy & interconnections
  const energy: CoachItem[] = [];
  const pick = (qid: string, label: string, id: string | null) =>
    id && energy.push({ id: `energy.${qid}`, basis: "direct", evidence: [direct(qid, answers)], text: `${label}: ${name(id)}.` });
  pick("interconnections.01", "Takes the most time, attention or emotional energy", ic.largestDemand);
  pick("interconnections.02", "Gives the most energy", ic.largestSource);
  pick("interconnections.04", "Receives less care because of other demands", ic.crowdedOut);
  pick("interconnections.06", "Most shaped by others’ expectations", ic.externalInfluence);
  if (ic.overallSupport) energy.push({ id: "energy.overall", basis: "direct", evidence: [direct("interconnections.07", answers)], text: `How the areas relate: “${ic.overallSupport.label}”.` });
  if (ic.largestDemand && ic.crowdedOut && ic.largestDemand !== ic.crowdedOut)
    energy.push({ id: "energy.tradeoff", basis: "direct", evidence: [direct("interconnections.01", answers), direct("interconnections.04", answers)],
      text: `Ask how ${name(ic.largestDemand)} and ${name(ic.crowdedOut)} affect each other in practice.`, uncertainty: "Reported trade-off, not proven causation." });
  if (!energy.length) energy.push(g("energy.open", "Ask where their energy goes in a typical week, and what gives some back."));

  // 40–50 Hypotheses & agency
  const hyp: CoachItem[] = report.hypotheses.slice(0, 3).map((h) => ({ ...h, text: `${h.text} Ask: ${h.questionToValidate}` }));
  if (ic.leverageSelection) hyp.push({ id: "agency.leverage", basis: "direct", evidence: [direct("interconnections.03", answers)],
    text: `They see ${name(ic.leverageSelection)} as a possible leverage point. Ask what is within their influence there, and what small change they would notice first.` });
  if (ic.priorityGap) hyp.push({ id: "agency.gap", basis: "direct", evidence: [direct("interconnections.05", answers)],
    text: `They named a gap around ${name(ic.priorityGap)}. Ask what gets in the way, and what would need to be true for it to get more of their time.` });
  if (!hyp.length) hyp.push(g("hyp.open", "Ask which part of the Map surprised them, and which felt most accurate."));

  // 50–60 Close
  const close = [
    g("close.summary", "Summarise what they confirmed and what they corrected in the Map. Note corrections in Session Notes."),
    g("close.steps", "Invite one or two next steps they choose themselves. Record only what was agreed."),
    g("close.ongoing", "If they raise it, discuss whether ongoing coaching would help. Do not assume it."),
  ];

  const gaps = report.sections.find((s) => s.key === "coverage")!.items;
  const perOrbit = focus.length ? Math.floor(15 / focus.length) : 15;
  return {
    templateVersion: SCRIPT_TEMPLATE_VERSION,
    versions: result.versions,
    focusOrbits: focus.map((o) => o.orbit),
    blocks: [
      { key: "welcome", title: "Welcome and goals", startMin: 0, endMin: 5, purpose: "Clarify what they hope to understand.", prompts: welcome },
      { key: "sun", title: "The Sun — relationship with self", startMin: 5, endMin: 15, purpose: "Self-relationship and important contradictions.", prompts: sun },
      { key: "orbits", title: `Focus Orbits${focus.length ? ` — ${focus.map((o) => o.name).join(", ")}` : ""}`, startMin: 15, endMin: 30,
        purpose: `Context and lived reality${focus.length ? ` (about ${perOrbit} minutes each)` : ""}.`, prompts: orbitPrompts },
      { key: "energy", title: "Energy architecture and interconnections", startMin: 30, endMin: 40, purpose: "Reported trade-offs and how areas affect each other.", prompts: energy },
      { key: "hypotheses", title: "Hypotheses and agency", startMin: 40, endMin: 50, purpose: "Validate interpretations; where attention may matter.", prompts: hyp },
      { key: "close", title: "Summary and next steps", startMin: 50, endMin: 60, purpose: "Corrections, one or two chosen next steps.", prompts: close },
    ],
    gaps,
  };
}
