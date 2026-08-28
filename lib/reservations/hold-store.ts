import { query, tx } from "@/lib/db/client";

/* WHERE A TABLE IS KEPT WARM WHILE SOMEBODY IS STILL TYPING.
 *
 * A reservation is a promise the club has to keep; a hold is a courtesy that
 * expires by itself in three minutes and that nobody is ever told about
 * afterwards. They have different lifetimes and different failure modes, so
 * they are different tables and lib/reservations/store.ts is untouched by any
 * of this.
 *
 * ═══ THE OPERATION THAT MUST STAY INDIVISIBLE ═════════════════════════════
 *
 * `acquire`. Two guests touch S12 in the same second; exactly one may leave
 * with it. The whole guarantee is one partial unique index and one upsert:
 *
 *   CREATE UNIQUE INDEX seat_holds_one_live
 *     ON seat_holds (event_id, seat_id) WHERE status = 'active';
 *
 *   INSERT … ON CONFLICT (event_id, seat_id) WHERE status = 'active'
 *   DO UPDATE SET … WHERE seat_holds.expires_at <= now()   -- only a DEAD one
 *                     OR seat_holds.token = EXCLUDED.token -- or your own
 *   RETURNING *;
 *
 * NO ROW BACK MEANS SOMEBODY ELSE'S HOLD IS STILL ALIVE. The condition is
 * inside the write, which is the entire point: a version that SELECTed first
 * and INSERTed second would hand the same separe to two people, and would look
 * completely correct doing it.
 *
 * ═══ EXPIRY IS A TIMESTAMP, NEVER A TIMER ═════════════════════════════════
 *
 * Nothing here schedules anything. A hold is dead when `expires_at` has passed
 * according to the DATABASE's clock — asked at the moment somebody looks — so
 * a server that was asleep, restarted, or is one of four behind a load
 * balancer gives the same answer, and a guest's phone set twenty minutes fast
 * changes nothing. The countdown in the browser is a picture of this number
 * and has no authority whatsoever.
 *
 * Expired rows are left where they are rather than swept: they are already
 * dead to every query here, and a sweep is one more thing that can fail.
 * `sweepExpiredHolds` exists for tidiness and nothing depends on it running.
 *
 * ═══ A REFRESH DOES NOT BUY MORE TIME ═════════════════════════════════════
 *
 * Asking again with the same token returns the SAME hold with the SAME expiry.
 * A guest who reloads keeps their table and does not get a fresh three
 * minutes, because a timer that can be reset by pressing F5 is not a timer. */

export type HoldStatus = "active" | "released" | "consumed";

/* One hold. `token` is the guest's session and NEVER leaves the server — see
   the note over `activeSeats`. */
export type SeatHoldRecord = {
  id: string;
  eventId: string;
  seatId: string;
  token: string;
  status: HoldStatus;
  createdAt: string;
  expiresAt: string;
};

/* THREE MINUTES, in the one place it is written down. */
export const HOLD_SECONDS = 180;

export type AcquireInput = {
  eventId: string;
  seatId: string;
  token: string;
  ttlSeconds?: number;
};

export type AcquireOutcome =
  | { ok: true; hold: SeatHoldRecord; fresh: boolean }
  /* Somebody else is in the middle of booking it. Who, is never said. */
  | { ok: false; reason: "seat-held" };

export type HoldQuery = { eventId: string; seatId: string; token: string };

export type ConsumeOutcome =
  | { ok: true; hold: SeatHoldRecord }
  /* No hold at all, or it was let go — this guest never had this table. */
  | { ok: false; reason: "hold-missing" }
  /* It ran out while they were typing. */
  | { ok: false; reason: "hold-expired" }
  /* A live hold, held by somebody else. */
  | { ok: false; reason: "hold-invalid" };

type HoldRow = {
  id: string;
  event_id: string;
  seat_id: string;
  token: string;
  status: HoldStatus;
  created_at: Date | string;
  expires_at: Date | string;
};

const COLUMNS = `id, event_id, seat_id, token, status, created_at, expires_at`;

const at = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function toHold(row: HoldRow): SeatHoldRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    seatId: row.seat_id,
    token: row.token,
    status: row.status,
    createdAt: at(row.created_at),
    expiresAt: at(row.expires_at),
  };
}

function holdId() {
  return `h_${globalThis.crypto.randomUUID()}`;
}

