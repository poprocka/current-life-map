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
 * One question is visible; "Show all" reveals the rest (Jana, 2026-10-13). Each reflection has its own Save button,
 * shown only while that field is active (Jana, 2026-10-15). Saving stores the replies encrypted against this assessment (CMS) so they appear in the Coach Report and
 * the emailed PDF. Drafts are kept on the device as the person types.
 *
 * After saving, a separate "read alongside" note may appear under a reflection — only where the question shares its
 * subject with one of their own earlier choices. Their words are never interpreted, and the Map never changes.
 */
export function OptionalReflections({ token, result }: { token?: string; result?: LifeMapResult }) {
  const [showAll, setShowAll] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const setOne = (id: string, st: Status) => setStatus((m) => ({ ...m, [id]: st }));

  useEffect(() => {
    const v = readLocal();
    setValues(v);
    if (R.questions.slice(1).some((q) => v[q.id]?.trim())) setShowAll(true);
  }, []);

  const saved = Object.values(status).some((st) => st === "saved" || st === "device");
  const layer = useMemo(() => (result && saved ? generateReflectionLayer(result, values) : null), [result, saved, values]);
  const alongside = (id: string) => layer?.items.find((i) => i.questionId === id)?.alongside;
  const visible = showAll ? R.questions : R.questions.slice(0, 1);

  // Saves every reflection written so far (one request), and reports the result under the field that was saved.
  const save = async (id: string) => {
    writeLocal(values);
    if (!token) return setOne(id, "device");
    setOne(id, "saving");
    try {
      const r = await fetch("/api/assessments/reflections", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, reflections: values }),
      });
      if (r.status === 503 || r.status === 404) return setOne(id, "device");
      setOne(id, r.ok ? "saved" : "error");
    } catch { setOne(id, "error"); }
  };

  return (
    <section id="reflections" className="scroll-mt-24 mt-24 rounded-[28px] border hairline p-8 sm:p-10" aria-labelledby="reflect-h">
      <p className="eyebrow">{R.eyebrow}</p>
      <h2 id="reflect-h" className="mt-3 font-serif text-[30px] font-light leading-tight">{R.title}</h2>
      <p className="mt-3 max-w-[760px] text-[13.5px] leading-relaxed text-mahogany/75">{R.intro}</p>

      <div id="reflections-list" className="mt-8 space-y-7">
        {visible.map((q) => {
          const st = status[q.id] ?? "idle";
          const done = st === "saved" || st === "device";
          return (
            // The Save button shows only while this field (or the button itself) has focus
            <div key={q.id} className="group">
              <label htmlFor={q.id} className="block text-[14px] leading-snug text-mahogany">{q.prompt}</label>
              <textarea id={q.id} rows={3} maxLength={R.maxLength} placeholder={R.placeholder} value={values[q.id] ?? ""}
                onChange={(e) => { const next = { ...values, [q.id]: e.target.value }; setValues(next); writeLocal(next); setOne(q.id, "dirty"); }}
                className="mt-3 w-full resize-y rounded-[16px] border border-linen-line bg-linen/60 px-4 py-3 text-[14px] leading-relaxed placeholder:text-taupe/70 focus:border-burgundy focus:outline-none" />
              <div className="mt-2 flex min-h-0 flex-wrap items-center gap-3">
                {/* mousedown keeps focus in the field, so the button doesn't disappear before the click lands */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => save(q.id)} disabled={st === "saving" || done || !values[q.id]?.trim()}
                  className="hidden rounded-full bg-burgundy px-6 py-2.5 text-[11.5px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany disabled:opacity-50 group-focus-within:inline-block">
                  {st === "saving" ? "Saving…" : done ? "Saved" : "Save"}
                </button>
                <p role="status" className="text-[12px] text-taupe">
                  {st === "saved" && "Saved. It will be included in your PDF."}
                  {st === "device" && "Saved on this device. It will be included in your PDF."}
                  {st === "error" && "We couldn't save just now. Your words are kept on this device. Please try again."}
                </p>
              </div>
              {alongside(q.id) && <p className="mt-2 text-[12.5px] italic leading-relaxed text-mahogany/70">{alongside(q.id)!.text}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" aria-expanded={showAll} aria-controls="reflections-list" onClick={() => setShowAll((s) => !s)}
          className="rounded-full border border-linen-line px-6 py-2.5 text-[11.5px] uppercase tracking-[0.16em] text-mahogany transition hover:border-burgundy hover:text-burgundy">
          {/* "Show more" without the count (Jana, 2026-10-13) */}
          {showAll ? "Show less" : "Show more"}
        </button>
      </div>
    </section>
  );
}
