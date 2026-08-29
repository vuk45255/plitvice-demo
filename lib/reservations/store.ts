import { query, type Queryable } from "@/lib/db/client";
import { newInternalId } from "@/lib/ticketing/tokens";
import {
  type Reservation,
  type ReservationDraft,
  type ReservationSource,
  type ReservationStatus,
} from "@/lib/reservations/types";

/* WHERE HELD TABLES ARE KEPT, AND WHERE DOUBLE-BOOKING IS MADE IMPOSSIBLE.
 *
 * ═══ THE THREE LINES THAT ARE THE WHOLE GUARANTEE ═════════════════════════
 *
 * They are not in this file. They are in lib/db/schema.ts, because a rule that
 * two machines can reach at the same instant has to be stated where only one
 * of them can win:
 *
 *   UNIQUE (event_id, seat_id)   WHERE status IN ('pending','confirmed')
 *   UNIQUE (event_id, phone_key) WHERE status IN (…) AND source = 'web'
 *   UNIQUE (event_id, email_key) WHERE status IN (…) AND source = 'web'
 *
 * `claim` below is a single INSERT that either succeeds or is refused by one
 * of those. There is no read-then-write anywhere in it — which matters,
 * because the read-then-write version is the one that hands the same separe to
 * two people and looks perfectly correct while doing it.
 *
 * THE PARTIAL PREDICATE IS HALF THE POINT. A cancelled, rejected or expired
 * reservation must stop holding anything — its guest may book again, and its
 * table must go back on the map — and it does, without being deleted, because
 * the index simply stops covering it.
 *
 * WHY THE GUEST RULE IS `source = 'web'` ONLY. Staff taking a booking by
 * telephone are trusted to know that the same number is ringing about a second
 * table for the cousins. Refusing them would send them back to writing it on
 * paper, which is what this system exists to replace.
 *
 * ═══ ONE TABLE FOR BOTH DOORS ═════════════════════════════════════════════
 *
 * A booking made on the site and a booking taken over the telephone are the
 * same row in the same table with a different `source`. That is the only way
 * the floor can be true: any other arrangement means staff promising a separe
 * the site is still showing as free. */

export type SeatHold = { seatId: string; status: ReservationStatus };

export type ClaimOutcome =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "seat-taken" | "duplicate" };

type ReservationRow = {
  id: string;
  event_id: string;
  seat_id: string;
  seat_type: Reservation["seatType"];
  zone: Reservation["zone"];
  guests: number;
  name: string;
  phone: string;
  email: string;
  note: string;
  phone_key: string;
  email_key: string;
  status: ReservationStatus;
  source: ReservationSource;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const COLUMNS = `id, event_id, seat_id, seat_type, zone, guests, name, phone,
  email, note, phone_key, email_key, status, source, created_by, updated_by,
  created_at, updated_at`;

const at = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    eventId: row.event_id,
    seatId: row.seat_id,
    /* Written by this module from the floor plan and read straight back —
       never taken from a request, so the row is the shape the plan gave it. */
    seatType: row.seat_type,
    zone: row.zone,
    guests: Number(row.guests),
    name: row.name,
    phone: row.phone,
    email: row.email,
    note: row.note,
    phoneKey: row.phone_key,
    emailKey: row.email_key,
    status: row.status,
    source: row.source,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    createdAt: at(row.created_at),
    updatedAt: at(row.updated_at),
  };
}

/* A human-readable id, kept because the club reads these out: r20260828-a3f9.
   The random tail rather than a counter, so that a booking's id says nothing
   about how many other people booked that day. */
function reservationId(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `r${day}-${newInternalId("").slice(1, 7)}`;
}

/* Which of the three indexes refused this insert. Postgres names the index in
   the error; nothing else in this table can raise a unique violation, so a
   name that is not the seat one is a guest who already has a table. */
function refusalFrom(error: unknown): ClaimOutcome | null {
  const message = String(
    (error as { constraint?: string; message?: string })?.constraint ??
      (error as { message?: string })?.message ??
      "",
  );
  if (!/unique|duplicate key/i.test(message) && !/reservations_one_per/.test(message)) {
    return null;
  }
  if (/one_per_seat/.test(message)) return { ok: false, reason: "seat-taken" };
  if (/one_per_phone|one_per_email/.test(message)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: false, reason: "seat-taken" };
}

