"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useCoarsePointer } from "@/lib/use-media";

/* Purple lamps behind the page, and the haze that makes their beams visible.

   Each lamp breathes on its own clock — opacity, scale and blur together, so
   it swells and softens instead of just fading. The haze sits over the lamps,
   drifting far more slowly, which is what makes the light read as passing
   through smoke rather than sitting on a flat background.

   Scroll moves the whole rig, and pushes the lamps sideways against each other
   so the room appears to have depth as you travel through it.

   Two of the five lamps and one haze bank are desktop-only: the effect holds
   on a phone with three, and the fewer large filtered layers there are, the
   cheaper it composites. Lives inside its section (z-0, content at z-10). */

type Lamp = {
  place: string;
  color: string;
  blur: [string, string];
  duration: number;
  delay: number;
  /* Which of the two scroll tracks this lamp rides. */
  track: "a" | "b";
  desktopOnly?: boolean;
};

const LAMPS: Lamp[] = [
  {
    place: "-left-[20%] top-[2%] h-[74vh] w-[74vh]",
    color: "rgba(126,74,186,0.46)",
    blur: ["blur(50px)", "blur(80px)"],
    duration: 7,
    delay: 0,
    track: "a",
  },
  {
    place: "-right-[18%] top-[26%] h-[70vh] w-[70vh]",
    color: "rgba(98,54,162,0.44)",
    blur: ["blur(55px)", "blur(85px)"],
    duration: 8,
    delay: 1.6,
    track: "b",
  },
  {
    /* the one directly behind the content — kept the faintest of all */
    place: "left-[30%] top-[18%] h-[56vh] w-[56vh]",
    color: "rgba(142,92,200,0.20)",
    blur: ["blur(60px)", "blur(95px)"],
    duration: 6,
    delay: 3.2,
    track: "a",
  },
  {
    place: "left-[18%] -bottom-[16%] h-[58vh] w-[58vh]",
    color: "rgba(200,164,93,0.22)",
    blur: ["blur(50px)", "blur(75px)"],
    duration: 7.5,
    delay: 2.4,
    track: "b",
    desktopOnly: true,
  },
  {
    place: "right-[24%] bottom-[4%] h-[48vh] w-[48vh]",
    color: "rgba(88,48,148,0.26)",
    blur: ["blur(55px)", "blur(90px)"],
    duration: 5.5,
    delay: 4.4,
    track: "a",
    desktopOnly: true,
  },
];

type Haze = {
  place: string;
  color: string;
  duration: number;
  delay: number;
  drift: { x: number[]; y: number[] };
  desktopOnly?: boolean;
};

/* Slow enough that you never catch it moving. */
const HAZE: Haze[] = [
  {
    place: "-left-[10%] top-[16%] h-[48vh] w-[90vw]",
    color: "rgba(172,152,202,0.08)",
    duration: 46,
    delay: 0,
    drift: { x: [0, 80, 0], y: [0, -30, 0] },
  },
  {
    place: "left-[12%] top-[50%] h-[40vh] w-[75vw]",
    color: "rgba(210,192,230,0.06)",
    duration: 61,
    delay: 7,
    drift: { x: [0, -100, 0], y: [0, 26, 0] },
  },
  {
    place: "-right-[15%] -bottom-[8%] h-[44vh] w-[80vw]",
    color: "rgba(152,128,188,0.07)",
    duration: 53,
    delay: 14,
    drift: { x: [0, 70, 0], y: [0, -20, 0] },
    desktopOnly: true,
  },
];

type AmbientProps = {
  /* "soft" is for the chapters that are about reading, not dancing. */
  variant?: "full" | "soft";
  /* Set on the last party section so the room settles before the story
     section arrives and the film gets it to itself. */
  fadeOut?: boolean;
};

