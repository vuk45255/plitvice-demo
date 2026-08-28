"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorSnapshot } from "@/lib/floor-availability";

/* The three minutes, as the browser experiences them.
 *
 * NOTHING HERE DECIDES ANYTHING. The hold is taken, kept and lost on the
 * server; this is a picture of it. The countdown below is a number going down
 * on a screen, and if it were wrong — a laptop that slept, a clock twenty
 * minutes fast, a tab throttled in the background — the only consequence is
 * that the picture is wrong for a moment. What cannot be booked, cannot be
 * booked: the server checks its own clock against its own stored expiry every
 * single time, and a submit arriving one second late is refused however
 * confidently the page was still counting. See lib/reservations/holds.ts.
 *
 * WHY THE CLOCK IS NEVER COMPARED DIRECTLY. The server sends `expiresAt` and
 * `serverNow` together, and what is kept is the DIFFERENCE between them added
 * to the browser's own `Date.now()`. So a device set an hour fast still shows
 * three minutes, because no absolute time from one machine is ever measured
 * against the other's.
 *
 * WHY THE SECONDS TICK IN STATE AND NOT IN A REF. It is being read out to the
 * guest once a second; that is what state is for. It is one interval, only
 * while a hold is actually running, and it stops itself on expiry. */

/* What the page knows about its own hold. Both times are in the BROWSER's
   frame of reference, already corrected — see above. */
export type HeldSeat = {
  seatId: string;
  expiresAtMs: number;
  /* How long the whole hold was, so a progress line can be drawn without
     hard-coding a hundred and eighty anywhere in a component. */
  totalSeconds: number;
};

/* Why an attempt to take a table did not work. `seat-held` is the interesting
   one: somebody else got there first, by seconds. */
export type HoldFailure = "seat-held" | "seat-reserved" | "unavailable" | "failed";

export type AcquireResult = { ok: true } | { ok: false; reason: HoldFailure };

const HOLDS_URL = "/api/reservations/holds";

/* Server's remaining milliseconds, translated into this browser's clock. */
function localExpiry(expiresAt: string, serverNow: string) {
  return Date.now() + (Date.parse(expiresAt) - Date.parse(serverNow));
}

const secondsTo = (atMs: number) => Math.max(0, Math.ceil((atMs - Date.now()) / 1000));

