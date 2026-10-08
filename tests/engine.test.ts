import { describe, it, expect } from "vitest";
import { computeLifeMap, scoreTruth, type Answers } from "@/engine/compute";
import { V10_PROVISIONAL } from "@/engine/config/v10-provisional";
import { ACTIVE_QUESTIONS, QUESTION_BANK } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { progress, resumeStep, validate, isComplete } from "@/engine/navigation";

/** Fill every active question with a value, optionally per-id overrides. */
function fill(v: string, over: Answers = {}): Answers {
  const a: Answers = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "orbit_select") a[q.id] = "mind";
    else if (q.responseType === "single_choice") a[q.id] = "mix";
    else if (q.responseType === "energy") a[q.id] = "0";
    else a[q.id] = v;
  }
  return { ...a, ...over };
}

describe("scoring", () => {
  it("maps the truth scale to 0..1 and inverts reverse-keyed items", () => {
    expect(scoreTruth("mind.01", "4")).toBe(1);
    expect(scoreTruth("mind.01", "0")).toBe(0);
    expect(scoreTruth("mind.05", "4")).toBe(0); // reverse-keyed
    expect(scoreTruth("growth.06", "1")).toBe(0.75);
  });
  it("treats Not applicable as missing, not as zero", () => {
    expect(scoreTruth("love.01", NOT_APPLICABLE)).toBeNull();
  });
  it("is deterministic", () => {
    const a = fill("3", { "body.energy": "-2", "interconnections.03": "body" });
    expect(JSON.stringify(computeLifeMap(a))).toBe(JSON.stringify(computeLifeMap(a)));
  });
  it("uses spec weights for vitality and congruence", () => {
    expect(V10_PROVISIONAL.vitality).toEqual({ reality: 0.55, relationship: 0.45 });
    expect(V10_PROVISIONAL.congruence).toEqual({ agency: 0.45, relationship: 0.4, selfCongruence: 0.15 });
  });
  it("computes vitality as 55% reality + 45% relationship", () => {
    // Body: reality = body.01-03, relationship = body.04, body.06
    const a = fill("2", { "body.01": "4", "body.02": "4", "body.03": "4", "body.04": "0", "body.06": "0" });
    const body = computeLifeMap(a).orbits.find((o) => o.orbit === "body")!;
    expect(body.vitality).toBeCloseTo(0.55);
  });
});

describe("insufficient evidence", () => {
  it("does not fabricate Love metrics when most items are Not applicable", () => {
    const a = fill("3", { "love.01": NOT_APPLICABLE, "love.02": NOT_APPLICABLE, "love.03": NOT_APPLICABLE, "love.04": undefined });
    const love = computeLifeMap(a).orbits.find((o) => o.orbit === "love")!;
    expect(love.evidence).toBe("insufficient");
    expect(love.vitality).toBeNull();
    expect(love.congruence).toBeNull();
  });
});

describe("attention order", () => {
  it("ranks all eight Orbits uniquely", () => {
    const r = computeLifeMap(fill("2"));
    expect(new Set(r.attentionOrder).size).toBe(8);
  });
  it("raises an important, draining, low-vitality, chosen-leverage Orbit to the top", () => {
    const a = fill("3", {
      "restoration.importance": "4", "restoration.energy": "-2",
      "restoration.01": "0", "restoration.03": "0", "restoration.04": "0", "restoration.05": "0",
      "interconnections.03": "restoration",
    });
    expect(computeLifeMap(a).attentionOrder[0]).toBe("restoration");
  });
  it("gives every ranked Orbit at least one reported reason", () => {
    const r = computeLifeMap(fill("2"));
    for (const o of r.orbits) expect(o.reasons.some((x) => x.basis === "reported")).toBe(true);
  });
});

describe("snapshot", () => {
  it("separates reported from calculated items", () => {
    const a = fill("2", { "joy.energy": "2", "body.energy": "-2", "interconnections.01": "social" });
    const s = Object.fromEntries(computeLifeMap(a).snapshot.map((x) => [x.key, x]));
    expect(s.energyIn).toMatchObject({ orbit: "joy", basis: "reported" });
    expect(s.energyOut).toMatchObject({ orbit: "body", basis: "reported" });
    expect(s.largestPlace).toMatchObject({ orbit: "social", basis: "reported" });
    expect(s.mostSupported.basis).toBe("calculated");
  });
  it("reports none rather than inventing when no Orbit drains energy", () => {
    const s = computeLifeMap(fill("2")).snapshot.find((x) => x.key === "energyOut")!;
    expect(s.orbit).toBeNull();
  });
});

describe("navigation", () => {
  it("progress counts answers, not position", () => {
    expect(progress({})).toBe(0);
    expect(progress(fill("2"))).toBe(1);
  });
  it("resumes at the first unanswered question", () => {
    const a = fill("2");
    delete a["growth.04"];
    expect(ACTIVE_QUESTIONS[resumeStep(a)].id).toBe("growth.04");
    expect(isComplete(a)).toBe(false);
  });
  it("validates options and NA", () => {
    const love1 = QUESTION_BANK.find((q) => q.id === "love.01")!;
    const mind1 = QUESTION_BANK.find((q) => q.id === "mind.01")!;
    expect(validate(love1, NOT_APPLICABLE)).toBeNull();
    expect(validate(mind1, NOT_APPLICABLE)).not.toBeNull();
    expect(validate(mind1, undefined)).not.toBeNull();
    expect(validate(mind1, "7")).not.toBeNull();
  });
});
