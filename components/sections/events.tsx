"use client";

import { Reveal } from "@/components/reveal";
import { SectionHead } from "@/components/section-head";
import { SectionWord } from "@/components/section-word";
import { Ambient } from "@/components/ambient";
import { EventPoster } from "@/components/events/event-poster";
import { useLang } from "@/components/providers/language";
import { nextEvent, pastEvents } from "@/lib/events";

/* The night ahead takes the room; the nights behind it sit smaller and in grey
   until you look at them. The poster is the whole object — the billing rises
   out of it on hover and the only line under it is the way in. */

const alsoRan = pastEvents.slice(0, 2);

export function Events() {
  const { t, tRich } = useLang();

  return (
    <section
      id="events"
      aria-labelledby="events-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-surface-2 py-28 md:py-44"
    >
      <SectionWord word="Events" />
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

        <div className="mt-16 grid gap-14 md:mt-24 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            {nextEvent ? (
              <Reveal y={36}>
                <p className="rail mb-6 block">{t("events.next")}</p>
                {/* the glow that marks this one out */}
                <div className="relative">
                  <div
                    className="pointer-events-none absolute -inset-6 -z-10 opacity-70 blur-2xl"
                    style={{
                      background:
                        "radial-gradient(60% 50% at 50% 45%, rgba(200,164,93,0.3), transparent 72%)",
                    }}
                    aria-hidden="true"
                  />
                  <EventPoster
                    event={nextEvent}
                    scale="feature"
                    sizes="(min-width: 768px) 56vw, 92vw"
                  />
                </div>
              </Reveal>
            ) : (
              <Reveal y={36}>
                <p className="rail mb-6 block">{t("events.next")}</p>
                <p className="max-w-[26rem] text-base leading-[1.8] text-ink-muted">
                  {t("events.none")}
                </p>
              </Reveal>
            )}
          </div>

          <div className="md:col-span-4 md:col-start-9 md:mt-28">
            <Reveal delay={0.1} y={36}>
              <p className="rail mb-6 block">{t("events.past")}</p>
              <ul className="grid grid-cols-2 gap-5 md:grid-cols-1 md:gap-10">
                {alsoRan.map((event) => (
                  <li key={event.slug}>
                    <EventPoster
                      event={event}
                      sizes="(min-width: 768px) 28vw, 44vw"
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
