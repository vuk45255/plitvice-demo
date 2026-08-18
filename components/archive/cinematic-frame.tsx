"use client";

import Image from "next/image";
import { ImageReveal } from "@/components/image-reveal";
import { useLang } from "@/components/providers/language";
import type { Frame } from "@/lib/gallery";

/* One photograph on an archive page.
 *
 * The picture and nothing else. No two are the same size and no two sit on the
 * same line — the width, the crop and the side it hangs off are given per
 * picture by the page — and each frame opens downward as it arrives, so the
 * page reveals itself the way a reel does rather than all at once.
 *
 * There is no caption, no number and no date under any of these. The written
 * description survives only as the alt text, for anyone who cannot see the
 * photograph; nothing about it is drawn. */

type CinematicFrameProps = {
  frame: Frame;
  /* Width and placement, given by the page. */
  className?: string;
  ratio: string;
  sizes: string;
};

export function CinematicFrame({
  frame,
  className,
  ratio,
  sizes,
}: CinematicFrameProps) {
  const { t } = useLang();

  return (
    <figure className={className}>
      <ImageReveal>
        <div className={`relative overflow-hidden ${ratio}`}>
          <Image
            src={frame.src}
            alt={t(frame.caption)}
            placeholder="blur"
            sizes={sizes}
            fill
            className="img-grade object-cover"
          />
          {/* the room settling back over the bottom edge of every picture */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-transparent"
            aria-hidden="true"
          />
        </div>
      </ImageReveal>
    </figure>
  );
}
