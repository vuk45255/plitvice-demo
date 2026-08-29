import { randomUUID } from "node:crypto";
import { query, tx, type Queryable } from "@/lib/db/client";
import { TAKEN_CLAUSE } from "@/lib/ticketing/taken";
import { currentVenue, isFloorPlan, type FloorPlanId, type VenueId } from "@/lib/venue";
import type { TicketingEvent, TicketingEventStatus } from "@/lib/ticketing/event-rules";

/* The nights the system can sell, read from the database.
 *
 * WHY THIS IS NOT lib/events.ts. That file is the club's poster wall: artwork,
 * ambient colour, dictionary keys, a `StaticImageData` import per night. It is
 * a marketing catalogue and it is right to be one. Selling entry needs a
 * different set of facts about the same night — a price, a capacity, a window
 * during which money may be taken — and it needs them somewhere that has no
 * opinion about images, no dependency on the front end and no reason to be
 * pulled into a webhook handler or a test run. So the two live apart and meet
 * on one field: `slug`. A night that is on the wall and on sale carries the
 * same slug in both, and /rezervacija and /t/<token> are talking about the
 * same evening.
 *
 * ═══ THIS IS NOW A TABLE ══════════════════════════════════════════════════
 *
 * It used to be an array in this file. It is `SELECT * FROM events`, seeded
 * once from lib/club/programme-seed.ts and edited from /admin thereafter —
 * which is what lets the club raise a capacity or open a sale at eleven at
 * night without a deploy. Everything above still asks `findTicketingEvent`;
 * the only change is that asking is now something you await.
 *
 * `ticketsSold` is deliberately NOT a column. A number written next to a night
 * is a number that can disagree with the tickets that actually exist, and the
 * first time it does, the club either turns somebody away who paid or lets in
 * more people than the room holds. It is counted, in the same transaction that
 * takes the seats — see `soldFor` and `placeOrder` in lib/ticketing/store.ts. */

/* ═══ THE SHAPE OF A NIGHT LIVES IN lib/ticketing/event-rules.ts ══════════
 *
 * `TicketingEvent`, `TicketingEventStatus`, `SaleState`, `saleState` and
 * `remainingForOrder` moved there — not because they changed, but because
 * this file imports `pg` on its first line and a client component that wants
 * one label out of the event manager must not therefore ship a Postgres
 * driver to a browser. They are re-exported below, so nothing that already
 * imports them from here has to change. */
export type {
  SaleState,
  TicketingEvent,
  TicketingEventStatus,
} from "@/lib/ticketing/event-rules";
export { remainingForOrder, saleState } from "@/lib/ticketing/event-rules";

/* ── reading ────────────────────────────────────────────────────────────── */

const COLUMNS = `id, slug, title, starts_at, doors_at, description, image, status,
                 ticket_price, currency, capacity, max_per_order,
                 sales_start, sales_end, test_only,
                 venue_id, ticketing_enabled, tables_enabled, floor_plan,
                 poster_key, lineup, genre, age_restriction, entry_note,
                 dress_code, promotion, archived_at`;

/* The same list, qualified, for the one query that joins a count beside it. */
const COLUMNS_E = COLUMNS.split(",").map((c) => `e.${c.trim()}`).join(", ");

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: Date | string;
  doors_at: Date | string | null;
  description: string | null;
  image: string | null;
  status: TicketingEventStatus;
  ticket_price: number;
  currency: string;
  capacity: number;
  max_per_order: number;
  sales_start: Date | string | null;
  sales_end: Date | string | null;
  test_only: boolean;
  venue_id: string | null;
  ticketing_enabled: boolean | null;
  tables_enabled: boolean | null;
  floor_plan: string | null;
  poster_key: string | null;
  lineup: string | null;
  genre: string | null;
  age_restriction: string | null;
  entry_note: string | null;
  dress_code: string | null;
  promotion: string | null;
  archived_at: Date | string | null;
};

/* One instant, written the one way the rest of the system reads it. Both
   drivers hand back a Date for `timestamptz`; a string is accepted too so that
   nothing breaks if one of them ever stops. */
