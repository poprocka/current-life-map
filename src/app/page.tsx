import Link from "next/link";
import { LifeSystem } from "@/components/LifeSystem";
import { ResumeLink } from "@/components/ResumeLink";
import { OPENING, PRIVACY_LINE } from "@/content/v10/opening";

export default function Introduction() {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.15fr_1fr]">
      <section className="flex items-center justify-center border-b hairline bg-linen-deep/60 px-6 py-10 lg:border-b-0 lg:border-r lg:px-4">
        <LifeSystem labels="full" className="w-full max-w-[780px]" />
      </section>

      <section className="flex items-center px-6 py-14 sm:px-12 lg:px-20">
        <div className="max-w-[500px] animate-rise">
          <p className="eyebrow mb-7">The Current Life Map</p>
          <h1 className="font-serif text-[46px] font-light leading-[1.04] sm:text-[58px]">{OPENING.title}</h1>
          <p className="mt-7 font-serif text-[21px] italic leading-snug text-burgundy">{OPENING.lead}</p>
          <div className="mt-8 space-y-4 text-[14.5px] leading-[1.75] text-mahogany/85">
            {OPENING.paragraphs.map((p) => <p key={p}>{p}</p>)}
          </div>
          <p className="mt-8 font-serif text-[21px] italic leading-snug text-burgundy">{OPENING.closing}</p>

          <div className="mt-11 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link href="/interview"
              className="rounded-full bg-burgundy px-8 py-[15px] text-[13px] font-normal uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-burgundy">
              {OPENING.cta}
            </Link>
            <ResumeLink />
          </div>

          <p className="mt-10 border-t hairline pt-5 text-[12.5px] leading-relaxed text-taupe">
            {PRIVACY_LINE.text}{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-burgundy">{PRIVACY_LINE.linkLabel}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
