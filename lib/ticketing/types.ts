/* What an order and a ticket are, and the words their states are allowed to
 * take. Everything else in lib/ticketing/ is written against these; nothing
 * anywhere invents a status string of its own, and the database CHECKs in
 * lib/db/schema.ts repeat every list below so that nothing can. */

/* ── orders ─────────────────────────────────────────────────────────────── */

/* Where an order stands with the money.
 *
 *   pending  — created, nothing taken. HOLDS ITS ADMISSIONS UNTIL
 *              `holdExpiresAt`, and not one second longer.
 *   paid     — the provider says the money is in. THE ONLY STATE IN WHICH A
 *              TICKET MAY EXIST; nothing else mints one.
 *   expired  — the ten minutes ran out with nothing taken. The admissions went
 *              back on sale at `holdExpiresAt`, not when this word was written:
 *              the word is bookkeeping, the timestamp is the rule.
 *   failed   — the provider says it is not coming.
 *   refunded — it came and it went back. The tickets it minted are cancelled
 *              with it; see refundOrder in lib/ticketing/orders.ts. */
export type PaymentStatus = "pending" | "paid" | "expired" | "failed" | "refunded";

/* ═══ WHY THERE IS NO `holdsStock(status)` ANY MORE ════════════════════════
 *
 * Because the answer stopped being a function of the status alone. A pending
 * order holds its admissions while its hold is alive and releases them when it
 * is not, and the only thing that can judge "is it alive" without a race is the
 * database, in the same statement that counts. So the rule is written once, in
 * SQL, in lib/ticketing/store.ts:
 *
 *     payment_status = 'paid'
 *  OR (payment_status = 'pending' AND hold_expires_at > now())
 *
 * and no JavaScript anywhere is allowed a second opinion about it. A sweep that
 * turns lapsed pending orders into `expired` runs for tidiness and for the
 * admin screen; the count above is correct whether or not it has ever run. */

export type Order = {
  id: string;
  /* The order's own public handle — random, not sequential. What a return
     from the payment provider carries and what the "your tickets" page is
     keyed on, so that reading one order is never a matter of counting up from
     somebody else's. The internal id never appears in a URL. */
  reference: string;
  eventId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /* The same two, reduced to one canonical form each. Never shown; only ever
     searched and compared. See lib/reservations/identity.ts. */
  emailKey: string;
  phoneKey: string;
  /* How many admissions. One ticket, and one QR, will be minted per unit. */
  quantity: number;
  /* Whole dinars, worked out on the server from the event's own price. A
     total that arrived from a browser is not a total. */
  totalAmount: number;
  currency: "RSD";
  paymentStatus: PaymentStatus;
  /* Which provider is carrying this one, and its own id for it — the two
     fields a reconciliation against a bank statement ever needs. */
  paymentProvider?: string;
  paymentReference?: string;
  /* WHEN THE HOLD LAPSES. Ten minutes from checkout. The server is the sole
     authority on this instant; a countdown in a browser is a picture of it. */
  holdExpiresAt: string;
  /* A payment honoured after the hold had been given back and the room had
     filled behind it. The money is never refused — this is how the club finds
     out that it has one more guest than seats. */
  oversold: boolean;
  /* 'web' for a purchase through the site, 'admin' for one entered by staff. */
  channel: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
};

export type OrderDraft = {
  eventId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  emailKey: string;
  phoneKey: string;
  quantity: number;
  totalAmount: number;
  currency: "RSD";
  channel?: string;
};

/* ── tickets ────────────────────────────────────────────────────────────── */

/*   valid     — not yet used. The only state the door lets through.
 *   used      — redeemed at the door, once, at `scannedAt`.
 *   cancelled — refunded, revoked or replaced. Never lets anybody in and never
 *               goes back to valid; a guest who needs another one is issued
 *               another one, so the two are told apart afterwards. */
export type TicketStatus = "valid" | "used" | "cancelled";

export type Ticket = {
  /* Internal. Never in a URL, never in a QR, never shown. */
  id: string;
  /* What the guest and the doorman both read: PLV-XXXXX-XXXXX. Short enough
     to be spoken across a doorway and typed with cold hands, random enough
     not to be worked out from somebody else's. */
  reference: string;
  eventId: string;
  orderId: string;
  /* Which of the party's admissions this is — 1..quantity. It is also the
     UNIQUE (order_id, seq) that makes minting impossible to do twice. */
  seq: number;
  status: TicketStatus;
  createdAt: string;
  scannedAt?: string;
  /* Which door, and which member of staff. Set by the scanner from the staff
     session; never taken from the request body. */
  scannedBy?: string;
};

/* A ticket together with the secret that opens it. Produced ONLY at the moment
   of minting and by an explicit unseal for re-display — never by an ordinary
   read, so that no page or log gets a token by accident. */
export type TicketWithToken = Ticket & { token: string };

/* ── what the door answers ──────────────────────────────────────────────── */

/* The six things a scan can mean. The scanner turns these into a colour and a
   sentence; it never decides which one applies.
     valid        — first redemption. The ticket has just been marked used.
     already_used — somebody has already come in on this one.
     cancelled    — refunded or revoked.
     wrong_event  — a real ticket, for a different night.
     invalid      — no such ticket, or nothing that could be a ticket.
     rate_limited — too many attempts from one source. */
export type RedemptionOutcome =
  | "valid"
  | "already_used"
  | "cancelled"
  | "wrong_event"
  | "invalid"
  | "rate_limited";

/* What comes back over the wire. Deliberately thin: the door needs to know
   whether to let somebody in, which night it is and which ticket it was, and
   nothing else. NO CUSTOMER DETAILS CROSS THIS BOUNDARY — a doorman's phone is
   the least private screen in the building. */
export type RedemptionResult = {
  outcome: RedemptionOutcome;
  /* Absent for `invalid` and `rate_limited`, which have no ticket to name. */
  ticket?: {
    reference: string;
    eventTitle: string;
    eventDate: string;
    /* When the ticket was used — the moment of this scan when the outcome is
       `valid`, and the moment of the scan that won when it is
       `already_used`. */
    scannedAt?: string;
  };
  retryAfterSeconds?: number;
};
