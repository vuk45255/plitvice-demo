import { NextResponse } from "next/server";
import { devMode } from "@/lib/ticketing/config";
import { verifyAndConfirm } from "@/lib/ticketing/orders";
import { originOf } from "@/lib/ticketing/origin";
import { findOrderByReference } from "@/lib/ticketing/store";

/* THE SIMULATED PAYMENT NOTICE — DEVELOPMENT ONLY.
 *
 * This is what PaySpot's webhook route will be, standing in for it until there
 * is one: a POST from outside, carrying nothing but an order id, that causes
 * the order to be paid and its tickets to be minted. It deliberately goes
 * through the same two steps a real one will — `verifyPayment`, then
 * `confirmPayment` — rather than reaching into the store itself, so that the
 * path being exercised in development is the path that will run in production.
 *
 * ═══ IT CANNOT BECOME A PRODUCTION BYPASS ═════════════════════════════════
 *
 * The first line of the handler refuses with a 404 when dev mode is shut, and
 * `devMode()` is false in every production build whatever the environment says
 * — see lib/ticketing/config.ts. The provider behind it refuses independently,
 * and is not even bundled in production. Three locks; this is the outermost.
 *
 * A 404 rather than a 403, because a route that answers "forbidden" has told
 * you it exists. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!devMode()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: { order?: unknown };
  try {
    body = (await request.json()) as { order?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  /* What arrives is the order's public reference — the same handle a provider
     would have been given. The internal id is looked up here and never
     travels. */
  const reference = typeof body.order === "string" ? body.order : "";
  const order = await findOrderByReference(reference);
  if (!order) return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 });

  const { devPaymentProvider } = await import("@/lib/ticketing/payments/dev");

  const result = await verifyAndConfirm(
    devPaymentProvider,
    /* Shaped exactly like a real notice: a raw body and headers, because a
       real signature is over raw bytes. */
    { rawBody: JSON.stringify({ orderId: order.id }), headers: request.headers },
    originOf(request),
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    order: result.order.reference,
    /* Whether this call is the one that minted them. A second press of the
       button is not an error and does not mint a second set. */
    minted: result.minted,
    tickets: result.tickets.length,
  });
}
