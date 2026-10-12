/**
 * Client Understanding & Coaching Direction.
 * "The assessment gives you a starting picture; the conversation reveals the person."
 *
 * Built after the Deep Dive from the coach's marking of each interpretation (confirmed / clarified / challenged),
 * the session's agreed next steps and the Coach Intelligence Report. Challenged interpretations are kept visible
 * but never feed the coaching direction. Unmarked hypotheses stay as open questions — not as facts.
 */
import type { CoachIntelligence, Insight } from "./intelligence";

export const UNDERSTANDING_TEMPLATE_VERSION = "client-understanding-1";

export type ValidationStatus = "confirmed" | "clarified" | "challenged" | "not_discussed";
export interface Validation { insightId: string; title: string; status: ValidationStatus; note: string | null }
export interface UnderstandingItem { text: string; source: "confirmed" | "clarified" | "challenged" | "agreed" | "map" | "coach"; insightId?: string }
export interface UnderstandingSection { key: string; title: string; items: UnderstandingItem[] }
export interface UnderstandingDocument {
  templateVersion: string;
  generatedAt: string;
  principle: string;
  basedOn: { confirmed: number; clarified: number; challenged: number; notDiscussed: number; unmarked: number };
  sections: UnderstandingSection[];
}
export interface UnderstandingInputs {
  intelligence: CoachIntelligence;
  validations: Validation[];
  agreedNextSteps?: string[];
  coachingInquiry?: boolean;
  enrolled?: { since: string | null } | null;
  now?: Date;
}

const ORBIT_NAMES: Record<string, string> = { mind: "Mind", body: "Body", restoration: "Restoration", growth: "Growth", love: "Love", social: "Social World", resources: "Resources", joy: "Joy" };

