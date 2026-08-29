import { tableBookingGate } from "@/lib/reservations/gate";
import { SEATS } from "@/lib/floor-plan";
import { reservedSeats } from "@/lib/floor-availability";
import {
  HOLD_SECONDS,
  holdStore,
  type SeatHoldRecord,
} from "@/lib/reservations/hold-store";
import { reservationStore } from "@/lib/reservations/store";

/* The three minutes a table is kept for one guest, and the rules around them.
 *
 * A TABLE HAS THREE STATES AND ONLY THE FIRST TWO ARE PERMANENT.
 *
 *   AVAILABLE — nobody has it.
 *   HELD      — one guest is filling in the form. Three minutes, from the
 *               DATABASE's clock, and then it is AVAILABLE again with nothing
 *               to clean up and nobody to notify.
 *   RESERVED  — the club has it in writing. That is
 *               lib/reservations/store.ts and it is not this file's business.
 *
 * WHERE THE HOLD IS CREATED. Not on touching a table — a guest may open twenty
 * cards, and locking the floor behind a curious thumb is worse than not
 * locking it at all. It is created on the ONE step where they commit to a
 * particular table: the IZABERI STO button on the card, which is what takes
 * them into the form. See `confirmSeat` in use-table-booking.
 *
 * WHY THE ORDER IN THE RESERVATION SERVICE IS WHAT IT IS. The hold is spent
 * BEFORE the reservation is claimed, not after. Consuming is the step that can
 * only succeed once, so making it first means a double submit — the guest's
 * second tap, a retried request, a browser resending on a flaky connection —
 * has nothing left to spend and cannot produce a second booking. The claim
 * that follows is still the final authority on whether the table is free,
 * because it is the only thing that knows about reservations; if it refuses,
 * the hold is handed back so the guest keeps their three minutes for another
 * table.
 *
 * WHAT A HOLD IS NOT. It is not a reservation, it is never shown to the club,
 * and nobody is ever told who is holding what — a guest looking at somebody
 * else's table sees only that it cannot be had at this moment. */

export { HOLD_SECONDS };

/* What the browser is told about its own hold. The token is not in here, and
   must never be: the browser proves who it is with its cookie, which it cannot
   read, and everything else is a fact about the table. */
export type HoldView = {
  eventId: string;
  seatId: string;
  expiresAt: string;
  /* THE SERVER'S OWN CLOCK, sent with every answer. The countdown is drawn
     from the difference between these two rather than from the browser's idea
     of the time, so a device set twenty minutes fast still shows 02:59. */
  serverNow: string;
  /* The same difference, in whole seconds, for a client that would rather not
     do the arithmetic. Never below zero. */
  remainingSeconds: number;
};

export type HoldRefusal =
  /* Somebody else is holding it right now. */
  | { ok: false; reason: "seat-held" }
  /* It is gone for good — booked, or marked gone by the club. */
  | { ok: false; reason: "seat-reserved" }
  /* The night is not taking tables, or there is no such table on the floor. */
  | { ok: false; reason: "unavailable" };

export type HoldResult = { ok: true; hold: HoldView } | HoldRefusal;

function view(hold: SeatHoldRecord, now: number): HoldView {
  return {
    eventId: hold.eventId,
    seatId: hold.seatId,
    expiresAt: hold.expiresAt,
    serverNow: new Date(now).toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - now) / 1000)),
  };
}

/* Every table that is spoken for on a night, for whatever reason, and cannot
   be held: the club's own marked-gone list plus everything this system has
   already booked. Both are RESERVED to a guest; the difference between them
   matters to the club and to nobody else. */
async function reservedFor(eventId: string): Promise<Set<string>> {
  const taken = new Set(reservedSeats(eventId));
  for (const held of await reservationStore.heldSeats(eventId)) taken.add(held.seatId);
  return taken;
}

/* ── acquire ────────────────────────────────────────────────────────────── */

/* Take a table for three minutes.
 *
 * The night, the table and whether either is real are all checked here against
 * the club's own data — the browser says which table it wants and nothing
 * more. Then one atomic step decides it; see the header of hold-store.ts.
 *
 * ON THE ONE JOIN THAT IS NOT ATOMIC. The reserved check above and the acquire
 * below are two operations, so a table booked in the microsecond between them
 * could still be held. That window is closed downstream rather than here: the
 * hold is worth nothing on its own, and the reservation claim refuses a table
 * that is already booked. The guest is told `seat-taken`, which is a state the
 * panel has always had. */
