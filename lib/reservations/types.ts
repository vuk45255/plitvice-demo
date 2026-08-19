import type { SeatType, ZoneId } from "@/lib/floor-plan";

/* What a held table is, once the house has it.
 *
 * WHERE A RESERVATION LIVES ITS LIFE. It arrives `pending` — the guest has
 * asked and the club has not yet rung back. It becomes `confirmed` when they
 * have, `cancelled` when either side lets it go, and `expired` when the night
 * has passed or a hold has run out. Nothing else in the system decides what
 * those words mean; everything asks HOLDS_A_SEAT below. */

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "expired";

/* Which of those actually hold a table against the floor.
 *
 * THIS IS THE HOUSE RULE, AND IT IS ONE LINE. Today a request holds its table
 * the moment it is made, because the club rings back rather than taking a
 * deposit and a table promised twice is worse than a table asked for twice.
 * The day the club would rather only confirmed bookings hold the floor — or
 * that a pending one holds it for twenty minutes and then lets go — this array
 * is what changes, and both the availability the map draws and the duplicate
 * check read it. */
export const HOLDS_A_SEAT: readonly ReservationStatus[] = ["pending", "confirmed"];

export const holdsASeat = (status: ReservationStatus) => HOLDS_A_SEAT.includes(status);

export type Reservation = {
  id: string;
  eventId: string;
  seatId: string;
  /* Read off the plan on the server, never taken from the browser. */
  seatType: SeatType;
  zone: ZoneId;
  guests: number;
  /* As the guest wrote them — this is what the club reads back. */
  name: string;
  phone: string;
  email: string;
  note: string;
  /* The same two, reduced to one form each. Never shown; only ever compared.
     See identity.ts. */
  phoneKey: string;
  emailKey: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
};

/* Everything a reservation needs before it has an id or a status. */
export type ReservationDraft = Omit<
  Reservation,
  "id" | "status" | "createdAt" | "updatedAt"
>;

/* Why a request was refused. The wording a guest sees is the client's business
   — see the panel — but the reason is decided here and nowhere else.
     "invalid"     — a field is missing or malformed; `fields` says which
     "unavailable" — the night is not taking tables at all
     "seat-taken"  — somebody else holds that exact table for that night
     "duplicate"   — this guest already holds a table for this night
     "rate-limited"— too many attempts from one source, too quickly */
export type ReservationRefusal =
  | { ok: false; reason: "invalid"; fields: Record<string, string> }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "seat-taken" }
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "rate-limited"; retryAfterSeconds: number };

export type ReservationResult =
  | { ok: true; reservation: Reservation }
  | ReservationRefusal;

/* What the browser is allowed to send. Everything else about the booking —
   what kind of table it is, how many it seats, whether the night is open — is
   the server's to look up. */
export type ReservationRequest = {
  eventId: string;
  seatId: string;
  guests: number;
  name: string;
  phone: string;
  email: string;
  note?: string;
};
