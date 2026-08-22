"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { GrandClubSignature } from "@/components/grand-club";
import { useScrollTrack } from "@/components/story/use-scroll-track";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* THE ARCHIVE — /o-nama, and the one chapter of the site that is scrubbed
 * rather than scrolled.
 *
 * The section pins to the screen and from then on the page's scroll drives a
 * single composition through five chapters. Nothing here is a slide: the stage
 * is one room, and what changes is where the light falls in it. A headline
 * leaves to the left at the same moment the film that replaces it arrives from
 * the left, so the two read as one composition turning over rather than as two
 * panels swapping. When the last chapter has settled the pin releases and the
 * page goes on down as normal.
 *
 * ONE MEASUREMENT, EVERYTHING ELSE DERIVED. There is a single scroll track on
 * the section — `progress`, 0 at the moment it pins and 1 at the moment it
 * lets go — and every offset, every reveal, every curtain and the rail at the
 * foot of the stage are transforms of that one value. Nothing listens to the
 * wheel, nothing snaps, nothing is on a timer. The world moves exactly as far
 * as the page was scrolled and reverses perfectly on the way back up.
 *
 * FIVE CHAPTERS, AND THEY OVERLAP ON PURPOSE. `useStage` cuts the track into
 * five equal spans and hands each chapter two windows — `enter` and `leave` —
 * that deliberately reach into its neighbours by CROSS. Inside those windows
 * one chapter is on its way out while the next is on its way in, which is what
 * removes the beat of empty screen that makes a scroll sequence read as a
 * carousel. Between the windows a chapter is alone on the stage for about
 * three fifths of its span: that stillness is the reading time.
 *
 * MOVEMENT IS A SHARE OF THE THING THAT MOVES. Every offset in the score below
 * is a percentage of the element's own box rather than a pixel count, so the
 * same numbers choreograph a 6rem headline on a 1920 screen and a 2.5rem one
 * on a 390 phone without a second set of values. Only the compositions differ
 * between the two, and each is written out in full rather than derived from
 * the other — see `Chapter*` below. */

/* ─────────────────────────────── the score ─────────────────────────── */

const CHAPTERS = 5;
const SPAN = 1 / CHAPTERS;

/* How far a chapter reaches into its neighbour, as a share of the whole
   track. Around a third of a chapter's span: enough that the hand-over is a
   single movement, short enough that two compositions are never both fully
   lit at once. */
const CROSS = 0.072;

/* How much page is spent on the archive, in svh. Five chapters, so a little
   over four fifths of a screen each — the phone gets slightly less because a
   thumb covers more ground per gesture than a wheel does. */
const WIDE_TRAVEL = 430;
const NARROW_TRAVEL = 380;

const WIDE = "(min-width: 768px)";

function useWide() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

type Stage = {
  /* 0 before the chapter has arrived, 1 once it has settled. */
  enter: MotionValue<number>;
  /* 0 while the chapter is held, 1 once it has gone. */
  leave: MotionValue<number>;
  /* How present the chapter is, for the things that only need to know whether
     to be running. */
  life: MotionValue<number>;
};

function useStage(progress: MotionValue<number>, index: number): Stage {
  const start = index * SPAN;
  const end = (index + 1) * SPAN;

  /* The first chapter is already half composed when the pin takes hold — the
     visitor has been watching it rise for the last part of a screen — so its
     window starts before the track does and finishes just inside it. The last
     chapter never leaves: the pin releases under it and it scrolls away like
     any other part of the page. */
  const enter = useTransform(
    progress,
    index === 0 ? [-0.05, 0.035] : [start - CROSS, start - CROSS * 0.12],
    [0, 1],
  );
  const leave = useTransform(
    progress,
    index === CHAPTERS - 1 ? [9, 10] : [end - CROSS * 0.9, end + CROSS * 0.05],
    [0, 1],
  );
  const life = useTransform(
    [enter, leave],
    ([e, l]: number[]) => e * (1 - l),
  );

  return { enter, leave, life };
}

/* ─────────────────────────── the movement itself ───────────────────── */

/* A value that rests at 1 — scale, opacity — pushed away from rest at both
   ends of the chapter. */
function useSettle(
  enter: MotionValue<number>,
  leave: MotionValue<number>,
  from: number,
  to: number,
) {
  return useTransform([enter, leave], ([e, l]: number[]) => {
    const held = from + (1 - from) * e;
    return held + (to - held) * l;
  });
}

