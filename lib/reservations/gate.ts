import { findTicketingEvent, type TicketingEvent } from "@/lib/ticketing/events";

/* MAY A TABLE BE TAKEN FOR THIS NIGHT — asked of the database, in one place.
 *
 * ═══ WHAT THIS REPLACED, AND WHY IT HAD TO ════════════════════════════════
 *
 * Three functions — `acquireHold`, `createReservation` and the office's own
 * `manualReservation` — each began with the same four lines:
 *
 *     const event = findEvent(id);
 *     if (!event || !isBookable(event) || !event.tables.enabled) refuse;
 *
 * and `findEvent` read a hand-written array in lib/events.ts. So whether the
 * club took tables on a given night was a fact written in the source, and the
 * REZERVACIJE switch in /admin/dogadjaji wrote a column nothing consulted. An
 * owner could turn table bookings off and watch the site go on taking them.
 *
 * The four lines are now this function, it reads the row, and `tables_enabled`
 * is the answer. One place, three callers, and the switch means something.
 *
 * ═══ WHY IT IS A BUSINESS RULE AND NOT A SCREEN ═══════════════════════════
 *
 * The public floor plan will already stop offering tables for a night whose
 * `tables.enabled` is false — but that is a rendering decision, and a rendering
 * decision is not a rule. `/api/reservations` and `/api/reservations/holds` are
 * public endpoints that anybody may post to with any slug in the body. This is
 * what refuses them, on the server, whatever a browser was shown.
 *
 * ═══ AND IT DOES NOT TOUCH WHAT ALREADY EXISTS ════════════════════════════
 *
 * It is asked before a NEW hold or a NEW booking. Nothing here reads, cancels
 * or hides a reservation that has already been made: a night switched off keeps
 * every table it has already promised, the office still lists them, the guests
 * still hold them, and the floor still shows them as taken. Turning the switch
 * off closes the door; it does not empty the room.
 *
 * ═══ THE CONCURRENCY IS UNCHANGED ═════════════════════════════════════════
 *
 * This is a read, before the atomic step, and it is not the guarantee. The
 * guarantee is still the partial unique index on `(event_id, seat_id) WHERE
 * status = 'active'` and the single INSERT that races against it — see
 * lib/reservations/hold-store.ts. A night that is switched off in the
 * microsecond after this returns loses nothing that matters: at worst one more
 * table is taken on a night that was open when the guest asked, which is the
 * correct outcome anyway. */

export type BookingGate =
  | { open: true; event: TicketingEvent }
  | { open: false; reason: "unknown" | "not-public" | "past" | "tables-closed" };

export async function tableBookingGate(
  eventKey: string | undefined,
  now = new Date(),
): Promise<BookingGate> {
  if (!eventKey) return { open: false, reason: "unknown" };

  /* Dev mode is not opened here: a test night must never take a real table. */
  const event = await findTicketingEvent(eventKey, false);
  if (!event) return { open: false, reason: "unknown" };

  /* The same three conditions the public programme applies before it will show
     a night at all — see `isPublic` in lib/club/programme.ts. A draft is not
     bookable, an archived night is not bookable, and neither is a fixture. */
  if (event.archivedAt || event.testOnly || event.status === "draft") {
    return { open: false, reason: "not-public" };
  }

  if (event.status === "ended" || new Date(event.startsAt) < now) {
    return { open: false, reason: "past" };
  }

  if (!event.tablesEnabled) return { open: false, reason: "tables-closed" };

  return { open: true, event };
}

/* EVERY NIGHT THAT IS TAKING TABLES RIGHT NOW, soonest first.
 *
 * The office's floor map and its reservations screen both need this list, and
 * so does the guest — it must be the same list, decided by the same column, or
 * staff end up looking at a night the public cannot book.
 *
 * It lives here rather than in lib/club/programme.ts on purpose: this module
 * imports a database client and nothing else, while the programme layer pulls
 * in every poster in the build to resolve artwork. The operational pages have
 * no use for artwork and a doorman's phone should not be made to think about
 * it — see the note at the top of app/(operations)/layout.tsx. */
export async function bookableNights(now = new Date()): Promise<TicketingEvent[]> {
  const { allTicketingEvents } = await import("@/lib/ticketing/events");
  return (await allTicketingEvents())
    .filter(
      (event) =>
        !event.archivedAt &&
        !event.testOnly &&
        event.status !== "draft" &&
        event.status !== "ended" &&
        event.tablesEnabled &&
        new Date(event.startsAt) >= now,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
