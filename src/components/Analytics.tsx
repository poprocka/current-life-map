"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { captureChannel } from "@/lib/channel";
import { GA_ID, GA_SIGNALS, excludedPath, loadAnalytics, pageView, readConsent, writeConsent, type Consent } from "@/lib/analytics";

/** Opt-in analytics banner + page views. Renders nothing when GA isn't configured or on the coach portal. */
export function Analytics() {
  const path = usePathname() ?? "/";
  const [consent, setConsent] = useState<Consent | "unknown">("unknown");
  useEffect(() => {
    captureChannel(); // first-party channel for the portal; works whether or not analytics is allowed
    const c = readConsent(); setConsent(c);
    const reopen = () => setConsent(null);
    window.addEventListener("clm:analytics-settings", reopen);
    return () => window.removeEventListener("clm:analytics-settings", reopen);
  }, []);
  useEffect(() => { if (consent === "granted") { loadAnalytics(); pageView(); } }, [consent, path]);

  if (!GA_ID || excludedPath(path) || consent !== null) return null;
  const choose = (v: "granted" | "denied") => { writeConsent(v); setConsent(v); };
  return (
    <div role="dialog" aria-label="Analytics choice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[560px] rounded-[20px] border border-linen-line bg-linen/95 p-4 shadow-[0_8px_30px_rgba(31,20,17,0.12)] backdrop-blur sm:bottom-5 sm:p-5">
      <p className="text-[13px] leading-relaxed text-mahogany/85">
        May we use Google Analytics to understand how people find and use this site{GA_SIGNALS ? ", including Google’s broad estimates of age range, gender and interests" : ""}?
        Your answers, reflections and results are never shared with it. <Link href="/privacy" className="underline underline-offset-4">Privacy notice</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("granted")} className="min-h-[40px] flex-1 rounded-full bg-burgundy px-5 text-[11.5px] uppercase tracking-[0.14em] text-linen sm:flex-none">Allow</button>
        <button type="button" onClick={() => choose("denied")} className="min-h-[40px] flex-1 rounded-full border border-linen-line px-5 text-[11.5px] uppercase tracking-[0.14em] text-mahogany sm:flex-none">No thanks</button>
      </div>
    </div>
  );
}

/** "Analytics settings" link (privacy page): clears the choice and shows the banner again. */
export function AnalyticsSettingsButton() {
  if (!GA_ID) return null;
  return (
    <button type="button" className="underline underline-offset-4 hover:text-burgundy"
      onClick={() => { try { localStorage.removeItem("clm:analytics-consent"); } catch { /* */ } window.dispatchEvent(new Event("clm:analytics-settings")); }}>
      Change analytics choice
    </button>
  );
}
