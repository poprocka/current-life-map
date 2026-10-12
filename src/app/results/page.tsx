"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapLegend, PersonalMap } from "@/components/PersonalMap";
import { ORBIT_TINT } from "@/components/LifeSystem";
import { readStored } from "@/lib/useInterview";
import { computeLifeMap, type LifeMapResult } from "@/engine/compute";
import { isComplete } from "@/engine/navigation";
import type { AnswerValue } from "@/content/types";
import { SUPPORT_COMPETE_OPTIONS } from "@/content/v10/scales";
import { questionById } from "@/content/v10/question-bank";
import { OPENING } from "@/content/v10/opening";

const IMPORTANCE_SHORT = ["Not right now", "Slight", "Moderate", "Very important", "Highest priority"];
const ENERGY_SHORT: Record<string, string> = {
  "1": "Gives a lot",
  "0.5": "Gives more than it takes",
  "0": "Stable",
  "-0.5": "Takes more than it gives",
  "-1": "Drains a lot",
};

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
        <p className="mt-4 text-[14px] text-mahogany/75">It appears once every question in the self-interview has an answer.</p>
        <Link href="/interview?resume=1" className="mt-8 self-start rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen">
          Continue the self-interview
        </Link>
      </main>
    );

  const feelingsFor = (orbit: string) => {
    const q = questionById(`${orbit}.emotion`);
    const v = answers[`${orbit}.emotion`];
    const vals = Array.isArray(v) ? v : [];
    return q && vals.length ? vals.map((x) => q.options.find((o) => o.value === x)?.label ?? x).join(", ") : "—";
  };
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
      {/* The Map sits in its own block so it stands out on the page (Jana, 2026-10-12) */}
      <section className="mt-8 rounded-[32px] border hairline bg-linen-deep/70 px-5 pb-10 pt-10 xl:-mx-20 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_60px_-40px_rgba(84,15,38,0.25)] sm:px-10 lg:mt-10 lg:px-14 lg:pb-14 lg:pt-14" aria-labelledby="map-h">
        {/* Title centred above the Map and legend (Jana, 2026-10-12) */}
        <header className="mx-auto max-w-[600px] text-center">
          <p className="eyebrow">Your Current Life Map</p>
          <h1 id="map-h" className="mt-3 font-serif text-[28px] font-light leading-[1.1] [text-wrap:balance] sm:text-[34px]">{OPENING.title}</h1>
          {/* Intro copy supplied by Jana, 2026-10-12 */}
          <p className="mx-auto mt-3 max-w-[540px] text-[13px] leading-relaxed text-mahogany/75 [text-wrap:pretty]">
            This Map represents the reality you described: what matters most in this season, what feels supported and alive,
            what is taking or giving energy, how connected each area feels to you, and where the parts of your life appear to
            influence one another.
          </p>
        </header>
        {/* Map with its legend underneath; Map interpretation table always open on the right (Jana, 2026-10-12) */}
        <div className="mt-4 grid gap-12 lg:mt-2 lg:grid-cols-[1.7fr_1fr] lg:items-start lg:gap-14">
          <div className="min-w-0">
            <PersonalMap result={result} />
            <div className="mt-8 border-t hairline pt-6"><MapLegend /></div>
          </div>
          <div className="min-w-0 lg:pt-10">
            <h2 className="eyebrow">Map interpretation</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[12.5px] text-mahogany/85">
                <thead className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">
                  <tr>
                    <th scope="col" className="pb-3 pr-3 font-normal">Orbit</th>
                    <th scope="col" className="pb-3 pr-3 font-normal">Importance</th>
                    <th scope="col" className="pb-3 pr-3 font-normal">Energy</th>
                    <th scope="col" className="pb-3 font-normal">Feelings</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orbits.map((o) => (
                    <tr key={o.orbit} className="border-t hairline align-top">
                      <th scope="row" className="py-3 pr-3 font-normal">
                        <span className="flex items-center gap-2 whitespace-nowrap font-serif text-[15px] text-mahogany">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: ORBIT_TINT[o.orbit] }} />
                          {o.name}
                        </span>
                      </th>
                      <td className="py-3 pr-3">{o.statedImportance === null ? "—" : IMPORTANCE_SHORT[Math.round(o.statedImportance * 4)]}</td>
                      <td className="py-3 pr-3">{o.energy === null ? "—" : ENERGY_SHORT[String(o.energy)]}</td>
                      <td className="py-3 text-taupe">{feelingsFor(o.orbit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                    <li key={r.text}>{r.text}</li>
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
