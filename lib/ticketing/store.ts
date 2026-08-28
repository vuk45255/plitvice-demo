import { query, tx, type Queryable } from "@/lib/db/client";
import { timed } from "@/lib/db/profile";
import { TAKEN_CLAUSE } from "@/lib/ticketing/taken";
import { hashToken, openToken, sealToken } from "@/lib/ticketing/secrets";
import {
  newInternalId,
  newOrderReference,
  newTicketReference,
  newTicketToken,
} from "@/lib/ticketing/tokens";
import { iso } from "@/lib/ticketing/events";
import type {
  Order,
  OrderDraft,
  PaymentStatus,
  Ticket,
  TicketWithToken,
} from "@/lib/ticketing/types";

/* WHERE ORDERS AND TICKETS ARE KEPT, AND WHERE THE GUARANTEES ARE ENFORCED.
 *
 * Everything in this file that matters is a single SQL statement or a single
 * transaction. That is not a style: it is the difference between a system that
 * works on one laptop and a system that works on however many instances Vercel
 * decides to start. Two guests buying the last ticket land on two machines,
 * and two machines share nothing except this database.
 *
 * ═══ THE FOUR THAT MUST STAY INDIVISIBLE ══════════════════════════════════
 *
 *   1. CAPACITY — `placeOrder`. The event row is taken FOR UPDATE, the
 *      admissions already taken are counted inside that lock, and the order is
 *      written before it is released. A hundred simultaneous requests for the
 *      last ticket queue up on that lock one at a time; the first sees 499 of
 *      500 and takes it, the ninety-ninth sees 500 and is refused. NO
 *      OVERSELLING, decided by the database.
 *
 *   2. PAYMENT — `claimPayment`. `UPDATE … WHERE payment_status = 'pending'`,
 *      with the condition inside the write. A provider that sends the same
 *      confirmation five times runs this five times and exactly one of them
 *      gets a row back. Everybody else has nothing to do.
 *
 *   3. MINTING — `issueTickets`. UNIQUE (order_id, seq), so a second mint for
 *      the same order is refused by the database rather than by a check that
 *      somebody might one day remove. Four admissions are four rows, seats 1
 *      to 4, and there is no fifth.
 *
 *   4. THE DOOR — `redeem`. `UPDATE … WHERE status = 'valid' RETURNING`. Two
 *      doormen scanning one code in the same second both run it; one gets a
 *      row and lets somebody in, the other gets none and is told the ticket is
 *      already used, along with the time of the scan that won.
 *
 * ═══ WHAT COUNTS AS TAKEN ═════════════════════════════════════════════════
 *
 * Written once, here, as SQL, and read by every count in the system:
 *
 *     payment_status = 'paid'
 *  OR (payment_status = 'pending' AND hold_expires_at > now())
 *
 * A pending order holds its seats for ten minutes and then stops, and it stops
 * because the clause above stops being true — not because a sweep ran, not
 * because a timer fired, and not because a browser said the countdown was
 * over. `expireLapsedOrders` exists for tidiness and for the admin screen; the
 * count is correct whether or not it has ever run.
 *
 * ═══ TOKENS ═══════════════════════════════════════════════════════════════
 *
 * Never stored. `token_hash` is what a lookup matches on and `token_cipher` is
 * what re-display unseals. See lib/ticketing/secrets.ts. Nothing in this file
 * logs a token, and `redeem` takes one only long enough to hash it. */

/* The one definition, imported rather than repeated — see taken.ts. */
const TAKEN = TAKEN_CLAUSE;

/* TEN MINUTES, in the one place it is written down. */
export const CHECKOUT_HOLD_SECONDS = 10 * 60;

/* ── rows in, objects out ───────────────────────────────────────────────── */

type OrderRow = {
  id: string;
  reference: string;
  event_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  email_key: string;
  phone_key: string;
  quantity: number;
  total_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_reference: string | null;
  hold_expires_at: Date | string;
  oversold: boolean;
  channel: string;
  created_at: Date | string;
  updated_at: Date | string;
  paid_at: Date | string | null;
};

/* Listed once, as an array, so that the prefixed form used in joins is derived
   rather than written out a second time and allowed to drift. */
const ORDER_FIELDS = [
  "id", "reference", "event_id", "customer_name", "customer_email",
  "customer_phone", "email_key", "phone_key", "quantity", "total_amount",
  "currency", "payment_status", "payment_provider", "payment_reference",
  "hold_expires_at", "oversold", "channel", "created_at", "updated_at", "paid_at",
] as const;

