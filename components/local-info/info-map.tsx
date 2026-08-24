"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { useLang } from "@/components/providers/language";

/* A WINDOW INTO A PLACE — the real Google map, framed the way this site frames
 * a photograph.
 *
 * NOTHING IS FAKED AND NOTHING IS DRAWN. This is Google's keyless embed: the
 * actual roads, the actual pin, and the actual place the query resolved to.
 *
 * ─── WHY IT IS NOT MOUNTED UNTIL IT IS NEEDED ───────────────────────────
 *
 * A Google embed is not a picture. Each one is a document of its own that
 * pulls a megabyte or so of script and tiles, and the transport page carries
 * seven of them. `loading="lazy"` on the iframe helps and is set, but it only
 * defers — the frame is still in the document from the first paint and still
 * counted. So the iframe is not rendered at all until the card is within four
 * hundred pixels of the screen, and until then the panel is a piece of the
 * page's own night with the house's hairline grid on it. Once a map is in it
 * stays in: `once` on the observer, so scrolling back up never tears down a
 * frame that has already paid for itself.
 *
 * ─── AND WHY IT IS A LINK RATHER THAN A MAP YOU CAN DRAG ────────────────
 *
 * Every one of these frames sits inside a page the visitor is scrolling. An
 * interactive map inside a scrolling page eats the wheel and the finger: on
 * the transport page that is seven places where the page silently stops
 * moving and a map starts zooming instead. So the frame is covered by the
 * link, the whole map opens Google Maps in a new tab, and the page scrolls
 * over it exactly as it scrolls over everything else.
 *
 * The cover is aria-hidden and unfocusable: the row already carries a real,
 * labelled OTVORI MAPU action, and a keyboard should meet one link to Google
 * Maps here rather than two to the same place. */

export function InfoMap({
  embed,
  href,
  interactive = false,
  className,
}: {
  /* The embed URL — see placeEmbed / mapsEmbedUrl. */
  embed: string;
  /* Where a click on it goes, when it is a window rather than a map. */
  href: string;
  /* A REAL MAP RATHER THAN A WINDOW ONTO ONE. Everything written above about
     the cover applies to a page carrying several maps inside a list. The road
     here carries exactly one, it is the point of the page, and a visitor
     working out where the club is wants to pan and zoom it. So this one is
     left uncovered: no link over it, and no scale on hover either — a map that
     grows under the cursor is a picture, and this is not a picture. */
  interactive?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "400px 0px" });
  const { t } = useLang();

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-night-2 ${className ?? ""}`}
    >
      {/* the hairline grid the panel waits on, and the floor under the map */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,164,93,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(200,164,93,0.055) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
        aria-hidden="true"
      />

      {near ? (
        <iframe
          src={embed}
          title={t("info.action.openMap")}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          /* THE GRADE IS ON THE FRAME ITSELF, and it has to be: Google draws a
             daylight map, and a translucent panel laid over one only produces
             a pale map with a tint on it — six bright rectangles with a
             website behind them, which is the one thing this page must not be.
             A filter turns the map itself over.

             INVERT AND THEN TURN THE HUE BACK ROUND. Inverting alone gives a
             dark map with the colours complemented — the pin goes cyan, the
             parks magenta. Rotating the hue half a turn afterwards puts every
             one of them back where it started: the roads stay grey, the parks
             stay green, and the pin stays red. What is left is a night map
             with the same information on it. The saturation comes down and the
             contrast comes in a little so it sits in the house palette rather
             than shouting out of it.

             The scale is the hover, and it is on the frame rather than on a
             wrapper so the map itself grows inside its window. 1.02 at rest
             covers the seam the scale would otherwise open at the edges. */
          className={`absolute inset-0 h-full w-full border-0 ${
            interactive
              ? ""
              : "scale-[1.02] transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:scale-[1.042] group-focus-within:scale-[1.042]"
          }`}
          style={{
            filter:
              "invert(0.92) hue-rotate(180deg) saturate(0.72) brightness(0.96) contrast(0.9)",
          }}
        />
      ) : null}

      {/* and the house violet over it, so the window is lit by the same lamps
          as the room it is cut into. A wash, never a curtain — the roads, the
          pin and the labels all read through it, and it lifts a little as the
          card is reached for. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-70"
        style={{
          background:
            "linear-gradient(150deg, rgba(66,32,104,0.4), rgba(8,5,13,0.34))",
        }}
        aria-hidden="true"
      />

      {/* the inner edge, so the window reads as cut into the card rather than
          laid on top of it */}
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-gold/[0.07] transition-[box-shadow] duration-700 group-hover:ring-gold/[0.14]"
        aria-hidden="true"
      />

      {interactive ? null : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0"
        />
      )}
    </div>
  );
}
