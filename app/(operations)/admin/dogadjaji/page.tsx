import Link from "next/link";
import type { Metadata } from "next";
import { Empty, PageHeader, Panel, Scroller } from "@/components/admin/shell";
import { Badge } from "@/components/admin/badge";
import { EventCreateForm } from "@/components/admin/event-create-form";
import { allTicketingEvents, saleState } from "@/lib/ticketing/events";
import { countsFor } from "@/lib/ticketing/store";
import { eventDate, price } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* /admin/dogadjaji — every night the system knows about.
 *
 * A list and a form to add one. Not a CMS: the poster, the ambient colour and
 * the copy on the wall belong to lib/events.ts and to a deploy, because they
 * are design decisions and the club does not make those at one in the morning.
 * What is here is what the club genuinely changes at one in the morning — a
 * price, a capacity, whether the thing is selling.
 *
 * THE NEXT NIGHT IS THE LOUD ONE. It gets a card of its own at the top with its
 * numbers in full; everything else is a row, and a night that has already
 * happened is dimmed rather than hidden — the club reads last night's figures
 * the next afternoon.
 *
 * SOLD AND REMAINING ARE COUNTED PER NIGHT, in one query each. See `countsFor`:
 * there is no stored total anywhere in this system. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Događaji",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminEventsPage() {
  await requireStaff("admin");

  const events = await allTicketingEvents();
  const rows = await Promise.all(
    events.map(async (event) => ({ event, counts: await countsFor(event.id) })),
  );

  const now = new Date();
  const upcoming = rows
    .filter(({ event }) => new Date(event.startsAt) >= now && event.status !== "ended")
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  const past = rows
    .filter((row) => !upcoming.includes(row))
    .sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt));

  const [next, ...rest] = upcoming;

  return (
    <>
      <PageHeader
        eyebrow="Program"
        title="Događaji"
        lede="Cena, kapacitet i prodaja se menjaju ovde i odmah važe. Poster i tekst na sajtu se menjaju u kodu."
      />

      {next ? (
        <section className="adm-panel mb-6 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="adm-eyebrow">Sledeće veče · {eventDate(next.event.startsAt)}</p>
              <h2 className="adm-display mt-2 text-[clamp(1.375rem,4vw,1.875rem)] text-[var(--adm-ink)]">
                {next.event.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge kind="event" value={next.event.status} />
                <Badge
                  kind="sale"
                  value={
                    saleState(next.event, next.counts.taken).open
                      ? "open"
                      : (saleState(next.event, next.counts.taken) as { reason: string })
                          .reason
                  }
                />
              </div>
            </div>

            <Link
              href={`/admin/dogadjaji/${next.event.id}`}
              className="adm-btn adm-btn--primary adm-btn--sm"
            >
              Uredi
            </Link>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--adm-line-soft)] pt-4 sm:grid-cols-4">
            <Figure label="Cena" value={next.event.ticketPrice ? price(next.event.ticketPrice) : "—"} />
            <Figure label="Kapacitet" value={String(next.counts.capacity)} />
            <Figure label="Prodato" value={String(next.counts.paid)} tone="gold" />
            <Figure label="Preostalo" value={String(next.counts.available)} />
          </dl>
        </section>
      ) : null}

      <Panel
        title="Svi događaji"
        action={
          <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
            {events.length}
          </span>
        }
      >
        {events.length === 0 ? (
          <Empty>Nema nijednog događaja. Dodajte prvo veče ispod.</Empty>
        ) : (
          <>
            {/* On a phone: one row per night, three lines each. */}
            <ul className="sm:hidden">
              {[...rest, ...past].map(({ event, counts }) => (
                <li key={event.id} className={`adm-row ${isPast(event.startsAt, now) ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link
                      href={`/admin/dogadjaji/${event.id}`}
                      className="text-[0.9375rem] text-[var(--adm-ink)]"
                    >
                      {event.title}
                    </Link>
                    <Badge kind="event" value={event.status} />
                  </div>
                  <p className="mt-1 text-[0.6875rem] text-[var(--adm-ink-4)]">
                    {eventDate(event.startsAt)}
                  </p>
                  <p className="adm-figure mt-2 text-[0.8125rem] text-[var(--adm-ink-2)]">
                    {counts.paid} / {counts.capacity} prodato · {counts.available} slobodno
                    {event.ticketPrice ? ` · ${price(event.ticketPrice)}` : ""}
                  </p>
                </li>
              ))}
            </ul>

            <Scroller>
              <table className="adm-table hidden min-w-[48rem] sm:table">
                <thead>
                  <tr>
                    <th>Naziv</th>
                    <th>Datum</th>
                    <th>Status</th>
                    <th>Prodaja</th>
                    <th className="text-right">Cena</th>
                    <th className="text-right">Kapacitet</th>
                    <th className="text-right">Prodato</th>
                    <th className="text-right">Preostalo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...upcoming, ...past].map(({ event, counts }) => {
                    const state = saleState(event, counts.taken);
                    const dim = isPast(event.startsAt, now);
                    return (
                      <tr key={event.id} className={dim ? "opacity-55" : undefined}>
                        <td>
                          <Link
                            href={`/admin/dogadjaji/${event.id}`}
                            className="text-[0.875rem] text-[var(--adm-ink)] transition-colors hover:text-[var(--adm-gold)]"
                          >
                            {event.title}
                          </Link>
                          <span className="mt-0.5 block font-mono text-[0.625rem] text-[var(--adm-ink-4)]">
                            {event.slug}
                          </span>
                        </td>
                        <td className="text-[0.75rem]">{eventDate(event.startsAt)}</td>
                        <td>
                          <Badge kind="event" value={event.status} />
                        </td>
                        <td>
                          <Badge
                            kind="sale"
                            value={state.open ? "open" : state.reason}
                          />
                        </td>
                        <td className="adm-figure text-right">
                          {event.ticketPrice ? price(event.ticketPrice) : "—"}
                        </td>
                        <td className="adm-figure text-right">{counts.capacity}</td>
                        <td className="adm-figure text-right text-[var(--adm-gold-light)]">
                          {counts.paid}
                        </td>
                        <td className="adm-figure text-right">{counts.available}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroller>
          </>
        )}
      </Panel>

      <Panel title="Novo veče">
        <EventCreateForm />
      </Panel>
    </>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold";
}) {
  return (
    <div>
      <dt className="adm-label">{label}</dt>
      <dd
        className={`adm-figure mt-1.5 text-[1.25rem] ${
          tone === "gold" ? "text-[var(--adm-gold-light)]" : "text-[var(--adm-ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const isPast = (startsAt: string, now: Date) => new Date(startsAt) < now;
