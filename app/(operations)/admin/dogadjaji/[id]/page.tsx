import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventEditor } from "@/components/admin/event-editor";
import { EventActions } from "@/components/admin/event-actions";
import { Badge } from "@/components/admin/badge";
import { Empty, Notice, PageHeader, Panel, Scroller, Stat } from "@/components/admin/shell";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { countsFor, listOrders, recentScans } from "@/lib/ticketing/store";
import { actionsFor, toCard } from "@/lib/club/event-manager";
import { mediaReadiness } from "@/lib/media/provider";
import { eventDate, eventTime, price, scanMoment } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* ONE NIGHT, IN FULL: the numbers, the editor, and the last people through the
 * door. Everything an admin does to a night happens on this page, so there is
 * one place to look when something is wrong with one.
 *
 * THE EDITOR IS THE SAME COMPONENT the create screen uses. The only difference
 * is that this one hands it an event — which is what turns SAČUVAJ DRAFT into
 * SAČUVAJ IZMENE, reveals the slug, and gives the capacity field its floor.
 *
 * The operational panels underneath were here before the event manager and are
 * untouched: recent orders and recent scans, both read-only. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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

  const [counts, orders, scans] = await Promise.all([
    countsFor(event.id),
    listOrders({ eventId: event.id, limit: 12 }),
    recentScans(event.id, 15),
  ]);

  const card = toCard(event, counts);
  const { primary, more } = actionsFor(card);
  const media = mediaReadiness();

  /* Set by the two actions that land somebody here rather than leaving them
     where they were. Saying which is which matters: a duplicate looks exactly
     like the night it was copied from, and somebody who does not notice they
     are on the copy will edit the wrong one. */
  const justCreated = query.novo === "1";
  const justCopied = query.kopija === "1";

  return (
    <>
      <PageHeader
        eyebrow={`${eventDate(event.startsAt)} · ${eventTime(event.doorsAt ?? event.startsAt)}`}
        title={event.title}
        action={
          <>
            <Link href="/admin/dogadjaji" className="adm-btn adm-btn--sm">
              Svi događaji
            </Link>
            <Link
              href={`/admin/karte?event=${encodeURIComponent(event.id)}`}
              className="adm-btn adm-btn--sm"
            >
              Karte ovog večera
            </Link>
          </>
        }
      />

      {justCopied ? (
        <div className="mb-6">
          <Notice>
            Ovo je kopija. Prenete su samo postavke — cena, kapacitet, plan sale i
            detalji. Nema nijedne porudžbine, ulaznice ni rezervacije, i veče je
            sačuvano kao draft. Promenite naziv i datum, pa objavite.
          </Notice>
        </div>
      ) : null}

      {justCreated ? (
        <div className="mb-6">
          <Notice>
            Veče je napravljeno. Dodajte poster i objavite ga kada bude spremno.
          </Notice>
        </div>
      ) : null}

      {event.archivedAt ? (
        <div className="mb-6">
          <Notice>
            Ovo veče je arhivirano. Sve porudžbine, ulaznice i rezervacije su
            sačuvane — vratite ga iz arhive da biste ga ponovo koristili.
          </Notice>
        </div>
      ) : null}

      {/* ── where it stands, and what can be done to it ──────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge kind="event" value={event.status} />
          {event.ticketingEnabled ? (
            <Badge kind="sale" value={card.sale.open ? "open" : card.sale.reason} />
          ) : (
            <span className="text-[0.6875rem] text-[var(--adm-ink-4)]">
              Bez online prodaje
            </span>
          )}
          <span className="font-mono text-[0.6875rem] text-[var(--adm-ink-4)]">
            {event.slug}
          </span>
        </div>

        <EventActions
          id={event.id}
          slug={event.slug}
          /* UREDI is not offered on the page that IS the editor. */
          primary={primary.filter((action) => action !== "edit")}
          more={more}
        />
      </div>

      {/* The ticket figures belong to a night that sells tickets. A free-door
          night would show six zeros, which is six pieces of furniture. */}
      {event.ticketingEnabled ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Kapacitet" value={counts.capacity} />
          <Stat label="Prodato" value={counts.paid} tone="gold" />
          <Stat label="U toku" value={counts.held} />
          <Stat
            label="Slobodno"
            value={counts.available}
            tone={counts.available === 0 ? "warn" : "plain"}
          />
          <Stat label="Ušlo" value={counts.entered} tone="good" />
          <Stat label="Nije ušlo" value={counts.outstanding} />
        </div>
      ) : null}

      <Panel title="Podešavanja">
        <EventEditor
          event={event}
          taken={counts.taken}
          posterDisabledReason={media.ready ? undefined : media.reason}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Poslednje porudžbine"
          action={
            <Link
              href={`/admin/karte?event=${encodeURIComponent(event.id)}`}
              className="adm-btn adm-btn--ghost adm-btn--sm"
            >
              Sve
            </Link>
          }
        >
          {orders.length === 0 ? (
            <Empty>Još nijedna porudžbina.</Empty>
          ) : (
            <Scroller>
              <table className="adm-table min-w-[30rem]">
                <thead>
                  <tr>
                    <th>Broj</th>
                    <th>Kupac</th>
                    <th className="text-right">Kom.</th>
                    <th className="text-right">Iznos</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-mono text-[0.6875rem] text-[var(--adm-ink-3)]">
                        {order.reference.slice(0, 12)}…
                      </td>
                      <td className="text-[var(--adm-ink)]">{order.customerName}</td>
                      <td className="adm-figure text-right">{order.quantity}</td>
                      <td className="adm-figure text-right">{price(order.totalAmount)}</td>
                      <td>
                        <Badge kind="payment" value={order.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          )}
        </Panel>

        <Panel title="Ulaz — poslednja skeniranja">
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
      </div>
    </>
  );
}
