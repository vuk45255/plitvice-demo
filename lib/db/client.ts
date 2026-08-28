/* THE DATABASE, AND THE ONE PLACE THAT KNOWS WHICH ONE IT IS.
 *
 * Everything above this file speaks Postgres and nothing else. There is one
 * dialect, one schema and one set of guarantees, whether the server is a
 * laptop in Inđija or a function on Vercel — because a system whose local
 * behaviour differs from its production behaviour is a system whose tests
 * prove nothing about the night it actually has to survive.
 *
 * ═══ TWO DRIVERS, ONE POSTGRES ════════════════════════════════════════════
 *
 *   DATABASE_URL set   → `pg`, talking to a real Postgres server. This is
 *                        Vercel: Neon, Vercel Postgres, Supabase, anything
 *                        that speaks the wire protocol. USE THE POOLED
 *                        CONNECTION STRING — a serverless function opens and
 *                        drops connections constantly and a direct endpoint
 *                        will run out of them.
 *
 *   DATABASE_URL unset → PGlite: the same Postgres, compiled to WebAssembly
 *                        and running inside this process, writing to
 *                        `.data/pglite`. Not a mock and not a different
 *                        database — actual Postgres, with actual transactions,
 *                        actual partial unique indexes and actual
 *                        `SELECT … FOR UPDATE`. It survives a restart, which
 *                        is the whole point, and it needs no Docker, no
 *                        service and no account to run on a Windows laptop.
 *
 * The SQL is identical for both. That is the reason for this choice and not a
 * happy accident: the moment the two dialects diverge, the concurrency
 * guarantees stop being testable.
 *
 * ═══ WHY THE GUARANTEES LIVE IN SQL AND NOT IN JAVASCRIPT ═════════════════
 *
 * The previous implementation kept orders and tickets in a Map and relied on
 * the fact that one Node process runs one function to completion. On Vercel
 * there is no "one process": there are as many as the traffic asks for, and
 * they share nothing. Two guests buying the last ticket land on two machines,
 * both count 499 sold, and both sell it.
 *
 * So every rule that must not be raced is written as one SQL statement or one
 * transaction, and the database is what enforces it:
 *
 *   · no overselling      — the event row is locked FOR UPDATE, the held and
 *                           paid admissions are counted inside that lock, and
 *                           the order is inserted before it is released.
 *   · one admission       — UPDATE … WHERE status = 'valid' RETURNING; the
 *                           condition is inside the write.
 *   · one set of tickets  — UNIQUE (order_id, seq); a retried webhook loses.
 *   · one hold per table  — a partial UNIQUE index on the live rows.
 *
 * ═══ CONNECTIONS ══════════════════════════════════════════════════════════
 *
 * Both drivers are held on `globalThis`, because a Next dev server reloads
 * modules on every edit and a pool per edit is a pool leak. In production the
 * module is evaluated once per lambda instance and the pool is reused across
 * invocations, which is what a pool is for. */

import { ensureSchema } from "@/lib/db/schema";
import { timed } from "@/lib/db/profile";

/* What a query gives back. Deliberately the smallest shape both drivers
   already have, so neither has to be wrapped. */
export type QueryResult<T> = { rows: T[]; rowCount: number };

/* Anything a statement can be sent to: the pool itself, or one transaction.
   Every function in the stores takes this rather than reaching for the pool,
   which is what lets a caller compose several of them into one transaction. */
export type Queryable = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>>;
};

type Driver = Queryable & {
  transaction<T>(run: (tx: Queryable) => Promise<T>): Promise<T>;
  /* What is on the other end, for the admin page and the start-up log. */
  kind: "postgres" | "pglite";
  close(): Promise<void>;
};

const globalDb = globalThis as unknown as {
  __plitviceDriver?: Promise<Driver>;
  __plitviceReady?: Promise<Driver>;
};

/* ── choosing, and building, the driver ─────────────────────────────────── */

