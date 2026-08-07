"use client";

import Image, { type StaticImageData } from "next/image";
import { Reveal } from "@/components/reveal";
import { SectionHead } from "@/components/section-head";
import { SectionWord } from "@/components/section-word";
import { Ambient } from "@/components/ambient";
import { useLang } from "@/components/providers/language";
import { featuredEvent, pastEvents, site } from "@/lib/site";
import daraImg from "@/public/dogadjaji/dara.jpg";
import kacaImg from "@/public/dogadjaji/kaca.jpg";
import semaforImg from "@/public/dogadjaji/semafor.jpg";

const artwork: Record<string, StaticImageData> = {
  dara: daraImg,
  kaca: kacaImg,
  semafor: semaforImg,
};

export function Events() {
  const { t, tRich } = useLang();

  return (
    <section
      id="events"
      aria-labelledby="events-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-surface-2 py-28 md:py-44"
    >
      <SectionWord word="Events" />
      <Ambient variant="soft" />

      {/* one warm light raking in from the right, as if from the bar */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 45% at 100% 22%, rgba(200,164,93,0.1), transparent 68%)",
        }}
        aria-hidden="true"
      />
      <div className="container-x relative z-10">
        <SectionHead
          title={tRich("events.title")}
          titleId="events-title"
          align="right"
        />

        {/* The night ahead takes the room; the nights behind it sit smaller and
            in grey until you look at them. */}
        <div className="mt-16 grid gap-14 md:mt-24 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            <Reveal y={36}>
              <p className="rail mb-6 block">{t("events.next")}</p>
              <a
                href={site.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block"
              >
                {/* the glow that marks this one out */}
                <div
                  className="pointer-events-none absolute -inset-6 -z-10 opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(60% 50% at 50% 55%, rgba(200,164,93,0.35), transparent 72%)",
                  }}
                  aria-hidden="true"
                />
                <div className="relative overflow-hidden ring-1 ring-gold/35 transition-shadow duration-300 group-hover:shadow-[0_0_60px_-12px_rgba(200,164,93,0.55)]">
                  <Image
                    src={artwork[featuredEvent.slug]}
                    alt={t(featuredEvent.alt)}
                    placeholder="blur"
                    sizes="(min-width: 768px) 56vw, 92vw"
                    className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    className="absolute inset-0 transition-colors duration-300 group-hover:bg-night/45 group-focus-visible:bg-night/45"
                    aria-hidden="true"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="text-[0.8125rem] uppercase tracking-[0.4em] text-gold-light indent-[0.4em]">
                      {t("events.more")}
                    </span>
                  </div>
                </div>
                {/* The date is the billing — no performer is named. */}
                <h3 className="mt-6 font-serif text-3xl uppercase leading-tight tracking-[0.04em] md:text-4xl">
                  {featuredEvent.date && t(featuredEvent.date)}
                </h3>
              </a>
            </Reveal>
          </div>

          <div className="md:col-span-4 md:col-start-9 md:mt-28">
            <Reveal delay={0.1} y={36}>
              <p className="rail mb-6 block">{t("events.past")}</p>
              <ul className="grid grid-cols-2 gap-5 md:grid-cols-1 md:gap-10">
                {pastEvents.map((event) => (
                  <li key={event.slug}>
                    <a
                      href={site.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block cursor-pointer"
                    >
                      <div className="relative overflow-hidden">
                        <Image
                          src={artwork[event.slug]}
                          alt={t(event.alt)}
                          placeholder="blur"
                          sizes="(min-width: 768px) 28vw, 44vw"
                          className="aspect-[4/5] h-auto w-full object-cover grayscale transition-[filter,transform] duration-300 ease-out group-hover:scale-[1.02] group-hover:grayscale-0 group-focus-visible:grayscale-0"
                        />
                        <div
                          className="absolute inset-0 bg-night/45 transition-colors duration-300 group-hover:bg-night/30"
                          aria-hidden="true"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                          <span className="text-[0.6875rem] uppercase tracking-[0.36em] text-night-ink/90 indent-[0.36em]">
                            {t("events.passed")}
                          </span>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
