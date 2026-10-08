"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LifeSystem } from "@/components/LifeSystem";
import { ResponseControl } from "@/components/ResponseControl";
import { chapterById } from "@/content/v10/chapters";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { TOTAL_STEPS, isComplete, progress, questionAt, resumeStep, validate } from "@/engine/navigation";
import { useInterview, type SyncState } from "@/lib/useInterview";

const SYNC_LABEL: Record<SyncState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  device: "Saved on this device",
  error: "Couldn't reach the server — saved on this device",
};

function eyebrowFor(kind: string) {
  return kind === "sun" ? "The Center" : kind === "orbit" ? "Orbit" : "The Life System";
}

function Interview() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, answers, step, sync, answer, goTo } = useInterview();
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (ready && params.get("resume")) goTo(resumeStep(answers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    setError(null);
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  if (!ready) return <main className="min-h-dvh" aria-busy="true" />;

  const q = questionAt(step);
  const chapter = chapterById(q.chapterId);
  const value = answers[q.id];
  const last = step === TOTAL_STEPS - 1;
  const pct = Math.round(progress(answers) * 100);

  const next = () => {
    const err = validate(q, value);
    if (err) return setError(err);
    if (!last) return goTo(step + 1);
    if (isComplete(answers)) return router.push("/results");
    const missing = ACTIVE_QUESTIONS.findIndex((x) => !x.optional && answers[x.id] === undefined);
    setError("A few earlier questions still need an answer. Taking you there.");
    setTimeout(() => goTo(missing), 900);
  };

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      {/* Left: area */}
      <aside className="border-b hairline bg-linen-deep/60 px-6 pb-6 pt-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-center lg:border-b-0 lg:border-r lg:px-14">
        <div className="flex items-center gap-5 lg:block">
          <LifeSystem active={q.chapterId} labels="none" className="w-[84px] shrink-0 lg:mx-auto lg:w-full lg:max-w-[340px]"
            title={`The Life System, currently showing ${chapter.name}.`} />
          <div key={chapter.id} className="animate-rise lg:mt-10">
            <p className="eyebrow">{eyebrowFor(chapter.kind)}</p>
            <h2 className="mt-1.5 font-serif text-[30px] font-light leading-none lg:mt-3 lg:text-[44px]">{chapter.name}</h2>
            {chapter.subtitle && <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-burgundy">{chapter.subtitle}</p>}
          </div>
        </div>
        <div key={`${chapter.id}-d`} className="animate-rise">
          <p className="mt-4 max-w-[440px] text-[13px] leading-relaxed text-mahogany/75 lg:mt-5 lg:text-[13.5px]">{chapter.description}</p>
          {chapter.explores.length > 0 && (
            <ul aria-label={`${chapter.name} explores`} className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              {chapter.explores.map((e) => {
                const on = e === q.exploreCategory;
                return (
                  <li key={e} aria-current={on ? "true" : undefined}
                    className={`shrink-0 rounded-full border px-3 py-1 text-[11px] tracking-wide transition-colors duration-300 ${
                      on ? "border-burgundy text-burgundy" : "border-linen-line text-taupe"}`}>
                    {e}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right: question */}
      <section className="flex min-h-[60dvh] flex-col px-6 py-6 sm:px-12 lg:h-dvh lg:px-20 lg:py-10">
        <header>
          <div className="flex items-baseline justify-between text-[12px] text-taupe">
            <span aria-live="polite">Question {step + 1} of {TOTAL_STEPS}</span>
            <span className="text-[11px]">{SYNC_LABEL[sync]}</span>
          </div>
          <div className="mt-3 h-px w-full bg-linen-line" role="progressbar" aria-label="Overall progress"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-px bg-burgundy transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </header>

        <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <div key={q.id} className="my-auto animate-rise py-10">
            <h1 id="prompt" ref={headingRef} tabIndex={-1}
              className="max-w-[620px] font-serif text-[27px] font-light leading-[1.22] outline-none sm:text-[33px]">
              {q.prompt}
            </h1>
            <div className="mt-9 max-w-[560px]">
              <ResponseControl q={q} value={value} labelledBy="prompt"
                onChange={(v) => { setError(null); answer(q.id, v); }} />
            </div>
            <p role="alert" className="mt-4 min-h-[20px] text-[13px] text-burgundy">{error}</p>
          </div>

          <nav className="flex items-center justify-between border-t hairline pt-5" aria-label="Question navigation">
            <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0}
              className="px-1 py-2 text-[12px] uppercase tracking-[0.16em] text-taupe hover:text-mahogany disabled:invisible">
              ← Back
            </button>
            <button type="submit"
              className="rounded-full bg-burgundy px-8 py-[13px] text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-burgundy">
              {last ? "See your Current Life Map" : "Continue"}
            </button>
          </nav>
        </form>
      </section>
    </main>
  );
}

export default function InterviewPage() {
  return <Suspense><Interview /></Suspense>;
}
