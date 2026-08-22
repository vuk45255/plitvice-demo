import { SEAT_KINDS, type SeatType } from "@/lib/floor-plan";

/* What a given table seats, where the club has settled it table by table.
 *
 * WHY THIS IS NOT IN lib/floor-plan.ts. That file is the editor's output and
 * nothing else: it is pasted there whole by COPY FLOOR PLAN DATA and the
 * exporter writes geometry only, so a capacity written into a seat literal by
 * hand would be wiped the next time the plan came out of the editor — silently,
 * and without changing anything a reviewer would notice. Capacity is not
 * geometry, so it lives out here beside availability, keyed the same way.
 *
 * KEYED BY SEAT ID — the stable key the booking holds, not the number printed
 * on the map. The club may renumber the floor whenever it likes (that is what
 * `display` is for) and these figures must not follow the paint.
 *
 * A table absent from this table seats what its kind seats, per SEAT_KINDS.
 * That is still true of most of the floor.
 *
 * The comment beside a line is the number PRINTED ON THE MAP where it differs
 * from the id — which is how the club reads its own floor, and how this list
 * was given to us. Check a change against the map, not against the key. */
export const SEAT_CAPACITY: Record<string, { min: number; max: number }> = {
  /* Five to seven. */
  S25: { min: 5, max: 7 }, // S02
  S26: { min: 5, max: 7 }, // S03
  S27: { min: 5, max: 7 }, // S04
  S28: { min: 5, max: 7 }, // S05
  S29: { min: 5, max: 7 }, // S06
  S30: { min: 5, max: 7 }, // S07
  S31: { min: 5, max: 7 }, // S08
  S56: { min: 5, max: 7 }, // S32
  S57: { min: 5, max: 7 }, // S34
  S58: { min: 5, max: 7 }, // S40

  /* Four to six. */
  S32: { min: 4, max: 6 }, // S10
  S33: { min: 4, max: 6 }, // S15
  S34: { min: 4, max: 6 }, // S16
  S36: { min: 4, max: 6 }, // S19
  S48: { min: 4, max: 6 }, // S30
  S53: { min: 4, max: 6 }, // S38
  S55: { min: 4, max: 6 }, // S39
  V02: { min: 4, max: 6 },
  V03: { min: 4, max: 6 },
  V04: { min: 4, max: 6 },
  V05: { min: 4, max: 6 },
  V06: { min: 4, max: 6 },
  V07: { min: 4, max: 6 },

  /* Four to five. */
  S12: { min: 4, max: 5 },
  S17: { min: 4, max: 5 }, // S13
  S13: { min: 4, max: 5 }, // S20
  S14: { min: 4, max: 5 }, // S21
  S40: { min: 4, max: 5 }, // S27
  S42: { min: 4, max: 5 }, // S28
  S50: { min: 4, max: 5 }, // S31
  S54: { min: 4, max: 5 }, // S33
  S35: { min: 4, max: 5 },
  S51: { min: 4, max: 5 }, // S36
  S52: { min: 4, max: 5 }, // S37
  S39: { min: 4, max: 5 }, // S48
  S41: { min: 4, max: 5 }, // S49
  V14: { min: 4, max: 5 },
  V18: { min: 4, max: 5 },
  V19: { min: 4, max: 5 },
  V20: { min: 4, max: 5 },
  V21: { min: 4, max: 5 },
  V22: { min: 4, max: 5 },
  V23: { min: 4, max: 5 },
  V24: { min: 4, max: 5 },

  /* Eight to ten — the two large corner separes on the gallery. */
  S03: { min: 8, max: 10 }, // S52
  S08: { min: 8, max: 10 }, // S58
};

/* What this table seats — its own figures where the club has given it any, its
   kind's otherwise. Everything that shows a range or checks one goes through
   here: the map panel, the guest counter and the server's own validation, so
   the three can never come to disagree. */
export function seatCapacity(seat: { id: string; type: SeatType }) {
  return SEAT_CAPACITY[seat.id] ?? SEAT_KINDS[seat.type].capacity;
}
