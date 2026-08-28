"use server";

import { revalidatePath } from "next/cache";
import { belgradeInstant, scanMoment } from "@/lib/ticketing/copy";
import { buildDelivery, resendTickets } from "@/lib/ticketing/delivery";
import { devMode } from "@/lib/ticketing/config";
import { createEvent, findTicketingEvent, updateEvent } from "@/lib/ticketing/events";
import { publicOrigin } from "@/lib/ticketing/config";
import { refundOrder } from "@/lib/ticketing/orders";
import {
  expireLapsedOrders,
  findOrderByReference,
  ticketsForOrderWithTokens,
} from "@/lib/ticketing/store";
import {
  addPhoneReservation,
  editReservation,
  setReservationStatus,
} from "@/lib/reservations/admin";
import { resendReservationConfirmation } from "@/lib/reservations/notify";
import { reservationStore } from "@/lib/reservations/store";
import type { ReservationStatus } from "@/lib/reservations/types";
import { closeAllStaffSessions } from "@/lib/staff/session";
import { staffFor } from "@/lib/staff/guard";

/* WHAT THE OFFICE MAY DO.
 *
 * EVERY ONE OF THESE CHECKS THE SESSION ITSELF. A server action is a public
 * endpoint with a nice-looking call site — anybody who can find its id can
 * post to it — so "the page that renders the button is behind a guard" is not
 * protection. `staffFor("admin")` at the top of each, without exception.
 *
 * They also do no thinking of their own. Every rule lives in the modules under
 * lib/, because the club will one day want a second way in — a phone
 * application, a report, a webhook from a till — and none of those may get
 * their own opinion about whether a capacity may be lowered below what is
 * already sold. */

type ActionState = { ok?: string; error?: string };

/* ── nights ─────────────────────────────────────────────────────────────── */

