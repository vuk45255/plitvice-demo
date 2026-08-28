/* THE CONTENTION SUITE.
 *
 *   npm run stress
 *   npm run stress -- --scale 300
 *   DATABASE_URL=postgres://…  npm run stress -- --against-database-url
 *
 * Six scenarios, each one of them a way the club's worst night could go wrong,
 * and each one checked AGAINST THE DATABASE afterwards rather than against the
 * return values. A hundred calls that all answered politely and left 26 seats
 * sold in a 25-seat room is a failure, and only a query can say so.
 *
 * ═══ WHERE IT RUNS ════════════════════════════════════════════════════════
 *
 * By default: PGlite, in memory, in this process. That exercises every
 * statement and every constraint, but the driver holds ONE connection, so calls
 * queue rather than truly collide. It proves the SQL is right and it CANNOT
 * prove anything about snapshots — the four `wrong_event` verdicts that a real
 * server produced on scenario E were invisible here for exactly that reason.
 *
 * With --against-database-url it runs against a real server, which is the only
 * way to see MVCC, row locks and a connection pool behave as they will in
 * production. Run it there before every season.
 *
 * ═══ WHAT IT MAY TOUCH ════════════════════════════════════════════════════
 *
 * ONLY ROWS IT CREATED, and it can prove it: every night this run makes is
 * stamped with a run id, its id is remembered in `MADE`, and every DELETE at
 * the end is scoped to that list of ids — never to a LIKE pattern, never to a
 * table. If the list is empty, nothing is deleted at all.
 *
 * The nights are also marked `test_only` the moment they exist, so even a run
 * that dies halfway leaves nothing a guest could see or buy: every public query
 * in this system filters test nights out unless dev mode is open.
 *
 * IT NEVER RESETS ANYTHING. There is no `DELETE FROM events` in this file. */

import { register } from "node:module";
import assert from "node:assert/strict";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "true");
  }
}

const SCALE = Number(args.get("scale") ?? 100);
const AGAINST_SERVER = args.get("against-database-url") === "true";

if (AGAINST_SERVER) {
  if (!process.env.DATABASE_URL) {
    console.error("--against-database-url was passed but DATABASE_URL is not set.");
    process.exit(1);
  }
  /* ═══ THE POOL FOR A LOAD GENERATOR, NOT FOR A LAMBDA ═════════════════
   *
   * Production keeps five connections per instance because there are many
   * instances and one server. THIS is one process pretending to be three
   * hundred guests, so five connections mean three hundred callers queueing
   * behind five — which is what produced "timeout exceeded when trying to
   * connect" on scenario F, from the queue rather than from the database.
   *
   * Twenty is the right number for a single client that is deliberately
   * generating a burst, and is nowhere near what a Postgres server minds.
   * IT DOES NOT CHANGE WHAT PRODUCTION USES — this is set in the script's own
   * environment, before the driver is built, and applies to this process only.
   * Override with --pool if a server is smaller.
   *
   * A NEON POOLED (`-pooler`) CONNECTION STRING IS STILL THE RIGHT ONE TO USE
   * HERE, exactly as in production. */
  process.env.DATABASE_POOL_MAX = args.get("pool") ?? "20";
  /* And the same reasoning for the statement guard. Sixty checkouts queued on
     ONE event row from ONE process is a lock queue no real traffic produces —
     a hundred lambdas each do one — so production's fifteen seconds would abort
     statements that are queueing correctly. Raised for this client only, and
     still a ceiling: a genuinely wedged statement is still cut off. */
  process.env.DATABASE_STATEMENT_TIMEOUT_MS =
    args.get("statement-timeout") ?? "30000";
  console.log(
    `Running against a REAL Postgres server, pool max ${process.env.DATABASE_POOL_MAX}.\n` +
      "It creates its own nights and deletes only what it created.\n",
  );
} else {
  /* The same guard the test suite uses: a developer with a production string
     in their shell must not have it picked up by a script that writes. */
  process.env.PGLITE_MEMORY = "true";
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
}

