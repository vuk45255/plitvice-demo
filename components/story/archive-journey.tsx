"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Image from "next/image";
import { useScrollTrack } from "@/components/story/use-scroll-track";
import { ScrollCue } from "@/components/scroll-cue";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";
import { useWideScreen } from "@/lib/use-media";

/* THE ARCHIVE — /o-nama, and the one chapter of the site that is travelled
 * rather than scrolled.
 *
 * The section pins, and from then on the wheel drives a camera sideways across
 * a single oversized wall: one continuous editorial canvas roughly four and a
 * half screens wide, with the whole history of the house laid out along it.
 * The reader scrolls down and the story moves right to left past them. Nothing
 * here is a slide. There is no fade from one composition to the next, no
 * panel that replaces another, no carousel: the scenes are simply places on
 * the wall, and the camera passes them.
 *
 * ONE MEASUREMENT, EVERYTHING ELSE DERIVED. There is a single scroll track on
 * the section — `progress`, 0 the moment it pins and 1 the moment it lets go.
 * From it comes `camera`, the position of the lens along the wall in vw, and
 * every piece on the wall is drawn at `left: (its own x)vw` and translated by
 * `-camera`. Nothing listens to the wheel, nothing snaps, nothing is on a
 * timer, and the whole journey reverses perfectly on the way back up.
 *
 * THE WALL IS MEASURED IN THE VIEWPORT'S OWN UNITS. Every position below is
 * vw across and vh down, so one set of numbers composes the wall on a 1920
 * screen and on a 390 phone alike — and the two get their own layouts anyway,
 * because a phone is not a wide screen with less of it. See WIDE and NARROW.
 *
 * FOUR SCENES AND A FIFTH THAT IS NOT ON THE WALL. The last film travels with
 * the wall as an editorial rectangle, is held long enough to be watched, and
 * then opens out into the room the closing statement is spoken in. It is one
 * element throughout — see NightFilm — which is why the opening reads as the
 * frame growing rather than as one video replacing another. */

/* ──────────────────────────── the journey ──────────────────────────── */

/* THE SCORE, WRITTEN AS A CAMERA MOVE LIST.
 *
 * Nine beats. Each says where the camera ends up, in vw along the wall, and
 * how much page it costs to get there, in svh. That is the whole timing model
 * of the section: the costs added together are the length of the scroll
 * track, each beat's share of that total is where it falls in `progress`, and
 * the camera is a piecewise-linear interpolation through the pairs.
 *
 * PACE IS NOT DISTRIBUTED EVENLY, AND THAT IS THE POINT. A beat that moves
 * fourteen vw over forty-four svh is three times slower than one that moves
 * eighty-two over ninety-two, and the reader feels the difference as the
 * camera settling on a composition rather than as the page stalling. Every
 * scene therefore gets a `held` beat straddling its stop — the stretch where
 * the headline can be read and the archive looked at — and a `pan` beat that
 * carries the wall on to the next one. The last film gets the longest hold on
 * the page, because it has to be watched as a film before it is allowed to
 * become anything else.
 *
 * The rule for the pans is one number: a little over one svh of page per vw of
 * wall on a wide screen, one to one on a phone. Read on a 1440 × 900 screen
 * that is about 1.1 pixels of wall per pixel of scroll, so a normal wheel
 * notch advances the composition by a tenth of the screen's width and a whole
 * scene takes six or seven of them. Raising these costs slows the journey
 * without touching a single position on the wall.
 *
 * THE OPENING IS ITS OWN BEAT AND NOT PART OF THE HOLD BEFORE IT. Beat 6 is
 * the film held at its editorial size, beat 7 is the film opening out, and
 * beat 8 is the statement. Running the hold into the opening is what made the
 * expansion start before the visitor had finished looking at the rectangle. */
type Beat = { to: number; cost: number };

/* Where the score falls on the track, worked out once per layout. `at` and
   `cam` are the two arrays useTransform interpolates between; the rest are
   the boundaries the film and the closing statement are keyed to. */
type Journey = {
  at: number[];
  cam: number[];
  /* The beat the film opens out over. */
  opens: [number, number];
  /* And where the statement's own beat begins. */
  settled: number;
};

function score(beats: Beat[]): Journey {
  const total = beats.reduce((sum, beat) => sum + beat.cost, 0);
  const at = [0];
  const cam = [0];
  let spent = 0;

  for (const beat of beats) {
    spent += beat.cost;
    at.push(spent / total);
    cam.push(beat.to);
  }

  return { at, cam, opens: [at[7], at[8]], settled: at[8] };
}

/* A point inside the closing beat, as a share of it. */
const after = (journey: Journey, share: number) =>
  journey.settled + (1 - journey.settled) * share;

/* Every position on the wall is given in the two units the wall is built
   from: vw across — the direction the camera travels — and vh down. */
type Box = { x: number; y: number; w: number; h: number };
type Block = { x: number; y: number; w: number };

type Anchor = Box & {
  photo: keyof typeof PHOTOS;
  /* How far off the plane of the wall the piece hangs. Positive is nearer the
     lens and passes a little faster, negative is further back and lags. Read
     against a wall four screens wide this is almost nothing — it is not a
     parallax so much as the reason the three photographs read as memories
     around the statement rather than as three rectangles pasted onto it. */
  depth: number;
  /* WHERE IT COMES FROM, as [x, y] shares of the frame's own box, spent as the
     scene arrives and nought once it has. The three do not appear at their
     final positions: the two low corners drift up out of their own sides, the
     peak settles down from above it, and the composition assembles itself into
     the shape rather than being switched into it. Deliberately small — this is
     a photograph coming to rest, not a thing flying in. */
  from: [number, number];
  /* A LAYER RATHER THAN A FRAME. The one photograph that sits behind the
     statement instead of beside it: it takes a wash of the house night so the
     type holds against it, and its shutter opens from the sides rather than
     from top and bottom, which is what a wide shallow crop wants. The wash is
     a wash and not a curtain — the room has to stay legible through the
     letters, or there was no reason to put it there. */
  behind?: boolean;
};

type Layout = {
  /* How wide the drawing behind everything is, in vw. */
  canvas: number;
  /* The camera's move list, and where each beat of it falls on the track. */
  journey: Journey;
  /* Where the camera rests for each scene — used only to decide when a scene
     is close enough to be worth playing, and as the still point its own
     parallax is measured from. */
  stops: [number, number, number, number];
  origin: { title: Block; film: Box };
  sound: { film: Box; title: Block };
  years: { title: Block | Box; anchors: Anchor[] };
  nights: { title: Block; film: Box };
};

/* THE THREE ERAS AT THE HINGE OF THE STORY, and they are a timeline rather
   than a scatter: the same room in 1965, in 2017 and this year, left to right,
   in the order the camera passes them. The years are never printed anywhere —
   the photographs themselves carry sixty years of the house between them, and
   a caption under each would only say out loud what the pictures already do.
   Declared in order; `years` in both layouts places them in it. */
const PHOTOS = {
  y1965: { src: "/arhiva/1965.jpg", alt: "wall.alt1965" as MessageKey },
  y2017: { src: "/arhiva/2017.jpg", alt: "wall.alt2017" as MessageKey },
  y2026: { src: "/arhiva/2026.jpg", alt: "wall.alt2026" as MessageKey },
} as const;

