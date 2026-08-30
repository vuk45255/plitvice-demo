/* WHAT THE OFFICE IS TOLD ABOUT A NIGHT, AND WHAT IT IS NEVER TOLD.
 *
 * ═══ THE TWO CLASSES OF BUG THIS SUITE EXISTS FOR ═════════════════════════
 *
 * THE FIRST IS AN INFLATED NUMBER. A report that counts scan attempts instead
 * of admissions says three people came through a door one person walked
 * through; a report that multiplies a configured price by a paid count invents
 * money for orders that were comped, refunded, or bought at last month's price.
 * Both are the kind of wrong that is never noticed, because both look
 * plausible and neither throws.
 *
 * THE SECOND IS A ZERO THAT MEANS "NEVER MEASURED". The club ran ten nights
 * before this software existed. Every aggregate in the report module returns 0
 * for one of them, truthfully, and every one of those zeros reads as "sold
 * nothing" on a screen. That distinction is not a display detail — it is the
 * whole reason `legacy_archive` is a column — so it is tested here as a
 * property of the data rather than trusted to a page.
 *
 * Real Postgres in memory, nothing mocked. Time is moved by ageing a column.
 * Run with `npm test`. */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { closeDatabase, query } from "@/lib/db/client";
import { createEvent, findTicketingEvent, allTicketingEvents } from "@/lib/ticketing/events";
import { confirmPayment, createOrder, refundOrder } from "@/lib/ticketing/orders";
import { redeem, ticketsForOrderWithTokens } from "@/lib/ticketing/store";
import {
  accessReport,
  eventReport,
  reportSummaries,
  saleLines,
  salesReport,
} from "@/lib/club/event-report";
import { isOperational } from "@/lib/club/event-manager";
import { legacyArchiveIds } from "@/lib/club/programme-seed";

const ORIGIN = "https://plitviceclub.test";
const NIGHT = "test-night";

const BUYER = {
  name: "Marko Marković",
  email: "marko@example.com",
  phone: "069 60 60 50",
};

async function buyAndPay(quantity: number, eventSlug = NIGHT) {
  const created = await createOrder({ eventSlug, quantity, buyer: BUYER });
  assert.ok(created.ok, `the ${eventSlug} night should be on sale`);
  const confirmed = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
  assert.ok(confirmed.ok, "a pending order should be payable");
  return confirmed;
}

/* A booking, inserted as a row. The reservation DOMAIN — holds, refusals, the
   unique index — is lib/reservations/holds.test.ts and lib/staff/operations.test.ts;
   what is under test here is only whether the report adds them up correctly. */
async function book(
  eventSlug: string,
  seatId: string,
  status: "confirmed" | "pending" | "cancelled",
  guests: number,
) {
  await query(
    `INSERT INTO reservations
       (id, event_id, seat_id, seat_type, zone, guests, name, phone, email,
        note, phone_key, email_key, status, source)
     VALUES ($1, $2, $3, 'booth', 'a', $4, 'Gost', $5, '', '', $5, '', $6, 'phone')`,
    [`res_${eventSlug}_${seatId}`, eventSlug, seatId, guests, `0601${seatId}`, status],
  );
}

const night = async (slug = NIGHT) => {
  const events = await allTicketingEvents();
  const found = events.find((event) => event.slug === slug);
  assert.ok(found, `${slug} should exist`);
  return found;
};

beforeEach(async () => {
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
  await query(`DELETE FROM seat_holds`);
  await query(`DELETE FROM reservations`);
});

/* ═══ 1 — THE SALE ═══════════════════════════════════════════════════════ */

