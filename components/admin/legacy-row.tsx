import Link from "next/link";
import { posterUrl } from "@/lib/club/event-manager";
import { eventDate } from "@/lib/ticketing/copy";
import type { TicketingEvent } from "@/lib/ticketing/event-rules";

/* A NIGHT FROM BEFORE THE SOFTWARE, AS THE OFFICE LISTS IT.
 *
 * ═══ WHY THIS IS NOT AN EventCard ═════════════════════════════════════════
 *
 * It would have been less code to reuse the operational row and pass zeros
 * into it. That is precisely the thing not to do: an EventCard has a sold
 * count, a sale badge and a set of actions, and every one of those would say
 * something false about a poster. `0 / 500 prodato` reads as a night that
 * flopped. `Bez online prodaje` reads as a decision somebody made. PAUZIRAJ
 * PRODAJU offers to stop selling a night that finished in 2025.
 *
 * A different fact deserves a different row. This one carries the artwork, the
 * name and the date, and nothing else, because that is the entirety of what
 * the club knows about these nights. */
export function LegacyRow({ event }: { event: TicketingEvent }) {
  const poster = posterUrl(event);

  return (
    <li className="adm-event adm-event--dim">
      <Link
        href={`/admin/dogadjaji/${event.id}`}
        className="adm-event-poster"
        aria-label={event.title}
      >
        {poster ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={poster} alt="" loading="lazy" />
        ) : (
          <span className="adm-event-poster-empty" aria-hidden="true">
            {event.title.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
        )}
      </Link>

      <div className="min-w-0">
        <p className="adm-figure text-[0.6875rem] text-[var(--adm-ink-4)]">
          {eventDate(event.startsAt)}
        </p>
        <Link
          href={`/admin/dogadjaji/${event.id}`}
          className="mt-1 block text-[0.9375rem] leading-snug text-[var(--adm-ink-2)] transition-colors hover:text-[var(--adm-gold)]"
        >
          {event.title}
        </Link>
        <p className="mt-1.5 text-[0.6875rem] text-[var(--adm-ink-4)]">
          Arhivski poster — bez podataka o prodaji
        </p>
      </div>
    </li>
  );
}
