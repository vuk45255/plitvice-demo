/* THE EVENT MANAGER, UNDER TEST.
 *
 * Four things are worth a test here, and they are the four that would be
 * expensive to get wrong:
 *
 *   · a night can be made, published and changed — the whole point of the
 *     screen, exercised through the same functions the form calls;
 *   · A DUPLICATE CARRIES CONFIGURATION AND NOT ONE ROW OF HISTORY. This is
 *     the one somebody will break later by "improving" the copy, and the
 *     failure mode is a brand-new night that appears to have sold tickets;
 *   · an event with a history cannot be deleted, ever, and archiving keeps
 *     every one of those rows;
 *   · an upload is judged by its BYTES. A .jpg full of script is refused, and
 *     nothing a client sends is ever part of a storage key.
 *
 * Run with `npm test`. Node's own test runner and a real Postgres in memory —
 * see scripts/test-setup.mjs. NOTHING IS MOCKED, including the media store:
 * the local provider writes real files to a real directory and they are
 * cleaned up afterwards, because a mocked store would be testing the mock. */

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { rm } from "node:fs/promises";
import path from "node:path";

import { closeDatabase, query } from "@/lib/db/client";
import {
  archiveEvent,
  createEvent,
  deleteEvent,
  duplicateEvent,
  eventFootprint,
  findTicketingEvent,
  restoreEvent,
  updateEvent,
  saleState,
} from "@/lib/ticketing/events";
import { confirmPayment, createOrder } from "@/lib/ticketing/orders";
import { countsFor } from "@/lib/ticketing/store";
import { reservationStore } from "@/lib/reservations/store";
import {
  actionsFor,
  eventGroupOf,
  eventTiers,
  groupEvents,
  slugify,
  toCard,
} from "@/lib/club/event-manager";
import { NIGHT_LENGTH_HOURS, hasEnded } from "@/lib/ticketing/event-rules";
import { tableBookingGate } from "@/lib/reservations/gate";
import { MAX_POSTER_BYTES, posterKey, storePoster } from "@/lib/media/images";
import { mediaReadiness } from "@/lib/media/provider";
import { staffFromCookie } from "@/lib/staff/guard";
import { openStaffSession } from "@/lib/staff/session";

const ORIGIN = "https://plitviceclub.test";

/* NODE_ENV is typed as a read-only literal union by Next's own ambient types,
   and `Object.defineProperty` on `process.env` is refused outright by Node 22+
   ("only accepts a configurable, writable, and enumerable data descriptor").
   A plain assignment through a widened alias is the one thing that both the
   compiler and the runtime accept. */
const env = process.env as Record<string, string | undefined>;

/* A night far enough ahead that no test is racing a real clock. */
const soon = (days = 30) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

let no = 0;
const freshSlug = (stem = "test-night") => `${stem}-${(no += 1)}-${Date.now() % 100000}`;

async function aNight(overrides: Record<string, unknown> = {}) {
  const result = await createEvent({
    title: "Saturday Madness",
    slug: freshSlug(),
    startsAt: soon(),
    capacity: 300,
    ticketPrice: 1200,
    maxPerOrder: 10,
    ...overrides,
  });
  assert.ok(result.ok, "the night should be created");
  return result.event;
}

beforeEach(async () => {
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
  await query(`DELETE FROM reservations`);
  await query(`DELETE FROM seat_holds`);
  await query(`DELETE FROM staff_sessions`);
});

after(async () => {
  await closeDatabase();
});

/* ═══ 1 — MAKING A NIGHT ═════════════════════════════════════════════════ */

