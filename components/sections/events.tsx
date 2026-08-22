"use client";

import { Reveal } from "@/components/reveal";
import { SectionHead } from "@/components/section-head";
import { SectionWord } from "@/components/section-word";
import { Ambient } from "@/components/ambient";
import { ArchivePoster } from "@/components/events/archive-poster";
import { UpcomingEvent } from "@/components/events/upcoming-event";
import { useLang } from "@/components/providers/language";
import { nextEvent, pastEvents } from "@/lib/events";

/* The night ahead takes the room; the nights behind it sit smaller and in grey
   until you look at them.
 *
 * The section is built as four layers, and scroll moves them by different
 * amounts so the room has a floor and a back wall rather than being a flat
 * page:
 *
 *   1  the dark, and the house lamps behind it
 *   2  the word EVENTS, drifting at about a quarter of the page's rate
 *   3  the light the night ahead is throwing into that dark
 *   4  the artwork, and what the house has to say about it
 *
 * The composition stays what it was — one large, two small, off an uneven
 * baseline — because that asymmetry is what keeps it from reading as a grid of
 * cards. What changed is that the night ahead now sits in its own light. */

const alsoRan = pastEvents.slice(0, 2);

export function Events() {
  const { t, tRich } = useLang();

  return (
    <section
      id="events"
      aria-labelledby="events-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-surface-2 py-28 md:py-44"
    >
      {/* LAYER 2 — far enough back that it travels at a fraction of the page's
          own rate. Any faster and it starts to read as something on the page
          rather than behind it. */}
      <SectionWord word="Events" speed={0.72} />
      <Ambient variant="soft" />

      {/* one warm light raking in from the right, as if from the bar */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 45% at 100% 22%, rgba(200,164,93,0.1), transparent 68%)",
        }}
        aria-hidden="true"
      />
      <div className="container-x relative z-10">
        <SectionHead
          title={tRich("events.title")}
          titleId="events-title"
          align="right"
        />

        {/* The night ahead is given a narrower column than it used to have and
            a wider gutter beside it. It reads as the larger thing because of
            the colour, the light and the landing rather than because it is
            crowding the page. */}
        <div className="mt-16 grid gap-16 md:mt-28 md:grid-cols-12 md:gap-x-12">
          <div className="md:col-span-6">
            {nextEvent ? (
              <>
                <Reveal>
                  <p className="rail mb-7 block">{t("events.next")}</p>
                </Reveal>
                <UpcomingEvent
                  event={nextEvent}
                  sizes="(min-width: 768px) 48vw, 92vw"
                />
              </>
            ) : (
              <Reveal y={36}>
                <p className="rail mb-7 block">{t("events.next")}</p>
                <p className="max-w-[26rem] text-base leading-[1.8] text-ink-muted">
                  {t("events.none")}
                </p>
              </Reveal>
            )}
          </div>

          <div className="md:col-span-4 md:col-start-9 md:mt-32">
            <Reveal delay={0.1} y={36}>
              <p className="rail mb-7 block">{t("events.past")}</p>
              <ul className="grid grid-cols-2 gap-6 md:grid-cols-1 md:gap-12">
                {alsoRan.map((event) => (
                  <li key={event.slug}>
                    <ArchivePoster
                      event={event}
                      sizes="(min-width: 768px) 26vw, 44vw"
                    />
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
