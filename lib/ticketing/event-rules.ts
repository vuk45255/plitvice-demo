import type { FloorPlanId, VenueId } from "@/lib/venue";

/* WHAT A NIGHT IS, AND THE RULES ABOUT IT THAT ARE PURE.
 *
 * ═══ WHY THIS IS A SEPARATE FILE FROM lib/ticketing/events.ts ═════════════
 *
 * That file is the one writer of the `events` table, so the first thing it
 * does is import `lib/db/client` — and through it `pg`. A CLIENT COMPONENT
 * THAT IMPORTS ANYTHING FROM IT THEREFORE DRAGS A POSTGRES DRIVER INTO THE
 * BROWSER BUNDLE, and the build refuses it outright (`pg` needs `util/types`,
 * which does not exist in a browser). The refusal is the correct outcome; the
 * mistake is asking.
 *
 * A type is erased at compile time and never causes this. A VALUE does: the
 * office list renders `ACTION_LABELS` from lib/club/event-manager.ts, that
 * module needs `saleState`, and `saleState` used to live next to the SQL. One
 * label pulled in the driver.
 *
 * So the shape of a night and the three rules that are arithmetic over that
 * shape live here, where there is nothing to import but `lib/venue`. Every
 * one of them is a pure function of a row and a number: no database, no
 * clock it does not take as an argument, no environment.
 *
 * NOTHING MOVED FOR ANYBODY WHO WAS ALREADY USING IT. lib/ticketing/events.ts
 * re-exports all of this, so every existing import of `TicketingEvent`,
 * `saleState` or `remainingForOrder` from there still resolves and still means
 * the same thing. Server code should keep importing from there; only code that
 * may end up in a browser bundle needs to name this file. */
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

  /* ═══ WHAT THE EVENT MANAGER ADDED ═══════════════════════════════════════
   *
   * All of it hangs off THIS row, because a night is one thing. Every field
   * below is optional or has a default that reproduces exactly what this
   * system did before the field existed — a row written by the seed or by
   * last month's deploy reads back identically.
   *
   * NOTE WHAT IS STILL NOT HERE. No geometry: `floorPlan` names a drawing,
   * lib/floor-plan.ts is the drawing. No ticket-tier rows: see `eventTiers`
   * in lib/club/event-manager.ts for where those go when there are several. No
   * poster bytes: `image` is a URL and lib/media is what put it there. */

  /* Which house. One value today; see lib/venue.ts for why it is a column. */
  venueId: VenueId;
  /* Whether this night sells entry online at all — as against `status`, which
     says how that sale is going. A night with a free door has this false and
     is still a complete night. */
  ticketingEnabled: boolean;
  /* Whether this night takes tables, and on which drawing of the room. */
  tablesEnabled: boolean;
  floorPlan: FloorPlanId;
  /* The key the poster is filed under in the object store, when it came from
     one. Kept so a replaced poster can be deleted instead of orphaned; absent
     on a poster that was typed in as a path. `image` is the URL. */
  posterKey?: string;
  /* What the night is, for whoever is reading a poster. All optional. */
  lineup?: string;
  genre?: string;
  ageRestriction?: string;
  entryNote?: string;
  dressCode?: string;
  promotion?: string;
  /* Off every working list, with its history intact. Never deleted. */
  archivedAt?: string;
};
/* ── when a night is over ───────────────────────────────────────────────── */

/* HOW LONG A CLUB NIGHT LASTS ONCE IT HAS STARTED, AND WHY THAT IS A NUMBER.
 *
 * ═══ THE BUG THIS EXISTS TO REMOVE ════════════════════════════════════════
 *
 * A night used to be over the instant `startsAt` passed. So at 22:00 on the
 * Saturday, with the doors open and the room filling, the office filed the
 * night under ZAVRŠENI, the sale badge said "prodaja zatvorena", the public
 * wall moved the poster into the archive, and the reservation gate refused
 * every table with reason "past" — all while the club was still working. The
 * start of a night is the WORST possible moment to call it finished; it is the
 * moment it begins.
 *
 * ═══ THE RULE, AND WHY IT IS THIS ONE ═════════════════════════════════════
 *
 * There is no `ends_at` column, and this is deliberately not the change that
 * adds one — a column means a form field, a validation rule and a decision the
 * club has to make for every night for ever. What the club actually has is one
 * shape of evening: doors at ten, lights up at five. So a night ends a FIXED
 * SEVEN HOURS after it starts, and 22:00 → 05:00 is exactly that evening.
 *
 * It is elapsed time on two instants, never wall-clock arithmetic, so it is
 * the same seven hours on the night the clocks change. Every timestamp in this
 * system is a `timestamptz` and every comparison here is between instants;
 * Europe/Belgrade enters only where a human reads one (lib/ticketing/copy.ts).
 *
 * ═══ ONE ANSWER, SIX CALLERS ══════════════════════════════════════════════
 *
 * The office's grouping, the control centre's "tonight", the sale gate, the
 * public wall and the two table gates all ask THIS function. That is the whole point: a night cannot be over
 * for the guest and still running for the doorman, and it used to be able to
 * be — each of those places had its own copy of `startsAt < now`.
 *
 * THE SEAM, IF A NIGHT EVER NEEDS ITS OWN END. This function is where an
 * `ends_at` column would be read, and nothing above it would change. */
export const NIGHT_LENGTH_HOURS = 7;

/* When this night is over, as an instant. Derived today; a stored end time
   would be returned from here instead and nothing else would move. */
export function eventEndsAt(event: TicketingEvent): string {
  return new Date(
    Date.parse(event.startsAt) + NIGHT_LENGTH_HOURS * 60 * 60 * 1000,
  ).toISOString();
}

/* Whether the evening has actually gone. NOT whether the club has closed it —
   that is `status === "ended"`, a decision rather than a clock, and callers
   combine the two exactly as they did before. */
export function hasEnded(event: TicketingEvent, now: Date = new Date()): boolean {
  return now >= new Date(eventEndsAt(event));
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
  | {
      open: false;
      reason:
        | "no_sale"
        | "draft"
        | "ended"
        | "sold_out"
        | "too_early"
        | "too_late"
        | "no_price";
    };

export function saleState(
  event: TicketingEvent,
  sold: number,
  now = new Date(),
): SaleState {
  /* A NIGHT THAT DOES NOT SELL ENTRY ONLINE IS CHECKED FIRST, because it is
     not a night that failed to open a sale — it is a night with a door price
     and no sale to open, and calling that "draft" would be a lie to whoever
     is reading the reason. The column defaults to true, so every row written
     before it existed still sells exactly as it did.

     THIS IS THE GATE, not the office screen that draws the switch: it is
     `createOrder` that asks `saleState`, so turning the switch off actually
     stops a checkout rather than only hiding a button. */
  if (!event.ticketingEnabled) return { open: false, reason: "no_sale" };
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
  /* THE END OF THE NIGHT IS THE LAST MOMENT A TICKET IS WORTH ANYTHING —
     not the start of it. A guest walking up at half past midnight is a guest
     the club wants to sell to, and until now the site told them the sale was
     shut. A club that wants the sale to stop earlier says so with `salesEnd`,
     which is checked immediately above and is the club's own decision.

     Test nights keep selling whatever their date says, as they always have:
     a fixture with a date in the past is how a laptop has something to sell. */
  if (hasEnded(event, now) && !event.testOnly) {
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
