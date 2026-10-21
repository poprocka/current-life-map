"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readStored } from "@/lib/useInterview";
import { useBooking } from "@/lib/useBooking";
import { PORTRAIT } from "@/content/meet-jana";

/** Back to the person's results when this device has them (results live on the device, so nothing is lost by leaving). */
export function BackLink() {
  const [hasMap, setHasMap] = useState(false);
  useEffect(() => { const s = readStored(); setHasMap(!!s && Object.keys(s.answers ?? {}).length > 0); }, []);
  return (
    <Link href={hasMap ? "/results" : "/"} className="eyebrow inline-flex items-center gap-2 hover:text-burgundy">
      <span aria-hidden>←</span> {hasMap ? "Your Current Life Map" : "The Self-Interview"}
    </Link>
  );
}

/** Same action as the banner on the results page: opens the introductory conversation in Calendly, linked to this
 *  device's Map when there is one. */
export function ApplyButton({ label, className }: { label: string; className: string }) {
  const [token, setToken] = useState<string | undefined>();
  useEffect(() => { setToken(readStored()?.token); }, []);
  const { state, book } = useBooking(token, "meet_jana");
  return (
    <>
      <button type="button" onClick={book} disabled={state.kind === "working"} className={className}>
        {state.kind === "working" ? "Opening…" : label}
      </button>
      {state.kind === "error" && <p role="status" className="mt-3 text-[13px] text-burgundy">{state.message}</p>}
    </>
  );
}

/** The single portrait, shown at its own proportions. If the file isn't in place yet, nothing is shown in its place. */
export function Portrait({ className }: { className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PORTRAIT.src} alt={PORTRAIT.alt} width={PORTRAIT.width} height={PORTRAIT.height} onError={() => setMissing(true)} decoding="async" fetchPriority="high"
        sizes="(min-width: 1024px) 44vw, 100vw" className="h-auto w-full rounded-[4px]" />
    </figure>
  );
}
