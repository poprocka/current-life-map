/**
 * Spec §11 QA gates — math, data and insight tests for scoring version provisional-1.
 */
import { describe, it, expect } from "vitest";
import { computeLifeMap, scoreTruth, energyFields, confidenceOf, type Answers } from "@/engine/compute";
import { PROVISIONAL_1 } from "@/engine/config/scoring";
import { ACTIVE_QUESTIONS, QUESTION_BANK } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { progress, resumeStep, validate, isComplete } from "@/engine/navigation";

/** Fill every active question. Truth = v, importance = imp, energy = 0 (stable), selections = mind. */
function fill(v: string, over: Answers = {}, imp = "2"): Answers {
  const a: Answers = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "orbit_select") a[q.id] = "mind";
    else if (q.responseType === "single_choice") a[q.id] = "mix";
    else if (q.responseType === "energy") a[q.id] = "0";
    else if (q.responseType === "importance") a[q.id] = imp;
    else if (q.responseType === "emotional_state") a[q.id] = [q.options[0].value];
    else if (q.responseType === "text") continue;
    else a[q.id] = v;
  }
  return { ...a, ...over };
}
const orbit = (r: ReturnType<typeof computeLifeMap>, id: string) => r.orbits.find((o) => o.orbit === id)!;

describe("normalisation (spec §3)", () => {
  it("truth ordinals 1→0, 3→0.5, 5→1; reverse 1→1, 5→0", () => {
    // stored values are ordinal − 1
    expect(scoreTruth("mind.01", "0")).toBe(0);
    expect(scoreTruth("mind.01", "2")).toBe(0.5);
    expect(scoreTruth("mind.01", "4")).toBe(1);
    expect(scoreTruth("mind.05", "0")).toBe(1); // reverse-keyed
    expect(scoreTruth("mind.05", "4")).toBe(0);
  });
  it("energy ordinal 1→+1 signed, 3→0, 5→−1; support 1→1, 5→0", () => {
    expect(energyFields("2")).toEqual({ energyRaw: 1, energySigned: 1, energySupport: 1 });
    expect(energyFields("0")).toEqual({ energyRaw: 3, energySigned: 0, energySupport: 0.5 });
    expect(energyFields("-2")).toEqual({ energyRaw: 5, energySigned: -1, energySupport: 0 });
  });
});

describe("N/A and missing data (spec §5.7)", () => {
  it("N/A never becomes 0 or 0.5", () => {
    expect(scoreTruth("love.02", NOT_APPLICABLE)).toBeNull();
  });
  it("Love N/A answers neither lower nor inflate the average; denominator adjusts", () => {
    const withNA = fill("4", { "love.02": NOT_APPLICABLE, "love.03": NOT_APPLICABLE });
    const lo = orbit(computeLifeMap(withNA), "love");
    expect(lo.coverage).toEqual({ valid: 4, eligible: 4, notApplicable: 2, missing: 0 });
    expect(lo.responseSupportIndex).toBe(1);
    expect(lo.supportConfidence).toBe("sufficient");
  });
  it("no singlehood penalty: Love with two N/A equals an Orbit with the same answers", () => {
    const r = computeLifeMap(fill("3", { "love.02": NOT_APPLICABLE, "love.03": NOT_APPLICABLE }));
    expect(orbit(r, "love").responseSupportIndex).toBeCloseTo(0.75);
    expect(orbit(r, "love").responseSupportIndex).toBe(orbit(r, "body").responseSupportIndex);
  });
  it("missing evidence stays null, never neutral", () => {
    const a = fill("3");
    for (const q of QUESTION_BANK.filter((q) => q.chapterId === "body" && q.responseType === "truth")) delete a[q.id];
    delete a["body.importance"];
    const b = orbit(computeLifeMap(a), "body");
    expect(b.responseSupportIndex).toBeNull();
    expect(b.importanceDirect).toBeNull();
    expect(b.supportConfidence).toBe("insufficient");
  });
  it("incomplete submissions are marked partial", () => {
    const a = fill("3");
    delete a["mind.01"];
    expect(computeLifeMap(a).completionStatus).toBe("partial");
    expect(computeLifeMap(fill("3")).completionStatus).toBe("complete");
  });
  it("coverage gate is max(3, ceil(60%)) and flagged unapproved", () => {
    expect(confidenceOf({ valid: 4, eligible: 7, notApplicable: 0, missing: 3 })).toBe("limited"); // needs 5
    expect(confidenceOf({ valid: 5, eligible: 7, notApplicable: 0, missing: 2 })).toBe("sufficient");
    expect(confidenceOf({ valid: 3, eligible: 4, notApplicable: 2, missing: 1 })).toBe("sufficient"); // needs 3
    expect(PROVISIONAL_1.coverage.approved).toBe(false);
  });
});

