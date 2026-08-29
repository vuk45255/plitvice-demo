/* THE PRODUCTION CLEANUP'S SQL, RUN AGAINST A REAL POSTGRES.
 *
 * ═══ WHY THIS FILE EXISTS ═════════════════════════════════════════════════
 *
 * scripts/production-test-data-cleanup.mjs refuses to run against anything but
 * the club's own server — correctly, because that is the only database worth
 * cleaning. The consequence was that its statements were first executed, ever,
 * against Neon. One of them was wrong:
 *
 *     WHERE (lower(r.email) LIKE 1)
 *     operator does not exist: text ~~ integer          -- 42883, at char 94
 *
 * The query had built its own placeholders — `LIKE $${i + 1}` — and an edit
 * dropped a dollar, so the interpolation emitted the NUMBER 1 where the
 * placeholder token $1 belonged. There WAS a harness covering that query, and
 * it passed, because the harness held its own retyped copy of the SQL. It
 * proved the copy was fine and said nothing about the script.
 *
 * So the statements moved to lib/club/cleanup-sql.ts, and this runs those exact
 * strings — the same characters the script sends — against a real Postgres. In
 * memory, nothing mocked, exactly like every other suite here.
 *
 * ═══ WHAT IS BEING GUARDED ════════════════════════════════════════════════
 *
 * Two different things, and both matter:
 *
 *   · that every statement PARSES AND TYPES against a real server, which is
 *     what the production run found out the hard way;
 *   · that the cleanup still removes only what a harness deliberately wrote,
 *     and that the club's own nights, orders and tables survive it. A cleanup
 *     that runs without error and takes Saturday Madness with it is worse than
 *     one that crashes. */

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { closeDatabase, query, tx } from "@/lib/db/client";
import { partitionEvents } from "@/lib/club/test-data";
import { PROGRAMME } from "@/lib/club/programme-seed";
import { createOrder, confirmPayment } from "@/lib/ticketing/orders";
import * as SQL from "@/lib/club/cleanup-sql";

const ORIGIN = "https://plitviceclub.test";
const MADNESS = "saturday-madness";
const VODKA = "vodka-experience";

/* A stress night, named the way scripts/stress.mjs names one. */
const STRESS_SLUG = "stress-oversell-991122";
const STRESS_ID = "evt_stress_991122";

beforeEach(async () => {
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
  await query(`DELETE FROM mail_deliveries`);
  await query(`DELETE FROM seat_holds`);
  await query(`DELETE FROM reservations`);
  await query(`DELETE FROM events WHERE id = $1`, [STRESS_ID]);

  /* THE SEEDED NIGHT, KEPT AHEAD OF THE CLOCK — see the same note in
     lib/reservations/holds.test.ts. The club's real row is dated 29 August
     2026; only the year moves, so this suite can still sell a ticket to it
     next year. And it is switched on for sale, because the club's own row
     takes entry at the door and this suite needs an order on a real night. */
  await query(
    `UPDATE events
        SET starts_at = $1, doors_at = $1, ticketing_enabled = true, ticket_price = 1000
      WHERE slug = $2`,
    [`${new Date().getUTCFullYear() + 5}-08-29T22:00:00+02:00`, MADNESS],
  );
});

after(async () => {
  await closeDatabase();
});

/* ═══ 1 — THE STATEMENTS THEMSELVES ══════════════════════════════════════ */