describe("what a night sold", () => {
  it("counts admissions and money only from orders that were actually paid", async () => {
    await buyAndPay(3);
    await buyAndPay(2);
    /* Started and never paid — holds seats, is not revenue. */
    const pending = await createOrder({ eventSlug: NIGHT, quantity: 4, buyer: BUYER });
    assert.ok(pending.ok);

    const event = await night();
    const sales = await salesReport(event);

    assert.equal(sales.ticketsPaid, 5, "three plus two, and not the pending four");
    assert.equal(sales.ticketsHeld, 4, "the pending order is holding its seats");
    assert.equal(sales.orders.paid, 2);
    assert.equal(sales.orders.pending, 1);

    /* THE MONEY IS THE SUM OF WHAT ORDERS WERE CHARGED, never price × count. */
    const charged = await query<{ total: string }>(
      `SELECT COALESCE(SUM(total_amount),0)::bigint AS total
         FROM ticket_orders WHERE event_id = $1 AND payment_status = 'paid'`,
      [event.id],
    );
    assert.equal(
      sales.paidOnlineRevenue,
      Number(charged.rows[0].total),
      "revenue is what the paid orders carry",
    );
    assert.ok(sales.paidOnlineRevenue > 0);
  });

  it("stops counting a pending order the moment its hold lapses", async () => {
    const pending = await createOrder({ eventSlug: NIGHT, quantity: 4, buyer: BUYER });
    assert.ok(pending.ok);

    const event = await night();
    assert.equal((await salesReport(event)).ticketsHeld, 4);

    /* Ten minutes, without ten minutes: the expiry is a column compared
       against the database's clock, so the test moves the column. */
    await query(
      `UPDATE ticket_orders SET hold_expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [pending.order.id],
    );

    const after = await salesReport(event);
    assert.equal(after.ticketsHeld, 0, "a lapsed order holds nothing");
    assert.equal(after.orders.pending, 0, "and is not counted as in-flight");
    assert.equal(
      after.orders.expired,
      1,
      "it is an expired order, whatever its status column says until the sweep runs",
    );
  });

  /* THE PROPERTY THAT CATCHES THE WHOLE CLASS OF BUG. If any state of an order
     falls into no bucket, the breakdown silently stops describing the night —
     and a lapsed pending order did exactly that until the filter above was
     widened. Asserted across every state an order can be in. */
  it("puts every order in exactly one bucket, whatever state it is in", async () => {
    await buyAndPay(2);
    const refunded = await buyAndPay(1);
    assert.ok((await refundOrder(refunded.order.id)).ok);

    const live = await createOrder({ eventSlug: NIGHT, quantity: 1, buyer: BUYER });
    assert.ok(live.ok);
    const lapsed = await createOrder({ eventSlug: NIGHT, quantity: 1, buyer: BUYER });
    assert.ok(lapsed.ok);
    await query(
      `UPDATE ticket_orders SET hold_expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [lapsed.order.id],
    );

    const { orders } = await salesReport(await night());
    assert.equal(
      orders.paid + orders.pending + orders.expired + orders.failed + orders.refunded,
      orders.total,
      "the buckets partition the night",
    );
    assert.equal(orders.total, 4);
  });

  it("averages what was actually paid, and reports no average when nothing sold", async () => {
    const event = await night();
    assert.equal(
      (await salesReport(event)).averagePaidPrice,
      undefined,
      "an average over nothing is absent, never zero",
    );

    await buyAndPay(4);
    const sales = await salesReport(event);
    assert.ok(sales.averagePaidPrice !== undefined);
    assert.equal(
      sales.averagePaidPrice,
      Math.round(sales.paidOnlineRevenue / sales.ticketsPaid),
      "average is revenue over admissions, not the configured price",
    );
  });

  it("keeps a refund apart from the takings rather than silently netting it", async () => {
    const paid = await buyAndPay(2);
    const event = await night();
    const before = await salesReport(event);

    assert.ok((await refundOrder(paid.order.id)).ok);

    const after = await salesReport(event);
    assert.equal(after.orders.refunded, 1);
    assert.equal(after.ticketsPaid, 0, "a refunded order is not a sold ticket");
    assert.equal(after.paidOnlineRevenue, 0, "and is not paid revenue");
    assert.equal(
      after.refundedAmount,
      before.paidOnlineRevenue,
      "the money is reported as refunded, on its own line",
    );
  });

  it("reports each order line at what that order actually charged per ticket", async () => {
    const paid = await buyAndPay(3);
    const lines = await saleLines((await night()).id);

    const line = lines.find((row) => row.id === paid.order.id);
    assert.ok(line);
    assert.equal(line.quantity, 3);
    assert.equal(
      line.unitAmount,
      Math.round(line.totalAmount / 3),
      "the unit price comes off the order, not off the event",
    );
    assert.equal(line.ticketsIssued, 3);
    assert.equal(line.ticketsAdmitted, 0, "nobody has come in yet");
  });
});

