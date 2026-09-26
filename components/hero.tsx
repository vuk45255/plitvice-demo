"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  type MotionValue,
} from "framer-motion";
import { breath } from "@/lib/atmosphere";
import { supportsViewTimeline } from "@/lib/scroll-timeline";
import { EASE } from "@/components/reveal";
import { useEntrance } from "@/components/providers/entrance";
import { useLang } from "@/components/providers/language";
import { RisingLockup } from "@/components/brand/rising-lockup";
import { useFilmInView } from "@/lib/use-film";
import { useScrollLock } from "@/lib/scroll-lock";
import { useCoarsePointer } from "@/lib/use-media";
import { site } from "@/lib/site";

type Phase = "atmosphere" | "revealing" | "done";

/* The three beats of the mark, in seconds after the first scroll intent: the
   word rises letter by letter, HYPERCLUB lands under it, and the town is
   framed last. */
const T_NAME = 0.35;
const T_LINE = 1.35;
/* A light crosses the word as it becomes readable — on the same `revealed`
   flag and the same clock as the letters, never on mount. It leaves from well
   clear of the P, so it meets each letter after that letter has landed: the P
   at about 1.2s, the E at about 1.9s, where each is up by 0.8s into its own
   rise. Clear of the E before the page lets go at REVEAL_MS. */
const T_SWEEP = 0.75;
const T_RULES = 2.0;
const T_TOWN = 2.35;
const REVEAL_MS = 3300;
/* A screen narrower than the portrait film — see `filmSrc` below. */
const PORTRAIT = "(max-aspect-ratio: 2/3)";
/* If no one moves, the house opens the doors itself. */
const FALLBACK_MS = 4600;

