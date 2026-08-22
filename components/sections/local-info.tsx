"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useLenis } from "lenis/react";
import { useScrollTrack } from "@/components/story/use-scroll-track";
import { Arrow } from "@/components/arrow";
import { SectionWord } from "@/components/section-word";
import { LightLeaks } from "@/components/light-leaks";
import {
  IntroAsking,
  IntroRooms,
  StillIntro,
  WORDS_VH,
} from "@/components/local-info/info-intro";
import { InfoGrid } from "@/components/local-info/info-grid";
import { useLang } from "@/components/providers/language";

/* The concierge — the last room on the home page, and the only one that is
   about the town rather than the club.
 *
 * ONE SCENE, NOT TWO. The six questions and the six pictures used to be an
 * intro and then a section under it, and it read as exactly that: a thing
 * ended, and another thing began below it. They are now the two halves of a
 * single pinned scene. The track is long enough to hold the questions AND the
 * handover, and for the whole of it the same screen-high child is stuck to the
 * top of the viewport with both halves inside it — so the grid does not arrive
 * from further down the page, it arrives INTO the screen the last question is
 * still standing in.
 *
 * The track therefore reads as three phases, all off one progress value:
 *
 *   0 → WORDS_END   the six questions, exactly as they were
 *   WORDS_END → 1   the handover: the question leaves, the rooms go down into
 *                   the night, and the grid assembles a row at a time
 *   past 1          the pin lets go and the whole scene scrolls away, the rows
 *                   passing the middle of the screen on the way out and the
 *                   live depth wave playing over them as they do
 *
 * There is one grid. It is not duplicated below and there is nothing below —
 * the section ends where the track does. */

/* How much scroll the handover gets, in screens.
 *
 * Two thirds of one. It was nearly double that, and the extra bought nothing:
 * a row's arrival is a seventy-pixel rise, and giving it two fifths of a screen
 * of scroll to do it in only meant a lot of scroll during which very little
 * happened. What it cost was the way back — every screen of handover is a
 * screen to climb back through, and the climb was most of the complaint.
 *
 * Two thirds still leaves each row about a fifth of a screen to itself, which
 * is unhurried at any scroll speed, and the phases are packed so that almost
 * none of it is dead: the last row lands at 0.96 of the way through. */
const HANDOVER_VH = 64;

/* Where the questions end and the handover begins, as a share of the track. */
const WORDS_END = WORDS_VH / (WORDS_VH + HANDOVER_VH);

