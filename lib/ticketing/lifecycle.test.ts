/* The ticket's life, from a checkout hold to a refused second scan.
 *
 * These are the cases the club's money and the club's door depend on, and they
 * are written against the services rather than against the store — because
 * what has to be true is "a paid order produces four working tickets and the
 * second scan of one of them is refused", not "a row got an update".
 *
 * Run with `npm test`. No framework: Node's own test runner, Node's own type
 * stripping, and a real Postgres in memory. Nothing to install, nothing to
 * configure, and NOTHING MOCKED — every guarantee being checked here is
 * enforced by a database constraint, so a suite that mocked the database would
 * be testing the mock. See scripts/test-setup.mjs. */

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { closeDatabase, query } from "@/lib/db/client";
import { confirmPayment, createOrder, refundOrder } from "@/lib/ticketing/orders";
import { validateAndRedeemTicket } from "@/lib/ticketing/redeem";
import {
  __resetTicketingStoreForTests,
  countsFor,
  findTicketByToken,
  searchOrders,
  soldFor,
  ticketsForOrderWithTokens,
} from "@/lib/ticketing/store";
import { __resetScanRateForTests } from "@/lib/ticketing/rate-limit";
import { normalizeReference, newTicketToken } from "@/lib/ticketing/tokens";
import { hashToken } from "@/lib/ticketing/secrets";
import { tokenFromScan, ticketUrl } from "@/lib/ticketing/links";
import { findTicketingEvent } from "@/lib/ticketing/events";

const ORIGIN = "https://plitviceclub.test";

/* The two test nights. The small one exists so that selling out and racing for
   the last ticket take four orders rather than five hundred. */
const NIGHT = "test-night";
const SMALL = "test-night-small";

const BUYER = {
  name: "Marko Marković",
  email: "marko@example.com",
  phone: "069 60 60 50",
};

/* A door working the test night. The night is the SERVER's — the scanner sends
   nothing about it — so it is part of the context here too. */
let doorEventId = "";
const atTheDoor = () => ({ source: `test-${(sources += 1)}`, door: "ulaz", staff: "Test", eventId: doorEventId });
let sources = 0;

/* A pending order holding its admissions, with the hold's ten minutes intact. */
async function startCheckout(quantity: number, eventSlug = NIGHT) {
  const created = await createOrder({ eventSlug, quantity, buyer: BUYER });
  assert.ok(created.ok, `the ${eventSlug} night should be on sale`);
  return created;
}

/* A paid order for `quantity` admissions, and its tickets. The whole of the
   production path: an order, a confirmation arriving separately, minting. */
async function buyAndPay(quantity: number, eventSlug = NIGHT) {
  const created = await startCheckout(quantity, eventSlug);
  const confirmed = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
  assert.ok(confirmed.ok, "a pending order should be payable");
  return confirmed;
}

/* Ten minutes passing, without ten minutes passing.
 *
 * The hold's expiry is a column compared against the database's own clock, so
 * a test moves the column rather than the clock — which is the same thing the
 * production code will see when a guest walks away from a payment page, and is
 * a great deal more honest than a mocked `Date.now`. */
async function lapseHold(orderId: string) {
  await query(
    `UPDATE ticket_orders SET hold_expires_at = now() - interval '1 second'
      WHERE id = $1`,
    [orderId],
  );
}

beforeEach(async () => {
  await __resetTicketingStoreForTests();
  __resetScanRateForTests();
  const event = await findTicketingEvent(NIGHT, true);
  assert.ok(event);
  doorEventId = event.id;
});

after(async () => {
  await closeDatabase();
});

