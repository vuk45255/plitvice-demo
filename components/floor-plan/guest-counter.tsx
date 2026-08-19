"use client";

import { useLang } from "@/components/providers/language";

/* How many are coming, inside what the table actually holds.
 *
 * THE TABLE SETS THE RANGE, NOT THIS CONTROL. A barski sto goes 4 → 5 → 6 and
 * a separe 6 → 7 → 8 because that is what SEAT_KINDS says they seat; the
 * numbers arrive here already resolved on the seat and are never written down
 * in this file. Past either end the control simply stops: the button greys and
 * does nothing, rather than accepting a number the house would have to refuse
 * at the door.
 *
 * Two hairline buttons and a serif numeral — the same type the table's own
 * name is set in, so the count reads as part of the card rather than as a
 * form. */

export function GuestCounter({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { t } = useLang();

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };

  const button = (delta: -1 | 1, label: string, glyph: string) => {
    const off = delta === -1 ? value <= min : value >= max;
    return (
      <button
        type="button"
        onClick={() => step(delta)}
        disabled={off}
        aria-label={label}
        className="flex h-11 w-11 shrink-0 items-center justify-center border border-gold/25 text-gold transition-colors duration-500 hover:border-gold/70 hover:text-gold-light disabled:border-line disabled:text-night-ink/20 disabled:hover:border-line disabled:hover:text-night-ink/20"
      >
        <span aria-hidden="true" className="relative block h-4 w-4">
          <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
          {glyph === "+" ? (
            <span className="absolute left-1/2 top-0 h-4 w-px bg-current" />
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45">
        {t("reserve.guests")}
      </p>
      <div className="mt-4 flex items-center gap-5">
        {button(-1, t("floor.guestsFewer"), "−")}
        <span
          aria-live="polite"
          className="min-w-[2.5rem] text-center font-serif text-[1.75rem] leading-none tabular-nums text-night-ink"
        >
          {value}
        </span>
        {button(1, t("floor.guestsMore"), "+")}
      </div>
    </div>
  );
}
