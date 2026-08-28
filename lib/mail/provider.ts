/* WHO ACTUALLY PUTS A MESSAGE IN SOMEBODY'S INBOX.
 *
 * One interface, one function, and everything above it — tickets, reservation
 * confirmations, the note to the office — is written against this and knows no
 * provider's name. The same arrangement as the payment boundary, for the same
 * reason: the club has not chosen a mail service yet, and the wrong time to
 * find that out is when it has.
 *
 * ═══ WHICH ONE RUNS ═══════════════════════════════════════════════════════
 *
 *   MAIL_PROVIDER unset or "log" → the log provider. Nothing is sent; one line
 *                                  per message appears in the server's output.
 *                                  This is the development default and it is a
 *                                  STATE, not a failure: the tickets exist and
 *                                  are reachable at their URLs regardless.
 *   MAIL_PROVIDER=resend         → Resend, over its documented HTTP endpoint.
 *                                  Needs RESEND_API_KEY and MAIL_FROM.
 *   anything else                → an error naming what was asked for. A typo
 *                                  in a variable must not silently mean "send
 *                                  nothing" on a server that is selling
 *                                  tickets.
 *
 * ═══ WHAT A PROVIDER MAY AND MAY NOT DO ═══════════════════════════════════
 *
 * It may throw. Every caller records the failure against the thing the message
 * was about and moves on — a mail service having a bad morning is never
 * allowed to make a paid order look unpaid. See lib/mail/send.ts.
 *
 * It may not decide anything. No provider looks at an order, a reservation or
 * a ticket; it is handed an address, a subject and two rendered bodies. */

export type MailMessage = {
  to: string;
  subject: string;
  /* Both, always. A mail with no plain-text part is a mail that some clients
     show as an empty message and some spam filters score against. */
  html: string;
  text: string;
  /* Where a guest's reply should go, when it is not the sending address. */
  replyTo?: string;
};

export type MailProvider = {
  id: string;
  send(message: MailMessage): Promise<void>;
};

export function providerName(): string {
  const raw = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  return raw ? raw : "log";
}

/* The address messages come from. Required by every real provider, and
   deliberately not defaulted to something plausible — a club sending from an
   address it does not own is a club whose mail goes to spam. */
export function mailFrom(): string | undefined {
  const raw = process.env.MAIL_FROM?.trim();
  return raw ? raw : undefined;
}

/* Where the office wants to hear about new bookings. Unset is a state: no
   internal notice is sent, and nothing fails. */
export function officeAddress(): string | undefined {
  const raw = process.env.RESERVATIONS_NOTIFY_EMAIL?.trim();
  return raw ? raw : undefined;
}

/* Imported dynamically so a deployment on the log provider never loads the
   others, and so adding a provider is adding a file. */
export async function activeMailProvider(): Promise<MailProvider> {
  const name = providerName();

  if (name === "log" || name === "none") {
    const { logMailProvider } = await import("@/lib/mail/log");
    return logMailProvider;
  }

  if (name === "resend") {
    const { resendMailProvider } = await import("@/lib/mail/resend");
    return resendMailProvider;
  }

  throw new Error(
    `MAIL_PROVIDER="${name}" is not implemented — see lib/mail/provider.ts. ` +
      "Set MAIL_PROVIDER=log to keep mail off, or implement the provider.",
  );
}
