"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

import Link from "next/link";
import { COACHING_CARD } from "@/content/coaching";
import { AVATAR } from "@/content/meet-jana";
import { useBooking } from "@/lib/useBooking";

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

/**
 * Optional next steps (spec §7.7), two separate cards:
 *  - CoachingCard: apply for 1:1 coaching with Jana (21 Oct; replaces the paid Life Map Deep Dive) — directly below the Map
 *  - PdfCard: receive the PDF by email (real delivery only; never a simulated "sent") — at the end, after the reflections
 */
export function CoachingCard({ token }: { token?: string }) {
  const { state, book } = useBooking(token);
  return (
    <section id="coaching" className="mt-8 scroll-mt-8 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36" aria-labelledby="coaching-h">
      {/* Two columns (Jana, 21 Oct). The banner is as wide as the Map card above, but its content lines up with the page
          content below (same left and right edges), so the inner padding mirrors the card's outward margins.
          "Meet Jana" sits next to the eyebrow. Eyebrow and headline on the left; all body text and the button on the right
          (Jana, 21 Oct); the headline matches the other section headlines (36px). */}
      <div className="grid gap-6 rounded-[28px] bg-burgundy p-8 text-linen sm:p-10 lg:grid-cols-2 lg:items-start lg:gap-16 xl:px-12 min-[1400px]:px-24 2xl:px-36">
        <div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10.5px] uppercase tracking-eyebrow text-linen/70">
            <span>{COACHING_CARD.eyebrow}</span>
            {/* Small avatar between the eyebrow and "Meet Jana": the Meet Jana portrait, cropped wider around the face (Jana, 21 Oct) */}
            <Link href="/meet-jana" className="shrink-0" aria-label="Meet Jana">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AVATAR.src} alt={AVATAR.alt} width={44} height={44} className="h-11 w-11 rounded-full object-cover ring-1 ring-linen/40" />
            </Link>
            <Link href="/meet-jana" className="text-linen underline decoration-linen/40 underline-offset-[6px] transition hover:decoration-linen">
              {COACHING_CARD.secondary} <span aria-hidden>→</span>
            </Link>
          </p>
          <h2 id="coaching-h" className="mt-3 font-serif text-[36px] font-light leading-tight">{COACHING_CARD.title}</h2>
        </div>
        <div>
          <div className="max-w-[480px] space-y-3 text-[13.5px] leading-relaxed text-linen/85">{COACHING_CARD.body.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
          {/* Opens Calendly directly (Jana, 21 Oct): Calendly's booking form collects their details */}
          <button type="button" onClick={book} disabled={state.kind === "working"}
            className="mt-5 inline-block rounded-full bg-linen px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-burgundy transition hover:bg-white disabled:opacity-70">
            {state.kind === "working" ? "Opening…" : COACHING_CARD.cta}
          </button>
          {state.kind === "error" && <p role="status" className="mt-3 text-[12.5px] text-linen">{state.message}</p>}
        </div>
      </div>
    </section>
  );
}

export function PdfCard({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SendState>({ kind: "idle" });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState({ kind: "error", message: "Enter a valid email address, like name@example.com." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, reflections: (() => { try { return JSON.parse(localStorage.getItem("clm:v10:postmap") ?? "{}"); } catch { return {}; } })() }),
      });
      if (r.ok) { track("pdf_email_sent"); return setState({ kind: "sent" }); }
      if (r.status === 503 || r.status === 404 || r.status === 409)
        return setState({ kind: "error", message: "Email delivery isn't connected yet, so nothing was sent. Your results stay on this page." });
      setState({ kind: "error", message: "We couldn't send your PDF just now. Please try again in a moment." });
    } catch {
      setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  return (
    <section id="pdf-card" className="mt-6 scroll-mt-24" aria-label="Receive your results as a PDF">
      {/* PDF by email */}
      {/* Same card style as the Map block (Jana, 2026-10-13) */}
      <div className="grid gap-6 rounded-[28px] border hairline bg-linen-deep/70 p-8 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_60px_-40px_rgba(84,15,38,0.25)] sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
        <p className="eyebrow">Keep your Map</p>
        <h2 className="mt-3 font-serif text-[30px] font-light leading-tight">Receive your results as a PDF</h2>
        <p className="mt-3 text-[13.5px] leading-relaxed text-mahogany/75">
          We’ll email you a copy of your Current Life Map and interpretation.
        </p>
        </div>
        <div>
        <form onSubmit={send} className="mt-6 flex flex-col gap-3 sm:flex-row" noValidate>
          <label htmlFor="pdf-email" className="sr-only">Email address</label>
          <input
            id="pdf-email"
            type="email"
            autoComplete="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state.kind === "error") setState({ kind: "idle" }); }}
            className="min-w-0 flex-1 rounded-full border border-linen-line bg-linen/60 px-5 py-3 text-[14px] placeholder:text-taupe/70 focus:border-burgundy focus:outline-none"
          />
          <button type="submit" disabled={state.kind === "sending" || state.kind === "sent"}
            className="rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany disabled:opacity-60">
            {state.kind === "sending" ? "Sending…" : state.kind === "sent" ? "Sent" : "Send my PDF"}
          </button>
        </form>
        <p role="status" className="mt-3 min-h-[20px] text-[12.5px]">
          {state.kind === "sent" && (
            <span className="inline-flex items-center gap-2.5 rounded-full bg-white/70 px-4 py-2.5 text-[14px] text-burgundy shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
              {/* paper plane */}
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2.5 10.6 13.4" /><path d="M21.5 2.5 14.6 21.4l-4-8-8-4 18.9-6.9Z" />
              </svg>
              <span>Your PDF is on its way to <b className="font-medium">{email}</b>.</span>
            </span>
          )}
          {state.kind === "error" && <span className="text-burgundy">{state.message}</span>}
        </p>
      </div>
      </div>
    </section>
  );
}
