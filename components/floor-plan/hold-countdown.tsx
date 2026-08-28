"use client";

import { useReducedMotion } from "framer-motion";
import { useLang } from "@/components/providers/language";
import type { Seat } from "@/lib/floor-availability";

/* The three minutes, said once and quietly.
 *
 * WHAT IT IS FOR. A guest filling in a form needs to know two things: that the
 * table is genuinely theirs while they do it, and roughly how long that lasts.
 * The first is the reassuring half and it is the half that is set in words;
 * the second is a number, and a number counting down is quite loud enough on
 * its own without being made large.
 *
 * SO IT IS A LINE, NOT A DIALOG. One rail of small caps, the time in the
 * house's own tabular gold at the end of it, and a hairline underneath that
 * shortens as the time goes. There is no box around it, no icon, no colour
 * that is not already on the card, and nothing that moves except the rule and
 * the digits. A booking screen that puts a clock in front of the guest has
 * turned a courtesy into a threat.
 *
 * UNDER THIRTY SECONDS it warms — the rail, the digits and the rule all move
 * to the same soft red the form uses for a field that needs attention. That is
 * the whole of the escalation: one colour, at one threshold. It does not
 * flash, grow, beep or shake.
 *
 * WHERE IT SITS. Stuck to the top of the panel's own scroll, so on a short
 * phone with the keyboard up it is still the first thing above the fields
 * rather than something that has scrolled away. It is inside the card, so it
 * cannot overlap the map, the guest counter, the header or the buttons at the
 * foot of the form — all of which are its siblings in the same column.
 *
 * IT DECIDES NOTHING. See the note at the top of use-seat-hold.ts: this draws
 * a number that the server owns. */

/* The point at which the last stretch is worth marking. */
const WARM_AT = 30;

function clock(seconds: number) {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function HoldCountdown({
  seat,
  seconds,
  totalSeconds,
}: {
  seat: Seat;
  seconds: number;
  totalSeconds: number;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();

  const warm = seconds <= WARM_AT;
  const left = Math.max(0, Math.min(1, totalSeconds > 0 ? seconds / totalSeconds : 0));

  return (
    <div
      /* The card scrolls underneath this; the same night behind it, so the
         fields pass behind rather than through. */
      className="sticky top-0 z-10 -mx-6 mb-1 bg-night/95 px-6 pb-3 pt-1 backdrop-blur-xl md:-mx-8 md:px-8"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p
          className={`text-[0.5625rem] uppercase leading-[1.5] tracking-[0.24em] transition-colors duration-700 ${
            warm ? "text-[#e6a091]/80" : "text-gold/60"
          }`}
        >
          {t(seat.type === "booth" ? "floor.hold.labelBooth" : "floor.hold.label")}
        </p>

        {/* Spoken as its own thing so a screen reader announces the remaining
            time rather than reading the sentence and the digits as one line.
            Polite, and only every so often — a live region that shouts every
            second is unusable. */}
        <p
          className={`shrink-0 text-[0.8125rem] tabular-nums leading-none tracking-[0.08em] transition-colors duration-700 ${
            warm ? "text-[#e6a091]" : "text-gold-light"
          }`}
          role="timer"
          aria-label={`${t("floor.hold.remaining")} ${clock(seconds)}`}
        >
          {clock(seconds)}
        </p>
      </div>

      {/* The same fact again, without words: a hairline the width of what is
          left. It is the reason the digits do not have to be big. */}
      <div className="mt-2.5 h-px w-full bg-line" aria-hidden="true">
        <div
          className={`h-px origin-left transition-[transform,background-color] ease-linear ${
            warm ? "bg-[#e6a091]/70" : "bg-gold/45"
          }`}
          style={{
            transform: `scaleX(${left})`,
            /* Stepped once a second, exactly in time with the digits, so the
               two never disagree. A reader who has asked for less movement
               gets the same rule without the slide. */
            transitionDuration: reduced ? "0ms" : "1000ms",
          }}
        />
      </div>
    </div>
  );
}
