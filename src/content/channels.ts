/**
 * Where people come from (Jana, 17 Oct). Short links redirect to the public page with standard UTM tags, so Google
 * Analytics and the coach portal both see the channel. Add a row here to create a new short link
 * (e.g. a podcast or a workshop): https://<domain>/<path>.
 *
 * Channel names are plain words, never personal data: they appear in URLs, analytics and the portal.
 */
export interface ShortLink { path: string; source: string; medium: string; campaign?: string; label: string }

export const SHORT_LINKS: ShortLink[] = [
  { path: "ig", source: "instagram", medium: "social", label: "Instagram (bio, stories, posts)" },
  { path: "li", source: "linkedin", medium: "social", label: "LinkedIn (profile, posts)" },
  { path: "card", source: "qr_card", medium: "print", label: "QR code on printed cards" },
  { path: "web", source: "website", medium: "referral", label: "Your website" },
  { path: "mail", source: "newsletter", medium: "email", label: "Newsletter or email signature" },
];

/** Friendly names for the portal. Unknown sources show as written. */
export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram", linkedin: "LinkedIn", qr_card: "QR card", website: "Website", newsletter: "Newsletter",
  facebook: "Facebook", tiktok: "TikTok", google: "Google search", direct: "Direct / unknown",
};
export const sourceLabel = (s: string | null | undefined) => (s ? SOURCE_LABELS[s] ?? s.replace(/_/g, " ") : SOURCE_LABELS.direct);

/** Channel values are short slugs only: anything else is dropped, so no personal data can travel this way. */
export const SLUG = /^[a-z0-9_-]{1,40}$/;
export const cleanSlug = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/[\s.]+/g, "_");
  return SLUG.test(s) ? s : null;
};

/** Without a tag, a known referrer still tells us the channel (Instagram's in-app browser sends l.instagram.com). */
export function sourceFromReferrer(ref: string): string | null {
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
    if (/(^|\.)linkedin\.com$/.test(h) || h === "lnkd.in") return "linkedin";
    if (/(^|\.)facebook\.com$/.test(h) || h === "fb.me") return "facebook";
    if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
    if (/(^|\.)google\.[a-z.]+$/.test(h)) return "google";
    return null;
  } catch { return null; }
}
