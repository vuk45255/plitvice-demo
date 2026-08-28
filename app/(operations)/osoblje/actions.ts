"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, doors, gateFor } from "@/lib/staff/accounts";
import {
  STAFF_COOKIE,
  STAFF_COOKIE_OPTIONS,
  closeStaffSession,
  openStaffSession,
} from "@/lib/staff/session";
import { chargeMiss, sourceOf, takeScan } from "@/lib/ticketing/rate-limit";

/* Letting a member of staff in.
 *
 * ONE FORM, TWO ROLES, AND THE PASSWORD DECIDES WHICH. There is no "I am an
 * administrator" checkbox, because a checkbox would be a thing to try. The
 * admin password is checked first and the scanner password second; whichever
 * one matches is the role that is issued, and a wrong password matches neither
 * and is told nothing about which it failed against.
 *
 * THE BRAKE MATTERS MORE HERE THAN ANYWHERE. A password is short, people
 * choose short ones, and this is the one endpoint where guessing pays for
 * itself — so a wrong attempt costs eight times what a right one does, which
 * leaves a script about thirty tries a minute. */

export type StaffFormState = { error?: "wrong" | "closed" };

export async function signIn(
  _previous: StaffFormState,
  form: FormData,
): Promise<StaffFormState> {
  const source = sourceOf(await headers());
  const brake = takeScan(`staff:${source}`);
  if (!brake.ok) return { error: "wrong" };

  const password = String(form.get("password") ?? "");
  const door = String(form.get("door") ?? "") || doors()[0];
  const next = String(form.get("next") ?? "");

  /* Admin first: an administrator who also knows the door password should
     land in the office, not on the scanner. */
  const identity =
    (gateFor("admin") !== "closed" ? authenticate("admin", password, door) : null) ??
    (gateFor("scanner") !== "closed" ? authenticate("scanner", password, door) : null);

  if (!identity) {
    chargeMiss(`staff:${source}`);
    /* One answer to a wrong password, with nothing in it about how wrong. */
    return { error: "wrong" };
  }

  const value = await openStaffSession(identity);
  const jar = await cookies();
  jar.set(STAFF_COOKIE, value, STAFF_COOKIE_OPTIONS);

  /* Only ever somewhere inside this site, and only ever a path — an open
     redirect on a sign-in form is how a phishing link gets to look genuine. */
  const target =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : identity.role === "admin"
        ? "/admin"
        : "/scanner";

  redirect(target);
}

export async function signOut() {
  const jar = await cookies();
  await closeStaffSession(jar.get(STAFF_COOKIE)?.value);
  jar.delete(STAFF_COOKIE);
  redirect("/osoblje");
}
