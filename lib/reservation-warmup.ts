"use client";

import { getImageProps } from "next/image";
import heroImg from "@/public/rezervacija/Rezervacija.jpg";

/* THE ONE PICTURE THE RESERVATION ROOM CANNOT OPEN WITHOUT.
 *
 * ═══ WHAT IS WARMED, AND WHAT DELIBERATELY IS NOT ═════════════════════════
 *
 * One file. The photograph the top of /rezervacija is built on is the only
 * asset on that route that is both large and above the fold, and it is the
 * only thing here. The posters below it belong to whichever night the guest
 * has not chosen yet — asking for six of them on the chance that somebody
 * hovers a button is not a warm-up, it is a download nobody asked for, and on
 * a phone it is somebody's data. The floor plan is a drawing rather than a
 * picture and costs nothing to arrive with.
 *
 * `next/link` already has the route itself in hand — prefetching the page is
 * its default and none of it is repeated here. What it does not fetch is
 * images, which is the gap this closes.
 *
 * ═══ THE EXACT URL, NOT A GUESS ═══════════════════════════════════════════
 *
 * `getImageProps` is asked for the props next/image will itself render for
 * this picture at these sizes, so what is warmed is the same candidate list
 * the room will ask for — same optimiser, same widths, same quality. Setting
 * `sizes` and `srcset` on a detached element and letting the browser choose is
 * what makes it the same request rather than a similar one; a hand-built URL
 * would be a second entry in the cache and no help at all.
 *
 * ═══ AND ONLY WHEN IT IS FREE ═════════════════════════════════════════════
 *
 * Once per visit, never while the browser is saving data or on a connection
 * that has told us it is slow, and never at all where the pointer is a finger:
 * a phone has no hover to warm on, so the only thing "hovering" a button there
 * is a tap that is already navigating. */

let warmed = false;

/* The room's own `sizes` — components/reservation/reservation-hero.tsx. The
   two have to agree or this warms a candidate the room will not use. */
const SIZES = "100vw";

type Saver = { saveData?: boolean; effectiveType?: string };

function worthIt() {
  if (warmed) return false;

  /* A finger has no hover, and mobile data is the one place a speculative
     megabyte is actually rude. */
  if (window.matchMedia("(pointer: coarse), (hover: none)").matches) {
    return false;
  }

  const link = (navigator as Navigator & { connection?: Saver }).connection;
  if (link?.saveData) return false;
  if (link?.effectiveType && /2g/.test(link.effectiveType)) return false;

  return true;
}

export function warmReservationAssets() {
  if (typeof window === "undefined" || !worthIt()) return;
  warmed = true;

  const { props } = getImageProps({
    src: heroImg,
    alt: "",
    fill: true,
    sizes: SIZES,
  });

  const picture = new Image();
  /* `sizes` before `srcSet`, so the browser has the rule in hand when the
     candidates arrive and picks the one the room will render. */
  if (props.sizes) picture.sizes = props.sizes;
  if (props.srcSet) picture.srcset = props.srcSet;
  if (props.src) picture.src = props.src;
}
