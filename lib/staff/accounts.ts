import { scryptSync, timingSafeEqual } from "node:crypto";

/* WHO IS ALLOWED IN THE BACK OF THE HOUSE.
 *
 * Two roles and nothing else, because a club with a door and an office does
 * not need a permissions matrix:
 *
 *   ADMIN   — the whole operation. Nights, orders, reservations, the scanner.
 *   SCANNER — the door, and only the door. A doorman's phone gets a camera, a
 *             verdict and a manual box; it does not get a list of who bought
 *             what for how much, because it is held up in front of a queue all
 *             night and is the likeliest phone in the building to be put down
 *             on a bar.
 *
 * ═══ WHERE THE ACCOUNTS COME FROM ═════════════════════════════════════════
 *
 * The environment, not a table. A club has three or four people who need this,
 * they change about once a year, and a user-management screen is a whole
 * second system to build, secure and get wrong. Two variables:
 *
 *   STAFF_ADMIN_PASSWORD    opens /admin and everything under it
 *   STAFF_SCANNER_PASSWORD  opens /scanner and nothing else
 *
 * A third, optional, names the doors so that a scan can be attributed:
 *
 *   STAFF_DOORS=ulaz,vip     (the sign-in page offers these; default "ulaz")
 *
 * ═══ WHAT IS ACTUALLY CHECKED ═════════════════════════════════════════════
 *
 * A password, compared in constant time against the environment. That is
 * genuinely weaker than an account per person, and the honest description of
 * what it buys is: /admin and /scanner are not open to the internet, and the
 * two roles cannot reach each other's screens. It does NOT tell the club which
 * of three doormen scanned a particular ticket — the door name does that, and
 * only as well as the doormen are honest about which door they picked.
 *
 * WHAT REPLACES IT, when the club wants it: a `staff` table with one row per
 * person and a hashed password, and `authenticate` below reading from that
 * instead of from the environment. Nothing else changes — the session, the
 * cookie, the guards and the scan attribution are all already written against
 * a `StaffIdentity` and do not care where it came from.
 *
 * ═══ AND WHAT HAPPENS WITH NOTHING CONFIGURED ═════════════════════════════
 *
 * In production, the role is CLOSED and its pages do not exist. Not open, not
 * "warn and continue" — closed, and answering 404. A staff area that falls
 * open when a variable is missing is a staff area that will one day be open.
 * In development with nothing set, both roles open with a warning printed on
 * the screen, because a locked-out laptop helps nobody. */

export type StaffRole = "admin" | "scanner";

export type StaffIdentity = {
  /* Stable, and written onto every ticket this person scans. */
  id: string;
  name: string;
  role: StaffRole;
  /* Which door they are working, for a scanner session. */
  door?: string;
};

function secretFor(role: StaffRole): string | null {
  const raw =
    role === "admin"
      ? process.env.STAFF_ADMIN_PASSWORD
      : process.env.STAFF_SCANNER_PASSWORD ?? process.env.SCANNER_ACCESS_CODE;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/* Whether a role may be opened at all, and on what terms.
 *
 *   "password" — configured; it must be given.
 *   "open"     — development, with nothing set. The page opens and says so on
 *                the screen, because a door that is quietly unlocked is worse
 *                than one that is loudly unlocked.
 *   "closed"   — production with nothing configured. The page does not exist.
 *                THIS IS THE SAFE DIRECTION and it is deliberate. */
export function gateFor(role: StaffRole): "password" | "open" | "closed" {
  if (secretFor(role)) return "password";
  return process.env.NODE_ENV === "production" ? "closed" : "open";
}

/* Any role configured at all? The sign-in page uses this to decide whether it
   is worth existing. */
export function anyStaffConfigured(): boolean {
  return gateFor("admin") !== "closed" || gateFor("scanner") !== "closed";
}

/* The doors the club has, for the sign-in page's list. */
export function doors(): string[] {
  const raw = process.env.STAFF_DOORS?.trim();
  if (!raw) return ["ulaz"];
  const list = raw.split(",").map((d) => d.trim()).filter(Boolean);
  return list.length > 0 ? list : ["ulaz"];
}

/* ── the one check ──────────────────────────────────────────────────────── */

/* Constant time, and over a derived key rather than the passwords themselves.
 *
 * `===` on two strings gives up at the first differing character, and how long
 * it took to give up is a small piece of the answer. Both sides are run
 * through the same slow KDF with a fixed salt first, so the comparison is
 * always over 32 bytes whatever the lengths were — and the cost of a wrong
 * guess is the KDF rather than a string compare, which is worth a great deal
 * more against a script than against a person. */
function sameSecret(given: string, expected: string): boolean {
  const salt = "plitvice-staff";
  const a = scryptSync(given, salt, 32);
  const b = scryptSync(expected, salt, 32);
  return timingSafeEqual(a, b);
}

/* Prove who somebody is. Returns an identity, or null with nothing said about
   which half was wrong. */
export function authenticate(
  role: StaffRole,
  password: string,
  door?: string,
): StaffIdentity | null {
  const gate = gateFor(role);
  if (gate === "closed") return null;

  if (gate === "password") {
    const expected = secretFor(role);
    if (!expected) return null;
    if (!sameSecret((password ?? "").trim(), expected)) return null;
  }

  const chosen = door && doors().includes(door) ? door : doors()[0];

  return {
    id: role,
    name: role === "admin" ? "Uprava" : `Ulaz — ${chosen}`,
    role,
    door: role === "scanner" ? chosen : undefined,
  };
}

/* An admin may do everything a scanner may. Written once so no page has to
   remember it. */
export function may(role: StaffRole, needed: StaffRole): boolean {
  if (needed === "scanner") return role === "admin" || role === "scanner";
  return role === "admin";
}
