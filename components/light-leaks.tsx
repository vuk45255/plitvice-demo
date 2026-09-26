"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { breath } from "@/lib/atmosphere";
import { useHostedViewTimeline } from "@/lib/scroll-timeline";

/* Light leaks, smoke and grain — the room rather than a background.

   The leaks are long soft bands, not circles: rotated, heavily blurred, and
   travelling right across the section on their own clocks, so what you catch
   is a beam crossing the room rather than a gradient sitting still. Violet and
   blue for the rig, one near-white for the beam that cuts through the haze.

   Everything is gradients, transform and opacity. The grain is a single static
   tile. Lives inside its section (z-0, content at z-10) and is clipped by it.

   The travel is CSS on the compositor — see `.atmo-loop` in app/globals.css —
   and the rig's scroll fade is Motion on a desk and the section's scroll
   timeline on a phone, exactly as in components/ambient.tsx. */

type Leak = {
  place: string;
  color: string;
  tilt: number;
  duration: number;
  delay: number;
  /* Out to the second value and back. */
  travel: { x: [string, string]; y: [string, string] };
  desktopOnly?: boolean;
};

const LEAKS: Leak[] = [
  {
    place: "-left-[30%] top-[6%] h-[38vh] w-[85vw]",
    color: "rgba(126,74,186,0.34)",
    tilt: -18,
    duration: 34,
    delay: 0,
    travel: { x: ["-12%", "22%"], y: ["0%", "18%"] },
  },
  {
    place: "-right-[28%] top-[38%] h-[32vh] w-[80vw]",
    color: "rgba(64,96,190,0.26)",
    tilt: 14,
    duration: 47,
    delay: 6,
    travel: { x: ["16%", "-20%"], y: ["0%", "-14%"] },
  },
  {
    /* the hard beam — thin, pale, and the fastest of the three */
    place: "left-[10%] top-[24%] h-[16vh] w-[70vw]",
    color: "rgba(226,220,240,0.14)",
    tilt: -26,
    duration: 29,
    delay: 12,
    travel: { x: ["-18%", "26%"], y: ["6%", "-10%"] },
    desktopOnly: true,
  },
  {
    place: "left-[4%] -bottom-[10%] h-[30vh] w-[75vw]",
    color: "rgba(200,164,93,0.16)",
    tilt: 8,
    duration: 53,
    delay: 3,
    travel: { x: ["10%", "-16%"], y: ["0%", "-8%"] },
    desktopOnly: true,
  },
];

/* Slower than everything else by a long way. */
const SMOKE: Omit<Leak, "tilt">[] = [
  {
    place: "-left-[15%] top-[20%] h-[50vh] w-[95vw]",
    color: "rgba(172,152,202,0.07)",
    duration: 68,
    delay: 0,
    travel: { x: ["0%", "12%"], y: ["0%", "-6%"] },
  },
  {
    place: "-right-[15%] bottom-[4%] h-[45vh] w-[90vw]",
    color: "rgba(150,126,186,0.06)",
    duration: 84,
    delay: 18,
    travel: { x: ["0%", "-14%"], y: ["0%", "5%"] },
  },
];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

type LightLeaksProps = {
  /* "strong" is the dance floor; "soft" is everywhere the content is the point. */
  intensity?: "strong" | "soft";
  /* Fade the rig out across the second half of the section. */
  fadeOut?: boolean;
  /* The caller knows the rig cannot be seen — the concierge's backdrop sits
     at opacity 0 for the whole of its pinned scene — so nothing travels. */
  paused?: boolean;
};

