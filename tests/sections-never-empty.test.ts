/**
 * Regression (Jana, 28 Oct): respondents received an empty "The Sun" section. Rule: no insight section is ever shown
 * without text, and the backup text for a section never repeats a sentence the page already says.
 * Covers 3,000+ varied answer sets: random, skewed, all-low, all-high and all-middle.
 */
import { describe, it, expect } from "vitest";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { computeLifeMap } from "@/engine/compute";
import { generateResultInsights } from "@/engine/insights";
import { generateInterpretation } from "@/engine/interpret";

function rnd(seed: number) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }
function answers(kind: "random" | "skewed" | "low" | "high" | "mid", seed: number) {
  const r = rnd(seed); const a: Record<string, string | string[]> = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "text") continue;
    const n = q.options.length; const top = q.responseType === "energy" ? 0 : n - 1, bottom = n - 1 - top;
    const i = kind === "random" ? Math.floor(r() * n) : kind === "low" ? bottom : kind === "high" ? top : kind === "mid" ? Math.floor(n / 2)
      : Math.min(n - 1, Math.max(0, Math.round((r() < 0.5 ? 0.25 : 0.75) * (n - 1) + (r() - 0.5))));
    a[q.id] = q.responseType === "emotional_state" ? [q.options[i].value] : q.options[i].value;
  }
  return a;
}
const CASES: [Parameters<typeof answers>[0], number][] = [["low", 1], ["high", 1], ["mid", 1],
  ...Array.from({ length: 1500 }, (_, k) => ["random", k + 1] as [Parameters<typeof answers>[0], number]),
  ...Array.from({ length: 1500 }, (_, k) => ["skewed", k + 1] as [Parameters<typeof answers>[0], number])];
const split = (t: string) => t.split(/(?<=[.?!])\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

describe("results never show an empty insight section", () => {
  it("every section has text; backup text never repeats the page", () => {
    for (const [kind, seed] of CASES) {
      const a = answers(kind, seed); const result = computeLifeMap(a as never);
      const ins = generateResultInsights(result, a as never);
      const at = `${kind} #${seed}`;
      expect(ins.opening.title, `opening title (${at})`).toBeTruthy();
      expect(ins.mapReading.paragraphs.length, `Map interpretation (${at})`).toBeGreaterThan(0);
      expect(ins.standsOut.paragraphs.length + result.snapshot.filter((s) => s.available).length, `What Stands Out (${at})`).toBeGreaterThan(0);
      expect(ins.self.paragraphs.length, `The Sun (${at})`).toBeGreaterThan(0);
      expect(ins.self.question, `The Sun question (${at})`).toBeTruthy();
      expect(ins.connections.paragraphs.length, `Life Interconnections (${at})`).toBeGreaterThan(0);
      expect(ins.cards).toHaveLength(5);
      for (const c of ins.cards) {
        expect(c.sections.length && c.lead && c.question && c.why, `card "${c.title}" (${at})`).toBeTruthy();
        for (const x of c.sections) expect(x.text, `card "${c.title}" text (${at})`).toBeTruthy();
      }
      expect(ins.orbits).toHaveLength(8);
      for (const o of ins.orbits) expect(o.paragraphs.length && o.question, `${o.name} (${at})`).toBeTruthy();
      expect(ins.closingQuestion.text, `closing question (${at})`).toBeTruthy();

      // Where a backup filled The Sun, none of its sentences may already appear elsewhere on the page
      if (!generateInterpretation(result, a as never).self.paragraphs.length) {
        const rest = new Set([...ins.opening.paragraphs.map((p) => p.text), ...ins.connections.paragraphs.map((p) => p.text), ...ins.standsOut.paragraphs.map((p) => p.text),
          ...ins.cards.flatMap((c) => [c.lead, ...c.sections.flatMap((x) => [x.text, x.meaning ?? ""])]), ...ins.orbits.flatMap((o) => o.paragraphs)].flatMap(split));
        for (const s of ins.self.paragraphs.flatMap((p) => split(p.text))) expect(rest.has(s), `The Sun repeats "${s}" (${at})`).toBe(false);
      }
    }
  }, 600000);
});
