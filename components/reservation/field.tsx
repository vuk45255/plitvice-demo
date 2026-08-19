"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* Hairline fields, no boxes: a rail label, the type itself, and one gold
   underline that lights when the field has the guest's attention. The same
   field is used for a table and for a ticket, so the two never drift apart.
 *
 * COMPACT is the same field on a phone-sized card. A form standing on a page
 * can breathe; a form in a sheet over the floor plan has one screenful and has
 * to fit the whole booking into it, submit button included, or the guest is
 * scrolling with one thumb while the table they are booking is out of sight.
 * So it closes the gap under the label and takes a little off the field's
 * height — and gives both back on a wide screen, where there was never a
 * shortage of room. Nothing about the type gets smaller: the label and the
 * value are set at exactly the size they are everywhere else. */

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
  /* Tighter, for the card over the map. See the note above. */
  compact?: boolean;
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
  compact,
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
        className={`w-full border-b bg-transparent text-base text-night-ink outline-none transition-colors duration-500 [color-scheme:dark] placeholder:text-night-ink/25 focus:border-gold ${
          compact
            ? "mt-1.5 h-9 [@media(min-height:740px)]:h-10 md:mt-3 md:h-12"
            : "mt-3 h-12"
        } ${error ? "border-[#e6a091]" : "border-line"}`}
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
  compact,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
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
        /* One line on a phone, three on a page. It grows the moment anybody
           actually types into it — see the height classes — so the guest with
           something to say is not writing through a letterbox, and the guest
           with nothing to say is not scrolling past an empty box. */
        rows={compact ? 1 : 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("reserve.noteHint")}
        className={`w-full resize-none border-b border-line bg-transparent text-base leading-relaxed text-night-ink outline-none transition-colors duration-500 placeholder:text-night-ink/25 focus:border-gold ${
          compact
            ? "mt-1.5 pb-2 pt-0.5 md:mt-3 md:pb-3 md:pt-1"
            : "mt-3 pb-3 pt-1"
        }`}
      />
    </div>
  );
}
