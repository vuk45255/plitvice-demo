/* ONE REAL TICKET, ON PURPOSE, SO THE DOOR CAN BE TESTED.
 *
 *   node scripts/scanner-test-ticket.mjs --against-database-url --event=<slug>
 *
 * ═══ WHAT THIS IS FOR ═════════════════════════════════════════════════════
 *
 * Proving that /scanner, on a phone, reads a QR off a screen and lets exactly
 * one person in — against the real database, on the real origin, with a real
 * ticket. Everything short of that (PGlite, a dev route, a screenshot of a QR)
 * tests something adjacent and leaves the one question open.
 *
 * ═══ WHAT IT IS NOT ═══════════════════════════════════════════════════════
 *
 * It is NOT a payment bypass and it does not create one. There is no endpoint
 * here, no route, nothing deployed and nothing a browser can reach: it is a
 * terminal program a person runs by hand, holding a connection string they
 * already had. Deleting this file removes the whole of it.
 *
 * It does not duplicate any part of minting. `createOrder` places the order
 * and `confirmPayment` — the only door into minting a ticket, and the same one
 * a payment provider's webhook will call — turns it paid and issues the QR.
 * Both are imported from lib/ticketing/orders.ts as they are. Nothing about
 * the sale is faked except the fact of payment, which is what the operator is
 * doing deliberately and what the labels below record.
 *
 * ═══ WHAT IT WRITES, AND WHAT IT COSTS ════════════════════════════════════
 *
 * One `ticket_orders` row and one `tickets` row. The order is labelled on
 * three sides so nobody a fortnight from now has to guess:
 *
 *   channel          = 'scanner-test'
 *   payment_provider = 'scanner-test'      (never a real provider's name)
 *   customer_name    = 'SCANNER TEST'
 *
 * IT TAKES A SEAT. One admission out of the night's capacity, exactly as a
 * sale would — because a ticket that did not would not be a real ticket. Give
 * it back when the test is done:
 *
 *   node scripts/scanner-test-ticket.mjs --against-database-url --refund=<REF>
 *
 * which runs `refundOrder`: the order goes to `refunded`, its ticket to
 * `cancelled`, and the seat returns to the room. A ticket already scanned
 * stays `used`, which is the store's rule and not this script's.
 *
 * ═══ THE FOUR GUARDS ══════════════════════════════════════════════════════
 *
 *   1. --against-database-url must be typed. Nothing happens without it.
 *   2. DATABASE_URL must already be in the environment. This script reads no
 *      .env file — the database it writes to is the one the operator put in
 *      their own shell, and never one a file chose for them.
 *   3. A ticket token key is always present in this process — production's if
 *      the shell has it, otherwise an ephemeral one generated here and thrown
 *      away. What must NEVER happen is neither: with the variable unset,
 *      `lib/ticketing/secrets.ts` falls back to a key it WRITES INTO
 *      `app_settings`, putting key material into the club's database. See the
 *      long note at the ephemeral branch below.
 *   4. TICKETING_DEV_MODE is switched OFF for this process whatever the shell
 *      says, so every lookup here sees exactly what production sees: no
 *      test-only nights, and no ticket the deployed scanner would then refuse.
 *
 * NOTHING SECRET IS PRINTED. Not the connection string, not the token key, not
 * a password. The one secret that does reach the terminal is the ticket URL,
 * because it IS the deliverable — a ticket is a bearer credential, the token
 * in that link is the whole of it, and it is worth exactly one admission to
 * one night. Do not paste it anywhere it will be kept. */

import { randomBytes } from "node:crypto";
import { register } from "node:module";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : undefined;
};

const USAGE = `
  node scripts/scanner-test-ticket.mjs --against-database-url [options]

  Required
    --against-database-url   Consent. This writes to whatever DATABASE_URL names.

  Options
    --list                   Show the nights this database is selling, and stop.
    --event=<slug|id>        The night to buy into.
    --origin=<url>           Public origin for the ticket link. Defaults to
                             TICKETING_PUBLIC_ORIGIN.
    --email=<address>        Buyer address on the test order.
    --phone=<number>         Buyer telephone on the test order.
    --send-email             Actually send the ticket mail through whatever
                             MAIL_PROVIDER names. Off by default: the mail is
                             written to this terminal instead.
    --refund=<reference>     Give the seat back: refund that test order and
                             cancel its ticket. Nothing else is done.

  Environment (read from the shell only; no .env file is loaded)
    DATABASE_URL             Required. The pooled connection string.
    TICKET_TOKEN_KEY         Optional. Set it ONLY if you already have the
                             value the deployed site uses. Without it the
                             ticket still opens at /t/ and still scans; only
                             /karte for this one test order stays empty.
`;

if (!flag("against-database-url")) {
  console.error(
    "[scanner-test] refusing to run: pass --against-database-url to say you mean it.",
  );
  console.error(USAGE);
  process.exit(1);
}

