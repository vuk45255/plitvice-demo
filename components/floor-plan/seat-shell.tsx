"use client";

import { INK } from "@/components/floor-plan/plan-ink";
import { seatTurn } from "@/lib/floor-plan";
import type { Seat } from "@/lib/floor-availability";

/* What every table on the plan has in common.
 *
 * The shape is the table's own — a circle, a bar, a box — and lives in its own
 * component. What is shared is everything around it: the four states, the
 * generous invisible target laid over the top so a thumb can find it, and the
 * fact that a table is a button whether it is reached by cursor, thumb or
 * keyboard. */

export type SeatState = "available" | "hover" | "picked" | "held" | "taken";

/* PICKED WINS OVER HELD, and that is not a special case — it is the whole of
   the two-sided behaviour. The server never reports a guest's own hold as
   held (see lib/reservations/holds.ts), so a table that is both picked and
   held would mean the floor moved underneath somebody mid-form; showing it
   lit, and letting the panel's own countdown say what has happened, is kinder
   than having the table go dark under their hand. */
export function seatState(seat: Seat, picked: boolean, hovered: boolean): SeatState {
  if (seat.status === "reserved") return "taken";
  if (picked) return "picked";
  if (seat.status === "held") return "held";
  return hovered ? "hover" : "available";
}

export function seatInk(state: SeatState) {
  switch (state) {
    case "picked":
      return { stroke: INK.seatPicked, fill: INK.seatPickedFill, width: 2.4 };
    case "hover":
      return { stroke: INK.seatHover, fill: INK.seatHoverFill, width: 2 };
    case "held":
      return { stroke: INK.seatHeld, fill: INK.seatHeldFill, width: 1.6 };
    case "taken":
      return { stroke: INK.seatTaken, fill: INK.seatTakenFill, width: 1.5 };
    default:
      return { stroke: INK.seat, fill: INK.seatFill, width: 1.8 };
  }
}

export type SeatNodeProps = {
  seat: Seat;
  picked: boolean;
  hovered: boolean;
  /* Numbers appear once the map is close enough for them to be readable —
     and always on the table under the cursor or the one that was chosen,
     whatever the magnification, because that is the one being asked about. */
  showId: boolean;
  label: string;
  onSelect: (seat: Seat) => void;
  onHover: (seat: Seat | null, event?: { clientX: number; clientY: number }) => void;
};

/* The interactive wrapper: the shape goes inside, the target goes over it. */
export function SeatShell({
  seat,
  state,
  label,
  hitWidth,
  hitHeight,
  round,
  onSelect,
  onHover,
  children,
}: {
  seat: Seat;
  state: SeatState;
  label: string;
  hitWidth: number;
  hitHeight: number;
  round: boolean;
  onSelect: (seat: Seat) => void;
  onHover: SeatNodeProps["onHover"];
  children: React.ReactNode;
}) {
  /* Held and booked behave identically to a hand: neither can be opened, and
     the difference between them is a shade of gold and three minutes. Nothing
     in here needs to tell them apart. */
  const taken = state === "taken" || state === "held";

  /* A booth set at an angle on the paper is turned about its own centre, and
     the target over it turns with it. The turn is worked out in one place for
     the whole project — see `seatTurn` in lib/floor-plan.ts, and the note there
     about what happens to a map that pivots about a corner instead. */
  const turn = seatTurn(seat);

  /* A table that is gone is still drawn — the guest needs to see the room is
     filling up, and a plan with holes in it is not the club's floor. But it is
     not a control: no focus, no click, no hover card. The cursor says as much
     the moment it crosses one, which is the only way a mouse can be told
     without a word being written on the map. */
  if (taken) {
    return (
      <g transform={turn} aria-hidden="true" style={{ cursor: "not-allowed" }}>
        {children}
      </g>
    );
  }

  const choose = () => onSelect(seat);

  return (
    <g
      transform={turn}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={state === "picked"}
      style={{ cursor: "pointer", outline: "none" }}
      onClick={choose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose();
        }
      }}
      onFocus={() => onHover(seat)}
      onBlur={() => onHover(null)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") onHover(seat, e);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") onHover(seat, e);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") onHover(null);
      }}
    >
      {children}
      {/* The thumb's target, always at least large enough to hit, always
          invisible. It sits over the shape so the shape can stay small. */}
      {round ? (
        <circle cx={seat.x} cy={seat.y} r={hitWidth / 2} fill="transparent" />
      ) : (
        <rect
          x={seat.x - hitWidth / 2}
          y={seat.y - hitHeight / 2}
          width={hitWidth}
          height={hitHeight}
          fill="transparent"
        />
      )}
    </g>
  );
}

/* The table's number, set inside it once there is room for it.
 *
 * The number, not the id: the club may renumber its floor without any booking
 * changing hands, and this is the side of that seam a guest sees. */
export function SeatId({
  seat,
  state,
  size,
}: {
  seat: Seat;
  state: SeatState;
  size: number;
}) {
  return (
    <text
      x={seat.x}
      y={seat.y}
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
      fill={state === "picked" ? INK.seatIdPicked : INK.seatId}
      style={{ fontSize: size, letterSpacing: "0.08em" }}
    >
      {seat.display}
    </text>
  );
}
