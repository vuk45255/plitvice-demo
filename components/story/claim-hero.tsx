"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { EASE } from "@/components/reveal";
import { useFilmInView } from "@/lib/use-film";
import { site } from "@/lib/site";

/* What the house says about itself, said over and over.
 *
 * Four words on one stage: #1 · CLUB · IN · SERBIA, cycling on their own clock
 * for as long as anyone is looking at them. Nothing here is tied to the scroll
 * — the page under it scrolls normally and the visitor is free to leave at any
 * word.
 *
 * The whole thing is one typographic system rather than four compositions.
 * Every word is set in the same face, the same weight, the same tracking and
 * — this is the part that matters — the same size, so all four share a cap
 * height and a centre line and differ only in how long they happen to be. The
 * stage is a single centred box; no word is ever placed by hand.
 *
 * The statement is a brand line, not copy: it stays in English whichever way
 * the language switcher sits, exactly as GRAND CLUB / PLITVICE / INĐIJA does.
 * The two small gold rails around it are copy, and they do follow the site. */

type HeroWord = {
  text: string;
  /* Only ever used to pull back a word that would otherwise crowd the frame.
     It is a correction to the shared size, never a size of its own. */
  scale?: number;
};

const HERO_WORDS: HeroWord[] = [
  { text: "#1" },
  { text: "CLUB" },
  { text: "IN" },
  { text: "SERBIA" },
];

/* The one size the whole sequence is set at.
 *
 * `vw` decides it on any normal screen and `vh` catches the short ones, so the
 * longest word lands a little inside both edges of the frame and the shortest
 * still reads as a headline rather than a caption. Changing this one number
 * re-scales the entire sequence without disturbing its proportions. */
const TYPE_SIZE = "clamp(2.75rem, min(23.5vw, 40vh), 21rem)";

/* Enter, hold, leave — one language of movement for all four.
 *
 * A word rises into the frame, keeps drifting gently upward for as long as it
 * holds, and then carries on out through the top while the next is already on
 * its way in. It never parks: the drift is what stops the sequence reading as
 * four slides with pauses between them. Distances are a share of the type's
 * own height, so the travel scales with the type. */
const RISE = "58%";
const DRIFT = "-4%";
const DEPART = "-64%";

/* The clock, as a budget. A word gets STEP_MS of stage, spent in this order:
 *
 *   0.20s  the hand-over — the word waits while the one before it leaves
 *   0.25s  entering      — LIFE * ARRIVED
 *   0.55s  legible       — the rest of LIFE, drifting but fully up
 *   ────
 *   1.00s  and the next word is up: four of them make a 4s round.
 *
 * THE SPLIT INSIDE THE SECOND IS THE WHOLE JOB, not the length of it. A tick
 * of one second can still read as slow if the word spends most of it arriving:
 * what a viewer clocks is the stretch where the word is simply THERE, and
 * everything before that is a smear. So the entrance is kept short and the
 * legible stretch is given more than half the beat — 0.25 in, 0.55 up. Lengthen
 * the entrance and the rhythm goes soft again even at the same tick.
 *
 * The exit is 0.30s and starts the moment the word is replaced, so it is still
 * on its way out for 0.10s after the next has begun to arrive. That overlap is
 * what keeps the turn from reading as a cut, and it is why LEAVE is longer than
 * HANDOVER rather than equal to it.
 *
 * LIFE ends exactly on the tick — 0.20 + 0.80 = 1.00 — which is the one
 * relationship to preserve if these numbers are ever changed again: it is what
 * stops a word arriving, parking, and waiting to be taken away.
 *
 * NOTHING ELSE ADDS TIME. There is one interval and no timeouts; the presence
 * is the default sync, so the outgoing word never has to finish before the next
 * may begin. The real round is four ticks and nothing more. */
const LIFE = 0.8;
/* Where in that life the word has finished arriving and starts drifting. */
const ARRIVED = 0.3125;
const LEAVE = 0.3;
/* The head start the outgoing word gets. Long enough that one word is always
   the clear subject, short enough that the frame is never empty. */
const HANDOVER = 0.2;
const STEP_MS = 1000;

