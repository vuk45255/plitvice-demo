import { devMode } from "@/lib/ticketing/config";
import type {
  PaymentProvider,
  PaymentVerdict,
} from "@/lib/ticketing/payments/provider";

/* A payment page that takes no money.
 *
 * It exists so that the whole of the rest of the system can be exercised
 * end to end — an order, a hand-off, a confirmation arriving separately, a
 * ticket, a QR, a door — without a provider, a merchant account or a card. It
 * behaves like a real one in the one way that matters architecturally: IT
 * CONFIRMS OUT OF BAND. The buyer is sent to a page, and the order becomes
 * paid because something POSTs a confirmation to the server, not because the
 * buyer came back.
 *
 * ═══ WHY THIS CANNOT BECOME A PRODUCTION BYPASS ═══════════════════════════
 *
 * Three locks, and all three would have to fail together:
 *
 *   1. Every method here checks `devMode()` itself and refuses when it is
 *      shut. Not the caller — here, at the bottom, where it cannot be
 *      forgotten.
 *   2. `devMode()` is false in any production build whatever the environment
 *      says (see lib/ticketing/config.ts), so a stray TICKETING_DEV_MODE=true
 *      in a production environment does nothing at all.
 *   3. This module is only ever reached through a dynamic import that the
 *      provider registry makes only when dev mode is already open, so a
 *      production bundle does not contain it in the first place.
 *
 * The point of the third is that the first two are checks, and a check is
 * something somebody can edit. Not being there is stronger. */

const NOT_IN_PRODUCTION = "the development payment provider is not available";

export const devPaymentProvider: PaymentProvider = {
  id: "dev",

  /* Where a real provider would return its hosted payment page, this returns
     the club's own dev-only one: /dev/ticketing/placanje/<order reference>,
     which shows the order and has a single button on it. */
  async createPayment(intent) {
    if (!devMode()) throw new Error(NOT_IN_PRODUCTION);
    return {
      redirectUrl: `/dev/ticketing/placanje/${encodeURIComponent(intent.order.reference)}`,
    };
  },

  /* A real provider verifies a signature over the raw body, or calls its own
     API back to ask what the status of the payment is. This one verifies that
     the system is in development and that the body names an order — because
     there is no secret to sign with and pretending otherwise would be
     theatre. THE SHAPE IS REAL EVEN THOUGH THE CHECK IS NOT: a verdict is the
     only thing that can cause an order to be paid, and only a provider can
     produce one. */
  async verifyPayment(notice): Promise<PaymentVerdict> {
    if (!devMode()) return { ok: false, reason: NOT_IN_PRODUCTION };
    try {
      const body = JSON.parse(notice.rawBody) as { orderId?: unknown };
      if (typeof body.orderId !== "string" || !body.orderId) {
        return { ok: false, reason: "no order id in the notice" };
      }
      return { ok: true, orderId: body.orderId, reference: "dev-simulated" };
    } catch {
      return { ok: false, reason: "unreadable notice body" };
    }
  },
};
