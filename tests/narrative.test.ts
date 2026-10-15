import { CONGRUENCE_ITEMS } from "@/engine/congruence";
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
import { buildResultsPdf as buildClientPdf } from "@/server/pdf/render";
import { pdfText } from "./helpers/pdf-text";
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
    expect(n.observations.find((x) => x.rule === "emotion.mixed")!.text).toMatch(/present at once|cancels the other|mix is common/);
    expect(n.orbits.find((x) => x.orbit === "growth")!.paragraphs.join(" ")).toMatch(/a sense of hope and moments of overwhelm/);
  });
  it("7 · all Orbits well supported → no manufactured problem", () => {
    const n = run(EXAMPLE_WORKING);
    expect(n.observations.some((o) => o.rule === "pattern.well-supported")).toBe(true);
    expect(n.cards.find((c) => c.key === "tension")!.sections.every((s) => !/less supported|gap/.test(s.text))).toBe(true);
    expect(n.opening.paragraphs.map((p) => p.text).join(" ")).not.toMatch(/less supported|feels less true/);
  });
  it("8 · several areas with friction → one gentle synthesis, not a catalogue", () => {
    const n = run(EXAMPLE_STRAIN);
    // The central theme names the area most answers point to, rather than a generic "several areas" line
    expect(n.opening.paragraphs[0].text).toMatch(/Resources seems to sit at the centre of your life/);
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

describe("central theme and five-step insights (approved 13 Oct)", () => {
  it.each([["ambition", EXAMPLE_AMBITION, "restoration"], ["working", EXAMPLE_WORKING, "growth"], ["strain", EXAMPLE_STRAIN, "resources"]] as const)("%s: a coherent central theme supported by 3+ responses", (_, a, anchor) => {
    const n = run(a);
    expect(n.centralTheme?.anchor).toBe(anchor);
    expect(n.centralTheme!.responses.length).toBeGreaterThanOrEqual(3);
    expect(n.opening.paragraphs[0].observationIds.length).toBeGreaterThanOrEqual(1); // the lead (supporting readings appear in the sections below)
  });
  it.each(FIXTURES)("%s: every major insight has all five steps", (_, a) => {
    const n = run(a);
    const majors = [n.opening.major, ...n.cards.map((c) => c.major)].filter(Boolean);
    expect(majors.length).toBeGreaterThanOrEqual(4);
    for (const m of majors) {
      expect(m!.shared.length, m!.observationId).toBeGreaterThan(0);
      expect(m!.pattern).toBeTruthy(); expect(m!.meaning, m!.observationId).toBeTruthy(); expect(m!.alternative, m!.observationId).toBeTruthy(); expect(m!.question).toMatch(/\?$/);
      for (const s of [m!.meaning, m!.alternative]) expect(s).not.toMatch(BANNED);
    }
  });
  it("every observation carries a 'what it might mean' line and at least one alternative", () => {
    for (const [, a] of FIXTURES) for (const o of run(a).observations) { expect(o.meaning, o.rule).toBeTruthy(); expect(o.alternatives.length, o.rule).toBeGreaterThan(0); }
  });
  it("new rules: one Orbit holding several roles; the lever already strong; feelings that don't match the statements", () => {
    expect(rules(EXAMPLE_STRAIN)).toContain("centre.roles");
    expect(rules(EXAMPLE_WORKING)).toContain("link.lever-strong");
    expect(rules(EXAMPLE_AMBITION)).toContain("contrast.feelings-statements"); // Joy: aliveness and delight, statements in the middle
    expect(rules(persona({ importance: { joy: 0 }, ic: { "04": "joy" } }))).toContain("alignment.crowded-unimportant");
  });
  it("'a demand you've chosen' never appears for a draining area described with strained feelings", () => {
    expect(all(EXAMPLE_STRAIN)).not.toMatch(/demand you've chosen/);
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
  it("distance is described only in the approved, non-judgmental words; never ranked or called a problem", () => {
    for (const [, a] of FIXTURES) {
      const t = all(a);
      expect(t).not.toMatch(/congruence|distant from (your|yourself)|disconnected from yourself|authentic self is|living (it )?(wrong|incorrectly)|out of alignment/i);
      expect(t).not.toMatch(/(further|far) from the Sun[^.]*\b(problem|issue|wrong)\b/i);
    }
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
  it.each(FIXTURES)("%s: opening is a short summary of the Map — 2–3 sentences (15 Oct), not numbers or a list", (_, a) => {
    const t = run(a).opening.paragraphs.map((p) => p.text).join(" ");
    const n = sentences(t).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
    expect(t.split(/\s+/).length).toBeLessThanOrEqual(80);
    expect(t).not.toMatch(/^\d|^(Mind|Body|Restoration|Growth|Love|Social World|Resources|Joy),/);
  });
  it.each([["ambition", EXAMPLE_AMBITION], ["working", EXAMPLE_WORKING], ["strain", EXAMPLE_STRAIN]] as const)("%s: the opening summarises the theme; its full reading opens the overview card (15 Oct)", (_, a) => {
    const n = run(a);
    const lead = n.observations.find((o) => o.id === n.opening.major!.observationId)!;
    const card = n.cards.find((c) => c.key === "overview")!.sections[0].text;
    expect(card.length).toBeGreaterThan(20);
    expect(lead.text.endsWith(card)).toBe(true); // a sentence already said in the opening isn't repeated
    expect(n.opening.paragraphs[0].text).toMatch(/On your Map, /);
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
  it("the PDF carries the same opening, closing question and reflection layer", async () => {
    const a = EXAMPLE_AMBITION; const result = computeLifeMap(a); const n = generateNarrative(result, a);
    const q = POST_MAP_REFLECTIONS.questions[1];
    const t = (await pdfText(await buildClientPdf(result, { insights: n, reflections: [{ prompt: q.prompt, text: "Looks right, isn't mine." }] }))).replace(/\s+/g, " ");
    expect(t).toContain("Your reality, as it is right now");
    expect(t).toContain(n.closingQuestion.text.slice(0, 40));
    expect(t).toContain("Looks right, isn't mine.");
    expect(t).toContain("Earlier, you named Social World");
  });
});

describe("distance from the Sun (F4, approved 13 Oct)", () => {
  const mapText = (a: Raw) => run(a).mapReading.paragraphs.map((p) => p.text).join(" ");
  const orbitText = (a: Raw, o: string) => run(a).orbits.find((x) => x.orbit === o)!.paragraphs.join(" ");
  it("uses the approved band statements and ties them to the person's answers", () => {
    const a: Raw = { ...EXAMPLE_WORKING, "joy.congruence": "4", "joy.05": "4", "joy.02": "4", "growth.congruence": "0", "growth.06": "4" };
    expect(mapText(a)).toMatch(/Joy sits? close to the Sun: th(is area of your life appears|ese areas of your life appear) to reflect what matters to you\./);
    expect(mapText(a)).toMatch(/Growth[^.]* further out: the way you're currently living in this area may not fully reflect what matters to you\./);
    expect(orbitText(a, "joy")).toContain("This area of your life appears to reflect what matters to you.");
    expect(run(a).mapReading.paragraphs.some((p) => p.evidence.some((e) => e.questionId === "growth.congruence"))).toBe(true);
  });
  it("leads with the Map's shape when one Orbit stands apart (15 Oct)", () => {
    const set = (o: string, v: string) => Object.fromEntries([`${o}.congruence`, ...CONGRUENCE_ITEMS[o as keyof typeof CONGRUENCE_ITEMS].map((it) => it.id)].map((id) => [id, v]));
    const orbits = Object.keys(CONGRUENCE_ITEMS);
    const a: Raw = { ...EXAMPLE_WORKING, ...Object.assign({}, ...orbits.map((o) => set(o, o === "resources" ? "0" : "4"))), "growth.06": "0" }; // growth.06 is reverse-keyed
    const t = mapText(a);
    expect(t).toContain("On your Map, Resources stands apart: it sits furthest from the Sun, while the other seven Orbits sit close together near it.");
    expect(t).toContain("Resources is where the way you're currently living may not fully reflect it.");
    const b: Raw = { ...EXAMPLE_WORKING, ...Object.assign({}, ...orbits.map((o) => set(o, "4"))), "growth.06": "0" };
    expect(mapText(b)).toContain("All of your Orbits sit close to the Sun");
  });
  it("the snapshot shows Furthest from the Sun when one Orbit stands further out (15 Oct)", () => {
    const set = (o: string, v: string) => Object.fromEntries([`${o}.congruence`, ...CONGRUENCE_ITEMS[o as keyof typeof CONGRUENCE_ITEMS].map((it) => it.id)].map((id) => [id, v]));
    const a: Raw = { ...EXAMPLE_WORKING, ...Object.assign({}, ...Object.keys(CONGRUENCE_ITEMS).map((o) => set(o, o === "resources" ? "0" : "4"))), "growth.06": "0" };
    const six = computeLifeMap(a).snapshot.at(-1)!;
    expect(six.label).toBe("Furthest from the Sun");
    expect(six.orbits).toEqual(["resources"]);
    expect(six.body).toBe("On your Map, Resources sits furthest from the Sun: the way you're currently living in this area may not fully reflect what matters to you.");
  });
  it("a large Orbit far from the Sun keeps both signals and isn't framed as a problem", () => {
    const a: Raw = { ...EXAMPLE_WORKING, "love.importance": "4", "love.congruence": "0", "love.01": "0", "love.05": "0", "love.02": "0" };
    const t = mapText(a);
    expect(t).toMatch(/Love is also one of your largest Orbits[^.]*\. That pairing can be worth noticing\. It may reflect a conscious trade-off, practical circumstances or a time of change\./);
    expect(t).not.toMatch(/problem|wrong|fix/i);
  });
  it("contradictory answers are named, not averaged away", () => {
    const a: Raw = { ...EXAMPLE_WORKING, "joy.congruence": "4", "joy.05": "0", "joy.02": "0" };
    expect(mapText(a)).toMatch(/In Joy, your answers point in different directions/);
    expect(orbitText(a, "joy")).toMatch(/point in a different direction/);
  });
  it("a skipped congruence statement gets the 'not enough information' line and the middle ring", () => {
    const a: Raw = { ...EXAMPLE_WORKING }; delete a["mind.congruence"];
    const r = computeLifeMap(a).orbits.find((o) => o.orbit === "mind")!;
    expect(r.distanceBand).toBeNull();
    expect(orbitText(a, "mind")).toContain("We don't have enough information to understand how closely this area reflects what matters to you.");
  });
});
