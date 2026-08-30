/* FROM event-rules, NOT FROM events. Both re-export the same three things, and
   the difference is what comes with them: lib/ticketing/events.ts imports the
   database client on its first line, so naming it here would put `pg` into the
   bundle of every client component that renders one label out of this file. */
import {
  hasEnded,
  saleState,
  type SaleState,
  type TicketingEvent,
} from "@/lib/ticketing/event-rules";

/* THE EVENT MANAGER'S OWN LAYER — policy, grouping and view models.
 *
 * ═══ WHY THIS IS NOT IN lib/ticketing/events.ts ═══════════════════════════
 *
 * That file owns the TABLE: it is the one writer, it holds the capacity floor
 * and the duplication rules, and everything that changes a night goes through
 * it. This file owns the ANSWER TO A QUESTION AN OFFICE ASKS — which nights are
 * live, which are still being written, which are over — and answers it without
 * writing anything.
 *
 * The split matters for the reason every split in this system matters: the day
 * there is a second surface (a phone application, a promoter's dashboard, a
 * second club), it needs these groupings and these view models and must not get
 * its own opinion about them. A screen that decided for itself what "active"
 * meant would eventually disagree with the one next to it.
 *
 * ═══ NOTHING HERE IS PLITVICE ═════════════════════════════════════════════
 *
 * No slug, no weekday, no house rule is written down in this file. A night is
 * active because of its status and its date, not because it is a Saturday; a
 * night takes tables because its row says so, not because this club has a
 * floor. That is the whole of what "reusable for another club" means at this
 * stage, and it costs nothing to hold to. */

/* ── a poster, or a night this system ran ───────────────────────────────── */

/* THE ONE DEFINITION OF "OPERATIONAL", AND EVERY SCREEN ASKS IT HERE.
 *
 * ═══ WHAT THE DISTINCTION ACTUALLY IS ═════════════════════════════════════
 *
 * The club's record is older than the club's software. Ten nights on the public
 * wall — Dara Bubamara, Rasta, Katarina Živković, White Party & Semafor,
 * Teodora, Sajfer, THCF, Relja, Inas, My Lucky Numb3r — existed as artwork and
 * nothing else. Nobody sold a ticket for one of them here, nobody scanned
 * anybody in, nobody took a table on this floor plan. They are photographs.
 *
 * ═══ WHY A FLAG AND NOT AN INFERENCE ══════════════════════════════════════
 *
 * The tempting test is "it has no orders, so it must be legacy". That is the
 * bug, not the rule: a real night the club announced and then cancelled has no
 * orders either, and so does a real night three hours before the sale opens.
 * Absence of rows cannot distinguish "we did not run this here" from "nothing
 * has happened yet" — and getting it wrong in the second direction quietly
 * deletes a live night from the office's own dashboard.
 *
 * So it is a column, written from the seed, and it says where the night came
 * from rather than how it is going. See lib/db/schema.ts.
 *
 * ═══ WHAT IT CHANGES, AND WHAT IT DOES NOT ════════════════════════════════
 *
 * A legacy night is NOT hidden and NOT deleted. It keeps its row, its artwork
 * and its place on the public wall; it can still be opened in the office, where
 * it says plainly what it is. What it does not do is stand in a list of
 * operational nights carrying a column of zeros that look like measurements. */
export function isOperational(event: TicketingEvent): boolean {
  return !event.legacyArchive;
}

/* ── how a night is filed ───────────────────────────────────────────────── */

/* FOUR GROUPS, AND THE ORDER IS THE ORDER OF ATTENTION.
 *
 *   active   — announced and ahead: on sale, sold out, or simply published and
 *              waiting. This is what the club is working on tonight.
 *   draft    — being written. Never public, whatever its date says.
 *   finished — it happened, or the club closed it. Read the next afternoon for
 *              the figures, and then rarely.
 *   archived — deliberately put away. Off the working list entirely, with
 *              everything it left behind intact.
 *
 * A DRAFT IS A DRAFT WHATEVER ITS DATE. A draft whose evening has passed is
 * still a draft and not a finished night — it was never put on, so filing it
 * with the nights that were would be a lie about the club's own history. */
export type EventGroup = "active" | "draft" | "finished" | "archived";

export function eventGroupOf(event: TicketingEvent, now = new Date()): EventGroup {
  if (event.archivedAt) return "archived";
  if (event.status === "draft") return "draft";
  if (event.status === "ended") return "finished";
  /* THE EVENING ITSELF IS THE LINE, AND THE LINE IS THE END OF IT. A night
     that has STARTED is the night the club is working on right now — it stays
     under AKTIVNI until it is actually over. See `hasEnded` in
     lib/ticketing/event-rules.ts, which is the one place that decides, and
     which the public wall and both table gates ask as well. */
  return hasEnded(event, now) ? "finished" : "active";
}

/* ── the one word a night is described by ───────────────────────────────── */

