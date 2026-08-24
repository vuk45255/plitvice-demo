"use client";

import { Reveal } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { InfoShell } from "@/components/local-info/info-shell";
import { InfoLocationCard } from "@/components/local-info/info-location-card";
import { PAGE_COPY, PLACES } from "@/lib/info-places";
import type { InfoCategory } from "@/lib/local-info";

/* FIVE OF THE SIX PAGES — the concierge, answering one question at a time.
 *
 * The page is a list and nothing else: every entry is an InfoLocationCard and
 * this file decides only what order they come in and how far apart they stand.
 * There is no per-category design here and there is not meant to be — see the
 * note at the top of info-location-card.tsx.
 *
 * The gap between cards is twenty-four pixels. Close enough that the page
 * reads as one list rather than as a stack of separate objects, far enough
 * that each card is plainly its own recommendation. */

export function InfoDirectory({ category }: { category: InfoCategory }) {
  const { t } = useLang();
  const places = PLACES[category.id] ?? [];
  const copy = PAGE_COPY[category.slug];

  return (
    <InfoShell
      word={t(category.name)}
      titleA={copy.a}
      titleB={copy.b}
    >
      <div className="container-x">
        <ol className="mx-auto flex max-w-[74rem] flex-col gap-6">
          {places.map((place, i) => (
            /* The reveal goes INSIDE the item. An <ol> may hold nothing but
               <li>, and Reveal is a div — wrapping the item in it would put a
               div between the list and its own children. */
            <li key={place.name}>
              <Reveal y={18} delay={Math.min(i * 0.05, 0.25)}>
                <InfoLocationCard place={place} />
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </InfoShell>
  );
}
