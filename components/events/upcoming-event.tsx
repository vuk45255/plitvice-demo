"use client";

import { useCallback, useEffect, useRef } from "react";
import { PosterImage } from "@/components/events/poster-image";
import Link from "next/link";
import {
  cubicBezier,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Arrow } from "@/components/arrow";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { useCoarsePointer } from "@/lib/use-media";
import { reserveHref, ticketAvailability, type PartyEvent } from "@/lib/events";

/* The night ahead, arriving in the room.
 *
 * The poster is treated as a physical piece of campaign artwork hung in the
 * page rather than an image in a card, and three things are asked of it:
 *
 *   it lands       — scroll resolves it from slightly small, slightly low and
 *                    slightly dark up to its true size, so it settles into the
 *                    page instead of appearing in it;
 *   it lights      — the colour of the artwork itself bleeds into the dark
 *                    behind it, which is what makes the night feel present in
 *                    the room rather than printed on it;
 *   it has weight  — a cursor over it tips it a couple of degrees, and the
 *                    light behind and the shadow beneath move by different
 *                    amounts, which is the whole of the depth.
 *
 * The landing rides scroll progress through motion values. The tilt runs its
 * own animation frame loop and writes three transforms by hand — see `follow`
 * for why — and both of them leave React alone entirely: nothing in here
 * re-renders when the page scrolls or when the pointer moves. Under
 * `prefers-reduced-motion` none of it runs and the poster simply stands at
 * rest. */

/* Degrees at the far corner. Past about three the artwork stops reading as
   paper and starts reading as a card in a game. */
const TILT = 2.4;

/* How much of the distance left to the cursor is taken each frame. Low enough
   that the poster is always arriving rather than tracking, which is what makes
   it read as something with mass. */
const FOLLOW = 0.12;

/* How far the layers either side of the paper travel against it, in pixels at
   the far corner. The light behind swings widest, the paper turns, the shadow
   underneath lags the other way — that difference is the depth. */
const HALO_X = 22;
const HALO_Y = 16;
const CAST_X = 9;

