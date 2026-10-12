/** Map geometry and palette shared by the on-screen Map (SVG) and the PDF. Plain TS: safe on the server. */
import type { OrbitId } from "@/content/types";
import { ORBIT_IDS } from "@/content/v10/chapters";
import type { OrbitResult } from "@/engine/compute";

export const ORBIT_TINT: Record<OrbitId, string> = {
  mind: "#A88E9B",
  body: "#E3A39A", // brighter blush pink (Jana, 2026-10-12)
  restoration: "#EBB88C", // soft peach (Jana, 2026-10-12)
  growth: "#E39651", // amber-orange, distinct from Sun gold (Jana, 2026-10-12)
  love: "#A4474B", // muted red (Jana, 2026-10-12)
  social: "#7F97AB", // dusty slate blue (Jana, 2026-10-12)
  resources: "#8FA585", // muted sage green (Jana, 2026-10-12)
  joy: "#DCCC7A", // muted lemon yellow, cooler than Sun gold (Jana, 2026-10-12)
};

export const C = 280; // centre of the 560 viewBox
export const RING = 196;

export function orbitAngle(i: number) {
  return (-90 + i * 45) * (Math.PI / 180);
}

export const SUN_R = 50;
export const ORBIT_MIN = 9;
export const ORBIT_MAX = 30;
export const R_MIN = 128;
export const R_MAX = 300;
/** Neutral orbit used while congruence (distance) is pending approval — spec §5.5 / flag F4. */
export const R_NEUTRAL = (R_MIN + R_MAX) / 2;

export function orbitGeometry(o: OrbitResult) {
  const i = ORBIT_IDS.indexOf(o.orbit);
  const a = orbitAngle(i);
  // Distance: personalised only when an approved congruence metric exists; otherwise fixed neutral placement.
  const dist = o.congruence === null ? R_NEUTRAL : R_MIN + (1 - o.congruence) * (R_MAX - R_MIN);
  // Size: direct stated importance; neutral size when unavailable.
  const size = ORBIT_MIN + (o.importanceDirect ?? 0.5) * (ORBIT_MAX - ORBIT_MIN);
  // Brightness: supportive-response proxy (labelled as such in the legend); muted when unavailable.
  const bright = o.responseSupportIndex === null ? 0.35 : 0.3 + o.responseSupportIndex * 0.7;
  return { a, dist, size, bright, x: C + dist * Math.cos(a), y: C + dist * Math.sin(a) };
}
