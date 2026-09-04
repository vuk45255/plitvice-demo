"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
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
import { INFO, infoHref } from "@/lib/local-info";

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

/* WHERE THE SCENE STOPS BEING A QUESTION AND STARTS BEING A GRID, as a share
   of the handover — and therefore which of the two takes a click.

   Read off what is actually on the screen at that point rather than picked: at
   0.7 of the handover the question is down to a tenth of its opacity (it
   leaves across 0.2 → 0.78, see IntroAsking) and the first two rows of cards
   are fully in. Before it, the question is what the visitor is looking at and
   the whole scene is a door onto that category; after it, the cards are what
   they are looking at and each card is its own door, exactly as it always was.
   There is never a moment when both are live, and never one when neither is. */
const HANDED_OVER = 0.7;

/* And what separates a tap from a scroll. A press that moves less than this
   many pixels, lasts less than this many milliseconds, and does not take the
   page with it, is somebody pointing at the screen; anything else is somebody
   moving the page and must never navigate. */
const TAP_SLOP = 10;
const TAP_MS = 700;
const TAP_SCROLL = 12;

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

  /* ───────────── WHICH QUESTION IS ON THE SCREEN, ASKED ONCE ─────────────
   *
   * THERE IS EXACTLY ONE ANSWER TO THIS AND EVERYTHING READS IT.
   *
   * The six words are drawn straight off `asked` — see `stops` in
   * info-intro.tsx — and a word owns the slot between i/n and (i+1)/n, handing
   * over in a short window centred on the boundary. So the word on screen is
   * the floor of the progress times six, and that same number is what the door
   * below navigates to. There is no second index anywhere, nothing counting
   * slides, and nothing that can be one behind: the thing that decides what is
   * painted is the thing that decides where a click goes.
   *
   * It is kept out of React until it changes. The progress value moves on
   * every frame the story is being read; this enters React five times across
   * the whole pass. */
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  useMotionValueEvent(asked, "change", (p) => {
    const at = Math.min(INFO.length - 1, Math.max(0, Math.floor(p * INFO.length)));
    if (at === activeRef.current) return;
    activeRef.current = at;
    setActive(at);
  });

  /* And whether the grid has taken the screen over from the question — the one
     switch that decides which of the two is the door. Watched on `handover`
     rather than on `enter` below, because `enter` is swapped for a constant
     once the story is told and a constant never emits. */
  const [handed, setHanded] = useState(false);
  const handedRef = useRef(false);

  useMotionValueEvent(handover, "change", (e) => {
    const now = e >= HANDED_OVER;
    if (now === handedRef.current) return;
    handedRef.current = now;
    setHanded(now);
  });

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

  /* The tiles' own pointer switch, off the same value everything else in the
     grid is drawn from. See where it is applied, below. */
  const cards = useTransform(enter, (e) =>
    e >= HANDED_OVER ? "auto" : "none",
  );

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
        {/* WHERE THE SIX PAGES COME BACK TO.
         *
         * `#info` is the section, and the section BEGINS with five thousand
         * pixels of pinned questions — so a visitor returning from
         * /info/restorani would land on the first question and have to read
         * the whole story again to reach the cards they were just looking at.
         *
         * This is the last frame of the pin instead: a box exactly one screen
         * tall, pinned to the foot of the track, whose top edge sits at the
         * scroll position where the grid has finished assembling. An anchor to
         * it puts that frame at the top of the viewport, which is the six
         * pictures, complete. When the story has been told and the track has
         * collapsed it spans the scene itself and lands in the same place.
         *
         * It has no height of its own and nothing in it — it exists to be a
         * scroll target and for no other reason. */}
        <div
          id="info-cards"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[100svh]"
          aria-hidden="true"
        />
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

              {/* THE SCENE IS A DOOR ONTO THE QUESTION STANDING IN IT.
                  Above the rooms and the type, below the grid — and it exists
                  only while the question is the thing on the screen. */}
              {!handed && <SceneDoor index={active} />}

              {/* And the one line that says so. It takes no pointer of its
                  own, ever: it is a sign, not a control. */}
              <SceneCue exit={handover} />
            </>
          )}

          {/* THE GRID IS THE SECOND HALF OF THE SAME SCREEN. Laid over the
              rooms rather than under them, and centred, so that when the
              question has gone the six pictures are what the screen is.
           *
           * THE COLUMN ITSELF TAKES NOTHING. It is a screen-high box laid over
           * the whole scene, so with a pointer of its own it is a lid: the
           * question underneath cannot be clicked and the click lands on
           * nothing at all. What is inside it says for itself when it is a
           * control — the rail when it can be seen, the tiles when they have
           * arrived — and a child may always take a pointer its parent has
           * refused. */}
          <div
            className={
              reduced
                ? "pointer-events-none relative z-20 mt-16"
                : "pointer-events-none absolute inset-0 z-20 flex flex-col justify-center"
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

            {/* THE CARDS ARE ONLY A DOOR ONCE THEY ARE A CARD.
             *
             * This is where clicking the guide used to go wrong. The six tiles
             * are laid over the whole pinned scene for the entire story, and
             * for almost all of it they are at nought opacity — which is
             * invisible and still perfectly clickable. So a click anywhere on
             * the scene, while SMEŠTAJ or RESTORANI was on the screen, was
             * taken by whichever tile the pointer happened to be over, and the
             * visitor was sent to a category they had never seen.
             *
             * The tiles now take a pointer only from the moment they are what
             * the screen is. It is a motion value rather than state so the
             * switch costs no render at all, and `enter` is a constant 1 once
             * the story is told, which leaves the settled grid exactly as
             * interactive as it has always been. */}
            <motion.div
              style={{ pointerEvents: cards }}
              className="relative z-10 mt-8 md:mt-10"
            >
              <InfoGrid
                enter={enter}
                scene={scene}
                still={reduced}
                settled={over}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── THE SCENE, AS SOMETHING TO OPEN ───────────────────
 *
 * A real link to a real address, so it opens in a new tab with the middle
 * button, shows the visitor where it goes in the status bar, is a stop on the
 * Tab key, and works from the keyboard with no handler at all. Where it goes
 * is `active`, which is the same number the word on screen is drawn from —
 * there is no chance of the two disagreeing because there is only one of them.
 *
 * ─── AND A SWIPE IS NOT A TAP ─────────────────────────────────────────────
 *
 * This covers the screen, on a page whose whole point is that it is scrolled
 * through. So the one thing it must never do is turn a finger dragging the
 * page into a navigation.
 *
 * Nothing here touches the scroll. There is no `preventDefault` on a touchmove
 * or a wheel anywhere in this file, no `touch-action` that would take the
 * gesture off the compositor, and no listener bound to the page: a finger
 * scrolls this exactly as it scrolls the rest of the site, and the browser
 * never has to ask the main thread for permission. What is measured is the
 * press itself, at the two ends of it —
 *
 *   how far the pointer moved     a drag, however slow, is not a tap
 *   how long it was held          a press is not a click
 *   how far the PAGE moved        momentum under a stationary finger is the
 *                                 case a movement threshold cannot catch, and
 *                                 it is the one that sends people to the wrong
 *                                 page on a phone
 *
 * — and if any of the three says the visitor was scrolling, the click is
 * simply not honoured. A wheel or a trackpad never produces a click in the
 * first place.
 *
 * A click with no press behind it is the keyboard, and it goes through
 * untouched. */
function SceneDoor({ index }: { index: number }) {
  const { t } = useLang();
  const category = INFO[index];
  const from = useRef<{
    x: number;
    y: number;
    at: number;
    scroll: number;
  } | null>(null);

  const press = (event: React.PointerEvent) => {
    from.current = {
      x: event.clientX,
      y: event.clientY,
      at: event.timeStamp,
      scroll: window.scrollY,
    };
  };

  const abandon = () => {
    from.current = null;
  };

  const open = (event: React.MouseEvent) => {
    const start = from.current;
    from.current = null;

    /* Enter on the focused link: no pointer, nothing to second-guess. */
    if (!start) return;

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const held = event.timeStamp - start.at;
    const travelled = Math.abs(window.scrollY - start.scroll);

    if (moved > TAP_SLOP || held > TAP_MS || travelled > TAP_SCROLL) {
      event.preventDefault();
    }
  };

  return (
    <Link
      href={infoHref(category)}
      aria-label={`${t("info.open")} ${t(category.name)}`}
      onPointerDown={press}
      onPointerCancel={abandon}
      onDragStart={abandon}
      onClick={open}
      /* The ring is the only thing this element ever draws, and only for a
         keyboard. `touch-action` is deliberately left alone; the callout and
         the tap flash are not, because a full-screen link would otherwise
         grey the whole scene under every scrolling finger. */
      className="absolute inset-0 z-[15] outline-none ring-inset ring-gold/0 focus-visible:ring-1 focus-visible:ring-gold/45 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
    />
  );
}

/* ───────────────────────── the sign in the corner ─────────────────────────
 *
 * What the scene cannot say for itself: that it goes on downward, and that the
 * question standing in it can be opened. One rail, one hairline, one chevron,
 * set low on the left where there is nothing else — clear of the word in the
 * middle of the screen, clear of the bar at the top, and clear of the bottom
 * of a phone, its own inset included.
 *
 * IT TAKES NO POINTER. It is over the door, so anything else would be a strip
 * of the scene that does not open, and a strip of a phone that does not
 * scroll.
 *
 * The movement is six pixels down and back over five seconds, which is barely
 * a movement — it is there to say the direction, not to attract attention. It
 * goes out with the question, and it never runs at all when the visitor has
 * asked for less of it. */
function SceneCue({ exit }: { exit: MotionValue<number> }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const opacity = useTransform(exit, [0, 0.22], [1, 0]);

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute bottom-0 left-0 z-30 select-none pb-[max(1.75rem,env(safe-area-inset-bottom))] pl-6 md:pb-12 md:pl-12 xl:pl-20"
      aria-hidden="true"
    >
      <div className="flex flex-col items-start gap-3 md:gap-4">
        <span className="text-[0.5rem] uppercase leading-none tracking-[0.36em] text-gold/55 md:text-[0.5625rem] md:tracking-[0.42em]">
          {t("info.cueScroll")}
        </span>

        <motion.span
          className="flex flex-col items-center gap-1.5"
          animate={
            reduced
              ? undefined
              : { y: [0, 6, 0], opacity: [0.55, 1, 0.55] }
          }
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="block h-8 w-px bg-gradient-to-b from-gold/55 to-transparent md:h-12" />
          <svg
            viewBox="0 0 12 8"
            fill="none"
            className="h-1.5 w-2.5 text-gold/55 md:h-2 md:w-3"
          >
            <path
              d="M1 1.5 6 6.5 11 1.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>

        {/* The second half of it, and only where there is room for a second
            half — a phone gets the direction and nothing else. */}
        <span className="hidden text-[0.5rem] uppercase leading-none tracking-[0.3em] text-gold/35 md:block">
          {t("info.cueOpen")}
        </span>
      </div>
    </motion.div>
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
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-0"
    >
      <SectionWord word="Inđija" speed={0.72} pinned />
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
  /* And it is a control only once it is a control the visitor can see. It sits
     over the pinned scene for the whole of the story; at nought opacity it was
     still a live button, and a click that landed in its corner did something
     the visitor had no way to have meant. */
  const live = useTransform(opacity, (o) => (o >= 1 ? "auto" : "none"));

  if (!onBack) return null;

  return (
    <motion.div
      style={{ opacity, y, pointerEvents: live }}
      className="relative z-10 container-x"
    >
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
