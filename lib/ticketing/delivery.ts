import { query } from "@/lib/db/client";
import { activeMailProvider, providerName } from "@/lib/mail/provider";
import { ticketMail } from "@/lib/mail/templates";
import { ticketUrl, orderUrl } from "@/lib/ticketing/links";
import { redactToken } from "@/lib/ticketing/tokens";
import type { TicketingEvent } from "@/lib/ticketing/events";
import type { Order, TicketWithToken } from "@/lib/ticketing/types";

/* Getting the ticket to the person who bought it.
 *
 * THE MOMENT A PAYMENT IS CONFIRMED, everything a mail needs is in one place,
 * handed to one function, and CLAIMED ONCE. Which mail service carries it is
 * not this file's business — see lib/mail/provider.ts, where a provider is
 * chosen from the environment. With none chosen the log provider runs, and
 * that is a state rather than a failure: the tickets exist and are reachable
 * at their URLs whether or not a message goes anywhere.
 *
 * ═══ THE ONE THING THAT IS ALREADY FINISHED ═══════════════════════════════
 *
 * DUPLICATE WEBHOOKS DO NOT SEND DUPLICATE EMAILS, and that is not a promise
 * about how careful the caller is — it is a PRIMARY KEY. `ticket_deliveries`
 * has one row per order, and the insert that claims it is the thing that
 * decides who sends. A provider that retries a confirmation five times runs
 * this five times; four of them find the row already there and return without
 * doing anything.
 *
 * It survives a restart, and it survives two instances doing it at once, which
 * a flag in memory would not.
 *
 * ═══ WHEN THERE IS A PROVIDER ═════════════════════════════════════════════
 *
 * Three things to hold on to, none of which are obvious afterwards:
 *
 *   1. DELIVERY MUST NOT BE ABLE TO UNDO A PAYMENT. A mail service that is
 *      having a bad morning must never be the reason a paying guest has no
 *      ticket. `confirmPayment` calls this and does not wait on the outcome —
 *      the tickets exist and are reachable at their URLs whether or not the
 *      mail goes out, and a failure here is recorded and retried, never thrown
 *      back at the payment.
 *
 *   2. THE MAIL CARRIES LINKS, NOT VERDICTS. Send the ticket URL and, if you
 *      like, the QR as an image. Do not attach a status: the only thing that
 *      knows whether a ticket is still good is the server, at the moment it is
 *      scanned.
 *
 *   3. THE TOKEN IS IN THE LINK, AND THE LINK IS IN A MAILBOX. That is
 *      acceptable — it is how every ticket in the world works — but it is the
 *      reason nothing else may treat a mailbox as private: no personal detail
 *      goes in the QR, and the ticket page shows no name at all. */

export type TicketDelivery = {
  order: Order;
  event: TicketingEvent;
  tickets: TicketWithToken[];
  /* Parallel to `tickets`, in the same order. */
  urls: string[];
  /* Everything the order bought, on one page — what the mail's main link is. */
  orderUrl: string;
};

export function buildDelivery(
  order: Order,
  event: TicketingEvent,
  tickets: TicketWithToken[],
  origin: string,
): TicketDelivery {
  return {
    order,
    event,
    tickets,
    urls: tickets.map((ticket) => ticketUrl(origin, ticket.token)),
    orderUrl: orderUrl(origin, order.reference),
  };
}

export type DeliveryOutcome = "sent" | "failed" | "already-claimed";

/* Send the tickets, at most once per order, ever.
 *
 * Never throws — see rule 1 above. */
export async function deliverTickets(
  delivery: TicketDelivery,
): Promise<DeliveryOutcome> {
  /* THE CLAIM. Whoever inserts this row is the one that sends; everybody else
   * is told the job is taken and stops. One statement, so two instances racing
   * on a doubled webhook cannot both win it.
   *
   * ═══ AND ONE ESCAPE HATCH, FOR THE WAY SERVERLESS ACTUALLY FAILS ═══════
   *
   * The claim used to be `DO NOTHING` and nothing else, which meant a row that
   * reached `queued` and never got further was stuck THERE FOR EVER: the
   * sending instance was frozen or killed between the claim and the send, and
   * every later attempt was told the job was taken. A guest who paid would
   * never get their tickets and nothing would ever try again.
   *
   * So a `queued` row that has not moved in five minutes may be re-claimed.
   * Five minutes is far longer than any real send — the provider call gives up
   * at ten seconds — so this cannot double-send a message that is merely slow;
   * it can only pick up one that nobody is carrying any more. A row that is
   * already `sent` or `failed` is never re-claimed here: `failed` is a person's
   * decision to make, on the admin screen. */
  const claim = await query(
    `INSERT INTO ticket_deliveries (order_id, channel, status, attempts)
     VALUES ($1, $2, 'queued', 1)
     ON CONFLICT (order_id) DO UPDATE
       SET attempts = ticket_deliveries.attempts + 1,
           channel = EXCLUDED.channel,
           updated_at = now()
     WHERE ticket_deliveries.status = 'queued'
       AND ticket_deliveries.updated_at < now() - interval '5 minutes'
     RETURNING order_id`,
    [delivery.order.id, channel()],
  );
  if (claim.rowCount === 0) return "already-claimed";

  try {
    await send(delivery);
    await query(
      `UPDATE ticket_deliveries SET status = 'sent', updated_at = now()
        WHERE order_id = $1`,
      [delivery.order.id],
    );
    return "sent";
  } catch (error: unknown) {
    /* Recorded rather than thrown. A failed mail is a job for the club to see
       on the admin screen and re-send by hand, not a reason to fail a payment
       that has already happened. */
    await query(
      `UPDATE ticket_deliveries
          SET status = 'failed', last_error = $2, updated_at = now()
        WHERE order_id = $1`,
      [delivery.order.id, String(error).slice(0, 500)],
    ).catch(() => undefined);
    return "failed";
  }
}

