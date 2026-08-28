"use client";

import { useActionState } from "react";
import { Field, FormSection } from "@/components/admin/shell";
import { newEvent } from "@/app/(operations)/admin/actions";

/* A NIGHT ADDED FROM THE OFFICE.
 *
 * It arrives `draft` and the form says so, because a night that went on sale
 * the instant somebody typed a name — no poster, no price checked, no door
 * time — is how a club sells tickets to the wrong evening. Putting it on sale
 * is a second, deliberate step on the night's own page.
 *
 * The same three sections as the editor, in the same order, so the two forms
 * are one thing learned once. Everything typed here is checked again on the
 * server; the slug in particular is validated rather than sanitised, so nobody
 * ends up with a night whose URL is not what they typed. */
export function EventCreateForm() {
  const [state, action, pending] = useActionState<
    { ok?: string; error?: string },
    FormData
  >(newEvent, {});

  return (
    <form action={action} className="px-[1.125rem] py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormSection title="Osnovno" />

        <Field label="Naziv" htmlFor="new-title">
          <input
            id="new-title"
            name="title"
            required
            placeholder="Saturday Madness"
            className="adm-field"
          />
        </Field>

        <Field label="Slug" htmlFor="new-slug" hint="Mala slova, brojevi i crtice.">
          <input
            id="new-slug"
            name="slug"
            required
            pattern="[a-z0-9-]+"
            placeholder="saturday-madness"
            className="adm-field font-mono"
          />
        </Field>

        <Field label="Poster (putanja u /public)" htmlFor="new-image" hint="Nije obavezno.">
          <input
            id="new-image"
            name="image"
            placeholder="/dogadjaji/madness.jpg"
            className="adm-field"
          />
        </Field>

        <FormSection title="Vreme" />

        <Field label="Početak" htmlFor="new-startsAt">
          <input
            id="new-startsAt"
            name="startsAt"
            type="datetime-local"
            required
            className="adm-field"
          />
        </Field>

        <Field label="Vrata se otvaraju" htmlFor="new-doorsAt" hint="Nije obavezno.">
          <input id="new-doorsAt" name="doorsAt" type="datetime-local" className="adm-field" />
        </Field>

        <FormSection title="Prodaja i kapacitet" />

        <Field label="Cena ulaznice (RSD)" htmlFor="new-price">
          <input
            id="new-price"
            name="ticketPrice"
            type="number"
            min={0}
            defaultValue={0}
            required
            className="adm-field"
          />
        </Field>

        <Field label="Kapacitet" htmlFor="new-capacity">
          <input
            id="new-capacity"
            name="capacity"
            type="number"
            min={0}
            defaultValue={300}
            required
            className="adm-field"
          />
        </Field>

        <Field label="Najviše po porudžbini" htmlFor="new-max">
          <input
            id="new-max"
            name="maxPerOrder"
            type="number"
            min={1}
            defaultValue={10}
            className="adm-field"
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--adm-line-soft)] pt-5">
        <p
          role="status"
          className={`max-w-[46ch] text-[0.8125rem] leading-relaxed ${
            state.error
              ? "text-[var(--adm-bad)]"
              : state.ok
                ? "text-[var(--adm-good)]"
                : "text-[var(--adm-ink-4)]"
          }`}
        >
          {state.error ??
            state.ok ??
            "Novo veče se upisuje kao nacrt — ne prodaje se dok ga ne otvorite."}
        </p>
        <button type="submit" disabled={pending} className="adm-btn adm-btn--primary">
          {pending ? "Upisujem…" : "Dodaj veče"}
        </button>
      </div>
    </form>
  );
}