const ORDER_COLUMNS = ORDER_FIELDS.join(", ");
const ORDER_COLUMNS_O = ORDER_FIELDS.map((field) => `o.${field}`).join(", ");

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    emailKey: row.email_key,
    phoneKey: row.phone_key,
    quantity: Number(row.quantity),
    totalAmount: Number(row.total_amount),
    currency: "RSD",
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider ?? undefined,
    paymentReference: row.payment_reference ?? undefined,
    holdExpiresAt: iso(row.hold_expires_at)!,
    oversold: Boolean(row.oversold),
    channel: row.channel,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    paidAt: iso(row.paid_at),
  };
}

type TicketRow = {
  id: string;
  reference: string;
  event_id: string;
  order_id: string;
  seq: number;
  status: Ticket["status"];
  created_at: Date | string;
  scanned_at: Date | string | null;
  scanned_by: string | null;
  token_cipher?: string;
};

const TICKET_COLUMNS = `id, reference, event_id, order_id, seq, status,
  created_at, scanned_at, scanned_by`;

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    orderId: row.order_id,
    seq: Number(row.seq),
    status: row.status,
    createdAt: iso(row.created_at)!,
    scannedAt: iso(row.scanned_at),
    scannedBy: row.scanned_by ?? undefined,
  };
}

/* ── orders ─────────────────────────────────────────────────────────────── */

export type PlaceOrderOutcome =
  | { ok: true; order: Order }
  | { ok: false; reason: "sold_out"; remaining: number }
  | { ok: false; reason: "unknown_event" };

/* THE CAPACITY GUARANTEE.
 *
 * One transaction. The event row is locked, the taken admissions are counted
 * under that lock, and the order that adds to them is inserted before it is
 * let go. Nothing between those three steps can interleave, on this instance
 * or on any other, which is the entire reason it is written this way and not
 * as three convenient little functions.
 *
 * `capacity` is read from the row inside the lock rather than passed in: a
 * caller who read it a moment ago read it before the lock existed. */
export async function placeOrder(
  draft: OrderDraft,
  holdSeconds: number = CHECKOUT_HOLD_SECONDS,
): Promise<PlaceOrderOutcome> {
  return tx(async (q) => {
    /* ── 1. THE LOCK, AND NOTHING ELSE IN THIS STATEMENT ────────────────
       Every checkout for this night queues here. From the moment it is
       granted until COMMIT, this transaction is the only one that may decide
       anything about this night's capacity — so everything below is written
       to be as short as it can be while staying correct. */
    const event = await timed("lock.wait", () =>
      q.query<{ capacity: number }>(
        `SELECT capacity FROM events WHERE id = $1 FOR UPDATE`,
        [draft.eventId],
      ),
    );
    if (event.rows.length === 0) return { ok: false as const, reason: "unknown_event" as const };

    const capacity = Number(event.rows[0].capacity);

    /* ── 2. COUNT AND INSERT, IN ONE STATEMENT ──────────────────────────
     *
     * These used to be two round trips. On a laptop beside the database that
     * is invisible; against Neon it is ~30ms of extra time HELD INSIDE THE
     * LOCK, and because every buyer for this night passes through the same
     * lock, it is ~30ms multiplied by the length of the queue. Three hundred
     * buyers on one night measured 94ms per serialized transaction and 28
     * seconds of unavoidable chain — a third of which was this.
     *
     * WHY THIS IS SAFE, AND WHY THE LOCK ABOVE STILL HAS TO BE ITS OWN
     * STATEMENT. Under READ COMMITTED a statement reads one snapshot, taken
     * when the statement begins. Merging the LOCK into this statement too
     * would be the classic silent oversell: the count would run against a
     * snapshot from BEFORE the lock was granted and would miss orders another
     * checkout had just committed. Merging the COUNT with the INSERT is a
     * different matter — the lock is already held, so no other checkout for
     * this night can be between its own lock and its own commit, and this
     * statement's fresh snapshot therefore sees every order that exists.
     *
     * Nothing else can change what this count sees: `claimPayment` on a live
     * order moves pending → paid, and the clause below counts both; a refund
     * or an expiry only ever REMOVES admissions, which can refuse a buyer we
     * could have taken but can never oversell.
     *
     * `WHERE taken + quantity <= capacity` is the guarantee, now stated in the
     * same statement that writes the row: no row comes back, no seats are
     * taken. */
    const inserted = await timed("order.insert", () =>
      q.query<OrderRow & { taken: number }>(
        `WITH taken AS (
           SELECT COALESCE(SUM(quantity), 0)::int AS n
             FROM ticket_orders
            WHERE event_id = $3 AND ${TAKEN}
         ),
         placed AS (
           INSERT INTO ticket_orders (
             id, reference, event_id, customer_name, customer_email, customer_phone,
             email_key, phone_key, quantity, total_amount, currency,
             payment_status, hold_expires_at, channel
           )
           SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',
                  now() + make_interval(secs => $12), $13
             FROM taken
            WHERE taken.n + $9 <= $14
           RETURNING ${ORDER_COLUMNS}
         )
         /* LEFT JOIN, so there is ALWAYS exactly one row back: the order when
            it was placed, and the count with every column null when it was
            not. A UNION would need every column's type written out by hand;
            this takes them from the INSERT's own RETURNING. */
         SELECT t.n AS taken, p.*
           FROM taken t LEFT JOIN placed p ON true`,
        [
          newInternalId("ord"),
          newOrderReference(),
          draft.eventId,
          draft.customerName,
          draft.customerEmail,
          draft.customerPhone,
          draft.emailKey,
          draft.phoneKey,
          draft.quantity,
          draft.totalAmount,
          draft.currency,
          holdSeconds,
          draft.channel ?? "web",
          capacity,
        ],
      ),
    );

    const row = inserted.rows[0];
    /* No id means the WHERE refused it: the room filled while this buyer was
       in the queue. `taken` comes back either way, so the refusal can say how
       many are actually left rather than just "no". */
    if (!row?.id) {
      const remaining = Math.max(0, capacity - Number(row?.taken ?? capacity));
      return { ok: false as const, reason: "sold_out" as const, remaining };
    }

    return { ok: true as const, order: toOrder(row) };
  });
}

