"use client";

import { INK } from "@/components/floor-plan/plan-ink";
import { cornerPath } from "@/lib/floor-plan";
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

  const x = seat.x - seat.w / 2;
  const y = seat.y - seat.h / 2;
  const upright = seat.h > seat.w;

  /* The back runs along the long side that faces the wall. */
  const back = upright
    ? { x1: x, y1: y + 3, x2: x, y2: y + seat.h - 3 }
    : { x1: x + 3, y1: y, x2: x + seat.w - 3, y2: y };

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

      {seat.corner ? (
        /* Wrapped into a corner — the same separe, drawn as the L it is. */
        <path
          d={cornerPath(x, y, seat.w, seat.h, seat.depth ?? 18, seat.corner)}
          fill={ink.fill}
          stroke={ink.stroke}
          strokeWidth={ink.width}
          strokeLinejoin="round"
          style={{ transition: "stroke 400ms ease, fill 400ms ease" }}
          pointerEvents="none"
        />
      ) : (
        <>
          <rect
            x={x}
            y={y}
            width={seat.w}
            height={seat.h}
            rx={3}
            fill={ink.fill}
            stroke={ink.stroke}
            strokeWidth={ink.width}
            style={{ transition: "stroke 400ms ease, fill 400ms ease" }}
            pointerEvents="none"
          />

          <line
            {...back}
            stroke={ink.stroke}
            strokeWidth={ink.width * 2.2}
            strokeLinecap="round"
            opacity={0.8}
            style={{ transition: "stroke 400ms ease" }}
            pointerEvents="none"
          />
        </>
      )}

      {showId || state === "picked" || state === "hover" ? (
        <SeatId seat={seat} state={state} size={12} />
      ) : null}
    </SeatShell>
  );
}
