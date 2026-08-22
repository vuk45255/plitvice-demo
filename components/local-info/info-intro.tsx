"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { useLang } from "@/components/providers/language";
import { InfoPhoto } from "@/components/local-info/info-photo";
import { INFO } from "@/lib/local-info";

/* One screen, held, asked six times.
 *
 * The section is a tall track with a screen-high sticky child inside it: the
 * picture stops moving while the page keeps going, and the six questions are
 * read straight off how far through the track the page has come. Nothing here
 * plays on a timer and nothing waits for a state update — scrolling back up
 * runs the whole thing backwards, exactly, because there is no state in it at
 * all. Every animated value below is a transform or an opacity derived from a
 * single motion value.
 *
 * TREBA VAM does not move. It is the one fixed thing on the screen, and the
 * word underneath it is what the section is actually about — so the phrase is
 * set small and quiet and the answer is set as large as the narrowest phone
 * will carry on one line.
 *
 * The progress is mirrored through useScrollTrack rather than taken raw: these
 * are keyframe runs that start late and finish early, which is precisely the
 * case its comment describes — a native scroll timeline would drop each word
 * back to its underlying style the moment its own range was behind us. */

/* How much scroll each question holds for, as a share of the screen. Six of
   these is the pinned distance; the extra screen at the top of the track is
   what the sticky child stands in while it is pinned. */
const HOLD_VH = 80;

/* How much of a slot is spent handing over to the next one — half of it, which
   leaves the middle half of every slot as a dead hold with one word on screen
   and nothing moving at all. */
const TURN = 0.5;

/* And how the two halves of a handover are laid out inside it.
 *
 * THE WORDS DO NOT CROSSFADE. Two lines of 100px Playfair at half opacity, one
 * 30px above the other, do not read as a transition — they read as a printing
 * error, and PREVOZ over PRVA POMOĆ is unreadable at the moment it matters.
 * So the outgoing word is given the first 55% of the handover to leave and the
 * incoming one the last 55% to arrive: they cross for a tenth of it, at which
 * point both are down at 9% and neither is legible as type. There is never a
 * frame with two words on it, and never a frame with none.
 *
 * The pictures underneath hand over on their own, longer clock, and by being
 * stacked rather than dissolved — see Backdrop. */
const OUT_ENDS = 0.55;
const IN_BEGINS = 0.45;

/* The pictures' own share of a slot, against the words' TURN. Nearly a whole
   slot: the room under a word should already be changing while the word is
   still perfectly still. */
const ROOM = 0.9;

/* The word goes up as it leaves and comes up from below as it arrives. */
const RISE = 30;

/* How much scroll the six questions hold for, in screens. The scene that owns
   the track needs it to size the track — see components/sections/local-info.tsx. */
export const WORDS_VH = INFO.length * HOLD_VH;

/* The rooms and the darkness laid over them — everything in the scene that is
   not type. `dim` is the handover: the last room going down into the night the
   grid stands on. */
