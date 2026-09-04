"use client";

import { motion, useReducedMotion } from "framer-motion";
import { OUTLINES } from "@/components/plitvice-signature-outlines";
import { site } from "@/lib/site";

/* PLITVICE CLUB — the signature at the foot of the site.
 *
 * TWO LAYERS, and the whole design is the separation between them.
 *
 * The FIRST is the artwork: real calligraphic outlines with true thick/thin
 * modulation — heavy downstrokes, hairline joins — as filled shapes. That
 * contrast is what makes a signature look written rather than drawn, and it is
 * the one thing a stroked centreline can never have, because a stroke has
 * exactly one width along its whole length. The outlines live in
 * ./plitvice-signature-outlines.ts, derived from Great Vibes under the SIL Open
 * Font License; the font itself is not shipped, loaded, or set as text anywhere
 * on the site — only this geometry, which the OFL expressly permits.
 *
 * The SECOND is the writing: a mask of centrelines following the path a hand
 * actually takes — up the ascender of the l, back down to the line, up the t,
 * round the bowl of the c — each animated by `pathLength` from nothing to
 * whole. The artwork is visible only where the mask has already been. So the
 * ink has the shape of calligraphy and the behaviour of handwriting, and
 * stopping it at any frame leaves a hand stopped mid-word.
 *
 * THIS IS NOT A WIPE. A wipe is a straight edge travelling left to right, and
 * it would uncover the top of a tall l before the pen had climbed it. These
 * masks rise and fall through every letter, so an ascender is uncovered as the
 * nib goes up it and not a moment before. They are deliberately approximate:
 * a mask decides WHEN ink appears, never what shape it is, so a few units
 * either way is invisible — which is exactly why the letterforms can come from
 * precise artwork while the motion is drawn by hand.
 *
 * THE RULE needs none of this. A line drawn freehand has one width anyway, so
 * it is simply a stroked path with its own draw.
 *
 * THE LIGHT ARRIVES LAST AND NEVER MOVES. Nothing blooms while the writing is
 * happening. Once the rule is down, three static layers fade up — a wide amber
 * halo, a tighter warm ring, and a pale wash over the ink itself. They are
 * faded, never drawn, and they sit outside the mask because by the time any of
 * them is above zero the mask is already fully open. Once. No pulse. */

const GOLD = "rgb(200 164 93)";
const RING = "rgba(228,178,88,0.34)";
const HALO = "rgba(206,160,72,0.42)";
const CORE = "#f7e3a4";

/* WEIGHT — the capitals, laid down. THROW — the lowercase runs, fast and
   fluid. PULL — the rule, one confident movement. BLOOM — the light, which
   does not travel and so wants a plain symmetric curve. */
const WEIGHT: [number, number, number, number] = [0.3, 0.02, 0.28, 1];
const THROW: [number, number, number, number] = [0.44, 0, 0.2, 1];
const PULL: [number, number, number, number] = [0.34, 0.02, 0.24, 1];
const BLOOM: [number, number, number, number] = [0.4, 0, 0.2, 1];

type Run = {
  /* The filled letterforms this run uncovers. */
  art: string;
  /* The centreline the nib takes through them. */
  path: string;
  at: number;
  dur: number;
  ease: [number, number, number, number];
};

