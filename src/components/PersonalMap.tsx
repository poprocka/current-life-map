import { useEffect, useState } from "react";
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { C, ORBIT_TINT, SunGlyph, SystemDefs, orbitAngle } from "./LifeSystem";

// The Sun always stays the largest body: the biggest possible Orbit is ~60% of the Sun's radius (Jana, 2026-10-12)
const SUN_R = 50;
const ORBIT_MIN = 9;
const ORBIT_MAX = 30;
const R_MIN = 128;
const R_MAX = 300;

/** Neutral orbit used while congruence (distance) is pending approval — spec §5.5 / flag F4. */
const R_NEUTRAL = (R_MIN + R_MAX) / 2;

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

const IN = "#D9A23A"; // inflow: warm gold — energy coming in to you
const OUT = "#B04A63"; // outflow: deep rose — energy going out of you

/**
 * Personalised Current Life Map.
 * size = direct importance · brightness = supportive-response proxy (vitality pending) ·
 * distance = congruence when approved, otherwise neutral fixed placement
 * arrows = energy (toward the Sun = gives you energy; away = takes energy). (Trade-off is described in text, not drawn.)
 */
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    try {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduce(m.matches);
      const on = () => setReduce(m.matches);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    } catch { /* noop */ }
  }, []);
  return reduce;
}

