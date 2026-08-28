/* A brake on machines, not on guests.
 *
 * The number is deliberately generous. A real party of eight argues about
 * which table they want, mistypes a telephone number, gets it wrong twice and
 * tries again — and must never be told to come back later for it. What this
 * stops is a script hammering the endpoint, and a script gives itself away by
 * volume long before a family does.
 *
 * KEYED BY SOURCE, AND ONLY FOR THIS. An address is a fair signal of a machine
 * and a terrible signal of a person: a whole household, a carrier's entire
 * mobile estate or the club's own wifi can share one. So it is used to slow
 * a flood down and for nothing else — whether a guest already holds a table is
 * judged on their telephone number and their email, never on where they are
 * sitting. See service.ts.
 *
 * Memory again, per process, and the same seam as the store: a fleet of
 * servers wants this in Redis or at the edge. Until there is one, this is
 * honest and costs nothing. */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_IN_WINDOW = 8;

type Window = { hits: number[]; };

const globalBucket = globalThis as unknown as {
  __plitviceRate?: Map<string, Window>;
};

function buckets() {
  if (!globalBucket.__plitviceRate) globalBucket.__plitviceRate = new Map();
  return globalBucket.__plitviceRate;
}

export type RateVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

/* Count one attempt against a key. Successes count as well as failures —
   otherwise a script that succeeds is never slowed at all. */
export function takeAttempt(key: string, now = Date.now()): RateVerdict {
  return spend(key, now, WINDOW_MS, MAX_IN_WINDOW);
}

/* ── and a second, looser brake, on TAKING TABLES ───────────────────────── */

/* WHY THIS EXISTS AT ALL, when a hold is harmless and expires by itself.
 *
 * Because holds are free, anonymous and effective. A request with no cookie is
 * issued a fresh session, and a fresh session may hold a table — so a script
 * that sends sixty cookie-less requests holds sixty tables, and by repeating
 * every three minutes it keeps the whole floor dark to real guests without
 * ever booking anything or leaving a name. Nothing else in the reservation
 * path stops that: the unique index protects a table from being taken TWICE,
 * not from being taken pointlessly.
 *
 * THE NUMBER IS DELIBERATELY GENEROUS. Committing to a table is a considered
 * act — a guest does it once, or two or three times if they change their mind
 * — so forty in five minutes is far past any real person, while a floor-wide
 * lock-out needs hundreds. It is loose enough that a carrier's NAT or the
 * club's own wifi, where a dozen guests share one address, never meets it.
 *
 * Reading the floor and letting a table go are NOT braked: they are cheap, and
 * a guest who cannot release a table is a guest holding one for three minutes
 * they did not want. */
const HOLD_WINDOW_MS = 5 * 60 * 1000;
const MAX_HOLDS_IN_WINDOW = 40;

export function takeHold(key: string, now = Date.now()): RateVerdict {
  return spend(`hold:${key}`, now, HOLD_WINDOW_MS, MAX_HOLDS_IN_WINDOW);
}

function spend(
  key: string,
  now: number,
  windowMs: number,
  max: number,
): RateVerdict {
  const all = buckets();
  const seen = all.get(key)?.hits ?? [];
  const recent = seen.filter((at) => now - at < windowMs);

  if (recent.length >= max) {
    const oldest = recent[0];
    all.set(key, { hits: recent });
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  all.set(key, { hits: recent });

  /* Keep the map from growing for ever on a long-running server. */
  if (all.size > 5000) {
    for (const [k, w] of all) {
      if (w.hits.every((at) => now - at >= windowMs)) all.delete(k);
    }
  }

  return { ok: true };
}

/* The best guess at where a request came from, for the brake above and for
   nothing else. */
export function sourceOf(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
