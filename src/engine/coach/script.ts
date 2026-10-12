/**
 * Personalised 60-minute Life Map Deep Dive script (Coach Intelligence guidelines §6).
 * Built from the Coach Intelligence Report so the session tests exactly those interpretations:
 * every hypothesis or pattern brought into the session carries a question that could confirm, refine or challenge it.
 * Generic facilitation prompts appear only in the opening and closing; everything else links to answers.
 */
import type { LifeMapResult } from "@/engine/compute";
import { type Answers, type CoachItem } from "./shared";
import { generateCoachIntelligence, type Insight } from "./intelligence";

export const SCRIPT_TEMPLATE_VERSION = "deep-dive-script-2";

export interface ScriptBlock {
  key: "person" | "self" | "patterns" | "change" | "fit" | "close";
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
const fromInsight = (i: Insight, lead?: string): CoachItem => ({
  id: `q.${i.id}`, basis: i.claim === "observation" ? "direct" : "hypothesis",
  evidence: i.evidence.map((e) => ({ questionId: e.questionId, answer: e.answer, kind: "direct" as const })),
  text: `${lead ? `${lead} ` : ""}${i.questions[0]}${i.claim !== "observation" ? ` (Tests: ${i.title.toLowerCase()}.)` : ""}`,
  uncertainty: i.claim !== "observation" ? (i.alternatives[0] ?? "Hypothesis to check with them.") : undefined,
});

export function generateDeepDiveScript(result: LifeMapResult, answers: Answers, intake: IntakeAnswer[] = []): DeepDiveScript {
  const r = generateCoachIntelligence(result, answers, intake);

  const person: CoachItem[] = [
    g("person.why", "What made them want to take the self-interview now?"),
    g("person.resonated", "What resonated most when they saw their Map, and what surprised them?"),
    g("person.hope", "What do they hope to understand by the end of the hour?"),
  ];
  const post = ["postmap.01", "postmap.02", "postmap.03", "postmap.04", "postmap.05"].filter((id) => typeof answers[id] === "string" && (answers[id] as string).trim());
  if (post.length) person.push({ id: "person.postmap", basis: "direct", evidence: post.map((id) => ({ questionId: id, answer: "(free text)", kind: "direct" as const })),
    text: `They wrote ${post.length === 1 ? "an optional reflection" : `${post.length} optional reflections`} after seeing their Map (Coach Report). Invite them to say more, in their own words.` });
  intake.forEach((x, i) => person.push({ id: `person.intake.${i}`, basis: "direct", evidence: [{ questionId: `booking.intake.${i}`, answer: x.answer, kind: "direct" }],
    text: `Booking form — “${x.question}” “${x.answer}” Check whether this is still what matters most today.` }));

  const selfFocus = r.self.dimensions.filter((d) => /may need attention|mixed|inconsistency/.test(d.title)).slice(0, 2);
  const self: CoachItem[] = [g("self.key", r.self.keyQuestion), ...selfFocus.map((d) => fromInsight(d))];
  if (!selfFocus.length && r.self.dimensions[0]) self.push(fromInsight(r.self.dimensions[0], "Build on what's established:"));

  const pats = r.patterns.slice(0, 3);
  const patterns: CoachItem[] = pats.length
    ? pats.flatMap((p) => [fromInsight(p), g(`check.${p.id}`, `If it doesn't fit: “${p.alternatives[0] ?? "Is there another way of seeing this?"}” — ask which reading feels truer.`)])
    : [g("patterns.none", "No cross-Orbit pattern is strongly supported. Ask which part of the Map felt most true, and explore that.")];

  const change: CoachItem[] = [
    g("change.more_less", "What do they want more of, less of, or differently — in their own words?"),
    ...r.values.alignment.slice(0, 2).map((v) => fromInsight(v)),
    ...r.friction.slice(0, 2).map((f) => fromInsight(f)),
  ];

  const fit: CoachItem[] = [
    g("fit.tried", "What have they already tried, and what helped?"),
    g("fit.support", "What kind of support are they looking for?"),
    g("fit.success", "If coaching went really well, what would be different in six months?"),
    ...r.readiness.dimensions.filter((d) => d.level === "not yet established").map((d) => g(`fit.${d.key}`, `${d.label} isn't established from the self-interview. ${d.note}`)),
  ];

  const close: CoachItem[] = [
    g("close.summary", "Summarise their own insights in their words. Ask which of your interpretations resonated and which didn't — mark them in the workspace afterwards."),
    g("close.next", "Agree one or two next steps they choose. Record only what was agreed."),
    g("close.invite", r.readiness.conclusion === "Explore 1:1 coaching fit"
      ? `If it feels right: “${r.opportunity.invitation}”`
      : "Only if they raise it: explore whether ongoing coaching would help. No pressure, no urgency."),
  ];

  const focus = [...new Set(pats.flatMap((p) => p.orbits))];
  return {
    templateVersion: SCRIPT_TEMPLATE_VERSION,
    versions: result.versions,
    focusOrbits: focus,
    blocks: [
      { key: "person", title: "Understand the person", startMin: 0, endMin: 10, purpose: "Their reason for coming, what resonated, what surprised them.", prompts: person },
      { key: "self", title: "Relationship with Self", startMin: 10, endMin: 20, purpose: "The most relevant Sun findings: values, needs, self-trust, direction.", prompts: self },
      { key: "patterns", title: "The most meaningful patterns", startMin: 20, endMin: 35, purpose: "Two or three supported cross-Orbit patterns — not all eight Orbits.", prompts: patterns },
      { key: "change", title: "What they want to change", startMin: 35, endMin: 45, purpose: "More of, less of, differently; obstacles, resources and agency.", prompts: change },
      { key: "fit", title: "Coaching fit", startMin: 45, endMin: 55, purpose: "What they've tried, what support they want, what success looks like.", prompts: fit },
      { key: "close", title: "Reflection and next step", startMin: 55, endMin: 60, purpose: "Their insights, your check, a suitable next step.", prompts: close },
    ],
    gaps: result.orbits.filter((o) => o.supportConfidence !== "sufficient").map((o) => g(`gap.${o.orbit}`, `${o.name}: ${o.supportConfidence} evidence (${o.coverage.valid}/${o.coverage.eligible}).`)),
  };
}

/** Kept for older callers. */
export function focusOrbits(result: LifeMapResult) { return result.orbits.slice(0, 0); }
