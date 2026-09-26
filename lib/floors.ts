import type { MessageKey } from "@/lib/i18n";
import {
  ARROWS,
  LABELS,
  PASSAGES,
  ROOMS,
  SEATS,
  SPIRALS,
  STRUCTURES,
  REFERENCE_IMAGE,
  ZONE_MARKS,
  seatNumber,
  type FloorSeat,
  type PlanArrow,
  type PlanLabel,
  type PlanPassage,
  type PlanRoom,
  type PlanSpiral,
  type PlanStructure,
  type PlanZoneMark,
} from "@/lib/floor-plan";
import {
  ARROWS_L2,
  LABELS_L2,
  PASSAGES_L2,
  ROOMS_L2,
  SEATS_L2,
  SPIRALS_L2,
  STRUCTURES_L2,
  ZONE_MARKS_L2,
} from "@/lib/floor-plan-nivo2";

/* THE CLUB HAS TWO FLOORS, AND THIS IS THE ONLY FILE THAT KNOWS IT.
 *
 * ═══ WHY THE TWO PLANS ARE SEPARATE FILES ═════════════════════════════════
 *
 * lib/floor-plan.ts is the first floor AND it is the output of
 * /floor-plan-editor: COPY FLOOR PLAN DATA replaces its arrays wholesale, and
 * a second floor written into them would be deleted on the next round trip
 * without a single thing looking wrong. So the second floor is its own module,
 * lib/floor-plan-nivo2.ts, in the same coordinate frame and the same types, and
 * the two are put side by side here.
 *
 * WHICH MEANS lib/floor-plan.ts IS UNTOUCHED BY THE SECOND FLOOR, and must
 * stay that way. Its `SEATS` is the first floor and nothing else.
 *
 * ═══ ALL_SEATS IS THE REGISTRY ════════════════════════════════════════════
 *
 * Everything that resolves a booking's table — the hold, the reservation, the
 * office, the confirmation mail — looks a seat id up in ONE list, and that list
 * is `ALL_SEATS`. Importing `SEATS` from lib/floor-plan.ts on that path would
 * silently make the second floor unbookable rather than fail, which is exactly
 * the kind of bug that only shows up on a Friday night.
 *
 * ═══ THE ID IS THE FLOOR ══════════════════════════════════════════════════
 *
 * A second-floor table's id begins `L2-`; a first-floor one never does. That
 * one rule is why NO DATABASE MIGRATION was needed to add a floor: `seat_id` is
 * already the canonical key a reservation and a hold are filed under, it is
 * already unique across the building, and every guarantee in lib/db/schema.ts —
 * one live booking per table, one live hold per table — holds across both
 * floors unchanged. A floor column would be a second copy of a fact the id
 * already carries, and two copies of a fact is how they come to disagree.
 *
 * ZONES, THOUGH, ARE PER FLOOR. Both levels number their halls 1, 2, 3 —
 * because the club does. A zone is therefore never shown on its own: it is
 * always read with its level, which is what `floorLabel` exists for.
 *
 * ═══ A LEVEL EXISTS WHEN IT HAS BEEN DRAWN ════════════════════════════════
 *
 * There is no flag anywhere saying whether the upstairs is open, and there
 * must not be one. A level is offered exactly when its plan has tables in it —
 * see `availableFloors` at the foot of this file. An undrawn floor has no
 * tables, so no map offers it, no guest can pick one and the reservation
 * system has nothing to refuse. Drawing the floor in /floor-plan-editor and
 * pasting the export into lib/floor-plan-nivo2.ts is the whole of turning it
 * on. */

export type FloorId = 1 | 2;

export const FLOORS: readonly FloorId[] = [1, 2] as const;

export const FLOOR_LABELS: Record<FloorId, MessageKey> = {
  1: "floor.level1",
  2: "floor.level2",
};

/* The prefix that marks a table as being upstairs. It is part of the id and
   therefore part of every row already written; it does not change. */
const L2_PREFIX = "L2-";

/* What the editor puts in front of a new table's id on each level. THE GROUND
   FLOOR HAS NO PREFIX AND NEVER WILL: every booking ever taken is filed under
   an unprefixed id, and giving the first floor one now would orphan all of
   them. The upstairs is namespaced from its very first table instead. */
export function seatIdPrefix(floor: FloorId): string {
  return floor === 2 ? L2_PREFIX : "";
}

/* Which floor a table stands on, from its id alone — so a reservation read
   back out of the database can be placed on a floor without a lookup. */
export function floorOfSeatId(seatId: string): FloorId {
  return seatId.startsWith(L2_PREFIX) ? 2 : 1;
}

