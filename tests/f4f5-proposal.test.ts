/** Guards for the F4/F5 proposal prototype (not live). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { CONGRUENCE_ITEMS, CONGRUENCE_MAPPING_STATUS, bandOf, f4, f4Distance, f5 } from "@/engine/congruence";
import { questionById } from "@/content/v10/question-bank";
import { computeLifeMap } from "@/engine/compute";
import { FEATURES } from "@/engine/config/scoring";

const base = () => {
  const a: Record<string, string | string[]> = {};
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "truth") a[q.id] = "2";
    else if (q.responseType === "importance") a[q.id] = "2";
    else if (q.responseType === "energy") a[q.id] = "0";
  }
  for (const o of ORBIT_IDS) a[`${o}.congruence`] = "2";
  return a;
};

describe("F4/F5 proposal prototype", () => {
  it("stays off the client's Map until sign-off: distance neutral, no ranking", () => {
    expect(FEATURES).toEqual({ personalisedDistance: false, attentionTiers: false });
    const r = computeLifeMap(base());
    expect(r.orbits.every((o) => o.congruence === null)).toBe(true);
    expect(r.attention.rankedOrbits).toEqual([]);
    // the client-facing UI never imports the F4/F5 module
    for (const f of ["components/ResultsView.tsx", "components/PersonalMap.tsx", "lib/pdf/clientReport.ts", "lib/pdf/model.ts"])
      expect(fs.readFileSync(path.join(__dirname, "../src", f), "utf8")).not.toContain("engine/congruence");
  });
  it("congruence statements never feed support/brightness", () => {
    const a = base(), b = { ...base(), "mind.congruence": "4" };
    expect(computeLifeMap(b).orbits.find((o) => o.orbit === "mind")!.responseSupportIndex).toBe(computeLifeMap(a).orbits.find((o) => o.orbit === "mind")!.responseSupportIndex);
  });
  it("without the congruence statement, no Orbit is positioned (supporting answers never stand in)", () => {
    const a = base(); for (const o of ORBIT_IDS) delete a[`${o}.congruence`];
    const r = f4(a);
    expect(r.every((x) => x.status === "insufficient" && x.band === null && x.congruence === null)).toBe(true);
  });
  it("Love N/A is not penalised", () => {
    const a = base(), b = { ...base(), "love.02": NOT_APPLICABLE, "love.03": NOT_APPLICABLE };
    expect(f5(b).rows.find((r) => r.orbit === "love")).toEqual(f5(a).rows.find((r) => r.orbit === "love"));
  });
  it("Formula B keeps low-importance, low-answer Joy out of the top tier; Formula A does not", () => {
    const a = base();
    for (const q of ACTIVE_QUESTIONS) if (q.chapterId === "joy" && q.responseType === "truth") a[q.id] = q.reverseKeyed ? "4" : "0";
    Object.assign(a, { "joy.importance": "0", "joy.energy": "-2", "joy.congruence": "0" });
    const r = f5(a);
    expect(r.tiersA[0]).toContain("joy");
    expect(r.tiersB[0]).not.toContain("joy");
  });
});

describe("F4 approved rules (13 Oct)", () => {
  const one = (a: Record<string, string | string[]>, o: string) => f4(a).find((x) => x.orbit === o)!;
  it("a valid congruence answer alone positions the Orbit; Mind uses it alone", () => {
    const a = base(); a["mind.congruence"] = "3";
    expect(one(a, "mind")).toMatchObject({ congruence: 0.75, band: "close", supporting: null, mixed: false });
    expect(CONGRUENCE_ITEMS.mind).toEqual([]);
  });
  it("direct-only scale: Very/Completely → close, Mostly → middle, Somewhat/Not true → far", () => {
    const want = ["far", "far", "middle", "close", "close"];
    for (const v of ["0", "1", "2", "3", "4"]) { const a = base(); a["mind.congruence"] = v; expect(one(a, "mind").band).toBe(want[Number(v)]); }
  });
  it("50/50 with supporting statements; partial counts half", () => {
    const a = base(); Object.assign(a, { "restoration.congruence": "4", "restoration.05": "0", "restoration.06": "4" });
    // supporting = (0×1 + 1×0.5) / 1.5 = 0.333 → 0.5×1 + 0.5×0.333 = 0.67
    expect(one(a, "restoration")).toMatchObject({ direct: 1, supporting: 0.33, congruence: 0.67, band: "close" });
  });
  it("skipped or N/A supporting answers are redistributed, never imputed", () => {
    const a = base(); Object.assign(a, { "love.congruence": "4", "love.01": "4", "love.05": "4", "love.02": NOT_APPLICABLE });
    expect(one(a, "love")).toMatchObject({ supporting: 1, congruence: 1 });
    const b = base(); b["growth.congruence"] = "1"; delete b["growth.06"];
    expect(one(b, "growth")).toMatchObject({ congruence: 0.25, supporting: null, band: "far" });
  });
  it("contradictory answers are flagged mixed, not hidden", () => {
    const a = base(); Object.assign(a, { "joy.congruence": "4", "joy.05": "0", "joy.02": "0" });
    expect(one(a, "joy")).toMatchObject({ direct: 1, supporting: 0, congruence: 0.5, band: "middle", mixed: true });
    const b = base(); Object.assign(b, { "joy.congruence": "3", "joy.05": "2", "joy.02": "2" });
    expect(one(b, "joy").mixed).toBe(false);
  });
  it("reverse-scored supporting statements count the right way", () => {
    const a = base(); Object.assign(a, { "growth.congruence": "2", "growth.06": "4" }); // "I often … put it off" = completely true
    expect(one(a, "growth")).toMatchObject({ supporting: 0, congruence: 0.25, band: "far" });
  });
  it("threshold boundaries: 0.67 close, 0.66 middle, 0.34 middle, 0.33 far; near-boundary flagged", () => {
    expect([bandOf(0.67), bandOf(0.66), bandOf(0.34), bandOf(0.33)]).toEqual(["close", "middle", "middle", "far"]);
    const a = base(); Object.assign(a, { "restoration.congruence": "4", "restoration.05": "0", "restoration.06": "4" });
    expect(one(a, "restoration").nearBoundary).toBe(true);
    const b = base(); b["mind.congruence"] = "2";
    expect(one(b, "mind").nearBoundary).toBe(false);
  });
  it("three distinct rings only; insufficient sits on the neutral ring", () => {
    const r = ["close", "middle", "far", null].map((band) => f4Distance({ band: band as any }));
    expect(new Set(r).size).toBe(3);
    expect(r[3]).toBe(r[1]);
    expect(r[0]).toBeLessThan(r[1]); expect(r[1]).toBeLessThan(r[2]);
  });
  it("mapping is marked proposed and uses only enabled truth statements from the same Orbit, never satisfaction proxies", () => {
    expect(CONGRUENCE_MAPPING_STATUS).toBe("proposed");
    for (const [o, items] of Object.entries(CONGRUENCE_ITEMS)) for (const it of items) {
      const q = questionById(it.id)!;
      expect(q.chapterId).toBe(o); expect(q.responseType).toBe("truth"); expect(q.enabled).toBe(true);
    }
    const ids = Object.values(CONGRUENCE_ITEMS).flat().map((x) => x.id);
    for (const excluded of ["love.03", "body.02", "body.03", "growth.05", "social.05", "restoration.01"]) expect(ids).not.toContain(excluded);
  });
});