describe("unapproved metrics stay inactive (spec §5.3–5.6)", () => {
  const r = computeLifeMap(fill("3"));
  it("vitality stays pending; distance is a provisional congruence band (provisional-2)", () => {
    for (const o of r.orbits) {
      expect(o.vitality).toBeNull();
      expect(o.metricStatuses.vitality).toBe("pending_mapping");
      expect(o.metricStatuses.brightness).toBe("proxy");
      if (o.congruence === null) { expect(o.distanceBand).toBeNull(); expect(o.metricStatuses.distance).toBe("unavailable"); }
      else { expect(["close", "middle", "far"]).toContain(o.distanceBand); expect(o.metricStatuses.distance).toBe("proxy"); }
    }
  });
  it("earlier scoring version keeps every Orbit on the neutral ring", () => {
    for (const o of computeLifeMap(fill("3"), PROVISIONAL_1).orbits) { expect(o.congruence).toBeNull(); expect(o.distanceBand).toBeNull(); expect(o.metricStatuses.distance).toBe("pending_mapping"); }
  });
  it("size uses direct importance only", () => {
    expect(PROVISIONAL_1.active.importance).toBe("direct_only");
    expect(orbit(r, "mind").importanceDirect).toBe(0.5);
  });
  it("no fabricated ranking while scoring dependencies are unresolved", () => {
    expect(r.attention.mode).toBe("qualitative_pending_approval");
    expect(r.attention.rankedOrbits).toEqual([]);
  });
  it("there is no Least connected card; the sixth item is Furthest from the Sun, or expectations when nothing stands further out (15 Oct)", () => {
    expect(r.snapshot.map((s) => s.key)).not.toContain("leastConnected");
    const six = r.snapshot[r.snapshot.length - 1];
    if (six.key === "furthest") {
      expect(six.label).toBe("Furthest from the Sun");
      for (const o of six.orbits) expect(r.orbits.find((x) => x.orbit === o)!.distanceBand).not.toBe("close");
      expect(six.body).not.toMatch(/disconnected|distant from yourself|problem/i);
    } else expect(six.label).toBe("Most shaped by expectations");
  });
  it("Sun index is an interim unweighted mean and never treated as an Orbit", () => {
    expect(r.sun.responseIndex).toBe(0.75);
    expect(r.orbits.map((o) => o.orbit)).not.toContain("sun");
  });
});

describe("interconnections and energy (spec §6)", () => {
  it("same Orbit can be both energy source and largest demand", () => {
    const r = computeLifeMap(fill("3", { "interconnections.01": "growth", "interconnections.02": "growth" }));
    expect(r.insights.some((i) => i.templateId === "demand_and_source" && i.orbits[0] === "growth")).toBe(true);
  });
  it("external expectations selection is not treated as numeric agreement", () => {
    const a = fill("3");
    const b = { ...a, "interconnections.06": "joy" };
    expect(orbit(computeLifeMap(b), "joy").responseSupportIndex).toBe(orbit(computeLifeMap(a), "joy").responseSupportIndex);
  });
  it("Most energy out/in come from the respondent's own selections", () => {
    const s = computeLifeMap(fill("3", { "interconnections.01": "social", "interconnections.02": "joy" })).snapshot;
    expect(s.find((x) => x.key === "energyOut")!.orbits).toEqual(["social"]);
    expect(s.find((x) => x.key === "energyIn")!.orbits).toEqual(["joy"]);
  });
  it("Largest place now = highest direct importance, ties shown", () => {
    const s = computeLifeMap(fill("3", { "body.importance": "4", "growth.importance": "4" })).snapshot;
    expect(s.find((x) => x.key === "largestPlace")!.orbits).toEqual(["body", "growth"]);
  });
  it("Most supported / Needs more attention are hidden when every Orbit ties", () => {
    // reverse-keyed items answered "1" key to 0.75, matching the "3" answers elsewhere → a true tie
    const rev = { "mind.05": "1", "restoration.02": "1", "growth.03": "1", "growth.06": "1", "resources.05": "1" };
    const s = computeLifeMap(fill("3", rev)).snapshot;
    expect(s.find((x) => x.key === "mostSupported")!.available).toBe(false);
    expect(s.find((x) => x.key === "needsAttention")!.available).toBe(false);
  });
  it("Social World reports career and community separately", () => {
    const st = orbit(computeLifeMap(fill("3", { "social.04": "0" })), "social").subthemes!;
    expect(st.career).toBeLessThan(st.community!);
  });
});