describe("starting a checkout", () => {
  it("works the total out from the club's own price, not from the request", async () => {
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const created = await createOrder({
      eventSlug: NIGHT,
      quantity: 3,
      buyer: BUYER,
      /* A price sent by the browser. It must be ignored entirely. */
      totalAmount: 1,
      ticketPrice: 1,
    } as unknown);

    assert.ok(created.ok);
    assert.equal(created.order.totalAmount, event.ticketPrice * 3);
  });

  it("holds the admissions for ten minutes without taking any money", async () => {
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const created = await startCheckout(4);
    assert.equal(created.order.paymentStatus, "pending");

    const left = Date.parse(created.order.holdExpiresAt) - Date.now();
    assert.ok(left > 9 * 60_000 && left <= 10 * 60_000 + 5_000, `ten minutes, got ${left}ms`);

    /* And they are gone from the room while the hold is alive. */
    const counts = await countsFor(event.id);
    assert.equal(counts.held, 4);
    assert.equal(counts.paid, 0);
    assert.equal(counts.available, event.capacity - 4);
  });

  it("gives the admissions back when the ten minutes run out", async () => {
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const created = await startCheckout(4);
    assert.equal(await soldFor(event.id), 4);

    await lapseHold(created.order.id);

    /* NOTHING RAN. No sweep, no timer, no background job — the count simply
       stops including a hold whose instant has passed, because that condition
       is inside the query. */
    assert.equal(await soldFor(event.id), 0);
    const counts = await countsFor(event.id);
    assert.equal(counts.held, 0);
    assert.equal(counts.available, event.capacity);
  });

  it("refuses a night that is not on sale", async () => {
    /* saturday-madness is a draft: announced, entry taken at the door. */
    const created = await createOrder({
      eventSlug: "saturday-madness",
      quantity: 1,
      buyer: BUYER,
    });
    assert.equal(created.ok, false);
  });

  it("refuses a malformed buyer without creating anything", async () => {
    const created = await createOrder({
      eventSlug: NIGHT,
      quantity: 1,
      buyer: { name: "x", email: "not-an-email", phone: "12" },
    });

    assert.equal(created.ok, false);
    assert.equal(await soldFor("evt_test_night"), 0);
  });

  it("refuses an order it cannot seat", async () => {
    const event = await findTicketingEvent(SMALL, true);
    assert.ok(event);

    let placed = 0;
    while (placed < event.capacity) {
      const take = Math.min(event.maxPerOrder, event.capacity - placed);
      const order = await createOrder({ eventSlug: SMALL, quantity: take, buyer: BUYER });
      assert.ok(order.ok, `should fit ${take} more`);
      placed += take;
    }

    const overflow = await createOrder({ eventSlug: SMALL, quantity: 1, buyer: BUYER });
    assert.equal(overflow.ok, false);
    assert.equal(await soldFor(event.id), event.capacity);
  });

  it("sells the last ticket to exactly one of a hundred people asking together", async () => {
    const event = await findTicketingEvent(SMALL, true);
    assert.ok(event);

    /* Fill the room to one place short. */
    let placed = 0;
    while (placed < event.capacity - 1) {
      const take = Math.min(event.maxPerOrder, event.capacity - 1 - placed);
      const order = await createOrder({ eventSlug: SMALL, quantity: take, buyer: BUYER });
      assert.ok(order.ok);
      placed += take;
    }

    /* And then a hundred people reach for it in the same instant. */
    const attempts = await Promise.all(
      Array.from({ length: 100 }, () =>
        createOrder({ eventSlug: SMALL, quantity: 1, buyer: BUYER }),
      ),
    );

    const won = attempts.filter((a) => a.ok);
    assert.equal(won.length, 1, "exactly one may have the last ticket");
    assert.equal(await soldFor(event.id), event.capacity, "and the room is not oversold");
  });
});

