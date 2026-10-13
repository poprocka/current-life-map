import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { INSIGHT_DISCLAIMER, generateReflectionLayer } from "@/engine/insights";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { MapTable } from "@/components/ResultsView";
import { InsightBody } from "@/components/PersonalInsights";
import { ORBIT_TINT } from "@/components/map-geometry";
import { QuestionBlock } from "@/components/QuestionBlock";
import { CONTACT_EMAIL } from "@/content/contact";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";

/**
 * The emailed PDF, laid out for A4 rather than copied from the screen (Jana, 2026-10-13): same visual world and the same
 * words as the results page, every insight and Orbit printed open, and no calls to action (no booking, no PDF form, no
 * buttons). Order: the opening and the Map · what the Map shows · the narrative, insights, Orbits, the closing question,
 * the person's reflections and how to reach Jana. Printed by Chromium at 900 CSS px (server/pdf/render.ts).
 */
const body = "text-[13px] leading-[1.65] text-mahogany/85"; // smaller paragraph text for print (Jana, 2026-10-13)
const h2 = "mt-2 font-serif text-[30px] font-light leading-tight";
const h3 = "mt-2 font-serif text-[23px] font-light leading-tight";

/** Every major section opens the same way: a rule, the navigation label as eyebrow, then the title (clear hierarchy). */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    // outer padding keeps the rule clear of the page edge when a section starts a new page
    <div className="pdf-keep pdf-with-next pt-1">
      <div className="border-t hairline pt-6">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className={h2}>{title}</h2>
      </div>
    </div>
  );
}

export function ResultsPdfDocument({ result, insights, reflections = [], generatedAt, reference }: {
  result: LifeMapResult;
  /** First 12 characters of the snapshot fingerprint — the same reference the results page shows. */
  reference?: string;
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
          <p className="text-[11px] text-taupe">{generatedAt ? generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}{reference ? `${generatedAt ? " · " : ""}Reference ${reference}` : ""}</p>
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

        {/* Bigger Map, smaller legend (Jana, 2026-10-13) */}
        <div className="grid grid-cols-[2fr_1fr] items-center gap-6">
          <PersonalMap result={result} still />
          <MapLegend distancePending={distancePending} columns={1} compact />
        </div>
      </section>

      {/* ── Your Life Map: the table and the written interpretation, printed open ── */}
      <section className="mt-12">
        <SectionHead eyebrow="Your Life Map" title="Map interpretation" />
        <div className="pdf-keep mt-5 pt-1"><div className="rounded-[18px] border hairline bg-linen-deep/40 px-6 pb-2 pt-4"><MapTable result={result} wide /></div></div>
        {insights && <div className={`mt-6 space-y-3 ${body}`}>{insights.mapReading.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>}
      </section>

      {/* ── What Stands Out: the Reality Snapshot. Every cell draws its own four lines (collapsed by -1px margins), so the
          grid keeps all its lines even where it continues onto a new page (Jana, 2026-10-13) ── */}
      <section className="mt-12">
        <SectionHead eyebrow="What Stands Out" title={insights?.standsOut.title ?? "Where your life stands today"} />
        {insights && <div className={`mt-4 space-y-3 ${body}`}>{insights.standsOut.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>}
        <div className="pdf-keep mt-4 pt-2">
        <div className="grid grid-cols-3 pl-px pt-px">
          {snapshot.map((s) => (
            <article key={s.key} className="-ml-px -mt-px border border-linen-line p-5">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-2 font-serif text-[22px] font-light leading-tight">{s.orbits.map((id) => byId[id].name).join(" · ")}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-mahogany/75">{s.body}</p>
            </article>
          ))}
        </div>
        </div>
      </section>

      {/* ── How It Connects: the Sun, Life Interconnections and the eight Orbits ── */}
      {insights && (
        <section className="mt-12">
          <SectionHead eyebrow="How It Connects" title="How the parts of your life connect" />
          <div className="mt-6 grid grid-cols-2 gap-10">
            <section className="pdf-keep">
              <p className="eyebrow">The Sun</p>
              <h3 className={h3}>{insights.self.title}</h3>
              <div className={`mt-3 space-y-3 ${body}`}>{insights.self.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
              {insights.self.question && <QuestionBlock size="sm" className="mt-4">{insights.self.question}</QuestionBlock>}
            </section>
            <section className="pdf-keep">
              <p className="eyebrow">Life Interconnections</p>
              <h3 className={h3}>{insights.connections.title}</h3>
              <div className={`mt-3 space-y-3 ${body}`}>{insights.connections.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}</div>
            </section>
          </div>
          <div className="mt-10">
            <p className="eyebrow pdf-with-next">Your Orbits, one by one</p>
            <ul className="mt-3">
              {insights.orbits.map((o) => (
                <li key={o.orbit} className="pdf-keep pt-1"><div className="border-t hairline py-4">
                  <p className="flex items-center gap-3 font-serif text-[20px] font-light">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: ORBIT_TINT[o.orbit] }} />{o.name}
                  </p>
                  <div className={`mt-2 space-y-1.5 pl-5 ${body}`}>
                    {o.paragraphs.map((p, k) => <p key={k}>{p}</p>)}
                    <QuestionBlock size="sm" className="!mt-3">{o.question}</QuestionBlock>
                  </div>
                </div></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Personal Insights: printed open, separated by rules; type and spacing carry the structure ── */}
      {insights && (
        <section className="mt-12">
          <SectionHead eyebrow="Personal Insights" title="A closer look at your reality" />
          <p className={`mt-3 ${body}`}>
            Interpretations of the answers you gave, including the places that support you and the patterns that may deserve attention.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-taupe">{INSIGHT_DISCLAIMER}</p>
          <div className="pdf-insights">
            {insights.cards.map((c) => (
              <article key={c.key} className="mt-7 pt-1"><div className="border-t hairline pt-5">
                <div className="pdf-keep pdf-with-next">
                  <h3 className={h3.replace("mt-2 ", "")}>{c.title}</h3>
                  <p className={`mt-1.5 ${body} text-mahogany/70`}>{c.lead}</p>
                </div>
                <div className="mt-4"><InsightBody c={c} /></div>
              </div></article>
            ))}
          </div>
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
          <p className="eyebrow">Reflections</p>
          <h2 className={h2}>In your own words</h2>
          {layer && <p className="mt-2 text-[12.5px] leading-relaxed text-taupe">{layer.note}</p>}
          <div className="mt-5 space-y-5">
            {written.map((r, i) => (
              <div key={i}>
                <p className="text-[13px] leading-snug text-mahogany/80">{r.prompt}</p>
                <p className="mt-1.5 whitespace-pre-wrap font-serif text-[17px] italic leading-relaxed text-mahogany">{r.text}</p>{/* their words in italic, for contrast with the prompt (Jana, 2026-10-13) */}
                {alongside(r.prompt) && <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-mahogany/70">{alongside(r.prompt)!.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact: "Questions or feedback? hello@jasia.design" is in the footer of every page */}
    </main>
  );
}
