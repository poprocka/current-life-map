import { useEffect, useState } from "react";
import type { LifeMapResult, OrbitResult } from "@/engine/compute";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { SunGlyph, SystemDefs } from "./LifeSystem";
import { C, ORBIT_TINT, labelGeometry, mapViewBox, orbitAngle, orbitGeometry, SUN_R, ORBIT_MIN, ORBIT_MAX, R_NEUTRAL, R_CLOSE, R_FAR } from "./map-geometry";

// The Sun always stays the largest body: the biggest possible Orbit is ~60% of the Sun's radius (Jana, 2026-10-12)
export { orbitGeometry };

const IN = "#FFD445"; // inflow: bright, luminous yellow — this Orbit gives you energy (Jana, 2026-10-13)
const OUT = "#D29E36"; // outflow: deeper sun yellow — this Orbit draws energy from the Sun (Jana, 2026-10-13)
const STEADY = "#E6CE86"; // stable: a fine, still thread of soft yellow (Jana, 2026-10-13)
/** Muted arrowheads inside the tubes show the direction at a glance, also in the still PDF (Jana, 2026-10-13). */
const IN_ARROW = "#A8831C";
const OUT_ARROW = "#8A6224";

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

export function PersonalMap({ result, still = false }: { result: LifeMapResult; still?: boolean }) {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const prefersReduced = usePrefersReducedMotion();
  const reduceMotion = still || prefersReduced; // `still`: the PDF, where nothing moves

  return (
    <svg viewBox={mapViewBox(result.orbits).attr} overflow="visible" className="w-full" role="img"
      aria-label="Your Current Life Map. A text version follows below the legend.">
      <SystemDefs />
      <defs>
        <filter id="flowSoft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
        <filter id="flowGlow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="4" />
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
          and one soft glow travels along it: bright yellow toward the Sun (gives energy), deeper yellow out
          toward the planet (takes energy). Energy given gathers as a glow around the Sun. Stronger answers mean a slightly wider ribbon and a quicker glow. A stable answer
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
        const ribbon = (bend: number, wide = 1) => {
          const P = (r: number, w: number, k = 0) => `${(C + ux * r + px * (w * wide + k)).toFixed(1)},${(C + uy * r + py * (w * wide + k)).toFixed(1)}`;
          return `M${P(r0, w0)} Q${P(rm, wm, bend)} ${P(r1, w1)} L${P(r1, -w1)} Q${P(rm, -wm, bend)} ${P(r0, -w0)} Z`;
        };
        const sway = (i % 2 ? 1 : -1) * (steady ? 4 : 7 + mag * 5);
        const dA = ribbon(sway * 0.35), dB = ribbon(sway);
        const phase = `-${(i * 1.7).toFixed(1)}s`;
        const ease = "0.45 0 0.55 1;0.45 0 0.55 1";
        const len = r1 - r0, dir = inward ? -1 : 1, from = inward ? r1 : r0;
        const gx = C + ux * from, gy = C + uy * from;
        const travel = len * 1.6;
        // Centre line of the tube (quadratic, like the ribbon) — arrowheads ride on it and sway with it.
        const centre = (t: number, bend: number) => {
          const q = 2 * t * (1 - t);
          const r = (1 - t) * (1 - t) * r0 + q * rm + t * t * r1;
          return { x: C + ux * r + px * q * bend, y: C + uy * r + py * q * bend };
        };
        const arrowTs = mag === 1 ? [0.3, 0.52, 0.74] : [0.38, 0.66];
        const rot = (g.a * 180) / Math.PI + (inward ? 180 : 0);
        const aScale = (0.85 + mag * 0.35) * (still ? 1.45 : 1); // larger in the PDF, where nothing moves
        return (
          <g key={`e-${id}`}>
            {!steady && (
              <defs>
                <linearGradient id={`flow-${id}`} gradientUnits="userSpaceOnUse" spreadMethod="repeat"
                  x1={gx} y1={gy} x2={gx + ux * dir * travel} y2={gy + uy * dir * travel}>
                  {reduceMotion ? (
                    // Still (PDF, reduced motion): light builds toward where the energy goes
                    <>
                      <stop offset="0%" stopColor={color} stopOpacity={inward ? 0.4 : 0.25} />
                      <stop offset={`${Math.round((len / travel) * 100)}%`} stopColor={color} stopOpacity={inward ? 0.95 : 0.6 + mag * 0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={inward ? 0.95 : 0.6 + mag * 0.3} />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                      <stop offset="30%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="50%" stopColor={color} stopOpacity={0.62 + mag * 0.25} />
                      <stop offset="70%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.18} />
                    </>
                  )}
                  {!reduceMotion && (
                    <animateTransform attributeName="gradientTransform" type="translate" begin={phase}
                      from="0 0" to={`${(ux * dir * travel).toFixed(1)} ${(uy * dir * travel).toFixed(1)}`} dur={`${inward ? (mag === 1 ? 2.9 : 3.8) : mag === 1 ? 4.6 : 6.4}s`} repeatCount="indefinite" />
                  )}
                </linearGradient>
              </defs>
            )}
            {/* Energy in: an infused halo of light around the tube that breathes, so giving Orbits stand out (Jana, 2026-10-13) */}
            {inward && (
              <path d={ribbon(sway * 0.35, 2.6)} fill={IN} opacity={still ? 0.28 : 0.22} filter="url(#flowGlow)">
                {!reduceMotion && (
                  <>
                    <animate attributeName="d" values={`${ribbon(sway * 0.35, 2.6)};${ribbon(sway, 2.6)};${ribbon(sway * 0.35, 2.6)}`} keyTimes="0;0.5;1" dur="8s" begin={phase}
                      calcMode="spline" keySplines={ease} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.14;0.36;0.14" keyTimes="0;0.5;1" dur={mag === 1 ? "2.9s" : "3.8s"} begin={phase}
                      calcMode="spline" keySplines={ease} repeatCount="indefinite" />
                  </>
                )}
              </path>
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
            {/* Arrowheads: still in the PDF and under reduced motion; otherwise they glide along the tube in the direction
                of the energy, fading in and out at the ends (Jana, 2026-10-13) */}
            {!steady && reduceMotion && arrowTs.map((t, k) => {
              const a = centre(t, sway * 0.35);
              return (
                <path key={k} d="M-4.2 -2.2 L1.8 0 L-4.2 2.2" fill="none" stroke={inward ? IN_ARROW : OUT_ARROW} strokeWidth={1.2}
                  strokeLinecap="round" strokeLinejoin="round" opacity={still ? 0.75 : 0.55}
                  transform={`translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${aScale.toFixed(2)})`} />
              );
            })}
            {!steady && !reduceMotion && (() => {
              const bend = sway * 0.35;
              const P = (r: number, k = 0) => `${(C + ux * r + px * k).toFixed(1)},${(C + uy * r + py * k).toFixed(1)}`;
              const [ra, rb] = inward ? [r1 - 4, r0 + 8] : [r0 + 8, r1 - 4];
              const track = `M${P(ra)} Q${P(rm, bend)} ${P(rb)}`;
              // Subtle (Jana, 2026-10-13): a small cluster of arrowheads, close together, drifting slowly along the tube
              const dur = inward ? (mag === 1 ? 7 : 8.5) : mag === 1 ? 9 : 11;
              const trackLen = Math.abs(rb - ra), gap = 9; // ≈9 map units between arrowheads
              const m = centre(0.5, sway), m0 = centre(0.5, bend);
              return (
                <g>
                  {/* follow the tube's slow sway so the arrowheads stay inside it */}
                  <animateTransform attributeName="transform" type="translate" values={`0 0;${((m.x - m0.x) * 0.5).toFixed(2)} ${((m.y - m0.y) * 0.5).toFixed(2)};0 0`}
                    keyTimes="0;0.5;1" dur="8s" begin={phase} calcMode="spline" keySplines={ease} repeatCount="indefinite" />
                  {arrowTs.map((_, k) => {
                    const begin = `${((k * gap * dur) / trackLen - i * 0.9).toFixed(2)}s`;
                    return (
                      <path key={k} d="M-4.2 -2.2 L1.8 0 L-4.2 2.2" fill="none" stroke={inward ? IN_ARROW : OUT_ARROW} strokeWidth={1.2 / aScale}
                        strokeLinecap="round" strokeLinejoin="round" opacity={0} transform={`scale(${aScale.toFixed(2)})`}>
                        <animateMotion path={track} dur={`${dur}s`} begin={begin} rotate="auto" repeatCount="indefinite" calcMode="linear" />
                        <animate attributeName="opacity" values="0;0.45;0.45;0" keyTimes="0;0.2;0.8;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
                      </path>
                    );
                  })}
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* Energy given gathers around the Sun as a soft circle of light: wider and brighter the more your Orbits give
          (Jana, 2026-10-13). It breathes slowly; still under reduced motion and in the PDF. */}
      {(() => {
        const given = result.orbits.reduce((t, o) => t + Math.max(0, o.energySigned ?? 0), 0);
        if (!given) return null;
        const r = SUN_R * (2.1 + 0.32 * Math.min(given, 5));
        const a = Math.min(0.75, 0.4 + 0.07 * given);
        return (
          <g aria-hidden>
            <defs>
              <radialGradient id="sunGathered">
                <stop offset="0%" stopColor={IN} stopOpacity={a} />
                <stop offset="45%" stopColor={IN} stopOpacity={a * 0.45} />
                <stop offset="100%" stopColor={IN} stopOpacity={0} />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={r} fill="url(#sunGathered)">
              {!reduceMotion && <animate attributeName="r" values={`${r * 0.94};${r};${r * 0.94}`} dur="9s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
            </circle>
          </g>
        );
      })()}
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
export function MapLegend({ distancePending = true, columns = 3 }: { distancePending?: boolean; columns?: 1 | 2 | 3 }) {
  const item = "flex items-start gap-3";
  // Wording by Jana (2026-10-12). Full width of the Map card: three columns, two rows (2026-10-13):
  // energy in | energy out | steady  /  brightness | distance | size.
  return (
    <div className={`grid gap-x-8 gap-y-4 text-[12.5px] leading-snug text-mahogany/80 ${columns === 1 ? "" : "sm:grid-cols-2"} ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
      <div className={item}><Swatch><FlowSwatch color={IN} inward /></Swatch>
        <span><b className="font-normal text-mahogany">Energy in</b> — This Orbit gives you energy. It gathers as a glow around the Sun.</span></div>
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
      {/* the same muted arrowhead as on the Map: toward the Sun (left) for energy in, away from it for energy out */}
      <path d={inward ? "M17 6 L13 9 L17 12" : "M13 6 L17 9 L13 12"} fill="none" stroke={inward ? IN_ARROW : OUT_ARROW} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
    </>
  );
}

function Swatch({ children }: { children: React.ReactNode }) {
  return <svg aria-hidden width="30" height="18" viewBox="0 0 30 18" className="mt-0.5 shrink-0">{children}</svg>;
}
