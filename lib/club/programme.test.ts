/* THE OFFICE AND THE PUBLIC SITE, LOOKING AT THE SAME ROW.
 *
 * This suite exists because of one class of bug, and it is the one that was
 * actually shipped: the club's programme lived in TWO places — a hand-written
 * array the site read, and the `events` table the ticketing system read — and
 * an owner editing a night in /admin changed the second while the public site
 * went on saying the first. The office screen was a decoration and nobody could
 * tell by looking at it.
 *
 * So every test below does the same thing in a different key: CHANGE SOMETHING
 * THE WAY THE OFFICE CHANGES IT, then ask what a guest would be shown, and
 * require that the answer moved. If any one of these ever passes trivially,
 * something has grown a second copy of a night again.
 *
 * And three of them are about the opposite: what a guest may DO. A switch that
 * only hides a button is not a rule — `/api/reservations` is a public endpoint
 * anybody can post to — so `ticketingEnabled` and `tablesEnabled` are tested
 * through the server functions that decide, not through the screen.
 *
 * Run with `npm test`. Real Postgres in memory, nothing mocked. */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { closeDatabase, query } from "@/lib/db/client";
import {
  archiveEvent,
  createEvent,
  findTicketingEvent,
  updateEvent,
} from "@/lib/ticketing/events";
import { createOrder } from "@/lib/ticketing/orders";
import { toProgramme } from "@/lib/club/programme";
import { allTicketingEvents } from "@/lib/ticketing/events";
import { tableBookingGate, bookableNights } from "@/lib/reservations/gate";
import { reservationStore } from "@/lib/reservations/store";
import { classifyEvent, partitionEvents } from "@/lib/club/test-data";
import { PROGRAMME } from "@/lib/club/programme-seed";

/* The venue's real programme is what the seed put in the table. `saturday-madness`
   is named here exactly once, in a test, because the test is about that night;
   nothing in lib/ names it. */
const MADNESS = "saturday-madness";

/* What a guest would be shown, right now, asked the way a page asks it. */
async function publicProgramme() {
  return toProgramme(await allTicketingEvents());
}

const shown = async (slug: string) =>
  (await publicProgramme()).events.find((event) => event.slug === slug);