describe("making a night", () => {
  it("arrives as a draft that sells nothing", async () => {
    const event = await aNight();

    /* THE DEFAULT THAT MATTERS. A night that went on sale the instant somebody
       typed a name — no poster, no price checked, no door time — is how a club
       sells tickets to the wrong evening. */
    assert.equal(event.status, "draft");
    assert.equal(eventGroupOf(event), "draft");

    const counts = await countsFor(event.id);
    assert.equal(toCard(event, counts).sale.open, false);
  });

  it("carries the whole configuration the form can set", async () => {
    const event = await aNight({
      ticketingEnabled: true,
      tablesEnabled: true,
      floorPlan: "default",
      lineup: "DJ Wolf",
      ageRestriction: "18+",
      entryNote: "Ulaz besplatan",
      dressCode: "Elegantno",
      promotion: "1 na 1 do pola 1",
    });

    /* Read BACK OUT OF THE DATABASE rather than trusting what was returned —
       a column that is written and not read is a column that silently is not
       there. */
    const stored = await findTicketingEvent(event.id, true);
    assert.ok(stored);
    assert.equal(stored.lineup, "DJ Wolf");
    assert.equal(stored.ageRestriction, "18+");
    assert.equal(stored.promotion, "1 na 1 do pola 1");
    assert.equal(stored.tablesEnabled, true);
    assert.equal(stored.ticketingEnabled, true);
    assert.equal(stored.floorPlan, "default");
    assert.equal(stored.venueId, "plitvice");
  });

  it("defaults an old row to exactly what the system did before these columns", async () => {
    /* A row written before the event manager existed: none of the new columns
       set by the caller. It must read back as a working night. */
    const event = await aNight();
    assert.equal(event.tablesEnabled, false, "no tables unless somebody says so");
    assert.equal(event.ticketingEnabled, true, "selling was what a night did");
    assert.equal(event.archivedAt, undefined);
    assert.equal(event.posterKey, undefined);
  });

  it("is published, and edited, without either becoming the other", async () => {
    const event = await aNight();

    const published = await updateEvent(event.id, { status: "on_sale" });
    assert.ok(published.ok);
    assert.equal(published.event.status, "on_sale");
    assert.equal(eventGroupOf(published.event), "active");

    /* An ordinary edit passes no status at all, so it cannot demote a night
       that is on sale — which is what the form's "save" intent does. */
    const edited = await updateEvent(event.id, { lineup: "DJ Mrak" });
    assert.ok(edited.ok);
    assert.equal(edited.event.lineup, "DJ Mrak");
    assert.equal(edited.event.status, "on_sale", "saving is not un-publishing");
  });

  it("closes the sale when online ticketing is switched off, and not only the button", async () => {
    /* THE SWITCH IS A GATE, NOT A DECORATION. `createOrder` asks `saleState`
       before it queues for the capacity lock, so a night with a door price and
       no online sale refuses a checkout posted straight at the endpoint — the
       office screen hiding the button is the second line of defence, not the
       first. */
    const night = await aNight({ status: "on_sale", ticketingEnabled: false });
    const shut = saleState(night, 0);
    assert.equal(shut.open, false);
    assert.equal(shut.open === false && shut.reason, "no_sale");

    const refused = await createOrder({
      eventSlug: night.slug,
      quantity: 1,
      buyer: { name: "Gost", email: "gost@example.com", phone: "069 11 22 33" },
    });
    assert.equal(refused.ok, false, "the checkout itself is refused");

    /* And switching it back on reopens it, with nothing else changed. */
    const reopened = await updateEvent(night.id, { ticketingEnabled: true });
    assert.ok(reopened.ok);
    assert.equal(saleState(reopened.event, 0).open, true);
  });

  it("still refuses a capacity below what is already sold", async () => {
    /* The rule that was here before the event manager and is untouched by it.
       Asserted from this file too, because the editor is now the thing that
       posts a capacity. */
    const event = await aNight({ status: "on_sale", capacity: 10 });
    const order = await createOrder({
      eventSlug: event.slug,
      quantity: 4,
      buyer: { name: "Marko Marković", email: "kupac@example.com", phone: "069 11 22 33" },
    });
    assert.ok(order.ok);
    assert.ok((await confirmPayment(order.order.id, { provider: "test" }, ORIGIN)).ok);

    const refused = await updateEvent(event.id, { capacity: 2 });
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "capacity_below_sold");
  });
});

/* ═══ 2 — SLUGS AND GROUPING ═════════════════════════════════════════════ */

