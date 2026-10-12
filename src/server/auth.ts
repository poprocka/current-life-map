import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { asCoach, getDb, type CoachContext, type Db } from "./db";
import { coachRole } from "./admin/queries";

export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in server components */ } },
    },
  });
}

export type CoachSession = { ctx: CoachContext; role: "coach" | "admin"; db: Db; email: string | null };
type Resolution = { ok: true; session: CoachSession } | { ok: false; reason: "not_configured" | "signed_out" | "mfa_required" | "not_coach" };

let override: (() => Promise<Resolution>) | null = null;
/** Tests only. */
export const setCoachResolver = (fn: typeof override) => { override = fn; };

/**
 * Server-side authorisation for every admin page and route:
 * verified Supabase user (getUser hits the auth server) → session at aal2 (MFA) → listed in coach_users.
 * Database reads then run under that identity so RLS applies as a second, independent check.
 */
export async function resolveCoach(): Promise<Resolution> {
  if (override) return override();
  const db = getDb(), sb = await supabaseServer();
  if (!db || !sb) return { ok: false, reason: "not_configured" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: "signed_out" };
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { ok: false, reason: "mfa_required" };
  const ctx: CoachContext = { userId: user.id, aal: "aal2" };
  const role = await asCoach(db, ctx, coachRole);
  if (!role) return { ok: false, reason: "not_coach" };
  return { ok: true, session: { ctx, role, db, email: user.email ?? null } };
}

/** For pages: redirect to sign-in / MFA as needed. */
export async function requireCoach(): Promise<CoachSession | { notConfigured: true } | { notCoach: true }> {
  const r = await resolveCoach();
  if (r.ok) return r.session;
  if (r.reason === "signed_out") redirect("/admin/login");
  if (r.reason === "mfa_required") redirect("/admin/mfa");
  return r.reason === "not_configured" ? { notConfigured: true } : { notCoach: true };
}

/** For route handlers: same-origin JSON requests from a verified coach (optionally admin). */
export async function coachForApi(req: Request, opts: { admin?: boolean; mutation?: boolean } = {}): Promise<CoachSession | NextResponse> {
  if (opts.mutation) {
    const origin = req.headers.get("origin"), host = (await headers()).get("host");
    if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const r = await resolveCoach();
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.reason === "not_configured" ? 503 : r.reason === "not_coach" ? 403 : 401 });
  if (opts.admin && r.session.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 });
  return r.session;
}
