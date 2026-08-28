# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Site for Plitvice Club, a nightclub in Inđija, Serbia. Next.js App Router. Path alias `@/*` maps to the repo root.

It is really two applications sharing one repository, and the split is the route group:

- **`app/(site)/`** — the public club. Cinematic on purpose: smooth scroll (Lenis), an entrance ceremony, motion, a record player, film grain, a translation provider. Rooted at `app/(site)/page.tsx`.
- **`app/(operations)/`** — tickets, the door and the office: `/t/[token]`, `/karte/[reference]`, `/scanner`, `/osoblje`, `/dev/ticketing`, and the office at `/admin` (overview), `/admin/plan` (the floor as a map), `/admin/rezervacije`, `/admin/karte` (orders and their admissions; `/admin/porudzbine` redirects here), `/admin/dogadjaji`. **None of the above is loaded here** and that is the point — a doorman's phone on one bar of signal must not be carrying a translation of the home page. Keep it that way; the layout at `app/(operations)/layout.tsx` explains why.

**Do not change the public site's design when working on ticketing, and do not make the operational pages cinematic.**

## Commands

- `npm run dev` — dev server at http://localhost:3000 (Turbopack, the default in Next 16)
- `npm run build` — production build (Turbopack; does NOT run linting)
- `npm run lint` — plain ESLint CLI (`next lint` was removed in Next 16); flat config in `eslint.config.mjs`
- `npm test` — Node's own test runner against a real Postgres in memory (see below)
- `npm run loadtest` — hundreds of simultaneous checkouts at a running dev server, to prove no overselling
- `node scripts/check-operational-widths.mjs` — the operational pages at 375/390/404/430px, checking for horizontal overflow
- `npx next typegen` — regenerate route type helpers (`LayoutProps`, `PageProps`)

## The database

**Postgres, one dialect, everywhere.** `lib/db/client.ts` picks the driver:

- `DATABASE_URL` set → `pg` against a real server (Neon / Vercel Postgres / Supabase). **Use the pooled connection string.**
- unset → **PGlite**: the same Postgres compiled to WebAssembly, in-process, writing to `.data/pglite`. Real transactions, real partial unique indexes, real `SELECT … FOR UPDATE`; it survives a restart and needs nothing installed.

The schema is `lib/db/schema.ts`: idempotent DDL run once inside one transaction behind `pg_advisory_xact_lock`. There is no migration tool and does not need to be one — add an `ALTER TABLE … ADD COLUMN IF NOT EXISTS` to the end of the list.

**Read the indexes, not the columns.** Four rules are enforced by the database and by nothing else, because on Vercel two requests are two machines:

| rule | where it lives |
| --- | --- |
| no overselling | `placeOrder` — `SELECT … FOR UPDATE` on the event row, count and insert inside the lock |
| one payment, one set of tickets | `UPDATE … WHERE payment_status = 'pending'`, plus `UNIQUE (order_id, seq)` |
| one admission per ticket | `UPDATE … WHERE status = 'valid' RETURNING` |
| one hold per table | partial `UNIQUE (event_id, seat_id) WHERE status = 'active'` |

Anything that must not be raced goes through `tx()` and is one statement or one transaction. **Never** read-then-write across two calls.

Expiry is always a `timestamptz` compared against the database's `now()` inside the statement that depends on it — never a timer, never `Date.now()` in JavaScript, never a browser's clock. Checkout holds are 10 minutes (`CHECKOUT_HOLD_SECONDS`), table holds 3 (`HOLD_SECONDS`).

## Ticketing

`confirmPayment` in `lib/ticketing/orders.ts` is **the only door into minting a ticket** and is idempotent. PaySpot connects in `lib/ticketing/payments/payspot.ts` and nowhere else — that file lists the five steps. Nothing above the provider boundary knows a payment provider's name.

Ticket tokens are 192-bit secrets that live in the QR. The database stores `sha256(token)` for lookups plus the token sealed under `TICKET_TOKEN_KEY` for re-display — see `lib/ticketing/secrets.ts`. **Never log a raw token** (`redactToken` exists for that).