/* ── guard 2: the operator's own connection string, from their own shell ── */
if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[scanner-test] DATABASE_URL is not set. This script reads no .env file on " +
      "purpose — set it in this shell, for this one command.",
  );
  process.exit(1);
}

/* ── guard 3: a key in this process, always, and never one from the database ─
 *
 * ═══ WHY A TICKET DOES NOT NEED PRODUCTION'S KEY ══════════════════════════
 *
 * Two columns, two jobs — lib/ticketing/secrets.ts says it plainly:
 *
 *   token_hash    sha256(token). KEYLESS. `findTicketByToken` (the /t/<token>
 *                 page) and `redeem` (the door) both hash what they were given
 *                 and match on this, and neither one touches a key.
 *   token_cipher  the token sealed for RE-DISPLAY, and used by exactly one
 *                 function in the codebase — `ticketsForOrderWithTokens`,
 *                 which serves /karte/<order> and the ticket mail.
 *
 * So a ticket sealed under a key the deployed site does not have still opens
 * at its own URL and still goes through the door. Verified against a real
 * Postgres: minted under one key, read back under another, /t/ resolved, the
 * first scan was admitted and the second refused.
 *
 * ═══ WHAT IS GIVEN UP, AND ONLY FOR THIS ORDER ════════════════════════════
 *
 * `openToken` returns null instead of throwing, and the caller LEAVES THE
 * TICKET OUT rather than showing a broken link. So /karte/<this order's
 * reference> lists nothing and reads as though payment were still settling,
 * and "send again" on that order would carry no links. Nothing throws, no
 * page 500s, and no other order is affected — every real ticket was sealed
 * under the real key and is untouched by this.
 *
 * The link this script prints is the deliverable, and that link is a /t/ URL.
 *
 * ═══ WHY NOT SIMPLY LEAVE THE VARIABLE UNSET ══════════════════════════════
 *
 * Because that is the one genuinely harmful option. Unset, `key()` generates a
 * key and INSERTs it into `app_settings` in whatever database it is pointed
 * at — putting key material inside the club's own database, which is the
 * single property that whole file exists to avoid, and leaving a row that a
 * future deploy missing its environment variable would silently adopt.
 *
 * An ephemeral key in this process writes nothing anywhere. Confirmed: after a
 * keyless run, `app_settings` held no rows at all. */
const KEYLESS = !process.env.TICKET_TOKEN_KEY?.trim();
if (KEYLESS) {
  /* Generated, used to seal one token, and gone when the process exits. It is
     never printed, never written down and never sent anywhere — there is
     nothing to leak and nothing to rotate. */
  process.env.TICKET_TOKEN_KEY = randomBytes(32).toString("base64");
}

/* ── guard 4: see production, not a developer's view of it ──────────────── */
delete process.env.TICKETING_DEV_MODE;

/* Quiet by default. A test order carries a made-up address, and a made-up
   address is a bounce against the club's sending reputation. The log provider
   is a real state, not a stub — see lib/mail/provider.ts. */
if (!flag("send-email")) process.env.MAIL_PROVIDER = "log";

register("./resolve-alias.mjs", import.meta.url);

const { closeDatabase, databaseKind } = await import("@/lib/db/client");
const { ticketingEvents, saleState } = await import("@/lib/ticketing/events");
const { createOrder, confirmPayment, refundOrder } = await import(
  "@/lib/ticketing/orders"
);
const { findOrderByReference, soldFor } = await import("@/lib/ticketing/store");
const { ticketUrl } = await import("@/lib/ticketing/links");
const { publicOrigin } = await import("@/lib/ticketing/config");

/* Named, never printed. "postgres" is the only kind this may talk to: PGlite
   here would mean the connection string was forgotten and the ticket about to
   be tested exists only on this laptop. */
const kind = await databaseKind();
if (kind !== "postgres") {
  console.error(
    `[scanner-test] expected a Postgres server and got ${kind}. Nothing was written.`,
  );
  await closeDatabase();
  process.exit(1);
}
console.log("[scanner-test] connected to a Postgres server.");
if (KEYLESS) {
  console.log(
    "[scanner-test] no TICKET_TOKEN_KEY in this shell — sealing this one token " +
      "under an ephemeral key held in memory. The ticket will open at /t/ and " +
      "scan at the door as normal; /karte for this order alone will stay empty. " +
      "Nothing is written to app_settings.",
  );
}

const done = async (code) => {
  /* Delivery is scheduled and not awaited by `confirmPayment` — correct there,
     and the reason a moment is left here before the pool is torn out from under
     it. The ticket exists whatever happens to the mail. */
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await closeDatabase();
  process.exit(code);
};

/* ── giving the seat back ───────────────────────────────────────────────── */

const refunding = value("refund");
if (refunding) {
  const order = await findOrderByReference(refunding);
  if (!order) {
    console.error(`[scanner-test] no order with reference ${refunding}.`);
    await done(1);
  }
  if (order.channel !== "scanner-test") {
    console.error(
      `[scanner-test] order ${refunding} was not created by this script ` +
        `(channel '${order.channel}'). Refusing to touch a real sale.`,
    );
    await done(1);
  }
  const result = await refundOrder(order.id);
  console.log(
    `[scanner-test] order ${refunding} refunded; ${result.cancelled} ticket(s) cancelled.`,
  );
  await done(0);
}

