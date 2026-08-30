import Link from "next/link";
import type { Metadata } from "next";
import { Empty, PageHeader, Panel, Scroller } from "@/components/admin/shell";
import { Badge } from "@/components/admin/badge";
import { OrderActions } from "@/components/admin/order-actions";
import { allTicketingEvents } from "@/lib/ticketing/events";
import {
  listOrders,
  searchOrders,
  ticketLinesForOrders,
  type OrderListing,
  type TicketLine,
} from "@/lib/ticketing/store";
import { deliveriesFor } from "@/lib/ticketing/delivery";
import { price, scanMoment, untilExpiry } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* /admin/karte — EVERY PURCHASE, AND EVERY ADMISSION INSIDE IT.
 *
 * ═══ THE SEARCH IS THE POINT OF THIS PAGE ═════════════════════════════════
 *
 * Somebody rings the club saying they bought four tickets and cannot find the
 * email, and what they can tell you is a name, a telephone number, an address,
 * or a code off a screenshot. All five go in the same box — which is why it is
 * the biggest thing on the screen — and the server works out which it was. See
 * `searchOrders`: the two references match exactly and everything else loosely,
 * because a person half-remembering a surname is the normal case.
 *
 * A plain GET form, so a search is a URL: staff can send each other one, and
 * the back button works.
 *
 * ═══ WHAT IS SHOWN, AND WHAT IS NEVER SHOWN ═══════════════════════════════
 *
 * Each admission is listed by its PUBLIC REFERENCE — PLV-XXXXX-XXXXX, the
 * thing printed on the ticket and spoken across a doorway — with whether it has
 * been used, when, and at which door on a quiet second line.
 *
 * THE TOKEN IS NOT ON THIS PAGE AND MUST NEVER BE. It is the credential in the
 * QR: whoever has it can open the door. A guest's own page is allowed it
 * because they bought it; an office list on a laptop in a bar is not, and "send
 * again" exists precisely so that nobody ever needs to copy one by hand.
 *
 * ═══ NOTHING IS DELETED ═══════════════════════════════════════════════════
 *
 * There is no delete button here and there should not be. A ticket that stops
 * working stops working because its status says `cancelled` — the row, its
 * scans and its order stay exactly where they are, which is the only reason the
 * club can answer "what happened to this one" a week later. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Karte",
  robots: { index: false, follow: false, nocache: true },
};

/* The four questions staff actually ask a list of orders. `paid_unused` is the
   one that matters at the door: money in, nobody through yet. */
type Filter = "sve" | "paid_unused" | "used" | "pending" | "problem";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "sve", label: "Sve" },
  { value: "paid_unused", label: "Plaćeno, nije ušlo" },
  { value: "used", label: "Ušlo" },
  { value: "pending", label: "U toku" },
  { value: "problem", label: "Isteklo / neuspelo" },
];

