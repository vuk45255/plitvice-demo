"use client";

import { useSeatCopy } from "@/components/floor-plan/use-seat-copy";
import type { Seat } from "@/lib/floor-availability";

/* What a table says when the cursor rests on it.
 *
 * Two lines and no chrome: which table it is, then what it holds and where it
 * stands. Hover is a glance — the card that opens on a click is where the
 * booking happens, and nothing of it is repeated here.
 *
 * It is set beside the cursor rather than over the table, so the table it is
 * describing is never the thing it covers, and it flips to the other side near
 * the edge of the screen rather than being clipped.
 *
 * Cursors only. A thumb gets the card instead, which is a better answer on a
 * phone than a label that appears under the finger that summoned it. */

export function FloorPlanTooltip({
  seat,
  x,
  y,
}: {
  seat: Seat;
  x: number;
  y: number;
}) {
  const { heading, zoneLabel, capacity } = useSeatCopy();

  /* Near the right edge it hangs to the left; near the foot it sits above. */
  const flipX = typeof window !== "undefined" && x > window.innerWidth - 230;
  const flipY = typeof window !== "undefined" && y > window.innerHeight - 130;

  return (
    <div
      role="tooltip"
      aria-hidden="true"
      className="pointer-events-none fixed z-30 w-max max-w-[14rem] border border-gold/25 bg-night/92 px-5 py-4 backdrop-blur-md"
      style={{
        left: x,
        top: y,
        transform: `translate(${flipX ? "calc(-100% - 18px)" : "18px"}, ${
          flipY ? "calc(-100% - 18px)" : "18px"
        })`,
      }}
    >
      <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-gold-light">
        {heading(seat)}
      </p>
      <p className="mt-2 text-[0.5625rem] uppercase tracking-[0.24em] text-night-ink/45">
        <span className="tabular-nums">{capacity(seat)}</span>
        <span className="mx-2 text-gold/30" aria-hidden="true">
          ·
        </span>
        {zoneLabel(seat)}
      </p>
    </div>
  );
}