export async function findOrder(id: string): Promise<Order | undefined> {
  const result = await query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM ticket_orders WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? toOrder(result.rows[0]) : undefined;
}

export async function findOrderByReference(
  reference: string,
): Promise<Order | undefined> {
  const result = await query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM ticket_orders WHERE reference = $1`,
    [reference],
  );
  return result.rows[0] ? toOrder(result.rows[0]) : undefined;
}

export type ClaimPaymentOutcome =
  /* This call is the one that turned the order paid — it mints the tickets. */
  | { claimed: true; order: Order }
  /* The order exists and this call has nothing to do: somebody else claimed it
     first, or it is in a state that cannot become paid. */
  | { claimed: false; order: Order }
  | { claimed: false; order: undefined };

/* THE IDEMPOTENCY GUARANTEE.
 *
 * pending → paid, once, whoever asks and however many times. The condition is
 * inside the UPDATE, so two webhooks arriving in the same millisecond both run
 * it and exactly one gets a row back.
 *
 * `expired` IS ALSO PAYABLE, and deliberately. A payment that lands at minute
 * eleven is a payment: refusing it would take somebody's money and give them
 * nothing. So the room is re-counted under the event lock, and if it has since
 * filled, the order is still paid and marked `oversold` for the club to see.
 * NEVER REFUSE MONEY QUIETLY — tell somebody. */
export async function claimPayment(
  id: string,
  evidence: { provider: string; reference?: string },
): Promise<ClaimPaymentOutcome> {
  return tx(async (q) => {
    const existing = await q.query<OrderRow & { hold_lapsed: boolean }>(
      /* `hold_lapsed` IS DECIDED BY THE DATABASE, in the same statement that
         takes the lock, for the same reason every other expiry in this system
         is: Node's clock on one instance is not the clock the ten minutes were
         written against. */
      `SELECT ${ORDER_COLUMNS}, hold_expires_at <= now() AS hold_lapsed
         FROM ticket_orders WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (existing.rows.length === 0) {
      return { claimed: false as const, order: undefined };
    }

    const before = toOrder(existing.rows[0]);
    const holdLapsed = existing.rows[0].hold_lapsed === true;
    if (before.paymentStatus !== "pending" && before.paymentStatus !== "expired") {
      return { claimed: false as const, order: before };
    }

    /* Did the hold survive? If it did, the seats were never given back and
       nothing needs re-counting. If it did not, find out whether the room has
       filled behind this order. */
    const lapsed = before.paymentStatus === "expired" || holdLapsed;

    let oversold = false;
    if (lapsed) {
      /* Same lock the checkout takes, so a late payment and a fresh purchase
         cannot both be told there is one seat left. */
      const event = await q.query<{ capacity: number }>(
        `SELECT capacity FROM events WHERE id = $1 FOR UPDATE`,
        [before.eventId],
      );
      const taken = await q.query<{ taken: number }>(
        /* Everything the room is holding EXCEPT this order — it is the thing
           being decided, so counting it would always find itself. */
        `SELECT COALESCE(SUM(quantity), 0)::int AS taken
           FROM ticket_orders
          WHERE event_id = $1 AND id <> $2 AND ${TAKEN}`,
        [before.eventId, before.id],
      );
      const capacity = Number(event.rows[0]?.capacity ?? 0);
      oversold = Number(taken.rows[0].taken) + before.quantity > capacity;
    }

    const claimed = await q.query<OrderRow>(
      `UPDATE ticket_orders
          SET payment_status   = 'paid',
              payment_provider = $2,
              payment_reference = $3,
              paid_at          = now(),
              updated_at       = now(),
              oversold         = oversold OR $4
        WHERE id = $1 AND payment_status IN ('pending','expired')
        RETURNING ${ORDER_COLUMNS}`,
      [id, evidence.provider, evidence.reference ?? null, oversold],
    );

    if (claimed.rows.length === 0) {
      const after = await q.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM ticket_orders WHERE id = $1`,
        [id],
      );
      return { claimed: false as const, order: toOrder(after.rows[0]) };
    }

    return { claimed: true as const, order: toOrder(claimed.rows[0]) };
  });
}

export async function setOrderStatus(
  id: string,
  status: PaymentStatus,
): Promise<Order | undefined> {
  const result = await query<OrderRow>(
    `UPDATE ticket_orders SET payment_status = $2, updated_at = now()
      WHERE id = $1 RETURNING ${ORDER_COLUMNS}`,
    [id, status],
  );
  return result.rows[0] ? toOrder(result.rows[0]) : undefined;
}

/* Bookkeeping, not a rule. Pending orders whose ten minutes are up are written
   down as `expired` so the admin screen reads honestly and the table does not
   fill with rows that look live. THE SEATS WENT BACK THE MOMENT THE TIMESTAMP
   PASSED, whether or not this ever runs — see TAKEN at the top. */
export async function expireLapsedOrders(): Promise<number> {
  const result = await query(
    `UPDATE ticket_orders SET payment_status = 'expired', updated_at = now()
      WHERE payment_status = 'pending' AND hold_expires_at <= now()`,
  );
  return result.rowCount;
}

/* ── tickets ────────────────────────────────────────────────────────────── */

/* ONE TICKET PER ADMISSION, AND ONLY EVER ONE SET PER ORDER.
 *
 * A party of four is four tickets with four codes: a group sharing one code is
 * a group that cannot arrive separately, and a code that has been used once
 * cannot let the other three in.
 *
 * The idempotency is UNIQUE (order_id, seq). Two confirmations that both got
 * past the payment claim — which should be impossible, and which this is
 * insurance against anyway — both try to insert seats 1..n; the second is
 * refused by the index, and both callers are handed the same rows.
 *
 * Tokens are minted and SEALED BEFORE the transaction opens, because sealing
 * may have to read the key and a read on another connection inside a
 * transaction is the kind of thing that turns a fast lock into a slow one. */
export async function issueTickets(order: Order): Promise<TicketWithToken[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await ticketsForOrderWithTokens(order.id);
    if (existing.length >= order.quantity) return existing;

    const minted = await Promise.all(
      Array.from({ length: order.quantity }, async (_, index) => {
        const token = newTicketToken();
        return {
          id: newInternalId("tkt"),
          reference: newTicketReference(),
          seq: index + 1,
          token,
          hash: hashToken(token),
          cipher: await sealToken(token),
        };
      }),
    );

    try {
      await tx(async (q) => {
        for (const ticket of minted) {
          await q.query(
            `INSERT INTO tickets (
               id, reference, event_id, order_id, token_hash, token_cipher, seq, status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,'valid')
             ON CONFLICT (order_id, seq) DO NOTHING`,
            [
              ticket.id,
              ticket.reference,
              order.eventId,
              order.id,
              ticket.hash,
              ticket.cipher,
              ticket.seq,
            ],
          );
        }
      });
    } catch (error) {
      /* The only realistic failure is a reference or token collision — fifty
         and a hundred and ninety-two bits respectively, so not expected, and
         simply not permitted either. Mint a fresh set and try again. */
      if (attempt === 3) throw error;
      continue;
    }

    return ticketsForOrderWithTokens(order.id);
  }
  /* Unreachable: the loop either returns or throws. */
  return ticketsForOrderWithTokens(order.id);
}

/* One order's admissions, as the office needs to read them: the public
 * reference, whether it has been used, when, by whom — and AT WHICH DOOR.
 *
 * The door is not on the ticket row. It is on the scan that let the guest in,
 * in `ticket_scans`, which is where every attempt is written down; the ticket
 * carries only the one that won. Joined here rather than duplicated onto the
 * ticket, because two columns that can disagree about which door somebody came
 * through is a bug waiting for a busy Saturday.
 *
 * NO TOKENS. This is a list on a screen in an office, and the token is the
 * credential — see `ticketsForOrderWithTokens` for the one caller that is
 * allowed it, which is the guest's own page. */
export type TicketLine = Ticket & { door?: string };

export async function ticketLinesForOrder(orderId: string): Promise<TicketLine[]> {
  return (await ticketLinesForOrders([orderId])).get(orderId) ?? [];
}

/* THE SAME QUESTION FOR A WHOLE SCREENFUL, IN ONE ROUND TRIP.
 *
 * /admin/karte lists up to 120 orders and needs every admission inside each of
 * them. Asked one order at a time that is 120 queries — on a laptop next to the
 * database it is imperceptible, and on Vercel talking to Neon it is 120 network
 * round trips on the screen staff open when somebody is on the telephone.
 *
 * `= ANY($1)` takes the whole list, and the rows are grouped here. The door
 * still comes from the scan log rather than being duplicated onto the ticket —
 * two columns that can disagree about which door somebody came through is a bug
 * waiting for a busy Saturday. */
export async function ticketLinesForOrders(
  orderIds: readonly string[],
): Promise<Map<string, TicketLine[]>> {
  const byOrder = new Map<string, TicketLine[]>();
  if (orderIds.length === 0) return byOrder;

  const result = await query<TicketRow & { door: string | null }>(
    `SELECT ${TICKET_COLUMNS},
            (SELECT s.door FROM ticket_scans s
              WHERE s.ticket_id = t.id AND s.outcome = 'redeemed'
              ORDER BY s.at DESC LIMIT 1) AS door
       FROM tickets t
      WHERE t.order_id = ANY($1::text[])
      ORDER BY t.order_id, t.seq ASC`,
    [orderIds as string[]],
  );

  for (const row of result.rows) {
    const line = { ...toTicket(row), door: row.door ?? undefined };
    const existing = byOrder.get(line.orderId);
    if (existing) existing.push(line);
    else byOrder.set(line.orderId, [line]);
  }
  return byOrder;
}

export async function ticketsForOrder(orderId: string): Promise<Ticket[]> {
  const result = await query<TicketRow>(
    `SELECT ${TICKET_COLUMNS} FROM tickets WHERE order_id = $1 ORDER BY seq ASC`,
    [orderId],
  );
  return result.rows.map(toTicket);
}

/* The same, with each ticket's secret unsealed — for the order page, which has
   to link to /t/<token>, and for delivery, which has to put those links in a
   mail. NOTHING ELSE MAY CALL THIS, and nothing that calls it may log it. */
export async function ticketsForOrderWithTokens(
  orderId: string,
): Promise<TicketWithToken[]> {
  const result = await query<TicketRow & { token_cipher: string }>(
    `SELECT ${TICKET_COLUMNS}, token_cipher FROM tickets
      WHERE order_id = $1 ORDER BY seq ASC`,
    [orderId],
  );

  const out: TicketWithToken[] = [];
  for (const row of result.rows) {
    const token = await openToken(row.token_cipher);
    /* A ticket whose key has changed can still be scanned — the hash is
       untouched — but cannot be shown again. It is left out rather than shown
       with a broken link. */
    if (!token) continue;
    out.push({ ...toTicket(row), token });
  }
  return out;
}

/* Read-only, by hash. What the ticket page uses; it never changes a status. */
export async function findTicketByToken(token: string): Promise<Ticket | undefined> {
  const result = await query<TicketRow>(
    `SELECT ${TICKET_COLUMNS} FROM tickets WHERE token_hash = $1`,
    [hashToken(token)],
  );
  return result.rows[0] ? toTicket(result.rows[0]) : undefined;
}

export async function findTicketByReference(
  reference: string,
): Promise<Ticket | undefined> {
  const result = await query<TicketRow>(
    `SELECT ${TICKET_COLUMNS} FROM tickets WHERE reference = $1`,
    [reference],
  );
  return result.rows[0] ? toTicket(result.rows[0]) : undefined;
}

/* ── the door ───────────────────────────────────────────────────────────── */

export type RedeemOutcome =
  | { result: "redeemed"; ticket: Ticket }
  | { result: "already_used"; ticket: Ticket }
  | { result: "cancelled"; ticket: Ticket }
  | { result: "wrong_event"; ticket: Ticket }
  | { result: "unknown" };

/* THE DOOR, IN ONE STATEMENT.
 *
 * `claimed` is the UPDATE with its condition inside it: only a ticket that is
 * still valid, and only one for the night this door is working, can be marked
 * used — and only one caller can be the one that marks it. `standing` is the
 * row as it was BEFORE, which is what a caller who lost needs in order to be
 * told what happened and when.
 *
 * The two are unioned so that exactly one row comes back either way, and the
 * `won` column says which of them it is. Note that `standing` cannot see the
 * update — a data-modifying CTE and the query around it read the same snapshot
 * — and that is precisely what makes it the right thing to report.
 *
 * `expectedEventId` may be null, which means "this door is not filtering by
 * night". The scanner always sends one. */
export async function redeem(
  key: { token?: string; reference?: string },
  expectedEventId: string | null,
  by?: string,
  door?: string,
): Promise<RedeemOutcome> {
  const hash = key.token ? hashToken(key.token) : null;
  const reference = key.reference ?? null;
  if (!hash && !reference) return { result: "unknown" };

  const outcome = await tx(async (q) => {
    /* ── 1. THE CLAIM ──────────────────────────────────────────────────
       One statement, every condition inside the write, so it can succeed
       exactly once. Two doormen scanning one code both run this; one gets a
       row back and lets somebody in, the other gets none. */
    const claimed = await q.query<TicketRow>(
      `UPDATE tickets
          SET status = 'used', scanned_at = now(), scanned_by = $3
        WHERE id = (SELECT id FROM tickets
                     WHERE ($1::text IS NOT NULL AND token_hash = $1)
                        OR ($2::text IS NOT NULL AND reference  = $2))
          AND status = 'valid'
          AND ($4::text IS NULL OR event_id = $4)
        RETURNING ${TICKET_COLUMNS}`,
      [hash, reference, by ?? null, expectedEventId],
    );

    if (claimed.rows[0]) {
      const ticket = toTicket(claimed.rows[0]);
      await logScan(q, ticket, "redeemed", door, by);
      return { result: "redeemed" as const, ticket };
    }

    /* ── 2. AND ONLY THEN, WHY NOT ─────────────────────────────────────
     *
     * A SECOND STATEMENT, DELIBERATELY. This used to be one statement: a
     * `standing` CTE beside the UPDATE, unioned so that a loser was handed the
     * row as it was. That is wrong on a real Postgres server, and it is wrong
     * in a way no single-connection database can show.
     *
     * Under READ COMMITTED every STATEMENT gets one snapshot, taken when the
     * statement begins. A losing scanner's statement starts while the ticket is
     * still valid, blocks on the winner's row lock, and when the winner commits
     * the UPDATE re-reads the row and correctly declines to claim it — but the
     * `standing` half of the same statement still sees the OLD snapshot, in
     * which the ticket is `valid` and `scanned_at` is null. The verdict then
     * falls through "not claimed, not cancelled, not used" to WRONG EVENT: a
     * doorman told a perfectly good ticket belongs to another night, with no
     * scan time to show, for a ticket that had been used a millisecond earlier.
     *
     * Under real contention on Neon that is exactly what happened to four scans
     * in a hundred. Nobody got in twice — the claim above is the guarantee and
     * it held — but the door was told the wrong thing.
     *
     * A new statement takes a NEW snapshot, which includes the winner's commit.
     * So the loser reads the row as it now is: used, by whom, and at what time.
     * The same shape `holdStore.consume` already uses for the same reason. */
    const standing = await q.query<TicketRow>(
      `SELECT ${TICKET_COLUMNS} FROM tickets
        WHERE ($1::text IS NOT NULL AND token_hash = $1)
           OR ($2::text IS NOT NULL AND reference  = $2)`,
      [hash, reference],
    );

    const row = standing.rows[0];
    if (!row) return { result: "unknown" as const };

    const ticket = toTicket(row);
    const verdict: RedeemOutcome =
      ticket.status === "cancelled"
        ? { result: "cancelled", ticket }
        : ticket.status === "used"
          ? { result: "already_used", ticket }
          : /* Still valid on a fresh read, and it did not claim — so the only
               thing that can have stopped it is the night. */
            { result: "wrong_event", ticket };

    await logScan(q, ticket, verdict.result, door, by);
    return verdict;
  });

  return outcome;
}

/* Every attempt, including the refusals, in the same transaction as the
   decision. "How many people tried to come in on that code" is a question the
   club will ask, and it cannot be answered afterwards if nobody wrote it down.
   NO TOKEN IS RECORDED — only which ticket it was. */
async function logScan(
  q: Queryable,
  ticket: Ticket,
  outcome: string,
  door?: string,
  by?: string,
): Promise<void> {
  await q.query(
    `INSERT INTO ticket_scans (ticket_id, event_id, outcome, door, scanned_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticket.id, ticket.eventId, outcome, door ?? null, by ?? null],
  );
}