export default async function AdminTicketsPage({
  searchParams,
}: PageProps<"/admin/karte">) {
  await requireStaff("admin");

  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.trim() : "";
  const eventId = typeof params.event === "string" ? params.event : "";
  const filter: Filter =
    typeof params.stanje === "string" &&
    FILTERS.some((f) => f.value === params.stanje)
      ? (params.stanje as Filter)
      : "sve";

  const [events, found] = await Promise.all([
    allTicketingEvents(),
    term
      ? searchOrders(term)
      : listOrders({ eventId: eventId || undefined, limit: 120 }),
  ]);

  /* Every admission of every order on the screen, and the delivery record
     beside it — in TWO queries rather than two per order. On a laptop next to
     the database the difference is imperceptible; on Vercel talking to a
     database in another data centre, 240 round trips is the difference between
     this screen opening and this screen loading while somebody is on the
     telephone. */
  const ids = found.map((order) => order.id);
  const [ticketsByOrder, deliveriesByOrder] = await Promise.all([
    ticketLinesForOrders(ids),
    deliveriesFor(ids),
  ]);
  const detailed = found.map((order) => ({
    order,
    tickets: ticketsByOrder.get(order.id) ?? [],
    delivery: deliveriesByOrder.get(order.id) ?? null,
  }));

  const rows = detailed.filter(({ order, tickets }) => {
    if (filter === "sve") return true;
    if (filter === "pending") return order.paymentStatus === "pending";
    if (filter === "problem") {
      return ["expired", "failed", "refunded"].includes(order.paymentStatus);
    }
    const used = tickets.filter((ticket) => ticket.status === "used").length;
    if (filter === "used") return used > 0;
    return order.paymentStatus === "paid" && used < tickets.length;
  });

  return (
    <>
      <PageHeader
        title="Karte"
        lede="Pretražite po imenu, broju telefona, email adresi, broju porudžbine ili broju karte."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 sm:gap-4">
        <label className="min-w-0 flex-1 basis-[18rem]">
          <span className="adm-label">Pretraga</span>
          <input
            name="q"
            defaultValue={term}
            autoComplete="off"
            placeholder="PLV-… , ime, email ili telefon"
            className="adm-field adm-search mt-2"
          />
        </label>

        <label className="basis-[12rem]">
          <span className="adm-label">Događaj</span>
          <select
            name="event"
            defaultValue={eventId}
            className="adm-field adm-search mt-2"
          >
            <option value="">Svi</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>

        <label className="basis-[12rem]">
          <span className="adm-label">Stanje</span>
          <select
            name="stanje"
            defaultValue={filter}
            className="adm-field adm-search mt-2"
          >
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="adm-btn adm-btn--primary h-12">
          Traži
        </button>
        {term || eventId || filter !== "sve" ? (
          <Link href="/admin/karte" className="adm-btn adm-btn--ghost h-12">
            Poništi
          </Link>
        ) : null}
      </form>

      <Panel
        title={term ? `Rezultati za „${term}”` : "Porudžbine"}
        action={
          <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
            {rows.length}
          </span>
        }
      >
        {rows.length === 0 ? (
          <Empty>
            {term
              ? "Nema pronađenih karata."
              : "Još nijedna porudžbina za ovaj izbor."}
          </Empty>
        ) : (
          <ul>
            {rows.map(({ order, tickets, delivery }) => (
              <OrderCard
                key={order.id}
                order={order}
                tickets={tickets}
                delivery={delivery?.status ?? null}
                deliveryError={delivery?.lastError ?? null}
              />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* One purchase: the money at the top, the admissions underneath.
 *
 * A CARD RATHER THAN A ROW, and that is a deliberate reversal of what an office
 * list usually looks like. An order has a variable number of tickets inside it,
 * and a table cannot hold that without either hiding them behind a click or
 * repeating the buyer's name four times. This reads the same on a phone at the
 * door and on a laptop in the office. */
function OrderCard({
  order,
  tickets,
  delivery,
  deliveryError,
}: {
  order: OrderListing;
  tickets: TicketLine[];
  delivery: string | null;
  deliveryError: string | null;
}) {
  const used = tickets.filter((ticket) => ticket.status === "used").length;

  return (
    <li className="adm-row">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Link
            href={`/karte/${encodeURIComponent(order.reference)}`}
            className="font-mono text-[0.8125rem] tracking-wide text-[var(--adm-gold)] transition-colors hover:text-[var(--adm-gold-light)]"
          >
            {order.reference}
          </Link>
          <p className="mt-1.5 text-[0.9375rem] leading-snug text-[var(--adm-ink)]">
            {order.customerName}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-[var(--adm-ink-3)]">
            {order.eventTitle}
          </p>
          <p className="mt-1 break-all text-[0.6875rem] text-[var(--adm-ink-4)]">
            {order.customerEmail} · {order.customerPhone}
          </p>
        </div>

        <div className="text-right">
          <p className="adm-figure text-[1.125rem] text-[var(--adm-ink)]">
            {price(order.totalAmount)}
          </p>
          <p className="adm-figure mt-1 text-[0.75rem] text-[var(--adm-ink-3)]">
            {order.quantity} {order.quantity === 1 ? "karta" : "karata"} · {used} ušlo
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Badge kind="payment" value={order.paymentStatus} />
            {order.oversold ? (
              /* A payment honoured after the room had filled behind it. Said
                 loudly: this is one more guest than seats, and only a person
                 can decide what to do about it. */
              <span className="adm-badge adm-badge--bad">Preko kapaciteta</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.6875rem] text-[var(--adm-ink-4)]">
        <span className="adm-figure">Primljeno {scanMoment(order.createdAt)}</span>
        {order.paidAt ? (
          <span className="adm-figure">Plaćeno {scanMoment(order.paidAt)}</span>
        ) : null}
        {order.paymentStatus === "pending" ? (
          <span className="adm-figure text-[var(--adm-warn)]">
            {untilExpiry(order.holdExpiresAt)}
          </span>
        ) : null}
        {order.paymentProvider ? <span>{order.paymentProvider}</span> : null}
        <span className="flex items-center gap-2">
          Isporuka
          {delivery ? (
            <Badge kind="delivery" value={delivery} />
          ) : (
            <span className="adm-badge adm-badge--muted">Nema</span>
          )}
        </span>
      </div>

      {deliveryError ? (
        <p className="mt-2 break-words text-[0.6875rem] leading-relaxed text-[var(--adm-bad)]">
          {deliveryError}
        </p>
      ) : null}

      {tickets.length > 0 ? (
        <Scroller>
          <table className="adm-table mt-4 w-full min-w-[24rem] max-w-[38rem]">
            <thead>
              <tr>
                <th className="px-0">Karta</th>
                <th>Status</th>
                <th className="px-0">Ulaz</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-0 font-mono text-[0.75rem] text-[var(--adm-ink-2)]">
                    {ticket.reference}
                  </td>
                  <td>
                    <Badge kind="ticket" value={ticket.status} />
                  </td>
                  <td className="px-0 text-[0.6875rem] text-[var(--adm-ink-4)]">
                    {ticket.scannedAt ? (
                      <>
                        {scanMoment(ticket.scannedAt)}
                        {ticket.door ? ` · ${ticket.door}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      ) : null}

      <div className="mt-4">
        <OrderActions
          reference={order.reference}
          canRefund={order.paymentStatus === "paid"}
          canResend={tickets.length > 0}
        />
      </div>
    </li>
  );
}