export function IntroRooms({
  progress,
  dim,
}: {
  progress: MotionValue<number>;
  dim: MotionValue<number>;
}) {
  /* THE LAST ROOM DOES NOT CUT TO BLACK. It is taken down to the night the
     grid needs behind it, over most of the handover and on its own curve, so
     the photograph is still faintly there while the first row is arriving and
     is gone by the time the last one has. */
  const veil = useTransform(dim, [0.05, 0.72], [0, 1]);

  return (
    <>
      {/* the six rooms, one behind the other, each settling out of a slight
          enlargement the whole time it is on screen */}
      {INFO.map((category, i) => (
        <Backdrop key={category.id} index={i} progress={progress} />
      ))}

      {/* THE PICTURE HAS TO SURVIVE THIS. A flat wash dark enough to carry
            type anywhere on the screen takes the photograph with it, and six
            unreadable rooms are worse than no rooms at all — so the darkness is
            shaped instead of levelled.

            A vignette does the corners, which is where nothing is written and
            where a lens darkens anyway. The band across the middle does the
            line of the type and nothing else: it is a horizontal gradient, so
            the top and bottom thirds of every photograph stay as bright as they
            were shot. What is left is dark under the words and open everywhere
            a hotel room or a lit shopfront has to be recognisable. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 96% at 50% 50%, transparent 34%, rgba(8,5,13,0.72) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-1/2 h-[46vh] -translate-y-1/2"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(8,5,13,0.62) 38%, rgba(8,5,13,0.62) 62%, transparent)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[26vh] bg-gradient-to-t from-night to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-0 h-[18vh] bg-gradient-to-b from-night/75 to-transparent"
        aria-hidden="true"
      />

      <motion.div
        className="absolute inset-0 bg-night"
        style={{ opacity: veil }}
        aria-hidden="true"
      />
    </>
  );
}

/* ─────────────────────────── the six rooms ─────────────────────────── */

function Backdrop({
  index,
  progress,
}: {
  index: number;
  progress: MotionValue<number>;
}) {
  /* THE ROOMS ARE STACKED, NOT CROSS-DISSOLVED. Each picture is opaque, so
     fading one down to a half while the next comes up to a half does not blend
     them — it lets a quarter of the empty night behind both of them through,
     and every handover dips toward black in the middle. Instead each room
     simply comes up over the one before it and then stays, in DOM order. The
     one underneath is never faded at all; it is covered. Nothing dips, and
     scrolling back up uncovers them again in reverse, exactly, because this is
     still nothing but a function of scroll position.

     The first room has nothing to arrive over and is always up. */
  const span = ROOM / INFO.length;
  const arrives = index / INFO.length;

  const opacity = useTransform(
    progress,
    [arrives - span / 2, arrives + span / 2],
    index === 0 ? [1, 1] : [0, 1],
  );

  /* One slow settle across its whole life on screen: every room comes in a
     little large and is still easing down when the next covers it, which is
     what stops a held screen from reading as a still. */
  const scale = useTransform(
    progress,
    [arrives - span / 2, (index + 1) / INFO.length + span / 2],
    [1.06, 1],
  );

  return (
    <motion.div
      className="absolute inset-0"
      style={{ opacity }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ scale }}
      >
        <InfoPhoto category={INFO[index]} sizes="100vw" />
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────── the question itself ──────────────────────── */

export function IntroAsking({
  progress,
  exit,
}: {
  progress: MotionValue<number>;
  exit: MotionValue<number>;
}) {
  const { t } = useLang();
  const last = INFO.length - 1;

  /* KAKO DO NAS? LEAVES THE WAY IT ARRIVED — upward, and slowly.
   *
   * It used to be gone by the first tenth of the handover, and that turned out
   * to be the single most expensive thing about coming back up. Scroll-linked
   * animation is symmetric: what costs a screen going down costs a screen
   * coming up, and a question that had finished leaving in the first tenth was
   * a question that only began returning in the LAST tenth. Everything between
   * was a long climb with nothing coming back yet.
   *
   * So it recedes across most of the handover instead — starting to drift at
   * once, holding legibility while the first row lands, and gone by about four
   * fifths. Reversed, that means the first upward movement off the grid brings
   * it straight back. It also happens to be the better sequence: the question
   * is behind the cards rather than replaced by them, which is what receding
   * looks like. The grid paints over it, so the two never compete. */
  const leaving = useTransform(exit, [0.2, 0.78], [1, 0]);
  const rising = useTransform(exit, [0.08, 0.88], [0, -132]);

  /* THE LAST QUESTION DROPS THE EYEBROW. The first five are things you might
     need; the last one is not — KAKO DO NAS is the answer the section has been
     walking toward, and TREBA VAM in front of it makes it a sixth item on a
     list instead of the end of one. So the eyebrow leaves on the same clock
     the fifth word leaves on, and the last screen is one line, alone.

     It fades rather than unmounts, and the rule below widens as it goes: the
     end of the run should feel arrived at, not truncated. */
  const [eyebrowFrom, eyebrowTo] = [
    last / INFO.length - TURN / INFO.length / 2,
    last / INFO.length + TURN / INFO.length / 2,
  ];
  const eyebrow = useTransform(progress, [eyebrowFrom, eyebrowTo], [1, 0]);

  /* The hairline under the word, and the only ornament in the section: it
     grows from a stub to its full width across the six, so how far through the
     run you are is legible without a single dot or arrow on screen. */
  const rule = useTransform(progress, [0, 1], [0.12, 1]);

  return (
    <motion.div
      style={{ opacity: leaving, y: rising }}
      className="container-x pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center"
    >
      {/* THE WORD IS THE CENTRE OF THE SCREEN, and everything else hangs off
          it. The eyebrow and the rule are positioned against this box rather
          than stacked in a column with it, so the headline sits on the optical
          centre at every one of the six — including the last, where the eyebrow
          is gone and a column would have let the word drift upward into the
          space it left behind. */}
      <p
        className="relative h-[1.06em] w-full font-serif uppercase leading-[0.95] tracking-[-0.005em] text-[clamp(1.9rem,9vw,8rem)]"
        /* What is on screen is six overlapping copies of one line. A screen
           reader has no scroll position to read them at, so it is handed the
           six plainly instead, below. */
        aria-hidden="true"
      >
        <motion.span
          style={{ opacity: eyebrow }}
          className="rail rail-center rail-night absolute bottom-full left-0 right-0 mb-7 block !text-[0.5625rem] sm:!text-[0.6875rem] md:mb-9"
        >
          {t("info.asking")}
        </motion.span>

        {INFO.map((category, i) => (
          <Word key={category.id} index={i} progress={progress} />
        ))}

        <span className="absolute left-1/2 top-full mt-9 block w-[min(34vw,300px)] -translate-x-1/2 md:mt-12">
          <motion.span
            style={{ scaleX: rule }}
            className="block h-px origin-center bg-gold/45"
          />
        </span>
      </p>

      <span className="sr-only">
        {INFO.map((category) => t(category.asking)).join(", ")}
      </span>
    </motion.div>
  );
}

function Word({
  index,
  progress,
}: {
  index: number;
  progress: MotionValue<number>;
}) {
  const { t } = useLang();
  const [inStart, inEnd, outStart, outEnd] = stops(index);

  const opacity = useTransform(
    progress,
    [inStart, inEnd, outStart, outEnd],
    [0, 1, 1, 0],
  );
  const y = useTransform(
    progress,
    [inStart, inEnd, outStart, outEnd],
    [RISE, 0, 0, -RISE],
  );

  return (
    <motion.span
      style={{ opacity, y }}
      className="absolute inset-0 flex items-center justify-center whitespace-nowrap will-change-transform"
    >
      {t(INFO[index].asking)}
      <span className="text-gold-light">?</span>
    </motion.span>
  );
}

/* The four stops of one slot, as shares of the whole track: fade in between
   the first two, hold, fade out between the last two.
 *
 * A handover is a window of TURN of a slot, centred on the boundary between two
 * slots. IN_BEGINS and OUT_ENDS say where inside that window this slot`s arrival
 * starts and its departure finishes, as shares of it. Both are measured from the
 * front of the window, which is why the arrival subtracts half a window and the
 * departure adds it.
 *
 * The ends of the track are the whole trick. The first slot is already up when
 * the section takes hold and the last is still up when it lets go, so their
 * outer stops are pushed clean off both ends — there is no share of the scroll
 * at which the screen is empty, and neither end can be caught half-faded by a
 * browser restoring a scroll position into the middle of the section. */
function stops(index: number): [number, number, number, number] {
  const n = INFO.length;
  const turn = TURN / n;
  const start = index / n;
  const end = (index + 1) / n;

  return [
    index === 0 ? -1 : start + turn * (IN_BEGINS - 0.5),
    index === 0 ? -0.5 : start + turn * 0.5,
    index === n - 1 ? 1.5 : end - turn * 0.5,
    index === n - 1 ? 2 : end + turn * (OUT_ENDS - 0.5),
  ];
}

/* ──────────────────── less movement asked for ──────────────────── */

/* No pin, no track, and above all no six screens of empty scroll to get
   through — the six questions are simply asked at once, as a list. */
export function StillIntro() {
  const { t } = useLang();

  return (
    <div className="relative overflow-hidden bg-night py-24 md:py-32">
      <div className="container-x relative z-10 text-center">
        <p className="rail rail-center rail-night">{t("info.asking")}</p>
        <ul className="mt-10 space-y-3 font-serif uppercase leading-tight text-[clamp(1.5rem,5vw,3rem)]">
          {INFO.map((category) => (
            <li key={category.id}>
              {t(category.asking)}
              <span className="text-gold-light">?</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
