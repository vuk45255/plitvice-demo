"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { belgradeInstant } from "@/lib/ticketing/copy";
import {
  archiveEvent,
  createEvent,
  deleteEvent,
  duplicateEvent,
  findTicketingEvent,
  restoreEvent,
  updateEvent,
  type EventWriteResult,
  type TicketingEventStatus,
} from "@/lib/ticketing/events";
import { forgetPoster, storePoster } from "@/lib/media/images";
import { slugify } from "@/lib/club/event-manager";
import { isFloorPlan } from "@/lib/venue";
import { staffFor } from "@/lib/staff/guard";

/* WHAT THE OFFICE MAY DO TO A NIGHT.
 *
 * ═══ EVERY ONE OF THESE CHECKS THE SESSION ITSELF ═════════════════════════
 *
 * A server action is a public endpoint with a nice-looking call site: anybody
 * who can find its id can post to it, from anywhere, with any body. So the
 * FIRST line of every function here is `staffFor("admin")`, without exception —
 * "the page that renders the button is behind a guard" is not protection, and a
 * scanner session is not an admin session. `staffFor` reads the cookie jar and
 * asks `staffFromCookie`, which is the authorization rule itself; a doorman's
 * session fails the role check and gets the same refusal as a stranger.
 *
 * ═══ AND NONE OF THEM DECIDES ANYTHING ════════════════════════════════════
 *
 * The rules live under lib/: the capacity floor is in `updateEvent`, what a
 * duplicate may carry is in `duplicateEvent`, whether a night may be deleted is
 * in `deleteEvent`, and whether a file may be stored is in lib/media/images.ts.
 * These functions read a form, call one of those, and turn the answer into a
 * sentence in Serbian. That is deliberate: the club will want a second way in
 * one day — a phone application, a promoter's screen — and none of those may
 * get its own opinion about whether a capacity can be lowered.
 *
 * ═══ WHY CREATING AND EDITING ARE ONE FUNCTION ════════════════════════════
 *
 * Because they are one form. Two nearly-identical parsers of the same eighteen
 * fields is how a night ends up with a dress code that saves when you edit it
 * and vanishes when you create it. The only difference is which of `createEvent`
 * or `updateEvent` is called at the end, and that is three lines. */

export type EventActionState = {
  ok?: string;
  error?: string;
  /* Set when the failure belongs to one field, so the form can point at it. */
  field?: string;
};

/* ── reading a form ─────────────────────────────────────────────────────── */

const text = (form: FormData, key: string): string =>
  String(form.get(key) ?? "").trim();

/* Present-but-empty means CLEAR IT; absent means LEAVE IT ALONE. The editor
   posts every field it renders, so on that form empty genuinely means empty —
   which is how a dress code is removed. */
const optional = (form: FormData, key: string): string | undefined =>
  form.get(key) === null ? undefined : text(form, key);

