import {
  holdsASeat,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
} from "@/lib/reservations/types";

/* Where held tables are kept.
 *
 * THIS IS THE SEAM. The club has no database yet, so the list lives in the
 * server's own memory. Everything above this file — the rules, the refusals,
 * the wording a guest sees — is finished and does not care: it asks this store
 * three questions and is answered. The day there is a real database, this file
 * is what is rewritten, and nothing else has to be.
 *
 * WHAT A REAL DATABASE MUST KEEP DOING, because the rules depend on it:
 *
 *   1. `claim` has to stay ONE atomic step. It reads whether a table is free
 *      and whether the guest already holds one, and writes the reservation, and
 *      nothing may happen in between. Here that is free: the check and the
 *      write are in one synchronous function, and a single Node process runs
 *      one of those at a time, so two requests physically cannot interleave.
 *      In Postgres it is a transaction plus two partial unique indexes:
 *
 *        UNIQUE (event_id, seat_id)   WHERE status IN ('pending','confirmed')
 *        UNIQUE (event_id, phone_key) WHERE status IN ('pending','confirmed')
 *        UNIQUE (event_id, email_key) WHERE status IN ('pending','confirmed')
 *
 *      Those three lines are the whole of the duplicate and double-booking
 *      protection, stated where it cannot be raced.
 *
 *   2. The partial part matters. A cancelled or expired reservation must stop
 *      holding anything — its guest may book again, and its table must go back
 *      on the map.
 *
 * WHAT THIS IMPLEMENTATION IS NOT. Memory is per process: a restart forgets
 * every booking, and two server instances would not see each other's. That is
 * correct for a club that is still taking its tables by telephone and is the
 * reason nothing here pretends a reservation is confirmed. It is not correct
 * for production, and it is the first thing to replace. */

export type SeatHold = { seatId: string; status: ReservationStatus };

export type ClaimOutcome =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "seat-taken" | "duplicate" };

export type ReservationStore = {
  /* Take the table, or say why not — in one indivisible step. */
  claim: (draft: ReservationDraft) => ClaimOutcome;
  /* Every table currently held for one night, for the map to dim. */
  heldSeats: (eventId: string) => SeatHold[];
  /* One night's reservations, newest first — the club's own list. */
  forEvent: (eventId: string) => Reservation[];
  find: (id: string) => Reservation | undefined;
  /* Letting a table go, or the club confirming it. Returns the updated record,
     or undefined when there is nothing by that id. */
  setStatus: (id: string, status: ReservationStatus) => Reservation | undefined;
};

/* ── the in-memory implementation ───────────────────────────────────────── */

type Bank = { rows: Map<string, Reservation>; counter: number };

/* Kept on the global so that a hot reload in development does not drop every
   booking made since the server started. */
const globalBank = globalThis as unknown as { __plitviceReservations?: Bank };

function bank(): Bank {
  if (!globalBank.__plitviceReservations) {
    globalBank.__plitviceReservations = { rows: new Map(), counter: 0 };
  }
  return globalBank.__plitviceReservations;
}

const active = (r: Reservation) => holdsASeat(r.status);

export const reservationStore: ReservationStore = {
  /* NO `await` MAY EVER APPEAR IN HERE. The whole of the double-booking and
     duplicate protection rests on this function running to completion before
     the next request is looked at; a single suspension point would open the
     race it exists to close. */
  claim(draft) {
    const { rows, counter } = bank();

    for (const row of rows.values()) {
      if (row.eventId !== draft.eventId || !active(row)) continue;
      if (row.seatId === draft.seatId) return { ok: false, reason: "seat-taken" };
      if (row.phoneKey === draft.phoneKey || row.emailKey === draft.emailKey) {
        return { ok: false, reason: "duplicate" };
      }
    }

    const now = new Date().toISOString();
    const next = counter + 1;
    const reservation: Reservation = {
      ...draft,
      id: `r${now.slice(0, 10).replace(/-/g, "")}-${String(next).padStart(4, "0")}`,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    rows.set(reservation.id, reservation);
    bank().counter = next;
    return { ok: true, reservation };
  },

  heldSeats(eventId) {
    return [...bank().rows.values()]
      .filter((r) => r.eventId === eventId && active(r))
      .map((r) => ({ seatId: r.seatId, status: r.status }));
  },

  forEvent(eventId) {
    return [...bank().rows.values()]
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  find(id) {
    return bank().rows.get(id);
  },

  setStatus(id, status) {
    const row = bank().rows.get(id);
    if (!row) return undefined;
    const updated: Reservation = { ...row, status, updatedAt: new Date().toISOString() };
    bank().rows.set(id, updated);
    return updated;
  },
};
