"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { MixTimeline } from "@/components/mix/mix-timeline";
import { MIX_TITLE, timecode, useMix } from "@/components/providers/mix";
import { useLang } from "@/components/providers/language";

/* A record left behind the right-hand edge of the site.
 *
 * Closed, half of it is off the screen — enough of an object to be read as a
 * record rather than a button, and enough of an edge to be taken hold of. It
 * is pulled in, it plays, it is pushed back, and it goes on turning either
 * way: closing the controls is not the same gesture as stopping the music, and
 * the two are never wired to each other.
 *
 * The record is drawn rather than photographed — a dark disc, a few grooves at
 * the edge of visibility, one slow reflection travelling round it and a brass
 * label at the centre. The reflection is the only part that is not radially
 * symmetric, which is what makes the turning visible at all.
 *
 * The spin is a CSS animation and not a React animation on purpose. Pausing it
 * is `animation-play-state`, which stops the record where it stands and starts
 * it again from there — no angle is ever stored, reset, or recalculated when
 * the panel opens, the route changes or the component re-renders.
 *
 * It sits under the site's own chrome: the header, the phone's menu panel and
 * the floor plan all stand above it, so the record can never come between a
 * guest and a table. */

/* The editor is a workshop, not a room in the club. */
const SILENT_ROUTES = ["/floor-plan-editor"];

/* The disc, and how far it stands off the edge.
 *
 * `--peek` is the closed state: better than three quarters of the record is
 * outside the window, so what is left on screen is a curved slice of black at
 * the very edge — noticed, not announced, and never in competition with the
 * mark in the middle of the page. The record itself is full size the whole
 * time; only its position changes.
 *
 * `--pull` is where it comes to rest when it is opened — far enough in on a
 * desk to clear the edge entirely, and only part of the way in on a phone,
 * where the controls beside it need the room more than it does. */
const SIZING =
  "[--vinyl:8.75rem] [--peek:calc(var(--vinyl)*0.77)] [--pull:1.25rem] " +
  "md:[--vinyl:17.5rem] md:[--pull:-1.5rem]";

export function VinylPlayer() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { t } = useLang();
  const {
    isPlaying,
    currentTime,
    duration,
    isOpen,
    started,
    toggle,
    toggleOpen,
    close,
  } = useMix();

  /* The record arrives rather than appearing: it is fully behind the edge on
     the first frame and slides out to its resting place a moment later, once
     the page it belongs to has had its own opening. */
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setArrived(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  if (SILENT_ROUTES.some((route) => pathname.startsWith(route))) return null;

  const rest = isOpen ? "--pull" : "--peek";

  return (
    <div
      className="pointer-events-none fixed inset-y-0 right-0 z-40 flex items-center pt-[6vh]"
      /* The strip is the full height of the screen so the record can be
         centred without a transform of its own — the only transform on it is
         the one that slides it in and out. */
    >
      <div
        className={`pointer-events-auto flex items-center transition-transform duration-[560ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${SIZING}`}
        style={{
          transform: arrived
            ? `translateX(var(${rest}))`
            : "translateX(var(--vinyl))",
        }}
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, x: 14, transition: { duration: 0.28, ease: EASE } }
              }
              transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.1, ease: EASE }}
              className="mr-4 w-[13.75rem] shrink-0 rounded-[3px] border border-gold/15 bg-night/85 p-4 text-night-ink shadow-[0_30px_70px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:w-[15rem] md:mr-6 md:w-[19rem] md:p-6"
            >
              <p className="rail rail-night !text-[0.5rem] sm:!text-[0.5625rem]">
                {MIX_TITLE}
              </p>

              <div className="mt-4 md:mt-5">
                <MixTimeline compact />
              </div>

              <div className="mt-1 flex items-center justify-between text-[0.625rem] tabular-nums tracking-[0.14em] text-night-ink/45">
                <span>{timecode(currentTime)}</span>
                {/* Nothing is invented here: until the file has said how long
                    it is, the readout says nothing at all. */}
                <span>{duration > 0 ? timecode(duration) : "—"}</span>
              </div>

              <div className="mt-5 flex items-center justify-between md:mt-7">
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={isPlaying ? t("mix.pause") : t("mix.play")}
                  className="flex h-9 w-9 items-center justify-center text-gold transition-colors duration-500 hover:text-gold-light focus-visible:text-gold-light"
                >
                  {isPlaying ? <PauseMark /> : <PlayMark />}
                </button>

                <button
                  type="button"
                  onClick={close}
                  aria-label={t("mix.close")}
                  className="flex h-9 w-9 items-center justify-center text-night-ink/40 transition-colors duration-500 hover:text-night-ink/80 focus-visible:text-night-ink/80"
                >
                  <CloseMark />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-label={isOpen ? t("mix.close") : t("mix.open")}
          className="group relative block h-[var(--vinyl)] w-[var(--vinyl)] shrink-0 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:hover:-translate-x-[10px]"
        >
          <Vinyl spinning={isPlaying && started} />
          {/* With so little of the record on screen there is not much of it to
              aim at, so the target reaches a little further in than the black
              does. It is a descendant of the button, so a press anywhere on it
              is a press on the record. */}
          <span
            className="absolute inset-y-0 -left-7 right-0 md:-left-5"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

/* The object itself. Every layer is radially symmetric except the reflection,
   and the reflection is what the eye follows round. */
function Vinyl({ spinning }: { spinning: boolean }) {
  return (
    <span
      className="vinyl-spin absolute inset-0 block rounded-full shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)]"
      data-spinning={spinning ? "true" : "false"}
      aria-hidden="true"
    >
      {/* the body of the record, lit slightly from the upper left */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, #1b1526 0%, #0d0913 38%, #07050b 78%, #05040a 100%)",
        }}
      />
      {/* grooves — at the very edge of being there */}
      <span
        className="absolute inset-[3%] rounded-full opacity-60"
        style={{
          background:
            "repeating-radial-gradient(circle at 50% 50%, rgba(244,240,230,0.055) 0 1px, transparent 1px 5px)",
        }}
      />
      {/* the run-out, where the grooves stop and the label begins */}
      <span
        className="absolute inset-[30%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(8,5,13,0.9), rgba(8,5,13,0))",
        }}
      />
      {/* one slow reflection, travelling round with the record */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 200deg at 50% 50%, transparent 0deg, rgba(244,240,230,0.10) 26deg, transparent 58deg, transparent 176deg, rgba(200,164,93,0.11) 206deg, transparent 244deg)",
        }}
      />
      {/* the label — brass, and deliberately blank */}
      <span
        className="absolute left-1/2 top-1/2 block h-[31%] w-[31%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 36% 30%, #4a3818 0%, #2c2010 55%, #1b1309 100%)",
        }}
      />
      {/* the spindle hole */}
      <span className="absolute left-1/2 top-1/2 block h-[3.4%] w-[3.4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-night" />
      {/* the edge of the disc, catching the room */}
      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-gold/12" />
    </span>
  );
}

/* The two marks on the control, drawn at the weight of the site's hairlines. */
function PlayMark() {
  return (
    <svg viewBox="0 0 12 14" className="h-[13px] w-[11px]" fill="currentColor" aria-hidden="true">
      <path d="M0 0 L12 7 L0 14 Z" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg viewBox="0 0 10 14" className="h-[13px] w-[9px]" fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="3" height="14" />
      <rect x="7" y="0" width="3" height="14" />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <path d="M0.5 0.5 L11.5 11.5 M11.5 0.5 L0.5 11.5" />
    </svg>
  );
}
