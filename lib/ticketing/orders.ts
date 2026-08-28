import { afterResponse } from "@/lib/after-response";
import { isDatabaseBusy } from "@/lib/db/client";
import { timed } from "@/lib/db/profile";
import { validateField } from "@/lib/booking";
import { normalizeEmail, normalizePhone } from "@/lib/reservations/identity";
import { devMode } from "@/lib/ticketing/config";
import { buildDelivery, deliverTickets } from "@/lib/ticketing/delivery";
import {
  findTicketingEvent,
  findTicketingEventWithTaken,
  saleState,
  type TicketingEvent,
} from "@/lib/ticketing/events";
import {
  CHECKOUT_HOLD_SECONDS,
  cancelTicketsForOrder,
  claimPayment,
  issueTickets,
  placeOrder,
  setOrderStatus,
} from "@/lib/ticketing/store";
import type { Order, TicketWithToken } from "@/lib/ticketing/types";
import type {
  PaymentProvider,
  PaymentVerdict,
  ProviderNotice,
} from "@/lib/ticketing/payments/provider";

/* An order's whole life, in two functions.
 *
 * `createOrder` turns a request into a pending order holding its admissions
 * for ten minutes, having believed nothing it was told except who is coming
 * and how many. `confirmPayment` turns that order into a paid one and mints
 * its tickets.
 *
 * ═══ WHY THOSE TWO ARE SEPARATE ═══════════════════════════════════════════
 *
 * Because the second one has to be callable by something that has never seen
 * the first. Today it is called by a simulated confirmation in development.
 * Tomorrow it is called by a PaySpot webhook: a POST from a machine, minutes
 * after the buyer closed their browser, carrying nothing but a signature and
 * an order id. If minting a ticket were part of the purchase flow — a step
 * that happens while the buyer is watching — then the buyer closing their
 * laptop would be the difference between having a ticket and not having one.
 *
 * So `confirmPayment` takes an order id and an evidence of payment, and does
 * not care in the least where either came from. It is the seam, and it is the
 * only door into ticket minting.
 *
 * ═══ WHAT IS BELIEVED, AND WHAT IS LOOKED UP ══════════════════════════════
 *
 * From the browser: which night, how many, and the buyer's name, email and
 * telephone number. That is all.
 *
 * Looked up here: what the night costs, whether it is on sale, whether there
 * is room, and therefore what the total is. A price that arrived in a request
 * is not a price — it is a suggestion from a stranger.
 *
 * ═══ THE TEN MINUTES ══════════════════════════════════════════════════════
 *
 * A pending order holds its admissions until `holdExpiresAt` and then stops.
 * Not because anything runs at that moment — nothing does — but because every
 * count in the system asks the database whether the hold is still alive, in
 * the same statement in which it counts. See lib/ticketing/store.ts. The
 * countdown a buyer sees is a picture of that instant and has no authority. */

export type OrderRequest = {
  eventSlug: string;
  quantity: number;
  buyer: { name: string; email: string; phone: string };
};

export type OrderRefusal =
  | { ok: false; reason: "invalid"; fields: Record<string, string> }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "sold_out"; remaining: number }
  /* THE DATABASE WAS BUSY, AND NOTHING WAS WRITTEN.
   *
   * Not a statement about the night, the buyer or the room: the instance's
   * connection queue was full and this request never got as far as asking. It
   * is emphatically NOT `sold_out` — the seats may be sitting there — and it
   * is not an error the buyer can do anything about except try again, which
   * is exactly what they are told. See `isDatabaseBusy`. */
  | { ok: false; reason: "busy"; retryAfterSeconds: number };

/* Rate limiting is NOT one of these. A flood is turned away at the edge, by
   the route handler, before it costs a lookup — see
   app/api/ticketing/checkout/route.ts. */

export type OrderResult =
  | { ok: true; order: Order; event: TicketingEvent }
  | OrderRefusal;

const MAX_QUANTITY = 10;

