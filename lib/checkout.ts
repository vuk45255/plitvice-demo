/* The seam where money will change hands.
 *
 * The purchase panel in front of this is finished: quantity, summary, buyer
 * details, validation and the call to action all behave exactly as they will in
 * production. `startCheckout` is the one thing behind it that is not wired yet.
 * It returns null, and the panel treats null as "nothing to travel to" — it
 * simply comes back to rest. Nothing is faked: no order is created, no success
 * is announced, no ticket or QR is minted.
 *
 * Connecting a provider — PaySpot PayByLink is the one under discussion — is
 * this file and a route handler, and nothing else:
 *
 *   1. `startCheckout` POSTs the order to `app/api/checkout/route.ts`, which
 *      creates the order server-side, signs the request with the merchant
 *      secret and answers with the provider's payment URL. The secret never
 *      reaches the browser.
 *   2. Returning that URL is all this function has to do — the panel already
 *      redirects to whatever comes back.
 *   3. The provider returns the buyer to `/rezervacija/potvrda?order=…`, a page
 *      that reads the order, never the payment.
 *   4. The provider's webhook is what marks the order paid, mints a ticket id
 *      per seat, renders the QR and mails it out.
 *   5. The door scans that QR against the same order store and marks it used.
 *
 * Until step 1 exists, the button validates, collects and goes nowhere. */

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
  void order;
  return null;
}
