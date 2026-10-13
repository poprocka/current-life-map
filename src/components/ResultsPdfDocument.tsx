import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { INSIGHT_DISCLAIMER, generateReflectionLayer } from "@/engine/insights";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { MapTable } from "@/components/ResultsView";
import { InsightBody } from "@/components/PersonalInsights";
import { ORBIT_TINT } from "@/components/map-geometry";
import { CONTACT_EMAIL } from "@/content/contact";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";

/**
 * The emailed PDF, laid out for A4 rather than copied from the screen (Jana, 2026-10-13): same visual world and the same
 * words as the results page, every insight and Orbit printed open, and no calls to action (no booking, no PDF form, no
 * buttons). Order: the opening and the Map · what the Map shows · the narrative, insights, Orbits, the closing question,
 * the person's reflections and how to reach Jana. Printed by Chromium at 900 CSS px (server/pdf/render.ts).
 */
const body = "text-[14px] leading-[1.7] text-mahogany/85";
const h2 = "mt-2 font-serif text-[30px] font-light leading-tight";

export function ResultsPdfDocument({ result, insights, reflections = [], generatedAt }: {
  result: LifeMapResult;
  insights?: ResultInsights;
  reflections?: { prompt: string; text: string }[];
  generatedAt?: Date;
}) {
  const byId = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const snapshot = result.snapshot.filter((s) => s.available);
  const distancePending = result.orbits.every((o) => o.distanceBand == null);
  const written = reflections.filter((r) => r.text.trim());
  // Same "read alongside" notes the page shows after saving (only where a reflection shares a subject with an earlier choice)
  const idOf = (prompt: string) => POST_MAP_REFLECTIONS.questions.find((q) => q.prompt === prompt)?.id ?? "";
  const layer = written.length ? generateReflectionLayer(result, Object.fromEntries(written.map((r) => [idOf(r.prompt), r.text]))) : null;
  const alongside = (prompt: string) => layer?.items.find((i) => i.questionId === idOf(prompt))?.alongside;

  return (
    <main className="px-[56px] pb-6">
      {/* ── The opening and the Map ── */}
      <section className="pt-2">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Your Current Life Map</p>
          {generatedAt && <p className="text-[11px] text-taupe">{generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>}
        </div>
        {insights ? (
          <>
            <h1 className="mt-3 font-serif text-[40px] font-light leading-[1.1]">{insights.opening.title}.</h1>
            <div className={`mt-5 grid grid-cols-2 gap-10 ${body}`}>
              {insights.opening.paragraphs.slice(0, 2).map((p, i) => <p key={i}>{p.text}</p>)}
            </div>
            {insights.opening.paragraphs.slice(2).map((p, i) => (
              <p key={i} className="mt-5 text-center font-serif text-[19px] italic leading-relaxed text-burgundy [text-wrap:balance]">{p.text}</p>
            ))}
          </>
        ) : <h1 className="mt-3 font-serif text-[40px] font-light leading-[1.1]">Your reality, as it is right now.</h1>}
      </section>

      <section className="pdf-keep mt-7 rounded-[28px] border hairline bg-linen-deep/70 px-10 pb-8 pt-7">
        <h2 className="text-center font-serif text-[22px] font-light leading-snug [text-wrap:balance]">
          {insights?.mapIntro ?? "Here's how the different parts of your life look together, based on what you've shared."}
        </h2>
        <div className="mt-2 grid grid-cols-[1.35fr_1fr] items-center gap-8">
          <PersonalMap result={result} still />
          <MapLegend distancePending={distancePending} columns={1} />
        </div>
      </section>

      {/* ── What the Map shows ── */}
      <section className="mt-10">
        <p className="eyebrow pdf-with-next">Your Map</p>
        <h2 className={h2}>What stands out on your Map</h2>
        {insights && <div className={`mt-4 space-y-3 ${body}`}>{insights.mapReading.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>}
        <div className="pdf-keep mt-7 rounded-[20px] border hairline px-6 pb-3 pt-5"><MapTable result={result} /></div>
      </section>

      {/* ── Reality Snapshot ── */}
      <section className="mt-12">
        <p className="eyebrow pdf-with-next">Reality Snapshot</p>
        <h2 className={h2}>{insights?.standsOut.title ?? "Where your life stands today"}</h2>
        {insights && <div className={`mt-4 space-y-3 ${body}`}>{insights.standsOut.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>}
        <div className="pdf-keep mt-6 grid grid-cols-3 border-l border-t hairline">
          {snapshot.map((s) => (
            <article key={s.key} className="border-b border-r hairline p-5">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-2 font-serif text-[24px] font-light leading-tight">{s.orbits.map((id) => byId[id].name).join(" · ")}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mahogany/75">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {insights && (
        <div className="mt-12 grid grid-cols-2 gap-10">
          <section className="pdf-keep">
            <p className="eyebrow">The Sun</p>
            <h2 className={h2}>{insights.self.title}</h2>
            <div className={`mt-4 space-y-3 ${body}`}>{insights.self.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
            {insights.self.question && <p className="mt-4 font-serif text-[18px] italic leading-relaxed text-burgundy">{insights.self.question}</p>}
          </section>
          <section className="pdf-keep">
            <p className="eyebrow">Life Interconnections</p>
            <h2 className={h2}>{insights.connections.title}</h2>
            <div className={`mt-4 space-y-3 ${body}`}>{insights.connections.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
          </section>
        </div>
      )}

      {/* ── Personal insights: each printed open ── */}
      {insights && (
        <section className="pdf-break-before">
          <p className="eyebrow">Personal insights</p>
          <h2 className={h2}>A closer look at your reality</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-mahogany/75">
            Interpretations of the answers you gave, including the places that support you and the patterns that may deserve attention.
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-taupe">{INSIGHT_DISCLAIMER}</p>
          <div className="mt-6 space-y-5">
            {insights.cards.map((c, i) => (
              <article key={c.key} className="pdf-keep rounded-[22px] border hairline bg-[#F7F1EA] px-10 pb-8 pt-6">
                <p className="text-[12px] text-taupe">Insight {i + 1} of {insights.cards.length}</p>
                <h3 className="mt-1 font-serif text-[28px] font-light leading-tight">{c.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-mahogany/70">{c.lead}</p>
                <div aria-hidden className="my-5 h-px w-full bg-[#D9C3A8]/70" />
                <InsightBody c={c} />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── The eight Orbits ── */}
      {insights && (
        <section className="mt-12">
          <p className="eyebrow pdf-with-next">Your Orbits, one by one</p>
          <ul className="mt-4 border-t hairline">
            {insights.orbits.map((o) => (
              <li key={o.orbit} className="pdf-keep border-b hairline py-4">
                <p className="flex items-center gap-3 font-serif text-[21px] font-light">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: ORBIT_TINT[o.orbit] }} />{o.name}
                </p>
                <div className="mt-2 space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-mahogany/85">
                  {o.paragraphs.map((p, k) => <p key={k}>{p}</p>)}
                  <p className="pt-1 font-serif text-[18px] italic leading-relaxed text-burgundy">{o.question}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── A question worth taking with you (no call to action in the PDF) ── */}
      {insights && (
        <section className="pdf-keep mx-auto mt-14 max-w-[680px] text-center">
          <p className="eyebrow">A question worth taking with you</p>
          <p className="mt-4 font-serif text-[28px] font-light italic leading-snug text-burgundy [text-wrap:balance]">{insights.closingQuestion.text}</p>
        </section>
      )}

      {written.length > 0 && (
        <section className="pdf-keep mt-14 rounded-[22px] border hairline px-10 py-8">
          <p className="eyebrow">Your reflections</p>
          <h2 className={h2}>In your own words</h2>
          {layer && <p className="mt-2 text-[12.5px] leading-relaxed text-taupe">{layer.note}</p>}
          <div className="mt-5 space-y-5">
            {written.map((r, i) => (
              <div key={i}>
                <p className="text-[14px] leading-snug text-mahogany">{r.prompt}</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-mahogany/80">{r.text}</p>
                {alongside(r.prompt) && <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-mahogany/70">{alongside(r.prompt)!.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="pdf-keep mt-14 border-t hairline pt-6 text-center">
        <p className="font-serif text-[20px] font-light text-mahogany">Questions or feedback?</p>
        <p className="mt-1 text-[13.5px] text-mahogany/80">
          Write to <a href={`mailto:${CONTACT_EMAIL}`} className="text-burgundy underline underline-offset-4">{CONTACT_EMAIL}</a>
        </p>
      </footer>
    </main>
  );
}
