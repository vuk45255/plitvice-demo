import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { EventEditor } from "@/components/admin/event-editor";
import { EventActions } from "@/components/admin/event-actions";
import { Badge } from "@/components/admin/badge";
import { Tabs, type TabItem } from "@/components/admin/tabs";
import {
  DataRow,
  Empty,
  Line,
  Notice,
  PageHeader,
  Panel,
  Scroller,
  Stat,
  StatGrid,
} from "@/components/admin/shell";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { countsFor, recentScans } from "@/lib/ticketing/store";
import { eventReport, saleLines } from "@/lib/club/event-report";
import { reservationsForEvent } from "@/lib/reservations/admin";
import {
  actionsFor,
  eventStatusBadge,
  isOperational,
  posterUrl,
  toCard,
} from "@/lib/club/event-manager";
import { mediaReadiness } from "@/lib/media/provider";
import { eventDate, eventTime, price, scanMoment } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* ONE NIGHT, IN FULL — and after it, the report on what happened.
 *
 * ═══ WHAT THIS SCREEN IS FOR, WHICH CHANGED ═══════════════════════════════
 *
 * It used to be an editor with two read-only panels bolted underneath. That is
 * the right screen for a night that has not happened yet and the wrong one for
 * every night afterwards — and a club spends one evening putting a night ON and
 * the whole rest of its life looking back at nights it has run. The most
 * valuable moment of an event's life in an operations system is the Sunday
 * afternoon after it, and this screen used to have almost nothing to say then.
 *
 * So it is four views of the same night, and the editor is the fifth:
 *
 *   PREGLED       what the night is, and the handful of figures that answer
 *                 "how did it go" without scrolling.
 *   PRODAJA       what was actually sold, and to whom.
 *   REZERVACIJE   what was actually booked, and by whom.
 *   ULAZ          who actually came through the door.
 *   PODEŠAVANJA   the editor, unchanged.
 *
 * ═══ NOTHING IS HIDDEN BECAUSE THE NIGHT IS OVER ══════════════════════════
 *
 * A finished night keeps every tab and every figure. The orders, the tickets,
 * the scans, the reservations, the configured price and the poster are all
 * still there and all still read — the only thing a finished night loses is
 * the offer of moves that no longer make sense, which `actionsFor` decides.
 *
 * ═══ AND A POSTER IS NOT A NIGHT THIS SYSTEM RAN ══════════════════════════
 *
 * The legacy archive nights predate the software. They have no orders, no
 * tickets, no scans and no reservations — so this screen does not draw a report
 * full of zeros for them, because every one of those zeros would read as a
 * measurement of a quiet night rather than as the absence of any measurement at
 * all. It says what the night is and where its record actually lives.
 *
 * ═══ EACH TAB FETCHES ITS OWN DATA ════════════════════════════════════════
 *
 * The tab is a query string on a server-rendered page, so the reservations tab
 * never queries the scan log and the report of a finished night never loads the
 * editor. See components/admin/tabs.tsx. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

const TAB_IDS = ["pregled", "prodaja", "rezervacije", "ulaz", "podesavanja"] as const;
type TabId = (typeof TAB_IDS)[number];

function tabFrom(value: string | string[] | undefined): TabId {
  const raw = Array.isArray(value) ? value[0] : value;
  return TAB_IDS.includes(raw as TabId) ? (raw as TabId) : "pregled";
}