export const reservationStore = {
  /* TAKE THE TABLE, OR SAY WHY NOT — in one statement.
   *
   * There is no check before the insert on purpose. A check is a read, and a
   * read followed by a write is the race. The database refuses, and the
   * refusal is turned back into one of the two words the panel knows.
   *
   * THE STATUS IS PART OF THAT ONE STATEMENT and is why there is no second one.
   * Both doors write `confirmed` — the site because spending a live hold on a
   * free table is the confirmation, the telephone because the conversation was.
   * Inserting `pending` and updating it to `confirmed` afterwards would be two
   * statements with a window between them, and a booking stranded in that
   * window holds a table nobody has been told about. */
  async claim(
    draft: ReservationDraft,
    status: ReservationStatus = "confirmed",
  ): Promise<ClaimOutcome> {
    try {
      const result = await query<ReservationRow>(
        `INSERT INTO reservations (
           id, event_id, seat_id, seat_type, zone, guests, name, phone, email,
           note, phone_key, email_key, status, source, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING ${COLUMNS}`,
        [
          reservationId(),
          draft.eventId,
          draft.seatId,
          draft.seatType,
          draft.zone,
          draft.guests,
          draft.name,
          draft.phone,
          draft.email,
          draft.note,
          draft.phoneKey,
          draft.emailKey,
          status,
          draft.source,
          draft.createdBy ?? null,
        ],
      );
      return { ok: true, reservation: toReservation(result.rows[0]) };
    } catch (error: unknown) {
      const refusal = refusalFrom(error);
      if (refusal) return refusal;
      throw error;
    }
  },

  /* Every table currently held for one night, for the map to dim. */
  async heldSeats(eventId: string, q?: Queryable): Promise<SeatHold[]> {
    const run = q ? q.query.bind(q) : query;
    const result = await run<{ seat_id: string; status: ReservationStatus }>(
      `SELECT seat_id, status FROM reservations
        WHERE event_id = $1 AND status IN ('pending','confirmed')`,
      [eventId],
    );
    return result.rows.map((row) => ({ seatId: row.seat_id, status: row.status }));
  },

  /* One night's reservations, newest first — the club's own list. */
  async forEvent(eventId: string): Promise<Reservation[]> {
    const result = await query<ReservationRow>(
      `SELECT ${COLUMNS} FROM reservations
        WHERE event_id = $1 ORDER BY created_at DESC`,
      [eventId],
    );
    return result.rows.map(toReservation);
  },

  async find(id: string): Promise<Reservation | undefined> {
    const result = await query<ReservationRow>(
      `SELECT ${COLUMNS} FROM reservations WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toReservation(result.rows[0]) : undefined;
  },

  /* Letting a table go, or the club confirming it.
   *
   * Going BACK to a holding status is where this can fail: two cancelled
   * bookings on one table, both un-cancelled, would break the unique index —
   * so the database refuses the second, and the caller is told the table is
   * taken rather than being handed a crash. */
  async setStatus(
    id: string,
    status: ReservationStatus,
    by?: string,
  ): Promise<Reservation | undefined | { conflict: true }> {
    try {
      const result = await query<ReservationRow>(
        /* `by` is written next to the change rather than into a log table.
           One column, and it answers the question the club actually asks the
           next afternoon: who cancelled this. */
        `UPDATE reservations
            SET status = $2, updated_by = COALESCE($3, updated_by), updated_at = now()
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, status, by ?? null],
      );
      return result.rows[0] ? toReservation(result.rows[0]) : undefined;
    } catch (error: unknown) {
      if (refusalFrom(error)) return { conflict: true };
      throw error;
    }
  },

  /* Correcting what was written down — a misheard surname, a number with a
     digit missing, two more people coming than were first said.
     WHAT CANNOT BE CHANGED HERE: the night, the table and the status. Those
     three are what the unique index is over, and moving a booking to another
     table is not an edit — it is a new booking on a table that has to be
     free, which is `claim`'s job and nothing else's. */
  async updateDetails(
    id: string,
    patch: {
      guests?: number;
      name?: string;
      phone?: string;
      email?: string;
      note?: string;
      phoneKey?: string;
      emailKey?: string;
      updatedBy?: string;
    },
  ): Promise<Reservation | undefined> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (patch.guests !== undefined) push("guests", patch.guests);
    if (patch.name !== undefined) push("name", patch.name);
    if (patch.phone !== undefined) push("phone", patch.phone);
    if (patch.email !== undefined) push("email", patch.email);
    if (patch.note !== undefined) push("note", patch.note);
    if (patch.phoneKey !== undefined) push("phone_key", patch.phoneKey);
    if (patch.emailKey !== undefined) push("email_key", patch.emailKey);
    if (patch.updatedBy !== undefined) push("updated_by", patch.updatedBy);

    if (sets.length === 0) return this.find(id);

    values.push(id);
    const result = await query<ReservationRow>(
      `UPDATE reservations SET ${sets.join(", ")}, updated_at = now()
        WHERE id = $${values.length} RETURNING ${COLUMNS}`,
      values,
    );
    return result.rows[0] ? toReservation(result.rows[0]) : undefined;
  },

  /* What staff search by when somebody rings up: a name, a number, an id. */
  async search(term: string, limit = 40): Promise<Reservation[]> {
    const trimmed = term.trim();
    if (!trimmed) return [];
    const result = await query<ReservationRow>(
      `SELECT ${COLUMNS} FROM reservations
        WHERE id = $1
           OR name      ILIKE '%' || $1 || '%'
           OR phone     ILIKE '%' || $1 || '%'
           OR email     ILIKE '%' || $1 || '%'
           OR phone_key ILIKE '%' || $1 || '%'
           OR seat_id   ILIKE '%' || $1 || '%'
        ORDER BY created_at DESC LIMIT $2`,
      [trimmed, limit],
    );
    return result.rows.map(toReservation);
  },

  /* How a night's tables stand, for the admin screen. */
  async countsFor(eventId: string): Promise<Record<ReservationStatus, number>> {
    const result = await query<{ status: ReservationStatus; n: number }>(
      `SELECT status, COUNT(*)::int AS n FROM reservations
        WHERE event_id = $1 GROUP BY status`,
      [eventId],
    );
    const counts: Record<ReservationStatus, number> = {
      pending: 0, confirmed: 0, rejected: 0, cancelled: 0, expired: 0,
    };
    for (const row of result.rows) counts[row.status] = Number(row.n);
    return counts;
  },
};

/* Emptied between tests, and never called by anything the site runs. */
export async function __resetReservationStoreForTests() {
  if (process.env.NODE_ENV === "production") throw new Error("not in production");
  await query(`DELETE FROM reservations`);
}
