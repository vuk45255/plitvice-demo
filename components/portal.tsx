"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PosterImage } from "@/components/events/poster-image";
import type { Poster } from "@/lib/club/poster-assets";
import Link from "next/link";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { EASE } from "@/components/reveal";

/* A window into one part of the club.
 *
 * There is no card here — no panel, no border at rest, no shadow, and no words.
 * The photography is the whole object, and the dark room of the section is what
 * surrounds it. All three windows are cut to the same size and the same crop;
 * the composition comes entirely from where each one hangs.
 *
 * Inside the frame the picture changes on the window's own clock, so no two
 * windows on the page are ever turning together. Everything stops while the
 * window is off screen or under the cursor, and everything is transform,
 * opacity and filter, so it stays on the compositor.
 *
 * THE NAME TRAVELS. It begins at the top of the frame as the window comes up
 * from the bottom of the screen and is carried down the left edge by the scroll
 * itself, settling at the foot of the picture about the time the window reaches
 * the middle of the room — so the word reads as something falling through the
 * frame with the page rather than a caption pinned under a photograph. It is
 * one continuous mapping from scroll position: there is no state in it and
 * nothing about it can snap.
 *
 * A cursor over the window pushes the picture a few pixels the other way, and
 * pressing it takes the whole window in a fraction. Both run on one small frame
 * loop writing two transforms — a spring would only advance on a frame the
 * animation library's own scheduler happened to be running, which a cursor
 * crossing an otherwise still page is not. */

/* One shape for all three — portrait, editorial, and identical everywhere. */
export const PORTAL_RATIO = "aspect-[3/4]";
export const PORTAL_WIDTH =
  "w-[72%] sm:w-[62%] md:w-[clamp(280px,20vw,380px)]";

type PortalProps = {
  href: string;
  /* The category name, set on the frame itself. It is also what names the link,
     so there is no second copy of it for screen readers to read out. */
  label: string;
  /* Rendered with the window's own play state: false while it is off screen or
     held under the cursor. */
  media: (state: { playing: boolean }) => React.ReactNode;
  /* Where the window hangs. */
  className?: string;
  /* Reveal order as the section is scrolled into. */
  delay?: number;
  /* Pixels of parallax travel across the section. Kept small on purpose. */
  drift?: number;
};

/* How far the cursor pushes the picture, in pixels at the far edge. Small
   enough to read as the window having a little depth in it, never as a card
   being turned over. */
const SHIFT = 5;

/* How far the whole window goes in under a press. */
const PRESS = 0.985;

/* How much of the distance left is taken each frame. The picture follows the
   cursor at a weight; a press is meant to be felt at once, so it is quick. */
const FOLLOW = 0.14;
const SNAP = 0.3;

/* Where in the window's own pass across the screen the name starts and stops
   travelling. It is already moving as the frame clears the bottom edge and has
   settled by about the time the frame reaches the middle of the room — well
   before it leaves, so the arrival is something a visitor actually sees. */
const CARRY: [number, number] = [0.08, 0.7];