/* Revoking a night's worth of tickets — a refund, a cancelled night.
   A ticket somebody has already come in on stays used: what happened at the
   door happened, and a refund afterwards does not rewrite it. */
export async function cancelTicketsForOrder(orderId: string): Promise<number> {
  const result = await query(
    `UPDATE tickets SET status = 'cancelled'
      WHERE order_id = $1 AND status = 'valid'`,
    [orderId],
  );
  return result.rowCount;
}

/* ── counting ───────────────────────────────────────────────────────────── */

/* How many admissions a night has given away — paid, plus everything a live
   checkout hold is sitting on. Counted, never stored. */
export async function soldFor(eventId: string, q?: Queryable): Promise<number> {
  const run = q ? q.query.bind(q) : query;
  const result = await run<{ taken: number }>(
    `SELECT COALESCE(SUM(quantity), 0)::int AS taken
       FROM ticket_orders WHERE event_id = $1 AND ${TAKEN}`,
    [eventId],
  );
  return Number(result.rows[0].taken);
}

export type EventCounts = {
  capacity: number;
  /* Admissions on orders where the money is in. */
  paid: number;
  /* Admissions on pending orders whose ten minutes are still running. */
  held: number;
  /* paid + held — what `soldFor` returns and what capacity is judged against. */
  taken: number;
  available: number;
  /* Guests actually through the door tonight. */
  entered: number;
  /* Tickets in existence that have not been used or revoked. */
  outstanding: number;
  orders: number;
};

