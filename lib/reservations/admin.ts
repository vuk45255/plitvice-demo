import { afterResponse } from "@/lib/after-response";
import { validateField } from "@/lib/booking";
import { tableBookingGate } from "@/lib/reservations/gate";
import { seatCapacity } from "@/lib/floor-capacity";
import { SEATS, seatNumber, type FloorSeat } from "@/lib/floor-plan";
import { reservedSeats } from "@/lib/floor-availability";
import { normalizeEmail, normalizePhone } from "@/lib/reservations/identity";
import { holdStore } from "@/lib/reservations/hold-store";
import { notifyReservationConfirmed } from "@/lib/reservations/notify";
import { reservationStore } from "@/lib/reservations/store";
import {
  holdsASeat,
  type Reservation,
  type ReservationStatus,
} from "@/lib/reservations/types";

/* THE CLUB'S OWN SIDE OF THE FLOOR.
 *
 * Two things live here and they exist for one reason each.
 *
 * ═══ 1. A BOOKING TAKEN OVER THE TELEPHONE ════════════════════════════════
 *
 * It goes into THE SAME TABLE, through THE SAME STORE, under the same partial
 * unique index as a booking made on the site. That is not tidiness — it is the
 * requirement. Any other arrangement means a member of staff promising S12 to
 * somebody on the telephone while the map is still showing S12 as free, and
 * two parties arriving for one separe at midnight.
 *
 * Two differences from a guest's own booking, both deliberate:
 *
 *   · NO HOLD IS REQUIRED. A hold is a courtesy for somebody filling in a form
 *     on a phone; a member of staff with the guest on the line does not need
 *     three minutes of protection from themselves. The unique index is still
 *     what decides whether the table is free, so nothing is weakened.
 *
 *   · THE DUPLICATE RULE DOES NOT APPLY. The index that stops one guest taking
 *     two tables covers `source = 'web'` only. Staff are trusted to know that
 *     the same number is ringing about a second table for the cousins.
 *
 * A telephone booking arrives `confirmed`, because the club has already said
 * yes — that conversation was the confirmation. A booking made on the site now
 * arrives `confirmed` too, for the same reason in a different form: spending a
 * live hold on a free table is the confirmation. Neither door writes `pending`
 * any more.
 *
 * ═══ 2. CANCELLING, REJECTING — AND CONFIRMING WHAT IS LEFT ═══════════════
 *
 * THE OFFICE DID NOT LOSE ANYTHING WHEN THE APPROVAL STEP WENT. Cancelling,
 * rejecting, correcting a guest's details and writing a booking down by
 * telephone are all exactly as they were; what changed is that none of them is
 * on the path of a normal booking any more. `setReservationStatus` still takes
 * `confirmed`, because the legacy `pending` rows still need it and because
 * putting a cancelled booking back is the same move.
 *
 * Nothing is ever deleted. A cancelled booking keeps its row, its time and its
 * reason for existing; what changes is that the partial index stops covering
 * it, so the table goes back on the map the same second — which is what
 * "freeing the table" means here, and why there is no separate button for it.
 * History is what the club will want when somebody rings up the next
 * afternoon. */

/* ── what staff are shown ───────────────────────────────────────────────── */

export type ReservationLine = {
  id: string;
  /* The number on the map — B12, V04, S07 — not the key the row is filed
     under. This is what staff and guests both say out loud. */
  number: string;
  seatId: string;
  guests: number;
  name: string;
  phone: string;
  email: string;
  note: string;
  status: ReservationStatus;
  source: Reservation["source"];
  createdBy?: string;
  /* Who last touched it — confirmed, cancelled, corrected. */
  updatedBy?: string;
  createdAt: string;
};

function line(reservation: Reservation): ReservationLine {
  const seat = SEATS.find((s) => s.id === reservation.seatId);
  return {
    id: reservation.id,
    number: seat ? seatNumber(seat) : reservation.seatId,
    seatId: reservation.seatId,
    guests: reservation.guests,
    name: reservation.name,
    phone: reservation.phone,
    email: reservation.email,
    note: reservation.note,
    status: reservation.status,
    source: reservation.source,
    createdBy: reservation.createdBy,
    updatedBy: reservation.updatedBy,
    createdAt: reservation.createdAt,
  };
}

export async function reservationsForEvent(eventId: string): Promise<ReservationLine[]> {
  return (await reservationStore.forEvent(eventId)).map(line);
}