describe("emotions, reflections, determinism", () => {
  it("emotions don't affect any numeric score", () => {
    const a = fill("3");
    const b = { ...a, "mind.emotion": ["rumination", "pressure", "fatigue"] };
    const ra = computeLifeMap(a), rb = computeLifeMap(b);
    expect(orbit(rb, "mind").responseSupportIndex).toBe(orbit(ra, "mind").responseSupportIndex);
    expect(orbit(rb, "mind").emotions.map((e) => e.label)).toEqual(["Rumination", "Pressure", "Fatigue"]);
  });
  it("closing reflection doesn't alter the score or map", () => {
    const a = fill("3");
    const b = { ...a, "interconnections.reflection": "Something I keep postponing." };
    const strip = (x: ReturnType<typeof computeLifeMap>) => JSON.stringify({ o: x.orbits, s: x.snapshot, at: x.attention });
    expect(strip(computeLifeMap(b))).toBe(strip(computeLifeMap(a)));
  });
  it("all-high, all-low, mixed and repeated submissions are deterministic", () => {
    for (const v of ["0", "2", "4"]) {
      const a = fill(v, { "growth.03": "0", "mind.05": "4" });
      expect(JSON.stringify(computeLifeMap(a))).toBe(JSON.stringify(computeLifeMap(a)));
    }
  });
  it("results carry version identifiers", () => {
    expect(computeLifeMap(fill("3")).versions).toEqual({
      assessment: "v10-with-approved-oct12-overrides", questionBank: "v10-oct12.2", scoring: "provisional-2", templates: "1", mapRender: "1",
    });
  });
});

describe("insights (spec §9)", () => {
  const r = computeLifeMap(fill("1", {
    "restoration.importance": "4", "restoration.energy": "-2",
    "interconnections.01": "social", "interconnections.02": "joy", "interconnections.03": "restoration",
    "interconnections.04": "restoration", "interconnections.05": "growth", "interconnections.06": "resources",
    "joy.importance": "0", "joy.energy": "2",
  }));
  const claims = [...r.insights, ...r.attention.candidates.flatMap((c) => c.reasons), ...r.snapshot.filter((s) => s.available)];
  it("every personal claim has evidence", () => {
    for (const i of claims) expect(i.evidence.length).toBeGreaterThan(0);
  });
  it("a low-importance but strongly nourishing Orbit is not an attention candidate", () => {
    expect(r.attention.candidates.find((c) => c.orbit === "joy")).toBeUndefined();
  });
  it("no diagnostic or absolute language", () => {
    const text = claims.map((i) => i.body).join(" ").toLowerCase();
    for (const w of ["diagnos", "disorder", "trauma", "always", "never", "you need to", "unhealthy", "your true"]) expect(text).not.toContain(w);
  });
  it("hypotheses are marked and carry a caveat", () => {
    for (const c of r.attention.candidates.flatMap((x) => x.reasons).filter((x) => x.hypothesis)) expect(c.caveat).toBeTruthy();
  });
  it("missing evidence suppresses insights rather than generating filler", () => {
    const empty = computeLifeMap({});
    expect(empty.insights).toEqual([]);
    expect(empty.attention.candidates).toEqual([]);
    expect(empty.snapshot.filter((s) => s.available)).toEqual([]);
  });
});

describe("navigation", () => {
  it("progress starts at zero", () => {
    expect(progress({})).toBe(0);
  });
  it("resumes at the first unanswered required question", () => {
    const a = fill("2");
    delete a["growth.04"];
    expect(ACTIVE_QUESTIONS[resumeStep(a)].id).toBe("growth.04");
    expect(isComplete(a)).toBe(false);
  });
  it("feelings: 1 to 3 from that Orbit's list", () => {
    const em = QUESTION_BANK.find((q) => q.id === "mind.emotion")!;
    expect(validate(em, undefined)).not.toBeNull();
    expect(validate(em, ["clarity", "peace"])).toBeNull();
    expect(validate(em, ["clarity", "peace", "curiosity", "openness"])).not.toBeNull();
    expect(validate(em, ["strength"])).not.toBeNull(); // a Body option
  });
  it("closing reflection is optional free text", () => {
    const r = QUESTION_BANK.find((q) => q.id === "interconnections.reflection")!;
    expect(validate(r, undefined)).toBeNull();
    expect(validate(r, "x".repeat(2001))).not.toBeNull();
    expect(isComplete(fill("2"))).toBe(true);
  });
  it("N/A accepted only where allowed", () => {
    expect(validate(QUESTION_BANK.find((q) => q.id === "love.02")!, NOT_APPLICABLE)).toBeNull();
    expect(validate(QUESTION_BANK.find((q) => q.id === "love.01")!, NOT_APPLICABLE)).not.toBeNull();
    expect(validate(QUESTION_BANK.find((q) => q.id === "mind.01")!, "7")).not.toBeNull();
  });
});