/* How long to ask a buyer to wait when the queue was full. Short, because the
   condition it describes is measured in seconds: a connection queue drains as
   fast as the transactions in front of it commit. */
const BUSY_RETRY_SECONDS = 3;

const busy = (): OrderRefusal => ({
  ok: false,
  reason: "busy",
  retryAfterSeconds: BUSY_RETRY_SECONDS,
});

export async function createOrder(
  raw: unknown,
  options: { channel?: string; holdSeconds?: number } = {},
): Promise<OrderResult> {
  const body = raw as Partial<OrderRequest> | null;
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "invalid", fields: { body: "missing" } };
  }

  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const buyer = (body.buyer ?? {}) as Partial<OrderRequest["buyer"]>;

  const name = text(buyer.name);
  const email = text(buyer.email);
  const phone = text(buyer.phone);

  /* The same three judgements the purchase panel makes as the guest types,
     made again here where they count. Both sides call the same validators —
     see lib/booking.ts — so the two can never come to disagree about what a
     telephone number looks like. */
  const fields: Record<string, string> = {};
  if (validateField("name", name)) fields.name = "invalid";
  if (validateField("email", email)) fields.email = "invalid";
  if (validateField("phone", phone)) fields.phone = "invalid";

  /* Stored in one canonical form as well as the guest's own, so that a club
     searching for a lost ticket by telephone number finds it however it was
     typed. See lib/reservations/identity.ts. */
  const emailKey = normalizeEmail(email);
  const phoneKey = normalizePhone(phone);
  if (!emailKey) fields.email = "invalid";
  if (!phoneKey) fields.phone = "invalid";

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    fields.quantity = "out-of-range";
  }

  /* THE NIGHT AND HOW FULL IT IS, IN ONE STATEMENT — see
     `findTicketingEventWithTaken`. The count comes back beside the night at no
     extra round trip, and it is what lets a buyer for a full room be turned
     away before joining the queue on the capacity lock. */
  let found;
  try {
    found = await timed("event.lookup", () =>
      findTicketingEventWithTaken(text(body.eventSlug), devMode()),
    );
  } catch (error: unknown) {
    /* Even reading the night needs a connection. A queue that is full here is
       the same answer as a queue that is full below. */
    if (isDatabaseBusy(error)) return busy();
    throw error;
  }
  if (!found) return { ok: false, reason: "unavailable" };
  const { event, taken } = found;

  if (Object.keys(fields).length > 0 || !emailKey || !phoneKey) {
    return { ok: false, reason: "invalid", fields };
  }

  /* IS THIS NIGHT SELLING AT ALL — a question about the night itself, not
   * about how full it is: a draft, an evening that has already happened, a
   * window that has not opened, a price nobody has set.
   *
   * `taken` costs nothing here — it arrived in the same statement as the night
   * — so `saleState` gets the real number rather than a nought, and a night the
   * club has closed by hand is still told apart from a room that filled up.
   *
   * `placeOrder` remains the only BINDING answer about capacity: it counts
   * inside the lock, where the number is actually true. */
  const state = saleState(event, taken);
  if (!state.open) {
    /* A full room and a closed sale are different things and are told apart:
       "sold out" is a fact about tonight that a guest can act on, and
       "unavailable" is everything else — a draft night, a window that has not
       opened, an evening that has already happened. */
    return state.reason === "sold_out"
      ? { ok: false, reason: "sold_out", remaining: 0 }
      : { ok: false, reason: "unavailable" };
  }

  /* The house rule about how many one order may hold. A fact about the night,
     free to check, and nothing to do with what is left. */
  if (quantity > event.maxPerOrder) {
    return { ok: false, reason: "invalid", fields: { quantity: "out-of-range" } };
  }

  /* ═══ AND THE QUEUE IS NOT JOINED BY SOMEBODY WHO CANNOT BE SERVED ═════
   *
   * Every checkout that reaches `placeOrder` waits its turn on this night's
   * row, and that queue is strictly serial: on a real server it measured
   * ~60ms per buyer, so three hundred buyers for twenty-five seats spent
   * twenty-four seconds queueing to be told, one at a time, that the room was
   * full — and the tail of that queue timed out waiting for a connection
   * before it ever got to ask.
   *
   * A room that is DEFINITIVELY full needs no lock to say so. The count above
   * arrived free with the night, and a buyer refused here never enters the
   * queue at all, which leaves it to the buyers who might actually get a seat.
   *
   * DELIBERATELY ONLY WHEN NOTHING IS LEFT — not `quantity > remaining`. This
   * number is from before the lock and a hold may lapse a moment later; the
   * narrower the condition, the fewer buyers are turned away by a count that
   * has since changed. Everyone else still goes through the lock, and the lock
   * still decides. */
  if (event.capacity - taken <= 0) {
    return { ok: false, reason: "sold_out", remaining: 0 };
  }

  /* AND THE ONE STEP THAT HAS TO BE INDIVISIBLE: is there still room, and if
     so — take it, for ten minutes. A hundred requests for the last ticket all
     arrive here and exactly one of them leaves with it. */
  let outcome;
  try {
    outcome = await timed("checkout.tx", () =>
      placeOrder(
        {
          eventId: event.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          emailKey,
          phoneKey,
          quantity,
          /* THE ONLY PLACE A TOTAL IS DECIDED. */
          totalAmount: event.ticketPrice * quantity,
          currency: event.currency,
          channel: options.channel ?? "web",
        },
        options.holdSeconds ?? CHECKOUT_HOLD_SECONDS,
      ),
    );
  } catch (error: unknown) {
    /* THE QUEUE WAS FULL — and nothing was written, which is the only reason
     * this may be turned into an answer rather than an error. `isDatabaseBusy`
     * covers exactly the failures that happen before or instead of a commit:
     * no connection was taken, or the statement was cancelled and its
     * transaction rolled back. NO RETRY HAPPENS HERE: placing an order is not
     * idempotent, and a retry this side of the buyer would be how somebody
     * ends up holding two sets of seats.
     *
     * Anything else — a connection that died mid-commit above all — stays an
     * error and is seen as one, because "it may or may not have worked" must
     * never be reported as "try again". */
    if (isDatabaseBusy(error)) return busy();
    throw error;
  }

  if (!outcome.ok) {
    if (outcome.reason === "unknown_event") return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "sold_out", remaining: outcome.remaining };
  }
  return { ok: true, order: outcome.order, event };
}

