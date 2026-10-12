"use client";
import { useEffect, useRef, useState } from "react";
import { POST_MAP_REFLECTIONS as R } from "@/content/v10/reflections";

const KEY = "clm:v10:postmap";
type Status = "idle" | "saving" | "saved" | "device" | "error";

function readLocal(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

/**
 * Optional reflections after the Map (below the PDF and Deep Dive cards). They never change the Map or
 * the PDF. Saved on the device immediately; when server storage is connected, saved encrypted against
 * this assessment so Jana can read them before a Deep Dive.
 */
export function OptionalReflections({ token }: { token?: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const server = useRef(true);

  useEffect(() => setValues(readLocal()), []);

  const persist = (next: Record<string, string>) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!token || !server.current) return setStatus("device");
      setStatus("saving");
      try {
        const r = await fetch("/api/assessments/reflections", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, reflections: next }),
        });
        if (r.status === 503 || r.status === 404) { server.current = false; return setStatus("device"); }
        setStatus(r.ok ? "saved" : "error");
      } catch { setStatus("error"); }
    }, 900);
  };

  return (
    <section className="mt-16 rounded-[28px] border hairline p-8 sm:p-10" aria-labelledby="reflect-h">
      <p className="eyebrow">{R.eyebrow}</p>
      <h2 id="reflect-h" className="mt-3 font-serif text-[30px] font-light leading-tight">{R.title}</h2>
      <p className="mt-3 max-w-[760px] text-[13.5px] leading-relaxed text-mahogany/75">{R.intro}</p>
      <div className="mt-8 space-y-7">
        {R.questions.map((q) => (
          <div key={q.id}>
            <label htmlFor={q.id} className="block text-[14px] leading-snug text-mahogany">{q.prompt}</label>
            <textarea id={q.id} rows={3} maxLength={R.maxLength} placeholder={R.placeholder} value={values[q.id] ?? ""}
              onChange={(e) => { const next = { ...values, [q.id]: e.target.value }; setValues(next); persist(next); }}
              className="mt-3 w-full resize-y rounded-[16px] border border-linen-line bg-linen/60 px-4 py-3 text-[14px] leading-relaxed placeholder:text-taupe/70 focus:border-burgundy focus:outline-none" />
          </div>
        ))}
      </div>
      <p role="status" className="mt-4 min-h-[18px] text-[12px] text-taupe">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved."}
        {status === "device" && "Saved on this device."}
        {status === "error" && "We couldn't save just now. Your words are kept on this device."}
      </p>
    </section>
  );
}
