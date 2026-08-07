"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

type FieldName = "name" | "phone" | "email" | "guests" | "date" | "time";

type Values = Record<FieldName | "note", string>;

const EMPTY: Values = {
  name: "",
  phone: "",
  email: "",
  guests: "",
  date: "",
  time: "",
  note: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/* Serbian numbers arrive as +381 60 123 4567, 060/123-4567, 060 123 4567 —
   accept the punctuation people actually type, then count the digits. */
const PHONE_SHAPE = /^[+(]?[\d\s()\-./]{5,}$/;

/* "Today" has to come from the guest's clock, not the server's — the two can
   sit on different sides of midnight. Read as an external store, the way the
   language provider reads localStorage: the server snapshot is empty, and the
   real date arrives on hydration without a mismatched `min` attribute.

   The value is cached so getSnapshot is referentially stable across renders. */
let cachedToday = "";

function todayISO() {
  if (cachedToday) return cachedToday;
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  cachedToday = local.toISOString().slice(0, 10);
  return cachedToday;
}

/* Nothing to subscribe to — the date is read once per session. */
const subscribeToNothing = () => () => {};
const noDateOnServer = () => "";

/* Returns the message key for whatever is wrong, or null when the field is
   good. `today` is passed in rather than read here so the whole form validates
   against one instant. */
function validate(field: FieldName, values: Values, today: string): MessageKey | null {
  const value = values[field].trim();

  switch (field) {
    case "name":
      return value.length >= 2 ? null : "reserve.err.name";
    case "phone": {
      const digits = value.replace(/\D/g, "");
      return PHONE_SHAPE.test(value) && digits.length >= 6 && digits.length <= 15
        ? null
        : "reserve.err.phone";
    }
    case "email":
      return EMAIL.test(value) ? null : "reserve.err.email";
    case "guests": {
      const n = Number(value);
      return value !== "" && Number.isInteger(n) && n >= 1 && n <= 50
        ? null
        : "reserve.err.guests";
    }
    case "date":
      /* An empty `today` means the client clock has not been read yet; the
         date is still required, it just is not compared against anything. */
      return value !== "" && (today === "" || value >= today)
        ? null
        : "reserve.err.date";
    case "time":
      return value !== "" ? null : "reserve.err.time";
  }
}

const FIELDS: FieldName[] = ["name", "phone", "email", "guests", "date", "time"];

export function ReservationForm({ onDone }: { onDone?: () => void }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const uid = useId();

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, MessageKey>>>({});
  /* A field only starts complaining once the guest has left it, or once they
     have tried to send. Nobody is told they are wrong mid-word. */
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const today = useSyncExternalStore(
    subscribeToNothing,
    todayISO,
    noDateOnServer,
  );

  const set = (field: FieldName | "note") => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (field !== "note" && touched[field]) {
      setErrors((e) => ({ ...e, [field]: validate(field, { ...values, [field]: value }, today) ?? undefined }));
    }
  };

  const blur = (field: FieldName) => () => {
    setTouched((s) => ({ ...s, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(field, values, today) ?? undefined }));
  };

  const invalidCount = useMemo(
    () => FIELDS.filter((f) => errors[f]).length,
    [errors],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;

    const next: Partial<Record<FieldName, MessageKey>> = {};
    for (const field of FIELDS) {
      const problem = validate(field, values, today);
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
    /* TODO: no delivery yet — `values` is not sent anywhere. Point this at the
       booking endpoint (or a mail service) and keep the states as they are. */
    await new Promise((r) => setTimeout(r, 900));
    setStatus("sent");
    onDone?.();
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setTouched({});
    setStatus("idle");
  };

  if (status === "sent") {
    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
        className="flex flex-col items-center py-10 text-center md:py-16"
        role="status"
        aria-live="polite"
      >
        {/* a hairline drawing itself, the way the hero's rules do */}
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduced ? 0 : 1.2, delay: reduced ? 0 : 0.2, ease: EASE }}
          className="h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent"
          aria-hidden="true"
        />
        <p className="mt-10 font-serif text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.15] text-night-ink">
          {t("reserve.successTitle")}
        </p>
        <p className="mt-4 text-base leading-relaxed text-night-ink/60">
          {t("reserve.successBody")}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 text-[0.6875rem] uppercase tracking-[0.28em] text-gold/80 underline-offset-8 transition-colors duration-500 hover:text-gold-light hover:underline"
        >
          {t("reserve.successAgain")}
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10 md:mt-14">
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
        <Field
          uid={uid}
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
          uid={uid}
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
          uid={uid}
          name="email"
          label={t("reserve.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={set("email")}
          onBlur={blur("email")}
        />
        <Field
          uid={uid}
          name="date"
          label={t("reserve.date")}
          type="date"
          min={today || undefined}
          value={values.date}
          error={errors.date}
          onChange={set("date")}
          onBlur={blur("date")}
        />
        <Field
          uid={uid}
          name="time"
          label={t("reserve.time")}
          type="time"
          value={values.time}
          error={errors.time}
          onChange={set("time")}
          onBlur={blur("time")}
        />
        <Field
          uid={uid}
          name="guests"
          label={t("reserve.guests")}
          type="number"
          inputMode="numeric"
          min="1"
          max="50"
          step="1"
          value={values.guests}
          error={errors.guests}
          onChange={set("guests")}
          onBlur={blur("guests")}
          className="md:col-span-2"
        />

        <div className="md:col-span-2">
          <label
            htmlFor={`${uid}-note`}
            className="flex items-baseline gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
          >
            {t("reserve.note")}
            <span className="text-[0.5625rem] tracking-[0.24em] text-night-ink/25">
              {t("reserve.optional")}
            </span>
          </label>
          <textarea
            id={`${uid}-note`}
            rows={3}
            value={values.note}
            onChange={(e) => set("note")(e.target.value)}
            placeholder={t("reserve.noteHint")}
            className="mt-3 w-full resize-none border-b border-line bg-transparent pb-3 pt-1 text-base leading-relaxed text-night-ink outline-none transition-colors duration-500 placeholder:text-night-ink/25 focus:border-gold"
          />
        </div>
      </div>

      {/* One quiet line rather than a stack of red — the fields already carry
          their own messages. */}
      <div aria-live="polite" className="min-h-6">
        <AnimatePresence>
          {invalidCount > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.4 }}
              className="mt-8 text-[0.6875rem] uppercase tracking-[0.24em] text-[#e6a091]"
            >
              {t("reserve.err.summary")}
            </motion.p>
          )}
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
        <p className="text-center text-[0.75rem] leading-relaxed text-night-ink/40 md:max-w-[18rem] md:text-left">
          {t("reserve.footnote")}
        </p>
      </div>
    </form>
  );
}

type FieldProps = {
  uid: string;
  name: FieldName;
  label: string;
  type: string;
  value: string;
  error?: MessageKey;
  onChange: (value: string) => void;
  onBlur: () => void;
  className?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "numeric";
  min?: string;
  max?: string;
  step?: string;
};

/* Hairline fields, no boxes: a rail label, the type itself, and one gold
   underline that lights when the field has the guest's attention. */
function Field({
  uid,
  name,
  label,
  type,
  value,
  error,
  onChange,
  onBlur,
  className,
  ...input
}: FieldProps) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const id = `${uid}-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
      >
        {label}
      </label>
      <input
        {...input}
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        /* color-scheme keeps the native date and time pickers dark, so their
           icons are visible against the velvet instead of black on black. */
        className={`mt-3 h-12 w-full border-b bg-transparent text-base text-night-ink outline-none transition-colors duration-500 [color-scheme:dark] placeholder:text-night-ink/25 focus:border-gold ${
          error ? "border-[#e6a091]" : "border-line"
        }`}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            id={errorId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.35, ease: EASE }}
            className="mt-2 text-[0.75rem] leading-relaxed text-[#e6a091]"
          >
            {t(error)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
