import { describe, it, expect } from "vitest";
import { QUESTION_BANK, ACTIVE_QUESTIONS } from "@/content/v10/question-bank";

const count = (ch: string, t = "truth") => QUESTION_BANK.filter((q) => q.chapterId === ch && q.responseType === t).length;

describe("V10 question bank completeness", () => {
  it("has the V10 statement counts per chapter", () => {
    expect([count("sun"), count("mind"), count("body"), count("restoration"), count("growth"),
      count("love"), count("social"), count("resources"), count("joy")]).toEqual([11, 7, 7, 6, 6, 6, 7, 6, 6]);
  });
  it("has importance + energy for each of the eight Orbits", () => {
    expect(QUESTION_BANK.filter((q) => q.responseType === "importance")).toHaveLength(8);
    expect(QUESTION_BANK.filter((q) => q.responseType === "energy")).toHaveLength(8);
  });
  it("has 7 interconnection selections", () => {
    expect(QUESTION_BANK.filter((q) => q.chapterId === "interconnections")).toHaveLength(7);
  });
  it("marks exactly the five V10 reverse-keyed items", () => {
    expect(QUESTION_BANK.filter((q) => q.reverseKeyed).map((q) => q.id).sort()).toEqual(
      ["growth.03", "growth.06", "mind.05", "resources.05", "restoration.02"]);
  });
  it("presents 85 screens while emotional-state options are pending", () => {
    expect(ACTIVE_QUESTIONS).toHaveLength(85);
    expect(QUESTION_BANK.filter((q) => q.responseType === "emotional_state" && q.enabled)).toHaveLength(0);
  });
  it("has unique stable ids and no empty prompts", () => {
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
    expect(ACTIVE_QUESTIONS.every((q) => q.prompt.length > 0)).toBe(true);
  });
  it("preserves exact wording (spot checks)", () => {
    const byId = Object.fromEntries(QUESTION_BANK.map((q) => [q.id, q]));
    expect(byId["sun.09"].prompt).toBe("I accept that I can be ambitious and sensitive, independent and still need closeness.");
    expect(byId["mind.importance"].prompt).toBe("How important is Mind in your life right now?");
    expect(byId["social.energy"].prompt).toBe("As Social World exists in your life today, what happens to your energy?");
    expect(byId["love.03"].cue.text.startsWith("Intimacy → Current fulfillment.")).toBe(true);
  });
  it("offers Not applicable only on Love items", () => {
    expect(QUESTION_BANK.filter((q) => q.allowNotApplicable).every((q) => q.chapterId === "love")).toBe(true);
  });
});
