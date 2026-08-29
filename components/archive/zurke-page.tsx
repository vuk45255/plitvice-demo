"use client";

import { PosterImage } from "@/components/events/poster-image";
import Link from "next/link";
import { ArchiveShell } from "@/components/archive/archive-shell";
import { EventPoster } from "@/components/events/event-poster";
import { ImageReveal } from "@/components/image-reveal";
import { Reveal } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { reserveHref, type PartyEvent } from "@/lib/events";
import { site } from "@/lib/site";

/* Every night the club has put on, in one room.
 *
 * The night ahead takes a spread of its own — artwork on one side, the billing
 * and the two ways in on the other. Everything behind it is the record: the
 * same artwork, smaller, in grey until you look at it, hung off uneven
 * baselines so the wall never reads as a product grid. A night that has
 * happened sells nothing, so nothing under it asks you to buy. */

/* The wall is handed in rather than imported — it is the events table, read on
   the server by app/(site)/zurke/page.tsx. Adding a night is adding a row. */
export function ZurkePage({
  next,
  past,
}: {
  next?: PartyEvent;
  past: PartyEvent[];
}) {
  const { t } = useLang();

  return (
    <ArchiveShell
      word="Žurke"
      caption="zurke.archive"
      title="zurke.title"
      lead="zurke.lead"
    >
      {next ? (
        <section aria-labelledby="next-night" className="container-x">
          <Reveal>
            <h2 id="next-night" className="rail rail-night">
              {t("zurke.upcoming")}
            </h2>
          </Reveal>

          <div className="mt-12 flex flex-col gap-12 md:mt-16 md:flex-row md:items-end md:gap-16">
            <ImageReveal className="w-full md:w-[46%]">
              <Link
                href={reserveHref(next.slug)}
                aria-label={`${next.artist} — ${t(next.date)} — ${t("events.buy")}`}
                className="group relative block aspect-[4/5] w-full overflow-hidden ring-1 ring-gold/25"
              >
                <PosterImage
                  poster={next.poster}
                  alt=""
                  sizes="(min-width: 768px) 46vw, 92vw"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                  priority
                />
                <div
                  className="absolute inset-0 bg-night/0 transition-colors duration-700 group-hover:bg-night/30"
                  aria-hidden="true"
                />
              </Link>
            </ImageReveal>

            <Reveal delay={0.12} className="md:flex-1 md:pb-6">
              <p className="font-serif text-[clamp(2.25rem,5vw,4rem)] uppercase leading-[1.02] tracking-[0.03em]">
                {next.artist}
              </p>
              <p className="mt-6 text-[0.8125rem] uppercase tracking-[0.36em] text-gold-light">
                {t(next.date)}
              </p>

              <div className="mt-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
                <Link
                  href={reserveHref(next.slug, "karte")}
                  className="btn-gold btn-gold-night btn-gold-sm"
                >
                  {t("events.buy")}
                </Link>
                <Link
                  href={reserveHref(next.slug, "stolovi")}
                  className="link-underline text-[0.6875rem] uppercase tracking-[0.28em] text-night-ink/70 transition-colors duration-500 hover:text-gold"
                >
                  {t("common.reserveTable")}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      ) : (
        <section className="container-x">
          <Reveal>
            <p className="max-w-[30rem] text-base leading-[1.8] text-night-ink/60">
              {t("events.none")}
            </p>
            <a
              href={site.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline mt-8 inline-block text-[0.6875rem] uppercase tracking-[0.28em] text-gold"
            >
              {site.instagramHandle}
            </a>
          </Reveal>
        </section>
      )}

      <section
        aria-labelledby="past-nights"
        className="container-x mt-[18vh] md:mt-[24vh]"
      >
        <Reveal>
          <h2 id="past-nights" className="rail rail-night">
            {t("zurke.past")}
          </h2>
        </Reveal>

        <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-16 md:mt-20 md:grid-cols-3 md:gap-x-12 md:gap-y-20">
          {past.map((event, i) => (
            <li key={event.slug} className={drops[i % drops.length]}>
              <ImageReveal delay={(i % 3) * 0.07}>
                <EventPoster
                  event={event}
                  sizes="(min-width: 768px) 28vw, 45vw"
                />
              </ImageReveal>
            </li>
          ))}
        </ul>
      </section>
    </ArchiveShell>
  );
}

/* Nothing lines up on the second wall either. */
const drops = ["md:mt-0", "md:mt-24", "md:mt-10"];
