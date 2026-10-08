import type { ChapterId, OrbitId } from "@/content/types";
import { ORBIT_IDS, chapterById } from "@/content/v10/chapters";

export const ORBIT_TINT: Record<OrbitId, string> = {
  mind: "#A88E9B",
  body: "#D9B4A6",
  restoration: "#B7AC9B",
  growth: "#C9A562",
  love: "#8E3B52",
  social: "#9C8473",
  resources: "#7B685A",
  joy: "#E2BFA6",
};

export const C = 280; // centre of the 560 viewBox
export const RING = 196;

export function orbitAngle(i: number) {
  return (-90 + i * 45) * (Math.PI / 180);
}

export function SunGlyph({ r = 46, glow = true }: { r?: number; glow?: boolean }) {
  return (
    <g>
      {glow && <circle cx={C} cy={C} r={r * 2.1} fill="url(#sunHalo)" />}
      <circle cx={C} cy={C} r={r} fill="url(#sunCore)" />
      <circle cx={C} cy={C} r={r + 7} fill="none" stroke="#B8924A" strokeWidth={0.5} opacity={0.6} />
    </g>
  );
}

export function SystemDefs() {
  return (
    <defs>
      <radialGradient id="sunCore" cx="40%" cy="36%" r="70%">
        <stop offset="0%" stopColor="#F4DFA8" />
        <stop offset="60%" stopColor="#D9B26A" />
        <stop offset="100%" stopColor="#B8924A" />
      </radialGradient>
      <radialGradient id="sunHalo">
        <stop offset="0%" stopColor="#E3C98E" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#E3C98E" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="planetShade" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * Neutral, unpersonalised Life System illustration.
 * `active` highlights the current chapter during the Self-Interview; transitions are CSS so the
 * system stays mounted and moves continuously from one area to the next.
 */
export function LifeSystem({
  active,
  labels = "full",
  className = "",
  title = "The Life System: the Sun, Relationship With Self, at the centre, with eight Orbits around it.",
}: {
  active?: ChapterId;
  labels?: "full" | "name" | "none";
  className?: string;
  title?: string;
}) {
  const sunActive = active === "sun";
  const allActive = !active || active === "interconnections";
  return (
    <svg viewBox={labels === "full" ? "-150 -20 860 600" : labels === "name" ? "-70 -20 700 600" : "20 20 520 520"}
      className={className} role="img" aria-label={title}>
      <SystemDefs />
      {/* dashed ring axes */}
      <circle cx={C} cy={C} r={RING} fill="none" stroke="#C2B3A3" strokeWidth={0.6} strokeDasharray="2 6" />
      <circle cx={C} cy={C} r={128} fill="none" stroke="#C2B3A3" strokeWidth={0.5} strokeDasharray="1 5" opacity={0.7} />
      <circle cx={C} cy={C} r={250} fill="none" stroke="#DDCFBD" strokeWidth={0.5} opacity={0.8} />

      {/* connecting lines */}
      {ORBIT_IDS.map((id, i) => {
        const a = orbitAngle(i), b = orbitAngle(i + 1);
        const on = allActive || active === id;
        return (
          <g key={`l-${id}`} style={{ transition: "opacity 600ms ease" }} opacity={on ? 1 : 0.35}>
            <line x1={C} y1={C} x2={C + RING * Math.cos(a)} y2={C + RING * Math.sin(a)} stroke="#B8924A" strokeWidth={0.5} opacity={0.45} />
            <line
              x1={C + RING * Math.cos(a)} y1={C + RING * Math.sin(a)}
              x2={C + RING * Math.cos(b)} y2={C + RING * Math.sin(b)}
              stroke="#C2B3A3" strokeWidth={0.5}
              opacity={active === "interconnections" ? 0.9 : 0.35}
              style={{ transition: "opacity 600ms ease" }}
            />
          </g>
        );
      })}

      <g style={{ transition: "opacity 600ms ease, transform 600ms ease", transformOrigin: `${C}px ${C}px` }}
         opacity={sunActive || allActive ? 1 : 0.55} transform={sunActive ? "scale(1.12)" : undefined}>
        <SunGlyph r={42} glow={sunActive || !active} />
      </g>

      {ORBIT_IDS.map((id, i) => {
        const a = orbitAngle(i);
        const x = C + RING * Math.cos(a), y = C + RING * Math.sin(a);
        const on = allActive || active === id;
        const focus = active === id;
        const ch = chapterById(id);
        const lx = C + (RING + 46) * Math.cos(a), ly = C + (RING + 46) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        const dy = Math.sin(a) < -0.5 ? -6 : Math.sin(a) > 0.5 ? 14 : 4;
        return (
          <g key={id} style={{ transition: "opacity 600ms ease" }} opacity={on ? 1 : 0.32}>
            <g style={{ transition: "transform 600ms cubic-bezier(.2,.7,.2,1)", transformOrigin: `${x}px ${y}px` }}
               transform={focus ? "scale(1.45)" : undefined}>
              {focus && <circle cx={x} cy={y} r={27} fill="none" stroke="#540F26" strokeWidth={0.5} />}
              <circle cx={x} cy={y} r={19} fill={ORBIT_TINT[id]} />
              <circle cx={x} cy={y} r={19} fill="url(#planetShade)" />
            </g>
            {labels !== "none" && (
              <text x={lx} y={ly + dy} textAnchor={anchor} className="font-serif" fontSize={19} fill="#1F1411">
                {ch.name}
                {labels === "full" && (
                  <tspan x={lx} dy={17} fontSize={10} letterSpacing="0.14em" fill="#9C8A7A" className="font-sans">
                    {ch.subtitle.toUpperCase()}
                  </tspan>
                )}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
