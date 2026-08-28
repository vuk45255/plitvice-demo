import type { PaymentProvider } from "@/lib/ticketing/payments/provider";

/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PAYSPOT CONNECTS HERE — AND ONLY HERE.                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * This file is empty on purpose.
 *
 * We do not have PaySpot's integration document, their endpoints, their
 * parameter names, their signature scheme or their credentials. Writing code
 * against a guess at any of those would be worse than writing none: it would
 * look finished, it would be wrong in ways nobody could see, and somebody
 * would eventually have to work out which parts were real. So there are no
 * invented URLs below, no imagined field names and no placeholder secrets —
 * only the two functions PaySpot has to end up implementing, and the notes on
 * what must be true of them whatever their API turns out to look like.
 *
 * EVERYTHING ELSE IS FINISHED AND RUNNING. Orders, the ten-minute checkout
 * hold, the capacity guarantee, minting, QR codes, the ticket pages, the door,
 * the scanner, the admin screens and the delivery seam are all built, tested
 * and exercised end to end by the simulated provider in ./dev.ts. What is
 * missing is one thing: somebody who takes money.
 *
 * ═══ THE FIVE STEPS, WHEN THE DOCUMENTATION ARRIVES ═══════════════════════
 *
 * 1. FILL IN `createPayment` BELOW. It is given a `PaymentIntent` — the order,
 *    the event, the amount this server calculated, and a return and cancel
 *    URL — and must answer with the URL to send the buyer to. Give PaySpot the
 *    ORDER'S REFERENCE (random, opaque) as its own reference for the payment,
 *    never the internal id.
 *
 * 2. FILL IN `verifyPayment`. It is given the RAW BODY and the headers of a
 *    notice, and must answer `{ ok: true, orderId }` or `{ ok: false, reason }`.
 *    This is the security boundary; see the four rules below.
 *
 * 3. MAKE `payspotConfigured()` TRUE when the credentials are present, and
 *    switch the registry on in ./provider.ts — the four lines are written out
 *    in a comment there.
 *
 * 4. ADD THE WEBHOOK ROUTE. Its entire body is:
 *
 *      export const runtime = "nodejs";
 *      export const dynamic = "force-dynamic";
 *
 *      export async function POST(request: Request) {
 *        const rawBody = await request.text();
 *        const result  = await verifyAndConfirm(
 *          payspotProvider,
 *          { rawBody, headers: request.headers },
 *          publicOrigin() ?? new URL(request.url).origin,
 *        );
 *        return NextResponse.json({ ok: result.ok }, { status: 200 });
 *      }
 *
 *    `verifyAndConfirm` is in lib/ticketing/orders.ts. ANSWER 200 EVEN WHEN
 *    THE ORDER IS UNKNOWN — a non-200 makes a provider retry for ever, and a
 *    notice we cannot place is not a notice worth retrying.
 *
 * 5. SET THE ENVIRONMENT: the credentials (SERVER-SIDE ONLY — never
 *    NEXT_PUBLIC_*; a merchant secret in a browser bundle is a merchant secret
 *    that has been published) and TICKETING_PUBLIC_ORIGIN, which is how the
 *    webhook knows what hostname to put in the ticket links it has no request
 *    to read one from.
 *
 * NOTHING ELSE IN THIS PROJECT CHANGES. Not the order model, not the ticket
 * model, not the QR, not the ticket page, not the scanner, not the admin.
 *
 * ═══ FOUR THINGS THAT MUST BE TRUE, WHATEVER THEIR API LOOKS LIKE ═════════
 *
 * 1. THE AMOUNT IS OURS, NOT THEIRS. `createPayment` sends the total that this
 *    server calculated from the event's own price. When the confirmation comes
 *    back, CHECK THAT THE AMOUNT AND CURRENCY PAYSPOT REPORTS MATCH THE ORDER
 *    WE WROTE — and refuse if they do not. A payment for one dinar against an
 *    order for six thousand is the oldest trick there is. The order is
 *    reachable inside `verifyPayment` through `findOrder`.
 *
 * 2. VERIFY, DO NOT BELIEVE. A webhook body is a piece of text somebody posted
 *    to a public URL. Check their signature over the RAW BYTES (which is why
 *    `ProviderNotice` carries `rawBody` as text and not as parsed JSON — a
 *    body that has been through JSON.parse and back is not the same bytes), or
 *    call their API and ask what the status of that payment is, or both.
 *
 * 3. THE RETURN URL IS NOT A CONFIRMATION. The buyer coming back to our site
 *    means they finished looking at a payment page. Anybody can visit that
 *    URL. Only the server-to-server notice may mark an order paid, and the
 *    return page (/karte/<reference>) already says "not confirmed yet" without
 *    pretending otherwise.
 *
 * 4. THEY WILL SEND IT TWICE. Retried webhooks are normal. `confirmPayment` is
 *    idempotent — an atomic pending → paid claim, a UNIQUE (order_id, seq) on
 *    minting, and one row per order in `ticket_deliveries` — so five identical
 *    notices produce one payment, one set of tickets and one email. DO NOT ADD
 *    A SECOND LAYER OF CLEVERNESS HERE.
 *
 * ═══ AND ONE ABOUT TIME ═══════════════════════════════════════════════════
 *
 * A pending order holds its admissions for TEN MINUTES and then lets them go.
 * If PaySpot's flow can take longer than that — a bank transfer, a code sent
 * by message, anything asynchronous — say so and the number changes in one
 * place (`CHECKOUT_HOLD_SECONDS` in lib/ticketing/store.ts).
 *
 * A payment that arrives after the hold has lapsed is still honoured: the room
 * is re-counted, the tickets are minted, and if the night has filled behind
 * that order it is flagged `oversold` for the club to see on the admin screen.
 * Money that has arrived is never quietly refused. */

export function payspotConfigured(): boolean {
  /* When the credentials exist, this is where their presence is checked —
     something on the order of a merchant id and a secret, read from the
     server-side environment. Until then, no. */
  return false;
}

export const payspotProvider: PaymentProvider = {
  id: "payspot",

  async createPayment() {
    throw new Error(
      "PaySpot is not integrated yet. See lib/ticketing/payments/payspot.ts.",
    );
  },

  async verifyPayment() {
    return {
      ok: false,
      reason: "PaySpot is not integrated yet — no notice can be verified",
    };
  },
};
