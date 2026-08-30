"use client";

import { useEffect, useRef } from "react";

/* THE TAB YOU ARE ON IS THE ONE YOU HAVE TO BE ABLE TO SEE.
 *
 * The tab strip in components/admin/tabs.tsx scrolls sideways on a narrow
 * phone rather than wrapping — five names are 531px wide and a 360px screen
 * has 328px of column. That scroll starts at zero, so arriving on the last tab
 * showed a strip reading PREGLED · PRODAJA · REZERVACIJE with no gold underline
 * anywhere on it: PODEŠAVANJA sat 70px past the right edge of its own scroller.
 * It read as a tab strip that had been cut off rather than one that had
 * scrolled — and PODEŠAVANJA is exactly where UREDI VEČE lands somebody.
 *
 * ═══ WHY THIS IS A FILE OF ITS OWN ════════════════════════════════════════
 *
 * `Tabs` takes an `href` FUNCTION, and a function cannot be passed from a
 * server component into a client one. So the strip stays on the server, where
 * it costs no JavaScript, and only this — the one thing a link cannot express
 * — crosses the boundary. It renders nothing.
 *
 * ═══ IT SCROLLS THE STRIP AND NEVER THE PAGE ══════════════════════════════
 *
 * `scrollIntoView` would have been one line, and would also have scrolled the
 * document vertically — jumping somebody past the header they had just arrived
 * at, on every tab change. Setting `scrollLeft` on the strip moves the strip
 * and nothing else. */
export function KeepActiveTabVisible({ active }: { active: string }) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const strip = anchor.current?.closest<HTMLElement>(".adm-tabs");
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !current) return;

    /* Both boxes are read in viewport coordinates and only their difference is
       used, so this is the same arithmetic wherever the page happens to be
       scrolled to. */
    const view = strip.getBoundingClientRect();
    const tab = current.getBoundingClientRect();

    /* Already in view: on a laptop, and on a phone whenever the current tab is
       one of the first two. Nothing moves. */
    if (tab.left >= view.left && tab.right <= view.right) return;

    /* Centred where there is room, which keeps a tab visible on either side of
       the current one — so it is obvious that the strip scrolls at all. */
    strip.scrollLeft += tab.left - view.left - (view.width - tab.width) / 2;
  }, [active]);

  return <span ref={anchor} hidden />;
}
