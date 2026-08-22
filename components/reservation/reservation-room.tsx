"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { EASE } from "@/components/reveal";
import { Lockup } from "@/components/lockup";
import { BookingLines } from "@/components/reservation/booking-lines";
import { EventChooser } from "@/components/reservation/event-chooser";
import { ReserveHeadline } from "@/components/reservation/reserve-headline";
import { ReservationAtmosphere } from "@/components/reservation/reservation-atmosphere";
import { ReservationHero } from "@/components/reservation/reservation-hero";
import { PosterTicker } from "@/components/reservation/poster-ticker";
import { useLang } from "@/components/providers/language";
import {
  entryPrice,
  findEvent,
  isBookable,
  reserveHref,
  ticketAvailability,
  upcomingEvents,
  type PartyEvent,
  type ReserveChoice,
} from "@/lib/events";
import { formatPrice } from "@/lib/booking";
import { topOf, travelTo } from "@/lib/scroll";
import { site } from "@/lib/site";

/* The room where a night is bought.
 *
 * One address for everything: the header button, a poster on the wall, the
 * footer, the VIP chapter — all of them land here, and what they carry in the
 * query is which night and which of the two lines to open. That makes every
 * state of this room a real URL that can be shared, bookmarked or opened in a
 * new tab, and it is why nothing on the site opens a reservation overlay any
 * more.
 *
 * The poster is the anchor. A guest who arrived by clicking it finds the same
 * artwork holding the left of the page and staying there, in view, while they
 * work down the right — the stub of the ticket beside its counterfoil. */

/* Where the selector hands the guest over to. */
const DETAIL_ID = "izabrana-zurka";

/* The two facts a guest checks before anything else: when it starts and what
   it costs. Set in the same small caps as the house line under it, with the
   labels dropped back and the numbers left forward — one line of type, no
   badge, no box, and nothing at all when the club has not settled a figure. */
function EventMeta({ event }: { event: PartyEvent }) {
  const { t, lang } = useLang();
  const price = entryPrice(event);

  if (!event.startTime && price === undefined) return null;

  return (
    <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/40">
      {event.startTime ? (
        <span>
          {t("event.doors")}{" "}
          <span className="tabular-nums text-night-ink/85">
            {event.startTime}
          </span>
        </span>
      ) : null}

      {event.startTime && price !== undefined ? (
        <span className="text-night-ink/20" aria-hidden="true">
          ·
        </span>
      ) : null}

      {price !== undefined ? (
        <span>
          {t("event.ticket")}{" "}
          <span className="tabular-nums text-night-ink/85">
            {formatPrice(price, lang)}
          </span>
        </span>
      ) : null}
    </p>
  );
}

