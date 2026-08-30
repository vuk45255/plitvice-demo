"use client";

import { useActionState, useState } from "react";
import { Field, FormSection, Notice } from "@/components/admin/shell";
import { PosterField } from "@/components/admin/poster-field";
import { SwitchSection } from "@/components/admin/switch";
import { saveEvent, type EventActionState } from "@/app/(operations)/admin/dogadjaji/actions";
import { wallClock } from "@/lib/ticketing/copy";
import { FLOOR_PLANS } from "@/lib/venue";
import type { TicketingEvent } from "@/lib/ticketing/events";

/* CREATING A NIGHT, AND CHANGING ONE — THE SAME FORM.
 *
 * ═══ WHY ONE COMPONENT AND NOT TWO ════════════════════════════════════════
 *
 * Because they are the same eighteen fields. Two nearly-identical forms is how
 * a night ends up with a dress code that saves when you edit it and vanishes
 * when you create it, and how the two drift a field at a time until nobody
 * knows which is right. Everything below is driven by whether an `event` was
 * handed in: the buttons at the bottom change, the slug appears, the capacity
 * gains a floor. Nothing else does.
 *
 * ═══ FIVE STEPS, NUMBERED, IN THE ORDER SOMEBODY THINKS ═══════════════════
 *
 *   1 OSNOVNO      what it is called and when it is
 *   2 POSTER       the artwork
 *   3 KARTE        whether money is taken, and how much — OFF by default
 *   4 REZERVACIJE  whether tables are booked — OFF by default
 *   5 DETALJI      everything optional
 *
 * ONLY STEP 1 IS REQUIRED. A name and a date is a night; a club can publish
 * that and fill the rest in later. Steps 3 and 4 are switches that start OFF
 * and hide everything under them until they are ON, so a free-entry night with
 * no tables is a form with four fields in it. That is what "under a minute"
 * actually means — not a faster form, a shorter one.
 *
 * ═══ SAVING IS NEVER PUBLISHING ═══════════════════════════════════════════
 *
 * The intent rides on the submit button's own `name`/`value`, so only the
 * button that says OBJAVI can publish. The SAVE button is FIRST in the DOM,
 * which is what a browser activates when somebody presses Enter in a text
 * field — so the accidental submit is always the safe one. The server treats
 * an unrecognised intent as "save" as well; see `intentOf`.
 *
 * ═══ NOTHING IS VALIDATED HERE THAT MATTERS ═══════════════════════════════
 *
 * `required` and `min` are a courtesy to whoever is typing. Every judgement is
 * made again on the server — the capacity floor in `updateEvent`, the file's
 * real bytes in lib/media/images.ts — because a server action is a public
 * endpoint and this component is a suggestion. */

