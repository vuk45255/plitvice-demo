"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Arrow } from "@/components/arrow";
import { EASE } from "@/components/reveal";
import { FloorPlanOverlay } from "@/components/floor-plan/floor-plan-overlay";
import { useSeatCopy } from "@/components/floor-plan/use-seat-copy";
import { useTableBooking } from "@/components/reservation/use-table-booking";
import { useLang } from "@/components/providers/language";
import type { PartyEvent } from "@/lib/events";

/* Holding a table for one night.
 *
 * THE DOOR, AND WHAT IS BEHIND IT. This step is one button. Everything that
 * used to stand under it — the table, the party, the guest's details — now
 * happens on the floor plan itself, in the card that opens on the table they
 * touched, so nobody is ever handed back to a form that cannot show them where
 * they are sitting. See components/floor-plan/booking-panel.tsx.
 *
 * The night is already chosen, so it is stated rather than asked for; there is
 * no date field anywhere in this flow and there never should be.
 *
 * The reservation itself lives in useTableBooking, above the map rather than
 * inside it. That is what lets a guest close the room, read the poster again
 * and come back to the same table, the same party size and whatever they had
 * already typed. Nothing about the club's geometry is known here. */

export function TableStep({ event }: { event: PartyEvent }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const { heading, zoneLabel, guestCount } = useSeatCopy();

  const booking = useTableBooking(event);
  const [mapOpen, setMapOpen] = useState(false);

  const room = mapOpen ? (
    <FloorPlanOverlay booking={booking} onClose={() => setMapOpen(false)} />
  ) : null;

  /* It has gone. The confirmation is shown on the map first — the room stays
     open behind this, with the booked table still lit, and the guest closes it
     themselves — and this is what they come back down to. The night, the table
     and the party are restated once, and the way back in is a fresh
     reservation rather than an edit: the house has the first one already. */
  if (booking.step === "sent" && booking.seat) {
    const seat = booking.seat;
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
        <p className="mt-3 text-[0.625rem] uppercase tracking-[0.28em] text-night-ink/45">
          {heading(seat)} · {zoneLabel(seat)} ·{" "}
          <span className="tabular-nums">{guestCount(booking.guests)}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            booking.reset();
            setMapOpen(false);
          }}
          className="group mt-9 flex items-center gap-4 text-[0.625rem] uppercase tracking-[0.28em] text-gold transition-colors duration-500 hover:text-gold-light"
        >
          {t("reserve.successAgain")}
          <Arrow className="w-7 group-hover:w-10" />
        </button>
        {room}
      </motion.div>
    );
  }

  /* A table was picked and the room was closed again without sending. Nothing
     is lost — the way back in says so. */
  const started = Boolean(booking.seat);

  return (
    <div className="pb-12 pt-4 md:pb-16 md:pt-6">
      <span
        className="block h-px w-24 bg-gradient-to-r from-gold to-transparent"
        aria-hidden="true"
      />

      {started && booking.seat ? (
        <div className="mt-8">
          <p className="rail rail-night">{t("floor.chosen")}</p>
          <p className="mt-4 font-serif text-[clamp(1.375rem,3vw,1.75rem)] uppercase leading-none tracking-[0.04em] text-gold-light">
            {heading(booking.seat)}
          </p>
          <p className="mt-3 text-[0.625rem] uppercase tracking-[0.28em] text-night-ink/45">
            {zoneLabel(booking.seat)}
            <span className="mx-2 text-night-ink/20" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums">{guestCount(booking.guests)}</span>
          </p>
        </div>
      ) : (
        <p className="mt-8 max-w-[24rem] text-base leading-[1.8] text-night-ink/60">
          {t("floor.ctaLead")}
        </p>
      )}

      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="btn-gold btn-gold-night mt-9 w-full text-center md:w-auto"
      >
        <span className="inline-flex items-center justify-center gap-5">
          {started ? t("floor.resume") : t("floor.cta")}
          <Arrow className="w-7" />
        </span>
      </button>

      {room}
    </div>
  );
}
