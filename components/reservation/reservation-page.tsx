"use client";

import { useId } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { ReservationAtmosphere } from "@/components/reservation/reservation-atmosphere";
import { ReservationPanel } from "@/components/reservation/reservation-panel";
import { useLang } from "@/components/providers/language";

export function ReservationPage() {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const titleId = useId();

  return (
    <main
      id="main"
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-night px-5 pb-16 pt-24 text-night-ink sm:px-8 md:px-10 md:py-28"
    >
      <ReservationAtmosphere />

      <Link
        href="/"
        className="group absolute left-5 top-8 z-10 flex items-center gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/50 transition-colors duration-500 hover:text-gold sm:left-8 md:left-10"
      >
        <span
          className="h-px w-6 bg-current transition-[width] duration-500 group-hover:w-9"
          aria-hidden="true"
        />
        {t("reserve.back")}
      </Link>

      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, filter: "blur(12px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: reduced ? 0 : 1.1, delay: reduced ? 0 : 0.1, ease: EASE }}
        className="relative"
      >
        <ReservationPanel titleId={titleId} />
      </motion.div>
    </main>
  );
}
