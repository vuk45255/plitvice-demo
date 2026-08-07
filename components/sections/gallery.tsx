"use client";

import { type StaticImageData } from "next/image";
import { Reveal } from "@/components/reveal";
import { ImageReveal } from "@/components/image-reveal";
import { SectionWord } from "@/components/section-word";
import { LightLeaks } from "@/components/light-leaks";
import { LightSweep } from "@/components/light-sweep";
import { PartyPhoto } from "@/components/party-photo";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";
import type { MessageKey } from "@/lib/i18n";
import dara from "@/public/party/dara.jpg";
import teodora from "@/public/party/teodora.jpg";
import thcf from "@/public/party/thcf.jpg";
import relja from "@/public/party/relja.jpg";
import rasta from "@/public/party/rasta.jpg";
import inas from "@/public/party/inas.jpg";
import semafor from "@/public/party/semafor.jpg";
import noc from "@/public/party/53.jpg";

/* Every frame is the same size — same column width, same 4:5 crop — and the
   collage comes entirely from where each one sits. The drops below break the
   grid line so the wall reads as scattered rather than tabulated. */
const photos: { src: StaticImageData; alt: MessageKey; drop: string }[] = [
  { src: dara, alt: "gallery.alt.1", drop: "md:mt-0" },
  { src: teodora, alt: "gallery.alt.2", drop: "md:mt-20" },
  { src: thcf, alt: "gallery.alt.3", drop: "md:mt-6" },
  { src: relja, alt: "gallery.alt.4", drop: "md:mt-28" },
  { src: rasta, alt: "gallery.alt.5", drop: "md:mt-12" },
  { src: inas, alt: "gallery.alt.6", drop: "md:mt-32" },
  { src: semafor, alt: "gallery.alt.7", drop: "md:mt-4" },
  { src: noc, alt: "gallery.alt.8", drop: "md:mt-24" },
];

export function Gallery() {
  const { t, tRich } = useLang();

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-title"
      className="relative isolate scroll-mt-20 overflow-hidden py-28 md:py-44"
    >
      <SectionWord word="Party" />
      {/* the busiest room on the page — and it settles before the story begins */}
      <LightLeaks intensity="strong" fadeOut />

      <div className="container-x relative z-10">
        <Reveal>
          <h2
            id="gallery-title"
            className="font-serif text-[clamp(1.75rem,3.5vw,3rem)] leading-tight tracking-tight"
          >
            <LightSweep>{tRich("gallery.title")}</LightSweep>
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-6 flex w-fit items-center gap-4">
            <span className="rail">{t("gallery.caption")}</span>
            <span className="h-px w-12 bg-line" aria-hidden="true" />
          </div>
        </Reveal>

        <ul className="mt-16 grid grid-cols-2 gap-5 sm:gap-8 md:mt-24 md:grid-cols-4 md:gap-x-8 md:gap-y-0">
          {photos.map((photo, i) => (
            <li key={i} className={photo.drop}>
              <ImageReveal delay={(i % 4) * 0.06}>
                <PartyPhoto
                  src={photo.src}
                  alt={t(photo.alt)}
                  href={site.instagramUrl}
                  cta={t("gallery.cta")}
                />
              </ImageReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
