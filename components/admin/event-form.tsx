"use client";

import { useActionState, useState } from "react";
import { Confirm } from "@/components/admin/confirm";
import { Field, FormSection } from "@/components/admin/shell";
import { saveEvent } from "@/app/(operations)/admin/actions";
import { wallClock } from "@/lib/ticketing/copy";
import type { TicketingEvent } from "@/lib/ticketing/events";

/* THE ONLY WAY A NIGHT CHANGES.
 *
 * FOUR SECTIONS, NOT FIFTEEN INPUTS. Osnovno is what the night is called;
 * Vreme is when it happens; Prodaja is whether money may be taken and at what
 * price; Kapacitet is how many may come in. Somebody opening this to change a
 * price should be able to find the price without reading the whole form.
 *
 * No validation of its own worth mentioning — `required` and `min` are a
 * courtesy to whoever is typing, and every judgement that matters is made on
 * the server: the capacity floor lives in `updateEvent`, which is the one
 * function that writes to this table, so it cannot be edited out with a
 * browser's developer tools or forgotten by a second screen.
 *
 * ═══ THE TWO CHANGES THAT ASK FIRST ═══════════════════════════════════════
 *
 * Lowering a capacity and taking a night out of sale are both quiet, both
 * irreversible in the sense that matters (the guests who could not buy have
 * gone elsewhere), and both one keystroke away from a routine edit. So they
 * ask — see components/admin/confirm.tsx — and everything else saves straight
 * away, because a dialog on every save is a dialog nobody reads.
 *
 * ═══ THE SLUG ═════════════════════════════════════════════════════════════
 *
 * Editable, and warned about. It is the public address of the night and the one
 * field shared with the poster wall in lib/events.ts — renaming it means every
 * link the club has posted stops working and the wall stops matching. The ID is
 * not editable and never will be: it is what every order and ticket ever sold
 * is filed under. */

const STATUSES: { value: TicketingEvent["status"]; label: string }[] = [
  { value: "draft", label: "Nacrt — sistem zna za veče, ne prodaje ga" },
  { value: "on_sale", label: "U prodaji" },
  { value: "sold_out", label: "Rasprodato — ručno zatvoreno" },
  { value: "ended", label: "Završeno" },
];

export function EventForm({ event, taken }: { event: TicketingEvent; taken: number }) {
  const [state, action, pending] = useActionState<
    { ok?: string; error?: string },
    FormData
  >(saveEvent, {});

  const [capacity, setCapacity] = useState(String(event.capacity));
  const [status, setStatus] = useState<TicketingEvent["status"]>(event.status);

  const lowering = Number(capacity) < event.capacity;
  const closing = event.status === "on_sale" && status !== "on_sale";
  const risky = lowering || closing;

  const submit = (
    <button type="submit" disabled={pending} className="adm-btn adm-btn--primary">
      {pending ? "Čuvam…" : "Sačuvaj"}
    </button>
  );

  return (
    <form action={action} className="px-[1.125rem] py-5">
      <input type="hidden" name="id" value={event.id} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormSection title="Osnovno" />

        <Field label="Naziv" htmlFor="title">
          <input id="title" name="title" defaultValue={event.title} required className="adm-field" />
        </Field>

        <Field
          label="Slug"
          htmlFor="slug"
          hint="Javna adresa večeri. Menjajte samo pre objave."
        >
          <input
            id="slug"
            name="slug"
            defaultValue={event.slug}
            pattern="[a-z0-9-]+"
            className="adm-field font-mono"
          />
        </Field>

        <Field label="Poster (putanja u /public)" htmlFor="image" hint="Npr. /dogadjaji/madness.jpg">
          <input id="image" name="image" defaultValue={event.image ?? ""} className="adm-field" />
        </Field>

        <Field label="Opis" htmlFor="description">
          <input
            id="description"
            name="description"
            defaultValue={event.description ?? ""}
            className="adm-field"
          />
        </Field>

        <FormSection title="Vreme" />

        <Field label="Početak" htmlFor="startsAt">
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={localValue(event.startsAt)}
            className="adm-field"
          />
        </Field>

        <Field label="Vrata se otvaraju" htmlFor="doorsAt" hint="Prazno = isto kao početak.">
          <input
            id="doorsAt"
            name="doorsAt"
            type="datetime-local"
            defaultValue={localValue(event.doorsAt)}
            className="adm-field"
          />
        </Field>

        <FormSection title="Prodaja karata" />

        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketingEvent["status"])}
            className="adm-field"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Cena ulaznice (RSD)"
          htmlFor="ticketPrice"
          hint="Nula znači da veče ne može biti u prodaji."
        >
          <input
            id="ticketPrice"
            name="ticketPrice"
            type="number"
            min={0}
            defaultValue={event.ticketPrice}
            className="adm-field"
          />
        </Field>

        <Field label="Prodaja počinje" htmlFor="salesStart" hint="Prazno = odmah.">
          <input
            id="salesStart"
            name="salesStart"
            type="datetime-local"
            defaultValue={localValue(event.salesStart)}
            className="adm-field"
          />
        </Field>

        <Field label="Prodaja se zatvara" htmlFor="salesEnd" hint="Prazno = do početka večeri.">
          <input
            id="salesEnd"
            name="salesEnd"
            type="datetime-local"
            defaultValue={localValue(event.salesEnd)}
            className="adm-field"
          />
        </Field>

        <FormSection title="Kapacitet" />

        <Field
          label="Kapacitet"
          htmlFor="capacity"
          hint={`Trenutno zauzeto: ${taken}. Server odbija svaki manji broj.`}
        >
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={taken}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="adm-field"
          />
        </Field>

        <Field label="Najviše po porudžbini" htmlFor="maxPerOrder">
          <input
            id="maxPerOrder"
            name="maxPerOrder"
            type="number"
            min={1}
            defaultValue={event.maxPerOrder}
            className="adm-field"
          />
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

        {risky ? (
          <Confirm
            tone="danger"
            trigger="Sačuvaj"
            confirmLabel="Sačuvaj izmene"
            question={
              lowering
                ? `Smanjiti kapacitet sa ${event.capacity} na ${capacity || "—"}?`
                : "Zatvoriti prodaju za ovo veče?"
            }
            detail={
              lowering
                ? `Već je prodato/rezervisano ${taken}. Server odbija svaki kapacitet ispod tog broja — postojeće karte ostaju važeće u svakom slučaju.`
                : "Sajt prestaje da prodaje ulaznice za ovo veče. Već prodate karte ostaju važeće."
            }
          >
            {submit}
          </Confirm>
        ) : (
          submit
        )}
      </div>
    </form>
  );
}

/* `datetime-local` wants the club's own wall clock, not UTC. Shown in Belgrade
   so that what somebody reads is the hour they meant, and turned back into a
   real instant on the server — see `belgradeInstant`. */
function localValue(iso: string | undefined): string {
  return iso ? wallClock(new Date(iso)) : "";
}