export function isFloorId(value: unknown): value is FloorId {
  return value === 1 || value === 2;
}

/* Every selectable position in the building, both floors, first floor first.
   THE ORDER MATTERS to nothing except the office's table select, and it is the
   order the club reads its own building in. */
export const ALL_SEATS: readonly FloorSeat[] = [...SEATS, ...SEATS_L2];

const BY_ID = new Map(ALL_SEATS.map((seat) => [seat.id, seat]));

/* The one lookup. A Map rather than a scan, because the office's floor state
   resolves every table on both floors on every poll. */
export function seatById(id: string): FloorSeat | undefined {
  return BY_ID.get(id);
}

/* A table's name off the map — in a mail, a list, anywhere the level is not
   already on screen. Both floors number their tables from 1, so an upstairs
   number is never said without its level: "Nivo 2 · S04". The ground floor is
   named exactly as it always has been. */
export function seatLabel(seat: FloorSeat): string {
  return floorOfSeatId(seat.id) === 2
    ? `Nivo 2 · ${seatNumber(seat)}`
    : seatNumber(seat);
}

export function seatsOnFloor(floor: FloorId): FloorSeat[] {
  return ALL_SEATS.filter((seat) => floorOfSeatId(seat.id) === floor);
}

/* The room a floor is drawn in — the same seven arrays `PlanArchitecture`
   reads, so one drawing serves both levels and the office's map and the
   guest's map all four combinations of them. */
export type FloorArchitecture = {
  arrows: PlanArrow[];
  zoneMarks: PlanZoneMark[];
  rooms: PlanRoom[];
  structures: PlanStructure[];
  spirals: PlanSpiral[];
  passages: PlanPassage[];
  labels: PlanLabel[];
};

const ARCHITECTURE: Record<FloorId, FloorArchitecture> = {
  1: {
    arrows: ARROWS,
    zoneMarks: ZONE_MARKS,
    rooms: ROOMS,
    structures: STRUCTURES,
    spirals: SPIRALS,
    passages: PASSAGES,
    labels: LABELS,
  },
  2: {
    arrows: ARROWS_L2,
    zoneMarks: ZONE_MARKS_L2,
    rooms: ROOMS_L2,
    structures: STRUCTURES_L2,
    spirals: SPIRALS_L2,
    passages: PASSAGES_L2,
    labels: LABELS_L2,
  },
};

export function architectureFor(floor: FloorId): FloorArchitecture {
  return ARCHITECTURE[floor];
}

/* Where a phone opens the map on each floor. The whole club does not fit on a
   phone at a size worth tapping, so it opens part-way in, over the part of the
   level the room reads from — the stage on the first floor, the middle hall on
   the second. The frame control gets the guest back out to all of it. */
export const FLOOR_PHONE_OPEN: Record<FloorId, { scale: number; at: { x: number; y: number } }> = {
  1: { scale: 2.1, at: { x: 600, y: 340 } },
  2: { scale: 1.9, at: { x: 760, y: 560 } },
};

/* ── WHICH LEVELS THE CLUB ACTUALLY HAS ───────────────────────────────────
 *
 * The levels with a drawing behind them, in order. Today that is the ground
 * floor always, and the upstairs as soon as somebody has drawn a table on it.
 *
 * BOTH MAPS ASK THIS, and it is what decides whether a level switch appears at
 * all — a switch with one button is furniture in the way of a map. It is also
 * why nothing needed a feature flag: the drawing is the flag.
 *
 * Computed once at module load, because the plans are constants. */
export const AVAILABLE_FLOORS: readonly FloorId[] = FLOORS.filter(
  (floor) => seatsOnFloor(floor).length > 0,
);

/* Never an empty list: the club has a ground floor whatever the data says. */
export function availableFloors(): FloorId[] {
  return AVAILABLE_FLOORS.length > 0 ? [...AVAILABLE_FLOORS] : [1];
}

/* ── THE PAPER UNDER THE CANVAS ───────────────────────────────────────────
 *
 * The house's own drawing of each level, laid under the editor at exactly the
 * plan's viewBox so a layout can be traced over it. This is how the first
 * floor was drawn and it is how the second one is meant to be drawn: the
 * photograph is a tracing reference for whoever is working, and nothing in the
 * application reads it or places anything from it.
 *
 * DEVELOPMENT ONLY. /floor-plan-editor refuses to render outside development,
 * and public/reference/ is deleted before shipping — see the note over
 * SHOW_REFERENCE_OVERLAY in lib/floor-plan.ts. */
export const FLOOR_REFERENCE: Record<FloorId, string> = {
  1: REFERENCE_IMAGE,
  2: "/reference/2-sprat.jpg",
};
