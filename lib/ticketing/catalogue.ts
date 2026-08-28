/* The nights the club has told us about, as rows waiting to be rows.
 *
 * WHY THIS FILE STILL EXISTS NOW THAT THERE IS A DATABASE. It is the seed, not
 * the source of truth. On the first start against an empty database each entry
 * below is inserted once; from then on the `events` table is what everything
 * reads, and /admin is what changes it. An entry that is already in the table
 * is LEFT ALONE — a capacity the club raised at eleven at night must not be
 * silently put back by the next deploy.
 *
 * Adding a night here and deploying is therefore how a night gets into the
 * system the first time; editing one here after that does nothing, and the
 * admin screen is where it belongs.
 *
 * NOTHING IS INVENTED. A price, a capacity or a door time the club has not
 * given us is not written down as a guess: the night goes in as `draft`, which
 * means the system knows about it and is not selling it, and somebody sets the
 * real numbers in /admin before it opens.
 *
 * No imports, by design — this is read by the migration, which runs before
 * anything else in the system is loaded. */

export type SeedEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  doorsAt?: string;
  description?: string;
  image?: string;
  status: "draft" | "on_sale" | "sold_out" | "ended";
  ticketPrice: number;
  capacity: number;
  maxPerOrder: number;
  salesStart?: string;
  salesEnd?: string;
  testOnly?: boolean;
};

export const SEED_EVENTS: SeedEvent[] = [
  {
    id: "evt_saturday_madness",
    slug: "saturday-madness",
    title: "Saturday Madness",
    /* 29 August, doors at ten, Inđija time. */
    startsAt: "2026-08-29T22:00:00+02:00",
    doorsAt: "2026-08-29T22:00:00+02:00",
    image: "/dogadjaji/madness.jpg",
    /* DRAFT, and it must stay draft until somebody sets a price. Entry is free
       at the door today — see `tickets: ticketsOffline` on the same night in
       lib/events.ts — so there is nothing to sell online yet. The capacity is
       the room's; the price is zero because the club has not given us one, and
       `saleState` refuses a draft night whatever its price says. */
    status: "draft",
    ticketPrice: 0,
    capacity: 500,
    maxPerOrder: 10,
  },
  {
    id: "evt_vodka_experience",
    slug: "vodka-experience",
    title: "Vodka Experience",
    startsAt: "2026-08-22T22:00:00+02:00",
    doorsAt: "2026-08-22T22:00:00+02:00",
    image: "/dogadjaji/vodka.jpg",
    status: "draft",
    ticketPrice: 500,
    capacity: 400,
    maxPerOrder: 10,
  },
  {
    id: "evt_test_night",
    slug: "test-night",
    title: "Plitvice Test Night",
    startsAt: "2099-12-31T23:00:00+01:00",
    description:
      "Probna večer koja postoji samo da bi se sistem ulaznica mogao testirati.",
    image: "/dogadjaji/vodka.jpg",
    status: "on_sale",
    ticketPrice: 1000,
    capacity: 50,
    maxPerOrder: 10,
    /* Filtered out of every list and refused by every lookup unless dev mode
       is open, so a test night cannot be sold to anybody by accident. */
    testOnly: true,
  },
  {
    id: "evt_test_night_small",
    slug: "test-night-small",
    title: "Plitvice Test Night — mala sala",
    startsAt: "2099-12-30T23:00:00+01:00",
    description:
      "Druga probna večer, namerno mala, za proveru rasprodaje i istovremenih kupovina.",
    image: "/dogadjaji/vodka.jpg",
    status: "on_sale",
    ticketPrice: 1500,
    /* Deliberately tiny: this is the night the load test sells out, and a
       room of five hundred would take an hour to prove the same thing. */
    capacity: 20,
    maxPerOrder: 4,
    testOnly: true,
  },
];
