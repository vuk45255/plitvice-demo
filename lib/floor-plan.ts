import type { MessageKey } from "@/lib/i18n";

/* The club, laid out by hand over the house's own drawing.
 *
 * THIS FILE IS THE MAP, AND IT IS THE EDITOR'S OUTPUT. Every array of data
 * below was produced by COPY FLOOR PLAN DATA at /floor-plan-editor and pasted
 * here whole. Not one coordinate in it was typed, adjusted, rounded, tidied or
 * recomputed on the way in, and none ever should be: the editor is where the
 * club's floor is drawn, and this file is the drawing as it stood when it was
 * last exported. The coordinate space is the reference photograph's own frame,
 * 1536 × 1152, origin top-left.
 *
 * WHICH MEANS IT IS NOT TIDY, and must not be made tidy. Walls lean, rows are
 * unevenly spaced, tables sit closer to one wall than the other, and stretches
 * of floor are empty — because that is the club. Straightening any of it here
 * would both make it a different room and put this file out of step with the
 * editor, which is the one thing that must never happen.
 *
 * CHANGING THE PLAN IS A ROUND TRIP, and only ever this one:
 *
 *     /floor-plan-editor  →  COPY FLOOR PLAN DATA  →  the arrays below
 *
 * The editor keeps its working copy in the browser (a draft in localStorage,
 * plus snapshots and downloadable backups — see editor-storage.ts); this file
 * is what the guest's map actually reads. Edit the plan there, export, paste
 * here. Never the other way round, and never by hand in either place.
 *
 * WHAT THE MARKS MEAN, per the house:
 *   circle                     → bar table      (4–6)
 *   rectangle, plain           → separe         (6–8)
 *   heavy black mark or box    → high table     (5–7)
 *   fan, ladder, hatching      → stairs and structure, never a table
 *
 * WHAT IS NOT HERE. Whether a table is free is not geometry — see
 * lib/floor-availability.ts. Neither is what a table seats: the default for
 * each kind is stated once in SEAT_KINDS below, and the tables the club has
 * settled individually are listed in lib/floor-capacity.ts. Neither figure is
 * ever written into a seat line here, because the exporter above would drop it
 * on the next round trip. */

export type SeatType = "bar" | "high" | "booth";

/* Zones 1–3 are the floor; 4 is the gallery. */
export type ZoneId = 1 | 2 | 3 | 4;

/* The reference photograph's own frame. */
export const PLAN = { width: 1536, height: 1152 } as const;

/* ──────────────────────────────────────────────────────────────────────────
   The drawing, as a working document.

   The plan is laid out by hand in the editor at /floor-plan-editor, which is
   a development-only page: it puts this photograph under the very same
   viewBox as the map and lets the club's own layout be dragged into place
   over it. Nothing about it reaches a guest.

   SHOW_REFERENCE_OVERLAY puts the paper under the *reservation* map as well,
   which is only ever wanted while checking a change. It is off.

   BEFORE SHIPPING: delete public/reference/ — the copy there is the only
   reason the photograph is web-readable, and it is the club's document
   rather than a page asset. The editor page itself already refuses to render
   outside development.
   ────────────────────────────────────────────────────────────────────────── */
export const SHOW_REFERENCE_OVERLAY = false;
export const REFERENCE_IMAGE = "/reference/1-sprat.jpg";
export const REFERENCE_OPACITY = 0.34;

export const SEAT_KINDS: Record<
  SeatType,
  {
    label: MessageKey;
    capacity: { min: number; max: number };
    /* The footprint used when a table does not state its own. Booths and high
       tables nearly always state their own — they are all different sizes on
       the paper — so in practice this is the bar table's circle. */
    size: { w: number; h: number };
  }
> = {
  bar: {
    label: "floor.type.bar",
    capacity: { min: 4, max: 6 },
    size: { w: 32, h: 32 },
  },
  high: {
    label: "floor.type.high",
    capacity: { min: 5, max: 7 },
    size: { w: 42, h: 18 },
  },
  booth: {
    label: "floor.type.booth",
    capacity: { min: 6, max: 8 },
    size: { w: 70, h: 38 },
  },
};

/* One selectable position. `x`/`y` are its centre in reference pixels. */
export type FloorSeat = {
  id: string;
  type: SeatType;
  zone: ZoneId;
  /* What the house calls this table — B01, V04, S07 — as printed on the map
     and read out in the panel. The `id` above is the key the booking system
     holds and never moves; this is the number a guest is told, which the club
     may renumber whenever it likes. Absent means the two are the same, which
     is how every table below stands today. */
  display?: string;
  /* False where the number above was typed by hand and must survive the
     editor's RENUMBER sweep. Absent means the sweep may number this table,
     which is true of nearly all of them — so the flag is written out only
     when it is false, and it exists here purely so that a plan can go back
     into the editor exactly as it came out. */
  autoNumber?: boolean;
  x: number;
  y: number;
  w?: number;
  h?: number;
  /* Degrees clockwise about the centre. Absent means square to the page — the
     drawing sets a few booths at an angle and this is how they are carried. */
  rotation?: number;
  /* An L-shaped separe, wrapped into a corner of the room. Which corner of its
     own box the elbow sits in; `depth` is how thick the two arms are, and w/h
     stay the bounding box as for any other booth.
     A guest is never told about this: a corner separe is a separe, priced,
     counted and named exactly like a straight one. */
  corner?: CornerSide;
  depth?: number;
};

export type CornerSide = "tl" | "tr" | "bl" | "br";

/* The outline of an L, drawn from its bounding box. The elbow names which
   corner is filled: "tl" is a top arm and a left arm, and so on round. */
