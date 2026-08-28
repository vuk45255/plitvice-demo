/* Who is holding the table — as far as anything needs to know.
 *
 * A hold belongs to a browser session, and the session is a random string in a
 * cookie the browser CANNOT READ. That is the whole design, and every property
 * the hold system needs falls out of it:
 *
 *   IT SURVIVES A REFRESH. The cookie goes back up with the next request, the
 *   server finds the same hold and reports what is left of the three minutes.
 *   A guest who reloads mid-form keeps their table and does NOT get a fresh
 *   three minutes — see `acquire` in hold-store.ts.
 *
 *   IT CANNOT BE FORGED FROM THE PAGE. httpOnly means no script on the site
 *   can read it, quote it, or send somebody else's. The browser proves who it
 *   is by having the cookie, not by saying so — which is the difference
 *   between "do not trust the client" and hoping.
 *
 *   IT IDENTIFIES A SESSION AND NOTHING ELSE. No name, no telephone, no
 *   device, nothing that survives the session and nothing that says anything
 *   about the person. It is a coin to hold a place in a queue with, and it
 *   goes in the bin when the browser closes.
 *
 * NOT A LOGIN. It authenticates nothing and grants nothing except the right to
 * finish the reservation the same session started. Somebody who steals it can
 * take a table nobody had — which is what any visitor can do anyway. */

/* Session-scoped: no Max-Age and no Expires, so it dies with the browser. A
   hold outlives the tab by at most three minutes, so there is nothing here
   worth keeping any longer than that. */
export const HOLD_COOKIE = "plitvice_hold_session";

export function newSessionToken() {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/* A token from a browser is a string somebody else typed. It is only ever
   compared, never rendered and never put in a query, but it is still bounded
   and charset-checked here rather than trusted for its shape. */
export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

export const HOLD_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  /* Secure everywhere but a local http dev server, which would otherwise
     silently drop it and leave every hold anonymous. */
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
