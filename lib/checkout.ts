/* The seam where money will change hands.
 *
 * The purchase panel in front of this is finished: quantity, summary, buyer
 * details, validation and the call to action all behave exactly as they will in
 * production. This is the one step between it and the ticketing system.
 *
 * WHAT HAPPENS NOW. `startCheckout` posts the order to
 * app/api/ticketing/checkout/route.ts, which creates a real, PENDING order on
 * the server — the price and the total worked out there from the club's own
 * data, never from anything the browser said — and asks whichever payment
 * provider is configured to put a payment page in front of the buyer. It
 * answers with a URL to travel to, or with null.
 *
 * NULL IS THE TRUTHFUL STATE OF A CLUB THAT HAS NOT SIGNED WITH A PROVIDER.
 * No provider answers today, so the button validates, collects, creates the
 * order and finds nowhere to go — and the panel treats null as "nothing to
 * travel to" and comes back to rest. Nothing is faked: no success is
 * announced, no ticket or QR is minted, and the order sits pending, which is
 * exactly what it is.
 *
 * WHERE THE REST OF IT LIVES. Everything after the payment page is already
 * built and does not run through this file:
 *
 *   lib/ticketing/payments/provider.ts  the boundary — PAYSPOT CONNECTS HERE
 *   lib/ticketing/orders.ts             confirmPayment: the only door into
 *                                       minting a ticket, called by a webhook
 *   lib/ticketing/store.ts              orders, tickets, and the three writes
 *                                       that must stay indivisible
 *   /t/<token>                          the ticket itself, with its QR
 *   /scanner                            the door
 *
 * So connecting PaySpot does not come back through here at all. This file
 * already does its whole job. */

export type TicketOrder = {
  eventSlug: string;
  items: { typeId: string; quantity: number }[];
  buyer: { name: string; email: string; phone: string };
};

export type Checkout = { redirectUrl: string };

/* Returns the URL to send the buyer to, or null while no provider answers.
   Null is not an error and must never be shown as one. */
export async function startCheckout(
  order: TicketOrder,
): Promise<Checkout | null> {
  /* One night currently sells one thing — entry — so an order is a quantity.
     The day the club introduces named types (packages, early birds), the
     order grows lines and this stops summing them; see the note on
     `ticketTypes` in lib/events.ts. Until then the sum IS the quantity, and
     the price is the event's own, read on the server. */
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  try {
    const response = await fetch("/api/ticketing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventSlug: order.eventSlug,
        quantity,
        buyer: order.buyer,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { redirectUrl?: string | null };
    return data.redirectUrl ? { redirectUrl: data.redirectUrl } : null;
  } catch {
    /* A network that is not there is not a payment that failed. The panel
       comes back to rest and the guest may try again. */
    return null;
  }
}