/* THE WIDE WALL. Screen-space positions at each camera stop are worth reading
   off before changing anything here — subtract the stop from the x.
 *
 *   01  title  8..50   ·  film 60..87        headline left, the film opposite
 *   02  film  18..39   ·  title 46..92       turned over, and at a new scale
 *   03  the hinge, on a grid: the statement from 10 to 86 with the dominant
 *       photograph entering under its left margin, the detail above and left
 *       of centre, and the supporting frame closing the block on the right at
 *       exactly the statement's right edge
 *   04  title 12..52   ·  film 54..86        the last film, still a rectangle
 */
const WIDE: Layout = {
  canvas: 470,
  /* 750 svh of track. Pans run at about 1.1 svh per vw; the holds are between
     two and five times slower than that, and the last one — the film, watched
     at its editorial size — is the slowest stretch of the whole page. */
  journey: score([
    { to: 14, cost: 44 }, //  01 · held, the wall's opening composition
    { to: 96, cost: 92 }, //     pan on
    { to: 124, cost: 52 }, // 02 · held
    { to: 220, cost: 106 }, //   pan on
    { to: 250, cost: 76 }, // 03 · held — the statement and its photographs
    { to: 334, cost: 91 }, //    pan on
    { to: 352, cost: 96 }, // 04 · held — the film, as a film
    { to: 358, cost: 118 }, //   and the film opens out
    { to: 358, cost: 75 }, // 05 · the statement, and a beat to read it on
  ]),
  stops: [0, 112, 236, 344],
  origin: {
    title: { x: 8, y: 33, w: 42 },
    film: { x: 60, y: 17, w: 27, h: 66 },
  },
  sound: {
    film: { x: 130, y: 17, w: 21, h: 52 },
    title: { x: 158, y: 56, w: 46 },
  },
  years: {
    /* THE STATEMENT IS THE SCENE, and it is two lines: GODINE SE SMENJUJU. /
       IME OSTAJE ISTO. Seventy-six vw is what holds each of them on one line
       at this size — narrow the box and the first line wraps, which turns one
       editorial statement into four stacked fragments.
     *
     * AND IT IS CENTRED ON THE SCREEN RATHER THAN HUNG FROM A TOP MARGIN.
     * The box is the full height of the stage — y 0, h 100 — and the two
     * lines are centred inside it by SceneYears, which is the layout answer
     * to translate(-50%, -50%): the middle of the sentence lands on 50vh at
     * every window height and every step of the type's clamp, instead of a
     * fixed top that reads centred at one size and high at the next. The
     * whole composition is then measured from that centre.
     *
     * Screen 12..88 across at the stop, so the sentence is centred on 50vw.
     *
     * AND IT IS THE MIDDLE BAND OF THREE. Nothing is behind these words and
     * nothing crosses them: the archive is above and below, and the
     * sentence has the middle of the screen to itself. The block runs 37..63
     * down at the deepest the type's clamp can reach, and the two bands are
     * placed off those edges — see the anchors. */
    title: { x: 248, y: 0, w: 76, h: 100 },
    /* THREE BANDS DOWN THE SCREEN, AND NOTHING SHARES A ROW WITH THE TYPE.
     *
     * 2017 used to sit behind the statement. It does not any more: it is a
     * band of its own across the top — screen 33..67 across, 11..30 down —
     * clear of the header above it and five vh clear of the tallest the
     * sentence can grow to below it. Which is why it is nineteen vh rather
     * than twenty-six: the space between a header that ends around 7 and a
     * statement that begins at 37 is all there is, and a photograph that
     * fills it edge to edge is not a band, it is a collision waiting for a
     * shorter window. It has also lost `behind` — no wash, no sideways
     * shutter, no wide crop pretending to be a ground for type. It is a
     * frame now, like the other two, because that is what it is.
     *
     * 1965 and this year are the floor: screen 10..28 and 72..90, opening at
     * 69 and 71, six vh under the last line of the sentence and outside the
     * centre band's column as well. Set at slightly different heights on
     * purpose — the floor of the composition is asymmetric, not a shelf.
     *
     * THE THREE BANDS ARE THE WHOLE RULE OF THIS SCENE. A horizontal line
     * drawn above the statement and another below it are crossed by nothing.
     * The type's height is the one thing here that moves on its own — it is
     * set in vw and read on windows of every height — so the gaps are sized
     * for the top of its clamp on a short wide window, not for a comfortable
     * one. Anything that grows a photograph toward the middle spends that
     * margin.
     *
     * The layering is still DOM order rather than z-index: the anchors are
     * rendered before the title in SceneYears, so type would be over a
     * photograph if the two ever met. Nothing here relies on that any
     * more. */
    anchors: [
      { photo: "y1965", x: 246, y: 69, w: 18, h: 20, depth: 0.5, from: [-16, 12] },
      { photo: "y2017", x: 269, y: 11, w: 34, h: 19, depth: -0.3, from: [0, -10] },
      { photo: "y2026", x: 308, y: 71, w: 18, h: 20, depth: 0.45, from: [16, 12] },
    ],
  },
  nights: {
    title: { x: 356, y: 48, w: 40 },
    film: { x: 398, y: 16, w: 32, h: 68 },
  },
};

/* THE NARROW WALL. Not the wide one scaled down: a phone is nine tenths type
   and one big picture at a time, so every scene here is a full-width stack
   rather than a left-and-right pair, and the wall is shorter because a thumb
   covers more ground per gesture than a wheel does.
 *
 *   01  title 8..92 high   ·  film 10..80 under it
 *   02  film 22..88 high   ·  title 8..92 under it — the mirror of 01
 *   03  the same grid as the wide wall, at phone proportions
 *   04  title 8..92        ·  film 10..90, a big editorial frame
 */
/* THE NARROW WALL — the wide one compressed, not a mobile page.
 *
 * IT WAS A COLUMN AND THAT WAS THE BUG. Every scene here used to be a headline
 * with one centred picture under it: legible, and nothing whatever to do with
 * the wall above. What the wide wall is made of is asymmetry, overlap and
 * things running off the edge of the frame, and none of that needs a wide
 * screen — it needs a composition that is allowed to be bigger than the
 * viewport. So each scene below is, and the camera travels through it.
 *
 * A COMPOSITION MAY BE WIDER THAN THE PHONE. Where a piece sits at screen 106
 * it is off the right edge at the stop and arrives as the camera moves; where
 * one sits at screen -12 it is on its way out. That is the same reading the
 * wide wall gives, at a width where showing everything at once would mean
 * showing everything small. Nothing is centred and nothing is stacked.
 *
 * AND IT IS GIVEN THE SCROLL TO DO IT IN. A thousand svh against the wide
 * wall's eight hundred and fifty: a phone has the smaller window and the
 * slower gesture, so the same sequence is worth more page here, not less. */
