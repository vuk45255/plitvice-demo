"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Confirm } from "@/components/admin/confirm";
import {
  archiveNight,
  duplicateNight,
  removeNight,
  restoreNight,
  setEventStatus,
  type EventActionState,
} from "@/app/(operations)/admin/dogadjaji/actions";
import { ACTION_LABELS, type EventAction } from "@/lib/club/event-manager";

/* WHAT A NIGHT CAN BE DONE TO, FROM A LIST.
 *
 * ═══ WHAT IS LOUD AND WHAT IS NOT ═════════════════════════════════════════
 *
 * Two buttons and a three-dot menu. UREDI is the one staff press forty times a
 * week and OBJAVI / PAUZIRAJ is the one that changes what the public can do, so
 * those are the two that get a shape; everything else — pregled, dupliraj,
 * zatvori, arhiviraj, obriši — lives behind the dots. A row with seven buttons
 * on it is a row nobody reads, and on a 390px screen it is a row that wraps
 * into four lines.
 *
 * Which moves are offered is NOT decided here. `actionsFor` in
 * lib/club/event-manager.ts knows what makes sense from where a night is, and
 * this component renders the answer — so a second screen showing the same night
 * cannot offer a different set.
 *
 * ═══ THE MENU IS A <details> ══════════════════════════════════════════════
 *
 * The browser's own disclosure widget: it opens on click and on Enter, closes
 * on Escape, and is announced correctly, with no state to manage and no library
 * under it. The whole office chrome is built this way — every kilobyte is a
 * kilobyte a manager's phone loads on one bar of signal.
 *
 * ═══ THE THREE THAT ASK FIRST ═════════════════════════════════════════════
 *
 * Closing a sale, archiving and deleting all change something a guest can see
 * and all sit one tap away from something harmless, so all three ask — in the
 * office's own dialog, saying what will actually happen. Publishing does not:
 * it is undoable in one tap and it is the job.
 *
 * Every one of these re-checks the staff session on the server. A menu is a
 * thing in a browser; a server action is a public endpoint. */

