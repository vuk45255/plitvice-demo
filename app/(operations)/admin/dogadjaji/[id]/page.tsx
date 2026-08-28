import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventForm } from "@/components/admin/event-form";
import { Badge } from "@/components/admin/badge";
import { Empty, PageHeader, Panel, Scroller, Stat } from "@/components/admin/shell";
import { findTicketingEvent, saleState } from "@/lib/ticketing/events";
import { countsFor, listOrders, recentScans } from "@/lib/ticketing/store";
import { eventDate, eventTime, price, scanMoment } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* One night, in full: the numbers, the switches, and the last people through
   the door. Everything an admin does to a night happens on this page, so there
   is one place to look when something is wrong with one. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminEventPage({
  params,
}: PageProps<"/admin/dogadjaji/[id]">) {
  await requireStaff("admin");
  const { id } = await params;

  /* Dev mode is irrelevant here: this screen is signed in and is supposed to
     see the test nights. */
  const event = await findTicketingEvent(id, true);
  if (!event) notFound();

  const [counts, orders, scans] = await Promise.all([
    countsFor(event.id),
    listOrders({ eventId: event.id, limit: 12 }),
    recentScans(event.id, 15),
  ]);

  const state = saleState(event, counts.taken);

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
              className="adm-btn adm-btn--sm adm-btn--primary"
            >
              Karte ovog večera
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge kind="event" value={event.status} />
        <Badge kind="sale" value={state.open ? "open" : state.reason} />
        <span className="font-mono text-[0.6875rem] text-[var(--adm-ink-4)]">
          {event.slug}
        </span>
      </div>

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

      <Panel title="Podešavanja">
        <EventForm event={event} taken={counts.taken} />
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
