"use client";
import { useEffect, useRef, useState } from "react";
import type { ResultInsights } from "@/engine/insights";
import { INSIGHT_DISCLAIMER } from "@/engine/insights";
import { ORBIT_TINT } from "@/components/map-geometry";

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
                  <span aria-hidden className="ml-auto text-[14px] text-taupe transition group-open:rotate-90">›</span>
                </summary>
                <div className="mt-3 max-w-[760px] space-y-2 pl-5 text-[13.5px] leading-relaxed text-mahogany/85">
                  {o.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                  <p className="pt-1 font-serif text-[16px] italic text-burgundy">{o.question}</p>
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
  const next = insights.cards[index + 1];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, index]);
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-mahogany/30 p-0 sm:p-8" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="insight-title" onClick={(e) => e.stopPropagation()}
        className="relative h-fit min-h-full w-full max-w-[680px] bg-[#F7F1EA] px-6 pb-10 pt-6 outline-none sm:min-h-0 sm:rounded-[24px] sm:px-12">
        <div className="flex items-center justify-between">
          <span />
          <p className="text-[14px] text-mahogany">Your personal insights</p>
          <button onClick={onClose} aria-label="Close" className="text-[22px] leading-none text-mahogany hover:text-burgundy">×</button>
        </div>
        <p className="mt-6 text-[10.5px] uppercase tracking-[0.18em] text-taupe">The Current Life Map · Insight {index + 1} of {insights.cards.length}</p>
        <h2 id="insight-title" className="mt-5 font-serif text-[38px] font-light leading-tight">{c.title}</h2>
        <p className="mt-4 text-[16px] leading-relaxed text-mahogany/70">{c.lead}</p>
        <div aria-hidden className="mx-auto my-10 h-px w-36 bg-[#D9C3A8]" />
        <div className="space-y-8">
          {c.sections.map((s, i) => (
            <section key={s.id}>
              <h3 className="font-serif text-[22px] font-normal">{s.heading}</h3>
              {i === 0 && c.major ? (
                // The card's main insight, in five steps (approved 13 Oct)
                <div className="mt-3 space-y-4 text-[14.5px] leading-[1.8] text-mahogany/85">
                  <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">What you shared</p>
                    <ul className="mt-1 space-y-1 text-[13px] text-mahogany/75">{c.major.shared.map((x, k) => <li key={k}>{x}</li>)}</ul></div>
                  <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">What stands out</p><p className="mt-1">{c.major.pattern}</p></div>
                  {c.major.meaning && <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">What it might mean</p><p className="mt-1">{c.major.meaning}</p></div>}
                  {c.major.alternative && <div><p className="text-[10.5px] uppercase tracking-[0.16em] text-taupe">It could also be</p><p className="mt-1">{c.major.alternative}</p></div>}
                </div>
              ) : <p className="mt-3 text-[14.5px] leading-[1.8] text-mahogany/85">{s.text}</p>}
            </section>
          ))}
          <section>
            <h3 className="font-serif text-[22px] font-normal">Why it may matter</h3>
            <p className="mt-3 text-[14.5px] leading-[1.8] text-mahogany/85">{c.why}</p>
          </section>
          <section>
            <h3 className="font-serif text-[22px] font-normal">A question to consider</h3>
            <p className="mt-3 font-serif text-[19px] italic leading-relaxed text-burgundy">{c.question}</p>
          </section>
        </div>
        <p className="mt-10 text-[11.5px] leading-relaxed text-taupe">{INSIGHT_DISCLAIMER}</p>
        <button onClick={() => (next ? onIndex(index + 1) : onClose())}
          className="mt-8 flex w-full items-center justify-between rounded-[16px] border hairline bg-white px-6 py-4 text-left transition hover:border-burgundy/40">
          <span><span className="block text-[11px] text-taupe">{next ? "Next insight" : "Return to"}</span>
            <span className="font-serif text-[20px]">{next ? next.title : "Your Map"}</span></span>
          <span aria-hidden className="text-[18px]">›</span>
        </button>
      </div>
    </div>
  );
}
