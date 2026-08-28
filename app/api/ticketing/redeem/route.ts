import { NextResponse } from "next/server";
import { currentDoorEvent } from "@/lib/staff/door";
import { staffFor } from "@/lib/staff/guard";
import { validateAndRedeemTicket } from "@/lib/ticketing/redeem";
import { sourceOf } from "@/lib/ticketing/rate-limit";

/* THE DOOR'S ONE ENDPOINT.
 *
 * A scanned code and a hand-typed reference both arrive here and go through
 * the same function, because two ways in would eventually mean two answers to
 * whether somebody may come in, and one of them would be wrong. The manual box
 * on the scanner is a convenience for a cracked screen — it is not a second,
 * looser path.
 *
 * IT DECIDES AND MARKS IN ONE CALL. There is no "check this ticket" endpoint
 * to pair with a "mark it used" one, and there must never be: two doormen
 * holding two phones at the same code would both be told it was valid before
 * either marked it. See lib/ticketing/redeem.ts.
 *
 * THE NIGHT IS NOT IN THE REQUEST. It is read here, on the server, off the
 * door's own setting — so a phone cannot decide that the ticket in front of it
 * happens to be for tonight.
 *
 * WHAT COMES BACK is a verdict, the ticket's own reference, the night and a
 * time. No name, no email, no telephone number, no price. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  /* Who is at the door. Checked here as well as on the page: a page that is
     not rendered is not the same thing as an endpoint that refuses. */
  const staff = await staffFor("scanner");
  if (!staff) {
    return NextResponse.json({ outcome: "unauthorized" }, { status: 401 });
  }

  /* Which night. A door with none set does not scan — refusing is the safe
     direction, and it is a 409 rather than a verdict because it is not a
     statement about anybody's ticket. */
  const event = await currentDoorEvent();
  if (!event) {
    return NextResponse.json({ outcome: "no-event" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ outcome: "invalid" }, { status: 200 });
  }

  const input = body as { scanned?: unknown; typed?: unknown };
  const result = await validateAndRedeemTicket(
    {
      scanned: typeof input.scanned === "string" ? input.scanned.slice(0, 512) : undefined,
      typed: typeof input.typed === "string" ? input.typed.slice(0, 64) : undefined,
    },
    {
      source: sourceOf(request.headers),
      door: staff.door,
      staff: staff.name,
      eventId: event.id,
    },
  );

  /* Every outcome is a 200 with a verdict in it, including the refusals.
     A doorman's phone in a basement gets one chance at each request, and an
     interface that has to tell an HTTP error apart from a rejected ticket is
     an interface that will one day show the wrong colour. The only non-200s
     above are "you are not staff" and "this door has no night", neither of
     which is a verdict about a ticket.
     Rate limiting keeps its 429 semantics in the header for anything
     automated that ever calls this. */
  const headers =
    result.outcome === "rate_limited" && result.retryAfterSeconds
      ? { "Retry-After": String(result.retryAfterSeconds) }
      : undefined;

  return NextResponse.json(result, { status: 200, headers });
}
