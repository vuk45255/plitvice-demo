import { register } from "node:module";

/* What every test run needs to be true before a single module is loaded.
 *
 * Passed with `--import`, so this file is fully evaluated before the test file
 * is even resolved. That matters for the first two: they are read when the
 * database driver is built, which happens on the first query, and a test that
 * set them in its own body would be racing its own imports.
 *
 * ═══ THE DATABASE IS REAL, AND IT IS EMPTY ════════════════════════════════
 *
 * PGLITE_MEMORY makes the driver start Postgres in memory rather than in
 * `.data/pglite`. Not a mock — the same Postgres, the same schema, the same
 * partial unique indexes and the same transactions as production; it simply
 * has no file behind it. Two consequences, both wanted: a test run starts from
 * nothing, and a test run cannot touch anything a person was looking at.
 *
 * DATABASE_URL IS DELETED, deliberately and loudly. A developer with a
 * production connection string in their shell would otherwise run a suite that
 * begins by deleting every order in it. */
process.env.PGLITE_MEMORY = "true";
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

/* The nights these tests sell are the test nights, and a test night does not
   exist unless dev mode is open — which is itself one of the things being
   relied on. */
process.env.TICKETING_DEV_MODE = "true";

/* No staff passwords: `gateFor` answers "open" outside production, which is
   what lets the tests exercise the guarded services directly. */
delete process.env.STAFF_ADMIN_PASSWORD;
delete process.env.STAFF_SCANNER_PASSWORD;
delete process.env.SCANNER_ACCESS_CODE;

/* And the resolver that lets `node --test` read the modules as they are
   written — `@/lib/…` and no file extensions. See resolve-alias.mjs. */
register("./resolve-alias.mjs", import.meta.url);
