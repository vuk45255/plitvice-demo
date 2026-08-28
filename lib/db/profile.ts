/* WHERE THE TIME ACTUALLY GOES, WHEN SOMEBODY IS ASKING.
 *
 * A burst of three hundred checkouts against one night took twenty-four
 * seconds on a real server and forty-six of them never got a database
 * connection. "The pool is too small" was the obvious reading and it was the
 * wrong one — so this exists to stop the next such question being answered by
 * intuition. It measures the phases a checkout actually passes through:
 *
 *   pool.acquire   waiting for a connection from the pool
 *   tx.begin       BEGIN
 *   lock.wait      SELECT … FOR UPDATE on the event row — the queue itself
 *   order.insert   counting what is taken and inserting, inside the lock
 *   tx.commit      COMMIT — the lock is held until this returns
 *   checkout.tx    the whole transaction
 *   event.lookup   reading the night, outside the lock
 *   checkout.total one call to createOrder, end to end
 *
 * ═══ IT IS OFF UNLESS ASKED FOR ═══════════════════════════════════════════
 *
 * `DATABASE_PROFILE=true`, which nothing but the stress script sets. When it
 * is off, `record` is two comparisons and a return: no allocation, no clock
 * reading kept, nothing accumulated. A production instance must not grow an
 * array per request for the sake of a number nobody is reading.
 *
 * IT HOLDS DURATIONS AND NOTHING ELSE. No parameters, no rows, no order ids,
 * no addresses — a profile is a shape, not a record of who bought what. */

type Samples = Map<string, number[]>;

const globalProfile = globalThis as unknown as { __plitviceProfile?: Samples };

function samples(): Samples {
  if (!globalProfile.__plitviceProfile) globalProfile.__plitviceProfile = new Map();
  return globalProfile.__plitviceProfile;
}

export function profiling(): boolean {
  return process.env.DATABASE_PROFILE === "true";
}

export function record(phase: string, ms: number): void {
  if (!profiling()) return;
  const all = samples();
  const list = all.get(phase);
  if (list) list.push(ms);
  else all.set(phase, [ms]);
}

/* Time one step. Returns whatever the step returned; the timing is a side
   effect, and a step that throws is timed as well — a failure that took twenty
   seconds is the most interesting number on the page. */
export async function timed<T>(phase: string, run: () => Promise<T>): Promise<T> {
  if (!profiling()) return run();
  const started = performance.now();
  try {
    return await run();
  } finally {
    record(phase, performance.now() - started);
  }
}

export type PhaseStats = {
  phase: string;
  n: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  total: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export function snapshot(): PhaseStats[] {
  const out: PhaseStats[] = [];
  for (const [phase, list] of samples()) {
    const sorted = [...list].sort((a, b) => a - b);
    out.push({
      phase,
      n: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] ?? 0,
      total: sorted.reduce((sum, ms) => sum + ms, 0),
    });
  }
  return out;
}

export function resetProfile(): void {
  globalProfile.__plitviceProfile = new Map();
}
