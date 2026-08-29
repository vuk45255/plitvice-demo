/* TAKE THE DEVELOPMENT DEBRIS OUT OF THE CLUB'S REAL DATABASE.
 *
 *   node scripts/production-test-data-cleanup.mjs --against-database-url
 *   node scripts/production-test-data-cleanup.mjs --against-database-url --execute
 *   node scripts/production-test-data-cleanup.mjs --against-database-url --verify
 *
 * ═══ WHAT THIS IS, AND WHY IT IS NOT scripts/clean-test-events.mjs ════════
 *
 * That script removes fixture NIGHTS and everything hanging off them, and it
 * reads a `.env` file to find the database. Both are wrong for this job.
 *
 *   · The debris is not all on fixture nights. The scanner harness buys a REAL
 *     ticket to a REAL night — that is the entire point of it — so its order
 *     sits on Saturday Madness alongside the club's own. An event-shaped
 *     cleanup cannot see it, and a night-shaped cleanup must never remove the
 *     night to get at it.
 *   · A file must not choose which database gets deleted from. The connection
 *     string is the operator's, from the operator's own shell, for one command.
 *
 * ═══ THE SIX GUARDS ═══════════════════════════════════════════════════════
 *
 *   1. --against-database-url must be typed. Nothing runs without it.
 *   2. DATABASE_URL must already be in the environment. NO `.env` FILE IS
 *      READ, ever — see the note above.
 *   3. The connection must be a real Postgres server. PGlite is refused: it
 *      would mean the string was forgotten and this is a laptop.
 *   4. DRY RUN IS THE DEFAULT. Deleting takes a second flag, `--execute`,
 *      which exists only so that the destructive run cannot be the one you get
 *      by pressing up-arrow and return.
 *   5. There is no reset. No `DROP`, no `TRUNCATE`, no `DELETE FROM <table>`
 *      without a key list — every statement below is scoped to a set of ids
 *      this run assembled and printed first. If a set is empty, its statement
 *      does not run.
 *   6. TICKETING_DEV_MODE is switched off for this process whatever the shell
 *      says, so connecting cannot SEED the very fixture nights this reports on.
 *
 * ═══ HOW A ROW IS JUDGED — EVIDENCE, NEVER CIRCUMSTANCE ═══════════════════
 *
 * The judgement about NIGHTS is `classifyEvent` in lib/club/test-data.ts: a
 * pure function with tests against it, including one that says Saturday
 * Madness cannot be classified as a fixture whatever else is true of it. Every
 * slug in the venue's real programme is protected before any evidence is read.
 *
 * The judgement about ORDERS is below, and it is the same shape: a marker a
 * harness DELIBERATELY WROTE — a channel, a payment provider that is not and
 * never will be a real one, the name it puts at the top of the order. Not a
 * date, not a price, not an amount, not "looks synthetic".
 *
 * NOTHING IS DELETED ON A GUESS. A row that carries a hint and not a marker is
 * reported under AMBIGUOUS — MANUAL REVIEW REQUIRED and left exactly where it
 * is. Leaving one junk row costs the club nothing; removing one real booking
 * cannot be undone.
 *
 * ═══ ONE TRANSACTION, ALL OF IT OR NONE OF IT ═════════════════════════════
 *
 * Children before parents, every id known before the first DELETE, and the
 * whole job in a single `tx()`. A half-cleaned database — tickets gone, orders
 * left pointing at nothing — is worse than one nobody touched.
 *
 * ═══ ONE HONEST SIDE EFFECT ═══════════════════════════════════════════════
 *
 * Connecting through lib/db/client applies the idempotent schema and seeds any
 * missing programme night, exactly as a page load does. That happens on the
 * dry run too. It is the same DDL every deploy runs and it removes nothing. */

import { register } from "node:module";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);

const USAGE = `
  node scripts/production-test-data-cleanup.mjs --against-database-url [--execute | --verify]

  Required
    --against-database-url   Consent. This reads, and with --execute writes to,
                             whatever DATABASE_URL names.

  Modes
    (none)                   DRY RUN. Reports what would go and what stays.
                             Changes nothing.
    --execute                Actually remove what the dry run listed, in one
                             transaction.
    --verify                 Read-only check after a cleanup: what is left,
                             and confirmation that the real programme is intact.

  Environment (read from the shell only; no .env file is loaded)
    DATABASE_URL             Required. The pooled connection string.
`;

