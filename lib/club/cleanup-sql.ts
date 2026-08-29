/* THE CLEANUP'S MARKERS AND ITS STATEMENTS, WHERE A TEST CAN REACH THEM.
 *
 * ═══ WHY THIS IS A MODULE AND NOT SQL INSIDE THE SCRIPT ═══════════════════
 *
 * Because the SQL inside the script could not be run by anything except the
 * script, and the script refuses to run against anything but the club's own
 * server. So the statements were only ever executed for the first time against
 * production — and one of them was wrong.
 *
 * It built its placeholders by interpolation, `LIKE $${i + 1}`, and a later
 * edit dropped a dollar. What reached Neon was:
 *
 *     WHERE (lower(r.email) LIKE 1)
 *
 * — `operator does not exist: text ~~ integer`, at character 94. A harness had
 * "covered" that query, but the harness held its own COPY of the SQL, so it
 * proved only that the copy was correct. That is the whole lesson: a test that
 * retypes the statement tests the typing.
 *
 * Everything here is therefore a plain exported string with FIXED placeholders,
 * imported by scripts/production-test-data-cleanup.mjs and executed verbatim by
 * lib/club/cleanup-sql.test.ts against a real Postgres. Same characters, both
 * places. Nothing in this file connects to anything or decides anything: the
 * guards, the ordering and the judgement stay in the script and in
 * lib/club/test-data.ts.
 *
 * ═══ NO PLACEHOLDER IS EVER CONSTRUCTED ══════════════════════════════════
 *
 * Not one `${` appears inside a statement below, and that is the rule this file
 * exists to hold. A list of domains is passed as ONE array parameter and
 * matched with `LIKE ANY($1::text[])` rather than expanded into a chain of
 * `LIKE $1 OR LIKE $2`. That removes the numbering bug, the operator-precedence
 * bug that the chain also had, and the need to count parameters by hand. */

/* ── what a harness wrote on purpose ────────────────────────────────────── */

/* scripts/scanner-test-ticket.mjs stamps its order on three sides. */
export const TEST_CHANNELS = ["scanner-test"];

/* Providers that are not and never will be a real one. The real one is coming
   and will be 'payspot' — see lib/ticketing/payments/payspot.ts. */
export const TEST_PROVIDERS = ["scanner-test", "stress", "test"];

export const TEST_CUSTOMER_NAMES = ["SCANNER TEST"];

/* 'dev' is evidence ONLY on a night that is already a fixture. On a real night
   it is ambiguous and is reported rather than removed — there is no real
   payment provider yet to tell a dev confirmation apart from however the club
   got its first genuine admission issued. */
export const FIXTURE_ONLY_PROVIDERS = ["dev"];

/* RFC 2606 reserves these; no guest can receive mail at one. */
export const RESERVED_EMAIL_DOMAINS = [
  "@example.com",
  "@example.net",
  "@example.org",
  "@example.test",
];

/* A hint, deliberately NOT a marker: `primer.rs` is registrable and a real
   guest could own one. Rows matching it are reported, never removed. */
export const HINT_EMAIL_DOMAINS = ["@primer.rs"];

/* Domains as the patterns `LIKE ANY` wants. Exported so the shaping is covered
   by the same test as the statement that consumes it. */
export function domainPatterns(domains: readonly string[]): string[] {
  return domains.map((domain) => `%${domain}`);
}

/* ── reading ────────────────────────────────────────────────────────────── */

export const SELECT_EVENTS = `SELECT id, slug, title, status, test_only, starts_at, archived_at
   FROM events ORDER BY starts_at ASC`;

/* $1 channels · $2 providers · $3 customer names */
export const SELECT_MARKED_ORDERS = `SELECT o.id, o.reference, o.event_id, o.channel, o.payment_provider,
        o.payment_status, o.customer_name, o.quantity,
        e.slug AS event_slug, e.title AS event_title
   FROM ticket_orders o
   JOIN events e ON e.id = o.event_id
  WHERE o.channel = ANY($1::text[])
     OR o.payment_provider = ANY($2::text[])
     OR o.customer_name = ANY($3::text[])
  ORDER BY o.created_at ASC`;

/* A paid order on a fixture night that carries no marker at all — the reason a
   night gets held back instead of removed.
   $1 fixture ids · $2 channels · $3 providers · $4 customer names */
export const SELECT_UNMARKED_PAID_ON_FIXTURES = `SELECT o.event_id, COUNT(*)::int AS orders, SUM(o.quantity)::int AS admissions
   FROM ticket_orders o
  WHERE o.event_id = ANY($1::text[])
    AND o.payment_status = 'paid'
    AND NOT (o.channel = ANY($2::text[]))
    AND (o.payment_provider IS NULL OR NOT (o.payment_provider = ANY($3::text[])))
    AND NOT (o.customer_name = ANY($4::text[]))
  GROUP BY o.event_id`;

/* $1 event ids */
export const SELECT_ORDER_IDS_FOR_EVENTS = `SELECT id FROM ticket_orders WHERE event_id = ANY($1::text[])`;

/* $1 event slugs — the floor is keyed by slug, not by id. */
export const SELECT_RESERVATION_IDS_FOR_EVENTS = `SELECT id FROM reservations WHERE event_id = ANY($1::text[])`;

