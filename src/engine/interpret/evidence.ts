/**
 * Interpretation engine "interpret-1" — Layer 1: the evidence foundation (approved 15 Oct, free-launch architecture).
 *
 * Reads only the approved scoring result and the raw answers (through the shared narrative context). Adds what the
 * interpretation needs: answer strengths with reverse coding applied, Map facts with ties made explicit, and what is
 * unknown. Never changes a score.
 */
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import type { LifeMapResult } from "@/engine/compute";
import { makeContext, type Answers, type Ctx } from "@/engine/narrative/context";
import type { Evidence } from "@/engine/narrative/types";

export const ORBITS = ORBIT_IDS as OrbitId[];
const EPS = 0.01; // brightness values closer than this are a tie

export interface MapFacts {
  largest: OrbitId[];               // highest importance (ties included)
  brightest: OrbitId[];             // highest support index (ties included)
  dimmest: OrbitId[];
  close: OrbitId[]; middle: OrbitId[]; far: OrbitId[];
  givers: OrbitId[]; takers: OrbitId[]; drainsALot: OrbitId[];
  soleGiver: OrbitId | null; soleTaker: OrbitId | null;
}

export function buildEvidence(result: LifeMapResult, answers: Answers) {
  const c = makeContext(result, answers);
  const k = (id: string) => c.keyed(id);
  /** Normal items: Very true or Completely true. */
  const yes = (id: string) => (k(id) ?? -1) >= 0.75;
  /** Normal items: Not true or Somewhat true. */
  const no = (id: string) => { const v = k(id); return v !== null && v <= 0.25; };
  /** Reverse-keyed items (a difficulty statement): the person says it is Very or Completely true of them. */
  const endorsed = (id: string) => { const v = k(id); return v !== null && v <= 0.25; };
  /** Reverse-keyed items: Mostly true (present, not strongly). */
  const partly = (id: string) => k(id) === 0.5;
  const mid = (id: string) => k(id) === 0.5;
  const isNA = (id: string) => answers[id] === "__not_applicable__";
  /** Label of an answer, lower-case, for quoting inside a sentence ("somewhat true"). */
  const said = (id: string) => c.label(id).toLowerCase();

  const sup = (o: OrbitId) => c.by[o].supportConfidence === "sufficient" ? c.by[o].responseSupportIndex : null;
  const supported = ORBITS.filter((o) => sup(o) !== null);
  const hi = Math.max(...supported.map((o) => sup(o)!)), lo = Math.min(...supported.map((o) => sup(o)!));
  const band = (b: "close" | "middle" | "far") => ORBITS.filter((o) => c.by[o].distanceBand === b);
  const givers = ORBITS.filter(c.gives), takers = ORBITS.filter(c.takes);
  const map: MapFacts = {
    largest: c.mostImportant,
    brightest: supported.length >= 2 && hi - lo >= 0.1 ? supported.filter((o) => hi - sup(o)! < EPS) : [],
    dimmest: supported.length >= 2 && hi - lo >= 0.1 ? supported.filter((o) => sup(o)! - lo < EPS) : [],
    close: band("close"), middle: band("middle"), far: band("far"),
    givers, takers, drainsALot: ORBITS.filter((o) => c.energy(o) === 5),
    soleGiver: givers.length === 1 ? givers[0] : null,
    soleTaker: takers.length === 1 ? takers[0] : null,
  };

  const ic = c.ic;
  const roles = {
    demand: ic.largestDemand as OrbitId | null, source: ic.largestSource as OrbitId | null, lever: ic.leverageSelection as OrbitId | null,
    crowded: ic.crowdedOut as OrbitId | null, gap: ic.priorityGap as OrbitId | null, expect: ic.externalInfluence as OrbitId | null,
    overall: ic.overallSupport?.value ?? null,
  };
  /** Congruence of an Orbit: "own" (Very true or more), "partial" (Mostly), "not" (Somewhat or Not true), null. */
  const cong = (o: OrbitId): "own" | "partial" | "not" | null => {
    const v = k(`${o}.congruence`); if (v === null) return null;
    return v >= 0.75 ? "own" : v >= 0.5 ? "partial" : "not";
  };
  const ev = (...ids: string[]): Evidence[] => ids.filter((id) => answers[id] !== undefined).map(c.ev);
  /** Count of Sun statements answered Very true or more. */
  const sunStrong = ["sun.01", "sun.02", "sun.03", "sun.04", "sun.05", "sun.06", "sun.07", "sun.08", "sun.09", "sun.10", "sun.11"].filter(yes);
  const unknowns = [
    ...Object.keys(answers).filter((id) => isNA(id)).map((id) => `${id} marked not applicable`),
    ...ORBITS.filter((o) => c.by[o].supportConfidence !== "sufficient").map((o) => `${o}: not enough answers to read support`),
    "causes, personal history and timeframes are not asked by the Self-Interview",
  ];
  return { c, k, yes, no, endorsed, partly, mid, isNA, said, sup, map, roles, cong, ev, sunStrong, unknowns, N: c.name };
}
export type E = ReturnType<typeof buildEvidence>;
export type { Ctx };
