"use client";

import Image, { type ImageProps } from "next/image";
import { isBundled, type Poster } from "@/lib/club/poster-assets";

/* A NIGHT'S ARTWORK, DRAWN THE ONE WAY.
 *
 * ═══ WHY THIS EXISTS NOW AND DID NOT BEFORE ═══════════════════════════════
 *
 * Every poster on this site used to be an `import` — the bundler read the file
 * at build time, worked out its dimensions and computed the tiny blurred
 * version that every one of them fades up out of. `placeholder="blur"` was safe
 * to write at every call site because there was no other kind of poster.
 *
 * There is now. A poster uploaded from the office is a URL on a CDN: no
 * dimensions, no blur, and `placeholder="blur"` against one THROWS rather than
 * degrading. So the decision moved here, where it is made once:
 *
 *   a picture that came with the build  → blurs up exactly as it always did
 *   a URL                               → renders with no placeholder
 *   nothing                             → renders nothing, and the layout
 *                                         around it is unchanged
 *
 * Everything else is passed straight through, so each call site keeps its own
 * `sizes`, `fill`, `priority` and classes and the markup is what it was. */

type Props = Omit<ImageProps, "src" | "placeholder"> & {
  poster: Poster | undefined;
};

export function PosterImage({ poster, alt, ...rest }: Props) {
  if (!poster) return null;
  return (
    <Image
      src={poster}
      alt={alt}
      placeholder={isBundled(poster) ? "blur" : "empty"}
      {...rest}
    />
  );
}
