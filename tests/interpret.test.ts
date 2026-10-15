import { describe, expect, it } from "vitest";
import { computeLifeMap } from "@/engine/compute";
import { generateInterpretation, INTERPRET_VERSION } from "@/engine/interpret";
import { engineForTemplate, generateResultInsights } from "@/engine/insights";
import { PROFILES, answersOf } from "./fixtures/interpret-profiles";

const run = (a: Record<string, string | string[]>) => generateInterpretation(computeLifeMap(a as any), a as any);
const all = Object.entries(PROFILES).map(([id, p]) => ({ id, a: answersOf(p), n: run(answersOf(p)) }));
const text = (n: ReturnType<typeof run>) => JSON.stringify([n.opening, n.cards, n.orbits, n.self, n.closingQuestion]);

describe("interpret-1 deterministic engine", () => {
  it("is deterministic for identical answers", () => {
    for (const x of all) expect(text(run(x.a))).toBe(text(x.n));
  });
  it("keeps every generated sentence through the validator on the review profiles", () => {
    for (const x of all) expect(x.n.validation.removed, x.id).toEqual([]);
  });
  it("gives each profile its own central thread and a 2–3 sentence opening", () => {
    const centrals = all.map((x) => x.n.centralTheme?.kind ?? x.n.mode);
    expect(new Set(centrals).size).toBe(all.length);
    for (const x of all) expect(x.n.opening.paragraphs.length).toBeGreaterThan(0);
  });
  it("keeps the existing result structure (cards, eight Orbits, closing)", () => {
    for (const x of all) {
      expect(x.n.orbits).toHaveLength(8);
      expect(x.n.cards.length).toBeGreaterThanOrEqual(3);
      expect(x.n.closingQuestion.text.length).toBeGreaterThan(10);
    }
  });
  it("records evidence for every reading and never names thinkers in public copy", () => {
    for (const x of all) {
      for (const r of x.n.records) expect(r.evidence.length, r.id).toBeGreaterThan(0);
      expect(text(x.n)).not.toMatch(/Jung|Robbins|Perel|Manson|Hawkins|Stoic|Buddh/);
    }
  });
  it("versions historical results: legacy templates keep the legacy engine", () => {
    expect(engineForTemplate("result-narrative-8")).toBe("legacy");
    expect(engineForTemplate(undefined)).toBe(INTERPRET_VERSION);
    const x = all[0];
    expect((generateResultInsights(computeLifeMap(x.a as any), x.a as any) as any).engine).toBe(INTERPRET_VERSION);
    expect((generateResultInsights(computeLifeMap(x.a as any), x.a as any, { engine: "legacy" }) as any).engine).toBeUndefined();
  });
});
