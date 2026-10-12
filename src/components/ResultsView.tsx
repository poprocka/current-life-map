"use client";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { ORBIT_TINT } from "@/components/LifeSystem";
import type { LifeMapResult } from "@/engine/compute";
import { OPENING } from "@/content/v10/opening";
import { ENERGY_SHORT, IMPORTANCE_SHORT, MAP_INTRO, energyInsightsOf } from "@/lib/pdf/model";

/**
 * Exactly what the respondent sees (results page) — also rendered read-only in the coach workspace
 * from the frozen snapshot, so "Client's Map" is the same component and the same data.
 */
export function ResultsView({ result, children, embedded }: { result: LifeMapResult; children?: React.ReactNode; embedded?: boolean }) {
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
      <section className="mt-8 rounded-[32px] border hairline bg-linen-deep/70 px-5 pb-10 pt-10 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_60px_-40px_rgba(84,15,38,0.25)] sm:px-10 lg:mt-10 lg:px-14 lg:pb-14 lg:pt-14 xl:-mx-20" aria-labelledby="map-h">
        <header className="mx-auto max-w-[600px] text-center">
          <p className="eyebrow">Your Current Life Map</p>
          <h1 id="map-h" className="mt-3 font-serif text-[28px] font-light leading-[1.1] [text-wrap:balance] sm:text-[34px]">{OPENING.title}</h1>
          <p className="mx-auto mt-3 max-w-[540px] text-[13px] leading-relaxed text-mahogany/75 [text-wrap:pretty]">
            {MAP_INTRO}
          </p>
        </header>
        <div className="mt-4 grid gap-12 lg:mt-2 lg:grid-cols-[1.7fr_1fr] lg:items-start lg:gap-24">
          <div className="min-w-0">
            <PersonalMap result={result} />
            <div className="mt-8 border-t hairline pt-6"><MapLegend distancePending={distancePending} /></div>
          </div>
          <div className="min-w-0 lg:pt-10">
            <h2 className="eyebrow">Map interpretation</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[12.5px] text-mahogany/85">
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

      {/* 3. Energy Architecture — what was reported, then evidence-backed observations */}
      <section className="mt-24 grid gap-12 lg:grid-cols-2" aria-labelledby="energy-h">
        <div>
          <p className="eyebrow">Energy Architecture</p>
          <h2 id="energy-h" className="mt-3 font-serif text-[36px] font-light">Where your energy goes</h2>
          <h3 className="mt-8 text-[11px] uppercase tracking-[0.16em] text-burgundy">What you reported</h3>
          <ul className="mt-4 space-y-2 text-[14px] leading-relaxed">
            <li><span className="text-taupe">Gives you energy: </span>{giving.length ? giving.map((o) => o.name).join(", ") : "none of the eight areas"}</li>
            <li><span className="text-taupe">Takes energy: </span>{taking.length ? taking.map((o) => o.name).join(", ") : "none of the eight areas"}</li>
            {result.interconnections.overallSupport && (
              <li><span className="text-taupe">How the areas relate: </span>{result.interconnections.overallSupport.label}</li>
            )}
          </ul>
        </div>
        <div className="lg:pt-[92px]">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-burgundy">What the Map suggests — to explore, not conclude</h3>
          <ul className="mt-4 space-y-4 text-[14px] leading-relaxed text-mahogany/85">
            {energyInsights.map((i) => (
              <li key={i.id}>{i.body}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Attention — qualitative candidates only until the ranking method is approved (spec §5.6) */}
      <section className="mt-24" aria-labelledby="att-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Where Attention May Matter Most</p>
            <h2 id="att-h" className="mt-3 font-serif text-[36px] font-light">Areas you may want to look at more closely</h2>
          </div>
          <details className="max-w-[420px] text-[12.5px] leading-relaxed text-mahogany/75">
            <summary className="cursor-pointer text-taupe underline underline-offset-4">How these are chosen</summary>
            <p className="mt-3">
              These areas come from what you told us directly: the area you chose as a possible leverage point, areas you said
              receive less care or get less time than you would like, areas that matter a great deal and take a lot of energy,
              and areas where your answers suggest more or less support. They are not ranked. Attention does not mean
              something is wrong.
            </p>
          </details>
        </div>
        <ul className="mt-10 border-t hairline">
          {result.attention.candidates.map((c) => (
            <li key={c.orbit} className="grid gap-4 border-b hairline py-6 sm:grid-cols-[240px_1fr]">
              <span className="flex items-center gap-3 font-serif text-[26px] font-light">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ORBIT_TINT[c.orbit] }} />
                {c.name}
              </span>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-mahogany/80">
                {c.reasons.map((r) => <li key={r.id}>{r.body}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {children}
    </Root>
  );
}