function connectionString(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.DATABASE_URL ?? env.POSTGRES_URL ?? null;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/* ── THE ONE MISCONFIGURATION THAT MUST NOT BE SURVIVED ─────────────────── */

/* A production server with no DATABASE_URL does not quietly start PGlite.
 *
 * It would look like it worked, which is the danger. On Vercel each instance
 * has its own filesystem and its own copy of that database: two guests buying
 * the last ticket would be counted by two different Postgres instances, the
 * partial unique index that gives one separe to one guest would be enforced
 * against a table nobody else can see, and the whole file above would be
 * telling the truth about a database that is not shared. Every guarantee in
 * this system is "the database decided"; a per-instance database decides
 * nothing. Worse, the disk is thrown away on the next deploy, so the evening's
 * orders go with it.
 *
 * So it fails, here, loudly, on the first query — before an order exists to be
 * lost — and says which variable is missing.
 *
 * PGLITE_ALLOW_PRODUCTION is the deliberate exception, for the one deployment
 * where PGlite in production is defensible: a single always-on Node process on
 * a machine with a real disk. It has to be typed out; nothing sets it by
 * accident. */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set, and this is a production build.\n\n" +
        "Plitvice will not fall back to the in-process database on a production\n" +
        "server: on Vercel every instance would get a private copy of it, so no\n" +
        "count of what is sold and no hold on a table would be shared between\n" +
        "them — and the whole thing is discarded on the next deploy.\n\n" +
        "Set DATABASE_URL to a POOLED Postgres connection string (Neon, Vercel\n" +
        "Postgres, Supabase). See .env.example.\n\n" +
        "If this really is a single always-on Node process with a persistent\n" +
        "disk, set PGLITE_ALLOW_PRODUCTION=true to say so on purpose.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/* ── "COME BACK IN A MOMENT" IS A DIFFERENT ANSWER FROM "SOMETHING BROKE" ── */

/* Was this failure the database being BUSY rather than the request being
 * wrong — and, crucially, is it a failure in which NOTHING WAS WRITTEN?
 *
 * Three cases qualify, and each one is safe to retry because each one happens
 * before or instead of a commit:
 *
 *   · the pool's own acquisition timeout ("timeout exceeded when trying to
 *     connect"). No connection was ever taken, so no transaction began.
 *   · 57014 — the statement was cancelled (our `statement_timeout`). The
 *     transaction it was in is rolled back; nothing survives it.
 *   · 55P03 / 53300 — a lock could not be taken, or the server has no
 *     connections left. Neither wrote anything.
 *
 * WHAT IS DELIBERATELY NOT HERE: connection failures (08006, 08003, 08001). A
 * connection that dies mid-COMMIT is genuinely ambiguous — the order may or may
 * not exist — and telling a buyer "try again" would be inviting a second order
 * for seats they may already hold. An ambiguous failure stays an error, and is
 * seen as one.
 *
 * This is the difference between a 503 that says "the queue is full, retry" and
 * a 500 that says nothing at all. It never becomes `sold_out`. */
export function isDatabaseBusy(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && ["57014", "55P03", "53300"].includes(code)) {
    return true;
  }
  const message = String((error as { message?: unknown }).message ?? "");
  return /timeout exceeded when trying to connect/i.test(message);
}

/* Exported so the check itself is testable without starting a database. */
export function assertDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (connectionString(env)) return;
  if (env.NODE_ENV !== "production") return;
  if (env.PGLITE_ALLOW_PRODUCTION === "true") return;
  throw new DatabaseNotConfiguredError();
}

/* Where PGlite keeps its files. In a test run it is left in memory: a test
   that could not start from nothing would be testing whatever the last one
   left behind. Everywhere else it is a directory, because "a restart must not
   lose anything" is a requirement and not a preference. */
function pgliteLocation(): string {
  if (process.env.PGLITE_MEMORY === "true") return "memory://";
  const dir = process.env.PGLITE_DIR?.trim();
  return dir ? dir : ".data/pglite";
}