export default function Hero() {
  const { entered, enter, ceremonyPlayed, ceremonyOver, curtain } =
    useEntrance();

  /* THE CEREMONY IS PLAYED ON THE WAY IN, NOT EVERY TIME THE VISITOR COMES
     BACK TO THE FRONT ROOM.
   *
   * Read once, in the initialiser, and never again: the provider that holds it
   * is mounted above the router (see components/providers/entrance.tsx), so
   * coming back from /rezervacija or /info/restorani lands on a home page that
   * knows the doors were already opened. There is no reveal to sit through, no
   * scroll lock to wait out, and the page is scrollable on the frame it
   * arrives. A reload is a new visit and gets the ceremony. */
  const [phase, setPhase] = useState<Phase>(() =>
    ceremonyPlayed ? "done" : "atmosphere",
  );
  /* The same fact, kept as it was at mount, because `phase` moves and this
     must not: it is the difference between "the mark is finished" and "the
     mark was already finished before this page was even built". */
  const [returning] = useState(() => ceremonyPlayed);
  /* WHETHER THIS HERO WAS BUILT UNDER THE CURTAIN — components/site-loader.
     Kept as it was at mount, like `returning`: a home page reached later in
     the visit, after the curtain lifted on some other page, has its ordinary
     ceremony and waits for a scroll as it always did. */
  const [underCurtain] = useState(() => curtain === "down");
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  /* The hero film is the one video on this page that is worth having ready
     before it is asked for — but it is still stopped once it has scrolled
     away, which on the home page is most of the visit. */
  const film = useFilmInView<HTMLVideoElement>(!reduced);
  /* A PORTRAIT SCREEN IS GIVEN A PORTRAIT FILM.
   *
   * The film is 1284×1080, and on a phone held upright `object-cover` shows
   * barely two fifths of its width — the decoder was producing, at fifty frames
   * a second, well over twice the pixels that ever reached the screen.
   * hero-mobile.mp4 is the centre 720×1080 of the same master at the same frame
   * rate, which is everything a screen narrower than 2:3 can show. Measured
   * against the master over that region it scores slightly higher than the
   * wide file does (SSIM 0.991 against 0.990), at two thirds of the bytes and
   * 44% of the pixels per frame.
   *
   * CHOSEN HERE, ONCE, AND NOT WITH <source media>. The media attribute is the
   * declarative way to say this, and Chrome keeps a media-query listener alive
   * for every <source> that carries one — including after the element has left
   * the document. Measured across repeated visits to the home page, that
   * listener held every unmounted home page in memory, all five hundred nodes
   * and every animation on them, about two megabytes a round trip. So the
   * question is asked of the window instead: nothing on the server (the poster
   * is the first frame, and the loader waits for it), the answer on the first
   * client render. One file is fetched, and nothing is left listening. */
  const filmSrc = useSyncExternalStore(
    noSubscription,
    () =>
      window.matchMedia(PORTRAIT).matches
        ? site.heroVideoPortrait
        : site.heroVideo,
    () => undefined,
  );
  const phone = useCoarsePointer();
  /* The room only breathes while somebody is in it. Left to itself the haze
     kept its loop for the whole visit, six sections below the fold. */
  const onScreen = useInView(sectionRef);
  const { t } = useLang();

  /* Reduced motion skips the ceremony entirely — derived, never set.
   *
   * AND THE CURTAIN IS THE FIRST SCROLL. When the loader played, its lifting
   * is the visitor's first sight of the room, and asking them to scroll before
   * the mark appears would be a second wait straight after the first. So the
   * mark begins drawing as the curtain fades — one entrance, not two. Derived
   * rather than set, for the same reason as reduced motion. */
  const effectivePhase: Phase = reduced
    ? "done"
    : phase === "atmosphere" && underCurtain && curtain === "lifted"
      ? "revealing"
      : phase;

  /* The page is held still until the mark has finished revealing — by
     lib/scroll-lock.ts, which holds it the same way whether or not a smooth
     scroller is mounted. */
  useScrollLock(effectivePhase !== "done");

  /* And the site's chrome stays away until then too — and the house remembers,
     for the rest of the visit, that the ceremony has been through. */
  useEffect(() => {
    if (effectivePhase !== "done") return;
    if (!entered) enter();
    if (!ceremonyPlayed) ceremonyOver();
  }, [effectivePhase, entered, enter, ceremonyPlayed, ceremonyOver]);

  /* The first scroll intent freezes the room and lights the mark. Nothing is
     listened for, and no fallback clock runs, while the curtain is down: a
     touch on the loader is not a visitor asking for the doors to open. */
  useEffect(() => {
    if (effectivePhase !== "atmosphere" || curtain === "down") return;
    const trigger = () => setPhase("revealing");
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 2) trigger();
    };
    const onKey = (e: KeyboardEvent) => {
      if ([" ", "ArrowDown", "PageDown", "Enter"].includes(e.key)) trigger();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", trigger, { passive: true });
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(trigger, FALLBACK_MS);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", trigger);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [effectivePhase, curtain]);

  const revealing = effectivePhase === "revealing";
  useEffect(() => {
    if (!revealing) return;
    const t = window.setTimeout(() => setPhase("done"), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [revealing]);

  const revealed = effectivePhase !== "atmosphere";
  const invite = effectivePhase === "atmosphere" && curtain !== "down";

  /* ─── WHETHER THE CEREMONY IS BEING PERFORMED AT ALL ──────────────────────
   *
   * Two quite different things ask for the same answer, and neither of them is
   * "less motion in general":
   *
   *   reduced    the visitor has asked not to be shown a three-second reveal
   *   returning  they have already been shown it, and are walking back into
   *              the front room from somewhere else on the site
   *
   * In both cases the mark is simply THERE, at the end of its own choreography,
   * on the first frame. Every stop is the one it always was — the same push-in,
   * the same fall of the room, the same letters, the same rails, in the same
   * places — the clock is what is set to nothing, so nothing is skipped and
   * nothing looks different. A visitor coming back gets a home page that is
   * finished rather than one that starts over.
   *
   * The room's own life is NOT part of this. The haze still drifts, the film
   * still runs, the parallax still answers the scroll: those belong to the
   * page, not to the entrance, and they are still gated on `reduced` alone. */
  const still = reduced || returning;

  const slow = { duration: still ? 0 : 2.6, ease: EASE };
  const d = (seconds: number) => (still ? 0 : seconds);

  /* Mask reveal: the rail rises out of a hard-clipped frame. */
  const rail = {
    hidden: { y: "110%", opacity: 0 },
    show: (delay: number) => ({
      y: "0%",
      opacity: 1,
      transition: { duration: still ? 0 : 1.1, delay, ease: EASE },
    }),
  };

  return (
    <section
      ref={sectionRef}
      className="hero-host relative h-[100svh] overflow-hidden bg-night"
      aria-label={`${site.name} ${site.tagline} ${site.town}`}
    >
      {/* THE FIRST FRAME IS ASKED FOR WITH THE DOCUMENT, NOT AFTER IT.
       *
       * The film's poster is the first thing anybody sees of this club, and a
       * `poster` attribute is not discovered by the browser's preload scanner
       * — it is fetched when the element is constructed, which is after the
       * page's JavaScript has arrived and run. On a phone that is most of a
       * second of the house's own night and nothing else. React hoists this
       * into the head, so the picture is on the wire with the stylesheet and
       * the room is never empty. It is the same file the video below names;
       * asking for it twice fetches it once. */}
      <link
        rel="preload"
        as="image"
        href="/images/hero.jpg"
        fetchPriority="high"
      />
      <Parallax target={sectionRef} still={!!reduced}>
        {/* atmosphere: an almost imperceptible breath. On the first scroll the
            breathing stops — the room freezes — and one long push-in begins. */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={revealed ? { scale: 1.14 } : { scale: [1, 1.045, 1] }}
          transition={
            revealed
              ? { duration: still ? 0 : 4.6, ease: EASE }
              : { duration: 18, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {/* The film is the hero. hero.jpg is handed to the video as its
              poster — a native first frame, not a layer of its own — so the
              room is never empty while the file arrives. */}
          <video
            ref={film}
            poster="/images/hero.jpg"
            muted
            loop
            playsInline
            /* A PHONE IS NOT GIVEN THE WHOLE FILM UP FRONT. `auto` asks the
               browser to pull the entire file down before anything else on
               the page has finished, which on a phone is the hero competing
               with its own type for the radio. The poster is already the
               first frame; metadata is enough to start, and the rest streams
               in behind it. */
            preload={phone ? "metadata" : "auto"}
            aria-hidden="true"
            className="img-grade absolute inset-0 h-full w-full object-cover object-center"
            src={filmSrc}
          />
        </motion.div>
      </Parallax>

      {/* the club's own lights: violet washing the upper corners, a warm pool
          low and centre where the floor is */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 60% at 88% 4%, rgba(42,18,63,0.55), transparent 62%), radial-gradient(70% 55% at 6% 12%, rgba(27,15,43,0.5), transparent 66%)",
        }}
        aria-hidden="true"
      />

      {/* drifting haze — barely there, keeps the room alive */}
      {!reduced && (
        /* On the compositor, and paused mid-breath once the hero has scrolled
           away — see `.atmo-loop` in app/globals.css. */
        <div
          className="atmo-loop absolute inset-0"
          data-idle={onScreen ? undefined : "true"}
          style={{
            background:
              "radial-gradient(60% 45% at 50% 72%, rgba(200,164,93,0.2), transparent 70%)",
            ...breath({ duration: 11, opacity: [0.35, 0.8], rest: 0.6 }),
          }}
          aria-hidden="true"
        />
      )}

      {/* Before the first scroll the film is left bright enough to read the
          room; once the mark starts revealing, the room falls away — into
          purple, never into flat black. */}
      <motion.div
        className="absolute inset-0 bg-night"
        initial={false}
        animate={{ opacity: revealed ? 0.52 : 0.16 }}
        transition={slow}
        aria-hidden="true"
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 62% at 50% 50%, transparent 22%, rgba(8,5,13,0.85) 100%)",
        }}
        initial={false}
        animate={{ opacity: revealed ? 0.95 : 0.32 }}
        transition={slow}
        aria-hidden="true"
      />
      {/* a gradient at the foot, so the scroll cue and corner type stay legible */}
      <div
        className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-night/85 to-transparent"
        aria-hidden="true"
      />

      {/* champagne light behind the mark — lifts as the logo lands */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(42% 34% at 50% 48%, rgba(232,216,168,0.16), rgba(200,164,93,0.06) 45%, transparent 72%)",
        }}
        initial={false}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: d(3.2), delay: d(0.6), ease: EASE }}
        aria-hidden="true"
      />

      <h1 className="sr-only">{t("hero.heading")}</h1>

      {/* THE MARK — PL▷TWICE / HYPERCLUB, then the town */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-night-ink">
        <div className="flex flex-col items-center">
          {/* The client's lockup, raised the way the name always was — see
              components/brand/rising-lockup.tsx. The light behind the ink is a
              desk-only filter: on a phone this is the largest layer on the
              screen and it is repainted every frame of the rise. */}
          <RisingLockup
            id="hero-mark"
            decorative
            play={revealed}
            still={still}
            delay={T_NAME}
            lineAt={T_LINE}
            sweepAt={T_SWEEP}
            className="w-[min(86vw,60rem)] md:w-[min(76vw,56rem)] md:[filter:drop-shadow(0_0_36px_rgba(232,216,168,0.2))]"
          />

          {/* hairlines draw outward, framing the town rail */}
          <div className="mt-6 flex w-full items-center justify-center gap-5 sm:mt-8">
            <motion.span
              initial={false}
              animate={{ scaleX: revealed ? 1 : 0 }}
              transition={{ duration: d(1.4), delay: d(T_RULES), ease: EASE }}
              className="h-px w-[14vw] max-w-32 origin-right bg-gradient-to-l from-gold/60 to-transparent"
              aria-hidden="true"
            />
            <div className="overflow-hidden pb-[0.2em]" aria-hidden="true">
              <motion.p
                variants={rail}
                initial={still ? false : "hidden"}
                animate={revealed ? "show" : "hidden"}
                custom={d(T_TOWN)}
                className="text-[0.625rem] uppercase tracking-[0.62em] text-gold-light/85 indent-[0.62em] sm:text-[0.75rem]"
              >
                {site.town}
              </motion.p>
            </div>
            <motion.span
              initial={false}
              animate={{ scaleX: revealed ? 1 : 0 }}
              transition={{ duration: d(1.4), delay: d(T_RULES), ease: EASE }}
              className="h-px w-[14vw] max-w-32 origin-left bg-gradient-to-r from-gold/60 to-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-10 z-10 flex flex-col items-center gap-4 text-gold/80">
        {/* The invitation to scroll is only made when a scroll is what opens
            the doors. Under the curtain nothing is asked, and when the curtain
            has just lifted the mark is already on its way. */}
        <motion.span
          initial={false}
          animate={{ opacity: invite ? [0.35, 0.85, 0.35] : 0 }}
          transition={
            invite
              ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.6 }
          }
          className="text-[0.625rem] uppercase tracking-[0.36em]"
        >
          {t("hero.scroll")}
        </motion.span>
        <motion.span
          initial={false}
          animate={{ opacity: effectivePhase === "done" ? 1 : 0 }}
          transition={{ duration: d(1), delay: d(0.4) }}
          className="block h-10 w-px bg-gradient-to-b from-gold/70 to-transparent"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

