import { query } from "@/lib/db/client";
import { iso } from "@/lib/ticketing/events";
import type { TicketingEvent } from "@/lib/ticketing/event-rules";

/* WHAT HAPPENED THAT NIGHT — the office's report on one event.
 *
 * ═══ EVERY NUMBER IN HERE IS COUNTED FROM ROWS, AND NONE IS INVENTED ══════
 *
 * There is no summary table, no nightly rollup and no cached total anywhere in
 * this system, and this file does not add one. Each figure below is an
 * aggregate over the rows that prove it: orders, tickets, scans, reservations.
 * The first time a stored counter disagrees with the tickets that exist, the
 * club either turns away somebody who paid or lets in more people than the
 * room holds — see the note at the top of lib/ticketing/store.ts.
 *
 * ═══ WHAT THIS DELIBERATELY DOES NOT KNOW ════════════════════════════════
 *
 * A NIGHT'S TAKINGS. This system sees money that went through the online
 * checkout and nothing else. It does not see the door, it does not see the
 * bar, and it has no till. So there is no field on this type called revenue,
 * total, or takings — there is `paidOnlineRevenue`, and every screen that
 * prints it says ONLINE next to it. A number that is nearly right about money
 * is worse than no number at all, and a number that silently means a fifth of
 * the real one is worse than both.
 *
 * ATTENDANCE. `admitted` is how many tickets were scanned in at the door. On a
 * night with free entry that is not attendance and must never be labelled as
 * such: nobody counted the people who walked in.
 *
 * ANYTHING ABOUT A LEGACY NIGHT. The poster-only nights predate this software
 * and have no orders, tickets, scans or reservations at all. Every query below
 * would run happily against one and return a page of zeros — which is exactly
 * the lie this whole separation exists to prevent, because those zeros mean
 * "never measured" and read as "sold nothing". Nothing in this file can tell
 * the difference; the SCREENS decide, by asking `isOperational` in
 * lib/club/event-manager.ts before they ever get here, and showing the night's
 * artwork and a plain explanation instead when the answer is no.
 *
 * ═══ AND IT IS FOUR QUERIES, NOT FORTY ═══════════════════════════════════
 *
 * One per subject — orders, tickets, scans, reservations — each an aggregate
 * over one event, run together. The list screens use `reportSummaries`, which
 * answers for EVERY night at once in three queries rather than three per night;
 * a dashboard that opens twelve connections to draw twelve rows is a dashboard
 * that falls over on the night it is needed. */

/* ── the sale ───────────────────────────────────────────────────────────── */

export type SalesReport = {
  /* Whether this night sold entry through the site at all. When false every
     figure below is zero BECAUSE THERE WAS NO ONLINE SALE, which is a
     different sentence from "nothing sold", and the screens say so. */
  ticketingEnabled: boolean;
  ticketPrice: number;
  currency: string;
  capacity: number;

  /* Admissions on orders where the money is in. */
  ticketsPaid: number;
  /* Admissions on pending orders whose checkout hold is still running. */
  ticketsHeld: number;
  available: number;

  /* ═══ FIVE BUCKETS THAT ADD UP TO `total`, WHICH TOOK A FIX ═════════════
   *
   * `pending` is pending AND STILL HOLDING, because an order whose ten minutes
   * have run out holds no seat and is not a sale in flight. But the sweep that
   * rewrites its status column runs later — so between the hold lapsing and
   * the sweep, the row says `pending` and is not one.
   *
   * Counted naively that order falls into no bucket at all: not live pending,
   * and not yet `expired` in the column. The five figures then quietly fail to
   * add up to the total, and nobody notices until somebody adds them.
   *
   * So a lapsed pending IS an expired order, which is what it is in every
   * sense except the one column the sweep has not got to yet. The buckets
   * partition the night completely, and `expireLapsedOrders` changes the
   * labelling and never the arithmetic. */
  orders: {
    total: number;
    paid: number;
    pending: number;
    expired: number;
    failed: number;
    refunded: number;
  };

  /* ═══ MONEY, AND ONLY THE MONEY THIS SYSTEM TOOK ═══════════════════════
   *
   * The sum of `total_amount` over orders that reached `paid`. Not the price
   * times the count — an order carries what it was actually charged, and a
   * price the office edited afterwards must not retroactively rewrite what
   * somebody paid last Saturday. */
  paidOnlineRevenue: number;
  /* Kept apart rather than subtracted, because a refund is a fact about the
     night and not a correction to it. A screen may show both; nothing here
     decides that a refunded order should vanish from the record. */
  refundedAmount: number;
  /* paidOnlineRevenue / ticketsPaid — what an admission actually fetched,
     which is not the configured price the moment anything is comped or the
     price changes mid-sale. Absent when nothing was sold, because an average
     over nothing is not zero. */
  averagePaidPrice?: number;

  firstPaidAt?: string;
  lastPaidAt?: string;
  /* Orders honoured after their hold had lapsed and the room had filled behind
     them. Never a reason to refuse money; always a reason for staff to see it. */
  oversold: number;
};

