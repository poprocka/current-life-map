"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

import { BOOKING_ENABLED, useBooking } from "@/lib/useBooking";

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

/**
 * Optional next steps (spec §7.7), now two separate cards (Jana, 2026-10-13):
 *  - DeepDiveCard: book the Life Map Deep Dive — placed directly below the Map
 *  - PdfCard: receive the PDF by email (real delivery only; never a simulated "sent") — at the end, after the reflections
 */
export function DeepDiveCard({ token }: { token?: string }) {
  const { state: booking, book } = useBooking(token);

  return (
    <section id="deep-dive" className="mt-8 scroll-mt-8 xl:-mx-12 min-[1400px]:-mx-24 2xl:-mx-36" aria-label="Life Map Deep Dive">
      {/* Deep Dive */}
      <div className="grid gap-6 rounded-[28px] bg-burgundy p-8 text-linen sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
        <div>
        <p className="text-[10.5px] uppercase tracking-eyebrow text-linen/70">Life Map Deep Dive</p>
        <h2 className="mt-3 font-serif text-[30px] font-light leading-tight">Your Map shows where you are. Let&rsquo;s talk about where you&rsquo;re going.</h2>
        <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-linen/85">
          This is where real change begins. In a private 60-minute session, I listen to your story, help you read what your
          Map is telling you, and guide you toward the steps that matter most. From there, if you choose to continue, I walk
          beside you: believing in you, guiding you, and keeping you accountable as you build a life that feels like your own.
        </p>
        </div>
        <div className="lg:text-right">
        {BOOKING_ENABLED ? (
          <>
            <button type="button" onClick={book} disabled={booking.kind === "working"}
              className="inline-block rounded-full bg-linen px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-burgundy transition hover:bg-white disabled:opacity-70">
              {booking.kind === "working" ? "Opening…" : "Book a Deep Dive session"}
            </button>
            {booking.kind === "error" && <p role="status" className="mt-3 text-[12.5px] text-linen">{booking.message}</p>}
          </>
        ) : (
          <span aria-disabled="true" className="inline-block cursor-not-allowed rounded-full bg-linen/30 px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen/80">
            Booking opens soon
          </span>
        )}
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
          {state.kind === "sent" && <span className="text-mahogany">Your PDF is on its way to {email}.</span>}
          {state.kind === "error" && <span className="text-burgundy">{state.message}</span>}
        </p>
      </div>
      </div>
    </section>
  );
}
