/** Coach Report + Deep Dive script: evidence provenance, no fabricated content, deterministic. */
import { describe, it, expect } from "vitest";
import { computeLifeMap } from "@/engine/compute";
import { generateCoachReport } from "@/engine/coach/report";
import { generateDeepDiveScript } from "@/engine/coach/script";
import { questionById } from "@/content/v10/question-bank";
import { fullAnswers } from "./e2e/helpers";

const answers = fullAnswers();
const scored = Object.fromEntries(Object.entries(answers).filter(([k]) => k !== "interconnections.reflection"));
const result = computeLifeMap(scored);

describe("coach material", () => {
  it("every evidence reference points to a real question, a derived Orbit value, or booking intake", () => {
    const script = generateDeepDiveScript(result, answers, [{ question: "Q", answer: "A" }]);
    const report = generateCoachReport(result, answers);
    const items = [...report.sections.flatMap((s) => s.items), ...report.hypotheses, ...script.blocks.flatMap((b) => b.prompts)];
    for (const i of items) for (const e of i.evidence)
      expect(questionById(e.questionId) || /^[a-z]+\.\*$/.test(e.questionId) || e.questionId.startsWith("booking.intake.")).toBeTruthy();
  });
  it("interpretations are marked as hypotheses with uncertainty", () => {
    const report = generateCoachReport(result, answers);
    for (const h of report.hypotheses) { expect(h.basis).toBe("hypothesis"); expect(h.uncertainty).toBeTruthy(); expect(h.questionToValidate).toMatch(/\?$/); }
  });
  it("quotes exact question wording and answer labels", () => {
    const script = generateDeepDiveScript(result, answers);
    const quoted = script.blocks.flatMap((b) => b.prompts).filter((p) => p.evidence.length === 1 && questionById(p.evidence[0].questionId)?.responseType === "truth");
    expect(quoted.length).toBeGreaterThan(0);
    for (const p of quoted) expect(p.text).toContain(questionById(p.evidence[0].questionId)!.prompt);
  });
  it("uses no clinical or diagnostic language", () => {
    const text = JSON.stringify([generateCoachReport(result, answers), generateDeepDiveScript(result, answers)]);
    expect(text).not.toMatch(/\b(diagnos|disorder|depress|anxiety disorder|trauma|patholog|symptom)/i);
  });
  it("six blocks summing to 60 minutes; focus Orbits have evidence", () => {
    const s = generateDeepDiveScript(result, answers);
    expect(s.blocks.reduce((t, b) => t + b.endMin - b.startMin, 0)).toBe(60);
    expect(s.focusOrbits.length).toBeGreaterThanOrEqual(2);
    expect(s.focusOrbits.length).toBeLessThanOrEqual(3);
  });
  it("is deterministic", () => {
    expect(JSON.stringify(generateDeepDiveScript(result, answers))).toBe(JSON.stringify(generateDeepDiveScript(result, answers)));
  });
  it("different answers produce different scripts (no one-size-fits-all)", () => {
    const other = { ...scored, "interconnections.03": "joy", "interconnections.05": "mind", "interconnections.04": "body" };
    const a = generateDeepDiveScript(result, answers), b = generateDeepDiveScript(computeLifeMap(other), other);
    expect(JSON.stringify(a.blocks)).not.toBe(JSON.stringify(b.blocks));
  });
});
