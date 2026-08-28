import { SEED_EVENTS } from "@/lib/ticketing/catalogue";
import type { Queryable } from "@/lib/db/client";

/* THE SHAPE OF EVERY GUARANTEE IN THIS SYSTEM.
 *
 * Read the indexes rather than the columns. The columns say what is kept; the
 * indexes and the CHECKs are where "no overselling", "one admission per
 * ticket", "one set of tickets per payment" and "one hold per table" actually
 * live. Nothing in JavaScript can be trusted to hold a rule that two machines
 * might reach at the same instant, and every one of those four is reachable by
 * two machines at the same instant.
 *
 * ═══ HOW MIGRATION WORKS HERE ═════════════════════════════════════════════
 *
 * Every statement is idempotent — `IF NOT EXISTS`, everywhere — and they are
 * run in one transaction behind a transaction-scoped advisory lock. That is
 * the whole migration system, deliberately: a club with six tables does not
 * need a migration tool, it needs the schema to be correct after any number of
 * cold starts hitting it at once. Adding a column later is one more
 * `ALTER TABLE … ADD COLUMN IF NOT EXISTS` at the end of the list.
 *
 * The lock matters. On Vercel a deploy can start twenty instances in the same
 * second and every one of them will try to create the same table; without it,
 * nineteen of them get an error and the site is down for the length of a cold
 * start.
 *
 * ═══ TIME ════════════════════════════════════════════════════════════════
 *
 * Every instant is `timestamptz` and every comparison against "now" is made by
 * the DATABASE, with `now()`, inside the statement that depends on it. Not by
 * Node, and never by a browser. A hold expires because the database says the
 * hold expired — which is the same answer on four instances, after a restart,
 * and on a laptop whose clock is twenty minutes fast. */

type Migratable = Queryable & {
  transaction<T>(run: (tx: Queryable) => Promise<T>): Promise<T>;
};

/* An arbitrary constant. Every instance takes the same one, so exactly one of
   them migrates and the rest wait and then find everything already there. */
const MIGRATION_LOCK = 720_1912;

