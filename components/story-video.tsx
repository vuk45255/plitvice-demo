"use client";

import { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { useFilmInView } from "@/lib/use-film";

type StoryVideoProps = {
  src: string | null;
  poster: string;
  fallback: StaticImageData;
  alt: string;
};

/* The heritage film. It plays itself — muted, looping, inline — and if the
   file will not load, the still quietly takes its place instead. */
export function StoryVideo({ src, poster, fallback, alt }: StoryVideoProps) {
  const [failed, setFailed] = useState(false);
  const film = useFilmInView<HTMLVideoElement>();

  if (!src || failed) {
    return (
      <Image
        src={fallback}
        alt={alt}
        placeholder="blur"
        sizes="(min-width: 768px) 32vw, 88vw"
        className="img-grade absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <video
      ref={film}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      onError={() => setFailed(true)}
      aria-label={alt}
      className="img-grade absolute inset-0 h-full w-full object-cover"
    />
  );
}
