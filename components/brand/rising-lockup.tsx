"use client";

import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { EASE } from "@/components/reveal";
import { PRIMARY, PRIMARY_PARTS } from "@/lib/brand-artwork";
import { LOGO_NAME } from "@/components/brand/plitvice-logo";

/* THE LOCKUP, RAISED.
 *
 * The client's PL▷TWICE / HYPERCLUB drawn from its own outlines, each letter
 * rising out of a hard-clipped frame left to right — the triangle travelling
 * with its tittle as the one letter it is — and HYPERCLUB landing under the
 * word from a frame of its own once the word is up. The hero opens the site
 * with this and the footer closes it with the same gesture.
 *
 * Two clips, both in the artwork's coordinates and split at the gap between
 * the lines, so no letter is ever seen crossing the other line on its way.
 *
 *   play    true/false when the caller owns the moment (the hero's ceremony);
 *           left out, it plays once, the first time it is half on screen.
 *   still   at rest from the first frame — reduced motion, a return visit.
 *   delay   seconds before the first letter; `lineAt` is HYPERCLUB's, on the
 *           same clock. */
type RisingLockupProps = {
  className?: string;
  play?: boolean;
  still?: boolean;
  delay?: number;
  lineAt?: number;
  /* When the light passes across the landed lockup, on the same clock. Left
     out, no light — see <Sweep> below. */
  sweepAt?: number;
  /* A unique prefix for the clip ids; two of these can share a page. */
  id: string;
  decorative?: boolean;
};

const WORD_DROP = PRIMARY_PARTS.split + 30;
const LINE_DROP = PRIMARY.height - PRIMARY_PARTS.split + 10;

export function RisingLockup({
  className,
  play,
  still: held = false,
  delay = 0,
  lineAt = 1,
  sweepAt,
  id,
  decorative = false,
}: RisingLockupProps) {
  const reduced = useReducedMotion();
  const still = held || !!reduced;
  const d = (seconds: number) => (still ? 0 : seconds);
  /* How letter `i` rises — shared by the letter and by its piece of light. */
  const rise = (i: number) => ({
    custom: d(delay + i * 0.08),
    variants: {
      hidden: { y: WORD_DROP },
      show: (at: number) => ({
        y: 0,
        transition: { duration: still ? 0 : 1.15, delay: at, ease: EASE },
      }),
    } satisfies Variants,
  });
  const trigger =
    play === undefined
      ? { whileInView: "show", viewport: { once: true, amount: 0.5 } }
      : { animate: play ? "show" : "hidden" };

  return (
    <motion.svg
      viewBox={`0 0 ${PRIMARY.width} ${PRIMARY.height}`}
      width={PRIMARY.width}
      height={PRIMARY.height}
      fill="currentColor"
      /* Visible overflow so a sweep's bloom is not sheared at the artwork's
         edge; the letters themselves are held by their own clips. */
      className={`block h-auto overflow-visible ${className ?? ""}`}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": LOGO_NAME })}
      initial={still ? false : "hidden"}
      {...trigger}
      variants={{ hidden: {}, show: {} }}
    >
      <defs>
        <clipPath id={`${id}-word`}>
          <rect
            x={-20}
            y={-40}
            width={PRIMARY.width + 40}
            height={PRIMARY_PARTS.split + 40}
          />
        </clipPath>
        <clipPath id={`${id}-line`}>
          <rect
            x={-20}
            y={PRIMARY_PARTS.split}
            width={PRIMARY.width + 40}
            height={PRIMARY.height - PRIMARY_PARTS.split + 4}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-word)`}>
        {PRIMARY_PARTS.letters.map((letter, i) => (
          <motion.path key={i} d={letter} {...rise(i)} />
        ))}
      </g>
      <g clipPath={`url(#${id}-line)`}>
        <motion.path
          d={PRIMARY_PARTS.line}
          variants={{
            hidden: { y: LINE_DROP },
            show: {
              y: 0,
              transition: {
                duration: still ? 0 : 1.1,
                delay: d(lineAt),
                ease: EASE,
              },
            },
          }}
        />
      </g>

      {/* Only where the caller owns the moment: the light starts on the same
          flag that raises the letters, never on mount or on sight. */}
      {sweepAt !== undefined && play !== undefined && !still ? (
        <Sweep id={id} at={sweepAt} play={play} rise={rise} />
      ) : null}
    </motion.svg>
  );
}

/* THE LIGHT ACROSS THE LETTERS — once, and only over letters that are there.
 *
 * A slanted band travels left to right: pink, magenta, violet, a white-hot
 * core, and back out through violet, magenta and pink, with a bloom of the
 * same light around it.
 *
 * IT CAN ONLY EVER LIGHT A LETTER THAT HAS RISEN. The light is not one layer
 * clipped to where the word will end up; each letter carries its own piece of
 * it, inside the very group that raises that letter, clipped to that letter's
 * outline in that letter's own coordinates. While a letter is below the line,
 * so is its light — under the same frame that hides it. There is no position
 * the band can be in that shows pink where there is no ink.
 *
 * AND BEFORE THE REVEAL IT IS NOT THERE AT ALL. Three locks, any one of which
 * would do: the whole effect sits at opacity 0 (rendered that way by the
 * server, so no first frame can show it); the band is parked fully clear of
 * the P, bloom included; and nothing moves until the caller's `play` turns
 * true — the same moment, and the same flag, that raises the letters.
 *
 * ITS OWN CLOCK, STARTED ONCE. Two motion values, animated from an effect
 * keyed on `play`: a re-render does not restart it, scrolling away and back
 * does not replay it, and when it is done it rests off the E at opacity 0.
 * `at` is on the letters' clock, so the light arrives at each letter after
 * that letter has landed — see T_SWEEP in components/hero.tsx. */