export function Portal({
  href,
  label,
  media,
  className,
  delay = 0,
  drift = 0,
}: PortalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [held, setHeld] = useState(false);

  /* A window nobody is looking at should cost nothing. */
  const inView = useInView(ref, { margin: "200px" });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [drift, -drift]);

  /* How far the name has fallen, 0 to 1, over the stretch of the pass named
     above. Held inside the two ends, so it is pinned at the top before the
     window arrives and stays put at the bottom once it has. */
  const fallen = (p: number) => {
    const t = (p - CARRY[0]) / (CARRY[1] - CARRY[0]);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };

  /* The fall itself, in two halves and not a pixel measured anywhere.
   *
   * The name sits at the top of a box the size of the frame. Take that box down
   * by a share of ITS OWN height and the name goes with it, all the way past
   * the bottom edge; take the name back up by the same share of the NAME's own
   * height and what is left is exactly the share of the room between them. So
   * the two ends are the top of the frame and the foot of it, at every width,
   * at both insets, with nothing to measure and nothing to go stale on a
   * reflow — a percentage transform already knows the size of the thing it is
   * moving. */
  const down = useTransform(scrollYProgress, (p) => `${fallen(p) * 100}%`);
  const back = useTransform(scrollYProgress, (p) => `${fallen(p) * -100}%`);

  /* The cursor and the press, written straight to their own two nodes. */
  const picture = useRef<HTMLDivElement>(null);
  const press = useRef<HTMLDivElement>(null);
  const want = useRef({ x: 0, y: 0, press: 1 });
  const at = useRef({ x: 0, y: 0, press: 1 });
  const loop = useRef(0);

  const follow = useCallback(() => {
    if (loop.current) return;

    const step = () => {
      loop.current = 0;
      const now = at.current;
      const goal = want.current;
      now.x += (goal.x - now.x) * FOLLOW;
      now.y += (goal.y - now.y) * FOLLOW;
      now.press += (goal.press - now.press) * SNAP;

      const settled =
        Math.abs(goal.x - now.x) < 0.01 &&
        Math.abs(goal.y - now.y) < 0.01 &&
        Math.abs(goal.press - now.press) < 0.0002;
      if (settled) {
        now.x = goal.x;
        now.y = goal.y;
        now.press = goal.press;
      }

      if (picture.current) {
        picture.current.style.transform =
          "translate3d(" + now.x.toFixed(2) + "px, " + now.y.toFixed(2) + "px, 0)";
      }
      if (press.current) {
        press.current.style.transform = "scale(" + now.press.toFixed(4) + ")";
      }

      if (!settled) loop.current = requestAnimationFrame(step);
    };

    loop.current = requestAnimationFrame(step);
  }, []);

  const track = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      /* A finger is not a cursor: touch and pen never push the picture. */
      if (e.pointerType !== "mouse") return;
      const box = e.currentTarget.getBoundingClientRect();
      want.current.x = (((e.clientX - box.left) / box.width) * 2 - 1) * SHIFT;
      want.current.y = (((e.clientY - box.top) / box.height) * 2 - 1) * SHIFT;
      follow();
    },
    [follow],
  );

  const settle = useCallback(() => {
    want.current.x = 0;
    want.current.y = 0;
    want.current.press = 1;
    follow();
  }, [follow]);

  const release = useCallback(() => {
    want.current.press = 1;
    follow();
  }, [follow]);

  const push = useCallback(() => {
    want.current.press = PRESS;
    follow();
  }, [follow]);

  useEffect(
    () => () => {
      if (loop.current) cancelAnimationFrame(loop.current);
    },
    [],
  );

  /* Nothing to hand the link at all where less movement was asked for. */
  const pointer = reduced
    ? undefined
    : {
        onPointerMove: track,
        onPointerDown: push,
        onPointerUp: release,
        onPointerCancel: settle,
      };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y: reduced || !drift ? undefined : y }}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: reduced ? 0 : 1, delay, ease: EASE }}
      >
        <Link
          href={href}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => {
            setHeld(false);
            settle();
          }}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          {...pointer}
          className="group block cursor-pointer"
        >
          {/* The whole window goes in under a press — the frame and the name
              together, because pressing the picture alone inside its own clip
              would open a hairline of room at the edges. */}
          <div ref={press} className="will-change-transform">
            <div
              className={`relative overflow-hidden ${PORTAL_RATIO} ring-1 ring-gold/0 transition-[box-shadow] duration-700 group-hover:ring-gold/40 group-focus-visible:ring-gold/40`}
            >
              {/* only the picture moves — the name is hung on the frame, not on
                  the photograph, so it never drifts or softens */}
              <div ref={picture} className="absolute inset-0 will-change-transform">
                <div className="absolute inset-0 transition-[scale,filter] duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02] group-hover:brightness-[1.06] group-hover:contrast-[1.03] group-hover:saturate-[1.08]">
                  {media({ playing: inView && !held })}
                </div>
              </div>

              {/* the room falling across the bottom edge, so the name always has
                  something to sit on whatever the picture underneath it is */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
                style={{
                  background:
                    "linear-gradient(to top, rgba(8,5,13,0.80), rgba(8,5,13,0.30) 45%, transparent)",
                }}
                aria-hidden="true"
              />

              {/* One treatment for all three windows — the component draws it, so
                  the three names can never drift apart. The box is the frame; a
                  visitor who has asked for less movement simply gets both halves
                  of the fall already at their end. */}
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ y: reduced ? "100%" : down }}
              >
                <motion.span
                  style={{
                    y: reduced ? "-100%" : back,
                    /* One shadow, and it is only there so the caps hold against
                       a bright frame. It used to be three — a warm highlight off
                       the top of the letters and a twelve-pixel spread under
                       them — and stacked at that strength they stopped reading
                       as contrast and started reading as an effect: the type
                       looked embossed, and there was a visible halo around every
                       letter. A single tight shadow does the whole job, and the
                       letterforms stay sharp. */
                    textShadow: "0 1px 4px rgba(6,3,11,0.4)",
                  }}
                  className="absolute left-0 top-0 isolate flex items-center gap-3 p-5 text-[0.6875rem] font-medium uppercase leading-none tracking-[0.42em] text-[#f7f0dd] transition-[translate,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:translate-x-[6px] group-hover:text-gold-light md:p-6"
                >
                  {/* The picture darkening a little exactly where the name is,
                      and nowhere else. It travels with the name rather than
                      sitting on the frame, so the same treatment carries all
                      three windows whatever is under them at the time — a bright
                      blue poster included. An ellipse with no edge anywhere in
                      it: there is nothing here to notice as an element.

                      It was carrying two thirds of an opacity over a box that
                      reached ten units above and below the caps, which is what
                      put a visible dark cloud behind three small words. Pulled
                      back to a quarter and drawn tighter around the type: still
                      enough to keep the caps legible on the brightest frame,
                      no longer something a visitor can see. */}
                  <span
                    className="pointer-events-none absolute -inset-y-6 -left-5 -right-14 -z-10"
                    style={{
                      background:
                        "radial-gradient(58% 42% at 38% 50%, rgba(9,5,16,0.26) 0%, rgba(9,5,16,0.16) 45%, rgba(9,5,16,0.05) 72%, rgba(9,5,16,0) 100%)",
                    }}
                    aria-hidden="true"
                  />
                  {label}
                  {/* the rule the rest of the house draws beside a small line of
                      caps — here only when a visitor reaches for the window */}
                  <span
                    className="h-px w-0 bg-current transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-6"
                    aria-hidden="true"
                  />
                </motion.span>
              </motion.div>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* Stills, cross-fading on the window's own clock. Pictures are mounted as they
   are needed — the one showing, the one after it, and everything already seen —
   so a ten-poster window costs two images on arrival rather than ten. */
