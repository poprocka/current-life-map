/**
 * Results interpretation engine — QA scenarios (brief §10) and automated checks for unsupported claims,
 * missing data, repetition and personalisation (deliverable 9).
 */
import { describe, it, expect } from "vitest";
import { inflateSync } from "zlib";
import { computeLifeMap } from "@/engine/compute";
import { generateNarrative, generateReflectionLayer } from "@/engine/narrative";
import { BANNED, GENDERED, sentences, visibleTexts } from "@/engine/narrative/validate";
import { questionById } from "@/content/v10/question-bank";
import { buildClientPdf } from "@/lib/pdf/clientReport";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { EXAMPLE_AMBITION, EXAMPLE_STRAIN, EXAMPLE_WORKING, persona, type Raw } from "./fixtures/personas";
import { fullAnswers } from "./e2e/helpers";

const run = (a: Raw) => generateNarrative(computeLifeMap(a), a);
const all = (a: Raw) => visibleTexts(run(a)).map((t) => t.text).join(" ");
const rules = (a: Raw) => run(a).observations.map((o) => o.rule);
const FIXTURES: [string, Raw][] = [["ambition", EXAMPLE_AMBITION], ["working", EXAMPLE_WORKING], ["strain", EXAMPLE_STRAIN], ["full", fullAnswers()]];

