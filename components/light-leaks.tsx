"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/* Light leaks, smoke and grain — the room rather than a background.

   The leaks are long soft bands, not circles: rotated, heavily blurred, and
   travelling right across the section on their own clocks, so what you catch
   is a beam crossing the room rather than a gradient sitting still. Violet and
   blue for the rig, one near-white for the beam that cuts through the haze.

   Everything is gradients, transform and opacity. The grain is a single static
   tile. Lives inside its section (z-0, content at z-10) and is clipped by it. */

type Leak = {
  place: string;
  color: string;
  tilt: number;
  duration: number;
  delay: number;
  travel: { x: string[]; y: string[] };
  desktopOnly?: boolean;
};

const LEAKS: Leak[] = [
  {
    place: "-left-[30%] top-[6%] h-[38vh] w-[85vw]",
    color: "rgba(126,74,186,0.34)",
    tilt: -18,
    duration: 34,
    delay: 0,
    travel: { x: ["-12%", "22%", "-12%"], y: ["0%", "18%", "0%"] },
  },
  {
    place: "-right-[28%] top-[38%] h-[32vh] w-[80vw]",
    color: "rgba(64,96,190,0.26)",
    tilt: 14,
    duration: 47,
    delay: 6,
    travel: { x: ["16%", "-20%", "16%"], y: ["0%", "-14%", "0%"] },
  },
  {
    /* the hard beam — thin, pale, and the fastest of the three */
    place: "left-[10%] top-[24%] h-[16vh] w-[70vw]",
    color: "rgba(226,220,240,0.14)",
    tilt: -26,
    duration: 29,
    delay: 12,
    travel: { x: ["-18%", "26%", "-18%"], y: ["6%", "-10%", "6%"] },
    desktopOnly: true,
  },
  {
    place: "left-[4%] -bottom-[10%] h-[30vh] w-[75vw]",
    color: "rgba(200,164,93,0.16)",
    tilt: 8,
    duration: 53,
    delay: 3,
    travel: { x: ["10%", "-16%", "10%"], y: ["0%", "-8%", "0%"] },
    desktopOnly: true,
  },
];

/* Slower than everything else by a long way. */
const SMOKE = [
  {
    place: "-left-[15%] top-[20%] h-[50vh] w-[95vw]",
    color: "rgba(172,152,202,0.07)",
    duration: 68,
    delay: 0,
    travel: { x: ["0%", "12%", "0%"], y: ["0%", "-6%", "0%"] },
  },
  {
    place: "-right-[15%] bottom-[4%] h-[45vh] w-[90vw]",
    color: "rgba(150,126,186,0.06)",
    duration: 84,
    delay: 18,
    travel: { x: ["0%", "-14%", "0%"], y: ["0%", "5%", "0%"] },
  },
];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

type LightLeaksProps = {
  /* "strong" is the dance floor; "soft" is everywhere the content is the point. */
  intensity?: "strong" | "soft";
  /* Fade the rig out across the second half of the section. */
  fadeOut?: boolean;
};

export function LightLeaks({
  intensity = "strong",
  fadeOut = false,
}: LightLeaksProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /* The beams travel only while their section is anywhere near the screen.
     Four of these rigs used to cross their rooms for the whole visit — see
     the same note in components/ambient.tsx. */
  const near = useInView(ref, { margin: "200px" });
  const live = !reduced && near;

  const leaks = intensity === "strong" ? LEAKS : LEAKS.slice(0, 2);
  const strength =
    intensity === "strong"
      ? "opacity-60 md:opacity-100"
      : "opacity-35 md:opacity-60";

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const opacity = useTransform(
    scrollYProgress,
    fadeOut ? [0, 0.15, 0.6, 0.95] : [0, 0.15, 1, 1],
    fadeOut ? [0, 1, 1, 0] : [0, 1, 1, 1],
  );

  return (
    <motion.div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div className={`absolute inset-0 ${strength}`}>
        {leaks.map((leak, i) => (
          <motion.div
            key={`leak-${i}`}
            className={`absolute rounded-full [filter:blur(60px)] md:[filter:blur(90px)] ${leak.place} ${
              leak.desktopOnly ? "hidden md:block" : ""
            }`}
            style={{
              background: `radial-gradient(closest-side, ${leak.color}, transparent 78%)`,
              rotate: leak.tilt,
            }}
            /* Stopped by being replaced rather than by being taken away —
               see the same note in components/ambient.tsx. */
            animate={
              live
                ? {
                    x: leak.travel.x,
                    y: leak.travel.y,
                    opacity: [0.45, 1, 0.45],
                    transition: {
                      duration: leak.duration,
                      delay: leak.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }
                : {
                    x: leak.travel.x[0],
                    y: leak.travel.y[0],
                    opacity: 0.7,
                    transition: { duration: 0 },
                  }
            }
          />
        ))}

        {/* smoke over the beams, so the light reads as passing through it */}
        {SMOKE.map((bank, i) => (
          <motion.div
            key={`smoke-${i}`}
            className={`absolute rounded-full [filter:blur(80px)] md:[filter:blur(110px)] ${bank.place}`}
            style={{
              background: `radial-gradient(closest-side, ${bank.color}, transparent 80%)`,
            }}
            animate={
              live
                ? {
                    x: bank.travel.x,
                    y: bank.travel.y,
                    opacity: [0.6, 1, 0.6],
                    transition: {
                      duration: bank.duration,
                      delay: bank.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }
                : {
                    x: bank.travel.x[0],
                    y: bank.travel.y[0],
                    opacity: 0.8,
                    transition: { duration: 0 },
                  }
            }
          />
        ))}
      </div>

      {/* a little more grain than the page carries, so these sections read
          as film rather than as flat surfaces */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />
    </motion.div>
  );
}
