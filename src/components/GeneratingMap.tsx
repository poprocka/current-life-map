"use client";
import { LifeSystem } from "@/components/LifeSystem";

/**
 * Full-screen "your Map is being generated" moment (Jana, 20 Oct): shown while the last answers finish saving in the
 * background. No buttons, no save status; the slowly turning Life System is the loading animation.
 */
export function GeneratingMap({ title = "Your Map is being generated", note = "Bringing your answers together. This takes a moment." }: { title?: string; note?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" aria-busy="true">
      <div className="w-[min(320px,62vw)] animate-[spin_40s_linear_infinite] motion-reduce:animate-none">
        <LifeSystem labels="none" className="w-full" title="The Life System" />
      </div>
      <p className="eyebrow mt-10">The Current Life Map</p>
      <h1 role="status" aria-live="polite" className="mt-3 font-serif text-[32px] font-light leading-tight sm:text-[40px]">{title}</h1>
      <p className="mt-3 max-w-[420px] text-[14px] leading-relaxed text-mahogany/70">
        {note}
        <span aria-hidden="true" className="ml-1 inline-flex gap-1 align-middle">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-burgundy/70" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </span>
      </p>
    </main>
  );
}