export function cornerPath(
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  corner: CornerSide,
) {
  const d = Math.max(2, Math.min(depth, Math.min(w, h) - 1));
  const r = x + w;
  const b = y + h;
  const pts: [number, number][] =
    corner === "tl"
      ? [[x, y], [r, y], [r, y + d], [x + d, y + d], [x + d, b], [x, b]]
      : corner === "tr"
        ? [[x, y], [r, y], [r, b], [r - d, b], [r - d, y + d], [x, y + d]]
        : corner === "bl"
          ? [[x, y], [x + d, y], [x + d, b - d], [r, b - d], [r, b], [x, b]]
          : [[r, y], [r, b], [x, b], [x, b - d], [r - d, b - d], [r - d, y]];
  return `M ${pts.map((p) => p.join(" ")).join(" L ")} Z`;
}

/* The halls, as the closed shapes they actually are — out of square, because
   they are out of square on the paper. */
export type PlanRoom = {
  id: string;
  zone: ZoneId;
  points: [number, number][];
  /* Whether the last corner joins back to the first.
   *
   * A hall is a closed outline; a stretch of wall is not, and drawing the one
   * as the other throws a line straight across the room. Omitted means closed,
   * because every entry written by hand below is a hall and must keep drawing
   * exactly as it always has. The editor never omits it — it states what the
   * chain actually is, so an open run stays open in the map as well. */
  closed?: boolean;
};

/* Anything drawn but not sold: the block in the middle of the first hall, the
   stage, the stair runs, the service platform, the annex off the third hall. */
export type PlanStructure = {
  id: string;
  kind: "block" | "stage" | "outline" | "band" | "stairs-run" | "crossed";
  x: number;
  y: number;
  w: number;
  h: number;
  /* Only a flight of stairs uses these, and only when it disagrees with the
     default: how many treads, and which way it is turned. Absent means the
     tread count is worked out from the height and the flight is square to the
     page, which is how every existing structure is drawn. */
  steps?: number;
  rotation?: number;
};

/* The spiral in the first hall, drawn as the fan the house drew. */
export type PlanSpiral = {
  id: string;
  cx: number;
  cy: number;
  /* The horizontal radius. */
  r: number;
  /* The vertical one, where the flight is not a true half-circle. Absent
     means it is, which is what the house's own spiral is. */
  ry?: number;
  /* degrees, clockwise from east */
  from: number;
  to: number;
  /* How many treads the fan is cut into. Absent draws the nine the house's
     own spiral has. */
  steps?: number;
};

/* An arrow: which way people go, which way a flight climbs. Architectural —
   a line with a head, drawn at the same weight as everything else. */
export type PlanArrow = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  head?: number;
};

/* A doorway: a hole punched through a wall, drawn in the floor's own colour. */
export type PlanPassage = { x: number; y: number; w: number; h: number };

export type PlanLabel = {
  id: string;
  /* What the label says, in the reader's own language. */
  key: MessageKey;
  x: number;
  y: number;
  size: "zone" | "area";
  /* A label written on the plan itself rather than translated — ŠANK, WC, an
     entrance. When present it is set literally and `key` is ignored, because
     these are the room's own signage and do not change with the language.
     Everything below it is optional and falls back to the house treatment. */
  text?: string;
  fontSize?: number;
  rotation?: number;
  /* Letter-spacing in em. */
  tracking?: number;
  opacity?: number;
  align?: "start" | "middle" | "end";
};

/* The zone's number, set very large and very faint behind the room it names.
 *
 * NOT A LABEL. A label is signage — small, spaced, read on purpose. This is
 * the numeral a guest sees without looking at it: it sits behind the walls and
 * the tables, at an opacity where it registers as tone rather than as type, so
 * that a table found in the middle of the third hall is understood to be in
 * the third hall without anything on the map having said so out loud.
 *
 * Everything below is optional and defaults to ZONE_MARK, which is where the
 * restraint actually lives — raising the opacity past a tenth or so turns an
 * orientation aid into a watermark over the club's own drawing. */
export type PlanZoneMark = {
  id: string;
  zone: ZoneId;
  /* Its centre, in reference pixels. */
  x: number;
  y: number;
  fontSize?: number;
  rotation?: number;
  opacity?: number;
};

/* The house treatment: large, warm-white leaning to the room's own violet,
   and barely there. */
export const ZONE_MARK = {
  fontSize: 210,
  /* Deliberately at the edge of visible. A guest who is looking for the mark
     finds it; a guest who is looking for a table never sees it at all, which
     is the entire specification for a thing like this. Anything at a tenth or
     above starts competing with the tables standing on top of it.
     THIS NUMBER IS PART OF THE FILE FORMAT. The editor omits a mark's opacity
     when it matches this default, so changing it here silently restyles every
     mark exported while it held its old value. It is the editor's default and
     the map's fallback, and the two have to be the same number. */
  opacity: 0.08,
  rotation: 0,
} as const;

