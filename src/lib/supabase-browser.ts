"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Coach sign-in only. The anon key is public by design; every read is authorised server-side and by RLS. */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anon ? createBrowserClient(url, anon) : null;
}
