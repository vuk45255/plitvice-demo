import { findEvent } from "@/lib/events";
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
 * Not when they ask. A request is `pending` — the club rings back, and it may
 * ring back to say no — so a mail sent at that moment would be telling
 * somebody they have a table before the club has decided they do. The one
 * message a guest gets says the table is theirs, and it is sent the moment the
 * row actually reaches `confirmed`, whether that happened because staff pressed
 * a button or because a booking was taken over the telephone (which arrives
 * confirmed, the conversation having been the confirmation).
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

/* The night, in the two places it is described.
 *
 * A reservation is keyed on the SLUG — the poster wall's identifier — which is
 * where the name comes from. The date is not there: lib/events.ts holds a
 * dictionary key for it, because the wall writes its dates in two languages.
 * The instant lives in the ticketing `events` row that shares the slug, so
 * that is what is asked, and a night with no ticketing row simply has no date
 * in its mail rather than a wrong one. */
async function night(eventId: string): Promise<{ title: string; startsAt?: string }> {
  const sold = await findTicketingEvent(eventId, true).catch(() => undefined);
  const wall = findEvent(eventId);
  return {
    title: wall?.artist ?? sold?.title ?? eventId,
    startsAt: sold?.startsAt,
  };
}

function seatLabel(seatId: string): string {
  const seat = SEATS.find((s) => s.id === seatId);
  return seat ? seatNumber(seat) : seatId;
}

/* The guest's own confirmation. Called from `setReservationStatus` and from a
   telephone booking; never awaited by either. */
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
