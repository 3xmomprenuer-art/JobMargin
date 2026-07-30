import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Lazy handle to the team's database (Neon serverless Postgres over HTTP).
 * Resolved per query so the site builds and serves before a database is
 * connected — the error only surfaces when a query actually runs without
 * `DATABASE_URL`.
 *
 * Use it as a tagged template inside a `createServerFn()` handler or an
 * `src/routes/api/*` route (never in client code):
 *
 *   import { sql } from "~/db";
 *
 *   const getPosts = createServerFn().handler(async () => {
 *     const rows = await sql`select id, title, created_at from posts`;
 *     // Coerce non-primitive columns before returning to the client —
 *     // timestamps come back as JS Dates, which React will not render:
 *     return rows.map((r) => ({ ...r, created_at: String(r.created_at) }));
 *   });
 */
function getQueryFn(): NeonQueryFunction {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — connect a database (via the database card) before running queries.",
    );
  }
  return neon(url);
}

export const sql: NeonQueryFunction = (strings, ...values) => {
  return getQueryFn()(strings, ...values);
};
