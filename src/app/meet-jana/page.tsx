import type { Metadata } from "next";
import { Fragment } from "react";
import { MEET_JANA as M } from "@/content/meet-jana";
import { ApplyButton, BackLink, Portrait } from "@/components/meet-jana/parts";

export const metadata: Metadata = {
  title: "Meet Jana Poprocka | Creator of The Life System™",
  description: "Meet Jana Poprocka — founder, creative director, and coach. Discover the story, experiences, and philosophy behind The Life System™ and her personalized approach to coaching.",
};

/** **bold** in Jana's copy → emphasis, kept exactly where she put it. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/).map((part, i) => part.startsWith("**") ? <strong key={i} className="font-medium text-mahogany">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>)}</>;
}

/**
 * Meet Jana (21 Oct): an editorial magazine interview. One portrait, the opening beside it; then the interview in a
 * narrow reading column, questions set in large italic serif with a fine rule and a number, two pull quotes taken from
 * the answers themselves, and the invitation to apply at the end. Typography and whitespace carry the design.
 */
export default function MeetJana() {
  const answer = "text-[16px] leading-[1.8] text-mahogany/85 sm:text-[16.5px]";
  return (
    <main className="pb-24">
      <div className="mx-auto max-w-[1180px] px-6 pt-8 sm:px-10 sm:pt-10"><BackLink /></div>

      {/* ── Opening: portrait and introduction ── */}
      <header className="mx-auto mt-8 grid max-w-[1180px] gap-10 px-6 sm:px-10 lg:mt-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
        <Portrait className="mx-auto w-full max-w-[520px] lg:max-w-none" />
        <div className="lg:pb-6">
          <p className="eyebrow">Meet Jana</p>
          <h1 className="mt-4 font-serif text-[44px] font-light leading-[1.02] tracking-[-0.01em] sm:text-[60px] lg:text-[76px]">{M.title}</h1>
          <p className="mt-5 max-w-[460px] text-[11.5px] uppercase leading-[1.9] tracking-[0.2em] text-burgundy">{M.roles}</p>
          <div className={`mt-8 max-w-[520px] space-y-4 border-t hairline pt-7 ${answer}`}>
            {M.intro.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
          </div>
        </div>
      </header>

      {/* ── The interview ── */}
      <article className="mx-auto mt-20 max-w-[680px] px-6 sm:mt-28 sm:px-10">
        {M.interview.map((item, n) => (
          <section key={item.q} className={n ? "mt-16 sm:mt-20" : ""} aria-labelledby={`q-${n}`}>
            <div className="flex items-baseline gap-4 border-t hairline pt-6">
              <span aria-hidden className="font-serif text-[15px] italic text-taupe">{String(n + 1).padStart(2, "0")}</span>
              <h2 id={`q-${n}`} className="font-serif text-[30px] font-light italic leading-[1.15] text-burgundy sm:text-[38px]">{item.q}</h2>
            </div>
            <div className={`mt-7 space-y-5 sm:pl-10 ${answer}`}>
              {item.a.map((block, i) => typeof block === "string"
                ? <p key={i}><Rich text={block} /></p>
                : (
                  <blockquote key={i} className="!my-12 sm:-ml-10 sm:!my-14">
                    <p className="font-serif text-[28px] font-light italic leading-[1.25] text-mahogany [text-wrap:balance] sm:text-[36px]">
                      <span aria-hidden className="text-burgundy">“</span>{block.quote}<span aria-hidden className="text-burgundy">”</span>
                    </p>
                  </blockquote>
                ))}
            </div>
          </section>
        ))}

        {/* ── Invitation ── */}
        <section className="mt-20 border-t hairline pt-10 text-center sm:mt-28 sm:pt-14" aria-labelledby="q-closing">
          <h2 id="q-closing" className="mx-auto max-w-[560px] font-serif text-[32px] font-light italic leading-[1.15] text-burgundy [text-wrap:balance] sm:text-[42px]">{M.closing.q}</h2>
          <p className={`mx-auto mt-5 max-w-[460px] ${answer}`}>{M.closing.text}</p>
          <div className="mt-8">
            <ApplyButton label={M.closing.cta}
              className="inline-block rounded-full bg-burgundy px-9 py-4 text-[12.5px] uppercase tracking-[0.18em] text-linen transition hover:bg-mahogany disabled:opacity-70" />
          </div>
          <div className="mt-12 text-[13.5px] text-mahogany/70">
            <p>{M.closing.hello}</p>
            <p className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-8">
              <span>Instagram: <a href={M.closing.instagram.href} target="_blank" rel="noopener noreferrer" className="text-mahogany underline decoration-linen-line underline-offset-4 hover:text-burgundy">{M.closing.instagram.label}</a></span>
              <span>Email: <a href={M.closing.email.href} className="text-mahogany underline decoration-linen-line underline-offset-4 hover:text-burgundy">{M.closing.email.label}</a></span>
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
