/** F4 safeguards (Jana, 13 Oct): the Sun stays visible, Orbits never overlap, labels never clip, three distinct rings. */
import { describe, it, expect } from "vitest";
import { ORBIT_IDS } from "@/content/v10/chapters";
import type { OrbitResult } from "@/engine/compute";
import { C, SUN_R, R_CLOSE, R_FAR, R_NEUTRAL, labelGeometry, mapViewBox, orbitGeometry } from "@/components/map-geometry";

const NAMES: Record<string, string> = { mind: "Mind", body: "Body", restoration: "Restoration", growth: "Growth", love: "Love", social: "Social World", resources: "Resources", joy: "Joy" };
type Band = "close" | "middle" | "far" | null;
const orbit = (id: string, band: Band, imp: number) =>
  ({ orbit: id, name: NAMES[id], distanceBand: band, importanceDirect: imp, responseSupportIndex: 0.5 }) as unknown as OrbitResult;
const BANDS: Band[] = ["close", "middle", "far"];

/** Every combination of bands, each tried with all-largest and alternating sizes. */
function* maps() {
  for (let n = 0; n < 3 ** 8; n++) {
    const bands = ORBIT_IDS.map((_, i) => BANDS[Math.floor(n / 3 ** i) % 3]);
    yield ORBIT_IDS.map((id, i) => orbit(id, bands[i], 1));
    yield ORBIT_IDS.map((id, i) => orbit(id, bands[i], i % 2 ? 1 : 0));
  }
}

describe("Map geometry with distance bands", () => {
  it("three visually distinct rings, with the neutral ring in the middle", () => {
    expect(R_CLOSE).toBeLessThan(R_NEUTRAL);
    expect(R_NEUTRAL).toBeLessThan(R_FAR);
    expect(R_NEUTRAL - R_CLOSE).toBeGreaterThan(40);
    expect(R_FAR - R_NEUTRAL).toBeGreaterThan(40);
  });
  it("no two Orbits overlap and none covers the Sun, in any combination of bands and sizes", () => {
    let checked = 0;
    for (const m of maps()) {
      const g = m.map(orbitGeometry);
      for (let i = 0; i < g.length; i++) {
        expect(g[i].dist - g[i].size).toBeGreaterThan(SUN_R + 20); // the Sun and its glow stay clear
        for (let j = i + 1; j < g.length; j++) expect(Math.hypot(g[i].x - g[j].x, g[i].y - g[j].y)).toBeGreaterThan(g[i].size + g[j].size + 8);
      }
      checked++;
    }
    expect(checked).toBe(2 * 3 ** 8);
  });
  it("every planet and label fits inside the frame, so nothing clips on a narrow screen", () => {
    for (const m of maps()) {
      const vb = mapViewBox(m);
      for (const o of m) {
        const g = orbitGeometry(o), L = labelGeometry(o);
        expect(g.x - g.size).toBeGreaterThanOrEqual(vb.x); expect(g.x + g.size).toBeLessThanOrEqual(vb.x + vb.width);
        expect(g.y - g.size).toBeGreaterThanOrEqual(vb.y); expect(g.y + g.size).toBeLessThanOrEqual(vb.y + vb.height);
        expect(L.box.x0).toBeGreaterThanOrEqual(vb.x); expect(L.box.x1).toBeLessThanOrEqual(vb.x + vb.width);
        expect(L.box.y0).toBeGreaterThanOrEqual(vb.y); expect(L.box.y1).toBeLessThanOrEqual(vb.y + vb.height);
      }
    }
  });
  it("the Sun stays centred in the frame, which is fitted to the planets and labels", () => {
    const vb = mapViewBox(ORBIT_IDS.map((id) => orbit(id, "far", 1)));
    expect(vb.x + vb.width / 2).toBe(C); expect(vb.y + vb.height / 2).toBe(C);
    expect(vb.size).toBeLessThan(680); // even an all-far, full-size Map keeps the picture within ~6% of its usual scale
  });
  it("labels never collide with a neighbouring planet", () => {
    for (const m of maps()) {
      const g = m.map(orbitGeometry);
      m.forEach((o, i) => {
        const b = labelGeometry(o).box;
        g.forEach((p, j) => {
          if (i === j) return;
          const nx = Math.max(b.x0, Math.min(p.x, b.x1)), ny = Math.max(b.y0, Math.min(p.y, b.y1));
          expect(Math.hypot(p.x - nx, p.y - ny)).toBeGreaterThan(p.size);
        });
      });
    }
  });
});
