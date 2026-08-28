import type { TicketingEvent } from "@/lib/ticketing/events";
import type { Order } from "@/lib/ticketing/types";

/* THE BOUNDARY BETWEEN THIS SYSTEM AND WHOEVER TAKES THE MONEY.
 *
 * Nothing above this file knows the name of a payment provider. The purchase
 * route asks for `createPayment` and sends the buyer wherever it is told; the
 * webhook route asks for `verifyPayment` and, if the answer is yes, calls
 * `confirmPayment` — which is where tickets are minted, and which has never
 * heard of PaySpot, Stripe or anybody else.
 *
 * That separation is the whole point of this file. A payment provider is a
 * thing a club changes: rates move, a bank drops a partner, a provider stops
 * supporting a currency. When that happens, what must not have to change is
 * how a ticket is minted, what a QR contains, or how the door decides who gets
 * in. So the provider is a small object with two methods, and everything that
 * matters lives on this side of it.
 *
 * ═══ TWO RULES THAT ARE NOT NEGOTIABLE ════════════════════════════════════
 *
 * 1. THE BROWSER NEVER CONFIRMS A PAYMENT. A buyer coming back from a payment
 *    page is a buyer coming back from a payment page — it means they finished
 *    looking at it, and nothing more. Anybody can visit a return URL. An order
 *    becomes paid because the provider told the SERVER so, over a channel the
 *    server can authenticate, and for no other reason.
 *
 * 2. `verifyPayment` MUST ACTUALLY VERIFY. Signature, or a call back to the
 *    provider's own API asking what the status of that payment is, or both. A
 *    webhook body is a piece of text somebody posted to a public URL; it is
 *    evidence of nothing until it has been checked. The interface is shaped so
 *    that this cannot be skipped: the confirmation path takes a verdict, and
 *    only the provider can produce one.
 *
 * ═══ WHERE PAYSPOT GOES ═══════════════════════════════════════════════════
 *
 * lib/ticketing/payments/payspot.ts, which today is a documented refusal and
 * contains no invented endpoints, no guessed parameter names and no imaginary
 * signature scheme. When the credentials and the integration document arrive,
 * that file is filled in against them, `paymentProviders` below learns its
 * name, and nothing else in the project is touched. */

/* Everything a provider needs in order to put a payment page in front of a
   buyer. Assembled on the server; no part of it is taken from the browser. */
export type PaymentIntent = {
  order: Order;
  event: TicketingEvent;
  /* Whole dinars — the order's own total, recomputed from the event's price,
     never a number that arrived in a request. */
  amount: number;
  currency: "RSD";
  /* Where the provider should send the buyer when they are finished. It shows
     them what happened; it does not decide it. See rule 1. */
  returnUrl: string;
  /* And where to send them if they abandon it. */
  cancelUrl: string;
};

/* Where to send the buyer next, or null when nobody can take the money — the
   state this project is in today. Null is not an error and must never be shown
   as one. */
export type PaymentHandoff = { redirectUrl: string } | null;

/* What arrived, unexamined. The raw body is kept as text on purpose: a
   signature is over bytes, and a body that has been through JSON.parse and
   back is not the same bytes. */
export type ProviderNotice = {
  rawBody: string;
  headers: Headers;
};

/* The only thing that may cause an order to be paid.
 *
 *   ok: true  — this notice is authentic, and it is about `orderId`. The
 *               reference is the provider's own id for the payment, kept on
 *               the order so a reconciliation has something to match on.
 *   ok: false — it is not authentic, it is about nothing we know, or the
 *               payment did not succeed. The reason is for the log; it is
 *               never shown to anybody. */
export type PaymentVerdict =
  | { ok: true; orderId: string; reference?: string }
  | { ok: false; reason: string };

export type PaymentProvider = {
  /* Stored on the order, so the club can always see who took the money. */
  id: string;
  /* Put a payment page in front of the buyer. */
  createPayment: (intent: PaymentIntent) => Promise<PaymentHandoff>;
  /* Decide whether a notice is really from the provider and really means the
     money is in. THIS IS THE SECURITY BOUNDARY — see rule 2. */
  verifyPayment: (notice: ProviderNotice) => Promise<PaymentVerdict>;
};

/* ── which provider is carrying the money today ─────────────────────────── */

/* Nobody is. `createPayment` returning null is the truthful description of a
   club that has not signed with a provider yet: the purchase panel collects a
   valid order, finds nowhere to send the buyer, and comes back to rest without
   inventing a payment, an order number or a ticket. */
export const noProvider: PaymentProvider = {
  id: "none",
  async createPayment() {
    return null;
  },
  async verifyPayment() {
    return { ok: false, reason: "no payment provider is configured" };
  },
};

/* The one in use.
 *
 * Deliberately a function rather than a constant: it is asked at the moment of
 * use, so nothing can be captured at import time and carried past a change of
 * environment. The dev provider is loaded lazily and only when dev mode is
 * open — a production build never reaches for it. */
export async function activePaymentProvider(
  devMode: boolean,
): Promise<PaymentProvider> {
  if (devMode) {
    const { devPaymentProvider } = await import("@/lib/ticketing/payments/dev");
    return devPaymentProvider;
  }
  /* ── PAYSPOT GOES HERE ──────────────────────────────────────────────────
     When payspot.ts is real and its credentials are in the environment, these
     five lines are the whole of the change to this file:

       const { payspotConfigured, payspotProvider } = await import(
         "@/lib/ticketing/payments/payspot"
       );
       if (payspotConfigured()) return payspotProvider;

     Note the order: DEV MODE IS CHECKED FIRST, above, so a development machine
     with real credentials in its environment still uses the simulated
     provider and cannot accidentally charge anybody's card while somebody is
     testing the door.

     Until then the honest answer is that nobody takes money. */
  return noProvider;
}
