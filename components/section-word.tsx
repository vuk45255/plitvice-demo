"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { COARSE_QUERY, useMediaQuery } from "@/lib/use-media";

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
   to pull the eye off what is in front of it.

   ─── AND THERE ARE TWO WAYS OF DRAWING THAT, FOR TWO WAYS OF SCROLLING ───

   The composition above is one mapping from scroll position to a translation,
   and both of the paths below produce it exactly. What differs is WHO does the
   interpolating, and that turns out to be the whole difference between a word
   that tracks a finger and one that appears to stop and catch up.

   On a DESK the page is scrolled by Lenis, which moves it from a frame
   callback on the main thread. Scroll position and transform are therefore
   decided in the same frame and painted in the same frame, and the JavaScript
   path below is exact. It is untouched.

   On a PHONE there is no Lenis (see components/providers/smooth-scroll.tsx)
   and the browser scrolls on the compositor, at the display's own rate,
   telling the main thread afterwards through `scroll` events that arrive late
   and unevenly. Anything drawn from those events is a frame or more behind the
   page it is supposed to be part of, and at this size — a word three hundred
   pixels tall — being a frame behind is not subtle. So the phone gets the same
   mapping expressed as a scroll-driven CSS animation, which the compositor
   advances with the same clock it scrolls with. See `section-word-drift` in
   app/globals.css. No JavaScript runs while it moves, and the JS path is not
   even mounted — its scroll subscription goes with it.

   THE SECTION AROUND THIS HAS TO CARRY `section-word-host`. That is where the
   scroll timeline is named, and it is not a matter of taste: every section
   here clips, a clipping element is a scroll container, and a timeline named
   on this component's own box would therefore be measured inside the section
   rather than inside the page — where it never moves at all. Measurements are
   in the comment beside the rule. */
export function SectionWord({
  word,
  speed = 1,
  pinned = false,
}: {
  word: string;
  speed?: number;
  /* THE ONE WORD THAT CANNOT TAKE THE COMPOSITOR'S PATH. Inside a pinned scene
     the browser's own answer to "where is this box on screen" is that it is
     stuck to the top and therefore never moves, while the composition wants
     the answer the JavaScript gives: where the box would be if the page were
     sliding past it normally. INĐIJA behind the concierge is the only one of
     these, and it says so here rather than being found out later. */
  pinned?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const travel = useTravel(track);
  const compositor = useCompositorDrift() && !pinned;

  const reach = (travel / 2) * speed;

  const glyph = (
    <span
      style={{ fontSize: fit(word) }}
      className="section-word whitespace-nowrap font-serif uppercase leading-none"
    >
      {word}
    </span>
  );

  return (
    <div
      ref={track}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      {reduced || compositor ? (
        <div
          className={`flex h-full items-center justify-center ${
            reduced ? "" : "section-word-drift"
          }`}
          style={
            reduced
              ? undefined
              : ({ "--sw-reach": `${reach}px` } as React.CSSProperties)
          }
        >
          {glyph}
        </div>
      ) : (
        <Drift track={track} reach={reach}>
          {glyph}
        </Drift>
      )}
    </div>
  );
}

/* The desk's path, exactly as it always was: the section's own scroll progress,
   read by Motion, interpolated in JavaScript and written to the element. */
function Drift({
  track,
  reach,
  children,
}: {
  track: RefObject<HTMLDivElement | null>;
  reach: number;
  children: React.ReactNode;
}) {
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-reach, reach]);

  return (
    <motion.div
      className="flex h-full items-center justify-center"
      style={{ y }}
    >
      {children}
    </motion.div>
  );
}

/* HOW FAR THE WORD TRAVELS, MEASURED ONCE AND THEN LEFT ALONE.
 *
 * The number is the same it has always been — the track's own height plus one
 * viewport — and it is still read from layout rather than assumed.
 *
 * WHAT CHANGED IS WHAT COUNTS AS A RESIZE ON A PHONE. Every phone browser
 * fires `resize` while the page is being scrolled, because showing and hiding
 * the address bar changes the height of the window. Re-measuring on that gave
 * the word a NEW travel distance mid-scroll, and a new travel distance is a
 * new position: the word jumped, in the middle of the gesture, every time the
 * browser's own chrome moved. So on a phone only a change of WIDTH — a
 * rotation, a foldable, a split screen — counts. The address bar cannot move
 * the word any more.
 *
 * A desk has no address bar to collapse and answers every resize as before.
 * The observer on the track itself is untouched either way: if the section
 * genuinely changes height, the travel changes with it. */
function useTravel(track: RefObject<HTMLDivElement | null>) {
  const [travel, setTravel] = useState(0);

  useEffect(() => {
    const node = track.current;
    if (!node) return;

    /* Read once per frame at most: a resize arrives in bursts, and each read
       is a forced layout. */
    let queued = 0;
    const read = () => {
      queued = 0;
      const next = node.offsetHeight + window.innerHeight;
      setTravel((current) => (current === next ? current : next));
    };
    const schedule = () => {
      if (!queued) queued = requestAnimationFrame(read);
    };

    const stable = window.matchMedia(COARSE_QUERY).matches;
    let width = window.innerWidth;
    const onResize = () => {
      if (stable && window.innerWidth === width) return;
      width = window.innerWidth;
      schedule();
    };

    read();
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (queued) cancelAnimationFrame(queued);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [track]);

  return travel;
}

/* Whether this device should be handed the compositor's version.
 *
 * Two conditions and both have to hold: a finger rather than a cursor, which
 * is the same question the rest of the site asks — see lib/use-media.ts — and
 * a browser that actually has scroll-driven animations. Where either fails the
 * JavaScript path runs, which is what every browser had until now.
 *
 * The media query answers FALSE before hydration, unlike everywhere else on
 * this site, and deliberately: the server and the first client render should
 * agree on the path that works everywhere, and the swap should happen once,
 * afterwards. On this site that is several seconds before any section word can
 * be reached — the hero holds the page still until its mark has revealed. */
function useCompositorDrift() {
  const coarse = useMediaQuery(COARSE_QUERY);
  return coarse && supportsViewTimeline();
}

let viewTimelines: boolean | undefined;

function supportsViewTimeline() {
  viewTimelines ??= CSS.supports("animation-timeline", "view()");
  return viewTimelines;
}

/* Size falls out of the letter count — roughly 0.62em of advance per glyph —
   so a long word stays inside the frame and never reads as a headline. */
function fit(word: string) {
  const vw = Math.min(120 / word.length, 22);
  return `clamp(2.5rem, ${vw.toFixed(1)}vw, 13rem)`;
}