const NARROW: Layout = {
  canvas: 490,
  /* 900 svh of track. Same nine beats and the same shape as the wide score —
     hold, pan, hold — a third longer throughout. */
  journey: score([
    { to: 18, cost: 52 }, //   01 · held
    { to: 112, cost: 110 }, //    pan on
    { to: 138, cost: 60 }, //  02 · held
    { to: 237, cost: 116 }, //    pan on
    /* 03 · held — and on a phone this one is very nearly still.

       EVERY OTHER "HOLD" ON THIS WALL IS A SLOW DRIFT, and it should be: the
       scroll has to keep answering, or a screen of gesture goes nowhere. This
       scene cannot afford the usual twenty-six. Its statement is set across
       the full width of the phone, so any drift is spent entirely on the
       margins — thirteen vw either side of the rest point put the first line
       hard against one edge and clipped it. Eight vw is the most this
       composition takes without going lopsided, and it is still movement. */
    { to: 245, cost: 92 }, //  03 · held
    { to: 344, cost: 124 }, //    pan on
    { to: 366, cost: 116 }, // 04 · held — the film, as a film
    { to: 372, cost: 138 }, //    and the film opens out
    { to: 372, cost: 92 }, //  05 · the statement
  ]),
  stops: [0, 124, 241, 356],
  /* 01 · headline high on the left, the film large and low beneath its right
     shoulder and running off the edge of the frame — the wide wall's
     side-by-side turned through the diagonal a phone can carry. */
  origin: {
    title: { x: 5, y: 22, w: 78 },
    film: { x: 40, y: 34, w: 66, h: 54 },
  },
  /* 02 · and it turns over: the film comes in high on the left and is leaving
     by the time the headline has settled low and right of it. */
  sound: {
    film: { x: 112, y: 12, w: 54, h: 44 },
    title: { x: 146, y: 54, w: 80 },
  },
  years: {
    /* The statement is two lines here as well — see the type scale in
       SceneYears, which is set to hold them rather than to be as large as it
       can be. Four stacked fragments is not this sentence.

       CENTRED ON THE PHONE, NOT ON THE PHOTOGRAPH. The block is exactly one
       screen wide and begins exactly on the scene’s still point, so at rest it
       IS the viewport — left 0, width 100vw — and the two lines centre inside
       it. Anything narrower centres the sentence on whatever the box happens
       to be sitting over instead of on the screen. */
    title: { x: 241, y: 42, w: 100 },
    /* THE SAME THREE RELATIONSHIPS AS THE WIDE WALL, STACKED. The wide wall
       sets them across a corridor; a phone has no corridor, so the scene is
       read top to bottom instead: 2017 across the top, the statement alone in
       the middle of the screen, and the two low frames well beneath it, one
       running off each edge. Nothing overlaps the type here — the sentence is
       given the middle third of the phone and nothing else is in it. */
    anchors: [
      /* THE LOW PAIR, AND IT IS GENUINELY LOW. The statement finishes at half
         the screen; neither of these opens until well past it, so there is a
         clear band of night under the words before anything else begins. They
         stay at different heights and run off opposite edges — the floor of
         the composition is asymmetric, not a shelf. */
      { photo: "y1965", x: 235, y: 58, w: 36, h: 26, depth: 0.5, from: [-16, 12] },
      {
        /* A STRIP ACROSS THE TOP, NOT A BACKGROUND. Cut hard top and bottom
           and hung in the upper third, clear of the statement. It reads as the
           layer the scene opens with rather than as a card the words are
           printed on — which is what it became the moment the type sat inside
           it. Roughly a hundred and seventy pixels of a tall phone. */
        photo: "y2017",
        x: 249,
        y: 10,
        w: 84,
        h: 21,
        depth: -0.3,
        from: [0, -10],
        behind: true,
      },
      { photo: "y2026", x: 301, y: 62, w: 36, h: 26, depth: 0.45, from: [16, 12] },
    ],
  },
  /* 04 · headline high and left, the last film large under and right of it —
     the composition it has to be in for the opening to have somewhere to grow
     from. */
  nights: {
    title: { x: 360, y: 14, w: 78 },
    film: { x: 366, y: 30, w: 78, h: 56 },
  },
};

/* How much of a piece's own depth is spent, per vw the camera is past the
   scene it belongs to. Deliberately tiny: at a fifth of a screen either side
   of the stop the furthest plane has moved about two vw against the nearest,
   which is a shadow of a difference and exactly as much as is wanted. */
const DEPTH = 0.075;

/* The site keeps one media-query hook — see lib/use-media.ts. */
const useWide = useWideScreen;

/* ─────────────────────────── the camera itself ─────────────────────── */

/* One piece of the wall.
 *
 * Positioned once, in wall coordinates, and from then on it only ever moves
 * by a transform: `left` and `top` are written to the DOM at mount and never
 * touched again, and the travel is `translate3d` on the compositor. That is
 * the whole performance story of this section — a dozen elements, each with
 * one transform, and no layout read or written on any frame.
 *
 * It is never given an opacity of its own. A piece arrives because it has
 * travelled into the frame and leaves because it has travelled out of it, and
 * anything that faded on the way past would turn the wall back into slides. */
function Piece({
  camera,
  at,
  stop,
  depth = 0,
  className,
  style,
  children,
}: {
  camera: MotionValue<number>;
  at: Box | Block;
  stop: number;
  depth?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const x = useTransform(
    camera,
    (c) => `${-c + (c - stop) * depth * DEPTH}vw`,
  );

  return (
    <motion.div
      className={`absolute ${className ?? ""}`}
      style={{
        left: `${at.x}vw`,
        top: `${at.y}vh`,
        width: `${at.w}vw`,
        ...("h" in at ? { height: `${at.h}vh` } : null),
        ...style,
        x,
        willChange: "transform",
      }}
    >
      {children}
    </motion.div>
  );
}

/* How far a piece has come into the frame, 0 to 1.
 *
 * Measured off the camera rather than off a timer, so it is exactly as
 * reversible as the scroll is: nought while the piece is still off the right
 * edge, one by the time its leading edge has reached the middle third. This
 * is what the word masks and the film shutters are opened by — the only
 * choreography on the wall, and all of it is arrival. Nothing is choreographed
 * out; pieces leave by being somewhere else. */
function useArrival(camera: MotionValue<number>, x: number) {
  return useTransform(camera, [x - 98, x - 42], [0, 1]);
}

/* ──────────────────────────────── type ─────────────────────────────── */

/* A headline, set word by word.
 *
 * Each word rises out of a mask no taller than itself, a beat behind the one
 * before it — restrained enough that on a two-line headline the stagger reads
 * as the line settling rather than as an effect. The words are masked
 * individually rather than by line so the copy can wrap wherever the language
 * and the screen put it; nothing here assumes a break. */
function Words({
  text,
  enter,
  className,
}: {
  text: string;
  enter: MotionValue<number>;
  className?: string;
}) {
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        <Word key={i} word={word} enter={enter} index={i} count={words.length} />
      ))}
    </span>
  );
}