process.env.TICKETING_DEV_MODE = "true";
/* Phase timings — pool wait, lock wait, insert, commit. Off in production by
   default; on here, because "the pool is too small" and "the lock queue is
   long" look identical from outside and have opposite fixes. */
process.env.DATABASE_PROFILE = "true";
register("./resolve-alias.mjs", import.meta.url);

const { query, closeDatabase } = await import("@/lib/db/client");
const { snapshot, resetProfile } = await import("@/lib/db/profile");
const { createOrder, confirmPayment } = await import("@/lib/ticketing/orders");
const { createEvent } = await import("@/lib/ticketing/events");
const { ticketsForOrderWithTokens } = await import("@/lib/ticketing/store");
const { validateAndRedeemTicket } = await import("@/lib/ticketing/redeem");
const { ticketUrl } = await import("@/lib/ticketing/links");
const { holdStore } = await import("@/lib/reservations/hold-store");
const { SEATS } = await import("@/lib/floor-plan");

const ORIGIN = "https://plitviceclub.test";
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* EVERYTHING THIS RUN CREATED, and the only thing cleanup is allowed to touch.
   Ids for the ticketing nights; plain strings for the synthetic event keys the
   seat-hold scenarios use, which are not events at all. */
const MADE = { eventIds: [], holdEventKeys: [] };

const results = [];
let failures = 0;

/* A night of our own per scenario, so nothing here can disturb the club's own
   events — and so the numbers are exact. */
async function night(name, capacity) {
  const created = await createEvent({
    title: `Stress ${name} ${RUN}`,
    slug: `stress-${name}-${RUN}`.toLowerCase(),
    startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    capacity,
    ticketPrice: 1000,
    maxPerOrder: 10,
    /* Created as a draft so that between these two statements it is a night
       nobody can buy, and marked test_only immediately afterwards so that it is
       invisible to every public query for ever after. */
    status: "draft",
  });
  assert.ok(created.ok, `could not create the ${name} night`);

  MADE.eventIds.push(created.event.id);
  await query(`UPDATE events SET test_only = true, status = 'on_sale' WHERE id = $1`, [
    created.event.id,
  ]);

  return created.event;
}

function holdEvent(name) {
  const key = `stress-${name}-${RUN}`;
  MADE.holdEventKeys.push(key);
  return key;
}

function buyer(i) {
  return {
    name: `Stress ${i}`,
    email: `stress-${RUN}-${i}@example.com`,
    phone: `06${String(1000000 + i).slice(0, 7)}`,
  };
}

/* ═══ HOW A FAILURE IS DESCRIBED ══════════════════════════════════════════
 *
 * Not "something went wrong". A caller that did not return one of the two
 * verdicts a scenario expects is identified by what it DID return, or — if it
 * threw — by the error's class, the driver's own SQLSTATE where there is one,
 * and the first line of the message. That is what turned four mystery results
 * into one snapshot bug.
 *
 * NO TOKENS ARE EVER PRINTED. A token in a terminal is a working ticket. */
function describe(outcome) {
  if (outcome.status === "fulfilled") {
    const value = outcome.value;
    return `verdict:${value?.outcome ?? value?.reason ?? JSON.stringify(value)}`;
  }
  const error = outcome.reason ?? {};
  const parts = [`threw:${error.constructor?.name ?? typeof error}`];
  if (error.code) parts.push(`sqlstate:${error.code}`);
  if (error.severity) parts.push(`severity:${error.severity}`);
  parts.push(String(error.message ?? error).split("\n")[0].slice(0, 120));
  return parts.join(" · ");
}

