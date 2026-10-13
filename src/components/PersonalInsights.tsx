"use client";
import { useEffect, useRef, useState } from "react";
import type { ResultInsights } from "@/engine/insights";
import { INSIGHT_DISCLAIMER } from "@/engine/insights";
import { ORBIT_TINT } from "@/components/map-geometry";
import { QuestionBlock } from "@/components/QuestionBlock";

/**
 * Personal insights (brief §4F–G): five evidence-led cards that open one at a time — each with a personalised
 * opening, up to three observations, why it may matter and one question — then the eight Orbits one by one.
 */
export function PersonalInsights({ insights }: { insights: ResultInsights }) {
  const [open, setOpen] = useState<number | null>(null);
  const cards = insights.cards;
  return (
    <section className="mt-24" aria-labelledby="insights-h">
      <p className="eyebrow">Personal insights</p>
      <h2 id="insights-h" className="mt-3 font-serif text-[36px] font-light">A closer look at your reality</h2>
      <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-mahogany/75">
        Interpretations of the answers you gave, including the places that support you and the patterns that may deserve attention.
      </p>
      <p className="mt-2 max-w-[640px] text-[11.5px] leading-relaxed text-taupe">{INSIGHT_DISCLAIMER}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c, i) => (
          <button key={c.key} onClick={() => setOpen(i)}
            className="group flex min-h-[124px] flex-col justify-between gap-4 rounded-[20px] border hairline bg-white/40 p-5 text-left transition hover:border-burgundy/40 hover:bg-white/70">
            <span className="font-serif text-[19px] leading-snug text-mahogany">{c.title}</span>
            {/* "View ›" makes it obvious each card opens (Jana, 2026-10-13) */}
            <span className="text-[11px] uppercase tracking-[0.16em] text-burgundy">View <span aria-hidden className="inline-block transition group-hover:translate-x-0.5">›</span></span>
          </button>
        ))}
      </div>

      <div className="mt-16">
        <p className="eyebrow">Your Orbits, one by one</p>
        <ul className="mt-5 border-t hairline">
          {insights.orbits.map((o) => (
            <li key={o.orbit} className="border-b hairline">
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center gap-3 font-serif text-[22px] font-light">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: ORBIT_TINT[o.orbit] }} />
                  {o.name}
                  {/* A + (no outline, 16.5px) shows the row expands; it turns into × when open (Jana, 2026-10-13) */}
                  <span aria-hidden className="ml-auto flex h-9 w-9 items-center justify-center text-burgundy transition group-hover:text-burgundy-soft group-open:rotate-45">
                    <svg width="16.5" height="16.5" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2v18M2 11h18" /></svg>
                  </span>
                </summary>
                <div className="mt-3 max-w-[760px] space-y-2 pl-5 text-[13.5px] leading-relaxed text-mahogany/85">
                  {o.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                  <QuestionBlock className="!mt-4" label="A question to ask yourself">{o.question}</QuestionBlock>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>

      {open !== null && <InsightDialog insights={insights} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

function InsightDialog({ insights, index, onIndex, onClose }: { insights: ResultInsights; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const c = insights.cards[index];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, index]);
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-mahogany/30 p-0 sm:p-8 lg:items-center lg:p-6 [@media(min-width:1024px)_and_(max-height:940px)]:p-3" onClick={onClose}>
      {/* Wider on laptop/desktop so a whole insight fits above the fold; full screen on mobile (Jana, 2026-10-13) */}
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="insight-title" onClick={(e) => e.stopPropagation()}
        className="relative h-fit min-h-full w-full max-w-[680px] bg-[#F7F1EA] px-6 pb-10 pt-6 outline-none sm:min-h-0 sm:rounded-[24px] sm:px-12 lg:max-w-[1120px] lg:px-14 lg:pb-8 [@media(min-width:1024px)_and_(max-height:940px)]:pt-5 [@media(min-width:1024px)_and_(max-height:940px)]:pb-6">
        <div className="flex items-center justify-between">
          {/* Left-aligned with the content, all caps like every eyebrow (Jana, 2026-10-13) */}
          <p className="eyebrow">Your personal insights · {index + 1} of {insights.cards.length}</p>
          <button onClick={onClose} aria-label="Close" className="text-[22px] leading-none text-burgundy hover:text-burgundy-soft">×</button>
        </div>
        {/* All five insights as tabs, so any can be opened from here (Jana, 2026-10-13); replaces "Next insight" */}
        {/* Tabs styled like the insight cards on the page (Jana, 2026-10-13) */}
        <div role="tablist" aria-label="Your personal insights" className="sticky top-0 z-10 -mx-1 mt-4 flex gap-2 overflow-x-auto bg-[#F7F1EA] px-1 py-1 lg:static lg:grid lg:grid-cols-5 lg:overflow-visible">
          {insights.cards.map((t, i) => (
            <button key={t.key} role="tab" aria-selected={i === index} onClick={() => onIndex(i)}
              className={`flex min-h-[60px] w-[160px] shrink-0 items-center rounded-[14px] border px-4 py-2.5 text-left font-serif text-[16px] leading-snug transition lg:w-auto [@media(min-width:1024px)_and_(max-height:940px)]:min-h-[50px] [@media(min-width:1024px)_and_(max-height:940px)]:py-2 [@media(min-width:1024px)_and_(max-height:940px)]:text-[15px] ${i === index ? "border-burgundy/60 bg-white text-burgundy" : "hairline bg-white/40 text-mahogany hover:border-burgundy/40 hover:bg-white/70"}`}>
              {t.title}
            </button>
          ))}
        </div>
        <h2 id="insight-title" className="mt-6 font-serif text-[34px] font-light leading-tight lg:text-[36px] [@media(min-width:1024px)_and_(max-height:940px)]:mt-4 [@media(min-width:1024px)_and_(max-height:940px)]:text-[30px]">{c.title}</h2>
        <p className="mt-3 max-w-[820px] text-[15.5px] leading-relaxed text-mahogany/70 [@media(min-width:1024px)_and_(max-height:940px)]:mt-2 [@media(min-width:1024px)_and_(max-height:940px)]:text-[14.5px]">{c.lead}</p>
        <div aria-hidden className="my-8 h-px w-full bg-[#D9C3A8]/70 lg:my-7 [@media(min-width:1024px)_and_(max-height:940px)]:my-5" />
        <InsightBody c={c} />
      </div>
    </div>
  );
}

/** The two columns of one insight — shared by the popup and the PDF, so both read the same. */
export function InsightBody({ c }: { c: ResultInsights["cards"][number] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      {/* Left: the card's main insight, in five steps (approved 13 Oct) */}
      <div className="space-y-8">
        {c.sections.slice(0, 1).map((s) => <InsightBlock key={s.id} s={s} major={c.major} />)}
      </div>
      {/* Right: the other observations, why it may matter, and the question */}
      <div className="space-y-7 [@media(min-width:1024px)_and_(max-height:940px)]:space-y-5">
        {c.sections.slice(1).map((s) => <InsightBlock key={s.id} s={s} />)}
        <section>
          <h3 className="font-serif text-[21px] font-normal">Why it may matter</h3>
          <p className="mt-2 text-[14.5px] leading-[1.75] text-mahogany/85 [@media(min-width:1024px)_and_(max-height:940px)]:text-[14px] [@media(min-width:1024px)_and_(max-height:940px)]:leading-[1.65]">{c.why}</p>
        </section>
        <section>
          <h3 className="font-serif text-[21px] font-normal">A question to consider</h3>
          <QuestionBlock className="mt-2">{c.question}</QuestionBlock>
        </section>
      </div>
    </div>
  );
}

function InsightBlock({ s, major }: { s: ResultInsights["cards"][number]["sections"][number]; major?: ResultInsights["cards"][number]["major"] }) {
  return (
    <section>
      <h3 className="font-serif text-[21px] font-normal">{s.heading}</h3>
      {major ? (
        <div className="mt-3 space-y-4 text-[14.5px] leading-[1.75] text-mahogany/85 [@media(min-width:1024px)_and_(max-height:940px)]:space-y-3 [@media(min-width:1024px)_and_(max-height:940px)]:text-[14px] [@media(min-width:1024px)_and_(max-height:940px)]:leading-[1.65]">
          <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">What you shared</p>
            <ul className="mt-1 space-y-1 text-[13px] text-mahogany/75">{major.shared.map((x, k) => <li key={k}>{x}</li>)}</ul></div>
          <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">What stands out</p><p className="mt-1">{major.pattern}</p></div>
          {major.meaning && <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">What it might mean</p><p className="mt-1">{major.meaning}</p></div>}
          {major.alternative && <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">It could also be</p><p className="mt-1">{major.alternative}</p></div>}
        </div>
      ) : <p className="mt-2 text-[14.5px] leading-[1.75] text-mahogany/85 [@media(min-width:1024px)_and_(max-height:940px)]:text-[14px] [@media(min-width:1024px)_and_(max-height:940px)]:leading-[1.65]">{s.text}</p>}
    </section>
  );
}