/* ── the door ───────────────────────────────────────────────────────────── */

export type AccessReport = {
  /* ═══ ONE TICKET, AT MOST ONE ENTRY ════════════════════════════════════
   *
   * Counted from `tickets.status = 'used'` and never from `ticket_scans`. The
   * scan log holds every attempt including the refusals — a guest who holds
   * their phone up three times writes three rows, and two of them come back
   * ALREADY USED. Counting that log would report three people through a door
   * one person walked through. The ticket row is the admission; the log is the
   * story of the door. */
  admitted: number;
  /* Tickets that exist for this night: minted, not revoked. */
  issued: number;
  /* Minted, still valid, never scanned — sold and did not come. */
  unused: number;
  cancelled: number;

  /* Every time something was held up at the door, and how it went. */
  attempts: number;
  refused: number;
  firstScanAt?: string;
  lastScanAt?: string;
};

/* ── the floor ──────────────────────────────────────────────────────────── */

export type ReservationReport = {
  tablesEnabled: boolean;
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  rejected: number;
  expired: number;
  /* Tables actually held for the night — the two statuses the unique index
     treats as live. This is the number the floor plan draws. */
  tablesTaken: number;
  /* Guests written down against those tables. NOT attendance: it is what the
     bookings say, not who came. */
  guestsBooked: number;
};

export type EventReport = {
  event: TicketingEvent;
  sales: SalesReport;
  access: AccessReport;
  reservations: ReservationReport;
};

/* ── one night, in full ─────────────────────────────────────────────────── */

/* THE FLOOR IS KEYED BY SLUG AND THE TICKETS BY ID. That is one night filed
   under two names and it is explained at the top of lib/ticketing/events.ts;
   this file is the one place that has to know both, so every caller hands in
   the event rather than an identifier and cannot pick the wrong one. */
export async function eventReport(event: TicketingEvent): Promise<EventReport> {
  const [sales, access, reservations] = await Promise.all([
    salesReport(event),
    accessReport(event.id),
    reservationReport(event),
  ]);
  return { event, sales, access, reservations };
}

type SalesRow = {
  orders: number;
  paid_orders: number;
  pending_orders: number;
  expired_orders: number;
  failed_orders: number;
  refunded_orders: number;
  tickets_paid: number;
  tickets_held: number;
  paid_revenue: string | number;
  refunded_amount: string | number;
  oversold: number;
  first_paid_at: Date | string | null;
  last_paid_at: Date | string | null;
};