export function useSeatHold(eventId: string) {
  const [held, setHeld] = useState<HeldSeat | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  /* Ran out while the guest was still on the form. Distinct from having no
     hold at all, because it is the one case that has something to say. */
  const [expired, setExpired] = useState(false);
  /* The moment between pressing IZABERI STO and the house answering. It is
     usually invisible and it is not allowed to be a spinner. */
  const [taking, setTaking] = useState(false);

  /* What the release call needs after the component has moved on. A ref
     because the release is fired from cleanups and event handlers that must
     not re-run every time a second ticks. */
  const holdRef = useRef<HeldSeat | null>(null);
  useEffect(() => {
    holdRef.current = held;
  }, [held]);

  /* ── the countdown ────────────────────────────────────────────────────── */

  /* The first reading is written down wherever a hold is taken up or handed
     back — `acquire`, `sync`, `release`, `forget` — so that this effect does
     nothing but run the clock. An effect that also set the opening value would
     be setting state during a render pass to say something already known. */
  useEffect(() => {
    if (!held) return;

    const tick = window.setInterval(() => {
      const left = secondsTo(held.expiresAtMs);
      setSecondsLeft(left);
      /* The visual end of the hold. The real one already happened on the
         server, at the same moment, without being told. */
      if (left <= 0) setExpired(true);
    }, 1000);

    return () => window.clearInterval(tick);
  }, [held]);

  /* A tab that was in the background had its interval throttled to something
     like once a minute, so the number on screen can be badly stale by the time
     the guest looks at it again. Catch up the instant they do. */
  useEffect(() => {
    const resync = () => {
      const current = holdRef.current;
      if (!current || document.visibilityState !== "visible") return;
      const left = secondsTo(current.expiresAtMs);
      setSecondsLeft(left);
      if (left <= 0) setExpired(true);
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, []);

  /* ── taking a table ───────────────────────────────────────────────────── */

  const acquire = useCallback(
    async (seatId: string): Promise<AcquireResult> => {
      setTaking(true);
      try {
        const response = await fetch(HOLDS_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          /* The session token is not in here and cannot be: it is an httpOnly
             cookie, which the browser attaches and the page cannot read. */
          body: JSON.stringify({ eventId, seatId }),
        });

        const body = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              reason?: HoldFailure;
              hold?: { expiresAt: string; serverNow: string; remainingSeconds: number };
            }
          | null;

        if (response.ok && body?.ok && body.hold) {
          setExpired(false);
          setSecondsLeft(body.hold.remainingSeconds);
          setHeld({
            seatId,
            expiresAtMs: localExpiry(body.hold.expiresAt, body.hold.serverNow),
            totalSeconds: body.hold.remainingSeconds,
          });
          return { ok: true };
        }

        const reason = body?.reason;
        return {
          ok: false,
          reason:
            reason === "seat-held" || reason === "seat-reserved" || reason === "unavailable"
              ? reason
              : "failed",
        };
      } catch {
        return { ok: false, reason: "failed" };
      } finally {
        setTaking(false);
      }
    },
    [eventId],
  );

  /* ── letting one go ───────────────────────────────────────────────────── */

  /* A courtesy and nothing more. A guest who presses NAZAD puts the table back
     for everybody else at once instead of in three minutes — but nothing waits
     on this, nothing checks whether it arrived, and a closed tab or a lost
     signal simply lets the hold expire on its own. `keepalive` so a release
     fired on the way out of the page still gets sent. */
  const release = useCallback(() => {
    const current = holdRef.current;
    setHeld(null);
    setExpired(false);
    setSecondsLeft(0);
    if (!current) return;

    const query = new URLSearchParams({ eventId, seatId: current.seatId });
    void fetch(`${HOLDS_URL}?${query}`, { method: "DELETE", keepalive: true }).catch(
      () => {},
    );
  }, [eventId]);

  /* Forget the hold without telling the house — for a hold that has just been
     spent on a reservation, or one the server has already taken back. */
  const forget = useCallback(() => {
    setHeld(null);
    setExpired(false);
    setSecondsLeft(0);
  }, []);

  /* ── the server's word, arriving on the poll ──────────────────────────── */

  /* THE AUTHORITATIVE CORRECTION. Every few seconds the floor plan asks what
     the room looks like and hands the answer here. Three things can happen:
     the hold is confirmed and its expiry re-synced against the server's clock;
     the guest turns out to hold a table this page did not know about, because
     they refreshed and the cookie outlived the React state; or the hold is
     gone from the server's list, which ends it here whatever the countdown on
     screen still said. */
  const sync = useCallback(
    (snapshot: FloorSnapshot & { serverNow?: string; holdExpiresAt?: string }) => {
      const mine = snapshot.mine[0];

      const standing = holdRef.current;

      if (!mine || !snapshot.holdExpiresAt || !snapshot.serverNow) {
        /* Nothing held on the server. If this page thought otherwise, it was
           the three minutes running out — and the server saying so is the
           only reading of that which counts. */
        if (standing) {
          setHeld(null);
          setSecondsLeft(0);
          setExpired(true);
        }
        return;
      }

      const expiresAtMs = localExpiry(snapshot.holdExpiresAt, snapshot.serverNow);
      if (standing && standing.seatId === mine && standing.expiresAtMs === expiresAtMs) {
        return;
      }

      setExpired(false);
      setSecondsLeft(secondsTo(expiresAtMs));
      setHeld({
        seatId: mine,
        /* NEVER RESET. This is whatever the server has left on the original
           hold — a refresh does not buy a second three minutes, and this is
           the line that would break that if it said anything else. */
        expiresAtMs,
        totalSeconds: standing?.totalSeconds ?? secondsTo(expiresAtMs),
      });
    },
    [],
  );

  return {
    held,
    secondsLeft,
    expired,
    taking,
    acquire,
    release,
    forget,
    sync,
  };
}

export type SeatHold = ReturnType<typeof useSeatHold>;
