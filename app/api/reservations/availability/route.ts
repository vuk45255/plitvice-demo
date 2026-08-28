import { NextResponse, type NextRequest } from "next/server";
import { seatAvailability } from "@/lib/reservations/holds";
import { HOLD_COOKIE, isSessionToken } from "@/lib/reservations/session";

/* One night's floor, as it stands this second.
 *
 * WHAT THE MAP POLLS WHILE IT IS OPEN, every few seconds — see the note over
 * the poll in floor-plan-overlay.tsx for why it is seconds and not
 * milliseconds. It is a read, it is cheap, and it is the only reason a guest
 * looking at S12 sees it go dim when somebody across town commits to it.
 *
 * THREE LISTS, AND THE THIRD IS WHAT MAKES IT PERSONAL. `reserved` is gone for
 * good, `held` is somebody else's three minutes, and `mine` is this session's
 * own — which is the same table other people are seeing in `held`, and the
 * only reason it is not dimmed for the guest who has it. The split is made on
 * the server against a cookie the browser cannot read.
 *
 * NOTHING IN THE ANSWER IDENTIFIES ANYBODY. No tokens, no counts of who is
 * looking, no name against a table — a guest learns that a table cannot be had
 * this minute and nothing whatever about the person holding it. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const raw = request.cookies.get(HOLD_COOKIE)?.value;
  const token = isSessionToken(raw) ? raw : undefined;

  const availability = await seatAvailability({ eventId, token });

  return NextResponse.json(
    { ok: true, ...availability },
    /* A clock reading with somebody's own hold in it: never cached, never
       shared, not by the browser and not by anything in front of it. */
    { status: 200, headers: { "cache-control": "no-store, private" } },
  );
}
