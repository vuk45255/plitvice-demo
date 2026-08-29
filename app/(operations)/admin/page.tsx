import Link from "next/link";
import type { Metadata } from "next";
import { Empty, Panel, PageHeader, Stat } from "@/components/admin/shell";
import { Badge, stateLabel } from "@/components/admin/badge";
import { sweepHolds } from "@/app/(operations)/admin/actions";
import { floorState, reservationCounts } from "@/lib/reservations/admin";
import { databaseKind } from "@/lib/db/client";
import { failedDeliveries } from "@/lib/mail/send";
import { providerName } from "@/lib/mail/provider";
import { mediaReadiness } from "@/lib/media/provider";
import { allTicketingEvents, saleState } from "@/lib/ticketing/events";
import { hasEnded } from "@/lib/ticketing/event-rules";
import { countsFor, listOrders, recentScans } from "@/lib/ticketing/store";
import { eventDate, eventTime, price, scanMoment } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* THE NIGHT AT A GLANCE — the first screen anybody in the office opens.
 *
 * ONE NIGHT, IN FULL, AT THE TOP. The club runs one night at a time and the
 * question at eleven o'clock is always about that one: how many are sold, how
 * many are inside, how many tables are still free, is anything waiting to be
 * confirmed. Every other night is one line underneath.
 *
 * THE ORDER OF THE CARDS IS THE ORDER OF THE QUESTIONS. Sold, in, remaining —
 * then the floor. Somebody reading this on a phone while walking to the door
 * should get their answer from the first row without scrolling.
 *
 * EVERY NUMBER ON THIS PAGE IS COUNTED, NEVER STORED. `countsFor` and
 * `floorState` are queries that count rows; there is no `tickets_sold` column
 * anywhere in this system, because the first time a stored counter disagrees
 * with the tickets that exist, the club either turns away somebody who paid or
 * lets in more people than the room holds. See lib/ticketing/store.ts.
 *
 * AND NOTHING IS INVENTED. There is no takings figure on this screen: what an
 * order was worth is on the order, but a night's revenue depends on refunds and
 * on prices that changed, and a number that is nearly right about money is
 * worse than no number at all.
 *
 * Nothing here polls. It is a screen somebody refreshes when they want to
 * know; a dashboard that reloads itself every second is a dashboard nobody can
 * read a figure off. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Uprava",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminHome() {
  await requireStaff("admin");

  const events = await allTicketingEvents();
  const kind = await databaseKind();
  const media = mediaReadiness();

  /* Tonight, or the next one: the soonest night that has not finished.
   *
   * THIS USED TO KEEP ITS OWN CLOCK — `startsAt > now - 12h`, a grace period
   * written here and nowhere else — and that is precisely the shape of bug the
   * lifecycle rule exists to remove. A Saturday night is still "tonight" at
   * four on Sunday morning, which is exactly when somebody is looking at this
   * screen; but with a rule of its own, this screen led with a night that
   * /admin/dogadjaji had already filed under ZAVRŠENI, whose sale badge read
   * closed and whose tables both gates were refusing.
   *
   * `hasEnded` says the night runs until five, which is the same answer this
   * grace period was reaching for and the same answer every other surface now
   * gives. If everything is past, the most recent one stands. */
  const now = new Date();
  const ahead = [...events]
    .filter((event) => event.status !== "ended" && !hasEnded(event, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const current = ahead[0] ?? [...events].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];

  if (!current) {
    return (
      <>
        <PageHeader eyebrow={greeting(now)} title="Plitvice kontrolni centar" />
        <Panel>
          <Empty
            action={
              <Link href="/admin/dogadjaji" className="adm-btn adm-btn--primary">
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

  /* Whether this night takes tables — off its own row, which is where the
     office sets it. The floor is still keyed by SLUG and the tickets by id;
     that is one night filed under two names and is explained at the top of
     lib/ticketing/events.ts. What has gone is the second opinion: this used to
     look the night up on the poster wall as well, and the two could disagree. */
  const tablesEnabled = current.tablesEnabled;

  const [counts, tables, floor, scans, pending, failed] = await Promise.all([
    countsFor(current.id),
    reservationCounts(current.slug),
    tablesEnabled ? floorState(current.slug) : null,
    recentScans(current.id, 6),
    listOrders({ eventId: current.id, status: "pending", limit: 50 }),
    failedDeliveries(5),
  ]);

  const state = saleState(current, counts.taken);
  /* Pending orders whose ten minutes are still running — the ones actually
     holding admissions right now. The rest are lapsed and hold nothing. */
  const live = pending.filter((order) => new Date(order.holdExpiresAt) > now);
  const others = events.filter((event) => event.id !== current.id);

  return (
    <>
      <PageHeader eyebrow={greeting(now)} title="Plitvice kontrolni centar" />

      {/* ── the night ─────────────────────────────────────────────────── */}
      <section className="adm-panel mb-6 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="adm-eyebrow">
              {eventDate(current.startsAt)} · {eventTime(current.doorsAt ?? current.startsAt)}
            </p>
            <h2 className="adm-display mt-2 text-[clamp(1.5rem,5vw,2.125rem)] text-[var(--adm-ink)]">
              {current.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge kind="event" value={current.status} />
              <Badge kind="sale" value={state.open ? "open" : state.reason} />
              {current.ticketPrice > 0 ? (
                <span className="text-[0.75rem] text-[var(--adm-ink-3)]">
                  {price(current.ticketPrice)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/dogadjaji/${current.id}`}
              className="adm-btn adm-btn--sm"
            >
              Uredi veče
            </Link>
            {tablesEnabled ? (
              <Link
                href={`/admin/plan?event=${encodeURIComponent(current.slug)}`}
                className="adm-btn adm-btn--sm adm-btn--primary"
              >
                Plan stolova
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── the tickets ───────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Karte prodate"
          value={counts.paid}
          of={counts.capacity}
          tone="gold"
        />
        <Stat
          label="Skenirano"
          value={counts.entered}
          tone="good"
          note={counts.outstanding > 0 ? `${counts.outstanding} još nije ušlo` : "svi ušli"}
        />
        <Stat
          label="Slobodno karata"
          value={counts.available}
          tone={counts.available === 0 ? "warn" : "plain"}
          note={counts.available === 0 ? "rasprodato" : undefined}
        />
        <Stat
          label="U toku plaćanja"
          value={live.length}
          note={counts.held > 0 ? `${counts.held} karata zadržano` : undefined}
        />
        <Stat label="Porudžbine" value={counts.orders} />
      </div>

      {/* ── the floor ─────────────────────────────────────────────────── */}
      {tablesEnabled && floor ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Rezervacije" value={tables.confirmed + tables.pending} />
          <Stat label="Zauzeti stolovi" value={floor.counts.reserved} tone="good" />
          <Stat label="Slobodni stolovi" value={floor.counts.available} />
          {/* A booking made on the site is confirmed the moment it is made, so
              "na čekanju" is now a count of OLD rows and normally zero. It is
              shown only when there is something in it — otherwise the tile says
              what is actually happening on the floor this minute, which is how
              many guests are mid-booking. */}
          {tables.pending > 0 ? (
            <Stat
              label="Na čekanju"
              value={tables.pending}
              tone="warn"
              note="starije rezervacije — potvrdite ili otkažite"
            />
          ) : (
            <Stat
              label="U toku na sajtu"
              value={floor.counts.held}
              note={floor.counts.held > 0 ? "gost bira sto" : undefined}
            />
          )}
        </div>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── the door ────────────────────────────────────────────────── */}
        <Panel
          title="Ulaz — poslednja skeniranja"
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
        <Panel
          title="Ostali događaji"
          action={
            <Link href="/admin/dogadjaji" className="adm-btn adm-btn--ghost adm-btn--sm">
              Svi
            </Link>
          }
        >
          {others.length === 0 ? (
            <Empty>Nema drugih događaja.</Empty>
          ) : (
            <ul>
              {others.slice(0, 6).map((event) => (
                <li
                  key={event.id}
                  className="adm-row flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                >
                  <Link
                    href={`/admin/dogadjaji/${event.id}`}
                    className="text-[0.875rem] text-[var(--adm-ink)] transition-colors hover:text-[var(--adm-gold)]"
                  >
                    {event.title}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="text-[0.6875rem] text-[var(--adm-ink-4)]">
                      {eventDate(event.startsAt)}
                    </span>
                    <Badge kind="event" value={event.status} />
                  </span>
                </li>
              ))}
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
        {/* ═══ STATES, NOT PRODUCT NAMES ══════════════════════════════════
         *
         * The person reading this runs a nightclub. What they need to know is
         * whether guests are getting their e-mail and whether the night's data
         * is on the real server — not which vendor carries the post or which
         * engine holds the rows. Naming either one tells them nothing they can
         * act on and invites them to worry about something that is not theirs.
         *
         * Whoever deploys this needs the opposite, and gets it: the store, the
         * provider and the variable that is missing all go to the server log
         * and to .env.example. */}
        <dl className="grid gap-x-8 gap-y-3 px-[1.125rem] py-4 text-[0.8125rem] sm:grid-cols-2">
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

/* "Dobro veče" is right for nine nights in ten; the club's own day starts in
   the afternoon and ends when the sun is up, and being greeted with "good
   evening" at eight in the morning after a shift reads as a machine that is
   not paying attention. Belgrade's hour, not the server's. */
function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Belgrade",
    }).format(now),
  );
  if (hour >= 17 || hour < 4) return "Dobro veče";
  if (hour < 11) return "Dobro jutro";
  return "Dobar dan";
}

