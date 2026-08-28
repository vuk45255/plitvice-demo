import Link from "next/link";
import type { Metadata } from "next";
import { Scanner } from "@/components/ticketing/scanner";
import { chooseDoorEvent } from "@/app/(operations)/scanner/actions";
import { signOut } from "@/app/(operations)/osoblje/actions";
import { currentDoorEvent, doorEventChoices } from "@/lib/staff/door";
import { requireStaff } from "@/lib/staff/guard";
import { eventDate, t } from "@/lib/ticketing/copy";

/* /scanner — the club's own door, on a phone.
 *
 * A PHONE APPLICATION THAT HAPPENS TO BE A WEB PAGE. It is used standing up,
 * in the dark, on whatever signal reaches a doorway, by somebody with a queue
 * in front of them. So: no video, no motion library, no ambient anything, no
 * dictionary, no smooth scroll — see the note in app/(operations)/layout.tsx
 * for why that is a matter of where this file sits rather than of what it
 * imports. The camera decoder is the only heavy thing on the page and it is
 * fetched after the interface is already on the screen.
 *
 * WHO MAY OPEN IT is decided in one line, on the server, before anything is
 * rendered. The scanner component itself never asks whether somebody is staff;
 * it is simply not rendered otherwise, and the redemption endpoint behind it
 * refuses independently.
 *
 * WHICH NIGHT is a setting on the door rather than a guess. A door with no
 * night set says so and refuses to scan, because a door that quietly picked
 * the wrong one would turn away everybody who paid. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ulaz — skener",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ScannerPage() {
  const staff = await requireStaff("scanner");

  const [choices, chosen] = await Promise.all([
    doorEventChoices(),
    currentDoorEvent(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[30rem] px-4 pb-10 pt-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-5">
        <h1 className="rail rail-night text-[0.5625rem]">{t.scannerTitle}</h1>
        <div className="flex items-baseline gap-4">
          <p className="text-[0.5625rem] uppercase tracking-[0.24em] text-night-ink/30">
            {staff.door ?? staff.name}
          </p>
          {staff.role === "admin" ? (
            <Link
              href="/admin"
              className="text-[0.5625rem] uppercase tracking-[0.24em] text-night-ink/40 hover:text-gold"
            >
              {t.adminTitle}
            </Link>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="text-[0.5625rem] uppercase tracking-[0.24em] text-night-ink/40 hover:text-gold"
            >
              {t.signOut}
            </button>
          </form>
        </div>
      </header>

      {/* WHICH NIGHT. A plain form posting to a server action — no JavaScript
          needed, which matters on a phone with one bar of signal. */}
      <form action={chooseDoorEvent} className="mb-6 flex items-center gap-3">
        <label
          htmlFor="door-event"
          className="shrink-0 text-[0.5625rem] uppercase tracking-[0.24em] text-night-ink/35"
        >
          {t.chooseEvent}
        </label>
        <select
          id="door-event"
          name="eventId"
          defaultValue={chosen?.id ?? ""}
          className="h-10 min-w-0 flex-1 border-b border-line bg-transparent text-[0.8125rem] text-night-ink outline-none focus:border-gold"
        >
          <option value="" className="bg-night" disabled>
            —
          </option>
          {choices.map((event) => (
            <option key={event.id} value={event.id} className="bg-night">
              {event.title} · {eventDate(event.startsAt)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="shrink-0 text-[0.5625rem] uppercase tracking-[0.24em] text-gold"
        >
          OK
        </button>
      </form>

      <Scanner eventTitle={chosen?.title ?? null} />
    </main>
  );
}