export function iso(value: Date | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toEvent(row: EventRow): TicketingEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: iso(row.starts_at)!,
    doorsAt: iso(row.doors_at),
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    status: row.status,
    ticketPrice: Number(row.ticket_price),
    currency: "RSD",
    capacity: Number(row.capacity),
    maxPerOrder: Number(row.max_per_order),
    salesStart: iso(row.sales_start),
    salesEnd: iso(row.sales_end),
    testOnly: Boolean(row.test_only),
    /* Every one of these is read defensively. The columns have defaults, so a
       real row always has a value — but a row read through an older path, a
       test fixture, or a database that has not finished migrating must not be
       able to produce an event object with `undefined` where a boolean is
       declared. The fallback is always what the system did before the column
       existed. */
    venueId: row.venue_id ?? currentVenue().id,
    ticketingEnabled: row.ticketing_enabled ?? true,
    tablesEnabled: row.tables_enabled ?? false,
    floorPlan: row.floor_plan && isFloorPlan(row.floor_plan) ? row.floor_plan : "default",
    posterKey: row.poster_key ?? undefined,
    lineup: row.lineup ?? undefined,
    genre: row.genre ?? undefined,
    ageRestriction: row.age_restriction ?? undefined,
    entryNote: row.entry_note ?? undefined,
    dressCode: row.dress_code ?? undefined,
    promotion: row.promotion ?? undefined,
    archivedAt: iso(row.archived_at),
  };
}

/* Every night this system may talk about right now, soonest first. A test
   night is only one of them while dev mode is open. */
export async function ticketingEvents(devMode: boolean): Promise<TicketingEvent[]> {
  const result = await query<EventRow>(
    `SELECT ${COLUMNS} FROM events
      WHERE ($1::boolean OR test_only = false)
      ORDER BY starts_at ASC`,
    [devMode],
  );
  return result.rows.map(toEvent);
}

/* By slug or by id — a URL carries one, an order carries the other, and
   neither caller should have to know which. Returns undefined for a test night
   when dev mode is shut, which is what stops a test ticket being sold or
   scanned on a production server. */
export async function findTicketingEvent(
  key: string | undefined,
  devMode: boolean,
  q: Queryable | undefined = undefined,
): Promise<TicketingEvent | undefined> {
  if (!key) return undefined;
  const run = q ? q.query.bind(q) : query;
  const result = await run<EventRow>(
    `SELECT ${COLUMNS} FROM events
      WHERE (slug = $1 OR id = $1) AND ($2::boolean OR test_only = false)
      LIMIT 1`,
    [key, devMode],
  );
  const row = result.rows[0];
  return row ? toEvent(row) : undefined;
}

/* THE NIGHT AND HOW FULL IT IS, IN ONE STATEMENT.
 *
 * A checkout needs both: the price and the sale window to decide what it costs
 * and whether it may be sold, and the count to know whether there is any point
 * queueing for the capacity lock. Asking separately was two round trips and,
 * worse, meant that EVERY buyer for a night that had already sold out still
 * joined the queue on the event row — three hundred buyers for twenty-five
 * seats measured as a chain of three hundred serialized transactions, twenty-
 * four seconds long, with the tail timing out waiting for a connection.
 *
 * With the count arriving free beside the night, a buyer for a full room is
 * refused before the lock exists, and the queue collapses to the buyers who
 * might actually get a seat.
 *
 * ═══ THIS COUNT IS NOT THE GUARANTEE ══════════════════════════════════════
 *
 * It is a snapshot from before the lock, and it is allowed to be out of date in
 * exactly one direction that matters: a hold may lapse a millisecond later and
 * free a seat this answer said was gone. That buyer is told `sold_out` and can
 * try again — which is what "last look" has always meant here. The number that
 * decides anything is counted inside the lock, in `placeOrder`, and nothing
 * about that changed. */
export async function findTicketingEventWithTaken(
  key: string | undefined,
  devMode: boolean,
): Promise<{ event: TicketingEvent; taken: number } | undefined> {
  if (!key) return undefined;
  const result = await query<EventRow & { taken: number }>(
    `SELECT ${COLUMNS_E},
            COALESCE((SELECT SUM(quantity) FROM ticket_orders
                       WHERE event_id = e.id AND ${TAKEN_CLAUSE}), 0)::int AS taken
       FROM events e
      WHERE (slug = $1 OR id = $1) AND ($2::boolean OR test_only = false)
      LIMIT 1`,
    [key, devMode],
  );
  const row = result.rows[0];
  return row ? { event: toEvent(row), taken: Number(row.taken) } : undefined;
}

