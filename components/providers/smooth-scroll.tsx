"use client";

import { useState } from "react";
import { ReactLenis } from "lenis/react";
import { COARSE_QUERY } from "@/lib/use-media";

/* SMOOTH SCROLLING IS FOR A WHEEL. A FINGER ALREADY HAS SOME.
 *
 * ─── WHAT THIS IS FOR ON A DESK ───────────────────────────────────────────
 *
 * A wheel notch is a jump, not a movement, and a page this cinematic reads
 * badly in jumps. Lenis turns each notch into an eased run and moves the page
 * from its own frame callback — which also means every scroll-driven thing on
 * the site is computed on the same thread, in the same frame, and painted with
 * the position it was computed from. That is why a desk has always looked
 * exact. None of it changes.
 *
 * ─── AND WHY IT IS NOT MOUNTED ON A PHONE ─────────────────────────────────
 *
 * Lenis does not smooth touch here and never did: `syncTouch` is off, which is
 * correct — a phone's own scrolling is the thing a phone is best at, and
 * taking it over produces the floaty, detached feel that the option exists to
 * avoid. So on a phone Lenis was doing no smoothing at all. What it was still
 * doing was binding `touchstart`, `touchmove` and `touchend` to the page, and
 * binding them NON-PASSIVELY, because that is how it holds the page still when
 * something has called `stop()`.
 *
 * A non-passive `touchmove` handler on the scroller is the most expensive
 * thing a page can own. The browser cannot scroll on the compositor while a
 * handler might still cancel the gesture: every move has to go to the main
 * thread and come back before the page is allowed to move. On a page that is
 * also running a dozen scroll-linked animations on that thread, the result is
 * exactly what a phone was showing — the page moving, stopping, catching up,
 * moving. Not slow: interrupted. And the handler ran a `composedPath()` walk
 * on every one of those moves to decide it had nothing to do.
 *
 * So the phone is given its own scrolling back, which the compositor runs
 * without asking anyone. The one thing Lenis was still genuinely providing —
 * holding the page while a panel has the screen — is now lib/scroll-lock.ts,
 * which does it for both kinds of device and only while something is actually
 * being held.
 *
 * ─── HOW THE DEVICE IS DECIDED ────────────────────────────────────────────
 *
 * By capability, never by a user-agent string: the same `(pointer: coarse),
 * (hover: none)` the rest of the site asks — see lib/use-media.ts — and the
 * same one app/globals.css asks of the background words, so the two halves
 * cannot disagree.
 *
 * Asked ONCE, in a state initialiser, and never revisited. This component
 * renders no markup of its own — with `root`, Lenis is a context provider and
 * nothing else — so the server and the client produce byte-identical HTML
 * whichever branch is taken, and there is nothing for hydration to reconcile.
 * Re-deciding later would swap the tree under the entire site, which is a
 * remount of every page, and is not worth a resize nobody performs. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [coarse] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(COARSE_QUERY).matches,
  );

  if (coarse) return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{ duration: 1.15, smoothWheel: true, touchMultiplier: 1.4 }}
    >
      {children}
    </ReactLenis>
  );
}