describe("the cleanup's SQL", () => {
  it("builds no placeholder, in any statement", () => {
    /* THE REGRESSION, STATED AS A RULE. `LIKE $${i + 1}` is how the broken
       query was written; a statement that interpolates anything at all can
       lose a character and still look right. Every one of these is a constant
       from first character to last. */
    for (const [name, sql] of Object.entries(SQL.ALL_STATEMENTS)) {
      assert.ok(
        !sql.includes("${"),
        `${name} constructs part of itself — the one thing these must never do`,
      );
      /* And every dollar in them is a real placeholder token, never a bare
         number left behind by an interpolation that lost its $. */
      for (const match of sql.matchAll(/LIKE\s+(\S+)/g)) {
        assert.ok(
          match[1].startsWith("$") || match[1].startsWith("ANY("),
          `${name} has \`LIKE ${match[1]}\` — a LIKE must take a parameter`,
        );
      }
    }
  });

  it("lists every statement it exports, so none can escape these checks", () => {
    /* ALL_STATEMENTS is written by hand, and both guards in this file iterate
       IT rather than the module. So a statement added here and wired into the
       script but forgotten in that object would be checked by nothing, and its
       first execution ever would be against the club's database — which is the
       exact accident this whole file exists to prevent. Derived from the real
       exports, an omission fails here instead. */
    for (const [key, value] of Object.entries(SQL)) {
      if (typeof value !== "string") continue;
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
      assert.ok(
        key in SQL.ALL_STATEMENTS,
        `${key} is exported but missing from ALL_STATEMENTS, so nothing checks it`,
      );
    }
  });

  it("parses and types against a real Postgres, every one of them", async () => {
    /* THE TEST THE PRODUCTION RUN HAD TO BE. A statement that Postgres refuses
       fails here rather than at character 94 of a dry run against the club's
       database. The DELETEs are handed empty lists, so they are fully planned
       and executed and match nothing. */
    const noIds: string[] = [];
    const patterns = SQL.domainPatterns(SQL.HINT_EMAIL_DOMAINS);

    const runs: [string, string, unknown[]][] = [
      ["SELECT_EVENTS", SQL.SELECT_EVENTS, []],
      ["SELECT_MARKED_ORDERS", SQL.SELECT_MARKED_ORDERS, [SQL.TEST_CHANNELS, SQL.TEST_PROVIDERS, SQL.TEST_CUSTOMER_NAMES]],
      ["SELECT_UNMARKED_PAID_ON_FIXTURES", SQL.SELECT_UNMARKED_PAID_ON_FIXTURES, [noIds, SQL.TEST_CHANNELS, SQL.TEST_PROVIDERS, SQL.TEST_CUSTOMER_NAMES]],
      ["SELECT_ORDER_IDS_FOR_EVENTS", SQL.SELECT_ORDER_IDS_FOR_EVENTS, [noIds]],
      ["SELECT_RESERVATION_IDS_FOR_EVENTS", SQL.SELECT_RESERVATION_IDS_FOR_EVENTS, [noIds]],
      ["SELECT_FOOTPRINT", SQL.SELECT_FOOTPRINT, [noIds, noIds]],
      ["COUNT_MAIL_FOR_KEYS", SQL.COUNT_MAIL_FOR_KEYS, [noIds]],
      ["SELECT_DEV_ON_KEPT_NIGHTS", SQL.SELECT_DEV_ON_KEPT_NIGHTS, [SQL.FIXTURE_ONLY_PROVIDERS, noIds]],
      /* THE ONE THAT BROKE. Run with the real patterns, against real rows. */
      ["SELECT_RESERVATIONS_BY_EMAIL_DOMAIN (hint)", SQL.SELECT_RESERVATIONS_BY_EMAIL_DOMAIN, [patterns, noIds]],
      ["SELECT_RESERVATIONS_BY_EMAIL_DOMAIN (reserved)", SQL.SELECT_RESERVATIONS_BY_EMAIL_DOMAIN, [SQL.domainPatterns(SQL.RESERVED_EMAIL_DOMAINS), noIds]],
      ["COUNT_FOR_ONE_EVENT", SQL.COUNT_FOR_ONE_EVENT, ["evt_saturday_madness", MADNESS]],
      ["DELETE_SCANS_FOR_ORDERS", SQL.DELETE_SCANS_FOR_ORDERS, [noIds]],
      ["DELETE_TICKET_DELIVERIES_FOR_ORDERS", SQL.DELETE_TICKET_DELIVERIES_FOR_ORDERS, [noIds]],
      ["DELETE_MAIL_FOR_KEYS", SQL.DELETE_MAIL_FOR_KEYS, [noIds]],
      ["DELETE_TICKETS_FOR_ORDERS", SQL.DELETE_TICKETS_FOR_ORDERS, [noIds]],
      ["DELETE_ORDERS", SQL.DELETE_ORDERS, [noIds]],
      ["DELETE_HOLDS_FOR_EVENTS", SQL.DELETE_HOLDS_FOR_EVENTS, [noIds]],
      ["DELETE_RESERVATIONS_FOR_EVENTS", SQL.DELETE_RESERVATIONS_FOR_EVENTS, [noIds]],
      ["DELETE_EVENTS", SQL.DELETE_EVENTS, [noIds]],
    ];

    /* Every statement in the module is covered; a new one added without a run
       here fails this rather than being discovered in production. */
    const covered = new Set(
      runs.map(([name]) => name.replace(/ \(.*\)$/, "")),
    );
    for (const name of Object.keys(SQL.ALL_STATEMENTS)) {
      assert.ok(covered.has(name), `${name} is never executed by this test`);
    }

    for (const [name, sql, params] of runs) {
      try {
        await query(sql, params);
      } catch (error) {
        assert.fail(`${name} was refused by Postgres: ${(error as Error).message}`);
      }
    }
  });

  it("matches an address by domain — the behaviour the broken query lost", async () => {
    await query(
      `INSERT INTO reservations (id,event_id,seat_id,seat_type,zone,guests,name,phone,email,note,phone_key,email_key,status,source)
       VALUES ('r_hint','vodka-experience','B07','bar','1',4,'Gost','069','GOST@Primer.RS','','069','gost@primer.rs','confirmed','web')`,
    );
    await query(
      `INSERT INTO reservations (id,event_id,seat_id,seat_type,zone,guests,name,phone,email,note,phone_key,email_key,status,source)
       VALUES ('r_real','vodka-experience','B08','bar','1',4,'Marko','0645','marko@gmail.com','','0645','marko@gmail.com','confirmed','web')`,
    );

    const hit = await query<{ event_id: string; n: number }>(
      SQL.SELECT_RESERVATIONS_BY_EMAIL_DOMAIN,
      [SQL.domainPatterns(SQL.HINT_EMAIL_DOMAINS), []],
    );
    assert.equal(hit.rows.length, 1);
    assert.equal(hit.rows[0].event_id, VODKA);
    /* Upper case in the stored address is matched: the statement lowers it. */
    assert.equal(hit.rows[0].n, 1, "the guest on gmail is not a test row");
  });
});