/* Ignores dev mode entirely. Used by the admin screen, which is signed in and
   is supposed to see the test nights, and by nothing a guest can reach. */
export async function allTicketingEvents(): Promise<TicketingEvent[]> {
  return ticketingEvents(true);
}

/* ── writing (admin only) ───────────────────────────────────────────────── */

export type EventPatch = Partial<
  Pick<
    TicketingEvent,
    | "title"
    | "slug"
    | "status"
    | "ticketPrice"
    | "capacity"
    | "maxPerOrder"
    | "startsAt"
    | "doorsAt"
    | "salesStart"
    | "salesEnd"
    | "description"
    | "image"
    | "ticketingEnabled"
    | "tablesEnabled"
    | "floorPlan"
    | "posterKey"
    | "lineup"
    | "genre"
    | "ageRestriction"
    | "entryNote"
    | "dressCode"
    | "promotion"
  >
>;

/* Why an edit was refused. `capacity_below_sold` carries the number, because
   "you cannot set 200" is not useful and "312 are already sold" is. */
export type EventWriteResult =
  | { ok: true; event: TicketingEvent }
  | { ok: false; reason: "unknown" | "slug_taken" | "invalid" }
  | { ok: false; reason: "capacity_below_sold"; taken: number };

/* THE ONE WAY AN EVENT CHANGES. Nothing writes to the table except this, so
   there is one place where a capacity can be lowered below what is already
   sold — and it refuses, because a room that has sold 312 seats does not have
   a capacity of 200 whatever anybody types. */
