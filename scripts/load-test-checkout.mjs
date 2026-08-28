/* THE OVERSELLING TEST, AGAINST A RUNNING SERVER.
 *
 *   npm run dev                 (in one terminal)
 *   npm run loadtest            (in another)
 *
 * It fires hundreds of simultaneous checkouts at one night and then asks the
 * database a single question: DID MORE ADMISSIONS GET SOLD THAN THE ROOM
 * HOLDS? Everything else it prints is diagnosis; that one line is the test.
 *
 * ═══ WHY THIS EXISTS WHEN THERE ARE ALREADY UNIT TESTS ════════════════════
 *
 * The unit tests run a hundred `createOrder` calls inside one process against
 * one in-memory Postgres. That proves the SQL is right. It does not prove that
 * the route handler, the rate limiter, the connection pool and a real server
 * behave when three hundred requests land at once — and "no overselling" is a
 * claim about the whole path, not about one function.
 *
 * ═══ SAFETY ══════════════════════════════════════════════════════════════
 *
 *   · It refuses to run against anything that is not localhost unless
 *     --i-know-what-i-am-doing is passed. NEVER RUN THIS AGAINST PRODUCTION:
 *     it creates real orders that hold real seats for ten real minutes.
 *   · It only ever sells a `testOnly` night, which does not exist unless dev
 *     mode is open.
 *   · It takes no money and confirms no payment: every order it creates is
 *     pending, and every one of them lapses by itself in ten minutes.
 *
 * ═══ USAGE ═══════════════════════════════════════════════════════════════
 *
 *   node scripts/load-test-checkout.mjs
 *   node scripts/load-test-checkout.mjs --event test-night --buyers 300 --each 2
 *   node scripts/load-test-checkout.mjs --base http://192.168.1.26:3000
 *
 * WHAT A PASS LOOKS LIKE: `sold === capacity` when the buyers wanted more than
 * the room holds, with the rest refused `sold_out`. A single admission over
 * capacity is a failure however many requests succeeded. */

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "true");
  }
}

const BASE = (args.get("base") ?? "http://localhost:3000").replace(/\/+$/, "");
const EVENT = args.get("event") ?? "test-night-small";
const BUYERS = Number(args.get("buyers") ?? 200);
const EACH = Number(args.get("each") ?? 1);

const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(BASE);
if (!local && args.get("i-know-what-i-am-doing") !== "true") {
  console.error(
    `Refusing to run against ${BASE}.\n` +
      "This creates real orders that hold real seats. Pass " +
      "--i-know-what-i-am-doing only if you are certain this is a staging server.",
  );
  process.exit(1);
}

/* ── the run ────────────────────────────────────────────────────────────── */

async function checkout(index) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}/api/ticketing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        /* The rate limiter keys on the source address, and all of this comes
           from one machine. Spreading the load across addresses is what keeps
           the brake from turning this into a test of the brake — which is a
           different test, and one worth running on purpose by removing this. */
        "x-forwarded-for": `10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`,
      },
      body: JSON.stringify({
        eventSlug: EVENT,
        quantity: EACH,
        buyer: {
          name: `Load Test ${index}`,
          email: `load-${index}-${Date.now()}@example.com`,
          phone: `06${String(1000000 + index).slice(0, 7)}`,
        },
      }),
    });

    const body = await response.json().catch(() => ({}));
    return {
      status: response.status,
      ok: body.ok === true,
      reason: body.reason ?? null,
      ms: Date.now() - started,
    };
  } catch (error) {
    return { status: 0, ok: false, reason: String(error), ms: Date.now() - started };
  }
}

async function main() {
  console.log(
    `Firing ${BUYERS} simultaneous checkouts × ${EACH} ticket(s) at ${EVENT} on ${BASE}\n`,
  );

  const started = Date.now();
  /* ALL AT ONCE, deliberately. A staggered run tests nothing: the whole
     question is what happens when the reads and the writes interleave. */
  const results = await Promise.all(
    Array.from({ length: BUYERS }, (_, i) => checkout(i)),
  );
  const elapsed = Date.now() - started;

  const won = results.filter((r) => r.ok);
  const soldOut = results.filter((r) => r.reason === "sold_out");
  const limited = results.filter((r) => r.status === 429);
  const broken = results.filter((r) => !r.ok && r.status !== 409 && r.status !== 429);

  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const at = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];

  console.log(`  accepted     ${won.length}  (${won.length * EACH} admissions)`);
  console.log(`  sold out     ${soldOut.length}`);
  console.log(`  rate limited ${limited.length}`);
  console.log(`  errors       ${broken.length}`);
  console.log(
    `  latency      p50 ${at(0.5)}ms · p95 ${at(0.95)}ms · max ${times[times.length - 1]}ms`,
  );
  console.log(`  wall clock   ${elapsed}ms\n`);

  if (broken.length > 0) {
    const shown = new Map();
    for (const row of broken) shown.set(`${row.status} ${row.reason}`, (shown.get(`${row.status} ${row.reason}`) ?? 0) + 1);
    for (const [what, count] of shown) console.log(`  ! ${count}× ${what}`);
    console.log("");
  }

  /* ── THE ACTUAL TEST ──────────────────────────────────────────────────
     Asked of the server rather than counted here: what matters is what the
     database thinks, not what the client believes it was told. */
  const state = await fetch(
    `${BASE}/api/ticketing/availability?event=${encodeURIComponent(EVENT)}`,
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  if (!state || typeof state.capacity !== "number") {
    console.log(
      "Could not read the night's state back — is the dev server running with " +
        "TICKETING_DEV_MODE=true?",
    );
    process.exit(2);
  }

  console.log(`  capacity     ${state.capacity}`);
  console.log(`  taken        ${state.taken}  (paid ${state.paid} + held ${state.held})`);

  if (state.taken > state.capacity) {
    console.log(`\n  ✗ OVERSOLD by ${state.taken - state.capacity}. This is a failure.`);
    process.exit(1);
  }

  const wanted = BUYERS * EACH;
  if (wanted > state.capacity && state.taken !== state.capacity) {
    console.log(
      `\n  ? ${wanted} admissions were wanted and the room holds ${state.capacity}, ` +
        `but only ${state.taken} were sold. Not overselling — check whether the ` +
        "rate limiter turned buyers away before the capacity check did.",
    );
    process.exit(0);
  }

  console.log("\n  ✓ no overselling.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
