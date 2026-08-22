"use client";

import { PlitviceSignature } from "@/components/plitvice-signature";
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
        {/* The house signs the page off. Deliberately not wrapped in a
            reveal: the writing is the entrance, and a fade over the top of it
            would be the one thing this is not supposed to look like. */}
        <div className="flex justify-center py-6 md:py-12">
          <PlitviceSignature className="w-[92vw] md:w-[85%] md:max-w-[1130px]" />
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
          {/* a shade brighter and a touch heavier than the copyright — read
              before it, never louder than it */}
          <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-ink-muted transition-colors duration-500 hover:text-accent">
            {t("footer.credit")}
          </p>
        </div>
      </div>
    </footer>
  );
}
