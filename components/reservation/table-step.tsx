"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { Field, NoteField } from "@/components/reservation/field";
import { useLang } from "@/components/providers/language";
import { validateField, type BookingField } from "@/lib/booking";
import type { PartyEvent } from "@/lib/events";
import type { MessageKey } from "@/lib/i18n";

/* Holding a table for one night.
 *
 * The night is already chosen, so it is stated rather than asked for — there is
 * no date field here, and there never should be. What is left is the party: how
 * many, who, and anything the house should know before they arrive.
 *
 * THE FLOOR PLAN SEAM. When the club measures the room, `event.tables.plan`
 * arrives and the party-size question is joined by a map: see lib/events.ts for
 * the shape. The plan slots in immediately above the fields, writes the chosen
 * table into `values.table`, and nothing else in this step changes. */

const FIELDS: BookingField[] = ["guests", "time", "name", "phone", "email"];

type Values = Record<BookingField | "note", string>;

const EMPTY: Values = {
  guests: "",
  time: "",
  name: "",
  phone: "",
  email: "",
  note: "",
};

export function TableStep({ event }: { event: PartyEvent }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const uid = useId();

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<BookingField, MessageKey>>>(
    {},
  );
  /* A field only starts complaining once the guest has left it, or once they
     have tried to send. Nobody is told they are wrong mid-word. */
  const [touched, setTouched] = useState<Partial<Record<BookingField, boolean>>>(
    {},
  );
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const set = (field: BookingField | "note") => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (field !== "note" && touched[field]) {
      setErrors((e) => ({ ...e, [field]: validateField(field, value) ?? undefined }));
    }
  };

  const blur = (field: BookingField) => () => {
    setTouched((s) => ({ ...s, [field]: true }));
    setErrors((e) => ({
      ...e,
      [field]: validateField(field, values[field]) ?? undefined,
    }));
  };

  const invalid = FIELDS.some((f) => errors[f]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;

    const next: Partial<Record<BookingField, MessageKey>> = {};
    for (const field of FIELDS) {
      const problem = validateField(field, values[field]);
      if (problem) next[field] = problem;
    }
    setErrors(next);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));

    if (Object.keys(next).length > 0) {
      /* Put the guest on the first thing that needs them. */
      const first = FIELDS.find((f) => next[f]);
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }

    setStatus("sending");
    /* TODO — DELIVERY. `values` and `event.slug` are not sent anywhere yet.
       Point this at the club's booking inbox (a route handler, a mail service,
       whatever the club runs) and leave the states below exactly as they are. */
    await new Promise((r) => setTimeout(r, 900));
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
        className="py-12 md:py-16"
        role="status"
        aria-live="polite"
      >
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: reduced ? 0 : 1.2,
            delay: reduced ? 0 : 0.2,
            ease: EASE,
          }}
          className="block h-px w-24 origin-left bg-gradient-to-r from-gold to-transparent"
          aria-hidden="true"
        />
        <p className="mt-8 font-serif text-[clamp(1.5rem,4vw,2.25rem)] leading-[1.15] text-night-ink">
          {t("reserve.successTitle")}
        </p>
        <p className="mt-4 max-w-[26rem] text-base leading-relaxed text-night-ink/60">
          {t("reserve.successBody")}
        </p>
        <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.3em] text-gold/80">
          {event.artist} · {t(event.date)}
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="pb-12 pt-2 md:pb-16">
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
        <Field
          id={`${uid}-guests`}
          name="guests"
          label={t("reserve.guests")}
          type="number"
          inputMode="numeric"
          min="1"
          max="50"
          step="1"
          autoComplete="off"
          value={values.guests}
          error={errors.guests}
          onChange={set("guests")}
          onBlur={blur("guests")}
        />
        <Field
          id={`${uid}-time`}
          name="time"
          label={t("reserve.time")}
          type="time"
          autoComplete="off"
          value={values.time}
          error={errors.time}
          onChange={set("time")}
          onBlur={blur("time")}
        />
        <Field
          id={`${uid}-name`}
          name="name"
          label={t("reserve.name")}
          type="text"
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={set("name")}
          onBlur={blur("name")}
          className="md:col-span-2"
        />
        <Field
          id={`${uid}-phone`}
          name="phone"
          label={t("reserve.phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          error={errors.phone}
          onChange={set("phone")}
          onBlur={blur("phone")}
        />
        <Field
          id={`${uid}-email`}
          name="email"
          label={t("reserve.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          value={values.email}
          error={errors.email}
          onChange={set("email")}
          onBlur={blur("email")}
        />
        <NoteField
          id={`${uid}-note`}
          value={values.note}
          onChange={set("note")}
          className="md:col-span-2"
        />
      </div>

      {/* One quiet line rather than a stack of red — the fields already carry
          their own messages. */}
      <div aria-live="polite" className="min-h-6">
        <AnimatePresence>
          {invalid ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.4 }}
              className="mt-8 text-[0.6875rem] uppercase tracking-[0.24em] text-[#e6a091]"
            >
              {t("reserve.err.summary")}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex flex-col items-stretch gap-6 sm:mt-10 md:flex-row md:items-center md:justify-between md:gap-10">
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn-gold btn-gold-night w-full text-center disabled:cursor-wait disabled:opacity-60 md:w-auto"
        >
          {status === "sending" ? t("reserve.sending") : t("reserve.submit")}
        </button>
        <p className="text-[0.75rem] leading-relaxed text-night-ink/40 md:max-w-[18rem]">
          {t("reserve.footnote")}
        </p>
      </div>
    </form>
  );
}
