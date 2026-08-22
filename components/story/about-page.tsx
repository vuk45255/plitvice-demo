"use client";

import { useEffect } from "react";
import { SkipLink } from "@/components/skip-link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ClaimHero } from "@/components/story/claim-hero";
import { ArchiveJourney } from "@/components/story/archive-journey";
import { useEntrance } from "@/components/providers/entrance";

/* The story of the house, at /o-nama.
 *
 * Always night, the way the archive rooms are: the theme toggle changes the
 * rest of the site around it, but a page that is about a room after midnight
 * is that room whichever way the switch sits.
 *
 * Two chapters, in the order the house is met in: what Plitvice claims to be
 * now, and the archive itself — which pins to the screen and scrubs the house
 * from 1965 to tonight across five compositions, ending on the statement the
 * whole page turns on.
 *
 * The chapters deliberately carry no `overflow: hidden`. Several of them pin a
 * child to the screen, and an overflow container on an ancestor would make
 * that child stick to a box that never scrolls; the clipping the backdrop word
 * needs is done by its own frame instead. */
export function AboutPage() {
  const { entered, enter } = useEntrance();

  /* The house mark's reveal is what opens the doors, and it only happens on
     the home page. Arriving here directly, the chrome is simply already in. */
  useEffect(() => {
    if (!entered) enter();
  }, [entered, enter]);

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main
        id="main"
        className="relative isolate overflow-x-clip bg-night text-night-ink"
      >
        <ClaimHero />
        <ArchiveJourney />

        {/* The footer belongs to the themed site. On ivory it would meet this
            page as an edge, so the night is graded into it instead. */}
        <div
          className="h-24 bg-gradient-to-b from-night to-surface md:h-32"
          aria-hidden="true"
        />
      </main>

      <SiteFooter wall={false} />
    </>
  );
}