const number = (form: FormData, key: string): number | undefined => {
  const raw = form.get(key);
  if (raw === null || String(raw).trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : undefined;
};

/* A checkbox that is not ticked is not posted at all, so its absence is `false`
   rather than "unchanged" — correct here because the editor always renders
   both switches. */
const flag = (form: FormData, key: string): boolean => form.get(key) === "on";

/* A wall-clock reading from a `datetime-local` field, as a real instant. The
   club types its own clock; `belgradeInstant` turns it into the moment it
   names. Empty string is kept as empty string, which the writer stores as NULL
   — that is how a sales window is cleared. */
const instant = (form: FormData, key: string): string | undefined => {
  const value = text(form, key);
  return value ? belgradeInstant(value) : "";
};

/* ═══ A DATE AND A TIME, WHICH IS HOW A CLUB SAYS WHEN ════════════════════
 *
 * The form asks for them separately — `date` and `startTime` — rather than as
 * one `datetime-local`, because on a phone those are two native pickers a
 * thumb can actually use, and because "Datum" and "Vreme početka" is how
 * somebody describes a night out loud.
 *
 * They are put back together here, in the club's own clock, and turned into a
 * real instant by `belgradeInstant`. */
const joined = (form: FormData, dateKey: string, timeKey: string): string | undefined => {
  const date = text(form, dateKey);
  const time = text(form, timeKey);
  if (!date || !time) return undefined;
  return belgradeInstant(`${date}T${time}`);
};

/* ═══ WHEN THE DOORS OPEN, GIVEN ONLY A TIME ══════════════════════════════
 *
 * The doors are asked for as a time alone, because they are always the same
 * night as the party and asking for the date twice is asking a question whose
 * answer is already on the screen.
 *
 * THE ONE SUBTLETY, AND IT IS THE REAL CASE HERE: a night that starts at 01:00
 * has its doors at 22:00 THE PREVIOUS CALENDAR DAY. So a doors time later than
 * the start time means the evening before — the doors always open before the
 * party starts, and that fact is what resolves the ambiguity rather than any
 * guess about how clubs work.
 *
 * Equal times are the same instant, which is exactly what "doors when it
 * starts" means. */
const doorsInstant = (
  form: FormData,
  startsAt: string,
): string | undefined => {
  const date = text(form, "date");
  const start = text(form, "startTime");
  const doors = text(form, "doorsTime");
  /* Present-but-empty clears it; that is what the writer turns into NULL. */
  if (!doors) return "";
  if (!date || !start) return "";

  const sameDay = belgradeInstant(`${date}T${doors}`);
  if (!sameDay) return "";
  /* A whole day earlier, computed on the INSTANT rather than on the date
     string, so it stays correct across a daylight-saving change. */
  return Date.parse(sameDay) > Date.parse(startsAt)
    ? new Date(Date.parse(sameDay) - 24 * 60 * 60 * 1000).toISOString()
    : sameDay;
};

/* ── creating and editing ───────────────────────────────────────────────── */

/* The intent the button carried. THREE BUTTONS, THREE MEANINGS, and the one
 * that matters is that saving is never publishing:
 *
 *   "draft"   — write it down, do not announce it.
 *   "publish" — write it down and put it on the wall. Only ever from a button
 *               that says OBJAVI, so nobody publishes by pressing Enter in a
 *               text field: an unrecognised intent is treated as "save".
 *   "save"    — keep whatever status it already has. This is what editing a
 *               published night does, and it is the default. */
type Intent = "draft" | "publish" | "save";

function intentOf(form: FormData): Intent {
  const raw = text(form, "intent");
  return raw === "draft" || raw === "publish" ? raw : "save";
}

export async function saveEvent(
  _previous: EventActionState,
  form: FormData,
): Promise<EventActionState> {
  const staff = await staffFor("admin");
  if (!staff) return { error: "Nemate pristup." };

  const id = text(form, "id");
  const existing = id ? await findTicketingEvent(id, true) : undefined;
  if (id && !existing) return { error: "Događaj ne postoji." };

  const title = text(form, "title");
  if (!title) return { error: "Naziv je obavezan.", field: "title" };

  const startsAt = joined(form, "date", "startTime");
  if (!startsAt) return { error: "Datum i vreme početka su obavezni.", field: "date" };

  const capacity = number(form, "capacity");
  const ticketPrice = number(form, "ticketPrice");
  const maxPerOrder = number(form, "maxPerOrder");

  if (capacity !== undefined && capacity < 0) {
    return { error: "Kapacitet ne može biti negativan.", field: "capacity" };
  }
  if (ticketPrice !== undefined && ticketPrice < 0) {
    return { error: "Cena ne može biti negativna.", field: "ticketPrice" };
  }
  if (maxPerOrder !== undefined && maxPerOrder < 1) {
    return { error: "Najviše po porudžbini mora biti bar 1.", field: "maxPerOrder" };
  }

  const floorPlanRaw = text(form, "floorPlan") || "default";
  if (!isFloorPlan(floorPlanRaw)) return { error: "Nepoznat plan sale." };

  const intent = intentOf(form);
  const status = statusFor(intent, existing?.status);

  /* ═══ THE POSTER ══════════════════════════════════════════════════════
   *
   * Handled BEFORE the row is written and its failure is fatal to the save, on
   * purpose: an event that saved while its poster silently did not is an event
   * somebody believes has a poster. Every other kind of half-success in this
   * system is avoided the same way.
   *
   * The file is validated and stored by lib/media/images.ts, which is the only
   * thing that decides what may be uploaded and under what key — nothing the
   * browser sent, including the filename, reaches a path. */
  const upload = form.get("poster");
  const removing = form.get("posterRemove") === "1";
  let image: string | undefined;
  let posterKey: string | undefined;
  let replaced: string | undefined;

  if (upload instanceof File && upload.size > 0) {
    /* Keyed under the event that owns it. A night being created has no id yet,
       so the key is minted under a temporary owner and the row records it
       either way — the key is random, so nothing collides and nothing leaks. */
    const stored = await storePoster(upload, existing?.id ?? "new");
    if (!stored.ok) return { error: stored.message, field: "poster" };
    image = stored.media.url;
    posterKey = stored.media.key;
    replaced = existing?.posterKey;
  } else if (removing) {
    /* Cleared. Empty string is what the writer turns into NULL. */
    image = "";
    posterKey = "";
    replaced = existing?.posterKey;
  }

  const shared = {
    title,
    startsAt,
    doorsAt: doorsInstant(form, startsAt),
    description: optional(form, "description"),
    ticketingEnabled: flag(form, "ticketingEnabled"),
    tablesEnabled: flag(form, "tablesEnabled"),
    floorPlan: floorPlanRaw,
    lineup: optional(form, "lineup"),
    genre: optional(form, "genre"),
    ageRestriction: optional(form, "ageRestriction"),
    entryNote: optional(form, "entryNote"),
    dressCode: optional(form, "dressCode"),
    promotion: optional(form, "promotion"),
  };

  let result: EventWriteResult;
  let createdId: string | undefined;

  if (existing) {
    result = await updateEvent(existing.id, {
      ...shared,
      slug: text(form, "slug").toLowerCase() || undefined,
      status,
      capacity,
      ticketPrice,
      maxPerOrder,
      salesStart: instant(form, "salesStart"),
      salesEnd: instant(form, "salesEnd"),
      image,
      posterKey,
    });
  } else {
    /* A NEW NIGHT NEEDS A SLUG AND NOBODY TYPED ONE. Derived from the title,
       and retried with a numeric tail if it is taken — the unique index is
       still what decides, so two people creating "Saturday Madness" at the
       same instant produce two nights rather than one error. */
    const asked = text(form, "slug").toLowerCase() || slugify(title);
    if (!asked) return { error: "Naziv mora sadržati bar jedno slovo ili broj.", field: "title" };

    result = { ok: false, reason: "slug_taken" };
    for (let attempt = 0; attempt < 12 && !result.ok; attempt += 1) {
      result = await createEvent({
        ...shared,
        slug: attempt === 0 ? asked : `${asked}-${attempt + 1}`,
        status,
        capacity: capacity ?? 0,
        ticketPrice: ticketPrice ?? 0,
        maxPerOrder,
        image: image || undefined,
        posterKey: posterKey || undefined,
      });
      if (!result.ok && result.reason !== "slug_taken") break;
    }
    if (result.ok) createdId = result.event.id;
  }

  if (!result.ok) {
    /* The upload succeeded and the row did not, so the object in the bucket is
       already unreferenced. Thrown away here rather than left to accumulate. */
    if (posterKey) await forgetPoster(posterKey);
    return { error: refusal(result), field: result.reason === "slug_taken" ? "slug" : undefined };
  }

  /* The row now points at the new poster, so the OLD object is unreferenced.
     Deleted last and never awaited into the outcome: a bucket that is slow to
     delete must not be able to fail a save that has already happened. */
  if (replaced && replaced !== posterKey) await forgetPoster(replaced);

  revalidatePath("/admin");
  revalidatePath("/admin/dogadjaji");
  revalidatePath(`/admin/dogadjaji/${result.event.id}`);

  /* A night that has just been created is a night somebody wants to keep
     working on, so they are taken to it rather than left on an empty form. */
  if (createdId) redirect(`/admin/dogadjaji/${createdId}?novo=1`);

  return { ok: intent === "publish" ? "Objavljeno." : "Sačuvano." };
}

/* Saving is not publishing, and publishing an already-published night does not
   quietly demote it. */
function statusFor(
  intent: Intent,
  current: TicketingEventStatus | undefined,
): TicketingEventStatus | undefined {
  if (intent === "publish") return "on_sale";
  if (intent === "draft") return "draft";
  return current === undefined ? "draft" : undefined;
}

function refusal(result: Extract<EventWriteResult, { ok: false }>): string {
  if (result.reason === "capacity_below_sold") {
    return `Već je prodato ili rezervisano ${result.taken}. Kapacitet ne može biti manji.`;
  }
  if (result.reason === "slug_taken") return "Ta adresa (slug) je već zauzeta.";
  if (result.reason === "invalid") {
    return "Proverite podatke — adresa sme da sadrži samo mala slova, brojeve i crtice.";
  }
  return "Događaj nije sačuvan.";
}

/* ── the quick actions ──────────────────────────────────────────────────── */

/* Publish, pause, close — one function, because they are one change to one
   column and three buttons that mean it. The vocabulary is checked against the
   list rather than trusted: a status this system does not know is a status the
   database would refuse anyway, and refusing it here says so in words. */
const STATUSES: TicketingEventStatus[] = ["draft", "on_sale", "sold_out", "ended"];

export async function setEventStatus(
  _previous: EventActionState,
  form: FormData,
): Promise<EventActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const id = text(form, "id");
  const status = text(form, "status") as TicketingEventStatus;
  if (!STATUSES.includes(status)) return { error: "Nepoznat status." };

  const result = await updateEvent(id, { status });
  if (!result.ok) return { error: refusal(result) };

  revalidateEverywhere(id);
  return { ok: said(status) };
}

