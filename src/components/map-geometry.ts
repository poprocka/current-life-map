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
export const R_MAX = 270;
/** Neutral orbit: no congruence answer (or scoring versions before provisional-2). */
export const R_NEUTRAL = (R_MIN + R_MAX) / 2;
/** F4 (approved 13 Oct): three positions, 15% in from the inner and outer limits — no continuous scale. */
export const R_CLOSE = R_MIN + 0.15 * (R_MAX - R_MIN);
export const R_FAR = R_MAX - 0.15 * (R_MAX - R_MIN);
export const BAND_RADIUS = { close: R_CLOSE, middle: R_NEUTRAL, far: R_FAR } as const;

export function orbitGeometry(o: OrbitResult) {
  const i = ORBIT_IDS.indexOf(o.orbit);
  const a = orbitAngle(i);
  // Distance: the Orbit's congruence band; neutral ring when there isn't enough information.
  const dist = o.distanceBand ? BAND_RADIUS[o.distanceBand] : R_NEUTRAL;
  // Size: direct stated importance; neutral size when unavailable.
  const size = ORBIT_MIN + (o.importanceDirect ?? 0.5) * (ORBIT_MAX - ORBIT_MIN);
  // Brightness: supportive-response proxy (labelled as such in the legend); muted when unavailable.
  const bright = o.responseSupportIndex === null ? 0.35 : 0.3 + o.responseSupportIndex * 0.7;
  return { a, dist, size, bright, x: C + dist * Math.cos(a), y: C + dist * Math.sin(a) };
}

/** Where an Orbit's name sits: just outside the planet, anchored away from the Sun. */
export function labelGeometry(o: OrbitResult, fontSize = 17) {
  const g = orbitGeometry(o);
  const w = o.name.length * fontSize * 0.52; // serif estimate; generous so labels never clip
  // Orbits on the horizontal axis carry their name underneath, so a far Orbit doesn't push the frame wider
  // (and shrink the whole Map) — 13 Oct, with distance bands.
  if (Math.abs(Math.cos(g.a)) > 0.9) {
    const lx = g.x, ly = g.y + g.size + 6, dy = fontSize;
    return { lx, ly, dy, anchor: "middle" as const, box: { x0: lx - w / 2, x1: lx + w / 2, y0: ly + dy - fontSize, y1: ly + dy + 4 } };
  }
  const lx = C + (g.dist + g.size + 14) * Math.cos(g.a);
  const ly = C + (g.dist + g.size + 14) * Math.sin(g.a);
  const anchor: "middle" | "start" | "end" = Math.abs(Math.cos(g.a)) < 0.2 ? "middle" : Math.cos(g.a) > 0 ? "start" : "end";
  const x0 = anchor === "middle" ? lx - w / 2 : anchor === "start" ? lx : lx - w;
  const dy = Math.sin(g.a) > 0.5 ? 10 : Math.sin(g.a) < -0.5 ? -2 : 4;
  return { lx, ly, dy, anchor, box: { x0, x1: x0 + w, y0: ly + dy - fontSize, y1: ly + dy + 4 } };
}

/**
 * ViewBox centred on the Sun that fits every planet and label, so a far Orbit's name is never cut off on a narrow screen
 * and the Map scales as one picture. Width and height are fitted separately (still centred on the Sun), so there is no
 * empty band above or below the Map and the legend can sit close beneath it (Jana, 2026-10-13).
 */
export function mapViewBox(orbits: OrbitResult[], min = 300, pad = 12) {
  let hx = min, hy = 0;
  for (const o of orbits) {
    const g = orbitGeometry(o), L = labelGeometry(o);
    hx = Math.max(hx, Math.abs(g.x - C) + g.size + pad, Math.abs(L.box.x0 - C) + pad, Math.abs(L.box.x1 - C) + pad);
    hy = Math.max(hy, Math.abs(g.y - C) + g.size + pad, Math.abs(L.box.y0 - C) + pad, Math.abs(L.box.y1 - C) + pad);
  }
  hx = Math.ceil(hx); hy = Math.ceil(Math.max(hy, SUN_R * 2.6));
  return { x: C - hx, y: C - hy, width: 2 * hx, height: 2 * hy, size: 2 * hx, attr: `${C - hx} ${C - hy} ${2 * hx} ${2 * hy}` };
}