export async function searchReservations(term: string): Promise<ReservationLine[]> {
  return (await reservationStore.search(term)).map(line);
}

export async function reservationCounts(eventId: string) {
  return reservationStore.countsFor(eventId);
}

/* ── the floor, as the office sees it ───────────────────────────────────── */

/* Three states, and the office is shown all three — which is the difference
 * between this and what a guest is shown.
 *
 *   available — nobody has it.
 *   held      — a browser tab is in the middle of booking it. Three minutes,
 *               from the database's clock, and the office is told WHEN it runs
 *               out so staff can decide whether to wait or ring back.
 *   reserved  — written down, by the site or by the telephone.
 *
 * A HELD TABLE IS NOT OFFERED FOR A TELEPHONE BOOKING. It used to be — staff
 * were reckoned to outrank a browser tab — and that was wrong: the guest whose
 * hold it is may be typing their card details, and taking it out from under
 * them produces exactly the two-parties-one-separe evening this whole system
 * exists to prevent. So the seat comes back `held`, the form says so with the
 * time it frees up, and nothing is taken silently. The unique index is still
 * the thing that decides, so nothing about the guarantee changed. */
export type SeatState = "available" | "held" | "reserved";

export type AdminSeat = {
  id: string;
  number: string;
  type: FloorSeat["type"];
  zone: FloorSeat["zone"];
  capacity: { min: number; max: number };
  state: SeatState;
  /* Set only on a held seat: when the three minutes are up, from the server. */
  heldUntil?: string;
  /* Set only on a reserved seat: enough to answer the telephone with. */
  reservation?: {
    id: string;
    name: string;
    phone: string;
    guests: number;
    status: ReservationStatus;
    source: Reservation["source"];
    note: string;
  };
  /* Marked gone by the club rather than booked by anybody. Still `reserved`
     to every caller; the distinction only matters on the admin map. */
  blocked?: boolean;
};

export type FloorState = {
  eventId: string;
  /* The server's own clock, sent with the answer so a countdown drawn in a
     browser is a picture of this rather than of the device's idea of time. */
  serverNow: string;
  seats: AdminSeat[];
  counts: { available: number; held: number; reserved: number };
};

export async function floorState(eventId: string): Promise<FloorState> {
  const [rows, holds] = await Promise.all([
    reservationStore.forEvent(eventId),
    holdStore.activeSeats(eventId),
  ]);

  const blocked = reservedSeats(eventId);
  const booked = new Map(
    rows.filter((row) => holdsASeat(row.status)).map((row) => [row.seatId, row]),
  );
  const held = new Map(holds.map((hold) => [hold.seatId, hold]));

  const seats: AdminSeat[] = SEATS.map((seat) => {
    const reservation = booked.get(seat.id);
    if (reservation) {
      return {
        ...shape(seat),
        state: "reserved" as const,
        reservation: {
          id: reservation.id,
          name: reservation.name,
          phone: reservation.phone,
          guests: reservation.guests,
          status: reservation.status,
          source: reservation.source,
          note: reservation.note,
        },
      };
    }
    if (blocked.has(seat.id)) {
      return { ...shape(seat), state: "reserved" as const, blocked: true };
    }
    const hold = held.get(seat.id);
    if (hold) {
      return { ...shape(seat), state: "held" as const, heldUntil: hold.expiresAt };
    }
    return { ...shape(seat), state: "available" as const };
  });

  return {
    eventId,
    serverNow: new Date().toISOString(),
    seats,
    counts: {
      available: seats.filter((s) => s.state === "available").length,
      held: seats.filter((s) => s.state === "held").length,
      reserved: seats.filter((s) => s.state === "reserved").length,
    },
  };
}

function shape(seat: FloorSeat) {
  return {
    id: seat.id,
    number: seatNumber(seat),
    type: seat.type,
    zone: seat.zone,
    capacity: seatCapacity(seat),
  };
}

/* The tables staff may write somebody into right now, for the form's select.
   Held ones are included and marked, rather than hidden: a member of staff on
   the telephone should be able to see that S12 frees up in ninety seconds. */
export async function bookableSeats(eventId: string): Promise<AdminSeat[]> {
  return (await floorState(eventId)).seats;
}

/* ── taking one by telephone ────────────────────────────────────────────── */

export type ManualReservationInput = {
  eventId: string;
  seatId: string;
  guests: number;
  name: string;
  phone: string;
  email?: string;
  note?: string;
};

