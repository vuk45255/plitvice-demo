"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useCoarsePointer } from "@/lib/use-media";

/* A card with a little depth: it leans a few degrees toward the cursor and
   lifts as you reach for it. The angles are deliberately small — enough for
   the wall to stop reading as flat, never enough to look like a 3D gimmick.
   The parent supplies the perspective. */
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  /* A CARD ONLY LEANS TOWARD A CURSOR. On a touch screen there is nothing for
     it to lean toward, and `pointermove` still fires — through every scroll
     and every tap — so the card was reading its own box and running two
     springs for a gesture that was never aimed at it. */
  const coarse = useCoarsePointer();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 150, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [4.5, -4.5]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-4.5, 4.5]), spring);

  if (reduced || coarse) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      whileHover={{ y: -6, scale: 1.012 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onPointerMove={(e) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        px.set((e.clientX - box.left) / box.width - 0.5);
        py.set((e.clientY - box.top) / box.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
