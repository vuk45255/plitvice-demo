/* CREATE OR UPDATE THE SCHEMA, ON PURPOSE, FROM A TERMINAL.
 *
 *   npm run db:setup
 *
 * ═══ WHY THIS IS NOT A MIGRATION TOOL ═════════════════════════════════════
 *
 * Because the application already does this. Every cold start runs the same
 * idempotent DDL, in one transaction, behind an advisory lock — see
 * lib/db/schema.ts — so a deploy needs no migration step and cannot race
 * itself. Nothing depends on this script ever being run.
 *
 * It exists for the two moments when a person wants an answer rather than a
 * side effect: BEFORE the first deploy, to find out whether the connection
 * string in the environment actually works and whether the tables land; and
 * after adding an `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, to apply it
 * without waiting for the next request. It prints which database it reached,
 * which tables are there and how many nights are seeded.
 *
 * IT READS THE SAME ENVIRONMENT THE SERVER DOES. With DATABASE_URL set it
 * migrates that server — which is the point, and also the danger: it is the
 * one script here that will happily talk to production, because that is the
 * one thing it is for. It writes no rows of its own beyond the seeded events,
 * and it deletes nothing, ever.
 *
 * `npm run db:reset` is the other direction and is refused against anything
 * but the local in-process database. */

import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./resolve-alias.mjs", import.meta.url);

/* .env.local, as Next would read it, so `npm run db:setup` and `npm run dev`
   are looking at the same database. Nothing clever: KEY=value, first wins,
   and anything already in the environment beats the file. */
for (const file of [".env.local", ".env"]) {
  let text = "";
  try {
    text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  } catch {
    continue;
  }
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const reset = process.argv.includes("--reset");

const { database, query, closeDatabase } = await import("@/lib/db/client");

const driver = await database();
const where = driver.kind === "postgres" ? "a Postgres server" : "PGlite, in this project";
console.log(`[db] schema is up to date on ${where}.`);

if (reset) {
  if (driver.kind !== "pglite") {
    console.error(
      "[db] refusing to reset a real Postgres server. " +
        "Drop and recreate the database yourself if that is really what you want.",
    );
    await closeDatabase();
    process.exit(1);
  }
  /* Children before parents; the seat holds and reservations reference
     nothing, and events are referenced by everything. */
  for (const table of [
    "ticket_scans",
    "ticket_deliveries",
    "tickets",
    "ticket_orders",
    "seat_holds",
    "reservations",
    "staff_sessions",
  ]) {
    await query(`DELETE FROM ${table}`);
  }
  console.log("[db] every order, ticket, hold and reservation deleted. Events kept.");
}

const tables = await query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`,
);
console.log(`[db] tables: ${tables.rows.map((row) => row.table_name).join(", ")}`);

const events = await query(`SELECT COUNT(*)::int AS n FROM events`);
console.log(`[db] events: ${events.rows[0].n}`);

await closeDatabase();
