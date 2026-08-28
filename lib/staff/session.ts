import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db/client";
import { hashToken } from "@/lib/ticketing/secrets";
import {
  doors,
  gateFor,
  type StaffIdentity,
  type StaffRole,
} from "@/lib/staff/accounts";

/* A MEMBER OF STAFF'S SESSION.
 *
 * ═══ THREE PROPERTIES, AND EACH ONE IS A DECISION ═════════════════════════
 *
 * 1. IT IS A COOKIE, AND THE COOKIE IS httpOnly.
 *    Not localStorage. A token in localStorage is readable by every script on
 *    the page, survives the tab, and is the single most commonly stolen thing
 *    on the web. httpOnly means no script can read it, quote it or send
 *    somebody else's — the browser proves who it is by HAVING the cookie, not
 *    by saying so.
 *
 * 2. IT IS A ROW, NOT A SIGNED BLOB.
 *    A signed cookie cannot be revoked: a doorman who loses their phone stays
 *    signed in until the expiry no matter what anybody does. A row can be
 *    deleted, which means "sign everybody out" is one DELETE and is available
 *    at two in the morning when it is actually needed.
 *
 * 3. THE ROW'S KEY IS A HASH OF THE COOKIE, NOT THE COOKIE.
 *    Same reason a ticket token is hashed. A read of `staff_sessions` — a
 *    backup, a support query, a log — must not hand somebody a working
 *    session.
 *
 * On Vercel a Map on the instance would be worse than useless: sessions would
 * live on whichever lambda happened to answer, and a doorman would be signed
 * out at random for the whole night. */

export const STAFF_COOKIE = "plitvice_staff";
const SESSION_HOURS = 12;

export type StaffSession = StaffIdentity & {
  expiresAt: string;
  /* The value in the cookie, so a page that has the session in hand can also
     change it (choosing tonight's event) without reading the jar again. */
  cookieValue?: string;
};

export const STAFF_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  /* Secure everywhere but a local http dev server, which would otherwise
     silently drop it and leave every member of staff signed out. */
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60,
} as const;

/* Open a session and hand back the value to put in the cookie. THE VALUE IS
   RETURNED ONCE AND NEVER STORED — only its hash goes in the table. */
export async function openStaffSession(identity: StaffIdentity): Promise<string> {
  const value = randomBytes(32).toString("base64url");

  await query(
    `INSERT INTO staff_sessions (id, staff_id, name, role, door, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))`,
    [
      hashToken(value),
      identity.id,
      identity.name,
      identity.role,
      identity.door ?? null,
      SESSION_HOURS,
    ],
  );

  /* Housekeeping, cheap and here rather than in a cron: a session that has
     expired is dead to `readStaffSession` already, and this stops the table
     growing for ever. */
  await query(`DELETE FROM staff_sessions WHERE expires_at < now() - interval '7 days'`);

  return value;
}

/* Who is signed in, according to the cookie. Undefined means nobody, and every
   caller treats that as a refusal.
 *
 * The expiry is judged BY THE DATABASE, in the same statement as the lookup —
 * so a clock skew between instances cannot extend anybody's session. */
export async function readStaffSession(
  cookieValue: string | undefined,
): Promise<StaffSession | undefined> {
  /* A development machine with nothing configured. Both roles open, and every
     page that opens this way says so on the screen. */
  if (!cookieValue) return devFallback();

  const result = await query<{
    staff_id: string;
    name: string;
    role: StaffRole;
    door: string | null;
    expires_at: Date | string;
  }>(
    `SELECT staff_id, name, role, door, expires_at FROM staff_sessions
      WHERE id = $1 AND expires_at > now()`,
    [hashToken(cookieValue)],
  );

  const row = result.rows[0];
  if (!row) return devFallback();

  return {
    id: row.staff_id,
    name: row.name,
    role: row.role,
    door: row.door ?? undefined,
    cookieValue,
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : new Date(row.expires_at).toISOString(),
  };
}

/* Nothing configured, and not production: the strongest role that is open
   this way. Never reachable in production — `gateFor` answers "closed" there
   whatever the environment says. */
function devFallback(): StaffSession | undefined {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  if (gateFor("admin") === "open") {
    return { id: "dev", name: "Razvoj", role: "admin", door: doors()[0], expiresAt };
  }
  if (gateFor("scanner") === "open") {
    return { id: "dev", name: "Razvoj — ulaz", role: "scanner", door: doors()[0], expiresAt };
  }
  return undefined;
}

/* The one a server component or a route handler asks. */
export async function currentStaff(): Promise<StaffSession | undefined> {
  const jar = await cookies();
  return readStaffSession(jar.get(STAFF_COOKIE)?.value);
}

export async function closeStaffSession(cookieValue: string | undefined) {
  if (!cookieValue) return;
  await query(`DELETE FROM staff_sessions WHERE id = $1`, [hashToken(cookieValue)]);
}

/* "Sign everybody out", for the morning after a phone goes missing. */
export async function closeAllStaffSessions(): Promise<number> {
  const result = await query(`DELETE FROM staff_sessions`);
  return result.rowCount;
}
