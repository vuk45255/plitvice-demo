"use client";

import { INK } from "@/components/floor-plan/plan-ink";
import { SeatOutline } from "@/components/floor-plan/plan-shapes";
import {
  SeatId,
  SeatShell,
  seatInk,
  seatState,
  type SeatNodeProps,
} from "@/components/floor-plan/seat-shell";

/* A table on the floor.
 *
 * Two of the club's three kinds are tables and both are drawn here: the bar
 * table as the circle it is on the house's own plan, the high table as the
 * heavy bar the house drew. They share a component because they share
 * everything but their outline — and because the club may yet tell us a
 * particular circle is really a bar, which then costs one word in
 * lib/floor-plan.ts and nothing here. */

export function FloorPlanTable({
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
  const round = seat.type === "bar";

  return (
    <SeatShell
      seat={seat}
      state={state}
      label={label}
      round={round}
      /* Generous, but never so generous that a small blacked-in mark steals
         the tap from the circle standing against it — the drawing puts them
         that close, and both have to stay reachable. */
      hitWidth={Math.max(seat.w + 10, 34)}
      hitHeight={Math.max(seat.h + 10, 34)}
      onSelect={onSelect}
      onHover={onHover}
    >
      {/* the glow, and only ever under the one table that has been chosen */}
      {state === "picked" ? (
        round ? (
          <circle
            cx={seat.x}
            cy={seat.y}
            r={seat.w / 2 + 7}
            fill="none"
            stroke={INK.seatPickedGlow}
            strokeWidth={1.6}
            filter="url(#seat-glow)"
            pointerEvents="none"
          />
        ) : (
          <rect
            x={seat.x - seat.w / 2 - 6}
            y={seat.y - seat.h / 2 - 6}
            width={seat.w + 12}
            height={seat.h + 12}
            rx={(seat.h + 12) / 2}
            fill="none"
            stroke={INK.seatPickedGlow}
            strokeWidth={1.6}
            filter="url(#seat-glow)"
            pointerEvents="none"
          />
        )
      ) : null}

      {/* The outline itself is drawn by the shared plan — see
          components/floor-plan/plan-shapes.tsx. The circle and the rounded bar
          are the same two shapes the office's map draws, from the same box. */}
      <SeatOutline
        seat={seat}
        ink={{
          ...ink,
          pointerEvents: "none",
          style: { transition: "stroke 400ms ease, fill 400ms ease" },
        }}
      />

      {showId || state === "picked" || state === "hover" ? (
        <SeatId seat={seat} state={state} size={11} />
      ) : null}
    </SeatShell>
  );
}
