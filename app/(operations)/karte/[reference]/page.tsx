import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lockup } from "@/components/lockup";
import { devMode } from "@/lib/ticketing/config";
import { eventDate, eventTime, t, untilExpiry } from "@/lib/ticketing/copy";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { ticketPath } from "@/lib/ticketing/links";
import {
  findOrderByReference,
  ticketsForOrderWithTokens,
} from "@/lib/ticketing/store";

/* Everything one order bought, in one place.
 *
 * THIS IS THE PAGE A CONFIRMATION MAIL LINKS TO, and the page a buyer lands on
 * when they come back from a payment provider. Four admissions are four
 * tickets with four codes — a party that shares one code is a party that
 * cannot arrive separately, and a code that has been used once cannot let the
 * other three in — so this lists all four and each one opens its own.
 *
 * IT IS KEYED ON THE ORDER'S RANDOM REFERENCE, never on the internal id.
 * Nothing in this system puts a countable number in a URL; reading one order
 * must never be a matter of counting up from somebody else's.
 *
 * AND IT SHOWS NO PERSONAL DETAIL. Not the buyer's name, not their email, not
 * the amount. The person who has this link already knows what they bought, and
 * anybody else who ends up with it should learn nothing from it.
 *
 * THE FOUR STATES AN UNPAID ORDER CAN BE IN are all said plainly, because
 * "your tickets are not here" is the moment a guest most needs to be told
 * which of the four it is. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vaše ulaznice",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderTicketsPage({
  params,
}: PageProps<"/karte/[reference]">) {
  const { reference } = await params;

  const order = await findOrderByReference(reference);
  if (!order) notFound();

  const event = await findTicketingEvent(order.eventId, devMode());
  if (!event) notFound();

  /* The tokens are unsealed here and nowhere else on this page's path — the
     links below are the only reason they are needed. See
     lib/ticketing/secrets.ts for why they are not simply stored. */
  const tickets =
    order.paymentStatus === "paid" ? await ticketsForOrderWithTokens(order.id) : [];

  return (
    <main className="mx-auto w-full max-w-[27rem] px-5 pb-16 pt-8 sm:pt-12">
      <header className="text-center">
        <Lockup size="xs" tone="light" />

        <h1 className="mt-9 font-serif text-[clamp(1.75rem,7vw,2.25rem)] leading-[1.05] text-night-ink">
          {event.title}
        </h1>
        <p className="rail rail-night rail-center mt-4 text-[0.5625rem]">
          {eventDate(event.startsAt)}
        </p>
        <p className="mt-2 text-[0.8125rem] tabular-nums text-night-ink/50">
          {t.doors} {eventTime(event.startsAt)}
        </p>
      </header>

      <div className="mt-10 h-px bg-line" aria-hidden="true" />

      {tickets.length > 0 ? (
        <>
          <p className="mt-8 text-[0.5625rem] uppercase tracking-[0.42em] text-night-ink/40">
            {t.orderCount(tickets.length)}
          </p>

          <ul className="mt-5">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={ticketPath(ticket.token)}
                  className="group flex items-baseline justify-between gap-4 border-b border-line py-5 transition-colors duration-500 hover:border-gold/45"
                >
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[0.5rem] uppercase tracking-[0.36em] text-night-ink/35">
                      {t.ticket} {ticket.seq} / {tickets.length}
                    </span>
                    <span className="truncate font-mono text-[0.9375rem] tabular-nums tracking-[0.1em] text-night-ink/85">
                      {ticket.reference}
                    </span>
                  </span>

                  <span
                    className={`shrink-0 text-right text-[0.5625rem] uppercase tracking-[0.24em] transition-colors duration-500 ${
                      ticket.status === "valid"
                        ? "text-gold group-hover:text-gold-light"
                        : "text-night-ink/30"
                    }`}
                  >
                    {ticket.status === "valid"
                      ? t.openTicket
                      : ticket.status === "used"
                        ? t.statusUsed
                        : t.statusCancelled}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-[0.8125rem] leading-relaxed text-night-ink/50">
            {t.orderNote}
          </p>
        </>
      ) : (
        <p className="mt-8 text-[0.875rem] leading-relaxed text-night-ink/55">
          {waiting(order.paymentStatus, order.holdExpiresAt)}
        </p>
      )}
    </main>
  );
}

/* What to say when there are no tickets on the page.
 *
 * An order that is not paid yet is not an error — the buyer is looking at this
 * because they came back from a payment page and the confirmation has not
 * reached the server. That is a normal few seconds, and nothing here pretends
 * the money has arrived. The other three states are each said in their own
 * words, because "nothing here" for four different reasons is the thing that
 * makes people ring the club. */
function waiting(status: string, holdExpiresAt: string): string {
  if (status === "pending") {
    const left = untilExpiry(holdExpiresAt);
    return left === "isteklo"
      ? t.orderExpired
      : `${t.orderPending} (${left})`;
  }
  if (status === "expired") return t.orderExpired;
  if (status === "refunded") return t.orderRefunded;
  if (status === "failed") return t.orderFailed;
  return t.orderPending;
}
