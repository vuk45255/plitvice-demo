/* THE OPERATIONAL SIDE, UNDER TEST.
 *
 * Everything in this file is about the back of the house: who may open what,
 * what the office may do to a table, and what must still be impossible when
 * two people do it at once. It runs against the same real Postgres in memory
 * as the rest of the suite and mocks nothing — every guarantee below is either
 * a database constraint or a rule in one function, and a mocked version of
 * either would be testing the mock.
 *
 * ═══ HOW AUTHORIZATION IS TESTED WITHOUT A BROWSER ════════════════════════
 *
 * `staffFromCookie(value, role)` IS the rule that every staff page and every
 * route handler applies — `staffFor` is one line that reads the jar and calls
 * it. So a session is opened here exactly as signing in opens one (a row, and
 * a cookie value returned once), and the same function the redemption endpoint
 * uses is asked the same question. A test that stubbed the session would prove
 * that the stub works.
 *
 * ═══ THE PASSWORDS ════════════════════════════════════════════════════════
 *
 * scripts/test-setup.mjs deletes them, which puts the staff gate in its
 * development "open" state — right for the rest of the suite, and exactly
 * wrong here, where the question is what happens to somebody who has not
 * signed in. So this file sets them for its own duration and puts the
 * environment back afterwards. */

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { query } from "@/lib/db/client";
import { staffFromCookie } from "@/lib/staff/guard";
import { may } from "@/lib/staff/accounts";
import { openStaffSession } from "@/lib/staff/session";
import { validateAndRedeemTicket } from "@/lib/ticketing/redeem";
import { confirmPayment, createOrder } from "@/lib/ticketing/orders";
import { findTicketingEvent, updateEvent } from "@/lib/ticketing/events";
import {
  countsFor,
  listOrders,
  ticketLinesForOrder,
  ticketsForOrderWithTokens,
} from "@/lib/ticketing/store";
import { buildDelivery, deliverTickets, resendTickets } from "@/lib/ticketing/delivery";
import { ticketUrl } from "@/lib/ticketing/links";
import {
  addPhoneReservation,
  floorState,
  reservationsForEvent,
  setReservationStatus,
} from "@/lib/reservations/admin";
import { holdStore } from "@/lib/reservations/hold-store";
import { SEATS } from "@/lib/floor-plan";
import { seatCapacity } from "@/lib/floor-capacity";
import { reservationStore } from "@/lib/reservations/store";

const NIGHT = "test-night";
const TABLES_NIGHT = "saturday-madness";
const ORIGIN = "https://plitviceclub.test";

const KEPT = {
  admin: process.env.STAFF_ADMIN_PASSWORD,
  scanner: process.env.STAFF_SCANNER_PASSWORD,
};

before(() => {
  process.env.STAFF_ADMIN_PASSWORD = "office-password";
  process.env.STAFF_SCANNER_PASSWORD = "door-password";
});

after(() => {
  if (KEPT.admin === undefined) delete process.env.STAFF_ADMIN_PASSWORD;
  else process.env.STAFF_ADMIN_PASSWORD = KEPT.admin;
  if (KEPT.scanner === undefined) delete process.env.STAFF_SCANNER_PASSWORD;
  else process.env.STAFF_SCANNER_PASSWORD = KEPT.scanner;
});

beforeEach(async () => {
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
  await query(`DELETE FROM mail_deliveries`);
  await query(`DELETE FROM seat_holds`);
  await query(`DELETE FROM reservations`);
  await query(`DELETE FROM staff_sessions`);

  /* THE SEEDED NIGHT, KEPT AHEAD OF THE CLOCK.
   *
   * `saturday-madness` is seeded at a FIXED instant — 29 August 2026, 22:00 —
   * and this suite books tables on it. So on the evening of 29 August 2026 the
   * night went past while the suite was running and fifty-seven cases went red
   * on the clock rather than on a commit; from the morning after, they would
   * have stayed red for ever.
   *
   * The year is moved forward and NOTHING ELSE IS: 29 August at 22:00, in a
   * year nobody will be running this in. The wall-clock date and time are the
   * ones the club's own row carries, so a test that reads "29. avgust" or
   * "22:00" still reads it — only the year, which nothing asserts, has moved.
   *
   * This is the suite's own idiom. Time is moved by ageing a column, never by
   * sleeping and never by mocking a clock; see the hold expiries below. */
  await query(
    `UPDATE events SET starts_at = $1, doors_at = $1 WHERE slug = 'saturday-madness'`,
    [`${new Date().getUTCFullYear() + 5}-08-29T22:00:00+02:00`],
  );
});

