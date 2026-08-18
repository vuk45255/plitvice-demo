"use client";

import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/arrow";
import { useLang } from "@/components/providers/language";
import { reserveHref, type PartyEvent } from "@/lib/events";

/* One night on the wall — the same object everywhere a poster appears.
 *
 * At rest the artwork stands alone and the only words under it are the call to
 * act. Reach for it on a desktop and the room behind the poster darkens a
 * shade while the billing rises out of the bottom edge: the artist, then the
 * date. Nothing zooms, nothing slides sideways, and the poster never stops
 * being the thing you are looking at.
 *
 * A phone has no hover, so the billing is set under the poster instead and the
 * overlay is not rendered at all. Above `md` the same lines become the
 * screen-reader copy of what the overlay shows, so neither reading loses them.
 *
 * A night that has already happened is not a link and has no call to act. It
 * greys out and stays on the wall as a record. */

type EventPosterProps = {
  event: PartyEvent;
  /* "feature" is the night ahead, given a spread of its own; "wall" is the
     archive, where a dozen of these hang together. */
  scale?: "feature" | "wall";
  sizes: string;
  priority?: boolean;
  className?: string;
};

export function EventPoster({
  event,
  scale = "wall",
  sizes,
  priority,
  className,
}: EventPosterProps) {
  const { t } = useLang();
  const date = t(event.date);
  const buy = t("events.buy");
  const bookable = event.status === "upcoming";

  const artistType =
    scale === "feature"
      ? "font-serif text-[clamp(1.5rem,3vw,2.5rem)] uppercase leading-[1.05] tracking-[0.04em]"
      : "font-serif text-[clamp(1rem,1.6vw,1.375rem)] uppercase leading-[1.1] tracking-[0.04em]";

  const artwork = (
    <>
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Image
          src={event.poster}
          alt=""
          placeholder="blur"
          sizes={sizes}
          fill
          priority={priority}
          className={`object-cover transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.025] ${
            bookable ? "" : "grayscale group-hover:grayscale-0"
          }`}
        />

        {/* the room coming up over the artwork as you reach for it */}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
            bookable
              ? "bg-night/45 opacity-0 group-hover:opacity-100"
              : "bg-night/45 opacity-100 group-hover:opacity-40"
          }`}
          aria-hidden="true"
        />

        {/* the billing, rising out of the bottom edge — desktop only */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden overflow-hidden p-5 md:block md:p-6"
          aria-hidden="true"
        >
          <p
            className={`${artistType} translate-y-4 text-night-ink opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-y-0 group-hover:opacity-100`}
          >
            {event.artist}
          </p>
          <p className="mt-3 translate-y-4 text-[0.625rem] uppercase tracking-[0.36em] text-gold-light opacity-0 transition-[transform,opacity] delay-100 duration-700 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            {date}
          </p>
        </div>
      </div>

      {/* On a phone the billing is printed under the poster. Above md the same
          lines stay for anyone listening to the page rather than looking at it. */}
      <div className="mt-5 md:sr-only">
        <h3 className={scale === "feature" ? artistType : "font-serif text-lg uppercase leading-tight tracking-[0.04em]"}>
          {event.artist}
        </h3>
        <p className="mt-2 text-[0.625rem] uppercase tracking-[0.32em] text-gold/80">
          {date}
        </p>
      </div>

      {bookable && (
        <span
          className={`mt-5 flex items-center gap-3 uppercase text-gold transition-colors duration-500 group-hover:text-gold-light ${
            scale === "feature"
              ? "text-[0.75rem] tracking-[0.3em]"
              : "text-[0.625rem] tracking-[0.28em]"
          }`}
        >
          {buy}
          <Arrow className="w-6 group-hover:w-10" />
        </span>
      )}
    </>
  );

  if (!bookable) {
    return (
      <article className={`group ${className ?? ""}`}>{artwork}</article>
    );
  }

  return (
    <article className={className}>
      <Link
        href={reserveHref(event.slug, "karte")}
        aria-label={`${event.artist} — ${date} — ${buy}`}
        className="group block cursor-pointer"
      >
        {artwork}
      </Link>
    </article>
  );
}
