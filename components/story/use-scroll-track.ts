"use client";

import type { RefObject } from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  type MotionValue,
} from "framer-motion";

/* How far through a section the page has been read, as an ordinary value.
 *
 * `useScroll` hands its progress to the browser as a native ViewTimeline
 * whenever the offset matches one of Motion's presets, and anything `opacity`
 * is derived from it then runs on the compositor as a real scroll-linked
 * animation. That is only correct for a track covering the whole section. A
 * choreographed sequence is made of the opposite: runs of keyframes that start
 * late, or finish early, or both — and outside its own range such an animation
 * contributes nothing, so the element snaps back to the style underneath it
 * the moment the section scrolls past that range.
 *
 * Mirroring the progress into a plain motion value keeps every track on
 * Motion's own frameloop, where a value simply holds its last keyframe. The
 * scroll itself is measured exactly as before — this only decides who does the
 * interpolating. */
type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

/* The section is read from the moment its top edge reaches the top of the
   screen until its bottom edge reaches the bottom — the span a pinned section
   is pinned for. */
const THROUGH_SECTION: ScrollOffset = ["start start", "end end"];

export function useScrollTrack(
  target: RefObject<HTMLElement | null>,
  offset: ScrollOffset = THROUGH_SECTION,
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target, offset });
  const progress = useMotionValue(0);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    progress.set(value);
  });

  return progress;
}