function tally(outcomes) {
  const counts = new Map();
  for (const outcome of outcomes) {
    const key = describe(outcome);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function reportTally(counts, indent = "      ") {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${indent}${String(n).padStart(4)} × ${key}`)
    .join("\n");
}

async function scenario(title, expectation, run) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ title, verdict: "PASS", ms: Date.now() - started, detail });
    console.log(`  ✓ ${title}\n      ${detail}`);
  } catch (error) {
    failures += 1;
    results.push({
      title,
      verdict: "FAIL",
      ms: Date.now() - started,
      detail: String(error.message ?? error).split("\n")[0],
    });
    console.log(`  ✗ ${title}\n      expected: ${expectation}\n${indent(error.message)}`);
  }
}

const indent = (text) =>
  String(text)
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

/* EVERY SCENARIO SETTLES EVERY PROMISE IT STARTED.
 *
 * `Promise.all` rejects on the first failure and leaves the other ninety-nine
 * RUNNING — which is how a failed scenario F went on inserting orders while the
 * cleanup was deleting them, and why deleting the nights afterwards hit a
 * foreign key. `allSettled` waits for all of them, always, so nothing this
 * script started outlives the scenario that started it. */
const settleAll = (promises) => Promise.allSettled(promises);

/* WHERE THE TIME WENT, for the phases that matter to the scenario just run.
   Milliseconds, one line each, p50/p95/p99/max — the shape of a queue rather
   than an average, because an average hides the tail that actually failed. */
function phases(...wanted) {
  const stats = snapshot().filter((s) => wanted.includes(s.phase));
  if (stats.length === 0) return "";
  return stats
    .map(
      (s) =>
        `      ${s.phase.padEnd(13)} n=${String(s.n).padStart(4)}  ` +
        `p50 ${s.p50.toFixed(0).padStart(5)}ms  p95 ${s.p95.toFixed(0).padStart(5)}ms  ` +
        `p99 ${s.p99.toFixed(0).padStart(5)}ms  max ${s.max.toFixed(0).padStart(6)}ms`,
    )
    .join("\n");
}

/* Every attempt lands in exactly one of these. `busy` is its own column on
 * purpose: it is not a refusal about the night and it is not an error.
 *
 * WHAT `busy` MEANS, AND WHY IT IS NOT AUTOMATICALLY A PASS. The instance's
 * connection queue was full and the request never reached the seats — nothing
 * was written, and the caller is told to come back. Under this suite's shape
 * (ONE process, ONE pool, three hundred promises fired at once, all at ONE
 * night) it is deliberate backpressure and is expected once the serialized
 * chain outruns the acquisition timeout. It would be a real problem if it
 * appeared in production, where three hundred buyers arrive at many instances,
 * each with its own small pool, and each request has a lambda to itself. */
function sort(outcomes) {
  const sold = [];
  const soldOut = [];
  const busy = [];
  const other = [];
  const threw = [];

  for (const o of outcomes) {
    if (o.status === "rejected") threw.push(o);
    else if (o.value.ok) sold.push(o);
    else if (o.value.reason === "sold_out") soldOut.push(o);
    else if (o.value.reason === "busy") busy.push(o);
    else other.push(o);
  }
  return { sold, soldOut, busy, other, threw };
}

console.log(
  `Plitvice contention suite — ${SCALE} attempts per scenario, ` +
    `${AGAINST_SERVER ? "real Postgres" : "PGlite in memory"}, run ${RUN}\n`,
);

/* ── A. one room, twenty-five seats, a hundred buyers ────────────────────── */

await scenario(
  `A · ${SCALE} simultaneous buyers for 25 remaining tickets`,
  "at most 25 sold, the rest refused cleanly",
  async () => {
    const event = await night("oversell", 25);
    resetProfile();

    const started = Date.now();
    const outcomes = await settleAll(
      Array.from({ length: SCALE }, (_, i) =>
        createOrder({ eventSlug: event.slug, quantity: 1, buyer: buyer(i) }),
      ),
    );
    const ms = Date.now() - started;

    const { sold, soldOut, busy, other, threw } = sort(outcomes);

    const held = await query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS n FROM ticket_orders
        WHERE event_id = $1
          AND (payment_status = 'paid'
               OR (payment_status = 'pending' AND hold_expires_at > now()))`,
      [event.id],
    );
    const rows = await query(
      `SELECT COUNT(*)::int AS n FROM ticket_orders WHERE event_id = $1`,
      [event.id],
    );
    const allocated = Number(held.rows[0].n);

    /* Printed before any assertion can stop the run: these are the numbers
       this scenario exists to produce. */
    console.log(
      `      attempts ${SCALE} · sold ${sold.length} · sold_out ${soldOut.length} · ` +
        `temporarily_busy ${busy.length} · other ${other.length} · threw ${threw.length}`,
    );
    console.log(
      `      database allocated ${allocated}/25 · order rows ${Number(rows.rows[0].n)} · ${ms}ms`,
    );
    console.log(phases("pool.acquire", "lock.wait", "order.insert", "tx.commit", "checkout.tx"));
    if (other.length + threw.length > 0) {
      console.log(reportTally(tally([...other, ...threw])));
    }

    /* ── correctness first, and it is not negotiable ─────────────────── */
    assert.ok(allocated <= 25, `DATABASE SAYS ${allocated} ALLOCATED — OVERSOLD`);
    assert.equal(allocated, 25, `only ${allocated} of 25 seats were taken`);
    assert.equal(sold.length, 25, `${sold.length} calls succeeded, expected 25`);
    assert.equal(
      Number(rows.rows[0].n),
      25,
      "an order row exists that did not allocate a seat",
    );

    /* ── then: nothing may fail in a way nobody can read ─────────────── */
    assert.equal(
      threw.length,
      0,
      `${threw.length} requests threw instead of answering:\n${reportTally(tally(threw))}`,
    );
    assert.equal(
      other.length,
      0,
      `${other.length} unexpected refusals:\n${reportTally(tally(other))}`,
    );
    assert.equal(
      sold.length + soldOut.length + busy.length,
      SCALE,
      "some attempts are unaccounted for",
    );

    const busyNote =
      busy.length > 0
        ? ` · ${busy.length} told temporarily_busy (backpressure, nothing written)`
        : " · no backpressure needed";
    return `${sold.length} sold · ${soldOut.length} sold_out${busyNote} · allocated ${allocated}/25`;
  },
);

