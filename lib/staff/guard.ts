import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { anyStaffConfigured, may, type StaffRole } from "@/lib/staff/accounts";
import {
  STAFF_COOKIE,
  currentStaff,
  readStaffSession,
  type StaffSession,
} from "@/lib/staff/session";

/* THE ONE LINE AT THE TOP OF EVERY STAFF PAGE.
 *
 *   const staff = await requireStaff("admin");
 *
 * Three outcomes, and the order matters:
 *
 *   · Nothing configured at all in production → 404. The page does not exist.
 *     Not "forbidden", which would have told somebody it is there; not open,
 *     which is how staff areas end up on the open web.
 *
 *   · Configured, nobody signed in → the sign-in page, with a note of where
 *     they were going so they land there afterwards.
 *
 *   · Signed in with the wrong role → 404 as well. A doorman who types /admin
 *     learns nothing about whether there is an /admin.
 *
 * A GUARD IS NOT THE PROTECTION, it is the first layer. Every route handler
 * behind these pages checks the session again for itself, because a page that
 * is not rendered is not the same thing as an endpoint that refuses. */
export async function requireStaff(role: StaffRole): Promise<StaffSession> {
  if (!anyStaffConfigured()) notFound();

  const staff = await currentStaff();
  if (!staff) redirect(`/osoblje?next=${encodeURIComponent(pathFor(role))}`);
  if (!may(staff.role, role)) notFound();

  return staff;
}

/* The same, for a route handler: no redirect, no 404, just the answer. */
export async function staffFor(role: StaffRole): Promise<StaffSession | undefined> {
  const jar = await cookies();
  return staffFromCookie(jar.get(STAFF_COOKIE)?.value, role);
}

/* THE WHOLE OF THE AUTHORIZATION RULE, with the cookie passed in rather than
 * read out of a request.
 *
 * Two reasons it is shaped this way. It is what `staffFor` above actually
 * does, so there is one rule and not two that could drift; and it can be
 * called from a test, which `cookies()` cannot — a claim like "a scanner
 * cannot reach the office" is worth nothing if the only thing that can check
 * it is a person clicking. See lib/staff/operations.test.ts.
 *
 * A missing, unknown or expired cookie and a session with the wrong role are
 * all the same answer: undefined. Nothing tells a caller which it was. */
export async function staffFromCookie(
  cookieValue: string | undefined,
  role: StaffRole,
): Promise<StaffSession | undefined> {
  const staff = await readStaffSession(cookieValue);
  if (!staff || !may(staff.role, role)) return undefined;
  return staff;
}

function pathFor(role: StaffRole) {
  return role === "admin" ? "/admin" : "/scanner";
}
