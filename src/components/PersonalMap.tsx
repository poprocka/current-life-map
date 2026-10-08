import type { LifeMapResult, OrbitMetrics } from "@/engine/compute";
import { ORBIT_IDS } from "@/content/v10/chapters";
import { C, ORBIT_TINT, SunGlyph, SystemDefs, orbitAngle } from "./LifeSystem";

const R_MIN = 96;
const R_MAX = 252;
const SUN_R = 38;

export function orbitGeometry(o: OrbitMetrics) {
  const i = ORBIT_IDS.indexOf(o.orbit);
  const a = orbitAngle(i);
  const dist = o.congruence === null ? R_MAX + 18 : R_MIN + (1 - o.congruence) * (R_MAX - R_MIN);
  const size = 9 + (o.importance ?? 0.25) * 22;
  const bright = o.vitality === null ? 0.35 : 0.28 + o.vitality * 0.72;
  return { a, dist, size, bright, x: C + dist * Math.cos(a), y: C + dist * Math.sin(a) };
}

const IN = "#B8924A";
const OUT = "#540F26";

/**
 * Personalised Current Life Map.
 * size = importance · brightness = vitality · distance from the Sun = congruence (closer = more connected)
 * arrows = energy (toward the Sun = gives you energy; away = takes energy) · dashed path = reported trade-off.
 */
export function PersonalMap({ result }: { result: LifeMapResult }) {
  const by = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const demand = result.orbits.find((o) => o.selections.largestDemand);
  const crowded = result.orbits.find((o) => o.selections.crowdedOut);

  return (
    <svg viewBox="-60 -30 680 620" className="w-full" role="img"
      aria-label="Your Current Life Map. A text version follows below the legend.">
      <SystemDefs />
      <defs>
        {[["in", IN], ["out", OUT]].map(([k, c]) => (
          <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9" fill="none" stroke={c} strokeWidth="1.4" />
          </marker>
        ))}
      </defs>

      {/* distance axes */}
      {[R_MIN, (R_MIN + R_MAX) / 2, R_MAX].map((r, i) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray={i === 0 ? "1 4" : "2 6"} />
      ))}
      <text x={C + 4} y={C - R_MIN - 5} fontSize={9} fill="#9C8A7A" letterSpacing="0.12em">CLOSER TO YOU</text>
      <text x={C + 4} y={C - R_MAX - 5} fontSize={9} fill="#9C8A7A" letterSpacing="0.12em">FURTHER FROM YOU</text>

      {/* reported trade-off */}
      {demand && crowded && demand.orbit !== crowded.orbit && (() => {
        const g1 = orbitGeometry(demand), g2 = orbitGeometry(crowded);
        return (
          <path d={`M${g1.x},${g1.y} Q${C},${C} ${g2.x},${g2.y}`} fill="none" stroke="#9C8A7A"
            strokeWidth={0.9} strokeDasharray="3 5" opacity={0.8} />
        );
      })()}

      {/* energy arrows */}
      {ORBIT_IDS.map((id) => {
        const o = by[id];
        if (o.energy === null || o.energy === 0) return null;
        const g = orbitGeometry(o);
        const ux = Math.cos(g.a), uy = Math.sin(g.a);
        const p1 = { x: C + (SUN_R + 12) * ux, y: C + (SUN_R + 12) * uy };
        const p2 = { x: C + (g.dist - g.size - 8) * ux, y: C + (g.dist - g.size - 8) * uy };
        const inward = o.energy > 0;
        const [from, to] = inward ? [p2, p1] : [p1, p2];
        return (
          <line key={`e-${id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={inward ? IN : OUT} strokeWidth={0.8 + Math.abs(o.energy) * 1.4}
            strokeDasharray={inward ? undefined : "5 3"}
            markerEnd={`url(#arrow-${inward ? "in" : "out"})`} opacity={0.85} />
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
            {o.selections.leverage && <circle cx={g.x} cy={g.y} r={g.size + 7} fill="none" stroke={IN} strokeWidth={0.9} />}
            <circle cx={g.x} cy={g.y} r={g.size} fill={ORBIT_TINT[id]} opacity={g.bright}
              strokeDasharray={o.evidence === "insufficient" ? "2 3" : undefined}
              stroke={o.evidence === "insufficient" ? "#9C8A7A" : "none"} />
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
      <li className={item}><Swatch><circle cx="9" cy="9" r="4" fill="#B7AC9B" /><circle cx="22" cy="9" r="8" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Size</b> — how important the area is to you right now</span></li>
      <li className={item}><Swatch><circle cx="9" cy="9" r="6" fill="#B7AC9B" opacity=".3" /><circle cx="22" cy="9" r="6" fill="#B7AC9B" /></Swatch>
        <span><b className="font-normal text-mahogany">Brightness</b> — how supported the area is in what's happening and how you relate to it</span></li>
      <li className={item}><Swatch><circle cx="4" cy="9" r="3" fill="#D9B26A" /><circle cx="26" cy="9" r="4" fill="#B7AC9B" /><line x1="8" y1="9" x2="21" y2="9" stroke="#C2B3A3" strokeDasharray="2 2" /></Swatch>
        <span><b className="font-normal text-mahogany">Distance from the Sun</b> — closer means it feels more your own</span></li>
      <li className={item}><Swatch><line x1="2" y1="6" x2="28" y2="6" stroke={IN} strokeWidth="1.6" /><line x1="2" y1="13" x2="28" y2="13" stroke={OUT} strokeWidth="1.6" strokeDasharray="4 2" /></Swatch>
        <span><b className="font-normal text-mahogany">Arrows</b> — solid gold toward the Sun: gives you energy. Dashed burgundy outward: takes energy</span></li>
      <li className={item}><Swatch><circle cx="15" cy="9" r="4" fill="#B7AC9B" /><circle cx="15" cy="9" r="7.5" fill="none" stroke={IN} /></Swatch>
        <span><b className="font-normal text-mahogany">Gold ring</b> — the area you chose as having the most influence on the rest</span></li>
      <li className={item}><Swatch><path d="M2 14 Q15 0 28 14" fill="none" stroke="#9C8A7A" strokeDasharray="3 3" /></Swatch>
        <span><b className="font-normal text-mahogany">Dashed path</b> — the trade-off you described between two areas</span></li>
    </ul>
  );
}

function Swatch({ children }: { children: React.ReactNode }) {
  return <svg aria-hidden width="30" height="18" viewBox="0 0 30 18" className="mt-0.5 shrink-0">{children}</svg>;
}