export default async function AdminEventPage({
  params,
  searchParams,
}: PageProps<"/admin/dogadjaji/[id]">) {
  await requireStaff("admin");
  const { id } = await params;
  const query = await searchParams;

  /* Dev mode is irrelevant here: this screen is signed in and is supposed to
     see the test nights. */
  const event = await findTicketingEvent(id, true);
  if (!event) notFound();

  const tab = tabFrom(query.tab);
  const operational = isOperational(event);
  const poster = posterUrl(event);

  /* Set by the two actions that land somebody here rather than leaving them
     where they were. Saying which is which matters: a duplicate looks exactly
     like the night it was copied from, and somebody who does not notice they
     are on the copy will edit the wrong one. */
  const justCreated = query.novo === "1";
  const justCopied = query.kopija === "1";

  const counts = await countsFor(event.id);
  const card = toCard(event, counts);
  const { primary, more } = actionsFor(card);

  const header = (
    <>
      <PageHeader
        title={event.title}
        meta={
          <>
            <span className="adm-figure">
              {eventDate(event.startsAt)} · {eventTime(event.startsAt)}
            </span>
            <Badge kind="event" value={eventStatusBadge(event)} />
            {operational && event.ticketingEnabled ? (
              <Badge kind="sale" value={card.sale.open ? "open" : card.sale.reason} />
            ) : null}
            <span className="font-mono text-[0.6875rem] text-[var(--adm-ink-4)]">
              {event.slug}
            </span>
          </>
        }
        action={
          <>
            <Link href="/admin/dogadjaji" className="adm-btn adm-btn--sm">
              Svi događaji
            </Link>
            <EventActions
              id={event.id}
              slug={event.slug}
              primary={primary.filter((action) => action !== "edit")}
              more={more}
            />
          </>
        }
      />

      {justCopied ? (
        <div className="mb-5">
          <Notice>
            Ovo je kopija. Prenete su samo postavke — cena, kapacitet, plan sale i
            detalji. Nema nijedne porudžbine, ulaznice ni rezervacije, i veče je
            sačuvano kao draft. Promenite naziv i datum, pa objavite.
          </Notice>
        </div>
      ) : null}

      {justCreated ? (
        <div className="mb-5">
          <Notice>
            Veče je napravljeno. Dodajte poster i objavite ga kada bude spremno.
          </Notice>
        </div>
      ) : null}

      {event.archivedAt ? (
        <div className="mb-5">
          <Notice>
            Ovo veče je arhivirano. Sve porudžbine, ulaznice i rezervacije su
            sačuvane — vratite ga iz arhive da biste ga ponovo koristili.
          </Notice>
        </div>
      ) : null}
    </>
  );

  /* ── a poster from before the software ────────────────────────────────── */

  /* No tabs, no figures, no empty report. The night is real and its record is
     the artwork; saying so plainly is the whole screen. */
  if (!operational) {
    return (
      <>
        {header}
        <Panel title="Arhivska žurka">
          <div className="grid gap-6 px-[1.125rem] py-5 sm:grid-cols-[12rem_1fr]">
            <div className="adm-event-poster">
              {poster ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={poster} alt={`Poster — ${event.title}`} />
              ) : (
                <span className="adm-event-poster-empty">Nema postera</span>
              )}
            </div>
            <div>
              <p className="text-[0.875rem] leading-relaxed text-[var(--adm-ink-2)]">
                Ova žurka je održana pre nego što je klub počeo da koristi ovaj
                sistem. Postoji kao poster u javnoj arhivi i to je sve što o njoj
                znamo.
              </p>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--adm-ink-4)]">
                Zato ovde nema izveštaja. Nije bilo nijedne porudžbine, ulaznice,
                skeniranja ni rezervacije kroz sistem — pa bi svaka nula na ovom
                mestu značila „nije mereno“, a izgledala bi kao „ništa nije
                prodato“. Podaci ne postoje i nećemo ih izmišljati.
              </p>
              <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Line label="Naziv" value={event.title} />
                <Line label="Datum" value={eventDate(event.startsAt)} />
              </dl>
              <p className="mt-6">
                <a
                  href="/zurke"
                  target="_blank"
                  rel="noreferrer"
                  className="adm-btn adm-btn--sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Javna arhiva
                </a>
              </p>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  /* ── an operational night ─────────────────────────────────────────────── */

  const report = await eventReport(event);
  const { sales, access, reservations } = report;

  /* ═══ A BADGE COUNTS WHAT ITS TAB OPENS ON ════════════════════════════
   *
   * These used to be the figures that read best in isolation — paid orders,
   * tables taken — and both lied about the tab behind them. PRODAJA lists
   * every order whatever its status, so a badge of 4 opened a table of nine
   * rows; REZERVACIJE lists cancelled and rejected bookings too. A count on a
   * tab is a promise about what is inside it.
   *
   * So each is the total the tab itself leads with: the order count in the
   * PRODAJA panel header, the reservation count in the REZERVACIJE table, and
   * — for ULAZ, whose list is the scan log and whose subject is not the log —
   * the admissions figure that is the first thing on that tab. */
  const tabs: TabItem<TabId>[] = [
    { id: "pregled", label: "Pregled" },
    { id: "prodaja", label: "Prodaja", count: sales.orders.total },
    { id: "rezervacije", label: "Rezervacije", count: reservations.total },
    { id: "ulaz", label: "Ulaz", count: access.admitted },
    { id: "podesavanja", label: "Podešavanja" },
  ];

  const address = (next: TabId) =>
    next === "pregled"
      ? `/admin/dogadjaji/${event.id}`
      : `/admin/dogadjaji/${event.id}?tab=${next}`;

  return (
    <>
      {header}
      <Tabs tabs={tabs} active={tab} href={address} />

      {tab === "pregled" ? (
        <Overview event={event} poster={poster} report={report} />
      ) : null}
      {tab === "prodaja" ? <SalesTab event={event} report={report} /> : null}
      {tab === "rezervacije" ? <ReservationsTab event={event} report={report} /> : null}
      {tab === "ulaz" ? <AccessTab event={event} report={report} /> : null}
      {tab === "podesavanja" ? <Settings event={event} taken={counts.taken} /> : null}
    </>
  );
}

