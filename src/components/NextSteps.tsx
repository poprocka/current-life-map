"use client";
import Link from "next/link";
import { useState } from "react";
import type { LifeMapResult } from "@/engine/compute";

/** Set NEXT_PUBLIC_BOOKING_URL (Calendly) to enable booking. Until then the button says so honestly. */
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL ?? "";

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

/**
 * Optional next steps after the results (spec §7.7):
 *  - receive the PDF by email (real delivery only; never a simulated "sent")
 *  - book the 60-minute Life Map Deep Dive ($125)
 * Each links to the Privacy & Data Use Notice, which explains how the email or booking details are used.
 */
export function NextSteps({ result }: { result: LifeMapResult }) {
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
        body: JSON.stringify({ email, versions: result.versions }),
      });
      if (r.ok) return setState({ kind: "sent" });
      if (r.status === 503 || r.status === 404)
        return setState({ kind: "error", message: "Email delivery isn't connected yet, so nothing was sent. Your results stay on this page." });
      setState({ kind: "error", message: "We couldn't send your PDF just now. Please try again in a moment." });
    } catch {
      setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  const privacyLink = (
    <Link href="/privacy" className="underline underline-offset-4 hover:text-burgundy">Privacy &amp; Data Use Notice</Link>
  );

  return (
    <section className="mt-24 grid gap-6 lg:grid-cols-2" aria-label="Next steps">
      {/* PDF by email */}
      <div className="rounded-[28px] border hairline p-8 sm:p-10">
        <p className="eyebrow">Keep your Map</p>
        <h2 className="mt-3 font-serif text-[30px] font-light leading-tight">Receive your results as a PDF</h2>
        <p className="mt-3 text-[13.5px] leading-relaxed text-mahogany/75">
          We’ll email you a copy of your Current Life Map and interpretation. We use your email to deliver this report and to communicate about your request.
        </p>
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
          {state.kind === "sent" && <span className="text-mahogany">Your PDF is on its way to {email}.</span>}
          {state.kind === "error" && <span className="text-burgundy">{state.message}</span>}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-taupe">How your email is used: {privacyLink}.</p>
      </div>

      {/* Deep Dive */}
      <div className="rounded-[28px] bg-burgundy p-8 text-linen sm:p-10">
        <p className="text-[10.5px] uppercase tracking-eyebrow text-linen/70">Life Map Deep Dive</p>
        <h2 className="mt-3 font-serif text-[30px] font-light leading-tight">Explore your Map with Jana</h2>
        <p className="mt-3 text-[13.5px] leading-relaxed text-linen/85">
          A private 60-minute session to look closely at your present reality: what your Map shows, how the areas of your
          life affect one another, and what it means for you right now.
        </p>
        <p className="mt-5 font-serif text-[22px]">$125 · 60 minutes</p>
        {BOOKING_URL ? (
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-block rounded-full bg-linen px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-burgundy transition hover:bg-white">
            Book a Deep Dive
          </a>
        ) : (
          <span aria-disabled="true" className="mt-6 inline-block cursor-not-allowed rounded-full bg-linen/30 px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen/80">
            Booking opens soon
          </span>
        )}
        <p className="mt-6 text-[12px] leading-relaxed text-linen/70">
          How your booking details are connected to your Map: <Link href="/privacy" className="underline underline-offset-4 hover:text-white">Privacy &amp; Data Use Notice</Link>.
        </p>
      </div>
    </section>
  );
}
