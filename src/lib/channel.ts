import { cleanSlug, sourceFromReferrer } from "@/content/channels";

/** First touch only: the channel that first brought this device here is kept, later visits don't overwrite it. */
const KEY = "clm:channel";
export interface Channel { source: string; campaign: string | null }

export function captureChannel() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return;
  try {
    if (localStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const source = cleanSlug(q.get("utm_source")) ?? (document.referrer ? sourceFromReferrer(document.referrer) : null);
    if (!source) return;
    localStorage.setItem(KEY, JSON.stringify({ source, campaign: cleanSlug(q.get("utm_campaign")) } satisfies Channel));
  } catch { /* private mode: channel stays unknown */ }
}

export function readChannel(): Channel | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); return v && cleanSlug(v.source) ? { source: v.source, campaign: cleanSlug(v.campaign) } : null; } catch { return null; }
}