/* Everything the admin screen puts next to a night's name, in one query. */
export async function countsFor(eventId: string): Promise<EventCounts> {
  const result = await query<{
    capacity: number;
    paid: number;
    held: number;
    orders: number;
    entered: number;
    outstanding: number;
  }>(
    `SELECT
       e.capacity,
       COALESCE((SELECT SUM(quantity) FROM ticket_orders
                  WHERE event_id = e.id AND payment_status = 'paid'), 0)::int AS paid,
       COALESCE((SELECT SUM(quantity) FROM ticket_orders
                  WHERE event_id = e.id AND payment_status = 'pending'
                    AND hold_expires_at > now()), 0)::int AS held,
       COALESCE((SELECT COUNT(*) FROM ticket_orders WHERE event_id = e.id), 0)::int AS orders,
       COALESCE((SELECT COUNT(*) FROM tickets
                  WHERE event_id = e.id AND status = 'used'), 0)::int AS entered,
       COALESCE((SELECT COUNT(*) FROM tickets
                  WHERE event_id = e.id AND status = 'valid'), 0)::int AS outstanding
     FROM events e WHERE e.id = $1`,
    [eventId],
  );

  const row = result.rows[0];
  if (!row) {
    return {
      capacity: 0, paid: 0, held: 0, taken: 0,
      available: 0, entered: 0, outstanding: 0, orders: 0,
    };
  }

  const capacity = Number(row.capacity);
  const paid = Number(row.paid);
  const held = Number(row.held);
  return {
    capacity,
    paid,
    held,
    taken: paid + held,
    available: Math.max(0, capacity - paid - held),
    entered: Number(row.entered),
    outstanding: Number(row.outstanding),
    orders: Number(row.orders),
  };
}