/* ── payment confirmed ──────────────────────────────────────────────────── */

export type ConfirmResult =
  /* The order is paid and these are its tickets. `minted` says whether this
     call is the one that created them — false means somebody (a retried
     webhook, a doubled click) got here first, which is not an error and must
     not be reported as one. */
  | {
      ok: true;
      order: Order;
      event: TicketingEvent;
      tickets: TicketWithToken[];
      minted: boolean;
    }
  | { ok: false; reason: "unknown-order" | "unknown-event" | "not-payable" };

/* ═════ THE SEAM ═══════════════════════════════════════════════════════════
 *
 * PAYSPOT WILL CALL THIS. So will anything else that ever takes money. It is
 * the only way an order becomes paid and the only way a ticket comes into
 * existence, and it makes no assumption whatsoever about who is calling.
 *
 * IT IS IDEMPOTENT, and it has to be: payment providers retry webhooks, and a
 * retried confirmation that minted a second set of tickets would put two
 * strangers at the door with the same right to one seat. The atomic
 * pending → paid claim in the store decides which call is the real one; every
 * other call finds the tickets already there and returns them unchanged. The
 * UNIQUE (order_id, seq) index behind `issueTickets` is the second lock, and
 * the single row in `ticket_deliveries` is the third — so a webhook sent five
 * times produces one payment, one set of tickets and one email.
 *
 * `origin` is only used to build the URLs handed to delivery. A webhook has no
 * request to read a host from, which is why TICKETING_PUBLIC_ORIGIN exists. */
