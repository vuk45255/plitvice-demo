import { seatCapacity } from "@/lib/floor-capacity";
import {
  SEATS,
  seatNumber,
  seatSize,
  type CornerSide,
  type FloorSeat,
  type SeatType,
  type ZoneId,
} from "@/lib/floor-plan";

/* Which tables are already gone, for a given night.
 *
 * THIS IS THE SEAM. Nothing here is geometry and nothing here is permanent:
 * the map in lib/floor-plan.ts describes the room, and this file describes one
 * night in it. Today the answer is a hand-written list; the day the club has a
 * booking system, `reservedSeats` becomes a request to it and not one line of
 * the drawing, the panel or the form changes.
 *
 * Because of that split, a table that is moved does not have to be un-booked,
 * and a night that sells out does not have to be re-drawn. */

/* THE THREE STATES OF A TABLE, and only two of them are permanent.
 *
 *   available — nobody has it
 *   held      — somebody else is filling in the form for it right now. It goes
 *               back to available by itself, within three minutes, and nothing
 *               anywhere has to notice or clean up. Not clickable while it
 *               lasts, and it says nothing about who is holding it.
 *   reserved  — gone. Either the club marked it gone or somebody booked it.
 *
 * A guest never sees "held" on their OWN table: the table they are holding is
 * simply the one they picked, lit as it always was. The split is made on the
 * server against a cookie the browser cannot read — see
 * lib/reservations/holds.ts. */
export type SeatStatus = "available" | "held" | "reserved";

/* MOCK DATA — stand-in until the club's bookings are readable.
 *
 * Keyed by event slug so two nights can differ, which is the shape the real
 * answer will have. A night that is not listed has a whole free floor. */
const RESERVED: Record<string, string[]> = {
  "vodka-experience": [
    "B03",
    "B04",
    "B18",
    "B22",
    "B27",
    "B28",
    "B44",
    "B55",
    "B63",
    "V02",
    "V06",
    "S04",
    "S13",
    "S20",
    "S26",
    "S33",
  ],
};

/* One selectable position, with everything a guest is told about it: where it
   is, what it is, how many it holds and whether it can still be had. This is
   what the drawing, the tooltip and the panel all read. */
export type Seat = {
  id: string;
  /* The number on the map and in the panel — B12, V04, S07. Resolved once
     here, so nothing downstream has to remember that a table may be called
     something other than its id. */
  display: string;
  type: SeatType;
  zone: ZoneId;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  /* Set only on an L-shaped separe; see cornerPath in lib/floor-plan.ts. */
  corner?: CornerSide;
  depth?: number;
  capacity: { min: number; max: number };
  status: SeatStatus;
};

export function reservedSeats(eventSlug: string): ReadonlySet<string> {
  return new Set(RESERVED[eventSlug] ?? []);
}

/* WHAT THE SERVER SAYS THE FLOOR LOOKS LIKE THIS SECOND — the shape
   /api/reservations/availability answers in. "mine" is the asking guest's own
   hold and is deliberately not part of "held": their table is theirs, not a
   table they are locked out of. */
export type FloorSnapshot = {
  reserved: string[];
  held: string[];
  mine: string[];
};

/* The night's floor with a live snapshot laid over it.
 *
 * THE DRAWING IS UNTOUCHED. Nothing here moves a table, renames one or changes
 * what it seats — it decides one field, and that field is what colour the
 * table is drawn in. Reserved beats held, because a table that has been booked
 * is not coming back in a hundred and eighty seconds.
 *
 * The same seat objects are handed back where nothing about them changed, so a
 * poll that finds the floor exactly as it was costs React nothing. */
export function applySnapshot(seats: Seat[], snapshot: FloorSnapshot | undefined): Seat[] {
  if (!snapshot) return seats;

  const reserved = new Set(snapshot.reserved);
  const held = new Set(snapshot.held);

  return seats.map((seat) => {
    const status: SeatStatus = reserved.has(seat.id)
      ? "reserved"
      : held.has(seat.id)
        ? "held"
        : "available";
    return status === seat.status ? seat : { ...seat, status };
  });
}

function resolve(seat: FloorSeat, taken: ReadonlySet<string>): Seat {
  const { w, h } = seatSize(seat);
  return {
    id: seat.id,
    display: seatNumber(seat),
    type: seat.type,
    zone: seat.zone,
    x: seat.x,
    y: seat.y,
    w,
    h,
    rotation: seat.rotation ?? 0,
    corner: seat.corner,
    depth: seat.depth,
    capacity: seatCapacity(seat),
    status: taken.has(seat.id) ? "reserved" : "available",
  };
}

/* The floor as it stands for one night. */
export function seatsForEvent(eventSlug: string): Seat[] {
  const taken = reservedSeats(eventSlug);
  return SEATS.map((seat) => resolve(seat, taken));
}

export function findSeat(seats: Seat[], id: string | undefined) {
  if (!id) return undefined;
  return seats.find((seat) => seat.id === id);
}