/* $1 order ids · $2 event slugs */
export const SELECT_FOOTPRINT = `SELECT
     (SELECT COUNT(*)::int FROM tickets WHERE order_id = ANY($1::text[])) AS tickets,
     (SELECT COUNT(*)::int FROM ticket_scans s
        WHERE s.ticket_id IN (SELECT id FROM tickets WHERE order_id = ANY($1::text[]))) AS scans,
     (SELECT COUNT(*)::int FROM ticket_deliveries WHERE order_id = ANY($1::text[])) AS deliveries,
     (SELECT COUNT(*)::int FROM reservations WHERE event_id = ANY($2::text[])) AS reservations,
     (SELECT COUNT(*)::int FROM seat_holds   WHERE event_id = ANY($2::text[])) AS holds`;

/* $1 mail keys */
export const COUNT_MAIL_FOR_KEYS = `SELECT COUNT(*)::int AS n FROM mail_deliveries WHERE key = ANY($1::text[])`;

/* Dev-mode payments on nights that are staying.
   $1 fixture-only providers · $2 condemned event ids */
export const SELECT_DEV_ON_KEPT_NIGHTS = `SELECT e.slug, COUNT(*)::int AS n, SUM(o.quantity)::int AS admissions
   FROM ticket_orders o JOIN events e ON e.id = o.event_id
  WHERE o.payment_provider = ANY($1::text[])
    AND NOT (o.event_id = ANY($2::text[]))
  GROUP BY e.slug`;

/* THE STATEMENT THAT WAS BROKEN, NOW WITH NOTHING TO GET WRONG. One array in,
   no chain, no counting. Used twice — once for the reserved domains and once
   for the hinted ones — because they ask the same question of different lists.
   $1 LIKE patterns · $2 condemned event slugs */
export const SELECT_RESERVATIONS_BY_EMAIL_DOMAIN = `SELECT r.event_id, COUNT(*)::int AS n
   FROM reservations r
  WHERE lower(r.email) LIKE ANY($1::text[])
    AND NOT (r.event_id = ANY($2::text[]))
  GROUP BY r.event_id`;

/* $1 event id · $2 event slug */
export const COUNT_FOR_ONE_EVENT = `SELECT
     (SELECT COUNT(*)::int FROM ticket_orders WHERE event_id = $1) AS orders,
     (SELECT COUNT(*)::int FROM tickets       WHERE event_id = $1) AS tickets,
     (SELECT COUNT(*)::int FROM reservations  WHERE event_id = $2) AS reservations`;

/* ── removing ───────────────────────────────────────────────────────────── */

/* CHILDREN BEFORE PARENTS. The script runs these in this order inside ONE
   transaction, each only if its id list has something in it. Every one is
   scoped to a list the run assembled and printed first: there is no pattern
   match here and no unbounded DELETE. */

/* $1 order ids */
export const DELETE_SCANS_FOR_ORDERS = `DELETE FROM ticket_scans WHERE ticket_id IN
     (SELECT id FROM tickets WHERE order_id = ANY($1::text[]))`;

export const DELETE_TICKET_DELIVERIES_FOR_ORDERS = `DELETE FROM ticket_deliveries WHERE order_id = ANY($1::text[])`;

/* $1 mail keys — an order id for a ticket, a reservation id for a table. */
export const DELETE_MAIL_FOR_KEYS = `DELETE FROM mail_deliveries WHERE key = ANY($1::text[])`;

export const DELETE_TICKETS_FOR_ORDERS = `DELETE FROM tickets WHERE order_id = ANY($1::text[])`;

export const DELETE_ORDERS = `DELETE FROM ticket_orders WHERE id = ANY($1::text[])`;

/* $1 event slugs */
export const DELETE_HOLDS_FOR_EVENTS = `DELETE FROM seat_holds WHERE event_id = ANY($1::text[])`;
export const DELETE_RESERVATIONS_FOR_EVENTS = `DELETE FROM reservations WHERE event_id = ANY($1::text[])`;

/* $1 event ids — last, and only ever the nights the run condemned by name. */
export const DELETE_EVENTS = `DELETE FROM events WHERE id = ANY($1::text[])`;

/* Every statement above, so a test can assert the property that matters about
   all of them at once rather than one at a time. */
export const ALL_STATEMENTS: Record<string, string> = {
  SELECT_EVENTS,
  SELECT_MARKED_ORDERS,
  SELECT_UNMARKED_PAID_ON_FIXTURES,
  SELECT_ORDER_IDS_FOR_EVENTS,
  SELECT_RESERVATION_IDS_FOR_EVENTS,
  SELECT_FOOTPRINT,
  COUNT_MAIL_FOR_KEYS,
  SELECT_DEV_ON_KEPT_NIGHTS,
  SELECT_RESERVATIONS_BY_EMAIL_DOMAIN,
  COUNT_FOR_ONE_EVENT,
  DELETE_SCANS_FOR_ORDERS,
  DELETE_TICKET_DELIVERIES_FOR_ORDERS,
  DELETE_MAIL_FOR_KEYS,
  DELETE_TICKETS_FOR_ORDERS,
  DELETE_ORDERS,
  DELETE_HOLDS_FOR_EVENTS,
  DELETE_RESERVATIONS_FOR_EVENTS,
  DELETE_EVENTS,
};
