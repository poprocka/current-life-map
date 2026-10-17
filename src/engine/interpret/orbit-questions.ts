/**
 * One question per Orbit (Jana, 17 Oct: "each orbit needs a question here that would lead to a deeper understanding").
 * Chosen deterministically by the Orbit's state, so the question picks up where the Self-Interview left off rather than
 * repeating it. Order of precedence: far from the Sun → important but thinly supported → takes energy → gives energy →
 * well supported → not a priority → general.
 */
import type { OrbitId } from "@/content/types";
import { ORBIT_Q } from "@/engine/narrative/compose";
import type { E } from "./evidence";

export type OrbitState = "far" | "thin" | "drain" | "source" | "strong" | "quiet" | "general";

const Q: Record<OrbitId, Record<Exclude<OrbitState, "general">, string>> = {
  mind: {
    far: "If your thoughts were organized around what matters to you, what would you think about less, and what more?",
    thin: "What does your mind need from you that it isn't getting right now: quiet, focus, or something else?",
    drain: "When your mind feels most crowded, what is it usually trying to solve or hold on to?",
    source: "What kind of thinking leaves you clearer than before you started?",
    strong: "What helps your mind stay steady, and how would you notice if that began to slip?",
    quiet: "If your mind had more of your attention, what would you want to understand about it?",
  },
  body: {
    far: "If you cared for your body by your own standards rather than anyone else's, what would change first?",
    thin: "What is your body asking for that keeps getting postponed?",
    drain: "Where in an ordinary day does your body feel the cost of how you live?",
    source: "What does your body do that reliably gives you energy back?",
    strong: "Which habits keep your body working well for you, and which one would you least want to lose?",
    quiet: "How do you know when your body needs more of your attention?",
  },
  restoration: {
    far: "What would rest look like if it were shaped around you rather than around what's left of the day?",
    thin: "What would recovery look like if you didn't have to earn it first?",
    drain: "What makes stopping feel harder than continuing?",
    source: "Which kinds of rest actually restore you, and which only pass the time?",
    strong: "What protects your rest when life gets full?",
    quiet: "If rest had a bigger place in your life, what would you hope it gives you?",
  },
  growth: {
    far: "What would growth look like if you chose its direction entirely yourself?",
    thin: "What would you be learning or building now if you had the room?",
    drain: "Is the growth you're pursuing asking more than it gives back, and is that a trade you're choosing?",
    source: "What about growing right now gives you the most energy?",
    strong: "Where is your growth taking you, and is that still where you want to go?",
    quiet: "Is growth resting by choice right now, or waiting for something?",
  },
  love: {
    far: "What would intimacy look like if it fully reflected what matters to you?",
    thin: "What kind of closeness are you missing most right now?",
    drain: "What does closeness ask of you that feels heavy, and what would make it lighter?",
    source: "What in your experience of love gives you energy back?",
    strong: "What makes it possible to be fully yourself in intimacy, and how do you protect that?",
    quiet: "Is love quieter in your life by choice right now, or is something else holding it there?",
  },
  social: {
    far: "Which of your relationships reflect who you are now, and which ask you to be someone else?",
    thin: "What kind of support or belonging would make the biggest difference to you?",
    drain: "Which connections give back what they ask of you, and which don't?",
    source: "Who are the people you come back from feeling more like yourself?",
    strong: "What do your strongest relationships have in common?",
    quiet: "How much connection feels right to you at this point in your life?",
  },
  resources: {
    far: "If your financial and living situation reflected what matters to you, what would be different?",
    thin: "What would a little more room, in money, time or space, make possible for you?",
    drain: "Which part of managing your resources takes the most out of you?",
    source: "What does your financial and living situation make possible that you value most?",
    strong: "What do you want your resources to support next?",
    quiet: "How much of your attention do you want your resources to take?",
  },
  joy: {
    far: "What would you do more often if enjoyment didn't need a reason?",
    thin: "When did you last enjoy something simply for its own sake, and what made room for it?",
    drain: "Has anything you once enjoyed turned into an obligation, and do you want it back?",
    source: "What gives you joy reliably, and how could it have more space?",
    strong: "What keeps joy present in your life, and how do you protect it?",
    quiet: "Is joy something you want more of right now, or does it feel like enough?",
  },
};

export function orbitState(e: E, o: OrbitId): OrbitState {
  const c = e.c, r = c.by[o];
  if (r.supportConfidence === "insufficient") return "general";
  const imp = c.important(o);
  if (r.distanceBand === "far" || (imp && e.cong(o) === "not")) return "far";
  if (imp && (e.map.dimmest.includes(o) || c.lessSupported(o))) return "thin";
  if (c.takes(o)) return "drain";
  if (c.gives(o)) return "source";
  if (e.map.brightest.includes(o) || c.moreSupported(o) || r.distanceBand === "close") return "strong";
  if (c.unimportant(o)) return "quiet";
  return "general";
}

/** The Orbit's question, avoiding any question already used elsewhere on the page. */
export function orbitQuestion(e: E, o: OrbitId, taken: Set<string>): { text: string; state: OrbitState } {
  const state = orbitState(e, o);
  const order: string[] = [...(state === "general" ? [] : [Q[o][state]]), ORBIT_Q[o], Q[o].strong, Q[o].thin];
  const text = order.find((q) => !taken.has(q)) ?? ORBIT_Q[o];
  taken.add(text);
  return { text, state };
}
