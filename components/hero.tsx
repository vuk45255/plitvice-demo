"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useLenis } from "lenis/react";
import { EASE } from "@/components/reveal";
import { useEntrance } from "@/components/providers/entrance";
import { useLang } from "@/components/providers/language";
import {
  SIGNATURE_BOX,
  SIGNATURE_FACE,
  SIGNATURE_INK,
} from "@/components/grand-club";
import { useFilmInView } from "@/lib/use-film";
import { useCoarsePointer } from "@/lib/use-media";
import { site } from "@/lib/site";

type Phase = "atmosphere" | "revealing" | "done";

const LETTERS = site.name.toUpperCase().split("");

/* The three beats of the mark, in seconds after the first scroll intent. */
const T_TAGLINE = 0.25;
/* The signature's own hairlines draw while it is still landing, and are done
   by the time the town's rules begin — one gesture, not two. */
const T_TAGLINE_RULES = 0.6;
const T_NAME = 0.85;
const T_RULES = 2.0;
const T_TOWN = 2.35;
const REVEAL_MS = 3300;
/* If no one moves, the house opens the doors itself. */
const FALLBACK_MS = 4600;

export default function Hero() {
  const [phase, setPhase] = useState<Phase>("atmosphere");
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  /* The hero film is the one video on this page that is worth having ready
     before it is asked for — but it is still stopped once it has scrolled
     away, which on the home page is most of the visit. */
  const film = useFilmInView<HTMLVideoElement>(!reduced);
  const phone = useCoarsePointer();
  /* The room only breathes while somebody is in it. Left to itself the haze
     kept its loop for the whole visit, six sections below the fold. */
  const onScreen = useInView(sectionRef);
  const lenis = useLenis();
  const { enter } = useEntrance();
  const { t } = useLang();

  /* Reduced motion skips the ceremony entirely — derived, never set. */
  const effectivePhase: Phase = reduced ? "done" : phase;

  /* The page is held still — and the site's chrome stays away — until the
     mark has finished revealing. */
  useEffect(() => {
    if (effectivePhase === "done") {
      enter();
      lenis?.start();
      document.documentElement.style.overflow = "";
      return;
    }
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      lenis?.start();
    };
  }, [lenis, effectivePhase, enter]);

  /* The first scroll intent freezes the room and lights the mark. */
  useEffect(() => {
    if (effectivePhase !== "atmosphere") return;
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
  }, [effectivePhase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const t = window.setTimeout(() => setPhase("done"), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  const revealed = effectivePhase !== "atmosphere";
  const slow = { duration: reduced ? 0 : 2.6, ease: EASE };
  const d = (seconds: number) => (reduced ? 0 : seconds);

  /* Mask reveal: the rail rises out of a hard-clipped frame. */
  const rail = {
    hidden: { y: "110%", opacity: 0 },
    show: (delay: number) => ({
      y: "0%",
      opacity: 1,
      transition: { duration: reduced ? 0 : 1.1, delay, ease: EASE },
    }),
  };

  return (
    <section
      ref={sectionRef}
      className="relative h-[100svh] overflow-hidden bg-night"
      aria-label={`${site.tagline} ${site.name} ${site.town}`}
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
      <motion.div
        className="absolute inset-0"
        style={{ y: reduced ? undefined : parallaxY }}
      >
        {/* atmosphere: an almost imperceptible breath. On the first scroll the
            breathing stops — the room freezes — and one long push-in begins. */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={revealed ? { scale: 1.14 } : { scale: [1, 1.045, 1] }}
          transition={
            revealed
              ? { duration: reduced ? 0 : 4.6, ease: EASE }
              : { duration: 18, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {/* The film is the hero. hero.jpg is handed to the video as its
              poster — a native first frame, not a layer of its own — so the
              room is never empty while the file arrives. */}
          <video
            ref={film}
            src={site.heroVideo}
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
          />
        </motion.div>
      </motion.div>

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
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 45% at 50% 72%, rgba(200,164,93,0.2), transparent 70%)",
          }}
          animate={
            onScreen
              ? {
                  opacity: [0.35, 0.8, 0.35],
                  transition: {
                    duration: 11,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }
              : { opacity: 0.6, transition: { duration: 0 } }
          }
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

      {/* THE MARK — grand club / plitvice / inđija */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-night-ink">
        <div className="flex flex-col items-center">
          {/* The tagline is signed rather than set, at every width: a script
              hand above the mark, with its own pair of hairlines — shorter than
              the town's, so the signature is framed without being announced.
              The face and the rules are the site's, from components/grand-club.

              The mask has to be cut wide of the script on both sides. Great
              Vibes carries about 1.5em of ink between its ascent and descent,
              so an ordinary line box leaves the swashes of the G and the C
              standing proud of it and the clip shears their tops. The line box
              is opened up to hold the ink, and the frame is given a head as
              well as a foot — the script climbs above its ascenders and
              descends below its baseline. */}
          <div
            className="flex items-center justify-center gap-4"
            aria-hidden="true"
          >
            <motion.span
              initial={false}
              animate={{ scaleX: revealed ? 1 : 0 }}
              transition={{
                duration: d(1.4),
                delay: d(T_TAGLINE_RULES),
                ease: EASE,
              }}
              className="h-px w-[11vw] max-w-24 origin-right bg-gradient-to-l from-gold/60 to-transparent"
            />
            <div className={`overflow-hidden ${SIGNATURE_INK}`}>
              <motion.p
                variants={rail}
                initial="hidden"
                animate={revealed ? "show" : "hidden"}
                custom={d(T_TAGLINE)}
                className={`${SIGNATURE_FACE} ${SIGNATURE_BOX} text-[clamp(1.5rem,3.2vw,2.5rem)] text-gold-light/85`}
              >
                {site.tagline}
              </motion.p>
            </div>
            <motion.span
              initial={false}
              animate={{ scaleX: revealed ? 1 : 0 }}
              transition={{
                duration: d(1.4),
                delay: d(T_TAGLINE_RULES),
                ease: EASE,
              }}
              className="h-px w-[11vw] max-w-24 origin-left bg-gradient-to-r from-gold/60 to-transparent"
            />
          </div>

          <div className="overflow-hidden py-[0.06em]" aria-hidden="true">
            <motion.div
              className="flex"
              initial="hidden"
              animate={revealed ? "show" : "hidden"}
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: d(0.07),
                    delayChildren: d(T_NAME),
                  },
                },
              }}
            >
              {LETTERS.map((letter, i) => (
                <motion.span
                  key={i}
                  className="inline-block font-serif text-[clamp(3.25rem,17vw,13rem)] uppercase leading-[1.06] tracking-[0.02em] [text-shadow:0_0_60px_rgba(232,216,168,0.22)]"
                  variants={{
                    hidden: { y: "115%" },
                    show: {
                      y: "0%",
                      transition: { duration: reduced ? 0 : 1.15, ease: EASE },
                    },
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </motion.div>
          </div>

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
                initial="hidden"
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
        <motion.span
          initial={false}
          animate={{
            opacity: effectivePhase === "atmosphere" ? [0.35, 0.85, 0.35] : 0,
          }}
          transition={
            effectivePhase === "atmosphere"
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
          transition={{ duration: 1, delay: 0.4 }}
          className="block h-10 w-px bg-gradient-to-b from-gold/70 to-transparent"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
