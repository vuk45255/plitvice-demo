"use client";

import { useEffect, useRef, useState } from "react";

/* IS THIS ANYWHERE NEAR THE SCREEN — asked once, of one element, cheaply.
 *
 * The site already has `useInView` from the animation library wherever a
 * component is measuring its own scroll anyway. This is for the other case:
 * a piece of chrome whose only reason to know is that it is running a CSS
 * animation it should not be running off screen. No scroll listener, no
 * layout read, one IntersectionObserver, and a state change at most twice per
 * pass.
 *
 * The margin is deliberately generous. Nothing here is a reveal — the point is
 * to stop a loop nobody can see, not to start one in front of somebody — so
 * the answer flips well before the element is in the viewport and the visitor
 * only ever meets it already running. */
export function useNearViewport<T extends Element>(margin = "300px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const watch = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: margin },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, [margin]);

  return [ref, near] as const;
}
