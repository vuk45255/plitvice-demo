import { query } from "@/lib/db/client";
import { activeMailProvider, providerName, type MailMessage } from "@/lib/mail/provider";

/* SENDING SOMETHING AT MOST ONCE, AND NEVER LOSING THE FACT THAT IT FAILED.
 *
 * ═══ THE CLAIM ════════════════════════════════════════════════════════════
 *
 * `mail_deliveries` has a PRIMARY KEY of (kind, key) — ("reservation", r2026…)
 * — and the INSERT that claims it is what decides who sends. Two instances
 * reacting to the same confirmation both run it; one gets the row and sends,
 * the other is told the job is taken and stops. That is the same shape as
 * `ticket_deliveries`, which keeps its own table because it is keyed to an
 * order and guards a payment.
 *
 * IT IS A ROW AND NOT A FLAG IN MEMORY, because on Vercel a flag in memory is
 * a flag on one of however many instances are running, and the retry that
 * comes in four seconds later lands on a different one.
 *
 * ═══ FAILURE IS A STATE, NOT AN EXCEPTION ═════════════════════════════════
 *
 * Nothing in here throws at its caller. A mail service having a bad morning
 * must never be the reason a paid order looks unpaid or a confirmed table
 * looks unconfirmed. What happens instead: `status = 'failed'`, the provider's
 * own reason in `last_error`, and the row shows up in the office where a
 * person can press send again. */

export type MailKind =
  | "reservation-guest"
  | "reservation-office";

export type SendOutcome = "sent" | "failed" | "already-claimed" | "no-recipient";

/* Send once, ever, for this (kind, key). */
export async function sendOnce(
  kind: MailKind,
  key: string,
  message: MailMessage | null,
): Promise<SendOutcome> {
  /* No address to send to is not a failure and must not be written down as
     one: a guest who rang up without an email, or an office that has not set
     RESERVATIONS_NOTIFY_EMAIL yet. */
  if (!message || !message.to) return "no-recipient";

  /* A `queued` row that has not moved in five minutes may be re-claimed: the
     instance that took it was frozen or killed between claiming and sending,
     and without this the message would be stuck as somebody else's job for
     ever. Five minutes is far longer than any real send. See the same
     reasoning, at greater length, in lib/ticketing/delivery.ts. */
  const claim = await query(
    `INSERT INTO mail_deliveries (kind, key, recipient, status, attempts)
     VALUES ($1, $2, $3, 'queued', 1)
     ON CONFLICT (kind, key) DO UPDATE
       SET attempts = mail_deliveries.attempts + 1,
           recipient = EXCLUDED.recipient,
           updated_at = now()
     WHERE mail_deliveries.status = 'queued'
       AND mail_deliveries.updated_at < now() - interval '5 minutes'
     RETURNING key`,
    [kind, key, message.to],
  );
  if (claim.rowCount === 0) return "already-claimed";

  return deliver(kind, key, message);
}

/* Send again, on purpose, because a person pressed a button. Deliberately NOT
   behind the claim — the claim exists to stop a machine repeating itself, not
   a member of staff choosing to. */
export async function sendAgain(
  kind: MailKind,
  key: string,
  message: MailMessage | null,
): Promise<SendOutcome> {
  if (!message || !message.to) return "no-recipient";

  await query(
    `INSERT INTO mail_deliveries (kind, key, recipient, status, attempts)
     VALUES ($1, $2, $3, 'queued', 1)
     ON CONFLICT (kind, key) DO UPDATE
       SET attempts = mail_deliveries.attempts + 1,
           status = 'queued',
           recipient = EXCLUDED.recipient,
           updated_at = now()`,
    [kind, key, message.to],
  );

  return deliver(kind, key, message);
}

async function deliver(
  kind: MailKind,
  key: string,
  message: MailMessage,
): Promise<SendOutcome> {
  try {
    const provider = await activeMailProvider();
    await provider.send(message);
    await query(
      `UPDATE mail_deliveries
          SET status = 'sent', last_error = NULL, updated_at = now()
        WHERE kind = $1 AND key = $2`,
      [kind, key],
    );
    return "sent";
  } catch (error: unknown) {
    await query(
      `UPDATE mail_deliveries
          SET status = 'failed', last_error = $3, updated_at = now()
        WHERE kind = $1 AND key = $2`,
      [kind, key, String(error).slice(0, 500)],
    ).catch(() => undefined);
    console.error(`[mail] ${kind} ${key} failed via ${providerName()}`, error);
    return "failed";
  }
}

export type MailDeliveryRecord = {
  kind: string;
  key: string;
  recipient: string;
  status: "queued" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  updatedAt: string;
};

export async function mailDeliveryFor(
  kind: MailKind,
  key: string,
): Promise<MailDeliveryRecord | null> {
  const result = await query<MailRow>(
    `SELECT kind, key, recipient, status, attempts, last_error, updated_at
       FROM mail_deliveries WHERE kind = $1 AND key = $2`,
    [kind, key],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

/* What the office is shown: everything that did not go out. The dashboard asks
   for this, because a failed ticket mail that nobody looks at is a guest at
   the door with no ticket and no idea why. */
export async function failedDeliveries(limit = 20): Promise<MailDeliveryRecord[]> {
  const result = await query<MailRow>(
    `SELECT kind, key, recipient, status, attempts, last_error, updated_at
       FROM mail_deliveries WHERE status = 'failed'
      ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(toRecord);
}

type MailRow = {
  kind: string;
  key: string;
  recipient: string;
  status: MailDeliveryRecord["status"];
  attempts: number;
  last_error: string | null;
  updated_at: Date | string;
};

function toRecord(row: MailRow): MailDeliveryRecord {
  return {
    kind: row.kind,
    key: row.key,
    recipient: row.recipient,
    status: row.status,
    attempts: Number(row.attempts),
    lastError: row.last_error,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
  };
}