describe("what a night is called and where it is filed", () => {
  it("folds Serbian Latin instead of throwing it away", () => {
    assert.equal(slugify("Žurka Šećer"), "zurka-secer");
    assert.equal(slugify("Đorđe & Ćira"), "djordje-cira");
    assert.equal(slugify("  Saturday   Madness!  "), "saturday-madness");
  });

  it("keeps a draft a draft even after its date has gone", async () => {
    const event = await aNight({ startsAt: new Date(Date.now() - 86_400_000).toISOString() });
    /* It was never put on, so filing it with the nights that happened would be
       a lie about the club's own history. */
    assert.equal(eventGroupOf(event), "draft");
  });

  /* ═══ THE NIGHT ITSELF ═══════════════════════════════════════════════════
   *
   * THE BUG THESE EXIST TO KEEP OUT. On the Saturday, at 22:00, the moment the
   * doors opened: the office filed Saturday Madness under ZAVRŠENI while its
   * card still read "U prodaji" and still offered PAUZIRAJ PRODAJU, the sale
   * gate said "prodaja zatvorena", the public wall archived the poster, and
   * the reservation gate refused every table with "past". The club was open.
   *
   * Fifty-seven tests in this suite went red on the clock rather than on a
   * commit, because every reservation case books `saturday-madness`. */
  const hoursFromNow = (hours: number) =>
    new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  it("keeps a night that has started ACTIVE while the club is still open", async () => {
    /* An hour in: the doors are open, the room is filling. */
    const tonight = await aNight({ startsAt: hoursFromNow(-1), status: "on_sale" });
    assert.equal(eventGroupOf(tonight), "active");
    assert.equal(hasEnded(tonight), false);
  });

  it("files it as FINISHED once the night is actually over", async () => {
    const over = await aNight({
      startsAt: hoursFromNow(-(NIGHT_LENGTH_HOURS + 1)),
      status: "on_sale",
    });
    assert.equal(eventGroupOf(over), "finished");
    assert.equal(hasEnded(over), true);
  });

  it("goes on selling entry during the night, and stops when it ends", async () => {
    /* A guest walking up at half past midnight is a guest the club wants. */
    const tonight = await aNight({ startsAt: hoursFromNow(-1), status: "on_sale" });
    assert.equal(saleState(tonight, 0).open, true);

    const over = await aNight({
      startsAt: hoursFromNow(-(NIGHT_LENGTH_HOURS + 1)),
      status: "on_sale",
    });
    const shut = saleState(over, 0);
    assert.equal(shut.open, false);
    assert.equal(shut.open === false && shut.reason, "too_late");
  });

  it("gives the same answer to the office, the sale and the floor", async () => {
    /* ONE RULE, NOT FOUR AGREEING BY COINCIDENCE. A night cannot be over for
       the guest and still running for the doorman. */
    const tonight = await aNight({
      startsAt: hoursFromNow(-1),
      status: "on_sale",
      tablesEnabled: true,
    });
    assert.equal(eventGroupOf(tonight), "active");
    assert.equal(saleState(tonight, 0).open, true);
    assert.equal((await tableBookingGate(tonight.slug)).open, true);

    const over = await aNight({
      startsAt: hoursFromNow(-(NIGHT_LENGTH_HOURS + 1)),
      status: "on_sale",
      tablesEnabled: true,
    });
    assert.equal(eventGroupOf(over), "finished");
    assert.equal(saleState(over, 0).open, false);
    const gate = await tableBookingGate(over.slug);
    assert.equal(gate.open, false);
    assert.equal(gate.open === false && gate.reason, "past");
  });

  it("stops offering to pause the sale of a night that is over", async () => {
    const counts = { capacity: 0, paid: 0, available: 0, taken: 0 };
    const over = await aNight({
      startsAt: hoursFromNow(-(NIGHT_LENGTH_HOURS + 1)),
      status: "on_sale",
    });
    const { primary, more } = actionsFor(toCard(over, counts));

    assert.ok(!primary.includes("pause"), "a finished night cannot have its sale paused");
    assert.ok(!primary.includes("publish"), "a finished night is not published");
    /* What the office actually does the next afternoon. */
    assert.ok(more.includes("close"));
    assert.ok(more.includes("archive"));

    /* And the night that is running keeps both. */
    const tonight = await aNight({ startsAt: hoursFromNow(-1), status: "on_sale" });
    assert.ok(actionsFor(toCard(tonight, counts)).primary.includes("pause"));
  });

  it("sorts the nights ahead soonest first and the past most recent first", async () => {
    const near = await aNight({ startsAt: soon(3), status: "on_sale" });
    const far = await aNight({ startsAt: soon(40), status: "on_sale" });
    const counts = { capacity: 0, paid: 0, available: 0, taken: 0 };

    const grouped = groupEvents([
      toCard(far, counts),
      toCard(near, counts),
    ]);
    assert.deepEqual(
      grouped.active.map((card) => card.event.id),
      [near.id, far.id],
    );
  });

  it("offers only the moves that make sense from where a night is", async () => {
    const draft = await aNight();
    const onSale = await aNight({ status: "on_sale" });
    const counts = { capacity: 0, paid: 0, available: 0, taken: 0 };

    const forDraft = actionsFor(toCard(draft, counts));
    assert.ok(forDraft.primary.includes("publish"));
    assert.ok(forDraft.more.includes("delete"), "an untouched draft may be deleted");

    const forSale = actionsFor(toCard(onSale, counts));
    assert.ok(forSale.primary.includes("pause"));
    assert.ok(!forSale.primary.includes("publish"), "it is already published");
    assert.ok(!forSale.more.includes("delete"), "a live night is never offered a delete");
  });

  it("answers with a list of ticket types even though there is one", async () => {
    /* THE SEAM. Screens read a list, so adding VIP and Early Bird later does
       not mean rewriting them. */
    const selling = await aNight({ ticketingEnabled: true, ticketPrice: 1500, capacity: 200 });
    const tiers = eventTiers(selling);
    assert.equal(tiers.length, 1);
    assert.equal(tiers[0].price, 1500);
    assert.equal(tiers[0].capacity, 200);
    assert.equal(tiers[0].derived, true);

    const free = await aNight({ ticketingEnabled: false });
    assert.deepEqual(eventTiers(free), [], "a free door sells no ticket types");
  });
});

