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
  const all = buckets();
  const seen = all.get(key)?.hits ?? [];
  const recent = seen.filter((at) => now - at < WINDOW_MS);

  if (recent.length >= MAX_IN_WINDOW) {
    const oldest = recent[0];
    all.set(key, { hits: recent });
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  all.set(key, { hits: recent });

  /* Keep the map from growing for ever on a long-running server. */
  if (all.size > 5000) {
    for (const [k, w] of all) {
      if (w.hits.every((at) => now - at >= WINDOW_MS)) all.delete(k);
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
