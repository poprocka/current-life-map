import Link from "next/link";
import { LifeSystem } from "@/components/LifeSystem";
import { ResumeLink } from "@/components/ResumeLink";
import { BeginLink } from "@/components/BeginLink";
import { InviteCapture } from "@/components/InviteCapture";
import { OPENING, PRIVACY_LINE } from "@/content/v10/opening";

export default function Introduction() {
  return (
    // One Life System only (two copies would share the SVG gradient ids and lose the Sun's glow and the shading).
    // Phones and tablets: it sits under the italic line. Desktop: it fills the left column (Jana, 21 Oct).
    <main className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[1fr_auto_auto_1fr]">
      <div className="animate-rise px-6 pt-10 sm:px-12 lg:col-start-2 lg:row-start-2 lg:px-20 lg:pt-14">
        <div className="max-w-[500px]">
          <p className="eyebrow mb-3.5 lg:mb-7">The Current Life Map</p>
          <h1 className="font-serif text-[46px] font-light leading-[1.04] sm:text-[58px]">{OPENING.title}</h1>
          <p className="mt-7 font-serif text-[21px] italic leading-snug text-burgundy">{OPENING.lead}</p>
        </div>
      </div>

      <section className="mt-8 flex items-center justify-center bg-linen-deep/60 px-6 py-8 sm:px-12 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:border-r lg:border-linen-line lg:px-4 lg:py-10">
        <LifeSystem labels="full" className="w-full max-w-[560px] lg:max-w-[780px]" />
      </section>

      <div className="animate-rise px-6 pb-10 sm:px-12 lg:col-start-2 lg:row-start-3 lg:px-20 lg:pb-14">
        <div className="max-w-[500px]">
          <div className="mt-8 space-y-4 text-[14.5px] leading-[1.75] text-mahogany/85">
            {OPENING.paragraphs.map((p) => <p key={p}>{p}</p>)}
          </div>
          <p className="mt-8 font-serif text-[21px] italic leading-snug text-burgundy">{OPENING.closing}</p>
          <InviteCapture />

          <p className="mt-10 text-[12px] uppercase tracking-[0.14em] text-taupe">{OPENING.estimatedTime}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-4">
            <BeginLink
              className="rounded-full bg-burgundy px-8 py-[15px] text-[13px] font-normal uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-burgundy">
              {OPENING.cta}
            </BeginLink>
            <ResumeLink />
          </div>

          <p className="mt-10 border-t hairline pt-5 text-[12.5px] leading-relaxed text-taupe">
            {PRIVACY_LINE.text} {PRIVACY_LINE.agreeBefore}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-burgundy">{PRIVACY_LINE.linkLabel}</Link>
            {PRIVACY_LINE.agreeAfter}
          </p>
        </div>
      </div>
    </main>
  );
}
