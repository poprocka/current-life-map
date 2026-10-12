/**
 * Gender-inclusive requirement (Jana, 2026-10-12): neutral language everywhere, one measurement model for everyone,
 * identity never influences calculations or interpretation.
 */
import { describe, it, expect } from "vitest";
import { ACTIVE_QUESTIONS, QUESTION_BANK } from "@/content/v10/question-bank";
import { CHAPTERS } from "@/content/v10/chapters";
import { OPENING } from "@/content/v10/opening";
import * as SCALES from "@/content/v10/scales";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { computeLifeMap } from "@/engine/compute";
import { generateCoachReport } from "@/engine/coach/report";
import { generateDeepDiveScript } from "@/engine/coach/script";
import { reportModel } from "@/lib/pdf/model";
import { generateResultInsights } from "@/engine/insights";
import { NOT_APPLICABLE } from "@/content/types";
import fs from "fs";
import path from "path";

const GENDERED = /\b(she|her|hers|herself|he|him|his|himself|woman|women|man|men|female|male|feminine|masculine|wife|husband|girlfriend|boyfriend|mother|father|mom|dad|girl|boy|lady|ladies|gentleman|sister|brother|daughter|son|maternal|paternal|motherhood|fatherhood)\b/i;

/** Deterministic pseudo-random answer sets covering many life circumstances. */
function persona(seed: number, opts: { loveNA?: boolean } = {}) {
  let x = seed * 9301 + 49297;
  const rnd = (n: number) => { x = (x * 9301 + 49297) % 233280; return Math.floor((x / 233280) * n); };
  const a: Record<string, string | string[]> = {};
  const orbits = ["mind", "body", "restoration", "growth", "love", "social", "resources", "joy"];
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "truth") a[q.id] = q.allowNotApplicable && opts.loveNA ? NOT_APPLICABLE : String(rnd(5));
    else if (q.responseType === "importance") a[q.id] = String(rnd(5));
    else if (q.responseType === "energy") a[q.id] = String(rnd(5) - 2);
    else if (q.responseType === "emotional_state") a[q.id] = [q.options[rnd(12)].value, q.options[rnd(12)].value].filter((v, i, s) => s.indexOf(v) === i);
    else if (q.responseType === "orbit_select") a[q.id] = orbits[rnd(8)];
    else if (q.responseType === "single_choice") a[q.id] = q.options[rnd(q.options.length)].value;
  }
  return a;
}

describe("gender-inclusive language", () => {
  it("question bank, scales, chapter copy, opening and reflections contain no gendered terms", () => {
    const texts = [
      ...QUESTION_BANK.flatMap((q) => [q.prompt, q.instruction ?? "", q.cue?.text ?? "", ...q.options.map((o) => o.label)]),
      ...CHAPTERS.flatMap((c) => [c.name, c.subtitle, c.description, c.reflectionCue, ...c.explores]),
      ...Object.values(OPENING).flat(),
      ...Object.values(SCALES).flatMap((s) => (Array.isArray(s) ? s.map((o) => o.label) : [String(s)])),
      POST_MAP_REFLECTIONS.title, POST_MAP_REFLECTIONS.intro, ...POST_MAP_REFLECTIONS.questions.map((q) => q.prompt),
    ];
    for (const t of texts) expect(t, t).not.toMatch(GENDERED);
  });

  it("results page, privacy notice, PDF and admin UI source text contain no gendered terms", () => {
    const files = ["src/components/ResultsView.tsx", "src/components/PersonalMap.tsx", "src/components/NextSteps.tsx", "src/components/OptionalReflections.tsx",
      "src/app/privacy/page.tsx", "src/lib/pdf/model.ts", "src/lib/pdf/clientReport.ts", "src/engine/compute.ts", "src/engine/coach/report.ts", "src/engine/coach/script.ts", "src/server/email.ts"];
    for (const f of files) {
      // strings only: quoted text and JSX text between tags
      const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
      const strings = [...src.matchAll(/"([^"\n]{3,})"|`([^`]{3,})`|>([^<>{}\n]{3,})</g)].map((m) => m[1] ?? m[2] ?? m[3]);
      for (const s of strings) expect(s, `${f}: ${s}`).not.toMatch(GENDERED);
    }
  });

  it("every generated insight, snapshot, PDF line, Coach Report and script is neutral across 200 varied respondents", () => {
    for (let i = 0; i < 200; i++) {
      const a = persona(i, { loveNA: i % 3 === 0 });
      const r = computeLifeMap(a);
      const blob = JSON.stringify([r.snapshot, r.insights, r.attention, reportModel(r), generateCoachReport(r, a), generateDeepDiveScript(r, a), generateResultInsights(r, a)]);
      expect(blob).not.toMatch(GENDERED);
    }
  });
});

describe("one measurement model for everyone", () => {
  it("the engine and generators take only answers: no name, email, gender or identity input exists", () => {
    expect(computeLifeMap.length).toBeLessThanOrEqual(2); // (answers, config)
    expect(generateCoachReport.length).toBe(2); // (result, answers)
    expect(generateDeepDiveScript.length).toBeLessThanOrEqual(3); // (result, answers, booking intake in the person's own words)
  });

  it("identical answers produce identical calculations and interpretations", () => {
    for (let i = 0; i < 25; i++) {
      const a = persona(i), b = JSON.parse(JSON.stringify(a));
      expect(JSON.stringify(computeLifeMap(a))).toBe(JSON.stringify(computeLifeMap(b)));
      expect(JSON.stringify(generateCoachReport(computeLifeMap(a), a))).toBe(JSON.stringify(generateCoachReport(computeLifeMap(b), b)));
    }
  });

  it("not being in a relationship is never penalised: Love N/A changes coverage, not other Orbits or overall statements", () => {
    const partnered = persona(7), single = { ...persona(7) };
    for (const q of ACTIVE_QUESTIONS) if (q.allowNotApplicable) single[q.id] = NOT_APPLICABLE;
    const p = computeLifeMap(partnered), s = computeLifeMap(single);
    for (const o of p.orbits.filter((x) => x.orbit !== "love")) expect(s.orbits.find((x) => x.orbit === o.orbit)).toEqual(o);
    expect(JSON.stringify(s.sun)).toBe(JSON.stringify(p.sun));
    const text = JSON.stringify([generateCoachReport(s, single), generateResultInsights(s, single)]);
    expect(text).not.toMatch(/\b(are|is|being) single\b|unpartnered|sexually inactive|(you|they) are alone/i);
  });

  it("the database has no gender, sex or pronoun fields", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/0001_initial.sql"), "utf8");
    expect(sql).not.toMatch(/\b(gender|sex|pronoun|title_prefix|salutation)\b/i);
  });
});