/* ═══ 3 — DUPLICATING, WHICH IS THE DANGEROUS ONE ════════════════════════ */

describe("duplicating a night", () => {
  it("copies the configuration and gives it a new identity", async () => {
    const source = await aNight({
      status: "on_sale",
      ticketingEnabled: true,
      tablesEnabled: true,
      lineup: "DJ Wolf",
      ageRestriction: "18+",
      dressCode: "Elegantno",
      promotion: "Flaša na flašu",
      salesEnd: soon(29),
      capacity: 250,
      ticketPrice: 1400,
    });

    const copy = await duplicateEvent(source.id);
    assert.ok(copy.ok);
    const made = copy.event;

    /* A NEW IDENTITY. */
    assert.notEqual(made.id, source.id);
    assert.notEqual(made.slug, source.slug);

    /* THE CONFIGURATION CAME WITH IT — this is what saves staff the typing. */
    assert.equal(made.capacity, 250);
    assert.equal(made.ticketPrice, 1400);
    assert.equal(made.maxPerOrder, source.maxPerOrder);
    assert.equal(made.tablesEnabled, true);
    assert.equal(made.ticketingEnabled, true);
    assert.equal(made.floorPlan, source.floorPlan);
    assert.equal(made.lineup, "DJ Wolf");
    assert.equal(made.ageRestriction, "18+");
    assert.equal(made.dressCode, "Elegantno");
    assert.equal(made.promotion, "Flaša na flašu");

    /* AND THE THREE THINGS THAT MUST NOT. */
    assert.equal(made.status, "draft", "a copy is never on sale");
    assert.equal(made.salesEnd, undefined, "last week's sales window is not this week's");
    assert.equal(made.posterKey, undefined, "the copy points at the image and owns nothing");
  });

  it("carries no orders, no tickets, no reservations — none at all", async () => {
    /* THE TEST THIS FILE EXISTS FOR. The source is given a real history: a paid
       order with real admissions, and a table booked against its slug. */
    const source = await aNight({ status: "on_sale", capacity: 50, ticketPrice: 1000 });

    const order = await createOrder({
      eventSlug: source.slug,
      quantity: 3,
      buyer: { name: "Marko Marković", email: "kupac@example.com", phone: "069 11 22 33" },
    });
    assert.ok(order.ok);
    assert.ok((await confirmPayment(order.order.id, { provider: "test" }, ORIGIN)).ok);

    await reservationStore.claim({
      eventId: source.slug,
      seatId: "S12",
      seatType: "booth",
      zone: 1,
      guests: 4,
      name: "Gost",
      phone: "0601234567",
      email: "gost@example.com",
      note: "",
      phoneKey: "381601234567",
      emailKey: "gost@example.com",
      source: "phone",
    });

    const before = await eventFootprint(source.id);
    assert.ok(before?.hasHistory, "the source really does have a history");

    const copy = await duplicateEvent(source.id);
    assert.ok(copy.ok);

    /* NOT ONE ROW FOLLOWED IT. */
    const after = await eventFootprint(copy.event.id);
    assert.deepEqual(after, { orders: 0, tickets: 0, reservations: 0, hasHistory: false });

    const counts = await countsFor(copy.event.id);
    assert.equal(counts.paid, 0);
    assert.equal(counts.taken, 0);
    assert.equal(counts.entered, 0);

    /* And the original still has everything it had. */
    assert.deepEqual(await eventFootprint(source.id), before);
  });

  it("can be run twice without colliding", async () => {
    const source = await aNight();
    const first = await duplicateEvent(source.id);
    const second = await duplicateEvent(source.id);
    assert.ok(first.ok);
    assert.ok(second.ok);
    assert.notEqual(first.event.slug, second.event.slug);
  });

  it("moves the door time onto the new date rather than copying the instant", async () => {
    const startsAt = soon(10);
    const doorsAt = new Date(Date.parse(startsAt) - 60 * 60 * 1000).toISOString();
    const source = await aNight({ startsAt, doorsAt });

    const copy = await duplicateEvent(source.id);
    assert.ok(copy.ok);
    assert.ok(copy.event.doorsAt);

    const gap = Date.parse(copy.event.startsAt) - Date.parse(copy.event.doorsAt);
    assert.equal(gap, 60 * 60 * 1000, "doors still open an hour before");
    assert.notEqual(copy.event.doorsAt, doorsAt, "and not on the old date");
  });
});