export async function saveEvent(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const id = String(form.get("id") ?? "");
  const event = await findTicketingEvent(id, true);
  if (!event) return { error: "Događaj ne postoji." };

  const number = (key: string) => {
    const raw = form.get(key);
    if (raw === null || String(raw).trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.round(value) : undefined;
  };

  const capacity = number("capacity");
  const ticketPrice = number("ticketPrice");
  const maxPerOrder = number("maxPerOrder");
  const status = String(form.get("status") ?? "") as
    | "draft"
    | "on_sale"
    | "sold_out"
    | "ended";

  if (capacity !== undefined && capacity < 0) return { error: "Kapacitet ne može biti negativan." };
  if (ticketPrice !== undefined && ticketPrice < 0) return { error: "Cena ne može biti negativna." };
  if (maxPerOrder !== undefined && maxPerOrder < 1) return { error: "Najviše po porudžbini mora biti bar 1." };

  const text = (key: string) => {
    const raw = form.get(key);
    return raw === null ? undefined : String(raw).trim();
  };

  /* The capacity floor is NOT checked here. It lives in `updateEvent`, which
     is the one function that writes to this table — so a future till, a
     script or a second screen cannot get past it by not remembering to look.
     This only turns the refusal into a sentence. */
  const result = await updateEvent(event.id, {
    capacity,
    ticketPrice,
    maxPerOrder,
    title: text("title") || undefined,
    slug: text("slug")?.toLowerCase() || undefined,
    image: text("image"),
    description: text("description"),
    status: ["draft", "on_sale", "sold_out", "ended"].includes(status)
      ? status
      : undefined,
    /* The club types its own clock; this turns it into the instant it names.
       Empty string is kept as empty string, which `updateEvent` writes as NULL
       — that is how a sales window is cleared. */
    startsAt: instant(form.get("startsAt")) || undefined,
    doorsAt: instant(form.get("doorsAt")),
    salesStart: instant(form.get("salesStart")),
    salesEnd: instant(form.get("salesEnd")),
  });

  if (!result.ok) {
    if (result.reason === "capacity_below_sold") {
      return {
        error: `Već je prodato/rezervisano ${result.taken}. Kapacitet ne može biti manji.`,
      };
    }
    if (result.reason === "slug_taken") return { error: "Taj slug već postoji." };
    return { error: "Izmena nije sačuvana." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/dogadjaji");
  revalidatePath(`/admin/dogadjaji/${event.id}`);
  return { ok: "Sačuvano." };
}

/* A night the club is adding by hand rather than through the catalogue. It
   arrives `draft` — see `createEvent` — so nothing is on sale until somebody
   chooses to put it there. */
export async function newEvent(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const text = (key: string) => String(form.get(key) ?? "").trim();
  const number = (key: string) => {
    const value = Number(form.get(key));
    return Number.isFinite(value) ? Math.round(value) : NaN;
  };

  const startsAt = instant(form.get("startsAt"));
  if (!startsAt) return { error: "Datum i vreme su obavezni." };

  const result = await createEvent({
    title: text("title"),
    slug: text("slug").toLowerCase(),
    startsAt,
    doorsAt: instant(form.get("doorsAt")) || undefined,
    capacity: number("capacity"),
    ticketPrice: number("ticketPrice"),
    maxPerOrder: Number.isFinite(number("maxPerOrder")) ? number("maxPerOrder") : undefined,
    image: text("image") || undefined,
    description: text("description") || undefined,
  });

  if (!result.ok) {
    const said: Record<string, string> = {
      slug_taken: "Taj slug već postoji.",
      invalid:
        "Proverite podatke — slug sme da sadrži samo mala slova, brojeve i crtice.",
      unknown: "Događaj nije upisan.",
    };
    return { error: said[result.reason] ?? "Događaj nije upisan." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/dogadjaji");
  return { ok: `Upisano: ${result.event.title} (${result.event.slug}). Status: draft.` };
}

/* A wall clock reading from a datetime-local field, as an instant. Undefined
   means "leave it alone"; empty string means "clear it". */
function instant(raw: FormDataEntryValue | null): string | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return belgradeInstant(value);
}

/* Pending orders whose ten minutes are up, written down as expired. The seats
   went back the moment the timestamp passed whether or not this ever runs —
   this is bookkeeping, so the list reads honestly. */
export async function sweepHolds(): Promise<void> {
  if (!(await staffFor("admin"))) return;
  await expireLapsedOrders();
  revalidatePath("/admin");
  revalidatePath("/admin/karte");
}

/* ── orders ─────────────────────────────────────────────────────────────── */

export async function refund(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const reference = String(form.get("reference") ?? "");
  const order = await findOrderByReference(reference);
  if (!order) return { error: "Porudžbina ne postoji." };
  if (order.paymentStatus !== "paid") return { error: "Samo plaćena porudžbina može biti refundirana." };

  const result = await refundOrder(order.id);
  if (!result.ok) return { error: "Refundacija nije uspela." };

  revalidatePath("/admin/karte");
  return {
    ok: `Refundirano. Poništeno ulaznica: ${result.cancelled}. Novac se vraća kod pružaoca plaćanja.`,
  };
}

/* Sending the tickets again, because a guest lost the mail. Deliberately NOT
   behind the one-delivery-per-order claim — that exists to stop a machine
   repeating itself, not a person choosing to. */
export async function resend(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const reference = String(form.get("reference") ?? "");
  const order = await findOrderByReference(reference);
  if (!order) return { error: "Porudžbina ne postoji." };

  const event = await findTicketingEvent(order.eventId, devMode());
  if (!event) return { error: "Događaj ne postoji." };

  const tickets = await ticketsForOrderWithTokens(order.id);
  if (tickets.length === 0) return { error: "Ova porudžbina nema ulaznice." };

  const origin = publicOrigin() ?? "";
  if (!origin) {
    return {
      error:
        "TICKETING_PUBLIC_ORIGIN nije podešen, pa linkovi u poruci ne bi bili ispravni.",
    };
  }

  const outcome = await resendTickets(buildDelivery(order, event, tickets, origin));
  return outcome === "sent"
    ? { ok: "Poslato ponovo." }
    : { error: "Slanje nije uspelo." };
}

/* ── reservations ───────────────────────────────────────────────────────── */

export async function changeReservation(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await staffFor("admin");
  if (!staff) return { error: "Nemate pristup." };

  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as ReservationStatus;
  const allowed: ReservationStatus[] = [
    "pending", "confirmed", "rejected", "cancelled", "expired",
  ];
  if (!allowed.includes(status)) return { error: "Nepoznat status." };

  /* Who moved it is written next to the move — see `setStatus`. */
  const result = await setReservationStatus(id, status, staff.name);
  if (!result.ok) {
    return {
      error:
        result.reason === "seat-taken"
          ? "Taj sto je u međuvremenu dat nekom drugom."
          : "Rezervacija ne postoji.",
    };
  }

  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/plan");
  revalidatePath("/admin");
  return { ok: "Sačuvano." };
}

/* Correcting what was written down: a misheard surname, a number with a digit
   missing, two more people coming. NOT the table and NOT the night — moving a
   booking to another table is a new booking on a table that has to be free. */
export async function editReservationDetails(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await staffFor("admin");
  if (!staff) return { error: "Nemate pristup." };

  const id = String(form.get("id") ?? "");
  /* A FIELD LEFT EMPTY MEANS "LEAVE IT ALONE", not "delete it". The form is
     five boxes next to an existing booking and staff fill in the one they are
     correcting; treating the other four as instructions to blank the guest's
     name is how a telephone number disappears at one in the morning. */
  const value = (key: string) => {
    const raw = form.get(key);
    if (raw === null) return undefined;
    const text = String(raw).trim();
    return text === "" ? undefined : text;
  };

  const guestsRaw = form.get("guests");
  const result = await editReservation(
    id,
    {
      name: value("name"),
      phone: value("phone"),
      email: value("email"),
      note: value("note"),
      guests:
        guestsRaw === null || String(guestsRaw).trim() === ""
          ? undefined
          : Number(guestsRaw),
    },
    staff.name,
  );

  if (!result.ok) {
    return {
      error:
        result.reason === "unknown"
          ? "Rezervacija ne postoji."
          : "Proverite unesene podatke.",
    };
  }

  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/plan");
  return { ok: "Sačuvano." };
}

/* A guest's confirmation that did not go out, sent again by hand. Outside the
   one-message-per-booking claim, deliberately: that claim stops a machine
   repeating itself, not a person choosing to. */
export async function resendReservationMail(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const id = String(form.get("id") ?? "");
  const reservation = await reservationStore.find(id);
  if (!reservation) return { error: "Rezervacija ne postoji." };
  if (!reservation.email) return { error: "Ova rezervacija nema email adresu." };

  const outcome = await resendReservationConfirmation(reservation);
  revalidatePath("/admin/rezervacije");
  return outcome === "sent"
    ? { ok: "Poslato ponovo." }
    : { error: "Slanje nije uspelo — pogledajte podešavanja pošte." };
}

/* A booking taken over the telephone. Same table, same index, same floor — see
   the note at the top of lib/reservations/admin.ts. */
export async function addReservation(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await staffFor("admin");
  if (!staff) return { error: "Nemate pristup." };

  const result = await addPhoneReservation(
    {
      eventId: String(form.get("eventId") ?? ""),
      seatId: String(form.get("seatId") ?? ""),
      guests: Number(form.get("guests") ?? 0),
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      note: String(form.get("note") ?? ""),
    },
    staff.name,
  );

  if (!result.ok) {
    /* A TABLE SOMEBODY IS BOOKING RIGHT NOW IS NOT REFUSED IN THE SAME WORDS
       as one that is gone. Staff are told what is happening and when it frees
       up, and nothing is taken out from under a guest who may be typing their
       telephone number into the site at that moment. */
    if (result.reason === "seat-held") {
      return {
        error:
          `Taj sto neko upravo rezerviše na sajtu. Oslobađa se u ` +
          `${scanMoment(result.heldUntil)} ako ne završi rezervaciju.`,
      };
    }
    const said: Record<string, string> = {
      "seat-taken": "Taj sto je već rezervisan za to veče.",
      duplicate: "Taj gost već ima sto za to veče.",
      unavailable: "To veče ne prima rezervacije stolova.",
      invalid: "Proverite unesene podatke.",
    };
    return { error: said[result.reason] ?? "Rezervacija nije upisana." };
  }

  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/plan");
  revalidatePath("/admin");
  return { ok: `Upisano: ${result.reservation.number} — ${result.reservation.name}.` };
}

/* ── the morning after a phone goes missing ─────────────────────────────── */

export async function signOutEverybody(): Promise<void> {
  if (!(await staffFor("admin"))) return;
  await closeAllStaffSessions();
  revalidatePath("/admin");
}
