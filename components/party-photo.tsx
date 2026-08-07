"use client";

import Image, { type StaticImageData } from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";

type PartyPhotoProps = {
  src: StaticImageData;
  alt: string;
  href: string;
  cta: string;
};

/* One frame on the party wall. Every card is the same size — the collage comes
   from where each one sits, not from how big it is. Hover lifts the photograph
   very slightly, drops the room over it and brings up the invitation. */
export function PartyPhoto({ src, alt, href, cta }: PartyPhotoProps) {
  const reduced = useReducedMotion();
  const transition = { duration: reduced ? 0 : 0.3, ease: EASE };

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      className="group relative block overflow-hidden"
    >
      <motion.div
        variants={{ rest: { scale: 1 }, hover: { scale: reduced ? 1 : 1.04 } }}
        transition={transition}
      >
        <Image
          src={src}
          alt={alt}
          placeholder="blur"
          sizes="(min-width: 768px) 22vw, 45vw"
          className="img-grade aspect-[4/5] h-full w-full object-cover"
        />
      </motion.div>

      <motion.div
        className="absolute inset-0 bg-night"
        variants={{ rest: { opacity: 0 }, hover: { opacity: 0.5 } }}
        transition={transition}
        aria-hidden="true"
      />

      <motion.div
        className="absolute inset-0 flex items-center justify-center px-4 text-center"
        variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
        transition={transition}
      >
        <span className="text-[0.625rem] uppercase leading-relaxed tracking-[0.32em] text-gold-light indent-[0.32em]">
          {cta}
        </span>
      </motion.div>
    </motion.a>
  );
}