export const ROOMS: PlanRoom[] = [
  {
    id: "wall-1",
    zone: 1,
    closed: true,
    points: [
      [1108.3, 133.1],
      [1108.3, 628.8],
      [1178.8, 627.8],
      [1177.4, 428.6],
      [1351.4, 428.6],
      [1349.4, 131.1],
    ],
  },
  {
    id: "wall-2",
    zone: 1,
    closed: false,
    points: [
      [569.5, 621.5],
      [569.5, 621.5],
      [100, 621.4],
      [100, 131.4],
      [1039.2, 131.4],
      [1043.1, 589.4],
      [864, 589.4],
      [864, 1037.3],
      [569.3, 1037.3],
      [569.3, 995.6],
    ],
  },
  {
    id: "wall-2-b",
    zone: 1,
    closed: false,
    points: [
      [569.3, 902.5],
      [569.3, 902.5],
      [569.3, 741],
    ],
  },
  {
    id: "wall-6",
    zone: 1,
    closed: false,
    points: [
      [200, 514],
    ],
  },
  {
    id: "wall-7",
    zone: 1,
    closed: false,
    points: [
      [673, 131],
      [673, 228],
    ],
  },
  {
    id: "wall-7-b",
    zone: 1,
    closed: false,
    points: [
      [726.1, 450],
      [769, 450],
      [769, 228.3],
      [820.6, 228.3],
      [820.6, 132.4],
    ],
  },
  {
    id: "wall-8",
    zone: 1,
    closed: false,
    points: [
      [851, 264],
      [851, 475],
    ],
  },
  {
    id: "wall-9",
    zone: 1,
    closed: false,
    points: [
      [665.7, 266.3],
      [665.7, 477.3],
    ],
  },
  {
    id: "wall-12",
    zone: 1,
    closed: true,
    points: [
      [957.1, 458.6],
      [1003.4, 458.6],
      [1003.4, 436.3],
      [957.1, 436.3],
    ],
  },
  {
    id: "wall-13",
    zone: 1,
    closed: true,
    points: [
      [955.7, 350.7],
      [1003.5, 350.7],
      [1003.4, 326.8],
      [955.7, 326.8],
    ],
  },
  {
    id: "wall-11",
    zone: 1,
    closed: false,
    points: [
      [955.7, 350.7],
      [957.1, 436.3],
    ],
  },
  {
    id: "wall-14",
    zone: 1,
    closed: false,
    points: [
      [1003.5, 350.7],
      [1003.4, 436.3],
    ],
  },
  {
    id: "wall-10",
    zone: 1,
    closed: false,
    points: [
      [414, 622],
      [414, 829],
      [414, 1036],
      [569.3, 1037.3],
    ],
  },
  {
    id: "wall-3",
    zone: 1,
    closed: false,
    points: [
      [100, 454],
      [144.7, 454],
    ],
  },
  {
    id: "wall-3-b",
    zone: 1,
    closed: false,
    points: [
      [176.5, 454],
      [206, 454],
      [206, 454],
    ],
  },
  {
    id: "wall-3-b-b",
    zone: 1,
    closed: false,
    points: [
      [206, 511.3],
      [206, 625.3],
    ],
  },
  {
    id: "wall-16",
    zone: 1,
    closed: true,
    points: [
      [453.5, 764.9],
      [501.3, 764.9],
      [501.3, 741],
      [453.5, 741.1],
    ],
  },
  {
    id: "wall-18",
    zone: 1,
    closed: true,
    points: [
      [453.5, 886.2],
      [501.3, 886.2],
      [501.3, 862.3],
      [453.5, 862.3],
    ],
  },
  {
    id: "wall-4",
    zone: 1,
    closed: false,
    points: [
      [453.5, 764.9],
      [453.5, 862.3],
    ],
  },
  {
    id: "wall-5",
    zone: 1,
    closed: false,
    points: [
      [501.3, 764.9],
      [501.3, 862.3],
    ],
  },
  {
    id: "wall-15",
    zone: 1,
    closed: false,
    points: [
      [673, 227],
      [726, 227],
      [726, 449.9],
    ],
  },
];

export const STRUCTURES: PlanStructure[] = [
  { id: "stairs-1", kind: "stairs-run", x: 488.3, y: 612.5, w: 60, h: 90, steps: 7, rotation: 270 },
  { id: "stairs-2", kind: "stairs-run", x: 1160.6, y: 214, w: 29, h: 90, steps: 8 },
];

export const ARROWS: PlanArrow[] = [
  { id: "arrow-1", x1: 1175.1, y1: 220, x2: 1175.1, y2: 300, width: 2, head: 12 },
  { id: "arrow-2", x1: 537.7, y1: 673.7, x2: 500.7, y2: 673.7, width: 2, head: 12 },
];

export const SPIRALS: PlanSpiral[] = [
  { id: "fan-1", cx: 603.3, cy: 338.9, r: 55, ry: 60, from: 180, to: 360, steps: 9 },
];

export const PASSAGES: PlanPassage[] = [];

/* The room's own signage — BINA, ŠANK, WC, ULAZ — set where the house set it.
   A label with `text` is written as it stands, in any language; one without
   is translated from its key. These are architecture, not tables: nothing here
   can be clicked, and the map draws them quieter than anything a guest can
   choose. */
export const LABELS: PlanLabel[] = [
  { id: "z4", key: "floor.zone4", x: 1222.1, y: 102, size: "zone" },
  { id: "label-1", key: "floor.stage", x: 750.6, y: 192.2, size: "zone", text: "BINA", fontSize: 20, tracking: 0.34 },
  /* Left blank in the editor, and blank is what it draws. It keeps its place
     on the plan; it does not fall back to its translation key. */
  { id: "label-2", key: "floor.stage", x: 931, y: 355, size: "zone", text: "", fontSize: 20, tracking: 0.34 },
  { id: "label-3", key: "floor.stage", x: 979.6, y: 395.5, size: "zone", text: "ŠANK", fontSize: 20, rotation: 90, tracking: 0.34 },
  { id: "label-4", key: "floor.stage", x: 523, y: 655.8, size: "zone", text: "WC", fontSize: 20, tracking: 0.34 },
  { id: "label-5", key: "floor.stage", x: 477.4, y: 809.1, size: "zone", text: "ŠANK", fontSize: 20, rotation: 270, tracking: 0.34 },
  { id: "label-6", key: "floor.stage", x: 152.4, y: 532.9, size: "zone", text: "ULAZ", fontSize: 25, rotation: 90, tracking: 0.34 },
];

/* Every selectable position in the club, as the editor last exported them.
 *
 * TWO NAMES, ON PURPOSE. `id` is the key — it is what a booking is held
 * against and it never moves. `display` is what the guest is shown on the map
 * and told in the panel, and the club may renumber that whenever it likes
 * (RENUMBER TABLES in the editor walks the building zone by zone and hands out
 * B, V and S numbers in reading order). Where a table's number is simply its
 * id, `display` is absent and seatNumber falls back to it. */