/* ═══ 4 — ARCHIVING, AND THE REFUSAL TO DELETE ═══════════════════════════ */

describe("putting a night away", () => {
  it("archives without touching a single order or table", async () => {
    const event = await aNight({ status: "on_sale", capacity: 50, ticketPrice: 1000 });
    const order = await createOrder({
      eventSlug: event.slug,
      quantity: 2,
      buyer: { name: "Ana Anić", email: "ana@example.com", phone: "069 22 33 44" },
    });
    assert.ok(order.ok);
    assert.ok((await confirmPayment(order.order.id, { provider: "test" }, ORIGIN)).ok);

    const before = await eventFootprint(event.id);
    const archived = await archiveEvent(event.id);
    assert.ok(archived.ok);

    assert.ok(archived.event.archivedAt, "it is stamped");
    /* The status goes with it, so the night stops being sellable through the
       one function every seller already asks rather than through a second
       rule somebody could forget. */
    assert.equal(archived.event.status, "ended");
    assert.equal(eventGroupOf(archived.event), "archived");

    assert.deepEqual(await eventFootprint(event.id), before, "nothing was lost");

    /* And the guest's tickets are still there to be read. */
    const counts = await countsFor(event.id);
    assert.equal(counts.paid, 2);
  });

  it("comes back as a draft rather than straight back on sale", async () => {
    const event = await aNight({ status: "on_sale" });
    assert.ok((await archiveEvent(event.id)).ok);

    const restored = await restoreEvent(event.id);
    assert.ok(restored.ok);
    assert.equal(restored.event.archivedAt, undefined);
    assert.equal(restored.event.status, "draft", "somebody has to look at it first");
  });

  it("refuses to delete a night that has any history at all", async () => {
    const event = await aNight({ status: "on_sale", capacity: 50, ticketPrice: 1000 });
    const order = await createOrder({
      eventSlug: event.slug,
      quantity: 1,
      buyer: { name: "Ana Anić", email: "ana2@example.com", phone: "069 22 33 45" },
    });
    assert.ok(order.ok);

    const refused = await deleteEvent(event.id);
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "has_history");
    assert.ok(
      refused.ok === false && refused.reason === "has_history" && refused.footprint.orders > 0,
      "and it says how much history, so the office is told what to do instead",
    );

    /* Still there. */
    assert.ok(await findTicketingEvent(event.id, true));
  });

  it("refuses over a reservation alone, which is keyed by slug and not by id", async () => {
    const event = await aNight();
    await reservationStore.claim({
      eventId: event.slug,
      seatId: "S13",
      seatType: "booth",
      zone: 1,
      guests: 2,
      name: "Gost",
      phone: "0607654321",
      email: "gost2@example.com",
      note: "",
      phoneKey: "381607654321",
      emailKey: "gost2@example.com",
      source: "phone",
    });

    const refused = await deleteEvent(event.id);
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "has_history");
  });

  it("deletes a draft nothing has ever pointed at", async () => {
    const event = await aNight();
    assert.deepEqual(await deleteEvent(event.id), { ok: true });
    assert.equal(await findTicketingEvent(event.id, true), undefined);
  });
});

