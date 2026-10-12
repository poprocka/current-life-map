"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResultsView } from "@/components/ResultsView";
import { NextSteps } from "@/components/NextSteps";
import { OptionalReflections } from "@/components/OptionalReflections";
import { readStored } from "@/lib/useInterview";
import { computeLifeMap, type LifeMapResult } from "@/engine/compute";
import { generateResultInsights } from "@/engine/insights";
import { isComplete } from "@/engine/navigation";
import type { AnswerValue } from "@/content/types";

export default function Results() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue> | null>(null);
  const [token, setToken] = useState<string | undefined>();
  useEffect(() => {
    const s = readStored();
    setAnswers(s?.answers ?? {});
    setToken(s?.token);
    // Freeze the server-side snapshot (idempotent). Without server storage this quietly does nothing.
    if (s?.token) void fetch("/api/assessments/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: s.token }) }).catch(() => undefined);
  }, []);
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

  return (
    <ResultsView result={result} insights={generateResultInsights(result, answers)}>
      {/* 5. Next steps — download, PDF by email and Life Map Deep Dive, each with the privacy notice link */}
      <NextSteps result={result} token={token} />
      {/* Optional reflections below the PDF and Deep Dive cards (Jana, 2026-10-12) */}
      <OptionalReflections token={token} />
    </ResultsView>
  );
}