/* A value that rests at 0 — an offset — given as a share of the element's own
   box, which is what lets one set of numbers choreograph every screen size. */
function useShift(
  enter: MotionValue<number>,
  leave: MotionValue<number>,
  from: number,
  to: number,
) {
  return useTransform([enter, leave], ([e, l]: number[]) => {
    const held = from * (1 - e);
    return `${held + (to - held) * l}%`;
  });
}

type Pose = { x?: number; y?: number; scale?: number; opacity?: number };

/* One moving element.
 *
 * `from` is where it waits before the chapter reaches it, `to` is where it
 * goes once the chapter is over, and in between it simply sits at rest. Never
 * positioned itself — a Layer is always the child of a plain absolute box, so
 * that Tailwind's own translate utilities and Motion's transform never end up
 * fighting over the same declaration.
 *
 * `curtain` opens the element out of a horizontal band of its own height
 * instead of fading it in — the reveal the films are given, and the reason a
 * frame arrives looking like a shutter opening rather than like an image
 * loading. It closes a little further than it opened on the way out. */
function Layer({
  stage,
  from = {},
  to = {},
  curtain,
  className,
  children,
}: {
  stage: Stage;
  from?: Pose;
  to?: Pose;
  curtain?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { enter, leave } = stage;
  const x = useShift(enter, leave, from.x ?? 0, to.x ?? 0);
  const y = useShift(enter, leave, from.y ?? 0, to.y ?? 0);
  const scale = useSettle(enter, leave, from.scale ?? 1, to.scale ?? 1);
  const opacity = useSettle(enter, leave, from.opacity ?? 0, to.opacity ?? 0);
  const clipPath = useTransform([enter, leave], ([e, l]: number[]) => {
    const band = (curtain ?? 0) * (1 - e) + (curtain ?? 0) * 1.25 * l;
    return `inset(${band}% 0% ${band}% 0%)`;
  });

  return (
    <motion.div
      className={className}
      style={{
        x,
        y,
        scale,
        opacity,
        clipPath: curtain === undefined ? undefined : clipPath,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────── type ─────────────────────────────── */

/* A headline, set word by word.
 *
 * Each word rises out of a mask no taller than itself, a beat behind the one
 * before it — restrained enough that on a two-line headline the stagger reads
 * as the line settling rather than as an effect. The words are masked
 * individually rather than by line so the copy can wrap wherever the language
 * and the screen put it; nothing here assumes a break.
 *
 * The whole block's exit belongs to its Layer, not to the words — one
 * movement out, however many words went in. */
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
     the last word is up well before the chapter has finished composing. */
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

/* ─────────────────────────────── the films ─────────────────────────── */

/* Whether a motion value is far enough above nought to be worth acting on,
   as a plain boolean. Two thresholds rather than one so a value hovering at
   the edge cannot chatter, and React bails out of the render entirely while
   the answer is unchanged — which is every frame but two per chapter. */
function useLive(value: MotionValue<number>, on = 0.06, off = 0.02) {
  const [live, setLive] = useState(false);

  useMotionValueEvent(value, "change", (v) => {
    setLive((was) => (was ? v > off : v > on));
  });

  return live;
}

/* Archive footage, held in an editorial frame.
 *
 * It plays when its chapter is on the stage and is paused the moment the
 * chapter has gone, so five screens of archive never cost more than one
 * decoding video. Nothing is mounted at all until the section is within reach
 * of the viewport, and the poster frame carries the composition until the
 * first frame is decoded — so a film never arrives as a black rectangle and
 * never shifts the layout when it does arrive. */
function Film({
  src,
  poster,
  alt,
  play,
  mounted,
  className,
}: {
  src: string;
  poster: string;
  alt: string;
  play: boolean;
  mounted: boolean;
  className?: string;
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
      <img
        src={poster}
        alt=""
        className={`img-grade h-full w-full object-cover ${className ?? ""}`}
      />
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
      className={`img-grade h-full w-full object-cover ${className ?? ""}`}
    />
  );
}

/* ─────────────────────── the photographs still to come ─────────────── */

/* 2013, 2019 and 2026 are not in the repository yet.
 *
 * The composition is built for them all the same: each sits in a frame that
 * has no border, no background and no reserved fill, so until the file is
 * dropped into /public/arhiva the frame is simply a piece of empty night. The
 * element starts transparent and is only faded up once the browser confirms
 * it decoded something, and removes itself outright on error — which is what
 * keeps a missing file from ever drawing a broken-image glyph.
 *
 * A plain <img> rather than next/image on purpose: the optimiser answers a
 * missing source with a 400 that would be reported in the console on every
 * load, and it wants intrinsic dimensions for a file that does not exist yet.
 * The moment the three land here they appear in place with no other change. */
function FutureFrame({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<"waiting" | "shown" | "absent">("waiting");

  if (state === "absent") return null;

  return (
    /* See above: the file is deliberately allowed to be missing, which
       next/image has no way of expressing. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={state === "shown" ? alt : ""}
      loading="lazy"
      decoding="async"
      onLoad={() => setState("shown")}
      onError={() => setState("absent")}
      className={`img-grade h-full w-full object-cover transition-opacity duration-1000 ease-out ${
        state === "shown" ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

/* The three sit on three different planes. Read against the distance the page
   travels this is nearly nothing — it is not a parallax so much as the reason
   the typography in the middle of them reads as having air around it. */
function Drift({
  progress,
  amount,
  children,
}: {
  progress: MotionValue<number>;
  amount: number;
  children: React.ReactNode;
}) {
  const y = useTransform(
    progress,
    [SPAN * 2 - CROSS * 2, SPAN * 3 + CROSS * 2],
    [`${amount}%`, `${-amount}%`],
  );

  return (
    <motion.div className="h-full w-full" style={{ y }}>
      {children}
    </motion.div>
  );
}

/* ───────────────────────────── the section ─────────────────────────── */

export function ArchiveJourney() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const wide = useWide();
  const { t } = useLang();

  const progress = useScrollTrack(ref);

  /* Two different questions about the same section. The first decides when
     the films exist at all and never goes back; the second is what stops the
     last of them playing to an empty room after the visitor has scrolled on. */
  const mounted = useInView(ref, { once: true, margin: "700px 0px" });
  const onScreen = useInView(ref);

  const origin = useStage(progress, 0);
  const sound = useStage(progress, 1);
  const years = useStage(progress, 2);
  const nights = useStage(progress, 3);
  const finale = useStage(progress, 4);

  /* The last film is not a chapter's property — it belongs to both of the last
     two. It arrives framed beside "od prvih večeri do danas", and then the
     frame opens out to the full screen and the film becomes the room the
     closing statement is spoken in. One element, two compositions. */
  const filmEnter = useTransform(
    progress,
    [SPAN * 3 - CROSS * 0.95, SPAN * 3 + SPAN * 0.22],
    [0, 1],
  );
  const filmOpen = useTransform(
    progress,
    [SPAN * 4 - CROSS * 1.1, SPAN * 4 + SPAN * 0.3],
    [0, 1],
  );

  const originLive = useLive(origin.life);
  const soundLive = useLive(sound.life);
  const nightLive = useLive(filmEnter);

  if (reduced) return <StillArchive />;

  return (
    <section
      ref={ref}
      aria-label={t("about.caption")}
      className="relative"
      style={{
        height: `calc(100svh + ${wide ? WIDE_TRAVEL : NARROW_TRAVEL}svh)`,
      }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Threads progress={progress} />

        <ChapterOrigin
          stage={origin}
          wide={wide}
          mounted={mounted}
          play={originLive && onScreen}
        />
        <ChapterSound
          stage={sound}
          wide={wide}
          mounted={mounted}
          play={soundLive && onScreen}
        />
        <ChapterYears stage={years} progress={progress} wide={wide} />

        <NightFilm
          enter={filmEnter}
          open={filmOpen}
          wide={wide}
          mounted={mounted}
          play={nightLive && onScreen}
        />
        <ChapterNights stage={nights} wide={wide} />
        <ChapterFinale stage={finale} />

        <Rail progress={progress} />
      </div>
    </section>
  );
}

/* ── 01 · the headline on the left, 1965 on the right ─────────────────── */

function ChapterOrigin({
  stage,
  wide,
  mounted,
  play,
}: {
  stage: Stage;
  wide: boolean;
  mounted: boolean;
  play: boolean;
}) {
  const { t } = useLang();

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {wide ? (
        <>
          <div className="absolute left-[6vw] top-1/2 w-[44vw] -translate-y-1/2">
            <Layer stage={stage} from={{ opacity: 1 }} to={{ x: -11, opacity: 0 }}>
              <h2 className="font-serif uppercase leading-[1.04] tracking-[-0.015em] text-night-ink text-[clamp(2.5rem,5.2vw,6.25rem)]">
                <Words text={t("wall.title1")} enter={stage.enter} />
              </h2>
            </Layer>
          </div>

          <div className="absolute right-[7vw] top-1/2 h-[66vh] w-[26vw] max-w-[26rem] -translate-y-1/2">
            <Layer
              stage={stage}
              curtain={9}
              from={{ opacity: 0, x: 5, scale: 1.04 }}
              to={{ opacity: 0, x: 11, scale: 1 }}
              className="relative h-full w-full overflow-hidden"
            >
              <Film
                src="/arhiva/1965.mp4"
                poster="/arhiva/1965-poster.jpg"
                alt={t("wall.altOrigin")}
                play={play}
                mounted={mounted}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-night/20"
                aria-hidden="true"
              />
            </Layer>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-[6vw] top-[13vh]">
          <Layer stage={stage} from={{ opacity: 1 }} to={{ y: -9, opacity: 0 }}>
            <h2 className="font-serif uppercase leading-[1.06] tracking-[-0.015em] text-night-ink text-[clamp(2rem,9.6vw,3.25rem)]">
              <Words text={t("wall.title1")} enter={stage.enter} />
            </h2>
          </Layer>

          <div className="mt-[4vh] h-[42vh] w-[66vw]">
            <Layer
              stage={stage}
              curtain={9}
              from={{ opacity: 0, y: 5, scale: 1.05 }}
              to={{ opacity: 0, y: -7, scale: 1 }}
              className="relative h-full w-full overflow-hidden"
            >
              <Film
                src="/arhiva/1965.mp4"
                poster="/arhiva/1965-poster.jpg"
                alt={t("wall.altOrigin")}
                play={play}
                mounted={mounted}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-night/20"
                aria-hidden="true"
              />
            </Layer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 02 · and the composition turns over: film left, headline right ──── */

function ChapterSound({
  stage,
  wide,
  mounted,
  play,
}: {
  stage: Stage;
  wide: boolean;
  mounted: boolean;
  play: boolean;
}) {
  const { t } = useLang();

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {wide ? (
        <>
          <div className="absolute left-[7vw] top-1/2 h-[70vh] w-[28vw] max-w-[28rem] -translate-y-1/2">
            <Layer
              stage={stage}
              curtain={10}
              from={{ opacity: 0, x: -9, scale: 1.05 }}
              to={{ opacity: 0, x: -7, scale: 1 }}
              className="relative h-full w-full overflow-hidden"
            >
              <Film
                src="/arhiva/konobari.mp4"
                poster="/arhiva/konobari-poster.jpg"
                alt={t("wall.altStaff")}
                play={play}
                mounted={mounted}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-night/20"
                aria-hidden="true"
              />
            </Layer>
          </div>

          <div className="absolute right-[6vw] top-1/2 w-[42vw] -translate-y-1/2 text-right">
            <Layer stage={stage} from={{ opacity: 1 }} to={{ x: 10, opacity: 0 }}>
              <h2 className="font-serif uppercase leading-[1.04] tracking-[-0.015em] text-night-ink text-[clamp(2.25rem,4.7vw,5.5rem)]">
                <Words text={t("wall.title2")} enter={stage.enter} />
              </h2>
            </Layer>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-[6vw] top-[11vh]">
          <div className="ml-auto h-[40vh] w-[66vw]">
            <Layer
              stage={stage}
              curtain={10}
              from={{ opacity: 0, y: 6, scale: 1.05 }}
              to={{ opacity: 0, y: -6, scale: 1 }}
              className="relative h-full w-full overflow-hidden"
            >
              <Film
                src="/arhiva/konobari.mp4"
                poster="/arhiva/konobari-poster.jpg"
                alt={t("wall.altStaff")}
                play={play}
                mounted={mounted}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-night/20"
                aria-hidden="true"
              />
            </Layer>
          </div>

          <div className="mt-[4vh]">
            <Layer stage={stage} from={{ opacity: 1 }} to={{ y: -9, opacity: 0 }}>
              <h2 className="font-serif uppercase leading-[1.06] tracking-[-0.015em] text-night-ink text-[clamp(1.875rem,9vw,3rem)]">
                <Words text={t("wall.title2")} enter={stage.enter} />
              </h2>
            </Layer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 03 · the hinge, and three photographs scattered around it ────────── */

/* Where the three will hang. Not a grid and not three of anything: three
   different widths, three different aspects, three different heights on the
   stage and three different planes of depth, arranged so that the corridor the
   statement is set in stays clear on either screen. */
type Slot = {
  id: string;
  src: string;
  alt: MessageKey;
  drift: number;
  wide: string;
  narrow: string;
  from: Pose;
};

const SLOTS: Slot[] = [
  {
    id: "2013",
    src: "/arhiva/2013.jpg",
    alt: "wall.alt2013",
    drift: 7,
    wide: "absolute left-[5vw] bottom-[9vh] w-[19vw] max-w-[17rem] aspect-[4/5]",
    narrow: "absolute left-[-4vw] bottom-[15vh] w-[38vw] aspect-[4/5]",
    from: { opacity: 0, y: 14, scale: 1.06 },
  },
  {
    id: "2019",
    src: "/arhiva/2019.jpg",
    alt: "wall.alt2019",
    drift: -4.5,
    wide: "absolute left-[44vw] top-[4vh] w-[15vw] max-w-[13rem] aspect-[5/4]",
    narrow: "absolute right-[3vw] top-[7vh] w-[34vw] aspect-[5/4]",
    from: { opacity: 0, y: -12, scale: 1.05 },
  },
  {
    id: "2026",
    src: "/arhiva/2026.jpg",
    alt: "wall.alt2026",
    drift: 11,
    wide: "absolute right-[4vw] bottom-[15vh] w-[24vw] max-w-[22rem] aspect-[3/2]",
    narrow: "absolute right-[-3vw] bottom-[9vh] w-[40vw] aspect-[3/2]",
    from: { opacity: 0, y: 16, scale: 1.06 },
  },
];

function ChapterYears({
  stage,
  progress,
  wide,
}: {
  stage: Stage;
  progress: MotionValue<number>;
  wide: boolean;
}) {
  const { t } = useLang();

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {SLOTS.map((slot) => (
        <div key={slot.id} className={wide ? slot.wide : slot.narrow}>
          <Layer
            stage={stage}
            curtain={12}
            from={slot.from}
            to={{ opacity: 0, y: -9, scale: 1 }}
            className="relative h-full w-full overflow-hidden"
          >
            <Drift progress={progress} amount={slot.drift}>
              <FutureFrame src={slot.src} alt={t(slot.alt)} />
            </Drift>
          </Layer>
        </div>
      ))}

      {/* The statement sits above the photographs, and a soft pool of night
          under it keeps it legible whatever the three turn out to be. */}
      <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-[6vw] text-center">
        <Layer
          stage={stage}
          from={{ opacity: 1, scale: 0.955 }}
          to={{ opacity: 0, scale: 0.94 }}
        >
          <p className="font-serif uppercase leading-[1.02] tracking-[-0.01em] text-night-ink text-[clamp(2rem,12vw,3rem)] md:text-[clamp(3rem,6.6vw,9rem)]">
            <Words text={t("about.p3a")} enter={stage.enter} />
          </p>
          <p className="mt-1 font-serif uppercase leading-[1.02] tracking-[-0.01em] text-night-ink/60 text-[clamp(2rem,12vw,3rem)] md:mt-3 md:text-[clamp(3rem,6.6vw,9rem)]">
            <Words text={t("about.p3b")} enter={stage.enter} />
          </p>

          <div className="mt-8 flex justify-center md:mt-12">
            <GrandClubSignature size="sm" tone="light" className="opacity-40" />
          </div>
        </Layer>
      </div>
    </div>
  );
}

/* ── 04 · the film opens, and 05 · the room it leaves behind ──────────── */

/* The frame the last film is held in, and the screen it becomes.
 *
 * Four numbers, in the order clip-path takes them. On a wide screen the frame
 * is a full-height column down the right of the stage; on a phone it is the
 * lower two thirds. Both start pinched in from top and bottom — the shutter —
 * and both end as the whole screen. */
const CLOSED_WIDE = [22, 4, 22, 42];
const FRAMED_WIDE = [0, 4, 0, 42];
const CLOSED_NARROW = [45, 5, 14, 5];
const FRAMED_NARROW = [33, 5, 0, 5];
const OPEN = [0, 0, 0, 0];

const mix = (a: number[], b: number[], t: number) =>
  a.map((v, i) => v + (b[i] - v) * t);

function NightFilm({
  enter,
  open,
  wide,
  mounted,
  play,
}: {
  enter: MotionValue<number>;
  open: MotionValue<number>;
  wide: boolean;
  mounted: boolean;
  play: boolean;
}) {
  const { t } = useLang();

  const closed = wide ? CLOSED_WIDE : CLOSED_NARROW;
  const framed = wide ? FRAMED_WIDE : FRAMED_NARROW;

  const clipPath = useTransform([enter, open], ([e, o]: number[]) => {
    const box = mix(mix(closed, framed, e), OPEN, o);
    return `inset(${box[0]}% ${box[1]}% ${box[2]}% ${box[3]}%)`;
  });

  /* Held tight and pushed a little off centre while it is a column, then
     allowed out to its true size as it becomes the room. */
  const scale = useTransform(
    [enter, open],
    ([e, o]: number[]) => 1.18 - 0.04 * e - 0.14 * o,
  );
  const x = useTransform(open, (o) =>
    wide ? `${(1 - o) * 6}%` : `${(1 - o) * 2}%`,
  );
  const opacity = useTransform(
    [enter, open],
    ([e, o]: number[]) => e * (1 - o * 0.6),
  );

  /* The scrim under the fourth chapter's headline, gone by the time the
     headline is; and the vignette that takes its place so the closing
     statement has something to sit on. */
  const scrim = useTransform(open, [0, 0.55], [1, 0]);
  const vignette = useTransform(open, [0.15, 1], [0, 1]);

  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ clipPath, opacity, willChange: "clip-path, opacity" }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ x, scale, willChange: "transform" }}
        >
          <Film
            src="/arhiva/zurka.mp4"
            poster="/arhiva/zurka-poster.jpg"
            alt={t("wall.altNight")}
            play={play}
            mounted={mounted}
          />
        </motion.div>

        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-night via-night/45 to-transparent md:bg-gradient-to-r md:from-night md:via-night/30"
          style={{ opacity: scrim }}
          aria-hidden="true"
        />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          opacity: vignette,
          background:
            "radial-gradient(78% 74% at 50% 48%, rgba(8,5,13,0.62) 0%, rgba(8,5,13,0.88) 60%, rgba(8,5,13,0.96) 100%)",
        }}
        aria-hidden="true"
      />
    </>
  );
}

function ChapterNights({ stage, wide }: { stage: Stage; wide: boolean }) {
  const { t } = useLang();

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {wide ? (
        <div className="absolute bottom-[16vh] left-[5vw] w-[38vw]">
          <Layer stage={stage} from={{ opacity: 1 }} to={{ y: -14, opacity: 0 }}>
            <h2 className="font-serif uppercase leading-[1.05] tracking-[-0.015em] text-night-ink text-[clamp(2rem,4.3vw,5rem)]">
              <Words text={t("wall.title3")} enter={stage.enter} />
            </h2>
          </Layer>
        </div>
      ) : (
        <div className="absolute inset-x-[6vw] top-[9vh]">
          <Layer stage={stage} from={{ opacity: 1 }} to={{ y: -14, opacity: 0 }}>
            <h2 className="font-serif uppercase leading-[1.06] tracking-[-0.015em] text-night-ink text-[clamp(1.75rem,8.4vw,2.75rem)]">
              <Words text={t("wall.title3")} enter={stage.enter} />
            </h2>
          </Layer>
        </div>
      )}
    </div>
  );
}

/* ── 05 · what the whole thing was for ───────────────────────────────── */

function ChapterFinale({ stage }: { stage: Stage }) {
  const { t } = useLang();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-[6vw]">
      <Layer
        stage={stage}
        from={{ opacity: 1, scale: 0.965 }}
        className="w-full text-center"
      >
        <h2 className="font-serif uppercase leading-[1.0] tracking-[-0.01em] [text-shadow:0_0_90px_rgba(8,5,13,0.9)] text-[clamp(2.5rem,13.5vw,4rem)] md:text-[clamp(3rem,7.4vw,9rem)]">
          <span className="block text-night-ink">
            <Words text={t("story.sameEnergy")} enter={stage.enter} />
          </span>
          <span className="mt-1 block text-gold-light/90 md:mt-2">
            <Words text={t("story.newGeneration")} enter={stage.enter} />
          </span>
        </h2>
      </Layer>
    </div>
  );
}

/* ─────────────────────── the threads behind all of it ──────────────── */

/* One field, drawn once, for the whole archive.
 *
 * A family of long contours across the full stage — a topographic map, the
 * grooves of a record and the trace of a level meter are all the same drawing,
 * and this is it. They belong to the pinned stage rather than to any chapter,
 * so nothing about them restarts at a hand-over: the thread crossing behind
 * 1965 is still the thread crossing behind tonight, which is most of what
 * stops five chapters reading as five slides.
 *
 * The field drifts by a few percent across the entire archive — read against
 * four screens of scrolling that is nearly nothing, which is the point. It is
 * not a parallax, it is the difference between a drawing and a drawing that is
 * alive. Under it the air changes: grey at 1965, the violet the club is lit by
 * from about half way, with three slow blooms toward the end. A gradient and
 * three radials, no filters. */
function Threads({ progress }: { progress: MotionValue<number> }) {
  const x = useTransform(progress, [0, 1], ["0%", "-3.2%"]);
  const y = useTransform(progress, [0, 1], ["0%", "2.6%"]);
  const violet = useTransform(progress, [0.16, 0.68], [0, 1]);
  const blooms = useTransform(progress, [0.42, 0.92], [0, 1]);

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

      <motion.svg
        className="absolute left-[-7%] top-[-7%] h-[114%] w-[114%]"
        style={{ x, y }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {THREADS.map((thread, i) => (
          <path
            key={i}
            d={trace(thread.through)}
            stroke={`rgba(${thread.tone === "champagne" ? "206,184,146" : "226,220,208"},${PLANES[thread.plane]})`}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Two grooves, oversized past the point of being read as a record. */}
        <ellipse
          cx="24"
          cy="50"
          rx="46"
          ry="62"
          stroke="rgba(226,220,208,0.06)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="80"
          cy="46"
          rx="54"
          ry="74"
          stroke="rgba(206,184,146,0.085)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>

      <motion.div className="absolute inset-0" style={{ opacity: blooms }}>
        {[
          { left: "16%", top: "24%", size: "58vh", tone: "rgba(90,36,124,0.30)" },
          { left: "78%", top: "68%", size: "46vh", tone: "rgba(200,164,93,0.10)" },
          { left: "62%", top: "16%", size: "66vh", tone: "rgba(112,42,150,0.24)" },
        ].map((bloom, i) => (
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

/* THREE PLANES, so the field has depth rather than being one flat mesh. The
   near threads carry the composition, the middle ones fill behind them, and
   the far ones are barely there — which is what stops eleven lines from ever
   massing into texture. Champagne and a warm grey alternate without pattern:
   muted, never the house gold, because gold at this width would be a graphic
   rather than an atmosphere. */
const PLANES = { near: 0.2, mid: 0.12, far: 0.07 } as const;

type Thread = {
  plane: keyof typeof PLANES;
  tone: "champagne" | "grey";
  /* [x, y], both as percentages of the field. None of them begins or ends
     inside the frame: every line is something passing through rather than
     something drawn here. */
  through: [number, number][];
};

const THREADS: Thread[] = [
  /* the long shallow one across the upper third, barely leaving its lane */
  {
    plane: "near",
    tone: "champagne",
    through: [
      [-6, 26],
      [18, 31],
      [42, 24],
      [66, 33],
      [88, 27],
      [107, 34],
    ],
  },
  /* the big climb: low at 1965, high by tonight */
  {
    plane: "near",
    tone: "grey",
    through: [
      [-5, 78],
      [22, 64],
      [50, 47],
      [78, 33],
      [106, 22],
    ],
  },
  /* and its opposite, which crosses it around the turn of the story */
  {
    plane: "near",
    tone: "champagne",
    through: [
      [-5, 20],
      [26, 38],
      [54, 55],
      [82, 68],
      [106, 80],
    ],
  },
  /* a high near-horizontal, close to the top edge */
  {
    plane: "mid",
    tone: "champagne",
    through: [
      [-4, 14],
      [30, 16],
      [62, 13],
      [105, 17],
    ],
  },
  /* a slow valley through the middle of the stage */
  {
    plane: "mid",
    tone: "grey",
    through: [
      [-5, 44],
      [24, 55],
      [52, 58],
      [80, 50],
      [106, 41],
    ],
  },
  /* a shallow arc under it, out of step on purpose */
  {
    plane: "mid",
    tone: "grey",
    through: [
      [-4, 62],
      [34, 57],
      [68, 62],
      [105, 56],
    ],
  },
  /* the one that runs right along the top, almost off the stage */
  {
    plane: "mid",
    tone: "champagne",
    through: [
      [-5, 7],
      [30, 4],
      [66, 9],
      [106, 5],
    ],
  },
  /* three far threads, low and quiet, holding the floor of the composition */
  {
    plane: "far",
    tone: "grey",
    through: [
      [-6, 88],
      [30, 82],
      [64, 86],
      [106, 79],
    ],
  },
  {
    plane: "far",
    tone: "champagne",
    through: [
      [-6, 36],
      [40, 38],
      [86, 35],
      [107, 37],
    ],
  },
  {
    plane: "far",
    tone: "grey",
    through: [
      [-5, 70],
      [36, 74],
      [72, 70],
      [106, 74],
    ],
  },
  /* one long fall from the top edge to the floor, the widest gesture here */
  {
    plane: "far",
    tone: "champagne",
    through: [
      [-5, 2],
      [30, 24],
      [62, 52],
      [88, 76],
      [106, 94],
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
function trace(through: [number, number][]) {
  let d = `M ${through[0][0].toFixed(1)} ${through[0][1].toFixed(2)}`;

  for (let i = 0; i < through.length - 1; i += 1) {
    const back = through[i - 1] ?? through[i];
    const from = through[i];
    const to = through[i + 1];
    const on = through[i + 2] ?? to;

    const c1 = [
      from[0] + (to[0] - back[0]) / 6,
      from[1] + (to[1] - back[1]) / 6,
    ];
    const c2 = [to[0] - (on[0] - from[0]) / 6, to[1] - (on[1] - from[1]) / 6];

    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(2)}, ${to[0].toFixed(1)} ${to[1].toFixed(2)}`;
  }

  return d;
}

/* ──────────────────────────── the timeline ─────────────────────────── */

/* How far through the archive the visitor has walked.
 *
 * A hairline across the foot of the stage with a small gold tick on it, and
 * nothing else — no dates, no percentage, nothing that turns it back into a
 * measuring device. It belongs to the pinned stage, so it arrives and leaves
 * with it, and it fades at both ends so the pin never begins or releases on a
 * visible instrument. */
function Rail({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.035, 0.965, 1], [0, 1, 1, 0]);
  const left = useTransform(progress, (p) => `${p * 100}%`);

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-x-0 bottom-[4vh] z-30 flex justify-center"
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

/* Reduced motion: the same five chapters, the same order, set down the page.
   No pin, no scrubbing, no parallax — and no reveals either, because the
   visitor asked for none. The films keep their posters and their controls
   rather than playing themselves. */
function StillArchive() {
  const { t } = useLang();

  return (
    <section aria-label={t("about.caption")} className="container-x py-[12vh]">
      <div className="mx-auto max-w-[44rem] space-y-[9vh]">
        <StillChapter title={t("wall.title1")}>
          <StillFilm
            src="/arhiva/1965.mp4"
            poster="/arhiva/1965-poster.jpg"
            alt={t("wall.altOrigin")}
            ratio="aspect-[3/4]"
          />
        </StillChapter>

        <StillChapter title={t("wall.title2")}>
          <StillFilm
            src="/arhiva/konobari.mp4"
            poster="/arhiva/konobari-poster.jpg"
            alt={t("wall.altStaff")}
            ratio="aspect-[3/4]"
          />
        </StillChapter>

        <div>
          <p className="font-serif text-[clamp(1.75rem,7vw,3.5rem)] uppercase leading-[1.05] text-night-ink">
            {t("about.p3a")}
          </p>
          <p className="font-serif text-[clamp(1.75rem,7vw,3.5rem)] uppercase leading-[1.05] text-night-ink/60">
            {t("about.p3b")}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {SLOTS.map((slot) => (
              <div key={slot.id} className="aspect-[4/5] overflow-hidden">
                <FutureFrame src={slot.src} alt={t(slot.alt)} />
              </div>
            ))}
          </div>
        </div>

        <StillChapter title={t("wall.title3")}>
          <StillFilm
            src="/arhiva/zurka.mp4"
            poster="/arhiva/zurka-poster.jpg"
            alt={t("wall.altNight")}
            ratio="aspect-[9/14]"
          />
        </StillChapter>

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

function StillChapter({
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
