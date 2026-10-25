import type { Metadata } from "next";
import { Fragment } from "react";
import { GUIDE, type GuideBlock } from "@/content/before-you-begin";
import { GuideBackLink, GuideEndNav } from "@/components/guide/nav";
import { ORBIT_TINT } from "@/components/map-geometry";
import type { OrbitId } from "@/content/types";

const DESCRIPTION = "Understand the philosophy behind The Self-Interview and how to approach your reflection.";
export const metadata: Metadata = {
  title: "Before You Begin | The Self-Interview",
  description: DESCRIPTION,
  alternates: { canonical: "/before-you-begin" },
  openGraph: {
    type: "article", siteName: "The Self-Interview", url: "/before-you-begin", title: "Before You Begin | The Self-Interview", description: DESCRIPTION,
    images: [{ url: GUIDE.infographic.src, width: GUIDE.infographic.width, height: GUIDE.infographic.height, alt: "The Current Life Map: See Your Life as It Is" }],
  },
  twitter: { card: "summary_large_image", title: "Before You Begin | The Self-Interview", description: DESCRIPTION, images: [GUIDE.infographic.src] },
};

/** **bold** runs from the PDF → <strong>, nothing else changed. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/).map((part, i) => part.startsWith("**") ? <strong key={i} className="font-medium text-mahogany">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>)}</>;
}

const ORBIT_BY_NAME: Record<string, OrbitId> = {
  Mind: "mind", Body: "body", Restoration: "restoration", Growth: "growth", Love: "love", "Social World": "social", Resources: "resources", Joy: "joy",
};
const body = "text-[16px] leading-[1.8] text-mahogany/85 sm:text-[16.5px]";

function Block({ b }: { b: GuideBlock }) {
  if ("p" in b) return <p><Rich text={b.p} /></p>;
  if ("ol" in b) return (
    <ol className="space-y-4">
      {b.ol.map((item, i) => (
        <li key={i} className="relative pl-10">
          <span aria-hidden className="absolute left-0 top-0 font-serif text-[22px] italic leading-[1.4] text-burgundy">{i + 1}.</span>
          <Rich text={item} />
        </li>
      ))}
    </ol>
  );
  if ("ul" in b) return (
    <ul className="space-y-4">
      {b.ul.map((item, i) => (
        <li key={i} className="relative pl-7">
          <span aria-hidden className="absolute left-0 top-[0.72em] h-[6px] w-[6px] rounded-full bg-burgundy/70" />
          <Rich text={item} />
        </li>
      ))}
    </ul>
  );
  // The eight dimensions: a real table (same wording as the PDF), with each Orbit's colour from the Map as a small dot.
  return (
    <figure className="!my-10">
      <table className="w-full border-collapse text-left">
        <caption className="mb-4 text-left font-serif text-[22px] font-normal text-mahogany">{b.table.caption}</caption>
        <thead>
          <tr className="border-b border-mahogany/25">
            {b.table.head.map((h) => <th key={h} scope="col" className="pb-3 pr-4 text-[10.5px] font-normal uppercase tracking-eyebrow text-taupe">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {b.table.rows.map(([name, domain]) => (
            <tr key={name} className="border-b hairline">
              <th scope="row" className="py-4 pr-4 align-middle font-serif text-[21px] font-normal text-mahogany sm:w-[44%]">
                <span className="inline-flex items-center gap-3">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: ORBIT_TINT[ORBIT_BY_NAME[name]] }} />
                  {name}
                </span>
              </th>
              <td className="py-4 align-middle text-[14.5px] text-mahogany/80">{domain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Before You Begin (Jana, 25 Oct): the guide "Understanding Your Current Life Map" as a native page. The wording is the
 * PDF's, unchanged (src/content/before-you-begin.ts); only the presentation is the site's. Reached from the welcome
 * page and from the results page; navigation adapts to where the visitor came from.
 */
export default function BeforeYouBegin() {
  const g = GUIDE.infographic;
  return (
    <main className="pb-24">
      <div className="mx-auto max-w-[1180px] px-6 pt-8 sm:px-10 sm:pt-10"><GuideBackLink /></div>

      <header className="mx-auto mt-10 max-w-[900px] px-6 text-center sm:px-10 lg:mt-14">
        <p className="eyebrow">Before You Begin</p>
        <h1 className="mx-auto mt-5 max-w-[820px] font-serif text-[36px] font-light leading-[1.1] [text-wrap:balance] sm:text-[48px] lg:text-[56px]">{GUIDE.title}</h1>
      </header>

      {/* The original infographic, in a soft frame so it sits on the linen page */}
      <figure className="mx-auto mt-10 max-w-[1080px] px-4 sm:mt-14 sm:px-10">
        {/* Opens at full size (useful on phones, where the infographic's small text is hard to read) */}
        <a href={g.src} target="_blank" rel="noopener" className="block overflow-hidden rounded-[24px] border hairline bg-white shadow-[0_24px_60px_-40px_rgba(84,15,38,0.25)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-burgundy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.src} alt={g.alt} width={g.width} height={g.height} className="h-auto w-full" decoding="async" fetchPriority="high" />
        </a>
        <figcaption className="mt-3 text-center lg:hidden">
          <a href={g.src} target="_blank" rel="noopener" className="eyebrow underline decoration-linen-line underline-offset-4 hover:text-burgundy">View full size <span aria-hidden>↗</span></a>
        </figcaption>
      </figure>

      <article className="mx-auto mt-16 max-w-[680px] px-6 sm:mt-20 sm:px-10">
        {GUIDE.sections.map((s, n) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className={`scroll-mt-8 ${n ? "mt-16 border-t hairline pt-10 sm:mt-20 sm:pt-12" : ""}`}>
            <h2 id={`${s.id}-h`} className="font-serif text-[30px] font-light leading-[1.15] text-burgundy [text-wrap:balance] sm:text-[36px]">{s.heading}</h2>
            <div className={`mt-6 space-y-5 ${body}`}>
              {s.blocks.map((b, i) => <Block key={i} b={b} />)}
            </div>
          </section>
        ))}

        <div className="mt-20 border-t hairline pt-10 sm:mt-24"><GuideEndNav /></div>
      </article>
    </main>
  );
}
