Plitvice Club — the site for the club in Inđija, Serbia. Design direction lives in [DESIGN.md](./DESIGN.md); how the code is arranged is in [CLAUDE.md](./CLAUDE.md).

It is two applications in one repository, split by route group:

- **`app/(site)/`** — the public club. Cinematic on purpose.
- **`app/(operations)/`** — tickets, the door and the office: `/t/[token]`, `/karte/[reference]`, `/scanner`, `/admin`, `/osoblje`, `/dev/ticketing`. None of the public site's motion, smooth scroll or translation machinery is loaded there, deliberately.

### The office

Everything behind one sign-in at `/osoblje`, two roles, both server-side (`lib/staff/`). A scanner password opens `/scanner` and nothing else; an admin password opens all of it.

| route | what it is for |
| --- | --- |
| `/admin` | tonight at a glance — tickets sold, remaining, scanned, tables reserved/held/free, orders in flight, failed mail |
| `/admin/plan` | the floor as a map: available / held / reserved, polled from the server |
| `/admin/rezervacije` | every booking, both doors, plus "new reservation" for a call |
| `/admin/karte` | orders with their individual admissions, searchable by anything a guest can tell you |
| `/admin/dogadjaji` | the nights: price, capacity, sale state; add one |
| `/scanner` | the door, on a phone |

## Running it

```bash
npm install
cp .env.example .env.local   # nothing in it is required for development
npm run db:setup             # optional: create the schema now and see what landed
npm run dev                  # http://localhost:3000
```

**There is nothing to install for the database.** With `DATABASE_URL` unset the app runs [PGlite](https://pglite.dev) — the same Postgres, compiled to WebAssembly, inside the Node process, writing to `.data/pglite`. Real transactions, real partial unique indexes, real `SELECT … FOR UPDATE`; it survives a restart and needs no Docker and no account. The SQL is identical to the SQL production runs, which is the point: the concurrency guarantees are testable on a laptop.

`npm run db:setup` is never required — every cold start applies the same idempotent schema itself, in one transaction behind an advisory lock (`lib/db/schema.ts`). Run it when you want an answer rather than a side effect: to check that a connection string works before the first deploy, or to apply a column you have just added.

| command | what it does |
| --- | --- |
| `npm run dev` | development server, Turbopack |
| `npm run build` | production build (does **not** lint) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config in `eslint.config.mjs`) |
| `npm test` | the whole suite, against a real Postgres in memory |
| `npm run stress` | six contention scenarios — overselling, one table, one payment, one QR, five nights — each checked against the database |
| `npm run db:setup` | create/update the schema and print what is there |
| `npm run db:reset` | delete every order, ticket, hold and reservation locally (refuses to touch a real server) |
| `npm run loadtest` | hundreds of simultaneous checkouts at a running dev server, to prove no overselling |
| `npm run widths` | the operational pages at 375/390/404/430px, checking for horizontal overflow |

### Tests

```bash
npm test
```

Nothing is mocked. Every guarantee under test is a database constraint, so a mocked database would be testing the mock. The suite forces PGlite into memory and **deletes `DATABASE_URL`** before a single module loads (`scripts/test-setup.mjs`), so it can never reach a real server. Time is moved by ageing a column, never by sleeping — the three-minute table hold and the ten-minute checkout hold are both tested in milliseconds.

## Going to production

Set these on Vercel (Project → Settings → Environment Variables, Production). Everything is server-side; nothing here is `NEXT_PUBLIC_` and nothing here may become so.

| variable | why |
| --- | --- |
| `DATABASE_URL` | **Required.** A **pooled** Postgres connection string — Neon, Vercel Postgres, Supabase. A direct endpoint runs out of connections under serverless. |
| `TICKET_TOKEN_KEY` | **Required.** 32 bytes, base64. Seals ticket tokens so a dump of the tickets table is not a pile of working tickets. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `TICKETING_PUBLIC_ORIGIN` | **Required.** The absolute origin the QR codes point at. A webhook has no request to read a host from. |
| `STAFF_ADMIN_PASSWORD`, `STAFF_SCANNER_PASSWORD` | **Required before the door is used.** With a role unset, a production build 404s its pages rather than falling open. |
| `STAFF_DOORS` | Optional. The doors a scan can be attributed to. Default `ulaz`. |
| `MAIL_PROVIDER` | `log` (default — nothing is sent) or `resend`. Unset means tickets still exist and are reachable; only the message is missing. |
| `MAIL_FROM`, `RESEND_API_KEY` | Required by `resend`. The from-address must be at a domain verified with the provider. |
| `RESERVATIONS_NOTIFY_EMAIL` | Where the office is told about new online bookings, and the Reply-To on guest mail. Unset sends nothing and fails nothing. |
| `TICKETING_DEV_MODE` | Ignored in production — the simulated payment cannot be switched on there whatever it says. |

A production build with **no `DATABASE_URL` refuses to start**: it does not fall back to the in-process database, because on Vercel each instance would get a private copy and nothing — not the count of what is sold, not a hold on a table — would be shared between them. See `lib/db/client.ts`.

The schema needs no deploy step. The first request after a deploy applies it, and twenty instances cold-starting together apply it once.

Payments are not connected. `lib/ticketing/payments/payspot.ts` is the empty seam, and `confirmPayment` in `lib/ticketing/orders.ts` is the only door into minting a ticket.

## Content to replace before launch

- **Imagery** — `public/images/*.jpg` are generated atmospheric placeholders (warm light studies). Replace with the club's real photography using the same filenames and similar crops; the sitewide grade (`.img-grade`) and grain will unify them automatically.
- **Address & hours** — `lib/site.ts` holds "Inđija, Serbia" and assumed Fri/Sat 23:00–05:00 hours. Confirm with the club.
- **Events** — nights arrive in `lib/ticketing/catalogue.ts`, are seeded into the database once, and are edited in `/admin` afterwards.
- **Domain** — `plitviceclub.com` is assumed in `app/layout.tsx` (metadataBase), `app/robots.ts` and `app/sitemap.ts`.