export function EventActions({
  id,
  slug,
  primary,
  more,
  compact = false,
}: {
  id: string;
  slug: string;
  primary: EventAction[];
  more: EventAction[];
  /* A list row is compact; a night's own page has room. */
  compact?: boolean;
}) {
  const size = compact ? "adm-btn--sm" : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary.map((action) => (
        <PrimaryAction key={action} action={action} id={id} size={size} />
      ))}

      {more.length > 0 ? (
        <details className="adm-menu">
          <summary aria-label="Još radnji">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </summary>
          <div className="adm-menu-list">
            {more.map((action) => (
              <MoreAction key={action} action={action} id={id} slug={slug} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ── the one or two that get a shape ────────────────────────────────────── */

function PrimaryAction({
  action,
  id,
  size,
}: {
  action: EventAction;
  id: string;
  size: string;
}) {
  if (action === "edit") {
    return (
      <Link href={`/admin/dogadjaji/${id}`} className={`adm-btn ${size}`}>
        {ACTION_LABELS.edit}
      </Link>
    );
  }

  if (action === "publish") {
    return (
      <StatusButton
        id={id}
        status="on_sale"
        label={ACTION_LABELS.publish}
        className={`adm-btn adm-btn--primary ${size}`}
      />
    );
  }

  if (action === "pause") {
    /* PAUSING IS NOT ENDING. It puts the night back to draft: the sale stops,
       the night stands, and one tap puts it back. Said in the dialog, because
       "pause" and "close" are one word apart and four hours of sales apart. */
    return (
      <Confirm
        trigger={ACTION_LABELS.pause}
        confirmLabel="Pauziraj"
        question="Pauzirati prodaju karata?"
        detail="Veče ostaje, ali se karte više ne prodaju dok ga ponovo ne objavite. Već prodate karte i dalje važe."
      >
        <StatusButton
          id={id}
          status="draft"
          label="Pauziraj"
          className="adm-btn adm-btn--danger adm-btn--sm"
        />
      </Confirm>
    );
  }

  if (action === "restore") {
    return <FormButton action={restoreNight} id={id} label={ACTION_LABELS.restore} primary />;
  }

  return null;
}

/* ── everything behind the dots ─────────────────────────────────────────── */

function MoreAction({
  action,
  id,
  slug,
}: {
  action: EventAction;
  id: string;
  slug: string;
}) {
  if (action === "preview") {
    return (
      <Link href={`/admin/dogadjaji/${id}/pregled`}>{ACTION_LABELS.preview}</Link>
    );
  }

  if (action === "duplicate") {
    return <MenuForm action={duplicateNight} id={id} label={ACTION_LABELS.duplicate} />;
  }

  if (action === "close") {
    return (
      <Confirm
        trigger={ACTION_LABELS.close}
        confirmLabel="Zatvori prodaju"
        question="Zatvoriti prodaju za ovo veče?"
        detail="Veče se označava kao završeno i sajt prestaje da prodaje ulaznice. Već prodate karte ostaju važeće i i dalje se skeniraju."
      >
        <StatusButton
          id={id}
          status="ended"
          label="Zatvori prodaju"
          className="adm-btn adm-btn--danger adm-btn--sm"
        />
      </Confirm>
    );
  }

  if (action === "archive") {
    return (
      <Confirm
        trigger={ACTION_LABELS.archive}
        confirmLabel="Arhiviraj"
        question="Arhivirati ovo veče?"
        detail="Sklanja se sa radne liste. Porudžbine, ulaznice, skeniranja i rezervacije ostaju netaknuti — arhiviranje ništa ne briše i uvek se može poništiti."
      >
        <FormSubmit action={archiveNight} id={id} label="Arhiviraj" />
      </Confirm>
    );
  }

  if (action === "delete") {
    return (
      <Confirm
        trigger={ACTION_LABELS.delete}
        confirmLabel="Obriši trajno"
        question="Trajno obrisati ovaj draft?"
        detail="Moguće je samo za veče koje nema nijednu porudžbinu, ulaznicu ni rezervaciju. Ako ih ima, server odbija brisanje i predlaže arhiviranje."
      >
        <FormSubmit action={removeNight} id={id} label="Obriši" danger />
      </Confirm>
    );
  }

  if (action === "restore") {
    return <MenuForm action={restoreNight} id={id} label={ACTION_LABELS.restore} />;
  }

  /* `slug` is carried for the day a menu item links at the public page by
     address rather than by id. */
  void slug;
  return null;
}

/* ── the small pieces ───────────────────────────────────────────────────── */

type Action = (
  previous: EventActionState,
  form: FormData,
) => Promise<EventActionState>;

function StatusButton({
  id,
  status,
  label,
  className,
}: {
  id: string;
  status: string;
  label: string;
  className: string;
}) {
  const [, action, pending] = useActionState<EventActionState, FormData>(
    setEventStatus,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? "…" : label}
      </button>
    </form>
  );
}

function FormButton({
  action,
  id,
  label,
  primary,
}: {
  action: Action;
  id: string;
  label: string;
  primary?: boolean;
}) {
  const [, submit, pending] = useActionState<EventActionState, FormData>(action, {});
  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={`adm-btn adm-btn--sm ${primary ? "adm-btn--primary" : ""}`}
      >
        {pending ? "…" : label}
      </button>
    </form>
  );
}

/* A menu item that posts. Styled as a row rather than a button, because inside
   the menu everything is a row. */
function MenuForm({ action, id, label }: { action: Action; id: string; label: string }) {
  const [, submit, pending] = useActionState<EventActionState, FormData>(action, {});
  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending}>
        {pending ? "…" : label}
      </button>
    </form>
  );
}

/* The submit that lives INSIDE a Confirm dialog. It carries its own form, so
   the dialog never has to know which action it is guarding. */
function FormSubmit({
  action,
  id,
  label,
  danger,
}: {
  action: Action;
  id: string;
  label: string;
  danger?: boolean;
}) {
  const [, submit, pending] = useActionState<EventActionState, FormData>(action, {});
  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={`adm-btn adm-btn--sm ${danger ? "adm-btn--danger" : ""}`}
      >
        {pending ? "…" : label}
      </button>
    </form>
  );
}
