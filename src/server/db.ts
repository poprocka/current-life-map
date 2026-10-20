import "server-only";
/**
 * Minimal SQL access used by every server module.
 * Production: node-postgres pool on DATABASE_URL (Supabase pooler, server only).
 * Tests: PGlite with the same migration — so queries and RLS are exercised for real.
 */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Sql {
  /** Run fn in a transaction. */
  tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
}

let override: Db | null = null;
let pool: Db | null = null;

/** Tests inject an embedded database. */
export function setDb(db: Db | null) {
  override = db;
}

/**
 * Database errors are logged as their code and message only (Postgres and network errors never contain the
 * password or any query parameters), so connection problems can be diagnosed from the host's logs without
 * ever writing answers or identifiers to them.
 */
function logDbError(where: string, e: unknown) {
  const err = e as { code?: string; message?: string };
  console.error(`[db] ${where} failed: ${err?.code ?? "error"} ${String(err?.message ?? "").slice(0, 200)}`);
}

export function getDb(): Db | null {
  if (override) return override;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    const p = new Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
    pool = {
      query: (text, params) => (p.query(text, params as unknown[]) as Promise<never>).catch((e) => { logDbError("query", e); throw e; }),
      async tx(fn) {
        const c = await p.connect().catch((e) => { logDbError("connect", e); throw e; });
        try {
          await c.query("begin");
          const out = await fn({ query: (t, ps) => c.query(t, ps as unknown[]) as never });
          await c.query("commit");
          return out;
        } catch (e) {
          logDbError("transaction", e);
          await c.query("rollback").catch(() => undefined);
          throw e;
        } finally {
          c.release();
        }
      },
    };
  }
  return pool;
}

export interface CoachContext {
  userId: string;
  aal: "aal1" | "aal2";
}

/**
 * Run queries as the signed-in coach so Postgres RLS applies (same mechanism Supabase uses).
 * The server connection's elevated rights are dropped for the duration of the transaction.
 */
export async function asCoach<T>(db: Db, ctx: CoachContext, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return db.tx(async (sql) => {
    await sql.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [
      ctx.userId,
      JSON.stringify({ sub: ctx.userId, role: "authenticated", aal: ctx.aal }),
    ]);
    await sql.query("set local role authenticated");
    return fn(sql);
  });
}

export const NOT_CONFIGURED = { error: "storage_not_configured" } as const;
