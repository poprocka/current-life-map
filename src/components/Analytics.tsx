"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { captureChannel } from "@/lib/channel";
import { analyticsAllowed, clearConsent, loadAnalytics, pageView } from "@/lib/analytics";

/**
 * Page views from arrival (Jana, 20 Oct): no banner, no on-page switch. Off where the browser sends Global Privacy
 * Control. Renders nothing.
 */
export function Analytics() {
  const path = usePathname() ?? "/";
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    captureChannel(); // first-party channel for the portal; works whether or not analytics is on
    clearConsent(); // a choice left by the old banner no longer applies
    setAllowed(analyticsAllowed());
    const sync = () => setAllowed(analyticsAllowed());
    window.addEventListener("clm:analytics-consent", sync);
    return () => window.removeEventListener("clm:analytics-consent", sync);
  }, []);
  useEffect(() => { if (allowed) { loadAnalytics(); pageView(); } }, [allowed, path]);
  return null;
}