/* ═══ 5 — WHAT MAY BE UPLOADED ═══════════════════════════════════════════ */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

const file = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes as BlobPart], name, { type });

describe("the poster", () => {
  const KEPT = process.env.MEDIA_STORE;

  before(() => {
    /* The development store, which writes real files. Not a mock: what is
       under test is the whole path from a File to a URL. */
    process.env.MEDIA_STORE = "local";
  });

  after(async () => {
    if (KEPT === undefined) delete process.env.MEDIA_STORE;
    else process.env.MEDIA_STORE = KEPT;
    await rm(path.join(process.cwd(), ".data", "media"), { recursive: true, force: true });
  });

  it("stores an image and hands back a URL", async () => {
    const result = await storePoster(file(JPEG, "poster.jpg", "image/jpeg"), "evt_abc");
    assert.ok(result.ok, "a real JPEG is stored");
    assert.match(result.media.key, /^events\/evt_abc\/poster-[0-9a-f]{32}\.jpg$/);
    assert.equal(result.media.url, `/api/media/${result.media.key}`);
  });

  it("judges the BYTES, not the name and not the header", async () => {
    /* A script with a .jpg name and an image content type: everything a client
       controls says image, and the first bytes say otherwise. */
    const script = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    const refused = await storePoster(file(script, "poster.jpg", "image/jpeg"), "evt_abc");

    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "unsupported");
  });

  it("refuses an SVG however it is labelled", async () => {
    /* Deliberately not on the allowlist: it is a document that can carry
       script, and a poster is never worth that. */
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    const refused = await storePoster(file(svg, "poster.svg", "image/svg+xml"), "evt_abc");
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "unsupported");
  });

  it("refuses something too large before reading it", async () => {
    const big = new Uint8Array(MAX_POSTER_BYTES + 1);
    big.set(PNG);
    const refused = await storePoster(file(big, "poster.png", "image/png"), "evt_abc");
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "too-large");
  });

  it("refuses an empty file", async () => {
    const refused = await storePoster(
      file(new Uint8Array(), "poster.jpg", "image/jpeg"),
      "evt_abc",
    );
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.reason, "empty");
  });

  it("never lets a client filename reach the key", () => {
    /* Nothing is sanitised, because nothing the client sent is used: the key is
       built from the OWNER and randomness, and the extension comes from the
       sniffed format. */
    const key = posterKey("../../../etc/passwd", "jpg");
    assert.ok(!key.includes(".."), "no traversal survives");
    assert.equal(key.split("/").length, 3, "and the key is exactly the shape we generate");
    assert.match(key, /^events\/etcpasswd\/poster-[0-9a-f]{32}\.jpg$/);
  });

  it("is refused entirely, with a reason, when no store is configured", async () => {
    delete process.env.MEDIA_STORE;
    try {
      const state = mediaReadiness();
      assert.equal(state.ready, false);

      const refused = await storePoster(file(JPEG, "poster.jpg", "image/jpeg"), "evt_abc");
      assert.equal(refused.ok, false);
      assert.equal(refused.ok === false && refused.reason, "no-store");

      /* ═══ AND THE CLUB IS NOT SHOWN THE PLUMBING ══════════════════════
       *
       * Two sentences, for two different people. The one that reaches a screen
       * is for whoever is running the club at one in the morning: it says what
       * they can do instead, and it contains the name of no environment
       * variable, storage product or provider — none of which they have, can
       * change, or should be made to feel responsible for. */
      const shown = refused.ok === false ? refused.message : "";
      for (const leak of ["MEDIA_STORE", "S3", "blob", "Blob", "Vercel", "provider"]) {
        assert.ok(!shown.includes(leak), `the screen must not say ${leak}: ${shown}`);
      }
      assert.match(shown, /nije dostupno/, "it says plainly that uploading is off");

      /* The operator's sentence is the other half, and it DOES name the
         variable — it goes to the server log and to .env.example. */
      assert.match(state.ready === false ? state.detail : "", /MEDIA_STORE/);
    } finally {
      process.env.MEDIA_STORE = "local";
    }
  });

  it("refuses the development store in production rather than half-working", () => {
    const kept = process.env.NODE_ENV;
    try {
      /* A serverless disk is not shared between instances and does not survive
         one being recycled. A poster written there appears for some visitors,
         for a while — worse than none, because it looks like it worked. */
      env.NODE_ENV = "production";
      const state = mediaReadiness();
      assert.equal(state.ready, false);
      /* The operator is told exactly what is wrong; the screen still gets the
         same plain sentence it gets for every other cause. */
      assert.ok(!state.ready && state.detail.includes("production"));
      assert.ok(!state.ready && !state.reason.includes("MEDIA_STORE"));
    } finally {
      if (kept === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = kept;
    }
  });
});