export const holdStore = {
  /* Take the table for three minutes, or say that it is already spoken for. */
  async acquire({
    eventId,
    seatId,
    token,
    ttlSeconds = HOLD_SECONDS,
  }: AcquireInput): Promise<AcquireOutcome> {
    /* A hold with no time left is not a hold. This happens when a claim falls
       through in the last instant and `restoreHold` tries to give back nothing
       — better to say the table is gone than to write a dead row. */
    if (ttlSeconds <= 0) return { ok: false, reason: "seat-held" };

    return tx(async (q) => {
      const id = holdId();
      const result = await q.query<HoldRow>(
        `INSERT INTO seat_holds (id, event_id, seat_id, token, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, 'active', now(), now() + make_interval(secs => $5))
         ON CONFLICT (event_id, seat_id) WHERE status = 'active'
         DO UPDATE SET
              /* A DEAD hold is taken over outright. A LIVE one can only be the
                 asking guest's own — the WHERE below sees to that — and is
                 handed back exactly as it is, same expiry, no second three
                 minutes for a refresh. */
              id         = CASE WHEN seat_holds.expires_at <= now()
                                THEN EXCLUDED.id ELSE seat_holds.id END,
              token      = CASE WHEN seat_holds.expires_at <= now()
                                THEN EXCLUDED.token ELSE seat_holds.token END,
              created_at = CASE WHEN seat_holds.expires_at <= now()
                                THEN EXCLUDED.created_at ELSE seat_holds.created_at END,
              expires_at = CASE WHEN seat_holds.expires_at <= now()
                                THEN EXCLUDED.expires_at ELSE seat_holds.expires_at END
           WHERE seat_holds.expires_at <= now()
              OR seat_holds.token = EXCLUDED.token
         RETURNING ${COLUMNS}`,
        [id, eventId, seatId, token, ttlSeconds],
      );

      /* No row: the ON CONFLICT's WHERE refused, which can only mean a live
         hold belonging to somebody else. */
      const row = result.rows[0];
      if (!row) return { ok: false as const, reason: "seat-held" as const };

      /* ONE TABLE AT A TIME PER GUEST, and only now that the new one is
         actually theirs. Committing to a new table lets the last one go at
         once rather than in three minutes — otherwise a guest who changed
         their mind twice would be sitting on half a row of separes and the
         floor would look full to everybody else for no reason. Done AFTER the
         upsert on purpose: a guest who reaches for a table somebody else has
         must not lose the one they already had. */
      await q.query(
        `UPDATE seat_holds SET status = 'released'
          WHERE event_id = $1 AND token = $2 AND status = 'active'
            AND seat_id <> $3`,
        [eventId, token, seatId],
      );

      /* `fresh` means "this call started the three minutes", and the only
         thing that can say so is whether the row came back carrying the id
         this call generated. */
      return { ok: true as const, hold: toHold(row), fresh: row.id === id };
    });
  },

  /* This session's own live hold on one table, or nothing. */
  async read({ eventId, seatId, token }: HoldQuery): Promise<SeatHoldRecord | undefined> {
    const result = await query<HoldRow>(
      `SELECT ${COLUMNS} FROM seat_holds
        WHERE event_id = $1 AND seat_id = $2 AND token = $3
          AND status = 'active' AND expires_at > now()`,
      [eventId, seatId, token],
    );
    return result.rows[0] ? toHold(result.rows[0]) : undefined;
  },

  /* Every table presently held for one night.
     THE TOKENS IN HERE ARE SERVER-ONLY. The caller uses them to work out which
     of these is the asking guest's own; nothing may put one on the wire. */
  async activeSeats(
    eventId: string,
  ): Promise<{ seatId: string; token: string; expiresAt: string }[]> {
    const result = await query<{
      seat_id: string;
      token: string;
      expires_at: Date | string;
    }>(
      `SELECT seat_id, token, expires_at FROM seat_holds
        WHERE event_id = $1 AND status = 'active' AND expires_at > now()`,
      [eventId],
    );
    return result.rows.map((row) => ({
      seatId: row.seat_id,
      token: row.token,
      expiresAt: at(row.expires_at),
    }));
  },

  /* HELD → consumed, for this token and only while it is still alive.
   *
   * One statement, with every condition inside it, so it can succeed EXACTLY
   * ONCE. That is what makes a reservation impossible to fake from the
   * browser and what makes a double submit harmless: the second one has
   * nothing left to spend. */
  async consume({ eventId, seatId, token }: HoldQuery): Promise<ConsumeOutcome> {
    const claimed = await query<HoldRow>(
      `UPDATE seat_holds SET status = 'consumed'
        WHERE event_id = $1 AND seat_id = $2 AND token = $3
          AND status = 'active' AND expires_at > now()
        RETURNING ${COLUMNS}`,
      [eventId, seatId, token],
    );
    if (claimed.rows[0]) return { ok: true, hold: toHold(claimed.rows[0]) };

    /* It did not claim. The only thing left to decide is what to call it, and
       that is a read — which is safe, because nothing is being changed. */
    const standing = await query<HoldRow>(
      `SELECT ${COLUMNS} FROM seat_holds
        WHERE event_id = $1 AND seat_id = $2 AND status = 'active'
        ORDER BY created_at DESC LIMIT 1`,
      [eventId, seatId],
    );

    const row = standing.rows[0];
    if (!row) return { ok: false, reason: "hold-missing" };
    if (row.token !== token) return { ok: false, reason: "hold-invalid" };
    return { ok: false, reason: "hold-expired" };
  },

  /* Best effort, and never load-bearing: expiry is the source of truth. */
  async release({ eventId, seatId, token }: HoldQuery): Promise<void> {
    await query(
      `UPDATE seat_holds SET status = 'released'
        WHERE event_id = $1 AND seat_id = $2 AND token = $3 AND status = 'active'`,
      [eventId, seatId, token],
    );
  },
};

/* Tidiness, and nothing depends on it. Rows older than a day are dead to every
   query above whatever their status says. */
export async function sweepExpiredHolds(): Promise<number> {
  const result = await query(
    `DELETE FROM seat_holds WHERE expires_at < now() - interval '1 day'`,
  );
  return result.rowCount;
}

/* Emptied between tests, and never called by anything the site runs. */
export async function __resetHoldStoreForTests() {
  if (process.env.NODE_ENV === "production") throw new Error("not in production");
  await query(`DELETE FROM seat_holds`);
}
