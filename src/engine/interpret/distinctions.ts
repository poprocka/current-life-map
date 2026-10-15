/**
 * Layer 3 — distinction modules (approved 15 Oct). Reasoning resources, not results: each decides which side of a
 * distinction the person's answers support, or returns "open" when the evidence points both ways or is missing, in
 * which case the reading asks rather than asserts. Each module may be used at most once per result.
 */
import type { OrbitId } from "@/content/types";
import type { Evidence } from "@/engine/narrative/types";
import type { E } from "./evidence";

export type ModuleId =
  | "will-capacity" | "chosen-imposed" | "knowing-living" | "stability-stagnation" | "independence-isolation"
  | "achievement-fulfillment" | "acceptance-resignation" | "rest-permission" | "access-knowhow" | "future-present";

export interface Decision<S extends string> { module: ModuleId; side: S | "open"; evidence: Evidence[] }

/** Will vs capacity: is something under-lived for lack of follow-through/nerve, or for lack of time, energy or room? */
export function willCapacity(e: E): Decision<"capacity" | "hesitation" | "both"> {
  const hes = ["growth.06", "growth.03"].filter(e.endorsed);
  const followThrough = e.yes("sun.08");
  const cap = [
    ...["body.01", "restoration.01", "restoration.03", "resources.06"].filter(e.no),
    ...(e.roles.crowded && e.roles.demand && e.roles.crowded !== e.roles.demand ? ["interconnections.04"] : []),
  ];
  const evidence = e.ev(...hes, ...(followThrough ? ["sun.08"] : []), ...cap);
  if (hes.length && cap.length >= 2) return { module: "will-capacity", side: "both", evidence };
  if (hes.length) return { module: "will-capacity", side: "hesitation", evidence };
  if (followThrough && cap.length >= 2) return { module: "will-capacity", side: "capacity", evidence };
  return { module: "will-capacity", side: "open", evidence };
}

/** Chosen vs imposed expectations in one Orbit. */
export function chosenImposed(e: E, o: OrbitId): Decision<"imposed" | "chosen"> {
  const cg = e.cong(o);
  const evidence = e.ev(`${o}.congruence`, ...(e.roles.expect === o ? ["interconnections.06"] : []), ...(o === "social" ? ["social.03"] : []));
  if (e.roles.expect === o && cg === "not") return { module: "chosen-imposed", side: "imposed", evidence };
  if (e.roles.expect === o && cg === "own") return { module: "chosen-imposed", side: "chosen", evidence };
  return { module: "chosen-imposed", side: "open", evidence };
}

/** Knowing vs living: clarity about what one wants, alongside an important Orbit not lived on one's own terms. */
export function knowingLiving(e: E): Decision<"gap"> & { orbit: OrbitId | null } {
  const knows = ["sun.01", "sun.04"].filter(e.yes);
  const o = (["growth", "social", "love", "resources", "body", "mind", "restoration", "joy"] as OrbitId[]).find((x) => e.c.important(x) && e.cong(x) === "not") ?? null;
  const evidence = e.ev(...knows, ...(o ? [`${o}.importance`, `${o}.congruence`] : []));
  return knows.length && o ? { module: "knowing-living", side: "gap", evidence, orbit: o } : { module: "knowing-living", side: "open", evidence, orbit: null };
}

/** Stability vs stagnation: is the familiar a base or a holding pattern? Asks when unclear. */
export function stabilityStagnation(e: E): Decision<"stagnation" | "stability"> {
  const familiar = e.endorsed("resources.05") || e.partly("resources.05");
  const stuck = [...(e.no("growth.05") ? ["growth.05"] : []), ...(e.endorsed("growth.06") ? ["growth.06"] : []), ...(e.c.tones("growth").ids.includes("stagnation") ? ["growth.emotion"] : [])];
  const moving = ["growth.05", "growth.02"].filter(e.yes);
  const evidence = e.ev(...(familiar ? ["resources.05"] : []), ...stuck, ...moving);
  if (familiar && stuck.length >= 2) return { module: "stability-stagnation", side: "stagnation", evidence };
  if (familiar && moving.length) return { module: "stability-stagnation", side: "stability", evidence };
  return { module: "stability-stagnation", side: "open", evidence };
}

