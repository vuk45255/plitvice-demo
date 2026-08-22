"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";

/* One curtain, and the whole story is read through it.

   A line of type sits in a mask no taller than itself and rises out of the
   bottom of it — clip and transform, on the site's single easing curve. The
   mask carries a little padding so descenders and the overhang of an italic
   are never shaved off, and gives it straight back as a negative margin, so
   the line still sets on the baseline it was written for.

   Single-use, like every reveal on the site: nothing re-animates on the way
   back up the page. */
export function StoryLine({
  children,
  className,
  delay = 0,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "span" | "div";
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <Tag className={`block ${className ?? ""}`}>{children}</Tag>;
  }

  return (
    <Tag
      className={`-mb-[0.18em] block overflow-hidden pb-[0.18em] pr-[0.08em] ${className ?? ""}`}
    >
      <motion.span
        className="block"
        initial={{ y: "130%", opacity: 0 }}
        whileInView={{ y: "0%", opacity: 1 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: 1.2, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </Tag>
  );
}
