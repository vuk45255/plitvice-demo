/* TWO LEVELS, ONE EDITOR, ONE RESERVATION SYSTEM.
 *
 * The second floor is not drawn yet — it is drawn by hand at
 * /floor-plan-editor, level by level, exactly as the first one was. So what
 * this file can be sure of is not where any table stands. It is the three
 * things that have to be true before anybody starts drawing, and that would be
 * expensive to discover afterwards:
 *
 *   · the first floor is untouched — same tables, same ids, same order;
 *   · a table drawn upstairs is given an id that cannot collide with one
 *     downstairs, so the hold, the reservation and the unique indexes keep
 *     working without knowing floors exist at all;
 *   · a level is offered exactly when it has been drawn, so an empty upstairs
 *     is invisible rather than bookable.
 *
 * Run with `npm test`. Nothing is mocked. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEATS, seatNumber } from "@/lib/floor-plan";
import { SEATS_L2 } from "@/lib/floor-plan-nivo2";
import { seatCapacity } from "@/lib/floor-capacity";
import {
  ALL_SEATS,
  FLOORS,
  architectureFor,
  availableFloors,
  floorOfSeatId,
  seatById,
  seatIdPrefix,
  seatLabel,
  seatsOnFloor,
} from "@/lib/floors";
import {
  loadDoc,
  nextSeatId,
  seatsOf,
  serializeDoc,
  withZoneMarks,
  type EditorDoc,
  type EditorSeat,
} from "@/components/floor-plan/editor/editor-doc";

/* ── the first floor is exactly where it was ─────────────────────────────── */

describe("the ground floor after adding a second one", () => {
  it("keeps every table, in order, unaltered", () => {
    /* The guard on the whole change. `SEATS` in lib/floor-plan.ts is the first
       floor and nothing else, and the building's registry opens with it. */
    assert.deepEqual(ALL_SEATS.slice(0, SEATS.length), SEATS);
    assert.equal(ALL_SEATS.length, SEATS.length + SEATS_L2.length);
    assert.deepEqual(seatsOnFloor(1), SEATS);
  });

  it("gives its tables no prefix, now or ever", () => {
    /* Every booking the club has ever taken is filed under an unprefixed seat
       id. Namespacing the ground floor would orphan all of them. */
    assert.equal(seatIdPrefix(1), "");
    for (const seat of SEATS) assert.equal(floorOfSeatId(seat.id), 1, seat.id);
  });

  it("opens in the editor exactly as the file describes it", () => {
    const doc = loadDoc(1);
    const drawn = seatsOf(doc).map((s) => s.id);
    assert.deepEqual(drawn, SEATS.map((s) => s.id));
  });
});

/* ── the upstairs, as the club drew it ───────────────────────────────────── */

describe("the second floor, drawn", () => {
  it("holds every table drawn on it, and every one of them is upstairs", () => {
    /* 142 at the final export of the hand-drawn plan: 58 separes, 76 bar
       tables, 8 high tables. */
    assert.equal(SEATS_L2.length, 142);
    assert.deepEqual(seatsOnFloor(2), SEATS_L2);
    for (const seat of SEATS_L2) assert.equal(floorOfSeatId(seat.id), 2, seat.id);
  });

  it("is offered on both maps, because a level exists when it has tables", () => {
    /* No flag decides this. The drawing is the flag. */
    assert.deepEqual(availableFloors(), [1, 2]);
  });

  it("opens in the editor exactly as the file describes it", () => {
    const doc = withZoneMarks(loadDoc(2), 2);
    assert.deepEqual(
      seatsOf(doc).map((s) => s.id),
      SEATS_L2.map((s) => s.id),
    );
  });

  it("is drawn in its own room, sharing nothing with the ground floor", () => {
    const one = architectureFor(1);
    const two = architectureFor(2);
    assert.ok(one.rooms.length > 0, "the ground floor has walls");
    assert.ok(two.rooms.length > 0, "the upstairs has walls");
    assert.ok(!two.rooms.some((room) => one.rooms.includes(room)));
    assert.ok(!two.labels.some((label) => one.labels.includes(label)));
  });
});

/* ── what the editor will hand a table drawn upstairs ────────────────────── */

