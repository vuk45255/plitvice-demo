/* The three minutes, from both sides of them.
 *
 * These are the cases the floor depends on: that a separe cannot be handed to
 * two people, that letting go happens by itself and on the DATABASE's clock,
 * and that nothing at all can be booked by a browser that merely says it is
 * holding something. They are written against the services rather than the
 * store wherever there is a service to write them against, because what has to
 * be true is "the second guest is refused", not "a row got an update".
 *
 * Run with `npm test`. Node's own test runner, Node's own type stripping, and
 * a real Postgres in memory — see scripts/test-setup.mjs. NOTHING IS MOCKED,
 * because every guarantee here is a partial unique index or a conditional
 * write, and a suite that mocked the database would be testing the mock.
 *
 * ═══ THREE MINUTES PASS WITHOUT THREE MINUTES PASSING ═════════════════════
 *
 * A hold is dead when `expires_at` has passed according to `now()` inside the
 * statement that asks. So a test ages the COLUMN rather than the clock — which
 * is exactly the state the production code meets when a guest walks away from
 * a form, and is a great deal more honest than a mocked `Date.now` that the
 * SQL would not have looked at anyway. */

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { closeDatabase, query } from "@/lib/db/client";
import {
  HOLD_SECONDS,
  acquireHold,
  consumeHold,
  getHoldStatus,
  releaseHold,
  seatAvailability,
} from "@/lib/reservations/holds";
import { __resetHoldStoreForTests, holdStore } from "@/lib/reservations/hold-store";
import {
  __resetReservationStoreForTests,
  reservationStore,
} from "@/lib/reservations/store";
import {
  addPhoneReservation,
  editReservation,
  floorState,
  reservationsForEvent,
  setReservationStatus,
} from "@/lib/reservations/admin";
import { notifyReservationConfirmed } from "@/lib/reservations/notify";
import { mailDeliveryFor } from "@/lib/mail/send";
import { requestReservation } from "@/lib/reservations/service";
import { seatCapacity } from "@/lib/floor-capacity";
import { SEATS } from "@/lib/floor-plan";

/* The one night the club is taking tables for. */
const NIGHT = "saturday-madness";
const FREE = "S12";
const OTHER_FREE = "S11";
const THIRD_FREE = "S14";

const ANA = "session-ana-0000000000";
const BOJAN = "session-bojan-000000000";

/* Ten minutes past the three, so nothing rests on rounding. */
async function age(seatId: string, eventId = NIGHT) {
  await query(
    `UPDATE seat_holds SET expires_at = now() - interval '10 minutes'
      WHERE event_id = $1 AND seat_id = $2 AND status = 'active'`,
    [eventId, seatId],
  );
}

beforeEach(async () => {
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

  await __resetHoldStoreForTests();
  await __resetReservationStoreForTests();
  /* The delivery claim is keyed by (kind, reservation id) and survives the
     reservation itself, so a run that did not clear it would be testing
     yesterday's rows. */
  await query(`DELETE FROM mail_deliveries`);
});

/* WAITING FOR WORK THAT WAS DELIBERATELY NOT AWAITED.
 *
 * The confirmation mail is handed to `afterResponse` — outside a request scope
 * that is a floating promise, which is exactly right in production and means a
 * test has to look for the result rather than await it. Polling the row is
 * honest about that: it asks the database the same question the office screen
 * asks, and fails loudly rather than hanging. It is not a sleep standing in for
 * an expiry — those are still done by ageing a column. */
async function eventually<T>(
  look: () => Promise<T | null | undefined>,
  what: string,
): Promise<T> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const found = await look();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`timed out waiting for ${what}`);
}

after(async () => {
  await closeDatabase();
});

/* One guest's details. Unique per call, because the house refuses a second
   table to the same telephone or email on the same night, and that rule is not
   what most of this is testing. */
let guestNo = 0;
function guest() {
  guestNo += 1;
  return {
    name: "Marko Marković",
    phone: `06012${String(guestNo).padStart(5, "0")}`,
    email: `gost${guestNo}@example.com`,
  };
}