/* ═══ 2 — THE DOOR ═══════════════════════════════════════════════════════ */

describe("who actually came in", () => {
  it("counts one admission per ticket however many times it is scanned", async () => {
    const paid = await buyAndPay(2);
    const event = await night();
    const tickets = await ticketsForOrderWithTokens(paid.order.id);
    assert.equal(tickets.length, 2);

    /* One guest, one ticket, held up four times — the first lets them in and
       the other three come back ALREADY USED and are written to the log. */
    for (let i = 0; i < 4; i += 1) {
      await redeem({ token: tickets[0].token }, event.id, "Test", "ulaz");
    }

    const access = await accessReport(event.id);
    assert.equal(access.admitted, 1, "one person walked through that door once");
    assert.equal(access.attempts, 4, "and every attempt was written down");
    assert.equal(access.refused, 3, "three of them were refusals");
    assert.equal(access.unused, 1, "the order's second ticket never came");
    assert.equal(access.issued, 2);
  });

  it("reports the first and last admission from redemptions only", async () => {
    const paid = await buyAndPay(2);
    const event = await night();
    const tickets = await ticketsForOrderWithTokens(paid.order.id);

    await redeem({ token: tickets[0].token }, event.id, "Test", "ulaz");
    /* A refusal after the last real entry must not become the last entry. */
    await redeem({ token: tickets[0].token }, event.id, "Test", "ulaz");

    const access = await accessReport(event.id);
    assert.ok(access.firstScanAt, "somebody came in");
    assert.equal(
      access.firstScanAt,
      access.lastScanAt,
      "one admission is both the first and the last",
    );
  });

  it("never counts a scan against a night that did not happen here", async () => {
    const event = await night();
    const access = await accessReport(event.id);
    assert.deepEqual(
      { admitted: access.admitted, issued: access.issued, attempts: access.attempts },
      { admitted: 0, issued: 0, attempts: 0 },
    );
  });
});

/* ═══ 3 — THE FLOOR ══════════════════════════════════════════════════════ */

describe("what was booked", () => {
  it("counts only the two statuses that actually hold a table", async () => {
    const event = await night();

    await book(event.slug, "1", "confirmed", 4);
    await book(event.slug, "2", "confirmed", 6);
    await book(event.slug, "3", "cancelled", 5);

    const report = (await eventReport(event)).reservations;
    assert.equal(report.total, 3, "every row is in the record");
    assert.equal(report.confirmed, 2);
    assert.equal(report.cancelled, 1);
    assert.equal(report.tablesTaken, 2, "a cancelled table is not a taken one");
    assert.equal(
      report.guestsBooked,
      10,
      "and its guests are not counted either — four plus six",
    );
  });

  /* THE FLOOR IS KEYED BY SLUG AND THE TICKETS BY ID. Getting that backwards
     silently reports zero reservations for every night, for ever, and nothing
     throws. It is the single most likely mistake in this module. */
  it("reads reservations by slug, which is not the ticketing id", async () => {
    const event = await night();
    assert.notEqual(event.id, event.slug, "the premise of this test");

    await book(event.slug, "9", "confirmed", 3);

    assert.equal((await eventReport(event)).reservations.tablesTaken, 1);
    const summaries = await reportSummaries([event]);
    assert.equal(summaries.get(event.id)?.tablesTaken, 1, "and the batch agrees");
  });
});

/* ═══ 4 — MANY NIGHTS AT ONCE ════════════════════════════════════════════ */