const said = (status: TicketingEventStatus): string =>
  status === "on_sale"
    ? "Prodaja je otvorena."
    : status === "draft"
      ? "Prodaja je pauzirana — veče je vraćeno u draft."
      : status === "ended"
        ? "Prodaja je zatvorena."
        : "Označeno kao rasprodato.";

/* ── duplicating ────────────────────────────────────────────────────────── */

/* The single most useful thing in this screen for a club that runs the same
   night every week. What is and is not copied is decided in `duplicateEvent`
   and explained at length there; this only carries the answer back and takes
   whoever pressed it to the copy. */
export async function duplicateNight(
  _previous: EventActionState,
  form: FormData,
): Promise<EventActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const result = await duplicateEvent(text(form, "id"));
  if (!result.ok) return { error: refusal(result) };

  revalidatePath("/admin");
  revalidatePath("/admin/dogadjaji");
  redirect(`/admin/dogadjaji/${result.event.id}?kopija=1`);
}

/* ── archiving, restoring, and the rare delete ──────────────────────────── */

export async function archiveNight(
  _previous: EventActionState,
  form: FormData,
): Promise<EventActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const id = text(form, "id");
  const result = await archiveEvent(id);
  if (!result.ok) return { error: "Događaj ne postoji." };

  revalidateEverywhere(id);
  return { ok: "Arhivirano. Sve porudžbine i rezervacije su sačuvane." };
}