/* ── guard 1: say you mean it ───────────────────────────────────────────── */
if (!flag("against-database-url")) {
  console.error(
    "[cleanup] refusing to run: pass --against-database-url to say you mean it.",
  );
  console.error(USAGE);
  process.exit(1);
}

/* ── guard 2: the operator's own connection string, from their own shell ── */
if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[cleanup] DATABASE_URL is not set. This script reads no .env file on " +
      "purpose — set it in this shell, for this one command.",
  );
  process.exit(1);
}

const EXECUTE = flag("execute");
const VERIFY = flag("verify");

if (EXECUTE && VERIFY) {
  console.error("[cleanup] --execute and --verify are different jobs. Pass one.");
  process.exit(1);
}

/* ── guard 6: this process may not create a fixture night ───────────────── */

/* CONNECTING RUNS THE SCHEMA, AND THE SCHEMA SEEDS PROBE NIGHTS WHEN DEV MODE
 * IS OPEN. `seedTestEvents` in lib/db/schema.ts writes "Plitvice Test Night"
 * and its small sister behind `devMode()`, and devMode() reads the shell. An
 * operator whose terminal still carries TICKETING_DEV_MODE=true from an
 * afternoon of local work would otherwise have this script CREATE two fixture
 * nights in the club's database on the way to reporting fixture nights in it.
 *
 * So it is removed from this process, whatever the shell says — the same guard
 * scripts/scanner-test-ticket.mjs takes, for the same reason. */
delete process.env.TICKETING_DEV_MODE;

register("./resolve-alias.mjs", import.meta.url);

const { query, tx, closeDatabase, databaseKind } = await import("@/lib/db/client");
const { partitionEvents } = await import("@/lib/club/test-data");
const { PROGRAMME } = await import("@/lib/club/programme-seed");

/* THE MARKERS AND EVERY STATEMENT THIS SCRIPT RUNS. Not written here, because
   SQL that only this file can reach is SQL that is first executed against the
   club's own database — which is exactly how `LIKE ${i + 1}` lost its dollar
   and reached Neon as `LIKE 1`. lib/club/cleanup-sql.test.ts runs every one of
   these strings against a real Postgres; this file runs the same strings. */
const SQL = await import("@/lib/club/cleanup-sql");
const {
  TEST_CHANNELS,
  TEST_PROVIDERS,
  TEST_CUSTOMER_NAMES,
  FIXTURE_ONLY_PROVIDERS,
  RESERVED_EMAIL_DOMAINS,
  HINT_EMAIL_DOMAINS,
  domainPatterns,
} = SQL;

/* ── guard 3: a real server, and it is never named out loud ─────────────── */
const kind = await databaseKind();
if (kind !== "postgres") {
  console.error(
    `[cleanup] expected a Postgres server and got ${kind}. This is the local ` +
      "PGlite database, not the club's. No row was removed. (The local schema " +
      "was applied on connect, as it is by any command that opens this database.)",
  );
  await closeDatabase();
  process.exit(1);
}

/* NOT "read-only", and the label must not say so. Connecting runs the schema —
   see the note at the top of this file — so even --verify has applied the DDL
   and re-seeded any missing programme night before it prints a word. What is
   true of both non-destructive modes is that THIS SCRIPT removes nothing. */
const mode = VERIFY
  ? "VERIFY — reports only; removes nothing"
  : EXECUTE
    ? "EXECUTE — ROWS WILL BE REMOVED"
    : "DRY RUN — this script removes nothing";
console.log(`\n[cleanup] connected to a Postgres server.`);
console.log(`[cleanup] mode: ${mode}\n`);