/* Font coordinates: em 300, baseline at y = 0, up is negative y. */
const RUNS: Run[] = [
  {
    /* THE CAPITAL P — up the flourish, over the top, down through the bowl and
       out along the foot. */
    art: OUTLINES.cap1,
    path: "M 55 -25 C 45 -85, 85 -165, 155 -205 C 215 -240, 285 -232, 292 -196 C 298 -162, 245 -130, 180 -120 C 230 -122, 305 -108, 322 -78 C 336 -50, 292 -22, 240 -28 C 185 -34, 125 -18, 95 4 C 78 16, 62 16, 55 6",
    at: 0,
    dur: 0.75,
    ease: WEIGHT,
  },
  {
    /* litvice — the l climbs, the i is short, the t climbs less, the v drops to
       its point, the c and the e go over and round. One continuous run. */
    art: OUTLINES.run1,
    path: "M 296 -6 C 306 -70, 322 -150, 334 -184 C 342 -200, 356 -192, 350 -164 C 342 -112, 336 -50, 340 -14 C 344 4, 362 6, 372 -20 C 378 -66, 380 -120, 384 -140 C 388 -156, 400 -150, 396 -128 C 392 -84, 388 -34, 392 -12 C 398 6, 416 6, 424 -22 C 430 -74, 436 -136, 442 -158 C 446 -172, 458 -166, 454 -142 C 448 -98, 442 -40, 446 -14 C 452 6, 470 6, 478 -22 C 486 -60, 496 -94, 504 -106 C 510 -116, 520 -110, 516 -94 C 512 -66, 512 -30, 518 -10 C 524 8, 540 6, 548 -20 C 554 -54, 562 -104, 570 -128 C 576 -146, 588 -140, 584 -116 C 578 -80, 574 -34, 578 -12 C 584 6, 602 8, 612 -16 C 622 -46, 636 -90, 650 -100 C 660 -107, 668 -100, 660 -88 C 648 -72, 632 -62, 626 -50 C 620 -28, 634 8, 656 6 C 674 4, 690 -12, 698 -34 C 708 -60, 722 -94, 736 -102 C 748 -109, 754 -98, 744 -86 C 732 -72, 712 -62, 704 -60 C 700 -34, 716 8, 742 6 C 762 4, 782 -14, 792 -34",
    at: 0.7,
    dur: 1,
    ease: THROW,
  },
  {
    /* THE CAPITAL C — in from above the line, round the outside, away at the
       foot. */
    art: OUTLINES.cap2,
    path: "M 1035 -195 C 1024 -236, 958 -256, 902 -228 C 838 -196, 812 -90, 848 -34 C 878 12, 962 24, 1006 -14",
    at: 1.75,
    dur: 0.6,
    ease: WEIGHT,
  },
  {
    /* lub — the l climbs, two bumps for the u, the b climbs and closes its
       bowl. */
    art: OUTLINES.run2,
    path: "M 1012 -8 C 1022 -70, 1040 -152, 1052 -182 C 1060 -198, 1074 -190, 1068 -162 C 1060 -112, 1054 -50, 1058 -14 C 1062 4, 1080 6, 1090 -20 C 1098 -56, 1106 -90, 1112 -100 C 1118 -110, 1128 -104, 1124 -88 C 1120 -60, 1118 -28, 1124 -10 C 1130 6, 1146 4, 1154 -22 C 1160 -56, 1168 -90, 1174 -100 C 1180 -110, 1190 -104, 1186 -88 C 1182 -60, 1180 -28, 1186 -10 C 1192 6, 1208 4, 1216 -24 C 1226 -74, 1240 -152, 1250 -180 C 1256 -196, 1268 -188, 1262 -162 C 1252 -112, 1242 -50, 1244 -20 C 1246 -4, 1256 6, 1268 2 C 1282 -2, 1292 -16, 1288 -30",
    at: 2.32,
    dur: 0.68,
    ease: THROW,
  },
];

/* Wide enough to swallow the tallest letterform as the nib passes through it,
   narrow enough that it is not uncovering the letter after next. */
const NIB = 128;

/* THE RULE — in front of the P, out past the b, climbing as it travels. */
const RULE =
  "M 20 70 C 300 108, 780 112, 1080 88 C 1180 80, 1260 62, 1320 36";
const RULE_AT = 3.15;
const RULE_DUR = 0.6;
const RULE_WIDTH = 7;

/* When the last of the ink is down, and therefore when the light may start. */
export const SIGNATURE_SECONDS = RULE_AT + RULE_DUR;
const GLOW_SECONDS = 0.7;

/* WRITTEN ONCE, AND THEN IT IS WRITTEN.
 *
 * `once` is the whole of it. Without it Motion treats `whileInView` as a state
 * that is true while the element is on screen and false the moment it is not —
 * so the signature un-wrote itself on the way past and signed again on the way
 * back, indefinitely, which is the one thing a signature must never do. With
 * it the variant latches the first time the band is half on screen and the ink
 * stays down for the life of the page. */
const VIEWPORT = { amount: 0.5, once: true } as const;

/* A <mask> is never rendered, so its children have no box and an
   IntersectionObserver on them can never fire. Driving the mask paths with
   their own whileInView therefore left them at their initial values forever
   and the letters never appeared, while the rule and the light layers — which
   ARE rendered — ran normally. Hence: blank, then a rule, then the artwork
   arriving all at once behind the light.

   The trigger now lives on the <svg>, which is rendered, and reaches
   everything below through variant propagation, which travels the React tree
   rather than the layout tree. */
const BLANK = "blank";
const WRITTEN = "written";

/* Each light layer only fades; by the time any of them is above zero every
   mask is already fully open. */