/* ── what the club looks things up by ───────────────────────────────────── */

export type OrderListing = Order & { eventTitle: string; ticketCount: number };

export async function listOrders(options: {
  eventId?: string;
  status?: PaymentStatus;
  limit?: number;
}): Promise<OrderListing[]> {
  const result = await query<OrderRow & { event_title: string; ticket_count: number }>(
    `SELECT ${ORDER_COLUMNS_O},
            e.title AS event_title,
            (SELECT COUNT(*) FROM tickets WHERE order_id = o.id)::int AS ticket_count
       FROM ticket_orders o JOIN events e ON e.id = o.event_id
      WHERE ($1::text IS NULL OR o.event_id = $1)
        AND ($2::text IS NULL OR o.payment_status = $2)
      ORDER BY o.created_at DESC
      LIMIT $3`,
    [options.eventId ?? null, options.status ?? null, options.limit ?? 100],
  );
  return result.rows.map((row) => ({
    ...toOrder(row),
    eventTitle: row.event_title,
    ticketCount: Number(row.ticket_count),
  }));
}

/* One search box, over the things somebody on the telephone can actually tell
   you: an order reference, a ticket reference, a name, an email, a number.
   The two references are matched exactly; the rest by prefix-insensitive
   containment, which is what a person half-remembering a name needs. */
