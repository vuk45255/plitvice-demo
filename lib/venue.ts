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
 * One entry, and the geometry is NOT in it. `default` means the room drawn in
 * lib/floor-plan.ts, which is the only floor this club has. A second plan — a
 * summer terrace, a different house — is a second entry here plus a second
 * drawing; nothing that reads a reservation has to learn a new shape, because
 * the id is all any of them carry. */
export type FloorPlanId = "default";

export const FLOOR_PLANS: { id: FloorPlanId; label: string }[] = [
  { id: "default", label: "Osnovni plan kluba" },
];

export const isFloorPlan = (value: string): value is FloorPlanId =>
  FLOOR_PLANS.some((plan) => plan.id === value);

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
