"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

export type BookingState = { kind: "idle" | "working" } | { kind: "error"; message: string };

/**
 * "Apply for 1:1 coaching" (21 Oct): opens Calendly's complimentary introductory conversation directly; Calendly's own
 * booking form collects the person's details. The server first creates a one-time link token for this Map, so the
 * booking that comes back is attached to it in the coach portal. Without a Map on this device (e.g. from "Meet Jana"),
 * it opens the plain Calendly page. No answers leave this site, and the private results
 * token never appears in a URL.
 */
export function useBooking(token?: string, from: "results" | "meet_jana" = "results") {
  const [state, setState] = useState<BookingState>({ kind: "idle" });
  async function book() {
    const win = window.open("", "_blank");
    setState({ kind: "working" });
    try {
      const r = await fetch("/api/booking/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token } : {}) });
      if (r.ok) {
        const { url } = await r.json();
        track("booking_open", { from });
        if (win) win.location.href = url; else window.location.href = url;
        return setState({ kind: "idle" });
      }
      win?.close();
      setState({ kind: "error", message: r.status === 503 || r.status === 404 || r.status === 409
        ? "Scheduling isn't available just now. Please try again later, or write to talk@self-interview.com."
        : "We couldn't open the scheduling page just now. Please try again in a moment." });
    } catch {
      win?.close();
      setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }
  return { state, book, clear: () => setState({ kind: "idle" }) };
}
