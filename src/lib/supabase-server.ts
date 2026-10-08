import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Server only — never import from client components. Returns null when not configured. */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const NOT_CONFIGURED = { error: "storage_not_configured" } as const;
