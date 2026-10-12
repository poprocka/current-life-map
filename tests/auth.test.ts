/** Admin authorisation at the route layer (RLS is tested separately in tests/db). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "lifemap.example" }), cookies: async () => ({ getAll: () => [], set: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); } }));

const { coachForApi, requireCoach, setCoachResolver } = await import("@/server/auth");
const session = (role: "coach" | "admin") => ({ ok: true as const, session: { ctx: { userId: "u", aal: "aal2" as const }, role, db: {} as never, email: "jana@example.com" } });
const req = (origin?: string) => new Request("https://lifemap.example/api/admin/x", { method: "POST", headers: origin ? { origin } : {} });
const status = async (r: unknown) => (r instanceof NextResponse ? r.status : 200);

afterEach(() => setCoachResolver(null));

describe("admin authorisation", () => {
  it("signed out → 401, page redirects to sign-in", async () => {
    setCoachResolver(async () => ({ ok: false, reason: "signed_out" }));
    expect(await status(await coachForApi(req()))).toBe(401);
    await expect(requireCoach()).rejects.toThrow("REDIRECT /admin/login");
  });
  it("password only (no MFA) → 401, page redirects to MFA", async () => {
    setCoachResolver(async () => ({ ok: false, reason: "mfa_required" }));
    expect(await status(await coachForApi(req()))).toBe(401);
    await expect(requireCoach()).rejects.toThrow("REDIRECT /admin/mfa");
  });
  it("signed-in non-coach → 403", async () => {
    setCoachResolver(async () => ({ ok: false, reason: "not_coach" }));
    expect(await status(await coachForApi(req()))).toBe(403);
  });
  it("not configured → 503, never open", async () => {
    setCoachResolver(async () => ({ ok: false, reason: "not_configured" }));
    expect(await status(await coachForApi(req()))).toBe(503);
  });
  it("coach can read; export/delete need admin", async () => {
    setCoachResolver(async () => session("coach"));
    expect(await status(await coachForApi(req()))).toBe(200);
    expect(await status(await coachForApi(req(), { admin: true }))).toBe(403);
    setCoachResolver(async () => session("admin"));
    expect(await status(await coachForApi(req(), { admin: true }))).toBe(200);
  });
  it("mutations require a same-origin request (CSRF)", async () => {
    setCoachResolver(async () => session("admin"));
    expect(await status(await coachForApi(req(), { mutation: true }))).toBe(403);
    expect(await status(await coachForApi(req("https://evil.example"), { mutation: true }))).toBe(403);
    expect(await status(await coachForApi(req("https://lifemap.example"), { mutation: true }))).toBe(200);
  });
});
