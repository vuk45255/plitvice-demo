"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { devMode } from "@/lib/ticketing/config";
import { findTicketingEvent } from "@/lib/ticketing/events";
import {
  DOOR_EVENT_COOKIE,
  DOOR_EVENT_COOKIE_OPTIONS,
} from "@/lib/staff/door";
import { staffFor } from "@/lib/staff/guard";

/* Setting which night this door is working.
 *
 * Two checks and neither is optional: the caller has to be staff, and the
 * night has to be a night this server knows about. A server action is a public
 * endpoint with a nice-looking call site — anybody can post to it — so it
 * repeats the guard the page already made rather than trusting that the page
 * made it. */
export async function chooseDoorEvent(form: FormData): Promise<void> {
  const staff = await staffFor("scanner");
  if (!staff) return;

  const eventId = String(form.get("eventId") ?? "");
  const event = await findTicketingEvent(eventId, devMode());
  if (!event) return;

  const jar = await cookies();
  /* The event's stable id, never the slug: a slug can be renamed and a door
     that had been set to the old one would silently stop matching. */
  jar.set(DOOR_EVENT_COOKIE, event.id, DOOR_EVENT_COOKIE_OPTIONS);

  revalidatePath("/scanner");
}
