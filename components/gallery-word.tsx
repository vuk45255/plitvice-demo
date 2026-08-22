"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { EASE } from "@/components/reveal";

/* GALERIJA, cut rather than printed.
 *
 * The word behind the gallery used to be the house's ordinary section word: a
 * solid fill at seven per cent white, held still on screen while the section
 * slid past it. At that size it stopped reading as atmosphere and started
 * reading as a mistake — a grey duplicate of a heading, or the drop shadow of
 * something that was not there. Filled type at three hundred pixels is never
 * quiet, however low the alpha goes; there is simply too much area.
 *
 * So the letters are not filled at all. They are a hairline of warm off-white
 * with nothing inside them, which is a completely different object: an outline
 * has almost no area, so it can be drawn at an alpha you can actually see
 * without ever massing into a shape that competes with a photograph. It reads
 * the way lettering cut into a wall reads — you find it rather than being shown
 * it. That is also why it is set far larger than the old word and allowed to
 * run off both edges of the section: at this size the eye reads the collage
 * first and the typography second, which is the right order.
 *
 * This is deliberately NOT a variant of components/section-word.tsx. That one
 * is shared by five other sections whose words are meant to sit still and stay
 * filled, and none of this belongs to them. */

/* Cut off both edges on purpose. Eight letters of Playfair at a fifth of the
   viewport is wider than the viewport, and the section's own overflow does the
   cropping — which is what makes it read as a fragment of something bigger
   rather than as a centred heading. */
const SIZE = "clamp(4.5rem, 21vw, 26rem)";

/* How far the word lags the page across its whole pass. Fifty-odd pixels: far
   enough that the collage and the lettering are plainly on different planes,
   nowhere near far enough to be caught moving. */
const LAG = 26;

export function GalleryWord({ word }: { word: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  /* Pushed DOWN as the page goes up, which is what being behind something
     looks like: it travels the pass slightly slower than everything in front
     of it. */
  const y = useTransform(scrollYProgress, [0, 1], [-LAG, LAG]);

  /* ONE PASS OF WARMER LIGHT ALONG THE CUT, and then never again. A band of
     gold is masked across a second copy of the same outline as the section
     arrives — the alpha under the band roughly doubles, from a tenth to a
     fifth, which is the difference between not seeing it and noticing it. It
     is a single shot on a single clock: nothing here loops, and nothing glows,
     because the light is in the stroke rather than around it. */
  const lit = useInView(ref, { once: true, margin: "-25% 0px" });
  const sweep = useMotionValue(0);

  useEffect(() => {
    if (!lit || reduced) return;
    const run = animate(sweep, 1, { duration: 2.2, delay: 0.35, ease: EASE });
    return () => run.stop();
  }, [lit, reduced, sweep]);

  const band = useTransform(sweep, (v) => `${170 - v * 250}% 0%`);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      <motion.div
        className="flex h-full items-center justify-center"
        style={{ y: reduced ? undefined : y }}
      >
        <div
          className="relative whitespace-nowrap font-serif uppercase leading-none"
          style={{ fontSize: SIZE, letterSpacing: "0.055em" }}
        >
          {/* the cut itself — thinner and fainter on a phone, where the labels
              on the photographs are small and share the same screen */}
          <span className="block text-transparent [-webkit-text-stroke:0.8px_rgba(205,190,170,0.07)] md:[-webkit-text-stroke:1px_rgba(205,190,170,0.12)]">
            {word}
          </span>

          {!reduced && (
            <motion.span
              className="absolute inset-0 block text-transparent [-webkit-text-stroke:1px_rgba(212,176,112,0.1)]"
              style={{
                maskImage:
                  "linear-gradient(100deg, transparent 40%, #000 50%, transparent 60%)",
                maskSize: "280% 100%",
                maskRepeat: "no-repeat",
                maskPosition: band,
                WebkitMaskImage:
                  "linear-gradient(100deg, transparent 40%, #000 50%, transparent 60%)",
                WebkitMaskSize: "280% 100%",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: band,
              }}
            >
              {word}
            </motion.span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
