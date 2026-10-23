"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readStored } from "@/lib/useInterview";
import { useBooking } from "@/lib/useBooking";
import { PORTRAIT } from "@/content/meet-jana";

/** Set by the "Meet Jana" link on the results page (this tab only), so the page knows it was opened from a Map. */
export const FROM_MAP_KEY = "clm:meet-jana:from-map";
const hasStoredMap = () => { const s = readStored(); return !!s && Object.keys(s.answers ?? {}).length > 0; };

/**
 * Back to the person's results — only when they came here from their Map (Jana, 23 Oct). Opened as a standalone page
 * (a link shared on social media), there is no back button: the page stands on its own.
 */
export function BackLink() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(sessionStorage.getItem(FROM_MAP_KEY) === "1" && hasStoredMap()); } catch { setShow(false); } }, []);
  if (!show) return null;
  return (
    <Link href="/results" className="eyebrow inline-flex items-center gap-2 hover:text-burgundy">
      <span aria-hidden>←</span> Your Current Life Map
    </Link>
  );
}

/**
 * Invitation to the Self-Interview after "What's your approach?" (Jana, 23 Oct). Shown to everyone except visitors who
 * opened this page from their results (they've already taken it).
 */
export function SelfInterviewInvite({ title, text, cta }: { title: string; text: string; cta: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(sessionStorage.getItem(FROM_MAP_KEY) !== "1"); } catch { setShow(true); } }, []);
  if (!show) return null;
  return (
    <aside className="mt-16 rounded-[24px] bg-burgundy p-8 text-linen sm:mt-20 sm:p-10" aria-labelledby="si-invite">
      <h2 id="si-invite" className="font-serif text-[28px] font-light leading-tight [text-wrap:balance] sm:text-[34px]">{title}</h2>
      <p className="mt-4 max-w-[500px] text-[15px] leading-[1.75] text-linen/85">{text}</p>
      <Link href="/" className="mt-7 inline-block rounded-full bg-linen px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-burgundy transition hover:bg-white">
        {cta} <span aria-hidden>→</span>
      </Link>
    </aside>
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