describe("an order becoming paid", () => {
  it("mints one ticket per admission, each with its own token and reference", async () => {
    const { order, tickets, minted } = await buyAndPay(4);

    assert.equal(minted, true);
    assert.equal(order.paymentStatus, "paid");
    assert.equal(tickets.length, 4, "four admissions are four tickets");

    /* Four people who can arrive separately. One code for four is a party
       that cannot. */
    assert.equal(new Set(tickets.map((t) => t.token)).size, 4);
    assert.equal(new Set(tickets.map((t) => t.reference)).size, 4);
    assert.deepEqual(tickets.map((t) => t.seq), [1, 2, 3, 4]);
    for (const ticket of tickets) assert.equal(ticket.status, "valid");
  });

  it("is idempotent — a retried payment notice mints nothing new", async () => {
    const first = await buyAndPay(2);
    assert.ok(first.ok);

    /* Exactly what a payment provider does when it does not hear back. Five
       times, because they really do. */
    const retries = await Promise.all(
      Array.from({ length: 5 }, () =>
        confirmPayment(first.order.id, { provider: "test" }, ORIGIN),
      ),
    );

    for (const retry of retries) {
      assert.ok(retry.ok);
      assert.equal(retry.minted, false, "no retry mints anything");
      assert.equal(retry.tickets.length, 2);
    }

    const all = await ticketsForOrderWithTokens(first.order.id);
    assert.equal(all.length, 2, "still two tickets, whatever the provider does");
  });

  it("sends the tickets exactly once, however many notices arrive", async () => {
    const { order } = await buyAndPay(2);

    await Promise.all(
      Array.from({ length: 4 }, () =>
        confirmPayment(order.id, { provider: "test" }, ORIGIN),
      ),
    );

    /* One row in ticket_deliveries per order, and the PRIMARY KEY is what
       makes that true — see lib/ticketing/delivery.ts. */
    const rows = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ticket_deliveries WHERE order_id = $1`,
      [order.id],
    );
    assert.equal(Number(rows.rows[0].n), 1, "one delivery, not four");
  });

  it("still honours a payment that lands after the hold lapsed, and says so", async () => {
    const event = await findTicketingEvent(SMALL, true);
    assert.ok(event);

    const late = await startCheckout(2, SMALL);
    await lapseHold(late.order.id);

    /* The room fills behind them while they were away from the payment page. */
    let placed = 0;
    while (placed < event.capacity) {
      const take = Math.min(event.maxPerOrder, event.capacity - placed);
      const order = await createOrder({ eventSlug: SMALL, quantity: take, buyer: BUYER });
      assert.ok(order.ok);
      placed += take;
    }

    const confirmed = await confirmPayment(late.order.id, { provider: "test" }, ORIGIN);

    assert.ok(confirmed.ok, "money that has arrived is never refused");
    assert.equal(confirmed.tickets.length, 2, "and the tickets are real");
    assert.equal(
      confirmed.order.oversold,
      true,
      "but the club is told there are more guests than seats",
    );
  });

  it("does not mint anything for an order nobody has paid for", async () => {
    const created = await startCheckout(2);
    const tickets = await ticketsForOrderWithTokens(created.order.id);
    assert.equal(tickets.length, 0);
  });
});

describe("the door", () => {
  it("lets a valid ticket in, once", async () => {
    const { tickets } = await buyAndPay(1);
    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };

    const first = await validateAndRedeemTicket(scan, atTheDoor());
    assert.equal(first.outcome, "valid");
    assert.equal(first.ticket?.reference, tickets[0].reference);
    assert.ok(first.ticket?.scannedAt, "an admission records its moment");

    const second = await validateAndRedeemTicket(scan, atTheDoor());
    assert.equal(second.outcome, "already_used");
    assert.equal(
      second.ticket?.scannedAt,
      first.ticket?.scannedAt,
      "the second scan reports the moment of the scan that won, not its own",
    );
  });

  it("admits exactly one of two scans that arrive together", async () => {
    const { tickets } = await buyAndPay(1);
    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };

    /* Two doormen, two phones, one code held up twice. */
    const [a, b] = await Promise.all([
      validateAndRedeemTicket(scan, atTheDoor()),
      validateAndRedeemTicket(scan, atTheDoor()),
    ]);

    assert.deepEqual([a.outcome, b.outcome].sort(), ["already_used", "valid"]);
  });

  it("admits exactly one of twenty scans that arrive together", async () => {
    const { tickets } = await buyAndPay(1);
    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };

    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () => validateAndRedeemTicket(scan, atTheDoor())),
    );

    const admitted = outcomes.filter((o) => o.outcome === "valid");
    assert.equal(admitted.length, 1, "one code is one admission, whatever the traffic");
  });

  it("treats the tickets of one order as independent", async () => {
    const { tickets } = await buyAndPay(4);

    const one = await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, tickets[1].token) },
      atTheDoor(),
    );
    assert.equal(one.outcome, "valid");

    /* The other three are untouched — a group does not arrive together. */
    for (const index of [0, 2, 3]) {
      const other = await validateAndRedeemTicket(
        { scanned: ticketUrl(ORIGIN, tickets[index].token) },
        atTheDoor(),
      );
      assert.equal(other.outcome, "valid");
    }
  });

  it("refuses a ticket for another night — and leaves it valid", async () => {
    const other = await findTicketingEvent(SMALL, true);
    assert.ok(other);

    const { tickets } = await buyAndPay(1);
    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };

    /* The same ticket, at a door working the other night. */
    const refused = await validateAndRedeemTicket(scan, {
      ...atTheDoor(),
      eventId: other.id,
    });
    assert.equal(refused.outcome, "wrong_event");

    /* THE IMPORTANT HALF: it was not spent. A guest who came on the wrong
       evening comes back on the right one and their ticket still works. */
    const later = await validateAndRedeemTicket(scan, atTheDoor());
    assert.equal(later.outcome, "valid");
  });

  it("refuses a token that names nothing", async () => {
    await buyAndPay(1);

    const nobodys = await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, newTicketToken()) },
      atTheDoor(),
    );
    assert.equal(nobodys.outcome, "invalid");
    assert.equal(nobodys.ticket, undefined, "and says nothing about anything");
  });

  it("refuses something that is not a ticket at all", async () => {
    for (const nonsense of ["", "hello", "https://example.com/promo", "t/short"]) {
      const result = await validateAndRedeemTicket({ scanned: nonsense }, atTheDoor());
      assert.equal(result.outcome, "invalid", nonsense);
    }
  });

  it("refuses a cancelled ticket and never lets it back in", async () => {
    const { order, tickets } = await buyAndPay(2);

    const refunded = await refundOrder(order.id);
    assert.ok(refunded.ok);
    assert.equal(refunded.cancelled, 2);

    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };
    assert.equal((await validateAndRedeemTicket(scan, atTheDoor())).outcome, "cancelled");
    /* And it stays refused, however many times it is presented. */
    assert.equal((await validateAndRedeemTicket(scan, atTheDoor())).outcome, "cancelled");
  });

  it("leaves a ticket that has already been used alone when the order is refunded", async () => {
    const { order, tickets } = await buyAndPay(2);

    await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, tickets[0].token) },
      atTheDoor(),
    );
    const refunded = await refundOrder(order.id);

    assert.ok(refunded.ok);
    assert.equal(refunded.cancelled, 1, "what happened at the door happened");
  });

  it("admits a hand-typed reference through the same judgement", async () => {
    const { tickets } = await buyAndPay(1);

    /* As somebody would type it in a doorway: lower case, spaces for dashes,
       and the letter O where the ticket has a zero. */
    const fumbled = tickets[0].reference
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/0/g, "o");

    assert.equal((await validateAndRedeemTicket({ typed: fumbled }, atTheDoor())).outcome, "valid");
    assert.equal(
      (await validateAndRedeemTicket({ typed: fumbled }, atTheDoor())).outcome,
      "already_used",
      "the manual path is not a second, looser way in",
    );
  });

  it("writes down every attempt, including the refusals", async () => {
    const { tickets } = await buyAndPay(1);
    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };

    await validateAndRedeemTicket(scan, atTheDoor());
    await validateAndRedeemTicket(scan, atTheDoor());

    const scans = await query<{ outcome: string }>(
      `SELECT outcome FROM ticket_scans ORDER BY id ASC`,
    );
    assert.deepEqual(
      scans.rows.map((r) => r.outcome),
      ["redeemed", "already_used"],
    );
  });

  it("tells the door nothing about the guest", async () => {
    const { tickets } = await buyAndPay(1);
    const result = await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, tickets[0].token) },
      atTheDoor(),
    );

    const shown = JSON.stringify(result);
    for (const secret of [BUYER.name, BUYER.email, BUYER.phone]) {
      assert.equal(shown.includes(secret), false, secret);
    }
  });
});

describe("what a QR code carries", () => {
  it("is one opaque token and nothing else", async () => {
    const { order, tickets } = await buyAndPay(1);
    const encoded = ticketUrl(ORIGIN, tickets[0].token);

    /* Nothing personal, nothing about the money, nothing countable. */
    for (const secret of [
      BUYER.name,
      BUYER.email,
      BUYER.phone,
      String(order.totalAmount),
      order.id,
      tickets[0].id,
    ]) {
      assert.equal(encoded.includes(secret), false, secret);
    }

    assert.equal(encoded, `${ORIGIN}/t/${tickets[0].token}`);
    assert.match(tickets[0].token, /^[A-Za-z0-9_-]{32}$/);
  });

  it("is unguessable, and is not a counter", async () => {
    const { tickets } = await buyAndPay(10);
    const tokens = tickets.map((t) => t.token);

    assert.equal(new Set(tokens).size, 10);
    for (const token of tokens) {
      /* 24 random bytes — 192 bits — printed as base64url. */
      assert.equal(Buffer.from(token, "base64url").length, 24);
    }
  });

  it("is read back out of whatever the camera saw", () => {
    const token = newTicketToken();

    assert.equal(tokenFromScan(`${ORIGIN}/t/${token}`), token);
    assert.equal(tokenFromScan(`http://192.168.1.26:3000/t/${token}`), token);
    assert.equal(tokenFromScan(`  ${token}  `), token);

    assert.equal(tokenFromScan("https://instagram.com/plitviceclub"), null);
    assert.equal(tokenFromScan("PLV-4K7XM-9Q2DT"), null);
    assert.equal(tokenFromScan(""), null);
  });

  it("folds the mistakes a person makes typing a reference", () => {
    assert.equal(normalizeReference("plv 4k7xm 9q2dt"), "PLV-4K7XM-9Q2DT");
    assert.equal(normalizeReference("4K7XM9Q2DT"), "PLV-4K7XM-9Q2DT");
    /* Crockford's own substitutions: O is 0, I and L are 1. */
    assert.equal(normalizeReference("PLV-O1234-5678I"), "PLV-01234-56781");

    assert.equal(normalizeReference("PLV-123"), null);
    assert.equal(normalizeReference(""), null);
  });
});

