// Five fictional respondents for the Narrative Intelligence review (15 Oct). Truth items 0–4 (0 = Not true for me … 4 = Completely true),
// importance 0–4, energy −2…2, emotions = option values, Interconnections = Orbit ids.
import { NOT_APPLICABLE } from "@/content/types";
type O = { t: number[]; imp: number; cong: number; en: number; emo: string[] };
type P = { label: string; sun: number[]; orbits: Record<string, O>; ic: string[] };
const NA = NOT_APPLICABLE;

export const PROFILES: Record<string, P> = {
  p1: { label: "Ambitious but Under-Restored",
    sun: [3, 3, 1, 4, 2, 2, 3, 3, 2, 0, 3],
    orbits: {
      mind: { t: [1, 2, 3, 1, 3, 2, 2], imp: 3, cong: 2, en: -1, emo: ["busyness", "pressure", "clarity"] },
      body: { t: [1, 2, 2, 1, 2, 2, 2], imp: 3, cong: 1, en: 0, emo: ["tension", "depletion"] },
      restoration: { t: [1, 4, 0, 1, 1, 0], imp: 3, cong: 0, en: -1, emo: ["rush", "depletion", "restlessness"] },
      growth: { t: [4, 3, 1, 4, 3, 1], imp: 4, cong: 4, en: 2, emo: ["momentum", "excitement", "impatience"] },
      love: { t: [3, 2, 1, 2, 3, 2], imp: 2, cong: 2, en: 0, emo: ["longing", "tenderness"] },
      social: { t: [3, 3, 3, 1, 1, 2, 3], imp: 4, cong: 3, en: -1, emo: ["recognition", "stretch", "drain"] },
      resources: { t: [3, 3, 2, 3, 1, 3], imp: 2, cong: 3, en: 0, emo: ["stability", "capability"] },
      joy: { t: [1, 0, 1, 1, 3, 2], imp: 2, cong: 1, en: 1, emo: ["guilt", "aliveness"] },
    },
    ic: ["social", "growth", "restoration", "restoration", "joy", "social", "somewhat_compete"] },
  p2: { label: "Stable but Questioning Direction",
    sun: [1, 3, 3, 2, 3, 2, 3, 2, 3, 3, 1],
    orbits: {
      mind: { t: [2, 3, 1, 3, 2, 2, 3], imp: 3, cong: 2, en: 0, emo: ["neutrality", "rumination", "openness"] },
      body: { t: [3, 3, 3, 3, 3, 3, 3], imp: 2, cong: 3, en: 1, emo: ["ease", "capability"] },
      restoration: { t: [3, 1, 3, 3, 3, 3], imp: 2, cong: 3, en: 1, emo: ["calm", "care"] },
      growth: { t: [1, 1, 3, 1, 1, 3], imp: 3, cong: 1, en: 0, emo: ["stagnation", "uncertainty", "hope"] },
      love: { t: [3, 3, 3, 2, 3, 3], imp: 3, cong: 3, en: 1, emo: ["safety", "ease", "connection"] },
      social: { t: [3, 3, 2, 2, 1, 2, 3], imp: 3, cong: 1, en: 0, emo: ["support", "ease"] },
      resources: { t: [4, 3, 4, 3, 3, 2], imp: 3, cong: 2, en: 0, emo: ["security", "stability", "constraint"] },
      joy: { t: [2, 3, 1, 1, 2, 1], imp: 3, cong: 1, en: 0, emo: ["boredom", "restlessness", "peace"] },
    },
    ic: ["social", "love", "growth", "joy", "growth", "resources", "mix"] },
  p3: { label: "Connected but Limited in Agency",
    sun: [1, 3, 2, 1, 1, 0, 2, 2, 3, 1, 3],
    orbits: {
      mind: { t: [1, 2, 1, 2, 4, 3, 1], imp: 3, cong: 2, en: -1, emo: ["rumination", "unease"] },
      body: { t: [2, 2, 2, 2, 2, 2, 2], imp: 2, cong: 2, en: 0, emo: ["neutrality", "tension"] },
      restoration: { t: [2, 3, 1, 2, 2, 1], imp: 2, cong: 1, en: 0, emo: ["restlessness", "care"] },
      growth: { t: [2, 1, 4, 1, 1, 3], imp: 3, cong: 1, en: 0, emo: ["hope", "uncertainty"] },
      love: { t: [2, 1, 3, 2, 1, 2], imp: 4, cong: 2, en: 1, emo: ["connection", "tenderness", "uncertainty"] },
      social: { t: [4, 4, 1, 2, 3, 4, 2], imp: 4, cong: 1, en: 1, emo: ["connection", "belonging", "self-consciousness"] },
      resources: { t: [2, 2, 3, 1, 3, 2], imp: 2, cong: 2, en: 0, emo: ["uncertainty", "stability"] },
      joy: { t: [2, 2, 2, 2, 1, 1], imp: 2, cong: 1, en: 0, emo: ["peace", "disconnection"] },
    },
    ic: ["love", "social", "mind", "growth", "growth", "social", "mostly_support"] },
  p4: { label: "Challenged but Aligned",
    sun: [4, 4, 3, 3, 3, 3, 4, 3, 3, 2, 4],
    orbits: {
      mind: { t: [2, 3, 4, 3, 2, 3, 2], imp: 3, cong: 3, en: 0, emo: ["clarity", "pressure"] },
      body: { t: [1, 2, 1, 3, 2, 3, 2], imp: 3, cong: 3, en: -1, emo: ["depletion", "tension", "strength"] },
      restoration: { t: [1, 3, 1, 2, 3, 2], imp: 3, cong: 2, en: -1, emo: ["depletion", "care"] },
      growth: { t: [2, 4, 1, 2, 3, 1], imp: 2, cong: 3, en: 0, emo: ["stretch", "hope"] },
      love: { t: [NA as unknown as number, NA as unknown as number, 1, 2, 4, 3], imp: 2, cong: 3, en: 0, emo: ["longing", "ease"] },
      social: { t: [3, 4, 3, 1, 3, 3, 4], imp: 4, cong: 4, en: -1, emo: ["support", "connection", "drain"] },
      resources: { t: [3, 1, 2, 2, 1, 1], imp: 4, cong: 3, en: -2, emo: ["pressure", "constraint", "capability"] },
      joy: { t: [2, 2, 2, 2, 4, 2], imp: 2, cong: 3, en: 1, emo: ["peace", "delight"] },
    },
    ic: ["resources", "social", "body", "restoration", "restoration", "body", "somewhat_compete"] },
  p5: { label: "Relatively Harmonious",
    sun: [3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 4],
    orbits: {
      mind: { t: [3, 3, 4, 3, 1, 3, 3], imp: 3, cong: 4, en: 1, emo: ["clarity", "peace", "curiosity"] },
      body: { t: [3, 3, 3, 3, 3, 3, 3], imp: 3, cong: 3, en: 1, emo: ["energy", "ease"] },
      restoration: { t: [3, 1, 3, 3, 4, 3], imp: 3, cong: 3, en: 1, emo: ["restfulness", "replenishment"] },
      growth: { t: [3, 3, 1, 3, 4, 0], imp: 3, cong: 4, en: 1, emo: ["curiosity", "inspiration"] },
      love: { t: [4, 3, 3, 3, 4, 3], imp: 4, cong: 4, en: 2, emo: ["connection", "safety", "tenderness"] },
      social: { t: [3, 4, 3, 2, 3, 3, 4], imp: 3, cong: 3, en: 0, emo: ["connection", "belonging", "stretch"] },
      resources: { t: [3, 3, 4, 3, 1, 3], imp: 2, cong: 3, en: 0, emo: ["security", "groundedness"] },
      joy: { t: [4, 3, 3, 3, 4, 3], imp: 3, cong: 4, en: 2, emo: ["delight", "playfulness"] },
    },
    ic: ["social", "joy", "body", "growth", "growth", "social", "strongly_support"] },
};

export function answersOf(p: P): Record<string, string | string[]> {
  const a: Record<string, string | string[]> = {};
  p.sun.forEach((v, i) => (a[`sun.${String(i + 1).padStart(2, "0")}`] = String(v)));
  for (const [o, d] of Object.entries(p.orbits)) {
    d.t.forEach((v, i) => (a[`${o}.${String(i + 1).padStart(2, "0")}`] = String(v)));
    a[`${o}.importance`] = String(d.imp); a[`${o}.congruence`] = String(d.cong); a[`${o}.energy`] = String(d.en); a[`${o}.emotion`] = d.emo;
  }
  p.ic.forEach((v, i) => (a[`interconnections.${String(i + 1).padStart(2, "0")}`] = v));
  return a;
}