export type ManualReservationResult =
  | { ok: true; reservation: ReservationLine }
  | { ok: false; reason: "invalid"; fields: Record<string, string> }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "seat-taken" }
  /* Somebody is in the middle of booking it on the site. NOT the same refusal
     as "taken": it says when it frees up, and the office decides. */
  | { ok: false; reason: "seat-held"; heldUntil: string }
  | { ok: false; reason: "duplicate" };

/* WHERE AN OVERRIDE WOULD GO, IF THE CLUB EVER ASKS FOR ONE.
 *
 * `takeHeldSeat` is the whole of it: pass it and a live hold is released and
 * the table written down anyway. NOTHING PASSES IT TODAY except a test — there
 * is no button, no query parameter and no environment variable that turns it
 * on, because an override that exists quietly is an override that gets used by
 * accident at midnight. When the club wants it, it wants a second confirm on
 * the form that says "S12 is being booked right now — take it anyway?", and
 * this option is what that button sets. */
export type ManualReservationOptions = { takeHeldSeat?: boolean };

export async function addPhoneReservation(
  input: ManualReservationInput,
  staff: string,
  options: ManualReservationOptions = {},
): Promise<ManualReservationResult> {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = text(input.name);
  const phone = text(input.phone);
  const email = text(input.email);
  const note = text(input.note).slice(0, 500);

  const fields: Record<string, string> = {};
  if (validateField("name", name)) fields.name = "invalid";
  if (validateField("phone", phone)) fields.phone = "invalid";
  /* An email is optional here and required on the site: somebody ringing the
     club may not have one to give, and refusing the booking over it would send
     staff back to the paper diary. */
  if (email && validateField("email", email)) fields.email = "invalid";

  const phoneKey = normalizePhone(phone);
  if (!phoneKey) fields.phone = "invalid";
  const emailKey = email ? normalizeEmail(email) : "";

  const gate = await tableBookingGate(text(input.eventId));
  if (!gate.open) return { ok: false, reason: "unavailable" };
  const event = gate.event;

  const seat = SEATS.find((s) => s.id === text(input.seatId));
  if (!seat) fields.seatId = "unknown";

  const guests = Number(input.guests);
  if (seat) {
    const { min, max } = seatCapacity(seat);
    if (!Number.isInteger(guests) || guests < min || guests > max) {
      fields.guests = "out-of-range";
    }
  }

  if (Object.keys(fields).length > 0 || !seat || !phoneKey) {
    return { ok: false, reason: "invalid", fields };
  }

  if (reservedSeats(event.slug).has(seat.id)) {
    return { ok: false, reason: "seat-taken" };
  }

  /* A LIVE HOLD IS SOMEBODY IN THE MIDDLE OF BOOKING, and it is not staff's to
     take without saying so. Read here rather than enforced in SQL on purpose:
     the hold is a courtesy and the RESERVATION index below is still the thing
     that decides, so the worst this read can do is let a booking through in
     the microsecond after a hold appeared — which the index then judges on the
     reservations, exactly as it does for the site. */
  if (!options.takeHeldSeat) {
    const live = await holdStore.activeSeats(event.slug);
    const held = live.find((row) => row.seatId === seat.id);
    if (held) return { ok: false, reason: "seat-held", heldUntil: held.expiresAt };
  }

  /* CONFIRMED, not pending: the club said yes on the telephone, and that
     conversation was the confirmation. */
  const outcome = await reservationStore.claim(
    {
      eventId: event.slug,
      seatId: seat.id,
      seatType: seat.type,
      zone: seat.zone,
      guests,
      name,
      phone,
      email,
      note,
      phoneKey,
      emailKey: emailKey ?? "",
      source: "phone",
      createdBy: staff,
    },
    "confirmed",
  );

  if (!outcome.ok) return { ok: false, reason: outcome.reason };

  /* The table is theirs, so whatever browser tab was holding it is holding
     nothing. Released rather than left to expire, so the map catches up at
     once instead of in three minutes. */
  await releaseAnyHoldOn(event.slug, seat.id).catch(() => undefined);

  /* The booking is confirmed the moment it is written down, so the guest's
     confirmation goes out now — if they gave an address at all. Not awaited: a
     mail service having a bad morning must not be able to fail a booking that
     staff have already promised on the telephone. */
  afterResponse(() => notifyReservationConfirmed(outcome.reservation));

  return { ok: true, reservation: line(outcome.reservation) };
}

