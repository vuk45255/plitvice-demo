"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { ReservationForm } from "@/components/reservation/reservation-form";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";

/* The card itself: the house rail, the word, the invitation, the form.
   Shared verbatim by the overlay and by /rezervacija so the two can never
   drift apart. */
export function ReservationPanel({
  titleId,
  /* h1 on its own page; h2 inside the overlay, where the page already has
     one heading of its own. */
  as: Heading = "h1",
}: {
  titleId: string;
  as?: "h1" | "h2";
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const MotionHeading = motion[Heading];

  const rise = (delay: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.9, delay: reduced ? 0 : delay, ease: EASE },
  });

  return (
    <div className="mx-auto w-full max-w-[46rem]">
      {/* velvet card — a hairline of gold, and light pooling at its top edge */}
      <div className="relative overflow-hidden border border-line bg-night/55 px-6 py-12 shadow-[0_40px_120px_-40px_rgba(8,5,13,0.95)] backdrop-blur-xl sm:px-10 md:px-14 md:py-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(200,164,93,0.10), transparent 70%)",
          }}
          aria-hidden="true"
        />
        {/* the light along the top edge of the card */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent"
          aria-hidden="true"
        />

        <div className="relative">
          <motion.p
            {...rise(0.05)}
            className="text-[0.625rem] uppercase tracking-[0.5em] text-gold-light/70 indent-[0.5em]"
          >
            {site.tagline}
          </motion.p>

          <MotionHeading
            {...rise(0.13)}
            id={titleId}
            className="mt-6 font-serif text-[clamp(2.5rem,8vw,4.5rem)] leading-[1.02] tracking-tight text-night-ink [text-shadow:0_0_70px_rgba(232,216,168,0.2)]"
          >
            {t("reserve.title")}
          </MotionHeading>

          <motion.div {...rise(0.21)} className="mt-8 flex items-center gap-5">
            <span
              className="h-px w-16 bg-gradient-to-r from-gold/55 to-transparent"
              aria-hidden="true"
            />
          </motion.div>

          <motion.div
            {...rise(0.28)}
            className="mt-8 max-w-[30rem] space-y-2 text-base leading-[1.7] text-night-ink/65"
          >
            <p>{t("reserve.lead1")}</p>
            <p>{t("reserve.lead2")}</p>
          </motion.div>

          <motion.div {...rise(0.36)}>
            <ReservationForm />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
