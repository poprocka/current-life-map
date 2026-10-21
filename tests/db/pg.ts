/** Embedded Postgres (PGlite) with a minimal Supabase-like auth schema so migrations and RLS can be tested. */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

export async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
  `);
  // 0002 (storage bucket) needs Supabase's storage schema, which the embedded database doesn't have.
  for (const f of ["0001_initial.sql", "0003_channels.sql", "0004_retention.sql", "0005_coach_grants.sql", "0006_coaching_applications.sql"])
    await db.exec(fs.readFileSync(path.join(__dirname, "../../supabase/migrations", f), "utf8"));
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
    grant usage, select on all sequences in schema public to anon, authenticated;
  `);
  return db;
}

/** Wrap PGlite in the app's Db interface so server modules run unchanged against it. */
export function asAppDb(pg: PGlite): import("@/server/db").Db {
  const wrap = (q: { query: PGlite["query"] }) => ({
    query: async <T,>(text: string, params?: unknown[]) => ({ rows: (await q.query<T>(text, params as never)).rows }),
  });
  return {
    ...wrap(pg),
    tx: (fn) => pg.transaction((t) => fn(wrap(t as never))),
  } as import("@/server/db").Db;
}

/** Run queries as a given role / user / MFA level, inside a transaction. */
export async function as<T>(db: PGlite, who: { role: "anon" | "authenticated"; sub?: string; aal?: "aal1" | "aal2" }, fn: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [
      who.sub ?? "",
      JSON.stringify({ sub: who.sub, aal: who.aal ?? "aal1" }),
    ]);
    await db.exec(`set local role ${who.role}`);
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}
