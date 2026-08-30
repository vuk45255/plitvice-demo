import type { LocalText } from "@/lib/i18n";
import type { Poster } from "@/lib/club/poster-assets";

/* WHAT A NIGHT LOOKS LIKE TO THE PUBLIC SITE — the shape, and the handful of
 * rules that are arithmetic over it. NOT the nights themselves.
 *
 * ═══ THIS FILE USED TO BE THE PROGRAMME. IT IS NOT ANY MORE ═══════════════
 *
 * It held a hand-written array of every night the club had put on, with the
 * copy for each one as a key into lib/i18n.ts and its artwork as an import.
 * That array is gone, and this is why:
 *
 * THE CLUB'S PROGRAMME EXISTED TWICE. It was here, where the wall read whether
 * a night sold tickets and took tables; and it was in the `events` table, where
 * the ticketing system read what a ticket cost and how many there were. The two
 * agreed only for as long as somebody remembered to edit both. An owner who
 * changed a night in /admin/dogadjaji changed the second and not the first, and
 * the public site went on saying what this file said — which made the office
 * screen a decoration.
 *
 * There is now ONE ROW PER NIGHT. lib/club/programme.ts reads the table and
 * produces the `PartyEvent` values below; every page fetches them on the server
 * and hands them to its components as props. Nothing that renders a night
 * changed shape, and the shape now comes from the place the club can edit.
 *
 * ═══ WHAT IS STILL HERE, AND WHY IT BELONGS HERE ══════════════════════════
 *
 * The TYPE, because it is the contract between the data layer and every
 * component that draws a night. And the four PURE FUNCTIONS at the bottom —
 * what a night's ticket line should say, what the cheapest way in costs, where
 * a reservation link points — because they are decisions about a night that
 * must come out the same on the wall, in the archive and in the reservation
 * room. A component that decided any of them for itself would eventually
 * disagree with the one next to it.
 *
 * NOTHING IN THIS FILE READS A DATABASE and nothing in it is async, which is
 * what lets a client component keep importing it. */

/* A named kind of ticket — a package, an early bird, whatever the club adds on
   top of plain entry. A night with none of these sells one thing: entry at
   `ticketPrice`. Prices are whole dinars and are formatted for the reader's
   language at the point of display, never written out here. */
export type TicketType = {
  id: string;
  name: LocalText | string;
  note?: LocalText | string;
  price: number;
  /* Left undefined while the club counts the door itself. */
  remaining?: number;
};

export type Ticketing = {
  /* Whether this night sells tickets through the site at all. Set from the
     `ticketing_enabled` column and from nothing else — never inferred from a
     price, because "nobody has set a price" and "this night is not sold here"
     are two different facts about a night. */
  enabled: boolean;
  /* Whether the night is being sold, which is the club's decision:
       "soon"     — announced, the ticket line is not shown yet
       "open"     — on sale; the purchase panel is live
       "closed"   — sale has ended, or the night has passed
       "soldout"  — the panel shows, the button does not */
  sale: "soon" | "open" | "closed" | "soldout";
  types: TicketType[];
  /* Most a single order may hold. A house rule, not a guess about stock. */
  maxPerOrder: number;
};

/* Whether this night takes tables at all.
 *
 * The room itself is not described here. The club has one floor and it is the
 * same floor every night, so it is drawn once in lib/floor-plan.ts rather than
 * hung off each event; which of its tables are still free on a given night is
 * lib/floor-availability.ts, keyed by the slug. A night that takes no tables
 * simply has no table line, and neither file is consulted. */
export type TableBooking = {
  enabled: boolean;
};

