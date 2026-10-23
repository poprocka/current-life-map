import type { Metadata } from "next";
import { Fragment } from "react";
import { MEET_JANA as M } from "@/content/meet-jana";
import { ApplyButton, BackLink, Portrait, SelfInterviewInvite } from "@/components/meet-jana/parts";

export const metadata: Metadata = {
  title: "Meet Jana Poprocka | Creator of The Life System™",
  description: "Meet Jana Poprocka — founder, creative director, and coach. Discover the story, experiences, and philosophy behind The Life System™ and her personalized approach to coaching.",
  // Shared on its own (Jana, 23 Oct): the preview carries this page's title and description (image: the site's map)
  openGraph: {
    type: "profile", siteName: "The Self-Interview", url: "/meet-jana",
    title: "Meet Jana Poprocka | Creator of The Life System™",
    description: "Meet Jana Poprocka — founder, creative director, and coach. Discover the story, experiences, and philosophy behind The Life System™ and her personalized approach to coaching.",
    // A page-level openGraph replaces the site's, so the map image is named here too
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "The Life System: You at the centre, with eight Orbits around it." }],
  },
  twitter: { card: "summary_large_image", title: "Meet Jana Poprocka | Creator of The Life System™", images: ["/twitter-image.png"] },
};

/** **bold** in Jana's copy → emphasis, kept exactly where she put it. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/).map((part, i) => part.startsWith("**") ? <strong key={i} className="font-medium text-mahogany">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>)}</>;
}

/**
 * Meet Jana (21 Oct): an editorial magazine interview. One portrait, the opening beside it; then the interview in a
 * narrow reading column, everything left-aligned (Jana, 21 Oct), questions set in large italic serif with a fine rule and a number, two pull quotes taken from
 * the answers themselves, and the invitation to apply at the end. Typography and whitespace carry the design.
 */
export default function MeetJana() {
  const answer = "text-[16px] leading-[1.8] text-mahogany/85 sm:text-[16.5px]";
  return (
    <main className="pb-24">
      {/* Back to the Map only when opened from the results page (Jana, 23 Oct) */}
      <div className="mx-auto max-w-[1180px] px-6 pt-8 sm:px-10 sm:pt-10"><BackLink /></div>

      {/* ── Opening: portrait and introduction ── */}
      {/* Phones and tablets: name and roles first, then the portrait, then the introduction (no rule above it).
          Desktop: portrait on the left; name, roles and introduction on the right (Jana, 21 Oct). */}
      <header className="mx-auto mt-8 grid max-w-[1180px] gap-8 px-6 sm:px-10 lg:mt-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:grid-rows-[1fr_auto] lg:gap-x-20 lg:gap-y-0">
        <div className="lg:col-start-2 lg:row-start-1 lg:self-end">
          <p className="eyebrow">Meet Jana</p>
          <h1 className="mt-4 font-serif text-[44px] font-light leading-[1.02] tracking-[-0.01em] sm:text-[60px] lg:text-[76px]">{M.title}</h1>
          <p className="mt-5 max-w-[460px] text-[11.5px] uppercase leading-[1.9] tracking-[0.2em] text-burgundy">{M.roles}</p>
        </div>
        <Portrait className="mx-auto w-full max-w-[520px] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-w-none lg:self-end" />
        <div className={`max-w-[520px] space-y-4 lg:col-start-2 lg:row-start-2 lg:mt-8 lg:border-t lg:border-linen-line lg:pb-6 lg:pt-7 ${answer}`}>
          {M.intro.map((p) => <p key={p.slice(0, 24)}><Rich text={p} /></p>)}
        </div>
      </header>

      {/* ── The interview ── */}
      <article className="mx-auto mt-20 max-w-[680px] px-6 sm:mt-28 sm:px-10">
        {M.interview.map((item, n) => (
          <Fragment key={item.q}>
          <section className={n ? "mt-16 sm:mt-20" : ""} aria-labelledby={`q-${n}`}>
            {/* Number to the left of the question (Jana, 21 Oct): inline on phones, hanging in the margin from tablet up,
                so the question text keeps the same left edge as the answers */}
            <div className="relative flex items-baseline gap-3 border-t hairline pt-6 sm:block">
              <span aria-hidden className="shrink-0 font-serif text-[15px] italic text-taupe sm:absolute sm:right-full sm:top-[2.35rem] sm:mr-5">{String(n + 1).padStart(2, "0")}</span>
              <h2 id={`q-${n}`} className="font-serif text-[30px] font-light italic leading-[1.15] text-burgundy sm:text-[38px]">{item.q}</h2>
            </div>
            <div className={`mt-7 space-y-5 ${answer}`}>
              {item.a.map((block, i) => typeof block === "string"
                ? <p key={i}><Rich text={block} /></p>
                : (
                  <blockquote key={i} className="!my-12 sm:!my-14">
                    <p className="font-serif text-[28px] font-light italic leading-[1.25] text-burgundy [text-wrap:balance] sm:text-[36px]">
                      <span aria-hidden>“</span>{block.quote}<span aria-hidden>”</span>
                    </p>
                  </blockquote>
                ))}
            </div>
          </section>
          {/* Self-Interview banner after "What's your approach?" — hidden only when opened from the results page (Jana, 23 Oct) */}
          {item.q === "What's your approach?" && <SelfInterviewInvite {...M.selfInterview} />}
          </Fragment>
        ))}

        {/* ── Invitation ── */}
        <section className="mt-20 border-t hairline pt-10 sm:mt-28 sm:pt-14" aria-labelledby="q-closing">
          <h2 id="q-closing" className="max-w-[560px] font-serif text-[32px] font-light italic leading-[1.15] text-burgundy [text-wrap:balance] sm:text-[42px]">{M.closing.q}</h2>
          <p className={`mt-5 max-w-[460px] ${answer}`}>{M.closing.text}</p>
          <div className="mt-8">
            <ApplyButton label={M.closing.cta}
              className="inline-block rounded-full bg-burgundy px-9 py-4 text-[12.5px] uppercase tracking-[0.18em] text-linen transition hover:bg-mahogany disabled:opacity-70" />
          </div>
          <div className="mt-12 text-[13.5px] text-mahogany/70">
            <p>{M.closing.hello}</p>
            <p className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-8">
              <span>Instagram: <a href={M.closing.instagram.href} target="_blank" rel="noopener noreferrer" className="text-mahogany underline decoration-linen-line underline-offset-4 hover:text-burgundy">{M.closing.instagram.label}</a></span>
              <span>Email: <a href={M.closing.email.href} className="text-mahogany underline decoration-linen-line underline-offset-4 hover:text-burgundy">{M.closing.email.label}</a></span>
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
