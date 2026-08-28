import { mailFrom, type MailMessage, type MailProvider } from "@/lib/mail/provider";

/* RESEND, AND NOTHING ELSE IN THIS FILE.
 *
 * One POST to one documented endpoint, with `fetch` — no SDK, no dependency,
 * nothing to keep up to date. If the club chooses a different service, this
 * file is what gets written again; nothing above it changes, because nothing
 * above it knows this file exists.
 *
 * ═══ CREDENTIALS ══════════════════════════════════════════════════════════
 *
 *   RESEND_API_KEY — the key. Server-side only, like everything else here.
 *   MAIL_FROM      — the address messages come from, at a domain the club has
 *                    verified with the provider. NOT defaulted: a club sending
 *                    from an address it does not own is a club whose mail goes
 *                    to spam, and a plausible-looking default would hide that
 *                    until the first guest says they never got their tickets.
 *
 * Neither is invented anywhere in this project. With either missing this
 * throws, which is recorded against the delivery and shown in the office —
 * see lib/mail/send.ts — rather than being swallowed.
 *
 * ═══ ERRORS ═══════════════════════════════════════════════════════════════
 *
 * Throwing is the contract. The caller writes the failure down next to the
 * order or the reservation it was about and carries on; a paid order stays
 * paid and its tickets stay valid whatever this file does. */

const ENDPOINT = "https://api.resend.com/emails";

function apiKey(): string | undefined {
  const raw = process.env.RESEND_API_KEY?.trim();
  return raw ? raw : undefined;
}

export const resendMailProvider: MailProvider = {
  id: "resend",

  async send(message: MailMessage): Promise<void> {
    const key = apiKey();
    if (!key) throw new Error("RESEND_API_KEY is not set");

    const from = mailFrom();
    if (!from) throw new Error("MAIL_FROM is not set");

    /* Ten seconds and then give up. A mail provider that has stopped
       answering must not hold a request open — the delivery is retryable from
       the office and the guest's tickets are already reachable. */
    const abort = AbortSignal.timeout(10_000);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: abort,
    });

    if (!response.ok) {
      /* The body carries the provider's own reason, which is what a member of
         staff looking at a failed delivery actually needs. Truncated, because
         it is going into a column and onto a screen. */
      const detail = await response.text().catch(() => "");
      throw new Error(`resend ${response.status}: ${detail.slice(0, 300)}`);
    }
  },
};