/* ── PODEŠAVANJA ────────────────────────────────────────────────────────── */

/* The editor, unchanged — the same component the create screen uses. Wrapped
   here only so the readiness of the poster store is read once. */
function Settings({
  event,
  taken,
}: {
  event: Awaited<ReturnType<typeof findTicketingEvent>> & object;
  taken: number;
}) {
  const media = mediaReadiness();
  return (
    <Panel title="Podešavanja">
      <EventEditor
        event={event}
        taken={taken}
        posterDisabledReason={media.ready ? undefined : media.reason}
      />
    </Panel>
  );
}

/* ── PREGLED ────────────────────────────────────────────────────────────── */

/* THE FIVE-SECOND ANSWER, THEN THE NIGHT ITSELF.
 *
 * The figures come first because on the Sunday afternoon that is what the
 * screen was opened for. What the night IS — poster, DJ, age, promotion — is
 * underneath, where somebody checking a detail will still find it. */
function Overview({
  event,
  poster,
  report,
}: {
  event: Awaited<ReturnType<typeof findTicketingEvent>> & object;
  poster?: string;
  report: Awaited<ReturnType<typeof eventReport>>;
}) {
  const { sales, access, reservations } = report;

  /* ═══ HOW MANY OF THE TICKETS THAT EXIST CAME THROUGH THE DOOR ══════════
   *
   * Out of tickets ISSUED, never out of capacity and — this is the fix — never
   * out of the paid quantity. A night that sold sixty of five hundred and
   * scanned all sixty had a full turnout of a small sale, so capacity is the
   * wrong denominator and "12%" would say the opposite.
   *
   * But `ticketsPaid` is the wrong one too, and it fails in a way that looks
   * like a bug: a ticket that was scanned and then refunded STAYS USED — the
   * door happened and a refund afterwards does not rewrite it, which
   * lib/ticketing/lifecycle.test.ts asserts deliberately — while the refunded
   * order leaves `payment_status = 'paid'`. Ten admissions all scanned, then a
   * two-ticket refund on the Sunday, and the card would read 125%.
   *
   * `issued` is used + valid: it keeps a used-then-refunded ticket and drops a
   * refunded one nobody came in on, which is exactly the set the percentage is
   * about. It equals the sold count on every ordinary night. */
  const turnout =
    access.issued > 0
      ? Math.round((access.admitted / access.issued) * 100)
      : undefined;

  return (
    <>
      {sales.ticketingEnabled ? (
        <StatGrid cols={6}>
          <Stat
            label="Karte prodate"
            value={sales.ticketsPaid}
            of={sales.capacity}
            tone="gold"
          />
          <Stat
            label="Prihod od online karata"
            value={price(sales.paidOnlineRevenue)}
            note="samo naplaćene porudžbine"
          />
          <Stat
            label="Prosečna cena karte"
            value={
              sales.averagePaidPrice !== undefined
                ? price(sales.averagePaidPrice)
                : "—"
            }
            note={
              sales.averagePaidPrice === undefined ? "nema prodatih karata" : undefined
            }
          />
          <Stat label="Skenirano" value={access.admitted} tone="good" />
          <Stat
            label="Iskorišćenost karata"
            value={turnout !== undefined ? `${turnout}%` : "—"}
            note={
              turnout !== undefined
                ? `${access.admitted} / ${access.issued} izdatih`
                : "nema izdatih karata"
            }
          />
          <Stat label="Porudžbine" value={sales.orders.paid} note="naplaćene" />
        </StatGrid>
      ) : (
        /* ═══ A FREE DOOR IS NOT A NIGHT THAT MADE NOTHING ═══════════════
         *
         * Printing 0 RSD here would be true and would read as a disaster.
         * The night did not sell online; what it took at the door is not
         * something this system has ever seen. So it says which of those two
         * it is, and then shows the operational figures the night DOES have. */
        <Panel title="Online prodaja">
          <div className="px-[1.125rem] py-5">
            <p className="text-[0.9375rem] text-[var(--adm-ink)]">Nije korišćena</p>
            <p className="mt-2 max-w-[62ch] text-[0.8125rem] leading-relaxed text-[var(--adm-ink-3)]">
              Ulaznice za ovo veče se ne prodaju preko sajta, pa sistem nema
              podatke o prodaji ni o prihodu. Naplata na vratima i promet bara ne
              prolaze kroz ovaj sistem i ne mogu se ovde prikazati.
            </p>
          </div>
        </Panel>
      )}

      {event.tablesEnabled || reservations.total > 0 ? (
        <StatGrid cols={4}>
          <Stat label="Rezervacije" value={reservations.total} />
          <Stat label="Zauzeti stolovi" value={reservations.tablesTaken} tone="good" />
          <Stat label="Potvrđene" value={reservations.confirmed} />
          <Stat
            label="Gostiju po rezervacijama"
            value={reservations.guestsBooked}
            note="prijavljeno pri rezervaciji"
          />
        </StatGrid>
      ) : null}

      {sales.oversold > 0 ? (
        <div className="mb-5">
          <Notice>
            {sales.oversold} porudžbin{sales.oversold === 1 ? "a je" : "e su"} plaćen
            {sales.oversold === 1 ? "a" : "e"} nakon što je rezervacija mesta istekla i
            sala se u međuvremenu popunila. Novac je primljen — proverite kapacitet na
            vratima.
          </Notice>
        </div>
      ) : null}

      <Panel
        title="Veče"
        action={
          <Link
            href={`/admin/dogadjaji/${event.id}/pregled`}
            className="adm-btn adm-btn--ghost adm-btn--sm"
          >
            Šta gost vidi
          </Link>
        }
      >
        <div className="grid gap-6 px-[1.125rem] py-5 sm:grid-cols-[12rem_1fr]">
          <div className="adm-event-poster">
            {poster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={poster} alt={`Poster — ${event.title}`} />
            ) : (
              <span className="adm-event-poster-empty">Nema postera</span>
            )}
          </div>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Line label="Datum" value={eventDate(event.startsAt)} />
            <Line label="Početak" value={eventTime(event.startsAt)} />
            <Line label="DJ / izvođač" value={event.lineup} />
            <Line label="Uzrast" value={event.ageRestriction} />
            <Line label="Dress code" value={event.dressCode} />
            <Line label="Promocija" value={event.promotion} />
            <Line label="Napomena o ulazu" value={event.entryNote} />
            <Line label="Opis" value={event.description} wide />
          </dl>
        </div>
      </Panel>
    </>
  );
}