export function Ambient({ variant = "full", fadeOut = false }: AmbientProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const phone = useCoarsePointer();

  /* NOTHING BREATHES IN A ROOM NOBODY IS STANDING IN.

     There are two of these rigs on the home page and two light-leak rigs
     besides, and every lamp in all four used to run its loop for the whole
     visit whether its section was on screen or five screens above. Twenty-odd
     infinite animations, each writing a style every frame, on a phone that is
     trying to scroll. They now run only while their own section is anywhere
     near the viewport and hold their last frame otherwise — which nobody can
     see, because the wrapper opacity has already taken the rig to nought by
     then. */
  const near = useInView(ref, { margin: "200px" });
  const live = !reduced && near;

  const lamps = variant === "full" ? LAMPS : LAMPS.slice(0, 3);
  const haze = variant === "full" ? HAZE : HAZE.slice(0, 2);
  const strength =
    variant === "full" ? "opacity-70 md:opacity-100" : "opacity-40 md:opacity-65";

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);
  /* Two tracks pulling against each other — the lamps never move as one. */
  const xA = useTransform(scrollYProgress, [0, 1], ["-4%", "5%"]);
  const xB = useTransform(scrollYProgress, [0, 1], ["4%", "-6%"]);
  const opacity = useTransform(
    scrollYProgress,
    fadeOut ? [0, 0.12, 0.55, 0.9] : [0, 0.12, 1, 1],
    fadeOut ? [0, 1, 1, 0] : [0, 1, 1, 1],
  );

  return (
    <motion.div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ opacity, y: reduced ? undefined : y }}
      aria-hidden="true"
    >
      {/* the scroll fade owns the wrapper's opacity, so the per-variant and
          per-breakpoint strength has to live one level in */}
      <div className={`absolute inset-0 ${strength}`}>
        {lamps.map((lamp, i) => (
          <motion.div
            key={`lamp-${i}`}
            className={`absolute rounded-full ${lamp.place} ${
              lamp.desktopOnly ? "hidden md:block" : ""
            }`}
            style={{
              background: `radial-gradient(circle, ${lamp.color}, transparent 70%)`,
              filter: lamp.blur[0],
              x: reduced ? undefined : lamp.track === "a" ? xA : xB,
            }}
            /* THE BLUR RADIUS IS NOT ANIMATED ON A PHONE, and it was the
               single most expensive thing in this file. Opacity and scale are
               compositor work on a layer the GPU already holds; changing the
               radius throws that layer away and blurs a seventy-viewport-high
               circle again from scratch, sixty times a second, five lamps at
               once. The lamp still swells and still fades — it simply softens
               by a fixed amount instead of a moving one, which at this size
               and this opacity is a difference nobody can point to. */
            /* A LOOP IS STOPPED BY BEING REPLACED, not by being taken away.
               Handing `animate` undefined leaves whatever is already running
               exactly where it is — still ticking, still writing a style every
               frame, off screen and forever. A resting pose supersedes it. */
            animate={
              live
                ? {
                    opacity: [0.35, 1, 0.35],
                    scale: [0.92, 1.16, 0.92],
                    ...(phone
                      ? null
                      : { filter: [lamp.blur[0], lamp.blur[1], lamp.blur[0]] }),
                    transition: {
                      duration: lamp.duration,
                      delay: lamp.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }
                : {
                    opacity: 0.7,
                    scale: 1,
                    filter: lamp.blur[0],
                    transition: { duration: 0 },
                  }
            }
          />
        ))}

        {/* smoke last, so the beams read as coming through it */}
        {haze.map((bank, i) => (
          <motion.div
            key={`haze-${i}`}
            className={`absolute rounded-full ${bank.place} [filter:blur(70px)] md:[filter:blur(100px)] ${
              bank.desktopOnly ? "hidden md:block" : ""
            }`}
            style={{
              background: `radial-gradient(circle, ${bank.color}, transparent 72%)`,
            }}
            animate={
              live
                ? {
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.12, 1],
                    x: bank.drift.x,
                    y: bank.drift.y,
                    transition: {
                      duration: bank.duration,
                      delay: bank.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }
                : {
                    opacity: 0.75,
                    scale: 1,
                    x: bank.drift.x[0],
                    y: bank.drift.y[0],
                    transition: { duration: 0 },
                  }
            }
          />
        ))}
      </div>
    </motion.div>
  );
}
