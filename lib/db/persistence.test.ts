/* THE ONE THING AN IN-MEMORY STORE COULD NEVER DO.
 *
 * Everything else in this suite runs against Postgres in memory, which is
 * right: a test run must start from nothing. But "restarting the application
 * does not lose anything" cannot be checked that way, so this file is the
 * exception — it opens a real PGlite on disk, writes an order and a ticket
 * through the ordinary services, THROWS THE WHOLE CONNECTION AWAY, opens it
 * again, and asks whether the ticket still lets somebody in.
 *
 * That is as close to a restart as a test can get without spawning a second
 * process: the driver, the pool, every module cache holding a connection and
 * the in-process database itself are all discarded and rebuilt from what is on
 * disk. The old system kept its orders in a Map on `globalThis`, and this test
 * is the one it could not have passed.
 *
 * It cleans up after itself, and it refuses to run against a real Postgres —
 * `closeDatabase` and a temporary directory are safe; `DELETE FROM orders` on
 * somebody's Neon branch is not. */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { assertDatabaseConfigured, closeDatabase, query } from "@/lib/db/client";
import { confirmPayment, createOrder } from "@/lib/ticketing/orders";
import { validateAndRedeemTicket } from "@/lib/ticketing/redeem";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { findOrderByReference, ticketsForOrderWithTokens } from "@/lib/ticketing/store";
import { ticketUrl } from "@/lib/ticketing/links";
import { holdStore } from "@/lib/reservations/hold-store";

const ORIGIN = "https://plitviceclub.test";
let directory = "";

before(async () => {
  assert.equal(
    process.env.DATABASE_URL,
    undefined,
    "this file writes to disk and must never run against a real server",
  );

  /* Off the in-memory setting the rest of the suite uses, and onto a
     directory of our own. The driver reads this when it is built, and it is
     built lazily on the first query — which has not happened yet. */
  directory = await mkdtemp(join(tmpdir(), "plitvice-db-"));
  delete process.env.PGLITE_MEMORY;
  process.env.PGLITE_DIR = directory;

  await closeDatabase();
});

after(async () => {
  await closeDatabase();
  if (directory) await rm(directory, { recursive: true, force: true });
});

/* Everything that could be holding a connection, gone. The next call has to
   open the database again from the files on disk. */
async function restart() {
  await closeDatabase();
}

describe("restarting the application", () => {
  it("keeps the order, the ticket and the QR that opens it", async () => {
    const created = await createOrder({
      eventSlug: "test-night",
      quantity: 3,
      buyer: {
        name: "Marko Marković",
        email: "restart@example.com",
        phone: "069 11 11 11",
      },
    });
    assert.ok(created.ok, "the test night should be on sale");

    const paid = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
    assert.ok(paid.ok);
    assert.equal(paid.tickets.length, 3);

    const reference = created.order.reference;
    const token = paid.tickets[0].token;

    await restart();

    /* ── after the restart ──────────────────────────────────────────────── */

    const order = await findOrderByReference(reference);
    assert.ok(order, "the order survived");
    assert.equal(order.paymentStatus, "paid");
    assert.equal(order.quantity, 3);

    const tickets = await ticketsForOrderWithTokens(order.id);
    assert.equal(tickets.length, 3, "and so did its three tickets");
    assert.ok(
      tickets.some((ticket) => ticket.token === token),
      "including the secret in the QR — which means the key survived too",
    );

    const event = await findTicketingEvent("test-night", true);
    assert.ok(event);

    const scan = await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, token) },
      { source: "restart-test", door: "ulaz", staff: "Test", eventId: event.id },
    );
    assert.equal(scan.outcome, "valid", "and the ticket still opens the door");
  });

  it("remembers that somebody has already come in", async () => {
    const created = await createOrder({
      eventSlug: "test-night",
      quantity: 1,
      buyer: {
        name: "Ana Anić",
        email: "restart2@example.com",
        phone: "069 22 22 22",
      },
    });
    assert.ok(created.ok);

    const paid = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
    assert.ok(paid.ok);

    const event = await findTicketingEvent("test-night", true);
    assert.ok(event);
    const at = { source: "restart-test-2", door: "ulaz", staff: "Test", eventId: event.id };
    const scan = { scanned: ticketUrl(ORIGIN, paid.tickets[0].token) };

    assert.equal((await validateAndRedeemTicket(scan, at)).outcome, "valid");

    await restart();

    /* THE ONE THAT MATTERS. An in-memory store would forget, and the same
       code would let a second person in on the same ticket. */
    assert.equal((await validateAndRedeemTicket(scan, at)).outcome, "already_used");
  });

  it("keeps a table hold and its expiry across the restart", async () => {
    const night = "saturday-madness";
    const acquired = await holdStore.acquire({
      eventId: night,
      seatId: "S20",
      token: "restart-session-0000",
    });
    assert.ok(acquired.ok);

    await restart();

    const still = await holdStore.read({
      eventId: night,
      seatId: "S20",
      token: "restart-session-0000",
    });
    assert.ok(still, "the hold survived");
    assert.equal(still.expiresAt, acquired.hold.expiresAt, "with the same three minutes");

    /* And it still blocks somebody else. */
    const other = await holdStore.acquire({
      eventId: night,
      seatId: "S20",
      token: "restart-other-000000",
    });
    assert.equal(other.ok, false);
  });

  it("does not run the migration twice", async () => {
    await restart();
    /* Opening a database that already has every table is a no-op, not an
       error — which is what makes twenty instances cold-starting together
       safe. If this throws, `IF NOT EXISTS` has been dropped somewhere. */
    const tables = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public'`,
    );
    assert.ok(Number(tables.rows[0].n) >= 8, "every table is there, once");
  });
});

/* THE OTHER HALF OF "NOTHING IS LOST": a production server that has not been
 * told where the database is must not invent one.
 *
 * The check is pure and takes the environment as an argument, so this can ask
 * it the four questions that matter without starting a database, and without
 * touching the environment the rest of the suite is running in. */
describe("a production server with no database", () => {
  it("refuses to start rather than quietly running on its own private copy", () => {
    assert.throws(
      () => assertDatabaseConfigured({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
      /DATABASE_URL/,
      "the error has to name the variable that is missing",
    );
  });

  it("is satisfied by a connection string", () => {
    assertDatabaseConfigured({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user:pw@example.invalid/plitvice",
    } as NodeJS.ProcessEnv);
  });

  it("can be overruled, but only on purpose", () => {
    assertDatabaseConfigured({
      NODE_ENV: "production",
      PGLITE_ALLOW_PRODUCTION: "true",
    } as NodeJS.ProcessEnv);
  });

  it("says nothing at all about a development machine", () => {
    assertDatabaseConfigured({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
  });
});
