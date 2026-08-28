import { cookies } from "next/headers";
import { devMode } from "@/lib/ticketing/config";
import { findTicketingEvent, ticketingEvents, type TicketingEvent } from "@/lib/ticketing/events";

/* WHICH NIGHT THIS DOOR IS WORKING.
 *
 * A club runs one night at a time, and "is this ticket for tonight" has to be
 * part of the decision at the door rather than something a doorman checks by
 * reading a date off a screen at two in the morning. So the scanner carries an
 * event, and the redemption endpoint refuses anything belonging to another
 * one — see `redeem` in lib/ticketing/store.ts, where the night is a condition
 * INSIDE the update, so a ticket for Saturday presented on Friday is refused
 * AND STAYS VALID.
 *
 * ═══ WHERE THE CHOICE IS KEPT ═════════════════════════════════════════════
 *
 * An httpOnly cookie, set by a server action, and VALIDATED AGAINST THE EVENTS
 * TABLE EVERY TIME IT IS READ. It is a work setting rather than a permission —
 * the permission is the staff session, without which nothing here is reachable
 * at all — so what matters is that it names a real night and that no script on
 * the page can change it behind the doorman's back.
 *
 * It is deliberately NOT in the request body. A phone that could name the
 * night in each request would be a phone that decides whether a ticket is for
 * tonight, which is the thing this exists to stop. */

export const DOOR_EVENT_COOKIE = "plitvice_door_event";

export const DOOR_EVENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 24 * 60 * 60,
} as const;

/* The nights a door could plausibly be working: everything that is not over,
   soonest first. A draft night is included — the club sells at the door and
   scans comped tickets — but an ended one is not. */
export async function doorEventChoices(): Promise<TicketingEvent[]> {
  const all = await ticketingEvents(devMode());
  return all.filter((event) => event.status !== "ended");
}

/* The night this door is set to, or undefined. Undefined is a real state and
   the scanner says so rather than guessing: a door that quietly picked the
   wrong night would turn away everybody who paid. */
export async function currentDoorEvent(): Promise<TicketingEvent | undefined> {
  const jar = await cookies();
  const chosen = jar.get(DOOR_EVENT_COOKIE)?.value;
  if (!chosen) return undefined;
  /* Validated, every time. A cookie is a string somebody's browser sent. */
  return findTicketingEvent(chosen, devMode());
}
