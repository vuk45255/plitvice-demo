import { randomUUID } from "node:crypto";
import { query, tx, type Queryable } from "@/lib/db/client";
import { TAKEN_CLAUSE } from "@/lib/ticketing/taken";

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
 * once from lib/ticketing/catalogue.ts and edited from /admin thereafter —
 * which is what lets the club raise a capacity or open a sale at eleven at
 * night without a deploy. Everything above still asks `findTicketingEvent`;
 * the only change is that asking is now something you await.
 *
 * `ticketsSold` is deliberately NOT a column. A number written next to a night
 * is a number that can disagree with the tickets that actually exist, and the
 * first time it does, the club either turns somebody away who paid or lets in
 * more people than the room holds. It is counted, in the same transaction that
 * takes the seats — see `soldFor` and `placeOrder` in lib/ticketing/store.ts. */

export type TicketingEventStatus = "draft" | "on_sale" | "sold_out" | "ended";

export type TicketingEvent = {
  /* Stable and internal — what an order and a ticket are filed under, so that
     renaming a night's slug never orphans a ticket somebody has bought. */
  id: string;
  /* Public, and shared with the poster wall in lib/events.ts. */
  slug: string;
  /* A name is a name: never translated, never restyled. */
  title: string;
  /* When the night is, as an ISO instant. */
  startsAt: string;
  /* When the doors open, when that is not the same thing. */
  doorsAt?: string;
  description?: string;
  /* A path under public/, not an imported asset. */
  image?: string;
  status: TicketingEventStatus;
  /* Entry, in whole dinars. The ONLY place a price is read from: an amount
     that arrived from a browser is never believed. */
  ticketPrice: number;
  currency: "RSD";
  /* How many may be let in. */
  capacity: number;
  /* Most admissions one order may hold — a house rule about touts and
     mistyped quantities, not a statement about stock. */
  maxPerOrder: number;
  /* The window during which the site may take money. Either end may be open. */
  salesStart?: string;
  salesEnd?: string;
  /* True for nights that exist only so the system can be tested. Filtered out
     of every list and refused by every lookup unless dev mode is open, so a
     test night cannot be sold to anybody by accident. */
  testOnly: boolean;
};

/* ── reading ────────────────────────────────────────────────────────────── */

const COLUMNS = `id, slug, title, starts_at, doors_at, description, image, status,
                 ticket_price, currency, capacity, max_per_order,
                 sales_start, sales_end, test_only`;

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
};

/* Adding a night from the office rather than from the catalogue.
 *
 * WHY THIS IS ALLOWED TO EXIST when lib/ticketing/catalogue.ts is where nights
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
         ticket_price, currency, capacity, max_per_order, test_only
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'RSD',$10,$11,false)
       RETURNING ${COLUMNS}`,
      [
        `evt_${randomUUID().slice(0, 8)}`,
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
      ],
    );
    return { ok: true, event: toEvent(result.rows[0]) };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return { ok: false, reason: "slug_taken" };
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const said = String(
    (error as { constraint?: string })?.constraint ??
      (error as { message?: string })?.message ??
      "",
  );
  return /unique|duplicate key/i.test(said);
}

/* ── the rules about a night, which are pure and stay pure ──────────────── */

/* Whether money may be taken for this night, and if not, why not.
 *
 * THE STATUS IS THE CLUB'S DECISION; THE WINDOW AND THE CAPACITY ARE FACTS.
 * All three are checked here and nowhere else, so a purchase route, an admin
 * screen and a webhook can never come to different conclusions.
 *
 * This is a LAST LOOK, not the guarantee. The guarantee that a night cannot
 * oversell is the transaction in `placeOrder`, which locks the event row and
 * counts inside the lock. This is what tells a guest, before they type
 * anything, that there is no point. */
export type SaleState =
  | { open: true }
  | { open: false; reason: "draft" | "ended" | "sold_out" | "too_early" | "too_late" | "no_price" };

export function saleState(
  event: TicketingEvent,
  sold: number,
  now = new Date(),
): SaleState {
  if (event.status === "draft") return { open: false, reason: "draft" };
  if (event.status === "ended") return { open: false, reason: "ended" };
  if (event.status === "sold_out") return { open: false, reason: "sold_out" };

  /* A night whose price nobody has set is a night nobody may buy. Selling
     entry for nothing is not a decision this system is allowed to make on the
     club's behalf. */
  if (event.ticketPrice <= 0) return { open: false, reason: "no_price" };

  if (event.salesStart && now < new Date(event.salesStart)) {
    return { open: false, reason: "too_early" };
  }
  if (event.salesEnd && now > new Date(event.salesEnd)) {
    return { open: false, reason: "too_late" };
  }
  /* The night itself is the last moment a ticket is worth anything. */
  if (now > new Date(event.startsAt) && !event.testOnly) {
    return { open: false, reason: "too_late" };
  }
  if (sold >= event.capacity) return { open: false, reason: "sold_out" };

  return { open: true };
}

/* How many more may go into one order: whatever is left, capped by the house
   rule. Zero means the night is full. */
export function remainingForOrder(event: TicketingEvent, sold: number): number {
  return Math.max(0, Math.min(event.maxPerOrder, event.capacity - sold));
}