/** Independence vs isolation: self-reliance held together with closeness, or distance from others. */
export function independenceIsolation(e: E): Decision<"integrated" | "isolated"> {
  const together = ["love.05", "sun.09"].filter(e.yes);
  const apart = [...["social.02", "social.06"].filter(e.no), ...(e.c.tones("social").ids.includes("loneliness") || e.c.tones("love").ids.includes("loneliness") ? ["social.emotion"] : [])];
  const evidence = e.ev(...together, ...apart);
  if (apart.length >= 2) return { module: "independence-isolation", side: "isolated", evidence };
  if (together.length === 2 && !apart.length) return { module: "independence-isolation", side: "integrated", evidence };
  return { module: "independence-isolation", side: "open", evidence };
}

/** Achievement vs fulfillment: the demanding area is lived, but does it feel like one's own and leave room to enjoy? */
export function achievementFulfillment(e: E): Decision<"achievement" | "both"> {
  const d = e.roles.demand;
  if (!d) return { module: "achievement-fulfillment", side: "open", evidence: [] };
  const joyThin = ["joy.01", "joy.04"].filter(e.no);
  const evidence = e.ev("interconnections.01", `${d}.congruence`, ...joyThin);
  if (e.cong(d) !== "own" && joyThin.length) return { module: "achievement-fulfillment", side: "achievement", evidence };
  if (e.cong(d) === "own" && !joyThin.length) return { module: "achievement-fulfillment", side: "both", evidence };
  return { module: "achievement-fulfillment", side: "open", evidence };
}

/** Acceptance vs resignation: staying with constraints by choice, or because change feels out of reach. */
export function acceptanceResignation(e: E): Decision<"acceptance" | "resignation"> {
  const familiar = e.endorsed("resources.05") || e.partly("resources.05");
  const evidence = e.ev("resources.05", "resources.04");
  if (!familiar) return { module: "acceptance-resignation", side: "open", evidence: [] };
  if (e.yes("resources.04")) return { module: "acceptance-resignation", side: "acceptance", evidence };
  if (e.no("resources.04")) return { module: "acceptance-resignation", side: "resignation", evidence };
  return { module: "acceptance-resignation", side: "open", evidence };
}

/** Rest vs permission to rest: is rest missing for lack of time, or does it need to be earned first? */
export function restPermission(e: E): Decision<"permission" | "time" | "both"> {
  const perm = ["restoration.06", "joy.02"].filter(e.no);
  const time = [...["restoration.01", "restoration.03"].filter(e.no), ...(e.endorsed("restoration.02") ? ["restoration.02"] : [])];
  const evidence = e.ev(...perm, ...time);
  if (perm.length && time.length) return { module: "rest-permission", side: "both", evidence };
  if (perm.length) return { module: "rest-permission", side: "permission", evidence };
  if (time.length >= 2) return { module: "rest-permission", side: "time", evidence };
  return { module: "rest-permission", side: "open", evidence };
}

/** Access vs know-how: knowing what restores you vs having the time, energy and room to do it. */
export function accessKnowhow(e: E): Decision<"access" | "knowhow"> {
  const know = ["restoration.05", "restoration.04", "body.04", "mind.04", "body.06"].filter(e.yes);
  const access = [...["restoration.01", "restoration.03", "body.01", "resources.06"].filter(e.no), ...(e.endorsed("restoration.02") ? ["restoration.02"] : [])];
  const evidence = e.ev(...know, ...access);
  if (know.length >= 2 && access.length >= 2) return { module: "access-knowhow", side: "access", evidence };
  if (access.length >= 2 && know.length === 0) return { module: "access-knowhow", side: "knowhow", evidence };
  return { module: "access-knowhow", side: "open", evidence };
}

/** Building a future vs experiencing the present. */
export function futurePresent(e: E): Decision<"future"> {
  const driving = (["growth", "social"] as OrbitId[]).filter((o) => e.c.important(o) || e.roles.demand === o || e.roles.source === o);
  const present = [...["joy.01", "joy.04", "joy.02"].filter(e.no), ...["restoration.03", "restoration.06"].filter(e.no)];
  const evidence = e.ev(...driving.map((o) => `${o}.importance`), ...present);
  return driving.length && present.length >= 2 ? { module: "future-present", side: "future", evidence } : { module: "future-present", side: "open", evidence };
}
