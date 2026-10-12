import type { ChapterId, OrbitId } from "@/content/types";
import { ORBIT_IDS, chapterById } from "@/content/v10/chapters";

export const ORBIT_TINT: Record<OrbitId, string> = {
  mind: "#A88E9B",
  body: "#E3A39A", // brighter blush pink (Jana, 2026-10-12)
  restoration: "#B7AC9B",
  growth: "#E39651", // amber-orange, distinct from Sun gold (Jana, 2026-10-12)
  love: "#A4474B", // muted red (Jana, 2026-10-12)
  social: "#7F97AB", // dusty slate blue (Jana, 2026-10-12)
  resources: "#8FA585", // muted sage green (Jana, 2026-10-12)
  joy: "#DCCC7A", // muted lemon yellow, cooler than Sun gold (Jana, 2026-10-12)
};

/** Left-panel background (linen-deep at 60% over linen), used to mask lines behind planets */
const PANEL_BG = "#F0E6D8";

export const C = 280; // centre of the 560 viewBox
export const RING = 196;

export function orbitAngle(i: number) {
  return (-90 + i * 45) * (Math.PI / 180);
}

const SUN_RAYS = [
  { r: 58, w: 1, o: 0.7, dash: undefined },
  { r: 70, w: 0.8, o: 0.45, dash: undefined },
  { r: 84, w: 0.7, o: 0.28, dash: "1 4" },
  { r: 100, w: 0.6, o: 0.16, dash: "1 6" },
];

const ORBIT_RAYS = [
  { r: 25, w: 0.4, o: 0.38, dash: undefined },
  { r: 30.5, w: 0.35, o: 0.26, dash: undefined },
  { r: 37, w: 0.45, o: 0.32, dash: "1 3" },
  { r: 44, w: 0.4, o: 0.18, dash: "1 4" },
];

/**
 * Soft beam from the Sun to the active Orbit: a tapered, slightly blurred wedge whose colour
 * melts from Sun gold (hidden under the Sun) into the planet's tint.
 */
