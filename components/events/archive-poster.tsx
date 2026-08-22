"use client";

import Image from "next/image";
import { useLang } from "@/components/providers/language";
import type { PartyEvent } from "@/lib/events";

/* A night that has already happened, kept on the wall as a record.
 *
 * It is deliberately not the night ahead and it never competes with it: the
 * colour is gone, the print is dark, and it stays that way — there is nothing
 * here to reach for, so nothing here answers a cursor. Not a link, not a
 * button, nothing to tab to. One word underneath says what it is and that is
 * the whole of it.
 *
 * The name and the date are still spoken to anyone listening to the page
 * rather than looking at it. They are not set on the wall, because a record
 * does not need a caption to read as a record. */

export function ArchivePoster({
  event,
  sizes,
}: {
  event: PartyEvent;
  sizes: string;
}) {
  const { t } = useLang();

  return (
    <article>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[4px] opacity-50 ring-1 ring-white/[0.05]">
        <Image
          src={event.poster}
          alt=""
          placeholder="blur"
          sizes={sizes}
          fill
          className="object-cover grayscale-[0.92] brightness-[0.78]"
        />
      </div>

      <h3 className="sr-only">
        {event.artist} — {t(event.date)}
      </h3>

      <p className="mt-4 text-[0.5625rem] uppercase tracking-[0.3em] text-ink-faint">
        {t("events.archived")}
      </p>
    </article>
  );
}