/* ── B. one table, a hundred hands ──────────────────────────────────────── */

await scenario(
  `B · ${SCALE} simultaneous holds on one table`,
  "exactly one live hold",
  async () => {
    const event = holdEvent("seat");
    const seat = SEATS[0].id;

    const outcomes = await settleAll(
      Array.from({ length: SCALE }, (_, i) =>
        holdStore.acquire({ eventId: event, seatId: seat, token: `tok-${RUN}-${i}` }),
      ),
    );

    const threw = outcomes.filter((o) => o.status === "rejected");
    const won = outcomes.filter((o) => o.status === "fulfilled" && o.value.ok).length;
    const live = await query(
      `SELECT COUNT(*)::int AS n FROM seat_holds
        WHERE event_id = $1 AND seat_id = $2 AND status = 'active' AND expires_at > now()`,
      [event, seat],
    );

    assert.equal(threw.length, 0, `${threw.length} threw:\n${reportTally(tally(threw))}`);
    assert.equal(won, 1, `${won} callers were given the table`);
    assert.equal(Number(live.rows[0].n), 1, "more than one live hold exists");

    return `1 of ${SCALE} won · database holds exactly 1 live row`;
  },
);

/* ── C. sixty different tables at once ──────────────────────────────────── */

await scenario(
  "C · 60 different tables held simultaneously",
  "independent tables do not block each other",
  async () => {
    const event = holdEvent("many");
    const seats = SEATS.slice(0, 60).map((s) => s.id);

    const started = Date.now();
    const outcomes = await settleAll(
      seats.map((seatId, i) =>
        holdStore.acquire({ eventId: event, seatId, token: `many-${RUN}-${i}` }),
      ),
    );
    const ms = Date.now() - started;

    const threw = outcomes.filter((o) => o.status === "rejected");
    const won = outcomes.filter((o) => o.status === "fulfilled" && o.value.ok).length;
    const live = await query(
      `SELECT COUNT(*)::int AS n FROM seat_holds
        WHERE event_id = $1 AND status = 'active' AND expires_at > now()`,
      [event],
    );

    assert.equal(threw.length, 0, `${threw.length} threw:\n${reportTally(tally(threw))}`);
    assert.equal(won, 60, `${won} of 60 independent tables were given out`);
    assert.equal(Number(live.rows[0].n), 60, "the database does not hold 60 rows");

    return `60/60 in ${ms}ms (${(ms / 60).toFixed(1)}ms each) · no cross-blocking`;
  },
);

