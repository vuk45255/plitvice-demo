/* Every switch the ticketing system has, read in one place.
 *
 * THE ONE THAT MATTERS IS `devMode`. There is no payment provider yet, so the
 * only way an order can become paid today is a simulated confirmation — and a
 * simulated confirmation is, by definition, a way of getting a real ticket
 * without paying. It is therefore behind TWO locks that must both be open:
 *
 *   1. TICKETING_DEV_MODE must be exactly "true", and
 *   2. the build must not be a production build.
 *
 * Both, deliberately. An environment variable left switched on by accident is
 * the single most likely way a test flow becomes a production bypass, and the
 * second condition means that even then, a production build refuses. Nothing
 * reads the environment for this except this file, and nothing decides for
 * itself whether it is allowed to mint a ticket — every dev-only surface asks
 * `devMode()` and every one of them refuses when it answers no.
 *
 * The day PaySpot is wired, dev mode stops mattering rather than becoming
 * dangerous: the real provider confirms real payments through the same
 * `confirmPayment` these fakes call, and this flag goes on gating only the
 * fakes. See lib/ticketing/payments/provider.ts. */

/* True only when both locks are open. Called at the moment of use, never
   captured into a module constant, so nothing can be baked in at import time
   and carried past a change of environment. */
export function devMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.TICKETING_DEV_MODE === "true";
}

/* The origin the QR codes point at.
 *
 * Left unset, the ticket page uses the host the request actually arrived on —
 * which is what makes a ticket opened over the local network, or through a
 * tunnel, carry a QR that resolves on the phone that scans it. In production
 * this is set once to the club's own origin so a ticket minted by a webhook,
 * which has no request to read a host from, still gets an absolute URL. */
export function publicOrigin(): string | null {
  const raw = process.env.TICKETING_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/* Staff access is NOT here. It moved to lib/staff/accounts.ts when it became
   two roles and a real session — see the note at the top of that file. The old
   SCANNER_ACCESS_CODE is still read there as a fallback for the scanner role,
   so an existing environment keeps working. */
