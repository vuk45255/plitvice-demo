import { legacyArchiveIds, PROGRAMME } from "@/lib/club/programme-seed";
import type { Queryable } from "@/lib/db/client";
import { devMode } from "@/lib/ticketing/config";

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
     lib/club/programme-seed.ts and edited from /admin afterwards. */
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

  /* ═══ THE EVENT MANAGER'S OWN COLUMNS ═══════════════════════════════════
   *
   * Everything below hangs off the SAME `events` row a ticket is already
   * filed under. There is no second events table and there is not going to
   * be one: a night is one row, and the office editing its dress code must
   * not be able to produce a night that the ticketing system disagrees with.
   *
   * Every one is nullable or has a default that reproduces exactly what the
   * system did before it existed, so a row written by the seed, by the old
   * form, or by last month's deploy keeps working untouched. */

  /* WHICH HOUSE THIS NIGHT IS AT. One value today, and it is not read as a
     filter anywhere — it is here so that the day there is a second club, the
     rows already say which one they belong to instead of needing a migration
     across live ticket data. See lib/venue.ts. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id text NOT NULL DEFAULT 'plitvice'`,

  /* WHETHER THE NIGHT SELLS ENTRY ONLINE AT ALL, as against `status`, which
     says how that sale is going. A night with a free door has this false and
     is still a real night with a real floor. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS ticketing_enabled boolean NOT NULL DEFAULT true`,

  /* WHETHER THE NIGHT TAKES TABLES, and which floor it takes them on. The
     geometry is NOT here and never will be: the room is drawn once in
     lib/floor-plan.ts, and this column names a plan rather than describing
     one. 'default' is the house floor. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS tables_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS floor_plan text NOT NULL DEFAULT 'default'`,

  /* THE POSTER, IN TWO PARTS. `image` is the URL anything renders; this is
     the storage key the object is filed under, kept so a replaced poster can
     be deleted from the bucket rather than left there for ever. A poster that
     was typed in as a /public path has a URL and no key, which is exactly
     right — there is nothing in a bucket to delete. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_key text`,

  /* WHAT THE NIGHT IS, for the people reading a poster. All optional, none of
     them load-bearing: a club night with none of these filled in is a
     complete night, and every screen is written to say nothing about what is
     not there rather than print an empty label. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS lineup text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS genre text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS entry_note text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS promotion text`,

  /* ARCHIVED, NOT DELETED. A night with orders against it is never removed —
     the tickets, the scans and the money are the club's history. This takes
     it off every working list and leaves every report intact. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamptz`,

  /* ═══ A POSTER, OR A NIGHT THIS SYSTEM RAN ═══════════════════════════════
   *
   * The club's record goes back further than the software. Ten of those nights
   * are on the public wall as artwork and nothing else: they were put on before
   * anything here existed, so there is no order, no ticket, no scan and no
   * reservation against them and there never will be.
   *
   * The column exists because the ABSENCE of those rows is indistinguishable
   * from a night that sold nothing. `0 / 500 prodato` is a true sentence about
   * both, and it is a measurement of only one of them. This flag is what lets
   * the office report on the nights it actually ran and lets the wall keep the
   * rest.
   *
   * DEFAULT false — every night made in /admin is operational by construction,
   * which is the only way a night can be made now. Classification of the
   * seeded record happens in `classifyLegacyArchive` below, from the seed
   * itself. */
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS legacy_archive boolean NOT NULL DEFAULT false`,

  /* ═══ THE ONE BACKFILL, AND WHY IT IS SAFE ═══════════════════════════════
   *
   * `tables_enabled` was added with DEFAULT false, because false is what a new
   * night should be until somebody says otherwise. That default was written
   * onto EVERY EXISTING ROW as well — including the nights that were taking
   * table bookings at the time, which until now nobody noticed because nothing
   * read the column. The moment the reservation gate started reading it (see
   * lib/reservations/gate.ts) that false would have shut the floor on a night
   * the club was still selling.
   *
   * SO THE COLUMN IS SET FROM WHAT THE ROW ALREADY PROVES. A night that has a
   * reservation against it was demonstrably taking tables — the rows are the
   * evidence, not a guess — and it is switched on. The floor is keyed by SLUG,
   * which is why the match is on slug and not on id.
   *
   * IT RUNS ONCE PER NIGHT AND NEVER UNDOES A DECISION. `AND tables_enabled =
   * false` means a night the office has since switched off stays off: the
   * statement can only ever turn one on, and only for a night that already has
   * a booking on the floor. Re-running it on a later deploy changes nothing,
   * which is what every statement in this list has to be true of. */
  /* ═══ A LEDGER, FOR THE ONE KIND OF STEP THAT MAY NOT REPEAT ════════════
   *
   * Everything else in this list is idempotent by construction: CREATE TABLE
   * IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, an UPDATE narrow enough that a
   * second run matches nothing. That is why this project needs no migration
   * tool, and it stays true.
   *
   * ONE STEP CANNOT BE WRITTEN THAT WAY. Copying the poster wall's old values
   * onto rows that predate the event manager has to happen exactly once — run
   * it twice and the second run puts back everything the club edited in
   * between, which is the failure this whole change exists to remove. So that
   * step claims a key here first, inside the same transaction, and skips if it
   * is already taken. One row, one column, no framework.
   *
   * NOTHING ELSE MAY USE THIS. A step that wants a ledger is almost always a
   * step that should have been written to be safe to repeat. */
  `CREATE TABLE IF NOT EXISTS applied_migrations (
     id text PRIMARY KEY,
     applied_at timestamptz NOT NULL DEFAULT now()
   )`,

  `UPDATE events SET tables_enabled = true
      WHERE tables_enabled = false
        AND EXISTS (SELECT 1 FROM reservations r WHERE r.event_id = events.slug)`,
];

/* Create everything, once, whoever gets here first. Safe to call on every
   request; it is memoised one level up in client.ts. */
export async function ensureSchema(db: Migratable): Promise<void> {
  await db.transaction(async (q) => {
    /* Transaction-scoped: released by COMMIT or ROLLBACK, so a migration that
       throws does not leave the next deploy waiting on a dead lock. */
    await q.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
    for (const statement of STATEMENTS) await q.query(statement);
    await seedProgramme(q);
    await classifyLegacyArchive(q);
    await adoptProgrammeOnce(q);
    await seedFixtures(q);
  });
}


/* ── the venue's own nights, and the one time they are adopted ──────────── */

/* THE PROGRAMME, INSERTED ONCE EACH.
 *
 * DO NOTHING ON CONFLICT, and that is the important half: a title, a capacity
 * or a price the club changed in /admin at eleven at night is not put back by
 * the next deploy. lib/club/programme-seed.ts is how a night ARRIVES; the table
 * is what it is afterwards, and /admin/dogadjaji is the only thing that edits
 * it. */
async function seedProgramme(q: Queryable): Promise<void> {
  for (const night of PROGRAMME) {
    await q.query(
      `INSERT INTO events (
         id, slug, title, starts_at, doors_at, description, image, status,
         ticket_price, currency, capacity, max_per_order, test_only,
         venue_id, ticketing_enabled, tables_enabled, floor_plan,
         lineup, genre, age_restriction, entry_note, dress_code, promotion,
         legacy_archive
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'RSD',$10,$11,false,
                 'plitvice',$12,$13,'default',$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO NOTHING`,
      [
        night.id,
        night.slug,
        night.title,
        night.startsAt,
        night.doorsAt ?? null,
        night.description ?? null,
        night.image,
        night.status,
        night.ticketPrice,
        night.capacity,
        night.maxPerOrder,
        night.ticketingEnabled,
        night.tablesEnabled,
        night.lineup ?? null,
        /* `genre` is gone from the product — see lib/ticketing/event-rules.ts.
           The column stays (dropping one from a live events table buys
           nothing) and is written empty rather than taken out of the insert,
           which keeps every parameter after it on the number it already had. */
        null,
        night.ageRestriction ?? null,
        night.entryNote ?? null,
        night.dressCode ?? null,
        night.promotion ?? null,
        night.legacy ?? false,
      ],
    );
  }
}

/* ═══ CLASSIFYING A DATABASE SEEDED BEFORE THE FLAG EXISTED ════════════════
 *
 * `legacy_archive` defaults to false, which is right for every night made in
 * the office and wrong for the ten poster nights already sitting in the table
 * from before the column was added. This puts them right.
 *
 * IT IS SAFE TO REPEAT, which is the rule every statement here answers to. The
 * id list is a constant in this repository — the `past(...)` entries in the
 * seed and nothing else — so it is the same statement on every start, matching
 * the same ten rows. It is not a backfill from evidence and it is not
 * reversible from the office, because being a poster is a fact about where a
 * night came from rather than a setting anybody should toggle: nothing in the
 * application writes this column and deliberately nothing will.
 *
 * IT ONLY EVER SETS THE FLAG ON, and only for ids named in this repository. A
 * night the office creates is operational by construction and is never named
 * here, so no amount of re-running can reach one. */
async function classifyLegacyArchive(q: Queryable): Promise<void> {
  const ids = legacyArchiveIds();
  if (ids.length === 0) return;
  await q.query(
    `UPDATE events SET legacy_archive = true
      WHERE id = ANY($1::text[]) AND legacy_archive = false`,
    [ids],
  );
}

/* ═══ THE ONE-TIME ADOPTION, AND WHY IT NEEDS A LEDGER ═════════════════════
 *
 * A database that has been running since before the event manager has rows for
 * some of these nights already — but written by the OLD seed, which knew about
 * nine columns and not about the fifteen that carry what a night actually is.
 * Those rows have no lineup, no age rule, no entry note, no promotion, the
 * wrong description, and — the one that matters — `ticketing_enabled` and
 * `tables_enabled` sitting at whatever the column default happened to be.
 *
 * Until this change nothing read those two, so nothing was wrong. Now the
 * public site and both gates read them, and a Saturday whose row says
 * `tables_enabled = false` because of a DEFAULT is a Saturday that stops taking
 * tables the moment this deploys.
 *
 * So the values that used to live in the source — in the poster wall's array,
 * where the club could not reach them — are copied ONTO THE ROW ONCE.
 *
 * ═══ ONCE. NOT ON EVERY DEPLOY ════════════════════════════════════════════
 *
 * `ON CONFLICT DO NOTHING` cannot express this: the row exists, so an INSERT
 * does nothing and an UPDATE would run for ever, putting the club's own edits
 * back every time a container started. That is the exact failure this whole
 * change exists to prevent, so it must not be reintroduced by the migration
 * that enables it.
 *
 * Hence a ledger: one row, one key, inserted in the SAME TRANSACTION as the
 * adoption. Whoever gets there first claims the key and does the work; every
 * later start finds the key and skips. From then on the office owns every one
 * of these fields, and this code can never touch them again. */
const ADOPTION_KEY = "programme-adoption-2026-08";

async function adoptProgrammeOnce(q: Queryable): Promise<void> {
  const claimed = await q.query(
    `INSERT INTO applied_migrations (id) VALUES ($1)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [ADOPTION_KEY],
  );
  /* Somebody has already done it. The club's edits stand. */
  if (claimed.rowCount === 0) return;

  for (const night of PROGRAMME) {
    /* COALESCE ON THE TEXT FIELDS: a value the office has already typed wins,
       and only a column that is genuinely empty is filled in. The two switches
       and the status are assigned outright, because `false` is a real value
       that COALESCE cannot tell apart from "never set" — and for those the
       wall was the authority right up until this deploy. */
    await q.query(
      `UPDATE events SET
         title             = $2,
         starts_at         = $3,
         doors_at          = COALESCE(doors_at, $4),
         description       = COALESCE(NULLIF(description, ''), $5),
         image             = COALESCE(NULLIF(image, ''), $6),
         status            = $7,
         ticketing_enabled = $8,
         tables_enabled    = $9,
         lineup            = COALESCE(NULLIF(lineup, ''), $10),
         genre             = COALESCE(NULLIF(genre, ''), $11),
         age_restriction   = COALESCE(NULLIF(age_restriction, ''), $12),
         entry_note        = COALESCE(NULLIF(entry_note, ''), $13),
         dress_code        = COALESCE(NULLIF(dress_code, ''), $14),
         promotion         = COALESCE(NULLIF(promotion, ''), $15),
         updated_at        = now()
       WHERE id = $1 AND archived_at IS NULL`,
      [
        night.id,
        night.title,
        night.startsAt,
        night.doorsAt ?? null,
        night.description ?? null,
        night.image,
        night.status,
        night.ticketingEnabled,
        night.tablesEnabled,
        night.lineup ?? null,
        /* `genre` left empty — the concept is gone from the product and this
           parameter only survives so the numbering after it does. */
        null,
        night.ageRestriction ?? null,
        night.entryNote ?? null,
        night.dressCode ?? null,
        night.promotion ?? null,
      ],
    );
  }
}

