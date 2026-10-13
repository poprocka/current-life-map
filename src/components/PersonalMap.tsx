import { useEffect, useState } from "react";
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { SunGlyph, SystemDefs } from "./LifeSystem";
import { C, ORBIT_TINT, labelGeometry, mapViewBox, orbitAngle, orbitGeometry, SUN_R, ORBIT_MIN, ORBIT_MAX, R_NEUTRAL, R_CLOSE, R_FAR } from "./map-geometry";

// The Sun always stays the largest body: the biggest possible Orbit is ~60% of the Sun's radius (Jana, 2026-10-12)
export { orbitGeometry };

const IN = "#E0C26A"; // inflow: muted gold — energy coming in to you
const OUT = "#9DB8CC"; // outflow: soft light blue (Jana, 2026-10-12)
const STEADY = "#CDBDA9"; // stable: a quiet thread in light taupe

/**
 * Personalised Current Life Map.
 * size = direct importance · brightness = supportive-response proxy (vitality pending) ·
 * distance = congruence band (close / middle / far, F4 approved 13 Oct); neutral ring when unavailable
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
    <svg viewBox={mapViewBox(result.orbits).attr} overflow="visible" className="w-full" role="img"
      aria-label="Your Current Life Map. A text version follows below the legend.">
      <SystemDefs />
      <defs>
        <filter id="flowSoft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>

      {/* distance axes */}
      {/* One neutral ring when no Orbit has a distance; otherwise the close / middle / far rings */}
      {result.orbits.every((o) => o.distanceBand === null) ? (
        <circle cx={C} cy={C} r={R_NEUTRAL} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray="2 6" />
      ) : (
        // Three faint rings: close, middle, far (F4, approved 13 Oct)
        [R_CLOSE, R_NEUTRAL, R_FAR].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray="2 6" />
        ))
      )}

      {/* Trade-off path removed from the Map (Jana, 2026-10-12); still described in Energy Architecture */}
      {/* Energy flows for every Orbit (Jana, 2026-10-12): calm, minimal, like a breathing exercise.
          A slim ribbon of light on a gentle arc between the Sun and each planet. The arc softly sways,
          and one soft glow travels along it: gold toward the Sun (gives energy), beige toward the planet
          (takes energy). Stronger answers mean a slightly wider ribbon and a quicker glow. A stable answer
          is a fine, still thread that only breathes. Each Orbit has its own phase, so nothing pulses in sync.
          All motion is off under reduced motion. */}
      {ORBIT_IDS.map((id, i) => {
        const o = by[id];
        if (o.energySigned === null) return null;
        const g = orbitGeometry(o);
        const ux = Math.cos(g.a), uy = Math.sin(g.a);
        const px = -uy, py = ux;
        const mag = Math.abs(o.energySigned); // 0, 0.5 or 1
        const steady = mag === 0;
        const inward = o.energySigned > 0;
        const color = steady ? STEADY : inward ? IN : OUT;
        const r0 = SUN_R - 6, r1 = g.dist - g.size + 1.5, rm = (r0 + r1) / 2; // ends at the planet rim: no seam through translucent planets
        const w0 = steady ? 0.8 : 3 + mag * 2.5;
        const w1 = steady ? 0.6 : Math.max(1.6, g.size * 0.22);
        const wm = steady ? 0.5 : 0.9 + mag * 1.1;
        const ribbon = (bend: number) => {
          const P = (r: number, w: number, k = 0) => `${(C + ux * r + px * (w + k)).toFixed(1)},${(C + uy * r + py * (w + k)).toFixed(1)}`;
          return `M${P(r0, w0)} Q${P(rm, wm, bend)} ${P(r1, w1)} L${P(r1, -w1)} Q${P(rm, -wm, bend)} ${P(r0, -w0)} Z`;
        };
        const sway = (i % 2 ? 1 : -1) * (steady ? 4 : 7 + mag * 5);
        const dA = ribbon(sway * 0.35), dB = ribbon(sway);
        const phase = `-${(i * 1.7).toFixed(1)}s`;
        const ease = "0.45 0 0.55 1;0.45 0 0.55 1";
        const len = r1 - r0, dir = inward ? -1 : 1, from = inward ? r1 : r0;
        const gx = C + ux * from, gy = C + uy * from;
        const travel = len * 1.6;
        return (
          <g key={`e-${id}`}>
            {!steady && (
              <defs>
                <linearGradient id={`flow-${id}`} gradientUnits="userSpaceOnUse" spreadMethod="repeat"
                  x1={gx} y1={gy} x2={gx + ux * dir * travel} y2={gy + uy * dir * travel}>
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="30%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="50%" stopColor={color} stopOpacity={0.62 + mag * 0.25} />
                  <stop offset="70%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.18} />
                  {!reduceMotion && (
                    <animateTransform attributeName="gradientTransform" type="translate" begin={phase}
                      from="0 0" to={`${(ux * dir * travel).toFixed(1)} ${(uy * dir * travel).toFixed(1)}`} dur={`${mag === 1 ? 4.6 : 6.4}s`} repeatCount="indefinite" />
                  )}
                </linearGradient>
              </defs>
            )}
            <path d={dA} fill={steady ? color : `url(#flow-${id})`} opacity={steady ? 0.55 : 1} filter="url(#flowSoft)">
              {!reduceMotion && (
                <animate attributeName="d" values={`${dA};${dB};${dA}`} keyTimes="0;0.5;1" dur={steady ? "11s" : "8s"} begin={phase}
                  calcMode="spline" keySplines={ease} repeatCount="indefinite" />
              )}
              {!reduceMotion && steady && (
                <animate attributeName="opacity" values="0.35;0.7;0.35" keyTimes="0;0.5;1" dur="7s" begin={phase}
                  calcMode="spline" keySplines={ease} repeatCount="indefinite" />
              )}
            </path>
          </g>
        );
      })}

      <SunGlyph r={SUN_R} />
      {/* Just "You" on the Sun (Jana, 2026-10-12) */}
      <text x={C} y={C + 9} textAnchor="middle" fill="#1F1411" className="font-serif" fontSize={28}>You</text>

      {ORBIT_IDS.map((id) => {
        const o = by[id];
        const g = orbitGeometry(o);
        const { lx, ly, dy, anchor } = labelGeometry(o);
        return (
          <g key={id}>
            {/* No outlines around Orbits (Jana, 2026-10-12) */}
            <circle cx={g.x} cy={g.y} r={g.size} fill={ORBIT_TINT[id]} opacity={g.bright} />
            <circle cx={g.x} cy={g.y} r={g.size} fill="url(#planetShade)" opacity={g.bright} />
            <text x={lx} y={ly + dy}
              textAnchor={anchor} className="font-serif" fontSize={17} fill="#1F1411">{o.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Legend distinguishes active, proxy and pending indicators (spec §7.1).
 * distancePending: no Orbit has a distance (an earlier scoring version, or no congruence answers), so all sit on one ring.
 */
export function MapLegend({ distancePending = true, columns = 3 }: { distancePending?: boolean; columns?: 2 | 3 }) {
  const item = "flex items-start gap-3";
  // Wording by Jana (2026-10-12). Full width of the Map card: three columns, two rows (2026-10-13):
  // energy in | energy out | steady  /  brightness | distance | size.
  return (
    <div className={`grid gap-x-8 gap-y-4 text-[12.5px] leading-snug text-mahogany/80 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
      <div className={item}><Swatch><FlowSwatch color={IN} inward /></Swatch>
        <span><b className="font-normal text-mahogany">Energy in</b> — This Orbit gives you energy.</span></div>
      <div className={item}><Swatch><FlowSwatch color={OUT} /></Swatch>
        <span><b className="font-normal text-mahogany">Energy out</b> — This Orbit requires your energy.</span></div>
      <div className={item}><Swatch><line x1="2" y1="9" x2="28" y2="9" stroke={STEADY} strokeWidth="1.4" strokeLinecap="round" /></Swatch>
        <span><b className="font-normal text-mahogany">Steady</b> — This Orbit keeps your energy relatively balanced.</span></div>
      <div className={item}><Swatch><circle cx="9" cy="9" r="6" fill="#B7AC9B" opacity=".3" /><circle cx="22" cy="9" r="6" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Brightness</b> — How supported and fulfilling this Orbit feels in your current life, based on your answers.</span></div>
      <div className={item}><Swatch><circle cx="4" cy="9" r="3" fill="#D9B26A" /><circle cx="26" cy="9" r="4" fill="#B7AC9B" /><line x1="8" y1="9" x2="21" y2="9" stroke="#C2B3A3" strokeDasharray="2 2" /></Swatch>
        <span><b className="font-normal text-mahogany">Distance from the Sun</b> — How closely the way you live in this Orbit reflects what genuinely matters to you.
          {distancePending && <span className="text-taupe"> Not shown on this Map: every Orbit sits at the same distance.</span>}</span></div>
      <div className={item}><Swatch><circle cx="9" cy="9" r="4" fill="#B7AC9B" /><circle cx="22" cy="9" r="8" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Size</b> — How important this Orbit is to you at this stage of your life.</span></div>
    </div>
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
