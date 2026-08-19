"use client";

import { useCallback, useMemo, useState } from "react";
import { validateField } from "@/lib/booking";
import type { Seat } from "@/lib/floor-availability";
import type { PartyEvent } from "@/lib/events";
import type { MessageKey } from "@/lib/i18n";

/* One reservation, held in one place.
 *
 * THE WHOLE BOOKING IS ONE PIECE OF STATE, and it lives above the map rather
 * than inside it. That is what lets the guest close the room, look at the
 * poster again and come back to the same table with the same party size and
 * whatever they had already typed — and it is what lets the map, the card and
 * the page all describe the same reservation without any of them owning it.
 *
 * THE NIGHT IS NOT A FIELD. It arrives with the event and is carried through
 * every step to the summary at the end, so the thing that is finally sent
 * knows which party it is for without the guest ever being asked.
 *
 * WHAT IS ASKED FOR. A name and a telephone, because the house rings back;
 * an email and a note, because sometimes there is something to say. The party
 * size is not asked for at all — it is chosen on the table's own card, inside
 * what that table seats, and can never be out of range. */

export type ContactField = "name" | "phone" | "email";

export type Contact = Record<ContactField | "note", string>;

const EMPTY: Contact = { name: "", phone: "", email: "", note: "" };

/* All three. The email stopped being optional the day the club had somewhere
   to send a confirmation to; the server holds the same line, and it is the
   server's line that decides — see lib/reservations/service.ts. */
const REQUIRED: ContactField[] = ["name", "phone", "email"];
const ALL: ContactField[] = ["name", "phone", "email"];

/* An empty optional field is not a mistake — an email nobody gave is simply an
   email nobody gave. Anything actually typed into one is held to exactly the
   same standard as a required field, because a mistyped address is worse than
   a missing one: the house believes it and writes to nobody. */
function check(field: ContactField, value: string): MessageKey | null {
  if (!REQUIRED.includes(field) && value.trim() === "") return null;
  return validateField(field, value);
}

/* Which part of the booking the guest is standing in.
     "table"   — a table is being looked at, or has been picked
     "details" — the table is settled and the house is being told who is coming
     "sent"    — it has gone */
export type BookingStep = "table" | "details" | "sent";

/* Something the house said no to, which is not the same as something the
   guest typed wrongly.
     "duplicate"   — this telephone or this email already holds a table for
                     this night; the panel says so and offers the way back
     "seat-taken"  — somebody got that table in the seconds in between
     "unavailable" — the night has stopped taking tables
     "busy"        — too many attempts too quickly
     "failed"      — the request never arrived */
export type BookingProblem =
  | "duplicate"
  | "seat-taken"
  | "unavailable"
  | "busy"
  | "failed";

export type TableBooking = ReturnType<typeof useTableBooking>;