/* ── which night ────────────────────────────────────────────────────────── */

/* `false` is dev mode, shut: the same list the deployed site sells from. */
const events = await ticketingEvents(false);

async function listNights() {
  if (events.length === 0) {
    console.log("[scanner-test] this database has no public nights.");
    return;
  }
  console.log("[scanner-test] nights this database is selling:\n");
  for (const event of events) {
    const sold = await soldFor(event.id);
    const state = saleState(event, sold);
    const verdict = state.open ? "on sale" : `closed (${state.reason})`;
    console.log(
      `  ${event.slug.padEnd(28)} ${event.status.padEnd(9)} ` +
        `${String(event.startsAt).slice(0, 16).replace("T", " ")}  ` +
        `${sold}/${event.capacity}  ${verdict}`,
    );
    console.log(`  ${" ".repeat(28)} ${event.title}`);
  }
}

const slug = value("event");
if (flag("list") || !slug) {
  await listNights();
  if (!slug) {
    console.log("\n[scanner-test] pass --event=<slug> to buy one ticket for a night.");
  }
  await done(flag("list") ? 0 : 1);
}

/* ── where the QR will point ────────────────────────────────────────────── */

const origin = (value("origin") ?? publicOrigin() ?? "").replace(/\/+$/, "");
if (!origin) {
  console.error(
    "[scanner-test] no origin. Pass --origin=https://<the club's domain> or set " +
      "TICKETING_PUBLIC_ORIGIN — a QR needs an absolute URL and there is no " +
      "request here to read a host from.",
  );
  await done(1);
}
let parsed = null;
try {
  parsed = new URL(origin);
} catch {
  parsed = null;
}
if (!parsed || (parsed.protocol !== "https:" && parsed.hostname !== "localhost")) {
  console.error(`[scanner-test] --origin must be an https:// URL. Got: ${origin}`);
  await done(1);
}

/* ── the order, through the front door ──────────────────────────────────── */

/* Labelled where a person will actually read it: the name at the top of the
   order in /admin/karte. `channel` and `payment_provider` say the same thing
   to anybody reading the table directly. */
const buyer = {
  name: "SCANNER TEST",
  email: value("email") ?? "scanner-test@plitviceklub.rs",
  phone: value("phone") ?? "+381600000000",
};

const placed = await createOrder(
  { eventSlug: slug, quantity: 1, buyer },
  { channel: "scanner-test" },
);

if (!placed.ok) {
  const explain = {
    invalid: `the request was refused: ${JSON.stringify(placed.fields ?? {})}`,
    unavailable:
      "that night is not on sale here — a draft, an evening already past, a " +
      "sales window that is shut, or no such slug. Run with --list to see.",
    sold_out: "that night is full.",
    busy: "the database was busy and nothing was written. Try again.",
  }[placed.reason];
  console.error(`[scanner-test] no order was created — ${explain}`);
  await done(1);
}

const { order, event } = placed;

/* ── and paid, through the only door into minting ───────────────────────── */

const confirmed = await confirmPayment(
  order.id,
  { provider: "scanner-test", reference: `scanner-test-${order.reference}` },
  origin,
);

if (!confirmed.ok) {
  console.error(
    `[scanner-test] the order was created but not confirmed (${confirmed.reason}). ` +
      `Order ${order.reference} is pending and its hold lapses on its own.`,
  );
  await done(1);
}

const tickets = confirmed.tickets;
if (tickets.length !== 1) {
  console.error(
    `[scanner-test] expected exactly one ticket and got ${tickets.length}. ` +
      `Refund it: --refund=${order.reference}`,
  );
  await done(1);
}

const link = ticketUrl(origin, tickets[0].token);

console.log(`
[scanner-test] one ticket minted.

  night      ${event.title}
  slug       ${event.slug}
  order      ${order.reference}   (channel 'scanner-test'; ${order.totalAmount} ${order.currency} recorded, nothing charged)
  ticket     ${tickets[0].reference}

  Open this on the PC and scan it with /scanner on the phone:

    ${link}

  That link IS the ticket. Whoever holds it holds the admission — do not paste
  it anywhere it will be kept.${
    KEYLESS
      ? `

  It is the ONLY copy. This token was sealed under an ephemeral key, so
  /karte/${order.reference} cannot list it and no mail can re-send it. Losing
  the line above means refunding this order and running the script again.`
      : ""
  }

  On the phone: sign in at /osoblje, then set the door to "${event.title}" on
  /scanner. A door set to another night refuses this one and leaves it valid.

  Afterwards, to give the seat back:

    node scripts/scanner-test-ticket.mjs --against-database-url --refund=${order.reference}
`);

await done(0);
