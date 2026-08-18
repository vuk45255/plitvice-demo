"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* "Rezerviši sto." — and then the last word changes.
 *
 * The verb is set once and never moves. What follows it is typed out, held long
 * enough to be read, taken back, and replaced: sto, kartu, separe. It is the
 * page saying what it is for, in the club's own three words, rather than a
 * label saying "Rezervacija".
 *
 * The changing word is the same face, size, weight and colour as the verb — it
 * is one headline, not a headline with a widget in it. The line is held at the
 * width of the longest of the three, so nothing on the page ever shifts as the
 * letters come and go, and the cursor is a hairline that fades out while a word
 * is being read rather than blinking through it.
 *
 * With reduced motion asked for, the line simply reads "Rezerviši sto" and
 * stays there. Screen readers get that same fixed phrase either way — the
 * animation is decoration and is hidden from them. */

const WORDS: MessageKey[] = [
  "reserve.word.table",
  "reserve.word.ticket",
  "reserve.word.booth",
];

/* Milliseconds. Typing is unhurried, taking a word back is quicker, and the
   hold is long enough to actually read the line. */
const TYPE = 95;
const ERASE = 55;
const HOLD = 1400;
const BETWEEN = 280;

export function ReserveHeadline({ className }: { className?: string }) {
  const { t } = useLang();
  const verb = t("reserve.headline");
  const words = WORDS.map((key) => t(key));

  return (
    <h1 className={className}>
      <span className="sr-only">{`${verb} ${words[0]}`}</span>
      <span aria-hidden="true">
        {verb} <Typed words={words} />
      </span>
    </h1>
  );
}

function Typed({ words }: { words: string[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(true);

  const word = words[index];

  useEffect(() => {
    if (reduced) return;
    const current = words[index];

    if (typing) {
      /* Still letters to lay down. */
      if (count < current.length) {
        const id = window.setTimeout(() => setCount((c) => c + 1), TYPE);
        return () => window.clearTimeout(id);
      }
      /* Whole word is up — leave it there to be read. */
      const id = window.setTimeout(() => setTyping(false), HOLD);
      return () => window.clearTimeout(id);
    }

    if (count > 0) {
      const id = window.setTimeout(() => setCount((c) => c - 1), ERASE);
      return () => window.clearTimeout(id);
    }
    /* Line is clear — take the next word. */
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % words.length);
      setTyping(true);
    }, BETWEEN);
    return () => window.clearTimeout(id);
  }, [count, typing, index, words, reduced]);

  /* Longest of the three holds the line open, so the headline never reflows. */
  const widest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  const shown = reduced ? words[0] : word.slice(0, count);
  /* The cursor steps aside while a finished word is being read. */
  const resting = reduced || (typing && count === word.length);

  return (
    <span className="relative inline-block align-baseline">
      <span className="invisible whitespace-nowrap">{widest}</span>
      <span className="absolute left-0 top-0 whitespace-nowrap">
        {shown}
        <span
          className={`ml-[0.06em] inline-block h-[0.72em] w-px translate-y-[0.02em] bg-current align-baseline transition-opacity duration-300 ${
            resting ? "opacity-0" : "opacity-60"
          }`}
        />
      </span>
    </span>
  );
}
