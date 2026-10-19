import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import { ENV } from "./e2e/helpers";
import { freshDb, asAppDb } from "./db/pg";
import { setDb, type Db } from "@/server/db";
import { createAssessment } from "@/server/assessments";
import { middleware } from "@/middleware";

void ENV;
const req = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

describe("coach portal on its own host", () => {
  it("serves the portal only on coach.self-interview.com, and nothing public there", async () => {
    vi.stubEnv("COACH_HOST", "coach.self-interview.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://self-interview.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const loc = async (u: string) => { const r = await middleware(req(u)); return [r.status, r.headers.get("location")]; };
    expect(await loc("https://coach.self-interview.com/")).toEqual([307, "https://coach.self-interview.com/admin"]);
    expect(await loc("https://coach.self-interview.com/interview")).toEqual([307, "https://self-interview.com/interview"]);
    expect(await loc("https://self-interview.com/admin/clients")).toEqual([307, "https://coach.self-interview.com/admin/clients"]);
    expect((await middleware(req("https://self-interview.com/api/admin/export"))).status).toBe(404);
    expect((await middleware(req("https://self-interview.com/results"))).status).toBe(200);
    expect((await middleware(req("https://coach.self-interview.com/admin"))).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    vi.unstubAllEnvs();
  });
  it("without COACH_HOST everything stays on one host", async () => {
    expect((await middleware(req("https://example.vercel.app/admin"))).status).toBe(200);
  });
});

describe("retention", () => {
  let pg: PGlite, db: Db;
  beforeAll(async () => { pg = await freshDb(); db = asAppDb(pg); setDb(db); });
  it("removes unfinished, unlinked Self-Interviews after 90 quiet days and keeps everything else", async () => {
    const old = await createAssessment(db), fresh = await createAssessment(db), done = await createAssessment(db), linked = await createAssessment(db);
    await pg.query(`update assessments set last_activity_at = now() - interval '120 days' where id = any($1)`, [[old.id, done.id, linked.id]]);
    await pg.query(`update assessments set status = 'completed' where id = $1`, [done.id]);
    await pg.query(`insert into pdf_requests (assessment_id, email, provider) values ($1, 'a@b.co', 'fake')`, [linked.id]);
    const n = (await pg.query<{ n: number }>(`select purge_abandoned_assessments(90) as n`)).rows[0].n;
    expect(n).toBe(1);
    const left = (await pg.query<{ id: string }>(`select id from assessments`)).rows.map((r) => r.id);
    expect(left).not.toContain(old.id);
    expect(left).toEqual(expect.arrayContaining([fresh.id, done.id, linked.id]));
    expect((await pg.query(`select 1 from audit_events where action = 'retention.purge_unfinished'`)).rows.length).toBe(1);
  });
});
