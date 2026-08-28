"use client";

import { useState } from "react";
import { price } from "@/lib/ticketing/copy";

/* THE TEST TILL — DEVELOPMENT ONLY.
 *
 * It stands in for the purchase panel at /rezervacija so that the whole flow
 * can be walked without a payment provider: an order, a hand-off, a
 * confirmation, tickets, QR codes, a door. It posts to the SAME endpoint the
 * real panel will post to, and it gets the same answers — this is not a
 * shortcut around the system, it is a second way in to the front of it.
 *
 * The fields are written out here rather than borrowed from
 * components/reservation/field.tsx because that one reads its error messages
 * through the site's language provider, and these pages deliberately stand
 * outside the provider tree (see app/(operations)/layout.tsx). The styling is
 * the same hairline; it is fifteen lines, and it costs a page the club's staff
 * will use at a door nothing at all.
 *
 * WHAT IS DELIBERATELY NOT HERE: any way to mark an order paid. That is the
 * next page, and it is a simulated payment NOTICE rather than a button that
 * writes to the store — because a real confirmation arrives out of band, and
 * the path being tested has to be the path that will run. */

export type SellableNight = {
  slug: string;
  title: string;
  ticketPrice: number;
  /* Whatever is left, capped by the house rule. */
  max: number;
};

export function DevPurchase({ nights }: { nights: SellableNight[] }) {
  /* Every night that is on sale, not just the first one — the second test
     night is deliberately tiny so that selling out and racing two buyers for
     the last ticket can be walked through by hand. */
  const [slug, setSlug] = useState(nights[0].slug);
  const night = nights.find((n) => n.slug === slug) ?? nights[0];
  const { title: eventTitle, ticketPrice, max } = night;

  /* Clamped against the night that is actually selected: switching to the
     small room with four in the box must not offer to buy four of twenty. */
  const [wanted, setQuantity] = useState(2);
  const quantity = Math.max(1, Math.min(wanted, Math.max(1, max)));

  const [buyer, setBuyer] = useState({
    name: "Test Gost",
    email: "test@plitviceclub.com",
    phone: "069 60 60 50",
  });
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const total = ticketPrice * quantity;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working) return;
    setWorking(true);
    setProblem(null);

    try {
      const response = await fetch("/api/ticketing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug: slug, quantity, buyer }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        reason?: string;
        remaining?: number;
        redirectUrl?: string | null;
      };

      if (!data.ok) {
        setProblem(
          data.reason === "sold_out"
            ? `Rasprodato — ostalo još ${data.remaining ?? 0}.`
            : `Porudžbina odbijena: ${data.reason ?? response.status}`,
        );
        return;
      }
      if (!data.redirectUrl) {
        /* No provider answered. In development that means dev mode is shut. */
        setProblem(
          "Nema aktivnog načina plaćanja. Uključite TICKETING_DEV_MODE=true.",
        );
        return;
      }
      window.location.assign(data.redirectUrl);
    } catch {
      setProblem("Greška u komunikaciji sa serverom.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-8">
      {nights.length > 1 ? (
        <label className="block">
          <span className="block text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45">
            Događaj
          </span>
          <select
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setProblem(null);
            }}
            className="mt-3 h-12 w-full border-b border-line bg-transparent text-base text-night-ink outline-none focus:border-gold"
          >
            {nights.map((n) => (
              <option key={n.slug} value={n.slug} className="bg-night">
                {n.title} — max {n.max}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="font-serif text-[1.5rem] leading-tight text-night-ink">
          {eventTitle}
        </p>
      )}

      <div className="mt-8">
        <span className="block text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45">
          Broj karata
        </span>
        <div className="mt-4 flex w-fit items-center gap-7 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Jedna karta manje"
            className="flex h-11 w-11 items-center justify-center text-night-ink/70 disabled:opacity-25"
          >
            <span className="block h-px w-4 bg-current" aria-hidden="true" />
          </button>
          <span className="w-14 text-center font-serif text-[1.75rem] tabular-nums leading-none text-night-ink">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
            aria-label="Jedna karta više"
            className="relative flex h-11 w-11 items-center justify-center text-night-ink/70 disabled:opacity-25"
          >
            <span className="block h-px w-4 bg-current" aria-hidden="true" />
            <span className="absolute block h-4 w-px bg-current" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-7">
        <DevField
          id="dev-name"
          label="Ime i prezime"
          value={buyer.name}
          onChange={(v) => setBuyer((b) => ({ ...b, name: v }))}
        />
        <DevField
          id="dev-email"
          label="Email"
          type="email"
          value={buyer.email}
          onChange={(v) => setBuyer((b) => ({ ...b, email: v }))}
        />
        <DevField
          id="dev-phone"
          label="Telefon"
          type="tel"
          value={buyer.phone}
          onChange={(v) => setBuyer((b) => ({ ...b, phone: v }))}
        />
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-6 border-t border-line pt-5">
        <span className="text-[0.6875rem] uppercase tracking-[0.3em] text-night-ink/50">
          Ukupno
        </span>
        <span className="font-serif text-[1.75rem] tabular-nums leading-none text-gold-light">
          {price(total)}
        </span>
      </div>

      {problem ? (
        <p className="mt-6 text-[0.8125rem] leading-relaxed text-[#e6a091]">
          {problem}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={working}
        className="btn-gold btn-gold-night mt-10 w-full text-center disabled:opacity-50"
      >
        {working ? "Šalje se…" : "Nastavi na plaćanje"}
      </button>
    </form>
  );
}

function DevField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="mt-3 h-12 w-full border-b border-line bg-transparent text-base text-night-ink outline-none transition-colors duration-500 focus:border-gold"
      />
    </div>
  );
}