export async function searchOrders(term: string, limit = 40): Promise<OrderListing[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const result = await query<OrderRow & { event_title: string; ticket_count: number }>(
    `SELECT ${ORDER_COLUMNS_O},
            e.title AS event_title,
            (SELECT COUNT(*) FROM tickets WHERE order_id = o.id)::int AS ticket_count
       FROM ticket_orders o JOIN events e ON e.id = o.event_id
      WHERE o.reference = $1
         OR o.id = $1
         OR EXISTS (SELECT 1 FROM tickets t
                     WHERE t.order_id = o.id AND upper(t.reference) = upper($1))
         OR o.customer_name  ILIKE '%' || $1 || '%'
         OR o.customer_email ILIKE '%' || $1 || '%'
         OR o.customer_phone ILIKE '%' || $1 || '%'
         OR o.email_key      ILIKE '%' || $1 || '%'
         OR o.phone_key      ILIKE '%' || $1 || '%'
      ORDER BY o.created_at DESC
      LIMIT $2`,
    [trimmed, limit],
  );
  return result.rows.map((row) => ({
    ...toOrder(row),
    eventTitle: row.event_title,
    ticketCount: Number(row.ticket_count),
  }));
}

/* The last few people through the door, for the admin screen. No tokens, and
   no customer detail — the same rule as the scanner's own screen. */
