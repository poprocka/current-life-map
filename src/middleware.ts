import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Keeps the coach's Supabase session fresh on admin routes. Authorisation itself happens server-side in each page/route. */
export async function middleware(req: NextRequest) {
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

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
