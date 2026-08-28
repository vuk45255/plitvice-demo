import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DevPurchase } from "@/components/ticketing/dev-purchase";
import { Lockup } from "@/components/lockup";
import { devMode } from "@/lib/ticketing/config";
import { eventDate, price } from "@/lib/ticketing/copy";
import { remainingForOrder, saleState, ticketingEvents } from "@/lib/ticketing/events";
import { soldFor } from "@/lib/ticketing/store";

/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DEVELOPMENT ONLY. There is no payment provider yet, so this page is     ║
 * ║  the only way an order can be created and confirmed — which makes it,    ║
 * ║  by definition, a way of getting a real ticket without paying.           ║
 * ║                                                                          ║
 * ║  It refuses to exist unless dev mode is open, and dev mode is false in   ║
 * ║  any production build whatever the environment says. See                 ║
 * ║  lib/ticketing/config.ts.                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * What it is for: walking the whole flow without PaySpot. Choose a night,
 * choose a quantity, go to the (simulated) payment page, confirm, get real
 * tickets with real QR codes, open one on a phone, scan it at /scanner, watch
 * it turn green, scan it again and watch it refuse.
 *
 * Everything it touches is the production path. The only thing that is not
 * real is who says the money arrived. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ticketing — test",
  robots: { index: false, follow: false },
};

export default async function DevTicketingPage() {
  if (!devMode()) notFound();

  const events = await ticketingEvents(true);
  const rows = await Promise.all(
    events.map(async (event) => {
      const sold = await soldFor(event.id);
      return {
        event,
        sold,
        state: saleState(event, sold),
        room: remainingForOrder(event, sold),
      };
    }),
  );

  const sellable = rows.filter((row) => row.state.open);

  return (
    <main className="mx-auto w-full max-w-[30rem] px-5 pb-20 pt-8">
      <header className="text-center">
        <Lockup size="xs" tone="light" />
        <p className="rail rail-night rail-center mt-8 text-[0.5625rem]">
          Razvojni režim — test prodaja
        </p>
      </header>

      <div className="mt-9 border border-[#e6a091]/30 bg-[#e6a091]/[0.06] px-4 py-3 text-[0.6875rem] leading-relaxed text-[#e6a091]">
        Plaćanje se ovde samo simulira. Ova stranica ne postoji u produkcionom
        build-u.
      </div>

      {/* Every night the system knows about, and what it thinks of each. The
          nights that cannot be sold are shown with their reason rather than
          hidden — a test flow that silently drops an event is a test flow
          that hides the bug you were looking for. */}
      <section className="mt-10">
        <h2 className="text-[0.5625rem] uppercase tracking-[0.42em] text-night-ink/40">
          Događaji
        </h2>
        <ul className="mt-5">
          {rows.map(({ event, sold, state, room }) => (
            <li
              key={event.id}
              className="flex items-baseline justify-between gap-5 border-b border-line py-4"
            >
              <span className="flex flex-col gap-1">
                <span className="text-[0.9375rem] text-night-ink/85">
                  {event.title}
                </span>
                <span className="text-[0.6875rem] text-night-ink/35">
                  {eventDate(event.startsAt)} · {price(event.ticketPrice)}
                </span>
              </span>
              <span className="whitespace-nowrap text-right text-[0.625rem] uppercase tracking-[0.24em]">
                {state.open ? (
                  <span className="text-gold">
                    {sold}/{event.capacity}
                    <span className="ml-2 text-night-ink/30">max {room}</span>
                  </span>
                ) : (
                  <span className="text-night-ink/30">{state.reason}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-[0.5625rem] uppercase tracking-[0.42em] text-night-ink/40">
          Nova test porudžbina
        </h2>

        {sellable.length === 0 ? (
          <p className="mt-6 text-[0.875rem] leading-relaxed text-night-ink/50">
            Nijedan događaj trenutno nije u prodaji. Otvorite prodaju u
            /admin ili postavite status na &ldquo;on_sale&rdquo;.
          </p>
        ) : (
          <DevPurchase
            nights={sellable.map(({ event, room }) => ({
              slug: event.slug,
              title: event.title,
              ticketPrice: event.ticketPrice,
              max: room,
            }))}
          />
        )}
      </section>
    </main>
  );
}
