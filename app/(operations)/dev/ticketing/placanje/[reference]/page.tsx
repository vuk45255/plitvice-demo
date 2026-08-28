import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lockup } from "@/components/lockup";
import { DevConfirmButton } from "@/components/ticketing/dev-confirm-button";
import { devMode } from "@/lib/ticketing/config";
import { eventDate, price } from "@/lib/ticketing/copy";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { findOrderByReference } from "@/lib/ticketing/store";

/* The stand-in for a payment provider's hosted page — DEVELOPMENT ONLY.
 *
 * A real one shows the buyer what they are about to pay and takes a card. This
 * shows the buyer what they are about to pay and has a button that pretends a
 * bank said yes. Everything around it is the real arrangement: the buyer was
 * sent here by `createPayment`, the order is already written and pending, and
 * the confirmation that follows arrives as a notice to the server rather than
 * as this page telling anybody anything.
 *
 * When PaySpot exists, this page stops being reached: `createPayment` returns
 * their URL instead, and the buyer goes there. Nothing else changes — which is
 * the entire reason this exists in this shape. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plaćanje — test",
  robots: { index: false, follow: false },
};

export default async function DevPaymentPage({
  params,
}: PageProps<"/dev/ticketing/placanje/[reference]">) {
  if (!devMode()) notFound();

  const { reference } = await params;
  const order = await findOrderByReference(reference);
  if (!order) notFound();

  const event = await findTicketingEvent(order.eventId, true);
  if (!event) notFound();

  const done = order.paymentStatus === "paid";

  return (
    <main className="mx-auto w-full max-w-[26rem] px-5 pb-20 pt-8">
      <header className="text-center">
        <Lockup size="xs" tone="light" />
        <p className="rail rail-night rail-center mt-8 text-[0.5625rem]">
          Simulirano plaćanje
        </p>
      </header>

      <div className="mt-9 border border-line px-5 py-6">
        <p className="font-serif text-[1.375rem] leading-tight text-night-ink">
          {event.title}
        </p>
        <p className="mt-2 text-[0.75rem] text-night-ink/40">
          {eventDate(event.startsAt)}
        </p>

        <dl className="mt-7 grid gap-3 text-[0.8125rem]">
          <Row label="Broj karata" value={String(order.quantity)} />
          <Row label="Status" value={order.paymentStatus} />
          <Row label="Ukupno" value={price(order.totalAmount)} />
        </dl>
      </div>

      {done ? (
        <p className="mt-10 text-[0.875rem] leading-relaxed text-night-ink/55">
          Ova porudžbina je već potvrđena.{" "}
          <a
            href={`/karte/${encodeURIComponent(order.reference)}`}
            className="link-underline text-gold"
          >
            Otvori ulaznice
          </a>
        </p>
      ) : (
        <DevConfirmButton order={order.reference} />
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-5">
      <dt className="text-night-ink/40">{label}</dt>
      <dd className="tabular-nums text-night-ink/85">{value}</dd>
    </div>
  );
}
