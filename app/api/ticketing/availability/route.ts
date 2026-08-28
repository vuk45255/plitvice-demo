import { NextResponse, type NextRequest } from "next/server";
import { devMode } from "@/lib/ticketing/config";
import { findTicketingEvent, remainingForOrder, saleState } from "@/lib/ticketing/events";
import { countsFor } from "@/lib/ticketing/store";

/* HOW MANY ARE LEFT, as it stands this second.
 *
 * What a purchase panel asks before it lets somebody choose a quantity, and
 * what the load-test script asks the server afterwards to find out whether the
 * room was oversold. It is a read and it decides nothing: the only thing that
 * can refuse a purchase is the transaction in `placeOrder`, and a number from
 * here is out of date the moment it is sent.
 *
 * ═══ WHAT IS PUBLIC AND WHAT IS NOT ═══════════════════════════════════════
 *
 * Public: the price, the house limit, whether the night is selling, and how
 * many admissions are left. All four are things a guest is about to be shown
 * anyway.
 *
 * NOT public: how that number breaks down. "Paid 312, held 14" tells a
 * competitor what the club took last Saturday and tells a tout exactly when to
 * refresh. It is returned only in dev mode, where the load test reads it. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("event");
  if (!slug) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const event = await findTicketingEvent(slug, devMode());
  if (!event) {
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 404 });
  }

  const counts = await countsFor(event.id);
  const state = saleState(event, counts.taken);

  return NextResponse.json(
    {
      ok: true,
      event: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      ticketPrice: event.ticketPrice,
      currency: event.currency,
      open: state.open,
      reason: state.open ? null : state.reason,
      /* The most one order may hold right now: the house rule, capped by what
         is actually left. Zero means the night is full. */
      maxPerOrder: remainingForOrder(event, counts.taken),
      available: counts.available,
      ...(devMode()
        ? {
            capacity: counts.capacity,
            taken: counts.taken,
            paid: counts.paid,
            held: counts.held,
            entered: counts.entered,
          }
        : {}),
    },
    /* A count that changes every second, and one that must not be shared
       between two guests by anything in front of the server. */
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
