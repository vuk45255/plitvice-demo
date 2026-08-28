/* A brake on the door, not on the doorman.
 *
 * The same shape as lib/reservations/rate-limit.ts and deliberately different
 * numbers, because the two are protecting against different things. A booking
 * form is used once by one person; the redemption endpoint is used two hundred
 * times an hour by somebody standing in a doorway with a queue in front of
 * them, and a brake that inconveniences them is a brake that gets switched
 * off.
 *
 * WHAT IT IS ACTUALLY FOR. A ticket reference is fifty bits — plenty against
 * somebody typing, nothing at all against a script. This is what turns "fifty
 * bits" into "fifty bits, at two attempts a second, against a reference that
 * only matters until the night is over". The token in the QR is 192 bits and
 * needs no help from anybody; the reference is why this file exists.
 *
 * FAILURES COST MORE THAN SUCCESSES. A real door scans real tickets: almost
 * every attempt finds something. A script guessing finds nothing, over and
 * over, and pays for it — which lets the honest limit stay high enough that
 * nobody at the door ever meets it.
 *
 * Memory again, per process, and the same seam as everything else here: a
 * fleet of servers wants this in Redis or at the edge. */

const WINDOW_MS = 60 * 1000;
/* What one source may spend a minute. A scan that finds a ticket costs 1; one
   that finds nothing costs 8, so a guessing script gets thirty attempts a
   minute and a busy door gets two hundred and forty. */
const BUDGET = 240;
export const COST_HIT = 1;
export const COST_MISS = 8;

type Spend = { at: number; cost: number };

const globalBucket = globalThis as unknown as {
  __plitviceTicketRate?: Map<string, Spend[]>;
};

function buckets() {
  if (!globalBucket.__plitviceTicketRate) globalBucket.__plitviceTicketRate = new Map();
  return globalBucket.__plitviceTicketRate;
}

export type RateVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

/* Asked BEFORE the lookup, with the optimistic cost. Whether the attempt found
   anything is not known yet, so it is charged as a hit and `chargeMiss` tops
   it up afterwards when it turns out not to have been one. */
export function takeScan(key: string, now = Date.now()): RateVerdict {
  const all = buckets();
  const recent = (all.get(key) ?? []).filter((s) => now - s.at < WINDOW_MS);
  const spent = recent.reduce((sum, s) => sum + s.cost, 0);

  if (spent >= BUDGET) {
    all.set(key, recent);
    const oldest = recent[0]?.at ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push({ at: now, cost: COST_HIT });
  all.set(key, recent);

  /* Keep the map from growing for ever on a long-running server. */
  if (all.size > 5000) {
    for (const [k, spends] of all) {
      if (spends.every((s) => now - s.at >= WINDOW_MS)) all.delete(k);
    }
  }

  return { ok: true };
}

/* ── and a much tighter one on STARTING A CHECKOUT ──────────────────────── */

/* WHY THE DOOR'S BUDGET IS THE WRONG BUDGET FOR BUYING.
 *
 * The numbers above are shaped for a doorman scanning two hundred tickets an
 * hour, and they were being applied to the purchase route as well — which meant
 * one address could start 240 orders a minute. Every one of those holds its
 * admissions for ten minutes, so a three-hundred-seat night could be made to
 * look sold out, from one laptop, in under two minutes, without any money
 * changing hands. The seats come back by themselves, which makes it a nuisance
 * rather than a theft — but a nuisance timed for the hour tickets go on sale is
 * how a night sells out to nobody.
 *
 * A REAL BUYER STARTS ONE CHECKOUT, or three if the card is refused twice.
 * Fifteen in ten minutes is far past that and far below the hundreds an
 * exhaustion attempt needs. It is deliberately loose enough for the club's own
 * wifi and a carrier's NAT, where several guests genuinely share one address:
 * the tightest realistic case is a group buying separately in the same room,
 * and fifteen covers it.
 *
 * NOT keyed to the door's bucket, so a busy entrance can never eat a buyer's
 * allowance or the other way round. */
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
const CHECKOUT_BUDGET = 15;

export function takeCheckout(key: string, now = Date.now()): RateVerdict {
  const all = buckets();
  const bucketKey = `checkout:${key}`;
  const recent = (all.get(bucketKey) ?? []).filter(
    (s) => now - s.at < CHECKOUT_WINDOW_MS,
  );

  if (recent.length >= CHECKOUT_BUDGET) {
    all.set(bucketKey, recent);
    const oldest = recent[0]?.at ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((CHECKOUT_WINDOW_MS - (now - oldest)) / 1000),
      ),
    };
  }

  recent.push({ at: now, cost: COST_HIT });
  all.set(bucketKey, recent);
  return { ok: true };
}

/* The attempt found nothing. Charge it the difference. */
export function chargeMiss(key: string, now = Date.now()) {
  const all = buckets();
  const recent = all.get(key) ?? [];
  recent.push({ at: now, cost: COST_MISS - COST_HIT });
  all.set(key, recent);
}

/* The best guess at where a request came from, for the brake above and for
   nothing else. */
export function sourceOf(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function __resetScanRateForTests() {
  globalBucket.__plitviceTicketRate = undefined;
}
