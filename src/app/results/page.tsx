"use client";
import { useEffect, useMemo, useState } from "react";
import { ResultsView } from "@/components/ResultsView";
import { GeneratingMap } from "@/components/GeneratingMap";
import { useRouter } from "next/navigation";
import { CoachingCard, PdfCard } from "@/components/NextSteps";
import { OptionalReflections } from "@/components/OptionalReflections";
import { readStored } from "@/lib/useInterview";
import { computeLifeMap, type LifeMapResult } from "@/engine/compute";
import { generateResultInsights } from "@/engine/insights";
import { isComplete } from "@/engine/navigation";
import { trackOnce } from "@/lib/analytics";
import type { AnswerValue } from "@/content/types";

function ResumeInterview() {
  const router = useRouter();
  useEffect(() => { const t = setTimeout(() => router.replace("/interview?resume=1"), 2200); return () => clearTimeout(t); }, [router]);
  return <GeneratingMap title="Picking up where you left off" note="A few questions still need an answer. Taking you back to them." />;
}

export default function Results() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue> | null>(null);
  const [token, setToken] = useState<string | undefined>();
  useEffect(() => {
    const s = readStored();
    setAnswers(s?.answers ?? {});
    setToken(s?.token);
    // Freeze the server-side snapshot (idempotent). Without server storage this quietly does nothing.
    // If the last answers were still on their way, the server says "not complete yet" (409): try again shortly.
    const complete = (attempt: number) => fetch("/api/assessments/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: s!.token }) })
      .then((r) => { if (r.status === 409 && attempt < 3) setTimeout(() => complete(attempt + 1), 1500 * attempt); })
      .catch(() => undefined);
    if (s?.token) void complete(1);
  }, []);
  useEffect(() => { if (answers && isComplete(answers)) trackOnce("interview_complete"); }, [answers]);
  const result = useMemo<LifeMapResult | null>(() => (answers ? computeLifeMap(answers) : null), [answers]);

  if (!answers || !result) return <main className="min-h-dvh" aria-busy="true" />;
  // Not finished on this device: no dead end, no buttons; we take the person back to the next unanswered question.
  if (!isComplete(answers)) return <ResumeInterview />;

  return (
    <ResultsView result={result} insights={generateResultInsights(result, answers)} token={token} afterMap={<CoachingCard />}>
      {/* Optional reflections: one visible, "Show all" for the rest (Jana, 2026-10-13); then the PDF card */}
      <OptionalReflections token={token} result={result} />
      <PdfCard token={token} />
    </ResultsView>
  );
}
