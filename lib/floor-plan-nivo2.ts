import type {
  FloorSeat,
  PlanArrow,
  PlanLabel,
  PlanPassage,
  PlanRoom,
  PlanSpiral,
  PlanStructure,
  PlanZoneMark,
} from "@/lib/floor-plan";

/* NIVO 2 — THE SECOND FLOOR, AND IT IS THE EDITOR'S OUTPUT.
 *
 * ═══ THIS FILE IS THE SAME KIND OF FILE AS lib/floor-plan.ts ══════════════
 *
 * Same seven arrays, same types, same coordinate space (PLAN, 1536 × 1152,
 * origin top-left), read by the same drawing code. The only difference is
 * which level of the club it describes. lib/floors.ts is where the two are put
 * side by side, and it is the only file in the project that knows there are
 * two of them.
 *
 * ═══ CHANGING THE PLAN IS A ROUND TRIP, AND ONLY EVER THIS ONE ════════════
 *
 *     /floor-plan-editor  →  NIVO 2  →  COPY FLOOR PLAN DATA  →  here
 *
 * Exactly as the first floor's round trip works, and for the same reason. The
 * editor holds a working copy per level in the browser (its own draft key, its
 * own snapshots — see editor-storage.ts); this file is the drawing as it stood
 * when it was last exported, and it is what the guest's map and the office's
 * map actually read. Edit the plan there, export, paste here. Never the other
 * way round, and never by hand in either place.
 *
 * ═══ IT IS EMPTY, AND THAT IS NOT A MISTAKE ═══════════════════════════════
 *
 * The upstairs has not been drawn yet. Empty arrays are a real state and the
 * whole system already reads them correctly: `seatsOnFloor(2)` is empty, so
 * `availableFloors()` reports one level, so neither map offers a NIVO 2 switch
 * and no table can be held or booked on a level that has no tables. Nothing
 * needs a flag; the drawing IS the switch.
 *
 * The house's own paper plan of this floor is at docs/floorplan-nivo2.jpg. It
 * is a reference for whoever is drawing, and nothing reads it.
 *
 * WHAT THE MARKS MEAN is stated once, over lib/floor-plan.ts, and is the same
 * here: a circle is a bar table, a plain rectangle a separe, a heavy bar a
 * high table, and a fan or a ladder is structure rather than anything sold.
 *
 * WHAT IS NOT HERE. Whether a table is free is not geometry — see
 * lib/floor-availability.ts. Neither is what a table seats: per-table figures
 * for this level go in SEAT_CAPACITY_L2 at the foot of this file, out of reach
 * of the exporter, exactly as lib/floor-capacity.ts keeps the first floor's. */

