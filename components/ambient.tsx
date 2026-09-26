"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { breath } from "@/lib/atmosphere";
import { useHostedViewTimeline } from "@/lib/scroll-timeline";

/* Purple lamps behind the page, and the haze that makes their beams visible.

   Each lamp breathes on its own clock — opacity, scale and blur together, so
   it swells and softens instead of just fading. The haze sits over the lamps,
   drifting far more slowly, which is what makes the light read as passing
   through smoke rather than sitting on a flat background.

   Scroll moves the whole rig, and pushes the lamps sideways against each other
   so the room appears to have depth as you travel through it.

   Two of the five lamps and one haze bank are desktop-only: the effect holds
   on a phone with three, and the fewer large filtered layers there are, the
   cheaper it composites. Lives inside its section (z-0, content at z-10).

   The breathing is CSS on the compositor (`.atmo-loop` in app/globals.css);
   the scroll travel is Motion on a desk and the section's scroll timeline on a
   phone. Same curves, same stops, same picture. */

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
  drift: { x: [number, number]; y: [number, number] };
  desktopOnly?: boolean;
};

/* Slow enough that you never catch it moving. Each drift goes out to the
   second value and back. */
const HAZE: Haze[] = [
  {
    place: "-left-[10%] top-[16%] h-[48vh] w-[90vw]",
    color: "rgba(172,152,202,0.08)",
    duration: 46,
    delay: 0,
    drift: { x: [0, 80], y: [0, -30] },
  },
  {
    place: "left-[12%] top-[50%] h-[40vh] w-[75vw]",
    color: "rgba(210,192,230,0.06)",
    duration: 61,
    delay: 7,
    drift: { x: [0, -100], y: [0, 26] },
  },
  {
    place: "-right-[15%] -bottom-[8%] h-[44vh] w-[80vw]",
    color: "rgba(152,128,188,0.07)",
    duration: 53,
    delay: 14,
    drift: { x: [0, 70], y: [0, -20] },
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

/* The two lamp tracks, however they are being driven: Motion values on a
   desk, a scroll-driven animation on a phone, nothing under reduced motion. */
type Tracks =
  | { kind: "motion"; a: MotionValue<string>; b: MotionValue<string> }
  | { kind: "css" }
  | { kind: "still" };

export function Ambient({ variant = "full", fadeOut = false }: AmbientProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /* NOTHING BREATHES IN A ROOM NOBODY IS STANDING IN.

     The loops run on the compositor, but a running compositor animation still
     keeps its layers ticking. They are paused whenever their section is not
     anywhere near the viewport — and resume from the frame they stopped on,
     rather than snapping to a resting pose and starting over. */
  const near = useInView(ref, { margin: "200px" });
  const idle = reduced || !near ? "true" : undefined;

  /* A phone that can run scroll-driven animations hands the rig's travel to
     its section's own timeline; everything else keeps Motion. */
  const compositor = useHostedViewTimeline(ref) && !reduced;

  const lamps = variant === "full" ? LAMPS : LAMPS.slice(0, 3);
  const haze = variant === "full" ? HAZE : HAZE.slice(0, 2);
  const strength =
    variant === "full" ? "opacity-70 md:opacity-100" : "opacity-40 md:opacity-65";

  const room = (tracks: Tracks) => (
    /* the scroll fade owns the rig's opacity, so the per-variant and
       per-breakpoint strength has to live one level in */
    <div className={`absolute inset-0 ${strength}`} data-idle={idle}>
      {lamps.map((lamp, i) => (
        /* THREE ELEMENTS, THREE JOBS: the outer one rides the scroll track,
           the middle one breathes, the inner one carries the blur. */
        <motion.div
          key={`lamp-${i}`}
          className={`absolute ${lamp.place} ${
            lamp.desktopOnly ? "hidden md:block" : ""
          }`}
          style={
            tracks.kind === "motion"
              ? { x: lamp.track === "a" ? tracks.a : tracks.b }
              : undefined
          }
          data-track={tracks.kind === "css" ? lamp.track : undefined}
        >
          <div
            className="atmo-loop absolute inset-0"
            style={breath({
              duration: lamp.duration,
              delay: lamp.delay,
              opacity: [0.35, 1],
              scale: [0.92, 1.16],
              rest: 0.7,
            })}
          >
            {/* ── WHY THE BLUR IS ON A CHILD AND NOT ON THE LAMP ──────────
               *
               * A blurred box whose own transform changes is a blurred box
               * that has to be blurred again. Measured, on the home page, at
               * a phone's pixel ratio: the five rigs on this page were
               * costing 12.6 SECONDS of GPU time across a thirteen-second
               * scroll — a saturated GPU process and 427 dropped frames —
               * and pinning the lamps' transforms took that to zero without
               * touching a single blur radius. The radius was never the
               * price. Re-blurring a seventy-viewport circle sixty times a
               * second was.
               *
               * So the movement and the blur are separated. The parents
               * carry everything that changes — the scroll parallax, the
               * breathing scale, the opacity — and the compositor moves them
               * as finished textures. This child carries the gradient and
               * the blur, never changes on a phone, and is therefore
               * rasterised once and reused for the rest of the visit.
               *
               * THE BLUR RADIUS IS NOT ANIMATED ON A PHONE. The lamp still
               * swells and still fades — it simply softens by a fixed amount
               * instead of a moving one, which at this size and this opacity
               * is a difference nobody can point to. A desk, which has the
               * GPU for it, still gets the softening: `.atmo-soften` only
               * exists behind a fine pointer. */}
            <div
              className="atmosphere-blur atmo-soften absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${lamp.color}, transparent 70%)`,
                filter: lamp.blur[0],
                ...breath({
                  duration: lamp.duration,
                  delay: lamp.delay,
                  blur: lamp.blur,
                }),
              }}
            />
          </div>
        </motion.div>
      ))}

      {/* smoke last, so the beams read as coming through it */}
      {haze.map((bank, i) => (
        /* Split for the same reason as the lamps above: the bank drifts,
           the blur inside it holds still and is rasterised once. */
        <div
          key={`haze-${i}`}
          className={`atmo-loop absolute ${bank.place} ${
            bank.desktopOnly ? "hidden md:block" : ""
          }`}
          style={breath({
            duration: bank.duration,
            delay: bank.delay,
            opacity: [0.5, 1],
            scale: [1, 1.12],
            x: bank.drift.x,
            y: bank.drift.y,
            rest: 0.75,
          })}
        >
          <div
            className="atmosphere-blur absolute inset-0 rounded-full [filter:blur(70px)] md:[filter:blur(100px)]"
            style={{
              background: `radial-gradient(circle, ${bank.color}, transparent 72%)`,
            }}
          />
        </div>
      ))}
    </div>
  );

  return (
    /* The observed box. It neither clips nor moves, so the rig inside can
       change driver without the observer losing its element — and its box is
       the section's box, which is what the scroll is measured against either
       way. The rig inside is the element that clips and travels, as the
       single wrapper used to. */
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      {compositor ? (
        <div
          className="absolute inset-0 overflow-hidden"
          data-rig={fadeOut ? "ambient-out" : "ambient"}
        >
          {room({ kind: "css" })}
        </div>
      ) : (
        <MotionRig target={ref} fadeOut={fadeOut} reduced={!!reduced}>
          {room}
        </MotionRig>
      )}
    </div>
  );
}

/* The desk's rig — and a phone's, where the browser cannot run scroll-driven
   animations or the rig is not its section's direct child. A component of its
   own so that a phone on the compositor path never subscribes to the scroll. */
function MotionRig({
  target,
  fadeOut,
  reduced,
  children,
}: {
  target: React.RefObject<HTMLDivElement | null>;
  fadeOut: boolean;
  reduced: boolean;
  children: (tracks: Tracks) => React.ReactNode;
}) {
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);
  /* Two tracks pulling against each other — the lamps never move as one. */
  const a = useTransform(scrollYProgress, [0, 1], ["-4%", "5%"]);
  const b = useTransform(scrollYProgress, [0, 1], ["4%", "-6%"]);
  const opacity = useTransform(
    scrollYProgress,
    fadeOut ? [0, 0.12, 0.55, 0.9] : [0, 0.12, 1, 1],
    fadeOut ? [0, 1, 1, 0] : [0, 1, 1, 1],
  );

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ opacity, y: reduced ? undefined : y }}
    >
      {children(reduced ? { kind: "still" } : { kind: "motion", a, b })}
    </motion.div>
  );
}
