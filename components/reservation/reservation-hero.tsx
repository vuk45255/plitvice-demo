"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import heroImg from "@/public/rezervacija/Rezervacija.jpg";

/* The room the reservation is taken in, this time as a photograph.
 *
 * The picture is the ground of the top of the page, not a banner sitting on it:
 * it runs the full width, edge to edge, and it is put under enough dark that
 * the house purple-black is still what the page reads as. Three layers do that
 * — one flat wash, one pool of violet from above, and a vertical fall that is
 * heaviest exactly where the headline sits and ends on the page's own
 * background colour, so there is no line anywhere to show where the photograph
 * stops.
 *
 * The image drifts a few per cent against the scroll, held inside a frame that
 * is over-scaled by more than it can ever travel, so no edge is exposed and
 * nothing but a transform is animated. The page's grain falls over all of it,
 * the way it falls over everything else. */

export function ReservationHero({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);

  return (
    <div ref={ref} className="relative isolate overflow-hidden pb-28 md:pb-40">
      <motion.div
        className="absolute inset-0 -z-10 scale-[1.08]"
        style={{ y: reduced ? undefined : y }}
        aria-hidden="true"
      >
        <Image
          src={heroImg}
          alt=""
          placeholder="blur"
          sizes="100vw"
          fill
          priority
          className="img-grade object-cover object-center"
        />
      </motion.div>

      {/* the room put back over the photograph */}
      <div className="absolute inset-0 -z-10 bg-night/45" aria-hidden="true" />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(110% 80% at 50% 0%, rgba(42,18,63,0.62), transparent 72%)",
        }}
        aria-hidden="true"
      />
      {/* heaviest behind the headline, and finishing on the page's own colour
          so the photograph has no bottom edge */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,5,13,0.78) 0%, rgba(8,5,13,0.44) 26%, rgba(8,5,13,0.58) 58%, rgba(8,5,13,0.93) 86%, #08050d 100%)",
        }}
        aria-hidden="true"
      />

      {children}
    </div>
  );
}
