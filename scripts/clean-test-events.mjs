/* TAKE THE FIXTURES OUT OF A REAL DATABASE, ON PURPOSE, FROM A TERMINAL.
 *
 *   node scripts/clean-test-events.mjs                 # report only
 *   node scripts/clean-test-events.mjs --env=.env.production-temp
 *   node scripts/clean-test-events.mjs --env=… --apply # and remove them
 *
 * ═══ IT PRINTS BEFORE IT TOUCHES ANYTHING, ALWAYS ═════════════════════════
 *
 * With no `--apply` this is a read-only report: every night in the table, the
 * verdict on it, the evidence behind the verdict, and exactly how many orders,
 * tickets, scans, reservations and holds would go with each one. That is the
 * output a person reads before deciding, and `--apply` is a separate decision
 * taken afterwards.
 *
 * ═══ THE JUDGEMENT IS NOT IN THIS FILE ════════════════════════════════════
 *
 * It is `classifyEvent` in lib/club/test-data.ts, which is pure and has tests
 * against it — including one that says Saturday Madness cannot be classified as
 * a fixture whatever else is true of it. A deletion script whose rules only
 * exist inside the deletion script is a deletion script nobody can check.
 *
 * NO RULE LOOKS AT A DATE. Not one. Old is not a marker, draft is not a marker,
 * free is not a marker, and unsold is not a marker — every one of those
 * describes most real club nights.
 *
 * ═══ AND THE PROGRAMME IS HANDED IN AS PROTECTED ══════════════════════════
 *
 * `PROGRAMME` in lib/club/programme-seed.ts is the venue's real nights. Every
 * slug in it is refused before any evidence is read.
 *
 * ═══ ONE TRANSACTION PER NIGHT ════════════════════════════════════════════
 *
 * Children before parents, and the whole of one night's debris commits or none
 * of it does. A half-removed night — tickets gone, orders left pointing at
 * nothing — is worse than one that was never touched. */

import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./resolve-alias.mjs", import.meta.url);

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const APPLY = process.argv.includes("--apply");
const ENV_FILE = arg("env") ?? ".env.local";

/* The same KEY=value reading db-setup.mjs does, pointed at whichever file was
   asked for — so this can be run against a laptop or, deliberately and by
   name, against the server the club actually uses. */
for (const file of [ENV_FILE, ".env"]) {
  let text = "";
  try {
    text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  } catch {
    continue;
  }
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const { query, tx, closeDatabase, database } = await import("@/lib/db/client");
const { partitionEvents } = await import("@/lib/club/test-data");
const { PROGRAMME } = await import("@/lib/club/programme-seed");

const driver = await database();
console.log(
  `[clean] ${driver.kind === "postgres" ? "a Postgres server" : "PGlite, in this project"}` +
    `${APPLY ? "  ·  APPLY" : "  ·  report only"}\n`,
);

const protectedSlugs = new Set(PROGRAMME.map((night) => night.slug));

const rows = (
  await query(
    `SELECT id, slug, title, status, test_only, starts_at FROM events ORDER BY starts_at ASC`,
  )
).rows;

const events = rows.map((r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  testOnly: Boolean(r.test_only),
  status: r.status,
  startsAt: r.starts_at,
}));

const { fixtures, keep } = partitionEvents(events, protectedSlugs);

async function footprint(event) {
  const r = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM ticket_orders WHERE event_id = $1) AS orders,
       (SELECT COUNT(*)::int FROM tickets       WHERE event_id = $1) AS tickets,
       (SELECT COUNT(*)::int FROM reservations  WHERE event_id = $2) AS reservations,
       (SELECT COUNT(*)::int FROM seat_holds    WHERE event_id = $2) AS holds,
       (SELECT COUNT(*)::int FROM ticket_scans s
          JOIN tickets t ON t.id = s.ticket_id WHERE t.event_id = $1) AS scans,
       (SELECT COUNT(*)::int FROM ticket_deliveries d
          JOIN ticket_orders o ON o.id = d.order_id WHERE o.event_id = $1) AS deliveries`,
    [event.id, event.slug],
  );
  return r.rows[0];
}

console.log(`── KEEPING (${keep.length}) ──────────────────────────────────`);
for (const e of keep) {
  console.log(`  ${e.id.padEnd(24)} ${e.slug.padEnd(30)} ${String(e.status).padEnd(9)} ${e.title}`);
}

console.log(`\n── CLASSIFIED AS FIXTURES (${fixtures.length}) ───────────────`);
for (const { event, because } of fixtures) {
  const f = await footprint(event);
  console.log(`  ${event.id.padEnd(24)} ${event.slug.padEnd(30)} ${event.title}`);
  console.log(`      because: ${because.join("; ")}`);
  console.log(
    `      would remove: ${f.orders} orders, ${f.tickets} tickets, ${f.scans} scans, ` +
      `${f.deliveries} ticket deliveries, ${f.reservations} reservations, ${f.holds} holds`,
  );
}

if (!APPLY) {
  console.log(
    `\n[clean] nothing was changed. Re-run with --apply to remove the ${fixtures.length} night(s) above.`,
  );
  await closeDatabase();
  process.exit(0);
}

for (const { event } of fixtures) {
  await tx(async (q) => {
    /* Children before parents, and the event row last. `ticket_scans` points at
       a ticket, `ticket_deliveries` at an order, and `mail_deliveries` is keyed
       by (kind, key) where the key is an order id — so each is removed through
       the row that owns it rather than by guessing at a pattern. */
    await q.query(
      `DELETE FROM ticket_scans WHERE ticket_id IN
         (SELECT id FROM tickets WHERE event_id = $1)`,
      [event.id],
    );
    await q.query(
      `DELETE FROM ticket_deliveries WHERE order_id IN
         (SELECT id FROM ticket_orders WHERE event_id = $1)`,
      [event.id],
    );
    /* `mail_deliveries` is keyed (kind, key) where the key is whatever the
       message was about — an order id for a ticket, a reservation id for a
       table. Both are removed through the row that owns them rather than by
       guessing at a pattern, and only for this night. */
    await q.query(
      `DELETE FROM mail_deliveries WHERE key IN
         (SELECT id FROM ticket_orders WHERE event_id = $1)`,
      [event.id],
    );
    await q.query(
      `DELETE FROM mail_deliveries WHERE key IN
         (SELECT id FROM reservations WHERE event_id = $1)`,
      [event.slug],
    );
    await q.query(`DELETE FROM tickets       WHERE event_id = $1`, [event.id]);
    await q.query(`DELETE FROM ticket_orders WHERE event_id = $1`, [event.id]);
    /* The floor is keyed by slug, not by id — see lib/reservations/store.ts. */
    await q.query(`DELETE FROM seat_holds   WHERE event_id = $1`, [event.slug]);
    await q.query(`DELETE FROM reservations WHERE event_id = $1`, [event.slug]);
    await q.query(`DELETE FROM events WHERE id = $1`, [event.id]);
  });
  console.log(`  ✓ removed ${event.slug}`);
}

console.log(`\n[clean] removed ${fixtures.length} fixture night(s) and everything they owned.`);
await closeDatabase();
