"use client";

import {
  ARROWS,
  LABELS,
  PASSAGES,
  ROOMS,
  SHOW_REFERENCE_OVERLAY,
  SPIRALS,
  STRUCTURES,
  ZONE_MARK,
  ZONE_MARKS,
  cornerPath,
  seatBox,
  type PlanArrow,
  type PlanLabel,
  type PlanSpiral,
  type PlanZoneMark,
  type SeatGeometry,
} from "@/lib/floor-plan";

/* THE CLUB'S FLOOR, DRAWN ONCE.
 *
 * ═══ WHY THIS FILE EXISTS ═════════════════════════════════════════════════
 *
 * There are two maps of this building — the one a guest picks a table on, and
 * the one the office watches the night on — and for a while there were two
 * DRAWINGS of it as well. Both read the same arrays out of lib/floor-plan.ts,
 * so nobody thought of them as separate; but reading the same numbers is not
 * the same as drawing the same room, and the office's own reading of those
 * numbers was wrong in three ways at once. It put every table's top-left where
 * the plan states its centre, it spun the angled separes about that same wrong
 * point, it drew the round bar tables as squares, and it left out the stage,
 * the stairs, the spiral, the bar runs and every wall that is not a hall
 * outline.
 *
 * Sharing DATA was never going to prevent that. So the drawing is shared too:
 * this file is the only place in the project that turns a seat into a shape or
 * the plan into a room, and both maps call it.
 *
 * ═══ WHAT IS SHARED AND WHAT IS NOT ═══════════════════════════════════════
 *
 * Shared: every coordinate, footprint, rotation, radius, corner elbow, tread,
 * arc and wall — the physical building.
 *
 * Not shared: colour. Both maps hand in their own ink, because they are two
 * different jobs. The guest's map is a lit room with one gold table in it; the
 * office's is a schematic with three states read from across a room. Neither
 * palette belongs to the other, and neither can move a wall.
 *
 * NOTHING HERE HOLDS STATE, decides anything, or knows what a reservation is. */

/* ── ink ─────────────────────────────────────────────────────────────────── */

/* What the room is drawn in. Every field is a colour and nothing else; there
   is no measurement in this type, on purpose. */
export type PlanInk = {
  /* The room the plan is drawn in. Used for one thing — the spiral's newel,
     which is a hole punched through the fan rather than a shape laid on it. */
  ground: string;
  floor: string;
  floorEdge: string;
  structure: string;
  structureEdge: string;
  tread: string;
  label: string;
  labelArea: string;
  zoneMark: string;
};

/* What one table is drawn in. `dash` marks a state without relying on colour;
   `pointerEvents` is the one behavioural switch, and it exists because the two
   maps take a click differently — the guest's map lays an invisible target over
   the shape so a thumb can find a small circle, and the office's map lets the
   shape itself be the button. */
export type SeatInk = {
  fill: string;
  stroke: string;
  width: number;
  dash?: string;
  pointerEvents?: "none";
  style?: React.CSSProperties;
};

/* ── the room ────────────────────────────────────────────────────────────── */

/* Corner list as a path body: "x,y L x,y L …". The caller decides whether a
   Z follows, which is the whole difference between a hall and a wall. */
