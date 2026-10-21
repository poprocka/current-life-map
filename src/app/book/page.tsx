"use client";
import { useEffect, useState } from "react";
import { CONTACT_EMAIL } from "@/content/contact";

/**
 * Booking link from the PDF email: /book#b=<one-time token>. The token sits in the URL fragment (never sent to a server
 * or written to logs); it is removed from the address bar at once and exchanged in a POST body for the Calendly page.
 */
export default function BookPage() {
  const [state, setState] = useState<"working" | "expired" | "unavailable">("working");
  useEffect(() => {
    const b = new URLSearchParams(window.location.hash.slice(1)).get("b");
    history.replaceState(null, "", window.location.pathname);
    if (!b) { setState("expired"); return; }
    fetch("/api/booking/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ b }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.url) window.location.replace(j.url);
        else setState(r.status === 410 || r.status === 400 ? "expired" : "unavailable");
      })
      .catch(() => setState("unavailable"));
  }, []);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-6">
      {state === "working" ? (
        <p className="text-[14px] text-mahogany/75" aria-live="polite">Opening the scheduling page…</p>
      ) : (
        <>
          <h1 className="font-serif text-[32px] font-light leading-tight">
            {state === "expired" ? "This link has expired or was already used." : "Scheduling isn't available just now."}
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mahogany/75">
            Reply to the email with your PDF, or write to{" "}
            <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, and Jana will send you a new link.
          </p>
        </>
      )}
    </main>
  );
}
