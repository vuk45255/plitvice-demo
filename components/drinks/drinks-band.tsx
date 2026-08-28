"use client";

import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/arrow";
import { Reveal } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { drinkMarks } from "@/lib/drinks";

/* THE BACK BAR — a thin cinematic band between the concierge and the address.
 *
 * Not a section so much as an interlude, and built the way the signature band
 * further up the page is built: edge to edge, deliberately low, one line of
 * type standing still in the middle of something that moves. Here what moves
 * is the bar itself — the names on the bottles, drifting past in the dark at a
 * pace nobody is meant to consciously notice.
 *
 * IT IS MADE OF THREE THINGS AND NO MORE:
 *
 *   the wall    one flex row carrying the same run of marks twice and sliding
 *               exactly half its own width, so the frame it ends on is the
 *               frame it began on. That is `.marquee-track` in globals.css —
 *               the same loop the poster ticker runs on: a single CSS
 *               transform, no JavaScript, no timers, and already silent under
 *               prefers-reduced-motion.
 *   the pool    a radial of the house purple-black laid over the wall and
 *               under the type, so the marks dissolve into darkness as they
 *               come toward the middle. Nothing is positioned around the
 *               headline; the headline stands in a hole in the light.
 *   the lamp    one soft gold gradient crossing the room every three quarters
 *               of a minute. No blur filter on it — the gradient is already
 *               soft — so it costs a transform and nothing else. Wide screens
 *               only.
 *
 * THE WHOLE BAND IS ONE LINK, which is why the type is a heading and a span
 * rather than a heading and a second link: a door this size should be
 * openable anywhere on it, and there is nothing nested inside it to trip over.
 * The wall is `aria-hidden`, so what is announced is the line and the
 * invitation under it — the marks are what they look like, atmosphere. */

/* Where the light gives out at the two ends. Eased rather than cut, so a mark
   thins into nothing instead of being sliced off by an edge. */
const EDGE_MASK =
  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.28) 7%, #000 20%, #000 80%, rgba(0,0,0,0.28) 93%, transparent 100%)";

/* And where it gives out top and bottom. This one is not decoration: the band
   itself fades out over its last quarter (see NIGHT), so without it the tall
   marks would still be drawing at full strength over a floor that has already
   turned transparent, and would read as pasted onto whatever section follows.
   It is a second element rather than a second layer on the same one because
   `mask-composite` is the kind of thing that works in three browsers and not
   the fourth; two nested masks intersect by construction. */
const FLOOR_MASK =
  "linear-gradient(to bottom, transparent 0%, #000 12%, #000 66%, transparent 94%)";

/* The pool of dark the headline stands in — the house purple-black over the
   house purple-black, so it is invisible in itself and the only thing it does
   is swallow whatever passes under it.
 *
 * `--pool` is its half-width as a share of the band: narrow on a wide screen,
 * where there is room for names either side of the type, and wide on a phone,
 * where there is not. The height is deliberately short of the band's own —
 * the names run down the middle, so there is nothing to hide at the top and
 * bottom edges, and leaving them clear is what lets the band fade out of the
 * page underneath. */
const POOL =
  "radial-gradient(var(--pool) 30% at 50% 50%, rgba(8,5,13,1) 0%, rgba(8,5,13,0.97) 44%, rgba(8,5,13,0.6) 70%, rgba(8,5,13,0) 88%)";

/* THE BAND'S OWN NIGHT, and the way it ends.
 *
 * Solid at the top, where it meets the concierge's purple-black exactly, and
 * gone by the bottom — not faded to another colour, but out of the way, so
 * what shows through the last third is the page itself: in the dark that is
 * the room's own ambient light coming back up under the address, and in the
 * day it is the ivory the address is set on. One seam instead of a step, and
 * it is the right seam in both themes without either being named. */
const NIGHT =
  "linear-gradient(to bottom, var(--night) 0%, var(--night) 76%, rgba(8,5,13,0) 100%)";

/* The lamp itself. An ellipse rather than a band across the box: a linear
   gradient has no top and bottom to fade, and at this strength the two hard
   edges it leaves are the only thing in the whole band anyone would notice. */
const SWEEP =
  "radial-gradient(closest-side, rgba(200,164,93,0.13), transparent 76%)";