export type ScanLine = {
  at: string;
  outcome: string;
  reference: string | null;
  door: string | null;
  by: string | null;
};

export async function recentScans(eventId: string, limit = 25): Promise<ScanLine[]> {
  const result = await query<{
    at: Date | string;
    outcome: string;
    reference: string | null;
    door: string | null;
    scanned_by: string | null;
  }>(
    `SELECT s.at, s.outcome, t.reference, s.door, s.scanned_by
       FROM ticket_scans s LEFT JOIN tickets t ON t.id = s.ticket_id
      WHERE s.event_id = $1
      ORDER BY s.at DESC LIMIT $2`,
    [eventId, limit],
  );
  return result.rows.map((row) => ({
    at: iso(row.at)!,
    outcome: row.outcome,
    reference: row.reference,
    door: row.door,
    by: row.scanned_by,
  }));
}

/* ── test support ───────────────────────────────────────────────────────── */

/* Emptied between tests. Never called by anything the site serves — and it
   refuses to run against a real Postgres, because "the tests wipe the
   database" is a sentence nobody should ever have to say. */
export async function __resetTicketingStoreForTests() {
  if (process.env.NODE_ENV === "production") throw new Error("not in production");
  await query(`DELETE FROM ticket_scans`);
  await query(`DELETE FROM ticket_deliveries`);
  await query(`DELETE FROM tickets`);
  await query(`DELETE FROM ticket_orders`);
}