const BAND = 260;
/* The band leans; its foot trails its head by this much per unit of height. */
const LEAN = 0.32;
/* How far the bloom reaches past the band, in artwork units (3σ of the wide
   blur). The band is parked and sent this much further out. */
const BLOOM_REACH = 60;
/* Wholly left of the P at every height, bloom and all. */
const SWEEP_FROM = -(BAND + 20 * LEAN) - BLOOM_REACH;
/* Wholly right of the E at the foot of the lean, bloom and all. */
const SWEEP_TO = PRIMARY.width + (PRIMARY.height + 20) * LEAN + BLOOM_REACH;
const SWEEP_SECONDS = 1.6;
const SWEEP_EASE: [number, number, number, number] = [0.45, 0.05, 0.35, 1];

function Sweep({
  id,
  at,
  play,
  rise,
}: {
  id: string;
  at: number;
  play: boolean;
  /* The letters' own rise, so each piece of light moves with its letter. */
  rise: (i: number) => { custom: number; variants: Variants };
}) {
  const x = useMotionValue(SWEEP_FROM);
  const glow = useMotionValue(0);

  useEffect(() => {
    if (!play) {
      x.set(SWEEP_FROM);
      glow.set(0);
      return;
    }
    const travel = animate(x, SWEEP_TO, {
      duration: SWEEP_SECONDS,
      delay: at,
      ease: SWEEP_EASE,
    });
    /* Up quickly once it is moving, down as it leaves the E. */
    const light = animate(glow, [0, 1, 1, 0], {
      duration: SWEEP_SECONDS,
      delay: at,
      times: [0, 0.12, 0.86, 1],
      ease: "linear",
    });
    return () => {
      travel.stop();
      light.stop();
    };
  }, [play, at, x, glow]);

  const band = (
    <motion.g style={{ x }}>
      <rect
        x={0}
        y={-20}
        width={BAND}
        height={PRIMARY.height + 40}
        fill={`url(#${id}-band)`}
        transform={`skewX(${-Math.atan(LEAN) * (180 / Math.PI)})`}
      />
    </motion.g>
  );
  /* One piece of light per letter, raised with it and clipped to it. */
  const pieces = PRIMARY_PARTS.letters.map((_, i) => (
    <motion.g key={i} {...rise(i)}>
      <g clipPath={`url(#${id}-ink-${i})`}>{band}</g>
    </motion.g>
  ));

  return (
    <motion.g aria-hidden="true" pointerEvents="none" style={{ opacity: glow }}>
      <defs>
        {PRIMARY_PARTS.letters.map((letter, i) => (
          <clipPath key={i} id={`${id}-ink-${i}`}>
            <path d={letter} />
          </clipPath>
        ))}
        {/* The bloom's frame: the word's, opened out so the glow is not
            sheared at the baseline. A letter only meets the light once it has
            landed (see T_SWEEP), so nothing rising sits in the extra margin. */}
        <clipPath id={`${id}-glow`}>
          <rect
            x={-BLOOM_REACH - 20}
            y={-BLOOM_REACH - 40}
            width={PRIMARY.width + 2 * BLOOM_REACH + 40}
            height={PRIMARY_PARTS.split + BLOOM_REACH + 40}
          />
        </clipPath>
        <linearGradient id={`${id}-band`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f178b6" stopOpacity="0" />
          <stop offset="0.14" stopColor="#f178b6" stopOpacity="0.75" />
          <stop offset="0.28" stopColor="#d44bd6" stopOpacity="0.95" />
          <stop offset="0.41" stopColor="#9d6bff" stopOpacity="1" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.59" stopColor="#9d6bff" stopOpacity="1" />
          <stop offset="0.72" stopColor="#d44bd6" stopOpacity="0.95" />
          <stop offset="0.86" stopColor="#f178b6" stopOpacity="0.75" />
          <stop offset="1" stopColor="#f178b6" stopOpacity="0" />
        </linearGradient>
        <filter
          id={`${id}-bloom`}
          filterUnits="userSpaceOnUse"
          x={-80}
          y={-80}
          width={PRIMARY.width + 160}
          height={PRIMARY.height + 160}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="near" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="far" />
          <feComponentTransfer in="far" result="wide">
            <feFuncA type="linear" slope="2.4" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="wide" />
            <feMergeNode in="near" />
          </feMerge>
        </filter>
      </defs>

      {/* the bloom, in its own frame around the word */}
      <g clipPath={`url(#${id}-glow)`}>
        <g filter={`url(#${id}-bloom)`}>{pieces}</g>
      </g>
      {/* the reflection itself, sharp, inside each letter and under the same
          frame the letters rise through */}
      <g clipPath={`url(#${id}-word)`}>{pieces}</g>
    </motion.g>
  );
}