function Word({
  word,
  enter,
  index,
  count,
}: {
  word: string;
  enter: MotionValue<number>;
  index: number;
  count: number;
}) {
  /* The whole stagger is spent inside the first two fifths of the arrival, so
     the last word is up well before the scene has finished composing. */
  const step = 0.4 / Math.max(count, 1);
  const from = index * step;
  const local = useTransform(enter, [from, Math.min(from + 0.6, 1)], [0, 1]);
  const y = useTransform(local, (v) => `${(1 - v) * 112}%`);

  return (
    <span className="-mb-[0.18em] mr-[0.24em] inline-block overflow-hidden pb-[0.18em] align-bottom">
      <motion.span className="inline-block" style={{ y, opacity: local }}>
        {word}
      </motion.span>
    </span>
  );
}

/* ─────────────────────────────── the media ─────────────────────────── */

/* Whether the camera is close enough to a scene for its film to be worth
   running. React bails out of the render while the answer is unchanged, which
   is every frame but two per scene. */
function useWithin(camera: MotionValue<number>, from: number, to: number) {
  const [on, setOn] = useState(false);

  useMotionValueEvent(camera, "change", (c) => setOn(c > from && c < to));

  return on;
}

/* Whether the camera has come within reach of a point on the wall, latching
   once and never going back. One of these per film, so the archive is fetched
   in the order it is read rather than all at once when the section pins. */
function useApproach(camera: MotionValue<number>, at: number) {
  const [near, setNear] = useState(false);

  useMotionValueEvent(camera, "change", (c) => setNear((was) => was || c > at));

  return near;
}

/* A shutter, opening. The frame a film is revealed through as it comes into
   the viewport — a horizontal band of its own height that opens out to the
   full frame. Never closes: a film leaves by travelling off the wall. */
function useShutter(arrival: MotionValue<number>, band: number) {
  return useTransform(arrival, (a) => {
    const inset = band * (1 - a);
    return `inset(${inset}% 0% ${inset}% 0%)`;
  });
}

/* Archive footage, held in an editorial frame.
 *
 * It plays while its scene is anywhere near the frame and is paused the
 * moment the camera has left it behind, so a wall with four films on it never
 * costs more than one decoding video. Nothing is mounted until the camera is
 * within reach, and the poster carries the composition until the first frame
 * is decoded — so a film never arrives as a black rectangle and never shifts
 * the composition when it does arrive.
 *
 * Every src is the `-small` cut, the convention the hero and the interlude
 * film already follow. The masters in /public/arhiva are 1080-wide at ten
 * megabits and no frame on this wall is drawn wider than a third of a screen;
 * the three together were thirty-four megabytes of a page that is mostly type.
 * Re-encoded for the sizes they are actually shown at they are six, and the
 * masters stay where they are for whatever gets cut from them next. */
