"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";

/* A single pass of light across a heading, the first time it is seen.

   The heading is rendered twice: once normally, and once on top clipped to the
   glyphs with a narrow champagne gradient that travels across. Only the copy
   moves, so the real text keeps its own colour and stays the thing screen
   readers and selection see. Runs once — a spotlight sweeping past, not a
   shimmer that keeps going. */
export function LightSweep({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <span className={className}>{children}</span>;

  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      {children}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-clip-text text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(100deg, transparent 38%, rgba(232,216,168,0.9) 50%, transparent 62%)",
          backgroundSize: "220% 100%",
          backgroundRepeat: "no-repeat",
        }}
        initial={{ backgroundPosition: "160% 0%" }}
        whileInView={{ backgroundPosition: "-60% 0%" }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 1.9, delay: 0.35, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}
