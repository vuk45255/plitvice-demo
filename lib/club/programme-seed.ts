/* PLITVICE'S REAL NIGHTS, AS ROWS WAITING TO BE ROWS.
 *
 * ═══ THIS FILE IS DATA. IT IS NOT LOGIC AND IT IS NOT A SOURCE OF TRUTH ═══
 *
 * It is the seed. On a database that has never seen a given night, the entry
 * below is inserted once; from then on the `events` table is what everything
 * reads and /admin/dogadjaji is what changes it. A night that is already a row
 * IS LEFT ALONE — a title the club fixed at eleven on a Friday must not be put
 * back by the next deploy, and that rule is the whole reason this file cannot
 * be the source of truth for anything.
 *
 * ═══ WHAT THIS REPLACED ═══════════════════════════════════════════════════
 *
 * Until now the club's programme existed TWICE: once as `events` in
 * lib/events.ts — a hand-written array with the poster wall's copy in it — and
 * once as four rows in lib/club/programme-seed.ts. The wall decided whether a
 * night sold tickets and took tables; the table decided what a ticket cost and
 * how many there were; and the two agreed only because somebody remembered to
 * edit both. Editing a night in the office changed the second and not the
 * first, which is exactly the bug this whole change exists to remove.
 *
 * Now there is one row per night, and everything — the artwork, the prose, the
 * two switches, the price, the capacity — is on it.
 *
 * ═══ THE YEARS ON THE PAST NIGHTS ════════════════════════════════════════
 *
 * The wall wrote its dates as "15. avgust" with no year, and hung the archive
 * in a hand-chosen order. A row needs a real instant, so the years here are the
 * ones that REPRODUCE THAT ORDER EXACTLY under `starts_at DESC`: the three
 * nights at the top of the wall are this season, and everything from Rasta down
 * is last. Nothing else about them is invented — the day, the month, the name
 * and the artwork are the club's own and are copied across unchanged.
 *
 * ═══ AND NOTHING HERE IS GUESSED ══════════════════════════════════════════
 *
 * A price, a capacity or a door time the club has not given us is not written
 * down as a number somebody made up. A past night sells nothing and takes no
 * tables, so it has no price and no floor; Saturday Madness has no ticket price
 * because entry is free at the door, and `ticketingEnabled: false` is what says
 * so rather than a zero anybody could misread as "free online". */

export type ProgrammeNight = {
  id: string;
  slug: string;
  title: string;
  /* The club's own clock, written out, so the offset is visible rather than
     implied by whatever machine ran the migration. */
  startsAt: string;
  doorsAt?: string;
  /* A path under public/. lib/club/poster-assets.ts turns it back into the
     bundled artwork so the blur-up survives. */
  image: string;
  description?: string;
  status: "draft" | "on_sale" | "sold_out" | "ended";
  ticketingEnabled: boolean;
  tablesEnabled: boolean;
  ticketPrice: number;
  capacity: number;
  maxPerOrder: number;
  lineup?: string;
  ageRestriction?: string;
  entryNote?: string;
  dressCode?: string;
  promotion?: string;
  /* ═══ POSTER, OR NIGHT THIS SYSTEM RAN ═══════════════════════════════════
   *
   * True for a night that existed ONLY as artwork on the public wall before
   * this software did — see `past()` below. It is not a lesser event and it is
   * not hidden from anybody: it is a photograph of a night, and the difference
   * that matters is that THERE IS NOTHING TO REPORT ON IT. No order was ever
   * taken through this system, no ticket was ever minted, nobody was ever
   * scanned in. A dashboard that lists it beside Saturday Madness with 0 / 500
   * sold and 0 scanned is not reporting a quiet night — it is inventing a
   * measurement of a night nobody measured.
   *
   * So the office works with the operational programme and the public wall
   * keeps the record. See `isOperational` in lib/club/event-manager.ts. */
  legacy?: boolean;
};

/* A finished night that only ever existed as a poster: it sells nothing, takes
   no tables, and keeps its artwork. Capacity is the room's, because that is
   what the room holds whatever else is true; the price is zero because there is
   no sale to price — and `legacy` is what stops the office reading either of
   those zeros as a measurement. */
const past = (
  id: string,
  slug: string,
  title: string,
  startsAt: string,
  image: string,
): ProgrammeNight => ({
  id,
  slug,
  title,
  startsAt,
  image,
  status: "ended",
  ticketingEnabled: false,
  tablesEnabled: false,
  ticketPrice: 0,
  capacity: 500,
  maxPerOrder: 10,
  legacy: true,
});

