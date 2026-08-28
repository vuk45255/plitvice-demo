"use client";

import { useActionState, useEffect, useState } from "react";
import { addReservation } from "@/app/(operations)/admin/actions";
import { Field, FormSection } from "@/components/admin/shell";
import type { AdminSeat } from "@/lib/reservations/admin";

/* A BOOKING TAKEN OVER THE TELEPHONE — the fastest form in the building.
 *
 * Somebody is on the line. The order of the fields is the order of the
 * conversation: which table, then who, then how many, then anything else. The
 * night is already chosen by the page and is shown rather than asked, because
 * staff opened this from that night's screen.
 *
 * It writes to THE SAME TABLE as a booking made on the site, under the same
 * partial unique index — which is the entire reason this form exists here
 * rather than in a notebook behind the bar. A separe promised on the telephone
 * disappears from the map the moment this is submitted.
 *
 * ═══ A TABLE SOMEBODY IS BOOKING RIGHT NOW ════════════════════════════════
 *
 * Held tables are LISTED, MARKED IN AMBER AND COUNTED DOWN rather than hidden.
 * Staff can see that S12 comes back in a minute and forty and say so to the
 * person on the telephone — which is the useful thing — but the option is
 * `disabled`, and the server refuses to write over a live hold in any case, so
 * nothing is taken out from under a guest who may be typing their number into
 * the site at that moment.
 *
 * THE COUNTDOWN IS A PICTURE. It is drawn from `expiresAt - serverNow`, both
 * sent by the server, so a laptop whose clock is twenty minutes fast still
 * shows the truth; and when it reaches zero nothing here changes — the table is
 * free when the DATABASE says it is, which the next page load asks.
 *
 * Reserved tables are not offered at all: they are gone, not busy. */

export function PhoneReservationForm({
  eventId,
  seats,
  serverNow,
  preselected,
}: {
  eventId: string;
  seats: AdminSeat[];
  /* The server's own clock at the moment this page was built. */
  serverNow: string;
  /* Arrives from the floor map — "new reservation" on a free table lands here
     with that table already chosen. */
  preselected?: string;
}) {
  const [state, action, pending] = useActionState<
    { ok?: string; error?: string },
    FormData
  >(addReservation, {});

  const offered = seats.filter((seat) => seat.state !== "reserved");
  const free = offered.filter((seat) => seat.state === "available");
  const held = offered.filter((seat) => seat.state === "held");

  const [seatId, setSeatId] = useState(
    preselected && free.some((s) => s.id === preselected)
      ? preselected
      : free[0]?.id ?? "",
  );
  const seat = free.find((s) => s.id === seatId) ?? free[0];

  if (free.length === 0 && held.length === 0) {
    return (
      <p className="px-[1.125rem] py-8 text-[0.875rem] text-[var(--adm-ink-3)]">
        Nema slobodnih stolova za ovo veče.
      </p>
    );
  }

  return (
    <form action={action} className="px-[1.125rem] py-5">
      <input type="hidden" name="eventId" value={eventId} />

      {held.length > 0 ? (
        <div className="mb-6 rounded-[3px] border border-[rgba(224,170,98,0.28)] bg-[rgba(224,170,98,0.06)] px-4 py-3">
          <p className="text-[0.5625rem] uppercase tracking-[0.24em] text-[var(--adm-warn)]">
            Privremeno zadržano na sajtu
          </p>
          <ul className="mt-2 space-y-1">
            {held.map((s) => (
              <li key={s.id} className="text-[0.8125rem] text-[var(--adm-warn)]">
                Sto {s.number} je privremeno zadržan još{" "}
                <Countdown until={s.heldUntil} serverNow={serverNow} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--adm-ink-3)]">
            Ne može se upisati dok traje. Ponudite gostu drugi sto ili sačekajte
            da istekne.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormSection title="Sto" />

        <Field
          label="Sto / separe"
          htmlFor="seatId"
          hint={`Slobodno: ${free.length}`}
        >
          <select
            id="seatId"
            name="seatId"
            value={seatId}
            onChange={(e) => setSeatId(e.target.value)}
            className="adm-field"
          >
            {offered.map((s) => (
              <option key={s.id} value={s.id} disabled={s.state === "held"}>
                {s.number} · {kindOf(s.type)} ({s.capacity.min}–{s.capacity.max})
                {s.state === "held" ? " — zadržan" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Broj osoba" htmlFor="guests">
          <input
            id="guests"
            name="guests"
            type="number"
            min={seat?.capacity.min ?? 1}
            max={seat?.capacity.max ?? 20}
            defaultValue={seat?.capacity.min ?? 2}
            key={seatId}
            className="adm-field"
          />
        </Field>

        <FormSection title="Gost" />

        <Field label="Ime i prezime" htmlFor="name">
          <input id="name" name="name" required autoComplete="off" className="adm-field" />
        </Field>

        <Field label="Telefon" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="off"
            inputMode="tel"
            className="adm-field"
          />
        </Field>

        <Field label="Email" htmlFor="email" hint="Nije obavezno — potvrda ide na njega.">
          <input id="email" name="email" type="email" autoComplete="off" className="adm-field" />
        </Field>

        <Field label="Napomena" htmlFor="note">
          <input id="note" name="note" autoComplete="off" className="adm-field" />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--adm-line-soft)] pt-5">
        <p
          role="status"
          className={`text-[0.8125rem] leading-relaxed ${
            state.error ? "text-[var(--adm-bad)]" : "text-[var(--adm-good)]"
          }`}
        >
          {state.error ?? state.ok ?? ""}
        </p>
        <button type="submit" disabled={pending} className="adm-btn adm-btn--primary">
          {pending ? "Upisujem…" : "Potvrdi rezervaciju"}
        </button>
      </div>
    </form>
  );
}

/* mm:ss, from the server's clock rather than this machine's. */
function Countdown({
  until,
  serverNow,
}: {
  until: string | undefined;
  serverNow: string;
}) {
  const [left, setLeft] = useState(() => remaining(until, serverNow, Date.now()));

  useEffect(() => {
    const skew = Date.parse(serverNow) - Date.now();
    const id = setInterval(
      () => setLeft(remaining(until, serverNow, Date.now() + skew, true)),
      1000,
    );
    return () => clearInterval(id);
  }, [until, serverNow]);

  return <span className="adm-figure tabular-nums">{left}</span>;
}

function remaining(
  until: string | undefined,
  serverNow: string,
  now: number,
  aligned = false,
): string {
  if (!until) return "—";
  const base = aligned ? now : Date.parse(serverNow);
  const seconds = Math.max(0, Math.ceil((Date.parse(until) - base) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/* The club's own words for the three kinds of place, rather than the column's
   English values. */
function kindOf(type: AdminSeat["type"]): string {
  return type === "booth" ? "separe" : type === "high" ? "visoki" : "šank";
}
