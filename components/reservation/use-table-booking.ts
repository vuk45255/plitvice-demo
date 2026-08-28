"use client";

import { useCallback, useMemo, useState } from "react";
import { validateField } from "@/lib/booking";
import { useSeatHold } from "@/components/reservation/use-seat-hold";
import type { FloorSnapshot, Seat } from "@/lib/floor-availability";
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
     "seat-held"   — somebody else is in the middle of booking it right now,
                     and will be for at most three minutes
     "hold-expired"— this guest's own three minutes ran out while the form was
                     open; the table is back on the floor and they choose again
     "unavailable" — the night has stopped taking tables
     "busy"        — too many attempts too quickly
     "failed"      — the request never arrived */
export type BookingProblem =
  | "duplicate"
  | "seat-taken"
  | "seat-held"
  | "hold-expired"
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

  /* The three minutes the table is kept for this guest. It is a hook of its
     own because it is a conversation with the server rather than a piece of
     form state — but it lives HERE, beside the seat and the step, because the
     hold and the table it holds have to be picked up and put down together. */
  const hold = useSeatHold(event.slug);

  /* Open a table's card. The party size starts at the smallest that table
     takes — the club's own rule, not a guess — and a size already chosen is
     kept wherever the new table can hold it, so moving from one separe to the
     next does not silently reset the party to its minimum. */
  const inspect = useCallback((next: Seat) => {
    setProblem(null);
    /* Opening a different table is leaving the one they had committed to, so
       it goes back on the floor at once rather than in three minutes. The
       server would have done this anyway the moment they committed somewhere
       else — this is only so everybody else sees it sooner. */
    if (hold.held && hold.held.seatId !== next.id) hold.release();
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
  }, [hold]);

  /* Put the card away: the table is let go of and the guest is back to
     browsing the floor. It says nothing about the map's position and nothing
     about what they have typed, both of which are somebody else's business —
     and it cannot undo a reservation that has already been sent.
     It DOES let the hold go, because putting the card away is the guest saying
     they are not taking this table after all. */
  const dismiss = useCallback(() => {
    if (step !== "sent") hold.release();
    setSeat(undefined);
    setStep((s) => (s === "sent" ? s : "table"));
  }, [hold, step]);

  const setParty = useCallback((n: number) => setGuests(n), []);

  /* THE COMMIT POINT, and the only one.
   *
   * Everything before this is looking: a guest may open twenty cards, count a
   * party on each and change their mind, and no table is taken away from
   * anybody. Pressing IZABERI STO is the first moment they have said WHICH
   * table they want — so it is the moment the house holds it for them, and
   * the form does not open until the house has said yes.
   *
   * If somebody beat them to it by a second they are told here, on the card,
   * with the map still in front of them — which is the right place to find out
   * and much better than at the bottom of a filled-in form. */
  const confirmSeat = useCallback(async () => {
    if (!seat || hold.taking) return;
    setProblem(null);

    const result = await hold.acquire(seat.id);
    if (result.ok) {
      setStep("details");
      return;
    }

    setProblem(
      result.reason === "seat-held"
        ? "seat-held"
        : result.reason === "seat-reserved"
          ? "seat-taken"
          : result.reason === "unavailable"
            ? "unavailable"
            : "failed",
    );
  }, [hold, seat]);

  /* Stepping back out of the form gives the table up. The guest is browsing
     again, and a table nobody is filling a form for should not look busy to
     everybody else for another two and a half minutes. */
  const backToTable = useCallback(() => {
    setProblem(null);
    hold.release();
    setStep("table");
  }, [hold]);

  /* The table ran out while the form was open. Nothing to release — the server
     has already taken it back — so this only puts the guest on the floor with
     the refusal cleared and the card shut. */
  const chooseAgain = useCallback(() => {
    hold.forget();
    setProblem(null);
    setSeat(undefined);
    setStep("table");
  }, [hold]);

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

    /* The countdown on screen has already run out. Sending anyway would be
       refused on the other side — the server checks its own clock and its own
       stored expiry — so this saves a round trip and nothing else. It is not
       the check that matters; see the note at the top of use-seat-hold.ts. */
    if (hold.expired) {
      setProblem("hold-expired");
      return null;
    }

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
        /* HELD → RESERVED. The hold was spent on the other side as part of
           writing the booking down; forgetting it here stops the countdown and
           keeps the next availability poll from reading its absence as an
           expiry over the top of the confirmation. */
        hold.forget();
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

      /* THE SERVER'S WORD ON THE THREE MINUTES, and the one that counts. Both
         of its hold refusals land the guest in the same place — the table is
         not theirs and they choose again — so both are read as expiry. A
         `hold-invalid` should not be reachable from this site at all; it means
         a live hold on that table belongs to some other session. */
      const reason = body?.reason;
      if (reason === "hold-expired" || reason === "hold-invalid") {
        hold.forget();
        setProblem("hold-expired");
        return null;
      }

      const known: BookingProblem[] = ["duplicate", "seat-taken", "unavailable"];
      setProblem(
        reason && known.includes(reason as BookingProblem)
          ? (reason as BookingProblem)
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
  }, [event.slug, guests, hold, seat, sending, values]);

  const reset = useCallback(() => {
    hold.release();
    setSeat(undefined);
    setGuests(0);
    setStep("table");
    setValues(EMPTY);
    setErrors({});
    setProblem(null);
  }, [hold]);

  /* WHAT THE FLOOR PLAN'S POLL FEEDS BACK IN — the server's own reading of the
     room, every few seconds, and the thing that keeps the countdown honest
     across a refresh, a sleeping laptop or a hold that quietly ran out.
     A finished reservation is left alone: the hold is gone from the server by
     then, and reading that as an expiry would put a refusal over the top of
     the guest's confirmation. */
  const syncFloor = useCallback(
    (snapshot: FloorSnapshot & { serverNow?: string; holdExpiresAt?: string }) => {
      if (step === "sent") return;
      hold.sync(snapshot);
    },
    [hold, step],
  );

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
    chooseAgain,
    set,
    blur,
    submit,
    reset,
    /* The three minutes, for whoever is drawing them. */
    hold: hold.held,
    holdSeconds: hold.secondsLeft,
    holdExpired: hold.expired,
    taking: hold.taking,
    syncFloor,
  };
}
