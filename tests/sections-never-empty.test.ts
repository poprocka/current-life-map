/** Regression (Jana, 28 Oct): respondents received an empty "The Sun" section. Every section with a heading must have text. */
import { describe, it, expect } from "vitest";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { computeLifeMap } from "@/engine/compute";
import { generateResultInsights } from "@/engine/insights";

function rnd(seed: number) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }
function randomAnswers(seed: number) {
  const r = rnd(seed); const a: Record<string, string | string[]> = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "text") continue;
    a[q.id] = q.responseType === "emotional_state" ? [q.options[Math.floor(r() * q.options.length)].value] : q.options[Math.floor(r() * q.options.length)].value;
  }
  return a;
}

describe("results never show an empty section", () => {
  it("The Sun and Life Interconnections always have text (500 varied answer sets)", () => {
    for (let k = 1; k <= 500; k++) {
      const a = randomAnswers(k);
      const ins = generateResultInsights(computeLifeMap(a as never), a as never);
      expect(ins.self.paragraphs.length, `The Sun empty for seed ${k}`).toBeGreaterThan(0);
      expect(ins.connections.paragraphs.length, `Life Interconnections empty for seed ${k}`).toBeGreaterThan(0);
      expect(ins.opening.paragraphs.length + ins.mapReading.paragraphs.length).toBeGreaterThan(0);
      for (const o of ins.orbits) expect(o.paragraphs.length, `${o.name} empty for seed ${k}`).toBeGreaterThan(0);
    }
  });
});
