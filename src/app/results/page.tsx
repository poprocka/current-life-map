"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { readStored } from "@/lib/useInterview";
import { computeLifeMap, type LifeMapResult } from "@/engine/compute";
import { isComplete } from "@/engine/navigation";
import type { AnswerValue } from "@/content/types";
import { SUPPORT_COMPETE_OPTIONS } from "@/content/v10/scales";

const ENERGY_WORDS: Record<string, string> = {
  "1": "gives you a lot of energy",
  "0.5": "gives more energy than it takes",
  "0": "keeps your energy fairly stable",
  "-0.5": "takes more energy than it gives",
  "-1": "drains a lot of your energy",
};

export default function Results() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue> | null>(null);
  useEffect(() => setAnswers(readStored()?.answers ?? {}), []);
  const result = useMemo<LifeMapResult | null>(() => (answers ? computeLifeMap(answers) : null), [answers]);

  if (!answers || !result) return <main className="min-h-dvh" aria-busy="true" />;
  if (!isComplete(answers))
    return (
      <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-6">
        <h1 className="font-serif text-[36px] font-light">Your Map isn't ready yet.</h1>
        <p className="mt-4 text-[14px] text-mahogany/75">It appears once every question in the Self-Interview has an answer.</p>
        <Link href="/interview?resume=1" className="mt-8 self-start rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen">
          Continue the Self-Interview
        </Link>
      </main>
    );

  const top3 = new Set(result.attentionOrder.slice(0, 3));
  const byId = Object.fromEntries(result.orbits.map((o) => [o.orbit, o]));
  const giving = result.orbits.filter((o) => (o.energy ?? 0) > 0);
  const taking = result.orbits.filter((o) => (o.energy ?? 0) < 0);
  const demand = result.orbits.find((o) => o.selections.largestDemand);
  const crowded = result.orbits.find((o) => o.selections.crowdedOut);
  const inter = SUPPORT_COMPETE_OPTIONS.find((o) => o.value === result.interdependence)?.label;

  return (
    <main className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-10">
      {result.configStatus !== "approved" && (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-taupe">Preview · methodology under review</p>
      )}

      {/* 1. Map */}
      <section className="grid gap-10 pt-10 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:pt-14" aria-labelledby="map-h">
        <PersonalMap result={result} />
        <div>
          <p className="eyebrow">Your Current Life Map</p>
          <h1 id="map-h" className="mt-4 font-serif text-[44px] font-light leading-[1.05] sm:text-[52px]">Your reality, as it is right now.</h1>
          <p className="mt-5 max-w-[440px] text-[14px] leading-relaxed text-mahogany/75">
            A small or distant Orbit is not a problem in itself. Some areas are quieter by choice in this season of life.
          </p>
          <div className="mt-8 border-t hairline pt-6"><MapLegend /></div>
          <details className="mt-6 text-[12.5px] text-mahogany/80">
            <summary className="cursor-pointer text-taupe underline underline-offset-4">Read the Map as text</summary>
            <table className="mt-4 w-full text-left">
              <thead className="text-taupe"><tr><th className="py-1 font-normal">Orbit</th><th className="font-normal">Importance</th><th className="font-normal">Energy</th></tr></thead>
              <tbody>
                {result.orbits.map((o) => (
                  <tr key={o.orbit} className="border-t hairline">
                    <td className="py-1.5">{o.name}</td>
                    <td>{o.statedImportance === null ? "—" : ["Not important right now", "Slightly", "Moderately", "Very", "Highest priority"][Math.round(o.statedImportance * 4)]}</td>
                    <td>{o.energy === null ? "—" : ENERGY_WORDS[String(o.energy)]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </section>

      {/* 2. Reality Snapshot */}
      <section className="mt-24" aria-labelledby="snap-h">
        <p className="eyebrow">Reality Snapshot</p>
        <h2 id="snap-h" className="mt-3 font-serif text-[36px] font-light">Where your life stands today</h2>
        <div className="mt-10 grid border-l border-t hairline sm:grid-cols-2 lg:grid-cols-3">
          {result.snapshot.map((s) => (
            <article key={s.key} className="border-b border-r hairline p-7">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-3 font-serif text-[30px] font-light">{s.orbit ? byId[s.orbit].name : "—"}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-mahogany/75">{s.why}</p>
              <p className="mt-4 text-[10.5px] uppercase tracking-[0.14em] text-taupe">
                {s.basis === "reported" ? "What you reported" : s.basis === "calculated" ? "Calculated from your answers" : ""}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Energy architecture */}
      <section className="mt-24 grid gap-12 lg:grid-cols-2" aria-labelledby="energy-h">
        <div>
          <p className="eyebrow">Energy Architecture</p>
          <h2 id="energy-h" className="mt-3 font-serif text-[36px] font-light">Where your energy goes</h2>
          <h3 className="mt-8 text-[11px] uppercase tracking-[0.16em] text-burgundy">What you reported</h3>
          <ul className="mt-4 space-y-2 text-[14px] leading-relaxed">
            <li><span className="text-taupe">Gives you energy: </span>{giving.length ? giving.map((o) => o.name).join(", ") : "none of the eight areas"}</li>
            <li><span className="text-taupe">Takes energy: </span>{taking.length ? taking.map((o) => o.name).join(", ") : "none of the eight areas"}</li>
            {inter && <li><span className="text-taupe">How the areas relate: </span>{inter}</li>}
          </ul>
        </div>
        <div className="lg:pt-[92px]">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-burgundy">What the Map suggests — to explore, not conclude</h3>
          <ul className="mt-4 space-y-4 text-[14px] leading-relaxed text-mahogany/85">
            {demand && crowded && demand.orbit !== crowded.orbit && (
              <li>{demand.name} takes most of your time and attention, and you named {crowded.name} as receiving less care because of it. That trade-off may be shaping more of your daily energy than either area alone shows.</li>
            )}
            {(() => {
              const d = result.orbits.filter((o) => (o.statedImportance ?? 0) >= 0.75 && (o.energy ?? 0) < 0).map((o) => o.name);
              if (!d.length) return null;
              const list = d.length === 1 ? d[0] : `${d.slice(0, -1).join(", ")} and ${d[d.length - 1]}`;
              return <li>{list} {d.length === 1 ? "matters" : "matter"} a great deal to you and currently {d.length === 1 ? "takes" : "take"} more energy than {d.length === 1 ? "it gives" : "they give"}. Importance and depletion together are worth looking at closely.</li>;
            })()}
            {result.orbits.filter((o) => (o.statedImportance ?? 1) <= 0.25 && (o.energy ?? 0) > 0).map((o) => (
              <li key={o.orbit}>{o.name} isn't a priority right now, yet it gives you energy. It may be a quiet source of support.</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Attention */}
      <section className="mt-24" aria-labelledby="att-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Where Attention May Matter Most</p>
            <h2 id="att-h" className="mt-3 font-serif text-[36px] font-light">All eight Orbits, in order</h2>
          </div>
          <details className="max-w-[420px] text-[12.5px] leading-relaxed text-mahogany/75">
            <summary className="cursor-pointer text-taupe underline underline-offset-4">How this order is made</summary>
            <p className="mt-3">The order combines how important each area is to you, the gap between that importance and the support your answers describe, how connected the area feels to you, and the area you chose as most influential. Areas you said drain energy, matter but get too little time, or are crowded out rise slightly. It is a starting point for reflection, not a verdict.</p>
          </details>
        </div>
        <ol className="mt-10 border-t hairline">
          {result.attentionOrder.map((id, i) => {
            const o = byId[id];
            const hi = top3.has(id);
            return (
              <li key={id} className={`grid gap-4 border-b hairline py-6 sm:grid-cols-[64px_220px_1fr] ${hi ? "" : "opacity-80"}`}>
                <span className={`font-serif text-[28px] font-light ${hi ? "text-burgundy" : "text-taupe"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={`font-serif ${hi ? "text-[28px]" : "text-[22px]"} font-light`}>{o.name}</span>
                <ul className="space-y-1.5 text-[13px] leading-relaxed text-mahogany/80">
                  {o.reasons.map((r) => (
                    <li key={r.text}><span className="mr-2 text-[10px] uppercase tracking-[0.12em] text-taupe">{r.basis === "reported" ? "Reported" : "Calculated"}</span>{r.text}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
