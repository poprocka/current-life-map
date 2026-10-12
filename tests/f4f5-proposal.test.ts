/** Guards for the F4/F5 proposal prototype (not live). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { f4, f5 } from "@/engine/proposals/f4f5";

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
  it("is not imported by the app", () => {
    const hits = fs.readdirSync(path.join(__dirname, "../src"), { recursive: true }).map(String)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("proposals"))
      .filter((f) => fs.readFileSync(path.join(__dirname, "../src", f), "utf8").includes("proposals/f4f5"));
    expect(hits).toEqual([]);
  });
  it("without the new items, five Orbits lack congruence evidence", () => {
    const a = base(); for (const o of ORBIT_IDS) delete a[`${o}.congruence`];
    expect(f4(a).filter((x) => x.status === "insufficient").map((x) => x.orbit).sort()).toEqual(["body", "joy", "mind", "resources", "restoration"]);
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