function Beam({ id, a }: { id: OrbitId; a: number }) {
  const ux = Math.cos(a), uy = Math.sin(a);
  const px = -uy, py = ux; // perpendicular
  const start = 30; // begins inside the Sun's rim and fades in, so it grows out of the Sun's light
  const end = RING - 30; // stops just before the planet's glow
  const w0 = 1.6, w1 = 0.35;
  const pts = [
    [C + ux * start + px * w0, C + uy * start + py * w0],
    [C + ux * end + px * w1, C + uy * end + py * w1],
    [C + ux * end - px * w1, C + uy * end - py * w1],
    [C + ux * start - px * w0, C + uy * start - py * w0],
  ].map((p) => p.join(",")).join(" ");
  return (
    <g>
      <defs>
        <linearGradient id={`beam-${id}`} gradientUnits="userSpaceOnUse"
          x1={C + ux * start} y1={C + uy * start} x2={C + ux * end} y2={C + uy * end}>
          <stop offset="0%" stopColor="#E3C98E" stopOpacity="0" />
          <stop offset="12%" stopColor="#E3C98E" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#E3C98E" stopOpacity="0.22" />
          <stop offset="100%" stopColor={ORBIT_TINT[id]} stopOpacity="0.32" />
        </linearGradient>
        <filter id={`beamBlur-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <polygon points={pts} fill={`url(#beam-${id})`} filter={`url(#beamBlur-${id})`} />
    </g>
  );
}

export function SunGlyph({ r = 46, glow = true, ring = true }: { r?: number; glow?: boolean; ring?: boolean }) {
  return (
    <g>
      {glow && <circle cx={C} cy={C} r={r * 2.1} fill="url(#sunHalo)" />}
      <circle cx={C} cy={C} r={r} fill="url(#sunCore)" />
      {ring && <circle cx={C} cy={C} r={r + 7} fill="none" stroke="#B8924A" strokeWidth={0.5} opacity={0.6} />}
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
 * `active` highlights the current chapter during the self-interview; transitions are CSS so the
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
    <svg viewBox={labels === "full" ? "-125 -15 810 590" : labels === "name" ? "-70 -20 700 600" : "44 44 472 472"}
      className={className} overflow="visible" role="img" aria-label={title}>
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
          <g key={`l-${id}`} style={{ transition: "opacity 600ms ease" }} opacity={on ? 1 : 0.2}>
            {active === id ? (
              <Beam id={id} a={a} />
            ) : (
              <line x1={C} y1={C} x2={C + RING * Math.cos(a)} y2={C + RING * Math.sin(a)} stroke="#B8924A" strokeWidth={0.5} opacity={0.45} />
            )}
            {/* Planet-to-planet lines: intro illustration and Life Interconnections only (Jana, 2026-10-12) */}
            {(labels !== "none" || active === "interconnections") && (
              <line
                x1={C + RING * Math.cos(a)} y1={C + RING * Math.sin(a)}
                x2={C + RING * Math.cos(b)} y2={C + RING * Math.sin(b)}
                stroke="#C2B3A3" strokeWidth={0.5}
                opacity={active === "interconnections" ? 0.9 : 0.35}
                style={{ transition: "opacity 600ms ease" }}
              />
            )}
          </g>
        );
      })}

      <g style={{ transition: "opacity 600ms ease, transform 600ms ease", transformOrigin: `${C}px ${C}px` }}
         opacity={sunActive || allActive ? 1 : 0.35} transform={sunActive ? "scale(1.3)" : undefined}>
        {sunActive && <circle cx={C} cy={C} r={165} fill="url(#sunHalo)" />}
        <SunGlyph r={labels === "full" ? 60 : 42} glow={sunActive || !active} ring={!sunActive} />
        {/* Active Sun: rings radiate outward and fade, like sunshine (Jana, 2026-10-12) */}
        {sunActive && SUN_RAYS.map((ray) => (
          <circle key={ray.r} cx={C} cy={C} r={ray.r} fill="none" stroke="#C9A24E"
            strokeWidth={ray.w} opacity={ray.o} strokeDasharray={ray.dash} />
        ))}
        {labels === "full" && (
          <text x={C} y={C - 6} textAnchor="middle" fill="#1F1411">
            <tspan x={C} className="font-serif" fontSize={28}>You</tspan>
            <tspan x={C} dy={17} className="font-sans" fontSize={8} letterSpacing="0.14em" opacity={0.85}>RELATIONSHIP</tspan>
            <tspan x={C} dy={11} className="font-sans" fontSize={8} letterSpacing="0.14em" opacity={0.85}>WITH YOURSELF</tspan>
          </text>
        )}
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
          <g key={id}>
          {/* Opaque backing so orbit rings and lines stay hidden behind muted planets (Jana, 2026-10-12) */}
          <circle cx={x} cy={y} r={19.5} fill={PANEL_BG} />
          <g style={{ transition: "opacity 600ms ease" }} opacity={on ? 1 : 0.18}>
            <g style={{ transition: "transform 600ms cubic-bezier(.2,.7,.2,1)", transformOrigin: `${x}px ${y}px` }}
               transform={focus ? "scale(1.7)" : undefined}>
              {/* Active Orbit: light spreads in the planet's own colour, like the Sun (Jana, 2026-10-12) */}
              {focus && (
                <>
                  <defs>
                    <radialGradient id={`glow-${id}`}>
                      {/* eased falloff so the glow dissolves smoothly to 0% (Jana, 2026-10-12) */}
                      <stop offset="0%" stopColor={ORBIT_TINT[id]} stopOpacity="0.5" />
                      <stop offset="25%" stopColor={ORBIT_TINT[id]} stopOpacity="0.34" />
                      <stop offset="50%" stopColor={ORBIT_TINT[id]} stopOpacity="0.16" />
                      <stop offset="75%" stopColor={ORBIT_TINT[id]} stopOpacity="0.05" />
                      <stop offset="100%" stopColor={ORBIT_TINT[id]} stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx={x} cy={y} r={82} fill={`url(#glow-${id})`} />
                  {ORBIT_RAYS.map((ray) => (
                    <circle key={ray.r} cx={x} cy={y} r={ray.r} fill="none" stroke={ORBIT_TINT[id]}
                      strokeWidth={ray.w} opacity={ray.o} strokeDasharray={ray.dash} />
                  ))}
                </>
              )}
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
          </g>
        );
      })}
    </svg>
  );
}