/* ═══ WHAT A HARNESS WROTE ON PURPOSE ═════════════════════════════════════
 *
 * Every value here is written by a script in this repository and by nothing
 * else. They are listed as data rather than buried in SQL so that the report
 * can print the rule it applied next to the rows it applied it to.
 *
 *   scanner-test  scripts/scanner-test-ticket.mjs stamps the order on three
 *                 sides: channel, payment provider and the customer name.
 *   stress        scripts/stress.mjs confirms every payment through a provider
 *                 called 'stress'.
 *   test          the suite's own provider (lib/ticketing/lifecycle.test.ts).
 *                 It runs against PGlite in memory and can never reach a real
 *                 server — it is listed because a marker that cannot appear
 *                 costs nothing, and one that appears unexpectedly is worth
 *                 seeing in the report.
 *   dev           THE ONE THAT CAN ACTUALLY BE HERE. /api/ticketing/dev/confirm
 *                 mints a paid order through `devPaymentProvider`, whose id is
 *                 'dev' (lib/ticketing/payments/dev.ts), and `confirmPayment`
 *                 writes that id into payment_provider. A developer who pointed
 *                 DATABASE_URL at the club's server and confirmed a ticket in
 *                 dev mode left exactly this row — channel 'web', provider
 *                 'dev', status paid. Without it here that order is invisible
 *                 to the marker rules AND trips the unmarked-paid-order guard
 *                 below, so the probe night it sits on gets held back and the
 *                 whole cleanup quietly does nothing on the most likely
 *                 dataset there is.
 *
 * NOT A REAL PROVIDER'S NAME AMONG THEM, and there never will be: the one that
 * is coming is PaySpot, it is not integrated, and when it is it will write
 * 'payspot'. See lib/ticketing/payments/payspot.ts. */
/* 'dev' IS EVIDENCE ONLY WHERE THE NIGHT IS ALREADY A FIXTURE.
 *
 * It is the one fake provider that can genuinely be in the club's database:
 * /api/ticketing/dev/confirm mints a paid order through `devPaymentProvider`
 * (id 'dev'), and although that route 404s in every production build, a
 * developer running a local server against DATABASE_URL=<the club's> reaches
 * it. Such an order is channel 'web', provider 'dev', status paid.
 *
 * WHY IT IS NOT IN THE LIST ABOVE. Today there is NO real payment provider —
 * PaySpot is not integrated — so 'dev' is not obviously distinguishable from
 * however the club got its first genuine admission issued. On a night that is
 * already a fixture the question does not arise: the night is a probe and
 * everything on it goes with it. On a REAL night it is exactly the ambiguity
 * this script refuses to resolve by itself, so it is REPORTED and left.
 *
 * Without this the guard below would see a dev-paid order on "Plitvice Test
 * Night", hold the night back, and the cleanup would quietly do nothing on the
 * single most likely dataset there is. */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ── the nights ─────────────────────────────────────────────────────────── */

const protectedSlugs = new Set(PROGRAMME.map((night) => night.slug));

const eventRows = (
  await query(SQL.SELECT_EVENTS)
).rows;

const events = eventRows.map((r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  status: r.status,
  testOnly: Boolean(r.test_only),
  startsAt: r.starts_at,
}));

const { fixtures, keep } = partitionEvents(events, protectedSlugs);

/* ── the orders, and which of them a harness wrote ──────────────────────── */

/* Every order on a fixture night goes with the night. On a REAL night, only an
   order carrying a marker goes — and the night itself is never touched. */
const fixtureIds = fixtures.map(({ event }) => event.id);

const markedOrders = (
  await query(SQL.SELECT_MARKED_ORDERS, [
    TEST_CHANNELS,
    TEST_PROVIDERS,
    TEST_CUSTOMER_NAMES,
  ])
).rows;

/* Why each one is going, in the words of the rule that caught it. */
const reasonFor = (order) => {
  const because = [];
  if (TEST_CHANNELS.includes(order.channel)) because.push(`channel '${order.channel}'`);
  if (TEST_PROVIDERS.includes(order.payment_provider)) {
    because.push(`payment provider '${order.payment_provider}'`);
  }
  if (TEST_CUSTOMER_NAMES.includes(order.customer_name)) {
    because.push(`customer name '${order.customer_name}'`);
  }
  return because;
};

const fixtureIdSet = new Set(fixtureIds);
/* Marked orders that sit on a night the club is keeping. These are the ones
   scripts/clean-test-events.mjs cannot see. */
const strayOrders = markedOrders.filter((o) => !fixtureIdSet.has(o.event_id));

/* ── the one guard that can move a night out of the condemned list ──────── */

/* A FIXTURE NIGHT HOLDING AN ORDER NOBODY MARKED IS NOT A FIXTURE ANY MORE.
 *
 * The classification says the night is a probe. If somebody has nonetheless
 * bought a ticket to it through the front door — no test channel, no harness
 * provider, and the money recorded as paid — then either the flag is wrong or
 * a guest is holding an admission to it. Both are reasons to stop and ask a
 * person, and neither is a reason to delete a paid ticket at midnight. */
