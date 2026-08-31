"use client";

import { useEffect, useState } from "react";

/* HAS THE PAGE MOVED PAST A POINT — the one thing the two bars need to know.
 *
 * It used to be asked of Lenis, through a callback Lenis ran on every frame it
 * moved the page. That is not available on a phone any more, where Lenis is
 * not mounted (see components/providers/smooth-scroll.tsx), and it was never
 * the right instrument in the first place: the page's own `scroll` event says
 * exactly the same thing, on a desk and on a phone alike, and Lenis scrolls
 * the real window so it fires there too.
 *
 * PASSIVE, so it can never delay a scroll; coalesced onto a frame, so a burst
 * of events costs one read of `scrollY`; and compared against the last answer,
 * so React is entered on the two frames a visit where the answer changes
 * rather than on every frame of every scroll. */
export function useScrolledPast(threshold: number) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let queued = 0;
    let was = false;

    const read = () => {
      queued = 0;
      const now = window.scrollY > threshold;
      if (now === was) return;
      was = now;
      setPast(now);
    };

    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (queued) cancelAnimationFrame(queued);
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return past;
}