describe("QA scenarios (brief §10)", () => {
  it("1 · high importance, low reported support", () => {
    const a = persona({ importance: { body: 4 }, orbitTruth: { body: 0 }, items: { "body.01": 0 } });
    const o = run(a).observations.find((x) => x.rule === "priority.gap")!;
    expect(o.areas).toEqual(["body"]);
    expect(o.evidence.map((e) => e.questionId)).toContain("body.importance");
    expect(o.evidence.length).toBeGreaterThanOrEqual(2);
  });
  it("2 · high ambition and high restoration → acknowledged as working together", () => {
    const a = persona({ importance: { growth: 4, social: 4 }, orbitTruth: { restoration: 4, growth: 3 } });
    const o = run(a).observations.find((x) => x.rule === "link.ambition-restoration")!;
    expect(o.valence).toBe("strength");
  });
  it("3 · high ambition and low restoration → a tension, with a non-presumptive question", () => {
    const n = run(EXAMPLE_AMBITION);
    const o = n.observations.find((x) => x.rule === "link.ambition-restoration")!;
    expect(o.valence).toBe("tension");
    expect(o.alternatives[0]).toMatch(/doesn't automatically mean you're doing too much/);
    expect(n.closingQuestion.text).toMatch(/same attention to your recovery/);
  });
  it("4 · low importance but high satisfaction → never told to prioritise it", () => {
    const a = persona({ importance: { joy: 0 }, orbitTruth: { joy: 4 } });
    const o = run(a).observations.find((x) => x.rule === "priority.quiet-supported")!;
    expect(o.text).toMatch(/don't rate Joy as a priority/);
    expect(all(a)).not.toMatch(/prioriti[sz]e (joy|it)|joy needs/i);
  });
  it("5 · the same Orbit as energy source and demand", () => {
    const a = persona({ ic: { "01": "growth", "02": "growth" } });
    expect(all(a)).toMatch(/It asks a lot, and it gives a lot/);
  });
  it("6 · mixed emotional states are not reduced to one category", () => {
    const a = persona({ feelings: { growth: ["Hope", "Overwhelm"] }, importance: { growth: 4 } });
    const n = run(a);
    expect(n.observations.find((x) => x.rule === "emotion.mixed")!.text).toMatch(/can coexist/);
    expect(n.orbits.find((x) => x.orbit === "growth")!.paragraphs.join(" ")).toMatch(/mixed: hope and overwhelm/);
  });
  it("7 · all Orbits well supported → no manufactured problem", () => {
    const n = run(EXAMPLE_WORKING);
    expect(n.observations.some((o) => o.rule === "pattern.well-supported")).toBe(true);
    expect(n.cards.find((c) => c.key === "tension")!.sections.every((s) => !/less supported|gap/.test(s.text))).toBe(true);
    expect(n.opening.paragraphs.map((p) => p.text).join(" ")).not.toMatch(/less supported|feels less true/);
  });
  it("8 · several areas with friction → one gentle synthesis, not a catalogue", () => {
    const n = run(EXAMPLE_STRAIN);
    expect(n.opening.paragraphs[0].text).toMatch(/several parts of life are asking for care/);
    expect(n.observations.filter((o) => o.rule === "priority.gap").length).toBeLessThanOrEqual(2);
    for (const c of n.cards) expect(c.sections.length).toBeLessThanOrEqual(3);
  });
  it("9 · contradictory answers are acknowledged, not resolved for the person", () => {
    const a = persona({ energy: { joy: -2 }, importance: { body: 0 }, ic: { "02": "joy", "05": "body" } });
    const t = all(a);
    expect(t).toMatch(/Both can be true at different moments/);
    expect(t).toMatch(/may matter in a way the importance question didn't capture/);
  });
  it("10 · both permitted Love 'not applicable' answers → excluded, no relationship status inferred", () => {
    const a = persona({ items: { "love.02": "na", "love.03": "na" } });
    const love = run(a).orbits.find((o) => o.orbit === "love")!.paragraphs.join(" ");
    expect(love).toMatch(/not applicable are left out/);
    expect(all(a)).not.toMatch(/\b(you're single|you are single|partnered|unpartnered|relationship status|not in a relationship|dating)\b/i);
  });
  it("11 · no optional reflections → no reflection layer, and the narrative is unaffected", () => {
    expect(generateReflectionLayer(computeLifeMap(EXAMPLE_AMBITION), {})).toBeNull();
    const withText = { ...EXAMPLE_AMBITION, "postmap.01": "Something I wrote." };
    expect(run(withText).opening).toEqual(run(EXAMPLE_AMBITION).opening);
  });
  it("12 · detailed reflections → a separate, labelled layer; Map and scores unchanged", () => {
    const r = { "postmap.02": "My work looks right but I'm performing it.", "postmap.04": "I know I need rest and I don't take it.", "postmap.05": "That I'm tired." };
    const result = computeLifeMap(EXAMPLE_AMBITION);
    const layer = generateReflectionLayer(result, r)!;
    expect(layer.note).toMatch(/original Map and interpretation above are unchanged/);
    expect(layer.items.map((i) => i.text)).toEqual(Object.values(r));
    expect(layer.items[0].alongside!.text).toMatch(/Social World as the area most influenced by other people's expectations/);
    expect(layer.items[2].alongside).toBeUndefined();
    expect(computeLifeMap({ ...EXAMPLE_AMBITION, ...r })).toEqual(result);
  });
  it("13 · identical answer sets → identical interpretation", () => {
    expect(run(structuredClone(EXAMPLE_STRAIN))).toEqual(run(EXAMPLE_STRAIN));
  });
  it("14 · substantially different answer sets → materially different interpretations", () => {
    const s = (a: Raw) => new Set(visibleTexts(run(a)).flatMap((t) => sentences(t.text)).filter((x) => x.split(" ").length >= 8));
    const pairs: [Raw, Raw][] = [[EXAMPLE_AMBITION, EXAMPLE_STRAIN], [EXAMPLE_AMBITION, EXAMPLE_WORKING], [EXAMPLE_WORKING, EXAMPLE_STRAIN]];
    for (const [x, y] of pairs) {
      const a = s(x), b = s(y);
      const shared = [...a].filter((t) => b.has(t)).length;
      expect(shared / Math.min(a.size, b.size)).toBeLessThan(0.3);
      expect(run(x).opening.paragraphs[0].text).not.toEqual(run(y).opening.paragraphs[0].text);
    }
  });
  it("15 · respondents of different genders with identical answers → identical interpretation, no gendered language", () => {
    for (const [, a] of FIXTURES) {
      const tagged = { ...a, "demographics.gender": "woman" } as Raw;
      const other = { ...a, "demographics.gender": "non-binary" } as Raw;
      expect(run(tagged)).toEqual(run(other));
      expect(run(tagged)).toEqual(run(a));
      expect(all(a)).not.toMatch(GENDERED);
    }
  });
});

describe("unsupported claims", () => {
  it.each(FIXTURES)("%s: every observation cites real, answered questions", (_, a) => {
    for (const o of run(a).observations) {
      expect(o.evidence.length, o.id).toBeGreaterThan(0);
      for (const e of o.evidence) { expect(questionById(e.questionId), e.questionId).toBeTruthy(); expect(e.answer).not.toBe("Not answered"); }
    }
  });
  it.each(FIXTURES)("%s: cross-Orbit links rest on two responses or an explicit Life Interconnections answer", (_, a) => {
    for (const o of run(a).observations.filter((x) => x.rule.startsWith("link.") && new Set(x.areas).size >= 2)) {
      const explicit = o.evidence.some((e) => e.questionId.startsWith("interconnections."));
      expect(explicit || new Set(o.evidence.map((e) => e.questionId)).size >= 2, o.id).toBe(true);
      if (o.link === "co-occurrence") expect(o.text).not.toMatch(/\b(causes?|leads? to|results? in)\b/i);
    }
  });
  it.each(FIXTURES)("%s: no diagnostic, absolute or labelling language", (_, a) => {
    const n = run(a);
    const texts = [...visibleTexts(n).map((t) => t.text), ...n.cards.map((c) => c.question), n.closingQuestion.text, n.self.question ?? ""];
    for (const t of texts) expect(t, t).not.toMatch(BANNED);
    expect(n.validationIssues).toEqual([]);
  });
  it("distance/congruence metrics are never interpreted (pending approval)", () => {
    for (const [, a] of FIXTURES) expect(all(a)).not.toMatch(/distance from the Sun|closer to the Sun|further from the Sun|congruence/i);
  });
  it("the engine is pure: generating the narrative never changes the computed Map", () => {
    const a = EXAMPLE_STRAIN; const r = computeLifeMap(a); const before = structuredClone(r);
    generateNarrative(r, a);
    expect(r).toEqual(before);
  });
});

describe("missing data", () => {
  it("partial answers → fallbacks instead of filler, no crash", () => {
    const a: Raw = Object.fromEntries(Object.entries(EXAMPLE_AMBITION).filter(([k]) => !k.startsWith("body.") && !k.startsWith("sun.") && !k.startsWith("interconnections.")));
    const n = run(a);
    expect(n.orbits.find((o) => o.orbit === "body")!.paragraphs.join(" ")).toMatch(/aren't enough answers/);
    expect(n.connections.fallback || n.connections.paragraphs.length > 0).toBe(true);
    expect(n.cards).toHaveLength(5);
  });
  it("an all-middle answer set uses fallbacks and a neutral closing question", () => {
    const a = persona({});
    for (const k of ["01", "02", "03", "04", "05", "06"]) delete a[`interconnections.${k}`];
    const n = run(a);
    expect(n.cards.find((c) => c.key === "tension")!.fallback).toBe(true);
    expect(n.closingQuestion.text.length).toBeGreaterThan(10);
  });
});

describe("repetition and structure", () => {
  it.each(FIXTURES)("%s: no sentence of six or more words appears twice outside the Orbit paragraphs", (_, a) => {
    const seen = new Map<string, string>();
    for (const { where, text } of visibleTexts(run(a)).filter((t) => !t.where.startsWith("orbit."))) {
      for (const s of sentences(text)) {
        const k = s.toLowerCase().replace(/[^a-z ]/g, "");
        if (k.split(" ").length < 6) continue;
        expect(seen.has(k), `"${s}" in ${where} repeats ${seen.get(k)}`).toBe(false);
        seen.set(k, where);
      }
    }
  });
  it.each(FIXTURES)("%s: each observation's text is used in one place only", (_, a) => {
    const n = run(a);
    const texts = visibleTexts(n).map((t) => t.text);
    for (const o of n.observations) expect(texts.filter((t) => t.includes(o.text)).length, o.id).toBeLessThanOrEqual(1);
  });
  it.each(FIXTURES)("%s: opening is a synthesis of about 100–150 words, not numbers or a list", (_, a) => {
    const t = run(a).opening.paragraphs.map((p) => p.text).join(" ");
    const w = t.split(/\s+/).length;
    expect(w).toBeGreaterThanOrEqual(70);
    expect(w).toBeLessThanOrEqual(170);
    expect(t).not.toMatch(/^\d|^(Mind|Body|Restoration|Growth|Love|Social World|Resources|Joy),/);
  });
  it.each(FIXTURES)("%s: five cards in order, each with ≤3 observations, a why and a distinct question", (_, a) => {
    const n = run(a);
    expect(n.cards.map((c) => c.key)).toEqual(["overview", "support", "tension", "energy", "begin"]);
    const qs = n.cards.map((c) => c.question);
    expect(new Set([...qs, n.closingQuestion.text]).size).toBe(qs.length + 1);
    for (const c of n.cards) { expect(c.sections.length).toBeGreaterThan(0); expect(c.sections.length).toBeLessThanOrEqual(3); expect(c.why).toBeTruthy(); }
  });
  it("eight Orbit paragraphs, each with a question", () => {
    const n = run(EXAMPLE_AMBITION);
    expect(n.orbits).toHaveLength(8);
    for (const o of n.orbits) { expect(o.paragraphs.length).toBeGreaterThan(0); expect(o.question).toMatch(/\?$/); }
  });
});

describe("PDF and results stay consistent", () => {
  function pdfText(bytes: Uint8Array) {
    const buf = Buffer.from(bytes), raw = buf.toString("latin1");
    let out = "";
    for (const m of raw.matchAll(/stream\r?\n/g)) {
      const start = m.index! + m[0].length, end = raw.indexOf("endstream", start);
      try { out += inflateSync(buf.subarray(start, end)).toString("latin1"); } catch { /* not a content stream */ }
    }
    return [...out.matchAll(/<([0-9A-Fa-f]+)> Tj/g)].map((x) => Buffer.from(x[1], "hex").toString("latin1")).join(" ");
  }
  it("the PDF carries the same opening, closing question and reflection layer", async () => {
    const a = EXAMPLE_AMBITION; const result = computeLifeMap(a); const n = generateNarrative(result, a);
    const q = POST_MAP_REFLECTIONS.questions[1];
    const t = pdfText(await buildClientPdf(result, { insights: n, reflections: [{ prompt: q.prompt, text: "Looks right, isn't mine." }] })).replace(/\s+/g, " ");
    expect(t).toContain("Your reality, as it is right now");
    expect(t).toContain(n.closingQuestion.text.slice(0, 40));
    expect(t).toContain("Looks right, isn't mine.");
    expect(t).toContain("Earlier, you named Social World");
  });
});