const suspicious = [];
if (fixtureIds.length > 0) {
  const unmarked = (
    await query(SQL.SELECT_UNMARKED_PAID_ON_FIXTURES, [
      fixtureIds,
      TEST_CHANNELS,
      [...TEST_PROVIDERS, ...FIXTURE_ONLY_PROVIDERS],
      TEST_CUSTOMER_NAMES,
    ])
  ).rows;
  for (const row of unmarked) suspicious.push(row);
}

const suspiciousIds = new Set(suspicious.map((r) => r.event_id));
const condemned = fixtures.filter(({ event }) => !suspiciousIds.has(event.id));
const heldBack = fixtures.filter(({ event }) => suspiciousIds.has(event.id));

const condemnedIds = condemned.map(({ event }) => event.id);
const condemnedSlugs = condemned.map(({ event }) => event.slug);

/* ── everything that hangs off what is going ────────────────────────────── */

/* One order-id set for the whole job: every order on a condemned night, plus
   every marked order on a night that stays. Tickets, scans and deliveries are
   all reached THROUGH this set rather than by re-deriving them from an event,
   which is what makes the deletion below provably scoped to rows this run
   listed. */
const doomedOrderIds = [
  ...(condemnedIds.length > 0
    ? (
        await query(SQL.SELECT_ORDER_IDS_FOR_EVENTS, [condemnedIds])
      ).rows.map((r) => r.id)
    : []),
  ...strayOrders.map((o) => o.id),
];

const counted = async (sql, params) => (await query(sql, params)).rows[0] ?? {};

const footprint = await counted(SQL.SELECT_FOOTPRINT, [doomedOrderIds, condemnedSlugs]);

/* The reservation ids are needed by name: `mail_deliveries` is keyed by what a
   message was about, and for a table that is the reservation's own id. */
const doomedReservationIds =
  condemnedSlugs.length > 0
    ? (
        await query(SQL.SELECT_RESERVATION_IDS_FOR_EVENTS, [condemnedSlugs])
      ).rows.map((r) => r.id)
    : [];

const mailKeys = [...doomedOrderIds, ...doomedReservationIds];
const mailRows =
  mailKeys.length > 0
    ? (await counted(SQL.COUNT_MAIL_FOR_KEYS, [mailKeys])).n
    : 0;

/* ── what is only a hint, and is therefore staying ──────────────────────── */

const ambiguous = [];

for (const row of suspicious) {
  const event = events.find((e) => e.id === row.event_id);
  ambiguous.push({
    what: `event ${event?.slug ?? row.event_id} (${event?.title ?? "?"})`,
    why:
      `classified as a fixture, but holds ${plural(row.orders, "paid order", "paid orders")} ` +
      `(${row.admissions} admission(s)) that carry no test marker. The night and ` +
      `everything on it is being left alone.`,
  });
}

/* A dev-mode payment on a night the club is keeping. See FIXTURE_ONLY_PROVIDERS:
   real enough to be worth seeing, not clearly test enough to remove. */
const devOnKeptNights = (
  await query(SQL.SELECT_DEV_ON_KEPT_NIGHTS, [FIXTURE_ONLY_PROVIDERS, condemnedIds])
).rows;

for (const row of devOnKeptNights) {
  ambiguous.push({
    what: `${plural(row.n, "order", "orders")} on ${row.slug} paid through the development provider`,
    why:
      `${row.admissions} admission(s), payment_provider 'dev'. That route 404s in ` +
      `production, so this came from a local server pointed at this database — but ` +
      `there is no real provider yet to tell it apart from a genuine issued ticket. ` +
      `Not removed. Check them in /admin/karte.`,
  });
}

/* Reservations on a night the club is keeping whose address is in a domain the
   local checks use. A hint, not a marker — see HINT_EMAIL_DOMAINS. */
const hintedReservations = (
  await query(SQL.SELECT_RESERVATIONS_BY_EMAIL_DOMAIN, [
    domainPatterns(HINT_EMAIL_DOMAINS),
    condemnedSlugs,
  ])
).rows;