/* ── D. the same payment, a hundred times ───────────────────────────────── */

await scenario(
  `D · ${SCALE} simultaneous confirmations of ONE order`,
  "one payment claim, one set of tickets, one delivery",
  async () => {
    const event = await night("payment", 500);
    const created = await createOrder({
      eventSlug: event.slug,
      quantity: 4,
      buyer: buyer(9001),
    });
    assert.ok(created.ok);

    const outcomes = await settleAll(
      Array.from({ length: SCALE }, () =>
        confirmPayment(created.order.id, { provider: "stress" }, ORIGIN),
      ),
    );

    const threw = outcomes.filter((o) => o.status === "rejected");
    const values = outcomes.filter((o) => o.status === "fulfilled").map((o) => o.value);
    const minted = values.filter((v) => v.ok && v.minted).length;
    const ok = values.filter((v) => v.ok).length;

    const tickets = await query(
      `SELECT COUNT(*)::int AS n FROM tickets WHERE order_id = $1`,
      [created.order.id],
    );
    const deliveries = await query(
      `SELECT COUNT(*)::int AS n FROM ticket_deliveries WHERE order_id = $1`,
      [created.order.id],
    );
    const paidRows = await query(
      `SELECT payment_status FROM ticket_orders WHERE id = $1`,
      [created.order.id],
    );

    assert.equal(threw.length, 0, `${threw.length} threw:\n${reportTally(tally(threw))}`);
    assert.equal(minted, 1, `${minted} callers believed they minted the tickets`);
    assert.equal(ok, SCALE, `only ${ok} of ${SCALE} confirmations succeeded`);
    assert.equal(Number(tickets.rows[0].n), 4, "the order does not have exactly 4 tickets");
    assert.equal(Number(deliveries.rows[0].n), 1, "more than one delivery row");
    assert.equal(paidRows.rows[0].payment_status, "paid");

    return `1 mint of ${SCALE} confirmations · 4 tickets · 1 delivery row`;
  },
);

/* ── E. one QR, a hundred scanners ──────────────────────────────────────── */

await scenario(
  `E · ${SCALE} simultaneous scans of ONE ticket`,
  "exactly one VALID, the rest ALREADY USED",
  async () => {
    const event = await night("door", 100);
    const created = await createOrder({
      eventSlug: event.slug,
      quantity: 1,
      buyer: buyer(9002),
    });
    assert.ok(created.ok);
    const paid = await confirmPayment(created.order.id, { provider: "stress" }, ORIGIN);
    assert.ok(paid.ok);

    const ticket = (await ticketsForOrderWithTokens(created.order.id))[0];
    const scan = { scanned: ticketUrl(ORIGIN, ticket.token) };

    const outcomes = await settleAll(
      Array.from({ length: SCALE }, (_, i) =>
        validateAndRedeemTicket(scan, {
          /* A distinct source per phone, so the door's own brake is not what is
             being measured here. */
          source: `door-${RUN}-${i}`,
          door: i % 2 ? "vip" : "ulaz",
          staff: `Doorman ${i}`,
          eventId: event.id,
        }),
      ),
    );

    const values = outcomes.filter((o) => o.status === "fulfilled").map((o) => o.value);
    const threw = outcomes.filter((o) => o.status === "rejected");
    const valid = values.filter((v) => v.outcome === "valid").length;
    const used = values.filter((v) => v.outcome === "already_used").length;
    const other = outcomes.filter(
      (o) =>
        o.status === "rejected" ||
        !["valid", "already_used"].includes(o.value.outcome),
    );

    /* THE DATABASE'S OWN ANSWER, which is the one that matters. */
    const usedRows = await query(
      `SELECT COUNT(*)::int AS n FROM tickets WHERE id = $1 AND status = 'used'`,
      [ticket.id],
    );
    const admitted = await query(
      `SELECT COUNT(*)::int AS n FROM ticket_scans
        WHERE ticket_id = $1 AND outcome = 'redeemed'`,
      [ticket.id],
    );
    const logged = await query(
      `SELECT COUNT(*)::int AS n FROM ticket_scans WHERE ticket_id = $1`,
      [ticket.id],
    );

    /* Counted and printed BEFORE any assertion can stop the run, because these
       five numbers are the report this scenario exists to produce. */
    console.log(
      `      VALID ${valid} · ALREADY_USED ${used} · other ${other.length} · ` +
        `threw ${threw.length} · database admissions ${Number(admitted.rows[0].n)}`,
    );
    if (other.length > 0) console.log(reportTally(tally(other)));

    assert.equal(
      Number(usedRows.rows[0].n),
      1,
      "THE TICKET IS NOT MARKED USED EXACTLY ONCE",
    );
    assert.equal(
      Number(admitted.rows[0].n),
      1,
      `the log records ${admitted.rows[0].n} admissions for one ticket`,
    );
    assert.equal(valid, 1, `${valid} scanners were told to let somebody in`);
    assert.equal(
      other.length,
      0,
      `${other.length} scans returned neither verdict:\n${reportTally(tally(other))}`,
    );
    assert.equal(used + valid, SCALE, "some scans returned neither verdict");
    assert.equal(Number(logged.rows[0].n), SCALE, "not every attempt was written down");

    return `1 VALID · ${used} ALREADY USED · 1 admission logged of ${SCALE} attempts`;
  },
);

