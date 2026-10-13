"use client";
import { CONTACT_EMAIL, CONTACT_INVITE } from "@/content/contact";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { ORBIT_TINT } from "@/components/LifeSystem";
import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { OrbitList, PersonalInsights } from "@/components/PersonalInsights";
import { QuestionBlock } from "@/components/QuestionBlock";
import { SectionTabs } from "@/components/SectionTabs";
import { useBooking } from "@/lib/useBooking";
import { ENERGY_SHORT, IMPORTANCE_SHORT } from "@/lib/pdf/model";
import { useEffect, useState } from "react";
import { snapshotFingerprint } from "@/lib/stable";

/**
 * Exactly what the respondent sees (results page) — also rendered read-only in the coach workspace
 * from the frozen snapshot, so "Client's Map" is the same component and the same data.
 */
export function ResultsView({ result, insights, children, embedded, afterMap, token }: { result: LifeMapResult; insights?: ResultInsights; children?: React.ReactNode; embedded?: boolean; afterMap?: React.ReactNode; token?: string }) {
  const Root = embedded ? "div" : "main";
  const byId = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const snapshot = result.snapshot.filter((s) => s.available);
  const distancePending = result.orbits.every((o) => o.distanceBand == null);
  // "Show Map interpretation" opens the written reading under the table (Jana, 2026-10-13)
  const [readingOpen, setReadingOpen] = useState(false);
  const hasReading = !!insights && insights.mapReading.paragraphs.length > 0;
  // The same reference is printed on the PDF, so the page and the PDF can be matched (Jana, 2026-10-13)
  const [reference, setReference] = useState<string | null>(null);
  useEffect(() => { let on = true; snapshotFingerprint(result).then((f) => on && setReference(f.slice(0, 12))).catch(() => undefined); return () => { on = false; }; }, [result]);

  return (
    <Root className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-10">
      {result.scoringStatus !== "approved" && (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-taupe">Preview · methodology under review</p>
      )}

      {/* A. Opening — a personalised reflection before any numbers (brief §4A) */}
      {insights && (
        <div className="xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36">{/* 30% wider opening, 1000 → 1300px (Jana, 2026-10-13); may extend to the Map card width */}
        <section className="mx-auto mt-10 max-w-[1300px] lg:mt-14" aria-labelledby="open-h">
          <p className="eyebrow text-center">Your Current Life Map</p>
          <h1 id="open-h" className="mt-3 text-center font-serif text-[32px] font-light leading-[1.1] [text-wrap:balance] sm:text-[40px]">{insights.opening.title}.</h1>
          {/* Two paragraphs side by side, left-aligned; the closing question sits in the second column under its paragraph (Jana, 2026-10-13) */}
          <div className="mt-8 grid gap-6 text-left text-[14px] leading-[1.75] text-mahogany/85 [text-wrap:pretty] md:grid-cols-2 md:gap-12">
            <p>{insights.opening.paragraphs[0]?.text}</p>
            <div>
              {insights.opening.paragraphs[1] && <p>{insights.opening.paragraphs[1].text}</p>}
              {insights.opening.paragraphs.slice(2).map((p, i) => (
                <p key={i} className="mt-6 font-serif text-[19px] italic leading-relaxed text-burgundy [text-wrap:pretty]">{p.text}</p>
              ))}
            </div>
          </div>
          {/* "What this is based on" removed from the page (Jana, 2026-10-13); the answers behind the theme stay in the stored record. */}
        </section>
        </div>
      )}

      {/* Section tabs: anchor links to every section below (Jana, 2026-10-13); not in the coach view */}
      {!embedded && <SectionTabs token={token} />}

      {/* B. Map — in its own block so it stands out (Jana, 2026-10-12) */}
      <section id="your-map" className="scroll-mt-24 mt-[18px] rounded-[32px] border hairline bg-linen-deep/70 px-5 pb-10 pt-10 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_60px_-40px_rgba(84,15,38,0.25)] sm:px-10 lg:px-14 lg:pb-14 lg:pt-12 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36" aria-labelledby="map-h">
        {/* Visible headline removed (Jana, 2026-10-13); kept for screen readers as the section's name */}
        <header className="sr-only">
          <h2 id="map-h">
            {insights?.mapIntro ?? "Here's how the different parts of your life look together, based on what you've shared."}
          </h2>
        </header>
        {/* Left: the Map with the legend beneath, as one block that never moves. Right: the table, then "Show Map interpretation"
            beneath it, which opens the written reading in place (Jana, 2026-10-13). */}
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-x-16">
          <div className="min-w-0">
            <PersonalMap result={result} />
            <div className="mt-3 border-t hairline pt-6"><MapLegend distancePending={distancePending} columns={2} /></div>
          </div>
          <div className="min-w-0 lg:pt-[8px]">
            {/* Visible title removed (Jana, 2026-10-12); the table keeps an accessible name */}
            <MapTable result={result} />
            {hasReading && (
              <div className="mt-6 border-t hairline pt-5"><MapReading paragraphs={insights!.mapReading.paragraphs} open={readingOpen} onToggle={() => setReadingOpen((v) => !v)} /></div>
            )}
          </div>
        </div>

      </section>

      {/* Book Your Session sits right below the Map (Jana, 2026-10-13) */}
      {afterMap}

      {/* C. What stands out — the Reality Snapshot, connected into one narrative (brief §4C) */}
      <section id="reality-snapshot" className="scroll-mt-24 mt-24" aria-labelledby="snap-h">
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

      {/* Your Life System (Jana, 2026-10-13): the Sun, Life Interconnections and the eight Orbits, grouped under one title */}
      {insights && (
        <section id="life-system" className="scroll-mt-24 mt-24" aria-labelledby="system-h">
          <p className="eyebrow">Your Life System</p>
          <h2 id="system-h" className="mt-3 font-serif text-[36px] font-light">How the parts of your life connect</h2>
          <div className="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-16">
            {/* D. The Sun */}
            <section id="the-sun" aria-labelledby="self-h">
              <p className="eyebrow">The Sun</p>
              <h3 id="self-h" className="mt-3 font-serif text-[28px] font-light leading-tight">{insights.self.title}</h3>
              <div className="mt-5 space-y-4 text-[14.5px] leading-[1.8] text-mahogany/85">{insights.self.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
              {insights.self.question && <QuestionBlock className="mt-5">{insights.self.question}</QuestionBlock>}
            </section>
            {/* E. Life Interconnections */}
            <section id="life-interconnections" aria-labelledby="links-h">
              <p className="eyebrow">Life Interconnections</p>
              <h3 id="links-h" className="mt-3 font-serif text-[28px] font-light leading-tight">{insights.connections.title}</h3>
              <div className="mt-5 space-y-4 text-[14.5px] leading-[1.8] text-mahogany/85">{insights.connections.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
            </section>
          </div>
          {/* G. The eight Orbits */}
          <OrbitList insights={insights} />
        </section>
      )}

      {/* F. Five insight cards */}
      {insights && <PersonalInsights insights={insights} />}

      {/* H. A question worth taking with you */}
      {insights && (
        <section id="your-question" className="scroll-mt-24 mx-auto mt-24 max-w-[760px] text-center" aria-labelledby="closing-h">
          <p id="closing-h" className="eyebrow">A question worth taking with you</p>
          <p className="mt-5 font-serif text-[28px] font-light italic leading-snug text-burgundy [text-wrap:balance] sm:text-[32px]">{insights.closingQuestion.text}</p>{/* no outline on the closing question (Jana, 2026-10-13) */}
          {!embedded && afterMap && (
            <>
              <p className="mx-auto mt-6 max-w-[600px] text-[13.5px] leading-relaxed text-mahogany/70">{insights.deepDiveBridge}</p>
              {/* Primary CTA under the bridge text (Jana, 2026-10-13) */}
              <ClosingBookButton token={token} />
            </>
          )}
        </section>
      )}

      {/* "Where attention may matter most" removed from the client view (Jana, 2026-10-12); still in the Coach Report and script */}
      {children}
      {/* Same friendly line as the PDF footer (Jana, 2026-10-13) */}
      <p className="mt-16 text-center text-[12.5px] text-mahogany/75">{CONTACT_INVITE} <a href={`mailto:${CONTACT_EMAIL}`} className="text-burgundy underline decoration-burgundy/30 underline-offset-4 hover:decoration-burgundy">{CONTACT_EMAIL}</a></p>
      {reference && <p className="mt-2 text-center text-[11px] text-taupe">Reference {reference}</p>}
    </Root>
  );
}

/** Orbit · Importance · Energy · Feelings — on the page beside the Map, and in the PDF. */
export function MapTable({ result, wide = false }: { result: LifeMapResult; wide?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label="Map interpretation" className={`w-full text-left text-mahogany/85 ${wide ? "min-w-[640px] table-fixed text-[13.5px]" : "text-[12.5px]"}`}>
        {/* Full card width: columns spread across the grid (Jana, 2026-10-13) */}
        {wide && <colgroup><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[24%]" /><col className="w-[32%]" /></colgroup>}
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

/** The written Map interpretation, folded behind a button under the table until the person asks for it (Jana, 2026-10-13). Always open in the PDF. */
function MapReading({ paragraphs, open, onToggle }: { paragraphs: { text: string }[]; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="map-reading" onClick={onToggle}
        className="inline-flex items-center gap-2 py-1 text-[11.5px] uppercase tracking-[0.16em] text-burgundy transition hover:text-burgundy-soft">{/* label and + only, no outline (Jana, 2026-10-13) */}
        {open ? "Hide Map interpretation" : "Show Map interpretation"}
        <svg aria-hidden width="11" height="11" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition ${open ? "rotate-45" : ""}`}><path d="M11 2v18M2 11h18" /></svg>
      </button>
      {open && (
        <div id="map-reading" className="mt-5 space-y-3 text-[14px] leading-[1.75] text-mahogany/85">
          {paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}
        </div>
      )}
    </div>
  );
}

/** "Explore your Map with Jana" under the closing question: opens Calendly directly, like the other Book buttons. */
function ClosingBookButton({ token }: { token?: string }) {
  const { state, book } = useBooking(token);
  return (
    <>
      <button type="button" onClick={book} disabled={state.kind === "working"}
        className="mt-6 inline-block rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany disabled:opacity-70">
        {state.kind === "working" ? "Opening…" : "Explore your Map with Jana"}
      </button>
      {state.kind === "error" && <p role="status" className="mt-3 text-[12.5px] text-burgundy">{state.message}</p>}
    </>
  );
}