function points(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x},${y}`).join(" L ");
}

/* The fan the house drew for the spiral: an arc, its spokes, and the newel. */
function Spiral({ spiral, ink }: { spiral: PlanSpiral; ink: PlanInk }) {
  const { cx, cy, r, from, to } = spiral;
  /* Two radii, so a flight that is wider than it is deep draws as the fan it
     is rather than being squeezed back into a circle. A spiral that states
     only `r` is a circle, which is what the house's own is. */
  const ry = spiral.ry ?? r;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (deg: number) => [cx + Math.cos(rad(deg)) * r, cy + Math.sin(rad(deg)) * ry];

  const [x1, y1] = at(from);
  const [x2, y2] = at(to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const spokes = Math.max(2, spiral.steps ?? 9);

  return (
    <g>
      <path
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${ry} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={ink.structure}
        stroke={ink.structureEdge}
        strokeWidth={2}
      />
      {Array.from({ length: spokes - 1 }, (_, i) => {
        const [sx, sy] = at(from + ((i + 1) * (to - from)) / spokes);
        return (
          <line key={i} x1={cx} y1={cy} x2={sx} y2={sy} stroke={ink.tread} strokeWidth={1.2} />
        );
      })}
      <circle cx={cx} cy={cy} r={5} fill={ink.ground} stroke={ink.structureEdge} strokeWidth={1.5} />
    </g>
  );
}

function StairRun({
  x, y, w, h, steps, rotation, ink,
}: {
  x: number; y: number; w: number; h: number; steps?: number; rotation?: number; ink: PlanInk;
}) {
  const treads = Math.max(2, steps ?? Math.max(3, Math.round(h / 20)));
  const turn = rotation ? `rotate(${rotation} ${x + w / 2} ${y + h / 2})` : undefined;
  return (
    <g transform={turn}>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={ink.structure} stroke={ink.structureEdge} strokeWidth={1.8} />
      {Array.from({ length: treads - 1 }, (_, i) => {
        const ty = y + ((i + 1) * h) / treads;
        return <line key={i} x1={x} y1={ty} x2={x + w} y2={ty} stroke={ink.tread} strokeWidth={1.1} />;
      })}
    </g>
  );
}

/* The zone's numeral, laid on the floor behind everything else.
 *
 * Set in the page's own serif at a size no piece of signage would ever take,
 * and held at an opacity where it reads as a shadow on the floor rather than
 * as writing on the map. It is drawn before the walls, so a table never has to
 * compete with it, and it takes no pointer events at all — this is furniture
 * for the eye and nothing a guest can touch. */
function ZoneMark({ mark, ink }: { mark: PlanZoneMark; ink: PlanInk }) {
  return (
    <text
      x={mark.x}
      y={mark.y}
      textAnchor="middle"
      dominantBaseline="central"
      transform={mark.rotation ? `rotate(${mark.rotation} ${mark.x} ${mark.y})` : undefined}
      opacity={mark.opacity ?? ZONE_MARK.opacity}
      fill={ink.zoneMark}
      pointerEvents="none"
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: mark.fontSize ?? ZONE_MARK.fontSize,
        letterSpacing: "0.02em",
      }}
    >
      {mark.zone}
    </text>
  );
}

/* A line with a head. Nothing decorative — the same hairline weight the rest
   of the plan is drawn at. */
function Arrow({ arrow, ink }: { arrow: PlanArrow; ink: PlanInk }) {
  const { x1, y1, x2, y2 } = arrow;
  const width = arrow.width ?? 2;
  const head = arrow.head ?? 12;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const wing = (deg: number) => [
    x2 - Math.cos(a + deg) * head,
    y2 - Math.sin(a + deg) * head,
  ];
  const [lx, ly] = wing(0.42);
  const [rx, ry] = wing(-0.42);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink.tread} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M ${lx} ${ly} L ${x2} ${y2} L ${rx} ${ry}`}
        fill="none"
        stroke={ink.tread}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/* The plan normally draws the club as lib/floor-plan.ts describes it. The
   editor hands in its own working copy instead, so PREVIEW there shows the
   layout being edited rather than the one on disk. */
export type Architecture = {
  arrows: typeof ARROWS;
  zoneMarks: typeof ZONE_MARKS;
  rooms: typeof ROOMS;
  structures: typeof STRUCTURES;
  spirals: typeof SPIRALS;
  passages: typeof PASSAGES;
  labels: typeof LABELS;
};