/* ── F. five nights at once ─────────────────────────────────────────────── */

await scenario(
  "F · five different nights selling simultaneously",
  "one night's lock does not serialize the others",
  async () => {
    /* `allSettled` even here, and for the same reason as everywhere else: if
       one of the five failed, `Promise.all` would reject while the other four
       were still being created — and a night that comes into existence after
       cleanup has run is a night cleanup does not know about. This waits for
       all five to finish either way, so every id that exists is in `MADE`
       before anything is deleted. */
    const made = await settleAll(
      [0, 1, 2, 3, 4].map((n) => night(`parallel-${n}`, 20)),
    );
    const rejected = made.filter((o) => o.status === "rejected");
    assert.equal(
      rejected.length,
      0,
      `${rejected.length} of the five nights could not be created:\n${reportTally(tally(rejected))}`,
    );
    const events = made.map((o) => o.value);

    resetProfile();
    const started = Date.now();
    const outcomes = await settleAll(
      events.flatMap((event, e) =>
        Array.from({ length: 40 }, (_, i) =>
          createOrder({
            eventSlug: event.slug,
            quantity: 1,
            buyer: buyer(20000 + e * 100 + i),
          }),
        ),
      ),
    );
    const ms = Date.now() - started;

    const { sold: soldOutcomes, busy, threw } = sort(outcomes);
    const sold = soldOutcomes.length;

    const perEvent = [];
    for (const event of events) {
      const held = await query(
        `SELECT COALESCE(SUM(quantity), 0)::int AS n FROM ticket_orders
          WHERE event_id = $1
            AND (payment_status = 'paid'
                 OR (payment_status = 'pending' AND hold_expires_at > now()))`,
        [event.id],
      );
      const n = Number(held.rows[0].n);
      perEvent.push(n);
      assert.ok(n <= 20, `${event.slug} allocated ${n} of 20 — OVERSOLD`);
    }

    console.log(
      `      200 buyers · sold per night ${perEvent.join(", ")} · ${ms}ms · ` +
        `temporarily_busy ${busy.length} · threw ${threw.length}`,
    );
    console.log(phases("pool.acquire", "lock.wait", "order.insert", "tx.commit"));
    if (threw.length > 0) console.log(reportTally(tally(threw)));

    assert.equal(
      threw.length,
      0,
      `${threw.length} requests threw:\n${reportTally(tally(threw))}`,
    );
    for (const [i, n] of perEvent.entries()) {
      assert.equal(n, 20, `${events[i].slug} sold ${n} of its own 20`);
    }
    assert.equal(sold, 100, `${sold} of 200 attempts succeeded, expected 100`);

    return `5 nights × 20 seats from 200 attempts in ${ms}ms · each capped at its own 20`;
  },
);