/* The brake is keyed by source and counts successes too, so every attempt gets
   its own — a rate limit is not what these tests are about either. */
let sourceNo = 0;
const freshSource = () => ({ source: `test-${(sourceNo += 1)}` });

/* A party the table can actually hold. Read off the plan rather than written
   down here — a separe does not seat two, and the server is right to say so. */
function partyFor(seatId: string) {
  const seat = SEATS.find((s) => s.id === seatId);
  assert.ok(seat, `${seatId} should be on the floor plan`);
  return seatCapacity(seat).min;
}

function booking(seatId: string, extra: Record<string, unknown> = {}) {
  return { eventId: NIGHT, seatId, guests: partyFor(seatId), ...guest(), ...extra };
}

describe("acquiring a hold", () => {
  it("gives an available table to the guest who asks for it", async () => {
    const result = await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA });

    assert.ok(result.ok, "an untouched table should be free to hold");
    assert.equal(result.hold.seatId, FREE);
    assert.ok(
      result.hold.remainingSeconds > HOLD_SECONDS - 5 &&
        result.hold.remainingSeconds <= HOLD_SECONDS,
      `three minutes, got ${result.hold.remainingSeconds}s`,
    );
  });

  it("refuses the same table to a second guest while the first still has it", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const second = await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN });

    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "seat-held");
  });

  it("lets the second guest have it once the three minutes are up", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await age(FREE);

    const second = await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN });

    assert.ok(second.ok, "an expired hold blocks nothing");
    assert.ok(second.hold.remainingSeconds > HOLD_SECONDS - 5, "and starts a fresh three minutes");
  });

  it("gives the table to exactly one of two guests asking at the same instant", async () => {
    const [a, b] = await Promise.all([
      acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA }),
      acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN }),
    ]);

    assert.equal([a.ok, b.ok].filter(Boolean).length, 1, "one separe, one guest");
  });

  it("gives the table to exactly one of twenty guests asking at the same instant", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        acquireHold({ eventId: NIGHT, seatId: FREE, token: `session-${i}-000000000000` }),
      ),
    );

    assert.equal(attempts.filter((a) => a.ok).length, 1);
  });

  it("refuses a table the club has already booked", async () => {
    const written = await reservationStore.claim({
      eventId: NIGHT,
      seatId: FREE,
      seatType: "booth",
      zone: 1,
      guests: partyFor(FREE),
      name: "Klub",
      phone: "0600000000",
      email: "klub@example.com",
      note: "",
      phoneKey: "+381600000000",
      emailKey: "klub@example.com",
      source: "phone",
    });
    assert.ok(written.ok);

    const result = await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "seat-reserved");
  });

  it("refuses a night that does not take tables, and a table that is not on the floor", async () => {
    const wrongNight = await acquireHold({
      eventId: "vodka-experience",
      seatId: FREE,
      token: ANA,
    });
    assert.equal(wrongNight.ok, false);

    const noSuchTable = await acquireHold({
      eventId: NIGHT,
      seatId: "Z99",
      token: ANA,
    });
    assert.equal(noSuchTable.ok, false);
  });

  it("lets one guest hold only one table at a time, releasing the last", async () => {
    const first = await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA });
    assert.ok(first.ok);

    const second = await acquireHold({ eventId: NIGHT, seatId: OTHER_FREE, token: ANA });
    assert.ok(second.ok);

    /* The first is free again at once rather than in three minutes. */
    const somebodyElse = await acquireHold({
      eventId: NIGHT,
      seatId: FREE,
      token: BOJAN,
    });
    assert.ok(somebodyElse.ok, "the table they walked away from is on the floor again");
  });

  it("keeps the table it has when a guest reaches for one somebody else holds", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: OTHER_FREE, token: BOJAN })).ok);

    /* Bojan reaches for Ana's table and is refused. */
    const refused = await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN });
    assert.equal(refused.ok, false);

    /* And still has his own. */
    const mine = await getHoldStatus({ eventId: NIGHT, seatId: OTHER_FREE, token: BOJAN });
    assert.ok(mine, "a refused reach must not cost a guest the table they had");
  });

  it("returns the same expiry on a refresh rather than starting again", async () => {
    const first = await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA });
    assert.ok(first.ok);

    const again = await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA });
    assert.ok(again.ok);
    assert.equal(
      again.hold.expiresAt,
      first.hold.expiresAt,
      "a timer that can be reset by pressing F5 is not a timer",
    );
  });
});

