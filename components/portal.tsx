"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { EASE } from "@/components/reveal";

/* A window into one part of the club.
 *
 * There is no card here — no panel, no border at rest, no shadow, and no words.
 * The photography is the whole object, and the dark room of the section is what
 * surrounds it. All three windows are cut to the same size and the same crop;
 * the composition comes entirely from where each one hangs.
 *
 * Inside the frame the picture changes on the window's own clock, so no two
 * windows on the page are ever turning together. Everything stops while the
 * window is off screen or under the cursor, and everything is transform,
 * opacity and filter, so it stays on the compositor. */

/* One shape for all three — portrait, editorial, and identical everywhere. */
export const PORTAL_RATIO = "aspect-[3/4]";
export const PORTAL_WIDTH =
  "w-[72%] sm:w-[62%] md:w-[clamp(280px,20vw,380px)]";

type PortalProps = {
  href: string;
  /* The category name, set on the frame itself. It is also what names the link,
     so there is no second copy of it for screen readers to read out. */
  label: string;
  /* Rendered with the window's own play state: false while it is off screen or
     held under the cursor. */
  media: (state: { playing: boolean }) => React.ReactNode;
  /* Where the window hangs. */
  className?: string;
  /* Reveal order as the section is scrolled into. */
  delay?: number;
  /* Pixels of parallax travel across the section. Kept small on purpose. */
  drift?: number;
};

export function Portal({
  href,
  label,
  media,
  className,
  delay = 0,
  drift = 0,
}: PortalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [held, setHeld] = useState(false);

  /* A window nobody is looking at should cost nothing. */
  const inView = useInView(ref, { margin: "200px" });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [drift, -drift]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y: reduced || !drift ? undefined : y }}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: reduced ? 0 : 1, delay, ease: EASE }}
      >
        <Link
          href={href}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          className="group block cursor-pointer"
        >
          <div
            className={`relative overflow-hidden ${PORTAL_RATIO} ring-1 ring-gold/0 transition-[box-shadow] duration-700 group-hover:ring-gold/40 group-focus-visible:ring-gold/40`}
          >
            {/* only the picture moves — the name is hung on the frame, not on
                the photograph, so it never drifts or softens */}
            <div className="absolute inset-0 transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.03] group-hover:brightness-[1.06] group-hover:contrast-[1.04]">
              {media({ playing: inView && !held })}
            </div>

            {/* the room falling across the bottom edge, so the name always has
                something to sit on whatever the picture underneath it is */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
              style={{
                background:
                  "linear-gradient(to top, rgba(8,5,13,0.80), rgba(8,5,13,0.30) 45%, transparent)",
              }}
              aria-hidden="true"
            />

            {/* One treatment for all three windows — the component draws it, so
                the three names can never drift apart. */}
            <span className="absolute bottom-0 left-0 p-5 text-[0.6875rem] uppercase leading-none tracking-[0.42em] text-night-ink/90 transition-colors duration-500 group-hover:text-gold-light md:p-6">
              {label}
            </span>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* Stills, cross-fading on the window's own clock. Pictures are mounted as they
   are needed — the one showing, the one after it, and everything already seen —
   so a ten-poster window costs two images on arrival rather than ten. */
export function PortalStills({
  images,
  sizes,
  playing,
  interval,
}: {
  images: StaticImageData[];
  sizes: string;
  playing: boolean;
  interval: number;
}) {
  const reduced = useReducedMotion();
  const { index, reach } = useTurning(images.length, interval, playing);

  return (
    <>
      {images.map((image, i) =>
        i <= reach ? (
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={false}
            animate={{
              opacity: i === index ? 1 : 0,
              scale: reduced || i === index ? 1 : 1.045,
            }}
            transition={{
              opacity: { duration: reduced ? 0.4 : 1.6, ease: EASE },
              scale: { duration: reduced ? 0 : 2.4, ease: EASE },
            }}
          >
            <Image
              src={image}
              alt=""
              placeholder="blur"
              sizes={sizes}
              fill
              className="img-grade object-cover"
            />
          </motion.div>
        ) : null,
      )}
    </>
  );
}

/* Clips, each one played to its end before the next fades up under it. Both are
   mounted so the incoming frame is already decoded when the fade starts; only
   the one showing is ever running. */
export function PortalClips({
  sources,
  playing,
}: {
  sources: string[];
  playing: boolean;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const clips = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    clips.current.forEach((clip, i) => {
      if (!clip) return;
      if (i === index && playing && !reduced) void clip.play().catch(() => {});
      else clip.pause();
    });
  }, [index, playing, reduced]);

  return (
    <>
      {sources.map((src, i) => (
        <motion.video
          key={src}
          ref={(node) => {
            clips.current[i] = node;
          }}
          src={src}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          /* Rewind as it finishes, so its turn always starts from the top. */
          onEnded={(e) => {
            e.currentTarget.currentTime = 0;
            setIndex((current) => (current + 1) % sources.length);
          }}
          className="absolute inset-0 h-full w-full object-cover"
          initial={false}
          animate={{ opacity: i === index ? 1 : 0 }}
          transition={{ duration: reduced ? 0.4 : 1.4, ease: EASE }}
        />
      ))}
    </>
  );
}

/* The clock behind the stills. `reach` is how far the window has ever got,
   carried alongside the index so the frame knows which pictures are worth
   having in the document. It only ever grows. */
function useTurning(count: number, interval: number, playing: boolean) {
  const [state, setState] = useState({ index: 0, reach: 1 });

  useEffect(() => {
    if (count < 2 || !playing) return;
    const id = window.setInterval(() => {
      setState(({ index, reach }) => {
        const next = (index + 1) % count;
        return { index: next, reach: Math.max(reach, next + 1) };
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [count, interval, playing]);

  return state;
}
