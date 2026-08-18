"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ArchiveShell } from "@/components/archive/archive-shell";
import { ImageReveal } from "@/components/image-reveal";
import { trenutciClips } from "@/lib/gallery";

/* Two clips, and the dark around them.
 *
 * The same two files the Trenutci window on the home page runs — one list in
 * lib/gallery.ts feeds both, so the page and the window can never fall out of
 * step. Nothing is written under either of them: no year, no number, no line of
 * description. The footage is the whole of it.
 *
 * They hang off opposite edges with the second dropped below the first, which
 * is the same diagonal the home page composes with, at the scale of a page. */

/* Where each clip hangs. Two entries, written out rather than looped, because
   the point is that the two are not placed the same way. */
const layout = [
  "w-[82%] md:w-[36%]",
  "mt-[10vh] w-[82%] self-end md:-mt-[16vh] md:w-[36%]",
];

export function TrenutciPage() {
  return (
    <ArchiveShell
      word="Trenutci"
      caption="trenutci.caption"
      title="trenutci.title"
      lead="trenutci.lead"
    >
      <div className="container-x flex flex-col">
        {trenutciClips.map((src, i) => (
          <div key={src} className={layout[i % layout.length]}>
            <ImageReveal delay={i * 0.08}>
              <Clip src={src} />
            </ImageReveal>
          </div>
        ))}
      </div>
    </ArchiveShell>
  );
}

/* Plays only while on screen: a paused video off-screen costs nothing, and
   nothing here should ever compete with the page for decode time. Muted,
   looping, inline, and without a control in sight. */
function Clip({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void node.play().catch(() => {});
        else node.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div className="relative aspect-[9/16] overflow-hidden">
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* the room settling back over the bottom edge, as on every frame */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