export function generateUnderstandingDocument(inp: UnderstandingInputs): UnderstandingDocument {
  const intel = inp.intelligence;
  const all: Insight[] = [
    ...intel.self.dimensions, ...intel.values.alignment, ...intel.orbits, ...intel.patterns,
    ...intel.strengths.internal, ...intel.strengths.external, ...intel.friction,
  ];
  const byId = new Map(all.map((i) => [i.id, i]));
  const v = new Map(inp.validations.map((x) => [x.insightId, x]));
  const status = (id: string) => v.get(id)?.status;
  const note = (id: string) => v.get(id)?.note?.trim() || null;
  const with_ = (s: ValidationStatus) => inp.validations.filter((x) => x.status === s && byId.has(x.insightId));

  const confirmed = with_("confirmed"), clarified = with_("clarified"), challenged = with_("challenged");
  const keep = (i: Insight) => status(i.id) === "confirmed" || status(i.id) === "clarified";

  const sections: UnderstandingSection[] = [];

  // 1. Where they are now
  const keyThemes = [...confirmed, ...clarified].map((x) => byId.get(x.insightId)!).filter((i) => i.section === "patterns" || i.section === "values");
  sections.push({ key: "summary", title: "Where they are now", items: [{
    source: "coach",
    text: confirmed.length + clarified.length
      ? `In the Deep Dive, they confirmed ${confirmed.length} and clarified ${clarified.length} of the Map's interpretations${challenged.length ? `, and challenged ${challenged.length}` : ""}.${keyThemes.length ? ` The themes that held up in conversation: ${keyThemes.map((i) => i.title.toLowerCase()).join("; ")}.` : ""} Edit this summary in your own words.`
      : "No interpretations have been marked yet. Mark what they confirmed, clarified or challenged in the Coach Report, then regenerate.",
  }] });

  // 2. Confirmed
  sections.push({ key: "confirmed", title: "What the conversation confirmed", items: confirmed.map((x) => {
    const i = byId.get(x.insightId)!;
    return { source: "confirmed" as const, insightId: i.id, text: `${i.title}. ${i.text}${note(i.id) ? ` In conversation: ${note(i.id)}` : ""}` };
  }) });

  // 3. Clarified
  sections.push({ key: "clarified", title: "What they clarified", items: clarified.map((x) => {
    const i = byId.get(x.insightId)!;
    return { source: "clarified" as const, insightId: i.id, text: `${i.title}. ${note(i.id) ?? "Add what they clarified."} (The Map suggested: ${i.text})` };
  }) });

  // 4. Challenged — kept, never used for direction
  sections.push({ key: "challenged", title: "What didn't fit", items: challenged.map((x) => {
    const i = byId.get(x.insightId)!;
    return { source: "challenged" as const, insightId: i.id, text: `${i.title}. The Map suggested this; they didn't recognise it.${note(i.id) ? ` Their view: ${note(i.id)}` : ""}` };
  }) });

  // 5. Strengths to build on
  const strengths = [...intel.strengths.internal, ...intel.strengths.external];
  sections.push({ key: "strengths", title: "Strengths to build on", items: [
    ...strengths.filter((s) => status(s.id) !== "challenged").map((s) => ({ source: (keep(s) ? status(s.id) : "map") as UnderstandingItem["source"], insightId: s.id, text: `${s.title}${keep(s) ? "" : " (from the Map)"}` })),
    ...intel.self.dimensions.filter((d) => keep(d) && d.title.endsWith("appears established")).map((d) => ({ source: status(d.id) as UnderstandingItem["source"], insightId: d.id, text: d.title.split(":")[0] })),
  ] });

  // 6. What they want to work on
  sections.push({ key: "goals", title: "What they want to work on", items: [
    ...(inp.agreedNextSteps ?? []).map((t) => ({ source: "agreed" as const, text: t })),
    ...(inp.coachingInquiry ? [{ source: "agreed" as const, text: "They asked about ongoing coaching." }] : []),
    ...intel.opportunity.goals.map((g) => ({ source: "map" as const, text: `${g} (from the Map; confirm with them)` })),
  ] });

  // 7. Coaching direction — only from confirmed or clarified interpretations
  const direction = all.filter((i) => keep(i) && ["patterns", "values", "friction", "self"].includes(i.section) && !i.title.endsWith("appears established"));
  const orbits = [...new Set(direction.flatMap((i) => i.orbits))].map((o) => ORBIT_NAMES[o]).filter(Boolean);
  sections.push({ key: "direction", title: "Coaching direction", items: [
    ...direction.map((i) => ({ source: status(i.id) as UnderstandingItem["source"], insightId: i.id, text: `Theme: ${i.title}. Work on it through: ${i.questions[0]}` })),
    ...(orbits.length ? [{ source: "coach" as const, text: `Orbits most involved: ${orbits.join(", ")}.` }] : []),
    { source: "coach" as const, text: direction.length
      ? "Suggested path: SEE (deepen what was confirmed) → DESIGN (choose priorities around these themes) → BUILD (small, sustainable changes) → BECOME (review with a later Life Map)."
      : "No theme has been confirmed yet, so no coaching direction is proposed. Direction comes from the conversation, not from the Map alone." },
    { source: "coach" as const, text: inp.enrolled ? `Enrolled on 1:1 coaching${inp.enrolled.since ? ` since ${inp.enrolled.since}` : ""}.` : `Readiness (preliminary, from the Map): ${intel.readiness.conclusion}. ${intel.readiness.conclusionReason}` },
  ] });

  // 8. Still to explore
  const open = intel.validatable.map((x) => byId.get(x.id)).filter((i): i is Insight => !!i && i.claim !== "observation" && (!status(i.id) || status(i.id) === "not_discussed"));
  sections.push({ key: "open", title: "Still to explore", items: open.slice(0, 8).map((i) => ({ source: "map" as const, insightId: i.id, text: `${i.title}: ${i.questions[0]}` })) });

  const marked = new Set(inp.validations.map((x) => x.insightId));
  return {
    templateVersion: UNDERSTANDING_TEMPLATE_VERSION,
    generatedAt: (inp.now ?? new Date()).toISOString(),
    principle: "The assessment gave a starting picture; the conversation revealed the person.",
    basedOn: { confirmed: confirmed.length, clarified: clarified.length, challenged: challenged.length, notDiscussed: with_("not_discussed").length,
      unmarked: intel.validatable.filter((x) => !marked.has(x.id)).length },
    sections,
  };
}
