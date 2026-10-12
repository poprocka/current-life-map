"use client";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { ORBIT_TINT } from "@/components/LifeSystem";
import type { LifeMapResult } from "@/engine/compute";
import { OPENING } from "@/content/v10/opening";
import type { ResultInsights } from "@/engine/insights";
import { PersonalInsights } from "@/components/PersonalInsights";
import { ENERGY_SHORT, IMPORTANCE_SHORT, MAP_INTRO, energyInsightsOf } from "@/lib/pdf/model";

/**
 * Exactly what the respondent sees (results page) — also rendered read-only in the coach workspace
 * from the frozen snapshot, so "Client's Map" is the same component and the same data.
 */
export function ResultsView({ result, insights, children, embedded }: { result: LifeMapResult; insights?: ResultInsights; children?: React.ReactNode; embedded?: boolean }) {
  const Root = embedded ? "div" : "main";
  const byId = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const giving = result.orbits.filter((o) => (o.energySigned ?? 0) > 0);
  const taking = result.orbits.filter((o) => (o.energySigned ?? 0) < 0);
  const snapshot = result.snapshot.filter((s) => s.available);
  const distancePending = result.orbits.every((o) => o.congruence === null);
  // Feelings are quoted only for Orbits already in the energy story, so the list stays specific (spec §9 rule 7).
  const energyInsights = energyInsightsOf(result);

  return (
    <Root className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-10">
      {result.scoringStatus !== "approved" && (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-taupe">Preview · methodology under review</p>
      )}

      {/* 1. Map — in its own block so it stands out (Jana, 2026-10-12) */}
      <section className="mt-8 rounded-[32px] border hairline bg-linen-deep/70 px-5 pb-10 pt-10 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_60px_-40px_rgba(84,15,38,0.25)] sm:px-10 lg:mt-10 lg:px-14 lg:pb-14 lg:pt-14 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36" aria-labelledby="map-h">
        <header className="mx-auto max-w-[600px] text-center">
          <p className="eyebrow">Your Current Life Map</p>
          <h1 id="map-h" className="mt-3 font-serif text-[28px] font-light leading-[1.1] [text-wrap:balance] sm:text-[34px]">{OPENING.title}</h1>
          <p className="mx-auto mt-3 max-w-[540px] text-[13px] leading-relaxed text-mahogany/75 [text-wrap:pretty]">
            {MAP_INTRO}
          </p>
        </header>
        {/* Map and table share a row and are centred against each other; the legend sits under the Map (Jana, 2026-10-12) */}
        <div className="mt-4 grid gap-12 lg:mt-2 lg:grid-cols-[1.45fr_1fr] lg:items-center lg:gap-x-16 lg:gap-y-2">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <PersonalMap result={result} />
          </div>
          <div className="min-w-0 border-t hairline pt-6 lg:col-start-1 lg:row-start-2"><MapLegend distancePending={distancePending} /></div>
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            {/* Visible title removed (Jana, 2026-10-12); the table keeps an accessible name */}
            <div className="overflow-x-auto">
              <table aria-label="Map interpretation" className="w-full text-left text-[12.5px] text-mahogany/85">
                <thead className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">
                  <tr>
                    <th scope="col" className="pb-3 pr-3 font-normal">Orbit</th>
                    <th scope="col" className="pb-3 pr-3 font-normal">Importance</th>
                    <th scope="col" className="pb-3 pr-3 font-normal">Energy</th>
                    <th scope="col" className="pb-3 font-normal">Feelings</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orbits.map((o) => (
                    <tr key={o.orbit} className="border-t hairline align-top">
                      <th scope="row" className="py-3 pr-3 font-normal">
                        <span className="flex items-center gap-2 whitespace-nowrap font-serif text-[15px] text-mahogany">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: ORBIT_TINT[o.orbit] }} />
                          {o.name}
                        </span>
                      </th>
                      <td className="py-3 pr-3">{o.importanceOrdinal === null ? "—" : IMPORTANCE_SHORT[o.importanceOrdinal - 1]}</td>
                      <td className="py-3 pr-3">{o.energyRaw === null ? "—" : ENERGY_SHORT[o.energyRaw]}</td>
                      <td className="py-3 text-taupe">{o.emotions.length ? o.emotions.map((e) => e.label).join(", ") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Reality Snapshot — only cards with real evidence are shown (spec §7.2) */}
      <section className="mt-24" aria-labelledby="snap-h">
        <p className="eyebrow">Reality Snapshot</p>
        <h2 id="snap-h" className="mt-3 font-serif text-[36px] font-light">Where your life stands today</h2>
        <div className="mt-10 grid border-l border-t hairline sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.map((s) => (
            <article key={s.key} className="border-b border-r hairline p-7">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-3 font-serif text-[30px] font-light">{s.orbits.map((id) => byId[id].name).join(" · ")}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-mahogany/75">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Personal insights (Decision Guide): five evidence-led cards + eight Orbits. Energy Architecture now lives in its card. */}
      {insights && <PersonalInsights insights={insights} />}

      {/* "Where attention may matter most" removed from the client view (Jana, 2026-10-12); still in the Coach Report and script */}
      {children}
    </Root>
  );
}
