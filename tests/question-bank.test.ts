/** Spec §11 registry/content tests. */
import { describe, it, expect } from "vitest";
import { QUESTION_BANK, ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { CHAPTERS } from "@/content/v10/chapters";

const byId = Object.fromEntries(QUESTION_BANK.map((q) => [q.id, q]));
const count = (ch: string, t = "truth") => QUESTION_BANK.filter((q) => q.chapterId === ch && q.responseType === t && q.measure !== "congruence").length;

describe("registry (spec §11)", () => {
  it("exactly ten sections: Sun + eight Orbits + Life Interconnections", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(["sun", "mind", "body", "restoration", "growth", "love", "social", "resources", "joy", "interconnections"]);
  });
  it("statement counts per section", () => {
    expect(["sun", "mind", "body", "restoration", "growth", "love", "social", "resources", "joy"].map((c) => count(c))).toEqual([11, 7, 7, 6, 6, 6, 7, 6, 6]);
  });
  it("exactly two N/A-enabled questions, both Love, exact prompts", () => {
    const na = QUESTION_BANK.filter((q) => q.allowNotApplicable).map((q) => q.prompt).sort();
    expect(na).toEqual([
      "I can openly communicate my needs, desires and boundaries in my intimate life.",
      "My romantic or intimate life feels fulfilling for the stage of life I'm in.",
    ]);
  });
  it("Resources familiarity question uses the short wording and is reverse-keyed", () => {
    expect(byId["resources.05"].prompt).toBe("I tend to stay in familiar financial or living circumstances because change feels uncertain.");
    expect(byId["resources.05"].reverseKeyed).toBe(true);
  });
  it("Joy creativity question present, removed enjoyment question absent", () => {
    expect(byId["joy.06"].prompt).toBe("I give myself opportunities to express my creativity and talents.");
    expect(byId["joy.06"].reverseKeyed).toBe(false);
    expect(byId["joy.06"].exploreCategory).toBe("Creativity & Self-Expression");
    expect(QUESTION_BANK.some((q) => q.prompt === "I make room for enjoyment that feels genuinely my own.")).toBe(false);
  });
  it("external expectations question exact wording, selection type", () => {
    expect(byId["interconnections.06"].prompt).toBe("Which Orbit is most influenced by other people’s expectations or social standards?");
    expect(byId["interconnections.06"].responseType).toBe("orbit_select");
    expect(byId["interconnections.06"].direction).toBe("selection");
  });
  it("Social World subtitle is Community & Career", () => {
    expect(CHAPTERS.find((c) => c.id === "social")!.subtitle).toBe("Community & Career");
  });
  it("exactly the five known reverse-keyed items", () => {
    expect(QUESTION_BANK.filter((q) => q.reverseKeyed).map((q) => q.id).sort()).toEqual(["growth.03", "growth.06", "mind.05", "resources.05", "restoration.02"]);
  });
  it("emotion options per Orbit: 12 each, max 3, no Sun feelings item", () => {
    const em = QUESTION_BANK.filter((q) => q.responseType === "emotional_state");
    expect(em.map((q) => q.chapterId)).toEqual(["mind", "body", "restoration", "growth", "love", "social", "resources", "joy"]);
    expect(em.every((q) => q.options.length === 12 && q.maxSelections === 3 && q.enabled)).toBe(true);
    expect(em[0].options.map((o) => o.label)).toEqual(["Clarity", "Peace", "Curiosity", "Confidence", "Openness", "Neutrality", "Busyness", "Unease", "Rumination", "Pressure", "Distraction", "Fatigue"]);
    expect(em.find((q) => q.chapterId === "social")!.prompt).toBe("When you think about your Social World Orbit as it is today, which feelings or inner states are most present?");
  });
  it("truth statements have no approved signal tags yet (open item F1)", () => {
    expect(QUESTION_BANK.filter((q) => q.responseType === "truth").every((q) => q.signalTags.length === 0)).toBe(true);
  });
  it("101 screens: 8 congruence statements added; the pre-Map reflection is retired", () => {
    expect(ACTIVE_QUESTIONS).toHaveLength(101);
    expect(ACTIVE_QUESTIONS.filter((q) => q.measure === "congruence").map((q) => q.id)).toEqual(
      ["mind", "body", "restoration", "growth", "love", "social", "resources", "joy"].map((o) => `${o}.congruence`));
    for (const o of ["mind", "love"]) {
      const ids = ACTIVE_QUESTIONS.filter((q) => q.chapterId === o).map((q) => q.id);
      expect(ids.indexOf(`${o}.congruence`)).toBe(ids.indexOf(`${o}.importance`) + 1); // right after importance
    }
    expect(ACTIVE_QUESTIONS.some((q) => q.id === "interconnections.reflection")).toBe(false);
    expect(QUESTION_BANK.find((q) => q.id === "interconnections.reflection")).toMatchObject({ enabled: false }); // kept for earlier records
  });
  it("unique stable ids, no empty prompts", () => {
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
    expect(ACTIVE_QUESTIONS.every((q) => q.prompt.length > 0)).toBe(true);
  });
});