function Film({
  src,
  poster,
  alt,
  play,
  mounted,
}: {
  src: string;
  poster: string;
  alt: string;
  play: boolean;
  mounted: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (play) {
      /* Autoplay can be refused — a data-saver setting, a background tab. The
         poster stays up and nothing else about the composition changes. */
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [play, mounted]);

  if (!mounted) {
    return (
      /* The poster is the video's own first frame, already sized and served
         from /public; running it through the optimiser would only put a second
         copy of it on the wire. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt="" className="img-grade h-full w-full object-cover" />
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
      className="img-grade h-full w-full object-cover"
    />
  );
}

/* One of the three stills at the hinge of the story.
 *
 * Through the optimiser, and given the widths it is actually drawn at rather
 * than the ones the files happen to be: the largest is a quarter of a wide
 * screen and two fifths of a phone, so what goes over the wire is a few
 * kilobytes of webp instead of a 1440-wide jpeg scaled down in the browser.
 *
 * No reveal of its own — the shutter on the frame around it is the reveal. */
function ArchiveStill({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 768px) 20vw, 30vw"
      loading="lazy"
      className="img-grade object-cover"
    />
  );
}

/* The grade every film on the wall is finished with: a little night pulled up
   from the floor of the frame so the wall's own dark reads through the bottom
   of it, and a breath of it at the top. */
function FilmGrade() {
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-night/20"
      aria-hidden="true"
    />
  );
}

/* ───────────────────────────── the section ─────────────────────────── */

/* One screen of stage, and the travel under it — the sums of the two scores
   above, plus the screen the stage itself occupies.
 *
 * A class rather than a style so the media query decides it: `useWide` cannot
 * know the width until it has hydrated and reports narrow until then, which
 * on a wide screen would lay the page out seventy screens short for a frame
 * and then grow it under whatever the reader was looking at. Change a cost in
 * either score and this has to be changed with it. */
const TRACK = "h-[1000svh] md:h-[850svh]";

/* THE WEIGHT.
 *
 * Lenis already smooths the page's scroll, but it smooths it as a series of
 * eased runs — one per wheel event — and a wall four screens wide magnifies
 * every seam between them into a visible tick. This is a critically-damped
 * follower on the progress value itself, and it is the whole of the fix: the
 * wall is still driven by nothing but the scroll position, and still reverses
 * exactly, but it arrives at each new position over about a sixth of a second
 * instead of on the frame the event landed.
 *
 * OVERDAMPED ON PURPOSE — the ratio here is a little over 1.4, so the value
 * never passes its target and there is nothing to spring back from. A spring
 * under 1 would be the rubber band this is not supposed to feel like.
 *
 * `restDelta` has to be given. Motion's default is a hundredth, which on a
 * value that runs from nought to one is most of a screen of scrolling, and
 * the wall would stop short of where the reader actually is. */
const WEIGHT = {
  stiffness: 260,
  damping: 42,
  mass: 0.85,
  restDelta: 0.000004,
  restSpeed: 0.000004,
};

export function ArchiveJourney() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const wide = useWide();
  const { t } = useLang();

  const scrolled = useScrollTrack(ref);
  const progress = useSpring(scrolled, WEIGHT);
  const layout = wide ? WIDE : NARROW;
  const { at, cam, opens } = layout.journey;

  /* THE CAMERA. The score, interpolated. Everything on the page is a
     transform of this one value and of the progress it was made from. */
  const camera = useTransform(progress, at, cam);

  /* How far the last film has opened out into the room. */
  const morph = useTransform(progress, opens, [0, 1]);

  /* And the wall receding behind it — pushed on a little further and let go
     of, so the archive clears the screen for the ending rather than sitting
     underneath it. It goes over the first third of the opening, which leaves
     the rest of that beat to the film alone. */
  const wallCamera = useTransform(
    [camera, morph],
    ([c, m]: number[]) => c + m * 18,
  );
  const wallFade = useTransform(morph, [0.06, 0.4], [1, 0]);

  /* THE FIRST BEAT OF THE RAIL, BEFORE THE RAIL HAS ANYTHING TO SAY.
   *
   * A pinned stage is the one place on the site where scrolling does not move
   * the page, and the wall opens on a single held composition — so the screen
   * that says PLITVICE NISU NASTALE PREKO NOĆI reads as a whole page rather
   * than as the first frame of five. The timeline below it is the house's own
   * answer to that, and it is already there; it is simply drawn at nothing on
   * the frame the pin engages on, and takes until 0.035 to come up.
   *
   * So this is a hand-over and not a second instrument. The cue holds the foot
   * of the stage while the rail is still at nought, and is gone by 0.026 —
   * by which point the rail is about three quarters up and plainly the thing
   * being read. They cross rather than queue, which is what makes it one
   * gesture; what must not happen is the pin engaging on an empty foot, and it
   * cannot, because the cue is at full strength exactly where the rail is at
   * none. */
  const cue = useTransform(progress, [0, 0.008, 0.026], [1, 1, 0]);

  const onScreen = useInView(ref);

  return reduced ? (
    <StillArchive />
  ) : (
    <section ref={ref} aria-label={t("about.caption")} className={`relative ${TRACK}`}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Air progress={progress} />
        <Threads camera={camera} canvas={layout.canvas} />

        <motion.div className="absolute inset-0" style={{ opacity: wallFade }}>
          <SceneOrigin
            camera={wallCamera}
            layout={layout}
            wide={wide}
            onScreen={onScreen}
          />
          <SceneSound
            camera={wallCamera}
            layout={layout}
            wide={wide}
            onScreen={onScreen}
          />
          <SceneYears camera={wallCamera} layout={layout} wide={wide} />
          <SceneNights camera={wallCamera} layout={layout} wide={wide} />
        </motion.div>

        <NightFilm
          camera={camera}
          morph={morph}
          layout={layout}
          onScreen={onScreen}
        />
        <Finale progress={progress} journey={layout.journey} />

        <Seams progress={progress} />
        <Rail progress={progress} />
        <ScrollCue opacity={cue} className="z-40" />
      </div>
    </section>
  );
}

/* ── 01 · the wall opens ─────────────────────────────────────────────── */

function SceneOrigin({
  camera,
  layout,
  wide,
  onScreen,
}: {
  camera: MotionValue<number>;
  layout: Layout;
  wide: boolean;
  onScreen: boolean;
}) {
  const { t } = useLang();
  const { title, film } = layout.origin;
  const stop = layout.stops[0];

  const heading = useArrival(camera, title.x);
  const arrival = useArrival(camera, film.x);
  const clipPath = useShutter(arrival, 9);

  const play = useWithin(camera, -60, layout.stops[1] + 46) && onScreen;

  return (
    <>
      <Piece camera={camera} at={title} stop={stop} depth={0.35}>
        <h2
          className={`font-serif uppercase leading-[1.05] tracking-[-0.015em] text-night-ink ${
            wide
              ? "text-[clamp(2.5rem,5vw,6rem)]"
              : "text-[clamp(2rem,9.6vw,3.25rem)]"
          }`}
        >
          <Words text={t("wall.title1")} enter={heading} />
        </h2>
      </Piece>

      <Piece camera={camera} at={film} stop={stop} depth={-0.3}>
        <motion.div
          className="relative h-full w-full overflow-hidden"
          style={{ clipPath }}
        >
          <Film
            src="/arhiva/1965-small.mp4"
            poster="/arhiva/1965-poster.jpg"
            alt={t("wall.altOrigin")}
            play={play}
            mounted
          />
          <FilmGrade />
        </motion.div>
      </Piece>
    </>
  );
}

/* ── 02 · the same wall, turned over ─────────────────────────────────── */

function SceneSound({
  camera,
  layout,
  wide,
  onScreen,
}: {
  camera: MotionValue<number>;
  layout: Layout;
  wide: boolean;
  onScreen: boolean;
}) {
  const { t } = useLang();
  const { film, title } = layout.sound;
  const stop = layout.stops[1];

  const heading = useArrival(camera, title.x);
  const arrival = useArrival(camera, film.x);
  const clipPath = useShutter(arrival, 10);

  const mounted = useApproach(camera, film.x - 190);
  const play = useWithin(camera, stop - 110, stop + 120) && onScreen;

  return (
    <>
      <Piece camera={camera} at={film} stop={stop} depth={0.5}>
        <motion.div
          className="relative h-full w-full overflow-hidden"
          style={{ clipPath }}
        >
          <Film
            src="/arhiva/konobari-small.mp4"
            poster="/arhiva/konobari-poster.jpg"
            alt={t("wall.altStaff")}
            play={play}
            mounted={mounted}
          />
          <FilmGrade />
        </motion.div>
      </Piece>

      <Piece camera={camera} at={title} stop={stop} depth={-0.25}>
        <h2
          className={`font-serif uppercase leading-[1.05] tracking-[-0.015em] text-night-ink ${
            wide
              ? "text-[clamp(2.25rem,4.6vw,5.5rem)]"
              : "text-[clamp(1.875rem,9vw,3rem)]"
          }`}
        >
          <Words text={t("wall.title2")} enter={heading} />
        </h2>
      </Piece>
    </>
  );
}

/* ── 03 · the hinge ──────────────────────────────────────────────────── */

/* The statement holds the wall, and three photographs run under it as one
   line of time: 1965, 2017, this year — the same room, sixty years apart,
   left to right in the order the camera passes them.
 *
 * THEY ARE THE SAME SIZE, AND THAT IS THE WHOLE POINT. Three eras given equal
 * weight is the argument the scene is making; one frame larger than the others
 * would turn a timeline into a favourite. So the width, the height and the
 * crop are identical and only the position varies — evenly spaced, with the
 * middle frame lifted about thirty-five pixels so the row has a little
 * editorial character without ever stopping reading as a sequence.
 *
 * They arrive in order for free. `useArrival` opens each frame off its own
 * position on the wall, and the wall runs left to right — so 1965 is up before
 * 2017 and 2017 before this year, on the section's own camera and without a
 * timer or a second scroll system anywhere near it.
 *
 * NOTHING IS WRITTEN ON THEM. No year, no caption, no rule: the photographs
 * are sixty years apart and say so on their own. */
function SceneYears({
  camera,
  layout,
  wide,
}: {
  camera: MotionValue<number>;
  layout: Layout;
  wide: boolean;
}) {
  const { t } = useLang();
  const { title, anchors } = layout.years;
  const stop = layout.stops[2];

  const heading = useArrival(camera, title.x);

  return (
    <>
      {anchors.map((anchor) => (
        <Anchored key={anchor.photo} camera={camera} at={anchor} stop={stop} />
      ))}

      {/* Centred, and after the photographs in the DOM so the type is the
          layer over them. Words are masked individually, so a centred line
          still rises out of its own mask exactly as a left-set one does.

          ON THE WIDE WALL THE BOX IS THE WHOLE STAGE and the sentence is
          centred inside it, which is the only way the middle of the type
          lands on the middle of the screen at every window height: the two
          lines are between three and eight rem tall depending on the width,
          and any fixed top that reads centred at one end of that reads high
          at the other. The phone's box has no height and is positioned the
          way it always was — the wrapper is inert there. */}
      <Piece camera={camera} at={title} stop={stop} depth={0}>
        <div className={wide ? "flex h-full flex-col justify-center" : undefined}>
          <p
            className={`text-center font-serif uppercase leading-[1.02] tracking-[-0.01em] text-night-ink [text-shadow:0_2px_40px_rgba(8,5,13,0.75)] ${
              wide
                ? "text-[clamp(3rem,6vw,8rem)]"
                : "text-[clamp(1.5rem,8.2vw,2.5rem)]"
            }`}
          >
            <Words text={t("about.p3a")} enter={heading} />
          </p>
          <p
            className={`mt-1 text-center font-serif uppercase leading-[1.02] tracking-[-0.01em] text-night-ink/60 [text-shadow:0_2px_40px_rgba(8,5,13,0.75)] md:mt-3 ${
              wide
                ? "text-[clamp(3rem,6vw,8rem)]"
                : "text-[clamp(1.5rem,8.2vw,2.5rem)]"
            }`}
          >
            <Words text={t("about.p3b")} enter={heading} />
          </p>
        </div>
      </Piece>
    </>
  );
}

/* One photograph on the hinge. The vertical drift is a fraction of the
   horizontal one — enough that the three do not read as being on rails. */
function Anchored({
  camera,
  at,
  stop,
}: {
  camera: MotionValue<number>;
  at: Anchor;
  stop: number;
}) {
  const { t } = useLang();
  const photo = PHOTOS[at.photo];

  const arrival = useArrival(camera, at.x);

  /* The two anchors open out of a band of their own height, which is the
     reveal every frame on this wall is given. The layer behind the statement
     opens from the sides instead: a wide shallow crop closed top and bottom
     would be a letterbox rather than a shutter. */
  const shutter = useShutter(arrival, 12);
  const sideways = useTransform(arrival, (a) => {
    const inset = 14 * (1 - a);
    return `inset(0% ${inset}% 0% ${inset}%)`;
  });

  /* Two things move this frame, and they are simply added: the drift its own
     plane gives it for the whole of the pass, and the offset it arrives out
     of, which is spent by the time the scene is composed. */
  const x = useTransform(arrival, (a) => `${(1 - a) * at.from[0]}%`);
  const y = useTransform(
    [camera, arrival],
    ([c, a]: number[]) =>
      `${(c - stop) * at.depth * DEPTH * 0.42 + (1 - a) * at.from[1] * 0.3}vh`,
  );

  return (
    <Piece camera={camera} at={at} stop={stop} depth={at.depth}>
      <motion.div
        className="relative h-full w-full overflow-hidden"
        style={{ x, y, clipPath: at.behind ? sideways : shutter }}
      >
        <ArchiveStill src={photo.src} alt={t(photo.alt)} />

        {/* The wash that lets the statement stand on it. Deep enough at the
            middle of the frame, where the letters are, to hold ivory type;
            open at the edges so the room is plainly still a room. No blur and
            no curtain — the photograph has to read through the words. */}
        {at.behind ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(78% 84% at 50% 50%, rgba(8,5,13,0.62) 0%, rgba(8,5,13,0.44) 58%, rgba(8,5,13,0.3) 100%)",
            }}
            aria-hidden="true"
          />
        ) : null}
      </motion.div>
    </Piece>
  );
}