const STATEMENTS: string[] = [
  /* ── events ───────────────────────────────────────────────────────────
     A night, as the ticketing system needs to know it. Seeded once from
     lib/ticketing/catalogue.ts and edited from /admin afterwards. */
  `CREATE TABLE IF NOT EXISTS events (
     id             text PRIMARY KEY,
     slug           text NOT NULL UNIQUE,
     title          text NOT NULL,
     starts_at      timestamptz NOT NULL,
     doors_at       timestamptz,
     description    text,
     image          text,
     status         text NOT NULL CHECK (status IN ('draft','on_sale','sold_out','ended')),
     ticket_price   integer NOT NULL CHECK (ticket_price >= 0),
     currency       text NOT NULL DEFAULT 'RSD',
     capacity       integer NOT NULL CHECK (capacity >= 0),
     max_per_order  integer NOT NULL CHECK (max_per_order > 0),
     sales_start    timestamptz,
     sales_end      timestamptz,
     test_only      boolean NOT NULL DEFAULT false,
     created_at     timestamptz NOT NULL DEFAULT now(),
     updated_at     timestamptz NOT NULL DEFAULT now()
   )`,

  /* ── ticket orders ────────────────────────────────────────────────────
     One purchase. `hold_expires_at` IS THE CHECKOUT HOLD: a pending order
     holds its admissions against the room until that instant and not one
     second longer, and every count of what is taken says so in SQL rather
     than trusting a sweep to have run. There is no separate holds table
     because there is nothing a separate row could say that this one does
     not — and two rows that can disagree about whether four seats are taken
     is the bug, not the feature. */
  `CREATE TABLE IF NOT EXISTS ticket_orders (
     id                text PRIMARY KEY,
     reference         text NOT NULL UNIQUE,
     event_id          text NOT NULL REFERENCES events(id),
     customer_name     text NOT NULL,
     customer_email    text NOT NULL,
     customer_phone    text NOT NULL,
     email_key         text NOT NULL,
     phone_key         text NOT NULL,
     quantity          integer NOT NULL CHECK (quantity > 0),
     total_amount      integer NOT NULL CHECK (total_amount >= 0),
     currency          text NOT NULL DEFAULT 'RSD',
     payment_status    text NOT NULL CHECK (
                         payment_status IN ('pending','paid','expired','failed','refunded')),
     payment_provider  text,
     payment_reference text,
     hold_expires_at   timestamptz NOT NULL,
     /* Set when a payment is honoured after its hold had already been given
        back and the room had filled behind it. Never a reason to refuse the
        money; always a reason for the club to see it on the admin screen. */
     oversold          boolean NOT NULL DEFAULT false,
     channel           text NOT NULL DEFAULT 'web',
     created_at        timestamptz NOT NULL DEFAULT now(),
     updated_at        timestamptz NOT NULL DEFAULT now(),
     paid_at           timestamptz
   )`,

  `CREATE INDEX IF NOT EXISTS ticket_orders_by_event
     ON ticket_orders (event_id, payment_status)`,
  `CREATE INDEX IF NOT EXISTS ticket_orders_by_created
     ON ticket_orders (created_at DESC)`,
  /* What the club searches by when somebody rings up having lost a ticket. */
  `CREATE INDEX IF NOT EXISTS ticket_orders_by_email ON ticket_orders (email_key)`,
  `CREATE INDEX IF NOT EXISTS ticket_orders_by_phone ON ticket_orders (phone_key)`,

  /* ── tickets ──────────────────────────────────────────────────────────
     One admission.
     THE TOKEN IS NOT IN HERE. `token_hash` is sha256 of the secret in the
     QR — lookups are made by hashing what was scanned and matching on this,
     so a copy of this table is not a pile of working tickets and a query log
     never contains one. `token_cipher` is the same secret sealed under a key
     that lives OUTSIDE the database, and exists for exactly one reason: the
     order page and the confirmation mail have to be able to show a guest
     their own ticket again. See lib/ticketing/secrets.ts.

     UNIQUE (order_id, seq) IS THE IDEMPOTENCY GUARANTEE. Minting inserts
     seats 1..n for an order; a webhook that arrives twice runs the same
     insert twice and the second one is refused by the database rather than
     by anybody's good intentions. */
  `CREATE TABLE IF NOT EXISTS tickets (
     id           text PRIMARY KEY,
     reference    text NOT NULL UNIQUE,
     event_id     text NOT NULL REFERENCES events(id),
     order_id     text NOT NULL REFERENCES ticket_orders(id),
     token_hash   text NOT NULL UNIQUE,
     token_cipher text NOT NULL,
     seq          integer NOT NULL CHECK (seq > 0),
     status       text NOT NULL CHECK (status IN ('valid','used','cancelled')),
     created_at   timestamptz NOT NULL DEFAULT now(),
     scanned_at   timestamptz,
     scanned_by   text
   )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS tickets_one_per_seat
     ON tickets (order_id, seq)`,
  `CREATE INDEX IF NOT EXISTS tickets_by_event ON tickets (event_id, status)`,
  `CREATE INDEX IF NOT EXISTS tickets_by_order ON tickets (order_id, seq)`,

  /* ── scans ────────────────────────────────────────────────────────────
     Every time somebody held something up at the door, and what the door
     said. The ticket row carries the one scan that let a guest in; this
     carries all of them, including the refusals, because "how many people
     tried to come in on that code" is a question the club will eventually
     ask and cannot answer afterwards if nobody wrote it down.
     NO TOKENS, ever — see the ticket_id. */
  `CREATE TABLE IF NOT EXISTS ticket_scans (
     id         bigserial PRIMARY KEY,
     ticket_id  text REFERENCES tickets(id),
     event_id   text,
     outcome    text NOT NULL,
     door       text,
     scanned_by text,
     at         timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS ticket_scans_by_event ON ticket_scans (event_id, at DESC)`,

  /* ── ticket delivery ──────────────────────────────────────────────────
     One row per order, and the PRIMARY KEY is what makes that true. A
     payment provider that sends the same confirmation five times must not
     send the guest five emails; whoever inserts this row first is the one
     that delivers, and the other four find it already there. */
  `CREATE TABLE IF NOT EXISTS ticket_deliveries (
     order_id   text PRIMARY KEY REFERENCES ticket_orders(id),
     channel    text NOT NULL,
     status     text NOT NULL CHECK (status IN ('queued','sent','failed')),
     attempts   integer NOT NULL DEFAULT 0,
     last_error text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  /* ── reservations ─────────────────────────────────────────────────────
     A table, once the house has it. `source` says whether the guest asked
     through the site or rang up — and both write to THIS table, which is the
     entire point: a table taken over the telephone must disappear from the
     map the same second. */
  `CREATE TABLE IF NOT EXISTS reservations (
     id         text PRIMARY KEY,
     event_id   text NOT NULL,
     seat_id    text NOT NULL,
     seat_type  text NOT NULL,
     zone       text NOT NULL,
     guests     integer NOT NULL CHECK (guests > 0),
     name       text NOT NULL,
     phone      text NOT NULL,
     email      text NOT NULL DEFAULT '',
     note       text NOT NULL DEFAULT '',
     phone_key  text NOT NULL,
     email_key  text NOT NULL DEFAULT '',
     status     text NOT NULL CHECK (
                  status IN ('pending','confirmed','rejected','cancelled','expired')),
     source     text NOT NULL DEFAULT 'web' CHECK (source IN ('web','phone')),
     created_by text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  /* ONE LIVE BOOKING PER TABLE PER NIGHT. This single line is the whole of
     the double-booking protection, and it holds against the site, the admin
     screen and a telephone booking equally because all three insert here. */
  `CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_per_seat
     ON reservations (event_id, seat_id)
     WHERE status IN ('pending','confirmed')`,

  /* One booking per guest per night — but only against the SITE. Staff
     taking a booking by telephone are trusted to know that the same number
     is ringing about a second table for their cousins, and refusing them
     would send them back to writing it on paper, which is what this whole
     system exists to replace. */
  `CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_per_phone
     ON reservations (event_id, phone_key)
     WHERE status IN ('pending','confirmed') AND source = 'web'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_per_email
     ON reservations (event_id, email_key)
     WHERE status IN ('pending','confirmed') AND source = 'web' AND email_key <> ''`,
  `CREATE INDEX IF NOT EXISTS reservations_by_event ON reservations (event_id, created_at DESC)`,

  /* ── seat holds ───────────────────────────────────────────────────────
     Three minutes with a table to yourself. Expiry is a column, never a
     timer: a hold is dead when `expires_at` has passed according to the
     database, so a server that was asleep, restarted, or is one of four
     behind a load balancer gives the same answer. */
  `CREATE TABLE IF NOT EXISTS seat_holds (
     id         text PRIMARY KEY,
     event_id   text NOT NULL,
     seat_id    text NOT NULL,
     token      text NOT NULL,
     status     text NOT NULL CHECK (status IN ('active','released','consumed')),
     created_at timestamptz NOT NULL DEFAULT now(),
     expires_at timestamptz NOT NULL
   )`,

  /* ONE LIVE HOLD PER TABLE. The partial predicate is what lets a released
     or consumed hold stop blocking anything without being deleted. */
  `CREATE UNIQUE INDEX IF NOT EXISTS seat_holds_one_live
     ON seat_holds (event_id, seat_id)
     WHERE status = 'active'`,
  `CREATE INDEX IF NOT EXISTS seat_holds_by_token ON seat_holds (event_id, token, status)`,

  /* ── staff sessions ───────────────────────────────────────────────────
     WHY THIS IS A TABLE AND NOT A MAP. A session in a Map dies with the
     instance, which on Vercel means a doorman is signed out at random — and
     it cannot be revoked, because there is nowhere to revoke it from.
     The PRIMARY KEY IS A HASH of the cookie value, not the cookie value: a
     read of this table must not hand somebody a working session. */
  `CREATE TABLE IF NOT EXISTS staff_sessions (
     id         text PRIMARY KEY,
     staff_id   text NOT NULL,
     name       text NOT NULL,
     role       text NOT NULL CHECK (role IN ('admin','scanner')),
     door       text,
     created_at timestamptz NOT NULL DEFAULT now(),
     expires_at timestamptz NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS staff_sessions_expiry ON staff_sessions (expires_at)`,

  /* ── everything else that gets posted ─────────────────────────────────
     One row per message the club has decided to send, keyed by WHAT it is
     about rather than by a message id: (reservation-confirmation, r2026…).
     The PRIMARY KEY is the idempotency — whoever inserts it is the one that
     sends, and a second attempt for the same reservation finds it already
     there. Exactly the arrangement `ticket_deliveries` uses for the tickets
     themselves, which keeps its own table because it is keyed to an order and
     guards a payment; this one carries the rest. */
  `CREATE TABLE IF NOT EXISTS mail_deliveries (
     kind       text NOT NULL,
     key        text NOT NULL,
     recipient  text NOT NULL,
     status     text NOT NULL CHECK (status IN ('queued','sent','failed')),
     attempts   integer NOT NULL DEFAULT 0,
     last_error text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (kind, key)
   )`,
  `CREATE INDEX IF NOT EXISTS mail_deliveries_failed
     ON mail_deliveries (status, updated_at DESC)`,

  /* ── settings ─────────────────────────────────────────────────────────
     A handful of keyed values the club can change without a deploy, and the
     development fallback for the ticket-token key. */
  `CREATE TABLE IF NOT EXISTS app_settings (
     key        text PRIMARY KEY,
     value      text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  /* ── added after the first deploy ─────────────────────────────────────
     This is the whole of the migration story: one more line at the end of
     the list, `IF NOT EXISTS`, run inside the same locked transaction as
     everything above. */

  /* WHO LAST MOVED A BOOKING, alongside `created_by` which says who first
     wrote it down. Enough to answer "who cancelled the Nikolić table" the
     next afternoon, and not one column more — the club wants a name, not an
     event-sourcing system. */
  `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS updated_by text`,

  /* WHICH DOOR A TICKET CAME IN THROUGH. The scan log is written to on every
     attempt and read back one ticket at a time by the office — and by EXPLAIN,
     that read was a sequential scan of the whole table, which on a night with
     several thousand scans is the slowest thing on the busiest admin screen.
     The existing (event_id, at DESC) index serves the night's own feed; this
     one serves the question asked of a single ticket. */
  `CREATE INDEX IF NOT EXISTS ticket_scans_by_ticket
     ON ticket_scans (ticket_id, at DESC)`,
];

/* Create everything, once, whoever gets here first. Safe to call on every
   request; it is memoised one level up in client.ts. */
export async function ensureSchema(db: Migratable): Promise<void> {
  await db.transaction(async (q) => {
    /* Transaction-scoped: released by COMMIT or ROLLBACK, so a migration that
       throws does not leave the next deploy waiting on a dead lock. */
    await q.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
    for (const statement of STATEMENTS) await q.query(statement);
    await seedEvents(q);
  });
}

/* The nights from the catalogue, inserted once each.
 *
 * DO NOTHING ON CONFLICT, and that is the important half: a capacity or a
 * price the club changed in /admin at eleven at night is not put back by the
 * next deploy. The catalogue is how a night arrives; the table is what it is
 * afterwards. */
async function seedEvents(q: Queryable): Promise<void> {
  for (const event of SEED_EVENTS) {
    await q.query(
      `INSERT INTO events (
         id, slug, title, starts_at, doors_at, description, image, status,
         ticket_price, currency, capacity, max_per_order, sales_start, sales_end, test_only
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'RSD',$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.slug,
        event.title,
        event.startsAt,
        event.doorsAt ?? null,
        event.description ?? null,
        event.image ?? null,
        event.status,
        event.ticketPrice,
        event.capacity,
        event.maxPerOrder,
        event.salesStart ?? null,
        event.salesEnd ?? null,
        event.testOnly ?? false,
      ],
    );
  }
}
