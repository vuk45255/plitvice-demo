"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PLAN,
  SEATS,
  seatBox,
  seatNumber,
  seatTurn,
  type FloorSeat,
} from "@/lib/floor-plan";
import {
  PlanArchitecture,
  SeatOutline,
  type PlanInk,
} from "@/components/floor-plan/plan-shapes";
import { Badge } from "@/components/admin/badge";
import type { FloorState, AdminSeat } from "@/lib/reservations/admin";

/* THE FLOOR, DRAWN FOR THE OFFICE.
 *
 * ═══ THE SAME BUILDING, IN DIFFERENT INK ══════════════════════════════════
 *
 * It is not the guest's floor plan — the light on the separes, the tap-to-open
 * cards, the gold on the chosen table all belong to somebody being sold a night
 * out. But underneath, it is the SAME DRAWING, and that is now literally true
 * rather than an intention: the walls, the stage, the stairs, the spiral and
 * every table come out of `PlanArchitecture` and `SeatOutline` in
 * components/floor-plan/plan-shapes.tsx, which the reservation map calls as
 * well. This file hands them the office's palette and nothing else.
 *
 * It used to read the same ARRAYS and draw its own room from them, which
 * sounds like the same thing and is not. Reading `SEATS` did not stop this map
 * putting every table's top-left where the plan states its centre, spinning the
 * angled separes about that wrong point, drawing the round bar tables as
 * squares, or leaving out every structure in the building. Shared data was not
 * enough; the drawing had to be shared too.
 *
 * ═══ WHAT IS STILL THIS FILE'S OWN ════════════════════════════════════════
 *
 * The three states and their colours, the eight-second poll, the server's
 * clock, the click, and the panel down the right-hand side. None of it can move
 * a wall.
 *
 * ═══ THREE STATES, READ FROM ACROSS THE ROOM ══════════════════════════════
 *
 *   SLOBODNO    — the ground itself, a hairline of gold. Empty is the quiet
 *                 case: on a good night most of the room is not empty, and a
 *                 map where "nothing here" is the loudest thing is a map that
 *                 shows you nothing.
 *   ZADRŽANO    — amber, and the only shape that moves: a dashed outline, so a
 *                 table somebody is mid-way through booking is legible in a
 *                 photograph as well as in colour.
 *   REZERVISANO — filled violet with a gold hairline. Spoken for, and it is
 *                 what the club is looking for.
 *
 * ═══ THE SERVER IS THE FLOOR ══════════════════════════════════════════════
 *
 * Every state came from `floorState` on the server, and this component holds no
 * opinion of its own: it does not mark a table taken when somebody clicks it,
 * and it does not free a hold when a countdown reaches zero. It re-asks. A poll
 * every eight seconds, paused when the tab is in the background — the club is
 * not running a trading floor, and a websocket for sixty tables is
 * infrastructure nobody wants to keep alive at 4am.
 *
 * The countdown is drawn from `expiresAt − serverNow`, both sent by the server,
 * so a phone whose clock is twenty minutes fast still shows the truth. */

const INK = {
  available: { fill: "rgba(244,240,230,0.03)", stroke: "rgba(200,164,93,0.30)" },
  held: { fill: "rgba(224,170,98,0.12)", stroke: "#e0aa62" },
  reserved: { fill: "rgba(42,18,63,0.85)", stroke: "rgba(200,164,93,0.75)" },
} as const;

/* THE ROOM, IN THE OFFICE'S OWN INK — the same values this map has always drawn
   its walls in, extended to the structures it used not to draw at all. Held
   well back: on a busy night the three table states are the only thing anybody
   is looking for, and a stage that competes with them is a stage in the way. */
const OFFICE_INK: PlanInk = {
  ground: "rgba(0,0,0,0.35)",
  floor: "rgba(255,255,255,0.015)",
  floorEdge: "rgba(244,240,230,0.09)",
  structure: "rgba(244,240,230,0.03)",
  structureEdge: "rgba(244,240,230,0.10)",
  tread: "rgba(244,240,230,0.09)",
  label: "rgba(244,240,230,0.22)",
  labelArea: "rgba(244,240,230,0.22)",
  zoneMark: "rgba(244,240,230,0.10)",
};