describe("the locks on the simulated payment", () => {
  /* THREE LOCKS, AND ALL THREE WOULD HAVE TO FAIL TOGETHER for a ticket to be
     minted without money. Two of them are checked here; the third is that the
     dev route answers 404 and the dev provider is not bundled at all in a
     production build, which is checked by running one — see the verification
     notes. A simulated confirmation is by definition a way of getting a real
     ticket without paying, so none of this is theoretical. */

  it("is shut the moment TICKETING_DEV_MODE stops saying true", async () => {
    const { devMode } = await import("@/lib/ticketing/config");
    const was = process.env.TICKETING_DEV_MODE;
    try {
      assert.equal(devMode(), true, "the suite runs with it open");

      for (const value of ["false", "1", "TRUE", "yes", ""]) {
        process.env.TICKETING_DEV_MODE = value;
        assert.equal(devMode(), false, `"${value}" is not "true"`);
      }

      delete process.env.TICKETING_DEV_MODE;
      assert.equal(devMode(), false, "and absent is not true either");
    } finally {
      process.env.TICKETING_DEV_MODE = was;
    }
  });

  it("makes the test nights disappear with it", async () => {
    const was = process.env.TICKETING_DEV_MODE;
    try {
      process.env.TICKETING_DEV_MODE = "false";

      /* Not "cannot be bought" — CANNOT BE FOUND. A test night does not exist
         to a server that is not in development, so nothing can sell one, scan
         one, or show one. */
      assert.equal(await findTicketingEvent(NIGHT, false), undefined);

      const created = await createOrder({ eventSlug: NIGHT, quantity: 1, buyer: BUYER });
      assert.equal(created.ok, false);
    } finally {
      process.env.TICKETING_DEV_MODE = was;
    }
  });

  it("refuses to verify a notice when dev mode is shut", async () => {
    const { devPaymentProvider } = await import("@/lib/ticketing/payments/dev");
    const notice = {
      rawBody: JSON.stringify({ orderId: "ord_anything" }),
      headers: new Headers(),
    };

    const was = process.env.TICKETING_DEV_MODE;
    try {
      assert.equal((await devPaymentProvider.verifyPayment(notice)).ok, true);

      process.env.TICKETING_DEV_MODE = "false";
      const verdict = await devPaymentProvider.verifyPayment(notice);
      assert.equal(verdict.ok, false, "the provider refuses on its own, not because a caller asked");
    } finally {
      process.env.TICKETING_DEV_MODE = was;
    }
  });

  it("is the only thing that can mint, and it takes a verdict to do it", async () => {
    const { verifyAndConfirm } = await import("@/lib/ticketing/orders");
    const { devPaymentProvider } = await import("@/lib/ticketing/payments/dev");

    const created = await startCheckout(1);
    const was = process.env.TICKETING_DEV_MODE;
    try {
      process.env.TICKETING_DEV_MODE = "false";

      const result = await verifyAndConfirm(
        devPaymentProvider,
        { rawBody: JSON.stringify({ orderId: created.order.id }), headers: new Headers() },
        ORIGIN,
      );

      assert.equal(result.ok, false);
      assert.equal(
        (await ticketsForOrderWithTokens(created.order.id)).length,
        0,
        "a refused verdict mints nothing",
      );
    } finally {
      process.env.TICKETING_DEV_MODE = was;
    }
  });
});

describe("what the database keeps", () => {
  it("never stores a ticket's token", async () => {
    const { tickets } = await buyAndPay(2);

    const rows = await query<{ token_hash: string; token_cipher: string }>(
      `SELECT token_hash, token_cipher FROM tickets ORDER BY seq ASC`,
    );

    for (const [i, row] of rows.rows.entries()) {
      const token = tickets[i].token;
      assert.equal(row.token_hash, hashToken(token), "looked up by hash");
      assert.equal(row.token_hash.includes(token), false);
      assert.equal(row.token_cipher.includes(token), false, "and sealed, not stored");
    }

    /* And the ticket still opens from the token in the URL. */
    const found = await findTicketByToken(tickets[0].token);
    assert.equal(found?.reference, tickets[0].reference);
  });

  it("finds an order by anything a person on the telephone can tell you", async () => {
    const { order, tickets } = await buyAndPay(2);

    for (const term of [
      order.reference,
      tickets[0].reference,
      "Marković",
      "marko@example.com",
      "+38169606050",
    ]) {
      const found = await searchOrders(term);
      assert.equal(found.length, 1, `should find one for ${term}`);
      assert.equal(found[0].id, order.id, term);
    }

    assert.equal((await searchOrders("nobody at all")).length, 0);
  });
});