async function buildDriver(): Promise<Driver> {
  /* Before anything is opened, and therefore before anything is written. */
  assertDatabaseConfigured();

  const url = connectionString();

  if (url) {
    /* Imported dynamically so that a deployment running on PGlite never
       loads `pg`, and a deployment running on Postgres never loads three
       megabytes of WebAssembly. */
    const pg = await import("pg");
    const Pool = (pg as unknown as { default?: { Pool: typeof pg.Pool } }).default?.Pool ?? pg.Pool;

    const pool = new Pool({
      connectionString: url,
      /* A serverless function serves one request at a time; a handful of
         connections per instance is plenty and hundreds are a way to exhaust
         the server. THIS NUMBER IS ABOUT ONE INSTANCE, not about how much
         traffic the club can take — twenty lambdas with five each is a hundred
         connections at the server, which is why it stays small. A single
         process that generates load on purpose (scripts/stress.mjs) is a
         different shape of client and raises it through the environment. */
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      /* HOW LONG A CALLER WAITS FOR A CONNECTION BEFORE GIVING UP.
       *
       * Ten seconds looked generous until a burst was actually measured. With
       * five connections, a queue of a hundred operations against a database
       * one network hop away is arithmetic: ~5 round trips per checkout
       * transaction, ~50ms each from outside the data centre, ~250ms of
       * connection time per order, twenty waves — fourteen seconds, and the
       * back of the queue was thrown out with "timeout exceeded when trying to
       * connect" while the database itself was perfectly healthy.
       *
       * A QUEUE IS NOT A FAULT. Twenty seconds lets a burst drain in order
       * instead of failing at the door, and is still far below the point where
       * a caller should be told something is wrong: a Vercel function's own
       * limit arrives first, which is the correct thing to hit. */
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 20_000),
      /* Managed Postgres is TLS with a certificate chain the platform trusts;
         `sslmode=require` in the URL is what turns it on, and this keeps a
         self-signed development server usable without one. */
      ssl: /sslmode=(require|verify)/.test(url) ? { rejectUnauthorized: false } : undefined,
      /* A CEILING ON HOW LONG ANY ONE STATEMENT MAY HOLD A CONNECTION — and,
       * with it, whatever row locks that statement is holding. Fifteen seconds
       * is orders of magnitude more than anything this system does (the
       * heaviest is a lock, a count and an insert), so in production it can
       * only fire on something genuinely wedged: a network partition
       * mid-statement, a lock nobody will release. Without it, one stuck query
       * on an instance that is then frozen holds the event row until the
       * database itself times out, and every checkout for that night queues
       * behind it.
       *
       * IT IS RAISED — never removed — BY THE STRESS SCRIPT. Three hundred
       * checkouts queued behind ONE event row from ONE process is a lock
       * queue no real traffic produces (a hundred lambdas each do one), and
       * fifteen seconds of legitimate queueing there would abort statements
       * that are behaving perfectly. Matching the guard to the client is not
       * the same as loosening it for production, which keeps this number. */
      statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 15_000),
    });

    /* ═══ THE LISTENER THAT KEEPS THE PROCESS ALIVE ══════════════════════
     *
     * `pg` emits `error` on the POOL when an IDLE client dies — which is not
     * an edge case on managed Postgres: Neon and Supabase close idle
     * connections routinely, and every deploy and failover does it to every
     * connection at once. An `error` event on an EventEmitter WITH NO LISTENER
     * is thrown as an uncaught exception, which takes the instance down.
     *
     * There is nothing to do about it beyond noticing: the pool discards the
     * dead client itself and the next caller gets a fresh one. But it must be
     * heard. */
    pool.on("error", (error: unknown) => {
      console.error("[db] idle client error (connection discarded)", error);
    });

    return {
      kind: "postgres",
      async query(text, params) {
        const result = await pool.query(text, params as unknown[]);
        return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
      },
      async transaction(run) {
        /* Timed because "waiting for a connection" and "waiting for a row
           lock" look identical from outside and have opposite fixes. Off
           unless DATABASE_PROFILE is set — see lib/db/profile.ts. */
        const client = await timed("pool.acquire", () => pool.connect());
        /* Set when the connection can no longer be trusted, so it is DESTROYED
           rather than returned to the pool. A client whose ROLLBACK failed may
           still be inside an aborted transaction; handing that back means the
           next caller's first statement fails for a reason that has nothing to
           do with them, and the pool never heals. `release(err)` is how
           node-postgres is told to throw the connection away. */
        let poisoned: Error | undefined;
        try {
          await timed("tx.begin", () => client.query("BEGIN"));
          const value = await run({
            async query(text, params) {
              const result = await client.query(text, params as unknown[]);
              return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
            },
          });
          await timed("tx.commit", () => client.query("COMMIT"));
          return value;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            /* The connection is already gone, or is wedged; either way the
               transaction died with it and the client must not be reused. */
            poisoned =
              rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
          }
          throw error;
        } finally {
          /* Released on EVERY path — returned to the pool when it is healthy,
             destroyed when it is not. */
          client.release(poisoned);
        }
      },
      async close() {
        await pool.end();
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");

  if (process.env.NODE_ENV === "production") {
    /* Only reachable through PGLITE_ALLOW_PRODUCTION, which somebody typed on
       purpose — and which they should be reminded of in the log every time the
       server starts. */
    console.warn(
      "[db] running PGlite in production by PGLITE_ALLOW_PRODUCTION. " +
        "This is correct only for ONE always-on process with a persistent disk.",
    );
  }

  const location = pgliteLocation();
  if (!location.startsWith("memory://")) {
    /* PGlite creates its data directory but not the directory ABOVE it, so a
       first run against `.data/pglite` fails on a missing `.data` with an
       ENOENT that says nothing useful. One line, and the first run works. */
    const { mkdirSync } = await import("node:fs");
    mkdirSync(location, { recursive: true });
  }

  const pglite = new PGlite(location);
  await pglite.waitReady;

  /* PGlite reports a SELECT's rows in `rows` and an UPDATE's or DELETE's count
     in `affectedRows`, where `pg` puts both in `rowCount`. The difference
     matters: several rules in this system are "did that write touch anything",
     and reading `rows.length` after an UPDATE without RETURNING answers zero
     every time. */
  const counted = <T>(result: { rows: unknown[]; affectedRows?: number }) => ({
    rows: result.rows as T[],
    rowCount: result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0),
  });

  return {
    kind: "pglite",
    async query(text, params) {
      return counted(await pglite.query(text, params as unknown[]));
    },
    async transaction(run) {
      return pglite.transaction(async (transaction) =>
        run({
          async query(text, params) {
            return counted(await transaction.query(text, params as unknown[]));
          },
        }),
      ) as Promise<never>;
    },
    async close() {
      await pglite.close();
    },
  };
}