/* ── PRODAJA ────────────────────────────────────────────────────────────── */

async function SalesTab({
  event,
  report,
}: {
  event: Awaited<ReturnType<typeof findTicketingEvent>> & object;
  report: Awaited<ReturnType<typeof eventReport>>;
}) {
  const { sales } = report;

  if (!sales.ticketingEnabled) {
    return (
      <Panel title="Online prodaja">
        <Empty>
          Ovo veče ne prodaje ulaznice preko sajta, pa nema porudžbina ni prihoda
          koje bismo prikazali. Naplata na vratima ne prolazi kroz sistem.
        </Empty>
      </Panel>
    );
  }

  /* THE LIST IS CAPPED AND THE HEADER IS NOT. `saleLines` takes the most
     recent 200, which is a sensible page and a dishonest total — a night with
     350 orders would quietly drop 150 of them AND report "200" as the count.
     The header prints what the database actually counted, and when the two
     disagree the panel says so rather than leaving somebody to discover it. */
  const SHOWN = 200;
  const lines = await saleLines(event.id, SHOWN);
  const truncated = sales.orders.total > lines.length;

  return (
    <>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Ponuda" className="mb-0">
          {/* ONE PRICE, SAID ONCE. The system sells one thing — entry, at one
              price, capped by the room — and this says exactly that rather than
              drawing a tier table with a single row in it and implying there
              could be more. See `eventTiers` in lib/club/event-manager.ts. */}
          <DataRow label="Cena ulaznice" value={price(sales.ticketPrice)} tone="gold" />
          <DataRow label="Kapacitet sale" value={sales.capacity} />
          <DataRow label="Prodato" value={sales.ticketsPaid} tone="good" />
          <DataRow
            label="U toku plaćanja"
            value={sales.ticketsHeld}
            note={sales.ticketsHeld > 0 ? "mesta su privremeno zadržana" : undefined}
          />
          <DataRow
            label="Slobodno"
            value={sales.available}
            tone={sales.available === 0 ? "warn" : "plain"}
          />
        </Panel>

        <Panel title="Porudžbine i naplata" className="mb-0">
          <DataRow label="Naplaćene porudžbine" value={sales.orders.paid} tone="good" />
          <DataRow label="U toku plaćanja" value={sales.orders.pending} />
          <DataRow
            label="Istekle"
            value={sales.orders.expired}
            note="gost nije završio plaćanje na vreme"
          />
          <DataRow label="Neuspele" value={sales.orders.failed} />
          <DataRow
            label="Refundirane"
            value={sales.orders.refunded}
            tone={sales.orders.refunded > 0 ? "warn" : "muted"}
          />
          {/* ═══ THE ONE MONEY FIGURE, AND WHAT IT IS NOT ════════════════
              It is the sum of what paid orders were actually charged. It is
              NOT the night's takings: the door and the bar do not pass through
              this system and it has no till. The label says online and the
              note says it again, because a number about money that is read as
              a bigger number than it is, is worse than no number at all. */}
          <DataRow
            label="Prihod od online karata"
            value={price(sales.paidOnlineRevenue)}
            note="samo naplaćene porudžbine — bez naplate na vratima i bez bara"
            tone="gold"
          />
          {sales.refundedAmount > 0 ? (
            <DataRow
              label="Refundirano"
              value={price(sales.refundedAmount)}
              tone="warn"
            />
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Porudžbine"
        action={
          <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
            {truncated ? `${lines.length} od ${sales.orders.total}` : sales.orders.total}
          </span>
        }
      >
        {truncated ? (
          <p className="border-b border-[var(--adm-line-soft)] px-[1.125rem] py-2.5 text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
            Prikazano je poslednjih {lines.length} porudžbina. Sve su na strani{" "}
            <Link
              href={`/admin/karte?event=${encodeURIComponent(event.id)}`}
              className="text-[var(--adm-gold)]"
            >
              Karte
            </Link>
            .
          </p>
        ) : null}
        {lines.length === 0 ? (
          <Empty>Još nijedna porudžbina za ovo veče.</Empty>
        ) : (
          <Scroller>
            <table className="adm-table adm-table--cards md:min-w-[46rem]">
              <thead>
                <tr>
                  <th>Kupac</th>
                  <th>Vreme</th>
                  <th>Referenca</th>
                  <th className="text-right">Kom.</th>
                  <th className="text-right">Cena</th>
                  <th className="text-right">Ukupno</th>
                  <th>Status</th>
                  <th>Kanal</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td data-label="Kupac" className="text-[var(--adm-ink)]">
                      {line.customerName}
                    </td>
                    <td data-label="Vreme" className="adm-figure whitespace-nowrap">
                      {scanMoment(line.paidAt ?? line.createdAt)}
                    </td>
                    <td
                      data-label="Referenca"
                      className="font-mono text-[0.6875rem] text-[var(--adm-ink-3)]"
                    >
                      {line.reference}
                    </td>
                    <td data-label="Kom." className="adm-figure md:text-right">
                      {line.quantity}
                    </td>
                    <td data-label="Cena" className="adm-figure md:text-right">
                      {price(line.unitAmount)}
                    </td>
                    <td data-label="Ukupno" className="adm-figure md:text-right">
                      {price(line.totalAmount)}
                    </td>
                    <td data-label="Status">
                      <Badge kind="payment" value={line.paymentStatus} />
                    </td>
                    <td
                      data-label="Kanal"
                      className="text-[0.6875rem] text-[var(--adm-ink-4)]"
                    >
                      {/* The provider once there is one; until PaySpot is
                          connected an order carries only the channel it came
                          in on, and inventing a payment method here would be
                          inventing a fact. */}
                      {line.paymentProvider ?? line.channel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Panel>
    </>
  );
}

/* ── REZERVACIJE ────────────────────────────────────────────────────────── */

async function ReservationsTab({
  event,
  report,
}: {
  event: Awaited<ReturnType<typeof findTicketingEvent>> & object;
  report: Awaited<ReturnType<typeof eventReport>>;
}) {
  const { reservations } = report;

  if (!event.tablesEnabled && reservations.total === 0) {
    return (
      <Panel title="Rezervacije stolova">
        <Empty>
          Ovo veče ne prima rezervacije stolova, pa ih ni nema.
        </Empty>
      </Panel>
    );
  }

  /* THE SAME READER THE RESERVATIONS SCREEN AND THE FLOOR PLAN USE. There is
     one reservation system and this is a view of it, not a second one. */
  const rows = await reservationsForEvent(event.slug);

  return (
    <>
      <StatGrid cols={5}>
        <Stat label="Ukupno rezervacija" value={reservations.total} />
        <Stat label="Potvrđene" value={reservations.confirmed} tone="good" />
        <Stat
          label="Na čekanju"
          value={reservations.pending}
          tone={reservations.pending > 0 ? "warn" : "plain"}
        />
        <Stat
          label="Otkazane"
          value={reservations.cancelled + reservations.rejected}
          note={
            reservations.rejected > 0
              ? `${reservations.rejected} odbijeno`
              : undefined
          }
        />
        <Stat label="Zauzeti stolovi" value={reservations.tablesTaken} tone="gold" />
      </StatGrid>

      <Panel
        title="Rezervacije"
        action={
          <Link
            href={`/admin/rezervacije?event=${encodeURIComponent(event.slug)}`}
            className="adm-btn adm-btn--ghost adm-btn--sm"
          >
            Upravljanje
          </Link>
        }
      >
        {rows.length === 0 ? (
          <Empty>Još nijedna rezervacija za ovo veče.</Empty>
        ) : (
          <Scroller>
            <table className="adm-table adm-table--cards md:min-w-[44rem]">
              <thead>
                <tr>
                  <th>Gost</th>
                  <th>Telefon</th>
                  <th>Sto</th>
                  <th className="text-right">Osoba</th>
                  <th>Status</th>
                  <th>Izvor</th>
                  <th>Primljeno</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Gost" className="text-[var(--adm-ink)]">
                      {row.name}
                    </td>
                    <td data-label="Telefon" className="adm-figure whitespace-nowrap">
                      {row.phone}
                    </td>
                    <td data-label="Sto" className="font-mono text-[0.75rem]">
                      {row.number}
                    </td>
                    <td data-label="Osoba" className="adm-figure md:text-right">
                      {row.guests}
                    </td>
                    <td data-label="Status">
                      <Badge kind="reservation" value={row.status} />
                    </td>
                    <td
                      data-label="Izvor"
                      className="text-[0.6875rem] text-[var(--adm-ink-4)]"
                    >
                      {row.source === "phone" ? "Telefon" : "Sajt"}
                    </td>
                    <td data-label="Primljeno" className="adm-figure whitespace-nowrap">
                      {scanMoment(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Panel>
    </>
  );
}

/* ── ULAZ ───────────────────────────────────────────────────────────────── */

async function AccessTab({
  event,
  report,
}: {
  event: Awaited<ReturnType<typeof findTicketingEvent>> & object;
  report: Awaited<ReturnType<typeof eventReport>>;
}) {
  const { access, sales } = report;

  /* `issued` counts live tickets only, so a night whose tickets were all
     revoked would otherwise fall through this guard and report nothing. */
  if (!sales.ticketingEnabled && access.issued === 0 && access.cancelled === 0) {
    return (
      <Panel title="Ulaz">
        <Empty>
          Za ovo veče nije izdata nijedna elektronska ulaznica, pa nema ni
          skeniranja. Ulaz se ne evidentira kroz sistem.
        </Empty>
      </Panel>
    );
  }

  const scans = await recentScans(event.id, 40);

  return (
    <>
      <StatGrid cols={4}>
        {/* ═══ ADMISSIONS, NOT SCANS ══════════════════════════════════════
            Counted from the ticket rows. A guest who holds their phone up
            three times writes three scan rows and two ALREADY USED refusals;
            counting the log would report three people through a door one
            person walked through. See AccessReport in lib/club/event-report.ts. */}
        <Stat
          label="Validni ulazi"
          value={access.admitted}
          tone="good"
          note="jedna karta = najviše jedan ulaz"
        />
        <Stat label="Prodate karte" value={sales.ticketsPaid} />
        <Stat
          label="Neiskorišćene karte"
          value={access.unused}
          note={access.unused > 0 ? "plaćeno, nije ušlo" : "sve karte iskorišćene"}
        />
        <Stat
          label="Odbijena skeniranja"
          value={access.refused}
          tone={access.refused > 0 ? "warn" : "plain"}
          note={`od ukupno ${access.attempts} pokušaja`}
        />
      </StatGrid>

      {/* THE REVOKED TICKETS ARE NOT PART OF THE DOOR'S TIMELINE. They used to
          be nested inside this panel, which only renders when somebody was
          actually scanned in — so a refunded night that nobody attended showed
          its cancelled-ticket count nowhere at all, which is exactly the night
          somebody would go looking for it. Each condition now stands alone. */}
      {access.firstScanAt || access.lastScanAt || access.cancelled > 0 ? (
        <Panel title="Kada su ulazili">
          {access.firstScanAt ? (
            <DataRow label="Prvi ulaz" value={scanMoment(access.firstScanAt)} />
          ) : null}
          {access.lastScanAt ? (
            <DataRow label="Poslednji ulaz" value={scanMoment(access.lastScanAt)} />
          ) : null}
          {access.cancelled > 0 ? (
            <DataRow
              label="Poništene karte"
              value={access.cancelled}
              note="refundirane ili stornirane"
              tone="muted"
            />
          ) : null}
        </Panel>
      ) : null}

      <Panel
        title="Skeniranja"
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
    </>
  );
}
