"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";

type ImageRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/* Editorial curtain reveal: the frame opens downward while the image settles
   from a slight over-scale. Single-use, like every reveal on the page. */
export function ImageReveal({ children, className, delay = 0 }: ImageRevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={`overflow-hidden ${className ?? ""}`}>{children}</div>;
  }

  return (
    <motion.div
      className={`overflow-hidden ${className ?? ""}`}
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 1.2, delay, ease: EASE }}
    >
      <motion.div
        initial={{ scale: 1.12 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 1.4, delay, ease: EASE }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