/* Staff pressing "send again" on the admin screen. It deliberately does NOT go
   through the claim — the club has decided to send it, and the claim exists to
   stop a machine repeating itself, not a person choosing to. */
export async function resendTickets(
  delivery: TicketDelivery,
): Promise<DeliveryOutcome> {
  try {
    await send(delivery);
    await query(
      `INSERT INTO ticket_deliveries (order_id, channel, status, attempts)
       VALUES ($1, $2, 'sent', 1)
       ON CONFLICT (order_id) DO UPDATE
         SET status = 'sent', attempts = ticket_deliveries.attempts + 1,
             last_error = NULL, updated_at = now()`,
      [delivery.order.id, channel()],
    );
    return "sent";
  } catch {
    return "failed";
  }
}

export type DeliveryRecord = {
  status: "queued" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  updatedAt: string;
};

/* Every delivery on one screen, in one round trip — the same reasoning as
   `ticketLinesForOrders`: 120 orders on the office's list must not be 120
   network round trips to a database in another data centre. */
export async function deliveriesFor(
  orderIds: readonly string[],
): Promise<Map<string, DeliveryRecord>> {
  const byOrder = new Map<string, DeliveryRecord>();
  if (orderIds.length === 0) return byOrder;

  const result = await query<{
    order_id: string;
    status: DeliveryRecord["status"];
    attempts: number;
    last_error: string | null;
    updated_at: Date | string;
  }>(
    `SELECT order_id, status, attempts, last_error, updated_at
       FROM ticket_deliveries WHERE order_id = ANY($1::text[])`,
    [orderIds as string[]],
  );

  for (const row of result.rows) {
    byOrder.set(row.order_id, {
      status: row.status,
      attempts: Number(row.attempts),
      lastError: row.last_error,
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString(),
    });
  }
  return byOrder;
}

export async function deliveryFor(orderId: string): Promise<DeliveryRecord | null> {
  const result = await query<{
    status: DeliveryRecord["status"];
    attempts: number;
    last_error: string | null;
    updated_at: Date | string;
  }>(
    `SELECT status, attempts, last_error, updated_at FROM ticket_deliveries
      WHERE order_id = $1`,
    [orderId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    status: row.status,
    attempts: Number(row.attempts),
    lastError: row.last_error,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
  };
}

/* ── the seam ───────────────────────────────────────────────────────────── */

/* Which provider carried it, written next to the delivery. "log" is a real
   answer and not an absence: it says the club had not chosen a mail service
   when this order was paid, which is what somebody looking at an old row six
   months from now needs to know. */
function channel(): string {
  return providerName();
}

/* Handing one order's tickets to whichever provider is configured.
 *
 * THE MESSAGE IS BUILT HERE AND THE SENDING IS SOMEBODY ELSE'S JOB — see
 * lib/mail/provider.ts. Nothing in this file knows a provider's name, exactly
 * as nothing above the payment boundary knows PaySpot's.
 *
 * Throwing is allowed and expected: the caller records the failure and moves
 * on. What is not allowed is doing anything that could make the payment look
 * unsuccessful. */
async function send(delivery: TicketDelivery): Promise<void> {
  const provider = await activeMailProvider();

  /* One line for the development log beside whatever the provider does. NO
     TOKENS IN FULL, NO ADDRESSES — a log is not a private place, and a token
     opens a door. The internal order id opens nothing, which is exactly why
     it is the one written down. */
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[ticketing] ${delivery.tickets.length} ticket(s) for order ` +
        `${delivery.order.id} — ${delivery.tickets
          .map((ticket) => redactToken(ticket.token))
          .join(", ")}`,
    );
  }

  await provider.send(ticketMail(delivery));
}