export function ReservationRoom({
  initialSlug,
  initialChoice,
}: {
  initialSlug?: string;
  initialChoice?: ReserveChoice;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const lenis = useLenis();

  /* The room only ever opens on a night the guest has already picked, and the
     link they arrived on is the whole record of that: a poster, the archive or
     the VIP chapter all carry the slug, and the header's own REZERVACIJA does
     not. So the plain address asks the question — even when the calendar holds
     a single night — and nothing below the selector exists until it has been
     answered. Nothing is remembered between visits either; the URL is the only
     memory the room has. */
  const [selected, setSelected] = useState<PartyEvent | undefined>(() => {
    /* A link to a night that has already happened is not honoured — nothing
       here can be sold for it, so the room asks the question instead. */
    const asked = findEvent(initialSlug);
    return asked && isBookable(asked) ? asked : undefined;
  });
  /* A link that asks for the ticket line on a night the club is not selling
     online opens nothing — that line is there to be read, not to be opened. */
  const [open, setOpen] = useState<ReserveChoice | undefined>(() => {
    if (initialChoice !== "karte") return initialChoice;
    const asked = findEvent(initialSlug);
    return asked && ticketAvailability(asked) === "open" ? "karte" : undefined;
  });

  /* The URL follows the room without a round trip to the server: the state the
     guest is looking at is always the state the address bar describes. */
  const remember = useCallback(
    (event: PartyEvent | undefined, choice: ReserveChoice | undefined) => {
      window.history.replaceState(null, "", reserveHref(event?.slug, choice));
    },
    [],
  );

  /* Picking a night always travels down to it, whether or not it was already
     the one showing — the selector's whole job is to hand the guest over to the
     spread below it. Once a night is picked there is no state that un-picks it;
     the room only starts empty. */
  const chooseEvent = useCallback(
    (event: PartyEvent) => {
      if (event.slug !== selected?.slug) {
        setSelected(event);
        setOpen(undefined);
        remember(event, undefined);
      }
      /* The spread has to arrive — or swap over — before there is anything to
         travel to. It comes in on its own from just below, so this is a short
         move down to meet it rather than a jump. */
      window.setTimeout(() => {
        const target = document.getElementById(DETAIL_ID);
        if (target) travelTo(topOf(target), lenis, Boolean(reduced));
      }, 140);
    },
    [lenis, reduced, remember, selected?.slug],
  );

  const chooseLine = useCallback(
    (choice: ReserveChoice | undefined) => {
      setOpen(choice);
      remember(selected, choice);
    },
    [remember, selected],
  );

  return (
    <main
      id="main"
      className="relative isolate min-h-[100svh] overflow-hidden bg-night pb-32 text-night-ink md:pb-44"
    >
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <ReservationAtmosphere />
      </div>

      {/* The photograph runs behind the way out, the mark and the headline, and
          fades into the page's own dark before the nights begin. */}
      <ReservationHero>
        <div className="container-x relative z-10">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
            className="flex items-start justify-between pt-10 md:pt-14"
          >
            <Link
              href="/"
              className="group flex items-center gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/70 transition-colors duration-500 hover:text-gold"
            >
              <span
                className="h-px w-6 bg-current transition-[width] duration-500 group-hover:w-9"
                aria-hidden="true"
              />
              {t("common.back")}
            </Link>

            <Link
              href="/"
              aria-label={`${t("common.back")} — Plitvice`}
              className="text-night-ink transition-colors duration-500 hover:text-gold"
            >
              <Lockup size="xs" tone="light" />
            </Link>
          </motion.div>

          <motion.header
            initial={reduced ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, delay: 0.1, ease: EASE }}
            className="pt-24 md:pt-32"
          >
            <ReserveHeadline className="font-serif text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.98] tracking-tight [text-shadow:0_0_70px_rgba(232,216,168,0.18)]" />
            <p className="mt-9 max-w-[32rem] text-base leading-[1.8] text-night-ink/65">
              {t("reserve.pageLead")}
            </p>
          </motion.header>
        </div>
      </ReservationHero>

      <div className="container-x relative z-10">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 1, delay: 0.24, ease: EASE }}
          className="mt-10 md:mt-16"
        >
          <EventChooser
            events={upcomingEvents}
            selected={selected}
            onSelect={chooseEvent}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.slug}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: reduced ? 0 : 0.85, ease: EASE }}
              id={DETAIL_ID}
              className="mt-24 scroll-mt-16 grid gap-14 md:mt-32 md:grid-cols-12 md:gap-x-16"
            >
              <div className="md:col-span-5 md:self-start">
                <div className="md:sticky md:top-16">
                  {/* The strip along the bottom is part of the poster, not a
                      caption under it — so it lives inside the same clipped,
                      rounded frame and takes the curve of the corners with it. */}
                  <div className="group relative aspect-[4/5] w-full overflow-hidden rounded-[20px] ring-1 ring-gold/20">
                    <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.02]">
                      <Image
                        src={selected.poster}
                        alt=""
                        placeholder="blur"
                        sizes="(min-width: 768px) 40vw, 92vw"
                        fill
                        priority
                        className="object-cover"
                      />
                    </div>
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-night/35 via-transparent to-transparent"
                      aria-hidden="true"
                    />
                    <PosterTicker text={selected.artist} />
                  </div>

                  {/* What the night says for itself, set under its own poster
                      and to the poster's own left edge — a note in the margin
                      of the bill, not a caption on a photograph. It travels
                      with the artwork, so it is still there when the guest is
                      halfway down the form on the right. */}
                  {selected.description ? (
                    <div className="mt-8 md:mt-9">
                      <p className="max-w-[30rem] text-[0.875rem] leading-[1.9] text-night-ink/60">
                        {t(selected.description)}
                      </p>

                      <p className="mt-6 text-[0.625rem] uppercase tracking-[0.3em] text-gold/55">
                        {t("event.info")}
                        <span className="mx-2 text-gold/30" aria-hidden="true">
                          —
                        </span>
                        <a
                          href={`tel:${site.phone.replace(/\s/g, "")}`}
                          className="tabular-nums text-gold-light/90 transition-colors duration-500 hover:text-gold-light"
                        >
                          {site.phone}
                        </a>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="relative md:col-span-6 md:col-start-7">
                {/* the tear line — the poster is the stub, this is what you
                    keep */}
                <span
                  className="pointer-events-none absolute -left-8 top-0 hidden h-full w-px md:block"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, rgba(200,164,93,0.32) 0 5px, transparent 5px 13px)",
                  }}
                  aria-hidden="true"
                />

                <h2 className="font-serif text-[clamp(2rem,4.6vw,3.5rem)] uppercase leading-[1.02] tracking-[0.03em] text-night-ink">
                  {selected.artist}
                </h2>
                <p className="mt-6 text-[0.8125rem] uppercase tracking-[0.36em] text-gold-light">
                  {t(selected.date)}
                </p>

                <EventMeta event={selected} />

                <p className="mt-6 text-[0.625rem] uppercase tracking-[0.4em] text-night-ink/35">
                  {selected.location ??
                    `${site.tagline} · ${site.name} · ${site.town}`}
                </p>

                <div className="mt-16 md:mt-20">
                  <BookingLines
                    event={selected}
                    open={open}
                    onOpen={chooseLine}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
