import { NextResponse, type NextRequest } from "next/server";
import { floorState } from "@/lib/reservations/admin";
import { staffFor } from "@/lib/staff/guard";

/* THE FLOOR, FOR THE OFFICE, EVERY FEW SECONDS.
 *
 * The admin map polls this. It is the same three states the guest's map has —
 * available, held, reserved — but with what staff need behind them: whose
 * table it is, what number to ring, and when a hold runs out.
 *
 * ═══ WHY IT IS A SEPARATE ROUTE FROM THE PUBLIC ONE ═══════════════════════
 *
 * /api/reservations/availability answers the guest's map and deliberately says
 * NOTHING about who holds what — a guest learns that a table cannot be had and
 * not one thing about the person holding it. This one carries names and
 * telephone numbers, so it is behind the staff session and says so in its
 * cache headers. Two audiences, two endpoints; one shared `floorState`, so
 * they cannot come to disagree about what is free.
 *
 * IT CHECKS THE SESSION ITSELF. The page that draws the map checks too, and
 * that is not redundancy: a page that is not rendered is not the same thing as
 * an endpoint that refuses. A route handler is reachable by anybody who knows
 * the path.
 *
 * ADMIN, NOT SCANNER. A doorman's phone gets a camera and a verdict; it does
 * not get the guest list. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await staffFor("admin");
  if (!staff) {
    /* No hint about whether the endpoint exists or what it would have said. */
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("event");
  if (!eventId) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const state = await floorState(eventId);

  return NextResponse.json(
    { ok: true, ...state },
    /* Names and numbers, and a clock reading. Never cached, never shared, not
       by the browser and not by anything in front of the server. */
    { status: 200, headers: { "cache-control": "no-store, private" } },
  );
}