/* A party the table can actually hold, read off the plan rather than written
   down here — a separe does not seat two, and the server is right to say so. */
function party(seatId: string): number {
  const seat = SEATS.find((s) => s.id === seatId);
  assert.ok(seat, `${seatId} should be on the floor plan`);
  return seatCapacity(seat).min;
}

/* A session, opened the way signing in opens one. */
const signIn = (role: "admin" | "scanner") =>
  openStaffSession({
    id: role,
    name: role === "admin" ? "Uprava" : "Ulaz — ulaz",
    role,
    door: role === "scanner" ? "ulaz" : undefined,
  });

async function paidOrder(quantity = 1) {
  const created = await createOrder({
    eventSlug: NIGHT,
    quantity,
    buyer: { name: "Marko Marković", email: "kupac@example.com", phone: "069 11 22 33" },
  });
  assert.ok(created.ok, "the test night should be on sale");
  const paid = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
  assert.ok(paid.ok);
  return { order: created.order, tickets: paid.tickets };
}

/* ═══ A, B, C — who may open what ════════════════════════════════════════ */

describe("who may open the back of the house", () => {
  it("gives a stranger nothing at all, with the passwords set", async () => {
    /* TEST A. No cookie is not "a guest" and not "read-only" — it is nobody,
       and the guard hands back undefined, which is how every admin page and
       every admin route refuses. */
    assert.equal(await staffFromCookie(undefined, "admin"), undefined);
    assert.equal(await staffFromCookie(undefined, "scanner"), undefined);
    /* A value somebody made up is not a session either: the row is looked up
       by a hash of it, and there is no row. */
    assert.equal(await staffFromCookie("not-a-real-session", "admin"), undefined);
  });

  it("does not let the door into the office", async () => {
    /* TEST B. The doorman's phone is the likeliest phone in the building to be
       put down on a bar. It opens the scanner and nothing else. */
    const cookie = await signIn("scanner");

    const atDoor = await staffFromCookie(cookie, "scanner");
    assert.ok(atDoor, "the scanner session opens the door");
    assert.equal(atDoor.role, "scanner");

    assert.equal(
      await staffFromCookie(cookie, "admin"),
      undefined,
      "and does not open the office",
    );
    assert.equal(may("scanner", "admin"), false);
  });

  it("lets the office read the reservations and the orders", async () => {
    /* TEST C. The same session, against the same rule, with the data behind
       it — an admin who cannot actually read the two lists is not an admin. */
    const cookie = await signIn("admin");
    const staff = await staffFromCookie(cookie, "admin");
    assert.ok(staff);
    assert.equal(staff.role, "admin");
    /* An admin may work the door as well; a scanner may not work the office. */
    assert.ok(await staffFromCookie(cookie, "scanner"));

    await paidOrder(2);
    await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S20",
        guests: party("S20"),
        name: "Ana Anić",
        phone: "069 44 55 66",
      },
      staff.name,
    );

    assert.equal((await listOrders({ limit: 10 })).length, 1);
    assert.equal((await reservationsForEvent(TABLES_NIGHT)).length, 1);
  });

  it("expires a session by the database's clock, not the browser's", async () => {
    const cookie = await signIn("admin");
    await query(`UPDATE staff_sessions SET expires_at = now() - interval '1 minute'`);
    assert.equal(
      await staffFromCookie(cookie, "admin"),
      undefined,
      "an expired session is nobody",
    );
  });
});

