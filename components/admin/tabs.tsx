import Link from "next/link";
import { KeepActiveTabVisible } from "@/components/admin/tabs-scroll";

/* THE FOUR VIEWS OF ONE NIGHT.
 *
 * ═══ LINKS, NOT STATE ═════════════════════════════════════════════════════
 *
 * A tab here is an anchor with a query string on it, rendered on the server.
 * That buys three things a `useState` tab strip does not:
 *
 *   · it is addressable. A manager can send somebody the URL of the sales tab
 *     of last Saturday, which is a thing people in an office actually do.
 *   · it costs no JavaScript. Every kilobyte of the office is a kilobyte a
 *     doorman's phone loads on one bar of signal — the rule this whole route
 *     group exists to hold, see app/(operations)/layout.tsx.
 *   · each tab fetches only its own data. The reservations tab does not query
 *     the scan log, and the report of a finished night does not load an editor
 *     nobody opened.
 *
 * It is a real tablist for a screen reader — `aria-current` on the one you are
 * on — and it scrolls sideways inside itself on a narrow phone rather than
 * wrapping to two rows or pushing the page wide.
 *
 * ═══ AND THE TAB YOU ARE ON HAS TO BE THE ONE YOU CAN SEE ═════════════════
 *
 * That sideways scroll starts at zero, and the five names are 531px wide on a
 * 360px phone. So arriving on PODEŠAVANJA — which is exactly where UREDI VEČE
 * lands somebody — showed a strip reading PREGLED · PRODAJA · REZERVACIJE with
 * no gold underline anywhere on it: the current tab sat 70px past the right
 * edge of its own scroller, and the screen looked like a tab strip that had
 * been cut off rather than one that had scrolled.
 *
 * This is the one piece of behaviour a query-string tab strip cannot express
 * as a link, so it is the one piece of JavaScript here — and it is kept in a
 * component of its own, `KeepActiveTabVisible`, so that THIS file stays a
 * server component. It has to: `href` below is a function, and a function
 * cannot be handed across the boundary into a client component. */

export type TabItem<T extends string> = {
  id: T;
  label: string;
  /* A count beside the name, where one helps somebody choose: REZERVACIJE 14.
     Left off where the number would be noise, and never shown as 0 — an empty
     tab says so when you open it. */
  count?: number;
};

export function Tabs<T extends string>({
  tabs,
  active,
  href,
}: {
  tabs: TabItem<T>[];
  active: T;
  /* How to build the address of a tab. The caller owns the URL shape so this
     component never knows what a night's id is or which query key is in use. */
  href: (id: T) => string;
}) {
  return (
    <nav className="adm-tabs" aria-label="Prikaz događaja">
      <KeepActiveTabVisible active={String(active)} />
      <ul className="adm-tabs-list">
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={href(tab.id)}
                aria-current={current ? "page" : undefined}
                className="adm-tab"
                /* Same-page navigation: keep the visitor where they were
                   vertically rather than jumping them back to the title. */
                scroll={false}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 ? (
                  <span className="adm-tab-count">{tab.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