export async function salesReport(event: TicketingEvent): Promise<SalesReport> {
  const result = await query<SalesRow>(
    /* FILTER rather than five scans of the same table. One pass over one
       event's orders, which is what the (event_id, payment_status) index is
       for. `hold_expires_at > now()` is the database's clock inside the
       statement that depends on it — never a timestamp computed in Node. */
    `SELECT
       COUNT(*)::int                                                   AS orders,
       COUNT(*) FILTER (WHERE payment_status = 'paid')::int            AS paid_orders,
       COUNT(*) FILTER (WHERE payment_status = 'pending'
                          AND hold_expires_at > now())::int            AS pending_orders,
       COUNT(*) FILTER (WHERE payment_status = 'expired'
                           OR (payment_status = 'pending'
                               AND hold_expires_at <= now()))::int      AS expired_orders,
       COUNT(*) FILTER (WHERE payment_status = 'failed')::int          AS failed_orders,
       COUNT(*) FILTER (WHERE payment_status = 'refunded')::int        AS refunded_orders,
       COALESCE(SUM(quantity) FILTER (WHERE payment_status = 'paid'), 0)::int
                                                                       AS tickets_paid,
       COALESCE(SUM(quantity) FILTER (WHERE payment_status = 'pending'
                                        AND hold_expires_at > now()), 0)::int
                                                                       AS tickets_held,
       COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::bigint
                                                                       AS paid_revenue,
       COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'refunded'), 0)::bigint
                                                                       AS refunded_amount,
       COUNT(*) FILTER (WHERE oversold)::int                           AS oversold,
       MIN(paid_at) FILTER (WHERE payment_status = 'paid')             AS first_paid_at,
       MAX(paid_at) FILTER (WHERE payment_status = 'paid')             AS last_paid_at
     FROM ticket_orders WHERE event_id = $1`,
    [event.id],
  );

  const row = result.rows[0];
  const ticketsPaid = Number(row?.tickets_paid ?? 0);
  const ticketsHeld = Number(row?.tickets_held ?? 0);
  const paidOnlineRevenue = Number(row?.paid_revenue ?? 0);

  return {
    ticketingEnabled: event.ticketingEnabled,
    ticketPrice: event.ticketPrice,
    currency: event.currency,
    capacity: event.capacity,
    ticketsPaid,
    ticketsHeld,
    available: Math.max(0, event.capacity - ticketsPaid - ticketsHeld),
    orders: {
      total: Number(row?.orders ?? 0),
      paid: Number(row?.paid_orders ?? 0),
      pending: Number(row?.pending_orders ?? 0),
      expired: Number(row?.expired_orders ?? 0),
      failed: Number(row?.failed_orders ?? 0),
      refunded: Number(row?.refunded_orders ?? 0),
    },
    paidOnlineRevenue,
    refundedAmount: Number(row?.refunded_amount ?? 0),
    /* Rounded to the dinar, and absent rather than zero when nothing sold. */
    averagePaidPrice:
      ticketsPaid > 0 ? Math.round(paidOnlineRevenue / ticketsPaid) : undefined,
    firstPaidAt: iso(row?.first_paid_at ?? null),
    lastPaidAt: iso(row?.last_paid_at ?? null),
    oversold: Number(row?.oversold ?? 0),
  };
}

