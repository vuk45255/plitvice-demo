"use client";

import { useState } from "react";
import Image from "next/image";

/* THE SAME WINDOW, WITH A PHOTOGRAPH IN IT.
 *
 * Where we have a real picture of a place, the card shows the place rather
 * than the roads around it — see `photo` in lib/info-places.ts. Everything
 * else about the window is unchanged: the same panel, the same violet wash,
 * the same hairline cut into the card, the same four per cent of growth on
 * hover, and the same cover taking a click through to Google Maps. Only the
 * iframe is swapped for an image, so a card with a photograph and a card with
 * a map are the same object at the same size on the same grid.
 *
 * The photograph is cropped, never letterboxed: object-cover from the centre,
 * filling the panel at whatever height the copy beside it turns out to need.
 * If one ever fails to load it takes itself out of the document and the panel
 * is left as the night it was — no broken frame in the side of a card.
 *
 * Lazy by default, which is what next/image does unless told otherwise: these
 * sit below the fold on every one of these pages. */

export function InfoPlacePhoto({
  src,
  href,
  className,
}: {
  src: string;
  /* Where a click on it goes — the same Google Maps link OTVORI MAPU uses. */
  href: string;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-night-2 ${className ?? ""}`}>
      {!missing && (
        <Image
          src={src}
          alt=""
          fill
          /* One column of a card on a phone, a little under half of one from
             `md` — see the grid in info-location-card.tsx. */
          sizes="(min-width: 768px) 46vw, 100vw"
          onError={() => setMissing(true)}
          style={{ objectPosition: "center" }}
          className="img-grade scale-[1.02] object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:scale-[1.042] group-focus-within:scale-[1.042]"
        />
      )}

      {/* the house violet, at a fraction of the weight the map carries: a map
          is a bright daylight document that has to be pulled into the night,
          a photograph is already dark and only wants to be lit by the same
          lamps as the room it hangs in */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-70"
        style={{
          background:
            "linear-gradient(150deg, rgba(66,32,104,0.18), rgba(8,5,13,0.26))",
        }}
        aria-hidden="true"
      />

      {/* the inner edge, so the window reads as cut into the card rather than
          laid on top of it */}
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-gold/[0.07] transition-[box-shadow] duration-700 group-hover:ring-gold/[0.14]"
        aria-hidden="true"
      />

      {/* the whole panel opens the map, exactly as the map itself did. The
          card already carries a real, labelled OTVORI MAPU action, so this
          one is hidden from the keyboard and from a screen reader. */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0"
      />
    </div>
  );
}
