/* WHAT HAPPENS WHEN SOMETHING GOES WRONG IN THE MIDDLE.
 *
 * The rest of the suite asks whether the system is correct when it is working.
 * This one asks whether it is correct after an instance was frozen between two
 * statements, a mail provider stopped answering, a doorman's phone lost signal
 * mid-request and a clock landed exactly on an expiry — which is the state a
 * production system spends a surprising amount of its life in.
 *
 * Every failure below is INJECTED BY MOVING THE DATABASE, never by mocking a
 * module: a row is aged, a status is set, a provider name is pointed at
 * nothing. What is under test is the SQL and the order of operations, and a
 * mocked version of either would be testing the mock. */

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { closeDatabase, isDatabaseBusy, query } from "@/lib/db/client";
import { resetProfile, snapshot } from "@/lib/db/profile";
import { takeHold } from "@/lib/reservations/rate-limit";
import { takeCheckout, takeScan } from "@/lib/ticketing/rate-limit";
import { afterResponse } from "@/lib/after-response";
import { holdStore, HOLD_SECONDS } from "@/lib/reservations/hold-store";
import { acquireHold, getHoldStatus } from "@/lib/reservations/holds";
import { confirmPayment, createOrder } from "@/lib/ticketing/orders";
import { findTicketingEvent, updateEvent } from "@/lib/ticketing/events";
import { buildDelivery, deliverTickets } from "@/lib/ticketing/delivery";
import { claimPayment, soldFor, ticketsForOrderWithTokens } from "@/lib/ticketing/store";
import { validateAndRedeemTicket } from "@/lib/ticketing/redeem";
import { ticketUrl } from "@/lib/ticketing/links";

const NIGHT = "test-night";
const TABLES_NIGHT = "saturday-madness";
const ORIGIN = "https://plitviceclub.test";

after(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
  await query(`DELETE FROM mail_deliveries`);
  await query(`DELETE FROM seat_holds`);
  await query(`DELETE FROM reservations`);
});

async function order(quantity = 2) {
  const created = await createOrder({
    eventSlug: NIGHT,
    quantity,
    buyer: {
      name: "Marko Marković",
      email: `resilience-${Date.now()}-${Math.random()}@example.com`,
      phone: "069 11 22 33",
    },
  });
  assert.ok(created.ok, "the test night should be on sale");
  return created.order;
}

/* The delivery of a paid order is started AFTER the response — see
   lib/after-response.ts — so a test that wants to look at the row waits for it
   to stop being `queued` rather than racing it. */
async function settled(orderId: string, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    const row = await query<{ status: string; last_error: string | null }>(
      `SELECT status, last_error FROM ticket_deliveries WHERE order_id = $1`,
      [orderId],
    );
    if (row.rows[0] && row.rows[0].status !== "queued") return row.rows[0];
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the delivery never settled");
}

/* ═══ THE INSTANCE DIED IN THE MIDDLE ════════════════════════════════════ */

