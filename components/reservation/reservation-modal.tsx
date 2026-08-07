"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { EASE } from "@/components/reveal";
import { ReservationAtmosphere } from "@/components/reservation/reservation-atmosphere";
import { ReservationPanel } from "@/components/reservation/reservation-panel";
import { useReservation } from "@/components/providers/reservation";
import { useLang } from "@/components/providers/language";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* The reservation room, dropped over the site rather than navigated to — the
   page behind is left exactly where the guest was standing, and the hero's
   entrance ceremony is never replayed on the way back.

   Sits at z-70: above the header (z-50), below the film grain (z-80), so the
   same grain falls across the overlay as across everything else. */
export function ReservationModal() {
  const { open, closeReservation } = useReservation();
  const { t } = useLang();
  const reduced = useReducedMotion();
  const lenis = useLenis();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  /* Page frozen, Escape closes, focus kept inside, and the element that
     opened the room gets the focus back when it closes. */
  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement as HTMLElement | null;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeReservation();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      lenis?.start();
      returnTo.current?.focus?.();
    };
  }, [open, closeReservation, lenis]);

  /* The first field, not the close button — the guest came here to write. */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("input")?.focus();
    }, 650);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-night"
          data-lenis-prevent
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.7, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <ReservationAtmosphere />

          {/* the whole backdrop is a way out; the card stops the click */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={closeReservation}
            className="absolute inset-0 cursor-default"
          />

          <div
            ref={panelRef}
            className="relative flex min-h-full flex-col px-5 pb-16 pt-24 sm:px-8 md:justify-center md:px-10 md:py-28"
          >
            <button
              type="button"
              onClick={closeReservation}
              aria-label={t("common.closeReservation")}
              className="group fixed right-5 top-6 z-10 flex h-11 w-11 items-center justify-center sm:right-8 md:right-10 md:top-8"
            >
              <span className="relative block h-5 w-5">
                <span className="absolute left-0 top-1/2 block h-px w-5 rotate-45 bg-night-ink/70 transition-colors duration-500 group-hover:bg-gold" />
                <span className="absolute left-0 top-1/2 block h-px w-5 -rotate-45 bg-night-ink/70 transition-colors duration-500 group-hover:bg-gold" />
              </span>
            </button>

            <motion.div
              initial={
                reduced ? { opacity: 0 } : { opacity: 0, y: 44, filter: "blur(14px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduced ? { opacity: 0 } : { opacity: 0, y: 24, filter: "blur(10px)" }
              }
              transition={{
                duration: reduced ? 0 : 1,
                delay: reduced ? 0 : 0.12,
                ease: EASE,
              }}
            >
              <ReservationPanel titleId={titleId} as="h2" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