describe("reading a hold back", () => {
  it("reports what is left of this session's own hold", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const mine = await getHoldStatus({ eventId: NIGHT, seatId: FREE, token: ANA });
    assert.ok(mine);
    assert.ok(mine.remainingSeconds > 0 && mine.remainingSeconds <= HOLD_SECONDS);
  });

  it("tells another session nothing", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    assert.equal(
      await getHoldStatus({ eventId: NIGHT, seatId: FREE, token: BOJAN }),
      undefined,
    );
  });

  it("treats an expired hold as no hold", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await age(FREE);
    assert.equal(
      await getHoldStatus({ eventId: NIGHT, seatId: FREE, token: ANA }),
      undefined,
    );
  });
});

describe("what the floor looks like to everybody else", () => {
  it("shows one guest's hold as held to the others and as their own to them", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const toAna = await seatAvailability({ eventId: NIGHT, token: ANA });
    assert.deepEqual(toAna.mine, [FREE]);
    assert.deepEqual(toAna.held, []);
    assert.ok(toAna.holdExpiresAt);

    const toBojan = await seatAvailability({ eventId: NIGHT, token: BOJAN });
    assert.deepEqual(toBojan.mine, []);
    assert.deepEqual(toBojan.held, [FREE]);
    assert.equal(toBojan.holdExpiresAt, undefined);
  });

  it("puts nobody's token on the wire", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    const seen = JSON.stringify(await seatAvailability({ eventId: NIGHT, token: BOJAN }));
    assert.equal(seen.includes(ANA), false);
  });

  it("frees a table the moment its guest hands it back", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await releaseHold({ eventId: NIGHT, seatId: FREE, token: ANA });

    assert.deepEqual((await seatAvailability({ eventId: NIGHT })).held, []);
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN })).ok);
  });

  it("ignores a release sent by somebody who does not hold it", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await releaseHold({ eventId: NIGHT, seatId: FREE, token: BOJAN });

    assert.ok(
      await getHoldStatus({ eventId: NIGHT, seatId: FREE, token: ANA }),
      "Ana still has her table",
    );
  });

  it("stops showing an expired hold as held", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await age(FREE);
    assert.deepEqual((await seatAvailability({ eventId: NIGHT })).held, []);
  });
});