/* ═══ D, E, F — the office and the floor ═════════════════════════════════ */

describe("a booking taken over the telephone", () => {
  it("cannot be written onto a table that is already booked", async () => {
    /* TEST D. The refusal comes from the partial unique index, not from a
       check somebody remembered to write — the same index the site is refused
       by. */
    const first = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S13",
        guests: party("S13"),
        name: "Prvi Gost",
        phone: "069 11 11 11",
      },
      "Uprava",
    );
    assert.ok(first.ok);

    const second = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S13",
        guests: party("S13"),
        name: "Drugi Gost",
        phone: "069 22 22 22",
      },
      "Uprava",
    );
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "seat-taken");

    /* And exactly one row holds the table. */
    const live = (await reservationsForEvent(TABLES_NIGHT)).filter(
      (row) => row.seatId === "S13" && ["pending", "confirmed"].includes(row.status),
    );
    assert.equal(live.length, 1);
  });

  it("does not silently take a table somebody is booking on the site", async () => {
    /* TEST E. THE IMPORTANT ONE. A guest has three minutes with S26 and may be
       typing their telephone number into it right now. Staff are told what is
       happening and when it frees up — and nothing is written. */
    const held = await holdStore.acquire({
      eventId: TABLES_NIGHT,
      seatId: "S26",
      token: "guest-session-000001",
    });
    assert.ok(held.ok);

    const attempt = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S26",
        guests: party("S26"),
        name: "Telefonski Gost",
        phone: "069 33 33 33",
      },
      "Uprava",
    );

    assert.equal(attempt.ok, false);
    assert.equal(attempt.ok === false && attempt.reason, "seat-held");
    assert.equal(
      attempt.ok === false && attempt.reason === "seat-held" && attempt.heldUntil,
      held.hold.expiresAt,
      "and staff are told when it frees up",
    );

    /* NOTHING WAS WRITTEN, and the guest still has their hold. */
    assert.equal((await reservationsForEvent(TABLES_NIGHT)).length, 0);
    const still = await holdStore.read({
      eventId: TABLES_NIGHT,
      seatId: "S26",
      token: "guest-session-000001",
    });
    assert.ok(still, "the guest's three minutes are untouched");
    assert.equal(still.expiresAt, held.hold.expiresAt);
  });

  it("takes the table once the hold has run out", async () => {
    await holdStore.acquire({
      eventId: TABLES_NIGHT,
      seatId: "S26",
      token: "guest-session-000002",
    });
    /* Time is moved by ageing the column, never by sleeping. */
    await query(`UPDATE seat_holds SET expires_at = now() - interval '1 second'`);

    const attempt = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S26",
        guests: party("S26"),
        name: "Telefonski Gost",
        phone: "069 33 33 34",
      },
      "Uprava",
    );
    assert.ok(attempt.ok, "an expired hold holds nothing");
  });

  it("can take a held table only when it is asked to explicitly", async () => {
    /* The override exists so the club can be given a second confirm one day.
       NOTHING IN THE APPLICATION PASSES IT — no button, no query parameter, no
       environment variable. This test is its only caller, which is the point:
       an override that can be reached by accident is not an override. */
    await holdStore.acquire({
      eventId: TABLES_NIGHT,
      seatId: "S33",
      token: "guest-session-000003",
    });

    const forced = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S33",
        guests: party("S33"),
        name: "Hitno",
        phone: "069 55 55 55",
      },
      "Uprava",
      { takeHeldSeat: true },
    );
    assert.ok(forced.ok);
  });

  it("frees the table again when the booking is cancelled", async () => {
    /* TEST F. Nothing is deleted: the row keeps its history and its time, and
       the table comes back because the partial index stops covering a
       cancelled booking. */
    const made = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S04",
        guests: party("S04"),
        name: "Otkazani Gost",
        phone: "069 66 66 66",
      },
      "Uprava",
    );
    assert.ok(made.ok);

    const before = await floorState(TABLES_NIGHT);
    assert.equal(before.seats.find((s) => s.id === "S04")?.state, "reserved");

    const cancelled = await setReservationStatus(made.reservation.id, "cancelled", "Uprava");
    assert.ok(cancelled.ok);

    const after = await floorState(TABLES_NIGHT);
    assert.equal(
      after.seats.find((s) => s.id === "S04")?.state,
      "available",
      "the table is back on the floor",
    );

    /* The booking itself is still there, with who cancelled it written on. */
    const row = await reservationStore.find(made.reservation.id);
    assert.ok(row);
    assert.equal(row.status, "cancelled");
    assert.equal(row.updatedBy, "Uprava");

    /* And the table can be given to somebody else. */
    const next = await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S04",
        guests: party("S04"),
        name: "Novi Gost",
        phone: "069 77 77 77",
      },
      "Uprava",
    );
    assert.ok(next.ok);
  });

  it("shows the office three states and never a token", async () => {
    await holdStore.acquire({
      eventId: TABLES_NIGHT,
      seatId: "S20",
      token: "guest-session-000004",
    });
    await addPhoneReservation(
      {
        eventId: TABLES_NIGHT,
        seatId: "S13",
        guests: party("S13"),
        name: "Gost",
        phone: "069 88 88 88",
      },
      "Uprava",
    );

    const floor = await floorState(TABLES_NIGHT);
    assert.equal(floor.seats.find((s) => s.id === "S20")?.state, "held");
    assert.equal(floor.seats.find((s) => s.id === "S13")?.state, "reserved");
    assert.ok(floor.counts.available > 0);

    /* The office is shown who booked a table — it has to ring them — but a
       hold is anonymous even here: the guest's session token is the thing that
       proves a claim on a table and it never leaves the server. */
    assert.ok(!JSON.stringify(floor).includes("guest-session-000004"));
  });
});

