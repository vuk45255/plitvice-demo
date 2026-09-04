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

/* ─── AND WHAT A HELD PAGE DOES TO EVERY PICTURE MOUNTED BEHIND IT ─────────
 *
 * A page that cannot scroll is a page the browser's own lazy loading gives up
 * on. `loading="lazy"` — which is what next/image sets on everything that is
 * not `priority` — is decided by the browser when the element is laid out: an
 * image inside a document whose root carries `overflow: hidden` is deferred,
 * and the decision is NOT revisited when the hold is released. Nothing
 * revisits it. There is no scroll to revisit it on, no resize, and dispatching
 * either by hand changes nothing, because the browser is not waiting for an
 * event — it has already made up its mind.
 *
 * WHAT THAT LOOKED LIKE, and it was the reservation room's own bug: the
 * admission notice holds the page (see components/reservation/reservation-gate)
 * for as long as a guest is reading it, on the first visit of a session and
 * only then. The room behind it renders with the notice up, so every poster on
 * it is laid out under the hold and deferred — and stays deferred after the
 * guest agrees, because the room is one screen tall and there is nothing to
 * scroll. The guest was looking at empty frames, and a refresh "fixed" it for
 * exactly one reason: the second visit does not show the notice, so nothing
 * holds the page and the pictures load the ordinary way.
 *
 * So the release does the one thing that can undo the decision: it takes the
 * hint off the pictures that are actually on screen. `loading = "eager"` on an
 * image the browser has already deferred starts the fetch immediately.
 *
 * ONLY WHAT IS ON SCREEN, plus one screen either side. This is a repair, not a
 * preload — anything further down the page is still lazy, still the browser's
 * business, and will be asked for when the visitor scrolls to it, which they
 * can now do. React never rewrites the attribute either: the prop it renders
 * is unchanged, so its own diff sees nothing to do.
 *
 * `complete` is the test for "the browser never fetched this", and it is the
 * right one — an image that has loaded, failed, or has no src at all is
 * complete, so none of them is touched. */
function wakeDeferredImages() {
  const reach = window.innerHeight;

  document
    .querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
    .forEach((image) => {
      if (image.complete) return;

      const box = image.getBoundingClientRect();
      if (box.bottom < -reach || box.top > window.innerHeight + reach) return;

      image.loading = "eager";
    });
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

    /* HERE, AND NOT ON THE NEXT FRAME. It was written as a
       `requestAnimationFrame` to keep a layout read off the release path, and
       that was wrong: a frame callback does not run in a tab that is not being
       painted, so a panel closed in a backgrounded tab — or in any of the
       several situations a browser throttles the frameloop — left the pictures
       exactly as broken as before, and left it broken unpredictably, which is
       worse than either.
       `getBoundingClientRect` below forces the layout the line above has just
       invalidated, so the boxes read are the ones the released page has. It is
       a handful of measurements, once, at the moment a panel closes. */
    wakeDeferredImages();
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