/* ── the one everything asks for ────────────────────────────────────────── */

/* The driver, with the schema already applied. Both steps are memoised on a
   promise rather than on a value, so a hundred requests arriving during a cold
   start wait on ONE migration rather than racing to run it a hundred times. */
export function database(): Promise<Driver> {
  if (!globalDb.__plitviceReady) {
    globalDb.__plitviceReady = (async () => {
      if (!globalDb.__plitviceDriver) globalDb.__plitviceDriver = buildDriver();
      const driver = await globalDb.__plitviceDriver;
      await ensureSchema(driver);
      return driver;
    })().catch((error: unknown) => {
      /* A failed migration must not be remembered as a finished one, or every
         request afterwards would be told the database is ready. */
      globalDb.__plitviceReady = undefined;
      globalDb.__plitviceDriver = undefined;
      throw error;
    });
  }
  return globalDb.__plitviceReady;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const db = await database();
  return db.query<T>(text, params);
}

/* One transaction. EVERY rule that must not be raced goes through here.
 *
 * The callback is handed a `Queryable` and must use it for every statement:
 * reaching for `query` above from inside one would run that statement on a
 * DIFFERENT connection, outside the transaction, which is exactly the race
 * being closed. */
export async function tx<T>(run: (q: Queryable) => Promise<T>): Promise<T> {
  const db = await database();
  return db.transaction(run);
}

export async function databaseKind(): Promise<"postgres" | "pglite"> {
  return (await database()).kind;
}

/* Closed only by a test run or a script. Nothing the site serves calls it. */
export async function closeDatabase() {
  const driver = await globalDb.__plitviceDriver?.catch(() => undefined);
  await driver?.close();
  globalDb.__plitviceDriver = undefined;
  globalDb.__plitviceReady = undefined;
}