const settle = (delay: number) => ({
  variants: {
    [BLANK]: { opacity: 0 },
    [WRITTEN]: {
      opacity: 1,
      transition: { duration: GLOW_SECONDS, delay, ease: BLOOM },
    },
  },
});

export function PlitviceSignature({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const still = { initial: false as const };

  /* Every light layer is the same two shapes — the filled letters and the
     rule — fattened by a different amount, so it is worth saying once. */
  const lit = (tone: string, grow: number) => (
    <>
      {RUNS.map((run) => (
        <path
          key={run.at}
          d={run.art}
          fill={tone}
          stroke={tone}
          strokeWidth={grow}
        />
      ))}
      <path
        d={RULE}
        fill="none"
        stroke={tone}
        strokeWidth={RULE_WIDTH + grow}
        strokeLinecap="round"
      />
    </>
  );

  return (
    <div className={className}>
      <motion.svg
        viewBox="-40 -300 1420 450"
        className="h-auto w-full"
        role="img"
        aria-label={`${site.name} Club`}
        initial={reduced ? false : BLANK}
        whileInView={WRITTEN}
        viewport={VIEWPORT}
      >
        <defs>
          {RUNS.map((run, i) => (
            <mask
              key={run.at}
              id={`plitvice-write-${i}`}
              maskUnits="userSpaceOnUse"
              x="-160"
              y="-400"
              width="1660"
              height="640"
            >
              <motion.path
                d={run.path}
                fill="none"
                stroke="#fff"
                strokeWidth={NIB}
                strokeLinecap="round"
                strokeLinejoin="round"
                variants={{
                  [BLANK]: { pathLength: 0, opacity: 0 },
                  [WRITTEN]: {
                    pathLength: 1,
                    opacity: 1,
                    transition: {
                      pathLength: {
                        duration: run.dur,
                        delay: run.at,
                        ease: run.ease,
                      },
                      /* The nib is round, so a stroke of no length still
                         paints a disc of itself — and in a mask that disc is a
                         hole the artwork shows through. Switched on at the
                         instant the run starts moving. */
                      opacity: { duration: 0.001, delay: run.at },
                    },
                  },
                }}
              />
            </mask>
          ))}

          <filter
            id="plitvice-halo"
            x="-14%"
            y="-28%"
            width="128%"
            height="156%"
          >
            <feGaussianBlur stdDeviation="11" />
          </filter>
          <filter
            id="plitvice-ring"
            x="-8%"
            y="-16%"
            width="116%"
            height="132%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* THE HALO — wide, soft, amber. */}
        <motion.g
          filter="url(#plitvice-halo)"
          {...(reduced ? still : settle(SIGNATURE_SECONDS))}
        >
          {lit(HALO, 16)}
        </motion.g>

        {/* THE RING — the warm band close in against the ink. */}
        <motion.g
          filter="url(#plitvice-ring)"
          {...(reduced ? still : settle(SIGNATURE_SECONDS + 0.05))}
        >
          {lit(RING, 5)}
        </motion.g>

        {/* THE WRITING — calligraphy, uncovered only where the nib has been. */}
        {RUNS.map((run, i) => (
          <g key={run.at} mask={`url(#plitvice-write-${i})`}>
            <path d={run.art} fill={GOLD} />
          </g>
        ))}

        {/* THE RULE, drawn. */}
        <motion.path
          d={RULE}
          fill="none"
          stroke={GOLD}
          strokeWidth={RULE_WIDTH}
          strokeLinecap="round"
          variants={{
            [BLANK]: { pathLength: 0, opacity: 0 },
            [WRITTEN]: {
              pathLength: 1,
              opacity: 1,
              transition: {
                pathLength: { duration: RULE_DUR, delay: RULE_AT, ease: PULL },
                /* A stroke of no length still paints its round cap, so the
                   rule would sit there as a gold dot before the hand came
                   back to it. */
                opacity: { duration: 0.001, delay: RULE_AT },
              },
            },
          }}
        />

        {/* THE WASH — the ink itself lifting a shade as the warmth comes up. */}
        <motion.g
          fill={CORE}
          fillOpacity={0.34}
          {...(reduced ? still : settle(SIGNATURE_SECONDS + 0.12))}
        >
          {RUNS.map((run) => (
            <path key={run.at} d={run.art} />
          ))}
          <path
            d={RULE}
            fill="none"
            stroke={CORE}
            strokeOpacity={0.34}
            strokeWidth={RULE_WIDTH * 0.5}
            strokeLinecap="round"
          />
        </motion.g>
      </motion.svg>
    </div>
  );
}
