"use client";

import { useLang } from "@/components/providers/language";
import { INK } from "@/components/floor-plan/plan-ink";
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
  type PlanArrow,
  type PlanSpiral,
  type PlanZoneMark,
} from "@/lib/floor-plan";

/* The room itself — walls, floors, the stage, the stairs and the few solid
   things a guest walks around.
 *
 * The halls are polygons rather than rectangles because they are not
 * rectangles: the drawing's walls lean, and straightening them here would
 * undo the tracing. Nothing in this file can be clicked, and nothing in it
 * holds state — it is a plain read of lib/floor-plan.ts. */

/* Corner list as a path body: "x,y L x,y L …". The caller decides whether a
   Z follows, which is the whole difference between a hall and a wall. */
function points(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x},${y}`).join(" L ");
}

/* The fan the house drew for the spiral: an arc, its spokes, and the newel. */
function Spiral({ spiral }: { spiral: PlanSpiral }) {
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
        fill={INK.structure}
        stroke={INK.structureEdge}
        strokeWidth={2}
      />
      {Array.from({ length: spokes - 1 }, (_, i) => {
        const [sx, sy] = at(from + ((i + 1) * (to - from)) / spokes);
        return (
          <line key={i} x1={cx} y1={cy} x2={sx} y2={sy} stroke={INK.tread} strokeWidth={1.2} />
        );
      })}
      <circle cx={cx} cy={cy} r={5} fill={INK.ground} stroke={INK.structureEdge} strokeWidth={1.5} />
    </g>
  );
}

function StairRun({
  x, y, w, h, steps, rotation,
}: {
  x: number; y: number; w: number; h: number; steps?: number; rotation?: number;
}) {
  const treads = Math.max(2, steps ?? Math.max(3, Math.round(h / 20)));
  const turn = rotation ? `rotate(${rotation} ${x + w / 2} ${y + h / 2})` : undefined;
  return (
    <g transform={turn}>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={INK.structure} stroke={INK.structureEdge} strokeWidth={1.8} />
      {Array.from({ length: treads - 1 }, (_, i) => {
        const ty = y + ((i + 1) * h) / treads;
        return <line key={i} x1={x} y1={ty} x2={x + w} y2={ty} stroke={INK.tread} strokeWidth={1.1} />;
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
function ZoneMark({ mark }: { mark: PlanZoneMark }) {
  return (
    <text
      x={mark.x}
      y={mark.y}
      textAnchor="middle"
      dominantBaseline="central"
      transform={mark.rotation ? `rotate(${mark.rotation} ${mark.x} ${mark.y})` : undefined}
      opacity={mark.opacity ?? ZONE_MARK.opacity}
      fill={INK.zoneMark}
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
function Arrow({ arrow }: { arrow: PlanArrow }) {
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
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK.tread} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M ${lx} ${ly} L ${x2} ${y2} L ${rx} ${ry}`}
        fill="none"
        stroke={INK.tread}
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

export function FloorPlanArchitecture({
  architecture,
  showReference = SHOW_REFERENCE_OVERLAY,
}: {
  architecture?: Architecture;
  showReference?: boolean;
} = {}) {
  const { t } = useLang();
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
            fill={closed && !showReference ? INK.floor : "none"}
            stroke={INK.floorEdge}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}

      {/* doorways, cut straight through the walls they sit in */}
      {PASSAGES_.map((gap, i) => (
        <rect key={i} x={gap.x} y={gap.y} width={gap.w} height={gap.h} fill={INK.floor} />
      ))}

      {/* The zone numerals: painted on the floor, so they go down after it and
          before everything that stands on it. */}
      {ZONE_MARKS_.map((mark) => (
        <ZoneMark key={mark.id} mark={mark} />
      ))}

      {STRUCTURES_.map((s) => {
        if (s.kind === "stairs-run") return <StairRun key={s.id} {...s} />;

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
              <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={INK.structure} stroke={INK.structureEdge} strokeWidth={1.5} />
              {Array.from({ length: Math.round(s.w / 14) }, (_, i) => {
                const hx = s.x + i * 14;
                return <line key={i} x1={hx} y1={s.y} x2={hx + 10} y2={s.y + s.h} stroke={INK.tread} strokeWidth={1} />;
              })}
            </g>
          );
        }

        /* Two boxes the house struck through. Drawn, and drawn struck. */
        if (s.kind === "crossed") {
          return (
            <g key={s.id}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={INK.structureEdge} strokeWidth={1.5} />
              <line x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} stroke={INK.structureEdge} strokeWidth={1.3} />
              <line x1={s.x + s.w} y1={s.y} x2={s.x} y2={s.y + s.h} stroke={INK.structureEdge} strokeWidth={1.3} />
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
            fill={s.kind === "block" ? INK.structure : "none"}
            stroke={INK.structureEdge}
            strokeWidth={s.kind === "outline" ? 1.5 : 2}
            strokeDasharray={s.kind === "outline" ? "6 5" : undefined}
          />
        );
      })}

      {SPIRALS_.map((spiral) => (
        <Spiral key={spiral.id} spiral={spiral} />
      ))}

      {ARROWS_.map((arrow) => (
        <Arrow key={arrow.id} arrow={arrow} />
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
          fill={label.size === "area" ? INK.labelArea : INK.label}
          style={{
            fontSize: label.fontSize ?? (label.size === "area" ? 13 : 15),
            letterSpacing: `${label.tracking ?? 0.34}em`,
            textTransform: "uppercase",
          }}
        >
          {label.text ?? t(label.key)}
        </text>
      ))}
    </g>
  );
}