/* WHAT TO PUT ON THE EVENT BADGE, AND WHY IT IS NOT THE COLUMN.
 *
 * The `status` column is what the office SET; it is not the whole of what is
 * true. Two things it cannot say on its own:
 *
 *   · a published night three weeks away and a published night happening
 *     right now both read `on_sale`, and they are not the same news;
 *   · a night whose evening has passed still reads `on_sale` until somebody
 *     closes it, and the clock already knows better — `hasEnded` is the rule
 *     every other surface asks.
 *
 * So the badge is derived once, here, and every screen renders what this
 * returns. That is the same discipline `eventGroupOf` holds: nothing in a
 * component gets its own opinion about when a Saturday is over.
 *
 * AND IT IS NOT THE SALE. Whether entry is being sold on the site is a
 * different question with a different answer, and it is `saleState`. See the
 * note above EVENT in components/admin/badge.tsx. */
export type EventStatusBadge =
  | "draft"
  | "upcoming"
  | "on_sale"
  | "sold_out"
  | "ended";

export function eventStatusBadge(
  event: TicketingEvent,
  now = new Date(),
): EventStatusBadge {
  if (event.status === "draft") return "draft";
  /* The clock outranks the column, in that direction only: a night the office
     has closed early is closed, and a night whose evening has gone is over
     whatever the column still says. */
  if (event.status === "ended" || hasEnded(event, now)) return "ended";
  if (event.status === "sold_out") return "sold_out";
  /* Published, not finished: either it is running or it is coming. */
  return Date.parse(event.startsAt) > now.getTime() ? "upcoming" : "on_sale";
}

/* ── what a list row needs ──────────────────────────────────────────────── */

/* One night as a screen needs it: the row, how full it is, and the two states
   that are computed rather than stored. Assembled once, server-side, so that
   no component recomputes `saleState` and no two components disagree. */
export type EventCounts = {
  capacity: number;
  paid: number;
  available: number;
  taken: number;
};

export type EventCardModel = {
  event: TicketingEvent;
  counts: EventCounts;
  sale: SaleState;
  group: EventGroup;
};

export function toCard(
  event: TicketingEvent,
  counts: EventCounts,
  now = new Date(),
): EventCardModel {
  return {
    event,
    counts,
    sale: saleState(event, counts.taken, now),
    group: eventGroupOf(event, now),
  };
}

export type GroupedEvents = Record<EventGroup, EventCardModel[]>;

/* Soonest first among the nights ahead; most recent first among the ones that
   have happened. Both are the order somebody actually reads them in. */
export function groupEvents(cards: EventCardModel[]): GroupedEvents {
  const grouped: GroupedEvents = { active: [], draft: [], finished: [], archived: [] };
  for (const card of cards) grouped[card.group].push(card);

  grouped.active.sort(byStart("asc"));
  grouped.draft.sort(byStart("asc"));
  grouped.finished.sort(byStart("desc"));
  grouped.archived.sort(byStart("desc"));
  return grouped;
}

const byStart =
  (direction: "asc" | "desc") =>
  (a: EventCardModel, b: EventCardModel): number => {
    const order = a.event.startsAt.localeCompare(b.event.startsAt);
    return direction === "asc" ? order : -order;
  };

export const GROUP_LABELS: Record<EventGroup, string> = {
  active: "Aktivni",
  draft: "Draft",
  finished: "Završeni",
  archived: "Arhiva",
};

/* ── the quick actions a night can be offered ───────────────────────────── */

/* WHICH MOVES MAKE SENSE FROM WHERE THIS NIGHT IS, decided once rather than by
 * each button asking itself. A screen renders what this returns; it does not
 * reason about status.
 *
 * `publish` is the one that changes what the public can do, so it is the only
 * one marked primary — one loud action per row, or the row is a toolbar. */
export type EventAction =
  | "edit"
  | "publish"
  | "pause"
  | "close"
  | "preview"
  | "duplicate"
  | "archive"
  | "restore"
  | "delete";

export function actionsFor(card: EventCardModel): {
  primary: EventAction[];
  more: EventAction[];
} {
  const { event, group } = card;

  if (group === "archived") {
    return { primary: ["restore"], more: ["preview", "duplicate"] };
  }

  const primary: EventAction[] = ["edit"];
  const more: EventAction[] = ["preview", "duplicate"];

  /* A NIGHT THAT IS OVER IS NOT OFFERED THE MOVES OF A NIGHT THAT IS COMING.
   *
   * This is the other half of the inconsistency the lifecycle rule fixed. A
   * night filed under ZAVRŠENI whose status column still reads `on_sale` was
   * being offered PAUZIRAJ PRODAJU — pause the sale of a night that finished
   * hours ago — and OBJAVI, publish a night that has been and gone. Neither is
   * a move anybody wants; both read as though the screen had not noticed.
   *
   * What is left is what the office actually does the next afternoon: read it,
   * close the sale if nobody got round to it, copy it into next week, put it
   * away. `close` is offered only where there is still a sale to close. */
  if (group === "finished") {
    if (event.status === "on_sale" || event.status === "sold_out") {
      more.push("close");
    }
    more.push("archive");
    return { primary, more };
  }

  if (event.status === "draft") {
    /* A draft with no price cannot be published into a sale, but it can still
       be published as a night the club is announcing — the sale is a separate
       fact and `saleState` already says so. */
    primary.push("publish");
  } else if (event.status === "on_sale") {
    /* Two different things, and clubs mean both: pause is "stop selling for a
       moment, the night stands", close is "this night is done". */
    primary.push("pause");
    more.push("close");
  } else if (event.status === "sold_out") {
    primary.push("publish");
    more.push("close");
  }

  more.push("archive");
  /* Offered at all only for a night that could conceivably be deletable; the
     server counts what it left behind and refuses anyway. */
  if (group === "draft") more.push("delete");

  return { primary, more };
}