export function LocalInfo() {
  const { t } = useLang();
  const reduced = useReducedMotion();

  /* The track, and the screen-high child stuck inside it. The grid measures
     both: the pin's geometry is what tells it where its rows actually are on
     screen at a given scroll position, which is not something that can be read
     off the document once an element has started sticking. */
  const track = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);

  const progress = useScrollTrack(track);

  /* The two phases, each rescaled to its own nought-to-one so that everything
     downstream can be written against a full range and none of it has to know
     where the split falls. */
  const asked = useTransform(progress, [0, WORDS_END], [0, 1]);
  const handover = useTransform(progress, [WORDS_END, 1], [0, 1]);

  const lenis = useLenis();

  /* ─────────────── THE STORY IS TOLD ONCE, AND THEN IT IS OVER ───────────────
   *
   * A scroll story is symmetric by construction, and that is the whole problem
   * with it: six screens of questions read beautifully going down and are six
   * screens of nothing to climb coming back. Making the reverse cheaper only
   * ever gets so far. So it is not made cheaper — it is REMOVED.
   *
   * The moment the grid has finished arriving, the track's five-thousand-odd
   * pixels of pinned scroll are taken out of the document altogether and the
   * scene drops into ordinary flow, still exactly one screen high with the six
   * pictures in it. From then on this is a normal section: scroll up and you go
   * to the room above it, scroll down and you carry on. The questions do not
   * come back, because there is no longer any scroll distance for them to live
   * in. A reload starts a new session and tells the story again.
   *
   * NOTHING MOVES WHEN IT HAPPENS. Collapsing the track shortens the document
   * by exactly the pinned distance, so everything below it rises by that much;
   * the scroll position is moved down by the same amount in the same
   * synchronous block, and the two cancel. `flushSync` is what makes it one
   * block — React commits the shorter document, and the scroll is corrected
   * before the browser has had a chance to paint either. The visitor sees the
   * frame they were already looking at.
   *
   * IT IS WATCHED FOR GEOMETRICALLY, off a plain scroll listener, and not off
   * the section's own progress value. That value is mirrored onto Motion's
   * frameloop and it emits when it emits: a fast flick, a restored scroll
   * position, a browser that has throttled the loop, and the run of
   * intermediate values simply is not there — the first thing the handler ever
   * sees is `1`, with no history to tell it whether the story was read or
   * merely skipped past. A single subtraction against the track's own box has
   * no such gap in it. The listener is passive, does two comparisons, and takes
   * itself off the moment it has fired. */
  const [told, setTold] = useState(false);
  const latched = useRef(false);

  useEffect(() => {
    if (reduced || told) return;

    const settle = () => {
      if (latched.current) return;

      const node = track.current;
      if (!node) return;
      const box = node.getBoundingClientRect();

      /* Everything the track holds beyond the one screen the scene stands in.
         If there is none, there is no story and nothing to collapse. */
      const pinned = box.height - window.innerHeight;
      if (pinned <= 1) return;

      /* The pin has let go exactly when the track's foot reaches the foot of
         the screen. That is the last frame of the handover, and the grid is
         standing in the scene complete. */
      if (box.bottom > window.innerHeight + 1) return;

      latched.current = true;
      const held = Math.max(0, window.scrollY - pinned);

      flushSync(() => setTold(true));

      /* Lenis owns this scroll position, so Lenis is the one told about it —
         left to itself it would still be animating toward the old number and
         would haul the page back up on its next frame. */
      lenis?.resize();
      if (lenis) lenis.scrollTo(held, { immediate: true, force: true });
      else window.scrollTo(0, held);
    };

    window.addEventListener("scroll", settle, { passive: true });
    /* And once now, on a microtask, for a page restored below the section: the
       story is already behind that visitor and the section should be a section
       rather than five thousand pixels of climb. */
    queueMicrotask(settle);

    return () => window.removeEventListener("scroll", settle);
  }, [reduced, told, lenis]);

  /* Told, or never going to be told: either way the grid is simply present. */
  const over = told || reduced;

  const settled = useMotionValue(1);
  const enter = over ? settled : handover;

  /* Back to the first question, on the page's own smooth scrolling rather than
     on a jump — the whole point is that nothing teleports. Lenis is the root
     scroller here, so it has to be the one asked; `window.scrollTo` would be
     fighting it for the same scroll position. The native call is kept only for
     the case where the provider is not there to ask. */
  const toStart = useCallback(() => {
    const node = track.current;
    if (!node) return;
    if (lenis) {
      lenis.scrollTo(node, { duration: 1.4 });
      return;
    }
    window.scrollTo({
      top: node.getBoundingClientRect().top + window.scrollY,
      behavior: "smooth",
    });
  }, [lenis]);

  return (
    <section
      id="info"
      aria-labelledby="info-title"
      className="relative isolate scroll-mt-20 bg-night text-night-ink"
    >
      <h2 id="info-title" className="sr-only">
        {t("info.heading")}
      </h2>

      {/* The track carries the pinned distance only while there is a story
          left to tell. Once it is told the height comes off and the section is
          worth exactly the screen the grid stands on. */}
      <div
        ref={track}
        className="relative"
        style={
          over
            ? undefined
            : { height: `calc(100svh + ${WORDS_VH + HANDOVER_VH}vh)` }
        }
      >
        <div
          ref={scene}
          className={
            reduced
              ? "relative overflow-hidden py-24 md:py-32"
              : told
                ? "relative h-[100svh] overflow-hidden bg-night"
                : "sticky top-0 h-[100svh] overflow-hidden bg-night"
          }
        >
          {reduced && <StillIntro />}

          {/* The rooms and the questions exist only for the telling. When it
              is over they are not faded out — they are gone, which is also
              exactly what the last frame of the handover looked like: the night
              had already closed over the last room. */}
          {!over && (
            <>
              <IntroRooms progress={asked} dim={handover} />
              <IntroAsking progress={asked} exit={handover} />
            </>
          )}

          {/* THE GRID IS THE SECOND HALF OF THE SAME SCREEN. Laid over the
              rooms rather than under them, and centred, so that when the
              question has gone the six pictures are what the screen is. */}
          <div
            className={
              reduced
                ? "relative z-20 mt-16"
                : "absolute inset-0 z-20 flex flex-col justify-center"
            }
          >
            {/* The room the grid stands in, and it arrives with the grid.
                Left ungated it sits behind the six questions the whole way
                down, and INĐIJA reading through KAKO DO NAS? is the one thing
                that would give away that these were ever two sections. */}
            <Backdrop enter={enter} />

            <Rail
              enter={enter}
              back={t("info.restart")}
              onBack={told ? undefined : toStart}
            />

            <div className="relative z-10 mt-8 md:mt-10">
              <InfoGrid
                enter={enter}
                scene={scene}
                still={reduced}
                settled={over}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* INĐIJA standing in the dark, and the house lamps behind it. */
function Backdrop({
  enter,
}: {
  enter: ReturnType<typeof useMotionValue<number>>;
}) {
  const opacity = useTransform(enter, [0.14, 0.5], [0, 1]);

  return (
    <motion.div style={{ opacity }} className="absolute inset-0">
      <SectionWord word="Inđija" speed={0.72} />
      <LightLeaks intensity="soft" fadeOut />
    </motion.div>
  );
}

/* The line over the grid, and the only thing left on it is the way back.
 *
 * It used to open with a caption — a small gold VODIČ KROZ NOĆ over the first
 * row. The six pictures say what they are, and a label over them only told the
 * visitor a second time; the grid now starts on the cards themselves. What is
 * left is a control rather than a heading, so it sits at the end of the line
 * on its own, and when there is no longer a start to go back to the line does
 * not render at all — an empty rail above the grid would leave exactly the gap
 * the caption used to fill. */
function Rail({
  enter,
  back,
  onBack,
}: {
  enter: ReturnType<typeof useMotionValue<number>>;
  back: string;
  /* Absent once the story is told: there is no longer a start to go back to. */
  onBack?: () => void;
}) {
  const opacity = useTransform(enter, [0.2, 0.46], [0, 1]);
  const y = useTransform(enter, [0.2, 0.46], [18, 0]);

  if (!onBack) return null;

  return (
    <motion.div style={{ opacity, y }} className="relative z-10 container-x">
      <div className="mx-auto flex max-w-[1240px] items-baseline justify-end gap-6">
        {/* The way back to the first question, for anyone who would rather not
            climb. A real button, because it does something rather than going
            somewhere, and still set at the weight the caption was, so it reads
            as a line of the design rather than as a control laid over it. */}
        <button
          type="button"
          onClick={onBack}
          className="group flex shrink-0 items-center gap-2 text-[0.5625rem] uppercase tracking-[0.24em] text-gold/65 outline-none transition-colors duration-300 hover:text-gold-light focus-visible:text-gold-light sm:text-[0.625rem]"
        >
          <Arrow className="w-4 rotate-180 transition-[width] duration-500 group-hover:w-6 group-focus-visible:w-6" />
          {back}
        </button>
      </div>
    </motion.div>
  );
}
