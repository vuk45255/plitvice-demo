"use client";

import { useActionState } from "react";
import { Confirm } from "@/components/admin/confirm";
import { refund, resend } from "@/app/(operations)/admin/actions";

/* The two things staff do to an order after the fact.
 *
 * REFUNDING HERE DOES NOT MOVE MONEY. It cancels the tickets so they stop
 * working at the door and marks the order refunded; the money goes back
 * through whoever took it. Saying so on the button is the point — a member of
 * staff who thinks this refunded a card is a member of staff who will not do
 * it properly, and the guest finds out three weeks later.
 *
 * THE REFUND ASKS FIRST, in the club's own dialog rather than the browser's —
 * see components/admin/confirm.tsx. It is the one irreversible action in the
 * office, it sits next to a button called "send again", and it is pressed at
 * one in the morning. "Send again" is a ghost button for the same reason:
 * these two must not look like a pair. */

type State = { ok?: string; error?: string };

export function OrderActions({
  reference,
  canRefund,
  canResend,
}: {
  reference: string;
  canRefund: boolean;
  canResend: boolean;
}) {
  const [refundState, refundAction, refunding] = useActionState<State, FormData>(
    refund,
    {},
  );
  const [resendState, resendAction, resending] = useActionState<State, FormData>(
    resend,
    {},
  );

  const said = refundState.error ?? refundState.ok ?? resendState.error ?? resendState.ok;
  const bad = Boolean(refundState.error ?? resendState.error);

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canResend ? (
          <form action={resendAction}>
            <input type="hidden" name="reference" value={reference} />
            <button
              type="submit"
              disabled={resending}
              className="adm-btn adm-btn--ghost adm-btn--sm"
            >
              {resending ? "Šaljem…" : "Pošalji karte ponovo"}
            </button>
          </form>
        ) : null}

        {canRefund ? (
          <form action={refundAction}>
            <input type="hidden" name="reference" value={reference} />
            <Confirm
              trigger="Poništi karte"
              confirmLabel="Poništi karte"
              question="Poništiti sve karte ove porudžbine?"
              detail="Karte odmah prestaju da važe na ulazu. Novac se NE vraća automatski — to se radi kod pružaoca plaćanja."
            >
              <button
                type="submit"
                disabled={refunding}
                className="adm-btn adm-btn--danger"
              >
                {refunding ? "…" : "Poništi"}
              </button>
            </Confirm>
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
    </div>
  );
}
