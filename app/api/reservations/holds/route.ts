import { NextResponse, type NextRequest } from "next/server";
import { acquireHold, getHoldStatus, releaseHold } from "@/lib/reservations/holds";
import { sourceOf, takeHold } from "@/lib/reservations/rate-limit";
import {
  HOLD_COOKIE,
  HOLD_COOKIE_OPTIONS,
  isSessionToken,
  newSessionToken,
} from "@/lib/reservations/session";

/* Where a table is held for three minutes, and where the guest's session is
 * handed out.
 *
 * This handler does no thinking of its own, exactly as the reservation handler
 * above it does none: it reads the request, hands it to the rules in
 * lib/reservations/holds.ts and turns the answer into a status code.
 *
 * THE ONE THING IT OWNS is the cookie. A guest arrives with no session, POSTs
 * for a table, and leaves with both the hold and the httpOnly token that says
 * the hold is theirs — set here, on the way out, because this is the first
 * request that ever needs one. Everything afterwards, including the final
 * reservation, reads it back off the request.
 *
 * WHAT NEVER CROSSES THE WIRE: the token itself (the browser cannot read its
 * own cookie and does not need to), and anything at all about who is holding a
 * table somebody else asked for. A refusal is one word. */

export const runtime = "nodejs";
/* The answer is a clock reading. Nothing here may be cached, by anyone. */
export const dynamic = "force-dynamic";

/* The session on the request, or nothing — a malformed one is treated as
   nothing rather than argued with. */
function sessionOf(request: NextRequest) {
  const raw = request.cookies.get(HOLD_COOKIE)?.value;
  return isSessionToken(raw) ? raw : undefined;
}

const NO_STORE = { "cache-control": "no-store" };

/* ── take a table ───────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  /* THE BRAKE, BEFORE ANYTHING IS TAKEN.
   *
   * A hold costs nothing to ask for, needs no name and is issued to a fresh
   * session — so without this, a script sending cookie-less requests can hold
   * every table on the floor and keep holding them. The unique index protects a
   * table from being taken twice; only this stops it being taken pointlessly.
   * Generous enough that no real guest, and no carrier NAT, will meet it — see
   * lib/reservations/rate-limit.ts. */
  const brake = takeHold(sourceOf(request.headers));
  if (!brake.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(brake.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const { eventId, seatId } = (body ?? {}) as { eventId?: unknown; seatId?: unknown };
  if (typeof eventId !== "string" || typeof seatId !== "string") {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  /* An existing session keeps its token — that is what makes a refresh
     continue the same three minutes instead of starting new ones. */
  const existing = sessionOf(request);
  const token = existing ?? newSessionToken();

  const result = await acquireHold({ eventId, seatId, token });

  const response = result.ok
    ? NextResponse.json({ ok: true, hold: result.hold }, { status: 201, headers: NO_STORE })
    : NextResponse.json(
        { ok: false, reason: result.reason },
        {
          /* Held by somebody else and already booked are both "not yours to
             take", which is a conflict; a night that is not selling tables at
             all is gone. */
          status: result.reason === "unavailable" ? 410 : 409,
          headers: NO_STORE,
        },
      );

  /* Set even when the hold was refused: the guest will try another table in a
     second, and doing it now means that attempt is already recognised. */
  if (!existing) response.cookies.set(HOLD_COOKIE, token, HOLD_COOKIE_OPTIONS);
  return response;
}

/* ── how long is left ───────────────────────────────────────────────────── */

/* Asked on the way back from a refresh, and by nothing else — the countdown
   itself is drawn locally from `expiresAt` and does not poll. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const eventId = params.get("eventId");
  const seatId = params.get("seatId");
  const token = sessionOf(request);

  if (!eventId || !seatId) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  /* No session is not an error — it is a guest who holds nothing. */
  const hold = token ? await getHoldStatus({ eventId, seatId, token }) : undefined;

  return NextResponse.json(
    { ok: true, hold: hold ?? null },
    { status: 200, headers: NO_STORE },
  );
}

/* ── hand it back early ─────────────────────────────────────────────────── */

/* A courtesy, and never load-bearing: a guest who closes the tab, loses
   signal or force-quits the browser releases nothing, and the hold expires on
   its own. Nothing in the system waits for this or behaves differently when it
   does not arrive — which is why it answers the same way regardless. */
export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const eventId = params.get("eventId");
  const seatId = params.get("seatId");
  const token = sessionOf(request);

  if (eventId && seatId && token) {
    await releaseHold({ eventId, seatId, token });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