export async function confirmPayment(
  orderId: string,
  evidence: { provider: string; reference?: string },
  origin: string,
): Promise<ConfirmResult> {
  const claim = await claimPayment(orderId, evidence);
  if (!claim.order) return { ok: false, reason: "unknown-order" };

  const order = claim.order;
  const event = await findTicketingEvent(order.eventId, devMode());
  if (!event) return { ok: false, reason: "unknown-event" };

  /* Somebody else claimed it first — or it is refunded or failed and cannot
     become paid. The first of those is normal; the second is not payable. */
  if (!claim.claimed && order.paymentStatus !== "paid") {
    return { ok: false, reason: "not-payable" };
  }

  /* One ticket per admission. The store refuses to mint twice for the same
     order, so this is safe even if two confirmations somehow both got past the
     claim above. */
  const tickets = await issueTickets(order);

  if (claim.claimed) {
    /* Delivery is deliberately not awaited: a mail service having a bad
       morning must never be the reason a paying guest has no ticket, and a
       webhook that waits for one is a webhook the provider times out and
       retries. The tickets exist and are reachable the moment this returns.
       Sending is itself claimed atomically, so this is safe to call more than
       once. See lib/ticketing/delivery.ts.
       SCHEDULED WITH `after`, not left floating: on Vercel the instance may be
       frozen the moment this response is flushed, and a promise nobody is
       waiting on is exactly what gets lost. See lib/after-response.ts. */
    afterResponse(() =>
      deliverTickets(buildDelivery(order, event, tickets, origin)),
    );
  }

  return { ok: true, order, event, tickets, minted: claim.claimed };
}

/* The other direction: money went back, so the tickets stop working.
   A ticket somebody already came in on stays used — see the store. */
export async function refundOrder(orderId: string) {
  const order = await setOrderStatus(orderId, "refunded");
  if (!order) return { ok: false as const };
  const cancelled = await cancelTicketsForOrder(orderId);
  return { ok: true as const, order, cancelled };
}

/* ═════ WHERE A PROVIDER'S WEBHOOK LANDS ═══════════════════════════════════
 *
 * The whole of a payment webhook handler, once there is one to handle:
 *
 *   const verdict = await provider.verifyPayment({ rawBody, headers });
 *   const result  = await handlePaymentConfirmation(provider, verdict, origin);
 *
 * `verifyPayment` is the security boundary and belongs to the provider,
 * because only the provider knows what its signature is over. Everything after
 * it is the same for everybody, which is why it lives here.
 *
 * NOTE WHAT IS NOT AN ARGUMENT: the amount, the buyer, the quantity. None of
 * them are taken from the notice. The order was written on this server before
 * the buyer ever saw a payment page, and it is the order that says what was
 * bought. All a verdict has to establish is WHICH order, and that the money is
 * really in — including, in `verifyPayment`, that the amount the provider is
 * reporting is the amount this server asked for. */
export async function handlePaymentConfirmation(
  provider: PaymentProvider,
  verdict: PaymentVerdict,
  origin: string,
): Promise<ConfirmResult | { ok: false; reason: "rejected" }> {
  if (!verdict.ok) {
    /* The reason goes to the log and no further. What a caller is told is
       that it was not accepted. */
    console.warn(`[ticketing] payment notice rejected: ${verdict.reason}`);
    return { ok: false, reason: "rejected" };
  }
  return confirmPayment(
    verdict.orderId,
    { provider: provider.id, reference: verdict.reference },
    origin,
  );
}

/* Kept only so that the shape above reads as one piece; a route handler that
   has a notice and a provider can go straight through both steps. */
export async function verifyAndConfirm(
  provider: PaymentProvider,
  notice: ProviderNotice,
  origin: string,
) {
  return handlePaymentConfirmation(
    provider,
    await provider.verifyPayment(notice),
    origin,
  );
}
