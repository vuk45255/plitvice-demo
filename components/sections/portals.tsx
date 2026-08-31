"use client";

import {
  Portal,
  PortalClips,
  PortalStills,
  PORTAL_WIDTH,
} from "@/components/portal";
import { SectionWord } from "@/components/section-word";
import { LightLeaks } from "@/components/light-leaks";
import { useLang } from "@/components/providers/language";
import { atmosfera, trenutciClips } from "@/lib/gallery";
import type { Poster } from "@/lib/club/poster-assets";

/* Three windows into the club, hung on the dark.
 *
 * All three are cut to the same size and the same crop, and none of them
 * carries a word — the composition is entirely where they hang. The first sits
 * high and left, the second in the middle of the room, the last falls away to
 * the right, and each one rides up into the band of the one before it, so the
 * three read as a single diagonal rather than as three stops on a scroll.
 *
 * The section's own light rig, its smoke, its grain and the word standing
 * behind it all are untouched, and they show through everywhere the pictures
 * are not. The dark between the windows is still the point; there is simply
 * less of it than there was.
 *
 * On a phone the diagonal becomes a stagger — the same three sizes, hung off
 * alternating edges, with the overlap traded for a short gap so nothing
 * collides in a single column. */

const sizes = "(min-width: 768px) 20vw, 72vw";

/* The artwork cycling in the middle window is every night's poster, in the
   programme's own order, handed in from the page. */
export function Portals({ posters }: { posters: Poster[] }) {
  const { t } = useLang();

  return (
    <section
      id="gallery"
      aria-labelledby="portals-title"
      className="section-word-host relative isolate scroll-mt-20 overflow-hidden py-24 md:py-28"
    >
      <SectionWord word="Galerija" />
      <LightLeaks intensity="strong" fadeOut />

      <div className="container-x relative z-10">
        {/* The section still has a name — it is simply not the thing you look
            at. The backdrop word carries it visually. */}
        <h2 id="portals-title" className="sr-only">
          {t("portals.heading")}
        </h2>

        <div className="relative mx-auto flex max-w-[1240px] flex-col">
          {/* upper left — the room */}
          <Portal
            href="/atmosfera"
            label={t("portals.atmosfera")}
            drift={26}
            className={`${PORTAL_WIDTH} self-start`}
            media={({ playing }) => (
              <PortalStills
                images={atmosfera.map((frame) => frame.src)}
                sizes={sizes}
                interval={5500}
                playing={playing}
              />
            )}
          />

          {/* the middle of the room — the artwork of every night */}
          <Portal
            href="/zurke"
            label={t("portals.zurke")}
            delay={0.12}
            drift={14}
            className={`${PORTAL_WIDTH} mt-8 self-end md:-mt-[5vw] md:self-center`}
            media={({ playing }) => (
              <PortalStills
                images={posters}
                sizes={sizes}
                interval={6500}
                playing={playing}
              />
            )}
          />

          {/* lower right — the club's own footage, one clip after the other */}
          <Portal
            href="/trenutci"
            label={t("portals.trenutci")}
            delay={0.24}
            drift={32}
            className={`${PORTAL_WIDTH} mt-8 self-start md:-mt-[5vw] md:self-end`}
            media={({ playing }) => (
              <PortalClips sources={trenutciClips} playing={playing} />
            )}
          />
        </div>
      </div>
    </section>
  );
}
