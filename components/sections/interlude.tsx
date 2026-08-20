"use client";

import { useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";

/* The brand's signature, set as a wide cinematic band between two sections —
   edge to edge, deliberately low. Not a hero and not a page of its own: the
   film runs quietly behind, the mark sits still in the middle of it. */
export function Interlude() {
  const reduced = useReducedMotion();
  const { t } = useLang();

  return (
    <section
      aria-labelledby="signature-title"
      className="relative isolate h-[320px] w-full overflow-hidden bg-night sm:h-[400px] md:h-[460px] lg:h-[500px]"
    >
      <video
        src={site.reelVideo}
        autoPlay={!reduced}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="img-grade absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* velvet over the film — deep enough for the type to hold, warm enough
          to stay the club's own colour */}
      <div className="absolute inset-0 bg-night/55" aria-hidden="true" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 90% at 50% 50%, rgba(200,164,93,0.12), transparent 70%), radial-gradient(85% 95% at 50% 50%, transparent 25%, rgba(8,5,13,0.85) 100%)",
        }}
        aria-hidden="true"
      />

      {/* the seams into the sections above and below */}
      <div
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-night to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-night to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-night-ink">
        <Reveal y={16}>
          <p className="rail rail-center rail-night">{t("interlude.top")}</p>
        </Reveal>
        <Reveal y={16} delay={0.1}>
          <h2
            id="signature-title"
            className="mt-5 font-serif text-[clamp(1.875rem,5.5vw,4rem)] italic leading-[1.05] [text-shadow:0_0_60px_rgba(8,5,13,0.9)] sm:mt-6"
          >
            {t("interlude.title")}
          </h2>
        </Reveal>
        <Reveal y={16} delay={0.2}>
          <p className="rail rail-center rail-night mt-6 !text-[0.5625rem] sm:mt-7 sm:!text-[0.6875rem]">
            {t("interlude.bottom")}
          </p>
        </Reveal>

        {/* HIDDEN FOR THE DEMO — the way into the story goes here, and the
            band grows by roughly 72px at each breakpoint to hold it:

              <Reveal y={16} delay={0.32}>
                <div className="mt-9 sm:mt-11">
                  <QuietLink href={site.aboutPath} label={t("nav.about")} />
                </div>
              </Reveal>

            Restore it together with the navigation entry in lib/site.ts and
            the redirect in next.config.ts. Nothing else was removed. */}
      </div>
    </section>
  );
}