Staff access is two roles and two passwords in the environment (`lib/staff/accounts.ts`), with sessions as rows keyed by a hash of an httpOnly cookie (`lib/staff/session.ts`). With nothing configured, a production build **404s** the staff pages rather than falling open. `staffFromCookie(value, role)` in `lib/staff/guard.ts` is the authorization rule itself; `staffFor` is one line that reads the jar and calls it, and it is what the tests exercise.

## Mail

`lib/mail/` is the same shape as the payment boundary: an interface (`provider.ts`), a log provider that is the development default and a real state rather than a stub, and Resend over its HTTP API. Nothing above it names a provider. `sendOnce(kind, key, message)` claims a row in `mail_deliveries` — PRIMARY KEY (kind, key) — so a repeated trigger sends once; ticket delivery keeps its own `ticket_deliveries` row, keyed to an order, because it guards a payment. **A failure is recorded, never thrown at the caller**: a mail service having a bad morning must not be able to un-pay an order or un-confirm a table.

Guests hear about a reservation only when it reaches `confirmed`; the office hears about every new online one (`RESERVATIONS_NOTIFY_EMAIL`).

**A manual reservation will not take a table that has a live 3-minute hold** — it is refused with `seat-held` and the time it frees up. `ManualReservationOptions.takeHeldSeat` is the override, and nothing in the application passes it.

## Tests

`npm test` runs Node's test runner with `--import ./scripts/test-setup.mjs`, which forces PGlite into memory and deletes `DATABASE_URL` so a suite can never touch a real server. **Nothing is mocked**: every guarantee under test is a database constraint, so a mocked database would be testing the mock. Time is moved by ageing a column, never by sleeping.

`lib/db/persistence.test.ts` is the exception that uses a real directory — it writes, throws the whole connection away, reopens, and checks the ticket still opens the door.

`lib/staff/operations.test.ts` covers the office: who may open what (real sessions through `staffFromCookie`), the manual-reservation rules, the capacity floor, delivery idempotency and two scanners on one ticket. It sets the staff passwords for its own duration, because the rest of the suite deliberately runs with the gate in its development "open" state.

## Version gotchas (newer than typical training data — verify against bundled docs)

Authoritative docs for the installed Next.js version are bundled at `node_modules/next/dist/docs/` (see AGENTS.md). Key facts verified against them:

- **Next.js 16.3**: `cookies()`, `headers()`, `draftMode()`, and `params`/`searchParams` props are async-only — always `await` them. Layouts/pages use globally generated type helpers (e.g. `app/layout.tsx` uses `LayoutProps<"/">`) instead of hand-written prop types. `middleware.ts` is deprecated in favor of `proxy.ts`. `next/image` defaults changed: `images.qualities` defaults to `[75]`, `minimumCacheTTL` is 4 hours, local images with query strings need `images.localPatterns.search`.
- **Server actions are public endpoints.** Every one under `app/(operations)/` re-checks the staff session itself; a guard on the page that renders the button is not protection.
- **Tailwind CSS v4**: CSS-first configuration — there is no `tailwind.config.js`. Design tokens live in `app/globals.css` via `@import "tailwindcss"` + `@theme inline`. PostCSS plugin is `@tailwindcss/postcss` (`postcss.config.mjs`).
- **framer-motion v13** is the "Motion" rebrand. Importing from `"framer-motion"` still works and exports the familiar API (`motion`, `AnimatePresence`, `useScroll`, `useTransform`, `useReducedMotion`, ...).
- **Lenis**: both `lenis` (v1.3) and the deprecated `@studio-freight/lenis` are installed — use `lenis`. React bindings are at `lenis/react` (`ReactLenis`, `useLenis`). **Not on the operational pages.**
- **`pg` and `@electric-sql/pglite` are in `serverExternalPackages`** and must stay there; both break in confusing ways if a bundler tries to be clever about them.
- **AGENTS.md** contains a managed block rewritten by `next dev`. Don't try to remove it; commit it as-is.