describe("turning a hold into a reservation", () => {
  it("books the table for the guest who holds it", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const result = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });

    assert.ok(result.ok, "a held table books");
    assert.equal(result.reservation.seatId, FREE);
    /* CONFIRMED, by the same statement that took the table. Nobody in the
       office was asked and nobody has to be. */
    assert.equal(result.reservation.status, "confirmed");
    assert.equal(result.reservation.source, "web");
    assert.equal(
      result.reservation.updatedBy,
      undefined,
      "no member of staff touched it",
    );

    /* And it is gone from the floor for good, not for three minutes. */
    assert.ok((await seatAvailability({ eventId: NIGHT })).reserved.includes(FREE));
  });

  it("refuses a request carrying no hold at all", async () => {
    const result = await requestReservation(booking(FREE), freshSource());

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "hold-expired");
  });

  it("refuses a guest whose hold token is not the one holding the table", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const result = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: BOJAN,
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "hold-invalid");
  });

  it("refuses the owner once their three minutes have run out", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await age(FREE);

    const result = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "hold-expired");
  });

  it("spends a hold exactly once, so a double submit cannot book twice", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const first = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.ok(first.ok);

    const second = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.equal(second.ok, false, "the second tap has nothing left to spend");
  });

  it("books the table for exactly one of two guests submitting together", async () => {
    /* Both hold different tables, then both submit for the one Ana holds —
       which is what a replayed request from a shared link looks like. */
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const [a, b] = await Promise.all([
      requestReservation(booking(FREE), { ...freshSource(), holdToken: ANA }),
      requestReservation(booking(FREE), { ...freshSource(), holdToken: ANA }),
    ]);

    assert.equal([a.ok, b.ok].filter(Boolean).length, 1, "one table, one booking");
  });

  it("sends the guest back to the floor when the table went while the form was open", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    /* Somebody books it out from under her — a telephone booking, which is
       exactly the case this is protecting against.
       IT TAKES `takeHeldSeat` TO DO IT. Staff are refused a table somebody is
       booking on the site and told when it frees up; the override is the one
       way past that and nothing in the application passes it (see the note
       over `ManualReservationOptions`). It is used here because what is under
       test is what happens to ANA afterwards, and this is the only way to
       produce that state. Her hold is let go at once so the map catches up
       instead of showing the table dim for three more minutes. */
    const byPhone = await addPhoneReservation(
      {
        eventId: NIGHT,
        seatId: FREE,
        guests: partyFor(FREE),
        name: "Telefon Gost",
        phone: "0611111111",
      },
      "Šef sale",
      { takeHeldSeat: true },
    );
    assert.ok(byPhone.ok);

    const refused = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.equal(refused.ok, false);
    /* Told the same thing a lapsed hold is told, because to the guest they are
       the same thing: that table is not being written down for you, choose
       another. Nothing is said about who took it. */
    assert.equal(refused.ok === false && refused.reason, "hold-expired");

    /* And she can take another table at once. */
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: THIRD_FREE, token: ANA })).ok);
  });

  it("hands the hold back when the claim falls through after it was spent", async () => {
    const who = guest();

    /* She already has a table for this night, which is the house rule that
       will refuse the second one — AFTER the hold has been consumed. */
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: OTHER_FREE, token: ANA })).ok);
    const first = await requestReservation(
      { eventId: NIGHT, seatId: OTHER_FREE, guests: partyFor(OTHER_FREE), ...who },
      { ...freshSource(), holdToken: ANA },
    );
    assert.ok(first.ok);

    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    const second = await requestReservation(
      { eventId: NIGHT, seatId: FREE, guests: partyFor(FREE), ...who },
      { ...freshSource(), holdToken: ANA },
    );
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "duplicate");

    /* THE HOLD IS BACK. A refusal that came from the rules rather than from
       the table being gone must not also cost her the three minutes. */
    assert.ok(
      await getHoldStatus({ eventId: NIGHT, seatId: FREE, token: ANA }),
      "the spent hold was restored",
    );
  });

  it("leaves the hold alone when the form itself is wrong", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);

    const result = await requestReservation(
      { ...booking(FREE), phone: "12" },
      { ...freshSource(), holdToken: ANA },
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "invalid");

    /* The hold was never spent: a mistyped telephone number must not cost a
       guest their table. */
    assert.ok(await getHoldStatus({ eventId: NIGHT, seatId: FREE, token: ANA }));
  });
});

