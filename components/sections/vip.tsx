"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ImageReveal } from "@/components/image-reveal";
import { SectionWord } from "@/components/section-word";
import { GrandClubSignature } from "@/components/grand-club";
import { Ambient } from "@/components/ambient";
import { useLang } from "@/components/providers/language";
import { ReserveButton } from "@/components/reservation/reserve-button";
import { nextEvent } from "@/lib/events";
import { reserveHref } from "@/lib/events";
import { site } from "@/lib/site";
import reservationImg from "@/public/images/rezervacija.jpg";

/* The one page that is always night — and the deepest velvet on the site:
   royal purple washed with a single warm light from above. One tall frame,
   magazine-narrow, and the reservation beside it. */
export function Vip() {
  const { t, tRich } = useLang();

  return (
    <section
      id="vip"
      aria-labelledby="vip-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-night-2 py-32 text-night-ink md:py-56"
    >
      <SectionWord word="Reserve" />
      <Ambient variant="soft" />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, rgba(42,18,63,0.95), transparent 70%), radial-gradient(50% 40% at 70% 20%, rgba(200,164,93,0.13), transparent 72%)",
        }}
        aria-hidden="true"
      />

      <div className="container-x relative z-10">
        <div className="grid items-center gap-16 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5 md:col-start-1">
            <ImageReveal delay={0.05}>
              {/* The whole photograph is the way in: it darkens under the
                  cursor and the invitation comes up out of it. It travels to
                  the reservation room, on the night ahead where there is one. */}
              <Link
                href={reserveHref(nextEvent?.slug, "stolovi")}
                aria-label={t("common.reserveTable")}
                className="group relative mx-auto block w-full max-w-[26rem] overflow-hidden md:mx-0"
              >
                <Image
                  src={reservationImg}
                  alt={t("vip.imgAlt")}
                  placeholder="blur"
                  sizes="(min-width: 768px) 34vw, 88vw"
                  className="img-grade aspect-[4/5] h-auto w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.03]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-night/55 via-transparent to-transparent"
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 bg-night/40 opacity-0 transition-opacity duration-[900ms] ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex translate-y-2 flex-col items-center justify-center px-8 text-center opacity-0 transition-[opacity,transform] duration-[900ms] ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  <span className="text-[0.8125rem] uppercase tracking-[0.4em] text-gold-light indent-[0.4em]">
                    {t("common.reserveTable")}
                  </span>
                  <span
                    className="mt-4 h-px w-16 bg-gold/60"
                    aria-hidden="true"
                  />
                  <span className="mt-5 max-w-[15rem] text-[0.6875rem] leading-relaxed tracking-[0.12em] text-night-ink/80">
                    {t("vip.hoverText")}
                  </span>
                </div>
                {/* Touch has no hover, so the invitation stays on the frame. */}
                <span className="absolute inset-x-0 bottom-0 pb-6 text-center text-[0.625rem] uppercase tracking-[0.34em] text-gold-light indent-[0.34em] md:hidden">
                  {t("common.reserveTable")}
                </span>
              </Link>
            </ImageReveal>
          </div>

          <div className="md:col-span-6 md:col-start-7 md:pl-8">
            <Reveal>
              <h2
                id="vip-title"
                className="font-serif text-[clamp(2.5rem,6vw,5.25rem)] leading-[1.03] tracking-tight [text-shadow:0_0_70px_rgba(232,216,168,0.18)]"
              >
                {tRich("vip.title")}
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="mt-8">
                {/* Signed in full here, and only here: the reservation is the
                    one place on the page where the house gives its whole name.
                    Composed from the two facts in lib/site rather than written
                    out, so it cannot drift from the mark in the header. */}
                <GrandClubSignature
                  size="md"
                  tone="light"
                  rules="right"
                  text={`${site.tagline} ${site.name}`}
                />
              </div>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-10 max-w-[32rem] space-y-5 text-base leading-[1.7] text-night-ink/65">
                <p>{t("vip.p1")}</p>
                <p>{t("vip.p2")}</p>
              </div>
            </Reveal>
            {/* The photograph beside this text opens the same room, but that
                invitation only appears on hover — on a phone there is none.
                This is the one that is always visible. */}
            <Reveal delay={0.24}>
              <div className="mt-12">
                <ReserveButton
                  label="common.reserveTable"
                  night
                  event={nextEvent?.slug}
                  choice="stolovi"
                  className="w-full text-center sm:w-auto"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
