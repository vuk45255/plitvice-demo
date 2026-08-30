import Link from "next/link";
import type { Metadata } from "next";
import { CalendarRange, LayoutGrid, QrCode, SquarePen } from "lucide-react";
import { Empty, Panel, PageHeader, Stat, StatGrid } from "@/components/admin/shell";
import { Badge, stateLabel } from "@/components/admin/badge";
import { sweepHolds } from "@/app/(operations)/admin/actions";
import { floorState } from "@/lib/reservations/admin";
import { databaseKind } from "@/lib/db/client";
import { failedDeliveries } from "@/lib/mail/send";
import { providerName } from "@/lib/mail/provider";
import { mediaReadiness } from "@/lib/media/provider";
import { allTicketingEvents, saleState } from "@/lib/ticketing/events";
import { hasEnded } from "@/lib/ticketing/event-rules";
import { listOrders, recentScans } from "@/lib/ticketing/store";
import { eventReport, reportSummaries } from "@/lib/club/event-report";
import {
  eventGroupOf,
  eventStatusBadge,
  isOperational,
  posterUrl,
} from "@/lib/club/event-manager";
import { eventDate, eventTime, price, scanMoment } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* THE NIGHT AT A GLANCE — the first screen anybody in the office opens.
 *
 * ═══ THE FIVE QUESTIONS, IN THE ORDER THEY ARE ASKED ══════════════════════
 *
 * Somebody opening this at eleven o'clock wants five answers before they put
 * the phone back in their pocket:
 *
 *   1. which night are we on
 *   2. how many tickets have sold
 *   3. how many tables are gone
 *   4. how many people are inside
 *   5. is anything wrong
 *
 * So the layout is: the night, its four actions, one row of figures, then
 * anything that needs attention, then the door and the programme. Nothing else
 * competes for the top of the screen. This is the discipline the serious
 * operations platforms hold to — Fourvenues opens on one event with its live
 * counters rather than on a chart of the quarter — and the rule underneath it
 * is that a card has to answer an operational question or it does not go on.
 *
 * ═══ EVERY NUMBER IS COUNTED, NEVER STORED ═══════════════════════════════
 *
 * There is no `tickets_sold` column anywhere in this system. The figures come
 * from lib/club/event-report.ts, which aggregates the rows that prove them —
 * and the programme list underneath uses `reportSummaries`, which answers for
 * every night in three queries rather than three per night.
 *
 * ═══ AND NOTHING IS INVENTED ══════════════════════════════════════════════
 *
 * There is no takings figure on this screen and there is no attendance figure.
 * What this system knows about money is what went through the online checkout;
 * what it knows about the door is how many tickets were scanned. Both are
 * labelled as exactly that. The bar, the cash at the door and the people who
 * walked in on a free night are not in any table here, so they are not on any
 * card here.
 *
 * Nothing polls. It is a screen somebody refreshes when they want to know; a
 * dashboard that reloads itself every second is one nobody can read a figure
 * off. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Uprava",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminHome() {
  await requireStaff("admin");

  const all = await allTicketingEvents();
  const kind = await databaseKind();
  const media = mediaReadiness();

  /* ═══ THE OFFICE WORKS WITH THE NIGHTS THIS SYSTEM RAN ═══════════════════
   *
   * The poster-only archive is filtered out here and nowhere else on this
   * screen. Those nights have no orders, no tickets and no scans, so every
   * figure beside one is a zero that means "never measured" — and a control
   * centre that leads with Dara Bubamara, 0/500 sold, is a control centre
   * lying about a night it never ran. The record is still complete and still
   * public; see `isOperational` in lib/club/event-manager.ts. */
  const events = all.filter(isOperational);

  /* Tonight, or the next one: the soonest night that has not finished.
     `hasEnded` is the one rule — a Saturday is still tonight at four on Sunday
     morning, which is exactly when somebody is looking at this. If everything
     is past, the most recent one stands. */
  const now = new Date();
  const ahead = [...events]
    .filter((event) => event.status !== "ended" && !hasEnded(event, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const current =
    ahead[0] ?? [...events].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];

  if (!current) {
    return (
      <>
        <PageHeader title="Plitvice kontrolni centar" />
        <Panel>
          <Empty
            action={
              <Link href="/admin/dogadjaji/novi" className="adm-btn adm-btn--primary">
                Dodaj događaj
              </Link>
            }
          >
            Nema aktivnog događaja.
          </Empty>
        </Panel>
      </>
    );
  }

  const tablesEnabled = current.tablesEnabled;

  const [report, floor, scans, pending, failed, others] = await Promise.all([
    eventReport(current),
    tablesEnabled ? floorState(current.slug) : null,
    recentScans(current.id, 6),
    listOrders({ eventId: current.id, status: "pending", limit: 50 }),
    failedDeliveries(5),
    /* THE OTHER NIGHTS, WITH THEIR FIGURES, IN THREE QUERIES TOTAL. Asking
       per night is the N+1 that gets worse every month the club stays open.
     *
     * ═══ WHAT "NEDAVNI" HAS TO MEAN, AND WHAT SORTING GETS WRONG ═════════
     *
     * A single descending sort fills this panel with the nights FURTHEST IN
     * THE FUTURE: with seven nights announced, not one night the club has
     * actually run appears, and since the headline figure below is only
     * printed for a finished night, every row comes out bare — which is the
     * one thing this panel was rewritten to stop.
     *
     * So it is two lists, in the order somebody reads them: what is coming,
     * soonest first, and then what just happened, most recent first. The same
     * two orders /admin/dogadjaji groups by, for the same reason. */
    (async () => {
      const rest = events.filter((event) => event.id !== current.id);
      const upcoming = rest
        .filter((event) => eventGroupOf(event, now) === "active")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const done = rest
        .filter((event) => eventGroupOf(event, now) !== "active")
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
      const shown = [...upcoming.slice(0, 3), ...done].slice(0, 6);
      return { shown, summaries: await reportSummaries(shown) };
    })(),
  ]);

  const { sales, access, reservations } = report;
  const state = saleState(current, sales.ticketsPaid + sales.ticketsHeld);
  /* Pending orders whose ten minutes are still running — the ones actually
     holding admissions right now. The rest are lapsed and hold nothing. */
  const live = pending.filter((order) => new Date(order.holdExpiresAt) > now);
  const poster = posterUrl(current);

  return (
    <>
      <PageHeader title="Plitvice kontrolni centar" />

      {/* ── the night ─────────────────────────────────────────────────── */}
      <section className="adm-panel adm-hero mb-5">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-5 px-5 py-5 sm:px-6">
          {poster ? (
            <div className="adm-hero-poster">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt="" />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
              {eventDate(current.startsAt)} ·{" "}
              {eventTime(current.startsAt)}
            </p>
            <h2 className="adm-display mt-1.5 text-[clamp(1.375rem,4.5vw,2rem)] text-[var(--adm-ink)]">
              {current.title}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge kind="event" value={eventStatusBadge(current, now)} />
              {current.ticketingEnabled ? (
                <Badge kind="sale" value={state.open ? "open" : state.reason} />
              ) : (
                <span className="text-[0.6875rem] text-[var(--adm-ink-4)]">
                  Ulaz na vratima — bez online prodaje
                </span>
              )}
              {current.ticketingEnabled && current.ticketPrice > 0 ? (
                <span className="adm-figure text-[0.75rem] text-[var(--adm-gold-light)]">
                  {price(current.ticketPrice)}
                </span>
              ) : null}
            </div>
          </div>

          {/* THE FOUR THINGS SOMEBODY DOES FROM HERE, and no more. A row of
              ten small buttons is a toolbar nobody reads at speed. */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/dogadjaji/${current.id}?tab=podesavanja`}
              className="adm-btn adm-btn--sm"
            >
              <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
              Uredi veče
            </Link>
            {tablesEnabled ? (
              <Link
                href={`/admin/plan?event=${encodeURIComponent(current.slug)}`}
                className="adm-btn adm-btn--sm"
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                Plan stolova
              </Link>
            ) : null}
            <Link href="/scanner" className="adm-btn adm-btn--sm">
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              Skener
            </Link>
            <Link
              href={`/admin/dogadjaji/${current.id}`}
              className="adm-btn adm-btn--sm adm-btn--primary"
            >
              Izveštaj
            </Link>
          </div>
        </div>
      </section>

      {/* ── the figures ─────────────────────────────────────────────────
       *
       * TWO GRIDS, BECAUSE THEY ARE TWO SUBJECTS. The sale and the floor are
       * separate questions and a night that does both has eight tiles; eight
       * in a six-column row is six and two orphans, which is precisely the
       * ragged layout the shared StatGrid was added to prevent. Four across
       * fills a laptop exactly and a phone reads two up either way. */}
      {current.ticketingEnabled ? (
        <StatGrid cols={4}>
            <Stat
              label="Karte prodate"
              value={sales.ticketsPaid}
              of={sales.capacity}
              tone="gold"
            />
            <Stat
              label="Skenirano"
              value={access.admitted}
              tone="good"
              note={
                access.unused > 0 ? `${access.unused} još nije ušlo` : "svi ušli"
              }
            />
            <Stat
              label="Slobodno karata"
              value={sales.available}
              tone={sales.available === 0 ? "warn" : "plain"}
              note={sales.available === 0 ? "rasprodato" : undefined}
            />
            <Stat
              label="U toku plaćanja"
              value={live.length}
              note={
                sales.ticketsHeld > 0
                  ? `${sales.ticketsHeld} karata zadržano`
                  : undefined
              }
            />
        </StatGrid>
      ) : null}

      {tablesEnabled && floor ? (
        <StatGrid cols={4}>
            {/* LIVE BOOKINGS, NOT EVERY ROW EVER WRITTEN. `total` counts
                cancelled, rejected and expired reservations too, so it climbs
                all week and ends up contradicting the tile beside it — six
                bookings of which four cancelled would read "Rezervacije 6 ·
                Zauzeti stolovi 2". These are the two statuses that actually
                hold a table, which is what the floor plan draws. */}
            <Stat
              label="Rezervacije"
              value={reservations.confirmed + reservations.pending}
            />
            <Stat
              label="Zauzeti stolovi"
              value={floor.counts.reserved}
              tone="good"
            />
            <Stat label="Slobodni stolovi" value={floor.counts.available} />
            {/* A booking made on the site is confirmed the moment it is made,
                so "na čekanju" is a count of OLD rows and normally zero. It is
                shown only when there is something in it — otherwise the tile
                says what is happening on the floor this minute. */}
            {reservations.pending > 0 ? (
              <Stat
                label="Na čekanju"
                value={reservations.pending}
                tone="warn"
                note="potvrdite ili otkažite"
              />
            ) : (
              <Stat
                label="U toku na sajtu"
                value={floor.counts.held}
                note={floor.counts.held > 0 ? "gost bira sto" : undefined}
              />
            )}
        </StatGrid>
      ) : null}

      {/* A night that neither sells online nor takes tables still has a door,
          and if anything was ever scanned at it that is the only figure this
          system has about the evening. */}
      {!current.ticketingEnabled && !tablesEnabled ? (
        <StatGrid cols={4}>
          <Stat
            label="Skenirano"
            value={access.admitted}
            tone="good"
            note="elektronske ulaznice"
          />
        </StatGrid>
      ) : null}

      {/* A ticket mail that failed is a guest at the door with no ticket and no
          idea why, so it is high on the first screen rather than buried. */}
      {failed.length > 0 ? (
        <Panel title="Neposlate poruke">
          <ul>
            {failed.map((row) => (
              <li key={`${row.kind}:${row.key}`} className="adm-row">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Badge kind="delivery" value="failed" />
                  <span className="text-[0.8125rem] text-[var(--adm-ink-2)]">
                    {stateLabel("delivery", row.kind)} · {row.recipient}
                  </span>
                  <span className="text-[0.6875rem] text-[var(--adm-ink-4)]">
                    pokušaja: {row.attempts}
                  </span>
                </div>
                {row.lastError ? (
                  <p className="mt-2 break-words text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
                    {row.lastError}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── the door ────────────────────────────────────────────────── */}
        <Panel
          title="Poslednji ulazi"
          action={
            <Link href="/scanner" className="adm-btn adm-btn--ghost adm-btn--sm">
              Otvori skener
            </Link>
          }
        >
          {scans.length === 0 ? (
            <Empty>Još niko nije skeniran.</Empty>
          ) : (
            <ul>
              {scans.map((scan, i) => (
                <li
                  key={i}
                  className="adm-row flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
                      {scanMoment(scan.at)}
                    </span>
                    <span className="font-mono text-[0.75rem] text-[var(--adm-ink-2)]">
                      {scan.reference ?? "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {scan.door ? (
                      <span className="text-[0.6875rem] text-[var(--adm-ink-4)]">
                        {scan.door}
                      </span>
                    ) : null}
                    <Badge kind="scan" value={scan.outcome} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── the other nights ────────────────────────────────────────── */}

        {/* NIGHTS THIS SYSTEM RAN, AND WHAT THEY DID. The old version of this
            panel was a list of names and dates — including ten poster nights
            from before the software, which made it read as a programme rather
            than as operations. It is now the recent operational record with
            the one figure that matters beside each. */}
        <Panel
          title="Nedavni događaji"
          action={
            <Link
              href="/admin/dogadjaji"
              className="adm-btn adm-btn--ghost adm-btn--sm"
            >
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
              Svi
            </Link>
          }
        >
          {others.shown.length === 0 ? (
            <Empty>Nema drugih događaja koje je vodio ovaj sistem.</Empty>
          ) : (
            <ul>
              {others.shown.map((event) => {
                const summary = others.summaries.get(event.id);
                const group = eventGroupOf(event, now);
                return (
                  <li
                    key={event.id}
                    className="adm-row flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3"
                  >
                    <span className="min-w-0">
                      <Link
                        href={`/admin/dogadjaji/${event.id}`}
                        className="block truncate text-[0.875rem] text-[var(--adm-ink)] transition-colors hover:text-[var(--adm-gold)]"
                      >
                        {event.title}
                      </Link>
                      <span className="adm-figure mt-0.5 block text-[0.6875rem] text-[var(--adm-ink-4)]">
                        {eventDate(event.startsAt)}
                        {/* Sold is printed only for a night that sold. A
                            free-door night showing 0/500 would be reporting a
                            failure that never happened. */}
                        {event.ticketingEnabled && summary
                          ? ` · ${summary.ticketsPaid}/${event.capacity} karata`
                          : ""}
                        {summary && summary.tablesTaken > 0
                          ? ` · ${summary.tablesTaken} stolova`
                          : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {group === "finished" && summary && summary.admitted > 0 ? (
                        <span className="adm-figure text-[0.6875rem] text-[var(--adm-good)]">
                          {summary.admitted} ušlo
                        </span>
                      ) : null}
                      <Badge kind="event" value={eventStatusBadge(event, now)} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── the machine underneath ────────────────────────────────────── */}
      <Panel
        title="Sistem"
        action={
          <form action={sweepHolds}>
            <button type="submit" className="adm-btn adm-btn--ghost adm-btn--sm">
              Očisti istekle
            </button>
          </form>
        }
      >
        {/* STATES, NOT PRODUCT NAMES. The person reading this runs a nightclub.
            What they need to know is whether guests are getting their e-mail
            and whether the night's data is on the real server — not which
            vendor carries the post. Whoever deploys this needs the opposite,
            and gets it: the store, the provider and the variable that is
            missing all go to the server log and to .env.example. */}
        <dl className="grid gap-x-8 gap-y-3 px-[1.125rem] py-4 text-[0.8125rem] sm:grid-cols-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--adm-ink-3)]">Podaci</dt>
            <dd className="text-[var(--adm-ink-2)]">
              {kind === "postgres" ? "Na serveru" : "Lokalno, na ovom računaru"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--adm-ink-3)]">Pošta gostima</dt>
            <dd className="text-[var(--adm-ink-2)]">
              {providerName() === "log" ? "Nije uključena" : "Uključena"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--adm-ink-3)]">Slike za postere</dt>
            <dd className="text-[var(--adm-ink-2)]">
              {media.ready ? "Može se postavljati" : "Trenutno nije dostupno"}
            </dd>
          </div>
        </dl>
        <p className="border-t border-[var(--adm-line-soft)] px-[1.125rem] py-3 text-[0.75rem] leading-relaxed text-[var(--adm-ink-4)]">
          Istekle rezervacije se same oslobađaju u trenutku isteka — dugme iznad
          samo prepisuje njihov status radi urednosti liste.
        </p>
      </Panel>
    </>
  );
}
