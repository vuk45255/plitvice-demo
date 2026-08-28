import type { MailMessage, MailProvider } from "@/lib/mail/provider";

/* THE PROVIDER FOR A CLUB THAT HAS NOT CHOSEN ONE YET.
 *
 * It writes one line and returns. That is not a stub standing in for the real
 * thing until somebody gets round to it — it is the correct behaviour for this
 * system in this state: the tickets exist, they are reachable at their URLs,
 * and the delivery row records honestly that this is where the message went.
 *
 * WHAT IS NOT IN THE LINE. No ticket token, no order reference, no reservation
 * id and no message body — every one of those either opens a page or is
 * somebody's private business, and a log is not a private place. The subject
 * and a masked address are enough to see that the right message went to the
 * right sort of person, which is all a log is for. */
function mask(address: string): string {
  const [user = "", domain = ""] = address.split("@");
  const head = user.slice(0, 2);
  return `${head}${user.length > 2 ? "…" : ""}@${domain}`;
}

export const logMailProvider: MailProvider = {
  id: "log",
  async send(message: MailMessage): Promise<void> {
    console.info(`[mail] ${mask(message.to)} — ${message.subject}`);
  },
};