/* ── the two probe nights, and the lock on them ─────────────────────────── */

/* NIGHTS THAT EXIST ONLY SO THE SYSTEM CAN BE TESTED, AND ONLY WHERE IT MAY BE.
 *
 * ═══ WHY THEY ARE NO LONGER SEEDED EVERYWHERE ═════════════════════════════
 *
 * They used to sit in the same list as the club's real programme and were
 * inserted on every database this system had ever touched — including the one
 * the club actually uses. So a person opening /admin/dogadjaji to run their
 * business found "Plitvice Test Night" and "Plitvice Test Night — mala sala"
 * on the list next to Saturday Madness. `test_only` kept them off the public
 * site and out of every sale, which is what it is for, and it did nothing at
 * all about the office having to look at them.
 *
 * ═══ THE LOCK IS THE ONE THAT ALREADY EXISTS ══════════════════════════════
 *
 * `devMode()` — TICKETING_DEV_MODE=true AND not a production build, both — is
 * already the gate on every other thing that can mint a ticket without money
 * changing hands. These rows are the events those flows sell into, so they
 * belong behind exactly the same gate rather than a second one invented here.
 *
 * On a laptop and in `npm test` they are created and everything that needs a
 * night to sell has one. On the club's server they are never written at all,
 * and scripts/clean-test-events.mjs removes the ones an older deploy left. */
