"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/* The word standing in the atmosphere of a single section.

   Its movement is tied to its own section's scroll progress and runs the whole
   length of it, without stopping:

     0%   the word is still above the section's top edge, clipped away
     50%  the word is at the middle of the section, fully in view
     100% the word has passed below the section's bottom edge, clipped away

   The travel is the section's height plus one viewport, which is exactly the
   distance the section itself covers on screen — so the word holds its place in
   front of the visitor while sliding through the entire section, and goes
   behind the next one like something passing behind a wall. Nothing fades and
   nothing scales; the section's `overflow: hidden` does all the hiding.

   `speed` is how much of that travel the word takes. At 1 — the default, and
   what every section had before there was a choice — the two cancel exactly
   and the word holds still on screen while the section slides past it. Below 1
   it drifts: at 0.72 the word climbs the screen at a bit over a quarter of the
   page's rate, which is far enough back to read as depth and slow enough never
   to pull the eye off what is in front of it. */
export function SectionWord({
  word,
  speed = 1,
}: {
  word: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [travel, setTravel] = useState(0);

  /* ONE MEASUREMENT PER FRAME AT MOST, AND NONE ON A PHONE THAT IS MERELY
     SCROLLING.

     `resize` is not the rare event it is on a desktop. Every phone browser
     fires it while the page is being scrolled, because collapsing and
     expanding the address bar changes the height of the window — so this
     handler, which reads `offsetHeight` (a forced layout) and then sets state
     (a render of the word), was running mid-scroll, on five of these at once
     on the home page. The observer fires in bursts of its own for the same
     reason.

     So the reads are coalesced onto an animation frame: however many events
     arrive, the layout is read once, and React is only entered if the number
     actually moved. The word is drawn from the same measurement it always
     was — this only decides when it is taken. */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let queued = 0;
    const read = () => {
      queued = 0;
      const next = node.offsetHeight + window.innerHeight;
      setTravel((current) => (current === next ? current : next));
    };
    const measure = () => {
      if (queued) return;
      queued = requestAnimationFrame(read);
    };

    read();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      if (queued) cancelAnimationFrame(queued);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const reach = (travel / 2) * speed;
  const y = useTransform(scrollYProgress, [0, 1], [-reach, reach]);

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
        <span
          style={{ fontSize: fit(word) }}
          className="section-word whitespace-nowrap font-serif uppercase leading-none"
        >
          {word}
        </span>
      </motion.div>
    </div>
  );
}

/* Size falls out of the letter count — roughly 0.62em of advance per glyph —
   so a long word stays inside the frame and never reads as a headline. */
function fit(word: string) {
  const vw = Math.min(120 / word.length, 22);
  return `clamp(2.5rem, ${vw.toFixed(1)}vw, 13rem)`;
}