describe("the club's own side of the floor", () => {
  it("writes a telephone booking into the same table the site reads", async () => {
    const result = await addPhoneReservation(
      {
        eventId: NIGHT,
        seatId: FREE,
        guests: partyFor(FREE),
        name: "Telefon Gost",
        phone: "0622222222",
        note: "Rođendan",
      },
      "Šef sale",
    );

    assert.ok(result.ok);
    assert.equal(result.reservation.status, "confirmed", "the call was the confirmation");
    assert.equal(result.reservation.source, "phone");

    /* THE POINT: the site cannot offer it any more. */
    assert.ok((await seatAvailability({ eventId: NIGHT })).reserved.includes(FREE));
    const held = await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA });
    assert.equal(held.ok, false);
  });

  it("refuses a second booking on a table it has already given away", async () => {
    const first = await addPhoneReservation(
      { eventId: NIGHT, seatId: FREE, guests: partyFor(FREE), name: "Prvi", phone: "0633333333" },
      "Šef sale",
    );
    assert.ok(first.ok);

    const second = await addPhoneReservation(
      { eventId: NIGHT, seatId: FREE, guests: partyFor(FREE), name: "Drugi", phone: "0644444444" },
      "Šef sale",
    );
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "seat-taken");
  });

  it("puts a rejected table back on the floor without losing the booking", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    const booked = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.ok(booked.ok);

    const rejected = await setReservationStatus(booked.reservation.id, "rejected");
    assert.ok(rejected.ok);

    /* Back on the map… */
    assert.equal(
      (await seatAvailability({ eventId: NIGHT })).reserved.includes(FREE),
      false,
    );
    /* …and still in the book. */
    const kept = await reservationStore.find(booked.reservation.id);
    assert.equal(kept?.status, "rejected");
    assert.equal(kept?.name, booked.reservation.name);
  });

  it("refuses to un-cancel a booking onto a table somebody else now has", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    const booked = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.ok(booked.ok);

    assert.ok((await setReservationStatus(booked.reservation.id, "cancelled")).ok);

    const somebodyElse = await addPhoneReservation(
      { eventId: NIGHT, seatId: FREE, guests: partyFor(FREE), name: "Novi", phone: "0655555555" },
      "Šef sale",
    );
    assert.ok(somebodyElse.ok);

    const back = await setReservationStatus(booked.reservation.id, "confirmed");
    assert.equal(back.ok, false);
    assert.equal(back.ok === false && back.reason, "seat-taken");
  });

  it("refuses one guest two tables on the site, but not on the telephone", async () => {
    const who = guest();

    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    const first = await requestReservation(
      { eventId: NIGHT, seatId: FREE, guests: partyFor(FREE), ...who },
      { ...freshSource(), holdToken: ANA },
    );
    assert.ok(first.ok);

    assert.ok((await acquireHold({ eventId: NIGHT, seatId: OTHER_FREE, token: ANA })).ok);
    const second = await requestReservation(
      { eventId: NIGHT, seatId: OTHER_FREE, guests: partyFor(OTHER_FREE), ...who },
      { ...freshSource(), holdToken: ANA },
    );
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "duplicate");

    /* Staff, however, are trusted to know it is the cousins. */
    const byPhone = await addPhoneReservation(
      {
        eventId: NIGHT,
        seatId: THIRD_FREE,
        guests: partyFor(THIRD_FREE),
        name: who.name,
        phone: who.phone,
        email: who.email,
      },
      "Šef sale",
    );
    assert.ok(byPhone.ok, "the telephone is not bound by the site's duplicate rule");
  });
});