describe("drawing a table on the second floor", () => {
  /* The editor's own act of adding a table, without the editor: a document for
     that level, and the id it would be given. */
  const idFor = (doc: EditorDoc, type: EditorSeat["type"], floor: 1 | 2) =>
    nextSeatId(doc, type, floor);

  it("namespaces its id so it cannot be a ground-floor table", () => {
    const upstairs = loadDoc(2);
    assert.equal(seatIdPrefix(2), "L2-");
    /* The next of each kind, after everything already drawn up there. */
    for (const [type, letter] of [["bar", "B"], ["booth", "S"], ["high", "V"]] as const) {
      const id = idFor(upstairs, type, 2);
      assert.match(id, new RegExp(`^L2-${letter}\\d+$`));
      assert.ok(!SEATS_L2.some((s) => s.id === id), `${id} is already drawn`);
    }

    /* And the ground floor is numbered as it always has been. */
    assert.ok(!idFor(loadDoc(1), "bar", 1).startsWith("L2-"));
  });

  it("is read back as a second-floor table by the booking system", () => {
    assert.equal(floorOfSeatId("L2-B01"), 2);
    assert.equal(floorOfSeatId("L2-S07"), 2);
    /* Which is the entire reason no database migration was needed: `seat_id`
       already carries the floor, and it is already the key every hold and
       every reservation is filed under. */
    assert.equal(floorOfSeatId("B01"), 1);
  });

  it("cannot be handed an id that a ground-floor table already answers to", () => {
    const upstairs = loadDoc(2);
    const proposed = new Set<string>();
    for (const type of ["bar", "high", "booth"] as const) {
      proposed.add(idFor(upstairs, type, 2));
    }
    for (const id of proposed) {
      assert.equal(seatById(id), undefined, `${id} must be free`);
      assert.ok(!SEATS.some((s) => s.id === id || seatNumber(s) === id));
    }
  });

  it("goes back into the second floor's own file, under its own names", () => {
    /* The round trip is the same one the ground floor has always used — the
       editor prints TypeScript and it is pasted back — and the suffix is what
       stops a paste into the wrong file being a silent floor swap. */
    const printed = serializeDoc(loadDoc(2), 2);
    assert.match(printed, /lib\/floor-plan-nivo2\.ts/);
    assert.match(printed, /export const SEATS_L2: FloorSeat\[\]/);
    assert.match(printed, /export const ROOMS_L2: PlanRoom\[\]/);

    const ground = serializeDoc(loadDoc(1), 1);
    assert.match(ground, /lib\/floor-plan\.ts/);
    assert.match(ground, /export const SEATS: FloorSeat\[\]/);
    assert.ok(!/SEATS_L2/.test(ground), "the ground floor keeps the bare names");
  });
});

/* ── the building, however many levels it has ────────────────────────────── */

describe("the building as one registry", () => {
  it("never lets an id or a printed number mean two tables", () => {
    const ids = ALL_SEATS.map((seat) => seat.id);
    assert.equal(new Set(ids).size, ids.length, "seat ids must be unique");

    /* Both levels number from 1, so a printed number is unique on its own
       floor, and a table's full name — with its level when upstairs — is
       unique across the building. */
    for (const floor of FLOORS) {
      const numbers = seatsOnFloor(floor).map(seatNumber);
      assert.equal(new Set(numbers).size, numbers.length, `numbers on ${floor}`);
    }
    const names = ALL_SEATS.map(seatLabel);
    assert.equal(new Set(names).size, names.length, "names must be unique");
  });

  it("never prints the upstairs namespace to anybody", () => {
    for (const seat of SEATS_L2) {
      assert.ok(!seatNumber(seat).startsWith("L2-"), seat.id);
      assert.equal(seatLabel(seat), `Nivo 2 · ${seat.id.slice(3)}`);
    }
    /* and the ground floor is named exactly as before */
    for (const seat of SEATS) assert.equal(seatLabel(seat), seatNumber(seat));
  });

  it("splits into levels and loses nothing", () => {
    const drawn = FLOORS.flatMap((floor) => seatsOnFloor(floor));
    assert.equal(drawn.length, ALL_SEATS.length);
  });

  it("can say what every table in it seats", () => {
    for (const seat of ALL_SEATS) {
      const { min, max } = seatCapacity(seat);
      assert.ok(min > 0 && max >= min, `${seat.id} seats ${min}-${max}`);
    }
  });
});