/* ═══ G — the capacity floor ═════════════════════════════════════════════ */

describe("changing a night's capacity", () => {
  it("cannot be set below what is already sold", async () => {
    /* TEST G. Enforced in `updateEvent`, which is the one function that writes
       to the events table — not in the form, which is one of several things
       that could ask. */
    await paidOrder(3);
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const counts = await countsFor(event.id);
    assert.equal(counts.paid, 3);

    const refused = await updateEvent(event.id, { capacity: 2 });
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "capacity_below_sold");
    assert.equal(
      refused.ok === false && refused.reason === "capacity_below_sold" && refused.taken,
      3,
      "and it says how many are already spoken for",
    );

    /* The night is untouched. */
    const after = await findTicketingEvent(NIGHT, true);
    assert.equal(after?.capacity, event.capacity);

    /* Exactly at the number sold is allowed — that is a club closing a night
       off, not overselling one. */
    const allowed = await updateEvent(event.id, { capacity: 3 });
    assert.ok(allowed.ok);
    assert.equal(allowed.event.capacity, 3);

    /* And the night is put back, because the events table is the one thing
       this suite does not empty between tests: it is seeded once and edited,
       exactly as production is, so a test that lowers a capacity and leaves
       it lowered breaks the next one. */
    const restored = await updateEvent(event.id, { capacity: event.capacity });
    assert.ok(restored.ok);
  });

  it("counts admissions inside a live checkout, not only paid ones", async () => {
    /* A capacity that ignores the people currently paying is a capacity that
       is wrong ten minutes later. */
    const pending = await createOrder({
      eventSlug: NIGHT,
      quantity: 4,
      buyer: { name: "U Toku", email: "utoku@example.com", phone: "069 12 12 12" },
    });
    assert.ok(pending.ok);

    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);
    const refused = await updateEvent(event.id, { capacity: 1 });
    assert.equal(refused.ok, false);
  });
});

/* ═══ H, I — payment and mail ════════════════════════════════════════════ */

