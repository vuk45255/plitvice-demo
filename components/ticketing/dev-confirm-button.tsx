"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/* The simulated payment notice — DEVELOPMENT ONLY.
 *
 * This button is standing in for a bank. What it does is POST a notice to the
 * server, exactly as a payment provider's webhook will, and the server does
 * the rest: verify the notice, claim the order, mint the tickets, hand them to
 * delivery. It does not mark anything paid itself and it does not write to the
 * store — because the point of testing is to test the path that will run, and
 * the path that will run starts with a notice arriving from outside.
 *
 * Pressing it twice is a deliberate part of the test: a real provider retries
 * its webhooks, and the second press must not mint a second set of tickets.
 * The server reports `minted: false` when that happens, and this says so. */

export function DevConfirmButton({ order }: { order: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const confirm = async () => {
    if (working) return;
    setWorking(true);
    setNote(null);

    try {
      const response = await fetch("/api/ticketing/dev/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        reason?: string;
        minted?: boolean;
        tickets?: number;
      };

      if (!data.ok) {
        setNote(`Odbijeno: ${data.reason ?? response.status}`);
        return;
      }

      if (data.minted === false) {
        setNote(
          `Već potvrđeno ranije — nije napravljen novi set (${data.tickets} ulaznica).`,
        );
      }
      router.push(`/karte/${encodeURIComponent(order)}`);
    } catch {
      setNote("Greška u komunikaciji sa serverom.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={confirm}
        disabled={working}
        className="btn-gold btn-gold-night w-full text-center disabled:opacity-50"
      >
        {working ? "Potvrđuje se…" : "Simuliraj uspešno plaćanje"}
      </button>

      {note ? (
        <p className="mt-5 text-[0.8125rem] leading-relaxed text-night-ink/55">
          {note}
        </p>
      ) : null}
    </div>
  );
}
