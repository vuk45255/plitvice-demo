"use client";

import { Arrow } from "@/components/arrow";
import { InfoMap } from "@/components/local-info/info-map";
import { useLang } from "@/components/providers/language";
import { dial, placeEmbed, placeMap, type Place } from "@/lib/info-places";

/* ONE RECOMMENDATION — the component every category page is built out of, and
 * the only place the design of an entry is written down.
 *
 * A recommendation rather than a row in a table. What separates the two is
 * that a row tells you a place exists and a card tells you where it is: the
 * left half is what the concierge would say — the name, the street, a line
 * about it, when it is open — and the right half is the actual map, so the
 * guest knows whether it is round the corner or across town without leaving
 * the page. Underneath, the two things they will actually do: call it, or
 * navigate to it.
 *
 * EVERYTHING IS THE DATA. Name, address, note, hours, telephone and
 * where the map points are all read off one Place — see lib/info-places.ts.
 * There is no per-category markup anywhere: /info/prevoz and /info/smestaj are
 * this component with a different array behind them.
 *
 * ─── THE FRAME ───────────────────────────────────────────────────────────
 *
 * Lifted off the page rather than boxed on it: about two per cent of violet
 * over the night, a hairline of gold at a twelfth of its strength, and three
 * pixels of corner — enough that the edge is not a hard right angle, far too
 * little to read as a rounded card. It is the same weight of line the rest of
 * the site rules with.
 *
 * Hovering warms the border, opens a small pool of light under the card,
 * grows the map inside its window by four per cent and steps the name three
 * pixels to the right. Every one of those is a small number on purpose. */

export function InfoLocationCard({ place }: { place: Place }) {
  const { t, lang } = useLang();
  const map = placeMap(place);

  return (
    /* ONE GRID, TWO SHAPES.
     *
     * On a phone it is a single column and the three parts fall in reading
     * order: what the place is, then where it is, then what to do about it.
     * The map sits between the description and the actions rather than above
     * the name — a guest reads the recommendation, sees the street, and only
     * then decides whether to ring or to walk.
     *
     * From `md` the same three parts are placed rather than stacked: the text
     * takes the top-left cell, the actions the bottom-left, and the map the
     * whole of the right-hand column across both rows — which is what makes it
     * fill the side of the card at whatever height the copy turns out to need.
     * The text row is the flexible one, so a card with a long line in it grows
     * around the text and the actions stay on the floor of the card. */
    <article
        className="group relative isolate grid overflow-hidden rounded-[3px] border border-gold/[0.09] transition-[border-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/[0.22] focus-within:border-gold/[0.22] md:grid-cols-[1fr_minmax(0,43%)] md:grid-rows-[1fr_auto]"
        style={{
          background:
            "linear-gradient(158deg, rgba(122,72,180,0.055), rgba(8,5,13,0.34))",
        }}
      >
        {/* the pool of light under the card, and it is only ever a pool */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-focus-within:opacity-100"
          style={{
            boxShadow:
              "0 0 0 1px rgba(200,164,93,0.05), 0 22px 60px -34px rgba(200,164,93,0.28)",
          }}
          aria-hidden="true"
        />

        {/* ── what the concierge would tell you ── */}
        <div className="order-1 flex flex-col justify-center p-6 pb-5 sm:p-8 sm:pb-6 md:order-none md:col-start-1 md:row-start-1 md:p-9 md:pb-4">
          <h2 className="font-serif leading-[1.15] tracking-[-0.012em] text-night-ink transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[3px] text-[clamp(1.375rem,4.6vw,1.5rem)] md:text-[clamp(1.625rem,2.3vw,2.125rem)]">
            {place.name}
          </h2>

          <div className="mt-4">
            <p className="text-sm leading-[1.6] text-night-ink/75">
              {place.address}
            </p>

            {place.note ? (
              <p className="mt-2 max-w-[32rem] text-sm leading-[1.7] text-night-ink/45">
                {t(place.note)}
              </p>
            ) : null}

            {/* THE HOURS ARE NOT PART OF THE ADDRESS. On the old page they
                were run into it with a middot and read as more of the street;
                a place being open all night is the single most useful thing
                on a card at two in the morning, so it gets a line and the
                house gold to itself. */}
            {place.hours ? (
              <p className="mt-4 text-[0.6875rem] uppercase tabular-nums tracking-[0.28em] text-gold/75">
                {place.hours}
              </p>
            ) : null}

          </div>
        </div>

        {/* ── where it actually is ── */}
        <InfoMap
          embed={placeEmbed(place, lang)}
          href={map}
          className="order-2 h-[200px] md:order-none md:col-start-2 md:row-span-2 md:row-start-1 md:h-auto md:min-h-[252px]"
        />

        {/* ── and the two things a guest will do about it ── */}
        <div className="order-3 flex flex-wrap items-center gap-x-7 gap-y-3 px-6 pb-6 pt-5 sm:px-8 sm:pb-8 md:order-none md:col-start-1 md:row-start-2 md:px-9 md:pb-9 md:pt-0">
          {place.phone ? (
            <Action
              href={dial(place.phone)}
              label={t("info.action.call")}
              detail={`${place.name} — ${place.phone}`}
            />
          ) : null}

          <Action
            href={map}
            label={t("info.action.openMap")}
            detail={`${place.name}, ${place.address}`}
            external
          />
        </div>
    </article>
  );
}

/* One thing a card can do. Small caps, the house gold and the house arrow —
   the same voice as QuietLink, at the size a card can carry two of. */
function Action({
  href,
  label,
  detail,
  external,
}: {
  href: string;
  label: string;
  detail: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : null)}
      aria-label={`${label} — ${detail}`}
      className="group/act inline-flex items-center gap-3 whitespace-nowrap text-[0.625rem] uppercase tracking-[0.26em] text-gold/75 outline-none transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-gold-light focus-visible:text-gold-light"
    >
      <span className="indent-[0.26em] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/act:translate-x-[3px] group-focus-visible/act:translate-x-[3px]">
        {label}
      </span>
      <Arrow className="w-5 group-hover/act:w-8 group-focus-visible/act:w-8" />
    </a>
  );
}
