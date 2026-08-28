import { headers } from "next/headers";
import { publicOrigin } from "@/lib/ticketing/config";

/* Where this server is, as far as a phone in the room is concerned.
 *
 * A ticket's QR has to carry an absolute URL, and during development the right
 * absolute URL is not knowable in advance: the club tests on localhost, then
 * on the machine's address over the office wifi (192.168.…), then through a
 * tunnel, and a QR built for any one of those is unscannable on the others.
 * So the host the request actually arrived on is used — which is always the
 * host the phone that is about to scan it can reach.
 *
 * TICKETING_PUBLIC_ORIGIN OVERRIDES IT, and in production it should be set,
 * for two reasons. A webhook has no request to read a host from; and a
 * `Host` header is something a client sends, so a ticket minted from an
 * attacker-supplied host would carry a link to somebody else's server. In
 * production the origin is a fact about the club, not about the request. */
export async function requestOrigin(): Promise<string> {
  const configured = publicOrigin();
  if (configured) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/* The same, for a route handler that has the request in its hand. */
export function originOf(request: Request): string {
  const configured = publicOrigin();
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}
