"use client";

import Image from "next/image";
import { useLang } from "@/components/providers/language";
import type { PartyEvent } from "@/lib/events";
import { site } from "@/lib/site";

/* Which night — asked once, quietly, and then got out of the way.
 *
 * A strip of the artwork, the name and the date, on a soft-cornered row with a
 * hairline of gold around it. Nothing is sold here and nothing is repeated from
 * the spread below: this list only answers the question at the top of it, and
 * the night it points at is the one the page goes on to lay out in full.
 *
 * One announced night is one row. A season of them is the same row again, so
 * nothing about this has to change when the calendar fills up. */

export function EventChooser({
  events,
  selected,
  onSelect,
}: {
  events: PartyEvent[];
  selected?: PartyEvent;
  onSelect: (event: PartyEvent) => void;
}) {
  const { t } = useLang();

  if (events.length === 0) {
    return (
      <div>
        <p className="rail rail-night">{t("reserve.which")}</p>
        <p className="mt-8 max-w-[30rem] text-base leading-[1.8] text-night-ink/55">
          {t("events.none")}
        </p>
        <p className="mt-6 text-[0.75rem] leading-relaxed text-night-ink/40">
          {t("tickets.announcements")}{" "}
          <a
            href={site.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline text-gold transition-colors duration-500 hover:text-gold-light"
          >
            {site.instagramHandle}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="rail rail-night" id="which-night">
        {t("reserve.which")}
      </p>

      <ul
        className="mt-8 max-w-[32rem] space-y-4"
        aria-labelledby="which-night"
      >
        {events.map((event) => {
          const active = event.slug === selected?.slug;

          return (
            <li key={event.slug}>
              <button
                type="button"
                onClick={() => onSelect(event)}
                aria-pressed={active}
                className={`group flex w-full items-center gap-5 rounded-2xl border p-3 pr-6 text-left transition-[background-color,border-color] duration-500 ${
                  active
                    ? "border-gold/45 bg-night-2/60"
                    : "border-line bg-night-2/25 hover:border-gold/30 hover:bg-night-2/45"
                }`}
              >
                <span className="relative block h-[4.5rem] w-[3.5rem] shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={event.poster}
                    alt=""
                    placeholder="blur"
                    sizes="56px"
                    fill
                    className={`object-cover transition-[filter] duration-700 ${
                      active ? "" : "brightness-[0.85] saturate-[0.8]"
                    }`}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-serif text-[clamp(1.0625rem,2vw,1.375rem)] uppercase tracking-[0.04em] transition-colors duration-500 ${
                      active
                        ? "text-gold-light"
                        : "text-night-ink/80 group-hover:text-night-ink"
                    }`}
                  >
                    {event.artist}
                  </span>
                  <span
                    className={`mt-2 block text-[0.625rem] uppercase tracking-[0.3em] transition-colors duration-500 ${
                      active ? "text-gold" : "text-night-ink/45"
                    }`}
                  >
                    {t(event.date)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