/* ── what was left behind ───────────────────────────────────────────────── */

/* ONLY THE ROWS THIS RUN MADE, IN FOREIGN-KEY ORDER.
 *
 * Scans reference tickets, tickets and deliveries reference orders, orders and
 * tickets reference events — so they go in that order, and the nights last.
 * Every statement is scoped to `MADE.eventIds`: no LIKE, no pattern, no table.
 * The production foreign keys are untouched and nothing cascades; the order
 * below is what respects them.
 *
 * If this run created nothing, nothing is deleted. */
async function cleanUp() {
  const eventIds = MADE.eventIds;
  const holdKeys = MADE.holdEventKeys;

  /* A last defence: every id this run believes it made must actually be a
     night this run made. If a bug ever put somebody else's id in that list, the
     cleanup stops rather than deleting it. */
  if (eventIds.length > 0) {
    const mine = await query(
      `SELECT id FROM events WHERE id = ANY($1::text[]) AND slug LIKE $2`,
      [eventIds, `stress-%-${RUN}`],
    );
    assert.equal(
      mine.rows.length,
      eventIds.length,
      "refusing to clean up: an id in this run's list is not this run's night",
    );
  }

  if (eventIds.length > 0) {
    await query(
      `DELETE FROM ticket_scans WHERE ticket_id IN
         (SELECT id FROM tickets WHERE event_id = ANY($1::text[]))`,
      [eventIds],
    );
    await query(
      `DELETE FROM ticket_deliveries WHERE order_id IN
         (SELECT id FROM ticket_orders WHERE event_id = ANY($1::text[]))`,
      [eventIds],
    );
    await query(`DELETE FROM tickets WHERE event_id = ANY($1::text[])`, [eventIds]);
    await query(`DELETE FROM ticket_orders WHERE event_id = ANY($1::text[])`, [eventIds]);
    await query(`DELETE FROM events WHERE id = ANY($1::text[])`, [eventIds]);
  }

  if (holdKeys.length > 0) {
    await query(`DELETE FROM seat_holds WHERE event_id = ANY($1::text[])`, [holdKeys]);
  }

  /* And proof, rather than hope. */
  const left = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM events WHERE id = ANY($1::text[])) AS events,
       (SELECT COUNT(*)::int FROM ticket_orders WHERE event_id = ANY($1::text[])) AS orders,
       (SELECT COUNT(*)::int FROM seat_holds WHERE event_id = ANY($2::text[])) AS holds`,
    [eventIds, holdKeys],
  );
  const row = left.rows[0];
  const remaining = Number(row.events) + Number(row.orders) + Number(row.holds);
  if (remaining !== 0) {
    console.log(
      `\n  ! ${remaining} stress row(s) could not be removed ` +
        `(events ${row.events}, orders ${row.orders}, holds ${row.holds}). ` +
        `They are marked test_only and are invisible to guests; delete them by ` +
        `run id ${RUN} when convenient.`,
    );
    return false;
  }
  return true;
}

let cleaned = true;
try {
  cleaned = await cleanUp();
  if (cleaned) {
    console.log(
      `\n  cleaned up: ${MADE.eventIds.length} night(s) and everything under them.`,
    );
  }
} catch (error) {
  cleaned = false;
  console.log(`\n  ! cleanup failed: ${String(error.message ?? error).split("\n")[0]}`);
  console.log(`    every row this run made is marked test_only; run id ${RUN}`);
}

console.log("");
for (const r of results) {
  console.log(`  ${r.verdict === "PASS" ? "✓" : "✗"} ${r.title} — ${r.ms}ms`);
}

await closeDatabase();

if (failures > 0 || !cleaned) {
  console.log(`\n  ${failures} scenario(s) FAILED${cleaned ? "" : ", cleanup incomplete"}.\n`);
  process.exit(1);
}
console.log(
  `\n  All six scenarios pass. No overselling, no double-booking, ` +
    `no duplicate minting, no double entry.\n`,
);
