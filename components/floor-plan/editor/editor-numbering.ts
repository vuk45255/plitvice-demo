import { SEAT_PREFIX, type SeatType, type ZoneId } from "@/lib/floor-plan";
import {
  numberOf,
  seatsOf,
  type EditorDoc,
  type EditorSeat,
} from "@/components/floor-plan/editor/editor-doc";

/* What the club calls its tables.
 *
 * THREE SEQUENCES, ONE BUILDING. A bar table is a B, a high table a V
 * (visoki), a separe an S, and each letter counts on its own — B01 and S01 are
 * different tables in different corners, and neither has anything to do with
 * the other. Within a letter the count runs through the whole club rather than
 * restarting per hall: zone 1 takes the lowest numbers, then zone 2, then
 * zone 3, and the gallery takes the highest. A guest reading B93 off a table
 * knows, without a legend, that they are a long way from the door.
 *
 * NOTHING IN HERE RUNS ON ITS OWN. It is called by RENUMBER TABLES and by
 * nothing else — not on load, not on save, and above all not while geometry is
 * being dragged about. A table number that changed every time the table beside
 * it was nudged would be useless to the club and worse than useless to us: the
 * point of a number is that it is the same number tomorrow.
 *
 * WHAT IS DELIBERATELY NOT TOUCHED. A seat's `id` is the key the booking holds
 * and is never rewritten here; only `display` — what the map prints — is. And
 * a seat with `autoNumber: false` is left exactly as it is, because somebody
 * typed that number on purpose. Its number is still counted as taken, so the
 * sweep steps over it rather than issuing it twice. */

export type RenumberScope = "all" | SeatType;

/* How far apart two tables can sit vertically and still be read as one row.
 *
 * The drawing's rows lean — the top wall of the first hall rises thirty pixels
 * across its length and the row beneath it rises with the wall — so a row is a
 * band rather than a line, and the band has to be wider than the lean or a row
 * breaks in half at the point where it has drifted too far.
 *
 * Thirty-two is the number the club's own drawing asks for: at that width the
 * sweep reproduces the hand numbering of the first hall exactly, B01–B11 along
 * the top wall and B12–B21 across the row set between them. Narrower and the
 * top row splits; wider and the second row starts being pulled into the first.
 *
 * It is stated here and offered in the renumber panel, because a differently
 * drawn hall will want a different figure — and because the day the club wants
 * numbering to run down the columns instead, this is where that begins. */
export const ROW_BAND = 32;

const ZONES: ZoneId[] = [1, 2, 3, 4];

/* Reading order within one zone: down the room, and left to right across each
   row it finds on the way. Bands are grown from the topmost table not yet
   placed, so a row that leans stays one row. */
export function spatialOrder(seats: EditorSeat[], band: number): EditorSeat[] {
  const byY = [...seats].sort((a, z) => a.y - z.y || a.x - z.x);
  const out: EditorSeat[] = [];
  let row: EditorSeat[] = [];
  let top = Number.NaN;

  const flush = () => {
    row.sort((a, z) => a.x - z.x || a.y - z.y);
    out.push(...row);
    row = [];
  };

  for (const seat of byY) {
    if (row.length === 0) {
      top = seat.y;
    } else if (seat.y - top > band) {
      flush();
      top = seat.y;
    }
    row.push(seat);
  }
  flush();
  return out;
}

/* Every number of this letter that somebody has claimed by hand. */
function reserved(doc: EditorDoc, type: SeatType): Set<number> {
  const prefix = SEAT_PREFIX[type];
  const out = new Set<number>();
  for (const seat of seatsOf(doc)) {
    if (seat.autoNumber !== false) continue;
    const name = numberOf(seat);
    if (!name.startsWith(prefix)) continue;
    const n = Number(name.slice(prefix.length));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

/* The numbers one letter would be given, in the order they would be given —
   the same walk RENUMBER makes, without changing anything. What the editor
   shows in its preview line. */
export function renumberPlan(
  doc: EditorDoc,
  type: SeatType,
  band = ROW_BAND,
): { seat: EditorSeat; number: string }[] {
  const prefix = SEAT_PREFIX[type];
  const taken = reserved(doc, type);
  const plan: { seat: EditorSeat; number: string }[] = [];
  let n = 0;

  for (const zone of ZONES) {
    const here = seatsOf(doc).filter(
      (s) => s.type === type && s.zone === zone && s.autoNumber !== false,
    );
    for (const seat of spatialOrder(here, band)) {
      do n++;
      while (taken.has(n));
      plan.push({ seat, number: `${prefix}${String(n).padStart(2, "0")}` });
    }
  }
  return plan;
}

/* Hand out the numbers. Only `display` moves; ids, positions and everything
   else about a table are left exactly where they were. */
export function renumberSeats(
  doc: EditorDoc,
  scope: RenumberScope,
  band = ROW_BAND,
): EditorDoc {
  const types: SeatType[] = scope === "all" ? ["bar", "high", "booth"] : [scope];
  const numbers = new Map<string, string>();
  for (const type of types) {
    for (const { seat, number } of renumberPlan(doc, type, band)) {
      numbers.set(seat.uid, number);
    }
  }
  if (numbers.size === 0) return doc;

  return {
    ...doc,
    objects: doc.objects.map((o) =>
      o.kind === "seat" && numbers.has(o.uid) ? { ...o, display: numbers.get(o.uid) } : o,
    ),
  };
}

/* How many tables of each letter the sweep would touch, and how many are held
   back by hand — what the RENUMBER panel reads out before it is pressed. */
export function numberingCounts(doc: EditorDoc) {
  const seats = seatsOf(doc);
  const of = (type: SeatType) => ({
    auto: seats.filter((s) => s.type === type && s.autoNumber !== false).length,
    manual: seats.filter((s) => s.type === type && s.autoNumber === false).length,
  });
  return { bar: of("bar"), high: of("high"), booth: of("booth") };
}
