"use client";
import { useEffect, useMemo, useState } from "react";
import { POST_MAP_REFLECTIONS as R } from "@/content/v10/reflections";
import type { LifeMapResult } from "@/engine/compute";
import { generateReflectionLayer } from "@/engine/insights";

const KEY = "clm:v10:postmap";
type Status = "idle" | "dirty" | "saving" | "saved" | "device" | "error";

function readLocal(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function writeLocal(v: Record<string, string>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ }
}

/**
 * Optional reflections, after the interpretation and above the PDF card.
 * One question is visible; "Show all" reveals the rest (Jana, 2026-10-13). A Save button appears once anything is
 * written. Saving stores the replies encrypted against this assessment (CMS) so they appear in the Coach Report and
 * the emailed PDF. Drafts are kept on the device as the person types.
 *
 * After saving, a separate "read alongside" note may appear under a reflection — only where the question shares its
 * subject with one of their own earlier choices. Their words are never interpreted, and the Map never changes.
 */
export function OptionalReflections({ token, result }: { token?: string; result?: LifeMapResult }) {
  const [showAll, setShowAll] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const v = readLocal();
    setValues(v);
    if (R.questions.slice(1).some((q) => v[q.id]?.trim())) setShowAll(true);
  }, []);

  const hasEntries = Object.values(values).some((s) => s?.trim());
  const saved = status === "saved" || status === "device";
  const layer = useMemo(() => (result && saved ? generateReflectionLayer(result, values) : null), [result, saved, values]);
  const alongside = (id: string) => layer?.items.find((i) => i.questionId === id)?.alongside;
  const visible = showAll ? R.questions : R.questions.slice(0, 1);

  const save = async () => {
    writeLocal(values);
    if (!token) return setStatus("device");
    setStatus("saving");
    try {
      const r = await fetch("/api/assessments/reflections", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, reflections: values }),
      });
      if (r.status === 503 || r.status === 404) return setStatus("device");
      setStatus(r.ok ? "saved" : "error");
    } catch { setStatus("error"); }
  };

  return (
    <section className="mt-24 rounded-[28px] border hairline p-8 sm:p-10" aria-labelledby="reflect-h">
      <p className="eyebrow">{R.eyebrow}</p>
      <h2 id="reflect-h" className="mt-3 font-serif text-[30px] font-light leading-tight">{R.title}</h2>
      <p className="mt-3 max-w-[760px] text-[13.5px] leading-relaxed text-mahogany/75">{R.intro}</p>

      <div id="reflections-list" className="mt-8 space-y-7">
        {visible.map((q) => (
          <div key={q.id}>
            <label htmlFor={q.id} className="block text-[14px] leading-snug text-mahogany">{q.prompt}</label>
            <textarea id={q.id} rows={3} maxLength={R.maxLength} placeholder={R.placeholder} value={values[q.id] ?? ""}
              onChange={(e) => { const next = { ...values, [q.id]: e.target.value }; setValues(next); writeLocal(next); setStatus("dirty"); }}
              className="mt-3 w-full resize-y rounded-[16px] border border-linen-line bg-linen/60 px-4 py-3 text-[14px] leading-relaxed placeholder:text-taupe/70 focus:border-burgundy focus:outline-none" />
            {alongside(q.id) && <p className="mt-2 text-[12.5px] italic leading-relaxed text-mahogany/70">{alongside(q.id)!.text}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" aria-expanded={showAll} aria-controls="reflections-list" onClick={() => setShowAll((s) => !s)}
          className="rounded-full border border-linen-line px-6 py-2.5 text-[11.5px] uppercase tracking-[0.16em] text-mahogany transition hover:border-burgundy hover:text-burgundy">
          {/* "Show more" without the count (Jana, 2026-10-13) */}
          {showAll ? "Show less" : "Show more"}
        </button>
        {(hasEntries || saved) && (
          <button type="button" onClick={save} disabled={status === "saving" || saved}
            className="rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany disabled:opacity-60">
            {status === "saving" ? "Saving…" : saved ? "Saved" : "Save my reflections"}
          </button>
        )}
        <p role="status" className="text-[12px] text-taupe">
          {status === "saved" && "Saved. They'll be included in your PDF. Your Map and interpretation stay as they are."}
          {status === "device" && "Saved on this device. They'll be included when you send your PDF."}
          {status === "error" && "We couldn't save just now. Your words are kept on this device. Please try again."}
        </p>
      </div>
    </section>
  );
}