const FIXTURE_NIGHTS = [
  {
    id: "evt_test_night",
    slug: "test-night",
    title: "Plitvice Test Night",
    startsAt: "2099-12-31T23:00:00+01:00",
    description:
      "Probna večer koja postoji samo da bi se sistem ulaznica mogao testirati.",
    image: "/dogadjaji/vodka.jpg",
    status: "on_sale",
    ticketPrice: 1000,
    capacity: 50,
    maxPerOrder: 10,
  },
  {
    id: "evt_test_night_small",
    slug: "test-night-small",
    title: "Plitvice Test Night — mala sala",
    startsAt: "2099-12-30T23:00:00+01:00",
    description:
      "Druga probna večer, namerno mala, za proveru rasprodaje i istovremenih kupovina.",
    image: "/dogadjaji/vodka.jpg",
    status: "on_sale",
    /* Deliberately tiny: this is the night the load test sells out, and a room
       of five hundred would take an hour to prove the same thing. */
    capacity: 20,
    ticketPrice: 1500,
    maxPerOrder: 4,
  },
] as const;

async function seedFixtures(q: Queryable): Promise<void> {
  if (!devMode()) return;

  for (const night of FIXTURE_NIGHTS) {
    await q.query(
      `INSERT INTO events (
         id, slug, title, starts_at, description, image, status,
         ticket_price, currency, capacity, max_per_order, test_only,
         venue_id, ticketing_enabled, tables_enabled, floor_plan
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'RSD',$9,$10,true,
                 'plitvice',true,false,'default')
       ON CONFLICT (id) DO NOTHING`,
      [
        night.id,
        night.slug,
        night.title,
        night.startsAt,
        night.description,
        night.image,
        night.status,
        night.ticketPrice,
        night.capacity,
        night.maxPerOrder,
      ],
    );
  }
}