describe("tickets, once the money is in", () => {
  it("mints exactly once however many confirmations arrive", async () => {
    /* TEST H. The claim is `UPDATE … WHERE payment_status = 'pending'` and the
       insert is under UNIQUE (order_id, seq); this fires five confirmations at
       one order, three of them at the same instant. */
    const created = await createOrder({
      eventSlug: NIGHT,
      quantity: 3,
      buyer: { name: "Marko Marković", email: "kupac@example.com", phone: "069 11 22 33" },
    });
    assert.ok(created.ok);

    const first = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
    assert.ok(first.ok);
    assert.equal(first.minted, true);

    const again = await Promise.all([
      confirmPayment(created.order.id, { provider: "test" }, ORIGIN),
      confirmPayment(created.order.id, { provider: "test" }, ORIGIN),
      confirmPayment(created.order.id, { provider: "test" }, ORIGIN),
    ]);
    for (const result of again) {
      assert.ok(result.ok);
      assert.equal(result.minted, false, "only the first call mints");
      assert.equal(result.tickets.length, 3);
    }

    const tickets = await ticketLinesForOrder(created.order.id);
    assert.equal(tickets.length, 3, "three admissions, not twelve");

    /* And one delivery, whatever happened above. */
    const rows = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ticket_deliveries WHERE order_id = $1`,
      [created.order.id],
    );
    assert.equal(Number(rows.rows[0].n), 1);
  });

  it("sends the tickets once, and a retry does not mint a second set", async () => {
    /* TEST I. Delivery is claimed by a row with the order as its PRIMARY KEY,
       so the second and third attempts find the job taken. Sending again by
       hand is allowed — the club chose to — and it still mints nothing,
       because minting is not delivery's business at all. */
    const { order, tickets } = await paidOrder(2);
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const delivery = buildDelivery(order, event, tickets, ORIGIN);

    /* `confirmPayment` already claimed it once. */
    assert.equal(await deliverTickets(delivery), "already-claimed");
    assert.equal(await deliverTickets(delivery), "already-claimed");

    assert.equal(await resendTickets(delivery), "sent");
    assert.equal(await resendTickets(delivery), "sent");

    assert.equal(
      (await ticketLinesForOrder(order.id)).length,
      2,
      "four delivery attempts, two tickets",
    );

    const record = await query<{ attempts: number; status: string }>(
      `SELECT attempts, status FROM ticket_deliveries WHERE order_id = $1`,
      [order.id],
    );
    assert.equal(record.rows[0].status, "sent");
    assert.ok(Number(record.rows[0].attempts) >= 2, "and the attempts are counted");
  });

  it("keeps a paid order paid when the mail cannot go out", async () => {
    /* THE RULE THAT MATTERS MOST IN THIS FILE. A mail provider that is named
       but unreachable throws; the payment, the tickets and the guest's page
       are unaffected, and the failure is written down where the office can
       see it. */
    const kept = process.env.MAIL_PROVIDER;
    process.env.MAIL_PROVIDER = "not-a-real-provider";
    try {
      const created = await createOrder({
        eventSlug: NIGHT,
        quantity: 2,
        buyer: { name: "Bez Pošte", email: "bez@example.com", phone: "069 13 13 13" },
      });
      assert.ok(created.ok);

      const paid = await confirmPayment(created.order.id, { provider: "test" }, ORIGIN);
      assert.ok(paid.ok, "the payment goes through");
      assert.equal(paid.order.paymentStatus, "paid");
      assert.equal(paid.tickets.length, 2, "and the tickets exist");

      const event = await findTicketingEvent(NIGHT, true);
      assert.ok(event);
      const outcome = await deliverTickets(
        buildDelivery(paid.order, event, paid.tickets, ORIGIN),
      );
      /* Either the confirmation already claimed it, or this call did and
         failed. Both are states; neither is an exception. */
      assert.ok(["failed", "already-claimed"].includes(outcome));

      /* The tickets still open the door. */
      const scan = await validateAndRedeemTicket(
        { scanned: ticketUrl(ORIGIN, paid.tickets[0].token) },
        { source: "test", door: "ulaz", staff: "Test", eventId: event.id },
      );
      assert.equal(scan.outcome, "valid");
    } finally {
      if (kept === undefined) delete process.env.MAIL_PROVIDER;
      else process.env.MAIL_PROVIDER = kept;
    }
  });
});

/* ═══ J, K — the door ════════════════════════════════════════════════════ */

describe("the door, under two phones", () => {
  it("admits one of two scanners and tells the other it is already used", async () => {
    /* TEST J. One statement decides and marks; the loser is handed the row as
       it was, which is what lets it say WHEN somebody came in on this code. */
    const { tickets } = await paidOrder(1);
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const scan = { scanned: ticketUrl(ORIGIN, tickets[0].token) };
    const [a, b] = await Promise.all([
      validateAndRedeemTicket(scan, {
        source: "phone-a",
        door: "ulaz",
        staff: "Doorman A",
        eventId: event.id,
      }),
      validateAndRedeemTicket(scan, {
        source: "phone-b",
        door: "vip",
        staff: "Doorman B",
        eventId: event.id,
      }),
    ]);

    const outcomes = [a.outcome, b.outcome].sort();
    assert.deepEqual(outcomes, ["already_used", "valid"]);

    /* The door and the member of staff who won are written onto the ticket
       and into the scan log — which is how the club answers "who let them
       in" the next afternoon. */
    const lines = await ticketLinesForOrder(tickets[0].orderId);
    assert.equal(lines[0].status, "used");
    assert.ok(lines[0].scannedAt);
    assert.ok(lines[0].door === "ulaz" || lines[0].door === "vip");

    const scans = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ticket_scans WHERE ticket_id = $1`,
      [tickets[0].id],
    );
    assert.equal(Number(scans.rows[0].n), 2, "both attempts are written down");
  });

  it("is not something a phone without a session may do", async () => {
    /* TEST K. The endpoint's first line is `staffFor("scanner")`, which is
       this rule with the cookie read out of the request. Nobody, an unknown
       cookie and an expired session are all the same answer.
       The redemption service itself is deliberately NOT re-checking staff: it
       is reachable only through that endpoint and through the office, and one
       place to enforce a rule is better than two that can drift. */
    assert.equal(await staffFromCookie(undefined, "scanner"), undefined);
    assert.equal(await staffFromCookie("guessed-value", "scanner"), undefined);

    const cookie = await signIn("scanner");
    await query(`UPDATE staff_sessions SET expires_at = now() - interval '1 second'`);
    assert.equal(await staffFromCookie(cookie, "scanner"), undefined);
  });

  it("tells the door nothing about the guest", async () => {
    const { order, tickets } = await paidOrder(1);
    const event = await findTicketingEvent(NIGHT, true);
    assert.ok(event);

    const verdict = await validateAndRedeemTicket(
      { scanned: ticketUrl(ORIGIN, tickets[0].token) },
      { source: "phone", door: "ulaz", staff: "Doorman", eventId: event.id },
    );

    const said = JSON.stringify(verdict);
    assert.ok(!said.includes(order.customerName));
    assert.ok(!said.includes(order.customerEmail));
    assert.ok(!said.includes(order.customerPhone));
    assert.ok(!said.includes(tickets[0].token));
  });

  it("never puts a token on an office screen", async () => {
    /* The office list is allowed the public reference — PLV-XXXXX-XXXXX — and
       never the secret in the QR. */
    const { order, tickets } = await paidOrder(2);
    const lines = await ticketLinesForOrder(order.id);
    const said = JSON.stringify(lines);

    for (const ticket of await ticketsForOrderWithTokens(order.id)) {
      assert.ok(!said.includes(ticket.token), "no token reaches the office list");
    }
    assert.equal(lines.length, 2);
    assert.ok(lines.every((line) => line.reference.startsWith("PLV-")));
    assert.equal(tickets.length, 2);
  });
});
