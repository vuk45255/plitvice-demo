"use client";

import { RisingLockup } from "@/components/brand/rising-lockup";
import { SocialLinks } from "@/components/social-links";
import { SocialWall } from "@/components/social-wall";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";

/* `wall` is the club's own room, shown under the mark on every page that wants
   it. The story at /o-nama does not: it has just spent a whole page saying what
   the house is, and a feed of last weekend under the last line of it talks over
   the ending. Everywhere else the footer is exactly what it was. */
export function SiteFooter({ wall = true }: { wall?: boolean }) {
  const { t } = useLang();

  return (
    <footer className="relative border-t border-line pb-12 pt-24 md:pt-36">
      <div className="container-x relative z-10">
        {/* The house signs the page off with the gesture it opened it with:
            the lockup rising letter by letter, once, the first time it is
            half on screen. Not wrapped in a reveal — the rise is the entrance.
            At night a low champagne light sits behind it, as it does behind
            the hero's; by day the ink stands on the paper as drawn. */}
        <div className="relative flex justify-center py-8 md:py-14">
          <div
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              background:
                "radial-gradient(46% 60% at 50% 55%, rgba(232,216,168,0.10), rgba(200,164,93,0.04) 45%, transparent 72%)",
            }}
            aria-hidden="true"
          />
          <RisingLockup
            id="footer-mark"
            delay={0.1}
            lineAt={1.05}
            className="relative w-[min(84vw,44rem)] text-ink"
          />
        </div>

        {/* and then the room itself, one last time */}
        {wall ? <SocialWall /> : null}

        <div className="mt-16 grid gap-12 border-t border-line pt-12 md:mt-24 md:grid-cols-3 md:gap-8">
          <div>
            <p className="label">{t("footer.contact")}</p>
            <SocialLinks className="mt-4" />
          </div>
          <div>
            <p className="label">{t("footer.hours")}</p>
            <ul className="mt-4 space-y-2 text-sm tabular-nums text-ink-muted">
              {site.hours.map((entry) => (
                <li key={entry.days}>
                  {t(entry.days)} · {t(entry.time)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">{t("footer.location")}</p>
            <p className="mt-4 text-sm text-ink-muted">
              {site.street}, {site.town}
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-3 border-t border-line pt-6 text-center text-xs text-ink-faint sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:text-left">
          <p>{t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}
