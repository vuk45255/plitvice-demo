"use client";

import { Reveal } from "@/components/reveal";
import { ImageReveal } from "@/components/image-reveal";
import { SectionHead } from "@/components/section-head";
import { SectionWord } from "@/components/section-word";
import { SocialLinks } from "@/components/social-links";
import { useLang } from "@/components/providers/language";
import { mapsEmbedUrl, site } from "@/lib/site";

export function Location() {
  const { t, tRich, lang } = useLang();

  return (
    <section
      id="location"
      aria-labelledby="location-title"
      className="relative isolate scroll-mt-28 overflow-hidden py-28 md:scroll-mt-20 md:py-44"
    >
      <SectionWord word="Location" />

      <div className="container-x relative z-10">
        <div className="grid gap-16 md:grid-cols-12 md:gap-8">
          <div className="min-w-0 md:col-span-5">
            <SectionHead
              title={tRich("location.title")}
              caption={t("location.caption")}
              titleId="location-title"
            />

            <Reveal delay={0.24}>
              <dl className="mt-12 space-y-10">
                <div>
                  <dt className="label">{t("location.address")}</dt>
                  <dd className="mt-3 text-base leading-relaxed">
                    {site.street}
                    <br />
                    {site.town}
                    <br />
                    <a
                      href={site.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-underline mt-2 inline-block text-sm text-ink-muted transition-colors duration-300 hover:text-ink"
                    >
                      {t("location.maps")}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="label">{t("location.hours")}</dt>
                  <dd className="mt-3">
                    <ul className="space-y-2 text-base">
                      {site.hours.map((entry) => (
                        <li
                          key={entry.days}
                          className="flex items-baseline justify-between gap-4 border-b border-line pb-2 sm:gap-8"
                        >
                          <span>{t(entry.days)}</span>
                          {/* The day sits on the left edge of the column and the
                              hour on the right edge of the same column, which is
                              what justify-between already does. All a phone
                              needs is less air between the two and a hair less
                              type in the hour — enough that the line still has
                              room to spare at 320px without either half being
                              cut or shortened. */}
                          <span className="text-right text-[0.9375rem] tabular-nums text-ink-muted sm:text-base">
                            {t(entry.time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>

              {/* The second editorial line in the column — the same serif and
                  the same italic first word as the section title, set smaller
                  so the title still leads. */}
              {/* The two big beats in the column are the second headline and
                  the map. On a phone they sit closer together than the desktop
                  spread wants them, so the first is brought in a little and the
                  pair read as one rhythm rather than two pauses. */}
              <div className="mt-12 md:mt-14">
                <h3 className="font-serif text-[clamp(1.625rem,3.85vw,3.3rem)] leading-[1.02] tracking-tight">
                  {tRich("location.follow")}
                </h3>
                <p className="label mt-6">{t("location.social")}</p>
                <div className="mt-4">
                  <SocialLinks />
                </div>
              </div>
            </Reveal>
          </div>

          <div className="min-w-0 md:col-span-6 md:col-start-7">
            <ImageReveal delay={0.1}>
              {/* The map stands where the photograph of the door stood, in the
                  same frame: the same corner, the same shadow under it, and the
                  same 16:9 on a wide screen. On a phone that ratio would leave a
                  strip too shallow to read a street off, so the phone gets 4:3
                  instead — still landscape, deep enough to read a street off.
                  
                  IT IS THE WIDTH THAT LEADS AND THE HEIGHT THAT FOLLOWS, always.
                  A floor under the frame did the same job here until a phone was
                  narrow enough that the ratio ran the other way and set the
                  WIDTH off the minimum height — 494px of map inside a 334px
                  column, which took the whole column out with it. A ratio and a
                  minimum height must never be asked of the same box. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] shadow-[0_18px_50px_-24px_rgba(8,5,13,0.85)] md:aspect-video">
                <iframe
                  src={mapsEmbedUrl(lang)}
                  title={t("location.mapAria")}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </ImageReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