export function UpcomingEvent({
  event,
  sizes,
}: {
  event: PartyEvent;
  sizes: string;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  /* THE POSTER IS NOT HANDED A GESTURE IT CANNOT USE. `track` below returns on
     its first line for anything that is not a mouse — but a finger dragging the
     page over the artwork still fires a pointermove for every frame of the
     scroll, and every one of them was being dispatched into React to be thrown
     away. Asked of the device once instead, the handlers are simply not there
     on a phone. */
  const coarse = useCoarsePointer();
  const still = reduced || coarse;
  const stage = useRef<HTMLDivElement>(null);
  const ease = cubicBezier(...EASE);

  const date = t(event.date);
  /* The call is the night's own to make: a night sold online asks for the
     ticket, a night that is not asks for the table. Neither this component nor
     any other one knows which night it is looking at. */
  const sold = ticketAvailability(event) === "open";
  const cta = t(sold ? "events.buy" : "common.reserveTable");
  const href = reserveHref(event.slug, sold ? "karte" : "stolovi");

  /* The landing. Tied to scroll rather than fired once, so it tracks the
     visitor's own speed down the page: begins as the poster's top edge clears
     the bottom of the screen, finished by the time that edge reaches the
     middle. */
  const { scrollYProgress } = useScroll({
    target: stage,
    offset: ["start end", "start center"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.945, 1], { ease });
  const lift = useTransform(scrollYProgress, [0, 1], [28, 0], { ease });
  const fade = useTransform(scrollYProgress, [0, 1], [0.45, 1], { ease });
  /* The light comes up later than the artwork does. */
  const glow = useTransform(scrollYProgress, [0.15, 1], [0, 1], { ease });

  /* The tilt has three elements of its own, each nested inside whatever the
     landing is animating, so the two never write the same property on the same
     node. */
  const paper = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const cast = useRef<HTMLDivElement>(null);
  /* Where the cursor is asking the poster to be, and where it actually is:
     -1 to 1 on both axes. Refs rather than state — a cursor crossing a poster
     is sixty of these a second and not one of them is React's business. */
  const want = useRef({ x: 0, y: 0 });
  const at = useRef({ x: 0, y: 0 });
  const frame = useRef(0);

  /* The follow, written straight to the DOM.
   *
   * This is deliberately its own loop rather than a spring: the springs in the
   * animation library only advance on a frame its scheduler is already
   * running, which the scroll-linked values above keep alive but a cursor
   * moving over an otherwise still page does not. A dozen lines of lerp are
   * cheaper than that dependency, and the loop stops itself the moment the
   * poster has arrived — a poster nobody is touching costs nothing at all. */
  const follow = useCallback(() => {
    if (frame.current) return;

    const step = () => {
      frame.current = 0;
      const now = at.current;
      const goal = want.current;
      now.x += (goal.x - now.x) * FOLLOW;
      now.y += (goal.y - now.y) * FOLLOW;

      const settled =
        Math.abs(goal.x - now.x) < 0.0005 && Math.abs(goal.y - now.y) < 0.0005;
      if (settled) {
        now.x = goal.x;
        now.y = goal.y;
      }

      if (paper.current) {
        paper.current.style.transform = `perspective(1100px) rotateX(${(
          -now.y * TILT
        ).toFixed(3)}deg) rotateY(${(now.x * TILT).toFixed(3)}deg)`;
      }
      if (halo.current) {
        halo.current.style.transform = `translate3d(${(-now.x * HALO_X).toFixed(
          2,
        )}px, ${(-now.y * HALO_Y).toFixed(2)}px, 0)`;
      }
      if (cast.current) {
        cast.current.style.transform = `translate3d(${(now.x * CAST_X).toFixed(
          2,
        )}px, 0, 0)`;
      }

      if (!settled) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
  }, []);

  const track = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      /* A finger is not a cursor: touch and pen leave the poster at rest. */
      if (e.pointerType !== "mouse") return;
      const box = e.currentTarget.getBoundingClientRect();
      want.current.x = ((e.clientX - box.left) / box.width) * 2 - 1;
      want.current.y = ((e.clientY - box.top) / box.height) * 2 - 1;
      follow();
    },
    [follow],
  );

  const release = useCallback(() => {
    want.current.x = 0;
    want.current.y = 0;
    follow();
  }, [follow]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return (
    <div>
      <div
        ref={stage}
        className="relative"
        onPointerMove={still ? undefined : track}
        onPointerLeave={still ? undefined : release}
      >
        {/* LAYER 3 — the light off the artwork, spilling into the dark. Sized
            well past the poster and falling away to nothing at the edge, so
            what reads is a contaminated darkness rather than a circle. Weaker
            on a phone, where the poster fills the screen and the same strength
            would tint the whole page. */}
        {event.ambient ? (
          <motion.div
            className="pointer-events-none absolute -inset-x-[22%] -inset-y-[24%] -z-10"
            style={{ opacity: reduced ? 0.75 : glow }}
            aria-hidden="true"
          >
            <div ref={halo} className="h-full w-full">
              <div
                className="h-full w-full opacity-45 md:opacity-85"
                style={{
                  background: `radial-gradient(closest-side at 50% 46%, ${tint(
                    event.ambient,
                    0.24,
                  )}, ${tint(event.ambient, 0.09)} 40%, ${tint(
                    event.ambient,
                    0.025,
                  )} 62%, transparent 80%)`,
                }}
              />
            </div>
          </motion.div>
        ) : null}

        {/* the weight on the floor under the paper */}
        <motion.div
          className="pointer-events-none absolute inset-x-[6%] bottom-[-4%] -z-[5] h-[18%]"
          style={{ opacity: reduced ? 0.7 : fade }}
          aria-hidden="true"
        >
          <div
            ref={cast}
            className="h-full w-full rounded-[50%] bg-black/60 blur-2xl"
          />
        </motion.div>

        <motion.div
          style={reduced ? undefined : { scale, y: lift, opacity: fade }}
        >
          {/* Promoted for the tilt, and the tilt is a mouse — so a phone,
              where nothing ever writes this node's transform, is not asked to
              hold a poster-sized texture for it. */}
          <div ref={paper} className={still ? undefined : "will-change-transform"}>
            <Link
              href={href}
              aria-label={`${event.artist} — ${date} — ${cta}`}
              className="group block"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[6px] shadow-[0_50px_110px_-50px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.07]">
                {/* At rest the print is held back to about three quarters of
                    itself — clearly the night on offer, but banked, the way a
                    poster reads in a room before the lights find it. The
                    cursor brings it all the way up: full colour, full
                    brightness, and a fraction of scale inside its own frame,
                    over the same long ease the rest of the house moves on.
                    The frame itself never changes size. */}
                <PosterImage
                  poster={event.poster}
                  alt=""
                  sizes={sizes}
                  fill
                  className="object-cover [filter:saturate(0.7)_contrast(1.08)_brightness(0.74)] transition-[filter,scale] duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.015] group-hover:[filter:saturate(1)_contrast(1)_brightness(1)]"
                />

                {/* The corners go down a shade further so the artwork sits in
                    the dark rather than on top of it, and it lifts with the
                    print when the cursor arrives. */}
                <div
                  className="pointer-events-none absolute inset-0 transition-opacity duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-50"
                  style={{
                    background:
                      "radial-gradient(120% 85% at 50% 38%, transparent 42%, rgba(8,5,13,0.42) 100%)",
                  }}
                  aria-hidden="true"
                />

                {/* LIGHT PASS — once, as it arrives. A lamp swinging across a
                    printed sheet, not a shine on a product photograph. */}
                {reduced ? null : (
                  <span
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    aria-hidden="true"
                  >
                    <motion.span
                      className="absolute inset-y-[-25%] block w-[38%] -skew-x-[14deg]"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.055), rgba(255,255,255,0.09), rgba(255,255,255,0.045), transparent)",
                      }}
                      initial={{ x: "-180%" }}
                      whileInView={{ x: "300%" }}
                      viewport={{ once: true, amount: 0.55 }}
                      transition={{
                        duration: 2.1,
                        delay: 0.55,
                        ease: "easeInOut",
                      }}
                    />
                  </span>
                )}
              </div>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* The billing, set under the artwork as a caption rather than a card:
          when and what, then the way in. It arrives with the poster and then
          holds still.

          The night's name now leads and the rule sits UNDER it, so the two read
          as a title and the line drawn beneath a title. Before, the rule was
          the top edge of the whole block and the billing hung off it in a
          justified row — the name on one side, the way in on the other, which
          is a footer rather than a caption. Everything is on one left edge now:
          the poster's, the name's and the call's. */}
      <motion.div
        style={reduced ? undefined : { opacity: fade, y: lift }}
        className="mt-9 md:mt-11"
      >
        {/* Thirteen on a phone rather than fourteen, and the reason is one
            line. At 0.28em a date and a night's name run about 327px at 13 and
            350px at 14, against a column of 342 on a 390 screen — so fourteen
            breaks the billing across two lines and puts the split inside the
            name itself. Thirteen holds it on one line from 390 up, and is still
            plainly bigger than the eleven it was set at. Below 360 it wraps
            whatever it is set to; it always did. */}
        <p className="text-[0.8125rem] uppercase leading-[1.65] tracking-[0.28em] text-gold-light/90 md:text-[1rem]">
          {date}
          <span className="mx-2.5 text-gold/35" aria-hidden="true">
            ·
          </span>
          {event.artist}
        </p>

        <div className="mt-5 border-t border-line pt-6 md:mt-6 md:pt-7">
          <Link
            href={href}
            className="group/cta inline-flex items-center gap-4 text-[0.6875rem] uppercase tracking-[0.28em] text-gold transition-colors duration-500 hover:text-gold-light"
          >
            {cta}
            <Arrow className="w-8 group-hover/cta:w-12" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

/* A night's ambient colour is written as a plain hex in lib/events, because
   that is the readable way to write a colour; the glow needs it at three
   different strengths. */
function tint(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
