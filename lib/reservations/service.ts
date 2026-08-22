import { validateField } from "@/lib/booking";
import { findEvent, isBookable } from "@/lib/events";
import { seatCapacity } from "@/lib/floor-capacity";
import { SEATS, seatNumber } from "@/lib/floor-plan";
import { reservedSeats } from "@/lib/floor-availability";
import { normalizeEmail, normalizePhone } from "@/lib/reservations/identity";
import { takeAttempt } from "@/lib/reservations/rate-limit";
import { reservationStore } from "@/lib/reservations/store";
import type {
  ReservationRequest,
  ReservationResult,
} from "@/lib/reservations/types";

/* The rules, in the one place they are allowed to live.
 *
 * NOTHING THE BROWSER SAYS IS BELIEVED except which night, which table, how
 * many are coming and who they are. What kind of table it is, how many it
 * seats, whether the night takes tables at all and whether that table is still
 * free are all looked up here against the club's own data — a request claiming
 * a separe seats forty, or naming a table that is not on the floor, or booking
 * a night that has already happened, is refused on this side of the wire where
 * it cannot be edited.
 *
 * The panel in front of this checks the same things as the guest types, and
 * that is a courtesy rather than a control: it exists so nobody is told at the
 * last moment that their telephone number is wrong. The judgement that counts
 * is here. Both use the same validators — see lib/booking.ts — so the two can
 * never come to disagree about what a telephone number looks like.
 *
 * WHAT IS DELIBERATELY NOT HERE YET: no email is sent, no message goes to the
 * club, nothing is charged and nothing is verified. Every one of those hangs
 * off the record this returns rather than off the panel, which is what makes
 * them additions rather than rewrites. */

/* The house's own reading of a night's floor: the tables the club has marked
   as gone, plus the ones this system is already holding. Both are the same
   answer to a guest — the table is not free — and neither is geometry. */
export function takenSeatIds(eventId: string): Set<string> {
  const taken = new Set(reservedSeats(eventId));
  for (const held of reservationStore.heldSeats(eventId)) taken.add(held.seatId);
  return taken;
}

export type RequestContext = { source: string };

export function requestReservation(
  raw: unknown,
  context: RequestContext,
): ReservationResult {
  /* The brake first, so a flood is turned away before it costs anything. */
  const brake = takeAttempt(context.source);
  if (!brake.ok) {
    return { ok: false, reason: "rate-limited", retryAfterSeconds: brake.retryAfterSeconds };
  }

  const body = raw as Partial<ReservationRequest> | null;
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "invalid", fields: { body: "missing" } };
  }

  const fields: Record<string, string> = {};
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = text(body.name);
  const phone = text(body.phone);
  const email = text(body.email);
  const note = text(body.note).slice(0, 500);

  /* The same three judgements the panel makes, made again where they count. */
  if (validateField("name", name)) fields.name = "invalid";
  if (validateField("phone", phone)) fields.phone = "invalid";
  /* An email is required now. It was optional for exactly as long as the club
     had nowhere to send anything. */
  if (email === "" || validateField("email", email)) fields.email = "invalid";

  const phoneKey = normalizePhone(phone);
  const emailKey = normalizeEmail(email);
  if (!phoneKey) fields.phone = "invalid";
  if (!emailKey) fields.email = "invalid";

  /* The night, as the club describes it — not as the browser does. */
  const event = findEvent(text(body.eventId));
  if (!event || !isBookable(event) || !event.tables.enabled) {
    return { ok: false, reason: "unavailable" };
  }

  /* The table, read off the floor plan. Its kind, its zone and what it seats
     come from here and are never taken from the request. */
  const seat = SEATS.find((s) => s.id === text(body.seatId));
  if (!seat) fields.seatId = "unknown";

  const guests = Number(body.guests);
  if (seat) {
    const { min, max } = seatCapacity(seat);
    if (!Number.isInteger(guests) || guests < min || guests > max) {
      fields.guests = "out-of-range";
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, reason: "invalid", fields };
  if (!seat || !phoneKey || !emailKey) return { ok: false, reason: "invalid", fields };

  /* Marked gone by the club before anybody asked for it. */
  if (reservedSeats(event.slug).has(seat.id)) {
    return { ok: false, reason: "seat-taken" };
  }

  /* And the one step that has to be indivisible: is this table still free, has
     this guest already got one, and if not — take it. Two requests landing on
     the same table in the same instant both arrive here, and exactly one of
     them leaves with it. */
  const outcome = reservationStore.claim({
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
    emailKey,
  });

  if (!outcome.ok) return { ok: false, reason: outcome.reason };
  return { ok: true, reservation: outcome.reservation };
}

/* What the club would read off a list: the number the guest was told, not the
   key the booking is filed under. */
export function reservationLine(eventId: string) {
  return reservationStore.forEvent(eventId).map((r) => {
    const seat = SEATS.find((s) => s.id === r.seatId);
    return {
      id: r.id,
      number: seat ? seatNumber(seat) : r.seatId,
      seatId: r.seatId,
      guests: r.guests,
      name: r.name,
      phone: r.phone,
      email: r.email,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
}