describe("an instance frozen between two statements", () => {
  it("re-sends a delivery that was claimed and never sent", async () => {
    /* THE FAILURE THIS EXISTS FOR. On Vercel an instance may be frozen the
       instant it has answered — so a delivery could be claimed (`queued`) and
       then never sent, and because the claim existed, every later attempt was
       told the job was taken. A guest who paid would never get their tickets
       and nothing would ever try again. A queued row that has not moved in
       five minutes is therefore re-claimable. */
    const placed = await order(2);
    const paid = await confirmPayment(placed.id, { provider: "test" }, ORIGIN);
    assert.ok(paid.ok);

    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);
    const delivery = buildDelivery(paid.order, event, paid.tickets, ORIGIN);

    /* Put the row back into the state a frozen instance leaves behind. */
    await query(
      `UPDATE ticket_deliveries SET status = 'queued' WHERE order_id = $1`,
      [placed.id],
    );

    /* Still fresh: somebody may genuinely be sending it right now. */
    assert.equal(
      await deliverTickets(delivery),
      "already-claimed",
      "a delivery that is only seconds old must not be sent twice",
    );

    /* Now old enough that nobody is carrying it any more. */
    await query(
      `UPDATE ticket_deliveries SET updated_at = now() - interval '6 minutes'
        WHERE order_id = $1`,
      [placed.id],
    );

    assert.equal(await deliverTickets(delivery), "sent", "a stranded delivery is picked up");

    const row = await query<{ status: string; attempts: number }>(
      `SELECT status, attempts FROM ticket_deliveries WHERE order_id = $1`,
      [placed.id],
    );
    assert.equal(row.rows[0].status, "sent");
    assert.ok(Number(row.rows[0].attempts) >= 2, "the second attempt is counted");

    /* AND NOTHING WAS MINTED TWICE. Delivery is delivery. */
    assert.equal((await ticketsForOrderWithTokens(placed.id)).length, 2);
  });

  it("mints the tickets when the payment was claimed but the process died", async () => {
    /* `claimPayment` succeeded, `issueTickets` never ran. The provider retries
       the webhook, and the retry has to finish the job rather than refuse it
       because the order is already paid. */
    const placed = await order(3);

    const claim = await claimPayment(placed.id, { provider: "test" });
    assert.equal(claim.claimed, true);
    assert.equal((await ticketsForOrderWithTokens(placed.id)).length, 0, "nothing minted yet");

    const retry = await confirmPayment(placed.id, { provider: "test" }, ORIGIN);
    assert.ok(retry.ok, "the retry must not be refused as not-payable");
    assert.equal(retry.tickets.length, 3, "and it mints the missing tickets");
    assert.equal((await ticketsForOrderWithTokens(placed.id)).length, 3);
  });

  it("keeps background work running when there is no request to hang it on", async () => {
    /* `afterResponse` prefers the platform's `after()`, which only exists
       inside a request. Outside one — a test, a script — it must still run the
       work rather than swallow it. */
    let ran = false;
    afterResponse(async () => {
      ran = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(ran, true, "the work was dropped");
  });
});

/* ═══ A FULL QUEUE IS NOT A FULL ROOM ════════════════════════════════════ */

describe("telling a busy database apart from a broken one", () => {
  it("treats only failures that wrote nothing as retryable", () => {
    /* THE WHOLE POINT: these three happen before or instead of a commit, so
       the buyer can safely be told to try again. */
    assert.equal(
      isDatabaseBusy(new Error("timeout exceeded when trying to connect")),
      true,
      "the pool's own acquisition timeout — no connection was ever taken",
    );
    assert.equal(
      isDatabaseBusy(Object.assign(new Error("canceling statement"), { code: "57014" })),
      true,
      "our statement_timeout — the transaction is rolled back",
    );
    assert.equal(
      isDatabaseBusy(Object.assign(new Error("lock not available"), { code: "55P03" })),
      true,
    );
    assert.equal(
      isDatabaseBusy(Object.assign(new Error("too many clients"), { code: "53300" })),
      true,
    );
  });

  it("never calls an ambiguous or a real failure busy", () => {
    /* A connection that died mid-COMMIT may or may not have written the order.
       Telling that buyer "try again" is how somebody ends up holding two sets
       of seats, so it stays an error and is seen as one. */
    assert.equal(
      isDatabaseBusy(Object.assign(new Error("connection terminated"), { code: "08006" })),
      false,
      "an ambiguous commit must not be reported as retryable",
    );
    assert.equal(
      isDatabaseBusy(Object.assign(new Error("duplicate key"), { code: "23505" })),
      false,
      "a constraint violation is a bug, not a queue",
    );
    assert.equal(isDatabaseBusy(new Error("something else entirely")), false);
    assert.equal(isDatabaseBusy(undefined), false);
    assert.equal(isDatabaseBusy(null), false);
  });

  it("refuses a buyer for a full room WITHOUT joining the capacity queue", async () => {
    /* THE FIX FOR THE TWENTY-FOUR SECONDS.
     *
     * Every checkout that reaches `placeOrder` waits its turn on the night's
     * row, and that queue is strictly serial — on Neon it measured ~60ms per
     * buyer. Three hundred buyers for twenty-five seats therefore spent
     * twenty-four seconds queueing to be told, one at a time, that the room
     * was full, and the tail of the queue timed out waiting for a connection
     * before it could even ask.
     *
     * The night's count now arrives in the same statement as the night, so a
     * definitively full room is answered before the lock exists. This asserts
     * exactly that, by watching whether the lock was ever waited on. */
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);
    const original = event.capacity;
    const kept = process.env.DATABASE_PROFILE;

    try {
      const shrunk = await updateEvent(event.id, { capacity: 1 });
      assert.ok(shrunk.ok);
      await order(1); // the room is now full

      process.env.DATABASE_PROFILE = "true";
      resetProfile();

      const refused = await createOrder({
        eventSlug: NIGHT,
        quantity: 1,
        buyer: {
          name: "Nema Mesta",
          email: `full-${Date.now()}@example.com`,
          phone: "069 55 44 33",
        },
      });

      assert.equal(refused.ok, false);
      assert.equal(refused.ok === false && refused.reason, "sold_out");

      const waited = snapshot().find((phase) => phase.phase === "lock.wait");
      assert.equal(
        waited,
        undefined,
        "a buyer for a full room must not queue on the capacity lock at all",
      );
    } finally {
      if (kept === undefined) delete process.env.DATABASE_PROFILE;
      else process.env.DATABASE_PROFILE = kept;
      resetProfile();
      await updateEvent(event.id, { capacity: original });
    }
  });

  it("counts a full room accurately when it refuses one", async () => {
    /* The capacity check and the insert are now ONE statement, so the number a
       refusal reports comes back from the same statement that declined to
       write. It has to be the truth, not a leftover. */
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);
    const original = event.capacity;

    try {
      const shrunk = await updateEvent(event.id, { capacity: 3 });
      assert.ok(shrunk.ok);

      const first = await order(2);
      assert.ok(first.id);

      const refused = await createOrder({
        eventSlug: NIGHT,
        quantity: 2,
        buyer: {
          name: "Prekasno Došao",
          email: `late-${Date.now()}@example.com`,
          phone: "069 99 99 99",
        },
      });

      assert.equal(refused.ok, false);
      assert.equal(refused.ok === false && refused.reason, "sold_out");
      assert.equal(
        refused.ok === false && refused.reason === "sold_out" && refused.remaining,
        1,
        "the refusal says how many are actually left",
      );
      /* And nothing was written by the attempt that was refused. */
      const rows = await query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM ticket_orders WHERE event_id = $1`,
        [event.id],
      );
      assert.equal(Number(rows.rows[0].n), 1, "a refused checkout leaves no order row");
    } finally {
      await updateEvent(event.id, { capacity: original });
    }
  });
});

/* ═══ THE LOSING SCANNER ═════════════════════════════════════════════════ */

describe("the phone that scanned a moment too late", () => {
  it("is told the ticket is used, with the time of the scan that won", async () => {
    /* THE CONTRACT THIS PROTECTS, and the bug it was written for.
     *
     * `redeem` used to decide a loser's verdict from a `standing` CTE sitting
     * beside the UPDATE in ONE statement. Under READ COMMITTED that half of the
     * statement reads the snapshot taken when the statement began — so a
     * scanner that started before the winner committed, blocked on the row
     * lock, and then correctly failed to claim, was handed the ticket AS IT HAD
     * BEEN: still `valid`, `scanned_at` null. The verdict fell through to
     * WRONG EVENT with no time to show.
     *
     * On a single-connection database that can never happen — every
     * transaction is already serialized — which is exactly why it survived
     * until the suite was pointed at a real Postgres server, where four scans
     * in a hundred came back `wrong_event` for a ticket that had just been
     * used. Nobody was let in twice: the claim was always the guarantee. The
     * DOOR was told the wrong thing.
     *
     * The fix is a second statement, which takes a fresh snapshot. What this
     * test can assert without real contention is the contract that fix
     * produces: a loser is told `already_used`, and IS GIVEN THE WINNER'S SCAN
     * TIME — the field the stale snapshot could not have contained. */
    const placed = await order(1);
    const paid = await confirmPayment(placed.id, { provider: "test" }, ORIGIN);
    assert.ok(paid.ok);

    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);
    const scan = { scanned: ticketUrl(ORIGIN, paid.tickets[0].token) };
    const at = { source: "late-phone", door: "ulaz", staff: "Doorman", eventId: event.id };

    const winner = await validateAndRedeemTicket(scan, at);
    assert.equal(winner.outcome, "valid");

    const loser = await validateAndRedeemTicket(scan, { ...at, door: "vip" });
    assert.equal(loser.outcome, "already_used", "never wrong_event for the right night");
    assert.ok(
      loser.ticket?.scannedAt,
      "the loser must be able to say WHEN somebody came in on this code",
    );
    assert.equal(
      loser.ticket?.scannedAt,
      winner.ticket?.scannedAt ?? loser.ticket?.scannedAt,
      "and it is the winning scan's own time",
    );

    /* And the invariant underneath it, which never moved: one admission. */
    const used = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tickets WHERE id = $1 AND status = 'used'`,
      [paid.tickets[0].id],
    );
    const admitted = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ticket_scans
        WHERE ticket_id = $1 AND outcome = 'redeemed'`,
      [paid.tickets[0].id],
    );
    assert.equal(Number(used.rows[0].n), 1);
    assert.equal(Number(admitted.rows[0].n), 1);
  });

  it("still names the other night when the ticket really is for another one", async () => {
    /* The fresh read must not turn a genuine wrong-night refusal into
       something else — and the ticket must stay valid for the night it is
       actually for. */
    const placed = await order(1);
    const paid = await confirmPayment(placed.id, { provider: "test" }, ORIGIN);
    assert.ok(paid.ok);

    const verdict = await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, paid.tickets[0].token) },
      { source: "other-door", door: "ulaz", staff: "Doorman", eventId: "some-other-night" },
    );
    assert.equal(verdict.outcome, "wrong_event");

    const row = await query<{ status: string }>(
      `SELECT status FROM tickets WHERE id = $1`,
      [paid.tickets[0].id],
    );
    assert.equal(row.rows[0].status, "valid", "and it is untouched");
  });
});

/* ═══ THE MAIL PROVIDER IS HAVING A MORNING ══════════════════════════════ */

describe("a mail provider that does not answer", () => {
  it("never touches the payment, the tickets or the door", async () => {
    const kept = process.env.MAIL_PROVIDER;
    process.env.MAIL_PROVIDER = "not-a-real-provider";
    try {
      const placed = await order(2);
      const paid = await confirmPayment(placed.id, { provider: "test" }, ORIGIN);

      assert.ok(paid.ok, "the payment goes through");
      assert.equal(paid.order.paymentStatus, "paid");
      assert.equal(paid.tickets.length, 2);

      const event = await findTicketingEvent(NIGHT, true);
      assert.ok(event);

      /* The delivery is started after the answer goes out, so wait for it to
         settle rather than racing it. */
      const row = await settled(placed.id);

      /* THE FAILURE IS A STATE, WRITTEN DOWN. And `failed` is deliberately NOT
         re-claimable by a machine: whether to try a broken address again is a
         person's decision, on the admin screen, where the error is shown. */
      assert.equal(row.status, "failed");
      assert.ok(row.last_error, "with the provider's own reason kept");

      assert.equal(
        await deliverTickets(buildDelivery(paid.order, event, paid.tickets, ORIGIN)),
        "already-claimed",
        "a failed delivery is not retried behind the club's back",
      );

      /* …and the ticket still opens the door. */
      const scan = await validateAndRedeemTicket(
        { scanned: ticketUrl(ORIGIN, paid.tickets[0].token) },
        { source: "resilience", door: "ulaz", staff: "Test", eventId: event.id },
      );
      assert.equal(scan.outcome, "valid");
    } finally {
      if (kept === undefined) delete process.env.MAIL_PROVIDER;
      else process.env.MAIL_PROVIDER = kept;
    }
  });
});

/* ═══ THE EXACT INSTANT ══════════════════════════════════════════════════ */

describe("the boundary of an expiry", () => {
  it("treats a table hold as dead at exactly its expiry, and takeable", async () => {
    /* THE ONE-MILLISECOND QUESTION. `read` asks `expires_at > now()` and
       `acquire` takes over on `expires_at <= now()`. The two conditions must
       meet exactly — a gap would leave an instant where a table is neither the
       first guest's nor anybody else's, and an overlap would let two guests
       hold it at once. */
    const token = "boundary-session-0001";
    const seat = "S13";
    const taken = await acquireHold({ eventId: TABLES_NIGHT, seatId: seat, token });
    assert.ok(taken.ok);

    /* JUST BEFORE: still theirs, and nobody else may take it. Two seconds
       rather than one millisecond, because a millisecond is shorter than the
       round trip that asks — what is under test is which side of the line the
       DATABASE puts an instant on, not how fine a slice Node can measure. */
    await query(`UPDATE seat_holds SET expires_at = now() + interval '2 seconds'`);
    assert.ok(await getHoldStatus({ eventId: TABLES_NIGHT, seatId: seat, token }));
    assert.equal(
      (await holdStore.acquire({ eventId: TABLES_NIGHT, seatId: seat, token: "other-0001" }))
        .ok,
      false,
    );

    /* EXACTLY AT the expiry: dead to its owner, and available to the next. */
    await query(`UPDATE seat_holds SET expires_at = now()`);
    assert.equal(
      await getHoldStatus({ eventId: TABLES_NIGHT, seatId: seat, token }),
      undefined,
      "a hold at exactly its expiry is not a hold",
    );

    const next = await holdStore.acquire({
      eventId: TABLES_NIGHT,
      seatId: seat,
      token: "other-0002",
    });
    assert.ok(next.ok, "and the table is takeable at exactly that instant");
    assert.equal(next.fresh, true);

    const live = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM seat_holds
        WHERE event_id = $1 AND seat_id = $2 AND status = 'active'`,
      [TABLES_NIGHT, seat],
    );
    assert.equal(Number(live.rows[0].n), 1, "exactly one live row, whatever the instant");
  });

  it("stops a checkout hold consuming capacity at exactly its expiry", async () => {
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const placed = await order(2);
    const beforeCount = await soldFor(event.id);
    assert.equal(beforeCount, 2, "a live hold consumes capacity");

    /* Just before: still holding. Two seconds rather than a millisecond for
       the same reason as the table hold above — the round trip is longer than
       a millisecond, and the question is which side of the line the DATABASE
       puts an instant on. */
    await query(
      `UPDATE ticket_orders SET hold_expires_at = now() + interval '2 seconds'
        WHERE id = $1`,
      [placed.id],
    );
    assert.equal(await soldFor(event.id), 2);

    /* Exactly at it: holding nothing. */
    await query(`UPDATE ticket_orders SET hold_expires_at = now() WHERE id = $1`, [
      placed.id,
    ]);
    assert.equal(
      await soldFor(event.id),
      0,
      "a checkout hold at exactly its expiry consumes nothing",
    );

    /* And a payment that lands afterwards is still honoured — see
       `claimPayment`, which re-counts the room under the event's own lock. */
    const late = await confirmPayment(placed.id, { provider: "test" }, ORIGIN);
    assert.ok(late.ok);
    assert.equal(late.order.paymentStatus, "paid");
    assert.equal(late.tickets.length, 2);
  });

  it("names the three minutes in one place, and the database keeps them", async () => {
    assert.equal(HOLD_SECONDS, 180);
    const taken = await holdStore.acquire({
      eventId: TABLES_NIGHT,
      seatId: "S20",
      token: "duration-check-001",
    });
    assert.ok(taken.ok);
    const seconds =
      (Date.parse(taken.hold.expiresAt) - Date.parse(taken.hold.createdAt)) / 1000;
    assert.ok(
      Math.abs(seconds - HOLD_SECONDS) < 2,
      `the database gave ${seconds}s rather than ${HOLD_SECONDS}`,
    );
  });
});

