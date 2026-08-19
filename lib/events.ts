import type { StaticImageData } from "next/image";
import type { MessageKey } from "@/lib/i18n";

import posterDara from "@/public/party/dara.jpg";
import posterTeodora from "@/public/party/teodora.jpg";
import posterThcf from "@/public/party/thcf.jpg";
import posterRelja from "@/public/party/relja.jpg";
import posterRasta from "@/public/party/rasta.jpg";
import posterInas from "@/public/party/inas.jpg";
import posterSemafor from "@/public/party/semafor.jpg";
import posterNumber from "@/public/party/53.jpg";
import posterSajfer from "@/public/images/sajfer.jpg";
import posterKaca from "@/public/dogadjaji/kaca.jpg";
import posterVodka from "@/public/dogadjaji/vodka.jpg";

/* Every night the club has put on, and everything the site needs to sell one.
 *
 * This is the only place a night is described. The poster wall, the archive at
 * /zurke and the reservation room at /rezervacija all read from here, so adding
 * a night is one entry in `events` and nothing else: it appears on the wall, it
 * gets its ticket call and its table call, and it is reachable at
 * /rezervacija?event=<slug>.
 *
 * NOTHING IS INVENTED HERE. Prices, doors, capacity and table maps are the
 * club's to give us; every one of them is optional and every one of them is
 * absent until it is real. The UI is written to read what is here and say
 * nothing about what is not. */

/* A named kind of ticket — a package, an early bird, whatever the club adds on
   top of plain entry. A night with none of these sells one thing: entry at
   `ticketPrice`. Prices are whole dinars and are formatted for the reader's
   language at the point of display, never written out here. */
export type TicketType = {
  id: string;
  name: MessageKey;
  note?: MessageKey;
  price: number;
  /* Left undefined while the club counts the door itself. */
  remaining?: number;
};

export type Ticketing = {
  /* Whether this night sells tickets through the site at all. */
  enabled: boolean;
  /* Whether the night is being sold, which is the club's decision and has
     nothing to do with whether a payment provider is wired — that lives in
     lib/checkout.ts.
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
 * lib/floor-availability.ts, keyed by the slug above. A night that takes no
 * tables simply has no table line, and neither file is consulted. */
export type TableBooking = {
  enabled: boolean;
};

export type PartyEvent = {
  /* The slug is the public identifier: /rezervacija?event=vodka-experience */
  slug: string;
  /* A performer's name is a name — never translated, never restyled. */
  artist: string;
  date: MessageKey;
  /* A few lines about the night — who is playing, what the house is doing,
     what a table takes. Set under the poster in the reservation room, and only
     when the club has written one; a night without one shows nothing there. */
  description?: MessageKey;
  /* When the doors open, on a 24-hour clock — "22:00". The same in every
     language, so it is a plain string rather than a dictionary key. Undefined
     until the club confirms it, and then simply not shown. */
  startTime?: string;
  /* Entry, in whole dinars. Formatted for the reader at the point of display —
     never written out as text here. Undefined means the price is not settled,
     and no price appears anywhere for the night. */
  ticketPrice?: number;
  /* Nights are at the house unless the club takes one somewhere else. */
  location?: string;
  poster: StaticImageData;
  status: "upcoming" | "past";
  tickets: Ticketing;
  tables: TableBooking;
};

/* A night on sale: entry at `ticketPrice`, ten to an order. Give a night named
   types here — packages, early birds — and the panel offers those instead. */
const ticketsOnSale: Ticketing = {
  enabled: true,
  sale: "open",
  types: [],
  maxPerOrder: 10,
};

/* A night that has happened sells nothing. */
const nothingOnSale: Ticketing = {
  enabled: false,
  sale: "closed",
  types: [],
  maxPerOrder: 0,
};

const tablesOpen: TableBooking = { enabled: true };
const tablesClosed: TableBooking = { enabled: false };

/* Newest first. The night ahead sits at the top of every list it appears in. */
export const events: PartyEvent[] = [
  {
    slug: "vodka-experience",
    artist: "Vodka Experience",
    date: "date.aug22",
    description: "event.about.vodkaExperience",
    startTime: "22:00",
    ticketPrice: 500,
    poster: posterVodka,
    status: "upcoming",
    tickets: ticketsOnSale,
    tables: tablesOpen,
  },
  {
    slug: "dara-bubamara",
    artist: "Dara Bubamara",
    date: "date.aug15",
    poster: posterDara,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "rasta",
    artist: "Rasta",
    date: "date.oct25",
    poster: posterRasta,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "katarina-zivkovic",
    artist: "Katarina Živković",
    date: "date.jul18",
    poster: posterKaca,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "white-party-semafor",
    artist: "White Party & Semafor",
    date: "date.jul11",
    poster: posterSemafor,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "teodora",
    artist: "Teodora",
    date: "date.jul04",
    poster: posterTeodora,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "sajfer",
    artist: "Sajfer",
    date: "date.jun27",
    poster: posterSajfer,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "thcf",
    artist: "THCF",
    date: "date.may30",
    poster: posterThcf,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "relja",
    artist: "Relja",
    date: "date.may16",
    poster: posterRelja,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "inas",
    artist: "Inas",
    date: "date.may09",
    poster: posterInas,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
  {
    slug: "my-lucky-number",
    artist: "My Lucky Numb3r",
    date: "date.apr18",
    poster: posterNumber,
    status: "past",
    tickets: nothingOnSale,
    tables: tablesClosed,
  },
];

export const upcomingEvents = events.filter((e) => e.status === "upcoming");
export const pastEvents = events.filter((e) => e.status === "past");

/* The night the home page leads with. Undefined is a real state — the club
   between seasons — and every surface that uses it handles that. */
export const nextEvent: PartyEvent | undefined = upcomingEvents[0];

export function findEvent(slug: string | undefined): PartyEvent | undefined {
  if (!slug) return undefined;
  return events.find((event) => event.slug === slug);
}

/* Can this night be reserved or bought at all? Past nights answer no, and the
   reservation room refuses to open on them. */
export function isBookable(event: PartyEvent) {
  return (
    event.status === "upcoming" && (event.tickets.enabled || event.tables.enabled)
  );
}

/* What is actually on sale for a night.
 *
 * A night with named types sells those. A night with only a price sells one
 * thing — entry — and that single type is built from the price rather than
 * written out twice, so `ticketPrice` stays the one number anybody has to
 * edit. A night with neither sells nothing, and the ticket step says so. */
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

/* What the artwork of every night cycles through in the middle portal. */
export const posters = events.map((event) => event.poster);

/* The two things a guest can be here for. The room reads this out of the URL,
   so every entry point on the site is a plain link and every state of the room
   can be shared, bookmarked and opened in a new tab. */
export type ReserveChoice = "karte" | "stolovi";

export const RESERVE_PATH = "/rezervacija";

/* /rezervacija               — pick a night
   /rezervacija?event=slug    — that night, both ways in
   ...&izbor=karte|stolovi    — straight to one of them */
export function reserveHref(slug?: string, choice?: ReserveChoice) {
  if (!slug) return RESERVE_PATH;
  const query = new URLSearchParams({ event: slug });
  if (choice) query.set("izbor", choice);
  return `${RESERVE_PATH}?${query.toString()}`;
}