/* A hold on a table the club has just written somebody else into is a hold on
   nothing. Whoever's it was, it goes — the reservation index has already
   decided, and leaving it would keep the table dim for three minutes for no
   reason. */
async function releaseAnyHoldOn(eventId: string, seatId: string) {
  const live = await holdStore.activeSeats(eventId);
  const mine = live.find((row) => row.seatId === seatId);
  if (!mine) return;
  await holdStore.release({ eventId, seatId, token: mine.token });
}

/* ── changing one ───────────────────────────────────────────────────────── */

export type StatusChangeResult =
  | { ok: true; reservation: ReservationLine }
  | { ok: false; reason: "unknown" | "seat-taken" };

/* Cancel, reject — and un-cancel, which is the one that can fail: putting a
   booking back onto a table somebody else has since been given is refused by
   the unique index rather than by anybody remembering to check.
   `confirmed` is still a destination, for the legacy `pending` rows and for
   putting a cancelled booking back; it is no longer a step anything on the
   site's own path goes through. */
export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  by?: string,
): Promise<StatusChangeResult> {
  const before = await reservationStore.find(id);
  const updated = await reservationStore.setStatus(id, status, by);
  if (!updated) return { ok: false, reason: "unknown" };
  if ("conflict" in updated) return { ok: false, reason: "seat-taken" };

  /* THE ONE STATE CHANGE A GUEST IS TOLD ABOUT, and only on the way in: a
     booking that has just become confirmed. A booking made on the site is
     already confirmed when it is written down and has already had its message,
     so this fires for a legacy `pending` row or a cancelled one put back — and
     even then `sendOnce` is what stops a second message, not this condition.
     Nothing is sent for a cancellation — the club rings those, and a machine
     telling somebody their table is gone is not how this club talks to people.
     Awaited nowhere: see notify(). */
  if (status === "confirmed" && before?.status !== "confirmed") {
    afterResponse(() => notifyReservationConfirmed(updated));
  }

  return { ok: true, reservation: line(updated) };
}

/* ── correcting what was written down ───────────────────────────────────── */

export type EditReservationInput = {
  guests?: number;
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
};

export type EditReservationResult =
  | { ok: true; reservation: ReservationLine }
  | { ok: false; reason: "unknown" }
  | { ok: false; reason: "invalid"; fields: Record<string, string> };

/* A misheard surname, a number with a digit missing, two more people coming.
   NOT the table and NOT the night — moving a booking to another table is a new
   booking on a table that has to be free, and it goes through the same claim
   and the same index as everything else. */
export async function editReservation(
  id: string,
  input: EditReservationInput,
  by: string,
): Promise<EditReservationResult> {
  const existing = await reservationStore.find(id);
  if (!existing) return { ok: false, reason: "unknown" };

  const text = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const fields: Record<string, string> = {};

  const name = text(input.name);
  const phone = text(input.phone);
  const email = text(input.email);
  const note = text(input.note);

  if (name !== undefined && validateField("name", name)) fields.name = "invalid";
  if (phone !== undefined && validateField("phone", phone)) fields.phone = "invalid";
  if (email !== undefined && email !== "" && validateField("email", email)) {
    fields.email = "invalid";
  }

  const seat = SEATS.find((s) => s.id === existing.seatId);
  let guests: number | undefined;
  if (input.guests !== undefined) {
    guests = Number(input.guests);
    const bounds = seat ? seatCapacity(seat) : { min: 1, max: 20 };
    if (!Number.isInteger(guests) || guests < bounds.min || guests > bounds.max) {
      fields.guests = "out-of-range";
    }
  }

  const phoneKey = phone !== undefined ? normalizePhone(phone) : undefined;
  if (phone !== undefined && !phoneKey) fields.phone = "invalid";

  if (Object.keys(fields).length > 0) return { ok: false, reason: "invalid", fields };

  const updated = await reservationStore.updateDetails(id, {
    guests,
    name,
    phone,
    email,
    note: note === undefined ? undefined : note.slice(0, 500),
    phoneKey: phoneKey ?? undefined,
    /* An email that was cleared clears its key too — the partial unique index
       on (event, email_key) only covers a non-empty one, so "" is how a guest
       stops being counted by it. */
    emailKey:
      email === undefined ? undefined : email ? (normalizeEmail(email) ?? "") : "",
    updatedBy: by,
  });

  return updated
    ? { ok: true, reservation: line(updated) }
    : { ok: false, reason: "unknown" };
}
