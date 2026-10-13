"use client";
import { useEffect, useState } from "react";

/**
 * Tabs that jump to each section of the results page, plus the two actions (Jana, 2026-10-13). They stay at the top
 * while scrolling and show which section you're in. Only sections present on the page are listed.
 */
const SECTIONS = [
  { id: "your-map", label: "Your Map" },
  { id: "reality-snapshot", label: "Reality Snapshot" },
  { id: "life-system", label: "Your Life System" },
  { id: "personal-insights", label: "Personal Insights" },
  { id: "reflections", label: "Reflections" },
];

function reflectionsFromDevice(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem("clm:v10:postmap") ?? "{}"); } catch { return {}; }
}

export function SectionTabs({ token }: { token?: string }) {
  const [present, setPresent] = useState(SECTIONS);
  const [active, setActive] = useState<string | null>("your-map"); // Your Map is above the fold on every device
  const [dl, setDl] = useState<"idle" | "working" | "error">("idle");

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    setPresent(SECTIONS.filter((s) => els.some((e) => e.id === s.id)));
    const onScroll = () => {
      let cur: string | null = els[0]?.id ?? null;
      for (const e of els) if (e.getBoundingClientRect().top <= 140) cur = e.id;
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On phones the row scrolls sideways: keep the current section's tab in view
  useEffect(() => {
    if (!active) return;
    const a = document.querySelector<HTMLElement>(`nav[aria-label="Sections of your results"] a[href="#${active}"]`);
    const ul = a?.closest("ul");
    if (a && ul && ul.scrollWidth > ul.clientWidth) ul.scrollTo({ left: a.offsetLeft - ul.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const go = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); scrollTo(id); };

  /** Download the same PDF as the email. The token goes in the POST body, never the URL. If downloading isn't
   *  available (not connected yet, or no saved Map), we take the person to the email-a-PDF card instead. */
  async function download() {
    if (!token) return scrollTo("pdf-card");
    setDl("working");
    try {
      const r = await fetch("/api/report/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, reflections: reflectionsFromDevice() }) });
      if (!r.ok) { setDl(r.status === 503 || r.status === 404 ? "idle" : "error"); return scrollTo("pdf-card"); }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = "current-life-map.pdf"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDl("idle");
    } catch { setDl("error"); scrollTo("pdf-card"); }
  }

  const tab = "block whitespace-nowrap rounded-full border px-3.5 py-2 text-center text-[10.5px] uppercase tracking-[0.13em] transition";
  return (
    <nav aria-label="Sections of your results" className="sticky top-0 z-30 -mx-6 mt-10 bg-linen/90 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10 lg:mx-0 lg:px-0 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36">
      {/* Same width as the Map card: sections on the left, the two actions on the right */}
      <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] lg:overflow-visible">
        {present.map((s) => (
          <li key={s.id} className="shrink-0">
            <a href={`#${s.id}`} onClick={go(s.id)} aria-current={active === s.id ? "true" : undefined}
              className={`${tab} ${active === s.id ? "border-burgundy/60 bg-white/70 text-burgundy" : "hairline text-mahogany/75 hover:border-burgundy/50 hover:text-burgundy"}`}>
              {s.label}
            </a>
          </li>
        ))}
        <li className="shrink-0 lg:ml-auto">
          {/* Secondary */}
          <button type="button" onClick={download} disabled={dl === "working"} className={`${tab} border-burgundy text-burgundy hover:bg-white/60 disabled:opacity-60`}>
            {dl === "working" ? "Preparing…" : "Download results"}
          </button>
        </li>
        <li className="shrink-0">
          {/* Primary */}
          <a href="#deep-dive" onClick={go("deep-dive")} className={`${tab} border-burgundy bg-burgundy text-linen hover:bg-mahogany`}>Book a Deep Dive session</a>
        </li>
      </ul>
      {dl === "error" && <p role="status" className="mt-2 text-right text-[12px] text-burgundy">We couldn't prepare your PDF just now. You can have it emailed below.</p>}
    </nav>
  );
}