describe("the programme's figures in one pass", () => {
  it("gives every night the same answer the per-night report gives", async () => {
    await buyAndPay(3);
    const event = await night();
    const tickets = await ticketsForOrderWithTokens(
      (await saleLines(event.id))[0].id,
    );
    await redeem({ token: tickets[0].token }, event.id, "Test", "ulaz");

    const events = await allTicketingEvents();
    const summaries = await reportSummaries(events);

    /* Every night, not just the one that sold — a night with no rows must come
       back as a real zero rather than as a missing key. */
    for (const one of events) {
      const summary = summaries.get(one.id);
      assert.ok(summary, `${one.slug} should have a summary`);
      const full = await eventReport(one);
      assert.equal(summary.ticketsPaid, full.sales.ticketsPaid, one.slug);
      assert.equal(summary.admitted, full.access.admitted, one.slug);
      assert.equal(summary.tablesTaken, full.reservations.tablesTaken, one.slug);
      assert.equal(
        summary.paidOnlineRevenue,
        full.sales.paidOnlineRevenue,
        one.slug,
      );
    }
  });

  it("answers for an empty programme without asking the database anything", async () => {
    assert.equal((await reportSummaries([])).size, 0);
  });
});

/* ═══ 5 — A POSTER IS NOT A NIGHT THIS SYSTEM RAN ════════════════════════ */

describe("legacy archive nights", () => {
  it("classifies exactly the poster-only nights the seed names, and no others", async () => {
    const events = await allTicketingEvents();
    const legacy = new Set(legacyArchiveIds());
    assert.ok(legacy.size > 0, "the seed names some poster nights");

    for (const event of events) {
      assert.equal(
        event.legacyArchive,
        legacy.has(event.id),
        `${event.slug} should be ${legacy.has(event.id) ? "" : "not "}legacy`,
      );
      assert.equal(isOperational(event), !legacy.has(event.id), event.slug);
    }
  });

  it("keeps Saturday Madness operational, free door and all", async () => {
    const events = await allTicketingEvents();
    const madness = events.find((event) => event.slug === "saturday-madness");
    assert.ok(madness, "the club's own night is in the table");
    assert.equal(madness.ticketingEnabled, false, "the premise: it sells nothing online");
    assert.equal(
      isOperational(madness),
      true,
      "a night with no online sale is still a night this system runs",
    );
  });

  /* THE RULE THAT MUST NOT BE AN INFERENCE. A real night that has sold nothing
     yet looks exactly like a poster night to any query — same zeros, same
     absent rows — and treating it as one would delete a live event from the
     office's own dashboard. */
  it("does not treat a real night with no orders as an archive poster", async () => {
    const made = await createEvent({
      title: "Sasvim novo veče",
      slug: "sasvim-novo-vece",
      startsAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
      capacity: 300,
      ticketPrice: 1000,
      status: "on_sale",
    });
    assert.ok(made.ok);

    const stored = await findTicketingEvent(made.event.id, true);
    assert.ok(stored);
    assert.equal(stored.legacyArchive, false, "nothing sold is not the same as nothing ran");
    assert.equal(isOperational(stored), true);

    const report = await eventReport(stored);
    assert.equal(report.sales.ticketsPaid, 0);
    assert.equal(report.sales.averagePaidPrice, undefined);

    await query(`DELETE FROM events WHERE id = $1`, [made.event.id]);
  });

  it("is written by the schema and survives a re-run of it", async () => {
    /* The classification statement runs on every start. Running it again must
       change nothing and must never reach a night the office created. */
    const before = await query<{ id: string; legacy_archive: boolean }>(
      `SELECT id, legacy_archive FROM events ORDER BY id`,
    );
    await query(
      `UPDATE events SET legacy_archive = true
        WHERE id = ANY($1::text[]) AND legacy_archive = false`,
      [legacyArchiveIds()],
    );
    const after = await query<{ id: string; legacy_archive: boolean }>(
      `SELECT id, legacy_archive FROM events ORDER BY id`,
    );
    assert.deepEqual(after.rows, before.rows, "re-running it is a no-op");
  });
});

/* One connection, closed once, so the runner exits. */
process.on("beforeExit", () => void closeDatabase());