for (const row of hintedReservations) {
  ambiguous.push({
    what: `${plural(row.n, "reservation", "reservations")} on ${row.event_id}`,
    why:
      `the address is in ${HINT_EMAIL_DOMAINS.join(" / ")}, which the local reservation ` +
      `check writes — but that is a registrable domain and a real guest could own one. ` +
      `Not removed. Review them in /admin/rezervacije.`,
  });
}

/* Reservations in a RESERVED domain, on a night that stays. Reserved domains
   cannot receive mail, so this is a marker — but a booking is a promise the
   club made to somebody, so it is still only reported, never removed by a
   script whose job is ticketing debris. */
const reservedReservations = (
  await query(SQL.SELECT_RESERVATIONS_BY_EMAIL_DOMAIN, [
    domainPatterns(RESERVED_EMAIL_DOMAINS),
    condemnedSlugs,
  ])
).rows;

for (const row of reservedReservations) {
  ambiguous.push({
    what: `${plural(row.n, "reservation", "reservations")} on ${row.event_id}`,
    why:
      `the address is in a reserved test domain (${RESERVED_EMAIL_DOMAINS.join(", ")}). ` +
      `A booking is a promise to a guest and this script removes ticketing debris, ` +
      `not tables — cancel them in /admin/rezervacije if they are yours.`,
  });
}

/* ── the verify pass ────────────────────────────────────────────────────── */

if (VERIFY) {
  console.log("── WHAT IS LEFT ──────────────────────────────────────────────\n");
  console.log(`  fixture nights still present    ${fixtures.length}`);
  console.log(`  marked test orders still present ${markedOrders.length}`);
  for (const { event, because } of fixtures) {
    console.log(`    · ${event.slug} — ${because.join("; ")}`);
  }
  for (const order of markedOrders) {
    console.log(`    · order ${order.reference} on ${order.event_slug} — ${reasonFor(order).join("; ")}`);
  }

  console.log("\n── THE CLUB'S OWN PROGRAMME ──────────────────────────────────\n");
  let missing = 0;
  for (const night of PROGRAMME) {
    const row = events.find((e) => e.slug === night.slug);
    if (!row) {
      missing += 1;
      console.log(`  ✗ MISSING  ${night.slug}`);
      continue;
    }
    const c = await counted(SQL.COUNT_FOR_ONE_EVENT, [row.id, row.slug]);
    console.log(
      `  ✓ ${row.slug.padEnd(26)} ${String(row.status).padEnd(9)} ` +
        `${c.orders} orders · ${c.tickets} tickets · ${c.reservations} reservations   ${row.title}`,
    );
  }

  const clean = fixtures.length === 0 && markedOrders.length === 0 && missing === 0;
  console.log(
    `\n[cleanup] ${clean ? "clean: no fixture nights, no marked test orders, every programme night present." : "NOT clean — see above."}`,
  );
  await closeDatabase();
  process.exit(clean ? 0 : 1);
}

/* ── the report, which is the whole point of the default run ────────────── */

console.log("── WOULD REMOVE ──────────────────────────────────────────────\n");
console.log(`  TEST EVENTS        ${condemned.length}`);
console.log(`  TEST ORDERS        ${doomedOrderIds.length}`);
console.log(`  TEST TICKETS       ${footprint.tickets ?? 0}`);
console.log(`  TEST SCANS         ${footprint.scans ?? 0}`);
console.log(`  TEST DELIVERIES    ${footprint.deliveries ?? 0}`);
console.log(`  TEST RESERVATIONS  ${footprint.reservations ?? 0}`);
console.log(`  TEST HOLDS         ${footprint.holds ?? 0}`);
console.log(`  OTHER TEST ROWS    ${mailRows}   (mail_deliveries keyed to the above)`);

console.log(`\n  Nights (${condemned.length}):`);
if (condemned.length === 0) console.log("    — none —");
for (const { event, because } of condemned) {
  console.log(`    ${event.slug.padEnd(30)} ${event.title}`);
  console.log(`        because: ${because.join("; ")}`);
}

console.log(`\n  Orders on nights that STAY (${strayOrders.length}):`);
if (strayOrders.length === 0) console.log("    — none —");
for (const order of strayOrders) {
  console.log(
    `    ${String(order.reference).padEnd(20)} ${String(order.event_slug).padEnd(24)} ` +
      `${String(order.payment_status).padEnd(9)} ${order.quantity}×  ${order.customer_name}`,
  );
  console.log(`        because: ${reasonFor(order).join("; ")}`);
  console.log(`        the night itself is NOT touched.`);
}

