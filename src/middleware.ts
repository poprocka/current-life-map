import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 1. Hosts (Jana, 19 Oct): the public site lives on NEXT_PUBLIC_SITE_URL (self-interview.com) and the coach portal on
 *    COACH_HOST (coach.self-interview.com). With COACH_HOST set, the portal answers only on its own host, and the coach
 *    host serves nothing public. Unset (local, preview deployments), everything works on one host as before.
 * 2. Keeps the coach's Supabase session fresh on admin routes. Authorisation itself happens server-side in each page/route.
 */
const isPortal = (p: string) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin");

export async function middleware(req: NextRequest) {
  const coachHost = process.env.COACH_HOST?.toLowerCase();
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const path = req.nextUrl.pathname;
  if (coachHost) {
    const onCoach = host === coachHost;
    if (onCoach && path === "/") return NextResponse.redirect(new URL("/admin", req.url));
    if (onCoach && !isPortal(path)) {
      const site = process.env.NEXT_PUBLIC_SITE_URL;
      return site ? NextResponse.redirect(new URL(path + req.nextUrl.search, site)) : new NextResponse(null, { status: 404 });
    }
    if (!onCoach && isPortal(path)) {
      if (path.startsWith("/api/")) return new NextResponse(null, { status: 404 });
      return NextResponse.redirect(new URL(path, `https://${coachHost}`));
    }
  }
  if (!isPortal(path)) return NextResponse.next();

  const res = NextResponse.next({ request: req });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res;
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  await sb.auth.getUser();
  return res;
}

// Everything except build assets and webhooks/cron (those are called by services directly on whichever host).
export const config = { matcher: ["/((?!_next/|favicon|icon|apple-icon|api/webhooks|api/cron).*)"] };