/* The room itself — walls, floors, the stage, the stairs and the few solid
 * things a guest walks around.
 *
 * The halls are polygons rather than rectangles because they are not
 * rectangles: the drawing's walls lean, and straightening them here would undo
 * the tracing. Nothing in this function can be clicked and nothing in it holds
 * state — it is a plain read of lib/floor-plan.ts in somebody else's colours.
 *
 * `labelText` is how a caller says what a sign reads. The room's own signage —
 * BINA, ŠANK, WC, ULAZ — carries its text in the plan and is set as written;
 * the one label that does not is translated, and translating is the guest
 * side's business, so it is asked for rather than assumed. */
export function PlanArchitecture({
  ink,
  labelText,
  architecture,
  showReference = SHOW_REFERENCE_OVERLAY,
}: {
  ink: PlanInk;
  labelText: (label: PlanLabel) => string;
  architecture?: Architecture;
  showReference?: boolean;
}) {
  const ROOMS_ = architecture?.rooms ?? ROOMS;
  const STRUCTURES_ = architecture?.structures ?? STRUCTURES;
  const SPIRALS_ = architecture?.spirals ?? SPIRALS;
  const PASSAGES_ = architecture?.passages ?? PASSAGES;
  const LABELS_ = architecture?.labels ?? LABELS;
  const ARROWS_ = architecture?.arrows ?? ARROWS;
  const ZONE_MARKS_ = architecture?.zoneMarks ?? ZONE_MARKS;

  return (
    <g aria-hidden="true">
      {ROOMS_.map((room) => {
        /* A polygon would be wrong here: it joins the last corner back to the
           first whatever the chain actually is, which draws a line clean
           across the room for every open run of wall. Only a chain that says
           it is closed gets the Z, and only a closed chain gets a floor —
           filling an open run would close it to the eye just as surely. */
        const closed = room.closed !== false;
        return (
          <path
            key={room.id}
            d={`M ${points(room.points)}${closed ? " Z" : ""}`}
            /* While the drawing is showing through, the floor is left unfilled
               so the paper underneath stays readable. */
            fill={closed && !showReference ? ink.floor : "none"}
            stroke={ink.floorEdge}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}

      {/* doorways, cut straight through the walls they sit in */}
      {PASSAGES_.map((gap, i) => (
        <rect key={i} x={gap.x} y={gap.y} width={gap.w} height={gap.h} fill={ink.floor} />
      ))}

      {/* The zone numerals: painted on the floor, so they go down after it and
          before everything that stands on it. */}
      {ZONE_MARKS_.map((mark) => (
        <ZoneMark key={mark.id} mark={mark} ink={ink} />
      ))}

      {STRUCTURES_.map((s) => {
        if (s.kind === "stairs-run") return <StairRun key={s.id} {...s} ink={ink} />;

        if (s.kind === "stage") {
          return (
            <rect
              key={s.id}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={10}
              fill="rgba(200,164,93,0.08)"
              stroke="rgba(200,164,93,0.36)"
              strokeWidth={2}
            />
          );
        }

        /* The band across the foot of the second hall is hatched on the paper;
           the annex and the platform are drawn but empty. */
        if (s.kind === "band") {
          return (
            <g key={s.id}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={ink.structure} stroke={ink.structureEdge} strokeWidth={1.5} />
              {Array.from({ length: Math.round(s.w / 14) }, (_, i) => {
                const hx = s.x + i * 14;
                return <line key={i} x1={hx} y1={s.y} x2={hx + 10} y2={s.y + s.h} stroke={ink.tread} strokeWidth={1} />;
              })}
            </g>
          );
        }

        /* Two boxes the house struck through. Drawn, and drawn struck. */
        if (s.kind === "crossed") {
          return (
            <g key={s.id}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={ink.structureEdge} strokeWidth={1.5} />
              <line x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} stroke={ink.structureEdge} strokeWidth={1.3} />
              <line x1={s.x + s.w} y1={s.y} x2={s.x} y2={s.y + s.h} stroke={ink.structureEdge} strokeWidth={1.3} />
            </g>
          );
        }

        return (
          <rect
            key={s.id}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={2}
            fill={s.kind === "block" ? ink.structure : "none"}
            stroke={ink.structureEdge}
            strokeWidth={s.kind === "outline" ? 1.5 : 2}
            strokeDasharray={s.kind === "outline" ? "6 5" : undefined}
          />
        );
      })}

      {SPIRALS_.map((spiral) => (
        <Spiral key={spiral.id} spiral={spiral} ink={ink} />
      ))}

      {ARROWS_.map((arrow) => (
        <Arrow key={arrow.id} arrow={arrow} ink={ink} />
      ))}

      {/* orientation only — small, spaced, and well behind the tables. A label
          with its own text is the room's own signage and is set as written;
          everything else is translated and takes the house treatment. */}
      {LABELS_.map((label) => (
        <text
          key={label.id}
          x={label.x}
          y={label.y}
          textAnchor={label.align ?? "middle"}
          dominantBaseline="central"
          transform={label.rotation ? `rotate(${label.rotation} ${label.x} ${label.y})` : undefined}
          opacity={label.opacity ?? 1}
          fill={label.size === "area" ? ink.labelArea : ink.label}
          style={{
            fontSize: label.fontSize ?? (label.size === "area" ? 13 : 15),
            letterSpacing: `${label.tracking ?? 0.34}em`,
            textTransform: "uppercase",
          }}
        >
          {labelText(label)}
        </text>
      ))}
    </g>
  );
}

/* ── one table ───────────────────────────────────────────────────────────── */

/* The outline of a table, and nothing else — no state, no target, no number.
 *
 * THE THREE KINDS ARE THREE SHAPES and always have been on the house's own
 * plan: a bar table is the circle it is drawn as, a high table is the heavy
 * bar with rounded ends, a separe is a box — or, where it wraps a corner, the
 * L that lib/floor-plan.ts draws from the same bounding box.
 *
 * The rotation is NOT applied here. It belongs on the group that carries both
 * the shape and whatever the caller puts over it, so that a target, a glow and
 * a number all turn with the table rather than sliding off it. `seatTurn` is
 * what every caller uses for it. */
export function SeatOutline({ seat, ink }: { seat: SeatGeometry; ink: SeatInk }) {
  const { x, y, w, h, cx, cy } = seatBox(seat);

  const paint = {
    fill: ink.fill,
    stroke: ink.stroke,
    strokeWidth: ink.width,
    strokeDasharray: ink.dash,
    style: ink.style,
    pointerEvents: ink.pointerEvents,
  };

  if (seat.type === "bar") {
    return <circle cx={cx} cy={cy} r={w / 2} {...paint} />;
  }

  if (seat.type === "high") {
    /* a long stroke with fully rounded ends */
    return <rect x={x} y={y} width={w} height={h} rx={h / 2} {...paint} />;
  }

  /* Wrapped into a corner — the same separe, drawn as the L it is. */
  if (seat.corner) {
    return (
      <path
        d={cornerPath(x, y, w, h, seat.depth ?? 18, seat.corner)}
        strokeLinejoin="round"
        {...paint}
      />
    );
  }

  /* A separe is drawn as the box it is, with the seat-back it stands against
     marked as a heavier line down one side — which is what tells a reader, at a
     glance and without a legend, that this is an upholstered corner and not a
     table on the floor. Which side the back is on is read from the box's own
     proportion: a booth taller than it is wide is set against a side wall. */
  const upright = h > w;
  const back = upright
    ? { x1: x, y1: y + 3, x2: x, y2: y + h - 3 }
    : { x1: x + 3, y1: y, x2: x + w - 3, y2: y };

  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} {...paint} />
      <line
        {...back}
        stroke={ink.stroke}
        strokeWidth={ink.width * 2.2}
        strokeLinecap="round"
        opacity={0.8}
        style={ink.style}
        pointerEvents={ink.pointerEvents}
      />
    </>
  );
}
