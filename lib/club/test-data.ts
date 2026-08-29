/* WHICH ROWS ARE FIXTURES, DECIDED BY EVIDENCE AND NOTHING ELSE.
 *
 * A production database accumulates the debris of its own development: the
 * night the load test sold out four hundred times, the night somebody bought a
 * ticket to point a camera at it, the two seeded rows that exist so a laptop
 * has something to sell. None of it belongs in front of a club owner, and all
 * of it is entangled with orders, tickets, scans and reservations that must go
 * with it or not at all.
 *
 * ═══ WHY THIS IS A MODULE AND NOT A HAND-WRITTEN DELETE ═══════════════════
 *
 * Because the dangerous version of this job is a `DELETE FROM events WHERE
 * created_at < …` typed into a console at midnight, and the difference between
 * that and this is that this one can be TESTED. `scripts/clean-test-events.mjs`
 * is a thin wrapper; the judgement is here, it is pure, and there is a test
 * that says Saturday Madness cannot be classified as a fixture no matter what
 * else is true of it.
 *
 * ═══ THE RULES ARE MARKERS, NEVER CIRCUMSTANCE ════════════════════════════
 *
 * Every rule below points at something a fixture-generator DELIBERATELY WROTE:
 * the `test_only` column that exists for exactly this, the stress harness's own
 * slug and title shape, the seed's two named probe nights. Not one of them
 * looks at a date, a status, a price, a capacity, or whether anything was ever
 * sold. An old night is not a fixture. A draft is not a fixture. A free night
 * is not a fixture. A night nobody ever bought a ticket to is not a fixture —
 * it is most club nights.
 *
 * ═══ AND THE PROGRAMME IS PROTECTED OUTRIGHT ══════════════════════════════
 *
 * A slug that belongs to the venue's real programme is refused before any rule
 * is consulted, so a marker that somehow matched real artwork could still not
 * remove it. Belt and braces on the one operation here that cannot be undone. */

export type TestEventRow = {
  id: string;
  slug: string;
  title: string;
  testOnly: boolean;
};

export type TestVerdict =
  | { test: true; because: string[] }
  | { test: false; because: [] };

const NOT_A_FIXTURE: TestVerdict = { test: false, because: [] };

/* The stress harness names every night it makes `stress-<scenario>-<run>` with
   a title of `Stress <scenario> <run>` — see scripts/stress.mjs. Both are
   matched, because a half-finished run can leave one without the other. */
const STRESS_SLUG = /^stress-[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/;
const STRESS_TITLE = /^Stress\s/;

/* The two nights lib/db/schema.ts seeds so that a laptop with an
   empty database has something to sell. Both carry `test_only` as well; they
   are named here so a row whose flag was lost is still recognised. */
const SEEDED_PROBES = new Set(["test-night", "test-night-small"]);

/* Anything the scanner harness might leave behind if it is ever given the
   ability to mint its own night. It does not have it today — it buys into an
   existing one — and the rule costs nothing and closes the gap. */
const SCANNER_PREFIX = "scanner-test";

export function classifyEvent(
  event: TestEventRow,
  protectedSlugs: ReadonlySet<string>,
): TestVerdict {
  /* FIRST, AND BEFORE ANY EVIDENCE IS READ. */
  if (protectedSlugs.has(event.slug)) return NOT_A_FIXTURE;

  const because: string[] = [];

  if (event.testOnly) because.push("test_only = true");
  if (STRESS_SLUG.test(event.slug)) because.push(`slug matches the stress harness (${event.slug})`);
  if (STRESS_TITLE.test(event.title)) because.push(`title matches the stress harness (${event.title})`);
  if (SEEDED_PROBES.has(event.slug)) because.push(`seeded probe night (${event.slug})`);
  if (event.slug.startsWith(SCANNER_PREFIX)) because.push(`slug matches the scanner harness (${event.slug})`);

  return because.length > 0 ? { test: true, because } : NOT_A_FIXTURE;
}

/* Split a whole table in one pass, so a caller reports before it removes. */
export function partitionEvents(
  events: TestEventRow[],
  protectedSlugs: ReadonlySet<string>,
): { fixtures: { event: TestEventRow; because: string[] }[]; keep: TestEventRow[] } {
  const fixtures: { event: TestEventRow; because: string[] }[] = [];
  const keep: TestEventRow[] = [];

  for (const event of events) {
    const verdict = classifyEvent(event, protectedSlugs);
    if (verdict.test) fixtures.push({ event, because: verdict.because });
    else keep.push(event);
  }
  return { fixtures, keep };
}