export function LightLeaks({
  intensity = "strong",
  fadeOut = false,
  paused = false,
}: LightLeaksProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /* The beams travel only while their section is anywhere near the screen,
     and pause mid-crossing otherwise — see the same note in
     components/ambient.tsx. */
  const near = useInView(ref, { margin: "200px" });
  const idle = reduced || paused || !near ? "true" : undefined;
  const compositor = useHostedViewTimeline(ref) && !reduced;

  const leaks = intensity === "strong" ? LEAKS : LEAKS.slice(0, 2);
  const strength =
    intensity === "strong"
      ? "opacity-60 md:opacity-100"
      : "opacity-35 md:opacity-60";

  const room = (
    <>
      <div className={`absolute inset-0 ${strength}`} data-idle={idle}>
        {leaks.map((leak, i) => (
          /* The beam travels; the blur inside it does not. A blurred box
             whose transform changes is re-blurred on every frame of that
             change, and these beams cross the whole room for the entire time
             their section is on screen. So the travel is the parent's and the
             blur is the child's, which never moves and is rasterised once.
             The picture is the same to the pixel: the kernel is circular and
             applies in local space, so blurring inside a rotated, travelling
             box and rotating and travelling a blurred box are the same
             operation. `rotate` composes between the travel and the scale,
             where Motion put it. */
          <div
            key={`leak-${i}`}
            className={`atmo-loop absolute ${leak.place} ${
              leak.desktopOnly ? "hidden md:block" : ""
            }`}
            style={{
              rotate: `${leak.tilt}deg`,
              ...breath({
                duration: leak.duration,
                delay: leak.delay,
                opacity: [0.45, 1],
                x: leak.travel.x,
                y: leak.travel.y,
                rest: 0.7,
              }),
            }}
          >
            <div
              className="atmosphere-blur absolute inset-0 rounded-full [filter:blur(60px)] md:[filter:blur(90px)]"
              style={{
                background: `radial-gradient(closest-side, ${leak.color}, transparent 78%)`,
              }}
            />
          </div>
        ))}

        {/* smoke over the beams, so the light reads as passing through it */}
        {SMOKE.map((bank, i) => (
          <div
            key={`smoke-${i}`}
            className={`atmo-loop absolute ${bank.place}`}
            style={breath({
              duration: bank.duration,
              delay: bank.delay,
              opacity: [0.6, 1],
              x: bank.travel.x,
              y: bank.travel.y,
              rest: 0.8,
            })}
          >
            {/* held still and blurred once, for the reason above */}
            <div
              className="atmosphere-blur absolute inset-0 rounded-full [filter:blur(80px)] md:[filter:blur(110px)]"
              style={{
                background: `radial-gradient(closest-side, ${bank.color}, transparent 80%)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* a little more grain than the page carries, so these sections read
          as film rather than as flat surfaces */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />
    </>
  );

  return (
    /* The observed box, which neither clips nor moves — see the note on the
       same element in components/ambient.tsx. */
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      {compositor ? (
        <div
          className="absolute inset-0 overflow-hidden"
          data-rig={fadeOut ? "leaks-out" : "leaks"}
        >
          {room}
        </div>
      ) : paused ? (
        /* Nobody can see it, so nothing measures the scroll for it either.
           It picks the measurement back up the moment it is about to be seen,
           which is still under an opacity of nought. */
        <div className="absolute inset-0 overflow-hidden">{room}</div>
      ) : (
        <MotionRig target={ref} fadeOut={fadeOut}>
          {room}
        </MotionRig>
      )}
    </div>
  );
}

/* The scroll fade, measured in JavaScript — see MotionRig in
   components/ambient.tsx for when this is the path taken. */
function MotionRig({
  target,
  fadeOut,
  children,
}: {
  target: React.RefObject<HTMLDivElement | null>;
  fadeOut: boolean;
  children: React.ReactNode;
}) {
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start end", "end start"],
  });
  const opacity = useTransform(
    scrollYProgress,
    fadeOut ? [0, 0.15, 0.6, 0.95] : [0, 0.15, 1, 1],
    fadeOut ? [0, 1, 1, 0] : [0, 1, 1, 1],
  );

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ opacity }}
    >
      {children}
    </motion.div>
  );
}
