import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { ResultsView } from "@/components/ResultsView";
import { CONTACT_EMAIL } from "@/content/contact";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { generateReflectionLayer } from "@/engine/insights";

/**
 * The emailed PDF: the results page itself, laid out as on a laptop, with nothing hidden behind an interaction
 * (Jana, 2026-10-13). Every insight is printed open, every Orbit expanded, the Map is still. Booking and the PDF form
 * are replaced by a plain email link. Rendered to static HTML on the server and printed by Chromium (server/pdf).
 */
const BOOK_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Life Map Deep Dive")}`;

export function ResultsPdfDocument({ result, insights, reflections = [], generatedAt }: {
  result: LifeMapResult;
  insights?: ResultInsights;
  reflections?: { prompt: string; text: string }[];
  generatedAt?: Date;
}) {
  const written = reflections.filter((r) => r.text.trim());
  // Same "read alongside" notes the page shows after saving (only where a reflection shares a subject with an earlier choice)
  const values = Object.fromEntries(written.map((r) => [POST_MAP_REFLECTIONS.questions.find((q) => q.prompt === r.prompt)?.id ?? "", r.text]));
  const layer = written.length ? generateReflectionLayer(result, values) : null;
  const alongside = (prompt: string) => layer?.items.find((i) => i.questionId === POST_MAP_REFLECTIONS.questions.find((q) => q.prompt === prompt)?.id)?.alongside;
  return (
    <ResultsView result={result} insights={insights} print deepDiveHref={BOOK_MAILTO} afterMap={<DeepDivePdfCard />}>
      {written.length > 0 && (
        <section className="pdf-keep mt-24 rounded-[28px] border hairline p-10" aria-labelledby="reflect-h">
          <p className="eyebrow">Your reflections</p>
          <h2 id="reflect-h" className="mt-3 font-serif text-[30px] font-light leading-tight">In your own words</h2>
          {layer && <p className="mt-3 max-w-[760px] text-[12.5px] leading-relaxed text-taupe">{layer.note}</p>}
          <div className="mt-6 space-y-6">
            {written.map((r, i) => (
              <div key={i}>
                <p className="text-[14px] leading-snug text-mahogany">{r.prompt}</p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-mahogany/80">{r.text}</p>
                {alongside(r.prompt) && <p className="mt-2 text-[12.5px] italic leading-relaxed text-mahogany/70">{alongside(r.prompt)!.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <footer className="pdf-keep mt-24 border-t hairline pt-8 text-center">
        <p className="font-serif text-[22px] font-light text-mahogany">Questions or feedback?</p>
        <p className="mt-2 text-[14px] text-mahogany/80">
          Write to <a href={`mailto:${CONTACT_EMAIL}`} className="text-burgundy underline underline-offset-4">{CONTACT_EMAIL}</a>
        </p>
        {generatedAt && <p className="mt-4 text-[11px] text-taupe">Your Current Life Map · {generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>}
      </footer>
    </ResultsView>
  );
}

/** Same card as on the page, with the button as an email link (a PDF can't open the scheduler). */
function DeepDivePdfCard() {
  return (
    <section className="pdf-keep mt-8 xl:-mx-12" aria-label="Life Map Deep Dive">
      <div className="grid gap-6 rounded-[28px] bg-burgundy p-10 text-linen lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
        <div>
          <p className="text-[10.5px] uppercase tracking-eyebrow text-linen/70">Life Map Deep Dive</p>
          <h2 className="mt-3 font-serif text-[30px] font-light leading-tight">Explore your Map with Jana</h2>
          <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-linen/85">
            A private 60-minute session to look closely at your present reality: what your Map shows, how the areas of your
            life affect one another, and what it means for you right now.
          </p>
        </div>
        <div className="lg:text-right">
          <a href={BOOK_MAILTO} className="inline-block rounded-full bg-linen px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-burgundy">Book Your Session</a>
          <p className="mt-3 text-[11.5px] text-linen/75">or write to {CONTACT_EMAIL}</p>
        </div>
      </div>
    </section>
  );
}
