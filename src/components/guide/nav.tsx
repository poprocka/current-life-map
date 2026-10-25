"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BeginLink } from "@/components/BeginLink";
import { readStored } from "@/lib/useInterview";
import { OPENING, PRIVACY_LINE } from "@/content/v10/opening";

/** Set by "Understanding Your Life Map" on the results page (this tab only), so the guide knows it was opened from a Map. */
export const GUIDE_FROM_MAP_KEY = "clm:guide:from-map";

/** True when the visitor came from their Current Life Map and it is still on this device (results are kept on the device). */
function useFromMap() {
  const [fromMap, setFromMap] = useState(false);
  useEffect(() => {
    try {
      const s = readStored();
      setFromMap(sessionStorage.getItem(GUIDE_FROM_MAP_KEY) === "1" && !!s && Object.keys(s.answers ?? {}).length > 0);
    } catch { setFromMap(false); }
  }, []);
  return fromMap;
}

/** Top of the page: back to the Map for visitors from their results, otherwise back to the welcome page. */
export function GuideBackLink() {
  const fromMap = useFromMap();
  return (
    <Link href={fromMap ? "/results" : "/"} className="eyebrow inline-flex items-center gap-2 hover:text-burgundy">
      <span aria-hidden>←</span> {fromMap ? "Your Current Life Map" : "The Self-Interview"}
    </Link>
  );
}

/**
 * End of the page. From the results: back to the Map (answers and results stay on the device, nothing restarts).
 * Otherwise: begin the Self-Interview, with the same privacy note as on the welcome page (selecting Begin acknowledges it).
 */
export function GuideEndNav() {
  const fromMap = useFromMap();
  if (fromMap) {
    return (
      <Link href="/results" className="inline-block rounded-full bg-burgundy px-8 py-[15px] text-[13px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany">
        <span aria-hidden>← </span>Back to your Current Life Map
      </Link>
    );
  }
  return (
    <div>
      {/* No estimated time here: the guide's checklist above already says 20–25 minutes (Jana, 25 Oct) */}
      <BeginLink className="inline-block rounded-full bg-burgundy px-8 py-[15px] text-[13px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-burgundy">
        {OPENING.cta}
      </BeginLink>
      <p className="mt-8 max-w-[520px] border-t hairline pt-5 text-[12.5px] leading-relaxed text-taupe">
        {PRIVACY_LINE.text} {PRIVACY_LINE.agreeBefore}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-burgundy">{PRIVACY_LINE.linkLabel}</Link>
        {PRIVACY_LINE.agreeAfter}
      </p>
    </div>
  );
}
