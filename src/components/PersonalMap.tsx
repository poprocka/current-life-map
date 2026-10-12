import type { LifeMapResult, OrbitMetrics } from "@/engine/compute";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { C, ORBIT_TINT, SunGlyph, SystemDefs, orbitAngle } from "./LifeSystem";

// The Sun always stays the largest body: the biggest possible Orbit is ~60% of the Sun's radius (Jana, 2026-10-12)
const SUN_R = 50;
const ORBIT_MIN = 9;
const ORBIT_MAX = 30;
const R_MIN = 128;
const R_MAX = 300;

export function orbitGeometry(o: OrbitMetrics) {
  const i = ORBIT_IDS.indexOf(o.orbit);
  const a = orbitAngle(i);
  const dist = o.congruence === null ? R_MAX + 18 : R_MIN + (1 - o.congruence) * (R_MAX - R_MIN);
  const size = ORBIT_MIN + (o.importance ?? 0.25) * (ORBIT_MAX - ORBIT_MIN);
  const bright = o.vitality === null ? 0.35 : 0.28 + o.vitality * 0.72;
  return { a, dist, size, bright, x: C + dist * Math.cos(a), y: C + dist * Math.sin(a) };
}

const IN = "#D9A23A"; // inflow: warm gold — energy coming in to you
const OUT = "#B04A63"; // outflow: deep rose — energy going out of you

/**
 * Personalised Current Life Map.
 * size = importance · brightness = vitality · distance from the Sun = congruence (closer = more connected)
 * arrows = energy (toward the Sun = gives you energy; away = takes energy). (Trade-off is described in text, not drawn.)
 */
export function PersonalMap({ result }: { result: LifeMapResult }) {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));

  return (
    <svg viewBox="-40 -40 640 640" overflow="visible" className="w-full" role="img"
      aria-label="Your Current Life Map. A text version follows below the legend.">
      <SystemDefs />
      <defs>
        <filter id="flowSoft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        <filter id="flowGlow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <filter id="trackSoft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="800">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* distance axes */}
      {[R_MIN, (R_MIN + R_MAX) / 2, R_MAX].map((r, i) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray={i === 0 ? "1 4" : "2 6"} />
      ))}

      {/* Trade-off path removed from the Map (Jana, 2026-10-12); still described in Energy Architecture */}
      {/* Energy as soft, slowly flowing light (Jana, 2026-10-12).
          Giving energy: warm gold light drifts in toward the Sun. Taking energy: muted rose light drifts out.
          Constant speed for every flow; strength (size, opacity) follows how much energy was reported.
          Motion pauses under reduced-motion settings. */}
      {ORBIT_IDS.map((id) => {
        const o = by[id];
        if (o.energy === null || o.energy === 0) return null;
        const g = orbitGeometry(o);
        const ux = Math.cos(g.a), uy = Math.sin(g.a);
        const near = { x: C + (SUN_R + 6) * ux, y: C + (SUN_R + 6) * uy };
        const far = { x: C + (g.dist - g.size - 6) * ux, y: C + (g.dist - g.size - 6) * uy };
        const inward = o.energy > 0;
        const [from, to] = inward ? [far, near] : [near, far];
        const mag = Math.abs(o.energy); // 0.5 or 1
        const color = inward ? IN : OUT;
        const d = `M${from.x},${from.y} L${to.x},${to.y}`;
        return (
          <g key={`e-${id}`}>
            <defs>
              <linearGradient id={`track-${id}`} gradientUnits="userSpaceOnUse" x1={near.x} y1={near.y} x2={far.x} y2={far.y}>
                <stop offset="0%" stopColor="#E3C98E" stopOpacity="0.55" />
                <stop offset="100%" stopColor={ORBIT_TINT[id]} stopOpacity="0.35" />
              </linearGradient>
            </defs>
            {/* soft track */}
            <path d={d} stroke={`url(#track-${id})`} strokeWidth={3 + mag * 3} strokeLinecap="round" fill="none"
              filter="url(#trackSoft)" opacity={0.55} />
            {/* steady beam of the flow colour, so the light never breaks */}
            <path d={d} stroke={color} strokeWidth={1.6 + mag * 1.2} strokeLinecap="round" fill="none" opacity={0.28 + mag * 0.12} filter="url(#flowSoft)" />
            {/* light travelling along it: long, very soft pulses streaming continuously in one direction */}
            <path d={d} className="energy-flow" stroke={color} strokeWidth={3.4 + mag * 2} strokeLinecap="round" fill="none"
              strokeDasharray="38 22" filter="url(#flowGlow)" opacity={0.45 + mag * 0.3}
              style={{ animationDuration: "3.6s" }} />
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

export function MapLegend() {
  const item = "flex items-start gap-3";
  return (
    <ul className="grid gap-x-8 gap-y-3 text-[12.5px] leading-snug text-mahogany/80 sm:grid-cols-2">
      <li className={`${item} sm:col-span-2`}><Swatch><circle cx="4" cy="9" r="3" fill="#D9B26A" /><circle cx="26" cy="9" r="4" fill="#B7AC9B" /><line x1="8" y1="9" x2="21" y2="9" stroke="#C2B3A3" strokeDasharray="2 2" /></Swatch>
        <span><b className="font-normal text-mahogany">Distance from the Sun</b> — the closer an area is, the more connected it is to your authentic self</span></li>
      <li className={item}><Swatch><circle cx="9" cy="9" r="4" fill="#B7AC9B" /><circle cx="22" cy="9" r="8" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Size</b> — how important the area is to you right now</span></li>
      <li className={item}><Swatch><circle cx="9" cy="9" r="6" fill="#B7AC9B" opacity=".3" /><circle cx="22" cy="9" r="6" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Brightness</b> — how alive and healthy this area of your life feels right now</span></li>
      <li className={item}><Swatch>
          <line x1="2" y1="9" x2="28" y2="9" stroke={IN} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 6" className="energy-flow-sm" style={{ animationDuration: "1.6s", filter: "blur(0.8px)" }} />
        </Swatch>
        <span><b className="font-normal text-mahogany">Energy in</b> — <span style={{ color: IN }}>gold</span> light flowing toward the Sun: this area gives you energy</span></li>
      <li className={item}><Swatch>
          <line x1="2" y1="9" x2="28" y2="9" stroke={OUT} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 6" className="energy-flow-sm" style={{ animationDuration: "1.6s", animationDirection: "reverse", filter: "blur(0.8px)" }} />
        </Swatch>
        <span><b className="font-normal text-mahogany">Energy out</b> — <span style={{ color: OUT }}>rose</span> light flowing away from the Sun: this area takes energy. Stronger light means more energy</span></li>
    </ul>
  );
}

function Swatch({ children }: { children: React.ReactNode }) {
  return <svg aria-hidden width="30" height="18" viewBox="0 0 30 18" className="mt-0.5 shrink-0">{children}</svg>;
}