export function ClaimHero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  /* The room behind the words, and it stops the moment the archive wall
     takes over — that wall has films of its own and a phone decodes one at a
     time. */
  const film = useFilmInView<HTMLVideoElement>(!reduced);

  /* Counts every word shown rather than which of the four is up, so the turn
     from the last word back to the first is the same hand-over as any other —
     a new key, an entrance and an exit, and no restart to see. */
  const [step, setStep] = useState(0);

  /* Nothing runs while the hero is off screen or the tab is in the background;
     coming back, it carries on from the word it was on. */
  const onScreen = useInView(ref, { amount: 0 });
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    const sync = () => setAwake(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (reduced || !onScreen || !awake) return;
    const timer = window.setInterval(
      () => setStep((current) => current + 1),
      STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, [reduced, onScreen, awake]);

  const word = HERO_WORDS[step % HERO_WORDS.length];

  return (
    <section
      ref={ref}
      aria-labelledby="claim-title"
      className="relative isolate h-[100svh] overflow-hidden"
      style={{ ["--hero-type" as string]: TYPE_SIZE }}
    >
      {/* The room, running on its own clock — it belongs to the hero, not to
          any one word, and is never remounted when the word changes. */}
      <video
        ref={film}
        src={site.reelVideo}
        poster="/images/interlude.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="img-grade absolute inset-0 h-full w-full object-cover object-center opacity-30"
      />

      {/* enough dark over the film for the type to hold it down */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(65% 50% at 84% 6%, rgba(42,18,63,0.7), transparent 66%), radial-gradient(92% 92% at 50% 50%, rgba(8,5,13,0.42) 18%, rgba(8,5,13,0.9) 100%)",
        }}
        aria-hidden="true"
      />

      {/* The statement, once, for anything that reads rather than watches. */}
      <h1 id="claim-title" className="sr-only">
        {HERO_WORDS.map((entry) => entry.text).join(" ")} — {site.name},{" "}
        {site.town}
      </h1>

      {reduced ? (
        <StillClaim />
      ) : (
        <AnimatePresence>
          {/* The stage. One centred box, and every word lands in it — none is
              ever placed by hand. The small top padding is the only correction
              in the composition: the bar across the top carries visual weight
              of its own, and without it the statement reads as sitting high. */}
          <div
            key={step}
            className="absolute inset-0 flex items-center justify-center pt-8 md:pt-10"
            aria-hidden="true"
          >
            <motion.span
              className="block whitespace-nowrap text-center font-sans font-black uppercase leading-none tracking-[-0.045em] text-night-ink"
              style={{
                fontSize: word.scale
                  ? `calc(var(--hero-type) * ${word.scale})`
                  : "var(--hero-type)",
              }}
              initial={{ y: RISE, opacity: 0, scale: 1.05 }}
              animate={{
                y: [RISE, "0%", DRIFT],
                opacity: [0, 1, 1],
                scale: [1.05, 1, 1.01],
              }}
              exit={{
                y: DEPART,
                opacity: 0,
                scale: 0.98,
                /* The outgoing word leaves the moment it is replaced. Only the
                   arriving one waits, and that wait is the hand-over. */
                transition: { duration: LEAVE, ease: EASE },
              }}
              transition={{
                duration: LIFE,
                delay: step === 0 ? 0.1 : HANDOVER,
                times: [0, ARRIVED, 1],
                /* Eased into place, then a plain unhurried drift. */
                ease: [EASE, "linear"],
              }}
            >
              {word.text}
            </motion.span>
          </div>
        </AnimatePresence>
      )}

    </section>
  );
}

/* Reduced motion gets the statement rather than the sequence: the same four
   words in the same face on the same stage, stacked and still. */
function StillClaim() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pt-8 md:pt-10"
      aria-hidden="true"
    >
      <p className="text-center font-sans font-black uppercase leading-[0.86] tracking-[-0.045em] text-night-ink text-[clamp(2.5rem,11vw,8rem)]">
        {HERO_WORDS[0].text} {HERO_WORDS[1].text}
        <br />
        {HERO_WORDS[2].text} {HERO_WORDS[3].text}
      </p>
    </div>
  );
}