export function DrinksBand() {
  const { t } = useLang();

  return (
    <section
      id="pice"
      aria-labelledby="drinks-title"
      /* `--band` is the one number the whole composition is built on: every
         mark's height, its offset from the centre line and the air after it
         are shares of it, so the three breakpoints here are the only place
         the band's size is ever stated. */
      className="relative isolate h-[var(--band)] w-full scroll-mt-20 overflow-hidden text-night-ink [--band:250px] sm:[--band:290px] md:[--band:320px]"
      style={{ background: NIGHT }}
    >
      {/* The outline the browser draws on a keyboard focus is pulled inside
          the band — at the default offset it would be a rectangle four pixels
          beyond every edge, which on a full-bleed element is four pixels the
          section's own `overflow: hidden` throws away. */}
      <Link
        href="/cenovnik"
        className="group relative block h-full w-full [outline-offset:-10px]"
      >
        <BackBar />

        {/* the lamp, and then the dark the type stands in */}
        <div
          className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
          aria-hidden="true"
        >
          <div
            className="drink-sweep absolute left-0 top-[4%] h-[64%] w-[42%]"
            style={{ background: SWEEP }}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 [--pool:58%] md:[--pool:27%]"
          style={{ background: POOL }}
          aria-hidden="true"
        />

        {/* The type takes no pointer events of its own: the band is the door,
            and letting the middle of it swallow the cursor would only stop the
            names behind from lighting up as they pass. */}
        <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <Reveal y={16}>
            <h2
              id="drinks-title"
              className="font-serif text-[clamp(1.75rem,5vw,3.5rem)] italic leading-[1.05] [text-shadow:0_0_60px_rgba(8,5,13,0.9)]"
            >
              {t("drinks.title")}
            </h2>
          </Reveal>

          {/* The invitation, in the voice every quiet door on this site uses:
              the rule grows, the word steps toward it, the gold warms. It
              answers to the band rather than to itself, because the band is
              what the visitor is actually pointing at. */}
          <Reveal y={16} delay={0.12}>
            <span className="mt-7 inline-flex items-center gap-4 text-[0.625rem] uppercase tracking-[0.42em] text-gold/70 transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-gold-light group-focus-visible:text-gold-light sm:mt-8 sm:text-[0.6875rem]">
              <span className="inline-block indent-[0.42em] transition-[transform,text-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[3px] group-hover:[text-shadow:0_0_22px_rgba(200,164,93,0.45)] group-focus-visible:translate-x-[3px] group-focus-visible:[text-shadow:0_0_22px_rgba(200,164,93,0.45)]">
                {t("drinks.cta")}
              </span>
              <Arrow className="w-7 group-hover:w-12 group-focus-visible:w-12" />
            </span>
          </Reveal>
        </div>
      </Link>
    </section>
  );
}

/* The marks themselves.
 *
 * WHY THERE ARE TWO RUNS AND NOT FIVE MARKS. The loop is `.marquee-track`:
 * a flex row of `width: max-content` sliding from 0 to -50% of itself. Two
 * identical runs make -50% land exactly on the second run's first pixel, so
 * the last frame of the animation is pixel-for-pixel the first frame and the
 * repeat has nothing to show. Every mark carries its air as trailing padding
 * rather than the row carrying gaps, so the space before Jack Daniel's comes
 * back around is the same space that follows Grey Goose — that seam is the
 * one place a marquee normally gives itself away.
 *
 * There is no state, no timer and no measuring pass here. Two masks and one
 * `transform` on one element, which is a job for the compositor and stays one
 * whether the band is 250px or 320px tall. */
function BackBar() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
      aria-hidden="true"
    >
      <div
        className="h-full w-full"
        style={{ maskImage: FLOOR_MASK, WebkitMaskImage: FLOOR_MASK }}
      >
        <div className="marquee-track h-full items-center [--marquee-duration:38s]">
          <Run />
          <Run />
        </div>
      </div>
    </div>
  );
}

function Run() {
  return (
    <span className="flex h-full shrink-0 items-center">
      {drinkMarks.map((mark) => (
        <span
          key={mark.name}
          className="flex shrink-0 items-center"
          style={{ paddingRight: `calc(var(--band) * ${mark.gap})` }}
        >
          <Image
            src={mark.src}
            alt=""
            width={mark.width}
            height={mark.height}
            /* IN PIXELS, NOT `vw`, and that is the whole point. A mark's width
               comes from `--band`, which is one of three fixed heights — so
               inside a breakpoint it does not move with the viewport at all,
               and a `vw` figure here would only be right at one window width.
               Declared 45vw once and a 390px phone was handed a 175px file for
               a 295px mark: visibly soft. These are the widest mark in the run
               (Dom Pérignon, at 1.2x the band) rounded up, per breakpoint. */
            sizes="(max-width: 639px) 300px, (max-width: 767px) 350px, 385px"
            /* EAGER ON PURPOSE, and it is the one thing here worth not
               "optimising" later. A marquee is the case lazy loading gets
               wrong: only the two or three marks standing in the viewport
               would ever qualify, and the rest would each pop in at the
               moment they slid into it — a hole travelling through the run on
               the first pass, which is precisely the seam the duplicated
               track exists to avoid. Chrome compounds it by not intersecting
               lazy images inside a masked subtree at all, so with the two
               masks above none of them loaded.
               The bill for loading all five up front is 50KB across five
               requests — the run repeats the same files rather than doubling
               them — which is less than one photograph on this page. */
            loading="eager"
            /* `max-w-none` because preflight caps images at the width of
               their container, and these are meant to run past it. */
            className="w-auto max-w-none"
            style={{
              height: `calc(var(--band) * ${mark.scale})`,
              transform: `translate3d(0, calc(var(--band) * ${mark.drift}), 0)`,
              opacity: mark.opacity,
            }}
          />
        </span>
      ))}
    </span>
  );
}
