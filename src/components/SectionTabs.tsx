"use client";
import { useEffect, useState } from "react";

/**
 * Tabs that jump to each section of the results page (Jana, 2026-10-13). They stay at the top while scrolling and
 * show which section you're in. Only sections present on the page are listed.
 */
const SECTIONS = [
  { id: "your-map", label: "Your Map" },
  { id: "reality-snapshot", label: "Reality Snapshot" },
  { id: "the-sun", label: "The Sun" },
  { id: "life-interconnections", label: "Life Interconnections" },
  { id: "personal-insights", label: "Personal Insights" },
  { id: "your-orbits", label: "Your Orbits" },
  { id: "your-question", label: "Your Question" },
  { id: "reflections", label: "Reflections" },
];

export function SectionTabs() {
  const [present, setPresent] = useState(SECTIONS);
  const [active, setActive] = useState<string | null>("your-map"); // Your Map is above the fold on every device (Jana, 2026-10-13)
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    setPresent(SECTIONS.filter((s) => els.some((e) => e.id === s.id)));
    const onScroll = () => {
      const line = 140;
      let cur: string | null = els[0]?.id ?? null;
      for (const e of els) if (e.getBoundingClientRect().top <= line) cur = e.id;
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
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav aria-label="Sections of your results" className="sticky top-0 z-30 -mx-6 mt-10 bg-linen/90 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10 lg:mx-0 lg:px-0 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36">
      {/* Same width as the Map card; tabs share the width evenly on laptop/desktop (Jana, 2026-10-13) */}
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:overflow-visible">
        {present.map((s) => (
          <li key={s.id} className="shrink-0 lg:flex-auto">
            <a href={`#${s.id}`} onClick={go(s.id)} aria-current={active === s.id ? "true" : undefined}
              className={`block whitespace-nowrap rounded-full border px-3.5 py-2 text-center text-[10.5px] uppercase tracking-[0.13em] lg:px-2 transition ${active === s.id ? "border-burgundy bg-burgundy text-linen" : "hairline text-mahogany/75 hover:border-burgundy/50 hover:text-burgundy"}`}>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
