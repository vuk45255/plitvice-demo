import { randomBytes } from "node:crypto";

/* The two random strings the system runs on, and the one rule about both:
 * THEY ARE GENERATED WITH A CRYPTOGRAPHIC SOURCE AND NOTHING ELSE. No counter,
 * no timestamp, no `Math.random`, no order number woven in. A ticket is worth
 * whatever a night at the club is worth, and the entire protection around one
 * is that nobody can produce a second one by guessing.
 *
 * `node:crypto` is what makes this a server-only file. That is deliberate and
 * it should stay that way — nothing on the browser's side of the wire has any
 * business minting either of these.
 *
 * ── the token ──────────────────────────────────────────────────────────────
 * 24 bytes — 192 bits — printed as base64url: 32 characters, no padding, safe
 * in a URL and safe in a QR code. At 192 bits, an attacker who could try a
 * billion tokens a second against the club's server would need longer than the
 * universe has existed to expect one hit; the practical limit is the door
 * itself, and the rate limit on the redemption endpoint is what enforces it.
 *
 * WHY NOT LONGER. Every character goes into the QR, and every character makes
 * its modules smaller. 192 bits is past the point where guessing is the weak
 * link, and a QR that scans on the first try in a dark doorway is worth more
 * than bits nobody will ever need.
 *
 * ── the reference ──────────────────────────────────────────────────────────
 * PLV-XXXXX-XXXXX: ten characters of Crockford base32 — 50 bits — grouped so
 * it can be read aloud. This is the human handle: printed on the ticket, typed
 * into the scanner when a screen is too cracked or too dark to scan. Crockford
 * leaves out I, L, O and U, so there is no such thing as a one that might be
 * an ell, and `normalizeReference` folds the mistakes a person makes anyway.
 *
 * Fifty bits is not 192, and it does not need to be: the reference can only be
 * used through the redemption endpoint, which is rate limited, and a guess
 * would have to land on a ticket for tonight. It is a convenience with a lock
 * on it, not the lock. */

/* Crockford base32 — the digits and the letters that cannot be mistaken for
   one another. Thirty-two characters divides 256 exactly, so taking a random
   byte modulo the alphabet length is uniform: no character is likelier than
   any other, and no bias is introduced by the sampling. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const REFERENCE_PREFIX = "PLV";
const GROUP = 5;
const GROUPS = 2;

/* A ticket's secret. 32 URL-safe characters. */
export function newTicketToken(): string {
  return randomBytes(24).toString("base64url");
}

/* A ticket's spoken name: PLV-4K7XM-9Q2DT. */
export function newTicketReference(): string {
  const bytes = randomBytes(GROUP * GROUPS);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i += 1) {
    groups.push(chars.slice(i * GROUP, (i + 1) * GROUP).join(""));
  }
  return `${REFERENCE_PREFIX}-${groups.join("-")}`;
}

/* An order's public handle. Not a ticket and not a secret in the same sense —
   it opens a page listing that order's tickets, so it is generated the same
   way and treated with the same care. */
export function newOrderReference(): string {
  return randomBytes(18).toString("base64url");
}

/* An internal id. Never leaves the server; short only because nothing reads
   it. */
export function newInternalId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}

/* What a person typed, turned into what a reference actually is.
 *
 * Case is not identity. Neither are the dashes, the spaces somebody put in
 * instead of dashes, or the fact that they typed the letter O where the ticket
 * has a zero. Crockford's own substitutions are folded here and NOTHING ELSE
 * IS: O becomes 0, and I and L become 1, because those are the three the
 * alphabet was designed around. Every other letter it contains is a letter it
 * can really hold — Q and 0 are both in the alphabet and are different
 * characters, and folding one into the other would quietly turn one guest's
 * reference into another's.
 *
 * Returns null when what is left could not be a reference at all, so the
 * endpoint can refuse it without a lookup. */
export function normalizeReference(raw: string): string | null {
  const upper = (raw ?? "").toUpperCase();
  const body = upper
    .replace(/^PLV/, "")
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  if (body.length !== GROUP * GROUPS) return null;
  for (const ch of body) if (!ALPHABET.includes(ch)) return null;

  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i += 1) {
    groups.push(body.slice(i * GROUP, (i + 1) * GROUP));
  }
  return `${REFERENCE_PREFIX}-${groups.join("-")}`;
}

/* A token, in a form that is safe to write down.
 *
 * Logs outlive incidents. A ticket token in a log line is a working ticket for
 * anybody who ever reads that file, so nothing in this system logs one whole —
 * when something has to be identified in an error or a trace, it is identified
 * by this: enough to match two lines to each other, nowhere near enough to
 * open a door. */
export function redactToken(token: string): string {
  if (!token) return "(empty)";
  return `${token.slice(0, 4)}…(${token.length})`;
}

/* Constant-time string comparison, for the places a secret is checked against
   a secret — see lib/ticketing/scanner-auth.ts. `===` on strings gives up at
   the first differing character, and how long it took to give up is a small
   piece of the answer. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
