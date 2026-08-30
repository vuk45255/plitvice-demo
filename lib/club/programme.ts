import { allTicketingEvents, type TicketingEvent } from "@/lib/ticketing/events";
import { hasEnded } from "@/lib/ticketing/event-rules";
import { posterFor } from "@/lib/club/poster-assets";
import type { LocalText } from "@/lib/i18n";
import type { PartyEvent, Ticketing } from "@/lib/events";

/* THE PROGRAMME, AS THE PUBLIC SITE IS ALLOWED TO SEE IT.
 *
 * ═══ THIS IS THE JOIN, AND IT IS THE ONLY ONE ═════════════════════════════
 *
 * One `events` row is one night. The office edits it at /admin/dogadjaji; this
 * turns it into the shape the poster wall and the reservation room already
 * read. There is no second array, no per-night copy in a dictionary and no
 * component that knows a slug — change a title in the office, reload the site,
 * read the new title.
 *
 * ═══ THE PUBLIC RULES LIVE HERE AND ARE ENFORCED ON THE SERVER ════════════
 *
 * They are rules about what MAY BE SHOWN, and they run before anything is sent
 * to a browser rather than being a class that hides a card:
 *
 *   archived   — never public, in any list, ever. It is off the programme.
 *   draft      — never public. A night nobody has finished writing does not
 *                exist as far as a guest is concerned, whatever its date says.
 *   testOnly   — never public. That is what the flag is for.
 *   otherwise  — public, filed `upcoming` while the evening is still ahead and
 *                `past` once it has gone or the club has closed it.
 *
 * NONE OF THIS IS AUTHORISATION BY STYLESHEET. A draft is not rendered and
 * then hidden — it never leaves the server. And the two switches below are
 * enforced in the business layer as well, not only here: `saleState` refuses a
 * checkout for a night with `ticketingEnabled: false`, and the reservation gate
 * refuses a hold or a booking for one with `tablesEnabled: false`. This file
 * decides what a guest is SHOWN; those decide what a guest may DO, and a screen
 * being wrong cannot make either of them wrong.
 *
 * ═══ VANTAGE OS, NOT PLITVICE ═════════════════════════════════════════════
 *
 * There is no club named in this file, no slug written down, and no branch on
 * a venue. A night is on the programme because its row says so. The venue's own
 * data is lib/club/programme-seed.ts and its artwork is lib/club/poster-assets.ts;
 * both are DATA, and this is the machinery that reads whatever data it is
 * given. */

const TZ = "Europe/Belgrade";

/* "29. avgust" and "29 August" — the wall's own two ways of writing a day,
   produced from the instant rather than looked up in a dictionary that had one
   entry per night. This is the one thing a row cannot store once: a date has to
   be written in the reader's language. Formatting is not authoring, so nothing
   is invented by doing it here. */
function localDate(iso: string): LocalText {
  const when = new Date(iso);
  const format = (locale: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      timeZone: TZ,
    }).format(when);
  return { sr: format("sr-Latn-RS"), en: format("en-GB") };
}

/* "22:00", on the club's clock whatever clock the reader's phone is on. The
   same in both languages, which is why it stays a plain string. */
function clockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).format(new Date(iso));
}

/* ═══ WHAT THE TICKET LINE SAYS ════════════════════════════════════════════
 *
 * `ticketingEnabled` FIRST, AND IT IS NEVER INFERRED FROM A PRICE. A night with
 * no price is a night whose price nobody has set; a night that does not sell
 * online is a different fact entirely, and reading one as the other is how a
 * free-entry night ends up with a purchase button on it. The column is the
 * switch, and nothing in this file looks at `ticketPrice` to decide.
 *
 * `sale` is then the club's decision about a night that IS sold online, read
 * off the same status column the office edits. */
function ticketingFor(event: TicketingEvent, past: boolean): Ticketing {
  if (!event.ticketingEnabled || past) {
    /* Shown, dimmed and inert rather than absent — the guest reads that entry
       exists and that this night is not sold here. `ticketAvailability` turns
       this into "unavailable" for an upcoming night and "none" for a past one,
       exactly as it did when this was a hand-written constant. */
    return { enabled: false, sale: "closed", types: [], maxPerOrder: 0 };
  }

  const sale =
    event.status === "on_sale"
      ? "open"
      : event.status === "sold_out"
        ? "soldout"
        : event.status === "draft"
          ? "soon"
          : "closed";

  return { enabled: true, sale, types: [], maxPerOrder: event.maxPerOrder };
}

/* Whether the evening has gone. THE SAME FUNCTION `eventGroupOf` asks in the
   office — not the same question answered twice, which is what it used to be
   and how the wall and the office came to disagree at ten o'clock. */
const hasHappened = (event: TicketingEvent, now: Date) => hasEnded(event, now);

/* ONE ROW, AS THE WALL READS IT. */
export function toPartyEvent(event: TicketingEvent, now = new Date()): PartyEvent {
  const past = event.status === "ended" || hasHappened(event, now);
  const asset = posterFor(event.image);

  return {
    slug: event.slug,
    /* The night's own name. The wall calls it an artist because for most of
       them it is one; it is the title column either way. */
    artist: event.title,
    date: localDate(event.startsAt),
    description: event.description,
    startTime: clockTime(event.startsAt),
    /* A PRICE ONLY WHERE THERE IS A SALE TO PRICE. A night taken at the door
       carries a zero because nobody set an online price, and printing "0 RSD"
       under the poster would be worse than printing nothing at all. */
    ticketPrice:
      event.ticketingEnabled && event.ticketPrice > 0 ? event.ticketPrice : undefined,
    ambient: asset?.ambient,
    poster: asset?.image,
    status: past ? "past" : "upcoming",
    tickets: ticketingFor(event, past),
    /* The switch the office set, carried straight through — and shut for a
       night that has already happened, because there is no table left to give
       away on a Saturday that has been and gone. */
    tables: { enabled: event.tablesEnabled && !past },
    lineup: event.lineup,
    ageRestriction: event.ageRestriction,
    entryNote: event.entryNote,
    dressCode: event.dressCode,
    promotion: event.promotion,
    legacy: event.legacyArchive,
  };
}