export function PortalStills({
  images,
  sizes,
  playing,
  interval,
}: {
  /* Either bundled artwork or an uploaded URL — see components/events/poster-image.tsx. */
  images: Poster[];
  sizes: string;
  playing: boolean;
  interval: number;
}) {
  const reduced = useReducedMotion();
  const { index, reach } = useTurning(images.length, interval, playing);

  return (
    <>
      {images.map((image, i) =>
        i <= reach ? (
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={false}
            animate={{
              opacity: i === index ? 1 : 0,
              scale: reduced || i === index ? 1 : 1.045,
            }}
            transition={{
              opacity: { duration: reduced ? 0.4 : 1.6, ease: EASE },
              scale: { duration: reduced ? 0 : 2.4, ease: EASE },
            }}
          >
            <PosterImage
              poster={image}
              alt=""
              sizes={sizes}
              fill
              className="img-grade object-cover"
            />
          </motion.div>
        ) : null,
      )}
    </>
  );
}

/* Clips, each one played to its end before the next fades up under it. Both are
   mounted so the incoming frame is already decoded when the fade starts; only
   the one showing is ever running. */
export function PortalClips({
  sources,
  playing,
}: {
  sources: string[];
  playing: boolean;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const clips = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    clips.current.forEach((clip, i) => {
      if (!clip) return;
      if (i === index && playing && !reduced) void clip.play().catch(() => {});
      else clip.pause();
    });
  }, [index, playing, reduced]);

  return (
    <>
      {sources.map((src, i) => (
        <motion.video
          key={src}
          ref={(node) => {
            clips.current[i] = node;
          }}
          src={src}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          /* Rewind as it finishes, so its turn always starts from the top. */
          onEnded={(e) => {
            e.currentTarget.currentTime = 0;
            setIndex((current) => (current + 1) % sources.length);
          }}
          className="absolute inset-0 h-full w-full object-cover"
          initial={false}
          animate={{ opacity: i === index ? 1 : 0 }}
          transition={{ duration: reduced ? 0.4 : 1.4, ease: EASE }}
        />
      ))}
    </>
  );
}

/* The clock behind the stills. `reach` is how far the window has ever got,
   carried alongside the index so the frame knows which pictures are worth
   having in the document. It only ever grows. */
function useTurning(count: number, interval: number, playing: boolean) {
  const [state, setState] = useState({ index: 0, reach: 1 });

  useEffect(() => {
    if (count < 2 || !playing) return;
    const id = window.setInterval(() => {
      setState(({ index, reach }) => {
        const next = (index + 1) % count;
        return { index: next, reach: Math.max(reach, next + 1) };
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [count, interval, playing]);

  return state;
}