/* THE ROOM SINKS AS THE PAGE LEAVES IT — 0 to 10% of its own height between
 * the hero filling the screen and the hero having left it.
 *
 * On a desk that is Motion against the section, as it always was. On a phone
 * the page is scrolled by the compositor, and a transform written from
 * JavaScript arrives a frame or more after the scroll it answers; on the
 * largest and most-watched layer on the site that reads as the film juddering
 * against the type. So a phone that can run scroll-driven animations is given
 * the same travel on the section's own view timeline (`.hero-host` in
 * app/globals.css), where it moves in the same frame as the page — and it
 * never subscribes to the scroll at all. `exit 0%` → `exit 100%` is
 * Motion's ["start start", "end start"]. */
const noSubscription = () => () => {};

function Parallax({
  target,
  still,
  children,
}: {
  target: React.RefObject<HTMLElement | null>;
  still: boolean;
  children: React.ReactNode;
}) {
  const coarse = useCoarsePointer();
  /* false on the server and through hydration, the browser’s answer after */
  const timeline = useSyncExternalStore(
    noSubscription,
    supportsViewTimeline,
    () => false,
  );
  const compositor = !still && coarse && timeline;

  /* ONE ELEMENT WHICHEVER WAY IT IS DRIVEN. The film lives inside this, and
     swapping the wrapper for another component would build a new <video> —
     one the film observer in lib/use-film.ts has never seen and would never
     play. So the driver is a sibling that comes and goes, and the wrapper only
     changes a class. */
  const y = useMotionValue("0%");
  useEffect(() => {
    if (compositor) y.set("0%");
  }, [compositor, y]);

  return (
    <motion.div
      className={`absolute inset-0 ${compositor ? "hero-parallax" : ""}`}
      style={still ? undefined : { y }}
    >
      {still || compositor ? null : <ScrollDriver target={target} y={y} />}
      {children}
    </motion.div>
  );
}

function ScrollDriver({
  target,
  y,
}: {
  target: React.RefObject<HTMLElement | null>;
  y: MotionValue<string>;
}) {
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start start", "end start"],
  });
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    y.set(`${progress * 10}%`);
  });
  return null;
}
