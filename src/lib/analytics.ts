/**
 * Google Analytics 4 (Jana, 17 Oct): site activity and audience, never answers.
 *
 * - Off unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set, and loaded only after the visitor says yes (opt-in banner).
 * - Never on the coach portal (/admin) or the booking hand-off (/book).
 * - Pages are reported as origin + path only: no query string and no #fragment (client-link and booking codes live
 *   there), and no page titles beyond the site's own.
 * - Events are a fixed list with fixed, non-identifying parameters. No answers, reflections, emails, names, tokens,
 *   assessment IDs or results are ever sent; `track` drops anything not on the list.
 * - Age, gender and interests in GA come only from Google signals. They are turned on only when
 *   NEXT_PUBLIC_GA_SIGNALS=1 and the visitor has agreed, and the banner says so.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const GA_SIGNALS = process.env.NEXT_PUBLIC_GA_SIGNALS === "1";
const KEY = "clm:analytics-consent";

export type Consent = "granted" | "denied" | null;
export const readConsent = (): Consent => { try { const v = localStorage.getItem(KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; } };
export const writeConsent = (v: Exclude<Consent, null>) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };
export const clearConsent = () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } };

export const excludedPath = (p: string) => p.startsWith("/admin") || p.startsWith("/book") || p.startsWith("/api");
/** Page address for GA: path plus campaign tags only (utm_*), so channels are attributed; never other parameters or the #fragment. */
const cleanLocation = () => {
  const q = new URLSearchParams(window.location.search), keep = new URLSearchParams();
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) { const v = q.get(k); if (v && /^[A-Za-z0-9_.-]{1,40}$/.test(v)) keep.set(k, v); }
  const qs = keep.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
};

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
let loaded = false;

export function loadAnalytics() {
  const w = window as W;
  if (!GA_ID || loaded || excludedPath(window.location.pathname)) return;
  loaded = true;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  w.gtag("consent", "default", { analytics_storage: "granted", ad_storage: GA_SIGNALS ? "granted" : "denied", ad_user_data: "denied", ad_personalization: GA_SIGNALS ? "granted" : "denied" });
  w.gtag("js", new Date());
  w.gtag("config", GA_ID, { send_page_view: false, allow_google_signals: GA_SIGNALS, allow_ad_personalization_signals: false, page_location: cleanLocation() });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function pageView() {
  const w = window as W;
  if (!loaded || !w.gtag || excludedPath(window.location.pathname)) return;
  w.gtag("event", "page_view", { page_location: cleanLocation(), page_path: window.location.pathname });
}

/** The only events sent, and the only parameters each may carry. */
const EVENTS = {
  interview_start: ["entry"],          // entry: "public" | "client_link"
  interview_progress: ["step", "of"],  // a step number reached, for drop-off
  interview_complete: [],
  pdf_download: [],
  pdf_email_sent: [],
  booking_open: ["from"],              // from: "results" | "email"
} as const;
type EventName = keyof typeof EVENTS;
type Param = string | number;

export function track(name: EventName, params: Record<string, Param> = {}) {
  const w = window as W;
  if (!loaded && readConsent() === "granted") loadAnalytics(); // an event can fire before the banner component mounts
  if (!loaded || !w.gtag || excludedPath(window.location.pathname)) return;
  const allowed = EVENTS[name] as readonly string[];
  const safe: Record<string, Param> = {};
  for (const k of allowed) {
    const v = params[k];
    if (typeof v === "number" && Number.isFinite(v)) safe[k] = v;
    else if (typeof v === "string" && /^[a-z_]{1,20}$/.test(v)) safe[k] = v;
  }
  w.gtag("event", name, safe);
}

/** Once per device (e.g. interview_complete), so revisiting results doesn't count twice. */
export function trackOnce(name: EventName, params: Record<string, Param> = {}) {
  const k = `clm:ga-once:${name}`;
  if (!GA_ID || readConsent() !== "granted") return; // don't mark as sent when nothing could be sent
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch { /* private mode */ }
  track(name, params);
}
