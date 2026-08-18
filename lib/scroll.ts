import type Lenis from "lenis";

/* Travelling to a place on the page, in one voice.
 *
 * Everything the reservation room opens — a night, the ticket panel, the table
 * panel — is arrived at the same way: the top edge of the thing lands a little
 * below the top of the screen, never its middle and never its end. Lenis owns
 * the page's scrolling and does the travelling whenever it is mounted; the
 * plain window fallback is for the frames before it is, and for anyone who has
 * smooth scrolling off. */

/* The air left above whatever the page travels to. */
export const SCROLL_AIR = 72;

type Smooth = Lenis | undefined | null;

/* Where a node's top edge sits in the document, with the air already taken
   off — measured now, so it is the position the caller is looking at rather
   than one an animation has since moved. */
export function topOf(node: Element, air = SCROLL_AIR) {
  return node.getBoundingClientRect().top + window.scrollY - air;
}

/* Travel to an absolute position in the document. */
export function travelTo(top: number, lenis: Smooth, immediate = false) {
  const target = Math.max(0, Math.round(top));
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.1, immediate });
    return;
  }
  window.scrollTo({ top: target, behavior: immediate ? "auto" : "smooth" });
}

/* A panel that is closing steals its own height from everything under it. When
   the thing being travelled to sits below it, that height comes off the target
   before the travel starts rather than after it has landed — otherwise the
   guest arrives at where the page used to be. */
export function shrinkAbove(closing: Element | null, node: Element) {
  if (!closing || closing === node) return 0;
  const below =
    closing.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
  return below ? closing.getBoundingClientRect().height : 0;
}
