"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* Hairline fields, no boxes: a rail label, the type itself, and one gold
   underline that lights when the field has the guest's attention. The same
   field is used for a table and for a ticket, so the two never drift apart. */

type FieldProps = {
  id: string;
  name: string;
  label: string;
  type: string;
  value: string;
  error?: MessageKey;
  onChange: (value: string) => void;
  onBlur: () => void;
  className?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "numeric";
  spellCheck?: boolean;
  min?: string;
  max?: string;
  step?: string;
};

export function Field({
  id,
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
        {error ? (
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
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* The one free-text box on the site. Same hairline, no resize handle. */
export function NoteField({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useLang();

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex items-baseline gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
      >
        {t("reserve.note")}
        <span className="text-[0.5625rem] tracking-[0.24em] text-night-ink/25">
          {t("reserve.optional")}
        </span>
      </label>
      <textarea
        id={id}
        name="note"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("reserve.noteHint")}
        className="mt-3 w-full resize-none border-b border-line bg-transparent pb-3 pt-1 text-base leading-relaxed text-night-ink outline-none transition-colors duration-500 placeholder:text-night-ink/25 focus:border-gold"
      />
    </div>
  );
}
