import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TicketFace } from "@/components/ticketing/ticket-face";
import { devMode } from "@/lib/ticketing/config";
import { t } from "@/lib/ticketing/copy";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { qrSvg } from "@/lib/ticketing/qr";
import { requestOrigin } from "@/lib/ticketing/origin";
import { ticketUrl } from "@/lib/ticketing/links";
import { findTicketByToken, ticketsForOrder } from "@/lib/ticketing/store";

/* One ticket, at its own address.
 *
 * THE TOKEN IN THE URL IS THE WHOLE OF THE AUTHENTICATION, and that is the
 * correct design for a ticket: it is a bearer thing, like the paper one it
 * replaces, and whoever holds it may use it. That is why the token is 192 bits
 * of randomness, why the database keeps only its hash, and why nothing
 * personal is shown on the page — see lib/ticketing/secrets.ts and the note in
 * components/ticketing/ticket-face.tsx.
 *
 * READ-ONLY. Opening a ticket does not use it, does not change it and does not
 * count as anything. A guest may look at it forty times on the way to the
 * club. Only the door redeems, and only through lib/ticketing/redeem.ts.
 *
 * LIGHT ON PURPOSE. No Lenis, no motion library, no video, no dictionary — see
 * app/(operations)/layout.tsx. The QR is rendered into the HTML on the server,
 * so it is on the screen before a single script has run, which is the only
 * guarantee worth having when somebody is being waved forward. */

export const runtime = "nodejs";
/* Never cached, never prerendered, never shared between two people. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ulaznica",
  robots: { index: false, follow: false, nocache: true },
};

export default async function TicketPage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;

  /* Looked up by the hash of what is in the URL. The raw token never reaches
     the database and never appears in a query log. */
  const ticket = await findTicketByToken(token);
  if (!ticket) notFound();

  const event = await findTicketingEvent(ticket.eventId, devMode());
  if (!event) notFound();

  /* Which of the party's tickets this is — "2 / 4". The order is looked up for
     the count and for nothing else; nothing about it reaches the page. */
  const siblings = await ticketsForOrder(ticket.orderId);

  /* The QR carries this page's own absolute address, built from the host the
     request arrived on so that a ticket opened over the office wifi carries a
     code the phone next to it can reach. See lib/ticketing/origin.ts. */
  const origin = await requestOrigin();
  const qr = await qrSvg(ticketUrl(origin, token), {
    title: `${t.ticket} ${ticket.reference}`,
  });

  return (
    <main className="mx-auto w-full max-w-[27rem] px-4 pb-16 pt-6 sm:pt-10">
      <TicketFace
        eventTitle={event.title}
        eventStartsAt={event.startsAt}
        eventDoorsAt={event.doorsAt}
        reference={ticket.reference}
        status={ticket.status}
        scannedAt={ticket.scannedAt}
        qr={qr}
        position={
          siblings.length > 1
            ? { index: ticket.seq, of: siblings.length }
            : undefined
        }
      />

      {/* The one piece of advice that changes whether the code reads on the
          first try. Nothing else is written under the ticket: a page that
          explains itself is a page nobody has time to read in a queue. */}
      <p className="mt-8 text-center text-[0.6875rem] leading-relaxed text-night-ink/35">
        {t.brightness}
      </p>
    </main>
  );
}
