/** Respondent-facing insight cards (Decision Guide §4–§6, F6). */
import { describe, it, expect } from "vitest";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { computeLifeMap } from "@/engine/compute";
import { generateResultInsights } from "@/engine/insights";
import { fullAnswers } from "./e2e/helpers";

const uniform = () => {
  const a: Record<string, string | string[]> = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "truth") a[q.id] = "2";
    else if (q.responseType === "importance") a[q.id] = "2";
    else if (q.responseType === "energy") a[q.id] = "0";
    else if (q.responseType === "emotional_state") a[q.id] = [q.options[0].value];
  }
  return a;
};
const run = (a: Record<string, string | string[]>) => generateResultInsights(computeLifeMap(a), a);

describe("result insights", () => {
  it("always five cards, in the approved order", () => {
    expect(run(fullAnswers()).cards.map((c) => c.key)).toEqual(["overview", "support", "tension", "energy", "begin"]);
  });
  it("F6: similar support → described as similar, no winner named", () => {
    const i = run({ ...uniform(), "interconnections.07": "mix" });
    expect(JSON.stringify(i.cards[0])).toMatch(/similar level of support/);
    expect(JSON.stringify(i)).not.toMatch(/strongest|weakest|more supported in your responses/);
  });
  it("uses fallbacks instead of filler when evidence is thin", () => {
    const i = run(uniform());
    expect(i.cards.find((c) => c.key === "tension")!.fallback).toBe(true);
    expect(i.cards.find((c) => c.key === "begin")!.sections[0].text).toMatch(/don't establish one obvious starting point/);
    expect(i.questionToTakeWithYou.theme).toBe("neutral");
  });
  it("same Orbit as demand and source uses the approved edge-case copy", () => {
    const a = { ...uniform(), "interconnections.01": "growth", "interconnections.02": "growth" };
    expect(JSON.stringify(run(a).cards[3])).toMatch(/both a major demand and a source of energy/);
  });
  it("low importance + low support is framed as a possible conscious allocation, never a deficit", () => {
    const a = uniform();
    for (const q of ACTIVE_QUESTIONS) if (q.chapterId === "joy" && q.responseType === "truth") a[q.id] = q.reverseKeyed ? "4" : "0";
    Object.assign(a, { "joy.importance": "0", "body.importance": "4" });
    const t = JSON.stringify(run(a).cards[0]);
    expect(t).toMatch(/conscious allocation/);
  });
  it("every non-fallback section carries evidence (or is the question to take with you)", () => {
    for (const c of run(fullAnswers()).cards) if (!c.fallback)
      for (const s of c.sections) if (s.id !== "begin.question") expect(s.evidence.length, s.id).toBeGreaterThan(0);
  });
  it("no diagnostic or absolute language", () => {
    expect(JSON.stringify(run(fullAnswers()))).not.toMatch(/\b(diagnos|disorder|burnout|depress|trauma|self-sabotag|always|never)\b/i);
  });
  it("question to take with you follows the highest-evidence theme", () => {
    expect(run({ ...uniform(), "interconnections.03": "body" }).questionToTakeWithYou.text).toMatch(/If Body improved/);
  });
});
