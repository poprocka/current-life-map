"use client";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { ORBIT_TINT } from "@/components/LifeSystem";
import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { PersonalInsights } from "@/components/PersonalInsights";
import { QuestionBlock } from "@/components/QuestionBlock";
import { ENERGY_SHORT, IMPORTANCE_SHORT } from "@/lib/pdf/model";

/**
 * Exactly what the respondent sees (results page) — also rendered read-only in the coach workspace
 * from the frozen snapshot, so "Client's Map" is the same component and the same data.
 */
export function ResultsView({ result, insights, children, embedded, afterMap }: { result: LifeMapResult; insights?: ResultInsights; children?: React.ReactNode; embedded?: boolean; afterMap?: React.ReactNode }) {
  const Root = embedded ? "div" : "main";
  const byId = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const snapshot = result.snapshot.filter((s) => s.available);
  const distancePending = result.orbits.every((o) => o.distanceBand == null);

  return (
    <Root className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-10">
      {result.scoringStatus !== "approved" && (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-taupe">Preview · methodology under review</p>
      )}

      {/* A. Opening — a personalised reflection before any numbers (brief §4A) */}
      {insights && (
        <section className="mx-auto mt-10 max-w-[1000px] lg:mt-14" aria-labelledby="open-h">
          <p className="eyebrow text-center">Your Current Life Map</p>
          <h1 id="open-h" className="mt-3 text-center font-serif text-[32px] font-light leading-[1.1] [text-wrap:balance] sm:text-[40px]">{insights.opening.title}.</h1>
          {/* Two paragraphs side by side, left-aligned (Jana, 2026-10-13); the closing line of the reflection sits beneath */}
          <div className="mt-8 grid gap-6 text-left text-[15px] leading-[1.8] text-mahogany/85 [text-wrap:pretty] md:grid-cols-2 md:gap-12">
            {insights.opening.paragraphs.slice(0, 2).map((p, i) => <p key={i}>{p.text}</p>)}
          </div>
          {insights.opening.paragraphs.slice(2).map((p, i) => (
            <p key={i} className="mt-8 text-center font-serif text-[19px] italic leading-relaxed text-burgundy [text-wrap:balance] lg:[text-wrap:wrap]" /* one line where it fits, never wider than the two paragraphs (Jana, 2026-10-13) */>{p.text}</p>
          ))}
          {/* "What this is based on" removed from the page (Jana, 2026-10-13); the answers behind the theme stay in the stored record. */}
        </section>
      )}

      {/* B. Map — in its own block so it stands out (Jana, 2026-10-12) */}
      <section className="mt-12 rounded-[32px] border hairline bg-linen-deep/70 px-5 pb-10 pt-10 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_60px_-40px_rgba(84,15,38,0.25)] sm:px-10 lg:px-14 lg:pb-14 lg:pt-12 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36" aria-labelledby="map-h">
        <header className="mx-auto max-w-[640px] text-center">{/* ~33% wider lines (Jana, 2026-10-13) */}
          {!insights && <p className="eyebrow">Your Current Life Map</p>}
          <h2 id="map-h" className="font-serif text-[22px] font-light leading-snug [text-wrap:pretty] sm:text-[26px]">
            {insights?.mapIntro ?? "Here's how the different parts of your life look together, based on what you've shared."}
          </h2>
        </header>
        {/* Map and the right column (interpretation + table) are top-aligned (Jana, 2026-10-13); the legend sits under the Map */}
        <div className="mt-8 grid gap-12 lg:mt-4 lg:grid-cols-[1.45fr_1fr] lg:items-start lg:gap-x-16 lg:gap-y-8">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <PersonalMap result={result} />
          </div>
          {/* Second row, top-aligned (Jana, 2026-10-13): the legend as a 2 × 3 grid under the Map, the interpretation beside it */}
          <div className="min-w-0 border-t hairline pt-6 lg:col-start-1 lg:row-start-2 lg:self-start"><MapLegend distancePending={distancePending} columns={2} /></div>
          {/* The interpretation sits above the table, beside the Map (Jana, 2026-10-13) */}
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:pt-[64px]">{/* offset matches the space above the Map's top label, so both start on one line (Jana, 2026-10-13) */}
            {insights && insights.mapReading.paragraphs.length > 0 && (
              <div className="mb-8 space-y-3 text-[14px] leading-[1.75] text-mahogany/85">
                {insights.mapReading.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}
              </div>
            )}
            {/* Visible title removed (Jana, 2026-10-12); the table keeps an accessible name */}
            <MapTable result={result} />
          </div>
        </div>

      </section>

      {/* Book Your Session sits right below the Map (Jana, 2026-10-13) */}
      {afterMap}

      {/* C. What stands out — the Reality Snapshot, connected into one narrative (brief §4C) */}
      <section className="mt-24" aria-labelledby="snap-h">
        <p className="eyebrow">Reality Snapshot</p>
        <h2 id="snap-h" className="mt-3 font-serif text-[36px] font-light">{insights?.standsOut.title ?? "Where your life stands today"}</h2>
        {insights && <div className="mt-5 max-w-[820px] space-y-3 text-[14.5px] leading-[1.8] text-mahogany/85">{insights.standsOut.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>}
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

      {insights && (
        <div className="mt-24 grid gap-14 lg:grid-cols-2 lg:gap-16">
          {/* D. The Sun */}
          <section aria-labelledby="self-h">
            <p className="eyebrow">The Sun</p>
            <h2 id="self-h" className="mt-3 font-serif text-[32px] font-light leading-tight">{insights.self.title}</h2>
            <div className="mt-5 space-y-4 text-[14.5px] leading-[1.8] text-mahogany/85">{insights.self.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
            {insights.self.question && <QuestionBlock className="mt-5">{insights.self.question}</QuestionBlock>}
          </section>
          {/* E. Life Interconnections */}
          <section aria-labelledby="links-h">
            <p className="eyebrow">Life Interconnections</p>
            <h2 id="links-h" className="mt-3 font-serif text-[32px] font-light leading-tight">{insights.connections.title}</h2>
            <div className="mt-5 space-y-4 text-[14.5px] leading-[1.8] text-mahogany/85">{insights.connections.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
          </section>
        </div>
      )}

      {/* F + G. Five insight cards and the eight Orbits */}
      {insights && <PersonalInsights insights={insights} />}

      {/* H. A question worth taking with you */}
      {insights && (
        <section className="mx-auto mt-24 max-w-[760px] text-center" aria-labelledby="closing-h">
          <p id="closing-h" className="eyebrow">A question worth taking with you</p>
          <QuestionBlock size="lg" className="mt-5">{insights.closingQuestion.text}</QuestionBlock>
          {!embedded && afterMap && (
            <>
              <p className="mx-auto mt-6 max-w-[600px] text-[13.5px] leading-relaxed text-mahogany/70">{insights.deepDiveBridge}</p>
              {/* Primary CTA under the bridge text (Jana, 2026-10-13) */}
              <a href="#deep-dive" className="mt-6 inline-block rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany">Explore your Map with Jana</a>
            </>
          )}
        </section>
      )}

      {/* "Where attention may matter most" removed from the client view (Jana, 2026-10-12); still in the Coach Report and script */}
      {children}
    </Root>
  );
}

/** Orbit · Importance · Energy · Feelings — on the page beside the Map, and in the PDF. */
export function MapTable({ result }: { result: LifeMapResult }) {
  return (
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
  );
}
