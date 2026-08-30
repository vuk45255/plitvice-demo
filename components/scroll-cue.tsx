"use client";

import { motion, useReducedMotion, type MotionValue } from "framer-motion";
import { useLang } from "@/components/providers/language";

/* THE CUE UNDER A SCREEN THAT LOOKS LIKE THE END OF THE PAGE.
 *
 * The home page's hero has carried one of these since the beginning — a small
 * gold rail with a hairline under it, at the foot of components/hero.tsx — and
 * this is that same object lifted out, so the other compositions that fill a
 * whole screen can stand one in the same place. The size, the tracking, the
 * colour and the hairline are the hero's own and are not re-decided here. The
 * only thing added is the chevron, and it is the house Arrow's head turned to
 * point down, drawn at the weight every other rule on the site is drawn at.
 *
 * IT IS NOT A CONTROL. Pointer events are off and it is out of the
 * accessibility tree: a visitor who cannot see it is not missing an
 * instruction, because everything below is in the document either way and a
 * reader reaches it by reading. This speaks to the one sense that can be
 * fooled into thinking a full screen is a whole page.
 *
 * HOW IT LEAVES, AND WHY THERE IS NO SCROLL LISTENER IN THIS FILE. In an
 * ordinary section it does not have to be dismissed at all — it belongs to the
 * section and it travels off the top of the screen with it. Only a PINNED
 * stage needs telling, because a pinned stage never scrolls away; those hand
 * in the progress value they already run on and the cue fades against that.
 * Nothing here reads the scroll position, and nothing here touches Lenis. */

/* How far the cue stands off the foot of the screen.
 *
 * `vh` rather than `svh`, inside hosts that are themselves `100svh` tall, and
 * that way round on purpose: when a phone's browser chrome is showing, the
 * small viewport is the shorter of the two, so a share of the LARGE one is a
 * slightly bigger inset and the cue backs away from the chrome rather than
 * sliding under it. The floor keeps it clear on a short screen; the safe-area
 * term keeps it off a home indicator on the phones that report one. The
 * existing timeline rail on the archive stage sits on the same kind of
 * measure — see Rail in components/story/archive-journey.tsx. */
const FOOT = "max(6vh, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))";

export function ScrollCue({
  opacity,
  className = "",
}: {
  /* A pinned stage's own progress, already mapped to an opacity. Ordinary
     sections leave this out and simply carry the cue away as they go. */
  opacity?: MotionValue<number>;
  className?: string;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();

  /* One slow breath, and a drift of five pixels down into the chevron. Slow
     enough that it is never caught moving — the hero's cue keeps the same
     unhurried clock. Reduced motion gets the cue standing still: it is the
     shape that says "there is more", not the movement. */
  const breathe = reduced
    ? undefined
    : {
        opacity: [0.55, 1, 0.55],
        y: [0, 5, 0],
        transition: {
          duration: 3.6,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };

  return (
    <motion.div
      style={{ opacity, bottom: FOOT }}
      className={`pointer-events-none absolute inset-x-0 flex flex-col items-center gap-3 text-gold/80 ${className}`}
      aria-hidden="true"
    >
      {/* Trailing letter-spacing throws centred small caps off axis; the
          indent pays back half of it, the way .rail-center does. */}
      <span className="text-[0.625rem] uppercase tracking-[0.36em] indent-[0.36em]">
        {t("common.scrollOn")}
      </span>

      {/* The line and its head move together — one gesture, not two. */}
      <motion.span
        className="flex flex-col items-center gap-1.5"
        animate={breathe}
      >
        <span
          className="block h-8 w-px bg-gradient-to-b from-transparent to-gold/65 md:h-10"
          aria-hidden="true"
        />
        <svg
          viewBox="0 0 8 8"
          className="h-[7px] w-[7px] overflow-visible"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        >
          <path d="M0.5 4 L4 7.5 L7.5 4" />
        </svg>
      </motion.span>
    </motion.div>
  );
}