console.log("\n── PRESERVED ─────────────────────────────────────────────────\n");
console.log(`  ${plural(keep.length + heldBack.length, "night", "nights")} stay, with everything on them:\n`);
for (const event of keep) {
  const real = protectedSlugs.has(event.slug);
  console.log(
    `    ${real ? "★" : " "} ${event.slug.padEnd(30)} ${String(event.status).padEnd(9)} ${event.title}`,
  );
}
/* Held back by the guard above: classified as a fixture, but holding a paid
   order nobody marked. Listed here as well as under AMBIGUOUS, because this
   list is the answer to "what survives", and they do. */
for (const { event } of heldBack) {
  console.log(
    `    ! ${event.slug.padEnd(30)} ${String(event.status).padEnd(9)} ${event.title}  (held back — see AMBIGUOUS)`,
  );
}
console.log(
  `\n  ★ = named in the venue's real programme (lib/club/programme-seed.ts) and ` +
    `refused as a fixture before any evidence is read.`,
);

/* Said out loud rather than left to be inferred from a list. */
const mustSurvive = ["saturday-madness", "vodka-experience"];
console.log("");
for (const slug of mustSurvive) {
  const row = events.find((e) => e.slug === slug);
  const going = condemnedSlugs.includes(slug);
  console.log(
    `  ${row ? (going ? "✗" : "✓") : "?"} ${slug.padEnd(24)} ` +
      `${row ? (going ? "WOULD BE REMOVED — STOP" : "present and preserved") : "not in this database"}`,
  );
}

console.log("\n── AMBIGUOUS — MANUAL REVIEW REQUIRED ────────────────────────\n");
if (ambiguous.length === 0) console.log("  — none —");
for (const item of ambiguous) {
  console.log(`  · ${item.what}`);
  console.log(`      ${item.why}`);
}

const nothingToDo =
  condemned.length === 0 && doomedOrderIds.length === 0 && mailRows === 0;

if (!EXECUTE) {
  console.log(
    `\n[cleanup] DRY RUN — nothing was changed.` +
      (nothingToDo
        ? " There is nothing to remove."
        : " Re-run with --execute to remove exactly what is listed above."),
  );
  await closeDatabase();
  process.exit(0);
}

/* ── the removal ────────────────────────────────────────────────────────── */

if (nothingToDo) {
  console.log("\n[cleanup] nothing matched. No statement was run.");
  await closeDatabase();
  process.exit(0);
}

/* ONE TRANSACTION. Children before parents; every list was assembled and
   printed above, and each statement runs only if its list has something in it.
   There is no pattern match here and no unbounded DELETE — a bug in this block
   can remove rows this run named, and nothing else. */
await tx(async (q) => {
  if (doomedOrderIds.length > 0) {
    await q.query(SQL.DELETE_SCANS_FOR_ORDERS, [doomedOrderIds]);
    await q.query(SQL.DELETE_TICKET_DELIVERIES_FOR_ORDERS, [doomedOrderIds]);
  }

  if (mailKeys.length > 0) {
    await q.query(SQL.DELETE_MAIL_FOR_KEYS, [mailKeys]);
  }

  if (doomedOrderIds.length > 0) {
    await q.query(SQL.DELETE_TICKETS_FOR_ORDERS, [doomedOrderIds]);
    await q.query(SQL.DELETE_ORDERS, [doomedOrderIds]);
  }

  /* The floor is keyed by SLUG, not by id — see lib/reservations/store.ts. */
  if (condemnedSlugs.length > 0) {
    await q.query(SQL.DELETE_HOLDS_FOR_EVENTS, [condemnedSlugs]);
    await q.query(SQL.DELETE_RESERVATIONS_FOR_EVENTS, [condemnedSlugs]);
  }

  /* Last, and only ever the nights this run condemned by name. */
  if (condemnedIds.length > 0) {
    await q.query(SQL.DELETE_EVENTS, [condemnedIds]);
  }
});

console.log(
  `\n[cleanup] removed ${plural(condemned.length, "fixture night", "fixture nights")}, ` +
    `${plural(doomedOrderIds.length, "test order", "test orders")} and everything they owned. ` +
    `One transaction; it either all happened or none of it did.`,
);
console.log(`[cleanup] now run with --verify to read the result back.`);

await closeDatabase();