export async function accessReport(eventId: string): Promise<AccessReport> {
  /* Two subjects, two tables, one round trip each — and the ticket counts come
     from `tickets` alone, which is what makes one ticket at most one entry. */
  const [tickets, scans] = await Promise.all([
    query<{ used: number; valid: number; cancelled: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'used')::int      AS used,
         COUNT(*) FILTER (WHERE status = 'valid')::int     AS valid,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM tickets WHERE event_id = $1`,
      [eventId],
    ),
    query<{
      attempts: number;
      refused: number;
      first_at: Date | string | null;
      last_at: Date | string | null;
    }>(
      `SELECT
         COUNT(*)::int                                        AS attempts,
         COUNT(*) FILTER (WHERE outcome <> 'redeemed')::int   AS refused,
         MIN(at) FILTER (WHERE outcome = 'redeemed')          AS first_at,
         MAX(at) FILTER (WHERE outcome = 'redeemed')          AS last_at
       FROM ticket_scans WHERE event_id = $1`,
      [eventId],
    ),
  ]);

  const t = tickets.rows[0];
  const s = scans.rows[0];
  const used = Number(t?.used ?? 0);
  const valid = Number(t?.valid ?? 0);

  return {
    admitted: used,
    issued: used + valid,
    unused: valid,
    cancelled: Number(t?.cancelled ?? 0),
    attempts: Number(s?.attempts ?? 0),
    refused: Number(s?.refused ?? 0),
    firstScanAt: iso(s?.first_at ?? null),
    lastScanAt: iso(s?.last_at ?? null),
  };
}

export async function reservationReport(
  event: TicketingEvent,
): Promise<ReservationReport> {
  const result = await query<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    rejected: number;
    expired: number;
    tables_taken: number;
    guests_booked: number;
  }>(
    /* `status IN ('pending','confirmed')` is the same predicate as the partial
       unique index that stops two people getting one table — quoted here so a
       reader can see the report and the guarantee agree. */
    `SELECT
       COUNT(*)::int                                        AS total,
       COUNT(*) FILTER (WHERE status = 'confirmed')::int    AS confirmed,
       COUNT(*) FILTER (WHERE status = 'pending')::int      AS pending,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int    AS cancelled,
       COUNT(*) FILTER (WHERE status = 'rejected')::int     AS rejected,
       COUNT(*) FILTER (WHERE status = 'expired')::int      AS expired,
       COUNT(*) FILTER (WHERE status IN ('pending','confirmed'))::int
                                                            AS tables_taken,
       COALESCE(SUM(guests) FILTER (WHERE status IN ('pending','confirmed')), 0)::int
                                                            AS guests_booked
     FROM reservations WHERE event_id = $1`,
    [event.slug],
  );

  const row = result.rows[0];
  return {
    tablesEnabled: event.tablesEnabled,
    total: Number(row?.total ?? 0),
    confirmed: Number(row?.confirmed ?? 0),
    pending: Number(row?.pending ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    rejected: Number(row?.rejected ?? 0),
    expired: Number(row?.expired ?? 0),
    tablesTaken: Number(row?.tables_taken ?? 0),
    guestsBooked: Number(row?.guests_booked ?? 0),
  };
}

/* ── many nights at once, for the lists ─────────────────────────────────── */

/* THE HEADLINE FIGURES FOR A WHOLE PROGRAMME, IN THREE QUERIES.
 *
 * The event list and the control centre both draw a row per night with sold,
 * scanned and tables on it. Asking `eventReport` per night is three queries
 * times however many nights the club has ever run — the classic N+1, and the
 * one that gets worse every month the club stays in business.
 *
 * So: one grouped aggregate per subject over the whole set, keyed back onto the
 * events in memory. Three round trips whatever the programme's length. */
export type ReportSummary = {
  ticketsPaid: number;
  ticketsHeld: number;
  available: number;
  paidOrders: number;
  paidOnlineRevenue: number;
  admitted: number;
  unused: number;
  tablesTaken: number;
  reservations: number;
};

const EMPTY: Omit<ReportSummary, "available"> = {
  ticketsPaid: 0,
  ticketsHeld: 0,
  paidOrders: 0,
  paidOnlineRevenue: 0,
  admitted: 0,
  unused: 0,
  tablesTaken: 0,
  reservations: 0,
};

export async function reportSummaries(
  events: TicketingEvent[],
): Promise<Map<string, ReportSummary>> {
  const summaries = new Map<string, ReportSummary>();
  if (events.length === 0) return summaries;

  const ids = events.map((event) => event.id);
  /* The floor's key. Distinct from the ids above and deliberately gathered
     separately — see the note on `eventReport`. */
  const slugs = events.map((event) => event.slug);

  const [orders, tickets, reservations] = await Promise.all([
    query<{
      event_id: string;
      tickets_paid: number;
      tickets_held: number;
      paid_orders: number;
      paid_revenue: string | number;
    }>(
      `SELECT event_id,
              COALESCE(SUM(quantity) FILTER (WHERE payment_status = 'paid'), 0)::int AS tickets_paid,
              COALESCE(SUM(quantity) FILTER (WHERE payment_status = 'pending'
                                               AND hold_expires_at > now()), 0)::int AS tickets_held,
              COUNT(*) FILTER (WHERE payment_status = 'paid')::int                   AS paid_orders,
              COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::bigint
                                                                                     AS paid_revenue
         FROM ticket_orders WHERE event_id = ANY($1::text[])
        GROUP BY event_id`,
      [ids],
    ),
    query<{ event_id: string; used: number; valid: number }>(
      `SELECT event_id,
              COUNT(*) FILTER (WHERE status = 'used')::int  AS used,
              COUNT(*) FILTER (WHERE status = 'valid')::int AS valid
         FROM tickets WHERE event_id = ANY($1::text[])
        GROUP BY event_id`,
      [ids],
    ),
    query<{ event_id: string; total: number; taken: number }>(
      `SELECT event_id,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status IN ('pending','confirmed'))::int AS taken
         FROM reservations WHERE event_id = ANY($1::text[])
        GROUP BY event_id`,
      [slugs],
    ),
  ]);

  const byId = new Map(orders.rows.map((row) => [row.event_id, row]));
  const byTicket = new Map(tickets.rows.map((row) => [row.event_id, row]));
  const bySlug = new Map(reservations.rows.map((row) => [row.event_id, row]));

  for (const event of events) {
    const o = byId.get(event.id);
    const t = byTicket.get(event.id);
    const r = bySlug.get(event.slug);

    const ticketsPaid = Number(o?.tickets_paid ?? EMPTY.ticketsPaid);
    const ticketsHeld = Number(o?.tickets_held ?? EMPTY.ticketsHeld);

    summaries.set(event.id, {
      ticketsPaid,
      ticketsHeld,
      available: Math.max(0, event.capacity - ticketsPaid - ticketsHeld),
      paidOrders: Number(o?.paid_orders ?? EMPTY.paidOrders),
      paidOnlineRevenue: Number(o?.paid_revenue ?? EMPTY.paidOnlineRevenue),
      admitted: Number(t?.used ?? EMPTY.admitted),
      unused: Number(t?.valid ?? EMPTY.unused),
      tablesTaken: Number(r?.taken ?? EMPTY.tablesTaken),
      reservations: Number(r?.total ?? EMPTY.reservations),
    });
  }

  return summaries;
}

/* ── what was sold, line by line ────────────────────────────────────────── */

/* THE ORDER LIST FOR ONE NIGHT.
 *
 * `listOrders` in lib/ticketing/store.ts already answers this and is what the
 * KARTE screen uses. What it does not carry is the per-order ticket state the
 * sale tab wants beside each line — how many of that order's admissions
 * actually came through the door — and getting that by asking per order is the
 * N+1 this module exists to avoid. So it is one query with the counts joined.
 *
 * NO TOKENS AND NO TOKEN CIPHERS, ever. This is a report; the secret in a QR
 * has no business in one. See lib/ticketing/secrets.ts. */
export type SaleLine = {
  id: string;
  reference: string;
  /* THE NAME, AND NOT THE ADDRESS OR THE NUMBER. A report is read to find out
     what the night did, not to contact anybody — the screen that exists for
     that is /admin/karte, which already carries the full order. Fetching a
     column a report never renders is how a field ends up on a client
     component later by accident, so it is not fetched. */
  customerName: string;
  quantity: number;
  totalAmount: number;
  /* What one admission on THIS order cost — derived from the order rather than
     from the event, so an order taken at last week's price still reports last
     week's price. */
  unitAmount: number;
  paymentStatus: string;
  paymentProvider?: string;
  channel: string;
  oversold: boolean;
  createdAt: string;
  paidAt?: string;
  /* Of this order's tickets: minted, and how many were used at the door. */
  ticketsIssued: number;
  ticketsAdmitted: number;
};

export async function saleLines(eventId: string, limit = 200): Promise<SaleLine[]> {
  const result = await query<{
    id: string;
    reference: string;
    customer_name: string;
    quantity: number;
    total_amount: number;
    payment_status: string;
    payment_provider: string | null;
    channel: string;
    oversold: boolean;
    created_at: Date | string;
    paid_at: Date | string | null;
    tickets_issued: number;
    tickets_admitted: number;
  }>(
    `SELECT o.id, o.reference, o.customer_name,
            o.quantity, o.total_amount, o.payment_status, o.payment_provider,
            o.channel, o.oversold, o.created_at, o.paid_at,
            COALESCE(t.issued, 0)::int   AS tickets_issued,
            COALESCE(t.admitted, 0)::int AS tickets_admitted
       FROM ticket_orders o
       LEFT JOIN (
         SELECT order_id,
                COUNT(*) FILTER (WHERE status <> 'cancelled') AS issued,
                COUNT(*) FILTER (WHERE status = 'used')       AS admitted
           FROM tickets WHERE event_id = $1
          GROUP BY order_id
       ) t ON t.order_id = o.id
      WHERE o.event_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2`,
    [eventId, limit],
  );

  return result.rows.map((row) => {
    const quantity = Number(row.quantity);
    const totalAmount = Number(row.total_amount);
    return {
      id: row.id,
      reference: row.reference,
      customerName: row.customer_name,
      quantity,
      totalAmount,
      unitAmount: quantity > 0 ? Math.round(totalAmount / quantity) : 0,
      paymentStatus: row.payment_status,
      paymentProvider: row.payment_provider ?? undefined,
      channel: row.channel,
      oversold: Boolean(row.oversold),
      createdAt: iso(row.created_at)!,
      paidAt: iso(row.paid_at),
      ticketsIssued: Number(row.tickets_issued),
      ticketsAdmitted: Number(row.tickets_admitted),
    };
  });
}