/* ── 04 · the last composition on the wall ───────────────────────────── */

/* Only the headline. The film beside it is not on the wall at all — it is
   NightFilm below, which travels with the wall, is held, and then opens. */
function SceneNights({
  camera,
  layout,
  wide,
}: {
  camera: MotionValue<number>;
  layout: Layout;
  wide: boolean;
}) {
  const { t } = useLang();
  const { title } = layout.nights;
  const stop = layout.stops[3];

  const heading = useArrival(camera, title.x);

  return (
    <Piece camera={camera} at={title} stop={stop} depth={0.3}>
      <h2
        className={`font-serif uppercase leading-[1.05] tracking-[-0.015em] text-night-ink ${
          wide
            ? "text-[clamp(2rem,4.2vw,5rem)]"
            : "text-[clamp(1.75rem,8.4vw,2.75rem)]"
        }`}
      >
        <Words text={t("wall.title3")} enter={heading} />
      </h2>
    </Piece>
  );
}

/* ── the film that becomes the room ──────────────────────────────────── */

/* ONE ELEMENT, TWO LIVES. It travels in with the wall as an ordinary
 * editorial rectangle, is held there while the camera creeps past it, and
 * only then opens out to the whole screen. There is no second video, no
 * crossfade and no hand-over: what fills the screen at the end is the same
 * DOM node the reader was watching a moment earlier, which is the only way
 * the opening reads as the frame growing rather than as a cut.
 *
 * HOW IT IS DRAWN. The wrapper is exactly the viewport and is scaled down to
 * the rectangle about its own centre, then translated to where on the screen
 * that rectangle belongs; the film inside it is scaled back up by the inverse,
 * so it is always drawn at true full-screen size and the wrapper is only ever
 * a window onto it. Two transforms and nothing else — no width, no height, no
 * clip-path, nothing that costs a layout or a repaint on any frame of the
 * opening. Opening the window is then simply both scales running to one.
 *
 * Where the window sits while it is still a rectangle is the camera's job:
 * its centre is a fixed point on the wall, so it travels with everything else
 * on it. As the morph runs, that offset is drawn down to nothing and the
 * window arrives at the middle of the screen already full size. */
function NightFilm({
  camera,
  morph,
  layout,
  onScreen,
}: {
  camera: MotionValue<number>;
  morph: MotionValue<number>;
  layout: Layout;
  onScreen: boolean;
}) {
  const { t } = useLang();
  const { film } = layout.nights;

  const sx0 = film.w / 100;
  const sy0 = film.h / 100;
  const cx = film.x + film.w / 2;
  const cy = film.y + film.h / 2;

  const scaleX = useTransform(morph, (m) => sx0 + (1 - sx0) * m);
  const scaleY = useTransform(morph, (m) => sy0 + (1 - sy0) * m);
  const invX = useTransform(scaleX, (s) => 1 / s);
  const invY = useTransform(scaleY, (s) => 1 / s);

  const x = useTransform(
    [camera, morph],
    ([c, m]: number[]) => `${(cx - c - 50) * (1 - m)}vw`,
  );
  const y = useTransform(morph, (m) => `${(cy - 50) * (1 - m)}vh`);

  /* The shutter it arrives behind, opened by the camera exactly like every
     other frame on the wall — and then left open for good. */
  const arrival = useArrival(camera, film.x);
  const clipPath = useTransform([arrival, morph], ([a, m]: number[]) => {
    const inset = 9 * (1 - a) * (1 - m);
    return `inset(${inset}% 0% ${inset}% 0%)`;
  });

  /* The grade over the rectangle, gone by the time it is the room: the film
     is the last thing the page has to say and it is not going to be said
     through a veil. */
  const grade = useTransform(morph, [0, 0.45], [1, 0]);

  const mounted = useApproach(camera, film.x - 210);
  const play = useWithin(camera, film.x - 150, Infinity) && onScreen;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ x, y, scaleX, scaleY, willChange: "transform" }}
    >
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ scaleX: invX, scaleY: invY, willChange: "transform" }}
        >
          <Film
            src="/arhiva/zurka-small.mp4"
            poster="/arhiva/zurka-poster.jpg"
            alt={t("wall.altNight")}
            play={play}
            mounted={mounted}
          />
        </motion.div>

        <motion.div style={{ opacity: grade }} aria-hidden="true">
          <FilmGrade />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ── 05 · what the whole journey was for ─────────────────────────────── */

