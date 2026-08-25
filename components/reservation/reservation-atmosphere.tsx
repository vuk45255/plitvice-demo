"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCoarsePointer } from "@/lib/use-media";

/* The room the reservation is taken in.

   Ambient (the page-wide rig) is driven by useScroll against its own section,
   which never progresses inside a fixed overlay — it would sit at zero opacity
   forever. So the reservation room gets its own lights: the same violet lamps
   and the same slow smoke, on their own clocks rather than on the scroll. */

type Lamp = {
  place: string;
  color: string;
  blur: [string, string];
  duration: number;
  delay: number;
  desktopOnly?: boolean;
};

const LAMPS: Lamp[] = [
  {
    place: "-left-[22%] -top-[10%] h-[80vh] w-[80vh]",
    color: "rgba(126,74,186,0.42)",
    blur: ["blur(60px)", "blur(95px)"],
    duration: 9,
    delay: 0,
  },
  {
    place: "-right-[20%] top-[18%] h-[72vh] w-[72vh]",
    color: "rgba(98,54,162,0.40)",
    blur: ["blur(65px)", "blur(100px)"],
    duration: 11,
    delay: 2.2,
  },
  {
    /* the warm one, low — the lamp over the bar */
    place: "left-[24%] -bottom-[24%] h-[62vh] w-[62vh]",
    color: "rgba(200,164,93,0.20)",
    blur: ["blur(60px)", "blur(90px)"],
    duration: 10,
    delay: 4.1,
    desktopOnly: true,
  },
];

const HAZE: { place: string; color: string; duration: number; delay: number; drift: { x: number[]; y: number[] } }[] = [
  {
    place: "-left-[12%] top-[12%] h-[52vh] w-[95vw]",
    color: "rgba(172,152,202,0.075)",
    duration: 44,
    delay: 0,
    drift: { x: [0, 90, 0], y: [0, -28, 0] },
  },
  {
    place: "left-[8%] top-[54%] h-[44vh] w-[80vw]",
    color: "rgba(210,192,230,0.055)",
    duration: 59,
    delay: 6,
    drift: { x: [0, -110, 0], y: [0, 24, 0] },
  },
];

export function ReservationAtmosphere() {
  const reduced = useReducedMotion();
  const phone = useCoarsePointer();

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* the flat velvet the lights sit on */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 60% at 50% -8%, rgba(42,18,63,0.92), transparent 68%), radial-gradient(60% 45% at 82% 88%, rgba(27,15,43,0.75), transparent 72%)",
        }}
      />

      <div className="absolute inset-0 opacity-75 md:opacity-100">
        {LAMPS.map((lamp, i) => (
          <motion.div
            key={`lamp-${i}`}
            className={`absolute rounded-full ${lamp.place} ${
              lamp.desktopOnly ? "hidden md:block" : ""
            }`}
            style={{
              background: `radial-gradient(circle, ${lamp.color}, transparent 70%)`,
              filter: lamp.blur[0],
            }}
            /* The radius holds still on a phone — see the note on the same
               animation in components/ambient.tsx. This rig sits under a form
               people are typing into, which is the worst place on the site to
               be re-blurring an eighty-viewport circle every frame. */
            animate={
              reduced
                ? undefined
                : {
                    opacity: [0.4, 1, 0.4],
                    scale: [0.94, 1.14, 0.94],
                    ...(phone
                      ? null
                      : { filter: [lamp.blur[0], lamp.blur[1], lamp.blur[0]] }),
                  }
            }
            transition={{
              duration: lamp.duration,
              delay: lamp.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* smoke over the beams, never under them */}
        {HAZE.map((bank, i) => (
          <motion.div
            key={`haze-${i}`}
            className={`absolute rounded-full ${bank.place} [filter:blur(80px)] md:[filter:blur(110px)]`}
            style={{
              background: `radial-gradient(circle, ${bank.color}, transparent 72%)`,
            }}
            animate={
              reduced
                ? undefined
                : {
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.14, 1],
                    x: bank.drift.x,
                    y: bank.drift.y,
                  }
            }
            transition={{
              duration: bank.duration,
              delay: bank.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* vignette — pulls the eye to the card and nowhere else */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 60% at 50% 45%, transparent 20%, rgba(8,5,13,0.82) 100%)",
        }}
      />
    </div>
  );
}