/* ═══ 2 — THE RUN, END TO END ════════════════════════════════════════════ */

/* Everything the script does, in the script's order, using the script's
   statements. What is NOT reproduced here is the guards — those refuse before
   any of this and are exercised by running the script itself. */
async function seedDebris() {
  /* A stress night, and a paid order on it. */
  await query(
    `INSERT INTO events (id,slug,title,starts_at,status,ticket_price,capacity,max_per_order,test_only,currency)
     VALUES ($1,$2,'Stress oversell 991122', now() + interval '30 days','on_sale',1000,50,10,true,'RSD')`,
    [STRESS_ID, STRESS_SLUG],
  );
  const stress = await createOrder(
    { eventSlug: STRESS_SLUG, quantity: 2, buyer: { name: "Stress 1", email: "stress-991122-1@example.com", phone: "0691000000" } },
    {},
  );
  assert.ok(stress.ok, "the stress order");
  assert.ok((await confirmPayment(stress.order.id, { provider: "stress" }, ORIGIN)).ok);

  /* A scanner-test order on a REAL night — the case an event-shaped cleanup
     cannot see, and must not take the night to reach. */
  const scanner = await createOrder(
    { eventSlug: MADNESS, quantity: 1, buyer: { name: "SCANNER TEST", email: "scanner-test@plitviceklub.rs", phone: "+381600000000" } },
    { channel: "scanner-test" },
  );
  assert.ok(scanner.ok, "the scanner-test order");
  const scannerPaid = await confirmPayment(scanner.order.id, { provider: "scanner-test" }, ORIGIN);
  assert.ok(scannerPaid.ok);
  await query(
    `INSERT INTO ticket_scans (ticket_id, event_id, outcome, door, scanned_by)
     VALUES ($1, 'evt_saturday_madness', 'redeemed', 'ulaz', 'Test')`,
    [scannerPaid.tickets[0].id],
  );

  /* A REAL guest's order on the same real night. */
  const real = await createOrder(
    { eventSlug: MADNESS, quantity: 2, buyer: { name: "Marko Marković", email: "marko@gmail.com", phone: "0645551234" } },
    {},
  );
  assert.ok(real.ok, "the real order");
  assert.ok((await confirmPayment(real.order.id, { provider: "payspot" }, ORIGIN)).ok);

  /* A dev-mode payment on a real night: ambiguous, and must survive. */
  const dev = await createOrder(
    { eventSlug: MADNESS, quantity: 2, buyer: { name: "Ana Anić", email: "ana@gmail.com", phone: "0645559999" } },
    {},
  );
  assert.ok(dev.ok, "the dev-paid order");
  await query(
    `UPDATE ticket_orders SET payment_status='paid', payment_provider='dev', paid_at=now() WHERE id=$1`,
    [dev.order.id],
  );

  /* The floor and the post, for the stress night. */
  await query(
    `INSERT INTO reservations (id,event_id,seat_id,seat_type,zone,guests,name,phone,email,note,phone_key,email_key,status,source)
     VALUES ('r_stress',$1,'B01','bar','1',4,'Stress','069','s@example.com','','069','s@example.com','confirmed','web')`,
    [STRESS_SLUG],
  );
  await query(
    `INSERT INTO seat_holds (id,event_id,seat_id,token,status,expires_at)
     VALUES ('h_stress',$1,'B02','tok','active', now() + interval '3 minutes')`,
    [STRESS_SLUG],
  );
  await query(`INSERT INTO mail_deliveries (kind,key,recipient,status) VALUES ('ticket',$1,'x@example.com','sent')`, [stress.order.id]);
  await query(`INSERT INTO mail_deliveries (kind,key,recipient,status) VALUES ('reservation-guest','r_stress','x@example.com','sent')`);

  /* A table booked by the local reservation check, on a night that stays. */
  await query(
    `INSERT INTO reservations (id,event_id,seat_id,seat_type,zone,guests,name,phone,email,note,phone_key,email_key,status,source)
     VALUES ('r_hinted',$1,'B07','bar','1',4,'Gost 12','06912','gost12@primer.rs','','06912','gost12@primer.rs','confirmed','web')`,
    [VODKA],
  );

  return { realOrderId: real.order.id, devOrderId: dev.order.id };
}