/* The closing statement, and only once the room is a room.
 *
 * ITS OWN BEAT, AND THE ORDER INSIDE IT IS THE POINT. The film finishes
 * opening, then the screen is nothing but the film for the first eighth of
 * this beat, then the first line arrives, then the second behind it, and the
 * last fifth is a hold on the finished statement. Nothing here is a caption
 * printed over a rectangle that is still growing.
 *
 * Under them the lightest veil that will hold the type: a wide, shallow pool
 * of night rather than a curtain. The club's own purples and blues and the
 * movement of the room have to carry through it, because that room is the
 * thing the last line is about. */
function Finale({
  progress,
  journey,
}: {
  progress: MotionValue<number>;
  journey: Journey;
}) {
  const { t } = useLang();

  const veil = useTransform(progress, journey.opens, [0, 1]);
  const same = useTransform(
    progress,
    [after(journey, 0.12), after(journey, 0.46)],
    [0, 1],
  );
  const next = useTransform(
    progress,
    [after(journey, 0.34), after(journey, 0.72)],
    [0, 1],
  );

  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          opacity: veil,
          background:
            "radial-gradient(82% 72% at 50% 50%, rgba(8,5,13,0.26) 0%, rgba(8,5,13,0.5) 62%, rgba(8,5,13,0.7) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-[6vw]">
        <h2 className="w-full text-center font-serif uppercase leading-[1.0] tracking-[-0.01em] [text-shadow:0_2px_60px_rgba(8,5,13,0.85)] text-[clamp(2.5rem,13.5vw,4rem)] md:text-[clamp(3rem,7.4vw,9rem)]">
          <span className="block text-night-ink">
            <Words text={t("story.sameEnergy")} enter={same} />
          </span>
          <span className="mt-1 block text-gold-light/90 md:mt-2">
            <Words text={t("story.newGeneration")} enter={next} />
          </span>
        </h2>
      </div>
    </>
  );
}

/* ─────────────────────── the air the wall hangs in ─────────────────── */

/* What the wall is lit by, and the only thing on this page that is fixed to
   the viewport rather than to the wall: grey at 1965, the violet the club is
   lit by from about half way along, with three slow blooms toward the end.
   Gradients and radials, no filters. */
