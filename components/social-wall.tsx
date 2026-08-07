"use client";

import { useEffect, useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/reveal";
import { LightLeaks } from "@/components/light-leaks";
import { LightSweep } from "@/components/light-sweep";
import { TiltCard } from "@/components/tilt-card";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";
import type { MessageKey } from "@/lib/i18n";
import shot1 from "@/public/instagram/469059425_18476195971044345_4235207755024478138_n.jpg";
import shot2 from "@/public/instagram/469127602_18476195941044345_2574816115416059072_n.jpg";
import shot3 from "@/public/instagram/470425204_18478972765044345_1296011379318529129_n.jpg";

/* The club's own feed, straight from /public/instagram — three stills and two
   vertical clips, nothing borrowed from the party wall further up.

   Frames are deliberately unequal and hang off different baselines, so the
   block reads as a wall of posts rather than a gallery. Every tile opens the
   profile. */

const clip1 = "/instagram/instagram-1-small.mp4";
const clip2 = "/instagram/instagram-2-small.mp4";

type Tile =
  | {
      kind: "photo";
      src: StaticImageData;
      alt: MessageKey;
      column: string;
      ratio: string;
    }
  | {
      kind: "clip";
      src: string;
      alt: MessageKey;
      column: string;
      ratio: string;
    };

/* Wider spans and shallower drops than before: the pictures should own the
   space, with just enough offset left to keep the wall from lining up. */
const tiles: Tile[] = [
  {
    kind: "photo",
    src: shot1,
    alt: "feed.photo.1",
    column: "md:col-span-5",
    ratio: "aspect-[4/5]",
  },
  {
    kind: "clip",
    src: clip1,
    alt: "feed.reel.1",
    column: "md:col-span-3 md:mt-10",
    ratio: "aspect-[9/16]",
  },
  {
    kind: "photo",
    src: shot3,
    alt: "feed.photo.3",
    column: "col-span-2 md:col-span-4 md:mt-20",
    ratio: "aspect-[3/2]",
  },
  {
    kind: "clip",
    src: clip2,
    alt: "feed.reel.2",
    column: "md:col-span-4 md:col-start-2 md:mt-6",
    ratio: "aspect-[9/16]",
  },
  {
    kind: "photo",
    src: shot2,
    alt: "feed.photo.2",
    column: "md:col-span-5 md:col-start-7",
    ratio: "aspect-[4/5]",
  },
];

/* Instagram's own reel glyph, drawn in the site's hairline weight. */
function ReelMark() {
  return (
    <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-gold/50 bg-night/45 backdrop-blur-sm transition-[transform,border-color] duration-500 group-hover:scale-110 group-hover:border-gold">
      <svg viewBox="0 0 24 24" className="ml-[2px] h-3 w-3 fill-gold-light">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  );
}

/* Plays only while on screen: a paused video off-screen costs nothing, and
   nothing here should ever compete with the page for decode time. */
function Clip({ src, ratio }: { src: string; ratio: string }) {
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
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] ${ratio}`}
    />
  );
}

export function SocialWall() {
  const { t } = useLang();
  const reduced = useReducedMotion();

  return (
    <section
      aria-labelledby="wall-title"
      className="relative isolate mt-20 overflow-hidden md:mt-28"
    >
      {/* the full rig here too — this is the last room the visitor stands in */}
      <LightLeaks intensity="strong" />

      <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-4">
        <h2
          id="wall-title"
          className="font-serif text-[clamp(1.5rem,3vw,2.5rem)] leading-tight tracking-tight"
        >
          <LightSweep>{t("feed.title")}</LightSweep>
        </h2>
        <a
          href={site.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline text-[0.6875rem] uppercase tracking-[0.24em] text-ink-muted transition-colors duration-300 hover:text-accent"
        >
          {site.instagramHandle}
        </a>
      </div>

      <ul className="relative z-10 mt-10 grid grid-cols-2 gap-2 md:mt-14 md:grid-cols-12 md:gap-3">
        {tiles.map((tile, i) => (
          <motion.li
            key={i}
            className={tile.column}
            style={{ perspective: 1200 }}
            initial={reduced ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8% 0px" }}
            transition={{
              duration: reduced ? 0 : 0.85,
              delay: reduced ? 0 : i * 0.09,
              ease: EASE,
            }}
          >
            {/* each tile drifts on its own clock, so no two sit at the same
                depth for long */}
            <motion.div
              animate={reduced ? undefined : { y: [0, -7, 0] }}
              transition={{
                duration: 9 + i * 1.7,
                delay: i * 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <TiltCard>
                <a
                  href={site.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t(tile.alt)} — ${t("common.openInstagram")}`}
                  className="group relative block overflow-hidden shadow-[0_18px_45px_-28px_rgba(8,5,13,0.9)] transition-shadow duration-500 hover:shadow-[0_26px_70px_-24px_rgba(126,74,186,0.55)]"
                >
                  {tile.kind === "photo" ? (
                    <Image
                      src={tile.src}
                      alt={t(tile.alt)}
                      placeholder="blur"
                      sizes="(min-width: 768px) 40vw, 50vw"
                      className={`club-grade h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] ${tile.ratio}`}
                    />
                  ) : (
                    <Clip src={tile.src} ratio={tile.ratio} />
                  )}

                  {/* the grade: purple, magenta and blue pushed into the
                      picture rather than laid on top of it */}
                  <div
                    className="absolute inset-0 opacity-55 mix-blend-overlay"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(126,74,186,0.55), rgba(190,60,150,0.28) 45%, rgba(64,96,190,0.5))",
                    }}
                    aria-hidden="true"
                  />

                  {/* nothing sits over the picture at rest — the room only
                      darkens once you reach for it */}
                  <div
                    className="absolute inset-0 transition-colors duration-500 group-hover:bg-night/40"
                    aria-hidden="true"
                  />
                  <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{
                      background:
                        "radial-gradient(75% 65% at 50% 100%, rgba(126,74,186,0.6), transparent 72%)",
                    }}
                    aria-hidden="true"
                  />

                  {/* one pass of light across the glass on hover */}
                  <span
                    className="pointer-events-none absolute -inset-y-1/2 left-0 w-1/3 -translate-x-[160%] rotate-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-[420%]"
                    aria-hidden="true"
                  />

                  {tile.kind === "clip" && <ReelMark />}

                  <span className="absolute inset-x-0 bottom-0 flex justify-center pb-5 text-[0.5625rem] uppercase tracking-[0.32em] text-night-ink/0 transition-colors duration-500 group-hover:text-night-ink/85">
                    {tile.kind === "clip" ? t("feed.watch") : t("gallery.cta")}
                  </span>
                </a>
              </TiltCard>
            </motion.div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
