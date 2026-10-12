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
    expect(QUESTION_BANK.filter((q) => q.chapterId === "interconnections" && q.responseType !== "text")).toHaveLength(7);
  });
  it("marks exactly the five V10 reverse-keyed items", () => {
    expect(QUESTION_BANK.filter((q) => q.reverseKeyed).map((q) => q.id).sort()).toEqual(
      ["growth.03", "growth.06", "mind.05", "resources.05", "restoration.02"]);
  });
  it("presents 94 screens including one feelings question per Orbit and the closing reflection", () => {
    expect(ACTIVE_QUESTIONS).toHaveLength(94);
    expect(ACTIVE_QUESTIONS[ACTIVE_QUESTIONS.length - 1]).toMatchObject({ id: "interconnections.reflection", optional: true, responseType: "text" });
    const em = QUESTION_BANK.filter((q) => q.responseType === "emotional_state" && q.enabled);
    expect(em).toHaveLength(8);
    expect(em.every((q) => q.options.length === 12 && q.maxSelections === 3)).toBe(true);
    expect(em.find((q) => q.chapterId === "social")!.prompt).toBe(
      "When you think about your Social World Orbit as it is today, which feelings or inner states are most present?");
    expect(em[0].instruction).toBe("Choose up to 3.");
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
