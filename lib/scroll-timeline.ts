"use client";

import { useEffect, useState, type RefObject } from "react";
import { COARSE_QUERY, useMediaQuery } from "@/lib/use-media";

/* WHETHER A SCROLL-LINKED LAYER CAN BE HANDED TO THE COMPOSITOR.
 *
 * The background words were the first thing on the site to move this way —
 * see `.section-word-drift` in app/globals.css for the long version. On a
 * phone the compositor scrolls the page and the main thread hears about it
 * late, so anything JavaScript moves "with" the scroll moves behind it. A
 * scroll-driven animation is interpolated where the scrolling happens and
 * cannot fall behind.
 *
 * Asked once per document: the answer is a property of the browser. */
let viewTimelines: boolean | undefined;

export function supportsViewTimeline() {
  viewTimelines ??=
    typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");
  return viewTimelines;
}

/* A FINGER, A BROWSER THAT CAN DO IT, AND A SECTION THAT NAMES THE TIMELINE.
 *
 * The timeline these layers read is `--section-word`, which a section declares
 * by wearing `.section-word-host` (and only on a coarse pointer, in CSS, under
 * the same query as below — so the two halves cannot disagree). A rig is only
 * handed to it when it is that section's DIRECT child: that is what makes the
 * section's box and the rig's box the same box, which is what the JavaScript
 * measured. Anywhere else — a rig nested in a header, or in a pinned scene —
 * the rig keeps the JavaScript path it always had.
 *
 * Starts false on the server and on the first client render, so hydration
 * matches, and settles once after mount. */
export function useHostedViewTimeline(ref: RefObject<HTMLElement | null>) {
  const coarse = useMediaQuery(COARSE_QUERY);
  const [hosted, setHosted] = useState(false);

  useEffect(() => {
    const parent = ref.current?.parentElement;
    setHosted(!!parent && parent.classList.contains("section-word-host"));
  }, [ref]);

  return coarse && hosted && supportsViewTimeline();
}