/* ═══ 6 — WHO MAY DO ANY OF IT ═══════════════════════════════════════════ */

describe("who may change a night", () => {
  const KEPT = {
    admin: process.env.STAFF_ADMIN_PASSWORD,
    scanner: process.env.STAFF_SCANNER_PASSWORD,
  };

  before(() => {
    /* The rest of the suite runs with the gate in its development "open"
       state, which is exactly wrong here. */
    process.env.STAFF_ADMIN_PASSWORD = "office-password";
    process.env.STAFF_SCANNER_PASSWORD = "door-password";
  });

  afterEach(async () => {
    await query(`DELETE FROM staff_sessions`);
  });

  after(() => {
    if (KEPT.admin === undefined) delete process.env.STAFF_ADMIN_PASSWORD;
    else process.env.STAFF_ADMIN_PASSWORD = KEPT.admin;
    if (KEPT.scanner === undefined) delete process.env.STAFF_SCANNER_PASSWORD;
    else process.env.STAFF_SCANNER_PASSWORD = KEPT.scanner;
  });

  it("gives a doorman no admin rights at all", async () => {
    /* `staffFromCookie(value, role)` IS the rule every event action applies —
       `staffFor` is one line that reads the jar and calls it. A scanner has a
       real, valid session and is still refused, which is the difference
       between "not signed in" and "not allowed". */
    const door = await openStaffSession({
      id: "scanner",
      name: "Ulaz — ulaz",
      role: "scanner",
      door: "ulaz",
    });

    assert.ok(await staffFromCookie(door, "scanner"), "the door is a real session");
    assert.equal(
      await staffFromCookie(door, "admin"),
      undefined,
      "and it is not an admin one",
    );
  });

  it("gives a stranger nothing", async () => {
    assert.equal(await staffFromCookie(undefined, "admin"), undefined);
    assert.equal(await staffFromCookie("not-a-session", "admin"), undefined);
  });

  it("lets the office in", async () => {
    const office = await openStaffSession({ id: "admin", name: "Uprava", role: "admin" });
    const staff = await staffFromCookie(office, "admin");
    assert.ok(staff);
    assert.equal(staff.role, "admin");
  });
});