/* The script's own pipeline, over the module's own statements. */
async function plan() {
  const protectedSlugs = new Set(PROGRAMME.map((night) => night.slug));
  const rows = await query<{ id: string; slug: string; title: string; test_only: boolean }>(
    SQL.SELECT_EVENTS,
  );
  const events = rows.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    testOnly: Boolean(r.test_only),
  }));
  const { fixtures, keep } = partitionEvents(events, protectedSlugs);
  const fixtureIds = fixtures.map(({ event }) => event.id);

  const marked = await query<{ id: string; event_id: string; event_slug: string; customer_name: string }>(
    SQL.SELECT_MARKED_ORDERS,
    [SQL.TEST_CHANNELS, SQL.TEST_PROVIDERS, SQL.TEST_CUSTOMER_NAMES],
  );

  const unmarked = fixtureIds.length
    ? (
        await query<{ event_id: string }>(SQL.SELECT_UNMARKED_PAID_ON_FIXTURES, [
          fixtureIds,
          SQL.TEST_CHANNELS,
          [...SQL.TEST_PROVIDERS, ...SQL.FIXTURE_ONLY_PROVIDERS],
          SQL.TEST_CUSTOMER_NAMES,
        ])
      ).rows
    : [];

  const held = new Set(unmarked.map((r) => r.event_id));
  const condemned = fixtures.filter(({ event }) => !held.has(event.id));
  const condemnedIds = condemned.map(({ event }) => event.id);
  const condemnedSlugs = condemned.map(({ event }) => event.slug);
  /* EVERY FIXTURE, NOT ONLY THE CONDEMNED ONES — the script says
     `new Set(fixtureIds)`, and the difference is the whole point of the guard.
     A night that was held back is left ALONE: its marked orders are not strays
     to be swept up separately, because nothing on that night is touched at
     all. Deriving this from `condemnedIds` instead would delete a scanner-test
     order off a night the script had just decided to spare. */
  const onAFixtureNight = new Set(fixtureIds);

  const stray = marked.rows.filter((o) => !onAFixtureNight.has(o.event_id));
  const doomedOrderIds = [
    ...(condemnedIds.length
      ? (await query<{ id: string }>(SQL.SELECT_ORDER_IDS_FOR_EVENTS, [condemnedIds])).rows.map((r) => r.id)
      : []),
    ...stray.map((o) => o.id),
  ];
  const doomedReservationIds = condemnedSlugs.length
    ? (await query<{ id: string }>(SQL.SELECT_RESERVATION_IDS_FOR_EVENTS, [condemnedSlugs])).rows.map((r) => r.id)
    : [];

  return { keep, condemned, condemnedIds, condemnedSlugs, stray, doomedOrderIds, mailKeys: [...doomedOrderIds, ...doomedReservationIds] };
}

