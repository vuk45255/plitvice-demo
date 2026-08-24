"use client";

import { Arrow } from "@/components/arrow";
import { Reveal } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { InfoMap } from "@/components/local-info/info-map";
import { InfoShell } from "@/components/local-info/info-shell";
import { HOUSE, PAGE_COPY, ROUTES, placeEmbed } from "@/lib/info-places";
import { routeUrl, type InfoCategory } from "@/lib/local-info";
import { site } from "@/lib/site";

/* THE SIXTH PAGE, AND THE ONLY ONE THAT IS NOT A DIRECTORY.
 *
 * The other five answer "where in town"; this one answers "where is the club",
 * and there is exactly one answer. So it is not a list of anything: it is the
 * address, set as large as the page will carry, three lines about how people
 * actually arrive, and one door.
 *
 * The address is the biggest type on any of the six pages on purpose. It is
 * the single most useful fact the concierge has, and a visitor who reads
 * nothing else on this page has still got what they came for.
 *
 * NOTHING HERE LINKS TO A TIMETABLE. The old page had none, and an invented
 * operator URL is worse than leaving a reader to search — see the note on
 * ROUTES in lib/info-places.ts. The one link is the club's own map, which is
 * the same query the home page's map is drawn from. */

export function InfoRoute({ category }: { category: InfoCategory }) {
  const { t, lang } = useLang();
  const copy = PAGE_COPY[category.slug];

  return (
    <InfoShell
      word={t(category.name)}
      titleA={copy.a}
      titleB={copy.b}
    >
      <div className="container-x">
        <div className="mx-auto max-w-[74rem]">
          {/* ── the address on the left, and a map you can actually drive on
                 the right ──

                 THE ONLY INTERACTIVE MAP ON THE SITE. Everywhere else a map is
                 a window: covered by a link, because a list of seven of them
                 inside a scrolling page would swallow the wheel. This page
                 carries one, it is the whole point of the page, and somebody
                 working out where the club is wants to pan and zoom it. So it
                 is handed `interactive` and nothing is laid over it — see
                 components/local-info/info-map.tsx. */}
          <Reveal y={20}>
            <section
              aria-labelledby="route-address"
              className="grid gap-10 md:grid-cols-[1fr_minmax(0,52%)] md:items-center md:gap-14"
            >
              <div>
                <p id="route-address" className="rail rail-night">
                  {t("info.route.here")}
                </p>

                <p className="mt-8 font-serif uppercase leading-[0.98] tracking-[-0.015em] text-night-ink text-[clamp(2rem,7vw,4.25rem)]">
                  <span className="block">{site.street}</span>
                  <span className="block text-night-ink/55">{site.town}</span>
                </p>

                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t("info.route.open")} — ${site.name}, ${site.street}, ${site.town}`}
                  className="group mt-10 inline-flex items-center gap-5 text-[0.6875rem] uppercase tracking-[0.36em] text-gold/80 outline-none transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-gold-light focus-visible:text-gold-light md:mt-12"
                >
                  <span className="indent-[0.36em] transition-[transform,text-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[4px] group-hover:[text-shadow:0_0_24px_rgba(200,164,93,0.45)] group-focus-visible:translate-x-[4px]">
                    {t("info.route.open")}
                  </span>
                  <Arrow className="w-10 group-hover:w-16 group-focus-visible:w-16" />
                </a>
              </div>

              <InfoMap
                embed={placeEmbed(HOUSE, lang)}
                href={routeUrl}
                interactive
                className="h-[320px] rounded-[3px] border border-gold/[0.12] sm:h-[360px] md:h-[440px]"
              />
            </section>
          </Reveal>

          {/* ── and the three ways people arrive ── */}
          <div className="mt-16 md:mt-24">
            {ROUTES.map((route, i) => (
              <Reveal key={route.id} y={18} delay={Math.min(i * 0.06, 0.2)}>
                <section className="grid gap-4 border-t border-line/70 py-9 last:border-b md:grid-cols-[minmax(0,14rem)_1fr] md:gap-12 md:py-11">
                  <h2 className="text-[0.6875rem] uppercase tracking-[0.3em] text-gold/70">
                    {t(route.name)}
                  </h2>
                  <p className="max-w-[36rem] text-base leading-[1.8] text-night-ink/60">
                    {t(route.note)}
                  </p>
                </section>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </InfoShell>
  );
}