export function useTableBooking(event: PartyEvent) {
  /* The table whose card is open. Looking is not booking: a guest may open
     twenty of these and leave without having said anything to anybody. */
  const [seat, setSeat] = useState<Seat>();
  const [guests, setGuests] = useState(0);
  const [step, setStep] = useState<BookingStep>("table");

  const [values, setValues] = useState<Contact>(EMPTY);
  /* A field only starts complaining once the guest has left it, or once they
     have tried to send. Nobody is told they are wrong mid-word. */
  const [errors, setErrors] = useState<Partial<Record<ContactField, MessageKey>>>({});
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<BookingProblem | null>(null);

  /* Open a table's card. The party size starts at the smallest that table
     takes — the club's own rule, not a guess — and a size already chosen is
     kept wherever the new table can hold it, so moving from one separe to the
     next does not silently reset the party to its minimum. */
  const inspect = useCallback((next: Seat) => {
    setProblem(null);
    setSeat(next);
    setGuests((current) =>
      current === 0
        ? next.capacity.min
        : Math.min(next.capacity.max, Math.max(next.capacity.min, current)),
    );
    /* Picking a different table steps back out of the form, because the form
       is about a table and the table has just changed. Nothing typed is lost:
       the fields below are untouched by this. */
    setStep((s) => (s === "sent" ? s : "table"));
  }, []);

  /* Put the card away: the table is let go of and the guest is back to
     browsing the floor. It says nothing about the map's position and nothing
     about what they have typed, both of which are somebody else's business —
     and it cannot undo a reservation that has already been sent. */
  const dismiss = useCallback(() => {
    setSeat(undefined);
    setStep((s) => (s === "sent" ? s : "table"));
  }, []);

  const setParty = useCallback((n: number) => setGuests(n), []);

  const confirmSeat = useCallback(() => {
    if (seat) setStep("details");
  }, [seat]);

  const backToTable = useCallback(() => {
    setProblem(null);
    setStep("table");
  }, []);

  /* Leave the refusal behind and go back to the floor with nothing selected —
     what both "choose another table" and "we already have you" offer. */
  const clearProblem = useCallback(() => setProblem(null), []);

  /* Typing only clears a complaint; it never starts one. A field that is
     already marked wrong is re-checked on every keystroke so the message goes
     the moment it stops being true. */
  const set = useCallback(
    (field: ContactField | "note") => (value: string) => {
      setValues((v) => ({ ...v, [field]: value }));
      if (field === "note") return;
      setErrors((e) =>
        e[field] === undefined ? e : { ...e, [field]: check(field, value) ?? undefined },
      );
    },
    [],
  );

  const blur = useCallback(
    (field: ContactField) => () => {
      setErrors((e) => ({ ...e, [field]: check(field, values[field]) ?? undefined }));
    },
    [values],
  );

  const invalid = useMemo(() => ALL.some((f) => errors[f]), [errors]);

  /* Everything the house is being told, in one object. This is what a delivery
     route will be handed the day there is one — see the TODO in `submit`. */
  const summary = useMemo(
    () =>
      seat
        ? {
            event: { slug: event.slug, artist: event.artist, date: event.date },
            seat: {
              id: seat.id,
              number: seat.display,
              type: seat.type,
              zone: seat.zone,
            },
            guests,
            contact: values,
          }
        : null,
    [event.artist, event.date, event.slug, guests, seat, values],
  );

  /* Ask the house for the table.
   *
   * Everything checked here is checked again on the other side, and the other
   * side is the one that decides — this pass exists so that a guest who has
   * mistyped their telephone number is told before anything is sent, not
   * after. What comes back is either the booking or one of a handful of
   * reasons, and each of those has its own words in the panel.
   *
   * Returns the first field that needs the guest, so the caller can put them
   * on it. Null means it went — or that what stopped it was not a field. */
  const submit = useCallback(async (): Promise<ContactField | null> => {
    if (sending || !seat) return null;

    const next: Partial<Record<ContactField, MessageKey>> = {};
    for (const field of ALL) {
      const wrong = check(field, values[field]);
      if (wrong) next[field] = wrong;
    }
    setErrors(next);

    const first = ALL.find((f) => next[f]);
    if (first) return first;

    setProblem(null);
    setSending(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: event.slug,
          /* The key the booking is filed under, not the number on the map. */
          seatId: seat.id,
          guests,
          name: values.name,
          phone: values.phone,
          email: values.email,
          note: values.note,
        }),
      });

      if (response.ok) {
        setStep("sent");
        return null;
      }

      const body = (await response.json().catch(() => null)) as
        | { reason?: string; fields?: Record<string, string> }
        | null;

      /* A field the server disagreed with. It has already been checked here,
         so this is a guest who found an edge the panel did not — say which
         field and let them fix it. */
      if (body?.reason === "invalid") {
        const marked: Partial<Record<ContactField, MessageKey>> = {};
        for (const field of ALL) {
          if (body.fields?.[field]) marked[field] = `reserve.err.${field}` as MessageKey;
        }
        setErrors(marked);
        return ALL.find((f) => marked[f]) ?? null;
      }

      const known: BookingProblem[] = ["duplicate", "seat-taken", "unavailable"];
      const reason = body?.reason as BookingProblem | undefined;
      setProblem(
        reason && known.includes(reason)
          ? reason
          : response.status === 429
            ? "busy"
            : "failed",
      );
      return null;
    } catch {
      /* A telephone that lost its signal mid-send. Nothing was decided, and
         everything they typed is still here to try again with. */
      setProblem("failed");
      return null;
    } finally {
      setSending(false);
    }
  }, [event.slug, guests, seat, sending, values]);

  const reset = useCallback(() => {
    setSeat(undefined);
    setGuests(0);
    setStep("table");
    setValues(EMPTY);
    setErrors({});
    setProblem(null);
  }, []);

  return {
    event,
    seat,
    guests,
    step,
    values,
    errors,
    invalid,
    sending,
    problem,
    clearProblem,
    summary,
    inspect,
    dismiss,
    setParty,
    confirmSeat,
    backToTable,
    set,
    blur,
    submit,
    reset,
  };
}
