"use client";

import { useEffect } from "react";
import { useLenis } from "lenis/react";

/* HOLDING THE PAGE STILL, WHATEVER IS DOING THE SCROLLING.
 *
 * Five places on this site take the screen and need the page underneath to
 * stop: the hero's entrance, the phone's menu, the wide bar's drawer, the
 * reservation notice and the floor plan. All five used to write the same three
 * lines by hand — `lenis.stop()`, `overflow: hidden` on the document, and both
 * of those undone on the way out.
 *
 * THE FIRST OF THOSE THREE LINES STOPPED BEING TRUE ON A PHONE. Lenis is no
 * longer mounted there — see components/providers/smooth-scroll.tsx — so the
 * hold cannot be something a smooth scroller does. It has to be something the
 * page does, and Lenis, where it is present, simply joins in.
 *
 * WHAT ACTUALLY HELD A PHONE STILL BEFORE. Not `overflow: hidden`: iOS has
 * never been reliable about that on the root, and rubber-banding walks through
 * it. It was Lenis's own `touchmove` listener, which is bound non-passively
 * and calls `preventDefault()` for as long as it is stopped. That listener is
 * the reason touch scrolling on this site was tied to the main thread — the
 * browser cannot scroll on the compositor while a handler might still cancel
 * the gesture — and it was bound for the WHOLE VISIT to serve the few seconds
 * a year the page is actually held.
 *
 * So the same listener lives here instead, and only while something is
 * holding the screen. During ordinary scrolling there is no touch handler on
 * this page at all, which is what lets a phone scroll on the compositor.
 *
 * `[data-lenis-prevent]` keeps its name and its meaning: the panels that
 * scroll inside a held page already carry it, and the check is the same one
 * Lenis made — walk up from whatever was touched, and if the gesture began
 * inside such a panel, leave it alone. */

/* Locks nest: the reservation notice can be over the floor plan. The page is
   released by the last one to let go, never by the first. */
let depth = 0;
let restore = "";

const ESCAPE = "[data-lenis-prevent]";

function hold(event: TouchEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest(ESCAPE)) return;
  if (event.cancelable) event.preventDefault();
}

export function lockScroll(lenis?: { stop: () => void; start: () => void } | null) {
  depth += 1;

  if (depth === 1) {
    restore = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("touchmove", hold, { passive: false });
    lenis?.stop();
  }

  let released = false;

  return () => {
    if (released) return;
    released = true;
    depth -= 1;
    if (depth > 0) return;

    document.documentElement.style.overflow = restore;
    document.removeEventListener("touchmove", hold);
    lenis?.start();
  };
}

/* The hold, as a component says it: true while this thing has the screen. */
export function useScrollLock(active: boolean) {
  const lenis = useLenis();

  useEffect(() => {
    if (!active) return;
    return lockScroll(lenis);
  }, [active, lenis]);
}
