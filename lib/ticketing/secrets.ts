import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { query } from "@/lib/db/client";

/* HOW A TICKET'S SECRET IS KEPT.
 *
 * The QR carries a raw 192-bit token. The database does NOT.
 *
 * ═══ TWO COLUMNS, TWO JOBS ════════════════════════════════════════════════
 *
 *   token_hash    sha256 of the token, hex, UNIQUE. This is what every lookup
 *                 matches on: the door hashes whatever the camera read and
 *                 asks for that. It is a one-way function, so a copy of the
 *                 tickets table is a list of fingerprints and not a list of
 *                 working tickets — and no query, index or slow-query log ever
 *                 contains a token.
 *
 *   token_cipher  the same token sealed with AES-256-GCM under a key that
 *                 lives OUTSIDE the database.
 *
 * ═══ WHY THE SECOND COLUMN EXISTS AT ALL ══════════════════════════════════
 *
 * Because a guest has to be able to see their own ticket again. /karte/<order>
 * lists four tickets and each one opens at its own /t/<token>; the
 * confirmation mail carries those same four links; a guest who lost the mail
 * rings the club and staff re-send it. Every one of those needs the token
 * back, and a hash cannot give it back.
 *
 * A hash alone would mean the token exists in exactly one place — the browser
 * tab it was minted into — and is gone the moment that tab is closed. That is
 * not a stronger system, it is a system that loses people's tickets.
 *
 * So: hashed for lookup, sealed for re-display, and the key is not in the
 * database. Somebody who takes a dump of the tickets table gets nothing they
 * can use. Somebody who takes the dump AND the environment gets everything,
 * which is true of every system that can re-send a ticket.
 *
 * ═══ THE KEY ══════════════════════════════════════════════════════════════
 *
 * TICKET_TOKEN_KEY — 32 bytes, base64 or hex. REQUIRED IN PRODUCTION.
 *
 * With it unset, a key is generated once and kept in `app_settings`, so a
 * development machine works out of the box and a restart does not orphan every
 * ticket minted before it. That fallback is announced loudly on the server's
 * output, because a key inside the database is a key that travels with a dump
 * of the database — which is the one property this file exists to avoid.
 *
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */

const SETTING_KEY = "ticket_token_key";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Promise<Buffer> | null = null;

function keyFromEnvironment(): Buffer | null {
  const raw = process.env.TICKET_TOKEN_KEY?.trim();
  if (!raw) return null;

  const decoded = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (decoded.length !== 32) {
    throw new Error(
      "TICKET_TOKEN_KEY must be 32 bytes, given as base64 or 64 hex characters",
    );
  }
  return decoded;
}

async function key(): Promise<Buffer> {
  if (!cachedKey) {
    cachedKey = (async () => {
      const configured = keyFromEnvironment();
      if (configured) return configured;

      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[ticketing] TICKET_TOKEN_KEY is not set. Falling back to a key stored " +
            "in the database, which means a dump of the database can open every " +
            "ticket in it. Set TICKET_TOKEN_KEY before selling anything.",
        );
      }

      /* Kept once, then read back for ever. INSERT … DO NOTHING and then a
         SELECT, so two instances starting together end up with the SAME key
         rather than each overwriting the other's. */
      const fresh = randomBytes(32).toString("base64");
      await query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [SETTING_KEY, fresh],
      );
      const stored = await query<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = $1`,
        [SETTING_KEY],
      );
      return Buffer.from(stored.rows[0].value, "base64");
    })().catch((error: unknown) => {
      cachedKey = null;
      throw error;
    });
  }
  return cachedKey;
}

/* ── the two operations everything else uses ────────────────────────────── */

/* What a token is filed under. Never reversible, and the only thing a lookup
   is ever made on. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/* The token, sealed. iv ‖ tag ‖ ciphertext, base64url. */
export async function sealToken(token: string): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, await key(), iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/* The token, back. Null when the key has changed or the value is not what it
   claims to be — which is a ticket that can still be scanned (the hash is
   untouched) but can no longer be re-displayed, and the pages say so rather
   than throwing. */
export async function openToken(sealed: string): Promise<string | null> {
  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      await key(),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/* Two hashes, compared without leaking how far they matched. Used where a
   secret is checked against a secret rather than looked up. */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/* Test-only: a key change between two test files would otherwise be carried
   in this module's cache. */
export function __resetTokenKeyForTests() {
  cachedKey = null;
}