/* The nights this file files as poster-only, by id — what the schema uses to
   classify a database that was seeded before the flag existed. Derived from the
   list below rather than written out again, so the two can never drift. */
export function legacyArchiveIds(): string[] {
  return PROGRAMME.filter((night) => night.legacy).map((night) => night.id);
}

export const PROGRAMME: ProgrammeNight[] = [
  {
    id: "evt_saturday_madness",
    slug: "saturday-madness",
    title: "Saturday Madness",
    startsAt: "2026-08-29T22:00:00+02:00",
    doorsAt: "2026-08-29T22:00:00+02:00",
    image: "/dogadjaji/madness.jpg",
    description:
      "Saturday Madness. Subota, 29. avgust — DJ Wolf svira celu noć. Ulaz besplatan. " +
      "16+ uz ličnu kartu ili pasoš. 1 na 1 do pola 1: uz svaku flašu druga na račun kuće, " +
      "važi za sve flaše naručene do 00:30.",
    /* ANNOUNCED, WITH NO ONLINE SALE. `on_sale` is the club's decision that the
       night is public; `ticketingEnabled: false` is the separate fact that
       nothing is sold through the site — entry is free and taken at the door.
       Those are two different questions and a zero price answers neither. */
    status: "on_sale",
    ticketingEnabled: false,
    tablesEnabled: true,
    ticketPrice: 0,
    capacity: 500,
    maxPerOrder: 10,
    lineup: "DJ Wolf",
    ageRestriction: "16+",
    entryNote: "Ulaz besplatan.",
    promotion: "1 na 1 do pola 1",
  },
  {
    id: "evt_vodka_experience",
    slug: "vodka-experience",
    title: "Vodka Experience",
    startsAt: "2026-08-22T22:00:00+02:00",
    doorsAt: "2026-08-22T22:00:00+02:00",
    image: "/dogadjaji/vodka.jpg",
    /* A REAL NIGHT THAT HAPPENED, not a fixture. It has its own artwork in the
       repository, its own written copy, a named guest and the house's own table
       rules — none of which a test fixture has. It is filed `ended` because the
       evening has passed, which is what the wall already said about it. */
    description:
      "Vodka Experience by Plitvice. Music by Dave Pavlo, posebna atmosfera i boca vodke " +
      "gratis za ekipe koje stignu do ponoći. Minimalno 4 gosta za barski sto, 4–5 za visoki " +
      "sto i 6 za separe. Ulaz 16+ uz lični dokument.",
    status: "ended",
    ticketingEnabled: false,
    tablesEnabled: false,
    ticketPrice: 500,
    capacity: 400,
    maxPerOrder: 10,
    lineup: "Dave Pavlo",
    ageRestriction: "16+",
  },

  /* ── the record ─────────────────────────────────────────────────────────
     The order of this list is the order the wall hangs them in, and the
     instants below reproduce it under `starts_at DESC`. */
  past("evt_dara_bubamara", "dara-bubamara", "Dara Bubamara", "2026-08-15T22:00:00+02:00", "/party/dara.jpg"),
  past("evt_rasta", "rasta", "Rasta", "2025-10-25T22:00:00+02:00", "/party/rasta.jpg"),
  past("evt_katarina_zivkovic", "katarina-zivkovic", "Katarina Živković", "2025-07-18T22:00:00+02:00", "/dogadjaji/kaca.jpg"),
  past("evt_white_party_semafor", "white-party-semafor", "White Party & Semafor", "2025-07-11T22:00:00+02:00", "/party/semafor.jpg"),
  past("evt_teodora", "teodora", "Teodora", "2025-07-04T22:00:00+02:00", "/party/teodora.jpg"),
  past("evt_sajfer", "sajfer", "Sajfer", "2025-06-27T22:00:00+02:00", "/images/sajfer.jpg"),
  past("evt_thcf", "thcf", "THCF", "2025-05-30T22:00:00+02:00", "/party/thcf.jpg"),
  past("evt_relja", "relja", "Relja", "2025-05-16T22:00:00+02:00", "/party/relja.jpg"),
  past("evt_inas", "inas", "Inas", "2025-05-09T22:00:00+02:00", "/party/inas.jpg"),
  past("evt_my_lucky_number", "my-lucky-number", "My Lucky Numb3r", "2025-04-18T22:00:00+02:00", "/party/53.jpg"),
];