export function EventEditor({
  event,
  taken = 0,
  posterDisabledReason,
}: {
  /* Absent when a night is being created. */
  event?: TicketingEvent;
  /* Admissions already sold or held, so the capacity field can say what the
     server is going to insist on. */
  taken?: number;
  /* Set when no object store is configured — passed down rather than read
     here, because environment variables are the server's business. */
  posterDisabledReason?: string;
}) {
  const [state, action, pending] = useActionState<EventActionState, FormData>(
    saveEvent,
    {},
  );

  const [capacity, setCapacity] = useState(String(event?.capacity ?? 300));
  const published = Boolean(event && event.status !== "draft");
  const clock = split(event?.startsAt);

  return (
    <form action={action} className="px-[1.125rem] py-5">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* ── 1 ───────────────────────────────────────────────────────── */}
        <Step no={1} title="Osnovno" />

        <Field label="Naziv događaja" htmlFor="title" full>
          <input
            id="title"
            name="title"
            defaultValue={event?.title ?? ""}
            required
            autoComplete="off"
            placeholder="Saturday Madness"
            className="adm-field"
          />
        </Field>

        <Field label="Datum" htmlFor="date">
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={clock.date}
            required
            className="adm-field"
          />
        </Field>

        <Field label="Vreme početka" htmlFor="startTime">
          <input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={clock.time || "23:00"}
            required
            className="adm-field"
          />
        </Field>

        {/* VREME OTVARANJA VRATA IS GONE. The club opens the doors when the
            night starts, so the form asked twice for one fact and every screen
            then had to decide which of the two to print. One time, on the row,
            everywhere. The column stays in the database untouched — dropping
            one from a live events table buys nothing — and nothing reads it. */}

        {/* The slug is the public address of the night. It is DERIVED from the
            title when a night is created — nobody should have to type a URL to
            put on a party — and only offered for editing afterwards, with the
            warning it deserves. */}
        {event ? (
          <Field
            label="Adresa (slug)"
            htmlFor="slug"
            hint="Javna adresa večeri. Izmena kvari sve već podeljene linkove."
          >
            <input
              id="slug"
              name="slug"
              defaultValue={event.slug}
              pattern="[a-z0-9-]+"
              className="adm-field font-mono"
            />
          </Field>
        ) : null}

        <Field label="Kratak opis" htmlFor="description" full>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={event?.description ?? ""}
            placeholder="Šta se dešava te večeri."
            className="adm-field"
          />
        </Field>

        {/* ── 2 ───────────────────────────────────────────────────────── */}
        <Step no={2} title="Poster" />
        <PosterField
          currentUrl={event?.image}
          disabledReason={posterDisabledReason}
        />

        {/* ── 3 ───────────────────────────────────────────────────────── */}
        <Step no={3} title="Karte" />
        <SwitchSection
          name="ticketingEnabled"
          label="Prodaja karata"
          hint="Uključite ako se ulaznice prodaju preko sajta. Isključeno = ulaz se naplaćuje na vratima."
          defaultChecked={event?.ticketingEnabled ?? false}
        >
          <Field
            label="Cena karte (RSD)"
            htmlFor="ticketPrice"
            hint="Nula znači da veče ne može biti u prodaji."
          >
            <input
              id="ticketPrice"
              name="ticketPrice"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={event?.ticketPrice ?? 0}
              className="adm-field"
            />
          </Field>

          <Field
            label="Kapacitet"
            htmlFor="capacity"
            hint={
              taken > 0
                ? `Trenutno prodato ili zadržano: ${taken}. Server odbija svaki manji broj.`
                : "Koliko ljudi može da uđe."
            }
          >
            <input
              id="capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={taken}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="adm-field"
            />
          </Field>

          <Field label="Početak prodaje" htmlFor="salesStart" hint="Prazno = odmah.">
            <input
              id="salesStart"
              name="salesStart"
              type="datetime-local"
              defaultValue={local(event?.salesStart)}
              className="adm-field"
            />
          </Field>

          <Field
            label="Kraj prodaje"
            htmlFor="salesEnd"
            hint="Prazno = do početka večeri."
          >
            <input
              id="salesEnd"
              name="salesEnd"
              type="datetime-local"
              defaultValue={local(event?.salesEnd)}
              className="adm-field"
            />
          </Field>

          <Field label="Najviše karata po porudžbini" htmlFor="maxPerOrder">
            <input
              id="maxPerOrder"
              name="maxPerOrder"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={event?.maxPerOrder ?? 10}
              className="adm-field"
            />
          </Field>

          {/* THE SEAM, SAID OUT LOUD. One kind of ticket today. The data layer
              already answers in a LIST — see `eventTiers` — so adding VIP and
              Early Bird later is a table and a repeat of these two fields,
              not a rebuild of this screen. Saying so here stops somebody
              designing around the absence. */}
          <p className="text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)] sm:col-span-2">
            Za sada postoji jedna vrsta ulaznice. Više tipova (VIP, Early Bird)
            dolazi kasnije i neće promeniti ovaj ekran.
          </p>
        </SwitchSection>

        {/* ── 4 ───────────────────────────────────────────────────────── */}
        <Step no={4} title="Rezervacije" />
        <SwitchSection
          name="tablesEnabled"
          label="Rezervacije stolova"
          hint="Gosti biraju sto na planu sale."
          defaultChecked={event?.tablesEnabled ?? false}
        >
          <Field label="Plan sale" htmlFor="floorPlan">
            <select
              id="floorPlan"
              name="floorPlan"
              defaultValue={event?.floorPlan ?? "default"}
              className="adm-field"
            >
              {/* THE UPSTAIRS IS LISTED AND CANNOT BE CHOSEN.
                  Hiding it would be a lie by omission — the club knows a
                  second level is coming and would ask where it is. Offering
                  it would be worse: there are no level-two tables drawn, so a
                  Saturday filed against it would open bookings onto an empty
                  room. So it is here, marked USKORO, and disabled. See
                  FLOOR_PLANS in lib/venue.ts, where `ready` is the one switch
                  that opens it. */}
              {FLOOR_PLANS.map((plan) => (
                <option key={plan.id} value={plan.id} disabled={!plan.ready}>
                  {plan.label}
                  {plan.ready ? "" : " — uskoro"}
                </option>
              ))}
            </select>
          </Field>

          {/* The paragraph that used to sit here explained to the OFFICE which
              layer of the codebase enforces table booking. That is a note for
              whoever maintains this, and it now lives where such notes belong:
              the gate the public booking flow reads is lib/reservations/gate.ts
              and the reasoning is written there. Staff get a switch that does
              what it says. */}
        </SwitchSection>

        {/* ── 5 ───────────────────────────────────────────────────────── */}
        <Step no={5} title="Detalji i promocija" />

        <Field label="DJ / izvođač" htmlFor="lineup">
          <input
            id="lineup"
            name="lineup"
            defaultValue={event?.lineup ?? ""}
            placeholder="DJ Wolf"
            className="adm-field"
          />
        </Field>

        <Field label="Uzrast" htmlFor="ageRestriction">
          <input
            id="ageRestriction"
            name="ageRestriction"
            defaultValue={event?.ageRestriction ?? ""}
            placeholder="18+"
            className="adm-field"
          />
        </Field>

        <Field label="Dress code" htmlFor="dressCode">
          <input
            id="dressCode"
            name="dressCode"
            defaultValue={event?.dressCode ?? ""}
            placeholder="Elegantno"
            className="adm-field"
          />
        </Field>

        <Field label="Napomena o ulazu" htmlFor="entryNote">
          <input
            id="entryNote"
            name="entryNote"
            defaultValue={event?.entryNote ?? ""}
            placeholder="Ulaz besplatan"
            className="adm-field"
          />
        </Field>

        <Field label="Promocija" htmlFor="promotion">
          <input
            id="promotion"
            name="promotion"
            defaultValue={event?.promotion ?? ""}
            placeholder="1 na 1 do pola 1"
            className="adm-field"
          />
        </Field>
      </div>

      {state.error ? (
        <div className="mt-6">
          <Notice>{state.error}</Notice>
        </div>
      ) : null}

      {/* ── saving ──────────────────────────────────────────────────────
          On a phone this bar sticks to the bottom of the screen, because the
          alternative is scrolling past five sections to find the button. */}
      <div className="adm-savebar">
        <p
          role="status"
          aria-live="polite"
          className="mr-auto text-[0.75rem] leading-relaxed text-[var(--adm-good)]"
        >
          {state.ok ?? ""}
        </p>

        {/* FIRST IN THE DOM ON PURPOSE: this is what Enter in a text field
            activates, and the accidental submit must always be the safe one. */}
        <button
          type="submit"
          name="intent"
          value={published ? "save" : "draft"}
          disabled={pending}
          className="adm-btn"
        >
          {pending ? "Čuvam…" : published ? "Sačuvaj izmene" : "Sačuvaj draft"}
        </button>

        {/* Offered only while there is something to publish. A night already on
            sale is changed with SAČUVAJ IZMENE, and publishing it again would
            be a button that does nothing. */}
        {!published ? (
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
            className="adm-btn adm-btn--primary"
          >
            {pending ? "…" : "Objavi događaj"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Step({ no, title }: { no: number; title: string }) {
  return (
    <FormSection title="">
      <span className="adm-step">
        <span className="adm-step-no" aria-hidden="true">
          {no}
        </span>
        <span className="adm-eyebrow">{title}</span>
      </span>
    </FormSection>
  );
}

/* The club's own wall clock, split for a date field and a time field. Both are
   read in Belgrade so what somebody sees is the hour they meant; the server
   turns the pair back into a real instant. */
function split(iso: string | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const [date = "", time = ""] = wallClock(new Date(iso)).split("T");
  return { date, time };
}

const local = (iso: string | undefined): string =>
  iso ? wallClock(new Date(iso)) : "";
