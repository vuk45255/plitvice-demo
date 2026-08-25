"use client";

import { useCallback, useSyncExternalStore } from "react";

/* WHAT KIND OF DEVICE IS LOOKING, asked once and answered the same way
 * everywhere.
 *
 * `useSyncExternalStore` rather than state and an effect, because a media
 * query is exactly that: an external store with a subscribe and a snapshot.
 * The server snapshot is the one that matters — it is what decides whether a
 * component renders its desktop shape or its phone shape before hydration, and
 * every caller here is written so that the phone answer is the safe one to
 * start from. A rig that is briefly too quiet is nothing; a phone that runs
 * the desktop rig for a frame is a dropped frame.
 *
 * There is no cache and none is wanted: `window.matchMedia` returns a live
 * object the browser already keeps, and asking it twice costs nothing. */
export function useMediaQuery(query: string, onServer = false) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => onServer,
  );
}

/* The breakpoint the whole site is laid out against. */
export const WIDE_QUERY = "(min-width: 768px)";

/* A FINGER RATHER THAN A CURSOR. Both halves matter: `pointer: coarse` catches
   phones and tablets, `hover: none` catches the ones that lie about the first.
   Anything that only exists to follow a mouse is switched off by this — not
   hidden, not faded, not run invisibly in the background. */
export const COARSE_QUERY = "(pointer: coarse), (hover: none)";

export function useWideScreen() {
  return useMediaQuery(WIDE_QUERY);
}

/* True on a phone. Defaults to true before hydration on purpose — see above. */
export function useCoarsePointer() {
  return useMediaQuery(COARSE_QUERY, true);
}
