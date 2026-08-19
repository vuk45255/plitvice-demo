import { NextResponse } from "next/server";
import { sourceOf } from "@/lib/reservations/rate-limit";
import { requestReservation } from "@/lib/reservations/service";

/* Where a table is actually asked for.
 *
 * This handler does no thinking of its own. It reads the request, hands it to
 * the rules in lib/reservations/service.ts and turns the answer into a status
 * code — because the rules have to be the same whatever asks them, and the day
 * the club has an admin screen or the site has a second entry point, neither
 * gets its own opinion about who may hold a table.
 *
 * The guest is told what happened in words the panel chooses; what crosses the
 * wire is a reason, not a sentence. Nothing about how the duplicate check
 * works, how fast the brake is or what is already booked is described in a
 * refusal — a refusal says only which of a handful of doors was closed. */

export const runtime = "nodejs";
/* The answer depends on what is already held, so nothing here may be cached. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const result = requestReservation(body, { source: sourceOf(request.headers) });

  if (result.ok) {
    /* The id is the guest's own handle on the booking — what a confirmation
       mail, a management link or the club's list will name. */
    return NextResponse.json(
      { ok: true, id: result.reservation.id, status: result.reservation.status },
      { status: 201 },
    );
  }

  switch (result.reason) {
    case "rate-limited":
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    /* Both of these are somebody else's booking standing in the way rather
       than anything wrong with this one. */
    case "seat-taken":
    case "duplicate":
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
    case "unavailable":
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 410 });
    default:
      return NextResponse.json(
        { ok: false, reason: "invalid", fields: result.fields },
        { status: 422 },
      );
  }
}