beforeEach(async () => {
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
  await query(`DELETE FROM seat_holds`);
  await query(`DELETE FROM reservations`);

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

/* ═══ 1 — WHAT A GUEST MAY BE SHOWN ══════════════════════════════════════ */

describe("what reaches the public site", () => {
  it("never shows a draft, whatever its date says", async () => {
    const made = await createEvent({
      title: "Neobjavljeno veče",
      slug: "neobjavljeno-vece",
      startsAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
      capacity: 300,
      ticketPrice: 1000,
      tablesEnabled: true,
    });
    assert.ok(made.ok);
    assert.equal(made.event.status, "draft", "a new night arrives as a draft");

    assert.equal(await shown("neobjavljeno-vece"), undefined, "not on the wall");

    /* And it is not merely hidden — the booking gate refuses it too, so a
       hand-typed ?event= for a draft cannot take a table either. */
    const gate = await tableBookingGate("neobjavljeno-vece");
    assert.equal(gate.open, false);
    assert.equal(gate.open === false && gate.reason, "not-public");

    /* Publishing it is the only thing that changes, and it changes everything. */
    assert.ok((await updateEvent(made.event.id, { status: "on_sale" })).ok);
    assert.ok(await shown("neobjavljeno-vece"), "published, and now it is there");
    assert.equal((await tableBookingGate("neobjavljeno-vece")).open, true);

    /* This suite reads the club's real programme, so the invented night goes
       away again rather than turning up in the next test's selector. */
    await query(`DELETE FROM events WHERE id = $1`, [made.event.id]);
  });

  it("shows the published night, with the values on its row", async () => {
    const event = await shown(MADNESS);
    assert.ok(event, "the club's current night is on the wall");
    assert.equal(event.status, "upcoming");
    assert.equal(event.artist, "Saturday Madness");
    assert.equal(event.date.sr, "29. avgust");
    assert.equal(event.date.en, "29 August");
    assert.equal(event.startTime, "22:00");

    /* THE TWO SWITCHES, AS THE CLUB SET THEM. Free entry at the door and a
       floor that takes tables. */
    assert.equal(event.tickets.enabled, false, "no online ticket sale");
    assert.equal(event.tables.enabled, true, "tables are open");
    assert.equal(event.ticketPrice, undefined, "and no price is quoted anywhere");

    /* The rest of what the club wrote about the night. */
    assert.equal(event.lineup, "DJ Wolf");
    assert.equal(event.ageRestriction, "16+");
    assert.equal(event.entryNote, "Ulaz besplatan.");
    assert.equal(event.promotion, "1 na 1 do pola 1");
    assert.match(event.description ?? "", /DJ Wolf svira celu noć/);
  });

  it("never shows a fixture night or an archived one", async () => {
    /* The two probe nights exist in this run because dev mode is open. They
       are `test_only`, and that is enough to keep them off the wall. */
    const rows = await allTicketingEvents();
    const fixtures = rows.filter((event) => event.testOnly);
    assert.ok(fixtures.length > 0, "this run does have fixtures to exclude");

    const wall = await publicProgramme();
    for (const fixture of fixtures) {
      assert.equal(
        wall.events.find((event) => event.slug === fixture.slug),
        undefined,
        `${fixture.slug} must never reach a guest`,
      );
    }

    /* And archiving takes a real night off the wall without touching its row. */
    const before = await shown("vodka-experience");
    assert.ok(before, "it was on the wall");
    const archived = await archiveEvent("evt_vodka_experience");
    assert.ok(archived.ok);
    assert.equal(await shown("vodka-experience"), undefined, "and now it is not");

    /* Put it back so the rest of the suite sees the club's real programme. */
    await updateEvent("evt_vodka_experience", { status: "ended" });
    await query(`UPDATE events SET archived_at = NULL WHERE id = 'evt_vodka_experience'`);
  });

  it("hangs the record in the order the wall hung it", async () => {
    /* The archive used to be a hand-ordered array. It is now `starts_at DESC`,
       and lib/club/programme-seed.ts chose the years so that the two produce
       the same wall. If somebody re-dates a past night this test says so. */
    const { past } = await publicProgramme();
    assert.deepEqual(
      past.map((event) => event.slug),
      [
        "vodka-experience",
        "dara-bubamara",
        "rasta",
        "katarina-zivkovic",
        "white-party-semafor",
        "teodora",
        "sajfer",
        "thcf",
        "relja",
        "inas",
        "my-lucky-number",
      ],
    );
  });
});

/* ═══ 2 — AN EDIT IN THE OFFICE IS AN EDIT ON THE SITE ═══════════════════ */

describe("what the office changes, the guest reads", () => {
  /* Every test here calls `updateEvent`, which is the ONE function the save
     button in /admin/dogadjaji ends up in — see saveEvent in
     app/(operations)/admin/dogadjaji/actions.ts. Nothing is simulated. */

  const id = "evt_saturday_madness";
  const restore = async (patch: Parameters<typeof updateEvent>[1]) => {
    assert.ok((await updateEvent(id, patch)).ok);
  };

  it("changes the name on the poster wall", async () => {
    assert.ok((await updateEvent(id, { title: "Saturday Chaos" })).ok);
    assert.equal((await shown(MADNESS))?.artist, "Saturday Chaos");
    await restore({ title: "Saturday Madness" });
    assert.equal((await shown(MADNESS))?.artist, "Saturday Madness");
  });

  it("changes the description under the poster", async () => {
    assert.ok((await updateEvent(id, { description: "Nova priča o večeri." })).ok);
    assert.equal((await shown(MADNESS))?.description, "Nova priča o večeri.");
  });

  it("changes the DJ and the promotion", async () => {
    /* The office's own example: DJ Wolf becomes DJ TEST, and back. */
    assert.ok((await updateEvent(id, { lineup: "DJ TEST", promotion: "2 na 1" })).ok);
    const edited = await shown(MADNESS);
    assert.equal(edited?.lineup, "DJ TEST");
    assert.equal(edited?.promotion, "2 na 1");

    await restore({ lineup: "DJ Wolf", promotion: "1 na 1 do pola 1" });
    assert.equal((await shown(MADNESS))?.lineup, "DJ Wolf");
  });

  it("changes the age rule and the note about the door", async () => {
    assert.ok(
      (await updateEvent(id, { ageRestriction: "18+", entryNote: "Ulaz 500 din." })).ok,
    );
    const edited = await shown(MADNESS);
    assert.equal(edited?.ageRestriction, "18+");
    assert.equal(edited?.entryNote, "Ulaz 500 din.");
    await restore({ ageRestriction: "16+", entryNote: "Ulaz besplatan." });
  });

  it("changes the date and the time the wall prints", async () => {
    /* Both are FORMATTED FROM THE INSTANT rather than looked up, which is the
       only reason a date can be edited at all — a dictionary key could not be. */
    assert.ok((await updateEvent(id, { startsAt: "2026-09-05T23:30:00+02:00" })).ok);
    const moved = await shown(MADNESS);
    assert.equal(moved?.date.sr, "5. septembar");
    assert.equal(moved?.date.en, "5 September");

    /* The doors are their own field, and the wall prints those. */
    assert.ok((await updateEvent(id, { doorsAt: "2026-09-05T21:00:00+02:00" })).ok);
    assert.equal((await shown(MADNESS))?.startTime, "21:00");

    await restore({
      startsAt: "2026-08-29T22:00:00+02:00",
      doorsAt: "2026-08-29T22:00:00+02:00",
    });
    assert.equal((await shown(MADNESS))?.date.sr, "29. avgust");
  });

  it("changes the poster, and keeps the blur on artwork that shipped", async () => {
    const before = await shown(MADNESS);
    assert.ok(
      typeof before?.poster !== "string",
      "a picture from the build resolves to the bundled asset, so it can blur up",
    );

    /* An uploaded poster is a URL and simply renders without a placeholder —
       the one thing that would throw is passing placeholder="blur" to it, and
       components/events/poster-image.tsx is what stops that happening. */
    assert.ok((await updateEvent(id, { image: "https://cdn.example.test/p.jpg" })).ok);
    assert.equal((await shown(MADNESS))?.poster, "https://cdn.example.test/p.jpg");
    assert.equal((await shown(MADNESS))?.ambient, undefined);

    await restore({ image: "/dogadjaji/madness.jpg" });
    assert.equal((await shown(MADNESS))?.ambient, "#c9c7c6");
  });

  it("has no second copy of a night anywhere to disagree with", async () => {
    /* THE WHOLE POINT, STATED AS A TEST. Every night a guest can be shown is a
       row, and every field the wall prints came off that row — so there is
       nothing left that could hold a stale title. */
    const rows = await allTicketingEvents();
    const wall = await publicProgramme();

    for (const event of wall.events) {
      const row = rows.find((r) => r.slug === event.slug);
      assert.ok(row, `${event.slug} is on the wall and must be a row`);
      assert.equal(event.artist, row.title);
      assert.equal(event.description, row.description);
      assert.equal(event.tickets.enabled, row.ticketingEnabled && event.status !== "past");
      assert.equal(event.tables.enabled, row.tablesEnabled && event.status !== "past");
    }
  });
});

/* ═══ 3 — THE SELECTOR IS THE TABLE ══════════════════════════════════════ */

describe("za koju žurku", () => {
  it("offers exactly the published nights that are still ahead", async () => {
    const { upcoming } = await publicProgramme();
    assert.deepEqual(upcoming.map((event) => event.slug), [MADNESS]);
    assert.equal(upcoming[0].date.sr, "29. avgust");
  });

  it("grows when the office publishes another night, with nothing else touched", async () => {
    /* LATER THAN THE CLUB'S OWN NIGHT, DERIVED FROM IT rather than typed out.
       What this case says is "a night published after the existing one appears
       after it", and a literal October date only said that by luck: it stopped
       being true the moment the seeded night was moved past it, and it would
       have stopped being true anyway on 1 November — when October is in the
       past and drops out of `upcoming` altogether. */
    const seeded = (
      await query(`SELECT starts_at FROM events WHERE slug = $1`, [MADNESS])
    ).rows[0];
    const laterThanMadness = new Date(
      new Date(seeded.starts_at as string | Date).getTime() + 63 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const made = await createEvent({
      title: "Halloween",
      slug: "halloween",
      startsAt: laterThanMadness,
      capacity: 400,
      ticketPrice: 0,
      status: "on_sale",
      ticketingEnabled: false,
      tablesEnabled: true,
      image: "/dogadjaji/madness.jpg",
    });
    assert.ok(made.ok);

    const { upcoming } = await publicProgramme();
    assert.deepEqual(
      upcoming.map((event) => event.slug),
      [MADNESS, "halloween"],
      "soonest first, and the new night simply appears",
    );

    /* And the office's own list of bookable nights is the same list. */
    const nights = await bookableNights();
    assert.deepEqual(nights.map((n) => n.slug), [MADNESS, "halloween"]);

    await query(`DELETE FROM events WHERE id = $1`, [made.event.id]);
  });
});

/* ═══ 4 — THE TWO SWITCHES ARE RULES, NOT DECORATIONS ════════════════════ */

describe("online ticket sales", () => {
  it("refuses a checkout for a night the club does not sell online", async () => {
    /* Saturday Madness is free at the door. Posting straight at the checkout —
       past whatever a browser was shown — must be refused by the server. */
    const refused = await createOrder({
      eventSlug: MADNESS,
      quantity: 1,
      buyer: { name: "Gost", email: "gost@example.com", phone: "069 11 22 33" },
    });
    assert.equal(refused.ok, false, "the order is refused, not merely hidden");
  });

  it("is not inferred from the price — a zero is not a switch", async () => {
    /* THE BUG THIS PREVENTS: reading "price is 0" as "not sold online". They
       are different facts. A night whose price nobody has set yet is not a
       free-entry night, and a paid night with the switch off is still off. */
    const id = "evt_saturday_madness";
    assert.ok((await updateEvent(id, { ticketingEnabled: true, ticketPrice: 1500 })).ok);

    const open = await shown(MADNESS);
    assert.equal(open?.tickets.enabled, true);
    assert.equal(open?.tickets.sale, "open");
    assert.equal(open?.ticketPrice, 1500, "now there is a price to quote");

    const sold = await createOrder({
      eventSlug: MADNESS,
      quantity: 1,
      buyer: { name: "Gost", email: "gost@example.com", phone: "069 11 22 33" },
    });
    assert.equal(sold.ok, true, "and the checkout opens");

    /* Switch it off while the price stays. Still refused. */
    assert.ok((await updateEvent(id, { ticketingEnabled: false })).ok);
    const shut = await createOrder({
      eventSlug: MADNESS,
      quantity: 1,
      buyer: { name: "Gost", email: "gost@example.com", phone: "069 11 22 33" },
    });
    assert.equal(shut.ok, false, "the switch decides, not the price");
    assert.equal((await shown(MADNESS))?.ticketPrice, undefined);

    await updateEvent(id, { ticketPrice: 0 });
  });
});

describe("table reservations", () => {
  const id = "evt_saturday_madness";

  const aGuest = (seatId: string) => ({
    eventId: MADNESS,
    seatId,
    seatType: "booth" as const,
    zone: 1 as const,
    guests: 4,
    name: "Gost",
    phone: "0601234567",
    email: "gost@example.com",
    note: "",
    phoneKey: "381601234567",
    emailKey: "gost@example.com",
    source: "phone" as const,
  });

  it("is open while the switch is on", async () => {
    const gate = await tableBookingGate(MADNESS);
    assert.equal(gate.open, true);
    assert.equal(gate.open === true && gate.event.slug, MADNESS);
    assert.equal((await shown(MADNESS))?.tables.enabled, true);
  });

  it("refuses a NEW hold and a NEW booking the moment it is switched off", async () => {
    const { acquireHold } = await import("@/lib/reservations/holds");
    const { requestReservation } = await import("@/lib/reservations/service");

    /* On: a hold is taken. */
    const taken = await acquireHold({ eventId: MADNESS, seatId: "S12", token: "tok-a" });
    assert.equal(taken.ok, true, "a table can be held while the night is open");

    assert.ok((await updateEvent(id, { tablesEnabled: false })).ok);

    /* Off: the gate refuses, and it refuses in the BUSINESS layer — these are
       the functions /api/reservations/holds and /api/reservations call, not a
       component that could simply be bypassed. */
    const gate = await tableBookingGate(MADNESS);
    assert.equal(gate.open, false);
    assert.equal(gate.open === false && gate.reason, "tables-closed");

    const held = await acquireHold({ eventId: MADNESS, seatId: "S14", token: "tok-b" });
    assert.equal(held.ok, false);

    const booked = await requestReservation(
      {
        eventId: MADNESS,
        seatId: "S14",
        guests: 4,
        name: "Gost",
        phone: "0601234567",
        email: "gost@example.com",
      },
      { source: "programme-test-closed" },
    );
    assert.equal(booked.ok, false);
    assert.equal(booked.ok === false && booked.reason, "unavailable");

    /* And the wall stops offering it. */
    assert.equal((await shown(MADNESS))?.tables.enabled, false);

    await updateEvent(id, { tablesEnabled: true });
  });

  it("does not cancel or hide one single table that was already promised", async () => {
    /* THE RULE THAT MATTERS MOST HERE. Switching a night off closes the door;
       it does not empty the room. A guest holding a table keeps it, the office
       keeps its list, and the floor keeps showing it as taken. */
    const claimed = await reservationStore.claim(aGuest("S12"));
    assert.ok(claimed.ok);

    assert.ok((await updateEvent(id, { tablesEnabled: false })).ok);

    const still = await query(
      `SELECT id, status FROM reservations WHERE event_id = $1`,
      [MADNESS],
    );
    assert.equal(still.rowCount, 1, "the reservation is exactly where it was");
    assert.equal(still.rows[0].status, "confirmed", "and it is still confirmed");

    /* The office can still read it. */
    const { reservationsForEvent } = await import("@/lib/reservations/admin");
    const listed = await reservationsForEvent(MADNESS);
    assert.equal(listed.length, 1);

    await updateEvent(id, { tablesEnabled: true });
  });

  it("refuses a night that has already happened, switch or no switch", async () => {
    const gate = await tableBookingGate("vodka-experience");
    assert.equal(gate.open, false);
    assert.ok(gate.open === false && (gate.reason === "past" || gate.reason === "tables-closed"));
  });

  it("refuses a fixture night outright, so a test night never takes a real table", async () => {
    const gate = await tableBookingGate("test-night");
    assert.equal(gate.open, false);
    assert.equal(gate.open === false && gate.reason, "unknown");
  });
});

/* ═══ 5 — THE CLEANUP CANNOT EAT THE CLUB ════════════════════════════════ */

describe("classifying a fixture", () => {
  const protectedSlugs = new Set(PROGRAMME.map((night) => night.slug));

  it("cannot classify the club's own night, whatever else is true of it", async () => {
    /* The one test that has to hold for ever. Saturday Madness is protected
       BEFORE any evidence is read — so even a row wearing every marker at once
       is refused, which is the belt on top of the braces. */
    const real = await findTicketingEvent(MADNESS, true);
    assert.ok(real);
    assert.equal(classifyEvent({ ...real, testOnly: false }, protectedSlugs).test, false);

    const wearingEveryMarker = {
      id: real.id,
      slug: real.slug,
      title: "Stress oversell 123",
      testOnly: true,
    };
    assert.equal(
      classifyEvent(wearingEveryMarker, protectedSlugs).test,
      false,
      "the programme is protected before a single rule is consulted",
    );
  });

  it("protects every night the club has actually put on", async () => {
    const rows = await allTicketingEvents();
    const { fixtures, keep } = partitionEvents(
      rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, testOnly: r.testOnly })),
      protectedSlugs,
    );

    for (const night of PROGRAMME) {
      assert.ok(
        keep.some((k) => k.slug === night.slug),
        `${night.slug} must never be classified as a fixture`,
      );
    }
    /* And it does find the ones that are. */
    assert.deepEqual(
      fixtures.map((f) => f.event.slug).sort(),
      ["test-night", "test-night-small"],
    );
    for (const found of fixtures) {
      assert.ok(found.because.length > 0, "and it says why, every time");
    }
  });

  it("never classifies a night on age, status, price or emptiness", async () => {
    /* Every one of these describes most real club nights. Not one of them is a
       marker, and this is the test that stops somebody adding one. */
    const notMarkers = [
      { id: "e1", slug: "stara-zurka", title: "Stara žurka", testOnly: false },
      { id: "e2", slug: "nedovrseno", title: "Nedovršeno veče", testOnly: false },
      { id: "e3", slug: "besplatan-ulaz", title: "Besplatan ulaz", testOnly: false },
      { id: "e4", slug: "niko-nije-dosao", title: "Niko nije došao", testOnly: false },
      /* A real night whose name merely contains the word. */
      { id: "e5", slug: "test-drive-party", title: "Test Drive Party", testOnly: false },
    ];
    for (const row of notMarkers) {
      assert.equal(
        classifyEvent(row, protectedSlugs).test,
        false,
        `${row.slug} is not a fixture`,
      );
    }
  });

  it("does classify what a harness deliberately wrote", async () => {
    const markers = [
      { id: "s1", slug: "stress-oversell-1770000000000", title: "Stress oversell 177", testOnly: false },
      { id: "s2", slug: "stress-payment-1770000000000", title: "Neko drugo ime", testOnly: false },
      { id: "s3", slug: "neki-slug", title: "Stress door 177", testOnly: false },
      { id: "s4", slug: "scanner-test-night", title: "Scanner probe", testOnly: false },
      { id: "s5", slug: "bilo-sta", title: "Bilo šta", testOnly: true },
    ];
    for (const row of markers) {
      const verdict = classifyEvent(row, protectedSlugs);
      assert.equal(verdict.test, true, `${row.slug} is a fixture`);
      assert.ok(verdict.test && verdict.because.length > 0);
    }
  });
});

process.on("beforeExit", () => void closeDatabase());