describe("the store underneath", () => {
  it("keeps exactly one live hold per table", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        holdStore.acquire({ eventId: NIGHT, seatId: FREE, token: `t-${i}-000000000000` }),
      ),
    );

    const live = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM seat_holds
        WHERE event_id = $1 AND seat_id = $2 AND status = 'active'`,
      [NIGHT, FREE],
    );
    assert.equal(Number(live.rows[0].n), 1);
  });

  it("names the three minutes in one place", () => {
    assert.equal(HOLD_SECONDS, 180);
  });

  it("says what a consume failed on", async () => {
    assert.deepEqual(await consumeHold({ eventId: NIGHT, seatId: FREE, token: ANA }), {
      ok: false,
      reason: "hold-missing",
    });

    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    assert.deepEqual(await consumeHold({ eventId: NIGHT, seatId: FREE, token: BOJAN }), {
      ok: false,
      reason: "hold-invalid",
    });

    await age(FREE);
    assert.deepEqual(await consumeHold({ eventId: NIGHT, seatId: FREE, token: ANA }), {
      ok: false,
      reason: "hold-expired",
    });
  });
});

/* ═══ A BOOKING THAT CONFIRMS ITSELF ══════════════════════════════════════
 *
 * The club used to ring back: a booking made on the site arrived `pending` and
 * waited for somebody in the office to press POTVRDI. That step is gone. What
 * has to be true now is that the guest leaves with a table rather than a
 * request, that nothing about how a table was made impossible to double-book
 * changed on the way, and that the one message this produces is produced once. */
describe("a booking made on the site confirms itself", () => {
  async function bookOne(seatId: string, token = ANA) {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId, token })).ok);
    const made = await requestReservation(booking(seatId), {
      ...freshSource(),
      holdToken: token,
    });
    assert.ok(made.ok, "a held table books");
    return made.reservation;
  }

  it("needs nobody in the office to press anything", async () => {
    const reservation = await bookOne(FREE);

    /* THE ROW ITSELF, read back the way the office reads it — not the answer
       the service handed out. */
    const row = (await reservationsForEvent(NIGHT)).find(
      (line) => line.id === reservation.id,
    );
    assert.ok(row);
    assert.equal(row.status, "confirmed");
    assert.equal(row.updatedBy, undefined, "nobody confirmed it by hand");

    /* And the office's own map says the table is taken, with the booking on
       it, without anything having been approved. */
    const seat = (await floorState(NIGHT)).seats.find((s) => s.id === FREE);
    assert.equal(seat?.state, "reserved");
    assert.equal(seat?.reservation?.status, "confirmed");
  });

  it("writes the confirmed row in one statement, never pending first", async () => {
    const reservation = await bookOne(FREE);

    /* There is no instant at which this row was `pending`: it was inserted
       confirmed. `updated_at` still equalling `created_at` is what a second
       statement would have pulled apart, and a second statement is exactly the
       window this change had to avoid opening. */
    const row = await query<{ status: string; same: boolean }>(
      `SELECT status, (created_at = updated_at) AS same
         FROM reservations WHERE id = $1`,
      [reservation.id],
    );
    assert.equal(row.rows[0].status, "confirmed");
    assert.equal(row.rows[0].same, true, "nothing updated it after the insert");
  });

  it("still refuses the table to a second guest, exactly as before", async () => {
    await bookOne(FREE);

    /* Not even a hold can be taken on it now — it is reserved, not held. */
    const held = await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN });
    assert.equal(held.ok, false);
    assert.equal(held.ok === false && held.reason, "seat-reserved");

    /* And the telephone is refused by the index rather than by a check. */
    const byPhone = await addPhoneReservation(
      {
        eventId: NIGHT,
        seatId: FREE,
        guests: partyFor(FREE),
        name: "Telefon Gost",
        phone: "0699999999",
      },
      "Šef sale",
    );
    assert.equal(byPhone.ok, false);
    assert.equal(byPhone.ok === false && byPhone.reason, "seat-taken");
  });

  it("gives the table to exactly one of two confirmations landing together", async () => {
    /* Two guests, each holding a table of their own, both submitting for the
       same one. The partial unique index decides, inside the insert. */
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: OTHER_FREE, token: BOJAN })).ok);

    const [a, b] = await Promise.all([
      requestReservation(booking(FREE), { ...freshSource(), holdToken: ANA }),
      requestReservation(booking(FREE), { ...freshSource(), holdToken: BOJAN }),
    ]);

    assert.equal([a.ok, b.ok].filter(Boolean).length, 1, "one table, one booking");

    const live = (await reservationsForEvent(NIGHT)).filter(
      (line) => line.seatId === FREE && ["pending", "confirmed"].includes(line.status),
    );
    assert.equal(live.length, 1, "and exactly one row holds it");
  });

  it("confirms nothing once the three minutes have run out", async () => {
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    await age(FREE);

    const refused = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "hold-expired");

    /* NOTHING WAS WRITTEN — not a confirmed row, not a pending one, no row at
       all — and the table is back on the floor for whoever wants it next. */
    assert.equal((await reservationsForEvent(NIGHT)).length, 0);
    assert.equal(
      (await seatAvailability({ eventId: NIGHT })).reserved.includes(FREE),
      false,
    );
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN })).ok);
  });

  it("queues the guest's confirmation exactly once", async () => {
    const reservation = await bookOne(FREE);

    const delivery = await eventually(
      () => mailDeliveryFor("reservation-guest", reservation.id),
      "the guest's confirmation to be claimed",
    );
    assert.equal(delivery.recipient, reservation.email);
    /* The log provider is the development default and a STATE, not a failure —
       so this is `sent` with no provider configured, which is the point: a club
       that has not chosen a mail service still has a working reservation. */
    assert.equal(delivery.status, "sent");
    assert.equal(delivery.attempts, 1);

    /* ASKING AGAIN SENDS NOTHING. The (kind, key) primary key in
       `mail_deliveries` is the guarantee — the same one a second instance, a
       retried request and the office pressing confirm on a legacy row meet. */
    assert.equal(
      await notifyReservationConfirmed(reservation),
      "already-claimed",
      "a second confirmation is not a second mail",
    );
    const after = await mailDeliveryFor("reservation-guest", reservation.id);
    assert.equal(after?.attempts, 1);
  });

  it("makes a retried submit produce neither a second table nor a second mail", async () => {
    const reservation = await bookOne(FREE);
    await eventually(
      () => mailDeliveryFor("reservation-guest", reservation.id),
      "the first confirmation",
    );

    /* The same browser sending the same thing again: a double tap, a flaky
       connection, a reloaded POST. The hold was spent by the first one and
       there is nothing left to spend. */
    const again = await requestReservation(booking(FREE), {
      ...freshSource(),
      holdToken: ANA,
    });
    assert.equal(again.ok, false);

    assert.equal((await reservationsForEvent(NIGHT)).length, 1, "one booking");
    const delivery = await mailDeliveryFor("reservation-guest", reservation.id);
    assert.equal(delivery?.attempts, 1, "one mail");
  });

  it("lets the office cancel it, which puts the table back", async () => {
    const reservation = await bookOne(FREE);

    const cancelled = await setReservationStatus(reservation.id, "cancelled", "Uprava");
    assert.ok(cancelled.ok);

    /* Back on the plan for the office… */
    assert.equal(
      (await floorState(NIGHT)).seats.find((s) => s.id === FREE)?.state,
      "available",
    );
    /* …and back on the floor for guests, who can hold and book it again. */
    assert.equal(
      (await seatAvailability({ eventId: NIGHT })).reserved.includes(FREE),
      false,
    );
    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: BOJAN })).ok);

    /* Nothing was deleted, and who let it go is written on the row. */
    const kept = await reservationStore.find(reservation.id);
    assert.equal(kept?.status, "cancelled");
    assert.equal(kept?.updatedBy, "Uprava");
    assert.equal(kept?.name, reservation.name);
  });

  it("lets the office correct what the guest typed", async () => {
    const reservation = await bookOne(FREE);

    const edited = await editReservation(
      reservation.id,
      { name: "Marko Marinković", phone: "0641234567", note: "Rođendan" },
      "Uprava",
    );
    assert.ok(edited.ok);
    assert.equal(edited.reservation.name, "Marko Marinković");
    assert.equal(edited.reservation.note, "Rođendan");
    assert.equal(edited.reservation.updatedBy, "Uprava");

    /* CORRECTING IS NOT RE-BOOKING. The table, the night and the status are
       untouched, so a booking never lets go of the floor while it is edited. */
    assert.equal(edited.reservation.seatId, FREE);
    assert.equal(edited.reservation.status, "confirmed");
    assert.ok((await seatAvailability({ eventId: NIGHT })).reserved.includes(FREE));
  });

  it("still refuses a guest a second table, and still lets staff give one", async () => {
    /* The duplicate rule was never about the approval step and is unchanged:
       one table per telephone and per email on the site, and staff trusted to
       know that the same number is ringing about the cousins. */
    const who = guest();

    assert.ok((await acquireHold({ eventId: NIGHT, seatId: FREE, token: ANA })).ok);
    const first = await requestReservation(
      { eventId: NIGHT, seatId: FREE, guests: partyFor(FREE), ...who },
      { ...freshSource(), holdToken: ANA },
    );
    assert.ok(first.ok);
    assert.equal(first.reservation.status, "confirmed");

    assert.ok((await acquireHold({ eventId: NIGHT, seatId: OTHER_FREE, token: ANA })).ok);
    const second = await requestReservation(
      { eventId: NIGHT, seatId: OTHER_FREE, guests: partyFor(OTHER_FREE), ...who },
      { ...freshSource(), holdToken: ANA },
    );
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "duplicate");

    /* And the three minutes she spent on the refusal are handed back. */
    assert.ok(await getHoldStatus({ eventId: NIGHT, seatId: OTHER_FREE, token: ANA }));
  });
});
