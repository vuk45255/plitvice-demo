"use client";

import { INK } from "@/components/floor-plan/plan-ink";
import { SeatOutline } from "@/components/floor-plan/plan-shapes";
import { seatBox } from "@/lib/floor-plan";
import {
  SeatId,
  SeatShell,
  seatInk,
  seatState,
  type SeatNodeProps,
} from "@/components/floor-plan/seat-shell";

/* A separe.
 *
 * Drawn as the box it is, with the seat-back it stands against marked as a
 * heavier line down one side — which is what tells the guest, at a glance and
 * without a legend, that this is an upholstered corner and not a table on the
 * floor. Which side the back is on is read from the box's own proportion: a
 * booth that is taller than it is wide is set against a side wall. */

export function FloorPlanBooth({
  seat,
  picked,
  hovered,
  showId,
  label,
  onSelect,
  onHover,
}: SeatNodeProps) {
  const state = seatState(seat, picked, hovered);
  const ink = seatInk(state);

  /* The plan states a table's CENTRE; this is the box that follows from it.
     Only the picked glow needs it here — the outline works it out for itself
     from the same helper. */
  const { x, y } = seatBox(seat);

  return (
    <SeatShell
      seat={seat}
      state={state}
      label={label}
      round={false}
      hitWidth={Math.max(seat.w + 8, 34)}
      hitHeight={Math.max(seat.h + 8, 34)}
      onSelect={onSelect}
      onHover={onHover}
    >
      {state === "picked" ? (
        <rect
          x={x - 6}
          y={y - 6}
          width={seat.w + 12}
          height={seat.h + 12}
          rx={7}
          fill="none"
          stroke={INK.seatPickedGlow}
          strokeWidth={1.6}
          filter="url(#seat-glow)"
          pointerEvents="none"
        />
      ) : null}

      {/* The box, the seat-back and the corner L are all drawn by the shared
          plan — see components/floor-plan/plan-shapes.tsx — so the office's map
          wraps the same separes into the same corners. */}
      <SeatOutline
        seat={seat}
        ink={{
          ...ink,
          pointerEvents: "none",
          style: { transition: "stroke 400ms ease, fill 400ms ease" },
        }}
      />

      {showId || state === "picked" || state === "hover" ? (
        <SeatId seat={seat} state={state} size={12} />
      ) : null}
    </SeatShell>
  );
}