async function removeAll(p: Awaited<ReturnType<typeof plan>>) {
  await tx(async (q) => {
    await q.query(SQL.DELETE_SCANS_FOR_ORDERS, [p.doomedOrderIds]);
    await q.query(SQL.DELETE_TICKET_DELIVERIES_FOR_ORDERS, [p.doomedOrderIds]);
    await q.query(SQL.DELETE_MAIL_FOR_KEYS, [p.mailKeys]);
    await q.query(SQL.DELETE_TICKETS_FOR_ORDERS, [p.doomedOrderIds]);
    await q.query(SQL.DELETE_ORDERS, [p.doomedOrderIds]);
    await q.query(SQL.DELETE_HOLDS_FOR_EVENTS, [p.condemnedSlugs]);
    await q.query(SQL.DELETE_RESERVATIONS_FOR_EVENTS, [p.condemnedSlugs]);
    await q.query(SQL.DELETE_EVENTS, [p.condemnedIds]);
  });
}

const count = async (sql: string, params: unknown[] = []) =>
  (await query<{ n: number }>(sql, params)).rows[0].n;

describe("what the cleanup would take, and what it leaves", () => {
  it("names every fixture night, and not one night of the club's own", async () => {
    await seedDebris();
    const p = await plan();

    /* The stress night this suite made, plus the two probe nights the schema
       seeds when dev mode is open — which is the state `npm test` runs in, and
       exactly the debris an older deploy could have left on the real server. */
    assert.deepEqual(
      [...p.condemnedSlugs].sort(),
      ["stress-oversell-991122", "test-night", "test-night-small"],
    );

    /* AND THE PROGRAMME IS UNTOUCHABLE. Not "these two are absent" — every
       night the club has actually put on, checked one by one. */
    for (const night of PROGRAMME) {
      assert.ok(
        !p.condemnedSlugs.includes(night.slug),
        `${night.slug} is the club's own night and can never be condemned`,
      );
    }
    assert.ok(!p.condemnedSlugs.includes(MADNESS), "Saturday Madness is never a fixture");
    assert.ok(!p.condemnedSlugs.includes(VODKA));
    assert.ok(p.keep.some((e) => e.slug === MADNESS));
    assert.ok(p.keep.some((e) => e.slug === VODKA));
  });

  it("finds the scanner-test order sitting on a real night", async () => {
    await seedDebris();
    const p = await plan();
    assert.equal(p.stray.length, 1, "one marked order on a night that stays");
    assert.equal(p.stray[0].event_slug, MADNESS);
    assert.equal(p.stray[0].customer_name, "SCANNER TEST");
  });

  it("counts the whole footprint before it removes anything", async () => {
    await seedDebris();
    const p = await plan();
    const fp = (
      await query<{ tickets: number; scans: number; deliveries: number; reservations: number; holds: number }>(
        SQL.SELECT_FOOTPRINT,
        [p.doomedOrderIds, p.condemnedSlugs],
      )
    ).rows[0];
    assert.equal(fp.tickets, 3, "two stress admissions and the scanner's one");
    assert.equal(fp.scans, 1);
    assert.equal(fp.reservations, 1);
    assert.equal(fp.holds, 1);
    assert.equal(await count(SQL.COUNT_MAIL_FOR_KEYS, [p.mailKeys]), 2);
  });

  it("reports the dev-paid order on a real night and does not queue it", async () => {
    const { devOrderId } = await seedDebris();
    const p = await plan();

    const dev = await query<{ slug: string; n: number }>(SQL.SELECT_DEV_ON_KEPT_NIGHTS, [
      SQL.FIXTURE_ONLY_PROVIDERS,
      p.condemnedIds,
    ]);
    assert.equal(dev.rows.length, 1);
    assert.equal(dev.rows[0].slug, MADNESS);
    assert.ok(!p.doomedOrderIds.includes(devOrderId), "ambiguous is reported, never removed");
  });

  it("leaves a held-back night completely alone, marked orders included", async () => {
    /* THE GUARD THAT SPARES A NIGHT, AND WHAT "SPARES" HAS TO MEAN.
     *
     * A probe night carrying a paid order that no harness marked is held back —
     * either the flag is wrong or a guest is holding an admission. If that same
     * night also carries a scanner-test order, that order must NOT be swept up
     * as a stray: the night and everything on it is left alone, or the guard is
     * not a guard. */
    await seedDebris();

    /* Somebody bought a front-door ticket to the probe night. */
    const paid = await createOrder(
      { eventSlug: "test-night", quantity: 1, buyer: { name: "Jovana Jović", email: "jovana@gmail.com", phone: "0645550000" } },
      {},
    );
    assert.ok(paid.ok, "a front-door order on the probe night");
    assert.ok((await confirmPayment(paid.order.id, { provider: "payspot" }, ORIGIN)).ok);

    /* And a scanner test was run against that same night. */
    const marked = await createOrder(
      { eventSlug: "test-night", quantity: 1, buyer: { name: "SCANNER TEST", email: "scanner-test@plitviceklub.rs", phone: "+381600000001" } },
      { channel: "scanner-test" },
    );
    assert.ok(marked.ok, "a scanner-test order on the probe night");
    assert.ok((await confirmPayment(marked.order.id, { provider: "scanner-test" }, ORIGIN)).ok);

    const p = await plan();

    assert.ok(!p.condemnedSlugs.includes("test-night"), "the night is held back");
    assert.ok(
      !p.doomedOrderIds.includes(marked.order.id),
      "a marked order on a held-back night is not a stray — the night is left alone",
    );
    assert.ok(!p.doomedOrderIds.includes(paid.order.id));

    await removeAll(p);

    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM events WHERE slug = 'test-night'`), 1);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM ticket_orders WHERE id = $1`, [marked.order.id]), 1);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM ticket_orders WHERE id = $1`, [paid.order.id]), 1);
    /* The stress night beside it still goes. */
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM events WHERE slug = $1`, [STRESS_SLUG]), 0);
  });

  it("removes the test data and nothing else, and leaves nothing orphaned", async () => {
    const { realOrderId, devOrderId } = await seedDebris();
    const p = await plan();
    await removeAll(p);

    /* Gone. */
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM events WHERE slug = $1`, [STRESS_SLUG]), 0);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM ticket_orders WHERE customer_name = 'SCANNER TEST'`), 0);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM seat_holds WHERE event_id = $1`, [STRESS_SLUG]), 0);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM mail_deliveries WHERE key = 'r_stress'`), 0);

    /* THE CLUB'S OWN NIGHTS, SAID BY NAME. */
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM events WHERE slug = $1`, [MADNESS]), 1);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM events WHERE slug = $1`, [VODKA]), 1);
    for (const night of PROGRAMME) {
      assert.equal(
        await count(`SELECT COUNT(*)::int AS n FROM events WHERE slug = $1`, [night.slug]),
        1,
        `${night.slug} is part of the club's programme and must survive`,
      );
    }

    /* The real guest, the ambiguous order, and the hinted table. */
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM ticket_orders WHERE id = $1`, [realOrderId]), 1);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM ticket_orders WHERE id = $1`, [devOrderId]), 1);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM reservations WHERE id = 'r_hinted'`), 1);
    assert.equal(
      await count(`SELECT COUNT(*)::int AS n FROM tickets WHERE event_id = 'evt_saturday_madness' AND status = 'valid'`),
      2,
      "the real guest's two admissions",
    );

    /* NOTHING LEFT POINTING AT NOTHING. */
    assert.equal(
      await count(`SELECT COUNT(*)::int AS n FROM tickets t LEFT JOIN ticket_orders o ON o.id = t.order_id WHERE o.id IS NULL`),
      0,
      "orphan tickets",
    );
    assert.equal(
      await count(`SELECT COUNT(*)::int AS n FROM ticket_scans s LEFT JOIN tickets t ON t.id = s.ticket_id
                    WHERE s.ticket_id IS NOT NULL AND t.id IS NULL`),
      0,
      "orphan scans",
    );
    assert.equal(
      await count(`SELECT COUNT(*)::int AS n FROM ticket_deliveries d LEFT JOIN ticket_orders o ON o.id = d.order_id WHERE o.id IS NULL`),
      0,
      "orphan deliveries",
    );
    assert.equal(
      await count(`SELECT COUNT(*)::int AS n FROM ticket_orders o LEFT JOIN events e ON e.id = o.event_id WHERE e.id IS NULL`),
      0,
      "orders pointing at a night that is gone",
    );
  });

  it("does nothing at all when there is nothing to do", async () => {
    /* The empty-list case, which is what a second run looks like. Every
       statement is still executed; none of them may match anything. */
    const before = await count(`SELECT COUNT(*)::int AS n FROM events`);
    await removeAll({ condemnedIds: [], condemnedSlugs: [], doomedOrderIds: [], mailKeys: [] } as unknown as Awaited<ReturnType<typeof plan>>);
    assert.equal(await count(`SELECT COUNT(*)::int AS n FROM events`), before);
  });
});
