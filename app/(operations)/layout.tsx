import type { Metadata } from "next";

/* The operational pages: a ticket, an order, and the door.
 *
 * WHAT THIS LAYOUT IS FOR IS WHAT IT DOES NOT DO. The club's site is a heavy
 * thing on purpose — smooth scroll, an entrance ceremony, a record playing on
 * the right-hand edge, a film grain over everything, a dictionary. All of that
 * belongs to a visitor being sold a night out. None of it belongs to a guest
 * standing in a queue with their phone out, and still less to a doorman whose
 * scanner has to open on whatever signal there is in a doorway.
 *
 * So these pages sit in their own group, outside app/(site)/layout.tsx, and
 * carry: the fonts, the palette, and their own JavaScript. No Lenis, no motion
 * library, no audio element, no provider tree, no hero video. The ticket ships
 * as HTML with the QR already drawn into it — see lib/ticketing/qr.ts — so it
 * is legible before a single script has run, which is the only guarantee worth
 * having when somebody is being waved forward.
 *
 * ALWAYS NIGHT. The theme toggle is part of the site's chrome and is not here;
 * these two pages are the club after midnight whichever way anybody's phone is
 * set. */

export const metadata: Metadata = {
  /* Neither a ticket nor the door has any business in a search index. */
  robots: { index: false, follow: false },
};

export default function OperationsLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-night text-night-ink [color-scheme:dark]">
      {children}
    </div>
  );
}