export const ROOMS_L2: PlanRoom[] = [
  {
    id: "wall-1",
    zone: 1,
    closed: true,
    points: [
      [87.3, 1036.6],
      [1502.7, 1036.6],
      [1502.7, 261.2],
      [94.6, 261.2],
    ],
  },
  {
    id: "wall-2",
    zone: 1,
    closed: false,
    points: [
      [1406, 905],
      [1406, 880],
      [1497, 880],
    ],
  },
  {
    id: "wall-3",
    zone: 1,
    closed: false,
    points: [
      [1405, 904],
      [1248, 904],
    ],
  },
  {
    id: "wall-4",
    zone: 1,
    closed: false,
    points: [
      [1144, 1037],
      [1144, 908],
    ],
  },
  {
    id: "wall-5",
    zone: 1,
    closed: false,
    points: [
      [1329, 411.6],
      [1329, 794.4],
    ],
  },
  {
    id: "wall-6",
    zone: 1,
    closed: false,
    points: [
      [1329, 788],
    ],
  },
  {
    id: "wall-7",
    zone: 1,
    closed: false,
    points: [
      [1329, 563],
    ],
  },
  {
    id: "wall-8",
    zone: 1,
    closed: true,
    points: [
      [1420.8, 438.4],
      [1421, 754.2],
      [1482, 754.2],
      [1482, 438.4],
    ],
  },
  {
    id: "wall-9",
    zone: 1,
    closed: false,
    points: [
      [1420.8, 479.2],
      [1482, 479],
    ],
  },
  {
    id: "wall-10",
    zone: 1,
    closed: false,
    points: [
      [1421, 705],
      [1482, 705],
    ],
  },
  {
    id: "wall-11",
    zone: 1,
    closed: false,
    points: [
      [1442, 552],
    ],
  },
  {
    id: "wall-12",
    zone: 1,
    closed: false,
    points: [
      [1213, 414.8],
      [1213, 791.2],
    ],
  },
  {
    id: "wall-13",
    zone: 1,
    closed: false,
    points: [
      [1001.3, 485.5],
      [1001.3, 897.5],
      [1001.3, 761.5],
    ],
  },
  {
    id: "wall-14",
    zone: 1,
    closed: false,
    points: [
      [740.3, 571.1],
      [740.3, 543.2],
      [822.8, 543.2],
      [823.3, 571],
      [800.3, 571],
      [801, 807.9],
      [849, 807.9],
      [849, 901.9],
      [717, 901.9],
      [717, 809.1],
      [762, 809.1],
      [762, 571.1],
    ],
  },
  {
    id: "wall-15",
    zone: 1,
    closed: false,
    points: [
      [486, 179],
    ],
  },
  {
    id: "wall-16",
    zone: 1,
    closed: false,
    points: [
      [740.3, 571.1],
      [762, 571.1],
    ],
  },
  {
    id: "wall-17",
    zone: 1,
    closed: false,
    points: [
      [1002, 898],
      [860, 898],
    ],
  },
  {
    id: "wall-18",
    zone: 1,
    closed: false,
    points: [
      [548.5, 486],
      [548.5, 898],
      [548.5, 762],
    ],
  },
  {
    id: "wall-19",
    zone: 1,
    closed: false,
    points: [
      [690.5, 897.5],
      [548.5, 897.5],
    ],
  },
  {
    id: "wall-20",
    zone: 1,
    closed: true,
    points: [
      [731.9, 1017],
      [732, 955],
      [844, 955],
      [844, 1015.9],
    ],
  },
  {
    id: "wall-21",
    zone: 1,
    closed: false,
    points: [
      [844, 969],
      [866, 969],
      [866, 1016],
      [844, 1015.9],
    ],
  },
  {
    id: "wall-22",
    zone: 1,
    closed: false,
    points: [
      [339, 394],
      [339, 580],
    ],
  },
  {
    id: "wall-23",
    zone: 1,
    closed: true,
    points: [
      [109.4, 394],
      [109.2, 697.1],
      [170.2, 697.1],
      [170.2, 394],
    ],
  },
  {
    id: "wall-24",
    zone: 1,
    closed: false,
    points: [
      [109, 437],
      [170, 437],
    ],
  },
  {
    id: "wall-25",
    zone: 1,
    closed: false,
    points: [
      [109, 653],
      [170, 653],
    ],
  },
  {
    id: "wall-26",
    zone: 1,
    closed: false,
    points: [
      [225, 1037],
      [225, 708],
      [90, 708],
    ],
  },
  {
    id: "wall-27",
    zone: 1,
    closed: false,
    points: [
      [337.8, 624.4],
      [337.8, 865.7],
    ],
  },
];

export const STRUCTURES_L2: PlanStructure[] = [
  { id: "stairs-1", kind: "stairs-run", x: 1286.1, y: 873.6, w: 82, h: 163, steps: 8, rotation: 90 },
];

export const SPIRALS_L2: PlanSpiral[] = [
  { id: "fan-1", cx: 1412.5, cy: 954.3, r: 65.5, ry: 67, from: 269, to: 449, steps: 9 },
];

export const ARROWS_L2: PlanArrow[] = [
  { id: "arrow-1", x1: 1194.6, y1: 943.4, x2: 1175.2, y2: 865.7, width: 2, head: 21 },
];

export const PASSAGES_L2: PlanPassage[] = [

];

export const LABELS_L2: PlanLabel[] = [
  { id: "label-1", key: "floor.stage", x: 1198.2, y: 971.7, size: "zone", text: "ULAZ", fontSize: 25, tracking: 0.34 },
  { id: "label-3", key: "floor.stage", x: 1451.4, y: 584.9, size: "zone", text: "SANK 1", fontSize: 20, rotation: 90, tracking: 0.34 },
  { id: "label-4", key: "floor.stage", x: 789, y: 858, size: "zone", text: "BINA", fontSize: 29, tracking: 0.34 },
  { id: "label-5", key: "floor.stage", x: 792, y: 986, size: "zone", text: "DJ", fontSize: 37, tracking: 0.34 },
  { id: "label-6", key: "floor.stage", x: 139, y: 536.6, size: "zone", text: "SANK 2", fontSize: 29, rotation: 270, tracking: 0.34 },
];

