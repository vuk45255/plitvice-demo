/* The addresses of a ticket.
 *
 * Kept in their own module, free of `node:crypto` and of the store, so that a
 * browser component may import them without dragging the server's half of the
 * system into the bundle.
 *
 * ── why /t/ and not /ulaznica/ ────────────────────────────────────────────
 * This path goes inside the QR code, and every character in a QR makes its
 * modules smaller. A short path is a sparser code, and a sparser code is one
 * that reads first time off a dim phone screen held at arm's length in a
 * doorway. `/t/` costs three characters; `/ulaznica/` costs ten, for nothing a
 * guest will ever read — they arrive by scanning or by tapping a link, never
 * by typing this.
 *
 * The whole URL is roughly seventy characters, which puts the code at version
 * 4–5 with error correction M: large modules, plenty of tolerance for a
 * cracked screen, and no dependence on the scanner being close. */

export const TICKET_PATH = "/t";
export const ORDER_PATH = "/karte";

export function ticketPath(token: string) {
  return `${TICKET_PATH}/${encodeURIComponent(token)}`;
}

export function orderPath(reference: string) {
  return `${ORDER_PATH}/${encodeURIComponent(reference)}`;
}

/* The absolute address that goes into the QR.
 *
 * Absolute because a QR is scanned by whatever camera happens to be pointed at
 * it — a guest's own phone opening their ticket, a doorman's scanner reading
 * the token out of it. A relative path means nothing to either. */
export function ticketUrl(origin: string, token: string) {
  return `${origin.replace(/\/+$/, "")}${ticketPath(token)}`;
}

export function orderUrl(origin: string, reference: string) {
  return `${origin.replace(/\/+$/, "")}${orderPath(reference)}`;
}

/* What the doorman's phone actually read, reduced to what it means.
 *
 * A camera hands back whatever string was encoded. Usually that is one of our
 * ticket URLs; it might be a bare token, because a QR could have been made
 * some other way; and it might be an advertisement on the wall behind the
 * guest. This turns the first two into a token and the third into null, and it
 * is deliberately strict — anything it lets through becomes a database lookup,
 * and a doorman does not want to hear about a poster.
 *
 * NOTE THAT IT ONLY EVER RETURNS A CANDIDATE. Whether a token is a ticket, and
 * whether that ticket may come in, is the server's to say and nothing here
 * pretends to know. */
export function tokenFromScan(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  /* A URL — ours or anybody's. Only the path matters: the same ticket read
     through a tunnel, over the local network and off the club's own domain is
     the same ticket, so the host is not compared. */
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const match = url.pathname.match(/\/t\/([A-Za-z0-9_-]{16,64})\/?$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /* A bare token: base64url and the right sort of length. */
  return /^[A-Za-z0-9_-]{16,64}$/.test(text) ? text : null;
}
