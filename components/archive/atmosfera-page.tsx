"use client";

import { ArchiveShell } from "@/components/archive/archive-shell";
import { CinematicFrame } from "@/components/archive/cinematic-frame";
import { Reveal } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { atmosfera } from "@/lib/gallery";
import { site } from "@/lib/site";

/* The room, at full size.
 *
 * Three pictures, each given its own width and its own side of the page, with
 * a good deal of dark between them — a reel rather than a grid. The layout is
 * written out per frame instead of looped, because the whole point is that no
 * two sit the same way. */

const layout = [
  {
    className: "w-full md:w-[58%]",
    ratio: "aspect-[4/5]",
    sizes: "(min-width: 768px) 58vw, 92vw",
  },
  {
    className: "mt-[14vh] w-full md:mt-[22vh] md:ml-auto md:w-[46%]",
    ratio: "aspect-[3/4]",
    sizes: "(min-width: 768px) 46vw, 92vw",
  },
  {
    className: "mt-[14vh] w-full md:mx-auto md:mt-[20vh] md:w-[78%]",
    ratio: "aspect-[16/10]",
    sizes: "(min-width: 768px) 78vw, 92vw",
  },
];

export function AtmosferaPage() {
  const { t } = useLang();

  return (
    <ArchiveShell
      word="Atmosfera"
      caption="atmosfera.caption"
      title="atmosfera.title"
      lead="atmosfera.lead"
    >
      <div className="container-x">
        {atmosfera.map((frame, i) => (
          <CinematicFrame key={i} frame={frame} {...layout[i % layout.length]} />
        ))}

        {/* the club posts the rest of it itself */}
        <Reveal delay={0.05}>
          <div className="mt-[16vh] flex flex-wrap items-center gap-6">
            <span className="h-px w-16 bg-gold/25" aria-hidden="true" />
            <a
              href={site.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline text-[0.6875rem] uppercase tracking-[0.3em] text-night-ink/60 transition-colors duration-500 hover:text-gold"
            >
              {t("gallery.cta")}
            </a>
          </div>
        </Reveal>
      </div>
    </ArchiveShell>
  );
}
