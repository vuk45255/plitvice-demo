import { NextResponse } from "next/server";
import { devMode } from "@/lib/ticketing/config";
import { createOrder } from "@/lib/ticketing/orders";
import { originOf } from "@/lib/ticketing/origin";
import { activePaymentProvider } from "@/lib/ticketing/payments/provider";
import { takeCheckout, sourceOf } from "@/lib/ticketing/rate-limit";

/* Where an order is actually placed.
 *
 * This handler does no thinking of its own. It reads the request, hands it to
 * the rules in lib/ticketing/orders.ts, asks whichever provider is carrying
 * the money to put a payment page in front of the buyer, and turns the answer
 * into a status code. The rules have to be the same whatever asks them — the
 * day the club has an admin screen or a second entry point, neither gets its
 * own opinion about what a ticket costs or whether there is room.
 *
 * NOTHING HERE MARKS ANYTHING PAID. The order leaves this route pending, every
 * time, whoever is asking. Payment is confirmed out of band, by a provider
 * talking to the server — see confirmPayment in lib/ticketing/orders.ts. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const source = sourceOf(request.headers);
  /* THE PURCHASE BRAKE, not the door's. A pending order holds its admissions
     for ten minutes, so an address that may start 240 of them a minute is an
     address that can make a night look sold out without paying for anything.
     See lib/ticketing/rate-limit.ts. */
  const brake = takeCheckout(source);
  if (!brake.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(brake.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const result = await createOrder(body);

  if (!result.ok) {
    switch (result.reason) {
      /* ═══ THE QUEUE WAS FULL, AND NOTHING WAS WRITTEN ═════════════════
       *
       * 503 with a Retry-After, and a reason that says what actually
       * happened. This is the difference between a burst being handled and a
       * burst producing uncontrolled 500s: the server is not broken and the
       * night is not sold out — this instance's connection queue was full and
       * the request never got as far as asking about seats.
       *
       * IT IS NEVER `sold_out`. Reporting a full queue as a full room would
       * turn a moment's backpressure into a night the club appears to have
       * stopped selling, and the buyer would go elsewhere. */
      case "busy":
        return NextResponse.json(
          { ok: false, reason: "temporarily_busy" },
          {
            status: 503,
            headers: {
              "Retry-After": String(result.retryAfterSeconds),
              "cache-control": "no-store",
            },
          },
        );
      case "unavailable":
        return NextResponse.json({ ok: false, reason: result.reason }, { status: 410 });
      case "sold_out":
        return NextResponse.json(
          { ok: false, reason: result.reason, remaining: result.remaining },
          { status: 409 },
        );
      default:
        return NextResponse.json(
          { ok: false, reason: "invalid", fields: result.fields },
          { status: 422 },
        );
    }
  }

  const origin = originOf(request);
  const provider = await activePaymentProvider(devMode());
  const handoff = await provider.createPayment({
    order: result.order,
    event: result.event,
    amount: result.order.totalAmount,
    currency: result.order.currency,
    /* Where the buyer is shown what happened. It shows; it never decides. */
    returnUrl: `${origin}/karte/${encodeURIComponent(result.order.reference)}`,
    cancelUrl: `${origin}/rezervacija?event=${encodeURIComponent(result.event.slug)}`,
  });

  /* A null hand-off is the truthful state of a club that has not signed with a
     provider: the order is real and pending, and there is nowhere to send the
     buyer. The panel treats a missing redirect as "nothing to travel to" and
     comes back to rest — it must never be shown as an error. */
  return NextResponse.json(
    {
      ok: true,
      /* The order's own public handle, never the internal id. */
      order: result.order.reference,
      redirectUrl: handoff?.redirectUrl ?? null,
      /* THE TEN MINUTES, and the server's own clock beside it so a browser can
         draw a countdown from the difference rather than from its own idea of
         the time. THE COUNTDOWN IS A PICTURE. It has no authority over
         anything: the seats go back when this instant passes according to the
         database, whatever any phone is showing. */
      holdExpiresAt: result.order.holdExpiresAt,
      serverNow: new Date().toISOString(),
      quantity: result.order.quantity,
      totalAmount: result.order.totalAmount,
      currency: result.order.currency,
    },
    { status: 201 },
  );
}
