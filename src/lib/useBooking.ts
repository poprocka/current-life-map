"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

/** Set NEXT_PUBLIC_BOOKING_ENABLED=1 once Calendly is connected. Until then the buttons say so honestly. */
export const BOOKING_ENABLED = process.env.NEXT_PUBLIC_BOOKING_ENABLED === "1";

export type BookingState = { kind: "idle" | "working" } | { kind: "error"; message: string };

/**
 * Opens Calendly for this Map (Jana, 2026-10-13: every "Book" button opens the scheduler directly, no anchor links).
 * The server creates a one-time link token for this Map and returns the scheduler URL; no answers leave this site and
 * the private results token never appears in a URL.
 */
export function useBooking(token?: string) {
  const [state, setState] = useState<BookingState>({ kind: "idle" });
  async function book() {
    if (!BOOKING_ENABLED || !token) return setState({ kind: "error", message: "Booking isn't connected for this Map yet. Please try again later." });
    const win = window.open("", "_blank");
    setState({ kind: "working" });
    try {
      const r = await fetch("/api/booking/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (r.ok) {
        const { url } = await r.json();
        track("booking_open", { from: "results" });
        if (win) win.location.href = url; else window.location.href = url;
        return setState({ kind: "idle" });
      }
      win?.close();
      setState({ kind: "error", message: r.status === 503 || r.status === 404 || r.status === 409
        ? "Booking isn't connected for this Map yet. Please try again later."
        : "We couldn't open booking just now. Please try again in a moment." });
    } catch {
      win?.close();
      setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }
  return { state, book, clear: () => setState({ kind: "idle" }) };
}