export async function updateEvent(
  id: string,
  patch: EventPatch,
): Promise<EventWriteResult> {
  /* ═══ THE CAPACITY FLOOR ══════════════════════════════════════════════
   *
   * A ROOM THAT HAS SOLD 312 SEATS DOES NOT HAVE A CAPACITY OF 200, whatever
   * anybody types into the office screen at midnight. Accepting it would not
   * un-sell anything — the orders and the tickets stay exactly where they are
   * — it would simply mean the club had promised more people entry than the
   * number it now believes the room holds, and found out at the door.
   *
   * IT IS CHECKED HERE, in the one function that writes to this table, and
   * not in the form that happens to be in front of somebody. A server action,
   * a future till, a script run by a person in a hurry: all three come
   * through this, and none of them gets its own opinion.
   *
   * `taken` is paid admissions PLUS the ones inside a live checkout hold —
   * the same clause every other count in this system uses — because a
   * capacity that ignores the ten people currently paying is a capacity that
   * is wrong ten minutes later. */
  if (patch.capacity !== undefined) {
    /* ═══ UNDER THE SAME LOCK A CHECKOUT TAKES ════════════════════════════
     *
     * Reading the number sold and then writing the capacity as two separate
     * statements leaves a window: an order placed between them can push the
     * room past a capacity that was legal when it was read, and the club ends
     * up having promised more people entry than it believes the room holds.
     * The window is small and the consequence is somebody turned away at the
     * door, which is exactly the class of bug this system is built to refuse.
     *
     * So the event row is taken FOR UPDATE first — the very lock `placeOrder`
     * queues on — the admissions are counted inside it, and the capacity is
     * written before it is released. A checkout that arrives mid-edit waits a
     * millisecond and then counts against the NEW capacity. */
    const { soldFor } = await import("@/lib/ticketing/store");
    return tx(async (q) => {
      const locked = await q.query<{ capacity: number }>(
        `SELECT capacity FROM events WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (locked.rows.length === 0) return { ok: false as const, reason: "unknown" as const };

      const taken = await soldFor(id, q);
      if (patch.capacity! < taken) {
        return { ok: false as const, reason: "capacity_below_sold" as const, taken };
      }
      return writeEvent(id, patch, q);
    });
  }

  return writeEvent(id, patch);
}

/* The UPDATE itself, with no rules of its own. Takes an optional `Queryable`
   so the capacity path above can run it INSIDE the transaction that holds the
   event row — a second connection there would be a second connection waiting
   on a lock its own caller holds. */
async function writeEvent(
  id: string,
  patch: EventPatch,
  q?: Queryable,
): Promise<EventWriteResult> {
  const run = q ? q.query.bind(q) : query;

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (patch.title !== undefined) push("title", patch.title);
  if (patch.slug !== undefined) push("slug", patch.slug);
  if (patch.description !== undefined) push("description", patch.description || null);
  if (patch.image !== undefined) push("image", patch.image || null);
  if (patch.status !== undefined) push("status", patch.status);
  if (patch.ticketPrice !== undefined) push("ticket_price", patch.ticketPrice);
  if (patch.capacity !== undefined) push("capacity", patch.capacity);
  if (patch.maxPerOrder !== undefined) push("max_per_order", patch.maxPerOrder);
  if (patch.startsAt !== undefined) push("starts_at", patch.startsAt);
  if (patch.doorsAt !== undefined) push("doors_at", patch.doorsAt || null);
  if (patch.salesStart !== undefined) push("sales_start", patch.salesStart || null);
  if (patch.salesEnd !== undefined) push("sales_end", patch.salesEnd || null);
  if (patch.ticketingEnabled !== undefined) push("ticketing_enabled", patch.ticketingEnabled);
  if (patch.tablesEnabled !== undefined) push("tables_enabled", patch.tablesEnabled);
  if (patch.floorPlan !== undefined) push("floor_plan", patch.floorPlan);
  if (patch.posterKey !== undefined) push("poster_key", patch.posterKey || null);
  /* The five optional lines about the night. An empty string CLEARS one —
     that is how the form removes a dress code — and `undefined` leaves it
     alone, exactly as it does for a description. */
  if (patch.lineup !== undefined) push("lineup", patch.lineup || null);
  if (patch.genre !== undefined) push("genre", patch.genre || null);
  if (patch.ageRestriction !== undefined) push("age_restriction", patch.ageRestriction || null);
  if (patch.entryNote !== undefined) push("entry_note", patch.entryNote || null);
  if (patch.dressCode !== undefined) push("dress_code", patch.dressCode || null);
  if (patch.promotion !== undefined) push("promotion", patch.promotion || null);

  if (sets.length === 0) {
    const event = await findTicketingEvent(id, true);
    return event ? { ok: true, event } : { ok: false, reason: "unknown" };
  }

  values.push(id);
  try {
    const result = await run<EventRow>(
      `UPDATE events SET ${sets.join(", ")}, updated_at = now()
        WHERE id = $${values.length}
        RETURNING ${COLUMNS}`,
      values,
    );

    const row = result.rows[0];
    if (!row) return { ok: false, reason: "unknown" };
    return { ok: true, event: toEvent(row) };
  } catch (error: unknown) {
    /* The only unique constraint on this table is the slug. */
    if (isUniqueViolation(error)) return { ok: false, reason: "slug_taken" };
    throw error;
  }
}

/* ── a new night ────────────────────────────────────────────────────────── */

export type NewEvent = {
  title: string;
  slug: string;
  startsAt: string;
  capacity: number;
  ticketPrice: number;
  maxPerOrder?: number;
  doorsAt?: string;
  description?: string;
  image?: string;
  status?: TicketingEventStatus;
  /* Everything the event manager can set on the way in. All optional, so the
     original four-field call site still compiles and still means what it
     meant. */
  ticketingEnabled?: boolean;
  tablesEnabled?: boolean;
  floorPlan?: FloorPlanId;
  posterKey?: string;
  lineup?: string;
  genre?: string;
  ageRestriction?: string;
  entryNote?: string;
  dressCode?: string;
  promotion?: string;
  venueId?: VenueId;
};

/* Adding a night from the office rather than from the catalogue.
 *
 * WHY THIS IS ALLOWED TO EXIST when lib/club/programme-seed.ts is where nights
 * come from: the catalogue seeds the table once and then never touches it
 * again, precisely so that a night the club added at eleven on a Friday is not
 * removed by the next deploy. A row created here is a row like any other.
 *
 * IT ARRIVES `draft`. A night that appeared on the site the instant somebody
 * typed a name into a form — with no poster, no price checked and no door time
 * — is how a club sells tickets to the wrong evening. Somebody has to choose
 * to put it on sale. */
export async function createEvent(input: NewEvent): Promise<EventWriteResult> {
  const title = input.title.trim();
  const slug = input.slug.trim().toLowerCase();

  /* The slug is in URLs — /rezervacija?event=… — and is the one field shared
     with the poster wall, so it is checked rather than sanitised: quietly
     turning what somebody typed into something else produces a night whose
     address nobody can guess. */
  if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, reason: "invalid" };
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 0) {
    return { ok: false, reason: "invalid" };
  }
  if (!Number.isInteger(input.ticketPrice) || input.ticketPrice < 0) {
    return { ok: false, reason: "invalid" };
  }
  if (!input.startsAt || Number.isNaN(Date.parse(input.startsAt))) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const result = await query<EventRow>(
      `INSERT INTO events (
         id, slug, title, starts_at, doors_at, description, image, status,
         ticket_price, currency, capacity, max_per_order, test_only,
         venue_id, ticketing_enabled, tables_enabled, floor_plan, poster_key,
         lineup, genre, age_restriction, entry_note, dress_code, promotion
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'RSD',$10,$11,false,
                 $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING ${COLUMNS}`,
      [
        newEventId(),
        slug,
        title,
        input.startsAt,
        input.doorsAt || null,
        input.description || null,
        input.image || null,
        input.status ?? "draft",
        input.ticketPrice,
        input.capacity,
        input.maxPerOrder ?? 10,
        input.venueId ?? currentVenue().id,
        input.ticketingEnabled ?? true,
        input.tablesEnabled ?? false,
        input.floorPlan ?? "default",
        input.posterKey || null,
        input.lineup || null,
        input.genre || null,
        input.ageRestriction || null,
        input.entryNote || null,
        input.dressCode || null,
        input.promotion || null,
      ],
    );
    return { ok: true, event: toEvent(result.rows[0]) };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return { ok: false, reason: "slug_taken" };
    throw error;
  }
}

/* An id, in one place, because two things now mint one. Prefixed so that a
   row id says what it is when it turns up in a log next to an order's. */
function newEventId(): string {
  return `evt_${randomUUID().slice(0, 8)}`;
}

/* ── copying a night ────────────────────────────────────────────────────── */

/* WHAT A DUPLICATE IS, AND — MUCH MORE IMPORTANTLY — WHAT IT IS NOT.
 *
 * Staff run the same night every Saturday: same price, same capacity, same
 * floor, same age rule, same door time. Typing all of that again is how a
 * capacity ends up wrong, so this copies the CONFIGURATION of a night and
 * nothing else.
 *
 * ═══ WHY NO OPERATIONAL DATA CAN COME WITH IT ═════════════════════════════
 *
 * Not because this function is careful to leave it behind — because there is
 * nothing to leave behind. THIS IS ONE INSERT INTO ONE TABLE. Orders, tickets,
 * scans, reservations and seat holds all point AT an event (by id, or by slug
 * for the floor); not one of them is stored on the event row, and a brand-new
 * id that nothing has ever pointed at cannot inherit any of them.
 *
 * That is the whole safety argument, and it is structural rather than a list
 * of things somebody remembered not to copy. The alternative — copy the row
 * and then delete what should not be there — is the version that ships a bug
 * the first time a table is added.
 *
 * ═══ THE THREE THINGS THAT ARE DELIBERATELY NOT COPIED ════════════════════
 *
 *   THE STATUS. A copy always arrives `draft`, whatever the original was. A
 *   duplicate that went on sale the instant it was made — last week's date,
 *   last week's poster — is exactly how a club sells tickets to an evening
 *   that does not exist.
 *
 *   THE SALES WINDOW. It was a window around LAST week's date. Carried over,
 *   it would silently close the sale of a night that has not happened yet.
 *
 *   THE POSTER KEY. The URL is copied so the new night is not blank, but the
 *   two rows must not both claim to OWN the same object in the bucket:
 *   replacing the copy's poster would otherwise delete the original's. So the
 *   copy points at the image and owns nothing. */
export type DuplicateInput = {
  title?: string;
  slug?: string;
  startsAt?: string;
};

export async function duplicateEvent(
  id: string,
  input: DuplicateInput = {},
): Promise<EventWriteResult> {
  const source = await findTicketingEvent(id, true);
  if (!source) return { ok: false, reason: "unknown" };

  const title = (input.title ?? source.title).trim();
  const startsAt = input.startsAt ?? nextWeek(source.startsAt);
  const slug = (input.slug ?? (await freeSlugFrom(source.slug))).trim().toLowerCase();

  return createEvent({
    title,
    slug,
    startsAt,
    /* The door offset is a fact about how this club runs a night, so it is
       kept — shifted onto the new date rather than copied as an instant. */
    doorsAt: source.doorsAt
      ? shift(source.doorsAt, Date.parse(startsAt) - Date.parse(source.startsAt))
      : undefined,
    capacity: source.capacity,
    ticketPrice: source.ticketPrice,
    maxPerOrder: source.maxPerOrder,
    description: source.description,
    image: source.image,
    /* posterKey deliberately omitted — see above. */
    ticketingEnabled: source.ticketingEnabled,
    tablesEnabled: source.tablesEnabled,
    floorPlan: source.floorPlan,
    lineup: source.lineup,
    genre: source.genre,
    ageRestriction: source.ageRestriction,
    entryNote: source.entryNote,
    dressCode: source.dressCode,
    promotion: source.promotion,
    venueId: source.venueId,
    status: "draft",
  });
}

/* A free slug near the one being copied: saturday-madness-2, then -3. Checked
   rather than guessed, and the INSERT's unique index is still what decides —
   this only makes the common case pleasant. */
async function freeSlugFrom(slug: string): Promise<string> {
  const stem = slug.replace(/-\d+$/, "");
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${stem}-${n}`;
    const taken = await query(`SELECT 1 FROM events WHERE slug = $1`, [candidate]);
    if (taken.rowCount === 0) return candidate;
  }
  return `${stem}-${randomUUID().slice(0, 4)}`;
}

/* Seven days on, at the same hour. The club's usual answer, and the form shows
   it as an editable date rather than committing anybody to it. */
const nextWeek = (startsAt: string) =>
  new Date(Date.parse(startsAt) + 7 * 24 * 60 * 60 * 1000).toISOString();

const shift = (instant: string, by: number) =>
  new Date(Date.parse(instant) + by).toISOString();

/* ── archiving, and the one case where deleting is allowed ──────────────── */

/* WHAT A NIGHT LEFT BEHIND. Asked before anything destructive is offered, and
 * asked of the DATABASE rather than of a status column — the question is not
 * "did this look busy", it is "does removing this row destroy a record of
 * money, an admission, or a table somebody was promised".
 *
 * Orders and tickets are filed under the event's ID; the floor is keyed by its
 * SLUG. Both are counted, because either one being non-zero is a night with a
 * history. */
export type EventFootprint = {
  orders: number;
  tickets: number;
  reservations: number;
  /* True if any of the above is non-zero — the one question callers ask. */
  hasHistory: boolean;
};

export async function eventFootprint(id: string): Promise<EventFootprint | undefined> {
  const event = await findTicketingEvent(id, true);
  if (!event) return undefined;

  const result = await query<{ orders: number; tickets: number; reservations: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM ticket_orders WHERE event_id = $1) AS orders,
       (SELECT COUNT(*)::int FROM tickets       WHERE event_id = $1) AS tickets,
       (SELECT COUNT(*)::int FROM reservations  WHERE event_id = $2) AS reservations`,
    [event.id, event.slug],
  );

  const row = result.rows[0];
  const counted = {
    orders: Number(row?.orders ?? 0),
    tickets: Number(row?.tickets ?? 0),
    reservations: Number(row?.reservations ?? 0),
  };
  return { ...counted, hasHistory: Object.values(counted).some((n) => n > 0) };
}

/* OFF EVERY WORKING LIST, WITH EVERYTHING INTACT.
 *
 * The status goes to `ended` as well as the timestamp being set, and that is
 * not redundancy: `saleState` reads the status, so an archived night stops
 * being sellable through the one function every seller already asks — rather
 * than through a second rule a future checkout might forget to apply.
 *
 * A guest holding a ticket to an archived night can still open it. That is
 * deliberate: the ticket is theirs, the night happened, and archiving is the
 * club tidying its own list. */
export async function archiveEvent(id: string): Promise<EventWriteResult> {
  const result = await query<EventRow>(
    `UPDATE events SET archived_at = now(), status = 'ended', updated_at = now()
      WHERE id = $1 RETURNING ${COLUMNS}`,
    [id],
  );
  const row = result.rows[0];
  return row ? { ok: true, event: toEvent(row) } : { ok: false, reason: "unknown" };
}

/* Back onto the list, as a draft. Never straight back into a sale: whatever
   the night's status was before it was archived, somebody has to look at it. */
export async function restoreEvent(id: string): Promise<EventWriteResult> {
  const result = await query<EventRow>(
    `UPDATE events SET archived_at = NULL, status = 'draft', updated_at = now()
      WHERE id = $1 RETURNING ${COLUMNS}`,
    [id],
  );
  const row = result.rows[0];
  return row ? { ok: true, event: toEvent(row) } : { ok: false, reason: "unknown" };
}

export type EventDeleteResult =
  | { ok: true }
  | { ok: false; reason: "unknown" }
  /* It has a history. Carries the numbers, because "cannot delete" is not
     useful and "31 orders and 12 tables" is. */
  | { ok: false; reason: "has_history"; footprint: EventFootprint };

/* THE ONLY WAY A ROW LEAVES THIS TABLE, AND IT IS ALMOST NEVER ALLOWED.
 *
 * A night with one paid order is a night whose figures the club reads next
 * March; a night with one reservation is a table somebody was promised. Either
 * makes this refuse, and the answer is to archive instead — which the office
 * offers in the same breath.
 *
 * What IS deletable: a draft created by mistake five minutes ago that nothing
 * has ever pointed at. That is a real case and a hard delete is the honest
 * answer to it; anything else keeps its row for ever.
 *
 * THE CHECK AND THE DELETE ARE ONE TRANSACTION, taking the event row FOR
 * UPDATE first. Otherwise an order placed between the count and the delete
 * would be orphaned — a paid ticket pointing at a night that no longer exists,
 * which is the worst outcome this function exists to prevent. */
export async function deleteEvent(id: string): Promise<EventDeleteResult> {
  const footprint = await eventFootprint(id);
  if (!footprint) return { ok: false, reason: "unknown" };
  if (footprint.hasHistory) return { ok: false, reason: "has_history", footprint };

  return tx(async (q) => {
    const locked = await q.query<{ slug: string }>(
      `SELECT slug FROM events WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const slug = locked.rows[0]?.slug;
    if (!slug) return { ok: false as const, reason: "unknown" as const };

    /* Counted AGAIN, inside the lock. The count above is what the office was
       shown; this is the one that decides. */
    const live = await q.query<{ n: number }>(
      `SELECT (
         (SELECT COUNT(*) FROM ticket_orders WHERE event_id = $1) +
         (SELECT COUNT(*) FROM tickets       WHERE event_id = $1) +
         (SELECT COUNT(*) FROM reservations  WHERE event_id = $2)
       )::int AS n`,
      [id, slug],
    );
    if (Number(live.rows[0]?.n ?? 0) > 0) {
      return { ok: false as const, reason: "has_history" as const, footprint };
    }

    /* Seat holds are three-minute courtesies rather than history, so they go
       with the night instead of blocking it. */
    await q.query(`DELETE FROM seat_holds WHERE event_id = $1`, [slug]);
    await q.query(`DELETE FROM events WHERE id = $1`, [id]);
    return { ok: true as const };
  });
}

function isUniqueViolation(error: unknown): boolean {
  const said = String(
    (error as { constraint?: string })?.constraint ??
      (error as { message?: string })?.message ??
      "",
  );
  return /unique|duplicate key/i.test(said);
}
