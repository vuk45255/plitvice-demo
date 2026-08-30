/* THE HOUSE ITSELF — one seam, and deliberately almost nothing behind it.
 *
 * ═══ WHY THIS FILE EXISTS AT ALL ══════════════════════════════════════════
 *
 * This system runs one club. It is going to be asked to run a second, and the
 * expensive way to find that out is to discover that "Plitvice" is written into
 * forty components, that every `events` row is implicitly the same venue, and
 * that adding a second one means a migration across live ticket data.
 *
 * So there is a venue, it has an id, and every event row carries it. That is
 * the whole of it. There is NO tenant resolution, no venue switcher, no
 * per-request scoping and no venue table — because a multi-tenancy layer built
 * before there is a second tenant is a guess about a customer nobody has met,
 * and guesses are more expensive to remove than to add.
 *
 * WHAT THIS BUYS. The day there is a second house: the rows already say which
 * club they belong to, `VENUES` grows a second entry, and the work is scoping
 * queries and choosing a venue — not backfilling a column on a table that
 * tickets and money point at.
 *
 * WHAT MUST NOT HAPPEN HERE. This file describes a venue as a name, a floor and
 * a timezone. It does not hold copy, colours, or anything a page renders as
 * design — the club's identity lives in the site, and the office's in
 * admin.css. A venue is an operational fact, not a theme. */

export type VenueId = string;

export type Venue = {
  id: VenueId;
  /* What staff see written on a screen. Never translated — it is a name. */
  name: string;
  /* The clock the club's own day is read in. Every instant in the database is
     a `timestamptz`; this is the zone a wall-clock reading is written and read
     in — see `belgradeInstant` in lib/ticketing/copy.ts, which is where the
     conversion actually happens today. */
  timeZone: string;
  /* Which drawing of a room this house books tables on. One floor, one plan,
     and the plan itself is lib/floor-plan.ts — this names it, it does not
     describe it. */
  defaultFloorPlan: FloorPlanId;
};

/* THE PLANS A NIGHT MAY BE BOOKED ON.
 *
 * The geometry is NOT in here. An id names a drawing; lib/floor-plan.ts is the
 * drawing. Nothing that reads a reservation has to learn a new shape, because
 * the id is all any of them carry.
 *
 * ═══ THE CLUB HAS ONE FLOOR TODAY AND WILL HAVE TWO ═══════════════════════
 *
 * `default` is the room that exists — the one drawn in lib/floor-plan.ts, the
 * one every current reservation is against — and it is now shown as 1 NIVO.
 * The id stays `default` and is deliberately NOT renamed: it is written on
 * every event row in the database, and renaming a stored value to improve a
 * label is a migration with nothing to gain from it.
 *
 * `level2` and `both` are declared because the club is going to have an upstairs
 * and the type should be ready for it. They are NOT selectable, and that is
 * the whole point of `ready`: a plan is offered only when there is a drawing
 * behind it. There are no level-two tables in lib/floor-plan.ts, so offering
 * the option would let somebody file a Saturday against a room that does not
 * exist and open bookings onto an empty map.
 *
 * ═══ WHAT ADDING THE SECOND FLOOR ACTUALLY TAKES ══════════════════════════
 *
 * Draw it in lib/floor-plan.ts keyed by plan, flip `ready` here, and the
 * selector, the validator and every screen that renders a label follow without
 * being touched. That is the entire reason this is a table and not a union of
 * strings scattered through the UI. */
export type FloorPlanId = "default" | "level2" | "both";

export type FloorPlan = {
  id: FloorPlanId;
  label: string;
  /* Whether a drawing exists for it. False means the option is shown as
     coming and cannot be chosen — never hidden, because a club owner who is
     told the upstairs is coming does not ring up asking where it is. */
  ready: boolean;
};

export const FLOOR_PLANS: FloorPlan[] = [
  { id: "default", label: "1 nivo", ready: true },
  { id: "level2", label: "2 nivo", ready: false },
  { id: "both", label: "Zajedno", ready: false },
];

/* A VALID PLAN IS A PLAN WE CAN ACTUALLY DRAW. This is what a form's value is
   checked against, and it is deliberately stricter than "is a known id": a
   posted `level2` is refused today exactly as `nonsense` is, because the
   server must not accept a room it cannot render. When the upstairs is drawn,
   flipping `ready` opens both at once. */
export const isFloorPlan = (value: string): value is FloorPlanId =>
  FLOOR_PLANS.some((plan) => plan.id === value && plan.ready);

/* Every id the type knows, ready or not — for a screen that wants to LIST the
   plans including the ones that are coming. */
export const isKnownFloorPlan = (value: string): value is FloorPlanId =>
  FLOOR_PLANS.some((plan) => plan.id === value);

export const floorPlanLabel = (id: string): string =>
  FLOOR_PLANS.find((plan) => plan.id === id)?.label ?? id;

/* The one house, today. */
export const PLITVICE: Venue = {
  id: "plitvice",
  name: "Plitvice Club",
  timeZone: "Europe/Belgrade",
  defaultFloorPlan: "default",
};

const VENUES: Record<VenueId, Venue> = { [PLITVICE.id]: PLITVICE };

/* Which venue this deployment is running. An environment variable rather than
   a constant, so a second house is a second deployment before it is ever a
   second tenant — the cheapest possible version of the next step. */
export function currentVenue(): Venue {
  const asked = process.env.VENUE_ID?.trim();
  return (asked && VENUES[asked]) || PLITVICE;
}

export function findVenue(id: VenueId | undefined): Venue | undefined {
  return id ? VENUES[id] : undefined;
}

export function venueName(id: VenueId | undefined): string {
  return findVenue(id)?.name ?? currentVenue().name;
}
