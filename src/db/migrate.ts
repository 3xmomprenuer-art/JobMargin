/**
 * Database migration runner for JobMargin.
 *
 * Reads src/db/schema.sql and executes it against the Neon Postgres database
 * at DATABASE_URL. Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS
 * and CREATE EXTENSION IF NOT EXISTS so existing objects are never dropped.
 *
 * Usage: bun run src/db/migrate.ts   (or: bun run db:migrate)
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log(
    "DATABASE_URL is not set — connect a database (via the database card) before running migrations.\n" +
      "Skipping migration. The schema is at src/db/schema.sql and can be applied later.",
  );
  process.exit(0);
}

const schemaPath = resolve(import.meta.dirname ?? __dirname, "schema.sql");
const sql_text = readFileSync(schemaPath, "utf-8");

// Split into individual statements, stripping comments and blank chunks
const statements = sql_text
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter((s) => s.length > 0);

console.log(`Running ${statements.length} migration statements...`);

const sql = neon(DATABASE_URL);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  // Skip pure comment blocks (multi-line comments that got split)
  if (stmt.startsWith("/*") && stmt.endsWith("*/")) continue;

  try {
    await sql.query(stmt);
    console.log(`  [${i + 1}/${statements.length}] OK`);
  } catch (err: any) {
    console.error(`  [${i + 1}/${statements.length}] FAILED`);
    console.error(`  Statement: ${stmt.slice(0, 120)}...`);
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
}

console.log("Migration complete.");