export async function acquireHold(input: {
  eventId: string;
  seatId: string;
  token: string;
}): Promise<HoldResult> {
  /* The night, and whether it is taking tables at all — read off its row, so
     the REZERVACIJE switch in the office is what decides. See gate.ts. */
  const gate = await tableBookingGate(input.eventId);
  if (!gate.open) return { ok: false, reason: "unavailable" };
  const event = gate.event;

  const seat = SEATS.find((s) => s.id === input.seatId);
  if (!seat) return { ok: false, reason: "unavailable" };

  if ((await reservedFor(event.slug)).has(seat.id)) {
    return { ok: false, reason: "seat-reserved" };
  }

  const outcome = await holdStore.acquire({
    eventId: event.slug,
    seatId: seat.id,
    token: input.token,
  });

  if (!outcome.ok) return { ok: false, reason: "seat-held" };
  return { ok: true, hold: view(outcome.hold, Date.now()) };
}

/* ── status ─────────────────────────────────────────────────────────────── */

/* What is left of this guest's hold — the answer a page asks for after a
   refresh, and the reason a refresh does not start the three minutes again.
   Undefined means they have no hold on that table, which is the same answer
   whether they never had one or it ran out. */
export async function getHoldStatus(query: {
  eventId: string;
  seatId: string;
  token: string;
}): Promise<HoldView | undefined> {
  const hold = await holdStore.read(query);
  return hold ? view(hold, Date.now()) : undefined;
}

/* ── release ────────────────────────────────────────────────────────────── */

/* Handing a table back early — what a guest pressing NAZAD does. Best effort
   and deliberately unreported: if it does not happen, the hold expires by
   itself in under three minutes, which is the only guarantee anything here
   relies on. Nothing waits on the answer and nothing branches on it. */
export async function releaseHold(query: {
  eventId: string;
  seatId: string;
  token: string;
}): Promise<void> {
  await holdStore.release(query);
}

/* ── availability ───────────────────────────────────────────────────────── */

/* One night's floor, as it stands this second — what the map polls.
 *
 * `held` is every table somebody is in the middle of taking, MINUS this
 * guest's own, which comes back in `mine`. That split is the whole of the
 * two-sided behaviour: the same table is dimmed for everyone else and lit for
 * the guest who has it, and neither side is told anything about the other.
 *
 * No token appears in the answer. */
export type Availability = {
  eventId: string;
  serverNow: string;
  reserved: string[];
  held: string[];
  mine: string[];
  /* Present only when `mine` has something in it — the same clock the panel's
     countdown is drawn from. */
  holdExpiresAt?: string;
};

export async function seatAvailability(query: {
  eventId: string;
  token?: string;
}): Promise<Availability> {
  const now = Date.now();
  const eventId = query.eventId;

  const [active, reserved] = await Promise.all([
    holdStore.activeSeats(eventId),
    reservedFor(eventId),
  ]);

  const held: string[] = [];
  const mine: string[] = [];
  let holdExpiresAt: string | undefined;

  for (const row of active) {
    if (query.token && row.token === query.token) {
      mine.push(row.seatId);
      holdExpiresAt = row.expiresAt;
    } else {
      held.push(row.seatId);
    }
  }

  return {
    eventId,
    serverNow: new Date(now).toISOString(),
    reserved: [...reserved],
    held,
    mine,
    holdExpiresAt,
  };
}

/* ── confirm ────────────────────────────────────────────────────────────── */

export type ConfirmRefusal =
  /* No hold, or one that has already been spent. */
  | { ok: false; reason: "hold-missing" }
  /* Three minutes went by while the form was open. */
  | { ok: false; reason: "hold-expired" }
  /* A live hold on that table, belonging to somebody else. */
  | { ok: false; reason: "hold-invalid" };

/* Spend the hold. Returns the record on success so the caller can claim
   against it, and hands it back with `restoreHold` if the claim then fails.
   Everything about WHAT is being booked stays with the caller — this knows
   only that a table was held by this session and is now spent. */
export async function consumeHold(query: {
  eventId: string;
  seatId: string;
  token: string;
}): Promise<{ ok: true; hold: SeatHoldRecord } | ConfirmRefusal> {
  const outcome = await holdStore.consume(query);
  if (outcome.ok) return { ok: true, hold: outcome.hold };
  return { ok: false, reason: outcome.reason };
}

/* The claim fell through after the hold was spent — somebody had booked the
   table, or the guest already has one. Put back WHAT IS LEFT of the three
   minutes, not a fresh three, so they can spend it on a different table
   instead of starting again. */
export async function restoreHold(hold: SeatHoldRecord): Promise<void> {
  await holdStore.acquire({
    eventId: hold.eventId,
    seatId: hold.seatId,
    token: hold.token,
    ttlSeconds: Math.max(
      0,
      Math.ceil((Date.parse(hold.expiresAt) - Date.now()) / 1000),
    ),
  });
}