export async function restoreNight(
  _previous: EventActionState,
  form: FormData,
): Promise<EventActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const id = text(form, "id");
  const result = await restoreEvent(id);
  if (!result.ok) return { error: "Događaj ne postoji." };

  revalidateEverywhere(id);
  return { ok: "Vraćeno iz arhive kao draft." };
}

/* THE ONE DESTRUCTIVE ACTION, AND IT IS ALLOWED ALMOST NEVER. `deleteEvent`
   counts what the night left behind — inside the lock, twice — and refuses if
   there is anything at all. This turns that refusal into the sentence that
   tells staff what to do instead. */
export async function removeNight(
  _previous: EventActionState,
  form: FormData,
): Promise<EventActionState> {
  if (!(await staffFor("admin"))) return { error: "Nemate pristup." };

  const id = text(form, "id");
  const event = await findTicketingEvent(id, true);
  const result = await deleteEvent(id);

  if (!result.ok) {
    if (result.reason === "has_history") {
      const { orders, tickets, reservations } = result.footprint;
      const parts = [
        orders > 0 ? `${orders} porudžbina` : "",
        tickets > 0 ? `${tickets} ulaznica` : "",
        reservations > 0 ? `${reservations} rezervacija` : "",
      ].filter(Boolean);
      return {
        error: `Ovo veče ima ${parts.join(", ")} i ne može se obrisati. Arhivirajte ga — sve ostaje sačuvano.`,
      };
    }
    return { error: "Događaj ne postoji." };
  }

  /* The row is gone, so nothing points at its poster any more. */
  await forgetPoster(event?.posterKey);

  revalidatePath("/admin");
  revalidatePath("/admin/dogadjaji");
  redirect("/admin/dogadjaji");
}

function revalidateEverywhere(id: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/dogadjaji");
  revalidatePath(`/admin/dogadjaji/${id}`);
}
