"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LifeSystem } from "@/components/LifeSystem";
import { ResponseControl } from "@/components/ResponseControl";
import { CHAPTERS, ORBIT_IDS, chapterById } from "@/content/v10/chapters";
import type { OrbitId } from "@/content/types";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { TOTAL_STEPS, isComplete, progress, questionAt, resumeStep, validate } from "@/engine/navigation";
import { useInterview } from "@/lib/useInterview";
import { GeneratingMap } from "@/components/GeneratingMap";

// Orbits are numbered in Roman numerals in the order of the Life System (Jana, 2026-10-12)
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
function eyebrowFor(kind: string, id: string) {
  if (kind === "sun") return "The Sun";
  if (kind === "orbit") return `Orbit ${ROMAN[ORBIT_IDS.indexOf(id as OrbitId)]}`;
  return "The Life System";
}

function Interview() {
  const router = useRouter();
  const params = useSearchParams();
  // Saving happens quietly in the background; no save status is shown (Jana, 20 Oct).
  // "Begin" on the home page links to /interview?new=1 and starts over; "Continue where you left off" resumes.
  const fresh = params.get("new") === "1";
  const { ready, answers, step, answer, goTo, flush } = useInterview({ fresh });
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    // Drop ?new=1 once the slate is clean, so a later reload doesn't wipe the new answers.
    if (ready && fresh) router.replace("/interview");
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
  if (generating) return <GeneratingMap />;

  const q = questionAt(step);
  const chapter = chapterById(q.chapterId);
  const value = answers[q.id];
  const last = step === TOTAL_STEPS - 1;
  // Shows the current position from the first question; never drops below what has been answered.
  const pct = Math.round(Math.max(progress(answers), (step + 1) / TOTAL_STEPS) * 100);

  // Chapter-level progress
  const chapterIndex = CHAPTERS.findIndex((c) => c.id === chapter.id);
  const chapterQs = ACTIVE_QUESTIONS.filter((x) => x.chapterId === chapter.id);
  const posInChapter = chapterQs.findIndex((x) => x.id === q.id) + 1;
  const segments = CHAPTERS.map((c, i) => {
    const qs = ACTIVE_QUESTIONS.filter((x) => x.chapterId === c.id);
    const answered = qs.filter((x) => answers[x.id] !== undefined).length / (qs.length || 1);
    const position = i < chapterIndex ? 1 : i === chapterIndex ? posInChapter / qs.length : 0;
    return { id: c.id, fill: Math.max(answered, position) };
  });

  const next = () => {
    const err = validate(q, value);
    if (err) return setError(err);
    if (!last) return goTo(step + 1);
    if (isComplete(answers)) {
      // "Your Map is being generated": the last answers finish saving, then the Map opens (at least ~1.8 s, so the moment reads).
      setGenerating(true);
      const started = Date.now();
      void flush().catch(() => undefined).finally(() =>
        setTimeout(() => router.push("/results"), Math.max(0, 1800 - (Date.now() - started))));
      return;
    }
    const missing = ACTIVE_QUESTIONS.findIndex((x) => !x.optional && answers[x.id] === undefined);
    setError("A few earlier questions still need an answer. Taking you there.");
    setTimeout(() => goTo(missing), 900);
  };

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      {/* Left: area */}
      <aside className="border-b hairline bg-linen-deep/60 px-6 pb-6 pt-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:[justify-content:safe_center] lg:overflow-y-auto lg:py-10 lg:border-b-0 lg:border-r lg:px-14">
        {/* Visual + text form one block, centred vertically in the pane (Jana, 2026-10-12) */}
        <div className="flex items-center gap-5 lg:flex-col lg:items-stretch lg:gap-0">
          <LifeSystem active={q.chapterId} labels="none" className="w-[84px] shrink-0 lg:mx-auto lg:w-full lg:max-w-[min(430px,48vh)]"
            title={`The Life System, currently showing ${chapter.name}.`} />
          <div key={chapter.id} className="animate-rise lg:mt-10">
            <p className="eyebrow">{eyebrowFor(chapter.kind, chapter.id)}</p>
            <h2 className="mt-1.5 font-serif text-[30px] font-light leading-none lg:mt-3 lg:text-[44px]">{chapter.name}</h2>
            {chapter.subtitle && <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-burgundy">{chapter.subtitle}</p>}
          </div>
        </div>
        <div key={`${chapter.id}-d`} className="animate-rise">
          <p className="mt-4 max-w-[460px] text-[13px] leading-relaxed text-mahogany/75 lg:mt-5 lg:text-[13.5px]">{chapter.description}</p>
          {chapter.explores.length > 0 && (
            <p id="explore-h" className="eyebrow mt-6">Explore</p>
          )}
          {chapter.explores.length > 0 && (
            <ul aria-labelledby="explore-h" className="-mx-6 mt-3 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:max-w-[460px] lg:flex-wrap lg:px-0">
              {/* Static, all equally readable — no per-question highlight (Jana, 2026-10-12) */}
              {chapter.explores.map((e) => (
                <li key={e} className="shrink-0 rounded-full border border-taupe-light px-3 py-1 text-[11px] tracking-wide text-mahogany/80">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Right: question */}
      <section className="flex min-h-[60dvh] flex-col px-6 py-6 sm:px-12 lg:h-dvh lg:px-20 lg:py-10">
        <header>
          <div className="flex items-baseline justify-between text-[12px] text-taupe">
            <span aria-live="polite" className="eyebrow">
              Section {chapterIndex + 1} of {CHAPTERS.length}
              <span className="sr-only">, question {posInChapter} of {chapterQs.length} in this section</span>
            </span>          </div>
          {/* One segment per chapter; each fills question by question (Jana, 2026-10-12) */}
          <div className="mt-3 flex gap-1.5" role="progressbar" aria-label="Overall progress"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            {segments.map((s) => (
              <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-linen-line">
                <div className="h-full rounded-full bg-burgundy transition-[width] duration-500" style={{ width: `${s.fill * 100}%` }} />
              </div>
            ))}
          </div>
        </header>

        <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <div key={q.id} className="my-auto animate-rise py-10">
            <h1 id="prompt" ref={headingRef} tabIndex={-1}
              className="max-w-[580px] font-serif text-[27px] font-light leading-[1.22] outline-none sm:text-[33px]">
              {q.prompt}
            </h1>
            {q.instruction && (
              <p id="prompt-hint" className="mt-3 text-[13px] text-taupe">{q.instruction}</p>
            )}
            <div className={`${q.instruction ? "mt-7" : "mt-9"} max-w-[580px]`}>
              <ResponseControl q={q} value={value} labelledBy="prompt"
                onChange={(v) => { setError(null); answer(q.id, v); }} />
            </div>
            <p role="alert" className="mt-4 min-h-[20px] text-[13px] text-burgundy">{error}</p>
          </div>

          <nav className="flex items-center justify-between border-t hairline pt-5" aria-label="Question navigation">
            {/* On the first question, Back returns to the introduction; answers stay saved */}
            <button type="button" onClick={() => (step === 0 ? router.push("/") : goTo(step - 1))}
              aria-label={step === 0 ? "Back to the introduction" : "Back to the previous question"}
              className="px-1 py-2 text-[12px] uppercase tracking-[0.16em] text-taupe hover:text-mahogany">
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
