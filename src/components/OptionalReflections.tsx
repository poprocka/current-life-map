"use client";
import { useEffect, useId, useState } from "react";
import { POST_MAP_REFLECTIONS as R } from "@/content/v10/reflections";

const KEY = "clm:v10:postmap";
type Status = "idle" | "dirty" | "saving" | "saved" | "device" | "error";

function readLocal(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function writeLocal(v: Record<string, string>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ }
}

/**
 * Optional reflections, directly above the PDF and Deep Dive cards (Jana, 2026-10-12).
 * Collapsed by default; a Save button appears once anything is written. Saving stores the replies
 * encrypted against this assessment (CMS) so they appear in the Coach Report and the emailed PDF.
 * Drafts are kept on the device as the person types so nothing is lost before they press Save.
 * Reflections never change the Map or its scores.
 */
export function OptionalReflections({ token }: { token?: string }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const panel = useId();

  useEffect(() => {
    const v = readLocal();
    setValues(v);
    if (Object.values(v).some((s) => s?.trim())) setOpen(true);
  }, []);

  const hasEntries = Object.values(values).some((s) => s?.trim());

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
    <section className="mt-20 rounded-[28px] border hairline" aria-labelledby="reflect-h">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-6 p-8 text-left sm:p-10">
        <span>
          <span className="eyebrow block">{R.eyebrow}</span>
          <span id="reflect-h" className="mt-3 block font-serif text-[30px] font-light leading-tight">{R.title}</span>
          <span className="mt-3 block max-w-[760px] text-[13.5px] leading-relaxed text-mahogany/75">{R.intro}</span>
        </span>
        <span aria-hidden className={`mt-2 shrink-0 text-[22px] leading-none text-taupe transition ${open ? "rotate-90" : ""}`}>›</span>
      </button>

      <div id={panel} hidden={!open} className="px-8 pb-8 sm:px-10 sm:pb-10">
        <div className="space-y-7">
          {R.questions.map((q) => (
            <div key={q.id}>
              <label htmlFor={q.id} className="block text-[14px] leading-snug text-mahogany">{q.prompt}</label>
              <textarea id={q.id} rows={3} maxLength={R.maxLength} placeholder={R.placeholder} value={values[q.id] ?? ""}
                onChange={(e) => { const next = { ...values, [q.id]: e.target.value }; setValues(next); writeLocal(next); setStatus("dirty"); }}
                className="mt-3 w-full resize-y rounded-[16px] border border-linen-line bg-linen/60 px-4 py-3 text-[14px] leading-relaxed placeholder:text-taupe/70 focus:border-burgundy focus:outline-none" />
            </div>
          ))}
        </div>
        {(hasEntries || status === "saved") && (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" onClick={save} disabled={status === "saving" || status === "saved"}
              className="rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-burgundy/90 disabled:opacity-60">
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save my reflections"}
            </button>
            <p role="status" className="text-[12px] text-taupe">
              {status === "saved" && "Saved. They'll be included in your PDF."}
              {status === "device" && "Saved on this device. They'll be included when you send your PDF."}
              {status === "error" && "We couldn't save just now. Your words are kept on this device — please try again."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
