"use client";

import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { ImageReveal } from "@/components/image-reveal";
import { SectionHead } from "@/components/section-head";
import { SectionWord } from "@/components/section-word";
import { SocialLinks } from "@/components/social-links";
import { useLang } from "@/components/providers/language";
import { ReserveButton } from "@/components/reservation/reserve-button";
import { site } from "@/lib/site";
import locationImg from "@/public/lokacija/nadjime.jpg";

export function Location() {
  const { t, tRich } = useLang();

  return (
    <section
      id="location"
      aria-labelledby="location-title"
      className="relative isolate scroll-mt-20 overflow-hidden py-28 md:py-44"
    >
      <SectionWord word="Location" />

      <div className="container-x relative z-10">
        <div className="grid gap-16 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
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
                          className="flex items-baseline justify-between gap-8 border-b border-line pb-2"
                        >
                          <span>{t(entry.days)}</span>
                          <span className="tabular-nums text-ink-muted">
                            {t(entry.time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="label">{t("location.social")}</dt>
                  <dd className="mt-4">
                    <SocialLinks />
                  </dd>
                </div>
              </dl>
            </Reveal>

            {/* Address, hours, and then the table — the last thing read in
                this column is the way to book one. */}
            <Reveal delay={0.32}>
              <div className="mt-12 border-t border-line pt-10">
                <ReserveButton
                  label="common.reserveTable"
                  className="w-full text-center sm:w-auto"
                />
              </div>
            </Reveal>
          </div>

          <div className="md:col-span-6 md:col-start-7">
            <ImageReveal delay={0.1}>
              <a
                href={site.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("location.mapAria")}
                className="group block overflow-hidden rounded-[6px] shadow-[0_18px_50px_-24px_rgba(8,5,13,0.85)]"
              >
                {/* 16:9 is the file's own ratio, so nothing is cropped away. */}
                <Image
                  src={locationImg}
                  alt={t("location.imgAlt")}
                  placeholder="blur"
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="img-grade aspect-video h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                />
              </a>
            </ImageReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
