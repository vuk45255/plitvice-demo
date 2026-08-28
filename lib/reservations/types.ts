import type { SeatType, ZoneId } from "@/lib/floor-plan";

/* What a held table is, once the house has it.
 *
 * WHERE A RESERVATION LIVES ITS LIFE. It arrives `pending` — the guest has
 * asked and the club has not yet rung back. It becomes `confirmed` when they
 * have, `rejected` when the club cannot take it, `cancelled` when the guest
 * lets it go, and `expired` when the night has passed. Nothing else in the
 * system decides what those words mean; everything asks HOLDS_A_SEAT below,
 * and the partial unique indexes in lib/db/schema.ts repeat the same list so
 * that nothing can quietly disagree with it. */

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "expired";

/* Which of those actually hold a table against the floor.
 *
 * THIS IS THE HOUSE RULE, AND IT IS ONE LINE. Today a request holds its table
 * the moment it is made, because the club rings back rather than taking a
 * deposit and a table promised twice is worse than a table asked for twice.
 * The day the club would rather only confirmed bookings hold the floor, this
 * array is what changes — AND the two partial indexes in lib/db/schema.ts,
 * which state the same rule where it cannot be raced. */
export const HOLDS_A_SEAT: readonly ReservationStatus[] = ["pending", "confirmed"];

export const holdsASeat = (status: ReservationStatus) => HOLDS_A_SEAT.includes(status);

/* Where the booking came from. Both write to the same table, which is the
   entire point: a table taken over the telephone disappears from the map the
   same second, and staff cannot promise something the site is still offering. */
export type ReservationSource = "web" | "phone";

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
  /* The same two, reduced to one form each. Never shown; only ever compared
     and searched. See identity.ts. */
  phoneKey: string;
  emailKey: string;
  status: ReservationStatus;
  source: ReservationSource;
  /* Which member of staff wrote it down, for a telephone booking. */
  createdBy?: string;
  /* And who last changed it — confirmed, cancelled, corrected. Undefined on
     anything the club has not touched since the guest sent it. */
  updatedBy?: string;
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
     "rate-limited"— too many attempts from one source, too quickly
     "hold-expired"— the three minutes ran out while the form was open, or
                     there was never a hold at all; the table is back on the
                     floor and the guest has to choose again
     "hold-invalid"— a live hold on that table belongs to somebody else, so
                     whatever this request thinks it is holding, it is not */
export type ReservationRefusal =
  | { ok: false; reason: "invalid"; fields: Record<string, string> }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "seat-taken" }
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "rate-limited"; retryAfterSeconds: number }
  | { ok: false; reason: "hold-expired" }
  | { ok: false; reason: "hold-invalid" };

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
