import Link from "next/link";
import { Badge } from "@/components/admin/badge";
import { EventActions } from "@/components/admin/event-actions";
import { actionsFor, posterUrl, type EventCardModel } from "@/lib/club/event-manager";
import { eventDate, eventTime, price } from "@/lib/ticketing/copy";

/* ONE NIGHT, AS A LIST READS IT.
 *
 * ═══ WHAT IS ON IT, AND WHY EXACTLY THIS ══════════════════════════════════
 *
 * The poster, the name, the date and the door time, then the states, then the
 * numbers, then what can be done to it. That order is the order somebody looks
 * for them in: the artwork identifies the night faster than any word, the date
 * is what staff are actually checking, and the numbers only matter once you
 * have found the right night.
 *
 * NOTHING IS PRINTED THAT IS NOT THERE. A night with no price, no poster and
 * no reservations shows a name and a date, and looks deliberate doing it —
 * every line below is conditional, and none of them renders an empty label or
 * a dash standing in for a fact nobody has given us.
 *
 * ═══ ONE SHAPE, NOT TWO ═══════════════════════════════════════════════════
 *
 * This replaces the old pair — a card list for phones and an eight-column
 * table for laptops — with a single row that reflows. A table of nights was
 * never the right shape: the poster cannot go in it, and the column that
 * mattered was always the name. On a phone the poster is a strip above the
 * text; from 40rem it becomes a column beside it. Same markup, one rule.
 *
 * It is a SERVER component. Only the actions need JavaScript, and they are
 * their own island. */

export function EventCard({ card }: { card: EventCardModel }) {
  const { event, counts, sale, group } = card;
  const { primary, more } = actionsFor(card);
  const poster = posterUrl(event);
  const dim = group === "finished" || group === "archived";

  return (
    <li className={`adm-event ${dim ? "adm-event--dim" : ""}`}>
      {/* The poster doubles as the way in, because it is the biggest target on
          the row and on a phone that matters more than it looks. */}
      <Link
        href={`/admin/dogadjaji/${event.id}`}
        className="adm-event-poster"
        aria-label={`Uredi ${event.title}`}
      >
        {poster ? (
          /* A plain <img>: the source is whatever object store the club has
             configured, which next/image has not been told about and cannot
             optimise without a remote pattern per bucket. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={poster} alt="" loading="lazy" />
        ) : (
          <span className="adm-event-poster-empty" aria-hidden="true">
            {event.title.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
        )}
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="adm-eyebrow">
              {eventDate(event.startsAt)} · {eventTime(event.doorsAt ?? event.startsAt)}
            </p>
            <Link
              href={`/admin/dogadjaji/${event.id}`}
              className="mt-1 block text-[1rem] leading-snug text-[var(--adm-ink)] transition-colors hover:text-[var(--adm-gold)]"
            >
              {event.title}
            </Link>
            {event.lineup ? (
              <p className="mt-0.5 text-[0.75rem] text-[var(--adm-ink-3)]">
                {event.lineup}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── the states ──────────────────────────────────────────────── */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge kind="event" value={event.status} />
          {/* The sale badge only means something for a night that sells; for a
              free-door night it would say "cena nije podešena" about a night
              that has no price on purpose. */}
          {event.ticketingEnabled ? (
            <Badge kind="sale" value={sale.open ? "open" : sale.reason} />
          ) : (
            <span className="text-[0.6875rem] text-[var(--adm-ink-4)]">
              Bez online prodaje
            </span>
          )}
          {event.tablesEnabled ? (
            <Badge kind="seat" value="reserved" />
          ) : null}
          {event.testOnly ? (
            <span className="font-mono text-[0.625rem] text-[var(--adm-ink-4)]">
              test
            </span>
          ) : null}
        </div>

        {/* ── the numbers, when there are any ─────────────────────────── */}
        {event.ticketingEnabled ? (
          <p className="adm-figure mt-2.5 text-[0.8125rem] text-[var(--adm-ink-2)]">
            {counts.paid} / {counts.capacity} prodato
            {counts.available > 0 ? (
              <span className="text-[var(--adm-ink-4)]">
                {" · "}
                {counts.available} slobodno
              </span>
            ) : null}
            {event.ticketPrice > 0 ? (
              <span className="text-[var(--adm-ink-4)]">
                {" · "}
                {price(event.ticketPrice)}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* ── what can be done ────────────────────────────────────────── */}
        <div className="mt-3.5">
          <EventActions
            id={event.id}
            slug={event.slug}
            primary={primary}
            more={more}
            compact
          />
        </div>
      </div>
    </li>
  );
}