export const ZONE_MARKS_L2: PlanZoneMark[] = [
  { id: "zone-1", zone: 1, x: 1135.7, y: 616.6, fontSize: 158.7 },
  { id: "zone-2", zone: 2, x: 783, y: 648.9, fontSize: 80.2 },
];

/* Every selectable position on the second floor.
 *
 * IDS ARE NAMESPACED AND PERMANENT. The editor hands every table drawn on this
 * level an id beginning `L2-` — `L2-B01`, `L2-S04` — and that prefix is what
 * keeps this floor's B01 from ever being mistaken for the first floor's, in
 * the database, in a hold, in a confirmation mail or in the office. It is also
 * why adding a second floor needed no database migration at all: `seat_id` was
 * already the canonical key and is still unique across the building.
 *
 * `display` is the number a guest is told, and the club may renumber it
 * whenever it likes without touching a single booking — the same two-names
 * arrangement the first floor has always had. */
export const SEATS_L2: FloorSeat[] = [
  { id: "L2-S01", type: "booth", zone: 1, x: 1429.9, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S02", type: "booth", zone: 1, x: 1318.6, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S03", type: "booth", zone: 1, x: 1207.4, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S04", type: "booth", zone: 1, x: 1096.1, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S05", type: "booth", zone: 2, x: 984.8, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S06", type: "booth", zone: 2, x: 873.5, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S07", type: "booth", zone: 2, x: 762.2, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S08", type: "booth", zone: 2, x: 650.9, y: 289.3, w: 111.3, h: 38 },
  { id: "L2-S09", type: "booth", zone: 3, x: 548.5, y: 289.3, w: 93.6, h: 38 },
  { id: "L2-S10", type: "booth", zone: 3, x: 454.6, y: 289.3, w: 94.1, h: 38 },
  { id: "L2-S11", type: "booth", zone: 3, x: 361.6, y: 289.3, w: 91.8, h: 38 },
  { id: "L2-S12", type: "booth", zone: 3, x: 267.9, y: 289.3, w: 95.8, h: 38 },
  { id: "L2-S13", type: "booth", zone: 3, x: 175.2, y: 289.3, w: 89.5, h: 38 },
  { id: "L2-S14", type: "booth", zone: 1, x: 1292.1, y: 887.3, w: 70, h: 29.5 },
  { id: "L2-S15", type: "booth", zone: 1, x: 1362.1, y: 887.3, w: 70, h: 29.5 },
  { id: "L2-B01", type: "bar", zone: 1, x: 1358.3, y: 776.7 },
  { id: "L2-B02", type: "bar", zone: 1, x: 1358.3, y: 707.5 },
  { id: "L2-B03", type: "bar", zone: 1, x: 1358.3, y: 638.3 },
  { id: "L2-B04", type: "bar", zone: 1, x: 1358, y: 559.9 },
  { id: "L2-B05", type: "bar", zone: 1, x: 1358, y: 484.1 },
  { id: "L2-B06", type: "bar", zone: 1, x: 1358, y: 420.2 },
  { id: "L2-B07", type: "bar", zone: 1, x: 1473, y: 796 },
  { id: "L2-B08", type: "bar", zone: 1, x: 1064.3, y: 367.3, w: 26.6, h: 26.6 },
  { id: "L2-B09", type: "bar", zone: 1, x: 1121.6, y: 367.3, w: 26.6, h: 26.6 },
  { id: "L2-B10", type: "bar", zone: 1, x: 1184.9, y: 367.3, w: 26.6, h: 26.6 },
  { id: "L2-B11", type: "bar", zone: 1, x: 1248, y: 367.3, w: 26.6, h: 26.6 },
  { id: "L2-B12", type: "bar", zone: 1, x: 1305.5, y: 367.3, w: 26.6, h: 26.6 },
  { id: "L2-B13", type: "bar", zone: 1, x: 1037.7, y: 479, w: 26.6, h: 26.6 },
  { id: "L2-B14", type: "bar", zone: 1, x: 1094, y: 505.6, w: 26.6, h: 26.6 },
  { id: "L2-B15", type: "bar", zone: 1, x: 1096.1, y: 571.6, w: 26.6, h: 26.6 },
  { id: "L2-B16", type: "bar", zone: 1, x: 1095, y: 635.6, w: 26.6, h: 26.6 },
  { id: "L2-B17", type: "bar", zone: 1, x: 1095, y: 718.3, w: 26.6, h: 26.6 },
  { id: "L2-B18", type: "bar", zone: 1, x: 1096.1, y: 790, w: 26.6, h: 26.6 },
  { id: "L2-S16", type: "booth", zone: 1, x: 1186.7, y: 516.1, w: 60.5, h: 38, rotation: 90 },
  { id: "L2-S17", type: "booth", zone: 1, x: 1186.7, y: 574.9, w: 60.5, h: 38, rotation: 90 },
  { id: "L2-S18", type: "booth", zone: 1, x: 1186.7, y: 699.3, w: 60.5, h: 38, rotation: 90 },
  { id: "L2-S19", type: "booth", zone: 1, x: 1186.7, y: 635.6, w: 60.5, h: 38, rotation: 90 },
  { id: "L2-S20", type: "booth", zone: 1, x: 1182.5, y: 459.5, w: 53.8, h: 44.9, rotation: 90, corner: "tl", depth: 20 },
  { id: "L2-S21", type: "booth", zone: 1, x: 1241.2, y: 590.6, w: 109.1, h: 38, rotation: 90 },
  { id: "L2-S22", type: "booth", zone: 1, x: 1178.6, y: 754.1, w: 53.8, h: 44.9, rotation: 180, corner: "tl", depth: 20 },
  { id: "L2-S23", type: "booth", zone: 1, x: 1437.9, y: 382.9, w: 95.3, h: 33.6 },
  { id: "L2-S24", type: "booth", zone: 1, x: 1307.3, y: 455.2, rotation: 90 },
  { id: "L2-S26", type: "booth", zone: 1, x: 1307, y: 594.9, rotation: 90 },
  { id: "L2-S27", type: "booth", zone: 1, x: 1307, y: 726.5, rotation: 90 },
  { id: "L2-S28", type: "booth", zone: 1, x: 1029.3, y: 552, rotation: 270 },
  { id: "L2-S29", type: "booth", zone: 1, x: 1029.3, y: 622.3, rotation: 270 },
  { id: "L2-S30", type: "booth", zone: 1, x: 1029.3, y: 691.5, rotation: 270 },
  { id: "L2-S31", type: "booth", zone: 1, x: 1029.3, y: 760.7, rotation: 270 },
  { id: "L2-S32", type: "booth", zone: 2, x: 830, y: 367.3 },
  { id: "L2-S33", type: "booth", zone: 2, x: 900, y: 367.3 },
  { id: "L2-S34", type: "booth", zone: 2, x: 970, y: 367.3 },
  { id: "L2-S35", type: "booth", zone: 2, x: 721, y: 367.3 },
  { id: "L2-S36", type: "booth", zone: 2, x: 650.9, y: 367.3 },
  { id: "L2-S37", type: "booth", zone: 2, x: 580.9, y: 367.3 },
  { id: "L2-B19", type: "bar", zone: 2, x: 599.9, y: 479 },
  { id: "L2-B20", type: "bar", zone: 2, x: 660.5, y: 479 },
  { id: "L2-B21", type: "bar", zone: 2, x: 711.7, y: 479 },
  { id: "L2-B22", type: "bar", zone: 2, x: 779, y: 479.2 },
  { id: "L2-B23", type: "bar", zone: 2, x: 830, y: 479.2 },
  { id: "L2-B24", type: "bar", zone: 2, x: 884, y: 479 },
  { id: "L2-B25", type: "bar", zone: 2, x: 954, y: 479 },
  { id: "L2-B26", type: "bar", zone: 2, x: 751.3, y: 521.3, w: 27.5, h: 27.5 },
  { id: "L2-B28", type: "bar", zone: 2, x: 830, y: 600.6 },
  { id: "L2-B29", type: "bar", zone: 2, x: 830, y: 672.5 },
  { id: "L2-B30", type: "bar", zone: 2, x: 830, y: 754.2 },
  { id: "L2-B31", type: "bar", zone: 2, x: 740, y: 760.5 },
  { id: "L2-B32", type: "bar", zone: 2, x: 740, y: 680.3 },
  { id: "L2-B34", type: "bar", zone: 2, x: 740, y: 597.9 },
  { id: "L2-B35", type: "bar", zone: 2, x: 881.6, y: 552, w: 27.2, h: 27.2 },
  { id: "L2-B38", type: "bar", zone: 2, x: 881.6, y: 630.2, w: 27.2, h: 27.2 },
  { id: "L2-B39", type: "bar", zone: 2, x: 881.6, y: 707.5, w: 27.2, h: 27.2 },
  { id: "L2-S38", type: "booth", zone: 2, x: 978.5, y: 552.6, rotation: 90 },
  { id: "L2-S39", type: "booth", zone: 2, x: 978.5, y: 622, rotation: 90 },
  { id: "L2-S40", type: "booth", zone: 2, x: 978.5, y: 691.5, rotation: 90 },
  { id: "L2-S41", type: "booth", zone: 2, x: 978.5, y: 760.5, rotation: 90 },
  { id: "L2-S42", type: "booth", zone: 2, x: 953, y: 838, w: 90, h: 84, rotation: 180, corner: "tl", depth: 20 },
  { id: "L2-S43", type: "booth", zone: 2, x: 571.8, y: 760.5, rotation: 270 },
  { id: "L2-S44", type: "booth", zone: 2, x: 571.8, y: 688.5, rotation: 270 },
  { id: "L2-S45", type: "booth", zone: 2, x: 571.8, y: 616.9, rotation: 270 },
  { id: "L2-S46", type: "booth", zone: 2, x: 571.8, y: 546.6, rotation: 270 },
  { id: "L2-S47", type: "booth", zone: 2, x: 595.3, y: 842, w: 90, h: 84, rotation: 270, corner: "tl", depth: 20 },
  { id: "L2-B33", type: "bar", zone: 2, x: 814, y: 521.3, w: 27.5, h: 27.5 },
  { id: "L2-B37", type: "bar", zone: 2, x: 690.5, y: 552, w: 27.2, h: 27.2 },
  { id: "L2-B27", type: "bar", zone: 2, x: 693, y: 630.2, w: 27.2, h: 27.2 },
  { id: "L2-B40", type: "bar", zone: 2, x: 693, y: 707.5, w: 27.2, h: 27.2 },
  { id: "L2-S48", type: "booth", zone: 2, x: 1104.7, y: 990.7, w: 65.2, h: 38 },
  { id: "L2-S49", type: "booth", zone: 2, x: 1039.6, y: 990.7, w: 65.2, h: 38 },
  { id: "L2-S50", type: "booth", zone: 2, x: 972.4, y: 990.7, w: 65.2, h: 38 },
  { id: "L2-S51", type: "booth", zone: 2, x: 905.4, y: 991.5, w: 65.2, h: 38 },
  { id: "L2-S52", type: "booth", zone: 2, x: 695.7, y: 991.5, w: 65.2, h: 38 },
  { id: "L2-S53", type: "booth", zone: 2, x: 630.5, y: 990.7, w: 65.2, h: 38 },
  { id: "L2-S54", type: "booth", zone: 2, x: 565.3, y: 990.7, w: 65.2, h: 38 },
  { id: "L2-B41", type: "bar", zone: 2, x: 579.6, y: 920.8, w: 28.5, h: 28.5 },
  { id: "L2-B42", type: "bar", zone: 2, x: 633.7, y: 919.3, w: 28.5, h: 28.5 },
  { id: "L2-B43", type: "bar", zone: 2, x: 686, y: 919.3, w: 28.5, h: 28.5 },
  { id: "L2-B44", type: "bar", zone: 2, x: 874.3, y: 922.3, w: 28.5, h: 28.5 },
  { id: "L2-B45", type: "bar", zone: 2, x: 938, y: 922.3, w: 28.5, h: 28.5 },
  { id: "L2-B46", type: "bar", zone: 2, x: 998, y: 922.3, w: 28.5, h: 28.5 },
  { id: "L2-B47", type: "bar", zone: 2, x: 1050.1, y: 922.3, w: 28.5, h: 28.5 },
  { id: "L2-B48", type: "bar", zone: 2, x: 1121.6, y: 906.5, w: 28.5, h: 28.5 },
  { id: "L2-B49", type: "bar", zone: 3, x: 253.9, y: 354, w: 28, h: 28 },
  { id: "L2-B50", type: "bar", zone: 3, x: 306.2, y: 354, w: 28, h: 28 },
  { id: "L2-B51", type: "bar", zone: 3, x: 361.6, y: 354, w: 28, h: 28 },
  { id: "L2-B52", type: "bar", zone: 3, x: 413.9, y: 354, w: 28, h: 28 },
  { id: "L2-B53", type: "bar", zone: 3, x: 472, y: 354, w: 28, h: 28 },
  { id: "L2-B54", type: "bar", zone: 3, x: 257.8, y: 432.8, w: 28, h: 28 },
  { id: "L2-B55", type: "bar", zone: 3, x: 257.8, y: 502.1, w: 28, h: 28 },
  { id: "L2-B56", type: "bar", zone: 3, x: 257.8, y: 563.9, w: 28, h: 28 },
  { id: "L2-B57", type: "bar", zone: 3, x: 315.8, y: 432.8, w: 28, h: 28 },
  { id: "L2-B58", type: "bar", zone: 3, x: 315.8, y: 502.1, w: 28, h: 28 },
  { id: "L2-B59", type: "bar", zone: 3, x: 315.8, y: 563.9, w: 28, h: 28 },
  { id: "L2-B60", type: "bar", zone: 3, x: 511.1, y: 475.1, w: 27.9, h: 27.9 },
  { id: "L2-B61", type: "bar", zone: 3, x: 454.6, y: 491.7, w: 27.9, h: 27.9 },
  { id: "L2-B62", type: "bar", zone: 3, x: 454.6, y: 558.2, w: 27.9, h: 27.9 },
  { id: "L2-B63", type: "bar", zone: 3, x: 454.6, y: 614.5, w: 27.9, h: 27.9 },
  { id: "L2-B64", type: "bar", zone: 3, x: 454.6, y: 683.5, w: 27.9, h: 27.9 },
  { id: "L2-B65", type: "bar", zone: 3, x: 454.6, y: 754.1, w: 27.9, h: 27.9 },
  { id: "L2-B66", type: "bar", zone: 3, x: 454.6, y: 817.2, w: 27.9, h: 27.9 },
  { id: "L2-B67", type: "bar", zone: 3, x: 454.6, y: 883.6, w: 27.9, h: 27.9 },
  { id: "L2-B68", type: "bar", zone: 3, x: 446.7, y: 958.6, w: 27.9, h: 27.9 },
  { id: "L2-S55", type: "booth", zone: 3, x: 500.1, y: 990.7, w: 65.2, h: 38 },
  { id: "L2-S56", type: "booth", zone: 3, x: 521, y: 546.6, rotation: 90 },
  { id: "L2-S57", type: "booth", zone: 3, x: 521, y: 616.6, rotation: 90 },
  { id: "L2-S58", type: "booth", zone: 3, x: 521, y: 686, rotation: 90 },
  { id: "L2-S59", type: "booth", zone: 3, x: 521, y: 757.7, rotation: 90 },
  { id: "L2-B69", type: "bar", zone: 3, x: 521, y: 920.5 },
  { id: "L2-B70", type: "bar", zone: 3, x: 320.1, y: 1003.1, w: 27.9, h: 27.9 },
  { id: "L2-B71", type: "bar", zone: 3, x: 389.6, y: 1002.1, w: 27.9, h: 27.9 },
  { id: "L2-B72", type: "bar", zone: 3, x: 315.7, y: 867, w: 27.9, h: 27.9 },
  { id: "L2-B73", type: "bar", zone: 3, x: 315.7, y: 808.4, w: 27.9, h: 27.9 },
  { id: "L2-B74", type: "bar", zone: 3, x: 315.7, y: 752.1, w: 27.9, h: 27.9 },
  { id: "L2-B75", type: "bar", zone: 3, x: 320.1, y: 658.6, w: 27.9, h: 27.9 },
  { id: "L2-B76", type: "bar", zone: 3, x: 248.7, y: 658.6, w: 27.9, h: 27.9 },
  { id: "L2-V01", type: "high", zone: 3, x: 362.9, y: 430, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V02", type: "high", zone: 3, x: 362.9, y: 479.2, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V03", type: "high", zone: 3, x: 362.9, y: 527.6, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V04", type: "high", zone: 3, x: 361.6, y: 647.3, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V05", type: "high", zone: 3, x: 361.6, y: 696.3, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V06", type: "high", zone: 3, x: 361.6, y: 745.5, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V07", type: "high", zone: 3, x: 361.6, y: 794.4, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-V08", type: "high", zone: 3, x: 361.6, y: 842, w: 47.7, h: 39.3, rotation: 270 },
  { id: "L2-B77", type: "bar", zone: 1, x: 117.4, y: 353, w: 26.1, h: 26.1 },
];

/* What a table on this floor seats, where the club has settled it table by
   table. Keyed by id, never by the printed number; a table absent from here
   seats what its kind seats, per SEAT_KINDS.
   IT LIVES OUTSIDE THE ARRAYS ABOVE ON PURPOSE: the exporter writes geometry
   only, so a capacity written into a seat literal would be wiped on the next
   round trip through the editor — silently. lib/floor-capacity.ts folds this
   in beside the first floor's figures. */
export const SEAT_CAPACITY_L2: Record<string, { min: number; max: number }> = {
};
