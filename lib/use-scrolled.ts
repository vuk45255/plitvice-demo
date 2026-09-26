"use client";

import { useCallback, useSyncExternalStore } from "react";

/* HAS THE PAGE MOVED PAST A POINT — the one thing the two bars need to know.
 *
 * It used to be asked of Lenis, through a callback Lenis ran on every frame it
 * moved the page, and after that of the page's own `scroll` event, coalesced
 * onto a frame and answered by reading `window.scrollY`.
 *
 * THAT READ WAS NOT FREE, AND IT WAS PAID TWICE A FRAME. Reading `scrollY`
 * makes the browser bring style and layout up to date first, and by the time
 * an animation-frame callback runs, the frame's animations — the background
 * words and the atmosphere rigs, which ride the scroll — have just marked style
 * dirty. So each read forced a full style recalculation out of turn, before the
 * browser was going to do the same work again a moment later, on every frame
 * of every scroll, once for the phone bar and once for the wide bar (both are
 * mounted; CSS decides which is seen). Profiled on the home page it was the
 * single most expensive function on the page during a scroll.
 *
 * So nothing here reads the scroll at all. A transparent 1px sentinel as tall
 * as the threshold is pinned to the top of the document, and an
 * IntersectionObserver says when it has left the screen — which is the moment
 * the page has scrolled past the threshold. The browser computes that where it
 * computes everything else, without being forced to, and says so only when
 * the answer changes. The bars share one sentinel and one observer. */

type Store = {
  past: boolean;
  listeners: Set<() => void>;
  release?: () => void;
};

const stores = new Map<number, Store>();

function storeFor(threshold: number) {
  let store = stores.get(threshold);
  if (!store) {
    store = { past: false, listeners: new Set() };
    stores.set(threshold, store);
  }
  return store;
}

function watch(threshold: number, store: Store) {
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  /* Past the threshold means `scrollY > threshold`: a box `threshold + 1`
     pixels tall has fully left the top of the screen exactly then. */
  sentinel.style.cssText = `position:absolute;top:0;left:0;width:1px;height:${
    threshold + 1
  }px;pointer-events:none;visibility:hidden`;
  document.body.appendChild(sentinel);

  const observer = new IntersectionObserver(([entry]) => {
    const now = !entry.isIntersecting;
    if (now === store.past) return;
    store.past = now;
    store.listeners.forEach((notify) => notify());
  });
  observer.observe(sentinel);

  return () => {
    observer.disconnect();
    sentinel.remove();
  };
}

export function useScrolledPast(threshold: number) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const store = storeFor(threshold);
      store.listeners.add(notify);
      if (store.listeners.size === 1) store.release = watch(threshold, store);

      return () => {
        store.listeners.delete(notify);
        if (store.listeners.size > 0) return;
        store.release?.();
        store.release = undefined;
        store.past = false;
      };
    },
    [threshold],
  );

  return useSyncExternalStore(
    subscribe,
    () => storeFor(threshold).past,
    () => false,
  );
}
