import { findTicketingEvent } from "@/lib/ticketing/events";
import { SEATS, seatNumber } from "@/lib/floor-plan";
import { officeAddress } from "@/lib/mail/provider";
import { sendOnce, sendAgain, type SendOutcome } from "@/lib/mail/send";
import { officeNoticeMail, reservationMail } from "@/lib/mail/templates";
import type { Reservation } from "@/lib/reservations/types";

/* THE TWO MESSAGES A TABLE PRODUCES, AND WHEN.
 *
 * ═══ TO THE GUEST — ONLY ON CONFIRMATION ══════════════════════════════════
 *
 * The one message a guest gets says the table is theirs, and it is sent the
 * moment the row reaches `confirmed` — which, for a booking made on the site,
 * is the moment it is written down at all: spending a live hold on a free table
 * IS the confirmation and there is nothing left to wait for. The other two ways
 * a row reaches `confirmed` send exactly the same message: a booking taken over
 * the telephone (the conversation having been the confirmation) and a legacy
 * `pending` row the office confirms by hand.
 *
 * NOTHING IS SENT WHEN A BOOKING IS CANCELLED OR REJECTED. The club rings
 * those. A machine telling somebody their table is gone is not how this club
 * talks to people, and it is not a decision this file should be making on
 * anybody's behalf.
 *
 * ═══ TO THE OFFICE — ON EVERY NEW BOOKING ═════════════════════════════════
 *
 * One address, from RESERVATIONS_NOTIFY_EMAIL. Unset is a state and not an
 * error: nothing is sent and nothing fails, because a club that has not yet
 * said where it wants these is not a club with a broken reservation system.
 *
 * ═══ SENT ONCE, AND FAILURE IS RECORDED ═══════════════════════════════════
 *
 * Both go through `sendOnce`, whose (kind, key) primary key is the whole
 * guarantee: a booking confirmed, un-confirmed and confirmed again does not
 * produce three mails, and two instances reacting to the same change produce
 * one. A failure is written down against the reservation and shown in the
 * office; it never reaches the caller, because a mail service having a bad
 * morning must not be able to un-confirm a table. */

/* The night, from the one place it is described.
 *
 * A reservation is keyed on the SLUG, and the row carrying that slug is now the
 * only record of what a night is — the title the office typed and the instant
 * it starts come out of the same place. There used to be a second answer here,
 * read out of a hand-written array in lib/events.ts, and the two could disagree
 * the moment somebody renamed a night in the office. They cannot now, because
 * there is one of them.
 *
 * A slug with no row at all still sends: the mail says the slug rather than
 * failing, because a table that has been confirmed must never depend on a
 * lookup succeeding. */
async function night(eventId: string): Promise<{ title: string; startsAt?: string }> {
  const event = await findTicketingEvent(eventId, true).catch(() => undefined);
  return { title: event?.title ?? eventId, startsAt: event?.startsAt };
}

function seatLabel(seatId: string): string {
  const seat = SEATS.find((s) => s.id === seatId);
  return seat ? seatNumber(seat) : seatId;
}

/* The guest's own confirmation. Called from the site's own booking, from a
   telephone booking and from `setReservationStatus`; never awaited by any of
   them, and claimed by (kind, reservation id) so all three together still send
   one message. */
export async function notifyReservationConfirmed(
  reservation: Reservation,
): Promise<SendOutcome> {
  if (!reservation.email) return "no-recipient";
  return sendOnce(
    "reservation-guest",
    reservation.id,
    reservationMail(reservation, await night(reservation.eventId), seatLabel(reservation.seatId)),
  );
}

/* The note to the office, for a booking that has just arrived. */
export async function notifyOffice(reservation: Reservation): Promise<SendOutcome> {
  const to = officeAddress();
  if (!to) return "no-recipient";
  return sendOnce(
    "reservation-office",
    reservation.id,
    officeNoticeMail(
      reservation,
      await night(reservation.eventId),
      seatLabel(reservation.seatId),
      to,
    ),
  );
}

/* Staff pressing "send again" on a confirmation that failed. Outside the
   claim, on purpose: the claim stops a machine repeating itself, not a person
   choosing to. */
export async function resendReservationConfirmation(
  reservation: Reservation,
): Promise<SendOutcome> {
  if (!reservation.email) return "no-recipient";
  return sendAgain(
    "reservation-guest",
    reservation.id,
    reservationMail(reservation, await night(reservation.eventId), seatLabel(reservation.seatId)),
  );
}