function Air({ progress }: { progress: MotionValue<number> }) {
  const violet = useTransform(progress, [0.14, 0.62], [0, 1]);
  const blooms = useTransform(progress, [0.38, 0.86], [0, 1]);

  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(8,5,13,0.55) 0%, rgba(8,5,13,0.28) 46%, rgba(8,5,13,0.5) 100%)",
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: violet,
          background:
            "linear-gradient(155deg, rgba(24,12,40,0.3) 0%, rgba(42,18,63,0.42) 52%, rgba(42,18,63,0.58) 100%)",
        }}
      />
      <motion.div className="absolute inset-0" style={{ opacity: blooms }}>
        {BLOOMS.map((bloom, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: bloom.left,
              top: bloom.top,
              width: bloom.size,
              height: bloom.size,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${bloom.tone} 0%, transparent 68%)`,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

const BLOOMS = [
  { left: "16%", top: "24%", size: "58vh", tone: "rgba(90,36,124,0.30)" },
  { left: "78%", top: "68%", size: "46vh", tone: "rgba(200,164,93,0.10)" },
  { left: "62%", top: "16%", size: "66vh", tone: "rgba(112,42,150,0.24)" },
];

/* ─────────────────────── the threads behind all of it ──────────────── */

/* ONE DRAWING, THE WHOLE LENGTH OF THE WALL.
 *
 * A family of long contours — a topographic map, the grooves of a record and
 * the trace of a level meter are all the same drawing, and this is it. It is
 * as wide as the wall and travels with it, so nothing about it restarts at a
 * scene: the thread crossing behind 1965 is the same thread, unbroken, that
 * crosses behind tonight four screens later. That continuity is most of what
 * makes the wall read as one place rather than as four.
 *
 * Two planes of it. The near one travels with the wall exactly; the far one
 * lags at three quarters of the rate, which over a journey this long is the
 * difference between a drawing and a drawing with air in it.
 *
 * The threads are authored in a normalised 0…1 across, so the same drawing
 * fits a 470vw wall and a 400vw one; the viewBox is the wall's own aspect, so
 * a contour that is shallow when it is written is shallow when it is drawn.
 * Nothing here is stretched. */
function Threads({
  camera,
  canvas,
}: {
  camera: MotionValue<number>;
  canvas: number;
}) {
  const near = useTransform(camera, (c) => `${-c}vw`);
  const far = useTransform(camera, (c) => `${-c * 0.74}vw`);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <Plane x={far} canvas={canvas} threads={FAR} />
      <Plane x={near} canvas={canvas} threads={NEAR} />
    </div>
  );
}

function Plane({
  x,
  canvas,
  threads,
}: {
  x: MotionValue<string>;
  canvas: number;
  threads: Thread[];
}) {
  return (
    /* The travel is on the wrapper and the drawing is a plain <svg>. Motion
       writes an SVG element's own width once and leaves it there — which on a
       screen that hydrates narrow and then turns out to be wide left the
       drawing at the phone's length under a wide screen's viewBox, and the
       threads stopped dead in the middle of the wall. Nothing that has to
       change with the breakpoint belongs in a motion style. */
    <motion.div
      className="absolute left-0 top-0 h-full"
      style={{ x, willChange: "transform" }}
    >
      <svg
        className="h-full"
        style={{ width: `${canvas}vw` }}
        viewBox={`0 0 ${canvas} 100`}
        preserveAspectRatio="none"
        fill="none"
      >
        {threads.map((thread, i) => (
          <path
            key={i}
            d={trace(thread.through, canvas)}
            stroke={`rgba(${thread.tone === "champagne" ? "206,184,146" : "226,220,208"},${thread.weight})`}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </motion.div>
  );
}

type Thread = {
  tone: "champagne" | "grey";
  weight: number;
  /* [x, y] — x normalised across the whole wall, y as a percentage of the
     screen's height. None of them begins or ends inside the wall: every line
     is something passing through rather than something drawn here. */
  through: [number, number][];
};

/* The near plane carries the composition: three long contours that cross each
   other once each, somewhere around the hinge of the story. */
const NEAR: Thread[] = [
  {
    tone: "champagne",
    weight: 0.26,
    through: [
      [-0.02, 27],
      [0.16, 33],
      [0.34, 24],
      [0.52, 31],
      [0.7, 22],
      [0.88, 29],
      [1.03, 23],
    ],
  },
  /* the long climb: low at 1965, high by tonight */
  {
    tone: "grey",
    weight: 0.24,
    through: [
      [-0.02, 79],
      [0.18, 71],
      [0.38, 58],
      [0.58, 45],
      [0.78, 34],
      [1.03, 25],
    ],
  },
  /* and its opposite, which crosses it around the turn of the story */
  {
    tone: "champagne",
    weight: 0.22,
    through: [
      [-0.02, 21],
      [0.2, 32],
      [0.4, 46],
      [0.6, 58],
      [0.8, 68],
      [1.03, 77],
    ],
  },
];

/* And the far plane fills behind it — quieter, flatter, and lagging. */
const FAR: Thread[] = [
  {
    tone: "champagne",
    weight: 0.14,
    through: [
      [-0.06, 14],
      [0.22, 17],
      [0.5, 12],
      [0.78, 16],
      [1.06, 11],
    ],
  },
  {
    tone: "grey",
    weight: 0.13,
    through: [
      [-0.06, 45],
      [0.24, 54],
      [0.52, 57],
      [0.8, 49],
      [1.06, 42],
    ],
  },
  {
    tone: "grey",
    weight: 0.12,
    through: [
      [-0.06, 63],
      [0.28, 58],
      [0.62, 63],
      [1.06, 57],
    ],
  },
  {
    tone: "champagne",
    weight: 0.1,
    through: [
      [-0.06, 88],
      [0.3, 83],
      [0.64, 87],
      [1.06, 81],
    ],
  },
  {
    tone: "grey",
    weight: 0.09,
    through: [
      [-0.06, 6],
      [0.36, 4],
      [0.72, 8],
      [1.06, 5],
    ],
  },
];

/* One thread, as a single chain of cubics.
 *
 * A Catmull-Rom spline through the anchors, converted to Béziers — which is
 * what makes a curve that passes exactly through every point that was placed
 * while staying smooth across each of them. Drawing straight cubics between
 * hand-picked anchors instead would kink at every join, and that kink is
 * precisely what would give the whole field away as drawn rather than traced.
 * Deterministic, so the server and the client agree. */
function trace(through: [number, number][], canvas: number) {
  const pts = through.map(([x, y]) => [x * canvas, y] as [number, number]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(2)}`;

  for (let i = 0; i < pts.length - 1; i += 1) {
    const back = pts[i - 1] ?? pts[i];
    const from = pts[i];
    const to = pts[i + 1];
    const on = pts[i + 2] ?? to;

    const c1 = [
      from[0] + (to[0] - back[0]) / 6,
      from[1] + (to[1] - back[1]) / 6,
    ];
    const c2 = [to[0] - (on[0] - from[0]) / 6, to[1] - (on[1] - from[1]) / 6];

    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(2)}, ${to[0].toFixed(1)} ${to[1].toFixed(2)}`;
  }

  return d;
}

/* ────────────────────────── the edges of the stage ─────────────────── */

/* Everything above is drawn inside a box exactly one screen tall, and both of
   its edges are hard: the wall arrives out of the bottom of the hero and,
   when the pin lets go, the whole screen slides up and leaves a horizontal
   cut across whatever film happened to be running. Two shallow gradings in
   the page's own night dissolve both. While the archive is pinned they read
   as the ceiling and the floor of the room. */
function Seams({ progress }: { progress: MotionValue<number> }) {
  /* The floor of the room is kept light while the journey is running — the
     last thing the closing statement needs is a curtain drawn up over the
     bottom of the film it is spoken in — and is only brought up to full night
     over the last few percent, which is the stretch the pin releases in. */
  const floor = useTransform(progress, [0.975, 1], [0.4, 1]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-[11vh] bg-gradient-to-b from-night via-night/40 to-transparent" />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[20vh] bg-gradient-to-t from-night via-night/55 to-transparent"
        style={{ opacity: floor }}
      />
    </div>
  );
}

/* ──────────────────────────── the timeline ─────────────────────────── */

/* How far along the wall the visitor has travelled.
 *
 * A hairline across the foot of the stage with a small gold tick on it, and
 * nothing else — no dates, no percentage, nothing that turns it back into a
 * measuring device. It belongs to the pinned stage, so it arrives and leaves
 * with it, and it fades at both ends so the pin never begins or releases on a
 * visible instrument. */
function Rail({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.035, 0.955, 1], [0, 1, 1, 0]);
  const left = useTransform(progress, (p) => `${p * 100}%`);

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-x-0 bottom-[4vh] z-40 flex justify-center"
      aria-hidden="true"
    >
      <div className="relative w-[62vw] max-w-[44rem] md:w-[46vw]">
        <div className="h-px w-full bg-night-ink/10" />
        <motion.div
          style={{ scaleX: progress }}
          className="absolute inset-x-0 top-0 h-px origin-left bg-gold/50"
        />
        <motion.div
          style={{ left }}
          className="absolute top-[-2.5px] h-[6px] w-px -translate-x-1/2 bg-gold-light/85"
        />
      </div>
    </motion.div>
  );
}

/* ─────────────────────── the archive without motion ────────────────── */

/* Reduced motion: the same five moments, in the same order, set down the page.
   No pin, no travel, no parallax — and no reveals either, because the visitor
   asked for none. The films keep their posters and their controls rather than
   playing themselves. */
function StillArchive() {
  const { t } = useLang();

  return (
    <section aria-label={t("about.caption")} className="container-x py-[12vh]">
      <div className="mx-auto max-w-[44rem] space-y-[9vh]">
        <StillScene title={t("wall.title1")}>
          <StillFilm
            src="/arhiva/1965-small.mp4"
            poster="/arhiva/1965-poster.jpg"
            alt={t("wall.altOrigin")}
            ratio="aspect-[3/4]"
          />
        </StillScene>

        <StillScene title={t("wall.title2")}>
          <StillFilm
            src="/arhiva/konobari-small.mp4"
            poster="/arhiva/konobari-poster.jpg"
            alt={t("wall.altStaff")}
            ratio="aspect-[3/4]"
          />
        </StillScene>

        <div>
          <p className="font-serif text-[clamp(1.75rem,7vw,3.5rem)] uppercase leading-[1.05] text-night-ink">
            {t("about.p3a")}
          </p>
          <p className="font-serif text-[clamp(1.75rem,7vw,3.5rem)] uppercase leading-[1.05] text-night-ink/60">
            {t("about.p3b")}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(PHOTOS).map(([key, photo]) => (
              <div key={key} className="relative aspect-[4/5] overflow-hidden">
                <ArchiveStill src={photo.src} alt={t(photo.alt)} />
              </div>
            ))}
          </div>
        </div>

        <StillScene title={t("wall.title3")}>
          <StillFilm
            src="/arhiva/zurka-small.mp4"
            poster="/arhiva/zurka-poster.jpg"
            alt={t("wall.altNight")}
            ratio="aspect-[9/14]"
          />
        </StillScene>

        <div className="text-center">
          <p className="font-serif text-[clamp(2rem,9vw,4rem)] uppercase leading-[1.03] text-night-ink">
            {t("story.sameEnergy")}
          </p>
          <p className="font-serif text-[clamp(2rem,9vw,4rem)] uppercase leading-[1.03] text-gold-light/90">
            {t("story.newGeneration")}
          </p>
        </div>
      </div>
    </section>
  );
}

function StillScene({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-serif text-[clamp(1.5rem,5.5vw,2.5rem)] uppercase leading-[1.1] text-night-ink">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function StillFilm({
  src,
  poster,
  alt,
  ratio,
}: {
  src: string;
  poster: string;
  alt: string;
  ratio: string;
}) {
  return (
    <div className={`relative overflow-hidden ${ratio}`}>
      <video
        src={src}
        poster={poster}
        controls
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={alt}
        className="img-grade absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
