/**
 * Interpretation engine "interpret-1" (approved 15 Oct 2026, free public launch, fully deterministic).
 *
 * Evidence → conditional relationships (with modifiers and contradictions) → distinction modules → prioritization →
 * composition → validation → interpretation records. Produces the same ResultNarrative shape the results page, the PDF
 * and the coach workspace already read, plus versioned interpretation records an AI layer could later consume.
 */
import type { LifeMapResult } from "@/engine/compute";
import { DEEP_DIVE_BRIDGE, MAP_INTRO_CONVERSATIONAL } from "@/engine/narrative/compose";
import type { Answers } from "@/engine/narrative/context";
import type { Observation, ResultNarrative } from "@/engine/narrative/types";
import { composeAll, makeValidator, phraseWarnings, prioritize } from "./compose";
import { buildEvidence } from "./evidence";
import { candidateReadings, LIBRARY_VERSION } from "./relationships";
import { RECORD_SCHEMA_VERSION, type InterpretationRecord, type Reading, type ValidationLog } from "./types";

export const INTERPRET_VERSION = "interpret-1";

export type Interpretation = ResultNarrative & {
  engine: typeof INTERPRET_VERSION;
  versions: ResultNarrative["versions"] & { library: string; recordSchema: string };
  mode: "thread" | "portrait" | "harmony";
  records: InterpretationRecord[];
  validation: ValidationLog;
};

const toObservation = (r: Reading, usedIn: string[]): Observation & { usedIn: any[] } => ({
  id: r.id, rule: r.relationship, family: r.relationship, areas: r.areas, evidence: r.evidence, counterEvidence: r.contradictions,
  sufficiency: r.sufficiency === "single" ? "single" : r.sufficiency, wording: "suggest", valence: r.kind, alternatives: [r.alternative], meaning: r.meaning,
  relevance: Math.round(r.score * 1000) / 1000, destinations: [], text: r.observation, clause: r.lead.replace(/\.$/, ""), question: r.question.text, usedIn,
});

export function generateInterpretation(result: LifeMapResult, answers: Answers): Interpretation {
  const e = buildEvidence(result, answers);
  const readings = candidateReadings(e);
  const plan = prioritize(readings);
  const { log, clean } = makeValidator();
  const s = composeAll(e, plan, clean);

  const homeOf = (r: Reading): InterpretationRecord["section"] => {
    if (plan.central === r) return "central";
    const h = (Object.entries(plan.byHome) as [string, Reading][]).find(([, x]) => x === r)?.[0];
    return (h as InterpretationRecord["section"]) ?? (plan.connections.includes(r) ? "connections" : "orbit");
  };
  const records: InterpretationRecord[] = readings.map((r) => ({
    schema: RECORD_SCHEMA_VERSION, id: r.id, observation: r.observation, evidence: r.evidence, areas: r.areas,
    reasoning: `${r.relationship}${r.modifiers.length ? `; shaped by ${r.modifiers.join(", ")}` : ""}${r.module ? `; distinction: ${r.module}` : ""}`,
    distinctive: r.distinctive, meaning: r.meaning, alternatives: [r.alternative], contradictions: r.contradictions, sufficiency: r.sufficiency,
    lens: r.lens ?? null, question: r.question, section: homeOf(r), audience: plan.used.includes(r) ? "public" : "coach", module: r.module ?? null,
  }));
  const publicTexts = [
    ...s.opening.map((p) => p.text), ...s.mapReading.paragraphs.map((p) => p.text), ...s.standsOut.paragraphs.map((p) => p.text),
    ...s.self.paragraphs.map((p) => p.text), ...s.connections.paragraphs.map((p) => p.text),
    ...s.cards.flatMap((k) => [k.lead, ...k.sections.flatMap((x) => [x.text, x.meaning ?? ""]), k.major?.alternative ?? "", k.why, k.question]),
    ...s.orbits.flatMap((o) => o.paragraphs), s.closing,
  ];
  log.warnings.push(...phraseWarnings(publicTexts));

  return {
    engine: INTERPRET_VERSION,
    templateVersion: INTERPRET_VERSION,
    versions: { scoring: result.versions.scoring, questionBank: result.versions.questionBank, library: LIBRARY_VERSION, recordSchema: RECORD_SCHEMA_VERSION },
    mode: plan.mode,
    opening: { key: "opening", title: "Your reality, as it is right now", paragraphs: s.opening, fallback: !plan.central, major: s.cards[0].major ?? null },
    centralTheme: plan.central ? { kind: plan.central.relationship, anchor: plan.central.areas[0] ?? null, observationIds: [plan.central.id], responses: plan.central.evidence, shared: plan.central.evidence.slice(0, 6).map(e.c.plain) } : null,
    mapIntro: MAP_INTRO_CONVERSATIONAL,
    mapReading: s.mapReading, standsOut: s.standsOut, self: s.self, connections: s.connections, cards: s.cards, orbits: s.orbits,
    closingQuestion: { text: s.closing, theme: plan.central?.relationship ?? "portrait", observationId: plan.central?.id ?? null, evidence: plan.central?.evidence ?? [] },
    deepDiveBridge: DEEP_DIVE_BRIDGE,
    observations: readings.map((r) => toObservation(r, plan.used.includes(r) ? [homeOf(r)] : [])),
    questionToTakeWithYou: { text: s.closing, theme: plan.central?.relationship ?? "portrait" },
    records, validation: log,
  };
}
