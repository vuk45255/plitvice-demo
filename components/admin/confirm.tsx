"use client";

import { useRef, type ReactNode } from "react";

/* ARE YOU SURE — WITHOUT `window.confirm`.
 *
 * The office has a handful of irreversible moves: cancelling a table,
 * rejecting one, voiding an order's tickets, lowering a night's capacity,
 * shutting its sale. All of them are made at one in the morning, on a phone,
 * next to a button that does something harmless. So all of them ask first, in
 * one dialog that looks like the rest of the building.
 *
 * WHY NOT `window.confirm`. It is the operating system's dialog, not the
 * club's: it cannot say what is about to happen in more than one line, it is
 * suppressible per-site in every browser (and once suppressed the action goes
 * through silently), and on iOS it steals the page's scroll position on the
 * way back. This is `<dialog>` — the platform's own modal, with the focus trap
 * and the Escape key already in it, and no library.
 *
 * THE DANGEROUS BUTTON IS CLEAR BUT NOT SHOUTING. Red text on a hairline of
 * red, next to a quiet "Odustani" that is deliberately the easier target. A
 * solid red block would be read as the primary action, which is exactly
 * backwards.
 *
 * IT IS A COURTESY AND NOT A CONTROL. Every action behind one of these
 * re-checks the staff session on the server, because a dialog is a thing in a
 * browser and a server action is a public endpoint. */
export function Confirm({
  question,
  detail,
  confirmLabel,
  cancelLabel = "Odustani",
  tone = "danger",
  trigger,
  children,
}: {
  question: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "plain";
  /* What the trigger says, when it should not simply repeat the confirm. */
  trigger?: string;
  /* The button that actually submits — rendered inside the dialog, so it
     carries the form's own submit and this component never needs to know
     which action it is guarding. */
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`adm-btn adm-btn--sm ${tone === "danger" ? "adm-btn--danger" : ""}`}
      >
        {trigger ?? confirmLabel}
      </button>

      <dialog ref={dialog} className="adm adm-dialog">
        <div className="px-5 py-5">
          <p className="text-[1rem] leading-snug text-[var(--adm-ink)]">{question}</p>
          {detail ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--adm-ink-3)]">
              {detail}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="adm-btn"
            >
              {cancelLabel}
            </button>
            {/* Closing on the way out, so the dialog is not left open behind a
                page that has already changed underneath it. */}
            <span onClick={() => dialog.current?.close()}>{children}</span>
          </div>
        </div>
      </dialog>
    </>
  );
}