export const SEATS: FloorSeat[] = [
  { id: "B01", type: "bar", zone: 4, display: "B91", x: 1091.2, y: 190.9, w: 23.9, h: 21.5 },
  { id: "B02", type: "bar", zone: 4, display: "B95", x: 1091.2, y: 234.6, w: 23.9, h: 21.5 },
  { id: "B03", type: "bar", zone: 4, display: "B99", x: 1091.2, y: 281.6, w: 23.9, h: 21.5 },
  { id: "B04", type: "bar", zone: 4, display: "B103", x: 1091.2, y: 330.9, w: 23.9, h: 21.5 },
  { id: "B05", type: "bar", zone: 4, display: "B107", x: 1091.2, y: 379.8, w: 23.9, h: 21.5 },
  { id: "B06", type: "bar", zone: 4, display: "B109", x: 1091.2, y: 431.9, w: 23.9, h: 21.5 },
  { id: "B07", type: "bar", zone: 1, display: "B28", x: 1091.2, y: 486.9, w: 23.9, h: 21.5 },
  { id: "B08", type: "bar", zone: 4, display: "B112", x: 1091.2, y: 540.9, w: 23.9, h: 21.5 },
  { id: "B09", type: "bar", zone: 4, display: "B114", x: 1091.2, y: 597.4, w: 23.9, h: 21.5 },
  { id: "B10", type: "bar", zone: 4, display: "B90", x: 1135.6, y: 147.4, w: 22.1, h: 20.1 },
  { id: "S01", type: "booth", zone: 4, display: "S50", x: 1192.1, y: 148.4, w: 60.1, h: 28.4 },
  { id: "S02", type: "booth", zone: 4, display: "S51", x: 1252.9, y: 148.4, w: 61.4, h: 28.4 },
  { id: "S03", type: "booth", zone: 4, display: "S52", x: 1316.2, y: 169.8, w: 70.4, h: 62.7, rotation: 90, corner: "tl", depth: 20 },
  { id: "S06", type: "booth", zone: 4, display: "S54", x: 1329.9, y: 292.2, w: 54.4, h: 34.5, rotation: 90 },
  { id: "S05", type: "booth", zone: 4, display: "S53", x: 1329.9, y: 234.7, w: 54.4, h: 34.5, rotation: 90 },
  { id: "S07", type: "booth", zone: 4, display: "S55", x: 1329.9, y: 347.9, w: 54.4, h: 34.5, rotation: 90 },
  { id: "S08", type: "booth", zone: 4, display: "S58", x: 1314.5, y: 400.9, w: 46.2, h: 63.4, rotation: 90, corner: "tr", depth: 20 },
  { id: "S09", type: "booth", zone: 4, display: "S57", x: 1250.3, y: 410.8, w: 61.4, h: 25.1 },
  { id: "S10", type: "booth", zone: 4, display: "S56", x: 1189.6, y: 410.8, w: 55.1, h: 25.1 },
  { id: "B11", type: "bar", zone: 4, display: "B94", x: 1270, y: 197.4, w: 22.1, h: 20.1 },
  { id: "B12", type: "bar", zone: 4, display: "B98", x: 1270, y: 239.4, w: 22.1, h: 20.1 },
  { id: "B13", type: "bar", zone: 4, display: "B102", x: 1270, y: 282.1, w: 22.1, h: 20.1 },
  { id: "B14", type: "bar", zone: 4, display: "B106", x: 1270, y: 327.4, w: 22.1, h: 20.1 },
  { id: "B15", type: "bar", zone: 4, display: "B105", x: 1223.1, y: 357.4, w: 22.1, h: 20.1 },
  { id: "B16", type: "bar", zone: 4, display: "B104", x: 1178.5, y: 357.4, w: 22.1, h: 20.1 },
  { id: "B17", type: "bar", zone: 4, display: "B108", x: 1137.7, y: 400.9, w: 22.1, h: 20.1 },
  { id: "B18", type: "bar", zone: 4, display: "B93", x: 1206.1, y: 211.2, w: 22.1, h: 20.1 },
  { id: "B19", type: "bar", zone: 4, display: "B92", x: 1143.1, y: 211.2, w: 22.1, h: 20.1 },
  { id: "B20", type: "bar", zone: 4, display: "B96", x: 1143.1, y: 259, w: 22.1, h: 20.1 },
  { id: "B21", type: "bar", zone: 4, display: "B97", x: 1208.6, y: 259, w: 22.1, h: 20.1 },
  { id: "B22", type: "bar", zone: 4, display: "B100", x: 1143.1, y: 310.4, w: 22.1, h: 20.1 },
  { id: "B23", type: "bar", zone: 4, display: "B101", x: 1208.6, y: 310.5, w: 22.1, h: 20.1 },
  { id: "B24", type: "bar", zone: 4, display: "B110", x: 1156.5, y: 465.9, w: 22.1, h: 20.1 },
  { id: "B25", type: "bar", zone: 4, display: "B111", x: 1156.5, y: 507.5, w: 22.1, h: 20.1 },
  { id: "B26", type: "bar", zone: 4, display: "B113", x: 1156.5, y: 549.7, w: 22.1, h: 20.1 },
  { id: "B27", type: "bar", zone: 4, display: "B115", x: 1156.5, y: 587.1, w: 22.1, h: 20.1 },
  { id: "B28", type: "bar", zone: 1, display: "B26", x: 188.8, y: 435.4, w: 24.8, h: 20.1 },
  { id: "B30", type: "bar", zone: 1, display: "B25", x: 188.8, y: 394.1, w: 24.8, h: 20.1 },
  { id: "B29", type: "bar", zone: 1, display: "B24", x: 188.8, y: 352.8, w: 24.8, h: 20.1 },
  { id: "B31", type: "bar", zone: 1, display: "B22", x: 188.8, y: 311.5, w: 24.8, h: 20.1 },
  { id: "S04", type: "booth", zone: 1, display: "S11", x: 240.3, y: 319.8, w: 67.8, h: 83.2, corner: "tl", depth: 20 },
  { id: "S11", type: "booth", zone: 1, display: "S17", x: 240.3, y: 404.5, w: 67.8, h: 83.2, corner: "bl", depth: 20 },
  { id: "S12", type: "booth", zone: 1, x: 303, y: 294, w: 57.6, h: 31.5 },
  { id: "S13", type: "booth", zone: 1, display: "S20", x: 303, y: 429.8, w: 57.6, h: 31.5 },
  { id: "S14", type: "booth", zone: 1, display: "S21", x: 396.4, y: 431.1, w: 57.6, h: 31.5 },
  { id: "S15", type: "booth", zone: 1, display: "S18", x: 459.1, y: 405.3, w: 67.8, h: 83.2, corner: "br", depth: 20 },
  { id: "S16", type: "booth", zone: 1, display: "S14", x: 459.1, y: 320.5, w: 67.8, h: 83.2, corner: "tr", depth: 20 },
  { id: "S17", type: "booth", zone: 1, display: "S13", x: 396.4, y: 294, w: 57.6, h: 31.5 },
  { id: "S18", type: "booth", zone: 1, display: "S22", x: 241, y: 597, w: 66.4, h: 38 },
  { id: "S19", type: "booth", zone: 1, display: "S23", x: 309.2, y: 597.4 },
  { id: "S20", type: "booth", zone: 1, display: "S24", x: 379.2, y: 597 },
  { id: "S21", type: "booth", zone: 1, display: "S25", x: 449.2, y: 597.4 },
  { id: "S22", type: "booth", zone: 1, display: "S26", x: 519.2, y: 597 },
  { id: "B32", type: "bar", zone: 1, display: "B29", x: 228.4, y: 537, w: 24.8, h: 20.1 },
  { id: "B33", type: "bar", zone: 1, display: "B30", x: 274.2, y: 537, w: 24.8, h: 20.1 },
  { id: "B34", type: "bar", zone: 1, display: "B31", x: 320, y: 537, w: 24.8, h: 20.1 },
  { id: "B35", type: "bar", zone: 1, display: "B32", x: 365.8, y: 537, w: 24.8, h: 20.1 },
  { id: "B36", type: "bar", zone: 1, display: "B33", x: 411.7, y: 537, w: 24.8, h: 20.1 },
  { id: "B37", type: "bar", zone: 1, display: "B34", x: 457.5, y: 537, w: 24.8, h: 20.1 },
  { id: "B38", type: "bar", zone: 1, display: "B35", x: 503.3, y: 537, w: 24.8, h: 20.1 },
  { id: "B39", type: "bar", zone: 1, display: "B02", x: 194, y: 215.9, w: 24.8, h: 20.1 },
  { id: "B41", type: "bar", zone: 1, display: "B03", x: 240.3, y: 215.9, w: 24.8, h: 20.1 },
  { id: "B42", type: "bar", zone: 1, display: "B04", x: 288.8, y: 215.9, w: 24.8, h: 20.1 },
  { id: "B43", type: "bar", zone: 1, display: "B05", x: 338.3, y: 215.7, w: 24.8, h: 20.1 },
  { id: "B44", type: "bar", zone: 1, display: "B06", x: 386.9, y: 214.6, w: 24.8, h: 20.1 },
  { id: "B45", type: "bar", zone: 1, display: "B07", x: 436.4, y: 214.6, w: 24.8, h: 20.1 },
  { id: "B46", type: "bar", zone: 1, display: "B08", x: 482.2, y: 215.7, w: 24.8, h: 20.1 },
  { id: "B47", type: "bar", zone: 1, display: "B09", x: 531.6, y: 214.6, w: 24.8, h: 20.1 },
  { id: "B48", type: "bar", zone: 1, display: "B10", x: 578.5, y: 214.6, w: 24.8, h: 20.1 },
  { id: "B49", type: "bar", zone: 1, display: "B11", x: 628, y: 214.6, w: 24.8, h: 20.1 },
  { id: "B50", type: "bar", zone: 1, display: "B12", x: 218.8, y: 247.3, w: 24.8, h: 20.1 },
  { id: "B51", type: "bar", zone: 1, display: "B13", x: 264, y: 247.3, w: 24.8, h: 20.1 },
  { id: "B52", type: "bar", zone: 1, display: "B14", x: 315.4, y: 247.3, w: 24.8, h: 20.1 },
  { id: "B53", type: "bar", zone: 1, display: "B15", x: 362.2, y: 245.4, w: 24.8, h: 20.1 },
  { id: "B54", type: "bar", zone: 1, display: "B16", x: 408.7, y: 247.3, w: 24.8, h: 20.1 },
  { id: "B55", type: "bar", zone: 1, display: "B17", x: 457.5, y: 247.3, w: 24.8, h: 20.1 },
  { id: "B56", type: "bar", zone: 1, display: "B18", x: 503.3, y: 248.9, w: 24.8, h: 20.1 },
  { id: "B57", type: "bar", zone: 1, display: "B19", x: 552.4, y: 249.2, w: 24.8, h: 20.1 },
  { id: "B58", type: "bar", zone: 1, display: "B20", x: 603.3, y: 249.2, w: 24.8, h: 20.1 },
  { id: "B59", type: "bar", zone: 1, display: "B21", x: 645.5, y: 249.2, w: 24.8, h: 20.1 },
  { id: "S23", type: "booth", zone: 1, display: "S01", x: 139.9, y: 170.9, w: 71.7, h: 70, corner: "tl", depth: 20 },
  { id: "S24", type: "booth", zone: 1, display: "S09", x: 139.2, y: 238.2, w: 70.4, h: 62.3, corner: "bl", depth: 20 },
  { id: "B60", type: "bar", zone: 1, display: "B01", x: 163.3, y: 187.2, w: 24.8, h: 20.1 },
  { id: "S25", type: "booth", zone: 1, display: "S02", x: 210.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S26", type: "booth", zone: 1, display: "S03", x: 280.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S27", type: "booth", zone: 1, display: "S04", x: 350.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S28", type: "booth", zone: 1, display: "S05", x: 420.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S29", type: "booth", zone: 1, display: "S06", x: 490.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S30", type: "booth", zone: 1, display: "S07", x: 560.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S31", type: "booth", zone: 1, display: "S08", x: 630.7, y: 151.4, w: 70, h: 31.1 },
  { id: "S32", type: "booth", zone: 1, display: "S10", x: 120.3, y: 300, w: 46.1, h: 38, rotation: 270 },
  { id: "S33", type: "booth", zone: 1, display: "S15", x: 120.3, y: 340.6, w: 42.4, h: 38, rotation: 270 },
  { id: "S34", type: "booth", zone: 1, display: "S16", x: 120.3, y: 385.1, w: 44.8, h: 38, rotation: 270 },
  { id: "S36", type: "booth", zone: 1, display: "S19", x: 120.3, y: 430.5, w: 43.5, h: 38, rotation: 270 },
  { id: "B61", type: "bar", zone: 1, display: "B27", x: 554.2, y: 467.2, w: 24.8, h: 20.1 },
  { id: "B62", type: "bar", zone: 1, display: "B36", x: 645.5, y: 565.9, w: 24.8, h: 20.1 },
  { id: "B63", type: "bar", zone: 1, display: "B37", x: 645.5, y: 616, w: 24.8, h: 20.1 },
  { id: "B64", type: "bar", zone: 3, display: "B68", x: 653.3, y: 669.9, w: 24.8, h: 20.1 },
  { id: "B65", type: "bar", zone: 3, display: "B71", x: 653.3, y: 714.9, w: 24.8, h: 20.1 },
  { id: "B66", type: "bar", zone: 3, display: "B74", x: 653.3, y: 759.8, w: 24.8, h: 20.1 },
  { id: "B67", type: "bar", zone: 3, display: "B77", x: 653.3, y: 804.8, w: 24.8, h: 20.1 },
  { id: "B68", type: "bar", zone: 3, display: "B80", x: 653.3, y: 849.7, w: 24.8, h: 20.1 },
  { id: "B69", type: "bar", zone: 3, display: "B82", x: 652.8, y: 894.7, w: 24.8, h: 20.1 },
  { id: "B70", type: "bar", zone: 3, display: "B86", x: 633.2, y: 962.7, w: 24.8, h: 20.1 },
  { id: "B71", type: "bar", zone: 3, display: "B85", x: 590.9, y: 962.7, w: 24.8, h: 20.1 },
  { id: "B72", type: "bar", zone: 3, display: "B87", x: 701.8, y: 962.7, w: 24.8, h: 20.1 },
  { id: "B73", type: "bar", zone: 3, display: "B88", x: 745.1, y: 962.7, w: 24.8, h: 20.1 },
  { id: "B74", type: "bar", zone: 3, display: "B83", x: 746.6, y: 914.9, w: 24.8, h: 20.1 },
  { id: "B75", type: "bar", zone: 3, display: "B81", x: 745.1, y: 867, w: 24.8, h: 20.1 },
  { id: "B76", type: "bar", zone: 3, display: "B78", x: 745.1, y: 819.2, w: 24.8, h: 20.1 },
  { id: "B77", type: "bar", zone: 3, display: "B75", x: 745.1, y: 771.3, w: 24.8, h: 20.1 },
  { id: "B78", type: "bar", zone: 3, display: "B72", x: 745.1, y: 723.5, w: 24.8, h: 20.1 },
  { id: "B79", type: "bar", zone: 3, display: "B69", x: 788.6, y: 669.9, w: 24.8, h: 20.1 },
  { id: "B80", type: "bar", zone: 3, display: "B73", x: 788.6, y: 723.5, w: 24.8, h: 20.1 },
  { id: "B81", type: "bar", zone: 3, display: "B76", x: 788.6, y: 777.1, w: 24.8, h: 20.1 },
  { id: "B82", type: "bar", zone: 3, display: "B79", x: 788.6, y: 830.7, w: 24.8, h: 20.1 },
  { id: "B83", type: "bar", zone: 3, display: "B84", x: 788.6, y: 884.3, w: 24.8, h: 20.1 },
  { id: "B84", type: "bar", zone: 3, display: "B89", x: 788.6, y: 937.9, w: 24.8, h: 20.1 },
  { id: "S37", type: "booth", zone: 3, display: "S46", x: 598, y: 1014.5, w: 50.9, h: 34.7 },
  { id: "S38", type: "booth", zone: 3, display: "S47", x: 648.9, y: 1014.5, w: 50.9, h: 34.7 },
  { id: "S39", type: "booth", zone: 3, display: "S48", x: 699.8, y: 1014.5, w: 50.9, h: 34.7 },
  { id: "S40", type: "booth", zone: 1, display: "S27", x: 750.6, y: 1014.5, w: 50.9, h: 34.7 },
  { id: "S41", type: "booth", zone: 3, display: "S49", x: 798.3, y: 1014.5, w: 44.4, h: 34.7 },
  { id: "S42", type: "booth", zone: 1, display: "S28", x: 841.6, y: 1014.5, w: 39.7, h: 34.7 },
  { id: "B85", type: "bar", zone: 3, display: "B70", x: 598, y: 703.4, w: 24.8, h: 20.1 },
  { id: "S43", type: "booth", zone: 3, display: "S45", x: 848.2, y: 905.8, w: 57.7, h: 24.8, rotation: 90 },
  { id: "S44", type: "booth", zone: 3, x: 848.2, y: 847.4, w: 57.7, h: 24.8, rotation: 90 },
  { id: "S45", type: "booth", zone: 3, display: "S43", x: 848.2, y: 793.1, w: 49.7, h: 24.8, rotation: 90 },
  { id: "S46", type: "booth", zone: 3, display: "S42", x: 848.2, y: 714.9, w: 49.7, h: 24.8, rotation: 90 },
  { id: "S47", type: "booth", zone: 3, display: "S41", x: 848.2, y: 664.8, w: 49.7, h: 24.8, rotation: 90 },
  { id: "S48", type: "booth", zone: 2, display: "S30", x: 1004.1, y: 172.3, w: 60.2, h: 69.5, corner: "tr", depth: 20 },
  { id: "S49", type: "booth", zone: 2, display: "S29", x: 950.3, y: 154.8, w: 47.3, h: 34.5 },
  { id: "S50", type: "booth", zone: 2, display: "S31", x: 1017.4, y: 232.5, w: 47.3, h: 34.5, rotation: 90 },
  { id: "B86", type: "bar", zone: 2, display: "B44", x: 865.3, y: 234.3, w: 22.9, h: 22.6 },
  { id: "B87", type: "bar", zone: 2, display: "B49", x: 902.4, y: 276.5, w: 22.9, h: 22.6 },
  { id: "B88", type: "bar", zone: 2, display: "B48", x: 865.6, y: 276.5, w: 22.9, h: 22.6 },
  { id: "B89", type: "bar", zone: 2, display: "B45", x: 902.4, y: 234.1, w: 22.9, h: 22.6 },
  { id: "B90", type: "bar", zone: 2, display: "B46", x: 955.8, y: 245.6, w: 22.9, h: 22.6 },
  { id: "B91", type: "bar", zone: 2, display: "B52", x: 904.4, y: 355.8, w: 22.9, h: 22.6 },
  { id: "B92", type: "bar", zone: 2, display: "B55", x: 904.4, y: 404.5, w: 22.9, h: 22.6 },
  { id: "B93", type: "bar", zone: 2, display: "B59", x: 904.4, y: 455.7, w: 22.9, h: 22.6 },
  { id: "B94", type: "bar", zone: 2, display: "B58", x: 872.8, y: 455.7, w: 22.9, h: 22.6 },
  { id: "B95", type: "bar", zone: 2, display: "B54", x: 873, y: 405.5, w: 22.9, h: 22.6 },
  { id: "B96", type: "bar", zone: 2, display: "B51", x: 873.2, y: 355.2, w: 22.9, h: 22.6 },
  { id: "B97", type: "bar", zone: 1, display: "B23", x: 541.8, y: 292, w: 26, h: 21.9 },
  { id: "B98", type: "bar", zone: 2, display: "B65", x: 725.2, y: 574.6, w: 22, h: 19.6 },
  { id: "B99", type: "bar", zone: 2, display: "B62", x: 725.2, y: 529.9, w: 22, h: 19.6 },
  { id: "B100", type: "bar", zone: 2, display: "B63", x: 765.1, y: 529.9, w: 22, h: 19.6 },
  { id: "B101", type: "bar", zone: 2, display: "B64", x: 804.9, y: 529.9, w: 22, h: 19.6 },
  { id: "B102", type: "bar", zone: 2, display: "B67", x: 804.9, y: 574.6, w: 22, h: 19.6 },
  { id: "B103", type: "bar", zone: 2, display: "B66", x: 765.1, y: 574.6, w: 22, h: 19.6 },
  { id: "V01", type: "high", zone: 2, x: 780, y: 622.4, w: 42, h: 23.1 },
  { id: "V02", type: "high", zone: 2, x: 739.2, y: 621.8, w: 39.6, h: 23.1 },
  { id: "V03", type: "high", zone: 2, x: 684.8, y: 287.4, w: 42, h: 28.1, rotation: 90 },
  { id: "V04", type: "high", zone: 2, x: 684.8, y: 328.7, w: 42, h: 28.1, rotation: 90 },
  { id: "V05", type: "high", zone: 2, x: 684.8, y: 370, w: 42, h: 28.1, rotation: 90 },
  { id: "V06", type: "high", zone: 2, x: 684.8, y: 410.8, w: 42, h: 28.1, rotation: 90 },
  { id: "V07", type: "high", zone: 2, x: 684.8, y: 450.9, w: 42, h: 28.1, rotation: 90 },
  { id: "S35", type: "booth", zone: 2, x: 883.8, y: 568.3, w: 37.1, h: 33.4 },
  { id: "S51", type: "booth", zone: 2, display: "S36", x: 920.9, y: 568.3, w: 37.1, h: 33.4 },
  { id: "S52", type: "booth", zone: 2, display: "S37", x: 958, y: 568.3, w: 37.1, h: 33.4 },
  { id: "S53", type: "booth", zone: 2, display: "S38", x: 1007.9, y: 554.6, w: 62.7, h: 61.4, corner: "br", depth: 20 },
  { id: "S54", type: "booth", zone: 2, display: "S33", x: 1022.5, y: 506.3, w: 37.1, h: 33.4, rotation: 90 },
  { id: "V08", type: "high", zone: 2, x: 833.1, y: 287.4, w: 42, h: 28.1, rotation: 90 },
  { id: "V09", type: "high", zone: 2, x: 833.1, y: 328.7, w: 42, h: 28.1, rotation: 90 },
  { id: "V10", type: "high", zone: 2, x: 833.1, y: 371.5, w: 42, h: 28.1, rotation: 90 },
  { id: "V11", type: "high", zone: 2, x: 833.1, y: 416.4, w: 42, h: 28.1, rotation: 90 },
  { id: "B104", type: "bar", zone: 2, display: "B42", x: 865.3, y: 165.8, w: 22.9, h: 22.6 },
  { id: "B105", type: "bar", zone: 2, display: "B61", x: 956.1, y: 508.9, w: 25.7, h: 26.3 },
  { id: "V12", type: "high", zone: 2, x: 833.1, y: 456.2, w: 42, h: 28.1, rotation: 90 },
  { id: "B107", type: "bar", zone: 2, display: "B57", x: 783.8, y: 442.1, w: 22.3, h: 20.7 },
  { id: "B108", type: "bar", zone: 2, display: "B56", x: 754, y: 467.5, w: 22.3, h: 20.7 },
  { id: "B109", type: "bar", zone: 2, display: "B53", x: 783.8, y: 394.4, w: 22.3, h: 20.7 },
  { id: "B110", type: "bar", zone: 2, display: "B50", x: 783.8, y: 346.7, w: 22.3, h: 20.7 },
  { id: "B111", type: "bar", zone: 2, display: "B47", x: 783.8, y: 298.9, w: 22.3, h: 20.7 },
  { id: "B112", type: "bar", zone: 2, display: "B43", x: 798.3, y: 249.8, w: 22.3, h: 20.7 },
  { id: "S55", type: "booth", zone: 2, display: "S39", x: 695.7, y: 602, w: 47.3, h: 64.1, corner: "bl", depth: 20 },
  { id: "V13", type: "high", zone: 2, x: 684.8, y: 537, w: 59.6, h: 29.2, rotation: 90 },
  { id: "V14", type: "high", zone: 3, x: 587.5, y: 763.6, w: 39.4, h: 28.4, rotation: 270 },
  { id: "V18", type: "high", zone: 3, x: 684.8, y: 767, rotation: 90 },
  { id: "V19", type: "high", zone: 3, x: 684.8, y: 809.1, rotation: 90 },
  { id: "V20", type: "high", zone: 3, x: 684.8, y: 851.2, rotation: 90 },
  { id: "V21", type: "high", zone: 3, x: 684.8, y: 893.2, rotation: 90 },
  { id: "V22", type: "high", zone: 3, x: 587.5, y: 803.9, w: 39.4, h: 28.4, rotation: 270 },
  { id: "V23", type: "high", zone: 3, x: 587.5, y: 840.8, w: 39.4, h: 28.4, rotation: 270 },
  { id: "V24", type: "high", zone: 3, x: 587.5, y: 880.5, w: 39.4, h: 28.4, rotation: 270 },
  { id: "B106", type: "bar", zone: 2, display: "B60", x: 804.8, y: 482.3, w: 22.3, h: 24 },
  { id: "S56", type: "booth", zone: 2, display: "S32", x: 841.4, y: 528, w: 38, h: 26.9, rotation: 90 },
  { id: "S57", type: "booth", zone: 2, display: "S34", x: 841.4, y: 564.5, w: 38, h: 26.9, rotation: 90 },
  { id: "S58", type: "booth", zone: 2, display: "S40", x: 841.4, y: 600.9, w: 38, h: 26.9, rotation: 90 },
  { id: "B113", type: "bar", zone: 2, display: "B38", x: 686.5, y: 160.1, w: 18.5, h: 17.4 },
  { id: "B114", type: "bar", zone: 2, display: "B39", x: 719.4, y: 160.1, w: 18.5, h: 17.4 },
  { id: "B115", type: "bar", zone: 2, display: "B40", x: 770.7, y: 160.1, w: 18.5, h: 17.4 },
  { id: "B116", type: "bar", zone: 2, display: "B41", x: 804.9, y: 160.1, w: 18.5, h: 17.4 },
];