export function PersonalMap({ result }: { result: LifeMapResult }) {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const reduceMotion = usePrefersReducedMotion();

  return (
    <svg viewBox="-40 -40 640 640" overflow="visible" className="w-full" role="img"
      aria-label="Your Current Life Map. A text version follows below the legend.">
      <SystemDefs />
      <defs>
        <filter id="flowSoft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>

      {/* distance axes */}
      {/* While distance is pending, one neutral orbit ring; distance axes return when congruence is approved */}
      {result.orbits.every((o) => o.congruence === null) ? (
        <circle cx={C} cy={C} r={R_NEUTRAL} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray="2 6" />
      ) : (
        [R_MIN, (R_MIN + R_MAX) / 2, R_MAX].map((r, i) => (
          <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray={i === 0 ? "1 4" : "2 6"} />
        ))
      )}

      {/* Trade-off path removed from the Map (Jana, 2026-10-12); still described in Energy Architecture */}
      {/* Energy as a solid, tapered shape filled with a soft gradient of light that streams smoothly
          (Jana, 2026-10-12): no dots, dashes or blobs. Gold streams in toward the Sun (energy in);
          rose streams out toward the planet (energy out). Width and brightness follow how much energy
          was reported; every flow moves at the same pace. Motion is off under reduced-motion settings. */}
      {ORBIT_IDS.map((id) => {
        const o = by[id];
        if (o.energySigned === null || o.energySigned === 0) return null;
        const g = orbitGeometry(o);
        const ux = Math.cos(g.a), uy = Math.sin(g.a);
        const px = -uy, py = ux;
        const nearR = SUN_R + 4, farR = g.dist - g.size - 4;
        const inward = o.energySigned > 0;
        const mag = Math.abs(o.energySigned); // 0.5 or 1
        const color = inward ? IN : OUT;
        // tapered: wider where the light arrives
        const wNear = inward ? 3 + mag * 3 : 1.2 + mag;
        const wFar = inward ? 1.2 + mag : 3 + mag * 3;
        const pt = (r: number, w: number, side: 1 | -1) => `${C + ux * r + px * w * side},${C + uy * r + py * w * side}`;
        const shape = [pt(nearR, wNear, 1), pt(farR, wFar, 1), pt(farR, wFar, -1), pt(nearR, wNear, -1)].join(" ");
        const from = inward ? farR : nearR;
        const dir = inward ? -1 : 1; // travel direction along the radius
        const period = Math.max(60, (farR - nearR) * 0.7);
        const gx = C + ux * from, gy = C + uy * from;
        return (
          <g key={`e-${id}`}>
            <defs>
              <linearGradient id={`flow-${id}`} gradientUnits="userSpaceOnUse" spreadMethod="repeat"
                x1={gx} y1={gy} x2={gx + ux * dir * period} y2={gy + uy * dir * period}>
                <stop offset="0%" stopColor={color} stopOpacity={0.3 + mag * 0.1} />
                <stop offset="50%" stopColor={color} stopOpacity={0.75 + mag * 0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.3 + mag * 0.1} />
                {!reduceMotion && (
                  <animateTransform attributeName="gradientTransform" type="translate"
                    from="0 0" to={`${ux * dir * period} ${uy * dir * period}`} dur="3.6s" repeatCount="indefinite" />
                )}
              </linearGradient>
            </defs>
            <polygon points={shape} fill={`url(#flow-${id})`} filter="url(#flowSoft)" />
          </g>
        );
      })}

      <SunGlyph r={SUN_R} />

      {ORBIT_IDS.map((id) => {
        const o = by[id];
        const g = orbitGeometry(o);
        const lx = C + (g.dist + g.size + 14) * Math.cos(g.a);
        const ly = C + (g.dist + g.size + 14) * Math.sin(g.a);
        const anchor = Math.abs(Math.cos(g.a)) < 0.2 ? "middle" : Math.cos(g.a) > 0 ? "start" : "end";
        return (
          <g key={id}>
            {/* No outlines around Orbits (Jana, 2026-10-12) */}
            <circle cx={g.x} cy={g.y} r={g.size} fill={ORBIT_TINT[id]} opacity={g.bright} />
            <circle cx={g.x} cy={g.y} r={g.size} fill="url(#planetShade)" opacity={g.bright} />
            <text x={lx} y={ly + (Math.sin(g.a) > 0.5 ? 10 : Math.sin(g.a) < -0.5 ? -2 : 4)}
              textAnchor={anchor} className="font-serif" fontSize={17} fill="#1F1411">{o.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Legend distinguishes active, proxy and pending indicators (spec §7.1).
 * distancePending: congruence is not yet approved, so every Orbit sits at the same distance.
 */
export function MapLegend({ distancePending = true }: { distancePending?: boolean }) {
  const item = "flex items-start gap-3";
  return (
    <ul className="grid gap-x-8 gap-y-3 text-[12.5px] leading-snug text-mahogany/80 sm:grid-cols-2">
      <li className={`${item} sm:col-span-2`}><Swatch><circle cx="4" cy="9" r="3" fill="#D9B26A" /><circle cx="26" cy="9" r="4" fill="#B7AC9B" /><line x1="8" y1="9" x2="21" y2="9" stroke="#C2B3A3" strokeDasharray="2 2" /></Swatch>
        <span><b className="font-normal text-mahogany">Distance from the Sun</b> — {distancePending
          ? <>will show how connected each area is to your authentic self. <span className="text-taupe">Not shown yet: every Orbit sits at the same distance while this measure is being finalised.</span></>
          : "the closer an area is, the more connected it is to your authentic self"}</span></li>
      <li className={item}><Swatch><circle cx="9" cy="9" r="4" fill="#B7AC9B" /><circle cx="22" cy="9" r="8" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Size</b> — how important the area is to you right now</span></li>
      <li className={item}><Swatch><circle cx="9" cy="9" r="6" fill="#B7AC9B" opacity=".3" /><circle cx="22" cy="9" r="6" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Brightness</b> — how alive and supported this area feels, based on your answers to its statements</span></li>
      <li className={item}><Swatch><FlowSwatch color={IN} inward /></Swatch>
        <span><b className="font-normal text-mahogany">Energy in</b> — <span style={{ color: IN }}>gold</span> light streaming toward the Sun: this area gives you energy</span></li>
      <li className={item}><Swatch><FlowSwatch color={OUT} /></Swatch>
        <span><b className="font-normal text-mahogany">Energy out</b> — <span style={{ color: OUT }}>rose</span> light streaming away from the Sun: this area takes energy. Wider, brighter light means more energy</span></li>
    </ul>
  );
}

function FlowSwatch({ color, inward = false }: { color: string; inward?: boolean }) {
  const id = inward ? "lg-in" : "lg-out";
  // Sun side is on the left of the swatch
  const pts = inward ? "2,4 28,7.5 28,10.5 2,14" : "2,7.5 28,4 28,14 2,10.5";
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" spreadMethod="repeat" x1={inward ? 28 : 2} y1="9" x2={inward ? 10 : 20} y2="9">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="50%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.35" />
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to={inward ? "-18 0" : "18 0"} dur="1.8s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <polygon points={pts} fill={`url(#${id})`} />
    </>
  );
}

function Swatch({ children }: { children: React.ReactNode }) {
  return <svg aria-hidden width="30" height="18" viewBox="0 0 30 18" className="mt-0.5 shrink-0">{children}</svg>;
}