/* ═══ A CAPACITY EDIT WHILE THE ROOM IS SELLING ══════════════════════════ */

describe("lowering a capacity while people are buying", () => {
  it("never leaves more allocated than the capacity says", async () => {
    /* The check and the write are one transaction, under the same event lock a
       checkout takes — so a purchase that lands mid-edit is counted against
       whichever capacity wins, and never falls between the two. */
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);
    const original = event.capacity;

    try {
      await Promise.all([
        ...Array.from({ length: 12 }, () => order(1).catch(() => undefined)),
        updateEvent(event.id, { capacity: 6 }),
        updateEvent(event.id, { capacity: 8 }),
      ]);

      const after = await findTicketingEvent(NIGHT, true);
      assert.ok(after);
      const allocated = await soldFor(event.id);

      assert.ok(
        allocated <= after.capacity,
        `${allocated} allocated against a capacity of ${after.capacity}`,
      );
    } finally {
      await updateEvent(event.id, { capacity: original });
    }
  });
});

/* ═══ THE FLOOR CANNOT BE HELD HOSTAGE ═══════════════════════════════════ */

describe("the brake on taking tables", () => {
  it("lets a real guest through and stops a script locking the floor", () => {
    /* Forty in five minutes is far past any person committing to a table and
       far short of the hundreds a floor-wide lock-out needs. */
    const key = `stress-${Math.random()}`;
    const now = Date.now();

    for (let i = 0; i < 40; i += 1) {
      assert.equal(takeHold(key, now).ok, true, `attempt ${i + 1} should pass`);
    }

    const refused = takeHold(key, now);
    assert.equal(refused.ok, false, "the forty-first is refused");
    assert.ok(
      refused.ok === false && refused.retryAfterSeconds > 0,
      "and is told when to come back",
    );

    /* Another guest behind the same carrier NAT is unaffected only in so far
       as the window moves on; five minutes later the same source is clear. */
    assert.equal(takeHold(key, now + 5 * 60_000 + 1).ok, true);
  });

  it("stops one address starting an unlimited number of checkouts", () => {
    /* A pending order holds its admissions for ten minutes, so an address that
       could start hundreds of them could make a night look sold out without
       paying for anything. Fifteen in ten minutes is far past a real buyer —
       who starts one, or three if a card is refused — and far below what an
       exhaustion attempt needs. */
    const key = `buyer-${Math.random()}`;
    const now = Date.now();

    for (let i = 0; i < 15; i += 1) {
      assert.equal(takeCheckout(key, now).ok, true, `attempt ${i + 1} should pass`);
    }
    assert.equal(takeCheckout(key, now).ok, false, "the sixteenth is refused");

    /* And the door's own budget is untouched by it: a busy entrance must never
       eat a buyer's allowance, or the other way round. */
    assert.equal(takeScan(key, now).ok, true);
  });
});