/* MAY THIS NIGHT BE SHOWN TO A GUEST AT ALL. Asked through this rather than by
   repeating the three conditions, so a fourth one later has one place to go. */
export function isPublic(event: TicketingEvent): boolean {
  if (event.archivedAt) return false;
  if (event.testOnly) return false;
  if (event.status === "draft") return false;
  return true;
}

export type Programme = {
  /* The nights ahead, soonest first, then the record, most recent first — the
     wall exactly as it hung. */
  events: PartyEvent[];
  upcoming: PartyEvent[];
  /* EVERY night that has happened, in date order. Nothing is dropped here —
     this is the record, and the record is complete. */
  past: PartyEvent[];
  /* The record as a WALL WITH A FIXED NUMBER OF FRAMES on it. See below. */
  archive: PartyEvent[];
  next?: PartyEvent;
};

/* ═══ HOW MANY FRAMES THE ARCHIVE WALL HAS ════════════════════════════════
 *
 * The wall is a two-column grid on a phone and a three-column grid from
 * `md`, so twelve fills both without a ragged last row. It is a DESIGN
 * measure, not a data one: the record itself is unbounded and `past` above
 * carries all of it.
 *
 * This is the number that makes the archive turn over. */
export const ARCHIVE_SLOTS = 12;

/* ═══ WHICH NIGHTS GET THE FRAMES ═════════════════════════════════════════
 *
 * THE CLUB'S OWN NIGHTS FIRST, AND THE POSTERS FILL THE REST.
 *
 * The wall opened with ten nights that this software never ran — artwork from
 * before it existed, and the whole of the club's record at the time. As the
 * club runs nights THROUGH the system, those become the record: they have a
 * date this system watched pass, a poster the office uploaded, and, where the
 * night sold anything, a report behind them.
 *
 * So the selection is by priority and the DISPLAY is by date. Every real
 * finished night takes a frame; whatever is left over is filled with posters,
 * most recent first. Two real nights and ten posters is two and ten; a third
 * real night finishes and it is three and nine. The oldest poster leaves the
 * wall, one at a time, without anybody deciding to remove it and without a
 * single file being deleted — the row and the artwork both stay exactly where
 * they are, and `past` still carries them.
 *
 * THE ORDER ON THE WALL IS STILL THE DATE. Sorting the real ones to the front
 * would file last Saturday above a night from August of the previous year and
 * make the archive read as a ranking. It is a record; it hangs in time. */
export function archiveWall(
  past: PartyEvent[],
  when: (event: PartyEvent) => string,
  slots = ARCHIVE_SLOTS,
): PartyEvent[] {
  const ours = past.filter((event) => !event.legacy);
  const posters = past.filter((event) => event.legacy);

  const chosen = [...ours.slice(0, slots), ...posters.slice(0, Math.max(0, slots - ours.length))];

  return chosen.sort((a, b) => when(b).localeCompare(when(a)));
}

/* ═══ THE ORDER, AND IT IS TWO ORDERS ═════════════════════════════════════
 *
 * Sorted on the ROW'S INSTANT and never on the formatted date, which has no
 * year in it — that is the whole reason a date could not stay a dictionary key.
 *
 * THE NIGHTS AHEAD GO SOONEST FIRST and the record goes most recent first, and
 * those are opposite directions on purpose: `next` is the night the home page
 * leads with and the reservation room opens on, so it has to be the one that is
 * actually next. Sorting everything descending would put the furthest-away
 * night at the top of ZA KOJU ŽURKU? and call it the next one.
 *
 * `events` is the two lists joined in that order — the night ahead, then the
 * record under it — which is the wall exactly as it hung before any of this. */
export function toProgramme(rows: TicketingEvent[], now = new Date()): Programme {
  const shown = rows.filter(isPublic).map((event) => toPartyEvent(event, now));
  const when = (event: PartyEvent) => rows.find((row) => row.slug === event.slug)!.startsAt;

  const upcoming = shown
    .filter((event) => event.status === "upcoming")
    .sort((a, b) => when(a).localeCompare(when(b)));

  const past = shown
    .filter((event) => event.status === "past")
    .sort((a, b) => when(b).localeCompare(when(a)));

  return {
    events: [...upcoming, ...past],
    upcoming,
    past,
    archive: archiveWall(past, when),
    next: upcoming[0],
  };
}

/* THE WHOLE PROGRAMME, ONCE, FOR A SERVER COMPONENT TO HAND DOWNWARDS.
 *
 * Every public page reads this and passes the result into the client tree as a
 * prop. That is the whole of the change: the components below are the same
 * components, rendering the same shape, and the shape now comes out of the
 * table the office edits instead of out of a file nobody in the club can
 * reach. */
export async function programme(now = new Date()): Promise<Programme> {
  return toProgramme(await allTicketingEvents(), now);
}
