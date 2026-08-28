"use client";

import { useActionState, useRef, useState } from "react";
import { Confirm } from "@/components/admin/confirm";
import {
  changeReservation,
  editReservationDetails,
  resendReservationMail,
} from "@/app/(operations)/admin/actions";
import type { ReservationStatus } from "@/lib/reservations/types";

/* Confirm, reject, cancel — and correct.
 *
 * NOTHING IS EVER DELETED. A rejected booking keeps its row and its time; what
 * changes is that the partial unique index in lib/db/schema.ts stops covering
 * it, so the table goes back on the map the same second. History is what the
 * club wants when somebody rings up asking why nobody called them back.
 *
 * ═══ WHAT IS OFFERED, AND HOW LOUDLY ══════════════════════════════════════
 *
 * Only the moves that make sense from where the booking is — a confirmed
 * booking has no "confirm" button — and only ONE of them is primary. Confirming
 * is the move staff make forty times a night, so it is the gold one; rejecting
 * and cancelling sit next to it in quiet red; correcting and re-sending are
 * ghosts, because they are rare and must not compete.
 *
 * The two that take a table away from somebody who thinks they have it ask
 * first, in the office's own dialog. Confirming does not: it is undoable and it
 * is the whole job.
 *
 * Every one of these re-checks the staff session on the server. A dialog is a
 * thing in a browser; a server action is a public endpoint. */

const MOVES: Record<
  ReservationStatus,
  {
    to: ReservationStatus;
    label: string;
    primary?: boolean;
    confirm?: string;
    detail?: string;
  }[]
> = {
  pending: [
    { to: "confirmed", label: "Potvrdi", primary: true },
    {
      to: "rejected",
      label: "Odbij",
      confirm: "Odbiti ovu rezervaciju?",
      detail:
        "Sto se odmah vraća na plan. Gost ne dobija nikakvu poruku — javite mu telefonom.",
    },
  ],
  confirmed: [
    {
      to: "cancelled",
      label: "Otkaži",
      confirm: "Otkazati potvrđenu rezervaciju?",
      detail:
        "Gostu je već potvrđeno da ima sto. Sto se odmah oslobađa; obavezno ga pozovite.",
    },
  ],
  rejected: [{ to: "confirmed", label: "Ipak potvrdi", primary: true }],
  cancelled: [{ to: "confirmed", label: "Vrati", primary: true }],
  expired: [{ to: "confirmed", label: "Vrati", primary: true }],
};

type State = { ok?: string; error?: string };

export function ReservationActions({
  id,
  status,
  hasEmail,
}: {
  id: string;
  status: ReservationStatus;
  hasEmail?: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    changeReservation,
    {},
  );
  const [mail, mailAction, mailing] = useActionState<State, FormData>(
    resendReservationMail,
    {},
  );
  const dialog = useRef<HTMLDialogElement>(null);

  const said = state.error ?? state.ok ?? mail.error ?? mail.ok;
  const bad = Boolean(state.error ?? mail.error);

  return (
    <div className="flex min-w-[7rem] flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {MOVES[status].map((move) => {
          const button = (
            <button
              type="submit"
              disabled={pending}
              className={`adm-btn adm-btn--sm ${
                move.primary ? "adm-btn--primary" : "adm-btn--danger"
              }`}
            >
              {pending ? "…" : move.label}
            </button>
          );

          return (
            <form key={move.to} action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={move.to} />
              {move.confirm ? (
                <Confirm
                  question={move.confirm}
                  detail={move.detail}
                  confirmLabel={move.label}
                >
                  {button}
                </Confirm>
              ) : (
                button
              )}
            </form>
          );
        })}

        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="adm-btn adm-btn--ghost adm-btn--sm"
        >
          Izmeni
        </button>

        {hasEmail ? (
          <form action={mailAction}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={mailing}
              className="adm-btn adm-btn--ghost adm-btn--sm"
            >
              {mailing ? "…" : "Pošalji potvrdu"}
            </button>
          </form>
        ) : null}
      </div>

      {said ? (
        <p
          role="status"
          className={`text-[0.6875rem] leading-snug ${
            bad ? "text-[var(--adm-bad)]" : "text-[var(--adm-good)]"
          }`}
        >
          {said}
        </p>
      ) : null}

      <EditDialog id={id} dialog={dialog} />
    </div>
  );
}

/* Correcting what was written down, in the same dialog shape as everything
 * else in the office.
 *
 * Deliberately only the fields that get misheard on a telephone. The table and
 * the night are not here: moving a booking to another table is a NEW booking on
 * a table that has to be free, and that goes through the same claim and the
 * same unique index as everything else.
 *
 * A field left empty means "leave it alone" — the server treats it that way
 * too — so staff can open this, fix one digit of a telephone number and save. */
function EditDialog({
  id,
  dialog,
}: {
  id: string;
  dialog: React.RefObject<HTMLDialogElement | null>;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    editReservationDetails,
    {},
  );
  const [done, setDone] = useState(false);

  return (
    <dialog ref={dialog} className="adm adm-dialog">
      <form
        action={action}
        onSubmit={() => {
          setDone(true);
          setTimeout(() => dialog.current?.close(), 600);
        }}
        className="px-5 py-5"
      >
        <p className="text-[1rem] text-[var(--adm-ink)]">Izmena rezervacije</p>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--adm-ink-3)]">
          Popunite samo ono što menjate. Sto i veče se ne menjaju ovde — za drugi
          sto upišite novu rezervaciju.
        </p>

        <input type="hidden" name="id" value={id} />

        <div className="mt-5 grid gap-3">
          <Small name="name" label="Ime i prezime" />
          <Small name="phone" label="Telefon" type="tel" />
          <Small name="email" label="Email" type="email" />
          <Small name="guests" label="Broj osoba" type="number" />
          <Small name="note" label="Napomena" />
        </div>

        {state.error ? (
          <p className="mt-4 text-[0.75rem] text-[var(--adm-bad)]">{state.error}</p>
        ) : null}
        {state.ok && done ? (
          <p className="mt-4 text-[0.75rem] text-[var(--adm-good)]">{state.ok}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="adm-btn"
          >
            Zatvori
          </button>
          <button type="submit" disabled={pending} className="adm-btn adm-btn--primary">
            {pending ? "…" : "Sačuvaj"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Small({
  name,
  label,
  type = "text",
}: {
  name: string;
  label: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="adm-label">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete="off"
        className="adm-field mt-1.5"
      />
    </label>
  );
}