export function FloorMap({
  initial,
  eventSlug,
}: {
  initial: FloorState;
  eventSlug: string;
}) {
  const [floor, setFloor] = useState(initial);
  const [chosen, setChosen] = useState<string | null>(null);

  /* WHAT TIME THE COMPONENT THINKS IT IS, and it is the SERVER's time: the
     offset between this browser's clock and the server's is measured from
     every answer. Re-measured on each poll, ticked once a second so the
     numbers move, and authoritative over nothing. */
  const [clock, setClock] = useState(() => Date.parse(initial.serverNow));

  useEffect(() => {
    const skew = Date.parse(floor.serverNow) - Date.now();
    const set = () => setClock(Date.now() + skew);
    set();
    const id = setInterval(set, 1000);
    return () => clearInterval(id);
  }, [floor.serverNow]);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(
          `/api/admin/floor?event=${encodeURIComponent(eventSlug)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const body = (await response.json()) as { ok: boolean } & FloorState;
        if (alive && body.ok) setFloor(body);
      } catch {
        /* A poll that failed is a poll. The map keeps what it has and asks
           again in eight seconds; nothing here is authoritative anyway. */
      }
    }

    const id = setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [eventSlug]);

  const byId = useMemo(
    () => new Map(floor.seats.map((seat) => [seat.id, seat])),
    [floor.seats],
  );
  const selected = chosen ? byId.get(chosen) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--adm-line-soft)] px-[1.125rem] py-3">
        <Key tone="available" label="Slobodno" count={floor.counts.available} />
        <Key tone="held" label="Zadržano" count={floor.counts.held} />
        <Key tone="reserved" label="Rezervisano" count={floor.counts.reserved} />
      </div>

      {/* Map on the left, the chosen table on the right — on a phone the panel
          simply falls underneath, which is where a thumb already is. */}
      <div className="grid lg:grid-cols-[1fr_19rem]">
        <div className="w-full overflow-x-auto p-3">
          <svg
            viewBox={`0 0 ${PLAN.width} ${PLAN.height}`}
            className="h-auto w-full min-w-[34rem]"
            role="img"
            aria-label="Raspored stolova"
          >
            {/* THE BUILDING. Walls, floors, the stage, the bar runs, the
                stairs, the spiral, the zone numerals — the identical drawing
                the guest sees, in the office's ink. Signage the club wrote on
                the plan is set as written; the one label that would need
                translating is left off rather than pulling the site's
                dictionary onto a screen that has no other use for it. */}
            <PlanArchitecture
              ink={OFFICE_INK}
              labelText={(label) => label.text ?? ""}
            />

            {SEATS.map((seat) => {
              const state = byId.get(seat.id);
              if (!state) return null;
              return (
                <Shape
                  key={seat.id}
                  seat={seat}
                  state={state}
                  active={chosen === seat.id}
                  onPick={() => setChosen(chosen === seat.id ? null : seat.id)}
                />
              );
            })}
          </svg>
        </div>

        <Detail
          seat={selected}
          eventSlug={eventSlug}
          now={clock}
          onClose={() => setChosen(null)}
        />
      </div>
    </div>
  );
}

function Shape({
  seat,
  state,
  active,
  onPick,
}: {
  seat: FloorSeat;
  state: AdminSeat;
  active: boolean;
  onPick: () => void;
}) {
  /* THE PLAN'S OWN BOX AND THE PLAN'S OWN TURN. Both come from
     lib/floor-plan.ts, which is what makes a rotated separe here sit exactly
     where it sits on the guest's map — `x`/`y` is a CENTRE, and this file used
     to read it as a corner. */
  const { h, cx, cy } = seatBox(seat);
  const spin = seatTurn(seat);
  const ink = INK[state.state];

  const shape = {
    fill: ink.fill,
    stroke: active ? "#f4f0e6" : ink.stroke,
    width: active ? 4 : state.state === "available" ? 1.5 : 2.5,
    /* Held tables are dashed as well as amber — colour alone is not a state
       anybody should have to rely on. */
    dash: state.state === "held" ? "10 7" : undefined,
  };

  return (
    <g
      transform={spin}
      onClick={onPick}
      className="cursor-pointer"
      /* A table is a button. Keyboard reachable, because the office screen is
         as often a laptop as a phone. */
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick();
        }
      }}
      aria-label={`${seatNumber(seat)} — ${label(state.state)}`}
    >
      {/* The circle for a bar table, the rounded bar for a high one, the box or
          the corner L for a separe — one implementation, shared with the
          reservation map. The shape is the button here, so it keeps its pointer
          events rather than hiding behind an invisible target. */}
      <SeatOutline seat={seat} ink={shape} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={Math.max(11, Math.min(16, h / 2.4))}
        fill={
          state.state === "reserved"
            ? "rgba(232,216,168,0.92)"
            : "rgba(244,240,230,0.7)"
        }
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {seatNumber(seat)}
      </text>
    </g>
  );
}

/* What a click says. A column beside the map on a laptop and a block beneath
   it on a phone — never a popover, which on a phone covers the very thing it
   is describing while somebody has a telephone against one ear. */
function Detail({
  seat,
  eventSlug,
  now,
  onClose,
}: {
  seat: AdminSeat | undefined;
  eventSlug: string;
  now: number;
  onClose: () => void;
}) {
  if (!seat) {
    return (
      <aside className="border-t border-[var(--adm-line-soft)] px-[1.125rem] py-6 lg:border-l lg:border-t-0">
        <p className="text-[0.8125rem] leading-relaxed text-[var(--adm-ink-4)]">
          Dodirnite sto na planu za detalje.
        </p>
      </aside>
    );
  }

  return (
    <aside className="border-t border-[var(--adm-line-soft)] px-[1.125rem] py-5 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="adm-eyebrow">Sto</p>
          {/* THE NUMBER IS NOT SET IN THE DISPLAY FACE. Playfair draws
              old-style figures — its zero sits low and reads as an "o" — and a
              table number misread across a busy room is somebody sent to the
              wrong separe. Mono, tabular, unambiguous. */}
          <p className="mt-1 font-mono text-[1.5rem] leading-none tracking-tight text-[var(--adm-ink)]">
            {seat.number}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="adm-btn adm-btn--ghost adm-btn--sm"
        >
          Zatvori
        </button>
      </div>

      <div className="mt-3">
        <Badge kind="seat" value={seat.state} />
      </div>

      {seat.state === "available" ? (
        <div className="mt-5">
          <p className="text-[0.8125rem] leading-relaxed text-[var(--adm-ink-3)]">
            Slobodan sto za {seat.capacity.min}–{seat.capacity.max} osoba.
          </p>
          <Link
            href={`/admin/rezervacije?event=${encodeURIComponent(eventSlug)}&seat=${encodeURIComponent(seat.id)}#nova`}
            className="adm-btn adm-btn--primary mt-4 w-full"
          >
            Nova rezervacija
          </Link>
        </div>
      ) : null}

      {seat.state === "held" ? (
        <div className="mt-5">
          <p className="adm-label">Preostalo</p>
          <p className="adm-figure mt-2 text-[2rem] text-[var(--adm-warn)]">
            {left(seat.heldUntil, now)}
          </p>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--adm-ink-3)]">
            Gost upravo rezerviše ovaj sto na sajtu. Sto se ne preuzima dok traje
            — sačekajte istek ili ponudite drugi.
          </p>
        </div>
      ) : null}

      {seat.state === "reserved" && seat.reservation ? (
        <dl className="mt-5 space-y-3">
          <Line label="Ime" value={seat.reservation.name} />
          <Line
            label="Telefon"
            value={seat.reservation.phone}
            href={`tel:${seat.reservation.phone.replace(/\s+/g, "")}`}
          />
          <Line label="Broj osoba" value={String(seat.reservation.guests)} />
          <Line
            label="Izvor"
            value={seat.reservation.source === "phone" ? "Telefon" : "Sajt"}
          />
          {seat.reservation.note ? (
            <Line label="Napomena" value={seat.reservation.note} />
          ) : null}
          <div>
            <p className="adm-label">Status</p>
            <div className="mt-1.5">
              <Badge kind="reservation" value={seat.reservation.status} />
            </div>
          </div>
          <Link
            href={`/admin/rezervacije?event=${encodeURIComponent(eventSlug)}&q=${encodeURIComponent(seat.reservation.phone)}`}
            className="adm-btn adm-btn--sm mt-2 w-full"
          >
            Otvori rezervaciju
          </Link>
        </dl>
      ) : null}

      {seat.state === "reserved" && !seat.reservation ? (
        <p className="mt-5 text-[0.8125rem] leading-relaxed text-[var(--adm-ink-3)]">
          Sto je označen kao zauzet za ovo veče.
        </p>
      ) : null}
    </aside>
  );
}

function Line({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <dt className="adm-label">{label}</dt>
      <dd className="mt-1 text-[0.9375rem] leading-snug text-[var(--adm-ink)]">
        {href ? (
          <a href={href} className="text-[var(--adm-gold)]">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Key({
  tone,
  label,
  count,
}: {
  tone: AdminSeat["state"];
  label: string;
  count: number;
}) {
  return (
    <span className="flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.18em] text-[var(--adm-ink-3)]">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[2px]"
        style={{
          background: INK[tone].fill,
          border: `1px ${tone === "held" ? "dashed" : "solid"} ${INK[tone].stroke}`,
        }}
      />
      {label}
      <span className="adm-figure text-[var(--adm-ink)]">{count}</span>
    </span>
  );
}

const label = (state: AdminSeat["state"]) =>
  state === "available" ? "slobodno" : state === "held" ? "zadržano" : "rezervisano";

/* mm:ss left, from the server's clock. Never below zero — and when it reaches
   it, nothing happens here: the next poll is what frees the table. */
function left(expiresAt: string | undefined, now: number): string {
  if (!expiresAt) return "—";
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/* `roomPath` used to live here — the office's own tracing of the walls, which
   is exactly the second drawing this change removed. The walls are now drawn by
   the shared plan. */
