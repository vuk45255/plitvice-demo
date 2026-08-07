"use client";

import { Reveal } from "@/components/reveal";
import { ImageReveal } from "@/components/image-reveal";
import { SectionWord } from "@/components/section-word";
import { Ambient } from "@/components/ambient";
import { StoryVideo } from "@/components/story-video";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";
import aboutImg from "@/public/images/about.jpg";

/* Not an introduction to a club — a heritage story. Text on the left, one
   tall film on the right, and a great deal of air between them. */
export function About() {
  const { t, tRich } = useLang();

  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="relative isolate scroll-mt-20 overflow-hidden py-32 md:py-52"
    >
      <SectionWord word="About Us" />
      <Ambient variant="soft" />

      {/* warm light spilling in from the left, low — the lamp over the bar */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 55% at 4% 70%, rgba(200,164,93,0.11), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="container-x relative z-10">
        <div className="grid items-center gap-20 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6 md:pr-16">
            <Reveal>
              <h2
                id="about-title"
                className="font-serif text-[clamp(2.25rem,5.5vw,4.75rem)] leading-[1.02] tracking-tight"
              >
                {tRich("about.title")}
              </h2>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="mt-12 max-w-[34rem] space-y-6 text-base leading-[1.8] text-ink-muted">
                <p>{t("about.p1")}</p>
                <p>{t("about.p2")}</p>
                <p className="text-ink">
                  {t("about.p3a")}
                  <br />
                  {t("about.p3b")}
                </p>
              </div>
            </Reveal>
          </div>

          <div className="md:col-span-5 md:col-start-8">
            <ImageReveal delay={0.1}>
              <div className="mx-auto w-full max-w-[24rem] md:mx-0">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[4px]">
                  <StoryVideo
                    src={site.storyVideo}
                    poster="/images/about.jpg"
                    fallback={aboutImg}
                    alt={t("about.videoAlt")}
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-night/50 via-transparent to-transparent"
                    aria-hidden="true"
                  />
                </div>
                <p className="rail mt-6 block">{t("about.caption")}</p>
              </div>
            </ImageReveal>
          </div>
        </div>

        {/* The story continues under the frame, set in two columns so it reads
            like a page rather than a wall of text. */}
        <div className="mt-24 md:mt-32">
          <Reveal>
            <div className="h-px w-full bg-line" aria-hidden="true" />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-16 gap-x-16 text-base leading-[1.8] text-ink-muted md:columns-2 md:gap-x-20 [&>p]:mb-6 [&>p]:break-inside-avoid">
              <p>{t("about.story1")}</p>
              <p>{t("about.story2")}</p>
              <p>{t("about.story3")}</p>
              <p className="text-ink">{t("about.story4")}</p>
              <p>{t("about.story5")}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