export type PartyEvent = {
  /* The slug is the public identifier: /rezervacija?event=vodka-experience */
  slug: string;
  /* A performer's name is a name — never translated, never restyled. */
  artist: string;
  /* Written out in both languages from the night's instant. */
  date: LocalText;
  /* A few lines about the night — who is playing, what the house is doing,
     what a table takes. Set under the poster in the reservation room, and only
     when the club has written one; a night without one shows nothing there.
     THE CLUB'S OWN WORDS, typed into the office, so it is text rather than a
     dictionary key: there is no translator between the owner and the guest. */
  description?: string;
  /* When the doors open, on a 24-hour clock — "22:00". The same in every
     language, so it is a plain string. */
  startTime?: string;
  /* Entry, in whole dinars. Formatted for the reader at the point of display.
     Undefined means there is no online price to quote, and no price appears
     anywhere for the night. */
  ticketPrice?: number;
  /* Nights are at the house unless the club takes one somewhere else. */
  location?: string;
  /* The colour this night's artwork throws into the room around it — the light
     the poster is spilling onto the dark, not a brand colour and not a theme.
     Sampled off the artwork itself, and therefore filed with the artwork in
     lib/club/poster-assets.ts. Undefined means the poster stands in the house's
     own light and no glow is drawn behind it. */
  ambient?: string;
  /* Either a picture that came with the build — carrying its dimensions and the
     blur placeholder the bundler computed — or the URL of one somebody uploaded
     from the office. Undefined for a night with no artwork at all. */
  poster?: Poster;
  status: "upcoming" | "past";
  tickets: Ticketing;
  tables: TableBooking;

  /* ═══ THE REST OF WHAT THE ROW KNOWS ══════════════════════════════════
   *
   * Carried through so that no surface has to reach past the programme layer
   * to find out what a night is. All optional, and the current design shows
   * them only where the club has written them into the description — which is
   * where this club writes them. Giving any of them a line of its own is a
   * change to the design, not to the data, and is not made here. */
  lineup?: string;
  ageRestriction?: string;
  entryNote?: string;
  dressCode?: string;
  promotion?: string;

  /* ═══ A POSTER FROM BEFORE THE SOFTWARE ════════════════════════════════
   *
   * True for a night that only ever existed as artwork on this wall. It
   * changes NOTHING about how the night is drawn — the archive is a record
   * and a poster from 2025 is as much a part of it as last Saturday. It is
   * read once, by `toProgramme`, to decide WHICH nights get the archive's
   * limited slots when there are more nights than places to hang them: the
   * ones this club actually ran go up first. See the note there. */
  legacy: boolean;
};

/* ── the rules, which are pure and stay pure ────────────────────────────── */

export function isBookable(event: PartyEvent) {
  return event.status === "upcoming" && (event.tickets.enabled || event.tables.enabled);
}

export function ticketTypes(event: PartyEvent): TicketType[] {
  if (event.tickets.types.length > 0) return event.tickets.types;
  if (event.ticketPrice === undefined) return [];
  return [{ id: "entry", name: "tickets.entry", price: event.ticketPrice }];
}

/* The cheapest way in, for the lines that quote a price before the guest has
   chosen anything. Undefined when the night has no price yet. */
export function entryPrice(event: PartyEvent): number | undefined {
  const types = ticketTypes(event);
  if (types.length === 0) return undefined;
  let lowest = types[0].price;
  for (const type of types) if (type.price < lowest) lowest = type.price;
  return lowest;
}

/* What the reservation room does with a night's ticket line.
 *
 *   "open"         — the purchase panel is live
 *   "unavailable"  — the club is not selling this night online; the line is
 *                    shown, dimmed and inert, so the guest sees that tickets
 *                    exist and that this night is not one of them
 *   "none"         — there is no ticket line to draw at all
 *
 * Turning a night's online sale on or off is `tickets.enabled`, which comes
 * from the `ticketing_enabled` column and nothing else — no surface decides
 * this by looking at a name, and none of them decides it by looking at a
 * price. */
export type TicketAvailability = "open" | "unavailable" | "none";

export function ticketAvailability(event: PartyEvent): TicketAvailability {
  /* A night that has passed says nothing about tickets either way. */
  if (event.status !== "upcoming") return "none";
  if (!event.tickets.enabled) return "unavailable";
  /* Announced but not on sale yet, or priced by nobody — both are silence
     rather than a refusal, so the line stays off. */
  if (event.tickets.sale === "soon" || event.tickets.sale === "closed") return "none";
  return entryPrice(event) === undefined ? "none" : "open";
}

/* ── where a night is bought ────────────────────────────────────────────── */

/* The two things a guest can be here for. The room reads this out of the URL,
   so every entry point on the site is a plain link and every state of the room
   is somewhere that can be shared. */
export type ReserveChoice = "karte" | "stolovi";

export const RESERVE_PATH = "/rezervacija";

export function reserveHref(slug?: string, choice?: ReserveChoice) {
  const params = new URLSearchParams();
  if (slug) params.set("event", slug);
  if (choice) params.set("izbor", choice);
  const query = params.toString();
  return query ? `${RESERVE_PATH}?${query}` : RESERVE_PATH;
}