export const ACTION_LABELS: Record<EventAction, string> = {
  edit: "Uredi",
  publish: "Objavi",
  pause: "Pauziraj prodaju",
  close: "Zatvori prodaju",
  /* NOT "Pregledaj" any more. The night's own screen now opens on a tab called
     PREGLED — the operational report — and two different things called the
     same word on the same screen is how somebody clicks the wrong one. This
     action opens the guest-facing checklist, so it says what that is. */
  preview: "Šta gost vidi",
  duplicate: "Dupliraj",
  archive: "Arhiviraj",
  restore: "Vrati iz arhive",
  delete: "Obriši",
};

/* ── tickets: one tier today, several later ─────────────────────────────── */

/* THE SEAM FOR MULTIPLE TICKET TYPES, AND NOTHING MORE THAN A SEAM.
 *
 * The system sells one thing: entry, at `ticketPrice`, capped by `capacity`.
 * Clubs eventually want Regular / VIP / Early Bird, and the expensive way to
 * arrive there is for every screen to have read `event.ticketPrice` directly —
 * because then adding tiers means touching every screen.
 *
 * So screens ask for TIERS and get a list with one in it. The day there is a
 * `ticket_tiers` table, this function reads it, returns several, and the parts
 * that only ever render a list keep working untouched. What will still need
 * real work that day is the checkout and the capacity lock — those hold the
 * no-overselling guarantee and must not be handed a list they treat as
 * interchangeable. This is a seam, not a promise that tiers are done.
 *
 * NOTHING IS BUILT ON SPECULATION. There is no tier table, no tier column and
 * no tier UI; there is one function returning one derived tier, which is what
 * the system genuinely has. */
export type TicketTier = {
  id: string;
  name: string;
  price: number;
  /* How many of this tier exist. Today that is the night's whole capacity,
     because there is one tier and it is the room. */
  capacity: number;
  /* True for the tier every night has whether anybody configured it or not. */
  derived: boolean;
};

export function eventTiers(event: TicketingEvent): TicketTier[] {
  if (!event.ticketingEnabled) return [];
  return [
    {
      id: "regular",
      name: "Redovna ulaznica",
      price: event.ticketPrice,
      capacity: event.capacity,
      derived: true,
    },
  ];
}

/* ── the public address of a night ──────────────────────────────────────── */

/* NOBODY SHOULD HAVE TO TYPE A SLUG TO PUT ON A PARTY.
 *
 * It is a URL fragment, it is derivable from the title in every case anybody
 * cares about, and asking for it is one of the reasons a content system feels
 * like a content system. So it is generated when a night is created — and it
 * is still editable on that night's own page afterwards, because it is the
 * public address of the night and the club may want to choose it.
 *
 * SERBIAN LATIN FOLDS TO ASCII rather than being stripped. "Žurka" has to
 * become "zurka" and not "urka", and `normalize("NFKD")` alone does not do it:
 * đ has no decomposition, so it survives NFKD and is then removed as a
 * non-ASCII character. The five that matter are mapped by hand first.
 *
 * It lives here rather than beside the server action because a "use server"
 * module may export nothing but async functions — every export of one becomes
 * a callable endpoint — and because a rule about what a night is called is a
 * domain rule, not a form's business. */
const FOLD: Record<string, string> = {
  č: "c", ć: "c", ž: "z", š: "s", đ: "dj",
  Č: "c", Ć: "c", Ž: "z", Š: "s", Đ: "dj",
};

export function slugify(title: string): string {
  return title
    .trim()
    .replace(/[čćžšđČĆŽŠĐ]/g, (character) => FOLD[character] ?? character)
    .normalize("NFKD")
    /* Combining marks left over from the decomposition. */
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* ── the poster ─────────────────────────────────────────────────────────── */

/* Where a night's artwork is, or nothing. Every screen asks this rather than
   reading `image`, so the day a poster gains sizes or a fallback, they all get
   it at once. An empty string is treated as absent — that is what clearing the
   field writes. */
export function posterUrl(event: TicketingEvent): string | undefined {
  const url = event.image?.trim();
  return url ? url : undefined;
}
