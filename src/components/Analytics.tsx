"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { captureChannel } from "@/lib/channel";
import { GA_ID, gpcOn, loadAnalytics, pageView, readConsent, writeConsent, type Consent } from "@/lib/analytics";

/**
 * Page views once the visitor has agreed (by selecting Begin on the welcome page, Jana 20 Oct). No banner.
 * Renders nothing.
 */
export function Analytics() {
  const path = usePathname() ?? "/";
  const [consent, setConsent] = useState<Consent>(null);
  useEffect(() => {
    captureChannel(); // first-party channel for the portal; works whether or not analytics is on
    setConsent(readConsent());
    const sync = () => setConsent(readConsent());
    window.addEventListener("clm:analytics-consent", sync);
    return () => window.removeEventListener("clm:analytics-consent", sync);
  }, []);
  useEffect(() => { if (consent === "granted") { loadAnalytics(); pageView(); } }, [consent, path]);
  return null;
}

/** Privacy page: turn analytics off (or back on) on this device. */
export function AnalyticsSettingsButton() {
  const [state, setState] = useState<"on" | "off" | "gpc" | null>(null);
  useEffect(() => { setState(gpcOn() ? "gpc" : readConsent() === "denied" ? "off" : "on"); }, []);
  if (!GA_ID || state === null) return null;
  if (state === "gpc") return <span>Your browser&rsquo;s Global Privacy Control signal is on, so analytics stays off on this device.</span>;
  const toggle = () => {
    if (state === "on") { writeConsent("denied"); setState("off"); window.location.reload(); } // reload unloads Google Analytics
    else { writeConsent("granted"); setState("on"); window.dispatchEvent(new Event("clm:analytics-consent")); }
  };
  return (
    <span>
      {state === "on" ? "Analytics is on for this device. " : "Analytics is off for this device. "}
      <button type="button" className="underline underline-offset-4 hover:text-burgundy" onClick={toggle}>
        {state === "on" ? "Turn analytics off" : "Turn analytics back on"}
      </button>
    </span>
  );
}
