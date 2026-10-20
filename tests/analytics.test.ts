import { describe, expect, it, vi } from "vitest";

describe("analytics", () => {
  it("respects Global Privacy Control, strips fragments and queries, and drops anything off the event list", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    const store: Record<string, string> = {};
    const appended: { src: string }[] = [];
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
    vi.stubGlobal("document", { createElement: () => ({}) as { src: string }, head: { appendChild: (e: { src: string }) => appended.push(e) } });
    const win: Record<string, unknown> = { location: { origin: "https://map.example.com", pathname: "/results", href: "https://map.example.com/results?x=1#invite=SECRET" } };
    vi.stubGlobal("window", win);
    const nav = { globalPrivacyControl: false };
    vi.stubGlobal("navigator", nav);
    const a = await import("@/lib/analytics");
    nav.globalPrivacyControl = true;
    a.track("pdf_email_sent");
    expect(win.dataLayer).toBeUndefined(); // Global Privacy Control → nothing loaded
    nav.globalPrivacyControl = false; // default: on from arrival (no banner)
    a.track("interview_start", { entry: "client_link", email: "x@y.com", answer: "secret" } as never);
    a.pageView();
    const calls = (win.dataLayer as IArguments[]).map((x) => Array.from(x));
    const json = JSON.stringify(calls);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("x@y.com");
    expect(json).not.toContain("secret");
    expect(json).toContain("https://map.example.com/results\"");
    expect(calls.find((c) => c[1] === "interview_start")?.[2]).toEqual({ entry: "client_link" });
    expect(appended[0].src).toContain("G-TEST123");
    // Never on the coach portal
    (win.location as { pathname: string }).pathname = "/admin/clients";
    const before = calls.length; a.pageView();
    expect((win.dataLayer as unknown[]).length).toBe(before);
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
});