/* One numeral per zone, standing on the emptiest floor each hall has, placed
   in the editor like everything else. They are orientation and nothing more:
   drawn on the floor, behind every wall and every table, at an opacity where
   they register as tone rather than as writing. */
export const ZONE_MARKS: PlanZoneMark[] = [
  { id: "zm1", zone: 1, x: 346.6, y: 328.7, fontSize: 193 },
  { id: "zm2", zone: 2, x: 901, y: 442.9 },
  { id: "zm3", zone: 3, x: 708.3, y: 690.2 },
  { id: "zm4", zone: 4, x: 1272.5, y: 221.2 },
];

export const ZONE_LABELS: Record<ZoneId, MessageKey> = {
  1: "floor.zone1",
  2: "floor.zone2",
  3: "floor.zone3",
  4: "floor.zone4",
};

/* A number's first letter, per kind: B for a bar table, V for a high one
   (visoki), S for a separe. Each letter runs its own sequence, and the
   sequence runs through the building — zone 1 lowest, the gallery highest —
   rather than restarting in each hall. */
export const SEAT_PREFIX: Record<SeatType, string> = {
  bar: "B",
  high: "V",
  booth: "S",
};

/* What this table is called on the map: its own number where it has been
   given one, its id otherwise. Everything a guest reads goes through here, so
   a renumbering never has to touch the key the booking holds. */
export function seatNumber(seat: { id: string; display?: string }) {
  return seat.display?.trim() || seat.id;
}

/* The footprint this table is drawn at — its own where it has one, its kind's
   otherwise. */
export function seatSize(seat: FloorSeat) {
  const kind = SEAT_KINDS[seat.type];
  return { w: seat.w ?? kind.size.w, h: seat.h ?? kind.size.h };
}
