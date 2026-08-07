"use client";

import { Reveal } from "@/components/reveal";
import { Lockup } from "@/components/lockup";
import { SocialLinks } from "@/components/social-links";
import { SocialWall } from "@/components/social-wall";
import { useLang } from "@/components/providers/language";
import { ReserveButton } from "@/components/reservation/reserve-button";
import { site } from "@/lib/site";

export function SiteFooter() {
  const { t } = useLang();

  return (
    <footer className="relative border-t border-line pb-12 pt-24 md:pt-36">
      <div className="container-x relative z-10">
        {/* The mark closes the page exactly as it opened it. */}
        <Reveal>
          <div aria-hidden="true">
            <Lockup size="lg" />
          </div>
        </Reveal>

        {/* and then the room itself, one last time */}
        <SocialWall />

        <div className="mt-16 grid gap-12 border-t border-line pt-12 md:mt-24 md:grid-cols-3 md:gap-8">
          <div>
            <p className="label">{t("footer.contact")}</p>
            <SocialLinks className="mt-4" />
            <ul className="mt-6 space-y-2 text-sm">
              <li>
                <a
                  href={site.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline"
                >
                  {t("footer.maps")}
                </a>
              </li>
            </ul>
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
            {/* the last door out of the page, and it leads back inside */}
            <ReserveButton className="mt-6 w-full text-center sm:w-auto" />
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
