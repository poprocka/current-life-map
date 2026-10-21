"use client";
import { useEffect, useState } from "react";
import { COACHING_CARD } from "@/content/coaching";
import { useBooking } from "@/lib/useBooking";

/**
 * Tabs that jump to each section of the results page, plus the two actions (Jana, 2026-10-13). They stay at the top
 * while scrolling and show which section you're in. Only sections present on the page are listed.
 */
// Navigation labels only (Jana, 2026-10-13); section titles and content are unchanged
const SECTIONS = [
  { id: "your-map", label: "Your Life Map" },
  { id: "reality-snapshot", label: "What Stands Out" },
  { id: "life-system", label: "How It Connects" },
  { id: "personal-insights", label: "Personal Insights" },
  { id: "reflections", label: "Reflections" },
];

export function SectionTabs({ token }: { token?: string }) {
  const [present, setPresent] = useState(SECTIONS);
  const booking = useBooking(token);
  const [active, setActive] = useState<string | null>("your-map"); // Your Map is above the fold on every device

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

  /** "Download results" (Jana, 20 Oct): no direct download; the PDF is only sent by email. Takes the person to the
   *  email field and puts the cursor in it. */
  function toPdf() {
    scrollTo("pdf-card");
    setTimeout(() => document.getElementById("pdf-email")?.focus({ preventScroll: true }), 600);
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
          <button type="button" onClick={toPdf} className={`${tab} border-burgundy text-burgundy hover:bg-white/60`}>
            Download results
          </button>
        </li>
        <li className="shrink-0">
          {/* Primary: apply for 1:1 coaching (21 Oct) — opens Calendly directly */}
          <button type="button" onClick={booking.book} disabled={booking.state.kind === "working"} className={`${tab} border-burgundy bg-burgundy text-linen hover:bg-mahogany disabled:opacity-70`}>
            {booking.state.kind === "working" ? "Opening…" : COACHING_CARD.cta}
          </button>
        </li>
      </ul>
      {booking.state.kind === "error" && <p role="status" className="mt-2 text-right text-[12px] text-burgundy">{booking.state.message}</p>}
    </nav>
  );
}
