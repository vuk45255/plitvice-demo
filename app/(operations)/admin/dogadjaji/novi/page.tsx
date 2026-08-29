import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/shell";
import { EventEditor } from "@/components/admin/event-editor";
import { mediaReadiness } from "@/lib/media/provider";
import { requireStaff } from "@/lib/staff/guard";

/* NOVI DOGAĐAJ — a night, from nothing, in under a minute.
 *
 * The same editor the night's own page uses, with no event handed to it. That
 * is the whole difference: one form, so a field cannot behave differently
 * depending on which screen somebody opened.
 *
 * WHAT MAKES IT A MINUTE. Only step 1 is required — a name and a date is a
 * night. Tickets and tables are switches that start OFF and hide everything
 * under them, so a free-entry night with no tables is four fields and a
 * button. The slug is derived from the title; nobody types a URL to put on a
 * party.
 *
 * IT SAVES AS A DRAFT UNLESS SOMEBODY PRESSES OBJAVI, and then it goes
 * straight to the night's own page — which is where the poster, the numbers
 * and the orders live, and where somebody who has just made a night wants to
 * be. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Novi događaj",
  robots: { index: false, follow: false, nocache: true },
};

export default async function NewEventPage() {
  await requireStaff("admin");

  /* Asked on the server, because environment variables are the server's
     business. A club with no object store still gets the whole form — only the
     upload box is inert, and it says why rather than disappearing. */
  const media = mediaReadiness();

  return (
    <>
      <PageHeader
        eyebrow="Program"
        title="Novi događaj"
        lede="Naziv i datum su dovoljni. Sve ostalo možete dodati kasnije."
        action={
          <Link href="/admin/dogadjaji" className="adm-btn adm-btn--sm">
            Svi događaji
          </Link>
        }
      />

      <Panel>
        <EventEditor
          posterDisabledReason={media.ready ? undefined : media.reason}
        />
      </Panel>
    </>
  );
}
